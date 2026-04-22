-- Canonical source-linkage table for structured demographic impact facts.
--
-- This reuses the shared `sources` registry so demographic impact rows can
-- carry first-class evidence without introducing a parallel source model.

CREATE TABLE IF NOT EXISTS entity_demographic_impact_sources (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Primary key for a single source-to-impact linkage row.',
  impact_id BIGINT UNSIGNED NOT NULL COMMENT 'Referenced demographic impact row in entity_demographic_impacts.id.',
  source_id INT NOT NULL COMMENT 'Referenced source row in sources.id.',
  source_role ENUM('primary', 'supporting', 'methodology', 'context') NOT NULL DEFAULT 'supporting' COMMENT 'Canonical role describing how the linked source supports the impact row.',
  citation_note TEXT NULL COMMENT 'Optional short note describing the specific relevance, excerpt, or citation context for this source link.',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Row creation timestamp.',
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Row update timestamp.',
  PRIMARY KEY (id),
  UNIQUE KEY uq_entity_demographic_impact_sources_impact_source (impact_id, source_id),
  KEY idx_entity_demographic_impact_sources_impact_id (impact_id),
  KEY idx_entity_demographic_impact_sources_source_id (source_id),
  CONSTRAINT fk_entity_demographic_impact_sources_impact
    FOREIGN KEY (impact_id) REFERENCES entity_demographic_impacts (id) ON DELETE CASCADE,
  CONSTRAINT fk_entity_demographic_impact_sources_source
    FOREIGN KEY (source_id) REFERENCES sources (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
