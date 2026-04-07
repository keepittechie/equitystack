#!/usr/bin/env python3
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from current_admin_common import get_current_admin_reports_dir, normalize_nullable_text
from current_admin_openai_batch_guardrails import evaluate_review_batch_safety


VALID_FOCUS = {"all", "blocked", "incomplete", "finalize-safe", "apply-safe"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Read current-admin OpenAI Batch state from local review and sidecar artifacts."
    )
    parser.add_argument("--batch-name", help="Limit output to one current-admin batch name.")
    parser.add_argument(
        "--focus",
        choices=sorted(VALID_FOCUS),
        default="all",
        help="Filter batches by Batch readiness state.",
    )
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON output.")
    return parser.parse_args()


def load_json_file(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text())
    if not isinstance(payload, dict):
        raise ValueError(f"{path} must contain a JSON object.")
    return payload


def review_artifact_paths() -> list[Path]:
    reports_dir = get_current_admin_reports_dir()
    return sorted(
        (path for path in reports_dir.glob("*.ai-review.json") if path.is_file()),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )


def build_operator_guidance(
    *,
    status: str,
    metadata_present: bool,
    output_ready: bool,
    review_artifact_rebuilt: bool,
    finalize_safe: bool,
    apply_safe: bool,
    validation_counts: dict[str, int],
    blocking_issues: list[dict[str, Any]],
) -> tuple[str, str, str]:
    if not metadata_present:
        return "Legacy / No Batch Metadata", "ready for manual review", "Ready for manual review"
    if blocking_issues:
        if status in {"submitted", "validating", "in_progress", "finalizing", "cancelling", "unknown"}:
            return "Batch In Progress", "poll batch", "Run batch poll"
        if status == "completed" and not output_ready:
            return "Output Ready To Fetch", "fetch results", "Run batch fetch"
        if output_ready and not review_artifact_rebuilt:
            return "Output Fetched", "resume batch", "Run batch resume"
        if validation_counts.get("malformed_items", 0) or validation_counts.get("enum_errors", 0) or validation_counts.get("missing_field_errors", 0):
            return "Validation Blocked", "blocked by validation errors", "Manual review required before finalize"
        return "Blocked", "resume batch", "Run batch resume"

    if apply_safe:
        return "Apply Safe", "ready for import/apply path", "Ready for import/apply path"
    if finalize_safe:
        return "Finalize Safe", "ready for finalize", "Ready for finalize"
    return "Ready For Manual Review", "ready for manual review", "Ready for manual review"


def build_batch_read_model(review_path: Path) -> dict[str, Any]:
    report = load_json_file(review_path)
    safety = evaluate_review_batch_safety(review_path)
    validation_counts = safety.get("validation_counts") or {}
    blocking_issues = safety.get("blocking_issues") or []
    metadata_present = bool(safety.get("metadata_present"))
    review_artifact_rebuilt = bool(
        not metadata_present or safety.get("review_artifact_rebuilt")
    )
    normalized_input_artifact = (
        safety.get("input_artifact")
        or report.get("input_path")
    )
    status_label, recommended_next_action, operator_hint = build_operator_guidance(
        status=normalize_nullable_text(safety.get("status")) or "unknown",
        metadata_present=metadata_present,
        output_ready=bool(safety.get("output_ready")),
        review_artifact_rebuilt=review_artifact_rebuilt,
        finalize_safe=bool(safety.get("safe_to_finalize")),
        apply_safe=bool(safety.get("safe_to_apply")),
        validation_counts=validation_counts,
        blocking_issues=blocking_issues,
    )

    return {
        "batch_name": report.get("batch_name") or review_path.name.removesuffix(".ai-review.json"),
        "normalized_input_artifact_path": normalized_input_artifact,
        "review_artifact_path": str(review_path),
        "provider": safety.get("provider") or ("legacy_or_dry_run" if not metadata_present else None),
        "model": safety.get("model") or report.get("model") or report.get("requested_model"),
        "batch_id": safety.get("batch_id"),
        "lifecycle_status": safety.get("status") or "unknown",
        "submitted_at": safety.get("submitted_at"),
        "completed_at": safety.get("completed_at"),
        "last_polled_at": safety.get("last_polled_at"),
        "reviewed_count": int(report.get("reviewed_count") or len(report.get("items") or [])),
        "output_ready": bool(safety.get("output_ready")),
        "error_file_present": bool(safety.get("error_file_present")),
        "review_artifact_rebuilt": review_artifact_rebuilt,
        "finalize_safe": bool(safety.get("safe_to_finalize")),
        "apply_safe": bool(safety.get("safe_to_apply")),
        "validation_counts": {
            "total_items": int(validation_counts.get("total_items") or 0),
            "valid_items": int(validation_counts.get("valid_items") or 0),
            "malformed_items": int(validation_counts.get("malformed_items") or 0),
            "enum_errors": int(validation_counts.get("enum_errors") or 0),
            "missing_field_errors": int(validation_counts.get("missing_field_errors") or 0),
            "low_confidence_items": int(validation_counts.get("low_confidence_items") or 0),
            "unclear_classifications": int(validation_counts.get("unclear_classifications") or 0),
            "needs_manual_review_items": int(validation_counts.get("needs_manual_review_items") or 0),
            "insert_safe_items": int(validation_counts.get("insert_safe_items") or 0),
        },
        "status_label": status_label,
        "operator_status_label": status_label,
        "recommended_next_action": recommended_next_action,
        "operator_hint": operator_hint,
        "blocking_issues": blocking_issues,
        "warnings": safety.get("warnings") or [],
        "paths": {
            "metadata": safety.get("metadata_path"),
            "validation": safety.get("validation_path"),
            "local_output": safety.get("local_output_path"),
            "local_error": safety.get("local_error_path"),
        },
        "sidecars": {
            "metadata_present": metadata_present,
            "validation_present": bool(safety.get("validation_present")),
        },
    }


def matches_focus(item: dict[str, Any], focus: str) -> bool:
    if focus == "all":
        return True
    if focus == "blocked":
        return bool(item.get("blocking_issues"))
    if focus == "incomplete":
        return item.get("lifecycle_status") in {"submitted", "validating", "in_progress", "finalizing", "cancelling", "unknown"} and bool(item.get("batch_id"))
    if focus == "finalize-safe":
        return bool(item.get("finalize_safe"))
    if focus == "apply-safe":
        return bool(item.get("apply_safe"))
    return True


def main() -> None:
    args = parse_args()
    items = []
    for review_path in review_artifact_paths():
        item = build_batch_read_model(review_path.resolve())
        if args.batch_name and item["batch_name"] != args.batch_name:
            continue
        if not matches_focus(item, args.focus):
            continue
        items.append(item)

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "artifact_version": 1,
        "filters": {
            "batch_name": args.batch_name or None,
            "focus": args.focus,
        },
        "counts": {
            "total": len(items),
            "blocked": sum(1 for item in items if item.get("blocking_issues")),
            "incomplete": sum(1 for item in items if matches_focus(item, "incomplete")),
            "finalize_safe": sum(1 for item in items if item.get("finalize_safe")),
            "apply_safe": sum(1 for item in items if item.get("apply_safe")),
        },
        "batches": items,
    }
    print(json.dumps(payload, indent=2 if args.pretty else None))


if __name__ == "__main__":
    try:
        main()
    except (FileNotFoundError, ValueError) as exc:
        raise SystemExit(str(exc)) from exc
