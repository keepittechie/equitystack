#!/usr/bin/env python3
import argparse
from collections import Counter
from pathlib import Path
from typing import Any

from current_admin_common import (
    get_db_connection,
    get_reports_dir,
    normalize_nullable_text,
    print_json,
    utc_timestamp,
    write_json_file,
)


VALID_INTENT_CATEGORIES = {
    "equity_expanding",
    "equity_restricting",
    "neutral_administrative",
    "mixed_or_competing",
    "unclear",
}

TIME_DURATION_LABEL = "action_date_only"

# These are intentionally conservative exact-title mappings. They only apply
# when the production row exists and has at least one already-linked source.
INTENT_SEEDS = [
    {
        "title": "Emancipation Proclamation",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": (
            "Declared freedom for enslaved people in Confederate-controlled areas "
            "as a wartime measure and shifted federal policy toward emancipation."
        ),
        "rationale": "Official proclamation text and existing historical source links document the stated emancipation purpose.",
    },
    {
        "title": "13th Amendment",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": "Abolished slavery and involuntary servitude except as punishment for crime.",
        "rationale": "Constitutional text directly states the slavery/involuntary-servitude prohibition.",
    },
    {
        "title": "Civil Rights Act of 1866",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": (
            "Established federal civil-rights protections and citizenship-related legal rights "
            "for formerly enslaved people and other citizens."
        ),
        "rationale": "Public law and existing source link support the civil-rights protection intent.",
    },
    {
        "title": "14th Amendment",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": (
            "Constitutionalized birthright citizenship, due process, and equal protection guarantees."
        ),
        "rationale": "Constitutional text directly states citizenship, due process, and equal protection provisions.",
    },
    {
        "title": "15th Amendment",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": (
            "Prohibited denying or abridging voting rights based on race, color, or previous condition of servitude."
        ),
        "rationale": "Constitutional text directly states the race/color/previous-servitude voting-rights prohibition.",
    },
    {
        "title": "Enforcement Act of 1870",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": "Created federal enforcement tools to protect voting rights after the Fifteenth Amendment.",
        "rationale": "Existing congressional and statutory sources document post-Fifteenth-Amendment voting-rights enforcement.",
    },
    {
        "title": "Ku Klux Klan Act of 1871",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": (
            "Authorized federal action against organized violence and intimidation targeting civil and voting rights."
        ),
        "rationale": "Existing Senate and historical sources document enforcement against Klan violence and rights intimidation.",
    },
    {
        "title": "Civil Rights Act of 1875",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": "Sought to prohibit racial discrimination in public accommodations and related civic spaces.",
        "rationale": "Existing sources identify the act as a federal public-accommodations civil-rights law.",
    },
    {
        "title": "Plessy v. Ferguson",
        "policy_intent_category": "equity_restricting",
        "policy_intent_summary": (
            "Upheld state-imposed racial segregation under the separate-but-equal doctrine."
        ),
        "rationale": "The decision and existing court/archive sources document validation of legally segregated public facilities.",
    },
    {
        "title": "Brown v. Board of Education",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": "Held that state-sponsored racial segregation in public schools is unconstitutional.",
        "rationale": "Existing Supreme Court/archive sources document the school desegregation holding.",
    },
    {
        "title": "Civil Rights Act of 1964",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": (
            "Prohibited major forms of discrimination in public accommodations, federally funded programs, and employment."
        ),
        "rationale": "Existing congressional, archive, and DOJ sources document the act's civil-rights protections.",
    },
    {
        "title": "Voting Rights Act of 1965",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": (
            "Strengthened federal protections against racial discrimination in voting and election administration."
        ),
        "rationale": "Existing archive, congressional, and DOJ sources document the voting-rights enforcement purpose.",
    },
    {
        "title": "Fair Housing Act of 1968",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": (
            "Prohibited discrimination in housing transactions and created federal fair-housing enforcement authority."
        ),
        "rationale": "Existing HUD and DOJ sources document the fair-housing anti-discrimination purpose.",
    },
    {
        "title": "Civil Rights Act of 1991",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": (
            "Strengthened employment-discrimination remedies and clarified civil-rights enforcement after Supreme Court limits."
        ),
        "rationale": "Existing EEOC and congressional sources document the employment-discrimination remedy and enforcement purpose.",
    },
    {
        "title": "Fair Sentencing Act of 2010",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": (
            "Reduced the federal crack-to-powder cocaine sentencing disparity and related mandatory-minimum penalties."
        ),
        "rationale": "Existing Congress and DOJ sources document the sentencing-disparity reduction purpose.",
    },
    {
        "title": "FUTURE Act",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": (
            "Provided permanent mandatory funding support for HBCUs and other minority-serving institutions."
        ),
        "rationale": "Existing Congress source documents the minority-serving institution funding purpose.",
    },
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Backfill high-confidence policy outcome dates and historical policy intent metadata."
    )
    parser.add_argument("--output", type=Path, help="Backfill trace report JSON path")
    parser.add_argument("--apply", action="store_true", help="Apply safe backfills. Dry-run is default.")
    parser.add_argument("--yes", action="store_true", help="Required with --apply.")
    parser.add_argument("--limit-samples", type=int, default=25, help="Maximum sample rows per report section")
    return parser.parse_args()


def default_output_path() -> Path:
    return get_reports_dir() / "policy-time-intent-backfill-report.json"


def table_exists(cursor, table_name: str) -> bool:
    cursor.execute("SHOW TABLES LIKE %s", (table_name,))
    return cursor.fetchone() is not None


def get_table_columns(cursor, table_name: str) -> set[str]:
    cursor.execute(f"SHOW COLUMNS FROM {table_name}")
    return {str(row["Field"]) for row in cursor.fetchall() or []}


def fetch_policy_sources(cursor, policy_id: int) -> list[dict[str, Any]]:
    cursor.execute(
        """
        SELECT id, source_title, source_url, source_type, publisher, published_date
        FROM sources
        WHERE policy_id = %s
        ORDER BY id ASC
        """,
        (policy_id,),
    )
    return [serialize_source(row) for row in list(cursor.fetchall() or [])]


def serialize_source(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": int(row["id"]),
        "source_title": row.get("source_title"),
        "source_url": row.get("source_url"),
        "source_type": row.get("source_type"),
        "publisher": row.get("publisher"),
        "published_date": str(row["published_date"]) if row.get("published_date") else None,
    }


def fetch_policy_by_title(cursor, title: str) -> dict[str, Any] | None:
    cursor.execute(
        """
        SELECT
          p.id,
          p.title,
          p.policy_type,
          p.year_enacted,
          p.date_enacted,
          p.impact_direction,
          p.policy_intent_summary,
          p.policy_intent_category,
          (COALESCE(ps.directness_score, 0) * 2 +
           COALESCE(ps.material_impact_score, 0) * 2 +
           COALESCE(ps.evidence_score, 0) +
           COALESCE(ps.durability_score, 0) +
           COALESCE(ps.equity_score, 0) * 2 -
           COALESCE(ps.harm_offset_score, 0)) AS policy_impact_score,
          GROUP_CONCAT(DISTINCT pc.name ORDER BY pc.name SEPARATOR ', ') AS categories
        FROM policies p
        LEFT JOIN policy_scores ps ON ps.policy_id = p.id
        LEFT JOIN policy_policy_categories ppc ON ppc.policy_id = p.id
        LEFT JOIN policy_categories pc ON pc.id = ppc.category_id
        WHERE p.title = %s
          AND COALESCE(p.is_archived, 0) = 0
        GROUP BY
          p.id,
          p.title,
          p.policy_type,
          p.year_enacted,
          p.date_enacted,
          p.impact_direction,
          p.policy_intent_summary,
          p.policy_intent_category,
          policy_impact_score
        ORDER BY p.id ASC
        LIMIT 1
        """,
        (title,),
    )
    return cursor.fetchone()


def fetch_time_candidates(cursor) -> list[dict[str, Any]]:
    cursor.execute(
        """
        SELECT
          po.id AS policy_outcome_id,
          po.policy_id,
          po.record_key,
          po.outcome_summary,
          po.impact_start_date,
          po.impact_end_date,
          po.impact_duration_estimate,
          pr.title AS promise_title,
          COUNT(DISTINCT pa.action_date) AS distinct_action_date_count,
          MIN(pa.action_date) AS candidate_action_date,
          COUNT(DISTINCT pa.id) AS action_count,
          GROUP_CONCAT(
            DISTINCT CONCAT(pa.id, ': ', pa.action_date, ' | ', pa.title)
            ORDER BY pa.action_date, pa.id
            SEPARATOR ' ;; '
          ) AS action_references
        FROM policy_outcomes po
        LEFT JOIN promises pr
          ON po.policy_type = 'current_admin'
         AND pr.id = po.policy_id
        LEFT JOIN promise_actions pa
          ON pa.promise_id = po.policy_id
         AND pa.action_date IS NOT NULL
        WHERE po.policy_type = 'current_admin'
        GROUP BY
          po.id,
          po.policy_id,
          po.record_key,
          po.outcome_summary,
          po.impact_start_date,
          po.impact_end_date,
          po.impact_duration_estimate,
          pr.title
        ORDER BY po.policy_id ASC, po.id ASC
        """
    )
    return list(cursor.fetchall() or [])


def fetch_coverage(cursor) -> dict[str, Any]:
    cursor.execute(
        """
        SELECT
          COUNT(*) AS total_policy_outcomes,
          SUM(CASE WHEN impact_start_date IS NOT NULL THEN 1 ELSE 0 END) AS outcomes_with_impact_start_date,
          SUM(CASE WHEN impact_end_date IS NOT NULL THEN 1 ELSE 0 END) AS outcomes_with_impact_end_date,
          SUM(CASE WHEN impact_duration_estimate IS NOT NULL THEN 1 ELSE 0 END) AS outcomes_with_duration_estimate,
          SUM(CASE WHEN impact_start_date IS NOT NULL AND impact_end_date IS NOT NULL AND impact_end_date < impact_start_date THEN 1 ELSE 0 END) AS invalid_date_ranges
        FROM policy_outcomes
        """
    )
    time = cursor.fetchone() or {}
    cursor.execute(
        """
        SELECT
          COUNT(*) AS total_active_policies,
          SUM(CASE WHEN policy_intent_summary IS NOT NULL THEN 1 ELSE 0 END) AS policies_with_intent_summary,
          SUM(CASE WHEN policy_intent_category IS NOT NULL THEN 1 ELSE 0 END) AS policies_with_intent_category,
          SUM(CASE WHEN policy_intent_summary IS NOT NULL AND policy_intent_category IS NOT NULL THEN 1 ELSE 0 END) AS policies_with_complete_intent
        FROM policies
        WHERE COALESCE(is_archived, 0) = 0
        """
    )
    intent = cursor.fetchone() or {}
    return {
        **{key: int(value or 0) for key, value in time.items()},
        **{key: int(value or 0) for key, value in intent.items()},
    }


def pct(part: int, total: int) -> float:
    if not total:
        return 0
    return round(part / total, 4)


def add_percentages(coverage: dict[str, Any]) -> dict[str, Any]:
    total_outcomes = coverage.get("total_policy_outcomes", 0)
    total_policies = coverage.get("total_active_policies", 0)
    return {
        **coverage,
        "impact_start_date_coverage_pct": pct(coverage.get("outcomes_with_impact_start_date", 0), total_outcomes),
        "impact_end_date_coverage_pct": pct(coverage.get("outcomes_with_impact_end_date", 0), total_outcomes),
        "impact_duration_estimate_coverage_pct": pct(
            coverage.get("outcomes_with_duration_estimate", 0), total_outcomes
        ),
        "policy_intent_summary_coverage_pct": pct(coverage.get("policies_with_intent_summary", 0), total_policies),
        "policy_intent_category_coverage_pct": pct(coverage.get("policies_with_intent_category", 0), total_policies),
        "complete_policy_intent_coverage_pct": pct(coverage.get("policies_with_complete_intent", 0), total_policies),
    }


def build_intent_candidates(cursor) -> list[dict[str, Any]]:
    candidates = []
    for seed in INTENT_SEEDS:
        row = fetch_policy_by_title(cursor, seed["title"])
        if not row:
            candidates.append({"title": seed["title"], "status": "no_policy_found", "candidate": seed})
            continue

        sources = fetch_policy_sources(cursor, int(row["id"]))
        existing_summary = normalize_nullable_text(row.get("policy_intent_summary"))
        existing_category = normalize_nullable_text(row.get("policy_intent_category"))
        conflicts = []
        if existing_category and existing_category != seed["policy_intent_category"]:
            conflicts.append("existing_intent_category_differs")
        if existing_summary and existing_summary != seed["policy_intent_summary"]:
            conflicts.append("existing_intent_summary_differs")

        status = "safe_auto_update"
        if not sources:
            status = "operator_review_required"
            conflicts.append("no_existing_policy_source_link")
        elif conflicts:
            status = "preserve_existing"
        elif existing_summary and existing_category:
            status = "already_populated"

        candidates.append(
            {
                "status": status,
                "policy_id": int(row["id"]),
                "title": row["title"],
                "year_enacted": int(row["year_enacted"]) if row.get("year_enacted") is not None else None,
                "date_enacted": str(row["date_enacted"]) if row.get("date_enacted") else None,
                "policy_type": row.get("policy_type"),
                "categories": row.get("categories"),
                "impact_direction": row.get("impact_direction"),
                "policy_impact_score": int(row["policy_impact_score"] or 0),
                "existing_policy_intent_summary": existing_summary,
                "existing_policy_intent_category": existing_category,
                "recommended_policy_intent_summary": seed["policy_intent_summary"],
                "recommended_policy_intent_category": seed["policy_intent_category"],
                "rationale": seed["rationale"],
                "traceability": {
                    "source_basis": "Existing policy-linked source rows; no new source is created.",
                    "sources": sources[:5],
                    "source_count": len(sources),
                },
                "notes": conflicts,
            }
        )
    return candidates


def classify_time_candidate(row: dict[str, Any]) -> dict[str, Any]:
    notes = []
    existing_start = row.get("impact_start_date")
    existing_duration = normalize_nullable_text(row.get("impact_duration_estimate"))
    distinct_action_dates = int(row.get("distinct_action_date_count") or 0)
    candidate_date = row.get("candidate_action_date")

    status = "safe_auto_update"
    if existing_start:
        status = "already_populated"
        notes.append("impact_start_date_already_present")
    elif distinct_action_dates == 0 or not candidate_date:
        status = "no_temporal_signal"
        notes.append("no_promise_action_date")
    elif distinct_action_dates > 1:
        status = "operator_review_required"
        notes.append("multiple_promise_action_dates")

    return {
        "status": status,
        "policy_outcome_id": int(row["policy_outcome_id"]),
        "policy_id": int(row["policy_id"]),
        "record_key": row.get("record_key"),
        "promise_title": row.get("promise_title"),
        "outcome_summary": row.get("outcome_summary"),
        "existing_impact_start_date": str(existing_start) if existing_start else None,
        "existing_impact_end_date": str(row["impact_end_date"]) if row.get("impact_end_date") else None,
        "existing_impact_duration_estimate": existing_duration,
        "recommended_impact_start_date": str(candidate_date) if candidate_date else None,
        "recommended_impact_end_date": None,
        "recommended_impact_duration_estimate": TIME_DURATION_LABEL,
        "candidate_date_type": "action_date",
        "temporal_confidence": "medium",
        "rationale": (
            "The linked promise has exactly one distinct structured action_date; this is recorded as an action-date "
            "temporal anchor, not a precise outcome event date."
        )
        if status == "safe_auto_update"
        else "No safe single action-date temporal anchor is available.",
        "traceability": {
            "source_basis": "promise_actions.action_date",
            "action_count": int(row.get("action_count") or 0),
            "action_references": row.get("action_references"),
        },
        "notes": notes,
    }


def apply_intent_candidates(cursor, candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    updates = []
    for candidate in candidates:
        if candidate.get("status") != "safe_auto_update":
            continue
        cursor.execute(
            """
            UPDATE policies
            SET
              policy_intent_summary = COALESCE(policy_intent_summary, %s),
              policy_intent_category = COALESCE(policy_intent_category, %s)
            WHERE id = %s
              AND (policy_intent_summary IS NULL OR policy_intent_category IS NULL)
            """,
            (
                candidate["recommended_policy_intent_summary"],
                candidate["recommended_policy_intent_category"],
                candidate["policy_id"],
            ),
        )
        if cursor.rowcount:
            updates.append(
                {
                    "table": "policies",
                    "policy_id": candidate["policy_id"],
                    "title": candidate["title"],
                    "fields": ["policy_intent_summary", "policy_intent_category"],
                    "rowcount": cursor.rowcount,
                    "traceability": candidate["traceability"],
                    "rationale": candidate["rationale"],
                }
            )
    return updates


def apply_time_candidates(cursor, candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    updates = []
    for candidate in candidates:
        if candidate.get("status") != "safe_auto_update":
            continue
        cursor.execute(
            """
            UPDATE policy_outcomes
            SET
              impact_start_date = %s,
              impact_duration_estimate = COALESCE(impact_duration_estimate, %s)
            WHERE id = %s
              AND impact_start_date IS NULL
            """,
            (
                candidate["recommended_impact_start_date"],
                candidate["recommended_impact_duration_estimate"],
                candidate["policy_outcome_id"],
            ),
        )
        if cursor.rowcount:
            updates.append(
                {
                    "table": "policy_outcomes",
                    "policy_outcome_id": candidate["policy_outcome_id"],
                    "policy_id": candidate["policy_id"],
                    "record_key": candidate["record_key"],
                    "fields": ["impact_start_date", "impact_duration_estimate"],
                    "rowcount": cursor.rowcount,
                    "traceability": candidate["traceability"],
                    "rationale": candidate["rationale"],
                }
            )
    return updates


def count_by_status(candidates: list[dict[str, Any]]) -> dict[str, int]:
    return dict(sorted(Counter(candidate.get("status", "unknown") for candidate in candidates).items()))


def build_report(args: argparse.Namespace) -> dict[str, Any]:
    if args.apply and not args.yes:
        raise SystemExit("--apply requires --yes")

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            required = {
                "policies": {"policy_intent_summary", "policy_intent_category"},
                "policy_outcomes": {"impact_start_date", "impact_end_date", "impact_duration_estimate"},
            }
            missing_tables = [table for table in required if not table_exists(cursor, table)]
            missing_columns = {
                table: sorted(columns - get_table_columns(cursor, table))
                for table, columns in required.items()
                if table not in missing_tables
            }
            missing_columns = {table: columns for table, columns in missing_columns.items() if columns}
            if missing_tables or missing_columns:
                raise RuntimeError(f"Missing required storage. tables={missing_tables} columns={missing_columns}")

            before_coverage = add_percentages(fetch_coverage(cursor))
            intent_candidates = build_intent_candidates(cursor)
            time_candidates = [classify_time_candidate(row) for row in fetch_time_candidates(cursor)]

            applied_updates: list[dict[str, Any]] = []
            if args.apply:
                applied_updates.extend(apply_intent_candidates(cursor, intent_candidates))
                applied_updates.extend(apply_time_candidates(cursor, time_candidates))
                connection.commit()
            else:
                connection.rollback()

            after_coverage = add_percentages(fetch_coverage(cursor))

        safe_intent_count = sum(1 for candidate in intent_candidates if candidate.get("status") == "safe_auto_update")
        safe_time_count = sum(1 for candidate in time_candidates if candidate.get("status") == "safe_auto_update")
        summary = {
            "mode": "apply" if args.apply else "dry_run",
            "intent_seed_count": len(INTENT_SEEDS),
            "safe_intent_update_count": safe_intent_count,
            "safe_time_update_count": safe_time_count,
            "applied_update_count": len(applied_updates),
            "policy_intent_updates_applied": sum(1 for update in applied_updates if update["table"] == "policies"),
            "policy_outcome_time_updates_applied": sum(1 for update in applied_updates if update["table"] == "policy_outcomes"),
            "intent_status_counts": count_by_status(intent_candidates),
            "time_status_counts": count_by_status(time_candidates),
            "invalid_date_ranges_after": after_coverage["invalid_date_ranges"],
        }

        return {
            "workflow": "policy_time_intent_backfill",
            "generated_at": utc_timestamp(),
            "summary": summary,
            "coverage_before": before_coverage,
            "coverage_after": after_coverage,
            "rules": {
                "time_backfill": [
                    "Only current_admin policy_outcomes are considered because the unified table currently stores current_admin/legislative types.",
                    "A time value is auto-filled only when the linked promise has exactly one distinct structured promise_actions.action_date.",
                    "The value is recorded as action_date_only; it is not represented as a precise outcome event date.",
                    "impact_end_date remains NULL unless a real end date exists.",
                    "Existing impact_start_date values are preserved.",
                ],
                "intent_backfill": [
                    "Only exact-title curated seed policies are considered.",
                    "A seed is auto-filled only when the active policy row exists and has existing policy-linked source rows.",
                    "Existing policy_intent_* values are preserved and conflicts are not overwritten.",
                    "The database enum uses neutral_administrative; user-facing neutral_structural concepts should be mapped deliberately before use.",
                ],
            },
            "applied_updates": applied_updates,
            "candidate_groups": {
                "intent": {
                    "safe_auto_update": [c for c in intent_candidates if c.get("status") == "safe_auto_update"][: args.limit_samples],
                    "already_populated": [c for c in intent_candidates if c.get("status") == "already_populated"][: args.limit_samples],
                    "operator_review_required": [
                        c for c in intent_candidates if c.get("status") == "operator_review_required"
                    ][: args.limit_samples],
                    "preserve_existing": [c for c in intent_candidates if c.get("status") == "preserve_existing"][
                        : args.limit_samples
                    ],
                    "no_policy_found": [c for c in intent_candidates if c.get("status") == "no_policy_found"][: args.limit_samples],
                },
                "time": {
                    "safe_auto_update": [c for c in time_candidates if c.get("status") == "safe_auto_update"][
                        : args.limit_samples
                    ],
                    "already_populated": [c for c in time_candidates if c.get("status") == "already_populated"][
                        : args.limit_samples
                    ],
                    "operator_review_required": [
                        c for c in time_candidates if c.get("status") == "operator_review_required"
                    ][: args.limit_samples],
                    "no_temporal_signal": [c for c in time_candidates if c.get("status") == "no_temporal_signal"][
                        : args.limit_samples
                    ],
                },
            },
            "remaining_gaps": {
                "policy_outcomes_without_impact_start_date": after_coverage["total_policy_outcomes"]
                - after_coverage["outcomes_with_impact_start_date"],
                "active_policies_without_complete_intent": after_coverage["total_active_policies"]
                - after_coverage["policies_with_complete_intent"],
                "notes": [
                    "Multi-action promises need operator review before choosing an impact_start_date.",
                    "Historical policies outside the curated seed list need source-backed manual intent curation.",
                    "No precise dates were created from free text.",
                ],
            },
        }
    finally:
        connection.close()


def main() -> None:
    args = parse_args()
    output = (args.output or default_output_path()).resolve()
    report = build_report(args)
    write_json_file(output, report)
    print_json({"ok": True, "output": str(output), **report["summary"]})


if __name__ == "__main__":
    main()
