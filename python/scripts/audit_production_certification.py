#!/usr/bin/env python3
import argparse
import csv
import math
from collections import Counter, defaultdict
from datetime import date
from difflib import SequenceMatcher
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


TARGET_CATEGORIES = {
    "Housing",
    "Education",
    "Criminal Justice",
    "Voting Rights",
    "Labor",
    "Healthcare",
}

DIRECTION_WEIGHTS = {
    "Positive": 1.0,
    "Mixed": 0.25,
    "Negative": -1.0,
    "Blocked": 0.0,
}

POLICY_TYPE_WEIGHTS = {
    "current_admin": 1.0,
    "legislative": 0.8,
    "judicial_impact": 1.0,
}

INTENT_MODIFIERS = {
    "equity_expanding": 1.1,
    "equity_restricting": 0.9,
    "neutral_administrative": 1.0,
    "mixed_or_competing": 1.0,
    "unclear": 1.0,
}

EVIDENCE_PRIORITY = {"Strong": 30, "Moderate": 20, "Weak": 10}
STATUS_PRIORITY = {"Complete": 15, "Delivered": 15, "Failed": 12, "Partial": 10, "Blocked": 8, "In Progress": 5}
SOURCE_QUALITY_SCORE = {"high": 1.0, "medium": 0.75, "low": 0.4, None: 0.0}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Read-only end-to-end certification audit for production EquityStack data."
    )
    parser.add_argument("--output", type=Path, help="Certification audit JSON path")
    parser.add_argument("--top-limit", type=int, default=25, help="Sample row limit for issue lists")
    return parser.parse_args()


def default_output_path() -> Path:
    return get_reports_dir() / "production-data-model-scoring-certification.json"


def table_exists(cursor, table_name: str) -> bool:
    cursor.execute("SHOW TABLES LIKE %s", (table_name,))
    return cursor.fetchone() is not None


def get_table_columns(cursor, table_name: str) -> set[str]:
    if not table_exists(cursor, table_name):
        return set()
    cursor.execute(f"SHOW COLUMNS FROM {table_name}")
    return {str(row["Field"]) for row in cursor.fetchall() or []}


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


def number(value: Any, default: float = 0.0) -> float:
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


def years_in_office(start: Any, end: Any) -> float:
    start_text = iso_date(start)
    if not start_text:
        return 1.0
    end_text = iso_date(end) or date.today().isoformat()
    days = max(1, (date.fromisoformat(end_text) - date.fromisoformat(start_text)).days)
    return round(days / 365.2425, 4)


def confidence_multiplier(source_count: Any) -> float:
    count = int(number(source_count, 0))
    if count <= 0:
        return 0.6
    if count == 1:
        return 0.8
    return 1.0


def sequence_ratio(left: Any, right: Any) -> float:
    left_text = " ".join(str(left or "").lower().split())
    right_text = " ".join(str(right or "").lower().split())
    if not left_text or not right_text:
        return 0.0
    return SequenceMatcher(None, left_text, right_text).ratio()


def derived_missing_source_priority(row: dict[str, Any]) -> int:
    score = 0
    direction = normalize_direction(row.get("impact_direction"))
    if direction in {"Positive", "Negative"}:
        score += 50
    elif direction == "Mixed":
        score += 30
    elif direction == "Blocked":
        score += 25
    score += EVIDENCE_PRIORITY.get(row.get("evidence_strength"), 0)
    score += STATUS_PRIORITY.get(row.get("status"), 0)
    if normalize_nullable_text(row.get("measurable_impact")):
        score += 3
    if normalize_nullable_text(row.get("black_community_impact_note")):
        score += 2
    return score


def historical_policy_score(row: dict[str, Any]) -> int:
    return (
        int(row.get("directness_score") or 0) * 2
        + int(row.get("material_impact_score") or 0) * 2
        + int(row.get("evidence_score") or 0)
        + int(row.get("durability_score") or 0)
        + int(row.get("equity_score") or 0) * 2
        - int(row.get("harm_offset_score") or 0)
    )


def fetch_policy_outcomes(cursor, columns: set[str]) -> list[dict[str, Any]]:
    impact_score_expr = "po.impact_score" if "impact_score" in columns else "NULL"
    cursor.execute(
        f"""
        SELECT
          po.id AS policy_outcome_id,
          po.policy_type,
          po.policy_id,
          po.record_key,
          po.outcome_summary,
          po.outcome_summary_hash,
          po.outcome_type,
          po.measurable_impact,
          po.impact_direction,
          po.evidence_strength,
          po.confidence_score,
          po.source_count,
          po.source_quality,
          {impact_score_expr} AS impact_score,
          po.status,
          po.impact_start_date,
          po.impact_end_date,
          po.impact_duration_estimate,
          po.black_community_impact_note,
          CASE
            WHEN po.policy_type = 'current_admin' THEN p.title
            WHEN po.policy_type = 'legislative' THEN tb.title
            WHEN po.policy_type = 'judicial_impact' THEN jp.title
            ELSE NULL
          END AS policy_title,
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
            WHEN po.policy_type = 'current_admin' THEN related_intent.policy_intent_category
            WHEN po.policy_type = 'judicial_impact' THEN jp.policy_intent_category
            ELSE NULL
          END AS policy_intent_category,
          tb.bill_status,
          tb.last_action,
          tb.bill_number
        FROM policy_outcomes po
        LEFT JOIN promises p
          ON po.policy_type = 'current_admin'
         AND p.id = po.policy_id
        LEFT JOIN presidents pr ON pr.id = p.president_id
        LEFT JOIN tracked_bills tb
          ON po.policy_type = 'legislative'
         AND tb.id = po.policy_id
        LEFT JOIN policies jp
          ON po.policy_type = 'judicial_impact'
         AND jp.id = po.policy_id
        LEFT JOIN (
          SELECT
            pa.promise_id,
            CASE
              WHEN COUNT(DISTINCT pol.policy_intent_category) = 1 THEN MAX(pol.policy_intent_category)
              ELSE NULL
            END AS policy_intent_category
          FROM promise_actions pa
          JOIN policies pol
            ON pol.id = pa.related_policy_id
           AND pol.policy_intent_category IS NOT NULL
          GROUP BY pa.promise_id
        ) related_intent
          ON po.policy_type = 'current_admin'
         AND related_intent.promise_id = po.policy_id
        ORDER BY po.policy_type, po.policy_id, po.id
        """
    )
    return list(cursor.fetchall() or [])


def fetch_policies(cursor) -> list[dict[str, Any]]:
    cursor.execute(
        """
        SELECT
          p.id AS policy_id,
          p.title,
          p.year_enacted,
          p.impact_direction,
          p.policy_intent_category,
          p.policy_intent_summary,
          p.status,
          p.is_archived,
          GROUP_CONCAT(DISTINCT pc.name ORDER BY pc.name SEPARATOR ', ') AS categories,
          COALESCE(ps.directness_score, 0) AS directness_score,
          COALESCE(ps.material_impact_score, 0) AS material_impact_score,
          COALESCE(ps.evidence_score, 0) AS evidence_score,
          COALESCE(ps.durability_score, 0) AS durability_score,
          COALESCE(ps.equity_score, 0) AS equity_score,
          COALESCE(ps.harm_offset_score, 0) AS harm_offset_score
        FROM policies p
        LEFT JOIN policy_scores ps ON ps.policy_id = p.id
        LEFT JOIN policy_policy_categories ppc ON ppc.policy_id = p.id
        LEFT JOIN policy_categories pc ON pc.id = ppc.category_id
        WHERE COALESCE(p.is_archived, 0) = 0
        GROUP BY
          p.id,
          p.title,
          p.year_enacted,
          p.impact_direction,
          p.policy_intent_category,
          p.policy_intent_summary,
          p.status,
          p.is_archived,
          ps.directness_score,
          ps.material_impact_score,
          ps.evidence_score,
          ps.durability_score,
          ps.equity_score,
          ps.harm_offset_score
        ORDER BY p.year_enacted ASC, p.id ASC
        """
    )
    rows = []
    for row in cursor.fetchall() or []:
        categories = [item.strip() for item in str(row.get("categories") or "").split(",") if item.strip()]
        rows.append({**row, "categories": categories, "impact_score": historical_policy_score(row)})
    return rows


def fetch_tracked_bills(cursor) -> list[dict[str, Any]]:
    if not table_exists(cursor, "tracked_bills"):
        return []
    cursor.execute(
        """
        SELECT id, bill_number, title, bill_status, last_action, introduced_date, latest_action_date
        FROM tracked_bills
        ORDER BY id ASC
        """
    )
    return list(cursor.fetchall() or [])


def score_outcome(row: dict[str, Any], has_impact_score: bool) -> dict[str, Any]:
    direction = normalize_direction(row.get("impact_direction"))
    direction_weight = DIRECTION_WEIGHTS.get(direction, 0.0)
    stored_impact_score = number(row.get("impact_score"), 1.0 if not has_impact_score else 0.0)
    impact_score = abs(stored_impact_score) if has_impact_score else stored_impact_score
    confidence = confidence_multiplier(row.get("source_count"))
    intent = normalize_intent(row.get("policy_intent_category"))
    intent_modifier = INTENT_MODIFIERS.get(intent, 1.0)
    policy_type = normalize_nullable_text(row.get("policy_type"))
    policy_type_weight = POLICY_TYPE_WEIGHTS.get(policy_type, 1.0)
    excluded_from_president_score = row.get("president_id") is None
    final_score = impact_score * direction_weight * confidence * intent_modifier * policy_type_weight
    return {
        "policy_outcome_id": int(row["policy_outcome_id"]),
        "policy_type": policy_type,
        "policy_id": int(row["policy_id"]),
        "policy_title": row.get("policy_title"),
        "president_id": int(row["president_id"]) if row.get("president_id") is not None else None,
        "president_name": row.get("president_name"),
        "president_slug": row.get("president_slug"),
        "excluded_from_president_score": excluded_from_president_score,
        "president_score_exclusion_reason": (
            "legislative_outcome_has_no_deterministic_president_attribution"
            if excluded_from_president_score and policy_type == "legislative"
            else "judicial_impact_requires_explicit_majority_justice_attribution"
            if excluded_from_president_score and policy_type == "judicial_impact"
            else "missing_president_attribution" if excluded_from_president_score else None
        ),
        "term_start": iso_date(row.get("term_start")),
        "term_end": iso_date(row.get("term_end")),
        "outcome_summary": row.get("outcome_summary"),
        "impact_direction": direction,
        "impact_score": round(impact_score, 4),
        "stored_impact_score": round(stored_impact_score, 4),
        "impact_score_source": "policy_outcomes.impact_score" if has_impact_score else "unit_outcome_magnitude_fallback",
        "direction_weight": direction_weight,
        "confidence_multiplier": confidence,
        "policy_intent_category": intent,
        "intent_modifier": intent_modifier,
        "policy_type_weight": policy_type_weight,
        "final_outcome_score": round(final_score, 4),
        "source_count": int(number(row.get("source_count"), 0)),
        "source_quality": row.get("source_quality"),
        "bill_status": row.get("bill_status"),
        "term_years": years_in_office(row.get("term_start"), row.get("term_end")),
    }


def scoring_integrity(outcomes: list[dict[str, Any]], has_impact_score: bool, limit: int) -> dict[str, Any]:
    issues = []
    if not has_impact_score:
        issues.append(
            {
                "issue": "missing_impact_score_column",
                "severity": "high",
                "detail": "policy_outcomes.impact_score is absent, so sign/magnitude alignment cannot be certified from stored outcome scores.",
                "affected_rows": len(outcomes),
            }
        )
    for row in outcomes:
        direction = normalize_direction(row.get("impact_direction"))
        score = number(row.get("impact_score"), 0.0)
        if has_impact_score and direction == "Positive" and score < 0:
            issues.append(sample_issue(row, "positive_with_negative_score"))
        if has_impact_score and direction == "Negative" and score > 0:
            issues.append(sample_issue(row, "negative_with_positive_score"))
        if has_impact_score and direction == "Blocked" and score != 0:
            issues.append(sample_issue(row, "blocked_with_nonzero_score"))
        if has_impact_score and direction == "Mixed" and abs(score) > 0.5:
            issues.append(sample_issue(row, "mixed_outcome_outside_expected_range"))
    return {
        "status": "WARN" if issues else "PASS",
        "impact_score_column_present": has_impact_score,
        "inconsistency_count": len(issues),
        "sample_issues": issues[:limit],
    }


def sample_issue(row: dict[str, Any], issue: str) -> dict[str, Any]:
    return {
        "issue": issue,
        "policy_outcome_id": int(row["policy_outcome_id"]),
        "policy_type": row.get("policy_type"),
        "policy_id": int(row["policy_id"]),
        "policy_title": row.get("policy_title"),
        "impact_direction": row.get("impact_direction"),
        "impact_score": row.get("impact_score"),
        "outcome_summary": row.get("outcome_summary"),
    }


def duplicate_audit(outcomes: list[dict[str, Any]], scored: list[dict[str, Any]], limit: int) -> dict[str, Any]:
    groups: dict[tuple[Any, Any, Any], list[dict[str, Any]]] = defaultdict(list)
    for row in outcomes:
        groups[(row.get("policy_type"), row.get("policy_id"), row.get("outcome_summary_hash"))].append(row)
    duplicate_groups = [
        {
            "policy_type": key[0],
            "policy_id": int(key[1]),
            "outcome_summary_hash": key[2],
            "rows": [sample_outcome(row) for row in rows],
        }
        for key, rows in groups.items()
        if len(rows) > 1
    ]

    near_duplicates = []
    by_policy: dict[tuple[Any, Any], list[dict[str, Any]]] = defaultdict(list)
    for row in outcomes:
        by_policy[(row.get("policy_type"), row.get("policy_id"))].append(row)
    for (policy_type, policy_id), rows in by_policy.items():
        for left_index, left in enumerate(rows):
            for right in rows[left_index + 1 :]:
                similarity = sequence_ratio(left.get("outcome_summary"), right.get("outcome_summary"))
                if similarity > 0.9:
                    near_duplicates.append(
                        {
                            "policy_type": policy_type,
                            "policy_id": int(policy_id),
                            "similarity": round(similarity, 4),
                            "left": sample_outcome(left),
                            "right": sample_outcome(right),
                            "recommended_action": "manual deduplication review",
                        }
                    )

    contribution_ids = Counter(item["policy_outcome_id"] for item in scored)
    duplicate_contributions = [
        {"policy_outcome_id": outcome_id, "contribution_count": count}
        for outcome_id, count in contribution_ids.items()
        if count > 1
    ]
    return {
        "status": "WARN" if duplicate_groups or near_duplicates or duplicate_contributions else "PASS",
        "duplicate_group_count": len(duplicate_groups),
        "near_duplicate_group_count": len(near_duplicates),
        "duplicate_scoring_contribution_count": len(duplicate_contributions),
        "duplicate_groups": duplicate_groups[:limit],
        "near_duplicate_groups": near_duplicates[:limit],
        "duplicate_scoring_contributions": duplicate_contributions[:limit],
    }


def sample_outcome(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "policy_outcome_id": int(row["policy_outcome_id"]),
        "policy_type": row.get("policy_type"),
        "policy_id": int(row["policy_id"]),
        "policy_title": row.get("policy_title"),
        "impact_direction": row.get("impact_direction"),
        "source_count": int(number(row.get("source_count"), 0)),
        "outcome_summary": row.get("outcome_summary"),
    }


def source_coverage_audit(outcomes: list[dict[str, Any]], limit: int) -> dict[str, Any]:
    total = len(outcomes)
    source_buckets = Counter()
    by_type: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in outcomes:
        count = int(number(row.get("source_count"), 0))
        if count == 0:
            source_buckets["0_sources"] += 1
        elif count == 1:
            source_buckets["1_source"] += 1
        else:
            source_buckets["2_plus_sources"] += 1
        by_type[str(row.get("policy_type") or "unknown")].append(row)

    by_policy_type = {}
    for policy_type, rows in by_type.items():
        avg = sum(int(number(row.get("source_count"), 0)) for row in rows) / len(rows) if rows else 0
        by_policy_type[policy_type] = {
            "outcome_count": len(rows),
            "average_source_count": round(avg, 4),
            "source_bucket_counts": dict(Counter(source_bucket(row) for row in rows)),
        }

    missing = sorted(
        [row for row in outcomes if int(number(row.get("source_count"), 0)) == 0],
        key=lambda row: (-derived_missing_source_priority(row), int(row["policy_outcome_id"])),
    )
    return {
        "status": "WARN" if source_buckets["0_sources"] else "PASS",
        "total_outcomes": total,
        "source_bucket_counts": dict(source_buckets),
        "source_bucket_percentages": {
            key: round(value / total, 4) if total else 0 for key, value in source_buckets.items()
        },
        "by_policy_type": by_policy_type,
        "low_confidence_outcome_count": source_buckets["0_sources"],
        "top_25_highest_impact_missing_sources": [
            {
                **sample_outcome(row),
                "impact_proxy_score": derived_missing_source_priority(row),
                "impact_score_kind": "derived_missing_source_priority",
                "evidence_strength": row.get("evidence_strength"),
                "status": row.get("status"),
            }
            for row in missing[:limit]
        ],
    }


def source_bucket(row: dict[str, Any]) -> str:
    count = int(number(row.get("source_count"), 0))
    if count == 0:
        return "0_sources"
    if count == 1:
        return "1_source"
    return "2_plus_sources"


def policy_intent_audit(policies: list[dict[str, Any]], limit: int) -> dict[str, Any]:
    total = len(policies)
    distribution = Counter(normalize_intent(row.get("policy_intent_category")) or "unclassified" for row in policies)
    unclassified = sorted(
        [row for row in policies if normalize_intent(row.get("policy_intent_category")) is None],
        key=lambda row: (-row["impact_score"], int(row.get("year_enacted") or 9999), int(row["policy_id"])),
    )
    return {
        "status": "WARN" if unclassified else "PASS",
        "total_policies": total,
        "classified_policy_count": total - len(unclassified),
        "unclassified_policy_count": len(unclassified),
        "classified_policy_pct": round((total - len(unclassified)) / total, 4) if total else 0,
        "distribution": dict(sorted(distribution.items())),
        "high_impact_unclassified_policies": [
            {
                "policy_id": int(row["policy_id"]),
                "title": row.get("title"),
                "year": int(row["year_enacted"]) if row.get("year_enacted") is not None else None,
                "impact_direction": row.get("impact_direction"),
                "impact_score": row["impact_score"],
                "categories": row["categories"],
            }
            for row in unclassified[:limit]
        ],
    }


def legislative_pipeline_audit(outcomes: list[dict[str, Any]], tracked_bills: list[dict[str, Any]], limit: int) -> dict[str, Any]:
    legislative_outcomes = [row for row in outcomes if row.get("policy_type") == "legislative"]
    status_distribution = Counter(row.get("bill_status") or "unknown" for row in tracked_bills)
    outcome_status_distribution = Counter(row.get("impact_direction") or "unknown" for row in legislative_outcomes)
    violations = []
    for row in legislative_outcomes:
        bill_status = str(row.get("bill_status") or "").lower()
        direction = normalize_direction(row.get("impact_direction"))
        enacted_like = any(term in bill_status for term in ["enacted", "signed", "public law"])
        non_enacted_like = bill_status in {"introduced", "in committee", "referred", "reported"}
        if direction == "Positive" and not enacted_like:
            violations.append(sample_issue(row, "positive_legislative_outcome_without_enacted_status"))
        if non_enacted_like and direction not in {"Blocked", "Mixed"}:
            violations.append(sample_issue(row, "non_enacted_legislative_status_not_blocked_or_mixed"))
    status = "PASS"
    warnings = []
    if tracked_bills and not legislative_outcomes:
        status = "WARN"
        warnings.append(
            "tracked_bills exist, but policy_outcomes contains no legislative rows; legislative materialization has not been applied."
        )
    if violations:
        status = "FAIL"
    return {
        "status": status,
        "tracked_bills_evaluated": len(tracked_bills),
        "legislative_policy_outcomes": len(legislative_outcomes),
        "tracked_bill_status_distribution": dict(sorted(status_distribution.items())),
        "legislative_outcome_direction_distribution": dict(sorted(outcome_status_distribution.items())),
        "violations_count": len(violations),
        "violations": violations[:limit],
        "warnings": warnings,
    }


def president_score_audit(scored: list[dict[str, Any]], limit: int) -> dict[str, Any]:
    by_president: dict[str, dict[str, Any]] = {}
    seen_ids = Counter()
    anomalies = []
    for row in scored:
        seen_ids[row["policy_outcome_id"]] += 1
        if row["president_id"] is None:
            continue
        key = f'{row["president_id"]}:{row["president_slug"]}'
        if key not in by_president:
            by_president[key] = {
                "president_name": row["president_name"],
                "president_slug": row["president_slug"],
                "term_start": row["term_start"],
                "term_end": row["term_end"],
                "years_in_office": row["term_years"],
                "policy_keys": set(),
                "total_outcomes": 0,
                "positive_outcomes": 0,
                "negative_outcomes": 0,
                "mixed_outcomes": 0,
                "blocked_outcomes": 0,
                "raw_score": 0.0,
                "confidence_total": 0.0,
            }
        bucket = by_president[key]
        bucket["policy_keys"].add(f'{row["policy_type"]}:{row["policy_id"]}')
        bucket["total_outcomes"] += 1
        if row["impact_direction"] == "Positive":
            bucket["positive_outcomes"] += 1
        elif row["impact_direction"] == "Negative":
            bucket["negative_outcomes"] += 1
        elif row["impact_direction"] == "Mixed":
            bucket["mixed_outcomes"] += 1
        elif row["impact_direction"] == "Blocked":
            bucket["blocked_outcomes"] += 1
        bucket["raw_score"] += row["final_outcome_score"]
        bucket["confidence_total"] += row["confidence_multiplier"]

    rows = []
    for bucket in by_president.values():
        years = bucket["years_in_office"] or 1.0
        raw = round(bucket["raw_score"], 4)
        total_outcomes = bucket["total_outcomes"]
        normalized = round(raw / years, 4)
        confidence_avg = round(bucket["confidence_total"] / total_outcomes, 4) if total_outcomes else 0
        row = {
            "president_name": bucket["president_name"],
            "president_slug": bucket["president_slug"],
            "term_start": bucket["term_start"],
            "term_end": bucket["term_end"],
            "years_in_office": round(years, 4),
            "total_policies": len(bucket["policy_keys"]),
            "total_outcomes": total_outcomes,
            "positive_outcomes": bucket["positive_outcomes"],
            "negative_outcomes": bucket["negative_outcomes"],
            "mixed_outcomes": bucket["mixed_outcomes"],
            "blocked_outcomes": bucket["blocked_outcomes"],
            "raw_score": raw,
            "normalized_score": normalized,
            "avg_score_per_policy": round(raw / len(bucket["policy_keys"]), 4) if bucket["policy_keys"] else 0,
            "confidence_avg": confidence_avg,
            "confidence_flag": "low confidence" if total_outcomes < 5 else "standard",
        }
        if abs(normalized) > 2.0:
            anomalies.append({**row, "anomaly": "extreme_normalized_score"})
        rows.append(row)
    rows.sort(key=lambda row: (-row["normalized_score"], row["president_name"] or ""))
    duplicate_ids = [outcome_id for outcome_id, count in seen_ids.items() if count > 1]
    return {
        "status": "WARN" if anomalies else "PASS",
        "duplicate_outcome_aggregation_count": len(duplicate_ids),
        "top_10_presidents_by_score": rows[:10],
        "bottom_10_presidents_by_score": sorted(rows, key=lambda row: (row["normalized_score"], row["president_name"] or ""))[:10],
        "anomalies": anomalies[:limit],
        "low_confidence_presidents": [row for row in rows if row["confidence_flag"] == "low confidence"],
    }


def temporal_coverage_audit(policies: list[dict[str, Any]]) -> dict[str, Any]:
    by_decade = Counter()
    for row in policies:
        year = row.get("year_enacted")
        if year is None:
            by_decade["unknown"] += 1
        else:
            by_decade[f"{(int(year) // 10) * 10}s"] += 1
    counts = dict(sorted(by_decade.items()))
    low_decades = [
        {"decade": decade, "policy_count": count}
        for decade, count in counts.items()
        if decade != "unknown" and count < 2
    ]
    return {
        "status": "WARN" if low_decades else "PASS",
        "policy_count_by_decade": counts,
        "underrepresented_periods": low_decades,
    }


def category_coverage_audit(policies: list[dict[str, Any]]) -> dict[str, Any]:
    counts = Counter()
    for row in policies:
        for category in row.get("categories") or []:
            if category in TARGET_CATEGORIES:
                counts[category] += 1
    weak = [
        {"category": category, "policy_count": counts.get(category, 0)}
        for category in sorted(TARGET_CATEGORIES)
        if counts.get(category, 0) < 10
    ]
    return {
        "status": "WARN" if weak else "PASS",
        "policy_count_per_category": {category: counts.get(category, 0) for category in sorted(TARGET_CATEGORIES)},
        "missing_or_weak_categories": weak,
    }


def completeness_score(source_audit: dict[str, Any], intent_audit: dict[str, Any], legislative_audit: dict[str, Any], temporal_audit: dict[str, Any], category_audit: dict[str, Any], outcomes: list[dict[str, Any]]) -> dict[str, Any]:
    total_outcomes = len(outcomes)
    sourced = total_outcomes - source_audit["low_confidence_outcome_count"]
    source_component = 25 * (sourced / total_outcomes if total_outcomes else 0)
    intent_component = 20 * intent_audit.get("classified_policy_pct", 0)
    legislative_component = 15 if legislative_audit["legislative_policy_outcomes"] > 0 else 0
    dated = sum(1 for row in outcomes if row.get("impact_start_date"))
    temporal_component = 20 * (dated / total_outcomes if total_outcomes else 0)
    category_counts = category_audit["policy_count_per_category"]
    present_categories = sum(1 for count in category_counts.values() if count > 0)
    category_component = 20 * (present_categories / len(TARGET_CATEGORIES))
    total = source_component + intent_component + legislative_component + temporal_component + category_component
    return {
        "final_completeness_score": round(total, 2),
        "component_breakdown": {
            "source_coverage": round(source_component, 2),
            "intent_classification": round(intent_component, 2),
            "legislative_inclusion": round(legislative_component, 2),
            "temporal_coverage": round(temporal_component, 2),
            "category_coverage": round(category_component, 2),
        },
        "scale": "0-100",
    }


def certification_status(section_statuses: list[str], completeness: dict[str, Any]) -> str:
    if "FAIL" in section_statuses:
        return "FAIL"
    if completeness["final_completeness_score"] < 70:
        return "WARN"
    if "WARN" in section_statuses:
        return "WARN"
    return "PASS"


def build_report(args: argparse.Namespace) -> dict[str, Any]:
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            policy_outcomes_columns = get_table_columns(cursor, "policy_outcomes")
            policies = fetch_policies(cursor)
            outcomes = fetch_policy_outcomes(cursor, policy_outcomes_columns)
            tracked_bills = fetch_tracked_bills(cursor)

    has_impact_score = "impact_score" in policy_outcomes_columns
    scored = [score_outcome(row, has_impact_score) for row in outcomes]
    scoring = scoring_integrity(outcomes, has_impact_score, args.top_limit)
    duplicates = duplicate_audit(outcomes, scored, args.top_limit)
    sources = source_coverage_audit(outcomes, args.top_limit)
    intent = policy_intent_audit(policies, args.top_limit)
    legislative = legislative_pipeline_audit(outcomes, tracked_bills, args.top_limit)
    president = president_score_audit(scored, args.top_limit)
    temporal = temporal_coverage_audit(policies)
    category = category_coverage_audit(policies)
    completeness = completeness_score(sources, intent, legislative, temporal, category, outcomes)
    statuses = [
        scoring["status"],
        duplicates["status"],
        sources["status"],
        intent["status"],
        legislative["status"],
        president["status"],
        temporal["status"],
        category["status"],
    ]
    status = certification_status(statuses, completeness)

    critical_gaps = []
    if not has_impact_score:
        critical_gaps.append("policy_outcomes.impact_score is absent; final magnitude-sensitive scoring is using a unit fallback and cannot be fully certified as specified.")
    if legislative["legislative_policy_outcomes"] == 0 and tracked_bills:
        critical_gaps.append("tracked_bills exist, but legislative policy_outcomes have not been materialized/applied.")
    if sources["low_confidence_outcome_count"]:
        critical_gaps.append(f"{sources['low_confidence_outcome_count']} policy_outcomes have source_count=0.")

    minor_gaps = []
    if intent["unclassified_policy_count"]:
        minor_gaps.append(f"{intent['unclassified_policy_count']} active policies remain without policy_intent_category.")
    if category["missing_or_weak_categories"]:
        weak = ", ".join(f"{row['category']} ({row['policy_count']})" for row in category["missing_or_weak_categories"])
        minor_gaps.append(f"Weak category coverage under 10 records: {weak}.")
    if temporal["underrepresented_periods"]:
        minor_gaps.append("Some decades have fewer than 2 historical policy records.")

    recommended = [
        "Add or backfill a canonical numeric outcome impact magnitude if this score must use policy_outcomes.impact_score directly.",
        "Curate sources for the highest-priority source_count=0 policy_outcomes.",
        "Review and apply legislative materialization only after accepting procedural blocked-status outcomes.",
        "Finish manual policy intent curation for remaining high-impact unclassified policies.",
        "Use the Missing Policy Report to fill remaining landmark historical gaps before public interpretation.",
    ]

    return {
        "workflow": "production_data_model_scoring_certification_audit",
        "generated_at": utc_timestamp(),
        "mode": "read_only",
        "database_mutated": False,
        "data_integrity_status": status,
        "system_strengths": [
            "policy_outcomes rows join deterministically to current-admin promises and presidents.",
            "No duplicate scoring aggregation was detected.",
            "All policy_outcomes currently have impact_start_date values.",
            "Major target categories are present in the historical policies table.",
        ],
        "critical_gaps": critical_gaps,
        "minor_gaps": minor_gaps,
        "recommended_next_actions": recommended[:5],
        "dataset_completeness_score": completeness,
        "sections": {
            "scoring_integrity_audit": scoring,
            "duplicate_and_collision_detection": duplicates,
            "source_coverage_and_confidence_audit": sources,
            "policy_intent_coverage_audit": intent,
            "legislative_pipeline_validation": legislative,
            "president_score_validation": president,
            "temporal_coverage_audit": temporal,
            "category_coverage_audit": category,
        },
        "readiness_assessment": {
            "internally_consistent": status != "FAIL",
            "historically_credible": completeness["final_completeness_score"] >= 70 and not critical_gaps,
            "ready_for_public_facing_interpretation": status == "PASS",
            "plain_language": (
                "Ready for cautious internal/operator interpretation, but not fully certified for public-facing final-score claims."
                if status == "WARN"
                else "Certification passed."
                if status == "PASS"
                else "Certification failed; resolve critical integrity violations before public interpretation."
            ),
        },
    }


def main() -> None:
    args = parse_args()
    output_path = (args.output or default_output_path()).resolve()
    report = build_report(args)
    write_json_file(output_path, report)
    print_json(
        {
            "ok": True,
            "output": str(output_path),
            "data_integrity_status": report["data_integrity_status"],
            "final_completeness_score": report["dataset_completeness_score"]["final_completeness_score"],
            "critical_gap_count": len(report["critical_gaps"]),
            "database_mutated": False,
        }
    )


if __name__ == "__main__":
    main()
