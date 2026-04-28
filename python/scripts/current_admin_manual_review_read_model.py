#!/usr/bin/env python3
import argparse
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from current_admin_common import get_current_admin_reports_dir, normalize_nullable_text
from current_admin_openai_batch_guardrails import output_path_for_review, validation_path_for_review


ARTIFACT_VERSION = 1
VALID_REASON_FILTERS = {
    "schema",
    "conflicting-sources",
    "weak-evidence",
    "unclear",
    "low-confidence",
    "manual-review-requested",
    "ambiguous-subject",
    "date-uncertain",
}
VALID_CONFIDENCE_BUCKETS = {"0.00-0.59", "0.60-0.74", "0.75-0.84", "0.85+"}
VALID_READINESS_LABELS = {
    "needs-artifact-repair",
    "needs-evidence-verification",
    "needs-operator-judgment",
    "ready-for-operator-decision",
}
READINESS_LABEL_TEXT = {
    "needs-artifact-repair": "needs artifact repair",
    "needs-evidence-verification": "needs evidence verification",
    "needs-operator-judgment": "needs operator judgment",
    "ready-for-operator-decision": "ready for operator decision",
}
REASON_PRIORITY = {
    "schema/validation issue": 1,
    "conflicting sources": 2,
    "weak evidence": 3,
    "unclear classification": 4,
    "low confidence": 5,
    "manual review requested by model": 6,
    "ambiguous subject": 7,
    "date uncertain": 8,
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Read current-admin manual-review items from review artifacts and Batch sidecars."
    )
    parser.add_argument("--batch-name", help="Limit output to one current-admin batch name.")
    parser.add_argument(
        "--reason",
        choices=sorted(VALID_REASON_FILTERS),
        help="Limit output to items with one reason label.",
    )
    parser.add_argument(
        "--confidence-bucket",
        choices=sorted(VALID_CONFIDENCE_BUCKETS),
        help="Limit output to one confidence bucket.",
    )
    parser.add_argument(
        "--unresolved-only",
        action="store_true",
        help="Only include items without a filled operator action in the latest known decision artifact.",
    )
    parser.add_argument(
        "--readiness",
        choices=sorted(VALID_READINESS_LABELS),
        help="Limit output to one decision-readiness group.",
    )
    parser.add_argument(
        "--schema-blocked-only",
        action="store_true",
        help="Only include items blocked by schema or validation problems.",
    )
    parser.add_argument(
        "--judgment-required-only",
        action="store_true",
        help="Only include items that need human judgment rather than artifact repair.",
    )
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON output.")
    return parser.parse_args()


def load_json_file(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text())
    if not isinstance(payload, dict):
        raise ValueError(f"{path} must contain a JSON object.")
    return payload


def load_optional_json(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    return load_json_file(path)


def review_artifact_paths() -> list[Path]:
    reports_dir = get_current_admin_reports_dir()
    return sorted(
        (path for path in reports_dir.glob("*.ai-review.json") if path.is_file()),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )


def normalize_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [text for text in (normalize_nullable_text(item) for item in value) if text]


def normalize_confidence(value: Any) -> float:
    try:
        score = float(value)
    except (TypeError, ValueError):
        return 0.0
    return min(1.0, max(0.0, score))


def confidence_bucket(score: float) -> str:
    if score < 0.60:
        return "0.00-0.59"
    if score < 0.75:
        return "0.60-0.74"
    if score < 0.85:
        return "0.75-0.84"
    return "0.85+"


def classification_from_suggestion(suggestion: dict[str, Any]) -> str:
    value = (normalize_nullable_text(suggestion.get("impact_direction_suggestion")) or "").lower()
    if value in {"positive", "negative", "mixed", "blocked"}:
        return value
    return "unclear"


def recommended_action_from_suggestion(suggestion: dict[str, Any]) -> str:
    if safe_auto_resolution_from_suggestion(suggestion):
        return "approve"
    record_action = normalize_nullable_text(suggestion.get("record_action_suggestion")) or ""
    operator_action = normalize_nullable_text(suggestion.get("suggested_operator_next_action")) or ""
    if record_action in {"new_record", "update_existing"} and operator_action != "manual_review_required":
        return "approve"
    if record_action == "reject":
        return "reject"
    return "needs_manual_review"


def source_quality_from_suggestion(suggestion: dict[str, Any]) -> str:
    evidence = normalize_nullable_text(suggestion.get("evidence_strength_suggestion")) or ""
    mapping = {"Strong": "high", "Moderate": "medium", "Limited": "low", "Weak": "low"}
    return mapping.get(evidence, "low")


def safe_auto_resolution_from_suggestion(suggestion: dict[str, Any]) -> bool:
    if suggestion.get("safe_auto_resolution") is True:
        return True
    return normalize_nullable_text(suggestion.get("existing_update_resolution")) in {
        "no_material_change",
        "source_only_refresh",
    }


def flags_from_suggestion(item: dict[str, Any], suggestion: dict[str, Any], source_quality: str) -> dict[str, bool]:
    caution_flags = set(normalize_string_list(suggestion.get("caution_flags")))
    source_issues = normalize_string_list(suggestion.get("source_warnings")) + normalize_string_list(
        suggestion.get("missing_source_warnings")
    )
    missing_information = normalize_string_list(suggestion.get("evidence_needed_to_reduce_risk"))
    signal_ambiguity = (normalize_nullable_text(suggestion.get("signal_ambiguity")) or "").lower()
    return {
        "ambiguous_subject": "ambiguous_subject" in caution_flags or signal_ambiguity == "high",
        "conflicting_sources": "conflicting_sources" in caution_flags or bool(item.get("has_material_conflict")),
        "weak_evidence": "weak_evidence" in caution_flags or source_quality == "low" or bool(source_issues or missing_information),
        "date_uncertain": "date_uncertain" in caution_flags,
    }


def parse_batch_output_text(raw_text: str) -> dict[str, dict[str, Any]]:
    results: dict[str, dict[str, Any]] = {}
    for line in raw_text.splitlines():
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        custom_id = normalize_nullable_text(row.get("custom_id"))
        body = row.get("response", {}).get("body", {}) if isinstance(row.get("response"), dict) else {}
        choices = body.get("choices") if isinstance(body, dict) else None
        if not custom_id or not isinstance(choices, list) or not choices:
            continue
        message = choices[0].get("message") if isinstance(choices[0], dict) else {}
        content = message.get("content") if isinstance(message, dict) else None
        if not isinstance(content, str):
            continue
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict):
            results[custom_id] = parsed
    return results


def load_raw_classifier_by_item_id(review_path: Path) -> dict[str, dict[str, Any]]:
    output_path = output_path_for_review(review_path)
    if not output_path.exists():
        return {}
    return parse_batch_output_text(output_path.read_text())


def normalize_classifier_context(item: dict[str, Any], raw_classifier: dict[str, Any] | None) -> dict[str, Any]:
    suggestion = item.get("suggestions") if isinstance(item.get("suggestions"), dict) else {}
    source_quality = (
        normalize_nullable_text(raw_classifier.get("source_quality")) if isinstance(raw_classifier, dict) else None
    ) or source_quality_from_suggestion(suggestion)
    flags = raw_classifier.get("flags") if isinstance(raw_classifier, dict) and isinstance(raw_classifier.get("flags"), dict) else None

    return {
        "entity_type": (
            normalize_nullable_text(raw_classifier.get("entity_type")) if isinstance(raw_classifier, dict) else None
        ) or "promise",
        "entity_id": (
            normalize_nullable_text(raw_classifier.get("entity_id")) if isinstance(raw_classifier, dict) else None
        ) or normalize_nullable_text(item.get("slug")),
        "recommended_action": (
            normalize_nullable_text(raw_classifier.get("recommended_action")) if isinstance(raw_classifier, dict) else None
        ) or recommended_action_from_suggestion(suggestion),
        "classification": (
            normalize_nullable_text(raw_classifier.get("classification")) if isinstance(raw_classifier, dict) else None
        ) or classification_from_suggestion(suggestion),
        "confidence": normalize_confidence(
            raw_classifier.get("confidence") if isinstance(raw_classifier, dict) else suggestion.get("confidence_score")
        ),
        "summary": (
            normalize_nullable_text(raw_classifier.get("summary")) if isinstance(raw_classifier, dict) else None
        ) or normalize_nullable_text(suggestion.get("reasoning_summary")) or normalize_nullable_text(suggestion.get("summary_suggestion")),
        "reasoning_notes": (
            normalize_string_list(raw_classifier.get("reasoning_notes")) if isinstance(raw_classifier, dict) else []
        ) or normalize_string_list(suggestion.get("hesitation_reasons")),
        "missing_information": (
            normalize_string_list(raw_classifier.get("missing_information")) if isinstance(raw_classifier, dict) else []
        ) or normalize_string_list(suggestion.get("evidence_needed_to_reduce_risk")),
        "source_quality": source_quality if source_quality in {"high", "medium", "low"} else "low",
        "source_issues": (
            normalize_string_list(raw_classifier.get("source_issues")) if isinstance(raw_classifier, dict) else []
        )
        or sorted(
            set(
                normalize_string_list(suggestion.get("source_warnings"))
                + normalize_string_list(suggestion.get("missing_source_warnings"))
            )
        ),
        "flags": {
            "ambiguous_subject": bool(flags.get("ambiguous_subject")) if flags else False,
            "conflicting_sources": bool(flags.get("conflicting_sources")) if flags else False,
            "weak_evidence": bool(flags.get("weak_evidence")) if flags else False,
            "date_uncertain": bool(flags.get("date_uncertain")) if flags else False,
        }
        if flags
        else flags_from_suggestion(item, suggestion, source_quality),
        "classifier_fields_source": "batch_output" if raw_classifier else "canonical_review",
    }


def validation_problems_for(item_id: str, validation_payload: dict[str, Any] | None) -> dict[str, Any]:
    per_item = validation_payload.get("per_item_validation") if isinstance(validation_payload, dict) else {}
    validation = per_item.get(item_id) if isinstance(per_item, dict) else None
    if not isinstance(validation, dict):
        return {
            "valid": True,
            "malformed": False,
            "enum_errors": [],
            "missing_field_errors": [],
            "notes": [],
        }
    return {
        "valid": bool(validation.get("valid")),
        "malformed": bool(validation.get("malformed")),
        "enum_errors": normalize_string_list(validation.get("enum_errors")),
        "missing_field_errors": normalize_string_list(validation.get("missing_field_errors")),
        "notes": normalize_string_list(validation.get("notes")),
    }


def reason_labels_for(context: dict[str, Any], validation: dict[str, Any], item: dict[str, Any]) -> list[str]:
    labels: list[str] = []
    if validation.get("malformed") or validation.get("enum_errors") or validation.get("missing_field_errors"):
        labels.append("schema/validation issue")
    flags = context["flags"]
    if flags.get("conflicting_sources") or item.get("has_material_conflict"):
        labels.append("conflicting sources")
    suggestion = item.get("suggestions") if isinstance(item.get("suggestions"), dict) else {}
    if safe_auto_resolution_from_suggestion(suggestion) and not labels:
        return []
    if flags.get("weak_evidence") or context.get("source_quality") == "low" or context.get("source_issues") or context.get("missing_information"):
        labels.append("weak evidence")
    if context.get("classification") == "unclear":
        labels.append("unclear classification")
    if float(context.get("confidence") or 0.0) < 0.75:
        labels.append("low confidence")
    if context.get("recommended_action") == "needs_manual_review" or suggestion.get("record_action_suggestion") == "manual_review":
        labels.append("manual review requested by model")
    if flags.get("ambiguous_subject") and "ambiguous subject" not in labels:
        labels.append("ambiguous subject")
    if flags.get("date_uncertain"):
        labels.append("date uncertain")
    return sorted(set(labels), key=lambda label: REASON_PRIORITY.get(label, 99))


def primary_reason_label(reason_labels: list[str]) -> str:
    return reason_labels[0] if reason_labels else "manual review requested by model"


def operator_hint_for(reason_label: str) -> str:
    return {
        "schema/validation issue": "validation issue; regenerate or inspect artifact",
        "conflicting sources": "review conflicting sources",
        "weak evidence": "missing information; do not finalize yet",
        "unclear classification": "inspect evidence before finalize",
        "low confidence": "low confidence; verify source grounding",
        "manual review requested by model": "AI requested manual review",
        "ambiguous subject": "confirm the subject before finalize",
        "date uncertain": "verify date and timeline before finalize",
    }.get(reason_label, "inspect evidence before finalize")


def decision_checklist_for(reason_labels: list[str], flags: dict[str, bool], validation: dict[str, Any], missing_information: list[str]) -> list[str]:
    checklist: list[str] = []
    if "schema/validation issue" in reason_labels or validation.get("malformed"):
        checklist.append("repair malformed output before decision")
    if "conflicting sources" in reason_labels or flags.get("conflicting_sources"):
        checklist.append("review conflicting sources")
    if "weak evidence" in reason_labels or missing_information:
        checklist.append("verify source grounding")
    if "unclear classification" in reason_labels:
        checklist.append("confirm whether evidence supports any non-unclear classification")
    if "low confidence" in reason_labels:
        checklist.append("verify source grounding")
    if "manual review requested by model" in reason_labels:
        checklist.append("confirm implementation status")
        checklist.append("confirm whether impact is direct or too indirect")
    if "ambiguous subject" in reason_labels or flags.get("ambiguous_subject"):
        checklist.append("confirm subject identity/scope")
    if "date uncertain" in reason_labels or flags.get("date_uncertain"):
        checklist.append("inspect dates and implementation timing")
    for note in validation.get("missing_field_errors") or []:
        if note and "repair malformed output before decision" not in checklist:
            checklist.append("repair malformed output before decision")
    return list(dict.fromkeys(checklist))


def decision_readiness_label_for(
    *,
    reason_labels: list[str],
    blocked_by_malformed_output: bool,
    summary: str | None,
    missing_information: list[str],
    source_issues: list[str],
) -> str:
    if blocked_by_malformed_output or "schema/validation issue" in reason_labels:
        return "needs artifact repair"
    if {"conflicting sources", "weak evidence", "date uncertain"} & set(reason_labels):
        return "needs evidence verification"
    if {"unclear classification", "low confidence", "manual review requested by model", "ambiguous subject"} & set(reason_labels):
        return "needs operator judgment"
    if summary and not missing_information and not source_issues:
        return "ready for operator decision"
    return "needs operator judgment"


def decision_support_summary_for(
    *,
    reason_label: str,
    readiness_label: str,
    classification: str,
    confidence: float,
    summary: str | None,
    checklist: list[str],
) -> str:
    summary_text = summary or "No model summary was attached."
    checklist_text = checklist[0] if checklist else "inspect evidence before deciding"
    return (
        f"{readiness_label}: primary issue is {reason_label}; "
        f"classification={classification}, confidence={confidence:.2f}. "
        f"Next check: {checklist_text}. Context: {summary_text}"
    )


def reason_filter_matches(reason_labels: list[str], reason_filter: str | None) -> bool:
    if not reason_filter:
        return True
    mapping = {
        "schema": "schema/validation issue",
        "conflicting-sources": "conflicting sources",
        "weak-evidence": "weak evidence",
        "unclear": "unclear classification",
        "low-confidence": "low confidence",
        "manual-review-requested": "manual review requested by model",
        "ambiguous-subject": "ambiguous subject",
        "date-uncertain": "date uncertain",
    }
    return mapping[reason_filter] in reason_labels


def derive_decision_template_path(review_path: Path) -> Path:
    return review_path.with_name(review_path.name.replace(".ai-review.json", ".decision-template.json"))


def load_operator_actions(review_path: Path) -> dict[str, dict[str, Any]]:
    actions: dict[str, dict[str, Any]] = {}
    template_path = derive_decision_template_path(review_path)
    for source, payload in (("decision_template", load_optional_json(template_path)),):
        if not payload:
            continue
        for item in payload.get("items") or []:
            slug = normalize_nullable_text(item.get("slug"))
            action = normalize_nullable_text(item.get("operator_action"))
            if slug and action:
                actions[slug] = {"operator_action": action, "decision_source": source, "decision_artifact_path": str(template_path)}

    decisions_dir = get_current_admin_reports_dir() / "review_decisions"
    if decisions_dir.exists():
        logs = sorted(decisions_dir.glob("*.json"), key=lambda path: path.stat().st_mtime)
        expected = str(review_path.resolve())
        for log_path in logs:
            payload = load_optional_json(log_path)
            source_review_file = normalize_nullable_text(payload.get("source_review_file")) if payload else None
            if source_review_file not in {expected, str(review_path), review_path.name}:
                continue
            for item in payload.get("items") or []:
                slug = normalize_nullable_text(item.get("slug"))
                action = normalize_nullable_text(item.get("operator_action"))
                if slug and action:
                    actions[slug] = {"operator_action": action, "decision_source": "decision_log", "decision_artifact_path": str(log_path)}
    return actions


def build_manual_review_items(review_path: Path) -> list[dict[str, Any]]:
    report = load_json_file(review_path)
    batch_name = report.get("batch_name") or review_path.name.removesuffix(".ai-review.json")
    validation_payload = load_optional_json(validation_path_for_review(review_path))
    raw_classifier_by_item_id = load_raw_classifier_by_item_id(review_path)
    operator_actions = load_operator_actions(review_path)
    items: list[dict[str, Any]] = []

    for index, item in enumerate(report.get("items") or [], start=1):
        item_id = normalize_nullable_text(item.get("slug")) or f"item-{index}"
        context = normalize_classifier_context(item, raw_classifier_by_item_id.get(item_id))
        validation = validation_problems_for(item_id, validation_payload)
        reason_labels = reason_labels_for(context, validation, item)
        if not reason_labels:
            continue
        reason_label = primary_reason_label(reason_labels)
        action = operator_actions.get(item_id, {})
        unresolved = not bool(action.get("operator_action"))
        blocked_by_malformed_output = reason_label == "schema/validation issue"
        decision_checklist = decision_checklist_for(
            reason_labels,
            context["flags"],
            validation,
            context["missing_information"],
        )
        decision_readiness_label = decision_readiness_label_for(
            reason_labels=reason_labels,
            blocked_by_malformed_output=blocked_by_malformed_output,
            summary=context["summary"],
            missing_information=context["missing_information"],
            source_issues=context["source_issues"],
        )
        decision_support_summary = decision_support_summary_for(
            reason_label=reason_label,
            readiness_label=decision_readiness_label,
            classification=context["classification"],
            confidence=context["confidence"],
            summary=context["summary"],
            checklist=decision_checklist,
        )
        items.append(
            {
                "item_id": item_id,
                "batch_name": batch_name,
                "source_artifact_name": review_path.name,
                "source_artifact_path": str(review_path),
                "review_artifact_path": str(review_path),
                "entity_type": context["entity_type"],
                "entity_id": context["entity_id"] or item_id,
                "title": item.get("title"),
                "recommended_action": context["recommended_action"],
                "classification": context["classification"],
                "confidence": context["confidence"],
                "confidence_bucket": confidence_bucket(context["confidence"]),
                "summary": context["summary"],
                "reasoning_notes": context["reasoning_notes"],
                "missing_information": context["missing_information"],
                "source_quality": context["source_quality"],
                "source_issues": context["source_issues"],
                "flags": context["flags"],
                "validation_problems": validation,
                "blocked_by_malformed_output": blocked_by_malformed_output,
                "needs_human_judgment": not blocked_by_malformed_output,
                "reason_label": reason_label,
                "reason_labels": reason_labels,
                "priority_rank": REASON_PRIORITY.get(reason_label, 99),
                "operator_hint": operator_hint_for(reason_label),
                "decision_readiness_label": decision_readiness_label,
                "decision_checklist": decision_checklist,
                "primary_decision_check": decision_checklist[0] if decision_checklist else None,
                "decision_support_summary": decision_support_summary,
                "unresolved": unresolved,
                "operator_action": action.get("operator_action"),
                "decision_source": action.get("decision_source"),
                "decision_artifact_path": action.get("decision_artifact_path"),
                "classifier_fields_source": context["classifier_fields_source"],
            }
        )

    return sorted(items, key=lambda entry: (entry["priority_rank"], entry["confidence"], entry["item_id"]))


def matches_filters(item: dict[str, Any], args: argparse.Namespace) -> bool:
    if args.batch_name and item["batch_name"] != args.batch_name:
        return False
    if not reason_filter_matches(item.get("reason_labels") or [], args.reason):
        return False
    if args.confidence_bucket and item.get("confidence_bucket") != args.confidence_bucket:
        return False
    if args.unresolved_only and not item.get("unresolved"):
        return False
    if args.readiness and item.get("decision_readiness_label") != READINESS_LABEL_TEXT[args.readiness]:
        return False
    if args.schema_blocked_only and not item.get("blocked_by_malformed_output"):
        return False
    if args.judgment_required_only and not item.get("needs_human_judgment"):
        return False
    return True


def counter(items: list[dict[str, Any]], key: str) -> dict[str, int]:
    return dict(sorted(Counter(item.get(key) or "unknown" for item in items).items()))


def reason_counter(items: list[dict[str, Any]]) -> dict[str, int]:
    counts: Counter[str] = Counter()
    for item in items:
        for reason in item.get("reason_labels") or []:
            counts[reason] += 1
    return dict(sorted(counts.items(), key=lambda entry: (REASON_PRIORITY.get(entry[0], 99), entry[0])))


def main() -> None:
    args = parse_args()
    all_items: list[dict[str, Any]] = []
    for review_path in review_artifact_paths():
        all_items.extend(build_manual_review_items(review_path.resolve()))
    filtered_items = [item for item in all_items if matches_filters(item, args)]

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "artifact_version": ARTIFACT_VERSION,
        "filters": {
            "batch_name": args.batch_name or None,
            "reason": args.reason or None,
            "confidence_bucket": args.confidence_bucket or None,
            "unresolved_only": bool(args.unresolved_only),
            "readiness": READINESS_LABEL_TEXT.get(args.readiness) if args.readiness else None,
            "schema_blocked_only": bool(args.schema_blocked_only),
            "judgment_required_only": bool(args.judgment_required_only),
        },
        "counts": {
            "total": len(filtered_items),
            "unresolved": sum(1 for item in filtered_items if item.get("unresolved")),
            "schema_blocked": sum(1 for item in filtered_items if item.get("blocked_by_malformed_output")),
            "human_judgment": sum(1 for item in filtered_items if item.get("needs_human_judgment")),
            "by_reason": reason_counter(filtered_items),
            "by_batch": counter(filtered_items, "batch_name"),
            "by_confidence_bucket": counter(filtered_items, "confidence_bucket"),
            "by_readiness": counter(filtered_items, "decision_readiness_label"),
        },
        "items": filtered_items,
    }
    print(json.dumps(payload, indent=2 if args.pretty else None))


if __name__ == "__main__":
    try:
        main()
    except (FileNotFoundError, ValueError) as exc:
        raise SystemExit(str(exc)) from exc
