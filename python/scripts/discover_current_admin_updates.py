#!/usr/bin/env python3
import argparse
import json
import re
import sys
import xml.etree.ElementTree as ET
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import requests

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from lib.llm.provider import generate_text

from current_admin_common import (
    derive_csv_path,
    get_current_admin_reports_dir,
    get_db_connection,
    normalize_date,
    normalize_nullable_text,
    normalize_text,
    print_json,
    write_csv_rows,
    write_json_file,
)


DEFAULT_OLLAMA_URL = ""
DEFAULT_MODEL = "qwen3.5:9b"
DEFAULT_TIMEOUT = 240
DEFAULT_TEMPERATURE = 0.1
DEFAULT_PRESIDENT_SLUG = "donald-j-trump-2025"

STOPWORDS = {
    "about",
    "after",
    "against",
    "america",
    "american",
    "and",
    "announces",
    "before",
    "between",
    "from",
    "into",
    "over",
    "president",
    "review",
    "state",
    "states",
    "their",
    "this",
    "through",
    "under",
    "with",
}

POSITIVE_HINTS = {"expand", "promote", "support", "protect", "restore", "improve", "increase", "strengthen"}
NEGATIVE_HINTS = {"end", "terminate", "remove", "revoke", "restrict", "block", "cut", "eliminate"}
TOPIC_KEYWORDS = {
    "Voting Rights": {"vote", "voter", "election", "ballot", "citizenship", "registration"},
    "Criminal Justice": {"crime", "police", "law", "enforcement", "justice", "cartel", "prison"},
    "Housing": {"housing", "homeless", "encampment", "rent", "mortgage", "homeownership", "suburb"},
    "Education": {"school", "education", "student", "students", "college", "hbcu", "accreditation", "discipline"},
    "Economic Opportunity": {"job", "jobs", "worker", "workers", "trade", "apprentice", "apprenticeship", "dei"},
    "Healthcare": {"health", "medicare", "medicine", "medicines", "drug", "drugs", "care", "pharmaceutical"},
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Discover possible current-administration Promise Tracker updates without mutating the database."
    )
    parser.add_argument("--president-slug", default=DEFAULT_PRESIDENT_SLUG, help="Presidency term slug to analyze")
    parser.add_argument(
        "--output",
        type=Path,
        default=get_current_admin_reports_dir() / "discovery_report.json",
        help="Discovery report JSON output",
    )
    parser.add_argument("--dry-run", action="store_true", help="Skip Ollama calls and use heuristics only")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="Ollama model name")
    parser.add_argument("--ollama-url", default=DEFAULT_OLLAMA_URL, help="Base URL for the Ollama server")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT, help="Per-request timeout in seconds")
    parser.add_argument("--temperature", type=float, default=DEFAULT_TEMPERATURE, help="Sampling temperature for Ollama")
    parser.add_argument("--lookback-days", type=int, default=120, help="Mark in-progress records as stale after this many days without action")
    parser.add_argument("--max-promises", type=int, help="Limit the number of current-administration promises analyzed")
    parser.add_argument("--max-feed-items", type=int, default=20, help="Cap the number of fetched feed items")
    parser.add_argument("--feed-url", action="append", help="Optional RSS/Atom feed URL to inspect")
    parser.add_argument("--feed-json", action="append", type=Path, help="Optional local JSON file with feed-like items")
    parser.add_argument(
        "--csv",
        nargs="?",
        const="",
        help="Optionally write a CSV summary. Pass a path or omit the value to derive one from --output.",
    )
    return parser.parse_args()


def normalize_confidence(value: Any) -> str:
    normalized = (normalize_nullable_text(value) or "").lower()
    if normalized in {"high", "strong"}:
        return "High"
    if normalized in {"medium", "moderate"}:
        return "Medium"
    if normalized in {"low", "weak"}:
        return "Low"
    return "Medium"


def tokenize(text: Any) -> set[str]:
    tokens = set(re.findall(r"[a-z0-9]+", normalize_text(text).lower()))
    return {token for token in tokens if len(token) > 2 and token not in STOPWORDS}


def estimate_topic(text: str) -> str | None:
    tokens = tokenize(text)
    best_topic = None
    best_score = 0
    for topic, keywords in TOPIC_KEYWORDS.items():
        score = len(tokens & keywords)
        if score > best_score:
            best_score = score
            best_topic = topic
    return best_topic


def estimate_impact_direction(text: str) -> str:
    tokens = tokenize(text)
    if tokens & POSITIVE_HINTS and not tokens & NEGATIVE_HINTS:
        return "Positive"
    if tokens & NEGATIVE_HINTS and not tokens & POSITIVE_HINTS:
        return "Negative"
    return "Mixed"


def estimate_evidence_strength(source_url: Any) -> str:
    url = normalize_text(source_url).lower()
    if any(host in url for host in ("whitehouse.gov", "congress.gov", "federalregister.gov")):
        return "Strong"
    if url:
        return "Moderate"
    return "Limited"


def call_ollama(prompt: str, *, model: str, ollama_url: str, timeout: int, temperature: float) -> dict[str, Any]:
    raw_text = generate_text(
        prompt,
        model=model,
        endpoint=ollama_url or None,
        timeout_seconds=timeout,
        temperature=temperature,
        response_format="json",
    )
    return json.loads(raw_text or "{}")


def fetch_promises(president_slug: str, max_promises: int | None) -> list[dict[str, Any]]:
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            limit_clause = f"LIMIT {int(max_promises)}" if max_promises else ""
            cursor.execute(
                f"""
                SELECT
                  p.id,
                  p.slug,
                  p.title,
                  p.topic,
                  p.status,
                  p.summary,
                  p.impacted_group,
                  p.notes,
                  p.promise_date,
                  pr.slug AS president_slug,
                  COUNT(DISTINCT pa.id) AS action_count,
                  COUNT(DISTINCT po.id) AS outcome_count,
                  COUNT(DISTINCT ps.source_id) AS promise_source_count,
                  MAX(pa.action_date) AS latest_action_date
                FROM promises p
                JOIN presidents pr ON pr.id = p.president_id
                LEFT JOIN promise_actions pa ON pa.promise_id = p.id
                LEFT JOIN promise_outcomes po ON po.promise_id = p.id
                LEFT JOIN promise_sources ps ON ps.promise_id = p.id
                WHERE pr.slug = %s
                GROUP BY
                  p.id, p.slug, p.title, p.topic, p.status, p.summary, p.impacted_group, p.notes, p.promise_date, pr.slug
                ORDER BY COALESCE(MAX(pa.action_date), p.promise_date) DESC, p.id DESC
                {limit_clause}
                """,
                (president_slug,),
            )
            promises = cursor.fetchall()
            if not promises:
                return []

            promise_ids = [int(row["id"]) for row in promises]
            placeholders = ", ".join(["%s"] * len(promise_ids))

            cursor.execute(
                f"""
                SELECT
                  pa.id,
                  pa.promise_id,
                  pa.action_type,
                  pa.action_date,
                  pa.title,
                  pa.description,
                  COUNT(DISTINCT pas.source_id) AS action_source_count
                FROM promise_actions pa
                LEFT JOIN promise_action_sources pas ON pas.promise_action_id = pa.id
                WHERE pa.promise_id IN ({placeholders})
                GROUP BY pa.id, pa.promise_id, pa.action_type, pa.action_date, pa.title, pa.description
                ORDER BY pa.action_date DESC, pa.id DESC
                """,
                promise_ids,
            )
            actions = cursor.fetchall()

            cursor.execute(
                f"""
                SELECT
                  po.id,
                  po.promise_id,
                  po.outcome_summary,
                  po.outcome_type,
                  po.impact_direction,
                  po.evidence_strength,
                  po.status_override,
                  COUNT(DISTINCT pos.source_id) AS outcome_source_count
                FROM promise_outcomes po
                LEFT JOIN promise_outcome_sources pos ON pos.promise_outcome_id = po.id
                WHERE po.promise_id IN ({placeholders})
                GROUP BY
                  po.id, po.promise_id, po.outcome_summary, po.outcome_type, po.impact_direction, po.evidence_strength, po.status_override
                ORDER BY po.id DESC
                """,
                promise_ids,
            )
            outcomes = cursor.fetchall()

            cursor.execute(
                f"""
                SELECT
                  ps.promise_id,
                  s.source_title,
                  s.source_url,
                  s.source_type,
                  s.publisher,
                  s.published_date
                FROM promise_sources ps
                JOIN sources s ON s.id = ps.source_id
                WHERE ps.promise_id IN ({placeholders})
                ORDER BY s.published_date DESC, s.id DESC
                """,
                promise_ids,
            )
            promise_sources = cursor.fetchall()

        action_index: dict[int, list[dict[str, Any]]] = {}
        for row in actions:
            action_index.setdefault(int(row["promise_id"]), []).append(
                {
                    "id": int(row["id"]),
                    "action_type": row["action_type"],
                    "action_date": normalize_date(row["action_date"]),
                    "title": row["title"],
                    "description": row["description"],
                    "action_source_count": int(row["action_source_count"] or 0),
                }
            )

        outcome_index: dict[int, list[dict[str, Any]]] = {}
        for row in outcomes:
            outcome_index.setdefault(int(row["promise_id"]), []).append(
                {
                    "id": int(row["id"]),
                    "outcome_summary": row["outcome_summary"],
                    "outcome_type": row["outcome_type"],
                    "impact_direction": row["impact_direction"],
                    "evidence_strength": row["evidence_strength"],
                    "status_override": row["status_override"],
                    "outcome_source_count": int(row["outcome_source_count"] or 0),
                }
            )

        source_index: dict[int, list[dict[str, Any]]] = {}
        for row in promise_sources:
            source_index.setdefault(int(row["promise_id"]), []).append(
                {
                    "source_title": row["source_title"],
                    "source_url": row["source_url"],
                    "source_type": row["source_type"],
                    "publisher": row["publisher"],
                    "published_date": normalize_date(row["published_date"]),
                }
            )

        hydrated = []
        for row in promises:
            promise_id = int(row["id"])
            hydrated.append(
                {
                    "id": promise_id,
                    "slug": row["slug"],
                    "title": row["title"],
                    "topic": row["topic"],
                    "status": row["status"],
                    "summary": row["summary"],
                    "impacted_group": row["impacted_group"],
                    "notes": row["notes"],
                    "promise_date": normalize_date(row["promise_date"]),
                    "president_slug": row["president_slug"],
                    "action_count": int(row["action_count"] or 0),
                    "outcome_count": int(row["outcome_count"] or 0),
                    "promise_source_count": int(row["promise_source_count"] or 0),
                    "latest_action_date": normalize_date(row["latest_action_date"]),
                    "actions": action_index.get(promise_id, []),
                    "outcomes": outcome_index.get(promise_id, []),
                    "promise_sources": source_index.get(promise_id, [])[:5],
                }
            )
        return hydrated
    finally:
        connection.close()


def load_local_feed_items(path: Path) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text())
    if isinstance(payload, dict):
        items = payload.get("items") or []
    elif isinstance(payload, list):
        items = payload
    else:
        raise ValueError(f"Unsupported feed JSON shape: {path}")
    normalized_items = []
    for item in items:
        normalized_items.append(
            {
                "title": normalize_text(item.get("title")),
                "url": normalize_nullable_text(item.get("url") or item.get("link")),
                "published_at": normalize_date(item.get("published_at") or item.get("published") or item.get("date")),
                "summary": normalize_text(item.get("summary") or item.get("description")),
                "source_name": normalize_text(item.get("source_name") or path.name),
                "source_type": normalize_text(item.get("source_type") or "Local Feed JSON"),
            }
        )
    return normalized_items


def parse_feed_xml(raw_xml: str, source_name: str) -> list[dict[str, Any]]:
    root = ET.fromstring(raw_xml)
    items = []

    for item in root.findall(".//item"):
        title = normalize_text(item.findtext("title"))
        link = normalize_nullable_text(item.findtext("link"))
        description = normalize_text(item.findtext("description"))
        pub_date = normalize_date(item.findtext("pubDate"))
        items.append(
            {
                "title": title,
                "url": link,
                "published_at": pub_date,
                "summary": description,
                "source_name": source_name,
                "source_type": "RSS",
            }
        )

    namespace = {"atom": "http://www.w3.org/2005/Atom"}
    for entry in root.findall(".//atom:entry", namespace):
        title = normalize_text(entry.findtext("atom:title", default="", namespaces=namespace))
        summary = normalize_text(entry.findtext("atom:summary", default="", namespaces=namespace))
        published = normalize_date(
            entry.findtext("atom:updated", default="", namespaces=namespace)
            or entry.findtext("atom:published", default="", namespaces=namespace)
        )
        link = None
        for link_node in entry.findall("atom:link", namespace):
            href = normalize_nullable_text(link_node.attrib.get("href"))
            if href:
                link = href
                break
        items.append(
            {
                "title": title,
                "url": link,
                "published_at": published,
                "summary": summary,
                "source_name": source_name,
                "source_type": "Atom",
            }
        )

    return [item for item in items if item["title"]]


def fetch_remote_feed_items(feed_url: str, timeout: int) -> list[dict[str, Any]]:
    response = requests.get(feed_url, timeout=timeout)
    response.raise_for_status()
    return parse_feed_xml(response.text, feed_url)


def compact_promise_context(promises: list[dict[str, Any]], limit: int = 8) -> list[dict[str, Any]]:
    context = []
    for promise in promises[:limit]:
        latest_action = (promise.get("actions") or [None])[0]
        latest_outcome = (promise.get("outcomes") or [None])[0]
        context.append(
            {
                "slug": promise.get("slug"),
                "title": promise.get("title"),
                "topic": promise.get("topic"),
                "status": promise.get("status"),
                "latest_action_date": promise.get("latest_action_date"),
                "latest_action_title": latest_action.get("title") if latest_action else None,
                "latest_outcome_direction": latest_outcome.get("impact_direction") if latest_outcome else None,
            }
        )
    return context


def score_feed_match(feed_item: dict[str, Any], promise: dict[str, Any]) -> float:
    feed_tokens = tokenize(f"{feed_item.get('title')} {feed_item.get('summary')}")
    promise_tokens = tokenize(f"{promise.get('title')} {promise.get('summary')} {promise.get('topic')}")
    if not feed_tokens or not promise_tokens:
        return 0.0
    overlap = len(feed_tokens & promise_tokens)
    return overlap / max(len(feed_tokens), 1)


def best_promise_match(feed_item: dict[str, Any], promises: list[dict[str, Any]]) -> tuple[dict[str, Any] | None, float]:
    best = None
    best_score = 0.0
    for promise in promises:
        score = score_feed_match(feed_item, promise)
        if score > best_score:
            best = promise
            best_score = score
    return best, best_score


def heuristic_feed_suggestion(feed_item: dict[str, Any], promises: list[dict[str, Any]]) -> dict[str, Any]:
    matched_promise, match_score = best_promise_match(feed_item, promises)
    combined_text = f"{feed_item.get('title')} {feed_item.get('summary')}"
    topic = estimate_topic(combined_text)
    impact_direction = estimate_impact_direction(combined_text)
    evidence_strength = estimate_evidence_strength(feed_item.get("url"))
    caution_flags = []

    if len(normalize_text(feed_item.get("summary"))) < 40:
        caution_flags.append("thin_source_summary")
    if not feed_item.get("published_at"):
        caution_flags.append("missing_published_date")

    if matched_promise and match_score >= 0.18:
        latest_action_date = matched_promise.get("latest_action_date")
        suggestion_type = "update_existing_action"
        if feed_item.get("published_at") and feed_item.get("published_at") != latest_action_date:
            suggestion_type = "new_action"
        return {
            "suggestion_type": suggestion_type,
            "linked_promise_slug": matched_promise.get("slug"),
            "confidence": "High" if match_score >= 0.3 else "Medium",
            "reasoning": (
                f"The feed item overlaps strongly with the tracked promise '{matched_promise.get('title')}' "
                f"and may represent a newer action or source update."
            ),
            "suggested_fields": {
                "title": normalize_text(feed_item.get("title")),
                "summary": normalize_text(feed_item.get("summary"))[:280],
                "topic": matched_promise.get("topic") or topic,
                "impact_direction": impact_direction,
                "evidence_strength": evidence_strength,
            },
            "caution_flags": caution_flags,
        }

    return {
        "suggestion_type": "new_promise_candidate",
        "linked_promise_slug": None,
        "confidence": "Medium" if topic else "Low",
        "reasoning": "The feed item does not align cleanly with an existing tracked promise and may represent an untracked promise candidate.",
        "suggested_fields": {
            "title": normalize_text(feed_item.get("title")),
            "summary": normalize_text(feed_item.get("summary"))[:280],
            "topic": topic,
            "impact_direction": impact_direction,
            "evidence_strength": evidence_strength,
        },
        "caution_flags": caution_flags + (["topic_unclear"] if topic is None else []),
    }


def build_feed_prompt(feed_item: dict[str, Any], promise_context: list[dict[str, Any]]) -> str:
    return f"""
You are assisting with discovery suggestions for current-administration Promise Tracker records.

Return strict JSON with these keys:
- suggestion_type
- linked_promise_slug
- confidence
- reasoning
- suggested_fields
- caution_flags

Rules:
- advisory only
- never claim certainty you do not have
- do not invent facts
- suggestion_type must be one of: new_action, update_existing_action, new_promise_candidate, ignore
- confidence must be one of: High, Medium, Low
- suggested_fields must be an object with:
  - title
  - summary
  - topic
  - impact_direction
  - evidence_strength
- topic should be one of: Voting Rights, Criminal Justice, Housing, Education, Economic Opportunity, Healthcare, or null
- impact_direction should be one of: Positive, Negative, Mixed, Blocked, or null
- evidence_strength should be one of: Strong, Moderate, Limited, or null
- linked_promise_slug should be null for new_promise_candidate or ignore

Feed item:
{json.dumps(feed_item, indent=2)}

Existing current-administration promise context:
{json.dumps(promise_context, indent=2)}
""".strip()


def sanitize_ollama_suggestion(payload: dict[str, Any]) -> dict[str, Any]:
    suggested_fields = payload.get("suggested_fields")
    if not isinstance(suggested_fields, dict):
        suggested_fields = {}
    suggestion_type = normalize_nullable_text(payload.get("suggestion_type")) or "ignore"
    if suggestion_type not in {"new_action", "update_existing_action", "new_promise_candidate", "ignore"}:
        suggestion_type = "ignore"
    return {
        "suggestion_type": suggestion_type,
        "linked_promise_slug": normalize_nullable_text(payload.get("linked_promise_slug")),
        "confidence": normalize_confidence(payload.get("confidence")),
        "reasoning": normalize_text(payload.get("reasoning")),
        "suggested_fields": {
            "title": normalize_nullable_text(suggested_fields.get("title")),
            "summary": normalize_nullable_text(suggested_fields.get("summary")),
            "topic": normalize_nullable_text(suggested_fields.get("topic")),
            "impact_direction": normalize_nullable_text(suggested_fields.get("impact_direction")),
            "evidence_strength": normalize_nullable_text(suggested_fields.get("evidence_strength")),
        },
        "caution_flags": [normalize_text(flag) for flag in (payload.get("caution_flags") or []) if normalize_text(flag)],
    }


def compact_linked_promise(promise: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": promise.get("id"),
        "slug": promise.get("slug"),
        "title": promise.get("title"),
        "topic": promise.get("topic"),
        "status": promise.get("status"),
        "summary": promise.get("summary"),
        "impacted_group": promise.get("impacted_group"),
        "notes": promise.get("notes"),
        "promise_date": promise.get("promise_date"),
        "latest_action_date": promise.get("latest_action_date"),
        "action_count": promise.get("action_count"),
        "outcome_count": promise.get("outcome_count"),
        "promise_source_count": promise.get("promise_source_count"),
        "promise_sources": promise.get("promise_sources") or [],
        "actions": promise.get("actions") or [],
        "outcomes": promise.get("outcomes") or [],
    }


def build_maintenance_candidates(promises: list[dict[str, Any]], lookback_days: int) -> list[dict[str, Any]]:
    stale_before = datetime.now(UTC).date() - timedelta(days=lookback_days)
    candidates = []
    for promise in promises:
        source_refs = list(promise.get("promise_sources") or [])[:3]
        linked_promise = compact_linked_promise(promise)

        if int(promise.get("action_count") or 0) < 1:
            candidates.append(
                {
                    "candidate_type": "missing_action_record",
                    "linked_promise": linked_promise,
                    "suggested_changes": {"focus": ["actions", "sources"]},
                    "reasoning": "This tracked promise has no recorded actions and should be reviewed for current-term implementation activity.",
                    "confidence": "High",
                    "source_references": source_refs,
                }
            )

        if int(promise.get("outcome_count") or 0) < 1:
            candidates.append(
                {
                    "candidate_type": "missing_outcome_record",
                    "linked_promise": linked_promise,
                    "suggested_changes": {"focus": ["outcomes", "evidence_strength", "sources"]},
                    "reasoning": "This tracked promise has actions but no recorded outcome and may need a current evidence review.",
                    "confidence": "High",
                    "source_references": source_refs,
                }
            )

        latest_action_date = normalize_date(promise.get("latest_action_date"))
        if promise.get("status") in {"In Progress", "Partial"}:
            if latest_action_date is None:
                candidates.append(
                    {
                        "candidate_type": "stale_record",
                        "linked_promise": linked_promise,
                        "suggested_changes": {"focus": ["actions", "outcomes", "sources"]},
                        "reasoning": "This in-progress record has no dated action history and should be checked for updates or stronger sourcing.",
                        "confidence": "Medium",
                        "source_references": source_refs,
                    }
                )
            else:
                try:
                    action_date_obj = datetime.fromisoformat(latest_action_date).date()
                except ValueError:
                    action_date_obj = None
                if action_date_obj and action_date_obj < stale_before:
                    candidates.append(
                        {
                            "candidate_type": "stale_record",
                            "linked_promise": linked_promise,
                            "suggested_changes": {"focus": ["actions", "outcomes", "sources"]},
                            "reasoning": (
                                f"The latest recorded action is {latest_action_date}, older than the {lookback_days}-day review window "
                                "for an in-progress current-administration record."
                            ),
                            "confidence": "Medium",
                            "source_references": source_refs,
                        }
                    )

        weak_outcomes = [
            outcome
            for outcome in promise.get("outcomes") or []
            if normalize_nullable_text(outcome.get("evidence_strength")) in {None, "Limited"}
            or int(outcome.get("outcome_source_count") or 0) < 1
        ]
        if weak_outcomes:
            candidates.append(
                {
                    "candidate_type": "weak_evidence",
                    "linked_promise": linked_promise,
                    "suggested_changes": {
                        "focus": ["outcomes", "outcome_sources"],
                        "weak_outcome_count": len(weak_outcomes),
                    },
                    "reasoning": "One or more outcomes have limited evidence strength or no linked outcome source and should be reviewed.",
                    "confidence": "Medium",
                    "source_references": source_refs,
                }
            )

        thin_actions = [action for action in promise.get("actions") or [] if int(action.get("action_source_count") or 0) < 1]
        if thin_actions or int(promise.get("promise_source_count") or 0) < 1:
            candidates.append(
                {
                    "candidate_type": "thin_sourcing",
                    "linked_promise": linked_promise,
                    "suggested_changes": {
                        "focus": ["promise_sources", "action_sources"],
                        "thin_action_count": len(thin_actions),
                    },
                    "reasoning": "The record has thin source linking at the promise or action level and should be strengthened before later scoring updates.",
                    "confidence": "Medium",
                    "source_references": source_refs,
                }
            )

    return candidates


def analyze_feed_items(
    feed_items: list[dict[str, Any]],
    promises: list[dict[str, Any]],
    *,
    dry_run: bool,
    model: str,
    ollama_url: str,
    timeout: int,
    temperature: float,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    new_action_candidates = []
    update_candidates = []
    new_promise_candidates = []
    promise_context = compact_promise_context(promises)

    for feed_item in feed_items:
        if dry_run:
            suggestion = heuristic_feed_suggestion(feed_item, promises)
            review_mode = "dry-run"
            fallback_reason = None
        else:
            try:
                suggestion = sanitize_ollama_suggestion(
                    call_ollama(
                        build_feed_prompt(feed_item, promise_context),
                        model=model,
                        ollama_url=ollama_url,
                        timeout=timeout,
                        temperature=temperature,
                    )
                )
                review_mode = "ollama"
                fallback_reason = None
            except Exception as exc:  # noqa: BLE001
                suggestion = heuristic_feed_suggestion(feed_item, promises)
                suggestion.setdefault("caution_flags", []).append("ollama_fallback")
                fallback_reason = normalize_text(str(exc))
                suggestion["reasoning"] = f"{suggestion.get('reasoning')} Fallback reason: {fallback_reason}."
                review_mode = "fallback"

        candidate = {
            "candidate_type": suggestion.get("suggestion_type"),
            "linked_promise": None,
            "feed_item": feed_item,
            "suggested_changes": suggestion.get("suggested_fields"),
            "reasoning": suggestion.get("reasoning"),
            "confidence": suggestion.get("confidence"),
            "caution_flags": suggestion.get("caution_flags") or [],
            "requested_model": model,
            "effective_model": model if review_mode == "ollama" else None,
            "review_backend": review_mode,
            "fallback_used": review_mode == "fallback",
            "fallback_reason": fallback_reason,
            "model_resolution_status": "exact_requested" if review_mode == "ollama" else ("fallback_used" if review_mode == "fallback" else "dry_run"),
            "source_references": [
                {
                    "source_title": feed_item.get("title"),
                    "source_url": feed_item.get("url"),
                    "source_type": feed_item.get("source_type"),
                    "publisher": feed_item.get("source_name"),
                    "published_date": feed_item.get("published_at"),
                }
            ],
            "review_mode": review_mode,
        }

        linked_slug = suggestion.get("linked_promise_slug")
        if linked_slug:
            matched = next((promise for promise in promises if promise.get("slug") == linked_slug), None)
            if matched:
                candidate["linked_promise"] = compact_linked_promise(matched)

        if suggestion.get("suggestion_type") == "new_action":
            new_action_candidates.append(candidate)
        elif suggestion.get("suggestion_type") == "update_existing_action":
            update_candidates.append(candidate)
        elif suggestion.get("suggestion_type") == "new_promise_candidate":
            new_promise_candidates.append(candidate)

    return new_action_candidates, update_candidates, new_promise_candidates


def build_csv_rows(report: dict[str, Any]) -> list[dict[str, Any]]:
    rows = []
    for section_name in ("new_action_candidates", "update_candidates", "new_promise_candidates"):
        for item in report.get(section_name) or []:
            linked = item.get("linked_promise") or {}
            feed_item = item.get("feed_item") or {}
            suggested = item.get("suggested_changes") or {}
            rows.append(
                {
                    "section": section_name,
                    "candidate_type": item.get("candidate_type"),
                    "linked_promise_slug": linked.get("slug"),
                    "linked_promise_title": linked.get("title"),
                    "confidence": item.get("confidence"),
                    "topic": suggested.get("topic"),
                    "impact_direction": suggested.get("impact_direction"),
                    "evidence_strength": suggested.get("evidence_strength"),
                    "feed_title": feed_item.get("title"),
                    "feed_url": feed_item.get("url"),
                }
            )
    return rows


def main() -> None:
    args = parse_args()
    promises = fetch_promises(args.president_slug, args.max_promises)
    maintenance_candidates = build_maintenance_candidates(promises, args.lookback_days)

    feed_items = []
    feed_errors = []

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

    if args.max_feed_items is not None:
        feed_items = feed_items[: args.max_feed_items]

    new_action_candidates, feed_update_candidates, new_promise_candidates = analyze_feed_items(
        feed_items,
        promises,
        dry_run=args.dry_run,
        model=args.model,
        ollama_url=args.ollama_url,
        timeout=args.timeout,
        temperature=args.temperature,
    )
    all_ai_candidates = [*new_action_candidates, *feed_update_candidates, *new_promise_candidates]
    fallback_reasons = sorted({item.get("fallback_reason") for item in all_ai_candidates if item.get("fallback_reason")})

    report = {
        "generated_at": datetime.now(UTC).replace(microsecond=0).isoformat(),
        "president_slug": args.president_slug,
        "dry_run": args.dry_run,
        "model": args.model,
        "requested_model": args.model,
        "effective_model": args.model if not args.dry_run and not any(item.get("fallback_used") for item in all_ai_candidates) else ("mixed" if not args.dry_run else None),
        "review_backend": "fallback" if any(item.get("fallback_used") for item in all_ai_candidates) else ("ollama" if not args.dry_run else "dry_run"),
        "fallback_used": any(item.get("fallback_used") for item in all_ai_candidates),
        "fallback_reason": fallback_reasons[0] if len(fallback_reasons) == 1 else ("Multiple fallback reasons; inspect item-level metadata." if fallback_reasons else None),
        "model_resolution_status": ("fallback_used" if any(item.get("fallback_used") for item in all_ai_candidates) else "exact_requested") if not args.dry_run else "dry_run",
        "timeout_seconds": args.timeout,
        "lookback_days": args.lookback_days,
        "promise_count": len(promises),
        "source_inputs": {
            "feed_urls": args.feed_url or [],
            "feed_json": [str(path) for path in (args.feed_json or [])],
        },
        "summary": {
            "maintenance_update_candidates": len(maintenance_candidates),
            "new_action_candidates": len(new_action_candidates),
            "feed_update_candidates": len(feed_update_candidates),
            "new_promise_candidates": len(new_promise_candidates),
            "feed_items_analyzed": len(feed_items),
            "feed_errors": len(feed_errors),
        },
        "new_action_candidates": new_action_candidates,
        "update_candidates": maintenance_candidates + feed_update_candidates,
        "new_promise_candidates": new_promise_candidates,
        "feed_errors": feed_errors,
        "promotion_guidance": {
            "manual_only": True,
            "next_steps": [
                "Review update candidates and new promise candidates manually.",
                "Promote approved suggestions into a curated batch JSON or a targeted enrichment batch.",
                "Run the normal current-administration workflow: normalize, AI review, manual approval, import, validate.",
            ],
        },
    }

    write_json_file(args.output, report)
    csv_path = derive_csv_path(args.csv, args.output)
    if csv_path:
        write_csv_rows(csv_path, build_csv_rows(report))
    print_json(report)


if __name__ == "__main__":
    main()
