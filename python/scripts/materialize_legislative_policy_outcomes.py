#!/usr/bin/env python3
import argparse
import hashlib
import re
from collections import Counter
from pathlib import Path
from typing import Any

from audit_source_quality import classify_source_quality
from current_admin_common import (
    get_db_connection,
    get_reports_dir,
    normalize_nullable_text,
    print_json,
    require_apply_confirmation,
    utc_timestamp,
    write_json_file,
)


POLICY_TYPE = "legislative"
VALID_IMPACT_DIRECTIONS = {"Positive", "Negative", "Mixed", "Blocked"}
DIRECTION_FALLBACK_IMPACT_SCORE = {
    "Positive": 1.0,
    "Mixed": 0.5,
    "Negative": -1.0,
    "Blocked": 0.0,
}
ENACTED_TERMS = {
    "became public law",
    "became law",
    "signed by president",
    "signed into law",
    "public law no",
    "enacted",
}
NOT_ENACTED_STATUSES = {
    "introduced",
    "in committee",
    "referred",
    "reported",
    "passed house",
    "passed senate",
}
SOURCE_QUALITY_RANK = {None: 0, "low": 1, "medium": 2, "high": 3}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Dry-run or apply an insert-only materialization from legislative "
            "tracked_bills into unified policy_outcomes."
        )
    )
    parser.add_argument("--output", type=Path, help="Materialization report JSON path")
    parser.add_argument("--apply", action="store_true", help="Insert eligible missing legislative policy_outcomes")
    parser.add_argument("--yes", action="store_true", help="Required confirmation for --apply")
    parser.add_argument("--limit", type=int, help="Limit tracked bills evaluated")
    parser.add_argument("--only-tracked-bill-id", type=int, action="append", help="Limit to one or more tracked_bills.id values")
    parser.add_argument(
        "--enacted-only",
        action="store_true",
        help="Only materialize bills with explicit enacted/signed/public-law status text.",
    )
    return parser.parse_args()


def default_output_path(apply: bool) -> Path:
    suffix = "apply" if apply else "dry-run"
    return get_reports_dir() / f"legislative-policy-outcomes-materialize.{suffix}.json"


def outcome_summary_hash(summary: Any) -> str:
    return hashlib.sha256((normalize_nullable_text(summary) or "").encode("utf-8")).hexdigest()


def compact_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip().lower()


def text_similarity(left: Any, right: Any) -> float:
    left_tokens = {token for token in re.split(r"[^a-z0-9]+", compact_text(left)) if token}
    right_tokens = {token for token in re.split(r"[^a-z0-9]+", compact_text(right)) if token}
    if not left_tokens or not right_tokens:
        return 0.0
    return len(left_tokens & right_tokens) / len(left_tokens | right_tokens)


def normalize_bill_status(value: Any) -> str | None:
    text = normalize_nullable_text(value)
    if text is None:
        return None
    normalized = compact_text(text)
    if any(term in normalized for term in ENACTED_TERMS):
        return "Enacted"
    if normalized in NOT_ENACTED_STATUSES:
        return text
    return text


def is_enacted(row: dict[str, Any], actions: list[dict[str, Any]]) -> bool:
    haystack = " ".join(
        compact_text(value)
        for value in [
            row.get("bill_status"),
            row.get("last_action"),
            *(action.get("action_text") for action in actions),
            *(action.get("action_type") for action in actions),
        ]
    )
    return any(term in haystack for term in ENACTED_TERMS)


def source_count_for_bill(row: dict[str, Any], actions: list[dict[str, Any]]) -> int:
    urls = set()
    bill_url = normalize_nullable_text(row.get("bill_url"))
    if bill_url:
        urls.add(bill_url.rstrip("/").lower())
    for action in actions:
        source_url = normalize_nullable_text(action.get("source_url"))
        if source_url:
            urls.add(source_url.rstrip("/").lower())
    return len(urls)


def source_quality_for_bill(row: dict[str, Any], actions: list[dict[str, Any]]) -> str | None:
    candidates = []
    if row.get("bill_url"):
        candidates.append(
            {
                "source_url": row.get("bill_url"),
                "source_title": f"{row.get('bill_number')} - Congress.gov bill record",
                "source_type": "Government",
                "publisher": "Congress.gov",
            }
        )
    for action in actions:
        if action.get("source_url"):
            candidates.append(
                {
                    "source_url": action.get("source_url"),
                    "source_title": action.get("action_text"),
                    "source_type": "Government",
                    "publisher": "Congress.gov",
                }
            )
    if not candidates:
        return None
    labels = [classify_source_quality(candidate)["source_quality_label"] for candidate in candidates]
    if "high_authority" in labels:
        return "high"
    if "institutional" in labels:
        return "medium"
    if "secondary" in labels:
        return "medium"
    return "low"


def stronger_source_quality(left: Any, right: Any) -> str | None:
    current = normalize_nullable_text(left)
    incoming = normalize_nullable_text(right)
    return incoming if SOURCE_QUALITY_RANK.get(incoming, 0) > SOURCE_QUALITY_RANK.get(current, 0) else current


def evidence_strength_for_bill(row: dict[str, Any], source_count: int) -> str | None:
    confidence = compact_text(row.get("match_confidence"))
    if source_count < 1:
        return None
    if confidence == "high":
        return "Strong"
    if confidence == "medium":
        return "Moderate"
    return "Weak"


def impact_direction_for_bill(row: dict[str, Any], actions: list[dict[str, Any]]) -> str:
    if is_enacted(row, actions):
        return "Positive"
    return "Blocked"


def impact_score_for_direction(direction: str | None) -> float | None:
    return DIRECTION_FALLBACK_IMPACT_SCORE.get(direction)


def outcome_type_for_bill(row: dict[str, Any], actions: list[dict[str, Any]]) -> str:
    if is_enacted(row, actions):
        return "Legislative Enactment Outcome"
    return "Legislative Status Outcome"


def outcome_summary_for_bill(row: dict[str, Any], actions: list[dict[str, Any]]) -> str:
    bill_number = normalize_nullable_text(row.get("bill_number")) or f"tracked_bill:{row.get('id')}"
    title = normalize_nullable_text(row.get("title")) or "Untitled bill"
    status = normalize_bill_status(row.get("bill_status")) or "unknown status"
    last_action = normalize_nullable_text(row.get("last_action"))
    if is_enacted(row, actions):
        return f"{bill_number} ({title}) reached enacted law status in the legislative tracker."
    if last_action:
        return f"{bill_number} ({title}) remains at legislative status '{status}'. Latest recorded action: {last_action}"
    return f"{bill_number} ({title}) remains at legislative status '{status}'."


def measurable_impact_for_bill(row: dict[str, Any], actions: list[dict[str, Any]]) -> str:
    if is_enacted(row, actions):
        summary = normalize_nullable_text(row.get("official_summary"))
        if summary:
            return f"Congress.gov summary describes the enacted legislative scope: {summary}"
        return "The bill appears enacted in the legislative tracker, but no additional measured downstream impact has been curated yet."
    return (
        "This is a procedural legislative outcome, not a measured downstream community impact. "
        "It records that the tracked bill has not reached enacted law status in the current legislative tracker."
    )


def impact_note_for_bill(row: dict[str, Any], actions: list[dict[str, Any]]) -> str:
    if is_enacted(row, actions):
        return (
            "Legislative outcome materialized from official tracked-bill metadata. "
            "Downstream Black-community impact should be curated separately before stronger claims are made."
        )
    return (
        "Neutral blocked-status outcome: the bill remains tracked but not enacted. "
        "This prevents legislative proposals from being interpreted as realized policy impact."
    )


def impact_start_date_for_bill(row: dict[str, Any]) -> str | None:
    return normalize_nullable_text(row.get("latest_action_date") or row.get("introduced_date"))


def record_key_for_bill(row: dict[str, Any]) -> str:
    return normalize_nullable_text(
        f"{row.get('bill_number')}-{row.get('jurisdiction')}-{row.get('session_label')}"
    ) or f"tracked_bill:{row.get('id')}"


def fetch_tracked_bills(cursor, args: argparse.Namespace) -> list[dict[str, Any]]:
    params: list[Any] = []
    filters = ["COALESCE(tb.active, 1) = 1"]
    if args.only_tracked_bill_id:
        placeholders = ", ".join(["%s"] * len(args.only_tracked_bill_id))
        filters.append(f"tb.id IN ({placeholders})")
        params.extend(args.only_tracked_bill_id)
    sql = f"""
        SELECT
          tb.id,
          tb.bill_number,
          tb.title,
          tb.jurisdiction,
          tb.chamber,
          tb.session_label,
          tb.official_summary,
          tb.bill_url,
          tb.bill_status,
          tb.last_action,
          tb.introduced_date,
          tb.latest_action_date,
          tb.match_confidence,
          COUNT(DISTINCT tba.id) AS action_count,
          COUNT(DISTINCT fbl.future_bill_id) AS future_bill_link_count
        FROM tracked_bills tb
        LEFT JOIN tracked_bill_actions tba ON tba.tracked_bill_id = tb.id
        LEFT JOIN future_bill_links fbl ON fbl.tracked_bill_id = tb.id
        WHERE {" AND ".join(filters)}
        GROUP BY
          tb.id,
          tb.bill_number,
          tb.title,
          tb.jurisdiction,
          tb.chamber,
          tb.session_label,
          tb.official_summary,
          tb.bill_url,
          tb.bill_status,
          tb.last_action,
          tb.introduced_date,
          tb.latest_action_date,
          tb.match_confidence
        ORDER BY tb.latest_action_date DESC, tb.introduced_date DESC, tb.id ASC
    """
    if args.limit is not None and args.limit > 0:
        sql += "\nLIMIT %s"
        params.append(args.limit)
    cursor.execute(sql, params)
    return [
        {
            **row,
            "introduced_date": str(row["introduced_date"]) if row.get("introduced_date") else None,
            "latest_action_date": str(row["latest_action_date"]) if row.get("latest_action_date") else None,
        }
        for row in list(cursor.fetchall() or [])
    ]


def fetch_actions(cursor, tracked_bill_ids: list[int]) -> dict[int, list[dict[str, Any]]]:
    if not tracked_bill_ids:
        return {}
    placeholders = ", ".join(["%s"] * len(tracked_bill_ids))
    cursor.execute(
        f"""
        SELECT tracked_bill_id, action_date, action_text, action_type, chamber, committee_name, source_url
        FROM tracked_bill_actions
        WHERE tracked_bill_id IN ({placeholders})
        ORDER BY tracked_bill_id ASC, action_date ASC, id ASC
        """,
        tracked_bill_ids,
    )
    grouped: dict[int, list[dict[str, Any]]] = {tracked_bill_id: [] for tracked_bill_id in tracked_bill_ids}
    for row in list(cursor.fetchall() or []):
        row["action_date"] = str(row["action_date"]) if row.get("action_date") else None
        grouped.setdefault(int(row["tracked_bill_id"]), []).append(row)
    return grouped


def build_payload(
    row: dict[str, Any], actions: list[dict[str, Any]], args: argparse.Namespace
) -> tuple[dict[str, Any] | None, str | None]:
    if int(row.get("action_count") or 0) < 1:
        return None, "missing_action_data"
    if args.enacted_only and not is_enacted(row, actions):
        return None, "not_enacted"
    if not normalize_nullable_text(row.get("bill_url")):
        return None, "missing_official_bill_url"
    if not normalize_nullable_text(row.get("bill_status")):
        return None, "missing_bill_status"
    if not is_enacted(row, actions) and not normalize_nullable_text(row.get("last_action")):
        return None, "missing_meaningful_status_action"

    source_count = source_count_for_bill(row, actions)
    if source_count < 1:
        return None, "missing_source_signal"

    impact_direction = impact_direction_for_bill(row, actions)
    if impact_direction not in VALID_IMPACT_DIRECTIONS:
        return None, "invalid_impact_direction"
    impact_score = impact_score_for_direction(impact_direction)
    if impact_score is None:
        return None, "missing_impact_score"

    summary = outcome_summary_for_bill(row, actions)
    return {
        "policy_type": POLICY_TYPE,
        "policy_id": int(row["id"]),
        "record_key": record_key_for_bill(row),
        "outcome_summary": summary,
        "outcome_summary_hash": outcome_summary_hash(summary),
        "outcome_type": outcome_type_for_bill(row, actions),
        "measurable_impact": measurable_impact_for_bill(row, actions),
        "impact_direction": impact_direction,
        "impact_score": impact_score,
        "impact_score_source": "direction_fallback",
        "evidence_strength": evidence_strength_for_bill(row, source_count),
        "confidence_score": None,
        "source_count": source_count,
        "source_quality": source_quality_for_bill(row, actions),
        "status": normalize_bill_status(row.get("bill_status")),
        "impact_start_date": impact_start_date_for_bill(row),
        "impact_duration_estimate": "action_date_only" if impact_start_date_for_bill(row) else None,
        "black_community_impact_note": impact_note_for_bill(row, actions),
        "tracked_bill": sanitize_bill(row),
        "source_snapshot": source_snapshot(row, actions),
    }, None


def sanitize_bill(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "tracked_bill_id": int(row["id"]),
        "bill_number": row.get("bill_number"),
        "title": row.get("title"),
        "jurisdiction": row.get("jurisdiction"),
        "session_label": row.get("session_label"),
        "bill_status": row.get("bill_status"),
        "introduced_date": row.get("introduced_date"),
        "latest_action_date": row.get("latest_action_date"),
        "match_confidence": row.get("match_confidence"),
        "action_count": int(row.get("action_count") or 0),
        "future_bill_link_count": int(row.get("future_bill_link_count") or 0),
    }


def source_snapshot(row: dict[str, Any], actions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    sources = []
    if row.get("bill_url"):
        sources.append(
            {
                "source_kind": "official_bill_url",
                "source_url": row.get("bill_url"),
                "publisher": "Congress.gov",
            }
        )
    seen = {normalize_nullable_text(row.get("bill_url")).rstrip("/").lower()} if row.get("bill_url") else set()
    for action in actions:
        source_url = normalize_nullable_text(action.get("source_url"))
        if not source_url:
            continue
        normalized = source_url.rstrip("/").lower()
        if normalized in seen:
            continue
        seen.add(normalized)
        sources.append(
            {
                "source_kind": "bill_action_source_url",
                "source_url": source_url,
                "publisher": "Congress.gov",
                "action_date": action.get("action_date"),
            }
        )
    return sources


def find_existing_policy_outcome(cursor, payload: dict[str, Any]) -> tuple[dict[str, Any] | None, str | None]:
    cursor.execute(
        """
        SELECT *
        FROM policy_outcomes
        WHERE policy_type = %s
          AND policy_id = %s
        ORDER BY id ASC
        """,
        (payload["policy_type"], payload["policy_id"]),
    )
    near_match: tuple[dict[str, Any], float] | None = None
    for row in list(cursor.fetchall() or []):
        if row.get("outcome_summary_hash") == payload["outcome_summary_hash"]:
            return row, "exact_summary_hash"
        similarity = text_similarity(row.get("outcome_summary"), payload.get("outcome_summary"))
        if similarity >= 0.9 and (near_match is None or similarity > near_match[1]):
            near_match = (row, similarity)
    if near_match:
        return near_match[0], f"near_duplicate_summary_similarity_{near_match[1]:.2f}"
    return None, None


def insert_policy_outcome(cursor, payload: dict[str, Any]) -> int:
    cursor.execute(
        """
        INSERT INTO policy_outcomes (
          policy_type,
          policy_id,
          record_key,
          outcome_summary,
          outcome_summary_hash,
          outcome_type,
          measurable_impact,
          impact_direction,
          impact_score,
          evidence_strength,
          confidence_score,
          source_count,
          source_quality,
          status,
          impact_start_date,
          impact_duration_estimate,
          black_community_impact_note
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            payload["policy_type"],
            payload["policy_id"],
            payload["record_key"],
            payload["outcome_summary"],
            payload["outcome_summary_hash"],
            payload["outcome_type"],
            payload["measurable_impact"],
            payload["impact_direction"],
            payload["impact_score"],
            payload["evidence_strength"],
            payload["confidence_score"],
            payload["source_count"],
            payload["source_quality"],
            payload["status"],
            payload["impact_start_date"],
            payload["impact_duration_estimate"],
            payload["black_community_impact_note"],
        ),
    )
    return int(cursor.lastrowid)


def sync_existing_source_metadata(cursor, existing: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any] | None:
    existing_count = int(existing.get("source_count") or 0)
    incoming_count = int(payload.get("source_count") or 0)
    existing_quality = normalize_nullable_text(existing.get("source_quality"))
    incoming_quality = normalize_nullable_text(payload.get("source_quality"))
    next_count = max(existing_count, incoming_count)
    next_quality = stronger_source_quality(existing_quality, incoming_quality)
    if next_count == existing_count and next_quality == existing_quality:
        return None
    cursor.execute(
        """
        UPDATE policy_outcomes
        SET source_count = %s,
            source_quality = %s
        WHERE id = %s
          AND policy_type = 'legislative'
        """,
        (next_count, next_quality, existing["id"]),
    )
    return {
        "policy_outcome_id": int(existing["id"]),
        "previous_source_count": existing_count,
        "new_source_count": next_count,
        "previous_source_quality": existing_quality,
        "new_source_quality": next_quality,
        "reason": "refreshed_legislative_source_metadata_without_downgrading",
    }


def sanitize_payload(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        key: payload.get(key)
        for key in [
            "policy_type",
            "policy_id",
            "record_key",
            "outcome_summary",
            "outcome_type",
            "measurable_impact",
            "impact_direction",
            "impact_score",
            "impact_score_source",
            "evidence_strength",
            "source_count",
            "source_quality",
            "status",
            "impact_start_date",
            "impact_duration_estimate",
            "black_community_impact_note",
            "tracked_bill",
            "source_snapshot",
        ]
    }


def integrity_checks(cursor) -> dict[str, Any]:
    cursor.execute(
        """
        SELECT COUNT(*) AS total
        FROM policy_outcomes po
        LEFT JOIN tracked_bills tb ON tb.id = po.policy_id
        WHERE po.policy_type = 'legislative'
          AND tb.id IS NULL
        """
    )
    orphan_count = int((cursor.fetchone() or {}).get("total") or 0)
    cursor.execute(
        """
        SELECT policy_type, policy_id, outcome_summary_hash, COUNT(*) AS duplicate_count
        FROM policy_outcomes
        WHERE policy_type = 'legislative'
        GROUP BY policy_type, policy_id, outcome_summary_hash
        HAVING COUNT(*) > 1
        LIMIT 20
        """
    )
    duplicates = [
        {
            "policy_type": row.get("policy_type"),
            "policy_id": int(row.get("policy_id") or 0),
            "outcome_summary_hash": row.get("outcome_summary_hash"),
            "duplicate_count": int(row.get("duplicate_count") or 0),
        }
        for row in list(cursor.fetchall() or [])
    ]
    cursor.execute(
        """
        SELECT COUNT(*) AS total
        FROM policy_outcomes
        WHERE policy_type = 'legislative'
          AND impact_start_date IS NOT NULL
          AND impact_end_date IS NOT NULL
          AND impact_end_date < impact_start_date
        """
    )
    invalid_date_ranges = int((cursor.fetchone() or {}).get("total") or 0)
    cursor.execute(
        """
        SELECT COUNT(*) AS total
        FROM policy_outcomes
        WHERE policy_type = 'legislative'
          AND outcome_summary IS NOT NULL
          AND impact_direction IS NOT NULL
          AND source_count > 0
        """
    )
    scoring_ready_count = int((cursor.fetchone() or {}).get("total") or 0)
    cursor.execute(
        """
        SELECT COUNT(*) AS total
        FROM policy_outcomes
        WHERE policy_type = 'legislative'
          AND (
            impact_score IS NULL
            OR impact_score < -100
            OR impact_score > 100
            OR impact_direction NOT IN ('Positive', 'Negative', 'Mixed', 'Blocked')
            OR source_count < 0
            OR policy_type NOT IN ('current_admin', 'legislative', 'judicial_impact')
          )
        """
    )
    validation_error_count = int((cursor.fetchone() or {}).get("total") or 0)
    return {
        "legislative_policy_id_orphans": orphan_count,
        "duplicate_legislative_outcome_groups": duplicates,
        "invalid_legislative_date_ranges": invalid_date_ranges,
        "legislative_scoring_ready_outcomes": scoring_ready_count,
        "post_workflow_validation": {
            "ok": validation_error_count == 0 and orphan_count == 0 and invalid_date_ranges == 0 and not duplicates,
            "invalid_legislative_policy_outcome_count": validation_error_count,
            "checks": [
                "impact_score_present_and_bounded",
                "impact_direction_valid",
                "source_count_non_negative",
                "policy_type_valid",
                "no_duplicate_legislative_outcomes",
                "no_legislative_policy_id_orphans",
                "valid_legislative_date_ranges",
            ],
        },
    }


def build_report(args: argparse.Namespace) -> dict[str, Any]:
    require_apply_confirmation(args.apply, args.yes)
    if args.limit is not None and args.limit < 1:
        raise SystemExit("--limit must be >= 1")

    generated_at = utc_timestamp()
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            bills = fetch_tracked_bills(cursor, args)
            action_map = fetch_actions(cursor, [int(row["id"]) for row in bills])
            eligible: list[dict[str, Any]] = []
            inserted: list[dict[str, Any]] = []
            source_metadata_updates: list[dict[str, Any]] = []
            skipped_missing: list[dict[str, Any]] = []
            skipped_duplicates: list[dict[str, Any]] = []
            status_counts: Counter[str] = Counter()

            for row in bills:
                actions = action_map.get(int(row["id"]), [])
                payload, reason = build_payload(row, actions, args)
                status_counts[normalize_bill_status(row.get("bill_status")) or "unknown"] += 1
                if payload is None:
                    skipped_missing.append({**sanitize_bill(row), "reason": reason})
                    continue
                existing, duplicate_reason = find_existing_policy_outcome(cursor, payload)
                if existing:
                    if args.apply:
                        metadata_update = sync_existing_source_metadata(cursor, existing, payload)
                        if metadata_update:
                            source_metadata_updates.append(metadata_update)
                    skipped_duplicates.append(
                        {
                            **sanitize_payload(payload),
                            "existing_policy_outcome_id": int(existing["id"]),
                            "reason": duplicate_reason or "existing_legislative_policy_outcome_preserved",
                        }
                    )
                    continue
                eligible.append(payload)
                if args.apply:
                    inserted_id = insert_policy_outcome(cursor, payload)
                    inserted.append({**sanitize_payload(payload), "policy_outcome_id": inserted_id})

            checks = integrity_checks(cursor)
            if args.apply:
                if not checks["post_workflow_validation"]["ok"]:
                    connection.rollback()
                    raise RuntimeError(f"post-workflow validation failed: {checks['post_workflow_validation']}")
                connection.commit()
            else:
                connection.rollback()

            return {
                "workflow": "legislative_policy_outcomes_materialization",
                "mode": "apply" if args.apply else "dry_run",
                "generated_at": generated_at,
                "scope": {
                    "source_tables": ["tracked_bills", "tracked_bill_actions", "future_bill_links"],
                    "target_table": "policy_outcomes",
                    "policy_type": POLICY_TYPE,
                    "mutation_policy": "insert_only_for_new_outcomes; existing legislative source metadata may be refreshed only when the official source signal is stronger",
                    "source_linkage_note": (
                        "policy_outcomes has source_count/source_quality metadata but no legislative source junction. "
                        "This workflow uses official bill/action URLs as a source signal and stores source counts, not source rows."
                    ),
                    "impact_claim_guardrail": (
                        "Non-enacted tracked bills are materialized as neutral Blocked procedural outcomes. "
                        "Positive outcomes require explicit enacted/signed/public-law status text."
                    ),
                },
                "summary": {
                    "tracked_bills_evaluated": len(bills),
                    "rows_eligible_to_insert": len(eligible),
                    "rows_skipped_as_duplicates": len(skipped_duplicates),
                    "rows_skipped_missing_required_fields": len(skipped_missing),
                    "rows_inserted": len(inserted),
                    "source_metadata_rows_updated": len(source_metadata_updates),
                    "eligible_scoring_ready_count": sum(
                        1
                        for payload in eligible
                        if payload["outcome_summary"] and payload["impact_direction"] and payload["source_count"] > 0
                    ),
                    "status_counts": dict(status_counts),
                },
                "sample_inserted_mappings": [sanitize_payload(payload) for payload in eligible[:20]],
                "inserted_rows": inserted,
                "source_metadata_updates": source_metadata_updates,
                "skipped_duplicates": skipped_duplicates[:100],
                "skipped_missing_required_fields": skipped_missing[:100],
                "integrity_checks": checks,
            }
    finally:
        connection.close()


def main() -> None:
    args = parse_args()
    output_path = (args.output or default_output_path(args.apply)).resolve()
    report = build_report(args)
    write_json_file(output_path, report)
    print_json({"ok": True, "output": str(output_path), **report["summary"], "integrity_checks": report["integrity_checks"]})


if __name__ == "__main__":
    main()
