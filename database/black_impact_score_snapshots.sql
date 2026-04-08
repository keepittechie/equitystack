CREATE TABLE IF NOT EXISTS black_impact_score_snapshots (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  snapshot_key VARCHAR(128) NOT NULL,
  snapshot_label VARCHAR(128) NOT NULL DEFAULT 'manual',
  score_family VARCHAR(64) NOT NULL DEFAULT 'direct',
  total_score FLOAT NOT NULL DEFAULT 0,
  normalized_score_total FLOAT NOT NULL DEFAULT 0,
  outcome_count INT NOT NULL DEFAULT 0,
  president_count INT NOT NULL DEFAULT 0,
  snapshot_payload JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_black_impact_score_snapshots_key_created (snapshot_key, created_at),
  KEY idx_black_impact_score_snapshots_family_created (score_family, created_at)
);
