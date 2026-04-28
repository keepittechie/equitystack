#!/usr/bin/env python3
import argparse
from pathlib import Path
from typing import Any

from current_admin_common import (
    VALID_CAMPAIGN_OR_OFFICIAL_VALUES,
    VALID_EVIDENCE_STRENGTHS,
    VALID_IMPACT_DIRECTIONS,
    VALID_PROMISE_TYPES,
    VALID_PROMISE_STATUSES,
    derive_csv_path,
    get_current_admin_batches_dir,
    map_evidence_strength,
    normalize_date,
    normalize_nullable_text,
    read_batch_payload,
    resolve_default_report_path,
    slugify,
    write_csv_rows,
    write_json_file,
    print_json,
)


TOPIC_ALIASES = {
    "criminal justice": "Criminal Justice",
    "economic opportunity": "Economic Opportunity",
    "education": "Education",
    "healthcare": "Healthcare",
    "housing": "Housing",
    "voting rights": "Voting Rights",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Normalize and validate a current-administration Promise Tracker batch."
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=get_current_admin_batches_dir() / "trump_2025_batch_01.json",
        help="Structured current-administration batch JSON",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Normalized batch JSON output. Defaults to python/reports/current_admin/<batch>.normalized.json",
    )
    parser.add_argument(
        "--report",
        type=Path,
        help="Normalization report JSON output. Defaults to python/reports/current_admin/<batch>.normalization-report.json",
    )
    parser.add_argument(
        "--csv",
        nargs="?",
        const="",
        help="Optionally write a CSV summary. Pass a path or omit the value to derive one from --report.",
    )
    return parser.parse_args()


def normalize_topic(value: Any) -> str | None:
    text = normalize_nullable_text(value)
    if not text:
        return None
    return TOPIC_ALIASES.get(text.lower(), text)


def normalize_record(record: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(record)
    normalized["slug"] = slugify(record.get("slug") or record.get("title"))
    normalized["title"] = normalize_nullable_text(record.get("title"))
    normalized["promise_text"] = normalize_nullable_text(record.get("promise_text"))
    normalized["promise_date"] = normalize_date(record.get("promise_date"))
    normalized["promise_type"] = normalize_nullable_text(record.get("promise_type"))
    normalized["campaign_or_official"] = normalize_nullable_text(record.get("campaign_or_official"))
    normalized["topic"] = normalize_topic(record.get("topic"))
    normalized["impacted_group"] = normalize_nullable_text(record.get("impacted_group"))
    normalized["status"] = normalize_nullable_text(record.get("status"))
    normalized["summary"] = normalize_nullable_text(record.get("summary"))
    normalized["notes"] = normalize_nullable_text(record.get("notes"))
    normalized["promise_sources"] = [normalize_source(source) for source in record.get("promise_sources") or []]
    normalized["actions"] = [normalize_action(action) for action in record.get("actions") or []]
    return normalized


def normalize_source(source: dict[str, Any]) -> dict[str, Any]:
    return {
        "source_title": normalize_nullable_text(source.get("source_title")),
        "source_url": normalize_nullable_text(source.get("source_url")),
        "source_type": normalize_nullable_text(source.get("source_type")),
        "publisher": normalize_nullable_text(source.get("publisher")),
        "published_date": normalize_date(source.get("published_date")),
        "notes": normalize_nullable_text(source.get("notes")),
    }


def normalize_action(action: dict[str, Any]) -> dict[str, Any]:
    return {
        "action_type": normalize_nullable_text(action.get("action_type")),
        "action_date": normalize_date(action.get("action_date")),
        "title": normalize_nullable_text(action.get("title")),
        "description": normalize_nullable_text(action.get("description")),
        "action_sources": [normalize_source(source) for source in action.get("action_sources") or []],
        "outcomes": [normalize_outcome(outcome) for outcome in action.get("outcomes") or []],
    }


def normalize_outcome(outcome: dict[str, Any]) -> dict[str, Any]:
    return {
        "outcome_summary": normalize_nullable_text(outcome.get("outcome_summary")),
        "outcome_type": normalize_nullable_text(outcome.get("outcome_type")),
        "measurable_impact": normalize_nullable_text(outcome.get("measurable_impact")),
        "impact_direction": normalize_nullable_text(outcome.get("impact_direction")),
        "black_community_impact_note": normalize_nullable_text(outcome.get("black_community_impact_note")),
        "evidence_strength": map_evidence_strength(outcome.get("evidence_strength")),
        "status_override": normalize_nullable_text(outcome.get("status_override")),
        "outcome_sources": [normalize_source(source) for source in outcome.get("outcome_sources") or []],
    }


def validate_batch(payload: dict[str, Any]) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    seen_slugs: set[str] = set()

    for index, record in enumerate(payload.get("records") or [], start=1):
        slug = record.get("slug")
        if not slug:
            issues.append({"record_index": index, "field": "slug", "issue": "Missing slug"})
        elif slug in seen_slugs:
            issues.append({"record_index": index, "field": "slug", "issue": "Duplicate slug", "value": slug})
        else:
            seen_slugs.add(slug)

        for field in ("title", "promise_text", "promise_date", "promise_type", "campaign_or_official", "status", "summary", "topic"):
            if not record.get(field):
                issues.append({"record_index": index, "field": field, "issue": "Missing required field"})

        if record.get("promise_type") not in VALID_PROMISE_TYPES:
            issues.append({"record_index": index, "field": "promise_type", "issue": "Invalid promise type", "value": record.get("promise_type")})

        if record.get("campaign_or_official") not in VALID_CAMPAIGN_OR_OFFICIAL_VALUES:
            issues.append({
                "record_index": index,
                "field": "campaign_or_official",
                "issue": "Invalid campaign_or_official value",
                "value": record.get("campaign_or_official"),
            })

        if record.get("status") not in VALID_PROMISE_STATUSES:
            issues.append({"record_index": index, "field": "status", "issue": "Invalid status", "value": record.get("status")})

        if not record.get("promise_sources"):
            issues.append({"record_index": index, "field": "promise_sources", "issue": "Missing promise-level source"})

        for action_index, action in enumerate(record.get("actions") or [], start=1):
            if not action.get("action_sources"):
                issues.append({
                    "record_index": index,
                    "action_index": action_index,
                    "field": "action_sources",
                    "issue": "Missing action-level source",
                })

            for outcome_index, outcome in enumerate(action.get("outcomes") or [], start=1):
                if outcome.get("impact_direction") not in VALID_IMPACT_DIRECTIONS:
                    issues.append({
                        "record_index": index,
                        "action_index": action_index,
                        "outcome_index": outcome_index,
                        "field": "impact_direction",
                        "issue": "Invalid impact direction",
                        "value": outcome.get("impact_direction"),
                    })
                if outcome.get("evidence_strength") not in VALID_EVIDENCE_STRENGTHS:
                    issues.append({
                        "record_index": index,
                        "action_index": action_index,
                        "outcome_index": outcome_index,
                        "field": "evidence_strength",
                        "issue": "Invalid evidence strength",
                        "value": outcome.get("evidence_strength"),
                    })
                if not outcome.get("outcome_sources"):
                    issues.append({
                        "record_index": index,
                        "action_index": action_index,
                        "outcome_index": outcome_index,
                        "field": "outcome_sources",
                        "issue": "Missing outcome-level source",
                    })

    return issues


def main() -> None:
    args = parse_args()
    payload = read_batch_payload(args.input)
    normalized_payload = {
        "batch_name": payload.get("batch_name"),
        "president_slug": payload.get("president_slug"),
        "records": [normalize_record(record) for record in payload.get("records") or []],
    }

    issues = validate_batch(normalized_payload)
    output_path = args.output or resolve_default_report_path(normalized_payload["batch_name"], "normalized")
    report_path = args.report or resolve_default_report_path(normalized_payload["batch_name"], "normalization-report")

    report = {
        "batch_name": normalized_payload["batch_name"],
        "source_path": str(args.input),
        "normalized_output_path": str(output_path),
        "record_count": len(normalized_payload["records"]),
        "issue_count": len(issues),
        "issues": issues,
    }

    write_json_file(output_path, normalized_payload)
    write_json_file(report_path, report)

    csv_path = derive_csv_path(args.csv, report_path)
    if csv_path:
        write_csv_rows(csv_path, issues)

    print_json(report)


if __name__ == "__main__":
    main()
