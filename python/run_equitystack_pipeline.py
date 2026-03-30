#!/usr/bin/env python3
import argparse
import json
import subprocess
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


DEFAULT_REVIEW_MODEL = "qwen3.5:27b"
DEFAULT_VERIFIER_MODEL = "qwen3.5:9b"
DEFAULT_FALLBACK_MODEL = "qwen3.5:9b"
DEFAULT_SENIOR_TIMEOUT = 300
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
    parser.add_argument("--senior-timeout", type=int, help="Ollama timeout in seconds for the senior review stage")
    parser.add_argument("--verifier-timeout", type=int, help="Ollama timeout in seconds for verifier/fallback stages")
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
            "scripts/review_future_bill_audit_with_ollama.py",
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
            "--use-ollama",
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
                "--use-ollama",
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
    report_path.write_text(json.dumps(payload, indent=2, default=str))
    print(f"\nWrote pipeline report to {report_path}")
    if status != "completed":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
