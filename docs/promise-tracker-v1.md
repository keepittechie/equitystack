# Promise Tracker v1

## Summary
Promise Tracker v1 is a read-only public feature for tracking presidential promises, the actions tied to them, the outcomes that followed, and the documented source trail behind each record. The current UX is president-first: users begin at a presidency index, drill into a president-specific Promise Tracker page, and then open individual promise detail pages.

Promise Tracker routing is presidency-term based. Repeated presidents appear as separate terms when needed, rather than being merged into a single person-level page.

## Public Transparency Principles

Promise Tracker is designed so public users can inspect the record structure directly.

The public product should keep these distinctions clear:

- `Promise`
  - the public commitment or federal posture being tracked
- `Action`
  - what the administration or federal government did
- `Outcome`
  - what happened in practice after that action
- `Evidence`
  - the linked public sources supporting the action or outcome

Public pages should help users verify a score by moving from summary to record detail, not by hiding record-level complexity.

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
- provide president slug fallback normalization with `getPromisePresidentSlug`
- provide the flat promise browser with `fetchPromiseList`
- provide promise detail data with `fetchPromiseDetail`
- provide president index data with `fetchPromisePresidentIndex`
- provide president detail data with `fetchPromisePresidentDetail`

Current presidency-routing note:
- Promise Tracker now uses the DB-backed `presidents.slug` column as the source of truth for presidency routing.
- Historical slugs were backfilled to match the existing public URLs.
- This keeps existing routes stable while allowing nonconsecutive presidencies to exist as separate administration terms.

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

### Current Database Snapshot
- [`database/equitystack.sql`](/home/josh/Documents/GitHub/equitystack/database/equitystack.sql)
- [`database/promise_tracker_current_admin_phase1.sql`](/home/josh/Documents/GitHub/equitystack/database/promise_tracker_current_admin_phase1.sql)

Current repo convention:
- the full database dump is the schema source of truth
- Promise Tracker tables are included in that dump
- standalone migration and seed helper files used during implementation may be archived or removed once the dump has been refreshed

## Current-Administration Intake

Promise Tracker public records remain a curated editorial layer.

Current-administration monitoring is intentionally separate from historical/manual imports:
- raw White House intake lands in `current_administration_staging_items`
- staged records are review-only and not public
- staged records must not affect Promise Tracker pages or Black Impact Score until explicitly promoted
- no outcomes are auto-created from staged items

### Phase 2.5 AI-Assisted Triage

The internal current-administration review flow now supports an AI review assistant using Ollama `qwen3.5:latest`.

AI review is advisory only:
- it can suggest whether a staged item looks trackable, noisy, or unclear
- it can suggest likely classification fields
- it can suggest a cleaned-up title and summary
- it can suggest whether the item looks more like a new record or an update candidate

AI review cannot:
- approve a staged item
- reject a staged item permanently
- promote a staged item
- create outcomes
- change scoring

Human review remains the approval boundary.

### Phase 2 Review and Promotion

Phase 2 adds an internal review workflow for staged current-administration items.

Internal review responsibilities:
- list staged items by review status
- inspect one staged item in detail
- approve, reject, or return an item to pending review
- build a cautious promotion draft
- manually promote an approved staged item into curated Promise Tracker data

Promotion creates only the minimum curated shell:
- one `promises` row when needed
- one `promise_actions` row
- one linked source record when no existing source matches the canonical URL
- a staging link back to the promoted promise, action, and source

Promotion does **not** create:
- `promise_outcomes`
- score metadata
- automatic impact-direction judgments
- automatic Black-community impact notes

That enrichment remains a later editorial step after promotion.

### Phase 3 Enrichment

Phase 3 adds a post-promotion editor for curated Promise Tracker records at:
- `/admin/promises/[id]`

The enrichment layer is where operators:
- refine the promise shell after promotion
- edit action metadata
- manually add and edit outcomes
- assign impact direction
- link outcome evidence
- determine whether a record is scoring-ready

This phase is intentionally manual:
- no outcomes are auto-created
- no impact direction is inferred
- no score is computed during editing

`Scoring Ready` is an internal editorial signal only. A promise is considered scoring-ready when:
- at least one outcome exists
- each outcome has a description
- each outcome has an impact direction
- each outcome has at least one linked source

This does not block saving. It is a readiness check for later scoring workflows.

Public report views may reference `scoring-ready` as a transparency filter, but that does not expose admin state. It only reflects whether the public record already has the visible outcome and source detail needed for score inclusion.

### Curated Current-Administration Batch Import

When a current-administration dataset has already passed normalization and editorial validation, it can be imported without going through raw staging ingestion.

Use:
- [`python/scripts/import_curated_current_admin_batch.py`](/home/josh/Documents/GitHub/equitystack/python/scripts/import_curated_current_admin_batch.py)

Batch modules live under:
- [`python/data/current_admin_batches`](/home/josh/Documents/GitHub/equitystack/python/data/current_admin_batches)

Reports are written to:
- [`python/reports/current_admin`](/home/josh/Documents/GitHub/equitystack/python/reports/current_admin)

Suggested sequence:
- raw staging intake for noisy current White House feeds
- manual review and promotion for individual staged items
- editorial enrichment for outcomes and sources
- curated batch import for already reviewed multi-record editorial batches

The first live curated batch imported the 2025 Trump term starter set and is recorded in:
- [`python/reports/current_admin/trump-2025-batch-01.import-apply.json`](/home/josh/Documents/GitHub/equitystack/python/reports/current_admin/trump-2025-batch-01.import-apply.json)

### Remaining Promise Tracker Reference File
- [`database/promise_tracker_import_batch_2_sources.md`](/home/josh/Documents/GitHub/equitystack/database/promise_tracker_import_batch_2_sources.md)

What it is for:
- manual source reconciliation for the approved Promise Tracker import batch
- editorial reference, not an executable schema or migration file

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
