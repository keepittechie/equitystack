-- Additive policy intent tracking for historical policies.
-- This migration is intentionally nullable and does not backfill or infer intent.

SET @policy_intent_summary_sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE policies ADD COLUMN policy_intent_summary TEXT NULL AFTER summary',
    'SELECT ''policy_intent_summary already exists'' AS migration_note'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'policies'
    AND COLUMN_NAME = 'policy_intent_summary'
);
PREPARE policy_intent_summary_stmt FROM @policy_intent_summary_sql;
EXECUTE policy_intent_summary_stmt;
DEALLOCATE PREPARE policy_intent_summary_stmt;

SET @policy_intent_category_sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE policies ADD COLUMN policy_intent_category ENUM(''equity_expanding'',''equity_restricting'',''neutral_administrative'',''mixed_or_competing'',''unclear'') NULL AFTER policy_intent_summary',
    'SELECT ''policy_intent_category already exists'' AS migration_note'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'policies'
    AND COLUMN_NAME = 'policy_intent_category'
);
PREPARE policy_intent_category_stmt FROM @policy_intent_category_sql;
EXECUTE policy_intent_category_stmt;
DEALLOCATE PREPARE policy_intent_category_stmt;
