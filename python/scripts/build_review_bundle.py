#!/usr/bin/env python3
import argparse
import csv
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from apply_future_bill_ai_review import get_db_connection


def python_dir() -> Path:
    return Path(__file__).resolve().parents[1]


def reports_dir() -> Path:
    return python_dir() / "reports"


def default_ai_review_path() -> Path:
    return reports_dir() / "future_bill_link_ai_review.json"


def default_apply_report_path() -> Path:
    return reports_dir() / "equitystack_apply_report.json"


def default_manual_queue_path() -> Path:
    return reports_dir() / "future_bill_link_manual_review_queue.json"


def default_suggestions_path() -> Path:
    return reports_dir() / "future_bill_link_partial_suggestions.json"


def default_discovery_path() -> Path:
    return reports_dir() / "future_bill_candidate_discovery.json"


def default_output_path() -> Path:
    return reports_dir() / "equitystack_review_bundle.json"


def default_feedback_analysis_path() -> Path:
    return reports_dir() / "equitystack_feedback_analysis.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build one human-review bundle from the daily EquityStack outputs.")
    parser.add_argument("--ai-review", type=Path, default=default_ai_review_path(), help="AI review report JSON")
    parser.add_argument("--apply-report", type=Path, default=default_apply_report_path(), help="Safe apply report JSON")
    parser.add_argument("--manual-queue", type=Path, default=default_manual_queue_path(), help="Manual review queue JSON")
    parser.add_argument("--suggestions", type=Path, default=default_suggestions_path(), help="Partial suggestion report JSON")
    parser.add_argument("--discovery", type=Path, default=default_discovery_path(), help="Candidate discovery report JSON")
    parser.add_argument("--output", type=Path, default=default_output_path(), help="Bundle output path")
    parser.add_argument("--only-future-bill-id", type=int, action="append", help="Limit the bundle to one or more future_bill_id values")
    parser.add_argument("--use-feedback", action="store_true", help="Apply small capped scoring adjustments from feedback analysis")
    parser.add_argument("--csv", nargs="?", const="", help="Write a flat CSV summary. Pass a path or omit a value to derive one.")
    return parser.parse_args()


def derive_csv_path(csv_arg: str | None, output_path: Path) -> Path | None:
    if csv_arg is None:
        return None
    if csv_arg == "":
        return output_path.with_suffix(".csv")
    return Path(csv_arg).resolve()


def load_optional_json(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    return json.loads(path.read_text())


def load_feedback_adjustments(path: Path) -> dict[str, dict[str, float]]:
    payload = load_optional_json(path)
    adjustments = {"action_type": {}, "link_type": {}}
    if not payload:
        return adjustments
    for item in payload.get("action_types") or []:
        name = item.get("name")
        value = item.get("suggested_adjustment")
        if name and isinstance(value, (int, float)):
            adjustments["action_type"][str(name).lower()] = max(-0.1, min(0.1, float(value)))
    for item in payload.get("link_types") or []:
        name = item.get("name")
        value = item.get("suggested_adjustment")
        if name and isinstance(value, (int, float)):
            adjustments["link_type"][str(name).lower()] = max(-0.1, min(0.1, float(value)))
    return adjustments


def nested_get(item: dict[str, Any], *keys: str) -> Any:
    current: Any = item
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def resolve_future_bill_id(item: dict[str, Any]) -> int | None:
    candidates = [
        item.get("future_bill_id"),
        nested_get(item, "payload", "future_bill_id"),
        nested_get(item, "candidate", "future_bill_id"),
        nested_get(item, "source", "future_bill_id"),
        nested_get(item, "future_bill", "id"),
    ]
    for value in candidates:
        if value in (None, ""):
            continue
        try:
            return int(value)
        except (TypeError, ValueError):
            continue
    return None


def init_normalization_summary() -> dict[str, int]:
    return {
        "rows_seen": 0,
        "rows_grouped": 0,
        "rows_skipped_missing_future_bill_id": 0,
        "rows_skipped_other_errors": 0,
    }


def register_skip(
    skipped_items: list[dict[str, Any]],
    normalization_summary: dict[str, int],
    source_report_type: str,
    item: dict[str, Any],
    reason: str,
) -> None:
    if reason == "missing future_bill_id":
        normalization_summary["rows_skipped_missing_future_bill_id"] += 1
    else:
        normalization_summary["rows_skipped_other_errors"] += 1
    skipped_items.append(
        {
            "source_report_type": source_report_type,
            "reason": reason,
            "item_excerpt": {
                key: item.get(key)
                for key in ["future_bill_id", "future_bill_link_id", "action_id", "action_type", "bill_number", "title"]
                if key in item
            },
        }
    )


def report_items(report: dict[str, Any] | None, *keys: str) -> list[dict[str, Any]]:
    if not report:
        return []
    for key in keys:
        value = report.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
    return []


def coerce_int(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def future_bill_group_template(future_bill_id: int) -> dict[str, Any]:
    return {
        "future_bill_id": future_bill_id,
        "future_bill_title": None,
        "target_area": None,
        "priority_level": "normal",
        "status": "needs_review",
        "bundle_status": "pending_review",
        "recommended_operator_action": "inspect_group",
        "notes": [],
        "current_links": [],
        "current_links_by_type": {
            "direct": [],
            "partial": [],
            "related": [],
            "companion": [],
        },
        "ai_review": [],
        "safe_apply": [],
        "manual_review_queue": [],
        "partial_suggestions": [],
        "candidate_discovery": [],
        "operator_actions": [],
        "_pending_actions": [],
        "_historical_actions": [],
        "actionable_operator_actions_count": 0,
        "stale_suggestions_count": 0,
        "already_applied_count": 0,
        "suppressed_weak_candidates_count": 0,
    }


def fetch_future_bill_metadata(cursor, future_bill_ids: list[int]) -> dict[int, dict[str, Any]]:
    if not future_bill_ids:
        return {}
    placeholders = ",".join(["%s"] * len(future_bill_ids))
    cursor.execute(
        f"""
        SELECT id, title, target_area
        FROM future_bills
        WHERE id IN ({placeholders})
        """,
        tuple(future_bill_ids),
    )
    return {int(row["id"]): row for row in cursor.fetchall()}


def fetch_current_links(cursor, future_bill_ids: list[int]) -> dict[int, list[dict[str, Any]]]:
    if not future_bill_ids:
        return {}
    placeholders = ",".join(["%s"] * len(future_bill_ids))
    cursor.execute(
        f"""
        SELECT
          fbl.id AS future_bill_link_id,
          fbl.future_bill_id,
          fbl.tracked_bill_id,
          fbl.link_type,
          fbl.notes,
          tb.bill_number,
          tb.title AS tracked_bill_title
        FROM future_bill_links fbl
        JOIN tracked_bills tb
          ON tb.id = fbl.tracked_bill_id
        WHERE fbl.future_bill_id IN ({placeholders})
        ORDER BY fbl.future_bill_id ASC, fbl.link_type ASC, tb.bill_number ASC
        """,
        tuple(future_bill_ids),
    )
    grouped: dict[int, list[dict[str, Any]]] = {}
    for row in cursor.fetchall():
        future_bill_id = int(row["future_bill_id"])
        grouped.setdefault(future_bill_id, []).append(
            {
                "future_bill_link_id": int(row["future_bill_link_id"]),
                "tracked_bill_id": int(row["tracked_bill_id"]),
                "bill_number": row.get("bill_number"),
                "tracked_bill_title": row.get("tracked_bill_title"),
                "link_type": row.get("link_type"),
                "notes": row.get("notes"),
            }
        )
    return grouped


def populate_live_current_links(groups: dict[int, dict[str, Any]]) -> None:
    if not groups:
        return
    try:
        conn = get_db_connection()
    except Exception as exc:
        print(f"Warning: unable to load live current links from DB; continuing without DB reconciliation ({exc})")
        return

    try:
        with conn.cursor() as cursor:
            future_bill_ids = sorted(groups.keys())
            metadata = fetch_future_bill_metadata(cursor, future_bill_ids)
            live_links = fetch_current_links(cursor, future_bill_ids)
        for future_bill_id, group in groups.items():
            meta = metadata.get(future_bill_id) or {}
            group["future_bill_title"] = group["future_bill_title"] or meta.get("title")
            group["target_area"] = group["target_area"] or meta.get("target_area")
            current_links = live_links.get(future_bill_id, [])
            grouped_links = {
                "direct": [],
                "partial": [],
                "related": [],
                "companion": [],
            }
            for row in current_links:
                link_type = str(row.get("link_type") or "").lower()
                if link_type == "direct":
                    grouped_links["direct"].append(row)
                elif link_type == "partial":
                    grouped_links["partial"].append(row)
                elif link_type == "related":
                    grouped_links["related"].append(row)
                elif link_type == "companion":
                    grouped_links["companion"].append(row)
            group["current_links"] = current_links
            group["current_links_by_type"] = grouped_links
    finally:
        conn.close()


def action_candidate(
    *,
    action_type: str,
    target_type: str,
    target_id: int | None,
    payload: dict[str, Any],
    future_bill_id: int,
    future_bill_link_id: int | None,
    current_tracked_bill_id: int | None,
    candidate_tracked_bill_id: int | None,
    candidate_bill_number: str | None,
    candidate_title: str | None,
    proposed_link_type: str | None,
    rationale: str,
    source: str,
    raw_data: dict[str, Any],
) -> dict[str, Any]:
    action_id = f"{action_type}:{future_bill_id}:{future_bill_link_id or candidate_tracked_bill_id or candidate_bill_number or 'na'}"
    return {
        "action_id": action_id,
        "action_type": action_type,
        "target_type": target_type,
        "target_id": target_id,
        "payload": payload,
        "status": "pending",
        "approved": False,
        "approved_by": None,
        "approved_at": None,
        "source": source,
        "rationale": rationale,
        "review_state": "actionable",
        "future_bill_id": future_bill_id,
        "future_bill_link_id": future_bill_link_id,
        "current_tracked_bill_id": current_tracked_bill_id,
        "candidate_tracked_bill_id": candidate_tracked_bill_id,
        "candidate_bill_number": candidate_bill_number,
        "candidate_title": candidate_title,
        "proposed_link_type": proposed_link_type,
        "raw_data": raw_data,
    }


def index_apply_report_actions(apply_report: dict[str, Any] | None) -> dict[str, dict[str, Any]]:
    indexed: dict[str, dict[str, Any]] = {}
    if not apply_report or str(apply_report.get("mode") or "").lower() != "apply":
        return indexed
    for item in report_items(apply_report, "applied_actions"):
        action_id = item.get("action_id")
        if action_id:
            indexed[str(action_id)] = item
    return indexed


def choose_group_action(group: dict[str, Any]) -> str:
    actionable_manual_items = [item for item in group["manual_review_queue"] if str(item.get("review_state") or "actionable") == "actionable"]
    if group["actionable_operator_actions_count"]:
        return "review_operator_actions"
    if any(item.get("status") == "eligible_dry_run" for item in group["safe_apply"]):
        return "review_safe_removal_candidates"
    if group["partial_suggestions"]:
        return "review_partial_and_replacement_suggestions"
    if group["candidate_discovery"]:
        return "review_candidate_seed_imports"
    if actionable_manual_items:
        return "manual_review_required"
    return "retain_for_now"


def choose_priority(group: dict[str, Any]) -> str:
    actionable_manual_items = [item for item in group["manual_review_queue"] if str(item.get("review_state") or "actionable") == "actionable"]
    if group["actionable_operator_actions_count"]:
        return "high"
    if any(item.get("status") == "eligible_dry_run" for item in group["safe_apply"]):
        return "high"
    if actionable_manual_items:
        return "high"
    if group["partial_suggestions"] or group["candidate_discovery"]:
        return "medium"
    return "normal"


def live_state_index(group: dict[str, Any]) -> tuple[dict[int, dict[str, Any]], dict[tuple[int, int], dict[str, Any]]]:
    by_link_id: dict[int, dict[str, Any]] = {}
    by_pair: dict[tuple[int, int], dict[str, Any]] = {}
    for row in group["current_links"]:
        if row.get("future_bill_link_id") is not None:
            by_link_id[int(row["future_bill_link_id"])] = row
        if row.get("tracked_bill_id") is not None:
            by_pair[(int(group["future_bill_id"]), int(row["tracked_bill_id"]))] = row
    return by_link_id, by_pair


def classify_review_state_from_live(
    *,
    group: dict[str, Any],
    future_bill_link_id: int | None,
    tracked_bill_id: int | None,
    desired_link_type: str | None,
) -> str:
    by_link_id, by_pair = live_state_index(group)
    if future_bill_link_id is not None:
        live_link = by_link_id.get(int(future_bill_link_id))
        if not live_link:
            if tracked_bill_id is not None:
                replacement = by_pair.get((int(group["future_bill_id"]), int(tracked_bill_id)))
                if replacement and desired_link_type and str(replacement.get("link_type")) == desired_link_type:
                    return "already_applied"
            return "stale"
        if desired_link_type and str(live_link.get("link_type")) == desired_link_type:
            return "already_applied"
        if desired_link_type and str(live_link.get("link_type")) != desired_link_type:
            return "actionable"
    if tracked_bill_id is not None:
        live_pair = by_pair.get((int(group["future_bill_id"]), int(tracked_bill_id)))
        if not live_pair:
            return "actionable"
        if desired_link_type and str(live_pair.get("link_type")) == desired_link_type:
            return "already_applied"
        return "superseded"
    return "actionable"


def mark_counts(group: dict[str, Any], review_state: str) -> None:
    if review_state == "actionable":
        return
    if review_state == "already_applied":
        group["already_applied_count"] += 1
    elif review_state in {"stale", "superseded", "dismissed"}:
        group["stale_suggestions_count"] += 1


def reconcile_safe_apply_and_manual(group: dict[str, Any]) -> None:
    by_link_id, _ = live_state_index(group)
    for collection_name in ["safe_apply", "manual_review_queue"]:
        for item in group[collection_name]:
            future_bill_link_id = item.get("future_bill_link_id")
            if future_bill_link_id and int(future_bill_link_id) not in by_link_id:
                item["review_state"] = "already_applied"
                group["already_applied_count"] += 1
            else:
                item["review_state"] = "actionable"


def reconcile_partial_suggestions(group: dict[str, Any]) -> None:
    reconciled = []
    for item in group["partial_suggestions"]:
        suggestion_type = item.get("suggestion_type")
        desired_link_type = item.get("suggested_link_type")
        tracked_bill_id = item.get("candidate_tracked_bill_id")
        if suggestion_type == "partial_conversion":
            review_state = classify_review_state_from_live(
                group=group,
                future_bill_link_id=item.get("current_future_bill_link_id"),
                tracked_bill_id=item.get("current_tracked_bill_id"),
                desired_link_type="Partial" if desired_link_type == "Partial" else None,
            )
        else:
            review_state = classify_review_state_from_live(
                group=group,
                future_bill_link_id=None,
                tracked_bill_id=tracked_bill_id,
                desired_link_type="Partial" if desired_link_type == "Partial" else None,
            )
        if desired_link_type != "Partial" and review_state == "actionable":
            review_state = "dismissed"
        item["review_state"] = review_state
        mark_counts(group, review_state)
        reconciled.append(item)

        if review_state != "actionable" or desired_link_type != "Partial":
            continue
        if suggestion_type == "partial_conversion":
            group["_pending_actions"].append(
                action_candidate(
                    action_type="convert_to_partial",
                    target_type="future_bill_link",
                    target_id=item.get("current_future_bill_link_id"),
                    payload={
                        "future_bill_link_id": item.get("current_future_bill_link_id"),
                        "new_link_type": "Partial",
                        "notes": item.get("why_this_candidate"),
                    },
                    future_bill_id=group["future_bill_id"],
                    future_bill_link_id=item.get("current_future_bill_link_id"),
                    current_tracked_bill_id=item.get("current_tracked_bill_id"),
                    candidate_tracked_bill_id=item.get("candidate_tracked_bill_id"),
                    candidate_bill_number=item.get("candidate_bill_number"),
                    candidate_title=item.get("candidate_tracked_bill_title"),
                    proposed_link_type="Partial",
                    rationale=item.get("why_this_candidate") or "Suggestion engine recommends retaining the current link as Partial.",
                    source="future_bill_link_partial_suggestions",
                    raw_data=item,
                )
            )
        elif suggestion_type == "alternate_replacement":
            group["_pending_actions"].append(
                action_candidate(
                    action_type="create_partial_link",
                    target_type="tracked_bill",
                    target_id=item.get("candidate_tracked_bill_id"),
                    payload={
                        "future_bill_id": group["future_bill_id"],
                        "tracked_bill_id": item.get("candidate_tracked_bill_id"),
                        "notes": item.get("why_this_candidate"),
                    },
                    future_bill_id=group["future_bill_id"],
                    future_bill_link_id=None,
                    current_tracked_bill_id=item.get("current_tracked_bill_id"),
                    candidate_tracked_bill_id=item.get("candidate_tracked_bill_id"),
                    candidate_bill_number=item.get("candidate_bill_number"),
                    candidate_title=item.get("candidate_tracked_bill_title"),
                    proposed_link_type="Partial",
                    rationale=item.get("why_this_candidate") or "Suggestion engine recommends adding this as a new Partial link.",
                    source="future_bill_link_partial_suggestions",
                    raw_data=item,
                )
            )
    group["partial_suggestions"] = reconciled


def discovery_candidate_review_state(group: dict[str, Any], candidate: dict[str, Any]) -> tuple[str, bool]:
    import_priority = str(candidate.get("import_priority") or "").lower()
    next_step = candidate.get("recommended_next_step")
    if import_priority not in {"high", "medium"}:
        return "dismissed", True
    if next_step not in {"import_and_review", "create_new_partial_candidate"}:
        return "dismissed", True
    if str(candidate.get("llm_import_decision") or "").lower() in {"reject_candidate", "weak_candidate"}:
        return "dismissed", True
    if str(candidate.get("source") or "").lower() != "congress_api":
        return "dismissed", True
    return "actionable", False


def reconcile_candidate_discovery(group: dict[str, Any]) -> None:
    reconciled_items = []
    for item in group["candidate_discovery"]:
        candidates = []
        for candidate in item.get("discovered_candidates") or []:
            review_state, suppressed = discovery_candidate_review_state(group, candidate)
            candidate["review_state"] = review_state
            if suppressed:
                group["suppressed_weak_candidates_count"] += 1
            mark_counts(group, review_state)
            candidates.append(candidate)
            if review_state != "actionable":
                continue
            group["_pending_actions"].append(
                action_candidate(
                    action_type="import_candidate_seed",
                    target_type="tracked_bill_seed",
                    target_id=None,
                    payload={
                        "future_bill_id": group["future_bill_id"],
                        "congress": candidate.get("congress"),
                        "bill_type": str(candidate.get("bill_number", "")).split(" ", 1)[0].replace(".", "").lower() if candidate.get("bill_number") else None,
                        "bill_number": str(candidate.get("bill_number", "")).split(" ", 1)[1] if candidate.get("bill_number") and " " in str(candidate.get("bill_number")) else candidate.get("bill_number"),
                        "jurisdiction": "Federal",
                        "chamber": candidate.get("chamber"),
                        "source_system": "Approved review bundle import",
                        "active": True,
                        "match_confidence": "Medium" if import_priority_value(candidate.get("import_priority")) >= 2 else "Low",
                        "link_type": None,
                        "link_notes": f"Approved from review bundle candidate discovery for future bill {group['future_bill_id']}.",
                        "impact_status": candidate.get("impact_status") or "impact_pending",
                        "recommended_action": candidate.get("recommended_action") or "import_with_pending_impact",
                        "confidence": candidate.get("confidence") or candidate.get("match_confidence"),
                        "source_quality": candidate.get("source_quality"),
                    },
                    future_bill_id=group["future_bill_id"],
                    future_bill_link_id=None,
                    current_tracked_bill_id=None,
                    candidate_tracked_bill_id=None,
                    candidate_bill_number=candidate.get("bill_number"),
                    candidate_title=candidate.get("title"),
                    proposed_link_type=None,
                    rationale=candidate.get("why_this_candidate") or "Discovery found a plausible new tracked-bill candidate.",
                    source="future_bill_candidate_discovery",
                    raw_data=candidate,
                )
            )
        item["discovered_candidates"] = candidates
        reconciled_items.append(item)
    group["candidate_discovery"] = reconciled_items


def import_priority_value(priority: str | None) -> int:
    mapping = {"reject": 0, "low": 1, "medium": 2, "high": 3}
    return mapping.get(str(priority or "").lower(), 0)


def parse_congress_value(action: dict[str, Any]) -> int | None:
    candidates = [
        action.get("payload", {}).get("congress"),
        action.get("raw_data", {}).get("congress"),
        action.get("congress"),
    ]
    for value in candidates:
        parsed = coerce_int(value)
        if parsed is not None:
            return parsed
    return None


def normalize_match_confidence(action: dict[str, Any]) -> float:
    raw = (
        action.get("payload", {}).get("match_confidence")
        or action.get("raw_data", {}).get("match_confidence")
        or action.get("match_confidence")
    )
    if raw in (None, ""):
        return 0.5
    if isinstance(raw, (int, float)):
        value = float(raw)
        return max(0.0, min(1.0, value / 100.0 if value > 1 else value))
    mapping = {
        "very high": 1.0,
        "high": 0.9,
        "medium": 0.7,
        "low": 0.45,
        "very low": 0.2,
    }
    return mapping.get(str(raw).strip().lower(), 0.5)


def inferred_link_type(action: dict[str, Any]) -> str | None:
    candidates = [
        action.get("payload", {}).get("new_link_type"),
        action.get("payload", {}).get("link_type"),
        action.get("proposed_link_type"),
    ]
    return next((str(value) for value in candidates if value not in (None, "")), None)


def link_type_score(action: dict[str, Any], feedback_adjustments: dict[str, dict[str, float]]) -> tuple[float, float]:
    link_type = inferred_link_type(action)
    mapping = {
        "direct": 1.0,
        "companion": 0.85,
        "related": 0.65,
        "partial": 0.5,
    }
    adjustment = 0.0
    if link_type:
        key = link_type.strip().lower()
        adjustment = feedback_adjustments.get("link_type", {}).get(key, 0.0)
        return max(0.0, min(1.0, mapping.get(key, 0.5) + adjustment)), adjustment
    if action.get("action_type") in {"create_partial_link", "convert_to_partial"}:
        adjustment = feedback_adjustments.get("link_type", {}).get("partial", 0.0)
        return max(0.0, min(1.0, 0.5 + adjustment)), adjustment
    return 0.5, 0.0


def action_type_score(action_type: str | None, feedback_adjustments: dict[str, dict[str, float]]) -> tuple[float, float]:
    mapping = {
        "replace_link": 0.9,
        "create_partial_link": 0.8,
        "import_candidate_seed": 0.75,
        "convert_to_partial": 0.7,
        "downgrade_link": 0.6,
    }
    key = str(action_type or "").strip().lower()
    adjustment = feedback_adjustments.get("action_type", {}).get(key, 0.0)
    return max(0.0, min(1.0, mapping.get(key, 0.5) + adjustment)), adjustment


def current_congress_reference() -> int:
    return ((datetime.now(UTC).year - 1789) // 2) + 1


def recency_score(action: dict[str, Any]) -> float:
    congress = parse_congress_value(action)
    if congress is None:
        return 0.5
    current = current_congress_reference()
    if congress >= current:
        return 1.0
    gap = max(0, current - congress)
    return max(0.25, 1.0 - (0.2 * gap))


def existing_link_penalty(action: dict[str, Any]) -> float:
    if action.get("future_bill_link_id") is not None:
        return 1.0
    if action.get("current_tracked_bill_id") is not None:
        return 1.0
    if action.get("target_type") == "future_bill_link":
        return 1.0
    return 0.0


def score_action(action: dict[str, Any], feedback_adjustments: dict[str, dict[str, float]]) -> None:
    match_score = normalize_match_confidence(action)
    link_score, link_adjustment = link_type_score(action, feedback_adjustments)
    type_score, type_adjustment = action_type_score(action.get("action_type"), feedback_adjustments)
    recency = recency_score(action)
    penalty_flag = existing_link_penalty(action)
    score = (
        (0.35 * match_score)
        + (0.30 * link_score)
        + (0.20 * type_score)
        + (0.10 * recency)
        - (0.05 * penalty_flag)
    )
    clamped = max(0.0, min(1.0, score))
    if clamped >= 0.80:
        priority = "High"
    elif clamped >= 0.60:
        priority = "Medium"
    else:
        priority = "Low"

    action["action_score"] = round(clamped, 3)
    action["action_priority"] = priority
    action["score_breakdown"] = {
        "match_confidence": round(match_score, 3),
        "link_type_score": round(link_score, 3),
        "action_type_score": round(type_score, 3),
        "recency_score": round(recency, 3),
        "existing_link_penalty": round(penalty_flag, 3),
        "penalty": round(-0.05 * penalty_flag, 3),
        "feedback_adjustments": {
            "action_type_adjustment": round(type_adjustment, 3),
            "link_type_adjustment": round(link_adjustment, 3),
        },
        "weights": {
            "match_confidence": 0.35,
            "link_type_score": 0.30,
            "action_type_score": 0.20,
            "recency_score": 0.10,
            "existing_link_penalty": -0.05,
        },
    }


def reconcile_action_with_apply_report(
    action: dict[str, Any],
    applied_actions_by_id: dict[str, dict[str, Any]],
) -> bool:
    action_id = action.get("action_id")
    if action_id is None:
        return False
    applied = applied_actions_by_id.get(str(action_id))
    if not applied:
        return False
    action["approved"] = True
    action["status"] = "applied"
    action["review_state"] = "already_applied"
    action["apply_result"] = str(applied.get("result") or "applied")
    if action.get("applied_at") in (None, ""):
        action["applied_at"] = applied.get("timestamp")
    return True


def historical_action_from_apply_report(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "action_id": item.get("action_id"),
        "action_type": item.get("action_type"),
        "target_type": item.get("target_type"),
        "target_id": item.get("target_id"),
        "payload": item.get("payload") or {},
        "status": "applied",
        "approved": True,
        "approved_by": item.get("applied_by"),
        "approved_at": item.get("approved_at"),
        "applied_at": item.get("timestamp"),
        "apply_result": str(item.get("result") or "applied"),
        "source": "equitystack_apply_report",
        "rationale": item.get("message") or item.get("reason"),
        "review_state": "already_applied",
        "future_bill_id": item.get("future_bill_id"),
        "future_bill_link_id": item.get("future_bill_link_id"),
        "current_tracked_bill_id": item.get("tracked_bill_id"),
        "candidate_tracked_bill_id": item.get("candidate_tracked_bill_id"),
        "candidate_bill_number": item.get("candidate_bill_number"),
        "candidate_title": item.get("candidate_title"),
        "proposed_link_type": item.get("new_link_type") or item.get("proposed_link_type"),
        "raw_data": item,
    }


def finalize_operator_actions(
    group: dict[str, Any],
    applied_actions_by_id: dict[str, dict[str, Any]],
    feedback_adjustments: dict[str, dict[str, float]],
) -> None:
    by_link_id, by_pair = live_state_index(group)
    action_seen = set()
    unique_actions = []
    actionable_actions = []
    all_candidate_actions = list(group["_pending_actions"]) + list(group["_historical_actions"])
    for action in all_candidate_actions:
        payload = action.get("payload") or {}
        review_state = str(action.get("review_state") or "actionable")
        signature = (
            action.get("action_type"),
            action.get("target_type"),
            action.get("target_id"),
            json.dumps(action.get("payload"), sort_keys=True, default=str),
        )
        if signature in action_seen:
            continue
        action_seen.add(signature)

        if action.get("status") == "applied" or action.get("review_state") == "already_applied":
            action["approved"] = True
            action["status"] = "applied"
            action["review_state"] = "already_applied"
            action.setdefault("apply_result", "applied")
            review_state = "already_applied"
        elif reconcile_action_with_apply_report(action, applied_actions_by_id):
            review_state = "already_applied"
        elif action.get("action_type") == "remove_direct_link":
            future_bill_link_id = payload.get("future_bill_link_id")
            if future_bill_link_id is None or int(future_bill_link_id) not in by_link_id:
                review_state = "already_applied"
        elif action.get("action_type") == "convert_to_partial":
            future_bill_link_id = payload.get("future_bill_link_id")
            live = by_link_id.get(int(future_bill_link_id)) if future_bill_link_id is not None else None
            if live and str(live.get("link_type")) == "Partial":
                review_state = "already_applied"
            elif not live:
                review_state = "stale"
        elif action.get("action_type") == "create_partial_link":
            tracked_bill_id = payload.get("tracked_bill_id")
            live = by_pair.get((int(group["future_bill_id"]), int(tracked_bill_id))) if tracked_bill_id is not None else None
            if live and str(live.get("link_type")) == "Partial":
                review_state = "already_applied"
            elif live:
                review_state = "superseded"
        elif action.get("action_type") == "import_candidate_seed":
            # Discovery actions are already filtered for actionability earlier.
            review_state = "actionable"

        if review_state == "already_applied":
            action["approved"] = True
            action["status"] = "applied"
            action.setdefault("apply_result", "applied")
        elif review_state != "actionable" and action.get("status") == "pending":
            action["status"] = review_state

        action["review_state"] = review_state
        score_action(action, feedback_adjustments)
        unique_actions.append(action)
        if review_state == "actionable":
            actionable_actions.append(action)
        else:
            mark_counts(group, review_state)

    group["operator_actions"] = unique_actions
    group["actionable_operator_actions_count"] = len(actionable_actions)
    group["_actionable_operator_actions"] = actionable_actions


def main() -> None:
    args = parse_args()
    output_path = args.output.resolve()
    csv_path = derive_csv_path(args.csv, output_path)
    wanted_future_bill_ids = set(args.only_future_bill_id or [])

    ai_review = load_optional_json(args.ai_review.resolve())
    apply_report = load_optional_json(args.apply_report.resolve())
    manual_queue = load_optional_json(args.manual_queue.resolve())
    suggestions = load_optional_json(args.suggestions.resolve())
    discovery = load_optional_json(args.discovery.resolve())
    feedback_adjustments = load_feedback_adjustments(default_feedback_analysis_path()) if args.use_feedback else {"action_type": {}, "link_type": {}}

    ai_by_link_id: dict[int, dict[str, Any]] = {}
    applied_actions_by_id = index_apply_report_actions(apply_report)
    groups: dict[int, dict[str, Any]] = {}
    normalization_summary = init_normalization_summary()
    skipped_items: list[dict[str, Any]] = []

    def ensure_group(future_bill_id: int) -> dict[str, Any]:
        if future_bill_id not in groups:
            groups[future_bill_id] = future_bill_group_template(future_bill_id)
        return groups[future_bill_id]

    if ai_review:
        for item in report_items(ai_review, "items"):
            normalization_summary["rows_seen"] += 1
            future_bill_id = resolve_future_bill_id(item)
            if future_bill_id is None:
                register_skip(skipped_items, normalization_summary, "ai_review", item, "missing future_bill_id")
                continue
            if wanted_future_bill_ids and future_bill_id not in wanted_future_bill_ids:
                continue
            group = ensure_group(future_bill_id)
            group["future_bill_title"] = group["future_bill_title"] or item.get("future_bill_title")
            group["target_area"] = group["target_area"] or item.get("target_area")
            group["ai_review"].append(item)
            normalization_summary["rows_grouped"] += 1
            future_bill_link_id = coerce_int(item.get("future_bill_link_id"))
            if future_bill_link_id is not None:
                ai_by_link_id[future_bill_link_id] = item

    if apply_report:
        for item in report_items(apply_report, "actions", "applied_actions"):
            normalization_summary["rows_seen"] += 1
            future_bill_link_id = coerce_int(item.get("future_bill_link_id"))
            source_item = ai_by_link_id.get(future_bill_link_id) if future_bill_link_id is not None else None
            future_bill_id = resolve_future_bill_id(source_item or item)
            if future_bill_id is None:
                register_skip(skipped_items, normalization_summary, "apply_report", item, "missing future_bill_id")
                continue
            if wanted_future_bill_ids and future_bill_id not in wanted_future_bill_ids:
                continue
            group = ensure_group(future_bill_id)
            group["future_bill_title"] = group["future_bill_title"] or (source_item or {}).get("future_bill_title")
            group["target_area"] = group["target_area"] or (source_item or {}).get("target_area")
            group["safe_apply"].append(item)
            normalization_summary["rows_grouped"] += 1
            if item.get("status") == "eligible_dry_run":
                group["_pending_actions"].append(
                    action_candidate(
                        action_type="remove_direct_link",
                        target_type="future_bill_link",
                        target_id=future_bill_link_id,
                        payload={"future_bill_link_id": future_bill_link_id},
                        future_bill_id=future_bill_id,
                        future_bill_link_id=future_bill_link_id,
                        current_tracked_bill_id=(source_item or {}).get("tracked_bill_id"),
                        candidate_tracked_bill_id=None,
                        candidate_bill_number=item.get("bill_number"),
                        candidate_title=item.get("tracked_bill_title"),
                        proposed_link_type=None,
                        rationale="Safe removal candidate from the dry-run apply layer.",
                        source="future_bill_link_ai_apply_report",
                        raw_data=item,
                    )
                )

        if str(apply_report.get("mode") or "").lower() == "apply":
            for item in report_items(apply_report, "applied_actions"):
                normalization_summary["rows_seen"] += 1
                future_bill_id = resolve_future_bill_id(item)
                if future_bill_id is None:
                    register_skip(skipped_items, normalization_summary, "apply_report_applied_actions", item, "missing future_bill_id")
                    continue
                if wanted_future_bill_ids and future_bill_id not in wanted_future_bill_ids:
                    continue
                group = ensure_group(future_bill_id)
                group["_historical_actions"].append(historical_action_from_apply_report(item))
                normalization_summary["rows_grouped"] += 1

    if manual_queue:
        for item in report_items(manual_queue, "items"):
            normalization_summary["rows_seen"] += 1
            future_bill_link_id = coerce_int(item.get("future_bill_link_id"))
            source_item = ai_by_link_id.get(future_bill_link_id) if future_bill_link_id is not None else None
            future_bill_id = resolve_future_bill_id(source_item or item)
            if future_bill_id is None:
                register_skip(skipped_items, normalization_summary, "manual_queue", item, "missing future_bill_id")
                continue
            if wanted_future_bill_ids and future_bill_id not in wanted_future_bill_ids:
                continue
            group = ensure_group(future_bill_id)
            group["future_bill_title"] = group["future_bill_title"] or (source_item or {}).get("future_bill_title")
            group["target_area"] = group["target_area"] or (source_item or {}).get("target_area")
            group["manual_review_queue"].append(item)
            normalization_summary["rows_grouped"] += 1
            if item.get("final_decision") == "remove_link":
                group["_pending_actions"].append(
                    action_candidate(
                        action_type="remove_direct_link",
                        target_type="future_bill_link",
                        target_id=future_bill_link_id,
                        payload={"future_bill_link_id": future_bill_link_id},
                        future_bill_id=future_bill_id,
                        future_bill_link_id=future_bill_link_id,
                        current_tracked_bill_id=(source_item or {}).get("tracked_bill_id"),
                        candidate_tracked_bill_id=None,
                        candidate_bill_number=item.get("bill_number"),
                        candidate_title=item.get("tracked_bill_title"),
                        proposed_link_type=None,
                        rationale="Manual removal review candidate from the manual review queue.",
                        source="future_bill_link_manual_review_queue",
                        raw_data=item,
                    )
                )

    if suggestions:
        for item in report_items(suggestions, "items"):
            normalization_summary["rows_seen"] += 1
            future_bill_id = resolve_future_bill_id(item)
            if future_bill_id is None:
                register_skip(skipped_items, normalization_summary, "suggestions", item, "missing future_bill_id")
                continue
            if wanted_future_bill_ids and future_bill_id not in wanted_future_bill_ids:
                continue
            group = ensure_group(future_bill_id)
            group["future_bill_title"] = group["future_bill_title"] or item.get("future_bill_title")
            current_future_bill_link_id = coerce_int(item.get("current_future_bill_link_id"))
            source_item = ai_by_link_id.get(current_future_bill_link_id) if current_future_bill_link_id is not None else None
            group["target_area"] = group["target_area"] or (source_item or {}).get("target_area")
            group["partial_suggestions"].append(item)
            normalization_summary["rows_grouped"] += 1

    if discovery:
        for item in report_items(discovery, "items"):
            normalization_summary["rows_seen"] += 1
            future_bill_id = resolve_future_bill_id(item)
            if future_bill_id is None:
                register_skip(skipped_items, normalization_summary, "discovery", item, "missing future_bill_id")
                continue
            if wanted_future_bill_ids and future_bill_id not in wanted_future_bill_ids:
                continue
            group = ensure_group(future_bill_id)
            group["future_bill_title"] = group["future_bill_title"] or item.get("future_bill_title")
            group["target_area"] = group["target_area"] or item.get("target_area")
            group["candidate_discovery"].append(item)
            normalization_summary["rows_grouped"] += 1

    if apply_report:
        for future_bill_id in apply_report.get("affected_future_bill_ids") or []:
            future_bill_id = coerce_int(future_bill_id)
            if future_bill_id is None:
                continue
            if wanted_future_bill_ids and future_bill_id not in wanted_future_bill_ids:
                continue
            ensure_group(future_bill_id)

    populate_live_current_links(groups)

    deduped_groups = []
    pending_actions_index = []
    for group in sorted(groups.values(), key=lambda row: row["future_bill_id"]):
        seen_links = set()
        unique_links = []
        for row in group["current_links"]:
            key = (row.get("future_bill_link_id"), row.get("tracked_bill_id"))
            if key in seen_links:
                continue
            seen_links.add(key)
            unique_links.append(row)
        group["current_links"] = unique_links
        reconcile_safe_apply_and_manual(group)
        reconcile_partial_suggestions(group)
        reconcile_candidate_discovery(group)
        finalize_operator_actions(group, applied_actions_by_id, feedback_adjustments)
        group["recommended_operator_action"] = choose_group_action(group)
        group["priority_level"] = choose_priority(group)
        group["status"] = "actionable" if group["actionable_operator_actions_count"] else "informational"
        group.pop("_historical_actions", None)
        group.pop("_pending_actions", None)
        actionable_actions = group.pop("_actionable_operator_actions", [])
        deduped_groups.append(group)
        pending_actions_index.extend(actionable_actions)

    payload = {
        "generated_at": datetime.now(UTC).isoformat(),
        "pipeline_run_id": datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ"),
        "environment": {
            "python_dir": str(python_dir()),
            "reports_dir": str(reports_dir()),
        },
        "inputs": {
            "ai_review": str(args.ai_review.resolve()) if ai_review is not None else None,
            "apply_report": str(args.apply_report.resolve()) if apply_report is not None else None,
            "manual_queue": str(args.manual_queue.resolve()) if manual_queue is not None else None,
            "suggestions": str(args.suggestions.resolve()) if suggestions is not None else None,
            "discovery": str(args.discovery.resolve()) if discovery is not None else None,
            "feedback_analysis": str(default_feedback_analysis_path()) if args.use_feedback else None,
        },
        "normalization_summary": normalization_summary,
        "skipped_items": skipped_items,
        "summary": {
            "future_bills_reviewed": len(deduped_groups),
            "future_bills_in_bundle": len(deduped_groups),
            "total_actions": sum(len(group["operator_actions"]) for group in deduped_groups),
            "safe_auto_removals_available": sum(1 for action in pending_actions_index if action["action_type"] == "remove_direct_link"),
            "manual_review_items": sum(
                1
                for group in deduped_groups
                for item in group["manual_review_queue"]
                if str(item.get("review_state") or "actionable") == "actionable"
            ),
            "partial_candidates": sum(1 for action in pending_actions_index if action["action_type"] in {"convert_to_partial", "create_partial_link"}),
            "discovery_candidates": sum(1 for action in pending_actions_index if action["action_type"] == "import_candidate_seed"),
            "items_requiring_operator_action": len(pending_actions_index),
            "total_applied_actions": sum(
                1
                for group in deduped_groups
                for action in group["operator_actions"]
                if action.get("status") == "applied" or action.get("review_state") == "already_applied"
            ),
            "total_actionable_operator_actions": sum(group["actionable_operator_actions_count"] for group in deduped_groups),
            "total_skipped": sum(
                1
                for group in deduped_groups
                for action in group["operator_actions"]
                if action.get("status") in {"dismissed", "stale", "superseded"}
                or action.get("review_state") in {"dismissed", "stale", "superseded"}
            ),
            "total_stale": sum(group["stale_suggestions_count"] for group in deduped_groups),
            "total_stale_suggestions": sum(group["stale_suggestions_count"] for group in deduped_groups),
            "total_already_applied": sum(group["already_applied_count"] for group in deduped_groups),
            "total_suppressed_weak_candidates": sum(group["suppressed_weak_candidates_count"] for group in deduped_groups),
            "feedback_adjustments_applied": feedback_adjustments,
        },
        "future_bill_groups": deduped_groups,
        "pending_actions_index": pending_actions_index,
        "apply_defaults": {
            "default_mode": "dry_run",
            "require_apply_flag": True,
            "require_yes_flag": True,
        },
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, indent=2, default=str))
    print(f"Wrote review bundle to {output_path}")

    if csv_path:
        rows = []
        for group in deduped_groups:
            for action in group["operator_actions"]:
                rows.append(
                    {
                        "future_bill_id": group["future_bill_id"],
                        "future_bill_title": group["future_bill_title"],
                        "target_area": group["target_area"],
                        "priority_level": group["priority_level"],
                        "recommended_operator_action": group["recommended_operator_action"],
                        "action_id": action.get("action_id"),
                        "action_type": action.get("action_type"),
                        "target_type": action.get("target_type"),
                        "target_id": action.get("target_id"),
                        "status": action.get("status"),
                        "review_state": action.get("review_state"),
                        "action_score": action.get("action_score"),
                        "action_priority": action.get("action_priority"),
                        "safe_apply_rows": len(group["safe_apply"]),
                        "manual_review_rows": len(group["manual_review_queue"]),
                        "partial_suggestion_rows": len(group["partial_suggestions"]),
                        "discovery_rows": len(group["candidate_discovery"]),
                        "operator_actions": len(group["operator_actions"]),
                        "actionable_operator_actions_count": group["actionable_operator_actions_count"],
                        "stale_suggestions_count": group["stale_suggestions_count"],
                        "already_applied_count": group["already_applied_count"],
                        "suppressed_weak_candidates_count": group["suppressed_weak_candidates_count"],
                    }
                )
        rows.sort(
            key=lambda row: (
                -(float(row["action_score"]) if row.get("action_score") is not None else -1.0),
                str(row.get("action_priority") or ""),
                row["future_bill_id"],
                str(row.get("action_id") or ""),
            )
        )
        with csv_path.open("w", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()) if rows else [
                "future_bill_id",
                "future_bill_title",
                "target_area",
                "priority_level",
                "recommended_operator_action",
                "action_id",
                "action_type",
                "target_type",
                "target_id",
                "status",
                "review_state",
                "action_score",
                "action_priority",
                "safe_apply_rows",
                "manual_review_rows",
                "partial_suggestion_rows",
                "discovery_rows",
                "operator_actions",
                "actionable_operator_actions_count",
                "stale_suggestions_count",
                "already_applied_count",
                "suppressed_weak_candidates_count",
            ])
            writer.writeheader()
            for row in rows:
                writer.writerow(row)
        print(f"Wrote review bundle CSV to {csv_path}")


if __name__ == "__main__":
    main()
