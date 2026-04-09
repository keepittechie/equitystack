#!/usr/bin/env python3
import argparse
import copy
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from apply_future_bill_ai_review import get_db_connection


REPAIRED_BY = "equitystack_bundle_repair"


def python_dir() -> Path:
    return Path(__file__).resolve().parents[1]


def reports_dir() -> Path:
    return python_dir() / "reports"


def default_bundle_path() -> Path:
    return reports_dir() / "equitystack_review_bundle.json"


def default_manual_queue_path() -> Path:
    return reports_dir() / "future_bill_link_manual_review_queue.json"


def default_output_path() -> Path:
    return reports_dir() / "equitystack_bundle_repair_report.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Repair stale legislative review-bundle and manual-review-queue state against current DB reality."
    )
    parser.add_argument("--input", type=Path, default=default_bundle_path(), help="Canonical review bundle JSON path.")
    parser.add_argument(
        "--manual-queue",
        type=Path,
        default=default_manual_queue_path(),
        help="Canonical manual review queue JSON path.",
    )
    parser.add_argument("--output", type=Path, default=default_output_path(), help="Repair report JSON path.")
    parser.add_argument("--dry-run", action="store_true", help="Preview repairs without rewriting artifacts.")
    parser.add_argument("--apply", action="store_true", help="Rewrite canonical artifacts with repaired state.")
    parser.add_argument("--yes", action="store_true", help="Required confirmation bypass for --apply mode.")
    return parser.parse_args()


def load_required_json(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text())
    if not isinstance(payload, dict):
        raise ValueError(f"Expected JSON object at {path}")
    return payload


def load_optional_json(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    payload = json.loads(path.read_text())
    return payload if isinstance(payload, dict) else None


def normalize_int(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def is_actionable(action: dict[str, Any]) -> bool:
    return str(action.get("status") or "").lower() == "pending" and str(action.get("review_state") or "actionable").lower() == "actionable"


def actionable_manual_item(item: dict[str, Any]) -> bool:
    review_state = str(item.get("review_state") or "actionable").lower()
    return review_state == "actionable"


def fetch_existing_ids(cursor, table_name: str, ids: set[int]) -> set[int]:
    if not ids:
        return set()
    placeholders = ",".join(["%s"] * len(ids))
    cursor.execute(
        f"SELECT id FROM {table_name} WHERE id IN ({placeholders})",
        tuple(sorted(ids)),
    )
    return {int(row["id"]) for row in cursor.fetchall()}


def fetch_future_bill_links(cursor, link_ids: set[int], future_bill_ids: set[int]) -> list[dict[str, Any]]:
    if not link_ids and not future_bill_ids:
        return []
    clauses = []
    params: list[int] = []
    if link_ids:
        clauses.append(f"id IN ({','.join(['%s'] * len(link_ids))})")
        params.extend(sorted(link_ids))
    if future_bill_ids:
        clauses.append(f"future_bill_id IN ({','.join(['%s'] * len(future_bill_ids))})")
        params.extend(sorted(future_bill_ids))
    cursor.execute(
        f"""
        SELECT id, future_bill_id, tracked_bill_id, link_type, notes, created_at
        FROM future_bill_links
        WHERE {' OR '.join(clauses)}
        """,
        tuple(params),
    )
    return list(cursor.fetchall())


def fetch_live_state(bundle: dict[str, Any], manual_queue: dict[str, Any] | None) -> dict[str, Any]:
    future_bill_ids: set[int] = set()
    tracked_bill_ids: set[int] = set()
    future_bill_link_ids: set[int] = set()

    for group in bundle.get("future_bill_groups") or []:
        future_bill_id = normalize_int(group.get("future_bill_id"))
        if future_bill_id is not None:
            future_bill_ids.add(future_bill_id)
        for action in group.get("operator_actions") or []:
            payload = action.get("payload") or {}
            for value in (
                group.get("future_bill_id"),
                action.get("future_bill_id"),
                payload.get("future_bill_id"),
            ):
                normalized = normalize_int(value)
                if normalized is not None:
                    future_bill_ids.add(normalized)
            for value in (
                action.get("current_tracked_bill_id"),
                action.get("candidate_tracked_bill_id"),
                payload.get("tracked_bill_id"),
            ):
                normalized = normalize_int(value)
                if normalized is not None:
                    tracked_bill_ids.add(normalized)
            for value in (
                action.get("future_bill_link_id"),
                payload.get("future_bill_link_id"),
                action.get("target_id"),
            ):
                normalized = normalize_int(value)
                if normalized is not None:
                    future_bill_link_ids.add(normalized)

    for item in (manual_queue or {}).get("items") or []:
        for value in (item.get("future_bill_id"),):
            normalized = normalize_int(value)
            if normalized is not None:
                future_bill_ids.add(normalized)
        for value in (item.get("tracked_bill_id"),):
            normalized = normalize_int(value)
            if normalized is not None:
                tracked_bill_ids.add(normalized)
        for value in (item.get("future_bill_link_id"),):
            normalized = normalize_int(value)
            if normalized is not None:
                future_bill_link_ids.add(normalized)

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            existing_future_bills = fetch_existing_ids(cursor, "future_bills", future_bill_ids)
            existing_tracked_bills = fetch_existing_ids(cursor, "tracked_bills", tracked_bill_ids)
            link_rows = fetch_future_bill_links(cursor, future_bill_link_ids, future_bill_ids)
    finally:
        conn.close()

    links_by_id = {int(row["id"]): row for row in link_rows if row.get("id") is not None}
    links_by_pair = {}
    for row in link_rows:
        future_bill_id = normalize_int(row.get("future_bill_id"))
        tracked_bill_id = normalize_int(row.get("tracked_bill_id"))
        if future_bill_id is not None and tracked_bill_id is not None:
            links_by_pair[(future_bill_id, tracked_bill_id)] = row

    return {
        "future_bill_ids": existing_future_bills,
        "tracked_bill_ids": existing_tracked_bills,
        "links_by_id": links_by_id,
        "links_by_pair": links_by_pair,
    }


def resolved_action(
    action: dict[str, Any],
    *,
    repair_time: str,
    review_state: str,
    status: str,
    resolution: str,
    reason: str,
) -> dict[str, Any]:
    repaired = copy.deepcopy(action)
    repaired["review_state"] = review_state
    repaired["status"] = status
    repaired["approved"] = True if review_state == "already_applied" else bool(repaired.get("approved"))
    repaired["repair_resolution"] = resolution
    repaired["repair_reason"] = reason
    repaired["repair_source"] = REPAIRED_BY
    repaired["repair_applied_at"] = repair_time
    if review_state == "already_applied":
        repaired.setdefault("apply_result", resolution)
    return repaired


def reconcile_action(
    action: dict[str, Any],
    future_bill_id: int | None,
    live_state: dict[str, Any],
    repair_time: str,
) -> tuple[dict[str, Any], dict[str, Any] | None]:
    action_type = str(action.get("action_type") or "")
    payload = action.get("payload") or {}
    links_by_id = live_state["links_by_id"]
    links_by_pair = live_state["links_by_pair"]
    future_bill_ids = live_state["future_bill_ids"]
    tracked_bill_ids = live_state["tracked_bill_ids"]

    if future_bill_id is not None and future_bill_id not in future_bill_ids:
        repaired = resolved_action(
            action,
            repair_time=repair_time,
            review_state="stale",
            status="stale",
            resolution="stale_future_bill_missing",
            reason="Referenced future bill no longer exists.",
        )
        return repaired, {
            "action_id": action.get("action_id"),
            "action_type": action_type,
            "future_bill_id": future_bill_id,
            "resolution": "stale_future_bill_missing",
            "reason": "Referenced future bill no longer exists.",
        }

    if action_type == "remove_direct_link":
        future_bill_link_id = normalize_int(payload.get("future_bill_link_id"))
        if future_bill_link_id is not None and future_bill_link_id not in links_by_id:
            repaired = resolved_action(
                action,
                repair_time=repair_time,
                review_state="already_applied",
                status="applied",
                resolution="skipped_already_absent",
                reason="remove_direct_link target is already absent.",
            )
            return repaired, {
                "action_id": action.get("action_id"),
                "action_type": action_type,
                "future_bill_id": future_bill_id,
                "future_bill_link_id": future_bill_link_id,
                "resolution": "skipped_already_absent",
                "reason": "remove_direct_link target is already absent.",
            }

    if action_type == "convert_to_partial":
        future_bill_link_id = normalize_int(payload.get("future_bill_link_id"))
        live = links_by_id.get(future_bill_link_id) if future_bill_link_id is not None else None
        if live and str(live.get("link_type") or "") == "Partial":
            repaired = resolved_action(
                action,
                repair_time=repair_time,
                review_state="already_applied",
                status="applied",
                resolution="already_partial",
                reason="Target link is already Partial.",
            )
            return repaired, {
                "action_id": action.get("action_id"),
                "action_type": action_type,
                "future_bill_id": future_bill_id,
                "future_bill_link_id": future_bill_link_id,
                "resolution": "already_partial",
                "reason": "Target link is already Partial.",
            }
        if future_bill_link_id is not None and live is None:
            repaired = resolved_action(
                action,
                repair_time=repair_time,
                review_state="stale",
                status="stale",
                resolution="stale_target_absent",
                reason="Target link for convert_to_partial no longer exists.",
            )
            return repaired, {
                "action_id": action.get("action_id"),
                "action_type": action_type,
                "future_bill_id": future_bill_id,
                "future_bill_link_id": future_bill_link_id,
                "resolution": "stale_target_absent",
                "reason": "Target link for convert_to_partial no longer exists.",
            }

    if action_type == "create_partial_link":
        tracked_bill_id = normalize_int(payload.get("tracked_bill_id") or action.get("candidate_tracked_bill_id"))
        if tracked_bill_id is not None and tracked_bill_id not in tracked_bill_ids:
            repaired = resolved_action(
                action,
                repair_time=repair_time,
                review_state="stale",
                status="stale",
                resolution="stale_tracked_bill_missing",
                reason="Tracked bill target no longer exists.",
            )
            return repaired, {
                "action_id": action.get("action_id"),
                "action_type": action_type,
                "future_bill_id": future_bill_id,
                "tracked_bill_id": tracked_bill_id,
                "resolution": "stale_tracked_bill_missing",
                "reason": "Tracked bill target no longer exists.",
            }
        live = links_by_pair.get((future_bill_id, tracked_bill_id)) if future_bill_id is not None and tracked_bill_id is not None else None
        if live and str(live.get("link_type") or "") == "Partial":
            repaired = resolved_action(
                action,
                repair_time=repair_time,
                review_state="already_applied",
                status="applied",
                resolution="partial_link_already_exists",
                reason="Partial link already exists for this future bill and tracked bill.",
            )
            return repaired, {
                "action_id": action.get("action_id"),
                "action_type": action_type,
                "future_bill_id": future_bill_id,
                "tracked_bill_id": tracked_bill_id,
                "resolution": "partial_link_already_exists",
                "reason": "Partial link already exists for this future bill and tracked bill.",
            }

    if action_type == "import_candidate_seed":
        candidate_future_bill_id = normalize_int(payload.get("future_bill_id") or future_bill_id)
        if candidate_future_bill_id is not None and candidate_future_bill_id not in future_bill_ids:
            repaired = resolved_action(
                action,
                repair_time=repair_time,
                review_state="stale",
                status="stale",
                resolution="stale_future_bill_missing",
                reason="Future bill for import candidate no longer exists.",
            )
            return repaired, {
                "action_id": action.get("action_id"),
                "action_type": action_type,
                "future_bill_id": candidate_future_bill_id,
                "resolution": "stale_future_bill_missing",
                "reason": "Future bill for import candidate no longer exists.",
            }

    return copy.deepcopy(action), None


def filter_manual_queue_items(
    queue_payload: dict[str, Any] | None,
    live_state: dict[str, Any],
    repair_time: str,
) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    if not queue_payload:
        return None, []

    kept_items: list[dict[str, Any]] = []
    removed_items: list[dict[str, Any]] = []
    future_bill_ids = live_state["future_bill_ids"]
    links_by_id = live_state["links_by_id"]

    for item in queue_payload.get("items") or []:
        future_bill_id = normalize_int(item.get("future_bill_id"))
        future_bill_link_id = normalize_int(item.get("future_bill_link_id"))
        remove_reason = None

        if future_bill_id is not None and future_bill_id not in future_bill_ids:
            remove_reason = "future_bill_missing"
        elif future_bill_link_id is not None and future_bill_link_id not in links_by_id:
            remove_reason = "future_bill_link_missing"

        if remove_reason:
            removed_items.append(
                {
                    "future_bill_id": future_bill_id,
                    "future_bill_link_id": future_bill_link_id,
                    "tracked_bill_id": normalize_int(item.get("tracked_bill_id")),
                    "resolution": remove_reason,
                    "reason": "Manual review queue item is no longer actionable against current DB state.",
                }
            )
            continue

        kept = copy.deepcopy(item)
        kept["review_state"] = "actionable"
        kept_items.append(kept)

    repaired_queue = copy.deepcopy(queue_payload)
    repaired_queue["generated_at"] = repair_time
    repaired_queue["repair_source"] = REPAIRED_BY
    repaired_queue["items"] = kept_items
    repaired_queue["manual_review_count"] = len(kept_items)
    repaired_queue["removed_stale_items"] = len(removed_items)
    return repaired_queue, removed_items


def recalculate_bundle(bundle: dict[str, Any]) -> dict[str, Any]:
    repaired = copy.deepcopy(bundle)
    pending_actions_index: list[dict[str, Any]] = []

    total_actions = 0
    total_manual_review_items = 0
    total_already_applied = 0
    total_stale = 0

    for group in repaired.get("future_bill_groups") or []:
        operator_actions = [copy.deepcopy(action) for action in (group.get("operator_actions") or [])]
        actionable_actions = [action for action in operator_actions if is_actionable(action)]
        actionable_manual_items = [
            item for item in (group.get("manual_review_queue") or []) if actionable_manual_item(item)
        ]

        already_applied_count = sum(
            1 for action in operator_actions if str(action.get("review_state") or "").lower() == "already_applied"
        )
        stale_count = sum(
            1 for action in operator_actions if str(action.get("review_state") or "").lower() in {"stale", "superseded", "dismissed"}
        )

        group["operator_actions"] = operator_actions
        group["actionable_operator_actions_count"] = len(actionable_actions)
        group["already_applied_count"] = already_applied_count
        group["stale_suggestions_count"] = stale_count
        group["status"] = "actionable" if actionable_actions else "informational"

        if actionable_actions:
            group["recommended_operator_action"] = "review_operator_actions"
            group["priority_level"] = "high"
            group["bundle_status"] = "pending_review"
        elif actionable_manual_items:
            group["recommended_operator_action"] = "manual_review_required"
            group["priority_level"] = "high"
            group["bundle_status"] = "pending_review"
        elif group.get("partial_suggestions"):
            group["recommended_operator_action"] = "review_partial_and_replacement_suggestions"
            group["priority_level"] = "medium"
            group["bundle_status"] = "informational"
        elif group.get("candidate_discovery"):
            group["recommended_operator_action"] = "review_candidate_seed_imports"
            group["priority_level"] = "medium"
            group["bundle_status"] = "informational"
        else:
            group["recommended_operator_action"] = "retain_for_now"
            group["priority_level"] = "normal"
            group["bundle_status"] = "informational"

        pending_actions_index.extend(actionable_actions)
        total_actions += len(operator_actions)
        total_manual_review_items += len(actionable_manual_items)
        total_already_applied += already_applied_count
        total_stale += stale_count

    repaired["pending_actions_index"] = pending_actions_index
    repaired["summary"] = {
        **(repaired.get("summary") or {}),
        "future_bills_reviewed": len(repaired.get("future_bill_groups") or []),
        "future_bills_in_bundle": len(repaired.get("future_bill_groups") or []),
        "total_actions": total_actions,
        "safe_auto_removals_available": sum(1 for action in pending_actions_index if action.get("action_type") == "remove_direct_link"),
        "manual_review_items": total_manual_review_items,
        "partial_candidates": sum(
            1
            for action in pending_actions_index
            if action.get("action_type") in {"convert_to_partial", "create_partial_link"}
        ),
        "discovery_candidates": sum(1 for action in pending_actions_index if action.get("action_type") == "import_candidate_seed"),
        "items_requiring_operator_action": len(pending_actions_index),
        "total_applied_actions": total_already_applied,
        "total_actionable_operator_actions": len(pending_actions_index),
        "total_skipped": total_stale,
        "total_stale": total_stale,
        "total_stale_suggestions": total_stale,
        "total_already_applied": total_already_applied,
    }
    return repaired


def repair_bundle_state(
    bundle: dict[str, Any],
    manual_queue: dict[str, Any] | None,
    live_state: dict[str, Any],
    *,
    repair_time: str | None = None,
) -> tuple[dict[str, Any], dict[str, Any] | None, dict[str, Any]]:
    repair_time = repair_time or datetime.now(UTC).isoformat()
    original_active_actions = len([action for action in bundle.get("pending_actions_index") or [] if is_actionable(action)])
    original_manual_review_count = normalize_int((manual_queue or {}).get("manual_review_count")) or len((manual_queue or {}).get("items") or [])

    repaired_bundle = copy.deepcopy(bundle)
    actions_removed_or_resolved: list[dict[str, Any]] = []
    warnings: list[str] = []
    repaired_action_count = 0

    for group in repaired_bundle.get("future_bill_groups") or []:
        future_bill_id = normalize_int(group.get("future_bill_id"))
        repaired_actions = []
        for action in group.get("operator_actions") or []:
            repaired_action, resolution = reconcile_action(action, future_bill_id, live_state, repair_time)
            if resolution:
                repaired_action_count += 1
                actions_removed_or_resolved.append(resolution)
            repaired_actions.append(repaired_action)
        group["operator_actions"] = repaired_actions
        group_queue_payload, removed_group_queue_items = filter_manual_queue_items(
            {
                "items": group.get("manual_review_queue") or [],
                "manual_review_count": len(group.get("manual_review_queue") or []),
            },
            live_state,
            repair_time,
        )
        group["manual_review_queue"] = (group_queue_payload or {}).get("items") or []
        for item in removed_group_queue_items:
            repaired_action_count += 1
            actions_removed_or_resolved.append(
                {
                    "action_id": None,
                    "action_type": "bundle_manual_review_queue_item",
                    **item,
                }
            )

    repaired_queue, removed_manual_items = filter_manual_queue_items(manual_queue, live_state, repair_time)
    for item in removed_manual_items:
        repaired_action_count += 1
        actions_removed_or_resolved.append(
            {
                "action_id": None,
                "action_type": "manual_review_queue_item",
                **item,
            }
        )

    recalculated_bundle = recalculate_bundle(repaired_bundle)
    previous_generated_at = bundle.get("generated_at")
    recalculated_bundle["repaired_from_generated_at"] = previous_generated_at
    recalculated_bundle["generated_at"] = repair_time
    recalculated_bundle["repair_source"] = REPAIRED_BY
    recalculated_bundle["repair_summary"] = {
        "repaired_action_count": repaired_action_count,
        "removed_manual_review_items": len(removed_manual_items),
    }

    active_actions = [
        {
            "action_id": action.get("action_id"),
            "action_type": action.get("action_type"),
            "future_bill_id": group.get("future_bill_id"),
        }
        for group in recalculated_bundle.get("future_bill_groups") or []
        for action in group.get("operator_actions") or []
        if is_actionable(action)
    ]

    report = {
        "generated_at": repair_time,
        "original_action_count": sum(len(group.get("operator_actions") or []) for group in (bundle.get("future_bill_groups") or [])),
        "repaired_action_count": repaired_action_count,
        "stale_action_count": len(actions_removed_or_resolved),
        "actions_removed_or_resolved": actions_removed_or_resolved,
        "actions_left_active": active_actions,
        "warnings": warnings,
        "workflow_state_changed": (
            len(active_actions) != original_active_actions
            or (repaired_queue and repaired_queue.get("manual_review_count", 0) != original_manual_review_count)
        ),
        "manual_review_queue_removed_count": len(removed_manual_items),
    }
    return recalculated_bundle, repaired_queue, report


def main() -> None:
    args = parse_args()
    dry_run = args.dry_run or not args.apply
    if args.apply and not args.yes:
        raise SystemExit("--apply requires --yes")

    bundle_path = args.input.resolve()
    manual_queue_path = args.manual_queue.resolve()
    output_path = args.output.resolve()

    bundle = load_required_json(bundle_path)
    manual_queue = load_optional_json(manual_queue_path)
    live_state = fetch_live_state(bundle, manual_queue)
    repaired_bundle, repaired_queue, report = repair_bundle_state(bundle, manual_queue, live_state)

    report_payload = {
        **report,
        "mode": "dry_run" if dry_run else "apply",
        "input_bundle": str(bundle_path),
        "input_manual_queue": str(manual_queue_path),
        "bundle_rewritten": bool(not dry_run and report["repaired_action_count"] > 0),
        "manual_queue_rewritten": bool(
            not dry_run and repaired_queue is not None and report["manual_review_queue_removed_count"] > 0
        ),
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report_payload, indent=2, default=str) + "\n")

    if not dry_run:
        if report["repaired_action_count"] > 0:
            bundle_path.write_text(json.dumps(repaired_bundle, indent=2, default=str) + "\n")
            if repaired_queue is not None:
                manual_queue_path.write_text(json.dumps(repaired_queue, indent=2, default=str) + "\n")

    print("EquityStack Legislative Bundle Repair")
    print(f"Mode: {'dry-run' if dry_run else 'apply'}")
    print(f"Original action count: {report['original_action_count']}")
    print(f"Repaired action count: {report['repaired_action_count']}")
    print(f"Stale action count: {report['stale_action_count']}")
    print(f"Active actions left: {len(report['actions_left_active'])}")
    print(f"Workflow state changed: {'yes' if report['workflow_state_changed'] else 'no'}")
    print(f"Wrote repair report to {output_path}")


if __name__ == "__main__":
    main()
