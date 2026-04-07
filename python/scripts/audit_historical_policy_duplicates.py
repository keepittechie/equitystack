#!/usr/bin/env python3
import argparse
import re
from collections import defaultdict
from difflib import SequenceMatcher
from itertools import combinations
from pathlib import Path
from typing import Any

from current_admin_common import (
    get_db_connection,
    get_reports_dir,
    normalize_nullable_text,
    print_json,
    utc_timestamp,
    write_json_file,
)


PRIORITY_CATEGORIES = {
    "criminal justice",
    "housing",
    "voting rights",
    "education",
    "labor",
    "healthcare",
    "civil rights",
}

SENTENCING_TERMS = {"sentencing", "sentence", "crack", "cocaine", "crime", "violent", "justice"}
ROLLBACK_TERMS = {"rollback", "reform", "welfare", "discipline", "affirmative", "civil", "rights"}

STOPWORDS = {
    "a",
    "an",
    "and",
    "act",
    "acts",
    "amendment",
    "amendments",
    "bill",
    "federal",
    "for",
    "in",
    "law",
    "laws",
    "national",
    "of",
    "on",
    "program",
    "programs",
    "the",
    "to",
    "u",
    "us",
    "united",
    "states",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Read-only audit for likely duplicate or variant historical policies."
    )
    parser.add_argument("--output", type=Path, help="Candidate duplicate artifact JSON path")
    parser.add_argument("--include-archived", action="store_true", help="Include archived policies")
    parser.add_argument(
        "--min-score",
        type=float,
        default=0.58,
        help="Minimum similarity score for candidate pairs (default: 0.58)",
    )
    parser.add_argument(
        "--top-limit",
        type=int,
        default=20,
        help="Number of top likely duplicate/variant groups to emphasize (default: 20)",
    )
    return parser.parse_args()


def default_output_path() -> Path:
    return get_reports_dir() / "historical-policy-duplicate-audit.json"


def normalize_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def normalize_title(value: Any) -> str:
    text = normalize_text(value).lower()
    text = text.replace("&", " and ")
    text = re.sub(r"\([^)]*\)", " ", text)
    text = re.sub(r"\b(public law|pl|p\.l\.)\s*[\d-]+\b", " ", text)
    text = re.sub(r"\bof\s+\d{4}\b", " ", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return normalize_text(text)


def tokenize(value: Any) -> set[str]:
    tokens = set()
    for token in normalize_title(value).split():
        if len(token) < 3 or token in STOPWORDS:
            continue
        tokens.add(token)
    return tokens


def jaccard(left: set[str], right: set[str]) -> float:
    if not left or not right:
        return 0.0
    return len(left & right) / len(left | right)


def ratio(left: Any, right: Any) -> float:
    left_text = normalize_text(left)
    right_text = normalize_text(right)
    if not left_text or not right_text:
        return 0.0
    return SequenceMatcher(None, left_text, right_text).ratio()


def safe_int(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def normalized_url(value: Any) -> str | None:
    text = normalize_nullable_text(value)
    if text is None:
        return None
    return text.rstrip("/").lower()


def fetch_policy_rows(cursor, include_archived: bool) -> list[dict[str, Any]]:
    where = "" if include_archived else "WHERE COALESCE(p.is_archived, 0) = 0"
    cursor.execute(
        f"""
        SELECT
          p.id,
          p.title,
          p.summary,
          p.outcome_summary,
          p.impact_notes,
          p.year_enacted,
          p.date_enacted,
          p.policy_type,
          p.status,
          p.impact_direction,
          p.direct_black_impact,
          p.is_archived,
          er.name AS era_name,
          pres.full_name AS president_name
        FROM policies p
        LEFT JOIN eras er ON er.id = p.era_id
        LEFT JOIN presidents pres ON pres.id = p.president_id
        {where}
        ORDER BY p.year_enacted ASC, p.title ASC, p.id ASC
        """
    )
    return list(cursor.fetchall() or [])


def fetch_category_map(cursor) -> dict[int, list[str]]:
    cursor.execute(
        """
        SELECT ppc.policy_id, pc.name AS category_name
        FROM policy_policy_categories ppc
        JOIN policy_categories pc ON pc.id = ppc.category_id
        ORDER BY ppc.policy_id ASC, pc.name ASC
        """
    )
    categories: dict[int, list[str]] = defaultdict(list)
    for row in cursor.fetchall() or []:
        categories[int(row["policy_id"])].append(row["category_name"])
    return categories


def fetch_source_map(cursor) -> dict[int, list[dict[str, Any]]]:
    cursor.execute(
        """
        SELECT id, policy_id, source_title, source_url
        FROM sources
        WHERE policy_id IS NOT NULL
        ORDER BY policy_id ASC, id ASC
        """
    )
    sources: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for row in cursor.fetchall() or []:
        policy_id = row.get("policy_id")
        if policy_id is None:
            continue
        sources[int(policy_id)].append(
            {
                "source_id": int(row["id"]),
                "source_title": normalize_nullable_text(row.get("source_title")),
                "source_url": normalize_nullable_text(row.get("source_url")),
            }
        )
    return sources


def build_policy(row: dict[str, Any], categories: list[str], sources: list[dict[str, Any]]) -> dict[str, Any]:
    title = normalize_text(row.get("title"))
    summary_blob = " ".join(
        filter(
            None,
            [
                normalize_nullable_text(row.get("summary")),
                normalize_nullable_text(row.get("outcome_summary")),
                normalize_nullable_text(row.get("impact_notes")),
            ],
        )
    )
    category_set = {category.lower() for category in categories}
    source_urls = {url for url in (normalized_url(source.get("source_url")) for source in sources) if url}
    return {
        "id": int(row["id"]),
        "title": title,
        "normalized_title": normalize_title(title),
        "title_tokens": tokenize(title),
        "summary_text": normalize_text(summary_blob)[:1200],
        "year_enacted": safe_int(row.get("year_enacted")),
        "date_enacted": normalize_nullable_text(row.get("date_enacted")),
        "policy_type": normalize_nullable_text(row.get("policy_type")),
        "status": normalize_nullable_text(row.get("status")),
        "impact_direction": normalize_nullable_text(row.get("impact_direction")),
        "direct_black_impact": bool(row.get("direct_black_impact")),
        "is_archived": bool(row.get("is_archived")),
        "era_name": normalize_nullable_text(row.get("era_name")),
        "president_name": normalize_nullable_text(row.get("president_name")),
        "categories": categories,
        "category_set": category_set,
        "sources": sources,
        "source_urls": source_urls,
    }


def category_jaccard(left: dict[str, Any], right: dict[str, Any]) -> float:
    return jaccard(left["category_set"], right["category_set"])


def year_delta(left: dict[str, Any], right: dict[str, Any]) -> int | None:
    if left["year_enacted"] is None or right["year_enacted"] is None:
        return None
    return abs(left["year_enacted"] - right["year_enacted"])


def has_priority_overlap(left: dict[str, Any], right: dict[str, Any]) -> bool:
    return bool((left["category_set"] & right["category_set"]) & PRIORITY_CATEGORIES)


def subject_family_overlap(left_tokens: set[str], right_tokens: set[str]) -> bool:
    overlap = left_tokens & right_tokens
    if len(overlap) >= 2:
        return True
    if overlap & SENTENCING_TERMS and (left_tokens | right_tokens) & SENTENCING_TERMS:
        return True
    if overlap & ROLLBACK_TERMS and (left_tokens | right_tokens) & ROLLBACK_TERMS:
        return True
    return False


def score_pair(left: dict[str, Any], right: dict[str, Any]) -> dict[str, Any]:
    title_similarity = ratio(left["normalized_title"], right["normalized_title"])
    title_token_overlap = jaccard(left["title_tokens"], right["title_tokens"])
    summary_similarity = ratio(left["summary_text"][:600], right["summary_text"][:600])
    category_overlap = category_jaccard(left, right)
    shared_source_urls = sorted(left["source_urls"] & right["source_urls"])
    delta = year_delta(left, right)

    score = (
        title_similarity * 0.42
        + title_token_overlap * 0.28
        + category_overlap * 0.16
        + summary_similarity * 0.10
    )
    if shared_source_urls:
        score += 0.12
    if delta == 0:
        score += 0.08
    elif delta is not None and delta <= 2:
        score += 0.04
    elif delta is not None and delta > 20:
        score -= 0.08
    if has_priority_overlap(left, right):
        score += 0.02

    score = max(0.0, min(score, 1.0))

    exact_title_year = (
        left["normalized_title"] == right["normalized_title"]
        and left["normalized_title"] != ""
        and delta == 0
    )
    same_title_base_different_year = (
        left["normalized_title"] == right["normalized_title"]
        and left["normalized_title"] != ""
        and delta is not None
        and delta > 0
    )
    likely_same_law = title_similarity >= 0.9 and title_token_overlap >= 0.75 and delta in (0, None)
    same_family = (
        category_overlap > 0
        and subject_family_overlap(left["title_tokens"], right["title_tokens"])
        and (delta is None or delta <= 25)
    )

    if exact_title_year or (shared_source_urls and title_similarity >= 0.92 and delta in (0, None)):
        label = "exact_duplicate"
        recommended_action = "merge_candidate"
    elif same_title_base_different_year:
        label = "same_policy_family_should_remain_distinct"
        recommended_action = "keep_as_distinct"
    elif likely_same_law or (score >= 0.82 and title_token_overlap >= 0.75 and delta in (0, None)):
        label = "near_duplicate"
        recommended_action = "alias/canonicalize"
    elif same_family and score >= 0.58:
        label = "same_policy_family_should_remain_distinct"
        recommended_action = "keep_as_distinct"
    elif score >= 0.70 and category_overlap > 0:
        label = "manual_review_required"
        recommended_action = "manual_review"
    else:
        label = None
        recommended_action = None

    rationale = []
    if exact_title_year:
        rationale.append("normalized titles and year match exactly")
    if likely_same_law:
        rationale.append("high title and token similarity within a close year window")
    if same_family:
        rationale.append("shared subject tokens and category overlap suggest a policy family")
    if shared_source_urls:
        rationale.append(f"{len(shared_source_urls)} overlapping source URL(s)")
    if category_overlap:
        rationale.append(f"category overlap={category_overlap:.2f}")
    if summary_similarity >= 0.55:
        rationale.append(f"summary similarity={summary_similarity:.2f}")

    return {
        "left_policy_id": left["id"],
        "right_policy_id": right["id"],
        "similarity_score": round(score, 4),
        "label": label,
        "recommended_action": recommended_action,
        "title_similarity": round(title_similarity, 4),
        "title_token_overlap": round(title_token_overlap, 4),
        "summary_similarity": round(summary_similarity, 4),
        "category_overlap": round(category_overlap, 4),
        "year_delta": delta,
        "shared_source_url_count": len(shared_source_urls),
        "shared_source_urls": shared_source_urls[:5],
        "rationale": rationale or ["similarity threshold matched"],
    }


class DisjointSet:
    def __init__(self) -> None:
        self.parent: dict[int, int] = {}

    def find(self, value: int) -> int:
        self.parent.setdefault(value, value)
        if self.parent[value] != value:
            self.parent[value] = self.find(self.parent[value])
        return self.parent[value]

    def union(self, left: int, right: int) -> None:
        left_root = self.find(left)
        right_root = self.find(right)
        if left_root != right_root:
            self.parent[right_root] = left_root


def candidate_pairs(policies: list[dict[str, Any]], min_score: float) -> list[dict[str, Any]]:
    pairs = []
    for left, right in combinations(policies, 2):
        scored = score_pair(left, right)
        if scored["label"] is None:
            continue
        if scored["similarity_score"] < min_score and scored["label"] != "exact_duplicate":
            continue
        pairs.append(scored)
    return sorted(pairs, key=lambda row: row["similarity_score"], reverse=True)


def group_label(pair_labels: list[str]) -> tuple[str, str]:
    if "exact_duplicate" in pair_labels:
        return "exact_duplicate", "merge_candidate"
    if "near_duplicate" in pair_labels:
        return "near_duplicate", "alias/canonicalize"
    if "manual_review_required" in pair_labels:
        return "manual_review_required", "manual_review"
    return "same_policy_family_should_remain_distinct", "keep_as_distinct"


def sanitize_policy(policy: dict[str, Any]) -> dict[str, Any]:
    return {
        "policy_id": policy["id"],
        "title": policy["title"],
        "year_enacted": policy["year_enacted"],
        "date_enacted": policy["date_enacted"],
        "categories": policy["categories"],
        "era_name": policy["era_name"],
        "president_name": policy["president_name"],
        "status": policy["status"],
        "impact_direction": policy["impact_direction"],
        "source_count": len(policy["sources"]),
    }


def build_groups(policies: list[dict[str, Any]], pairs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    policy_by_id = {policy["id"]: policy for policy in policies}
    dsu = DisjointSet()
    for pair in pairs:
        dsu.union(pair["left_policy_id"], pair["right_policy_id"])

    ids_by_root: dict[int, set[int]] = defaultdict(set)
    for pair in pairs:
        root = dsu.find(pair["left_policy_id"])
        ids_by_root[root].add(pair["left_policy_id"])
        ids_by_root[root].add(pair["right_policy_id"])

    groups = []
    for root_ids in ids_by_root.values():
        group_pairs = [
            pair
            for pair in pairs
            if pair["left_policy_id"] in root_ids and pair["right_policy_id"] in root_ids
        ]
        labels = [pair["label"] for pair in group_pairs if pair.get("label")]
        label, recommended_action = group_label(labels)
        max_score = max((pair["similarity_score"] for pair in group_pairs), default=0)
        involved = [policy_by_id[policy_id] for policy_id in sorted(root_ids)]
        shared_categories = sorted(set.intersection(*(policy["category_set"] for policy in involved))) if involved else []
        groups.append(
            {
                "group_id": f"policy_dup_{min(root_ids)}_{len(root_ids)}",
                "label": label,
                "recommended_action": recommended_action,
                "max_similarity_score": max_score,
                "policy_count": len(root_ids),
                "involved_policy_ids": sorted(root_ids),
                "policies": [sanitize_policy(policy) for policy in involved],
                "shared_categories": shared_categories,
                "similarity_rationale": sorted(
                    {reason for pair in group_pairs[:10] for reason in pair.get("rationale", [])}
                ),
                "pair_evidence": group_pairs[:10],
            }
        )

    return sorted(
        groups,
        key=lambda row: (
            {"exact_duplicate": 4, "near_duplicate": 3, "manual_review_required": 2}.get(row["label"], 1),
            row["max_similarity_score"],
            row["policy_count"],
        ),
        reverse=True,
    )


def build_report(args: argparse.Namespace) -> dict[str, Any]:
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            rows = fetch_policy_rows(cursor, args.include_archived)
            categories_by_policy = fetch_category_map(cursor)
            sources_by_policy = fetch_source_map(cursor)
            policies = [
                build_policy(
                    row,
                    categories_by_policy.get(int(row["id"]), []),
                    sources_by_policy.get(int(row["id"]), []),
                )
                for row in rows
            ]
            pairs = candidate_pairs(policies, args.min_score)
            groups = build_groups(policies, pairs)

        label_counts = defaultdict(int)
        action_counts = defaultdict(int)
        for group in groups:
            label_counts[group["label"]] += 1
            action_counts[group["recommended_action"]] += 1

        priority_group_count = sum(
            1
            for group in groups
            if any(
                {str(category).lower() for category in policy["categories"]} & PRIORITY_CATEGORIES
                for policy in group["policies"]
            )
        )

        return {
            "workflow": "historical_policy_duplicate_audit",
            "mode": "read_only",
            "generated_at": utc_timestamp(),
            "scope": {
                "source_tables": ["policies", "policy_policy_categories", "policy_categories", "sources"],
                "mutation_policy": "read_only_no_merges_no_deletes",
                "include_archived": bool(args.include_archived),
                "min_score": args.min_score,
                "priority_categories": sorted(PRIORITY_CATEGORIES),
            },
            "summary": {
                "policies_audited": len(policies),
                "candidate_pair_count": len(pairs),
                "candidate_group_count": len(groups),
                "exact_duplicate_group_count": label_counts["exact_duplicate"],
                "near_duplicate_group_count": label_counts["near_duplicate"],
                "manual_review_group_count": label_counts["manual_review_required"],
                "same_policy_family_group_count": label_counts["same_policy_family_should_remain_distinct"],
                "priority_category_group_count": priority_group_count,
                "recommended_action_counts": dict(sorted(action_counts.items())),
            },
            "candidate_groups": groups,
            "top_20_likely_duplicate_groups": groups[: max(0, args.top_limit)],
            "safe_remediation_plan": [
                "Review exact_duplicate and near_duplicate groups manually before changing production data.",
                "Prefer alias/canonicalization when records represent variants of the same law but carry distinct historical notes.",
                "Only merge records when titles, years, sources, categories, and summaries show the same policy record.",
                "Keep same_policy_family_should_remain_distinct groups when records represent different laws, amendments, or implementation phases.",
                "Preserve all source URLs and policy IDs in a redirect/alias note before any future consolidation.",
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
        }
    )


if __name__ == "__main__":
    main()
