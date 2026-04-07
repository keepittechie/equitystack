#!/usr/bin/env python3
import argparse
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from current_admin_common import (
    get_current_admin_reports_dir,
    normalize_nullable_text,
    read_batch_payload,
    slugify,
    write_json_file,
)


ARTIFACT_VERSION = 1
PACKING_VERSION = "current-admin-evidence-pack-v1"
VALID_EVIDENCE_FOCUS = {
    "all",
    "single-source-official",
    "outcome-evidence-present",
    "policy-intent-only",
    "weak-outcome-evidence",
    "multi-source-grounding",
}


def normalize_string_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [text for text in (normalize_nullable_text(item) for item in value) if text]
    text = normalize_nullable_text(value)
    return [text] if text else []


def evidence_pack_path_for_review(review_path: Path) -> Path:
    name = review_path.name
    if name.endswith(".ai-review.json"):
        return review_path.with_name(name.replace(".ai-review.json", ".evidence-pack.json"))
    return review_path.with_suffix(".evidence-pack.json")


def review_path_for_evidence_pack(path: Path) -> Path:
    name = path.name
    if name.endswith(".evidence-pack.json"):
        return path.with_name(name.replace(".evidence-pack.json", ".ai-review.json"))
    return path


def load_json_object(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text())
    if not isinstance(payload, dict):
        raise ValueError(f"{path} must contain a JSON object.")
    return payload


def review_artifact_paths() -> list[Path]:
    reports_dir = get_current_admin_reports_dir()
    return sorted(
        (path for path in reports_dir.glob("*.ai-review.json") if path.is_file()),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )


def evidence_pack_paths() -> list[Path]:
    reports_dir = get_current_admin_reports_dir()
    return sorted(
        (path for path in reports_dir.glob("*.evidence-pack.json") if path.is_file()),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )


def source_identity(source: dict[str, Any]) -> str:
    return "|".join(
        normalize_nullable_text(source.get(key)) or ""
        for key in ("source_url", "source_title", "publisher", "published_date")
    )


def source_is_government(source: dict[str, Any]) -> bool:
    haystack = " ".join(
        normalize_nullable_text(source.get(key)) or ""
        for key in ("source_type", "publisher", "source_title", "source_url")
    ).lower()
    return any(
        token in haystack
        for token in (
            "government",
            ".gov",
            "white house",
            "department",
            "agency",
            "federal",
            "senate",
            "house of representatives",
            "congress",
            "court",
        )
    )


def source_is_official(source: dict[str, Any]) -> bool:
    haystack = " ".join(
        normalize_nullable_text(source.get(key)) or ""
        for key in ("source_type", "publisher", "source_title")
    ).lower()
    return source_is_government(source) or any(
        token in haystack
        for token in (
            "official",
            "campaign",
            "republican national committee",
            "democratic national committee",
            "platform",
            "presidential action",
        )
    )


def collect_sources(record: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    promise_sources = [source for source in record.get("promise_sources") or [] if isinstance(source, dict)]
    action_sources: list[dict[str, Any]] = []
    outcome_sources: list[dict[str, Any]] = []
    for action in record.get("actions") or []:
        if not isinstance(action, dict):
            continue
        action_sources.extend(source for source in action.get("action_sources") or [] if isinstance(source, dict))
        for outcome in action.get("outcomes") or []:
            if not isinstance(outcome, dict):
                continue
            outcome_sources.extend(source for source in outcome.get("outcome_sources") or [] if isinstance(source, dict))
    return {
        "promise_sources": promise_sources,
        "action_sources": action_sources,
        "outcome_sources": outcome_sources,
    }


def collect_outcomes(record: dict[str, Any]) -> list[dict[str, Any]]:
    outcomes: list[dict[str, Any]] = []
    for action in record.get("actions") or []:
        if not isinstance(action, dict):
            continue
        outcomes.extend(outcome for outcome in action.get("outcomes") or [] if isinstance(outcome, dict))
    return outcomes


def short_join(values: list[str], *, fallback: str) -> str:
    values = [value for value in values if value]
    return "; ".join(values[:3]) if values else fallback


def measurable_outcome_indicators(outcomes: list[dict[str, Any]]) -> list[str]:
    indicators: list[str] = []
    for outcome in outcomes:
        measurable = normalize_nullable_text(outcome.get("measurable_impact"))
        if measurable:
            indicators.append(measurable)
    return indicators


def source_grounding(record: dict[str, Any]) -> dict[str, Any]:
    grouped = collect_sources(record)
    all_sources = grouped["promise_sources"] + grouped["action_sources"] + grouped["outcome_sources"]
    unique_sources = {source_identity(source) for source in all_sources if source_identity(source)}
    government_count = sum(1 for source in all_sources if source_is_government(source))
    official_count = sum(1 for source in all_sources if source_is_official(source))
    independent_count = max(len(all_sources) - official_count, 0)
    single_unique_official = len(unique_sources) == 1 and bool(all_sources) and official_count == len(all_sources)
    outcomes = collect_outcomes(record)
    measurable_indicators = measurable_outcome_indicators(outcomes)
    outcome_source_count = len(grouped["outcome_sources"])
    action_source_count = len(grouped["action_sources"])
    promise_source_count = len(grouped["promise_sources"])
    has_outcome_evidence = outcome_source_count > 0 or bool(measurable_indicators)
    has_measurable_evidence = bool(measurable_indicators)

    labels: list[str] = []
    if action_source_count == 0 and outcome_source_count == 0:
        labels.append("policy intent only")
    if action_source_count > 0:
        labels.append("implementation evidence present")
    if has_outcome_evidence:
        labels.append("outcome evidence present")
    if single_unique_official:
        labels.append("single-source official record")
    if len(unique_sources) >= 2 and not has_outcome_evidence:
        labels.append("multi-source but outcome-thin")
    if action_source_count > 0 and not has_outcome_evidence:
        labels.append("grounded action evidence, weak outcome evidence")
    if len(unique_sources) >= 2 and has_outcome_evidence:
        labels.append("multi-source grounding present")

    return {
        "promise_source_count": promise_source_count,
        "action_source_count": action_source_count,
        "outcome_source_count": outcome_source_count,
        "total_source_count": len(all_sources),
        "unique_source_count": len(unique_sources),
        "government_source_count": government_count,
        "independent_non_government_source_count": independent_count,
        "official_source_count": official_count,
        "relies_on_single_official_source": single_unique_official,
        "has_downstream_outcome_source": outcome_source_count > 0,
        "has_measurable_evidence": has_measurable_evidence,
        "has_policy_intent_evidence_only": action_source_count == 0 and outcome_source_count == 0,
        "labels": labels or ["source grounding unclear"],
    }


def evidence_strength_labels(record: dict[str, Any], grounding: dict[str, Any]) -> list[str]:
    labels: list[str] = []
    action_sources = int(grounding.get("action_source_count") or 0)
    outcome_sources = int(grounding.get("outcome_source_count") or 0)
    outcomes = collect_outcomes(record)
    outcome_strengths = {
        normalize_nullable_text(outcome.get("evidence_strength"))
        for outcome in outcomes
        if normalize_nullable_text(outcome.get("evidence_strength"))
    }

    if action_sources >= 2:
        labels.append("strong action evidence")
    elif action_sources == 1:
        labels.append("moderate action evidence")
    else:
        labels.append("weak action evidence")

    if outcome_sources > 0 and "Strong" in outcome_strengths:
        labels.append("strong outcome evidence")
    elif outcome_sources > 0 and ("Moderate" in outcome_strengths or outcome_strengths):
        labels.append("moderate outcome evidence")
    elif outcome_sources > 0:
        labels.append("weak outcome evidence")
    else:
        labels.append("no measurable outcome evidence")
    return labels


def impact_directness_hint(record: dict[str, Any], grounding: dict[str, Any]) -> str:
    outcomes = collect_outcomes(record)
    text = " ".join(
        normalize_nullable_text(value) or ""
        for value in [
            record.get("impacted_group"),
            record.get("summary"),
            record.get("notes"),
            *[outcome.get("black_community_impact_note") for outcome in outcomes],
        ]
    ).lower()
    mentions_black = "black" in text
    attenuated_language = any(token in text for token in ("can ", "could", "may ", "possible", "indirect", "depends"))
    if mentions_black and grounding.get("has_measurable_evidence") and not attenuated_language:
        return "direct likely impact on Black Americans"
    if mentions_black:
        return "indirect possible impact"
    return "unclear/attenuated impact path"


def implementation_completeness_hint(record: dict[str, Any], grounding: dict[str, Any]) -> str:
    status = normalize_nullable_text(record.get("status")) or "unknown"
    if status == "Delivered" and grounding.get("has_downstream_outcome_source"):
        return "implementation appears complete with outcome evidence"
    if status in {"Partial", "In Progress"} and int(grounding.get("action_source_count") or 0) > 0:
        return "action documented, implementation incomplete"
    if status in {"Blocked", "Failed"}:
        return f"implementation marked {status.lower()}"
    if int(grounding.get("action_source_count") or 0) > 0:
        return "implementation evidence present"
    return "implementation evidence not documented"


def evidence_quality_diagnostics(record: dict[str, Any], grounding: dict[str, Any], directness_hint: str, completeness_hint: str) -> list[str]:
    diagnostics: list[str] = []
    if not grounding.get("has_downstream_outcome_source"):
        diagnostics.append("no downstream outcome evidence")
    if grounding.get("relies_on_single_official_source"):
        diagnostics.append("single-source official record only")
    if completeness_hint == "action documented, implementation incomplete":
        diagnostics.append("action documented, but implementation incomplete")
    if int(grounding.get("action_source_count") or 0) > 0 and not grounding.get("has_measurable_evidence"):
        diagnostics.append("implementation present, measurable impact not documented")
    if "multi-source grounding present" in grounding.get("labels", []):
        diagnostics.append("multi-source grounding present")
    if directness_hint != "direct likely impact on Black Americans":
        diagnostics.append("impact path appears indirect")
    return diagnostics or ["no deterministic evidence-quality warning"]


def source_inventory_summary(record: dict[str, Any], grounding: dict[str, Any]) -> str:
    return (
        f"{grounding['promise_source_count']} promise source(s), "
        f"{grounding['action_source_count']} action source(s), "
        f"{grounding['outcome_source_count']} outcome source(s), "
        f"{grounding['government_source_count']} government source(s), "
        f"{grounding['independent_non_government_source_count']} independent/non-government source(s)."
    )


def action_inventory_summary(record: dict[str, Any]) -> str:
    actions = [action for action in record.get("actions") or [] if isinstance(action, dict)]
    summaries = [
        short_join(
            [
                normalize_nullable_text(action.get("action_type")) or "",
                normalize_nullable_text(action.get("action_date")) or "",
                normalize_nullable_text(action.get("title")) or "",
            ],
            fallback="",
        )
        for action in actions
    ]
    return short_join(summaries, fallback="No action records supplied.")


def outcome_inventory_summary(record: dict[str, Any]) -> str:
    outcomes = collect_outcomes(record)
    summaries = [normalize_nullable_text(outcome.get("outcome_summary")) or "" for outcome in outcomes]
    return short_join(summaries, fallback="No downstream outcome records supplied.")


def build_evidence_pack_for_record(record: dict[str, Any]) -> dict[str, Any]:
    item_id = normalize_nullable_text(record.get("slug")) or slugify(record.get("title") or "record")
    outcomes = collect_outcomes(record)
    grounding = source_grounding(record)
    strength_labels = evidence_strength_labels(record, grounding)
    directness_hint = impact_directness_hint(record, grounding)
    completeness_hint = implementation_completeness_hint(record, grounding)
    diagnostics = evidence_quality_diagnostics(record, grounding, directness_hint, completeness_hint)
    measurable = measurable_outcome_indicators(outcomes)
    black_impact_notes = [
        text for text in (normalize_nullable_text(outcome.get("black_community_impact_note")) for outcome in outcomes) if text
    ]

    return {
        "packing_version": PACKING_VERSION,
        "item_id": item_id,
        "title": normalize_nullable_text(record.get("title")),
        "promise_text": normalize_nullable_text(record.get("promise_text")),
        "promise_date": normalize_nullable_text(record.get("promise_date")),
        "promise_type": normalize_nullable_text(record.get("promise_type")),
        "topic": normalize_nullable_text(record.get("topic")),
        "impacted_group": normalize_nullable_text(record.get("impacted_group")),
        "current_status": normalize_nullable_text(record.get("status")),
        "concise_record_summary": normalize_nullable_text(record.get("summary")),
        "concise_record_notes": normalize_nullable_text(record.get("notes")),
        "source_inventory_summary": source_inventory_summary(record, grounding),
        "action_inventory_summary": action_inventory_summary(record),
        "outcome_inventory_summary": outcome_inventory_summary(record),
        "black_community_impact_summary": short_join(black_impact_notes, fallback="No Black community impact note supplied."),
        "implementation_status_summary": completeness_hint,
        "measurable_outcome_indicators": measurable,
        "source_diversity_summary": (
            f"{grounding['unique_source_count']} unique source(s); "
            f"{grounding['official_source_count']} official source instance(s); "
            f"{grounding['independent_non_government_source_count']} independent/non-government source instance(s)."
        ),
        "source_quality_preview": "medium" if grounding.get("has_downstream_outcome_source") else "low",
        "evidence_gaps_summary": "; ".join(diagnostics),
        "impact_directness_hint": directness_hint,
        "implementation_completeness_hint": completeness_hint,
        "source_grounding": grounding,
        "source_grounding_labels": grounding["labels"],
        "evidence_strength_labels": strength_labels,
        "evidence_quality_diagnostics": diagnostics,
    }


def summarize_packs(packs: list[dict[str, Any]]) -> dict[str, Any]:
    grounding_labels = Counter(label for pack in packs for label in pack.get("source_grounding_labels") or [])
    strength_labels = Counter(label for pack in packs for label in pack.get("evidence_strength_labels") or [])
    diagnostics = Counter(label for pack in packs for label in pack.get("evidence_quality_diagnostics") or [])
    directness = Counter(pack.get("impact_directness_hint") or "unknown" for pack in packs)
    completeness = Counter(pack.get("implementation_completeness_hint") or "unknown" for pack in packs)
    return {
        "item_count": len(packs),
        "single_source_official_count": grounding_labels.get("single-source official record", 0),
        "outcome_evidence_present_count": grounding_labels.get("outcome evidence present", 0),
        "policy_intent_only_count": grounding_labels.get("policy intent only", 0),
        "weak_outcome_evidence_count": strength_labels.get("weak outcome evidence", 0)
        + strength_labels.get("no measurable outcome evidence", 0),
        "source_grounding_label_counts": dict(sorted(grounding_labels.items())),
        "evidence_strength_label_counts": dict(sorted(strength_labels.items())),
        "evidence_quality_diagnostic_counts": dict(sorted(diagnostics.items())),
        "impact_directness_hint_counts": dict(sorted(directness.items())),
        "implementation_completeness_hint_counts": dict(sorted(completeness.items())),
    }


def evidence_interpretations(summary: dict[str, Any]) -> list[str]:
    item_count = int(summary.get("item_count") or 0)
    if not item_count:
        return ["no evidence-pack items are available"]
    interpretations: list[str] = []
    if summary.get("policy_intent_only_count", 0) >= item_count / 2:
        interpretations.append("many items are policy-intent-only before classifier review")
    if summary.get("weak_outcome_evidence_count", 0) >= item_count / 2:
        interpretations.append("outcome evidence is thin across much of the batch")
    if summary.get("single_source_official_count", 0) > 0:
        interpretations.append("some items rely on a single official source")
    if summary.get("outcome_evidence_present_count", 0) >= item_count / 2:
        interpretations.append("outcome evidence is present for at least half of the reviewed items")
    return interpretations or ["no dominant evidence-pack issue was detected"]


def build_evidence_pack_artifact(
    *,
    batch_name: str | None,
    records: list[dict[str, Any]],
    input_artifact: Path | str | None,
    review_artifact: Path | str | None,
) -> dict[str, Any]:
    packs = [build_evidence_pack_for_record(record) for record in records]
    summary = summarize_packs(packs)
    return {
        "artifact_version": ARTIFACT_VERSION,
        "packing_version": PACKING_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "batch_name": batch_name,
        "input_artifact": str(input_artifact) if input_artifact else None,
        "review_artifact": str(review_artifact) if review_artifact else None,
        "model_facing_item_count": len(packs),
        "summary": summary,
        "operator_interpretations": evidence_interpretations(summary),
        "items": packs,
    }


def write_evidence_pack_artifact(
    *,
    output_path: Path,
    batch_name: str | None,
    records: list[dict[str, Any]],
    input_artifact: Path | str | None,
) -> tuple[Path, dict[str, Any]]:
    artifact = build_evidence_pack_artifact(
        batch_name=batch_name,
        records=records,
        input_artifact=input_artifact,
        review_artifact=output_path,
    )
    path = evidence_pack_path_for_review(output_path)
    write_json_file(path, artifact)
    return path, artifact


def pack_matches_filters(pack: dict[str, Any], args: argparse.Namespace) -> bool:
    if args.item_id and pack.get("item_id") != args.item_id:
        return False
    if args.evidence_quality_label and args.evidence_quality_label not in (pack.get("evidence_quality_diagnostics") or []):
        return False
    if args.source_grounding_label and args.source_grounding_label not in (pack.get("source_grounding_labels") or []):
        return False
    if args.impact_directness_hint and pack.get("impact_directness_hint") != args.impact_directness_hint:
        return False
    focus = args.evidence_focus
    if focus == "single-source-official":
        return "single-source official record" in (pack.get("source_grounding_labels") or [])
    if focus == "outcome-evidence-present":
        return "outcome evidence present" in (pack.get("source_grounding_labels") or [])
    if focus == "policy-intent-only":
        return "policy intent only" in (pack.get("source_grounding_labels") or [])
    if focus == "weak-outcome-evidence":
        return any(label in (pack.get("evidence_strength_labels") or []) for label in ("weak outcome evidence", "no measurable outcome evidence"))
    if focus == "multi-source-grounding":
        return "multi-source grounding present" in (pack.get("source_grounding_labels") or [])
    return True


def load_existing_evidence_pack_for_batch(batch_name: str | None) -> list[dict[str, Any]]:
    packs = []
    for path in evidence_pack_paths():
        payload = load_json_object(path)
        if batch_name and payload.get("batch_name") != batch_name:
            continue
        payload["artifact_path"] = str(path)
        packs.append(payload)
    return packs


def build_status_payload(args: argparse.Namespace) -> dict[str, Any]:
    artifacts = []
    for artifact in load_existing_evidence_pack_for_batch(args.batch_name):
        items = [pack for pack in artifact.get("items") or [] if isinstance(pack, dict) and pack_matches_filters(pack, args)]
        summary = summarize_packs(items)
        artifacts.append(
            {
                "batch_name": artifact.get("batch_name"),
                "artifact_path": artifact.get("artifact_path"),
                "input_artifact": artifact.get("input_artifact"),
                "review_artifact": artifact.get("review_artifact"),
                "packing_version": artifact.get("packing_version"),
                "model_facing_item_count": artifact.get("model_facing_item_count"),
                "filtered_item_count": len(items),
                "summary": summary,
                "operator_interpretations": evidence_interpretations(summary),
                "items": items if args.include_items else [],
            }
        )
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "artifact_version": ARTIFACT_VERSION,
        "filters": {
            "batch_name": args.batch_name or None,
            "evidence_focus": args.evidence_focus,
            "evidence_quality_label": args.evidence_quality_label or None,
            "source_grounding_label": args.source_grounding_label or None,
            "impact_directness_hint": args.impact_directness_hint or None,
            "item_id": args.item_id or None,
            "include_items": bool(args.include_items),
        },
        "counts": {
            "artifacts": len(artifacts),
            "filtered_items": sum(int(artifact.get("filtered_item_count") or 0) for artifact in artifacts),
        },
        "artifacts": artifacts,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build or inspect current-admin evidence-pack artifacts.")
    parser.add_argument("--input", type=Path, help="Normalized current-admin batch JSON to pack.")
    parser.add_argument("--output", type=Path, help="Evidence-pack artifact path to write for --input.")
    parser.add_argument("--batch-name", help="Limit status output to one batch.")
    parser.add_argument("--evidence-focus", choices=sorted(VALID_EVIDENCE_FOCUS), default="all")
    parser.add_argument("--evidence-quality-label")
    parser.add_argument("--source-grounding-label")
    parser.add_argument("--impact-directness-hint")
    parser.add_argument("--item-id")
    parser.add_argument("--include-items", action="store_true")
    parser.add_argument("--pretty", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.input:
        batch = read_batch_payload(args.input)
        payload = build_evidence_pack_artifact(
            batch_name=batch.get("batch_name"),
            records=batch.get("records") or [],
            input_artifact=args.input,
            review_artifact=review_path_for_evidence_pack(args.output) if args.output else None,
        )
        if args.output:
            write_json_file(args.output, payload)
        print(json.dumps(payload, indent=2 if args.pretty else None))
        return
    payload = build_status_payload(args)
    print(json.dumps(payload, indent=2 if args.pretty else None))


if __name__ == "__main__":
    try:
        main()
    except (FileNotFoundError, ValueError) as exc:
        raise SystemExit(str(exc)) from exc
