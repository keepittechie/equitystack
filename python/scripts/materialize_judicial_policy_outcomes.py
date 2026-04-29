#!/usr/bin/env python3
import argparse
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from current_admin_common import load_json_file, print_json, write_json_file


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Scaffold-only judicial policy-outcome materialization preview. Writes are disabled.")
    parser.add_argument("--input", type=Path, required=True, help="Judicial-impact batch or import artifact")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "reports" / "judicial_policy_outcomes_materialize_report.json",
    )
    parser.add_argument("--apply", action="store_true", help="Reserved for future activation; currently blocked")
    parser.add_argument("--yes", action="store_true", help="Reserved for future activation; currently blocked")
    return parser.parse_args()


def current_timestamp() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


def main() -> None:
    args = parse_args()
    payload = load_json_file(args.input.resolve())
    items = payload.get("items") or [] if isinstance(payload, dict) else []
    report: dict[str, Any] = {
        "artifact_version": 1,
        "generated_at": current_timestamp(),
        "workflow": "judicial_policy_outcome_materialization",
        "activation_status": "scaffold_only",
        "mode": "blocked_apply" if args.apply else "dry_run",
        "input_artifact": str(args.input.resolve()),
        "candidate_count": len(items),
        "materialization_ready_count": 0,
        "blocked_items": [],
        "write_attempted": False,
        "operator_guidance": "Judicial policy_outcomes materialization remains scaffold-only. No scoring or writes are enabled.",
    }

    for item in items:
        if not isinstance(item, dict):
            continue
        ready = bool(item.get("majority_justices")) and bool(item.get("appointing_presidents")) and bool(item.get("judicial_attribution"))
        if ready:
            report["materialization_ready_count"] += 1
        else:
            report["blocked_items"].append(
                {
                    "candidate_id": item.get("candidate_id"),
                    "title": item.get("title"),
                    "reason": "missing attribution metadata required before any future judicial scoring activation",
                }
            )

    output_path = args.output.resolve()
    write_json_file(output_path, report)
    print_json(report)
    if args.apply:
        raise SystemExit("Judicial policy-outcome materialization is scaffold-only. Apply is disabled in this rollout.")


if __name__ == "__main__":
    main()
