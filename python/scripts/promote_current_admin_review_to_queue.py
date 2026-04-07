#!/usr/bin/env python3
import argparse
from datetime import datetime, timezone
from pathlib import Path
import shutil
from typing import Any

from apply_current_admin_ai_review import merge_record_with_suggestions
from current_admin_common import (
    get_current_admin_reports_dir,
    load_json_file,
    normalize_nullable_text,
    print_json,
    read_batch_payload,
    resolve_default_report_path,
    write_json_file,
)


PROMOTION_MODE = "impact_pending_import"
PROMOTION_REASON = (
    "Auto-approved for importing verified policy/action facts with impact outcome scoring deferred."
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Promote an enriched current-admin review artifact into the canonical manual-review queue."
    )
    parser.add_argument(
        "--input",
        type=Path,
        help="Enriched current-admin .ai-review.json artifact to promote.",
    )
    parser.add_argument(
        "--batch-name",
        help="Batch name used to infer a single enriched paired-evaluation review artifact when --input is omitted.",
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
        reports_dir.glob(f"{args.batch_name}*.enriched.ai-review.json"),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    if not candidates:
        raise FileNotFoundError(
            f"No enriched paired-evaluation review artifact found for batch_name={args.batch_name}."
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


def is_promotable_pending_impact_item(ai_item: dict[str, Any], suggestions: dict[str, Any]) -> bool:
    impact_status = normalize_nullable_text(ai_item.get("impact_status") or suggestions.get("impact_status"))
    recommended_action = normalize_nullable_text(
        ai_item.get("recommended_action") or suggestions.get("recommended_action")
    )
    return impact_status == "impact_pending" and recommended_action == "import_with_pending_impact"


def build_queue_item(record: dict[str, Any], ai_item: dict[str, Any]) -> tuple[dict[str, Any], bool]:
    suggestions = review_item_suggestions(ai_item)
    promotable = is_promotable_pending_impact_item(ai_item, suggestions)
    final_record = merge_record_with_suggestions(record, suggestions, prefill=False)
    queue_item = {
        "slug": record.get("slug"),
        "impact_status": suggestions.get("impact_status"),
        "approved": promotable,
        "operator_status": "approved" if promotable else "pending",
        "operator_action": "approve_as_is" if promotable else None,
        "operator_notes": PROMOTION_REASON if promotable else None,
        "original_record": record,
        "ai_review": ai_item,
        "final_record": final_record,
    }
    if promotable:
        queue_item["promotion_reason"] = PROMOTION_REASON
    return queue_item, promotable


def build_decision_item(index: int, queue_item: dict[str, Any], promoted: bool) -> dict[str, Any]:
    ai_review = queue_item.get("ai_review") or {}
    suggestions = ai_review.get("suggestions") or {}
    now = now_iso()
    return {
        "index": index,
        "slug": queue_item.get("slug"),
        "title": queue_item.get("final_record", {}).get("title") or ai_review.get("title"),
        "suggested_batch": ai_review.get("suggested_batch"),
        "review_priority": ai_review.get("review_priority"),
        "review_priority_score": ai_review.get("review_priority_score"),
        "operator_action": "approve_as_is" if promoted else "",
        "operator_notes": PROMOTION_REASON if promoted else "",
        "final_decision_summary": (
            "Promoted from enriched review as impact_pending; import policy/action facts only and defer finalized impact outcome scoring."
            if promoted
            else ""
        ),
        "timestamp": now if promoted else None,
        "ai_record_action_suggestion": suggestions.get("record_action_suggestion"),
        "impact_status": queue_item.get("impact_status"),
        "ai_recommended_action": ai_review.get("recommended_action") or suggestions.get("recommended_action"),
        "promotion_selected": promoted,
    }


def build_decision_template(
    *,
    batch_name: str,
    review_path: Path,
    queue_items: list[dict[str, Any]],
    promoted_slugs: set[str],
    generated_at: str,
) -> dict[str, Any]:
    items = [
        build_decision_item(index, queue_item, queue_item.get("slug") in promoted_slugs)
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
        "session_focus": "impact_pending_promotion",
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
    queue_items: list[dict[str, Any]],
    promoted_slugs: set[str],
    generated_at: str,
) -> dict[str, Any]:
    log_items = []
    for index, queue_item in enumerate(queue_items, start=1):
        if queue_item.get("slug") not in promoted_slugs:
            continue
        ai_review = queue_item.get("ai_review") or {}
        suggestions = ai_review.get("suggestions") or {}
        log_items.append(
            {
                "index": index,
                "slug": queue_item.get("slug"),
                "title": queue_item.get("final_record", {}).get("title") or ai_review.get("title"),
                "suggested_batch": ai_review.get("suggested_batch"),
                "review_priority": ai_review.get("review_priority"),
                "review_priority_score": ai_review.get("review_priority_score"),
                "operator_action": "approve_as_is",
                "operator_notes": PROMOTION_REASON,
                "final_decision_summary": "Promoted impact_pending item for import with finalized impact outcomes deferred.",
                "timestamp": generated_at,
                "ai_record_action_suggestion": suggestions.get("record_action_suggestion"),
                "decision_alignment": "promotion_auto_approval",
                "ai_suggestions_snapshot": suggestions,
                "impact_status": queue_item.get("impact_status"),
                "promotion_selected": True,
            }
        )

    return {
        "session_id": f"{batch_name}-promotion-{timestamp()}",
        "generated_at": generated_at,
        "source_review_file": str(review_path),
        "source_decision_file": str(decision_template_path),
        "worklist_used": None,
        "selection_filters": {"promotion_mode": PROMOTION_MODE},
        "session_focus": "impact_pending_promotion",
        "items": log_items,
        "decision_counts": {
            "promotion_auto_approval": len(log_items),
        },
        "promotion_state": {
            "promotion_mode": PROMOTION_MODE,
            "approved_item_count": len(log_items),
            "impact_status": "impact_pending",
            "recommended_action": "import_with_pending_impact",
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
            / f"{batch_name}.{timestamp()}.promotion.decision-log.json"
        )
    ).resolve()

    review_items = {
        item.get("slug"): item
        for item in review_payload.get("items") or []
        if isinstance(item, dict) and item.get("slug")
    }

    queue_items: list[dict[str, Any]] = []
    promoted_slugs: set[str] = set()
    for record in batch_payload.get("records") or []:
        ai_item = review_items.get(record.get("slug"), {})
        queue_item, promoted = build_queue_item(record, ai_item)
        queue_items.append(queue_item)
        if promoted:
            promoted_slugs.add(str(record.get("slug")))

    generated_at = now_iso()
    queue_payload = {
        "batch_name": batch_payload.get("batch_name") or batch_name,
        "president_slug": batch_payload.get("president_slug"),
        "source_batch_path": str(batch_path),
        "source_review_path": str(review_path),
        "prefill_suggestions": False,
        "input_mode": "manual_review_queue",
        "promotion_state": {
            "promoted": True,
            "promotion_mode": PROMOTION_MODE,
            "promoted_at": generated_at,
            "source_review_path": str(review_path),
            "source_batch_path": str(batch_path),
            "decision_template_path": str(decision_template_path),
            "decision_log_path": str(decision_log_path),
            "approved_item_count": len(promoted_slugs),
            "pending_impact_item_count": len(promoted_slugs),
            "non_promoted_item_count": len(queue_items) - len(promoted_slugs),
            "impact_status": "impact_pending",
            "recommended_action": "import_with_pending_impact",
            "impact_outcomes_deferred": True,
        },
        "items": queue_items,
    }

    decision_template = build_decision_template(
        batch_name=batch_name,
        review_path=review_path,
        queue_items=queue_items,
        promoted_slugs=promoted_slugs,
        generated_at=generated_at,
    )
    decision_log = build_decision_log(
        batch_name=batch_name,
        review_path=review_path,
        decision_template_path=decision_template_path,
        queue_items=queue_items,
        promoted_slugs=promoted_slugs,
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
            "item_count": len(queue_items),
            "approved_item_count": len(promoted_slugs),
            "pending_impact_item_count": len(promoted_slugs),
            "non_promoted_item_count": len(queue_items) - len(promoted_slugs),
            "promoted_slugs": sorted(promoted_slugs),
            "next_command": f"./bin/equitystack current-admin apply --input {output_path}",
        }
    )


if __name__ == "__main__":
    main()
