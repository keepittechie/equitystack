#!/usr/bin/env python3
"""Safely archive stale operator workflow session artifacts.

This command intentionally marks sessions inactive instead of deleting files.
It is meant for production operator cleanup where stale sessions should stop
showing as active, but history must remain auditable.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any


TEST_SESSION_MARKERS = (
    "current-admin-wrapper-test",
    "wrapper-test",
    ":test",
    "-test",
)
BLOCKED_STATES = {"BLOCKED", "FAILED", "ERROR"}


@dataclass(frozen=True)
class SessionRecord:
    path: Path
    payload: dict[str, Any]
    updated_at: datetime | None

    @property
    def session_id(self) -> str:
        return str(self.payload.get("id") or self.path.stem)

    @property
    def active(self) -> bool:
        return self.payload.get("active") is True

    @property
    def canonical_state(self) -> str:
        return str(self.payload.get("canonicalState") or "").strip()


def default_python_dir() -> Path:
    return Path(__file__).resolve().parents[1]


def parse_timestamp(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    raw = value.strip()
    if raw.endswith("Z"):
        raw = f"{raw[:-1]}+00:00"
    try:
        parsed = datetime.fromisoformat(raw)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def load_sessions(sessions_dir: Path) -> tuple[list[SessionRecord], list[dict[str, str]]]:
    records: list[SessionRecord] = []
    errors: list[dict[str, str]] = []
    if not sessions_dir.exists():
        return records, errors

    for path in sorted(sessions_dir.glob("*.json")):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:  # pragma: no cover - defensive report path
            errors.append({"path": str(path), "error": str(exc)})
            continue
        if not isinstance(payload, dict):
            errors.append({"path": str(path), "error": "session payload is not an object"})
            continue
        records.append(SessionRecord(path=path, payload=payload, updated_at=parse_timestamp(payload.get("updatedAt"))))
    return records, errors


def session_text(record: SessionRecord) -> str:
    values = [
        record.session_id,
        record.payload.get("canonicalSessionKey"),
        record.payload.get("workflowFamily"),
        record.payload.get("title"),
        record.payload.get("summary"),
    ]
    return " ".join(str(value) for value in values if value is not None).lower()


def is_test_session(record: SessionRecord) -> bool:
    text = session_text(record)
    return any(marker in text for marker in TEST_SESSION_MARKERS)


def latest_active_by_id(records: list[SessionRecord]) -> dict[str, SessionRecord]:
    latest: dict[str, SessionRecord] = {}
    for record in records:
        if not record.active:
            continue
        current = latest.get(record.session_id)
        if current is None:
            latest[record.session_id] = record
            continue
        record_ts = record.updated_at or datetime.min.replace(tzinfo=UTC)
        current_ts = current.updated_at or datetime.min.replace(tzinfo=UTC)
        if (record_ts, record.path.name) > (current_ts, current.path.name):
            latest[record.session_id] = record
    return latest


def summarize_record(record: SessionRecord, reasons: list[str]) -> dict[str, Any]:
    return {
        "path": str(record.path),
        "id": record.session_id,
        "workflowFamily": record.payload.get("workflowFamily"),
        "canonicalSessionKey": record.payload.get("canonicalSessionKey"),
        "canonicalState": record.payload.get("canonicalState"),
        "active": record.payload.get("active"),
        "updatedAt": record.payload.get("updatedAt"),
        "summary": record.payload.get("summary"),
        "matched_rules": reasons,
    }


def select_cleanup_candidates(
    records: list[SessionRecord],
    *,
    now: datetime,
    older_than_days: int,
    explicit_session_ids: set[str],
    excluded_session_ids: set[str],
    include_test_sessions: bool,
    include_duplicate_sessions: bool,
    include_blocked: bool,
) -> tuple[list[tuple[SessionRecord, list[str]]], list[dict[str, Any]]]:
    cutoff = now - timedelta(days=older_than_days)
    latest_by_id = latest_active_by_id(records)
    candidates: list[tuple[SessionRecord, list[str]]] = []
    skipped: list[dict[str, Any]] = []

    for record in records:
        reasons: list[str] = []
        if record.session_id in excluded_session_ids:
            skipped.append({**summarize_record(record, []), "skip_reason": "excluded_session"})
            continue
        if not record.active:
            skipped.append({**summarize_record(record, []), "skip_reason": "already_inactive"})
            continue

        if explicit_session_ids:
            if record.session_id in explicit_session_ids:
                reasons.append("explicit_session_id")
            else:
                skipped.append({**summarize_record(record, []), "skip_reason": "not_explicitly_selected"})
                continue
        else:
            if include_test_sessions and is_test_session(record):
                reasons.append("test_session")

            if include_duplicate_sessions:
                latest = latest_by_id.get(record.session_id)
                if latest is not None and latest.path != record.path:
                    reasons.append("older_duplicate_active_session")

            if include_blocked and record.canonical_state.upper() in BLOCKED_STATES:
                if record.updated_at is None or record.updated_at <= cutoff:
                    reasons.append("stale_blocked_session")

        if reasons:
            candidates.append((record, reasons))
        else:
            skipped.append({**summarize_record(record, []), "skip_reason": "no_cleanup_rule_matched"})

    return candidates, skipped


def archive_session(record: SessionRecord, reasons: list[str], *, now: datetime, archive_reason: str) -> None:
    payload = dict(record.payload)
    payload["active"] = False
    payload["archivedAt"] = now.isoformat().replace("+00:00", "Z")
    payload["archivedReason"] = archive_reason
    payload["archivedBy"] = "cleanup_stale_operator_workflows.py"
    payload["cleanupMetadata"] = {
        "previousActive": record.payload.get("active"),
        "previousCanonicalState": record.payload.get("canonicalState"),
        "previousUpdatedAt": record.payload.get("updatedAt"),
        "matchedRules": reasons,
        "cleanupAppliedAt": now.isoformat().replace("+00:00", "Z"),
    }
    record.path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def build_parser() -> argparse.ArgumentParser:
    python_dir = default_python_dir()
    parser = argparse.ArgumentParser(description="Mark stale operator workflow sessions inactive without deleting history.")
    parser.add_argument(
        "--sessions-dir",
        default=str(python_dir / "reports" / "admin_operator_command_center" / "workflow_sessions"),
        help="Directory containing operator workflow session JSON artifacts.",
    )
    parser.add_argument(
        "--report-output",
        default="",
        help="Optional cleanup report output path. Defaults to reports/admin_operator_command_center/stale_workflow_cleanup_<timestamp>.json.",
    )
    parser.add_argument("--older-than-days", type=int, default=3, help="Age threshold for stale blocked sessions.")
    parser.add_argument("--session-id", action="append", default=[], help="Explicit session id to archive. May be repeated.")
    parser.add_argument("--exclude-session", action="append", default=[], help="Session id to keep even if rules match. May be repeated.")
    parser.add_argument("--no-test-sessions", action="store_true", help="Do not auto-select obvious test sessions.")
    parser.add_argument("--no-duplicate-sessions", action="store_true", help="Do not auto-select older active duplicate session ids.")
    parser.add_argument("--no-blocked", action="store_true", help="Do not auto-select older blocked/failed sessions.")
    parser.add_argument("--reason", default="stale operator workflow cleanup", help="Audit reason stored on archived sessions.")
    parser.add_argument("--dry-run", action="store_true", help="Preview cleanup without writing session changes.")
    parser.add_argument("--apply", action="store_true", help="Write session changes.")
    parser.add_argument("--yes", action="store_true", help="Required with --apply.")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    if args.older_than_days < 0:
        raise SystemExit("--older-than-days must be >= 0")
    if args.apply and args.dry_run:
        raise SystemExit("Use either --dry-run or --apply --yes, not both.")
    if args.apply and not args.yes:
        raise SystemExit("--apply requires --yes")

    now = datetime.now(UTC)
    sessions_dir = Path(args.sessions_dir).expanduser().resolve()
    records, load_errors = load_sessions(sessions_dir)
    candidates, skipped = select_cleanup_candidates(
        records,
        now=now,
        older_than_days=args.older_than_days,
        explicit_session_ids=set(args.session_id),
        excluded_session_ids=set(args.exclude_session),
        include_test_sessions=not args.no_test_sessions,
        include_duplicate_sessions=not args.no_duplicate_sessions,
        include_blocked=not args.no_blocked,
    )

    applied = bool(args.apply)
    if applied:
        for record, reasons in candidates:
            archive_session(record, reasons, now=now, archive_reason=args.reason)

    report_dir = sessions_dir.parent
    timestamp = now.strftime("%Y%m%dT%H%M%SZ")
    report_output = Path(args.report_output).expanduser() if args.report_output else report_dir / f"stale_workflow_cleanup_{timestamp}.json"
    if not report_output.is_absolute():
        report_output = (Path.cwd() / report_output).resolve()
    report_output.parent.mkdir(parents=True, exist_ok=True)

    report = {
        "workflow": "operator_stale_workflow_cleanup",
        "generated_at": now.isoformat().replace("+00:00", "Z"),
        "mode": "apply" if applied else "dry_run",
        "sessions_dir": str(sessions_dir),
        "report_output": str(report_output),
        "rules": {
            "older_than_days": args.older_than_days,
            "include_test_sessions": not args.no_test_sessions,
            "include_duplicate_sessions": not args.no_duplicate_sessions,
            "include_blocked": not args.no_blocked,
            "explicit_session_ids": args.session_id,
            "excluded_session_ids": args.exclude_session,
        },
        "counts": {
            "sessions_scanned": len(records),
            "candidate_count": len(candidates),
            "archived_count": len(candidates) if applied else 0,
            "skipped_count": len(skipped),
            "load_error_count": len(load_errors),
        },
        "candidates": [summarize_record(record, reasons) for record, reasons in candidates],
        "skipped": skipped,
        "load_errors": load_errors,
    }
    report_output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
