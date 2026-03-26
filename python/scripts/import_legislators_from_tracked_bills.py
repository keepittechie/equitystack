#!/usr/bin/env python3
from pathlib import Path

import pymysql
from _scorecard_snapshots import replace_snapshots


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


def normalize_chamber(value: str | None) -> str:
    return "Senate" if (value or "").lower().startswith("sen") else "House"


def get_or_create_legislator(cursor, sponsor: dict) -> int:
    cursor.execute(
        """
        SELECT id
        FROM legislators
        WHERE full_name = %s
          AND chamber = %s
          AND IFNULL(state, '') = IFNULL(%s, '')
        LIMIT 1
        """,
        (
            sponsor["legislator_name"],
            normalize_chamber(sponsor["chamber"]),
            sponsor["state"],
        ),
    )
    existing = cursor.fetchone()
    if existing:
        cursor.execute(
            """
            UPDATE legislators
            SET
              party = %s,
              status = 'Active'
            WHERE id = %s
            """,
            (
                sponsor["party"],
                existing["id"],
            ),
        )
        return int(existing["id"])

    cursor.execute(
        """
        INSERT INTO legislators (
          full_name,
          display_name,
          chamber,
          party,
          state,
          status
        ) VALUES (%s, %s, %s, %s, %s, 'Active')
        """,
        (
            sponsor["legislator_name"],
            sponsor["legislator_name"],
            normalize_chamber(sponsor["chamber"]),
            sponsor["party"],
            sponsor["state"],
        ),
    )
    return int(cursor.lastrowid)


def sync_legislator_tracked_bill_roles(cursor) -> tuple[int, int]:
    cursor.execute("DELETE FROM legislator_tracked_bill_roles")

    cursor.execute(
        """
        SELECT
          tbs.tracked_bill_id,
          tbs.legislator_name,
          tbs.party,
          tbs.state,
          tbs.role,
          tb.chamber,
          tb.bill_url,
          tb.introduced_date,
          tb.source_system
        FROM tracked_bill_sponsors tbs
        JOIN tracked_bills tb
          ON tb.id = tbs.tracked_bill_id
        ORDER BY tbs.legislator_name ASC, tbs.tracked_bill_id ASC
        """
    )
    sponsor_rows = cursor.fetchall()

    created_legislators = 0
    created_roles = 0
    seen_legislators: set[int] = set()

    for sponsor in sponsor_rows:
        legislator_id = get_or_create_legislator(cursor, sponsor)
        if legislator_id not in seen_legislators:
            seen_legislators.add(legislator_id)
            created_legislators += 1

        cursor.execute(
            """
            INSERT INTO legislator_tracked_bill_roles (
              legislator_id,
              tracked_bill_id,
              role,
              source_system,
              source_url,
              role_date
            ) VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (
                legislator_id,
                sponsor["tracked_bill_id"],
                sponsor["role"],
                sponsor["source_system"],
                sponsor["bill_url"],
                sponsor["introduced_date"],
            ),
        )
        created_roles += 1

    return created_legislators, created_roles


def sync_legislator_future_bill_positions(cursor) -> int:
    cursor.execute("DELETE FROM legislator_future_bill_positions")

    cursor.execute(
        """
        SELECT
          l.id AS legislator_id,
          fbl.future_bill_id,
          ltr.role,
          tb.bill_url,
          tb.introduced_date
        FROM legislator_tracked_bill_roles ltr
        JOIN legislators l
          ON l.id = ltr.legislator_id
        JOIN tracked_bills tb
          ON tb.id = ltr.tracked_bill_id
        JOIN future_bill_links fbl
          ON fbl.tracked_bill_id = tb.id
        ORDER BY l.id ASC, fbl.future_bill_id ASC
        """
    )
    rows = cursor.fetchall()

    inserted = 0
    seen = set()

    for row in rows:
        position_type = "Sponsor" if row["role"] == "Primary Sponsor" else "Cosponsor"
        dedupe_key = (row["legislator_id"], row["future_bill_id"], position_type)
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)

        cursor.execute(
            """
            INSERT INTO legislator_future_bill_positions (
              legislator_id,
              future_bill_id,
              position_type,
              source_url,
              source_date
            ) VALUES (%s, %s, %s, %s, %s)
            """,
            (
                row["legislator_id"],
                row["future_bill_id"],
                position_type,
                row["bill_url"],
                row["introduced_date"],
            ),
        )
        inserted += 1

    return inserted


def run_import() -> dict[str, int]:
    conn = get_db_connection()

    try:
        with conn.cursor() as cursor:
            legislators_count, role_count = sync_legislator_tracked_bill_roles(cursor)
            future_positions_count = sync_legislator_future_bill_positions(cursor)
            snapshot_count = replace_snapshots(cursor)

        conn.commit()
        return {
            "legislators_touched": legislators_count,
            "tracked_bill_roles_inserted": role_count,
            "future_bill_positions_inserted": future_positions_count,
            "scorecard_snapshots_inserted": snapshot_count,
        }
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def main():
    results = run_import()
    print("Legislator import complete")
    print(f"Legislators touched: {results['legislators_touched']}")
    print(f"Tracked bill roles inserted: {results['tracked_bill_roles_inserted']}")
    print(f"Future bill positions inserted: {results['future_bill_positions_inserted']}")
    print(f"Scorecard snapshots inserted: {results['scorecard_snapshots_inserted']}")


if __name__ == "__main__":
    main()
