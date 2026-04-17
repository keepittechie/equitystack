#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_SQL="$(mktemp /tmp/source-curation-draft-import.XXXXXX.sql)"
trap 'rm -f "$TMP_SQL"' EXIT

if [[ -f "$ROOT_DIR/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env.local"
  set +a
fi

DB_HOST_EFFECTIVE="${DB_HOST_OVERRIDE:-${DB_HOST:-127.0.0.1}}"
DB_PORT_EFFECTIVE="${DB_PORT_OVERRIDE:-${DB_PORT:-3306}}"
DB_USER_EFFECTIVE="${DB_USER_OVERRIDE:-${DB_USER:-root}}"
DB_NAME_EFFECTIVE="${DB_NAME_OVERRIDE:-${DB_NAME:-black_policy_tracker}}"
DB_PASSWORD_EFFECTIVE="${DB_PASSWORD_OVERRIDE:-${DB_PASSWORD:-}}"

export MYSQL_PWD="$DB_PASSWORD_EFFECTIVE"

mariadb \
  -h "$DB_HOST_EFFECTIVE" \
  -P "$DB_PORT_EFFECTIVE" \
  -u "$DB_USER_EFFECTIVE" \
  "$DB_NAME_EFFECTIVE" \
  < "$ROOT_DIR/database/source_curation_draft_rows.sql"

cat >"$TMP_SQL" <<SQL
DROP TEMPORARY TABLE IF EXISTS tmp_source_curation_draft_load;
CREATE TEMPORARY TABLE tmp_source_curation_draft_load (
  load_order INT UNSIGNED NOT NULL AUTO_INCREMENT,
  president_name VARCHAR(255) NULL,
  bucket_name VARCHAR(255) NULL,
  row_id BIGINT UNSIGNED NOT NULL,
  row_type VARCHAR(32) NOT NULL,
  source_title TEXT NOT NULL,
  source_date_raw VARCHAR(32) NULL,
  source_url TEXT NOT NULL,
  fit VARCHAR(32) NULL,
  recommended_use VARCHAR(64) NULL,
  notes TEXT NULL,
  PRIMARY KEY (load_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELETE FROM source_curation_draft_rows
WHERE import_file IN ('modern_source_curation_rows_draft.csv', 'historical_source_curation_rows.csv');

TRUNCATE TABLE tmp_source_curation_draft_load;
LOAD DATA LOCAL INFILE '${ROOT_DIR}/database/modern_source_curation_rows_draft.csv'
INTO TABLE tmp_source_curation_draft_load
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"' ESCAPED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES
(@president, @bucket, @row_id, @row_type, @source_title, @source_date, @url, @fit, @recommended_use, @notes)
SET
  president_name = NULLIF(TRIM(@president), ''),
  bucket_name = NULLIF(TRIM(@bucket), ''),
  row_id = CAST(@row_id AS UNSIGNED),
  row_type = LOWER(TRIM(@row_type)),
  source_title = TRIM(@source_title),
  source_date_raw = NULLIF(TRIM(@source_date), ''),
  source_url = TRIM(@url),
  fit = LOWER(NULLIF(TRIM(@fit), '')),
  recommended_use = LOWER(NULLIF(TRIM(@recommended_use), '')),
  notes = NULLIF(TRIM(@notes), '');
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
)
SELECT
  'modern_source_curation_rows_draft.csv',
  load_order + 1,
  COALESCE(president_name, ''),
  COALESCE(bucket_name, ''),
  row_type,
  row_id,
  source_title,
  source_date_raw,
  source_url,
  COALESCE(fit, 'unknown'),
  COALESCE(recommended_use, 'unspecified'),
  notes
FROM tmp_source_curation_draft_load;

TRUNCATE TABLE tmp_source_curation_draft_load;
LOAD DATA LOCAL INFILE '${ROOT_DIR}/database/historical_source_curation_rows.csv'
INTO TABLE tmp_source_curation_draft_load
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"' ESCAPED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES
(@president, @bucket, @row_id, @row_type, @source_title, @source_date, @url, @fit, @recommended_use, @notes)
SET
  president_name = NULLIF(TRIM(@president), ''),
  bucket_name = NULLIF(TRIM(@bucket), ''),
  row_id = CAST(@row_id AS UNSIGNED),
  row_type = LOWER(TRIM(@row_type)),
  source_title = TRIM(@source_title),
  source_date_raw = NULLIF(TRIM(@source_date), ''),
  source_url = TRIM(@url),
  fit = LOWER(NULLIF(TRIM(@fit), '')),
  recommended_use = LOWER(NULLIF(TRIM(@recommended_use), '')),
  notes = NULLIF(TRIM(@notes), '');
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
)
SELECT
  'historical_source_curation_rows.csv',
  load_order + 1,
  COALESCE(president_name, ''),
  COALESCE(bucket_name, ''),
  row_type,
  row_id,
  source_title,
  source_date_raw,
  source_url,
  COALESCE(fit, 'unknown'),
  COALESCE(recommended_use, 'unspecified'),
  notes
FROM tmp_source_curation_draft_load;

SELECT 'rows_by_file' AS report;
SELECT import_file, COUNT(*) AS imported_rows
FROM source_curation_draft_rows
WHERE import_file IN ('modern_source_curation_rows_draft.csv', 'historical_source_curation_rows.csv')
GROUP BY import_file
ORDER BY import_file;

SELECT 'matched_vs_unmatched' AS report;
SELECT
  SUM(CASE WHEN d.record_type = 'action' AND a.id IS NOT NULL THEN 1 ELSE 0 END) AS matched_actions,
  SUM(CASE WHEN d.record_type = 'outcome' AND o.id IS NOT NULL THEN 1 ELSE 0 END) AS matched_outcomes,
  SUM(CASE WHEN d.record_type = 'action' AND a.id IS NULL THEN 1 ELSE 0 END) AS unmatched_actions,
  SUM(CASE WHEN d.record_type = 'outcome' AND o.id IS NULL THEN 1 ELSE 0 END) AS unmatched_outcomes
FROM source_curation_draft_rows d
LEFT JOIN promise_actions a ON d.record_type = 'action' AND a.id = d.record_id
LEFT JOIN promise_outcomes o ON d.record_type = 'outcome' AND o.id = d.record_id
WHERE d.import_file IN ('modern_source_curation_rows_draft.csv', 'historical_source_curation_rows.csv');
SQL

mariadb \
  --local-infile=1 \
  -h "$DB_HOST_EFFECTIVE" \
  -P "$DB_PORT_EFFECTIVE" \
  -u "$DB_USER_EFFECTIVE" \
  "$DB_NAME_EFFECTIVE" \
  < "$TMP_SQL"
