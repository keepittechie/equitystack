#!/usr/bin/env python3
from pathlib import Path
from typing import Any

from current_admin_common import (
    get_current_admin_reports_dir,
    load_json_file,
    normalize_nullable_text,
    write_json_file,
)


ARTIFACT_VERSION = 2
OUTCOME_EVIDENCE_SUFFIX = "outcome-evidence"
OUTCOME_EVIDENCE_BATCH_SUFFIX = ".outcome-evidence.json"


def batch_name_from_input(path: Path, payload: dict[str, Any] | None = None) -> str:
    if isinstance(payload, dict):
        batch_name = normalize_nullable_text(payload.get("batch_name"))
        if batch_name:
            return batch_name
    stem = path.stem
    for suffix in (
        ".manual-review-queue",
        ".normalized",
        ".ai-review",
        ".decision-template",
        ".pre-commit-review",
        ".import-dry-run",
        ".import-apply",
        ".import-validation",
        ".outcome-evidence",
    ):
        if stem.endswith(suffix):
            return stem[: -len(suffix)]
    return stem


def default_output_path(batch_name: str | None = None) -> Path:
    reports_dir = get_current_admin_reports_dir()
    if batch_name:
        return reports_dir / f"{batch_name}.{OUTCOME_EVIDENCE_SUFFIX}.json"
    return reports_dir / f"discovery_report.{OUTCOME_EVIDENCE_SUFFIX}.json"


def load_outcome_evidence_artifact(path: Path) -> dict[str, Any]:
    payload = load_json_file(path)
    if not isinstance(payload, dict):
        raise ValueError(f"Outcome evidence artifact must be a JSON object: {path}")
    return payload


def write_outcome_evidence_artifact(path: Path, payload: dict[str, Any]) -> None:
    write_json_file(path, payload)


def record_key_variants(item: dict[str, Any]) -> set[str]:
    variants = {
        value
        for value in (
            normalize_nullable_text(item.get("record_key")),
            normalize_nullable_text(item.get("slug")),
            normalize_nullable_text(item.get("linked_promise_slug")),
            normalize_nullable_text(item.get("matched_policy_id")),
            normalize_nullable_text(item.get("matched_promise_id")),
            normalize_nullable_text(item.get("matched_action_id")),
        )
        if value
    }
    record = item.get("record") if isinstance(item.get("record"), dict) else {}
    variants.update(
        value
        for value in (
            normalize_nullable_text(record.get("slug")),
            normalize_nullable_text(record.get("title")),
            normalize_nullable_text(record.get("id")),
        )
        if value
    )
    return variants


def outcome_evidence_index(paths: list[Path]) -> dict[str, dict[str, Any]]:
    index: dict[str, dict[str, Any]] = {}
    for path in paths:
        payload = load_outcome_evidence_artifact(path)
        for item in payload.get("items") or []:
            if not isinstance(item, dict):
                continue
            for key in record_key_variants(item):
                index[key] = item
    return index
