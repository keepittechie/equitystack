# Current-Administration Pipeline

Use this for curated Promise Tracker updates for the current administration.

Work from:

```bash
cd python
```

Bootstrap local Python first if needed:

```bash
./bin/bootstrap-python-env
```

Artifacts:

- batch files: `data/current_admin_batches/`
- reports: `reports/current_admin/`

## Canonical Operator Commands

```bash
./bin/equitystack current-admin status
./bin/equitystack current-admin workflow start --input data/current_admin_batches/<batch-file>.json
./bin/equitystack current-admin workflow review --input reports/current_admin/<batch-name>.ai-review.json --output /tmp/<batch-name>.decision-template.json
./bin/equitystack current-admin workflow finalize --review reports/current_admin/<batch-name>.ai-review.json --decision-file /tmp/<batch-name>.decision-template.json --log-decisions
./bin/equitystack current-admin pre-commit --input reports/current_admin/<batch-name>.manual-review-queue.json
./bin/equitystack current-admin import --input reports/current_admin/<batch-name>.manual-review-queue.json
./bin/equitystack current-admin import --input reports/current_admin/<batch-name>.manual-review-queue.json --apply --yes
./bin/equitystack current-admin validate --input reports/current_admin/<batch-name>.manual-review-queue.json
```

`current-admin run` is an alias for `current-admin workflow start`.

## State Machine

`./bin/equitystack current-admin status` reports one of:

- `DISCOVERY_READY`
- `NORMALIZED`
- `REVIEW_READY`
- `QUEUE_READY`
- `PRECOMMIT_READY`
- `IMPORT_READY`
- `COMPLETE`
- `BLOCKED`

The command also prints artifact presence, blocking issues, and the recommended next command.

## What Each Stage Does

`workflow start` runs the pre-import path:

1. `scripts/normalize_current_admin_batch.py`
2. `scripts/review_current_admin_batch_with_ollama.py`
3. `scripts/apply_current_admin_ai_review.py`

`workflow review` runs:

- `scripts/generate_current_admin_decision_template.py`

`workflow finalize` replays the canonical review artifact settings and writes a decision log via:

- `scripts/review_current_admin_batch_with_ollama.py --decision-file ... --log-decisions`

`pre-commit` runs:

- `scripts/build_current_admin_precommit_review.py`

`import` runs:

- `scripts/import_curated_current_admin_batch.py`

`validate` runs:

- `scripts/validate_current_admin_import.py`

Optional discovery path:

- `scripts/discover_current_admin_updates.py`
- `scripts/export_current_admin_discovery_candidates.py`

## Verified Model Strategy

Wrapper defaults:

- `current-admin discover`: `qwen3.5:9b`
- `current-admin review`: `qwen3.5:27b`
- `current-admin workflow start`: `qwen3.5:27b`
- `current-admin workflow finalize`: `qwen3.5:27b`

Remote Ollama:

- `http://10.10.0.60:11434`

The review script also stores the effective model in the generated `.ai-review.json`.

## Required Files In The Main Path

- input batch: `data/current_admin_batches/<batch-file>.json`
- normalized batch: `reports/current_admin/<batch-name>.normalized.json`
- normalization report: `reports/current_admin/<batch-name>.normalization-report.json`
- AI review: `reports/current_admin/<batch-name>.ai-review.json`
- manual review queue: `reports/current_admin/<batch-name>.manual-review-queue.json`
- decision template: usually `/tmp/<batch-name>.decision-template.json`
- decision log: `reports/current_admin/review_decisions/<batch-name>.<timestamp>.decision-log.json`
- pre-commit review: `reports/current_admin/<batch-name>.pre-commit-review.json`
- import dry run: `reports/current_admin/<batch-name>.import-dry-run.json`
- import apply: `reports/current_admin/<batch-name>.import-apply.json`
- import validation: `reports/current_admin/<batch-name>.import-validation.json`

## Read-Only Vs Mutating

- discovery: read-only
- export: writes a draft batch file only
- normalize: read-only
- AI review: advisory only
- queue: writes queue artifacts only
- workflow review: writes a decision template only
- workflow finalize: writes a decision log only
- pre-commit: read-only
- import: dry-run unless `--apply --yes`
- validate: read-only

## Environment Notes

- DB-backed commands require a working Python environment with `pymysql`.
- Preferred local-dev path: rebuild `python/venv` with `./bin/bootstrap-python-env`.
- `EQUITYSTACK_PYTHON_BIN=/path/to/python` remains the fallback override.
- Current-admin DB helpers already honor runtime env overrides such as `DB_HOST=10.10.0.13`.
- Local `.env.local` may still point to `localhost`; production-style verification should override `DB_HOST`.

Example production-style local run:

```bash
EQUITYSTACK_PYTHON_BIN=/path/to/python \
DB_HOST=10.10.0.13 \
./bin/equitystack current-admin import --input reports/current_admin/<batch-name>.manual-review-queue.json
```

## Dashboard Boundary

The Python workflow is canonical.

The dashboard is read-only and should be treated as:

- visibility
- artifact browsing
- session / decision inspection
- next-command guidance

It is not a second ingestion or AI-review pipeline.
