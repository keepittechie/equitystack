#!/usr/bin/env python3
import argparse
from collections import Counter
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from decimal import Decimal

from current_admin_common import (
    get_db_connection,
    get_reports_dir,
    normalize_nullable_text,
    print_json,
    require_apply_confirmation,
    utc_timestamp,
    write_json_file,
)


DIRECTION_FALLBACK_IMPACT_SCORE = {
    "Positive": 1.0,
    "Mixed": 0.5,
    "Negative": -1.0,
    "Blocked": 0.0,
}

ALLOWED_SOURCE_DOMAINS = {
    "archives.gov",
    "bidenwhitehouse.archives.gov",
    "cbo.gov",
    "congress.gov",
    "govinfo.gov",
    "healthcare.gov",
    "home.treasury.gov",
    "justice.gov",
    "obamawhitehouse.archives.gov",
    "senate.gov",
    "supremecourt.gov",
    "trumpwhitehouse.archives.gov",
    "whitehouse.gov",
}

# Curated official-source seeds for the top source_count=0 outcomes as of the
# certification audit. Do not add entries here unless the source is official and
# directly supports the specific outcome statement.
OFFICIAL_SOURCE_SEEDS: dict[int, dict[str, Any]] = {
    8: {
        "title": "Don't Ask, Don't Tell Repeal Act of 2010, Public Law 111-321",
        "url": "https://www.govinfo.gov/content/pkg/PLAW-111publ321/pdf/PLAW-111publ321.pdf",
        "publisher": "GovInfo",
    },
    9: {
        "title": "HealthCare.gov: Coverage for pre-existing conditions",
        "url": "https://www.healthcare.gov/coverage/pre-existing-conditions/",
        "publisher": "HealthCare.gov",
    },
    10: {
        "title": "Credit CARD Act of 2009, Public Law 111-24",
        "url": "https://www.govinfo.gov/content/pkg/PLAW-111publ24/pdf/PLAW-111publ24.pdf",
        "publisher": "GovInfo",
    },
    11: {
        "title": "Lilly Ledbetter Fair Pay Act of 2009, Public Law 111-2",
        "url": "https://www.govinfo.gov/content/pkg/PLAW-111publ2/pdf/PLAW-111publ2.pdf",
        "publisher": "GovInfo",
    },
    12: {
        "title": "American Recovery and Reinvestment Act of 2009, Public Law 111-5",
        "url": "https://www.govinfo.gov/content/pkg/PLAW-111publ5/pdf/PLAW-111publ5.pdf",
        "publisher": "GovInfo",
    },
    13: {
        "title": "Children's Health Insurance Program Reauthorization Act of 2009, Public Law 111-3",
        "url": "https://www.govinfo.gov/content/pkg/PLAW-111publ3/pdf/PLAW-111publ3.pdf",
        "publisher": "GovInfo",
    },
    14: {
        "title": "Executive Order 13505: Removing Barriers to Responsible Scientific Research Involving Human Stem Cells",
        "url": "https://obamawhitehouse.archives.gov/the-press-office/removing-barriers-responsible-scientific-research-involving-human-stem-cells",
        "publisher": "Obama White House Archives",
    },
    17: {
        "title": "Executive Order: Border Security and Immigration Enforcement Improvements",
        "url": "https://trumpwhitehouse.archives.gov/presidential-actions/executive-order-border-security-immigration-enforcement-improvements/",
        "publisher": "Trump White House Archives",
    },
    18: {
        "title": "Statement by President Trump on the Paris Climate Accord",
        "url": "https://trumpwhitehouse.archives.gov/briefings-statements/statement-president-trump-paris-climate-accord/",
        "publisher": "Trump White House Archives",
    },
    23: {
        "title": "Executive Order: Protecting the Nation from Foreign Terrorist Entry into the United States",
        "url": "https://trumpwhitehouse.archives.gov/presidential-actions/executive-order-protecting-nation-foreign-terrorist-entry-united-states/",
        "publisher": "Trump White House Archives",
    },
    25: {
        "title": "First Step Act of 2018, Public Law 115-391",
        "url": "https://www.govinfo.gov/content/pkg/PLAW-115publ391/pdf/PLAW-115publ391.pdf",
        "publisher": "GovInfo",
    },
    26: {
        "title": "Paris Climate Agreement",
        "url": "https://bidenwhitehouse.archives.gov/briefing-room/statements-releases/2021/01/20/paris-climate-agreement/",
        "publisher": "Biden White House Archives",
    },
    27: {
        "title": "Executive Order on Protecting Public Health and the Environment and Restoring Science to Tackle the Climate Crisis",
        "url": "https://bidenwhitehouse.archives.gov/briefing-room/presidential-actions/2021/01/20/executive-order-protecting-public-health-and-environment-and-restoring-science-to-tackle-climate-crisis/",
        "publisher": "Biden White House Archives",
    },
    28: {
        "title": "President Biden Nominates Judge Ketanji Brown Jackson to Serve as Associate Justice",
        "url": "https://bidenwhitehouse.archives.gov/briefing-room/statements-releases/2022/02/25/president-biden-nominates-judge-ketanji-brown-jackson-to-serve-as-associate-justice-of-the-u-s-supreme-court/",
        "publisher": "Biden White House Archives",
    },
    31: {
        "title": "Infrastructure Investment and Jobs Act, H.R. 3684",
        "url": "https://www.congress.gov/bill/117th-congress/house-bill/3684",
        "publisher": "Congress.gov",
    },
    32: {
        "title": "Executive Order on Enabling All Qualified Americans to Serve Their Country in Uniform",
        "url": "https://bidenwhitehouse.archives.gov/briefing-room/presidential-actions/2021/01/25/executive-order-on-enabling-all-qualified-americans-to-serve-their-country-in-uniform/",
        "publisher": "Biden White House Archives",
    },
    33: {
        "title": "Fact Sheet on Meeting 200 Million Shots Goal in the First 100 Days",
        "url": "https://bidenwhitehouse.archives.gov/briefing-room/statements-releases/2021/04/21/fact-sheet-president-biden-to-call-on-all-employers-to-provide-paid-time-off-for-employees-to-get-vaccinated-after-meeting-goal-of-200-million-shots-in-the-first-100-days/",
        "publisher": "Biden White House Archives",
    },
    36: {
        "title": "Treasury: Home Affordable Modification Program",
        "url": "https://home.treasury.gov/data/troubled-assets-relief-program/housing/mha/hamp",
        "publisher": "U.S. Department of the Treasury",
    },
    38: {
        "title": "FUTURE Act, Public Law 116-91",
        "url": "https://www.govinfo.gov/content/pkg/PLAW-116publ91/pdf/PLAW-116publ91.pdf",
        "publisher": "GovInfo",
    },
    40: {
        "title": "Biden-Harris Administration Announces Record Support for HBCUs",
        "url": "https://bidenwhitehouse.archives.gov/briefing-room/statements-releases/2024/05/16/fact-sheet-biden-harris-administration-announces-record-over-16-billion-in-support-for-historically-black-colleges-and-universities-hbcus/",
        "publisher": "Biden White House Archives",
    },
    43: {
        "title": "CBO estimate for the American Health Care Act",
        "url": "https://www.cbo.gov/publication/52486",
        "publisher": "Congressional Budget Office",
    },
    48: {
        "title": "U.S. Senate: Enforcement Acts",
        "url": "https://www.senate.gov/artandhistory/history/common/generic/EnforcementActs.htm",
        "publisher": "United States Senate",
    },
    49: {
        "title": "National Archives: Voting Rights Act",
        "url": "https://www.archives.gov/milestone-documents/voting-rights-act",
        "publisher": "National Archives",
    },
    50: {
        "title": "Department of Justice: Fair Housing Act",
        "url": "https://www.justice.gov/crt/fair-housing-act-1",
        "publisher": "U.S. Department of Justice",
    },
    52: {
        "title": "Statement from President Biden on Federal Death Row Commutations",
        "url": "https://bidenwhitehouse.archives.gov/briefing-room/statements-releases/2024/12/23/statement-from-president-joe-biden-on-federal-death-row-commutations/",
        "publisher": "Biden White House Archives",
    },
    53: {
        "title": "Supreme Court of the United States: Current and Historical Members",
        "url": "https://www.supremecourt.gov/about/members_text.aspx",
        "publisher": "Supreme Court of the United States",
    },
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Safely complete production-readiness backfills for certification."
    )
    parser.add_argument("--output", type=Path, help="Readiness completion report JSON path")
    parser.add_argument("--apply", action="store_true", help="Apply schema/data changes")
    parser.add_argument("--yes", action="store_true", help="Required confirmation for --apply")
    parser.add_argument("--source-limit", type=int, default=25, help="Top missing-source outcomes to attempt")
    return parser.parse_args()


def default_output_path(apply: bool) -> Path:
    suffix = "apply" if apply else "dry-run"
    return get_reports_dir() / f"production-certification-readiness-completion.{suffix}.json"


def table_columns(cursor, table_name: str) -> set[str]:
    cursor.execute(f"SHOW COLUMNS FROM {table_name}")
    return {str(row["Field"]) for row in cursor.fetchall() or []}


def add_impact_score_column(cursor) -> bool:
    columns = table_columns(cursor, "policy_outcomes")
    if "impact_score" in columns:
        return False
    cursor.execute("ALTER TABLE policy_outcomes ADD COLUMN impact_score FLOAT NULL AFTER source_quality")
    return True


def normalize_direction(value: Any) -> str | None:
    text = normalize_nullable_text(value)
    if text is None:
        return None
    for direction in DIRECTION_FALLBACK_IMPACT_SCORE:
        if text.lower() == direction.lower():
            return direction
    return None


def fallback_impact_score(direction: Any) -> float:
    return DIRECTION_FALLBACK_IMPACT_SCORE.get(normalize_direction(direction), 0.0)


def backfill_impact_scores(cursor, apply: bool) -> dict[str, Any]:
    cursor.execute(
        """
        SELECT id, policy_type, policy_id, impact_direction, impact_score
        FROM policy_outcomes
        ORDER BY id ASC
        """
    )
    rows = list(cursor.fetchall() or [])
    updates = []
    for row in rows:
        if row.get("impact_score") is not None:
            continue
        score = fallback_impact_score(row.get("impact_direction"))
        updates.append(
            {
                "policy_outcome_id": int(row["id"]),
                "policy_type": row.get("policy_type"),
                "policy_id": int(row["policy_id"]),
                "impact_direction": row.get("impact_direction"),
                "impact_score": score,
                "source": "direction_fallback",
            }
        )
    if apply:
        for update in updates:
            cursor.execute(
                "UPDATE policy_outcomes SET impact_score = %s WHERE id = %s AND impact_score IS NULL",
                (update["impact_score"], update["policy_outcome_id"]),
            )
    return {
        "rows_filled": len(updates),
        "historical_score_mapped_count": 0,
        "fallback_score_count": len(updates),
        "sample_updates": updates[:25],
    }


def impact_score_validation(cursor) -> dict[str, Any]:
    cursor.execute(
        """
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN impact_score IS NULL THEN 1 ELSE 0 END) AS null_count,
          SUM(CASE WHEN impact_score < -100 OR impact_score > 100 THEN 1 ELSE 0 END) AS out_of_bounds_count
        FROM policy_outcomes
        """
    )
    row = cursor.fetchone() or {}
    total = int(row.get("total") or 0)
    null_count = int(row.get("null_count") or 0)
    return {
        "total_policy_outcomes": total,
        "null_impact_score_count": null_count,
        "out_of_bounds_count": int(row.get("out_of_bounds_count") or 0),
        "impact_score_coverage_pct": round((total - null_count) / total, 4) if total else 0,
    }


def normalize_url(url: str) -> str:
    return url.rstrip("/").strip().lower()


def json_safe(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [json_safe(item) for item in value]
    return value


def allowed_official_source(url: str) -> bool:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return False
    domain = parsed.netloc.lower().removeprefix("www.")
    return any(domain == allowed or domain.endswith(f".{allowed}") for allowed in ALLOWED_SOURCE_DOMAINS)


def infer_source_type(url: str) -> str:
    domain = urlparse(url).netloc.lower()
    if "archives.gov" in domain:
        return "Archive"
    return "Government"


def find_source_by_url(cursor, url: str) -> int | None:
    cursor.execute(
        """
        SELECT id
        FROM sources
        WHERE LOWER(TRIM(TRAILING '/' FROM source_url)) = LOWER(TRIM(TRAILING '/' FROM %s))
        ORDER BY id ASC
        LIMIT 1
        """,
        (url,),
    )
    row = cursor.fetchone()
    return int(row["id"]) if row else None


def insert_or_get_source(cursor, seed: dict[str, Any], policy_outcome_id: int, generated_at: str, apply: bool) -> tuple[int | None, bool]:
    source_id = find_source_by_url(cursor, seed["url"])
    if source_id is not None:
        return source_id, False
    if not apply:
        return None, True
    cursor.execute(
        """
        INSERT INTO sources (
          policy_id,
          source_title,
          source_url,
          source_type,
          publisher,
          published_date,
          notes
        ) VALUES (NULL, %s, %s, %s, %s, NULL, %s)
        """,
        (
            seed["title"],
            seed["url"],
            infer_source_type(seed["url"]),
            seed.get("publisher"),
            f"EquityStack certification source backfill at {generated_at} | policy_outcome_id={policy_outcome_id}",
        ),
    )
    return int(cursor.lastrowid), True


def find_promise_outcome_id(cursor, policy_outcome_id: int) -> int | None:
    cursor.execute(
        """
        SELECT po.policy_id, po.outcome_summary
        FROM policy_outcomes po
        WHERE po.id = %s
          AND po.policy_type = 'current_admin'
        """,
        (policy_outcome_id,),
    )
    target = cursor.fetchone()
    if not target:
        return None
    cursor.execute(
        """
        SELECT id
        FROM promise_outcomes
        WHERE promise_id = %s
          AND TRIM(outcome_summary) = TRIM(%s)
        ORDER BY id ASC
        """,
        (target["policy_id"], target["outcome_summary"]),
    )
    rows = list(cursor.fetchall() or [])
    if len(rows) != 1:
        return None
    return int(rows[0]["id"])


def link_exists(cursor, promise_outcome_id: int, source_id: int) -> bool:
    cursor.execute(
        """
        SELECT 1
        FROM promise_outcome_sources
        WHERE promise_outcome_id = %s
          AND source_id = %s
        LIMIT 1
        """,
        (promise_outcome_id, source_id),
    )
    return cursor.fetchone() is not None


def sync_policy_outcome_source_count(cursor, policy_outcome_id: int, promise_outcome_id: int, apply: bool) -> dict[str, Any]:
    cursor.execute(
        """
        SELECT COUNT(DISTINCT source_id) AS source_count
        FROM promise_outcome_sources
        WHERE promise_outcome_id = %s
        """,
        (promise_outcome_id,),
    )
    source_count = int((cursor.fetchone() or {}).get("source_count") or 0)
    source_quality = "high" if source_count > 0 else None
    if apply:
        cursor.execute(
            """
            UPDATE policy_outcomes
            SET source_count = %s,
                source_quality = %s
            WHERE id = %s
            """,
            (source_count, source_quality, policy_outcome_id),
        )
    return {"source_count": source_count, "source_quality": source_quality}


def fetch_source_targets(cursor, limit: int, has_impact_score: bool) -> list[dict[str, Any]]:
    impact_score_expr = "po.impact_score" if has_impact_score else """
          CASE po.impact_direction
            WHEN 'Positive' THEN 1.0
            WHEN 'Mixed' THEN 0.5
            WHEN 'Negative' THEN -1.0
            WHEN 'Blocked' THEN 0.0
            ELSE 0.0
          END
    """
    cursor.execute(
        f"""
        SELECT
          po.id AS policy_outcome_id,
          po.policy_id,
          po.record_key,
          {impact_score_expr} AS impact_score,
          po.impact_direction,
          po.source_count,
          po.outcome_summary,
          p.title AS policy_title
        FROM policy_outcomes po
        JOIN promises p
          ON po.policy_type = 'current_admin'
         AND p.id = po.policy_id
        WHERE po.source_count = 0
        ORDER BY ABS(COALESCE(impact_score, 0)) DESC,
          CASE po.impact_direction WHEN 'Positive' THEN 0 WHEN 'Negative' THEN 0 WHEN 'Mixed' THEN 1 ELSE 2 END,
          po.id ASC
        LIMIT %s
        """,
        (limit,),
    )
    return list(cursor.fetchall() or [])


def attach_official_sources(cursor, apply: bool, generated_at: str, limit: int) -> dict[str, Any]:
    targets = fetch_source_targets(cursor, limit, "impact_score" in table_columns(cursor, "policy_outcomes"))
    planned = []
    applied = []
    skipped = []
    sources_added = 0
    links_created = 0

    for target in targets:
        policy_outcome_id = int(target["policy_outcome_id"])
        seed = OFFICIAL_SOURCE_SEEDS.get(policy_outcome_id)
        if seed is None:
            skipped.append(json_safe({**target, "skip_reason": "no_curated_official_source_seed"}))
            continue
        if not allowed_official_source(seed["url"]):
            skipped.append(json_safe({**target, "skip_reason": "source_domain_not_allowed", "source_url": seed["url"]}))
            continue
        promise_outcome_id = find_promise_outcome_id(cursor, policy_outcome_id)
        if promise_outcome_id is None:
            skipped.append(json_safe({**target, "skip_reason": "no_unique_promise_outcome_match", "source_url": seed["url"]}))
            continue
        existing_source_id = find_source_by_url(cursor, seed["url"])
        plan = {
            "policy_outcome_id": policy_outcome_id,
            "promise_outcome_id": promise_outcome_id,
            "policy_title": target.get("policy_title"),
            "impact_score": float(target.get("impact_score") or 0),
            "impact_direction": target.get("impact_direction"),
            "source": seed,
            "storage_action": "reuse_existing_source" if existing_source_id else "create_source",
        }
        planned.append(plan)
        if not apply:
            continue
        source_id, created = insert_or_get_source(cursor, seed, policy_outcome_id, generated_at, apply=True)
        if source_id is None:
            skipped.append(json_safe({**plan, "skip_reason": "source_id_unavailable"}))
            continue
        if created:
            sources_added += 1
        if not link_exists(cursor, promise_outcome_id, source_id):
            cursor.execute(
                """
                INSERT INTO promise_outcome_sources (promise_outcome_id, source_id)
                VALUES (%s, %s)
                """,
                (promise_outcome_id, source_id),
            )
            links_created += 1
        metadata = sync_policy_outcome_source_count(cursor, policy_outcome_id, promise_outcome_id, apply=True)
        applied.append({**plan, "source_id": source_id, "metadata": metadata})

    return {
        "targets_considered": len(targets),
        "planned_count": len(planned),
        "outcomes_updated": len(applied),
        "sources_added": sources_added,
        "links_created": links_created,
        "skipped_count": len(skipped),
        "planned": planned,
        "applied": applied,
        "skipped": skipped,
    }


def source_coverage(cursor) -> dict[str, Any]:
    cursor.execute(
        """
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN source_count > 0 THEN 1 ELSE 0 END) AS with_sources,
          SUM(CASE WHEN source_count = 0 THEN 1 ELSE 0 END) AS without_sources,
          AVG(source_count) AS avg_source_count
        FROM policy_outcomes
        """
    )
    row = cursor.fetchone() or {}
    total = int(row.get("total") or 0)
    with_sources = int(row.get("with_sources") or 0)
    return {
        "total": total,
        "with_sources": with_sources,
        "without_sources": int(row.get("without_sources") or 0),
        "source_coverage_pct": round(with_sources / total, 4) if total else 0,
        "average_source_count": float(row.get("avg_source_count") or 0),
    }


def policy_outcome_breakdown(cursor) -> dict[str, int]:
    cursor.execute("SELECT policy_type, COUNT(*) AS count FROM policy_outcomes GROUP BY policy_type ORDER BY policy_type")
    return {str(row["policy_type"]): int(row["count"]) for row in cursor.fetchall() or []}


def build_report(args: argparse.Namespace) -> dict[str, Any]:
    require_apply_confirmation(args.apply, args.yes)
    generated_at = utc_timestamp()
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            before_columns = table_columns(cursor, "policy_outcomes")
            before_row_count = count_policy_outcomes(cursor)
            before_source_coverage = source_coverage(cursor)
            column_added = False
            if args.apply:
                column_added = add_impact_score_column(cursor)
            after_column_check = table_columns(cursor, "policy_outcomes")
            impact_backfill = (
                backfill_impact_scores(cursor, args.apply)
                if "impact_score" in after_column_check or args.apply
                else {"rows_filled": 0, "blocked": "impact_score column does not exist in dry-run"}
            )
            source_update = attach_official_sources(cursor, args.apply, generated_at, args.source_limit)
            after_source_coverage = source_coverage(cursor)
            impact_validation = impact_score_validation(cursor) if "impact_score" in table_columns(cursor, "policy_outcomes") else {}
            breakdown = policy_outcome_breakdown(cursor)
            if args.apply:
                connection.commit()
            else:
                connection.rollback()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

    return {
        "workflow": "production_certification_readiness_completion",
        "generated_at": generated_at,
        "mode": "apply" if args.apply else "dry_run",
        "database_mutated": bool(args.apply),
        "impact_score_status": {
            "column_existed_before": "impact_score" in before_columns,
            "column_added": column_added,
            "rows_before": before_row_count,
            **impact_backfill,
            "validation": impact_validation,
        },
        "source_update_summary": {
            "coverage_before": before_source_coverage,
            "coverage_after": after_source_coverage,
            **source_update,
        },
        "policy_outcome_breakdown": breakdown,
        "notes": [
            "impact_score uses deterministic direction fallback because current_admin policy_outcomes do not deterministically map to historical policy_scores.",
            "Only curated official-source seeds are inserted; missing seeds are skipped.",
            "Legislative materialization is executed separately through ./python/bin/equitystack legislative materialize-outcomes --apply --yes.",
        ],
    }


def count_policy_outcomes(cursor) -> int:
    cursor.execute("SELECT COUNT(*) AS count FROM policy_outcomes")
    return int((cursor.fetchone() or {}).get("count") or 0)


def main() -> None:
    args = parse_args()
    output_path = (args.output or default_output_path(args.apply)).resolve()
    report = build_report(args)
    write_json_file(output_path, report)
    print_json(
        {
            "ok": True,
            "output": str(output_path),
            "mode": report["mode"],
            "impact_score_status": {
                "column_added": report["impact_score_status"]["column_added"],
                "rows_filled": report["impact_score_status"].get("rows_filled", 0),
                "validation": report["impact_score_status"].get("validation", {}),
            },
            "source_update_summary": {
                "outcomes_updated": report["source_update_summary"]["outcomes_updated"],
                "sources_added": report["source_update_summary"]["sources_added"],
                "skipped_count": report["source_update_summary"]["skipped_count"],
            },
            "policy_outcome_breakdown": report["policy_outcome_breakdown"],
            "database_mutated": report["database_mutated"],
        }
    )


if __name__ == "__main__":
    main()
