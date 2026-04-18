#!/usr/bin/env python3
import argparse
from collections import Counter
from pathlib import Path
from typing import Any

from current_admin_common import (
    get_db_connection,
    get_reports_dir,
    print_json,
    utc_timestamp,
    write_json_file,
)
from repair_systemic_linkage_gaps import SYSTEMIC_LINKAGE_REPAIRS


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Audit whether systemically classified policies reach the active live outcome-scoring paths."
    )
    parser.add_argument("--output", type=Path, help="Output report JSON path")
    return parser.parse_args()


def default_output_path() -> Path:
    return get_reports_dir() / "systemic-linkage-coverage-audit.json"


def fetch_classified_policies(cursor) -> list[dict[str, Any]]:
    cursor.execute(
        """
        SELECT
          id,
          title,
          year_enacted,
          policy_type,
          impact_direction,
          systemic_impact_category,
          systemic_impact_summary
        FROM policies
        WHERE COALESCE(is_archived, 0) = 0
          AND systemic_impact_category IS NOT NULL
        ORDER BY year_enacted ASC, title ASC
        """
    )
    return list(cursor.fetchall() or [])


def fetch_one_value(cursor, sql: str, params: tuple[Any, ...]) -> int:
    cursor.execute(sql, params)
    row = cursor.fetchone() or {}
    return int(row.get("total") or 0)


def fetch_repair_candidate_map() -> dict[int, dict[str, Any]]:
    return {int(item["policy_id"]): item for item in SYSTEMIC_LINKAGE_REPAIRS}


def audit_policy(cursor, policy: dict[str, Any], repair_candidates: dict[int, dict[str, Any]]) -> dict[str, Any]:
    policy_id = int(policy["id"])
    title = policy["title"]
    repair_candidate = repair_candidates.get(policy_id)
    repair_candidate_pending = 0
    if repair_candidate:
        repair_candidate_pending = fetch_one_value(
            cursor,
            """
            SELECT COUNT(*) AS total
            FROM promise_actions
            WHERE id = %s
              AND related_policy_id IS NULL
            """,
            (repair_candidate["promise_action_id"],),
        )

    explicit_action_links = fetch_one_value(
        cursor,
        """
        SELECT COUNT(*) AS total
        FROM promise_actions
        WHERE related_policy_id = %s
        """,
        (policy_id,),
    )
    exact_title_action_links = fetch_one_value(
        cursor,
        """
        SELECT COUNT(*) AS total
        FROM promise_actions
        WHERE related_policy_id IS NULL
          AND (
            CONVERT(title USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE CONCAT('%%', CONVERT(%s USING utf8mb4) COLLATE utf8mb4_unicode_ci, '%%')
            OR CONVERT(description USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE CONCAT('%%', CONVERT(%s USING utf8mb4) COLLATE utf8mb4_unicode_ci, '%%')
          )
        """,
        (title, title),
    )
    final_report_active_outcomes = fetch_one_value(
        cursor,
        """
        SELECT COUNT(DISTINCT po.id) AS total
        FROM promise_actions pa
        JOIN policy_outcomes po
          ON po.policy_type = 'current_admin'
         AND po.policy_id = pa.promise_id
        WHERE (
            pa.related_policy_id = %s
            OR (
              pa.related_policy_id IS NULL
              AND (
                CONVERT(pa.title USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE CONCAT('%%', CONVERT(%s USING utf8mb4) COLLATE utf8mb4_unicode_ci, '%%')
                OR CONVERT(pa.description USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE CONCAT('%%', CONVERT(%s USING utf8mb4) COLLATE utf8mb4_unicode_ci, '%%')
              )
            )
          )
        """,
        (policy_id, title, title),
    )
    public_service_active_outcomes = fetch_one_value(
        cursor,
        """
        SELECT COUNT(DISTINCT uo.id) AS total
        FROM promise_actions pa
        JOIN promise_outcomes po
          ON po.promise_id = pa.promise_id
        JOIN policy_outcomes uo
          ON uo.policy_type = 'current_admin'
         AND uo.policy_id = pa.promise_id
         AND uo.outcome_summary_hash = SHA2(TRIM(po.outcome_summary), 256)
        WHERE (
            pa.related_policy_id = %s
            OR (
              pa.related_policy_id IS NULL
              AND (
                CONVERT(pa.title USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE CONCAT('%%', CONVERT(%s USING utf8mb4) COLLATE utf8mb4_unicode_ci, '%%')
                OR CONVERT(pa.description USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE CONCAT('%%', CONVERT(%s USING utf8mb4) COLLATE utf8mb4_unicode_ci, '%%')
              )
            )
          )
        """,
        (policy_id, title, title),
    )
    direct_judicial_outcomes = fetch_one_value(
        cursor,
        """
        SELECT COUNT(*) AS total
        FROM policy_outcomes
        WHERE policy_type = 'judicial_impact'
          AND policy_id = %s
        """,
        (policy_id,),
    )
    raw_current_admin_id_overlap = fetch_one_value(
        cursor,
        """
        SELECT COUNT(*) AS total
        FROM policy_outcomes
        WHERE policy_type = 'current_admin'
          AND policy_id = %s
        """,
        (policy_id,),
    )
    raw_legislative_id_overlap = fetch_one_value(
        cursor,
        """
        SELECT COUNT(*) AS total
        FROM policy_outcomes
        WHERE policy_type = 'legislative'
          AND policy_id = %s
        """,
        (policy_id,),
    )

    status = "classified but not linked to any active outcome"
    reason = (
        "No active promise_action or judicial linkage currently resolves this policy into the score path."
    )

    if final_report_active_outcomes > 0 and public_service_active_outcomes > 0:
        status = "linked and active in live scoring"
        reason = (
            "Active current-admin linkage exists through promise_actions, so the final report and public score-service paths both receive this policy's systemic metadata."
        )
    elif final_report_active_outcomes > 0 or public_service_active_outcomes > 0:
        status = "linked ambiguously / mixed"
        reason = (
            "A partial score-path linkage exists, but one of the live score surfaces still does not resolve it consistently."
        )
    elif repair_candidate and repair_candidate_pending > 0:
        status = "blocked by missing relation data"
        reason = repair_candidate["reason"]
    elif direct_judicial_outcomes > 0:
        status = "linked and active in live scoring"
        reason = "This policy is directly referenced by a judicial_impact outcome and does not rely on promise_actions linkage."
    elif explicit_action_links > 0 or exact_title_action_links > 0:
        status = "blocked by query/runtime matching limitations"
        reason = (
            "Promise-action evidence exists, but the active score path is not currently turning that evidence into a scored current-admin outcome."
        )
    elif raw_current_admin_id_overlap > 0 or raw_legislative_id_overlap > 0:
        status = "intentionally excluded from current score family"
        reason = (
            "This policy only shares a numeric id with current_admin or legislative outcome rows. Without a canonical promise_action or judicial linkage, those overlaps are not valid score-path links."
        )

    return {
        "policy_id": policy_id,
        "title": policy["title"],
        "year_enacted": policy.get("year_enacted"),
        "policy_type": policy.get("policy_type"),
        "impact_direction": policy.get("impact_direction"),
        "systemic_impact_category": policy.get("systemic_impact_category"),
        "systemic_impact_summary": policy.get("systemic_impact_summary"),
        "explicit_action_links": explicit_action_links,
        "exact_title_action_links": exact_title_action_links,
        "final_report_active_outcomes": final_report_active_outcomes,
        "public_service_active_outcomes": public_service_active_outcomes,
        "direct_judicial_outcomes": direct_judicial_outcomes,
        "raw_current_admin_id_overlap": raw_current_admin_id_overlap,
        "raw_legislative_id_overlap": raw_legislative_id_overlap,
        "repair_candidate": repair_candidate,
        "repair_candidate_pending": bool(repair_candidate_pending),
        "status": status,
        "reason": reason,
    }


def build_report() -> dict[str, Any]:
    connection = get_db_connection()
    repair_candidates = fetch_repair_candidate_map()
    try:
        with connection.cursor() as cursor:
            rows = [audit_policy(cursor, policy, repair_candidates) for policy in fetch_classified_policies(cursor)]
    finally:
        connection.close()

    status_counts = dict(sorted(Counter(row["status"] for row in rows).items()))

    return {
        "workflow": "audit_systemic_linkage_coverage",
        "generated_at": utc_timestamp(),
        "classified_policy_count": len(rows),
        "status_counts": status_counts,
        "active_in_final_report_count": sum(1 for row in rows if row["final_report_active_outcomes"] > 0),
        "active_in_public_service_count": sum(1 for row in rows if row["public_service_active_outcomes"] > 0),
        "blocked_missing_relation_data_count": sum(1 for row in rows if row["status"] == "blocked by missing relation data"),
        "rows": rows,
    }


def main() -> None:
    args = parse_args()
    report = build_report()
    output_path = args.output or default_output_path()
    write_json_file(output_path, report)
    print_json(
        {
            "ok": True,
            "output": str(output_path),
            "classified_policy_count": report["classified_policy_count"],
            "status_counts": report["status_counts"],
            "active_in_final_report_count": report["active_in_final_report_count"],
            "active_in_public_service_count": report["active_in_public_service_count"],
        }
    )


if __name__ == "__main__":
    main()
