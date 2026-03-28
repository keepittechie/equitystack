#!/usr/bin/env python3
import argparse
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from current_admin_common import (
    derive_csv_path,
    load_json_file,
    print_json,
    resolve_default_report_path,
    write_csv_rows,
    write_json_file,
)


APPROVAL_ACTIONS = {"approve_as_is", "approve_with_changes"}
NON_READY_ACTIONS = {
    "manual_review_required",
    "needs_more_sources",
    "defer",
    "reject",
    "escalate",
}
VALID_OPERATOR_ACTIONS = APPROVAL_ACTIONS | NON_READY_ACTIONS

READINESS_FORMULA = {
    "ready": "No blocking issues were found for approved queue items.",
    "ready_with_warnings": "Approved items are importable, but warning signals still merit operator review before import.",
    "blocked": "At least one approved item is missing decision coverage or still has a non-import-ready operator action.",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a read-only pre-commit review artifact for a current-administration import."
    )
    parser.add_argument(
        "--input",
        type=Path,
        required=True,
        help="Required. Manual review queue JSON used as the import candidate source.",
    )
    parser.add_argument(
        "--decision-log",
        type=Path,
        help="Optional. Explicit decision log JSON. Defaults to the latest matching reports/current_admin/review_decisions/*.decision-log.json for the batch.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Optional. Pre-commit review JSON output path. Defaults to reports/current_admin/<batch>.pre-commit-review.json.",
    )
    parser.add_argument(
        "--csv",
        nargs="?",
        const="",
        help="Optional. Write a CSV summary alongside the JSON artifact.",
    )
    return parser.parse_args()


def resolve_default_decision_log(queue_path: Path, batch_name: str) -> Path | None:
    reports_dir = queue_path.parent
    decision_dir = reports_dir / "review_decisions"
    candidates = sorted(
        decision_dir.glob(f"{batch_name}*.decision-log.json"),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    return candidates[0] if candidates else None


def load_queue(path: Path) -> dict[str, Any]:
    payload = load_json_file(path)
    if not isinstance(payload, dict):
        raise ValueError("Queue input must be a JSON object.")
    items = payload.get("items")
    if not isinstance(items, list):
        raise ValueError(
            "Queue input is missing an items array. Use the canonical .manual-review-queue.json artifact."
        )
    return payload


def load_decision_log(path: Path | None) -> tuple[dict[str, dict[str, Any]], Path | None]:
    if path is None:
        return {}, None
    payload = load_json_file(path)
    if not isinstance(payload, dict):
        raise ValueError("Decision log must be a JSON object.")
    items = payload.get("items")
    if not isinstance(items, list):
        raise ValueError("Decision log is missing an items array.")
    return {
        str(item.get("slug")): item
        for item in items
        if isinstance(item, dict) and item.get("slug")
    }, path


def read_batch_name_from_review_path(path: str | None) -> str | None:
    if not isinstance(path, str) or not path.strip():
        return None
    name = Path(path).name
    if not name.endswith(".ai-review.json"):
        return None
    return name.removesuffix(".ai-review.json")


def normalize_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def summarize_item(queue_item: dict[str, Any], decision_item: dict[str, Any] | None) -> dict[str, Any]:
    ai_review = queue_item.get("ai_review") or {}
    suggestions = ai_review.get("suggestions") or {}
    slug = queue_item.get("slug")
    title = (
        queue_item.get("final_record", {}).get("title")
        or queue_item.get("original_record", {}).get("title")
        or ai_review.get("title")
    )
    selected_for_import = bool(queue_item.get("approved") or queue_item.get("operator_status") == "approved")
    source_warnings = sorted(
        set(
            normalize_list(suggestions.get("source_warnings"))
            + normalize_list(suggestions.get("missing_source_warnings"))
        )
    )
    evidence_gaps = normalize_list(suggestions.get("evidence_needed_to_reduce_risk"))
    operator_action = decision_item.get("operator_action") if decision_item else None
    decision_alignment = decision_item.get("decision_alignment") if decision_item else None
    operator_action_valid = operator_action in VALID_OPERATOR_ACTIONS if operator_action else False

    blockers: list[str] = []
    warnings: list[str] = []

    if selected_for_import:
        if not isinstance(queue_item.get("final_record"), dict):
            blockers.append("missing_final_record")
        if decision_item is None:
            blockers.append("missing_decision_coverage")
        elif not operator_action_valid:
            blockers.append("invalid_operator_action")
        elif operator_action not in APPROVAL_ACTIONS:
            blockers.append("operator_action_not_import_ready")

    if ai_review.get("has_material_conflict"):
        warnings.append("material_conflict_present")
    if source_warnings or evidence_gaps:
        warnings.append("source_or_evidence_gaps")
    if ai_review.get("review_priority") == "high" or ai_review.get("suggested_batch") == "high_attention":
        warnings.append("high_attention_item")
    confidence_score = suggestions.get("confidence_score")
    if isinstance(confidence_score, (float, int)) and confidence_score < 0.55:
        warnings.append("low_confidence")
    if ai_review.get("deep_review_recommended"):
        warnings.append("deep_review_recommended")
    if decision_alignment == "mismatch":
        warnings.append("decision_mismatch")

    if not selected_for_import:
        readiness = "not_selected"
    elif blockers:
        readiness = "blocked"
    elif warnings:
        readiness = "ready_with_warnings"
    else:
        readiness = "ready"

    return {
        "slug": slug,
        "title": title,
        "selected_for_import": selected_for_import,
        "operator_status": queue_item.get("operator_status"),
        "approved": bool(queue_item.get("approved")),
        "operator_action": operator_action,
        "operator_action_valid": operator_action_valid if operator_action else None,
        "decision_alignment": decision_alignment,
        "review_priority": ai_review.get("review_priority"),
        "review_priority_score": ai_review.get("review_priority_score"),
        "suggested_batch": ai_review.get("suggested_batch"),
        "has_material_conflict": bool(ai_review.get("has_material_conflict")),
        "source_warnings": source_warnings,
        "evidence_gap_count": len(evidence_gaps),
        "confidence_level": suggestions.get("confidence_level"),
        "confidence_score": confidence_score,
        "import_readiness": readiness,
        "blocking_issues": blockers,
        "warning_signals": warnings,
    }


def determine_overall_readiness(items: list[dict[str, Any]]) -> tuple[str, list[str], dict[str, int], str]:
    selected = [item for item in items if item["selected_for_import"]]
    missing_decision_coverage = any("missing_decision_coverage" in item["blocking_issues"] for item in selected)
    invalid_operator_action = any("invalid_operator_action" in item["blocking_issues"] for item in selected)
    operator_action_not_import_ready = any("operator_action_not_import_ready" in item["blocking_issues"] for item in selected)
    missing_final_record = any("missing_final_record" in item["blocking_issues"] for item in selected)
    warning_counts = {
        "material_conflict_present": sum("material_conflict_present" in item["warning_signals"] for item in selected),
        "source_or_evidence_gaps": sum("source_or_evidence_gaps" in item["warning_signals"] for item in selected),
        "high_attention_item": sum("high_attention_item" in item["warning_signals"] for item in selected),
        "low_confidence": sum("low_confidence" in item["warning_signals"] for item in selected),
        "deep_review_recommended": sum("deep_review_recommended" in item["warning_signals"] for item in selected),
        "decision_mismatch": sum("decision_mismatch" in item["warning_signals"] for item in selected),
    }

    blocking_issues: list[str] = []
    if not selected:
        blocking_issues.append("No queue items are currently approved for import.")
    if missing_decision_coverage:
        blocking_issues.append(
            "Some approved items do not have decision-log coverage. Run workflow finalize against the matching review artifact before import."
        )
    if invalid_operator_action:
        blocking_issues.append(
            "Some approved items have invalid operator_action values in the decision log. Regenerate the decision template or correct the decision file, then rerun workflow finalize."
        )
    if operator_action_not_import_ready:
        blocking_issues.append(
            "Some approved items still carry a non-import-ready operator action such as manual_review_required or needs_more_sources."
        )
    if missing_final_record:
        blocking_issues.append(
            "Some approved queue items are missing final_record payloads. Rebuild the manual review queue before import."
        )

    if blocking_issues:
        readiness = "blocked"
        if not selected:
            next_step = "Approve the intended queue items or keep them pending, then rerun pre-commit review."
        elif missing_decision_coverage or invalid_operator_action:
            next_step = "Regenerate or correct the decision file, rerun workflow finalize, then rerun pre-commit review."
        elif operator_action_not_import_ready:
            next_step = "Resolve the non-import-ready operator actions in the decision file or queue, then rerun pre-commit review."
        elif missing_final_record:
            next_step = "Rebuild or repair the manual review queue so approved items have final_record payloads, then rerun pre-commit review."
        else:
            next_step = "Resolve the blocking issues, then rerun pre-commit review."
    elif any(count > 0 for count in warning_counts.values()):
        readiness = "ready_with_warnings"
        next_step = "Review the warnings, then run a dry-run import if the queue still looks correct."
    else:
        readiness = "ready"
        next_step = "Run a dry-run import, then apply only after reviewing the import report."

    return readiness, blocking_issues, warning_counts, next_step


def main() -> None:
    args = parse_args()
    queue_path = args.input.resolve()
    queue_payload = load_queue(queue_path)
    batch_name = queue_payload.get("batch_name")
    if not isinstance(batch_name, str) or not batch_name.strip():
        raise ValueError("Queue input is missing batch_name.")
    source_review_path = queue_payload.get("source_review_path")
    source_review_batch = read_batch_name_from_review_path(source_review_path)

    decision_log_path = args.decision_log.resolve() if args.decision_log else resolve_default_decision_log(queue_path, batch_name)
    decisions_by_slug, resolved_decision_log = load_decision_log(decision_log_path)
    decision_log_source_review = None
    decision_log_source_batch = None
    if resolved_decision_log is not None:
        decision_payload = load_json_file(resolved_decision_log)
        if not isinstance(decision_payload, dict):
            raise ValueError("Decision log must be a JSON object.")
        decision_log_source_review = decision_payload.get("source_review_file")
        decision_log_source_batch = read_batch_name_from_review_path(decision_log_source_review)

    items = [
        summarize_item(queue_item, decisions_by_slug.get(queue_item.get("slug")))
        for queue_item in queue_payload.get("items") or []
        if isinstance(queue_item, dict)
    ]
    readiness, blocking_issues, warning_counts, next_step = determine_overall_readiness(items)
    selected = [item for item in items if item["selected_for_import"]]
    linkage_warnings: list[str] = []
    linkage_blockers: list[str] = []

    if not isinstance(source_review_path, str) or not source_review_path.strip():
        linkage_blockers.append(
            "Queue artifact is missing source_review_path. Rebuild the manual review queue from the canonical AI review artifact before import."
        )
    elif source_review_batch and source_review_batch != batch_name:
        linkage_blockers.append(
            "Queue source_review_path does not match the queue batch_name. Rebuild the manual review queue before import."
        )

    if resolved_decision_log is not None and not decision_log_source_review:
        linkage_warnings.append(
            "Decision log is missing source_review_file metadata. The log is still readable, but lineage is weaker than expected."
        )
    if resolved_decision_log is not None and decision_log_source_batch and decision_log_source_batch != batch_name:
        linkage_blockers.append(
            "Decision log source_review_file does not match the queue batch_name. Run workflow finalize against the matching review artifact before import."
        )

    if linkage_blockers:
        blocking_issues.extend(linkage_blockers)
        readiness = "blocked"
        next_step = "Resolve the blocking issues, then rerun pre-commit review."

    payload = {
        "batch_name": batch_name,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_queue_file": str(queue_path),
        "source_review_file": source_review_path,
        "source_decision_log": str(resolved_decision_log) if resolved_decision_log else None,
        "decision_log_source_review_file": decision_log_source_review,
        "decision_log_resolution": (
            "explicit"
            if args.decision_log
            else "auto"
            if resolved_decision_log
            else "none"
        ),
        "artifact_linkage": {
            "queue_to_review": "ok"
            if isinstance(source_review_path, str) and source_review_path.strip() and source_review_batch == batch_name
            else "missing_or_mismatched",
            "decision_log_to_review": "ok"
            if resolved_decision_log is not None and decision_log_source_batch == batch_name
            else "missing"
            if resolved_decision_log is None
            else "missing_or_mismatched",
        },
        "total_item_count": len(items),
        "selected_for_import_count": len(selected),
        "decision_covered_count": sum(1 for item in selected if item["operator_action"]),
        "decision_missing_count": sum(1 for item in selected if not item["operator_action"]),
        "invalid_operator_action_count": sum(
            1 for item in selected if item["operator_action"] and item["operator_action_valid"] is False
        ),
        "unresolved_manual_review_count": sum(
            1 for item in selected if item["operator_action"] in NON_READY_ACTIONS
        ),
        "material_conflict_count": warning_counts["material_conflict_present"],
        "source_gap_count": warning_counts["source_or_evidence_gaps"],
        "high_attention_count": warning_counts["high_attention_item"],
        "readiness_status": readiness,
        "readiness_formula": READINESS_FORMULA,
        "warning_counts": warning_counts,
        "blocking_issues": blocking_issues,
        "linkage_warnings": linkage_warnings,
        "recommended_next_step": next_step,
        "items": items,
    }

    output_path = args.output or resolve_default_report_path(batch_name, "pre-commit-review")
    write_json_file(output_path, payload)

    csv_path = derive_csv_path(args.csv, output_path)
    if csv_path:
        write_csv_rows(csv_path, items)

    print_json(
        {
            "batch_name": batch_name,
            "pre_commit_output_path": str(output_path),
            "readiness_status": readiness,
            "selected_for_import_count": len(selected),
            "blocking_issue_count": len(blocking_issues),
            "invalid_operator_action_count": payload["invalid_operator_action_count"],
            "warning_counts": warning_counts,
            "recommended_next_step": next_step,
        }
    )


if __name__ == "__main__":
    try:
        main()
    except (FileNotFoundError, ValueError) as exc:
        raise SystemExit(str(exc)) from exc
