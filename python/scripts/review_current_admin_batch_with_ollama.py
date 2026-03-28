#!/usr/bin/env python3
import argparse
import json
from pathlib import Path
from typing import Any

import requests

from current_admin_common import (
    derive_csv_path,
    get_db_connection,
    map_evidence_strength,
    normalize_nullable_text,
    print_json,
    read_batch_payload,
    resolve_default_report_path,
    write_csv_rows,
    write_json_file,
)


DEFAULT_OLLAMA_URL = "http://10.10.0.60:11434"
DEFAULT_MODEL = "qwen3.5:latest"
DEFAULT_TIMEOUT = 90
DEFAULT_TEMPERATURE = 0.1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run an advisory Ollama review over a normalized current-administration batch."
    )
    parser.add_argument("--input", type=Path, required=True, help="Normalized current-admin batch JSON")
    parser.add_argument("--output", type=Path, help="AI review report JSON output")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="Ollama model name")
    parser.add_argument("--dry-run", action="store_true", help="Skip Ollama calls and emit heuristic suggestions only")
    parser.add_argument("--max-items", type=int, help="Limit the number of records reviewed")
    parser.add_argument("--only-slug", action="append", help="Limit review to one or more promise slugs")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT, help="Per-request timeout in seconds")
    parser.add_argument("--temperature", type=float, default=DEFAULT_TEMPERATURE, help="Sampling temperature for Ollama")
    parser.add_argument("--ollama-url", default=DEFAULT_OLLAMA_URL, help="Base URL for the Ollama server")
    parser.add_argument(
        "--csv",
        nargs="?",
        const="",
        help="Optionally write a CSV review summary. Pass a path or omit the value to derive one from --output.",
    )
    return parser.parse_args()


def fetch_existing_matches(record: dict[str, Any]) -> list[dict[str, Any]]:
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, slug, title, status
                FROM promises
                WHERE slug = %s OR title = %s
                ORDER BY id ASC
                LIMIT 5
                """,
                (record.get("slug"), record.get("title")),
            )
            return cursor.fetchall()
    finally:
        connection.close()


def heuristic_review(record: dict[str, Any], existing_matches: list[dict[str, Any]]) -> dict[str, Any]:
    suggested_mode = "new_record"
    if existing_matches:
        suggested_mode = "update_existing" if any(match.get("slug") == record.get("slug") for match in existing_matches) else "manual_review"

    caution_flags = []
    if record.get("status") in {"In Progress", "Partial"}:
        caution_flags.append("implementation_still_in_progress")
    if record.get("topic") == "Education":
        caution_flags.append("education_record_can_have_mixed_downstream_effects")

    first_outcome = (((record.get("actions") or [{}])[0]).get("outcomes") or [{}])[0]
    return {
        "title_normalized": record.get("title"),
        "summary_suggestion": record.get("summary"),
        "topic_suggestion": record.get("topic"),
        "impacted_group_suggestion": record.get("impacted_group"),
        "status_suggestion": record.get("status"),
        "impact_direction_suggestion": first_outcome.get("impact_direction"),
        "evidence_strength_suggestion": map_evidence_strength(first_outcome.get("evidence_strength")),
        "record_action_suggestion": suggested_mode,
        "caution_flags": caution_flags,
        "ambiguity_notes": "Dry-run heuristic review only. Operator should confirm wording, match choice, and downstream effect notes.",
    }


def build_prompt(record: dict[str, Any], existing_matches: list[dict[str, Any]]) -> str:
    return f"""
You are assisting with editorial review for one current-administration Promise Tracker record.

Return strict JSON with these keys:
- title_normalized
- summary_suggestion
- topic_suggestion
- impacted_group_suggestion
- status_suggestion
- impact_direction_suggestion
- evidence_strength_suggestion
- record_action_suggestion
- caution_flags
- ambiguity_notes

Rules:
- advisory only
- no scoring
- no political framing
- do not invent facts
- prefer manual_review when uncertain
- record_action_suggestion must be one of: new_record, update_existing, manual_review
- status_suggestion must be one of: In Progress, Partial, Delivered, Blocked, Failed
- impact_direction_suggestion must be one of: Positive, Negative, Mixed, Blocked
- evidence_strength_suggestion must be one of: Strong, Moderate, Limited

Record:
{json.dumps(record, indent=2)}

Existing matches:
{json.dumps(existing_matches, indent=2)}
""".strip()


def call_ollama(prompt: str, *, model: str, ollama_url: str, timeout: int, temperature: float) -> dict[str, Any]:
    response = requests.post(
        f"{ollama_url.rstrip('/')}/api/generate",
        json={
            "model": model,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {
                "temperature": temperature,
            },
        },
        timeout=timeout,
    )
    response.raise_for_status()
    payload = response.json()
    return json.loads(payload.get("response") or "{}")


def select_records(payload: dict[str, Any], only_slugs: list[str] | None, max_items: int | None) -> list[dict[str, Any]]:
    records = list(payload.get("records") or [])
    if only_slugs:
        wanted = set(only_slugs)
        records = [record for record in records if record.get("slug") in wanted]
    if max_items is not None:
        records = records[:max_items]
    return records


def main() -> None:
    args = parse_args()
    payload = read_batch_payload(args.input)
    selected_records = select_records(payload, args.only_slug, args.max_items)
    output_path = args.output or resolve_default_report_path(payload["batch_name"], "ai-review")

    items = []
    csv_rows = []

    for record in selected_records:
        existing_matches = fetch_existing_matches(record)
        if args.dry_run:
            suggestion = heuristic_review(record, existing_matches)
            review_mode = "dry-run"
        else:
            try:
                suggestion = call_ollama(
                    build_prompt(record, existing_matches),
                    model=args.model,
                    ollama_url=args.ollama_url,
                    timeout=args.timeout,
                    temperature=args.temperature,
                )
                review_mode = "ollama"
            except Exception as exc:  # noqa: BLE001
                suggestion = heuristic_review(record, existing_matches)
                suggestion["ambiguity_notes"] = (
                    f"{suggestion['ambiguity_notes']} Ollama fallback reason: {normalize_nullable_text(str(exc))}."
                )
                review_mode = "fallback"

        item = {
            "slug": record.get("slug"),
            "title": record.get("title"),
            "review_mode": review_mode,
            "existing_matches": existing_matches,
            "suggestions": suggestion,
        }
        items.append(item)
        csv_rows.append(
            {
                "slug": record.get("slug"),
                "title": record.get("title"),
                "review_mode": review_mode,
                "record_action_suggestion": suggestion.get("record_action_suggestion"),
                "status_suggestion": suggestion.get("status_suggestion"),
                "impact_direction_suggestion": suggestion.get("impact_direction_suggestion"),
                "evidence_strength_suggestion": suggestion.get("evidence_strength_suggestion"),
            }
        )

    report = {
        "batch_name": payload.get("batch_name"),
        "input_path": str(args.input),
        "model": args.model,
        "dry_run": args.dry_run,
        "reviewed_count": len(items),
        "items": items,
    }

    write_json_file(output_path, report)
    csv_path = derive_csv_path(args.csv, output_path)
    if csv_path:
        write_csv_rows(csv_path, csv_rows)

    print_json(report)


if __name__ == "__main__":
    main()
