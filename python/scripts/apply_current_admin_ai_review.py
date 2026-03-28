#!/usr/bin/env python3
import argparse
from pathlib import Path
from typing import Any

from current_admin_common import (
    derive_csv_path,
    load_json_file,
    normalize_nullable_text,
    print_json,
    read_batch_payload,
    resolve_default_report_path,
    write_csv_rows,
    write_json_file,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create a manual current-administration review queue from a normalized batch and an AI review report."
    )
    parser.add_argument("--batch", type=Path, required=True, help="Normalized current-admin batch JSON")
    parser.add_argument("--review", type=Path, required=True, help="AI review report JSON")
    parser.add_argument("--output", type=Path, help="Manual review queue JSON output")
    parser.add_argument(
        "--prefill-suggestions",
        action="store_true",
        help="Prefill final_record with AI suggestions when they are non-empty. Default keeps the original record as the operator baseline.",
    )
    parser.add_argument(
        "--csv",
        nargs="?",
        const="",
        help="Optionally write a CSV queue summary. Pass a path or omit the value to derive one from --output.",
    )
    return parser.parse_args()


def merge_record_with_suggestions(record: dict[str, Any], suggestions: dict[str, Any], prefill: bool) -> dict[str, Any]:
    merged = dict(record)
    if not prefill:
        return merged

    field_map = {
        "title_normalized": "title",
        "summary_suggestion": "summary",
        "topic_suggestion": "topic",
        "impacted_group_suggestion": "impacted_group",
        "status_suggestion": "status",
    }

    for suggestion_field, record_field in field_map.items():
        value = normalize_nullable_text(suggestions.get(suggestion_field))
        if value:
            merged[record_field] = value

    first_outcome = (((merged.get("actions") or [{}])[0]).get("outcomes") or [{}])[0]
    if first_outcome:
        direction = normalize_nullable_text(suggestions.get("impact_direction_suggestion"))
        evidence = normalize_nullable_text(suggestions.get("evidence_strength_suggestion"))
        if direction:
            first_outcome["impact_direction"] = direction
        if evidence:
            first_outcome["evidence_strength"] = evidence

    return merged


def main() -> None:
    args = parse_args()
    batch = read_batch_payload(args.batch)
    review = load_json_file(args.review)
    review_items = {item.get("slug"): item for item in review.get("items") or []}
    output_path = args.output or resolve_default_report_path(batch["batch_name"], "manual-review-queue")

    items = []
    csv_rows = []

    for record in batch.get("records") or []:
        ai_item = review_items.get(record.get("slug"), {})
        suggestions = ai_item.get("suggestions") or {}
        queue_item = {
            "slug": record.get("slug"),
            "approved": False,
            "operator_status": "pending",
            "operator_notes": None,
            "original_record": record,
            "ai_review": ai_item,
            "final_record": merge_record_with_suggestions(record, suggestions, args.prefill_suggestions),
        }
        items.append(queue_item)
        csv_rows.append(
            {
                "slug": record.get("slug"),
                "title": record.get("title"),
                "approved": queue_item["approved"],
                "operator_status": queue_item["operator_status"],
                "record_action_suggestion": suggestions.get("record_action_suggestion"),
                "status_suggestion": suggestions.get("status_suggestion"),
            }
        )

    payload = {
        "batch_name": batch.get("batch_name"),
        "president_slug": batch.get("president_slug"),
        "source_batch_path": str(args.batch),
        "source_review_path": str(args.review),
        "prefill_suggestions": args.prefill_suggestions,
        "items": items,
    }

    write_json_file(output_path, payload)
    csv_path = derive_csv_path(args.csv, output_path)
    if csv_path:
        write_csv_rows(csv_path, csv_rows)

    print_json(
        {
            "batch_name": batch.get("batch_name"),
            "queue_output_path": str(output_path),
            "item_count": len(items),
            "prefill_suggestions": args.prefill_suggestions,
        }
    )


if __name__ == "__main__":
    main()
