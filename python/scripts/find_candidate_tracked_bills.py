#!/usr/bin/env python3
import argparse
import csv
import json
import re
from datetime import UTC, datetime
from itertools import combinations
from pathlib import Path
from typing import Any

import requests

from suggest_partial_future_bill_links import (
    DEFAULT_MODEL,
    DEFAULT_OLLAMA_URL,
    DEFAULT_SEED,
    DEFAULT_TEMPERATURE,
    DOMAIN_KEYWORDS,
    FALLBACK_MODELS,
    classify_mechanism_families,
    detect_issue_domain,
    derive_csv_path,
    explicit_domain_overlap,
    fetch_available_models,
    normalize_title_key,
    normalize_whitespace,
    normalized_issue_domain,
    resolve_model_name,
    score_candidate,
    tokenize,
)


DEFAULT_TIMEOUT = 300
DEFAULT_TOP_K = 5
DEFAULT_OUTPUT_PATH = Path(__file__).resolve().parents[1] / "reports" / "future_bill_candidate_discovery.json"
DEFAULT_SEED_OUTPUT_PATH = Path(__file__).resolve().parents[1] / "reports" / "tracked_bills_candidate_seed.json"
IMPORT_PRIORITY_ORDER = {"reject": 0, "low": 1, "medium": 2, "high": 3}
SUPPORTED_BILL_TYPES = ["hr", "s", "hjres", "sjres", "hres", "sres"]
BROAD_QUERY_TERMS = {"black", "equity", "justice", "reparative", "racial", "communities", "underserved"}
GENERIC_POLICY_TERMS = {"fairness", "support", "research", "development", "program", "programs", "initiative", "initiatives", "assistance"}
DISCOVERY_STOPWORDS = {
    "a",
    "access",
    "act",
    "acts",
    "aid",
    "an",
    "and",
    "american",
    "americans",
    "benefit",
    "benefits",
    "black",
    "community",
    "communities",
    "equity",
    "federal",
    "for",
    "from",
    "higher",
    "improve",
    "improves",
    "including",
    "institution",
    "institutions",
    "iii",
    "of",
    "or",
    "program",
    "programs",
    "provide",
    "provides",
    "public",
    "racial",
    "reform",
    "support",
    "supports",
    "the",
    "title",
    "under",
    "underserved",
    "v",
    "with",
}
DOMAIN_ANCHORS = {
    "housing": {"housing", "mortgage", "lending", "appraisal", "homeownership", "hud", "fair housing", "down payment", "home buyer", "homebuyer", "redlining"},
    "education": {"hbcu", "hbcus", "minority-serving institution", "minority-serving institutions", "title iii", "title v", "college", "university", "higher education", "campus", "endowment"},
    "healthcare": {"health", "health care", "healthcare", "medicaid", "maternal", "postpartum", "clinic", "hospital", "doula", "birth"},
    "economic": {"capital", "credit", "procurement", "contracting", "business", "entrepreneur", "wealth", "banking", "loan", "grant"},
    "criminal": {"sentencing", "expungement", "reentry", "incarceration", "prison", "bail", "criminal justice"},
    "voting": {"voting", "election", "ballot", "district", "redistricting", "preclearance"},
}
DOMAIN_QUERY_TERMS = {
    "housing": {"housing assistance", "fair housing", "mortgage", "rent", "homeownership", "appraisal", "lending"},
    "education": {"higher education", "college funding", "institutional aid", "campus infrastructure", "university grants"},
    "healthcare": {"public health", "medical access", "health equity", "maternal care", "medicaid coverage"},
    "economic": {"capital access", "business credit", "procurement support", "wealth building", "small business finance"},
    "criminal": {"sentencing reform", "reentry support", "expungement", "incarceration relief"},
    "voting": {"voting rights", "election access", "ballot access", "district fairness", "preclearance"},
}
MECHANISM_QUERY_TERMS = {
    "commission": {"commission", "study", "task force", "report"},
    "direct_benefit": {"grant", "grants", "payment", "payments", "compensation", "subsidy", "voucher", "loan", "loans", "assistance"},
    "institutional_funding": {"funding", "endowment", "infrastructure", "research", "institution", "institutions", "college", "university"},
    "regulatory_enforcement": {"enforcement", "oversight", "accountability", "standard", "compliance", "anti-discrimination"},
    "health_investment": {"medicaid", "care", "coverage", "clinic", "maternal", "postpartum"},
    "justice_relief": {"sentencing", "expungement", "reentry", "release", "clemency"},
}
POPULATION_QUERY_TERMS = {
    "students": {"students", "colleges", "universities", "campuses"},
    "institutions": {"hbcu", "hbcus", "minority-serving institutions", "minority-serving institution", "colleges", "universities"},
    "homeowners": {"homeowners", "buyers", "borrowers", "renters", "tenants"},
    "patients": {"patients", "mothers", "families", "medicaid recipients"},
    "businesses": {"businesses", "entrepreneurs", "contractors", "vendors"},
    "voters": {"voters", "ballot users", "district residents"},
    "communities": {"communities", "households", "residents"},
}
SYNONYM_GROUPS = {
    "capital": {"capital", "infrastructure", "facilities", "investment", "improvement"},
    "research": {"research", "innovation", "grants", "funding"},
    "equity": {"equity", "access", "disparity", "inclusion"},
    "housing": {"housing", "mortgage", "rent", "ownership", "homeownership"},
    "homeownership": {"homeownership", "home buyer", "homebuyer", "ownership", "mortgage"},
    "mortgage": {"mortgage", "lending", "loan", "borrowing"},
    "grant": {"grant", "grants", "funding", "appropriation"},
    "funding": {"funding", "appropriation", "grant", "support"},
    "tax": {"tax", "credit", "deduction", "incentive"},
    "enforcement": {"enforcement", "regulation", "compliance", "oversight"},
    "oversight": {"oversight", "accountability", "compliance", "review"},
    "health": {"health", "medical", "care", "coverage", "clinic"},
    "education": {"education", "college", "university", "higher education", "institutional aid"},
    "student": {"student", "students", "college", "campus"},
    "business": {"business", "enterprise", "entrepreneur", "commerce", "procurement"},
    "voting": {"voting", "election", "ballot", "district"},
    "justice": {"justice", "sentencing", "expungement", "reentry"},
}
DISALLOWED_TITLE_HINTS = {
    "designate",
    "designation",
    "designating",
    "designates",
    "naming",
    "rename",
    "renaming",
    "commemorating",
    "commemoration",
    "honoring",
    "honour",
    "recognizing",
    "recognition",
    "congratulating",
    "celebrating",
    "memorial",
}
DISALLOWED_SUMMARY_HINTS = {
    "designates",
    "redesignates",
    "names the",
    "renames the",
    "commemorates",
    "recognizes the",
    "expresses support for",
    "disapproving the rule",
    "disapproval resolution",
}
DISCOVERY_FIELDS = [
    "future_bill_id",
    "future_bill_title",
    "target_area",
    "current_status",
    "why_discovery_was_triggered",
    "domain_warning",
    "retrieval_rejected_count",
    "retrieval_passed_count",
    "rejected_by_domain",
    "rejected_by_bill_type",
    "rejected_by_anchor",
    "rejected_by_alignment",
    "rejected_examples",
    "accepted_examples",
    "coverage_note",
    "future_bill_signals",
    "generated_queries",
    "discovered_candidates",
]


def candidate_text(title: str | None, summary: str | None) -> str:
    return normalize_whitespace(f"{title or ''} {summary or ''}")


def future_bill_text(future_bill: dict[str, Any]) -> str:
    return normalize_whitespace(
        f"{future_bill.get('title') or ''} {future_bill.get('problem_statement') or ''} {future_bill.get('proposed_solution') or ''}"
    )


def text_block(*parts: str | None) -> str:
    return normalize_whitespace(" ".join(part or "" for part in parts))


def discovery_tokens(text: str | None) -> list[str]:
    return [
        token
        for token in re.findall(r"[a-z0-9]+", (text or "").lower())
        if len(token) > 2 and token not in DISCOVERY_STOPWORDS
    ]


def expand_keywords(keywords: set[str]) -> set[str]:
    expanded = set(keywords)
    for keyword in list(keywords):
        for root, synonyms in SYNONYM_GROUPS.items():
            if keyword == root or keyword in synonyms:
                expanded.update(synonyms)
    return expanded


def extract_population_keywords(text: str) -> set[str]:
    lowered = text.lower()
    matches = set()
    for family, hints in POPULATION_QUERY_TERMS.items():
        if any(hint in lowered for hint in hints):
            matches.add(family)
            matches.update(hints)
    return matches


def extract_future_bill_signals(future_bill: dict[str, Any]) -> dict[str, Any]:
    domain, domain_warning = classify_future_bill_domain(future_bill)
    combined_text = future_bill_text(future_bill)
    problem_keywords = set(discovery_tokens(future_bill.get("problem_statement")))
    solution_keywords = set(discovery_tokens(future_bill.get("proposed_solution")))
    title_keywords = set(discovery_tokens(future_bill.get("title")))
    domain_keywords = set(DOMAIN_QUERY_TERMS.get(domain or "", set())) | domain_anchor_matches(domain, combined_text)
    mechanism_families = classify_mechanism_families(text_block(future_bill.get("proposed_solution"), future_bill.get("problem_statement")))
    mechanism_keywords = {
        term
        for family in mechanism_families
        for term in MECHANISM_QUERY_TERMS.get(family, set())
    }
    population_keywords = extract_population_keywords(combined_text)
    expanded_problem = expand_keywords(problem_keywords | title_keywords)
    expanded_solution = expand_keywords(solution_keywords | mechanism_keywords)
    expanded_population = expand_keywords(population_keywords)
    return {
        "domain": domain,
        "domain_warning": domain_warning,
        "domain_keywords": sorted(domain_keywords),
        "problem_keywords": sorted(expanded_problem),
        "solution_keywords": sorted(expanded_solution),
        "population_keywords": sorted(expanded_population),
        "mechanism_families": sorted(mechanism_families),
    }


def extract_candidate_signals(text: str, domain: str | None) -> dict[str, Any]:
    candidate_domain = normalized_issue_domain(None, text)
    candidate_mechanisms = classify_mechanism_families(text)
    domain_signals = domain_anchor_matches(domain, text)
    population_signals = extract_population_keywords(text)
    mechanism_signals = {
        term
        for family in candidate_mechanisms
        for term in MECHANISM_QUERY_TERMS.get(family, set())
    }
    tokens = set(discovery_tokens(text))
    return {
        "candidate_domain": candidate_domain,
        "domain_signals": sorted(domain_signals),
        "mechanism_signals": sorted(mechanism_signals),
        "population_signals": sorted(population_signals),
        "tokens": tokens,
    }


def pair_terms(values: list[str], limit: int) -> list[str]:
    items = [value for value in values if value][:limit]
    if len(items) < 2:
        return items
    return [" ".join(combo) for combo in combinations(items[:3], 2)]


def domain_anchor_matches(domain: str | None, text: str) -> set[str]:
    if not domain or domain not in DOMAIN_ANCHORS:
        return set()
    lowered = (text or "").lower()
    matches = set()
    for anchor in DOMAIN_ANCHORS[domain]:
        if anchor in lowered:
            matches.add(anchor)
    return matches


def generic_overlap_without_domain_anchor(tokens: set[str], domain: str | None, text: str) -> bool:
    generic_hits = tokens & GENERIC_POLICY_TERMS
    return bool(generic_hits) and not domain_anchor_matches(domain, text)


def bill_type_is_low_quality(candidate: dict[str, Any]) -> bool:
    bill_number = str(candidate.get("bill_number") or "").lower()
    title = (candidate.get("title") or "").lower()
    summary = (candidate.get("official_summary") or "").lower()
    if bill_number.startswith(("h.res", "s.res", "h.j.res", "s.j.res", "hjres", "sjres")):
        return True
    if any(hint in title for hint in DISALLOWED_TITLE_HINTS | {"expressing support"}):
        return True
    if any(hint in summary for hint in DISALLOWED_SUMMARY_HINTS):
        return True
    return False


def candidate_domain_allowed(future_bill: dict[str, Any], text: str) -> tuple[bool, str | None, str | None]:
    future_domain = classify_future_bill_domain(future_bill)[0]
    candidate_domain = normalized_issue_domain(None, text)
    has_explicit_overlap = explicit_domain_overlap(future_bill.get("target_area"), text)
    if future_domain and candidate_domain and candidate_domain != future_domain and not has_explicit_overlap:
        return False, future_domain, candidate_domain
    return True, future_domain, candidate_domain


def classify_future_bill_domain(future_bill: dict[str, Any]) -> tuple[str | None, str | None]:
    target_area = future_bill.get("target_area")
    combined_text = future_bill_text(future_bill)
    domain = detect_issue_domain(target_area)
    if domain:
        return domain, None
    domain = normalized_issue_domain(target_area, combined_text)
    if domain:
        return domain, None
    warning = "Future bill domain remained general after fallback classification."
    if "hbcu" in combined_text.lower() or "minority-serving" in combined_text.lower() or "title iii" in combined_text.lower() or "title v" in combined_text.lower():
        return "education", None
    return None, warning


def query_quality_ok(query_text: str, domain: str | None, mechanism_terms: set[str], population_terms: set[str], search_type: str) -> bool:
    lowered = normalize_whitespace(query_text).lower()
    if not lowered or len(lowered.split()) < 2:
        return False
    domain_hits = domain_anchor_matches(domain, lowered)
    if not domain_hits:
        return False
    mechanism_hit = any(term in lowered for term in mechanism_terms)
    population_hit = any(term in lowered for term in population_terms)
    if search_type == "domain_query":
        return len(domain_hits) >= 1
    if search_type == "population_query":
        return population_hit
    return mechanism_hit or population_hit


def get_project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def get_reports_dir() -> Path:
    return get_project_root() / "python" / "reports"


def get_db_connection():
    from audit_future_bill_links import get_db_connection as _get_db_connection

    return _get_db_connection()


def import_utils():
    from import_tracked_bills import (
        build_bill_number_display,
        congress_get,
        extract_bill_title,
        fetch_bill_detail,
        fetch_latest_summary,
        get_api_key,
        infer_action_type,
        normalize_bill_type,
        safe_get,
    )

    return {
        "build_bill_number_display": build_bill_number_display,
        "congress_get": congress_get,
        "extract_bill_title": extract_bill_title,
        "fetch_bill_detail": fetch_bill_detail,
        "fetch_latest_summary": fetch_latest_summary,
        "get_api_key": get_api_key,
        "infer_action_type": infer_action_type,
        "normalize_bill_type": normalize_bill_type,
        "safe_get": safe_get,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Discover conservative tracked bill candidates for future bill concepts with weak coverage."
    )
    parser.add_argument("--only-future-bill-id", type=int, action="append", help="Limit discovery to one or more future_bill_id values")
    parser.add_argument("--max-items", type=int, help="Maximum number of future bill concepts to process")
    parser.add_argument("--top-k", type=int, default=DEFAULT_TOP_K, help="Number of ranked discovery candidates to keep per future bill")
    parser.add_argument("--use-ollama", action="store_true", help="Use Ollama to judge top discovery candidates")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="Ollama model name")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT, help="Request timeout in seconds")
    parser.add_argument("--temperature", type=float, default=DEFAULT_TEMPERATURE, help="Ollama sampling temperature")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_PATH, help="Discovery report JSON output path")
    parser.add_argument("--csv", nargs="?", const="", help="Optional CSV output path")
    parser.add_argument("--write-seed", action="store_true", help="Write a conservative candidate seed JSON file")
    parser.add_argument("--min-import-priority", default="high", choices=["high", "medium", "low"], help="Minimum priority required to enter the seed file")
    parser.add_argument("--trigger-from-suggestions", type=Path, help="Suggestion report JSON path")
    parser.add_argument("--trigger-from-review", type=Path, help="AI review report JSON path")
    parser.add_argument("--dry-run", action="store_true", help="Metadata flag only; this script never mutates the database")
    parser.add_argument("--ollama-url", default=DEFAULT_OLLAMA_URL, help="Ollama base URL")
    return parser.parse_args()


def load_json_object(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text())
    if not isinstance(payload, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return payload


def fetch_future_bills(cursor, only_future_bill_ids: list[int] | None) -> dict[int, dict[str, Any]]:
    query = """
        SELECT id, title, target_area, problem_statement, proposed_solution, priority_level, status
        FROM future_bills
    """
    params: tuple[Any, ...] = ()
    if only_future_bill_ids:
        placeholders = ", ".join(["%s"] * len(only_future_bill_ids))
        query += f" WHERE id IN ({placeholders})"
        params = tuple(only_future_bill_ids)
    query += " ORDER BY priority_level DESC, id ASC"
    cursor.execute(query, params)
    return {int(row["id"]): row for row in cursor.fetchall()}


def fetch_tracked_bills(cursor) -> list[dict[str, Any]]:
    cursor.execute(
        """
        SELECT
          id,
          bill_number,
          title,
          official_summary,
          jurisdiction,
          chamber,
          session_label,
          bill_status,
          latest_action_date,
          source_system,
          match_confidence,
          active
        FROM tracked_bills
        WHERE active = 1
        ORDER BY latest_action_date DESC, id ASC
        """
    )
    return cursor.fetchall()


def parse_congress_from_session_label(session_label: str | None) -> int | None:
    if not session_label:
        return None
    match = re.search(r"(\d+)", session_label)
    return int(match.group(1)) if match else None


def future_bill_trigger_map(
    suggestion_payload: dict[str, Any] | None,
    review_payload: dict[str, Any] | None,
    future_bills: dict[int, dict[str, Any]],
    only_future_bill_ids: list[int] | None,
    max_items: int | None,
) -> list[dict[str, Any]]:
    only_set = set(only_future_bill_ids or [])
    targets: dict[int, dict[str, Any]] = {}

    for item in suggestion_payload.get("items") or [] if suggestion_payload else []:
        future_bill_id = item.get("future_bill_id")
        if future_bill_id is None or future_bill_id not in future_bills:
            continue
        if only_set and int(future_bill_id) not in only_set:
            continue
        if item.get("recommended_next_step") != "no_good_candidate_found":
            continue
        targets[int(future_bill_id)] = {
            "future_bill_id": int(future_bill_id),
            "current_status": item.get("current_ai_decision") or "no_good_candidate_found",
            "why_discovery_was_triggered": item.get("why_not_direct") or "Suggestion engine returned no_good_candidate_found.",
            "source": "partial_suggestions",
        }

    for item in review_payload.get("items") or [] if review_payload else []:
        future_bill_id = item.get("future_bill_id")
        if future_bill_id is None or future_bill_id not in future_bills:
            continue
        if only_set and int(future_bill_id) not in only_set:
            continue
        if item.get("final_decision") not in {"remove_link", "review_manually"}:
            continue
        if int(future_bill_id) in targets:
            continue
        targets[int(future_bill_id)] = {
            "future_bill_id": int(future_bill_id),
            "current_status": item.get("final_decision"),
            "why_discovery_was_triggered": "AI review left the concept without a reliable current anchor.",
            "source": "ai_review",
        }

    priority_domains = {"housing": 0, "education": 1, "economic": 2}
    ordered = sorted(
        targets.values(),
        key=lambda row: (
            priority_domains.get(detect_issue_domain(future_bills[row["future_bill_id"]].get("target_area")) or "", 9),
            row["current_status"] != "remove_link",
            row["future_bill_id"],
        ),
    )
    if max_items is not None:
        ordered = ordered[:max_items]
    return ordered


def build_query_strategies(future_bill: dict[str, Any]) -> list[dict[str, Any]]:
    signals = extract_future_bill_signals(future_bill)
    domain = signals["domain"] or "general"
    domain_terms = signals["domain_keywords"][:6]
    mechanism_terms = set(signals["solution_keywords"][:10]) | {
        term for family in signals["mechanism_families"] for term in MECHANISM_QUERY_TERMS.get(family, set())
    }
    population_terms = set(signals["population_keywords"][:10])
    problem_terms = [term for term in signals["problem_keywords"] if term not in GENERIC_POLICY_TERMS][:8]

    strategies = []
    query_specs = []

    for term in domain_terms[:4]:
        query_specs.append(
            ([term], "Domain recall query for the policy area.", "domain_query")
        )

    for term in list(sorted(mechanism_terms))[:5]:
        query_specs.append(
            ([domain_terms[0] if domain_terms else domain, term], "Domain + mechanism query.", "mechanism_query")
        )

    for term in list(sorted(population_terms))[:4]:
        query_specs.append(
            ([domain_terms[0] if domain_terms else domain, term], "Domain + population query.", "population_query")
        )

    for combo in pair_terms(domain_terms, 4):
        query_specs.append(([combo], "Expanded domain phrase query.", "domain_query"))

    for term in problem_terms[:4]:
        query_specs.append(
            ([domain_terms[0] if domain_terms else domain, term], "Domain + problem query.", "problem_query")
        )

    for mechanism_term in list(sorted(mechanism_terms))[:4]:
        for population_term in list(sorted(population_terms))[:3]:
            query_specs.append(
                ([domain_terms[0] if domain_terms else domain, mechanism_term, population_term], "Combined domain, mechanism, and population query.", "combined_query")
            )

    for parts, rationale, search_type in query_specs:
        query_text = normalize_whitespace(" ".join(parts))
        if not query_quality_ok(query_text, domain, mechanism_terms, population_terms, search_type):
            continue
        strategies.append(
            {
                "query_text": query_text,
                "rationale": rationale,
                "search_type": search_type,
                "domain": domain,
                "mechanism_family": signals["mechanism_families"],
                "population_terms": sorted(population_terms)[:6],
            }
        )

    deduped = []
    seen = set()
    for strategy in strategies:
        key = normalize_whitespace(strategy["query_text"]).lower()
        if not key or key in seen:
            continue
        seen.add(key)
        deduped.append(strategy)
    return deduped


def query_tokens(strategy: dict[str, Any]) -> set[str]:
    return tokenize(strategy.get("query_text"))


def local_query_match_score(candidate_text: str, strategy: dict[str, Any]) -> float:
    tokens = tokenize(candidate_text)
    search_tokens = query_tokens(strategy)
    if not tokens or not search_tokens:
        return 0.0
    return len(tokens & search_tokens) / len(search_tokens)


def best_query_match(candidate_text_value: str, strategies: list[dict[str, Any]]) -> tuple[float, dict[str, Any] | None]:
    best_score = 0.0
    best_strategy = None
    for strategy in strategies:
        score = local_query_match_score(candidate_text_value, strategy)
        if score > best_score:
            best_score = score
            best_strategy = strategy
    return best_score, best_strategy


def discovery_relevance(future_bill: dict[str, Any], candidate: dict[str, Any], strategies: list[dict[str, Any]]) -> dict[str, Any]:
    future_signals = extract_future_bill_signals(future_bill)
    text = candidate_text(candidate.get("title"), candidate.get("official_summary"))
    candidate_signals = extract_candidate_signals(text, future_signals["domain"])
    best_query_score, best_strategy = best_query_match(text, strategies)
    future_problem = set(future_signals["problem_keywords"])
    future_solution = set(future_signals["solution_keywords"])
    future_population = set(future_signals["population_keywords"])
    token_set = candidate_signals["tokens"]
    problem_overlap = len(token_set & future_problem)
    solution_overlap = len(token_set & future_solution)
    population_overlap = len(token_set & future_population)
    domain_overlap = len(set(candidate_signals["domain_signals"]))
    mechanism_overlap = len(set(candidate_signals["mechanism_signals"]) & set(future_signals["solution_keywords"]))
    relevance = round(
        best_query_score * 4.0
        + min(domain_overlap, 2) * 1.5
        + min(solution_overlap, 3) * 1.25
        + min(problem_overlap, 3) * 1.0
        + min(population_overlap, 2) * 0.75
        + min(mechanism_overlap, 2) * 1.0,
        3,
    )
    reasons = []
    if domain_overlap:
        reasons.append("domain overlap")
    if mechanism_overlap:
        reasons.append("mechanism overlap")
    if population_overlap:
        reasons.append("population overlap")
    if problem_overlap:
        reasons.append("problem overlap")
    if best_strategy:
        reasons.append(f"matched query: {best_strategy['search_type']}")
    return {
        "relevance_score": relevance,
        "matched_query": best_strategy.get("query_text") if best_strategy else None,
        "matched_query_type": best_strategy.get("search_type") if best_strategy else None,
        "selection_reasons": reasons or ["weak textual overlap"],
        "extracted_signals": {
            "domain": candidate_signals["candidate_domain"],
            "domain_signals": candidate_signals["domain_signals"],
            "mechanism_signals": candidate_signals["mechanism_signals"],
            "population_signals": candidate_signals["population_signals"],
        },
    }


def retrieval_prefilter(
    future_bill: dict[str, Any],
    candidate: dict[str, Any],
    query_score: float,
) -> tuple[bool, str | None, str | None]:
    text = candidate_text(candidate.get("title"), candidate.get("official_summary"))
    allowed_domain, future_domain, candidate_domain = candidate_domain_allowed(future_bill, text)
    domain_matches = domain_anchor_matches(future_domain, text)
    has_domain_anchor = bool(domain_matches)

    if not allowed_domain:
        return False, f"cross-domain mismatch ({future_domain} vs {candidate_domain})", "domain"
    if bill_type_is_low_quality(candidate):
        return False, "resolution/commemorative/naming bill filtered", "bill_type"
    if future_domain in DOMAIN_ANCHORS and not has_domain_anchor:
        return False, f"missing required {future_domain} domain anchor", "anchor"
    if generic_overlap_without_domain_anchor(tokenize(text), future_domain, text):
        return False, "generic policy language without domain anchor", "anchor"
    if query_score < 0.2:
        return False, "query match too weak", "alignment"

    scored = score_candidate(future_bill, candidate)
    if scored.get("problem_alignment", 0) == 0 and scored.get("solution_alignment", 0) == 0:
        return False, "no problem/solution alignment", "alignment"
    return True, None, None


def discover_existing_candidates(
    future_bill: dict[str, Any], tracked_bills: list[dict[str, Any]], strategies: list[dict[str, Any]]
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    candidates = []
    metrics = {
        "retrieval_rejected_count": 0,
        "rejected_by_domain": 0,
        "rejected_by_bill_type": 0,
        "rejected_by_anchor": 0,
        "rejected_by_alignment": 0,
        "rejected_examples": [],
    }
    for bill in tracked_bills:
        text = candidate_text(bill.get("title"), bill.get("official_summary"))
        max_query_score, best_strategy = best_query_match(text, strategies)
        if max_query_score < 0.15:
            continue
        allowed, reason, category = retrieval_prefilter(future_bill, bill, max_query_score)
        if not allowed:
            metrics["retrieval_rejected_count"] += 1
            if category == "domain":
                metrics["rejected_by_domain"] += 1
            elif category == "bill_type":
                metrics["rejected_by_bill_type"] += 1
            elif category == "anchor":
                metrics["rejected_by_anchor"] += 1
            elif category == "alignment":
                metrics["rejected_by_alignment"] += 1
            if len(metrics["rejected_examples"]) < 5:
                metrics["rejected_examples"].append(
                    {
                        "bill_number": bill.get("bill_number"),
                        "title": bill.get("title"),
                        "reason": reason,
                        "source": "tracked_bills",
                    }
                )
            continue
        scored_payload = score_candidate(future_bill, bill)
        relevance_payload = discovery_relevance(future_bill, bill, strategies)
        scored = {
            **bill,
            **scored_payload,
            **relevance_payload,
            "source": "tracked_bills",
            "query_match_score": round(max_query_score, 3),
            "matched_query": relevance_payload["matched_query"] or (best_strategy.get("query_text") if best_strategy else None),
            "matched_query_type": relevance_payload["matched_query_type"] or (best_strategy.get("search_type") if best_strategy else None),
        }
        candidates.append(scored)
    return candidates, metrics


def fetch_bill_list_page(api_key: str, congress: int, bill_type: str, offset: int) -> list[dict[str, Any]]:
    utils = import_utils()
    payload = utils["congress_get"](
        f"/bill/{congress}/{bill_type}",
        api_key,
        params={"limit": 250, "offset": offset},
    )
    return payload.get("bills") or []


def enrich_remote_candidate(api_key: str, congress: int, bill_type: str, number: str) -> dict[str, Any]:
    utils = import_utils()
    bill = utils["fetch_bill_detail"](congress, bill_type, number, api_key)
    summary = utils["fetch_latest_summary"](congress, bill_type, number, api_key)
    latest_action = bill.get("latestAction") or {}
    return {
        "id": None,
        "bill_number": utils["build_bill_number_display"](bill_type, number),
        "title": utils["extract_bill_title"](bill, utils["build_bill_number_display"](bill_type, number)),
        "official_summary": summary,
        "jurisdiction": "Federal",
        "chamber": bill.get("originChamber"),
        "session_label": f"{congress}th Congress",
        "bill_status": utils["infer_action_type"](latest_action.get("text") or ""),
        "latest_action_date": latest_action.get("actionDate"),
        "source_system": "Congress.gov API discovery",
        "match_confidence": "Medium",
        "active": 1,
        "congress": congress,
        "bill_type": utils["normalize_bill_type"](bill_type),
        "bill_number_raw": number,
        "source": "congress_api",
    }


def discover_remote_candidates(future_bill: dict[str, Any], strategies: list[dict[str, Any]], top_k: int) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    utils = import_utils()
    api_key = utils["get_api_key"]()
    raw_matches: dict[tuple[int, str, str], dict[str, Any]] = {}
    metrics = {
        "retrieval_rejected_count": 0,
        "rejected_by_domain": 0,
        "rejected_by_bill_type": 0,
        "rejected_by_anchor": 0,
        "rejected_by_alignment": 0,
        "rejected_examples": [],
    }

    for congress in (119, 118):
        for bill_type in SUPPORTED_BILL_TYPES:
            try:
                bills = fetch_bill_list_page(api_key, congress, bill_type, 0)
            except requests.HTTPError:
                continue
            for bill in bills:
                title = normalize_whitespace(bill.get("title"))
                if not title:
                    continue
                max_query_score, best_strategy = best_query_match(title, strategies)
                if max_query_score < 0.25:
                    continue
                number = str(bill.get("number") or "").strip()
                key = (congress, bill_type, number)
                current = raw_matches.get(key)
                if current is None or max_query_score > current["query_match_score"]:
                    raw_matches[key] = {
                        "congress": congress,
                        "bill_type": bill_type,
                        "number": number,
                        "title": title,
                        "query_match_score": round(max_query_score, 3),
                        "matched_query": best_strategy.get("query_text") if best_strategy else None,
                        "matched_query_type": best_strategy.get("search_type") if best_strategy else None,
                    }

    enriched = []
    ranked = sorted(raw_matches.values(), key=lambda row: (-row["query_match_score"], row["congress"], row["number"]))[: max(top_k * 3, 10)]
    for row in ranked:
        try:
            enriched_candidate = enrich_remote_candidate(api_key, row["congress"], row["bill_type"], row["number"])
        except Exception:
            continue
        allowed, reason, category = retrieval_prefilter(future_bill, enriched_candidate, row["query_match_score"])
        if not allowed:
            metrics["retrieval_rejected_count"] += 1
            if category == "domain":
                metrics["rejected_by_domain"] += 1
            elif category == "bill_type":
                metrics["rejected_by_bill_type"] += 1
            elif category == "anchor":
                metrics["rejected_by_anchor"] += 1
            elif category == "alignment":
                metrics["rejected_by_alignment"] += 1
            if len(metrics["rejected_examples"]) < 5:
                metrics["rejected_examples"].append(
                    {
                        "bill_number": enriched_candidate.get("bill_number"),
                        "title": enriched_candidate.get("title"),
                        "reason": reason,
                        "source": "congress_api",
                    }
                )
            continue
        scored_payload = score_candidate(future_bill, enriched_candidate)
        relevance_payload = discovery_relevance(future_bill, enriched_candidate, strategies)
        scored = {
            **enriched_candidate,
            **scored_payload,
            **relevance_payload,
            "query_match_score": row["query_match_score"],
            "matched_query": relevance_payload["matched_query"] or row.get("matched_query"),
            "matched_query_type": relevance_payload["matched_query_type"] or row.get("matched_query_type"),
        }
        enriched.append(scored)
    return enriched, metrics


def import_priority_for_candidate(candidate: dict[str, Any]) -> str:
    if candidate.get("candidate_relationship_fit") == "direct" and candidate.get("candidate_total_score", 0) >= 11:
        return "high"
    if candidate.get("candidate_relationship_fit") == "partial" and candidate.get("candidate_total_score", 0) >= 8:
        return "medium"
    if candidate.get("candidate_total_score", 0) >= 5 and not candidate.get("severe_domain_block") and not candidate.get("severe_mechanism_block"):
        return "low"
    return "reject"


def merge_retrieval_metrics(*metric_sets: dict[str, Any]) -> dict[str, Any]:
    merged = {
        "retrieval_rejected_count": 0,
        "rejected_by_domain": 0,
        "rejected_by_bill_type": 0,
        "rejected_by_anchor": 0,
        "rejected_by_alignment": 0,
        "rejected_examples": [],
    }
    for metrics in metric_sets:
        merged["retrieval_rejected_count"] += metrics["retrieval_rejected_count"]
        merged["rejected_by_domain"] += metrics["rejected_by_domain"]
        merged["rejected_by_bill_type"] += metrics["rejected_by_bill_type"]
        merged["rejected_by_anchor"] += metrics["rejected_by_anchor"]
        merged["rejected_by_alignment"] += metrics["rejected_by_alignment"]
        for example in metrics["rejected_examples"]:
            if len(merged["rejected_examples"]) >= 5:
                break
            merged["rejected_examples"].append(example)
    return merged


def build_coverage_note(future_signals: dict[str, Any], strategies: list[dict[str, Any]], passed_count: int) -> str | None:
    if passed_count >= 3:
        return None
    reasons = []
    if not future_signals.get("domain"):
        reasons.append("future bill domain was weak or ambiguous")
    if not strategies:
        reasons.append("query generation produced no valid domain-aware queries")
    if not future_signals.get("mechanism_families"):
        reasons.append("mechanism extraction was weak")
    if not future_signals.get("population_keywords"):
        reasons.append("population extraction was weak")
    if passed_count == 0:
        reasons.append("all discovery candidates were rejected by the strict filters")
    elif passed_count < 3:
        reasons.append("fewer than three candidates survived retrieval")
    return "; ".join(reasons) if reasons else "candidate coverage remained thin after strict filtering"


def explain_candidate(candidate: dict[str, Any]) -> tuple[str, str, str]:
    why_this = list(candidate.get("why_this_candidate") or [])
    if candidate.get("solution_alignment", 0) >= 2 and "Meaningfully advances the future bill's proposed solution." not in why_this:
        why_this.append("Strong solution-level alignment for discovery.")
    if candidate.get("problem_alignment", 0) >= 2 and "Addresses the same core problem area." not in why_this:
        why_this.append("Targets the same policy problem.")
    if candidate.get("candidate_relationship_fit") == "partial" and not any("partial" in item.lower() for item in why_this):
        why_this.append("Could support a partial legislative anchor after import.")
    if candidate.get("source") == "tracked_bills" and not any("tracked_bills" in item.lower() for item in why_this):
        why_this.append("Already exists in tracked_bills and may have been overlooked.")
    if not why_this:
        why_this.append("Only weak import signals are present.")

    why_not_direct = list(candidate.get("why_not_direct") or [])
    if not why_not_direct:
        why_not_direct.append("Candidate is not yet strong enough to assume it would become a reliable direct anchor.")

    next_step = {
        "high": "add_to_tracked_bills_seed",
        "medium": "import_and_review",
        "low": "import_as_low_priority_candidate",
        "reject": "reject_candidate",
    }[candidate["import_priority"]]
    return " ".join(why_this), " ".join(why_not_direct), next_step


def discovery_seed_row(candidate: dict[str, Any], future_bill_id: int) -> dict[str, Any]:
    congress = candidate.get("congress") or parse_congress_from_session_label(candidate.get("session_label"))
    bill_number = candidate.get("bill_number_raw")
    if not bill_number and candidate.get("bill_number"):
        match = re.match(r"^[A-Z\.]+\s+(\d+)$", str(candidate["bill_number"]).strip())
        bill_number = match.group(1) if match else candidate["bill_number"]
    return {
        "future_bill_id": future_bill_id,
        "congress": congress,
        "bill_type": candidate.get("bill_type") or str(candidate.get("bill_number", "")).split(" ", 1)[0].replace(".", "").lower(),
        "bill_number": str(bill_number),
        "jurisdiction": candidate.get("jurisdiction", "Federal"),
        "chamber": candidate.get("chamber"),
        "source_system": candidate.get("source_system", "Congress.gov API discovery"),
        "active": True,
        "match_confidence": "Medium" if candidate["import_priority"] == "high" else "Low",
        "link_type": None,
        "link_notes": (
            "Discovery candidate for future bill coverage review. "
            f"Future bill {future_bill_id}; ranked as {candidate['import_priority']} import priority."
        ),
    }


def build_seed(candidates: list[dict[str, Any]], min_import_priority: str) -> list[dict[str, Any]]:
    seed_rows = []
    threshold = IMPORT_PRIORITY_ORDER[min_import_priority]
    seen = set()
    for candidate in candidates:
        if IMPORT_PRIORITY_ORDER[candidate["import_priority"]] < threshold:
            continue
        if candidate.get("source") != "congress_api":
            continue
        row = discovery_seed_row(candidate, int(candidate["future_bill_id"]))
        key = (row["congress"], row["bill_type"], row["bill_number"])
        if key in seen:
            continue
        seen.add(key)
        seed_rows.append(row)
    return seed_rows


def build_llm_prompt(future_bill: dict[str, Any], candidate: dict[str, Any]) -> str:
    payload = {
        "future_bill": {
            "id": future_bill["id"],
            "title": future_bill.get("title"),
            "target_area": future_bill.get("target_area"),
            "problem_statement": future_bill.get("problem_statement"),
            "proposed_solution": future_bill.get("proposed_solution"),
        },
        "candidate": {
            "bill_number": candidate.get("bill_number"),
            "title": candidate.get("title"),
            "official_summary": candidate.get("official_summary"),
            "source": candidate.get("source"),
            "local_scores": {
                "problem_alignment": candidate.get("problem_alignment"),
                "solution_alignment": candidate.get("solution_alignment"),
                "population_alignment": candidate.get("population_alignment"),
                "mechanism_specificity": candidate.get("mechanism_specificity"),
                "evidence_strength": candidate.get("evidence_strength"),
                "relationship_fit": candidate.get("candidate_relationship_fit"),
                "import_priority": candidate.get("import_priority"),
            },
        },
    }
    schema = {
        "decision": "strong_import_candidate | possible_import_candidate | weak_candidate | reject_candidate",
        "reasoning_short": "short explanation",
    }
    return (
        "You are deciding whether a discovered bill should be added as a tracked-bill candidate for a future bill concept.\n"
        "Broad racial-equity language is not enough. Require policy-domain and mechanism plausibility.\n"
        "Return strict JSON only.\n\n"
        f"{json.dumps(payload, indent=2, ensure_ascii=True)}\n\n"
        f"{json.dumps(schema, indent=2, ensure_ascii=True)}"
    )


def call_ollama(prompt: str, model: str, ollama_url: str, timeout_seconds: int, temperature: float) -> dict[str, Any]:
    response = requests.post(
        f"{ollama_url.rstrip('/')}/api/generate",
        json={
            "model": model,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {"temperature": temperature, "seed": DEFAULT_SEED},
        },
        timeout=timeout_seconds,
    )
    response.raise_for_status()
    payload = response.json()
    body = payload.get("response") or ""
    start = body.find("{")
    end = body.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("Ollama discovery response did not contain a JSON object")
    return json.loads(body[start : end + 1])


def normalize_llm_import_decision(value: Any) -> str:
    decision = str(value or "").strip().lower()
    if decision in {"strong_import_candidate", "possible_import_candidate", "weak_candidate", "reject_candidate"}:
        return decision
    return "reject_candidate"


def judge_import_candidates(
    future_bill: dict[str, Any],
    candidates: list[dict[str, Any]],
    model: str,
    ollama_url: str,
    timeout_seconds: int,
    temperature: float,
) -> list[dict[str, Any]]:
    judged = []
    for candidate in candidates:
        try:
            payload = call_ollama(build_llm_prompt(future_bill, candidate), model, ollama_url, timeout_seconds, temperature)
            llm_decision = normalize_llm_import_decision(payload.get("decision"))
            llm_reasoning = normalize_whitespace(payload.get("reasoning_short"))[:400]
        except Exception as error:
            llm_decision = "reject_candidate"
            llm_reasoning = f"Ollama discovery judge failed: {error}"

        updated = dict(candidate)
        updated["llm_import_decision"] = llm_decision
        updated["llm_reasoning_short"] = llm_reasoning

        if candidate.get("severe_domain_block") or candidate.get("severe_mechanism_block") or candidate.get("broad_equity_only"):
            updated["llm_import_decision"] = "reject_candidate"
            updated["import_priority"] = "reject"
        elif llm_decision == "weak_candidate" and updated["import_priority"] == "high":
            updated["import_priority"] = "medium"
        elif llm_decision == "reject_candidate":
            updated["import_priority"] = "reject"

        judged.append(updated)
    return judged


def main() -> None:
    args = parse_args()
    if args.max_items is not None and args.max_items <= 0:
        raise SystemExit("--max-items must be greater than 0")
    if args.top_k <= 0:
        raise SystemExit("--top-k must be greater than 0")
    if args.timeout <= 0:
        raise SystemExit("--timeout must be greater than 0")
    if not 0.0 <= args.temperature <= 1.0:
        raise SystemExit("--temperature must be between 0.0 and 1.0")

    suggestion_payload = load_json_object(args.trigger_from_suggestions.resolve()) if args.trigger_from_suggestions else None
    review_payload = load_json_object(args.trigger_from_review.resolve()) if args.trigger_from_review else None
    if not suggestion_payload and not review_payload and not args.only_future_bill_id:
        raise SystemExit("Provide --trigger-from-suggestions, --trigger-from-review, or --only-future-bill-id.")

    resolved_model = None
    if args.use_ollama:
        resolved_model = resolve_model_name(args.model, fetch_available_models(args.ollama_url, args.timeout))
        if resolved_model != args.model:
            print(f"Requested model {args.model} not found. Using {resolved_model} instead.")

    try:
        conn = get_db_connection()
    except Exception as error:
        raise SystemExit(f"Database connection error: {error}") from error

    try:
        with conn.cursor() as cursor:
            future_bills = fetch_future_bills(cursor, args.only_future_bill_id)
            triggers = future_bill_trigger_map(
                suggestion_payload,
                review_payload,
                future_bills,
                args.only_future_bill_id,
                args.max_items,
            )
            if not triggers:
                print("No future bill concepts were eligible for candidate discovery.")
                return

            tracked_bills = fetch_tracked_bills(cursor)
            discovery_rows = []
            seed_candidates = []
            total_rejected = 0
            total_passed = 0
            total_rejected_by_domain = 0
            total_rejected_by_bill_type = 0
            total_rejected_by_anchor = 0
            total_rejected_by_alignment = 0

            print("Future Bill Candidate Discovery")
            print(f"Targets: {len(triggers)}")
            print(f"Top K candidates: {args.top_k}")
            print(f"Ollama: {'enabled' if args.use_ollama else 'disabled'}")

            for index, trigger in enumerate(triggers, start=1):
                future_bill = future_bills[trigger["future_bill_id"]]
                future_domain, domain_warning = classify_future_bill_domain(future_bill)
                future_signals = extract_future_bill_signals(future_bill)
                if domain_warning:
                    print(f"Warning: future_bill_id={future_bill['id']} {domain_warning}")
                strategies = build_query_strategies(future_bill)
                local_candidates, local_metrics = discover_existing_candidates(future_bill, tracked_bills, strategies)
                remote_candidates, remote_metrics = discover_remote_candidates(future_bill, strategies, args.top_k)
                retrieval_metrics = merge_retrieval_metrics(local_metrics, remote_metrics)
                retrieval_rejected_count = retrieval_metrics["retrieval_rejected_count"]

                combined: dict[str, dict[str, Any]] = {}
                for candidate in [*local_candidates, *remote_candidates]:
                    key = candidate.get("bill_number") or f"{candidate.get('source')}:{candidate.get('title')}"
                    current = combined.get(key)
                    if current is None or candidate["candidate_total_score"] > current["candidate_total_score"]:
                        combined[key] = candidate

                ranked = sorted(
                    combined.values(),
                    key=lambda row: (
                        row["candidate_relationship_fit"] != "direct",
                        row["candidate_relationship_fit"] != "partial",
                        -row.get("relevance_score", 0.0),
                        -row["candidate_total_score"],
                        -row.get("query_match_score", 0.0),
                        row.get("bill_number") or "",
                    ),
                )

                for candidate in ranked:
                    candidate["import_priority"] = import_priority_for_candidate(candidate)
                    why_this, why_not_direct, next_step = explain_candidate(candidate)
                    candidate["why_this_candidate"] = why_this
                    candidate["why_not_direct_anchor_yet"] = why_not_direct
                    candidate["recommended_next_step"] = next_step
                    candidate["future_bill_id"] = future_bill["id"]

                ranked = ranked[: args.top_k]
                if args.use_ollama and ranked:
                    judged = judge_import_candidates(
                        future_bill,
                        ranked[: min(3, len(ranked))],
                        resolved_model,
                        args.ollama_url,
                        args.timeout,
                        args.temperature,
                    )
                    by_bill = {candidate["bill_number"]: candidate for candidate in judged}
                    for candidate in ranked:
                        if candidate["bill_number"] in by_bill:
                            candidate.update(by_bill[candidate["bill_number"]])

                for rank, candidate in enumerate(ranked, start=1):
                    candidate["candidate_rank"] = rank

                retrieval_passed_count = len(combined)
                coverage_note = build_coverage_note(future_signals, strategies, retrieval_passed_count)
                total_rejected += retrieval_rejected_count
                total_passed += retrieval_passed_count
                total_rejected_by_domain += retrieval_metrics["rejected_by_domain"]
                total_rejected_by_bill_type += retrieval_metrics["rejected_by_bill_type"]
                total_rejected_by_anchor += retrieval_metrics["rejected_by_anchor"]
                total_rejected_by_alignment += retrieval_metrics["rejected_by_alignment"]

                discovery_rows.append(
                    {
                        "future_bill_id": future_bill["id"],
                        "future_bill_title": future_bill.get("title"),
                        "target_area": future_bill.get("target_area"),
                        "current_status": trigger["current_status"],
                        "why_discovery_was_triggered": trigger["why_discovery_was_triggered"],
                        "domain_warning": domain_warning,
                        "coverage_note": coverage_note,
                        "future_bill_signals": future_signals,
                        "retrieval_rejected_count": retrieval_rejected_count,
                        "retrieval_passed_count": retrieval_passed_count,
                        "rejected_by_domain": retrieval_metrics["rejected_by_domain"],
                        "rejected_by_bill_type": retrieval_metrics["rejected_by_bill_type"],
                        "rejected_by_anchor": retrieval_metrics["rejected_by_anchor"],
                        "rejected_by_alignment": retrieval_metrics["rejected_by_alignment"],
                        "rejected_examples": retrieval_metrics["rejected_examples"],
                        "accepted_examples": [
                            {
                                "bill_number": candidate.get("bill_number"),
                                "title": candidate.get("title"),
                                "source": candidate.get("source"),
                            }
                            for candidate in ranked[:5]
                        ],
                        "generated_queries": strategies,
                        "discovered_candidates": [
                            {
                                "bill_number": candidate.get("bill_number"),
                                "chamber": candidate.get("chamber"),
                                "congress": candidate.get("congress") or parse_congress_from_session_label(candidate.get("session_label")),
                                "title": candidate.get("title"),
                                "official_summary": candidate.get("official_summary"),
                                "source": candidate.get("source"),
                                "matched_query": candidate.get("matched_query"),
                                "matched_query_type": candidate.get("matched_query_type"),
                                "relevance_score": candidate.get("relevance_score"),
                                "selection_reasons": candidate.get("selection_reasons"),
                                "extracted_signals": candidate.get("extracted_signals"),
                                "problem_alignment": candidate.get("problem_alignment"),
                                "solution_alignment": candidate.get("solution_alignment"),
                                "population_alignment": candidate.get("population_alignment"),
                                "mechanism_specificity": candidate.get("mechanism_specificity"),
                                "evidence_strength": candidate.get("evidence_strength"),
                                "import_priority": candidate.get("import_priority"),
                                "why_this_candidate": candidate.get("why_this_candidate"),
                                "why_not_direct_anchor_yet": candidate.get("why_not_direct_anchor_yet"),
                                "recommended_next_step": candidate.get("recommended_next_step"),
                                "llm_import_decision": candidate.get("llm_import_decision"),
                                "llm_reasoning_short": candidate.get("llm_reasoning_short"),
                            }
                            for candidate in ranked
                        ],
                    }
                )
                seed_candidates.extend(ranked)
                print(
                    f"[{index}/{len(triggers)}] future_bill_id={future_bill['id']} "
                    f"passed={retrieval_passed_count} rejected={retrieval_rejected_count} kept={len(ranked)}"
                )
    finally:
        conn.close()

    output_path = args.output.resolve()
    csv_path = derive_csv_path(args.csv, output_path)
    payload = {
        "generated_at": datetime.now(UTC).isoformat(),
        "trigger_from_suggestions": str(args.trigger_from_suggestions.resolve()) if args.trigger_from_suggestions else None,
        "trigger_from_review": str(args.trigger_from_review.resolve()) if args.trigger_from_review else None,
        "use_ollama": args.use_ollama,
        "requested_model": args.model if args.use_ollama else None,
        "resolved_model": resolved_model,
        "top_k": args.top_k,
        "dry_run": args.dry_run,
        "summary": {
            "future_bills_reviewed": len(discovery_rows),
            "future_bills_with_candidates": sum(1 for row in discovery_rows if row["discovered_candidates"]),
            "future_bills_without_candidates": sum(1 for row in discovery_rows if not row["discovered_candidates"]),
            "retrieval_rejected_count": total_rejected,
            "retrieval_passed_count": total_passed,
            "rejected_by_domain": total_rejected_by_domain,
            "rejected_by_bill_type": total_rejected_by_bill_type,
            "rejected_by_anchor": total_rejected_by_anchor,
            "rejected_by_alignment": total_rejected_by_alignment,
        },
        "items": discovery_rows,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, indent=2, default=str))
    print(f"Wrote discovery report to {output_path}")

    if csv_path:
        csv_rows = []
        for row in discovery_rows:
            for candidate in row["discovered_candidates"]:
                csv_rows.append(
                    {
                        "future_bill_id": row["future_bill_id"],
                        "future_bill_title": row["future_bill_title"],
                        "target_area": row["target_area"],
                        "current_status": row["current_status"],
                        "bill_number": candidate["bill_number"],
                        "title": candidate["title"],
                        "source": candidate["source"],
                        "matched_query": candidate.get("matched_query"),
                        "relevance_score": candidate.get("relevance_score"),
                        "problem_alignment": candidate["problem_alignment"],
                        "solution_alignment": candidate["solution_alignment"],
                        "population_alignment": candidate["population_alignment"],
                        "mechanism_specificity": candidate["mechanism_specificity"],
                        "evidence_strength": candidate["evidence_strength"],
                        "import_priority": candidate["import_priority"],
                        "recommended_next_step": candidate["recommended_next_step"],
                    }
                )
        with csv_path.open("w", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(csv_rows[0].keys()) if csv_rows else [
                "future_bill_id",
                "future_bill_title",
                "target_area",
                "current_status",
                "bill_number",
                "title",
                "source",
                "matched_query",
                "relevance_score",
                "problem_alignment",
                "solution_alignment",
                "population_alignment",
                "mechanism_specificity",
                "evidence_strength",
                "import_priority",
                "recommended_next_step",
            ])
            writer.writeheader()
            for row in csv_rows:
                writer.writerow(row)
        print(f"Wrote discovery CSV to {csv_path}")

    if args.write_seed:
        seed_rows = build_seed(seed_candidates, args.min_import_priority)
        seed_path = DEFAULT_SEED_OUTPUT_PATH
        seed_path.write_text(json.dumps(seed_rows, indent=2))
        print(f"Wrote candidate seed file to {seed_path}")


if __name__ == "__main__":
    main()
