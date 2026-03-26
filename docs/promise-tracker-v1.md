# Promise Tracker v1

## Summary
Promise Tracker v1 is a read-only public feature for tracking presidential promises, the actions tied to them, the outcomes that followed, and the documented source trail behind each record. The current UX is president-first: users begin at a presidency index, drill into a president-specific Promise Tracker page, and then open individual promise detail pages.

## Route Map

### Public Pages
- `/promises`
  - President-first Promise Tracker index in chronological order.
  - Shows one card per president with party, term dates, total tracked promises, and status counts.
- `/promises/president/[slug]`
  - President-specific Promise Tracker page.
  - Shows overview information and promise sections grouped by `Delivered`, `In Progress`, `Partial`, `Failed`, and `Blocked`.
- `/promises/all`
  - Secondary flat browser for all Promise Tracker records.
  - Supports search and filters for president, status, and topic.
- `/promises/[slug]`
  - Individual promise detail page.
  - Shows original promise text, action timeline, outcomes, related policies, related explainers, and linked sources.

### API Routes
- `/api/promises`
  - Flat list API for Promise Tracker records.
  - Supports filters for `president`, `status`, `topic`, optional `q`, and paginated sorting.
- `/api/promises/[slug]`
  - Returns a single promise with actions, outcomes, related policies, related explainers, and grouped source data.
- `/api/promises/presidents`
  - Returns the president index data used by `/promises`.
- `/api/promises/presidents/[slug]`
  - Returns one president overview plus grouped promise sections used by `/promises/president/[slug]`.

## Data Model Summary

### `promises`
Top-level Promise Tracker records.

Key fields:
- `id`
- `president_id`
- `title`
- `slug`
- `promise_text`
- `promise_date`
- `promise_type`
- `campaign_or_official`
- `topic`
- `impacted_group`
- `status`
- `summary`
- `notes`
- `is_demo`
- `created_at`
- `updated_at`

### `promise_actions`
Child timeline records tied to a promise.

Key fields:
- `id`
- `promise_id`
- `action_type`
- `action_date`
- `title`
- `description`
- `related_policy_id`
- `related_explainer_id`
- `created_at`
- `updated_at`

### `promise_outcomes`
Outcome and evidence records tied to a promise.

Key fields:
- `id`
- `promise_id`
- `outcome_summary`
- `outcome_type`
- `measurable_impact`
- `impact_direction`
- `black_community_impact_note`
- `evidence_strength`
- `status_override`
- `created_at`
- `updated_at`

### `promise_sources`
Join table linking promise-level source rows from the existing `sources` table.

Key fields:
- `id`
- `promise_id`
- `source_id`

### `promise_action_sources`
Join table linking action-level source rows from the existing `sources` table.

Key fields:
- `id`
- `promise_action_id`
- `source_id`

### `promise_outcome_sources`
Join table linking outcome-level source rows from the existing `sources` table.

Key fields:
- `id`
- `promise_outcome_id`
- `source_id`

## Service Layer Summary

Primary file:
- [`lib/services/promiseService.js`](/home/josh/Documents/GitHub/equitystack/lib/services/promiseService.js)

Current service responsibilities:
- define Promise Tracker status ordering via `PROMISE_STATUSES`
- provide president slug generation with `getPromisePresidentSlug`
- provide the flat promise browser with `fetchPromiseList`
- provide promise detail data with `fetchPromiseDetail`
- provide president index data with `fetchPromisePresidentIndex`
- provide president detail data with `fetchPromisePresidentDetail`

Key query patterns:
- flat list queries use direct SQL with `WHERE` filters for:
  - `q`
  - `president`
  - `status`
  - `topic`
- president index queries aggregate counts by president with grouped `SUM(CASE WHEN ...)` status totals
- president detail queries fetch one president summary, then one aggregated promise-card query for that president
- promise detail uses a fixed number of queries:
  - one promise header query
  - one action query
  - one outcome query
  - one promise-source query
  - one action-source query
  - one outcome-source query
  - one related-policies query
  - one related-explainers query
  - one total-source summary query

This avoids N+1 expansion on the promise detail page and on the president page.

## Distinct Source Counting
Promise Tracker counts sources as a distinct total across three levels:
- promise-level links from `promise_sources`
- action-level links from `promise_action_sources`
- outcome-level links from `promise_outcome_sources`

Current approach:
- build a `UNION` of linked `source_id` values across the three join tables
- associate each linked source with its owning `promise_id`
- run `COUNT(DISTINCT linked_sources.source_id)`

This is the count used for:
- flat list promise cards
- president-specific promise cards
- promise detail source summary

The count is distinct by `source_id`, so a source linked at more than one level is counted once in the summary total.

## Deployment and Migration Notes

### Schema Migration
- [`database/promise_tracker_migration.sql`](/home/josh/Documents/GitHub/equitystack/database/promise_tracker_migration.sql)

What it does:
- creates `promises`
- creates `promise_actions`
- creates `promise_outcomes`
- creates `promise_sources`
- creates `promise_action_sources`
- creates `promise_outcome_sources`

Important implementation note:
- the existing `sources` table is not modified
- Promise Tracker reuses `sources` through join tables

### Demo Seed
- [`database/promise_tracker_seed.sql`](/home/josh/Documents/GitHub/equitystack/database/promise_tracker_seed.sql)

What it does:
- inserts demo Promise Tracker records and linked actions, outcomes, and source joins
- uses `INSERT IGNORE` for rerun safety on existing demo IDs

### Content Update File
- [`database/promise_tracker_seed_content_update.sql`](/home/josh/Documents/GitHub/equitystack/database/promise_tracker_seed_content_update.sql)

What it does:
- updates the existing seeded demo promise content only
- does not change schema
- does not insert new rows
- does not change IDs or slugs

### Rerun Caveats
- the migration uses `CREATE TABLE IF NOT EXISTS`
  - safe for reruns
  - does not repair schema drift if a table already exists with the wrong shape
- the seed file uses `INSERT IGNORE`
  - safe for reruns
  - does not update existing seeded rows
- the content update file is the correct mechanism for revising seeded Promise Tracker copy after rows already exist

## Manual Test Checklist

### Public Pages
- open `/promises`
  - confirm presidents render in chronological term order
  - confirm each card shows totals and all five status counts
- open `/promises/president/[slug]`
  - confirm overview data renders
  - confirm grouped sections render in the expected status order
  - confirm empty sections show a stable fallback message
- open `/promises/all`
  - confirm search and filters work
  - confirm pagination links preserve filters
- open `/promises/[slug]`
  - confirm actions, outcomes, related policies, related explainers, and sources render correctly

### API Endpoints
- request `/api/promises`
- request `/api/promises?status=In%20Progress`
- request `/api/promises/presidents`
- request `/api/promises/presidents/joseph-r-biden-jr`
- request `/api/promises/biden-advance-racial-equity`

### Data Checks
- confirm `source_count` matches the distinct total across promise, action, and outcome links
- confirm a president page does not trigger per-card follow-up queries
- confirm promise detail still loads even when actions, outcomes, or sources are empty

### Build Check
- run `npx next build --webpack`
- if prerender debugging is needed, run `npx next build --webpack --debug-prerender`

Current known repo note:
- the debug prerender build has an existing unrelated issue on `/scorecards`
- that issue is outside the Promise Tracker feature

## Phase 2 Suggestions

### Dashboard
- add president-level and cross-president Promise Tracker summaries
- add status distribution charts and timeline views
- add topic-based aggregation for housing, voting rights, criminal justice, and similar themes

### Admin Workflow
- add an internal editor workflow for:
  - creating promises
  - adding actions and outcomes
  - attaching sources at each level
  - reviewing and publishing updates

### Cross-Linking
- expand structured cross-links between Promise Tracker, policies, explainers, reports, and future bills
- add contextual “related promises” modules on policy and explainer pages

### More Real Records
- replace or supplement demo records with a larger verified editorial dataset
- add more presidents and more promise coverage per presidency
- tighten source coverage so promise, action, and outcome records are consistently documented
