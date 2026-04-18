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


SYSTEMIC_LINKAGE_REPAIRS = [
    {
        "policy_id": 17,
        "policy_title": "Ku Klux Klan Act of 1871",
        "promise_action_id": 120,
        "expected_action_title": "Congress enacts the Ku Klux Klan Act",
        "alias_phrase": "Ku Klux Klan Act",
        "reason": "The promise action clearly names the classified policy but still has a NULL related_policy_id, so systemic metadata cannot flow into the active current-admin score path.",
    }
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Repair explicit promise_action to policy links needed for systemic-impact scoring coverage."
    )
    parser.add_argument("--output", type=Path, help="Output report JSON path")
    parser.add_argument("--apply", action="store_true", help="Write the linkage repairs")
    parser.add_argument("--yes", action="store_true", help="Required confirmation for --apply")
    return parser.parse_args()


def default_output_path(apply: bool) -> Path:
    suffix = "apply" if apply else "dry-run"
    return get_reports_dir() / f"repair-systemic-linkage-gaps.{suffix}.json"


def fetch_repair_rows(cursor) -> list[dict[str, Any]]:
    action_ids = [item["promise_action_id"] for item in SYSTEMIC_LINKAGE_REPAIRS]
    placeholders = ", ".join(["%s"] * len(action_ids))
    cursor.execute(
        f"""
        SELECT
          pa.id AS promise_action_id,
          pa.promise_id,
          pa.title AS action_title,
          pa.description,
          pa.related_policy_id,
          pr.slug AS promise_slug,
          pr.title AS promise_title,
          pol.id AS existing_policy_id,
          pol.title AS existing_policy_title
        FROM promise_actions pa
        JOIN promises pr ON pr.id = pa.promise_id
        LEFT JOIN policies pol ON pol.id = pa.related_policy_id
        WHERE pa.id IN ({placeholders})
        ORDER BY pa.id ASC
        """,
        action_ids,
    )
    return list(cursor.fetchall() or [])


def build_candidates(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows_by_action_id = {int(row["promise_action_id"]): row for row in rows}
    candidates = []

    for repair in SYSTEMIC_LINKAGE_REPAIRS:
        row = rows_by_action_id.get(repair["promise_action_id"])
        if not row:
            candidates.append(
                {
                    **repair,
                    "status": "missing_action_row",
                }
            )
            continue

        action_title = normalize_nullable_text(row.get("action_title"))
        related_policy_id = row.get("related_policy_id")
        alias_phrase = normalize_nullable_text(repair.get("alias_phrase"))

        status = "safe_auto_update"
        if action_title != repair["expected_action_title"]:
            status = "unexpected_action_title"
        elif alias_phrase and alias_phrase.lower() not in action_title.lower():
            status = "alias_validation_failed"
        elif related_policy_id == repair["policy_id"]:
            status = "already_linked"
        elif related_policy_id is not None and int(related_policy_id) != repair["policy_id"]:
            status = "preserve_existing_link"

        candidates.append(
            {
                **repair,
                "status": status,
                "promise_id": row.get("promise_id"),
                "promise_slug": row.get("promise_slug"),
                "promise_title": row.get("promise_title"),
                "action_title": action_title,
                "existing_related_policy_id": related_policy_id,
                "existing_related_policy_title": row.get("existing_policy_title"),
            }
        )

    return candidates


def apply_candidates(cursor, candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    updates = []
    for candidate in candidates:
        if candidate.get("status") != "safe_auto_update":
            continue
        cursor.execute(
            """
            UPDATE promise_actions
            SET related_policy_id = %s
            WHERE id = %s
              AND related_policy_id IS NULL
            """,
            (candidate["policy_id"], candidate["promise_action_id"]),
        )
        if cursor.rowcount:
            updates.append(
                {
                    "promise_action_id": candidate["promise_action_id"],
                    "promise_id": candidate["promise_id"],
                    "promise_slug": candidate["promise_slug"],
                    "promise_title": candidate["promise_title"],
                    "policy_id": candidate["policy_id"],
                    "policy_title": candidate["policy_title"],
                    "reason": candidate["reason"],
                    "rowcount": cursor.rowcount,
                }
            )
    return updates


def build_report(args: argparse.Namespace) -> dict[str, Any]:
    require_apply_confirmation(args.apply, args.yes)
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            rows = fetch_repair_rows(cursor)
            candidates = build_candidates(rows)
            applied = []
            if args.apply:
                applied = apply_candidates(cursor, candidates)
                connection.commit()
            else:
                connection.rollback()
    finally:
        connection.close()

    return {
        "workflow": "repair_systemic_linkage_gaps",
        "generated_at": utc_timestamp(),
        "database_mutated": bool(args.apply),
        "candidate_count": len(candidates),
        "safe_auto_update_count": sum(1 for candidate in candidates if candidate.get("status") == "safe_auto_update"),
        "applied_update_count": len(applied),
        "candidates": candidates,
        "applied_updates": applied,
    }


def main() -> None:
    args = parse_args()
    report = build_report(args)
    output_path = args.output or default_output_path(args.apply)
    write_json_file(output_path, report)
    print_json(
        {
            "ok": True,
            "output": str(output_path),
            "candidate_count": report["candidate_count"],
            "safe_auto_update_count": report["safe_auto_update_count"],
            "applied_update_count": report["applied_update_count"],
        }
    )


if __name__ == "__main__":
    main()
