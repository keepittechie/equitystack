#!/usr/bin/env python3
import argparse
from collections import Counter, defaultdict
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


INTENT_COLUMNS = {"policy_intent_summary", "policy_intent_category"}
VALID_INTENT_CATEGORIES = {
    "equity_expanding",
    "equity_restricting",
    "neutral_administrative",
    "mixed_or_competing",
    "unclear",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Read-only policy intent vs outcome alignment report."
    )
    parser.add_argument("--output", type=Path, help="Policy intent alignment report JSON path")
    parser.add_argument("--include-archived", action="store_true", help="Include archived policies")
    parser.add_argument("--limit-samples", type=int, default=25, help="Maximum sample rows per section")
    return parser.parse_args()


def default_output_path() -> Path:
    return get_reports_dir() / "policy-intent-alignment-report.json"


def table_exists(cursor, table_name: str) -> bool:
    cursor.execute("SHOW TABLES LIKE %s", (table_name,))
    return cursor.fetchone() is not None


def get_table_columns(cursor, table_name: str) -> set[str]:
    cursor.execute(f"SHOW COLUMNS FROM {table_name}")
    return {str(row["Field"]) for row in cursor.fetchall() or []}


def column_expr(columns: set[str], column: str) -> str:
    if column in columns:
        return f"p.{column} AS {column}"
    return f"NULL AS {column}"


def fetch_policies(cursor, columns: set[str], include_archived: bool) -> list[dict[str, Any]]:
    where_clause = "" if include_archived else "WHERE COALESCE(p.is_archived, 0) = 0"
    cursor.execute(
        f"""
        SELECT
          p.id,
          p.title,
          p.year_enacted,
          p.impact_direction,
          p.status,
          p.is_archived,
          {column_expr(columns, "policy_intent_summary")},
          {column_expr(columns, "policy_intent_category")},
          pr.full_name AS president_name,
          pr.slug AS president_slug,
          er.name AS era_name
        FROM policies p
        LEFT JOIN presidents pr ON pr.id = p.president_id
        LEFT JOIN eras er ON er.id = p.era_id
        {where_clause}
        ORDER BY p.year_enacted ASC, p.title ASC, p.id ASC
        """
    )
    return list(cursor.fetchall() or [])


def normalize_intent_category(value: Any) -> str | None:
    text = normalize_nullable_text(value)
    if text is None:
        return None
    normalized = text.strip().lower().replace("-", "_")
    return normalized if normalized in VALID_INTENT_CATEGORIES else None


def normalize_impact_direction(value: Any) -> str | None:
    text = normalize_nullable_text(value)
    if text is None:
        return None
    normalized = text.strip().lower()
    if normalized == "positive":
        return "Positive"
    if normalized == "negative":
        return "Negative"
    if normalized == "mixed":
        return "Mixed"
    if normalized == "blocked":
        return "Blocked"
    return None


def compare_intent_vs_outcome(policy: dict[str, Any]) -> dict[str, Any]:
    intent_summary = normalize_nullable_text(policy.get("policy_intent_summary"))
    intent_category = normalize_intent_category(policy.get("policy_intent_category"))
    impact_direction = normalize_impact_direction(policy.get("impact_direction"))

    if not intent_summary and not intent_category:
        return {
            "classification": "unclassified",
            "intent_category": None,
            "impact_direction": impact_direction,
            "rationale": "No explicit policy intent is recorded; classification is not inferred.",
            "notes": ["intent_missing"],
        }

    if not intent_category:
        return {
            "classification": "mixed",
            "intent_category": None,
            "impact_direction": impact_direction,
            "rationale": "Intent summary exists but no structured intent category is recorded.",
            "notes": ["intent_category_missing"],
        }

    if not impact_direction:
        return {
            "classification": "mixed",
            "intent_category": intent_category,
            "impact_direction": None,
            "rationale": "Structured intent exists, but policy impact direction is missing.",
            "notes": ["impact_direction_missing"],
        }

    if intent_category in {"mixed_or_competing", "unclear"}:
        return {
            "classification": "mixed",
            "intent_category": intent_category,
            "impact_direction": impact_direction,
            "rationale": "Intent is mixed, competing, or unclear.",
            "notes": [],
        }

    if intent_category == "neutral_administrative":
        return {
            "classification": "aligned" if impact_direction == "Mixed" else "mixed",
            "intent_category": intent_category,
            "impact_direction": impact_direction,
            "rationale": "Neutral/administrative intent is only aligned with mixed impact direction.",
            "notes": [],
        }

    if intent_category == "equity_expanding":
        classification = (
            "aligned"
            if impact_direction == "Positive"
            else "mixed"
            if impact_direction == "Mixed"
            else "misaligned"
        )
        return {
            "classification": classification,
            "intent_category": intent_category,
            "impact_direction": impact_direction,
            "rationale": "Equity-expanding intent aligns with positive impact direction.",
            "notes": [],
        }

    if intent_category == "equity_restricting":
        classification = (
            "aligned"
            if impact_direction == "Negative"
            else "mixed"
            if impact_direction == "Mixed"
            else "misaligned"
        )
        return {
            "classification": classification,
            "intent_category": intent_category,
            "impact_direction": impact_direction,
            "rationale": "Equity-restricting intent analytically aligns with negative impact direction.",
            "notes": [],
        }

    return {
        "classification": "mixed",
        "intent_category": intent_category,
        "impact_direction": impact_direction,
        "rationale": "Intent/outcome relationship needs manual review.",
        "notes": ["manual_review_required"],
    }


def sample_policy(row: dict[str, Any], comparison: dict[str, Any]) -> dict[str, Any]:
    return {
        "policy_id": row.get("id"),
        "title": row.get("title"),
        "year_enacted": row.get("year_enacted"),
        "president_slug": row.get("president_slug"),
        "president_name": row.get("president_name"),
        "era_name": row.get("era_name"),
        "policy_intent_category": comparison.get("intent_category"),
        "impact_direction": comparison.get("impact_direction"),
        "classification": comparison.get("classification"),
        "rationale": comparison.get("rationale"),
        "notes": comparison.get("notes") or [],
    }


def summarize(rows: list[dict[str, Any]], limit_samples: int) -> dict[str, Any]:
    distribution = Counter()
    by_admin: dict[str, Counter] = defaultdict(Counter)
    by_era: dict[str, Counter] = defaultdict(Counter)
    samples: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for row in rows:
        comparison = compare_intent_vs_outcome(row)
        classification = comparison["classification"]
        distribution[classification] += 1

        admin_key = normalize_nullable_text(row.get("president_slug")) or "unknown-president"
        era_key = normalize_nullable_text(row.get("era_name")) or "Unknown Era"
        by_admin[admin_key][classification] += 1
        by_era[era_key][classification] += 1

        if len(samples[classification]) < limit_samples:
            samples[classification].append(sample_policy(row, comparison))

    classified_count = distribution["aligned"] + distribution["mixed"] + distribution["misaligned"]
    return {
        "total_policies": len(rows),
        "classified_policy_count": classified_count,
        "unclassified_policy_count": distribution["unclassified"],
        "distribution": dict(sorted(distribution.items())),
        "percentages": {
            "aligned": round(distribution["aligned"] / classified_count, 4) if classified_count else 0,
            "mixed": round(distribution["mixed"] / classified_count, 4) if classified_count else 0,
            "misaligned": round(distribution["misaligned"] / classified_count, 4) if classified_count else 0,
        },
        "patterns_across_administrations": [
            {"president_slug": key, **dict(sorted(counter.items()))}
            for key, counter in sorted(by_admin.items())
        ],
        "patterns_across_eras": [
            {"era_name": key, **dict(sorted(counter.items()))}
            for key, counter in sorted(by_era.items())
        ],
        "sample_rows": {key: value for key, value in sorted(samples.items())},
    }


def build_report(args: argparse.Namespace) -> dict[str, Any]:
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            if not table_exists(cursor, "policies"):
                raise RuntimeError("policies table does not exist")
            columns = get_table_columns(cursor, "policies")
            missing_columns = sorted(INTENT_COLUMNS - columns)
            rows = fetch_policies(cursor, columns, args.include_archived)

    return {
        "workflow": "policy_intent_alignment_report",
        "generated_at": utc_timestamp(),
        "mode": "read_only",
        "storage_ready": not missing_columns,
        "missing_intent_columns": missing_columns,
        "intent_categories": sorted(VALID_INTENT_CATEGORIES),
        "normalization_rules": {
            "equity_expanding": "Positive impact direction -> aligned; Mixed -> mixed; Negative/Blocked -> misaligned.",
            "equity_restricting": "Negative impact direction -> aligned; Mixed -> mixed; Positive/Blocked -> misaligned.",
            "neutral_administrative": "Mixed impact direction -> aligned; directional outcomes -> mixed.",
            "mixed_or_competing": "Always mixed.",
            "unclear": "Always mixed.",
            "missing_intent": "Unclassified; intent is not inferred from titles or outcomes.",
        },
        "summary": summarize(rows, args.limit_samples),
    }


def main() -> None:
    args = parse_args()
    output_path = args.output or default_output_path()
    report = build_report(args)
    write_json_file(output_path, report)
    print_json(
        {
            "output": str(output_path),
            "storage_ready": report["storage_ready"],
            **report["summary"],
        }
    )


if __name__ == "__main__":
    main()
