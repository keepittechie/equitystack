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

Path handling:

- When you run `./bin/equitystack` from `python/`, use paths like `data/...` and `reports/...`.
- The installed `~/bin/equitystack` wrapper also accepts repo-rooted current-admin paths like `python/data/...` and `python/reports/...`.

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
- Senior review and decision steps should use `qwen3.5:9b`.
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
- `../docs/admin-operator-system.md`

## Current-Admin Safe Path

From `python/`:

```bash
./bin/equitystack current-admin run
./bin/equitystack current-admin review
./bin/equitystack current-admin apply
./bin/equitystack current-admin apply --apply --yes
```

From the repo root with `~/bin/equitystack`, both of these are valid:

```bash
equitystack current-admin run --input data/current_admin_batches/<batch-file>.json
equitystack current-admin run --input python/data/current_admin_batches/<batch-file>.json
```

Important:

- `current-admin run` discovers and generates the next batch by default, or starts directly from `--input`.
- `current-admin review` writes or refreshes the canonical decision template and finalizes only when explicit operator decisions are valid.
- `current-admin apply` always reruns pre-commit and import dry-run before any mutating apply.
- database writes only happen with `--apply --yes`.
- `current-admin status` prints the current state machine and next step.
- `/admin`, `/admin/workflows/[sessionId]`, and `/admin/current-admin-review` now expose the same guided current-admin step tracker.
- review artifacts stamp requested model, effective model, backend, fallback status, and fallback reason.
- legacy/manual commands remain available: `discover`, `gen-batch`, `workflow start`, `workflow review`, `workflow finalize`, `pre-commit`, `import`, `validate`, `status`, `workflow resume`.

## Legislative Safe Path

From `python/`:

```bash
./bin/equitystack legislative run
./bin/equitystack legislative review
./bin/equitystack legislative apply
```

Important:

- `legislative run` executes verifier-assisted suggestion/discovery with `qwen3.5:9b`, senior audit review with `qwen3.5:9b`, auto-triages safe bundle actions, then rebuilds the review bundle.
- the daily review path now uses a 240 second Ollama timeout.
- `legislative import` is dry-run unless `--apply --yes` is passed to the underlying script directly.

## Directory Notes

- `bin/equitystack`: main operator entrypoint
- `data/current_admin_batches/`: curated current-admin batches and discovery exports
- `reports/current_admin/`: durable current-admin artifacts
- `reports/`: legislative pipeline artifacts
- `scripts/`: lower-level Python entrypoints
