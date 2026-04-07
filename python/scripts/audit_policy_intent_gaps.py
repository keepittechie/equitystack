#!/usr/bin/env python3
import argparse
import csv
from collections import Counter
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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Read-only operator queue for policies missing policy_intent_category."
    )
    parser.add_argument("--output", type=Path, help="Operator queue JSON path")
    parser.add_argument("--csv-output", type=Path, help="Optional CSV export path")
    parser.add_argument("--limit", type=int, help="Optional maximum queue rows")
    parser.add_argument("--include-archived", action="store_true", help="Include archived policies")
    return parser.parse_args()


def default_output_path() -> Path:
    return get_reports_dir() / "policy-intent-gap-queue.json"


def table_exists(cursor, table_name: str) -> bool:
    cursor.execute("SHOW TABLES LIKE %s", (table_name,))
    return cursor.fetchone() is not None


def get_table_columns(cursor, table_name: str) -> set[str]:
    cursor.execute(f"SHOW COLUMNS FROM {table_name}")
    return {str(row["Field"]) for row in cursor.fetchall() or []}


def ensure_storage(cursor) -> None:
    if not table_exists(cursor, "policies"):
        raise RuntimeError("policies table does not exist")
    columns = get_table_columns(cursor, "policies")
    missing = {"policy_intent_category", "policy_intent_summary"} - columns
    if missing:
        raise RuntimeError(f"policies table is missing intent columns: {', '.join(sorted(missing))}")


def fetch_queue(cursor, args: argparse.Namespace) -> list[dict[str, Any]]:
    filters = ["p.policy_intent_category IS NULL"]
    if not args.include_archived:
        filters.append("COALESCE(p.is_archived, 0) = 0")
    sql = f"""
        SELECT
          p.id AS policy_id,
          p.title,
          p.year_enacted AS year,
          p.outcome_summary,
          p.impact_direction,
          p.status,
          pr.full_name AS president_name,
          er.name AS era_name,
          GROUP_CONCAT(DISTINCT pc.name ORDER BY pc.name SEPARATOR ', ') AS categories,
          (
            (COALESCE(ps.directness_score, 0) * 2)
            + (COALESCE(ps.material_impact_score, 0) * 2)
            + COALESCE(ps.evidence_score, 0)
            + COALESCE(ps.durability_score, 0)
            + (COALESCE(ps.equity_score, 0) * 2)
            - COALESCE(ps.harm_offset_score, 0)
          ) AS impact_score
        FROM policies p
        LEFT JOIN policy_scores ps ON ps.policy_id = p.id
        LEFT JOIN presidents pr ON pr.id = p.president_id
        LEFT JOIN eras er ON er.id = p.era_id
        LEFT JOIN policy_policy_categories ppc ON ppc.policy_id = p.id
        LEFT JOIN policy_categories pc ON pc.id = ppc.category_id
        WHERE {" AND ".join(filters)}
        GROUP BY
          p.id,
          p.title,
          p.year_enacted,
          p.outcome_summary,
          p.impact_direction,
          p.status,
          pr.full_name,
          er.name,
          ps.directness_score,
          ps.material_impact_score,
          ps.evidence_score,
          ps.durability_score,
          ps.equity_score,
          ps.harm_offset_score
        ORDER BY impact_score DESC, p.year_enacted ASC, p.id ASC
    """
    params: list[Any] = []
    if args.limit is not None:
        if args.limit < 1:
            raise SystemExit("--limit must be >= 1")
        sql += "\nLIMIT %s"
        params.append(args.limit)
    cursor.execute(sql, params)
    rows = []
    for index, row in enumerate(list(cursor.fetchall() or []), start=1):
        rows.append(
            {
                "rank": index,
                "policy_id": int(row["policy_id"]),
                "title": row.get("title"),
                "year": int(row["year"]) if row.get("year") is not None else None,
                "outcome_summary": row.get("outcome_summary"),
                "impact_direction": row.get("impact_direction"),
                "impact_score": int(row["impact_score"] or 0),
                "status": row.get("status"),
                "president_name": row.get("president_name"),
                "era_name": row.get("era_name"),
                "categories": row.get("categories"),
                "operator_next_step": (
                    "Use impact curate-policy-intent with this policy_id, a supported source/reference, "
                    "a neutral intent summary, and a category."
                ),
            }
        )
    return rows


def fetch_coverage(cursor, include_archived: bool) -> dict[str, Any]:
    where_clause = "" if include_archived else "WHERE COALESCE(is_archived, 0) = 0"
    cursor.execute(
        f"""
        SELECT
          COUNT(*) AS total_policies,
          SUM(CASE WHEN policy_intent_category IS NULL THEN 1 ELSE 0 END) AS unclassified_policies,
          SUM(CASE WHEN policy_intent_category IS NOT NULL THEN 1 ELSE 0 END) AS classified_policies
        FROM policies
        {where_clause}
        """
    )
    row = cursor.fetchone() or {}
    total = int(row.get("total_policies") or 0)
    classified = int(row.get("classified_policies") or 0)
    unclassified = int(row.get("unclassified_policies") or 0)
    return {
        "total_policies": total,
        "classified_policies": classified,
        "unclassified_policies": unclassified,
        "classified_policy_pct": round(classified / total, 4) if total else 0,
        "unclassified_policy_pct": round(unclassified / total, 4) if total else 0,
    }


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "rank",
        "impact_score",
        "policy_id",
        "title",
        "year",
        "outcome_summary",
        "impact_direction",
        "status",
        "president_name",
        "era_name",
        "categories",
    ]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field) for field in fieldnames})


def build_report(args: argparse.Namespace) -> dict[str, Any]:
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            ensure_storage(cursor)
            queue = fetch_queue(cursor, args)
            coverage = fetch_coverage(cursor, args.include_archived)
    return {
        "workflow": "policy_intent_gap_operator_queue",
        "generated_at": utc_timestamp(),
        "mode": "read_only",
        "summary": {
            "queue_count": len(queue),
            "total_unclassified_policies": coverage["unclassified_policies"],
            "classified_policies": coverage["classified_policies"],
            "total_policies": coverage["total_policies"],
            "classified_policy_pct": coverage["classified_policy_pct"],
            "sort_order": ["impact_score DESC", "year ASC", "policy_id ASC"],
            "impact_direction_counts": dict(Counter(row.get("impact_direction") or "unknown" for row in queue)),
            "database_mutated": False,
        },
        "coverage": coverage,
        "operator_queue": queue,
        "operator_command_template": (
            "./python/bin/equitystack impact curate-policy-intent "
            "--only-policy-id <policy_id> --category <equity_expanding|equity_restricting|neutral_administrative> "
            "--summary \"...\" --source-reference \"...\" --apply --yes"
        ),
    }


def main() -> None:
    args = parse_args()
    output_path = (args.output or default_output_path()).resolve()
    report = build_report(args)
    write_json_file(output_path, report)
    if args.csv_output:
        write_csv(args.csv_output.resolve(), report["operator_queue"])
    print_json({"ok": True, "output": str(output_path), **report["summary"]})


if __name__ == "__main__":
    main()
