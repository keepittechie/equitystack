#!/usr/bin/env python3
import json
import os
import sys
from pathlib import Path
from typing import Any

import pymysql


# -------------------------
# ENV + DB CONNECTION
# -------------------------
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
    env_file = project_root / ".env.local"

    env_values = load_env_file(env_file)

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


# -------------------------
# HELPERS
# -------------------------
def load_json(file_path: Path) -> list[dict[str, Any]]:
    data = json.loads(file_path.read_text())
    if not isinstance(data, list):
        raise ValueError("JSON must be an array")
    return data


def find_policy_id(cursor, title: str, year: int) -> int | None:
    cursor.execute(
        """
        SELECT id
        FROM policies
        WHERE title = %s AND year_enacted = %s
        LIMIT 1
        """,
        (title, year),
    )
    row = cursor.fetchone()
    return int(row["id"]) if row else None


# -------------------------
# DUPLICATE CHECKS
# -------------------------
def source_exists(cursor, policy_id: int, url: str) -> bool:
    cursor.execute(
        """
        SELECT id FROM sources
        WHERE policy_id = %s AND source_url = %s
        LIMIT 1
        """,
        (policy_id, url),
    )
    return cursor.fetchone() is not None


def metric_exists(cursor, policy_id: int, name: str, geography: str | None) -> bool:
    cursor.execute(
        """
        SELECT id FROM metrics
        WHERE policy_id = %s AND metric_name = %s AND IFNULL(geography, '') = IFNULL(%s, '')
        LIMIT 1
        """,
        (policy_id, name, geography),
    )
    return cursor.fetchone() is not None


# -------------------------
# INSERTS
# -------------------------
def insert_sources(cursor, policy_id: int, sources: list[dict[str, Any]]):
    inserted = 0

    for s in sources:
        if source_exists(cursor, policy_id, s["source_url"]):
            print(f"  ↳ SKIP source (duplicate): {s['source_title']}")
            continue

        cursor.execute(
            """
            INSERT INTO sources (
                policy_id,
                source_title,
                source_url,
                source_type,
                publisher,
                published_date,
                notes
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                policy_id,
                s["source_title"],
                s["source_url"],
                s.get("source_type"),
                s.get("publisher"),
                s.get("published_date"),
                s.get("notes"),
            ),
        )
        inserted += 1

    return inserted


def insert_metrics(cursor, policy_id: int, metrics: list[dict[str, Any]]):
    inserted = 0

    for m in metrics:
        if metric_exists(cursor, policy_id, m["metric_name"], m.get("geography")):
            print(f"  ↳ SKIP metric (duplicate): {m['metric_name']}")
            continue

        cursor.execute(
            """
            INSERT INTO metrics (
                policy_id,
                metric_name,
                demographic_group,
                before_value,
                after_value,
                unit,
                geography,
                year_before,
                year_after,
                methodology_note
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                policy_id,
                m["metric_name"],
                m.get("demographic_group", "Black Americans"),
                m.get("before_value"),
                m.get("after_value"),
                m.get("unit"),
                m.get("geography"),
                m.get("year_before"),
                m.get("year_after"),
                m.get("methodology_note"),
            ),
        )
        inserted += 1

    return inserted


# -------------------------
# MAIN IMPORT
# -------------------------
def import_file(file_path: Path):
    data = load_json(file_path)
    conn = get_db_connection()

    total_sources = 0
    total_metrics = 0

    try:
        with conn.cursor() as cursor:
            for record in data:
                title = record["title"]
                year = int(record["year_enacted"])

                policy_id = find_policy_id(cursor, title, year)

                if not policy_id:
                    print(f"❌ Policy not found: {title} ({year})")
                    continue

                print(f"\nUpdating: {title} ({year}) -> id {policy_id}")

                if record.get("sources"):
                    added = insert_sources(cursor, policy_id, record["sources"])
                    total_sources += added

                if record.get("metrics"):
                    added = insert_metrics(cursor, policy_id, record["metrics"])
                    total_metrics += added

        conn.commit()

        print("\n✅ Import complete")
        print(f"Sources added: {total_sources}")
        print(f"Metrics added: {total_metrics}")

    except Exception as e:
        conn.rollback()
        print("❌ ERROR:", e)
        raise
    finally:
        conn.close()


# -------------------------
# ENTRY
# -------------------------
def main():
    if len(sys.argv) != 2:
        print("Usage: python3 scripts/import_audit.py data/file.json")
        sys.exit(1)

    file_path = Path(sys.argv[1]).resolve()

    if not file_path.exists():
        print("File not found:", file_path)
        sys.exit(1)

    import_file(file_path)


if __name__ == "__main__":
    main()
