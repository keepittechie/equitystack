#!/usr/bin/env python3
import argparse
import json
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


VALID_POLICY_TYPES = {"current_admin", "legislative", "judicial_impact"}
VALID_IMPACT_DIRECTIONS = {"Positive", "Negative", "Mixed", "Blocked"}
LOW_COVERAGE_OUTCOME_THRESHOLD = 5
HIGH_IMBALANCE_SHARE = 0.8


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Read-only attribution and policy_outcomes integrity validation."
    )
    parser.add_argument("--output", type=Path, help="Output JSON report path")
    parser.add_argument("--sample-limit", type=int, default=25, help="Maximum samples per issue list")
    return parser.parse_args()


def default_output_path() -> Path:
    return get_reports_dir() / "policy-outcome-integrity-validation.json"


def number(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def table_exists(cursor, table_name: str) -> bool:
    cursor.execute("SHOW TABLES LIKE %s", (table_name,))
    return cursor.fetchone() is not None


def table_columns(cursor, table_name: str) -> set[str]:
    if not table_exists(cursor, table_name):
        return set()
    cursor.execute(f"SHOW COLUMNS FROM {table_name}")
    return {str(row["Field"]) for row in cursor.fetchall() or []}


def json_value(value: Any) -> Any:
    if value in (None, ""):
        return None
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, (bytes, bytearray)):
        value = value.decode("utf-8")
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return None
    return None


def sample_outcome(row: dict[str, Any], issue: str | None = None) -> dict[str, Any]:
    payload = {
        "policy_outcome_id": int(row["policy_outcome_id"]),
        "policy_type": row.get("policy_type"),
        "policy_id": int(row["policy_id"]) if row.get("policy_id") is not None else None,
        "policy_title": row.get("policy_title"),
        "president_name": row.get("president_name"),
        "impact_direction": row.get("impact_direction"),
        "impact_score": float(row["impact_score"]) if row.get("impact_score") is not None else None,
        "source_count": int(number(row.get("source_count"), 0)),
        "outcome_summary": row.get("outcome_summary"),
    }
    if issue:
        payload["issue"] = issue
    return payload


def column_expr(columns: set[str], column_name: str, alias: str | None = None) -> str:
    output_alias = alias or column_name
    return f"po.{column_name} AS {output_alias}" if column_name in columns else f"NULL AS {output_alias}"


def fetch_outcomes(cursor, columns: set[str]) -> list[dict[str, Any]]:
    cursor.execute(
        f"""
        SELECT
          po.id AS policy_outcome_id,
          po.policy_type,
          po.policy_id,
          po.record_key,
          po.outcome_summary,
          po.outcome_summary_hash,
          po.impact_direction,
          {column_expr(columns, "impact_score")},
          po.source_count,
          po.source_quality,
          po.impact_start_date,
          po.impact_end_date,
          {column_expr(columns, "court_level")},
          {column_expr(columns, "decision_year")},
          {column_expr(columns, "majority_justices")},
          {column_expr(columns, "appointing_presidents")},
          {column_expr(columns, "judicial_attribution")},
          {column_expr(columns, "judicial_weight")},
          CASE
            WHEN po.policy_type = 'current_admin' THEN p.title
            WHEN po.policy_type = 'legislative' THEN tb.title
            WHEN po.policy_type = 'judicial_impact' THEN jp.title
            ELSE NULL
          END AS policy_title,
          pr.id AS president_id,
          pr.full_name AS president_name,
          tb.bill_status
        FROM policy_outcomes po
        LEFT JOIN promises p
          ON po.policy_type = 'current_admin'
         AND p.id = po.policy_id
        LEFT JOIN presidents pr
          ON pr.id = p.president_id
        LEFT JOIN tracked_bills tb
          ON po.policy_type = 'legislative'
         AND tb.id = po.policy_id
        LEFT JOIN policies jp
          ON po.policy_type = 'judicial_impact'
         AND jp.id = po.policy_id
        ORDER BY po.policy_type, po.policy_id, po.id
        """
    )
    return list(cursor.fetchall() or [])


def duplicate_groups(outcomes: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    groups: dict[tuple[Any, Any, Any], list[dict[str, Any]]] = defaultdict(list)
    for row in outcomes:
        groups[(row.get("policy_type"), row.get("policy_id"), row.get("outcome_summary_hash"))].append(row)
    return [
        {
            "policy_type": key[0],
            "policy_id": int(key[1]) if key[1] is not None else None,
            "outcome_summary_hash": key[2],
            "rows": [sample_outcome(item) for item in rows],
        }
        for key, rows in groups.items()
        if len(rows) > 1
    ][:limit]


def attribution_entries(row: dict[str, Any]) -> list[dict[str, Any]]:
    raw = json_value(row.get("judicial_attribution"))
    if isinstance(raw, dict):
        entries = raw.get("attributions") or raw.get("presidential_attributions") or raw.get("entries")
        if entries is None:
            entries = [raw]
    elif isinstance(raw, list):
        entries = raw
    else:
        entries = []
    return [entry for entry in entries if isinstance(entry, dict)]


def attribution_fraction(entry: dict[str, Any]) -> float | None:
    value = (
        entry.get("attribution_fraction")
        if entry.get("attribution_fraction") is not None
        else entry.get("fraction")
        if entry.get("fraction") is not None
        else entry.get("presidential_fraction")
    )
    try:
        fraction = float(value)
    except (TypeError, ValueError):
        return None
    if fraction <= 0 or fraction > 1:
        return None
    return fraction


def has_majority_justices(row: dict[str, Any]) -> bool:
    value = json_value(row.get("majority_justices"))
    return isinstance(value, list) and len(value) > 0


def has_appointing_presidents(row: dict[str, Any]) -> bool:
    value = json_value(row.get("appointing_presidents"))
    if isinstance(value, list):
        return len(value) > 0
    return isinstance(value, dict) and bool(value)


def validation_violations(outcomes: list[dict[str, Any]], columns: set[str], limit: int) -> dict[str, Any]:
    violations = []

    if "impact_score" not in columns:
        violations.append(
            {
                "issue": "missing_impact_score_column",
                "severity": "high",
                "detail": "policy_outcomes.impact_score is required for drift-resistant scoring.",
            }
        )

    duplicates = duplicate_groups(outcomes, limit)
    for group in duplicates:
        violations.append({"issue": "duplicate_policy_outcome_group", "severity": "high", **group})

    for row in outcomes:
        policy_type = normalize_nullable_text(row.get("policy_type"))
        direction = normalize_nullable_text(row.get("impact_direction"))
        impact_score = row.get("impact_score")
        source_count = number(row.get("source_count"), 0)

        if policy_type not in VALID_POLICY_TYPES:
            violations.append(sample_outcome(row, "invalid_policy_type"))
        if direction not in VALID_IMPACT_DIRECTIONS:
            violations.append(sample_outcome(row, "invalid_impact_direction"))
        if impact_score is None:
            violations.append(sample_outcome(row, "missing_impact_score"))
        elif number(impact_score) < -100 or number(impact_score) > 100:
            violations.append(sample_outcome(row, "impact_score_out_of_bounds"))
        if source_count < 0:
            violations.append(sample_outcome(row, "negative_source_count"))
        if row.get("impact_start_date") and row.get("impact_end_date") and row["impact_end_date"] < row["impact_start_date"]:
            violations.append(sample_outcome(row, "invalid_impact_date_range"))

        if policy_type == "judicial_impact":
            entries = attribution_entries(row)
            fractions = [attribution_fraction(entry) for entry in entries]
            if not entries:
                violations.append(sample_outcome(row, "judicial_impact_missing_attribution_metadata"))
            elif any(fraction is None for fraction in fractions):
                violations.append(sample_outcome(row, "judicial_impact_missing_or_invalid_attribution_fraction"))
            elif sum(fractions) > 1.0001:
                violations.append(sample_outcome(row, "judicial_impact_attribution_fraction_sum_exceeds_1"))
            if not has_majority_justices(row):
                violations.append(sample_outcome(row, "judicial_impact_missing_majority_justices"))
            if not has_appointing_presidents(row):
                violations.append(sample_outcome(row, "judicial_impact_missing_appointing_presidents"))
            if row.get("judicial_weight") is not None and number(row.get("judicial_weight")) <= 0:
                violations.append(sample_outcome(row, "judicial_impact_invalid_weight"))

    return {
        "status": "FAIL" if violations else "PASS",
        "violation_count": len(violations),
        "violations": violations[:limit],
        "duplicate_group_count": len(duplicates),
    }


def warning_report(outcomes: list[dict[str, Any]], limit: int) -> dict[str, Any]:
    warnings = []
    total = len(outcomes)
    by_type = Counter(row.get("policy_type") or "unknown" for row in outcomes)
    source_missing = [row for row in outcomes if int(number(row.get("source_count"), 0)) == 0]

    if source_missing:
        warnings.append(
            {
                "warning": "missing_sources",
                "severity": "medium",
                "affected_outcomes": len(source_missing),
                "affected_pct": round(len(source_missing) / total, 4) if total else 0,
                "samples": [
                    sample_outcome(row)
                    for row in sorted(
                        source_missing,
                        key=lambda item: (-abs(number(item.get("impact_score"), 0)), int(item["policy_outcome_id"])),
                    )[:limit]
                ],
            }
        )

    if total:
        dominant_type, dominant_count = by_type.most_common(1)[0]
        dominant_share = dominant_count / total
        if dominant_share >= HIGH_IMBALANCE_SHARE:
            warnings.append(
                {
                    "warning": "policy_type_imbalance",
                    "severity": "medium",
                    "dominant_policy_type": dominant_type,
                    "dominant_share": round(dominant_share, 4),
                    "distribution": dict(sorted(by_type.items())),
                }
            )

    direction_by_type: dict[str, Counter] = defaultdict(Counter)
    for row in outcomes:
        direction_by_type[row.get("policy_type") or "unknown"][row.get("impact_direction") or "unknown"] += 1
    for policy_type, counts in sorted(direction_by_type.items()):
        type_total = sum(counts.values())
        if type_total < LOW_COVERAGE_OUTCOME_THRESHOLD:
            continue
        direction, count = counts.most_common(1)[0]
        share = count / type_total
        if share >= HIGH_IMBALANCE_SHARE:
            warnings.append(
                {
                    "warning": "directional_imbalance",
                    "severity": "low",
                    "policy_type": policy_type,
                    "dominant_direction": direction,
                    "dominant_share": round(share, 4),
                    "distribution": dict(sorted(counts.items())),
                }
            )

    by_president: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in outcomes:
        if row.get("president_name"):
            by_president[str(row["president_name"])].append(row)
    low_coverage_presidents = [
        {
            "president_name": president,
            "outcome_count": len(rows),
            "positive": sum(1 for row in rows if row.get("impact_direction") == "Positive"),
            "negative": sum(1 for row in rows if row.get("impact_direction") == "Negative"),
        }
        for president, rows in sorted(by_president.items())
        if len(rows) < LOW_COVERAGE_OUTCOME_THRESHOLD
    ]
    if low_coverage_presidents:
        warnings.append(
            {
                "warning": "low_president_coverage",
                "severity": "medium",
                "threshold": LOW_COVERAGE_OUTCOME_THRESHOLD,
                "affected_president_count": len(low_coverage_presidents),
                "presidents": low_coverage_presidents[:limit],
            }
        )

    return {
        "status": "WARN" if warnings else "PASS",
        "warning_count": len(warnings),
        "warnings": warnings,
    }


def build_report(args: argparse.Namespace) -> dict[str, Any]:
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            columns = table_columns(cursor, "policy_outcomes")
            if not columns:
                raise SystemExit("policy_outcomes table not found")
            outcomes = fetch_outcomes(cursor, columns)

    violations = validation_violations(outcomes, columns, args.sample_limit)
    warnings = warning_report(outcomes, args.sample_limit)
    status = "FAIL" if violations["violation_count"] else "WARN" if warnings["warning_count"] else "PASS"

    return {
        "workflow": "policy_outcome_integrity_validation",
        "generated_at": utc_timestamp(),
        "mode": "read_only",
        "database_mutated": False,
        "status": status,
        "summary": {
            "total_policy_outcomes": len(outcomes),
            "policy_type_distribution": dict(sorted(Counter(row.get("policy_type") or "unknown" for row in outcomes).items())),
            "source_count_zero": sum(1 for row in outcomes if int(number(row.get("source_count"), 0)) == 0),
            "judicial_impact_outcome_count": sum(1 for row in outcomes if row.get("policy_type") == "judicial_impact"),
        },
        "validation_rules": [
            "policy_type must be one of current_admin, legislative, judicial_impact",
            "impact_direction must be one of Positive, Negative, Mixed, Blocked",
            "impact_score must be present and bounded between -100 and 100",
            "source_count must be non-negative",
            "duplicate rows by policy_type + policy_id + outcome_summary_hash are invalid",
            "judicial_impact rows must include explicit judicial_attribution entries with attribution_fraction values",
            "judicial_impact rows must include majority_justices and appointing_presidents metadata",
            "impact_end_date must be on or after impact_start_date when both are present",
        ],
        "warnings_generated_for": [
            "missing sources",
            "low president outcome coverage",
            "high policy_type imbalance",
            "high directional imbalance within a policy_type",
        ],
        "violations": violations,
        "warnings": warnings,
    }


def main() -> None:
    args = parse_args()
    output_path = (args.output or default_output_path()).resolve()
    report = build_report(args)
    write_json_file(output_path, report)
    print_json(
        {
            "ok": report["status"] != "FAIL",
            "status": report["status"],
            "output": str(output_path),
            "total_policy_outcomes": report["summary"]["total_policy_outcomes"],
            "violation_count": report["violations"]["violation_count"],
            "warning_count": report["warnings"]["warning_count"],
            "database_mutated": False,
        }
    )


if __name__ == "__main__":
    main()
