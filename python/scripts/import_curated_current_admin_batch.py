#!/usr/bin/env python3
import argparse
from pathlib import Path
from typing import Any

from current_admin_common import (
    derive_csv_path,
    get_db_connection,
    get_current_admin_reports_dir,
    get_project_root,
    load_json_file,
    map_evidence_strength,
    normalize_date,
    normalize_nullable_text,
    print_json,
    read_batch_payload,
    require_apply_confirmation,
    resolve_default_report_path,
    short_description,
    write_csv_rows,
    write_json_file,
)


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
        for item in payload.get("items") or []:
            if item.get("approved") or item.get("operator_status") == "approved":
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

    return {
        "status": "passed",
        "input_mode": "manual_review_queue",
        "source_batch_path": str(source_batch_path),
        "source_review_path": str(source_review_path),
        "source_precommit_path": str(precommit_path),
        "source_decision_log_path": str(decision_log_path),
        "precommit_readiness_status": readiness_status,
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
            source.get("source_type"),
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
        "actions_created": 0,
        "outcomes_created": 0,
        "sources_created": 0,
        "sources_reused": 0,
        "skipped_duplicates": [],
        "conflicts": [],
        "notes": [
            "The live schema links outcomes to promise_id rather than action_id, so outcome dedupe and inserts are performed at the promise level."
        ],
    }

    csv_rows = []
    touched_promise_ids: list[int] = []
    connection = get_db_connection()
    source_cache: dict[tuple[str, str], int] = {}

    try:
        with connection.cursor() as cursor:
            president = get_president(cursor, payload.get("president_slug"))

            for record in payload.get("records") or []:
                match_type, existing_promise = find_promise(cursor, int(president["id"]), record)
                if existing_promise is None:
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
                    existing_action = find_existing_action(cursor, promise_id, action)
                    if existing_action:
                        action_id = int(existing_action["id"])
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
                                action.get("action_type"),
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

                        for source in outcome.get("outcome_sources") or []:
                            source_id = upsert_source(cursor, source, report, source_cache)
                            link_join_table(cursor, "promise_outcome_sources", "promise_outcome_id", outcome_id, source_id)

                csv_rows.append(
                    {
                        "slug": record.get("slug"),
                        "title": record.get("title"),
                        "status": record.get("status"),
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
