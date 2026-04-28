#!/usr/bin/env python3
"""
Run advisory OpenAI review over a normalized current-administration batch.

Provides multi-pass editorial guidance including deep review, conflict detection,
and suggested operator action workflows. Supports batching, filtering, and decision logging.

Author: EquityStack
"""

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from lib.llm.provider import default_model_name, generate_text

from current_admin_common import (
    derive_csv_path,
    get_db_connection,
    map_evidence_strength,
    normalize_nullable_text,
    print_json,
    read_batch_payload,
    resolve_default_report_path,
    write_csv_rows,
    write_json_file,
)


DEFAULT_OPENAI_BASE_URL = ""
DEFAULT_MODEL = default_model_name()
DEFAULT_MODEL_SENIOR = DEFAULT_MODEL
DEFAULT_MODEL_VERIFIER = DEFAULT_MODEL
DEFAULT_MODEL_FALLBACK = DEFAULT_MODEL
DEFAULT_SENIOR_TIMEOUT = 240
DEFAULT_VERIFIER_TIMEOUT = 240
DEFAULT_TIMEOUT = DEFAULT_SENIOR_TIMEOUT
DEFAULT_TEMPERATURE = 0.1
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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run an advisory OpenAI review over a normalized current-administration batch."
    )
    parser.add_argument("--input", type=Path, required=True, help="Normalized current-admin batch JSON")
    parser.add_argument("--output", type=Path, help="AI review report JSON output")
    parser.add_argument("--model", default=None, help="Senior review model name")
    parser.add_argument("--verifier-model", default=DEFAULT_MODEL_VERIFIER, help="Verifier / first-pass model name")
    parser.add_argument("--fallback-model", default=DEFAULT_MODEL_FALLBACK, help="Fallback review model name")
    parser.add_argument("--review-mode", choices=sorted(VALID_REVIEW_MODES), default="deep", help="Review depth to use")
    parser.add_argument("--deep-review", action="store_true", help="Shortcut for --review-mode deep")
    parser.add_argument("--dry-run", action="store_true", help="Skip OpenAI calls and emit heuristic suggestions only")
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
    parser.add_argument("--timeout", type=int, help="Legacy alias that sets both senior and verifier timeouts")
    parser.add_argument("--senior-timeout", type=int, help="Timeout in seconds for the senior review model")
    parser.add_argument("--verifier-timeout", type=int, help="Timeout in seconds for the verifier/fallback review model")
    parser.add_argument("--temperature", type=float, default=DEFAULT_TEMPERATURE, help="Sampling temperature for OpenAI-compatible requests")
    parser.add_argument("--openai-base-url", default=DEFAULT_OPENAI_BASE_URL, help="Optional OpenAI-compatible base URL override")
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
        args.priority = [part.strip().lower() for part in args.priority.split(",")]
    if args.suggested_batch:
        args.suggested_batch = [part.strip().lower() for part in args.suggested_batch.split(",")]
    if args.manual_review_severity:
        args.manual_review_severity = [part.strip().lower() for part in args.manual_review_severity.split(",")]
    shared_timeout = args.timeout
    args.senior_timeout = args.senior_timeout or shared_timeout or DEFAULT_SENIOR_TIMEOUT
    args.verifier_timeout = args.verifier_timeout or shared_timeout or DEFAULT_VERIFIER_TIMEOUT
    if args.senior_timeout <= 0:
        parser.error("--senior-timeout must be greater than 0")
    if args.verifier_timeout <= 0:
        parser.error("--verifier-timeout must be greater than 0")
    return args


def fetch_existing_matches(record: dict[str, Any]) -> list[dict[str, Any]]:
    connection = get_db_connection()
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


def heuristic_review(record: dict[str, Any], existing_matches: list[dict[str, Any]], review_mode: str) -> dict[str, Any]:
    suggested_mode = "new_record"
    if existing_matches:
        suggested_mode = "update_existing" if any(match.get("slug") == record.get("slug") for match in existing_matches) else "manual_review"

    caution_flags = []
    if record.get("status") in {"In Progress", "Partial"}:
        caution_flags.append("implementation_still_in_progress")
    if record.get("topic") == "Education":
        caution_flags.append("education_record_can_have_mixed_downstream_effects")

    warnings = source_warnings(record)
    if warnings:
        caution_flags.append("source_coverage_needs_review")
    if review_mode == "deep":
        caution_flags.append("deep_review_requested")

    first_outcome = (((record.get("actions") or [{}])[0]).get("outcomes") or [{}])[0]
    confidence_score = 0.45 if suggested_mode == "manual_review" or warnings else 0.7
    if review_mode == "deep":
        if first_outcome.get("impact_direction") == "Mixed":
            confidence_score -= 0.15
        if warnings:
            confidence_score -= 0.1
        if existing_matches and suggested_mode != "update_existing":
            confidence_score -= 0.1
        confidence_score = max(0.25, confidence_score)
    confidence_level = "Low" if confidence_score < 0.55 else "Medium"
    evidence_needed = []
    if warnings:
        evidence_needed.append("add stronger action- and outcome-level source coverage")
    if first_outcome.get("impact_direction") == "Mixed":
        evidence_needed.append("add clearer evidence for whether effects are mixed or predominantly negative")
    if suggested_mode != "new_record":
        evidence_needed.append("confirm whether this should update an existing promise record")
    if review_mode == "deep":
        evidence_needed.append("document why the current evidence supports this record more strongly than the closest alternative interpretation")

    return {
        "title_normalized": record.get("title"),
        "summary_suggestion": record.get("summary"),
        "topic_suggestion": record.get("topic"),
        "impacted_group_suggestion": record.get("impacted_group"),
        "status_suggestion": record.get("status"),
        "impact_direction_suggestion": first_outcome.get("impact_direction"),
        "evidence_strength_suggestion": map_evidence_strength(first_outcome.get("evidence_strength")),
        "record_action_suggestion": suggested_mode,
        "confidence_score": confidence_score,
        "confidence_level": confidence_level,
        "reasoning_summary": (
            "Heuristic deep review. Operator should scrutinize ambiguity, sourcing, and whether this is a new record or an update."
            if review_mode == "deep"
            else "Heuristic-only review. Operator should confirm wording, sourcing, and whether this is a new record or an update."
        ),
        "hesitation_reasons": warnings if warnings else ["manual verification still required"],
        "evidence_needed_to_reduce_risk": evidence_needed,
        "suggested_operator_next_action": suggested_operator_next_action(
            confidence_level=confidence_level,
            record_action_suggestion=suggested_mode,
            warnings=warnings,
            deep_review_ran=review_mode == "deep",
        ),
        "caution_flags": caution_flags,
        "source_warnings": warnings,
        "missing_source_warnings": warnings,
        "ambiguity_notes": "Dry-run heuristic review only. Operator should confirm wording, match choice, and downstream effect notes.",
    }


def call_openai(prompt: str, *, model: str, openai_base_url: str, timeout: int, temperature: float) -> dict[str, Any]:
    raw_text = generate_text(
        prompt,
        model=model,
        openai_base_url=openai_base_url or None,
        timeout_seconds=timeout,
        temperature=temperature,
        response_format="json",
    )
    return json.loads(raw_text or "{}")


def append_fallback_reason(base_note: str | None, reason: str) -> str:
    prefix = normalize_nullable_text(base_note) or "Operator should manually verify this advisory suggestion."
    return f"{prefix} OpenAI fallback reason: {reason}."


def call_openai_with_retry(
    prompt: str,
    *,
    model: str,
    openai_base_url: str,
    timeout: int,
    temperature: float,
) -> tuple[dict[str, Any] | None, int, list[str]]:
    errors: list[str] = []
    attempts = 0
    for _ in range(2):
        attempts += 1
        try:
            return (
                call_openai(
                    prompt,
                    model=model,
                    openai_base_url=openai_base_url,
                    timeout=timeout,
                    temperature=temperature,
                ),
                attempts,
                errors,
            )
        except Exception as exc:  # noqa: BLE001
            reason = normalize_nullable_text(str(exc)) or f"{model} failed without a usable error message"
            errors.append(reason)
    return None, attempts, errors


def build_retry_reason(label: str, errors: list[str]) -> str:
    details = " | ".join(errors) if errors else "No error detail was returned."
    return f"{label} failed after one retry: {details}"


def execute_review_ladder(
    *,
    prompt: str,
    args: argparse.Namespace,
    record: dict[str, Any],
    existing_matches: list[dict[str, Any]],
    heuristic_mode: str,
    senior_requested_model: str,
    verifier_requested_model: str,
    fallback_requested_model: str,
) -> tuple[dict[str, Any], dict[str, Any]]:
    senior_raw, senior_attempts, senior_errors = call_openai_with_retry(
        prompt,
        model=senior_requested_model,
        openai_base_url=args.openai_base_url,
        timeout=args.senior_timeout,
        temperature=args.temperature,
    )
    senior_attempted = senior_attempts > 0
    senior_retry_attempted = senior_attempts > 1

    if senior_raw is not None:
        return senior_raw, {
            "resolved_model": senior_requested_model,
            "effective_model": senior_requested_model,
            "review_backend": "openai",
            "fallback_used": False,
            "fallback_reason": None,
            "model_resolution_status": "exact_requested",
            "retry_count": max(0, senior_attempts - 1),
            "senior_attempted": senior_attempted,
            "senior_retry_attempted": senior_retry_attempted,
            "verifier_attempted": False,
            "verifier_retry_attempted": False,
            "verifier_model_used": None,
            "senior_model_used": senior_requested_model,
            "senior_timeout_seconds": args.senior_timeout,
            "verifier_timeout_seconds": args.verifier_timeout,
            "senior_failure_reason": None,
            "verifier_failure_reason": None,
        }

    verifier_raw, verifier_attempts, verifier_errors = call_openai_with_retry(
        prompt,
        model=fallback_requested_model,
        openai_base_url=args.openai_base_url,
        timeout=args.verifier_timeout,
        temperature=args.temperature,
    )
    verifier_attempted = verifier_attempts > 0
    verifier_retry_attempted = verifier_attempts > 1
    senior_reason = build_retry_reason("Senior model", senior_errors)

    if verifier_raw is not None:
        return verifier_raw, {
            "resolved_model": fallback_requested_model,
            "effective_model": fallback_requested_model,
            "review_backend": "fallback",
            "fallback_used": True,
            "fallback_reason": senior_reason,
            "model_resolution_status": "senior_failed_using_fallback_model",
            "retry_count": max(0, senior_attempts - 1) + max(0, verifier_attempts - 1),
            "senior_attempted": senior_attempted,
            "senior_retry_attempted": senior_retry_attempted,
            "verifier_attempted": verifier_attempted,
            "verifier_retry_attempted": verifier_retry_attempted,
            "verifier_model_used": fallback_requested_model,
            "senior_model_used": None,
            "senior_timeout_seconds": args.senior_timeout,
            "verifier_timeout_seconds": args.verifier_timeout,
            "senior_failure_reason": senior_reason,
            "verifier_failure_reason": None,
        }

    verifier_reason = build_retry_reason("Verifier/fallback model", verifier_errors)
    combined_reason = (
        f"{senior_reason} Verifier/fallback model also failed after one retry: "
        f"{' | '.join(verifier_errors) if verifier_errors else 'No error detail was returned.'} "
        "Heuristic fallback used as last resort."
    )
    heuristic_raw = heuristic_review(record, existing_matches, heuristic_mode)
    heuristic_raw["ambiguity_notes"] = append_fallback_reason(
        heuristic_raw.get("ambiguity_notes"),
        combined_reason,
    )
    return heuristic_raw, {
        "resolved_model": None,
        "effective_model": None,
        "review_backend": "heuristic_fallback",
        "fallback_used": True,
        "fallback_reason": combined_reason,
        "model_resolution_status": "senior_and_verifier_failed_using_heuristic",
        "retry_count": max(0, senior_attempts - 1) + max(0, verifier_attempts - 1),
        "senior_attempted": senior_attempted,
        "senior_retry_attempted": senior_retry_attempted,
        "verifier_attempted": verifier_attempted,
        "verifier_retry_attempted": verifier_retry_attempted,
        "verifier_model_used": None,
        "senior_model_used": None,
        "senior_timeout_seconds": args.senior_timeout,
        "verifier_timeout_seconds": args.verifier_timeout,
        "senior_failure_reason": senior_reason,
        "verifier_failure_reason": verifier_reason,
    }


def normalize_backend_reason(value: Any) -> str | None:
    return normalize_nullable_text(value)


def first_nonempty_text(*values: Any) -> str | None:
    for value in values:
        normalized = normalize_nullable_text(value)
        if normalized:
            return normalized
    return None


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


def normalize_string_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [item.strip() for item in (normalize_nullable_text(item) for item in value) if item]
    if value in (None, ""):
        return []
    text = normalize_nullable_text(value)
    return [text] if text else []


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

    required_fields = (
        "title_normalized",
        "summary_suggestion",
        "topic_suggestion",
        "impacted_group_suggestion",
        "status_suggestion",
        "impact_direction_suggestion",
        "evidence_strength_suggestion",
        "record_action_suggestion",
    )
    missing_fields = [field for field in required_fields if not normalize_nullable_text(suggestion.get(field))]
    if missing_fields:
        add_signal("incomplete_suggestions", f"Some suggestion fields are incomplete: {', '.join(missing_fields)}.")

    ambiguity_notes = (normalize_nullable_text(suggestion.get("ambiguity_notes")) or "").lower()
    if any(token in ambiguity_notes for token in ("uncertain", "ambig", "manual", "verify", "fallback")):
        add_signal("ambiguity_notes_present", "The review notes unresolved ambiguity or fallback handling.")

    recommended = bool(signals)
    if not recommended:
        reason = "No strong heuristic signals suggest that deep review is needed."
    else:
        top_reasons = [signal["reason"] for signal in signals[:3]]
        reason = " ".join(top_reasons)

    return {
        "deep_review_recommended": recommended,
        "deep_review_recommendation_reason": reason,
        "deep_review_recommendation_signals": signals,
    }


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


def build_suggestion_conflict_analysis(
    standard_pass: dict[str, Any],
    deep_pass: dict[str, Any] | None,
) -> dict[str, Any]:
    if deep_pass is None:
        return {
            "suggestion_conflicts": [],
            "has_material_conflict": False,
            "conflict_summary": "Deep pass not available; no cross-pass conflict analysis was generated.",
            "conflict_fields": [],
        }

    field_specs = [
        ("record_action", "record_action_suggestion", True, "A record-action disagreement changes whether this looks like a new record, an update, or a manual-review case."),
        ("impact_direction", "impact_direction_suggestion", True, "An impact-direction disagreement changes how the operator should characterize downstream effects."),
        ("evidence_strength", "evidence_strength_suggestion", True, "An evidence-strength disagreement changes how cautious the operator should be before import."),
        ("status", "status_suggestion", True, "A status disagreement changes how complete or implemented the record appears."),
        ("topic", "topic_suggestion", False, "A topic disagreement changes how the record is grouped and surfaced."),
        ("impacted_group", "impacted_group_suggestion", False, "An impacted-group disagreement changes who the record is describing."),
        ("confidence_level", "confidence_level", True, "A confidence-level disagreement changes how much trust to place in the review output."),
    ]

    conflicts: list[dict[str, Any]] = []
    for field_name, suggestion_key, default_material, operator_reason in field_specs:
        standard_value = standard_pass.get(suggestion_key)
        deep_value = deep_pass.get(suggestion_key)
        if standard_value == deep_value:
            continue
        conflicts.append(
            {
                "field": field_name,
                "suggestion_key": suggestion_key,
                "standard_value": standard_value,
                "deep_value": deep_value,
                "material": default_material,
                "operator_reason": operator_reason,
            }
        )

    standard_score = float(standard_pass.get("confidence_score") or 0.0)
    deep_score = float(deep_pass.get("confidence_score") or 0.0)
    if abs(standard_score - deep_score) >= 0.05:
        material = abs(standard_score - deep_score) >= 0.15
        conflicts.append(
            {
                "field": "confidence_score",
                "suggestion_key": "confidence_score",
                "standard_value": standard_score,
                "deep_value": deep_score,
                "material": material,
                "operator_reason": (
                    "A large confidence-score delta means the deeper pass materially changed how certain the review appears."
                    if material
                    else "The deeper pass nudged the confidence score enough to review both pass outputs side by side."
                ),
            }
        )

    has_material_conflict = any(conflict["material"] for conflict in conflicts)
    conflict_fields = [conflict["field"] for conflict in conflicts]
    if not conflicts:
        summary = "Standard and deep review suggestions did not materially diverge."
    elif has_material_conflict:
        summary = f"Standard and deep review disagree on material fields: {', '.join(conflict_fields)}."
    else:
        summary = f"Standard and deep review differ on non-material fields: {', '.join(conflict_fields)}."

    return {
        "suggestion_conflicts": conflicts,
        "has_material_conflict": has_material_conflict,
        "conflict_summary": summary,
        "conflict_fields": conflict_fields,
    }


def build_confidence_comparison(
    standard_pass: dict[str, Any],
    deep_pass: dict[str, Any] | None,
    final_suggestion: dict[str, Any],
) -> dict[str, Any]:
    standard_score = float(standard_pass.get("confidence_score") or 0.0)
    standard_level = standard_pass.get("confidence_level")
    final_score = float(final_suggestion.get("confidence_score") or 0.0)
    final_level = final_suggestion.get("confidence_level")

    comparison = {
        "standard_confidence_score": standard_score,
        "standard_confidence_level": standard_level,
        "deep_confidence_score": None,
        "deep_confidence_level": None,
        "final_confidence_score": final_score,
        "final_confidence_level": final_level,
        "score_delta_after_deep_review": None,
        "level_changed_after_deep_review": False,
        "summary": "Only one pass is available, so there is no cross-pass confidence comparison.",
    }

    if deep_pass is None:
        return {
            "confidence_comparison": comparison,
            "confidence_changed_after_deep_review": False,
        }

    deep_score = float(deep_pass.get("confidence_score") or 0.0)
    deep_level = deep_pass.get("confidence_level")
    delta = round(deep_score - standard_score, 2)
    level_changed = standard_level != deep_level
    changed = level_changed or abs(delta) >= 0.05

    if not changed:
        summary = "Standard and deep review landed on the same confidence assessment."
    elif delta > 0:
        summary = "Deep review increased confidence relative to the standard pass."
    elif delta < 0:
        summary = "Deep review lowered confidence relative to the standard pass."
    else:
        summary = "Deep review changed the confidence level without materially changing the numeric score."

    comparison.update(
        {
            "deep_confidence_score": deep_score,
            "deep_confidence_level": deep_level,
            "score_delta_after_deep_review": delta,
            "level_changed_after_deep_review": level_changed,
            "summary": summary,
        }
    )

    return {
        "confidence_comparison": comparison,
        "confidence_changed_after_deep_review": changed,
    }


def build_review_priority(
    final_suggestion: dict[str, Any],
    existing_matches: list[dict[str, Any]],
    recommendation: dict[str, Any],
    conflict_analysis: dict[str, Any],
    confidence_comparison: dict[str, Any],
) -> dict[str, Any]:
    signals: list[dict[str, Any]] = []

    def add_signal(code: str, weight: int, reason: str) -> None:
        signals.append({"code": code, "weight": weight, "reason": reason})

    if recommendation.get("deep_review_recommended"):
        add_signal("deep_review_recommended", 0, "The record already shows signals that justify deeper review.")

    if conflict_analysis.get("has_material_conflict"):
        add_signal("material_cross_pass_conflict", 3, "Standard and deep review disagree on material fields.")

    confidence_level = final_suggestion.get("confidence_level")
    confidence_score = float(final_suggestion.get("confidence_score") or 0.0)
    is_low_confidence = confidence_level == "Low" or confidence_score < 0.55
    if is_low_confidence:
        add_signal(
            "low_confidence",
            2 if confidence_score < 0.3 else 1,
            "The final advisory confidence is low.",
        )

    comparison_payload = confidence_comparison.get("confidence_comparison") or {}
    delta = comparison_payload.get("score_delta_after_deep_review")
    if confidence_comparison.get("confidence_changed_after_deep_review") and isinstance(delta, (int, float)) and delta < 0:
        add_signal("confidence_dropped_after_deep_review", 1, "Deep review lowered confidence compared with the standard pass.")

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

    recommendation_codes = {signal.get("code") for signal in recommendation.get("deep_review_recommendation_signals") or []}
    if "incomplete_suggestions" in recommendation_codes:
        add_signal("incomplete_suggestions", 1, "Some suggestion fields remain incomplete.")

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
        top_reasons = [signal["reason"] for signal in ordered[:3]]
        reason = " ".join(top_reasons)

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
    conflict_analysis: dict[str, Any],
    review_priority: dict[str, Any],
    deep_review_ran: bool,
) -> dict[str, Any]:
    tags: list[str] = []

    def add_tag(tag: str) -> None:
        if tag not in tags:
            tags.append(tag)

    if review_priority.get("review_priority") == "high" or conflict_analysis.get("has_material_conflict"):
        add_tag("high_attention")

    if final_suggestion.get("record_action_suggestion") == "manual_review" or final_suggestion.get("suggested_operator_next_action") == "manual_review_required":
        add_tag("manual_review_focus")

    if recommendation.get("deep_review_recommended") and not deep_review_ran:
        add_tag("deep_review_candidates")

    if normalize_string_list(final_suggestion.get("source_warnings")) or normalize_string_list(final_suggestion.get("evidence_needed_to_reduce_risk")):
        add_tag("source_check_needed")

    if existing_matches and final_suggestion.get("record_action_suggestion") != "update_existing":
        add_tag("manual_review_focus")

    low_risk = (
        review_priority.get("review_priority") == "low"
        and not review_priority.get("operator_attention_needed")
        and float(final_suggestion.get("confidence_score") or 0.0) >= 0.6
        and not conflict_analysis.get("has_material_conflict")
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


def normalize_suggestion_fields(raw: dict[str, Any], record: dict[str, Any], existing_matches: list[dict[str, Any]], deep_review_ran: bool) -> dict[str, Any]:
    suggestion = dict(raw)
    score = normalize_confidence_score(suggestion.get("confidence_score"))
    level = normalize_confidence_level(suggestion.get("confidence_level"), score)
    warnings = sorted(set(source_warnings(record) + normalize_string_list(suggestion.get("source_warnings")) + normalize_string_list(suggestion.get("missing_source_warnings"))))
    caution_flags = sorted(set(normalize_string_list(suggestion.get("caution_flags"))))

    if existing_matches and not suggestion.get("record_action_suggestion"):
        suggestion["record_action_suggestion"] = "manual_review"
    suggestion["record_action_suggestion"] = suggestion.get("record_action_suggestion") if suggestion.get("record_action_suggestion") in VALID_RECORD_ACTIONS else "manual_review"
    suggestion["status_suggestion"] = suggestion.get("status_suggestion") if suggestion.get("status_suggestion") in VALID_STATUSES else record.get("status")
    suggestion["impact_direction_suggestion"] = suggestion.get("impact_direction_suggestion") if suggestion.get("impact_direction_suggestion") in VALID_IMPACT_DIRECTIONS else ((((record.get("actions") or [{}])[0]).get("outcomes") or [{}])[0]).get("impact_direction")
    suggestion["evidence_strength_suggestion"] = map_evidence_strength(suggestion.get("evidence_strength_suggestion")) or map_evidence_strength(((((record.get("actions") or [{}])[0]).get("outcomes") or [{}])[0]).get("evidence_strength"))
    if suggestion["evidence_strength_suggestion"] not in VALID_EVIDENCE_STRENGTHS:
        suggestion["evidence_strength_suggestion"] = "Limited"

    suggestion["title_normalized"] = normalize_nullable_text(suggestion.get("title_normalized")) or record.get("title")
    suggestion["summary_suggestion"] = normalize_nullable_text(suggestion.get("summary_suggestion")) or record.get("summary")
    suggestion["topic_suggestion"] = normalize_nullable_text(suggestion.get("topic_suggestion")) or record.get("topic")
    suggestion["impacted_group_suggestion"] = normalize_nullable_text(suggestion.get("impacted_group_suggestion")) or record.get("impacted_group")
    suggestion["confidence_score"] = score
    suggestion["confidence_level"] = level
    suggestion["reasoning_summary"] = normalize_nullable_text(suggestion.get("reasoning_summary")) or "Operator should review AI output before import."
    suggestion["source_warnings"] = warnings
    suggestion["missing_source_warnings"] = warnings
    suggestion["caution_flags"] = caution_flags
    suggestion["hesitation_reasons"] = normalize_string_list(suggestion.get("hesitation_reasons"))
    suggestion["evidence_needed_to_reduce_risk"] = normalize_string_list(suggestion.get("evidence_needed_to_reduce_risk"))
    suggestion["suggested_operator_next_action"] = (
        suggestion.get("suggested_operator_next_action")
        if suggestion.get("suggested_operator_next_action") in {
            "review_queue_and_dry_run_import",
            "manual_review_required",
            "check_sources_before_import",
            "review_deep_review_output",
        }
        else suggested_operator_next_action(
            confidence_level=level,
            record_action_suggestion=suggestion["record_action_suggestion"],
            warnings=warnings,
            deep_review_ran=deep_review_ran,
        )
    )
    suggestion["ambiguity_notes"] = normalize_nullable_text(suggestion.get("ambiguity_notes")) or "Operator should manually verify this advisory suggestion."
    if deep_review_ran:
        suggestion["caution_flags"] = sorted(set(suggestion["caution_flags"] + ["deep_review_requested"]))
    suggestion.update(build_confidence_details(record, suggestion, existing_matches))
    return suggestion


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
    conflicts = sum(1 for item in display_items if item.get("has_material_conflict"))
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
        f"Items with material conflicts: {conflicts}",
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
        conflict_flag = "yes" if item.get("has_material_conflict") else "no"
        attention_flag = "yes" if item.get("operator_attention_needed") else "no"
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
                f"  retry_count: {item.get('retry_count')}",
                f"  senior_attempted: {'yes' if item.get('senior_attempted') else 'no'}",
                f"  verifier_attempted: {'yes' if item.get('verifier_attempted') else 'no'}",
                f"  suggested_batch: {item.get('suggested_batch')}",
                f"  batch_reason: {item.get('suggested_batch_reason')}",
                f"  attention_needed: {attention_flag}",
                f"  material_conflict: {conflict_flag}",
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
            "timeout_seconds": report.get("timeout_seconds"),
            "senior_timeout_seconds": report.get("senior_timeout_seconds"),
            "verifier_timeout_seconds": report.get("verifier_timeout_seconds"),
            "retry_count": report.get("retry_count"),
            "senior_attempted": report.get("senior_attempted"),
            "senior_retry_attempted": report.get("senior_retry_attempted"),
            "verifier_attempted": report.get("verifier_attempted"),
            "verifier_retry_attempted": report.get("verifier_retry_attempted"),
            "review_mode": report.get("review_mode"),
            "dry_run": report.get("dry_run"),
        },
        "worklist_filters": worklist_filters,
        "item_count": len(items),
        "worklist_summary": {
            "review_priority_counts": review_priority_counts,
            "suggested_batch_counts": suggested_batch_counts,
            "items_needing_attention": sum(1 for item in items if item.get("operator_attention_needed")),
            "items_with_material_conflicts": sum(1 for item in items if item.get("has_material_conflict")),
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
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return log_dir / f"{batch_name}.{timestamp}.decision-log.json"


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
            "Decision file did not contain any usable item decisions. Regenerate it with 'equitystack current-admin workflow review' and fill explicit operator_action values."
        )
    for slug, item in decisions.items():
        action = normalize_nullable_text(item.get("operator_action"))
        if action not in VALID_OPERATOR_ACTIONS:
            raise ValueError(
                f"Decision file entry for slug={slug} is missing a valid operator_action. "
                "Regenerate the template with 'equitystack current-admin workflow review' if the file is stale, then fill one of the documented operator actions."
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
            "Regenerate the template using 'equitystack current-admin workflow review' from the same .ai-review.json file you plan to finalize."
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


def review_record(args: argparse.Namespace, record: dict[str, Any], existing_matches: list[dict[str, Any]]) -> dict[str, Any]:
    deep_review_requested = args.review_mode == "deep"
    senior_requested_model = args.model or DEFAULT_MODEL_SENIOR
    verifier_requested_model = args.verifier_model or DEFAULT_MODEL_VERIFIER
    fallback_requested_model = args.fallback_model or verifier_requested_model

    if args.dry_run:
        standard_raw = heuristic_review(record, existing_matches, "standard")
        standard_pass = normalize_suggestion_fields(standard_raw, record, existing_matches, deep_review_ran=False)
        deep_pass = None
        deep_review_ran = False
        deep_review_reason = "dry_run_mode"
        review_mode_used = "standard"
        final_suggestion = standard_pass
        if deep_review_requested:
            deep_raw = heuristic_review(record, existing_matches, "deep")
            deep_pass = normalize_suggestion_fields(deep_raw, record, existing_matches, deep_review_ran=True)
            final_suggestion = deep_pass
            deep_review_ran = True
            deep_review_reason = "dry_run_heuristic_second_pass"
            review_mode_used = "deep"
        recommendation = build_deep_review_recommendation(record, final_suggestion, existing_matches)
        conflict_analysis = build_suggestion_conflict_analysis(standard_pass, deep_pass)
        confidence_comparison = build_confidence_comparison(standard_pass, deep_pass, final_suggestion)
        review_priority = build_review_priority(final_suggestion, existing_matches, recommendation, conflict_analysis, confidence_comparison)
        suggested_batch = build_suggested_batch(final_suggestion, existing_matches, recommendation, conflict_analysis, review_priority, deep_review_ran)
        return {
            "slug": record.get("slug"),
            "title": record.get("title"),
            "requested_model": senior_requested_model,
            "effective_model": None,
            "resolved_model": None,
            "review_mode": args.review_mode,
            "review_mode_requested": args.review_mode,
            "review_mode_used": review_mode_used,
            "review_backend": "dry_run",
            "model_used": None,
            "verifier_model_requested": verifier_requested_model,
            "verifier_model_used": None,
            "senior_model_requested": senior_requested_model,
            "senior_model_used": None,
            "fallback_model": fallback_requested_model,
            "fallback_used": False,
            "fallback_reason": None,
            "model_resolution_status": "dry_run",
            "timeout_seconds": args.senior_timeout,
            "senior_timeout_seconds": args.senior_timeout,
            "verifier_timeout_seconds": args.verifier_timeout,
            "retry_count": 0,
            "senior_attempted": False,
            "senior_retry_attempted": False,
            "verifier_attempted": False,
            "verifier_retry_attempted": False,
            "deep_review_requested": deep_review_requested,
            "deep_review_ran": deep_review_ran,
            "deep_review_reason": deep_review_reason,
            "second_pass_ran": deep_review_ran,
            **recommendation,
            **conflict_analysis,
            **confidence_comparison,
            **review_priority,
            **suggested_batch,
            "existing_matches": existing_matches,
            "suggestions": final_suggestion,
            "standard_pass_suggestions": standard_pass,
            "deep_pass_suggestions": deep_pass,
        }

    standard_raw, standard_execution = execute_review_ladder(
        prompt=build_prompt(record, existing_matches),
        args=args,
        record=record,
        existing_matches=existing_matches,
        heuristic_mode="standard",
        senior_requested_model=senior_requested_model,
        verifier_requested_model=verifier_requested_model,
        fallback_requested_model=fallback_requested_model,
    )
    standard_pass = normalize_suggestion_fields(standard_raw, record, existing_matches, deep_review_ran=False)
    final_suggestion = standard_pass
    deep_pass = None
    deep_review_ran = False
    deep_review_reason = "standard_review_completed"
    review_mode_used = "standard"
    review_backend = standard_execution["review_backend"]
    effective_model = standard_execution["effective_model"]
    resolved_model = standard_execution["resolved_model"]
    fallback_used = standard_execution["fallback_used"]
    fallback_reason = standard_execution["fallback_reason"]
    model_resolution_status = standard_execution["model_resolution_status"]
    verifier_model_used = standard_execution["verifier_model_used"]
    senior_model_used = standard_execution["senior_model_used"]
    retry_count = standard_execution["retry_count"]
    senior_attempted = standard_execution["senior_attempted"]
    senior_retry_attempted = standard_execution["senior_retry_attempted"]
    verifier_attempted = standard_execution["verifier_attempted"]
    verifier_retry_attempted = standard_execution["verifier_retry_attempted"]

    if deep_review_requested:
        deep_raw, deep_execution = execute_review_ladder(
            prompt=build_deep_review_prompt(record, existing_matches, standard_pass),
            args=args,
            record=record,
            existing_matches=existing_matches,
            heuristic_mode="deep",
            senior_requested_model=senior_requested_model,
            verifier_requested_model=verifier_requested_model,
            fallback_requested_model=fallback_requested_model,
        )
        deep_pass = normalize_suggestion_fields(deep_raw, record, existing_matches, deep_review_ran=True)
        final_suggestion = deep_pass
        deep_review_ran = True
        review_mode_used = "deep"
        review_backend = deep_execution["review_backend"]
        effective_model = deep_execution["effective_model"]
        resolved_model = deep_execution["resolved_model"]
        fallback_used = deep_execution["fallback_used"]
        fallback_reason = deep_execution["fallback_reason"]
        model_resolution_status = deep_execution["model_resolution_status"]
        verifier_model_used = deep_execution["verifier_model_used"]
        senior_model_used = deep_execution["senior_model_used"]
        retry_count = standard_execution["retry_count"] + deep_execution["retry_count"]
        senior_attempted = standard_execution["senior_attempted"] or deep_execution["senior_attempted"]
        senior_retry_attempted = standard_execution["senior_retry_attempted"] or deep_execution["senior_retry_attempted"]
        verifier_attempted = standard_execution["verifier_attempted"] or deep_execution["verifier_attempted"]
        verifier_retry_attempted = standard_execution["verifier_retry_attempted"] or deep_execution["verifier_retry_attempted"]
        if review_backend == "openai":
            deep_review_reason = "operator_requested_with_senior_review"
        elif review_backend == "fallback":
            deep_review_reason = "operator_requested_but_senior_failed_using_verifier_fallback"
        else:
            deep_review_reason = "operator_requested_but_senior_and_verifier_failed_using_heuristic"

    recommendation = build_deep_review_recommendation(record, final_suggestion, existing_matches)
    conflict_analysis = build_suggestion_conflict_analysis(standard_pass, deep_pass)
    confidence_comparison = build_confidence_comparison(standard_pass, deep_pass, final_suggestion)
    review_priority = build_review_priority(final_suggestion, existing_matches, recommendation, conflict_analysis, confidence_comparison)
    suggested_batch = build_suggested_batch(final_suggestion, existing_matches, recommendation, conflict_analysis, review_priority, deep_review_ran)
    return {
        "slug": record.get("slug"),
        "title": record.get("title"),
        "requested_model": senior_requested_model,
        "effective_model": effective_model,
        "resolved_model": resolved_model,
        "review_mode": args.review_mode,
        "review_mode_requested": args.review_mode,
        "review_mode_used": review_mode_used,
        "review_backend": review_backend,
        "model_used": effective_model,
        "verifier_model_requested": verifier_requested_model,
        "verifier_model_used": verifier_model_used,
        "senior_model_requested": senior_requested_model,
        "senior_model_used": senior_model_used,
        "fallback_model": fallback_requested_model,
        "fallback_used": fallback_used,
        "fallback_reason": fallback_reason,
        "model_resolution_status": model_resolution_status,
        "timeout_seconds": args.senior_timeout,
        "senior_timeout_seconds": args.senior_timeout,
        "verifier_timeout_seconds": args.verifier_timeout,
        "retry_count": retry_count,
        "senior_attempted": senior_attempted,
        "senior_retry_attempted": senior_retry_attempted,
        "verifier_attempted": verifier_attempted,
        "verifier_retry_attempted": verifier_retry_attempted,
        "deep_review_requested": deep_review_requested,
        "deep_review_ran": deep_review_ran,
        "deep_review_reason": deep_review_reason,
        "second_pass_ran": deep_review_ran,
        **recommendation,
        **conflict_analysis,
        **confidence_comparison,
        **review_priority,
        **suggested_batch,
        "existing_matches": existing_matches,
        "suggestions": final_suggestion,
        "standard_pass_suggestions": standard_pass,
        "deep_pass_suggestions": deep_pass,
    }


def build_prompt(record: dict[str, Any], existing_matches: list[dict[str, Any]]) -> str:
    return f"""
You are performing editorial advisory review for one current-administration Promise Tracker record.

Return strict JSON with these keys:
- title_normalized
- summary_suggestion
- topic_suggestion
- impacted_group_suggestion
- status_suggestion
- impact_direction_suggestion
- evidence_strength_suggestion
- record_action_suggestion
- confidence_score
- confidence_level
- reasoning_summary
- hesitation_reasons
- evidence_needed_to_reduce_risk
- suggested_operator_next_action
- caution_flags
- source_warnings
- missing_source_warnings
- ambiguity_notes

=== RECORD ACTION DISTINCTION ===
First determine whether this is a new_record or update_existing by comparing the slug/title against existing_matches.
- If a slug/title match exists in existing_matches with similar or identical record data, choose "update_existing".
- If no matches exist or matches appear to be distinct topics/policies, choose "new_record".
- Only choose "manual_review" if you are genuinely uncertain about the distinction.

=== IMPACT DIRECTION HANDLING ===
Be especially careful with Mixed impact:
- Mixed means there are clearly documented positive and negative effects that roughly balance.
- Negative means negative effects dominate or are clearly worse than positives.
- If evidence is thin, prefer "Limited" evidence strength and flag Mixed/Negative ambiguity in hesitation_reasons.
- Do not invent effects to avoid Mixed; only report what sources clearly support.

=== CONFIDENCE RULES ===
- High: You can confidently say this is new or update and impact is clear with strong sourcing.
- Medium: Sourcing is moderate, impact direction is clear but not fully supported by strong evidence.
- Low: Sourcing is weak or missing, or impact direction is clearly ambiguous.

=== OUTPUT RULES ===
- advisory only
- do not invent facts
- prefer manual_review when uncertain
- record_action_suggestion must be one of: new_record, update_existing, manual_review
- status_suggestion must be one of: In Progress, Partial, Delivered, Blocked, Failed
- impact_direction_suggestion must be one of: Positive, Negative, Mixed, Blocked
- evidence_strength_suggestion must be one of: Strong, Moderate, Limited
- confidence_score must be between 0 and 1
- confidence_level must be one of: High, Medium, Low
- keep reasoning_summary short and operator-facing (3-5 sentences explaining key judgments)
- hesitation_reasons must be an array of short strings (why you hesitate, what would clarify)
- evidence_needed_to_reduce_risk must be an array of short strings (what evidence would make this safer to import)
- suggested_operator_next_action must be one of:
  - review_queue_and_dry_run_import
  - manual_review_required
  - check_sources_before_import
  - review_deep_review_output
- source_warnings and missing_source_warnings must be arrays of short machine-friendly strings

Record:
{json.dumps(record, indent=2)}

Existing matches:
{json.dumps(existing_matches, indent=2)}
""".strip()


def build_deep_review_prompt(
    record: dict[str, Any],
    existing_matches: list[dict[str, Any]],
    first_pass: dict[str, Any],
) -> str:
    return f"""
You are performing a deeper second-pass editorial review for one difficult current-administration Promise Tracker record.

Return strict JSON with the same keys as the standard pass:
- title_normalized
- summary_suggestion
- topic_suggestion
- impacted_group_suggestion
- status_suggestion
- impact_direction_suggestion
- evidence_strength_suggestion
- record_action_suggestion
- confidence_score
- confidence_level
- reasoning_summary
- hesitation_reasons
- evidence_needed_to_reduce_risk
- suggested_operator_next_action
- caution_flags
- source_warnings
- missing_source_warnings
- ambiguity_notes

Deep review priorities:
- new record vs update existing record
- Mixed vs Negative ambiguity
- weak vs moderate evidence strength
- missing-source cautions
- strongest reasons a reviewer should hesitate
- what evidence would make the record safer to import

Keep the output advisory only.
Prefer manual_review when uncertainty remains.

Record:
{json.dumps(record, indent=2)}

Existing matches:
{json.dumps(existing_matches, indent=2)}

Standard-pass suggestion:
{json.dumps(first_pass, indent=2)}

=== DEEP REVIEW INSTRUCTIONS ===
1. Carefully review the standard-pass suggestion for the record.
2. Re-evaluate your confidence and record action with this deeper pass.
3. Consider whether the standard pass had low confidence, weak sources, or multiple hesitation reasons.
4. Use this deeper pass to resolve any ambiguities the first pass raised.
5. Only change suggestions if the deeper review provides stronger signals.
6. If the first pass was already confident and well-sourced, it may need little correction.
7. If the first pass was low confidence, you may need to correct record action or impact direction.
8. Document why you are changing or maintaining the standard pass suggestions.
""".strip()


def main() -> None:
    args = parse_args()
    payload = read_batch_payload(args.input)
    selected_records = select_records(payload, args.only_slug, args.max_items)
    output_path = args.output or resolve_default_report_path(payload["batch_name"], "ai-review")

    items = []
    csv_rows = []

    for record in selected_records:
        existing_matches = fetch_existing_matches(record)
        item = review_record(args, record, existing_matches)
        suggestion = item["suggestions"]
        items.append(item)
        csv_rows.append(
            {
                "slug": record.get("slug"),
                "title": record.get("title"),
                "requested_model": item.get("requested_model"),
                "effective_model": item.get("effective_model"),
                "resolved_model": item.get("resolved_model"),
                "review_mode": item.get("review_mode"),
                "review_mode_requested": item.get("review_mode_requested"),
                "review_mode_used": item.get("review_mode_used"),
                "review_backend": item.get("review_backend"),
                "model_used": item.get("model_used"),
                "fallback_used": item.get("fallback_used"),
                "fallback_reason": item.get("fallback_reason"),
                "model_resolution_status": item.get("model_resolution_status"),
                "timeout_seconds": item.get("timeout_seconds"),
                "senior_timeout_seconds": item.get("senior_timeout_seconds"),
                "verifier_timeout_seconds": item.get("verifier_timeout_seconds"),
                "retry_count": item.get("retry_count"),
                "senior_attempted": item.get("senior_attempted"),
                "senior_retry_attempted": item.get("senior_retry_attempted"),
                "verifier_attempted": item.get("verifier_attempted"),
                "verifier_retry_attempted": item.get("verifier_retry_attempted"),
                "deep_review_requested": item.get("deep_review_requested"),
                "deep_review_ran": item.get("deep_review_ran"),
                "second_pass_ran": item.get("second_pass_ran"),
                "deep_review_recommended": item.get("deep_review_recommended"),
                "has_material_conflict": item.get("has_material_conflict"),
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

    requested_model = args.model or DEFAULT_MODEL_SENIOR
    effective_models = sorted({item.get("effective_model") for item in items if item.get("effective_model")})
    review_backends = sorted({item.get("review_backend") for item in items if item.get("review_backend")})
    model_statuses = sorted({item.get("model_resolution_status") for item in items if item.get("model_resolution_status")})
    fallback_reasons = sorted({item.get("fallback_reason") for item in items if item.get("fallback_reason")})

    report = {
        "batch_name": payload.get("batch_name"),
        "input_path": str(args.input),
        "model": requested_model,
        "requested_model": requested_model,
        "effective_model": effective_models[0] if len(effective_models) == 1 else ("mixed" if effective_models else None),
        "resolved_model": effective_models[0] if len(effective_models) == 1 else ("mixed" if effective_models else None),
        "review_backend": review_backends[0] if len(review_backends) == 1 else ("mixed" if review_backends else None),
        "fallback_used": any(bool(item.get("fallback_used")) for item in items),
        "fallback_reason": fallback_reasons[0] if len(fallback_reasons) == 1 else ("Multiple fallback reasons; inspect item-level metadata." if fallback_reasons else None),
        "model_resolution_status": model_statuses[0] if len(model_statuses) == 1 else ("mixed" if model_statuses else None),
        "verifier_model": args.verifier_model or DEFAULT_MODEL_VERIFIER,
        "fallback_model": args.fallback_model or DEFAULT_MODEL_FALLBACK,
        "review_mode": args.review_mode,
        "dry_run": args.dry_run,
        "timeout_seconds": args.senior_timeout,
        "senior_timeout_seconds": args.senior_timeout,
        "verifier_timeout_seconds": args.verifier_timeout,
        "retry_count": sum(int(item.get("retry_count") or 0) for item in items),
        "senior_attempted": any(bool(item.get("senior_attempted")) for item in items),
        "senior_retry_attempted": any(bool(item.get("senior_retry_attempted")) for item in items),
        "verifier_attempted": any(bool(item.get("verifier_attempted")) for item in items),
        "verifier_retry_attempted": any(bool(item.get("verifier_retry_attempted")) for item in items),
        "resolved_output_path": str(output_path),
        "reviewed_count": len(items),
        "deep_review_count": sum(1 for item in items if item.get("deep_review_ran")),
        "fallback_count": sum(1 for item in items if item.get("fallback_used")),
        "review_priority_counts": {
            "low": sum(1 for item in items if item.get("review_priority") == "low"),
            "medium": sum(1 for item in items if item.get("review_priority") == "medium"),
            "high": sum(1 for item in items if item.get("review_priority") == "high"),
        },
        "items": items,
    }
    suggested_batches, suggested_batch_counts = build_suggested_batch_summary(items)
    report["suggested_batches"] = suggested_batches
    report["suggested_batch_counts"] = suggested_batch_counts

    write_json_file(output_path, report)
    csv_path = derive_csv_path(args.csv, output_path)
    if csv_path:
        write_csv_rows(csv_path, csv_rows)

    display_items = apply_display_filters(items, args)
    worklist_payload = None
    if args.export_worklist:
        worklist_payload = build_worklist_payload(report, display_items, args)
        write_json_file(args.export_worklist, worklist_payload)
    decision_log_payload = None
    decision_log_path = None
    if args.log_decisions is not None:
        decisions, decision_metadata = load_operator_decisions(args.decision_file)
        decision_log_payload = build_decision_log_payload(report, display_items, args, args.decision_file, decisions, decision_metadata)
        if not decision_log_payload["items"]:
            raise ValueError("No reviewed items matched the provided decision file after applying the current display filters.")
        decision_log_path = derive_decision_log_path(payload["batch_name"], args.log_decisions)
        decision_log_path.parent.mkdir(parents=True, exist_ok=True)
        if decision_log_path.exists():
            raise FileExistsError(f"Decision log already exists: {decision_log_path}")
        write_json_file(decision_log_path, decision_log_payload)
    if args.preview:
        print("\n".join(build_preview_lines(display_items)))
        if args.summary:
            print()
            print("\n".join(build_display_summary(display_items, len(items))))
        if worklist_payload:
            print()
            print(f"Worklist exported: {args.export_worklist}")
            print(f"Selected items: {worklist_payload['item_count']}")
        if decision_log_payload:
            print(f"Decision log exported: {decision_log_path}")
            print(f"Logged decisions: {len(decision_log_payload['items'])}")
        return
    if args.summary:
        print("\n".join(build_display_summary(display_items, len(items))))
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
            "item_count": len(decision_log_payload["items"]),
            "session_id": decision_log_payload["session_id"],
            "decision_counts": decision_log_payload["decision_counts"],
        }
    print_json(display_report)


if __name__ == "__main__":
    try:
        main()
    except (FileNotFoundError, FileExistsError, ValueError) as exc:
        raise SystemExit(str(exc)) from exc
