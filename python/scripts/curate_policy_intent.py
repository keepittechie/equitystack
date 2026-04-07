#!/usr/bin/env python3
import argparse
from collections import Counter
from pathlib import Path
from typing import Any

from current_admin_common import (
    get_db_connection,
    get_reports_dir,
    normalize_nullable_text,
    print_json,
    require_apply_confirmation,
    utc_timestamp,
    write_json_file,
)


VALID_OPERATOR_INTENT_CATEGORIES = {
    "equity_expanding",
    "equity_restricting",
    "neutral_administrative",
}
INTENT_COLUMNS = {"policy_intent_summary", "policy_intent_category"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Manually curate missing historical policy intent classifications."
    )
    parser.add_argument("--output", type=Path, help="Curation report JSON path")
    parser.add_argument("--apply", action="store_true", help="Write accepted intent classifications")
    parser.add_argument("--yes", action="store_true", help="Required confirmation for --apply")
    parser.add_argument("--limit", type=int, default=10, help="Maximum unclassified policies to show")
    parser.add_argument("--only-policy-id", type=int, action="append", help="Limit to one or more policies.id values")
    parser.add_argument(
        "--category",
        choices=sorted(VALID_OPERATOR_INTENT_CATEGORIES),
        help="Non-interactive intent category for one or more --only-policy-id targets",
    )
    parser.add_argument("--summary", help="Neutral intent summary for non-interactive curation")
    parser.add_argument("--source-reference", help="Optional source/reference note supporting the intent classification")
    parser.add_argument("--note", help="Optional operator note")
    parser.add_argument("--non-interactive", action="store_true", help="List targets or use provided category/summary without prompts")
    return parser.parse_args()


def default_output_path(apply: bool) -> Path:
    suffix = "apply" if apply else "dry-run"
    return get_reports_dir() / f"policy-intent-curation.{suffix}.json"


def table_exists(cursor, table_name: str) -> bool:
    cursor.execute("SHOW TABLES LIKE %s", (table_name,))
    return cursor.fetchone() is not None


def get_table_columns(cursor, table_name: str) -> set[str]:
    cursor.execute(f"SHOW COLUMNS FROM {table_name}")
    return {str(row["Field"]) for row in cursor.fetchall() or []}


def ensure_policy_intent_storage(cursor) -> None:
    if not table_exists(cursor, "policies"):
        raise RuntimeError("policies table does not exist")
    columns = get_table_columns(cursor, "policies")
    missing = sorted(INTENT_COLUMNS - columns)
    if missing:
        raise RuntimeError(f"policies table is missing intent columns: {', '.join(missing)}")


def build_manual_draft_from_args(args: argparse.Namespace) -> dict[str, Any] | None:
    if not args.category and not args.summary:
        return None
    if not args.only_policy_id:
        raise SystemExit("Non-interactive intent input requires --only-policy-id")
    if not args.category or not normalize_nullable_text(args.summary):
        raise SystemExit("--category and --summary are both required for non-interactive intent input")
    return {
        "policy_intent_category": args.category,
        "policy_intent_summary": normalize_nullable_text(args.summary),
        "source_reference": normalize_nullable_text(args.source_reference),
        "operator_note": normalize_nullable_text(args.note),
    }


def prompt_text(label: str, default: str | None = None) -> str | None:
    suffix = f" [{default}]" if default else ""
    value = input(f"{label}{suffix}: ").strip()
    return value or default


def print_policy_context(target: dict[str, Any]) -> None:
    print("")
    print(f"Policy {target['policy_id']} | {target.get('title')}")
    print(f"Year: {target.get('year_enacted')} | Status: {target.get('status')} | Impact: {target.get('impact_direction')}")
    print(f"Categories: {target.get('categories') or 'n/a'}")
    print(f"Impact score: {target.get('impact_score') if target.get('impact_score') is not None else 'n/a'}")
    print(f"Summary: {target.get('summary') or 'n/a'}")
    print(f"Related outcome: {target.get('outcome_summary') or 'n/a'}")
    metrics = target.get("metrics") or []
    if metrics:
        print("Metrics:")
        for metric in metrics[:5]:
            print(
                f"  - {metric.get('metric_name')} | {metric.get('demographic_group') or 'n/a'} | "
                f"{metric.get('before_value') or 'n/a'} -> {metric.get('after_value') or 'n/a'} {metric.get('unit') or ''}".strip()
            )


def build_manual_draft_interactive(target: dict[str, Any]) -> dict[str, Any] | None:
    print_policy_context(target)
    category = prompt_text(
        "Intent category (equity_expanding/equity_restricting/neutral_administrative, blank to skip)"
    )
    if not category:
        return None
    category = category.strip().lower().replace("-", "_")
    if category not in VALID_OPERATOR_INTENT_CATEGORIES:
        print(f"Skipping: invalid intent category {category!r}.")
        return None
    summary = normalize_nullable_text(prompt_text("Neutral intent summary"))
    if not summary:
        print("Skipping: intent summary is required when category is selected.")
        return None
    source_reference = normalize_nullable_text(prompt_text("Source/reference note (optional)"))
    operator_note = normalize_nullable_text(prompt_text("Operator note (optional)"))
    return {
        "policy_intent_category": category,
        "policy_intent_summary": summary,
        "source_reference": source_reference,
        "operator_note": operator_note,
    }


def fetch_coverage(cursor) -> dict[str, Any]:
    cursor.execute(
        """
        SELECT
          COUNT(*) AS total_policies,
          SUM(CASE WHEN policy_intent_category IS NOT NULL THEN 1 ELSE 0 END) AS classified_policies,
          SUM(CASE WHEN policy_intent_category IS NULL THEN 1 ELSE 0 END) AS unclassified_policies
        FROM policies
        WHERE COALESCE(is_archived, 0) = 0
        """
    )
    row = cursor.fetchone() or {}
    total = int(row.get("total_policies") or 0)
    classified = int(row.get("classified_policies") or 0)
    unclassified = int(row.get("unclassified_policies") or 0)
    return {
        "total_policies": total,
        "classified_policies": classified,
        "unclassified_policies": unclassified,
        "classified_policy_pct": round(classified / total, 4) if total else 0,
        "unclassified_policy_pct": round(unclassified / total, 4) if total else 0,
    }


def fetch_metrics(cursor, policy_ids: list[int]) -> dict[int, list[dict[str, Any]]]:
    if not policy_ids:
        return {}
    placeholders = ", ".join(["%s"] * len(policy_ids))
    cursor.execute(
        f"""
        SELECT policy_id, metric_name, demographic_group, before_value, after_value, unit, geography, year_before, year_after
        FROM metrics
        WHERE policy_id IN ({placeholders})
        ORDER BY policy_id ASC, id ASC
        """,
        policy_ids,
    )
    grouped: dict[int, list[dict[str, Any]]] = {policy_id: [] for policy_id in policy_ids}
    for row in list(cursor.fetchall() or []):
        grouped.setdefault(int(row["policy_id"]), []).append(
            {
                "metric_name": row.get("metric_name"),
                "demographic_group": row.get("demographic_group"),
                "before_value": str(row["before_value"]) if row.get("before_value") is not None else None,
                "after_value": str(row["after_value"]) if row.get("after_value") is not None else None,
                "unit": row.get("unit"),
                "geography": row.get("geography"),
                "year_before": row.get("year_before"),
                "year_after": row.get("year_after"),
            }
        )
    return grouped


def fetch_targets(cursor, args: argparse.Namespace) -> list[dict[str, Any]]:
    params: list[Any] = []
    filters = ["p.policy_intent_category IS NULL", "COALESCE(p.is_archived, 0) = 0"]
    if args.only_policy_id:
        placeholders = ", ".join(["%s"] * len(args.only_policy_id))
        filters.append(f"p.id IN ({placeholders})")
        params.extend(args.only_policy_id)
    sql = f"""
        SELECT
          p.id AS policy_id,
          p.title,
          p.summary,
          p.outcome_summary,
          p.year_enacted,
          p.status,
          p.impact_direction,
          p.policy_intent_summary,
          p.policy_intent_category,
          pr.full_name AS president_name,
          er.name AS era_name,
          GROUP_CONCAT(DISTINCT pc.name ORDER BY pc.name SEPARATOR ', ') AS categories,
          (
            (COALESCE(ps.directness_score, 0) * 2)
            + (COALESCE(ps.material_impact_score, 0) * 2)
            + COALESCE(ps.evidence_score, 0)
            + COALESCE(ps.durability_score, 0)
            + (COALESCE(ps.equity_score, 0) * 2)
            - COALESCE(ps.harm_offset_score, 0)
          ) AS impact_score
        FROM policies p
        LEFT JOIN presidents pr ON pr.id = p.president_id
        LEFT JOIN eras er ON er.id = p.era_id
        LEFT JOIN policy_scores ps ON ps.policy_id = p.id
        LEFT JOIN policy_policy_categories ppc ON ppc.policy_id = p.id
        LEFT JOIN policy_categories pc ON pc.id = ppc.category_id
        WHERE {" AND ".join(filters)}
        GROUP BY
          p.id,
          p.title,
          p.summary,
          p.outcome_summary,
          p.year_enacted,
          p.status,
          p.impact_direction,
          p.policy_intent_summary,
          p.policy_intent_category,
          pr.full_name,
          er.name,
          ps.directness_score,
          ps.material_impact_score,
          ps.evidence_score,
          ps.durability_score,
          ps.equity_score,
          ps.harm_offset_score
        ORDER BY impact_score DESC, p.year_enacted ASC, p.id ASC
    """
    if args.limit is not None and args.limit > 0:
        sql += "\nLIMIT %s"
        params.append(args.limit)
    cursor.execute(sql, params)
    targets = list(cursor.fetchall() or [])
    metrics = fetch_metrics(cursor, [int(row["policy_id"]) for row in targets])
    for target in targets:
        target["metrics"] = metrics.get(int(target["policy_id"]), [])
    return targets


def target_summary(target: dict[str, Any], status: str) -> dict[str, Any]:
    return {
        "policy_id": int(target["policy_id"]),
        "title": target.get("title"),
        "year_enacted": target.get("year_enacted"),
        "status": target.get("status"),
        "impact_direction": target.get("impact_direction"),
        "impact_score": int(target["impact_score"]) if target.get("impact_score") is not None else None,
        "president_name": target.get("president_name"),
        "era_name": target.get("era_name"),
        "categories": target.get("categories"),
        "summary": target.get("summary"),
        "outcome_summary": target.get("outcome_summary"),
        "metrics": target.get("metrics", [])[:5],
        "status_reason": status,
    }


def build_plan(target: dict[str, Any], draft: dict[str, Any], generated_at: str) -> dict[str, Any]:
    warnings = []
    if target.get("policy_intent_summary"):
        warnings.append("existing policy_intent_summary will be preserved; summary is not overwritten")
    if not draft.get("source_reference"):
        warnings.append("no source/reference note recorded; operator is responsible for documentation outside this artifact")
    return {
        "status": "ready",
        "policy_id": int(target["policy_id"]),
        "title": target.get("title"),
        "year_enacted": target.get("year_enacted"),
        "impact_score": int(target["impact_score"]) if target.get("impact_score") is not None else None,
        "existing_policy_intent_summary": target.get("policy_intent_summary"),
        "existing_policy_intent_category": target.get("policy_intent_category"),
        "policy_intent_category": draft["policy_intent_category"],
        "policy_intent_summary": draft["policy_intent_summary"],
        "source_reference": draft.get("source_reference"),
        "operator_note": draft.get("operator_note"),
        "curated_at": generated_at,
        "summary_storage_action": "preserve_existing_summary" if target.get("policy_intent_summary") else "write_summary",
        "category_storage_action": "write_category_if_still_null",
        "warnings": warnings,
        "context": target_summary(target, "selected_for_manual_intent_curation"),
    }


def apply_plan(cursor, plan: dict[str, Any]) -> dict[str, Any]:
    cursor.execute(
        """
        UPDATE policies
        SET
          policy_intent_category = %s,
          policy_intent_summary = CASE
            WHEN policy_intent_summary IS NULL OR TRIM(policy_intent_summary) = '' THEN %s
            ELSE policy_intent_summary
          END
        WHERE id = %s
          AND policy_intent_category IS NULL
        """,
        (
            plan["policy_intent_category"],
            plan["policy_intent_summary"],
            plan["policy_id"],
        ),
    )
    return {
        "policy_id": plan["policy_id"],
        "rows_updated": int(cursor.rowcount or 0),
        "policy_intent_category": plan["policy_intent_category"],
        "summary_storage_action": plan["summary_storage_action"],
        "source_reference": plan.get("source_reference"),
        "curated_at": plan["curated_at"],
    }


def category_distribution(cursor) -> dict[str, int]:
    cursor.execute(
        """
        SELECT COALESCE(policy_intent_category, 'unclassified') AS category, COUNT(*) AS count
        FROM policies
        WHERE COALESCE(is_archived, 0) = 0
        GROUP BY COALESCE(policy_intent_category, 'unclassified')
        ORDER BY category
        """
    )
    return {str(row["category"]): int(row["count"] or 0) for row in list(cursor.fetchall() or [])}


def build_report(args: argparse.Namespace) -> dict[str, Any]:
    require_apply_confirmation(args.apply, args.yes)
    if args.limit is not None and args.limit < 1:
        raise SystemExit("--limit must be >= 1")

    generated_at = utc_timestamp()
    arg_draft = build_manual_draft_from_args(args)
    plans: list[dict[str, Any]] = []
    skipped_targets: list[dict[str, Any]] = []
    applied: list[dict[str, Any]] = []

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            ensure_policy_intent_storage(cursor)
            coverage_before = fetch_coverage(cursor)
            distribution_before = category_distribution(cursor)
            targets = fetch_targets(cursor, args)

            for target in targets:
                draft = arg_draft
                if draft is None and not args.non_interactive:
                    draft = build_manual_draft_interactive(target)
                if draft is None:
                    skipped_targets.append(target_summary(target, "skipped_by_operator_or_no_intent_input"))
                    continue
                plans.append(build_plan(target, draft, generated_at))

            if args.apply:
                for plan in plans:
                    applied.append({**plan, "apply_result": apply_plan(cursor, plan)})
                connection.commit()
            else:
                connection.rollback()

            coverage_after = fetch_coverage(cursor)
            distribution_after = category_distribution(cursor)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

    status_counts = Counter(plan["status"] for plan in plans)
    rows_updated = sum(int(item.get("apply_result", {}).get("rows_updated") or 0) for item in applied)
    projected_classified = min(
        coverage_before["classified_policies"] + int(status_counts.get("ready", 0)),
        coverage_before["total_policies"],
    )
    projected_unclassified = max(coverage_before["unclassified_policies"] - int(status_counts.get("ready", 0)), 0)
    return {
        "workflow": "manual_policy_intent_curation",
        "generated_at": generated_at,
        "mode": "apply" if args.apply else "dry_run",
        "scope": {
            "source_table": "policies",
            "target_fields": ["policy_intent_category", "policy_intent_summary"],
            "mutation_policy": "update_only_when_apply_yes_is_explicit_and_policy_intent_category_is_null",
            "allowed_operator_categories": sorted(VALID_OPERATOR_INTENT_CATEGORIES),
            "traceability": "policy_id, category, summary, timestamp, source_reference, and operator_note are recorded in this report artifact.",
        },
        "summary": {
            "target_count": len(plans) + len(skipped_targets),
            "ready_update_count": int(status_counts.get("ready", 0)),
            "skipped_count": len(skipped_targets),
            "rows_updated": rows_updated,
            "classified_before": coverage_before["classified_policies"],
            "unclassified_before": coverage_before["unclassified_policies"],
            "classified_after": coverage_after["classified_policies"],
            "unclassified_after": coverage_after["unclassified_policies"],
            "projected_classified_after_dry_run": projected_classified if not args.apply else coverage_after["classified_policies"],
            "projected_unclassified_after_dry_run": projected_unclassified if not args.apply else coverage_after["unclassified_policies"],
        },
        "coverage_before": coverage_before,
        "coverage_after": coverage_after,
        "category_distribution_before": distribution_before,
        "category_distribution_after": distribution_after,
        "plans": plans,
        "skipped_targets": skipped_targets,
        "applied": applied,
        "rules": {
            "manual_only": True,
            "summary_required_when_category_selected": True,
            "existing_intent_values_preserved": True,
            "scoring_formulas_changed": False,
            "schema_changed": False,
        },
    }


def main() -> None:
    args = parse_args()
    output_path = (args.output or default_output_path(args.apply)).resolve()
    report = build_report(args)
    write_json_file(output_path, report)
    print_json({"ok": True, "output": str(output_path), **report["summary"]})


if __name__ == "__main__":
    main()
