#!/usr/bin/env python3
import argparse
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from current_admin_common import (
    DEFAULT_DISCOVERY_CAMPAIGN_OR_OFFICIAL,
    DEFAULT_DISCOVERY_PROMISE_TYPE,
    get_current_admin_batches_dir,
    get_current_admin_reports_dir,
    load_json_file,
    normalize_nullable_text,
    normalize_text,
    slugify,
    write_json_file,
    print_json,
)


DEFAULT_DISCOVERY_PATH = get_current_admin_reports_dir() / "discovery_report.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export selected current-administration discovery suggestions into a draft batch JSON."
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_DISCOVERY_PATH,
        help="Current-administration discovery report JSON",
    )
    parser.add_argument("--candidate-id", action="append", help="Export one or more candidate ids like update_candidates:2")
    parser.add_argument("--candidate-type", action="append", help="Export one or more candidate_type values")
    parser.add_argument("--linked-promise-slug", action="append", help="Export candidates tied to one or more linked promise slugs")
    parser.add_argument("--all-new-promises", action="store_true", help="Export all new_promise_candidate items")
    parser.add_argument("--all-new-actions", action="store_true", help="Export all new_action candidate items")
    parser.add_argument("--output-name", help="Draft batch filename without path. .json will be added if omitted.")
    parser.add_argument("--output", type=Path, help="Full output path. Defaults to python/data/current_admin_batches/")
    parser.add_argument("--allow-overwrite", action="store_true", help="Allow replacing an existing output file")
    return parser.parse_args()


def load_discovery_report(path: Path) -> dict[str, Any]:
    payload = load_json_file(path)
    if not isinstance(payload, dict):
        raise ValueError("Discovery report must be a JSON object")
    for field in ("new_action_candidates", "update_candidates", "new_promise_candidates"):
        if not isinstance(payload.get(field), list):
            raise ValueError(f"Discovery report missing expected list: {field}")
    return payload


def indexed_candidates(report: dict[str, Any]) -> list[dict[str, Any]]:
    indexed = []
    sections = ("new_action_candidates", "update_candidates", "new_promise_candidates")
    global_index = 1
    for section in sections:
        for section_index, item in enumerate(report.get(section) or [], start=1):
            indexed.append(
                {
                    "candidate_id": f"{section}:{section_index}",
                    "candidate_number": global_index,
                    "section": section,
                    "item": item,
                }
            )
            global_index += 1
    return indexed


def require_selection(args: argparse.Namespace) -> None:
    if any(
        [
            args.candidate_id,
            args.candidate_type,
            args.linked_promise_slug,
            args.all_new_promises,
            args.all_new_actions,
        ]
    ):
        return
    raise SystemExit(
        "Select at least one export filter: --candidate-id, --candidate-type, --linked-promise-slug, --all-new-promises, or --all-new-actions"
    )


def matches_filters(candidate: dict[str, Any], args: argparse.Namespace) -> bool:
    item = candidate["item"]
    linked = item.get("linked_promise") or {}
    if args.candidate_id and candidate["candidate_id"] in set(args.candidate_id):
        return True
    if args.candidate_type and normalize_nullable_text(item.get("candidate_type")) in set(args.candidate_type):
        return True
    if args.linked_promise_slug and normalize_nullable_text(linked.get("slug")) in set(args.linked_promise_slug):
        return True
    if args.all_new_promises and candidate["section"] == "new_promise_candidates":
        return True
    if args.all_new_actions and candidate["section"] == "new_action_candidates":
        return True
    return False


def derive_output_path(args: argparse.Namespace, report: dict[str, Any], selected: list[dict[str, Any]]) -> Path:
    if args.output:
        return args.output.resolve()

    if args.output_name:
        filename = args.output_name
        if not filename.endswith(".json"):
            filename = f"{filename}.json"
        return (get_current_admin_batches_dir() / filename).resolve()

    base_slug = report.get("president_slug") or "current-admin"
    selection_hint = "selection"
    if len(selected) == 1:
        selection_hint = slugify(selected[0]["item"].get("candidate_type") or selected[0]["section"])
    elif args.all_new_promises:
        selection_hint = "new-promise-candidates"
    elif args.all_new_actions:
        selection_hint = "new-action-candidates"
    elif args.linked_promise_slug:
        selection_hint = slugify(args.linked_promise_slug[0])
    timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    filename = f"{base_slug}-{selection_hint}-draft-{timestamp}.json"
    return (get_current_admin_batches_dir() / filename).resolve()


def make_draft_entry(candidate: dict[str, Any]) -> dict[str, Any]:
    item = candidate["item"]
    suggested = item.get("suggested_changes") or {}
    linked = item.get("linked_promise") or None
    source_refs = item.get("source_references") or []
    title = normalize_nullable_text(suggested.get("title"))
    summary = normalize_nullable_text(suggested.get("summary"))
    topic = normalize_nullable_text(suggested.get("topic"))

    if item.get("candidate_type") == "new_promise_candidate":
        return {
            "draft_mode": "new_promise_candidate",
            "record": {
                "slug": slugify(title or f"draft-{candidate['candidate_id']}"),
                "title": title,
                "promise_text": summary,
                "promise_date": None,
                "promise_type": DEFAULT_DISCOVERY_PROMISE_TYPE,
                "campaign_or_official": DEFAULT_DISCOVERY_CAMPAIGN_OR_OFFICIAL,
                "topic": topic,
                "impacted_group": None,
                "status": "In Progress",
                "summary": summary,
                "notes": normalize_text(item.get("reasoning")),
                "promise_sources": source_refs,
                "actions": [],
            },
        }

    return {
        "draft_mode": "update_existing_promise",
        "linked_promise_slug": linked.get("slug") if linked else None,
        "linked_promise_title": linked.get("title") if linked else None,
        "suggested_update": {
            "candidate_type": item.get("candidate_type"),
            "topic": topic or (linked.get("topic") if linked else None),
            "status": linked.get("status") if linked else None,
            "summary": summary,
            "reasoning": normalize_text(item.get("reasoning")),
            "source_references": source_refs,
            "action_stub": {
                "action_type": None,
                "action_date": None,
                "title": title,
                "description": summary,
                "action_sources": source_refs,
                "outcomes": [],
            },
        },
    }


def build_export_payload(
    report: dict[str, Any],
    input_path: Path,
    selected: list[dict[str, Any]],
    output_path: Path,
    args: argparse.Namespace,
) -> dict[str, Any]:
    export_mode = {
        "candidate_ids": args.candidate_id or [],
        "candidate_types": args.candidate_type or [],
        "linked_promise_slugs": args.linked_promise_slug or [],
        "all_new_promises": args.all_new_promises,
        "all_new_actions": args.all_new_actions,
    }
    return {
        "draft_kind": "draft_current_admin_batch",
        "review_required": True,
        "not_ready_for_direct_import": True,
        "generated_at": datetime.now(UTC).replace(microsecond=0).isoformat(),
        "source_discovery_report_path": str(input_path.resolve()),
        "output_path": str(output_path),
        "president_slug": report.get("president_slug"),
        "export_mode": export_mode,
        "operator_notes": [
            "This file is a draft starter batch exported from discovery suggestions.",
            "Edit this draft into a curated batch before running normalization, AI review, manual queue, import, and validation.",
            "Do not import this draft file directly.",
        ],
        "items": [
            {
                "candidate_id": candidate["candidate_id"],
                "candidate_number": candidate["candidate_number"],
                "source_section": candidate["section"],
                "candidate_type": candidate["item"].get("candidate_type"),
                "linked_promise": candidate["item"].get("linked_promise"),
                "suggested_fields": candidate["item"].get("suggested_changes"),
                "reasoning": candidate["item"].get("reasoning"),
                "confidence": candidate["item"].get("confidence"),
                "caution_flags": candidate["item"].get("caution_flags") or [],
                "source_references": candidate["item"].get("source_references") or [],
                "feed_item": candidate["item"].get("feed_item"),
                "draft_entry": make_draft_entry(candidate),
            }
            for candidate in selected
        ],
    }


def main() -> None:
    args = parse_args()
    require_selection(args)
    input_path = args.input.resolve()
    report = load_discovery_report(input_path)
    indexed = indexed_candidates(report)
    selected = [candidate for candidate in indexed if matches_filters(candidate, args)]

    if not selected:
        raise SystemExit("No discovery candidates matched the requested filters")

    output_path = derive_output_path(args, report, selected)
    if output_path.exists() and not args.allow_overwrite:
        raise SystemExit(f"Output already exists: {output_path}. Use --allow-overwrite to replace it.")

    payload = build_export_payload(report, input_path, selected, output_path, args)
    write_json_file(output_path, payload)

    print_json(
        {
            "output_path": str(output_path),
            "draft_kind": payload["draft_kind"],
            "review_required": payload["review_required"],
            "selected_count": len(selected),
            "selected_candidate_ids": [candidate["candidate_id"] for candidate in selected],
        }
    )


if __name__ == "__main__":
    main()
