#!/usr/bin/env python3
import argparse
import csv
import json
import re
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from lib.llm.provider import default_model_name, generate_text, list_available_models

DEFAULT_OPENAI_BASE_URL = ""
DEFAULT_MODEL = default_model_name()
DEFAULT_TIMEOUT = 300
DEFAULT_TEMPERATURE = 0.1
DEFAULT_TOP_K = 5
DEFAULT_LLM_TOP_CANDIDATES = 3
DEFAULT_SEED = 7
FALLBACK_MODELS = ["qwen3:latest", "llama3.2:latest"]
STOPWORDS = {
    "a",
    "act",
    "acts",
    "additional",
    "address",
    "african",
    "all",
    "also",
    "americans",
    "and",
    "bill",
    "black",
    "by",
    "create",
    "develop",
    "education",
    "equity",
    "establish",
    "expand",
    "federal",
    "for",
    "from",
    "fund",
    "funding",
    "in",
    "include",
    "increase",
    "law",
    "many",
    "of",
    "on",
    "or",
    "program",
    "provide",
    "reform",
    "require",
    "restore",
    "support",
    "systemic",
    "the",
    "their",
    "through",
    "to",
    "under",
    "with",
}
DIRECT_BENEFIT_HINTS = {
    "capital improvement",
    "cash",
    "compensation",
    "direct grant",
    "direct grants",
    "direct payment",
    "direct payments",
    "down payment assistance",
    "down-payment assistance",
    "endowment",
    "endowment matching",
    "grant",
    "grants",
    "loan guarantees",
    "loans",
    "mortgage",
    "procurement",
    "scholarship",
    "stipend",
    "subsidy",
    "tax credit",
    "tax credits",
    "trust account",
    "trust accounts",
    "tuition",
}
STUDY_BILL_HINTS = {
    "advisory",
    "assess",
    "commission",
    "feasibility",
    "hearing",
    "report",
    "research",
    "review",
    "study",
    "task force",
}
MECHANISM_HINTS = {
    "commission": {"commission", "study", "task force", "report", "advisory"},
    "direct_benefit": {"grant", "grants", "payment", "payments", "compensation", "subsidy", "voucher", "scholarship", "loan", "loans", "trust", "tuition"},
    "institutional_funding": {"endowment", "infrastructure", "research", "institution", "institutions", "college", "colleges", "university", "universities", "center", "centers"},
    "regulatory_enforcement": {"enforcement", "preclearance", "oversight", "accountability", "review", "require", "standardize", "anti-bias"},
    "health_investment": {"medicaid", "coverage", "hospital", "maternal", "health", "clinic", "community health", "preventive care"},
    "justice_relief": {"sentencing", "expungement", "sentence review", "reentry", "reintegration", "incarceration"},
}
DOMAIN_KEYWORDS = {
    "education": {"education", "school", "schools", "student", "students", "college", "colleges", "university", "universities", "hbcu", "hbcus", "tuition", "campus"},
    "healthcare": {"health", "healthcare", "hospital", "hospitals", "maternal", "medicaid", "clinic", "clinics", "care", "birth"},
    "housing": {"housing", "homeownership", "mortgage", "tenant", "rent", "appraisal", "lending", "home", "homes"},
    "voting": {"voting", "vote", "votes", "ballot", "election", "elections", "preclearance", "district", "redistricting"},
    "economic": {"economic", "wealth", "capital", "business", "businesses", "credit", "procurement", "entrepreneur", "entrepreneurs", "trust", "baby bonds"},
    "criminal": {"criminal", "justice", "sentencing", "incarceration", "prison", "prisons", "expungement", "drug"},
}
BROAD_EQUITY_HINTS = {
    "black",
    "communities",
    "community",
    "descendants",
    "disadvantaged",
    "disparities",
    "equity",
    "historically",
    "inequities",
    "neglect",
    "racial",
    "reparative",
    "underserved",
    "vulnerable",
}
EDUCATION_SUPPORT_HINTS = {
    "hbcu",
    "hbcus",
    "historically black colleges and universities",
    "minority-serving institution",
    "minority-serving institutions",
    "msi",
    "msis",
    "title iii",
    "title v",
    "higher education",
    "college",
    "colleges",
    "university",
    "universities",
    "institutional grant",
    "institutional grants",
    "institutional support",
    "capital improvement",
    "capital improvements",
    "infrastructure",
    "endowment",
    "research funding",
    "campus",
}
EDUCATION_INSTITUTION_CORE_HINTS = {
    "hbcu",
    "hbcus",
    "historically black colleges",
    "historically black colleges and universities",
    "minority-serving institution",
    "minority-serving institutions",
    "msi",
    "msis",
    "title iii",
    "title v",
    "higher education institution",
    "higher education institutions",
    "college",
    "colleges",
    "university",
    "universities",
    "campus",
}
EDUCATION_INSTITUTION_SUPPORT_HINTS = {
    "institutional aid",
    "institutional funding",
    "institutional grant",
    "institutional grants",
    "institutional support",
    "endowment",
    "capital improvement",
    "capital improvements",
    "campus infrastructure",
    "research funding",
    "grant",
    "grants",
    "funding",
}
BUSINESS_DEVELOPMENT_HINTS = {
    "business development",
    "minority business",
    "minority businesses",
    "enterprise",
    "entrepreneurship",
    "commerce",
    "small business",
    "small businesses",
    "mbda",
    "business center",
    "business centers",
    "capital formation",
    "mbe",
    "mbes",
    "minority enterprise",
    "economic resiliency",
    "workforce development",
    "career development",
    "training",
}
OUTPUT_FIELDS = [
    "future_bill_id",
    "future_bill_title",
    "current_future_bill_link_id",
    "current_tracked_bill_id",
    "current_tracked_bill_title",
    "current_ai_decision",
    "suggestion_type",
    "suggested_link_type",
    "candidate_tracked_bill_id",
    "candidate_bill_number",
    "candidate_tracked_bill_title",
    "candidate_official_summary",
    "candidate_problem_alignment",
    "candidate_solution_alignment",
    "candidate_population_alignment",
    "candidate_mechanism_specificity",
    "candidate_evidence_strength",
    "candidate_relationship_fit",
    "partial_reason",
    "mechanism_inferred",
    "mechanism_upgraded",
    "reuse_penalty_applied",
    "fallback_partial_used",
    "classification_stage",
    "candidate_total_score",
    "candidate_rank",
    "llm_candidate_decision",
    "llm_reasoning_short",
    "why_this_candidate",
    "why_not_direct",
    "recommended_next_step",
]


def get_db_connection():
    from audit_future_bill_links import get_db_connection as _get_db_connection

    return _get_db_connection()


@dataclass
class TargetContext:
    future_bill_id: int
    future_bill_link_id: int | None
    current_tracked_bill_id: int | None
    current_ai_decision: str | None
    current_match_label: str | None
    current_tracked_bill_title: str | None = None
    review_item: dict[str, Any] | None = None
    manual_queue_item: dict[str, Any] | None = None


def get_project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def get_reports_dir() -> Path:
    return get_project_root() / "python" / "reports"


def get_default_review_report_path() -> Path:
    return get_reports_dir() / "future_bill_link_ai_review.json"


def get_default_manual_queue_path() -> Path:
    return get_reports_dir() / "future_bill_link_manual_review_queue.json"


def get_default_output_path() -> Path:
    return get_reports_dir() / "future_bill_link_partial_suggestions.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Suggest conservative partial conversions and alternate future bill link candidates."
    )
    parser.add_argument("--input-review-report", type=Path, default=get_default_review_report_path(), help="AI review report JSON")
    parser.add_argument("--input-manual-queue", type=Path, help="Optional manual review queue JSON")
    parser.add_argument("--top-k", type=int, default=DEFAULT_TOP_K, help="Number of ranked alternate candidates to keep per future bill")
    parser.add_argument("--max-items", type=int, help="Maximum number of target future bills to review")
    parser.add_argument("--only-future-bill-id", type=int, action="append", help="Limit to one or more future_bill_id values")
    parser.add_argument("--only-link-id", type=int, action="append", help="Limit to one or more future_bill_link_id values")
    parser.add_argument("--disable-ai-judge", action="store_true", help="Skip OpenAI judging and keep deterministic ranking only")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="OpenAI review model name")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT, help="OpenAI request timeout in seconds")
    parser.add_argument("--temperature", type=float, default=DEFAULT_TEMPERATURE, help="OpenAI sampling temperature")
    parser.add_argument("--output", type=Path, default=get_default_output_path(), help="Suggestions JSON output path")
    parser.add_argument("--csv", nargs="?", const="", help="Optional CSV output path. Omit value to derive it from --output")
    parser.add_argument("--dry-run", action="store_true", help="Metadata flag only; this script never mutates the database")
    parser.add_argument("--strict-manual-queue", action="store_true", help="Fail if --input-manual-queue is provided but the file does not exist")
    parser.add_argument("--openai-base-url", default=DEFAULT_OPENAI_BASE_URL, help="Optional OpenAI-compatible base URL override")
    return parser.parse_args()


def normalize_whitespace(text: str | None) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def normalize_title_key(text: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (text or "").lower()).strip()


def tokenize(text: str | None) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-z0-9]+", (text or "").lower())
        if len(token) > 2 and token not in STOPWORDS
    }


def keyword_overlap(left: set[str], right: set[str]) -> float:
    if not left or not right:
        return 0.0
    union = left | right
    if not union:
        return 0.0
    return len(left & right) / len(union)


def title_evidence_is_weak(title: str | None) -> bool:
    normalized = normalize_whitespace(title)
    if not normalized:
        return True
    tokens = re.findall(r"[A-Za-z0-9]+", normalized)
    lower_tokens = [token.lower() for token in tokens]
    informative = [token for token in lower_tokens if token not in STOPWORDS and token not in {"act", "bill", "program"}]
    uppercase_tokens = [token for token in tokens if token.isupper() and len(token) >= 3]
    if len(tokens) <= 3 and len(informative) <= 1:
        return True
    if uppercase_tokens and len(informative) <= 2:
        return True
    return len(informative) <= 2


def contains_any(text: str, phrases: set[str]) -> bool:
    lowered = text.lower()
    return any(phrase in lowered for phrase in phrases)


def detect_issue_domain(target_area: str | None) -> str | None:
    target_tokens = tokenize(target_area)
    for domain, keywords in DOMAIN_KEYWORDS.items():
        if domain in target_tokens or target_tokens & keywords:
            return domain
    return None


def normalized_issue_domain(target_area: str | None, text: str | None) -> str | None:
    target_domain = detect_issue_domain(target_area)
    if target_domain:
        return target_domain

    tokens = tokenize(text)
    best_domain = None
    best_score = 0
    for domain, keywords in DOMAIN_KEYWORDS.items():
        score = len(tokens & keywords)
        if score > best_score:
            best_domain = domain
            best_score = score
    return best_domain


def bill_domain_match(target_area: str | None, candidate_text: str) -> bool:
    domain = detect_issue_domain(target_area)
    if not domain:
        return False
    return bool(tokenize(candidate_text) & DOMAIN_KEYWORDS[domain])


def bill_domain_mismatch(target_area: str | None, candidate_text: str) -> bool:
    domain = detect_issue_domain(target_area)
    if not domain:
        return False
    candidate_tokens = tokenize(candidate_text)
    if candidate_tokens & DOMAIN_KEYWORDS[domain]:
        return False
    return any(candidate_tokens & keywords for name, keywords in DOMAIN_KEYWORDS.items() if name != domain)


def explicit_domain_overlap(target_area: str | None, candidate_text: str) -> bool:
    domain = detect_issue_domain(target_area)
    if not domain:
        return False
    candidate_tokens = tokenize(candidate_text)
    return len(candidate_tokens & DOMAIN_KEYWORDS[domain]) >= 2


def classify_mechanism_families(text: str | None) -> set[str]:
    lowered = normalize_whitespace(text).lower()
    families = set()
    if any(phrase in lowered for phrase in {"down-payment", "mortgage", "homeownership", "appraisal", "housing voucher", "voucher", "rent", "tenant"}):
        families.add("housing_support")
    if any(phrase in lowered for phrase in {"grant", "grants", "endowment", "infrastructure", "institutional", "research funding", "capital improvement"}):
        families.add("institutional_funding")
    if any(phrase in lowered for phrase in {"commission", "study", "task force", "report", "advisory"}):
        families.add("study_commission")
    if any(phrase in lowered for phrase in {"compensation", "direct payment", "direct payments", "reparations", "tax credit", "tax credits", "trust account", "trust accounts"}):
        families.add("direct_compensation")
    if any(phrase in lowered for phrase in {"enforcement", "preclearance", "anti-discrimination", "fair lending", "oversight", "accountability", "review mechanism"}):
        families.add("regulatory_enforcement")
    if any(phrase in lowered for phrase in {"medicaid", "maternal", "hospital", "clinic", "health center", "health centres", "healthcare", "postpartum", "preventive care"}):
        families.add("healthcare_services")
    if any(phrase in lowered for phrase in {"sentencing", "expungement", "sentence review", "reintegration", "reentry"}):
        families.add("justice_relief")
    if any(phrase in lowered for phrase in {"procurement", "contracting", "technical assistance", "business support", "small business"}):
        families.add("procurement_support")
    return families


def severe_domain_mismatch(future_domain: str | None, candidate_domain: str | None, has_explicit_overlap: bool) -> bool:
    if not future_domain or not candidate_domain:
        return False
    if future_domain == candidate_domain:
        return False
    if has_explicit_overlap:
        return False
    blocked_pairs = {
        ("housing", "healthcare"),
        ("healthcare", "housing"),
        ("education", "healthcare"),
        ("healthcare", "education"),
        ("criminal", "education"),
        ("education", "criminal"),
        ("criminal", "housing"),
        ("housing", "criminal"),
    }
    return (future_domain, candidate_domain) in blocked_pairs or future_domain != candidate_domain


def severe_mechanism_mismatch(future_families: set[str], candidate_families: set[str], has_explicit_overlap: bool) -> bool:
    if not future_families or not candidate_families:
        return False
    if future_families & candidate_families:
        return False
    if has_explicit_overlap:
        return False
    return True


def broad_equity_only_overlap(future_tokens: set[str], candidate_tokens: set[str], domain_overlap: bool, mechanism_overlap: bool) -> bool:
    shared = future_tokens & candidate_tokens
    if not shared:
        return False
    if domain_overlap or mechanism_overlap:
        return False
    non_broad = shared - BROAD_EQUITY_HINTS
    return len(non_broad) == 0


def load_json_object(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text())
    if not isinstance(payload, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return payload


def derive_csv_path(csv_arg: str | None, output_path: Path) -> Path | None:
    if csv_arg is None:
        return None
    if csv_arg == "":
        return output_path.with_suffix(".csv")
    return Path(csv_arg).resolve()


def fetch_available_models(openai_base_url: str, timeout_seconds: int) -> list[str]:
    return list_available_models(openai_base_url=openai_base_url or None, timeout_seconds=timeout_seconds)


def looks_like_openai_model(model_name: str) -> bool:
    normalized = (model_name or "").strip().lower()
    return normalized.startswith("gpt-") or normalized.startswith("chatgpt") or normalized.startswith("o")


def resolve_model_name(requested_model: str, available_models: list[str]) -> str:
    if not available_models or looks_like_openai_model(requested_model):
        return requested_model
    lookup = {name.lower(): name for name in available_models}
    if requested_model.lower() in lookup:
        return lookup[requested_model.lower()]
    for candidate in [requested_model, *FALLBACK_MODELS]:
        if candidate.lower() in lookup:
            return lookup[candidate.lower()]
    family = re.match(r"[a-z]+", requested_model.lower())
    family_name = family.group(0) if family else requested_model.split(":", 1)[0].lower()
    for name in available_models:
        match = re.match(r"[a-z]+", name.lower())
        if match and match.group(0) == family_name:
            return name
    raise ValueError(f"Requested model {requested_model} was not found. Available models: {', '.join(available_models)}")


def call_openai(prompt: str, model: str, openai_base_url: str, timeout_seconds: int, temperature: float) -> dict[str, Any]:
    body = generate_text(
        prompt,
        model=model,
        openai_base_url=openai_base_url or None,
        timeout_seconds=timeout_seconds,
        temperature=temperature,
        response_format="json",
    )
    start = body.find("{")
    end = body.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("OpenAI candidate response did not contain a JSON object")
    parsed = json.loads(body[start : end + 1])
    if not isinstance(parsed, dict):
        raise ValueError("OpenAI candidate response must be a JSON object")
    return parsed


def current_link_context(cursor, future_bill_link_id: int) -> tuple[int | None, int | None]:
    cursor.execute(
        """
        SELECT future_bill_id, tracked_bill_id
        FROM future_bill_links
        WHERE id = %s
        LIMIT 1
        """,
        (future_bill_link_id,),
    )
    row = cursor.fetchone()
    if row:
        return int(row["future_bill_id"]), int(row["tracked_bill_id"])

    if action_table_exists(cursor):
        cursor.execute(
            """
            SELECT prior_future_bill_id, prior_tracked_bill_id
            FROM future_bill_link_review_actions
            WHERE future_bill_link_id = %s
            ORDER BY id DESC
            LIMIT 1
            """,
            (future_bill_link_id,),
        )
        archived = cursor.fetchone()
        if archived:
            return int(archived["prior_future_bill_id"]), int(archived["prior_tracked_bill_id"])
    return None, None


def action_table_exists(cursor) -> bool:
    cursor.execute("SHOW TABLES LIKE 'future_bill_link_review_actions'")
    return cursor.fetchone() is not None


def fetch_future_bill(cursor, future_bill_id: int) -> dict[str, Any] | None:
    cursor.execute(
        """
        SELECT id, title, target_area, problem_statement, proposed_solution, priority_level, status
        FROM future_bills
        WHERE id = %s
        LIMIT 1
        """,
        (future_bill_id,),
    )
    return cursor.fetchone()


def fetch_tracked_bill(cursor, tracked_bill_id: int) -> dict[str, Any] | None:
    cursor.execute(
        """
        SELECT
          id,
          bill_number,
          title,
          official_summary,
          bill_status,
          latest_action_date,
          source_system,
          jurisdiction,
          chamber,
          session_label,
          sponsor_name,
          sponsor_party,
          active,
          match_confidence
        FROM tracked_bills
        WHERE id = %s
        LIMIT 1
        """,
        (tracked_bill_id,),
    )
    return cursor.fetchone()


def fetch_linked_tracked_bill_ids(cursor, future_bill_id: int) -> set[int]:
    cursor.execute(
        """
        SELECT tracked_bill_id
        FROM future_bill_links
        WHERE future_bill_id = %s
        """,
        (future_bill_id,),
    )
    return {int(row["tracked_bill_id"]) for row in cursor.fetchall()}


def fetch_candidate_bills(cursor) -> list[dict[str, Any]]:
    cursor.execute(
        """
        SELECT
          id,
          bill_number,
          title,
          official_summary,
          bill_status,
          latest_action_date,
          source_system,
          jurisdiction,
          chamber,
          session_label,
          sponsor_name,
          sponsor_party,
          active,
          match_confidence
        FROM tracked_bills
        WHERE active = 1
        ORDER BY latest_action_date DESC, id ASC
        """
    )
    return cursor.fetchall()


def build_targets(
    review_payload: dict[str, Any] | None,
    manual_queue_payload: dict[str, Any] | None,
    only_future_bill_ids: list[int] | None,
    only_link_ids: list[int] | None,
    max_items: int | None,
    cursor,
) -> list[TargetContext]:
    targets: dict[str, TargetContext] = {}
    only_future_set = set(only_future_bill_ids or [])
    only_link_set = set(only_link_ids or [])

    for item in review_payload.get("items") or [] if review_payload else []:
        link_id = item.get("future_bill_link_id")
        future_bill_id = item.get("future_bill_id")
        current_tracked_bill_id = item.get("current_tracked_bill_id")
        if future_bill_id is None or current_tracked_bill_id is None:
            if link_id is not None:
                resolved_future_bill_id, resolved_tracked_bill_id = current_link_context(cursor, int(link_id))
                future_bill_id = future_bill_id or resolved_future_bill_id
                current_tracked_bill_id = current_tracked_bill_id or resolved_tracked_bill_id

        if future_bill_id is None:
            continue
        if only_future_set and int(future_bill_id) not in only_future_set:
            continue
        if only_link_set and link_id is not None and int(link_id) not in only_link_set:
            continue

        should_include = (
            item.get("final_decision") in {"remove_link", "review_manually"}
            or item.get("match_label") in {"bad_match", "weak_match"}
        )
        if not should_include:
            continue

        key = f"link:{link_id}" if link_id is not None else f"future:{future_bill_id}:tracked:{current_tracked_bill_id}"
        targets[key] = TargetContext(
            future_bill_id=int(future_bill_id),
            future_bill_link_id=int(link_id) if link_id is not None else None,
            current_tracked_bill_id=int(current_tracked_bill_id) if current_tracked_bill_id is not None else None,
            current_ai_decision=item.get("final_decision"),
            current_match_label=item.get("match_label"),
            current_tracked_bill_title=item.get("current_tracked_bill_title") or item.get("tracked_bill_title"),
            review_item=item,
        )

    for item in manual_queue_payload.get("items") or [] if manual_queue_payload else []:
        link_id = item.get("future_bill_link_id")
        if link_id is None:
            continue
        if only_link_set and int(link_id) not in only_link_set:
            continue
        future_bill_id, tracked_bill_id = current_link_context(cursor, int(link_id))
        if future_bill_id is None:
            continue
        if only_future_set and int(future_bill_id) not in only_future_set:
            continue

        key = f"link:{link_id}"
        if key in targets:
            targets[key].manual_queue_item = item
            continue
        targets[key] = TargetContext(
            future_bill_id=int(future_bill_id),
            future_bill_link_id=int(link_id),
            current_tracked_bill_id=int(tracked_bill_id) if tracked_bill_id is not None else None,
            current_ai_decision=item.get("final_decision"),
            current_match_label=item.get("match_label"),
            current_tracked_bill_title=item.get("tracked_bill_title"),
            manual_queue_item=item,
        )

    ordered = sorted(
        targets.values(),
        key=lambda target: (
            target.current_ai_decision != "remove_link",
            target.current_match_label != "bad_match",
            target.future_bill_id,
            target.future_bill_link_id or 0,
        ),
    )
    if max_items is not None:
        ordered = ordered[:max_items]
    return ordered


def text_block(*parts: str | None) -> str:
    return normalize_whitespace(" ".join(part or "" for part in parts))


def detect_population_tokens(future_bill: dict[str, Any]) -> set[str]:
    tokens = tokenize(
        text_block(
            future_bill.get("title"),
            future_bill.get("problem_statement"),
            future_bill.get("proposed_solution"),
        )
    )
    candidates = {
        "black",
        "african",
        "americans",
        "women",
        "maternal",
        "students",
        "hbcu",
        "hbcus",
        "entrepreneurs",
        "businesses",
        "children",
        "households",
        "communities",
        "voters",
        "individuals",
    }
    return tokens & candidates


def detect_mechanism_categories(text: str) -> set[str]:
    lowered = text.lower()
    categories = set()
    for category, hints in MECHANISM_HINTS.items():
        if any(hint in lowered for hint in hints):
            categories.add(category)
    return categories


def clamp_score(value: int) -> int:
    return max(0, min(3, int(value)))


def is_education_institutional_support_concept(future_bill: dict[str, Any]) -> bool:
    future_text = text_block(
        future_bill.get("title"),
        future_bill.get("problem_statement"),
        future_bill.get("proposed_solution"),
        future_bill.get("target_area"),
    ).lower()
    if normalized_issue_domain(future_bill.get("target_area"), future_text) != "education":
        return False
    education_terms = {
        "hbcu",
        "hbcus",
        "minority-serving institution",
        "minority-serving institutions",
        "title iii",
        "title v",
        "higher education",
        "college",
        "university",
        "endowment",
        "capital",
        "infrastructure",
        "research",
        "institutional",
    }
    funding_terms = {
        "grant",
        "grants",
        "funding",
        "endowment",
        "capital improvement",
        "infrastructure",
        "institutional support",
        "research funding",
        "matching",
    }
    return any(term in future_text for term in education_terms) and any(term in future_text for term in funding_terms)


def candidate_has_education_institutional_support(candidate_text: str) -> bool:
    lowered = candidate_text.lower()
    has_core_institution_signal = any(term in lowered for term in EDUCATION_INSTITUTION_CORE_HINTS)
    has_support_signal = any(term in lowered for term in EDUCATION_INSTITUTION_SUPPORT_HINTS)
    if not (has_core_institution_signal and has_support_signal):
        return False
    if candidate_is_business_development_focused(candidate_text) and not has_core_institution_signal:
        return False
    return True


def candidate_is_business_development_focused(candidate_text: str) -> bool:
    lowered = candidate_text.lower()
    return any(term in lowered for term in BUSINESS_DEVELOPMENT_HINTS)


def score_candidate(future_bill: dict[str, Any], candidate: dict[str, Any]) -> dict[str, Any]:
    candidate_text = text_block(candidate.get("title"), candidate.get("official_summary"))
    future_problem_tokens = tokenize(text_block(future_bill.get("title"), future_bill.get("problem_statement"), future_bill.get("target_area")))
    future_solution_tokens = tokenize(future_bill.get("proposed_solution"))
    future_population_tokens = detect_population_tokens(future_bill)
    candidate_tokens = tokenize(candidate_text)
    problem_overlap = keyword_overlap(future_problem_tokens, candidate_tokens)
    solution_overlap = keyword_overlap(future_solution_tokens, candidate_tokens)
    population_overlap = keyword_overlap(future_population_tokens, candidate_tokens) if future_population_tokens else 0.0
    domain_match = bill_domain_match(future_bill.get("target_area"), candidate_text)
    domain_mismatch = bill_domain_mismatch(future_bill.get("target_area"), candidate_text)
    summary_present = bool(normalize_whitespace(candidate.get("official_summary")))
    weak_title = title_evidence_is_weak(candidate.get("title"))
    direct_benefit_expected = contains_any(text_block(future_bill.get("proposed_solution")), DIRECT_BENEFIT_HINTS)
    candidate_is_study = contains_any(candidate_text, STUDY_BILL_HINTS)
    future_mechanisms = detect_mechanism_categories(text_block(future_bill.get("proposed_solution"), future_bill.get("problem_statement")))
    candidate_mechanisms = detect_mechanism_categories(candidate_text)
    future_mechanism_families = classify_mechanism_families(text_block(future_bill.get("proposed_solution"), future_bill.get("problem_statement")))
    candidate_mechanism_families = classify_mechanism_families(candidate_text)
    future_domain = normalized_issue_domain(future_bill.get("target_area"), text_block(future_bill.get("problem_statement"), future_bill.get("proposed_solution")))
    candidate_domain = normalized_issue_domain(None, candidate_text)
    has_explicit_overlap = explicit_domain_overlap(future_bill.get("target_area"), candidate_text)
    severe_domain_block = severe_domain_mismatch(future_domain, candidate_domain, has_explicit_overlap)
    severe_mechanism_block = severe_mechanism_mismatch(
        future_mechanism_families,
        candidate_mechanism_families,
        has_explicit_overlap,
    )
    exact_title_overlap = normalize_title_key(future_bill.get("title")) in normalize_title_key(candidate.get("title"))
    broad_equity_only = broad_equity_only_overlap(
        future_problem_tokens | future_solution_tokens,
        candidate_tokens,
        domain_match or has_explicit_overlap,
        bool(future_mechanism_families & candidate_mechanism_families),
    )
    education_support_concept = is_education_institutional_support_concept(future_bill)
    candidate_supports_education_institutions = candidate_has_education_institutional_support(candidate_text)
    candidate_business_focused = candidate_is_business_development_focused(candidate_text)
    general_funding_support = contains_any(
        candidate_text,
        {
            "funding",
            "grant",
            "grants",
            "institutional support",
            "institutional funding",
            "capital",
            "infrastructure",
            "research support",
            "research funding",
            "appropriation",
            "appropriations",
        },
    )
    identifiable_mechanism_present = bool(candidate_mechanisms or candidate_mechanism_families or general_funding_support)
    mechanism_inferred = identifiable_mechanism_present or candidate_is_study
    strict_direct_benefit_hints = {
        "grant",
        "grants",
        "payment",
        "payments",
        "direct payment",
        "direct payments",
        "down-payment assistance",
        "assistance",
        "voucher",
        "vouchers",
        "subsidy",
        "subsidies",
        "loan",
        "loans",
        "scholarship",
        "scholarships",
        "endowment",
    }
    missing_direct_benefit_component = (
        direct_benefit_expected
        and not contains_any(candidate_text, strict_direct_benefit_hints)
        and "direct_compensation" not in candidate_mechanism_families
    )

    problem_alignment = 0
    if problem_overlap >= 0.25 or exact_title_overlap:
        problem_alignment = 3
    elif problem_overlap >= 0.12 or domain_match:
        problem_alignment = 2
    elif problem_overlap > 0.0:
        problem_alignment = 1

    solution_alignment = 0
    if solution_overlap >= 0.22 and not (direct_benefit_expected and candidate_is_study):
        solution_alignment = 3
    elif solution_overlap >= 0.1:
        solution_alignment = 2
    elif solution_overlap > 0.0 or (direct_benefit_expected and candidate_is_study):
        solution_alignment = 1
    elif general_funding_support and (domain_match or has_explicit_overlap) and not severe_domain_block:
        solution_alignment = 1

    population_alignment = 0
    if future_population_tokens:
        if population_overlap >= 0.4:
            population_alignment = 3
        elif population_overlap >= 0.18:
            population_alignment = 2
        elif population_overlap > 0.0 or any(token in candidate_tokens for token in future_population_tokens):
            population_alignment = 1
    elif domain_match:
        population_alignment = 1

    mechanism_specificity = 0
    shared_mechanisms = future_mechanisms & candidate_mechanisms
    if shared_mechanisms:
        if len(shared_mechanisms) >= 2 or (direct_benefit_expected and "direct_benefit" in shared_mechanisms):
            mechanism_specificity = 3
        else:
            mechanism_specificity = 2
    elif identifiable_mechanism_present or future_mechanisms or candidate_is_study:
        mechanism_specificity = 1

    evidence_strength = 0
    if summary_present and (problem_overlap > 0.0 or solution_overlap > 0.0 or domain_match):
        evidence_strength = 2
    if summary_present and (problem_overlap >= 0.18 or solution_overlap >= 0.18 or exact_title_overlap):
        evidence_strength = 3
    elif not summary_present and not weak_title and (problem_overlap > 0.0 or solution_overlap > 0.0):
        evidence_strength = 1
    elif weak_title and not summary_present:
        evidence_strength = 0
    else:
        evidence_strength = max(evidence_strength, 1 if summary_present else 0)
    if (
        not summary_present
        and evidence_strength == 0
        and (domain_match or has_explicit_overlap)
        and (identifiable_mechanism_present or solution_alignment >= 1)
    ):
        evidence_strength = 1

    education_partial_credit = False
    if (
        education_support_concept
        and candidate_supports_education_institutions
        and future_domain == "education"
        and candidate_domain in {None, "education"}
        and not severe_domain_block
        and not severe_mechanism_block
        and not broad_equity_only
        and not (candidate_business_focused and not candidate_supports_education_institutions)
        and (summary_present or not weak_title)
    ):
        if "institutional_funding" in candidate_mechanism_families or "institutional_funding" in future_mechanism_families:
            if solution_alignment == 0:
                solution_alignment = 1
                education_partial_credit = True
            elif solution_alignment == 1:
                solution_alignment = 2
                education_partial_credit = True
            if mechanism_specificity == 0:
                mechanism_specificity = 1
                education_partial_credit = True
            elif mechanism_specificity == 1:
                mechanism_specificity = 2
                education_partial_credit = True
        if summary_present and evidence_strength == 0:
            evidence_strength = 1

    penalties: list[str] = []

    # Preprocessing stage: promote inferred mechanisms before scores are frozen.
    mechanism_upgraded = False
    if mechanism_inferred and mechanism_specificity == 0 and not severe_domain_block and not severe_mechanism_block:
        mechanism_specificity = 1
        mechanism_upgraded = True

    if domain_mismatch:
        problem_alignment = min(problem_alignment, 1)
        solution_alignment = min(solution_alignment, 1)
        mechanism_specificity = min(mechanism_specificity, 1)
        penalties.append("Issue domain appears different from the future bill target area.")

    if severe_domain_block:
        problem_alignment = min(problem_alignment, 1)
        solution_alignment = min(solution_alignment, 0)
        mechanism_specificity = min(mechanism_specificity, 0)
        evidence_strength = min(evidence_strength, 1)
        penalties.append("Cross-domain mismatch blocks Partial and Direct suggestions without unusually strong explicit overlap.")

    if direct_benefit_expected and candidate_is_study:
        solution_alignment = min(solution_alignment, 1)
        mechanism_specificity = min(mechanism_specificity, 1)
        penalties.append("Candidate reads like a study or commission rather than a direct-benefit mechanism.")

    if missing_direct_benefit_component:
        penalties.append("Candidate appears to cover only part of the future bill's mechanism and does not include the direct-benefit component.")

    if severe_mechanism_block:
        solution_alignment = min(solution_alignment, 1)
        mechanism_specificity = min(mechanism_specificity, 0)
        evidence_strength = min(evidence_strength, 1)
        penalties.append("Mechanism-family mismatch blocks Partial and Direct suggestions unless there is unusually strong secondary evidence.")

    if weak_title and not summary_present:
        evidence_strength = min(evidence_strength, 1)
        problem_alignment = min(problem_alignment, 1)
        penalties.append("Candidate title is weak and there is no official summary.")

    if problem_overlap == 0.0 and solution_overlap == 0.0 and domain_mismatch:
        evidence_strength = 0
        penalties.append("Zero overlap plus domain mismatch.")

    if broad_equity_only:
        population_alignment = min(population_alignment, 1)
        problem_alignment = min(problem_alignment, 1)
        solution_alignment = min(solution_alignment, 0)
        evidence_strength = min(evidence_strength, 1)
        penalties.append("Broad equity framing is present without real policy-domain or mechanism overlap.")

    if candidate_business_focused and not candidate_supports_education_institutions:
        penalties.append("Candidate focuses on business development or minority enterprise support rather than higher-education institutional funding.")

    if education_support_concept and not candidate_supports_education_institutions:
        penalties.append("Education partial override not applied because the candidate does not clearly support HBCUs, MSIs, or higher-ed institutions.")

    scores = {
        "problem_alignment": clamp_score(problem_alignment),
        "solution_alignment": clamp_score(solution_alignment),
        "population_alignment": clamp_score(population_alignment),
        "mechanism_specificity": clamp_score(mechanism_specificity),
        "evidence_strength": clamp_score(evidence_strength),
    }

    total_score = sum(scores.values())
    weighted_score = (
        scores["solution_alignment"] * 3.0
        + scores["problem_alignment"] * 2.5
        + scores["mechanism_specificity"] * 2.0
        + scores["population_alignment"] * 1.5
        + scores["evidence_strength"] * 1.25
    )

    relationship_fit = "none"
    partial_reason = None
    education_partial_override = False
    fallback_partial_used = False
    classification_stage = "none"

    if (
        scores["problem_alignment"] >= 1
        and scores["population_alignment"] >= 2
        and not severe_domain_block
        and not severe_mechanism_block
        and not broad_equity_only
    ):
        relationship_fit = "partial"
        fallback_partial_used = True
        partial_reason = "problem + population strong (solution weak)"
        classification_stage = "fallback"
    elif (
        scores["solution_alignment"] >= 2
        and scores["problem_alignment"] >= 2
        and scores["mechanism_specificity"] >= 2
        and scores["evidence_strength"] >= 2
        and total_score >= 11
        and not (direct_benefit_expected and candidate_is_study)
        and not missing_direct_benefit_component
        and not (weak_title and not summary_present)
        and not domain_mismatch
        and not severe_domain_block
        and not severe_mechanism_block
        and not broad_equity_only
    ):
        relationship_fit = "direct"
        classification_stage = "direct"
    elif (
        scores["problem_alignment"] >= 1
        and scores["solution_alignment"] >= 1
        and (scores["mechanism_specificity"] >= 1 or scores["evidence_strength"] >= 1)
        and not severe_domain_block
        and not severe_mechanism_block
        and not broad_equity_only
    ):
        relationship_fit = "partial"
        classification_stage = "standard"
        weak_dimensions = []
        if scores["mechanism_specificity"] < 1:
            weak_dimensions.append("mechanism weak")
        if scores["population_alignment"] < 1:
            weak_dimensions.append("population weak")
        if scores["evidence_strength"] < 1:
            weak_dimensions.append("evidence weak")
        trigger_dimensions = []
        if scores["mechanism_specificity"] >= 1:
            trigger_dimensions.append("mechanism support")
        if scores["population_alignment"] >= 1:
            trigger_dimensions.append("population support")
        if scores["evidence_strength"] >= 1:
            trigger_dimensions.append("evidence support")
        partial_reason = "core alignment + " + ", ".join(trigger_dimensions[:2] or ["supportive signals"])
        if weak_dimensions:
            partial_reason += " (" + ", ".join(weak_dimensions[:2]) + ")"
    elif (
        education_support_concept
        and candidate_supports_education_institutions
        and scores["problem_alignment"] >= 1
        and scores["solution_alignment"] >= 1
        and scores["population_alignment"] >= 1
        and scores["mechanism_specificity"] >= 1
        and scores["evidence_strength"] >= 1
        and not severe_domain_block
        and not severe_mechanism_block
        and not broad_equity_only
        and not candidate_business_focused
    ):
        relationship_fit = "partial"
        education_partial_override = True
        partial_reason = "education institutional-support override"
        classification_stage = "education_override"

    why_this_candidate = []
    if scores["solution_alignment"] >= 2:
        why_this_candidate.append("Meaningfully advances the future bill's proposed solution.")
    if scores["problem_alignment"] >= 2:
        why_this_candidate.append("Addresses the same core problem area.")
    if scores["population_alignment"] >= 2:
        why_this_candidate.append("Targets a similar beneficiary population.")
    if scores["mechanism_specificity"] >= 2:
        why_this_candidate.append("Uses a similar policy mechanism.")
    if scores["evidence_strength"] >= 2:
        why_this_candidate.append("Has enough textual evidence to support the match.")
    if education_partial_credit:
        why_this_candidate.append(
            "Candidate supports HBCUs or higher-ed institutions through grant or institutional-funding mechanisms."
        )
    if education_partial_override:
        why_this_candidate.append(
            "Candidate provides institutional funding support for HBCUs or higher-ed institutions, which partially aligns with the future bill's capital or research equity goals."
        )
    if not why_this_candidate:
        why_this_candidate.append("Only weak policy-alignment signals are present.")

    why_not_direct = []
    if relationship_fit != "direct":
        if scores["solution_alignment"] < 2:
            why_not_direct.append("Solution alignment is not strong enough for Direct.")
        if scores["mechanism_specificity"] < 2:
            why_not_direct.append("Mechanism specificity is too weak for Direct.")
        if scores["evidence_strength"] < 2:
            why_not_direct.append("Evidence is too thin for a confident Direct recommendation.")
        if education_partial_credit:
            why_not_direct.append(
                "Candidate is a plausible partial institutional-support anchor, but it does not clearly provide the full capital, endowment, infrastructure, or research mechanism."
            )
        if education_partial_override:
            why_not_direct.append(
                "Candidate provides institutional funding support for HBCUs or higher-ed institutions, which partially aligns with the future bill's capital or research equity goals, but does not fully implement the same mechanism."
            )
        why_not_direct.extend(penalties)

    return {
        **scores,
        "candidate_total_score": total_score,
        "candidate_weighted_score": round(weighted_score, 3),
        "candidate_relationship_fit": relationship_fit,
        "partial_reason": partial_reason,
        "mechanism_inferred": mechanism_inferred,
        "reuse_penalty_applied": False,
        "fallback_partial_used": fallback_partial_used,
        "mechanism_upgraded": mechanism_upgraded,
        "classification_stage": classification_stage,
        "domain_mismatch": domain_mismatch,
        "future_domain": future_domain,
        "candidate_domain": candidate_domain,
        "future_mechanism_families": sorted(future_mechanism_families),
        "candidate_mechanism_families": sorted(candidate_mechanism_families),
        "severe_domain_block": severe_domain_block,
        "severe_mechanism_block": severe_mechanism_block,
        "broad_equity_only": broad_equity_only,
        "weak_title_evidence": weak_title,
        "summary_present": summary_present,
        "direct_benefit_expected": direct_benefit_expected,
        "candidate_is_study": candidate_is_study,
        "problem_overlap": round(problem_overlap, 3),
        "solution_overlap": round(solution_overlap, 3),
        "population_overlap": round(population_overlap, 3),
        "education_support_concept": education_support_concept,
        "candidate_supports_education_institutions": candidate_supports_education_institutions,
        "candidate_business_focused": candidate_business_focused,
        "education_partial_credit": education_partial_credit,
        "education_partial_override": education_partial_override,
        "why_this_candidate": why_this_candidate,
        "why_not_direct": why_not_direct,
    }


def rank_candidates(
    future_bill: dict[str, Any],
    candidates: list[dict[str, Any]],
    current_tracked_bill_id: int | None,
    existing_linked_ids: set[int],
    candidate_usage_count: dict[int, int],
) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    current_candidate = None
    alternates = []
    for candidate in candidates:
        if int(candidate["id"]) in existing_linked_ids and int(candidate["id"]) != (current_tracked_bill_id or -1):
            continue

        scored = {
            **candidate,
            **score_candidate(future_bill, candidate),
        }

        if scored.get("mechanism_inferred") is True and scored.get("mechanism_specificity", 0) == 0:
            scored["mechanism_specificity"] = 1
            scored["mechanism_upgraded"] = True
            scored["candidate_total_score"] = (
                scored.get("problem_alignment", 0)
                + scored.get("solution_alignment", 0)
                + scored.get("population_alignment", 0)
                + scored.get("mechanism_specificity", 0)
                + scored.get("evidence_strength", 0)
            )
            scored["candidate_weighted_score"] = round(
                scored.get("solution_alignment", 0) * 3.0
                + scored.get("problem_alignment", 0) * 2.5
                + scored.get("mechanism_specificity", 0) * 2.0
                + scored.get("population_alignment", 0) * 1.5
                + scored.get("evidence_strength", 0) * 1.25,
                3,
            )

        if (
            scored.get("problem_alignment", 0) >= 1
            and scored.get("population_alignment", 0) >= 2
        ):
            scored["candidate_relationship_fit"] = "partial"
            scored["fallback_partial_used"] = True
            scored["classification_stage"] = "fallback"
            scored["partial_reason"] = "problem + population strong (solution weak)"
            if current_tracked_bill_id is not None and int(candidate["id"]) == int(current_tracked_bill_id):
                current_candidate = scored
            else:
                alternates.append(scored)
            continue

        if (
            scored.get("problem_alignment", 0) >= 1
            and scored.get("solution_alignment", 0) >= 1
            and scored.get("mechanism_specificity", 0) >= 1
        ):
            scored["candidate_relationship_fit"] = "partial"
            scored["classification_stage"] = "secondary_partial"
            scored["partial_reason"] = "balanced alignment across problem + solution + mechanism"
            if current_tracked_bill_id is not None and int(candidate["id"]) == int(current_tracked_bill_id):
                current_candidate = scored
            else:
                alternates.append(scored)
            continue

        if (
            scored.get("problem_alignment", 0) >= 1
            and scored.get("solution_alignment", 0) >= 1
        ):
            scored["candidate_relationship_fit"] = "partial"
            scored["classification_stage"] = "weak_partial"
            scored["partial_reason"] = "problem + solution alignment (mechanism weaker)"
            if current_tracked_bill_id is not None and int(candidate["id"]) == int(current_tracked_bill_id):
                current_candidate = scored
            else:
                alternates.append(scored)
            continue

        if (
            candidate_usage_count.get(int(candidate["id"]), 0) >= 2
            and scored["candidate_relationship_fit"] == "partial"
            and scored["population_alignment"] == 0
        ):
            scored["candidate_weighted_score"] = round(scored["candidate_weighted_score"] - 3.0, 3)
            scored["candidate_total_score"] = max(0, scored["candidate_total_score"] - 1)
            scored["reuse_penalty_applied"] = True
            if scored.get("partial_reason"):
                scored["partial_reason"] = f"{scored['partial_reason']} + reuse penalty"
        if current_tracked_bill_id is not None and int(candidate["id"]) == int(current_tracked_bill_id):
            current_candidate = scored
        else:
            alternates.append(scored)

    alternates.sort(
        key=lambda row: (
            row["candidate_relationship_fit"] != "direct",
            row["candidate_relationship_fit"] != "partial",
            -row["candidate_weighted_score"],
            -row["candidate_total_score"],
            row["id"],
        )
    )
    return current_candidate, alternates


def build_candidate_prompt(future_bill: dict[str, Any], current_candidate: dict[str, Any] | None, candidate: dict[str, Any]) -> str:
    payload = {
        "future_bill": {
            "id": future_bill["id"],
            "title": future_bill.get("title"),
            "target_area": future_bill.get("target_area"),
            "problem_statement": future_bill.get("problem_statement"),
            "proposed_solution": future_bill.get("proposed_solution"),
        },
        "current_link_candidate": {
            "tracked_bill_id": current_candidate.get("id") if current_candidate else None,
            "bill_number": current_candidate.get("bill_number") if current_candidate else None,
            "title": current_candidate.get("title") if current_candidate else None,
            "official_summary": current_candidate.get("official_summary") if current_candidate else None,
            "relationship_fit": current_candidate.get("candidate_relationship_fit") if current_candidate else None,
            "total_score": current_candidate.get("candidate_total_score") if current_candidate else None,
        },
        "candidate": {
            "tracked_bill_id": candidate["id"],
            "bill_number": candidate.get("bill_number"),
            "title": candidate.get("title"),
            "official_summary": candidate.get("official_summary"),
            "local_scores": {
                "problem_alignment": candidate["problem_alignment"],
                "solution_alignment": candidate["solution_alignment"],
                "population_alignment": candidate["population_alignment"],
                "mechanism_specificity": candidate["mechanism_specificity"],
                "evidence_strength": candidate["evidence_strength"],
                "relationship_fit": candidate["candidate_relationship_fit"],
                "total_score": candidate["candidate_total_score"],
            },
        },
    }
    schema = {
        "decision": "no_match | partial_match | strong_direct_candidate",
        "better_than_current": True,
        "suitable_as_partial": True,
        "suitable_as_direct": False,
        "reasoning_short": "short explanation",
    }
    return (
        "You are judging whether a tracked bill should be suggested as a recovery candidate for a future bill concept.\n"
        "Same topic is not enough. Same category is not enough. Direct replacement requires strong solution-level and mechanism-level alignment.\n"
        "Return strict JSON only.\n\n"
        f"Input:\n{json.dumps(payload, indent=2, ensure_ascii=True)}\n\n"
        "Classify the candidate as one of:\n"
        "- no_match\n"
        "- partial_match\n"
        "- strong_direct_candidate\n"
        "Then answer whether it is better than the rejected current link, whether it is suitable as Partial, and whether it is strong enough for Direct.\n"
        "Keep reasoning_short brief.\n"
        f"JSON schema:\n{json.dumps(schema, indent=2, ensure_ascii=True)}"
    )


def normalize_llm_decision(value: Any) -> str:
    decision = str(value or "").strip().lower()
    if decision in {"no_match", "partial_match", "strong_direct_candidate"}:
        return decision
    return "no_match"


def judge_candidates_with_openai(
    candidates: list[dict[str, Any]],
    future_bill: dict[str, Any],
    current_candidate: dict[str, Any] | None,
    model: str,
    openai_base_url: str,
    timeout_seconds: int,
    temperature: float,
) -> list[dict[str, Any]]:
    judged = []
    for candidate in candidates:
        prompt = build_candidate_prompt(future_bill, current_candidate, candidate)
        llm_decision = None
        llm_reasoning = None
        try:
            payload = call_openai(prompt, model, openai_base_url, timeout_seconds, temperature)
            llm_decision = normalize_llm_decision(payload.get("decision"))
            llm_reasoning = normalize_whitespace(payload.get("reasoning_short"))[:400]
            better_than_current = bool(payload.get("better_than_current"))
            suitable_as_partial = bool(payload.get("suitable_as_partial"))
            suitable_as_direct = bool(payload.get("suitable_as_direct"))
        except Exception as error:
            llm_decision = "no_match"
            llm_reasoning = f"OpenAI candidate judge failed: {error}"
            better_than_current = False
            suitable_as_partial = False
            suitable_as_direct = False

        updated = dict(candidate)
        updated["llm_candidate_decision"] = llm_decision
        updated["llm_reasoning_short"] = llm_reasoning

        if llm_decision == "no_match" and not updated.get("education_partial_override"):
            updated["candidate_relationship_fit"] = "none"
        elif llm_decision == "partial_match" and updated["candidate_relationship_fit"] == "direct":
            updated["candidate_relationship_fit"] = "partial"
        elif llm_decision == "strong_direct_candidate" and updated["candidate_relationship_fit"] != "none":
            updated["candidate_relationship_fit"] = "direct"

        if (
            updated.get("severe_domain_block")
            or updated.get("severe_mechanism_block")
            or updated.get("broad_equity_only")
            or updated.get("evidence_strength", 0) < 1
        ):
            updated["candidate_relationship_fit"] = "none"
            if llm_decision == "partial_match":
                updated["llm_candidate_decision"] = "no_match"
            updated["llm_reasoning_short"] = normalize_whitespace(
                f"{updated['llm_reasoning_short']} Local guardrails rejected this candidate because it is cross-domain, mechanism-mismatched, weakly evidenced, or only broadly thematic."
            )[:400]

        if not suitable_as_direct and updated["candidate_relationship_fit"] == "direct":
            updated["candidate_relationship_fit"] = "partial" if suitable_as_partial else "none"
        if not better_than_current and updated["candidate_relationship_fit"] == "direct":
            updated["candidate_relationship_fit"] = "partial"
        if (
            updated.get("education_partial_override")
            and updated["candidate_relationship_fit"] == "none"
            and not updated.get("severe_domain_block")
            and not updated.get("severe_mechanism_block")
            and not updated.get("broad_equity_only")
            and updated.get("problem_alignment", 0) >= 1
            and updated.get("solution_alignment", 0) >= 1
            and updated.get("mechanism_specificity", 0) >= 1
            and updated.get("evidence_strength", 0) >= 1
        ):
            updated["candidate_relationship_fit"] = "partial"
            updated["llm_reasoning_short"] = normalize_whitespace(
                f"{updated['llm_reasoning_short']} Local education override preserved Partial because the candidate provides HBCU or institutional-support funding without clearing the Direct threshold."
            )[:400]

        judged.append(updated)
    return judged


def recommendation_for_partial(current_candidate: dict[str, Any] | None, current_ai_decision: str | None) -> tuple[str, str, str, str]:
    if not current_candidate:
        return "None", "manual_review_only", "Current tracked bill could not be resolved from the database.", "No current tracked bill context was available."

    if current_candidate["candidate_relationship_fit"] == "partial":
        return (
            "Partial",
            "convert_current_to_partial",
            "Current tracked bill still addresses a meaningful portion of the future bill, but not enough for Direct.",
            "Local ranking found partial-level alignment but not enough solution/mechanism strength for Direct.",
        )

    if current_ai_decision == "remove_link":
        return (
            "None",
            "manual_review_only",
            "Current tracked bill should stay removed unless a reviewer sees context the ranking missed.",
            "The current bill did not clear the local threshold for Partial.",
        )

    return (
        "None",
        "retain_for_now",
        "Current tracked bill does not justify a confident partial conversion recommendation.",
        "No strong partial-conversion case emerged from the local scoring.",
    )


def recommendation_for_alternate(candidate: dict[str, Any] | None, current_candidate: dict[str, Any] | None) -> tuple[str, str, str, str]:
    if not candidate:
        return "None", "no_good_candidate_found", "No alternate tracked bill cleared the conservative ranking threshold.", "No candidate beat the current/rejected bill on the local rubric."

    better_than_current = True
    if current_candidate:
        better_than_current = (
            candidate["solution_alignment"] > current_candidate["solution_alignment"]
            or candidate["mechanism_specificity"] > current_candidate["mechanism_specificity"]
            or candidate["evidence_strength"] > current_candidate["evidence_strength"]
            or candidate["candidate_total_score"] > current_candidate["candidate_total_score"] + 1
        )

    if candidate["candidate_relationship_fit"] == "direct" and better_than_current:
        return (
            "Direct",
            "replace_with_better_direct_candidate",
            "Candidate appears materially stronger than the rejected link on solution, mechanism, and evidence.",
            "No strong direct blocker remained after local guardrails.",
        )

    if candidate["candidate_relationship_fit"] == "partial":
        return (
            "Partial",
            "create_new_partial_candidate",
            "Candidate looks useful as a partial policy anchor, but not strong enough for Direct.",
            "Solution, mechanism, or evidence remains below the Direct threshold.",
        )

    return "None", "no_good_candidate_found", "No alternate candidate cleared a conservative suggestion threshold.", "Top-ranked alternate was blocked by cross-domain mismatch, mechanism-family mismatch, broad equity-only overlap, or weak evidence."


def suggestion_row(
    future_bill: dict[str, Any],
    target: TargetContext,
    suggestion_type: str,
    suggested_link_type: str,
    recommended_next_step: str,
    candidate: dict[str, Any] | None,
    why_this_candidate: str,
    why_not_direct: str,
) -> dict[str, Any]:
    return {
        "future_bill_id": future_bill["id"],
        "future_bill_title": future_bill.get("title"),
        "current_future_bill_link_id": target.future_bill_link_id,
        "current_tracked_bill_id": target.current_tracked_bill_id,
        "current_tracked_bill_title": target.current_tracked_bill_title,
        "current_ai_decision": target.current_ai_decision,
        "suggestion_type": suggestion_type,
        "suggested_link_type": suggested_link_type,
        "candidate_tracked_bill_id": candidate.get("id") if candidate else None,
        "candidate_bill_number": candidate.get("bill_number") if candidate else None,
        "candidate_tracked_bill_title": candidate.get("title") if candidate else None,
        "candidate_official_summary": candidate.get("official_summary") if candidate else None,
        "candidate_problem_alignment": candidate.get("problem_alignment") if candidate else None,
        "candidate_solution_alignment": candidate.get("solution_alignment") if candidate else None,
        "candidate_population_alignment": candidate.get("population_alignment") if candidate else None,
        "candidate_mechanism_specificity": candidate.get("mechanism_specificity") if candidate else None,
        "candidate_evidence_strength": candidate.get("evidence_strength") if candidate else None,
        "candidate_relationship_fit": candidate.get("candidate_relationship_fit") if candidate else None,
        "partial_reason": candidate.get("partial_reason") if candidate else None,
        "mechanism_inferred": candidate.get("mechanism_inferred") if candidate else None,
        "mechanism_upgraded": candidate.get("mechanism_upgraded") if candidate else None,
        "reuse_penalty_applied": candidate.get("reuse_penalty_applied") if candidate else None,
        "fallback_partial_used": candidate.get("fallback_partial_used") if candidate else None,
        "classification_stage": candidate.get("classification_stage") if candidate else None,
        "candidate_total_score": candidate.get("candidate_total_score") if candidate else None,
        "candidate_rank": candidate.get("candidate_rank") if candidate else None,
        "llm_candidate_decision": candidate.get("llm_candidate_decision") if candidate else None,
        "llm_reasoning_short": candidate.get("llm_reasoning_short") if candidate else None,
        "why_this_candidate": why_this_candidate,
        "why_not_direct": why_not_direct,
        "recommended_next_step": recommended_next_step,
    }


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, default=str))


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=OUTPUT_FIELDS)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field) for field in OUTPUT_FIELDS})


def build_summary(rows: list[dict[str, Any]], future_bill_count: int, ai_judge_enabled: bool) -> dict[str, int | bool]:
    summary = {
        "future_bills_reviewed": future_bill_count,
        "suggestions_written": len(rows),
        "partial_conversion_suggestions": 0,
        "alternate_replacement_suggestions": 0,
        "direct_replacement_candidates": 0,
        "partial_candidates": 0,
        "manual_only_rows": 0,
        "ai_judge_enabled": ai_judge_enabled,
    }
    for row in rows:
        if row["suggestion_type"] == "partial_conversion":
            summary["partial_conversion_suggestions"] += 1
        elif row["suggestion_type"] == "alternate_replacement":
            summary["alternate_replacement_suggestions"] += 1

        if row["suggested_link_type"] == "Direct":
            summary["direct_replacement_candidates"] += 1
        elif row["suggested_link_type"] == "Partial":
            summary["partial_candidates"] += 1
        else:
            summary["manual_only_rows"] += 1
    return summary


def write_output_reports(
    output_path: Path,
    csv_path: Path | None,
    *,
    args: argparse.Namespace,
    rows: list[dict[str, Any]],
    ai_judge_enabled: bool,
    resolved_model: str | None,
) -> None:
    payload = {
        "generated_at": datetime.now(UTC).isoformat(),
        "input_review_report": str(args.input_review_report.resolve()) if args.input_review_report else None,
        "input_manual_queue": str(args.input_manual_queue.resolve()) if args.input_manual_queue else None,
        "ai_judge_enabled": ai_judge_enabled,
        "requested_model": args.model if ai_judge_enabled else None,
        "resolved_model": resolved_model,
        "top_k": args.top_k,
        "dry_run": args.dry_run,
        "summary": build_summary(rows, len({row["future_bill_id"] for row in rows}), ai_judge_enabled),
        "items": rows,
    }
    write_json(output_path, payload)
    print(f"Wrote suggestion report to {output_path}")

    if csv_path:
        write_csv(csv_path, rows)
        print(f"Wrote suggestion CSV to {csv_path}")


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

    output_path = args.output.resolve()
    csv_path = derive_csv_path(args.csv, output_path)

    review_payload = None
    manual_queue_payload = None
    if args.input_review_report and args.input_review_report.exists():
        review_payload = load_json_object(args.input_review_report.resolve())
    if args.input_manual_queue:
        if args.input_manual_queue.exists():
            manual_queue_payload = load_json_object(args.input_manual_queue.resolve())
        elif args.strict_manual_queue:
            raise SystemExit(f"Manual review queue file was provided but not found: {args.input_manual_queue}")
        else:
            print(f"Manual review queue file not found; continuing without it: {args.input_manual_queue}")
    elif get_default_manual_queue_path().exists():
        manual_queue_payload = load_json_object(get_default_manual_queue_path())

    if not review_payload and not manual_queue_payload:
        raise SystemExit(
            "No input reports were available. Provide at least one valid AI review report or manual review queue."
        )

    ai_judge_enabled = not args.disable_ai_judge
    resolved_model = None
    if ai_judge_enabled:
        available_models = fetch_available_models(args.openai_base_url, args.timeout)
        resolved_model = resolve_model_name(args.model, available_models)
        if resolved_model != args.model:
            print(f"Requested model {args.model} not found. Using {resolved_model} instead.")

    try:
        conn = get_db_connection()
    except Exception as error:
        raise SystemExit(f"Database connection error: {error}") from error
    try:
        with conn.cursor() as cursor:
            targets = build_targets(
                review_payload,
                manual_queue_payload,
                args.only_future_bill_id,
                args.only_link_id,
                args.max_items,
                cursor,
            )
            if not targets:
                print("No eligible future bill targets were found.")
                write_output_reports(
                    output_path,
                    csv_path,
                    args=args,
                    rows=[],
                    ai_judge_enabled=ai_judge_enabled,
                    resolved_model=resolved_model,
                )
                return

            candidate_pool = fetch_candidate_bills(cursor)
            rows: list[dict[str, Any]] = []
            candidate_usage_count: dict[int, int] = {}

            print("Future Bill Partial Suggestion Engine")
            print(f"Targets: {len(targets)}")
            print(f"Top K alternates: {args.top_k}")
            print(f"AI judge: {'enabled' if ai_judge_enabled else 'disabled'}")

            for index, target in enumerate(targets, start=1):
                future_bill = fetch_future_bill(cursor, target.future_bill_id)
                if not future_bill:
                    continue

                current_candidate = None
                if target.current_tracked_bill_id is not None:
                    current_candidate = fetch_tracked_bill(cursor, target.current_tracked_bill_id)
                    if current_candidate:
                        target.current_tracked_bill_title = current_candidate.get("title")

                existing_linked_ids = fetch_linked_tracked_bill_ids(cursor, target.future_bill_id)
                scored_current, alternates = rank_candidates(
                    future_bill,
                    candidate_pool,
                    target.current_tracked_bill_id,
                    existing_linked_ids,
                    candidate_usage_count,
                )

                top_alternates = alternates[: args.top_k]
                for rank, candidate in enumerate(top_alternates, start=1):
                    candidate["candidate_rank"] = rank

                if ai_judge_enabled and top_alternates:
                    judged = judge_candidates_with_openai(
                        top_alternates[:DEFAULT_LLM_TOP_CANDIDATES],
                        future_bill,
                        scored_current,
                        resolved_model,
                        args.openai_base_url,
                        args.timeout,
                        args.temperature,
                    )
                    judged_by_id = {candidate["id"]: candidate for candidate in judged}
                    for candidate in top_alternates:
                        if candidate["id"] in judged_by_id:
                            candidate.update(judged_by_id[candidate["id"]])

                top_alternates.sort(
                    key=lambda row: (
                        row["candidate_relationship_fit"] != "direct",
                        row["candidate_relationship_fit"] != "partial",
                        -row["candidate_weighted_score"],
                        -row["candidate_total_score"],
                        row["candidate_rank"],
                    )
                )
                for rank, candidate in enumerate(top_alternates, start=1):
                    candidate["candidate_rank"] = rank

                partial_link_type, partial_next_step, partial_reason, partial_not_direct = recommendation_for_partial(
                    scored_current,
                    target.current_ai_decision,
                )
                rows.append(
                    suggestion_row(
                        future_bill,
                        target,
                        "partial_conversion",
                        partial_link_type,
                        partial_next_step,
                        scored_current,
                        partial_reason,
                        partial_not_direct,
                    )
                )
                if scored_current:
                    candidate_usage_count[int(scored_current["id"])] = candidate_usage_count.get(int(scored_current["id"]), 0) + 1

                best_alternate = top_alternates[0] if top_alternates else None
                replacement_link_type, replacement_next_step, replacement_reason, replacement_not_direct = recommendation_for_alternate(
                    best_alternate,
                    scored_current,
                )
                rows.append(
                    suggestion_row(
                        future_bill,
                        target,
                        "alternate_replacement",
                        replacement_link_type,
                        replacement_next_step,
                        best_alternate,
                        replacement_reason,
                        replacement_not_direct,
                    )
                )
                if best_alternate:
                    candidate_usage_count[int(best_alternate["id"])] = candidate_usage_count.get(int(best_alternate["id"]), 0) + 1

                print(
                    f"[{index}/{len(targets)}] future_bill_id={future_bill['id']} "
                    f"partial={partial_next_step} replacement={replacement_next_step}"
                )
    finally:
        conn.close()
    write_output_reports(
        output_path,
        csv_path,
        args=args,
        rows=rows,
        ai_judge_enabled=ai_judge_enabled,
        resolved_model=resolved_model,
    )


if __name__ == "__main__":
    main()
