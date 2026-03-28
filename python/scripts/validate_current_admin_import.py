#!/usr/bin/env python3
import argparse
from pathlib import Path

from current_admin_common import (
    derive_csv_path,
    get_db_connection,
    load_json_file,
    normalize_nullable_text,
    print_json,
    read_batch_payload,
    resolve_default_report_path,
    write_csv_rows,
    write_json_file,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate current-administration Promise Tracker records after import."
    )
    parser.add_argument("--input", type=Path, required=True, help="Normalized batch JSON or manual review queue JSON")
    parser.add_argument("--output", type=Path, help="Validation report JSON output")
    parser.add_argument(
        "--csv",
        nargs="?",
        const="",
        help="Optionally write a CSV summary. Pass a path or omit the value to derive one from --output.",
    )
    return parser.parse_args()


def load_records(path: Path) -> dict:
    payload = load_json_file(path)
    if not isinstance(payload, dict):
        raise ValueError("Validation input must be a JSON object")
    if "records" in payload:
        records = payload.get("records") or []
    else:
        records = [
            item.get("final_record")
            for item in payload.get("items") or []
            if isinstance(item.get("final_record"), dict) and (item.get("approved") or item.get("operator_status") == "approved")
        ]
        payload = {
            "batch_name": payload.get("batch_name"),
            "president_slug": payload.get("president_slug"),
            "records": records,
        }
    return payload


def main() -> None:
    args = parse_args()
    payload = load_records(args.input)
    output_path = args.output or resolve_default_report_path(payload["batch_name"], "import-validation")
    slugs = [record.get("slug") for record in payload.get("records") or [] if record.get("slug")]

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            if not slugs:
                report = {
                    "batch_name": payload.get("batch_name"),
                    "validated_count": 0,
                    "records": [],
                    "score_summary": {},
                    "issues": [],
                }
            else:
                placeholders = ", ".join(["%s"] * len(slugs))
                cursor.execute(
                    f"""
                    SELECT
                      p.id,
                      p.slug,
                      p.title,
                      p.status,
                      p.topic,
                      pr.slug AS president_slug,
                      COUNT(DISTINCT pa.id) AS action_count,
                      COUNT(DISTINCT po.id) AS outcome_count,
                      COUNT(DISTINCT ps.source_id) AS promise_source_count
                    FROM promises p
                    JOIN presidents pr ON pr.id = p.president_id
                    LEFT JOIN promise_actions pa ON pa.promise_id = p.id
                    LEFT JOIN promise_outcomes po ON po.promise_id = p.id
                    LEFT JOIN promise_sources ps ON ps.promise_id = p.id
                    WHERE p.slug IN ({placeholders})
                    GROUP BY p.id, p.slug, p.title, p.status, p.topic, pr.slug
                    ORDER BY p.id ASC
                    """,
                    slugs,
                )
                records = cursor.fetchall()

                cursor.execute(
                    f"""
                    SELECT
                      po.impact_direction,
                      COUNT(*) AS outcome_count
                    FROM promise_outcomes po
                    JOIN promises p ON p.id = po.promise_id
                    WHERE p.slug IN ({placeholders})
                    GROUP BY po.impact_direction
                    ORDER BY po.impact_direction ASC
                    """,
                    slugs,
                )
                score_rows = cursor.fetchall()

                issues = []
                for row in records:
                    if int(row["action_count"] or 0) < 1:
                        issues.append({"slug": row["slug"], "issue": "missing_action"})
                    if int(row["outcome_count"] or 0) < 1:
                        issues.append({"slug": row["slug"], "issue": "missing_outcome"})
                    if int(row["promise_source_count"] or 0) < 1:
                        issues.append({"slug": row["slug"], "issue": "missing_promise_source"})

                report = {
                    "batch_name": payload.get("batch_name"),
                    "validated_count": len(records),
                    "records": [
                        {
                            "id": int(row["id"]),
                            "slug": row["slug"],
                            "title": row["title"],
                            "status": row["status"],
                            "topic": row["topic"],
                            "president_slug": row["president_slug"],
                            "action_count": int(row["action_count"] or 0),
                            "outcome_count": int(row["outcome_count"] or 0),
                            "promise_source_count": int(row["promise_source_count"] or 0),
                        }
                        for row in records
                    ],
                    "score_summary": {
                        normalize_nullable_text(row["impact_direction"]) or "Unknown": int(row["outcome_count"] or 0)
                        for row in score_rows
                    },
                    "issues": issues,
                }

        write_json_file(output_path, report)
        csv_path = derive_csv_path(args.csv, output_path)
        if csv_path:
            write_csv_rows(csv_path, report.get("records") or [])
        print_json(report)
    finally:
        connection.close()


if __name__ == "__main__":
    main()
