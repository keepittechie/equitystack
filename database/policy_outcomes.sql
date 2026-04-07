-- Unified outcomes model for current-admin and legislative policies.
--
-- `policy_id` is a polymorphic reference:
--   - policy_type = 'current_admin' -> promises.id
--   - policy_type = 'legislative'   -> tracked_bills.id
--
-- MySQL cannot enforce that conditional foreign key directly without splitting
-- the model into separate nullable columns, so the application resolves and
-- validates the target record before inserting.

CREATE TABLE IF NOT EXISTS policy_outcomes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  policy_type ENUM('current_admin', 'legislative') NOT NULL,
  policy_id BIGINT UNSIGNED NOT NULL,
  record_key VARCHAR(255) NOT NULL,
  outcome_summary TEXT NOT NULL,
  outcome_summary_hash CHAR(64) NOT NULL,
  outcome_type VARCHAR(100) NULL,
  measurable_impact TEXT NULL,
  impact_direction ENUM('Positive', 'Negative', 'Mixed', 'Blocked') NULL,
  evidence_strength ENUM('Weak', 'Moderate', 'Strong') NULL,
  confidence_score DECIMAL(5,4) NULL,
  source_count INT NOT NULL DEFAULT 0,
  source_quality ENUM('low', 'medium', 'high') NULL,
  impact_score FLOAT NULL,
  status VARCHAR(64) NULL,
  impact_start_date DATE NULL,
  impact_end_date DATE NULL,
  impact_duration_estimate VARCHAR(64) NULL,
  black_community_impact_note TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uniq_policy_outcomes_policy_summary (policy_type, policy_id, outcome_summary_hash),
  KEY idx_policy_outcomes_policy (policy_type, policy_id),
  KEY idx_policy_outcomes_record_key (record_key),
  KEY idx_policy_outcomes_impact_direction (impact_direction),
  KEY idx_policy_outcomes_evidence_strength (evidence_strength),
  KEY idx_policy_outcomes_impact_start_date (impact_start_date),
  KEY idx_policy_outcomes_impact_date_range (impact_start_date, impact_end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
