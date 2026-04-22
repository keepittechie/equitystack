-- Unified demographic impact facts for policies, tracked bills, and promises.
--
-- `entity_id` is a polymorphic reference:
--   - entity_type = 'policy'      -> policies.id
--   - entity_type = 'tracked_bill' -> tracked_bills.id
--   - entity_type = 'promise'     -> promises.id
--
-- MySQL/MariaDB cannot enforce that conditional foreign key directly without
-- splitting the model into separate nullable columns, so read/write code should
-- validate the target entity before inserting.

CREATE TABLE IF NOT EXISTS entity_demographic_impacts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Primary key for a structured demographic impact fact row.',
  entity_type ENUM('policy', 'tracked_bill', 'promise') NOT NULL COMMENT 'Polymorphic entity type. policy maps to policies.id, tracked_bill maps to tracked_bills.id, and promise maps to promises.id.',
  entity_id BIGINT UNSIGNED NOT NULL COMMENT 'Target record id interpreted according to entity_type.',
  demographic_group VARCHAR(150) NOT NULL COMMENT 'Human-readable demographic group label such as Black Americans, Black women, or Black veterans.',
  metric_name VARCHAR(255) NOT NULL COMMENT 'Name of the measured outcome or disparity metric.',
  before_value DECIMAL(14,4) NULL COMMENT 'Observed baseline value before the policy change, implementation period, or comparison interval.',
  after_value DECIMAL(14,4) NULL COMMENT 'Observed value after the policy change, implementation period, or comparison interval.',
  comparison_value DECIMAL(14,4) NULL COMMENT 'Optional benchmark or comparison-group value used to interpret disparate impact.',
  unit VARCHAR(64) NULL COMMENT 'Measurement unit such as percent, dollars, people, rate, or ratio.',
  geography VARCHAR(150) NULL COMMENT 'Geographic scope for the metric, such as United States, Mississippi, or covered jurisdictions.',
  period_start DATE NULL COMMENT 'Inclusive start date for the measurement window when a single year field is not sufficient.',
  period_end DATE NULL COMMENT 'Inclusive end date for the measurement window when a single year field is not sufficient.',
  year_before SMALLINT UNSIGNED NULL COMMENT 'Optional baseline year when the metric is anchored to a before-period year rather than a full date range.',
  year_after SMALLINT UNSIGNED NULL COMMENT 'Optional after-period year when the metric is anchored to an after-period year rather than a full date range.',
  disparity_ratio DECIMAL(14,6) NULL COMMENT 'Optional precomputed disparity ratio or proportional gap associated with the metric row.',
  confidence_score DECIMAL(5,4) NULL COMMENT 'Optional confidence score from 0.0000 to 1.0000 for data quality or attribution confidence.',
  methodology_note TEXT NULL COMMENT 'Short methodology, caveat, or interpretation note explaining how the metric should be read.',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Row creation timestamp.',
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Row update timestamp.',
  PRIMARY KEY (id),
  UNIQUE KEY uniq_entity_demographic_impacts_entity_metric_period (
    entity_type,
    entity_id,
    demographic_group,
    metric_name,
    geography,
    year_before,
    year_after
  ),
  KEY idx_entity_demographic_impacts_entity (entity_type, entity_id),
  KEY idx_entity_demographic_impacts_demographic_group (demographic_group),
  KEY idx_entity_demographic_impacts_metric_name (metric_name),
  KEY idx_entity_demographic_impacts_period (period_start, period_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
