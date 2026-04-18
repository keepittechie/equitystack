#!/usr/bin/env python3
import argparse
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from current_admin_common import (
    get_db_connection,
    get_reports_dir,
    normalize_nullable_text,
    print_json,
    utc_timestamp,
    write_json_file,
)


HIGH_AUTHORITY_DOMAINS = {
    "archives.gov",
    "cdc.gov",
    "census.gov",
    "congress.gov",
    "crsreports.congress.gov",
    "doi.gov",
    "doj.gov",
    "ed.gov",
    "epa.gov",
    "federalregister.gov",
    "gao.gov",
    "govinfo.gov",
    "grants.gov",
    "hud.gov",
    "justice.gov",
    "loc.gov",
    "nih.gov",
    "nsf.gov",
    "regulations.gov",
    "supremecourt.gov",
    "transportation.gov",
    "uscourts.gov",
    "usda.gov",
    "va.gov",
    "whitehouse.gov",
}

INSTITUTIONAL_DOMAINS = {
    "presidency.ucsb.edu",
    "supreme.justia.com",
}

SECONDARY_DOMAINS = {
    "apnews.com",
    "bbc.com",
    "nytimes.com",
    "politifact.com",
    "propublica.org",
    "reuters.com",
    "washingtonpost.com",
}

QUALITY_SCORES = {
    "high_authority": 1.0,
    "institutional": 0.8,
    "secondary": 0.55,
    "low_unverified": 0.25,
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Read-only source quality and duplicate URL audit."
    )
    parser.add_argument("--output", type=Path, help="Source quality audit report JSON path")
    parser.add_argument("--top-limit", type=int, default=25, help="Limit top domain/source duplicate samples")
    return parser.parse_args()


def default_output_path() -> Path:
    return get_reports_dir() / "source-quality-audit.json"


def normalize_domain(value: Any) -> str | None:
    text = normalize_nullable_text(value)
    if text is None:
        return None
    if "://" not in text:
        text = f"https://{text}"
    try:
        hostname = urlparse(text).hostname
    except ValueError:
        return None
    if not hostname:
        return None
    hostname = hostname.lower()
    if hostname.startswith("www."):
        hostname = hostname[4:]
    return hostname or None


def domain_matches(domain: str | None, allowed: set[str]) -> bool:
    if not domain:
        return False
    return any(domain == item or domain.endswith(f".{item}") for item in allowed)


def looks_governmental(source: dict[str, Any]) -> bool:
    source_type = (normalize_nullable_text(source.get("source_type")) or "").lower()
    publisher = (normalize_nullable_text(source.get("publisher")) or "").lower()
    return (
        source_type == "government"
        or "department of" in publisher
        or "u.s." in publisher
        or "united states" in publisher
        or "congress" in publisher
        or "white house" in publisher
    )


def looks_institutional(source: dict[str, Any], domain: str | None) -> bool:
    source_type = (normalize_nullable_text(source.get("source_type")) or "").lower()
    publisher = (normalize_nullable_text(source.get("publisher")) or "").lower()
    return (
        source_type in {"archive", "academic", "research"}
        or bool(domain and domain.endswith(".edu"))
        or "university" in publisher
        or "college" in publisher
        or "institute" in publisher
        or "archive" in publisher
        or "library" in publisher
    )


def classify_source_quality(source: dict[str, Any]) -> dict[str, Any]:
    domain = normalize_domain(source.get("source_url"))
    if domain_matches(domain, HIGH_AUTHORITY_DOMAINS) or looks_governmental(source):
        label = "high_authority"
        rationale = "official government/legal source"
    elif domain_matches(domain, INSTITUTIONAL_DOMAINS) or looks_institutional(source, domain):
        label = "institutional"
        rationale = "institutional, archive, academic, or official organization source"
    elif domain_matches(domain, SECONDARY_DOMAINS) or (normalize_nullable_text(source.get("source_type")) or "").lower() in {
        "news",
        "journalism",
        "analysis",
    }:
        label = "secondary"
        rationale = "secondary reporting or analysis source"
    else:
        label = "low_unverified"
        rationale = "unverified or uncategorized source authority"
    return {
        "source_quality_label": label,
        "source_quality_score": QUALITY_SCORES[label],
        "domain": domain,
        "rationale": rationale,
    }


def fetch_sources(cursor) -> list[dict[str, Any]]:
    cursor.execute(
        """
        SELECT
          s.id,
          s.policy_id,
          s.source_title,
          s.source_url,
          s.source_type,
          s.publisher,
          s.published_date,
          COALESCE(ps_counts.promise_refs, 0) AS promise_refs,
          COALESCE(pas_counts.action_refs, 0) AS action_refs,
          COALESCE(pos_counts.outcome_refs, 0) AS outcome_refs
        FROM sources s
        LEFT JOIN (
          SELECT source_id, COUNT(*) AS promise_refs
          FROM promise_sources
          GROUP BY source_id
        ) ps_counts ON ps_counts.source_id = s.id
        LEFT JOIN (
          SELECT source_id, COUNT(*) AS action_refs
          FROM promise_action_sources
          GROUP BY source_id
        ) pas_counts ON pas_counts.source_id = s.id
        LEFT JOIN (
          SELECT source_id, COUNT(*) AS outcome_refs
          FROM policy_outcome_sources
          GROUP BY source_id
        ) pos_counts ON pos_counts.source_id = s.id
        ORDER BY s.id ASC
        """
    )
    return list(cursor.fetchall() or [])


def fetch_outcome_source_rows(cursor) -> list[dict[str, Any]]:
    cursor.execute(
        """
        SELECT
          po.id AS policy_outcome_id,
          po.policy_type,
          po.policy_id,
          CASE WHEN po.policy_type = 'current_admin' THEN p.slug ELSE tb.bill_number END AS policy_reference,
          s.id AS source_id,
          s.source_title,
          s.source_url,
          s.source_type,
          s.publisher
        FROM policy_outcomes po
        LEFT JOIN promises p
          ON po.policy_type = 'current_admin'
         AND p.id = po.policy_id
        LEFT JOIN tracked_bills tb
          ON po.policy_type = 'legislative'
         AND tb.id = po.policy_id
        LEFT JOIN policy_outcome_sources pos ON pos.policy_outcome_id = po.id
        LEFT JOIN sources s ON s.id = pos.source_id
        ORDER BY po.id ASC, s.id ASC
        """
    )
    return list(cursor.fetchall() or [])


def duplicate_url_clusters(sources: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for source in sources:
        url = normalize_nullable_text(source.get("source_url"))
        if url:
            grouped[url.rstrip("/").lower()].append(source)

    clusters = []
    for url, rows in grouped.items():
        if len(rows) < 2:
            continue
        clusters.append(
            {
                "source_url": url,
                "duplicate_count": len(rows),
                "source_ids": [int(row["id"]) for row in rows],
                "distinct_titles": sorted(
                    {normalize_nullable_text(row.get("source_title")) or "<blank>" for row in rows}
                ),
                "distinct_source_types": sorted(
                    {normalize_nullable_text(row.get("source_type")) or "<blank>" for row in rows}
                ),
                "distinct_publishers": sorted(
                    {normalize_nullable_text(row.get("publisher")) or "<blank>" for row in rows}
                ),
                "total_refs": sum(
                    int(row.get("promise_refs") or 0)
                    + int(row.get("action_refs") or 0)
                    + int(row.get("outcome_refs") or 0)
                    for row in rows
                ),
            }
        )
    return sorted(clusters, key=lambda row: (row["duplicate_count"], row["total_refs"]), reverse=True)


def outcome_quality_summary(rows: list[dict[str, Any]]) -> dict[str, Any]:
    rows_by_outcome: dict[int, list[dict[str, Any]]] = defaultdict(list)
    promise_slug_by_outcome: dict[int, str | None] = {}
    for row in rows:
        outcome_id = int(row["policy_outcome_id"])
        promise_slug_by_outcome[outcome_id] = normalize_nullable_text(row.get("policy_reference"))
        if row.get("source_id") is not None:
            rows_by_outcome[outcome_id].append(row)

    total_outcomes = len({int(row["policy_outcome_id"]) for row in rows})
    outcomes_with_any_sources = 0
    outcomes_with_high_authority_sources = 0
    outcomes_by_quality = Counter()
    samples = []

    for outcome_id in sorted({int(row["policy_outcome_id"]) for row in rows}):
        source_rows = rows_by_outcome.get(outcome_id, [])
        if not source_rows:
            outcomes_by_quality["no_sources"] += 1
            continue
        outcomes_with_any_sources += 1
        labels = [classify_source_quality(source)["source_quality_label"] for source in source_rows]
        if "high_authority" in labels:
            outcomes_with_high_authority_sources += 1
            outcomes_by_quality["high_authority"] += 1
        elif "institutional" in labels:
            outcomes_by_quality["institutional"] += 1
        elif "secondary" in labels:
            outcomes_by_quality["secondary"] += 1
        else:
            outcomes_by_quality["low_unverified"] += 1
        if len(samples) < 20:
            samples.append(
                {
                    "policy_outcome_id": outcome_id,
                    "policy_reference": promise_slug_by_outcome.get(outcome_id),
                    "source_count": len(source_rows),
                    "quality_labels": sorted(set(labels)),
                }
            )

    return {
        "total_policy_outcomes": total_outcomes,
        "outcomes_with_any_sources": outcomes_with_any_sources,
        "outcomes_with_high_authority_sources": outcomes_with_high_authority_sources,
        "pct_sourced_outcomes_with_high_authority_sources": (
            round(outcomes_with_high_authority_sources / outcomes_with_any_sources, 4)
            if outcomes_with_any_sources
            else 0
        ),
        "outcomes_by_best_quality": dict(sorted(outcomes_by_quality.items())),
        "samples": samples,
    }


def build_report(args: argparse.Namespace) -> dict[str, Any]:
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            sources = fetch_sources(cursor)
            outcome_sources = fetch_outcome_source_rows(cursor)

        domain_counts = Counter()
        domain_quality_counts: dict[str, Counter] = defaultdict(Counter)
        quality_counts = Counter()
        source_type_quality_counts: dict[str, Counter] = defaultdict(Counter)
        classified_sources = []
        for source in sources:
            classified = classify_source_quality(source)
            domain = classified["domain"] or "<missing>"
            source_type = normalize_nullable_text(source.get("source_type")) or "<blank>"
            domain_counts[domain] += 1
            domain_quality_counts[domain][classified["source_quality_label"]] += 1
            quality_counts[classified["source_quality_label"]] += 1
            source_type_quality_counts[source_type][classified["source_quality_label"]] += 1
            classified_sources.append(
                {
                    "source_id": int(source["id"]),
                    "source_title": normalize_nullable_text(source.get("source_title")),
                    "source_url": normalize_nullable_text(source.get("source_url")),
                    "source_type": normalize_nullable_text(source.get("source_type")),
                    "publisher": normalize_nullable_text(source.get("publisher")),
                    **classified,
                }
            )

        duplicate_clusters = duplicate_url_clusters(sources)
        return {
            "workflow": "source_quality_audit",
            "mode": "read_only",
            "generated_at": utc_timestamp(),
            "scope": {
                "source_tables": [
                    "sources",
                    "promise_sources",
                    "promise_action_sources",
                    "policy_outcome_sources",
                    "policy_outcomes",
                ],
                "mutation_policy": "read_only_no_source_edits_no_duplicate_merges",
            },
            "classification_system": {
                "labels": [
                    "high_authority",
                    "institutional",
                    "secondary",
                    "low_unverified",
                ],
                "quality_tiers": {
                    "high_authority": QUALITY_SCORES["high_authority"],
                    "institutional": QUALITY_SCORES["institutional"],
                    "secondary": QUALITY_SCORES["secondary"],
                    "low_unverified": QUALITY_SCORES["low_unverified"],
                },
                "classification_inputs": [
                    "source_url_domain",
                    "source_type",
                    "publisher",
                ],
            },
            "summary": {
                "total_sources": len(sources),
                "quality_distribution": dict(sorted(quality_counts.items())),
                "domain_count": len(domain_counts),
                "duplicate_source_url_cluster_count": len(duplicate_clusters),
                "duplicate_source_row_count": sum(cluster["duplicate_count"] for cluster in duplicate_clusters),
                **{
                    f"source_quality_{label}_count": int(quality_counts.get(label, 0))
                    for label in QUALITY_SCORES
                },
            },
            "top_domains": [
                {
                    "domain": domain,
                    "source_count": count,
                    "quality_distribution": dict(sorted(domain_quality_counts[domain].items())),
                }
                for domain, count in domain_counts.most_common(max(0, args.top_limit))
            ],
            "source_type_quality_distribution": {
                source_type: dict(sorted(counter.items()))
                for source_type, counter in sorted(source_type_quality_counts.items())
            },
            "duplicate_source_url_clusters": duplicate_clusters[: max(0, args.top_limit)],
            "outcome_source_quality": outcome_quality_summary(outcome_sources),
            "sample_classified_sources": classified_sources[: max(0, args.top_limit)],
            "future_scoring_recommendations": [
                "Do not change current score formulas until source quality has been reviewed against false positives.",
                "Use high_authority_source_count as future debug metadata before turning it into a multiplier.",
                "Prefer source deduplication/canonicalization before making source_count more influential.",
                "Treat campaign or uncategorized .com sources as low_unverified unless paired with an official action or outcome source.",
            ],
        }
    finally:
        connection.close()


def main() -> None:
    args = parse_args()
    output_path = (args.output or default_output_path()).resolve()
    report = build_report(args)
    write_json_file(output_path, report)
    print_json(
        {
            "ok": True,
            "output": str(output_path),
            **report["summary"],
            "outcome_source_quality": report["outcome_source_quality"],
        }
    )


if __name__ == "__main__":
    main()
