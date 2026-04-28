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

Path handling:

- From `python/`, use `data/...` and `reports/...` relative paths with `./bin/equitystack`.
- From the repo root, the installed `equitystack` wrapper also accepts repo-rooted current-admin paths like `python/data/...` and `python/reports/...`.

Artifacts:

- batch files: `data/current_admin_batches/`
- reports: `reports/current_admin/`

## Canonical Operator Commands

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

Advanced/manual commands still remain available:

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

## Guided Admin Workflow Mapping

The admin tracker uses the same canonical state and artifact set. It does not create a parallel
workflow engine.

Admin step mapping:

1. `Discover / Batch Ready`
   - complete when the active batch file is present
2. `Run current-admin`
   - complete when the review artifact exists
3. `Operator Review`
   - current only while borderline manual-queue items still need an operator decision or override
   - can be effectively skipped when the AI-first queue has no manual items
4. `Decision Log Finalized`
   - complete when the decision log and canonical AI-first queue artifact exist
5. `Pre-commit / Apply Readiness`
   - current when pre-commit or dry-run is the next valid checkpoint
   - blocked when the canonical pre-commit report marks readiness as blocked
6. `Admin Approval / Final Apply`
   - current when the dry-run import exists and final apply is waiting on confirmation
7. `Validation / Complete`
   - complete when the validation report exists

Tracker status meaning:

- green dot: complete
- yellow dot: current or next required step
- red dot: blocked
- gray dot: not yet available

## What Each Stage Does

`run` without `--input` runs:

1. `scripts/discover_current_admin_updates.py`
2. `scripts/generate_current_admin_batch_from_discovery.py`
3. `scripts/normalize_current_admin_batch.py`
4. `scripts/review_current_admin_batch_with_openai_batch.py`
5. `scripts/apply_current_admin_ai_review.py`

`run --input ...` and `workflow start` run the pre-import path:

1. `scripts/normalize_current_admin_batch.py`
2. `scripts/review_current_admin_batch_with_openai_batch.py`
3. `scripts/apply_current_admin_ai_review.py`

`scripts/apply_current_admin_ai_review.py` now writes the canonical queue artifact with three scopes:

- `items`: borderline records that still need human review
- `auto_approved_items`: import candidates that passed the AI-first mission and readiness filter
- `auto_rejected_items`: rows rejected as off-mission, unsupported, or not ready for import

`review` wraps:

- `scripts/generate_current_admin_decision_template.py`
- `scripts/review_current_admin_batch_with_openai_batch.py --decision-file ... --log-decisions`

The wrapped `review` step now operates on the manual-review slice instead of forcing operator decisions on every reviewed record.

`workflow review` still runs only:

- `scripts/generate_current_admin_decision_template.py`

`workflow finalize` still replays the canonical review artifact settings and writes a decision log via:

- `scripts/review_current_admin_batch_with_openai_batch.py --decision-file ... --log-decisions`

`apply` wraps:

- `scripts/build_current_admin_precommit_review.py`
- `scripts/import_curated_current_admin_batch.py`
- `scripts/validate_current_admin_import.py`

Optional discovery path:

- `scripts/discover_current_admin_updates.py`
- `scripts/generate_current_admin_batch_from_discovery.py`
- `scripts/export_current_admin_discovery_candidates.py`

## Verified Model Strategy

Wrapper defaults:

- `current-admin discover`: the verifier/default provider model from `./bin/equitystack --help`
- `current-admin ai-review`: OpenAI Batch review via `scripts/review_current_admin_batch_with_openai_batch.py`
- `current-admin workflow start`: verifier, senior, and fallback models from the wrapper defaults
- `current-admin workflow finalize`: reuses the canonical review artifact settings where possible
- default senior/verifier timeout: `240` seconds

LLM provider endpoint:

- `config/llm.json` or `EQUITYSTACK_LLM_ENDPOINT`

The review artifact stores requested model, effective model, backend, fallback status, fallback reason, OpenAI Batch metadata when applicable, and timeout metadata in the generated `.ai-review.json`.

## Required Files In The Main Path

- input batch: `data/current_admin_batches/<batch-file>.json`
- normalized batch: `reports/current_admin/<batch-name>.normalized.json`
- normalization report: `reports/current_admin/<batch-name>.normalization-report.json`
- AI review: `reports/current_admin/<batch-name>.ai-review.json`
- AI-first queue artifact: `reports/current_admin/<batch-name>.manual-review-queue.json`
  - `items` contains only manual-review rows
  - `auto_approved_items` contains import candidates
  - `auto_rejected_items` contains rows filtered out before import
- decision template: `reports/current_admin/<batch-name>.decision-template.json`
- decision log: `reports/current_admin/review_decisions/<batch-name>.<timestamp>.decision-log.json`
- pre-commit review: `reports/current_admin/<batch-name>.pre-commit-review.json`
- import dry run: `reports/current_admin/<batch-name>.import-dry-run.json`
- import apply: `reports/current_admin/<batch-name>.import-apply.json`
- import validation: `reports/current_admin/<batch-name>.import-validation.json`

## Read-Only Vs Mutating

- discovery: read-only
- gen-batch: writes a canonical workflow batch file only
- export: writes a draft batch file only
- normalize: read-only
- AI review: advisory only
- queue: writes the AI-first queue artifact only
- review: writes a decision template and, when valid manual-review decisions or overrides exist, a decision log only
- workflow review: writes a decision template only
- workflow finalize: writes a decision log only
- apply: dry-run unless `--apply --yes`; validation runs only after a mutating apply
- pre-commit: read-only
- import: dry-run unless `--apply --yes`
- validate: read-only

## Environment Notes

- DB-backed commands require a working Python environment with `pymysql`.
- Preferred local-dev path: rebuild `python/venv` with `./bin/bootstrap-python-env`.
- `EQUITYSTACK_PYTHON_BIN=/path/to/python` remains the fallback override.
- Current-admin DB helpers already honor runtime env overrides such as `DB_HOST=10.10.0.15`.
- Local `.env.local` may still point to `localhost`; production-style verification should override `DB_HOST`.

Example production-style local run:

```bash
EQUITYSTACK_PYTHON_BIN=/path/to/python \
DB_HOST=10.10.0.15 \
./bin/equitystack current-admin import --input reports/current_admin/<batch-name>.manual-review-queue.json
```

## Dashboard Boundary

The Python workflow is canonical.

The admin dashboard should be treated as:

- visibility
- artifact browsing
- session / decision inspection
- wrapped control surface for:
  - saving decision drafts
  - running `current-admin review` over the canonical decision file and decision log path
  - rerunning `current-admin apply` for pre-commit and dry-run
  - running mutating apply only after the existing dry-run plus confirmation guardrails
  - running validation

It is not a second ingestion or AI-review pipeline, and it must not bypass:

- AI-first queue classification
- required operator decisions for borderline or override cases
- decision logs
- pre-commit review
- dry-run import
- `--apply --yes`

## Executor Boundary

- `MCP_MODEL` configures the executor model for preprocessing, summaries, MCP tool work, and approved wrapper-command execution.
- The configured MCP executor model does not approve imports.
- The configured MCP executor model does not bypass decision logs, pre-commit, dry-run import, or `--apply --yes`.
