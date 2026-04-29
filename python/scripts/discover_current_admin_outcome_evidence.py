#!/usr/bin/env python3
import argparse
import json
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from typing import Any

from current_admin_common import (
    derive_csv_path,
    get_current_admin_reports_dir,
    normalize_nullable_text,
    normalize_text,
    print_json,
    write_csv_rows,
)
from current_admin_outcome_evidence_common import (
    ARTIFACT_VERSION,
    batch_name_from_input,
    default_output_path,
    write_outcome_evidence_artifact,
)
from discover_current_admin_updates import (
    DEFAULT_PRESIDENT_SLUG,
    build_source_reference_note,
    classify_feed_item_context,
    confidence_title_case,
    fetch_default_live_source_items,
    fetch_remote_feed_items,
    load_local_feed_items,
    normalize_feed_date,
    score_discovery_candidate,
    sort_and_limit_feed_items,
)


DEFAULT_SOURCE_CONFIG = Path(__file__).resolve().parents[1] / "config" / "current_admin_outcome_sources.json"
READINESS_IMPACT_STATUSES = {"impact_pending", "impact_review_ready"}
OUTCOME_SIGNAL_HINTS = {
    "awarded",
    "awards",
    "allocated",
    "allocation",
    "distributed",
    "settlement",
    "settlements",
    "recovered",
    "compliance review",
    "resolved",
    "restored",
    "disbursed",
    "issued grants",
    "grant awards",
    "enrollment",
    "participation",
    "referral",
    "referrals",
    "suspension",
    "suspensions",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Collect read-only implementation and outcome evidence for existing current-admin records."
    )
    parser.add_argument("--input", type=Path, action="append", help="Current-admin batch or queue artifact to inspect. May be repeated.")
    parser.add_argument("--president-slug", default=DEFAULT_PRESIDENT_SLUG, help="Presidency term slug to analyze")
    parser.add_argument("--output", type=Path, help="Outcome evidence artifact output path")
    parser.add_argument(
        "--source-config",
        type=Path,
        default=DEFAULT_SOURCE_CONFIG,
        help="JSON source configuration for outcome-evidence collection",
    )
    parser.add_argument(
        "--disable-default-sources",
        action="store_true",
        help="Disable configured default live sources and use only explicit --feed-url/--feed-json inputs",
    )
    parser.add_argument("--feed-url", action="append", help="Optional RSS/Atom feed URL to inspect")
    parser.add_argument("--feed-json", action="append", type=Path, help="Optional local JSON file with feed-like items")
    parser.add_argument("--timeout", type=int, default=30, help="Per-request timeout in seconds")
    parser.add_argument("--max-feed-items", type=int, default=30, help="Cap the number of fetched evidence items")
    parser.add_argument("--include-all-statuses", action="store_true", help="Include records outside impact_pending / impact_review_ready")
    parser.add_argument("--only-record-key", action="append", help="Limit output to one or more specific record keys or slugs")
    parser.add_argument(
        "--csv",
        nargs="?",
        const="",
        help="Optionally write a CSV summary. Pass a path or omit the value to derive one from --output.",
    )
    return parser.parse_args()


def current_timestamp() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


def discover_default_inputs() -> list[Path]:
    reports_dir = get_current_admin_reports_dir()
    queue_paths = sorted(reports_dir.glob("*.manual-review-queue.json"), key=lambda path: path.stat().st_mtime, reverse=True)
    if queue_paths:
        return [queue_paths[0]]
    normalized_paths = sorted(reports_dir.glob("*.normalized.json"), key=lambda path: path.stat().st_mtime, reverse=True)
    if normalized_paths:
        return [normalized_paths[0]]
    return []


def normalize_impact_status(value: Any) -> str | None:
    text = normalize_nullable_text(value)
    if text is None:
        return None
    normalized = text.lower().replace(" ", "_").replace("-", "_")
    return normalized


def record_title(record: dict[str, Any]) -> str | None:
    return normalize_nullable_text(record.get("title")) or normalize_nullable_text(record.get("slug"))


def extract_records_from_artifact(path: Path, *, include_all_statuses: bool) -> tuple[str | None, str | None, list[dict[str, Any]]]:
    payload = path.read_text()
    raw = json.loads(payload)
    records: list[dict[str, Any]] = []
    batch_name = None
    president_slug = None

    if isinstance(raw, dict):
        batch_name = normalize_nullable_text(raw.get("batch_name"))
        president_slug = normalize_nullable_text(raw.get("president_slug"))
        if isinstance(raw.get("items"), list):
            for item in raw.get("items") or []:
                if not isinstance(item, dict):
                    continue
                record = item.get("final_record") if isinstance(item.get("final_record"), dict) else item.get("record")
                if not isinstance(record, dict):
                    continue
                impact_status = normalize_impact_status(
                    record.get("impact_status")
                    or item.get("impact_status")
                    or (item.get("ai_review") or {}).get("impact_status")
                    or ((item.get("suggestions") or {}).get("impact_status"))
                )
                if not include_all_statuses and impact_status not in READINESS_IMPACT_STATUSES:
                    continue
                records.append(
                    {
                        "record_key": normalize_nullable_text(record.get("slug") or item.get("slug") or item.get("item_id")),
                        "slug": normalize_nullable_text(record.get("slug") or item.get("slug")),
                        "title": record_title(record),
                        "topic": normalize_nullable_text(record.get("topic")),
                        "impact_status": impact_status,
                        "source_artifact": str(path),
                        "record": record,
                    }
                )
        elif isinstance(raw.get("records"), list):
            for record in raw.get("records") or []:
                if not isinstance(record, dict):
                    continue
                impact_status = normalize_impact_status(record.get("impact_status"))
                if not include_all_statuses and impact_status not in READINESS_IMPACT_STATUSES:
                    continue
                records.append(
                    {
                        "record_key": normalize_nullable_text(record.get("slug")),
                        "slug": normalize_nullable_text(record.get("slug")),
                        "title": record_title(record),
                        "topic": normalize_nullable_text(record.get("topic")),
                        "impact_status": impact_status,
                        "source_artifact": str(path),
                        "record": record,
                    }
                )

    return batch_name, president_slug, [record for record in records if record.get("record_key")]


def load_input_records(paths: list[Path], *, include_all_statuses: bool) -> tuple[str | None, str, list[dict[str, Any]], list[dict[str, Any]]]:
    records: list[dict[str, Any]] = []
    skipped_inputs: list[dict[str, Any]] = []
    batch_name = None
    president_slug = DEFAULT_PRESIDENT_SLUG
    seen_keys: set[str] = set()

    for path in paths:
        if not path.exists():
            skipped_inputs.append({"path": str(path), "reason": "input artifact not found"})
            continue
        try:
            artifact_batch_name, artifact_president_slug, artifact_records = extract_records_from_artifact(
                path,
                include_all_statuses=include_all_statuses,
            )
        except Exception as exc:  # noqa: BLE001
            skipped_inputs.append({"path": str(path), "reason": normalize_text(str(exc))})
            continue
        if batch_name is None and artifact_batch_name:
            batch_name = artifact_batch_name
        if artifact_president_slug:
            president_slug = artifact_president_slug
        for record in artifact_records:
            key = record["record_key"]
            if key in seen_keys:
                continue
            seen_keys.add(key)
            records.append(record)

    return batch_name, president_slug, records, skipped_inputs


def promise_like_records(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows = []
    for item in records:
        record = item["record"]
        rows.append(
            {
                "slug": item.get("slug"),
                "title": item.get("title"),
                "summary": normalize_nullable_text(record.get("summary")) or normalize_nullable_text(record.get("notes")),
                "topic": item.get("topic"),
                "status": record.get("status"),
                "latest_action_date": normalize_nullable_text(
                    (((record.get("actions") or [{}])[0]).get("action_date"))
                ),
                "record": record,
                "record_key": item.get("record_key"),
            }
        )
    return rows


def evidence_has_measurable_signal(feed_item: dict[str, Any], context: dict[str, Any]) -> bool:
    combined = normalize_text(
        " ".join(
            [
                feed_item.get("title") or "",
                feed_item.get("summary") or "",
                context.get("implementation_stage") or "",
                context.get("mechanism_of_effect") or "",
            ]
        )
    ).lower()
    if any(token in combined for token in OUTCOME_SIGNAL_HINTS):
        return True
    return any(character.isdigit() for character in combined)


def classify_evidence_kind(feed_item: dict[str, Any], context: dict[str, Any], match_score: float) -> tuple[str, str]:
    if match_score < 0.12:
        return "ignore", "The evidence item does not align strongly enough with a tracked current-admin record."
    if context["is_oversight_related"] and not context["is_enforcement_action"]:
        return "source_context", "Oversight material can support research context but does not establish implementation or outcome by itself."
    if context["is_legal_related"] and not context["is_enforcement_action"]:
        return "legal_context", "Court and litigation items remain legal context unless they clearly document enforcement or implementation effects."
    if evidence_has_measurable_signal(feed_item, context):
        return "outcome_evidence", "The item appears to contain downstream implementation or measurable-effect evidence."
    if context.get("implementation_stage") or context["is_formal_action"] or context["is_enforcement_action"]:
        return "implementation_evidence", "The item appears to document implementation, rulemaking, funding, or enforcement activity."
    return "source_context", "The item provides related official context but does not yet look like implementation or measurable outcome evidence."


def evidence_readiness(match: dict[str, Any]) -> str:
    kind = match.get("evidence_kind")
    score = int(match.get("confidence_score") or 0)
    if kind == "outcome_evidence" and score >= 60:
        return "ready_for_impact_evaluate"
    if kind == "implementation_evidence" and score >= 50:
        return "implementation_evidence_present"
    if kind in {"legal_context", "source_context"}:
        return "context_only"
    return "needs_more_evidence"


def build_match(feed_item: dict[str, Any], record: dict[str, Any], promise_like_record: dict[str, Any]) -> dict[str, Any] | None:
    from discover_current_admin_updates import score_feed_match

    match_score = score_feed_match(feed_item, promise_like_record)
    context = classify_feed_item_context(feed_item)
    evidence_kind, classification_reason = classify_evidence_kind(feed_item, context, match_score)
    deterministic_confidence = score_discovery_candidate(
        feed_item=feed_item,
        context=context,
        matched_promise=promise_like_record,
        match_score=match_score,
        topic=record.get("topic") or context.get("topic_estimate"),
        suggestion_type="update_existing_action" if evidence_kind in {"implementation_evidence", "outcome_evidence"} else evidence_kind,
    )
    if evidence_kind == "ignore":
        return None

    return {
        "title": normalize_nullable_text(feed_item.get("title")),
        "url": normalize_nullable_text(feed_item.get("url")),
        "published_at": normalize_feed_date(feed_item.get("published_at")),
        "summary": normalize_nullable_text(feed_item.get("summary")),
        "source_name": normalize_nullable_text(feed_item.get("source_name")),
        "source_type": normalize_nullable_text(feed_item.get("source_type")),
        "source_category": normalize_nullable_text(feed_item.get("source_category")),
        "publisher": normalize_nullable_text(feed_item.get("publisher")),
        "evidence_kind": evidence_kind,
        "match_score": round(match_score, 4),
        "confidence": confidence_title_case(deterministic_confidence["confidence_level"]),
        "confidence_score": deterministic_confidence["confidence_score"],
        "confidence_level": deterministic_confidence["confidence_level"],
        "confidence_reasons": deterministic_confidence["confidence_reasons"],
        "confidence_penalties": deterministic_confidence["confidence_penalties"],
        "classification_reason": classification_reason,
        "legal_status": context.get("legal_status"),
        "court_or_agency": context.get("court_or_agency"),
        "target_agency": context.get("target_agency"),
        "target_program": context.get("target_program"),
        "implementation_stage": context.get("implementation_stage"),
        "mechanism_of_effect": context.get("mechanism_of_effect"),
        "funding_signal": context.get("funding_signal"),
        "affected_institutions": context.get("affected_institutions"),
        "source_reference": {
            "source_title": feed_item.get("title"),
            "source_url": feed_item.get("url"),
            "source_type": feed_item.get("source_type"),
            "publisher": feed_item.get("publisher") or feed_item.get("source_name"),
            "published_date": normalize_feed_date(feed_item.get("published_at")),
            "notes": build_source_reference_note(
                feed_item=feed_item,
                suggestion_type=evidence_kind,
                legal_status=context.get("legal_status") or "unknown",
                court_or_agency=context.get("court_or_agency"),
                docket_number=context.get("docket_number"),
                implementation_stage=context.get("implementation_stage"),
                target_agency=context.get("target_agency"),
                mechanism_of_effect=context.get("mechanism_of_effect"),
                funding_signal=context.get("funding_signal"),
            ),
        },
        "readiness": evidence_readiness(
            {
                "evidence_kind": evidence_kind,
                "confidence_score": deterministic_confidence["confidence_score"],
            }
        ),
    }


def summarize_record_matches(record: dict[str, Any], matches: list[dict[str, Any]]) -> dict[str, Any]:
    counts = {
        "implementation_evidence": sum(match["evidence_kind"] == "implementation_evidence" for match in matches),
        "outcome_evidence": sum(match["evidence_kind"] == "outcome_evidence" for match in matches),
        "source_context": sum(match["evidence_kind"] == "source_context" for match in matches),
        "legal_context": sum(match["evidence_kind"] == "legal_context" for match in matches),
    }
    best_confidence_score = max((int(match.get("confidence_score") or 0) for match in matches), default=0)
    if counts["outcome_evidence"] > 0:
        recommended_next_action = "run_impact_evaluate_dry_run"
    elif counts["implementation_evidence"] > 0:
        recommended_next_action = "collect_more_outcome_evidence"
    elif counts["legal_context"] > 0:
        recommended_next_action = "monitor_legal_context"
    else:
        recommended_next_action = "no_actionable_evidence_found"
    return {
        "record_key": record.get("record_key"),
        "slug": record.get("slug"),
        "title": record.get("title"),
        "topic": record.get("topic"),
        "previous_impact_status": record.get("impact_status"),
        "source_artifact": record.get("source_artifact"),
        "best_confidence_score": best_confidence_score,
        "confidence_level": confidence_title_case("high" if best_confidence_score >= 75 else "medium" if best_confidence_score >= 50 else "low"),
        "implementation_evidence_count": counts["implementation_evidence"],
        "outcome_evidence_count": counts["outcome_evidence"],
        "source_context_count": counts["source_context"],
        "legal_context_count": counts["legal_context"],
        "recommended_next_action": recommended_next_action,
        "activation_mode": "active_read_only",
        "matched_evidence_items": matches,
    }


def build_csv_rows(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows = []
    for item in items:
        for match in item.get("matched_evidence_items") or []:
            rows.append(
                {
                    "record_key": item.get("record_key"),
                    "slug": item.get("slug"),
                    "title": item.get("title"),
                    "topic": item.get("topic"),
                    "previous_impact_status": item.get("previous_impact_status"),
                    "evidence_kind": match.get("evidence_kind"),
                    "published_at": match.get("published_at"),
                    "confidence_score": match.get("confidence_score"),
                    "confidence_level": match.get("confidence_level"),
                    "match_score": match.get("match_score"),
                    "implementation_stage": match.get("implementation_stage"),
                    "mechanism_of_effect": match.get("mechanism_of_effect"),
                    "target_agency": match.get("target_agency"),
                    "target_program": match.get("target_program"),
                    "funding_signal": match.get("funding_signal"),
                    "legal_status": match.get("legal_status"),
                    "court_or_agency": match.get("court_or_agency"),
                    "affected_institutions": match.get("affected_institutions"),
                    "source_name": match.get("source_name"),
                    "source_category": match.get("source_category"),
                    "feed_title": match.get("title"),
                    "feed_url": match.get("url"),
                    "classification_reason": match.get("classification_reason"),
                    "readiness": match.get("readiness"),
                }
            )
    return rows


def main() -> None:
    args = parse_args()
    input_paths = [path.resolve() for path in args.input] if args.input else discover_default_inputs()
    batch_name, president_slug, records, skipped_inputs = load_input_records(
        input_paths,
        include_all_statuses=args.include_all_statuses,
    )
    if args.only_record_key:
        wanted = set(args.only_record_key)
        records = [record for record in records if record.get("record_key") in wanted or record.get("slug") in wanted]

    output_path = (args.output or default_output_path(batch_name)).resolve()
    csv_path = derive_csv_path(args.csv, output_path)

    fetch_args = SimpleNamespace(
        disable_default_sources=args.disable_default_sources,
        source_config=args.source_config.resolve(),
        president_slug=president_slug or args.president_slug,
        max_feed_items=args.max_feed_items,
        timeout=args.timeout,
    )
    default_live_source_items: list[dict[str, Any]] = []
    default_source_errors: list[dict[str, Any]] = []
    source_results: list[dict[str, Any]] = []
    try:
        default_live_source_items, default_source_errors, source_results = fetch_default_live_source_items(fetch_args)
    except Exception as exc:  # noqa: BLE001
        default_source_errors.append({"input": str(args.source_config.resolve()), "error": normalize_text(str(exc))})

    feed_items = list(default_live_source_items)
    feed_errors = list(default_source_errors)
    for feed_json_path in args.feed_json or []:
        try:
            feed_items.extend(load_local_feed_items(feed_json_path.resolve()))
        except Exception as exc:  # noqa: BLE001
            feed_errors.append({"input": str(feed_json_path), "error": normalize_text(str(exc))})
    for feed_url in args.feed_url or []:
        try:
            feed_items.extend(fetch_remote_feed_items(feed_url, args.timeout))
        except Exception as exc:  # noqa: BLE001
            feed_errors.append({"input": feed_url, "error": normalize_text(str(exc))})
    raw_feed_item_count = len(feed_items)
    feed_items = sort_and_limit_feed_items(feed_items, args.max_feed_items)

    promise_rows = promise_like_records(records)
    matched_items = []
    for record, promise_row in zip(records, promise_rows):
        matches = []
        for feed_item in feed_items:
            match = build_match(feed_item, record, promise_row)
            if match:
                matches.append(match)
        matches = sorted(
            matches,
            key=lambda item: (int(item.get("confidence_score") or 0), float(item.get("match_score") or 0.0)),
            reverse=True,
        )
        matched_items.append(summarize_record_matches(record, matches[:8]))

    output = {
        "artifact_version": ARTIFACT_VERSION,
        "generated_at": current_timestamp(),
        "workflow": "current_admin_outcome_evidence_collection",
        "activation_status": "active_read_only",
        "batch_name": batch_name,
        "president_slug": president_slug,
        "input_artifacts": [str(path) for path in input_paths],
        "source_config": str(args.source_config.resolve()),
        "summary": {
            "records_scanned": len(records),
            "feed_items_analyzed": len(feed_items),
            "raw_feed_item_count_before_limit": raw_feed_item_count,
            "implementation_evidence_matches": sum(item.get("implementation_evidence_count", 0) for item in matched_items),
            "outcome_evidence_matches": sum(item.get("outcome_evidence_count", 0) for item in matched_items),
            "source_context_matches": sum(item.get("source_context_count", 0) for item in matched_items),
            "legal_context_matches": sum(item.get("legal_context_count", 0) for item in matched_items),
            "feed_errors": len(feed_errors),
            "records_ready_for_impact_evaluate": sum(item.get("outcome_evidence_count", 0) > 0 for item in matched_items),
        },
        "source_query_summary": {
            "default_live_sources_enabled": not args.disable_default_sources,
            "feed_urls_requested": args.feed_url or [],
            "feed_json_requested": [str(path) for path in (args.feed_json or [])],
            "source_results": source_results,
        },
        "skipped_inputs": skipped_inputs,
        "feed_errors": feed_errors,
        "items": matched_items,
        "operator_guidance": (
            "Review this artifact before using it with impact evaluate. "
            "This collector is active and read-only; it never writes records or policy_outcomes."
        ),
    }
    write_outcome_evidence_artifact(output_path, output)
    if csv_path:
        write_csv_rows(csv_path, build_csv_rows(matched_items))
    print_json(output)


if __name__ == "__main__":
    main()
