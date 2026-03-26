#!/usr/bin/env python3
import argparse
import copy
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


DESTRUCTIVE_ACTION_TYPES = {
    "remove_direct_link",
    "replace_link",
    "downgrade_link",
}
SAFE_APPROVABLE_ACTION_TYPES = {"convert_to_partial"}
SAFE_EXCLUDED_ACTION_TYPES = {
    "create_partial_link",
    "import_candidate_seed",
    "replace_link",
    "remove_direct_link",
    "downgrade_link",
}


def python_dir() -> Path:
    return Path(__file__).resolve().parents[1]


def reports_dir() -> Path:
    return python_dir() / "reports"


def default_input_path() -> Path:
    return reports_dir() / "equitystack_review_bundle.json"


def default_output_path() -> Path:
    return reports_dir() / "equitystack_auto_triage_report.json"


def default_feedback_log_path() -> Path:
    return reports_dir() / "equitystack_feedback_log.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Auto-triage scored EquityStack review bundle actions.")
    parser.add_argument("--input", type=Path, default=default_input_path(), help="Review bundle JSON")
    parser.add_argument("--output", type=Path, default=default_output_path(), help="Auto-triage report JSON")
    parser.add_argument("--auto-approve-high", action="store_true", help="Auto-approve qualifying High priority actions")
    parser.add_argument("--auto-approve-safe-actions", action="store_true", help="Auto-approve only conservative low-risk convert_to_partial actions")
    parser.add_argument("--auto-dismiss-low", action="store_true", help="Auto-dismiss qualifying Low priority actions")
    parser.add_argument("--min-confidence", type=float, default=0.7, help="Minimum normalized confidence for auto-approval")
    parser.add_argument("--safe-score-threshold", type=float, default=0.65, help="Minimum action_score for safe-action auto-approval")
    parser.add_argument("--safe-confidence-threshold", type=float, default=0.70, help="Minimum match confidence for safe-action auto-approval")
    parser.add_argument("--dry-run", action="store_true", help="Preview decisions without mutating the bundle")
    parser.add_argument("--apply", action="store_true", help="Persist decisions to the bundle")
    parser.add_argument("--yes", action="store_true", help="Required confirmation for --apply")
    return parser.parse_args()


def load_bundle(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text())
    if not isinstance(payload, dict):
        raise ValueError("Review bundle must be a JSON object")
    return payload


def is_actionable(action: dict[str, Any]) -> bool:
    return str(action.get("status") or "").lower() == "pending" and str(action.get("review_state") or "").lower() == "actionable"


def normalized_match_confidence(action: dict[str, Any]) -> float | None:
    breakdown = action.get("score_breakdown")
    if isinstance(breakdown, dict):
        value = breakdown.get("match_confidence")
        if isinstance(value, (int, float)):
            return float(value)

    payload = action.get("payload") or {}
    raw = payload.get("match_confidence")
    if raw in (None, ""):
        return None
    if isinstance(raw, (int, float)):
        value = float(raw)
        return max(0.0, min(1.0, value / 100.0 if value > 1 else value))
    mapping = {
        "very high": 1.0,
        "high": 0.9,
        "medium": 0.7,
        "low": 0.45,
        "very low": 0.2,
    }
    return mapping.get(str(raw).strip().lower())


def action_score(action: dict[str, Any]) -> float | None:
    value = action.get("action_score")
    if isinstance(value, (int, float)):
        return float(value)
    return None


def safety_exclusion_flags(action: dict[str, Any]) -> list[str]:
    flags: list[str] = []
    for candidate in (
        action.get("safety_exclusion_flags"),
        action.get("auto_triage_exclusion_flags"),
        (action.get("score_breakdown") or {}).get("safety_exclusion_flags"),
    ):
        if isinstance(candidate, str) and candidate.strip():
            flags.append(candidate.strip())
        elif isinstance(candidate, list):
            for item in candidate:
                if isinstance(item, str) and item.strip():
                    flags.append(item.strip())
        elif isinstance(candidate, dict):
            for key, value in candidate.items():
                if value:
                    flags.append(str(key))
    deduped: list[str] = []
    seen: set[str] = set()
    for flag in flags:
        if flag in seen:
            continue
        seen.add(flag)
        deduped.append(flag)
    return deduped


def is_excluded(action: dict[str, Any]) -> tuple[bool, str]:
    action_type = str(action.get("action_type") or "").lower()
    if action_type in DESTRUCTIVE_ACTION_TYPES:
        return True, f"excluded action_type={action_type}"
    if action_score(action) is None:
        return True, "missing action_score"
    if normalized_match_confidence(action) is None:
        return True, "missing match_confidence"
    return False, ""


def safe_action_eligibility(action: dict[str, Any], args: argparse.Namespace) -> tuple[bool, str]:
    action_type = str(action.get("action_type") or "").lower()
    if action_type in SAFE_EXCLUDED_ACTION_TYPES:
        return False, f"safe auto-approval excludes action_type={action_type}"
    if action_type not in SAFE_APPROVABLE_ACTION_TYPES:
        return False, f"safe auto-approval does not support action_type={action_type or 'unknown'}"
    if not is_actionable(action):
        return False, "safe auto-approval requires status=pending and review_state=actionable"

    score = action_score(action)
    if score is None:
        return False, "safe auto-approval requires action_score"
    if score < args.safe_score_threshold:
        return False, f"score {score:.3f} below safe threshold {args.safe_score_threshold:.3f}"

    confidence = normalized_match_confidence(action)
    if confidence is None:
        return False, "safe auto-approval requires match_confidence"
    if confidence < args.safe_confidence_threshold:
        return False, f"confidence {confidence:.3f} below safe threshold {args.safe_confidence_threshold:.3f}"

    priority = str(action.get("action_priority") or "")
    if priority not in {"High", "Medium"}:
        return False, f"safe auto-approval requires Medium or High priority, got {priority or 'missing'}"

    flags = safety_exclusion_flags(action)
    if flags:
        return False, f"safety exclusion flags present: {', '.join(flags)}"

    return True, f"safe convert_to_partial with score={score:.2f} and confidence={confidence:.2f}"


def decide_action(action: dict[str, Any], args: argparse.Namespace) -> tuple[str, str, str]:
    if not is_actionable(action):
        return "skipped", "not actionable", "skipped"

    safe_skip_reason: str | None = None
    if args.auto_approve_safe_actions:
        eligible, reason = safe_action_eligibility(action, args)
        if eligible:
            return "approved", reason, "approved_safe_action"
        safe_skip_reason = reason

    excluded, reason = is_excluded(action)
    if excluded:
        return "skipped", reason, "skipped"

    score = action_score(action)
    confidence = normalized_match_confidence(action)
    priority = str(action.get("action_priority") or "")

    if args.auto_approve_high:
        if priority == "High" and confidence is not None and confidence >= args.min_confidence and score is not None and score >= 0.80:
            return "approved", f"High priority with score={score:.3f} and confidence={confidence:.3f}", "approved_high_priority"

    if args.auto_dismiss_low:
        if priority == "Low" and confidence is not None and confidence < 0.5 and score is not None and score < 0.50:
            return "dismissed", f"Low priority with score={score:.3f} and confidence={confidence:.3f}", "dismissed_low_priority"

    if safe_skip_reason is not None:
        return "skipped", safe_skip_reason, "skipped"
    return "skipped", "did not meet auto-triage thresholds", "skipped"


def apply_decision(action: dict[str, Any], decision: str, triage_decision: str, reason: str) -> None:
    if decision == "approved":
        action["approved"] = True
        action["status"] = "pending"
    elif decision == "dismissed":
        action["approved"] = False
        action["status"] = "dismissed"
    if decision in {"approved", "dismissed"}:
        action["auto_triaged"] = True
        action["auto_triage_decision"] = triage_decision
        action["auto_triage_reason"] = reason


def append_feedback_entries(entries: list[dict[str, Any]]) -> None:
    if not entries:
        return
    path = default_feedback_log_path()
    existing: list[dict[str, Any]] = []
    if path.exists():
        payload = json.loads(path.read_text())
        if isinstance(payload, list):
            existing = [item for item in payload if isinstance(item, dict)]
    existing.extend(entries)
    path.write_text(json.dumps(existing, indent=2, default=str) + "\n")


def feedback_entry(action: dict[str, Any], decision: str) -> dict[str, Any]:
    payload = action.get("payload") or {}
    breakdown = action.get("score_breakdown") or {}
    link_type = payload.get("new_link_type") or payload.get("link_type") or action.get("proposed_link_type")
    return {
        "timestamp": datetime.now(UTC).isoformat(),
        "action_id": action.get("action_id"),
        "action_type": action.get("action_type"),
        "action_score": action.get("action_score"),
        "action_priority": action.get("action_priority"),
        "match_confidence": breakdown.get("match_confidence"),
        "decision": decision,
        "auto_triaged": action.get("auto_triaged"),
        "auto_triage_decision": action.get("auto_triage_decision"),
        "auto_triage_reason": action.get("auto_triage_reason"),
        "future_bill_id": action.get("future_bill_id"),
        "link_type": link_type,
    }


def main() -> None:
    args = parse_args()
    if args.apply and not args.yes:
        raise SystemExit("--apply requires --yes")
    if args.apply and args.dry_run:
        raise SystemExit("Use either --dry-run or --apply, not both")

    dry_run = not args.apply or args.dry_run
    bundle_path = args.input.resolve()
    report_path = args.output.resolve()
    bundle = load_bundle(bundle_path)
    original_bundle = copy.deepcopy(bundle)

    decisions: list[dict[str, Any]] = []
    auto_approved_safe_actions = 0
    auto_approved_high_priority = 0
    auto_dismissed_low_priority = 0
    skipped = 0
    feedback_entries: list[dict[str, Any]] = []

    for group in bundle.get("future_bill_groups") or []:
        for action in group.get("operator_actions") or []:
            score = action_score(action)
            confidence = normalized_match_confidence(action)
            decision, reason, triage_decision = decide_action(action, args)
            decisions.append(
                {
                    "action_id": action.get("action_id"),
                    "action_type": action.get("action_type"),
                    "action_score": score,
                    "action_priority": action.get("action_priority"),
                    "match_confidence": confidence,
                    "decision": triage_decision,
                    "reason": reason,
                }
            )
            if decision == "approved":
                if triage_decision == "approved_safe_action":
                    auto_approved_safe_actions += 1
                else:
                    auto_approved_high_priority += 1
                if not dry_run:
                    apply_decision(action, decision, triage_decision, reason)
                    feedback_entries.append(feedback_entry(action, decision))
            elif decision == "dismissed":
                auto_dismissed_low_priority += 1
                if not dry_run:
                    apply_decision(action, decision, triage_decision, reason)
                    feedback_entries.append(feedback_entry(action, decision))
            else:
                skipped += 1

    report = {
        "generated_at": datetime.now(UTC).isoformat(),
        "mode": "dry_run" if dry_run else "apply",
        "input_file": str(bundle_path),
        "flags": {
            "auto_approve_high": bool(args.auto_approve_high),
            "auto_approve_safe_actions": bool(args.auto_approve_safe_actions),
            "auto_dismiss_low": bool(args.auto_dismiss_low),
            "min_confidence": args.min_confidence,
            "safe_score_threshold": args.safe_score_threshold,
            "safe_confidence_threshold": args.safe_confidence_threshold,
        },
        "total_actions": len(decisions),
        "auto_approved_safe_actions": auto_approved_safe_actions,
        "auto_approved_high_priority": auto_approved_high_priority,
        "auto_dismissed_low_priority": auto_dismissed_low_priority,
        "skipped": skipped,
        "actions": decisions,
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2, default=str) + "\n")

    if not dry_run and bundle != original_bundle:
        bundle_path.write_text(json.dumps(bundle, indent=2, default=str) + "\n")
        append_feedback_entries(feedback_entries)

    print("Auto-triage summary:")
    print(f"- Approved safe actions: {auto_approved_safe_actions}")
    print(f"- Approved high priority: {auto_approved_high_priority}")
    print(f"- Dismissed low priority: {auto_dismissed_low_priority}")
    print(f"- Skipped: {skipped}")
    print(f"- Report: {report_path}")
    if not dry_run:
        print(f"- Updated bundle: {bundle_path}")


if __name__ == "__main__":
    main()
