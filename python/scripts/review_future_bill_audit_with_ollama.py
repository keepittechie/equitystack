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


DEFAULT_OLLAMA_URL = "http://10.10.0.60:11434"
DEFAULT_MODEL = "qwen3.5:latest"
FALLBACK_MODELS = ["qwen3:latest", "llama3.2:latest"]
DEFAULT_TIMEOUT = 90
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
        description="Run a rubric-based Ollama review over the existing future bill link audit report."
    )
    parser.add_argument("--input", type=Path, default=get_default_input_path(), help="Path to future_bill_link_audit.json")
    parser.add_argument("--output", type=Path, default=get_default_output_path(), help="Path to write the AI review JSON report")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="Ollama model name")
    parser.add_argument("--include-medium", action="store_true", help="Review medium-risk items in addition to high-risk items")
    parser.add_argument("--max-items", type=int, help="Limit the number of items reviewed after filtering")
    parser.add_argument("--only-link-id", type=int, help="Review only a single future_bill_link_id")
    parser.add_argument("--dry-run", action="store_true", help="Skip Ollama calls and emit placeholder manual-review rows")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT, help="Request timeout in seconds for each Ollama call")
    parser.add_argument("--temperature", type=float, default=DEFAULT_TEMPERATURE, help="Sampling temperature passed to Ollama")
    parser.add_argument(
        "--csv",
        nargs="?",
        const="",
        help="Optionally write a CSV review file. Pass a path or omit the value to derive one from --output.",
    )
    parser.add_argument("--ollama-url", default=DEFAULT_OLLAMA_URL, help="Base URL for the Ollama server")
    return parser.parse_args()


def load_audit_report(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text())
    if not isinstance(data, dict):
        raise ValueError("Audit report must be a JSON object")
    return data


def fetch_available_models(ollama_url: str, timeout_seconds: int) -> list[str]:
    response = requests.get(
        f"{ollama_url.rstrip('/')}/api/tags",
        timeout=timeout_seconds,
    )
    response.raise_for_status()
    payload = response.json()
    models = []
    for model in payload.get("models") or []:
        name = model.get("name")
        if isinstance(name, str) and name.strip():
            models.append(name.strip())
    return models


def preferred_model_candidates(requested_model: str) -> list[str]:
    candidates = [requested_model, *FALLBACK_MODELS]
    family = re.match(r"[a-z]+", requested_model.lower())
    family_name = family.group(0) if family else requested_model.split(":", 1)[0].lower()
    if family_name == "qwen":
        candidates.extend(["qwen3:latest"])
    elif family_name == "llama":
        candidates.extend(["llama3.2:latest"])
    return candidates


def resolve_model_name(requested_model: str, available_models: list[str]) -> tuple[str, str | None]:
    available_set = {name.lower(): name for name in available_models}
    if requested_model.lower() in available_set:
        return available_set[requested_model.lower()], None

    for candidate in preferred_model_candidates(requested_model):
        if candidate.lower() in available_set:
            return available_set[candidate.lower()], candidate

    prefix_match = re.match(r"[a-z]+", requested_model.lower())
    requested_prefix = prefix_match.group(0) if prefix_match else requested_model.split(":", 1)[0].lower()
    for name in available_models:
        candidate_prefix_match = re.match(r"[a-z]+", name.lower())
        candidate_prefix = candidate_prefix_match.group(0) if candidate_prefix_match else name.split(":", 1)[0].lower()
        if candidate_prefix == requested_prefix:
            return name, name

    return requested_model, None


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
- If problem_alignment is 0 and population_alignment is 0, strongly prefer remove_link."""


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
        "- Score each rubric dimension from 0 to 3.\n"
        "- Recompute total_score as the sum of the five dimension scores.\n"
        "- Use the score bands as guidance, but follow the override rules.\n"
        "- Be decisive. If the Direct link is clearly wrong, prefer remove_link or change_to_partial.\n"
        "- Use review_manually only when evidence is genuinely insufficient or unusually ambiguous.\n"
        "- Keep reasoning_short to one short paragraph or less.\n"
        "- The JSON must exactly use these keys:\n"
        f"{json.dumps(schema, indent=2, ensure_ascii=True)}"
    )


def call_ollama(prompt: str, model: str, ollama_url: str, timeout_seconds: int, temperature: float) -> str:
    response = requests.post(
        f"{ollama_url.rstrip('/')}/api/generate",
        json={
            "model": model,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {
                "temperature": temperature,
                "seed": DEFAULT_SEED,
            },
        },
        timeout=timeout_seconds,
    )
    try:
        response.raise_for_status()
    except requests.HTTPError as error:
        body = response.text.strip()
        if len(body) > 500:
            body = body[:500] + "..."
        raise requests.HTTPError(
            f"{error}. Response body: {body}",
            response=response,
            request=response.request,
        ) from error
    payload = response.json()
    body = payload.get("response")
    if not isinstance(body, str) or not body.strip():
        raise ValueError("Ollama response did not contain a non-empty JSON string")
    return body


def parse_json_response(text: str) -> dict[str, Any]:
    candidate = text.strip()
    if candidate.startswith("```"):
        candidate = re.sub(r"^```(?:json)?\s*", "", candidate)
        candidate = re.sub(r"\s*```$", "", candidate)

    start = candidate.find("{")
    end = candidate.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON object found in Ollama response")

    parsed = json.loads(candidate[start : end + 1])
    if not isinstance(parsed, dict):
        raise ValueError("Ollama response JSON must be an object")
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
        "llm_reasoning_short": normalize_whitespace(raw.get("reasoning_short"))[:400],
        "llm_suggested_new_link_type": normalize_link_type(raw.get("suggested_new_link_type"), decision),
        "llm_recommended_action": normalize_action(raw.get("recommended_action"), decision),
    }

    if not normalized["llm_reasoning_short"]:
        normalized["llm_reasoning_short"] = (
            f"Model response for future_bill_link_id {row['future_bill_link_id']} did not include usable reasoning."
        )

    return apply_post_processing(row, normalized, heuristics)


def review_row(
    row: dict[str, Any],
    model: str,
    ollama_url: str,
    timeout_seconds: int,
    temperature: float,
    dry_run: bool,
) -> dict[str, Any]:
    heuristics = build_heuristic_context(row)
    timestamp = datetime.now(UTC).isoformat()

    if dry_run:
        normalized = fallback_review(row, "Dry run mode skipped the Ollama review call.", heuristics)
    else:
        prompt = build_prompt(row, heuristics)
        errors: list[str] = []
        normalized: dict[str, Any] | None = None

        for _attempt in range(2):
            try:
                raw_text = call_ollama(prompt, model, ollama_url, timeout_seconds, temperature)
                raw_payload = parse_json_response(raw_text)
                normalized = normalize_model_result(raw_payload, row, heuristics)
                break
            except (json.JSONDecodeError, requests.RequestException, ValueError) as error:
                errors.append(str(error))

        if normalized is None:
            normalized = fallback_review(
                row,
                f"Ollama response could not be normalized after one retry: {' | '.join(errors)}",
                heuristics,
            )

    return {
        "future_bill_link_id": row["future_bill_link_id"],
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
        "llm_reasoning_short": normalized["llm_reasoning_short"],
        "llm_suggested_new_link_type": normalized["llm_suggested_new_link_type"],
        "llm_recommended_action": normalized["llm_recommended_action"],
        "final_decision": normalized["final_decision"],
        "recommended_action": normalized["recommended_action"],
        "suggested_new_link_type": normalized["suggested_new_link_type"],
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

    return summary


def derive_csv_path(csv_arg: str | None, output_path: Path) -> Path | None:
    if csv_arg is None:
        return None
    if csv_arg == "":
        return output_path.with_suffix(".csv")
    return Path(csv_arg).resolve()


def write_csv_report(path: Path, reviewed_items: list[dict[str, Any]]) -> None:
    fieldnames = [
        "future_bill_link_id",
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
    resolved_model: str,
    include_medium: bool,
    dry_run: bool,
    reviewed_items: list[dict[str, Any]],
) -> None:
    payload = {
        "generated_at": datetime.now(UTC).isoformat(),
        "input_report": str(input_path),
        "requested_model": requested_model,
        "resolved_model": resolved_model,
        "fallback_models": FALLBACK_MODELS,
        "review_scope": "high_and_medium_risk" if include_medium else "high_risk_only",
        "dry_run": dry_run,
        "summary": build_summary(reviewed_items),
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

    if args.timeout <= 0:
        raise SystemExit("--timeout must be greater than 0")

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

    resolved_model = args.model
    if not args.dry_run:
        available_models = fetch_available_models(args.ollama_url, args.timeout)
        resolved_model, matched_candidate = resolve_model_name(args.model, available_models)
        if resolved_model != args.model:
            print(f"Requested model {args.model} not found. Using {resolved_model} instead.")
        elif matched_candidate is None and args.model not in available_models:
            print(
                "Requested model was not found on the Ollama server.",
                file=sys.stderr,
            )
            print(
                f"Available models: {', '.join(available_models) or 'none reported'}",
                file=sys.stderr,
            )
            raise SystemExit(1)

    print("Future Bill Link AI Review")
    print(f"Input report: {input_path}")
    print(f"Selected items: {len(rows)}")
    print(f"Model: {resolved_model}")
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
                model=resolved_model,
                ollama_url=args.ollama_url,
                timeout_seconds=args.timeout,
                temperature=args.temperature,
                dry_run=args.dry_run,
            )
        )

    write_json_report(
        output_path,
        input_path,
        args.model,
        resolved_model,
        args.include_medium,
        args.dry_run,
        reviewed_items,
    )
    print(f"Wrote JSON report to {output_path}")

    if csv_path:
        write_csv_report(csv_path, reviewed_items)
        print(f"Wrote CSV report to {csv_path}")

    summary = build_summary(reviewed_items)
    print(
        "Summary: "
        f"keep_direct={summary['keep_direct_count']} | "
        f"change_to_partial={summary['change_to_partial_count']} | "
        f"remove_link={summary['remove_link_count']} | "
        f"review_manually={summary['review_manually_count']}"
    )


if __name__ == "__main__":
    main()
