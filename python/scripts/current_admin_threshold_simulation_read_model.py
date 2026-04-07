#!/usr/bin/env python3
import argparse
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from current_admin_calibration_read_model import ratio
from current_admin_manual_review_read_model import (
    build_manual_review_items,
    confidence_bucket,
    load_json_file,
    load_raw_classifier_by_item_id,
    normalize_classifier_context,
    review_artifact_paths,
)


ARTIFACT_VERSION = 1
LIVE_PROFILE_NAME = "strict-current"
PRESETS: dict[str, dict[str, Any]] = {
    "strict-current": {
        "confidence_auto_approve_threshold": 0.75,
        "confidence_manual_review_floor": 0.55,
        "allow_high_confidence_flagged_items_to_stay_blocked": True,
        "treat_unclear_as_always_manual_review": True,
        "treat_weak_evidence_as_always_manual_review": True,
        "treat_conflicting_sources_as_always_manual_review": True,
        "treat_date_uncertain_as_always_manual_review": True,
        "treat_ambiguous_subject_as_always_manual_review": True,
        "treat_model_manual_review_as_always_manual_review": True,
    },
    "slightly-relaxed": {
        "confidence_auto_approve_threshold": 0.65,
        "confidence_manual_review_floor": 0.50,
        "allow_high_confidence_flagged_items_to_stay_blocked": True,
        "treat_unclear_as_always_manual_review": True,
        "treat_weak_evidence_as_always_manual_review": True,
        "treat_conflicting_sources_as_always_manual_review": True,
        "treat_date_uncertain_as_always_manual_review": True,
        "treat_ambiguous_subject_as_always_manual_review": True,
        "treat_model_manual_review_as_always_manual_review": True,
    },
    "moderate-relaxed": {
        "confidence_auto_approve_threshold": 0.55,
        "confidence_manual_review_floor": 0.40,
        "allow_high_confidence_flagged_items_to_stay_blocked": True,
        "treat_unclear_as_always_manual_review": True,
        "treat_weak_evidence_as_always_manual_review": True,
        "treat_conflicting_sources_as_always_manual_review": True,
        "treat_date_uncertain_as_always_manual_review": False,
        "treat_ambiguous_subject_as_always_manual_review": False,
        "treat_model_manual_review_as_always_manual_review": True,
    },
    "confidence-only-test": {
        "confidence_auto_approve_threshold": 0.55,
        "confidence_manual_review_floor": 0.40,
        "allow_high_confidence_flagged_items_to_stay_blocked": True,
        "treat_unclear_as_always_manual_review": True,
        "treat_weak_evidence_as_always_manual_review": True,
        "treat_conflicting_sources_as_always_manual_review": True,
        "treat_date_uncertain_as_always_manual_review": True,
        "treat_ambiguous_subject_as_always_manual_review": True,
        "treat_model_manual_review_as_always_manual_review": True,
    },
}
VALID_SIMULATION_FOCUS = {
    "all",
    "threshold-sensitive",
    "evidence-blocked",
    "flag-blocked",
    "threshold-only-promotions",
}
FLAG_RULES = {
    "ambiguous_subject": "treat_ambiguous_subject_as_always_manual_review",
    "conflicting_sources": "treat_conflicting_sources_as_always_manual_review",
    "weak_evidence": "treat_weak_evidence_as_always_manual_review",
    "date_uncertain": "treat_date_uncertain_as_always_manual_review",
}


def parse_bool(value: str) -> bool:
    normalized = value.strip().lower()
    if normalized in {"true", "1", "yes", "y"}:
        return True
    if normalized in {"false", "0", "no", "n"}:
        return False
    raise argparse.ArgumentTypeError(f"Invalid boolean value: {value}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Simulate current-admin threshold/rule changes against existing review artifacts."
    )
    parser.add_argument("--batch-name", help="Limit output to one current-admin batch name.")
    parser.add_argument("--preset", choices=sorted(PRESETS), default="slightly-relaxed")
    parser.add_argument(
        "--simulation-focus",
        choices=sorted(VALID_SIMULATION_FOCUS),
        default="all",
        help="Filter batches/items by deterministic simulation focus.",
    )
    parser.add_argument("--confidence-auto-approve-threshold", type=float)
    parser.add_argument("--confidence-manual-review-floor", type=float)
    parser.add_argument("--allow-high-confidence-flagged-items-to-stay-blocked", type=parse_bool)
    parser.add_argument("--treat-unclear-as-always-manual-review", type=parse_bool)
    parser.add_argument("--treat-weak-evidence-as-always-manual-review", type=parse_bool)
    parser.add_argument("--treat-conflicting-sources-as-always-manual-review", type=parse_bool)
    parser.add_argument("--treat-date-uncertain-as-always-manual-review", type=parse_bool)
    parser.add_argument("--treat-ambiguous-subject-as-always-manual-review", type=parse_bool)
    parser.add_argument("--treat-model-manual-review-as-always-manual-review", type=parse_bool)
    parser.add_argument("--include-deltas", action="store_true")
    parser.add_argument("--manual-review-only", action="store_true")
    parser.add_argument("--pretty", action="store_true")
    return parser.parse_args()


def simulation_profile(args: argparse.Namespace) -> dict[str, Any]:
    profile = dict(PRESETS[args.preset])
    overrides = {
        "confidence_auto_approve_threshold": args.confidence_auto_approve_threshold,
        "confidence_manual_review_floor": args.confidence_manual_review_floor,
        "allow_high_confidence_flagged_items_to_stay_blocked": args.allow_high_confidence_flagged_items_to_stay_blocked,
        "treat_unclear_as_always_manual_review": args.treat_unclear_as_always_manual_review,
        "treat_weak_evidence_as_always_manual_review": args.treat_weak_evidence_as_always_manual_review,
        "treat_conflicting_sources_as_always_manual_review": args.treat_conflicting_sources_as_always_manual_review,
        "treat_date_uncertain_as_always_manual_review": args.treat_date_uncertain_as_always_manual_review,
        "treat_ambiguous_subject_as_always_manual_review": args.treat_ambiguous_subject_as_always_manual_review,
        "treat_model_manual_review_as_always_manual_review": args.treat_model_manual_review_as_always_manual_review,
    }
    for key, value in overrides.items():
        if value is not None:
            profile[key] = value
    return profile


def item_contexts(review_path: Path, report: dict[str, Any]) -> dict[str, dict[str, Any]]:
    raw_by_item_id = load_raw_classifier_by_item_id(review_path)
    contexts: dict[str, dict[str, Any]] = {}
    for index, item in enumerate(report.get("items") or [], start=1):
        item_id = item.get("slug") or f"item-{index}"
        context = normalize_classifier_context(item, raw_by_item_id.get(item_id))
        contexts[item_id] = {
            "item_id": item_id,
            "title": item.get("title"),
            "recommended_action": context.get("recommended_action") or "needs_manual_review",
            "classification": context.get("classification") or "unclear",
            "confidence": float(context.get("confidence") or 0.0),
            "confidence_bucket": confidence_bucket(float(context.get("confidence") or 0.0)),
            "flags": context.get("flags") or {},
        }
    return contexts


def hard_blockers(context: dict[str, Any], profile: dict[str, Any], manual_item: dict[str, Any] | None) -> list[str]:
    blockers: list[str] = []
    if manual_item and manual_item.get("blocked_by_malformed_output"):
        blockers.append("schema/validation issue")
    if profile["treat_unclear_as_always_manual_review"] and context["classification"] == "unclear":
        blockers.append("classification is unclear")
    if profile["treat_model_manual_review_as_always_manual_review"] and context["recommended_action"] == "needs_manual_review":
        blockers.append("model requested manual review")
    for flag, rule in FLAG_RULES.items():
        if context["flags"].get(flag) and profile[rule]:
            if not (
                profile["allow_high_confidence_flagged_items_to_stay_blocked"] is False
                and context["confidence"] >= profile["confidence_auto_approve_threshold"]
            ):
                blockers.append(flag)
    return blockers


def evaluate_item(context: dict[str, Any], profile: dict[str, Any], manual_item: dict[str, Any] | None) -> dict[str, Any]:
    blockers = hard_blockers(context, profile, manual_item)
    threshold_only = False
    if blockers:
        if "schema/validation issue" in blockers:
            outcome = "schema_blocked"
        elif "weak_evidence" in blockers:
            outcome = "evidence_blocked"
        elif any(blocker in {"ambiguous_subject", "conflicting_sources", "date_uncertain"} for blocker in blockers):
            outcome = "flag_blocked"
        else:
            outcome = "manual_review"
    elif context["recommended_action"] == "reject":
        outcome = "manual_review"
        blockers = ["recommended_action is reject"]
    elif context["confidence"] >= profile["confidence_auto_approve_threshold"]:
        outcome = "finalize_apply_safe"
    elif context["confidence"] < profile["confidence_manual_review_floor"]:
        outcome = "manual_review"
        blockers = ["confidence below manual review floor"]
        threshold_only = True
    else:
        outcome = "manual_review"
        blockers = ["confidence below auto-approve threshold"]
        threshold_only = True
    return {
        "outcome": outcome,
        "finalize_safe": outcome == "finalize_apply_safe",
        "apply_safe": outcome == "finalize_apply_safe",
        "manual_review": outcome != "finalize_apply_safe",
        "blockers": blockers,
        "threshold_only": threshold_only and not any(blocker in blockers for blocker in FLAG_RULES),
    }


def explain_delta(current: dict[str, Any], simulated: dict[str, Any]) -> tuple[str, bool, bool]:
    if current["outcome"] != simulated["outcome"]:
        if simulated["outcome"] == "finalize_apply_safe" and current["threshold_only"]:
            return "promoted from manual review to finalize-safe due to confidence threshold change only", True, False
        if simulated["outcome"] == "finalize_apply_safe":
            return "promoted from manual review to finalize-safe because simulated rules no longer block the item", False, False
        return f"changed from {current['outcome']} to {simulated['outcome']} under simulated rules", False, True
    if simulated["outcome"] == "evidence_blocked":
        return "still blocked because weak_evidence remains true", False, True
    if simulated["outcome"] == "flag_blocked":
        blocker = simulated["blockers"][0] if simulated["blockers"] else "flag"
        return f"no change because {blocker} rule still blocks", False, True
    if "classification is unclear" in simulated["blockers"]:
        return "still blocked because classification is unclear", False, True
    if "model requested manual review" in simulated["blockers"]:
        return "still blocked because model requested manual review", False, True
    if simulated["threshold_only"]:
        return "still manual review because confidence remains below simulated threshold", True, False
    if simulated["outcome"] == "schema_blocked":
        return "still blocked because validation output needs repair", False, True
    return "no change under simulated rules", False, False


def focus_matches_item(delta: dict[str, Any], focus: str) -> bool:
    if focus == "all":
        return True
    if focus == "threshold-sensitive":
        return bool(delta["threshold_only"] or delta["changed"])
    if focus == "evidence-blocked":
        return delta["simulated_outcome"] == "evidence_blocked"
    if focus == "flag-blocked":
        return delta["simulated_outcome"] == "flag_blocked"
    if focus == "threshold-only-promotions":
        return bool(delta["threshold_only_promotion"])
    return True


def build_batch_simulation(
    review_path: Path,
    *,
    profile: dict[str, Any],
    include_deltas: bool,
    manual_review_only: bool,
    simulation_focus: str,
) -> dict[str, Any] | None:
    report = load_json_file(review_path)
    manual_items = build_manual_review_items(review_path)
    manual_by_id = {item["item_id"]: item for item in manual_items}
    contexts = item_contexts(review_path, report)
    if manual_review_only:
        contexts = {item_id: context for item_id, context in contexts.items() if item_id in manual_by_id}
    current_profile = PRESETS[LIVE_PROFILE_NAME]
    deltas: list[dict[str, Any]] = []
    current_counts = Counter()
    simulated_counts = Counter()
    simulated_readiness_blocked = 0
    before_reason_counts: Counter[str] = Counter()
    after_reason_counts: Counter[str] = Counter()
    before_readiness_counts: Counter[str] = Counter()
    after_readiness_counts: Counter[str] = Counter()

    for item_id, context in contexts.items():
        manual_item = manual_by_id.get(item_id)
        current = evaluate_item(context, current_profile, manual_item)
        simulated = evaluate_item(context, profile, manual_item)
        current_counts[current["outcome"]] += 1
        simulated_counts[simulated["outcome"]] += 1
        if simulated["outcome"] == "evidence_blocked" or "model requested manual review" in simulated["blockers"]:
            simulated_readiness_blocked += 1
        if manual_item:
            for reason in manual_item.get("reason_labels") or []:
                before_reason_counts[reason] += 1
            before_readiness_counts[manual_item.get("decision_readiness_label") or "unknown"] += 1
        if simulated["manual_review"] and manual_item:
            for reason in manual_item.get("reason_labels") or []:
                after_reason_counts[reason] += 1
            after_readiness_counts[manual_item.get("decision_readiness_label") or "unknown"] += 1
        explanation, threshold_only, still_needs_judgment = explain_delta(current, simulated)
        delta = {
            "item_id": item_id,
            "title": context.get("title"),
            "current_outcome": current["outcome"],
            "simulated_outcome": simulated["outcome"],
            "changed": current["outcome"] != simulated["outcome"],
            "why_changed_or_not": explanation,
            "threshold_only": threshold_only,
            "threshold_only_promotion": simulated["finalize_safe"] and not current["finalize_safe"] and threshold_only,
            "blocked_by_evidence_or_flags": simulated["outcome"] in {"evidence_blocked", "flag_blocked"},
            "would_still_need_operator_judgment": still_needs_judgment or simulated["manual_review"],
            "current_blockers": current["blockers"],
            "simulated_blockers": simulated["blockers"],
            "confidence": context["confidence"],
            "confidence_bucket": context["confidence_bucket"],
            "reason_labels": manual_item.get("reason_labels") if manual_item else [],
            "decision_readiness_label": manual_item.get("decision_readiness_label") if manual_item else None,
        }
        if focus_matches_item(delta, simulation_focus):
            deltas.append(delta)

    if simulation_focus != "all" and not deltas:
        return None

    total_items = len(contexts)
    current_finalize_safe = current_counts["finalize_apply_safe"]
    simulated_finalize_safe = simulated_counts["finalize_apply_safe"]
    threshold_only_promotions = sum(1 for delta in deltas if delta["threshold_only_promotion"])
    evidence_or_flag_blocked = sum(1 for delta in deltas if delta["blocked_by_evidence_or_flags"])
    result = {
        "batch_name": report.get("batch_name") or review_path.name.removesuffix(".ai-review.json"),
        "review_artifact_path": str(review_path),
        "profile_name": profile.get("profile_name"),
        "total_items": total_items,
        "current_finalize_safe_count": current_finalize_safe,
        "simulated_finalize_safe_count": simulated_finalize_safe,
        "current_apply_safe_count": current_finalize_safe,
        "simulated_apply_safe_count": simulated_finalize_safe,
        "current_manual_review_count": total_items - current_finalize_safe,
        "simulated_manual_review_count": total_items - simulated_finalize_safe,
        "items_newly_promoted_to_finalize_safe": sum(1 for delta in deltas if delta["simulated_outcome"] == "finalize_apply_safe" and delta["current_outcome"] != "finalize_apply_safe"),
        "items_newly_promoted_to_apply_safe": sum(1 for delta in deltas if delta["simulated_outcome"] == "finalize_apply_safe" and delta["current_outcome"] != "finalize_apply_safe"),
        "items_still_blocked_by_flags": simulated_counts["flag_blocked"],
        "items_still_blocked_by_evidence_readiness": simulated_readiness_blocked,
        "items_remaining_manual_review_after_loosening": total_items - simulated_finalize_safe,
        "reason_label_counts_before": dict(sorted(before_reason_counts.items())),
        "reason_label_counts_after": dict(sorted(after_reason_counts.items())),
        "decision_readiness_label_counts_before": dict(sorted(before_readiness_counts.items())),
        "decision_readiness_label_counts_after": dict(sorted(after_readiness_counts.items())),
        "deltas": deltas if include_deltas else [],
        "delta_summary": {
            "changed_items": sum(1 for delta in deltas if delta["changed"]),
            "threshold_only_promotions": threshold_only_promotions,
            "evidence_or_flag_blocked_items": evidence_or_flag_blocked,
        },
    }
    result["rule_based_interpretations"] = simulation_interpretations(result)
    result["advisory_recommendations"] = simulation_recommendations(result)
    return result


def simulation_interpretations(result: dict[str, Any]) -> list[str]:
    total = result["total_items"]
    promoted = result["items_newly_promoted_to_finalize_safe"]
    remaining = result["items_remaining_manual_review_after_loosening"]
    evidence_blocked = result["items_still_blocked_by_evidence_readiness"]
    flag_blocked = result["items_still_blocked_by_flags"]
    interpretations: list[str] = []
    if promoted == 0 and (evidence_blocked + flag_blocked) > 0:
        interpretations.append("loosening confidence thresholds has limited effect because evidence or flag blockers remain dominant")
    if ratio(promoted, total) >= 0.25 and (evidence_blocked + flag_blocked) == 0:
        interpretations.append("threshold relaxation materially reduces manual review volume without changing major flag blockers")
    if ratio(evidence_blocked, max(remaining, 1)) >= 0.5:
        interpretations.append("most blocked items are evidence-constrained, not threshold-constrained")
    if evidence_blocked > promoted:
        interpretations.append("simulation suggests source packaging is a larger bottleneck than confidence policy")
    if 0 < promoted <= max(2, int(total * 0.2)):
        interpretations.append("a modest threshold change would promote a small set of likely operator-judgment items")
    if not interpretations:
        interpretations.append("simulation does not show a strong threshold-driven change")
    return interpretations


def simulation_recommendations(result: dict[str, Any]) -> list[str]:
    promoted = result["items_newly_promoted_to_finalize_safe"]
    evidence_blocked = result["items_still_blocked_by_evidence_readiness"]
    flag_blocked = result["items_still_blocked_by_flags"]
    recommendations: list[str] = []
    if evidence_blocked + flag_blocked > promoted:
        recommendations.append("do not change thresholds yet; evidence blockers dominate")
    if promoted > 0 and evidence_blocked == 0 and flag_blocked == 0:
        recommendations.append("consider a small confidence threshold test because threshold-only blocked items are clustered just below the current cutoff")
    if evidence_blocked > 0:
        recommendations.append("prioritize source enrichment over policy relaxation")
        recommendations.append("review weak-evidence rules before changing confidence thresholds")
    if promoted == 0:
        recommendations.append("run another real batch after improving source packaging before tuning live thresholds")
    if not recommendations:
        recommendations.append("keep simulation as advisory and review item deltas before changing live rules")
    return list(dict.fromkeys(recommendations))


def aggregate_counts(batches: list[dict[str, Any]]) -> dict[str, int]:
    return {
        "batches": len(batches),
        "total_items": sum(batch["total_items"] for batch in batches),
        "current_manual_review_count": sum(batch["current_manual_review_count"] for batch in batches),
        "simulated_manual_review_count": sum(batch["simulated_manual_review_count"] for batch in batches),
        "items_newly_promoted_to_finalize_safe": sum(batch["items_newly_promoted_to_finalize_safe"] for batch in batches),
    }


def main() -> None:
    args = parse_args()
    profile = simulation_profile(args)
    profile["profile_name"] = args.preset
    batches = []
    for review_path in review_artifact_paths():
        batch = build_batch_simulation(
            review_path.resolve(),
            profile=profile,
            include_deltas=bool(args.include_deltas),
            manual_review_only=bool(args.manual_review_only),
            simulation_focus=args.simulation_focus,
        )
        if not batch:
            continue
        if args.batch_name and batch["batch_name"] != args.batch_name:
            continue
        batches.append(batch)

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "artifact_version": ARTIFACT_VERSION,
        "filters": {
            "batch_name": args.batch_name or None,
            "preset": args.preset,
            "simulation_focus": args.simulation_focus,
            "include_deltas": bool(args.include_deltas),
            "manual_review_only": bool(args.manual_review_only),
        },
        "live_profile": {
            "name": LIVE_PROFILE_NAME,
            "settings": PRESETS[LIVE_PROFILE_NAME],
        },
        "simulation_profile": profile,
        "preset_definitions": PRESETS,
        "focus_definitions": {
            "threshold-sensitive": "items that changed or remain blocked only by confidence thresholds",
            "evidence-blocked": "items still blocked by weak-evidence/readiness rules",
            "flag-blocked": "items still blocked by configured flag rules",
            "threshold-only-promotions": "items newly promoted solely by threshold changes",
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
