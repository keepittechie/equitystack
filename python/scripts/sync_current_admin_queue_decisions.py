#!/usr/bin/env python3
import argparse
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from current_admin_common import (
    decision_available_operator_actions,
    has_structured_edit_payload,
    load_json_file,
    normalize_nullable_text,
    operator_action_keeps_active_manual_review,
    print_json,
    write_json_file,
)


APPROVAL_ACTIONS = {"approve_as_is", "approve_with_changes"}
NON_READY_ACTIONS = {"manual_review_required", "needs_more_sources", "defer", "reject", "escalate"}
FOLLOW_UP_ACTIONS = {
    "needs_more_sources": {
        "operator_status": "needs_more_sources",
        "follow_up_action": "evidence_refresh",
        "follow_up_status": "queued",
        "follow_up_reason": "Operator requested stronger evidence before any further decision.",
    },
    "defer": {
        "operator_status": "deferred",
        "follow_up_action": "park_for_later",
        "follow_up_status": "parked",
        "follow_up_reason": "Operator parked this row so it stops surfacing as active review noise.",
    },
    "reject": {
        "operator_status": "rejected",
        "follow_up_action": "closed",
        "follow_up_status": "resolved",
        "follow_up_reason": "Operator rejected this discovered update from the active import/review path.",
    },
    "escalate": {
        "operator_status": "escalated",
        "follow_up_action": "deep_review",
        "follow_up_status": "queued",
        "follow_up_reason": "Operator requested a deeper paired AI review before any future decision.",
    },
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sync manual-review queue approval fields from current-admin operator decisions."
    )
    parser.add_argument("--queue", type=Path, required=True, help="Manual review queue JSON path.")
    parser.add_argument(
        "--decision-file",
        type=Path,
        help="Optional decision template JSON path used when no decision log is supplied.",
    )
    parser.add_argument(
        "--decision-log",
        type=Path,
        help="Optional canonical decision log JSON path. Preferred when available.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print the sync summary as JSON.",
    )
    return parser.parse_args()


def normalize_text(value: Any) -> str:
    return str(value or "").strip()


def load_items_payload(path: Path, label: str) -> dict[str, Any]:
    payload = load_json_file(path)
    if not isinstance(payload, dict):
        raise ValueError(f"{label} must be a JSON object.")
    items = payload.get("items")
    if not isinstance(items, list):
        raise ValueError(f"{label} is missing an items array.")
    return payload


def build_decision_map(payload: dict[str, Any]) -> dict[str, dict[str, Any]]:
    decisions: dict[str, dict[str, Any]] = {}
    for item in payload.get("items") or []:
        if not isinstance(item, dict):
            continue
        slug = normalize_text(item.get("slug"))
        if not slug:
            continue
        decisions[slug] = item
    return decisions


def repo_relative(path: Path) -> str:
    python_dir = Path(__file__).resolve().parents[1]
    repo_root = python_dir.parent
    for base in (repo_root, python_dir):
        try:
            return str(path.relative_to(base))
        except ValueError:
            continue
    return str(path)


def build_follow_up_command(
    *,
    operator_action: str,
    normalized_path: Path | None,
    review_path: Path | None,
    decision_file_path: Path | None,
    decision_source_path: Path,
    slug: str,
) -> str | None:
    if operator_action == "needs_more_sources" and normalized_path:
        return (
            f"./bin/equitystack current-admin outcome-evidence --input {repo_relative(normalized_path)} "
            f"--include-all-statuses --only-record-key {slug}"
        )
    if operator_action == "escalate" and normalized_path:
        return (
            f"./bin/equitystack current-admin deep-review --input {repo_relative(normalized_path)} "
            f"--only-slug {slug} --experiment-name operator-escalation"
        )
    if operator_action == "defer" and review_path:
        decision_path = decision_file_path or decision_source_path
        return (
            f"./bin/equitystack current-admin review --input {repo_relative(review_path)} "
            f"--decision-file {repo_relative(decision_path)}"
        )
    return None


def derive_queue_state(operator_action: str) -> tuple[bool, str, str | None, str | None, str | None]:
    if operator_action in APPROVAL_ACTIONS:
        return True, "approved", None, None, None
    follow_up = FOLLOW_UP_ACTIONS.get(operator_action)
    if follow_up:
        return (
            False,
            str(follow_up["operator_status"]),
            str(follow_up["follow_up_action"]),
            str(follow_up["follow_up_status"]),
            str(follow_up["follow_up_reason"]),
        )
    if operator_action in NON_READY_ACTIONS:
        return False, "pending_manual_review", None, None, None
    return False, "pending", None, None, None


def main() -> None:
    args = parse_args()
    if not args.decision_log and not args.decision_file:
        raise SystemExit("Provide --decision-log or --decision-file so queue sync has a canonical decision source.")

    queue_path = args.queue.resolve()
    queue_payload = load_items_payload(queue_path, "Queue artifact")

    decision_source_path = (args.decision_log or args.decision_file).resolve()
    decision_file_path = args.decision_file.resolve() if args.decision_file else None
    decision_payload = load_items_payload(
        decision_source_path,
        "Decision source",
    )
    decisions_by_slug = build_decision_map(decision_payload)

    source_review_file = normalize_text(queue_payload.get("source_review_path"))
    decision_source_review = normalize_text(decision_payload.get("source_review_file"))
    if source_review_file and decision_source_review and source_review_file != decision_source_review:
        raise SystemExit(
            "Queue source_review_path does not match the decision source review artifact."
        )

    items = queue_payload.get("items") or []
    approved_count = 0
    manual_review_count = 0
    pending_count = 0
    status_counts: dict[str, int] = {}
    follow_up_counts: dict[str, int] = {}
    normalized_path = Path(normalize_nullable_text(queue_payload.get("source_batch_path")) or "").resolve() if normalize_nullable_text(queue_payload.get("source_batch_path")) else None
    review_path = Path(normalize_nullable_text(queue_payload.get("source_review_path")) or "").resolve() if normalize_nullable_text(queue_payload.get("source_review_path")) else None

    for item in items:
        if not isinstance(item, dict):
            continue
        slug = normalize_text(item.get("slug"))
        decision = decisions_by_slug.get(slug)
        operator_action = normalize_text(decision.get("operator_action")) if decision else ""
        approved, operator_status, follow_up_action, follow_up_status, follow_up_reason = derive_queue_state(
            operator_action
        )
        item["approved"] = approved
        item["operator_status"] = operator_status
        if decision:
            item["operator_notes"] = decision.get("operator_notes") or item.get("operator_notes")
            item["decision_alignment"] = decision.get("decision_alignment")
            item["operator_action"] = operator_action or None
            item["final_decision_summary"] = decision.get("final_decision_summary")
            item["decision_timestamp"] = decision.get("timestamp")
            if has_structured_edit_payload(decision):
                item["structured_edit_payload"] = decision.get("structured_edit_payload")
        item["has_structured_edit_payload"] = has_structured_edit_payload(decision or item)
        item["available_operator_actions"] = decision_available_operator_actions(decision or item)
        item["active_review"] = operator_action_keeps_active_manual_review(operator_action)
        item["suppressed_from_active_review"] = not item["active_review"]
        item["follow_up_action"] = follow_up_action
        item["follow_up_status"] = follow_up_status
        item["follow_up_reason"] = follow_up_reason
        item["recommended_follow_up_command"] = build_follow_up_command(
            operator_action=operator_action,
            normalized_path=normalized_path,
            review_path=review_path,
            decision_file_path=decision_file_path,
            decision_source_path=decision_source_path,
            slug=slug,
        )
        status_counts[operator_status] = int(status_counts.get(operator_status) or 0) + 1
        if follow_up_action:
            follow_up_counts[follow_up_action] = int(follow_up_counts.get(follow_up_action) or 0) + 1
        if approved:
            approved_count += 1
        elif operator_status == "pending_manual_review":
            manual_review_count += 1
        else:
            pending_count += 1

    queue_payload["approval_sync"] = {
        "synchronized_at": datetime.now(UTC).isoformat(),
        "decision_source_path": str(decision_source_path),
        "decision_source_kind": "decision_log" if args.decision_log else "decision_file",
        "approved_for_import_count": approved_count,
        "pending_manual_review_count": manual_review_count,
        "pending_count": pending_count,
        "operator_status_counts": status_counts,
        "follow_up_counts": follow_up_counts,
    }

    write_json_file(queue_path, queue_payload)

    print_json(
        {
            "queue_path": str(queue_path),
            "decision_source_path": str(decision_source_path),
            "approved_for_import_count": approved_count,
            "pending_manual_review_count": manual_review_count,
            "pending_count": pending_count,
            "operator_status_counts": status_counts,
            "follow_up_counts": follow_up_counts,
            "item_count": len(items),
        }
    )


if __name__ == "__main__":
    main()
