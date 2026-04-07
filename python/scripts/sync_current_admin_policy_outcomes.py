#!/usr/bin/env python3
import argparse
import hashlib
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


POLICY_TYPE = "current_admin"
VALID_IMPACT_DIRECTIONS = {"Positive", "Negative", "Mixed", "Blocked"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Dry-run or apply an additive sync from promise_outcomes into unified policy_outcomes."
    )
    parser.add_argument("--output", type=Path, help="Sync report JSON path")
    parser.add_argument("--apply", action="store_true", help="Insert eligible missing policy_outcomes rows")
    parser.add_argument("--yes", action="store_true", help="Required confirmation for --apply")
    parser.add_argument("--limit", type=int, help="Limit candidate promise_outcomes rows")
    parser.add_argument("--only-outcome-id", type=int, action="append", help="Sync one or more promise_outcomes.id values")
    return parser.parse_args()


def default_output_path(apply: bool) -> Path:
    suffix = "apply" if apply else "dry-run"
    return get_reports_dir() / f"current-admin-policy-outcomes-sync.{suffix}.json"


def outcome_summary_hash(summary: Any) -> str:
    return hashlib.sha256((normalize_nullable_text(summary) or "").encode("utf-8")).hexdigest()


def normalize_impact_direction(value: Any) -> str | None:
    text = normalize_nullable_text(value)
    if text is None:
        return None
    for direction in VALID_IMPACT_DIRECTIONS:
        if text.lower() == direction.lower():
            return direction
    return None


def normalize_evidence_strength(value: Any) -> str | None:
    text = normalize_nullable_text(value)
    if text is None:
        return None
    normalized = text.lower().replace(" ", "_").replace("-", "_")
    mapping = {
        "strong": "Strong",
        "high": "Strong",
        "moderate": "Moderate",
        "medium": "Moderate",
        "weak": "Weak",
        "limited": "Weak",
        "low": "Weak",
    }
    return mapping.get(normalized)


def source_quality_from_evidence(value: Any, source_count: int) -> str | None:
    evidence = normalize_evidence_strength(value)
    if evidence == "Strong":
        return "high"
    if evidence == "Moderate":
        return "medium"
    if evidence == "Weak":
        return "low"
    if source_count >= 2:
        return "high"
    if source_count == 1:
        return "medium"
    return None


def normalize_status(value: Any) -> str | None:
    text = normalize_nullable_text(value)
    if text is None:
        return None
    normalized = text.lower().replace("_", " ")
    if normalized in {"complete", "completed", "delivered"}:
        return "Complete"
    if normalized in {"in progress", "in-progress"}:
        return "In Progress"
    if normalized == "partial":
        return "Partial"
    return text


def ensure_policy_outcomes_table_exists(cursor) -> None:
    cursor.execute("SHOW TABLES LIKE 'policy_outcomes'")
    if cursor.fetchone() is None:
        raise RuntimeError("policy_outcomes table is missing. Apply the schema before syncing unified outcomes.")


def fetch_candidate_outcomes(cursor, only_ids: list[int] | None, limit: int | None) -> list[dict[str, Any]]:
    params: list[Any] = []
    filters = []
    if only_ids:
        placeholders = ", ".join(["%s"] * len(only_ids))
        filters.append(f"po.id IN ({placeholders})")
        params.extend(only_ids)
    where = f"WHERE {' AND '.join(filters)}" if filters else ""
    sql = f"""
        SELECT
          po.id AS promise_outcome_id,
          po.promise_id,
          po.outcome_summary,
          po.outcome_type,
          po.measurable_impact,
          po.impact_direction,
          po.evidence_strength,
          po.status_override,
          po.black_community_impact_note,
          p.slug AS promise_slug,
          p.title AS promise_title,
          p.status AS promise_status,
          (
            SELECT COUNT(DISTINCT pos.source_id)
            FROM promise_outcome_sources pos
            WHERE pos.promise_outcome_id = po.id
          ) AS source_count
        FROM promise_outcomes po
        JOIN promises p ON p.id = po.promise_id
        {where}
        ORDER BY p.id ASC, po.id ASC
    """
    if limit is not None and limit > 0:
        sql += "\nLIMIT %s"
        params.append(limit)
    cursor.execute(sql, params)
    return list(cursor.fetchall() or [])


def build_payload(row: dict[str, Any]) -> tuple[dict[str, Any] | None, str | None]:
    summary = normalize_nullable_text(row.get("outcome_summary"))
    if summary is None:
        return None, "missing_outcome_summary"

    impact_direction = normalize_impact_direction(row.get("impact_direction"))
    if impact_direction is None:
        return None, "missing_or_invalid_impact_direction"

    promise_id = row.get("promise_id")
    if promise_id is None:
        return None, "missing_promise_id"

    source_count = int(row.get("source_count") or 0)
    evidence_strength = normalize_evidence_strength(row.get("evidence_strength"))
    return {
        "policy_type": POLICY_TYPE,
        "policy_id": int(promise_id),
        "record_key": normalize_nullable_text(row.get("promise_slug")) or f"promise:{promise_id}",
        "outcome_summary": summary,
        "outcome_summary_hash": outcome_summary_hash(summary),
        "outcome_type": normalize_nullable_text(row.get("outcome_type")),
        "measurable_impact": normalize_nullable_text(row.get("measurable_impact")),
        "impact_direction": impact_direction,
        "evidence_strength": evidence_strength,
        "confidence_score": None,
        "source_count": source_count,
        "source_quality": source_quality_from_evidence(row.get("evidence_strength"), source_count),
        "status": normalize_status(row.get("status_override") or row.get("promise_status")),
        "black_community_impact_note": normalize_nullable_text(row.get("black_community_impact_note")),
        "source_promise_outcome_id": int(row["promise_outcome_id"]),
        "promise_slug": normalize_nullable_text(row.get("promise_slug")),
        "promise_title": normalize_nullable_text(row.get("promise_title")),
    }, None


def find_existing_policy_outcome(cursor, payload: dict[str, Any]) -> dict[str, Any] | None:
    cursor.execute(
        """
        SELECT *
        FROM policy_outcomes
        WHERE policy_type = %s
          AND policy_id = %s
          AND outcome_summary_hash = %s
        ORDER BY id ASC
        """,
        (payload["policy_type"], payload["policy_id"], payload["outcome_summary_hash"]),
    )
    for row in cursor.fetchall() or []:
        if normalize_nullable_text(row.get("outcome_summary")) == payload["outcome_summary"]:
            return row
    return None


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
          evidence_strength,
          confidence_score,
          source_count,
          source_quality,
          status,
          black_community_impact_note
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
            payload["evidence_strength"],
            payload["confidence_score"],
            payload["source_count"],
            payload["source_quality"],
            payload["status"],
            payload["black_community_impact_note"],
        ),
    )
    return int(cursor.lastrowid)


def sanitize_mapping(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "source_promise_outcome_id": payload["source_promise_outcome_id"],
        "policy_type": payload["policy_type"],
        "policy_id": payload["policy_id"],
        "record_key": payload["record_key"],
        "promise_title": payload["promise_title"],
        "outcome_summary": payload["outcome_summary"],
        "impact_direction": payload["impact_direction"],
        "evidence_strength": payload["evidence_strength"],
        "source_count": payload["source_count"],
        "source_quality": payload["source_quality"],
        "status": payload["status"],
    }


def integrity_checks(cursor) -> dict[str, Any]:
    cursor.execute(
        """
        SELECT COUNT(*) AS total
        FROM policy_outcomes po
        LEFT JOIN promises p ON p.id = po.policy_id
        WHERE po.policy_type = 'current_admin'
          AND p.id IS NULL
        """
    )
    orphan_count = int((cursor.fetchone() or {}).get("total") or 0)

    cursor.execute(
        """
        SELECT COUNT(*) AS total
        FROM policy_outcomes po
        JOIN promise_outcomes src
          ON src.promise_id = po.policy_id
         AND SHA2(TRIM(src.outcome_summary), 256) = po.outcome_summary_hash
        LEFT JOIN (
          SELECT promise_outcome_id, COUNT(DISTINCT source_id) AS source_count
          FROM promise_outcome_sources
          GROUP BY promise_outcome_id
        ) src_counts ON src_counts.promise_outcome_id = src.id
        WHERE po.policy_type = 'current_admin'
          AND po.source_count <> COALESCE(src_counts.source_count, 0)
        """
    )
    source_count_mismatch_count = int((cursor.fetchone() or {}).get("total") or 0)

    cursor.execute(
        """
        SELECT policy_type, policy_id, outcome_summary_hash, COUNT(*) AS duplicate_count
        FROM policy_outcomes
        WHERE policy_type = 'current_admin'
        GROUP BY policy_type, policy_id, outcome_summary_hash
        HAVING COUNT(*) > 1
        LIMIT 20
        """
    )
    duplicates = list(cursor.fetchall() or [])

    return {
        "current_admin_policy_id_orphans": orphan_count,
        "current_admin_source_count_mismatches": source_count_mismatch_count,
        "duplicate_unified_outcome_groups": [
            {
                "policy_type": row.get("policy_type"),
                "policy_id": int(row.get("policy_id") or 0),
                "outcome_summary_hash": row.get("outcome_summary_hash"),
                "duplicate_count": int(row.get("duplicate_count") or 0),
            }
            for row in duplicates
        ],
    }


def build_report(args: argparse.Namespace) -> dict[str, Any]:
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            ensure_policy_outcomes_table_exists(cursor)
            rows = fetch_candidate_outcomes(cursor, args.only_outcome_id, args.limit)
            eligible = []
            skipped_missing = []
            skipped_duplicates = []
            inserted = []

            for row in rows:
                payload, missing_reason = build_payload(row)
                if payload is None:
                    skipped_missing.append(
                        {
                            "promise_outcome_id": int(row["promise_outcome_id"]),
                            "promise_id": int(row["promise_id"]) if row.get("promise_id") is not None else None,
                            "reason": missing_reason,
                        }
                    )
                    continue

                existing = find_existing_policy_outcome(cursor, payload)
                if existing:
                    skipped_duplicates.append(
                        {
                            **sanitize_mapping(payload),
                            "existing_policy_outcome_id": int(existing["id"]),
                            "reason": "existing_unified_policy_outcome_preserved",
                        }
                    )
                    continue

                eligible.append(payload)
                if args.apply:
                    inserted_id = insert_policy_outcome(cursor, payload)
                    inserted.append({**sanitize_mapping(payload), "policy_outcome_id": inserted_id})

            if args.apply:
                connection.commit()
            else:
                connection.rollback()

            checks = integrity_checks(cursor)
            return {
                "workflow": "current_admin_policy_outcomes_sync",
                "mode": "apply" if args.apply else "dry_run",
                "generated_at": utc_timestamp(),
                "scope": {
                    "source_tables": ["promise_outcomes", "promise_outcome_sources", "promises"],
                    "target_table": "policy_outcomes",
                    "policy_type": POLICY_TYPE,
                    "mutation_policy": "insert_only_when_apply_yes_is_explicit",
                },
                "summary": {
                    "total_candidate_outcomes": len(rows),
                    "rows_eligible_to_insert": len(eligible),
                    "rows_skipped_as_duplicates": len(skipped_duplicates),
                    "rows_skipped_missing_required_fields": len(skipped_missing),
                    "linked_source_count_zero": sum(1 for payload in eligible if payload["source_count"] == 0),
                    "rows_inserted": len(inserted),
                },
                "sample_inserted_mappings": [sanitize_mapping(payload) for payload in eligible[:10]],
                "inserted_rows": inserted,
                "skipped_duplicates": skipped_duplicates[:50],
                "skipped_missing_required_fields": skipped_missing[:50],
                "integrity_checks": checks,
            }
    finally:
        connection.close()


def main() -> None:
    args = parse_args()
    require_apply_confirmation(args.apply, args.yes)
    output_path = (args.output or default_output_path(args.apply)).resolve()
    report = build_report(args)
    write_json_file(output_path, report)
    print_json(
        {
            "ok": True,
            "mode": report["mode"],
            "output": str(output_path),
            **report["summary"],
            "integrity_checks": report["integrity_checks"],
        }
    )


if __name__ == "__main__":
    main()
