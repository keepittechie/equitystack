#!/usr/bin/env python3
import argparse
from collections import Counter
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from audit_source_quality import classify_source_quality, normalize_domain
from current_admin_common import (
    get_db_connection,
    get_reports_dir,
    normalize_nullable_text,
    normalize_text,
    print_json,
    require_apply_confirmation,
    utc_timestamp,
    write_json_file,
)
from sync_current_admin_policy_outcomes import normalize_evidence_strength, source_quality_from_evidence


VALID_SOURCE_TYPES = {"Government", "Academic", "News", "Archive", "Nonprofit", "Other"}
REJECTED_QUALITY_LABELS = {"low_unverified"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Manually curate and attach sources to current-admin policy outcomes through "
            "the canonical promise_outcome_sources junction."
        )
    )
    parser.add_argument("--output", type=Path, help="Curation report JSON path")
    parser.add_argument("--apply", action="store_true", help="Write accepted source rows and links")
    parser.add_argument("--yes", action="store_true", help="Required confirmation for --apply")
    parser.add_argument("--limit", type=int, default=10, help="Maximum target outcomes to show in one session")
    parser.add_argument("--only-policy-outcome-id", type=int, action="append", help="Limit to one or more policy_outcomes.id")
    parser.add_argument("--only-promise-outcome-id", type=int, action="append", help="Limit to one or more promise_outcomes.id")
    parser.add_argument("--source-title", help="Non-interactive source title for a single target")
    parser.add_argument("--source-url", help="Non-interactive source URL for a single target")
    parser.add_argument("--source-type", choices=sorted(VALID_SOURCE_TYPES), help="Optional source type")
    parser.add_argument("--publisher", help="Optional publisher")
    parser.add_argument("--published-date", help="Optional published date in YYYY-MM-DD format")
    parser.add_argument("--note", help="Optional curation note")
    parser.add_argument("--non-interactive", action="store_true", help="List targets or use provided source args without prompts")
    return parser.parse_args()


def default_output_path(apply: bool) -> Path:
    suffix = "apply" if apply else "dry-run"
    return get_reports_dir() / f"policy-outcome-source-curation.{suffix}.json"


def normalize_url(value: Any) -> str | None:
    text = normalize_nullable_text(value)
    if text is None:
        return None
    parsed = urlparse(text)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    return text


def infer_source_type(url: str) -> str:
    domain = normalize_domain(url) or ""
    if domain.endswith(".gov") or domain in {"congress.gov", "govinfo.gov", "whitehouse.gov"}:
        return "Government"
    if domain in {"archives.gov", "loc.gov"}:
        return "Archive"
    if domain.endswith(".edu"):
        return "Academic"
    return "Other"


def normalize_source_type(value: Any, url: str) -> str:
    text = normalize_nullable_text(value)
    if text in VALID_SOURCE_TYPES:
        return text
    return infer_source_type(url)


def normalize_optional_date(value: Any) -> str | None:
    text = normalize_nullable_text(value)
    if text is None:
        return None
    if len(text) != 10 or text[4] != "-" or text[7] != "-":
        raise ValueError("published_date must be YYYY-MM-DD when provided")
    return text


def summaries_match(left: Any, right: Any) -> bool:
    return normalize_text(left) == normalize_text(right)


def fetch_policy_outcome_targets(cursor, args: argparse.Namespace) -> list[dict[str, Any]]:
    params: list[Any] = []
    filters = ["po.policy_type = 'current_admin'", "po.source_count = 0"]
    if args.only_policy_outcome_id:
        placeholders = ", ".join(["%s"] * len(args.only_policy_outcome_id))
        filters.append(f"po.id IN ({placeholders})")
        params.extend(args.only_policy_outcome_id)

    cursor.execute(
        f"""
        SELECT
          po.id AS policy_outcome_id,
          po.policy_id,
          po.record_key,
          po.outcome_summary,
          po.outcome_type,
          po.measurable_impact,
          po.impact_direction,
          po.evidence_strength,
          po.status AS policy_outcome_status,
          po.impact_start_date,
          po.impact_duration_estimate,
          po.source_count,
          po.source_quality,
          p.slug AS promise_slug,
          p.title AS promise_title,
          p.topic AS promise_topic,
          p.status AS promise_status,
          pr.slug AS president_slug,
          pr.full_name AS president_name
        FROM policy_outcomes po
        JOIN promises p ON p.id = po.policy_id
        JOIN presidents pr ON pr.id = p.president_id
        WHERE {" AND ".join(filters)}
        ORDER BY
          CASE po.impact_direction
            WHEN 'Negative' THEN 0
            WHEN 'Positive' THEN 1
            WHEN 'Mixed' THEN 2
            WHEN 'Blocked' THEN 3
            ELSE 4
          END,
          CASE po.status
            WHEN 'Complete' THEN 0
            WHEN 'Delivered' THEN 0
            WHEN 'Failed' THEN 1
            WHEN 'Partial' THEN 2
            WHEN 'Blocked' THEN 3
            ELSE 4
          END,
          po.impact_start_date DESC,
          po.id ASC
        """,
        params,
    )
    targets = list(cursor.fetchall() or [])
    if not targets:
        return []

    promise_ids = sorted({int(target["policy_id"]) for target in targets})
    placeholders = ", ".join(["%s"] * len(promise_ids))
    outcome_filters = [f"po.promise_id IN ({placeholders})"]
    outcome_params: list[Any] = list(promise_ids)
    if args.only_promise_outcome_id:
        placeholders = ", ".join(["%s"] * len(args.only_promise_outcome_id))
        outcome_filters.append(f"po.id IN ({placeholders})")
        outcome_params.extend(args.only_promise_outcome_id)

    cursor.execute(
        f"""
        SELECT
          po.id AS promise_outcome_id,
          po.promise_id,
          po.outcome_summary,
          po.evidence_strength,
          po.impact_direction,
          po.status_override,
          COUNT(DISTINCT pos.source_id) AS live_source_count
        FROM promise_outcomes po
        LEFT JOIN promise_outcome_sources pos ON pos.promise_outcome_id = po.id
        WHERE {" AND ".join(outcome_filters)}
        GROUP BY
          po.id,
          po.promise_id,
          po.outcome_summary,
          po.evidence_strength,
          po.impact_direction,
          po.status_override
        """,
        outcome_params,
    )
    promise_outcomes = list(cursor.fetchall() or [])
    matched = []
    for target in targets:
        matches = [
            row
            for row in promise_outcomes
            if int(row["promise_id"]) == int(target["policy_id"])
            and summaries_match(row["outcome_summary"], target["outcome_summary"])
        ]
        if len(matches) != 1:
            target["match_status"] = "no_unique_promise_outcome_match"
            target["match_count"] = len(matches)
            continue
        promise_outcome = matches[0]
        if args.only_promise_outcome_id and int(promise_outcome["promise_outcome_id"]) not in args.only_promise_outcome_id:
            continue
        target.update(
            {
                "match_status": "matched",
                "promise_outcome_id": int(promise_outcome["promise_outcome_id"]),
                "promise_outcome_evidence_strength": promise_outcome.get("evidence_strength"),
                "promise_outcome_live_source_count": int(promise_outcome.get("live_source_count") or 0),
            }
        )
        matched.append(target)
    return matched[: max(0, int(args.limit or 0))]


def fetch_actions(cursor, promise_id: int) -> list[dict[str, Any]]:
    cursor.execute(
        """
        SELECT id, action_type, action_date, title, description
        FROM promise_actions
        WHERE promise_id = %s
        ORDER BY action_date ASC, id ASC
        """,
        (promise_id,),
    )
    return [
        {
            **row,
            "action_date": str(row["action_date"]) if row.get("action_date") else None,
        }
        for row in list(cursor.fetchall() or [])
    ]


def fetch_coverage(cursor) -> dict[str, Any]:
    cursor.execute(
        """
        SELECT
          COUNT(*) AS total_policy_outcomes,
          SUM(CASE WHEN source_count > 0 THEN 1 ELSE 0 END) AS policy_outcomes_with_sources,
          SUM(CASE WHEN source_count = 0 THEN 1 ELSE 0 END) AS policy_outcomes_without_sources
        FROM policy_outcomes
        WHERE policy_type = 'current_admin'
        """
    )
    row = cursor.fetchone() or {}
    return {key: int(value or 0) for key, value in row.items()}


def add_coverage_pct(row: dict[str, Any]) -> dict[str, Any]:
    total = int(row.get("total_policy_outcomes") or 0)
    with_sources = int(row.get("policy_outcomes_with_sources") or 0)
    return {
        **row,
        "source_coverage_pct": round(with_sources / total, 4) if total else 0,
    }


def find_sources_by_url(cursor, url: str) -> list[dict[str, Any]]:
    cursor.execute(
        """
        SELECT id, policy_id, source_title, source_url, source_type, publisher, published_date, notes
        FROM sources
        WHERE LOWER(TRIM(TRAILING '/' FROM source_url)) = LOWER(TRIM(TRAILING '/' FROM %s))
        ORDER BY id ASC
        """,
        (url,),
    )
    return list(cursor.fetchall() or [])


def source_already_attached(cursor, promise_outcome_id: int, source_id: int) -> bool:
    cursor.execute(
        """
        SELECT 1
        FROM promise_outcome_sources
        WHERE promise_outcome_id = %s
          AND source_id = %s
        LIMIT 1
        """,
        (promise_outcome_id, source_id),
    )
    return cursor.fetchone() is not None


def prompt_text(label: str, default: str | None = None) -> str | None:
    suffix = f" [{default}]" if default else ""
    value = input(f"{label}{suffix}: ").strip()
    return value or default


def prompt_yes_no(label: str, default: bool = False) -> bool:
    suffix = "Y/n" if default else "y/N"
    value = input(f"{label} [{suffix}]: ").strip().lower()
    if not value:
        return default
    return value in {"y", "yes"}


def build_source_draft_from_args(args: argparse.Namespace) -> dict[str, Any] | None:
    if not args.source_url and not args.source_title:
        return None
    if not args.source_url or not args.source_title:
        raise ValueError("--source-title and --source-url are both required for non-interactive source input")
    url = normalize_url(args.source_url)
    if url is None:
        raise ValueError("--source-url must be a valid http(s) URL")
    return {
        "source_title": normalize_text(args.source_title),
        "source_url": url,
        "source_type": normalize_source_type(args.source_type, url),
        "publisher": normalize_nullable_text(args.publisher),
        "published_date": normalize_optional_date(args.published_date),
        "operator_note": normalize_nullable_text(args.note),
    }


def build_source_draft_interactive(target: dict[str, Any]) -> dict[str, Any] | None:
    print("")
    print(f"Policy outcome {target['policy_outcome_id']} | promise outcome {target['promise_outcome_id']}")
    print(f"Promise: {target.get('promise_title')}")
    print(f"Status: {target.get('policy_outcome_status')} | Direction: {target.get('impact_direction')}")
    print(f"Outcome: {target.get('outcome_summary')}")
    print("Actions:")
    for action in target.get("actions", [])[:5]:
        print(f"  - {action.get('action_date') or 'n/a'} | {action.get('action_type')} | {action.get('title')}")
    if not prompt_yes_no("Attach a source to this outcome?", default=False):
        return None

    title = prompt_text("Source title")
    url = normalize_url(prompt_text("Source URL"))
    if not title or not url:
        print("Skipping: source title and valid http(s) URL are required.")
        return None
    inferred_type = infer_source_type(url)
    source_type = normalize_source_type(prompt_text("Source type", inferred_type), url)
    publisher = prompt_text("Publisher (optional)")
    published_date = normalize_optional_date(prompt_text("Published date YYYY-MM-DD (optional)"))
    operator_note = prompt_text("Operator note (optional)")
    return {
        "source_title": normalize_text(title),
        "source_url": url,
        "source_type": source_type,
        "publisher": normalize_nullable_text(publisher),
        "published_date": published_date,
        "operator_note": normalize_nullable_text(operator_note),
    }


def build_plan_for_target(cursor, target: dict[str, Any], draft: dict[str, Any]) -> dict[str, Any]:
    existing_sources = find_sources_by_url(cursor, draft["source_url"])
    source_for_quality = {
        "source_title": draft["source_title"],
        "source_url": draft["source_url"],
        "source_type": draft["source_type"],
        "publisher": draft.get("publisher"),
    }
    quality = classify_source_quality(source_for_quality)
    status = "ready"
    errors = []
    warnings = []
    source_id = None
    storage_action = "create_source_and_link"

    if quality["source_quality_label"] in REJECTED_QUALITY_LABELS:
        status = "rejected"
        errors.append("source quality classified as low_unverified; choose an official, institutional, or reputable source")

    if existing_sources:
        source_id = int(existing_sources[0]["id"])
        storage_action = "reuse_existing_source_and_link"
        if len(existing_sources) > 1:
            warnings.append("duplicate URL already exists in sources; using earliest source row and creating no new duplicate")
        if source_already_attached(cursor, int(target["promise_outcome_id"]), source_id):
            status = "skipped"
            warnings.append("source URL is already attached to this outcome")

    return {
        "status": status,
        "policy_outcome_id": int(target["policy_outcome_id"]),
        "promise_outcome_id": int(target["promise_outcome_id"]),
        "policy_id": int(target["policy_id"]),
        "record_key": target.get("record_key"),
        "promise_title": target.get("promise_title"),
        "curation_priority": target_curation_priority(target),
        "priority_rationale": target_priority_rationale(target),
        "outcome_summary": target.get("outcome_summary"),
        "source_draft": draft,
        "existing_source_id": source_id,
        "storage_action": storage_action,
        "quality": quality,
        "warnings": warnings,
        "errors": errors,
    }


def target_curation_priority(target: dict[str, Any]) -> str:
    direction = target.get("impact_direction")
    status = target.get("policy_outcome_status") or target.get("promise_status")
    if direction == "Negative" and status in {"Complete", "Delivered", "Failed"}:
        return "high"
    if direction == "Positive" and status in {"Complete", "Delivered"}:
        return "high"
    if direction in {"Negative", "Positive", "Mixed"}:
        return "medium"
    return "review"


def target_priority_rationale(target: dict[str, Any]) -> str:
    direction = target.get("impact_direction") or "unknown direction"
    status = target.get("policy_outcome_status") or target.get("promise_status") or "unknown status"
    return (
        f"Prioritized by outcome visibility proxy: impact_direction={direction}, "
        f"status={status}, impact_start_date={target.get('impact_start_date') or 'unknown'}."
    )


def target_summary(target: dict[str, Any], status: str) -> dict[str, Any]:
    return {
        "policy_outcome_id": int(target["policy_outcome_id"]),
        "promise_outcome_id": int(target["promise_outcome_id"]),
        "policy_id": int(target["policy_id"]),
        "record_key": target.get("record_key"),
        "promise_title": target.get("promise_title"),
        "promise_topic": target.get("promise_topic"),
        "promise_status": target.get("promise_status"),
        "president_slug": target.get("president_slug"),
        "president_name": target.get("president_name"),
        "impact_direction": target.get("impact_direction"),
        "policy_outcome_status": target.get("policy_outcome_status"),
        "curation_priority": target_curation_priority(target),
        "priority_rationale": target_priority_rationale(target),
        "impact_start_date": str(target["impact_start_date"]) if target.get("impact_start_date") else None,
        "impact_duration_estimate": target.get("impact_duration_estimate"),
        "outcome_summary": target.get("outcome_summary"),
        "actions": target.get("actions", [])[:5],
        "status": status,
    }


def create_source(cursor, plan: dict[str, Any], generated_at: str) -> int:
    draft = plan["source_draft"]
    note_parts = [
        f"EquityStack manual outcome source curation at {generated_at}",
        f"policy_outcome_id={plan['policy_outcome_id']}",
        f"promise_outcome_id={plan['promise_outcome_id']}",
    ]
    if draft.get("operator_note"):
        note_parts.append(f"operator_note={draft['operator_note']}")
    cursor.execute(
        """
        INSERT INTO sources (
          policy_id,
          source_title,
          source_url,
          source_type,
          publisher,
          published_date,
          notes
        ) VALUES (NULL, %s, %s, %s, %s, %s, %s)
        """,
        (
            draft["source_title"],
            draft["source_url"],
            draft["source_type"],
            draft.get("publisher"),
            draft.get("published_date"),
            " | ".join(note_parts),
        ),
    )
    return int(cursor.lastrowid)


def sync_policy_outcome_source_metadata(cursor, plan: dict[str, Any]) -> dict[str, Any]:
    cursor.execute(
        """
        SELECT COUNT(DISTINCT pos.source_id) AS source_count
        FROM promise_outcome_sources pos
        WHERE pos.promise_outcome_id = %s
        """,
        (plan["promise_outcome_id"],),
    )
    source_count = int((cursor.fetchone() or {}).get("source_count") or 0)
    evidence = normalize_evidence_strength(plan["source_draft"].get("evidence_strength"))
    if evidence is None:
        cursor.execute(
            """
            SELECT evidence_strength
            FROM policy_outcomes
            WHERE id = %s
            LIMIT 1
            """,
            (plan["policy_outcome_id"],),
        )
        evidence = normalize_evidence_strength((cursor.fetchone() or {}).get("evidence_strength"))
    source_quality = source_quality_from_evidence(evidence, source_count)
    cursor.execute(
        """
        UPDATE policy_outcomes
        SET source_count = %s,
            source_quality = %s
        WHERE id = %s
        """,
        (source_count, source_quality, plan["policy_outcome_id"]),
    )
    return {
        "source_count": source_count,
        "source_quality": source_quality,
    }


def apply_plan(cursor, plan: dict[str, Any], generated_at: str) -> dict[str, Any]:
    if plan["status"] != "ready":
        return {"status": "not_applied", "reason": plan["status"]}
    source_id = plan.get("existing_source_id")
    if source_id is None:
        source_id = create_source(cursor, plan, generated_at)
    cursor.execute(
        """
        INSERT IGNORE INTO promise_outcome_sources (promise_outcome_id, source_id)
        VALUES (%s, %s)
        """,
        (plan["promise_outcome_id"], source_id),
    )
    link_inserted = int(cursor.rowcount or 0)
    metadata = sync_policy_outcome_source_metadata(cursor, plan)
    return {
        "status": "applied",
        "source_id": source_id,
        "link_inserted": link_inserted,
        "policy_outcome_metadata": metadata,
    }


def build_report(args: argparse.Namespace) -> dict[str, Any]:
    require_apply_confirmation(args.apply, args.yes)
    if args.limit is not None and args.limit < 1:
        raise SystemExit("--limit must be >= 1")

    generated_at = utc_timestamp()
    source_arg_draft = build_source_draft_from_args(args)
    if source_arg_draft and not (args.only_policy_outcome_id or args.only_promise_outcome_id):
        raise SystemExit("Non-interactive source input requires --only-policy-outcome-id or --only-promise-outcome-id")

    connection = get_db_connection()
    plans: list[dict[str, Any]] = []
    skipped_targets: list[dict[str, Any]] = []
    applied: list[dict[str, Any]] = []
    try:
        with connection.cursor() as cursor:
            before_coverage = add_coverage_pct(fetch_coverage(cursor))
            targets = fetch_policy_outcome_targets(cursor, args)
            for target in targets:
                target["actions"] = fetch_actions(cursor, int(target["policy_id"]))
                draft = source_arg_draft
                if draft is None and not args.non_interactive:
                    draft = build_source_draft_interactive(target)
                if draft is None:
                    skipped_targets.append(target_summary(target, "skipped_by_operator_or_no_source_input"))
                    continue
                plans.append(build_plan_for_target(cursor, target, draft))

            if args.apply:
                for plan in plans:
                    result = apply_plan(cursor, plan, generated_at)
                    applied.append({**plan, "apply_result": result})
                connection.commit()
            else:
                connection.rollback()
            after_coverage = add_coverage_pct(fetch_coverage(cursor))
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

    status_counts = Counter(plan["status"] for plan in plans)
    applied_count = sum(1 for item in applied if item.get("apply_result", {}).get("status") == "applied")
    linked_rows_created = sum(int(item.get("apply_result", {}).get("link_inserted") or 0) for item in applied)
    return {
        "workflow": "manual_policy_outcome_source_curation",
        "generated_at": generated_at,
        "mode": "apply" if args.apply else "dry_run",
        "storage": {
            "source_table": "sources",
            "junction_table": "promise_outcome_sources",
            "unified_metadata_table": "policy_outcomes",
            "note": (
                "Production has no policy_outcome_sources table; current-admin scoring reads promise_outcome_sources. "
                "The workflow updates policy_outcomes.source_count/source_quality after linking."
            ),
        },
        "summary": {
            "target_count": len(plans) + len(skipped_targets),
            "planned_source_links": len(plans),
            "ready_link_count": int(status_counts.get("ready", 0)),
            "rejected_count": int(status_counts.get("rejected", 0)),
            "skipped_count": int(status_counts.get("skipped", 0)) + len(skipped_targets),
            "applied_source_link_count": applied_count,
            "linked_rows_created": linked_rows_created,
            "remaining_without_sources_before": before_coverage["policy_outcomes_without_sources"],
            "remaining_without_sources_after": after_coverage["policy_outcomes_without_sources"],
            "coverage_pct_before": before_coverage["source_coverage_pct"],
            "coverage_pct_after": after_coverage["source_coverage_pct"],
        },
        "coverage_before": before_coverage,
        "coverage_after": after_coverage,
        "plans": plans,
        "skipped_targets": skipped_targets,
        "applied": applied,
        "rules": {
            "manual_only": True,
            "valid_url_required": True,
            "duplicate_url_behavior": "reuse_existing_source_row_do_not_create_duplicate",
            "rejected_quality_labels": sorted(REJECTED_QUALITY_LABELS),
            "existing_sources_preserved": True,
            "scoring_formulas_changed": False,
        },
    }


def main() -> None:
    args = parse_args()
    output = (args.output or default_output_path(args.apply)).resolve()
    report = build_report(args)
    write_json_file(output, report)
    print_json({"ok": True, "output": str(output), **report["summary"]})


if __name__ == "__main__":
    main()
