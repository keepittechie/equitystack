#!/usr/bin/env python3
import argparse
from collections import Counter
from html import unescape
import json
import re
import sys
import xml.etree.ElementTree as ET
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

import requests

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from lib.llm.provider import default_model_name, generate_text
from ingest_current_administration import collect_white_house_source_items

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
DEFAULT_MODEL = default_model_name()
DEFAULT_TIMEOUT = 240
DEFAULT_TEMPERATURE = 0.1
DEFAULT_PRESIDENT_SLUG = "donald-j-trump-2025"
DEFAULT_SOURCE_CONFIG = PROJECT_ROOT / "python" / "config" / "current_admin_sources.json"
DEFAULT_SOURCE_TIMEOUT = 30

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
FORMAL_ACTION_HINTS = {
    "executive order",
    "proclamation",
    "memorandum",
    "notice",
    "fact sheet",
    "presidential determination",
    "agreement",
    "initiation",
    "initiates",
    "adjusting imports",
    "imposing duties",
    "tariff-rate quota",
    "section 301",
    "section 232",
    "reciprocal trade",
    "ieepa",
}
OVERSIGHT_HINTS = {
    "hearing",
    "hearings",
    "testimony",
    "testify",
    "committee",
    "subcommittee",
    "oversight",
    "opening statement",
    "remarks",
    "speech",
    "transcript",
    "readout",
    "op-ed",
    "interview",
}
LEGAL_HINTS = {
    "lawsuit",
    "lawsuits",
    "court",
    "courts",
    "ruling",
    "rulings",
    "injunction",
    "supreme court",
    "appeal",
    "appeals",
    "complaint",
    "litigation",
    "decision",
    "order staying",
}
TRADE_KEYWORDS = {
    "tariff",
    "tariffs",
    "trade",
    "import tax",
    "customs duty",
    "customs duties",
    "customs",
    "duty",
    "duties",
    "ustr",
    "reciprocal tariff",
    "reciprocal tariffs",
    "tariff pause",
    "tariff refund",
    "tariff refunds",
    "trade deficit",
    "ieepa",
    "international emergency economic powers act",
    "section 232",
    "section 301",
    "imports",
    "import",
}
DISCOVERY_RELATIONSHIP_TYPES = {
    "new_action",
    "update_existing_action",
    "new_promise_candidate",
    "source_context",
    "ignore",
}
PRESIDENT_SOURCE_CONTEXT = {
    DEFAULT_PRESIDENT_SLUG: {
        "federal_register_president": "donald-trump",
        "term_start": "2025-01-20",
    }
}
TOPIC_KEYWORDS = {
    "Voting Rights": {"vote", "voter", "election", "ballot", "citizenship", "registration"},
    "Criminal Justice": {"crime", "police", "law", "enforcement", "justice", "cartel", "prison"},
    "Housing": {"housing", "homeless", "encampment", "rent", "mortgage", "homeownership", "suburb"},
    "Education": {"school", "education", "student", "students", "college", "hbcu", "accreditation", "discipline"},
    "Economic Opportunity": {
        "job",
        "jobs",
        "worker",
        "workers",
        "trade",
        "tariff",
        "tariffs",
        "import",
        "imports",
        "duty",
        "duties",
        "customs",
        "ustr",
        "reciprocal",
        "section",
        "ieepa",
        "apprentice",
        "apprenticeship",
        "dei",
    },
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
    parser.add_argument(
        "--source-config",
        type=Path,
        default=DEFAULT_SOURCE_CONFIG,
        help="JSON source configuration for default live discovery inputs",
    )
    parser.add_argument(
        "--disable-default-sources",
        action="store_true",
        help="Disable configured default live sources and use only explicit --feed-url/--feed-json inputs",
    )
    parser.add_argument("--feed-url", action="append", help="Optional RSS/Atom feed URL to inspect")
    parser.add_argument("--feed-json", action="append", type=Path, help="Optional local JSON file with feed-like items")
    parser.add_argument(
        "--csv",
        nargs="?",
        const="",
        help="Optionally write a CSV summary. Pass a path or omit the value to derive one from --output.",
    )
    return parser.parse_args()


def source_context_for_president(president_slug: str, max_items: int | None = None) -> dict[str, str]:
    now = datetime.now(UTC)
    context = dict(PRESIDENT_SOURCE_CONTEXT.get(president_slug) or {})
    context.setdefault("federal_register_president", "donald-trump")
    context.setdefault("term_start", "2025-01-20")
    context["president_slug"] = president_slug
    context["year"] = str(now.year)
    context["max_items"] = str(max_items or 0)
    return context


def load_source_config(path: Path) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text())
    if not isinstance(payload, dict):
        raise ValueError(f"Source config must be a JSON object: {path}")
    sources = payload.get("sources")
    if not isinstance(sources, list):
        raise ValueError(f"Source config missing a sources array: {path}")
    return [source for source in sources if isinstance(source, dict)]


def resolve_source_url(source: dict[str, Any], president_slug: str, max_items: int | None = None) -> str | None:
    url_template = normalize_nullable_text(source.get("url_template") or source.get("url"))
    if not url_template:
        return None
    context = source_context_for_president(president_slug, max_items=max_items)
    return normalize_nullable_text(url_template.format(**context))


def fetch_url_text(url: str, timeout: int) -> str:
    response = requests.get(
        url,
        timeout=timeout or DEFAULT_SOURCE_TIMEOUT,
        headers={"User-Agent": "Mozilla/5.0 (compatible; current-admin-discovery/1.0)"},
    )
    response.raise_for_status()
    return response.text


def clean_html_fragment(value: Any) -> str:
    return normalize_text(unescape(re.sub(r"<[^>]+>", " ", str(value or ""))))


def extract_html_meta_description(raw_html: str) -> str | None:
    meta_match = re.search(
        r'<meta\s+name=["\']description["\']\s+content=["\']([^"\']+)["\']',
        raw_html,
        re.IGNORECASE,
    )
    if meta_match:
        return clean_html_fragment(meta_match.group(1)) or None

    paragraph_match = re.search(r"<p[^>]*>(.*?)</p>", raw_html, re.IGNORECASE | re.DOTALL)
    if paragraph_match:
        return clean_html_fragment(paragraph_match.group(1)) or None
    return None


def dedupe_source_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    unique_items = []
    seen: set[str] = set()
    for item in items:
        dedupe_key = (
            normalize_nullable_text(item.get("source_name"))
            or ""
        ) + "||" + (
            normalize_nullable_text(item.get("url"))
            or f"{normalize_text(item.get('title')).lower()}||{normalize_nullable_text(item.get('published_at')) or ''}"
        )
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        unique_items.append(item)
    return unique_items


def parse_ustr_listing_items(
    raw_html: str,
    *,
    source_url: str,
    source_name: str,
    source_category: str,
    publisher: str,
    target_year: str,
    timeout: int,
    max_items: int,
) -> list[dict[str, Any]]:
    items = []
    listing_pattern = re.compile(
        r"<li[^>]*>\s*(\d{4}-\d{2}-\d{2})\s*<br[^>]*>\s*<a href=\"([^\"]+)\"[^>]*>(.*?)</a>\s*</li>",
        re.IGNORECASE | re.DOTALL,
    )
    for match in listing_pattern.finditer(raw_html):
        published_at = normalize_date(match.group(1))
        if not published_at or not published_at.startswith(target_year):
            continue
        item_url = normalize_nullable_text(urljoin(source_url, match.group(2)))
        title = clean_html_fragment(match.group(3))
        if not title or not item_url:
            continue
        summary = title
        try:
            summary = extract_html_meta_description(fetch_url_text(item_url, timeout)) or title
        except requests.RequestException:
            summary = title
        items.append(
            {
                "title": title,
                "url": item_url,
                "published_at": published_at,
                "summary": summary,
                "source_name": source_name,
                "source_type": "HTML",
                "source_category": source_category,
                "publisher": publisher,
                "action_type_hint": "USTR Press Release" if "press" in source_url else "Fact Sheet",
            }
        )
        if len(items) >= max_items:
            break
    return items


def federal_register_action_type(document_type: Any) -> str:
    normalized = normalize_text(document_type).lower()
    if normalized == "presidential document":
        return "Presidential Document"
    if normalized == "notice":
        return "Federal Register Notice"
    if normalized == "rule":
        return "Federal Register Rule"
    if normalized == "proposed rule":
        return "Federal Register Proposed Rule"
    return "Federal Register Document"


def parse_federal_register_items(payload: dict[str, Any], source: dict[str, Any]) -> list[dict[str, Any]]:
    items = []
    for result in payload.get("results") or []:
        if not isinstance(result, dict):
            continue
        agencies = result.get("agencies") or []
        agency_names = ", ".join(
            normalize_text(agency.get("name"))
            for agency in agencies
            if isinstance(agency, dict) and normalize_text(agency.get("name"))
        )
        summary = normalize_text(result.get("abstract") or clean_html_fragment(result.get("excerpts")))
        items.append(
            {
                "title": normalize_text(result.get("title")),
                "url": normalize_nullable_text(result.get("html_url")),
                "published_at": normalize_date(result.get("publication_date")),
                "summary": summary,
                "source_name": normalize_text(source.get("name") or "Federal Register"),
                "source_type": "Federal Register API",
                "source_category": normalize_text(source.get("category") or "agency"),
                "publisher": agency_names or normalize_text(source.get("publisher") or "Federal Register"),
                "action_type_hint": federal_register_action_type(result.get("type")),
            }
        )
    return [item for item in items if item["title"]]


def fetch_default_live_source_items(
    args: argparse.Namespace,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    if args.disable_default_sources:
        return [], [], []

    source_results = []
    source_errors = []
    collected_items = []
    config_path = args.source_config.resolve()
    sources = load_source_config(config_path)

    for source in sources:
        source_name = normalize_text(source.get("name") or "Unnamed source")
        source_type = normalize_text(source.get("type")).lower()
        enabled = bool(source.get("enabled", True))
        default_enabled = bool(source.get("default", False))
        source_category = normalize_text(source.get("category") or "unknown")
        max_items = int(source.get("max_items") or args.max_feed_items or 20)
        resolved_url = resolve_source_url(source, args.president_slug, max_items=max_items)

        if not enabled or not default_enabled:
            source_results.append(
                {
                    "source_name": source_name,
                    "source_type": source_type,
                    "source_category": source_category,
                    "url": resolved_url,
                    "enabled": enabled,
                    "default": default_enabled,
                    "raw_item_count": 0,
                    "deduped_item_count": 0,
                    "skip_reason": "disabled_in_source_config",
                }
            )
            continue

        try:
            if source_type == "existing-helper":
                helper_source = normalize_nullable_text(source.get("helper_source"))
                if helper_source not in {"presidential_actions", "official_statements"}:
                    raise ValueError(f"Unsupported existing-helper source: {helper_source}")
                raw_items, helper_errors = collect_white_house_source_items([helper_source], max_items)
                items = [
                    {
                        **item,
                        "source_name": source_name,
                        "source_category": source_category,
                        "publisher": normalize_text(source.get("publisher") or item.get("publisher") or "The White House"),
                    }
                    for item in raw_items
                ]
                for helper_error in helper_errors:
                    source_errors.append(
                        {
                            "input": source_name,
                            "error": normalize_text(helper_error.get("error")),
                            "source_category": source_category,
                        }
                    )
            elif source_type in {"rss", "atom"}:
                if not resolved_url:
                    raise ValueError("Missing url/url_template for RSS/Atom source")
                items = fetch_remote_feed_items(
                    resolved_url,
                    args.timeout,
                    source_name=source_name,
                    source_type=source.get("type"),
                    source_category=source_category,
                    publisher=normalize_text(source.get("publisher")),
                )
            elif source_type == "html":
                if not resolved_url:
                    raise ValueError("Missing url/url_template for HTML source")
                raw_html = fetch_url_text(resolved_url, args.timeout or DEFAULT_SOURCE_TIMEOUT)
                parser_name = normalize_text(source.get("parser"))
                if parser_name != "ustr_listing":
                    raise ValueError(f"Unsupported HTML parser: {parser_name or source_name}")
                items = parse_ustr_listing_items(
                    raw_html,
                    source_url=resolved_url,
                    source_name=source_name,
                    source_category=source_category,
                    publisher=normalize_text(source.get("publisher") or "Office of the United States Trade Representative"),
                    target_year=source_context_for_president(args.president_slug)["year"],
                    timeout=args.timeout or DEFAULT_SOURCE_TIMEOUT,
                    max_items=max_items,
                )
            elif source_type == "json":
                if not resolved_url:
                    raise ValueError("Missing url/url_template for JSON source")
                payload = requests.get(
                    resolved_url,
                    timeout=args.timeout or DEFAULT_SOURCE_TIMEOUT,
                    headers={"User-Agent": "Mozilla/5.0 (compatible; current-admin-discovery/1.0)"},
                )
                payload.raise_for_status()
                parser_name = normalize_text(source.get("parser"))
                if parser_name != "federal_register_documents":
                    raise ValueError(f"Unsupported JSON parser: {parser_name or source_name}")
                items = parse_federal_register_items(payload.json(), source)
            else:
                raise ValueError(f"Unsupported source type: {source_type or 'unknown'}")
        except Exception as exc:  # noqa: BLE001
            source_errors.append(
                {
                    "input": source_name,
                    "error": normalize_text(str(exc)),
                    "source_category": source_category,
                    "source_url": resolved_url,
                }
            )
            source_results.append(
                {
                    "source_name": source_name,
                    "source_type": source_type,
                    "source_category": source_category,
                    "url": resolved_url,
                    "enabled": enabled,
                    "default": default_enabled,
                    "raw_item_count": 0,
                    "deduped_item_count": 0,
                    "skip_reason": normalize_text(str(exc)) or "source_fetch_failed",
                }
            )
            continue

        deduped_items = dedupe_source_items(items)
        collected_items.extend(deduped_items)
        source_results.append(
            {
                "source_name": source_name,
                "source_type": source_type,
                "source_category": source_category,
                "url": resolved_url,
                "enabled": enabled,
                "default": default_enabled,
                "raw_item_count": len(items),
                "deduped_item_count": len(deduped_items),
                "skip_reason": None,
            }
        )

    return collected_items, source_errors, source_results


def derive_debug_output_path(output_path: Path) -> Path:
    return output_path.resolve().with_name(f"{output_path.resolve().stem}.discovery-debug.json")


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
                LEFT JOIN policy_outcomes uo
                  ON uo.policy_type = 'current_admin'
                 AND uo.policy_id = po.promise_id
                 AND uo.outcome_summary_hash = SHA2(TRIM(po.outcome_summary), 256)
                LEFT JOIN policy_outcome_sources pos ON pos.policy_outcome_id = uo.id
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
                "source_category": normalize_text(item.get("source_category") or "manual-feed"),
                "publisher": normalize_text(item.get("publisher") or item.get("source_name") or path.name),
                "action_type_hint": normalize_nullable_text(item.get("action_type_hint")),
            }
        )
    return normalized_items


def parse_feed_xml(
    raw_xml: str,
    source_name: str,
    *,
    source_type: str = "RSS",
    source_category: str | None = None,
    publisher: str | None = None,
) -> list[dict[str, Any]]:
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
                "source_type": normalize_text(source_type or "RSS"),
                "source_category": normalize_text(source_category or "manual-feed"),
                "publisher": normalize_text(publisher or source_name),
                "action_type_hint": None,
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
                "source_type": normalize_text(source_type or "Atom"),
                "source_category": normalize_text(source_category or "manual-feed"),
                "publisher": normalize_text(publisher or source_name),
                "action_type_hint": None,
            }
        )

    return [item for item in items if item["title"]]


def fetch_remote_feed_items(
    feed_url: str,
    timeout: int,
    *,
    source_name: str | None = None,
    source_type: str | None = None,
    source_category: str | None = None,
    publisher: str | None = None,
) -> list[dict[str, Any]]:
    response = requests.get(feed_url, timeout=timeout)
    response.raise_for_status()
    return parse_feed_xml(
        response.text,
        source_name or feed_url,
        source_type=source_type or "RSS",
        source_category=source_category,
        publisher=publisher,
    )


def counts_by_candidate_type(*candidate_groups: list[dict[str, Any]]) -> dict[str, int]:
    counts: Counter[str] = Counter()
    for candidates in candidate_groups:
        for candidate in candidates:
            candidate_type = normalize_nullable_text(candidate.get("candidate_type")) or "unknown"
            counts[candidate_type] += 1
    return dict(sorted(counts.items()))


def counts_by_skip_reason(feed_item_debug_rows: list[dict[str, Any]], feed_errors: list[dict[str, Any]]) -> dict[str, int]:
    counts: Counter[str] = Counter()
    for row in feed_item_debug_rows:
        reason = normalize_nullable_text(row.get("skip_reason"))
        if reason:
            counts[reason] += 1
    for error in feed_errors:
        if not isinstance(error, dict):
            continue
        reason = normalize_nullable_text(error.get("error")) or "feed_load_error"
        counts[f"feed_error:{reason}"] += 1
    return dict(sorted(counts.items()))


def build_discovery_debug_report(
    *,
    args: argparse.Namespace,
    output_path: Path,
    status: str,
    error: str | None = None,
    promises: list[dict[str, Any]] | None = None,
    maintenance_candidates: list[dict[str, Any]] | None = None,
    raw_feed_item_count: int = 0,
    feed_items: list[dict[str, Any]] | None = None,
    feed_item_debug_rows: list[dict[str, Any]] | None = None,
    new_action_candidates: list[dict[str, Any]] | None = None,
    feed_update_candidates: list[dict[str, Any]] | None = None,
    new_promise_candidates: list[dict[str, Any]] | None = None,
    source_context_candidates: list[dict[str, Any]] | None = None,
    feed_errors: list[dict[str, Any]] | None = None,
    source_results: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    promises = promises or []
    maintenance_candidates = maintenance_candidates or []
    feed_items = feed_items or []
    feed_item_debug_rows = feed_item_debug_rows or []
    new_action_candidates = new_action_candidates or []
    feed_update_candidates = feed_update_candidates or []
    new_promise_candidates = new_promise_candidates or []
    source_context_candidates = source_context_candidates or []
    feed_errors = feed_errors or []
    source_results = source_results or []

    stale_before = (datetime.now(UTC).date() - timedelta(days=args.lookback_days)).isoformat()
    promotable_candidate_count = (
        len(maintenance_candidates)
        + len(new_action_candidates)
        + len(feed_update_candidates)
        + len(new_promise_candidates)
    )
    ignored_feed_items = sum(
        1
        for row in feed_item_debug_rows
        if normalize_nullable_text(row.get("skip_reason")) == "ignored_by_classifier"
    )

    return {
        "generated_at": datetime.now(UTC).replace(microsecond=0).isoformat(),
        "status": status,
        "error": error,
        "output_path": str(output_path),
        "president_slug": args.president_slug,
        "db_connection_required": True,
        "source_query_summary": {
            "promise_scan_enabled": True,
            "source_config_path": str(args.source_config.resolve()),
            "default_live_sources_enabled": not args.disable_default_sources,
            "configured_default_source_count": sum(1 for source in source_results if source.get("default")),
            "feed_urls_requested": args.feed_url or [],
            "feed_json_requested": [str(path) for path in (args.feed_json or [])],
            "feed_urls_count": len(args.feed_url or []),
            "feed_json_count": len(args.feed_json or []),
            "source_results": source_results,
        },
        "date_filter_applied": {
            "lookback_days": args.lookback_days,
            "stale_before": stale_before,
            "live_source_year_hint": source_context_for_president(args.president_slug)["year"],
            "feed_item_date_window": "latest configured live sources sorted by published date before global cap",
        },
        "keyword_category_filter": {
            "mode": "topic_estimation_plus_trade_oversight_legal_heuristics",
            "supported_topics": sorted(TOPIC_KEYWORDS.keys()),
            "trade_keywords": sorted(TRADE_KEYWORDS),
        },
        "action_type_filter": {
            "mode": "relationship_classification_with_guardrails",
            "accepted_suggestion_types": sorted(DISCOVERY_RELATIONSHIP_TYPES),
        },
        "dedupe": {
            "mode": "per-source-url dedupe before analysis",
            "batch_generation_group_key": "linked_promise_slug",
        },
        "raw_counts": {
            "promise_count": len(promises),
            "maintenance_candidate_count": len(maintenance_candidates),
            "raw_feed_item_count_before_limit": raw_feed_item_count,
            "feed_item_count_after_limit": len(feed_items),
            "live_source_count": len(source_results),
            "feed_error_count": len(feed_errors),
        },
        "candidate_counts": {
            "maintenance_update_candidates": len(maintenance_candidates),
            "new_action_candidates": len(new_action_candidates),
            "feed_update_candidates": len(feed_update_candidates),
            "new_promise_candidates": len(new_promise_candidates),
            "source_context_candidates": len(source_context_candidates),
            "final_candidate_count": promotable_candidate_count,
        },
        "candidate_type_counts": counts_by_candidate_type(
            maintenance_candidates,
            new_action_candidates,
            feed_update_candidates,
            new_promise_candidates,
            source_context_candidates,
        ),
        "skipped_counts": {
            "feed_items_ignored": ignored_feed_items,
            "feed_items_with_errors": len(feed_errors),
        },
        "skip_reason_counts": counts_by_skip_reason(feed_item_debug_rows, feed_errors),
        "feed_item_debug_rows": feed_item_debug_rows,
        "feed_errors": feed_errors,
    }


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


def matched_keywords(text: str, keywords: set[str]) -> list[str]:
    normalized_text = normalize_text(text).lower()
    return sorted({keyword for keyword in keywords if keyword in normalized_text})


def infer_action_type(feed_item: dict[str, Any]) -> str | None:
    hinted = normalize_nullable_text(feed_item.get("action_type_hint"))
    if hinted:
        return hinted

    title = normalize_text(feed_item.get("title")).lower()
    source_category = normalize_text(feed_item.get("source_category")).lower()
    source_name = normalize_text(feed_item.get("source_name")).lower()
    if "executive order" in title:
        return "Executive Order"
    if "proclamation" in title:
        return "Proclamation"
    if "memorandum" in title or "presidential determination" in title:
        return "Presidential Memorandum"
    if "fact sheet" in title:
        return "Fact Sheet"
    if "section 301" in title or "section 232" in title:
        return "Trade Investigation"
    if "federal register" in source_name:
        return "Federal Register Notice"
    if source_category == "trade":
        return "Trade Update"
    if source_category == "executive-action":
        return "Executive Action"
    return None


def classify_feed_item_context(feed_item: dict[str, Any]) -> dict[str, Any]:
    combined_text = " ".join(
        [
            normalize_text(feed_item.get("title")),
            normalize_text(feed_item.get("summary")),
            normalize_text(feed_item.get("source_name")),
            normalize_text(feed_item.get("source_category")),
            normalize_text(feed_item.get("publisher")),
        ]
    )
    trade_matches = matched_keywords(combined_text, TRADE_KEYWORDS)
    oversight_matches = matched_keywords(combined_text, OVERSIGHT_HINTS)
    legal_matches = matched_keywords(combined_text, LEGAL_HINTS)
    formal_action_matches = matched_keywords(combined_text, FORMAL_ACTION_HINTS)
    source_category = normalize_text(feed_item.get("source_category")).lower()

    return {
        "trade_matches": trade_matches,
        "oversight_matches": oversight_matches,
        "legal_matches": legal_matches,
        "formal_action_matches": formal_action_matches,
        "matched_keywords": sorted(set(trade_matches + oversight_matches + legal_matches + formal_action_matches)),
        "is_trade_related": bool(trade_matches) or source_category == "trade",
        "is_oversight_related": bool(oversight_matches) or source_category == "oversight",
        "is_legal_related": bool(legal_matches) or source_category == "legal",
        "is_formal_action": bool(formal_action_matches) or source_category in {"executive-action", "agency"},
        "suggested_action_type": infer_action_type(feed_item),
        "source_category": source_category or "unknown",
    }


def enforce_relationship_guardrails(
    suggestion: dict[str, Any],
    feed_item: dict[str, Any],
    context: dict[str, Any],
    matched_promise: dict[str, Any] | None,
    match_score: float,
) -> dict[str, Any]:
    suggestion_type = normalize_nullable_text(suggestion.get("suggestion_type")) or "ignore"
    if suggestion_type not in DISCOVERY_RELATIONSHIP_TYPES:
        suggestion_type = "ignore"

    if context["is_oversight_related"] or context["is_legal_related"]:
        suggestion_type = "source_context" if (matched_promise and match_score >= 0.12) or context["is_trade_related"] else "ignore"

    if suggestion_type == "new_action" and not context["is_formal_action"]:
        suggestion_type = "update_existing_action" if matched_promise and match_score >= 0.18 else "source_context"

    linked_promise_slug = normalize_nullable_text(suggestion.get("linked_promise_slug"))
    if suggestion_type in {"source_context", "ignore"} and not linked_promise_slug and matched_promise and match_score >= 0.18:
        linked_promise_slug = normalize_nullable_text(matched_promise.get("slug"))

    suggested_fields = suggestion.get("suggested_fields")
    if not isinstance(suggested_fields, dict):
        suggested_fields = {}
    if context["suggested_action_type"] and not normalize_nullable_text(suggested_fields.get("action_type")):
        suggested_fields["action_type"] = context["suggested_action_type"]
    suggested_fields["source_category"] = normalize_text(feed_item.get("source_category"))
    suggested_fields["matched_keywords"] = context["matched_keywords"]

    return {
        **suggestion,
        "suggestion_type": suggestion_type,
        "linked_promise_slug": linked_promise_slug,
        "suggested_fields": suggested_fields,
    }


def heuristic_feed_suggestion(feed_item: dict[str, Any], promises: list[dict[str, Any]]) -> dict[str, Any]:
    matched_promise, match_score = best_promise_match(feed_item, promises)
    combined_text = f"{feed_item.get('title')} {feed_item.get('summary')}"
    topic = estimate_topic(combined_text)
    impact_direction = estimate_impact_direction(combined_text)
    evidence_strength = estimate_evidence_strength(feed_item.get("url"))
    context = classify_feed_item_context(feed_item)
    caution_flags = []

    if len(normalize_text(feed_item.get("summary"))) < 40:
        caution_flags.append("thin_source_summary")
    if not feed_item.get("published_at"):
        caution_flags.append("missing_published_date")
    if context["is_trade_related"] and topic is None:
        topic = "Economic Opportunity"

    if context["is_oversight_related"] or context["is_legal_related"]:
        suggestion_type = "source_context" if (matched_promise and match_score >= 0.12) or context["is_trade_related"] else "ignore"
        return {
            "suggestion_type": suggestion_type,
            "linked_promise_slug": matched_promise.get("slug") if matched_promise and suggestion_type == "source_context" else None,
            "confidence": "Medium" if suggestion_type == "source_context" else "Low",
            "reasoning": "This source appears to be oversight, testimony, transcript, or legal context and should be treated as evidence rather than as a standalone policy record.",
            "suggested_fields": {
                "title": normalize_text(feed_item.get("title")),
                "summary": normalize_text(feed_item.get("summary"))[:280],
                "topic": matched_promise.get("topic") if matched_promise else topic,
                "impact_direction": impact_direction,
                "evidence_strength": evidence_strength,
                "action_type": context["suggested_action_type"],
                "source_category": normalize_text(feed_item.get("source_category")),
                "matched_keywords": context["matched_keywords"],
            },
            "caution_flags": caution_flags,
        }

    if matched_promise and match_score >= 0.18:
        latest_action_date = matched_promise.get("latest_action_date")
        suggestion_type = "update_existing_action"
        if context["is_formal_action"] and feed_item.get("published_at") and feed_item.get("published_at") != latest_action_date:
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
                "action_type": context["suggested_action_type"],
                "source_category": normalize_text(feed_item.get("source_category")),
                "matched_keywords": context["matched_keywords"],
            },
            "caution_flags": caution_flags,
        }

    if context["is_formal_action"] or context["is_trade_related"] or topic:
        return {
            "suggestion_type": "new_promise_candidate",
            "linked_promise_slug": None,
            "confidence": "Medium" if topic or context["is_trade_related"] else "Low",
            "reasoning": "The source appears to describe a real administration or trade action that does not yet map cleanly to an existing tracked promise.",
            "suggested_fields": {
                "title": normalize_text(feed_item.get("title")),
                "summary": normalize_text(feed_item.get("summary"))[:280],
                "topic": topic,
                "impact_direction": impact_direction,
                "evidence_strength": evidence_strength,
                "action_type": context["suggested_action_type"],
                "source_category": normalize_text(feed_item.get("source_category")),
                "matched_keywords": context["matched_keywords"],
            },
            "caution_flags": caution_flags + (["topic_unclear"] if topic is None else []),
        }

    return {
        "suggestion_type": "ignore",
        "linked_promise_slug": None,
        "confidence": "Low",
        "reasoning": "The source does not map cleanly to a current-administration policy or evidence update candidate.",
        "suggested_fields": {
            "title": normalize_text(feed_item.get("title")),
            "summary": normalize_text(feed_item.get("summary"))[:280],
            "topic": topic,
            "impact_direction": impact_direction,
            "evidence_strength": evidence_strength,
            "action_type": context["suggested_action_type"],
            "source_category": normalize_text(feed_item.get("source_category")),
            "matched_keywords": context["matched_keywords"],
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
- hearings, testimony, readouts, speeches, interviews, transcripts, and court/legal updates should usually be source_context rather than a standalone policy
- suggestion_type must be one of: new_action, update_existing_action, new_promise_candidate, source_context, ignore
- confidence must be one of: High, Medium, Low
- suggested_fields must be an object with:
  - title
  - summary
  - topic
  - impact_direction
  - evidence_strength
  - action_type
  - source_category
  - matched_keywords
- topic should be one of: Voting Rights, Criminal Justice, Housing, Education, Economic Opportunity, Healthcare, or null
- impact_direction should be one of: Positive, Negative, Mixed, Blocked, or null
- evidence_strength should be one of: Strong, Moderate, Limited, or null
- linked_promise_slug should be null for new_promise_candidate or ignore
- use source_context for evidence-only items such as congressional hearings, testimony, news-like commentary, transcripts, and legal challenges or rulings

Feed item:
{json.dumps(feed_item, indent=2)}

Existing current-administration promise context:
{json.dumps(promise_context, indent=2)}
""".strip()


def sanitize_ollama_suggestion(payload: dict[str, Any]) -> dict[str, Any]:
    suggested_fields = payload.get("suggested_fields")
    if not isinstance(suggested_fields, dict):
        suggested_fields = {}
    matched_keyword_values = suggested_fields.get("matched_keywords")
    if not isinstance(matched_keyword_values, list):
        matched_keyword_values = [matched_keyword_values] if matched_keyword_values else []
    suggestion_type = normalize_nullable_text(payload.get("suggestion_type")) or "ignore"
    if suggestion_type not in DISCOVERY_RELATIONSHIP_TYPES:
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
            "action_type": normalize_nullable_text(suggested_fields.get("action_type")),
            "source_category": normalize_nullable_text(suggested_fields.get("source_category")),
            "matched_keywords": [normalize_text(keyword) for keyword in matched_keyword_values if normalize_text(keyword)],
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
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    new_action_candidates = []
    update_candidates = []
    new_promise_candidates = []
    source_context_candidates = []
    debug_rows = []
    promise_context = compact_promise_context(promises)

    for feed_item in feed_items:
        matched_promise, match_score = best_promise_match(feed_item, promises)
        topic_estimate = estimate_topic(f"{feed_item.get('title')} {feed_item.get('summary')}")
        context = classify_feed_item_context(feed_item)
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

        suggestion = enforce_relationship_guardrails(
            suggestion,
            feed_item,
            context,
            matched_promise,
            match_score,
        )
        suggestion_type = suggestion.get("suggestion_type")
        candidate = {
            "candidate_type": suggestion_type,
            "suggested_relationship": suggestion_type,
            "linked_promise": None,
            "feed_item": feed_item,
            "suggested_changes": suggestion.get("suggested_fields"),
            "reasoning": suggestion.get("reasoning"),
            "confidence": suggestion.get("confidence"),
            "caution_flags": suggestion.get("caution_flags") or [],
            "matched_keywords": suggestion.get("suggested_fields", {}).get("matched_keywords") or context["matched_keywords"],
            "source_category": normalize_text(feed_item.get("source_category")),
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
                    "publisher": feed_item.get("publisher") or feed_item.get("source_name"),
                    "published_date": feed_item.get("published_at"),
                    "notes": normalize_nullable_text(feed_item.get("source_category")),
                }
            ],
            "review_mode": review_mode,
        }

        linked_slug = suggestion.get("linked_promise_slug")
        if linked_slug:
            matched = next((promise for promise in promises if promise.get("slug") == linked_slug), None)
            if matched:
                candidate["linked_promise"] = compact_linked_promise(matched)

        skip_reason = None
        if suggestion_type == "new_action":
            new_action_candidates.append(candidate)
        elif suggestion_type == "update_existing_action":
            update_candidates.append(candidate)
        elif suggestion_type == "new_promise_candidate":
            new_promise_candidates.append(candidate)
        elif suggestion_type == "source_context":
            source_context_candidates.append(candidate)
        else:
            skip_reason = "ignored_by_classifier"

        debug_rows.append(
            {
                "source_queried": normalize_nullable_text(feed_item.get("source_name")) or normalize_nullable_text(feed_item.get("url")),
                "source_type": normalize_nullable_text(feed_item.get("source_type")),
                "source_category": normalize_nullable_text(feed_item.get("source_category")),
                "title": normalize_nullable_text(feed_item.get("title")),
                "published_at": normalize_nullable_text(feed_item.get("published_at")),
                "raw_item_count": 1,
                "review_backend": review_mode,
                "keyword_category_filter_result": {
                    "topic_estimate": topic_estimate,
                    "topic_matched": topic_estimate is not None,
                    "matched_keywords": context["matched_keywords"],
                },
                "action_type_filter_result": suggestion.get("suggested_fields", {}).get("action_type"),
                "dedupe_match_key": normalize_nullable_text(linked_slug) or None,
                "best_match": {
                    "linked_promise_slug": matched_promise.get("slug") if matched_promise else None,
                    "match_score": round(match_score, 4),
                },
                "candidate_type": suggestion_type,
                "candidate_emitted": suggestion_type in {"new_action", "update_existing_action", "new_promise_candidate", "source_context"},
                "skip_reason": skip_reason,
            }
        )

    return new_action_candidates, update_candidates, new_promise_candidates, source_context_candidates, debug_rows


def build_csv_rows(report: dict[str, Any]) -> list[dict[str, Any]]:
    rows = []
    for section_name in ("new_action_candidates", "update_candidates", "new_promise_candidates", "source_context_candidates"):
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
                    "action_type": suggested.get("action_type"),
                    "source_category": suggested.get("source_category"),
                    "matched_keywords": ", ".join(suggested.get("matched_keywords") or []),
                    "feed_title": feed_item.get("title"),
                    "feed_url": feed_item.get("url"),
                }
            )
    return rows


def sort_and_limit_feed_items(feed_items: list[dict[str, Any]], max_feed_items: int | None) -> list[dict[str, Any]]:
    ordered = sorted(
        dedupe_source_items(feed_items),
        key=lambda item: (
            normalize_date(item.get("published_at")) or "",
            normalize_text(item.get("title")).lower(),
        ),
        reverse=True,
    )
    if max_feed_items is None:
        return ordered
    return ordered[:max_feed_items]


def main() -> None:
    args = parse_args()
    output_path = args.output.resolve()
    debug_output_path = derive_debug_output_path(output_path)

    try:
        promises = fetch_promises(args.president_slug, args.max_promises)
    except Exception as exc:  # noqa: BLE001
        debug_report = build_discovery_debug_report(
            args=args,
            output_path=output_path,
            status="db_error",
            error=normalize_text(str(exc)),
        )
        write_json_file(debug_output_path, debug_report)
        raise

    maintenance_candidates = build_maintenance_candidates(promises, args.lookback_days)

    feed_items = []
    feed_errors = []
    source_results = []

    try:
        default_live_source_items, default_source_errors, source_results = fetch_default_live_source_items(args)
        feed_items.extend(default_live_source_items)
        feed_errors.extend(default_source_errors)
    except Exception as exc:  # noqa: BLE001
        feed_errors.append(
            {
                "input": str(args.source_config.resolve()),
                "error": normalize_text(str(exc)),
                "source_category": "source-config",
            }
        )

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

    (
        new_action_candidates,
        feed_update_candidates,
        new_promise_candidates,
        source_context_candidates,
        feed_item_debug_rows,
    ) = analyze_feed_items(
        feed_items,
        promises,
        dry_run=args.dry_run,
        model=args.model,
        ollama_url=args.ollama_url,
        timeout=args.timeout,
        temperature=args.temperature,
    )
    all_ai_candidates = [*new_action_candidates, *feed_update_candidates, *new_promise_candidates, *source_context_candidates]
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
            "source_config": str(args.source_config.resolve()),
            "default_live_sources_enabled": not args.disable_default_sources,
            "feed_urls": args.feed_url or [],
            "feed_json": [str(path) for path in (args.feed_json or [])],
        },
        "summary": {
            "maintenance_update_candidates": len(maintenance_candidates),
            "new_action_candidates": len(new_action_candidates),
            "feed_update_candidates": len(feed_update_candidates),
            "new_promise_candidates": len(new_promise_candidates),
            "source_context_candidates": len(source_context_candidates),
            "feed_items_analyzed": len(feed_items),
            "feed_errors": len(feed_errors),
        },
        "new_action_candidates": new_action_candidates,
        "update_candidates": maintenance_candidates + feed_update_candidates,
        "new_promise_candidates": new_promise_candidates,
        "source_context_candidates": source_context_candidates,
        "feed_errors": feed_errors,
        "promotion_guidance": {
            "manual_only": True,
            "next_steps": [
                "Review update candidates, new promise candidates, and source-context evidence manually.",
                "Promote approved suggestions into a curated batch JSON or a targeted enrichment batch.",
                "Run the normal current-administration workflow: normalize, AI review, manual approval, import, validate.",
            ],
        },
    }

    debug_report = build_discovery_debug_report(
        args=args,
        output_path=output_path,
        status="success",
        promises=promises,
        maintenance_candidates=maintenance_candidates,
        raw_feed_item_count=raw_feed_item_count,
        feed_items=feed_items,
        feed_item_debug_rows=feed_item_debug_rows,
        new_action_candidates=new_action_candidates,
        feed_update_candidates=feed_update_candidates,
        new_promise_candidates=new_promise_candidates,
        source_context_candidates=source_context_candidates,
        feed_errors=feed_errors,
        source_results=source_results,
    )
    write_json_file(debug_output_path, debug_report)

    report["debug_report_path"] = str(debug_output_path)
    write_json_file(output_path, report)
    csv_path = derive_csv_path(args.csv, output_path)
    if csv_path:
        write_csv_rows(csv_path, build_csv_rows(report))
    print_json(report)


if __name__ == "__main__":
    main()
