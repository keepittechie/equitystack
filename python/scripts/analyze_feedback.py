#!/usr/bin/env python3
import json
from pathlib import Path
from typing import Any


def python_dir() -> Path:
    return Path(__file__).resolve().parents[1]


def reports_dir() -> Path:
    return python_dir() / "reports"


def default_input_path() -> Path:
    return reports_dir() / "equitystack_feedback_log.json"


def default_output_path() -> Path:
    return reports_dir() / "equitystack_feedback_analysis.json"


def load_feedback_log(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    payload = json.loads(path.read_text())
    if not isinstance(payload, list):
        return []
    return [item for item in payload if isinstance(item, dict)]


def average(values: list[float]) -> float | None:
    if not values:
        return None
    return sum(values) / len(values)


def summarize_bucket(name: str, entries: list[dict[str, Any]]) -> dict[str, Any]:
    approved = [entry for entry in entries if entry.get("decision") == "approved"]
    dismissed = [entry for entry in entries if entry.get("decision") == "dismissed"]
    approval_rate = (len(approved) / len(entries)) if entries else 0.0
    avg_approved = average([float(entry["action_score"]) for entry in approved if isinstance(entry.get("action_score"), (int, float))])
    avg_dismissed = average([float(entry["action_score"]) for entry in dismissed if isinstance(entry.get("action_score"), (int, float))])

    delta = approval_rate - 0.5
    adjustment = max(-0.1, min(0.1, round(delta * 0.2, 3)))
    if approval_rate >= 0.7:
        suggestion = "increase base weight slightly"
    elif approval_rate <= 0.3:
        suggestion = "decrease base weight slightly"
    else:
        suggestion = "keep weight stable"

    return {
        "name": name,
        "count": len(entries),
        "approval_rate": round(approval_rate, 3),
        "avg_score_approved": round(avg_approved, 3) if avg_approved is not None else None,
        "avg_score_dismissed": round(avg_dismissed, 3) if avg_dismissed is not None else None,
        "suggestion": suggestion,
        "suggested_adjustment": adjustment,
    }


def group_by(entries: list[dict[str, Any]], key: str) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for entry in entries:
        value = entry.get(key)
        if value in (None, ""):
            continue
        grouped.setdefault(str(value), []).append(entry)
    summaries = [summarize_bucket(name, grouped_entries) for name, grouped_entries in grouped.items()]
    summaries.sort(key=lambda item: (-item["approval_rate"], -item["count"], item["name"]))
    return summaries


def main() -> None:
    input_path = default_input_path()
    output_path = default_output_path()
    entries = load_feedback_log(input_path)

    action_type_summary = group_by(entries, "action_type")
    link_type_summary = group_by(entries, "link_type")
    approved = [entry for entry in entries if entry.get("decision") == "approved"]
    dismissed = [entry for entry in entries if entry.get("decision") == "dismissed"]
    approval_rate = (len(approved) / len(entries)) if entries else 0.0

    payload = {
        "generated_at": __import__("datetime").datetime.now(__import__("datetime").UTC).isoformat(),
        "input_file": str(input_path),
        "total_decisions": len(entries),
        "approval_rate": round(approval_rate, 3),
        "action_types": action_type_summary,
        "link_types": link_type_summary,
        "top_performing_action_types": action_type_summary[:3],
        "weakest_action_types": sorted(action_type_summary, key=lambda item: (item["approval_rate"], -item["count"], item["name"]))[:3],
    }
    output_path.write_text(json.dumps(payload, indent=2, default=str) + "\n")

    print("Feedback summary:")
    print(f"- Total decisions: {len(entries)}")
    print(f"- Approval rate: {approval_rate:.2f}")
    print(f"- Top performing action types: {[item['name'] for item in payload['top_performing_action_types']]}")
    print(f"- Weakest action types: {[item['name'] for item in payload['weakest_action_types']]}")
    print(f"- Output: {output_path}")


if __name__ == "__main__":
    main()
