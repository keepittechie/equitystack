#!/usr/bin/env python3
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any

from current_admin_common import print_json, write_json_file


VALID_SESSION_FOCUS = {
    "high_attention_first",
    "manual_review_session",
    "source_check_session",
    "deep_review_followup",
    "straightforward_pass",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate an operator decision template from an existing current-admin review or worklist artifact."
    )
    parser.add_argument(
        "--input",
        type=Path,
        required=True,
        help="Required. AI review report or exported worklist JSON used as the canonical template source.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Optional. Decision template JSON output path. Defaults to a .decision-template.json sibling of --input.",
    )
    parser.add_argument("--priority", help="Limit to one or more priorities: low, medium, high")
    parser.add_argument("--suggested-batch", help="Limit to one or more suggested batches")
    parser.add_argument("--attention-needed", action="store_true", help="Limit to items where operator_attention_needed is true")
    parser.add_argument("--with-conflicts", action="store_true", help="Limit to items with material conflicts")
    parser.add_argument("--deep-review-recommended", action="store_true", help="Limit to items where deep review is recommended")
    parser.add_argument("--manual-review-severity", help="Limit to one or more manual review severities: low, medium, high")
    parser.add_argument("--session-focus", choices=sorted(VALID_SESSION_FOCUS), help="Limit to a named session focus")
    parser.add_argument("--sort-by-priority", action="store_true", help="Sort selected items by review_priority_score")
    parser.add_argument("--descending", action="store_true", help="Reverse the selected template order")
    parser.add_argument("--session-id", help="Optional session identifier to store in the template")
    parser.add_argument("--preview", action="store_true", help="Print a condensed preview after export")
    parser.add_argument("--summary", action="store_true", help="Print a short summary after export")
    args = parser.parse_args()

    if args.priority:
        args.priority = [part.strip().lower() for part in args.priority.split(",") if part.strip()]
        invalid = sorted(set(args.priority) - {"low", "medium", "high"})
        if invalid:
            parser.error(f"--priority only accepts low, medium, high; invalid values: {', '.join(invalid)}")

    if args.suggested_batch:
        args.suggested_batch = [part.strip() for part in args.suggested_batch.split(",") if part.strip()]

    if args.manual_review_severity:
        args.manual_review_severity = [
            part.strip().lower() for part in args.manual_review_severity.split(",") if part.strip()
        ]
        invalid = sorted(set(args.manual_review_severity) - {"low", "medium", "high"})
        if invalid:
            parser.error(
                f"--manual-review-severity only accepts low, medium, high; invalid values: {', '.join(invalid)}"
            )

    return args


def load_payload(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f"Input artifact not found: {path}")
    payload = json.loads(path.read_text())
    if not isinstance(payload, dict):
        raise ValueError("Input artifact must be a JSON object.")
    return payload


def apply_filters(items: list[dict[str, Any]], args: argparse.Namespace) -> list[dict[str, Any]]:
    filtered = list(items)

    if args.session_focus and filtered:
        focus_map = {
            "high_attention_first": "high_attention",
            "manual_review_session": "manual_review_focus",
            "source_check_session": "source_check_needed",
            "deep_review_followup": "deep_review_candidates",
            "straightforward_pass": "likely_straightforward",
        }
        filtered = [item for item in filtered if item.get("suggested_batch") == focus_map[args.session_focus]]

    if args.priority:
        wanted = set(args.priority)
        filtered = [item for item in filtered if str(item.get("review_priority") or "").lower() in wanted]

    if args.suggested_batch:
        wanted_batches = set(args.suggested_batch)
        filtered = [item for item in filtered if item.get("suggested_batch") in wanted_batches]

    if args.attention_needed:
        filtered = [item for item in filtered if item.get("operator_attention_needed")]

    if args.with_conflicts:
        filtered = [item for item in filtered if item.get("has_material_conflict")]

    if args.deep_review_recommended:
        filtered = [item for item in filtered if item.get("deep_review_recommended")]

    if args.manual_review_severity:
        wanted_severity = set(args.manual_review_severity)
        filtered = [
            item
            for item in filtered
            if str(item.get("manual_review_severity") or "").lower() in wanted_severity
        ]

    if args.sort_by_priority:
        filtered.sort(
            key=lambda item: (int(item.get("review_priority_score") or 0), item.get("slug") or ""),
            reverse=args.descending,
        )
    elif args.descending:
        filtered = list(reversed(filtered))

    return filtered


def derive_output_path(input_path: Path, output_path: Path | None) -> Path:
    if output_path is not None:
        return output_path

    name = input_path.name
    if name.endswith(".ai-review.json"):
        return input_path.with_name(name.replace(".ai-review.json", ".decision-template.json"))
    if name.endswith(".json"):
        return input_path.with_name(name[:-5] + ".decision-template.json")
    return input_path.with_name(name + ".decision-template.json")


def build_selection_filters(args: argparse.Namespace) -> dict[str, Any]:
    return {
        "priority": args.priority,
        "suggested_batch": args.suggested_batch,
        "attention_needed": args.attention_needed,
        "with_conflicts": args.with_conflicts,
        "deep_review_recommended": args.deep_review_recommended,
        "manual_review_severity": args.manual_review_severity,
        "session_focus": args.session_focus,
        "sort_by_priority": args.sort_by_priority,
        "descending": args.descending,
    }


def build_template_item(item: dict[str, Any], index: int) -> dict[str, Any]:
    suggestion = item.get("suggestions") or {}
    return {
        "index": index,
        "slug": item.get("slug"),
        "title": item.get("title"),
        "suggested_batch": item.get("suggested_batch"),
        "suggested_batch_reason": item.get("suggested_batch_reason"),
        "review_priority": item.get("review_priority"),
        "review_priority_score": item.get("review_priority_score"),
        "operator_attention_needed": item.get("operator_attention_needed"),
        "has_material_conflict": item.get("has_material_conflict"),
        "deep_review_recommended": item.get("deep_review_recommended"),
        "manual_review_severity": item.get("manual_review_severity"),
        "ai_record_action_suggestion": suggestion.get("record_action_suggestion"),
        "operator_action": "",
        "operator_notes": "",
        "final_decision_summary": "",
        "timestamp": None,
    }


def build_template_payload(input_path: Path, payload: dict[str, Any], items: list[dict[str, Any]], args: argparse.Namespace) -> dict[str, Any]:
    worklist_used = str(input_path) if payload.get("worklist_type") == "review_worklist" else None
    generated_from_review = payload.get("generated_from_review") or {}
    source_review_file = generated_from_review.get("review_output_path")
    if source_review_file is None and payload.get("resolved_output_path"):
        source_review_file = payload.get("resolved_output_path")

    session_id = args.session_id or datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    selection_filters = payload.get("selection_filters") or payload.get("worklist_filters") or build_selection_filters(args)

    template_items = [build_template_item(item, index) for index, item in enumerate(items, start=1)]
    return {
        "template_type": "operator_decision_template",
        "session_id": session_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_review_file": source_review_file,
        "source_artifact_file": str(input_path),
        "worklist_used": worklist_used,
        "selection_filters": selection_filters,
        "session_focus": payload.get("session_focus") or args.session_focus,
        "decision_options": [
            "approve_as_is",
            "approve_with_changes",
            "manual_review_required",
            "needs_more_sources",
            "defer",
            "reject",
            "escalate",
        ],
        "item_count": len(template_items),
        "items": template_items,
    }


def build_preview_lines(template_payload: dict[str, Any]) -> list[str]:
    lines = ["Decision Template Preview"]
    for item in template_payload.get("items") or []:
        lines.extend(
            [
                f"- {item.get('title')}",
                f"  slug: {item.get('slug')}",
                f"  suggested_batch: {item.get('suggested_batch')}",
                f"  review_priority: {item.get('review_priority')} ({item.get('review_priority_score')})",
                f"  ai_record_action_suggestion: {item.get('ai_record_action_suggestion')}",
                "  operator_action: <fill in>",
            ]
        )
    return lines


def build_summary_lines(template_payload: dict[str, Any], output_path: Path) -> list[str]:
    items = template_payload.get("items") or []
    counts = {"high": 0, "medium": 0, "low": 0}
    for item in items:
        level = str(item.get("review_priority") or "").lower()
        if level in counts:
            counts[level] += 1

    return [
        "Decision Template Summary",
        f"Output: {output_path}",
        f"Selected items: {len(items)}",
        f"High priority: {counts['high']}",
        f"Medium priority: {counts['medium']}",
        f"Low priority: {counts['low']}",
    ]


def main() -> None:
    args = parse_args()
    input_path = args.input.resolve()
    payload = load_payload(input_path)
    items = payload.get("items") or []
    if not isinstance(items, list):
        raise ValueError(
            "Input artifact is missing an items array. Use a canonical .ai-review.json file or an exported worklist JSON."
        )
    if not items:
        raise ValueError(
            "Input artifact contains no review items. Regenerate the review artifact or export a non-empty worklist before creating a decision template."
        )
    filtered_items = apply_filters(items, args)
    if not filtered_items:
        raise ValueError(
            "No review items matched the current template filters. Broaden the filters or regenerate the template from the full review artifact."
        )
    output_path = derive_output_path(input_path, args.output)
    template_payload = build_template_payload(input_path, payload, filtered_items, args)
    write_json_file(output_path, template_payload)

    if args.preview:
        print("\n".join(build_preview_lines(template_payload)))
        if args.summary:
            print()
            print("\n".join(build_summary_lines(template_payload, output_path)))
        return

    if args.summary:
        print("\n".join(build_summary_lines(template_payload, output_path)))
        return

    print_json(
        {
            "output_path": str(output_path),
            "item_count": template_payload["item_count"],
            "selection_filters": template_payload["selection_filters"],
            "session_focus": template_payload.get("session_focus"),
        }
    )


if __name__ == "__main__":
    try:
        main()
    except (FileNotFoundError, ValueError) as exc:
        raise SystemExit(str(exc)) from exc
