-- Additive judicial-impact support for unified policy outcomes.
--
-- Judicial outcome rows remain optional. Attribution is only used when
-- explicit metadata is present; otherwise judicial rows are excluded from
-- president scoring rather than guessed.

SET @policy_outcomes_policy_type_column := (
  SELECT COLUMN_TYPE
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'policy_outcomes'
    AND COLUMN_NAME = 'policy_type'
);

SET @policy_outcomes_policy_type_sql := IF(
  @policy_outcomes_policy_type_column LIKE "%'judicial_impact'%",
  "SELECT 'policy_outcomes.policy_type already supports judicial_impact' AS migration_note",
  "ALTER TABLE policy_outcomes MODIFY COLUMN policy_type ENUM('current_admin', 'legislative', 'judicial_impact') NOT NULL"
);

PREPARE policy_outcomes_policy_type_stmt FROM @policy_outcomes_policy_type_sql;
EXECUTE policy_outcomes_policy_type_stmt;
DEALLOCATE PREPARE policy_outcomes_policy_type_stmt;

ALTER TABLE policy_outcomes
  ADD COLUMN IF NOT EXISTS court_level VARCHAR(100) NULL AFTER impact_duration_estimate,
  ADD COLUMN IF NOT EXISTS decision_year SMALLINT UNSIGNED NULL AFTER court_level,
  ADD COLUMN IF NOT EXISTS majority_justices JSON NULL AFTER decision_year,
  ADD COLUMN IF NOT EXISTS appointing_presidents JSON NULL AFTER majority_justices,
  ADD COLUMN IF NOT EXISTS judicial_attribution JSON NULL AFTER appointing_presidents,
  ADD COLUMN IF NOT EXISTS judicial_weight DECIMAL(5,4) NULL AFTER judicial_attribution;

SET @policy_outcomes_decision_year_index_count := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'policy_outcomes'
    AND INDEX_NAME = 'idx_policy_outcomes_decision_year'
);

SET @policy_outcomes_decision_year_index_sql := IF(
  @policy_outcomes_decision_year_index_count > 0,
  "SELECT 'idx_policy_outcomes_decision_year already exists' AS migration_note",
  "ALTER TABLE policy_outcomes ADD INDEX idx_policy_outcomes_decision_year (decision_year)"
);

PREPARE policy_outcomes_decision_year_index_stmt FROM @policy_outcomes_decision_year_index_sql;
EXECUTE policy_outcomes_decision_year_index_stmt;
DEALLOCATE PREPARE policy_outcomes_decision_year_index_stmt;
