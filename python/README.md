# EquityStack Python Pipelines

From the repo root:

```bash
cd python
```

This directory contains two separate operator workflows:

- Legislative / future-bills pipeline
- Current-administration Promise Tracker pipeline

Do not treat them as one combined runbook.

Primary SSH interface:

```bash
./bin/equitystack --help
```

For current-administration work, this Python pipeline is the canonical source of:

- discovery
- normalization
- AI review and deep review
- worklists and session manifests
- decision templates
- decision logging
- pre-commit review
- feedback summaries
- import and validation

The Next.js dashboard and admin UI should consume these artifacts. They are not the canonical review-generation pipeline.

## Golden Path

Recommended current-admin workflow from `python/`:

```bash
./bin/equitystack current-admin workflow start --input data/current_admin_batches/<batch-file>.json
./bin/equitystack current-admin workflow review --input reports/current_admin/<batch-name>.ai-review.json --output /tmp/<batch-name>.decision-template.json
./bin/equitystack current-admin workflow finalize --review reports/current_admin/<batch-name>.ai-review.json --decision-file /tmp/<batch-name>.decision-template.json --log-decisions
./bin/equitystack current-admin pre-commit --input reports/current_admin/<batch-name>.manual-review-queue.json
./bin/equitystack current-admin import --input reports/current_admin/<batch-name>.manual-review-queue.json
./bin/equitystack current-admin validate --input reports/current_admin/<batch-name>.manual-review-queue.json
```

Required:

- `workflow start`
- fill explicit `operator_action` values in the generated decision template
- `workflow finalize`
- `pre-commit`
- manual queue review
- dry-run import before `--apply --yes`
- validate after apply

Optional:

- `--deep-review` on `workflow start`
- worklist export from `current-admin review`
- `--feedback-summary` on `workflow finalize`
- dashboard visibility through `/api/dashboard/review-*`

## Operator Daily Use

Most days, the safe current-admin path is:

1. `workflow start`
2. `workflow review`
3. fill explicit `operator_action` values in the decision template
4. `workflow finalize`
5. `pre-commit`
6. dry-run `import`
7. `validate` after apply

Use `current-admin status` or `current-admin workflow resume` whenever you need the next command or artifact path.

## Admin Dashboard Role

The dashboard is useful for:

- review visibility
- decision/session visibility
- pre-commit readiness visibility
- copy-paste workflow guidance

The dashboard does not:

- generate AI reviews
- write decision logs
- import data
- become a second current-admin pipeline

## Pre-Commit Means

`current-admin pre-commit` is a read-only import guardrail.

It checks the manual review queue plus decision-log coverage and classifies the batch as:

- `ready`
- `ready_with_warnings`
- `blocked`

It does not import anything. It tells you whether the queue is lined up cleanly enough for the next manual import step.

## Read This First

- Daily legislative workflow: `LEGISLATIVE_PIPELINE.md`
- Current-administration curated batch workflow: `CURRENT_ADMIN_PIPELINE.md`
- Short checklist: `OPERATIONS.md`

## Most Common Commands

Run this most days:

```bash
./bin/equitystack legislative run
./bin/equitystack legislative review
./bin/equitystack legislative apply
```

Run this only when approved tracked-bill seed rows were created:

```bash
./bin/equitystack legislative import
./bin/equitystack legislative feedback
```

Run this for current-administration updates:

```bash
./bin/equitystack current-admin status
./bin/equitystack current-admin workflow start --input data/current_admin_batches/<batch-file>.json
./bin/equitystack current-admin workflow start --input data/current_admin_batches/<batch-file>.json --deep-review
./bin/equitystack current-admin review --input reports/current_admin/<batch-name>.normalized.json --deep-review --sort-by-priority --descending --summary
./bin/equitystack current-admin review --input reports/current_admin/<batch-name>.normalized.json --priority high,medium --attention-needed --preview
./bin/equitystack current-admin review --input reports/current_admin/<batch-name>.normalized.json --suggested-batch high_attention --export-worklist /tmp/high_attention.json
./bin/equitystack current-admin workflow review --input reports/current_admin/<batch-name>.ai-review.json --output /tmp/<batch-name>.decision-template.json
./bin/equitystack current-admin workflow finalize --review reports/current_admin/<batch-name>.ai-review.json --decision-file /tmp/<batch-name>.decision-template.json --log-decisions
./bin/equitystack current-admin pre-commit --input reports/current_admin/<batch-name>.manual-review-queue.json
./bin/equitystack current-admin import --input reports/current_admin/<batch-name>.manual-review-queue.json
./bin/equitystack current-admin validate --input reports/current_admin/<batch-name>.manual-review-queue.json
```

Current-admin review output now includes:

- deep-review recommendations
- conflict and confidence comparison fields
- triage priority fields
- suggested review batches for operator planning
- optional advisory worklist/session-manifest exports
- optional append-only decision logs that record explicit operator actions separately from AI suggestions

Current-admin analytics helpers:

- dashboard API reads the JSON review and decision artifacts through:
  - `/api/dashboard/review-overview`
  - `/api/dashboard/review-decisions`
  - `/api/dashboard/review-trends`
  - `/api/dashboard/review-workflow`
- export a local feedback summary with:
  - `node scripts/export_current_admin_feedback_summary.mjs`

Workflow helpers:

- `./bin/equitystack current-admin workflow start`: safe normalize -> review -> queue wrapper
- `./bin/equitystack current-admin workflow review`: export a decision template from a canonical review/worklist artifact
- `./bin/equitystack current-admin workflow finalize`: log explicit operator decisions and optionally refresh feedback
- `./bin/equitystack current-admin workflow resume`: show the latest session and likely next step
- `./bin/equitystack current-admin pre-commit`: build a read-only import guardrail artifact before import

Model handling stays unchanged:

- `qwen3.5:latest` remains the default review model
- `--model <name>` still works on the underlying review commands when you need an explicit local override
- deep review still means deeper scrutiny, not a different required model tier

## Troubleshooting

- `Decision file does not match review artifact`: regenerate the template with `workflow review`, then fill decisions again.
- `Pre-commit review is blocked`: inspect `reports/current_admin/<batch-name>.pre-commit-review.json`, resolve the listed blockers, then rerun `current-admin pre-commit`.
- `No queue items are currently approved for import`: update the manual review queue before running import.
- `current-admin status` or `workflow resume` gives the wrong next step for an older batch: pass `--batch-name <batch-name>` explicitly.

## Directory Notes

- `bin/equitystack` is the main operator CLI
- `scripts/` contains the real Python entrypoints
- `reports/` contains generated outputs and review artifacts
- `data/current_admin_batches/` stores curated current-administration batch files

Legacy shortcuts still work for legislative commands:

```bash
./bin/equitystack run
./bin/equitystack review
./bin/equitystack apply
./bin/equitystack import
./bin/equitystack feedback
```

Use the namespaced commands going forward.
