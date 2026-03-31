#!/usr/bin/env python3
import argparse
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from current_admin_common import (
    get_current_admin_batches_dir,
    get_current_admin_reports_dir,
    normalize_date,
    normalize_nullable_text,
    print_json,
    slugify,
    write_json_file,
)
from export_current_admin_discovery_candidates import (
    indexed_candidates,
    load_discovery_report,
    matches_filters,
    require_selection,
)


DEFAULT_DISCOVERY_PATH = get_current_admin_reports_dir() / "discovery_report.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a canonical current-admin review batch from a discovery report."
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_DISCOVERY_PATH,
        help="Current-administration discovery report JSON",
    )
    parser.add_argument("--candidate-id", action="append", help="Include one or more candidate ids like update_candidates:2")
    parser.add_argument("--candidate-type", action="append", help="Include one or more candidate_type values")
    parser.add_argument("--linked-promise-slug", action="append", help="Include candidates tied to one or more linked promise slugs")
    parser.add_argument("--all-new-promises", action="store_true", help="Include all new_promise_candidate items")
    parser.add_argument("--all-new-actions", action="store_true", help="Include all new_action candidate items")
    parser.add_argument("--all-candidates", action="store_true", help="Include every discovery candidate in the report")
    parser.add_argument("--batch-name", help="Canonical batch_name to write into the output")
    parser.add_argument("--output-name", help="Batch filename without path. .json will be added if omitted.")
    parser.add_argument("--output", type=Path, help="Full output path. Defaults to python/data/current_admin_batches/")
    parser.add_argument("--allow-overwrite", action="store_true", help="Allow replacing an existing output file")
    return parser.parse_args()


def derive_output_path(args: argparse.Namespace, batch_name: str) -> Path:
    if args.output:
        return args.output.resolve()
    if args.output_name:
        filename = args.output_name
        if not filename.endswith(".json"):
            filename = f"{filename}.json"
        return (get_current_admin_batches_dir() / filename).resolve()
    filename = f"{batch_name}.json"
    return (get_current_admin_batches_dir() / filename).resolve()


def normalize_promise_sources(values: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    rows = []
    for source in values or []:
        if not isinstance(source, dict):
            continue
        rows.append(
            {
                "source_title": normalize_nullable_text(source.get("source_title")),
                "source_url": normalize_nullable_text(source.get("source_url")),
                "source_type": normalize_nullable_text(source.get("source_type")),
                "publisher": normalize_nullable_text(source.get("publisher")),
                "published_date": normalize_date(source.get("published_date")),
                "notes": normalize_nullable_text(source.get("notes")),
            }
        )
    return rows


def candidate_snapshot(candidate: dict[str, Any]) -> dict[str, Any]:
    item = candidate["item"]
    linked = item.get("linked_promise") or {}
    return {
        "candidate_id": candidate["candidate_id"],
        "candidate_number": candidate["candidate_number"],
        "source_section": candidate["section"],
        "candidate_type": item.get("candidate_type"),
        "linked_promise_slug": linked.get("slug"),
        "reasoning": item.get("reasoning"),
        "confidence": item.get("confidence"),
        "source_references": item.get("source_references") or [],
        "suggested_changes": item.get("suggested_changes") or {},
        "feed_item": item.get("feed_item"),
    }


def build_existing_record(grouped_candidates: list[dict[str, Any]], president_slug: str) -> dict[str, Any]:
    first_item = grouped_candidates[0]["item"]
    linked = first_item.get("linked_promise") or {}
    summary = normalize_nullable_text(linked.get("summary")) or normalize_nullable_text(first_item.get("reasoning")) or normalize_nullable_text(linked.get("title"))
    title = normalize_nullable_text(linked.get("title")) or normalize_nullable_text(linked.get("slug")) or "Untitled current-admin record"
    return {
        "slug": normalize_nullable_text(linked.get("slug")) or slugify(title),
        "title": title,
        "promise_text": normalize_nullable_text(linked.get("promise_text")) or summary or title,
        "promise_date": normalize_date(linked.get("promise_date")) or normalize_date(linked.get("latest_action_date")),
        "promise_type": normalize_nullable_text(linked.get("promise_type")),
        "campaign_or_official": normalize_nullable_text(linked.get("campaign_or_official")),
        "topic": normalize_nullable_text(linked.get("topic")),
        "impacted_group": normalize_nullable_text(linked.get("impacted_group")),
        "status": normalize_nullable_text(linked.get("status")) or "In Progress",
        "summary": summary,
        "notes": normalize_nullable_text(linked.get("notes")),
        "promise_sources": normalize_promise_sources(linked.get("promise_sources") or []),
        "actions": [],
        "discovery_context": {
            "generated_at": datetime.now(UTC).replace(microsecond=0).isoformat(),
            "president_slug": president_slug,
            "linked_promise_snapshot": {
                "id": linked.get("id"),
                "slug": linked.get("slug"),
                "title": linked.get("title"),
                "status": linked.get("status"),
                "topic": linked.get("topic"),
                "summary": linked.get("summary"),
                "promise_date": linked.get("promise_date"),
                "latest_action_date": linked.get("latest_action_date"),
                "action_count": linked.get("action_count"),
                "outcome_count": linked.get("outcome_count"),
                "promise_source_count": linked.get("promise_source_count"),
            },
            "selected_candidates": [candidate_snapshot(candidate) for candidate in grouped_candidates],
        },
    }


def first_published_date(candidate: dict[str, Any], report_generated_at: str | None) -> str | None:
    source_refs = candidate["item"].get("source_references") or []
    for source in source_refs:
        published = normalize_date(source.get("published_date"))
        if published:
            return published
    return normalize_date(report_generated_at)


def build_new_promise_record(candidate: dict[str, Any], president_slug: str, report_generated_at: str | None) -> dict[str, Any]:
    item = candidate["item"]
    suggested = item.get("suggested_changes") or {}
    source_refs = normalize_promise_sources(item.get("source_references") or [])
    title = normalize_nullable_text(suggested.get("title")) or normalize_nullable_text((item.get("feed_item") or {}).get("title")) or f"Discovery candidate {candidate['candidate_id']}"
    summary = normalize_nullable_text(suggested.get("summary")) or normalize_nullable_text(item.get("reasoning")) or title
    return {
        "slug": slugify(title),
        "title": title,
        "promise_text": summary,
        "promise_date": first_published_date(candidate, report_generated_at),
        "promise_type": None,
        "campaign_or_official": None,
        "topic": normalize_nullable_text(suggested.get("topic")),
        "impacted_group": normalize_nullable_text(suggested.get("impacted_group")),
        "status": normalize_nullable_text(suggested.get("status")) or "In Progress",
        "summary": summary,
        "notes": None,
        "promise_sources": source_refs,
        "actions": [],
        "discovery_context": {
            "generated_at": datetime.now(UTC).replace(microsecond=0).isoformat(),
            "president_slug": president_slug,
            "selected_candidates": [candidate_snapshot(candidate)],
        },
    }


def select_candidates(args: argparse.Namespace, report: dict[str, Any]) -> list[dict[str, Any]]:
    if not args.all_candidates:
        require_selection(args)
    indexed = indexed_candidates(report)
    if args.all_candidates:
        return indexed
    return [candidate for candidate in indexed if matches_filters(candidate, args)]


def build_batch_payload(report: dict[str, Any], selected: list[dict[str, Any]], batch_name: str, output_path: Path) -> dict[str, Any]:
    president_slug = normalize_nullable_text(report.get("president_slug")) or "current-admin"
    existing_by_slug: dict[str, list[dict[str, Any]]] = {}
    new_candidates: list[dict[str, Any]] = []

    for candidate in selected:
        item = candidate["item"]
        linked = item.get("linked_promise") or {}
        linked_slug = normalize_nullable_text(linked.get("slug"))
        if item.get("candidate_type") == "new_promise_candidate" or not linked_slug:
            new_candidates.append(candidate)
            continue
        existing_by_slug.setdefault(linked_slug, []).append(candidate)

    records = [
        build_existing_record(existing_by_slug[slug], president_slug)
        for slug in sorted(existing_by_slug)
    ]
    records.extend(
        build_new_promise_record(candidate, president_slug, report.get("generated_at"))
        for candidate in new_candidates
    )

    return {
        "batch_name": batch_name,
        "president_slug": president_slug,
        "records": records,
        "generation_context": {
            "generated_at": datetime.now(UTC).replace(microsecond=0).isoformat(),
            "source_discovery_report_path": None,
            "output_path": str(output_path),
        },
    }


def main() -> None:
    args = parse_args()
    input_path = args.input.resolve()
    report = load_discovery_report(input_path)
    selected = select_candidates(args, report)
    if not selected:
        raise SystemExit("No discovery candidates matched the requested filters")

    if args.batch_name:
        batch_name = slugify(args.batch_name)
    elif args.output_name:
        batch_name = slugify(Path(args.output_name).stem)
    elif args.output:
        batch_name = slugify(args.output.stem)
    else:
        president_slug = normalize_nullable_text(report.get("president_slug")) or "current-admin"
        timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ").lower()
        batch_name = f"{president_slug}-discovery-{timestamp}"

    output_path = derive_output_path(args, batch_name)
    if output_path.exists() and not args.allow_overwrite:
        raise SystemExit(f"Output already exists: {output_path}. Use --allow-overwrite to replace it.")

    payload = build_batch_payload(report, selected, batch_name, output_path)
    payload["generation_context"] = {
        "generated_at": datetime.now(UTC).replace(microsecond=0).isoformat(),
        "source_discovery_report_path": str(input_path),
        "selected_candidate_ids": [candidate["candidate_id"] for candidate in selected],
        "selected_count": len(selected),
    }
    write_json_file(output_path, payload)

    print_json(
        {
            "output_path": str(output_path),
            "batch_name": batch_name,
            "selected_count": len(selected),
            "record_count": len(payload["records"]),
            "selected_candidate_ids": payload["generation_context"]["selected_candidate_ids"],
        }
    )


if __name__ == "__main__":
    main()
