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

## Canonical Commands

Normal path:

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

Deeper AI review path:

```bash
./bin/equitystack current-admin deep-review --input reports/current_admin/<batch-name>.normalized.json
```

## Practical Model

Current-admin now follows this operator model:

1. `current-admin run`
   - prepares the batch
   - runs standard AI review
   - promotes the AI-first queue
2. `current-admin review`
   - resolves AI decisions first
   - shows only the remaining manual-review slice
   - writes the canonical decision log only when manual decisions are still needed
3. `current-admin apply`
   - dry-run by default
   - reruns pre-commit and import dry-run
4. `current-admin apply --apply --yes`
   - mutates only after the guarded dry-run path succeeds
   - runs validation after apply

This is review-first and artifact-first. It does not bypass:

- the AI-first queue split
- decision logs
- pre-commit review
- import dry-run
- `--apply --yes`

## Stage Map

`current-admin run` without `--input` runs:

1. `scripts/discover_current_admin_updates.py`
2. `scripts/generate_current_admin_batch_from_discovery.py`
3. `scripts/normalize_current_admin_batch.py`
4. `scripts/review_current_admin_batch_with_openai_batch.py`
5. `scripts/promote_current_admin_review_to_queue.py`

`current-admin run --input ...` skips discovery and batch generation:

1. `scripts/normalize_current_admin_batch.py`
2. `scripts/review_current_admin_batch_with_openai_batch.py`
3. `scripts/promote_current_admin_review_to_queue.py`

`current-admin review`:

1. refreshes the queue split and decision template from `scripts/promote_current_admin_review_to_queue.py`
2. if manual rows remain and the decision file is valid, replays those decisions with `scripts/review_current_admin_batch_with_openai_batch.py --decision-file ... --log-decisions`
3. syncs queue approval state with `scripts/sync_current_admin_queue_decisions.py`

`current-admin deep-review` runs:

1. `scripts/current_admin_paired_evaluation.py --paired-experiment`

Use it when the standard AI review or operator notes say a batch needs deeper review. It is advisory only. It does not import or mutate data.

`current-admin apply` wraps:

1. `scripts/build_current_admin_precommit_review.py`
2. `scripts/import_curated_current_admin_batch.py`
3. `scripts/validate_current_admin_import.py` after mutating apply

## Canonical Artifacts

Main artifacts under `reports/current_admin/`:

- `<batch>.discovery-debug.json`
- `<batch>.normalized.json`
- `<batch>.normalization-report.json`
- `<batch>.ai-review.json`
- `<batch>.manual-review-queue.json`
- `<batch>.decision-template.json`
- `review_decisions/<batch>.decision-log.json`
- `<batch>.pre-commit-review.json`
- `<batch>.import-dry-run.json`
- `<batch>.import-apply.json`
- `<batch>.import-validation.json`

Queue structure:

- `items`: only borderline rows that still need human action
- `auto_approved_items`: AI-cleared import candidates
- `auto_rejected_items`: off-mission or unsupported rows

## Read-Only vs Mutating

- `discover`: read-only
- `gen-batch`: writes batch artifacts only
- `normalize`: writes normalized/report artifacts only
- `ai-review`: advisory only
- `deep-review`: advisory only
- `review`: writes queue/template/log artifacts only
- `pre-commit`: read-only
- `apply`: dry-run unless `--apply --yes`
- `import`: dry-run unless `--apply --yes`
- `validate`: read-only

## State Machine

`./bin/equitystack current-admin status` reports:

- `DISCOVERY_READY`
- `NORMALIZED`
- `REVIEW_READY`
- `QUEUE_READY`
- `PRECOMMIT_READY`
- `IMPORT_READY`
- `COMPLETE`
- `BLOCKED`

It also prints artifact presence, blocking issues, and the recommended next command.

## Admin Mapping

The admin UI is a control surface over the same Python artifacts. It is not a separate workflow.

Key surfaces:

- `/admin`
- `/admin/current-admin-review`
- `/admin/workflows`
- `/admin/workflows/[sessionId]`

Tracker model:

1. discover / batch ready
2. AI review
3. operator review for the manual slice only
4. decision-log sync
5. pre-commit / apply readiness
6. final apply confirmation
7. validation / complete

The review page can legitimately be empty when `auto_approved_items` exist and `items` is empty.

## Safety Notes

- Current-admin review uses OpenAI only.
- The standard review path is single-pass.
- `current-admin deep-review` is the explicit deeper AI option for ambiguous or higher-risk cases.
- DB-backed commands honor runtime overrides such as `DB_HOST=10.10.0.15`.
- Preferred local path: rebuild `python/venv` with `./bin/bootstrap-python-env`.

## When Stuck

```bash
./bin/equitystack current-admin status
./bin/equitystack current-admin review --input reports/current_admin/<batch-name>.ai-review.json
./bin/equitystack current-admin deep-review --input reports/current_admin/<batch-name>.normalized.json
```
