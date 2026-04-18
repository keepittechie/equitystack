#!/usr/bin/env python3
import argparse
import csv
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


EVIDENCE_SCORE = {
    "Strong": 30,
    "Moderate": 20,
    "Weak": 10,
}
IMPACT_DIRECTION_SCORE = {
    "Negative": 50,
    "Positive": 50,
    "Mixed": 30,
    "Blocked": 25,
}
STATUS_SCORE = {
    "Complete": 15,
    "Delivered": 15,
    "Failed": 12,
    "Partial": 10,
    "Blocked": 8,
    "In Progress": 5,
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Read-only audit of policy_outcomes rows missing source linkage."
    )
    parser.add_argument("--output", type=Path, help="Operator-ready source-gap report JSON path")
    parser.add_argument("--csv-output", type=Path, help="Optional CSV export for the top-priority rows")
    parser.add_argument("--limit", type=int, default=50, help="Maximum top-priority rows to include")
    parser.add_argument(
        "--policy-type",
        choices=["current_admin", "legislative", "judicial_impact"],
        help="Limit report to one policy_outcomes.policy_type",
    )
    return parser.parse_args()


def default_output_path() -> Path:
    return get_reports_dir() / "policy-outcome-source-gaps-report.json"


def table_exists(cursor, table_name: str) -> bool:
    cursor.execute("SHOW TABLES LIKE %s", (table_name,))
    return cursor.fetchone() is not None


def derived_impact_score(row: dict[str, Any]) -> int:
    score = 0
    score += IMPACT_DIRECTION_SCORE.get(str(row.get("impact_direction") or ""), 0)
    score += EVIDENCE_SCORE.get(str(row.get("evidence_strength") or ""), 0)
    score += STATUS_SCORE.get(str(row.get("status") or ""), 0)
    if normalize_nullable_text(row.get("measurable_impact")):
        score += 3
    if normalize_nullable_text(row.get("black_community_impact_note")):
        score += 2
    return score


def priority_rationale(row: dict[str, Any], score: int) -> str:
    return (
        f"Derived source-curation priority score {score}: "
        f"impact_direction={row.get('impact_direction') or 'unknown'}, "
        f"evidence_strength={row.get('evidence_strength') or 'unknown'}, "
        f"status={row.get('status') or 'unknown'}, "
        f"measurable_impact={'present' if row.get('measurable_impact') else 'missing'}, "
        f"black_community_impact_note={'present' if row.get('black_community_impact_note') else 'missing'}."
    )


def fetch_missing_source_outcomes(cursor, policy_type: str | None) -> list[dict[str, Any]]:
    params: list[Any] = []
    filters = [
        """
        NOT EXISTS (
          SELECT 1
          FROM policy_outcome_sources pos
          WHERE pos.policy_outcome_id = po.id
        )
        """
    ]
    if policy_type:
        filters.append("po.policy_type = %s")
        params.append(policy_type)
    cursor.execute(
        f"""
        SELECT
          po.id AS policy_outcome_id,
          po.policy_type,
          po.policy_id,
          po.record_key,
          po.outcome_summary,
          po.outcome_type,
          po.measurable_impact,
          po.impact_direction,
          po.evidence_strength,
          po.confidence_score,
          po.source_count,
          po.source_quality,
          po.status,
          po.impact_start_date,
          po.impact_duration_estimate,
          po.black_community_impact_note,
          CASE
            WHEN po.policy_type = 'current_admin' THEN p.title
            WHEN po.policy_type = 'legislative' THEN tb.title
            ELSE NULL
          END AS policy_title,
          CASE
            WHEN po.policy_type = 'current_admin' THEN p.slug
            WHEN po.policy_type = 'legislative' THEN tb.bill_number
            ELSE po.record_key
          END AS policy_reference,
          pr.full_name AS current_admin_president,
          tb.bill_number,
          tb.bill_status,
          tb.bill_url,
          tb.latest_action_date
        FROM policy_outcomes po
        LEFT JOIN promises p
          ON po.policy_type = 'current_admin'
         AND p.id = po.policy_id
        LEFT JOIN presidents pr ON pr.id = p.president_id
        LEFT JOIN tracked_bills tb
          ON po.policy_type = 'legislative'
         AND tb.id = po.policy_id
        WHERE {" AND ".join(filters)}
        """,
        params,
    )
    rows = []
    for row in list(cursor.fetchall() or []):
        score = derived_impact_score(row)
        rows.append(
            {
                "policy_outcome_id": int(row["policy_outcome_id"]),
                "policy_type": row.get("policy_type"),
                "policy_id": int(row["policy_id"]),
                "policy_title": row.get("policy_title"),
                "policy_reference": row.get("policy_reference"),
                "outcome_summary": row.get("outcome_summary"),
                "impact_direction": row.get("impact_direction"),
                "impact_score": score,
                "impact_score_kind": "derived_source_curation_priority",
                "evidence_strength": row.get("evidence_strength"),
                "status": row.get("status"),
                "source_count": int(row.get("source_count") or 0),
                "source_quality": row.get("source_quality"),
                "confidence_score": float(row["confidence_score"]) if row.get("confidence_score") is not None else None,
                "impact_start_date": str(row["impact_start_date"]) if row.get("impact_start_date") else None,
                "impact_duration_estimate": row.get("impact_duration_estimate"),
                "policy_context": {
                    "record_key": row.get("record_key"),
                    "policy_reference": row.get("policy_reference"),
                    "current_admin_president": row.get("current_admin_president"),
                    "bill_number": row.get("bill_number"),
                    "bill_status": row.get("bill_status"),
                    "bill_url": row.get("bill_url"),
                    "latest_action_date": str(row["latest_action_date"]) if row.get("latest_action_date") else None,
                },
                "curation_hint": priority_rationale(row, score),
            }
        )
    return sorted(
        rows,
        key=lambda item: (
            -int(item["impact_score"]),
            str(item.get("policy_type") or ""),
            int(item["policy_outcome_id"]),
        ),
    )


def summarize_by_policy_type(rows: list[dict[str, Any]]) -> dict[str, Any]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        grouped[str(row.get("policy_type") or "unknown")].append(row)
    return {
        policy_type: {
            "missing_source_outcome_count": len(items),
            "impact_direction_counts": dict(Counter(item.get("impact_direction") or "unknown" for item in items)),
            "top_missing_source_outcomes": items[:10],
        }
        for policy_type, items in sorted(grouped.items())
    }


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "rank",
        "policy_type",
        "impact_score",
        "policy_outcome_id",
        "policy_id",
        "policy_title",
        "outcome_summary",
        "impact_direction",
        "evidence_strength",
        "status",
        "impact_start_date",
        "policy_reference",
    ]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for index, row in enumerate(rows, start=1):
            writer.writerow({field: row.get(field) for field in fieldnames if field != "rank"} | {"rank": index})


def build_report(args: argparse.Namespace) -> dict[str, Any]:
    if args.limit is not None and args.limit < 1:
        raise SystemExit("--limit must be >= 1")
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            if not table_exists(cursor, "policy_outcomes"):
                raise RuntimeError("policy_outcomes table does not exist")
            rows = fetch_missing_source_outcomes(cursor, args.policy_type)
    limit = int(args.limit or 50)
    top_rows = rows[:limit]
    return {
        "workflow": "policy_outcome_source_gap_audit",
        "generated_at": utc_timestamp(),
        "mode": "read_only",
        "summary": {
            "missing_source_outcome_count": len(rows),
            "top_rows_returned": len(top_rows),
            "policy_type_counts": dict(Counter(row["policy_type"] for row in rows)),
            "impact_score_kind": "derived_source_curation_priority",
            "impact_score_formula": {
                "impact_direction": IMPACT_DIRECTION_SCORE,
                "evidence_strength": EVIDENCE_SCORE,
                "status": STATUS_SCORE,
                "measurable_impact_present": 3,
                "black_community_impact_note_present": 2,
            },
            "database_mutated": False,
        },
        "grouped_by_policy_type": summarize_by_policy_type(rows),
        "top_missing_source_outcomes": top_rows,
        "operator_next_step": "Use impact curate-sources to attach canonical policy_outcome_sources rows for any sampled gaps.",
    }


def main() -> None:
    args = parse_args()
    output_path = (args.output or default_output_path()).resolve()
    report = build_report(args)
    write_json_file(output_path, report)
    if args.csv_output:
        write_csv(args.csv_output.resolve(), report["top_missing_source_outcomes"])
    print_json({"ok": True, "output": str(output_path), **report["summary"]})


if __name__ == "__main__":
    main()
