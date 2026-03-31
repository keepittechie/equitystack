# EquityStack Operator Checklist

Work from `python/`.

## Environment Defaults

- Production Ollama: `http://10.10.0.60:11434`
- Senior review / decision model: `qwen3.5:9b`
- Verifier / fallback model: `qwen3.5:9b`
- Executor model: `rnj-1:latest`
- Default Ollama timeout: `240`
- Preferred local Python setup: `cd python && ./bin/bootstrap-python-env`
- Fallback interpreter override: `EQUITYSTACK_PYTHON_BIN=/path/to/python`
- For production-style DB access from local dev, override `DB_HOST=10.10.0.13`

## Daily Legislative Flow

1. `./bin/equitystack legislative run`
2. `./bin/equitystack legislative review`
3. `./bin/equitystack legislative apply`
4. If approved tracked-bill seed rows were created: `./bin/equitystack legislative import`
5. When needed: `./bin/equitystack legislative feedback`

## Daily Current-Admin Flow

Path note:

- From `python/`, use `data/...` and `reports/...` paths with `./bin/equitystack`.
- From the repo root, the installed `equitystack` wrapper also accepts `python/data/...` and `python/reports/...` for current-admin commands.

1. `./bin/equitystack current-admin workflow start --input data/current_admin_batches/<batch-file>.json`
2. `./bin/equitystack current-admin workflow review --input reports/current_admin/<batch-name>.ai-review.json --output /tmp/<batch-name>.decision-template.json`
3. Fill explicit `operator_action` values in the decision template
4. `./bin/equitystack current-admin workflow finalize --review reports/current_admin/<batch-name>.ai-review.json --decision-file /tmp/<batch-name>.decision-template.json --log-decisions`
5. `./bin/equitystack current-admin pre-commit --input reports/current_admin/<batch-name>.manual-review-queue.json`
6. `./bin/equitystack current-admin import --input reports/current_admin/<batch-name>.manual-review-queue.json`
7. Only when ready: `./bin/equitystack current-admin import --input reports/current_admin/<batch-name>.manual-review-queue.json --apply --yes`
8. `./bin/equitystack current-admin validate --input reports/current_admin/<batch-name>.manual-review-queue.json`

## Admin Surface

- `/admin/current-admin-review` is the canonical web approval surface for decision drafting and finalize.
- `/admin/pre-commit` reruns and displays the canonical pre-commit artifact.
- `/admin/import-history` wraps the canonical import and validation commands and enforces the same readiness gates as the CLI.
- `/admin/legislative-workflow` is the legislative approval surface. It saves bundle approvals and wraps legislative apply/import dry-run and apply commands behind readiness checks.
- `/admin/promises/current-administration` is now legacy intake visibility only and must not be used to bypass the artifact workflow.

## Executor Boundary

- `rnj-1` may preprocess, summarize, run approved wrapper commands, and assist with MCP tools.
- `rnj-1` must not approve imports, bypass decision logs, bypass pre-commit, or bypass dry-run/apply checkpoints.
- Operator approval remains the final control point.

## Fast Recovery Commands

- `./bin/equitystack current-admin status`
- `./bin/equitystack current-admin workflow resume`
- `./bin/equitystack legislative review`
## Fresh Walkthrough Reset

Use the operational reset command before a demo or walkthrough when old reports, logs, operator history,
or recommendation feedback are making the admin control surface noisy:

```bash
./bin/equitystack admin-reset-operational-state --dry-run
./bin/equitystack admin-reset-operational-state --apply --yes
```

What it archives:
- admin operator history
- recommendation feedback history
- current-admin report artifacts
- legislative report artifacts
- EquityStack log files

What it does not touch:
- database content
- canonical policy data
- source files

The command archives operational artifacts under `python/reports/admin_resets/<timestamp>/`.
