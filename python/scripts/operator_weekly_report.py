#!/usr/bin/env python3
import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

from current_admin_common import get_python_dir, get_reports_dir, utc_timestamp, write_json_file


WEEKLY_COMMANDS = [
    {
        "id": "certification",
        "label": "Production certification audit",
        "args": ["scripts/audit_production_certification.py"],
        "artifact": "certification.json",
    },
    {
        "id": "integrity",
        "label": "Policy outcome integrity validation",
        "args": ["scripts/validate_policy_outcome_integrity.py"],
        "artifact": "integrity.json",
    },
    {
        "id": "impact_evaluate",
        "label": "Impact maturation evaluation",
        "args": ["scripts/evaluate_impact_maturation.py", "evaluate"],
        "artifact": "impact_maturation_review.json",
    },
    {
        "id": "impact_promote_dry_run",
        "label": "Impact maturation promotion dry-run",
        "args": [
            "scripts/evaluate_impact_maturation.py",
            "promote",
            "--dry-run",
            "--approve-safe",
        ],
        "artifact": "impact_maturation_promotion_report.json",
    },
    {
        "id": "source_gaps",
        "label": "Source gap audit",
        "args": ["scripts/audit_policy_outcome_source_gaps.py", "--limit", "10"],
        "artifact": "source_gaps.json",
    },
    {
        "id": "intent_gaps",
        "label": "Policy intent gap audit",
        "args": ["scripts/audit_policy_intent_gaps.py", "--limit", "10"],
        "artifact": "intent_gaps.json",
    },
    {
        "id": "final_score",
        "label": "Final Black Impact Score report",
        "args": ["scripts/report_final_black_impact_score.py"],
        "artifact": "final_black_impact_score.json",
    },
]

REVIEW_COMMANDS = [
    {
        "id": "integrity",
        "label": "Policy outcome integrity validation",
        "args": ["scripts/validate_policy_outcome_integrity.py"],
        "artifact": "integrity.json",
    },
    {
        "id": "source_gaps",
        "label": "Source gap audit",
        "args": ["scripts/audit_policy_outcome_source_gaps.py", "--limit", "10"],
        "artifact": "source_gaps.json",
    },
    {
        "id": "intent_gaps",
        "label": "Policy intent gap audit",
        "args": ["scripts/audit_policy_intent_gaps.py", "--limit", "10"],
        "artifact": "intent_gaps.json",
    },
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Low-touch EquityStack operator reports.")
    parser.add_argument("mode", choices=["weekly-run", "review"])
    parser.add_argument("--output", type=Path, help="Machine-readable report output path")
    parser.add_argument("--limit", type=int, default=5, help="Maximum manual tasks to print per queue")
    return parser.parse_args()


def load_json(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text())
    except Exception:
        return {}
    return payload if isinstance(payload, dict) else {}


def pct(value: Any) -> str:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return "n/a"
    return f"{round(numeric * 100)}%"


def count(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def text(value: Any, fallback: str = "n/a") -> str:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return fallback


def output_root(mode: str) -> Path:
    return get_reports_dir() / "operator" / mode / utc_timestamp().replace(":", "").replace("+", "Z")


def default_output(mode: str) -> Path:
    return get_reports_dir() / "operator" / f"{mode}.latest.json"


def run_command(command: dict[str, Any], run_dir: Path, prior_artifacts: dict[str, Path]) -> dict[str, Any]:
    artifact_path = run_dir / command["artifact"]
    args = [sys.executable, *command["args"]]

    if command["id"] == "impact_promote_dry_run":
        input_path = prior_artifacts.get("impact_evaluate")
        if input_path:
            args.extend(["--input", str(input_path)])

    args.extend(["--output", str(artifact_path)])

    result = subprocess.run(
        args,
        cwd=get_python_dir(),
        text=True,
        capture_output=True,
        check=False,
    )
    artifact_exists = artifact_path.exists()
    return {
        "id": command["id"],
        "label": command["label"],
        "ok": result.returncode == 0 and artifact_exists,
        "returncode": result.returncode,
        "artifact": str(artifact_path),
        "stdout": result.stdout.strip()[-4000:],
        "stderr": result.stderr.strip()[-4000:],
    }


def run_commands(commands: list[dict[str, Any]], run_dir: Path) -> dict[str, Any]:
    run_dir.mkdir(parents=True, exist_ok=True)
    results = []
    artifacts = {}
    for command in commands:
        print(f"Running: {command['label']}")
        result = run_command(command, run_dir, artifacts)
        results.append(result)
        artifacts[command["id"]] = Path(result["artifact"])
    return {"results": results, "artifacts": artifacts}


def artifact_payloads(artifacts: dict[str, Path]) -> dict[str, dict[str, Any]]:
    return {key: load_json(path) for key, path in artifacts.items()}


def source_gap_rows(source_report: dict[str, Any], limit: int) -> list[dict[str, Any]]:
    rows = source_report.get("top_missing_source_outcomes")
    return rows[:limit] if isinstance(rows, list) else []


def intent_gap_rows(intent_report: dict[str, Any], limit: int) -> list[dict[str, Any]]:
    rows = intent_report.get("operator_queue")
    return rows[:limit] if isinstance(rows, list) else []


def integrity_warning_names(integrity_report: dict[str, Any]) -> list[str]:
    warnings = integrity_report.get("warnings", {}).get("warnings", [])
    if not isinstance(warnings, list):
        return []
    return [text(item.get("warning")) for item in warnings if isinstance(item, dict)]


def summarize(payloads: dict[str, dict[str, Any]], command_results: list[dict[str, Any]], limit: int) -> dict[str, Any]:
    certification = payloads.get("certification", {})
    integrity = payloads.get("integrity", {})
    source_gaps = payloads.get("source_gaps", {})
    intent_gaps = payloads.get("intent_gaps", {})
    final_score = payloads.get("final_score", {})
    certification_sections = certification.get("sections", {})
    source_section = certification_sections.get("source_coverage_and_confidence_audit", {})
    intent_section = certification_sections.get("policy_intent_coverage_audit", {})
    source_pct = 1 - float(source_section.get("source_bucket_percentages", {}).get("0_sources", 1))
    intent_pct = intent_section.get("classified_policy_pct")
    final_summary = final_score.get("summary", {})
    source_summary = source_gaps.get("summary", {})
    intent_summary = intent_gaps.get("summary", {})
    integrity_summary = integrity.get("summary", {})
    command_failures = [result for result in command_results if not result.get("ok")]
    source_rows = source_gap_rows(source_gaps, limit)
    intent_rows = intent_gap_rows(intent_gaps, limit)
    integrity_violations = count(integrity.get("violations", {}).get("violation_count"))
    integrity_warnings = count(integrity.get("warnings", {}).get("warning_count"))

    top_actions = []
    if command_failures:
        top_actions.append(f"{len(command_failures)} workflow check(s) failed; inspect the weekly artifact before applying anything.")
    if integrity_violations:
        top_actions.append(f"{integrity_violations} integrity violation(s) require correction before public interpretation.")
    if source_rows:
        top_actions.append(f"{len(source_rows)} high-priority outcome(s) still need source curation.")
    if intent_rows:
        top_actions.append(f"{len(intent_rows)} high-impact polic{'y' if len(intent_rows) == 1 else 'ies'} still need intent classification.")
    if integrity_warnings and not integrity_violations:
        top_actions.append("No workflow drift detected; current integrity items are warnings to monitor or curate.")
    if not top_actions:
        top_actions.append("No urgent action needed this week.")

    return {
        "certification": certification.get("data_integrity_status") or "not run",
        "integrity": integrity.get("status") or "not run",
        "command_failure_count": len(command_failures),
        "new_issues_requiring_attention": len(command_failures) + integrity_violations + len(source_rows) + len(intent_rows),
        "top_actions": top_actions[:5],
        "system_summary": {
            "total_policy_outcomes": (
                final_summary.get("policy_outcomes_evaluated")
                or integrity_summary.get("total_policy_outcomes")
                or source_section.get("total_outcomes")
            ),
            "source_coverage": pct(source_pct),
            "intent_coverage": pct(intent_pct),
            "legislative_outcomes": (
                final_summary.get("policy_type_counts", {}).get("legislative")
                or integrity_summary.get("policy_type_distribution", {}).get("legislative")
                or 0
            ),
            "unsourced_outcomes": source_summary.get("missing_source_outcome_count"),
            "unclassified_policies": intent_summary.get("total_unclassified_policies"),
            "score_status": "stable" if not command_failures and not integrity_violations else "needs review",
            "presidents_scored": final_summary.get("presidents_scored"),
        },
        "source_queue": source_rows,
        "intent_queue": intent_rows,
        "integrity_warning_names": integrity_warning_names(integrity),
        "command_failures": command_failures,
    }


def print_weekly_report(report: dict[str, Any]) -> None:
    summary = report["summary"]
    system = summary["system_summary"]
    print("\n=== EquityStack Weekly Report ===\n")
    print(f"Certification: {summary['certification']}")
    print(f"Integrity: {summary['integrity']}")
    print(f"New issues requiring attention: {summary['new_issues_requiring_attention']}")
    print("\nTop actions:")
    for index, action in enumerate(summary["top_actions"], start=1):
        print(f"{index}. {action}")
    print("\nSystem Summary:")
    print(f"- total policy outcomes: {system.get('total_policy_outcomes') or 'n/a'}")
    print(f"- sourced coverage: {system.get('source_coverage')}")
    print(f"- intent coverage: {system.get('intent_coverage')}")
    print(f"- legislative outcomes: {system.get('legislative_outcomes')}")
    print(f"- score status: {system.get('score_status')}")
    print(f"- presidents scored: {system.get('presidents_scored') or 'n/a'}")
    print("\nRecommended next step:")
    if summary["new_issues_requiring_attention"] == 0:
        print("No urgent action needed this week.")
    else:
        print("Run: ./python/bin/equitystack review")
    print(f"\nSaved machine-readable report: {report['output']}")


def print_review_report(report: dict[str, Any], limit: int) -> None:
    summary = report["summary"]
    print("\n=== EquityStack Review Queue ===\n")
    if not summary["source_queue"] and not summary["intent_queue"] and not summary["integrity_warning_names"]:
        print("No urgent action needed right now.")
        print(f"\nSaved machine-readable report: {report['output']}")
        return

    if summary["source_queue"]:
        print("Top unsourced outcomes:")
        for row in summary["source_queue"][:limit]:
            print(
                f"- #{row.get('policy_outcome_id')} | {row.get('policy_title') or 'Untitled'} | "
                f"{row.get('impact_direction') or 'unknown'} | priority {row.get('impact_score')}"
            )
        print("")

    if summary["intent_queue"]:
        print("Top unclassified policy intent items:")
        for row in summary["intent_queue"][:limit]:
            print(
                f"- #{row.get('policy_id')} | {row.get('title') or 'Untitled'} | "
                f"{row.get('year') or 'n/a'} | impact {row.get('impact_score')}"
            )
        print("")

    if summary["integrity_warning_names"]:
        print("Integrity warnings to monitor:")
        for warning in summary["integrity_warning_names"][:limit]:
            print(f"- {warning}")
        print("")

    print("Next commands:")
    print("./python/bin/equitystack impact curate-sources --only-policy-outcome-id <ID> --source-title \"...\" --source-url \"https://...\" --source-type Government --apply --yes")
    print("./python/bin/equitystack impact curate-policy-intent --only-policy-id <ID> --category <category> --summary \"...\" --source-reference \"...\" --apply --yes")
    print(f"\nSaved machine-readable report: {report['output']}")


def build_report(mode: str, limit: int) -> dict[str, Any]:
    run_dir = output_root(mode)
    command_defs = WEEKLY_COMMANDS if mode == "weekly-run" else REVIEW_COMMANDS
    command_state = run_commands(command_defs, run_dir)
    payloads = artifact_payloads(command_state["artifacts"])
    summary = summarize(payloads, command_state["results"], limit)
    return {
        "workflow": f"operator_{mode}",
        "generated_at": utc_timestamp(),
        "mode": "read_only",
        "database_mutated": False,
        "run_dir": str(run_dir),
        "summary": summary,
        "command_results": command_state["results"],
    }


def main() -> None:
    args = parse_args()
    report = build_report(args.mode, args.limit)
    output_path = (args.output or default_output(args.mode)).resolve()
    report["output"] = str(output_path)
    write_json_file(output_path, report)
    if args.mode == "weekly-run":
        print_weekly_report(report)
    else:
        print_review_report(report, args.limit)
    if report["summary"]["command_failure_count"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
