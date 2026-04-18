#!/usr/bin/env python3
import argparse
from collections import defaultdict
from pathlib import Path
from typing import Any

from current_admin_common import (
    get_db_connection,
    get_reports_dir,
    normalize_nullable_text,
    print_json,
    require_apply_confirmation,
    utc_timestamp,
    write_json_file,
)
from policy_outcome_source_common import (
    ensure_policy_outcome_sources_table,
    link_policy_outcome_source,
    sync_policy_outcome_source_metadata,
)


SAFE_AUTO_LINK = "safe_auto_link"
OPERATOR_REVIEW_REQUIRED = "operator_review_required"
NO_CANDIDATE_FOUND = "no_candidate_found"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Audit and optionally backfill canonical policy_outcome_sources links from trusted same-promise context."
    )
    parser.add_argument("--output", type=Path, help="Candidate backfill report JSON path")
    parser.add_argument("--apply", action="store_true", help="Insert safe_auto_link canonical source links")
    parser.add_argument("--yes", action="store_true", help="Required confirmation for --apply")
    parser.add_argument("--limit", type=int, help="Limit the number of unsourced outcomes audited")
    parser.add_argument("--only-policy-outcome-id", type=int, action="append", help="Audit one or more policy_outcomes.id values")
    return parser.parse_args()


def default_output_path(apply: bool) -> Path:
    suffix = "apply" if apply else "dry-run"
    return get_reports_dir() / f"policy-outcome-source-backfill.{suffix}.json"


def fetch_unsourced_policy_outcomes(cursor, only_ids: list[int] | None, limit: int | None) -> list[dict[str, Any]]:
    params: list[Any] = []
    filters = [
        "po.policy_type = 'current_admin'",
        """
        NOT EXISTS (
          SELECT 1
          FROM policy_outcome_sources pos
          WHERE pos.policy_outcome_id = po.id
        )
        """,
    ]
    if only_ids:
        placeholders = ", ".join(["%s"] * len(only_ids))
        filters.append(f"po.id IN ({placeholders})")
        params.extend(only_ids)
    sql = f"""
        SELECT
          po.id AS policy_outcome_id,
          po.policy_id AS promise_id,
          po.record_key,
          po.outcome_summary,
          po.impact_direction,
          po.evidence_strength,
          p.slug AS promise_slug,
          p.title AS promise_title
        FROM policy_outcomes po
        JOIN promises p ON p.id = po.policy_id
        WHERE {" AND ".join(filters)}
        ORDER BY po.id ASC
    """
    if limit is not None and limit > 0:
        sql += "\nLIMIT %s"
        params.append(limit)
    cursor.execute(sql, params)
    return list(cursor.fetchall() or [])


def fetch_same_promise_context_sources(cursor, promise_ids: list[int]) -> dict[int, list[dict[str, Any]]]:
    if not promise_ids:
        return {}
    placeholders = ", ".join(["%s"] * len(promise_ids))
    cursor.execute(
        f"""
        SELECT
          ctx.promise_id,
          s.id AS source_id,
          s.source_title,
          s.source_url,
          s.source_type,
          s.publisher,
          s.published_date,
          ctx.link_type
        FROM (
          SELECT ps.promise_id, ps.source_id, 'promise' AS link_type
          FROM promise_sources ps
          WHERE ps.promise_id IN ({placeholders})
          UNION ALL
          SELECT pa.promise_id, pas.source_id, 'action' AS link_type
          FROM promise_actions pa
          JOIN promise_action_sources pas ON pas.promise_action_id = pa.id
          WHERE pa.promise_id IN ({placeholders})
          UNION ALL
          SELECT po.policy_id AS promise_id, pos.source_id, 'outcome' AS link_type
          FROM policy_outcomes po
          JOIN policy_outcome_sources pos ON pos.policy_outcome_id = po.id
          WHERE po.policy_type = 'current_admin'
            AND po.policy_id IN ({placeholders})
        ) ctx
        JOIN sources s ON s.id = ctx.source_id
        ORDER BY ctx.promise_id ASC, s.id ASC
        """,
        promise_ids * 3,
    )
    grouped: dict[int, dict[int, dict[str, Any]]] = defaultdict(dict)
    for row in cursor.fetchall() or []:
        promise_id = int(row["promise_id"])
        source_id = int(row["source_id"])
        grouped[promise_id].setdefault(
            source_id,
            {
                "source_id": source_id,
                "source_title": normalize_nullable_text(row.get("source_title")),
                "source_url": normalize_nullable_text(row.get("source_url")),
                "source_type": normalize_nullable_text(row.get("source_type")),
                "publisher": normalize_nullable_text(row.get("publisher")),
                "published_date": str(row["published_date"]) if row.get("published_date") is not None else None,
                "link_types": [],
            },
        )
        grouped[promise_id][source_id]["link_types"].append(str(row.get("link_type") or "unknown"))
    return {promise_id: list(sources.values()) for promise_id, sources in grouped.items()}


def build_candidate(row: dict[str, Any], promise_sources: dict[int, list[dict[str, Any]]]) -> dict[str, Any]:
    promise_id = int(row["promise_id"])
    candidates = promise_sources.get(promise_id, [])
    if len(candidates) == 1:
        return {
            "policy_outcome_id": int(row["policy_outcome_id"]),
            "promise_id": promise_id,
            "promise_slug": row.get("promise_slug"),
            "promise_title": row.get("promise_title"),
            "outcome_summary": row.get("outcome_summary"),
            "decision": SAFE_AUTO_LINK,
            "candidate_source": candidates[0],
            "candidate_count": 1,
        }
    if len(candidates) > 1:
        return {
            "policy_outcome_id": int(row["policy_outcome_id"]),
            "promise_id": promise_id,
            "promise_slug": row.get("promise_slug"),
            "promise_title": row.get("promise_title"),
            "outcome_summary": row.get("outcome_summary"),
            "decision": OPERATOR_REVIEW_REQUIRED,
            "candidate_sources": candidates,
            "candidate_count": len(candidates),
        }
    return {
        "policy_outcome_id": int(row["policy_outcome_id"]),
        "promise_id": promise_id,
        "promise_slug": row.get("promise_slug"),
        "promise_title": row.get("promise_title"),
        "outcome_summary": row.get("outcome_summary"),
        "decision": NO_CANDIDATE_FOUND,
        "candidate_count": 0,
    }


def build_report(args: argparse.Namespace) -> dict[str, Any]:
    require_apply_confirmation(args.apply, args.yes)
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            ensure_policy_outcome_sources_table(cursor)
            outcomes = fetch_unsourced_policy_outcomes(cursor, args.only_policy_outcome_id, args.limit)
            promise_sources = fetch_same_promise_context_sources(
                cursor,
                sorted({int(row["promise_id"]) for row in outcomes}),
            )
            candidates = [build_candidate(row, promise_sources) for row in outcomes]
            applied = []
            if args.apply:
                for candidate in candidates:
                    if candidate["decision"] != SAFE_AUTO_LINK:
                        continue
                    source_id = int(candidate["candidate_source"]["source_id"])
                    link_policy_outcome_source(cursor, int(candidate["policy_outcome_id"]), source_id)
                    metadata = sync_policy_outcome_source_metadata(
                        cursor, int(candidate["policy_outcome_id"])
                    )
                    applied.append({**candidate, "applied_source_id": source_id, "metadata": metadata})
                connection.commit()
            else:
                connection.rollback()

        return {
            "workflow": "policy_outcome_source_backfill",
            "mode": "apply" if args.apply else "dry_run",
            "generated_at": utc_timestamp(),
            "scope": {
                "tables": ["policy_outcomes", "policy_outcome_sources"],
                "source_context_tables": ["promise_sources", "promise_action_sources", "policy_outcome_sources"],
            },
            "summary": {
                "unsourced_policy_outcomes": len(outcomes),
                "safe_auto_link_candidates": sum(1 for candidate in candidates if candidate["decision"] == SAFE_AUTO_LINK),
                "operator_review_required": sum(1 for candidate in candidates if candidate["decision"] == OPERATOR_REVIEW_REQUIRED),
                "no_candidate_found": sum(1 for candidate in candidates if candidate["decision"] == NO_CANDIDATE_FOUND),
                "links_applied": len(applied),
            },
            "candidates": candidates,
            "applied": applied,
        }
    finally:
        connection.close()


def main() -> None:
    args = parse_args()
    output_path = (args.output or default_output_path(args.apply)).resolve()
    report = build_report(args)
    write_json_file(output_path, report)
    print_json({"ok": True, "output": str(output_path), **report["summary"]})


if __name__ == "__main__":
    main()
