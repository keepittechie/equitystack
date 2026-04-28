#!/usr/bin/env python3
import argparse
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import os
import sys

from current_admin_common import (
    derive_csv_path,
    load_json_file,
    print_json,
    queue_auto_approved_items,
    queue_manual_items,
    queue_review_coverage_items,
    record_has_affirmative_black_scope,
    resolve_default_report_path,
    write_csv_rows,
    write_json_file,
)
from current_admin_openai_batch_guardrails import evaluate_review_batch_safety


APPROVAL_ACTIONS = {"approve_as_is", "approve_with_changes"}
NON_READY_ACTIONS = {
    "manual_review_required",
    "needs_more_sources",
    "defer",
    "reject",
    "escalate",
}
VALID_OPERATOR_ACTIONS = APPROVAL_ACTIONS | NON_READY_ACTIONS

READINESS_FORMULA = {
    "ready": "Safe to proceed to import.",
    "ready_with_warnings": "You can proceed, but review warnings first.",
    "blocked": "You cannot proceed. Fix the issues below.",
}

READINESS_DETAILS = {
    "ready": {
        "label": "Ready",
        "meaning": "Approved items are covered and no blocking issues were found.",
        "operator_guidance": "Run a dry-run import first, review the report, then apply only when ready.",
    },
    "ready_with_warnings": {
        "label": "Ready With Warnings",
        "meaning": "Import can proceed, but warning signals still deserve a human review.",
        "operator_guidance": "Review warnings, then run a dry-run import if the queue still looks correct.",
    },
    "blocked": {
        "label": "Blocked",
        "meaning": "Something is incomplete, mismatched, or missing for at least one import candidate.",
        "operator_guidance": "Fix the listed blockers, then rerun pre-commit review.",
    },
}

ACTION_LABELS = {
    "approve_as_is": "approved as-is",
    "approve_with_changes": "approved with changes",
    "manual_review_required": "manual review",
    "needs_more_sources": "needs more sources",
    "defer": "deferred",
    "reject": "rejected",
    "escalate": "escalated",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a read-only pre-commit review artifact for a current-administration import."
    )
    parser.add_argument(
        "--input",
        type=Path,
        required=True,
        help="Required. Manual review queue JSON used as the import candidate source.",
    )
    parser.add_argument(
        "--decision-log",
        type=Path,
        help="Optional. Explicit decision log JSON. Defaults to the latest matching reports/current_admin/review_decisions/*.decision-log.json for the batch.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Optional. Pre-commit review JSON output path. Defaults to reports/current_admin/<batch>.pre-commit-review.json.",
    )
    parser.add_argument(
        "--csv",
        nargs="?",
        const="",
        help="Optional. Write a CSV summary alongside the JSON artifact.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Optional. Print the final summary payload as JSON instead of the default human-readable sections.",
    )
    return parser.parse_args()


def resolve_default_decision_log(queue_path: Path, batch_name: str) -> Path | None:
    reports_dir = queue_path.parent
    decision_dir = reports_dir / "review_decisions"
    candidates = sorted(
        decision_dir.glob(f"{batch_name}*.decision-log.json"),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    return candidates[0] if candidates else None


def load_queue(path: Path) -> dict[str, Any]:
    payload = load_json_file(path)
    if not isinstance(payload, dict):
        raise ValueError("Queue input must be a JSON object.")
    items = payload.get("items")
    if not isinstance(items, list):
        raise ValueError(
            "Queue input is missing an items array. Use the canonical .manual-review-queue.json artifact."
        )
    return payload


def load_decision_log(path: Path | None) -> tuple[dict[str, dict[str, Any]], Path | None]:
    if path is None:
        return {}, None
    payload = load_json_file(path)
    if not isinstance(payload, dict):
        raise ValueError("Decision log must be a JSON object.")
    items = payload.get("items")
    if not isinstance(items, list):
        raise ValueError("Decision log is missing an items array.")
    return {
        str(item.get("slug")): item
        for item in items
        if isinstance(item, dict) and item.get("slug")
    }, path


def load_optional_payload(path: Path | None, label: str) -> dict[str, Any] | None:
    if path is None:
        return None
    payload = load_json_file(path)
    if not isinstance(payload, dict):
        raise ValueError(f"{label} must be a JSON object.")
    return payload


def read_batch_name_from_review_path(path: str | None) -> str | None:
    if not isinstance(path, str) or not path.strip():
        return None
    name = Path(path).name
    if not name.endswith(".ai-review.json"):
        return None
    return name.removesuffix(".ai-review.json")


def read_batch_name_from_review_payload_or_path(payload: dict[str, Any] | None, path: str | None) -> str | None:
    if isinstance(payload, dict):
        batch_name = payload.get("batch_name")
        if isinstance(batch_name, str) and batch_name.strip():
            return batch_name.strip()
    return read_batch_name_from_review_path(path)


def normalize_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def unique_slug_list(items: list[dict[str, Any]]) -> list[str]:
    return [str(item.get("slug")).strip() for item in items if isinstance(item, dict) and str(item.get("slug")).strip()]


def find_duplicates(slugs: list[str]) -> list[str]:
    seen: set[str] = set()
    duplicates: set[str] = set()
    for slug in slugs:
        if slug in seen:
            duplicates.add(slug)
        seen.add(slug)
    return sorted(duplicates)


def build_issue(
    issue_type: str,
    message: str,
    why: str,
    fix: str,
    *,
    severity: str = "blocking",
    count: int | None = None,
    slugs: list[str] | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "type": issue_type,
        "severity": severity,
        "message": message,
        "why": why,
        "fix": fix,
    }
    if count is not None:
        payload["count"] = count
    if slugs:
        payload["slugs"] = slugs
    return payload


def action_label(value: str | None) -> str:
    if not value:
        return "no decision"
    return ACTION_LABELS.get(value, value)


def missing_import_required_fields(queue_item: dict[str, Any]) -> list[str]:
    final_record = queue_item.get("final_record")
    if not isinstance(final_record, dict):
        return []

    ai_review = queue_item.get("ai_review") or {}
    suggestions = ai_review.get("suggestions") or {}
    record_action_suggestion = suggestions.get("record_action_suggestion")
    required_fields = ["slug", "title", "promise_text", "status"]
    if record_action_suggestion != "update_existing":
        required_fields.extend(["promise_type", "campaign_or_official"])
    return [field for field in required_fields if not final_record.get(field)]


def embedded_operator_action(queue_item: dict[str, Any]) -> str | None:
    value = queue_item.get("operator_action")
    return value if isinstance(value, str) and value else None


def summarize_item(queue_item: dict[str, Any], decision_item: dict[str, Any] | None) -> dict[str, Any]:
    ai_review = queue_item.get("ai_review") or {}
    suggestions = ai_review.get("suggestions") or {}
    final_record = queue_item.get("final_record") if isinstance(queue_item.get("final_record"), dict) else {}
    slug = queue_item.get("slug")
    title = (
        final_record.get("title")
        or queue_item.get("original_record", {}).get("title")
        or ai_review.get("title")
    )
    selected_for_import = bool(queue_item.get("approved") or queue_item.get("operator_status") == "approved")
    source_warnings = sorted(
        set(
            normalize_list(suggestions.get("source_warnings"))
            + normalize_list(suggestions.get("missing_source_warnings"))
        )
    )
    evidence_gaps = normalize_list(suggestions.get("evidence_needed_to_reduce_risk"))
    operator_action = (
        (decision_item.get("operator_action") if decision_item else None)
        or embedded_operator_action(queue_item)
    )
    decision_alignment = (
        (decision_item.get("decision_alignment") if decision_item else None)
        or queue_item.get("decision_alignment")
    )
    operator_action_valid = operator_action in VALID_OPERATOR_ACTIONS if operator_action else False
    auto_decision = isinstance(queue_item.get("automation_decision"), dict)

    blockers: list[str] = []
    warnings: list[str] = []

    if selected_for_import:
        if not isinstance(queue_item.get("final_record"), dict):
            blockers.append("missing_final_record")
        missing_fields = missing_import_required_fields(queue_item)
        if missing_fields:
            blockers.append("missing_import_required_fields")
        if (
            not auto_decision
            and (
                ai_review.get("recommended_action") == "needs_manual_review"
                or suggestions.get("recommended_action") == "needs_manual_review"
                or suggestions.get("suggested_operator_next_action") == "manual_review_required"
                or suggestions.get("record_action_suggestion") == "manual_review"
            )
        ):
            blockers.append("ai_manual_review_required")
        if not record_has_affirmative_black_scope(final_record):
            blockers.append("missing_black_impact_scope")
        if decision_item is None and not auto_decision:
            blockers.append("missing_decision_coverage")
        elif operator_action is None:
            blockers.append("missing_decision_coverage")
        elif operator_action and not operator_action_valid:
            blockers.append("invalid_operator_action")
        elif operator_action not in APPROVAL_ACTIONS:
            blockers.append("operator_action_not_import_ready")
    else:
        missing_fields = []

    if ai_review.get("has_material_conflict"):
        warnings.append("material_conflict_present")
    if source_warnings or evidence_gaps:
        warnings.append("source_or_evidence_gaps")
    if ai_review.get("review_priority") == "high" or ai_review.get("suggested_batch") == "high_attention":
        warnings.append("high_attention_item")
    confidence_score = suggestions.get("confidence_score")
    record_action_suggestion = suggestions.get("record_action_suggestion")
    impact_status = (
        queue_item.get("impact_status")
        or (queue_item.get("final_record") or {}).get("impact_status")
        or suggestions.get("impact_status")
    )
    if isinstance(confidence_score, (float, int)) and confidence_score < 0.55:
        warnings.append("low_confidence")
    if impact_status == "impact_pending":
        warnings.append("impact_pending")
    if ai_review.get("deep_review_recommended"):
        warnings.append("deep_review_recommended")
    if decision_alignment == "mismatch":
        warnings.append("decision_mismatch")

    if not selected_for_import:
        readiness = "not_selected"
    elif blockers:
        readiness = "blocked"
    elif warnings:
        readiness = "ready_with_warnings"
    else:
        readiness = "ready"

    return {
        "slug": slug,
        "title": title,
        "selected_for_import": selected_for_import,
        "operator_status": queue_item.get("operator_status"),
        "approved": bool(queue_item.get("approved")),
        "operator_action": operator_action,
        "operator_action_valid": operator_action_valid if operator_action else None,
        "decision_alignment": decision_alignment,
        "review_priority": ai_review.get("review_priority"),
        "review_priority_score": ai_review.get("review_priority_score"),
        "suggested_batch": ai_review.get("suggested_batch"),
        "has_material_conflict": bool(ai_review.get("has_material_conflict")),
        "source_warnings": source_warnings,
        "evidence_gap_count": len(evidence_gaps),
        "confidence_level": suggestions.get("confidence_level"),
        "confidence_score": confidence_score,
        "record_action_suggestion": record_action_suggestion,
        "impact_status": impact_status,
        "import_readiness": readiness,
        "missing_import_required_fields": missing_fields,
        "blocking_issues": blockers,
        "warning_signals": warnings,
        "queue_resolution": queue_item.get("queue_resolution"),
    }


def determine_overall_readiness(items: list[dict[str, Any]]) -> tuple[str, list[dict[str, Any]], dict[str, int], str]:
    selected = [item for item in items if item["selected_for_import"]]
    missing_decision_coverage = any("missing_decision_coverage" in item["blocking_issues"] for item in selected)
    invalid_operator_action = any("invalid_operator_action" in item["blocking_issues"] for item in selected)
    operator_action_not_import_ready = any("operator_action_not_import_ready" in item["blocking_issues"] for item in selected)
    missing_final_record = any("missing_final_record" in item["blocking_issues"] for item in selected)
    missing_import_required_fields = any("missing_import_required_fields" in item["blocking_issues"] for item in selected)
    ai_manual_review_required = any("ai_manual_review_required" in item["blocking_issues"] for item in selected)
    missing_black_impact_scope = any("missing_black_impact_scope" in item["blocking_issues"] for item in selected)
    warning_counts = {
        "material_conflict_present": sum("material_conflict_present" in item["warning_signals"] for item in selected),
        "source_or_evidence_gaps": sum("source_or_evidence_gaps" in item["warning_signals"] for item in selected),
        "high_attention_item": sum("high_attention_item" in item["warning_signals"] for item in selected),
        "low_confidence": sum("low_confidence" in item["warning_signals"] for item in selected),
        "impact_pending": sum("impact_pending" in item["warning_signals"] for item in selected),
        "deep_review_recommended": sum("deep_review_recommended" in item["warning_signals"] for item in selected),
        "decision_mismatch": sum("decision_mismatch" in item["warning_signals"] for item in selected),
    }

    blocking_issues: list[dict[str, Any]] = []
    if not selected:
        blocking_issues.append(
            build_issue(
                "no_approved_queue_items",
                "No queue items are currently approved for import.",
                "Import only uses approved queue items. If nothing is approved, there is nothing to import.",
                "Approve the intended queue items or keep them pending, then rerun pre-commit review.",
            )
        )
    if missing_decision_coverage:
        missing_slugs = sorted(
            item["slug"]
            for item in selected
            if "missing_decision_coverage" in item["blocking_issues"]
        )
        blocking_issues.append(
            build_issue(
                "missing_decision_coverage",
                f"{len(missing_slugs)} approved item(s) are missing decision-log coverage.",
                "Approved items need explicit operator decisions recorded before import.",
                "Open the decision file, fill operator_action for every approved manual-review item, rerun current-admin review, then rerun pre-commit.",
                count=len(missing_slugs),
                slugs=missing_slugs,
            )
        )
    if invalid_operator_action:
        invalid_slugs = sorted(
            item["slug"]
            for item in selected
            if "invalid_operator_action" in item["blocking_issues"]
        )
        blocking_issues.append(
            build_issue(
                "invalid_operator_action",
                f"{len(invalid_slugs)} approved item(s) have invalid operator_action values.",
                "Imports rely on a known set of operator actions so queue decisions stay explicit and auditable.",
                "Refresh or correct the decision file, then rerun current-admin review.",
                count=len(invalid_slugs),
                slugs=invalid_slugs,
            )
        )
    if operator_action_not_import_ready:
        unresolved_slugs = sorted(
            item["slug"]
            for item in selected
            if "operator_action_not_import_ready" in item["blocking_issues"]
        )
        blocking_issues.append(
            build_issue(
                "operator_action_not_import_ready",
                f"{len(unresolved_slugs)} approved item(s) still have a non-import-ready operator action.",
                "Items marked for manual review, more sources, defer, reject, or escalate should not move into import.",
                "Resolve the operator_action in the decision file or update queue approval, then rerun pre-commit.",
                count=len(unresolved_slugs),
                slugs=unresolved_slugs,
            )
        )
    if missing_final_record:
        missing_record_slugs = sorted(
            item["slug"]
            for item in selected
            if "missing_final_record" in item["blocking_issues"]
        )
        blocking_issues.append(
            build_issue(
                "missing_final_record",
                f"{len(missing_record_slugs)} approved item(s) are missing final_record payloads.",
                "The import step only works from final curated records. Missing final_record means the queue is incomplete.",
                "Rebuild the manual review queue from the canonical AI review artifact, then rerun pre-commit.",
                count=len(missing_record_slugs),
                slugs=missing_record_slugs,
            )
        )
    if missing_import_required_fields:
        invalid_field_slugs = sorted(
            item["slug"]
            for item in selected
            if "missing_import_required_fields" in item["blocking_issues"]
        )
        blocking_issues.append(
            build_issue(
                "missing_import_required_fields",
                f"{len(invalid_field_slugs)} approved item(s) are missing import-required final_record fields.",
                "The import step cannot safely create new promise rows when required fields such as promise_type or campaign_or_official are blank.",
                "Regenerate the batch and queue after repairing upstream record metadata, or edit the final_record payloads before rerunning pre-commit.",
                count=len(invalid_field_slugs),
                slugs=invalid_field_slugs,
            )
        )
    if ai_manual_review_required:
        blocked_slugs = sorted(
            item["slug"]
            for item in selected
            if "ai_manual_review_required" in item["blocking_issues"]
        )
        blocking_issues.append(
            build_issue(
                "ai_manual_review_required",
                f"{len(blocked_slugs)} approved item(s) still require manual review according to the AI review artifact.",
                "Items marked needs_manual_review are not cleared for safe production import.",
                "Keep those items out of import or strengthen the record until the AI/manual review result no longer requires manual review, then rerun pre-commit.",
                count=len(blocked_slugs),
                slugs=blocked_slugs,
            )
        )
    if missing_black_impact_scope:
        blocked_slugs = sorted(
            item["slug"]
            for item in selected
            if "missing_black_impact_scope" in item["blocking_issues"]
        )
        blocking_issues.append(
            build_issue(
                "missing_black_impact_scope",
                f"{len(blocked_slugs)} approved item(s) do not contain an affirmative Black-impact rationale.",
                "Current-administration records on EquityStack should explicitly connect the record to effects on Black Americans, not just document a generic federal action.",
                "Add an affirmative Black-impact rationale in impacted_group, notes, or outcome black_community_impact_note, or keep the item out of production.",
                count=len(blocked_slugs),
                slugs=blocked_slugs,
            )
        )

    if blocking_issues:
        readiness = "blocked"
        if not selected:
            next_step = "Approve the intended queue items or keep them pending, then rerun pre-commit review."
        elif missing_decision_coverage or invalid_operator_action:
            next_step = "Refresh or correct the decision file, rerun current-admin review, then rerun pre-commit review."
        elif operator_action_not_import_ready:
            next_step = "Resolve the non-import-ready operator actions in the decision file or queue, then rerun pre-commit review."
        elif missing_final_record:
            next_step = "Rebuild or repair the manual review queue so approved items have final_record payloads, then rerun pre-commit review."
        elif missing_import_required_fields:
            next_step = "Regenerate the batch and queue after fixing missing final_record metadata, then rerun pre-commit review."
        elif ai_manual_review_required:
            next_step = "Remove manual-review-only items from the import set or improve the evidence until they clear review, then rerun pre-commit review."
        elif missing_black_impact_scope:
            next_step = "Add an affirmative Black-impact rationale or remove those items from the import set, then rerun pre-commit review."
        else:
            next_step = "Resolve the blocking issues, then rerun pre-commit review."
    elif any(count > 0 for count in warning_counts.values()):
        readiness = "ready_with_warnings"
        next_step = "Review the warnings, then run a dry-run import if the queue still looks correct."
    else:
        readiness = "ready"
        next_step = "Run a dry-run import, then apply only after reviewing the import report."

    return readiness, blocking_issues, warning_counts, next_step


def summarize_diff_preview(
    queue_items: list[dict[str, Any]], decision_map: dict[str, dict[str, Any]]
) -> dict[str, list[dict[str, Any]]]:
    new_records: list[dict[str, Any]] = []
    updated_records: list[dict[str, Any]] = []
    skipped_items: list[dict[str, Any]] = []

    for queue_item in queue_items:
        if not isinstance(queue_item, dict):
            continue
        slug = queue_item.get("slug")
        ai_review = queue_item.get("ai_review") or {}
        suggestions = ai_review.get("suggestions") or {}
        title = (
            queue_item.get("final_record", {}).get("title")
            or queue_item.get("original_record", {}).get("title")
            or ai_review.get("title")
        )
        decision_item = decision_map.get(slug) or {}
        operator_action = decision_item.get("operator_action") or embedded_operator_action(queue_item)
        approved = bool(queue_item.get("approved") or queue_item.get("operator_status") == "approved")
        entry = {
            "slug": slug,
            "title": title,
            "operator_action": operator_action,
            "decision_alignment": decision_item.get("decision_alignment") or queue_item.get("decision_alignment"),
        }

        if approved and operator_action in APPROVAL_ACTIONS:
            preview_text = (
                "update record"
                if suggestions.get("record_action_suggestion") == "update_existing"
                else "new record"
            )
            preview_entry = {
                **entry,
                "preview": preview_text,
                "reason": action_label(operator_action),
            }
            if suggestions.get("record_action_suggestion") == "update_existing":
                updated_records.append(preview_entry)
            else:
                new_records.append(preview_entry)
        else:
            skipped_items.append(
                {
                    **entry,
                    "preview": "skip from import",
                    "reason": action_label(operator_action)
                    if operator_action
                    else queue_item.get("operator_status") or "not approved",
                }
            )

    return {
        "new_records": new_records,
        "updated_records": updated_records,
        "skipped_items": skipped_items,
    }


def build_linkage_summary(
    *,
    batch_name: str,
    queue_payload: dict[str, Any],
    decision_log_payload: dict[str, Any] | None,
    decision_template_payload: dict[str, Any] | None,
    source_review_payload: dict[str, Any] | None,
    source_review_path: str | None,
    decision_log_source_review: str | None,
    decision_template_source_review: str | None,
    resolved_decision_log: Path | None,
    resolved_decision_template: Path | None,
) -> tuple[dict[str, str], list[dict[str, Any]], list[dict[str, Any]]]:
    blockers: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []

    queue_items = queue_review_coverage_items(queue_payload)
    queue_slugs = unique_slug_list(queue_items)
    queue_duplicates = find_duplicates(queue_slugs)

    review_items = [item for item in (source_review_payload or {}).get("items") or [] if isinstance(item, dict)]
    review_slugs = unique_slug_list(review_items)
    review_duplicates = find_duplicates(review_slugs)
    review_slug_set = set(review_slugs)
    queue_slug_set = set(queue_slugs)

    decision_log_items = [item for item in (decision_log_payload or {}).get("items") or [] if isinstance(item, dict)]
    decision_log_slugs = unique_slug_list(decision_log_items)
    decision_log_duplicates = find_duplicates(decision_log_slugs)
    decision_log_slug_set = set(decision_log_slugs)

    decision_template_items = [
        item for item in (decision_template_payload or {}).get("items") or [] if isinstance(item, dict)
    ]
    decision_template_slugs = unique_slug_list(decision_template_items)
    decision_template_duplicates = find_duplicates(decision_template_slugs)
    decision_template_slug_set = set(decision_template_slugs)

    if not isinstance(source_review_path, str) or not source_review_path.strip():
        blockers.append(
            build_issue(
                "missing_source_review_path",
                "Queue artifact is missing source_review_path.",
                "Pre-commit needs to confirm that the queue still points back to the canonical AI review artifact.",
                "Rebuild the manual review queue from the canonical AI review artifact before import.",
            )
        )
    elif source_review_payload is None:
        blockers.append(
            build_issue(
                "missing_review_artifact",
                "The linked AI review artifact could not be loaded.",
                "Without the review artifact, pre-commit cannot confirm queue lineage or review signals.",
                "Restore or regenerate the .ai-review.json artifact, then rerun pre-commit.",
            )
        )

    if queue_duplicates:
        blockers.append(
            build_issue(
                "duplicate_queue_slugs",
                f"Queue contains duplicate slugs: {', '.join(queue_duplicates)}.",
                "Duplicate queue entries create ambiguous import behavior.",
                "Rebuild or repair the manual review queue so each slug appears once.",
                count=len(queue_duplicates),
                slugs=queue_duplicates,
            )
        )
    if review_duplicates:
        blockers.append(
            build_issue(
                "duplicate_review_slugs",
                f"Review artifact contains duplicate slugs: {', '.join(review_duplicates)}.",
                "Review lineage must map one review item to one queue item.",
                "Regenerate the AI review artifact so each slug appears once.",
                count=len(review_duplicates),
                slugs=review_duplicates,
            )
        )
    if decision_log_duplicates:
        blockers.append(
            build_issue(
                "duplicate_decision_log_slugs",
                f"Decision log contains duplicate slugs: {', '.join(decision_log_duplicates)}.",
                "Decision coverage should be one operator decision per slug.",
                "Regenerate or repair the decision log by rerunning current-admin review from the correct decision file.",
                count=len(decision_log_duplicates),
                slugs=decision_log_duplicates,
            )
        )
    if decision_template_duplicates:
        blockers.append(
            build_issue(
                "duplicate_decision_template_slugs",
                f"Decision file contains duplicate slugs: {', '.join(decision_template_duplicates)}.",
                "A decision file should only record one operator decision per slug.",
                "Refresh the decision file and copy your intended decisions into the clean file.",
                count=len(decision_template_duplicates),
                slugs=decision_template_duplicates,
            )
        )

    if source_review_payload is not None:
        missing_from_review = sorted(queue_slug_set - review_slug_set)
        missing_from_queue = sorted(review_slug_set - queue_slug_set)
        if missing_from_review:
            blockers.append(
                build_issue(
                    "queue_review_slug_mismatch",
                    f"{len(missing_from_review)} queue item(s) are not present in the linked review artifact.",
                    "Every queue item should come from the canonical AI review artifact for this batch.",
                    "Rebuild the queue from the matching .ai-review.json artifact before import.",
                    count=len(missing_from_review),
                    slugs=missing_from_review,
                )
            )
        if missing_from_queue:
            warnings.append(
                build_issue(
                    "queue_missing_review_items",
                    f"{len(missing_from_queue)} review item(s) are not present in the queue coverage artifact.",
                    "This can be valid for a filtered slice, but it weakens lineage and should be intentional.",
                    "Confirm the queue artifact intentionally covers only a subset of review items before import.",
                    severity="warning",
                    count=len(missing_from_queue),
                    slugs=missing_from_queue[:20],
                )
            )

    if resolved_decision_log is not None and not decision_log_source_review:
        warnings.append(
            build_issue(
                "decision_log_missing_source_review",
                "Decision log is missing source_review_file metadata.",
                "The log is still readable, but the review lineage is weaker than expected.",
                "Prefer regenerating the decision log with current-admin review so source_review_file is captured.",
                severity="warning",
            )
        )
    if resolved_decision_log is not None and decision_log_source_review and decision_log_source_review != source_review_path:
        blockers.append(
            build_issue(
                "decision_log_review_mismatch",
                "Decision log source_review_file does not match the queue review artifact.",
                "Import should only use decisions recorded against the exact review artifact that built this queue.",
                "Run current-admin review against the matching review artifact, then rerun pre-commit.",
            )
        )
    if resolved_decision_template is not None and decision_template_source_review and decision_template_source_review != source_review_path:
        blockers.append(
            build_issue(
                "decision_template_review_mismatch",
                "Decision file source_review_file does not match the queue review artifact.",
                "The operator should edit a decision template that comes from the same AI review artifact as the queue.",
                "Refresh the decision file from the correct .ai-review.json artifact.",
            )
        )
    if source_review_payload is not None and decision_log_items:
        log_outside_review = sorted(decision_log_slug_set - review_slug_set)
        if log_outside_review:
            blockers.append(
                build_issue(
                    "decision_log_outside_review_slice",
                    f"{len(log_outside_review)} decision-log slug(s) are not present in the linked review artifact.",
                    "This suggests the decision log was created from a different review slice or batch.",
                    "Regenerate the decision log from the matching decision file and review artifact.",
                    count=len(log_outside_review),
                    slugs=log_outside_review,
                )
            )
    if source_review_payload is not None and decision_template_items:
        template_outside_review = sorted(decision_template_slug_set - review_slug_set)
        if template_outside_review:
            blockers.append(
                build_issue(
                "decision_template_outside_review_slice",
                f"{len(template_outside_review)} decision-file slug(s) are not present in the linked review artifact.",
                "This suggests the decision file came from a different review slice or batch.",
                "Refresh the decision file from the correct .ai-review.json artifact.",
                count=len(template_outside_review),
                slugs=template_outside_review,
            )
            )
        if len(decision_template_items) != len(review_items):
            warnings.append(
                build_issue(
                    "decision_template_partial_slice",
                    f"Decision file contains {len(decision_template_items)} item(s), while the review artifact contains {len(review_items)}.",
                    "This is fine for a focused worklist, but it means the decision file is not a full-batch slice.",
                    "Confirm that the approved queue items are covered by the decision file or decision log before import.",
                    severity="warning",
                    count=abs(len(decision_template_items) - len(review_items)),
                )
            )

    linkage = {
        "queue_to_review": "ok"
        if source_review_payload is not None and not queue_duplicates and not (queue_slug_set - review_slug_set)
        else "missing_or_mismatched",
        "decision_template_to_review": "ok"
        if resolved_decision_template is not None and not decision_template_duplicates and decision_template_source_review == source_review_path
        else "missing"
        if resolved_decision_template is None
        else "missing_or_mismatched",
        "decision_log_to_review": "ok"
        if resolved_decision_log is not None and not decision_log_duplicates and decision_log_source_review == source_review_path
        else "missing"
        if resolved_decision_log is None
        else "missing_or_mismatched",
    }

    return linkage, blockers, warnings


def supports_color() -> bool:
    return sys.stdout.isatty() and os.environ.get("NO_COLOR") is None


def paint(text: str, color: str) -> str:
    if not supports_color():
        return text
    codes = {
        "red": "\033[31m",
        "yellow": "\033[33m",
        "green": "\033[32m",
        "cyan": "\033[36m",
        "bold": "\033[1m",
        "reset": "\033[0m",
    }
    return f"{codes[color]}{text}{codes['reset']}"


def format_issue(issue: dict[str, Any]) -> list[str]:
    lines = [f"- {issue.get('message')}"]
    why = issue.get("why")
    fix = issue.get("fix")
    if why:
        lines.append(f"  Why: {why}")
    if fix:
        lines.append(f"  Fix: {fix}")
    if issue.get("slugs"):
        lines.append(f"  Slugs: {', '.join(issue['slugs'][:10])}")
    return lines


def print_terminal_summary(payload: dict[str, Any], output_path: Path, csv_path: Path | None) -> None:
    status = payload["readiness_status"]
    color = "green" if status == "ready" else "yellow" if status == "ready_with_warnings" else "red"
    label = READINESS_DETAILS[status]["label"]

    print(paint("STATUS", "bold"))
    print(f"Batch: {payload['batch_name']}")
    print(f"Readiness: {paint(label, color)}")
    print(f"Meaning: {payload['readiness_explanation']}")
    print(f"Artifact: {output_path}")
    if csv_path:
        print(f"CSV: {csv_path}")
    print()

    print(paint("SUMMARY", "bold"))
    summary = payload["summary"]
    print(f"Total items: {summary['total_items']}")
    print(f"Approved items: {summary['approved_items']}")
    print(f"Manual-review items: {summary['manual_review_items']}")
    print(f"Missing decisions: {summary['missing_decisions']}")
    print(f"Invalid actions: {summary['invalid_actions']}")
    print(f"High-attention items: {summary['high_attention_items']}")
    print(f"Low-confidence items: {summary['low_confidence_items']}")
    print()

    print(paint("BLOCKERS", "bold"))
    if payload["blocking_issues"]:
        for issue in payload["blocking_issues"]:
            for line in format_issue(issue):
                print(line)
    else:
        print("- None")
    print()

    print(paint("WARNINGS", "bold"))
    warning_sections = list(payload["linkage_warnings"])
    if payload["readiness_status"] == "ready_with_warnings":
        warning_sections.append(
            build_issue(
                "readiness_warning",
                "Import can proceed, but warnings are still present.",
                "Warnings do not stop import, but they deserve a human check before you move forward.",
                payload["recommended_next_step"],
                severity="warning",
            )
        )
    if warning_sections:
        for issue in warning_sections:
            for line in format_issue(issue):
                print(line)
    else:
        print("- None")
    print()

    print(paint("DIFF PREVIEW", "bold"))
    preview = payload["diff_preview"]
    for label_text, key, symbol in (
        ("New records", "new_records", "+"),
        ("Updated records", "updated_records", "~"),
        ("Skipped items", "skipped_items", "-"),
    ):
        print(f"{label_text}: {len(preview[key])}")
        for entry in preview[key][:10]:
            print(f"  {symbol} {entry['slug']}: {entry['title']} ({entry['reason']})")
    print()

    print(paint("NEXT STEP", "bold"))
    print(payload["recommended_next_step"])


def main() -> None:
    args = parse_args()
    queue_path = args.input.resolve()
    queue_payload = load_queue(queue_path)
    batch_name = queue_payload.get("batch_name")
    if not isinstance(batch_name, str) or not batch_name.strip():
        raise ValueError("Queue input is missing batch_name.")
    source_review_path = queue_payload.get("source_review_path")
    source_review_resolved = Path(source_review_path).resolve() if isinstance(source_review_path, str) and source_review_path else None
    source_review_payload = load_optional_payload(source_review_resolved, "Review artifact") if source_review_resolved and source_review_resolved.exists() else None
    source_review_batch = read_batch_name_from_review_payload_or_path(source_review_payload, source_review_path)
    openai_batch_safety = (
        evaluate_review_batch_safety(source_review_resolved)
        if source_review_resolved and source_review_resolved.exists()
        else None
    )

    decision_template_path = queue_path.parent / f"{batch_name}.decision-template.json"
    decision_template_payload = load_optional_payload(decision_template_path, "Decision template") if decision_template_path.exists() else None
    decision_template_source_review = (
        decision_template_payload.get("source_review_file")
        if isinstance(decision_template_payload, dict)
        else None
    )

    decision_log_path = args.decision_log.resolve() if args.decision_log else resolve_default_decision_log(queue_path, batch_name)
    decisions_by_slug, resolved_decision_log = load_decision_log(decision_log_path)
    decision_log_source_review = None
    decision_log_source_batch = None
    decision_payload = None
    if resolved_decision_log is not None:
        decision_payload = load_json_file(resolved_decision_log)
        if not isinstance(decision_payload, dict):
            raise ValueError("Decision log must be a JSON object.")
        decision_log_source_review = decision_payload.get("source_review_file")
        decision_log_source_batch = (
            source_review_batch
            if decision_log_source_review == source_review_path
            else read_batch_name_from_review_path(decision_log_source_review)
        )

    queue_items_for_review = queue_manual_items(queue_payload) + queue_auto_approved_items(queue_payload)
    items = [
        summarize_item(queue_item, decisions_by_slug.get(queue_item.get("slug")))
        for queue_item in queue_items_for_review
    ]
    readiness, blocking_issues, warning_counts, next_step = determine_overall_readiness(items)
    selected = [item for item in items if item["selected_for_import"]]
    linkage, linkage_blockers, linkage_warnings = build_linkage_summary(
        batch_name=batch_name,
        queue_payload=queue_payload,
        decision_log_payload=decision_payload,
        decision_template_payload=decision_template_payload,
        source_review_payload=source_review_payload,
        source_review_path=source_review_path,
        decision_log_source_review=decision_log_source_review,
        decision_template_source_review=decision_template_source_review,
        resolved_decision_log=resolved_decision_log,
        resolved_decision_template=decision_template_path if decision_template_payload else None,
    )

    if source_review_batch and source_review_batch != batch_name:
        linkage_blockers.append(
            build_issue(
                "queue_review_batch_mismatch",
                "Queue source_review_path does not match the queue batch_name.",
                "The queue should be linked to the review artifact from the same batch.",
                "Rebuild the manual review queue before import.",
            )
        )
    if resolved_decision_log is not None and decision_log_source_batch and decision_log_source_batch != batch_name:
        linkage_blockers.append(
            build_issue(
                "decision_log_batch_mismatch",
                "Decision log source_review_file does not match the queue batch_name.",
                "The decision log should come from the same review batch as the queue.",
                "Run current-admin review against the matching review artifact before import.",
            )
        )
    if openai_batch_safety and openai_batch_safety.get("blocking_issues"):
        for issue in openai_batch_safety["blocking_issues"]:
            linkage_blockers.append(
                build_issue(
                    issue.get("type") or "openai_batch_not_ready",
                    issue.get("message") or "OpenAI Batch review sidecars are not ready.",
                    "Pre-commit must use a completed, fetched, validated Batch review artifact before import.",
                    issue.get("fix") or "Run current-admin ai-review with --batch-resume, then rerun pre-commit.",
                )
            )
    if openai_batch_safety:
        for issue in openai_batch_safety.get("warnings") or []:
            linkage_warnings.append(
                build_issue(
                    issue.get("type") or "openai_batch_warning",
                    issue.get("message") or "OpenAI Batch sidecar warning.",
                    "This warning does not block legacy or dry-run review artifacts.",
                    "If this should be an OpenAI Batch artifact, run current-admin ai-review --batch-inspect.",
                    severity="warning",
                )
            )

    if linkage_blockers:
        blocking_issues.extend(linkage_blockers)
        readiness = "blocked"
        next_step = "Resolve the blocking issues, then rerun pre-commit review."

    summary = {
        "total_items": len(items),
        "approved_items": len(selected),
        "manual_review_items": len(queue_manual_items(queue_payload)),
        "missing_decisions": sum(1 for item in selected if not item["operator_action"]),
        "invalid_actions": sum(
            1 for item in selected if item["operator_action"] and item["operator_action_valid"] is False
        ),
        "high_attention_items": sum(
            1 for item in selected if "high_attention_item" in item["warning_signals"]
        ),
        "low_confidence_items": sum(
            1 for item in selected if "low_confidence" in item["warning_signals"]
        ),
    }
    low_confidence_items = [
        {
            "slug": item["slug"],
            "title": item["title"],
            "confidence_score": item["confidence_score"],
            "confidence_level": item["confidence_level"],
        }
        for item in selected
        if "low_confidence" in item["warning_signals"]
    ]
    diff_preview = summarize_diff_preview(queue_items_for_review, decisions_by_slug)

    payload = {
        "batch_name": batch_name,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_queue_file": str(queue_path),
        "source_review_file": source_review_path,
        "source_decision_template": str(decision_template_path) if decision_template_payload else None,
        "source_decision_log": str(resolved_decision_log) if resolved_decision_log else None,
        "decision_template_source_review_file": decision_template_source_review,
        "decision_log_source_review_file": decision_log_source_review,
        "reviewed_item_count": len((source_review_payload or {}).get("items") or []),
        "decision_log_resolution": (
            "explicit"
            if args.decision_log
            else "auto"
            if resolved_decision_log
            else "none"
        ),
        "artifact_linkage": linkage,
        "openai_batch_safety": openai_batch_safety,
        "total_item_count": len(items),
        "selected_for_import_count": len(selected),
        "decision_covered_count": sum(1 for item in selected if item["operator_action"]),
        "decision_missing_count": sum(1 for item in selected if not item["operator_action"]),
        "invalid_operator_action_count": sum(
            1 for item in selected if item["operator_action"] and item["operator_action_valid"] is False
        ),
        "unresolved_manual_review_count": sum(
            1 for item in selected if item["operator_action"] in NON_READY_ACTIONS
        ),
        "material_conflict_count": warning_counts["material_conflict_present"],
        "source_gap_count": warning_counts["source_or_evidence_gaps"],
        "high_attention_count": warning_counts["high_attention_item"],
        "readiness_status": readiness,
        "readiness_label": READINESS_DETAILS[readiness]["label"],
        "readiness_explanation": READINESS_FORMULA[readiness],
        "readiness_details": READINESS_DETAILS[readiness],
        "readiness_formula": READINESS_FORMULA,
        "summary": summary,
        "warning_counts": warning_counts,
        "blocking_issues": blocking_issues,
        "linkage_warnings": linkage_warnings,
        "low_confidence_items": low_confidence_items,
        "diff_preview": diff_preview,
        "recommended_next_step": next_step,
        "items": items,
    }

    output_path = args.output or resolve_default_report_path(batch_name, "pre-commit-review")
    write_json_file(output_path, payload)

    csv_path = derive_csv_path(args.csv, output_path)
    if csv_path:
        write_csv_rows(csv_path, items)

    if args.json:
        print_json(
            {
                "batch_name": batch_name,
                "pre_commit_output_path": str(output_path),
                "readiness_status": readiness,
                "selected_for_import_count": len(selected),
                "blocking_issue_count": len(blocking_issues),
                "invalid_operator_action_count": payload["invalid_operator_action_count"],
                "blocking_issues": blocking_issues,
                "linkage_warnings": linkage_warnings,
                "warning_counts": warning_counts,
                "recommended_next_step": next_step,
            }
        )
    else:
        print_terminal_summary(payload, output_path, csv_path)


if __name__ == "__main__":
    try:
        main()
    except (FileNotFoundError, ValueError) as exc:
        raise SystemExit(str(exc)) from exc
