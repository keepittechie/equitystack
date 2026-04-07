#!/usr/bin/env python3
import argparse
import csv
from collections import Counter, defaultdict
from datetime import date
from decimal import Decimal
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


DIRECTION_WEIGHTS = {
    "Positive": 1.0,
    "Mixed": 0.25,
    "Negative": -1.0,
    "Blocked": 0.0,
}

INTENT_MODIFIERS = {
    "equity_expanding": 1.1,
    "equity_restricting": 0.9,
    "neutral_administrative": 1.0,
    "mixed_or_competing": 1.0,
    "unclear": 1.0,
    None: 1.0,
}

POLICY_TYPE_WEIGHTS = {
    "current_admin": 1.0,
    "legislative": 0.8,
}

LOW_CONFIDENCE_OUTCOME_THRESHOLD = 5


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Read-only final Black Impact Score per president from unified policy_outcomes."
    )
    parser.add_argument("--output", type=Path, help="Black Impact Score report JSON path")
    parser.add_argument("--csv-output", type=Path, help="Optional president score CSV path")
    parser.add_argument(
        "--sample-limit",
        type=int,
        default=25,
        help="Maximum outcome contribution samples to include (default: 25)",
    )
    return parser.parse_args()


def default_output_path() -> Path:
    return get_reports_dir() / "final-black-impact-score-by-president.json"


def table_exists(cursor, table_name: str) -> bool:
    cursor.execute("SHOW TABLES LIKE %s", (table_name,))
    return cursor.fetchone() is not None


def get_table_columns(cursor, table_name: str) -> set[str]:
    cursor.execute(f"SHOW COLUMNS FROM {table_name}")
    return {str(row["Field"]) for row in cursor.fetchall() or []}


def numeric(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default
    if isinstance(value, Decimal):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def iso_date(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, date):
        return value.isoformat()
    text = normalize_nullable_text(value)
    return text[:10] if text else None


def years_between(start: Any, end: Any) -> float | None:
    start_text = iso_date(start)
    if not start_text:
        return None
    end_text = iso_date(end) or date.today().isoformat()
    start_date = date.fromisoformat(start_text)
    end_date = date.fromisoformat(end_text)
    days = max(1, (end_date - start_date).days)
    return round(days / 365.2425, 4)


def confidence_multiplier(source_count: Any) -> float:
    count = int(numeric(source_count, 0))
    if count <= 0:
        return 0.6
    if count == 1:
        return 0.8
    return 1.0


def normalize_direction(value: Any) -> str | None:
    text = normalize_nullable_text(value)
    if text is None:
        return None
    for direction in DIRECTION_WEIGHTS:
        if text.lower() == direction.lower():
            return direction
    return None


def normalize_intent(value: Any) -> str | None:
    text = normalize_nullable_text(value)
    if text is None:
        return None
    normalized = text.lower()
    return normalized if normalized in INTENT_MODIFIERS else None


def build_policy_outcomes_sql(has_impact_score: bool, has_source_quality: bool) -> str:
    impact_expr = "po.impact_score AS impact_score" if has_impact_score else "NULL AS impact_score"
    source_quality_expr = "po.source_quality AS source_quality" if has_source_quality else "NULL AS source_quality"
    return f"""
        SELECT
          po.id AS policy_outcome_id,
          po.policy_type,
          po.policy_id,
          po.record_key,
          po.outcome_summary,
          po.impact_direction,
          po.source_count,
          {source_quality_expr},
          {impact_expr},
          po.status,
          po.impact_start_date,
          CASE
            WHEN po.policy_type = 'current_admin' THEN pr.id
            ELSE NULL
          END AS president_id,
          CASE
            WHEN po.policy_type = 'current_admin' THEN pr.full_name
            ELSE NULL
          END AS president_name,
          CASE
            WHEN po.policy_type = 'current_admin' THEN pr.slug
            ELSE NULL
          END AS president_slug,
          CASE
            WHEN po.policy_type = 'current_admin' THEN pr.term_start
            ELSE NULL
          END AS term_start,
          CASE
            WHEN po.policy_type = 'current_admin' THEN pr.term_end
            ELSE NULL
          END AS term_end,
          CASE
            WHEN po.policy_type = 'current_admin' THEN p.title
            WHEN po.policy_type = 'legislative' THEN tb.title
            ELSE NULL
          END AS policy_title,
          CASE
            WHEN po.policy_type = 'current_admin' THEN related_intent.policy_intent_category
            ELSE NULL
          END AS policy_intent_category,
          CASE
            WHEN po.policy_type = 'current_admin' THEN related_intent.related_policy_intent_policy_count
            ELSE 0
          END AS related_policy_intent_policy_count,
          CASE
            WHEN po.policy_type = 'current_admin' THEN related_intent.related_policy_intent_category_count
            ELSE 0
          END AS related_policy_intent_category_count
        FROM policy_outcomes po
        LEFT JOIN promises p
          ON po.policy_type = 'current_admin'
         AND p.id = po.policy_id
        LEFT JOIN presidents pr
          ON pr.id = p.president_id
        LEFT JOIN tracked_bills tb
          ON po.policy_type = 'legislative'
         AND tb.id = po.policy_id
        LEFT JOIN (
          SELECT
            pa.promise_id,
            CASE
              WHEN COUNT(DISTINCT pol.policy_intent_category) = 1 THEN MAX(pol.policy_intent_category)
              ELSE NULL
            END AS policy_intent_category,
            COUNT(DISTINCT pol.id) AS related_policy_intent_policy_count,
            COUNT(DISTINCT pol.policy_intent_category) AS related_policy_intent_category_count
          FROM promise_actions pa
          JOIN policies pol
            ON pol.id = pa.related_policy_id
           AND pol.policy_intent_category IS NOT NULL
          GROUP BY pa.promise_id
        ) related_intent
          ON po.policy_type = 'current_admin'
         AND related_intent.promise_id = po.policy_id
        ORDER BY pr.term_start ASC, pr.id ASC, po.id ASC
    """


def fetch_policy_outcomes(cursor, policy_outcomes_columns: set[str]) -> list[dict[str, Any]]:
    cursor.execute(
        build_policy_outcomes_sql(
            has_impact_score="impact_score" in policy_outcomes_columns,
            has_source_quality="source_quality" in policy_outcomes_columns,
        )
    )
    return list(cursor.fetchall() or [])


def contribution_for_row(row: dict[str, Any], has_impact_score: bool) -> dict[str, Any]:
    direction = normalize_direction(row.get("impact_direction"))
    direction_weight = DIRECTION_WEIGHTS.get(direction, 0.0)
    stored_impact_score = numeric(row.get("impact_score"), 1.0 if not has_impact_score else 0.0)
    impact_score = abs(stored_impact_score) if has_impact_score else stored_impact_score
    impact_score_source = "policy_outcomes.impact_score" if has_impact_score else "unit_outcome_magnitude_fallback"
    confidence = confidence_multiplier(row.get("source_count"))
    intent_category = normalize_intent(row.get("policy_intent_category"))
    intent_modifier = INTENT_MODIFIERS.get(intent_category, 1.0)
    policy_type = normalize_nullable_text(row.get("policy_type"))
    policy_type_weight = POLICY_TYPE_WEIGHTS.get(policy_type, 1.0)
    excluded_from_president_score = row.get("president_id") is None
    exclusion_reason = None
    if excluded_from_president_score:
        exclusion_reason = (
            "legislative_outcome_has_no_deterministic_president_attribution"
            if policy_type == "legislative"
            else "missing_president_attribution"
        )
    adjusted_outcome_score = impact_score * direction_weight
    confidence_adjusted_score = adjusted_outcome_score * confidence
    intent_adjusted_score = confidence_adjusted_score * intent_modifier
    final_outcome_score = intent_adjusted_score * policy_type_weight

    return {
        "policy_outcome_id": int(row["policy_outcome_id"]),
        "policy_type": policy_type,
        "policy_id": int(row["policy_id"]),
        "record_key": row.get("record_key"),
        "policy_title": row.get("policy_title"),
        "outcome_summary": row.get("outcome_summary"),
        "impact_direction": direction,
        "impact_score": round(impact_score, 4),
        "stored_impact_score": round(stored_impact_score, 4),
        "impact_score_source": impact_score_source,
        "direction_weight": direction_weight,
        "adjusted_outcome_score": round(adjusted_outcome_score, 4),
        "source_count": int(numeric(row.get("source_count"), 0)),
        "source_quality": row.get("source_quality"),
        "confidence_multiplier": confidence,
        "confidence_adjusted_score": round(confidence_adjusted_score, 4),
        "policy_intent_category": intent_category,
        "intent_modifier": intent_modifier,
        "related_policy_intent_policy_count": int(numeric(row.get("related_policy_intent_policy_count"), 0)),
        "related_policy_intent_category_count": int(numeric(row.get("related_policy_intent_category_count"), 0)),
        "policy_type_weight": policy_type_weight,
        "final_outcome_score": round(final_outcome_score, 4),
        "president_id": int(row["president_id"]) if row.get("president_id") is not None else None,
        "president_name": row.get("president_name"),
        "president_slug": row.get("president_slug"),
        "excluded_from_president_score": excluded_from_president_score,
        "president_score_exclusion_reason": exclusion_reason,
        "term_start": iso_date(row.get("term_start")),
        "term_end": iso_date(row.get("term_end")),
        "years_in_office": years_between(row.get("term_start"), row.get("term_end")),
    }


def empty_president_bucket(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "president_id": row.get("president_id"),
        "president_name": row.get("president_name"),
        "president_slug": row.get("president_slug"),
        "term_start": row.get("term_start"),
        "term_end": row.get("term_end"),
        "years_in_office": row.get("years_in_office"),
        "policy_keys": set(),
        "total_outcomes": 0,
        "positive_outcomes": 0,
        "negative_outcomes": 0,
        "mixed_outcomes": 0,
        "blocked_outcomes": 0,
        "raw_score": 0.0,
        "base_score_before_direction": 0.0,
        "direction_adjusted_score": 0.0,
        "confidence_total": 0.0,
        "source_quality_counts": Counter(),
        "policy_type_counts": Counter(),
        "intent_modifier_counts": Counter(),
        "contributions": [],
    }


def aggregate_scores(contributions: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    by_president: dict[str, dict[str, Any]] = {}
    unassigned = []
    for contribution in contributions:
        if contribution.get("president_id") is None:
            unassigned.append(contribution)
            continue
        key = f'{contribution["president_id"]}:{contribution["president_slug"]}'
        if key not in by_president:
            by_president[key] = empty_president_bucket(contribution)
        bucket = by_president[key]
        bucket["policy_keys"].add(f'{contribution["policy_type"]}:{contribution["policy_id"]}')
        bucket["total_outcomes"] += 1
        direction = contribution.get("impact_direction")
        if direction == "Positive":
            bucket["positive_outcomes"] += 1
        elif direction == "Negative":
            bucket["negative_outcomes"] += 1
        elif direction == "Mixed":
            bucket["mixed_outcomes"] += 1
        elif direction == "Blocked":
            bucket["blocked_outcomes"] += 1
        bucket["base_score_before_direction"] += contribution["impact_score"]
        bucket["direction_adjusted_score"] += contribution["adjusted_outcome_score"]
        bucket["raw_score"] += contribution["final_outcome_score"]
        bucket["confidence_total"] += contribution["confidence_multiplier"]
        bucket["source_quality_counts"][contribution.get("source_quality") or "unknown"] += 1
        bucket["policy_type_counts"][contribution.get("policy_type") or "unknown"] += 1
        bucket["intent_modifier_counts"][contribution.get("policy_intent_category") or "unknown"] += 1
        bucket["contributions"].append(contribution)

    president_rows = []
    for bucket in by_president.values():
        years = bucket["years_in_office"] or 1.0
        total_policies = len(bucket["policy_keys"])
        total_outcomes = bucket["total_outcomes"]
        raw_score = bucket["raw_score"]
        president_rows.append(
            {
                "president_id": bucket["president_id"],
                "president_name": bucket["president_name"],
                "president_slug": bucket["president_slug"],
                "term_start": bucket["term_start"],
                "term_end": bucket["term_end"],
                "years_in_office": round(years, 4),
                "total_policies": total_policies,
                "total_outcomes": total_outcomes,
                "positive_outcomes": bucket["positive_outcomes"],
                "negative_outcomes": bucket["negative_outcomes"],
                "mixed_outcomes": bucket["mixed_outcomes"],
                "blocked_outcomes": bucket["blocked_outcomes"],
                "base_score_before_direction": round(bucket["base_score_before_direction"], 4),
                "direction_adjusted_score": round(bucket["direction_adjusted_score"], 4),
                "raw_score": round(raw_score, 4),
                "normalized_score": round(raw_score / years, 4),
                "avg_score_per_policy": round(raw_score / total_policies, 4) if total_policies else 0,
                "confidence_avg": round(bucket["confidence_total"] / total_outcomes, 4) if total_outcomes else 0,
                "source_quality_counts": dict(sorted(bucket["source_quality_counts"].items())),
                "policy_type_counts": dict(sorted(bucket["policy_type_counts"].items())),
                "intent_modifier_counts": dict(sorted(bucket["intent_modifier_counts"].items())),
                "confidence_flag": "low confidence" if total_outcomes < LOW_CONFIDENCE_OUTCOME_THRESHOLD else "standard",
            }
        )
    president_rows.sort(
        key=lambda row: (
            -row["normalized_score"],
            -(row["total_outcomes"] or 0),
            row["term_start"] or "",
            row["president_name"] or "",
        )
    )
    return president_rows, unassigned


def duplicate_outcome_ids(contributions: list[dict[str, Any]]) -> list[int]:
    counts = Counter(row["policy_outcome_id"] for row in contributions)
    return sorted(outcome_id for outcome_id, count in counts.items() if count > 1)


def build_report(args: argparse.Namespace) -> dict[str, Any]:
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            if not table_exists(cursor, "policy_outcomes"):
                raise RuntimeError("policy_outcomes table does not exist")
            if not table_exists(cursor, "promises"):
                raise RuntimeError("promises table does not exist")
            if not table_exists(cursor, "presidents"):
                raise RuntimeError("presidents table does not exist")
            columns = get_table_columns(cursor, "policy_outcomes")
            raw_rows = fetch_policy_outcomes(cursor, columns)

    has_impact_score = "impact_score" in columns
    contributions = [contribution_for_row(row, has_impact_score) for row in raw_rows]
    president_scores, unassigned = aggregate_scores(contributions)
    duplicate_ids = duplicate_outcome_ids(contributions)
    policy_type_counts = Counter(row.get("policy_type") or "unknown" for row in contributions)
    intent_modifier_counts = Counter(row.get("policy_intent_category") or "unknown" for row in contributions)
    warnings = []
    if not has_impact_score:
        warnings.append(
            "policy_outcomes.impact_score is not present in production schema; report uses unit outcome magnitude fallback (1.0) and records impact_score_source per row."
        )
    if unassigned:
        warnings.append(
            f"{len(unassigned)} policy_outcome row(s) were not assigned to a president and are excluded from president totals."
        )
    legislative_unassigned = [row for row in unassigned if row.get("policy_type") == "legislative"]
    if legislative_unassigned:
        warnings.append(
            f"{len(legislative_unassigned)} legislative policy_outcome row(s) are explicitly excluded from president scoring because no deterministic president attribution exists in the current schema."
        )
    if duplicate_ids:
        warnings.append(f"Duplicate policy_outcome ids detected in query output: {duplicate_ids}")

    return {
        "workflow": "final_black_impact_score_by_president",
        "generated_at": utc_timestamp(),
        "mode": "read_only",
        "database_mutated": False,
        "formula": {
            "base_score": "absolute magnitude from policy_outcomes.impact_score when present; otherwise unit outcome magnitude fallback because production schema lacks that column",
            "direction_weights": DIRECTION_WEIGHTS,
            "confidence_multiplier": {
                "source_count = 0": 0.6,
                "source_count = 1": 0.8,
                "source_count >= 2": 1.0,
            },
            "intent_modifiers": {
                "equity_expanding": 1.1,
                "equity_restricting": 0.9,
                "neutral_or_unknown": 1.0,
            },
            "policy_type_weights": POLICY_TYPE_WEIGHTS,
            "president_normalization": "SUM(final_outcome_score) / years_in_office",
            "final_outcome_score": "ABS(impact_score) * direction_weight * confidence_multiplier * intent_modifier * policy_type_weight",
        },
        "join_contract": {
            "current_admin": "policy_outcomes.policy_id -> promises.id -> presidents.id",
            "intent_modifier": "current_admin promise actions may point to historical policies through promise_actions.related_policy_id; intent modifier is applied only when all related historical policies with intent have one deterministic category",
            "legislative": "policy_outcomes.policy_id -> tracked_bills.id; no president attribution is available in current schema, so rows are explicitly excluded with excluded_from_president_score=true until attribution exists",
            "historical_policies": "Historical policies are not stored as policy_outcomes rows in production, so they are not counted in this unified-outcome report.",
        },
        "summary": {
            "policy_outcomes_evaluated": len(contributions),
            "presidents_scored": len(president_scores),
            "unassigned_outcomes_excluded": len(unassigned),
            "duplicate_outcome_id_count": len(duplicate_ids),
            "policy_type_counts": dict(sorted(policy_type_counts.items())),
            "intent_modifier_counts": dict(sorted(intent_modifier_counts.items())),
            "impact_score_column_present": has_impact_score,
            "low_confidence_president_count": sum(
                1 for row in president_scores if row["confidence_flag"] == "low confidence"
            ),
        },
        "warnings": warnings,
        "president_scores": president_scores,
        "low_confidence_presidents": [
            row for row in president_scores if row["confidence_flag"] == "low confidence"
        ],
        "unassigned_outcome_samples": unassigned[: args.sample_limit],
        "outcome_contribution_samples": contributions[: args.sample_limit],
        "sql": {
            "policy_outcomes_query": build_policy_outcomes_sql(
                has_impact_score=has_impact_score,
                has_source_quality="source_quality" in columns,
            ).strip(),
        },
    }


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "president_name",
        "president_slug",
        "total_policies",
        "total_outcomes",
        "positive_outcomes",
        "negative_outcomes",
        "mixed_outcomes",
        "blocked_outcomes",
        "raw_score",
        "normalized_score",
        "avg_score_per_policy",
        "confidence_avg",
        "confidence_flag",
        "term_start",
        "term_end",
        "years_in_office",
    ]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field) for field in fieldnames})


def main() -> None:
    args = parse_args()
    output_path = (args.output or default_output_path()).resolve()
    report = build_report(args)
    write_json_file(output_path, report)
    if args.csv_output:
        write_csv(args.csv_output.resolve(), report["president_scores"])
    print_json({"ok": True, "output": str(output_path), **report["summary"]})


if __name__ == "__main__":
    main()
