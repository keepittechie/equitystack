#!/usr/bin/env python3
import argparse
import hashlib
import json
import os
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import pymysql
import requests

WHITE_HOUSE_LISTINGS = {
    "presidential_actions": "https://www.whitehouse.gov/presidential-actions/",
    "official_statements": "https://www.whitehouse.gov/briefings-statements/",
}

POLICY_STATEMENT_PREFIXES = (
    "statement from president",
    "statement by the president",
    "fact sheet:",
    "memorandum",
    "executive order",
    "proclamation",
    "bill signed:",
    "veto message",
    "message to the congress",
    "message to congress",
    "letter to the speaker",
    "letter to congress",
    "notice on",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Ingest current-administration White House action candidates into staging."
    )
    parser.add_argument(
        "--write",
        action="store_true",
        help="Persist staged records. Default behavior is dry-run only.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=20,
        help="Maximum items to keep per feed after filtering.",
    )
    parser.add_argument(
        "--source",
        action="append",
        choices=sorted(WHITE_HOUSE_LISTINGS.keys()),
        help="Limit ingestion to one or more sources. Defaults to all White House sources in scope.",
    )
    parser.add_argument(
        "--president-slug",
        default="donald-j-trump-2025",
        help="Current-administration presidency slug to target in the presidents table.",
    )
    return parser.parse_args()


@dataclass
class StagedCandidate:
    president_id: int
    source_system: str
    source_category: str
    canonical_url: str
    official_identifier: str | None
    raw_action_type: str | None
    title: str
    publication_date: str | None
    action_date: str | None
    summary_excerpt: str | None
    dedupe_key: str
    raw_payload_json: str


def get_project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def load_env_file(env_path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not env_path.exists():
        return values

    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")

    return values


def get_db_env_values() -> dict[str, str]:
    values = load_env_file(get_project_root() / ".env.local")
    for key in ("DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME"):
        if os.environ.get(key):
            values[key] = os.environ[key]
    return values


def get_db_connection():
    env_values = get_db_env_values()
    return pymysql.connect(
        host=env_values.get("DB_HOST", "127.0.0.1"),
        port=int(env_values.get("DB_PORT", "3306")),
        user=env_values.get("DB_USER", "root"),
        password=env_values.get("DB_PASSWORD", ""),
        database=env_values.get("DB_NAME", "black_policy_tracker"),
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False,
    )


def fetch_page(url: str) -> str:
    response = requests.get(url, timeout=30, headers={"User-Agent": "Mozilla/5.0"})
    response.raise_for_status()
    return response.text


def text_or_none(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = re.sub(r"\s+", " ", value).strip()
    return normalized or None


def strip_html(value: str | None) -> str | None:
    if not value:
        return None
    stripped = re.sub(r"<[^>]+>", " ", value)
    return text_or_none(stripped)


def normalize_url(url: str | None) -> str | None:
    if not url:
        return None
    parsed = urlparse(url.strip())
    if not parsed.scheme or not parsed.netloc:
        return None
    path = parsed.path.rstrip("/") or "/"
    return f"{parsed.scheme}://{parsed.netloc}{path}/" if path != "/" else f"{parsed.scheme}://{parsed.netloc}/"


def derive_official_identifier(title: str, canonical_url: str) -> str | None:
    title_match = re.search(
        r"\b(Executive Order|Proclamation|Memorandum|Notice|National Security Presidential Memorandum)\s+([A-Za-z0-9\-]+)\b",
        title,
        re.IGNORECASE,
    )
    if title_match:
        return f"{title_match.group(1).title()} {title_match.group(2)}"

    path_parts = [part for part in urlparse(canonical_url).path.split("/") if part]
    if path_parts:
        return path_parts[-1]
    return None


def derive_raw_action_type(title: str, source_category: str, canonical_url: str) -> str | None:
    lowered = title.lower()
    url_lowered = canonical_url.lower()
    if "executive order" in lowered:
        return "Executive Order"
    if "executive-order" in url_lowered:
        return "Executive Order"
    if "proclamation" in lowered:
        return "Proclamation"
    if "proclamation" in url_lowered:
        return "Proclamation"
    if "memorandum" in lowered:
        return "Memorandum"
    if "memorandum" in url_lowered:
        return "Memorandum"
    if "bill signed" in lowered or "signing" in lowered:
        return "Bill Signing"
    if "veto" in lowered:
        return "Veto"
    if source_category == "official_statements":
        return "Statement"
    return "Other"


def is_policy_statement_candidate(title: str) -> bool:
    lowered = title.lower()
    return lowered.startswith(POLICY_STATEMENT_PREFIXES)


def parse_iso_datetime_to_date(value: str | None) -> str | None:
    if not value:
        return None
    normalized = value.strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC).date().isoformat()


def build_dedupe_key(
    source_system: str,
    source_category: str,
    canonical_url: str,
    official_identifier: str | None,
    title: str,
    publication_date: str | None,
) -> str:
    dedupe_input = "||".join(
        [
            source_system.strip().lower(),
            source_category.strip().lower(),
            (official_identifier or canonical_url).strip().lower(),
            title.strip().lower(),
            publication_date or "",
        ]
    )
    return hashlib.sha256(dedupe_input.encode("utf-8")).hexdigest()


def extract_meta_description(html: str) -> str | None:
    match = re.search(
        r'<meta\s+name=["\']description["\']\s+content=["\']([^"\']+)["\']',
        html,
        re.IGNORECASE,
    )
    if match:
        return text_or_none(match.group(1))

    match = re.search(r"<p[^>]*>(.*?)</p>", html, re.IGNORECASE | re.DOTALL)
    if match:
        return strip_html(match.group(1))

    return None


def extract_items(listing_html: str, source_category: str) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    pattern = re.compile(
        r'<li[^>]+class="[^"]*wp-block-post[^"]*"[^>]*>.*?<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>\s*</h2>.*?<time[^>]+datetime="([^"]+)"',
        re.IGNORECASE | re.DOTALL,
    )

    for match in pattern.finditer(listing_html):
        link = normalize_url(match.group(1))
        title = strip_html(match.group(2))
        if not title or not link:
            continue

        if source_category == "official_statements" and not is_policy_statement_candidate(title):
            continue

        detail_html = fetch_page(link)
        description = extract_meta_description(detail_html)
        pub_date = parse_iso_datetime_to_date(match.group(3))
        items.append(
            {
                "title": title,
                "canonical_url": link,
                "description": description,
                "publication_date": pub_date,
                "action_date": pub_date,
                "raw_html": detail_html[:12000],
            }
        )
    return items


def load_president_id(cursor, president_slug: str) -> int:
    cursor.execute(
        """
        SELECT id
        FROM presidents
        WHERE slug = %s
        LIMIT 1
        """,
        (president_slug,),
    )
    row = cursor.fetchone()
    if not row:
        raise RuntimeError(f"Missing presidents row for slug {president_slug}")
    return int(row["id"])


def build_candidates(source_names: list[str], president_id: int, limit: int) -> tuple[list[StagedCandidate], list[dict[str, str]]]:
    candidates: list[StagedCandidate] = []
    source_errors: list[dict[str, str]] = []

    for source_name in source_names:
        try:
            listing_html = fetch_page(WHITE_HOUSE_LISTINGS[source_name])
        except requests.RequestException as error:
            source_errors.append({"source": source_name, "error": str(error)})
            continue

        for item in extract_items(listing_html, source_name)[:limit]:
            official_identifier = derive_official_identifier(item["title"], item["canonical_url"])
            dedupe_key = build_dedupe_key(
                "white_house",
                source_name,
                item["canonical_url"],
                official_identifier,
                item["title"],
                item["publication_date"],
            )
            payload = {
                "source_name": source_name,
                "canonical_url": item["canonical_url"],
                "title": item["title"],
                "description": item["description"],
                "publication_date": item["publication_date"],
                "action_date": item["action_date"],
                "fetched_at": datetime.now(tz=UTC).isoformat(),
                "raw_html": item["raw_html"],
            }
            candidates.append(
                StagedCandidate(
                    president_id=president_id,
                    source_system="white_house",
                    source_category=source_name,
                    canonical_url=item["canonical_url"],
                    official_identifier=official_identifier,
                    raw_action_type=derive_raw_action_type(
                        item["title"],
                        source_name,
                        item["canonical_url"],
                    ),
                    title=item["title"],
                    publication_date=item["publication_date"],
                    action_date=item["action_date"],
                    summary_excerpt=item["description"],
                    dedupe_key=dedupe_key,
                    raw_payload_json=json.dumps(payload, ensure_ascii=True),
                )
            )

    return candidates, source_errors


def collect_white_house_source_items(source_names: list[str], limit: int) -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    source_items: list[dict[str, Any]] = []
    source_errors: list[dict[str, str]] = []

    for source_name in source_names:
        try:
            listing_html = fetch_page(WHITE_HOUSE_LISTINGS[source_name])
        except requests.RequestException as error:
            source_errors.append({"source": source_name, "error": str(error)})
            continue

        for item in extract_items(listing_html, source_name)[:limit]:
            source_items.append(
                {
                    "title": item["title"],
                    "url": item["canonical_url"],
                    "published_at": item["publication_date"],
                    "summary": item["description"] or "",
                    "source_name": source_name.replace("_", " ").title(),
                    "source_type": "White House HTML",
                    "source_category": source_name,
                    "publisher": "The White House",
                    "action_type_hint": derive_raw_action_type(
                        item["title"],
                        source_name,
                        item["canonical_url"],
                    ),
                }
            )

    return source_items, source_errors


def print_preview(candidates: list[StagedCandidate]) -> None:
    preview = [
        {
            "title": candidate.title,
            "source_category": candidate.source_category,
            "publication_date": candidate.publication_date,
            "official_identifier": candidate.official_identifier,
            "raw_action_type": candidate.raw_action_type,
            "canonical_url": candidate.canonical_url,
            "dedupe_key": candidate.dedupe_key,
        }
        for candidate in candidates
    ]
    print(json.dumps(preview, indent=2))


def upsert_candidates(cursor, candidates: list[StagedCandidate]) -> tuple[int, int]:
    inserts = 0
    updates = 0

    for candidate in candidates:
        cursor.execute(
            """
            INSERT INTO current_administration_staging_items (
              president_id,
              source_system,
              source_category,
              canonical_url,
              official_identifier,
              raw_action_type,
              title,
              publication_date,
              action_date,
              summary_excerpt,
              discovered_at,
              last_seen_at,
              dedupe_key,
              raw_payload_json
            ) VALUES (
              %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, UTC_TIMESTAMP(), UTC_TIMESTAMP(), %s, %s
            )
            ON DUPLICATE KEY UPDATE
              canonical_url = VALUES(canonical_url),
              official_identifier = VALUES(official_identifier),
              raw_action_type = VALUES(raw_action_type),
              title = VALUES(title),
              publication_date = COALESCE(VALUES(publication_date), publication_date),
              action_date = COALESCE(VALUES(action_date), action_date),
              summary_excerpt = COALESCE(VALUES(summary_excerpt), summary_excerpt),
              last_seen_at = UTC_TIMESTAMP(),
              raw_payload_json = VALUES(raw_payload_json)
            """,
            (
                candidate.president_id,
                candidate.source_system,
                candidate.source_category,
                candidate.canonical_url,
                candidate.official_identifier,
                candidate.raw_action_type,
                candidate.title,
                candidate.publication_date,
                candidate.action_date,
                candidate.summary_excerpt,
                candidate.dedupe_key,
                candidate.raw_payload_json,
            ),
        )

        if cursor.rowcount == 1:
            inserts += 1
        else:
            updates += 1

    return inserts, updates


def main() -> None:
    args = parse_args()
    selected_sources = args.source or list(WHITE_HOUSE_LISTINGS.keys())

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            president_id = load_president_id(cursor, args.president_slug)
            candidates, source_errors = build_candidates(selected_sources, president_id, max(args.limit, 1))

            print_preview(candidates)
            print(
                json.dumps(
                    {
                        "mode": "write" if args.write else "dry_run",
                        "president_slug": args.president_slug,
                        "candidate_count": len(candidates),
                        "sources": selected_sources,
                        "source_errors": source_errors,
                    },
                    indent=2,
                )
            )

            if not candidates:
                connection.rollback()
                return

            if not args.write:
                connection.rollback()
                return

            inserts, updates = upsert_candidates(cursor, candidates)
            connection.commit()
            print(
                json.dumps(
                    {
                        "mode": "write",
                        "candidate_count": len(candidates),
                        "inserted": inserts,
                        "updated": updates,
                    },
                    indent=2,
                )
            )
    finally:
        connection.close()


if __name__ == "__main__":
    main()
