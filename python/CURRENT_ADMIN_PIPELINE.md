# Current-Administration Pipeline

Use this only for curated Promise Tracker updates for the current administration.

If you want the simple daily runbook, read `CURRENT_ADMIN_DAILY.md`.

This Python workflow is the canonical current-admin review pipeline.

- use it to generate review artifacts
- use it to generate decision logs and feedback summaries
- treat the Next.js dashboard as a read-only analytics/admin surface on top of these artifacts
- do not treat the dashboard as a second ingestion or AI-review pipeline

Work from:

```bash
cd python
```

Batch files live here:

```bash
data/current_admin_batches/
```

Reports live here:

```bash
reports/current_admin/
```

## Admin Dashboard Role

The admin dashboard is a read-only visibility and guidance surface on top of the Python artifacts in `reports/current_admin/`.

Use it for:

- review visibility
- decision/session visibility
- pre-commit readiness visibility
- copy-paste command guidance

Do not treat it as:

- a second AI-review pipeline
- a second import path
- a replacement for the file-driven Python workflow

## Golden Path

Recommended daily operator flow from `python/`:

```bash
./bin/equitystack current-admin workflow start --input data/current_admin_batches/<batch-file>.json
./bin/equitystack current-admin workflow review --input reports/current_admin/<batch-name>.ai-review.json --output /tmp/<batch-name>.decision-template.json
./bin/equitystack current-admin workflow finalize --review reports/current_admin/<batch-name>.ai-review.json --decision-file /tmp/<batch-name>.decision-template.json --log-decisions
./bin/equitystack current-admin pre-commit --input reports/current_admin/<batch-name>.manual-review-queue.json
./bin/equitystack current-admin import --input reports/current_admin/<batch-name>.manual-review-queue.json
./bin/equitystack current-admin validate --input reports/current_admin/<batch-name>.manual-review-queue.json
```

Required:

- run `workflow start`
- fill explicit `operator_action` values in the decision template
- run `workflow finalize`
- run `pre-commit`
- review the manual-review queue before import
- dry-run import before `--apply --yes`
- validate after apply

Optional:

- add `--deep-review` to `workflow start`
- export a worklist before generating the decision template
- add `--feedback-summary` to `workflow finalize`
- use the dashboard only for read-only visibility, artifact paths, and next-command guidance

## Pre-Commit Means

`./bin/equitystack current-admin pre-commit --input reports/current_admin/<batch-name>.manual-review-queue.json`

This step is read-only. It checks whether the queue, review artifact, and decision log line up cleanly enough for the next import step.

Readiness states:

- `ready`: no blocking issues were found for approved queue items
- `ready_with_warnings`: the batch is still importable, but warnings merit operator review first
- `blocked`: something about the queue, decision coverage, or operator actions must be fixed before import

## Standard Curated Batch Flow

Safest starting point:

```bash
./bin/equitystack current-admin status
./bin/equitystack current-admin workflow start --input data/current_admin_batches/<batch-file>.json
```

`current-admin workflow start` is the guided entrypoint.

It wraps the same safe pre-import steps as `current-admin run`:

- normalize
- AI review
- manual review queue generation

It does not import records and it does not write to the database.

After that, use `current-admin status` to see the likely next step.

Default review model:

- `qwen3.5:latest`

Review modes:

- standard review is the default daily path
- add `--deep-review` when a batch has ambiguous or harder records
- deep review uses the same `qwen3.5:latest` model with stronger ambiguity analysis
- deep review stays advisory only
- deep review does not import, approve, or score anything

Example:

```bash
./bin/equitystack current-admin workflow start \
  --input data/current_admin_batches/<batch-file>.json \
  --deep-review
```

## Canonical Operator Workflow

Required path from curated batch to import-ready queue:

1. Normalize + review + queue
2. Inspect the review output and optionally carve out a focused worklist
3. Generate a decision template from the review artifact or worklist
4. Fill explicit `operator_action` values in that decision file
5. Log operator decisions
6. Run a pre-commit review
7. Approve or edit records in the manual queue
8. Dry-run import
9. Apply import only when ready
10. Validate

Required and optional files in that flow:

- input batch file: `data/current_admin_batches/<batch-file>.json`
- normalized review input: `reports/current_admin/<batch-name>.normalized.json`
- AI review artifact: `reports/current_admin/<batch-name>.ai-review.json`
- optional worklist/session manifest: `/tmp/<name>.json` or another explicit path you choose
- decision template / filled decision file: `/tmp/<name>.decision-template.json` or another explicit path you choose
- append-only decision log: `reports/current_admin/review_decisions/*.json`
- pre-commit import review: `reports/current_admin/<batch-name>.pre-commit-review.json`
- manual review queue: `reports/current_admin/<batch-name>.manual-review-queue.json`

Full step-by-step path:

```bash
./bin/equitystack current-admin workflow start --input data/current_admin_batches/<batch-file>.json
./bin/equitystack current-admin workflow start --input data/current_admin_batches/<batch-file>.json --deep-review
./bin/equitystack current-admin review --input reports/current_admin/<batch-name>.normalized.json --deep-review --sort-by-priority --descending --summary
./bin/equitystack current-admin review --input reports/current_admin/<batch-name>.normalized.json --suggested-batch high_attention --export-worklist /tmp/high_attention.json
./bin/equitystack current-admin workflow review --input reports/current_admin/<batch-name>.ai-review.json --output /tmp/<batch-name>.decision-template.json
./bin/equitystack current-admin workflow review --input /tmp/high_attention.json --output /tmp/high_attention_decisions.json --summary
./bin/equitystack current-admin workflow finalize --review reports/current_admin/<batch-name>.ai-review.json --decision-file /tmp/<batch-name>.decision-template.json --log-decisions
./bin/equitystack current-admin pre-commit --input reports/current_admin/<batch-name>.manual-review-queue.json
node scripts/export_current_admin_feedback_summary.mjs
./bin/equitystack current-admin import --input reports/current_admin/<batch-name>.manual-review-queue.json
./bin/equitystack current-admin import --input reports/current_admin/<batch-name>.manual-review-queue.json --apply --yes
./bin/equitystack current-admin validate --input reports/current_admin/<batch-name>.manual-review-queue.json
```

`<batch-file>` is the JSON file you pass to normalization.

`<batch-name>` is the `batch_name` inside that file and is what later report names use.

Required operator work in the middle:

1. open `reports/current_admin/<batch-name>.manual-review-queue.json`
2. fill explicit `operator_action` values in your decision template file
3. log those decisions before import when you want an auditable session record
4. approve or edit the records you want to import
5. keep unapproved records pending
6. dry-run import before `--apply --yes`

## Troubleshooting

- `workflow finalize` complains about a mismatch: regenerate the decision template from the exact `.ai-review.json` or worklist you are using.
- Pre-commit says `blocked`: open `reports/current_admin/<batch-name>.pre-commit-review.json`, resolve the listed blockers, then rerun pre-commit.
- Pre-commit says there is no decision coverage: rerun `workflow finalize --log-decisions` against the matching review artifact.
- Import dry-run is empty: confirm that the manual review queue still has approved items with `final_record` payloads.

## Optional Discovery Flow

Use discovery only when you need help finding stale records, missing actions, or new candidate promises.

Run discovery:

```bash
./bin/equitystack current-admin discover \
  --president-slug donald-j-trump-2025 \
  --dry-run
```

Main output:

- `reports/current_admin/discovery_report.json`

Export selected suggestions into a draft file:

```bash
./bin/equitystack current-admin export \
  --candidate-id update_candidates:2 \
  --output-name trump_2025_housing_refresh_draft
```

Then manually edit the exported draft under `data/current_admin_batches/` into a real curated batch before normalization.

## What Is Required Vs Optional

Required for a normal curated batch import:

- `./bin/equitystack current-admin workflow start`
- `./bin/equitystack current-admin workflow review`
- explicit `operator_action` values in the generated decision template
- `./bin/equitystack current-admin workflow finalize --log-decisions`
- `./bin/equitystack current-admin pre-commit`
- manual queue review
- `./bin/equitystack current-admin import`
- `./bin/equitystack current-admin validate`

Optional:

- `scripts/discover_current_admin_updates.py`
- `scripts/export_current_admin_discovery_candidates.py`
- raw Python entrypoints under `scripts/` when you need to bypass the wrapper for debugging
- `--csv` outputs on the reporting steps that support it
- `--model <name>` if you need to override the default review model
- `--deep-review` or `--review-mode deep` for harder cases
- `--prefill-suggestions` on `apply_current_admin_ai_review.py`
- `scripts/build_current_admin_precommit_review.py`

## Dry-Run And Apply Rules

- Discovery is read-only
- Normalization is read-only
- AI review is advisory only
- default AI review uses `qwen3.5:latest`
- deep review is optional and advisory only
- `current-admin run` is pre-import only
- Import is dry-run by default
- Database writes require `--apply --yes`
- Validation is read-only

## Main Outputs

For batch `trump-2025-batch-01`, expect:

- `reports/current_admin/trump-2025-batch-01.normalized.json`
- `reports/current_admin/trump-2025-batch-01.normalization-report.json`
- `reports/current_admin/trump-2025-batch-01.ai-review.json`
- `reports/current_admin/trump-2025-batch-01.manual-review-queue.json`
- `reports/current_admin/trump-2025-batch-01.pre-commit-review.json`
- `reports/current_admin/trump-2025-batch-01.import-dry-run.json`
- `reports/current_admin/trump-2025-batch-01.import-apply.json`
- `reports/current_admin/trump-2025-batch-01.import-validation.json`

The AI review report now also includes:

- deep-review recommendation fields
- standard-vs-deep suggestion conflict fields when both passes exist
- structured confidence reasoning and confidence comparison fields
- operator triage fields such as review priority and operator-attention flags

Useful review-display options:

```bash
./bin/equitystack current-admin review --input reports/current_admin/<batch-name>.normalized.json --deep-review --sort-by-priority --descending --summary
./bin/equitystack current-admin review --input reports/current_admin/<batch-name>.normalized.json --priority high,medium --attention-needed --preview
./bin/equitystack current-admin review --input reports/current_admin/<batch-name>.normalized.json --deep-review --summary
```

These flags only change the display view printed by the review command. They do not change import behavior or the saved review data.

The review JSON now also includes suggested review batches such as `high_attention`, `manual_review_focus`, `deep_review_candidates`, `source_check_needed`, and `likely_straightforward`. These are advisory groupings only and do not change queue approval or import behavior.

Suggested batching is for operator planning only:

- use `--summary` to see batch counts
- use `--preview` to see each item's suggested batch and short reason
- queue approval and import rules stay unchanged

Optional worklist and session-manifest exports:

```bash
./bin/equitystack current-admin review --input reports/current_admin/<batch-name>.normalized.json --suggested-batch high_attention --export-worklist /tmp/high_attention.json
./bin/equitystack current-admin review --input reports/current_admin/<batch-name>.normalized.json --priority high --export-worklist /tmp/high_priority.json
./bin/equitystack current-admin review --input reports/current_admin/<batch-name>.normalized.json --session-focus high_attention_first --export-worklist /tmp/high_attention_session.json --summary
```

These exports are advisory only. They do not approve, import, apply, or change queue semantics.

Decision-template and decision-log path:

```bash
./bin/equitystack current-admin workflow review --input reports/current_admin/<batch-name>.ai-review.json --output /tmp/<batch-name>.decision-template.json
./bin/equitystack current-admin workflow review --input /tmp/high_attention.json --output /tmp/high_attention_decisions.json --summary
./bin/equitystack current-admin workflow finalize --review reports/current_admin/<batch-name>.ai-review.json --decision-file /tmp/<batch-name>.decision-template.json --log-decisions
./bin/equitystack current-admin workflow finalize --review reports/current_admin/<batch-name>.ai-review.json --decision-file /tmp/high_attention_decisions.json --log-decisions /tmp/high_attention_decision_log.json --feedback-summary
```

Decision templates and decision logging are optional and append-only:

- `workflow review` exports a JSON template with blank `operator_action` fields
- `workflow finalize` reuses the canonical review artifact settings and writes a decision log
- `--log-decisions` writes a new JSON decision log file
- omitting a path after `--log-decisions` writes under `reports/current_admin/review_decisions/`
- decision logs record what AI suggested, what the operator chose, and whether they aligned
- decision logging does not approve, import, apply, or change queue behavior

Optional analytics and dashboard exports:

```bash
node scripts/export_current_admin_feedback_summary.mjs
```

This writes:

- `reports/current_admin/feedback/ai_feedback_summary.json`

The feedback artifact is read-only and derived from review reports plus decision logs. It summarizes:

- alignment vs mismatch counts
- confidence diagnostics
- mismatch rates for conflict-heavy and deep-review items
- refined review-risk and operator-friction scores for dashboard use

The dashboard-facing API layer reads the same artifacts through:

- `/api/dashboard/review-overview`
- `/api/dashboard/review-decisions`
- `/api/dashboard/review-trends`
- `/api/dashboard/review-workflow`

These endpoints are read-only. They do not trigger review runs, imports, or DB writes. The workflow endpoint is intended for admin visibility and copy-paste handoff, not for replacing the file-driven Python flow.

Dashboard boundary:

- the Python pipeline remains the canonical current-admin engine
- the dashboard reads Python-generated artifacts
- the dashboard does not generate AI reviews or become a second ingestion path

Pre-commit review:

```bash
./bin/equitystack current-admin pre-commit --input reports/current_admin/<batch-name>.manual-review-queue.json
```

This writes:

- `reports/current_admin/<batch-name>.pre-commit-review.json`

Readiness states:

- `ready`: no blocking issues were found for approved queue items
- `ready_with_warnings`: importable, but warnings still merit operator review
- `blocked`: approved items are missing decision coverage or still have non-import-ready operator actions

The pre-commit artifact is read-only. It does not import or apply anything.

## Helper And Debug Scripts

- raw Python entrypoints remain available if you want to bypass the CLI wrapper
- `scripts/discover_current_admin_updates.py`: optional discovery against existing promise records and feed inputs
- `scripts/export_current_admin_discovery_candidates.py`: export selected discovery rows into a draft batch
- `scripts/review_current_admin_batch_with_ollama.py --dry-run`: heuristic-only advisory review
- `scripts/review_current_admin_batch_with_ollama.py --deep-review`: stronger advisory review using the same default model
- `scripts/import_curated_current_admin_batch.py --only-slug <slug>`: narrow import testing

## De-Emphasized In Operator Docs

These are not the normal curated batch path:

- `scripts/ingest_current_administration.py`: staging ingestion helper, not part of the curated batch import flow
- `scripts/current_admin_common.py`: shared helper module, not an operator command
