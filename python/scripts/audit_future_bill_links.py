#!/usr/bin/env python3
import json
import re
import sys
from pathlib import Path
from typing import Any

import pymysql


STOPWORDS = {
    "a",
    "act",
    "acts",
    "address",
    "african",
    "americans",
    "and",
    "bill",
    "black",
    "commission",
    "develop",
    "equity",
    "for",
    "in",
    "of",
    "on",
    "or",
    "program",
    "proposals",
    "provide",
    "reform",
    "restore",
    "restoration",
    "study",
    "the",
    "to",
    "toward",
    "united",
    "would",
}


def load_env_file(env_path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    if not env_path.exists():
        return env

    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def get_db_connection():
    project_root = Path(__file__).resolve().parents[2]
    env_values = load_env_file(project_root / ".env.local")

    return pymysql.connect(
        host=env_values.get("DB_HOST", "127.0.0.1"),
        port=int(env_values.get("DB_PORT", "3306")),
        user=env_values.get("DB_USER", "root"),
        password=env_values.get("DB_PASSWORD", ""),
        database=env_values.get("DB_NAME", "black_policy_tracker"),
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False,
    )


def normalize_text(text: str | None) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", (text or "").lower())).strip()


def tokenize(text: str | None) -> list[str]:
    return [
        token
        for token in normalize_text(text).split()
        if token and token not in STOPWORDS and len(token) > 2
    ]


def keyword_set(*parts: str | None) -> set[str]:
    tokens: set[str] = set()
    for part in parts:
        tokens.update(tokenize(part))
    return tokens


def keyword_overlap_score(left: set[str], right: set[str]) -> float:
    if not left or not right:
        return 0.0

    intersection = left & right
    union = left | right
    return len(intersection) / len(union)


def contains_phrase(left: str | None, right: str | None) -> bool:
    normalized_left = normalize_text(left)
    normalized_right = normalize_text(right)
    return bool(normalized_left and normalized_right and normalized_left in normalized_right)


def risk_level(score: float, shared_keywords: set[str], future_title: str, tracked_title: str) -> str:
    if contains_phrase(future_title, tracked_title) or contains_phrase(tracked_title, future_title):
        return "low"
    if score >= 0.35 or len(shared_keywords) >= 3:
        return "low"
    if score >= 0.16 or len(shared_keywords) >= 2:
        return "medium"
    return "high"


def fetch_link_rows(cursor) -> list[dict[str, Any]]:
    cursor.execute(
        """
        SELECT
          fbl.id AS future_bill_link_id,
          fbl.link_type,
          fbl.notes AS link_notes,
          fb.id AS future_bill_id,
          fb.title AS future_bill_title,
          fb.target_area,
          fb.problem_statement,
          fb.proposed_solution,
          tb.id AS tracked_bill_id,
          tb.bill_number,
          tb.title AS tracked_bill_title,
          tb.official_summary,
          tb.bill_status,
          tb.latest_action_date,
          tb.source_system,
          tb.match_confidence
        FROM future_bill_links fbl
        JOIN future_bills fb
          ON fb.id = fbl.future_bill_id
        JOIN tracked_bills tb
          ON tb.id = fbl.tracked_bill_id
        ORDER BY fb.id ASC, tb.bill_number ASC
        """
    )
    return cursor.fetchall()


def audit_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    audited: list[dict[str, Any]] = []

    for row in rows:
        future_keywords = keyword_set(
            row["future_bill_title"],
            row.get("target_area"),
            row.get("problem_statement"),
            row.get("proposed_solution"),
        )
        tracked_keywords = keyword_set(
            row["tracked_bill_title"],
            row.get("official_summary"),
        )
        shared_keywords = future_keywords & tracked_keywords
        score = keyword_overlap_score(future_keywords, tracked_keywords)
        risk = risk_level(
            score,
            shared_keywords,
            row["future_bill_title"],
            row["tracked_bill_title"],
        )

        audited.append(
            {
                **row,
                "match_score": round(score, 3),
                "shared_keywords": sorted(shared_keywords),
                "future_keywords": sorted(future_keywords),
                "tracked_keywords": sorted(tracked_keywords),
                "risk_level": risk,
            }
        )

    return audited


def print_report(audited_rows: list[dict[str, Any]]) -> None:
    high = [row for row in audited_rows if row["risk_level"] == "high"]
    medium = [row for row in audited_rows if row["risk_level"] == "medium"]
    low = [row for row in audited_rows if row["risk_level"] == "low"]

    print("Future Bill Link Audit")
    print(f"Total links: {len(audited_rows)}")
    print(f"High risk: {len(high)}")
    print(f"Medium risk: {len(medium)}")
    print(f"Low risk: {len(low)}")

    if not high and not medium:
        print("\nNo suspicious links found.")
        return

    print("\nReview queue:")
    for row in [*high, *medium]:
        print(
            f"\n[{row['risk_level'].upper()}] future_bill_id={row['future_bill_id']} "
            f"tracked_bill_id={row['tracked_bill_id']} score={row['match_score']}"
        )
        print(f"  Future Bill: {row['future_bill_title']}")
        print(f"  Tracked Bill: {row['bill_number']} - {row['tracked_bill_title']}")
        print(f"  Shared Keywords: {', '.join(row['shared_keywords']) or 'none'}")
        print(f"  Status: {row['bill_status']} | Source: {row['source_system']}")


def write_json_report(path: Path, audited_rows: list[dict[str, Any]]) -> None:
    payload = {
        "total_links": len(audited_rows),
        "high_risk": [row for row in audited_rows if row["risk_level"] == "high"],
        "medium_risk": [row for row in audited_rows if row["risk_level"] == "medium"],
        "low_risk": [row for row in audited_rows if row["risk_level"] == "low"],
    }
    path.write_text(json.dumps(payload, indent=2, default=str))


def run_audit(output_path: Path | None = None) -> list[dict[str, Any]]:
    conn = get_db_connection()

    try:
        with conn.cursor() as cursor:
            rows = fetch_link_rows(cursor)
            audited_rows = audit_rows(rows)
    finally:
        conn.close()

    if output_path:
        write_json_report(output_path, audited_rows)

    return audited_rows


def main():
    output_path: Path | None = None

    if len(sys.argv) > 2:
        print(
            "Usage: python3 scripts/audit_future_bill_links.py [output.json]",
            file=sys.stderr,
        )
        sys.exit(1)

    if len(sys.argv) == 2:
        output_path = Path(sys.argv[1]).resolve()

    audited_rows = run_audit(output_path)
    print_report(audited_rows)

    if output_path:
        print(f"\nWrote JSON report to {output_path}")


if __name__ == "__main__":
    main()
