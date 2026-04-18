-- Additive systemic-impact tracking for historical policies.
-- This migration is intentionally nullable and does not backfill or infer classifications.

SET @systemic_impact_summary_sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE policies ADD COLUMN systemic_impact_summary TEXT NULL AFTER policy_intent_category',
    'SELECT ''systemic_impact_summary already exists'' AS migration_note'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'policies'
    AND COLUMN_NAME = 'systemic_impact_summary'
);
PREPARE systemic_impact_summary_stmt FROM @systemic_impact_summary_sql;
EXECUTE systemic_impact_summary_stmt;
DEALLOCATE PREPARE systemic_impact_summary_stmt;

SET @systemic_impact_category_sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE policies ADD COLUMN systemic_impact_category ENUM(''limited'',''standard'',''strong'',''transformational'',''unclear'') NULL AFTER systemic_impact_summary',
    'SELECT ''systemic_impact_category already exists'' AS migration_note'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'policies'
    AND COLUMN_NAME = 'systemic_impact_category'
);
PREPARE systemic_impact_category_stmt FROM @systemic_impact_category_sql;
EXECUTE systemic_impact_category_stmt;
DEALLOCATE PREPARE systemic_impact_category_stmt;

