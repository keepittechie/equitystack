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

Path handling:

- From `python/`, use `data/...` and `reports/...` with `./bin/equitystack`.
- From the repo root, the installed `equitystack` wrapper also accepts `python/data/...` and `python/reports/...` for current-admin commands.

## Primary Operator Flow

```bash
./bin/equitystack current-admin run
./bin/equitystack current-admin review
./bin/equitystack current-admin apply
./bin/equitystack current-admin apply --apply --yes
```

Manual batch path:

```bash
./bin/equitystack current-admin run --input data/current_admin_batches/<batch-file>.json
./bin/equitystack current-admin review --input reports/current_admin/<batch-name>.ai-review.json
./bin/equitystack current-admin apply --input reports/current_admin/<batch-name>.manual-review-queue.json
./bin/equitystack current-admin apply --input reports/current_admin/<batch-name>.manual-review-queue.json --apply --yes
```

Replace:

- `<batch-file>` with the JSON file under `data/current_admin_batches/`
- `<batch-name>` with the `batch_name` inside that file

## What Happens

After `run`:

- if no `--input` is supplied:
  - runs discovery
  - generates a canonical current-admin batch from discovery candidates
- always runs:
  - normalize
  - AI review
  - manual queue generation

- writes `.normalized.json`
- writes `.ai-review.json`
- writes `.manual-review-queue.json`

After `review`:

- writes or refreshes `reports/current_admin/<batch-name>.decision-template.json`
- finalizes only when that decision file contains valid explicit operator actions
- writes a decision log under `reports/current_admin/review_decisions/*.decision-log.json`

After `apply` without `--apply --yes`:

- writes `.pre-commit-review.json`
- writes `.import-dry-run.json`
- stops if pre-commit is `blocked`
- never mutates the database

After `apply --apply --yes`:

- reruns pre-commit
- reruns import dry-run
- writes `.import-apply.json`
- writes `.import-validation.json`

## Guided Admin Workflow

The admin UI now exposes the same current-admin flow as a guided tracker.

You can use it on:

- `/admin`
- `/admin/workflows`
- `/admin/workflows/[sessionId]`
- `/admin/current-admin-review`

Tracked steps:

1. `Discover / Batch Ready`
2. `Run current-admin`
3. `Operator Review`
4. `Decision Log Finalized`
5. `Pre-commit / Apply Readiness`
6. `Admin Approval / Final Apply`
7. `Validation / Complete`

Status meaning:

- green dot: complete
- yellow dot: current or next required step
- red dot: blocked
- gray dot: not yet available

Use the tracker to answer:

- what is already done
- what is waiting now
- why the next step is required
- where to click next

If a step is blocked, use the tracker link to inspect the blocker on the session page instead of
guessing from the queue or artifact tables.

## Advanced / Manual Commands

These still work and remain the canonical lower-level path:

```bash
./bin/equitystack current-admin discover
./bin/equitystack current-admin gen-batch --all-candidates
./bin/equitystack current-admin workflow start --input data/current_admin_batches/<batch-file>.json
./bin/equitystack current-admin workflow review --input reports/current_admin/<batch-name>.ai-review.json --output reports/current_admin/<batch-name>.decision-template.json
./bin/equitystack current-admin workflow finalize --review reports/current_admin/<batch-name>.ai-review.json --decision-file reports/current_admin/<batch-name>.decision-template.json --log-decisions
./bin/equitystack current-admin pre-commit --input reports/current_admin/<batch-name>.manual-review-queue.json
./bin/equitystack current-admin import --input reports/current_admin/<batch-name>.manual-review-queue.json
./bin/equitystack current-admin import --input reports/current_admin/<batch-name>.manual-review-queue.json --apply --yes
./bin/equitystack current-admin validate --input reports/current_admin/<batch-name>.manual-review-queue.json
```

## Daily Safety Notes

- Verifier, senior, and fallback review models default to the wrapper defaults shown by `./bin/equitystack --help`.
- Current-admin AI review uses the OpenAI Batch wrapper, `scripts/review_current_admin_batch_with_openai_batch.py`, unless a paired-evaluation mode is explicitly requested.
- LLM review timeout defaults to `240` seconds.
- LLM execution uses the configured provider endpoint from `config/llm.json` or `EQUITYSTACK_LLM_ENDPOINT`.
- `current-admin status` is the fastest way to see the current state and next command.
- `pre-commit` is read-only.
- `import` is dry-run by default.
- Review artifacts clearly stamp requested model, effective model, backend, and fallback status.
- DB-backed commands honor runtime overrides such as `DB_HOST=10.10.0.15`.
- Preferred local path: rebuild `python/venv` with `./bin/bootstrap-python-env`.
- Fallback override: `EQUITYSTACK_PYTHON_BIN=/path/to/python`.
- `current-admin run`, `current-admin review`, and `current-admin apply` are thin wrappers over the same canonical artifacts and safety checkpoints.

## When You Are Stuck

```bash
./bin/equitystack current-admin status
./bin/equitystack current-admin workflow resume
```
