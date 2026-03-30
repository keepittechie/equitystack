# Current-Admin Daily Guide

Use this for normal operator work on curated current-admin batches.

Work from:

```bash
cd python
```

If local Python is not set up yet:

```bash
./bin/bootstrap-python-env
```

## Shortest Safe Path

```bash
./bin/equitystack current-admin workflow start --input data/current_admin_batches/<batch-file>.json
./bin/equitystack current-admin workflow review --input reports/current_admin/<batch-name>.ai-review.json --output /tmp/<batch-name>.decision-template.json
./bin/equitystack current-admin workflow finalize --review reports/current_admin/<batch-name>.ai-review.json --decision-file /tmp/<batch-name>.decision-template.json --log-decisions
./bin/equitystack current-admin pre-commit --input reports/current_admin/<batch-name>.manual-review-queue.json
./bin/equitystack current-admin import --input reports/current_admin/<batch-name>.manual-review-queue.json
./bin/equitystack current-admin import --input reports/current_admin/<batch-name>.manual-review-queue.json --apply --yes
./bin/equitystack current-admin validate --input reports/current_admin/<batch-name>.manual-review-queue.json
```

Replace:

- `<batch-file>` with the JSON file under `data/current_admin_batches/`
- `<batch-name>` with the `batch_name` inside that file

## What Happens

After `workflow start`:

- writes `.normalized.json`
- writes `.ai-review.json`
- writes `.manual-review-queue.json`

After `workflow review`:

- writes a decision template, usually under `/tmp/`

After `workflow finalize`:

- writes a decision log under `reports/current_admin/review_decisions/*.decision-log.json`

After `pre-commit`:

- writes `.pre-commit-review.json`
- reports `ready`, `ready_with_warnings`, or `blocked`

After `import`:

- dry-run first
- apply only with `--apply --yes`

After `validate`:

- writes `.import-validation.json`

## Daily Safety Notes

- Verifier review defaults to `qwen3.5:9b`.
- Senior review and decision stages default to `qwen3.5:27b`.
- Senior-review fallback defaults to `qwen3.5:9b`.
- Ollama review timeout defaults to `240` seconds.
- Production Ollama is remote: `http://10.10.0.60:11434`.
- `current-admin status` is the fastest way to see the current state and next command.
- `pre-commit` is read-only.
- `import` is dry-run by default.
- Review artifacts clearly stamp requested model, effective model, backend, and fallback status.
- DB-backed commands honor runtime overrides such as `DB_HOST=10.10.0.13`.
- Preferred local path: rebuild `python/venv` with `./bin/bootstrap-python-env`.
- Fallback override: `EQUITYSTACK_PYTHON_BIN=/path/to/python`.

## When You Are Stuck

```bash
./bin/equitystack current-admin status
./bin/equitystack current-admin workflow resume
```
