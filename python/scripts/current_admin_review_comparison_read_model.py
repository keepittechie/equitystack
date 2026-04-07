#!/usr/bin/env python3
import argparse
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean, median
from typing import Any

from current_admin_evidence_pack import evidence_pack_path_for_review
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
CLASSIFICATIONS = ("positive", "negative", "mixed", "blocked", "unclear")
RECOMMENDED_ACTIONS = ("approve", "reject", "needs_manual_review")
CONFIDENCE_BUCKETS = ("0.00-0.59", "0.60-0.74", "0.75-0.84", "0.85+")
SOURCE_QUALITIES = ("high", "medium", "low")
BASELINE_MARKERS = (".baseline.", ".legacy.", ".thin.", ".pre-evidence-pack.")
ENRICHED_MARKERS = (".enriched.", ".evidence-pack.", ".post-evidence-pack.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Compare current-admin baseline and evidence-pack-enriched review runs."
    )
    parser.add_argument("--baseline", type=Path, help="Baseline/thinner .ai-review.json artifact.")
    parser.add_argument("--enriched", type=Path, help="Enriched/evidence-pack .ai-review.json artifact.")
    parser.add_argument("--batch-name", help="Infer a clearly named baseline/enriched pair for this batch.")
    parser.add_argument("--include-item-deltas", action="store_true")
    parser.add_argument("--pretty", action="store_true")
    return parser.parse_args()


def ratio(part: int | float, total: int | float) -> float:
    if not total:
        return 0.0
    return round(float(part) / float(total), 4)


def sorted_counter(counter: Counter[str]) -> dict[str, int]:
    return dict(sorted(counter.items()))


def confidence_distribution(scores: list[float]) -> dict[str, float | None]:
    if not scores:
        return {"min": None, "max": None, "average": None, "median": None}
    return {
        "min": round(min(scores), 4),
        "max": round(max(scores), 4),
        "average": round(mean(scores), 4),
        "median": round(median(scores), 4),
    }


def validation_summary_for(review_path: Path) -> dict[str, Any]:
    payload = load_optional_json(validation_path_for_review(review_path))
    if not payload:
        return {
            "present": False,
            "total_items": None,
            "valid_items": None,
            "malformed_items": None,
            "enum_errors": None,
            "missing_field_errors": None,
        }
    return {
        "present": True,
        "total_items": int(payload.get("total_items") or 0),
        "valid_items": int(payload.get("valid_items") or 0),
        "malformed_items": int(payload.get("malformed_items") or 0),
        "enum_errors": int(payload.get("enum_errors") or 0),
        "missing_field_errors": int(payload.get("missing_field_errors") or 0),
    }


def evidence_pack_summary_for(review_path: Path) -> dict[str, Any]:
    path = evidence_pack_path_for_review(review_path)
    payload = load_optional_json(path)
    if not payload:
        return {
            "present": False,
            "artifact_path": str(path),
            "packing_version": None,
            "summary": {},
        }
    return {
        "present": True,
        "artifact_path": str(path),
        "packing_version": payload.get("packing_version"),
        "summary": payload.get("summary") or {},
    }


def item_contexts_for(review_path: Path) -> dict[str, dict[str, Any]]:
    report = load_json_file(review_path)
    raw_by_item_id = load_raw_classifier_by_item_id(review_path)
    manual_items = build_manual_review_items(review_path)
    manual_by_id = {item["item_id"]: item for item in manual_items}
    contexts: dict[str, dict[str, Any]] = {}
    for index, item in enumerate(report.get("items") or [], start=1):
        item_id = item.get("slug") or f"item-{index}"
        classifier = normalize_classifier_context(item, raw_by_item_id.get(item_id))
        manual_item = manual_by_id.get(item_id)
        contexts[item_id] = {
            "item_id": item_id,
            "title": item.get("title"),
            "classification": classifier.get("classification") or "unclear",
            "recommended_action": classifier.get("recommended_action") or "needs_manual_review",
            "confidence": float(classifier.get("confidence") or 0.0),
            "confidence_bucket": confidence_bucket(float(classifier.get("confidence") or 0.0)),
            "source_quality": classifier.get("source_quality") or "low",
            "flags": classifier.get("flags") or {},
            "reason_labels": manual_item.get("reason_labels") if manual_item else [],
            "decision_readiness_label": manual_item.get("decision_readiness_label") if manual_item else "ready for operator decision",
            "operator_hint": manual_item.get("operator_hint") if manual_item else "ready for operator decision",
            "manual_review": bool(manual_item),
            "finalize_safe": not bool(manual_item),
            "apply_safe": not bool(manual_item),
        }
    return contexts


def run_summary(review_path: Path, contexts: dict[str, dict[str, Any]]) -> dict[str, Any]:
    report = load_json_file(review_path)
    scores = [item["confidence"] for item in contexts.values()]
    classification_counts = Counter(item["classification"] for item in contexts.values())
    action_counts = Counter(item["recommended_action"] for item in contexts.values())
    bucket_counts = Counter(item["confidence_bucket"] for item in contexts.values())
    source_counts = Counter(item["source_quality"] for item in contexts.values())
    reason_counts = Counter(reason for item in contexts.values() for reason in item.get("reason_labels") or [])
    readiness_counts = Counter(item.get("decision_readiness_label") or "unknown" for item in contexts.values() if item.get("manual_review"))
    return {
        "artifact_path": str(review_path),
        "batch_name": report.get("batch_name") or review_path.name.removesuffix(".ai-review.json"),
        "model": report.get("model") or report.get("requested_model"),
        "review_backend": report.get("review_backend"),
        "reviewed_count": int(report.get("reviewed_count") or len(report.get("items") or [])),
        "matched_context_count": len(contexts),
        "manual_review_count": sum(1 for item in contexts.values() if item.get("manual_review")),
        "finalize_safe_count": sum(1 for item in contexts.values() if item.get("finalize_safe")),
        "apply_safe_count": sum(1 for item in contexts.values() if item.get("apply_safe")),
        "weak_evidence_count": sum(1 for item in contexts.values() if "weak evidence" in (item.get("reason_labels") or [])),
        "low_confidence_count": sum(1 for item in contexts.values() if "low confidence" in (item.get("reason_labels") or [])),
        "unclear_count": sum(1 for item in contexts.values() if item.get("classification") == "unclear"),
        "confidence_distribution": confidence_distribution(scores),
        "confidence_bucket_counts": {bucket: int(bucket_counts.get(bucket, 0)) for bucket in CONFIDENCE_BUCKETS},
        "classification_counts": {key: int(classification_counts.get(key, 0)) for key in CLASSIFICATIONS},
        "recommended_action_counts": {key: int(action_counts.get(key, 0)) for key in RECOMMENDED_ACTIONS},
        "source_quality_counts": {key: int(source_counts.get(key, 0)) for key in SOURCE_QUALITIES},
        "reason_label_counts": sorted_counter(reason_counts),
        "decision_readiness_label_counts": sorted_counter(readiness_counts),
        "validation": validation_summary_for(review_path),
        "evidence_pack": evidence_pack_summary_for(review_path),
    }


def movement_key(before: str, after: str) -> str:
    return f"{before} -> {after}"


def comparison_note(baseline: dict[str, Any], enriched: dict[str, Any]) -> str:
    confidence_delta = enriched["confidence"] - baseline["confidence"]
    baseline_reasons = set(baseline.get("reason_labels") or [])
    enriched_reasons = set(enriched.get("reason_labels") or [])
    if baseline.get("manual_review") and not enriched.get("manual_review") and confidence_delta > 0:
        return "confidence improved and manual review cleared"
    if confidence_delta > 0 and "weak evidence" in enriched_reasons:
        return "confidence improved but weak evidence still blocks"
    if "low confidence" in baseline_reasons and "low confidence" not in enriched_reasons and enriched.get("manual_review"):
        return "reason shifted from low confidence to needs operator judgment"
    if enriched.get("manual_review") and any(reason in enriched_reasons for reason in {"weak evidence", "manual review requested by model"}):
        return "manual review remained because evidence or impact path still needs operator judgment"
    if baseline.get("classification") == enriched.get("classification") and baseline.get("manual_review") == enriched.get("manual_review"):
        return "classification unchanged; evidence-pack had no practical effect"
    if baseline.get("recommended_action") != enriched.get("recommended_action"):
        return "recommended action changed under enriched review"
    return "review outcome changed without a dominant rule-based pattern"


def build_item_delta(item_id: str, baseline: dict[str, Any], enriched: dict[str, Any]) -> dict[str, Any]:
    baseline_reasons = set(baseline.get("reason_labels") or [])
    enriched_reasons = set(enriched.get("reason_labels") or [])
    return {
        "item_id": item_id,
        "title": enriched.get("title") or baseline.get("title"),
        "baseline_classification": baseline.get("classification"),
        "enriched_classification": enriched.get("classification"),
        "baseline_confidence": baseline.get("confidence"),
        "enriched_confidence": enriched.get("confidence"),
        "confidence_delta": round(float(enriched.get("confidence") or 0.0) - float(baseline.get("confidence") or 0.0), 4),
        "baseline_confidence_bucket": baseline.get("confidence_bucket"),
        "enriched_confidence_bucket": enriched.get("confidence_bucket"),
        "baseline_recommended_action": baseline.get("recommended_action"),
        "enriched_recommended_action": enriched.get("recommended_action"),
        "baseline_reason_labels": baseline.get("reason_labels") or [],
        "enriched_reason_labels": enriched.get("reason_labels") or [],
        "baseline_decision_readiness_label": baseline.get("decision_readiness_label"),
        "enriched_decision_readiness_label": enriched.get("decision_readiness_label"),
        "manual_review_reduced": bool(baseline.get("manual_review") and not enriched.get("manual_review")),
        "finalize_safety_improved": bool(not baseline.get("finalize_safe") and enriched.get("finalize_safe")),
        "evidence_related_blockers_reduced": bool(
            ("weak evidence" in baseline_reasons or "conflicting sources" in baseline_reasons)
            and not ({"weak evidence", "conflicting sources"} & enriched_reasons)
        ),
        "comparison_note": comparison_note(baseline, enriched),
    }


def aggregate_deltas(item_deltas: list[dict[str, Any]], baseline_summary: dict[str, Any], enriched_summary: dict[str, Any]) -> dict[str, Any]:
    confidence_deltas = [float(item["confidence_delta"]) for item in item_deltas]
    bucket_movements = Counter(movement_key(item["baseline_confidence_bucket"], item["enriched_confidence_bucket"]) for item in item_deltas)
    classification_changes = Counter(
        movement_key(item["baseline_classification"], item["enriched_classification"])
        for item in item_deltas
        if item["baseline_classification"] != item["enriched_classification"]
    )
    action_changes = Counter(
        movement_key(item["baseline_recommended_action"], item["enriched_recommended_action"])
        for item in item_deltas
        if item["baseline_recommended_action"] != item["enriched_recommended_action"]
    )
    return {
        "confidence_average_delta": round(mean(confidence_deltas), 4) if confidence_deltas else 0.0,
        "confidence_median_delta": round(median(confidence_deltas), 4) if confidence_deltas else 0.0,
        "confidence_bucket_movement_counts": sorted_counter(bucket_movements),
        "classification_change_counts": sorted_counter(classification_changes),
        "recommended_action_change_counts": sorted_counter(action_changes),
        "manual_review_count_before": baseline_summary["manual_review_count"],
        "manual_review_count_after": enriched_summary["manual_review_count"],
        "manual_review_delta": enriched_summary["manual_review_count"] - baseline_summary["manual_review_count"],
        "finalize_safe_count_before": baseline_summary["finalize_safe_count"],
        "finalize_safe_count_after": enriched_summary["finalize_safe_count"],
        "finalize_safe_delta": enriched_summary["finalize_safe_count"] - baseline_summary["finalize_safe_count"],
        "apply_safe_count_before": baseline_summary["apply_safe_count"],
        "apply_safe_count_after": enriched_summary["apply_safe_count"],
        "apply_safe_delta": enriched_summary["apply_safe_count"] - baseline_summary["apply_safe_count"],
        "weak_evidence_count_before": baseline_summary["weak_evidence_count"],
        "weak_evidence_count_after": enriched_summary["weak_evidence_count"],
        "weak_evidence_delta": enriched_summary["weak_evidence_count"] - baseline_summary["weak_evidence_count"],
        "low_confidence_count_before": baseline_summary["low_confidence_count"],
        "low_confidence_count_after": enriched_summary["low_confidence_count"],
        "low_confidence_delta": enriched_summary["low_confidence_count"] - baseline_summary["low_confidence_count"],
        "unclear_count_before": baseline_summary["unclear_count"],
        "unclear_count_after": enriched_summary["unclear_count"],
        "unclear_delta": enriched_summary["unclear_count"] - baseline_summary["unclear_count"],
        "decision_readiness_label_counts_before": baseline_summary["decision_readiness_label_counts"],
        "decision_readiness_label_counts_after": enriched_summary["decision_readiness_label_counts"],
        "source_quality_counts_before": baseline_summary["source_quality_counts"],
        "source_quality_counts_after": enriched_summary["source_quality_counts"],
        "manual_review_reduced_items": sum(1 for item in item_deltas if item["manual_review_reduced"]),
        "finalize_safety_improved_items": sum(1 for item in item_deltas if item["finalize_safety_improved"]),
        "evidence_related_blockers_reduced_items": sum(1 for item in item_deltas if item["evidence_related_blockers_reduced"]),
    }


def rule_based_interpretations(aggregate: dict[str, Any], matched_count: int) -> list[str]:
    interpretations: list[str] = []
    manual_reduction = -int(aggregate.get("manual_review_delta") or 0)
    weak_reduction = -int(aggregate.get("weak_evidence_delta") or 0)
    confidence_delta = float(aggregate.get("confidence_average_delta") or 0.0)
    if ratio(manual_reduction, matched_count) >= 0.25:
        interpretations.append("evidence-pack materially reduced manual review volume")
    if confidence_delta > 0 and int(aggregate.get("weak_evidence_count_after") or 0) >= int(aggregate.get("manual_review_count_after") or 0) / 2:
        interpretations.append("confidence improved but evidence blockers still dominate")
    if not aggregate.get("classification_change_counts") and confidence_delta > 0:
        interpretations.append("classification stability remained high while confidence improved")
    if confidence_delta <= 0 and manual_reduction <= 0:
        interpretations.append("evidence-pack had limited effect on review outcomes")
    if weak_reduction > 0 and int(aggregate.get("manual_review_count_after") or 0) > 0:
        interpretations.append("evidence-pack improved source grounding, but not enough to clear conservative guardrails")
    if int(aggregate.get("weak_evidence_count_after") or 0) > 0 and int(aggregate.get("low_confidence_count_after") or 0) > 0:
        interpretations.append("evidence-pack had limited effect because indirect-impact items still lack measurable outcomes")
    return interpretations or ["comparison did not show a dominant rule-based quality change"]


def advisory_recommendations(aggregate: dict[str, Any], matched_count: int) -> list[str]:
    recommendations: list[str] = []
    manual_reduction = -int(aggregate.get("manual_review_delta") or 0)
    weak_after = int(aggregate.get("weak_evidence_count_after") or 0)
    confidence_delta = float(aggregate.get("confidence_average_delta") or 0.0)
    if manual_reduction > 0 or confidence_delta > 0:
        recommendations.append("run another enriched batch before considering threshold changes")
    if weak_after > 0:
        recommendations.append("prioritize stronger outcome evidence for indirect-impact items")
        recommendations.append("do not loosen thresholds yet; evidence-pack helped but weak evidence remains dominant")
    if confidence_delta > 0 and weak_after == 0 and manual_reduction > 0:
        recommendations.append("consider modest threshold testing only for items improved by confidence without flag blockers")
    if int(aggregate.get("manual_review_count_after") or 0) > 0:
        recommendations.append("focus future packaging on implementation and measurable outcome summaries")
    if matched_count == 0:
        recommendations.append("provide explicit baseline and enriched review artifacts with overlapping item ids")
    return list(dict.fromkeys(recommendations or ["keep comparison as advisory and collect another enriched run"]))


def infer_comparison_paths(batch_name: str | None) -> tuple[Path | None, Path | None, str]:
    if not batch_name:
        return None, None, "no batch name supplied for inference"
    candidates = [path for path in review_artifact_paths() if batch_name in path.name]
    baseline = next((path for path in candidates if any(marker in path.name for marker in BASELINE_MARKERS)), None)
    enriched = next((path for path in candidates if any(marker in path.name for marker in ENRICHED_MARKERS)), None)
    if baseline and enriched:
        return baseline, enriched, "inferred from baseline/enriched filename markers"
    return None, None, "no clearly named baseline/enriched artifact pair was found"


def build_no_context_payload(args: argparse.Namespace, reason: str) -> dict[str, Any]:
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "artifact_version": ARTIFACT_VERSION,
        "comparison_available": False,
        "status": "no-comparison-context",
        "reason": reason,
        "filters": {
            "batch_name": args.batch_name or None,
            "baseline": str(args.baseline) if args.baseline else None,
            "enriched": str(args.enriched) if args.enriched else None,
            "include_item_deltas": bool(args.include_item_deltas),
        },
        "comparison": None,
    }


def build_comparison_payload(
    *,
    baseline_path: Path,
    enriched_path: Path,
    args: argparse.Namespace,
    identification_mode: str,
) -> dict[str, Any]:
    baseline_path = baseline_path.resolve()
    enriched_path = enriched_path.resolve()
    baseline_contexts = item_contexts_for(baseline_path)
    enriched_contexts = item_contexts_for(enriched_path)
    matched_ids = sorted(set(baseline_contexts) & set(enriched_contexts))
    unmatched_ids = sorted(set(baseline_contexts) ^ set(enriched_contexts))
    baseline_matched = {item_id: baseline_contexts[item_id] for item_id in matched_ids}
    enriched_matched = {item_id: enriched_contexts[item_id] for item_id in matched_ids}
    baseline_summary = run_summary(baseline_path, baseline_matched)
    enriched_summary = run_summary(enriched_path, enriched_matched)
    item_deltas = [
        build_item_delta(item_id, baseline_matched[item_id], enriched_matched[item_id])
        for item_id in matched_ids
    ]
    aggregate = aggregate_deltas(item_deltas, baseline_summary, enriched_summary)
    baseline_report = load_json_file(baseline_path)
    enriched_report = load_json_file(enriched_path)
    compared_batch_name = args.batch_name or enriched_summary["batch_name"] or baseline_summary["batch_name"]
    comparison = {
        "compared_batch_name": compared_batch_name,
        "identification_mode": identification_mode,
        "baseline": baseline_summary,
        "enriched": enriched_summary,
        "matched_item_count": len(matched_ids),
        "unmatched_item_count": len(unmatched_ids),
        "unmatched_item_ids": unmatched_ids,
        "review_completion_summary": {
            "baseline_reviewed_count": int(baseline_report.get("reviewed_count") or len(baseline_report.get("items") or [])),
            "enriched_reviewed_count": int(enriched_report.get("reviewed_count") or len(enriched_report.get("items") or [])),
            "matched_item_count": len(matched_ids),
        },
        "structural_validation_summary": {
            "baseline": baseline_summary["validation"],
            "enriched": enriched_summary["validation"],
        },
        "aggregate_deltas": aggregate,
        "item_deltas": item_deltas if args.include_item_deltas else [],
        "rule_based_interpretations": rule_based_interpretations(aggregate, len(matched_ids)),
        "advisory_recommendations": advisory_recommendations(aggregate, len(matched_ids)),
    }
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "artifact_version": ARTIFACT_VERSION,
        "comparison_available": True,
        "status": "comparison-ready",
        "filters": {
            "batch_name": args.batch_name or None,
            "baseline": str(baseline_path),
            "enriched": str(enriched_path),
            "include_item_deltas": bool(args.include_item_deltas),
        },
        "comparison": comparison,
    }


def main() -> None:
    args = parse_args()
    if bool(args.baseline) != bool(args.enriched):
        raise SystemExit("--baseline and --enriched must be provided together.")
    if args.baseline and args.enriched:
        payload = build_comparison_payload(
            baseline_path=args.baseline,
            enriched_path=args.enriched,
            args=args,
            identification_mode="explicit artifact paths",
        )
    else:
        baseline, enriched, reason = infer_comparison_paths(args.batch_name)
        if not baseline or not enriched:
            payload = build_no_context_payload(args, reason)
        else:
            payload = build_comparison_payload(
                baseline_path=baseline,
                enriched_path=enriched,
                args=args,
                identification_mode=reason,
            )
    print(json.dumps(payload, indent=2 if args.pretty else None))


if __name__ == "__main__":
    try:
        main()
    except (FileNotFoundError, ValueError) as exc:
        raise SystemExit(str(exc)) from exc
