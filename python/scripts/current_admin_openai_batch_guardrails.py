#!/usr/bin/env python3
from pathlib import Path
from typing import Any
import json

from current_admin_common import get_project_root, normalize_nullable_text


ARTIFACT_VERSION = 1
TERMINAL_BATCH_STATUSES = {"completed", "failed", "expired", "cancelled"}
INCOMPLETE_BATCH_STATUSES = {
    "submitted",
    "validating",
    "in_progress",
    "finalizing",
    "cancelling",
}


def batch_artifact_path(review_path: Path, suffix: str) -> Path:
    name = review_path.name
    if name.endswith(".ai-review.json"):
        stem = name.removesuffix(".ai-review.json")
        return review_path.with_name(f"{stem}.openai-batch.{suffix}")
    if name.endswith(".json"):
        stem = name.removesuffix(".json")
        return review_path.with_name(f"{stem}.openai-batch.{suffix}")
    return review_path.with_name(f"{name}.openai-batch.{suffix}")


def metadata_path_for_review(review_path: Path) -> Path:
    return batch_artifact_path(review_path, "meta.json")


def legacy_metadata_path_for_review(review_path: Path) -> Path:
    return batch_artifact_path(review_path, "metadata.json")


def validation_path_for_review(review_path: Path) -> Path:
    return batch_artifact_path(review_path, "validation.json")


def output_path_for_review(review_path: Path) -> Path:
    return batch_artifact_path(review_path, "output.jsonl")


def error_path_for_review(review_path: Path) -> Path:
    return batch_artifact_path(review_path, "errors.jsonl")


def load_json_payload(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text())
    if not isinstance(payload, dict):
        raise ValueError(f"{path} must contain a JSON object.")
    return payload


def load_optional_json(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    return load_json_payload(path)


def load_batch_metadata(review_path: Path) -> tuple[dict[str, Any] | None, Path]:
    meta_path = metadata_path_for_review(review_path)
    if meta_path.exists():
        return load_json_payload(meta_path), meta_path

    legacy_path = legacy_metadata_path_for_review(review_path)
    if legacy_path.exists():
        payload = load_json_payload(legacy_path)
        if payload.get("object") == "batch" or payload.get("id"):
            return {
                "provider": "openai",
                "artifact_version": ARTIFACT_VERSION,
                "batch_id": payload.get("id"),
                "status": payload.get("status"),
                "input_file_id": payload.get("input_file_id"),
                "output_file_id": payload.get("output_file_id"),
                "error_file_id": payload.get("error_file_id"),
                "request_counts": payload.get("request_counts") or {},
                "raw_batch": payload,
                "local_output_path": str(output_path_for_review(review_path)),
                "local_error_path": str(error_path_for_review(review_path)),
            }, legacy_path
        return payload, legacy_path

    return None, meta_path


def resolve_lineage_path(raw_value: Any, reference_path: Path) -> Path | None:
    value = normalize_nullable_text(raw_value)
    if value is None:
        return None
    candidate = Path(value)
    if candidate.is_absolute():
        return candidate.resolve()

    project_root = get_project_root()
    python_dir = project_root / "python"
    candidates = [
        (reference_path.parent / candidate).resolve(),
        (project_root / candidate).resolve(),
        (python_dir / candidate).resolve(),
    ]
    for resolved in candidates:
        if resolved.exists():
            return resolved
    return candidates[0]


def review_path_from_queue(queue_path: Path, queue_payload: dict[str, Any]) -> Path | None:
    return resolve_lineage_path(queue_payload.get("source_review_path"), queue_path)


def validation_counts(validation_payload: dict[str, Any] | None) -> dict[str, int]:
    if not validation_payload:
        return {}
    return {
        "total_items": int(validation_payload.get("total_items") or 0),
        "valid_items": int(validation_payload.get("valid_items") or 0),
        "malformed_items": int(validation_payload.get("malformed_items") or 0),
        "enum_errors": int(validation_payload.get("enum_errors") or 0),
        "missing_field_errors": int(validation_payload.get("missing_field_errors") or 0),
        "low_confidence_items": int(validation_payload.get("low_confidence_items") or 0),
        "unclear_classifications": int(validation_payload.get("unclear_classifications") or 0),
        "needs_manual_review_items": int(validation_payload.get("needs_manual_review_items") or 0),
        "insert_safe_items": int(validation_payload.get("insert_safe_items") or 0),
    }


def evaluate_review_batch_safety(review_path: Path) -> dict[str, Any]:
    review_path = review_path.resolve()
    review_payload = load_optional_json(review_path)
    metadata_payload, metadata_path = load_batch_metadata(review_path)
    validation_path = validation_path_for_review(review_path)
    validation_payload = load_optional_json(validation_path)

    result: dict[str, Any] = {
        "review_path": str(review_path),
        "metadata_path": str(metadata_path),
        "validation_path": str(validation_path),
        "metadata_present": metadata_payload is not None,
        "validation_present": validation_payload is not None,
        "blocking_issues": [],
        "warnings": [],
        "safe_to_finalize": True,
        "safe_to_apply": True,
        "validation_counts": validation_counts(validation_payload),
    }

    if metadata_payload is None:
        result["status"] = "no_batch_metadata"
        result["warnings"].append(
            {
                "type": "openai_batch_metadata_missing",
                "message": "No OpenAI Batch metadata sidecar was found; treating this as a legacy, dry-run, or non-Batch review artifact.",
            }
        )
        return result

    status = normalize_nullable_text(metadata_payload.get("status")) or "unknown"
    result.update(
        {
            "provider": metadata_payload.get("provider"),
            "model": metadata_payload.get("model"),
            "batch_id": metadata_payload.get("batch_id"),
            "status": status,
            "submitted_at": metadata_payload.get("submitted_at"),
            "completed_at": metadata_payload.get("completed_at"),
            "last_polled_at": metadata_payload.get("last_polled_at"),
            "output_file_id": metadata_payload.get("output_file_id"),
            "error_file_id": metadata_payload.get("error_file_id"),
            "request_counts": metadata_payload.get("request_counts") or {},
            "input_artifact": metadata_payload.get("input_artifact"),
            "review_artifact": metadata_payload.get("review_artifact"),
            "review_artifact_rebuilt_at": metadata_payload.get("review_artifact_rebuilt_at"),
        }
    )

    local_output_path = resolve_lineage_path(metadata_payload.get("local_output_path"), metadata_path)
    local_error_path = resolve_lineage_path(metadata_payload.get("local_error_path"), metadata_path)
    if local_output_path is None:
        local_output_path = output_path_for_review(review_path)
    if local_error_path is None:
        local_error_path = error_path_for_review(review_path)

    output_file_id = normalize_nullable_text(metadata_payload.get("output_file_id"))
    error_file_id = normalize_nullable_text(metadata_payload.get("error_file_id"))
    result["local_output_path"] = str(local_output_path)
    result["local_error_path"] = str(local_error_path)
    result["output_ready"] = bool(output_file_id and local_output_path.exists())
    result["error_file_present"] = bool(error_file_id and local_error_path.exists())
    result["review_artifact_ready"] = bool(review_path.exists() and review_payload and review_payload.get("items"))
    result["review_artifact_rebuilt"] = bool(
        result["review_artifact_ready"] and normalize_nullable_text(metadata_payload.get("review_artifact_rebuilt_at"))
    )

    if status in INCOMPLETE_BATCH_STATUSES or status not in TERMINAL_BATCH_STATUSES:
        result["blocking_issues"].append(
            {
                "type": "openai_batch_not_complete",
                "message": f"OpenAI Batch status is {status}; results are not final yet.",
                "fix": "Run current-admin ai-review with --batch-poll or --batch-resume before finalizing or applying.",
            }
        )

    if status == "completed" and output_file_id and not local_output_path.exists():
        result["blocking_issues"].append(
            {
                "type": "openai_batch_output_not_fetched",
                "message": "OpenAI Batch completed but the local output JSONL has not been fetched.",
                "fix": "Run current-admin ai-review with --batch-fetch or --batch-resume.",
            }
        )

    if status in {"failed", "expired", "cancelled"}:
        result["blocking_issues"].append(
            {
                "type": "openai_batch_terminal_failure",
                "message": f"OpenAI Batch ended with terminal status {status}.",
                "fix": "Inspect the metadata/error sidecars before deciding whether to resubmit a new review batch.",
            }
        )

    if not result["review_artifact_ready"]:
        result["blocking_issues"].append(
            {
                "type": "openai_batch_review_not_rebuilt",
                "message": "The canonical .ai-review.json artifact is missing or has no items.",
                "fix": "Run current-admin ai-review with --batch-resume to rebuild from the fetched Batch output.",
            }
        )

    if not validation_payload:
        result["blocking_issues"].append(
            {
                "type": "openai_batch_validation_missing",
                "message": "The OpenAI Batch validation sidecar is missing.",
                "fix": "Run current-admin ai-review with --batch-resume to rebuild validation.",
            }
        )
    else:
        counts = result["validation_counts"]
        malformed_count = counts.get("malformed_items", 0)
        enum_count = counts.get("enum_errors", 0)
        missing_count = counts.get("missing_field_errors", 0)
        if malformed_count or enum_count or missing_count:
            result["blocking_issues"].append(
                {
                    "type": "openai_batch_validation_failed",
                    "message": (
                        "OpenAI Batch validation found "
                        f"{malformed_count} malformed item(s), {enum_count} enum error(s), "
                        f"and {missing_count} missing-field error(s)."
                    ),
                    "fix": "Inspect the validation sidecar and resolve invalid rows before finalizing or applying.",
                }
            )

    result["safe_to_finalize"] = not result["blocking_issues"]
    result["safe_to_apply"] = not result["blocking_issues"]
    return result


def require_review_batch_safe(review_path: Path, phase: str) -> dict[str, Any]:
    safety = evaluate_review_batch_safety(review_path)
    if safety["blocking_issues"]:
        messages = [
            f"OpenAI Batch review artifact is not safe for {phase}: {review_path}",
        ]
        for issue in safety["blocking_issues"]:
            messages.append(f"- {issue.get('message')}")
            if issue.get("fix"):
                messages.append(f"  Fix: {issue['fix']}")
        raise ValueError("\n".join(messages))
    return safety
