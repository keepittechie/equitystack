#!/usr/bin/env python3
import argparse
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from current_admin_common import (
    derive_csv_path,
    get_current_admin_reports_dir,
    get_db_connection,
    map_evidence_strength,
    normalize_date,
    normalize_nullable_text,
    normalize_source_type,
    print_json,
    require_apply_confirmation,
    write_csv_rows,
    write_json_file,
)
from current_admin_outcome_evidence_common import batch_name_from_input, outcome_evidence_index, record_key_variants
from discover_current_admin_outcome_evidence import load_input_records
from evaluate_impact_maturation import (
    evidence_date_window_matched,
    evidence_has_blocking_warnings,
    evidence_is_broad_federal_register_item,
    evidence_is_legal_context,
    normalize_impact_status,
    normalize_review_text,
    outcome_list,
    projected_supplemental_confidence_score,
    projected_supplemental_source_quality,
)
from import_curated_current_admin_batch import find_existing_outcome, upsert_current_admin_policy_outcome
from policy_outcome_source_common import (
    create_source,
    ensure_policy_outcome_sources_table,
    find_source_by_url,
    link_policy_outcome_source,
    sync_policy_outcome_source_metadata,
)


ARTIFACT_VERSION = 1
HIGH_CONFIDENCE_SCORE_FLOOR = 90
ALLOWED_RECOMMENDED_ACTIONS = {"review_for_outcome_maturation"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Dry-run or apply strict current-admin outcome enrichment from approved supplemental evidence."
    )
    parser.add_argument("--input", type=Path, action="append", help="Current-admin artifact(s) to inspect. May be repeated.")
    parser.add_argument(
        "--outcome-evidence",
        type=Path,
        action="append",
        required=True,
        help="Current-admin outcome-evidence artifact(s).",
    )
    parser.add_argument(
        "--impact-evaluation",
        type=Path,
        action="append",
        required=True,
        help="Impact-evaluation artifact(s) containing explicit validator approval state.",
    )
    parser.add_argument("--output", type=Path, help="Enrichment dry-run/apply report output path.")
    parser.add_argument(
        "--csv",
        nargs="?",
        const="",
        help="Optionally write a CSV summary. Pass a path or omit the value to derive one from --output.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Preview enrichment only.")
    parser.add_argument("--apply", action="store_true", help="Apply approved enrichment rows.")
    parser.add_argument("--yes", action="store_true", help="Required confirmation for --apply.")
    parser.add_argument("--only-record-key", action="append", help="Limit to a specific record key or slug.")
    return parser.parse_args()


def current_timestamp() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


def default_output_path(batch_name: str | None, apply: bool) -> Path:
    reports_dir = get_current_admin_reports_dir()
    if batch_name:
        suffix = "outcome-enrichment-apply" if apply else "outcome-enrichment-dry-run"
        return reports_dir / f"{batch_name}.{suffix}.json"
    suffix = "apply" if apply else "dry-run"
    return reports_dir / f"current-admin-policy-outcome-enrichment.{suffix}.json"


def load_json_object(path: Path) -> dict[str, Any]:
    import json

    payload = json.loads(path.read_text())
    if not isinstance(payload, dict):
        raise ValueError(f"{path} must contain a JSON object.")
    return payload


def evaluation_item_index(paths: list[Path]) -> dict[str, dict[str, Any]]:
    index: dict[str, dict[str, Any]] = {}
    for path in paths:
        payload = load_json_object(path)
        for item in payload.get("items") or []:
            if not isinstance(item, dict):
                continue
            for key in record_key_variants(item):
                index[key] = item
    return index


def resolve_record_evaluation(record: dict[str, Any], evaluation_index: dict[str, dict[str, Any]]) -> dict[str, Any] | None:
    for key in record_key_variants(record):
        if key in evaluation_index:
            return evaluation_index[key]
    return None


def record_outcomes(record: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        outcome
        for outcome in outcome_list(record)
        if isinstance(outcome, dict)
        and normalize_nullable_text(outcome.get("outcome_summary"))
        and normalize_nullable_text(outcome.get("impact_direction"))
    ]


def source_reference_complete(source_reference: dict[str, Any]) -> bool:
    return bool(
        normalize_nullable_text(source_reference.get("source_title"))
        and normalize_nullable_text(source_reference.get("source_url"))
        and normalize_nullable_text(source_reference.get("published_date"))
    )


def eligible_outcome_match_reasons(summary_item: dict[str, Any], match: dict[str, Any]) -> tuple[bool, list[str]]:
    reasons: list[str] = []
    if normalize_review_text(match.get("evidence_kind")) != "outcome_evidence":
        reasons.append("match is not outcome-oriented evidence")
    if normalize_review_text(match.get("match_bucket")) not in {"strong_match", "review_match"}:
        reasons.append("match bucket is not reviewable outcome evidence")
    if normalize_review_text(match.get("recommended_next_action")) not in ALLOWED_RECOMMENDED_ACTIONS:
        reasons.append("match does not recommend outcome maturation review")
    if evidence_has_blocking_warnings(match):
        reasons.append("match includes blocking warnings")
    if evidence_is_legal_context(match):
        reasons.append("legal-context evidence cannot enrich outcomes")
    if evidence_is_broad_federal_register_item(match):
        reasons.append("broad Federal Register evidence cannot enrich outcomes")
    if not evidence_date_window_matched(match):
        reasons.append("evidence is not date-window aligned")
    if not normalize_nullable_text(match.get("matched_policy_id")):
        reasons.append("match is missing matched_policy_id")
    if not normalize_nullable_text(match.get("matched_promise_id")):
        reasons.append("match is missing matched_promise_id")
    if not source_reference_complete(match.get("source_reference") if isinstance(match.get("source_reference"), dict) else {}):
        reasons.append("source reference is incomplete")
    projected_quality = projected_supplemental_source_quality(summary_item, match)
    if projected_quality != "high":
        reasons.append("projected source quality is not high")
    projected_confidence = projected_supplemental_confidence_score(summary_item, match)
    if projected_confidence is None or projected_confidence < HIGH_CONFIDENCE_SCORE_FLOOR:
        reasons.append("projected confidence score is below 90")
    return len(reasons) == 0, reasons


def dedupe_source_references(matches: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deduped: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    for match in matches:
        source_reference = match.get("source_reference") if isinstance(match.get("source_reference"), dict) else {}
        url = normalize_nullable_text(source_reference.get("source_url"))
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)
        deduped.append(
            {
                "source_title": normalize_nullable_text(source_reference.get("source_title")),
                "source_url": url,
                "source_type": normalize_nullable_text(source_reference.get("source_type")),
                "publisher": normalize_nullable_text(source_reference.get("publisher")),
                "published_date": normalize_date(source_reference.get("published_date")),
                "notes": normalize_nullable_text(source_reference.get("notes")),
                "evidence_title": normalize_nullable_text(match.get("evidence_title")),
                "evidence_url": normalize_nullable_text(match.get("evidence_url")),
                "evidence_date": normalize_nullable_text(match.get("evidence_date")),
                "source_family": normalize_nullable_text(match.get("source_family")),
                "evidence_type": normalize_nullable_text(match.get("evidence_type")),
                "match_score": match.get("match_score"),
                "match_bucket": normalize_nullable_text(match.get("match_bucket")),
            }
        )
    return deduped


def validate_record_for_enrichment(
    record: dict[str, Any],
    summary_item: dict[str, Any] | None,
    evaluation_item: dict[str, Any] | None,
) -> dict[str, Any]:
    blocked_reasons: list[str] = []
    approval_reasons: list[str] = []
    eligible_matches: list[dict[str, Any]] = []
    rejected_matches: list[dict[str, Any]] = []
    canonical_outcomes = record_outcomes(record.get("record") if isinstance(record.get("record"), dict) else {})

    previous_eval_status = normalize_impact_status((evaluation_item or {}).get("previous_impact_status"))
    recommended_eval_status = normalize_impact_status((evaluation_item or {}).get("recommended_impact_status"))
    explicitly_approved = bool((evaluation_item or {}).get("approved"))

    if evaluation_item is None:
        blocked_reasons.append("impact evaluation artifact is missing for this record")
    elif not (
        previous_eval_status == "impact_review_ready"
        or (explicitly_approved and recommended_eval_status == "impact_review_ready")
    ):
        blocked_reasons.append("record is not explicitly impact_review_ready for enrichment")

    if summary_item is None:
        blocked_reasons.append("outcome-evidence artifact is missing for this record")
        matches = []
    else:
        matches = [item for item in (summary_item.get("matched_evidence_items") or []) if isinstance(item, dict)]

    if not canonical_outcomes:
        blocked_reasons.append("record does not contain a canonical measurable outcome payload to enrich")

    summary_legal_count = int((summary_item or {}).get("legal_context_count") or 0)
    summary_outcome_count = int((summary_item or {}).get("outcome_evidence_count") or 0)
    if summary_legal_count > 0:
        blocked_reasons.append("supplemental evidence includes legal-context matches")
    if summary_outcome_count < 1:
        blocked_reasons.append("supplemental evidence does not include outcome-oriented matches")

    for match in matches:
        eligible, reasons = eligible_outcome_match_reasons(summary_item or {}, match)
        if eligible:
            eligible_matches.append(match)
        else:
            rejected_matches.append(
                {
                    "evidence_title": normalize_nullable_text(match.get("evidence_title") or match.get("title")),
                    "evidence_url": normalize_nullable_text(match.get("evidence_url") or match.get("url")),
                    "reasons": reasons,
                }
            )

    if not eligible_matches:
        blocked_reasons.append("no high-quality outcome-evidence match passed the enrichment validator")

    blocked_reasons = sorted(set(blocked_reasons))
    approved = len(blocked_reasons) == 0 and len(eligible_matches) > 0
    source_references = dedupe_source_references(eligible_matches if approved else [])
    if approved:
        approval_reasons.extend(
            [
                "record is impact_review_ready or explicitly approved to become impact_review_ready",
                "supplemental outcome evidence is present",
                "at least one high-quality outcome-evidence match passed structural validation",
                "canonical measurable outcome payload is available for enrichment",
                "no legal-context evidence is used for enrichment",
            ]
        )

    approving_evidence = eligible_matches[0] if eligible_matches else None
    matched_policy_id = normalize_nullable_text(
        (approving_evidence or {}).get("matched_policy_id") or (summary_item or {}).get("matched_policy_id")
    )
    matched_promise_id = normalize_nullable_text(
        (approving_evidence or {}).get("matched_promise_id") or (summary_item or {}).get("matched_promise_id")
    )
    matched_action_id = normalize_nullable_text(
        (approving_evidence or {}).get("matched_action_id") or (summary_item or {}).get("matched_action_id")
    )

    return {
        "record_key": record.get("record_key"),
        "slug": record.get("slug"),
        "title": record.get("title"),
        "previous_impact_status": previous_eval_status or record.get("impact_status"),
        "recommended_impact_status": recommended_eval_status,
        "approved": approved,
        "matched_policy_id": matched_policy_id,
        "matched_promise_id": matched_promise_id,
        "matched_action_id": matched_action_id,
        "canonical_outcome_count": len(canonical_outcomes),
        "canonical_outcomes": canonical_outcomes,
        "eligible_evidence_count": len(eligible_matches),
        "approval_reasons": approval_reasons,
        "blocked_reasons": blocked_reasons,
        "approving_evidence": approving_evidence,
        "source_references": source_references,
        "rejected_evidence": rejected_matches,
    }


def build_csv_rows(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows = []
    for item in items:
        approving = item.get("approving_evidence") if isinstance(item.get("approving_evidence"), dict) else {}
        rows.append(
            {
                "record_key": item.get("record_key"),
                "slug": item.get("slug"),
                "title": item.get("title"),
                "approved": item.get("approved"),
                "matched_policy_id": item.get("matched_policy_id"),
                "matched_promise_id": item.get("matched_promise_id"),
                "matched_action_id": item.get("matched_action_id"),
                "eligible_evidence_count": item.get("eligible_evidence_count"),
                "canonical_outcome_count": item.get("canonical_outcome_count"),
                "approving_evidence_title": normalize_nullable_text(approving.get("evidence_title")),
                "approving_evidence_url": normalize_nullable_text(approving.get("evidence_url")),
                "approving_evidence_date": normalize_nullable_text(approving.get("evidence_date")),
                "blocked_reasons": "; ".join(item.get("blocked_reasons") or []),
                "approval_reasons": "; ".join(item.get("approval_reasons") or []),
            }
        )
    return rows


def find_promise(cursor, decision: dict[str, Any]) -> dict[str, Any] | None:
    slug = normalize_nullable_text(decision.get("slug"))
    if slug:
        cursor.execute("SELECT id, slug, title, status FROM promises WHERE slug = %s ORDER BY id ASC LIMIT 1", (slug,))
        row = cursor.fetchone()
        if row:
            return row
    matched_promise_id = decision.get("matched_promise_id")
    if matched_promise_id is not None:
        cursor.execute(
            "SELECT id, slug, title, status FROM promises WHERE id = %s ORDER BY id ASC LIMIT 1",
            (int(matched_promise_id),),
        )
        return cursor.fetchone()
    return None


def insert_promise_outcome(cursor, promise_id: int, outcome: dict[str, Any]) -> int:
    cursor.execute(
        """
        INSERT INTO promise_outcomes (
          promise_id,
          outcome_summary,
          outcome_type,
          measurable_impact,
          impact_direction,
          black_community_impact_note,
          evidence_strength,
          status_override
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            promise_id,
            outcome.get("outcome_summary"),
            outcome.get("outcome_type"),
            outcome.get("measurable_impact"),
            outcome.get("impact_direction"),
            outcome.get("black_community_impact_note"),
            map_evidence_strength(outcome.get("evidence_strength")),
            outcome.get("status_override"),
        ),
    )
    return int(cursor.lastrowid)


def upsert_source_reference(
    cursor,
    source_reference: dict[str, Any],
    report: dict[str, Any],
    cache: dict[str, int],
) -> int:
    source_url = normalize_nullable_text(source_reference.get("source_url"))
    if not source_url:
        raise ValueError("source_url is required for enrichment source linking")
    if source_url in cache:
        report["sources_reused"] += 1
        return cache[source_url]
    existing = find_source_by_url(cursor, source_url)
    if existing is not None:
        cache[source_url] = existing
        report["sources_reused"] += 1
        return existing
    source_id = create_source(
        cursor,
        source_title=normalize_nullable_text(source_reference.get("source_title")) or source_url,
        source_url=source_url,
        source_type=normalize_source_type(
            source_reference.get("source_type"),
            source_reference.get("source_url"),
            source_reference.get("publisher"),
        ),
        publisher=normalize_nullable_text(source_reference.get("publisher")),
        published_date=normalize_date(source_reference.get("published_date")),
        notes=normalize_nullable_text(source_reference.get("notes")),
    )
    cache[source_url] = source_id
    report["sources_created"] += 1
    return source_id


def apply_decision(cursor, decision: dict[str, Any], report: dict[str, Any], source_cache: dict[str, int]) -> None:
    promise = find_promise(cursor, decision)
    if promise is None:
        report["records_skipped"] += 1
        report["skipped_items"].append(
            {
                "record_key": decision.get("record_key"),
                "reason": "matching promise was not found",
            }
        )
        return

    promise_id = int(promise["id"])
    touched_promise_outcome_ids: list[int] = []
    touched_policy_outcome_ids: list[int] = []
    created_outcomes = 0
    preserved_outcomes = 0
    source_links_created = 0

    for outcome in decision.get("canonical_outcomes") or []:
        existing_outcome = find_existing_outcome(cursor, promise_id, outcome)
        if existing_outcome:
            outcome_id = int(existing_outcome["id"])
            preserved_outcomes += 1
        else:
            outcome_id = insert_promise_outcome(cursor, promise_id, outcome)
            created_outcomes += 1
            report["promise_outcomes_created"] += 1
        touched_promise_outcome_ids.append(outcome_id)

        policy_outcome_id = upsert_current_admin_policy_outcome(
            cursor,
            promise_id=promise_id,
            promise_slug=normalize_nullable_text(promise.get("slug")) or normalize_nullable_text(decision.get("slug")) or "",
            promise_title=normalize_nullable_text(promise.get("title")) or normalize_nullable_text(decision.get("title")) or "",
            promise_status=normalize_nullable_text(promise.get("status")) or "In Progress",
            outcome_id=outcome_id,
            outcome=outcome,
        )
        touched_policy_outcome_ids.append(policy_outcome_id)

        for source_reference in decision.get("source_references") or []:
            source_id = upsert_source_reference(cursor, source_reference, report, source_cache)
            source_links_created += link_policy_outcome_source(cursor, policy_outcome_id, source_id)
        sync_policy_outcome_source_metadata(cursor, policy_outcome_id)

    report["records_applied"] += 1
    report["policy_outcome_links_created"] += source_links_created
    report["promise_outcomes_preserved"] += preserved_outcomes
    report["touched_promise_outcome_ids"].extend(touched_promise_outcome_ids)
    report["touched_policy_outcome_ids"].extend(touched_policy_outcome_ids)
    report["applied_items"].append(
        {
            "record_key": decision.get("record_key"),
            "slug": decision.get("slug"),
            "title": decision.get("title"),
            "matched_policy_id": decision.get("matched_policy_id"),
            "matched_promise_id": decision.get("matched_promise_id"),
            "matched_action_id": decision.get("matched_action_id"),
            "created_promise_outcomes": created_outcomes,
            "preserved_promise_outcomes": preserved_outcomes,
            "policy_outcome_links_created": source_links_created,
            "touched_promise_outcome_ids": touched_promise_outcome_ids,
            "touched_policy_outcome_ids": touched_policy_outcome_ids,
        }
    )


def main() -> None:
    args = parse_args()
    if args.apply and args.dry_run:
        raise SystemExit("Use either --dry-run or --apply --yes for outcome enrichment")
    require_apply_confirmation(args.apply, args.yes)

    input_paths = [path.resolve() for path in args.input] if args.input else []
    batch_name = None
    if input_paths:
        batch_name = batch_name_from_input(input_paths[0])
    output_path = (args.output.resolve() if args.output else default_output_path(batch_name, args.apply).resolve())
    csv_path = derive_csv_path(args.csv, output_path)

    _, _, records, skipped_inputs = load_input_records(input_paths, include_all_statuses=True)
    if args.only_record_key:
        wanted = set(args.only_record_key)
        records = [record for record in records if record.get("record_key") in wanted or record.get("slug") in wanted]

    outcome_index = outcome_evidence_index([path.resolve() for path in args.outcome_evidence])
    evaluation_index = evaluation_item_index([path.resolve() for path in args.impact_evaluation])

    items = []
    for record in records:
        summary_item = None
        for key in record_key_variants(record):
            if key in outcome_index:
                summary_item = outcome_index[key]
                break
        evaluation_item = resolve_record_evaluation(record, evaluation_index)
        items.append(validate_record_for_enrichment(record, summary_item, evaluation_item))

    approved_items = [item for item in items if item.get("approved")]
    report = {
        "artifact_version": ARTIFACT_VERSION,
        "generated_at": current_timestamp(),
        "workflow": "current_admin_outcome_enrichment",
        "mode": "apply" if args.apply else "dry_run",
        "activation_mode": "validator_approved_apply_only",
        "batch_name": batch_name,
        "inputs": [str(path) for path in input_paths],
        "outcome_evidence_inputs": [str(path.resolve()) for path in args.outcome_evidence],
        "impact_evaluation_inputs": [str(path.resolve()) for path in args.impact_evaluation],
        "summary": {
            "records_scanned": len(records),
            "approved_count": len(approved_items),
            "blocked_count": sum(1 for item in items if not item.get("approved")),
        },
        "records_applied": 0,
        "records_skipped": 0,
        "promise_outcomes_created": 0,
        "promise_outcomes_preserved": 0,
        "sources_created": 0,
        "sources_reused": 0,
        "policy_outcome_links_created": 0,
        "touched_promise_outcome_ids": [],
        "touched_policy_outcome_ids": [],
        "applied_items": [],
        "skipped_items": [],
        "skipped_inputs": skipped_inputs,
        "items": items,
        "operator_guidance": (
            "Only validator-approved, high-quality outcome-evidence matches can be applied here. "
            "Implementation-only, legal-context, weak, or broad-topic evidence stays out of the write path."
        ),
    }

    if args.apply and approved_items:
        connection = get_db_connection()
        source_cache: dict[str, int] = {}
        try:
            with connection.cursor() as cursor:
                ensure_policy_outcome_sources_table(cursor)
                for item in approved_items:
                    apply_decision(cursor, item, report, source_cache)
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    report["summary"]["records_applied"] = report["records_applied"]
    report["summary"]["promise_outcomes_created"] = report["promise_outcomes_created"]
    report["summary"]["policy_outcome_links_created"] = report["policy_outcome_links_created"]
    report["touched_promise_outcome_ids"] = sorted({int(value) for value in report["touched_promise_outcome_ids"]})
    report["touched_policy_outcome_ids"] = sorted({int(value) for value in report["touched_policy_outcome_ids"]})

    write_json_file(output_path, report)
    if csv_path:
        write_csv_rows(csv_path, build_csv_rows(items))
    print_json(report)


if __name__ == "__main__":
    main()
