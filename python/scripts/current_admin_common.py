#!/usr/bin/env python3
import csv
import json
import os
import re
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pymysql


DEFAULT_CURRENT_ADMIN_REPORTS_DIRNAME = "current_admin"
VALID_PROMISE_STATUSES = {"In Progress", "Partial", "Delivered", "Blocked", "Failed"}
VALID_IMPACT_DIRECTIONS = {"Positive", "Negative", "Mixed", "Blocked"}
VALID_EVIDENCE_STRENGTHS = {"Strong", "Moderate", "Limited"}


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
    values = load_env_file(get_project_root() / ".env.local")
    for key in ("DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME"):
        if os.environ.get(key):
            values[key] = os.environ[key]
    return values


def get_db_connection():
    env_values = get_db_env_values()
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


def utc_timestamp() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


def normalize_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def normalize_nullable_text(value: Any) -> str | None:
    text = normalize_text(value)
    return text or None


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
