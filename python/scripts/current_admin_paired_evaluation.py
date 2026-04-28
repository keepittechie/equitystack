#!/usr/bin/env python3
import argparse
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from current_admin_common import (
    get_current_admin_reports_dir,
    normalize_nullable_text,
    read_batch_payload,
    write_json_file,
)
from current_admin_evidence_pack import PACKING_VERSION, evidence_pack_path_for_review
from current_admin_openai_batch_guardrails import (
    error_path_for_review,
    metadata_path_for_review,
    output_path_for_review,
    validation_path_for_review,
)


ARTIFACT_VERSION = 1
BASELINE_PACKING_VERSION = "baseline-thin-v1"
DEFAULT_ENRICHED_PACKING_VERSION = PACKING_VERSION
SIDE_LABELS = ("baseline", "enriched")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run or inspect a paired current-admin baseline vs evidence-pack review experiment."
    )
    parser.add_argument("--paired-experiment", action="store_true", help="Compatibility flag for CLI wrapper routing.")
    parser.add_argument("--input", type=Path, help="Normalized current-admin batch JSON.")
    parser.add_argument("--batch-name", help="Batch name used for status lookup when --input is not supplied.")
    parser.add_argument("--experiment-name", help="Stable local paired-evaluation experiment name.")
    parser.add_argument("--prep-only", action="store_true", help="Prepare metadata and artifact paths without submitting reviews.")
    parser.add_argument("--status", action="store_true", help="Print paired-evaluation metadata/status JSON.")
    parser.add_argument("--poll", action="store_true", help="Poll both submitted Batch sides without resubmitting.")
    parser.add_argument("--batch-poll", action="store_true", help="Alias for --poll.")
    parser.add_argument("--fetch", action="store_true", help="Fetch available output/error files for both sides.")
    parser.add_argument("--batch-fetch", action="store_true", help="Alias for --fetch.")
    parser.add_argument("--resume", action="store_true", help="Poll/fetch/rebuild both sides without duplicate submission.")
    parser.add_argument("--batch-resume", action="store_true", help="Alias for --resume.")
    parser.add_argument("--compare", action="store_true", help="Run comparison if both review artifacts are available.")
    parser.add_argument("--include-item-deltas", action="store_true")
    parser.add_argument("--json", action="store_true", help="Compatibility flag; output is always JSON.")
    parser.add_argument("--pretty", action="store_true")
    parser.add_argument("--dry-run", action="store_true", help="Pass through to each review side.")
    parser.add_argument("--max-items", type=int)
    parser.add_argument("--only-slug", action="append")
    parser.add_argument("--model")
    parser.add_argument("--verifier-model")
    parser.add_argument("--fallback-model")
    parser.add_argument("--review-mode")
    parser.add_argument("--deep-review", action="store_true")
    parser.add_argument("--timeout", type=int)
    parser.add_argument("--senior-timeout", type=int)
    parser.add_argument("--verifier-timeout", type=int)
    parser.add_argument("--temperature", type=float)
    parser.add_argument("--openai-base-url", default="")
    parser.add_argument("--completion-window")
    parser.add_argument("--poll-interval-seconds", type=int)
    parser.add_argument("--wait-timeout-seconds", type=int)
    return parser.parse_args()


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def sanitize_experiment_name(value: str | None) -> str:
    raw = normalize_nullable_text(value)
    if not raw:
        return f"paired-eval-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}"
    safe = re.sub(r"[^a-zA-Z0-9._-]+", "-", raw).strip(".-_")
    return safe or f"paired-eval-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}"


def load_json_object(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    payload = json.loads(path.read_text())
    if not isinstance(payload, dict):
        raise ValueError(f"{path} must contain a JSON object.")
    return payload


def script_path(name: str) -> Path:
    return Path(__file__).resolve().with_name(name)


def review_path_for(batch_name: str, experiment_name: str, side: str) -> Path:
    return get_current_admin_reports_dir() / f"{batch_name}.{experiment_name}.{side}.ai-review.json"


def metadata_path_for(batch_name: str, experiment_name: str) -> Path:
    return get_current_admin_reports_dir() / f"{batch_name}.{experiment_name}.paired-eval.meta.json"


def comparison_path_for(batch_name: str, experiment_name: str) -> Path:
    return get_current_admin_reports_dir() / f"{batch_name}.{experiment_name}.comparison.json"


def discover_experiment_metadata(
    *,
    batch_name: str | None,
    experiment_name: str | None,
) -> Path | None:
    reports_dir = get_current_admin_reports_dir()
    candidates = sorted(
        (path for path in reports_dir.glob("*.paired-eval.meta.json") if path.is_file()),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    for path in candidates:
        payload = load_json_object(path)
        if not payload:
            continue
        if experiment_name and payload.get("experiment_name") != experiment_name:
            continue
        if batch_name and payload.get("source_batch_name") != batch_name:
            continue
        return path
    return None


def infer_context(args: argparse.Namespace) -> tuple[str | None, Path | None, dict[str, Any] | None]:
    if args.input:
        batch_payload = read_batch_payload(args.input)
        batch_name = normalize_nullable_text(batch_payload.get("batch_name")) or args.input.name.removesuffix(".json")
        return batch_name, args.input, batch_payload
    return normalize_nullable_text(args.batch_name), None, None


def side_artifacts(review_path: Path, side: str) -> dict[str, Any]:
    return {
        "review": str(review_path),
        "openai_batch_metadata": str(metadata_path_for_review(review_path)),
        "openai_batch_output": str(output_path_for_review(review_path)),
        "openai_batch_error": str(error_path_for_review(review_path)),
        "validation": str(validation_path_for_review(review_path)),
        "evidence_pack": str(evidence_pack_path_for_review(review_path)) if side == "enriched" else None,
    }


def side_status(review_path: Path, side: str) -> dict[str, Any]:
    metadata_path = metadata_path_for_review(review_path)
    metadata = load_json_object(metadata_path) if metadata_path.exists() else {}
    validation_path = validation_path_for_review(review_path)
    evidence_path = evidence_pack_path_for_review(review_path)
    output_path = output_path_for_review(review_path)
    error_path = error_path_for_review(review_path)
    review_payload = load_json_object(review_path) if review_path.exists() else {}
    batch_status = metadata.get("status") or ("review_ready" if review_path.exists() else "not_started")
    return {
        "side": side,
        "prompt_input_mode": side,
        "review_exists": review_path.exists(),
        "review_artifact": str(review_path),
        "batch_status": batch_status,
        "batch_id": metadata.get("batch_id") or metadata.get("id"),
        "model": metadata.get("model") or review_payload.get("model") or review_payload.get("requested_model"),
        "metadata_present": metadata_path.exists(),
        "metadata_artifact": str(metadata_path),
        "validation_present": validation_path.exists(),
        "validation_artifact": str(validation_path),
        "output_ready": output_path.exists(),
        "output_artifact": str(output_path),
        "error_file_present": error_path.exists(),
        "error_artifact": str(error_path),
        "evidence_pack_present": evidence_path.exists() if side == "enriched" else False,
        "evidence_pack_artifact": str(evidence_path) if side == "enriched" else None,
        "review_artifact_rebuilt": bool(review_payload) or bool(metadata.get("review_artifact_rebuilt_at")),
        "reviewed_count": int(review_payload.get("reviewed_count") or metadata.get("reviewed_count") or 0),
        "ready_for_comparison": review_path.exists(),
    }


def recommendation_for(status: dict[str, Any]) -> str:
    baseline = status["baseline"]
    enriched = status["enriched"]
    if not baseline["review_exists"]:
        if baseline["metadata_present"]:
            return "resume baseline review"
        return "run baseline side"
    if not enriched["review_exists"]:
        if enriched["metadata_present"]:
            return "resume enriched review"
        return "run enriched comparison after baseline completes"
    if status.get("comparison_ready"):
        return "both runs ready; inspect comparison"
    return "both runs ready; run comparison"


def build_metadata(
    *,
    batch_name: str,
    experiment_name: str,
    input_path: Path | None,
    existing: dict[str, Any] | None,
    last_action: str,
) -> dict[str, Any]:
    baseline_review = review_path_for(batch_name, experiment_name, "baseline")
    enriched_review = review_path_for(batch_name, experiment_name, "enriched")
    comparison_path = comparison_path_for(batch_name, experiment_name)
    created_at = existing.get("created_at") if existing else None
    status = {
        "baseline": side_status(baseline_review, "baseline"),
        "enriched": side_status(enriched_review, "enriched"),
        "comparison_ready": comparison_path.exists(),
        "comparison_artifact": str(comparison_path),
    }
    return {
        "artifact_version": ARTIFACT_VERSION,
        "experiment_name": experiment_name,
        "source_batch_name": batch_name,
        "source_input_artifact": str(input_path) if input_path else (existing or {}).get("source_input_artifact"),
        "created_at": created_at or now_iso(),
        "updated_at": now_iso(),
        "packing_versions": {
            "baseline": BASELINE_PACKING_VERSION,
            "enriched": DEFAULT_ENRICHED_PACKING_VERSION,
        },
        "prompt_input_modes": {
            "baseline": "baseline",
            "enriched": "enriched",
        },
        "artifacts": {
            "baseline": side_artifacts(baseline_review, "baseline"),
            "enriched": side_artifacts(enriched_review, "enriched"),
            "comparison": str(comparison_path),
            "metadata": str(metadata_path_for(batch_name, experiment_name)),
        },
        "status": {
            **status,
            "recommendation": recommendation_for(status),
        },
        "last_action": last_action,
    }


def review_passthrough_args(args: argparse.Namespace) -> list[str]:
    passthrough: list[str] = []
    value_flags = (
        "model",
        "verifier_model",
        "fallback_model",
        "review_mode",
        "timeout",
        "senior_timeout",
        "verifier_timeout",
        "temperature",
        "openai_base_url",
        "completion_window",
        "poll_interval_seconds",
        "wait_timeout_seconds",
        "max_items",
    )
    for attr in value_flags:
        value = getattr(args, attr)
        if value not in (None, ""):
            passthrough.extend([f"--{attr.replace('_', '-')}", str(value)])
    if args.deep_review:
        passthrough.append("--deep-review")
    if args.dry_run:
        passthrough.append("--dry-run")
    for slug in args.only_slug or []:
        passthrough.extend(["--only-slug", slug])
    return passthrough


def run_review_side(args: argparse.Namespace, *, side: str, input_path: Path, review_path: Path, lifecycle_flag: str | None) -> None:
    command = [
        sys.executable,
        str(script_path("review_current_admin_batch_with_openai_batch.py")),
        "--input",
        str(input_path),
        "--output",
        str(review_path),
        "--packaging-mode",
        side,
        *review_passthrough_args(args),
    ]
    if lifecycle_flag:
        command.append(lifecycle_flag)
    completed = subprocess.run(command, capture_output=True, text=True)
    if completed.returncode != 0:
        details = "\n".join(
            part
            for part in (
                f"{side} review command failed with exit code {completed.returncode}.",
                completed.stderr.strip(),
                completed.stdout.strip(),
            )
            if part
        )
        raise RuntimeError(details)


def run_comparison(meta: dict[str, Any], include_item_deltas: bool) -> dict[str, Any]:
    baseline = Path(meta["artifacts"]["baseline"]["review"])
    enriched = Path(meta["artifacts"]["enriched"]["review"])
    if not baseline.exists() or not enriched.exists():
        raise ValueError("Both baseline and enriched review artifacts must exist before comparison can run.")
    command = [
        sys.executable,
        str(script_path("current_admin_review_comparison_read_model.py")),
        "--baseline",
        str(baseline),
        "--enriched",
        str(enriched),
    ]
    if include_item_deltas:
        command.append("--include-item-deltas")
    completed = subprocess.run(command, capture_output=True, text=True)
    if completed.returncode != 0:
        details = "\n".join(
            part
            for part in (
                f"comparison command failed with exit code {completed.returncode}.",
                completed.stderr.strip(),
                completed.stdout.strip(),
            )
            if part
        )
        raise RuntimeError(details)
    payload = json.loads(completed.stdout)
    write_json_file(Path(meta["artifacts"]["comparison"]), payload)
    return payload


def action_for(args: argparse.Namespace) -> str:
    if args.prep_only:
        return "prep"
    if args.status:
        return "status"
    if args.poll or args.batch_poll:
        return "poll"
    if args.fetch or args.batch_fetch:
        return "fetch"
    if args.resume or args.batch_resume:
        return "resume"
    if args.compare:
        return "compare"
    return "run"


def main() -> None:
    args = parse_args()
    action = action_for(args)
    batch_name, input_path, _ = infer_context(args)
    experiment_name = sanitize_experiment_name(args.experiment_name)

    if action in {"status", "compare"} and args.experiment_name and not batch_name:
        discovered = discover_experiment_metadata(batch_name=None, experiment_name=experiment_name)
        if discovered:
            existing = load_json_object(discovered) or {}
            batch_name = existing.get("source_batch_name")
            experiment_name = existing.get("experiment_name") or experiment_name
        elif action == "status":
            payload = {
                "artifact_version": ARTIFACT_VERSION,
                "experiment_available": False,
                "status": "no-experiment-context",
                "experiment_name": experiment_name,
                "recommendation": "prepare a paired experiment before status tracking",
            }
            print(json.dumps(payload, indent=2 if args.pretty else None))
            return

    if action == "status" and not args.experiment_name:
        discovered = discover_experiment_metadata(batch_name=batch_name, experiment_name=None)
        if not discovered:
            payload = {
                "artifact_version": ARTIFACT_VERSION,
                "experiment_available": False,
                "status": "no-experiment-context",
                "batch_name": batch_name,
                "recommendation": "prepare a paired experiment before status tracking",
            }
            print(json.dumps(payload, indent=2 if args.pretty else None))
            return
        existing = load_json_object(discovered) or {}
        batch_name = existing.get("source_batch_name")
        experiment_name = existing.get("experiment_name")

    if not batch_name:
        raise ValueError("--input or --batch-name is required.")
    if action not in {"status", "compare"} and not input_path:
        raise ValueError("--input is required to run, poll, fetch, or resume paired experiment reviews.")

    meta_path = metadata_path_for(batch_name, experiment_name)
    if action in {"status", "compare"} and not meta_path.exists():
        discovered = discover_experiment_metadata(batch_name=batch_name, experiment_name=experiment_name)
        if discovered:
            meta_path = discovered
            existing_meta = load_json_object(meta_path) or {}
            experiment_name = existing_meta.get("experiment_name") or experiment_name
        else:
            existing_meta = None
    else:
        existing_meta = load_json_object(meta_path)

    meta = build_metadata(
        batch_name=batch_name,
        experiment_name=experiment_name,
        input_path=input_path,
        existing=existing_meta,
        last_action=action,
    )
    write_json_file(meta_path, meta)

    if action == "prep":
        print(json.dumps(meta, indent=2 if args.pretty else None))
        return

    if action == "status":
        print(json.dumps(meta, indent=2 if args.pretty else None))
        return

    lifecycle_flag = {
        "poll": "--batch-poll",
        "fetch": "--batch-fetch",
        "resume": "--batch-resume",
    }.get(action)

    if action in {"run", "poll", "fetch", "resume"}:
        assert input_path is not None
        for side in SIDE_LABELS:
            run_review_side(
                args,
                side=side,
                input_path=input_path,
                review_path=Path(meta["artifacts"][side]["review"]),
                lifecycle_flag=lifecycle_flag,
            )

    meta = build_metadata(
        batch_name=batch_name,
        experiment_name=experiment_name,
        input_path=input_path,
        existing=load_json_object(meta_path),
        last_action=action,
    )
    if action == "compare" or (
        meta["status"]["baseline"]["ready_for_comparison"] and meta["status"]["enriched"]["ready_for_comparison"]
    ):
        comparison = run_comparison(meta, args.include_item_deltas)
        meta = build_metadata(
            batch_name=batch_name,
            experiment_name=experiment_name,
            input_path=input_path,
            existing=meta,
            last_action="compare" if action == "compare" else action,
        )
        meta["comparison"] = {
            "status": comparison.get("status"),
            "comparison_available": bool(comparison.get("comparison_available")),
            "matched_item_count": (comparison.get("comparison") or {}).get("matched_item_count"),
            "unmatched_item_count": (comparison.get("comparison") or {}).get("unmatched_item_count"),
        }
    write_json_file(meta_path, meta)
    print(json.dumps(meta, indent=2 if args.pretty else None))


if __name__ == "__main__":
    try:
        main()
    except (FileNotFoundError, ValueError, RuntimeError, subprocess.CalledProcessError, json.JSONDecodeError) as exc:
        raise SystemExit(str(exc)) from exc
