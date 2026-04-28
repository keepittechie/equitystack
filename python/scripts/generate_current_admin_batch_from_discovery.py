#!/usr/bin/env python3
import argparse
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from current_admin_common import (
    DEFAULT_DISCOVERY_CAMPAIGN_OR_OFFICIAL,
    DEFAULT_DISCOVERY_PROMISE_TYPE,
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


def derive_debug_output_path(batch_name: str) -> Path:
    return (get_current_admin_reports_dir() / f"{batch_name}.discovery-debug.json").resolve()


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


def merge_source_rows(*groups: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    merged = []
    seen: set[str] = set()
    for group in groups:
        for source in normalize_promise_sources(group):
            dedupe_key = "||".join(
                [
                    normalize_nullable_text(source.get("source_url")) or "",
                    normalize_nullable_text(source.get("source_title")) or "",
                    normalize_nullable_text(source.get("published_date")) or "",
                ]
            )
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            merged.append(source)
    return merged


def first_source_date(source_rows: list[dict[str, Any]]) -> str | None:
    for source in source_rows:
        published = normalize_date(source.get("published_date"))
        if published:
            return published
    return None


def build_action_stub(candidate: dict[str, Any]) -> dict[str, Any] | None:
    item = candidate["item"]
    if item.get("candidate_type") not in {"new_action", "update_existing_action"}:
        return None

    suggested = item.get("suggested_changes") or {}
    feed_item = item.get("feed_item") or {}
    source_rows = normalize_promise_sources(item.get("source_references") or [])
    title = normalize_nullable_text(suggested.get("title")) or normalize_nullable_text(feed_item.get("title"))
    action_type = normalize_nullable_text(suggested.get("action_type"))
    description = (
        normalize_nullable_text(suggested.get("summary"))
        or normalize_nullable_text(feed_item.get("summary"))
        or normalize_nullable_text(item.get("reasoning"))
    )
    action_date = first_source_date(source_rows) or normalize_date(feed_item.get("published_at"))
    if not title and not action_type and not source_rows:
        return None
    return {
        "action_type": action_type,
        "action_date": action_date,
        "title": title,
        "description": description,
        "action_sources": source_rows,
        "outcomes": [],
    }


def merge_action_stubs(action_stubs: list[dict[str, Any] | None]) -> list[dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    for stub in action_stubs:
        if not stub:
            continue
        dedupe_key = "||".join(
            [
                normalize_nullable_text(stub.get("action_type")) or "",
                normalize_nullable_text(stub.get("title")) or "",
                normalize_nullable_text(stub.get("action_date")) or "",
            ]
        )
        existing = merged.get(dedupe_key)
        if existing is None:
            merged[dedupe_key] = {
                "action_type": normalize_nullable_text(stub.get("action_type")),
                "action_date": normalize_date(stub.get("action_date")),
                "title": normalize_nullable_text(stub.get("title")),
                "description": normalize_nullable_text(stub.get("description")),
                "action_sources": normalize_promise_sources(stub.get("action_sources") or []),
                "outcomes": [],
            }
            continue
        existing["action_sources"] = merge_source_rows(
            existing.get("action_sources") or [],
            stub.get("action_sources") or [],
        )
        if not existing.get("description"):
            existing["description"] = normalize_nullable_text(stub.get("description"))
    return sorted(
        merged.values(),
        key=lambda action: (
            normalize_date(action.get("action_date")) or "",
            normalize_nullable_text(action.get("title")) or "",
        ),
        reverse=True,
    )


def candidate_snapshot(candidate: dict[str, Any]) -> dict[str, Any]:
    item = candidate["item"]
    linked = item.get("linked_promise") or {}
    return {
        "candidate_id": candidate["candidate_id"],
        "candidate_number": candidate["candidate_number"],
        "source_section": candidate["section"],
        "candidate_type": item.get("candidate_type"),
        "suggested_relationship": item.get("suggested_relationship"),
        "linked_promise_slug": linked.get("slug"),
        "reasoning": item.get("reasoning"),
        "confidence": item.get("confidence"),
        "matched_keywords": item.get("matched_keywords") or [],
        "source_category": item.get("source_category"),
        "source_references": item.get("source_references") or [],
        "suggested_changes": item.get("suggested_changes") or {},
        "feed_item": item.get("feed_item"),
    }


def build_existing_record(grouped_candidates: list[dict[str, Any]], president_slug: str) -> dict[str, Any]:
    first_item = grouped_candidates[0]["item"]
    linked = first_item.get("linked_promise") or {}
    summary = normalize_nullable_text(linked.get("summary")) or normalize_nullable_text(first_item.get("reasoning")) or normalize_nullable_text(linked.get("title"))
    title = normalize_nullable_text(linked.get("title")) or normalize_nullable_text(linked.get("slug")) or "Untitled current-admin record"
    discovered_source_rows = merge_source_rows(
        *[(candidate["item"].get("source_references") or []) for candidate in grouped_candidates]
    )
    actions = merge_action_stubs([build_action_stub(candidate) for candidate in grouped_candidates])
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
        "promise_sources": merge_source_rows(linked.get("promise_sources") or [], discovered_source_rows),
        "actions": actions,
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
            "preserved_discovery_sources": discovered_source_rows,
            "preserved_action_count": len(actions),
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
    source_refs = merge_source_rows(item.get("source_references") or [])
    title = normalize_nullable_text(suggested.get("title")) or normalize_nullable_text((item.get("feed_item") or {}).get("title")) or f"Discovery candidate {candidate['candidate_id']}"
    summary = normalize_nullable_text(suggested.get("summary")) or normalize_nullable_text(item.get("reasoning")) or title
    return {
        "slug": slugify(title),
        "title": title,
        "promise_text": summary,
        "promise_date": first_published_date(candidate, report_generated_at),
        # Discovery sources for this pipeline are current-administration sources, so
        # unmatched new records default to official promises unless an operator changes them later.
        "promise_type": DEFAULT_DISCOVERY_PROMISE_TYPE,
        "campaign_or_official": DEFAULT_DISCOVERY_CAMPAIGN_OR_OFFICIAL,
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


def select_candidates(args: argparse.Namespace, report: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    indexed = indexed_candidates(report)
    if args.all_candidates:
        return indexed, indexed
    require_selection(args)
    return indexed, [candidate for candidate in indexed if matches_filters(candidate, args)]


def build_batch_payload(
    report: dict[str, Any],
    selected: list[dict[str, Any]],
    batch_name: str,
    output_path: Path,
) -> tuple[dict[str, Any], dict[str, Any]]:
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

    payload = {
        "batch_name": batch_name,
        "president_slug": president_slug,
        "records": records,
        "generation_context": {
            "generated_at": datetime.now(UTC).replace(microsecond=0).isoformat(),
            "source_discovery_report_path": None,
            "output_path": str(output_path),
        },
    }
    grouped_existing_record_count = len(existing_by_slug)
    selected_existing_candidate_count = sum(len(group) for group in existing_by_slug.values())
    merged_existing_candidate_count = sum(max(len(group) - 1, 0) for group in existing_by_slug.values())
    generation_debug = {
        "selected_existing_candidate_count": selected_existing_candidate_count,
        "selected_new_promise_candidate_count": len(new_candidates),
        "grouped_existing_record_count": grouped_existing_record_count,
        "merged_existing_candidate_count": merged_existing_candidate_count,
        "dedupe_match_key": "linked_promise_slug",
        "group_sizes_by_linked_promise_slug": {
            slug: len(grouped_candidates)
            for slug, grouped_candidates in sorted(existing_by_slug.items())
        },
    }
    return payload, generation_debug


def count_by_section(candidates: list[dict[str, Any]]) -> dict[str, int]:
    counts: Counter[str] = Counter()
    for candidate in candidates:
        counts[candidate.get("section") or "unknown"] += 1
    return dict(sorted(counts.items()))


def count_by_candidate_type(candidates: list[dict[str, Any]]) -> dict[str, int]:
    counts: Counter[str] = Counter()
    for candidate in candidates:
        candidate_type = normalize_nullable_text((candidate.get("item") or {}).get("candidate_type")) or "unknown"
        counts[candidate_type] += 1
    return dict(sorted(counts.items()))


def build_generation_debug_report(
    *,
    args: argparse.Namespace,
    input_path: Path,
    raw_candidates: list[dict[str, Any]],
    selected: list[dict[str, Any]],
    payload: dict[str, Any] | None,
    generation_debug: dict[str, Any] | None,
    output_path: Path,
    debug_output_path: Path,
    batch_name: str,
    status: str,
) -> dict[str, Any]:
    skipped_count = max(len(raw_candidates) - len(selected), 0)
    return {
        "generated_at": datetime.now(UTC).replace(microsecond=0).isoformat(),
        "status": status,
        "batch_name": batch_name,
        "source_discovery_report_path": str(input_path),
        "output_path": str(output_path),
        "debug_output_path": str(debug_output_path),
        "selection_filters": {
            "candidate_ids": args.candidate_id or [],
            "candidate_types": args.candidate_type or [],
            "linked_promise_slugs": args.linked_promise_slug or [],
            "all_new_promises": args.all_new_promises,
            "all_new_actions": args.all_new_actions,
            "all_candidates": args.all_candidates,
        },
        "raw_candidate_count": len(raw_candidates),
        "raw_candidate_counts_by_section": count_by_section(raw_candidates),
        "raw_candidate_type_counts": count_by_candidate_type(raw_candidates),
        "selected_candidate_count": len(selected),
        "selected_candidate_counts_by_section": count_by_section(selected),
        "selected_candidate_type_counts": count_by_candidate_type(selected),
        "skipped_candidate_count": skipped_count,
        "skip_reason_counts": {"unselected_by_filters": skipped_count} if skipped_count else {},
        "date_filter_applied": "not_applied_in_batch_generation",
        "keyword_category_filter_result": "not_applied_in_batch_generation",
        "action_type_filter_result": "not_applied_in_batch_generation",
        "dedupe_match_key": "linked_promise_slug",
        "grouping": generation_debug or {},
        "final_batch_count": len((payload or {}).get("records") or []),
        "selected_candidate_ids": [candidate["candidate_id"] for candidate in selected],
    }


def main() -> None:
    args = parse_args()
    input_path = args.input.resolve()
    report = load_discovery_report(input_path)
    raw_candidates, selected = select_candidates(args, report)

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
    debug_output_path = derive_debug_output_path(batch_name)

    if not selected:
        debug_report = build_generation_debug_report(
            args=args,
            input_path=input_path,
            raw_candidates=raw_candidates,
            selected=selected,
            payload=None,
            generation_debug=None,
            output_path=output_path,
            debug_output_path=debug_output_path,
            batch_name=batch_name,
            status="no_candidates_selected",
        )
        write_json_file(debug_output_path, debug_report)
        raise SystemExit("No discovery candidates matched the requested filters")

    if output_path.exists() and not args.allow_overwrite:
        raise SystemExit(f"Output already exists: {output_path}. Use --allow-overwrite to replace it.")

    payload, generation_debug = build_batch_payload(report, selected, batch_name, output_path)
    payload["generation_context"] = {
        "generated_at": datetime.now(UTC).replace(microsecond=0).isoformat(),
        "source_discovery_report_path": str(input_path),
        "selected_candidate_ids": [candidate["candidate_id"] for candidate in selected],
        "selected_count": len(selected),
        "debug_report_path": str(debug_output_path),
    }
    debug_report = build_generation_debug_report(
        args=args,
        input_path=input_path,
        raw_candidates=raw_candidates,
        selected=selected,
        payload=payload,
        generation_debug=generation_debug,
        output_path=output_path,
        debug_output_path=debug_output_path,
        batch_name=batch_name,
        status="success",
    )
    write_json_file(debug_output_path, debug_report)
    write_json_file(output_path, payload)

    print_json(
        {
            "output_path": str(output_path),
            "debug_output_path": str(debug_output_path),
            "batch_name": batch_name,
            "selected_count": len(selected),
            "record_count": len(payload["records"]),
            "selected_candidate_ids": payload["generation_context"]["selected_candidate_ids"],
        }
    )


if __name__ == "__main__":
    main()
