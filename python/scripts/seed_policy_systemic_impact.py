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
    require_apply_confirmation,
    utc_timestamp,
    write_json_file,
)
from policy_systemic_common import SYSTEMIC_IMPACT_COLUMNS, VALID_SYSTEMIC_IMPACT_CATEGORIES


SYSTEMIC_SEEDS = [
    {
        "title": "Civil Rights Act of 1866",
        "systemic_impact_category": "transformational",
        "systemic_impact_summary": "Established a foundational federal civil-rights and citizenship framework that reshaped the legal baseline for later Reconstruction and equal-protection enforcement.",
        "rationale": "Foundational post-Civil War civil-rights architecture with enduring structural consequences.",
    },
    {
        "title": "Reconstruction Acts",
        "systemic_impact_category": "transformational",
        "systemic_impact_summary": "Reorganized southern governance under federal enforcement and created a durable new framework for Black political participation during Reconstruction.",
        "rationale": "Major Reconstruction enforcement framework with broad institutional reach.",
    },
    {
        "title": "Ku Klux Klan Act of 1871",
        "systemic_impact_category": "strong",
        "systemic_impact_summary": "Expanded federal enforcement capacity against racial terror and civil-rights violations, strengthening the institutional machinery behind Reconstruction protections.",
        "rationale": "High-impact federal enforcement law with durable institutional effects.",
    },
    {
        "title": "Civil Rights Act of 1964",
        "systemic_impact_category": "transformational",
        "systemic_impact_summary": "Created a durable national anti-discrimination framework across public accommodations, employment, and federally supported programs.",
        "rationale": "Foundational civil-rights enforcement architecture with broad downstream institutional effects.",
    },
    {
        "title": "Voting Rights Act of 1965",
        "systemic_impact_category": "transformational",
        "systemic_impact_summary": "Rebuilt the federal voting-rights enforcement architecture through preclearance, oversight, and direct protection of ballot access.",
        "rationale": "Major long-run voting-rights framework law.",
    },
    {
        "title": "Voting Rights Act Reauthorization of 2006",
        "systemic_impact_category": "strong",
        "systemic_impact_summary": "Extended a durable federal voting-rights enforcement framework by preserving the statute's core oversight tools.",
        "rationale": "Major renewal of an existing structural voting-rights regime.",
    },
    {
        "title": "Fair Housing Act of 1968",
        "systemic_impact_category": "strong",
        "systemic_impact_summary": "Established a durable national fair-housing enforcement framework that shaped later anti-discrimination housing policy.",
        "rationale": "Long-run housing discrimination framework.",
    },
    {
        "title": "Affordable Care Act",
        "systemic_impact_category": "strong",
        "systemic_impact_summary": "Created a durable nationwide healthcare coverage framework with ongoing institutional effects on access, subsidies, and insurance regulation.",
        "rationale": "Major healthcare architecture law with durable structural consequences.",
    },
    {
        "title": "Brown v. Board of Education",
        "systemic_impact_category": "transformational",
        "systemic_impact_summary": "Reset constitutional doctrine around segregation and reshaped the legal baseline for later civil-rights enforcement.",
        "rationale": "High-impact civil-rights precedent with long-run doctrinal effects.",
    },
    {
        "title": "Shelley v. Kraemer",
        "systemic_impact_category": "strong",
        "systemic_impact_summary": "Closed off judicial enforcement of racially restrictive housing covenants, changing the constitutional boundaries of housing exclusion and private discrimination enforcement.",
        "rationale": "Durable housing-rights precedent with broad downstream consequences.",
    },
    {
        "title": "Civil Rights Act of 1957",
        "systemic_impact_category": "strong",
        "systemic_impact_summary": "Reintroduced modern federal civil-rights enforcement capacity by strengthening voting-rights oversight and creating durable Justice Department enforcement infrastructure.",
        "rationale": "Major modern civil-rights enforcement restoration with institutional spillover.",
    },
    {
        "title": "Civil Rights Act of 1960",
        "systemic_impact_category": "strong",
        "systemic_impact_summary": "Deepened the federal voting-rights enforcement framework by expanding inspection, preservation, and court-enforcement tools around registration and election records.",
        "rationale": "Durable voting-rights enforcement expansion with long-run structural effects.",
    },
    {
        "title": "Civil Rights Act of 1875",
        "systemic_impact_category": "strong",
        "systemic_impact_summary": "Attempted to extend a durable post-Reconstruction civil-rights enforcement framework into public accommodations before later judicial rollback.",
        "rationale": "Broad federal civil-rights framework effort with downstream institutional significance.",
    },
    {
        "title": "Civil Rights Cases (1883)",
        "systemic_impact_category": "transformational",
        "systemic_impact_summary": "Rolled back federal protection against private racial discrimination and helped clear doctrinal space for the long-run architecture of Jim Crow exclusion.",
        "rationale": "Major restrictive civil-rights precedent with foundational downstream effects.",
    },
    {
        "title": "Plessy v. Ferguson",
        "systemic_impact_category": "transformational",
        "systemic_impact_summary": "Entrenched the constitutional legitimacy of segregation and shaped long-run discriminatory doctrine across public institutions.",
        "rationale": "Major restrictive precedent with enduring systemic consequences.",
    },
    {
        "title": "Williams v. Mississippi",
        "systemic_impact_category": "strong",
        "systemic_impact_summary": "Legitimated durable voter-suppression architecture by allowing discriminatory voting restrictions to stand under federal constitutional review.",
        "rationale": "High-impact restrictive precedent shaping long-run voting exclusion.",
    },
    {
        "title": "Swann v. Charlotte-Mecklenburg Board of Education",
        "systemic_impact_category": "strong",
        "systemic_impact_summary": "Affirmed broad judicial authority to dismantle segregation in public schools, shaping long-run enforcement doctrine around school desegregation remedies.",
        "rationale": "Major desegregation-remedy precedent with durable doctrinal reach.",
    },
    {
        "title": "Civil Rights Restoration Act of 1987",
        "systemic_impact_category": "strong",
        "systemic_impact_summary": "Restored broad federal anti-discrimination coverage across whole institutions receiving federal aid, reinforcing the durability of civil-rights enforcement infrastructure.",
        "rationale": "Long-run restoration of federal civil-rights coverage and enforcement scope.",
    },
    {
        "title": "Civil Rights Act of 1991",
        "systemic_impact_category": "strong",
        "systemic_impact_summary": "Expanded the durability of employment-discrimination enforcement by restoring key rights, remedies, and burdens of proof across federal civil-rights law.",
        "rationale": "Broad enforcement and remedies expansion with durable institutional effects.",
    },
    {
        "title": "Prison Litigation Reform Act",
        "systemic_impact_category": "strong",
        "systemic_impact_summary": "Imposed durable barriers on incarcerated people seeking federal court relief, shaping the long-run institutional balance of power in prison oversight and civil-rights enforcement.",
        "rationale": "Major criminal-justice law with broad downstream institutional consequences.",
    },
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Seed a small high-confidence set of policy systemic-impact classifications."
    )
    parser.add_argument("--output", type=Path, help="Output report JSON path")
    parser.add_argument("--apply", action="store_true", help="Write systemic-impact metadata")
    parser.add_argument("--yes", action="store_true", help="Required confirmation for --apply")
    return parser.parse_args()


def default_output_path(apply: bool) -> Path:
    suffix = "apply" if apply else "dry-run"
    return get_reports_dir() / f"policy-systemic-impact-seed.{suffix}.json"


def table_exists(cursor, table_name: str) -> bool:
    cursor.execute("SHOW TABLES LIKE %s", (table_name,))
    return cursor.fetchone() is not None


def get_table_columns(cursor, table_name: str) -> set[str]:
    cursor.execute(f"SHOW COLUMNS FROM {table_name}")
    return {str(row["Field"]) for row in cursor.fetchall() or []}


def ensure_systemic_storage(cursor) -> None:
    if not table_exists(cursor, "policies"):
        raise RuntimeError("policies table does not exist")
    columns = get_table_columns(cursor, "policies")
    missing = sorted(SYSTEMIC_IMPACT_COLUMNS - columns)
    if missing:
        raise RuntimeError(f"policies table is missing systemic-impact columns: {', '.join(missing)}")


def fetch_seed_targets(cursor) -> list[dict[str, Any]]:
    placeholders = ", ".join(["%s"] * len(SYSTEMIC_SEEDS))
    cursor.execute(
        f"""
        SELECT
          id AS policy_id,
          title,
          policy_type,
          year_enacted,
          impact_direction,
          systemic_impact_category,
          systemic_impact_summary,
          COALESCE(is_archived, 0) AS is_archived
        FROM policies
        WHERE title IN ({placeholders})
          AND COALESCE(is_archived, 0) = 0
        ORDER BY id ASC
        """,
        [seed["title"] for seed in SYSTEMIC_SEEDS],
    )
    return list(cursor.fetchall() or [])


def build_candidates(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_title = {}
    for row in rows:
        by_title.setdefault(str(row["title"]), []).append(row)

    candidates = []
    for seed in SYSTEMIC_SEEDS:
        matches = by_title.get(seed["title"], [])
        if not matches:
            candidates.append({"title": seed["title"], "status": "no_policy_found", "seed": seed})
            continue
        for row in matches:
            existing_category = normalize_nullable_text(row.get("systemic_impact_category"))
            existing_summary = normalize_nullable_text(row.get("systemic_impact_summary"))
            desired_category = seed["systemic_impact_category"]
            desired_summary = seed["systemic_impact_summary"]

            status = "safe_auto_update"
            if existing_category == desired_category and existing_summary == desired_summary:
                status = "already_populated"
            elif existing_category and existing_category != desired_category:
                status = "preserve_existing"
            elif existing_summary and existing_summary != desired_summary:
                status = "preserve_existing"

            candidates.append(
                {
                    "policy_id": int(row["policy_id"]),
                    "title": row.get("title"),
                    "policy_type": row.get("policy_type"),
                    "year_enacted": row.get("year_enacted"),
                    "impact_direction": row.get("impact_direction"),
                    "existing_systemic_impact_category": existing_category,
                    "existing_systemic_impact_summary": existing_summary,
                    "recommended_systemic_impact_category": desired_category,
                    "recommended_systemic_impact_summary": desired_summary,
                    "status": status,
                    "rationale": seed["rationale"],
                }
            )
    return candidates


def apply_candidates(cursor, candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    updates = []
    for candidate in candidates:
        if candidate.get("status") != "safe_auto_update":
            continue
        category = candidate["recommended_systemic_impact_category"]
        summary = candidate["recommended_systemic_impact_summary"]
        if category not in VALID_SYSTEMIC_IMPACT_CATEGORIES:
            raise RuntimeError(f"Unsupported systemic impact category {category!r}")
        cursor.execute(
            """
            UPDATE policies
            SET
              systemic_impact_category = %s,
              systemic_impact_summary = %s
            WHERE id = %s
              AND COALESCE(is_archived, 0) = 0
              AND (
                systemic_impact_category IS NULL
                OR systemic_impact_summary IS NULL
              )
            """,
            (category, summary, candidate["policy_id"]),
        )
        if cursor.rowcount:
            updates.append(
                {
                    "policy_id": candidate["policy_id"],
                    "title": candidate["title"],
                    "systemic_impact_category": category,
                    "systemic_impact_summary": summary,
                    "rationale": candidate["rationale"],
                    "fields": ["systemic_impact_category", "systemic_impact_summary"],
                    "rowcount": cursor.rowcount,
                }
            )
    return updates


def fetch_coverage(cursor) -> dict[str, Any]:
    cursor.execute(
        """
        SELECT
          COUNT(*) AS total_policies,
          SUM(CASE WHEN systemic_impact_category IS NOT NULL THEN 1 ELSE 0 END) AS classified_policies
        FROM policies
        WHERE COALESCE(is_archived, 0) = 0
        """
    )
    row = cursor.fetchone() or {}
    total = int(row.get("total_policies") or 0)
    classified = int(row.get("classified_policies") or 0)
    return {
        "total_policies": total,
        "classified_policies": classified,
        "classified_policy_pct": round(classified / total, 4) if total else 0,
    }


def count_by_status(candidates: list[dict[str, Any]]) -> dict[str, int]:
    return dict(sorted(Counter(candidate.get("status", "unknown") for candidate in candidates).items()))


def build_report(args: argparse.Namespace) -> dict[str, Any]:
    require_apply_confirmation(args.apply, args.yes)
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            ensure_systemic_storage(cursor)
            before_coverage = fetch_coverage(cursor)
            candidates = build_candidates(fetch_seed_targets(cursor))
            applied_updates = []
            if args.apply:
                applied_updates = apply_candidates(cursor, candidates)
                connection.commit()
            else:
                connection.rollback()
            after_coverage = fetch_coverage(cursor)
    finally:
        connection.close()

    return {
        "workflow": "policy_systemic_impact_seed",
        "generated_at": utc_timestamp(),
        "mode": "apply" if args.apply else "dry_run",
        "database_mutated": bool(args.apply),
        "seed_count": len(SYSTEMIC_SEEDS),
        "coverage_before": before_coverage,
        "coverage_after": after_coverage,
        "summary": {
            "candidate_status_counts": count_by_status(candidates),
            "applied_update_count": len(applied_updates),
            "classified_policy_delta": after_coverage["classified_policies"] - before_coverage["classified_policies"],
        },
        "seed_titles": [seed["title"] for seed in SYSTEMIC_SEEDS],
        "candidates": candidates,
        "applied_updates": applied_updates,
    }


def main() -> None:
    args = parse_args()
    output_path = (args.output or default_output_path(args.apply)).resolve()
    report = build_report(args)
    write_json_file(output_path, report)
    print_json({"ok": True, "output": str(output_path), **report["summary"]})


if __name__ == "__main__":
    main()
