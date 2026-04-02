#!/usr/bin/env python3
import argparse
from collections import defaultdict
from pathlib import Path
from typing import Any

from current_admin_common import (
    get_db_connection,
    get_project_root,
    require_apply_confirmation,
    utc_timestamp,
    write_json_file,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Safely merge exact duplicate sources and backfill deterministic source joins."
    )
    parser.add_argument("--apply", action="store_true", help="Persist the safe duplicate merges and deterministic source joins")
    parser.add_argument("--yes", action="store_true", help="Required confirmation for --apply mode")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Directory for integrity cleanup JSON artifacts. Defaults to python/reports/integrity.",
    )
    return parser.parse_args()


def normalize_text(value: Any) -> str:
    return str(value or "").strip()


def normalize_nullable_text(value: Any) -> str | None:
    text = normalize_text(value)
    return text or None


def get_output_dir(explicit: Path | None) -> Path:
    if explicit is not None:
        return explicit.resolve()
    return get_project_root() / "python" / "reports" / "integrity"


def group_rows(rows: list[dict[str, Any]], key_name: str) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        grouped[normalize_text(row.get(key_name))].append(row)
    return dict(grouped)


def fetch_duplicate_source_rows(cursor) -> list[dict[str, Any]]:
    cursor.execute(
        """
        SELECT
          s.id,
          s.policy_id,
          s.source_title,
          s.source_url,
          s.source_type,
          s.publisher,
          s.published_date,
          s.notes,
          COALESCE(ps_counts.promise_refs, 0) AS promise_refs,
          COALESCE(pas_counts.action_refs, 0) AS action_refs,
          COALESCE(pos_counts.outcome_refs, 0) AS outcome_refs
        FROM sources s
        JOIN (
          SELECT source_url
          FROM sources
          WHERE source_url IS NOT NULL
            AND LENGTH(TRIM(source_url)) > 0
          GROUP BY source_url
          HAVING COUNT(*) > 1
        ) duplicate_urls ON duplicate_urls.source_url = s.source_url
        LEFT JOIN (
          SELECT source_id, COUNT(*) AS promise_refs
          FROM promise_sources
          GROUP BY source_id
        ) ps_counts ON ps_counts.source_id = s.id
        LEFT JOIN (
          SELECT source_id, COUNT(*) AS action_refs
          FROM promise_action_sources
          GROUP BY source_id
        ) pas_counts ON pas_counts.source_id = s.id
        LEFT JOIN (
          SELECT source_id, COUNT(*) AS outcome_refs
          FROM promise_outcome_sources
          GROUP BY source_id
        ) pos_counts ON pos_counts.source_id = s.id
        ORDER BY s.source_url ASC, s.id ASC
        """
    )
    return list(cursor.fetchall() or [])


def classify_duplicate_cluster(rows: list[dict[str, Any]]) -> dict[str, Any]:
    titles = {normalize_text(row.get("source_title")) or "<blank>" for row in rows}
    source_types = {normalize_text(row.get("source_type")) or "<blank>" for row in rows}
    publishers = {normalize_nullable_text(row.get("publisher")) or "<null>" for row in rows}
    published_dates = {
        normalize_nullable_text(row.get("published_date")) or "<null>" for row in rows
    }
    nonnull_policy_ids = sorted(
        {
            int(row["policy_id"])
            for row in rows
            if row.get("policy_id") is not None
        }
    )

    rejection_reasons = []
    if len(titles) != 1:
        rejection_reasons.append("multiple_titles")
    if len(source_types) != 1:
        rejection_reasons.append("multiple_source_types")
    if len(publishers) != 1:
        rejection_reasons.append("multiple_publishers")
    if len(published_dates) > 1:
        rejection_reasons.append("multiple_published_dates")
    if len(nonnull_policy_ids) > 1:
        rejection_reasons.append("multiple_policy_ids")

    safe_exact_metadata = (
        len(titles) == 1
        and len(source_types) == 1
        and len(publishers) == 1
        and len(published_dates) <= 1
    )
    policy_compatible = len(nonnull_policy_ids) <= 1
    auto_merge_safe = safe_exact_metadata and policy_compatible

    if not rejection_reasons and not auto_merge_safe:
        rejection_reasons.append("manual_review_required")

    canonical_row = sorted(
        rows,
        key=lambda row: (row.get("policy_id") is None, int(row["id"])),
    )[0]

    return {
        "source_url": normalize_text(rows[0].get("source_url")),
        "duplicate_count": len(rows),
        "distinct_titles": len(titles),
        "distinct_source_types": len(source_types),
        "distinct_publishers": len(publishers),
        "distinct_published_dates": len(published_dates),
        "distinct_nonnull_policy_ids": len(nonnull_policy_ids),
        "auto_merge_safe": auto_merge_safe,
        "auto_merge_rejected_reasons": rejection_reasons,
        "canonical_source_id": int(canonical_row["id"]),
        "rows": [
            {
                "source_id": int(row["id"]),
                "policy_id": int(row["policy_id"]) if row.get("policy_id") is not None else None,
                "title": normalize_text(row.get("source_title")),
                "source_type": normalize_text(row.get("source_type")),
                "publisher": normalize_nullable_text(row.get("publisher")),
                "published_date": normalize_nullable_text(row.get("published_date")),
                "promise_refs": int(row.get("promise_refs") or 0),
                "action_refs": int(row.get("action_refs") or 0),
                "outcome_refs": int(row.get("outcome_refs") or 0),
            }
            for row in rows
        ],
    }


def fetch_deterministic_action_backfill_candidates(cursor) -> list[dict[str, Any]]:
    cursor.execute(
        """
        SELECT
          pa.id AS action_id,
          p.id AS promise_id,
          p.slug AS promise_slug,
          p.title AS promise_title,
          COALESCE(p.topic, '<untagged>') AS topic,
          pr.slug AS president_slug,
          pr.full_name AS president_name,
          pa.title AS action_title,
          MIN(ctx.source_id) AS source_id,
          MIN(s.source_title) AS source_title,
          COUNT(DISTINCT ctx.source_id) AS context_source_count,
          COUNT(*) AS raw_context_rows
        FROM promise_actions pa
        JOIN promises p ON p.id = pa.promise_id
        JOIN presidents pr ON pr.id = p.president_id
        JOIN (
          SELECT ps.promise_id, ps.source_id
          FROM promise_sources ps
          UNION ALL
          SELECT po.promise_id, pos.source_id
          FROM promise_outcomes po
          JOIN promise_outcome_sources pos ON pos.promise_outcome_id = po.id
          UNION ALL
          SELECT pa2.promise_id, pas2.source_id
          FROM promise_actions pa2
          JOIN promise_action_sources pas2 ON pas2.promise_action_id = pa2.id
        ) ctx ON ctx.promise_id = p.id
        JOIN sources s ON s.id = ctx.source_id
        WHERE NOT EXISTS (
          SELECT 1
          FROM promise_action_sources pas
          WHERE pas.promise_action_id = pa.id
        )
        GROUP BY
          pa.id,
          p.id,
          p.slug,
          p.title,
          p.topic,
          pr.slug,
          pr.full_name,
          pa.title
        HAVING COUNT(DISTINCT ctx.source_id) = 1
        ORDER BY pa.id ASC
        """
    )
    return list(cursor.fetchall() or [])


def classify_import_origin(president_slug: str, created_year: Any) -> str:
    normalized_president = normalize_text(president_slug)
    normalized_year = normalize_text(created_year)
    if normalized_president == "donald-j-trump-2025":
        return "current_admin_import"
    if normalized_year == "2026":
        return "legacy_sql_import_2026"
    return "unknown_untracked_import"


def fetch_unresolved_source_groups(cursor, table_kind: str) -> list[dict[str, Any]]:
    if table_kind == "actions":
        source_join_table = "promise_action_sources"
        source_join_field = "promise_action_id"
        owner_table = "promise_actions"
        owner_id_field = "id"
        created_field = "created_at"
    else:
        source_join_table = "promise_outcome_sources"
        source_join_field = "promise_outcome_id"
        owner_table = "promise_outcomes"
        owner_id_field = "id"
        created_field = "created_at"

    cursor.execute(
        f"""
        SELECT
          pr.slug AS president_slug,
          pr.full_name AS president_name,
          COALESCE(p.topic, '<untagged>') AS topic,
          YEAR(o.{created_field}) AS created_year,
          COUNT(*) AS row_count,
          GROUP_CONCAT(DISTINCT p.slug ORDER BY p.slug SEPARATOR ', ') AS promise_slugs
        FROM {owner_table} o
        JOIN promises p ON p.id = o.promise_id
        JOIN presidents pr ON pr.id = p.president_id
        WHERE NOT EXISTS (
          SELECT 1
          FROM {source_join_table} sj
          WHERE sj.{source_join_field} = o.{owner_id_field}
        )
        GROUP BY pr.slug, pr.full_name, COALESCE(p.topic, '<untagged>'), YEAR(o.{created_field})
        ORDER BY row_count DESC, president_slug ASC, topic ASC
        """
    )
    rows = list(cursor.fetchall() or [])
    grouped = []
    for row in rows:
        president_slug = normalize_text(row.get("president_slug"))
        origin = classify_import_origin(president_slug, f"{row.get('created_year') or ''}")
        grouped.append(
            {
                "president_slug": president_slug,
                "president_name": normalize_text(row.get("president_name")),
                "topic": normalize_text(row.get("topic")) or "<untagged>",
                "likely_import_origin": origin,
                "created_year": int(row["created_year"]) if row.get("created_year") is not None else None,
                "row_count": int(row.get("row_count") or 0),
                "promise_slugs_sample": [
                    slug.strip()
                    for slug in normalize_text(row.get("promise_slugs")).split(",")
                    if slug.strip()
                ][:5],
            }
        )
    return grouped


def fetch_missing_source_counts(cursor) -> dict[str, int]:
    cursor.execute(
        """
        SELECT COUNT(*) AS total
        FROM promise_actions pa
        WHERE NOT EXISTS (
          SELECT 1
          FROM promise_action_sources pas
          WHERE pas.promise_action_id = pa.id
        )
        """
    )
    missing_actions = int((cursor.fetchone() or {}).get("total") or 0)
    cursor.execute(
        """
        SELECT COUNT(*) AS total
        FROM promise_outcomes po
        WHERE NOT EXISTS (
          SELECT 1
          FROM promise_outcome_sources pos
          WHERE pos.promise_outcome_id = po.id
        )
        """
    )
    missing_outcomes = int((cursor.fetchone() or {}).get("total") or 0)
    return {
        "missing_actions": missing_actions,
        "missing_outcomes": missing_outcomes,
    }


def fetch_duplicate_group_count(cursor) -> int:
    cursor.execute(
        """
        SELECT COUNT(*) AS total
        FROM (
          SELECT source_url
          FROM sources
          WHERE source_url IS NOT NULL
            AND LENGTH(TRIM(source_url)) > 0
          GROUP BY source_url
          HAVING COUNT(*) > 1
        ) duplicate_groups
        """
    )
    return int((cursor.fetchone() or {}).get("total") or 0)


def merge_duplicate_cluster(cursor, cluster: dict[str, Any]) -> dict[str, Any]:
    canonical_source_id = int(cluster["canonical_source_id"])
    duplicate_source_ids = [
        int(row["source_id"])
        for row in cluster["rows"]
        if int(row["source_id"]) != canonical_source_id
    ]
    if not duplicate_source_ids:
        return {
            "canonical_source_id": canonical_source_id,
            "deleted_source_ids": [],
            "join_updates": {},
            "deleted_sources": 0,
        }

    join_tables = [
        ("promise_sources", "promise_id"),
        ("promise_action_sources", "promise_action_id"),
        ("promise_outcome_sources", "promise_outcome_id"),
    ]
    join_updates: dict[str, dict[str, int]] = {}
    placeholders = ", ".join(["%s"] * len(duplicate_source_ids))

    for table_name, owner_field in join_tables:
        cursor.execute(
            f"""
            INSERT IGNORE INTO {table_name} ({owner_field}, source_id)
            SELECT {owner_field}, %s
            FROM {table_name}
            WHERE source_id IN ({placeholders})
            """,
            [canonical_source_id, *duplicate_source_ids],
        )
        inserted_rows = int(cursor.rowcount or 0)
        cursor.execute(
            f"DELETE FROM {table_name} WHERE source_id IN ({placeholders})",
            duplicate_source_ids,
        )
        deleted_rows = int(cursor.rowcount or 0)
        join_updates[table_name] = {
            "inserted_canonical_rows": inserted_rows,
            "deleted_duplicate_rows": deleted_rows,
        }

    cursor.execute(
        f"DELETE FROM sources WHERE id IN ({placeholders})",
        duplicate_source_ids,
    )
    deleted_sources = int(cursor.rowcount or 0)

    return {
        "canonical_source_id": canonical_source_id,
        "deleted_source_ids": duplicate_source_ids,
        "join_updates": join_updates,
        "deleted_sources": deleted_sources,
    }


def apply_action_backfills(cursor, candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    repaired = []
    for candidate in candidates:
        action_id = int(candidate["action_id"])
        source_id = int(candidate["source_id"])
        cursor.execute(
            """
            INSERT IGNORE INTO promise_action_sources (promise_action_id, source_id)
            VALUES (%s, %s)
            """,
            (action_id, source_id),
        )
        if int(cursor.rowcount or 0) > 0:
            repaired.append(
                {
                    "action_id": action_id,
                    "promise_id": int(candidate["promise_id"]),
                    "promise_slug": normalize_text(candidate["promise_slug"]),
                    "promise_title": normalize_text(candidate["promise_title"]),
                    "topic": normalize_text(candidate["topic"]),
                    "president_slug": normalize_text(candidate["president_slug"]),
                    "president_name": normalize_text(candidate["president_name"]),
                    "action_title": normalize_text(candidate["action_title"]),
                    "source_id": source_id,
                    "source_title": normalize_text(candidate["source_title"]),
                    "repair_reason": "single_same_promise_source_context",
                }
            )
    return repaired


def verify_no_orphan_source_joins(cursor) -> dict[str, int]:
    results = {}
    checks = [
        ("promise_sources", "promise_id", "promises"),
        ("promise_action_sources", "promise_action_id", "promise_actions"),
        ("promise_outcome_sources", "promise_outcome_id", "promise_outcomes"),
    ]
    for join_table, owner_field, owner_table in checks:
        cursor.execute(
            f"""
            SELECT COUNT(*) AS total
            FROM {join_table} j
            LEFT JOIN {owner_table} o ON o.id = j.{owner_field}
            LEFT JOIN sources s ON s.id = j.source_id
            WHERE o.id IS NULL OR s.id IS NULL
            """
        )
        results[join_table] = int((cursor.fetchone() or {}).get("total") or 0)
    return results


def build_duplicate_reports(clusters: list[dict[str, Any]]) -> tuple[dict[str, Any], dict[str, Any]]:
    safe_clusters = [cluster for cluster in clusters if cluster["auto_merge_safe"]]
    unsafe_clusters = [cluster for cluster in clusters if not cluster["auto_merge_safe"]]
    cleanup_report = {
        "generated_at": utc_timestamp(),
        "duplicate_group_count": len(clusters),
        "auto_merge_safe_group_count": len(safe_clusters),
        "manual_review_group_count": len(unsafe_clusters),
    }
    manual_report = {
        "generated_at": utc_timestamp(),
        "duplicate_group_count": len(clusters),
        "manual_review_group_count": len(unsafe_clusters),
        "clusters": unsafe_clusters,
    }
    return cleanup_report, manual_report


def main() -> None:
    args = parse_args()
    require_apply_confirmation(args.apply, args.yes)
    output_dir = get_output_dir(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    cleanup_report_path = output_dir / "source_integrity_cleanup_report.json"
    duplicate_manual_review_path = output_dir / "source_duplicate_manual_review.json"
    attribution_manual_review_path = output_dir / "source_attribution_manual_review.json"

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            duplicate_rows = fetch_duplicate_source_rows(cursor)
            duplicate_clusters = [
                classify_duplicate_cluster(rows)
                for rows in group_rows(duplicate_rows, "source_url").values()
                if rows
            ]
            duplicate_summary, duplicate_manual_review = build_duplicate_reports(duplicate_clusters)

            pre_counts = fetch_missing_source_counts(cursor)
            duplicate_groups_before = fetch_duplicate_group_count(cursor)

            safe_clusters = [cluster for cluster in duplicate_clusters if cluster["auto_merge_safe"]]
            merge_results = []
            if args.apply:
                for cluster in safe_clusters:
                    merge_results.append(
                        {
                            "source_url": cluster["source_url"],
                            **merge_duplicate_cluster(cursor, cluster),
                        }
                    )

            action_backfill_candidates = fetch_deterministic_action_backfill_candidates(cursor)
            repaired_actions = apply_action_backfills(cursor, action_backfill_candidates) if args.apply else []

            post_counts = fetch_missing_source_counts(cursor)
            duplicate_groups_after = fetch_duplicate_group_count(cursor)
            orphan_counts = verify_no_orphan_source_joins(cursor)

            unresolved_actions = fetch_unresolved_source_groups(cursor, "actions")
            unresolved_outcomes = fetch_unresolved_source_groups(cursor, "outcomes")

            cleanup_report = {
                "generated_at": utc_timestamp(),
                "mode": "apply" if args.apply else "dry-run",
                "duplicate_merge": {
                    **duplicate_summary,
                    "duplicate_group_count_before": duplicate_groups_before,
                    "duplicate_group_count_after": duplicate_groups_after,
                    "safe_clusters": [
                        {
                            "source_url": cluster["source_url"],
                            "canonical_source_id": cluster["canonical_source_id"],
                            "duplicate_count": cluster["duplicate_count"],
                            "source_ids": [row["source_id"] for row in cluster["rows"]],
                            "policy_ids": sorted(
                                {
                                    row["policy_id"]
                                    for row in cluster["rows"]
                                    if row["policy_id"] is not None
                                }
                            ),
                        }
                        for cluster in safe_clusters
                    ],
                    "executed_merges": merge_results,
                },
                "source_backfill": {
                    "missing_actions_before": pre_counts["missing_actions"],
                    "missing_outcomes_before": pre_counts["missing_outcomes"],
                    "missing_actions_after": post_counts["missing_actions"],
                    "missing_outcomes_after": post_counts["missing_outcomes"],
                    "deterministic_action_candidates": [
                        {
                            "action_id": int(candidate["action_id"]),
                            "promise_slug": normalize_text(candidate["promise_slug"]),
                            "action_title": normalize_text(candidate["action_title"]),
                            "source_id": int(candidate["source_id"]),
                            "source_title": normalize_text(candidate["source_title"]),
                        }
                        for candidate in action_backfill_candidates
                    ],
                    "repaired_actions": repaired_actions,
                    "repaired_action_count": len(repaired_actions),
                    "repaired_outcome_count": 0,
                },
                "verification": {
                    "orphan_join_counts": orphan_counts,
                },
            }

            attribution_manual_review = {
                "generated_at": utc_timestamp(),
                "mode": "apply" if args.apply else "dry-run",
                "remaining_missing_actions": post_counts["missing_actions"],
                "remaining_missing_outcomes": post_counts["missing_outcomes"],
                "unresolved_action_groups": unresolved_actions,
                "unresolved_outcome_groups": unresolved_outcomes,
            }

            write_json_file(cleanup_report_path, cleanup_report)
            write_json_file(duplicate_manual_review_path, duplicate_manual_review)
            write_json_file(attribution_manual_review_path, attribution_manual_review)

            if args.apply:
                connection.commit()
            else:
                connection.rollback()

    finally:
        connection.close()

    print(f"Cleanup report: {cleanup_report_path}")
    print(f"Duplicate manual review report: {duplicate_manual_review_path}")
    print(f"Source attribution manual review report: {attribution_manual_review_path}")


if __name__ == "__main__":
    main()
