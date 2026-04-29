#!/usr/bin/env python3
import argparse
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from current_admin_common import derive_csv_path, normalize_nullable_text, print_json, write_csv_rows, write_json_file
from current_admin_outcome_evidence_common import outcome_evidence_index
from discover_current_admin_outcome_evidence import load_input_records


def default_output_path() -> Path:
    return Path(__file__).resolve().parents[1] / "reports" / "current-admin-policy-outcome-enrichment-preview.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Preview hypothetical current-admin policy_outcomes enrichment from supplemental outcome evidence."
    )
    parser.add_argument("--input", type=Path, action="append", help="Current-admin batch or queue artifact to inspect. May be repeated.")
    parser.add_argument(
        "--outcome-evidence",
        type=Path,
        action="append",
        required=True,
        help="Outcome-evidence artifact(s) to summarize.",
    )
    parser.add_argument("--output", type=Path, default=default_output_path(), help="Preview report output path")
    parser.add_argument(
        "--csv",
        nargs="?",
        const="",
        help="Optionally write a CSV summary. Pass a path or omit the value to derive one from --output.",
    )
    return parser.parse_args()


def current_timestamp() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


def projected_source_quality(item: dict[str, Any]) -> str:
    outcome_count = int(item.get("outcome_evidence_count") or 0)
    implementation_count = int(item.get("implementation_evidence_count") or 0)
    if outcome_count > 0:
        return "high"
    if implementation_count > 0:
        return "medium"
    return "unchanged"


def build_preview_item(record: dict[str, Any], evidence_item: dict[str, Any] | None) -> dict[str, Any]:
    if not evidence_item:
        return {
            "record_key": record.get("record_key"),
            "slug": record.get("slug"),
            "title": record.get("title"),
            "previous_impact_status": record.get("impact_status"),
            "activation_status": "dry_run_report_only",
            "supplemental_evidence_present": False,
            "projected_source_quality": "unchanged",
            "projected_confidence_score": None,
            "projected_effect": "no supplemental outcome-evidence artifact matched this record",
        }

    implementation_count = int(evidence_item.get("implementation_evidence_count") or 0)
    outcome_count = int(evidence_item.get("outcome_evidence_count") or 0)
    source_context_count = int(evidence_item.get("source_context_count") or 0)
    legal_context_count = int(evidence_item.get("legal_context_count") or 0)
    matched_count = len(evidence_item.get("matched_evidence_items") or [])
    supplemental_present = any(
        count > 0 for count in (implementation_count, outcome_count, source_context_count, legal_context_count, matched_count)
    )
    best_confidence = evidence_item.get("best_confidence_score")
    return {
        "record_key": record.get("record_key"),
        "slug": record.get("slug"),
        "title": record.get("title"),
        "previous_impact_status": record.get("impact_status"),
        "activation_status": "dry_run_report_only",
        "supplemental_evidence_present": supplemental_present,
        "implementation_evidence_count": implementation_count,
        "outcome_evidence_count": outcome_count,
        "source_context_count": source_context_count,
        "legal_context_count": legal_context_count,
        "projected_source_quality": projected_source_quality(evidence_item),
        "projected_confidence_score": best_confidence,
        "projected_effect": (
            "supplemental evidence could justify future unified outcome enrichment, but this rollout keeps enrichment report-only"
            if supplemental_present
            else "an outcome-evidence artifact matched this record, but it did not produce implementation or outcome evidence yet"
        ),
        "recommended_next_action": evidence_item.get("recommended_next_action"),
    }


def build_csv_rows(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "record_key": item.get("record_key"),
            "slug": item.get("slug"),
            "title": item.get("title"),
            "previous_impact_status": item.get("previous_impact_status"),
            "supplemental_evidence_present": item.get("supplemental_evidence_present"),
            "implementation_evidence_count": item.get("implementation_evidence_count"),
            "outcome_evidence_count": item.get("outcome_evidence_count"),
            "projected_source_quality": item.get("projected_source_quality"),
            "projected_confidence_score": item.get("projected_confidence_score"),
            "recommended_next_action": item.get("recommended_next_action"),
            "projected_effect": item.get("projected_effect"),
        }
        for item in items
    ]


def main() -> None:
    args = parse_args()
    input_paths = [path.resolve() for path in args.input] if args.input else []
    _, _, records, skipped_inputs = load_input_records(input_paths, include_all_statuses=True)
    evidence_index = outcome_evidence_index([path.resolve() for path in args.outcome_evidence])

    items = []
    for record in records:
        evidence_item = None
        for key in (
            record.get("record_key"),
            record.get("slug"),
            normalize_nullable_text(((record.get("record") or {}).get("title"))),
        ):
            if key and key in evidence_index:
                evidence_item = evidence_index[key]
                break
        items.append(build_preview_item(record, evidence_item))

    output = {
        "artifact_version": 1,
        "generated_at": current_timestamp(),
        "workflow": "current_admin_policy_outcome_enrichment_preview",
        "activation_status": "dry_run_report_only",
        "inputs": [str(path) for path in input_paths],
        "outcome_evidence_inputs": [str(path.resolve()) for path in args.outcome_evidence],
        "summary": {
            "records_scanned": len(records),
            "records_with_supplemental_evidence": sum(bool(item.get("supplemental_evidence_present")) for item in items),
            "records_with_outcome_evidence": sum(int(item.get("outcome_evidence_count") or 0) > 0 for item in items),
        },
        "skipped_inputs": skipped_inputs,
        "items": items,
        "operator_guidance": "This preview is report-only. It does not write to promise_outcomes or policy_outcomes.",
    }
    output_path = args.output.resolve()
    write_json_file(output_path, output)
    csv_path = derive_csv_path(args.csv, output_path)
    if csv_path:
        write_csv_rows(csv_path, build_csv_rows(items))
    print_json(output)


if __name__ == "__main__":
    main()
