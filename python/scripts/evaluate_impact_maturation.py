#!/usr/bin/env python3
import argparse
import hashlib
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from current_admin_common import (
    get_db_connection,
    get_project_root,
    get_reports_dir,
    load_json_file,
    map_evidence_strength,
    normalize_nullable_text,
    print_json,
    require_apply_confirmation,
    write_json_file,
)


IMPACT_STATES = ["impact_pending", "impact_review_ready", "impact_scored", "impact_verified"]
IMPACT_STATE_RANK = {state: index for index, state in enumerate(IMPACT_STATES)}
ALLOWED_TRANSITIONS = {
    "impact_pending": {"impact_review_ready"},
    "impact_review_ready": {"impact_scored"},
    "impact_scored": {"impact_verified"},
}
SCORING_READY_STATES = {"impact_scored", "impact_verified"}
VALID_IMPACT_DIRECTIONS = {"Positive", "Negative", "Mixed", "Blocked"}


def utc_timestamp() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


def default_evaluation_output() -> Path:
    return get_reports_dir() / "impact_maturation_review.json"


def default_promotion_output() -> Path:
    return get_reports_dir() / "impact_maturation_promotion_report.json"


def default_ledger_path() -> Path:
    return get_reports_dir() / "impact_maturation_state.json"


def normalize_review_text(value: Any) -> str | None:
    text = normalize_nullable_text(value)
    if text is None:
        return None
    return text.lower().replace(" ", "_").replace("-", "_")


def normalize_impact_status(value: Any) -> str | None:
    normalized = normalize_review_text(value)
    return normalized if normalized in IMPACT_STATE_RANK else None


def normalize_source_quality(value: Any) -> str:
    normalized = normalize_review_text(value)
    mapping = {
        "strong": "high",
        "moderate": "medium",
        "limited": "low",
        "weak": "low",
    }
    normalized = mapping.get(normalized or "", normalized)
    return normalized if normalized in {"low", "medium", "high"} else "low"


def normalize_unified_evidence_strength(value: Any) -> str | None:
    normalized = normalize_review_text(value)
    mapping = {
        "high": "Strong",
        "strong": "Strong",
        "medium": "Moderate",
        "moderate": "Moderate",
        "limited": "Weak",
        "low": "Weak",
        "weak": "Weak",
    }
    return mapping.get(normalized or "")


def normalize_impact_direction(value: Any) -> str | None:
    text = normalize_nullable_text(value)
    if text is None:
        return None
    for direction in VALID_IMPACT_DIRECTIONS:
        if text.lower() == direction.lower():
            return direction
    return None


def normalize_outcome_status(value: Any) -> str | None:
    text = normalize_nullable_text(value)
    if text is None:
        return None
    normalized = text.lower()
    if normalized in {"complete", "completed", "delivered"}:
        return "Complete"
    if normalized in {"in progress", "in_progress"}:
        return "In Progress"
    if normalized == "partial":
        return "Partial"
    return text


def outcome_summary_hash(summary: Any) -> str:
    return hashlib.sha256((normalize_nullable_text(summary) or "").encode("utf-8")).hexdigest()


def normalize_confidence_score(value: Any) -> float | None:
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        score = float(value)
        return max(0.0, min(1.0, score / 100.0 if score > 1 else score))
    normalized = normalize_review_text(value)
    mapping = {
        "low": 0.45,
        "medium": 0.7,
        "moderate": 0.7,
        "high": 0.9,
    }
    if normalized in mapping:
        return mapping[normalized]
    try:
        score = float(str(value).strip())
        return max(0.0, min(1.0, score / 100.0 if score > 1 else score))
    except (TypeError, ValueError):
        return None


def state_rank(state: str | None) -> int:
    return IMPACT_STATE_RANK.get(state or "", -1)


def valid_forward_transition(previous: str, new: str) -> bool:
    return new in ALLOWED_TRANSITIONS.get(previous, set())


def stronger_or_equal(existing: str | None, incoming: str | None) -> bool:
    return state_rank(existing) >= state_rank(incoming)


def load_ledger(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"artifact_version": 1, "records": {}, "transitions": []}
    payload = load_json_file(path)
    if not isinstance(payload, dict):
        return {"artifact_version": 1, "records": {}, "transitions": []}
    payload.setdefault("artifact_version", 1)
    payload.setdefault("records", {})
    payload.setdefault("transitions", [])
    return payload


def outcome_list(record: dict[str, Any]) -> list[dict[str, Any]]:
    outcomes: list[dict[str, Any]] = []
    for action in record.get("actions") or []:
        if isinstance(action, dict):
            outcomes.extend(outcome for outcome in (action.get("outcomes") or []) if isinstance(outcome, dict))
    outcomes.extend(outcome for outcome in (record.get("outcomes") or []) if isinstance(outcome, dict))
    raw_data = record.get("raw_data") if isinstance(record.get("raw_data"), dict) else {}
    candidate = raw_data.get("candidate") if isinstance(raw_data.get("candidate"), dict) else {}
    legislative_summary = (
        record.get("outcome_summary")
        or record.get("measurable_impact")
        or raw_data.get("outcome_summary")
        or raw_data.get("measurable_impact")
        or candidate.get("outcome_summary")
        or candidate.get("measurable_impact")
    )
    if legislative_summary and not outcomes:
        outcomes.append(
            {
                "outcome_summary": legislative_summary,
                "outcome_type": record.get("outcome_type") or raw_data.get("outcome_type") or candidate.get("outcome_type"),
                "measurable_impact": record.get("measurable_impact")
                or raw_data.get("measurable_impact")
                or candidate.get("measurable_impact"),
                "impact_direction": record.get("impact_direction")
                or raw_data.get("impact_direction")
                or candidate.get("impact_direction"),
                "evidence_strength": record.get("evidence_strength")
                or record.get("source_quality")
                or raw_data.get("evidence_strength")
                or candidate.get("evidence_strength"),
                "status_override": record.get("status")
                or record.get("bill_status")
                or raw_data.get("status")
                or candidate.get("status"),
                "black_community_impact_note": record.get("black_community_impact_note")
                or record.get("notes")
                or record.get("link_notes")
                or raw_data.get("black_community_impact_note")
                or raw_data.get("notes")
                or candidate.get("black_community_impact_note")
                or candidate.get("notes"),
            }
        )
    return outcomes


def source_count(record: dict[str, Any]) -> int:
    count = len(record.get("promise_sources") or [])
    for action in record.get("actions") or []:
        if isinstance(action, dict):
            count += len(action.get("action_sources") or [])
            for outcome in action.get("outcomes") or []:
                if isinstance(outcome, dict):
                    count += len(outcome.get("outcome_sources") or [])
    for outcome in record.get("outcomes") or []:
        if isinstance(outcome, dict):
            count += len(outcome.get("outcome_sources") or [])
    return count


def has_measurable_outcome(record: dict[str, Any]) -> bool:
    for outcome in outcome_list(record):
        if normalize_nullable_text(outcome.get("outcome_summary")) and normalize_nullable_text(outcome.get("impact_direction")):
            return True
        if normalize_nullable_text(outcome.get("measurable_impact")):
            return True
    return False


def best_outcome_evidence_strength(record: dict[str, Any]) -> str:
    strengths = [normalize_source_quality(outcome.get("evidence_strength")) for outcome in outcome_list(record)]
    if "high" in strengths:
        return "high"
    if "medium" in strengths:
        return "medium"
    return "low"


def record_key(item: dict[str, Any]) -> str:
    return (
        normalize_nullable_text(item.get("record_key"))
        or normalize_nullable_text(item.get("slug"))
        or normalize_nullable_text(item.get("bill_number"))
        or normalize_nullable_text(item.get("item_id"))
        or "unknown"
    )


def record_title(item: dict[str, Any]) -> str | None:
    return normalize_nullable_text(item.get("title") or item.get("resolved_title") or item.get("candidate_title"))


def extract_current_admin_records(path: Path, payload: dict[str, Any]) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for item in payload.get("items") or []:
        if not isinstance(item, dict):
            continue
        record = item.get("final_record") if isinstance(item.get("final_record"), dict) else item
        ai_review = item.get("ai_review") if isinstance(item.get("ai_review"), dict) else {}
        suggestions = item.get("suggestions") if isinstance(item.get("suggestions"), dict) else {}
        if not suggestions and isinstance(ai_review.get("suggestions"), dict):
            suggestions = ai_review["suggestions"]
        impact_status = normalize_impact_status(
            record.get("impact_status") or item.get("impact_status") or ai_review.get("impact_status") or suggestions.get("impact_status")
        )
        if impact_status not in {"impact_pending", "impact_review_ready"}:
            continue
        confidence = (
            record.get("confidence_score")
            or record.get("confidence")
            or item.get("confidence_score")
            or item.get("confidence")
            or ai_review.get("confidence_score")
            or ai_review.get("confidence")
            or suggestions.get("confidence_score")
            or suggestions.get("confidence_level")
        )
        source_quality = (
            record.get("source_quality")
            or item.get("source_quality")
            or ai_review.get("source_quality")
            or suggestions.get("source_quality")
            or suggestions.get("evidence_strength_suggestion")
        )
        records.append(
            {
                "record_type": "current_admin",
                "record_key": normalize_nullable_text(record.get("slug") or item.get("slug") or item.get("item_id")),
                "slug": record.get("slug") or item.get("slug"),
                "title": record_title(record) or record_title(item),
                "previous_impact_status": impact_status,
                "confidence": confidence,
                "source_quality": source_quality,
                "source_artifact": str(path),
                "record": record,
            }
        )
    return records


def extract_legislative_records(path: Path, payload: Any) -> list[dict[str, Any]]:
    rows = payload if isinstance(payload, list) else payload.get("items") or payload.get("rows") or payload.get("approved_seed_rows") or []
    records: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        impact_status = normalize_impact_status(row.get("impact_status"))
        if impact_status not in {"impact_pending", "impact_review_ready"}:
            continue
        records.append(
            {
                "record_type": "legislative",
                "record_key": normalize_nullable_text(row.get("normalized_bill_number") or row.get("bill_number")),
                "bill_number": row.get("normalized_bill_number") or row.get("bill_number"),
                "title": record_title(row),
                "previous_impact_status": impact_status,
                "confidence": row.get("confidence") or row.get("match_confidence"),
                "source_quality": row.get("source_quality"),
                "source_artifact": str(path),
                "record": row,
            }
        )
    return records


def extract_records_from_artifact(path: Path) -> list[dict[str, Any]]:
    payload = load_json_file(path)
    if isinstance(payload, dict) and "items" in payload and any(
        isinstance(item, dict) and ("final_record" in item or "suggestions" in item)
        for item in payload.get("items") or []
    ):
        return extract_current_admin_records(path, payload)
    if isinstance(payload, dict) and "records" in payload:
        return [
            {
                "record_type": "current_admin",
                "record_key": normalize_nullable_text(record.get("slug")),
                "slug": record.get("slug"),
                "title": record_title(record),
                "previous_impact_status": normalize_impact_status(record.get("impact_status")),
                "confidence": record.get("confidence_score") or record.get("confidence"),
                "source_quality": record.get("source_quality"),
                "source_artifact": str(path),
                "record": record,
            }
            for record in payload.get("records") or []
            if isinstance(record, dict) and normalize_impact_status(record.get("impact_status")) in {"impact_pending", "impact_review_ready"}
        ]
    return extract_legislative_records(path, payload)


def discover_default_inputs() -> list[Path]:
    reports = get_reports_dir()
    candidates = []
    candidates.extend(sorted((reports / "current_admin").glob("*.manual-review-queue.json")))
    seed = reports / "approved_tracked_bills_seed.json"
    if seed.exists():
        candidates.append(seed)
    return [path for path in candidates if path.exists()]


def evaluate_record(item: dict[str, Any], ledger: dict[str, Any]) -> dict[str, Any]:
    key = record_key(item)
    ledger_status = normalize_impact_status((ledger.get("records") or {}).get(key, {}).get("impact_status"))
    previous_status = ledger_status or item.get("previous_impact_status") or "impact_pending"
    confidence_score = normalize_confidence_score(item.get("confidence"))
    source_quality = normalize_source_quality(item.get("source_quality"))
    outcome_strength = best_outcome_evidence_strength(item["record"])
    measurable_outcome = has_measurable_outcome(item["record"])
    sources = source_count(item["record"])
    reasoning: list[str] = []

    if sources > 0:
        reasoning.append(f"{sources} linked source reference(s) are available")
    else:
        reasoning.append("no linked source references were found")
    if measurable_outcome:
        reasoning.append("measurable outcome evidence is present")
    else:
        reasoning.append("measurable outcome evidence is not present")
    reasoning.append(f"source_quality={source_quality}")
    if confidence_score is not None:
        reasoning.append(f"confidence_score={confidence_score:.2f}")

    next_status = previous_status
    if previous_status == "impact_pending":
        if source_quality in {"medium", "high"} and sources > 0 and (confidence_score is None or confidence_score >= 0.55):
            next_status = "impact_review_ready"
        else:
            reasoning.append("record remains pending because source/confidence evidence is not review-ready")
    elif previous_status == "impact_review_ready":
        if measurable_outcome and source_quality in {"medium", "high"} and outcome_strength in {"medium", "high"} and (
            confidence_score is None or confidence_score >= 0.65
        ):
            next_status = "impact_scored"
        else:
            reasoning.append("record remains review-ready because measurable outcome evidence is not scoring-ready")

    transition_allowed = next_status == previous_status or valid_forward_transition(previous_status, next_status)
    return {
        "record_key": key,
        "record_type": item.get("record_type"),
        "slug": item.get("slug"),
        "bill_number": item.get("bill_number"),
        "title": item.get("title"),
        "source_artifact": item.get("source_artifact"),
        "previous_impact_status": previous_status,
        "recommended_impact_status": next_status,
        "transition_allowed": transition_allowed,
        "confidence_score": confidence_score,
        "source_quality": source_quality,
        "outcome_evidence_strength": outcome_strength,
        "has_measurable_outcome": measurable_outcome,
        "source_count": sources,
        "reasoning": reasoning,
        "approved": False,
        "record": item["record"],
    }


def run_evaluate(args: argparse.Namespace) -> None:
    input_paths = [path.resolve() for path in args.input] if args.input else discover_default_inputs()
    ledger = load_ledger(args.ledger.resolve())
    items: list[dict[str, Any]] = []
    skipped_inputs: list[dict[str, Any]] = []
    for path in input_paths:
        if not path.exists():
            skipped_inputs.append({"path": str(path), "reason": "input artifact not found"})
            continue
        try:
            items.extend(extract_records_from_artifact(path))
        except Exception as exc:
            skipped_inputs.append({"path": str(path), "reason": str(exc)})

    if args.only_record_key:
        wanted = set(args.only_record_key)
        items = [item for item in items if record_key(item) in wanted or normalize_nullable_text(item.get("slug")) in wanted]

    evaluated = [evaluate_record(item, ledger) for item in items]
    counts = {
        "total_items": len(evaluated),
        "recommended_review_ready": sum(item["recommended_impact_status"] == "impact_review_ready" for item in evaluated),
        "recommended_scored": sum(item["recommended_impact_status"] == "impact_scored" for item in evaluated),
        "unchanged": sum(item["recommended_impact_status"] == item["previous_impact_status"] for item in evaluated),
        "blocked_transition": sum(not item["transition_allowed"] for item in evaluated),
    }
    output = {
        "artifact_version": 1,
        "generated_at": utc_timestamp(),
        "workflow": "impact_maturation_evaluation",
        "inputs": [str(path) for path in input_paths],
        "ledger_path": str(args.ledger.resolve()),
        "allowed_transitions": {key: sorted(value) for key, value in ALLOWED_TRANSITIONS.items()},
        "counts": counts,
        "skipped_inputs": skipped_inputs,
        "items": evaluated,
        "operator_guidance": (
            "Review recommended transitions, set approved=true only for intended safe promotions, "
            "then run impact promote. Use --approve-safe only when intentionally approving every safe forward transition."
        ),
    }
    write_json_file(args.output.resolve(), output)
    print_json(output)


def find_promise(cursor, item: dict[str, Any]) -> dict[str, Any] | None:
    slug = normalize_nullable_text(item.get("slug") or (item.get("record") or {}).get("slug"))
    if not slug:
        return None
    cursor.execute("SELECT id, slug, title FROM promises WHERE slug = %s LIMIT 1", (slug,))
    return cursor.fetchone()


def normalize_bill_number_display(value: Any) -> str | None:
    text = normalize_nullable_text(value)
    if text is None:
        return None
    return " ".join(text.split())


def find_tracked_bill(cursor, item: dict[str, Any]) -> dict[str, Any] | None:
    record = item.get("record") if isinstance(item.get("record"), dict) else {}
    bill_number = normalize_bill_number_display(
        item.get("bill_number") or record.get("normalized_bill_number") or record.get("bill_number")
    )
    jurisdiction = normalize_nullable_text(record.get("jurisdiction")) or "Federal"
    session_label = normalize_nullable_text(record.get("session_label"))
    if not bill_number:
        return None
    if session_label:
        cursor.execute(
            """
            SELECT id, bill_number, title, jurisdiction, session_label
            FROM tracked_bills
            WHERE bill_number = %s
              AND jurisdiction = %s
              AND session_label = %s
            LIMIT 1
            """,
            (bill_number, jurisdiction, session_label),
        )
        exact = cursor.fetchone()
        if exact:
            return exact
    cursor.execute(
        """
        SELECT id, bill_number, title, jurisdiction, session_label
        FROM tracked_bills
        WHERE bill_number = %s
          AND jurisdiction = %s
        ORDER BY id ASC
        LIMIT 1
        """,
        (bill_number, jurisdiction),
    )
    return cursor.fetchone()


def resolve_policy_target(cursor, item: dict[str, Any]) -> dict[str, Any] | None:
    if item.get("record_type") == "current_admin":
        row = find_promise(cursor, item)
        if not row:
            return None
        return {"policy_type": "current_admin", "policy_id": int(row["id"]), "policy_title": row.get("title")}
    if item.get("record_type") == "legislative":
        row = find_tracked_bill(cursor, item)
        if not row:
            return None
        return {"policy_type": "legislative", "policy_id": int(row["id"]), "policy_title": row.get("title")}
    return None


def ensure_policy_outcomes_table(cursor) -> None:
    schema_path = get_project_root() / "database" / "policy_outcomes.sql"
    sql = "\n".join(
        line for line in schema_path.read_text().splitlines() if not line.strip().startswith("--")
    )
    statements = [statement.strip() for statement in sql.split(";") if statement.strip() and not statement.strip().startswith("--")]
    for statement in statements:
        cursor.execute(statement)


def find_existing_outcome(cursor, promise_id: int, outcome: dict[str, Any]) -> dict[str, Any] | None:
    summary = normalize_nullable_text(outcome.get("outcome_summary"))
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
    for row in cursor.fetchall():
        if normalize_nullable_text(row.get("outcome_summary")) == summary:
            return row
    return None


def policy_outcome_payload(item: dict[str, Any], outcome: dict[str, Any], target: dict[str, Any]) -> dict[str, Any] | None:
    summary = normalize_nullable_text(outcome.get("outcome_summary"))
    if summary is None:
        return None
    confidence_score = normalize_confidence_score(
        item.get("confidence_score") or (item.get("record") or {}).get("confidence_score") or (item.get("record") or {}).get("confidence")
    )
    source_quality = normalize_source_quality(item.get("source_quality") or (item.get("record") or {}).get("source_quality"))
    source_total = source_count(item.get("record") or {})
    status = normalize_outcome_status(
        outcome.get("status_override") or outcome.get("status") or (item.get("record") or {}).get("status") or (item.get("record") or {}).get("bill_status")
    )
    return {
        "policy_type": target["policy_type"],
        "policy_id": target["policy_id"],
        "record_key": item.get("record_key"),
        "outcome_summary": summary,
        "outcome_summary_hash": outcome_summary_hash(summary),
        "outcome_type": normalize_nullable_text(outcome.get("outcome_type")),
        "measurable_impact": normalize_nullable_text(outcome.get("measurable_impact")),
        "impact_direction": normalize_impact_direction(outcome.get("impact_direction")),
        "evidence_strength": normalize_unified_evidence_strength(outcome.get("evidence_strength") or item.get("source_quality")),
        "confidence_score": confidence_score,
        "source_count": source_total,
        "source_quality": source_quality,
        "status": status,
        "black_community_impact_note": normalize_nullable_text(
            outcome.get("black_community_impact_note") or (item.get("record") or {}).get("notes")
        ),
    }


def find_existing_policy_outcome(cursor, payload: dict[str, Any]) -> dict[str, Any] | None:
    cursor.execute(
        """
        SELECT *
        FROM policy_outcomes
        WHERE policy_type = %s
          AND policy_id = %s
          AND outcome_summary_hash = %s
        ORDER BY id ASC
        """,
        (payload["policy_type"], payload["policy_id"], payload["outcome_summary_hash"]),
    )
    for row in cursor.fetchall():
        if normalize_nullable_text(row.get("outcome_summary")) == normalize_nullable_text(payload.get("outcome_summary")):
            return row
    return None


def insert_policy_outcome(cursor, payload: dict[str, Any]) -> int:
    cursor.execute(
        """
        INSERT INTO policy_outcomes (
          policy_type,
          policy_id,
          record_key,
          outcome_summary,
          outcome_summary_hash,
          outcome_type,
          measurable_impact,
          impact_direction,
          evidence_strength,
          confidence_score,
          source_count,
          source_quality,
          status,
          black_community_impact_note
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            payload["policy_type"],
            payload["policy_id"],
            payload["record_key"],
            payload["outcome_summary"],
            payload["outcome_summary_hash"],
            payload["outcome_type"],
            payload["measurable_impact"],
            payload["impact_direction"],
            payload["evidence_strength"],
            payload["confidence_score"],
            payload["source_count"],
            payload["source_quality"],
            payload["status"],
            payload["black_community_impact_note"],
        ),
    )
    return int(cursor.lastrowid)


def preserve_policy_outcome(report: dict[str, Any], item: dict[str, Any], existing: dict[str, Any], reason: str) -> None:
    report["policy_outcomes_preserved"] += 1
    report["preservation_events"].append(
        {
            "record_key": item.get("record_key"),
            "policy_outcome_id": int(existing["id"]),
            "policy_type": existing.get("policy_type"),
            "policy_id": int(existing["policy_id"]),
            "reason": reason,
        }
    )


def insert_unified_policy_outcomes(cursor, item: dict[str, Any], report: dict[str, Any]) -> int:
    target = resolve_policy_target(cursor, item)
    if not target:
        report["impact_skipped_count"] += 1
        report["skipped_items"].append(
            {
                "record_key": item.get("record_key"),
                "reason": "matching policy record was not found for policy_outcomes insert",
            }
        )
        return 0
    created = 0
    for outcome in outcome_list(item.get("record") or {}):
        payload = policy_outcome_payload(item, outcome, target)
        if payload is None:
            continue
        existing = find_existing_policy_outcome(cursor, payload)
        if existing:
            preserve_policy_outcome(report, item, existing, "existing unified policy outcome preserved")
            continue
        policy_outcome_id = insert_policy_outcome(cursor, payload)
        created += 1
        report["policy_outcomes_created"] += 1
        report["promotion_events"].append(
            {
                "record_key": item.get("record_key"),
                "policy_type": payload["policy_type"],
                "policy_id": payload["policy_id"],
                "policy_outcome_id": policy_outcome_id,
                "reason": "created unified policy_outcomes row",
            }
        )
    if created == 0 and not outcome_list(item.get("record") or {}):
        report["impact_skipped_count"] += 1
        report["skipped_items"].append({"record_key": item.get("record_key"), "reason": "no outcome payload available"})
    return created


def insert_outcomes(cursor, item: dict[str, Any], report: dict[str, Any]) -> int:
    if item.get("record_type") != "current_admin":
        report["impact_preserved_count"] += 1
        report["preservation_events"].append(
            {
                "record_key": item.get("record_key"),
                "reason": "outcome insertion is only available for current-admin promise records in the existing schema",
            }
        )
        return 0
    promise = find_promise(cursor, item)
    if not promise:
        report["impact_skipped_count"] += 1
        report["skipped_items"].append({"record_key": item.get("record_key"), "reason": "matching promise was not found"})
        return 0

    created = 0
    for outcome in outcome_list(item.get("record") or {}):
        if not normalize_nullable_text(outcome.get("outcome_summary")):
            continue
        existing = find_existing_outcome(cursor, int(promise["id"]), outcome)
        if existing:
            report["existing_outcomes_preserved"] += 1
            report["preservation_events"].append(
                {
                    "record_key": item.get("record_key"),
                    "promise_id": int(promise["id"]),
                    "outcome_id": int(existing["id"]),
                    "reason": "existing outcome preserved",
                }
            )
            continue
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
                int(promise["id"]),
                outcome.get("outcome_summary"),
                outcome.get("outcome_type"),
                outcome.get("measurable_impact"),
                outcome.get("impact_direction"),
                outcome.get("black_community_impact_note"),
                map_evidence_strength(outcome.get("evidence_strength")),
                outcome.get("status_override"),
            ),
        )
        created += 1
        report["new_outcomes_created"] += 1
    return created


def transition_decision(item: dict[str, Any], *, approve_safe: bool) -> tuple[bool, str | None]:
    previous = normalize_impact_status(item.get("previous_impact_status"))
    new = normalize_impact_status(item.get("recommended_impact_status"))
    if previous is None or new is None:
        return False, "missing or invalid impact status"
    if previous == new:
        return False, "no forward transition recommended"
    if not valid_forward_transition(previous, new):
        return False, f"unsafe transition: {previous} -> {new}"
    if not (item.get("approved") is True or approve_safe):
        return False, "transition is not operator-approved"
    return True, None


def update_ledger(ledger: dict[str, Any], item: dict[str, Any], *, output_path: Path) -> None:
    key = item["record_key"]
    previous = item["previous_impact_status"]
    new = item["recommended_impact_status"]
    transition = {
        "record_key": key,
        "record_type": item.get("record_type"),
        "title": item.get("title"),
        "source_evaluation": str(output_path),
        "previous_impact_status": previous,
        "new_impact_status": new,
        "reasoning": item.get("reasoning") or [],
        "promoted_at": utc_timestamp(),
    }
    ledger.setdefault("records", {})[key] = {
        "record_key": key,
        "record_type": item.get("record_type"),
        "title": item.get("title"),
        "impact_status": new,
        "source_evaluation": str(output_path),
        "updated_at": transition["promoted_at"],
    }
    ledger.setdefault("transitions", []).append(transition)
    ledger["updated_at"] = transition["promoted_at"]


def append_promotion_report_to_ledger(ledger: dict[str, Any], report: dict[str, Any], report_path: Path) -> None:
    event = {
        "promotion_report": str(report_path),
        "source_evaluation": report.get("source_evaluation"),
        "mode": report.get("mode"),
        "recorded_at": utc_timestamp(),
        "impact_promoted_count": report.get("impact_promoted_count", 0),
        "impact_skipped_count": report.get("impact_skipped_count", 0),
        "impact_preserved_count": report.get("impact_preserved_count", 0),
        "new_outcomes_created": report.get("new_outcomes_created", 0),
        "existing_outcomes_preserved": report.get("existing_outcomes_preserved", 0),
        "policy_outcomes_created": report.get("policy_outcomes_created", 0),
        "policy_outcomes_preserved": report.get("policy_outcomes_preserved", 0),
        "promotion_events": report.get("promotion_events") or [],
        "preservation_events": report.get("preservation_events") or [],
        "skipped_items": report.get("skipped_items") or [],
    }
    ledger.setdefault("promotion_reports", []).append(event)
    ledger["updated_at"] = event["recorded_at"]


def run_promote(args: argparse.Namespace) -> None:
    if args.apply and args.dry_run:
        raise SystemExit("Use either --dry-run or --apply --yes for impact promotion")
    require_apply_confirmation(args.apply, args.yes)
    input_path = args.input.resolve()
    payload = load_json_file(input_path)
    if not isinstance(payload, dict):
        raise ValueError("Maturation evaluation artifact must be a JSON object")
    items = [item for item in payload.get("items") or [] if isinstance(item, dict)]
    if args.only_record_key:
        wanted = set(args.only_record_key)
        items = [item for item in items if item.get("record_key") in wanted or item.get("slug") in wanted]

    report = {
        "artifact_version": 1,
        "generated_at": utc_timestamp(),
        "mode": "apply" if args.apply else "dry_run",
        "workflow": "impact_maturation_promotion",
        "source_evaluation": str(input_path),
        "ledger_path": str(args.ledger.resolve()),
        "precommit": {
            "readiness_status": "ready",
            "blocking_issue_count": 0,
            "warnings": [],
            "blocked_items": [],
        },
        "impact_promoted_count": 0,
        "impact_skipped_count": 0,
        "impact_preserved_count": 0,
        "new_outcomes_created": 0,
        "existing_outcomes_preserved": 0,
        "policy_outcomes_created": 0,
        "policy_outcomes_preserved": 0,
        "promotion_events": [],
        "preservation_events": [],
        "skipped_items": [],
    }

    approved_items: list[dict[str, Any]] = []
    for item in items:
        ok, reason = transition_decision(item, approve_safe=args.approve_safe)
        if ok:
            approved_items.append(item)
            continue
        if reason and reason.startswith("unsafe"):
            report["precommit"]["blocked_items"].append({"record_key": item.get("record_key"), "reason": reason})
        else:
            report["skipped_items"].append({"record_key": item.get("record_key"), "reason": reason})
            report["impact_skipped_count"] += 1

    report["precommit"]["blocking_issue_count"] = len(report["precommit"]["blocked_items"])
    if report["precommit"]["blocking_issue_count"]:
        report["precommit"]["readiness_status"] = "blocked"
    elif report["skipped_items"]:
        report["precommit"]["readiness_status"] = "ready_with_warnings"
        report["precommit"]["warnings"].append("some transitions were skipped because they were unchanged or not approved")

    ledger = load_ledger(args.ledger.resolve())
    if report["precommit"]["readiness_status"] == "blocked":
        write_json_file(args.output.resolve(), report)
        print_json(report)
        raise SystemExit(1 if args.apply else 0)

    needs_db = any(item.get("recommended_impact_status") in SCORING_READY_STATES for item in approved_items)
    connection = get_db_connection() if args.apply and needs_db else None
    try:
        cursor = connection.cursor() if connection else None
        if cursor is not None:
            ensure_policy_outcomes_table(cursor)
        for item in approved_items:
            previous = item["previous_impact_status"]
            new = item["recommended_impact_status"]
            if stronger_or_equal((ledger.get("records") or {}).get(item["record_key"], {}).get("impact_status"), new):
                report["impact_preserved_count"] += 1
                report["preservation_events"].append(
                    {
                        "record_key": item["record_key"],
                        "previous_impact_status": previous,
                        "new_impact_status": new,
                        "reason": "ledger already has same or stronger impact status",
                    }
                )
                continue
            if new in SCORING_READY_STATES and cursor is not None:
                insert_outcomes(cursor, item, report)
                insert_unified_policy_outcomes(cursor, item, report)
            elif new not in SCORING_READY_STATES:
                report["precommit"]["warnings"].append("outcome insertion deferred for impact_review_ready transitions")

            report["impact_promoted_count"] += 1
            event = {
                "record_key": item["record_key"],
                "record_type": item.get("record_type"),
                "title": item.get("title"),
                "source_evaluation": str(input_path),
                "previous_impact_status": previous,
                "new_impact_status": new,
                "reasoning": item.get("reasoning") or [],
            }
            report["promotion_events"].append(event)
            if args.apply:
                update_ledger(ledger, item, output_path=input_path)

        if connection:
            connection.commit()
    except Exception:
        if connection:
            connection.rollback()
        raise
    finally:
        if connection:
            connection.close()

    write_json_file(args.output.resolve(), report)
    if args.apply:
        append_promotion_report_to_ledger(ledger, report, args.output.resolve())
        write_json_file(args.ledger.resolve(), ledger)
    print_json(report)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Evaluate and safely promote impact maturation transitions.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    evaluate = subparsers.add_parser("evaluate", help="Build an impact maturation review artifact")
    evaluate.add_argument("--input", type=Path, action="append", help="Input artifact to inspect. May be repeated.")
    evaluate.add_argument("--output", type=Path, default=default_evaluation_output(), help="Maturation review artifact output")
    evaluate.add_argument("--ledger", type=Path, default=default_ledger_path(), help="Local impact maturation status ledger")
    evaluate.add_argument("--only-record-key", action="append", help="Limit to a specific record key or slug")
    evaluate.set_defaults(func=run_evaluate)

    promote = subparsers.add_parser("promote", help="Promote approved safe impact maturation transitions")
    promote.add_argument("--input", type=Path, default=default_evaluation_output(), help="Maturation review artifact input")
    promote.add_argument("--output", type=Path, default=default_promotion_output(), help="Promotion/pre-commit report output")
    promote.add_argument("--ledger", type=Path, default=default_ledger_path(), help="Local impact maturation status ledger")
    promote.add_argument("--dry-run", action="store_true", help="Preview promotion only")
    promote.add_argument("--apply", action="store_true", help="Apply approved safe transitions")
    promote.add_argument("--yes", action="store_true", help="Required confirmation for --apply")
    promote.add_argument("--approve-safe", action="store_true", help="Treat every safe forward transition as explicitly approved")
    promote.add_argument("--only-record-key", action="append", help="Limit to a specific record key or slug")
    promote.set_defaults(func=run_promote)
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
