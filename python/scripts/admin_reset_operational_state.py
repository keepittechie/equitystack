#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path


PYTHON_DIR = Path(__file__).resolve().parents[1]
REPORTS_DIR = PYTHON_DIR / "reports"
LOGS_DIR = PYTHON_DIR / "logs"
ARCHIVE_ROOT = REPORTS_DIR / "admin_resets"

TOP_LEVEL_REPORT_GLOBS = (
    "admin_operator_action_history.json",
    "admin_operator_recommendation_feedback.json",
    "equitystack_pipeline_report.json",
    "equitystack_review_bundle.json",
    "equitystack_review_bundle.csv",
    "equitystack_apply_report.json",
    "equitystack_apply_report.csv",
    "equitystack_auto_triage_report.json",
    "equitystack_feedback_analysis.json",
    "equitystack_feedback_log.json",
    "equitystack_rerun_report.json",
    "future_bill_candidate_discovery.json",
    "future_bill_candidate_discovery.csv",
    "future_bill_link_ai_apply_report.json",
    "future_bill_link_ai_apply_report.csv",
    "future_bill_link_ai_review.json",
    "future_bill_link_ai_review.csv",
    "future_bill_link_audit.json",
    "future_bill_link_manual_review_queue.json",
    "future_bill_link_manual_review_queue.csv",
    "future_bill_link_partial_suggestions.json",
    "future_bill_link_partial_suggestions.csv",
    "future_bill_link_review_overrides.json",
    "approved_tracked_bills_seed.json",
    "import_approved_tracked_bills_report.json",
    "tracked_bills_candidate_seed.json",
    "ai_review_*.json",
)

CURRENT_ADMIN_REPORT_GLOBS = (
    "*.json",
    "feedback/*.json",
    "review_decisions/*.json",
)

LOG_GLOBS = ("*.log",)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Archive and reset non-canonical operational EquityStack artifacts so the admin "
            "control surface can be tested from a fresh baseline."
        )
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be archived without moving any files. Default behavior unless --apply --yes is used.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Archive the listed operational artifacts.",
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Required with --apply. Confirms that only operational run-state artifacts should be archived.",
    )
    return parser.parse_args()


def collect_candidates() -> list[Path]:
    candidates: set[Path] = set()

    for pattern in TOP_LEVEL_REPORT_GLOBS:
        candidates.update(path for path in REPORTS_DIR.glob(pattern) if path.is_file())

    current_admin_dir = REPORTS_DIR / "current_admin"
    for pattern in CURRENT_ADMIN_REPORT_GLOBS:
        candidates.update(
            path
            for path in current_admin_dir.glob(pattern)
            if path.is_file() and path.name != "README.md"
        )

    for pattern in LOG_GLOBS:
        candidates.update(path for path in LOGS_DIR.glob(pattern) if path.is_file())

    return sorted(candidates)


def archive_destination(archive_dir: Path, candidate: Path) -> Path:
    relative = candidate.relative_to(PYTHON_DIR)
    return archive_dir / relative


def build_manifest(candidates: list[Path], archive_dir: Path) -> dict[str, object]:
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "python_dir": str(PYTHON_DIR),
        "archive_dir": str(archive_dir),
        "reset_scope": (
            "Operational run-state only: admin operator history, recommendation feedback, "
            "pipeline reports, current-admin report artifacts, legislative report artifacts, and logs."
        ),
        "does_not_touch": (
            "Database content, canonical policy data, source files, and non-operational repository content."
        ),
        "archived_files": [str(path.relative_to(PYTHON_DIR)) for path in candidates],
    }


def main() -> int:
    args = parse_args()
    if args.apply and not args.yes:
        raise SystemExit("--apply requires --yes")

    dry_run = not args.apply or args.dry_run
    candidates = collect_candidates()
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    archive_dir = ARCHIVE_ROOT / timestamp
    manifest = build_manifest(candidates, archive_dir)

    summary = {
        "mode": "dry-run" if dry_run else "apply",
        "archive_dir": str(archive_dir),
        "candidate_count": len(candidates),
        "files": manifest["archived_files"],
        "warning": (
            "This reset archives operational artifacts only. It does not delete database rows or "
            "canonical policy data."
        ),
    }

    print(json.dumps(summary, indent=2))

    if dry_run:
        return 0

    archive_dir.mkdir(parents=True, exist_ok=True)
    for candidate in candidates:
        destination = archive_destination(archive_dir, candidate)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(candidate), str(destination))

    (archive_dir / "reset_manifest.json").write_text(f"{json.dumps(manifest, indent=2)}\n", encoding="utf-8")
    print(f"Archived {len(candidates)} operational artifact(s) to {archive_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
