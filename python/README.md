# EquityStack Python Workflows

Start here if you are running the Python side of EquityStack.

From the repo root:

```bash
cd python
```

Main CLI:

```bash
./bin/equitystack --help
```

There are two separate workflows here:

- Legislative / future-bills
- Current-administration Promise Tracker

Do not mix them together.

## Read This First

If you are doing daily current-admin work, read this first:

- `CURRENT_ADMIN_DAILY.md`

If you need the full system explanation, read:

- `CURRENT_ADMIN_PIPELINE.md`

If you are doing the legislative workflow, read:

- `LEGISLATIVE_PIPELINE.md`

If you want a very short checklist, read:

- `OPERATIONS.md`

## Current-Admin Shortest Safe Path

From `python/`:

```bash
./bin/equitystack current-admin workflow start --input data/current_admin_batches/<batch-file>.json
./bin/equitystack current-admin workflow review --input reports/current_admin/<batch-name>.ai-review.json --output /tmp/<batch-name>.decision-template.json
./bin/equitystack current-admin workflow finalize --review reports/current_admin/<batch-name>.ai-review.json --decision-file /tmp/<batch-name>.decision-template.json --log-decisions
./bin/equitystack current-admin pre-commit --input reports/current_admin/<batch-name>.manual-review-queue.json
./bin/equitystack current-admin import --input reports/current_admin/<batch-name>.manual-review-queue.json
./bin/equitystack current-admin validate --input reports/current_admin/<batch-name>.manual-review-queue.json
```

Important:

- the Python pipeline is the canonical current-admin workflow
- the dashboard is for visibility and guidance only
- pre-commit is read-only
- import is dry-run by default
- database writes only happen with explicit apply confirmation

## Legislative Shortest Safe Path

From `python/`:

```bash
./bin/equitystack legislative run
./bin/equitystack legislative review
./bin/equitystack legislative apply
```

## Most Common Commands

Current-admin:

```bash
./bin/equitystack current-admin status
./bin/equitystack current-admin workflow start --input data/current_admin_batches/<batch-file>.json
./bin/equitystack current-admin workflow review --input reports/current_admin/<batch-name>.ai-review.json --output /tmp/<batch-name>.decision-template.json
./bin/equitystack current-admin workflow finalize --review reports/current_admin/<batch-name>.ai-review.json --decision-file /tmp/<batch-name>.decision-template.json --log-decisions
./bin/equitystack current-admin pre-commit --input reports/current_admin/<batch-name>.manual-review-queue.json
./bin/equitystack current-admin workflow resume
```

Legislative:

```bash
./bin/equitystack legislative run
./bin/equitystack legislative review
./bin/equitystack legislative apply
./bin/equitystack legislative import
./bin/equitystack legislative feedback
```

## Directory Notes

- `bin/equitystack` is the main operator entrypoint
- `data/current_admin_batches/` stores curated current-admin batch files
- `reports/current_admin/` stores current-admin review artifacts
- `scripts/` stores the lower-level Python entrypoints

## Dashboard Role

The dashboard is useful for:

- review visibility
- pre-commit readiness visibility
- decision/session visibility
- next-command guidance

The dashboard is not for:

- generating AI reviews
- importing records
- replacing the Python workflow
