#!/usr/bin/env python3
"""
Run conservative OpenAI Batch review over a normalized current-administration batch.

This preserves the existing current-admin ai-review artifact shape so the manual
queue, decision-template, finalize, pre-commit, and import flows keep working.
"""

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
import time
from pathlib import Path
from typing import Any

from current_admin_common import (
    derive_csv_path,
    get_db_connection,
    get_project_root,
    map_evidence_strength,
    normalize_nullable_text,
    print_json,
    read_batch_payload,
    resolve_default_report_path,
    slugify,
    write_csv_rows,
    write_json_file,
)
from openai_batch_common import (
    OpenAIBatchClient,
    load_openai_env_values,
    resolve_openai_api_key,
    resolve_openai_base_url,
)
from current_admin_openai_batch_guardrails import (
    ARTIFACT_VERSION,
    INCOMPLETE_BATCH_STATUSES,
    TERMINAL_BATCH_STATUSES,
    batch_artifact_path,
    error_path_for_review,
    evaluate_review_batch_safety,
    load_batch_metadata,
    metadata_path_for_review,
    output_path_for_review,
    require_review_batch_safe,
    validation_path_for_review,
)
from current_admin_evidence_pack import (
    build_evidence_pack_artifact,
    build_evidence_pack_for_record,
    evidence_pack_path_for_review,
    write_evidence_pack_artifact,
)


DEFAULT_MODEL = "gpt-4.1"
DEFAULT_MODEL_SENIOR = DEFAULT_MODEL
DEFAULT_MODEL_VERIFIER = DEFAULT_MODEL
DEFAULT_MODEL_FALLBACK = DEFAULT_MODEL
DEFAULT_COMPLETION_WINDOW = "24h"
DEFAULT_POLL_INTERVAL_SECONDS = 15
DEFAULT_WAIT_TIMEOUT_SECONDS = 3600
DEFAULT_TEMPERATURE = 0.0
LEGACY_MODEL_NAMES = {"qwen3.5:9b", "rnj-1:latest"}
VALID_STATUSES = {"In Progress", "Partial", "Delivered", "Blocked", "Failed"}
VALID_IMPACT_DIRECTIONS = {"Positive", "Negative", "Mixed", "Blocked"}
VALID_EVIDENCE_STRENGTHS = {"Strong", "Moderate", "Limited"}
VALID_RECORD_ACTIONS = {"new_record", "update_existing", "manual_review"}
VALID_REVIEW_MODES = {"standard", "deep"}
VALID_OPERATOR_ACTIONS = {
    "approve_as_is",
    "approve_with_changes",
    "manual_review_required",
    "needs_more_sources",
    "defer",
    "reject",
    "escalate",
}
SUGGESTED_BATCH_DESCRIPTIONS = {
    "high_attention": "High-risk items with material conflicts, low confidence, or strong review-priority signals.",
    "manual_review_focus": "Items that still center on manual review judgment or unresolved new-vs-update decisions.",
    "deep_review_candidates": "Items that still warrant a deeper advisory pass before the operator proceeds.",
    "source_check_needed": "Items that mainly need stronger sourcing or evidence support before import.",
    "likely_straightforward": "Lower-risk items with fewer warning signals and no strong attention flags.",
}
SESSION_FOCUS_TO_BATCH = {
    "high_attention_first": "high_attention",
    "manual_review_session": "manual_review_focus",
    "source_check_session": "source_check_needed",
    "deep_review_followup": "deep_review_candidates",
    "straightforward_pass": "likely_straightforward",
}
SESSION_FOCUS_REASONS = {
    "high_attention_first": "Focus this session on the highest-risk and highest-conflict items first.",
    "manual_review_session": "Focus this session on items that still hinge on explicit manual-review judgment.",
    "source_check_session": "Focus this session on items that mainly need stronger source or evidence support.",
    "deep_review_followup": "Focus this session on items that still look like deep-review follow-up candidates.",
    "straightforward_pass": "Focus this session on comparatively straightforward items for a lighter review pass.",
}
VALID_CLASSIFICATIONS = {"positive", "negative", "mixed", "blocked", "unclear"}
VALID_RECOMMENDED_ACTIONS = {"approve", "reject", "needs_manual_review"}
VALID_SOURCE_QUALITIES = {"high", "medium", "low"}
VALID_IMPACT_STATUSES = {"impact_scored", "impact_pending", "insufficient_evidence", "needs_manual_review"}
REQUIRED_CLASSIFIER_FIELDS = {
    "entity_type",
    "entity_id",
    "recommended_action",
    "classification",
    "confidence",
    "summary",
    "reasoning_notes",
    "missing_information",
    "source_quality",
    "source_issues",
    "flags",
}
REQUIRED_CLASSIFIER_FLAG_FIELDS = {
    "ambiguous_subject",
    "conflicting_sources",
    "weak_evidence",
    "date_uncertain",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run a conservative OpenAI Batch review over a normalized current-administration batch."
    )
    parser.add_argument(
        "--input",
        type=Path,
        required=True,
        help="Normalized current-admin batch JSON or an existing .ai-review.json artifact.",
    )
    parser.add_argument("--output", type=Path, help="AI review report JSON output")
    parser.add_argument("--model", default=None, help="OpenAI review model name")
    parser.add_argument(
        "--verifier-model",
        default=DEFAULT_MODEL_VERIFIER,
        help="Compatibility-only flag preserved for existing wrappers.",
    )
    parser.add_argument(
        "--fallback-model",
        default=DEFAULT_MODEL_FALLBACK,
        help="Compatibility-only flag preserved for existing wrappers.",
    )
    parser.add_argument(
        "--review-mode",
        choices=sorted(VALID_REVIEW_MODES),
        default="deep",
        help="Compatibility-only review depth flag. OpenAI Batch review currently runs a single conservative pass.",
    )
    parser.add_argument("--deep-review", action="store_true", help="Shortcut for --review-mode deep")
    parser.add_argument(
        "--packaging-mode",
        choices=("baseline", "enriched"),
        default="enriched",
        help="Model-input packaging mode. baseline omits evidence_pack; enriched includes deterministic evidence_pack.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Skip OpenAI calls and emit conservative heuristic rows")
    parser.add_argument("--max-items", type=int, help="Limit the number of records reviewed")
    parser.add_argument("--only-slug", action="append", help="Limit review to one or more promise slugs")
    parser.add_argument("--sort-by-priority", action="store_true", help="Sort the display output by review_priority_score")
    parser.add_argument("--descending", action="store_true", help="Reverse the selected display sort order")
    parser.add_argument("--priority", help="Limit the display output to one or more priorities: low, medium, high")
    parser.add_argument("--attention-needed", action="store_true", help="Limit the display output to items where operator_attention_needed is true")
    parser.add_argument("--suggested-batch", help="Limit the display output to one or more suggested batches")
    parser.add_argument("--with-conflicts", action="store_true", help="Limit the display output to items with material conflicts")
    parser.add_argument("--deep-review-recommended", action="store_true", help="Limit the display output to items where deep review is recommended")
    parser.add_argument("--manual-review-severity", help="Limit the display output to one or more manual review severities: low, medium, high")
    parser.add_argument("--session-focus", choices=sorted(SESSION_FOCUS_TO_BATCH), help="Apply a named advisory session focus based on suggested batching")
    parser.add_argument("--export-worklist", type=Path, help="Optionally export the selected review slice as a JSON worklist")
    parser.add_argument("--decision-file", type=Path, help="Optional JSON file containing explicit operator decisions for reviewed items")
    parser.add_argument("--log-decisions", nargs="?", const="", help="Optionally write a decision log JSON. Pass a path or omit the value to write under reports/current_admin/review_decisions/")
    parser.add_argument("--preview", action="store_true", help="Print a condensed operator-facing preview instead of the full JSON report")
    parser.add_argument("--summary", action="store_true", help="Print a human-readable review summary instead of the full JSON report")
    parser.add_argument("--batch-status", action="store_true", help="Show local and remote OpenAI Batch lifecycle status without resubmitting.")
    parser.add_argument("--batch-poll", action="store_true", help="Poll an existing OpenAI Batch from local metadata without resubmitting.")
    parser.add_argument("--batch-fetch", action="store_true", help="Fetch available OpenAI Batch output/error files from local metadata without resubmitting.")
    parser.add_argument("--batch-inspect", action="store_true", help="Print a concise operator-facing Batch readiness summary.")
    parser.add_argument("--batch-resume", action="store_true", help="Poll/fetch/rebuild from local OpenAI Batch metadata without creating a duplicate batch.")
    parser.add_argument("--evidence-preview", action="store_true", help="Build and print the model-facing evidence-pack sidecar without submitting review.")
    parser.add_argument("--timeout", type=int, help="Compatibility-only timeout flag preserved for existing wrappers")
    parser.add_argument("--senior-timeout", type=int, help="Compatibility-only timeout flag preserved for existing wrappers")
    parser.add_argument("--verifier-timeout", type=int, help="Compatibility-only timeout flag preserved for existing wrappers")
    parser.add_argument("--temperature", type=float, default=DEFAULT_TEMPERATURE, help="Sampling temperature used for the Responses API")
    parser.add_argument("--openai-base-url", default="", help="Optional OpenAI-compatible base URL override")
    parser.add_argument(
        "--completion-window",
        default=DEFAULT_COMPLETION_WINDOW,
        help="Batch completion window. OpenAI currently supports 24h.",
    )
    parser.add_argument(
        "--poll-interval-seconds",
        type=int,
        default=DEFAULT_POLL_INTERVAL_SECONDS,
        help="How often to poll batch status while waiting for completion.",
    )
    parser.add_argument(
        "--wait-timeout-seconds",
        type=int,
        default=DEFAULT_WAIT_TIMEOUT_SECONDS,
        help="How long to wait for the batch to complete before failing.",
    )
    parser.add_argument(
        "--csv",
        nargs="?",
        const="",
        help="Optionally write a CSV review summary. Pass a path or omit the value to derive one from --output.",
    )
    args = parser.parse_args()
    if args.deep_review:
        args.review_mode = "deep"
    if args.priority:
        args.priority = [part.strip().lower() for part in args.priority.split(",") if part.strip()]
    if args.suggested_batch:
        args.suggested_batch = [part.strip().lower() for part in args.suggested_batch.split(",") if part.strip()]
    if args.manual_review_severity:
        args.manual_review_severity = [part.strip().lower() for part in args.manual_review_severity.split(",") if part.strip()]
    if args.poll_interval_seconds <= 0:
        parser.error("--poll-interval-seconds must be greater than 0")
    if args.wait_timeout_seconds <= 0:
        parser.error("--wait-timeout-seconds must be greater than 0")
    lifecycle_flags = [
        args.batch_status,
        args.batch_poll,
        args.batch_fetch,
        args.batch_inspect,
        args.batch_resume,
    ]
    if sum(1 for enabled in lifecycle_flags if enabled) > 1:
        parser.error("Use only one of --batch-status, --batch-poll, --batch-fetch, --batch-inspect, or --batch-resume.")
    return args


def fetch_existing_matches(record: dict[str, Any]) -> list[dict[str, Any]]:
    try:
        connection = get_db_connection()
    except Exception:  # noqa: BLE001
        return []

    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT title, slug, summary, topic, impacted_group, status, action_sources, outcome_sources, created_at, updated_at FROM promises WHERE slug = %s OR title = %s ORDER BY id ASC LIMIT 5",
                (record.get("slug"), record.get("title")),
            )
            return cursor.fetchall()
    except Exception:  # noqa: BLE001
        return []
    finally:
        connection.close()


def source_warnings(record: dict[str, Any]) -> list[str]:
    warnings: list[str] = []
    if not (record.get("promise_sources") or []):
        warnings.append("missing_promise_source")

    actions = record.get("actions") or []
    if not actions:
        warnings.append("missing_action")

    for action in actions:
        if not (action.get("action_sources") or []):
            warnings.append("missing_action_source")
        outcomes = action.get("outcomes") or []
        if not outcomes:
            warnings.append("missing_outcome")
        for outcome in outcomes:
            if not (outcome.get("outcome_sources") or []):
                warnings.append("missing_outcome_source")
            if map_evidence_strength(outcome.get("evidence_strength")) in {None, "Limited"}:
                warnings.append("weak_or_limited_outcome_evidence")

    return sorted(set(warnings))


def normalize_string_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [item.strip() for item in (normalize_nullable_text(item) for item in value) if item]
    if value in (None, ""):
        return []
    text = normalize_nullable_text(value)
    return [text] if text else []


def normalize_confidence_score(value: Any) -> float:
    if isinstance(value, (int, float)):
        return round(max(0.0, min(1.0, float(value))), 2)
    text = (normalize_nullable_text(value) or "").lower()
    mapping = {"high": 0.85, "medium": 0.6, "low": 0.35}
    return round(mapping.get(text, 0.5), 2)


def normalize_confidence_level(value: Any, score: float) -> str:
    text = normalize_nullable_text(value)
    if text in {"High", "Medium", "Low"}:
        return text
    if score >= 0.8:
        return "High"
    if score >= 0.55:
        return "Medium"
    return "Low"


def normalize_machine_flag(value: Any) -> str | None:
    text = normalize_nullable_text(value)
    if not text:
        return None
    return text.lower().replace(" ", "_").replace("-", "_")


def first_outcome(record: dict[str, Any]) -> dict[str, Any]:
    return (((record.get("actions") or [{}])[0]).get("outcomes") or [{}])[0]


def map_classification_to_direction(classification: str, record: dict[str, Any]) -> str:
    mapping = {
        "positive": "Positive",
        "negative": "Negative",
        "mixed": "Mixed",
        "blocked": "Blocked",
    }
    if classification in mapping:
        return mapping[classification]
    current = normalize_nullable_text(first_outcome(record).get("impact_direction"))
    return current if current in VALID_IMPACT_DIRECTIONS else "Mixed"


def map_source_quality_to_evidence_strength(source_quality: str) -> str:
    if source_quality == "high":
        return "Strong"
    if source_quality == "medium":
        return "Moderate"
    return "Limited"


def impact_status_for_classifier(
    classifier: dict[str, Any],
    *,
    confidence_score: float,
) -> tuple[str, str, str]:
    recommended_action = classifier.get("recommended_action")
    source_quality = classifier.get("source_quality") or "low"
    flags = classifier.get("flags") if isinstance(classifier.get("flags"), dict) else {}
    weak_evidence = bool(flags.get("weak_evidence"))
    low_confidence = confidence_score < 0.55

    if (
        weak_evidence
        and low_confidence
        and recommended_action == "needs_manual_review"
        and source_quality in {"medium", "high"}
    ):
        return (
            "impact_pending",
            "import_with_pending_impact",
            "Weak-evidence and low-confidence signals require pending impact handling, but source quality is sufficient for record import review.",
        )
    if recommended_action == "approve":
        return ("impact_scored", "approve", "Impact scoring is structurally available from the current review.")
    if source_quality == "low" or weak_evidence:
        return ("insufficient_evidence", recommended_action or "needs_manual_review", "Impact evidence is insufficient for a scored impact outcome.")
    return ("needs_manual_review", recommended_action or "needs_manual_review", "Impact status still needs operator judgment.")


def normalize_review_confidence(value: Any, score: float | None = None) -> str:
    text = normalize_nullable_text(value)
    if text:
        normalized = text.lower().strip()
        if normalized in {"low", "medium", "high"}:
            return normalized
    if score is None:
        return "low"
    if score >= 0.8:
        return "high"
    if score >= 0.55:
        return "medium"
    return "low"


def normalize_review_source_quality(value: Any) -> str:
    text = normalize_nullable_text(value)
    if not text:
        return "low"
    normalized = text.lower().strip()
    if normalized in {"strong", "high"}:
        return "high"
    if normalized in {"moderate", "medium"}:
        return "medium"
    if normalized in {"weak", "limited", "low"}:
        return "low"
    return "low"


def normalize_review_recommended_action(
    operator_next_action: Any,
    existing_recommended_action: Any,
) -> str:
    next_action = normalize_nullable_text(operator_next_action)
    if next_action == "manual_review_required":
        return "needs_manual_review"

    existing = normalize_nullable_text(existing_recommended_action)
    if existing in VALID_RECOMMENDED_ACTIONS or existing == "import_with_pending_impact":
        return existing

    if next_action == "reject":
        return "reject"
    if next_action in {
        "needs_more_sources",
        "defer",
        "escalate",
        "check_sources_before_import",
        "review_deep_review_output",
    }:
        return "needs_manual_review"
    if next_action in {"approve_as_is", "approve_with_changes", "review_queue_and_dry_run_import"}:
        return "approve"
    return "needs_manual_review"


def normalized_caution_flags_from_item(item: dict[str, Any], suggestions: dict[str, Any]) -> list[str]:
    existing_flags = normalize_string_list(item.get("caution_flags"))
    source_flags = existing_flags or normalize_string_list(suggestions.get("caution_flags"))
    normalized_flags = [
        flag
        for flag in (normalize_machine_flag(value) for value in source_flags)
        if flag
    ]
    return sorted(set(normalized_flags))


def normalize_exported_review_item_fields(item: dict[str, Any]) -> dict[str, Any]:
    """Expose stable top-level review fields derived from the nested suggestions block."""
    suggestions = item.get("suggestions") if isinstance(item.get("suggestions"), dict) else {}
    normalized_item = dict(item)

    caution_flags = normalized_caution_flags_from_item(normalized_item, suggestions)
    weak_evidence = "weak_evidence" in caution_flags
    confidence_score = normalize_confidence_score(
        suggestions.get("confidence_score")
        if suggestions.get("confidence_score") is not None
        else normalized_item.get("confidence_score")
    )
    confidence = normalize_review_confidence(
        suggestions.get("confidence_level") or normalized_item.get("confidence"),
        confidence_score,
    )
    source_quality = normalize_review_source_quality(
        suggestions.get("evidence_strength_suggestion") or normalized_item.get("source_quality")
    )
    recommended_action = normalize_review_recommended_action(
        suggestions.get("suggested_operator_next_action"),
        normalized_item.get("recommended_action") or suggestions.get("recommended_action"),
    )

    normalized_item["weak_evidence"] = weak_evidence
    normalized_item["confidence"] = confidence
    normalized_item["confidence_score"] = confidence_score
    normalized_item["recommended_action"] = recommended_action
    normalized_item["source_quality"] = source_quality
    normalized_item["caution_flags"] = caution_flags

    if (
        weak_evidence
        and confidence == "low"
        and recommended_action == "needs_manual_review"
        and source_quality in {"medium", "high"}
    ):
        normalized_item["impact_status"] = "impact_pending"
        normalized_item["recommended_action"] = "import_with_pending_impact"
    else:
        existing_impact_status = normalize_nullable_text(
            normalized_item.get("impact_status") or suggestions.get("impact_status")
        )
        if existing_impact_status in VALID_IMPACT_STATUSES:
            normalized_item["impact_status"] = existing_impact_status

    return normalized_item


def suggested_operator_next_action(
    *,
    confidence_level: str,
    record_action_suggestion: str | None,
    warnings: list[str],
    deep_review_ran: bool,
) -> str:
    if confidence_level == "Low" or record_action_suggestion == "manual_review":
        return "manual_review_required"
    if warnings:
        return "check_sources_before_import"
    if deep_review_ran:
        return "review_deep_review_output"
    return "review_queue_and_dry_run_import"


def build_confidence_details(
    record: dict[str, Any],
    suggestion: dict[str, Any],
    existing_matches: list[dict[str, Any]],
) -> dict[str, Any]:
    signals: list[dict[str, str]] = []

    def add_signal(code: str, direction: str, reason: str) -> None:
        signals.append({"code": code, "direction": direction, "reason": reason})

    confidence_level = suggestion.get("confidence_level")
    confidence_score = float(suggestion.get("confidence_score") or 0.0)
    source_flags = normalize_string_list(suggestion.get("source_warnings"))
    evidence_gaps = normalize_string_list(suggestion.get("evidence_needed_to_reduce_risk"))
    caution_flags = normalize_string_list(suggestion.get("caution_flags"))

    if confidence_level == "Low" or confidence_score < 0.55:
        add_signal("low_confidence", "reduces", "The normalized confidence score remains low after review.")
    elif confidence_level == "High" or confidence_score >= 0.8:
        add_signal("high_confidence", "supports", "The normalized confidence score is strong for this advisory pass.")
    else:
        add_signal("medium_confidence", "mixed", "The normalized confidence score is usable but not decisive.")

    if source_flags:
        add_signal("source_warnings_present", "reduces", "Source warnings remain and reduce trust in the suggestion.")
    else:
        add_signal("source_coverage_present", "supports", "No source warnings were carried into the normalized suggestion.")

    if suggestion.get("record_action_suggestion") == "manual_review":
        add_signal("manual_review_required", "reduces", "The pass recommends manual review instead of a confident import path.")

    if suggestion.get("impact_direction_suggestion") == "Mixed":
        add_signal("mixed_impact_direction", "reduces", "Mixed impact direction makes the downstream interpretation less settled.")

    if evidence_gaps:
        add_signal("evidence_gaps_present", "reduces", "The pass identified evidence gaps that should be closed before import.")

    if existing_matches and suggestion.get("record_action_suggestion") != "update_existing":
        add_signal("existing_match_uncertainty", "reduces", "Existing promise matches exist, but the pass did not confidently resolve this as an update.")

    if "implementation_still_in_progress" in caution_flags or record.get("status") in {"In Progress", "Partial"}:
        add_signal("implementation_in_progress", "mixed", "Implementation is still in progress, which limits certainty about downstream effects.")

    if all(
        normalize_nullable_text(suggestion.get(field))
        for field in (
            "title_normalized",
            "summary_suggestion",
            "topic_suggestion",
            "impacted_group_suggestion",
            "status_suggestion",
            "impact_direction_suggestion",
            "evidence_strength_suggestion",
            "record_action_suggestion",
        )
    ):
        add_signal("core_fields_present", "supports", "Core suggestion fields are populated for operator review.")

    reducing = [signal["reason"] for signal in signals if signal["direction"] == "reduces"]
    supporting = [signal["reason"] for signal in signals if signal["direction"] == "supports"]
    mixed = [signal["reason"] for signal in signals if signal["direction"] == "mixed"]

    reasoning_parts: list[str] = []
    if reducing:
        reasoning_parts.append("Confidence is reduced because " + " ".join(reducing[:2]))
    if supporting:
        reasoning_parts.append("Confidence is supported because " + " ".join(supporting[:2]))
    if mixed:
        reasoning_parts.append("Context that still needs operator judgment: " + " ".join(mixed[:1]))

    reasoning = " ".join(reasoning_parts) if reasoning_parts else "Confidence remains advisory and should be reviewed manually."
    return {
        "confidence_reasoning": reasoning,
        "confidence_signals": signals,
    }


def build_deep_review_recommendation(
    record: dict[str, Any],
    suggestion: dict[str, Any],
    existing_matches: list[dict[str, Any]],
) -> dict[str, Any]:
    signals: list[dict[str, str]] = []

    def add_signal(code: str, reason: str) -> None:
        signals.append({"code": code, "reason": reason})

    if suggestion.get("confidence_level") == "Low" or float(suggestion.get("confidence_score") or 0.0) < 0.55:
        add_signal("low_confidence", "Confidence is low enough that a deeper ambiguity check is warranted.")

    source_flags = normalize_string_list(suggestion.get("source_warnings")) or normalize_string_list(suggestion.get("missing_source_warnings"))
    if source_flags:
        add_signal("weak_source_coverage", "Source coverage is missing or thin for at least part of the record.")

    hesitation_reasons = normalize_string_list(suggestion.get("hesitation_reasons"))
    if len(hesitation_reasons) >= 2:
        add_signal("multiple_hesitation_reasons", "The review surfaced multiple hesitation reasons that should be reconciled.")

    if suggestion.get("record_action_suggestion") == "manual_review":
        add_signal("manual_review_suggested", "The review could not safely resolve whether this record is ready for import.")

    if existing_matches and suggestion.get("record_action_suggestion") != "update_existing":
        add_signal("new_vs_update_uncertainty", "Existing promise matches exist, but the review did not confidently resolve this as an update.")

    if suggestion.get("impact_direction_suggestion") == "Mixed":
        add_signal("mixed_impact_ambiguity", "Impact direction remains mixed and may need a deeper pass to explain why.")

    if normalize_string_list(suggestion.get("evidence_needed_to_reduce_risk")):
        add_signal("evidence_gaps", "The review identified evidence that would make the record safer to import.")

    ambiguity_notes = (normalize_nullable_text(suggestion.get("ambiguity_notes")) or "").lower()
    if any(token in ambiguity_notes for token in ("uncertain", "ambig", "manual", "verify", "fallback")):
        add_signal("ambiguity_notes_present", "The review notes unresolved ambiguity or fallback handling.")

    recommended = bool(signals)
    reason = (
        " ".join(signal["reason"] for signal in signals[:3])
        if recommended
        else "No strong heuristic signals suggest that deep review is needed."
    )

    return {
        "deep_review_recommended": recommended,
        "deep_review_recommendation_reason": reason,
        "deep_review_recommendation_signals": signals,
    }


def build_review_priority(
    final_suggestion: dict[str, Any],
    existing_matches: list[dict[str, Any]],
    recommendation: dict[str, Any],
) -> dict[str, Any]:
    signals: list[dict[str, Any]] = []

    def add_signal(code: str, weight: int, reason: str) -> None:
        signals.append({"code": code, "weight": weight, "reason": reason})

    if recommendation.get("deep_review_recommended"):
        add_signal("deep_review_recommended", 0, "The record already shows signals that justify deeper review.")

    confidence_level = final_suggestion.get("confidence_level")
    confidence_score = float(final_suggestion.get("confidence_score") or 0.0)
    is_low_confidence = confidence_level == "Low" or confidence_score < 0.55
    if is_low_confidence:
        add_signal(
            "low_confidence",
            2 if confidence_score < 0.3 else 1,
            "The final advisory confidence is low.",
        )

    source_warning_count = len(normalize_string_list(final_suggestion.get("source_warnings")))
    evidence_gap_count = len(normalize_string_list(final_suggestion.get("evidence_needed_to_reduce_risk")))
    hesitation_count = len(normalize_string_list(final_suggestion.get("hesitation_reasons")))
    if source_warning_count or evidence_gap_count:
        if source_warning_count >= 5 or evidence_gap_count >= 5:
            add_signal(
                "critical_evidence_gaps",
                3,
                "Source coverage and evidence gaps remain severe on the final suggestion.",
            )
        elif source_warning_count >= 3 or evidence_gap_count >= 3:
            add_signal(
                "evidence_coverage_gaps",
                2,
                "Source coverage or evidence gaps remain substantial on the final suggestion.",
            )
        else:
            add_signal(
                "evidence_coverage_gaps",
                1,
                "Some source coverage or evidence gaps remain on the final suggestion.",
            )

    if hesitation_count >= 4 and not (source_warning_count or evidence_gap_count):
        add_signal("multiple_hesitation_reasons", 1, "The review surfaced multiple hesitation reasons.")

    if (
        final_suggestion.get("record_action_suggestion") == "manual_review"
        and not is_low_confidence
        and not (source_warning_count or evidence_gap_count)
    ):
        add_signal("manual_review_suggested", 1, "The final suggestion still resolves to manual review.")

    if existing_matches and final_suggestion.get("record_action_suggestion") != "update_existing":
        add_signal("new_vs_update_uncertainty", 1, "Existing matches exist but the final suggestion did not clearly resolve this as an update.")

    if (
        final_suggestion.get("impact_direction_suggestion") == "Mixed"
        and not is_low_confidence
        and final_suggestion.get("record_action_suggestion") != "manual_review"
    ):
        add_signal("mixed_impact_direction", 1, "Impact direction remains mixed and needs careful operator interpretation.")

    priority_score = min(sum(int(signal["weight"]) for signal in signals), 10)
    if priority_score >= 5:
        review_priority = "high"
        manual_review_severity = "high"
    elif priority_score >= 2:
        review_priority = "medium"
        manual_review_severity = "medium"
    else:
        review_priority = "low"
        manual_review_severity = "low"

    operator_attention_needed = review_priority != "low" or final_suggestion.get("suggested_operator_next_action") in {
        "manual_review_required",
        "check_sources_before_import",
    }

    if not signals:
        reason = "Low-risk advisory profile based on the current review signals."
    else:
        ordered = sorted(
            [signal for signal in signals if int(signal["weight"]) > 0] or signals,
            key=lambda item: (-int(item["weight"]), item["code"]),
        )
        reason = " ".join(signal["reason"] for signal in ordered[:3])

    return {
        "review_priority": review_priority,
        "review_priority_score": priority_score,
        "review_priority_reason": reason,
        "review_priority_signals": signals,
        "manual_review_severity": manual_review_severity,
        "operator_attention_needed": operator_attention_needed,
    }


def build_suggested_batch(
    final_suggestion: dict[str, Any],
    existing_matches: list[dict[str, Any]],
    recommendation: dict[str, Any],
    review_priority: dict[str, Any],
) -> dict[str, Any]:
    tags: list[str] = []

    def add_tag(tag: str) -> None:
        if tag not in tags:
            tags.append(tag)

    if review_priority.get("review_priority") == "high":
        add_tag("high_attention")

    if final_suggestion.get("record_action_suggestion") == "manual_review" or final_suggestion.get("suggested_operator_next_action") == "manual_review_required":
        add_tag("manual_review_focus")

    if recommendation.get("deep_review_recommended"):
        add_tag("deep_review_candidates")

    if normalize_string_list(final_suggestion.get("source_warnings")) or normalize_string_list(final_suggestion.get("evidence_needed_to_reduce_risk")):
        add_tag("source_check_needed")

    if existing_matches and final_suggestion.get("record_action_suggestion") != "update_existing":
        add_tag("manual_review_focus")

    low_risk = (
        review_priority.get("review_priority") == "low"
        and not review_priority.get("operator_attention_needed")
        and float(final_suggestion.get("confidence_score") or 0.0) >= 0.6
        and not normalize_string_list(final_suggestion.get("source_warnings"))
    )
    if low_risk:
        add_tag("likely_straightforward")

    if "high_attention" in tags:
        suggested_batch = "high_attention"
        reason = "Material conflict or high review priority makes this a first-pass attention item."
    elif "manual_review_focus" in tags:
        suggested_batch = "manual_review_focus"
        reason = "Manual-review judgment still appears central to the safe handling of this item."
    elif "deep_review_candidates" in tags:
        suggested_batch = "deep_review_candidates"
        reason = "The current signals suggest a deeper advisory pass before the operator moves on."
    elif "source_check_needed" in tags:
        suggested_batch = "source_check_needed"
        reason = "The main remaining work is strengthening sources or evidence support."
    else:
        suggested_batch = "likely_straightforward"
        reason = "The item looks comparatively straightforward based on the current advisory signals."

    return {
        "suggested_batch": suggested_batch,
        "suggested_batch_reason": reason,
        "suggested_batch_tags": tags,
    }


def build_suggested_batch_summary(items: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, int]]:
    counts = {name: 0 for name in SUGGESTED_BATCH_DESCRIPTIONS}
    members: dict[str, list[dict[str, Any]]] = {name: [] for name in SUGGESTED_BATCH_DESCRIPTIONS}

    for index, item in enumerate(items, start=1):
        batch_name = item.get("suggested_batch")
        if batch_name not in counts:
            continue
        counts[batch_name] += 1
        members[batch_name].append(
            {
                "index": index,
                "slug": item.get("slug"),
                "title": item.get("title"),
                "review_priority": item.get("review_priority"),
                "review_priority_score": item.get("review_priority_score"),
            }
        )

    ordered_names = [
        "high_attention",
        "manual_review_focus",
        "deep_review_candidates",
        "source_check_needed",
        "likely_straightforward",
    ]
    batches = []
    for name in ordered_names:
        if counts[name] == 0:
            continue
        batches.append(
            {
                "batch_name": name,
                "count": counts[name],
                "description": SUGGESTED_BATCH_DESCRIPTIONS[name],
                "items": members[name],
            }
        )

    trimmed_counts = {name: count for name, count in counts.items() if count > 0}
    return batches, trimmed_counts


def apply_session_focus(items: list[dict[str, Any]], session_focus: str | None) -> list[dict[str, Any]]:
    if not session_focus:
        return list(items)
    batch_name = SESSION_FOCUS_TO_BATCH[session_focus]
    return [item for item in items if item.get("suggested_batch") == batch_name]


def apply_display_filters(items: list[dict[str, Any]], args: argparse.Namespace) -> list[dict[str, Any]]:
    display_items = list(items)
    display_items = apply_session_focus(display_items, args.session_focus)
    if args.priority:
        wanted = set(args.priority)
        display_items = [item for item in display_items if (item.get("review_priority") or "").lower() in wanted]
    if args.suggested_batch:
        wanted_batches = set(args.suggested_batch)
        display_items = [item for item in display_items if item.get("suggested_batch") in wanted_batches]
    if args.attention_needed:
        display_items = [item for item in display_items if item.get("operator_attention_needed")]
    if args.with_conflicts:
        display_items = [item for item in display_items if item.get("has_material_conflict")]
    if args.deep_review_recommended:
        display_items = [item for item in display_items if item.get("deep_review_recommended")]
    if args.manual_review_severity:
        wanted_severity = set(args.manual_review_severity)
        display_items = [item for item in display_items if (item.get("manual_review_severity") or "").lower() in wanted_severity]
    if args.sort_by_priority:
        display_items.sort(key=lambda item: (int(item.get("review_priority_score") or 0), item.get("slug") or ""), reverse=args.descending)
    elif args.descending:
        display_items = list(reversed(display_items))
    return display_items


def build_display_report(report: dict[str, Any], display_items: list[dict[str, Any]], args: argparse.Namespace) -> dict[str, Any]:
    display_report = dict(report)
    display_report["items"] = display_items
    display_report["display_item_count"] = len(display_items)
    display_batches, display_batch_counts = build_suggested_batch_summary(display_items)
    display_report["display_suggested_batches"] = display_batches
    display_report["display_suggested_batch_counts"] = display_batch_counts
    display_report["display_filters"] = {
        "priority": args.priority,
        "suggested_batch": args.suggested_batch,
        "attention_needed": args.attention_needed,
        "with_conflicts": args.with_conflicts,
        "deep_review_recommended": args.deep_review_recommended,
        "manual_review_severity": args.manual_review_severity,
        "session_focus": args.session_focus,
        "sort_by_priority": args.sort_by_priority,
        "descending": args.descending,
    }
    return display_report


def build_display_summary(display_items: list[dict[str, Any]], total_items: int) -> list[str]:
    high = sum(1 for item in display_items if item.get("review_priority") == "high")
    medium = sum(1 for item in display_items if item.get("review_priority") == "medium")
    low = sum(1 for item in display_items if item.get("review_priority") == "low")
    attention = sum(1 for item in display_items if item.get("operator_attention_needed"))
    deep_recommended = sum(1 for item in display_items if item.get("deep_review_recommended"))
    fallback_count = sum(1 for item in display_items if item.get("fallback_used"))
    batch_list, batch_counts = build_suggested_batch_summary(display_items)
    lines = [
        "Review Summary",
        f"Total items: {total_items}",
        f"Displayed items: {len(display_items)}",
        f"High priority: {high}",
        f"Medium priority: {medium}",
        f"Low priority: {low}",
        f"Items needing attention: {attention}",
        f"Items recommended for deep review: {deep_recommended}",
        f"Fallback items: {fallback_count}",
    ]
    if batch_counts:
        lines.append("Suggested batches:")
        for batch in batch_list:
            lines.append(f"- {batch['batch_name']}: {batch['count']}")
    return lines


def build_preview_lines(display_items: list[dict[str, Any]]) -> list[str]:
    lines = ["Review Preview"]
    for item in display_items:
        suggestion = item.get("suggestions") or {}
        lines.extend(
            [
                f"- {item.get('title')}",
                f"  slug: {item.get('slug')}",
                f"  record_action: {suggestion.get('record_action_suggestion')}",
                f"  impact_direction: {suggestion.get('impact_direction_suggestion')}",
                f"  confidence: {suggestion.get('confidence_level')}",
                f"  review_priority: {item.get('review_priority')} ({item.get('review_priority_score')})",
                f"  backend: {item.get('review_backend')}",
                f"  effective_model: {item.get('effective_model') or 'none'}",
                f"  fallback_used: {'yes' if item.get('fallback_used') else 'no'}",
                f"  suggested_batch: {item.get('suggested_batch')}",
                f"  batch_reason: {item.get('suggested_batch_reason')}",
            ]
        )
    return lines


def build_worklist_payload(report: dict[str, Any], items: list[dict[str, Any]], args: argparse.Namespace) -> dict[str, Any]:
    suggested_batches, suggested_batch_counts = build_suggested_batch_summary(items)
    review_priority_counts = {
        "low": sum(1 for item in items if item.get("review_priority") == "low"),
        "medium": sum(1 for item in items if item.get("review_priority") == "medium"),
        "high": sum(1 for item in items if item.get("review_priority") == "high"),
    }
    worklist_filters = {
        "priority": args.priority,
        "suggested_batch": args.suggested_batch,
        "attention_needed": args.attention_needed,
        "with_conflicts": args.with_conflicts,
        "deep_review_recommended": args.deep_review_recommended,
        "manual_review_severity": args.manual_review_severity,
        "session_focus": args.session_focus,
        "sort_by_priority": args.sort_by_priority,
        "descending": args.descending,
    }
    payload: dict[str, Any] = {
        "worklist_type": "review_worklist",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "generated_from_review": {
            "batch_name": report.get("batch_name"),
            "input_path": report.get("input_path"),
            "review_output_path": report.get("resolved_output_path"),
            "model": report.get("model"),
            "requested_model": report.get("requested_model"),
            "effective_model": report.get("effective_model"),
            "review_backend": report.get("review_backend"),
            "fallback_used": report.get("fallback_used"),
            "fallback_reason": report.get("fallback_reason"),
            "review_mode": report.get("review_mode"),
            "dry_run": report.get("dry_run"),
        },
        "worklist_filters": worklist_filters,
        "item_count": len(items),
        "worklist_summary": {
            "review_priority_counts": review_priority_counts,
            "suggested_batch_counts": suggested_batch_counts,
            "items_needing_attention": sum(1 for item in items if item.get("operator_attention_needed")),
            "items_with_material_conflicts": 0,
            "items_recommended_for_deep_review": sum(1 for item in items if item.get("deep_review_recommended")),
        },
        "items": items,
    }
    if args.session_focus:
        payload["session_manifest"] = True
        payload["session_focus"] = args.session_focus
        payload["selection_reason"] = SESSION_FOCUS_REASONS[args.session_focus]
        payload["selection_filters"] = worklist_filters
        payload["selection_counts"] = {
            "item_count": len(items),
            "suggested_batch_counts": suggested_batch_counts,
            "review_priority_counts": review_priority_counts,
        }
    else:
        payload["session_manifest"] = False
    if suggested_batches:
        payload["suggested_batches"] = suggested_batches
    return payload


def derive_decision_log_path(batch_name: str, arg_value: str | None) -> Path:
    if arg_value not in (None, ""):
        return Path(arg_value)
    reports_dir = resolve_default_report_path(batch_name, "ai-review").parent
    log_dir = reports_dir / "review_decisions"
    return log_dir / f"{batch_name}.decision-log.json"


def load_operator_decisions(path: Path) -> tuple[dict[str, dict[str, Any]], dict[str, Any]]:
    payload = json.loads(path.read_text())
    metadata = {
        "session_id": payload.get("session_id"),
        "worklist_used": payload.get("worklist_used"),
        "selection_filters": payload.get("selection_filters"),
        "session_focus": payload.get("session_focus"),
        "source_review_file": payload.get("source_review_file"),
        "source_artifact_file": payload.get("source_artifact_file"),
        "template_type": payload.get("template_type"),
    }
    decisions: dict[str, dict[str, Any]] = {}
    if isinstance(payload.get("items"), list):
        for item in payload["items"]:
            if not isinstance(item, dict):
                continue
            slug = normalize_nullable_text(item.get("slug"))
            if not slug:
                continue
            decisions[slug] = item
    elif isinstance(payload.get("decisions"), dict):
        for slug, item in payload["decisions"].items():
            if not isinstance(item, dict):
                continue
            decisions[str(slug)] = item
    else:
        raise ValueError("Decision file must contain either an 'items' array or a 'decisions' object.")
    if not decisions:
        raise ValueError(
            "Decision file did not contain any usable item decisions. Regenerate it with 'equitystack current-admin review --refresh-template' and fill explicit operator_action values for the remaining manual-review rows."
        )
    for slug, item in decisions.items():
        action = normalize_nullable_text(item.get("operator_action"))
        if action not in VALID_OPERATOR_ACTIONS:
            raise ValueError(
                f"Decision file entry for slug={slug} is missing a valid operator_action. "
                "Regenerate the template with 'equitystack current-admin review --refresh-template' if the file is stale, then fill one of the documented operator actions."
            )
    return decisions, metadata


def determine_decision_alignment(ai_record_action_suggestion: str | None, operator_action: str) -> str:
    if ai_record_action_suggestion == "manual_review" and operator_action in {"manual_review_required", "escalate"}:
        return "match"
    if ai_record_action_suggestion in {"new_record", "update_existing"} and operator_action in {"approve_as_is", "approve_with_changes"}:
        return "match"
    return "mismatch"


def build_decision_log_payload(
    report: dict[str, Any],
    items: list[dict[str, Any]],
    args: argparse.Namespace,
    decision_file: Path,
    decisions: dict[str, dict[str, Any]],
    decision_metadata: dict[str, Any],
) -> dict[str, Any]:
    source_review_file = decision_metadata.get("source_review_file")
    expected_review_file = str(report.get("resolved_output_path") or report.get("input_path"))
    if source_review_file and source_review_file != expected_review_file:
        raise ValueError(
            "Decision file does not match the current review artifact. "
            "Regenerate the template using 'equitystack current-admin review --refresh-template' from the same .ai-review.json file you plan to finalize."
        )

    log_items = []
    for index, item in enumerate(items, start=1):
        decision = decisions.get(item.get("slug"))
        if not decision:
            continue
        suggestion = item.get("suggestions") or {}
        operator_action = normalize_nullable_text(decision.get("operator_action"))
        ai_record_action_suggestion = suggestion.get("record_action_suggestion")
        log_items.append(
            {
                "index": index,
                "slug": item.get("slug"),
                "title": item.get("title"),
                "suggested_batch": item.get("suggested_batch"),
                "review_priority": item.get("review_priority"),
                "review_priority_score": item.get("review_priority_score"),
                "operator_action": operator_action,
                "operator_notes": normalize_nullable_text(decision.get("operator_notes")),
                "final_decision_summary": normalize_nullable_text(decision.get("final_decision_summary")),
                "timestamp": normalize_nullable_text(decision.get("timestamp")) or datetime.now(timezone.utc).isoformat(),
                "ai_record_action_suggestion": ai_record_action_suggestion,
                "decision_alignment": determine_decision_alignment(ai_record_action_suggestion, operator_action),
                "ai_suggestions_snapshot": suggestion,
            }
        )

    selection_filters = {
        "priority": args.priority,
        "suggested_batch": args.suggested_batch,
        "attention_needed": args.attention_needed,
        "with_conflicts": args.with_conflicts,
        "deep_review_recommended": args.deep_review_recommended,
        "manual_review_severity": args.manual_review_severity,
        "session_focus": args.session_focus,
        "sort_by_priority": args.sort_by_priority,
        "descending": args.descending,
    }
    payload: dict[str, Any] = {
        "session_id": decision_metadata.get("session_id") or datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ"),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_review_file": str(report.get("resolved_output_path") or report.get("input_path")),
        "source_decision_file": str(decision_file),
        "worklist_used": decision_metadata.get("worklist_used"),
        "selection_filters": decision_metadata.get("selection_filters") or selection_filters,
        "session_focus": decision_metadata.get("session_focus") or args.session_focus,
        "items": log_items,
    }
    payload["decision_counts"] = {
        "match": sum(1 for item in log_items if item["decision_alignment"] == "match"),
        "mismatch": sum(1 for item in log_items if item["decision_alignment"] == "mismatch"),
    }
    return payload


def select_records(payload: dict[str, Any], only_slugs: list[str] | None, max_items: int | None) -> list[dict[str, Any]]:
    records = list(payload.get("records") or [])
    if only_slugs:
        wanted = set(only_slugs)
        records = [record for record in records if record.get("slug") in wanted]
    if max_items is not None:
        records = records[:max_items]
    return records


def ensure_unique_record_entity_ids(records: list[dict[str, Any]]) -> None:
    indices_by_entity_id: dict[str, list[int]] = {}
    for index, record in enumerate(records, start=1):
        entity_id = normalize_nullable_text(record.get("slug")) or slugify(record.get("title") or f"record-{index}")
        indices_by_entity_id.setdefault(entity_id, []).append(index)

    duplicates = {
        entity_id: indices
        for entity_id, indices in indices_by_entity_id.items()
        if len(indices) > 1
    }
    if not duplicates:
        return

    duplicate_summary = "; ".join(
        f"{entity_id} (records {', '.join(str(value) for value in indices)})"
        for entity_id, indices in sorted(duplicates.items())
    )
    raise ValueError(
        "AI review input contains duplicate record ids/slugs: "
        f"{duplicate_summary}. Regenerate the batch or resolve duplicate slugs before AI review."
    )


def resolve_model(args: argparse.Namespace) -> str:
    requested = normalize_nullable_text(args.model)
    if requested and requested not in LEGACY_MODEL_NAMES:
        return requested
    return normalize_nullable_text(
        os.environ.get("EQUITYSTACK_CURRENT_ADMIN_REVIEW_MODEL")
        or os.environ.get("EQUITYSTACK_OPENAI_MODEL")
    ) or DEFAULT_MODEL_SENIOR


def classifier_json_schema() -> dict[str, Any]:
    return {
        "name": "equitystack_policy_review",
        "strict": True,
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "entity_type": {"type": "string", "enum": ["policy", "promise", "link", "action"]},
                "entity_id": {"type": "string"},
                "recommended_action": {"type": "string", "enum": ["approve", "reject", "needs_manual_review"]},
                "classification": {"type": "string", "enum": ["positive", "negative", "mixed", "blocked", "unclear"]},
                "confidence": {"type": "number"},
                "summary": {"type": "string"},
                "reasoning_notes": {"type": "array", "items": {"type": "string"}},
                "missing_information": {"type": "array", "items": {"type": "string"}},
                "source_quality": {"type": "string", "enum": ["high", "medium", "low"]},
                "source_issues": {"type": "array", "items": {"type": "string"}},
                "flags": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "ambiguous_subject": {"type": "boolean"},
                        "conflicting_sources": {"type": "boolean"},
                        "weak_evidence": {"type": "boolean"},
                        "date_uncertain": {"type": "boolean"},
                    },
                    "required": [
                        "ambiguous_subject",
                        "conflicting_sources",
                        "weak_evidence",
                        "date_uncertain",
                    ],
                },
            },
            "required": [
                "entity_type",
                "entity_id",
                "recommended_action",
                "classification",
                "confidence",
                "summary",
                "reasoning_notes",
                "missing_information",
                "source_quality",
                "source_issues",
                "flags",
            ],
        },
    }


def build_record_payload(record: dict[str, Any], evidence_pack: dict[str, Any] | None = None) -> dict[str, Any]:
    entity_id = normalize_nullable_text(record.get("slug")) or slugify(record.get("title") or "record")
    payload = {
        "entity_type": "promise",
        "entity_id": entity_id,
        "record": record,
    }
    if evidence_pack is not None:
        payload["evidence_pack"] = evidence_pack
    return payload


def build_classifier_prompt(record_payload: dict[str, Any]) -> str:
    return f"""
You are a conservative policy review classifier for EquityStack.

Your task is to review the provided record using ONLY the evidence included in the input.

You must not speculate.
You must not use outside knowledge.
You must not guess missing facts.
If the evidence is weak, incomplete, indirect, or conflicting, you must choose classification="unclear".
If the evidence is not strong enough for safe approval, you must choose recommended_action="needs_manual_review".

Classification definitions:

- positive:
  the policy or action directly improves rights, access, protections, representation, economic opportunity, education, housing, health, voting access, or other measurable outcomes for Black Americans

- negative:
  the policy or action directly restricts rights, access, protections, representation, economic opportunity, education, housing, health, voting access, or other measurable outcomes for Black Americans, or reinforces discriminatory harm

- mixed:
  the evidence shows both meaningful positive and meaningful negative effects, or meaningful benefit with meaningful limitations

- blocked:
  the policy or action was proposed or intended but was blocked, failed, prevented, struck down, or never meaningfully implemented

- unclear:
  the evidence provided is insufficient, conflicting, too vague, or too indirect to support a reliable classification

Rules:
- Choose exactly one classification
- Use exact enum values only
- Output JSON only
- Do not include markdown
- Do not include commentary outside the JSON object
- Confidence must be a number from 0 to 1
- Confidence reflects how strongly the provided evidence supports the classification
- Prefer "unclear" over forced certainty
- Prefer "needs_manual_review" over weak approval

Return exactly this JSON shape:

{{
  "entity_type": "policy|promise|link|action",
  "entity_id": "string",
  "recommended_action": "approve|reject|needs_manual_review",
  "classification": "positive|negative|mixed|blocked|unclear",
  "confidence": 0.0,
  "summary": "string",
  "reasoning_notes": ["string"],
  "missing_information": ["string"],
  "source_quality": "high|medium|low",
  "source_issues": ["string"],
  "flags": {{
    "ambiguous_subject": false,
    "conflicting_sources": false,
    "weak_evidence": false,
    "date_uncertain": false
  }}
}}

Record to review:
{json.dumps(record_payload, indent=2)}
""".strip()


def write_batch_input_file(
    records: list[dict[str, Any]],
    model: str,
    output_path: Path,
    evidence_packs_by_slug: dict[str, dict[str, Any]] | None = None,
) -> Path:
    def request_map_path_for_review(path: Path) -> Path:
        return batch_artifact_path(path, "request-map.json")

    def safe_batch_custom_id(entity_id: str) -> str:
        entity_id = normalize_nullable_text(entity_id) or "record"
        if len(entity_id) <= 64:
            return entity_id
        digest = hashlib.sha1(entity_id.encode("utf-8")).hexdigest()[:12]
        prefix = entity_id[:51].rstrip("-")
        return f"{prefix}-{digest}"

    def reserve_unique_batch_custom_id(entity_id: str, seen_custom_ids: set[str]) -> str:
        base = safe_batch_custom_id(entity_id)
        if base not in seen_custom_ids:
            seen_custom_ids.add(base)
            return base

        counter = 2
        while True:
            digest = hashlib.sha1(f"{entity_id}:{counter}".encode("utf-8")).hexdigest()[:8]
            candidate = f"{base[:54].rstrip('-')}-{digest}"
            if candidate not in seen_custom_ids:
                seen_custom_ids.add(candidate)
                return candidate
            counter += 1

    input_path = batch_artifact_path(output_path, "input.jsonl")
    input_path.parent.mkdir(parents=True, exist_ok=True)
    lines = []
    seen_custom_ids: set[str] = set()
    request_map: dict[str, Any] = {
        "artifact_version": ARTIFACT_VERSION,
        "generated_at": now_iso(),
        "review_artifact": str(output_path),
        "input_artifact": str(input_path),
        "items": {},
    }
    for record in records:
        record_slug = normalize_nullable_text(record.get("slug")) or slugify(record.get("title") or "record")
        record_payload = build_record_payload(
            record,
            evidence_packs_by_slug.get(record_slug) if evidence_packs_by_slug is not None else None,
        )
        entity_id = normalize_nullable_text(record_payload["entity_id"]) or slugify(record.get("title") or "record")
        custom_id = reserve_unique_batch_custom_id(entity_id, seen_custom_ids)
        request_map["items"][custom_id] = {
            "entity_id": entity_id,
            "slug": record_slug,
            "title": normalize_nullable_text(record.get("title")),
        }
        lines.append(
            json.dumps(
                {
                    "custom_id": custom_id,
                    "method": "POST",
                    "url": "/v1/responses",
                    "body": {
                        "model": model,
                        "input": build_classifier_prompt(record_payload),
                        "temperature": DEFAULT_TEMPERATURE,
                        "max_output_tokens": 1200,
                        "text": {
                            "format": {
                                "type": "json_schema",
                                **classifier_json_schema(),
                            }
                        },
                    },
                }
            )
        )
    input_path.write_text("\n".join(lines) + ("\n" if lines else ""))
    write_json_file(request_map_path_for_review(output_path), request_map)
    return input_path


def extract_response_text(body: dict[str, Any]) -> str | None:
    output_text = normalize_nullable_text(body.get("output_text"))
    if output_text:
        return output_text

    outputs = body.get("output") or []
    parts: list[str] = []
    for output in outputs:
        for content in output.get("content") or []:
            text = normalize_nullable_text(content.get("text"))
            if text:
                parts.append(text)
    return "\n".join(parts) if parts else None


def parse_jsonl_lines(raw_text: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for line in raw_text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        rows.append(json.loads(stripped))
    return rows


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def request_map_path_for_review(review_path: Path) -> Path:
    return batch_artifact_path(review_path, "request-map.json")


def load_request_id_map(review_path: Path) -> dict[str, str]:
    path = request_map_path_for_review(review_path)
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text())
    except Exception:  # noqa: BLE001
        return {}
    items = payload.get("items") if isinstance(payload, dict) else None
    if not isinstance(items, dict):
        return {}

    mapping: dict[str, str] = {}
    for custom_id, item in items.items():
        if not isinstance(item, dict):
            continue
        entity_id = normalize_nullable_text(item.get("entity_id")) or normalize_nullable_text(item.get("slug"))
        if entity_id:
            mapping[str(custom_id)] = entity_id
    return mapping


def resolve_item_id(custom_id: str, id_map: dict[str, str], parsed: dict[str, Any] | None = None) -> str:
    if isinstance(parsed, dict):
        entity_id = normalize_nullable_text(parsed.get("entity_id"))
        if entity_id:
            return entity_id
    return id_map.get(custom_id, custom_id)


def summarize_batch_errors(errors: Any) -> list[str]:
    messages: list[str] = []
    if isinstance(errors, dict):
        data = errors.get("data")
        if isinstance(data, list):
            for item in data:
                if not isinstance(item, dict):
                    continue
                message = normalize_nullable_text(item.get("message"))
                code = normalize_nullable_text(item.get("code"))
                param = normalize_nullable_text(item.get("param"))
                parts = [part for part in [message, f"code={code}" if code else None, f"param={param}" if param else None] if part]
                if parts:
                    messages.append(" | ".join(parts))
        else:
            message = normalize_nullable_text(errors.get("message"))
            if message:
                messages.append(message)
    elif isinstance(errors, list):
        for item in errors:
            if isinstance(item, dict):
                message = normalize_nullable_text(item.get("message"))
                if message:
                    messages.append(message)
            else:
                message = normalize_nullable_text(item)
                if message:
                    messages.append(message)
    else:
        message = normalize_nullable_text(errors)
        if message:
            messages.append(message)
    return messages


def resolve_openai_client(args: argparse.Namespace) -> OpenAIBatchClient:
    env_values = load_openai_env_values()
    api_key = resolve_openai_api_key(env_values)
    if not api_key:
        raise ValueError("OPENAI_API_KEY is required unless --dry-run is used.")
    return OpenAIBatchClient(
        api_key=api_key,
        base_url=resolve_openai_base_url(env_values, args.openai_base_url),
    )


def coerce_openai_timestamp(value: Any) -> str | None:
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(float(value), timezone.utc).isoformat()
    return normalize_nullable_text(value)


def read_batch_metadata(output_path: Path) -> tuple[dict[str, Any] | None, Path]:
    return load_batch_metadata(output_path)


def write_batch_metadata(output_path: Path, metadata: dict[str, Any]) -> dict[str, Any]:
    metadata_path = metadata_path_for_review(output_path)
    metadata_path.parent.mkdir(parents=True, exist_ok=True)
    metadata.setdefault("provider", "openai")
    metadata.setdefault("artifact_version", ARTIFACT_VERSION)
    metadata.setdefault("local_output_path", str(output_path_for_review(output_path)))
    metadata.setdefault("local_error_path", str(error_path_for_review(output_path)))
    metadata["updated_at"] = now_iso()
    write_json_file(metadata_path, metadata)
    return metadata


def metadata_from_remote_batch(
    *,
    output_path: Path,
    model: str,
    input_artifact: Path,
    input_file_id: str | None,
    batch_payload: dict[str, Any],
    existing_metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    metadata = dict(existing_metadata or {})
    status = normalize_nullable_text(batch_payload.get("status")) or metadata.get("status") or "unknown"
    now = now_iso()
    metadata.update(
        {
            "provider": "openai",
            "artifact_version": ARTIFACT_VERSION,
            "model": model,
            "input_artifact": str(input_artifact),
            "review_artifact": str(output_path),
            "batch_id": batch_payload.get("id") or metadata.get("batch_id"),
            "input_file_id": input_file_id or batch_payload.get("input_file_id") or metadata.get("input_file_id"),
            "output_file_id": batch_payload.get("output_file_id") or metadata.get("output_file_id"),
            "error_file_id": batch_payload.get("error_file_id") or metadata.get("error_file_id"),
            "status": status,
            "submitted_at": metadata.get("submitted_at") or coerce_openai_timestamp(batch_payload.get("created_at")) or now,
            "last_polled_at": now,
            "request_counts": batch_payload.get("request_counts") or metadata.get("request_counts") or {},
            "base_url": metadata.get("base_url"),
            "local_output_path": str(output_path_for_review(output_path)),
            "local_error_path": str(error_path_for_review(output_path)),
            "raw_batch": batch_payload,
        }
    )
    if status in TERMINAL_BATCH_STATUSES:
        metadata["completed_at"] = metadata.get("completed_at") or coerce_openai_timestamp(batch_payload.get("completed_at")) or now
    return write_batch_metadata(output_path, metadata)


def update_metadata_local_file_state(output_path: Path, metadata: dict[str, Any]) -> dict[str, Any]:
    local_output_path = output_path_for_review(output_path)
    local_error_path = error_path_for_review(output_path)
    metadata["local_output_path"] = str(local_output_path)
    metadata["local_error_path"] = str(local_error_path)
    metadata["output_fetched_at"] = metadata.get("output_fetched_at") or (now_iso() if local_output_path.exists() else None)
    if local_error_path.exists():
        metadata["error_fetched_at"] = metadata.get("error_fetched_at") or now_iso()
    return write_batch_metadata(output_path, metadata)


def parse_batch_output_text(raw_text: str, id_map: dict[str, str] | None = None) -> tuple[dict[str, dict[str, Any]], dict[str, str]]:
    results_by_slug: dict[str, dict[str, Any]] = {}
    error_by_slug: dict[str, str] = {}
    id_map = id_map or {}
    for row in parse_jsonl_lines(raw_text):
        custom_id = normalize_nullable_text(row.get("custom_id"))
        if not custom_id:
            continue
        response = row.get("response") if isinstance(row.get("response"), dict) else {}
        item_id = resolve_item_id(custom_id, id_map)
        if response.get("status_code") != 200:
            error_by_slug[item_id] = normalize_nullable_text(response.get("body")) or "Non-200 response from OpenAI Batch."
            continue
        body = response.get("body") if isinstance(response.get("body"), dict) else {}
        text = extract_response_text(body)
        if not text:
            error_by_slug[item_id] = "OpenAI Batch returned no structured response text."
            continue
        try:
            parsed = json.loads(text)
            if isinstance(parsed, dict):
                results_by_slug[resolve_item_id(custom_id, id_map, parsed)] = parsed
            else:
                error_by_slug[item_id] = "OpenAI Batch response JSON was not an object."
        except Exception as exc:  # noqa: BLE001
            error_by_slug[item_id] = normalize_nullable_text(str(exc)) or "Failed to parse OpenAI response JSON."
    return results_by_slug, error_by_slug


def parse_batch_error_text(raw_text: str, id_map: dict[str, str] | None = None) -> dict[str, str]:
    error_by_slug: dict[str, str] = {}
    id_map = id_map or {}
    for row in parse_jsonl_lines(raw_text):
        custom_id = normalize_nullable_text(row.get("custom_id"))
        if not custom_id:
            continue
        error = row.get("error") if isinstance(row.get("error"), dict) else {}
        item_id = resolve_item_id(custom_id, id_map)
        error_by_slug.setdefault(item_id, normalize_nullable_text(error.get("message")) or "OpenAI Batch item error.")
    return error_by_slug


def load_local_batch_results(output_path: Path) -> tuple[dict[str, dict[str, Any]], dict[str, str]]:
    results_by_slug: dict[str, dict[str, Any]] = {}
    error_by_slug: dict[str, str] = {}
    id_map = load_request_id_map(output_path)
    local_output_path = output_path_for_review(output_path)
    if local_output_path.exists():
        results_by_slug, output_errors = parse_batch_output_text(local_output_path.read_text(), id_map)
        error_by_slug.update(output_errors)
    local_error_path = error_path_for_review(output_path)
    if local_error_path.exists():
        error_by_slug.update(parse_batch_error_text(local_error_path.read_text(), id_map))
    return results_by_slug, error_by_slug


def batch_result_counts(
    results_by_slug: dict[str, dict[str, Any]],
    error_by_slug: dict[str, str],
) -> dict[str, int]:
    parsed_result_count = len(results_by_slug)
    parsed_error_count = len(error_by_slug)
    return {
        "parsed_result_count": parsed_result_count,
        "parsed_error_count": parsed_error_count,
        "parsed_total_count": parsed_result_count + parsed_error_count,
    }


def validate_raw_classifier_payload(raw: dict[str, Any] | None, item_id: str, error_message: str | None) -> dict[str, Any]:
    notes: list[str] = []
    enum_errors: list[str] = []
    missing_fields: list[str] = []
    malformed = False

    if raw is None:
        if error_message:
            malformed = True
            notes.append(error_message)
        else:
            missing_fields.append("classifier_result")
            notes.append("No classifier result was returned for this item.")
        return {
            "item_id": item_id,
            "valid": False,
            "malformed": malformed,
            "enum_errors": enum_errors,
            "missing_field_errors": missing_fields,
            "notes": notes,
        }

    missing_fields.extend(sorted(REQUIRED_CLASSIFIER_FIELDS - set(raw.keys())))

    if raw.get("entity_type") not in {"policy", "promise", "link", "action"}:
        enum_errors.append("entity_type")
    if raw.get("recommended_action") not in VALID_RECOMMENDED_ACTIONS:
        enum_errors.append("recommended_action")
    if raw.get("classification") not in VALID_CLASSIFICATIONS:
        enum_errors.append("classification")
    if raw.get("source_quality") not in VALID_SOURCE_QUALITIES:
        enum_errors.append("source_quality")
    if not isinstance(raw.get("confidence"), (int, float)) or not (0 <= float(raw.get("confidence") or 0) <= 1):
        enum_errors.append("confidence")
    if not isinstance(raw.get("reasoning_notes"), list):
        enum_errors.append("reasoning_notes")
    if not isinstance(raw.get("missing_information"), list):
        enum_errors.append("missing_information")
    if not isinstance(raw.get("source_issues"), list):
        enum_errors.append("source_issues")

    flags = raw.get("flags")
    if not isinstance(flags, dict):
        missing_fields.append("flags")
    else:
        missing_fields.extend(f"flags.{field}" for field in sorted(REQUIRED_CLASSIFIER_FLAG_FIELDS - set(flags.keys())))
        for field in REQUIRED_CLASSIFIER_FLAG_FIELDS:
            if field in flags and not isinstance(flags.get(field), bool):
                enum_errors.append(f"flags.{field}")

    if missing_fields:
        notes.append("Missing required classifier fields: " + ", ".join(sorted(set(missing_fields))))
    if enum_errors:
        notes.append("Invalid classifier enum/type values: " + ", ".join(sorted(set(enum_errors))))

    return {
        "item_id": item_id,
        "valid": not malformed and not missing_fields and not enum_errors,
        "malformed": malformed,
        "enum_errors": sorted(set(enum_errors)),
        "missing_field_errors": sorted(set(missing_fields)),
        "notes": notes or ["Valid structured classifier result."],
    }


def build_validation_summary(
    records: list[dict[str, Any]],
    classifier_by_slug: dict[str, dict[str, Any]],
    error_by_slug: dict[str, str],
) -> dict[str, Any]:
    per_item: dict[str, Any] = {}
    malformed_items = 0
    enum_errors = 0
    missing_field_errors = 0
    low_confidence_items = 0
    unclear_classifications = 0
    needs_manual_review_items = 0
    insert_safe_items = 0
    valid_items = 0

    for record in records:
        item_id = normalize_nullable_text(record.get("slug")) or slugify(record.get("title") or "record")
        raw = classifier_by_slug.get(item_id)
        validation = validate_raw_classifier_payload(raw, item_id, error_by_slug.get(item_id))
        per_item[item_id] = validation
        malformed_items += 1 if validation["malformed"] else 0
        enum_errors += len(validation["enum_errors"])
        missing_field_errors += len(validation["missing_field_errors"])
        valid_items += 1 if validation["valid"] else 0

        normalized = normalize_classifier_payload(raw, record) if isinstance(raw, dict) else heuristic_classifier_review(record, error_by_slug.get(item_id))
        confidence = float(normalized.get("confidence") or 0.0)
        recommended_action = normalized.get("recommended_action")
        classification = normalized.get("classification")
        low_confidence_items += 1 if confidence < 0.55 else 0
        unclear_classifications += 1 if classification == "unclear" else 0
        needs_manual_review_items += 1 if recommended_action == "needs_manual_review" else 0
        insert_safe_items += 1 if validation["valid"] and recommended_action == "approve" and classification != "unclear" and confidence >= 0.55 else 0

    total_items = len(records)
    finalization_safe = malformed_items == 0 and enum_errors == 0 and missing_field_errors == 0 and valid_items == total_items
    return {
        "artifact_version": ARTIFACT_VERSION,
        "generated_at": now_iso(),
        "total_items": total_items,
        "valid_items": valid_items,
        "malformed_items": malformed_items,
        "enum_errors": enum_errors,
        "missing_field_errors": missing_field_errors,
        "low_confidence_items": low_confidence_items,
        "unclear_classifications": unclear_classifications,
        "needs_manual_review_items": needs_manual_review_items,
        "insert_safe_items": insert_safe_items,
        "finalize_safe": finalization_safe,
        "apply_safe": finalization_safe,
        "human_summary": (
            f"{valid_items}/{total_items} classifier result(s) are structurally valid; "
            f"{malformed_items} malformed, {enum_errors} enum/type error(s), "
            f"{missing_field_errors} missing-field error(s)."
        ),
        "per_item_validation": per_item,
    }


def write_validation_summary(output_path: Path, validation_summary: dict[str, Any]) -> None:
    write_json_file(validation_path_for_review(output_path), validation_summary)


def heuristic_classifier_review(record: dict[str, Any], reason: str | None = None) -> dict[str, Any]:
    outcome = first_outcome(record)
    existing_direction = (normalize_nullable_text(outcome.get("impact_direction")) or "").lower()
    classification = existing_direction if existing_direction in {"positive", "negative", "mixed", "blocked"} else "unclear"
    warnings = source_warnings(record)
    quality = "high" if not warnings else ("medium" if len(warnings) <= 2 else "low")
    summary = "Conservative heuristic fallback. Manual review is still required."
    if reason:
        summary = f"{summary} {reason}"
    return {
        "entity_type": "promise",
        "entity_id": normalize_nullable_text(record.get("slug")) or slugify(record.get("title") or "record"),
        "recommended_action": "needs_manual_review",
        "classification": classification if classification in VALID_CLASSIFICATIONS else "unclear",
        "confidence": 0.35 if warnings else 0.45,
        "summary": summary,
        "reasoning_notes": ["AI batch review was not used for this row."],
        "missing_information": ["Confirm the evidence trail before importing the record."],
        "source_quality": quality,
        "source_issues": warnings,
        "flags": {
            "ambiguous_subject": classification == "unclear",
            "conflicting_sources": False,
            "weak_evidence": bool(warnings),
            "date_uncertain": False,
        },
    }


def normalize_classifier_payload(raw: dict[str, Any], record: dict[str, Any]) -> dict[str, Any]:
    payload = dict(raw)
    payload["entity_type"] = payload.get("entity_type") if payload.get("entity_type") in {"policy", "promise", "link", "action"} else "promise"
    payload["entity_id"] = normalize_nullable_text(payload.get("entity_id")) or normalize_nullable_text(record.get("slug")) or slugify(record.get("title") or "record")
    payload["recommended_action"] = payload.get("recommended_action") if payload.get("recommended_action") in VALID_RECOMMENDED_ACTIONS else "needs_manual_review"
    payload["classification"] = payload.get("classification") if payload.get("classification") in VALID_CLASSIFICATIONS else "unclear"
    payload["confidence"] = normalize_confidence_score(payload.get("confidence"))
    payload["summary"] = normalize_nullable_text(payload.get("summary")) or "Conservative review could not produce a stronger summary."
    payload["reasoning_notes"] = normalize_string_list(payload.get("reasoning_notes"))
    payload["missing_information"] = normalize_string_list(payload.get("missing_information"))
    payload["source_quality"] = payload.get("source_quality") if payload.get("source_quality") in VALID_SOURCE_QUALITIES else "low"
    payload["source_issues"] = normalize_string_list(payload.get("source_issues"))
    flags = payload.get("flags") if isinstance(payload.get("flags"), dict) else {}
    payload["flags"] = {
        "ambiguous_subject": bool(flags.get("ambiguous_subject")),
        "conflicting_sources": bool(flags.get("conflicting_sources")),
        "weak_evidence": bool(flags.get("weak_evidence")),
        "date_uncertain": bool(flags.get("date_uncertain")),
    }
    return payload


def poll_batch_until_terminal(
    client: OpenAIBatchClient,
    batch_id: str,
    poll_interval_seconds: int,
    wait_timeout_seconds: int,
    *,
    output_path: Path | None = None,
    model: str | None = None,
    input_artifact: Path | None = None,
    input_file_id: str | None = None,
    existing_metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    started = time.time()
    metadata = existing_metadata
    while True:
        payload = client.retrieve_batch(batch_id)
        if output_path and model and input_artifact:
            metadata = metadata_from_remote_batch(
                output_path=output_path,
                model=model,
                input_artifact=input_artifact,
                input_file_id=input_file_id,
                batch_payload=payload,
                existing_metadata=metadata,
            )
        status = normalize_nullable_text(payload.get("status")) or "unknown"
        if status in TERMINAL_BATCH_STATUSES:
            return payload
        if (time.time() - started) >= wait_timeout_seconds:
            raise TimeoutError(
                f"OpenAI Batch wait timed out after {wait_timeout_seconds} seconds for batch_id={batch_id}."
            )
        time.sleep(poll_interval_seconds)


def fetch_available_batch_files(
    client: OpenAIBatchClient,
    output_path: Path,
    metadata: dict[str, Any],
    *,
    force: bool = False,
) -> dict[str, str]:
    fetched: dict[str, str] = {}
    output_file_id = normalize_nullable_text(metadata.get("output_file_id"))
    local_output_path = output_path_for_review(output_path)
    if output_file_id:
        existed = local_output_path.exists()
        if existed and not force:
            fetched["output"] = "already_present"
        else:
            local_output_path.write_text(client.download_file_content(output_file_id))
            fetched["output"] = "refreshed" if existed else "downloaded"

    error_file_id = normalize_nullable_text(metadata.get("error_file_id"))
    local_error_path = error_path_for_review(output_path)
    if error_file_id:
        existed = local_error_path.exists()
        if existed and not force:
            fetched["error"] = "already_present"
        else:
            local_error_path.write_text(client.download_file_content(error_file_id))
            fetched["error"] = "refreshed" if existed else "downloaded"

    update_metadata_local_file_state(output_path, metadata)
    return fetched


def run_batch_reviews(
    args: argparse.Namespace,
    records: list[dict[str, Any]],
    output_path: Path,
    model: str,
    evidence_packs_by_slug: dict[str, dict[str, Any]] | None = None,
) -> tuple[dict[str, dict[str, Any]], dict[str, Any]]:
    client = resolve_openai_client(args)
    existing_metadata, metadata_path = read_batch_metadata(output_path)
    if existing_metadata and existing_metadata.get("batch_id"):
        local_output_path = output_path_for_review(output_path)
        local_error_path = error_path_for_review(output_path)
        status = normalize_nullable_text(existing_metadata.get("status")) or "unknown"
        expected_record_count = int((existing_metadata.get("request_counts") or {}).get("total") or len(records))
        if local_output_path.exists() or local_error_path.exists():
            classifier_by_slug, error_by_slug = load_local_batch_results(output_path)
            counts = batch_result_counts(classifier_by_slug, error_by_slug)
            fetched_files: dict[str, str] = {}
            if (
                status == "completed"
                and counts["parsed_total_count"] < expected_record_count
                and (
                    normalize_nullable_text(existing_metadata.get("output_file_id"))
                    or normalize_nullable_text(existing_metadata.get("error_file_id"))
                )
            ):
                fetched_files = fetch_available_batch_files(client, output_path, existing_metadata, force=True)
                classifier_by_slug, error_by_slug = load_local_batch_results(output_path)
                counts = batch_result_counts(classifier_by_slug, error_by_slug)
            update_metadata_local_file_state(output_path, existing_metadata)
            if counts["parsed_total_count"] > 0:
                return classifier_by_slug, {
                    "batch_id": existing_metadata.get("batch_id"),
                    "status": status,
                    "input_file_id": existing_metadata.get("input_file_id"),
                    "output_file_id": existing_metadata.get("output_file_id"),
                    "error_file_id": existing_metadata.get("error_file_id"),
                    "request_counts": existing_metadata.get("request_counts") or {},
                    "errors": (existing_metadata.get("raw_batch") or {}).get("errors") or existing_metadata.get("errors") or {},
                    "base_url": existing_metadata.get("base_url") or client.base_url,
                    "error_by_slug": error_by_slug,
                    "metadata_path": str(metadata_path),
                    "expected_record_count": expected_record_count,
                    **counts,
                    "fetched_files": fetched_files,
                    "resumed_from_local_output": True,
                }
        if status in INCOMPLETE_BATCH_STATUSES or status not in TERMINAL_BATCH_STATUSES:
            raise ValueError(
                f"Existing OpenAI Batch metadata found with status={status}; not submitting a duplicate batch. "
                "Run this command with --batch-resume or --batch-poll to continue lifecycle handling."
            )
        if status == "completed" and existing_metadata.get("output_file_id"):
            fetched_files = fetch_available_batch_files(client, output_path, existing_metadata, force=True)
            classifier_by_slug, error_by_slug = load_local_batch_results(output_path)
            counts = batch_result_counts(classifier_by_slug, error_by_slug)
            return classifier_by_slug, {
                "batch_id": existing_metadata.get("batch_id"),
                "status": status,
                "input_file_id": existing_metadata.get("input_file_id"),
                "output_file_id": existing_metadata.get("output_file_id"),
                "error_file_id": existing_metadata.get("error_file_id"),
                "request_counts": existing_metadata.get("request_counts") or {},
                "errors": (existing_metadata.get("raw_batch") or {}).get("errors") or existing_metadata.get("errors") or {},
                "base_url": existing_metadata.get("base_url") or client.base_url,
                "error_by_slug": error_by_slug,
                "metadata_path": str(metadata_path),
                "expected_record_count": expected_record_count,
                **counts,
                "fetched_files": fetched_files,
                "resumed_from_remote_output": True,
            }
        raise ValueError(
            f"Existing OpenAI Batch metadata found with terminal status={status}; not submitting a duplicate batch. "
            "Inspect the metadata/error sidecars before deciding whether to remove them and resubmit."
        )

    input_jsonl_path = write_batch_input_file(records, model, output_path, evidence_packs_by_slug)
    uploaded_file = client.upload_batch_file(input_jsonl_path)
    batch = client.create_batch(
        input_file_id=uploaded_file["id"],
        endpoint="/v1/responses",
        completion_window=args.completion_window,
        metadata={"batch_name": output_path.stem[:64]},
    )
    metadata = metadata_from_remote_batch(
        output_path=output_path,
        model=model,
        input_artifact=args.input,
        input_file_id=uploaded_file.get("id"),
        batch_payload=batch,
        existing_metadata={
            "submitted_at": now_iso(),
            "base_url": client.base_url,
        },
    )
    batch_payload = poll_batch_until_terminal(
        client,
        batch["id"],
        args.poll_interval_seconds,
        args.wait_timeout_seconds,
        output_path=output_path,
        model=model,
        input_artifact=args.input,
        input_file_id=uploaded_file.get("id"),
        existing_metadata=metadata,
    )
    metadata = metadata_from_remote_batch(
        output_path=output_path,
        model=model,
        input_artifact=args.input,
        input_file_id=uploaded_file.get("id"),
        batch_payload=batch_payload,
        existing_metadata=metadata,
    )

    results_by_slug: dict[str, dict[str, Any]] = {}
    error_by_slug: dict[str, str] = {}

    fetched_files = fetch_available_batch_files(client, output_path, metadata, force=True)
    results_by_slug, error_by_slug = load_local_batch_results(output_path)
    counts = batch_result_counts(results_by_slug, error_by_slug)

    return results_by_slug, {
        "batch_id": batch_payload.get("id"),
        "status": batch_payload.get("status"),
        "input_file_id": uploaded_file.get("id"),
        "output_file_id": batch_payload.get("output_file_id"),
        "error_file_id": batch_payload.get("error_file_id"),
        "request_counts": batch_payload.get("request_counts") or {},
        "errors": batch_payload.get("errors") or {},
        "base_url": client.base_url,
        "error_by_slug": error_by_slug,
        "metadata_path": str(metadata_path_for_review(output_path)),
        "expected_record_count": len(records),
        **counts,
        "fetched_files": fetched_files,
    }


def derive_batch_fallback_reason(
    batch_runtime: dict[str, Any] | None,
    expected_record_count: int,
) -> str | None:
    if not batch_runtime:
        return None

    status = normalize_nullable_text(batch_runtime.get("status")) or "unknown"
    parsed_result_count = int(batch_runtime.get("parsed_result_count") or 0)
    parsed_error_count = int(batch_runtime.get("parsed_error_count") or 0)
    expected = int(batch_runtime.get("expected_record_count") or expected_record_count or 0)
    batch_error_messages = summarize_batch_errors(batch_runtime.get("errors"))

    if expected <= 0:
        expected = expected_record_count

    if parsed_result_count == 0 and parsed_error_count == 0:
        base = (
            f"OpenAI Batch status={status} but no classifier rows were parsed from the local output artifacts "
            f"for the expected {expected} item(s)."
        )
        if batch_error_messages:
            return base + " Batch errors: " + " | ".join(batch_error_messages[:3])
        return base
    if parsed_result_count == 0 and parsed_error_count > 0:
        base = (
            f"OpenAI Batch status={status} but none of the expected {expected} item(s) produced a usable "
            f"classifier result; {parsed_error_count} item error row(s) were parsed."
        )
        if batch_error_messages:
            return base + " Batch errors: " + " | ".join(batch_error_messages[:3])
        return base
    if expected and parsed_result_count < expected:
        base = (
            f"OpenAI Batch returned usable classifier results for {parsed_result_count}/{expected} item(s); "
            f"{parsed_error_count} item(s) fell back."
        )
        if batch_error_messages:
            return base + " Batch errors: " + " | ".join(batch_error_messages[:3])
        return base
    return None


def batch_review_failure_reason(
    report: dict[str, Any],
    validation_summary: dict[str, Any],
) -> str | None:
    if report.get("dry_run"):
        return None

    reviewed_count = int(report.get("reviewed_count") or 0)
    fallback_count = int(report.get("fallback_count") or 0)
    valid_items = int(validation_summary.get("valid_items") or 0)

    if reviewed_count and fallback_count >= reviewed_count:
        return (
            f"OpenAI Batch review did not produce usable AI results for any of the {reviewed_count} item(s). "
            f"{normalize_nullable_text(report.get('fallback_reason')) or 'The review artifact was rebuilt entirely from heuristic fallback rows.'}"
        )

    if reviewed_count and valid_items == 0:
        return (
            f"OpenAI Batch review completed without any structurally valid classifier payloads for {reviewed_count} item(s). "
            "Inspect the validation and metadata sidecars before continuing."
        )

    return None


def classifier_to_suggestion(
    record: dict[str, Any],
    classifier: dict[str, Any],
    existing_matches: list[dict[str, Any]],
    *,
    fallback_reason: str | None = None,
) -> dict[str, Any]:
    score = normalize_confidence_score(classifier.get("confidence"))
    classification = classifier.get("classification")
    recommended_action = classifier.get("recommended_action")
    if classification == "unclear" or recommended_action != "approve":
        score = min(score, 0.5)
    level = normalize_confidence_level(None, score)
    impact_status, effective_recommended_action, impact_status_reason = impact_status_for_classifier(
        classifier,
        confidence_score=score,
    )

    normalized_source_issues = [
        flag
        for flag in (
            normalize_machine_flag(item) for item in normalize_string_list(classifier.get("source_issues"))
        )
        if flag
    ]
    merged_warnings = sorted(set(source_warnings(record) + normalized_source_issues))

    reasoning_notes = normalize_string_list(classifier.get("reasoning_notes"))
    hesitation_reasons = reasoning_notes or ["manual verification still required"]
    if fallback_reason:
        hesitation_reasons = hesitation_reasons + [fallback_reason]

    missing_information = normalize_string_list(classifier.get("missing_information"))
    caution_flags = list(merged_warnings)
    flags = classifier.get("flags") if isinstance(classifier.get("flags"), dict) else {}
    for key, enabled in flags.items():
        if enabled:
            caution_flags.append(key)
    if recommended_action != "approve":
        caution_flags.append("manual_review_required")
    if fallback_reason:
        caution_flags.append("batch_fallback_used")
    caution_flags = sorted(set(caution_flags))

    has_slug_match = any(match.get("slug") == record.get("slug") for match in existing_matches)
    if recommended_action == "approve":
        record_action_suggestion = "update_existing" if has_slug_match else ("manual_review" if existing_matches else "new_record")
    else:
        record_action_suggestion = "manual_review"

    suggestion = {
        "title_normalized": record.get("title"),
        "summary_suggestion": record.get("summary"),
        "topic_suggestion": record.get("topic"),
        "impacted_group_suggestion": record.get("impacted_group"),
        "status_suggestion": record.get("status") if record.get("status") in VALID_STATUSES else "In Progress",
        "impact_direction_suggestion": map_classification_to_direction(classification, record),
        "evidence_strength_suggestion": map_source_quality_to_evidence_strength(classifier.get("source_quality") or "low"),
        "record_action_suggestion": record_action_suggestion if record_action_suggestion in VALID_RECORD_ACTIONS else "manual_review",
        "recommended_action": effective_recommended_action,
        "classifier_recommended_action": recommended_action,
        "impact_status": impact_status,
        "impact_status_reason": impact_status_reason,
        "confidence_score": score,
        "confidence_level": level,
        "reasoning_summary": normalize_nullable_text(classifier.get("summary")) or "Operator should review AI output before import.",
        "hesitation_reasons": hesitation_reasons,
        "evidence_needed_to_reduce_risk": missing_information,
        "suggested_operator_next_action": suggested_operator_next_action(
            confidence_level=level,
            record_action_suggestion=record_action_suggestion,
            warnings=merged_warnings,
            deep_review_ran=False,
        ),
        "caution_flags": caution_flags,
        "source_warnings": merged_warnings,
        "missing_source_warnings": merged_warnings,
        "ambiguity_notes": " ".join(reasoning_notes[:3]) if reasoning_notes else "Operator should manually verify this advisory suggestion.",
    }
    suggestion.update(build_confidence_details(record, suggestion, existing_matches))
    return suggestion


def build_review_item(
    args: argparse.Namespace,
    record: dict[str, Any],
    existing_matches: list[dict[str, Any]],
    classifier: dict[str, Any],
    *,
    model: str,
    backend: str,
    fallback_used: bool,
    fallback_reason: str | None = None,
) -> dict[str, Any]:
    final_suggestion = classifier_to_suggestion(record, classifier, existing_matches, fallback_reason=fallback_reason)
    recommendation = build_deep_review_recommendation(record, final_suggestion, existing_matches)
    review_priority = build_review_priority(final_suggestion, existing_matches, recommendation)
    suggested_batch = build_suggested_batch(final_suggestion, existing_matches, recommendation, review_priority)
    uses_model = backend not in {"heuristic_fallback", "dry_run"}
    model_resolution_status = "dry_run" if backend == "dry_run" else ("heuristic_fallback" if backend == "heuristic_fallback" else "exact_requested")

    review_item = {
        "slug": record.get("slug"),
        "title": record.get("title"),
        "impact_status": final_suggestion.get("impact_status"),
        "recommended_action": final_suggestion.get("recommended_action"),
        "requested_model": model,
        "effective_model": model if uses_model else None,
        "resolved_model": model if uses_model else None,
        "review_mode": args.review_mode,
        "review_mode_requested": args.review_mode,
        "review_mode_used": "standard",
        "review_backend": backend,
        "model_used": model if uses_model else None,
        "verifier_model_requested": args.verifier_model,
        "verifier_model_used": None,
        "senior_model_requested": model,
        "senior_model_used": model if uses_model else None,
        "fallback_model": args.fallback_model,
        "fallback_used": fallback_used,
        "fallback_reason": fallback_reason,
        "model_resolution_status": model_resolution_status,
        "timeout_seconds": args.timeout,
        "senior_timeout_seconds": args.senior_timeout,
        "verifier_timeout_seconds": args.verifier_timeout,
        "retry_count": 0,
        "senior_attempted": not args.dry_run,
        "senior_retry_attempted": False,
        "verifier_attempted": False,
        "verifier_retry_attempted": False,
        "deep_review_requested": args.review_mode == "deep",
        "deep_review_ran": False,
        "deep_review_reason": "single_pass_conservative_classifier",
        "second_pass_ran": False,
        **recommendation,
        "suggestion_conflicts": [],
        "has_material_conflict": False,
        "conflict_summary": "OpenAI Batch review currently runs a single conservative pass.",
        "conflict_fields": [],
        "confidence_comparison": {
            "standard_confidence_score": final_suggestion.get("confidence_score"),
            "standard_confidence_level": final_suggestion.get("confidence_level"),
            "deep_confidence_score": None,
            "deep_confidence_level": None,
            "final_confidence_score": final_suggestion.get("confidence_score"),
            "final_confidence_level": final_suggestion.get("confidence_level"),
            "score_delta_after_deep_review": None,
            "level_changed_after_deep_review": False,
            "summary": "Only one conservative classifier pass is available, so there is no cross-pass comparison.",
        },
        "confidence_changed_after_deep_review": False,
        **review_priority,
        **suggested_batch,
        "existing_matches": existing_matches,
        "suggestions": final_suggestion,
        "standard_pass_suggestions": final_suggestion,
        "deep_pass_suggestions": None,
    }
    return normalize_exported_review_item_fields(review_item)


def build_review_report(
    args: argparse.Namespace,
    batch_payload: dict[str, Any],
    output_path: Path,
    *,
    classifier_by_slug_override: dict[str, dict[str, Any]] | None = None,
    batch_runtime_override: dict[str, Any] | None = None,
) -> dict[str, Any]:
    selected_records = select_records(batch_payload, args.only_slug, args.max_items)
    ensure_unique_record_entity_ids(selected_records)
    model = resolve_model(args)

    items: list[dict[str, Any]] = []
    csv_rows: list[dict[str, Any]] = []
    batch_runtime: dict[str, Any] | None = batch_runtime_override
    classifier_by_slug: dict[str, dict[str, Any]] = classifier_by_slug_override or {}
    evidence_pack_path: Path | None = None
    evidence_packs_by_slug: dict[str, dict[str, Any]] | None = None
    if args.packaging_mode == "enriched":
        evidence_pack_path, evidence_pack_artifact = write_evidence_pack_artifact(
            output_path=output_path,
            batch_name=batch_payload.get("batch_name"),
            records=selected_records,
            input_artifact=args.input,
        )
        evidence_packs_by_slug = {
            normalize_nullable_text(pack.get("item_id")) or slugify(pack.get("title") or "record"): pack
            for pack in evidence_pack_artifact.get("items") or []
            if isinstance(pack, dict)
        }

    if not args.dry_run and selected_records and classifier_by_slug_override is None:
        classifier_by_slug, batch_runtime = run_batch_reviews(
            args,
            selected_records,
            output_path,
            model,
            evidence_packs_by_slug,
        )

    generic_fallback_reason = derive_batch_fallback_reason(batch_runtime, len(selected_records))

    for record in selected_records:
        existing_matches = fetch_existing_matches(record)
        slug = normalize_nullable_text(record.get("slug")) or slugify(record.get("title") or "record")
        raw_classifier = classifier_by_slug.get(slug)
        error_by_slug = (batch_runtime or {}).get("error_by_slug") or {}
        fallback_reason = error_by_slug.get(slug) or generic_fallback_reason

        if raw_classifier is None:
            if args.dry_run:
                backend = "dry_run"
                fallback_used = False
            else:
                backend = "heuristic_fallback"
                fallback_used = True
            classifier = heuristic_classifier_review(record, fallback_reason)
        else:
            backend = "openai_batch"
            classifier = normalize_classifier_payload(raw_classifier, record)
            fallback_used = False
            fallback_reason = None

        item = build_review_item(
            args,
            record,
            existing_matches,
            classifier,
            model=model,
            backend=backend,
            fallback_used=fallback_used,
            fallback_reason=fallback_reason,
        )
        items.append(item)
        suggestion = item["suggestions"]
        csv_rows.append(
            {
                "slug": record.get("slug"),
                "title": record.get("title"),
                "requested_model": item.get("requested_model"),
                "effective_model": item.get("effective_model"),
                "review_mode": item.get("review_mode"),
                "review_backend": item.get("review_backend"),
                "fallback_used": item.get("fallback_used"),
                "review_priority": item.get("review_priority"),
                "review_priority_score": item.get("review_priority_score"),
                "operator_attention_needed": item.get("operator_attention_needed"),
                "suggested_batch": item.get("suggested_batch"),
                "confidence_level": suggestion.get("confidence_level"),
                "confidence_score": suggestion.get("confidence_score"),
                "record_action_suggestion": suggestion.get("record_action_suggestion"),
                "status_suggestion": suggestion.get("status_suggestion"),
                "impact_direction_suggestion": suggestion.get("impact_direction_suggestion"),
                "evidence_strength_suggestion": suggestion.get("evidence_strength_suggestion"),
                "suggested_operator_next_action": suggestion.get("suggested_operator_next_action"),
            }
        )

    requested_model = model
    effective_models = sorted({item.get("effective_model") for item in items if item.get("effective_model")})
    review_backends = sorted({item.get("review_backend") for item in items if item.get("review_backend")})
    model_statuses = sorted({item.get("model_resolution_status") for item in items if item.get("model_resolution_status")})
    fallback_reasons = sorted({item.get("fallback_reason") for item in items if item.get("fallback_reason")})
    if not fallback_reasons and any(bool(item.get("fallback_used")) for item in items):
        derived_reason = derive_batch_fallback_reason(batch_runtime, len(items))
        if derived_reason:
            fallback_reasons = [derived_reason]
    suggested_batches, suggested_batch_counts = build_suggested_batch_summary(items)

    report = {
        "batch_name": batch_payload.get("batch_name"),
        "input_path": str(args.input),
        "model": requested_model,
        "requested_model": requested_model,
        "effective_model": effective_models[0] if len(effective_models) == 1 else ("mixed" if effective_models else None),
        "resolved_model": effective_models[0] if len(effective_models) == 1 else ("mixed" if effective_models else None),
        "review_backend": review_backends[0] if len(review_backends) == 1 else ("mixed" if review_backends else None),
        "fallback_used": any(bool(item.get("fallback_used")) for item in items),
        "fallback_reason": fallback_reasons[0] if len(fallback_reasons) == 1 else ("Multiple fallback reasons; inspect item-level metadata." if fallback_reasons else None),
        "model_resolution_status": model_statuses[0] if len(model_statuses) == 1 else ("mixed" if model_statuses else None),
        "verifier_model": args.verifier_model,
        "fallback_model": args.fallback_model,
        "review_mode": args.review_mode,
        "dry_run": args.dry_run,
        "timeout_seconds": args.timeout,
        "senior_timeout_seconds": args.senior_timeout,
        "verifier_timeout_seconds": args.verifier_timeout,
        "resolved_output_path": str(output_path),
        "reviewed_count": len(items),
        "deep_review_count": 0,
        "fallback_count": sum(1 for item in items if item.get("fallback_used")),
        "review_priority_counts": {
            "low": sum(1 for item in items if item.get("review_priority") == "low"),
            "medium": sum(1 for item in items if item.get("review_priority") == "medium"),
            "high": sum(1 for item in items if item.get("review_priority") == "high"),
        },
        "items": items,
        "suggested_batches": suggested_batches,
        "suggested_batch_counts": suggested_batch_counts,
        "batch_runtime": batch_runtime,
    }

    write_json_file(output_path, report)
    csv_path = derive_csv_path(args.csv, output_path)
    if csv_path:
        write_csv_rows(csv_path, csv_rows)
    validation_classifier_by_slug = classifier_by_slug
    if args.dry_run:
        validation_classifier_by_slug = {
            normalize_nullable_text(record.get("slug")) or slugify(record.get("title") or "record"): heuristic_classifier_review(record)
            for record in selected_records
        }
    validation_summary = build_validation_summary(
        selected_records,
        validation_classifier_by_slug,
        (batch_runtime or {}).get("error_by_slug") or {},
    )
    if args.dry_run:
        validation_summary["finalize_safe"] = True
        validation_summary["apply_safe"] = True
        validation_summary["human_summary"] = "Dry-run review used conservative local heuristics; OpenAI Batch validation was not required."
    write_validation_summary(output_path, validation_summary)
    metadata, _ = read_batch_metadata(output_path)
    if metadata and metadata.get("batch_id"):
        metadata["review_artifact_rebuilt_at"] = metadata.get("review_artifact_rebuilt_at") or now_iso()
        metadata["reviewed_count"] = len(items)
        metadata["validation_artifact"] = str(validation_path_for_review(output_path))
        metadata["request_map_artifact"] = str(request_map_path_for_review(output_path))
        metadata["packaging_mode"] = args.packaging_mode
        if evidence_pack_path:
            metadata["evidence_pack_artifact"] = str(evidence_pack_path)
        write_batch_metadata(output_path, metadata)

    failure_reason = batch_review_failure_reason(report, validation_summary)
    if failure_reason:
        raise SystemExit(
            failure_reason
            + f" Inspect {metadata_path_for_review(output_path)} and {validation_path_for_review(output_path)}."
        )
    return report


def load_existing_report(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text())
    if not isinstance(payload, dict):
        raise ValueError("AI review artifact must be a JSON object.")
    if not isinstance(payload.get("items"), list):
        raise ValueError("AI review artifact is missing an items array.")
    return payload


def resolve_input_path(raw_value: Any, reference_path: Path) -> Path | None:
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
        (Path.cwd() / candidate).resolve(),
    ]
    for resolved in candidates:
        if resolved.exists():
            return resolved
    return candidates[0]


def resolve_lifecycle_context(args: argparse.Namespace) -> dict[str, Any]:
    payload = json.loads(args.input.read_text())
    if not isinstance(payload, dict):
        raise ValueError("Input artifact must be a JSON object.")

    if isinstance(payload.get("records"), list):
        output_path = args.output or resolve_default_report_path(payload["batch_name"], "ai-review")
        return {
            "batch_payload": payload,
            "review_report": None,
            "output_path": output_path,
            "normalized_input_path": args.input,
        }

    if isinstance(payload.get("items"), list):
        output_path = Path(payload.get("resolved_output_path") or args.input)
        normalized_input_path = resolve_input_path(payload.get("input_path"), args.input)
        batch_payload = None
        if normalized_input_path and normalized_input_path.exists():
            batch_payload = read_batch_payload(normalized_input_path)
        return {
            "batch_payload": batch_payload,
            "review_report": payload,
            "output_path": output_path,
            "normalized_input_path": normalized_input_path,
        }

    raise ValueError("Input artifact must be either a normalized current-admin batch or an ai-review report.")


def load_remote_batch_metadata(args: argparse.Namespace, context: dict[str, Any]) -> dict[str, Any]:
    output_path = context["output_path"]
    model = resolve_model(args)
    metadata, _ = read_batch_metadata(output_path)
    if not metadata or not metadata.get("batch_id"):
        raise ValueError(
            "No local OpenAI Batch metadata with batch_id was found. "
            "Submit the review first or provide the canonical review artifact for a submitted batch."
        )
    client = resolve_openai_client(args)
    remote = client.retrieve_batch(str(metadata["batch_id"]))
    return metadata_from_remote_batch(
        output_path=output_path,
        model=normalize_nullable_text(metadata.get("model")) or model,
        input_artifact=context.get("normalized_input_path") or args.input,
        input_file_id=normalize_nullable_text(metadata.get("input_file_id")),
        batch_payload=remote,
        existing_metadata={**metadata, "base_url": metadata.get("base_url") or client.base_url},
    )


def format_batch_inspect_lines(context: dict[str, Any], metadata: dict[str, Any] | None) -> list[str]:
    output_path = context["output_path"]
    safety = evaluate_review_batch_safety(output_path)
    batch_payload = context.get("batch_payload") or {}
    reviewed_count = None
    if context.get("review_report"):
        reviewed_count = len(context["review_report"].get("items") or [])
    elif isinstance(batch_payload, dict):
        reviewed_count = len(select_records(batch_payload, None, None))

    counts = safety.get("validation_counts") or {}
    lines = [
        "OpenAI Batch Inspect",
        f"Review artifact: {output_path}",
        f"Metadata artifact: {metadata_path_for_review(output_path)}",
        f"Validation artifact: {validation_path_for_review(output_path)}",
        f"Request map artifact: {request_map_path_for_review(output_path)}",
        f"Batch id: {safety.get('batch_id') or (metadata or {}).get('batch_id') or 'n/a'}",
        f"Model: {safety.get('model') or (metadata or {}).get('model') or 'n/a'}",
        f"Status: {safety.get('status') or (metadata or {}).get('status') or 'unknown'}",
        f"Submitted at: {safety.get('submitted_at') or (metadata or {}).get('submitted_at') or 'n/a'}",
        f"Completed at: {safety.get('completed_at') or (metadata or {}).get('completed_at') or 'n/a'}",
        f"Output ready: {'yes' if safety.get('output_ready') else 'no'}",
        f"Error file present: {'yes' if safety.get('error_file_present') else 'no'}",
        f"Reviewed item count: {reviewed_count if reviewed_count is not None else 'unknown'}",
        f"Valid items: {counts.get('valid_items', 'unknown')}",
        f"Malformed items: {counts.get('malformed_items', 'unknown')}",
        f"Enum errors: {counts.get('enum_errors', 'unknown')}",
        f"Missing field errors: {counts.get('missing_field_errors', 'unknown')}",
        f"Validation-ready: {'yes' if safety.get('safe_to_finalize') else 'no'}",
        f"Finalize/apply safe: {'yes' if safety.get('safe_to_apply') else 'no'}",
    ]
    batch_errors = summarize_batch_errors(((metadata or {}).get("raw_batch") or {}).get("errors"))
    if batch_errors:
        lines.append("Batch errors:")
        for message in batch_errors[:5]:
            lines.append(f"- {message}")
    if safety.get("blocking_issues"):
        lines.append("Blocking issues:")
        for issue in safety["blocking_issues"]:
            lines.append(f"- {issue.get('message')}")
            if issue.get("fix"):
                lines.append(f"  Fix: {issue['fix']}")
    return lines


def run_lifecycle_action(args: argparse.Namespace) -> bool:
    action_requested = any(
        [
            args.batch_status,
            args.batch_poll,
            args.batch_fetch,
            args.batch_inspect,
            args.batch_resume,
        ]
    )
    if not action_requested:
        return False

    context = resolve_lifecycle_context(args)
    output_path = context["output_path"]
    metadata, _ = read_batch_metadata(output_path)

    if args.batch_status:
        if metadata and metadata.get("batch_id"):
            try:
                metadata = load_remote_batch_metadata(args, context)
            except Exception as exc:  # noqa: BLE001
                print(f"Remote status unavailable: {exc}")
        print("\n".join(format_batch_inspect_lines(context, metadata)))
        return True

    if args.batch_inspect:
        print("\n".join(format_batch_inspect_lines(context, metadata)))
        return True

    if not metadata or not metadata.get("batch_id"):
        raise ValueError("No local OpenAI Batch metadata with batch_id was found; cannot poll, fetch, or resume.")

    client = resolve_openai_client(args)
    model = normalize_nullable_text(metadata.get("model")) or resolve_model(args)
    input_artifact = context.get("normalized_input_path") or args.input

    if args.batch_poll or args.batch_resume:
        status = normalize_nullable_text(metadata.get("status")) or "unknown"
        if status in TERMINAL_BATCH_STATUSES:
            remote = client.retrieve_batch(str(metadata["batch_id"]))
            metadata = metadata_from_remote_batch(
                output_path=output_path,
                model=model,
                input_artifact=input_artifact,
                input_file_id=normalize_nullable_text(metadata.get("input_file_id")),
                batch_payload=remote,
                existing_metadata={**metadata, "base_url": metadata.get("base_url") or client.base_url},
            )
        else:
            remote = poll_batch_until_terminal(
                client,
                str(metadata["batch_id"]),
                args.poll_interval_seconds,
                args.wait_timeout_seconds,
                output_path=output_path,
                model=model,
                input_artifact=input_artifact,
                input_file_id=normalize_nullable_text(metadata.get("input_file_id")),
                existing_metadata={**metadata, "base_url": metadata.get("base_url") or client.base_url},
            )
            metadata = metadata_from_remote_batch(
                output_path=output_path,
                model=model,
                input_artifact=input_artifact,
                input_file_id=normalize_nullable_text(metadata.get("input_file_id")),
                batch_payload=remote,
                existing_metadata={**metadata, "base_url": metadata.get("base_url") or client.base_url},
            )
        if args.batch_poll and not args.batch_resume:
            print("\n".join(format_batch_inspect_lines(context, metadata)))
            return True

    if args.batch_fetch and not args.batch_resume:
        remote = client.retrieve_batch(str(metadata["batch_id"]))
        metadata = metadata_from_remote_batch(
            output_path=output_path,
            model=model,
            input_artifact=input_artifact,
            input_file_id=normalize_nullable_text(metadata.get("input_file_id")),
            batch_payload=remote,
            existing_metadata={**metadata, "base_url": metadata.get("base_url") or client.base_url},
        )

    if args.batch_fetch or args.batch_resume:
        status = normalize_nullable_text(metadata.get("status")) or "unknown"
        if status not in TERMINAL_BATCH_STATUSES:
            raise ValueError(
                f"OpenAI Batch status is {status}; output is not ready to fetch. "
                "Use --batch-poll or --batch-resume after the batch reaches a terminal state."
            )
        fetch_available_batch_files(client, output_path, metadata)
        metadata, _ = read_batch_metadata(output_path)
        if args.batch_fetch and not args.batch_resume:
            print("\n".join(format_batch_inspect_lines(context, metadata)))
            return True
        if status != "completed":
            raise ValueError(
                f"OpenAI Batch ended with status={status}; fetched available error artifacts but cannot rebuild the canonical review artifact."
            )

    if args.batch_resume:
        batch_payload = context.get("batch_payload")
        if not isinstance(batch_payload, dict):
            raise ValueError(
                "Cannot rebuild the canonical review artifact because the normalized batch input is unavailable. "
                "Pass --input <normalized.json> or keep input_path resolvable in the .ai-review.json artifact."
            )
        classifier_by_slug, error_by_slug = load_local_batch_results(output_path)
        if not classifier_by_slug and not error_by_slug:
            raise ValueError("No local Batch output or error rows were available after fetch; cannot rebuild review artifact.")
        runtime = {
            "batch_id": metadata.get("batch_id"),
            "status": metadata.get("status"),
            "input_file_id": metadata.get("input_file_id"),
            "output_file_id": metadata.get("output_file_id"),
            "error_file_id": metadata.get("error_file_id"),
            "request_counts": metadata.get("request_counts") or {},
            "base_url": metadata.get("base_url"),
            "error_by_slug": error_by_slug,
            "metadata_path": str(metadata_path_for_review(output_path)),
            "resumed": True,
        }
        report = build_review_report(
            args,
            batch_payload,
            output_path,
            classifier_by_slug_override=classifier_by_slug,
            batch_runtime_override=runtime,
        )
        metadata["review_artifact_rebuilt_at"] = now_iso()
        metadata["reviewed_count"] = len(report.get("items") or [])
        write_batch_metadata(output_path, metadata)
        print("\n".join(format_batch_inspect_lines(context, metadata)))
        return True

    return False


def run_evidence_preview_action(args: argparse.Namespace) -> bool:
    if not args.evidence_preview:
        return False
    context = resolve_lifecycle_context(args)
    batch_payload = context.get("batch_payload")
    if not isinstance(batch_payload, dict):
        raise ValueError(
            "Cannot build an evidence preview because the normalized batch input is unavailable. "
            "Pass --input <normalized.json> or keep input_path resolvable in the .ai-review.json artifact."
        )
    output_path = context["output_path"]
    selected_records = select_records(batch_payload, args.only_slug, args.max_items)
    artifact = build_evidence_pack_artifact(
        batch_name=batch_payload.get("batch_name"),
        records=selected_records,
        input_artifact=context.get("normalized_input_path") or args.input,
        review_artifact=output_path,
    )
    pack_path = evidence_pack_path_for_review(output_path)
    write_json_file(pack_path, artifact)
    print_json(
        {
            **artifact,
            "artifact_path": str(pack_path),
        }
    )
    return True


def resolve_report(args: argparse.Namespace) -> tuple[dict[str, Any], Path]:
    payload = json.loads(args.input.read_text())
    if not isinstance(payload, dict):
        raise ValueError("Input artifact must be a JSON object.")

    if isinstance(payload.get("records"), list):
        output_path = args.output or resolve_default_report_path(payload["batch_name"], "ai-review")
        return build_review_report(args, payload, output_path), output_path

    if isinstance(payload.get("items"), list):
        report = load_existing_report(args.input)
        output_path = Path(report.get("resolved_output_path") or args.input)
        return report, output_path

    raise ValueError("Input artifact must be either a normalized current-admin batch or an ai-review report.")


def main() -> None:
    args = parse_args()
    if run_lifecycle_action(args):
        return
    if run_evidence_preview_action(args):
        return

    report, output_path = resolve_report(args)
    if args.log_decisions is not None:
        require_review_batch_safe(output_path, "finalize")

    display_items = apply_display_filters(report.get("items") or [], args)
    worklist_payload = None
    if args.export_worklist:
        worklist_payload = build_worklist_payload(report, display_items, args)
        write_json_file(args.export_worklist, worklist_payload)

    decision_log_payload = None
    decision_log_path = None
    if args.log_decisions is not None:
        if args.decision_file is None:
            raise ValueError("--decision-file is required when --log-decisions is used.")
        decisions, decision_metadata = load_operator_decisions(args.decision_file)
        decision_log_payload = build_decision_log_payload(report, display_items, args, args.decision_file, decisions, decision_metadata)
        if not decision_log_payload["items"]:
            raise ValueError("No reviewed items matched the provided decision file after applying the current display filters.")
        decision_log_path = derive_decision_log_path(report["batch_name"], args.log_decisions)
        decision_log_path.parent.mkdir(parents=True, exist_ok=True)
        write_json_file(decision_log_path, decision_log_payload)

    if args.preview:
        print("\n".join(build_preview_lines(display_items)))
        if args.summary:
            print()
            print("\n".join(build_display_summary(display_items, len(report.get("items") or []))))
        if worklist_payload:
            print()
            print(f"Worklist exported: {args.export_worklist}")
            print(f"Selected items: {worklist_payload['item_count']}")
        if decision_log_payload:
            print(f"Decision log exported: {decision_log_path}")
            print(f"Logged decisions: {len(decision_log_payload['items'])}")
        return

    if args.summary:
        print("\n".join(build_display_summary(display_items, len(report.get("items") or []))))
        if worklist_payload:
            print(f"Worklist exported: {args.export_worklist}")
            print(f"Selected items: {worklist_payload['item_count']}")
        if decision_log_payload:
            print(f"Decision log exported: {decision_log_path}")
            print(f"Logged decisions: {len(decision_log_payload['items'])}")
        return

    display_report = build_display_report(report, display_items, args)
    if worklist_payload:
        display_report["worklist_export"] = {
            "path": str(args.export_worklist),
            "item_count": worklist_payload["item_count"],
            "session_focus": worklist_payload.get("session_focus"),
            "suggested_batch_counts": worklist_payload["worklist_summary"]["suggested_batch_counts"],
        }
    if decision_log_payload:
        display_report["decision_log_export"] = {
            "path": str(decision_log_path),
            "logged_decisions": len(decision_log_payload["items"]),
            "decision_counts": decision_log_payload.get("decision_counts"),
        }
    print_json(display_report)


if __name__ == "__main__":
    try:
        main()
    except (FileNotFoundError, ValueError, TimeoutError) as exc:
        raise SystemExit(str(exc)) from exc
