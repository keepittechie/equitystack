#!/usr/bin/env python3
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any

from current_admin_common import (
    get_current_admin_reports_dir,
    get_db_connection,
    normalize_nullable_text,
    require_apply_confirmation,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Remove selected current-administration promise records and their dependent data."
    )
    parser.add_argument(
        "--president-slug",
        default="donald-j-trump-2025",
        help="President term slug used to scope the promise lookup.",
    )
    parser.add_argument(
        "--slug",
        action="append",
        required=True,
        help="Promise slug to remove. Pass multiple times for multiple records.",
    )
    parser.add_argument("--apply", action="store_true", help="Write the cleanup to the database.")
    parser.add_argument("--yes", action="store_true", help="Required confirmation for --apply mode.")
    parser.add_argument("--output", type=Path, help="Cleanup report JSON output path.")
    return parser.parse_args()


def placeholders(values: list[Any]) -> str:
    return ", ".join(["%s"] * len(values))


def timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def default_output_path() -> Path:
    return get_current_admin_reports_dir() / f"current-admin-mission-cleanup.{timestamp()}.json"


def fetch_promises(cursor, president_slug: str, slugs: list[str]) -> list[dict[str, Any]]:
    cursor.execute(
        f"""
        SELECT
          p.id,
          p.slug,
          p.title,
          p.topic,
          p.status,
          p.impacted_group,
          p.notes,
          COUNT(DISTINCT pa.id) AS action_count,
          COUNT(DISTINCT pout.id) AS promise_outcome_count,
          COUNT(DISTINCT ps.source_id) AS promise_source_count
        FROM promises p
        JOIN presidents pr ON pr.id = p.president_id
        LEFT JOIN promise_actions pa ON pa.promise_id = p.id
        LEFT JOIN promise_outcomes pout ON pout.promise_id = p.id
        LEFT JOIN promise_sources ps ON ps.promise_id = p.id
        WHERE pr.slug = %s
          AND p.slug IN ({placeholders(slugs)})
        GROUP BY p.id, p.slug, p.title, p.topic, p.status, p.impacted_group, p.notes
        ORDER BY p.id ASC
        """,
        [president_slug, *slugs],
    )
    return cursor.fetchall()


def fetch_current_admin_policy_outcomes(cursor, promise_ids: list[int]) -> list[dict[str, Any]]:
    cursor.execute(
        f"""
        SELECT id, policy_id, impact_direction, outcome_summary
        FROM policy_outcomes
        WHERE policy_type = 'current_admin'
          AND policy_id IN ({placeholders(promise_ids)})
        ORDER BY policy_id ASC, id ASC
        """,
        promise_ids,
    )
    return cursor.fetchall()


def fetch_staging_links(cursor, promise_ids: list[int]) -> list[dict[str, Any]]:
    cursor.execute(
        f"""
        SELECT id, promoted_promise_id, title, canonical_url
        FROM current_administration_staging_items
        WHERE promoted_promise_id IN ({placeholders(promise_ids)})
        ORDER BY id ASC
        """,
        promise_ids,
    )
    return cursor.fetchall()


def fetch_ai_review_links(cursor, promise_ids: list[int]) -> list[dict[str, Any]]:
    cursor.execute(
        f"""
        SELECT id, staged_item_id, suggested_existing_promise_id, relevance_assessment, mission_scope
        FROM current_administration_ai_reviews
        WHERE suggested_existing_promise_id IN ({placeholders(promise_ids)})
        ORDER BY id ASC
        """,
        promise_ids,
    )
    return cursor.fetchall()


def fetch_actions(cursor, promise_ids: list[int]) -> list[dict[str, Any]]:
    cursor.execute(
        f"""
        SELECT id, promise_id, title, related_policy_id
        FROM promise_actions
        WHERE promise_id IN ({placeholders(promise_ids)})
        ORDER BY promise_id ASC, id ASC
        """,
        promise_ids,
    )
    return cursor.fetchall()


def fetch_attached_sources(cursor, promise_ids: list[int]) -> list[dict[str, Any]]:
    query = f"""
        SELECT id, source_title, source_url, publisher, published_date, policy_id
        FROM sources
        WHERE id IN (
          SELECT ps.source_id
          FROM promise_sources ps
          WHERE ps.promise_id IN ({placeholders(promise_ids)})
          UNION
          SELECT pas.source_id
          FROM promise_action_sources pas
          JOIN promise_actions pa ON pa.id = pas.promise_action_id
          WHERE pa.promise_id IN ({placeholders(promise_ids)})
          UNION
          SELECT pos.source_id
          FROM policy_outcome_sources pos
          JOIN policy_outcomes po ON po.id = pos.policy_outcome_id
          WHERE po.policy_type = 'current_admin'
            AND po.policy_id IN ({placeholders(promise_ids)})
        )
        ORDER BY id ASC
    """
    cursor.execute(query, [*promise_ids, *promise_ids, *promise_ids])
    return cursor.fetchall()


def fetch_source_usage(cursor, promise_ids: list[int], source_ids: list[int]) -> list[dict[str, Any]]:
    if not source_ids:
        return []

    promise_id_clause = placeholders(promise_ids)
    source_id_clause = placeholders(source_ids)
    query = f"""
        SELECT
          s.id,
          s.source_title,
          s.source_url,
          s.policy_id,
          (
            SELECT COUNT(*)
            FROM promise_sources ps
            WHERE ps.source_id = s.id
              AND ps.promise_id IN ({promise_id_clause})
          ) AS target_promise_refs,
          (
            SELECT COUNT(*)
            FROM promise_sources ps
            WHERE ps.source_id = s.id
              AND ps.promise_id NOT IN ({promise_id_clause})
          ) AS other_promise_refs,
          (
            SELECT COUNT(*)
            FROM promise_action_sources pas
            JOIN promise_actions pa ON pa.id = pas.promise_action_id
            WHERE pas.source_id = s.id
              AND pa.promise_id IN ({promise_id_clause})
          ) AS target_action_refs,
          (
            SELECT COUNT(*)
            FROM promise_action_sources pas
            JOIN promise_actions pa ON pa.id = pas.promise_action_id
            WHERE pas.source_id = s.id
              AND pa.promise_id NOT IN ({promise_id_clause})
          ) AS other_action_refs,
          (
            SELECT COUNT(*)
            FROM policy_outcome_sources pos
            JOIN policy_outcomes po ON po.id = pos.policy_outcome_id
            WHERE pos.source_id = s.id
              AND po.policy_type = 'current_admin'
              AND po.policy_id IN ({promise_id_clause})
          ) AS target_policy_outcome_refs,
          (
            SELECT COUNT(*)
            FROM policy_outcome_sources pos
            JOIN policy_outcomes po ON po.id = pos.policy_outcome_id
            WHERE pos.source_id = s.id
              AND NOT (po.policy_type = 'current_admin' AND po.policy_id IN ({promise_id_clause}))
          ) AS other_policy_outcome_refs,
          (
            SELECT COUNT(*)
            FROM entity_demographic_impact_sources edis
            WHERE edis.source_id = s.id
          ) AS demographic_refs
        FROM sources s
        WHERE s.id IN ({source_id_clause})
        ORDER BY s.id ASC
    """
    params = (
        promise_ids
        + promise_ids
        + promise_ids
        + promise_ids
        + promise_ids
        + promise_ids
        + source_ids
    )
    cursor.execute(query, params)
    rows = cursor.fetchall()
    for row in rows:
        other_refs = (
            int(row["other_promise_refs"] or 0)
            + int(row["other_action_refs"] or 0)
            + int(row["other_policy_outcome_refs"] or 0)
            + int(row["demographic_refs"] or 0)
        )
        row["delete_safe_after_cleanup"] = other_refs == 0 and row.get("policy_id") is None
    return rows


def build_report(args: argparse.Namespace, promises: list[dict[str, Any]], missing_slugs: list[str]) -> dict[str, Any]:
    return {
        "mode": "apply" if args.apply else "dry-run",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "president_slug": args.president_slug,
        "requested_slugs": args.slug,
        "missing_slugs": missing_slugs,
        "promises": promises,
    }


def serialize_report(payload: dict[str, Any]) -> dict[str, Any]:
    return json.loads(json.dumps(payload, indent=2, default=str))


def main() -> None:
    args = parse_args()
    require_apply_confirmation(args.apply, args.yes)
    requested_slugs = sorted({normalize_nullable_text(slug) for slug in args.slug if normalize_nullable_text(slug)})
    if not requested_slugs:
        raise ValueError("Provide at least one non-empty --slug.")

    output_path = args.output or default_output_path()

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            promises = fetch_promises(cursor, args.president_slug, requested_slugs)
            found_slugs = {row["slug"] for row in promises}
            missing_slugs = [slug for slug in requested_slugs if slug not in found_slugs]
            promise_ids = [int(row["id"]) for row in promises]

            report = build_report(args, promises, missing_slugs)
            if promise_ids:
                policy_outcomes = fetch_current_admin_policy_outcomes(cursor, promise_ids)
                staging_links = fetch_staging_links(cursor, promise_ids)
                ai_review_links = fetch_ai_review_links(cursor, promise_ids)
                actions = fetch_actions(cursor, promise_ids)
                attached_sources = fetch_attached_sources(cursor, promise_ids)
                source_ids = [int(row["id"]) for row in attached_sources]
                source_usage = fetch_source_usage(cursor, promise_ids, source_ids)
            else:
                policy_outcomes = []
                staging_links = []
                ai_review_links = []
                actions = []
                attached_sources = []
                source_usage = []

            deletable_source_ids = [int(row["id"]) for row in source_usage if row["delete_safe_after_cleanup"]]
            report.update(
                {
                    "promise_count": len(promises),
                    "action_count": len(actions),
                    "current_admin_policy_outcome_count": len(policy_outcomes),
                    "attached_source_count": len(attached_sources),
                    "deletable_source_count": len(deletable_source_ids),
                    "staging_link_count": len(staging_links),
                    "ai_review_link_count": len(ai_review_links),
                    "actions": actions,
                    "current_admin_policy_outcomes": policy_outcomes,
                    "staging_links": staging_links,
                    "ai_review_links": ai_review_links,
                    "attached_sources": attached_sources,
                    "source_usage": source_usage,
                    "deletable_source_ids": deletable_source_ids,
                }
            )

            if args.apply and promise_ids:
                cursor.execute(
                    f"""
                    UPDATE current_administration_staging_items
                    SET promoted_promise_id = NULL
                    WHERE promoted_promise_id IN ({placeholders(promise_ids)})
                    """,
                    promise_ids,
                )
                staging_unlinked = cursor.rowcount

                cursor.execute(
                    f"""
                    UPDATE current_administration_ai_reviews
                    SET suggested_existing_promise_id = NULL
                    WHERE suggested_existing_promise_id IN ({placeholders(promise_ids)})
                    """,
                    promise_ids,
                )
                ai_reviews_unlinked = cursor.rowcount

                cursor.execute(
                    f"""
                    DELETE FROM policy_outcomes
                    WHERE policy_type = 'current_admin'
                      AND policy_id IN ({placeholders(promise_ids)})
                    """,
                    promise_ids,
                )
                policy_outcomes_deleted = cursor.rowcount

                cursor.execute(
                    f"DELETE FROM promises WHERE id IN ({placeholders(promise_ids)})",
                    promise_ids,
                )
                promises_deleted = cursor.rowcount

                sources_deleted = 0
                if deletable_source_ids:
                    cursor.execute(
                        f"DELETE FROM sources WHERE id IN ({placeholders(deletable_source_ids)})",
                        deletable_source_ids,
                    )
                    sources_deleted = cursor.rowcount

                report["apply_results"] = {
                    "staging_links_unlinked": staging_unlinked,
                    "ai_review_links_unlinked": ai_reviews_unlinked,
                    "current_admin_policy_outcomes_deleted": policy_outcomes_deleted,
                    "promises_deleted": promises_deleted,
                    "sources_deleted": sources_deleted,
                }

        if args.apply:
            connection.commit()
        else:
            connection.rollback()
        serialized_report = serialize_report(report)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(f"{json.dumps(serialized_report, indent=2)}\n", encoding="utf-8")
        print(json.dumps({**serialized_report, "output_path": str(output_path)}, indent=2))
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


if __name__ == "__main__":
    main()
