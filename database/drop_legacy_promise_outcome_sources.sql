-- Retire the legacy current-admin outcome linkage table after canonical migration.
--
-- Preconditions:
-- 1. `policy_outcome_sources` exists and has been backfilled.
-- 2. `policy_outcomes.source_count` / `source_quality` have been refreshed from
--    canonical links.
-- 3. Application and workflow code no longer read or write
--    `promise_outcome_sources`.

DROP TABLE IF EXISTS promise_outcome_sources;
