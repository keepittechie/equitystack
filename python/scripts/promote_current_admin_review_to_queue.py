#!/usr/bin/env python3
import argparse
from datetime import datetime, timezone
from pathlib import Path
import shutil
from typing import Any

from current_admin_common import (
    AUTO_APPROVED_QUEUE_KEY,
    AUTO_REJECTED_QUEUE_KEY,
    get_current_admin_reports_dir,
    load_json_file,
    merge_record_with_suggestions,
    normalize_nullable_text,
    print_json,
    read_batch_payload,
    record_has_affirmative_black_scope,
    resolve_default_report_path,
    write_json_file,
)


PROMOTION_MODE = "ai_first_black_scope_filter"
AUTO_APPROVAL_REASON = (
    "Auto-approved because the record already contains an affirmative Black-impact rationale and the AI review left it import-eligible."
)
AUTO_REJECTION_REASON = (
    "Auto-rejected from the manual queue because the record does not contain an affirmative Black-impact rationale for EquityStack's mission."
)
MANUAL_REVIEW_REASON = (
    "Held for manual review because AI scope/import signals are inconsistent or still need an operator decision."
)
AUTO_IMPORT_ACTIONS = {"approve", "import_with_pending_impact"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Promote a current-admin review artifact into the canonical AI-first manual-review queue."
    )
    parser.add_argument(
        "--input",
        type=Path,
        help="Current-admin .ai-review.json artifact to promote.",
    )
    parser.add_argument(
        "--batch-name",
        help="Batch name used to infer a single current-admin review artifact when --input is omitted.",
    )
    parser.add_argument(
        "--batch",
        type=Path,
        help="Normalized current-admin batch JSON. Defaults to reports/current_admin/<batch>.normalized.json when present.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Manual review queue output. Defaults to reports/current_admin/<batch>.manual-review-queue.json.",
    )
    parser.add_argument(
        "--decision-template-output",
        type=Path,
        help="Decision template output. Defaults to reports/current_admin/<batch>.decision-template.json.",
    )
    parser.add_argument(
        "--decision-log-output",
        type=Path,
        help="Decision log output. Defaults to reports/current_admin/review_decisions/<batch>.<timestamp>.promotion.decision-log.json.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview the promotion without writing queue, decision template, decision log, or backup artifacts.",
    )
    parser.add_argument(
        "--no-backup",
        action="store_true",
        help="Do not backup an existing queue before overwriting it.",
    )
    return parser.parse_args()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def resolve_review_artifact(args: argparse.Namespace) -> Path:
    if args.input:
        path = args.input.resolve()
        if not path.exists():
            raise FileNotFoundError(f"Review artifact not found: {path}")
        return path

    if not args.batch_name:
        raise ValueError("Provide --input or --batch-name.")

    reports_dir = get_current_admin_reports_dir()
    candidates = sorted(
        [
            *reports_dir.glob(f"{args.batch_name}*.enriched.ai-review.json"),
            *reports_dir.glob(f"{args.batch_name}*.ai-review.json"),
        ],
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    if not candidates:
        raise FileNotFoundError(
            f"No current-admin review artifact found for batch_name={args.batch_name}."
        )
    if len(candidates) > 1:
        candidate_names = ", ".join(path.name for path in candidates[:10])
        raise ValueError(
            "Multiple enriched review artifacts matched this batch. Provide --input explicitly. "
            f"Candidates: {candidate_names}"
        )
    return candidates[0].resolve()


def resolve_batch_path(review_payload: dict[str, Any], review_path: Path, explicit_batch: Path | None) -> Path:
    if explicit_batch:
        batch_path = explicit_batch.resolve()
        if not batch_path.exists():
            raise FileNotFoundError(f"Batch artifact not found: {batch_path}")
        return batch_path

    batch_name = require_text(review_payload.get("batch_name"), "Review artifact is missing batch_name.")
    reports_dir = get_current_admin_reports_dir()
    normalized_candidate = reports_dir / f"{batch_name}.normalized.json"
    if normalized_candidate.exists():
        return normalized_candidate.resolve()

    input_path = normalize_nullable_text(review_payload.get("input_path"))
    if input_path:
        candidate = Path(input_path)
        if not candidate.is_absolute():
            project_relative = Path(__file__).resolve().parents[2] / candidate
            python_relative = Path(__file__).resolve().parents[1] / candidate
            if project_relative.exists():
                return project_relative.resolve()
            if python_relative.exists():
                return python_relative.resolve()
        elif candidate.exists():
            return candidate.resolve()

    raise FileNotFoundError(
        f"Could not resolve normalized source batch for review artifact: {review_path}"
    )


def require_text(value: Any, message: str) -> str:
    text = normalize_nullable_text(value)
    if text is None:
        raise ValueError(message)
    return text


def review_item_suggestions(ai_item: dict[str, Any]) -> dict[str, Any]:
    suggestions = dict(ai_item.get("suggestions") or {})
    for field in ("impact_status", "impact_status_reason", "recommended_action"):
        if ai_item.get(field) is not None:
            suggestions[field] = ai_item.get(field)
    return suggestions


def effective_recommended_action(ai_item: dict[str, Any], suggestions: dict[str, Any]) -> str:
    return normalize_nullable_text(
        ai_item.get("recommended_action") or suggestions.get("recommended_action")
    ) or "needs_manual_review"


def classifier_recommended_action(suggestions: dict[str, Any]) -> str | None:
    return normalize_nullable_text(suggestions.get("classifier_recommended_action"))


def determine_queue_resolution(
    *,
    ai_item: dict[str, Any],
    suggestions: dict[str, Any],
    final_record: dict[str, Any],
) -> tuple[str, str]:
    recommended_action = effective_recommended_action(ai_item, suggestions)
    classifier_action = classifier_recommended_action(suggestions)
    has_black_scope = record_has_affirmative_black_scope(final_record)
    has_material_conflict = bool(ai_item.get("has_material_conflict"))

    if has_black_scope and not has_material_conflict and recommended_action in AUTO_IMPORT_ACTIONS:
        return "auto_approved", AUTO_APPROVAL_REASON

    if not has_black_scope:
        if recommended_action == "approve" or classifier_action == "approve":
            return "manual_review", MANUAL_REVIEW_REASON
        return "auto_rejected", AUTO_REJECTION_REASON

    return "manual_review", MANUAL_REVIEW_REASON


def automation_summary(queue_resolution: str, impact_status: str | None) -> str:
    if queue_resolution == "auto_approved":
        if impact_status == "impact_pending":
            return (
                "Auto-approved for import with impact outcome scoring deferred because the record is already in scope for Black-impact tracking."
            )
        return "Auto-approved for import because the record is already in scope for Black-impact tracking."
    return (
        "Auto-rejected from the manual queue because the record does not establish a publishable Black-impact connection for EquityStack."
    )


def build_queue_item(
    record: dict[str, Any],
    ai_item: dict[str, Any],
    *,
    generated_at: str,
) -> tuple[dict[str, Any], str]:
    suggestions = review_item_suggestions(ai_item)
    final_record = merge_record_with_suggestions(record, suggestions, prefill=False)
    queue_resolution, reason = determine_queue_resolution(
        ai_item=ai_item,
        suggestions=suggestions,
        final_record=final_record,
    )
    impact_status = normalize_nullable_text(suggestions.get("impact_status"))
    queue_item = {
        "slug": record.get("slug"),
        "impact_status": impact_status,
        "approved": queue_resolution == "auto_approved",
        "operator_status": (
            "approved"
            if queue_resolution == "auto_approved"
            else "auto_rejected"
            if queue_resolution == "auto_rejected"
            else "pending"
        ),
        "operator_action": (
            "approve_as_is"
            if queue_resolution == "auto_approved"
            else "reject"
            if queue_resolution == "auto_rejected"
            else None
        ),
        "operator_notes": reason if queue_resolution != "manual_review" else None,
        "original_record": record,
        "ai_review": ai_item,
        "final_record": final_record,
        "queue_resolution": queue_resolution,
        "automation_decision": (
            {
                "decision_source": "queue_promotion",
                "decision_mode": PROMOTION_MODE,
                "decision_outcome": queue_resolution,
                "decision_reason": reason,
                "timestamp": generated_at,
            }
            if queue_resolution != "manual_review"
            else None
        ),
        "decision_alignment": (
            "promotion_auto_approval"
            if queue_resolution == "auto_approved"
            else "promotion_auto_rejection"
            if queue_resolution == "auto_rejected"
            else None
        ),
        "decision_timestamp": generated_at if queue_resolution != "manual_review" else None,
        "final_decision_summary": (
            automation_summary(queue_resolution, impact_status)
            if queue_resolution != "manual_review"
            else None
        ),
    }
    return queue_item, queue_resolution


def build_decision_item(index: int, queue_item: dict[str, Any]) -> dict[str, Any]:
    ai_review = queue_item.get("ai_review") or {}
    suggestions = ai_review.get("suggestions") or {}
    return {
        "index": index,
        "slug": queue_item.get("slug"),
        "title": queue_item.get("final_record", {}).get("title") or ai_review.get("title"),
        "suggested_batch": ai_review.get("suggested_batch"),
        "review_priority": ai_review.get("review_priority"),
        "review_priority_score": ai_review.get("review_priority_score"),
        "operator_action": "",
        "operator_notes": "",
        "final_decision_summary": "",
        "timestamp": None,
        "ai_record_action_suggestion": suggestions.get("record_action_suggestion"),
        "impact_status": queue_item.get("impact_status"),
        "ai_recommended_action": ai_review.get("recommended_action") or suggestions.get("recommended_action"),
        "promotion_selected": False,
    }


def build_decision_template(
    *,
    batch_name: str,
    review_path: Path,
    queue_items: list[dict[str, Any]],
    generated_at: str,
) -> dict[str, Any]:
    items = [
        build_decision_item(index, queue_item)
        for index, queue_item in enumerate(queue_items, start=1)
    ]
    return {
        "template_type": "operator_decision_template",
        "session_id": f"{batch_name}-promotion-{timestamp()}",
        "generated_at": generated_at,
        "source_review_file": str(review_path),
        "source_artifact_file": str(review_path),
        "worklist_used": None,
        "selection_filters": {"promotion_mode": PROMOTION_MODE},
        "session_focus": "manual_review_session",
        "decision_options": [
            "approve_as_is",
            "approve_with_changes",
            "manual_review_required",
            "needs_more_sources",
            "defer",
            "reject",
            "escalate",
        ],
        "item_count": len(items),
        "items": items,
    }


def build_decision_log(
    *,
    batch_name: str,
    review_path: Path,
    decision_template_path: Path,
    auto_approved_items: list[dict[str, Any]],
    auto_rejected_items: list[dict[str, Any]],
    generated_at: str,
) -> dict[str, Any]:
    log_items = []
    resolved_items = auto_approved_items + auto_rejected_items
    decision_counts = {
        "promotion_auto_approval": 0,
        "promotion_auto_rejection": 0,
    }
    for index, queue_item in enumerate(resolved_items, start=1):
        ai_review = queue_item.get("ai_review") or {}
        suggestions = ai_review.get("suggestions") or {}
        decision_alignment = queue_item.get("decision_alignment")
        if decision_alignment in decision_counts:
            decision_counts[decision_alignment] += 1
        log_items.append(
            {
                "index": index,
                "slug": queue_item.get("slug"),
                "title": queue_item.get("final_record", {}).get("title") or ai_review.get("title"),
                "suggested_batch": ai_review.get("suggested_batch"),
                "review_priority": ai_review.get("review_priority"),
                "review_priority_score": ai_review.get("review_priority_score"),
                "operator_action": queue_item.get("operator_action"),
                "operator_notes": queue_item.get("operator_notes"),
                "final_decision_summary": queue_item.get("final_decision_summary"),
                "timestamp": queue_item.get("decision_timestamp") or generated_at,
                "ai_record_action_suggestion": suggestions.get("record_action_suggestion"),
                "decision_alignment": decision_alignment,
                "ai_suggestions_snapshot": suggestions,
                "impact_status": queue_item.get("impact_status"),
                "promotion_selected": queue_item.get("queue_resolution") == "auto_approved",
                "queue_resolution": queue_item.get("queue_resolution"),
            }
        )

    return {
        "session_id": f"{batch_name}-promotion-{timestamp()}",
        "generated_at": generated_at,
        "source_review_file": str(review_path),
        "source_decision_file": str(decision_template_path),
        "worklist_used": None,
        "selection_filters": {"promotion_mode": PROMOTION_MODE},
        "session_focus": "promotion_auto_resolution",
        "items": log_items,
        "decision_counts": decision_counts,
        "promotion_state": {
            "promotion_mode": PROMOTION_MODE,
            "approved_item_count": len(auto_approved_items),
            "auto_rejected_item_count": len(auto_rejected_items),
            "manual_review_item_count": 0,
        },
    }


def backup_existing_artifact(path: Path, label: str) -> Path | None:
    if not path.exists():
        return None
    backup_path = path.with_name(
        f"{path.stem}.before-promotion-{timestamp()}.{label}{path.suffix}"
    )
    shutil.copy2(path, backup_path)
    return backup_path


def main() -> None:
    args = parse_args()
    review_path = resolve_review_artifact(args)
    review_payload = load_json_file(review_path)
    if not isinstance(review_payload, dict):
        raise ValueError("Review artifact must be a JSON object.")

    batch_name = require_text(review_payload.get("batch_name"), "Review artifact is missing batch_name.")
    batch_path = resolve_batch_path(review_payload, review_path, args.batch)
    batch_payload = read_batch_payload(batch_path)
    output_path = (args.output or resolve_default_report_path(batch_name, "manual-review-queue")).resolve()
    decision_template_path = (
        args.decision_template_output
        or resolve_default_report_path(batch_name, "decision-template")
    ).resolve()
    decision_log_path = (
        args.decision_log_output
        or (
            get_current_admin_reports_dir()
            / "review_decisions"
            / f"{batch_name}.decision-log.json"
        )
    ).resolve()

    review_items = {
        item.get("slug"): item
        for item in review_payload.get("items") or []
        if isinstance(item, dict) and item.get("slug")
    }

    generated_at = now_iso()
    manual_queue_items: list[dict[str, Any]] = []
    auto_approved_items: list[dict[str, Any]] = []
    auto_rejected_items: list[dict[str, Any]] = []
    for record in batch_payload.get("records") or []:
        ai_item = review_items.get(record.get("slug"), {})
        queue_item, queue_resolution = build_queue_item(
            record,
            ai_item,
            generated_at=generated_at,
        )
        if queue_resolution == "auto_approved":
            auto_approved_items.append(queue_item)
        elif queue_resolution == "auto_rejected":
            auto_rejected_items.append(queue_item)
        else:
            manual_queue_items.append(queue_item)

    pending_impact_count = sum(
        1
        for item in auto_approved_items
        if normalize_nullable_text(item.get("impact_status")) == "impact_pending"
    )
    queue_payload = {
        "batch_name": batch_payload.get("batch_name") or batch_name,
        "president_slug": batch_payload.get("president_slug"),
        "source_batch_path": str(batch_path),
        "source_review_path": str(review_path),
        "prefill_suggestions": False,
        "input_mode": "manual_review_queue",
        AUTO_APPROVED_QUEUE_KEY: auto_approved_items,
        AUTO_REJECTED_QUEUE_KEY: auto_rejected_items,
        "promotion_state": {
            "promoted": True,
            "promotion_mode": PROMOTION_MODE,
            "promoted_at": generated_at,
            "source_review_path": str(review_path),
            "source_batch_path": str(batch_path),
            "decision_template_path": str(decision_template_path),
            "decision_log_path": str(decision_log_path),
            "queue_scope": "manual_queue_only",
            "approved_item_count": len(auto_approved_items),
            "auto_approved_item_count": len(auto_approved_items),
            "auto_rejected_item_count": len(auto_rejected_items),
            "manual_review_item_count": len(manual_queue_items),
            "pending_impact_item_count": pending_impact_count,
            "reviewed_item_count": len(batch_payload.get("records") or []),
            "impact_outcomes_deferred": pending_impact_count > 0,
        },
        "items": manual_queue_items,
    }

    decision_template = build_decision_template(
        batch_name=batch_name,
        review_path=review_path,
        queue_items=manual_queue_items,
        generated_at=generated_at,
    )
    decision_log = build_decision_log(
        batch_name=batch_name,
        review_path=review_path,
        decision_template_path=decision_template_path,
        auto_approved_items=auto_approved_items,
        auto_rejected_items=auto_rejected_items,
        generated_at=generated_at,
    )

    queue_backup_path = None
    decision_template_backup_path = None
    if not args.dry_run:
        if not args.no_backup:
            queue_backup_path = backup_existing_artifact(output_path, "queue")
            decision_template_backup_path = backup_existing_artifact(decision_template_path, "decision-template")
            if queue_backup_path:
                queue_payload["promotion_state"]["previous_queue_backup_path"] = str(queue_backup_path)
            if decision_template_backup_path:
                queue_payload["promotion_state"]["previous_decision_template_backup_path"] = str(decision_template_backup_path)
        write_json_file(output_path, queue_payload)
        write_json_file(decision_template_path, decision_template)
        write_json_file(decision_log_path, decision_log)

    print_json(
        {
            "dry_run": bool(args.dry_run),
            "batch_name": batch_name,
            "source_batch_path": str(batch_path),
            "source_review_path": str(review_path),
            "queue_output_path": str(output_path),
            "decision_template_path": str(decision_template_path),
            "decision_log_path": str(decision_log_path),
            "previous_queue_backup_path": str(queue_backup_path) if queue_backup_path else None,
            "previous_decision_template_backup_path": str(decision_template_backup_path) if decision_template_backup_path else None,
            "queue_regenerated": not args.dry_run,
            "manual_review_item_count": len(manual_queue_items),
            "approved_item_count": len(auto_approved_items),
            "auto_rejected_item_count": len(auto_rejected_items),
            "pending_impact_item_count": pending_impact_count,
            "auto_approved_slugs": sorted(
                str(item.get("slug")) for item in auto_approved_items if item.get("slug")
            ),
            "auto_rejected_slugs": sorted(
                str(item.get("slug")) for item in auto_rejected_items if item.get("slug")
            ),
            "next_command": f"./bin/equitystack current-admin apply --input {output_path}",
        }
    )


if __name__ == "__main__":
    main()
