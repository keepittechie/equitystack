#!/usr/bin/env python3
import argparse
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from current_admin_common import load_json_file, print_json, write_json_file


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Scaffold-only judicial-impact batch importer. Writes are disabled.")
    parser.add_argument("--input", type=Path, required=True, help="Judicial-impact candidate artifact input")
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "reports" / "judicial_impact_import_report.json")
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
        "workflow": "judicial_impact_import",
        "activation_status": "scaffold_only",
        "mode": "blocked_apply" if args.apply else "dry_run",
        "input_artifact": str(args.input.resolve()),
        "candidate_count": len(items),
        "validated_candidates": 0,
        "blocked_candidates": [],
        "write_attempted": False,
        "operator_guidance": "Judicial impact import is scaffold-only. No database writes are enabled in this rollout.",
    }

    for item in items:
        if not isinstance(item, dict):
            continue
        missing = [
            field
            for field in ("majority_justices", "appointing_presidents", "judicial_attribution")
            if not item.get(field)
        ]
        if missing:
            report["blocked_candidates"].append(
                {
                    "candidate_id": item.get("candidate_id"),
                    "title": item.get("title"),
                    "reason": f"missing required attribution metadata: {', '.join(missing)}",
                }
            )
        else:
            report["validated_candidates"] += 1

    output_path = args.output.resolve()
    write_json_file(output_path, report)
    print_json(report)
    if args.apply:
        raise SystemExit("Judicial impact import is scaffold-only. Apply is disabled in this rollout.")


if __name__ == "__main__":
    main()
