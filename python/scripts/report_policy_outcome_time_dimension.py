#!/usr/bin/env python3
import argparse
from collections import Counter, defaultdict
from datetime import date
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


TIME_COLUMNS = {"impact_start_date", "impact_end_date", "impact_duration_estimate"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Read-only time-dimension report for unified policy_outcomes."
    )
    parser.add_argument("--output", type=Path, help="Policy outcome time report JSON path")
    parser.add_argument("--limit-samples", type=int, default=25, help="Maximum sample rows per section")
    return parser.parse_args()


def default_output_path() -> Path:
    return get_reports_dir() / "policy-outcome-time-dimension-report.json"


def table_exists(cursor, table_name: str) -> bool:
    cursor.execute("SHOW TABLES LIKE %s", (table_name,))
    return cursor.fetchone() is not None


def get_table_columns(cursor, table_name: str) -> set[str]:
    cursor.execute(f"SHOW COLUMNS FROM {table_name}")
    return {str(row["Field"]) for row in cursor.fetchall() or []}


def date_column_expr(columns: set[str], column: str) -> str:
    if column in columns:
        return f"po.{column} AS {column}"
    return f"NULL AS {column}"


def fetch_policy_outcomes(cursor, columns: set[str]) -> list[dict[str, Any]]:
    cursor.execute(
        f"""
        SELECT
          po.id,
          po.policy_type,
          po.policy_id,
          po.record_key,
          po.outcome_summary,
          po.impact_direction,
          po.evidence_strength,
          po.status,
          {date_column_expr(columns, "impact_start_date")},
          {date_column_expr(columns, "impact_end_date")},
          {date_column_expr(columns, "impact_duration_estimate")},
          pr.full_name AS president_name,
          pr.slug AS president_slug,
          pr.term_start AS president_term_start,
          pr.term_end AS president_term_end
        FROM policy_outcomes po
        LEFT JOIN promises p
          ON po.policy_type = 'current_admin'
         AND p.id = po.policy_id
        LEFT JOIN presidents pr ON pr.id = p.president_id
        ORDER BY po.policy_type ASC, po.policy_id ASC, po.id ASC
        """
    )
    return list(cursor.fetchall() or [])


def normalize_date(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, date):
        return value.isoformat()
    text = normalize_nullable_text(value)
    if text is None:
        return None
    return text[:10]


def year_from_date(value: Any) -> int | None:
    text = normalize_date(value)
    if not text or len(text) < 4:
        return None
    try:
        return int(text[:4])
    except ValueError:
        return None


def decade_from_year(year: int | None) -> str | None:
    if year is None:
        return None
    return f"{(year // 10) * 10}s"


def invalid_range(row: dict[str, Any]) -> bool:
    start = normalize_date(row.get("impact_start_date"))
    end = normalize_date(row.get("impact_end_date"))
    if not start or not end:
        return False
    return end < start


def duration_bucket(row: dict[str, Any]) -> str:
    explicit = normalize_nullable_text(row.get("impact_duration_estimate"))
    if explicit:
        return explicit
    start_year = year_from_date(row.get("impact_start_date"))
    end_year = year_from_date(row.get("impact_end_date"))
    if start_year is None:
        return "unknown"
    if end_year is None:
        return "ongoing_or_unknown_end"
    delta = max(0, end_year - start_year)
    if delta > 5:
        return "long_term"
    if delta > 1:
        return "medium_term"
    return "short_term"


def increment_nested(counter: dict[str, Counter], bucket: str, key: str | None) -> None:
    counter[bucket][key or "Unknown"] += 1


def summarize_rows(rows: list[dict[str, Any]], limit_samples: int) -> dict[str, Any]:
    by_year = Counter()
    by_decade = Counter()
    by_duration = Counter()
    invalid_ranges = []
    undated_samples = []
    admin_density: dict[str, dict[str, Any]] = {}
    admin_directions: dict[str, Counter] = defaultdict(Counter)
    admin_decades: dict[str, Counter] = defaultdict(Counter)

    for row in rows:
        start_year = year_from_date(row.get("impact_start_date"))
        decade = decade_from_year(start_year)
        duration = duration_bucket(row)
        by_duration[duration] += 1

        if start_year is None:
            if len(undated_samples) < limit_samples:
                undated_samples.append(sample_row(row))
        else:
            by_year[str(start_year)] += 1
            by_decade[decade] += 1

        if invalid_range(row) and len(invalid_ranges) < limit_samples:
            invalid_ranges.append(sample_row(row))

        if row.get("policy_type") == "current_admin":
            admin_key = normalize_nullable_text(row.get("president_slug")) or "unknown-president"
            if admin_key not in admin_density:
                admin_density[admin_key] = {
                    "president_slug": admin_key,
                    "president_name": normalize_nullable_text(row.get("president_name")),
                    "term_start": normalize_date(row.get("president_term_start")),
                    "term_end": normalize_date(row.get("president_term_end")),
                    "outcome_count": 0,
                    "dated_outcome_count": 0,
                    "undated_outcome_count": 0,
                }
            admin_density[admin_key]["outcome_count"] += 1
            if start_year is None:
                admin_density[admin_key]["undated_outcome_count"] += 1
            else:
                admin_density[admin_key]["dated_outcome_count"] += 1
            increment_nested(admin_directions, admin_key, normalize_nullable_text(row.get("impact_direction")))
            increment_nested(admin_decades, admin_key, decade)

    administration_density = []
    for admin_key, payload in admin_density.items():
        administration_density.append(
            {
                **payload,
                "impact_density_per_year": density_per_year(payload),
                "by_impact_direction": dict(sorted(admin_directions[admin_key].items())),
                "by_decade": dict(sorted(admin_decades[admin_key].items())),
            }
        )

    administration_density.sort(key=lambda row: (row["term_start"] or "", row["president_slug"]))

    return {
        "outcomes_grouped_by_year": [
            {"year": int(year), "outcome_count": count}
            for year, count in sorted(by_year.items(), key=lambda item: int(item[0]))
        ],
        "outcomes_grouped_by_decade": [
            {"decade": decade, "outcome_count": count}
            for decade, count in sorted(by_decade.items())
        ],
        "impact_duration_distribution": dict(sorted(by_duration.items())),
        "impact_density_per_administration": administration_density,
        "invalid_date_range_samples": invalid_ranges,
        "undated_outcome_samples": undated_samples,
    }


def density_per_year(admin_payload: dict[str, Any]) -> float | None:
    start_year = year_from_date(admin_payload.get("term_start"))
    end_year = year_from_date(admin_payload.get("term_end")) or start_year
    if start_year is None or end_year is None:
        return None
    years = max(1, end_year - start_year + 1)
    return round(admin_payload["outcome_count"] / years, 4)


def sample_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "policy_outcome_id": int(row["id"]),
        "policy_type": row.get("policy_type"),
        "policy_id": int(row["policy_id"]),
        "record_key": row.get("record_key"),
        "impact_direction": row.get("impact_direction"),
        "impact_start_date": normalize_date(row.get("impact_start_date")),
        "impact_end_date": normalize_date(row.get("impact_end_date")),
        "impact_duration_estimate": normalize_nullable_text(row.get("impact_duration_estimate")),
        "outcome_summary": normalize_nullable_text(row.get("outcome_summary")),
    }


def build_report(args: argparse.Namespace) -> dict[str, Any]:
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            if not table_exists(cursor, "policy_outcomes"):
                return {
                    "workflow": "policy_outcome_time_dimension_report",
                    "mode": "read_only",
                    "generated_at": utc_timestamp(),
                    "storage_ready": False,
                    "summary": {"policy_outcomes_table_exists": False},
                }
            columns = get_table_columns(cursor, "policy_outcomes")
            rows = fetch_policy_outcomes(cursor, columns)

        with_start = sum(1 for row in rows if normalize_date(row.get("impact_start_date")))
        with_end = sum(1 for row in rows if normalize_date(row.get("impact_end_date")))
        with_duration = sum(1 for row in rows if normalize_nullable_text(row.get("impact_duration_estimate")))
        invalid_count = sum(1 for row in rows if invalid_range(row))
        summary = {
            "policy_outcomes_table_exists": True,
            "time_columns_present": sorted(TIME_COLUMNS & columns),
            "missing_time_columns": sorted(TIME_COLUMNS - columns),
            "total_policy_outcomes": len(rows),
            "outcomes_with_impact_start_date": with_start,
            "outcomes_with_impact_end_date": with_end,
            "outcomes_with_duration_estimate": with_duration,
            "outcomes_with_no_start_date": len(rows) - with_start,
            "invalid_date_range_count": invalid_count,
        }
        return {
            "workflow": "policy_outcome_time_dimension_report",
            "mode": "read_only",
            "generated_at": utc_timestamp(),
            "storage_ready": not summary["missing_time_columns"],
            "summary": summary,
            "normalization_rules": [
                "Use impact_start_date for year/decade grouping when known.",
                "Keep impact_start_date and impact_end_date NULL when no trustworthy date exists.",
                "Never use created_at or updated_at as real-world impact timing.",
                "If both dates exist, impact_end_date must be greater than or equal to impact_start_date.",
                "impact_duration_estimate is descriptive and must not imply precision beyond the stored dates.",
            ],
            **summarize_rows(rows, max(0, args.limit_samples)),
        }
    finally:
        connection.close()


def main() -> None:
    args = parse_args()
    output_path = (args.output or default_output_path()).resolve()
    report = build_report(args)
    write_json_file(output_path, report)
    print_json(
        {
            "ok": True,
            "output": str(output_path),
            "storage_ready": report.get("storage_ready"),
            **report.get("summary", {}),
        }
    )


if __name__ == "__main__":
    main()
