#!/usr/bin/env python3
import argparse
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean, median
from typing import Any

from current_admin_openai_batch_guardrails import validation_path_for_review
from current_admin_manual_review_read_model import (
    build_manual_review_items,
    confidence_bucket,
    load_json_file,
    load_optional_json,
    load_raw_classifier_by_item_id,
    normalize_classifier_context,
    review_artifact_paths,
)


ARTIFACT_VERSION = 1
VALID_QUALITY_FOCUS = {
    "all",
    "low-confidence-heavy",
    "weak-evidence-heavy",
    "unclear-heavy",
    "high-manual-review",
    "structurally-valid-but-decision-thin",
}
CLASSIFICATIONS = ("positive", "negative", "mixed", "blocked", "unclear")
RECOMMENDED_ACTIONS = ("approve", "reject", "needs_manual_review")
CONFIDENCE_BUCKETS = ("0.00-0.59", "0.60-0.74", "0.75-0.84", "0.85+")
SOURCE_QUALITIES = ("high", "medium", "low")
FLAG_KEYS = ("ambiguous_subject", "conflicting_sources", "weak_evidence", "date_uncertain")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build current-admin review calibration diagnostics from local review artifacts and Batch sidecars."
    )
    parser.add_argument("--batch-name", help="Limit output to one current-admin batch name.")
    parser.add_argument(
        "--quality-focus",
        choices=sorted(VALID_QUALITY_FOCUS),
        default="all",
        help="Limit output to batches matching one deterministic quality focus.",
    )
    parser.add_argument(
        "--manual-review-only",
        action="store_true",
        help="Compute item distributions over manual-review items only.",
    )
    parser.add_argument(
        "--unresolved-only",
        action="store_true",
        help="Compute item distributions over unresolved manual-review items only.",
    )
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON output.")
    return parser.parse_args()


def empty_counter(keys: tuple[str, ...]) -> dict[str, int]:
    return {key: 0 for key in keys}


def sorted_counter(counter: Counter[str]) -> dict[str, int]:
    return dict(sorted(counter.items()))


def ratio(part: int | float, total: int | float) -> float:
    if not total:
        return 0.0
    return round(float(part) / float(total), 4)


def validation_counts(validation_payload: dict[str, Any] | None) -> dict[str, int | None]:
    if not validation_payload:
        return {
            "valid_items": None,
            "malformed_items": None,
            "enum_errors": None,
            "missing_field_errors": None,
        }
    return {
        "valid_items": int(validation_payload.get("valid_items") or 0),
        "malformed_items": int(validation_payload.get("malformed_items") or 0),
        "enum_errors": int(validation_payload.get("enum_errors") or 0),
        "missing_field_errors": int(validation_payload.get("missing_field_errors") or 0),
    }


def confidence_distribution(scores: list[float]) -> dict[str, float | None]:
    if not scores:
        return {"min": None, "max": None, "average": None, "median": None}
    return {
        "min": round(min(scores), 4),
        "max": round(max(scores), 4),
        "average": round(mean(scores), 4),
        "median": round(median(scores), 4),
    }


def build_batch_item_contexts(review_path: Path, report: dict[str, Any]) -> list[dict[str, Any]]:
    raw_by_item_id = load_raw_classifier_by_item_id(review_path)
    contexts = []
    for index, item in enumerate(report.get("items") or [], start=1):
        item_id = item.get("slug") or f"item-{index}"
        context = normalize_classifier_context(item, raw_by_item_id.get(item_id))
        contexts.append(
            {
                "item_id": item_id,
                "classification": context.get("classification") or "unclear",
                "recommended_action": context.get("recommended_action") or "needs_manual_review",
                "confidence": float(context.get("confidence") or 0.0),
                "confidence_bucket": confidence_bucket(float(context.get("confidence") or 0.0)),
                "source_quality": context.get("source_quality") or "low",
                "flags": context.get("flags") or {},
            }
        )
    return contexts


def filter_contexts_for_focus(
    contexts: list[dict[str, Any]],
    manual_items: list[dict[str, Any]],
    *,
    manual_review_only: bool,
    unresolved_only: bool,
) -> list[dict[str, Any]]:
    if not manual_review_only and not unresolved_only:
        return contexts
    manual_ids = {
        item["item_id"]
        for item in manual_items
        if not unresolved_only or item.get("unresolved")
    }
    return [context for context in contexts if context["item_id"] in manual_ids]


def rule_based_interpretations(batch: dict[str, Any]) -> list[str]:
    signals = batch["tuning_signals"]
    validation = batch["validation"]
    interpretations: list[str] = []
    structural_valid = (
        validation.get("malformed_items") == 0
        and validation.get("enum_errors") == 0
        and validation.get("missing_field_errors") == 0
        and validation.get("valid_items") is not None
    )

    if signals["percent_manual_review"] >= 0.5 and signals["percent_low_confidence"] >= 0.5:
        interpretations.append("manual review volume is high because low confidence dominates")
    if signals["percent_manual_review"] >= 0.5 and signals["percent_weak_evidence"] >= 0.4:
        interpretations.append("manual review volume is high because weak evidence dominates")
    if signals["percent_mixed_or_unclear"] >= 0.6:
        interpretations.append("classification spread is concentrated in mixed/unclear")
    if structural_valid and signals["percent_medium_or_low_source_quality"] >= 0.5:
        interpretations.append("outputs are structurally valid but evidence grounding is thin")
    if structural_valid and signals["percent_manual_review"] >= 0.5:
        interpretations.append("most items are safe structurally, but not decision-ready substantively")
    if not interpretations:
        interpretations.append("no dominant calibration issue was detected by the current thresholds")
    return interpretations


def rule_based_recommendations(batch: dict[str, Any]) -> list[str]:
    signals = batch["tuning_signals"]
    validation = batch["validation"]
    recommendations: list[str] = []
    structural_valid = (
        validation.get("malformed_items") == 0
        and validation.get("enum_errors") == 0
        and validation.get("missing_field_errors") == 0
        and validation.get("valid_items") is not None
    )

    if signals["percent_weak_evidence"] >= 0.4:
        recommendations.append("inspect prompt/source packaging because weak-evidence flags dominate")
        recommendations.append("add richer action-level evidence before changing thresholds")
    if signals["percent_low_confidence"] >= 0.5 and signals["percent_weak_evidence"] < 0.4:
        recommendations.append("review whether current confidence threshold is too strict for current-admin records")
    if signals["percent_medium_or_low_source_quality"] >= 0.5:
        recommendations.append("do not loosen thresholds yet; source grounding is still thin")
    if signals["percent_mixed_or_unclear"] >= 0.6:
        recommendations.append("consider separating implementation-status uncertainty from impact-direction uncertainty")
    if structural_valid and signals["percent_manual_review"] >= 0.5 and not recommendations:
        recommendations.append("review manual-review reasons before changing thresholds")
    if not recommendations:
        recommendations.append("keep current thresholds and continue collecting calibration data")
    return list(dict.fromkeys(recommendations))


def quality_focus_matches(batch: dict[str, Any], quality_focus: str) -> bool:
    if quality_focus == "all":
        return True
    signals = batch["tuning_signals"]
    validation = batch["validation"]
    structural_valid = (
        validation.get("malformed_items") == 0
        and validation.get("enum_errors") == 0
        and validation.get("missing_field_errors") == 0
        and validation.get("valid_items") is not None
    )
    if quality_focus == "low-confidence-heavy":
        return signals["percent_low_confidence"] >= 0.5
    if quality_focus == "weak-evidence-heavy":
        return signals["percent_weak_evidence"] >= 0.4
    if quality_focus == "unclear-heavy":
        return signals["percent_unclear"] >= 0.3
    if quality_focus == "high-manual-review":
        return signals["percent_manual_review"] >= 0.5
    if quality_focus == "structurally-valid-but-decision-thin":
        return structural_valid and signals["percent_manual_review"] >= 0.5 and (
            signals["percent_low_confidence"] >= 0.5
            or signals["percent_weak_evidence"] >= 0.3
            or signals["percent_medium_or_low_source_quality"] >= 0.5
        )
    return True


def build_batch_calibration(
    review_path: Path,
    *,
    manual_review_only: bool,
    unresolved_only: bool,
) -> dict[str, Any]:
    report = load_json_file(review_path)
    validation_payload = load_optional_json(validation_path_for_review(review_path))
    validation = validation_counts(validation_payload)
    manual_items = build_manual_review_items(review_path)
    all_contexts = build_batch_item_contexts(review_path, report)
    contexts = filter_contexts_for_focus(
        all_contexts,
        manual_items,
        manual_review_only=manual_review_only,
        unresolved_only=unresolved_only,
    )

    classification_counts = empty_counter(CLASSIFICATIONS)
    recommended_action_counts = empty_counter(RECOMMENDED_ACTIONS)
    confidence_bucket_counts = empty_counter(CONFIDENCE_BUCKETS)
    source_quality_counts = empty_counter(SOURCE_QUALITIES)
    flag_counts = empty_counter(FLAG_KEYS)
    scores: list[float] = []
    for context in contexts:
        classification = context["classification"] if context["classification"] in CLASSIFICATIONS else "unclear"
        recommended_action = (
            context["recommended_action"] if context["recommended_action"] in RECOMMENDED_ACTIONS else "needs_manual_review"
        )
        source_quality = context["source_quality"] if context["source_quality"] in SOURCE_QUALITIES else "low"
        classification_counts[classification] += 1
        recommended_action_counts[recommended_action] += 1
        confidence_bucket_counts[context["confidence_bucket"]] += 1
        source_quality_counts[source_quality] += 1
        scores.append(context["confidence"])
        for flag in FLAG_KEYS:
            if context["flags"].get(flag):
                flag_counts[flag] += 1

    reason_counts: Counter[str] = Counter()
    readiness_counts: Counter[str] = Counter()
    for item in manual_items:
        if manual_review_only or unresolved_only:
            if item["item_id"] not in {context["item_id"] for context in contexts}:
                continue
        for reason in item.get("reason_labels") or []:
            reason_counts[reason] += 1
        readiness_counts[item.get("decision_readiness_label") or "unknown"] += 1

    reviewed_count = len(contexts)
    manual_count = len([item for item in manual_items if any(context["item_id"] == item["item_id"] for context in contexts)])
    unresolved_manual_count = len(
        [
            item
            for item in manual_items
            if item.get("unresolved") and any(context["item_id"] == item["item_id"] for context in contexts)
        ]
    )
    schema_blocked_count = len(
        [
            item
            for item in manual_items
            if item.get("blocked_by_malformed_output") and any(context["item_id"] == item["item_id"] for context in contexts)
        ]
    )
    judgment_required_count = len(
        [
            item
            for item in manual_items
            if item.get("needs_human_judgment") and any(context["item_id"] == item["item_id"] for context in contexts)
        ]
    )
    batch = {
        "batch_name": report.get("batch_name") or review_path.name.removesuffix(".ai-review.json"),
        "review_artifact_path": str(review_path),
        "reviewed_item_count": reviewed_count,
        "original_reviewed_item_count": int(report.get("reviewed_count") or len(report.get("items") or [])),
        "validation": validation,
        "classification_counts": classification_counts,
        "recommended_action_counts": recommended_action_counts,
        "confidence_distribution": confidence_distribution(scores),
        "confidence_bucket_counts": confidence_bucket_counts,
        "manual_review_counts": {
            "total_manual_review_items": manual_count,
            "unresolved_manual_review_items": unresolved_manual_count,
            "schema_blocked_manual_review_items": schema_blocked_count,
            "judgment_required_manual_review_items": judgment_required_count,
        },
        "reason_label_counts": sorted_counter(reason_counts),
        "decision_readiness_label_counts": sorted_counter(readiness_counts),
        "source_quality_counts": source_quality_counts,
        "flag_counts": flag_counts,
    }
    batch["tuning_signals"] = {
        "percent_manual_review": ratio(manual_count, reviewed_count),
        "percent_low_confidence": ratio(confidence_bucket_counts["0.00-0.59"], reviewed_count),
        "percent_unclear": ratio(classification_counts["unclear"], reviewed_count),
        "percent_weak_evidence": ratio(flag_counts["weak_evidence"], reviewed_count),
        "percent_medium_or_low_source_quality": ratio(
            source_quality_counts["medium"] + source_quality_counts["low"],
            reviewed_count,
        ),
        "percent_validation_blocked": ratio(schema_blocked_count, manual_count),
        "percent_evidence_blocked": ratio(
            readiness_counts.get("needs evidence verification", 0),
            manual_count,
        ),
        "percent_judgment_required": ratio(judgment_required_count, manual_count),
        "percent_mixed_or_unclear": ratio(
            classification_counts["mixed"] + classification_counts["unclear"],
            reviewed_count,
        ),
    }
    batch["rule_based_interpretations"] = rule_based_interpretations(batch)
    batch["advisory_recommendations"] = rule_based_recommendations(batch)
    return batch


def aggregate_counts(batches: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "batches": len(batches),
        "reviewed_item_count": sum(batch["reviewed_item_count"] for batch in batches),
        "manual_review_items": sum(batch["manual_review_counts"]["total_manual_review_items"] for batch in batches),
        "unresolved_manual_review_items": sum(batch["manual_review_counts"]["unresolved_manual_review_items"] for batch in batches),
        "quality_focus_matches": len(batches),
    }


def main() -> None:
    args = parse_args()
    batches = []
    for review_path in review_artifact_paths():
        batch = build_batch_calibration(
            review_path.resolve(),
            manual_review_only=bool(args.manual_review_only),
            unresolved_only=bool(args.unresolved_only),
        )
        if args.batch_name and batch["batch_name"] != args.batch_name:
            continue
        if not quality_focus_matches(batch, args.quality_focus):
            continue
        batches.append(batch)

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "artifact_version": ARTIFACT_VERSION,
        "filters": {
            "batch_name": args.batch_name or None,
            "quality_focus": args.quality_focus,
            "manual_review_only": bool(args.manual_review_only),
            "unresolved_only": bool(args.unresolved_only),
        },
        "thresholds": {
            "low_confidence_heavy": "percent_low_confidence >= 0.50",
            "weak_evidence_heavy": "percent_weak_evidence >= 0.40",
            "unclear_heavy": "percent_unclear >= 0.30",
            "high_manual_review": "percent_manual_review >= 0.50",
            "structurally_valid_but_decision_thin": "structurally valid and percent_manual_review >= 0.50 with low-confidence, weak-evidence, or medium/low-source-quality dominance",
        },
        "counts": aggregate_counts(batches),
        "batches": batches,
    }
    print(json.dumps(payload, indent=2 if args.pretty else None))


if __name__ == "__main__":
    try:
        main()
    except (FileNotFoundError, ValueError) as exc:
        raise SystemExit(str(exc)) from exc
