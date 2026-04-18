#!/usr/bin/env python3
import argparse
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
    create_source,
    ensure_policy_outcome_sources_table,
    find_source_by_url,
    link_policy_outcome_source,
    sync_all_policy_outcome_source_metadata,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Migrate legacy and implicit outcome evidence into canonical policy_outcome_sources."
    )
    parser.add_argument("--output", type=Path, help="Migration report JSON path")
    parser.add_argument("--apply", action="store_true", help="Persist the canonical migration")
    parser.add_argument("--yes", action="store_true", help="Required confirmation for --apply")
    return parser.parse_args()


def default_output_path(apply: bool) -> Path:
    suffix = "apply" if apply else "dry-run"
    return get_reports_dir() / f"policy-outcome-source-linkage-migration.{suffix}.json"


def fetch_current_admin_legacy_pairs(cursor) -> list[dict[str, Any]]:
    cursor.execute(
        """
        SELECT COUNT(*) AS total
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'promise_outcome_sources'
        """
    )
    if int((cursor.fetchone() or {}).get("total") or 0) < 1:
        return []
    cursor.execute(
        """
        SELECT
          po.id AS policy_outcome_id,
          pos.source_id
        FROM policy_outcomes po
        JOIN promise_outcomes pmo
          ON po.policy_type = 'current_admin'
         AND pmo.promise_id = po.policy_id
         AND SHA2(TRIM(pmo.outcome_summary), 256) = po.outcome_summary_hash
        JOIN promise_outcome_sources pos
          ON pos.promise_outcome_id = pmo.id
        ORDER BY po.id ASC, pos.source_id ASC
        """
    )
    return list(cursor.fetchall() or [])


def fetch_legislative_targets(cursor) -> list[dict[str, Any]]:
    cursor.execute(
        """
        SELECT
          po.id AS policy_outcome_id,
          tb.id AS tracked_bill_id,
          tb.bill_number,
          tb.title,
          tb.bill_url,
          tb.latest_action_date
        FROM policy_outcomes po
        JOIN tracked_bills tb
          ON po.policy_type = 'legislative'
         AND tb.id = po.policy_id
        ORDER BY po.id ASC
        """
    )
    targets = list(cursor.fetchall() or [])
    if not targets:
        return []

    bill_ids = [int(row["tracked_bill_id"]) for row in targets]
    placeholders = ", ".join(["%s"] * len(bill_ids))
    cursor.execute(
        f"""
        SELECT
          tracked_bill_id,
          action_date,
          action_text,
          source_url
        FROM tracked_bill_actions
        WHERE tracked_bill_id IN ({placeholders})
        ORDER BY tracked_bill_id ASC, action_date ASC, id ASC
        """,
        bill_ids,
    )
    actions_by_bill: dict[int, list[dict[str, Any]]] = {}
    for row in cursor.fetchall() or []:
        actions_by_bill.setdefault(int(row["tracked_bill_id"]), []).append(row)

    enriched = []
    for target in targets:
        enriched.append({**target, "actions": actions_by_bill.get(int(target["tracked_bill_id"]), [])})
    return enriched


def legislative_sources_for_target(target: dict[str, Any]) -> list[dict[str, Any]]:
    sources = []
    seen: set[str] = set()

    bill_url = normalize_nullable_text(target.get("bill_url"))
    if bill_url:
        normalized = bill_url.rstrip("/").lower()
        if normalized not in seen:
            seen.add(normalized)
            sources.append(
                {
                    "source_title": f"{target.get('bill_number')} - Congress.gov bill record",
                    "source_url": bill_url,
                    "source_type": "Government",
                    "publisher": "Congress.gov",
                    "published_date": str(target["latest_action_date"]) if target.get("latest_action_date") else None,
                }
            )

    for action in target.get("actions") or []:
        source_url = normalize_nullable_text(action.get("source_url"))
        if not source_url:
            continue
        normalized = source_url.rstrip("/").lower()
        if normalized in seen:
            continue
        seen.add(normalized)
        sources.append(
            {
                "source_title": normalize_nullable_text(action.get("action_text"))
                or f"{target.get('bill_number')} - Congress.gov action update",
                "source_url": source_url,
                "source_type": "Government",
                "publisher": "Congress.gov",
                "published_date": str(action["action_date"]) if action.get("action_date") else None,
            }
        )

    return sources


def count_summary(cursor) -> dict[str, int]:
    cursor.execute(
        """
        SELECT
          COUNT(*) AS total_policy_outcomes,
          SUM(CASE WHEN source_count > 0 THEN 1 ELSE 0 END) AS with_sources,
          SUM(CASE WHEN source_count = 0 THEN 1 ELSE 0 END) AS without_sources
        FROM policy_outcomes
        """
    )
    row = cursor.fetchone() or {}
    return {key: int(row.get(key) or 0) for key in row.keys()}


def verification(cursor) -> dict[str, Any]:
    cursor.execute(
        """
        SELECT COUNT(*) AS total
        FROM (
          SELECT po.id
          FROM policy_outcomes po
          LEFT JOIN (
            SELECT policy_outcome_id, COUNT(DISTINCT source_id) AS actual_source_count
            FROM policy_outcome_sources
            GROUP BY policy_outcome_id
          ) actual
            ON actual.policy_outcome_id = po.id
          WHERE po.source_count <> COALESCE(actual.actual_source_count, 0)
        ) mismatches
        """
    )
    source_count_mismatches = int((cursor.fetchone() or {}).get("total") or 0)

    cursor.execute(
        """
        SELECT COUNT(*) AS total
        FROM policy_outcome_sources pos
        LEFT JOIN policy_outcomes po ON po.id = pos.policy_outcome_id
        LEFT JOIN sources s ON s.id = pos.source_id
        WHERE po.id IS NULL OR s.id IS NULL
        """
    )
    join_orphans = int((cursor.fetchone() or {}).get("total") or 0)

    cursor.execute(
        """
        SELECT COUNT(*) AS total
        FROM (
          SELECT policy_outcome_id, source_id, COUNT(*) AS duplicate_count
          FROM policy_outcome_sources
          GROUP BY policy_outcome_id, source_id
          HAVING COUNT(*) > 1
        ) duplicates
        """
    )
    duplicate_links = int((cursor.fetchone() or {}).get("total") or 0)

    return {
        "source_count_mismatches": source_count_mismatches,
        "join_orphans": join_orphans,
        "duplicate_links": duplicate_links,
        "ok": source_count_mismatches == 0 and join_orphans == 0 and duplicate_links == 0,
    }


def build_report(args: argparse.Namespace) -> dict[str, Any]:
    require_apply_confirmation(args.apply, args.yes)
    generated_at = utc_timestamp()
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            ensure_policy_outcome_sources_table(cursor)
            before = count_summary(cursor)

            current_admin_pairs = fetch_current_admin_legacy_pairs(cursor)
            current_admin_inserted = 0
            for row in current_admin_pairs:
                current_admin_inserted += link_policy_outcome_source(
                    cursor,
                    int(row["policy_outcome_id"]),
                    int(row["source_id"]),
                )

            legislative_targets = fetch_legislative_targets(cursor)
            legislative_sources_created = 0
            legislative_links_created = 0
            legislative_plans = []
            for target in legislative_targets:
                target_plan = {
                    "policy_outcome_id": int(target["policy_outcome_id"]),
                    "tracked_bill_id": int(target["tracked_bill_id"]),
                    "bill_number": target.get("bill_number"),
                    "planned_sources": [],
                }
                for source in legislative_sources_for_target(target):
                    source_id = find_source_by_url(cursor, source["source_url"])
                    created = False
                    if source_id is None:
                        source_id = create_source(
                            cursor,
                            source_title=source["source_title"],
                            source_url=source["source_url"],
                            source_type=source["source_type"],
                            publisher=source.get("publisher"),
                            published_date=source.get("published_date"),
                            notes=(
                                f"EquityStack canonical policy outcome source migration at {generated_at}"
                                f" | policy_outcome_id={target['policy_outcome_id']}"
                                f" | tracked_bill_id={target['tracked_bill_id']}"
                            ),
                        )
                        created = True
                        legislative_sources_created += 1
                    inserted = link_policy_outcome_source(
                        cursor,
                        int(target["policy_outcome_id"]),
                        int(source_id),
                    )
                    legislative_links_created += inserted
                    target_plan["planned_sources"].append(
                        {
                            **source,
                            "source_id": int(source_id),
                            "created_source_row": created,
                            "link_inserted": inserted == 1,
                        }
                    )
                legislative_plans.append(target_plan)

            metadata_sync = sync_all_policy_outcome_source_metadata(cursor)
            verification_report = verification(cursor)
            after = count_summary(cursor)

            if args.apply:
                connection.commit()
            else:
                connection.rollback()

        return {
            "workflow": "policy_outcome_source_linkage_migration",
            "generated_at": generated_at,
            "mode": "apply" if args.apply else "dry_run",
            "canonical_storage": {
                "source_table": "sources",
                "junction_table": "policy_outcome_sources",
                "metadata_table": "policy_outcomes",
            },
            "before": before,
            "after": after,
            "migration": {
                "current_admin_legacy_pairs_found": len(current_admin_pairs),
                "current_admin_links_created": current_admin_inserted,
                "legislative_policy_outcomes_processed": len(legislative_targets),
                "legislative_sources_created": legislative_sources_created,
                "legislative_links_created": legislative_links_created,
                "metadata_sync": metadata_sync,
            },
            "legislative_plans": legislative_plans,
            "verification": verification_report,
        }
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def main() -> None:
    args = parse_args()
    output_path = (args.output or default_output_path(args.apply)).resolve()
    report = build_report(args)
    write_json_file(output_path, report)
    print_json({"ok": True, "output": str(output_path), **report["migration"], **report["verification"]})


if __name__ == "__main__":
    main()
