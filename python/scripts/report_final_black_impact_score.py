#!/usr/bin/env python3
import argparse
import csv
import json
import math
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
    "mixed_or_competing": 0.95,
    "unclear": 1.0,
    None: 1.0,
}

POLICY_TYPE_WEIGHTS = {
    "current_admin": 1.0,
    "legislative": 0.8,
    "judicial_impact": 1.0,
}

LOW_CONFIDENCE_OUTCOME_THRESHOLD = 5
JUDICIAL_WEIGHT = 0.5
SCORE_FAMILY_DIRECT = "direct"
SCORE_FAMILY_SYSTEMIC = "systemic"


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


def coverage_confidence_factor(outcome_count: Any) -> float:
    count = int(numeric(outcome_count, 0))
    if count <= 0:
        return 0.0
    return round(min(1.0, math.log(count + 1) / math.log(10)), 4)


def score_confidence_label(outcome_count: Any) -> str:
    count = int(numeric(outcome_count, 0))
    if count <= 2:
        return "VERY LOW"
    if count <= 5:
        return "LOW"
    if count <= 15:
        return "MEDIUM"
    return "HIGH"


def normalize_direction(value: Any) -> str | None:
    text = normalize_nullable_text(value)
    if text is None:
        return None
    for direction in DIRECTION_WEIGHTS:
        if text.lower() == direction.lower():
            return direction
    return None


def normalize_intent(value: Any) -> str:
    text = normalize_nullable_text(value)
    if text is None:
        return "unclear"
    normalized = text.lower()
    return normalized if normalized in INTENT_MODIFIERS else "unclear"


def parse_json_value(value: Any) -> Any:
    if value in (None, ""):
        return None
    if isinstance(value, (list, dict)):
        return value
    if isinstance(value, (bytes, bytearray)):
        value = value.decode("utf-8")
    if not isinstance(value, str):
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return None


def normalize_justice_name(value: Any) -> str | None:
    if isinstance(value, str):
        return normalize_nullable_text(value)
    if isinstance(value, dict):
        return (
            normalize_nullable_text(value.get("name"))
            or normalize_nullable_text(value.get("justice"))
            or normalize_nullable_text(value.get("justice_name"))
        )
    return None


def fetch_president_lookup(cursor) -> dict[str, dict[str, Any]]:
    cursor.execute(
        """
        SELECT id, full_name, slug, term_start, term_end
        FROM presidents
        """
    )
    lookup: dict[str, dict[str, Any]] = {}
    for row in cursor.fetchall() or []:
        normalized = {
            "president_id": int(row["id"]),
            "president_name": row.get("full_name"),
            "president_slug": row.get("slug"),
            "term_start": iso_date(row.get("term_start")),
            "term_end": iso_date(row.get("term_end")),
            "years_in_office": years_between(row.get("term_start"), row.get("term_end")),
        }
        lookup[f'id:{row["id"]}'] = normalized
        if row.get("slug"):
            lookup[f'slug:{str(row["slug"]).lower()}'] = normalized
        if row.get("full_name"):
            lookup[f'name:{str(row["full_name"]).lower()}'] = normalized
    return lookup


def lookup_president(entry: dict[str, Any], president_lookup: dict[str, dict[str, Any]]) -> dict[str, Any] | None:
    president_id = entry.get("president_id") or entry.get("appointing_president_id")
    if president_id is not None:
        found = president_lookup.get(f"id:{president_id}")
        if found:
            return found
    president_slug = normalize_nullable_text(entry.get("president_slug") or entry.get("appointing_president_slug"))
    if president_slug:
        found = president_lookup.get(f"slug:{president_slug.lower()}")
        if found:
            return found
    president_name = normalize_nullable_text(
        entry.get("president_name") or entry.get("appointing_president_name") or entry.get("appointing_president")
    )
    if president_name:
        return president_lookup.get(f"name:{president_name.lower()}")
    return None


def judicial_attributions_from_majority_justices(majority_justices: list[Any]) -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}
    total = len(majority_justices)
    if total == 0:
        return []
    for justice in majority_justices:
        if not isinstance(justice, dict):
            continue
        key = (
            normalize_nullable_text(justice.get("appointing_president_slug"))
            or normalize_nullable_text(justice.get("appointing_president_name"))
            or normalize_nullable_text(justice.get("appointing_president"))
            or (f'president:{justice.get("appointing_president_id")}' if justice.get("appointing_president_id") else None)
        )
        if key is None:
            continue
        if key not in grouped:
            grouped[key] = {
                "president_id": justice.get("appointing_president_id"),
                "president_slug": justice.get("appointing_president_slug"),
                "president_name": justice.get("appointing_president_name") or justice.get("appointing_president"),
                "contributing_justices": [],
            }
        justice_name = normalize_justice_name(justice)
        if justice_name:
            grouped[key]["contributing_justices"].append(justice_name)
    return [
        {
            **entry,
            "attribution_fraction": round(len(entry["contributing_justices"]) / total, 4),
        }
        for entry in grouped.values()
    ]


def judicial_attributions_for_row(row: dict[str, Any]) -> list[dict[str, Any]]:
    explicit_attribution = parse_json_value(row.get("judicial_attribution"))
    if isinstance(explicit_attribution, list) and explicit_attribution:
        return [
            {
                "president_id": entry.get("president_id") or entry.get("appointing_president_id"),
                "president_slug": entry.get("president_slug") or entry.get("appointing_president_slug"),
                "president_name": (
                    entry.get("president_name")
                    or entry.get("appointing_president_name")
                    or entry.get("appointing_president")
                ),
                "attribution_fraction": numeric(entry.get("attribution_fraction"), 0.0),
                "contributing_justices": [
                    name for name in (normalize_justice_name(value) for value in entry.get("contributing_justices") or []) if name
                ],
            }
            for entry in explicit_attribution
            if isinstance(entry, dict)
        ]
    majority_justices = parse_json_value(row.get("majority_justices"))
    if isinstance(majority_justices, list):
        return judicial_attributions_from_majority_justices(majority_justices)
    return []


def column_expr(has_column: bool, expression: str, alias: str) -> str:
    return f"{expression} AS {alias}" if has_column else f"NULL AS {alias}"


def build_policy_outcomes_sql(policy_outcomes_columns: set[str]) -> str:
    has_impact_score = "impact_score" in policy_outcomes_columns
    has_source_quality = "source_quality" in policy_outcomes_columns
    impact_expr = "po.impact_score AS impact_score" if has_impact_score else "NULL AS impact_score"
    source_quality_expr = "po.source_quality AS source_quality" if has_source_quality else "NULL AS source_quality"
    court_level_expr = column_expr("court_level" in policy_outcomes_columns, "po.court_level", "court_level")
    decision_year_expr = column_expr("decision_year" in policy_outcomes_columns, "po.decision_year", "decision_year")
    majority_justices_expr = column_expr("majority_justices" in policy_outcomes_columns, "po.majority_justices", "majority_justices")
    appointing_presidents_expr = column_expr("appointing_presidents" in policy_outcomes_columns, "po.appointing_presidents", "appointing_presidents")
    judicial_attribution_expr = column_expr("judicial_attribution" in policy_outcomes_columns, "po.judicial_attribution", "judicial_attribution")
    judicial_weight_expr = column_expr("judicial_weight" in policy_outcomes_columns, "po.judicial_weight", "judicial_weight")
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
          {court_level_expr},
          {decision_year_expr},
          {majority_justices_expr},
          {appointing_presidents_expr},
          {judicial_attribution_expr},
          {judicial_weight_expr},
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
            WHEN po.policy_type = 'judicial_impact' THEN jp.title
            ELSE NULL
          END AS policy_title,
          CASE
            WHEN po.policy_type = 'current_admin' THEN related_intent.policy_intent_category
            WHEN po.policy_type = 'judicial_impact' THEN COALESCE(jp.policy_intent_category, 'unclear')
            ELSE 'unclear'
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
        LEFT JOIN policies jp
          ON po.policy_type = 'judicial_impact'
         AND jp.id = po.policy_id
        LEFT JOIN (
          SELECT
            pr.id AS promise_id,
            CASE
              WHEN COUNT(DISTINCT matched.policy_intent_category) = 0 THEN 'unclear'
              WHEN COUNT(DISTINCT matched.policy_intent_category) = 1 THEN MAX(matched.policy_intent_category)
              ELSE 'mixed_or_competing'
            END AS policy_intent_category,
            COUNT(DISTINCT matched.policy_id) AS related_policy_intent_policy_count,
            COUNT(DISTINCT matched.policy_intent_category) AS related_policy_intent_category_count
          FROM promises pr
          LEFT JOIN (
            SELECT DISTINCT
              pa.promise_id,
              pol.id AS policy_id,
              pol.policy_intent_category
            FROM promise_actions pa
            JOIN policies pol
              ON pol.id = pa.related_policy_id
             AND pol.policy_intent_category IS NOT NULL
            UNION DISTINCT
            SELECT DISTINCT
              pa.promise_id,
              pol.id AS policy_id,
              pol.policy_intent_category
            FROM promise_actions pa
            JOIN policies pol
              ON pa.related_policy_id IS NULL
             AND pol.policy_intent_category IS NOT NULL
             AND (
               CONVERT(pa.title USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', CONVERT(pol.title USING utf8mb4) COLLATE utf8mb4_unicode_ci, '%')
               OR CONVERT(pa.description USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', CONVERT(pol.title USING utf8mb4) COLLATE utf8mb4_unicode_ci, '%')
             )
          ) matched
            ON matched.promise_id = pr.id
          GROUP BY pr.id
        ) related_intent
          ON po.policy_type = 'current_admin'
         AND related_intent.promise_id = po.policy_id
        ORDER BY pr.term_start ASC, pr.id ASC, po.id ASC
    """


def fetch_policy_outcomes(cursor, policy_outcomes_columns: set[str]) -> list[dict[str, Any]]:
    cursor.execute(build_policy_outcomes_sql(policy_outcomes_columns))
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
    judicial_weight = numeric(row.get("judicial_weight"), JUDICIAL_WEIGHT if policy_type == "judicial_impact" else 1.0)

    return {
        "policy_outcome_id": int(row["policy_outcome_id"]),
        "policy_type": policy_type,
        "score_family": SCORE_FAMILY_SYSTEMIC if policy_type == "judicial_impact" else SCORE_FAMILY_DIRECT,
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
        "intent_adjusted_score": round(intent_adjusted_score, 4),
        "related_policy_intent_policy_count": int(numeric(row.get("related_policy_intent_policy_count"), 0)),
        "related_policy_intent_category_count": int(numeric(row.get("related_policy_intent_category_count"), 0)),
        "policy_type_weight": policy_type_weight,
        "judicial_weight": judicial_weight,
        "court_level": row.get("court_level"),
        "decision_year": row.get("decision_year"),
        "attribution_fraction": None,
        "contributing_justices": [],
        "appointing_presidents": parse_json_value(row.get("appointing_presidents")) or [],
        "weighting_applied": {
            "direction_weight": direction_weight,
            "confidence_multiplier": confidence,
            "intent_modifier": intent_modifier,
            "policy_type_weight": policy_type_weight,
            "judicial_weight": judicial_weight if policy_type == "judicial_impact" else 1.0,
        },
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


def contributions_for_row(
    row: dict[str, Any],
    has_impact_score: bool,
    president_lookup: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    base = contribution_for_row(row, has_impact_score)
    if base.get("policy_type") != "judicial_impact":
        return [base]

    attributions = judicial_attributions_for_row(row)
    if not attributions:
        base.update(
            {
                "excluded_from_president_score": True,
                "president_score_exclusion_reason": "judicial_impact_missing_explicit_attribution_metadata",
                "policy_type_weight": 1.0,
                "final_outcome_score": 0.0,
            }
        )
        base["weighting_applied"]["policy_type_weight"] = 1.0
        return [base]

    contributions = []
    judicial_weight = numeric(row.get("judicial_weight"), JUDICIAL_WEIGHT)
    for attribution in attributions:
        fraction = max(0.0, min(1.0, numeric(attribution.get("attribution_fraction"), 0.0)))
        if fraction <= 0:
            continue
        president = lookup_president(attribution, president_lookup)
        contribution = {**base}
        contribution.update(
            {
                "president_id": president.get("president_id") if president else None,
                "president_name": president.get("president_name") if president else attribution.get("president_name"),
                "president_slug": president.get("president_slug") if president else attribution.get("president_slug"),
                "term_start": president.get("term_start") if president else None,
                "term_end": president.get("term_end") if president else None,
                "years_in_office": president.get("years_in_office") if president else None,
                "excluded_from_president_score": president is None,
                "president_score_exclusion_reason": None if president else "judicial_impact_appointer_president_not_found",
                "attribution_fraction": round(fraction, 4),
                "contributing_justices": attribution.get("contributing_justices") or [],
                "appointing_presidents": [president.get("president_name") if president else attribution.get("president_name")],
                "policy_type_weight": 1.0,
                "judicial_weight": judicial_weight,
                "final_outcome_score": round(base["intent_adjusted_score"] * fraction * judicial_weight, 4),
            }
        )
        contribution["weighting_applied"] = {
            **base["weighting_applied"],
            "policy_type_weight": 1.0,
            "judicial_weight": judicial_weight,
            "attribution_fraction": round(fraction, 4),
        }
        contributions.append(contribution)
    return contributions or [base]


def empty_president_bucket(row: dict[str, Any]) -> dict[str, Any]:
    def empty_family_bucket() -> dict[str, Any]:
        return {
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

    return {
        "president_id": row.get("president_id"),
        "president_name": row.get("president_name"),
        "president_slug": row.get("president_slug"),
        "term_start": row.get("term_start"),
        "term_end": row.get("term_end"),
        "years_in_office": row.get("years_in_office"),
        "families": {
            SCORE_FAMILY_DIRECT: empty_family_bucket(),
            SCORE_FAMILY_SYSTEMIC: empty_family_bucket(),
        },
    }


def add_contribution_to_family(bucket: dict[str, Any], contribution: dict[str, Any]) -> None:
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
    bucket["intent_modifier_counts"][contribution.get("policy_intent_category") or "unclear"] += 1
    bucket["contributions"].append(contribution)


def summarize_family_bucket(bucket: dict[str, Any], years: float) -> dict[str, Any]:
    total_policies = len(bucket["policy_keys"])
    total_outcomes = bucket["total_outcomes"]
    raw_score = bucket["raw_score"]
    normalized_score = raw_score / years
    confidence_factor = coverage_confidence_factor(total_outcomes)
    confidence_label = score_confidence_label(total_outcomes)
    return {
        "total_policies": total_policies,
        "total_outcomes": total_outcomes,
        "positive_outcomes": bucket["positive_outcomes"],
        "negative_outcomes": bucket["negative_outcomes"],
        "mixed_outcomes": bucket["mixed_outcomes"],
        "blocked_outcomes": bucket["blocked_outcomes"],
        "base_score_before_direction": round(bucket["base_score_before_direction"], 4),
        "direction_adjusted_score": round(bucket["direction_adjusted_score"], 4),
        "raw_score": round(raw_score, 4),
        "normalized_score": round(normalized_score, 4),
        "display_score": round(raw_score * confidence_factor, 4),
        "display_normalized_score": round(normalized_score * confidence_factor, 4),
        "score_confidence": confidence_label,
        "score_confidence_factor": confidence_factor,
        "low_coverage_warning": (
            "This score is based on extremely limited data and may not be representative."
            if 0 < total_outcomes <= 2
            else None
        ),
        "avg_score_per_policy": round(raw_score / total_policies, 4) if total_policies else 0,
        "confidence_avg": round(bucket["confidence_total"] / total_outcomes, 4) if total_outcomes else 0,
        "source_quality_counts": dict(sorted(bucket["source_quality_counts"].items())),
        "policy_type_counts": dict(sorted(bucket["policy_type_counts"].items())),
        "intent_modifier_counts": dict(sorted(bucket["intent_modifier_counts"].items())),
        "confidence_flag": "low confidence" if total_outcomes < LOW_CONFIDENCE_OUTCOME_THRESHOLD else "standard",
    }


def prefix_summary(summary: dict[str, Any], prefix: str) -> dict[str, Any]:
    return {
        f"{prefix}_{key}": value
        for key, value in summary.items()
        if key not in {"source_quality_counts", "policy_type_counts", "intent_modifier_counts"}
    }


def legacy_primary_fields(direct: dict[str, Any]) -> dict[str, Any]:
    return {
        "total_policies": direct["total_policies"],
        "total_outcomes": direct["total_outcomes"],
        "positive_outcomes": direct["positive_outcomes"],
        "negative_outcomes": direct["negative_outcomes"],
        "mixed_outcomes": direct["mixed_outcomes"],
        "blocked_outcomes": direct["blocked_outcomes"],
        "base_score_before_direction": direct["base_score_before_direction"],
        "direction_adjusted_score": direct["direction_adjusted_score"],
        "raw_score": direct["raw_score"],
        "normalized_score": direct["normalized_score"],
        "display_score": direct["display_score"],
        "display_normalized_score": direct["display_normalized_score"],
        "score_confidence": direct["score_confidence"],
        "score_confidence_factor": direct["score_confidence_factor"],
        "low_coverage_warning": direct["low_coverage_warning"],
        "avg_score_per_policy": direct["avg_score_per_policy"],
        "confidence_avg": direct["confidence_avg"],
        "confidence_flag": direct["confidence_flag"],
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
        family = contribution.get("score_family") or (
            SCORE_FAMILY_SYSTEMIC if contribution.get("policy_type") == "judicial_impact" else SCORE_FAMILY_DIRECT
        )
        if family not in bucket["families"]:
            bucket["families"][family] = {
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
        add_contribution_to_family(bucket["families"][family], contribution)

    president_rows = []
    for bucket in by_president.values():
        years = bucket["years_in_office"] or 1.0
        direct = summarize_family_bucket(bucket["families"][SCORE_FAMILY_DIRECT], years)
        systemic = summarize_family_bucket(bucket["families"][SCORE_FAMILY_SYSTEMIC], years)
        combined_raw_score = direct["raw_score"] + systemic["raw_score"]
        combined_normalized_score = combined_raw_score / years
        combined_outcome_count = direct["total_outcomes"] + systemic["total_outcomes"]
        combined_confidence_factor = coverage_confidence_factor(combined_outcome_count)
        president_rows.append(
            {
                "president_id": bucket["president_id"],
                "president_name": bucket["president_name"],
                "president_slug": bucket["president_slug"],
                "term_start": bucket["term_start"],
                "term_end": bucket["term_end"],
                "years_in_office": round(years, 4),
                **legacy_primary_fields(direct),
                **prefix_summary(direct, "direct"),
                **prefix_summary(systemic, "systemic"),
                "direct_outcome_count": direct["total_outcomes"],
                "systemic_outcome_count": systemic["total_outcomes"],
                "source_quality_counts": direct["source_quality_counts"],
                "policy_type_counts": direct["policy_type_counts"],
                "intent_modifier_counts": direct["intent_modifier_counts"],
                "systemic_source_quality_counts": systemic["source_quality_counts"],
                "systemic_policy_type_counts": systemic["policy_type_counts"],
                "systemic_intent_modifier_counts": systemic["intent_modifier_counts"],
                "combined_context_score": round(combined_raw_score, 4),
                "combined_context_normalized_score": round(combined_normalized_score, 4),
                "combined_context_display_score": round(combined_raw_score * combined_confidence_factor, 4),
                "combined_context_display_normalized_score": round(combined_normalized_score * combined_confidence_factor, 4),
                "combined_context_score_confidence": score_confidence_label(combined_outcome_count),
                "combined_context_outcome_count": combined_outcome_count,
                "primary_score_family": SCORE_FAMILY_DIRECT,
            }
        )
    president_rows.sort(
        key=lambda row: (
            -row["direct_normalized_score"],
            -row["systemic_normalized_score"],
            -(row["direct_total_outcomes"] or 0),
            row["term_start"] or "",
            row["president_name"] or "",
        )
    )
    return president_rows, unassigned


def duplicate_outcome_ids(contributions: list[dict[str, Any]]) -> list[int]:
    counts = Counter(
        (row["policy_outcome_id"], row.get("president_id"))
        for row in contributions
        if row.get("president_id") is not None
    )
    return sorted(outcome_id for (outcome_id, _president_id), count in counts.items() if count > 1)


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
            president_lookup = fetch_president_lookup(cursor)

    has_impact_score = "impact_score" in columns
    contributions = []
    for row in raw_rows:
        contributions.extend(contributions_for_row(row, has_impact_score, president_lookup))
    president_scores, unassigned = aggregate_scores(contributions)
    duplicate_ids = duplicate_outcome_ids(contributions)
    policy_type_counts = Counter(row.get("policy_type") or "unknown" for row in contributions)
    intent_modifier_counts = Counter(row.get("policy_intent_category") or "unclear" for row in contributions)
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
    judicial_unassigned = [row for row in unassigned if row.get("policy_type") == "judicial_impact"]
    if judicial_unassigned:
        warnings.append(
            f"{len(judicial_unassigned)} judicial policy_outcome contribution(s) are excluded because explicit majority-justice appointment attribution is missing or could not be resolved."
        )
    if duplicate_ids:
        warnings.append(f"Duplicate policy_outcome ids detected in query output: {duplicate_ids}")

    return {
        "workflow": "final_black_impact_score_by_president",
        "generated_at": utc_timestamp(),
        "mode": "read_only",
        "database_mutated": False,
        "formula": {
            "score_families": {
                "direct_black_impact_score": "Primary headline score. Includes direct current-admin outcomes and any direct non-judicial outcomes with deterministic president attribution. Excludes judicial_impact.",
                "systemic_impact_score": "Secondary score family. Includes judicial_impact and future explicitly indirect/systemic outcomes when deterministic attribution exists.",
                "combined_context_score": "Contextual blended total only. It is not the primary score.",
            },
            "base_score": "absolute magnitude from policy_outcomes.impact_score when present; otherwise a documented unit outcome magnitude fallback is used only for backward-compatible reads of older schemas",
            "direction_weights": DIRECTION_WEIGHTS,
            "confidence_multiplier": {
                "source_count = 0": 0.6,
                "source_count = 1": 0.8,
                "source_count >= 2": 1.0,
            },
            "intent_modifiers": {
                "equity_expanding": 1.1,
                "equity_restricting": 0.9,
                "mixed_or_competing": 0.95,
                "neutral_or_unclear": 1.0,
            },
            "policy_type_weights": POLICY_TYPE_WEIGHTS,
            "judicial_attribution": {
                "judicial_weight": JUDICIAL_WEIGHT,
                "rule": "Judicial rows require explicit majority-justice attribution metadata. Each majority justice contributes 1 / majority_count to their appointing president; the resulting presidential fraction is multiplied by the judicial weight.",
            },
            "coverage_display_scaling": {
                "formula": "display_score = raw_score * min(1, log(outcome_count + 1) / log(10)); display_normalized_score applies the same factor to normalized_score",
                "labels": {
                    "VERY LOW": "outcome_count <= 2",
                    "LOW": "outcome_count <= 5",
                    "MEDIUM": "outcome_count <= 15",
                    "HIGH": "outcome_count > 15",
                },
                "raw_scores_preserved": True,
            },
            "president_normalization": "SUM(final_outcome_score) / years_in_office, applied separately to direct and systemic score families",
            "final_outcome_score": "ABS(impact_score) * direction_weight * confidence_multiplier * intent_modifier * policy_type_weight; judicial rows instead use ABS(impact_score) * direction_weight * confidence_multiplier * intent_modifier * attribution_fraction * judicial_weight",
        },
        "join_contract": {
            "current_admin": "policy_outcomes.policy_id -> promises.id -> presidents.id",
            "intent_modifier": "current_admin outcomes resolve policy intent at runtime from linked promise_actions.related_policy_id records and exact policy-title mentions already present in promise action text. Missing links fall back to neutral unclear intent, and competing linked categories resolve to mixed_or_competing.",
            "legislative": "policy_outcomes.policy_id -> tracked_bills.id; no president attribution is available in current schema, so rows are explicitly excluded with excluded_from_president_score=true until attribution exists",
            "judicial_impact": "policy_outcomes.policy_id -> policies.id. President attribution is allowed only through explicit judicial_attribution or majority_justices metadata that maps justices to appointing presidents.",
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
            "direct_outcome_contribution_count": sum(
                1 for row in contributions if row.get("score_family") == SCORE_FAMILY_DIRECT and row.get("president_id") is not None
            ),
            "systemic_outcome_contribution_count": sum(
                1 for row in contributions if row.get("score_family") == SCORE_FAMILY_SYSTEMIC and row.get("president_id") is not None
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
                columns,
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
        "display_score",
        "display_normalized_score",
        "score_confidence",
        "score_confidence_factor",
        "direct_raw_score",
        "direct_normalized_score",
        "direct_outcome_count",
        "direct_score_confidence",
        "systemic_raw_score",
        "systemic_normalized_score",
        "systemic_outcome_count",
        "systemic_score_confidence",
        "combined_context_score",
        "combined_context_normalized_score",
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
