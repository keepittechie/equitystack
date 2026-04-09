#!/usr/bin/env python3
import argparse
import csv
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from apply_future_bill_ai_review import get_db_connection


APPLIED_BY = "equitystack_review_bundle"

ACTION_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS future_bill_link_operator_actions (
  id INT NOT NULL AUTO_INCREMENT,
  action_id VARCHAR(255) NOT NULL,
  action_type VARCHAR(64) NOT NULL,
  target_type VARCHAR(64) DEFAULT NULL,
  target_id INT DEFAULT NULL,
  future_bill_id INT DEFAULT NULL,
  future_bill_link_id INT DEFAULT NULL,
  tracked_bill_id INT DEFAULT NULL,
  previous_link_type VARCHAR(32) DEFAULT NULL,
  new_link_type VARCHAR(32) DEFAULT NULL,
  bundle_path VARCHAR(512) DEFAULT NULL,
  action_status VARCHAR(64) NOT NULL,
  action_reason TEXT DEFAULT NULL,
  applied_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  applied_by VARCHAR(128) DEFAULT NULL,
  raw_action_json LONGTEXT DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_future_bill_link_operator_actions_action_id (action_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
"""


def python_dir() -> Path:
    return Path(__file__).resolve().parents[1]


def reports_dir() -> Path:
    return python_dir() / "reports"


def default_input_path() -> Path:
    return reports_dir() / "equitystack_review_bundle.json"


def default_output_path() -> Path:
    return reports_dir() / "equitystack_apply_report.json"


def default_seed_output_path() -> Path:
    return reports_dir() / "approved_tracked_bills_seed.json"


def default_feedback_log_path() -> Path:
    return reports_dir() / "equitystack_feedback_log.json"


def derive_csv_path(csv_arg: str | None, output_path: Path) -> Path | None:
    if csv_arg is None:
        return None
    if csv_arg == "":
        return output_path.with_suffix(".csv")
    return Path(csv_arg).resolve()


def write_csv_rows(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        path.write_text("")
        return

    fieldnames: list[str] = []
    seen: set[str] = set()
    for row in rows:
        for key in row.keys():
            if key not in seen:
                seen.add(key)
                fieldnames.append(key)

    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def first_present(*values: Any) -> Any:
    for value in values:
        if isinstance(value, str):
            if value.strip():
                return value.strip()
        elif value not in (None, ""):
            return value
    return None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Safely apply only approved operator_actions from an EquityStack review bundle.")
    parser.add_argument("--input", type=Path, default=default_input_path(), help="Path to reports/equitystack_review_bundle.json")
    parser.add_argument("--apply", action="store_true", help="Mutate the database for approved actions")
    parser.add_argument("--yes", action="store_true", help="Required confirmation bypass for --apply mode")
    parser.add_argument("--only-future-bill-id", type=int, action="append", help="Limit to one or more future_bill_id values")
    parser.add_argument("--output", type=Path, default=default_output_path(), help="Path to write reports/equitystack_apply_report.json")
    parser.add_argument("--csv", nargs="?", const="", help="Write a CSV summary. Pass a path or omit a value to derive one.")
    return parser.parse_args()


def load_bundle(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text())
    if not isinstance(payload, dict):
        raise ValueError("Review bundle must be a JSON object")
    return payload


def flatten_operator_actions(bundle: dict[str, Any]) -> list[dict[str, Any]]:
    actions: list[dict[str, Any]] = []
    for group in bundle.get("future_bill_groups") or []:
        future_bill_id = int(group["future_bill_id"])
        future_bill_title = group.get("future_bill_title")
        for action in group.get("operator_actions") or []:
            actions.append(
                {
                    **action,
                    "future_bill_id": int(action.get("future_bill_id") or future_bill_id),
                    "future_bill_title": action.get("future_bill_title") or future_bill_title,
                }
            )
    if actions:
        return actions
    # Fallback for bundles that also maintain a top-level pending index.
    for action in bundle.get("pending_actions_index") or []:
        if "future_bill_id" in action:
            actions.append(action)
    return actions


def select_actions(actions: list[dict[str, Any]], only_future_bill_ids: set[int]) -> list[dict[str, Any]]:
    selected = []
    for action in actions:
        if only_future_bill_ids and int(action["future_bill_id"]) not in only_future_bill_ids:
            continue
        selected.append(action)
    return selected


def is_approved_pending(action: dict[str, Any]) -> bool:
    return bool(action.get("approved") is True and str(action.get("status") or "").lower() == "pending")


def ensure_operator_table(cursor) -> None:
    cursor.execute(ACTION_TABLE_SQL)


def fetch_future_bill_link(cursor, future_bill_link_id: int) -> dict[str, Any] | None:
    cursor.execute(
        """
        SELECT id, future_bill_id, tracked_bill_id, link_type, notes, created_at
        FROM future_bill_links
        WHERE id = %s
        LIMIT 1
        """,
        (future_bill_link_id,),
    )
    return cursor.fetchone()


def find_existing_link(cursor, future_bill_id: int, tracked_bill_id: int) -> dict[str, Any] | None:
    cursor.execute(
        """
        SELECT id, future_bill_id, tracked_bill_id, link_type, notes, created_at
        FROM future_bill_links
        WHERE future_bill_id = %s AND tracked_bill_id = %s
        LIMIT 1
        """,
        (future_bill_id, tracked_bill_id),
    )
    return cursor.fetchone()


def update_future_bill_link(cursor, future_bill_link_id: int, link_type: str, notes: str | None) -> None:
    cursor.execute(
        """
        UPDATE future_bill_links
        SET link_type = %s, notes = %s
        WHERE id = %s
        """,
        (link_type, notes, future_bill_link_id),
    )


def insert_partial_link(cursor, future_bill_id: int, tracked_bill_id: int, notes: str | None) -> int:
    cursor.execute(
        """
        INSERT INTO future_bill_links (
          future_bill_id,
          tracked_bill_id,
          link_type,
          notes
        ) VALUES (%s, %s, 'Partial', %s)
        """,
        (future_bill_id, tracked_bill_id, notes),
    )
    return int(cursor.lastrowid)


def delete_future_bill_link(cursor, future_bill_link_id: int) -> None:
    cursor.execute("DELETE FROM future_bill_links WHERE id = %s", (future_bill_link_id,))


def insert_operator_log(
    cursor,
    *,
    action: dict[str, Any],
    previous_link_type: str | None,
    new_link_type: str | None,
    bundle_path: Path,
    action_status: str,
    action_reason: str,
    tracked_bill_id: int | None,
) -> None:
    cursor.execute(
        """
        INSERT INTO future_bill_link_operator_actions (
          action_id,
          action_type,
          target_type,
          target_id,
          future_bill_id,
          future_bill_link_id,
          tracked_bill_id,
          previous_link_type,
          new_link_type,
          bundle_path,
          action_status,
          action_reason,
          applied_by,
          raw_action_json
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            action.get("action_id"),
            action.get("action_type"),
            action.get("target_type"),
            action.get("target_id"),
            action.get("future_bill_id"),
            action.get("payload", {}).get("future_bill_link_id"),
            tracked_bill_id,
            previous_link_type,
            new_link_type,
            str(bundle_path),
            action_status,
            action_reason,
            APPLIED_BY,
            json.dumps(action, default=str),
        ),
    )


def base_result(action: dict[str, Any], result: str, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    row = {
        "action_id": action.get("action_id"),
        "action_type": action.get("action_type"),
        "future_bill_id": action.get("future_bill_id"),
        "result": result,
        "timestamp": datetime.now(UTC).isoformat(),
    }
    if extra:
        row.update(extra)
    return row


def change_summary(
    *,
    future_bill_link_id: int | None,
    future_bill_id: int,
    tracked_bill_id: int | None,
    old_link_type: str | None,
    new_link_type: str | None,
    action: dict[str, Any],
) -> dict[str, Any]:
    return {
        "future_bill_link_id": future_bill_link_id,
        "future_bill_id": future_bill_id,
        "tracked_bill_id": tracked_bill_id,
        "old_link_type": old_link_type,
        "new_link_type": new_link_type,
        "action_id": action.get("action_id"),
        "action_type": action.get("action_type"),
    }


def validate_payload(action: dict[str, Any]) -> tuple[bool, str | None]:
    action_type = action.get("action_type")
    payload = action.get("payload") or {}
    if action_type == "remove_direct_link":
        if not payload.get("future_bill_link_id"):
            return False, "remove_direct_link requires payload.future_bill_link_id"
        return True, None
    if action_type == "convert_to_direct":
        if not payload.get("future_bill_link_id"):
            return False, "convert_to_direct requires payload.future_bill_link_id"
        return True, None
    if action_type == "convert_to_partial":
        if not payload.get("future_bill_link_id"):
            return False, "convert_to_partial requires payload.future_bill_link_id"
        return True, None
    if action_type == "create_partial_link":
        if not payload.get("future_bill_id") or not payload.get("tracked_bill_id"):
            return False, "create_partial_link requires payload.future_bill_id and payload.tracked_bill_id"
        return True, None
    if action_type == "import_candidate_seed":
        if not payload:
            return False, "import_candidate_seed requires payload"
        return True, None
    return False, f"Unsupported action_type: {action_type}"


def approved_seed_row(action: dict[str, Any]) -> dict[str, Any]:
    payload = dict(action.get("payload") or {})
    raw_data = action.get("raw_data") if isinstance(action.get("raw_data"), dict) else {}
    payload.setdefault("future_bill_id", action.get("future_bill_id"))
    payload.setdefault("link_type", None)
    payload.setdefault("active", True)
    payload.setdefault("jurisdiction", "Federal")
    payload.setdefault("source_system", "Approved review bundle import")
    payload.setdefault("link_notes", f"Approved from review bundle action {action.get('action_id')}")
    payload.setdefault("title", action.get("candidate_title") or raw_data.get("title"))
    payload.setdefault("candidate_title", action.get("candidate_title") or raw_data.get("title"))
    payload.setdefault("official_summary", raw_data.get("official_summary") or raw_data.get("summary"))
    payload.setdefault("bill_url", raw_data.get("url"))
    payload.setdefault("raw_data", raw_data or None)
    if not payload.get("impact_status"):
        payload["impact_status"] = first_present(action.get("impact_status"), raw_data.get("impact_status"))
    if not payload.get("recommended_action"):
        payload["recommended_action"] = first_present(action.get("recommended_action"), raw_data.get("recommended_action"))
    if not payload.get("confidence"):
        payload["confidence"] = first_present(action.get("confidence"), raw_data.get("confidence"))
    if not payload.get("source_quality"):
        payload["source_quality"] = first_present(action.get("source_quality"), raw_data.get("source_quality"))
    return payload


def append_feedback_entries(entries: list[dict[str, Any]]) -> None:
    if not entries:
        return
    path = default_feedback_log_path()
    existing: list[dict[str, Any]] = []
    if path.exists():
        payload = json.loads(path.read_text())
        if isinstance(payload, list):
            existing = [item for item in payload if isinstance(item, dict)]
    existing.extend(entries)
    path.write_text(json.dumps(existing, indent=2, default=str) + "\n")


def feedback_entry(action: dict[str, Any], decision: str) -> dict[str, Any]:
    payload = action.get("payload") or {}
    breakdown = action.get("score_breakdown") or {}
    link_type = payload.get("new_link_type") or payload.get("link_type") or action.get("proposed_link_type")
    return {
        "timestamp": datetime.now(UTC).isoformat(),
        "action_id": action.get("action_id"),
        "action_type": action.get("action_type"),
        "action_score": action.get("action_score"),
        "action_priority": action.get("action_priority"),
        "match_confidence": breakdown.get("match_confidence"),
        "decision": decision,
        "auto_triaged": action.get("auto_triaged"),
        "auto_triage_decision": action.get("auto_triage_decision"),
        "auto_triage_reason": action.get("auto_triage_reason"),
        "future_bill_id": action.get("future_bill_id"),
        "link_type": link_type,
    }


def apply_remove_direct_link(cursor, action: dict[str, Any], bundle_path: Path) -> dict[str, Any]:
    future_bill_link_id = int(action["payload"]["future_bill_link_id"])
    prior = fetch_future_bill_link(cursor, future_bill_link_id)
    if not prior:
        insert_operator_log(
            cursor,
            action=action,
            previous_link_type=None,
            new_link_type=None,
            bundle_path=bundle_path,
            action_status="skipped_already_absent",
            action_reason="Approved review bundle removal target was already absent",
            tracked_bill_id=None,
        )
        return base_result(
            action,
            "skipped_already_absent",
            {
                "future_bill_link_id": future_bill_link_id,
                "message": f"future_bill_link_id {future_bill_link_id} was already absent",
                "reason": "remove_direct_link target no longer exists",
            },
        )
    delete_future_bill_link(cursor, future_bill_link_id)
    insert_operator_log(
        cursor,
        action=action,
        previous_link_type=prior.get("link_type"),
        new_link_type=None,
        bundle_path=bundle_path,
        action_status="applied",
        action_reason="Approved review bundle removal",
        tracked_bill_id=prior.get("tracked_bill_id"),
    )
    return base_result(
        action,
        "applied",
        {
            "future_bill_link_id": future_bill_link_id,
            "change_summary": change_summary(
                future_bill_link_id=future_bill_link_id,
                future_bill_id=int(prior["future_bill_id"]),
                tracked_bill_id=prior.get("tracked_bill_id"),
                old_link_type=prior.get("link_type"),
                new_link_type=None,
                action=action,
            ),
        },
    )


def apply_convert_to_partial(cursor, action: dict[str, Any], bundle_path: Path) -> dict[str, Any]:
    payload = action["payload"]
    future_bill_link_id = int(payload["future_bill_link_id"])
    new_link_type = payload.get("new_link_type") or "Partial"
    prior = fetch_future_bill_link(cursor, future_bill_link_id)
    if not prior:
        raise ValueError(f"future_bill_link_id {future_bill_link_id} was not found")
    update_future_bill_link(cursor, future_bill_link_id, new_link_type, payload.get("notes"))
    insert_operator_log(
        cursor,
        action=action,
        previous_link_type=prior.get("link_type"),
        new_link_type=new_link_type,
        bundle_path=bundle_path,
        action_status="applied",
        action_reason="Approved review bundle partial conversion",
        tracked_bill_id=prior.get("tracked_bill_id"),
    )
    return base_result(
        action,
        "applied",
        {
            "future_bill_link_id": future_bill_link_id,
            "new_link_type": new_link_type,
            "change_summary": change_summary(
                future_bill_link_id=future_bill_link_id,
                future_bill_id=int(prior["future_bill_id"]),
                tracked_bill_id=prior.get("tracked_bill_id"),
                old_link_type=prior.get("link_type"),
                new_link_type=new_link_type,
                action=action,
            ),
        },
    )


def apply_convert_to_direct(cursor, action: dict[str, Any], bundle_path: Path) -> dict[str, Any]:
    payload = action["payload"]
    future_bill_link_id = int(payload["future_bill_link_id"])
    new_link_type = payload.get("new_link_type") or "Direct"
    prior = fetch_future_bill_link(cursor, future_bill_link_id)
    if not prior:
        raise ValueError(f"future_bill_link_id {future_bill_link_id} was not found")
    update_future_bill_link(cursor, future_bill_link_id, new_link_type, payload.get("notes"))
    insert_operator_log(
        cursor,
        action=action,
        previous_link_type=prior.get("link_type"),
        new_link_type=new_link_type,
        bundle_path=bundle_path,
        action_status="applied",
        action_reason="Approved review bundle direct conversion",
        tracked_bill_id=prior.get("tracked_bill_id"),
    )
    return base_result(
        action,
        "applied",
        {
            "future_bill_link_id": future_bill_link_id,
            "new_link_type": new_link_type,
            "change_summary": change_summary(
                future_bill_link_id=future_bill_link_id,
                future_bill_id=int(prior["future_bill_id"]),
                tracked_bill_id=prior.get("tracked_bill_id"),
                old_link_type=prior.get("link_type"),
                new_link_type=new_link_type,
                action=action,
            ),
        },
    )


def apply_create_partial_link(cursor, action: dict[str, Any], bundle_path: Path) -> dict[str, Any]:
    payload = action["payload"]
    future_bill_id = int(payload["future_bill_id"])
    tracked_bill_id = int(payload["tracked_bill_id"])
    existing = find_existing_link(cursor, future_bill_id, tracked_bill_id)
    if existing:
        update_future_bill_link(cursor, int(existing["id"]), "Partial", payload.get("notes"))
        insert_operator_log(
            cursor,
            action=action,
            previous_link_type=existing.get("link_type"),
            new_link_type="Partial",
            bundle_path=bundle_path,
            action_status="applied",
            action_reason="Approved review bundle partial link update",
            tracked_bill_id=tracked_bill_id,
        )
        return base_result(
            action,
            "applied",
            {
                "future_bill_link_id": int(existing["id"]),
                "new_link_type": "Partial",
                "mode": "updated_existing",
                "change_summary": change_summary(
                    future_bill_link_id=int(existing["id"]),
                    future_bill_id=future_bill_id,
                    tracked_bill_id=tracked_bill_id,
                    old_link_type=existing.get("link_type"),
                    new_link_type="Partial",
                    action=action,
                ),
            },
        )
    new_id = insert_partial_link(cursor, future_bill_id, tracked_bill_id, payload.get("notes"))
    insert_operator_log(
        cursor,
        action=action,
        previous_link_type=None,
        new_link_type="Partial",
        bundle_path=bundle_path,
        action_status="applied",
        action_reason="Approved review bundle partial link creation",
        tracked_bill_id=tracked_bill_id,
    )
    return base_result(
        action,
        "applied",
        {
            "future_bill_link_id": new_id,
            "new_link_type": "Partial",
            "mode": "inserted_new",
            "change_summary": change_summary(
                future_bill_link_id=new_id,
                future_bill_id=future_bill_id,
                tracked_bill_id=tracked_bill_id,
                old_link_type=None,
                new_link_type="Partial",
                action=action,
            ),
        },
    )


def dry_run_result(action: dict[str, Any]) -> dict[str, Any]:
    payload = action.get("payload") or {}
    action_type = action.get("action_type")
    future_bill_id = int(action.get("future_bill_id"))
    future_bill_link_id = payload.get("future_bill_link_id")
    tracked_bill_id = payload.get("tracked_bill_id")
    old_link_type = None
    new_link_type = None
    if action_type == "remove_direct_link":
        new_link_type = None
    elif action_type == "convert_to_direct":
        new_link_type = payload.get("new_link_type") or "Direct"
    elif action_type == "convert_to_partial":
        new_link_type = payload.get("new_link_type") or "Partial"
    elif action_type == "create_partial_link":
        new_link_type = "Partial"
    return base_result(
        action,
        "dry_run",
        {
            "message": f"Would apply {action_type}",
            "future_bill_link_id": future_bill_link_id,
            "new_link_type": new_link_type,
            "change_summary": change_summary(
                future_bill_link_id=future_bill_link_id,
                future_bill_id=future_bill_id,
                tracked_bill_id=tracked_bill_id,
                old_link_type=old_link_type,
                new_link_type=new_link_type,
                action=action,
            ) if action_type in {"remove_direct_link", "convert_to_direct", "convert_to_partial", "create_partial_link"} else None,
        },
    )


def csv_row(category: str, item: dict[str, Any]) -> dict[str, Any]:
    change = item.get("change_summary") or {}
    return {
        "category": category,
        "action_id": item.get("action_id"),
        "action_type": item.get("action_type"),
        "future_bill_id": item.get("future_bill_id"),
        "future_bill_link_id": item.get("future_bill_link_id") or change.get("future_bill_link_id"),
        "tracked_bill_id": change.get("tracked_bill_id"),
        "result": item.get("result"),
        "message": item.get("message"),
        "reason": item.get("reason"),
        "error": item.get("error"),
        "new_link_type": item.get("new_link_type") or change.get("new_link_type"),
        "old_link_type": change.get("old_link_type"),
        "timestamp": item.get("timestamp"),
    }


def record_db_action_result(
    action: dict[str, Any],
    result: dict[str, Any],
    *,
    applied_actions: list[dict[str, Any]],
    skipped_actions: list[dict[str, Any]],
    created_links: list[dict[str, Any]],
    updated_links: list[dict[str, Any]],
    deleted_links: list[dict[str, Any]],
) -> None:
    if result.get("result") == "applied":
        applied_actions.append(result)
        change_summary_payload = result.get("change_summary")
        if not change_summary_payload:
            return
        if action["action_type"] == "create_partial_link":
            if result.get("mode") == "updated_existing":
                updated_links.append(change_summary_payload)
            else:
                created_links.append(change_summary_payload)
        elif action["action_type"] in {"convert_to_direct", "convert_to_partial"}:
            updated_links.append(change_summary_payload)
        elif action["action_type"] == "remove_direct_link":
            deleted_links.append(change_summary_payload)
        return

    skipped_actions.append(result)


def main() -> None:
    args = parse_args()
    input_path = args.input.resolve()
    output_path = args.output.resolve()
    csv_path = derive_csv_path(args.csv, output_path)
    dry_run = not args.apply

    if args.apply and not args.yes:
        raise SystemExit("--apply requires --yes")

    bundle = load_bundle(input_path)
    all_actions = flatten_operator_actions(bundle)
    selected_actions = select_actions(all_actions, set(args.only_future_bill_id or []))
    approved_actions = [action for action in selected_actions if is_approved_pending(action)]

    print("EquityStack Review Bundle Apply")
    print(f"Total actions found: {len(selected_actions)}")
    print(f"Total approved actions: {len(approved_actions)}")

    applied_actions: list[dict[str, Any]] = []
    skipped_actions: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    approved_seed_rows: list[dict[str, Any]] = []
    created_links: list[dict[str, Any]] = []
    updated_links: list[dict[str, Any]] = []
    deleted_links: list[dict[str, Any]] = []

    for action in selected_actions:
        if not is_approved_pending(action):
            skipped_actions.append(
                base_result(
                    action,
                    "skipped",
                    {"reason": "Action is not both approved=true and status=pending"},
                )
            )

    db_action_types = {"remove_direct_link", "convert_to_direct", "convert_to_partial", "create_partial_link"}
    approved_db_actions = [action for action in approved_actions if action.get("action_type") in db_action_types]
    approved_seed_actions = [action for action in approved_actions if action.get("action_type") == "import_candidate_seed"]

    if dry_run:
        for action in approved_actions:
            is_valid, error = validate_payload(action)
            if not is_valid:
                errors.append(base_result(action, "error", {"error": error}))
                continue
            if action["action_type"] == "import_candidate_seed":
                approved_seed_rows.append(approved_seed_row(action))
            result = dry_run_result(action)
            applied_actions.append(result)
            if result.get("change_summary"):
                if action["action_type"] == "create_partial_link":
                    created_links.append(result["change_summary"])
                elif action["action_type"] in {"convert_to_direct", "convert_to_partial"}:
                    updated_links.append(result["change_summary"])
                elif action["action_type"] == "remove_direct_link":
                    deleted_links.append(result["change_summary"])
    else:
        if approved_db_actions:
            conn = get_db_connection()
            try:
                with conn.cursor() as cursor:
                    ensure_operator_table(cursor)
                    for action in approved_db_actions:
                        is_valid, error = validate_payload(action)
                        if not is_valid:
                            errors.append(base_result(action, "error", {"error": error}))
                            continue

                        try:
                            if action["action_type"] == "remove_direct_link":
                                result = apply_remove_direct_link(cursor, action, input_path)
                                record_db_action_result(
                                    action,
                                    result,
                                    applied_actions=applied_actions,
                                    skipped_actions=skipped_actions,
                                    created_links=created_links,
                                    updated_links=updated_links,
                                    deleted_links=deleted_links,
                                )
                            elif action["action_type"] == "convert_to_direct":
                                result = apply_convert_to_direct(cursor, action, input_path)
                                record_db_action_result(
                                    action,
                                    result,
                                    applied_actions=applied_actions,
                                    skipped_actions=skipped_actions,
                                    created_links=created_links,
                                    updated_links=updated_links,
                                    deleted_links=deleted_links,
                                )
                            elif action["action_type"] == "convert_to_partial":
                                result = apply_convert_to_partial(cursor, action, input_path)
                                record_db_action_result(
                                    action,
                                    result,
                                    applied_actions=applied_actions,
                                    skipped_actions=skipped_actions,
                                    created_links=created_links,
                                    updated_links=updated_links,
                                    deleted_links=deleted_links,
                                )
                            elif action["action_type"] == "create_partial_link":
                                result = apply_create_partial_link(cursor, action, input_path)
                                record_db_action_result(
                                    action,
                                    result,
                                    applied_actions=applied_actions,
                                    skipped_actions=skipped_actions,
                                    created_links=created_links,
                                    updated_links=updated_links,
                                    deleted_links=deleted_links,
                                )
                            else:
                                errors.append(base_result(action, "error", {"error": f"Unsupported action_type: {action['action_type']}"}))
                        except Exception as error_obj:
                            conn.rollback()
                            errors.append(base_result(action, "error", {"error": str(error_obj)}))
                            break
                    else:
                        conn.commit()
            finally:
                conn.close()

        for action in approved_seed_actions:
            is_valid, error = validate_payload(action)
            if not is_valid:
                errors.append(base_result(action, "error", {"error": error}))
                continue
            approved_seed_rows.append(approved_seed_row(action))
            applied_actions.append(base_result(action, "applied", {"message": "Approved seed row written for later import"}))

    if approved_seed_rows:
        default_seed_output_path().write_text(json.dumps(approved_seed_rows, indent=2, default=str))

    affected_future_bill_ids = sorted(
        {
            int(row["future_bill_id"])
            for row in [*created_links, *updated_links, *deleted_links]
            if row.get("future_bill_id") is not None
        }
        | {
            int(action["future_bill_id"])
            for action in applied_actions
            if action.get("future_bill_id") is not None
        }
    )
    affected_future_bill_link_ids = sorted(
        {
            int(row["future_bill_link_id"])
            for row in [*created_links, *updated_links, *deleted_links]
            if row.get("future_bill_link_id") is not None
        }
    )
    impact_pending_seed_rows = [
        row
        for row in approved_seed_rows
        if str(row.get("impact_status") or "").strip().lower() == "impact_pending"
    ]
    import_with_pending_impact_seed_rows = [
        row
        for row in impact_pending_seed_rows
        if str(row.get("recommended_action") or "").strip().lower() == "import_with_pending_impact"
    ]

    report = {
        "generated_at": datetime.now(UTC).isoformat(),
        "mode": "dry_run" if dry_run else "apply",
        "input_bundle": str(input_path),
        "affected_future_bill_ids": affected_future_bill_ids,
        "affected_future_bill_link_ids": affected_future_bill_link_ids,
        "created_links": created_links,
        "updated_links": updated_links,
        "deleted_links": deleted_links,
        "applied_actions": applied_actions,
        "skipped_actions": skipped_actions,
        "errors": errors,
        "impact_pending_seed_rows": len(impact_pending_seed_rows),
        "import_with_pending_impact_seed_rows": len(import_with_pending_impact_seed_rows),
        "impact_pending_note": (
            "Impact-pending legislative seed rows remain importable as tracked-bill metadata; "
            "impact scoring is deferred to the import/scoring path."
        ),
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2, default=str))

    if csv_path:
        rows = (
            [csv_row("applied", item) for item in applied_actions]
            + [csv_row("skipped", item) for item in skipped_actions]
            + [csv_row("error", item) for item in errors]
        )
        write_csv_rows(csv_path, rows)

    if not dry_run and applied_actions:
        applied_ids = {str(item.get("action_id")) for item in applied_actions if item.get("action_id")}
        append_feedback_entries([feedback_entry(action, "approved") for action in approved_actions if str(action.get("action_id")) in applied_ids])

    print(f"Total applied: {len(applied_actions)}")
    print(f"Total skipped: {len(skipped_actions)}")
    print(f"Total errors: {len(errors)}")
    print(f"Impact-pending seed rows: {len(impact_pending_seed_rows)}")
    print(f"Import-with-pending-impact seed rows: {len(import_with_pending_impact_seed_rows)}")
    print(f"Wrote apply report to {output_path}")
    if csv_path:
        print(f"Wrote CSV summary to {csv_path}")

    if errors and not dry_run:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
