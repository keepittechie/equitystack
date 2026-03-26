# Python Update Workflow

This folder contains the daily legislative refresh pipeline plus the future-bill audit, AI review, safe-apply, recovery-suggestion, and missing-candidate discovery steps.

Keep this folder focused on the active pipeline. Generated working artifacts belong under `reports/`, while website-side Promise Tracker schema and import SQL live in the repo-level `database/` folder.

## Daily pipeline

Work from this directory:

```bash
cd /home/josh/Documents/GitHub/equitystack/python
```

## Server wrapper

On the server, there is also an operator wrapper outside the repo at:

```bash
~/bin/equitystack
```

It runs the Python workflow from:

```bash
/home/josh/black-policy-site/python
```

Available wrapper commands:

```bash
equitystack run
equitystack review
equitystack apply
equitystack import
equitystack feedback
```

Wrapper behavior:

- uses the project venv Python automatically
- writes logs to `logs/equitystack-YYYY-MM-DD.log`
- runs the same underlying scripts documented below

Wrapper mapping:

- `equitystack run`
  Runs `run_equitystack_pipeline.py --csv`, `build_review_bundle.py --csv --use-feedback`, `auto_triage_review_bundle.py --apply --yes --auto-approve-safe-actions`, and then `build_review_bundle.py --csv --use-feedback` again to refresh the manual queue after safe approvals
- `equitystack review`
  Runs `review_bundle_actions.py`
- `equitystack apply`
  Runs `apply_review_bundle.py --apply --yes --csv`, `rerun_affected_future_bills.py --from-apply-report reports/equitystack_apply_report.json --csv`, and `build_review_bundle.py --csv --use-feedback`
- `equitystack import`
  Runs `import_approved_tracked_bills.py --apply --yes --link-imported-bills --enrich-metadata --csv` and `build_review_bundle.py --csv --use-feedback`
- `equitystack feedback`
  Runs `analyze_feedback.py` and `build_review_bundle.py --csv --use-feedback`

### Recommended operator flow

Use the new orchestration layer as the default daily workflow:

1. run the full pipeline
2. inspect one consolidated review bundle
3. optionally preview auto-triage or apply only safe auto-approvals
4. review pending operator actions in the CLI inbox
5. dry-run apply
6. apply approved actions for real
7. import approved tracked bills when needed
8. rerun only the affected future bills
9. refresh feedback analysis and rebuild the bundle

### 1. Run the full pipeline

This is now the main daily command:

```bash
python3 run_equitystack_pipeline.py --csv
```

Default pipeline order:

1. refreshed `tracked_bills`, actions, sponsors, legislators, and scorecard snapshots
2. a fresh deterministic future-bill link audit
3. an Ollama review of risky current links
4. a dry-run safe-removal report plus a manual-review queue
5. partial and replacement suggestions for links that should not stay `Direct`
6. candidate discovery only if suggestions still show unresolved cases
7. one consolidated review bundle

Main outputs:

- `reports/equitystack_pipeline_report.json`
- `reports/equitystack_review_bundle.json`

Working note:

- `reports/` contains generated operator outputs and review bundles
- rerunning the pipeline regenerates those files
- one-off website import staging files are no longer kept in `python/`

Useful variants:

```bash
python3 run_equitystack_pipeline.py --skip-discovery --csv
python3 run_equitystack_pipeline.py --apply-safe-removals --csv
python3 run_equitystack_pipeline.py --only-future-bill-id 2 --csv
python3 run_equitystack_pipeline.py --model qwen3.5:latest --csv
```

### 2. Inspect the review bundle

The bundle combines the current day’s outputs into one operator package:

```bash
python3 scripts/build_review_bundle.py --csv --use-feedback
```

Outputs:

- `reports/equitystack_review_bundle.json`
- optional CSV summary

Current behavior:

- reads `current_links` live from the database
- safely normalizes mixed upstream report item shapes
- skips malformed or non-groupable rows instead of crashing
- records bundle-level diagnostics in `normalization_summary` and `skipped_items`

The bundle groups by `future_bill_id` and includes:

- safe removal candidates
- manual review rows
- suggested partial conversions
- suggested alternate replacements
- candidate discovery results
- operator actions with:
  - `approved`
  - `status`
  - `review_state`
  - `action_score`
  - `action_priority`
  - `score_breakdown`

### 2a. Optional auto-triage preview

Use this to preview score-based approvals or dismissals without mutating the bundle:

```bash
python3 scripts/auto_triage_review_bundle.py --dry-run
```

To persist auto-triage decisions:

```bash
python3 scripts/auto_triage_review_bundle.py \
  --apply --yes \
  --auto-approve-high \
  --auto-dismiss-low
```

This step:

- never changes scoring logic
- only updates `approved` / `status`
- can also write `auto_triaged`, `auto_triage_decision`, and `auto_triage_reason`
- writes `reports/equitystack_auto_triage_report.json`
- appends decision history to `reports/equitystack_feedback_log.json`

The server wrapper currently uses:

```bash
python3 scripts/auto_triage_review_bundle.py --apply --yes --auto-approve-safe-actions
```

That keeps the behavior conservative by auto-approving only the narrow safe-action subset while leaving higher-risk actions for manual review.

### 3. Approve selected actions

Use the CLI reviewer:

```bash
python3 scripts/review_bundle_actions.py
```

Filter to one future bill if needed:

```bash
python3 scripts/review_bundle_actions.py --only-future-bill-id 2
```

This opens a simple review loop over pending `operator_actions`.

Main commands:

- `a <num>` approve one action
- `d <num>` dismiss one action
- `u <num>` reset one action
- `af <future_bill_id>` approve all pending actions for one future bill
- `df <future_bill_id>` dismiss all pending actions for one future bill
- `p <num>` print full JSON for one action
- `show score <num>` print score breakdown for one action
- `sort score` sort by `action_score` descending
- `sort priority` sort by `action_priority`
- `sort default` restore legacy ordering
- `l` re-list pending actions
- `s` save
- `x` save and exit
- `q` quit without saving

If you prefer, you can still edit `reports/equitystack_review_bundle.json` directly and change only the actions you want to approve.

Typical changes:

- set `approved` to `true`
- keep `status` as `pending` for actions you intend to apply
- `review_bundle_actions.py` can also set `status` to `dismissed`

Nothing is auto-approved just because it appears in the bundle.

### 4. Dry-run apply the approved actions

```bash
python3 scripts/apply_review_bundle.py --csv
```

Outputs:

- `reports/equitystack_apply_report.json`
- optional CSV summary

This step:

- reads only approved actions from the review bundle
- defaults to dry-run
- applies nothing unless you pass `--apply --yes`
- prepares `reports/approved_tracked_bills_seed.json` only when approved `import_candidate_seed` actions are present
- appends approved operator decisions to `reports/equitystack_feedback_log.json` in apply mode

### 5. Apply approved actions for real

```bash
python3 scripts/apply_review_bundle.py --apply --yes --csv
```

This step can:

- remove an approved direct link
- convert an existing link to `Partial`
- create a new approved `Partial` link
- write an approved tracked-bill seed file for later import

### 6. Import approved tracked bills when needed

Use this after approved seed rows have been written:

```bash
python3 scripts/import_approved_tracked_bills.py \
  --apply --yes \
  --link-imported-bills \
  --enrich-metadata \
  --csv
```

This step:

- reads `reports/approved_tracked_bills_seed.json`
- matches existing `tracked_bills` conservatively
- inserts new tracked bills only when no exact match exists
- optionally creates `future_bill_links`
- can enrich missing metadata from reusable Congress.gov helpers only when `--enrich-metadata` is passed
- writes `reports/import_approved_tracked_bills_report.json`

### 7. Rerun only the affected future bills

After applying approved actions:

```bash
python3 scripts/rerun_affected_future_bills.py --from-apply-report reports/equitystack_apply_report.json --csv
```

This reruns only the minimum downstream steps for the affected `future_bill_id` values:

- reruns partial/replacement suggestions
- reruns candidate discovery only when those future bills still remain unresolved

Rerun is now resilient to missing intermediate reports:

- uses `reports/future_bill_link_ai_review.json` if it exists
- uses `reports/future_bill_link_manual_review_queue.json` if it exists
- skips the suggestion rerun cleanly if neither input report exists
- writes `reports/equitystack_rerun_report.json`

### 8. Refresh feedback analysis

```bash
python3 scripts/analyze_feedback.py
```

This step:

- reads `reports/equitystack_feedback_log.json`
- computes approval trends by `action_type` and `link_type`
- writes `reports/equitystack_feedback_analysis.json`
- provides small capped scoring suggestions for `build_review_bundle.py --use-feedback`

## Direct script flow

Use the lower-level scripts directly only when you want to debug a specific step or bypass the master runner.

### When to stop after each step

- Stop after `update_database.py` if you only want the raw refresh and audit.
- Stop after `review_future_bill_audit_with_ollama.py` if you only want machine recommendations.
- Stop after `apply_future_bill_ai_review.py` dry-run if you are reviewing obvious removals first.
- Run `suggest_partial_future_bill_links.py` when you want recovery suggestions for removed or weak direct links.
- Run `find_candidate_tracked_bills.py` only when the suggestion step still ends in `manual_review_only` or `no_good_candidate_found`.

## What each daily command does

### 1. Refresh data and rebuild the deterministic audit

```bash
python3 update_database.py
```

Writes:

- `reports/future_bill_link_audit.json`

This command:

- refreshes existing `tracked_bills` from Congress.gov
- rebuilds `tracked_bill_actions` and `tracked_bill_sponsors`
- rebuilds legislator tables and `legislator_scorecard_snapshots`
- runs the future-bill link audit

### 2. Run the AI review layer

Use `qwen3.5:latest` as the normal default reviewer.

```bash
python3 scripts/review_future_bill_audit_with_ollama.py --model qwen3.5:latest
```

Useful variants:

```bash
python3 scripts/review_future_bill_audit_with_ollama.py --include-medium --csv
python3 scripts/review_future_bill_audit_with_ollama.py --only-link-id 5 --model qwen3.5:latest --csv
python3 scripts/review_future_bill_audit_with_ollama.py --max-items 10 --timeout 180 --csv
```

Writes:

- `reports/future_bill_link_ai_review.json`
- optional CSV

This step:

- reviews `high_risk` audit items by default
- scores policy alignment, not just keyword overlap
- recommends `keep_direct`, `change_to_partial`, `remove_link`, or `review_manually`
- does not mutate the database

### 3. Dry-run the safe removal layer

```bash
python3 scripts/apply_future_bill_ai_review.py \
  --input reports/future_bill_link_ai_review.json \
  --csv
```

Writes:

- `reports/future_bill_link_ai_apply_report.json`
- `reports/future_bill_link_manual_review_queue.json`
- optional CSV files

This step:

- reads the AI review output
- finds the small subset of obvious `remove_link` cases that are safe enough to auto-apply
- stays in dry-run mode unless you pass `--apply`

### 4. Optionally apply safe removals

Only run this after checking the dry-run report:

```bash
python3 scripts/apply_future_bill_ai_review.py \
  --input reports/future_bill_link_ai_review.json \
  --apply \
  --yes \
  --archive-rows \
  --csv
```

This is the only future-bill maintenance step that currently mutates the database.

### 5. Suggest partial conversions and alternate replacements

```bash
python3 scripts/suggest_partial_future_bill_links.py \
  --input-review-report reports/future_bill_link_ai_review.json \
  --input-manual-queue reports/future_bill_link_manual_review_queue.json \
  --top-k 5 \
  --csv
```

Writes:

- `reports/future_bill_link_partial_suggestions.json`
- optional CSV

This step:

- checks whether the current tracked bill should survive as `Partial`
- looks for better tracked bills already in the database
- uses strict domain and mechanism guardrails
- stays suggestion-only

### 6. Discover missing tracked-bill candidates

Run this when the suggestion step still cannot find a plausible anchor:

```bash
python3 scripts/find_candidate_tracked_bills.py \
  --trigger-from-suggestions reports/future_bill_link_partial_suggestions.json \
  --trigger-from-review reports/future_bill_link_ai_review.json \
  --top-k 5 \
  --csv
```

Writes:

- `reports/future_bill_candidate_discovery.json`
- optional CSV

This step:

- focuses on future bills with weak tracked-bill coverage
- checks existing `tracked_bills` first
- then searches Congress.gov through the existing import helpers
- keeps hard filters for domain, bill type, and anchor terms

### 7. Optionally write a conservative seed file

```bash
python3 scripts/find_candidate_tracked_bills.py \
  --trigger-from-suggestions reports/future_bill_link_partial_suggestions.json \
  --trigger-from-review reports/future_bill_link_ai_review.json \
  --top-k 5 \
  --write-seed
```

Writes:

- `reports/tracked_bills_candidate_seed.json`

This does not import anything. It only prepares reviewed seed material for later approval.

### 8. Import approved seeds through the review-first bridge

Do not import discovery seed files directly into `tracked_bills`.

Approved seed rows now flow through:

```bash
python3 scripts/apply_review_bundle.py --apply --yes --csv
python3 scripts/import_approved_tracked_bills.py --apply --yes --link-imported-bills --enrich-metadata --csv
```

Then rerun:

1. `scripts/rerun_affected_future_bills.py --from-apply-report reports/equitystack_apply_report.json --csv`
2. `scripts/build_review_bundle.py --csv --use-feedback`

## Common daily command sets

### Fast routine maintenance

Use this most days:

```bash
python3 update_database.py
python3 scripts/review_future_bill_audit_with_ollama.py --model qwen3.5:latest
python3 scripts/apply_future_bill_ai_review.py --input reports/future_bill_link_ai_review.json --csv
python3 scripts/suggest_partial_future_bill_links.py \
  --input-review-report reports/future_bill_link_ai_review.json \
  --input-manual-queue reports/future_bill_link_manual_review_queue.json \
  --top-k 5 \
  --csv
```

### Safe-apply day

Use this when you are ready to remove only the most obvious bad direct links:

```bash
python3 scripts/apply_future_bill_ai_review.py --input reports/future_bill_link_ai_review.json --csv
python3 scripts/apply_future_bill_ai_review.py --input reports/future_bill_link_ai_review.json --apply --yes --archive-rows --csv
```

### Review-bundle day

Use this when you want the review-first workflow instead of step-by-step manual operation:

```bash
python3 run_equitystack_pipeline.py --csv
python3 scripts/build_review_bundle.py --csv --use-feedback
python3 scripts/auto_triage_review_bundle.py --apply --yes --auto-approve-safe-actions
python3 scripts/build_review_bundle.py --csv --use-feedback
python3 scripts/review_bundle_actions.py
python3 scripts/apply_review_bundle.py --csv
python3 scripts/apply_review_bundle.py --apply --yes --csv
python3 scripts/import_approved_tracked_bills.py --apply --yes --link-imported-bills --enrich-metadata --csv
python3 scripts/rerun_affected_future_bills.py --from-apply-report reports/equitystack_apply_report.json --csv
python3 scripts/analyze_feedback.py
python3 scripts/build_review_bundle.py --csv --use-feedback
```

### Recovery day

Use this when links were removed or downgraded and you want replacement ideas:

```bash
python3 scripts/suggest_partial_future_bill_links.py \
  --input-review-report reports/future_bill_link_ai_review.json \
  --input-manual-queue reports/future_bill_link_manual_review_queue.json \
  --top-k 5 \
  --csv
```

### Discovery day

Use this when the suggestion step still returns `manual_review_only` or `no_good_candidate_found`:

```bash
python3 scripts/find_candidate_tracked_bills.py \
  --trigger-from-suggestions reports/future_bill_link_partial_suggestions.json \
  --trigger-from-review reports/future_bill_link_ai_review.json \
  --top-k 5 \
  --csv
```

### Focus on one future bill

Good for debugging or manual review:

```bash
python3 scripts/review_future_bill_audit_with_ollama.py \
  --only-link-id 5 \
  --model qwen3.5:latest \
  --csv

python3 scripts/suggest_partial_future_bill_links.py \
  --input-review-report reports/future_bill_link_ai_review.json \
  --only-future-bill-id 2 \
  --top-k 5 \
  --csv

python3 scripts/find_candidate_tracked_bills.py \
  --only-future-bill-id 2 \
  --trigger-from-review reports/future_bill_link_ai_review.json \
  --top-k 5 \
  --csv
```

## Daily output files to check first

- `reports/equitystack_pipeline_report.json`
- `reports/equitystack_review_bundle.json`
- `reports/equitystack_auto_triage_report.json`
- `reports/equitystack_apply_report.json`
- `reports/import_approved_tracked_bills_report.json`
- `reports/equitystack_rerun_report.json`
- `reports/approved_tracked_bills_seed.json`
- `reports/equitystack_feedback_log.json`
- `reports/equitystack_feedback_analysis.json`
- `reports/future_bill_link_audit.json`
- `reports/future_bill_link_ai_review.json`
- `reports/future_bill_link_ai_apply_report.json`
- `reports/future_bill_link_manual_review_queue.json`
- `reports/future_bill_link_partial_suggestions.json`
- `reports/future_bill_candidate_discovery.json`
- `reports/tracked_bills_candidate_seed.json`

## Guardrails

- `apply_future_bill_ai_review.py` is dry-run by default.
- `apply_review_bundle.py` is dry-run by default.
- `auto_triage_review_bundle.py` is dry-run by default.
- `import_approved_tracked_bills.py` is dry-run by default.
- The current apply layer only auto-applies `remove_link`.
- `keep_direct`, `change_to_partial`, and new-link creation remain manual-only.
- The bundle apply layer only mutates rows you explicitly approve.
- `import_candidate_seed` approval writes reviewed seed material first; `import_approved_tracked_bills.py` is the separate bridge into `tracked_bills`.
- `suggest_partial_future_bill_links.py` never mutates the database.
- `find_candidate_tracked_bills.py` never mutates the database.
- feedback-based scoring only applies small capped adjustments and does not replace base scoring
- Housing and other strict domain filters were not relaxed by the education/HBCU scoring work.
- Education/HBCU institutional-support fallback is narrow and only applies to real higher-ed institutional funding candidates.

## Reports you will use most

- `reports/future_bill_link_audit.json`
  Raw deterministic audit output.
- `reports/future_bill_link_ai_review.json`
  AI-reviewed decisions for risky current links.
- `reports/future_bill_link_ai_apply_report.json`
  Dry-run or applied removal decisions.
- `reports/future_bill_link_manual_review_queue.json`
  Items still needing human review after the safe apply stage.
- `reports/future_bill_link_partial_suggestions.json`
  Suggested partial conversions and alternate replacements.
- `reports/future_bill_candidate_discovery.json`
  Missing tracked-bill candidate discovery output.
- `reports/approved_tracked_bills_seed.json`
  Approved tracked-bill seed material waiting for import.
- `reports/import_approved_tracked_bills_report.json`
  Tracked-bill import and linking results.
- `reports/equitystack_feedback_analysis.json`
  Approval-rate trends and suggested scoring adjustments.

## The one-script model

You can now treat `update_database.py` as the public entrypoint for database work.

### Routine refresh

```bash
python3 update_database.py
```

or

```bash
python3 update_database.py refresh
```

### Import a full policy pack

```bash
python3 update_database.py import-policy-pack data/policies/your_pack.json
```

### Import an enrichment pack

```bash
python3 update_database.py import-enrichment data/policies/enrichment_pack.json
```

## Optional shell wrapper

You can also run:

```bash
cd /home/josh/Documents/GitHub/equitystack/python
./run_legislative_updates.sh
```

If needed, make it executable once:

```bash
chmod +x run_legislative_updates.sh
```

## Common update commands

### 1. Routine refresh from existing tracked bills

```bash
python3 update_database.py
```

### 2. Import a new tracked-bill seed file and then refresh everything

```bash
python3 update_database.py refresh --seed data/tracked_bills_seed.json
```

### 3. Refresh everything but skip the mismatch audit

```bash
python3 update_database.py refresh --skip-audit
```

### 4. Write the audit report somewhere else

```bash
python3 update_database.py refresh --audit-json /tmp/future_bill_link_audit.json
```

## Historical policy imports

These are separate from the legislative refresh flow.

### Import a new full policy pack

```bash
python3 update_database.py import-policy-pack data/policies/your_pack.json
```

### Enrich existing policies with sources and metrics

```bash
python3 update_database.py import-enrichment data/policies/enrichment_pack.json
```

## Script roles

Use these scripts directly only when you need a narrower operation:

- `update_database.py`
  The one script you should remember. Use this unless you are debugging internals.
- `scripts/run_all_updates.py`
  Internal orchestration for day-to-day legislative updates.
- `scripts/import_tracked_bills.py`
  Refresh tracked bill rows from Congress.gov.
- `scripts/import_legislators_from_tracked_bills.py`
  Rebuild legislator tables and scorecard snapshots from tracked bill sponsors.
- `scripts/audit_future_bill_links.py`
  Check whether future bill ideas are linked to the right real bills.
- `scripts/review_future_bill_audit_with_ollama.py`
  Run the rubric-based Ollama review over the existing future-bill audit report.
- `scripts/apply_future_bill_ai_review.py`
  Dry-run or apply only the safest AI-driven `remove_link` actions, with audit logging and a manual review queue.
- `run_equitystack_pipeline.py`
  Run the documented daily pipeline in order, stop on failures, and write one pipeline summary plus a fresh review bundle.
- `scripts/build_review_bundle.py`
  Consolidate the current day’s outputs into one grouped review package for operator approval.
  It now scores actions, writes `action_score` / `action_priority` / `score_breakdown`, and can apply small feedback-based adjustments with `--use-feedback`.
- `scripts/review_bundle_actions.py`
  Review pending bundle operator actions in a simple CLI inbox, sorted by score when available, with score breakdown inspection and flexible sorting.
- `scripts/auto_triage_review_bundle.py`
  Optionally auto-approve or auto-dismiss a narrow subset of scored actions, with dry-run by default and a JSON triage report.
- `scripts/apply_review_bundle.py`
  Apply only explicitly approved review-bundle actions, with dry-run by default, audit logging for DB mutations, and feedback-log entries for applied operator decisions.
- `scripts/import_approved_tracked_bills.py`
  Import approved tracked-bill seed rows into `tracked_bills`, optionally create `future_bill_links`, and optionally enrich missing metadata.
- `scripts/rerun_affected_future_bills.py`
  Rerun only the minimum downstream steps for the future bills affected by approved changes.
  It now skips optional suggestion inputs cleanly when the AI review report or manual review queue is missing.
- `scripts/analyze_feedback.py`
  Summarize operator decisions from the feedback log and produce small capped score-tuning suggestions.
- `scripts/suggest_partial_future_bill_links.py`
  Suggest conservative partial conversions and alternate tracked-bill replacements without mutating the database.
- `scripts/find_candidate_tracked_bills.py`
  Discover missing tracked-bill candidates for future bill concepts that still lack a good anchor, and optionally write a conservative seed file.
- `scripts/import_policies.py`
  Import new policy records from JSON packs.
- `scripts/import_audit.py`
  Attach extra sources and metrics to existing policy records.
- `scripts/audit_policy_pack_duplicates.py`
  Finds duplicate title-year entries across full policy packs before import.

## Environment requirements

These scripts expect the project root `.env.local` file to contain:

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `CONGRESS_API_KEY`

The scripts read:

```text
/home/josh/Documents/GitHub/equitystack/.env.local
```

## Recommended schedule

For the current site, a good cadence is:

- twice daily for normal upkeep
- more often during active congressional periods if you want the Activity page to feel fresher

Example cron entry:

```cron
15 6,18 * * * cd /home/josh/Documents/GitHub/equitystack/python && /usr/bin/python3 update_database.py >> /home/josh/Documents/GitHub/equitystack/python/update.log 2>&1
```

## Troubleshooting

### `403 Client Error` from Congress API

Usually means one of these:

- `CONGRESS_API_KEY` is missing
- the key is invalid
- the key is not activated yet

Check `.env.local` first.

### `pymysql` or connection errors

Check:

- the MariaDB server is reachable
- `DB_HOST` points to the right machine
- the username and password are still valid
- the database name is still `black_policy_tracker`

### Audit reports show high-risk links

Open the JSON report and review the affected `future_bill_links`.
This usually means a real bill number is attached to the wrong future-bill concept.

### I want to find duplicate historical records before importing more packs

Run:

```bash
python3 scripts/audit_policy_pack_duplicates.py
```

Optional JSON output:

```bash
python3 scripts/audit_policy_pack_duplicates.py /tmp/policy_pack_duplicates.json
```

### The site still looks stale after a successful update

Check:

- whether the update script actually synced rows
- whether the app server is reading the same database
- whether your page cache or process needs a restart

### I only want to refresh scorecards after editing legislator data

Run:

```bash
python3 scripts/import_legislators_from_tracked_bills.py
```

## Removed script

The old standalone scorecard snapshot script was removed so there is less confusion.
Snapshot recomputation now happens through:

- `scripts/import_legislators_from_tracked_bills.py`
- `scripts/run_all_updates.py`
