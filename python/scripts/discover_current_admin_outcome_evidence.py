#!/usr/bin/env python3
import argparse
import json
import re
from datetime import UTC, datetime
from difflib import SequenceMatcher
from pathlib import Path
from types import SimpleNamespace
from typing import Any

from current_admin_common import (
    derive_csv_path,
    get_current_admin_reports_dir,
    normalize_nullable_text,
    normalize_text,
    print_json,
    write_csv_rows,
)
from current_admin_outcome_evidence_common import (
    ARTIFACT_VERSION,
    batch_name_from_input,
    default_output_path,
    write_outcome_evidence_artifact,
)
from discover_current_admin_updates import (
    DEFAULT_PRESIDENT_SLUG,
    build_source_reference_note,
    classify_feed_item_context,
    confidence_title_case,
    fetch_default_live_source_items,
    fetch_remote_feed_items,
    load_local_feed_items,
    normalize_feed_date,
    normalize_string_list,
    score_discovery_candidate,
    sort_and_limit_feed_items,
)


DEFAULT_SOURCE_CONFIG = Path(__file__).resolve().parents[1] / "config" / "current_admin_outcome_sources.json"
READINESS_IMPACT_STATUSES = {"impact_pending", "impact_review_ready"}
OUTCOME_SIGNAL_HINTS = {
    "awarded",
    "awards",
    "allocated",
    "allocation",
    "distributed",
    "settlement",
    "settlements",
    "recovered",
    "compliance review",
    "resolved",
    "restored",
    "disbursed",
    "issued grants",
    "grant awards",
    "enrollment",
    "participation",
    "referral",
    "referrals",
    "suspension",
    "suspensions",
}
EVIDENCE_MATCH_STOPWORDS = {
    "action",
    "actions",
    "administration",
    "agency",
    "agencies",
    "agreement",
    "compliance",
    "date",
    "department",
    "effective",
    "federal",
    "guidance",
    "initiative",
    "notice",
    "office",
    "policies",
    "policy",
    "process",
    "program",
    "programs",
    "project",
    "public",
    "review",
    "rulemaking",
    "service",
    "services",
    "state",
    "states",
    "system",
}
STRONG_MATCH_MIN = 80
REVIEW_MATCH_MIN = 60
WEAK_MATCH_MIN = 40
SOURCE_QUALITY_HIGH_HOSTS = {
    "justice.gov",
    "ed.gov",
    "hud.gov",
    "eeoc.gov",
    "dol.gov",
    "cfpb.gov",
    "epa.gov",
    "usda.gov",
    "federalregister.gov",
    "usaspending.gov",
    "supremecourt.gov",
}
LOW_SIGNAL_HINTS = {
    "speech",
    "remarks",
    "testimony",
    "hearing",
    "op-ed",
    "op ed",
    "commentary",
    "campaign",
    "press gaggle",
    "town hall",
}
IMPLEMENTATION_SIGNAL_HINTS = OUTCOME_SIGNAL_HINTS | {
    "final rule",
    "proposed rule",
    "rulemaking",
    "effective date",
    "effective immediately",
    "notice",
    "rescission",
    "waiver",
    "guidance",
    "implementation",
    "funding",
    "obligation",
    "grant",
    "grants",
    "award",
    "awards",
    "compliance review",
    "resolution agreement",
    "consent decree",
    "settlement",
    "settlements",
    "injunction",
    "stayed",
    "ruled",
    "appealed",
}
LAWSUIT_PROGRESS_HINTS = {
    "injunction",
    "stayed",
    "stay",
    "ruled",
    "appealed",
    "dismissed",
    "settlement",
    "settlements",
    "consent decree",
    "resolution agreement",
    "order",
}
AGENCY_HINTS = {
    "Department of Justice Civil Rights Division": [
        "department of justice",
        "justice department",
        "doj",
        "civil rights division",
        "housing and civil enforcement section",
        "educational opportunities section",
        "special litigation section",
        "voting section",
        "justice.gov/crt",
    ],
    "Department of Justice Federal Bureau of Investigation": [
        "federal bureau of investigation",
        "fbi",
        "criminal justice information services",
        "cjis",
    ],
    "Department of Education Office for Civil Rights": [
        "department of education",
        "office for civil rights",
        "office for civil rights reading room",
        "resolution agreement",
        "resolution letter",
        "ocr",
        "ed.gov",
    ],
    "Department of Housing and Urban Development Office of Fair Housing and Equal Opportunity": [
        "office of fair housing and equal opportunity",
        "fheo",
        "fair housing and equal opportunity",
        "fair housing enforcement",
    ],
    "Department of Housing and Urban Development": [
        "department of housing and urban development",
        "hud",
        "fair housing",
    ],
    "Equal Employment Opportunity Commission": [
        "equal employment opportunity commission",
        "eeoc",
    ],
    "Department of Labor Office of Federal Contract Compliance Programs": [
        "office of federal contract compliance programs",
        "ofccp",
        "conciliation agreement",
        "federal contract compliance",
    ],
    "Department of Labor Employment and Training Administration": [
        "employment and training administration",
        "eta",
        "registered apprenticeship",
        "workforce innovation and opportunity act",
    ],
    "Department of Labor": [
        "department of labor",
        "dol",
        "wage and hour",
    ],
    "Consumer Financial Protection Bureau": [
        "consumer financial protection bureau",
        "cfpb",
        "fair lending",
        "redlining",
    ],
    "Environmental Protection Agency": [
        "environmental protection agency",
        "epa",
        "environmental justice",
        "office of environmental justice and external civil rights",
        "external civil rights compliance office",
        "title vi complaint",
    ],
    "Department of Agriculture": [
        "department of agriculture",
        "usda",
        "office of assistant secretary for civil rights",
        "discrimination financial assistance program",
        "dfap",
        "farm service agency",
    ],
    "Federal Register": [
        "federal register",
    ],
    "USAspending": [
        "usaspending",
        "grant award",
        "federal award",
    ],
}
PROGRAM_HINTS = {
    "Voting rights": ["voting rights", "ballot access", "election integrity", "proof of citizenship", "paper ballot"],
    "School discipline": ["school discipline", "discipline guidance", "student discipline", "disciplinary"],
    "School choice": ["school choice", "education freedom", "educational freedom"],
    "HBCU": ["hbcu", "historically black colleges", "historically black college", "historically black universities"],
    "Title VI": ["title vi"],
    "Title IX": ["title ix"],
    "Section 504": ["section 504"],
    "Fair housing": ["fair housing", "housing discrimination", "redlining"],
    "Local law enforcement": ["law enforcement", "police department", "policing", "public safety"],
    "Skilled trades and apprenticeship": [
        "high-paying skilled trade jobs",
        "preparing americans for high-paying skilled trade jobs",
        "registered apprenticeship program",
        "registered apprenticeship and workforce grant programs",
        "apprenticeship expansion",
        "apprenticeship grants",
        "apprenticeship usa"
    ],
    "Accreditation": ["accreditation", "accreditor", "student outcomes"],
    "Critical medicines": ["critical medicines", "essential medicines", "drug manufacturing", "pharmaceutical supply chain"],
    "Civil commitment and encampments": ["civil commitment", "street encampments", "encampments", "homelessness"],
    "DEI and equity programs": ["dei", "diversity equity inclusion", "equity program"],
}
MECHANISM_HINTS = {
    "enforcement": ["enforcement", "investigation", "compliance", "conciliation"],
    "settlement": ["settlement", "settlements", "consent decree", "resolution agreement"],
    "funding": ["funding", "grant", "award", "allocation", "obligation", "disbursed"],
    "rulemaking": ["rulemaking", "final rule", "proposed rule", "notice", "effective date", "rescission"],
    "guidance": ["guidance", "memorandum", "directive"],
    "litigation": ["lawsuit", "complaint", "injunction", "appeal", "stay", "ruled", "dismissed"],
    "measurement": ["data", "report", "metrics", "enrollment", "participation", "outcome", "referral"],
}
JURISDICTION_HINTS = {
    "federal": ["federal", "nationwide", "national"],
    "state": ["state", "states", "statewide"],
    "local": ["local", "city", "county", "municipal"],
    "school districts": ["school district", "school districts"],
    "colleges and universities": ["college", "university", "campus"],
    "HBCUs": ["hbcu", "historically black colleges", "historically black universities"],
    "police departments": ["police department", "law enforcement agency", "sheriff"],
    "housing providers": ["landlord", "landlords", "housing authority", "mortgage lender", "lender"],
    "employers": ["employer", "employers", "workplace", "contractor", "contractors"],
}
AFFECTED_GROUP_HINTS = {
    "Black Americans": ["black americans", "black communities", "black community"],
    "Black voters": ["black voters", "black-majority communities", "voter registration", "ballot access"],
    "Black students": ["black students", "students of color", "racial disparities"],
    "Black workers": ["black workers", "job seekers", "applicants", "employees"],
    "Black families": ["black families", "families"],
    "Black borrowers and homeowners": ["black borrowers", "homeowners", "renters", "borrowers"],
    "Black patients": ["black patients", "patients", "community health"],
    "Black farmers": ["black farmers", "farmers", "producers"],
}
SOURCE_FAMILY_HINTS = {
    "doj_civil_rights": ["voting rights", "policing", "law enforcement", "civil rights", "public accommodations"],
    "education_ocr": ["education", "school", "school discipline", "hbcu", "title vi", "title ix", "section 504", "accreditation"],
    "hud_fair_housing": ["housing", "fair housing", "redlining", "homelessness"],
    "eeoc_enforcement": ["employment", "workforce", "retaliation", "hiring", "promotion"],
    "dol_enforcement": ["labor", "wage", "contractor", "workplace", "compliance"],
    "dol_workforce_programs": ["registered apprenticeship", "workforce innovation and opportunity act", "training", "allotment", "grant"],
    "cfpb_fair_lending": ["lending", "borrower", "redlining", "consumer finance", "mortgage"],
    "epa_civil_rights": ["environmental", "title vi complaint", "permitting", "community health"],
    "usda_civil_rights": ["farm", "agriculture", "rural", "usda", "farm lending"],
    "federal_register": ["rulemaking", "notice", "effective date", "rescission", "final rule", "proposed rule"],
    "grants_execution": ["grant", "award", "allocation", "obligation", "funding"],
}
SOURCE_FAMILY_ALIASES = {
    "federal_register_justice": "federal_register",
    "federal_register_justice_civil_rights": "doj_civil_rights",
    "federal_register_education": "federal_register",
    "federal_register_education_civil_rights": "education_ocr",
    "federal_register_hud": "federal_register",
    "federal_register_hud_implementation": "hud_fair_housing",
    "federal_register_labor": "federal_register",
    "federal_register_labor_workforce": "dol_workforce_programs",
    "federal_register_epa": "federal_register",
    "federal_register_usda": "federal_register",
    "federal_register_usda_civil_rights": "usda_civil_rights",
    "federal_register_hhs": "federal_register",
    "dol_ofccp": "dol_enforcement",
    "dol_workforce_programs": "dol_workforce_programs",
    "cfpb_enforcement": "cfpb_fair_lending",
}
GENERIC_TOPIC_LABELS = {
    "Education",
    "Economic Opportunity",
    "Criminal Justice",
    "Housing",
    "Healthcare",
    "Voting Rights",
    "Transportation Security / Workforce",
}
POLICY_QUERY_TERM_EXPANSIONS = {
    "encampment": [
        "encampment clearance policy",
        "civil commitment homelessness enforcement",
        "street-order responses",
        "homelessness enforcement guidance",
    ],
    "civil commitment": [
        "civil commitment homelessness enforcement",
        "street-order responses",
    ],
    "skilled trade": [
        "high-paying skilled trade jobs of the future",
        "registered apprenticeship expansion",
        "registered apprenticeship modernization",
        "apprenticeship grant funding",
    ],
    "apprenticeship": [
        "registered apprenticeship expansion",
        "registered apprenticeship system guidance",
        "apprenticeship grant funding",
    ],
    "school discipline": [
        "common sense school discipline policies",
        "student discipline guidance",
        "discipline disparate impact guidance",
    ],
    "hbcu": [
        "hbcu excellence and innovation",
        "historically black colleges and universities initiative",
        "white house initiative on hbcus",
    ],
    "law enforcement": [
        "state and local law enforcement support",
        "restore law and order policing",
        "local policing support",
    ],
    "proof of citizenship": [
        "proof of citizenship election order",
        "paper ballot safeguards",
        "election integrity order",
    ],
    "paper-ballot": [
        "paper ballot safeguards",
        "election integrity order",
    ],
    "school choice": [
        "education freedom initiative",
        "school choice guidance",
        "education freedom programs",
    ],
    "educational freedom": [
        "education freedom initiative",
        "school choice guidance",
    ],
    "accreditation": [
        "accreditation reform student outcomes",
        "higher education accreditor guidance",
    ],
    "critical medicines": [
        "critical medicines production",
        "domestic pharmaceutical supply chain",
        "essential medicines manufacturing",
    ],
    "dei": [
        "dei program rescission",
        "equity program termination",
        "anti-dei guidance",
    ],
}
BROAD_RELEVANCE_TITLE_HINTS = {
    "unemployment insurance weekly claims report",
    "national apprenticeship week",
}
BROAD_RELEVANCE_SUMMARY_HINTS = {
    "advance figure for seasonally adjusted initial claims",
    "4-week moving average",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Collect read-only implementation and outcome evidence for existing current-admin records."
    )
    parser.add_argument("--input", type=Path, action="append", help="Current-admin batch or queue artifact to inspect. May be repeated.")
    parser.add_argument("--president-slug", default=DEFAULT_PRESIDENT_SLUG, help="Presidency term slug to analyze")
    parser.add_argument("--output", type=Path, help="Outcome evidence artifact output path")
    parser.add_argument(
        "--source-config",
        type=Path,
        default=DEFAULT_SOURCE_CONFIG,
        help="JSON source configuration for outcome-evidence collection",
    )
    parser.add_argument(
        "--disable-default-sources",
        action="store_true",
        help="Disable configured default live sources and use only explicit --feed-url/--feed-json inputs",
    )
    parser.add_argument("--feed-url", action="append", help="Optional RSS/Atom feed URL to inspect")
    parser.add_argument("--feed-json", action="append", type=Path, help="Optional local JSON file with feed-like items")
    parser.add_argument("--timeout", type=int, default=30, help="Per-request timeout in seconds")
    parser.add_argument("--max-feed-items", type=int, default=30, help="Cap the number of fetched evidence items")
    parser.add_argument("--include-all-statuses", action="store_true", help="Include records outside impact_pending / impact_review_ready")
    parser.add_argument(
        "--include-weak",
        action="store_true",
        help="Retain weak matches in the artifact for inspection. Weak matches remain non-actionable and do not affect readiness counts.",
    )
    parser.add_argument("--only-record-key", action="append", help="Limit output to one or more specific record keys or slugs")
    parser.add_argument(
        "--csv",
        nargs="?",
        const="",
        help="Optionally write a CSV summary. Pass a path or omit the value to derive one from --output.",
    )
    return parser.parse_args()


def current_timestamp() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


def discover_default_inputs() -> list[Path]:
    reports_dir = get_current_admin_reports_dir()
    queue_paths = sorted(reports_dir.glob("*.manual-review-queue.json"), key=lambda path: path.stat().st_mtime, reverse=True)
    if queue_paths:
        return [queue_paths[0]]
    normalized_paths = sorted(reports_dir.glob("*.normalized.json"), key=lambda path: path.stat().st_mtime, reverse=True)
    if normalized_paths:
        return [normalized_paths[0]]
    return []


def normalize_impact_status(value: Any) -> str | None:
    text = normalize_nullable_text(value)
    if text is None:
        return None
    normalized = text.lower().replace(" ", "_").replace("-", "_")
    return normalized


def record_title(record: dict[str, Any]) -> str | None:
    return normalize_nullable_text(record.get("title")) or normalize_nullable_text(record.get("slug"))


def extract_records_from_artifact(path: Path, *, include_all_statuses: bool) -> tuple[str | None, str | None, list[dict[str, Any]]]:
    payload = path.read_text()
    raw = json.loads(payload)
    records: list[dict[str, Any]] = []
    batch_name = None
    president_slug = None

    if isinstance(raw, dict):
        batch_name = normalize_nullable_text(raw.get("batch_name"))
        president_slug = normalize_nullable_text(raw.get("president_slug"))
        if isinstance(raw.get("items"), list):
            for item in raw.get("items") or []:
                if not isinstance(item, dict):
                    continue
                record = item.get("final_record") if isinstance(item.get("final_record"), dict) else item.get("record")
                if not isinstance(record, dict):
                    continue
                impact_status = normalize_impact_status(
                    record.get("impact_status")
                    or item.get("impact_status")
                    or (item.get("ai_review") or {}).get("impact_status")
                    or ((item.get("suggestions") or {}).get("impact_status"))
                )
                if not include_all_statuses and impact_status not in READINESS_IMPACT_STATUSES:
                    continue
                records.append(
                    {
                        "record_key": normalize_nullable_text(record.get("slug") or item.get("slug") or item.get("item_id")),
                        "slug": normalize_nullable_text(record.get("slug") or item.get("slug")),
                        "title": record_title(record),
                        "topic": normalize_nullable_text(record.get("topic")),
                        "impact_status": impact_status,
                        "source_artifact": str(path),
                        "record": record,
                    }
                )
        elif isinstance(raw.get("records"), list):
            for record in raw.get("records") or []:
                if not isinstance(record, dict):
                    continue
                impact_status = normalize_impact_status(record.get("impact_status"))
                if not include_all_statuses and impact_status not in READINESS_IMPACT_STATUSES:
                    continue
                records.append(
                    {
                        "record_key": normalize_nullable_text(record.get("slug")),
                        "slug": normalize_nullable_text(record.get("slug")),
                        "title": record_title(record),
                        "topic": normalize_nullable_text(record.get("topic")),
                        "impact_status": impact_status,
                        "source_artifact": str(path),
                        "record": record,
                    }
                )

    return batch_name, president_slug, [record for record in records if record.get("record_key")]


def load_input_records(paths: list[Path], *, include_all_statuses: bool) -> tuple[str | None, str, list[dict[str, Any]], list[dict[str, Any]]]:
    records: list[dict[str, Any]] = []
    skipped_inputs: list[dict[str, Any]] = []
    batch_name = None
    president_slug = DEFAULT_PRESIDENT_SLUG
    seen_keys: set[str] = set()

    for path in paths:
        if not path.exists():
            skipped_inputs.append({"path": str(path), "reason": "input artifact not found"})
            continue
        try:
            artifact_batch_name, artifact_president_slug, artifact_records = extract_records_from_artifact(
                path,
                include_all_statuses=include_all_statuses,
            )
        except Exception as exc:  # noqa: BLE001
            skipped_inputs.append({"path": str(path), "reason": normalize_text(str(exc))})
            continue
        if batch_name is None and artifact_batch_name:
            batch_name = artifact_batch_name
        if artifact_president_slug:
            president_slug = artifact_president_slug
        for record in artifact_records:
            key = record["record_key"]
            if key in seen_keys:
                continue
            seen_keys.add(key)
            records.append(record)

    return batch_name, president_slug, records, skipped_inputs


def promise_like_records(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows = []
    for item in records:
        record = item["record"]
        rows.append(
            {
                "slug": item.get("slug"),
                "title": item.get("title"),
                "summary": normalize_nullable_text(record.get("summary")) or normalize_nullable_text(record.get("notes")),
                "topic": item.get("topic"),
                "status": record.get("status"),
                "latest_action_date": normalize_nullable_text(
                    (((record.get("actions") or [{}])[0]).get("action_date"))
                ),
                "record": record,
                "record_key": item.get("record_key"),
            }
        )
    return rows


def compact_text_list(values: list[str]) -> list[str]:
    compacted = []
    seen: set[str] = set()
    for value in values:
        text = normalize_nullable_text(value)
        if not text:
            continue
        lowered = text.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        compacted.append(text)
    return compacted


def compact_lower_text_list(values: list[str]) -> list[str]:
    return [
        value.lower()
        for value in compact_text_list(values)
        if normalize_nullable_text(value)
    ]


def evidence_match_tokens(text: Any) -> set[str]:
    from discover_current_admin_updates import tokenize

    return {token for token in tokenize(text) if token not in EVIDENCE_MATCH_STOPWORDS}


def normalized_lookup(values: list[str]) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for value in values:
        text = normalize_nullable_text(value)
        if not text:
            continue
        key = normalize_text(text).lower()
        if not key or key in mapping:
            continue
        mapping[key] = text
    return mapping


def overlap_labels(left: list[str], right: list[str]) -> list[str]:
    left_map = normalized_lookup(left)
    right_keys = set(normalized_lookup(right))
    return [label for key, label in left_map.items() if key in right_keys]


def fuzzy_similarity(left: Any, right: Any) -> float:
    left_text = normalize_text(left).lower()
    right_text = normalize_text(right).lower()
    if not left_text or not right_text:
        return 0.0
    return SequenceMatcher(None, left_text, right_text).ratio()


def text_contains_phrase(haystack: str, phrase: str) -> bool:
    phrase_text = normalize_text(phrase).lower()
    if not phrase_text:
        return False
    return re.search(rf"(?<![a-z0-9]){re.escape(phrase_text)}(?![a-z0-9])", haystack) is not None


def extract_canonical_hints(text: Any, hints: dict[str, list[str]]) -> list[str]:
    haystack = normalize_text(text).lower()
    if not haystack:
        return []
    matches = []
    for label, phrases in hints.items():
        if any(text_contains_phrase(haystack, phrase) for phrase in phrases):
            matches.append(label)
    return matches


def explicit_source_family_match(record_text: Any, record_topic: Any, source_family: str | None) -> bool:
    family = normalize_nullable_text(source_family)
    if not family:
        return False
    canonical_family = SOURCE_FAMILY_ALIASES.get(family.lower(), family.lower())
    phrases = SOURCE_FAMILY_HINTS.get(canonical_family) or []
    haystack = normalize_text(" ".join([normalize_text(record_text), normalize_text(record_topic)])).lower()
    return any(text_contains_phrase(haystack, phrase) for phrase in phrases)


def parse_iso_date(value: Any) -> datetime | None:
    text = normalize_feed_date(value) if value else None
    if not text:
        return None
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def cleaned_policy_title(value: Any) -> str | None:
    text = normalize_nullable_text(value)
    if not text:
        return None
    cleaned = re.sub(r"^(Fact Sheet:|Agenda47:)\s*", "", text, flags=re.IGNORECASE)
    cleaned = re.sub(r"^President Donald J\. Trump\s+", "", cleaned, flags=re.IGNORECASE)
    return normalize_nullable_text(cleaned)


def record_text_fragments(record: dict[str, Any], promise_like_record: dict[str, Any]) -> list[str]:
    record_payload = record.get("record") or {}
    fragments = [
        promise_like_record.get("title"),
        promise_like_record.get("summary"),
        promise_like_record.get("topic"),
        normalize_nullable_text(record_payload.get("notes")),
        normalize_nullable_text(record_payload.get("black_community_impact_note")),
        normalize_nullable_text(record_payload.get("impacted_group")),
    ]
    for action in (record_payload.get("actions") or [])[:6]:
        if not isinstance(action, dict):
            continue
        fragments.extend(
            [
                normalize_nullable_text(action.get("title")),
                normalize_nullable_text(action.get("summary")),
                normalize_nullable_text(action.get("description")),
                normalize_nullable_text(action.get("action_type")),
            ]
        )
    for outcome in (record_payload.get("outcomes") or [])[:6]:
        if not isinstance(outcome, dict):
            continue
        fragments.extend(
            [
                normalize_nullable_text(outcome.get("title")),
                normalize_nullable_text(outcome.get("summary")),
                normalize_nullable_text(outcome.get("description")),
                normalize_nullable_text(outcome.get("outcome_text")),
                normalize_nullable_text(outcome.get("impact_note")),
            ]
        )
    return compact_text_list([fragment for fragment in fragments if fragment])


def record_source_fragments(record_payload: dict[str, Any]) -> list[str]:
    discovery_context = record_payload.get("discovery_context") if isinstance(record_payload.get("discovery_context"), dict) else {}
    linked_snapshot = discovery_context.get("linked_promise_snapshot") if isinstance(discovery_context.get("linked_promise_snapshot"), dict) else {}
    fragments = []
    for source in (record_payload.get("promise_sources") or [])[:6]:
        if not isinstance(source, dict):
            continue
        fragments.extend(
            [
                normalize_nullable_text(source.get("source_title")),
                normalize_nullable_text(source.get("publisher")),
                normalize_nullable_text(source.get("notes")),
            ]
        )
    for source in (discovery_context.get("preserved_discovery_sources") or [])[:6]:
        if not isinstance(source, dict):
            continue
        fragments.extend(
            [
                normalize_nullable_text(source.get("source_title")),
                normalize_nullable_text(source.get("publisher")),
                normalize_nullable_text(source.get("notes")),
            ]
        )
    for candidate in (discovery_context.get("selected_candidates") or [])[:4]:
        if not isinstance(candidate, dict):
            continue
        fragments.extend(
            [
                normalize_nullable_text(candidate.get("reasoning")),
                normalize_nullable_text(candidate.get("classification_reason")),
                *normalize_string_list(candidate.get("matched_keywords")),
            ]
        )
        for source in (candidate.get("source_references") or [])[:4]:
            if not isinstance(source, dict):
                continue
            fragments.extend(
                [
                    normalize_nullable_text(source.get("source_title")),
                    normalize_nullable_text(source.get("publisher")),
                    normalize_nullable_text(source.get("notes")),
                ]
            )
    fragments.extend(
        [
            normalize_nullable_text(linked_snapshot.get("title")),
            normalize_nullable_text(linked_snapshot.get("summary")),
            normalize_nullable_text(linked_snapshot.get("topic")),
        ]
    )
    return compact_text_list([fragment for fragment in fragments if fragment])


def record_source_dates(record_payload: dict[str, Any]) -> list[str]:
    discovery_context = record_payload.get("discovery_context") if isinstance(record_payload.get("discovery_context"), dict) else {}
    dates: list[str] = []
    for source in (record_payload.get("promise_sources") or [])[:8]:
        if isinstance(source, dict):
            dates.append(normalize_feed_date(source.get("published_date") or source.get("source_date")) or "")
    for source in (discovery_context.get("preserved_discovery_sources") or [])[:8]:
        if isinstance(source, dict):
            dates.append(normalize_feed_date(source.get("published_date") or source.get("source_date")) or "")
    for candidate in (discovery_context.get("selected_candidates") or [])[:6]:
        if not isinstance(candidate, dict):
            continue
        for source in (candidate.get("source_references") or [])[:6]:
            if isinstance(source, dict):
                dates.append(normalize_feed_date(source.get("published_date") or source.get("source_date")) or "")
    return [value for value in dates if value]


def record_exact_phrases(record: dict[str, Any], promise_like_record: dict[str, Any]) -> list[str]:
    record_payload = record.get("record") or {}
    discovery_context = record_payload.get("discovery_context") if isinstance(record_payload.get("discovery_context"), dict) else {}
    linked_snapshot = discovery_context.get("linked_promise_snapshot") if isinstance(discovery_context.get("linked_promise_snapshot"), dict) else {}
    phrases = [
        normalize_nullable_text(promise_like_record.get("title")),
        normalize_nullable_text(linked_snapshot.get("title")),
    ]
    for action in (record_payload.get("actions") or [])[:4]:
        if isinstance(action, dict):
            phrases.append(normalize_nullable_text(action.get("title")))
    for source in (discovery_context.get("preserved_discovery_sources") or [])[:4]:
        if isinstance(source, dict):
            phrases.append(normalize_nullable_text(source.get("source_title")))
    for candidate in (discovery_context.get("selected_candidates") or [])[:4]:
        if not isinstance(candidate, dict):
            continue
        for source in (candidate.get("source_references") or [])[:4]:
            if isinstance(source, dict):
                phrases.append(normalize_nullable_text(source.get("source_title")))
    return [
        phrase.lower()
        for phrase in compact_text_list([phrase for phrase in phrases if phrase])
        if len((phrase or "").split()) >= 2
    ]


def generate_policy_query_terms(record: dict[str, Any], promise_like_record: dict[str, Any]) -> list[str]:
    record_payload = record.get("record") or {}
    discovery_context = record_payload.get("discovery_context") if isinstance(record_payload.get("discovery_context"), dict) else {}
    linked_snapshot = discovery_context.get("linked_promise_snapshot") if isinstance(discovery_context.get("linked_promise_snapshot"), dict) else {}
    base_titles = compact_text_list(
        [
            cleaned_policy_title(promise_like_record.get("title")),
            cleaned_policy_title(linked_snapshot.get("title")),
            *[
                cleaned_policy_title(source.get("source_title"))
                for source in (discovery_context.get("preserved_discovery_sources") or [])[:4]
                if isinstance(source, dict)
            ],
            *[
                cleaned_policy_title(source.get("source_title"))
                for candidate in (discovery_context.get("selected_candidates") or [])[:4]
                if isinstance(candidate, dict)
                for source in (candidate.get("source_references") or [])[:4]
                if isinstance(source, dict)
            ],
        ]
    )
    query_terms = list(base_titles)
    combined = normalize_text(
        " ".join(
            [
                record.get("slug") or "",
                promise_like_record.get("title") or "",
                linked_snapshot.get("title") or "",
                *(base_titles or []),
            ]
        )
    ).lower()
    for trigger, expansions in POLICY_QUERY_TERM_EXPANSIONS.items():
        if trigger in combined:
            query_terms.extend(expansions)
    agencies = extract_canonical_hints(combined, AGENCY_HINTS)
    programs = extract_canonical_hints(combined, PROGRAM_HINTS)
    for agency in agencies[:2]:
        for program in programs[:3]:
            query_terms.append(f"{agency} {program}")
    return [
        term
        for term in compact_text_list(query_terms)
        if len((term or "").split()) >= 2 and term not in GENERIC_TOPIC_LABELS
    ]


def policy_query_hits(record_profile: dict[str, Any], feed_profile: dict[str, Any]) -> list[str]:
    feed_text = feed_profile.get("text") or ""
    return [
        term
        for term in (record_profile.get("policy_query_terms") or [])
        if len(term.split()) >= 2 and text_contains_phrase(feed_text, term)
    ]


def feed_metadata_fragments(feed_item: dict[str, Any]) -> list[str]:
    return compact_text_list(
        [
            normalize_nullable_text(feed_item.get("source_family")),
            normalize_nullable_text(feed_item.get("evidence_type")),
            normalize_nullable_text(feed_item.get("target_agency")),
            normalize_nullable_text(feed_item.get("target_program")),
            normalize_nullable_text(feed_item.get("mechanism_of_effect")),
            normalize_nullable_text(feed_item.get("affected_institutions")),
            normalize_nullable_text(feed_item.get("court_or_agency")),
            normalize_nullable_text(feed_item.get("legal_status")),
        ]
    )


def build_record_profile(record: dict[str, Any], promise_like_record: dict[str, Any]) -> dict[str, Any]:
    record_payload = record.get("record") or {}
    discovery_context = record_payload.get("discovery_context") if isinstance(record_payload.get("discovery_context"), dict) else {}
    linked_snapshot = discovery_context.get("linked_promise_snapshot") if isinstance(discovery_context.get("linked_promise_snapshot"), dict) else {}
    text_fragments = record_text_fragments(record, promise_like_record)
    source_fragments = record_source_fragments(record_payload)
    query_terms = generate_policy_query_terms(record, promise_like_record)
    linked_snapshot_fragments = compact_text_list(
        [
            normalize_nullable_text(linked_snapshot.get("title")),
            normalize_nullable_text(linked_snapshot.get("summary")),
            normalize_nullable_text(linked_snapshot.get("topic")),
            normalize_nullable_text(linked_snapshot.get("status")),
        ]
    )
    combined_text = normalize_text(" ".join([*text_fragments, *source_fragments, *query_terms])).lower()
    source_dates = record_source_dates(record_payload)
    anchor_candidates = [
        normalize_feed_date(promise_like_record.get("latest_action_date")),
        normalize_feed_date(record_payload.get("promise_date")),
        normalize_feed_date(linked_snapshot.get("latest_action_date")),
        normalize_feed_date(linked_snapshot.get("promise_date")),
        *source_dates,
    ]
    anchor_date = max((value for value in anchor_candidates if value), default=None)
    return {
        "record_key": normalize_nullable_text(record.get("record_key")),
        "slug": normalize_nullable_text(record.get("slug")),
        "title": normalize_nullable_text(promise_like_record.get("title")),
        "title_variants": compact_text_list(
            [
                normalize_nullable_text(promise_like_record.get("title")),
                normalize_nullable_text(linked_snapshot.get("title")),
                *query_terms,
                *record_exact_phrases(record, promise_like_record),
            ]
        ),
        "text": combined_text,
        "tokens": evidence_match_tokens(combined_text),
        "topics": compact_text_list(
            [
                normalize_nullable_text(promise_like_record.get("topic")),
                *extract_canonical_hints(combined_text, PROGRAM_HINTS),
            ]
        ),
        "programs": compact_text_list(extract_canonical_hints(combined_text, PROGRAM_HINTS)),
        "agencies": compact_text_list(extract_canonical_hints(combined_text, AGENCY_HINTS)),
        "mechanisms": compact_text_list(extract_canonical_hints(combined_text, MECHANISM_HINTS)),
        "jurisdictions": compact_text_list(extract_canonical_hints(combined_text, JURISDICTION_HINTS)),
        "affected_groups": compact_text_list(extract_canonical_hints(combined_text, AFFECTED_GROUP_HINTS)),
        "promise_id": normalize_nullable_text(record_payload.get("id") or promise_like_record.get("id") or linked_snapshot.get("id")),
        "policy_id": normalize_nullable_text(
            record_payload.get("policy_id") or record_payload.get("id") or promise_like_record.get("id") or linked_snapshot.get("id")
        ),
        "anchor_date": anchor_date,
        "topic": normalize_nullable_text(promise_like_record.get("topic")),
        "linked_slug": normalize_nullable_text((discovery_context.get("linked_promise_slug") or linked_snapshot.get("slug"))),
        "linked_snapshot_fragments": linked_snapshot_fragments,
        "policy_query_terms": compact_lower_text_list(query_terms),
    }


def build_feed_profile(feed_item: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    raw_text = normalize_text(
        " ".join(
            [
                feed_item.get("title") or "",
                feed_item.get("summary") or "",
                feed_item.get("publisher") or "",
                feed_item.get("source_name") or "",
                feed_item.get("source_category") or "",
                feed_item.get("target_agency") or "",
                feed_item.get("target_program") or "",
                feed_item.get("mechanism_of_effect") or "",
                feed_item.get("affected_institutions") or "",
                feed_item.get("funding_signal") or "",
            ]
        )
    ).lower()
    return {
        "title": normalize_nullable_text(feed_item.get("title")),
        "summary": normalize_nullable_text(feed_item.get("summary")),
        "text": raw_text,
        "tokens": evidence_match_tokens(raw_text),
        "topics": compact_text_list(
            [
                *normalize_string_list(feed_item.get("topic_tags")),
                normalize_nullable_text(context.get("topic_estimate")),
                *extract_canonical_hints(raw_text, PROGRAM_HINTS),
            ]
        ),
        "agencies": compact_text_list(
            [
                normalize_nullable_text(context.get("target_agency")),
                normalize_nullable_text(context.get("court_or_agency")),
                *extract_canonical_hints(raw_text, AGENCY_HINTS),
            ]
        ),
        "programs": compact_text_list(
            [
                normalize_nullable_text(context.get("target_program")),
                *extract_canonical_hints(raw_text, PROGRAM_HINTS),
            ]
        ),
        "mechanisms": compact_text_list(
            [
                normalize_nullable_text(context.get("mechanism_of_effect")),
                normalize_nullable_text(context.get("funding_signal")),
                normalize_nullable_text(context.get("implementation_stage")),
                *extract_canonical_hints(raw_text, MECHANISM_HINTS),
            ]
        ),
        "jurisdictions": compact_text_list(
            [
                normalize_nullable_text(context.get("affected_institutions")),
                *extract_canonical_hints(raw_text, JURISDICTION_HINTS),
            ]
        ),
        "affected_groups": compact_text_list(extract_canonical_hints(raw_text, AFFECTED_GROUP_HINTS)),
        "source_family": normalize_nullable_text(feed_item.get("source_family")),
        "published_at": normalize_feed_date(feed_item.get("published_at")),
    }


def title_match_component(record_profile: dict[str, Any], feed_profile: dict[str, Any]) -> tuple[int, list[str], list[str]]:
    feed_text = feed_profile.get("text") or ""
    exact_phrase_hits = [
        phrase
        for phrase in (record_profile.get("title_variants") or [])
        if phrase and len(phrase.split()) >= 2 and phrase.lower() in feed_text
    ]
    comparison_titles = compact_text_list(
        [
            normalize_nullable_text(record_profile.get("title")),
            *normalize_string_list(record_profile.get("title_variants")),
            *normalize_string_list(record_profile.get("linked_snapshot_fragments")),
        ]
    )
    best_ratio = 0.0
    best_label = normalize_nullable_text(record_profile.get("title")) or normalize_nullable_text(record_profile.get("slug"))
    for candidate_title in comparison_titles:
        best_candidate_ratio = max(
            [
                fuzzy_similarity(candidate_title, feed_profile.get("title")),
                fuzzy_similarity(candidate_title, feed_profile.get("summary")),
            ]
        )
        if best_candidate_ratio > best_ratio:
            best_ratio = best_candidate_ratio
            best_label = candidate_title
    best_ratio = max(
        best_ratio,
        fuzzy_similarity((record_profile.get("slug") or "").replace("-", " "), feed_profile.get("title")),
    )
    if exact_phrase_hits:
        return 26, [f"Exact title or action phrase matched: {exact_phrase_hits[0]}"], []
    if best_ratio >= 0.86:
        return 22, [f"High title similarity to tracked source text ({best_ratio:.2f}): {best_label}"], []
    if best_ratio >= 0.72:
        return 16, [f"Moderate title similarity to tracked source text ({best_ratio:.2f}): {best_label}"], []
    if best_ratio >= 0.58:
        return 10, [f"Partial title similarity to tracked source text ({best_ratio:.2f}): {best_label}"], []
    return 0, [], ["Title similarity is weak"]


def policy_relevance_guard(
    feed_item: dict[str, Any],
    record_profile: dict[str, Any],
    feed_profile: dict[str, Any],
    *,
    query_hits: list[str],
    date_window_match: dict[str, Any],
    title_points: int,
) -> str | None:
    title = normalize_text(feed_item.get("title")).lower()
    summary = normalize_text(feed_item.get("summary")).lower()
    if title in BROAD_RELEVANCE_TITLE_HINTS and not query_hits:
        return "Broad agency update lacks any policy-specific query-term linkage"
    if any(hint in summary for hint in BROAD_RELEVANCE_SUMMARY_HINTS) and not query_hits:
        return "General statistical or administrative release is not directly tied to the tracked policy language"
    days_delta = date_window_match.get("days_delta")
    if days_delta is not None and abs(int(days_delta)) > 365 and not query_hits and title_points < 16:
        return "Evidence falls well outside the policy action window without explicit policy-language linkage"
    return None


def direct_source_quality_component(feed_item: dict[str, Any], context: dict[str, Any]) -> tuple[int, str, str]:
    source_url = (normalize_nullable_text(feed_item.get("url")) or "").lower()
    trust_level = (normalize_nullable_text(feed_item.get("trust_level")) or "").lower()
    evidence_type = (normalize_nullable_text(feed_item.get("evidence_type")) or "").lower()
    host_match = any(host in source_url for host in SOURCE_QUALITY_HIGH_HOSTS)
    if trust_level == "official_primary" and (
        host_match
        or evidence_type in {"enforcement_release", "final_rule", "proposed_rule", "grant_award", "settlement", "consent_decree"}
        or context.get("is_enforcement_action")
    ):
        return 14, "high", "Primary official source quality is strong"
    if trust_level == "official_primary" or host_match:
        return 10, "medium", "Official source quality is usable"
    if evidence_type in {"case_inventory", "reading_room_resource"}:
        return 6, "medium", "Official reference material provides moderate source quality"
    return 0, "low", "Source quality is weak for outcome-evidence matching"


def compute_date_window_match(record_profile: dict[str, Any], feed_profile: dict[str, Any]) -> tuple[int, dict[str, Any], list[str], list[str]]:
    record_dt = parse_iso_date(record_profile.get("anchor_date"))
    evidence_dt = parse_iso_date(feed_profile.get("published_at"))
    if not evidence_dt:
        return 0, {"matched": False, "record_anchor_date": record_profile.get("anchor_date"), "evidence_date": None, "days_delta": None}, [], [
            "Evidence item is missing a normalized publication date"
        ]
    if not record_dt:
        return 0, {
            "matched": False,
            "record_anchor_date": record_profile.get("anchor_date"),
            "evidence_date": feed_profile.get("published_at"),
            "days_delta": None,
        }, [], ["Tracked record has no anchor date for date-window scoring"]
    days_delta = (evidence_dt.date() - record_dt.date()).days
    if -30 <= days_delta <= 540:
        return 5, {
            "matched": True,
            "record_anchor_date": record_profile.get("anchor_date"),
            "evidence_date": feed_profile.get("published_at"),
            "days_delta": days_delta,
        }, [f"Evidence date falls in the relevant window ({days_delta} days from anchor date)"], []
    if -120 <= days_delta <= 730:
        return 2, {
            "matched": True,
            "record_anchor_date": record_profile.get("anchor_date"),
            "evidence_date": feed_profile.get("published_at"),
            "days_delta": days_delta,
        }, [f"Evidence date is loosely aligned with the tracked record ({days_delta} days)"], []
    return 0, {
        "matched": False,
        "record_anchor_date": record_profile.get("anchor_date"),
        "evidence_date": feed_profile.get("published_at"),
        "days_delta": days_delta,
    }, [], [f"Evidence date falls outside the strongest policy window ({days_delta} days)"]


def generic_keyword_component(record_profile: dict[str, Any], feed_profile: dict[str, Any]) -> tuple[int, list[str], list[str]]:
    record_tokens = record_profile.get("tokens") or set()
    feed_tokens = feed_profile.get("tokens") or set()
    if not record_tokens or not feed_tokens:
        return 0, [], []
    overlap = feed_tokens & record_tokens
    if not overlap:
        return 0, [], []
    ratio = len(overlap) / max(len(feed_tokens), 1)
    if ratio >= 0.35:
        return 3, [f"Generic keyword overlap is strong ({ratio:.2f})"], []
    if ratio >= 0.18:
        return 2, [f"Generic keyword overlap is moderate ({ratio:.2f})"], []
    return 1, [f"Generic keyword overlap is light ({ratio:.2f})"], []


def has_implementation_signal(feed_item: dict[str, Any], context: dict[str, Any]) -> bool:
    combined = normalize_text(
        " ".join(
            [
                feed_item.get("title") or "",
                feed_item.get("summary") or "",
                context.get("implementation_stage") or "",
                context.get("mechanism_of_effect") or "",
                context.get("funding_signal") or "",
                feed_item.get("evidence_type") or "",
            ]
        )
    ).lower()
    if context.get("is_enforcement_action") or context.get("funding_signal") or normalize_nullable_text(context.get("implementation_stage")):
        return True
    return any(token in combined for token in IMPLEMENTATION_SIGNAL_HINTS)


def evidence_has_measurable_signal(feed_item: dict[str, Any], context: dict[str, Any]) -> bool:
    combined = normalize_text(
        " ".join(
            [
                feed_item.get("title") or "",
                feed_item.get("summary") or "",
                context.get("implementation_stage") or "",
                context.get("mechanism_of_effect") or "",
            ]
        )
    ).lower()
    if any(token in combined for token in OUTCOME_SIGNAL_HINTS):
        return True
    return any(character.isdigit() for character in combined)


def low_signal_reason(feed_item: dict[str, Any], context: dict[str, Any]) -> str | None:
    combined = normalize_text(
        " ".join(
            [
                feed_item.get("title") or "",
                feed_item.get("summary") or "",
                feed_item.get("source_type") or "",
                feed_item.get("evidence_type") or "",
                feed_item.get("source_category") or "",
            ]
        )
    ).lower()
    source_type = (normalize_nullable_text(feed_item.get("source_type")) or "").lower()
    if any(hint in combined for hint in LOW_SIGNAL_HINTS) and not (
        context.get("is_formal_action") or context.get("is_enforcement_action") or has_implementation_signal(feed_item, context)
    ):
        return "Low-signal speech, testimony, campaign, or commentary item without a clear official action hook"
    if source_type in {"commentary", "campaign"}:
        return "Commentary or campaign material is not outcome evidence unless tied to a concrete official action"
    if source_type == "news" and not (
        context.get("is_formal_action")
        or context.get("is_enforcement_action")
        or has_implementation_signal(feed_item, context)
        or evidence_has_measurable_signal(feed_item, context)
    ):
        return "Generic news coverage without implementation or measurable outcome signal is excluded"
    if context.get("is_lawsuit_only") and not (
        any(token in combined for token in LAWSUIT_PROGRESS_HINTS)
        or context.get("is_enforcement_action")
        or evidence_has_measurable_signal(feed_item, context)
    ):
        return "Lawsuit-only item lacks a ruling, stay, settlement, injunction, or implementation effect"
    if not (
        has_implementation_signal(feed_item, context)
        or context.get("is_enforcement_action")
        or evidence_has_measurable_signal(feed_item, context)
        or context.get("legal_status") in {"injunction", "stayed", "ruled", "appealed", "dismissed"}
    ):
        return "Announcement lacks implementation, enforcement, funding, rulemaking, or measurable outcome signal"
    return None


def classify_evidence_kind(feed_item: dict[str, Any], context: dict[str, Any], match_bucket: str) -> tuple[str, str]:
    if match_bucket == "ignore":
        return "ignore", "The evidence item does not align strongly enough with a tracked current-admin record."
    if context["is_oversight_related"] and not context["is_enforcement_action"]:
        return "source_context", "Oversight material can support research context but does not establish implementation or outcome by itself."
    if context["is_legal_related"] and not context["is_enforcement_action"]:
        return "legal_context", "Court and litigation items remain legal context unless they clearly document enforcement or implementation effects."
    if evidence_has_measurable_signal(feed_item, context):
        return "outcome_evidence", "The item appears to contain downstream implementation or measurable-effect evidence."
    if has_implementation_signal(feed_item, context) or context["is_formal_action"] or context["is_enforcement_action"]:
        return "implementation_evidence", "The item appears to document implementation, rulemaking, funding, or enforcement activity."
    return "source_context", "The item provides related official context but does not yet look like implementation or measurable outcome evidence."


def evidence_readiness(match: dict[str, Any]) -> str:
    kind = match.get("evidence_kind")
    score = int(match.get("confidence_score") or 0)
    bucket = match.get("match_bucket")
    if bucket == "weak_match":
        return "review_only_weak_match"
    if kind == "outcome_evidence" and score >= 60:
        return "ready_for_impact_evaluate"
    if kind == "implementation_evidence" and score >= 50:
        return "implementation_evidence_present"
    if kind in {"legal_context", "source_context"}:
        return "context_only"
    return "needs_more_evidence"


def match_bucket_from_score(score: int) -> str:
    if score >= STRONG_MATCH_MIN:
        return "strong_match"
    if score >= REVIEW_MATCH_MIN:
        return "review_match"
    if score >= WEAK_MATCH_MIN:
        return "weak_match"
    return "ignore"


def recommended_next_action(evidence_kind: str, match_bucket: str) -> str:
    if match_bucket in {"ignore", "weak_match"}:
        return "ignore_low_signal"
    if evidence_kind == "outcome_evidence":
        return "review_for_outcome_maturation"
    if evidence_kind == "implementation_evidence":
        return "review_for_implementation_update"
    if evidence_kind == "legal_context":
        return "judicial_context_only"
    return "attach_as_source_context"


def best_matching_action_id(record: dict[str, Any], feed_item: dict[str, Any]) -> str | None:
    record_payload = record.get("record") or {}
    feed_text = normalize_text(" ".join([feed_item.get("title") or "", feed_item.get("summary") or ""])).lower()
    best_ratio = 0.0
    best_id = None
    for action in record_payload.get("actions") or []:
        if not isinstance(action, dict):
            continue
        action_id = normalize_nullable_text(action.get("id"))
        action_title = normalize_nullable_text(action.get("title"))
        if not action_id or not action_title:
            continue
        ratio = max(
            fuzzy_similarity(action_title, feed_item.get("title")),
            1.0 if action_title.lower() in feed_text and len(action_title.split()) >= 2 else 0.0,
        )
        if ratio >= 0.58 and ratio > best_ratio:
            best_ratio = ratio
            best_id = action_id
    return best_id


def compute_scored_match(feed_item: dict[str, Any], record: dict[str, Any], promise_like_record: dict[str, Any]) -> dict[str, Any]:
    context = classify_feed_item_context(feed_item)
    record_profile = build_record_profile(record, promise_like_record)
    feed_profile = build_feed_profile(feed_item, context)

    reasons: list[str] = []
    warnings: list[str] = []
    score = 0
    structural_signal_count = 0
    high_confidence_signal_count = 0
    supporting_signal_count = 0

    title_points, title_reasons, title_warnings = title_match_component(record_profile, feed_profile)
    score += title_points
    reasons.extend(title_reasons)
    warnings.extend(title_warnings)
    if title_points >= 16:
        high_confidence_signal_count += 1

    topic_overlap = overlap_labels(record_profile.get("topics") or [], feed_profile.get("topics") or [])
    non_generic_topic_overlap = [label for label in topic_overlap if label not in GENERIC_TOPIC_LABELS]
    if topic_overlap:
        score += 10
        reasons.append(f"Shared topic overlap: {', '.join(topic_overlap[:3])}")
        if non_generic_topic_overlap:
            supporting_signal_count += 1

    agency_overlap = overlap_labels(record_profile.get("agencies") or [], feed_profile.get("agencies") or [])
    if agency_overlap:
        score += 10
        structural_signal_count += 1
        supporting_signal_count += 1
        reasons.append(f"Shared agency overlap: {', '.join(agency_overlap[:2])}")

    program_overlap = overlap_labels(record_profile.get("programs") or [], feed_profile.get("programs") or [])
    if program_overlap:
        score += 16
        structural_signal_count += 1
        high_confidence_signal_count += 1
        reasons.append(f"Shared program overlap: {', '.join(program_overlap[:3])}")

    mechanism_overlap = overlap_labels(record_profile.get("mechanisms") or [], feed_profile.get("mechanisms") or [])
    if mechanism_overlap:
        score += 8
        structural_signal_count += 1
        supporting_signal_count += 1
        reasons.append(f"Shared mechanism of effect: {', '.join(mechanism_overlap[:3])}")

    jurisdiction_overlap = overlap_labels(record_profile.get("jurisdictions") or [], feed_profile.get("jurisdictions") or [])
    if jurisdiction_overlap:
        score += 4
        structural_signal_count += 1
        supporting_signal_count += 1
        reasons.append(f"Shared jurisdiction or institution overlap: {', '.join(jurisdiction_overlap[:3])}")

    affected_group_overlap = overlap_labels(record_profile.get("affected_groups") or [], feed_profile.get("affected_groups") or [])
    if affected_group_overlap:
        score += 4
        supporting_signal_count += 1
        reasons.append(f"Affected-group overlap detected: {', '.join(affected_group_overlap[:3])}")

    source_family_match = explicit_source_family_match(record_profile.get("text"), record_profile.get("topic"), feed_profile.get("source_family"))
    if source_family_match:
        structural_signal_count += 1
        supporting_signal_count += 1
        reasons.append(f"Source family aligns with the tracked topic: {feed_profile.get('source_family')}")

    source_quality_points, evidence_strength, source_quality_reason = direct_source_quality_component(feed_item, context)
    score += source_quality_points
    reasons.append(source_quality_reason)

    date_points, date_window_match, date_reasons, date_warnings = compute_date_window_match(record_profile, feed_profile)
    score += date_points
    reasons.extend(date_reasons)
    warnings.extend(date_warnings)

    keyword_points, keyword_reasons, keyword_warnings = generic_keyword_component(record_profile, feed_profile)
    score += keyword_points
    reasons.extend(keyword_reasons)
    warnings.extend(keyword_warnings)

    low_signal = low_signal_reason(feed_item, context)
    if low_signal:
        warnings.append(low_signal)
        score = min(score, 39)

    query_hits = policy_query_hits(record_profile, feed_profile)
    if query_hits:
        reasons.append(f"Policy-aware query terms matched: {', '.join(query_hits[:3])}")

    policy_relevance_warning = policy_relevance_guard(
        feed_item,
        record_profile,
        feed_profile,
        query_hits=query_hits,
        date_window_match=date_window_match,
        title_points=title_points,
    )
    if policy_relevance_warning:
        warnings.append(policy_relevance_warning)
        score = min(score, 45 if query_hits else 39)

    if structural_signal_count == 0 and score >= REVIEW_MATCH_MIN:
        warnings.append("No structural match beyond generic text was found; capping to weak match")
        score = min(score, 59)

    if keyword_points > 0 and title_points == 0 and structural_signal_count == 0:
        warnings.append("Only generic keyword overlap was detected")
        score = min(score, 39 if low_signal else 45)

    if score >= STRONG_MATCH_MIN and high_confidence_signal_count == 0:
        warnings.append(
            "Strong match requires a high-confidence title, program, case, rule, or grant signal; capping to review_match"
        )
        score = min(score, REVIEW_MATCH_MIN + 19)

    if score >= STRONG_MATCH_MIN and supporting_signal_count == 0:
        warnings.append("Strong match requires a supporting signal beyond title or program similarity; capping to review_match")
        score = min(score, REVIEW_MATCH_MIN + 19)

    if high_confidence_signal_count == 0 and agency_overlap and not non_generic_topic_overlap and not mechanism_overlap and not jurisdiction_overlap and not affected_group_overlap and not source_family_match:
        warnings.append("Agency-only overlap cannot produce a strong or review-ready implementation match")
        score = min(score, 59)

    if high_confidence_signal_count == 0 and non_generic_topic_overlap and not agency_overlap and not mechanism_overlap and not jurisdiction_overlap and not affected_group_overlap and not source_family_match:
        warnings.append("Topic-only overlap cannot produce a strong implementation match without another structural signal")
        score = min(score, 59)

    score = max(0, min(100, score))
    match_bucket = match_bucket_from_score(score)
    evidence_kind, classification_reason = classify_evidence_kind(feed_item, context, match_bucket)
    support_fraction = max(0.0, min(1.0, score / 100.0))
    deterministic_confidence = score_discovery_candidate(
        feed_item=feed_item,
        context=context,
        matched_promise=promise_like_record,
        match_score=support_fraction,
        topic=record.get("topic") or context.get("topic_estimate"),
        suggestion_type="update_existing_action" if evidence_kind in {"implementation_evidence", "outcome_evidence"} else evidence_kind,
    )
    return {
        "context": context,
        "match_score": score,
        "match_bucket": match_bucket,
        "match_reasons": compact_text_list(reasons)[:6],
        "match_warnings": compact_text_list(warnings)[:6],
        "policy_query_hits": compact_lower_text_list(query_hits)[:4],
        "topic_overlap": topic_overlap[:4],
        "agency_overlap": agency_overlap[:3],
        "program_overlap": program_overlap[:4],
        "jurisdiction_overlap": jurisdiction_overlap[:4],
        "date_window_match": date_window_match,
        "mechanism_overlap": mechanism_overlap[:4],
        "affected_group_overlap": affected_group_overlap[:4],
        "source_family_match": source_family_match,
        "evidence_strength": evidence_strength,
        "evidence_kind": evidence_kind,
        "classification_reason": classification_reason,
        "confidence": deterministic_confidence,
        "matched_promise_id": record_profile.get("promise_id"),
        "matched_policy_id": record_profile.get("policy_id"),
        "matched_action_id": best_matching_action_id(record, feed_item),
        "policy_query_terms": record_profile.get("policy_query_terms") or [],
    }


def build_match(
    feed_item: dict[str, Any],
    record: dict[str, Any],
    promise_like_record: dict[str, Any],
    *,
    include_weak: bool,
) -> dict[str, Any] | None:
    scored = compute_scored_match(feed_item, record, promise_like_record)
    if scored["match_bucket"] == "ignore":
        return None
    if scored["match_bucket"] == "weak_match" and not include_weak:
        return None

    context = scored["context"]
    deterministic_confidence = scored["confidence"]
    match = {
        "title": normalize_nullable_text(feed_item.get("title")),
        "url": normalize_nullable_text(feed_item.get("url")),
        "published_at": normalize_feed_date(feed_item.get("published_at")),
        "summary": normalize_nullable_text(feed_item.get("summary")),
        "source_name": normalize_nullable_text(feed_item.get("source_name")),
        "source_type": normalize_nullable_text(feed_item.get("source_type")),
        "source_category": normalize_nullable_text(feed_item.get("source_category")),
        "publisher": normalize_nullable_text(feed_item.get("publisher")),
        "source_family": normalize_nullable_text(feed_item.get("source_family")),
        "evidence_type": normalize_nullable_text(feed_item.get("evidence_type")),
        "topic_tags": normalize_string_list(feed_item.get("topic_tags")),
        "trust_level": normalize_nullable_text(feed_item.get("trust_level")),
        "default_match_strength": normalize_nullable_text(feed_item.get("default_match_strength")),
        "evidence_kind": scored["evidence_kind"],
        "match_score": scored["match_score"],
        "match_bucket": scored["match_bucket"],
        "match_reasons": scored["match_reasons"],
        "match_warnings": scored["match_warnings"],
        "policy_query_terms": scored["policy_query_terms"],
        "policy_query_hits": scored["policy_query_hits"],
        "matched_topic_tags": scored["topic_overlap"],
        "topic_overlap": scored["topic_overlap"],
        "agency_overlap": scored["agency_overlap"],
        "program_overlap": scored["program_overlap"],
        "jurisdiction_overlap": scored["jurisdiction_overlap"],
        "date_window_match": scored["date_window_match"],
        "mechanism_overlap": scored["mechanism_overlap"],
        "affected_group_overlap": scored["affected_group_overlap"],
        "source_family_match": scored["source_family_match"],
        "evidence_strength": scored["evidence_strength"],
        "matched_policy_id": scored["matched_policy_id"],
        "matched_promise_id": scored["matched_promise_id"],
        "matched_action_id": scored["matched_action_id"],
        "evidence_title": normalize_nullable_text(feed_item.get("title")),
        "evidence_url": normalize_nullable_text(feed_item.get("url")),
        "evidence_date": normalize_feed_date(feed_item.get("published_at")),
        "recommended_next_action": recommended_next_action(scored["evidence_kind"], scored["match_bucket"]),
        "confidence": confidence_title_case(deterministic_confidence["confidence_level"]),
        "confidence_score": deterministic_confidence["confidence_score"],
        "confidence_level": deterministic_confidence["confidence_level"],
        "confidence_reasons": deterministic_confidence["confidence_reasons"],
        "confidence_penalties": deterministic_confidence["confidence_penalties"],
        "classification_reason": scored["classification_reason"],
        "legal_status": context.get("legal_status"),
        "court_or_agency": context.get("court_or_agency"),
        "target_agency": context.get("target_agency"),
        "target_program": context.get("target_program"),
        "implementation_stage": context.get("implementation_stage"),
        "mechanism_of_effect": context.get("mechanism_of_effect"),
        "funding_signal": context.get("funding_signal"),
        "affected_institutions": context.get("affected_institutions"),
        "source_reference": {
            "source_title": feed_item.get("title"),
            "source_url": feed_item.get("url"),
            "source_type": feed_item.get("source_type"),
            "publisher": feed_item.get("publisher") or feed_item.get("source_name"),
            "published_date": normalize_feed_date(feed_item.get("published_at")),
            "notes": build_source_reference_note(
                feed_item=feed_item,
                suggestion_type=scored["evidence_kind"],
                legal_status=context.get("legal_status") or "unknown",
                court_or_agency=context.get("court_or_agency"),
                docket_number=context.get("docket_number"),
                implementation_stage=context.get("implementation_stage"),
                target_agency=context.get("target_agency"),
                mechanism_of_effect=context.get("mechanism_of_effect"),
                funding_signal=context.get("funding_signal"),
            ),
        },
    }
    match["readiness"] = evidence_readiness(match)
    return match


def summarize_record_matches(record: dict[str, Any], matches: list[dict[str, Any]]) -> dict[str, Any]:
    actionable_matches = [match for match in matches if match.get("match_bucket") in {"strong_match", "review_match"}]
    counts = {
        "implementation_evidence": sum(match["evidence_kind"] == "implementation_evidence" for match in actionable_matches),
        "outcome_evidence": sum(match["evidence_kind"] == "outcome_evidence" for match in actionable_matches),
        "source_context": sum(match["evidence_kind"] == "source_context" for match in actionable_matches),
        "legal_context": sum(match["evidence_kind"] == "legal_context" for match in actionable_matches),
    }
    bucket_counts = {
        "strong_match": sum(match.get("match_bucket") == "strong_match" for match in matches),
        "review_match": sum(match.get("match_bucket") == "review_match" for match in matches),
        "weak_match": sum(match.get("match_bucket") == "weak_match" for match in matches),
    }
    best_confidence_score = max((int(match.get("confidence_score") or 0) for match in actionable_matches), default=0)
    best_match_score = max((int(match.get("match_score") or 0) for match in actionable_matches), default=0)
    top_match = actionable_matches[0] if actionable_matches else (matches[0] if matches else None)
    if counts["outcome_evidence"] > 0:
        recommended_next_action = "run_impact_evaluate_dry_run"
    elif counts["implementation_evidence"] > 0:
        recommended_next_action = "collect_more_outcome_evidence"
    elif counts["legal_context"] > 0:
        recommended_next_action = "monitor_legal_context"
    elif bucket_counts["weak_match"] > 0:
        recommended_next_action = "review_weak_matches_only_if_needed"
    else:
        recommended_next_action = "no_actionable_evidence_found"
    return {
        "record_key": record.get("record_key"),
        "slug": record.get("slug"),
        "title": record.get("title"),
        "topic": record.get("topic"),
        "previous_impact_status": record.get("impact_status"),
        "source_artifact": record.get("source_artifact"),
        "best_confidence_score": best_confidence_score,
        "best_match_score": best_match_score,
        "confidence_level": confidence_title_case("high" if best_confidence_score >= 75 else "medium" if best_confidence_score >= 50 else "low"),
        "implementation_evidence_count": counts["implementation_evidence"],
        "outcome_evidence_count": counts["outcome_evidence"],
        "source_context_count": counts["source_context"],
        "legal_context_count": counts["legal_context"],
        "strong_match_count": bucket_counts["strong_match"],
        "review_match_count": bucket_counts["review_match"],
        "weak_match_count": bucket_counts["weak_match"],
        "matched_policy_id": (top_match or {}).get("matched_policy_id"),
        "matched_promise_id": (top_match or {}).get("matched_promise_id"),
        "matched_action_id": (top_match or {}).get("matched_action_id"),
        "recommended_next_action": recommended_next_action,
        "activation_mode": "active_read_only",
        "matched_evidence_items": matches,
    }


def build_csv_rows(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows = []
    for item in items:
        for match in item.get("matched_evidence_items") or []:
            rows.append(
                {
                    "record_key": item.get("record_key"),
                    "slug": item.get("slug"),
                    "title": item.get("title"),
                    "topic": item.get("topic"),
                    "previous_impact_status": item.get("previous_impact_status"),
                    "evidence_kind": match.get("evidence_kind"),
                    "recommended_next_action": match.get("recommended_next_action"),
                    "published_at": match.get("published_at"),
                    "confidence_score": match.get("confidence_score"),
                    "confidence_level": match.get("confidence_level"),
                    "match_score": match.get("match_score"),
                    "match_bucket": match.get("match_bucket"),
                    "match_reasons": "; ".join(match.get("match_reasons") or []),
                    "match_warnings": "; ".join(match.get("match_warnings") or []),
                    "matched_policy_id": match.get("matched_policy_id"),
                    "matched_promise_id": match.get("matched_promise_id"),
                    "matched_action_id": match.get("matched_action_id"),
                    "matched_topic_tags": ", ".join(match.get("matched_topic_tags") or []),
                    "topic_overlap": ", ".join(match.get("topic_overlap") or []),
                    "agency_overlap": ", ".join(match.get("agency_overlap") or []),
                    "program_overlap": ", ".join(match.get("program_overlap") or []),
                    "mechanism_overlap": ", ".join(match.get("mechanism_overlap") or []),
                    "jurisdiction_overlap": ", ".join(match.get("jurisdiction_overlap") or []),
                    "affected_group_overlap": ", ".join(match.get("affected_group_overlap") or []),
                    "source_family_match": match.get("source_family_match"),
                    "evidence_strength": match.get("evidence_strength"),
                    "implementation_stage": match.get("implementation_stage"),
                    "mechanism_of_effect": match.get("mechanism_of_effect"),
                    "target_agency": match.get("target_agency"),
                    "target_program": match.get("target_program"),
                    "funding_signal": match.get("funding_signal"),
                    "legal_status": match.get("legal_status"),
                    "court_or_agency": match.get("court_or_agency"),
                    "affected_institutions": match.get("affected_institutions"),
                    "source_name": match.get("source_name"),
                    "source_category": match.get("source_category"),
                    "source_family": match.get("source_family"),
                    "evidence_type": match.get("evidence_type"),
                    "topic_tags": ", ".join(match.get("topic_tags") or []),
                    "trust_level": match.get("trust_level"),
                    "default_match_strength": match.get("default_match_strength"),
                    "feed_title": match.get("title"),
                    "feed_url": match.get("url"),
                    "classification_reason": match.get("classification_reason"),
                    "readiness": match.get("readiness"),
                }
            )
    return rows


def main() -> None:
    args = parse_args()
    input_paths = [path.resolve() for path in args.input] if args.input else discover_default_inputs()
    batch_name, president_slug, records, skipped_inputs = load_input_records(
        input_paths,
        include_all_statuses=args.include_all_statuses,
    )
    if args.only_record_key:
        wanted = set(args.only_record_key)
        records = [record for record in records if record.get("record_key") in wanted or record.get("slug") in wanted]

    output_path = (args.output or default_output_path(batch_name)).resolve()
    csv_path = derive_csv_path(args.csv, output_path)

    fetch_args = SimpleNamespace(
        disable_default_sources=args.disable_default_sources,
        source_config=args.source_config.resolve(),
        president_slug=president_slug or args.president_slug,
        max_feed_items=args.max_feed_items,
        timeout=args.timeout,
    )
    default_live_source_items: list[dict[str, Any]] = []
    default_source_errors: list[dict[str, Any]] = []
    source_results: list[dict[str, Any]] = []
    try:
        default_live_source_items, default_source_errors, source_results = fetch_default_live_source_items(fetch_args)
    except Exception as exc:  # noqa: BLE001
        default_source_errors.append({"input": str(args.source_config.resolve()), "error": normalize_text(str(exc))})

    feed_items = list(default_live_source_items)
    feed_errors = list(default_source_errors)
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

    promise_rows = promise_like_records(records)
    matched_items = []
    bucket_rank = {"strong_match": 3, "review_match": 2, "weak_match": 1, "ignore": 0}
    for record, promise_row in zip(records, promise_rows):
        matches = []
        for feed_item in feed_items:
            match = build_match(feed_item, record, promise_row, include_weak=args.include_weak)
            if match:
                matches.append(match)
        matches = sorted(
            matches,
            key=lambda item: (
                bucket_rank.get(item.get("match_bucket") or "ignore", 0),
                int(item.get("confidence_score") or 0),
                int(item.get("match_score") or 0),
            ),
            reverse=True,
        )
        matched_items.append(summarize_record_matches(record, matches[:8]))

    output = {
        "artifact_version": ARTIFACT_VERSION,
        "generated_at": current_timestamp(),
        "workflow": "current_admin_outcome_evidence_collection",
        "activation_status": "active_read_only",
        "batch_name": batch_name,
        "president_slug": president_slug,
        "input_artifacts": [str(path) for path in input_paths],
        "source_config": str(args.source_config.resolve()),
        "summary": {
            "records_scanned": len(records),
            "feed_items_analyzed": len(feed_items),
            "raw_feed_item_count_before_limit": raw_feed_item_count,
            "implementation_evidence_matches": sum(item.get("implementation_evidence_count", 0) for item in matched_items),
            "outcome_evidence_matches": sum(item.get("outcome_evidence_count", 0) for item in matched_items),
            "source_context_matches": sum(item.get("source_context_count", 0) for item in matched_items),
            "legal_context_matches": sum(item.get("legal_context_count", 0) for item in matched_items),
            "strong_matches": sum(item.get("strong_match_count", 0) for item in matched_items),
            "review_matches": sum(item.get("review_match_count", 0) for item in matched_items),
            "weak_matches": sum(item.get("weak_match_count", 0) for item in matched_items),
            "feed_errors": len(feed_errors),
            "records_ready_for_impact_evaluate": sum(item.get("outcome_evidence_count", 0) > 0 for item in matched_items),
        },
        "source_query_summary": {
            "default_live_sources_enabled": not args.disable_default_sources,
            "include_weak_matches": args.include_weak,
            "feed_urls_requested": args.feed_url or [],
            "feed_json_requested": [str(path) for path in (args.feed_json or [])],
            "source_results": source_results,
        },
        "skipped_inputs": skipped_inputs,
        "feed_errors": feed_errors,
        "items": matched_items,
        "operator_guidance": (
            "Review this artifact before using it with impact evaluate. "
            "This collector is active and read-only; it never writes records or policy_outcomes."
        ),
    }
    write_outcome_evidence_artifact(output_path, output)
    if csv_path:
        write_csv_rows(csv_path, build_csv_rows(matched_items))
    print_json(output)


if __name__ == "__main__":
    main()
