-- Additive time dimension for unified policy outcomes.
--
-- This migration is intentionally nullable and backward-compatible:
--   - no existing outcomes are modified
--   - unknown dates remain NULL
--   - exact or inferred date choices should be documented by audit/report artifacts

ALTER TABLE policy_outcomes
  ADD COLUMN IF NOT EXISTS impact_start_date DATE NULL AFTER status,
  ADD COLUMN IF NOT EXISTS impact_end_date DATE NULL AFTER impact_start_date,
  ADD COLUMN IF NOT EXISTS impact_duration_estimate VARCHAR(64) NULL AFTER impact_end_date,
  ADD INDEX IF NOT EXISTS idx_policy_outcomes_impact_start_date (impact_start_date),
  ADD INDEX IF NOT EXISTS idx_policy_outcomes_impact_date_range (impact_start_date, impact_end_date);
