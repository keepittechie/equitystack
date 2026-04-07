#!/usr/bin/env python3
import argparse
from collections import defaultdict
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

from current_admin_common import (
    get_db_connection,
    get_reports_dir,
    normalize_nullable_text,
    normalize_text,
    print_json,
    require_apply_confirmation,
    slugify,
    utc_timestamp,
    write_json_file,
)


SAFE_AUTO_LINK = "safe_auto_link"
OPERATOR_REVIEW_REQUIRED = "operator_review_required"
NO_CANDIDATE_FOUND = "no_candidate_found"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Audit and optionally backfill missing promise_outcome_sources links from existing trusted source context."
    )
    parser.add_argument("--output", type=Path, help="Candidate backfill report JSON path")
    parser.add_argument("--apply", action="store_true", help="Insert safe_auto_link junction rows")
    parser.add_argument("--yes", action="store_true", help="Required confirmation for --apply")
    parser.add_argument("--limit", type=int, help="Limit the number of unsourced outcomes audited")
    parser.add_argument("--only-outcome-id", type=int, action="append", help="Audit one or more promise_outcomes.id values")
    return parser.parse_args()


def default_output_path(apply: bool) -> Path:
    suffix = "apply" if apply else "dry-run"
    return get_reports_dir() / f"promise-outcome-source-backfill.{suffix}.json"


def source_shape(row: dict[str, Any], link_type: str) -> dict[str, Any]:
    return {
        "source_id": int(row["source_id"]),
        "source_title": normalize_nullable_text(row.get("source_title")),
        "source_url": normalize_nullable_text(row.get("source_url")),
        "source_type": normalize_nullable_text(row.get("source_type")),
        "publisher": normalize_nullable_text(row.get("publisher")),
        "published_date": str(row.get("published_date")) if row.get("published_date") is not None else None,
        "link_type": link_type,
    }


def unique_sources(rows: list[dict[str, Any]], link_type: str) -> list[dict[str, Any]]:
    seen = set()
    sources = []
    for row in rows:
        source_id = int(row["source_id"])
        if source_id in seen:
            continue
        seen.add(source_id)
        sources.append(source_shape(row, link_type))
    return sources


def normalized_summary(value: Any) -> str:
    return slugify(value)


def text_similarity(left: Any, right: Any) -> float:
    left_text = normalize_text(left).lower()
    right_text = normalize_text(right).lower()
    if not left_text or not right_text:
        return 0.0
    if left_text == right_text:
        return 1.0
    return SequenceMatcher(None, left_text, right_text).ratio()


def fetch_unsourced_outcomes(cursor, only_ids: list[int] | None, limit: int | None) -> list[dict[str, Any]]:
    params: list[Any] = []
    filters = [
        """
        NOT EXISTS (
          SELECT 1
          FROM promise_outcome_sources pos
          WHERE pos.promise_outcome_id = po.id
        )
        """,
    ]
    if only_ids:
        placeholders = ", ".join(["%s"] * len(only_ids))
        filters.append(f"po.id IN ({placeholders})")
        params.extend(only_ids)

    sql = f"""
        SELECT
          po.id AS outcome_id,
          po.promise_id,
          po.outcome_summary,
          po.outcome_type,
          po.measurable_impact,
          po.impact_direction,
          po.evidence_strength,
          po.status_override,
          p.slug AS promise_slug,
          p.title AS promise_title,
          p.topic AS promise_topic,
          pr.slug AS president_slug,
          pr.full_name AS president_name
        FROM promise_outcomes po
        JOIN promises p ON p.id = po.promise_id
        JOIN presidents pr ON pr.id = p.president_id
        WHERE {" AND ".join(filters)}
        ORDER BY pr.term_start ASC, p.promise_date ASC, p.id ASC, po.id ASC
    """
    if limit is not None and limit > 0:
        sql += "\nLIMIT %s"
        params.append(limit)
    cursor.execute(sql, params)
    return list(cursor.fetchall() or [])


def fetch_promise_sources(cursor, promise_ids: list[int]) -> dict[int, list[dict[str, Any]]]:
    if not promise_ids:
        return {}
    placeholders = ", ".join(["%s"] * len(promise_ids))
    cursor.execute(
        f"""
        SELECT
          ps.promise_id,
          s.id AS source_id,
          s.source_title,
          s.source_url,
          s.source_type,
          s.publisher,
          s.published_date
        FROM promise_sources ps
        JOIN sources s ON s.id = ps.source_id
        WHERE ps.promise_id IN ({placeholders})
        ORDER BY ps.promise_id ASC, s.id ASC
        """,
        promise_ids,
    )
    grouped: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for row in list(cursor.fetchall() or []):
        grouped[int(row["promise_id"])].append(row)
    return {promise_id: unique_sources(rows, "promise") for promise_id, rows in grouped.items()}


def fetch_action_sources(cursor, promise_ids: list[int]) -> dict[int, list[dict[str, Any]]]:
    if not promise_ids:
        return {}
    placeholders = ", ".join(["%s"] * len(promise_ids))
    cursor.execute(
        f"""
        SELECT
          pa.promise_id,
          pa.id AS action_id,
          pa.title AS action_title,
          s.id AS source_id,
          s.source_title,
          s.source_url,
          s.source_type,
          s.publisher,
          s.published_date
        FROM promise_actions pa
        JOIN promise_action_sources pas ON pas.promise_action_id = pa.id
        JOIN sources s ON s.id = pas.source_id
        WHERE pa.promise_id IN ({placeholders})
        ORDER BY pa.promise_id ASC, pa.action_date ASC, pa.id ASC, s.id ASC
        """,
        promise_ids,
    )
    grouped: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for row in list(cursor.fetchall() or []):
        grouped[int(row["promise_id"])].append(row)
    return {promise_id: unique_sources(rows, "action") for promise_id, rows in grouped.items()}


def fetch_sourced_outcomes(cursor, promise_ids: list[int]) -> dict[int, list[dict[str, Any]]]:
    if not promise_ids:
        return {}
    placeholders = ", ".join(["%s"] * len(promise_ids))
    cursor.execute(
        f"""
        SELECT
          po.promise_id,
          po.id AS sourced_outcome_id,
          po.outcome_summary,
          s.id AS source_id,
          s.source_title,
          s.source_url,
          s.source_type,
          s.publisher,
          s.published_date
        FROM promise_outcomes po
        JOIN promise_outcome_sources pos ON pos.promise_outcome_id = po.id
        JOIN sources s ON s.id = pos.source_id
        WHERE po.promise_id IN ({placeholders})
        ORDER BY po.promise_id ASC, po.id ASC, s.id ASC
        """,
        promise_ids,
    )
    grouped: dict[int, dict[int, dict[str, Any]]] = defaultdict(dict)
    for row in list(cursor.fetchall() or []):
        promise_id = int(row["promise_id"])
        outcome_id = int(row["sourced_outcome_id"])
        grouped[promise_id].setdefault(
            outcome_id,
            {
                "sourced_outcome_id": outcome_id,
                "outcome_summary": normalize_nullable_text(row.get("outcome_summary")),
                "sources": [],
            },
        )
        grouped[promise_id][outcome_id]["sources"].append(source_shape(row, "same_promise_outcome"))
    return {promise_id: list(outcomes.values()) for promise_id, outcomes in grouped.items()}


def fetch_chain_outcome_sources(cursor, promise_ids: list[int]) -> dict[int, list[dict[str, Any]]]:
    if not promise_ids:
        return {}
    placeholders = ", ".join(["%s"] * len(promise_ids))
    cursor.execute(
        f"""
        SELECT
          target.promise_id,
          rel.relationship_type,
          related_po.promise_id AS related_promise_id,
          related_p.slug AS related_promise_slug,
          related_p.title AS related_promise_title,
          related_po.id AS related_outcome_id,
          related_po.outcome_summary,
          s.id AS source_id,
          s.source_title,
          s.source_url,
          s.source_type,
          s.publisher,
          s.published_date
        FROM (
          SELECT id AS promise_id FROM promises WHERE id IN ({placeholders})
        ) target
        JOIN promise_relationships rel
          ON rel.from_promise_id = target.promise_id
          OR rel.to_promise_id = target.promise_id
        JOIN promises related_p
          ON related_p.id = CASE
            WHEN rel.from_promise_id = target.promise_id THEN rel.to_promise_id
            ELSE rel.from_promise_id
          END
        JOIN promise_outcomes related_po ON related_po.promise_id = related_p.id
        JOIN promise_outcome_sources pos ON pos.promise_outcome_id = related_po.id
        JOIN sources s ON s.id = pos.source_id
        ORDER BY target.promise_id ASC, related_po.id ASC, s.id ASC
        """,
        promise_ids,
    )
    grouped: dict[int, dict[tuple[int, int], dict[str, Any]]] = defaultdict(dict)
    for row in list(cursor.fetchall() or []):
        promise_id = int(row["promise_id"])
        key = (int(row["related_promise_id"]), int(row["related_outcome_id"]))
        grouped[promise_id].setdefault(
            key,
            {
                "relationship_type": normalize_nullable_text(row.get("relationship_type")),
                "related_promise_id": int(row["related_promise_id"]),
                "related_promise_slug": normalize_nullable_text(row.get("related_promise_slug")),
                "related_promise_title": normalize_nullable_text(row.get("related_promise_title")),
                "related_outcome_id": int(row["related_outcome_id"]),
                "outcome_summary": normalize_nullable_text(row.get("outcome_summary")),
                "sources": [],
            },
        )
        grouped[promise_id][key]["sources"].append(source_shape(row, "policy_chain_outcome"))
    return {promise_id: list(outcomes.values()) for promise_id, outcomes in grouped.items()}


def candidate_source_ids(candidate_sources: list[dict[str, Any]]) -> list[int]:
    seen = set()
    ids = []
    for source in candidate_sources:
        source_id = int(source["source_id"])
        if source_id in seen:
            continue
        seen.add(source_id)
        ids.append(source_id)
    return ids


def candidate_from_sources(
    outcome: dict[str, Any],
    classification: str,
    sources: list[dict[str, Any]],
    rationale: str,
    confidence: str,
    match_type: str,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "outcome_id": int(outcome["outcome_id"]),
        "promise_id": int(outcome["promise_id"]),
        "promise_slug": normalize_nullable_text(outcome.get("promise_slug")),
        "promise_title": normalize_nullable_text(outcome.get("promise_title")),
        "president_slug": normalize_nullable_text(outcome.get("president_slug")),
        "outcome_summary": normalize_nullable_text(outcome.get("outcome_summary")),
        "impact_direction": normalize_nullable_text(outcome.get("impact_direction")),
        "evidence_strength": normalize_nullable_text(outcome.get("evidence_strength")),
        "candidate_classification": classification,
        "confidence_level": confidence,
        "match_type": match_type,
        "match_rationale": rationale,
        "candidate_source_ids": candidate_source_ids(sources),
        "candidate_sources": sources,
        **(extra or {}),
    }


def build_candidate(
    outcome: dict[str, Any],
    promise_sources: dict[int, list[dict[str, Any]]],
    action_sources: dict[int, list[dict[str, Any]]],
    sourced_outcomes: dict[int, list[dict[str, Any]]],
    chain_outcomes: dict[int, list[dict[str, Any]]],
) -> dict[str, Any]:
    promise_id = int(outcome["promise_id"])
    direct_promise_sources = promise_sources.get(promise_id, [])
    if len(direct_promise_sources) == 1:
        return candidate_from_sources(
            outcome,
            SAFE_AUTO_LINK,
            direct_promise_sources,
            "The same promise has exactly one existing promise-level source; linking that source preserves already trusted promise provenance.",
            "high",
            "single_same_promise_source",
        )
    if len(direct_promise_sources) > 1:
        return candidate_from_sources(
            outcome,
            OPERATOR_REVIEW_REQUIRED,
            direct_promise_sources,
            "The same promise has multiple promise-level sources; operator review is required to choose the outcome-specific source.",
            "medium",
            "multiple_same_promise_sources",
        )

    direct_action_sources = action_sources.get(promise_id, [])
    if len(direct_action_sources) == 1:
        return candidate_from_sources(
            outcome,
            SAFE_AUTO_LINK,
            direct_action_sources,
            "The same promise has exactly one existing action-level source and no promise-level source; linking that source preserves already trusted action provenance.",
            "high",
            "single_same_promise_action_source",
        )
    if len(direct_action_sources) > 1:
        return candidate_from_sources(
            outcome,
            OPERATOR_REVIEW_REQUIRED,
            direct_action_sources,
            "The same promise has multiple action-level sources; operator review is required to choose the outcome-specific source.",
            "medium",
            "multiple_same_promise_action_sources",
        )

    summary = outcome.get("outcome_summary")
    for sourced in sourced_outcomes.get(promise_id, []):
        similarity = text_similarity(summary, sourced.get("outcome_summary"))
        if similarity >= 0.98:
            return candidate_from_sources(
                outcome,
                SAFE_AUTO_LINK,
                sourced.get("sources") or [],
                "Another sourced outcome on the same promise has exact or near-exact outcome text.",
                "high",
                "same_promise_sourced_outcome_exact_text",
                {
                    "matched_outcome_id": sourced.get("sourced_outcome_id"),
                    "matched_outcome_summary": sourced.get("outcome_summary"),
                    "text_similarity": round(similarity, 4),
                },
            )
        if similarity >= 0.82:
            return candidate_from_sources(
                outcome,
                OPERATOR_REVIEW_REQUIRED,
                sourced.get("sources") or [],
                "Another sourced outcome on the same promise has similar outcome text, but not enough for automatic linking.",
                "medium",
                "same_promise_sourced_outcome_similar_text",
                {
                    "matched_outcome_id": sourced.get("sourced_outcome_id"),
                    "matched_outcome_summary": sourced.get("outcome_summary"),
                    "text_similarity": round(similarity, 4),
                },
            )

    for chain_outcome in chain_outcomes.get(promise_id, []):
        similarity = text_similarity(summary, chain_outcome.get("outcome_summary"))
        if similarity >= 0.82 or normalized_summary(summary) == normalized_summary(chain_outcome.get("outcome_summary")):
            return candidate_from_sources(
                outcome,
                OPERATOR_REVIEW_REQUIRED,
                chain_outcome.get("sources") or [],
                "A related promise in the same policy chain has a sourced similar outcome; policy-chain reuse requires operator review.",
                "medium",
                "policy_chain_sourced_outcome_similar_text",
                {
                    "related_promise_id": chain_outcome.get("related_promise_id"),
                    "related_promise_slug": chain_outcome.get("related_promise_slug"),
                    "related_outcome_id": chain_outcome.get("related_outcome_id"),
                    "related_outcome_summary": chain_outcome.get("outcome_summary"),
                    "relationship_type": chain_outcome.get("relationship_type"),
                    "text_similarity": round(similarity, 4),
                },
            )

    return candidate_from_sources(
        outcome,
        NO_CANDIDATE_FOUND,
        [],
        "No existing trusted source context was found at the promise, action, same-promise outcome, or policy-chain level.",
        "none",
        "no_existing_source_context",
    )


def apply_safe_links(cursor, candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    inserted = []
    for candidate in candidates:
        if candidate.get("candidate_classification") != SAFE_AUTO_LINK:
            continue
        outcome_id = int(candidate["outcome_id"])
        for source_id in candidate.get("candidate_source_ids") or []:
            cursor.execute(
                """
                INSERT IGNORE INTO promise_outcome_sources (promise_outcome_id, source_id)
                VALUES (%s, %s)
                """,
                (outcome_id, int(source_id)),
            )
            if int(cursor.rowcount or 0) > 0:
                inserted.append(
                    {
                        "promise_outcome_id": outcome_id,
                        "promise_id": int(candidate["promise_id"]),
                        "promise_slug": candidate.get("promise_slug"),
                        "source_id": int(source_id),
                        "match_type": candidate.get("match_type"),
                        "confidence_level": candidate.get("confidence_level"),
                    }
                )
    return inserted


def build_report(args: argparse.Namespace) -> dict[str, Any]:
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            unsourced = fetch_unsourced_outcomes(cursor, args.only_outcome_id, args.limit)
            promise_ids = sorted({int(row["promise_id"]) for row in unsourced})
            promise_sources = fetch_promise_sources(cursor, promise_ids)
            action_sources = fetch_action_sources(cursor, promise_ids)
            sourced_outcomes = fetch_sourced_outcomes(cursor, promise_ids)
            chain_outcomes = fetch_chain_outcome_sources(cursor, promise_ids)

            candidates = [
                build_candidate(row, promise_sources, action_sources, sourced_outcomes, chain_outcomes)
                for row in unsourced
            ]

            linked_rows = apply_safe_links(cursor, candidates) if args.apply else []
            if args.apply:
                connection.commit()
            else:
                connection.rollback()

            classification_counts = {
                SAFE_AUTO_LINK: sum(item["candidate_classification"] == SAFE_AUTO_LINK for item in candidates),
                OPERATOR_REVIEW_REQUIRED: sum(item["candidate_classification"] == OPERATOR_REVIEW_REQUIRED for item in candidates),
                NO_CANDIDATE_FOUND: sum(item["candidate_classification"] == NO_CANDIDATE_FOUND for item in candidates),
            }
            return {
                "workflow": "promise_outcome_source_backfill_audit",
                "mode": "apply" if args.apply else "dry_run",
                "generated_at": utc_timestamp(),
                "scope": {
                    "tables": ["promise_outcomes", "promise_outcome_sources"],
                    "source_policy": "existing_sources_only",
                    "mutation_policy": "insert_only_safe_auto_link_candidates_when_apply_is_explicit",
                },
                "summary": {
                    "total_unsourced_outcomes": len(unsourced),
                    "safe_auto_link_count": classification_counts[SAFE_AUTO_LINK],
                    "operator_review_required_count": classification_counts[OPERATOR_REVIEW_REQUIRED],
                    "no_candidate_found_count": classification_counts[NO_CANDIDATE_FOUND],
                    "linked_rows_created": len(linked_rows),
                },
                "candidate_groups": {
                    SAFE_AUTO_LINK: [
                        candidate for candidate in candidates if candidate["candidate_classification"] == SAFE_AUTO_LINK
                    ],
                    OPERATOR_REVIEW_REQUIRED: [
                        candidate
                        for candidate in candidates
                        if candidate["candidate_classification"] == OPERATOR_REVIEW_REQUIRED
                    ],
                    NO_CANDIDATE_FOUND: [
                        candidate for candidate in candidates if candidate["candidate_classification"] == NO_CANDIDATE_FOUND
                    ],
                },
                "linked_rows": linked_rows,
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
        }
    )


if __name__ == "__main__":
    main()
