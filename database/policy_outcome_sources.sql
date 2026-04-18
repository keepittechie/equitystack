-- Canonical source-linkage table for unified policy outcomes.
--
-- `policy_outcomes.source_count` and `policy_outcomes.source_quality` are
-- cached metadata derived from this table. Source curation, certification, and
-- scoring should link evidence here rather than through legacy promise-era
-- outcome join tables.

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
