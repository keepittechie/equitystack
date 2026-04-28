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

import requests

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from lib.llm.provider import default_model_name, generate_text, list_available_models


DEFAULT_OPENAI_BASE_URL = ""
DEFAULT_MODEL = default_model_name()
DEFAULT_MODEL_VERIFIER = DEFAULT_MODEL
DEFAULT_MODEL_FALLBACK = DEFAULT_MODEL
DEFAULT_SENIOR_TIMEOUT = 240
DEFAULT_VERIFIER_TIMEOUT = 240
DEFAULT_TIMEOUT = DEFAULT_SENIOR_TIMEOUT
DEFAULT_TEMPERATURE = 0.1
DEFAULT_SEED = 7
VALID_DECISIONS = {
    "keep_direct": ("keep", "Direct"),
    "change_to_partial": ("convert_to_partial", "Partial"),
    "remove_link": ("remove", "None"),
    "review_manually": ("manual_review", "None"),
}
DIRECT_BENEFIT_HINTS = {
    "capital improvement",
    "cash",
    "compensation",
    "direct grant",
    "direct grants",
    "direct payment",
    "direct payments",
    "endowment matching",
    "grant",
    "grants",
    "housing voucher",
    "income support",
    "procurement pathway",
    "procurement pathways",
    "reparations payment",
    "scholarship",
    "stipend",
    "subsidy",
    "tuition assistance",
}
STUDY_BILL_HINTS = {
    "advisory board",
    "advisory commission",
    "assess",
    "commission",
    "committee",
    "feasibility",
    "interagency task force",
    "pilot study",
    "report",
    "research",
    "review",
    "study",
    "task force",
}
VAGUE_TITLE_HINTS = {
    "act",
    "amendments",
    "authorization",
    "bill",
    "improvement",
    "program",
    "reform",
    "support",
}
DOMAIN_KEYWORDS = {
    "education": {"school", "schools", "student", "students", "college", "colleges", "university", "universities", "hbcu", "education", "campus"},
    "health": {"health", "hospital", "medical", "medicaid", "medicare", "mental", "clinic", "care"},
    "housing": {"housing", "tenant", "rent", "homeless", "mortgage", "homeownership", "voucher"},
    "justice": {"justice", "sentencing", "prison", "jail", "policing", "criminal", "parole", "incarceration"},
    "labor": {"worker", "workers", "wage", "wages", "employment", "labor", "union", "workforce"},
    "economic": {"loan", "credit", "bank", "banking", "business", "procurement", "contract", "contracts", "wealth", "tax"},
    "voting": {"voting", "vote", "ballot", "election", "elections", "polling", "district"},
    "environment": {"environment", "climate", "pollution", "energy", "water", "air"},
}


@dataclass(frozen=True)
class HeuristicContext:
    bias_remove: bool
    bias_partial: bool
    bias_manual: bool
    issue_domain_mismatch: bool
    direct_benefit_expected: bool
    study_bill: bool
    weak_evidence: bool
    weak_title_evidence: bool
    exact_title_match: bool
    missing_summary_low_overlap: bool
    lexical_floor_trigger: bool
    heuristic_notes: list[str]


def get_project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def get_default_input_path() -> Path:
    return get_project_root() / "python" / "reports" / "future_bill_link_audit.json"


def get_default_output_path() -> Path:
    return get_project_root() / "python" / "reports" / "future_bill_link_ai_review.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run a rubric-based OpenAI review over the existing future bill link audit report."
    )
    parser.add_argument("--input", type=Path, default=get_default_input_path(), help="Path to future_bill_link_audit.json")
    parser.add_argument("--output", type=Path, default=get_default_output_path(), help="Path to write the AI review JSON report")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="Senior review model name")
    parser.add_argument("--verifier-model", default=DEFAULT_MODEL_VERIFIER, help="Verifier / first-pass model name")
    parser.add_argument("--fallback-model", default=DEFAULT_MODEL_FALLBACK, help="Fallback review model name")
    parser.add_argument("--include-medium", action="store_true", help="Review medium-risk items in addition to high-risk items")
    parser.add_argument("--max-items", type=int, help="Limit the number of items reviewed after filtering")
    parser.add_argument("--only-link-id", type=int, help="Review only a single future_bill_link_id")
    parser.add_argument("--dry-run", action="store_true", help="Skip OpenAI calls and emit placeholder manual-review rows")
    parser.add_argument("--timeout", type=int, help="Legacy alias that sets both senior and verifier timeouts")
    parser.add_argument("--senior-timeout", type=int, help="Timeout in seconds for the senior review model")
    parser.add_argument("--verifier-timeout", type=int, help="Timeout in seconds for the verifier/fallback review model")
    parser.add_argument("--temperature", type=float, default=DEFAULT_TEMPERATURE, help="Sampling temperature passed to OpenAI-compatible requests")
    parser.add_argument(
        "--csv",
        nargs="?",
        const="",
        help="Optionally write a CSV review file. Pass a path or omit the value to derive one from --output.",
    )
    parser.add_argument("--openai-base-url", default=DEFAULT_OPENAI_BASE_URL, help="Optional OpenAI-compatible base URL override")
    args = parser.parse_args()
    shared_timeout = args.timeout
    args.senior_timeout = args.senior_timeout or shared_timeout or DEFAULT_SENIOR_TIMEOUT
    args.verifier_timeout = args.verifier_timeout or shared_timeout or DEFAULT_VERIFIER_TIMEOUT
    if args.senior_timeout <= 0:
        parser.error("--senior-timeout must be greater than 0")
    if args.verifier_timeout <= 0:
        parser.error("--verifier-timeout must be greater than 0")
    return args


def load_audit_report(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text())
    if not isinstance(data, dict):
        raise ValueError("Audit report must be a JSON object")
    return data


def fetch_available_models(openai_base_url: str, timeout_seconds: int) -> list[str]:
    return list_available_models(openai_base_url=openai_base_url or None, timeout_seconds=timeout_seconds)


def select_rows(payload: dict[str, Any], include_medium: bool, only_link_id: int | None, max_items: int | None) -> list[dict[str, Any]]:
    selected = list(payload.get("high_risk") or [])
    if include_medium:
        selected.extend(payload.get("medium_risk") or [])

    if only_link_id is not None:
        selected = [row for row in selected if int(row["future_bill_link_id"]) == only_link_id]

    selected.sort(key=lambda row: (row.get("risk_level") != "high", row.get("future_bill_id", 0), row.get("bill_number") or ""))

    if max_items is not None:
        selected = selected[:max_items]

    return selected


def normalize_whitespace(text: str | None) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def normalize_string_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [item for item in (normalize_whitespace(str(part)) for part in value) if item]
    text = normalize_whitespace(None if value is None else str(value))
    return [text] if text else []


def first_nonempty_text(*values: Any) -> str | None:
    for value in values:
        normalized = normalize_whitespace(str(value)) if value not in (None, "") else ""
        if normalized:
            return normalized
    return None


def contains_any(text: str, phrases: set[str]) -> bool:
    lowered = text.lower()
    return any(phrase in lowered for phrase in phrases)


def tokenize(text: str | None) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", (text or "").lower()))


def detect_domain_mismatch(target_area: str | None, bill_text: str) -> bool:
    target_tokens = tokenize(target_area)
    if not target_tokens:
        return False

    domain_hits = set()
    for domain, keywords in DOMAIN_KEYWORDS.items():
        if target_tokens & keywords or domain in target_tokens:
            domain_hits.add(domain)

    if not domain_hits:
        return False

    bill_tokens = tokenize(bill_text)
    for domain in domain_hits:
        if bill_tokens & DOMAIN_KEYWORDS[domain]:
            return False

    return True


def title_is_vague(title: str | None) -> bool:
    tokens = [token for token in re.findall(r"[a-z0-9]+", (title or "").lower()) if token not in {"the", "and", "for", "of", "to"}]
    if len(tokens) <= 4:
        return True
    informative = [token for token in tokens if token not in VAGUE_TITLE_HINTS]
    return len(informative) <= 2


def title_evidence_is_weak(title: str | None) -> bool:
    normalized = normalize_whitespace(title)
    if not normalized:
        return True

    tokens = re.findall(r"[A-Za-z0-9]+", normalized)
    lower_tokens = [token.lower() for token in tokens]
    informative = [token for token in lower_tokens if token not in VAGUE_TITLE_HINTS and len(token) > 2]
    uppercase_tokens = [token for token in tokens if token.isupper() and len(token) >= 3]
    mechanism_or_population_hints = {
        "grant",
        "grants",
        "funding",
        "payment",
        "payments",
        "scholarship",
        "benefit",
        "benefits",
        "compensation",
        "voucher",
        "tenant",
        "student",
        "students",
        "worker",
        "workers",
        "hbcu",
        "hbcus",
        "veteran",
        "veterans",
        "housing",
        "college",
        "colleges",
        "university",
        "universities",
        "procurement",
        "enforcement",
        "sentencing",
    }

    if len(tokens) <= 3 and len(informative) <= 1:
        return True

    if uppercase_tokens and len(informative) <= 2:
        return True

    if len(informative) <= 2 and not (set(informative) & mechanism_or_population_hints):
        return True

    return False


def normalize_title_key(title: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (title or "").lower()).strip()


def has_exact_title_match(future_title: str | None, tracked_title: str | None) -> bool:
    normalized_future = normalize_title_key(future_title)
    normalized_tracked = normalize_title_key(tracked_title)
    if not normalized_future or not normalized_tracked:
        return False
    if normalized_future == normalized_tracked:
        return True
    if len(normalized_future.split()) >= 4 and normalized_future in normalized_tracked:
        return True
    if len(normalized_tracked.split()) >= 4 and normalized_tracked in normalized_future:
        return True
    return False


def effective_shared_keywords(shared_keywords: list[str] | None) -> list[str]:
    return [keyword for keyword in (shared_keywords or []) if normalize_whitespace(keyword)]


def build_heuristic_context(row: dict[str, Any]) -> HeuristicContext:
    official_summary = normalize_whitespace(row.get("official_summary"))
    tracked_bill_title = normalize_whitespace(row.get("tracked_bill_title"))
    proposed_solution = normalize_whitespace(row.get("proposed_solution"))
    combined_tracked_text = f"{tracked_bill_title} {official_summary}".strip()
    shared_keywords = effective_shared_keywords(row.get("shared_keywords"))
    match_score = float(row.get("match_score") or 0.0)

    heuristic_notes: list[str] = []
    direct_benefit_expected = contains_any(proposed_solution, DIRECT_BENEFIT_HINTS)
    study_bill = contains_any(combined_tracked_text, STUDY_BILL_HINTS)
    weak_title_evidence = title_evidence_is_weak(tracked_bill_title)
    exact_title_match = has_exact_title_match(row.get("future_bill_title"), tracked_bill_title)
    missing_summary_low_overlap = not official_summary and match_score < 0.05 and not shared_keywords
    lexical_floor_trigger = match_score == 0.0 and not shared_keywords and not official_summary
    weak_evidence = not official_summary and (title_is_vague(tracked_bill_title) or weak_title_evidence)
    issue_domain_mismatch = detect_domain_mismatch(row.get("target_area"), combined_tracked_text)

    bias_remove = False
    bias_partial = False
    bias_manual = False

    if match_score == 0.0 and not shared_keywords:
        heuristic_notes.append("No lexical overlap from the first-stage audit; remove unless the title or summary shows a clear policy match.")
        bias_remove = True

    if missing_summary_low_overlap:
        heuristic_notes.append("Missing official summary plus near-zero lexical overlap is a hard evidence warning; high scores should be capped.")
        bias_remove = True

    if direct_benefit_expected and study_bill:
        heuristic_notes.append(
            "Future bill expects a direct material benefit, but the tracked bill reads like a study, commission, report, or exploratory measure."
        )
        bias_partial = True

    if weak_evidence:
        heuristic_notes.append("Official summary is missing and the tracked bill title is too vague to support a confident policy-alignment judgment.")
        bias_manual = True

    if weak_title_evidence and not official_summary:
        heuristic_notes.append("Tracked bill title is generic or acronym-heavy, so title-only evidence is too weak to support a strong match.")
        bias_manual = True

    if issue_domain_mismatch:
        heuristic_notes.append("The future bill target area and the tracked bill text appear to be in different policy domains.")
        bias_remove = True

    if not heuristic_notes:
        heuristic_notes.append("No strong heuristic override detected.")

    return HeuristicContext(
        bias_remove=bias_remove,
        bias_partial=bias_partial,
        bias_manual=bias_manual,
        issue_domain_mismatch=issue_domain_mismatch,
        direct_benefit_expected=direct_benefit_expected,
        study_bill=study_bill,
        weak_evidence=weak_evidence,
        weak_title_evidence=weak_title_evidence,
        exact_title_match=exact_title_match,
        missing_summary_low_overlap=missing_summary_low_overlap,
        lexical_floor_trigger=lexical_floor_trigger,
        heuristic_notes=heuristic_notes,
    )


def rubric_text() -> str:
    return """Scoring rubric:
A. Problem Alignment (0-3)
- 0 = different problem
- 1 = adjacent issue only
- 2 = same general issue
- 3 = strongly same problem

B. Solution Alignment (0-3)
- 0 = does not implement the solution at all
- 1 = only indirectly related to the solution
- 2 = partially advances the solution
- 3 = directly implements or substantially advances the solution

C. Population Alignment (0-3)
- 0 = different target population
- 1 = broad/general public only
- 2 = includes the relevant population indirectly
- 3 = directly targets or clearly benefits the same population

D. Mechanism Specificity (0-3)
- 0 = clearly different mechanism
- 1 = weak mechanism overlap
- 2 = related mechanism
- 3 = same or very similar mechanism

E. Evidence Strength (0-3)
- 0 = almost no evidence
- 1 = weak evidence
- 2 = moderate evidence
- 3 = strong evidence

Score bands:
- 12 to 15: likely keep_direct
- 8 to 11: likely change_to_partial
- 4 to 7: likely remove_link unless ambiguity is genuine
- 0 to 3: strong remove_link

Override rules:
- Same topic is not enough.
- Same category is not enough.
- Keyword overlap alone is not enough.
- A Direct link requires actual solution-level alignment.
- If solution_alignment is 0, the result usually cannot be keep_direct.
- If mechanism_specificity is 0 and the future bill requires a direct material benefit but the tracked bill is a study/report/commission, prefer change_to_partial or remove_link.
- If evidence_strength is 0 or 1 because the official summary is missing and the title is vague, prefer review_manually unless the match is still clearly strong.
- If problem_alignment is 0 and population_alignment is 0, strongly prefer remove_link.

Signal extraction:
- Explicitly identify evidence gaps before deciding.
- Explicitly rate ambiguity as low, medium, or high.
- Explicitly list conflicts or competing interpretations.
- Confidence must be a 0 to 1 value after penalties, not before.

Score derivation:
- High-end scores require strong evidence and low ambiguity.
- Medium scores allow moderate uncertainty when the core alignment is still credible.
- Low scores are required when ambiguity, conflicts, or evidence gaps are substantial.

Penalty logic:
- Ambiguity reduces confidence.
- Evidence gaps reduce confidence.
- Conflicts reduce confidence.
- Low confidence should push the result toward change_to_partial, remove_link, or review_manually rather than keep_direct.

Self-check:
- Reconsider whether a cautious reviewer would downgrade because the evidence is weak, ambiguous, or conflicting.
- If yes, apply that downgrade before finalizing the JSON."""


def build_prompt(row: dict[str, Any], heuristics: HeuristicContext) -> str:
    review_payload = {
        "future_bill_link_id": row["future_bill_link_id"],
        "future_bill_title": row.get("future_bill_title"),
        "target_area": row.get("target_area"),
        "problem_statement": row.get("problem_statement"),
        "proposed_solution": row.get("proposed_solution"),
        "tracked_bill_title": row.get("tracked_bill_title"),
        "official_summary": row.get("official_summary"),
        "bill_number": row.get("bill_number"),
        "current_link_type": row.get("link_type"),
        "risk_level": row.get("risk_level"),
        "match_score": row.get("match_score"),
        "shared_keywords": row.get("shared_keywords"),
        "bill_status": row.get("bill_status"),
        "latest_action_date": row.get("latest_action_date"),
        "source_system": row.get("source_system"),
        "heuristic_bias": {
            "bias_remove": heuristics.bias_remove,
            "bias_partial": heuristics.bias_partial,
            "bias_manual": heuristics.bias_manual,
            "issue_domain_mismatch": heuristics.issue_domain_mismatch,
            "direct_benefit_expected": heuristics.direct_benefit_expected,
            "study_bill": heuristics.study_bill,
            "weak_evidence": heuristics.weak_evidence,
            "notes": heuristics.heuristic_notes,
        },
    }
    schema = {
        "problem_alignment": 0,
        "solution_alignment": 0,
        "population_alignment": 0,
        "mechanism_specificity": 0,
        "evidence_strength": 0,
        "total_score": 0,
        "decision": "keep_direct | change_to_partial | remove_link | review_manually",
        "confidence": 0.0,
        "signal_evidence_gaps": ["missing summary detail"],
        "signal_ambiguity": "low | medium | high",
        "signal_conflicts": ["topic overlap without mechanism overlap"],
        "applied_penalties": ["downgraded for weak evidence"],
        "self_check": "A cautious reviewer would downgrade because evidence is still weak.",
        "reasoning_short": "short explanation",
        "suggested_new_link_type": "Direct | Partial | None",
        "recommended_action": "keep | convert_to_partial | remove | manual_review",
    }
    return (
        "You are reviewing whether an existing future_bill_link is substantively valid.\n"
        "Decide based on actual policy alignment, not topic similarity.\n"
        "Return strict JSON only. Do not add markdown. Do not add commentary outside JSON.\n\n"
        f"{rubric_text()}\n\n"
        "Input item:\n"
        f"{json.dumps(review_payload, indent=2, ensure_ascii=True)}\n\n"
        "Instructions:\n"
        "- First extract signals: evidence gaps, ambiguity, conflicts, and post-penalty confidence.\n"
        "- Score each rubric dimension from 0 to 3.\n"
        "- Recompute total_score as the sum of the five dimension scores.\n"
        "- Use the score bands as guidance, but follow the override rules.\n"
        "- High scoring requires strong evidence and low ambiguity; do not award high scores on topic similarity alone.\n"
        "- Apply explicit penalties for ambiguity, evidence gaps, conflicts, and low confidence before choosing the final decision.\n"
        "- If the Direct link is not strongly supported, prefer remove_link, change_to_partial, or review_manually.\n"
        "- Use review_manually when evidence is genuinely insufficient or ambiguity/conflicts remain too high for a reliable downgrade path.\n"
        "- Perform a self-check: ask whether a cautious reviewer would downgrade this result; if yes, do it before finalizing.\n"
        "- Keep reasoning_short to one short paragraph or less.\n"
        "- The JSON must exactly use these keys:\n"
        f"{json.dumps(schema, indent=2, ensure_ascii=True)}"
    )


def call_openai(prompt: str, model: str, openai_base_url: str, timeout_seconds: int, temperature: float) -> str:
    body = generate_text(
        prompt,
        model=model,
        openai_base_url=openai_base_url or None,
        timeout_seconds=timeout_seconds,
        temperature=temperature,
        response_format="json",
    )
    if not isinstance(body, str) or not body.strip():
        raise ValueError("LLM response did not contain a non-empty JSON string")
    return body


def call_openai_with_retry(
    prompt: str,
    model: str,
    openai_base_url: str,
    timeout_seconds: int,
    temperature: float,
) -> tuple[dict[str, Any] | None, int, list[str]]:
    errors: list[str] = []
    attempts = 0
    for _ in range(2):
        attempts += 1
        try:
            raw_text = call_openai(prompt, model, openai_base_url, timeout_seconds, temperature)
            raw_payload = parse_json_response(raw_text)
            return raw_payload, attempts, errors
        except (json.JSONDecodeError, requests.RequestException, RuntimeError, ValueError) as error:
            errors.append(str(error))
    return None, attempts, errors


def build_retry_reason(label: str, errors: list[str]) -> str:
    details = " | ".join(errors) if errors else "No error detail was returned."
    return f"{label} failed after one retry: {details}"


def parse_json_response(text: str) -> dict[str, Any]:
    candidate = text.strip()
    if candidate.startswith("```"):
        candidate = re.sub(r"^```(?:json)?\s*", "", candidate)
        candidate = re.sub(r"\s*```$", "", candidate)

    start = candidate.find("{")
    end = candidate.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON object found in OpenAI response")

    parsed = json.loads(candidate[start : end + 1])
    if not isinstance(parsed, dict):
        raise ValueError("OpenAI response JSON must be an object")
    return parsed


def normalize_score(value: Any) -> int:
    try:
        score = int(value)
    except (TypeError, ValueError):
        return 0
    return max(0, min(3, score))


def normalize_confidence(value: Any) -> float:
    try:
        confidence = float(value)
    except (TypeError, ValueError):
        return 0.0
    return round(max(0.0, min(1.0, confidence)), 3)


def normalize_decision(value: Any) -> str:
    decision = str(value or "").strip().lower()
    if decision in VALID_DECISIONS:
        return decision

    alias_map = {
        "keep": "keep_direct",
        "direct": "keep_direct",
        "partial": "change_to_partial",
        "convert_to_partial": "change_to_partial",
        "remove": "remove_link",
        "manual_review": "review_manually",
    }
    return alias_map.get(decision, "review_manually")


def normalize_link_type(value: Any, decision: str) -> str:
    normalized = str(value or "").strip()
    if normalized in {"Direct", "Partial", "None"}:
        return normalized
    return VALID_DECISIONS[decision][1]


def normalize_action(value: Any, decision: str) -> str:
    normalized = str(value or "").strip()
    if normalized in {"keep", "convert_to_partial", "remove", "manual_review"}:
        return normalized
    return VALID_DECISIONS[decision][0]


def cap_total_score(scores: dict[str, int], max_total: int) -> dict[str, int]:
    if sum(scores.values()) <= max_total:
        return scores

    capped = dict(scores)
    reduction_order = [
        "population_alignment",
        "mechanism_specificity",
        "problem_alignment",
        "solution_alignment",
        "evidence_strength",
    ]
    while sum(capped.values()) > max_total:
        reduced = False
        for key in reduction_order:
            if capped[key] > 0 and sum(capped.values()) > max_total:
                capped[key] -= 1
                reduced = True
        if not reduced:
            break
    return capped


def apply_evidence_caps(row: dict[str, Any], scores: dict[str, int], heuristics: HeuristicContext) -> dict[str, int]:
    capped = dict(scores)

    # Missing summaries with no lexical evidence are the easiest place for LLM overreach,
    # so cap the score space before any final decision logic runs.
    if heuristics.missing_summary_low_overlap and not heuristics.exact_title_match:
        capped["evidence_strength"] = min(capped["evidence_strength"], 1)
        capped["problem_alignment"] = min(capped["problem_alignment"], 1)
        capped["population_alignment"] = min(capped["population_alignment"], 1)
        if heuristics.weak_title_evidence:
            capped["solution_alignment"] = min(capped["solution_alignment"], 1)
            capped["mechanism_specificity"] = min(capped["mechanism_specificity"], 1)
        capped = cap_total_score(capped, 7)

    # With zero overlap, no summary, and no exact title rescue, strong-match scoring is not credible.
    if heuristics.lexical_floor_trigger and not heuristics.exact_title_match:
        capped["evidence_strength"] = min(capped["evidence_strength"], 1)
        capped = cap_total_score(capped, 6)

    # Generic or branding-heavy titles without summaries are dangerous because they invite hallucinated specificity.
    if heuristics.weak_title_evidence and heuristics.weak_evidence and not heuristics.exact_title_match:
        capped["evidence_strength"] = min(capped["evidence_strength"], 1)
        capped["mechanism_specificity"] = min(capped["mechanism_specificity"], 1)
        capped = cap_total_score(capped, 7)

    if row.get("risk_level") == "high" and heuristics.bias_remove and not heuristics.exact_title_match:
        capped = cap_total_score(capped, 7)

    return capped


def classify_match(scores: dict[str, int], final_decision: str) -> str:
    total = scores["total_score"]
    # Match labels are recomputed from the final bounded state so they cannot contradict final_decision.
    if final_decision == "remove_link":
        return "bad_match"
    if final_decision == "keep_direct" and total >= 12 and scores["solution_alignment"] >= 2:
        return "strong_match"
    if final_decision == "change_to_partial" and total >= 8:
        return "partial_match"
    if total <= 3 or (scores["problem_alignment"] == 0 and scores["solution_alignment"] == 0):
        return "bad_match"
    return "weak_match"


def fallback_review(row: dict[str, Any], reason: str, heuristics: HeuristicContext) -> dict[str, Any]:
    return {
        "problem_alignment": 0,
        "solution_alignment": 0,
        "population_alignment": 0,
        "mechanism_specificity": 0,
        "evidence_strength": 0,
        "total_score": 0,
        "llm_decision": "review_manually",
        "llm_confidence": 0.0,
        "signal_evidence_gaps": [reason],
        "signal_ambiguity": "high",
        "signal_conflicts": [],
        "applied_penalties": ["downgraded to manual review because no usable OpenAI result was available"],
        "self_check": "A cautious reviewer would not keep or strengthen this link without a usable model result.",
        "llm_reasoning_short": reason,
        "llm_suggested_new_link_type": "None",
        "llm_recommended_action": "manual_review",
        "final_decision": "review_manually",
        "recommended_action": "manual_review",
        "suggested_new_link_type": "None",
        "match_label": "bad_match" if heuristics.bias_remove else "weak_match",
    }


def apply_post_processing(row: dict[str, Any], normalized: dict[str, Any], heuristics: HeuristicContext) -> dict[str, Any]:
    decision = normalized["llm_decision"]
    confidence = normalized["llm_confidence"]

    total_score = normalized["total_score"]
    solution_alignment = normalized["solution_alignment"]
    mechanism_specificity = normalized["mechanism_specificity"]
    evidence_strength = normalized["evidence_strength"]
    problem_alignment = normalized["problem_alignment"]
    population_alignment = normalized["population_alignment"]

    hard_evidence_block = (heuristics.missing_summary_low_overlap or heuristics.lexical_floor_trigger) and not heuristics.exact_title_match

    if total_score <= 3 and decision == "keep_direct":
        decision = "remove_link"
        confidence = min(confidence, 0.45)

    if solution_alignment == 0 and decision == "keep_direct":
        decision = "change_to_partial" if total_score >= 8 else "remove_link"
        confidence = min(confidence, 0.55)

    if heuristics.weak_evidence and evidence_strength <= 1 and decision == "keep_direct":
        decision = "review_manually" if total_score < 12 else "change_to_partial"
        confidence = min(confidence, 0.5)

    if heuristics.bias_partial and mechanism_specificity == 0 and decision == "keep_direct":
        decision = "change_to_partial"
        confidence = min(confidence, 0.55)

    if 8 <= total_score <= 11 and mechanism_specificity <= 1 and decision == "keep_direct":
        decision = "change_to_partial"
        confidence = min(confidence, 0.65)

    if heuristics.bias_remove and total_score <= 7 and decision in {"keep_direct", "change_to_partial"}:
        decision = "remove_link"
        confidence = min(confidence, 0.65)

    if heuristics.issue_domain_mismatch and decision == "keep_direct":
        decision = "remove_link"
        confidence = min(confidence, 0.5)

    if problem_alignment == 0 and population_alignment == 0:
        decision = "remove_link"
        confidence = min(confidence, 0.6)

    if heuristics.bias_manual and evidence_strength <= 1 and total_score <= 7 and decision != "remove_link":
        decision = "review_manually"
        confidence = min(confidence, 0.5)

    if hard_evidence_block and decision == "keep_direct":
        decision = "remove_link" if heuristics.bias_remove else "review_manually"
        confidence = min(confidence, 0.45)

    if heuristics.weak_title_evidence and not heuristics.exact_title_match and decision == "keep_direct":
        decision = "review_manually" if not heuristics.bias_remove else "remove_link"
        confidence = min(confidence, 0.45)

    keep_direct_allowed = (
        normalized["solution_alignment"] >= 2
        and normalized["problem_alignment"] >= 2
        and normalized["evidence_strength"] >= 2
        and normalized["mechanism_specificity"] >= 2
        and normalized["total_score"] >= 10
        and not hard_evidence_block
        and not (not normalize_whitespace(row.get("official_summary")) and heuristics.weak_title_evidence)
    )
    if decision == "keep_direct" and not keep_direct_allowed:
        if heuristics.bias_remove or normalized["total_score"] <= 7 or normalized["evidence_strength"] <= 1:
            decision = "remove_link"
        elif not normalize_whitespace(row.get("official_summary")) and heuristics.weak_title_evidence:
            decision = "review_manually"
        else:
            decision = "change_to_partial"
        confidence = min(confidence, 0.55)

    if hard_evidence_block and decision == "change_to_partial" and normalized["total_score"] <= 6:
        decision = "remove_link"
        confidence = min(confidence, 0.5)

    recommended_action, suggested_new_link_type = VALID_DECISIONS[decision]
    normalized["llm_confidence"] = round(confidence, 3)
    normalized["final_decision"] = decision
    normalized["recommended_action"] = recommended_action
    normalized["suggested_new_link_type"] = suggested_new_link_type
    normalized["match_label"] = classify_match(normalized, decision)
    return normalized


def normalize_model_result(raw: dict[str, Any], row: dict[str, Any], heuristics: HeuristicContext) -> dict[str, Any]:
    scores = {
        "problem_alignment": normalize_score(raw.get("problem_alignment")),
        "solution_alignment": normalize_score(raw.get("solution_alignment")),
        "population_alignment": normalize_score(raw.get("population_alignment")),
        "mechanism_specificity": normalize_score(raw.get("mechanism_specificity")),
        "evidence_strength": normalize_score(raw.get("evidence_strength")),
    }
    scores = apply_evidence_caps(row, scores, heuristics)
    total_score = sum(scores.values())
    decision = normalize_decision(raw.get("decision"))

    normalized = {
        **scores,
        "total_score": total_score,
        "llm_decision": decision,
        "llm_confidence": normalize_confidence(raw.get("confidence")),
        "signal_evidence_gaps": normalize_string_list(raw.get("signal_evidence_gaps")),
        "signal_ambiguity": str(raw.get("signal_ambiguity") or "").strip().lower() or "medium",
        "signal_conflicts": normalize_string_list(raw.get("signal_conflicts")),
        "applied_penalties": normalize_string_list(raw.get("applied_penalties")),
        "self_check": normalize_whitespace(raw.get("self_check"))[:240],
        "llm_reasoning_short": normalize_whitespace(raw.get("reasoning_short"))[:400],
        "llm_suggested_new_link_type": normalize_link_type(raw.get("suggested_new_link_type"), decision),
        "llm_recommended_action": normalize_action(raw.get("recommended_action"), decision),
    }

    if normalized["signal_ambiguity"] not in {"low", "medium", "high"}:
        normalized["signal_ambiguity"] = "medium"

    if not normalized["llm_reasoning_short"]:
        normalized["llm_reasoning_short"] = (
            f"Model response for future_bill_link_id {row['future_bill_link_id']} did not include usable reasoning."
        )
    if not normalized["self_check"]:
        normalized["self_check"] = "Cautious reviewer check missing; review ambiguity, conflicts, and evidence gaps before trusting a strong match."

    return apply_post_processing(row, normalized, heuristics)


def review_row(
    row: dict[str, Any],
    model: str,
    verifier_model: str,
    fallback_model: str,
    openai_base_url: str,
    senior_timeout_seconds: int,
    verifier_timeout_seconds: int,
    temperature: float,
    dry_run: bool,
) -> dict[str, Any]:
    heuristics = build_heuristic_context(row)
    timestamp = datetime.now(UTC).isoformat()
    verifier_model_used = None
    senior_model_used = None
    effective_model = None
    fallback_used = False
    fallback_reason = None
    review_backend = "dry_run" if dry_run else "openai"
    model_resolution_status = "dry_run" if dry_run else "exact_requested"
    retry_count = 0
    senior_attempted = False
    senior_retry_attempted = False
    verifier_attempted = False
    verifier_retry_attempted = False
    resolved_model = None

    if dry_run:
        normalized = fallback_review(row, "Dry run mode skipped the OpenAI review call.", heuristics)
    else:
        prompt = build_prompt(row, heuristics)
        senior_payload, senior_attempts, senior_errors = call_openai_with_retry(
            prompt,
            model,
            openai_base_url,
            senior_timeout_seconds,
            temperature,
        )
        senior_attempted = senior_attempts > 0
        senior_retry_attempted = senior_attempts > 1
        retry_count += max(0, senior_attempts - 1)

        if senior_payload is not None:
            normalized = normalize_model_result(senior_payload, row, heuristics)
            senior_model_used = model
            effective_model = model
            resolved_model = model
            review_backend = "openai"
        else:
            senior_reason = build_retry_reason("Senior model", senior_errors)
            verifier_payload, verifier_attempts, verifier_errors = call_openai_with_retry(
                prompt,
                fallback_model,
                openai_base_url,
                verifier_timeout_seconds,
                temperature,
            )
            verifier_attempted = verifier_attempts > 0
            verifier_retry_attempted = verifier_attempts > 1
            retry_count += max(0, verifier_attempts - 1)

            if verifier_payload is not None:
                normalized = normalize_model_result(verifier_payload, row, heuristics)
                verifier_model_used = fallback_model
                effective_model = fallback_model
                resolved_model = fallback_model
                review_backend = "fallback"
                fallback_used = True
                fallback_reason = senior_reason
                model_resolution_status = "senior_failed_using_fallback_model"
            else:
                verifier_reason = build_retry_reason("Verifier/fallback model", verifier_errors)
                fallback_reason = (
                    f"{senior_reason} Verifier/fallback model also failed after one retry: "
                    f"{' | '.join(verifier_errors) if verifier_errors else 'No error detail was returned.'} "
                    "Heuristic fallback used as last resort."
                )
                normalized = fallback_review(row, fallback_reason, heuristics)
                review_backend = "heuristic_fallback"
                fallback_used = True
                effective_model = None
                resolved_model = None
                model_resolution_status = "senior_and_verifier_failed_using_heuristic"

    return {
        "future_bill_id": row.get("future_bill_id"),
        "future_bill_link_id": row["future_bill_link_id"],
        "tracked_bill_id": row.get("tracked_bill_id"),
        "future_bill_title": row.get("future_bill_title"),
        "bill_number": row.get("bill_number"),
        "tracked_bill_title": row.get("tracked_bill_title"),
        "original_risk_level": row.get("risk_level"),
        "original_link_type": row.get("link_type"),
        "target_area": row.get("target_area"),
        "problem_statement": row.get("problem_statement"),
        "proposed_solution": row.get("proposed_solution"),
        "official_summary": row.get("official_summary"),
        "match_score": row.get("match_score"),
        "shared_keywords": row.get("shared_keywords"),
        "problem_alignment": normalized["problem_alignment"],
        "solution_alignment": normalized["solution_alignment"],
        "population_alignment": normalized["population_alignment"],
        "mechanism_specificity": normalized["mechanism_specificity"],
        "evidence_strength": normalized["evidence_strength"],
        "total_score": normalized["total_score"],
        "match_label": normalized["match_label"],
        "llm_decision": normalized["llm_decision"],
        "llm_confidence": normalized["llm_confidence"],
        "signal_evidence_gaps": normalized["signal_evidence_gaps"],
        "signal_ambiguity": normalized["signal_ambiguity"],
        "signal_conflicts": normalized["signal_conflicts"],
        "applied_penalties": normalized["applied_penalties"],
        "self_check": normalized["self_check"],
        "llm_reasoning_short": normalized["llm_reasoning_short"],
        "llm_suggested_new_link_type": normalized["llm_suggested_new_link_type"],
        "llm_recommended_action": normalized["llm_recommended_action"],
        "final_decision": normalized["final_decision"],
        "recommended_action": normalized["recommended_action"],
        "suggested_new_link_type": normalized["suggested_new_link_type"],
        "requested_model": model,
        "effective_model": effective_model,
        "resolved_model": resolved_model,
        "review_backend": review_backend,
        "fallback_used": fallback_used,
        "fallback_reason": fallback_reason,
        "model_resolution_status": model_resolution_status,
        "timeout_seconds": senior_timeout_seconds,
        "senior_timeout_seconds": senior_timeout_seconds,
        "verifier_timeout_seconds": verifier_timeout_seconds,
        "retry_count": retry_count,
        "senior_attempted": senior_attempted,
        "senior_retry_attempted": senior_retry_attempted,
        "verifier_attempted": verifier_attempted,
        "verifier_retry_attempted": verifier_retry_attempted,
        "verifier_model_requested": verifier_model,
        "verifier_model_used": verifier_model_used,
        "senior_model_requested": model,
        "senior_model_used": senior_model_used,
        "fallback_model": fallback_model,
        "heuristic_flags": {
            "bias_remove": heuristics.bias_remove,
            "bias_partial": heuristics.bias_partial,
            "bias_manual": heuristics.bias_manual,
            "issue_domain_mismatch": heuristics.issue_domain_mismatch,
            "direct_benefit_expected": heuristics.direct_benefit_expected,
            "study_bill": heuristics.study_bill,
            "weak_evidence": heuristics.weak_evidence,
            "weak_title_evidence": heuristics.weak_title_evidence,
            "exact_title_match": heuristics.exact_title_match,
            "missing_summary_low_overlap": heuristics.missing_summary_low_overlap,
            "lexical_floor_trigger": heuristics.lexical_floor_trigger,
            "notes": heuristics.heuristic_notes,
        },
        "review_timestamp": timestamp,
    }


def build_summary(reviewed_items: list[dict[str, Any]]) -> dict[str, int]:
    summary = {
        "total_reviewed": len(reviewed_items),
        "keep_direct_count": 0,
        "change_to_partial_count": 0,
        "remove_link_count": 0,
        "review_manually_count": 0,
        "bad_matches_count": 0,
        "weak_matches_count": 0,
        "partial_matches_count": 0,
        "strong_matches_count": 0,
        "fallback_count": 0,
    }

    for item in reviewed_items:
        if item["final_decision"] == "keep_direct":
            summary["keep_direct_count"] += 1
        elif item["final_decision"] == "change_to_partial":
            summary["change_to_partial_count"] += 1
        elif item["final_decision"] == "remove_link":
            summary["remove_link_count"] += 1
        else:
            summary["review_manually_count"] += 1

        label = item["match_label"]
        if label == "bad_match":
            summary["bad_matches_count"] += 1
        elif label == "weak_match":
            summary["weak_matches_count"] += 1
        elif label == "partial_match":
            summary["partial_matches_count"] += 1
        elif label == "strong_match":
            summary["strong_matches_count"] += 1
        if item.get("fallback_used"):
            summary["fallback_count"] += 1

    return summary


def summarize_failure_reason(fallback_reasons: list[str]) -> str | None:
    normalized = [normalize_whitespace(reason) for reason in fallback_reasons if normalize_whitespace(reason)]
    if not normalized:
        return None

    lowered = [reason.lower() for reason in normalized]
    if all(
        "non-empty json string" in reason
        or "no json object found" in reason
        or "empty json" in reason
        or "empty response" in reason
        for reason in lowered
    ):
        return "openai_empty_response"
    if all("timed out" in reason or "timeout" in reason for reason in lowered):
        return "openai_timeout"
    if all("connection" in reason or "refused" in reason for reason in lowered):
        return "openai_connection_error"
    return normalized[0] if len(normalized) == 1 else "multiple_failures"


def build_workflow_outcome_summary(reviewed_items: list[dict[str, Any]]) -> dict[str, Any]:
    summary = build_summary(reviewed_items)
    total_items = summary["total_reviewed"]
    primary_model_success = sum(1 for item in reviewed_items if item.get("review_backend") == "openai")
    fallback_model_success = sum(1 for item in reviewed_items if item.get("review_backend") == "fallback")
    heuristic_fallback = sum(1 for item in reviewed_items if item.get("review_backend") == "heuristic_fallback")
    dry_run_count = sum(1 for item in reviewed_items if item.get("review_backend") == "dry_run")
    fallback_used = summary["fallback_count"]
    ai_success = primary_model_success + fallback_model_success
    failure_reason = summarize_failure_reason(
        [str(item.get("fallback_reason") or "") for item in reviewed_items if item.get("fallback_used")]
    )

    if total_items == 0:
        workflow_status = "not_started"
        ai_status = "not_started"
        confidence_level = "low"
        trust_warning = True
        user_message = "No legislative AI review results are recorded yet."
    elif dry_run_count == total_items:
        workflow_status = "completed_with_fallback"
        ai_status = "skipped"
        confidence_level = "low"
        trust_warning = True
        user_message = "AI review was skipped. All items require manual review."
    elif heuristic_fallback == total_items or ai_success == 0:
        workflow_status = "completed_with_fallback"
        ai_status = "failed"
        confidence_level = "low"
        trust_warning = True
        user_message = "AI review failed. All items require manual review."
    elif fallback_used > 0:
        workflow_status = "completed_with_partial_fallback"
        ai_status = "partial"
        confidence_level = "medium" if heuristic_fallback == 0 else "low"
        trust_warning = True
        user_message = "AI partially succeeded. Some items used fallback and still require manual verification."
    elif summary["review_manually_count"] > 0:
        workflow_status = "completed_with_manual_review"
        ai_status = "success"
        confidence_level = "medium"
        trust_warning = True
        user_message = "AI review completed, but some items still require manual review."
    else:
        workflow_status = "completed_with_ai"
        ai_status = "success"
        confidence_level = "high"
        trust_warning = False
        user_message = "AI review completed successfully. Results are fully evaluated."

    next_step = (
        "Review required items"
        if summary["review_manually_count"] > 0 or trust_warning
        else "Review bundle and operator approvals"
    )

    return {
        "workflow_status": workflow_status,
        "ai_status": {
            "run_status": ai_status,
            "total_items": total_items,
            "ai_success": ai_success,
            "primary_model_success": primary_model_success,
            "fallback_model_success": fallback_model_success,
            "fallback_used": fallback_used,
            "heuristic_fallback": heuristic_fallback,
            "dry_run_count": dry_run_count,
            "ai_failure_reason": failure_reason,
        },
        "decisions": {
            "kept": summary["keep_direct_count"],
            "modified": summary["change_to_partial_count"],
            "removed": summary["remove_link_count"],
            "manual_review": summary["review_manually_count"],
        },
        "confidence_level": confidence_level,
        "trust_warning": trust_warning,
        "user_message": user_message,
        "next_step": next_step,
    }


def derive_csv_path(csv_arg: str | None, output_path: Path) -> Path | None:
    if csv_arg is None:
        return None
    if csv_arg == "":
        return output_path.with_suffix(".csv")
    return Path(csv_arg).resolve()


def write_csv_report(path: Path, reviewed_items: list[dict[str, Any]]) -> None:
    fieldnames = [
        "future_bill_id",
        "future_bill_link_id",
        "tracked_bill_id",
        "future_bill_title",
        "bill_number",
        "tracked_bill_title",
        "original_risk_level",
        "original_link_type",
        "match_score",
        "problem_alignment",
        "solution_alignment",
        "population_alignment",
        "mechanism_specificity",
        "evidence_strength",
        "total_score",
        "match_label",
        "llm_decision",
        "llm_confidence",
        "llm_reasoning_short",
        "final_decision",
        "recommended_action",
        "suggested_new_link_type",
        "requested_model",
        "effective_model",
        "resolved_model",
        "review_backend",
        "fallback_used",
        "fallback_reason",
        "model_resolution_status",
        "timeout_seconds",
        "senior_timeout_seconds",
        "verifier_timeout_seconds",
        "retry_count",
        "senior_attempted",
        "senior_retry_attempted",
        "verifier_attempted",
        "verifier_retry_attempted",
        "review_timestamp",
    ]
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for item in reviewed_items:
            writer.writerow({field: item.get(field) for field in fieldnames})


def write_json_report(
    path: Path,
    input_path: Path,
    requested_model: str,
    verifier_model: str,
    fallback_model: str,
    include_medium: bool,
    dry_run: bool,
    senior_timeout_seconds: int,
    verifier_timeout_seconds: int,
    reviewed_items: list[dict[str, Any]],
) -> None:
    workflow_outcome_summary = build_workflow_outcome_summary(reviewed_items)
    effective_models = sorted({item.get("effective_model") for item in reviewed_items if item.get("effective_model")})
    review_backends = sorted({item.get("review_backend") for item in reviewed_items if item.get("review_backend")})
    fallback_reasons = sorted({item.get("fallback_reason") for item in reviewed_items if item.get("fallback_reason")})
    model_statuses = sorted({item.get("model_resolution_status") for item in reviewed_items if item.get("model_resolution_status")})
    payload = {
        "generated_at": datetime.now(UTC).isoformat(),
        "input_report": str(input_path),
        "requested_model": requested_model,
        "effective_model": effective_models[0] if len(effective_models) == 1 else ("mixed" if effective_models else None),
        "resolved_model": effective_models[0] if len(effective_models) == 1 else ("mixed" if effective_models else None),
        "review_backend": review_backends[0] if len(review_backends) == 1 else ("mixed" if review_backends else None),
        "fallback_used": any(bool(item.get("fallback_used")) for item in reviewed_items),
        "fallback_reason": fallback_reasons[0] if len(fallback_reasons) == 1 else ("Multiple fallback reasons; inspect item-level metadata." if fallback_reasons else None),
        "model_resolution_status": model_statuses[0] if len(model_statuses) == 1 else ("mixed" if model_statuses else None),
        "verifier_model": verifier_model,
        "fallback_model": fallback_model,
        "review_scope": "high_and_medium_risk" if include_medium else "high_risk_only",
        "dry_run": dry_run,
        "timeout_seconds": senior_timeout_seconds,
        "senior_timeout_seconds": senior_timeout_seconds,
        "verifier_timeout_seconds": verifier_timeout_seconds,
        "retry_count": sum(int(item.get("retry_count") or 0) for item in reviewed_items),
        "senior_attempted": any(bool(item.get("senior_attempted")) for item in reviewed_items),
        "senior_retry_attempted": any(bool(item.get("senior_retry_attempted")) for item in reviewed_items),
        "verifier_attempted": any(bool(item.get("verifier_attempted")) for item in reviewed_items),
        "verifier_retry_attempted": any(bool(item.get("verifier_retry_attempted")) for item in reviewed_items),
        "summary": build_summary(reviewed_items),
        "workflow_outcome_summary": workflow_outcome_summary,
        "items": reviewed_items,
    }
    path.write_text(json.dumps(payload, indent=2, default=str))


def main() -> None:
    args = parse_args()
    input_path = args.input.resolve()
    output_path = args.output.resolve()
    csv_path = derive_csv_path(args.csv, output_path)

    if args.max_items is not None and args.max_items <= 0:
        raise SystemExit("--max-items must be greater than 0")

    if not 0.0 <= args.temperature <= 1.0:
        raise SystemExit("--temperature must be between 0.0 and 1.0")

    audit_payload = load_audit_report(input_path)
    rows = select_rows(audit_payload, args.include_medium, args.only_link_id, args.max_items)

    if not rows:
        print("No audit items matched the requested review filters.")
        return

    output_path.parent.mkdir(parents=True, exist_ok=True)
    if csv_path:
        csv_path.parent.mkdir(parents=True, exist_ok=True)

    print("Future Bill Link AI Review")
    print(f"Input report: {input_path}")
    print(f"Selected items: {len(rows)}")
    print(f"Senior model: {args.model}")
    print(f"Verifier model: {args.verifier_model}")
    print(f"Fallback model: {args.fallback_model}")
    print(f"Senior timeout: {args.senior_timeout}s")
    print(f"Verifier timeout: {args.verifier_timeout}s")
    print(f"Dry run: {'yes' if args.dry_run else 'no'}")

    reviewed_items = []
    for index, row in enumerate(rows, start=1):
        print(
            f"[{index}/{len(rows)}] Reviewing future_bill_link_id={row['future_bill_link_id']} "
            f"{row['bill_number']} ({row['risk_level']})"
        )
        reviewed_items.append(
            review_row(
                row,
                model=args.model,
                verifier_model=args.verifier_model,
                fallback_model=args.fallback_model,
                openai_base_url=args.openai_base_url,
                senior_timeout_seconds=args.senior_timeout,
                verifier_timeout_seconds=args.verifier_timeout,
                temperature=args.temperature,
                dry_run=args.dry_run,
            )
        )
        latest_item = reviewed_items[-1]
        print(
            "  -> "
            f"backend={latest_item['review_backend']} "
            f"effective_model={latest_item.get('effective_model') or 'none'} "
            f"retry_count={latest_item.get('retry_count', 0)} "
            f"senior_attempted={'yes' if latest_item.get('senior_attempted') else 'no'} "
            f"senior_retry={'yes' if latest_item.get('senior_retry_attempted') else 'no'} "
            f"verifier_attempted={'yes' if latest_item.get('verifier_attempted') else 'no'} "
            f"verifier_retry={'yes' if latest_item.get('verifier_retry_attempted') else 'no'}"
        )

    write_json_report(
        output_path,
        input_path,
        args.model,
        args.verifier_model,
        args.fallback_model,
        args.include_medium,
        args.dry_run,
        args.senior_timeout,
        args.verifier_timeout,
        reviewed_items,
    )
    print(f"Wrote JSON report to {output_path}")

    if csv_path:
        write_csv_report(csv_path, reviewed_items)
        print(f"Wrote CSV report to {csv_path}")

    summary = build_summary(reviewed_items)
    workflow_outcome_summary = build_workflow_outcome_summary(reviewed_items)
    print(
        "Summary: "
        f"keep_direct={summary['keep_direct_count']} | "
        f"change_to_partial={summary['change_to_partial_count']} | "
        f"remove_link={summary['remove_link_count']} | "
        f"review_manually={summary['review_manually_count']} | "
        f"fallbacks={summary['fallback_count']}"
    )
    print("=== WORKFLOW SUMMARY ===")
    print(f"AI Status: {workflow_outcome_summary['ai_status']['run_status'].upper()}")
    print(
        f"Fallback Used: {workflow_outcome_summary['ai_status']['fallback_used']}/"
        f"{workflow_outcome_summary['ai_status']['total_items']}"
    )
    print(
        "Decisions: "
        f"{workflow_outcome_summary['decisions']['kept']} kept, "
        f"{workflow_outcome_summary['decisions']['modified']} modified, "
        f"{workflow_outcome_summary['decisions']['removed']} removed, "
        f"{workflow_outcome_summary['decisions']['manual_review']} manual review"
    )
    print(f"Confidence: {workflow_outcome_summary['confidence_level'].upper()}")
    print(f"Next Step: {workflow_outcome_summary['next_step']}")


if __name__ == "__main__":
    main()
