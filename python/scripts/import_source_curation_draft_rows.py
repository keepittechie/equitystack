#!/usr/bin/env python3
import argparse
import csv
import json
from pathlib import Path
from typing import Any

from current_admin_common import get_db_connection, get_project_root, require_apply_confirmation


DEFAULT_INPUTS = [
    "database/modern_source_curation_rows_draft.csv",
    "database/historical_source_curation_rows.csv",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Import source-curation draft recommendation CSV rows into the "
            "source_curation_draft_rows table for /admin/source-curation review."
        )
    )
    parser.add_argument(
        "--csv",
        dest="csv_paths",
        action="append",
        help="Optional CSV path. Defaults to the two database/source-curation CSV files.",
    )
    parser.add_argument("--apply", action="store_true", help="Persist the imported draft rows")
    parser.add_argument("--yes", action="store_true", help="Required confirmation for --apply")
    return parser.parse_args()


def normalize_text(value: Any) -> str:
    return str(value or "").strip()


def normalize_nullable_text(value: Any) -> str | None:
    text = normalize_text(value)
    return text or None


def normalize_record_type(value: Any) -> str:
    record_type = normalize_text(value).lower()
    if record_type not in {"action", "outcome"}:
        raise ValueError(f"Unsupported row_type {value!r}")
    return record_type


def normalize_record_id(value: Any) -> int:
    text = normalize_text(value)
    if not text.isdigit():
        raise ValueError(f"row_id must be a positive integer, received {value!r}")
    return int(text)


def load_schema_sql() -> str:
    schema_path = get_project_root() / "database" / "source_curation_draft_rows.sql"
    return schema_path.read_text(encoding="utf-8").strip()


def resolve_csv_paths(csv_paths: list[str] | None) -> list[Path]:
    raw_paths = csv_paths or DEFAULT_INPUTS
    resolved = []
    for raw_path in raw_paths:
        path = Path(raw_path)
        if not path.is_absolute():
            path = get_project_root() / path
        resolved.append(path.resolve())
    return resolved


def load_rows(csv_path: Path) -> list[dict[str, Any]]:
    rows = []
    with csv_path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for index, row in enumerate(reader, start=2):
            source_url = normalize_text(row.get("url"))
            source_title = normalize_text(row.get("source_title"))
            if not source_url or not source_title:
                raise ValueError(
                    f"{csv_path.name}:{index} requires non-empty url and source_title"
                )
            rows.append(
                {
                    "import_file": csv_path.name,
                    "import_row_number": index,
                    "president_name": normalize_text(row.get("president")),
                    "bucket_name": normalize_text(row.get("bucket")),
                    "record_type": normalize_record_type(row.get("row_type")),
                    "record_id": normalize_record_id(row.get("row_id")),
                    "source_title": source_title,
                    "source_date_raw": normalize_nullable_text(row.get("source_date")),
                    "source_url": source_url,
                    "fit": normalize_text(row.get("fit")).lower() or "unknown",
                    "recommended_use": normalize_text(row.get("recommended_use")).lower()
                    or "unspecified",
                    "notes": normalize_nullable_text(row.get("notes")),
                }
            )
    return rows


def chunked(values: list[int], size: int = 500) -> list[list[int]]:
    return [values[index : index + size] for index in range(0, len(values), size)]


def fetch_existing_record_ids(cursor, table_name: str, record_ids: list[int]) -> set[int]:
    existing: set[int] = set()
    for chunk in chunked(record_ids):
        placeholders = ", ".join(["%s"] * len(chunk))
        cursor.execute(
            f"SELECT id FROM {table_name} WHERE id IN ({placeholders})",
            chunk,
        )
        existing.update(int(row["id"]) for row in list(cursor.fetchall() or []))
    return existing


def build_validation_summary(rows: list[dict[str, Any]], cursor) -> dict[str, Any]:
    action_ids = sorted({row["record_id"] for row in rows if row["record_type"] == "action"})
    outcome_ids = sorted({row["record_id"] for row in rows if row["record_type"] == "outcome"})
    existing_action_ids = fetch_existing_record_ids(cursor, "promise_actions", action_ids)
    existing_outcome_ids = fetch_existing_record_ids(cursor, "promise_outcomes", outcome_ids)

    unmatched = []
    for row in rows:
        exists = (
            row["record_id"] in existing_action_ids
            if row["record_type"] == "action"
            else row["record_id"] in existing_outcome_ids
        )
        if not exists:
            unmatched.append(
                {
                    "import_file": row["import_file"],
                    "import_row_number": row["import_row_number"],
                    "record_type": row["record_type"],
                    "record_id": row["record_id"],
                    "source_title": row["source_title"],
                }
            )

    return {
        "action_row_count": sum(1 for row in rows if row["record_type"] == "action"),
        "outcome_row_count": sum(1 for row in rows if row["record_type"] == "outcome"),
        "matched_action_count": sum(
            1
            for row in rows
            if row["record_type"] == "action" and row["record_id"] in existing_action_ids
        ),
        "matched_outcome_count": sum(
            1
            for row in rows
            if row["record_type"] == "outcome" and row["record_id"] in existing_outcome_ids
        ),
        "unmatched_count": len(unmatched),
        "unmatched_rows": unmatched[:20],
    }


def main() -> None:
    args = parse_args()
    require_apply_confirmation(args.apply, args.yes)
    csv_paths = resolve_csv_paths(args.csv_paths)

    all_rows = []
    for csv_path in csv_paths:
        if not csv_path.exists():
            raise SystemExit(f"CSV not found: {csv_path}")
        all_rows.extend(load_rows(csv_path))

    schema_sql = load_schema_sql()
    try:
        connection = get_db_connection()
    except ModuleNotFoundError as error:
        if error.name == "pymysql":
            raise SystemExit(
                "pymysql is not installed in the active Python environment. "
                "Use the repo Python environment or run the import through the MariaDB client."
            ) from error
        raise
    try:
        with connection.cursor() as cursor:
            cursor.execute(schema_sql)
            validation = build_validation_summary(all_rows, cursor)
            import_files = sorted({row["import_file"] for row in all_rows})

            if import_files:
                placeholders = ", ".join(["%s"] * len(import_files))
                cursor.execute(
                    f"DELETE FROM source_curation_draft_rows WHERE import_file IN ({placeholders})",
                    import_files,
                )

            cursor.executemany(
                """
                INSERT INTO source_curation_draft_rows (
                  import_file,
                  import_row_number,
                  president_name,
                  bucket_name,
                  record_type,
                  record_id,
                  source_title,
                  source_date_raw,
                  source_url,
                  fit,
                  recommended_use,
                  notes
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                [
                    (
                        row["import_file"],
                        row["import_row_number"],
                        row["president_name"],
                        row["bucket_name"],
                        row["record_type"],
                        row["record_id"],
                        row["source_title"],
                        row["source_date_raw"],
                        row["source_url"],
                        row["fit"],
                        row["recommended_use"],
                        row["notes"],
                    )
                    for row in all_rows
                ],
            )

            cursor.execute("SELECT COUNT(*) AS total FROM source_curation_draft_rows")
            total_rows_after = int((cursor.fetchone() or {}).get("total") or 0)

            if args.apply:
                connection.commit()
            else:
                connection.rollback()

    finally:
        connection.close()

    payload = {
        "ok": True,
        "mode": "apply" if args.apply else "dry-run",
        "csv_files": [str(path) for path in csv_paths],
        "inserted_row_count": len(all_rows),
        "total_rows_after": total_rows_after,
        "validation": validation,
    }
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
