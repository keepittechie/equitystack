-- Additive impact magnitude for unified policy outcomes.
--
-- This migration is intentionally nullable and backward-compatible. The
-- certification readiness workflow backfills deterministic signed values:
--   Positive -> +1.0
--   Mixed    -> +0.5
--   Negative -> -1.0
--   Blocked  ->  0.0

ALTER TABLE policy_outcomes
  ADD COLUMN IF NOT EXISTS impact_score FLOAT NULL AFTER source_quality;
