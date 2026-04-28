#!/usr/bin/env python3
import argparse
import json
import subprocess
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from lib.llm.provider import default_model_name


DEFAULT_REVIEW_MODEL = default_model_name()
DEFAULT_VERIFIER_MODEL = DEFAULT_REVIEW_MODEL
DEFAULT_FALLBACK_MODEL = DEFAULT_REVIEW_MODEL
DEFAULT_SENIOR_TIMEOUT = 240
DEFAULT_VERIFIER_TIMEOUT = 240
DEFAULT_TIMEOUT = DEFAULT_SENIOR_TIMEOUT


def python_dir() -> Path:
    return Path(__file__).resolve().parent


def reports_dir() -> Path:
    return python_dir() / "reports"


def default_pipeline_report() -> Path:
    return reports_dir() / "equitystack_pipeline_report.json"


def ai_review_path() -> Path:
    return reports_dir() / "future_bill_link_ai_review.json"


def manual_queue_path() -> Path:
    return reports_dir() / "future_bill_link_manual_review_queue.json"


def suggestion_path() -> Path:
    return reports_dir() / "future_bill_link_partial_suggestions.json"


def discovery_path() -> Path:
    return reports_dir() / "future_bill_candidate_discovery.json"


def bundle_path() -> Path:
    return reports_dir() / "equitystack_review_bundle.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the daily EquityStack review-first pipeline in the documented order.")
    parser.add_argument("--skip-discovery", action="store_true", help="Skip the missing-candidate discovery step")
    parser.add_argument("--apply-safe-removals", action="store_true", help="Run the safe-removal step in apply mode")
    parser.add_argument("--only-future-bill-id", type=int, action="append", help="Limit suggestion/discovery/bundle focus to one or more future_bill_id values")
    parser.add_argument("--model", help="Legacy alias for --review-model")
    parser.add_argument("--review-model", default=DEFAULT_REVIEW_MODEL, help="Senior review model for safety-impacting stages")
    parser.add_argument("--verifier-model", default=DEFAULT_VERIFIER_MODEL, help="Verifier / first-pass model for draft and fallback review paths")
    parser.add_argument("--fallback-model", default=DEFAULT_FALLBACK_MODEL, help="Fallback model used after senior-review failure")
    parser.add_argument("--timeout", type=int, help="Legacy alias that sets both senior and verifier timeouts")
    parser.add_argument("--senior-timeout", type=int, help="AI timeout in seconds for the senior review stage")
    parser.add_argument("--verifier-timeout", type=int, help="AI timeout in seconds for verifier/fallback stages")
    parser.add_argument("--csv", action="store_true", help="Write CSV outputs for steps that support it")
    parser.add_argument("--output-report", type=Path, default=default_pipeline_report(), help="Path to write the pipeline summary report")
    args = parser.parse_args()
    shared_timeout = args.timeout
    args.senior_timeout = args.senior_timeout or shared_timeout or DEFAULT_SENIOR_TIMEOUT
    args.verifier_timeout = args.verifier_timeout or shared_timeout or DEFAULT_VERIFIER_TIMEOUT
    return args


def load_json(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    return json.loads(path.read_text())


def build_workflow_outcome_summary(
    ai_review_payload: dict[str, Any] | None,
    manual_queue_payload: dict[str, Any] | None,
) -> dict[str, Any] | None:
    if not ai_review_payload and not manual_queue_payload:
        return None

    summary = dict(ai_review_payload.get("workflow_outcome_summary") or {}) if ai_review_payload else {}
    manual_review_queue_count = 0
    if manual_queue_payload:
        manual_review_queue_count = max(
            int(manual_queue_payload.get("manual_review_count") or 0),
            len(manual_queue_payload.get("items") or []),
        )

    if not summary:
        return {
            "workflow_status": "review_required" if manual_review_queue_count else "unknown",
            "ai_status": {
                "run_status": "unknown",
                "total_items": 0,
                "ai_success": 0,
                "primary_model_success": 0,
                "fallback_model_success": 0,
                "fallback_used": 0,
                "heuristic_fallback": 0,
                "dry_run_count": 0,
                "ai_failure_reason": None,
            },
            "decisions": {
                "kept": 0,
                "modified": 0,
                "removed": 0,
                "manual_review": manual_review_queue_count,
            },
            "confidence_level": "low" if manual_review_queue_count else "unknown",
            "trust_warning": manual_review_queue_count > 0,
            "user_message": (
                "Manual review items were generated, but the AI workflow summary is unavailable."
                if manual_review_queue_count
                else "No legislative workflow summary is available."
            ),
            "next_step": "Review required items" if manual_review_queue_count else "Inspect the workflow artifacts",
            "manual_review_queue_count": manual_review_queue_count,
        }

    summary["manual_review_queue_count"] = max(
        int(summary.get("manual_review_queue_count") or 0),
        manual_review_queue_count,
        int(summary.get("decisions", {}).get("manual_review") or 0),
    )
    return summary


def needs_discovery(path: Path) -> bool:
    payload = load_json(path)
    if not payload:
        return False
    for item in payload.get("items") or []:
        if item.get("recommended_next_step") in {"manual_review_only", "no_good_candidate_found"}:
            return True
    return False


def run_step(name: str, command: list[str]) -> dict[str, Any]:
    print(f"\n==> {name}")
    print("Command:", " ".join(command))
    started = time.time()
    completed = subprocess.run(command, cwd=python_dir(), check=False)
    duration = round(time.time() - started, 3)
    result = {
        "name": name,
        "command": command,
        "started_at": datetime.now(UTC).isoformat(),
        "duration_seconds": duration,
        "returncode": completed.returncode,
        "status": "ok" if completed.returncode == 0 else "failed",
    }
    if completed.returncode != 0:
        raise subprocess.CalledProcessError(completed.returncode, command)
    return result


def main() -> None:
    args = parse_args()
    if args.senior_timeout <= 0:
        raise SystemExit("--senior-timeout must be greater than 0")
    if args.verifier_timeout <= 0:
        raise SystemExit("--verifier-timeout must be greater than 0")
    only_future_bill_ids = args.only_future_bill_id or []
    review_model = args.model or args.review_model
    report_path = args.output_report.resolve()
    report_path.parent.mkdir(parents=True, exist_ok=True)

    steps: list[dict[str, Any]] = []
    started_at = datetime.now(UTC).isoformat()
    status = "completed"
    failure: dict[str, Any] | None = None

    try:
        steps.append(run_step("refresh_database", [sys.executable, "update_database.py"]))

        review_command = [
            sys.executable,
            "scripts/review_future_bill_audit.py",
            "--model",
            review_model,
            "--verifier-model",
            args.verifier_model,
            "--fallback-model",
            args.fallback_model,
            "--senior-timeout",
            str(args.senior_timeout),
            "--verifier-timeout",
            str(args.verifier_timeout),
        ]
        if args.csv:
            review_command.append("--csv")
        steps.append(run_step("review_future_bill_audit", review_command))

        apply_command = [
            sys.executable,
            "scripts/apply_future_bill_ai_review.py",
            "--input",
            str(ai_review_path()),
        ]
        if args.apply_safe_removals:
            apply_command.extend(["--apply", "--yes", "--archive-rows"])
        if args.csv:
            apply_command.append("--csv")
        steps.append(run_step("safe_remove_review", apply_command))

        suggest_command = [
            sys.executable,
            "scripts/suggest_partial_future_bill_links.py",
            "--input-review-report",
            str(ai_review_path()),
            "--input-manual-queue",
            str(manual_queue_path()),
            "--top-k",
            "5",
            "--model",
            args.verifier_model,
            "--timeout",
            str(args.verifier_timeout),
        ]
        for future_bill_id in only_future_bill_ids:
            suggest_command.extend(["--only-future-bill-id", str(future_bill_id)])
        if args.csv:
            suggest_command.append("--csv")
        steps.append(run_step("suggest_partial_links", suggest_command))

        discovery_ran = False
        if not args.skip_discovery and needs_discovery(suggestion_path()):
            discovery_command = [
                sys.executable,
                "scripts/find_candidate_tracked_bills.py",
                "--trigger-from-suggestions",
                str(suggestion_path()),
                "--trigger-from-review",
                str(ai_review_path()),
                "--top-k",
                "5",
                "--model",
                args.verifier_model,
                "--timeout",
                str(args.verifier_timeout),
            ]
            for future_bill_id in only_future_bill_ids:
                discovery_command.extend(["--only-future-bill-id", str(future_bill_id)])
            if args.csv:
                discovery_command.append("--csv")
            steps.append(run_step("discover_missing_tracked_bills", discovery_command))
            discovery_ran = True
        else:
            print("\n==> discover_missing_tracked_bills")
            print("Skipped: no unresolved suggestion rows or --skip-discovery was used.")

        bundle_command = [
            sys.executable,
            "scripts/build_review_bundle.py",
        ]
        for future_bill_id in only_future_bill_ids:
            bundle_command.extend(["--only-future-bill-id", str(future_bill_id)])
        if args.csv:
            bundle_command.append("--csv")
        steps.append(run_step("build_review_bundle", bundle_command))

    except subprocess.CalledProcessError as error:
        status = "failed"
        failure = {
            "command": error.cmd,
            "returncode": error.returncode,
        }

    payload = {
        "generated_at": datetime.now(UTC).isoformat(),
        "started_at": started_at,
        "status": status,
        "requested_model": review_model,
        "review_model": review_model,
        "verifier_model": args.verifier_model,
        "fallback_model": args.fallback_model,
        "timeout_seconds": args.timeout,
        "apply_safe_removals": args.apply_safe_removals,
        "skip_discovery": args.skip_discovery,
        "only_future_bill_ids": only_future_bill_ids,
        "bundle_path": str(bundle_path()),
        "reports": {
            "ai_review": str(ai_review_path()),
            "manual_queue": str(manual_queue_path()),
            "suggestions": str(suggestion_path()),
            "discovery": str(discovery_path()),
        },
        "steps": steps,
        "failure": failure,
    }
    ai_review_payload = load_json(ai_review_path())
    manual_queue_payload = load_json(manual_queue_path())
    workflow_outcome_summary = build_workflow_outcome_summary(
        ai_review_payload,
        manual_queue_payload,
    )
    if workflow_outcome_summary:
        payload["workflow_outcome_summary"] = workflow_outcome_summary
    report_path.write_text(json.dumps(payload, indent=2, default=str))
    print(f"\nWrote pipeline report to {report_path}")
    if workflow_outcome_summary:
        print("=== WORKFLOW SUMMARY ===")
        print(f"AI Status: {str(workflow_outcome_summary.get('ai_status', {}).get('run_status') or 'unknown').upper()}")
        print(
            "Fallback Used: "
            f"{workflow_outcome_summary.get('ai_status', {}).get('fallback_used', 0)}/"
            f"{workflow_outcome_summary.get('ai_status', {}).get('total_items', 0)}"
        )
        decisions = workflow_outcome_summary.get("decisions", {})
        print(
            "Decisions: "
            f"{decisions.get('kept', 0)} kept, "
            f"{decisions.get('modified', 0)} modified, "
            f"{decisions.get('removed', 0)} removed, "
            f"{decisions.get('manual_review', 0)} manual review"
        )
        print(
            f"Confidence: {str(workflow_outcome_summary.get('confidence_level') or 'unknown').upper()}"
        )
        print(f"Next Step: {workflow_outcome_summary.get('next_step') or 'Inspect the workflow artifacts'}")
    if status != "completed":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
