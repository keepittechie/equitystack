# Promise Tracker Current-Administration Intake

## Summary

Promise Tracker remains a curated public record system. Current-administration monitoring is handled separately so raw White House intake does not automatically become a public Promise Tracker record or affect Black Impact Score.

The first live curated current-administration batch has now been imported for the `donald-j-trump-2025` term. That batch created public Promise Tracker records only after editorial normalization, source validation, and production-safe ingest checks.

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
- [`python/scripts/ingest_current_administration.py`](../python/scripts/ingest_current_administration.py)

## Review Workflow

Phase 2 adds an internal review workflow under `/admin/promises/current-administration`.

That admin surface is now a manual staging review and promotion UI, not the canonical
current-admin AI review pipeline.

Canonical current-admin review generation now lives in the Python artifact workflow under:
- `python/scripts/normalize_current_admin_batch.py`
- `python/scripts/review_current_admin_batch_with_ollama.py`
- `python/scripts/apply_current_admin_ai_review.py`
- `python/reports/current_admin/`

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

## Curated Batch Import

Current-administration records can now enter Promise Tracker through two different paths:
- staging ingestion and manual promotion for action-by-action review
- curated batch import for a pre-validated editorial dataset

There is also a separate discovery layer for suggestion-only research. Discovery does not write to the database and does not bypass curated batch review.

Curated batch import is for cases where the dataset has already passed:
- editorial normalization
- source validation
- status and impact consistency review
- duplicate and relationship checks

Primary Python scripts:
- [`python/scripts/discover_current_admin_updates.py`](../python/scripts/discover_current_admin_updates.py)
- [`python/scripts/export_current_admin_discovery_candidates.py`](../python/scripts/export_current_admin_discovery_candidates.py)
- [`python/scripts/normalize_current_admin_batch.py`](../python/scripts/normalize_current_admin_batch.py)
- [`python/scripts/review_current_admin_batch_with_ollama.py`](../python/scripts/review_current_admin_batch_with_ollama.py)
- [`python/scripts/apply_current_admin_ai_review.py`](../python/scripts/apply_current_admin_ai_review.py)
- [`python/scripts/import_curated_current_admin_batch.py`](../python/scripts/import_curated_current_admin_batch.py)
- [`python/scripts/validate_current_admin_import.py`](../python/scripts/validate_current_admin_import.py)

Current batch file:
- [`python/data/current_admin_batches/trump_2025_batch_01.json`](../python/data/current_admin_batches/trump_2025_batch_01.json)

Audit report directory:
- [`python/reports/current_admin`](../python/reports/current_admin)

Recommended workflow:
- optionally run discovery to identify stale records, missing actions, and possible new promise candidates
- review `python/reports/current_admin/discovery_report.json`
- export selected discovery suggestions into a draft batch file
- edit that draft into a curated batch JSON or enrichment batch
- run the canonical Python wrapper flow
- fill explicit operator actions in the generated decision template
- run the read-only pre-commit review before import
- inspect the generated ingest report for duplicates, conflicts, and validation results
- rerun with `--apply` only after the dry run is clean
- keep the apply report in the audit directory

Example commands:

```bash
cd python
./bin/equitystack current-admin workflow start --input data/current_admin_batches/trump_2025_batch_01.json
./bin/equitystack current-admin workflow review --input reports/current_admin/trump-2025-batch-01.ai-review.json --output /tmp/trump-2025-batch-01.decision-template.json
./bin/equitystack current-admin workflow finalize --review reports/current_admin/trump-2025-batch-01.ai-review.json --decision-file /tmp/trump-2025-batch-01.decision-template.json --log-decisions
./bin/equitystack current-admin pre-commit --input reports/current_admin/trump-2025-batch-01.manual-review-queue.json
./bin/equitystack current-admin import --input reports/current_admin/trump-2025-batch-01.manual-review-queue.json
./bin/equitystack current-admin import --input reports/current_admin/trump-2025-batch-01.manual-review-queue.json --apply --yes
./bin/equitystack current-admin validate --input reports/current_admin/trump-2025-batch-01.manual-review-queue.json
```

Raw Python entrypoints still exist under `python/scripts/` for debugging, but the wrapper is the recommended operator interface.

The import script remains non-destructive:
- promise matching prefers existing slug or title-plus-president matches
- missing fields are filled only when safe
- existing verified summaries and notes are preserved
- action, outcome, and source links are deduplicated

The discovery script is also non-destructive:
- it reads current Promise Tracker data and optional trusted feed inputs
- it writes a JSON suggestion report only
- it never creates or updates Promise Tracker records by itself

The export helper is also non-destructive:
- it reads `python/reports/current_admin/discovery_report.json`
- it writes a draft starter batch under `python/data/current_admin_batches/`
- it requires explicit operator selection
- it marks exported files as review-required and not ready for direct import

### First Live Curated Batch

The first live curated current-administration batch is:
- `trump-2025-batch-01`

Production apply result:
- 10 promises created
- 10 actions created
- 10 outcomes created
- 14 sources created
- 16 sources reused

Audit file:
- [`python/reports/current_admin/trump-2025-batch-01.import-apply.json`](../python/reports/current_admin/trump-2025-batch-01.import-apply.json)

### Staging AI Review Status

Historical staged-item AI review rows may still be visible in the admin UI, but the live
staging AI generator is deprecated.

The canonical AI review path for current-administration records is the Python artifact pipeline.
That keeps:
- review generation
- deep review
- worklists
- decision logging
- feedback summaries

in one canonical process instead of splitting them between the app and Python.

### Failure-Safe Admin Behavior

The admin staging page remains safe even without AI generation:

- review pages still load
- manual review actions still work
- promotion still requires explicit human approval
- the canonical Python pipeline remains the source of review artifacts and analytics

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

## Public Term Representation

Promise Tracker public pages are presidency-term based, not person based.

That means:
- `/promises` lists presidency terms in chronological order
- `/promises/president/donald-j-trump` refers to the 2017-2021 Trump term
- `/promises/president/donald-j-trump-2025` refers to the 2025-present Trump term
- promise detail pages inherit the correct presidency-term context from their linked president record

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
