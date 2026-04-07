#!/usr/bin/env python3
import argparse
import json
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from lib.llm.provider import default_model_name


DEFAULT_MODEL = default_model_name()
DEFAULT_TIMEOUT = 240


def python_dir() -> Path:
    return Path(__file__).resolve().parents[1]


def reports_dir() -> Path:
    return python_dir() / "reports"


def default_apply_report() -> Path:
    return reports_dir() / "equitystack_apply_report.json"


def default_review_report() -> Path:
    return reports_dir() / "future_bill_link_ai_review.json"


def default_manual_queue() -> Path:
    return reports_dir() / "future_bill_link_manual_review_queue.json"


def default_output_report() -> Path:
    return reports_dir() / "equitystack_rerun_report.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Rerun only the minimum downstream steps for affected future bills.")
    parser.add_argument("--future-bill-id", type=int, action="append", help="One or more future_bill_id values to rerun")
    parser.add_argument("--from-apply-report", type=Path, default=default_apply_report(), help="Apply report JSON used to derive affected future_bill_id values")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="Verifier model for follow-up suggestion/discovery scripts")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT, help="Ollama timeout in seconds for follow-up verifier stages")
    parser.add_argument("--csv", action="store_true", help="Write CSV outputs from rerun scripts where supported")
    parser.add_argument("--output", type=Path, default=default_output_report(), help="Rerun report JSON")
    return parser.parse_args()


def load_json(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    return json.loads(path.read_text())


def derive_future_bill_ids(args: argparse.Namespace) -> tuple[list[int], str]:
    ids = list(args.future_bill_id or [])
    if ids:
        return sorted(set(ids)), "direct CLI"
    payload = load_json(args.from_apply_report.resolve())
    if not payload:
        return [], "none"
    affected = payload.get("affected_future_bill_ids") or []
    if affected:
        return sorted(set(int(value) for value in affected)), "affected_future_bill_ids"
    applied_actions = payload.get("applied_actions") or []
    derived = sorted(
        {
            int(action["future_bill_id"])
            for action in applied_actions
            if action.get("future_bill_id") is not None
        }
    )
    if derived:
        return derived, "derived from applied_actions"
    return [], "none"


def main() -> None:
    args = parse_args()
    future_bill_ids, source = derive_future_bill_ids(args)
    if not future_bill_ids:
        raise SystemExit("No future_bill_id values were provided or found in the apply report.")
    print(f"Resolved affected future_bill_id values from: {source}")
    print(f"Future bill IDs: {future_bill_ids}")

    stages_run = []
    stages_skipped = []
    errors = []
    review_report = default_review_report()
    manual_queue = default_manual_queue()
    review_report_exists = review_report.exists()
    manual_queue_exists = manual_queue.exists()
    if review_report_exists:
        print(f"Using AI review report: {review_report}")
    else:
        print("AI review report not found; continuing without it")
    if manual_queue_exists:
        print(f"Using manual review queue: {manual_queue}")
    else:
        print("Manual review queue not found; continuing without it")

    for future_bill_id in future_bill_ids:
        suggestion_output = reports_dir() / f"future_bill_link_partial_suggestions.fb{future_bill_id}.json"
        discovery_output = reports_dir() / f"future_bill_candidate_discovery.fb{future_bill_id}.json"

        if not review_report_exists and not manual_queue_exists:
            reason = "No AI review report or manual review queue file was found"
            print(f"No suggestion input reports were found; skipping suggestion rerun for future_bill_id={future_bill_id}")
            stages_skipped.append(
                {
                    "stage": "suggest_partial_future_bill_links",
                    "future_bill_id": future_bill_id,
                    "reason": reason,
                }
            )
            continue

        suggest_command = [
            sys.executable,
            "scripts/suggest_partial_future_bill_links.py",
            "--only-future-bill-id",
            str(future_bill_id),
            "--top-k",
            "5",
            "--use-ollama",
            "--model",
            args.model,
            "--timeout",
            str(args.timeout),
            "--output",
            str(suggestion_output),
        ]
        if review_report_exists:
            suggest_command.extend(["--input-review-report", str(review_report)])
        if manual_queue_exists:
            suggest_command.extend(["--input-manual-queue", str(manual_queue)])
        if args.csv:
            suggest_command.append("--csv")
        print(f"Rerunning suggestions for future_bill_id={future_bill_id}")
        try:
            subprocess.run(suggest_command, cwd=python_dir(), check=True)
            stages_run.append(
                {
                    "future_bill_id": future_bill_id,
                    "stage": "suggest_partial_future_bill_links",
                    "output": str(suggestion_output),
                }
            )
        except subprocess.CalledProcessError as error:
            errors.append(
                {
                    "stage": "suggest_partial_future_bill_links",
                    "future_bill_id": future_bill_id,
                    "returncode": error.returncode,
                }
            )
            print(f"Suggestion rerun failed for future_bill_id={future_bill_id} with return code {error.returncode}")
            continue

        suggestion_payload = load_json(suggestion_output) or {}
        unresolved = any(
            item.get("recommended_next_step") in {"manual_review_only", "no_good_candidate_found"}
            for item in suggestion_payload.get("items") or []
        )
        if unresolved:
            discovery_command = [
                sys.executable,
                "scripts/find_candidate_tracked_bills.py",
                "--trigger-from-suggestions",
                str(suggestion_output),
                "--only-future-bill-id",
                str(future_bill_id),
                "--top-k",
                "5",
                "--use-ollama",
                "--model",
                args.model,
                "--timeout",
                str(args.timeout),
                "--output",
                str(discovery_output),
            ]
            if review_report_exists:
                discovery_command.extend(["--trigger-from-review", str(review_report)])
            if args.csv:
                discovery_command.append("--csv")
            print(f"Rerunning discovery for future_bill_id={future_bill_id}")
            try:
                subprocess.run(discovery_command, cwd=python_dir(), check=True)
                stages_run.append(
                    {
                        "future_bill_id": future_bill_id,
                        "stage": "find_candidate_tracked_bills",
                        "output": str(discovery_output),
                    }
                )
            except subprocess.CalledProcessError as error:
                errors.append(
                    {
                        "stage": "find_candidate_tracked_bills",
                        "future_bill_id": future_bill_id,
                        "returncode": error.returncode,
                    }
                )
                print(f"Discovery rerun failed for future_bill_id={future_bill_id} with return code {error.returncode}")
        else:
            stages_skipped.append(
                {
                    "stage": "find_candidate_tracked_bills",
                    "future_bill_id": future_bill_id,
                    "reason": "Suggestion rerun did not leave unresolved rows",
                }
            )

    payload = {
        "generated_at": datetime.now(UTC).isoformat(),
        "source_apply_report": str(args.from_apply_report.resolve()),
        "resolved_from": source,
        "affected_future_bill_ids": future_bill_ids,
        "verifier_model": args.model,
        "timeout_seconds": args.timeout,
        "stages_run": stages_run,
        "stages_skipped": stages_skipped,
        "errors": errors,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2, default=str))
    print(f"Wrote rerun report to {args.output.resolve()}")


if __name__ == "__main__":
    main()
