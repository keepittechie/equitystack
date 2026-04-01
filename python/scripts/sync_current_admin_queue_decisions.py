#!/usr/bin/env python3
import argparse
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from current_admin_common import load_json_file, print_json, write_json_file


APPROVAL_ACTIONS = {"approve_as_is", "approve_with_changes"}
NON_READY_ACTIONS = {
    "manual_review_required",
    "needs_more_sources",
    "defer",
    "reject",
    "escalate",
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


def derive_queue_status(operator_action: str) -> tuple[bool, str]:
    if operator_action in APPROVAL_ACTIONS:
        return True, "approved"
    if operator_action in NON_READY_ACTIONS:
        return False, "pending_manual_review"
    return False, "pending"


def main() -> None:
    args = parse_args()
    if not args.decision_log and not args.decision_file:
        raise SystemExit("Provide --decision-log or --decision-file so queue sync has a canonical decision source.")

    queue_path = args.queue.resolve()
    queue_payload = load_items_payload(queue_path, "Queue artifact")

    decision_source_path = (args.decision_log or args.decision_file).resolve()
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

    for item in items:
        if not isinstance(item, dict):
            continue
        slug = normalize_text(item.get("slug"))
        decision = decisions_by_slug.get(slug)
        operator_action = normalize_text(decision.get("operator_action")) if decision else ""
        approved, operator_status = derive_queue_status(operator_action)
        item["approved"] = approved
        item["operator_status"] = operator_status
        if decision:
            item["operator_notes"] = decision.get("operator_notes") or item.get("operator_notes")
            item["decision_alignment"] = decision.get("decision_alignment")
            item["operator_action"] = operator_action or None
            item["final_decision_summary"] = decision.get("final_decision_summary")
            item["decision_timestamp"] = decision.get("timestamp")
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
    }

    write_json_file(queue_path, queue_payload)

    print_json(
        {
            "queue_path": str(queue_path),
            "decision_source_path": str(decision_source_path),
            "approved_for_import_count": approved_count,
            "pending_manual_review_count": manual_review_count,
            "pending_count": pending_count,
            "item_count": len(items),
        }
    )


if __name__ == "__main__":
    main()
