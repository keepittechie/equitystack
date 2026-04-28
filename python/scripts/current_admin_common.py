#!/usr/bin/env python3
import csv
import json
import os
import re
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


DEFAULT_CURRENT_ADMIN_REPORTS_DIRNAME = "current_admin"
AUTO_APPROVED_QUEUE_KEY = "auto_approved_items"
AUTO_REJECTED_QUEUE_KEY = "auto_rejected_items"
VALID_PROMISE_STATUSES = {"In Progress", "Partial", "Delivered", "Blocked", "Failed"}
VALID_PROMISE_TYPES = {"Campaign Promise", "Official Promise", "Public Promise", "Executive Agenda", "Other"}
VALID_CAMPAIGN_OR_OFFICIAL_VALUES = {"Campaign", "Official"}
VALID_IMPACT_DIRECTIONS = {"Positive", "Negative", "Mixed", "Blocked"}
VALID_EVIDENCE_STRENGTHS = {"Strong", "Moderate", "Limited"}
VALID_SOURCE_TYPES = {"Government", "Academic", "News", "Archive", "Nonprofit", "Other"}
VALID_ACTION_TYPES = {
    "Executive Order",
    "Bill",
    "Policy",
    "Agency Action",
    "Court-Related Action",
    "Public Reversal",
    "Statement",
    "Other",
}
DEFAULT_DISCOVERY_PROMISE_TYPE = "Official Promise"
DEFAULT_DISCOVERY_CAMPAIGN_OR_OFFICIAL = "Official"
DB_ENV_KEYS = ("DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME")
DEFAULT_DB_SETTINGS = {
    "DB_HOST": "127.0.0.1",
    "DB_PORT": "3306",
    "DB_USER": "root",
    "DB_PASSWORD": "",
    "DB_NAME": "black_policy_tracker",
}


def get_project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def get_python_dir() -> Path:
    return get_project_root() / "python"


def get_reports_dir() -> Path:
    return get_python_dir() / "reports"


def get_current_admin_reports_dir() -> Path:
    return get_reports_dir() / DEFAULT_CURRENT_ADMIN_REPORTS_DIRNAME


def get_current_admin_batches_dir() -> Path:
    return get_python_dir() / "data" / "current_admin_batches"


def load_env_file(env_path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not env_path.exists():
        return values

    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")

    return values


def get_db_env_values() -> dict[str, str]:
    values, _ = get_db_env_values_with_sources()
    return values


def get_db_env_values_with_sources() -> tuple[dict[str, str], dict[str, str]]:
    env_path = get_project_root() / ".env.local"
    file_values = load_env_file(env_path)
    values: dict[str, str] = {}
    sources: dict[str, str] = {}
    for key in DB_ENV_KEYS:
        if os.environ.get(key):
            values[key] = os.environ[key]
            sources[key] = "environment"
        elif key in file_values:
            values[key] = file_values[key]
            sources[key] = str(env_path)
        else:
            values[key] = DEFAULT_DB_SETTINGS[key]
            sources[key] = "default"
    return values, sources


def describe_db_connection_settings() -> dict[str, str]:
    env_values, env_sources = get_db_env_values_with_sources()
    return {
        "host": env_values["DB_HOST"],
        "port": env_values["DB_PORT"],
        "database": env_values["DB_NAME"],
        "host_source": env_sources["DB_HOST"],
        "port_source": env_sources["DB_PORT"],
        "database_source": env_sources["DB_NAME"],
    }


def get_db_connection():
    import pymysql

    env_values, env_sources = get_db_env_values_with_sources()
    connection_kwargs = {
        "host": env_values["DB_HOST"],
        "port": int(env_values["DB_PORT"]),
        "user": env_values["DB_USER"],
        "password": env_values["DB_PASSWORD"],
        "database": env_values["DB_NAME"],
        "charset": "utf8mb4",
        "cursorclass": pymysql.cursors.DictCursor,
        "autocommit": False,
    }
    try:
        return pymysql.connect(**connection_kwargs)
    except Exception as exc:
        raise RuntimeError(
            "Current-admin DB connection failed "
            f"(host={connection_kwargs['host']}, port={connection_kwargs['port']}, "
            f"database={connection_kwargs['database']}, host_source={env_sources['DB_HOST']}). "
            "Override the host with DB_HOST=<reachable-host> ./bin/equitystack current-admin status "
            f"if localhost is not valid here. Original error: {exc}"
        ) from exc


def utc_timestamp() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


def normalize_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def normalize_nullable_text(value: Any) -> str | None:
    text = normalize_text(value)
    return text or None


NEGATED_BLACK_SCOPE_PHRASES = (
    "no black-community-specific effect",
    "no black community specific effect",
    "no black-community effect",
    "no direct or indirect evidence of impact on black americans",
    "no direct evidence of impact on black americans",
    "no information about how or whether this action affects black americans",
    "no evidence of impact on black americans",
)


def has_affirmative_black_scope_text(value: Any) -> bool:
    text = normalize_nullable_text(value)
    if text is None:
        return False
    lowered = text.lower()
    if "black" not in lowered:
        return False
    return not any(phrase in lowered for phrase in NEGATED_BLACK_SCOPE_PHRASES)


def record_has_affirmative_black_scope(record: dict[str, Any]) -> bool:
    if has_affirmative_black_scope_text(record.get("impacted_group")):
        return True
    if has_affirmative_black_scope_text(record.get("notes")):
        return True

    for action in record.get("actions") or []:
        if not isinstance(action, dict):
            continue
        for outcome in action.get("outcomes") or []:
            if not isinstance(outcome, dict):
                continue
            if has_affirmative_black_scope_text(outcome.get("black_community_impact_note")):
                return True

    return False


def merge_record_with_suggestions(
    record: dict[str, Any],
    suggestions: dict[str, Any],
    prefill: bool = False,
) -> dict[str, Any]:
    merged = dict(record)
    impact_status = normalize_nullable_text(suggestions.get("impact_status"))
    if impact_status:
        merged["impact_status"] = impact_status
        if impact_status == "impact_pending":
            merged["impact_pending_reason"] = normalize_nullable_text(
                suggestions.get("impact_status_reason")
            )
    if not prefill:
        return merged

    field_map = {
        "title_normalized": "title",
        "summary_suggestion": "summary",
        "topic_suggestion": "topic",
        "impacted_group_suggestion": "impacted_group",
        "status_suggestion": "status",
    }

    for suggestion_field, record_field in field_map.items():
        value = normalize_nullable_text(suggestions.get(suggestion_field))
        if value:
            merged[record_field] = value

    first_outcome = (((merged.get("actions") or [{}])[0]).get("outcomes") or [{}])[0]
    if first_outcome:
        direction = normalize_nullable_text(suggestions.get("impact_direction_suggestion"))
        evidence = normalize_nullable_text(suggestions.get("evidence_strength_suggestion"))
        if direction:
            first_outcome["impact_direction"] = direction
        if evidence:
            first_outcome["evidence_strength"] = evidence

    return merged


def queue_manual_items(payload: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        item
        for item in payload.get("items") or []
        if isinstance(item, dict)
    ]


def queue_auto_approved_items(payload: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        item
        for item in payload.get(AUTO_APPROVED_QUEUE_KEY) or []
        if isinstance(item, dict)
    ]


def queue_auto_rejected_items(payload: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        item
        for item in payload.get(AUTO_REJECTED_QUEUE_KEY) or []
        if isinstance(item, dict)
    ]


def queue_review_coverage_items(payload: dict[str, Any]) -> list[dict[str, Any]]:
    return (
        queue_manual_items(payload)
        + queue_auto_approved_items(payload)
        + queue_auto_rejected_items(payload)
    )


def queue_import_candidate_items(payload: dict[str, Any]) -> list[dict[str, Any]]:
    approved_manual_items = [
        item
        for item in queue_manual_items(payload)
        if item.get("approved") or item.get("operator_status") == "approved"
    ]
    return queue_auto_approved_items(payload) + approved_manual_items


def normalize_slug(value: Any) -> str:
    return (
        normalize_text(value)
        .lower()
        .replace("&", " and ")
        .replace("/", " ")
        .replace("'", "")
    )


def slugify(value: Any) -> str:
    return (
        re.sub(r"-{2,}", "-", re.sub(r"[^a-z0-9]+", "-", normalize_slug(value)))
        .strip("-")
    )


def normalize_date(value: Any) -> str | None:
    if value in (None, ""):
        return None
    text = str(value).strip()
    if len(text) >= 10:
        return text[:10]
    return text or None


def normalize_source_type(value: Any, url: Any = None, publisher: Any = None) -> str:
    text = normalize_nullable_text(value)
    if text in VALID_SOURCE_TYPES:
        return text

    normalized = (text or "").lower()
    parsed = urlparse(normalize_nullable_text(url) or "")
    hostname = (parsed.netloc or "").lower()
    if hostname.startswith("www."):
        hostname = hostname[4:]
    publisher_text = (normalize_nullable_text(publisher) or "").lower()

    government_host = (
        hostname.endswith(".gov")
        or hostname in {
            "congress.gov",
            "govinfo.gov",
            "whitehouse.gov",
            "ustr.gov",
            "federalregister.gov",
        }
    )
    if government_host:
        return "Government"

    if hostname in {"archives.gov", "loc.gov"}:
        return "Archive"
    if hostname.endswith(".edu"):
        return "Academic"
    if hostname.endswith(".org"):
        return "Nonprofit"

    if any(
        token in normalized
        for token in (
            "white house",
            "government",
            "federal register",
            "official",
        )
    ) or any(
        token in publisher_text
        for token in (
            "white house",
            "federal register",
            "united states",
            "u.s. ",
            "department of",
            "office of",
            "agency",
        )
    ):
        return "Government"

    if "archive" in normalized:
        return "Archive"
    if "academic" in normalized or "research" in normalized:
        return "Academic"
    if "news" in normalized or "media" in normalized:
        return "News"
    if "nonprofit" in normalized or "ngo" in normalized:
        return "Nonprofit"
    return "Other"


def normalize_action_type(value: Any, title: Any = None) -> str:
    text = normalize_nullable_text(value)
    title_text = (normalize_nullable_text(title) or "").lower()
    normalized = (text or "").lower()

    if text in VALID_ACTION_TYPES:
        return text

    if "court" in normalized or "lawsuit" in normalized or "ruling" in normalized or "injunction" in normalized:
        return "Court-Related Action"
    if "court" in title_text or "lawsuit" in title_text or "ruling" in title_text or "injunction" in title_text:
        return "Court-Related Action"

    if "bill" in normalized or "bill signed" in title_text or "signed into law" in title_text:
        return "Bill"

    if "veto" in normalized or "reversal" in normalized or "rescission" in normalized:
        return "Public Reversal"
    if "veto" in title_text or "reversal" in title_text or "rescission" in title_text:
        return "Public Reversal"

    if "statement" in normalized or "press release" in normalized or "readout" in normalized or "remarks" in normalized:
        return "Statement"
    if any(token in title_text for token in ("statement", "readout", "remarks", "press release", "speech", "interview")):
        return "Statement"

    if "executive order" in normalized or "executive order" in title_text:
        return "Executive Order"

    if normalized in {
        "proclamation",
        "memorandum",
        "presidential memorandum",
        "presidential document",
        "executive action",
    }:
        return "Executive Order"

    if any(
        token in title_text
        for token in (
            "proclamation",
            "memorandum",
            "presidential determination",
            "presidential action",
            "national security presidential memorandum",
        )
    ):
        return "Executive Order"

    if normalized in {
        "federal register notice",
        "federal register rule",
        "federal register proposed rule",
        "federal register document",
        "agency action",
        "trade investigation",
    }:
        return "Agency Action"
    if any(
        token in title_text
        for token in (
            "federal register",
            "section 232",
            "section 301",
            "investigation",
            "notice of",
            "rule",
        )
    ):
        return "Agency Action"

    if normalized in {
        "fact sheet",
        "trade update",
        "trade agreement / policy coordination",
        "policy",
    }:
        return "Policy"
    if any(
        token in title_text
        for token in (
            "fact sheet",
            "trade",
            "tariff",
            "action plan",
            "supply chain",
        )
    ):
        return "Policy"

    if normalized == "other":
        return "Other"

    return "Policy"


def ensure_parent_dir(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def load_json_file(path: Path) -> Any:
    return json.loads(path.read_text())


def write_json_file(path: Path, payload: Any) -> None:
    ensure_parent_dir(path)
    path.write_text(f"{json.dumps(payload, indent=2)}\n")


def derive_csv_path(csv_arg: str | None, output_path: Path) -> Path | None:
    if csv_arg is None:
        return None
    if csv_arg == "":
        return output_path.with_suffix(".csv")
    return Path(csv_arg).resolve()


def write_csv_rows(path: Path, rows: list[dict[str, Any]]) -> None:
    ensure_parent_dir(path)
    if not rows:
        path.write_text("")
        return
    fieldnames = []
    seen = set()
    for row in rows:
        for key in row.keys():
            if key not in seen:
                seen.add(key)
                fieldnames.append(key)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def require_apply_confirmation(apply: bool, yes: bool) -> None:
    if apply and not yes:
        raise SystemExit("--apply requires --yes")


def resolve_default_report_path(batch_name: str, suffix: str) -> Path:
    return get_current_admin_reports_dir() / f"{batch_name}.{suffix}.json"


def short_description(value: Any) -> str:
    return normalize_text(value).lower()[:160]


def map_evidence_strength(value: Any) -> str | None:
    normalized = normalize_nullable_text(value)
    if normalized is None:
        return None
    if normalized == "Weak":
        return "Limited"
    return normalized


def read_batch_payload(path: Path) -> dict[str, Any]:
    payload = load_json_file(path)
    if not isinstance(payload, dict):
        raise ValueError("Batch file must be a JSON object")
    if not isinstance(payload.get("records"), list):
        raise ValueError("Batch file must contain a records array")
    return payload


def print_json(payload: Any) -> None:
    sys.stdout.write(f"{json.dumps(payload, indent=2)}\n")
