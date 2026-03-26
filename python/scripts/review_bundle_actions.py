#!/usr/bin/env python3
import argparse
import copy
import json
from pathlib import Path
from typing import Any


NON_ACTIONABLE_REVIEW_STATES = {"stale", "already_applied", "superseded"}
PRIORITY_ORDER = {"High": 0, "Medium": 1, "Low": 2}


def python_dir() -> Path:
    return Path(__file__).resolve().parents[1]


def reports_dir() -> Path:
    return python_dir() / "reports"


def default_input_path() -> Path:
    return reports_dir() / "equitystack_review_bundle.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Review, approve, or dismiss operator_actions in an EquityStack review bundle."
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=default_input_path(),
        help="Path to the review bundle JSON",
    )
    parser.add_argument(
        "--only-future-bill-id",
        type=int,
        action="append",
        help="Limit output to one or more future_bill_id values",
    )
    parser.add_argument(
        "--show-all",
        action="store_true",
        help="Include dismissed, approved, stale, and superseded actions in the action list",
    )
    parser.add_argument(
        "--non-interactive-summary",
        action="store_true",
        help="Print the startup summary and exit",
    )
    return parser.parse_args()


def load_bundle(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text())
    if not isinstance(payload, dict):
        raise ValueError("Review bundle must be a JSON object")
    return payload


def stringify_scalar(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def is_actionable(action: dict[str, Any]) -> bool:
    status = str(action.get("status") or "").lower()
    review_state = str(action.get("review_state") or "").lower()
    if status != "pending":
        return False
    if review_state in NON_ACTIONABLE_REVIEW_STATES:
        return False
    return True


def nearby_notes(group: dict[str, Any], action: dict[str, Any]) -> list[str]:
    notes: list[str] = []

    rationale = action.get("rationale")
    if rationale:
        notes.append(f"rationale: {rationale}")

    for key in ("approval_note", "notes"):
        value = action.get(key)
        if isinstance(value, str) and value.strip():
            notes.append(f"{key}: {value.strip()}")

    group_notes = group.get("notes")
    if isinstance(group_notes, list):
        for item in group_notes:
            if isinstance(item, str) and item.strip():
                notes.append(f"group_note: {item.strip()}")
                break
    elif isinstance(group_notes, str) and group_notes.strip():
        notes.append(f"group_note: {group_notes.strip()}")

    recommended = group.get("recommended_operator_action")
    if recommended:
        notes.append(f"recommended_operator_action: {recommended}")

    return notes


def flatten_actions(
    bundle: dict[str, Any],
    *,
    only_future_bill_ids: set[int],
    show_all: bool,
    sort_mode: str,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    summary_groups: list[dict[str, Any]] = []
    flattened: list[dict[str, Any]] = []

    for group_index, group in enumerate(bundle.get("future_bill_groups") or []):
        future_bill_id = int(group["future_bill_id"])
        if only_future_bill_ids and future_bill_id not in only_future_bill_ids:
            continue

        group_actions = group.get("operator_actions") or []
        visible_count = 0
        for action_index, action in enumerate(group_actions):
            if not show_all and not is_actionable(action):
                continue
            visible_count += 1
            flattened.append(
                {
                    "future_bill_id": future_bill_id,
                    "future_bill_title": group.get("future_bill_title") or "(untitled future bill)",
                    "action_id": action.get("action_id"),
                    "action_type": action.get("action_type"),
                    "target_type": action.get("target_type"),
                    "target_id": action.get("target_id"),
                    "payload": action.get("payload"),
                    "approved": action.get("approved"),
                    "status": action.get("status"),
                    "review_state": action.get("review_state"),
                    "action_score": action.get("action_score"),
                    "action_priority": action.get("action_priority"),
                    "score_breakdown": action.get("score_breakdown"),
                    "notes": nearby_notes(group, action),
                    "group": group,
                    "group_index": group_index,
                    "action": action,
                    "action_index": action_index,
                }
            )

        summary_groups.append(
            {
                "future_bill_id": future_bill_id,
                "future_bill_title": group.get("future_bill_title") or "(untitled future bill)",
                "visible_actions": visible_count,
            }
        )

    has_scores = any(row.get("action_score") is not None for row in flattened)
    if sort_mode == "score" and has_scores:
        flattened.sort(
            key=lambda row: (
                -(float(row["action_score"]) if row.get("action_score") is not None else -1.0),
                PRIORITY_ORDER.get(str(row.get("action_priority") or ""), 99),
                row["future_bill_id"],
                str(row.get("action_id") or ""),
            )
        )
    elif sort_mode == "priority" and has_scores:
        flattened.sort(
            key=lambda row: (
                PRIORITY_ORDER.get(str(row.get("action_priority") or ""), 99),
                -(float(row["action_score"]) if row.get("action_score") is not None else -1.0),
                row["future_bill_id"],
                str(row.get("action_id") or ""),
            )
        )
    else:
        flattened.sort(
            key=lambda row: (
                row["future_bill_id"],
                str(row.get("action_type") or ""),
                str(row.get("target_id") or ""),
                str(row.get("action_id") or ""),
            )
        )
    summary_groups.sort(key=lambda row: row["future_bill_id"])
    return summary_groups, flattened


def payload_summary(payload: Any) -> str:
    if not isinstance(payload, dict) or not payload:
        return "none"

    preferred_keys = [
        "bill_number",
        "title",
        "import_priority",
        "future_bill_link_id",
        "tracked_bill_id",
        "new_link_type",
        "link_type",
        "congress",
        "chamber",
    ]
    parts: list[str] = []
    seen: set[str] = set()

    for key in preferred_keys:
        if key in payload and payload[key] is not None:
            parts.append(f"{key}={stringify_scalar(payload[key])}")
            seen.add(key)

    if not parts:
        for key, value in payload.items():
            if value is None:
                continue
            parts.append(f"{key}={stringify_scalar(value)}")
            if len(parts) == 4:
                break
    else:
        for key, value in payload.items():
            if key in seen or value is None:
                continue
            parts.append(f"{key}={stringify_scalar(value)}")
            if len(parts) == 4:
                break

    return ", ".join(parts)


def headline_target(row: dict[str, Any]) -> str:
    action = row["action"]
    payload = action.get("payload") or {}
    for candidate in (
        action.get("candidate_bill_number"),
        payload.get("bill_number"),
        action.get("candidate_title"),
        payload.get("title"),
        row.get("target_id"),
    ):
        if candidate not in (None, ""):
            return stringify_scalar(candidate)
    return "n/a"


def print_startup_summary(summary_groups: list[dict[str, Any]], rows: list[dict[str, Any]], *, show_all: bool) -> None:
    label = "Listed actions" if show_all else "Pending actionable actions"
    print(f"{label}: {len(rows)}")
    print()
    for group in summary_groups:
        print(
            f"Future bill {group['future_bill_id']} | {group['future_bill_title']} | "
            f"{group['visible_actions']} actions"
        )


def print_actions(rows: list[dict[str, Any]], *, show_all: bool) -> None:
    print()
    if not rows:
        if show_all:
            print("No operator actions matched the current filters.")
        else:
            print("No actionable pending operator actions matched the current filters.")
        return

    for index, row in enumerate(rows, start=1):
        target = headline_target(row)
        score = row.get("action_score")
        priority = row.get("action_priority")
        score_text = f"{float(score):.2f}" if score is not None else "n/a"
        priority_text = priority or "Unscored"
        print(f"[{index}] FB {row['future_bill_id']} | {row['action_type']} | {target} | Score: {score_text} ({priority_text})")
        print(f"    action_id: {row['action_id']}")
        print(f"    target: {row['target_type']} | target_id: {stringify_scalar(row['target_id'])}")
        status_bits = [
            f"approved: {stringify_scalar(row['approved'])}",
            f"status: {stringify_scalar(row['status'])}",
        ]
        if row.get("review_state") is not None:
            status_bits.append(f"review_state: {stringify_scalar(row['review_state'])}")
        print(f"    {' | '.join(status_bits)}")
        print(f"    payload: {payload_summary(row['payload'])}")
        if row["notes"]:
            print(f"    note: {row['notes'][0]}")


def print_action_detail(row: dict[str, Any]) -> None:
    detail = {
        "action": row["action"],
        "future_bill_group_context": row["group"],
    }
    print(json.dumps(detail, indent=2, default=str))


def print_score_breakdown(row: dict[str, Any]) -> None:
    breakdown = row.get("score_breakdown")
    if not isinstance(breakdown, dict):
        print("No score breakdown is available for this action.")
        return
    print(
        json.dumps(
            {
                "action_id": row.get("action_id"),
                "action_score": row.get("action_score"),
                "action_priority": row.get("action_priority"),
                "score_breakdown": breakdown,
            },
            indent=2,
            default=str,
        )
    )


def print_help() -> None:
    print("Commands:")
    print("  l             re-list current actions")
    print("  p <num>       print full JSON for one action and its future bill group")
    print("  show score <num>  print score breakdown for one action")
    print("  sort score    sort actions by action_score DESC")
    print("  sort priority sort actions by action_priority")
    print("  sort default  restore legacy sort order")
    print("  a <num>       approve one action (approved=true, status=pending)")
    print("  d <num>       dismiss one action (approved=false, status=dismissed)")
    print("  u <num>       reset one action (approved=false, status=pending)")
    print("  af <id>       approve all currently listed actions for one future_bill_id")
    print("  df <id>       dismiss all currently listed actions for one future_bill_id")
    print("  s             save changes")
    print("  x             save and exit")
    print("  q             quit without saving")
    print("  h             show this help")


def resolve_action(rows: list[dict[str, Any]], raw_index: str) -> dict[str, Any] | None:
    if not raw_index.isdigit():
        print("Expected a numeric action index.")
        return None
    index = int(raw_index) - 1
    if index < 0 or index >= len(rows):
        print("Action index out of range.")
        return None
    return rows[index]


def mutate_action(
    action: dict[str, Any],
    *,
    approved: bool,
    status: str,
) -> bool:
    changed = False
    if action.get("approved") != approved:
        action["approved"] = approved
        changed = True
    if action.get("status") != status:
        action["status"] = status
        changed = True
    return changed


def mutate_future_bill(
    rows: list[dict[str, Any]],
    future_bill_id: int,
    *,
    approved: bool,
    status: str,
) -> int:
    changed = 0
    for row in rows:
        if row["future_bill_id"] != future_bill_id:
            continue
        if mutate_action(row["action"], approved=approved, status=status):
            changed += 1
    return changed


def save_bundle(path: Path, bundle: dict[str, Any], original_bundle: dict[str, Any]) -> None:
    path.write_text(json.dumps(bundle, indent=2, default=str) + "\n")

    changed_fields = 0
    current_groups = bundle.get("future_bill_groups") or []
    original_groups = original_bundle.get("future_bill_groups") or []
    for group_index, group in enumerate(current_groups):
        original_group = original_groups[group_index]
        for action_index, action in enumerate(group.get("operator_actions") or []):
            original_action = (original_group.get("operator_actions") or [])[action_index]
            for field in ("approved", "status"):
                if action.get(field) != original_action.get(field):
                    changed_fields += 1

    print(f"Saved changes to {path}")
    print(f"Mutated operator_action fields: {changed_fields}")


def main() -> None:
    args = parse_args()
    input_path = args.input.resolve()
    bundle = load_bundle(input_path)
    original_bundle = copy.deepcopy(bundle)
    only_future_bill_ids = set(args.only_future_bill_id or [])

    approved_in_session = 0
    dismissed_in_session = 0
    reset_in_session = 0
    dirty = False
    sort_mode = "score"

    summary_groups, rows = flatten_actions(
        bundle,
        only_future_bill_ids=only_future_bill_ids,
        show_all=args.show_all,
        sort_mode=sort_mode,
    )
    print_startup_summary(summary_groups, rows, show_all=args.show_all)

    if args.non_interactive_summary:
        return

    print_actions(rows, show_all=args.show_all)
    print()
    print_help()

    while True:
        try:
            raw = input("> ").strip()
        except EOFError:
            print()
            raw = "q"

        if not raw:
            continue

        summary_groups, rows = flatten_actions(
            bundle,
            only_future_bill_ids=only_future_bill_ids,
            show_all=args.show_all,
            sort_mode=sort_mode,
        )

        parts = raw.split()
        command = parts[0].lower()

        if command == "sort":
            if len(parts) != 2 or parts[1].lower() not in {"score", "priority", "default"}:
                print("Expected one of: sort score | sort priority | sort default")
                continue
            sort_mode = parts[1].lower()
            print(f"Sort mode set to {sort_mode}.")
            continue

        if command == "show":
            if len(parts) != 3 or parts[1].lower() != "score":
                print("Expected: show score <num>")
                continue
            row = resolve_action(rows, parts[2])
            if row is None:
                continue
            print_score_breakdown(row)
            continue

        if command == "l":
            print_startup_summary(summary_groups, rows, show_all=args.show_all)
            print_actions(rows, show_all=args.show_all)
            continue

        if command == "h":
            print_help()
            continue

        if command == "q":
            if dirty:
                print("Quit without saving. Changes in this session were discarded.")
            else:
                print("Quit without saving.")
            return

        if command == "s":
            save_bundle(input_path, bundle, original_bundle)
            dirty = False
            print(
                f"Session counts | approved: {approved_in_session} | "
                f"dismissed: {dismissed_in_session} | reset: {reset_in_session}"
            )
            continue

        if command == "x":
            save_bundle(input_path, bundle, original_bundle)
            print(
                f"Session counts | approved: {approved_in_session} | "
                f"dismissed: {dismissed_in_session} | reset: {reset_in_session}"
            )
            return

        if command in {"p", "a", "d", "u"}:
            if len(parts) != 2:
                print("Expected one action number.")
                continue
            row = resolve_action(rows, parts[1])
            if row is None:
                continue
            action = row["action"]

            if command == "p":
                print_action_detail(row)
                continue

            if command == "a":
                changed = mutate_action(action, approved=True, status="pending")
                if changed:
                    approved_in_session += 1
                    dirty = True
                print(f"Approved action {row['action_id']}")
                continue

            if command == "d":
                changed = mutate_action(action, approved=False, status="dismissed")
                if changed:
                    dismissed_in_session += 1
                    dirty = True
                print(f"Dismissed action {row['action_id']}")
                continue

            changed = mutate_action(action, approved=False, status="pending")
            if changed:
                reset_in_session += 1
                dirty = True
            print(f"Reset action {row['action_id']}")
            continue

        if command in {"af", "df"}:
            if len(parts) != 2 or not parts[1].isdigit():
                print("Expected a numeric future_bill_id.")
                continue
            future_bill_id = int(parts[1])
            matching = [row for row in rows if row["future_bill_id"] == future_bill_id]
            if not matching:
                print(f"No currently listed actions found for future_bill_id={future_bill_id}.")
                continue

            if command == "af":
                changed = mutate_future_bill(rows, future_bill_id, approved=True, status="pending")
                approved_in_session += changed
                dirty = dirty or changed > 0
                print(f"Approved {changed} action(s) for future_bill_id={future_bill_id}")
            else:
                changed = mutate_future_bill(rows, future_bill_id, approved=False, status="dismissed")
                dismissed_in_session += changed
                dirty = dirty or changed > 0
                print(f"Dismissed {changed} action(s) for future_bill_id={future_bill_id}")
            continue

        print("Invalid command. Enter 'h' for help.")


if __name__ == "__main__":
    main()
