#!/usr/bin/env python3
import argparse
import json
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Any

from current_admin_common import (
    get_db_connection,
    get_reports_dir,
    normalize_date,
    normalize_nullable_text,
    print_json,
    require_apply_confirmation,
    utc_timestamp,
    write_json_file,
)


DATE_COLUMN_CANDIDATES = ("outcome_date", "effective_date")
DATE_TYPE_COLUMNS = ("outcome_date_type", "temporal_attribution_type")
DATE_CONFIDENCE_COLUMNS = ("outcome_date_confidence", "temporal_attribution_confidence")
DATE_PROVENANCE_COLUMNS = ("outcome_date_provenance", "temporal_attribution_provenance")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Read-only audit and optional safe backfill for outcome temporal attribution."
    )
    parser.add_argument("--output", type=Path, help="Temporal attribution report JSON path")
    parser.add_argument("--apply", action="store_true", help="Backfill exact/high-confidence dates when schema supports it")
    parser.add_argument("--yes", action="store_true", help="Required confirmation for --apply")
    parser.add_argument("--limit", type=int, help="Limit audited promise_outcomes rows")
    parser.add_argument("--only-outcome-id", type=int, action="append", help="Audit one or more promise_outcomes.id values")
    parser.add_argument(
        "--include-policy-outcomes",
        action="store_true",
        help="Also audit existing policy_outcomes rows when the table exists",
    )
    return parser.parse_args()


def default_output_path(apply: bool) -> Path:
    suffix = "apply" if apply else "dry-run"
    return get_reports_dir() / f"outcome-temporal-attribution.{suffix}.json"


def safe_int(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def valid_date(value: Any) -> str | None:
    normalized = normalize_date(value)
    if not normalized:
        return None
    try:
        date.fromisoformat(normalized[:10])
    except (TypeError, ValueError):
        return None
    return normalized[:10]


def token_set(value: Any) -> set[str]:
    text = normalize_nullable_text(value)
    if text is None:
        return set()
    tokens = set()
    for raw in text.lower().replace("-", " ").split():
        token = "".join(ch for ch in raw if ch.isalnum())
        if len(token) >= 4:
            tokens.add(token)
    return tokens


def text_overlap(left: Any, right: Any) -> float:
    left_tokens = token_set(left)
    right_tokens = token_set(right)
    if not left_tokens or not right_tokens:
        return 0.0
    return len(left_tokens & right_tokens) / len(left_tokens | right_tokens)


def get_table_columns(cursor, table_name: str) -> set[str]:
    cursor.execute(f"SHOW COLUMNS FROM {table_name}")
    return {row["Field"] for row in cursor.fetchall() or []}


def table_exists(cursor, table_name: str) -> bool:
    cursor.execute("SHOW TABLES LIKE %s", (table_name,))
    return cursor.fetchone() is not None


def first_existing_column(columns: set[str], candidates: tuple[str, ...]) -> str | None:
    for candidate in candidates:
        if candidate in columns:
            return candidate
    return None


def fetch_promise_outcomes(cursor, columns: set[str], only_ids: list[int] | None, limit: int | None) -> list[dict[str, Any]]:
    dynamic_fields = []
    for column in DATE_COLUMN_CANDIDATES + DATE_TYPE_COLUMNS + DATE_CONFIDENCE_COLUMNS + DATE_PROVENANCE_COLUMNS:
        if column in columns:
            dynamic_fields.append(f"po.{column}")
    dynamic_sql = f", {', '.join(dynamic_fields)}" if dynamic_fields else ""

    params: list[Any] = []
    filters = []
    if only_ids:
        placeholders = ", ".join(["%s"] * len(only_ids))
        filters.append(f"po.id IN ({placeholders})")
        params.extend(only_ids)
    where = f"WHERE {' AND '.join(filters)}" if filters else ""
    sql = f"""
        SELECT
          po.id,
          po.promise_id,
          po.outcome_summary,
          po.outcome_type,
          po.measurable_impact,
          po.impact_direction,
          po.evidence_strength,
          po.status_override,
          p.slug AS promise_slug,
          p.title AS promise_title,
          p.promise_date
          {dynamic_sql}
        FROM promise_outcomes po
        JOIN promises p ON p.id = po.promise_id
        {where}
        ORDER BY po.id ASC
    """
    if limit is not None and limit > 0:
        sql += "\nLIMIT %s"
        params.append(limit)
    cursor.execute(sql, params)
    return list(cursor.fetchall() or [])


def fetch_actions_by_promise(cursor, promise_ids: list[int]) -> dict[int, list[dict[str, Any]]]:
    if not promise_ids:
        return {}
    placeholders = ", ".join(["%s"] * len(promise_ids))
    cursor.execute(
        f"""
        SELECT id, promise_id, action_type, action_date, title, description
        FROM promise_actions
        WHERE promise_id IN ({placeholders})
          AND action_date IS NOT NULL
        ORDER BY promise_id ASC, action_date ASC, id ASC
        """,
        promise_ids,
    )
    actions: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for row in cursor.fetchall() or []:
        promise_id = safe_int(row.get("promise_id"))
        if promise_id is not None:
            actions[promise_id].append(row)
    return actions


def fetch_outcome_source_dates(cursor, outcome_ids: list[int]) -> dict[int, list[dict[str, Any]]]:
    if not outcome_ids:
        return {}
    placeholders = ", ".join(["%s"] * len(outcome_ids))
    cursor.execute(
        f"""
        SELECT
          pout.id AS promise_outcome_id,
          s.id AS source_id,
          s.source_title,
          s.source_url,
          s.publisher,
          s.published_date
        FROM promise_outcomes pout
        JOIN policy_outcomes po
          ON po.policy_type = 'current_admin'
         AND po.policy_id = pout.promise_id
         AND po.outcome_summary_hash = SHA2(TRIM(pout.outcome_summary), 256)
        JOIN policy_outcome_sources pos
          ON pos.policy_outcome_id = po.id
        JOIN sources s ON s.id = pos.source_id
        WHERE pout.id IN ({placeholders})
          AND s.published_date IS NOT NULL
        ORDER BY pout.id ASC, s.published_date ASC, s.id ASC
        """,
        outcome_ids,
    )
    sources: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for row in cursor.fetchall() or []:
        outcome_id = safe_int(row.get("promise_outcome_id"))
        if outcome_id is not None:
            sources[outcome_id].append(row)
    return sources


def fetch_policy_outcomes(cursor, columns: set[str]) -> list[dict[str, Any]]:
    dynamic_fields = []
    for column in DATE_COLUMN_CANDIDATES + DATE_TYPE_COLUMNS + DATE_CONFIDENCE_COLUMNS + DATE_PROVENANCE_COLUMNS:
        if column in columns:
            dynamic_fields.append(f"po.{column}")
    dynamic_sql = f", {', '.join(dynamic_fields)}" if dynamic_fields else ""
    cursor.execute(
        f"""
        SELECT
          po.id,
          po.policy_type,
          po.policy_id,
          po.record_key,
          po.outcome_summary,
          po.outcome_type,
          po.impact_direction,
          po.status,
          po.created_at,
          po.updated_at
          {dynamic_sql}
        FROM policy_outcomes po
        ORDER BY po.policy_type ASC, po.policy_id ASC, po.id ASC
        """
    )
    return list(cursor.fetchall() or [])


def existing_date_candidates(row: dict[str, Any], columns: set[str]) -> list[dict[str, Any]]:
    candidates = []
    for column in DATE_COLUMN_CANDIDATES:
        if column not in columns:
            continue
        value = valid_date(row.get(column))
        if value is None:
            continue
        candidates.append(
            {
                "date": value,
                "candidate_date_type": column,
                "source": "existing_outcome_column",
                "confidence": "exact",
                "rationale": f"{column} is already stored on the outcome row",
            }
        )
    return candidates


def action_date_candidates(row: dict[str, Any], actions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    candidates = []
    outcome_text = " ".join(
        filter(
            None,
            [
                normalize_nullable_text(row.get("outcome_summary")),
                normalize_nullable_text(row.get("measurable_impact")),
            ],
        )
    )
    for action in actions:
        action_date = valid_date(action.get("action_date"))
        if action_date is None:
            continue
        action_text = " ".join(
            filter(
                None,
                [
                    normalize_nullable_text(action.get("title")),
                    normalize_nullable_text(action.get("description")),
                    normalize_nullable_text(action.get("action_type")),
                ],
            )
        )
        overlap = text_overlap(outcome_text, action_text)
        confidence = "high" if overlap >= 0.45 else "medium" if len(actions) == 1 else "low"
        candidates.append(
            {
                "date": action_date,
                "candidate_date_type": "action_date",
                "source": "promise_actions",
                "source_record_id": safe_int(action.get("id")),
                "source_title": normalize_nullable_text(action.get("title")),
                "confidence": confidence,
                "rationale": (
                    f"action_date from action {action.get('id')} under the same promise; "
                    f"text_overlap={overlap:.2f}"
                ),
            }
        )
    return candidates


def source_date_candidates(sources: list[dict[str, Any]]) -> list[dict[str, Any]]:
    candidates = []
    distinct_dates = sorted({date for date in (valid_date(source.get("published_date")) for source in sources) if date})
    confidence = "medium" if len(distinct_dates) == 1 else "low"
    for source in sources:
        published_date = valid_date(source.get("published_date"))
        if published_date is None:
            continue
        candidates.append(
            {
                "date": published_date,
                "candidate_date_type": "source_published_date",
                "source": "policy_outcome_sources",
                "source_record_id": safe_int(source.get("source_id")),
                "source_title": normalize_nullable_text(source.get("source_title")),
                "source_url": normalize_nullable_text(source.get("source_url")),
                "confidence": confidence,
                "rationale": "source publication date is available, but it is not treated as real-world impact timing",
            }
        )
    return candidates


def choose_canonical_candidate(candidates: list[dict[str, Any]]) -> tuple[dict[str, Any] | None, str]:
    for date_type in ("outcome_date", "effective_date"):
        exact = [candidate for candidate in candidates if candidate["candidate_date_type"] == date_type]
        if exact:
            return exact[0], f"preferred explicit {date_type}"

    high_action = [
        candidate
        for candidate in candidates
        if candidate["candidate_date_type"] == "action_date" and candidate["confidence"] == "high"
    ]
    if high_action:
        return high_action[0], "high-confidence same-promise action date"

    medium_action = [
        candidate
        for candidate in candidates
        if candidate["candidate_date_type"] == "action_date" and candidate["confidence"] == "medium"
    ]
    if medium_action:
        return medium_action[0], "single-action same-promise action date"

    source_dates = [candidate for candidate in candidates if candidate["candidate_date_type"] == "source_published_date"]
    if source_dates:
        return source_dates[0], "source publication date only; keep unresolved for real-world outcome timing"

    return None, "no reliable temporal signal"


def classify_availability(candidates: list[dict[str, Any]], canonical: dict[str, Any] | None) -> str:
    types = {candidate["candidate_date_type"] for candidate in candidates}
    if "outcome_date" in types:
        return "exact_outcome_date_available"
    if "effective_date" in types:
        return "effective_date_available"
    if canonical and canonical["candidate_date_type"] == "action_date":
        return "action_date_only"
    if types == {"source_published_date"} or (not canonical and "source_published_date" in types):
        return "source_publication_date_only"
    return "no_reliable_temporal_signal"


def build_promise_outcome_items(
    rows: list[dict[str, Any]],
    columns: set[str],
    actions_by_promise: dict[int, list[dict[str, Any]]],
    sources_by_outcome: dict[int, list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    items = []
    for row in rows:
        outcome_id = int(row["id"])
        promise_id = int(row["promise_id"])
        candidates = [
            *existing_date_candidates(row, columns),
            *action_date_candidates(row, actions_by_promise.get(promise_id, [])),
            *source_date_candidates(sources_by_outcome.get(outcome_id, [])),
        ]
        canonical, rationale = choose_canonical_candidate(candidates)
        availability = classify_availability(candidates, canonical)
        recommended_field = None
        if canonical and canonical["candidate_date_type"] in {"outcome_date", "effective_date", "action_date"}:
            recommended_field = "outcome_date" if canonical["candidate_date_type"] != "effective_date" else "effective_date"
        items.append(
            {
                "record_type": "promise_outcome",
                "outcome_id": outcome_id,
                "record_key": f"promise_outcome:{outcome_id}",
                "promise_id": promise_id,
                "promise_slug": normalize_nullable_text(row.get("promise_slug")),
                "promise_title": normalize_nullable_text(row.get("promise_title")),
                "outcome_summary": normalize_nullable_text(row.get("outcome_summary")),
                "availability_class": availability,
                "candidate_dates": candidates[:20],
                "recommended_canonical_timing_field": recommended_field,
                "recommended_canonical_date": canonical["date"] if canonical and recommended_field else None,
                "recommended_candidate": canonical if canonical and recommended_field else None,
                "temporal_confidence": canonical["confidence"] if canonical else None,
                "rationale": rationale,
                "apply_eligible": bool(
                    canonical
                    and canonical["candidate_date_type"] in {"outcome_date", "effective_date", "action_date"}
                    and canonical["confidence"] in {"exact", "high"}
                ),
            }
        )
    return items


def build_policy_outcome_items(rows: list[dict[str, Any]], columns: set[str]) -> list[dict[str, Any]]:
    items = []
    for row in rows:
        candidates = existing_date_candidates(row, columns)
        canonical, rationale = choose_canonical_candidate(candidates)
        availability = classify_availability(candidates, canonical)
        items.append(
            {
                "record_type": "policy_outcome",
                "policy_outcome_id": int(row["id"]),
                "record_key": normalize_nullable_text(row.get("record_key")) or f"policy_outcome:{row['id']}",
                "policy_type": normalize_nullable_text(row.get("policy_type")),
                "policy_id": safe_int(row.get("policy_id")),
                "outcome_summary": normalize_nullable_text(row.get("outcome_summary")),
                "availability_class": availability,
                "candidate_dates": candidates,
                "recommended_canonical_timing_field": canonical["candidate_date_type"] if canonical else None,
                "recommended_canonical_date": canonical["date"] if canonical else None,
                "recommended_candidate": canonical,
                "temporal_confidence": canonical["confidence"] if canonical else None,
                "rationale": rationale,
                "apply_eligible": False,
            }
        )
    return items


def count_items(items: list[dict[str, Any]]) -> dict[str, int]:
    counts = {
        "outcomes_with_exact_dates": 0,
        "outcomes_with_effective_dates": 0,
        "outcomes_with_action_date_only": 0,
        "outcomes_with_source_date_only": 0,
        "outcomes_with_no_temporal_signal": 0,
    }
    for item in items:
        availability = item["availability_class"]
        if availability == "exact_outcome_date_available":
            counts["outcomes_with_exact_dates"] += 1
        elif availability == "effective_date_available":
            counts["outcomes_with_effective_dates"] += 1
        elif availability == "action_date_only":
            counts["outcomes_with_action_date_only"] += 1
        elif availability == "source_publication_date_only":
            counts["outcomes_with_source_date_only"] += 1
        else:
            counts["outcomes_with_no_temporal_signal"] += 1
    return counts


def storage_capability(columns: set[str]) -> dict[str, Any]:
    return {
        "date_column": first_existing_column(columns, DATE_COLUMN_CANDIDATES),
        "date_type_column": first_existing_column(columns, DATE_TYPE_COLUMNS),
        "date_confidence_column": first_existing_column(columns, DATE_CONFIDENCE_COLUMNS),
        "date_provenance_column": first_existing_column(columns, DATE_PROVENANCE_COLUMNS),
    }


def can_backfill_with_storage(capability: dict[str, Any]) -> bool:
    return bool(
        capability.get("date_column")
        and capability.get("date_type_column")
        and capability.get("date_confidence_column")
        and capability.get("date_provenance_column")
    )


def apply_promise_outcome_backfill(
    cursor,
    items: list[dict[str, Any]],
    capability: dict[str, Any],
) -> tuple[int, int]:
    if not can_backfill_with_storage(capability):
        return 0, 0

    date_column = capability["date_column"]
    date_type_column = capability["date_type_column"]
    confidence_column = capability["date_confidence_column"]
    provenance_column = capability["date_provenance_column"]
    dates_backfilled = 0
    dates_preserved = 0

    for item in items:
        if not item.get("apply_eligible"):
            continue
        if item.get("recommended_canonical_timing_field") != date_column:
            continue
        outcome_id = item["outcome_id"]
        provenance = json.dumps(
            {
                "workflow": "outcome_temporal_attribution_audit",
                "generated_at": utc_timestamp(),
                "rationale": item.get("rationale"),
                "candidate_dates": item.get("candidate_dates", [])[:5],
            },
            sort_keys=True,
        )
        cursor.execute(
            f"""
            UPDATE promise_outcomes
            SET {date_column} = %s,
                {date_type_column} = %s,
                {confidence_column} = %s,
                {provenance_column} = %s
            WHERE id = %s
              AND {date_column} IS NULL
            """,
            (
                item["recommended_canonical_date"],
                (item.get("recommended_candidate") or {}).get("candidate_date_type") or "action_date",
                item.get("temporal_confidence"),
                provenance,
                outcome_id,
            ),
        )
        if int(cursor.rowcount or 0) > 0:
            dates_backfilled += 1
        else:
            dates_preserved += 1
    return dates_backfilled, dates_preserved


def build_report(args: argparse.Namespace) -> dict[str, Any]:
    connection = get_db_connection()
    dates_backfilled = 0
    dates_preserved = 0
    try:
        with connection.cursor() as cursor:
            promise_outcome_columns = get_table_columns(cursor, "promise_outcomes")
            policy_outcome_columns = get_table_columns(cursor, "policy_outcomes") if table_exists(cursor, "policy_outcomes") else set()
            promise_outcome_rows = fetch_promise_outcomes(
                cursor,
                promise_outcome_columns,
                args.only_outcome_id,
                args.limit,
            )
            promise_ids = sorted({int(row["promise_id"]) for row in promise_outcome_rows})
            outcome_ids = sorted({int(row["id"]) for row in promise_outcome_rows})
            promise_items = build_promise_outcome_items(
                promise_outcome_rows,
                promise_outcome_columns,
                fetch_actions_by_promise(cursor, promise_ids),
                fetch_outcome_source_dates(cursor, outcome_ids),
            )

            policy_items = []
            if args.include_policy_outcomes and policy_outcome_columns:
                policy_items = build_policy_outcome_items(fetch_policy_outcomes(cursor, policy_outcome_columns), policy_outcome_columns)

            promise_storage = storage_capability(promise_outcome_columns)
            policy_storage = storage_capability(policy_outcome_columns)
            apply_blockers = []
            if args.apply:
                if not can_backfill_with_storage(promise_storage):
                    apply_blockers.append(
                        "no suitable existing outcome/effective date/provenance columns were found on promise_outcomes; schema addition is required before backfill"
                    )
                    connection.rollback()
                else:
                    dates_backfilled, dates_preserved = apply_promise_outcome_backfill(
                        cursor,
                        promise_items,
                        promise_storage,
                    )
                    connection.commit()
            else:
                connection.rollback()

            all_items = [*promise_items, *policy_items]
            counts = count_items(all_items)
            apply_eligible_with_existing_schema = (
                sum(
                    1
                    for item in promise_items
                    if item.get("apply_eligible")
                    and item.get("recommended_canonical_timing_field") == promise_storage.get("date_column")
                )
                if can_backfill_with_storage(promise_storage)
                else 0
            )
            summary = {
                "promise_outcomes_audited": len(promise_items),
                "policy_outcomes_audited": len(policy_items),
                **counts,
                "dates_backfilled": dates_backfilled,
                "dates_preserved": dates_preserved,
                "apply_eligible_candidate_count": sum(1 for item in promise_items if item.get("apply_eligible")),
                "apply_eligible_with_existing_schema": apply_eligible_with_existing_schema,
                "apply_blocker_count": len(apply_blockers),
            }
            return {
                "workflow": "outcome_temporal_attribution_audit",
                "mode": "apply" if args.apply else "dry_run",
                "generated_at": utc_timestamp(),
                "scope": {
                    "source_tables": [
                        "promise_outcomes",
                        "promise_actions",
                        "policy_outcome_sources",
                        "sources",
                        "policy_outcomes",
                    ],
                    "mutation_policy": "read_only_by_default_no_fabricated_dates",
                    "temporal_rules": [
                        "prefer explicit outcome_date over effective_date",
                        "prefer explicit effective_date over action_date",
                        "use action_date only as a candidate when no better date exists",
                        "source published dates are provenance signals, not real-world impact timing",
                        "never treat created_at or updated_at as impact timing",
                        "leave canonical timing null when no trustworthy date exists",
                    ],
                    "storage_capability": {
                        "promise_outcomes": promise_storage,
                        "policy_outcomes": policy_storage,
                    },
                },
                "summary": summary,
                "items": all_items,
                "apply_blockers": apply_blockers,
                "minimal_schema_recommendation": {
                    "required_before_apply": True,
                    "promise_outcomes": [
                        "outcome_date DATE NULL",
                        "outcome_date_type ENUM('outcome_date','effective_date','action_date','source_published_date') NULL",
                        "outcome_date_confidence ENUM('exact','high','medium','low') NULL",
                        "outcome_date_provenance JSON NULL",
                    ],
                    "policy_outcomes": [
                        "outcome_date DATE NULL",
                        "effective_date DATE NULL",
                        "temporal_attribution_type ENUM('outcome_date','effective_date','action_date','source_published_date') NULL",
                        "temporal_attribution_confidence ENUM('exact','high','medium','low') NULL",
                        "temporal_attribution_provenance JSON NULL",
                    ],
                    "note": "Use JSON/TEXT provenance if JSON is not available in the target MySQL version.",
                },
                "future_scoring_recommendation": (
                    "Do not change scoring yet. Once canonical outcome/effective dates exist, expose time-window filters "
                    "and label long-tail outcomes separately from immediate administration actions before using dates in scoring."
                ),
            }
    finally:
        connection.close()


def main() -> None:
    args = parse_args()
    require_apply_confirmation(args.apply, args.yes)
    output_path = (args.output or default_output_path(args.apply)).resolve()
    report = build_report(args)
    write_json_file(output_path, report)
    print_json(
        {
            "ok": True,
            "mode": report["mode"],
            "output": str(output_path),
            **report["summary"],
            "apply_blockers": report["apply_blockers"],
        }
    )


if __name__ == "__main__":
    main()
