#!/usr/bin/env python3
import json
import os
import sys
from pathlib import Path
from typing import Any

import pymysql


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


def get_db_connection() -> pymysql.connections.Connection:
    project_root = Path(__file__).resolve().parents[2]
    env_file = project_root / ".env.local"

    env_values = load_env_file(env_file)

    host = env_values.get("DB_HOST") or os.getenv("DB_HOST", "127.0.0.1")
    port = int(env_values.get("DB_PORT") or os.getenv("DB_PORT", "3306"))
    user = env_values.get("DB_USER") or os.getenv("DB_USER", "root")
    password = env_values.get("DB_PASSWORD") or os.getenv("DB_PASSWORD", "")
    database = env_values.get("DB_NAME") or os.getenv("DB_NAME", "black_policy_tracker")

    return pymysql.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        database=database,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False,
    )


def load_json_file(file_path: Path) -> list[dict[str, Any]]:
    data = json.loads(file_path.read_text())
    if not isinstance(data, list):
        raise ValueError(f"{file_path} must contain a JSON array")
    return data


def fetch_lookup_map(cursor, table: str, key_col: str = "name", value_col: str = "id") -> dict[str, int]:
    cursor.execute(f"SELECT {value_col}, {key_col} FROM {table}")
    rows = cursor.fetchall()
    return {str(row[key_col]): int(row[value_col]) for row in rows}


def fetch_president_map(cursor) -> dict[str, int]:
    cursor.execute("SELECT id, full_name FROM presidents")
    rows = cursor.fetchall()
    return {str(row["full_name"]): int(row["id"]) for row in rows}


def get_existing_policy_id(cursor, title: str, year_enacted: int) -> int | None:
    cursor.execute(
        """
        SELECT id
        FROM policies
        WHERE title = %s AND year_enacted = %s
        LIMIT 1
        """,
        (title, year_enacted),
    )
    row = cursor.fetchone()
    return int(row["id"]) if row else None


def insert_policy(cursor, policy: dict[str, Any], maps: dict[str, dict[str, int]]) -> int:
    era_id = maps["eras"].get(policy["era"])
    if not era_id:
        raise ValueError(f"Unknown era: {policy['era']}")

    primary_party_id = None
    if policy.get("primary_party"):
        primary_party_id = maps["parties"].get(policy["primary_party"])
        if not primary_party_id:
            raise ValueError(f"Unknown primary party: {policy['primary_party']}")

    house_party_id = None
    if policy.get("house_party"):
        house_party_id = maps["parties"].get(policy["house_party"])
        if not house_party_id:
            raise ValueError(f"Unknown house party: {policy['house_party']}")

    senate_party_id = None
    if policy.get("senate_party"):
        senate_party_id = maps["parties"].get(policy["senate_party"])
        if not senate_party_id:
            raise ValueError(f"Unknown senate party: {policy['senate_party']}")

    president_id = None
    if policy.get("president"):
        president_id = maps["presidents"].get(policy["president"])
        if not president_id:
            raise ValueError(f"Unknown president: {policy['president']}")

    cursor.execute(
        """
        INSERT INTO policies (
            title,
            policy_type,
            summary,
            year_enacted,
            date_enacted,
            era_id,
            president_id,
            house_party_id,
            senate_party_id,
            primary_party_id,
            bipartisan,
            direct_black_impact,
            outcome_summary,
            status,
            impact_direction,
            impact_notes,
            is_archived
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 0)
        """,
        (
            policy["title"],
            policy["policy_type"],
            policy.get("summary"),
            int(policy["year_enacted"]),
            policy.get("date_enacted"),
            era_id,
            president_id,
            house_party_id,
            senate_party_id,
            primary_party_id,
            1 if policy.get("bipartisan") else 0,
            1 if policy.get("direct_black_impact") else 0,
            policy.get("outcome_summary"),
            policy.get("status", "Active"),
            policy.get("impact_direction", "Positive"),
            policy.get("impact_notes"),
        ),
    )
    return int(cursor.lastrowid)


def insert_categories(cursor, policy_id: int, categories: list[str], category_map: dict[str, int]) -> None:
    for category_name in categories:
        category_id = category_map.get(category_name)
        if not category_id:
            raise ValueError(f"Unknown category: {category_name}")
        cursor.execute(
            """
            INSERT INTO policy_policy_categories (policy_id, category_id)
            VALUES (%s, %s)
            """,
            (policy_id, category_id),
        )


def insert_scores(cursor, policy_id: int, scores: dict[str, Any]) -> None:
    cursor.execute(
        """
        INSERT INTO policy_scores (
            policy_id,
            directness_score,
            material_impact_score,
            evidence_score,
            durability_score,
            equity_score,
            harm_offset_score,
            notes
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            policy_id,
            int(scores.get("directness_score", 0)),
            int(scores.get("material_impact_score", 0)),
            int(scores.get("evidence_score", 0)),
            int(scores.get("durability_score", 0)),
            int(scores.get("equity_score", 0)),
            int(scores.get("harm_offset_score", 0)),
            scores.get("notes"),
        ),
    )


def insert_sources(cursor, policy_id: int, sources: list[dict[str, Any]]) -> None:
    for source in sources:
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
                source["source_title"],
                source["source_url"],
                source["source_type"],
                source.get("publisher"),
                source.get("published_date"),
                source.get("notes"),
            ),
        )


def insert_metrics(cursor, policy_id: int, metrics: list[dict[str, Any]]) -> None:
    for metric in metrics:
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
                metric["metric_name"],
                metric.get("demographic_group", "Black Americans"),
                metric.get("before_value"),
                metric.get("after_value"),
                metric.get("unit"),
                metric.get("geography"),
                metric.get("year_before"),
                metric.get("year_after"),
                metric.get("methodology_note"),
            ),
        )


def validate_policy(policy: dict[str, Any]) -> None:
    required = ["title", "policy_type", "year_enacted", "era"]
    missing = [field for field in required if not policy.get(field)]
    if missing:
        raise ValueError(f"Missing required fields for policy: {missing}")


def import_file(file_path: Path) -> None:
    records = load_json_file(file_path)
    conn = get_db_connection()

    inserted = 0
    skipped = 0

    try:
        with conn.cursor() as cursor:
            maps = {
                "eras": fetch_lookup_map(cursor, "eras", "name", "id"),
                "parties": fetch_lookup_map(cursor, "parties", "name", "id"),
                "categories": fetch_lookup_map(cursor, "policy_categories", "name", "id"),
                "presidents": fetch_president_map(cursor),
            }

            for policy in records:
                validate_policy(policy)

                existing_id = get_existing_policy_id(
                    cursor,
                    policy["title"],
                    int(policy["year_enacted"]),
                )

                if existing_id:
                    print(f"SKIP duplicate: {policy['title']} ({policy['year_enacted']}) -> existing id {existing_id}")
                    skipped += 1
                    continue

                policy_id = insert_policy(cursor, policy, maps)

                if policy.get("categories"):
                    insert_categories(cursor, policy_id, policy["categories"], maps["categories"])

                if policy.get("scores"):
                    insert_scores(cursor, policy_id, policy["scores"])

                if policy.get("sources"):
                    insert_sources(cursor, policy_id, policy["sources"])

                if policy.get("metrics"):
                    insert_metrics(cursor, policy_id, policy["metrics"])

                print(f"INSERTED: {policy['title']} ({policy['year_enacted']}) -> id {policy_id}")
                inserted += 1

        conn.commit()
        print("\nImport complete.")
        print(f"Inserted: {inserted}")
        print(f"Skipped duplicates: {skipped}")

    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python3 scripts/import_policies.py data/policies/file.json")
        sys.exit(1)

    file_path = Path(sys.argv[1]).resolve()

    if not file_path.exists():
        print(f"File not found: {file_path}")
        sys.exit(1)

    import_file(file_path)


if __name__ == "__main__":
    main()
