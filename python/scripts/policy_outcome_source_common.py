#!/usr/bin/env python3
from typing import Any

from audit_source_quality import classify_source_quality
from current_admin_common import normalize_nullable_text


def ensure_policy_outcome_sources_table(cursor) -> None:
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS policy_outcome_sources (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          policy_outcome_id BIGINT UNSIGNED NOT NULL,
          source_id INT NOT NULL,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          PRIMARY KEY (id),
          UNIQUE KEY uq_policy_outcome_sources (policy_outcome_id, source_id),
          KEY idx_policy_outcome_sources_policy_outcome_id (policy_outcome_id),
          KEY idx_policy_outcome_sources_source_id (source_id),
          CONSTRAINT fk_policy_outcome_sources_policy_outcome
            FOREIGN KEY (policy_outcome_id) REFERENCES policy_outcomes (id) ON DELETE CASCADE,
          CONSTRAINT fk_policy_outcome_sources_source
            FOREIGN KEY (source_id) REFERENCES sources (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )


def normalize_source_url(value: Any) -> str | None:
    text = normalize_nullable_text(value)
    if text is None:
        return None
    return text.rstrip("/").lower()


def source_quality_from_rows(rows: list[dict[str, Any]]) -> str | None:
    if not rows:
        return None
    labels = {classify_source_quality(row)["source_quality_label"] for row in rows}
    if "high_authority" in labels:
        return "high"
    if labels & {"institutional", "secondary"}:
        return "medium"
    return "low"


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
    row = cursor.fetchone() or {}
    source_id = row.get("id")
    return int(source_id) if source_id is not None else None


def create_source(
    cursor,
    *,
    source_title: str,
    source_url: str,
    source_type: str,
    publisher: str | None,
    published_date: str | None,
    notes: str | None,
) -> int:
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
        )
        VALUES (NULL, %s, %s, %s, %s, %s, %s)
        """,
        (
            source_title,
            source_url,
            source_type,
            publisher,
            published_date,
            notes,
        ),
    )
    return int(cursor.lastrowid)


def link_policy_outcome_source(cursor, policy_outcome_id: int, source_id: int) -> int:
    cursor.execute(
        """
        INSERT IGNORE INTO policy_outcome_sources (policy_outcome_id, source_id)
        VALUES (%s, %s)
        """,
        (policy_outcome_id, source_id),
    )
    return int(cursor.rowcount or 0)


def fetch_policy_outcome_sources(cursor, policy_outcome_id: int) -> list[dict[str, Any]]:
    cursor.execute(
        """
        SELECT
          s.id,
          s.source_title,
          s.source_url,
          s.source_type,
          s.publisher,
          s.published_date
        FROM policy_outcome_sources pos
        JOIN sources s ON s.id = pos.source_id
        WHERE pos.policy_outcome_id = %s
        ORDER BY s.id ASC
        """,
        (policy_outcome_id,),
    )
    return list(cursor.fetchall() or [])


def sync_policy_outcome_source_metadata(cursor, policy_outcome_id: int) -> dict[str, Any]:
    sources = fetch_policy_outcome_sources(cursor, policy_outcome_id)
    source_count = len({int(row["id"]) for row in sources if row.get("id") is not None})
    source_quality = source_quality_from_rows(sources)
    cursor.execute(
        """
        UPDATE policy_outcomes
        SET source_count = %s,
            source_quality = %s
        WHERE id = %s
        """,
        (source_count, source_quality, policy_outcome_id),
    )
    return {
        "policy_outcome_id": policy_outcome_id,
        "source_count": source_count,
        "source_quality": source_quality,
    }


def sync_all_policy_outcome_source_metadata(cursor) -> dict[str, Any]:
    cursor.execute("SELECT id FROM policy_outcomes ORDER BY id ASC")
    policy_outcome_ids = [int(row["id"]) for row in cursor.fetchall() or []]
    counts = {
        "policy_outcomes_processed": len(policy_outcome_ids),
        "with_sources": 0,
        "without_sources": 0,
    }
    for policy_outcome_id in policy_outcome_ids:
        result = sync_policy_outcome_source_metadata(cursor, policy_outcome_id)
        if result["source_count"] > 0:
            counts["with_sources"] += 1
        else:
            counts["without_sources"] += 1
    return counts
