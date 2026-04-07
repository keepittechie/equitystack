#!/usr/bin/env python3
import argparse
import csv
import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

DEFAULT_DECISION = "remove_link"
DEFAULT_MIN_CONFIDENCE = 0.75
APPLIED_BY = "future_bill_ai_review"
VALID_ACTION_DECISIONS = {DEFAULT_DECISION}


def get_project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def get_reports_dir() -> Path:
    return get_project_root() / "python" / "reports"


def get_default_input_path() -> Path:
    return get_reports_dir() / "future_bill_link_ai_review.json"


def get_default_output_report_path() -> Path:
    return get_reports_dir() / "future_bill_link_ai_apply_report.json"


def get_default_manual_queue_path() -> Path:
    return get_reports_dir() / "future_bill_link_manual_review_queue.json"


def get_default_override_path() -> Path:
    return get_reports_dir() / "future_bill_link_review_overrides.json"


def get_db_connection():
    from audit_future_bill_links import get_db_connection as _get_db_connection

    return _get_db_connection()


ACTION_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS future_bill_link_review_actions (
  id INT NOT NULL AUTO_INCREMENT,
  future_bill_link_id INT NOT NULL,
  prior_link_type ENUM('Direct', 'Related', 'Companion', 'Partial') DEFAULT NULL,
  prior_tracked_bill_id INT DEFAULT NULL,
  prior_future_bill_id INT DEFAULT NULL,
  ai_final_decision VARCHAR(32) NOT NULL,
  ai_match_label VARCHAR(32) NOT NULL,
  ai_total_score INT NOT NULL,
  ai_model VARCHAR(128) DEFAULT NULL,
  source_review_report VARCHAR(512) DEFAULT NULL,
  action_taken VARCHAR(64) NOT NULL,
  action_reason TEXT DEFAULT NULL,
  applied_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  applied_by VARCHAR(128) DEFAULT NULL,
  raw_review_json LONGTEXT DEFAULT NULL,
  archived_link_json LONGTEXT DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_future_bill_link_review_actions_link_id (future_bill_link_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Safely apply removal-only future bill link actions from an AI review report."
    )
    parser.add_argument("--input", type=Path, default=get_default_input_path(), help="Path to future_bill_link_ai_review.json")
    parser.add_argument("--apply", action="store_true", help="Write eligible removals to the database")
    parser.add_argument("--dry-run", action="store_true", help="Force dry-run mode even if --apply is supplied")
    parser.add_argument("--only-link-id", type=int, action="append", help="Limit processing to one or more future_bill_link_id values")
    parser.add_argument("--max-items", type=int, help="Limit the number of review items processed after filtering")
    parser.add_argument("--decision", default=DEFAULT_DECISION, choices=sorted(VALID_ACTION_DECISIONS), help="Decision type to consider for auto-apply")
    parser.add_argument("--min-confidence", type=float, default=DEFAULT_MIN_CONFIDENCE, help="Minimum llm_confidence required for auto-removal")
    parser.add_argument("--output-report", type=Path, default=get_default_output_report_path(), help="Path to write the action report JSON")
    parser.add_argument(
        "--csv",
        nargs="?",
        const="",
        help="Optionally write an action CSV report. Pass a path or omit the value to derive one from --output-report.",
    )
    parser.add_argument("--archive-rows", action="store_true", help="Store the full pre-delete future_bill_links row in the audit table")
    parser.add_argument("--yes", action="store_true", help="Required confirmation bypass for --apply mode")
    return parser.parse_args()


def load_review_report(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text())
    if not isinstance(payload, dict):
        raise ValueError("AI review report must be a JSON object")
    return payload


def load_manual_overrides(path: Path) -> set[int]:
    if not path.exists():
        return set()

    payload = json.loads(path.read_text())
    if isinstance(payload, list):
        return {int(value) for value in payload}
    if isinstance(payload, dict):
        values = payload.get("exclude_link_ids") or payload.get("manual_only_link_ids") or []
        return {int(value) for value in values}
    raise ValueError("Manual override file must be a JSON list or object containing exclude_link_ids")


def filter_items(items: list[dict[str, Any]], only_link_ids: list[int] | None, decision: str, max_items: int | None) -> list[dict[str, Any]]:
    selected = [item for item in items if item.get("final_decision") == decision]

    if only_link_ids:
        wanted = set(only_link_ids)
        selected = [item for item in selected if int(item["future_bill_link_id"]) in wanted]

    selected.sort(key=lambda item: (item.get("original_risk_level") != "high", item.get("future_bill_link_id", 0)))

    if max_items is not None:
        selected = selected[:max_items]

    return selected


def filter_scope_items(items: list[dict[str, Any]], only_link_ids: list[int] | None) -> list[dict[str, Any]]:
    if not only_link_ids:
        return list(items)
    wanted = set(only_link_ids)
    return [item for item in items if int(item["future_bill_link_id"]) in wanted]


def derive_csv_path(csv_arg: str | None, output_report_path: Path) -> Path | None:
    if csv_arg is None:
        return None
    if csv_arg == "":
        return output_report_path.with_suffix(".csv")
    return Path(csv_arg).resolve()


def manual_queue_csv_path(manual_queue_path: Path) -> Path:
    return manual_queue_path.with_suffix(".csv")


def derive_manual_queue_path(output_report_path: Path) -> Path:
    default_path = get_default_output_report_path()
    if output_report_path == default_path:
        return get_default_manual_queue_path()
    return output_report_path.with_name("future_bill_link_manual_review_queue.json")


def bool_flag(item: dict[str, Any], key: str) -> bool:
    return bool((item.get("heuristic_flags") or {}).get(key))


def confidence_is_eligible(item: dict[str, Any], min_confidence: float) -> bool:
    confidence = item.get("llm_confidence")
    if confidence is None:
        return True
    try:
        return float(confidence) >= min_confidence
    except (TypeError, ValueError):
        return False


def conflicting_partial_recovery(item: dict[str, Any]) -> bool:
    return bool_flag(item, "bias_partial") or item.get("suggested_new_link_type") == "Partial"


def evaluate_auto_removal(item: dict[str, Any], min_confidence: float, override_exclusions: set[int]) -> tuple[bool, list[str]]:
    reasons: list[str] = []
    link_id = int(item["future_bill_link_id"])

    if item.get("final_decision") != "remove_link":
        reasons.append("final_decision is not remove_link")
    if item.get("match_label") != "bad_match":
        reasons.append("match_label is not bad_match")
    if item.get("original_risk_level") != "high":
        reasons.append("original_risk_level is not high")
    if int(item.get("total_score") or 0) > 3:
        reasons.append("total_score is above the auto-removal cap")
    if int(item.get("solution_alignment") or 0) not in {0, 1}:
        reasons.append("solution_alignment suggests more than an obvious bad match")
    if int(item.get("evidence_strength") or 0) > 1:
        reasons.append("evidence_strength is above the weak-evidence cap")
    if conflicting_partial_recovery(item):
        reasons.append("partial-recovery signals are present")
    if link_id in override_exclusions:
        reasons.append("link is excluded by the manual override list")
    if not confidence_is_eligible(item, min_confidence):
        reasons.append("llm_confidence is below the required minimum")
    if bool_flag(item, "weak_title_evidence") and not bool_flag(item, "missing_summary_low_overlap"):
        reasons.append("weak title evidence without a hard remove signal should stay manual")

    return len(reasons) == 0, reasons


def determine_next_step(item: dict[str, Any], why_not_auto_applied: list[str]) -> str:
    if item.get("final_decision") == "remove_link":
        return "manual_remove_review"
    if bool_flag(item, "bias_partial") or item.get("suggested_new_link_type") == "Partial":
        return "consider_partial_match"
    if not (item.get("official_summary") or "").strip():
        return "inspect_bill_summary"
    if why_not_auto_applied:
        return "retain_for_now"
    return "retain_for_now"


def manual_review_row(item: dict[str, Any], why_not_auto_applied: list[str]) -> dict[str, Any]:
    return {
        "future_bill_id": item.get("future_bill_id"),
        "future_bill_link_id": item.get("future_bill_link_id"),
        "tracked_bill_id": item.get("tracked_bill_id"),
        "future_bill_title": item.get("future_bill_title"),
        "bill_number": item.get("bill_number"),
        "tracked_bill_title": item.get("tracked_bill_title"),
        "original_risk_level": item.get("original_risk_level"),
        "final_decision": item.get("final_decision"),
        "match_label": item.get("match_label"),
        "total_score": item.get("total_score"),
        "llm_reasoning_short": item.get("llm_reasoning_short"),
        "why_not_auto_applied": why_not_auto_applied,
        "suggested_next_step": determine_next_step(item, why_not_auto_applied),
    }


def fetch_future_bill_link(cursor, future_bill_link_id: int) -> dict[str, Any] | None:
    cursor.execute(
        """
        SELECT
          id,
          future_bill_id,
          tracked_bill_id,
          link_type,
          notes,
          created_at
        FROM future_bill_links
        WHERE id = %s
        LIMIT 1
        """,
        (future_bill_link_id,),
    )
    return cursor.fetchone()


def ensure_action_table(cursor) -> None:
    cursor.execute(ACTION_TABLE_SQL)


def insert_action_audit(
    cursor,
    prior_row: dict[str, Any],
    item: dict[str, Any],
    source_review_report: Path,
    ai_model: str | None,
    action_taken: str,
    action_reason: str,
    archive_rows: bool,
) -> None:
    cursor.execute(
        """
        INSERT INTO future_bill_link_review_actions (
          future_bill_link_id,
          prior_link_type,
          prior_tracked_bill_id,
          prior_future_bill_id,
          ai_final_decision,
          ai_match_label,
          ai_total_score,
          ai_model,
          source_review_report,
          action_taken,
          action_reason,
          applied_by,
          raw_review_json,
          archived_link_json
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            prior_row["id"],
            prior_row.get("link_type"),
            prior_row.get("tracked_bill_id"),
            prior_row.get("future_bill_id"),
            item.get("final_decision"),
            item.get("match_label"),
            int(item.get("total_score") or 0),
            ai_model,
            str(source_review_report),
            action_taken,
            action_reason,
            APPLIED_BY,
            json.dumps(item, default=str),
            json.dumps(prior_row, default=str) if archive_rows else None,
        ),
    )


def delete_future_bill_link(cursor, future_bill_link_id: int) -> None:
    cursor.execute(
        "DELETE FROM future_bill_links WHERE id = %s",
        (future_bill_link_id,),
    )


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, default=str))


def write_csv(path: Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field) for field in fieldnames})


def action_report_row(item: dict[str, Any], status: str, reasons: list[str], action_taken: str) -> dict[str, Any]:
    return {
        "future_bill_id": item.get("future_bill_id"),
        "future_bill_link_id": item.get("future_bill_link_id"),
        "tracked_bill_id": item.get("tracked_bill_id"),
        "future_bill_title": item.get("future_bill_title"),
        "bill_number": item.get("bill_number"),
        "tracked_bill_title": item.get("tracked_bill_title"),
        "original_risk_level": item.get("original_risk_level"),
        "final_decision": item.get("final_decision"),
        "match_label": item.get("match_label"),
        "total_score": item.get("total_score"),
        "solution_alignment": item.get("solution_alignment"),
        "evidence_strength": item.get("evidence_strength"),
        "llm_confidence": item.get("llm_confidence"),
        "status": status,
        "action_taken": action_taken,
        "why_not_auto_applied": reasons,
        "suggested_next_step": determine_next_step(item, reasons),
    }


def summarize(action_rows: list[dict[str, Any]], manual_queue: list[dict[str, Any]], total_items_in_report: int) -> dict[str, int]:
    summary = {
        "total_items_in_review_file": total_items_in_report,
        "decision_items_considered": len(action_rows),
        "eligible_auto_removals": 0,
        "applied_removals": 0,
        "skipped_removals": 0,
        "manual_review_leftovers": len(manual_queue),
    }
    for row in action_rows:
        if row["status"] == "eligible_dry_run":
            summary["eligible_auto_removals"] += 1
        elif row["status"] == "applied":
            summary["eligible_auto_removals"] += 1
            summary["applied_removals"] += 1
        elif row["status"] == "skipped":
            summary["skipped_removals"] += 1
    return summary


def main() -> None:
    args = parse_args()

    if args.apply and args.dry_run:
        raise SystemExit("Use either --apply or --dry-run, not both.")
    if args.apply and not args.yes:
        raise SystemExit("Refusing to write changes without --yes. Re-run with --apply --yes after reviewing the dry-run report.")
    if args.max_items is not None and args.max_items <= 0:
        raise SystemExit("--max-items must be greater than 0")
    if not 0.0 <= args.min_confidence <= 1.0:
        raise SystemExit("--min-confidence must be between 0.0 and 1.0")

    input_path = args.input.resolve()
    output_report_path = args.output_report.resolve()
    action_csv_path = derive_csv_path(args.csv, output_report_path)
    manual_queue_path = derive_manual_queue_path(output_report_path)
    manual_queue_csv = manual_queue_csv_path(manual_queue_path) if action_csv_path else None
    override_exclusions = load_manual_overrides(get_default_override_path())

    review_payload = load_review_report(input_path)
    review_items = list(review_payload.get("items") or [])
    scoped_items = filter_scope_items(review_items, args.only_link_id)
    selected_items = filter_items(scoped_items, args.only_link_id, args.decision, args.max_items)

    print("Future Bill AI Review Apply")
    print(f"Input report: {input_path}")
    print(f"Mode: {'apply' if args.apply else 'dry-run'}")
    print(f"Decision filter: {args.decision}")
    print(f"Selected items: {len(selected_items)}")

    action_rows: list[dict[str, Any]] = []
    manual_queue: list[dict[str, Any]] = []
    queued_ids: set[int] = set()
    ai_model = review_payload.get("resolved_model") or review_payload.get("requested_model")

    conn = None
    if args.apply:
        conn = get_db_connection()

    try:
        if conn:
            with conn.cursor() as cursor:
                ensure_action_table(cursor)

                for item in selected_items:
                    eligible, reasons = evaluate_auto_removal(item, args.min_confidence, override_exclusions)
                    if not eligible:
                        action_rows.append(action_report_row(item, "skipped", reasons, "no_db_change"))
                        manual_queue.append(manual_review_row(item, reasons))
                        queued_ids.add(int(item["future_bill_link_id"]))
                        continue

                    prior_row = fetch_future_bill_link(cursor, int(item["future_bill_link_id"]))
                    if not prior_row:
                        reasons = ["future_bill_links row no longer exists"]
                        action_rows.append(action_report_row(item, "skipped", reasons, "no_db_change"))
                        manual_queue.append(manual_review_row(item, reasons))
                        queued_ids.add(int(item["future_bill_link_id"]))
                        continue

                    action_reason = "Auto-applied obvious bad-match removal from AI review."
                    insert_action_audit(
                        cursor,
                        prior_row,
                        item,
                        input_path,
                        ai_model,
                        "deleted_link",
                        action_reason,
                        args.archive_rows,
                    )
                    delete_future_bill_link(cursor, int(item["future_bill_link_id"]))
                    action_rows.append(action_report_row(item, "applied", [], "deleted_link"))
                    print(f"Applied delete for future_bill_link_id={item['future_bill_link_id']}")

            conn.commit()
        else:
            for item in selected_items:
                eligible, reasons = evaluate_auto_removal(item, args.min_confidence, override_exclusions)
                if eligible:
                    action_rows.append(action_report_row(item, "eligible_dry_run", [], "would_delete_link"))
                    manual_queue.append(manual_review_row(item, ["dry-run only; no DB mutation performed"]))
                    queued_ids.add(int(item["future_bill_link_id"]))
                    print(f"Eligible dry-run removal: future_bill_link_id={item['future_bill_link_id']}")
                else:
                    action_rows.append(action_report_row(item, "skipped", reasons, "no_db_change"))
                    manual_queue.append(manual_review_row(item, reasons))
                    queued_ids.add(int(item["future_bill_link_id"]))
    except Exception:
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            conn.close()

    for item in scoped_items:
        link_id = int(item["future_bill_link_id"])
        if link_id in queued_ids:
            continue
        manual_queue.append(
            manual_review_row(
                item,
                ["decision is manual-only in this version"],
            )
        )

    summary = summarize(action_rows, manual_queue, len(scoped_items))
    action_report = {
        "generated_at": datetime.now(UTC).isoformat(),
        "mode": "apply" if args.apply else "dry_run",
        "input_report": str(input_path),
        "decision_filter": args.decision,
        "min_confidence": args.min_confidence,
        "archive_rows": args.archive_rows,
        "manual_override_file": str(get_default_override_path()),
        "summary": summary,
        "actions": action_rows,
        "manual_review_queue_path": str(manual_queue_path),
    }
    manual_queue_report = {
        "generated_at": datetime.now(UTC).isoformat(),
        "source_action_report": str(output_report_path),
        "items": manual_queue,
        "manual_review_count": len(manual_queue),
    }

    write_json(output_report_path, action_report)
    write_json(manual_queue_path, manual_queue_report)
    print(f"Wrote action report to {output_report_path}")
    print(f"Wrote manual review queue to {manual_queue_path}")

    if action_csv_path:
        write_csv(
            action_csv_path,
            action_rows,
            [
                "future_bill_id",
                "future_bill_link_id",
                "tracked_bill_id",
                "future_bill_title",
                "bill_number",
                "tracked_bill_title",
                "original_risk_level",
                "final_decision",
                "match_label",
                "total_score",
                "solution_alignment",
                "evidence_strength",
                "llm_confidence",
                "status",
                "action_taken",
                "suggested_next_step",
            ],
        )
        write_csv(
            manual_queue_csv,
            manual_queue,
            [
                "future_bill_id",
                "future_bill_link_id",
                "tracked_bill_id",
                "future_bill_title",
                "bill_number",
                "tracked_bill_title",
                "original_risk_level",
                "final_decision",
                "match_label",
                "total_score",
                "llm_reasoning_short",
                "suggested_next_step",
            ],
        )
        print(f"Wrote action CSV to {action_csv_path}")
        print(f"Wrote manual review CSV to {manual_queue_csv}")

    print(
        "Summary: "
        f"eligible_auto_removals={summary['eligible_auto_removals']} | "
        f"applied_removals={summary['applied_removals']} | "
        f"skipped_removals={summary['skipped_removals']} | "
        f"manual_review_leftovers={summary['manual_review_leftovers']}"
    )


if __name__ == "__main__":
    main()
