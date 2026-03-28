# Promise Tracker Current-Administration Intake

## Summary

Promise Tracker remains a curated public record system. Current-administration monitoring is handled separately so raw White House intake does not automatically become a public Promise Tracker record or affect Black Impact Score.

## Why Intake Is Separate

Historical/manual Promise Tracker imports assume records are already curated. Current-administration monitoring is noisier and must pass through staging first.

The current workflow separates the flow into:
- raw ingestion
- staged review candidate
- internal promotion draft
- manually promoted curated Promise Tracker record

Staged items are not public and do not affect public reports until explicitly promoted.

## Nonconsecutive Presidencies

Promise Tracker now uses `presidents.slug` as the source of truth for public presidency routing.

This keeps existing president URLs stable and allows separate administration-term rows for nonconsecutive presidencies, including:
- `donald-j-trump` for 2017-2021
- `donald-j-trump-2025` for 2025-present

This is a bridge solution for presidency terms. It is intentionally smaller than a full person-vs-term identity rewrite.

## Staging Table

Phase 1 adds `current_administration_staging_items`.

Purpose:
- store normalized White House action candidates
- support dedupe and review
- keep a clear boundary between ingestion and public publication

Core fields:
- `source_system`
- `source_category`
- `canonical_url`
- `official_identifier`
- `raw_action_type`
- `title`
- `publication_date`
- `action_date`
- `summary_excerpt`
- `dedupe_key`
- `review_status`
- `promoted_promise_id`
- `promoted_action_id`
- `promoted_source_id`

Allowed statuses:
- `pending_review`
- `approved`
- `rejected`
- `promoted`

Default status is `pending_review`.

## Ingestion Scope

Phase 1 source scope is intentionally narrow:
- White House presidential actions
- White House official statements/releases

No other source systems are included in this phase.

The ingestion script:
- normalizes raw White House feed items
- deduplicates via `dedupe_key`
- upserts into staging
- does not create promises
- does not create outcomes
- does not affect scoring

Script path:
- [`python/scripts/ingest_current_administration.py`](/home/josh/Documents/GitHub/equitystack/python/scripts/ingest_current_administration.py)

## Review Workflow

Phase 2 adds an internal review workflow under `/admin/promises/current-administration`.

Operators can:
- list staged items by status
- inspect normalized staged data
- add review notes
- mark an item `approved`, `rejected`, or back to `pending_review`
- review a cautious promotion draft before creating public Promise Tracker data

Approval means:
- the item is considered fit for manual promotion review
- the item is still not public
- the item still does not affect Promise Tracker reports or Black Impact Score by itself

Rejection means:
- the item remains stored for internal reference
- the item will not be promoted unless it is returned to pending review later

### AI Review Assistant

The review page now supports an internal AI review assistant powered by Ollama `qwen3.5:latest`.

The AI layer is advisory only and stored separately from human review status.

It can suggest:
- whether a staged item looks like a presidency-level action worth tracking
- likely classification fields
- a cleaned-up editorial title and summary
- whether the item looks more like a new record or an update candidate
- caution notes and editorial flags

It cannot:
- approve a staged item
- reject a staged item permanently
- promote a staged item
- create public Promise Tracker records
- create outcomes
- affect Black Impact Score

Human approval is still required before promotion.

### Failure-Safe AI Behavior

AI review is optional and fail-safe.

If Ollama is unavailable:
- review pages still load
- manual review actions still work
- promotion still requires explicit human approval
- the AI section shows the assistant as unavailable instead of blocking the workflow

## Promotion Boundary

The promotion boundary remains server-side and explicit.

Available helpers:
- `listStagedCurrentAdministrationItems`
- `getStagedCurrentAdministrationItem`
- `buildPromisePromotionDraftFromStagedItem`
- `updateStagedCurrentAdministrationItemReviewStatus`
- `promoteStagedCurrentAdministrationItem`

These helpers are internal and review-oriented. They are not part of the public product surface.

### What the Promotion Draft Shows

The promotion draft is intentionally cautious. It shows:
- proposed promise fields for a new record shell
- proposed action fields
- proposed source linkage
- target presidency term
- whether the staged item looks more like a new record or a possible update to an existing Promise Tracker record

Existing-record matching is conservative and explainable. It only considers:
- exact title matches
- existing promise source URL matches
- existing action source URL matches

### What Manual Promotion Creates

Manual promotion only runs when explicitly triggered for an approved staged item.

Promotion currently creates:
- a new `promises` row when no existing target is selected
- one `promise_actions` row
- one source row when the canonical URL is not already in `sources`
- one `promise_action_sources` link
- staging linkage via `promoted_promise_id`, `promoted_action_id`, and `promoted_source_id`

Promotion does **not** create:
- `promise_outcomes`
- outcome evidence
- score calculations
- automatic impact classification
- automatic Black-community effect notes

Outcomes and scoring remain separate editorial steps after promotion.

## Post-Promotion Enrichment

Phase 3 adds a separate enrichment step after promotion.

Flow is now:
- ingestion
- staging
- review
- manual promotion
- manual enrichment
- later scoring

Enrichment happens on the internal admin route:
- `/admin/promises/[id]`

Operators can:
- edit the core promise record
- refine action metadata
- manually create and edit outcomes
- assign impact direction explicitly
- link one or more sources to each outcome

### Outcome Evidence Model

Outcome evidence remains manual and source-backed.

Current enrichment supports:
- outcome description
- outcome type
- impact direction
- evidence strength
- optional status override
- affected groups
- outcome date or timeframe
- multiple linked sources per outcome

Source linkage can:
- reuse an existing linked source
- reuse an existing source automatically when the same URL already exists
- create a new source when needed

### Scoring Ready

`Scoring Ready` is an internal editorial signal only.

A promise is scoring-ready when:
- at least one outcome exists
- every outcome has a description
- every outcome has an impact direction
- every outcome has at least one linked source

This does not block saving and it does not trigger scoring automatically.

### What Enrichment Does Not Do

Enrichment does not:
- auto-generate outcomes
- infer impact direction
- infer Black-community effect
- auto-score the promise
- change Black Impact Score logic

## Biden Bipartisan Border Bill

The bipartisan border bill associated with Joe Biden is not inserted in Phase 1.

Editorial rule:
- immigration/border posture records are conditionally includable only
- they should not be inserted automatically
- they require an explicit cross-president editorial decision about scope

If included later, the current recommendation is:
- model it as a blocked official legislative posture / executive-agenda record
- do not treat it as enacted law
- tie it to Biden only after source review and editorial approval

Primary references:
- Congress.gov bill page: https://www.congress.gov/bill/118th-congress/senate-bill/4361/all-info
- Biden White House archived statement: https://bidenwhitehouse.archives.gov/briefing-room/statements-releases/2024/05/23/statement-from-president-joe-biden-on-senate-republicans-blocking-bipartisan-border-security-reforms/
- DHS fact sheet: https://www.dhs.gov/news/2024/02/04/fact-sheet-bipartisan-border-security-agreement
