#!/usr/bin/env python3
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

import pymysql
import requests


API_ROOT = "https://api.congress.gov/v3"


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


def get_project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def get_env_values() -> dict[str, str]:
    values = load_env_file(get_project_root() / ".env.local")
    for key in ("DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME", "CONGRESS_API_KEY"):
        if os.environ.get(key):
            values[key] = os.environ[key]
    return values


def get_db_connection():
    env_values = get_env_values()

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


def get_api_key() -> str:
    env_values = get_env_values()
    api_key = env_values.get("CONGRESS_API_KEY", "").strip()

    if not api_key:
        raise RuntimeError(
            "Missing CONGRESS_API_KEY in .env.local. "
            "Add your Congress.gov API key before running this script."
        )

    return api_key


def load_seed_file(file_path: Path) -> list[dict[str, Any]]:
    data = json.loads(file_path.read_text())
    if not isinstance(data, list):
        raise ValueError("Seed file must be a JSON array")
    return data


def load_existing_tracked_bill_seeds(cursor) -> list[dict[str, Any]]:
    cursor.execute(
        """
        SELECT
          bill_number,
          jurisdiction,
          chamber,
          session_label,
          source_system,
          active,
          match_confidence
        FROM tracked_bills
        ORDER BY latest_action_date DESC, bill_number ASC
        """
    )
    rows = cursor.fetchall()
    seeds: list[dict[str, Any]] = []

    for row in rows:
        bill_type, bill_number = parse_display_bill_number(row["bill_number"])
        seeds.append(
            {
                "congress": parse_congress_from_session_label(row["session_label"]),
                "bill_type": bill_type,
                "bill_number": bill_number,
                "jurisdiction": row["jurisdiction"],
                "chamber": row["chamber"],
                "source_system": row.get("source_system") or "Congress.gov",
                "active": bool(row.get("active", 1)),
                "match_confidence": row.get("match_confidence") or "High",
            }
        )

    return seeds


def clean_html(text: str | None) -> str | None:
    if not text:
        return text

    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def ordinal_suffix(n: int) -> str:
    if 10 <= (n % 100) <= 20:
        return "th"
    return {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")


def session_label_for_congress(congress: int) -> str:
    return f"{congress}{ordinal_suffix(congress)} Congress"


def normalize_bill_type(bill_type: str) -> str:
    return bill_type.strip().lower()


def normalize_bill_number(bill_number: int | str) -> str:
    return str(bill_number).strip()


def parse_display_bill_number(display_bill_number: str) -> tuple[str, str]:
    normalized = re.sub(r"\s+", " ", display_bill_number.strip())
    match = re.match(r"^([A-Za-z\.]+)\s+(\d+)$", normalized)
    if not match:
        raise ValueError(f"Unsupported bill number format: {display_bill_number}")

    prefix = match.group(1).replace(".", "").lower()
    return prefix, match.group(2)


def parse_congress_from_session_label(session_label: str | None) -> int:
    if not session_label:
        raise ValueError("Missing session label")

    match = re.search(r"(\d+)", session_label)
    if not match:
        raise ValueError(f"Unable to parse congress from session label: {session_label}")

    return int(match.group(1))


def build_bill_number_display(bill_type: str, bill_number: str) -> str:
    display_map = {
        "hr": "H.R.",
        "s": "S.",
        "hjres": "H.J.Res.",
        "sjres": "S.J.Res.",
        "hconres": "H.Con.Res.",
        "sconres": "S.Con.Res.",
        "hres": "H.Res.",
        "sres": "S.Res.",
    }
    prefix = display_map.get(normalize_bill_type(bill_type), bill_type.upper())
    return f"{prefix} {bill_number}"


def congress_get(path: str, api_key: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    query = {"format": "json"}
    if params:
        query.update(params)

    response = requests.get(
        f"{API_ROOT}{path}",
        params=query,
        headers={"X-Api-Key": api_key, "Accept": "application/json"},
        timeout=30,
    )

    try:
        response.raise_for_status()
    except requests.HTTPError as error:
        body = response.text.strip()
        if len(body) > 400:
            body = body[:400] + "..."
        raise requests.HTTPError(
            f"{error}. Response body: {body}",
            response=response,
            request=response.request,
        ) from error

    return response.json()


def safe_get(value: Any, *keys, default=None):
    current = value
    for key in keys:
        if isinstance(current, dict) and key in current:
            current = current[key]
        elif isinstance(current, list) and isinstance(key, int) and 0 <= key < len(current):
            current = current[key]
        else:
            return default
    return current


def fetch_bill_detail(congress: int, bill_type: str, bill_number: str, api_key: str) -> dict[str, Any]:
    payload = congress_get(f"/bill/{congress}/{bill_type}/{bill_number}", api_key)
    bill = payload.get("bill")
    if not bill:
        raise ValueError(f"No bill detail returned for {congress} {bill_type} {bill_number}")
    return bill


def fetch_latest_summary(congress: int, bill_type: str, bill_number: str, api_key: str) -> str | None:
    try:
        payload = congress_get(
            f"/bill/{congress}/{bill_type}/{bill_number}/summaries",
            api_key,
            params={"limit": 1},
        )
    except requests.HTTPError:
        return None

    summaries = payload.get("summaries", [])
    if not summaries:
        return None

    summary = summaries[0]
    text = (
        summary.get("text")
        or summary.get("summaryText")
        or summary.get("actionDesc")
        or safe_get(summary, "summaries", 0, "text")
    )
    return clean_html(text)


def fetch_bill_actions(congress: int, bill_type: str, bill_number: str, api_key: str) -> list[dict[str, Any]]:
    try:
        payload = congress_get(
            f"/bill/{congress}/{bill_type}/{bill_number}/actions",
            api_key,
            params={"limit": 250},
        )
    except requests.HTTPError:
        return []

    raw_actions = payload.get("actions") or safe_get(payload, "billActions", "actions", default=[])
    actions: list[dict[str, Any]] = []

    for item in raw_actions or []:
        action_text = clean_html(
            item.get("text")
            or item.get("actionDesc")
            or item.get("description")
            or item.get("actionText")
        )
        if not action_text:
            continue

        committee_names = []
        for committee in item.get("committees") or []:
            name = committee.get("name")
            if name:
                committee_names.append(name)

        action_type = (
            item.get("type")
            or item.get("actionCode")
            or item.get("actionType")
            or infer_action_type(action_text)
        )

        actions.append(
            {
                "date": item.get("actionDate") or item.get("date"),
                "text": action_text,
                "type": action_type,
                "chamber": item.get("actionTime") or item.get("chamber"),
                "committee_name": ", ".join(committee_names) if committee_names else None,
                "source_url": item.get("url"),
            }
        )

    return actions


def fetch_bill_cosponsors(congress: int, bill_type: str, bill_number: str, api_key: str) -> list[dict[str, Any]]:
    try:
        payload = congress_get(
            f"/bill/{congress}/{bill_type}/{bill_number}/cosponsors",
            api_key,
            params={"limit": 250},
        )
    except requests.HTTPError:
        return []

    return payload.get("cosponsors") or []


def infer_action_type(action_text: str) -> str:
    lowered = action_text.lower()

    if "became public law" in lowered or "signed into law" in lowered:
        return "Enacted"
    if "passed senate" in lowered:
        return "Passed Senate"
    if "passed house" in lowered:
        return "Passed House"
    if "introduced" in lowered or "reintroduced" in lowered:
        return "Introduced"
    if "referred to" in lowered:
        return "Referred"
    if "committee" in lowered:
        return "Committee"
    if "hearing" in lowered:
        return "Hearing"

    return "Action"


def extract_primary_sponsor(bill: dict[str, Any]) -> tuple[str | None, str | None, str | None]:
    sponsors = bill.get("sponsors") or []
    if not sponsors:
        return None, None, None

    sponsor = sponsors[0]
    return (
        sponsor.get("fullName") or sponsor.get("name"),
        sponsor.get("party"),
        sponsor.get("state"),
    )


def build_sponsor_records(bill: dict[str, Any], cosponsors: list[dict[str, Any]]) -> list[dict[str, Any]]:
    sponsor_records: list[dict[str, Any]] = []
    seen = set()

    for sponsor in bill.get("sponsors") or []:
        name = sponsor.get("fullName") or sponsor.get("name")
        if not name or name in seen:
            continue
        seen.add(name)
        sponsor_records.append(
            {
                "name": name,
                "party": sponsor.get("party"),
                "state": sponsor.get("state"),
                "role": "Primary Sponsor",
            }
        )

    for sponsor in cosponsors:
        name = sponsor.get("fullName") or sponsor.get("name")
        if not name or name in seen:
            continue
        seen.add(name)
        sponsor_records.append(
            {
                "name": name,
                "party": sponsor.get("party"),
                "state": sponsor.get("state"),
                "role": "Cosponsor",
            }
        )

    return sponsor_records


def extract_bill_title(bill: dict[str, Any], fallback_display: str) -> str:
    title = bill.get("title")
    if title:
        return title

    titles = bill.get("titles") or []
    if titles:
        maybe_title = titles[0].get("title")
        if maybe_title:
            return maybe_title

    return fallback_display


def extract_latest_action(bill: dict[str, Any]) -> tuple[str | None, str | None]:
    latest = bill.get("latestAction") or {}
    return latest.get("text"), latest.get("actionDate")


def derive_bill_status(latest_action_text: str | None, bill: dict[str, Any]) -> str:
    if latest_action_text:
        lowered = latest_action_text.lower()
        if "became public law" in lowered or "became private law" in lowered:
            return "Enacted"
        if "passed senate" in lowered:
            return "Passed Senate"
        if "passed house" in lowered:
            return "Passed House"
        if "introduced" in lowered or "reintroduced" in lowered:
            return "Introduced"
        if "referred to" in lowered:
            return "In Committee"

    if bill.get("originChamber"):
        return "Introduced"

    return "Tracked"


def get_existing_tracked_bill_id(cursor, bill_number: str, jurisdiction: str) -> int | None:
    cursor.execute(
        """
        SELECT id
        FROM tracked_bills
        WHERE bill_number = %s AND jurisdiction = %s
        LIMIT 1
        """,
        (bill_number, jurisdiction),
    )
    row = cursor.fetchone()
    return int(row["id"]) if row else None


def upsert_tracked_bill(cursor, row: dict[str, Any]) -> int:
    existing_id = get_existing_tracked_bill_id(cursor, row["bill_number"], row["jurisdiction"])

    if existing_id:
        cursor.execute(
            """
            UPDATE tracked_bills
            SET
              title = %s,
              chamber = %s,
              session_label = %s,
              sponsor_name = %s,
              sponsor_party = %s,
              sponsor_state = %s,
              official_summary = %s,
              bill_url = %s,
              source_system = %s,
              bill_status = %s,
              last_action = %s,
              introduced_date = %s,
              latest_action_date = %s,
              active = %s,
              match_confidence = %s
            WHERE id = %s
            """,
            (
                row["title"],
                row["chamber"],
                row["session_label"],
                row["sponsor_name"],
                row["sponsor_party"],
                row["sponsor_state"],
                row["official_summary"],
                row["bill_url"],
                row["source_system"],
                row["bill_status"],
                row["last_action"],
                row["introduced_date"],
                row["latest_action_date"],
                row["active"],
                row["match_confidence"],
                existing_id,
            ),
        )
        return existing_id

    cursor.execute(
        """
        INSERT INTO tracked_bills (
          bill_number,
          title,
          jurisdiction,
          chamber,
          session_label,
          sponsor_name,
          sponsor_party,
          sponsor_state,
          official_summary,
          bill_url,
          source_system,
          bill_status,
          last_action,
          introduced_date,
          latest_action_date,
          active,
          match_confidence
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            row["bill_number"],
            row["title"],
            row["jurisdiction"],
            row["chamber"],
            row["session_label"],
            row["sponsor_name"],
            row["sponsor_party"],
            row["sponsor_state"],
            row["official_summary"],
            row["bill_url"],
            row["source_system"],
            row["bill_status"],
            row["last_action"],
            row["introduced_date"],
            row["latest_action_date"],
            row["active"],
            row["match_confidence"],
        ),
    )
    return int(cursor.lastrowid)


def ensure_future_bill_link(
    cursor,
    future_bill_id: int | None,
    tracked_bill_id: int,
    link_type: str | None,
    notes: str | None,
) -> None:
    if not future_bill_id:
        return

    cursor.execute(
        """
        SELECT id
        FROM future_bill_links
        WHERE future_bill_id = %s AND tracked_bill_id = %s
        LIMIT 1
        """,
        (future_bill_id, tracked_bill_id),
    )
    existing = cursor.fetchone()

    if existing:
        cursor.execute(
            """
            UPDATE future_bill_links
            SET link_type = %s,
                notes = %s
            WHERE id = %s
            """,
            (link_type, notes, existing["id"]),
        )
        return

    cursor.execute(
        """
        INSERT INTO future_bill_links (
          future_bill_id,
          tracked_bill_id,
          link_type,
          notes
        ) VALUES (%s, %s, %s, %s)
        """,
        (future_bill_id, tracked_bill_id, link_type, notes),
    )


def replace_tracked_bill_actions(cursor, tracked_bill_id: int, actions: list[dict[str, Any]]) -> None:
    cursor.execute(
        "DELETE FROM tracked_bill_actions WHERE tracked_bill_id = %s",
        (tracked_bill_id,),
    )

    for action in actions:
        cursor.execute(
            """
            INSERT INTO tracked_bill_actions (
              tracked_bill_id,
              action_date,
              action_text,
              action_type,
              chamber,
              committee_name,
              source_url
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                tracked_bill_id,
                action.get("date"),
                action.get("text"),
                action.get("type"),
                action.get("chamber"),
                action.get("committee_name"),
                action.get("source_url"),
            ),
        )


def replace_tracked_bill_sponsors(cursor, tracked_bill_id: int, sponsors: list[dict[str, Any]]) -> None:
    cursor.execute(
        "DELETE FROM tracked_bill_sponsors WHERE tracked_bill_id = %s",
        (tracked_bill_id,),
    )

    for sponsor in sponsors:
        cursor.execute(
            """
            INSERT INTO tracked_bill_sponsors (
              tracked_bill_id,
              legislator_name,
              party,
              state,
              role
            ) VALUES (%s, %s, %s, %s, %s)
            """,
            (
                tracked_bill_id,
                sponsor.get("name"),
                sponsor.get("party"),
                sponsor.get("state"),
                sponsor.get("role", "Cosponsor"),
            ),
        )


def process_seed_record(seed: dict[str, Any], api_key: str) -> dict[str, Any]:
    future_bill_id = seed.get("future_bill_id")
    congress = int(seed["congress"])
    bill_type = normalize_bill_type(seed["bill_type"])
    bill_number = normalize_bill_number(seed["bill_number"])
    jurisdiction = seed.get("jurisdiction", "Federal")
    chamber = seed.get("chamber")
    link_type = seed.get("link_type")
    link_notes = seed.get("link_notes")

    display_bill_number = build_bill_number_display(bill_type, bill_number)

    bill = fetch_bill_detail(congress, bill_type, bill_number, api_key)
    summary_text = fetch_latest_summary(congress, bill_type, bill_number, api_key)
    cosponsors = fetch_bill_cosponsors(congress, bill_type, bill_number, api_key)
    actions = fetch_bill_actions(congress, bill_type, bill_number, api_key)

    sponsor_name, sponsor_party, sponsor_state = extract_primary_sponsor(bill)
    latest_action_text, latest_action_date = extract_latest_action(bill)

    if not actions and (latest_action_text or latest_action_date):
        actions = [
            {
                "date": latest_action_date,
                "text": clean_html(latest_action_text) or "Tracked bill update",
                "type": derive_bill_status(latest_action_text, bill),
                "chamber": chamber or bill.get("originChamber"),
                "committee_name": None,
                "source_url": bill.get("url"),
            }
        ]

    sponsors = build_sponsor_records(bill, cosponsors)
    if not sponsors and sponsor_name:
        sponsors = [
            {
                "name": sponsor_name,
                "party": sponsor_party,
                "state": sponsor_state,
                "role": "Primary Sponsor",
            }
        ]

    title = extract_bill_title(bill, display_bill_number)
    bill_url = (
        bill.get("url")
        or f"https://www.congress.gov/bill/{congress}th-congress/{bill_type.lower()}-bill/{bill_number}"
    )
    bill_status = derive_bill_status(latest_action_text, bill)

    return {
        "future_bill_id": future_bill_id,
        "link_type": link_type,
        "link_notes": link_notes,
        "tracked_bill": {
            "bill_number": display_bill_number,
            "title": title,
            "jurisdiction": jurisdiction,
            "chamber": chamber or bill.get("originChamber"),
            "session_label": session_label_for_congress(congress),
            "sponsor_name": sponsor_name,
            "sponsor_party": sponsor_party,
            "sponsor_state": sponsor_state,
            "official_summary": summary_text,
            "bill_url": bill_url,
            "source_system": seed.get("source_system", "Congress.gov"),
            "bill_status": bill_status,
            "last_action": clean_html(latest_action_text),
            "introduced_date": bill.get("introducedDate"),
            "latest_action_date": latest_action_date,
            "active": 1 if seed.get("active", True) else 0,
            "match_confidence": seed.get("match_confidence", "High"),
        },
        "actions": actions,
        "sponsors": sponsors,
    }


def run_sync(input_arg: str) -> int:
    api_key = get_api_key()
    conn = get_db_connection()
    input_arg = input_arg.strip()

    synced_count = 0

    try:
        with conn.cursor() as cursor:
            if input_arg == "--backfill-existing":
                seed_rows = load_existing_tracked_bill_seeds(cursor)
            else:
                seed_path = Path(input_arg).resolve()
                if not seed_path.exists():
                    print(f"Seed file not found: {seed_path}")
                    sys.exit(1)
                seed_rows = load_seed_file(seed_path)

            for seed in seed_rows:
                try:
                    processed = process_seed_record(seed, api_key)
                    tracked_bill_id = upsert_tracked_bill(cursor, processed["tracked_bill"])
                    ensure_future_bill_link(
                        cursor,
                        processed["future_bill_id"],
                        tracked_bill_id,
                        processed.get("link_type"),
                        processed.get("link_notes"),
                    )
                    replace_tracked_bill_actions(cursor, tracked_bill_id, processed["actions"])
                    replace_tracked_bill_sponsors(cursor, tracked_bill_id, processed["sponsors"])
                    synced_count += 1
                    print(
                        f"✔ Synced {processed['tracked_bill']['bill_number']} | "
                        f"{processed['tracked_bill']['title']} | "
                        f"actions={len(processed['actions'])} sponsors={len(processed['sponsors'])}"
                    )
                except Exception as error:
                    print(f"✖ Failed seed {seed}: {error}")

        conn.commit()
        return synced_count
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def main():
    if len(sys.argv) != 2:
        print(
            "Usage: python3 scripts/import_tracked_bills.py data/tracked_bills_seed.json\n"
            "   or: python3 scripts/import_tracked_bills.py --backfill-existing"
        )
        sys.exit(1)

    synced_count = run_sync(sys.argv[1])
    print(f"\nDone. Synced rows: {synced_count}")


if __name__ == "__main__":
    main()
