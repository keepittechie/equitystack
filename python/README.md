# EquityStack Python Workflows

This directory contains the operator-facing Python workflows for EquityStack.

Work from:

```bash
cd python
```

Main CLI:

```bash
./bin/equitystack --help
```

## Local Python Bootstrap

Recommended local setup from the repo root:

```bash
cd python
./bin/bootstrap-python-env
```

That script:

- rebuilds `python/venv` in place with a local path
- upgrades `pip`
- installs `requirements-local.txt`

Manual equivalent:

```bash
cd python
python3 -m venv --clear venv
./venv/bin/python -m pip install --upgrade pip
./venv/bin/python -m pip install -r requirements-local.txt
```

## Verified Environment Rules

- The CLI is self-locating. It resolves the Python workspace from `python/bin/equitystack`.
- Production Ollama is remote: `http://10.10.0.60:11434`.
- Senior review and decision steps should use `qwen3.5:27b`.
- Verifier, draft, and fallback review steps should use `qwen3.5:9b`.
- Scheduled Ollama review stages now default to a 240 second timeout.
- `rnj-1:latest` is the executor model for preprocessing, summaries, and approved command execution.
- DB-backed scripts read `.env.local`, but legislative helpers now also honor runtime env overrides such as `DB_HOST=10.10.0.13`.
- `python/venv` is the preferred local-dev interpreter after bootstrap.
- If local `python/venv` is unavailable, you can point the wrapper at another interpreter with `EQUITYSTACK_PYTHON_BIN=/path/to/python`.

Example production-style local verification:

```bash
EQUITYSTACK_PYTHON_BIN=/path/to/python \
DB_HOST=10.10.0.13 \
./bin/equitystack current-admin status
```

## Workflows

- Legislative / future bills
- Current-administration Promise Tracker

Read these next:

- `CURRENT_ADMIN_DAILY.md`
- `CURRENT_ADMIN_PIPELINE.md`
- `LEGISLATIVE_PIPELINE.md`
- `OPERATIONS.md`
- `RNJ1_EXECUTOR_GUARDRAILS.md`

## Current-Admin Safe Path

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

- `workflow start` runs verifier-assisted review with `qwen3.5:9b`, senior review with `qwen3.5:27b`, then queue generation.
- `workflow review` only generates a decision template.
- `workflow finalize` writes a decision log under `reports/current_admin/review_decisions/*.decision-log.json`.
- `pre-commit` is read-only.
- `import` is dry-run by default.
- database writes only happen with `--apply --yes`.
- `current-admin status` prints the current state machine and next step.
- review artifacts stamp requested model, effective model, backend, fallback status, and fallback reason.

## Legislative Safe Path

From `python/`:

```bash
./bin/equitystack legislative run
./bin/equitystack legislative review
./bin/equitystack legislative apply
```

Important:

- `legislative run` executes verifier-assisted suggestion/discovery with `qwen3.5:9b`, senior audit review with `qwen3.5:27b`, auto-triages safe bundle actions, then rebuilds the review bundle.
- the daily review path now uses a 240 second Ollama timeout.
- `legislative import` is dry-run unless `--apply --yes` is passed to the underlying script directly.

## Directory Notes

- `bin/equitystack`: main operator entrypoint
- `data/current_admin_batches/`: curated current-admin batches and discovery exports
- `reports/current_admin/`: durable current-admin artifacts
- `reports/`: legislative pipeline artifacts
- `scripts/`: lower-level Python entrypoints
