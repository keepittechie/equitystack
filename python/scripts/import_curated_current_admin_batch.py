#!/usr/bin/env python3
import argparse
from pathlib import Path
from typing import Any

from current_admin_common import (
    VALID_CAMPAIGN_OR_OFFICIAL_VALUES,
    VALID_PROMISE_STATUSES,
    VALID_PROMISE_TYPES,
    derive_csv_path,
    get_db_connection,
    get_current_admin_reports_dir,
    get_project_root,
    load_json_file,
    map_evidence_strength,
    normalize_action_type,
    normalize_date,
    normalize_nullable_text,
    normalize_source_type,
    print_json,
    queue_import_candidate_items,
    read_batch_payload,
    record_has_affirmative_black_scope,
    require_apply_confirmation,
    resolve_default_report_path,
    short_description,
    write_csv_rows,
    write_json_file,
)
from current_admin_openai_batch_guardrails import require_review_batch_safe
from policy_outcome_source_common import (
    ensure_policy_outcome_sources_table,
    link_policy_outcome_source,
    sync_policy_outcome_source_metadata,
)
from sync_current_admin_policy_outcomes import (
    build_payload as build_policy_outcome_payload,
    find_existing_policy_outcome,
    insert_policy_outcome,
    sync_existing_source_metadata,
)

IMPACT_PENDING_STATUS = "impact_pending"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Safely import a curated current-administration batch into Promise Tracker."
    )
    parser.add_argument("--input", type=Path, required=True, help="Normalized batch JSON or manual review queue JSON")
    parser.add_argument("--apply", action="store_true", help="Write to the database")
    parser.add_argument("--yes", action="store_true", help="Required confirmation for --apply mode")
    parser.add_argument("--only-slug", action="append", help="Limit processing to one or more promise slugs")
    parser.add_argument("--output", type=Path, help="Import report JSON output")
    parser.add_argument(
        "--csv",
        nargs="?",
        const="",
        help="Optionally write a CSV summary. Pass a path or omit the value to derive one from --output.",
    )
    return parser.parse_args()


def read_import_input(path: Path) -> dict[str, Any]:
    payload = load_json_file(path)
    if not isinstance(payload, dict):
        raise ValueError("Import input must be a JSON object")
    if "records" in payload:
        records = payload.get("records") or []
        payload = {
            **payload,
            "records": records,
            "input_mode": "records",
        }
    else:
        records = []
        for item in queue_import_candidate_items(payload):
            final_record = item.get("final_record")
            if isinstance(final_record, dict):
                records.append(final_record)
        payload = {
            "batch_name": payload.get("batch_name"),
            "president_slug": payload.get("president_slug"),
            "records": records,
            "source_batch_path": payload.get("source_batch_path"),
            "source_review_path": payload.get("source_review_path"),
            "input_mode": "manual_review_queue",
        }
    if not isinstance(records, list):
        raise ValueError("Import input did not resolve to a records list")
    return payload


def impact_status_for_record(record: dict[str, Any]) -> str:
    return normalize_nullable_text(record.get("impact_status")) or "impact_scored"


def approved_queue_items(queue_payload: dict[str, Any]) -> list[dict[str, Any]]:
    return queue_import_candidate_items(queue_payload)


def approved_item_requires_manual_review(item: dict[str, Any]) -> bool:
    ai_review = item.get("ai_review") or {}
    suggestions = ai_review.get("suggestions") or {}
    if isinstance(item.get("automation_decision"), dict):
        return False
    return (
        ai_review.get("recommended_action") == "needs_manual_review"
        or suggestions.get("recommended_action") == "needs_manual_review"
        or suggestions.get("suggested_operator_next_action") == "manual_review_required"
        or suggestions.get("record_action_suggestion") == "manual_review"
    )


def validate_new_promise_record(record: dict[str, Any]) -> None:
    missing_fields = [
        field
        for field in ("title", "slug", "promise_text", "promise_type", "campaign_or_official", "status")
        if normalize_nullable_text(record.get(field)) is None
    ]
    if missing_fields:
        label = normalize_nullable_text(record.get("slug")) or normalize_nullable_text(record.get("title")) or "<unknown>"
        raise ValueError(
            f"Cannot import new promise record {label}: missing required fields {', '.join(missing_fields)}. "
            "Regenerate the batch/queue or repair final_record metadata before import."
        )

    if record.get("promise_type") not in VALID_PROMISE_TYPES:
        raise ValueError(
            f"Cannot import new promise record {record.get('slug') or record.get('title')}: "
            f"invalid promise_type {record.get('promise_type')!r}."
        )
    if record.get("campaign_or_official") not in VALID_CAMPAIGN_OR_OFFICIAL_VALUES:
        raise ValueError(
            f"Cannot import new promise record {record.get('slug') or record.get('title')}: "
            f"invalid campaign_or_official value {record.get('campaign_or_official')!r}."
        )
    if record.get("status") not in VALID_PROMISE_STATUSES:
        raise ValueError(
            f"Cannot import new promise record {record.get('slug') or record.get('title')}: "
            f"invalid status {record.get('status')!r}."
        )


def resolve_lineage_path(raw_value: Any, reference_path: Path) -> Path | None:
    value = normalize_nullable_text(raw_value)
    if value is None:
        return None
    candidate = Path(value)
    if candidate.is_absolute():
        return candidate.resolve()

    project_root = get_project_root()
    python_dir = project_root / "python"
    candidates = [
        (reference_path.parent / candidate).resolve(),
        (project_root / candidate).resolve(),
        (python_dir / candidate).resolve(),
    ]
    for resolved in candidates:
        if resolved.exists():
            return resolved
    return candidates[0]


def resolve_default_decision_log(batch_name: str) -> Path | None:
    decision_dir = get_current_admin_reports_dir() / "review_decisions"
    candidates = sorted(
        decision_dir.glob(f"{batch_name}*.decision-log.json"),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    return candidates[0] if candidates else None


def validate_queue_import_lineage(input_path: Path, payload: dict[str, Any]) -> dict[str, Any]:
    if payload.get("input_mode") != "manual_review_queue":
        return {
            "status": "skipped",
            "input_mode": payload.get("input_mode") or "records",
            "reason": "Import input is not the canonical manual-review queue artifact.",
        }

    batch_name = normalize_nullable_text(payload.get("batch_name"))
    if batch_name is None:
        raise ValueError("Queue provenance is incomplete: queue input is missing batch_name.")

    source_batch_path = resolve_lineage_path(payload.get("source_batch_path"), input_path)
    if source_batch_path is None or not source_batch_path.exists():
        raise ValueError(
            "Queue provenance is incomplete: the normalized batch artifact is missing. Restore the canonical batch artifact before import."
        )

    source_review_path = resolve_lineage_path(payload.get("source_review_path"), input_path)
    if source_review_path is None or not source_review_path.exists():
        raise ValueError(
            "Queue provenance is incomplete: the AI review artifact is missing. Restore the canonical review artifact before import."
        )
    openai_batch_safety = require_review_batch_safe(source_review_path, "import")

    precommit_path = get_current_admin_reports_dir() / f"{batch_name}.pre-commit-review.json"
    if not precommit_path.exists():
        raise ValueError(
            "Queue provenance is incomplete: the pre-commit artifact is missing. Run current-admin pre-commit before import."
        )

    precommit_payload = load_json_file(precommit_path)
    if not isinstance(precommit_payload, dict):
        raise ValueError("Queue provenance is incomplete: pre-commit artifact is unreadable.")
    readiness_status = normalize_nullable_text(precommit_payload.get("readiness_status")) or "unknown"
    if readiness_status == "blocked":
        raise ValueError("Pre-commit review is blocked. Resolve the blocking issues before import.")

    precommit_queue_path = resolve_lineage_path(precommit_payload.get("source_queue_file"), precommit_path)
    if precommit_queue_path is not None and precommit_queue_path.resolve() != input_path.resolve():
        raise ValueError(
            "Queue provenance is incomplete: the pre-commit artifact does not match this queue artifact."
        )

    precommit_review_path = resolve_lineage_path(precommit_payload.get("source_review_file"), precommit_path)
    if precommit_review_path is not None and precommit_review_path.resolve() != source_review_path.resolve():
        raise ValueError(
            "Queue provenance is incomplete: the pre-commit artifact does not match the queue review artifact."
        )

    decision_log_path = resolve_lineage_path(precommit_payload.get("source_decision_log"), precommit_path)
    if decision_log_path is None:
        decision_log_path = resolve_default_decision_log(batch_name)
    if decision_log_path is None or not decision_log_path.exists():
        raise ValueError(
            "Queue provenance is incomplete: the decision log artifact is missing. Finalize operator decisions before import."
        )

    decision_log_payload = load_json_file(decision_log_path)
    if not isinstance(decision_log_payload, dict):
        raise ValueError("Queue provenance is incomplete: decision log is unreadable.")
    decision_log_review_path = resolve_lineage_path(decision_log_payload.get("source_review_file"), decision_log_path)
    if decision_log_review_path is not None and decision_log_review_path.resolve() != source_review_path.resolve():
        raise ValueError(
            "Queue provenance is incomplete: the decision log does not match the queue review artifact."
        )

    queue_payload = load_json_file(input_path)
    if not isinstance(queue_payload, dict):
        raise ValueError("Queue provenance is incomplete: queue artifact is unreadable.")

    manual_review_only_slugs: list[str] = []
    missing_black_scope_slugs: list[str] = []
    missing_final_record_slugs: list[str] = []
    for item in approved_queue_items(queue_payload):
        slug = normalize_nullable_text(item.get("slug")) or "<unknown>"
        final_record = item.get("final_record")
        if not isinstance(final_record, dict):
            missing_final_record_slugs.append(slug)
            continue
        if approved_item_requires_manual_review(item):
            manual_review_only_slugs.append(slug)
        if not record_has_affirmative_black_scope(final_record):
            missing_black_scope_slugs.append(slug)

    if missing_final_record_slugs:
        raise ValueError(
            "Queue provenance is incomplete: approved queue items are missing final_record payloads: "
            + ", ".join(sorted(missing_final_record_slugs))
        )
    if manual_review_only_slugs:
        raise ValueError(
            "Approved queue items still require manual review and cannot be imported: "
            + ", ".join(sorted(manual_review_only_slugs))
        )
    if missing_black_scope_slugs:
        raise ValueError(
            "Approved queue items do not contain an affirmative Black-impact rationale and cannot be imported: "
            + ", ".join(sorted(missing_black_scope_slugs))
        )

    return {
        "status": "passed",
        "input_mode": "manual_review_queue",
        "source_batch_path": str(source_batch_path),
        "source_review_path": str(source_review_path),
        "source_precommit_path": str(precommit_path),
        "source_decision_log_path": str(decision_log_path),
        "precommit_readiness_status": readiness_status,
        "openai_batch_safety": openai_batch_safety,
    }


def get_president(cursor, president_slug: str) -> dict[str, Any]:
    cursor.execute("SELECT id, full_name, slug FROM presidents WHERE slug = %s LIMIT 1", (president_slug,))
    row = cursor.fetchone()
    if not row:
        raise ValueError(f"President term slug not found: {president_slug}")
    return row


def find_promise(cursor, president_id: int, record: dict[str, Any]) -> tuple[str | None, dict[str, Any] | None]:
    cursor.execute("SELECT * FROM promises WHERE slug = %s LIMIT 1", (record.get("slug"),))
    row = cursor.fetchone()
    if row:
        return "slug", row

    cursor.execute(
        "SELECT * FROM promises WHERE president_id = %s AND title = %s LIMIT 1",
        (president_id, record.get("title")),
    )
    row = cursor.fetchone()
    if row:
        return "title+president", row

    return None, None


def collect_promise_updates(existing: dict[str, Any], incoming: dict[str, Any], president_id: int, report: dict[str, Any], title_match: bool) -> dict[str, Any]:
    updates: dict[str, Any] = {}
    fields = [
        ("president_id", president_id),
        ("title", incoming.get("title")),
        ("slug", incoming.get("slug")),
        ("promise_text", incoming.get("promise_text")),
        ("promise_date", normalize_date(incoming.get("promise_date"))),
        ("promise_type", incoming.get("promise_type")),
        ("campaign_or_official", incoming.get("campaign_or_official")),
        ("topic", incoming.get("topic")),
        ("impacted_group", incoming.get("impacted_group")),
        ("status", incoming.get("status")),
        ("summary", incoming.get("summary")),
        ("notes", incoming.get("notes")),
    ]

    for field, value in fields:
        existing_value = existing.get(field)
        has_existing = normalize_nullable_text(existing_value) is not None
        has_incoming = normalize_nullable_text(value) is not None

        if not has_existing and has_incoming:
            updates[field] = value
        elif has_existing and has_incoming and normalize_nullable_text(existing_value) != normalize_nullable_text(value):
            if field == "slug" and title_match:
                report["conflicts"].append(
                    {
                        "type": "promise_slug_conflict",
                        "existing_promise_id": int(existing["id"]),
                        "existing_slug": existing.get("slug"),
                        "incoming_slug": incoming.get("slug"),
                        "title": incoming.get("title"),
                    }
                )
            elif field in {"summary", "notes"}:
                report["conflicts"].append(
                    {
                        "type": "preserved_verified_text",
                        "promise_id": int(existing["id"]),
                        "field": field,
                        "existing": existing_value,
                        "incoming": value,
                    }
                )

    return updates


def apply_promise_update(cursor, promise_id: int, updates: dict[str, Any]) -> bool:
    if not updates:
        return False
    fields = list(updates.keys())
    sql = ", ".join(f"{field} = %s" for field in fields)
    params = [updates[field] for field in fields] + [promise_id]
    cursor.execute(f"UPDATE promises SET {sql} WHERE id = %s", params)
    return True


def collect_action_updates(existing: dict[str, Any], incoming: dict[str, Any], report: dict[str, Any]) -> dict[str, Any]:
    updates: dict[str, Any] = {}
    incoming_action_type = normalize_action_type(incoming.get("action_type"), incoming.get("title"))
    fields = [
        ("action_type", incoming_action_type),
        ("action_date", normalize_date(incoming.get("action_date"))),
        ("title", incoming.get("title")),
        ("description", incoming.get("description")),
    ]

    for field, value in fields:
        existing_value = existing.get(field)
        has_existing = normalize_nullable_text(existing_value) is not None
        has_incoming = normalize_nullable_text(value) is not None

        if not has_existing and has_incoming:
            updates[field] = value
        elif has_existing and has_incoming and normalize_nullable_text(existing_value) != normalize_nullable_text(value):
            report["conflicts"].append(
                {
                    "type": "preserved_existing_action_field",
                    "action_id": int(existing["id"]),
                    "field": field,
                    "existing": existing_value,
                    "incoming": value,
                }
            )

    return updates


def apply_action_update(cursor, action_id: int, updates: dict[str, Any]) -> bool:
    if not updates:
        return False
    fields = list(updates.keys())
    sql = ", ".join(f"{field} = %s" for field in fields)
    params = [updates[field] for field in fields] + [action_id]
    cursor.execute(f"UPDATE promise_actions SET {sql} WHERE id = %s", params)
    return True


def dedupe_source_key(source: dict[str, Any]) -> tuple[str, str]:
    return (
        normalize_nullable_text(source.get("source_title")) or "",
        normalize_nullable_text(source.get("source_url")) or "",
    )


def upsert_source(cursor, source: dict[str, Any], report: dict[str, Any], cache: dict[tuple[str, str], int]) -> int:
    key = dedupe_source_key(source)
    if key in cache:
        report["sources_reused"] += 1
        return cache[key]

    cursor.execute(
        """
        SELECT id
        FROM sources
        WHERE source_title = %s
          AND source_url = %s
        ORDER BY id ASC
        LIMIT 1
        """,
        key,
    )
    row = cursor.fetchone()
    if row:
        source_id = int(row["id"])
        cache[key] = source_id
        report["sources_reused"] += 1
        return source_id

    canonical_source_type = normalize_source_type(
        source.get("source_type"),
        source.get("source_url"),
        source.get("publisher"),
    )

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
        )
        VALUES (NULL, %s, %s, %s, %s, %s, %s)
        """,
        (
            source.get("source_title"),
            source.get("source_url"),
            canonical_source_type,
            source.get("publisher"),
            normalize_date(source.get("published_date")),
            source.get("notes"),
        ),
    )
    source_id = int(cursor.lastrowid)
    cache[key] = source_id
    report["sources_created"] += 1
    return source_id


def link_join_table(cursor, table: str, owner_field: str, owner_id: int, source_id: int) -> None:
    cursor.execute(
        f"INSERT IGNORE INTO {table} ({owner_field}, source_id) VALUES (%s, %s)",
        (owner_id, source_id),
    )


def find_existing_action(cursor, promise_id: int, action: dict[str, Any]) -> dict[str, Any] | None:
    action_date = normalize_date(action.get("action_date"))
    cursor.execute(
        """
        SELECT *
        FROM promise_actions
        WHERE promise_id = %s
          AND ((action_date IS NULL AND %s IS NULL) OR action_date = %s)
        ORDER BY id ASC
        """,
        (promise_id, action_date, action_date),
    )
    rows = cursor.fetchall()
    expected = short_description(action.get("description") or action.get("title"))
    for row in rows:
        if short_description(row.get("description") or row.get("title")) == expected:
            return row
    return None


def find_existing_outcome(cursor, promise_id: int, outcome: dict[str, Any]) -> dict[str, Any] | None:
    cursor.execute(
        """
        SELECT *
        FROM promise_outcomes
        WHERE promise_id = %s
          AND impact_direction = %s
        ORDER BY id ASC
        """,
        (promise_id, outcome.get("impact_direction")),
    )
    rows = cursor.fetchall()
    expected = normalize_nullable_text(outcome.get("outcome_summary"))
    for row in rows:
        if normalize_nullable_text(row.get("outcome_summary")) == expected:
            return row
    return None


def related_historical_policy_score(cursor, promise_id: int) -> float | None:
    cursor.execute(
        """
        SELECT CASE
          WHEN COUNT(DISTINCT pa.related_policy_id) = 1 THEN MAX(
            COALESCE(ps.directness_score, 0) * 2
            + COALESCE(ps.material_impact_score, 0) * 2
            + COALESCE(ps.evidence_score, 0)
            + COALESCE(ps.durability_score, 0)
            + COALESCE(ps.equity_score, 0) * 2
            - COALESCE(ps.harm_offset_score, 0)
          )
          ELSE NULL
        END AS score
        FROM promise_actions pa
        JOIN policy_scores ps ON ps.policy_id = pa.related_policy_id
        WHERE pa.promise_id = %s
        """,
        (promise_id,),
    )
    row = cursor.fetchone() or {}
    value = row.get("score")
    return float(value) if value is not None else None


def upsert_current_admin_policy_outcome(
    cursor,
    *,
    promise_id: int,
    promise_slug: str,
    promise_title: str,
    promise_status: str,
    outcome_id: int,
    outcome: dict[str, Any],
) -> int:
    row = {
        "promise_outcome_id": outcome_id,
        "promise_id": promise_id,
        "outcome_summary": outcome.get("outcome_summary"),
        "outcome_type": outcome.get("outcome_type"),
        "measurable_impact": outcome.get("measurable_impact"),
        "impact_direction": outcome.get("impact_direction"),
        "evidence_strength": map_evidence_strength(outcome.get("evidence_strength")),
        "status_override": outcome.get("status_override"),
        "black_community_impact_note": outcome.get("black_community_impact_note"),
        "promise_slug": promise_slug,
        "promise_title": promise_title,
        "promise_status": promise_status,
        "source_count": 0,
        "related_historical_policy_score": related_historical_policy_score(cursor, promise_id),
    }
    payload, reason = build_policy_outcome_payload(row)
    if payload is None:
        raise RuntimeError(f"Unable to build canonical policy_outcome payload after import: {reason}")
    existing = find_existing_policy_outcome(cursor, payload)
    if existing:
        sync_existing_source_metadata(cursor, existing, payload)
        return int(existing["id"])
    return insert_policy_outcome(cursor, payload)


def validate_post_import(cursor, promise_ids: list[int]) -> dict[str, Any]:
    if not promise_ids:
        return {
            "promises_missing_actions": [],
            "promises_missing_sources": [],
            "orphan_actions": 0,
            "orphan_outcomes": 0,
        }

    placeholders = ", ".join(["%s"] * len(promise_ids))
    cursor.execute(
        f"""
        SELECT
          p.id,
          p.slug,
          COUNT(DISTINCT pa.id) AS action_count,
          COUNT(DISTINCT ps.source_id) AS promise_source_count
        FROM promises p
        LEFT JOIN promise_actions pa ON pa.promise_id = p.id
        LEFT JOIN promise_sources ps ON ps.promise_id = p.id
        WHERE p.id IN ({placeholders})
        GROUP BY p.id, p.slug
        """,
        promise_ids,
    )
    promise_rows = cursor.fetchall()

    cursor.execute(
        """
        SELECT COUNT(*) AS orphan_count
        FROM promise_actions pa
        LEFT JOIN promises p ON p.id = pa.promise_id
        WHERE p.id IS NULL
        """
    )
    orphan_actions = int(cursor.fetchone()["orphan_count"])

    cursor.execute(
        """
        SELECT COUNT(*) AS orphan_count
        FROM promise_outcomes po
        LEFT JOIN promises p ON p.id = po.promise_id
        WHERE p.id IS NULL
        """
    )
    orphan_outcomes = int(cursor.fetchone()["orphan_count"])

    return {
        "promises_missing_actions": [
            {"promise_id": int(row["id"]), "slug": row["slug"]}
            for row in promise_rows
            if int(row["action_count"] or 0) < 1
        ],
        "promises_missing_sources": [
            {"promise_id": int(row["id"]), "slug": row["slug"]}
            for row in promise_rows
            if int(row["promise_source_count"] or 0) < 1
        ],
        "orphan_actions": orphan_actions,
        "orphan_outcomes": orphan_outcomes,
    }


def main() -> None:
    args = parse_args()
    require_apply_confirmation(args.apply, args.yes)
    payload = read_import_input(args.input)
    if args.only_slug:
        wanted = set(args.only_slug)
        payload["records"] = [record for record in payload.get("records") or [] if record.get("slug") in wanted]

    output_path = args.output or resolve_default_report_path(
        payload["batch_name"],
        "import-apply" if args.apply else "import-dry-run",
    )
    provenance_guard = validate_queue_import_lineage(args.input.resolve(), payload)
    report = {
        "mode": "apply" if args.apply else "dry-run",
        "batch_name": payload.get("batch_name"),
        "president_slug": payload.get("president_slug"),
        "source_input_path": str(args.input.resolve()),
        "provenance_guard": provenance_guard,
        "promises_created": 0,
        "promises_updated": 0,
        "existing_promises_enriched": 0,
        "actions_created": 0,
        "actions_updated": 0,
        "existing_actions_enriched": 0,
        "outcomes_created": 0,
        "impact_pending_records": 0,
        "impact_pending_outcomes_deferred": 0,
        "impact_pending_existing_outcomes_preserved": 0,
        "impact_pending_items": [],
        "sources_created": 0,
        "sources_reused": 0,
        "skipped_duplicates": [],
        "conflicts": [],
        "notes": [
            "The live schema links outcomes to promise_id rather than action_id, so outcome dedupe and inserts are performed at the promise level.",
            "Records with impact_status=impact_pending may import promise/action/source facts, but outcome rows are deferred so they are not treated as finalized impact scores.",
            "Existing promise/action records are enriched additively: missing fields and new linked sources/actions may be added, while conflicting populated fields are preserved and reported.",
        ],
    }

    csv_rows = []
    touched_promise_ids: list[int] = []
    connection = get_db_connection()
    source_cache: dict[tuple[str, str], int] = {}

    try:
        with connection.cursor() as cursor:
            ensure_policy_outcome_sources_table(cursor)
            president = get_president(cursor, payload.get("president_slug"))

            for record in payload.get("records") or []:
                impact_status = impact_status_for_record(record)
                impact_pending = impact_status == IMPACT_PENDING_STATUS
                if impact_pending:
                    report["impact_pending_records"] += 1
                    report["impact_pending_items"].append(
                        {
                            "slug": record.get("slug"),
                            "title": record.get("title"),
                            "reason": record.get("impact_pending_reason"),
                        }
                    )
                match_type, existing_promise = find_promise(cursor, int(president["id"]), record)
                if existing_promise is None:
                    validate_new_promise_record(record)
                    cursor.execute(
                        """
                        INSERT INTO promises (
                          president_id,
                          title,
                          slug,
                          promise_text,
                          promise_date,
                          promise_type,
                          campaign_or_official,
                          topic,
                          impacted_group,
                          status,
                          summary,
                          notes,
                          is_demo
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 0)
                        """,
                        (
                            int(president["id"]),
                            record.get("title"),
                            record.get("slug"),
                            record.get("promise_text"),
                            normalize_date(record.get("promise_date")),
                            record.get("promise_type"),
                            record.get("campaign_or_official"),
                            record.get("topic"),
                            record.get("impacted_group"),
                            record.get("status"),
                            record.get("summary"),
                            record.get("notes"),
                        ),
                    )
                    promise_id = int(cursor.lastrowid)
                    report["promises_created"] += 1
                else:
                    promise_id = int(existing_promise["id"])
                    updates = collect_promise_updates(
                        existing_promise,
                        record,
                        int(president["id"]),
                        report,
                        match_type == "title+president",
                    )
                    if apply_promise_update(cursor, promise_id, updates):
                        report["promises_updated"] += 1
                        report["existing_promises_enriched"] += 1
                    report["skipped_duplicates"].append(
                        {
                            "type": "promise",
                            "match": match_type,
                            "promise_id": promise_id,
                            "slug": record.get("slug"),
                        }
                    )

                touched_promise_ids.append(promise_id)

                for source in record.get("promise_sources") or []:
                    source_id = upsert_source(cursor, source, report, source_cache)
                    link_join_table(cursor, "promise_sources", "promise_id", promise_id, source_id)

                for action in record.get("actions") or []:
                    canonical_action_type = normalize_action_type(
                        action.get("action_type"),
                        action.get("title"),
                    )
                    existing_action = find_existing_action(cursor, promise_id, action)
                    if existing_action:
                        action_id = int(existing_action["id"])
                        action_updates = collect_action_updates(existing_action, action, report)
                        if apply_action_update(cursor, action_id, action_updates):
                            report["actions_updated"] += 1
                            report["existing_actions_enriched"] += 1
                        report["skipped_duplicates"].append(
                            {
                                "type": "action",
                                "promise_id": promise_id,
                                "action_id": action_id,
                                "title": action.get("title"),
                            }
                        )
                    else:
                        cursor.execute(
                            """
                            INSERT INTO promise_actions (
                              promise_id,
                              action_type,
                              action_date,
                              title,
                              description
                            )
                            VALUES (%s, %s, %s, %s, %s)
                            """,
                            (
                                promise_id,
                                canonical_action_type,
                                normalize_date(action.get("action_date")),
                                action.get("title"),
                                action.get("description"),
                            ),
                        )
                        action_id = int(cursor.lastrowid)
                        report["actions_created"] += 1

                    for source in action.get("action_sources") or []:
                        source_id = upsert_source(cursor, source, report, source_cache)
                        link_join_table(cursor, "promise_action_sources", "promise_action_id", action_id, source_id)

                    for outcome in action.get("outcomes") or []:
                        if impact_pending:
                            report["impact_pending_outcomes_deferred"] += 1
                            if existing_promise is not None:
                                existing_outcome = find_existing_outcome(cursor, promise_id, outcome)
                                if existing_outcome:
                                    report["impact_pending_existing_outcomes_preserved"] += 1
                                    report["skipped_duplicates"].append(
                                        {
                                            "type": "outcome",
                                            "promise_id": promise_id,
                                            "outcome_id": int(existing_outcome["id"]),
                                            "impact_direction": existing_outcome.get("impact_direction"),
                                            "reason": "existing_finalized_outcome_preserved_for_impact_pending_record",
                                        }
                                    )
                            continue
                        existing_outcome = find_existing_outcome(cursor, promise_id, outcome)
                        if existing_outcome:
                            outcome_id = int(existing_outcome["id"])
                            report["skipped_duplicates"].append(
                                {
                                    "type": "outcome",
                                    "promise_id": promise_id,
                                    "outcome_id": outcome_id,
                                    "impact_direction": outcome.get("impact_direction"),
                                }
                            )
                        else:
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
                            outcome_id = int(cursor.lastrowid)
                            report["outcomes_created"] += 1

                        outcome_source_ids = []
                        for source in outcome.get("outcome_sources") or []:
                            source_id = upsert_source(cursor, source, report, source_cache)
                            outcome_source_ids.append(source_id)

                        policy_outcome_id = upsert_current_admin_policy_outcome(
                            cursor,
                            promise_id=promise_id,
                            promise_slug=record.get("slug"),
                            promise_title=record.get("title"),
                            promise_status=record.get("status"),
                            outcome_id=outcome_id,
                            outcome=outcome,
                        )
                        if outcome_source_ids:
                            for source_id in outcome_source_ids:
                                link_policy_outcome_source(cursor, policy_outcome_id, source_id)
                        sync_policy_outcome_source_metadata(cursor, policy_outcome_id)

                csv_rows.append(
                    {
                        "slug": record.get("slug"),
                        "title": record.get("title"),
                        "status": record.get("status"),
                        "impact_status": impact_status,
                    }
                )

            report["validation"] = validate_post_import(cursor, touched_promise_ids)

        if args.apply:
            connection.commit()
        else:
            connection.rollback()
        write_json_file(output_path, report)
        csv_path = derive_csv_path(args.csv, output_path)
        if csv_path:
            write_csv_rows(csv_path, csv_rows)
        print_json(report)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


if __name__ == "__main__":
    main()
