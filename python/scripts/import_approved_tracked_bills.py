#!/usr/bin/env python3
import argparse
import csv
import json
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from import_tracked_bills import (
    build_bill_number_display,
    derive_bill_status,
    extract_bill_title,
    extract_latest_action,
    extract_primary_sponsor,
    fetch_bill_detail,
    fetch_latest_summary,
    get_api_key,
    get_db_connection,
    normalize_bill_number,
    normalize_bill_type,
    session_label_for_congress,
)


LINK_TYPE_STRENGTH = {
    "Partial": 1,
    "Related": 2,
    "Companion": 3,
    "Direct": 4,
}

CHAMBER_TO_BILL_TYPE = {
    "house": "hr",
    "senate": "s",
}

IMPACT_PENDING_STATUS = "impact_pending"
IMPORT_WITH_PENDING_IMPACT_ACTION = "import_with_pending_impact"
VALID_IMPACT_STATUSES = {
    "impact_scored",
    "impact_pending",
    "insufficient_evidence",
    "needs_manual_review",
}
VALID_SOURCE_QUALITIES = {"low", "medium", "high"}


def python_dir() -> Path:
    return Path(__file__).resolve().parents[1]


def reports_dir() -> Path:
    return python_dir() / "reports"


def default_input_path() -> Path:
    return reports_dir() / "approved_tracked_bills_seed.json"


def default_output_path() -> Path:
    return reports_dir() / "import_approved_tracked_bills_report.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Import approved tracked-bill seed rows into tracked_bills with optional future_bill linking."
    )
    parser.add_argument("--input", type=Path, default=default_input_path(), help="Approved tracked-bill seed JSON")
    parser.add_argument("--apply", action="store_true", help="Mutate the database")
    parser.add_argument("--yes", action="store_true", help="Required confirmation for --apply mode")
    parser.add_argument("--only-future-bill-id", type=int, action="append", help="Limit to one or more future_bill_id values")
    parser.add_argument("--only-bill-number", action="append", help="Limit to one or more bill numbers")
    parser.add_argument("--link-imported-bills", action="store_true", help="Create or update future_bill_links for processed rows")
    parser.add_argument("--enrich-metadata", action="store_true", help="Fetch missing bill metadata from reusable import helpers")
    parser.add_argument("--output", type=Path, default=default_output_path(), help="Import report JSON output")
    parser.add_argument("--csv", nargs="?", const="", help="Write a CSV summary. Pass a path or omit a value to derive one.")
    return parser.parse_args()


def derive_csv_path(csv_arg: str | None, output_path: Path) -> Path | None:
    if csv_arg is None:
        return None
    if csv_arg == "":
        return output_path.with_suffix(".csv")
    return Path(csv_arg).resolve()


def load_seed_rows(path: Path) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text())
    if isinstance(payload, list):
        rows = payload
    elif isinstance(payload, dict):
        rows = payload.get("items") or payload.get("rows") or payload.get("approved_seed_rows") or []
    else:
        raise ValueError("Seed file must be a JSON list or object containing rows")
    if not isinstance(rows, list):
        raise ValueError("Seed rows must be a JSON list")
    return [row for row in rows if isinstance(row, dict)]


def first_present(*values: Any) -> Any:
    for value in values:
        if isinstance(value, str):
            if value.strip():
                return value.strip()
        elif value not in (None, ""):
            return value
    return None


def nested_get(value: Any, *keys: str) -> Any:
    current = value
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def normalize_review_text(value: Any) -> str | None:
    if value in (None, ""):
        return None
    return str(value).strip().lower().replace(" ", "_").replace("-", "_")


def normalize_impact_status(value: Any) -> str | None:
    normalized = normalize_review_text(value)
    return normalized if normalized in VALID_IMPACT_STATUSES else None


def normalize_recommended_action(value: Any) -> str | None:
    normalized = normalize_review_text(value)
    if normalized in {"manual_review_required", "manual_review"}:
        return "needs_manual_review"
    if normalized in {"import_pending_impact", "import_with_pending_impact"}:
        return IMPORT_WITH_PENDING_IMPACT_ACTION
    return normalized


def normalize_source_quality(value: Any) -> str | None:
    normalized = normalize_review_text(value)
    mapping = {
        "weak": "low",
        "moderate": "medium",
        "strong": "high",
    }
    normalized = mapping.get(normalized or "", normalized)
    return normalized if normalized in VALID_SOURCE_QUALITIES else None


def normalize_confidence(value: Any) -> str | float | None:
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    normalized = normalize_review_text(value)
    if normalized in {"low", "medium", "high"}:
        return normalized
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return str(value).strip()


def review_context_from_seed(seed: dict[str, Any], payload: dict[str, Any], raw_data: dict[str, Any]) -> dict[str, Any]:
    return {
        "impact_status": normalize_impact_status(
            first_present(seed.get("impact_status"), payload.get("impact_status"), raw_data.get("impact_status"))
        ),
        "recommended_action": normalize_recommended_action(
            first_present(seed.get("recommended_action"), payload.get("recommended_action"), raw_data.get("recommended_action"))
        ),
        "confidence": normalize_confidence(
            first_present(seed.get("confidence"), payload.get("confidence"), raw_data.get("confidence"), seed.get("match_confidence"), payload.get("match_confidence"))
        ),
        "source_quality": normalize_source_quality(
            first_present(seed.get("source_quality"), payload.get("source_quality"), raw_data.get("source_quality"))
        ),
    }


def is_impact_pending_import(row: dict[str, Any]) -> bool:
    return (
        row.get("impact_status") == IMPACT_PENDING_STATUS
        and row.get("recommended_action") == IMPORT_WITH_PENDING_IMPACT_ACTION
    )


def values_conflict(current: Any, incoming: Any) -> bool:
    if current in (None, "") or incoming in (None, ""):
        return False
    return str(current).strip() != str(incoming).strip()


def normalize_filter_bill_number(raw: str) -> str:
    text = str(raw).strip()
    lowered = text.lower()
    if " " in text:
        return lowered
    return lowered.lstrip("0")


def normalize_link_type(value: Any) -> str | None:
    if value in (None, ""):
        return None
    text = str(value).strip().lower()
    for canonical in LINK_TYPE_STRENGTH:
        if text == canonical.lower():
            return canonical
    return str(value).strip()


def derive_bill_type_from_chamber(chamber: Any) -> str | None:
    if chamber in (None, ""):
        return None
    return CHAMBER_TO_BILL_TYPE.get(str(chamber).strip().lower())


def split_display_bill_number(value: Any) -> tuple[str | None, str | None]:
    if value in (None, ""):
        return None, None
    text = str(value).strip()
    match = re.match(r"^([A-Za-z\.]+)\s+(\d+)$", text)
    if not match:
        return None, None
    return normalize_bill_type(match.group(1).replace(".", "")), normalize_bill_number(match.group(2))


def infer_link_type(seed: dict[str, Any]) -> str | None:
    explicit = normalize_link_type(first_present(seed.get("link_type"), nested_get(seed, "payload", "link_type")))
    if explicit:
        return explicit
    if seed.get("future_bill_id") not in (None, ""):
        return "Partial"
    return None


def is_placeholder_title(title: Any, bill_number: Any) -> bool:
    title_text = str(title).strip() if title not in (None, "") else ""
    bill_text = str(bill_number).strip() if bill_number not in (None, "") else ""
    if not title_text:
        return True
    return title_text.lower() == bill_text.lower()


def title_candidates(seed: dict[str, Any], payload: dict[str, Any], raw_data: dict[str, Any]) -> list[tuple[str, Any]]:
    return [
        ("seed_only", seed.get("title")),
        ("seed_only", seed.get("candidate_title")),
        ("seed_nested_payload", raw_data.get("title")),
        ("seed_nested_payload", raw_data.get("candidate_title")),
        ("seed_nested_payload", raw_data.get("official_title")),
        ("seed_nested_payload", nested_get(raw_data, "candidate", "title")),
        ("seed_nested_payload", payload.get("title")),
        ("seed_nested_payload", payload.get("candidate_title")),
    ]


def summary_candidates(seed: dict[str, Any], payload: dict[str, Any], raw_data: dict[str, Any]) -> list[tuple[str, Any]]:
    return [
        ("seed_only", seed.get("official_summary")),
        ("seed_nested_payload", raw_data.get("official_summary")),
        ("seed_nested_payload", raw_data.get("summary")),
        ("seed_nested_payload", nested_get(raw_data, "candidate", "official_summary")),
        ("seed_nested_payload", nested_get(raw_data, "candidate", "summary")),
        ("seed_nested_payload", payload.get("official_summary")),
        ("seed_nested_payload", payload.get("summary")),
    ]


def choose_best_text(candidates: list[tuple[str, Any]], *, bill_number_fallback: str | None = None) -> tuple[str | None, str | None]:
    fallback = str(bill_number_fallback).strip() if bill_number_fallback else None
    for source, value in candidates:
        if value in (None, ""):
            continue
        text = str(value).strip()
        if not text:
            continue
        if fallback and text.lower() == fallback.lower():
            continue
        return text, source
    return None, None


def fetched_metadata(seed: dict[str, Any], api_key: str | None) -> dict[str, Any]:
    if not api_key:
        return {}
    congress = seed.get("congress")
    bill_type = seed.get("bill_type")
    bill_number = seed.get("bill_number")
    if congress in (None, "") or bill_type in (None, "") or bill_number in (None, ""):
        return {}
    bill = fetch_bill_detail(int(congress), str(bill_type), str(bill_number), api_key)
    latest_action_text, latest_action_date = extract_latest_action(bill)
    sponsor_name, sponsor_party, sponsor_state = extract_primary_sponsor(bill)
    fallback_display = seed.get("normalized_bill_number") or build_bill_number_display(str(bill_type), str(bill_number))
    return {
        "resolved_title": extract_bill_title(bill, fallback_display),
        "resolved_official_summary": fetch_latest_summary(int(congress), str(bill_type), str(bill_number), api_key),
        "resolved_bill_status": derive_bill_status(latest_action_text, bill),
        "resolved_sponsor_name": sponsor_name,
        "resolved_sponsor_party": sponsor_party,
        "resolved_sponsor_state": sponsor_state,
        "introduced_date": bill.get("introducedDate"),
        "latest_action_date": latest_action_date,
        "last_action": latest_action_text,
        "bill_url": bill.get("url"),
    }


def resolve_seed_metadata(seed: dict[str, Any], *, enrich_metadata: bool, api_key: str | None) -> dict[str, Any]:
    payload = seed.get("payload") if isinstance(seed.get("payload"), dict) else {}
    raw_data = seed.get("raw_data") if isinstance(seed.get("raw_data"), dict) else {}

    chamber = first_present(seed.get("chamber"), payload.get("chamber"), raw_data.get("chamber"))
    raw_bill_type = first_present(seed.get("bill_type"), payload.get("bill_type"), raw_data.get("bill_type"))
    raw_bill_number = first_present(seed.get("bill_number"), payload.get("bill_number"), raw_data.get("bill_number"))
    parsed_type, parsed_number = split_display_bill_number(raw_bill_number)

    bill_type_value = first_present(raw_bill_type, parsed_type, derive_bill_type_from_chamber(chamber))
    bill_type = normalize_bill_type(str(bill_type_value)) if bill_type_value is not None else None
    bill_number_value = first_present(parsed_number, raw_bill_number)
    bill_number = normalize_bill_number(bill_number_value) if bill_number_value is not None else None
    congress = first_present(seed.get("congress"), payload.get("congress"), raw_data.get("congress"))
    future_bill_id = first_present(seed.get("future_bill_id"), payload.get("future_bill_id"), raw_data.get("future_bill_id"))

    session_label = first_present(
        seed.get("session_label"),
        payload.get("session_label"),
        raw_data.get("session_label"),
    )
    if not session_label and congress not in (None, ""):
        session_label = session_label_for_congress(int(congress))

    display_bill_number = None
    if bill_type and bill_number:
        display_bill_number = build_bill_number_display(bill_type, bill_number)

    resolved_title, title_source = choose_best_text(title_candidates(seed, payload, raw_data), bill_number_fallback=display_bill_number)
    resolved_summary, summary_source = choose_best_text(summary_candidates(seed, payload, raw_data))
    metadata_source = title_source or summary_source or "seed_only"

    fetched = {}
    if enrich_metadata and (resolved_title is None or is_placeholder_title(resolved_title, display_bill_number)):
        fetched = fetched_metadata(
            {
                "congress": int(congress) if congress not in (None, "") else None,
                "bill_type": bill_type,
                "bill_number": bill_number,
                "normalized_bill_number": display_bill_number,
            },
            api_key,
        )
        fetched_title = fetched.get("resolved_title")
        if fetched_title and not is_placeholder_title(fetched_title, display_bill_number):
            resolved_title = fetched_title
            metadata_source = "fetched_helper"
        if not resolved_summary and fetched.get("resolved_official_summary"):
            resolved_summary = fetched["resolved_official_summary"]
            metadata_source = "fetched_helper"

    if not resolved_title:
        resolved_title = display_bill_number or (str(raw_bill_number).strip() if raw_bill_number not in (None, "") else None)

    review_context = review_context_from_seed(seed, payload, raw_data)

    return {
        "future_bill_id": int(future_bill_id) if future_bill_id not in (None, "") else None,
        "bill_number_raw": raw_bill_number,
        "bill_type": bill_type,
        "bill_number": bill_number,
        "normalized_bill_number": display_bill_number or (str(raw_bill_number).strip() if raw_bill_number not in (None, "") else None),
        "chamber": chamber,
        "congress": int(congress) if congress not in (None, "") else None,
        "jurisdiction": first_present(seed.get("jurisdiction"), payload.get("jurisdiction"), raw_data.get("jurisdiction"), "Federal"),
        "session_label": session_label,
        "resolved_title": resolved_title,
        "resolved_official_summary": resolved_summary,
        "link_type": infer_link_type({**seed, "payload": payload}),
        "link_notes": first_present(seed.get("link_notes"), payload.get("link_notes"), raw_data.get("link_notes")),
        "resolved_match_confidence": first_present(seed.get("match_confidence"), payload.get("match_confidence"), raw_data.get("match_confidence"), "Medium"),
        "resolved_source_system": first_present(seed.get("source_system"), payload.get("source_system"), raw_data.get("source_system"), "Approved review bundle import"),
        "active": bool(first_present(seed.get("active"), payload.get("active"), raw_data.get("active"), True)),
        "resolved_sponsor_name": first_present(seed.get("sponsor_name"), raw_data.get("sponsor_name"), payload.get("sponsor_name"), fetched.get("resolved_sponsor_name")),
        "resolved_sponsor_party": first_present(seed.get("sponsor_party"), raw_data.get("sponsor_party"), payload.get("sponsor_party"), fetched.get("resolved_sponsor_party")),
        "resolved_sponsor_state": first_present(seed.get("sponsor_state"), raw_data.get("sponsor_state"), payload.get("sponsor_state"), fetched.get("resolved_sponsor_state")),
        "resolved_bill_status": first_present(seed.get("bill_status"), payload.get("bill_status"), raw_data.get("bill_status"), fetched.get("resolved_bill_status"), "Tracked"),
        "last_action": first_present(seed.get("last_action"), payload.get("last_action"), raw_data.get("last_action"), fetched.get("last_action")),
        "introduced_date": first_present(seed.get("introduced_date"), payload.get("introduced_date"), raw_data.get("introduced_date"), fetched.get("introduced_date")),
        "latest_action_date": first_present(seed.get("latest_action_date"), payload.get("latest_action_date"), raw_data.get("latest_action_date"), fetched.get("latest_action_date")),
        "bill_url": first_present(seed.get("bill_url"), payload.get("bill_url"), raw_data.get("bill_url"), fetched.get("bill_url")),
        "metadata_source": metadata_source,
        **review_context,
        "raw_seed": seed,
    }


def bill_url_for_seed(congress: int, bill_type: str, bill_number: str, jurisdiction: str) -> str | None:
    if str(jurisdiction).lower() != "federal":
        return None
    return f"https://www.congress.gov/bill/{congress}th-congress/{bill_type.lower()}-bill/{bill_number}"


def validate_seed_row(row: dict[str, Any]) -> tuple[bool, str | None]:
    for field in ("congress", "bill_type", "bill_number", "normalized_bill_number", "session_label"):
        if row.get(field) in (None, ""):
            return False, f"missing required field: {field}"
    try:
        int(row["congress"])
    except (TypeError, ValueError):
        return False, "congress must be an integer"
    return True, None


def selected_seed_rows(
    rows: list[dict[str, Any]],
    *,
    only_future_bill_ids: set[int],
    only_bill_numbers: set[str],
) -> list[dict[str, Any]]:
    selected: list[dict[str, Any]] = []
    for row in rows:
        future_bill_id = row.get("future_bill_id")
        if only_future_bill_ids:
            if future_bill_id is None:
                continue
            try:
                if int(future_bill_id) not in only_future_bill_ids:
                    continue
            except (TypeError, ValueError):
                continue

        if only_bill_numbers:
            congress = row.get("congress")
            bill_type = row.get("bill_type")
            bill_number = row.get("bill_number")
            if bill_type in (None, "") or bill_number in (None, ""):
                continue
            display = row.get("normalized_bill_number") or build_bill_number_display(normalize_bill_type(str(bill_type)), normalize_bill_number(bill_number))
            candidates = {
                normalize_filter_bill_number(display),
                normalize_filter_bill_number(str(bill_number)),
            }
            if not candidates & only_bill_numbers:
                continue

        selected.append(row)
    return selected


def build_tracked_bill_row(seed: dict[str, Any]) -> dict[str, Any]:
    congress = int(seed["congress"])
    bill_type = normalize_bill_type(str(seed["bill_type"]))
    bill_number = normalize_bill_number(seed["bill_number"])
    jurisdiction = seed.get("jurisdiction") or "Federal"
    display_bill_number = seed.get("normalized_bill_number") or build_bill_number_display(bill_type, bill_number)
    title = seed.get("resolved_title") or display_bill_number

    return {
        "bill_number": display_bill_number,
        "title": title,
        "jurisdiction": jurisdiction,
        "chamber": seed.get("chamber"),
        "session_label": seed.get("session_label") or session_label_for_congress(congress),
        "sponsor_name": seed.get("resolved_sponsor_name"),
        "sponsor_party": seed.get("resolved_sponsor_party"),
        "sponsor_state": seed.get("resolved_sponsor_state"),
        "official_summary": seed.get("resolved_official_summary"),
        "bill_url": seed.get("bill_url") or bill_url_for_seed(congress, bill_type, bill_number, jurisdiction),
        "source_system": seed.get("resolved_source_system") or "Approved review bundle import",
        "bill_status": seed.get("resolved_bill_status") or "Tracked",
        "last_action": seed.get("last_action"),
        "introduced_date": seed.get("introduced_date"),
        "latest_action_date": seed.get("latest_action_date"),
        "active": 1 if seed.get("active", True) else 0,
        "match_confidence": seed.get("resolved_match_confidence") or "Medium",
        "impact_status": seed.get("impact_status"),
        "recommended_action": seed.get("recommended_action"),
        "confidence": seed.get("confidence"),
        "source_quality": seed.get("source_quality"),
    }


def fetch_existing_tracked_bill(cursor, row: dict[str, Any]) -> dict[str, Any] | None:
    cursor.execute(
        """
        SELECT
          id,
          bill_number,
          jurisdiction,
          session_label,
          title,
          chamber,
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
        FROM tracked_bills
        WHERE bill_number = %s
          AND jurisdiction = %s
          AND session_label = %s
        LIMIT 1
        """,
        (row["bill_number"], row["jurisdiction"], row["session_label"]),
    )
    exact = cursor.fetchone()
    if exact:
        return exact

    cursor.execute(
        """
        SELECT
          id,
          bill_number,
          jurisdiction,
          session_label,
          title,
          chamber,
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
        FROM tracked_bills
        WHERE bill_number = %s
          AND jurisdiction = %s
        ORDER BY (session_label = %s) DESC, id ASC
        LIMIT 1
        """,
        (row["bill_number"], row["jurisdiction"], row["session_label"]),
    )
    fallback = cursor.fetchone()
    if not fallback:
        return None
    if fallback.get("session_label") == row["session_label"]:
        return fallback
    return None


def maybe_update_existing_tracked_bill(
    cursor,
    tracked_bill_id: int,
    existing: dict[str, Any],
    row: dict[str, Any],
    *,
    apply_updates: bool = True,
) -> dict[str, Any]:
    assignments = []
    values: list[Any] = []
    updated_fields: list[str] = []
    preserved_existing_fields: list[dict[str, Any]] = []

    def maybe_fill(field: str) -> None:
        incoming = row.get(field)
        current = existing.get(field)
        if incoming and not current:
            assignments.append(f"{field} = %s")
            values.append(incoming)
            updated_fields.append(field)
        elif values_conflict(current, incoming):
            preserved_existing_fields.append(
                {
                    "field": field,
                    "existing_value": current,
                    "incoming_value": incoming,
                    "reason": "preserved populated existing tracked_bills field",
                }
            )

    for field in (
        "chamber",
        "source_system",
        "sponsor_name",
        "sponsor_party",
        "sponsor_state",
        "bill_url",
        "bill_status",
        "last_action",
        "introduced_date",
        "latest_action_date",
    ):
        maybe_fill(field)

    existing_title = existing.get("title")
    if row.get("title") and (not existing_title or is_placeholder_title(existing_title, row.get("bill_number"))):
        if not is_placeholder_title(row.get("title"), row.get("bill_number")):
            assignments.append("title = %s")
            values.append(row["title"])
            updated_fields.append("title")
    elif values_conflict(existing_title, row.get("title")):
        preserved_existing_fields.append(
            {
                "field": "title",
                "existing_value": existing_title,
                "incoming_value": row.get("title"),
                "reason": "preserved populated existing tracked_bills field",
            }
        )

    if row.get("official_summary") and not existing.get("official_summary"):
        assignments.append("official_summary = %s")
        values.append(row["official_summary"])
        updated_fields.append("official_summary")
    elif values_conflict(existing.get("official_summary"), row.get("official_summary")):
        preserved_existing_fields.append(
            {
                "field": "official_summary",
                "existing_value": existing.get("official_summary"),
                "incoming_value": row.get("official_summary"),
                "reason": "preserved populated existing tracked_bills field",
            }
        )

    if row.get("session_label") and not existing.get("session_label"):
        assignments.append("session_label = %s")
        values.append(row["session_label"])
        updated_fields.append("session_label")
    elif values_conflict(existing.get("session_label"), row.get("session_label")):
        preserved_existing_fields.append(
            {
                "field": "session_label",
                "existing_value": existing.get("session_label"),
                "incoming_value": row.get("session_label"),
                "reason": "preserved populated existing tracked_bills field",
            }
        )

    if existing.get("active") in (0, False) and row.get("active") in (1, True):
        assignments.append("active = %s")
        values.append(row["active"])
        updated_fields.append("active")

    if not existing.get("match_confidence") and row.get("match_confidence"):
        assignments.append("match_confidence = %s")
        values.append(row["match_confidence"])
        updated_fields.append("match_confidence")
    elif values_conflict(existing.get("match_confidence"), row.get("match_confidence")):
        preserved_existing_fields.append(
            {
                "field": "match_confidence",
                "existing_value": existing.get("match_confidence"),
                "incoming_value": row.get("match_confidence"),
                "reason": "preserved populated existing tracked_bills field",
            }
        )

    if not assignments:
        return {
            "updated": False,
            "updated_fields": [],
            "preserved_existing_fields": preserved_existing_fields,
        }

    if apply_updates:
        values.append(tracked_bill_id)
        cursor.execute(
            f"""
            UPDATE tracked_bills
            SET {", ".join(assignments)}
            WHERE id = %s
            """,
            tuple(values),
        )
    return {
        "updated": True,
        "updated_fields": updated_fields,
        "preserved_existing_fields": preserved_existing_fields,
    }


def insert_tracked_bill(cursor, row: dict[str, Any]) -> int:
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


def fetch_existing_future_bill_link(cursor, future_bill_id: int, tracked_bill_id: int) -> dict[str, Any] | None:
    cursor.execute(
        """
        SELECT id, link_type, notes
        FROM future_bill_links
        WHERE future_bill_id = %s AND tracked_bill_id = %s
        LIMIT 1
        """,
        (future_bill_id, tracked_bill_id),
    )
    return cursor.fetchone()


def should_upgrade_link(existing_type: str | None, incoming_type: str | None) -> bool:
    if not incoming_type:
        return False
    if not existing_type:
        return True
    return LINK_TYPE_STRENGTH.get(incoming_type, 0) > LINK_TYPE_STRENGTH.get(existing_type, 0)


def ensure_future_bill_link(
    cursor,
    *,
    future_bill_id: int,
    tracked_bill_id: int,
    link_type: str,
    notes: str | None,
) -> tuple[str, int, str]:
    existing = fetch_existing_future_bill_link(cursor, future_bill_id, tracked_bill_id)
    if existing:
        existing_type = normalize_link_type(existing.get("link_type"))
        if should_upgrade_link(existing_type, link_type):
            cursor.execute(
                """
                UPDATE future_bill_links
                SET link_type = %s,
                    notes = COALESCE(%s, notes)
                WHERE id = %s
                """,
                (link_type, notes, existing["id"]),
            )
            return "linked_existing", int(existing["id"]), f"updated existing future_bill_link from {existing_type} to {link_type}"
        return "linked_existing", int(existing["id"]), "future_bill_link already exists"

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
    return "linked_new", int(cursor.lastrowid), "created new future_bill_link"


def summarize_result(row: dict[str, Any]) -> str:
    tracked_bill_id = row.get("tracked_bill_id")
    future_bill_link_id = row.get("future_bill_link_id")
    parts = [
        str(row.get("tracked_bill_result") or "n/a"),
        str(row.get("link_result") or "n/a"),
    ]
    if tracked_bill_id is not None:
        parts.append(f"tracked_bill_id={tracked_bill_id}")
    if future_bill_link_id is not None:
        parts.append(f"future_bill_link_id={future_bill_link_id}")
    if row.get("reason"):
        parts.append(str(row["reason"]))
    return " | ".join(parts)


def main() -> None:
    args = parse_args()
    if args.apply and not args.yes:
        raise SystemExit("--apply requires --yes")

    input_path = args.input.resolve()
    output_path = args.output.resolve()
    csv_path = derive_csv_path(args.csv, output_path)

    seed_rows = load_seed_rows(input_path)
    api_key = get_api_key() if args.enrich_metadata else None
    normalized_seed_rows = [resolve_seed_metadata(row, enrich_metadata=args.enrich_metadata, api_key=api_key) for row in seed_rows]
    selected_rows = selected_seed_rows(
        normalized_seed_rows,
        only_future_bill_ids=set(args.only_future_bill_id or []),
        only_bill_numbers={normalize_filter_bill_number(value) for value in (args.only_bill_number or [])},
    )

    report_rows: list[dict[str, Any]] = []
    skipped_rows: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    inserted_new_tracked_bills = 0
    matched_existing_tracked_bills = 0
    linked_future_bills = 0
    existing_future_bill_links = 0
    metadata_enriched_rows = 0
    placeholder_titles_replaced = 0
    summaries_filled = 0
    fetch_enrichment_used_count = 0
    impact_pending_records = 0
    impact_pending_outcomes_deferred = 0
    impact_pending_existing_outcomes_preserved = 0
    existing_legislation_enriched = 0
    existing_actions_enriched = 0
    preserved_existing_fields = 0
    conflicts_detected = 0

    try:
        conn = get_db_connection()
    except Exception as exc:
        raise SystemExit(f"Unable to connect to the database for duplicate detection/import: {exc}") from exc
    try:
        with conn.cursor() as cursor:
            for seed in selected_rows:
                future_bill_id = seed.get("future_bill_id")
                raw_bill_number = seed.get("normalized_bill_number") or seed.get("bill_number")
                row_result = {
                    "future_bill_id": future_bill_id,
                    "bill_number": seed.get("bill_number"),
                    "normalized_bill_number": raw_bill_number,
                    "tracked_bill_result": None,
                    "link_result": None,
                    "tracked_bill_id": None,
                    "future_bill_link_id": None,
                    "title_before": None,
                    "title_after": seed.get("resolved_title"),
                    "summary_before": None,
                    "summary_after": seed.get("resolved_official_summary"),
                    "title_used": seed.get("resolved_title"),
                    "session_label_used": seed.get("session_label"),
                    "metadata_source": seed.get("metadata_source") or "seed_only",
                    "impact_status": seed.get("impact_status"),
                    "recommended_action": seed.get("recommended_action"),
                    "confidence": seed.get("confidence"),
                    "source_quality": seed.get("source_quality"),
                    "impact_pending": False,
                    "impact_pending_note": None,
                    "enriched_fields": [],
                    "preserved_existing_fields": [],
                    "reason": None,
                }
                impact_pending = is_impact_pending_import(seed)
                if impact_pending:
                    impact_pending_records += 1
                    impact_pending_outcomes_deferred += 1
                    row_result["impact_pending"] = True
                    row_result["impact_pending_note"] = (
                        "Legislative record may import as verified policy/action metadata; "
                        "impact outcome scoring is deferred until measurable evidence exists."
                    )

                valid, validation_error = validate_seed_row(seed)
                if not valid:
                    row_result["tracked_bill_result"] = "skipped"
                    row_result["link_result"] = "link_skipped_invalid_seed"
                    row_result["reason"] = validation_error
                    report_rows.append(row_result)
                    skipped_rows.append(row_result)
                    continue

                try:
                    tracked_bill_row = build_tracked_bill_row(seed)
                    existing = fetch_existing_tracked_bill(cursor, tracked_bill_row)
                    tracked_bill_id: int | None = None

                    if existing:
                        tracked_bill_id = int(existing["id"])
                        row_result["tracked_bill_id"] = tracked_bill_id
                        row_result["title_before"] = existing.get("title")
                        row_result["summary_before"] = existing.get("official_summary")
                        update_plan = maybe_update_existing_tracked_bill(
                            cursor,
                            tracked_bill_id,
                            existing,
                            tracked_bill_row,
                            apply_updates=args.apply,
                        )
                        row_result["enriched_fields"] = update_plan["updated_fields"]
                        row_result["preserved_existing_fields"] = update_plan["preserved_existing_fields"]
                        preserved_existing_fields += len(update_plan["preserved_existing_fields"])
                        conflicts_detected += len(update_plan["preserved_existing_fields"])
                        if update_plan["updated"]:
                            existing_legislation_enriched += 1
                        if args.apply:
                            row_result["reason"] = (
                                "matched existing tracked bill; updated low-risk metadata"
                                if update_plan["updated"]
                                else "matched existing tracked bill"
                            )
                        else:
                            row_result["reason"] = (
                                "would match existing tracked bill; would fill missing metadata"
                                if update_plan["updated"]
                                else "would match existing tracked bill"
                            )
                        row_result["tracked_bill_result"] = "matched_existing"
                        if not update_plan["updated"]:
                            row_result["metadata_source"] = "unchanged_existing"
                        matched_existing_tracked_bills += 1
                    else:
                        row_result["title_before"] = None
                        row_result["summary_before"] = None
                        if args.apply:
                            tracked_bill_id = insert_tracked_bill(cursor, tracked_bill_row)
                            row_result["tracked_bill_id"] = tracked_bill_id
                            row_result["tracked_bill_result"] = "inserted_new"
                            row_result["reason"] = "inserted tracked_bills row"
                            inserted_new_tracked_bills += 1
                        else:
                            row_result["tracked_bill_result"] = "dry_run_insert"
                            row_result["reason"] = "would insert tracked_bills row"

                    if args.link_imported_bills:
                        link_type = normalize_link_type(seed.get("link_type"))
                        if future_bill_id in (None, ""):
                            row_result["link_result"] = "link_skipped_missing_future_bill_id"
                            row_result["reason"] = f"{row_result['reason']}; missing future_bill_id for linking" if row_result["reason"] else "missing future_bill_id for linking"
                        elif not link_type:
                            row_result["link_result"] = "link_skipped_missing_link_type"
                            row_result["reason"] = f"{row_result['reason']}; missing link_type for linking" if row_result["reason"] else "missing link_type for linking"
                        elif tracked_bill_id is None:
                            row_result["link_result"] = "link_skipped_missing_tracked_bill_id"
                            row_result["reason"] = f"{row_result['reason']}; dry-run insert has no tracked_bill_id yet; linking skipped" if row_result["reason"] else "dry-run insert has no tracked_bill_id yet; linking skipped"
                        elif args.apply:
                            try:
                                link_result, future_bill_link_id, link_reason = ensure_future_bill_link(
                                    cursor,
                                    future_bill_id=int(future_bill_id),
                                    tracked_bill_id=tracked_bill_id,
                                    link_type=link_type,
                                    notes=seed.get("link_notes"),
                                )
                                row_result["future_bill_link_id"] = future_bill_link_id
                                row_result["link_result"] = link_result
                                prior_reason = row_result.get("reason")
                                row_result["reason"] = f"{prior_reason}; {link_reason}" if prior_reason else link_reason
                                if link_result == "linked_new":
                                    linked_future_bills += 1
                                elif link_result == "linked_existing":
                                    existing_future_bill_links += 1
                                    if link_reason.startswith("updated existing"):
                                        existing_actions_enriched += 1
                            except Exception as exc:
                                row_result["link_result"] = "link_skipped_db_constraint"
                                row_result["reason"] = f"{row_result['reason']}; {exc}" if row_result["reason"] else str(exc)
                        else:
                            row_result["link_result"] = "linked_new"
                            row_result["reason"] = f"{row_result['reason']}; would ensure {link_type} future_bill_link" if row_result["reason"] else f"would ensure {link_type} future_bill_link"
                    else:
                        row_result["link_result"] = "link_skipped_not_requested"

                    report_rows.append(row_result)
                    if row_result["metadata_source"] == "fetched_helper":
                        fetch_enrichment_used_count += 1
                    if row_result["metadata_source"] != "unchanged_existing":
                        metadata_enriched_rows += 1
                    if is_placeholder_title(row_result.get("title_before"), row_result.get("normalized_bill_number")) and not is_placeholder_title(row_result.get("title_after"), row_result.get("normalized_bill_number")):
                        placeholder_titles_replaced += 1
                    if not row_result.get("summary_before") and row_result.get("summary_after"):
                        summaries_filled += 1
                except Exception as exc:
                    error_row = {
                        **row_result,
                        "tracked_bill_result": "error",
                        "link_result": row_result.get("link_result") or "link_skipped_invalid_seed",
                        "reason": str(exc),
                    }
                    report_rows.append(error_row)
                    errors.append(error_row)

            if args.apply:
                conn.commit()
            else:
                conn.rollback()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    report = {
        "generated_at": datetime.now(UTC).isoformat(),
        "mode": "apply" if args.apply else "dry_run",
        "input_file": str(input_path),
        "link_imported_bills": bool(args.link_imported_bills),
        "rows_seen": len(seed_rows),
        "rows_selected": len(selected_rows),
        "inserted_new_tracked_bills": inserted_new_tracked_bills,
        "matched_existing_tracked_bills": matched_existing_tracked_bills,
        "linked_future_bills": linked_future_bills,
        "existing_future_bill_links": existing_future_bill_links,
        "metadata_enriched_rows": metadata_enriched_rows,
        "placeholder_titles_replaced": placeholder_titles_replaced,
        "summaries_filled": summaries_filled,
        "fetch_enrichment_used_count": fetch_enrichment_used_count,
        "impact_pending_records": impact_pending_records,
        "impact_pending_outcomes_deferred": impact_pending_outcomes_deferred,
        "impact_pending_existing_outcomes_preserved": impact_pending_existing_outcomes_preserved,
        "existing_legislation_enriched": existing_legislation_enriched,
        "existing_actions_enriched": existing_actions_enriched,
        "preserved_existing_fields": preserved_existing_fields,
        "conflicts_detected": conflicts_detected,
        "impact_pending_note": (
            "Legislative tracked-bill import does not write finalized impact outcomes; "
            "impact_status=impact_pending records are imported as policy/action metadata only."
        ),
        "skipped_rows": len(skipped_rows),
        "errors": errors,
        "processed_rows": report_rows,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2, default=str) + "\n")

    print(f"Mode: {report['mode']}")
    print(f"Rows seen: {report['rows_seen']}")
    print(f"Rows selected: {report['rows_selected']}")
    print(f"Inserted new tracked bills: {inserted_new_tracked_bills}")
    print(f"Matched existing tracked bills: {matched_existing_tracked_bills}")
    print(f"Future bill links created: {linked_future_bills}")
    print(f"Existing future bill links: {existing_future_bill_links}")
    print(f"Metadata-enriched rows: {metadata_enriched_rows}")
    print(f"Placeholder titles replaced: {placeholder_titles_replaced}")
    print(f"Summaries filled: {summaries_filled}")
    print(f"Fetch enrichment used: {fetch_enrichment_used_count}")
    print(f"Impact-pending records: {impact_pending_records}")
    print(f"Impact-pending outcomes deferred: {impact_pending_outcomes_deferred}")
    print(f"Impact-pending existing outcomes preserved: {impact_pending_existing_outcomes_preserved}")
    print(f"Existing legislation enriched: {existing_legislation_enriched}")
    print(f"Existing actions enriched: {existing_actions_enriched}")
    print(f"Preserved existing fields: {preserved_existing_fields}")
    print(f"Conflicts detected: {conflicts_detected}")
    print(f"Skipped: {len(skipped_rows)}")
    print(f"Errors: {len(errors)}")
    for row in report_rows:
        print(f"- future_bill_id={row.get('future_bill_id')} bill_number={row.get('bill_number')} | {summarize_result(row)}")
    print(f"Wrote import report to {output_path}")

    if csv_path:
        fieldnames = [
            "future_bill_id",
            "bill_number",
            "normalized_bill_number",
            "tracked_bill_result",
            "link_result",
            "tracked_bill_id",
            "future_bill_link_id",
            "title_before",
            "title_after",
            "summary_before",
            "summary_after",
            "title_used",
            "session_label_used",
            "metadata_source",
            "impact_status",
            "recommended_action",
            "confidence",
            "source_quality",
            "impact_pending",
            "impact_pending_note",
            "enriched_fields",
            "preserved_existing_fields",
            "reason",
        ]
        with csv_path.open("w", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fieldnames)
            writer.writeheader()
            for row in report_rows:
                writer.writerow({key: row.get(key) for key in fieldnames})
        print(f"Wrote import report CSV to {csv_path}")


if __name__ == "__main__":
    main()
