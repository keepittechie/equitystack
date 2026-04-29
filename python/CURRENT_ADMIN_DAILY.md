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

## Daily Path

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

If AI or the operator notes call for a deeper pass:

```bash
./bin/equitystack current-admin deep-review --input reports/current_admin/<batch-name>.normalized.json
```

If you want more implementation or downstream evidence before impact work:

```bash
./bin/equitystack current-admin outcome-evidence --input reports/current_admin/<batch-name>.manual-review-queue.json
```

## What Each Command Does

`run`

- discovers fresh updates unless `--input` is supplied
- generates the next batch when needed
- normalizes the batch
- runs the standard OpenAI review
- promotes the AI-first queue

`review`

- refreshes the queue and decision template from the latest `.ai-review.json`
- auto-resolves AI-approved and AI-rejected rows first
- auto-resolves already-tracked rows when discovery only shows no material change or a source-refresh update
- asks for operator decisions only on the remaining manual-review rows
- writes the decision log only when those manual decisions are needed
- the admin surface labels this step `Sync Decision Log`

`apply`

- reruns pre-commit
- reruns import dry-run
- never mutates by default

`apply --apply --yes`

- reruns the same guarded path
- writes import apply
- writes validation

`deep-review`

- runs the paired deeper AI review path
- is read-only and advisory
- is the correct next step when a row or batch needs more AI scrutiny before operator judgment

`outcome-evidence`

- collects implementation and downstream outcome evidence for existing current-admin rows
- is active, but read-only
- writes `<batch>.outcome-evidence.json` and optional CSV only
- does not change the normal `run -> review -> apply` path

## What Good Output Looks Like

After `run`:

- `<batch>.normalized.json`
- `<batch>.ai-review.json`
- `<batch>.manual-review-queue.json`

The queue splits into:

- `items`
- `auto_approved_items`
- `auto_rejected_items`

`items` should be the true ambiguous remainder. Existing tracked rows with no material change or source-only refresh context are expected to resolve out of the editable queue before you open the admin review page.

After `review`:

- `<batch>.decision-template.json`
- `review_decisions/<batch>.decision-log.json` when manual decisions were needed

After `outcome-evidence`:

- `<batch>.outcome-evidence.json`
- optional `<batch>.outcome-evidence.csv`

After `apply` dry-run:

- `<batch>.pre-commit-review.json`
- `<batch>.import-dry-run.json`

After `apply --apply --yes`:

- `<batch>.import-apply.json`
- `<batch>.import-validation.json`

Optional controlled-rollout impact commands:

```bash
./bin/equitystack impact evaluate \
  --input reports/current_admin/<batch-name>.manual-review-queue.json \
  --outcome-evidence reports/current_admin/<batch-name>.outcome-evidence.json

./bin/equitystack impact preview-current-admin-outcome-enrichment \
  --input reports/current_admin/<batch-name>.manual-review-queue.json \
  --outcome-evidence reports/current_admin/<batch-name>.outcome-evidence.json
```

These are not part of the normal daily apply path. `impact evaluate` remains read-only, and the enrichment preview is report-only.

## Admin Surfaces

Use these as the control plane over the same artifacts:

- `/admin`
- `/admin/current-admin-review`
- `/admin/workflows`
- `/admin/workflows/[sessionId]`

The current-admin review page now shows:

- a pipeline path strip for `run -> manual review -> optional deep review -> apply dry-run -> final apply`
- `Run Deep AI Review` for the paired read-only AI pass
- `Save Decisions` and `Sync Decision Log` for the manual-review slice
- only the editable `items` table, not the whole batch

## Safety Notes

- Current-admin AI review uses OpenAI only.
- The default review path is single-pass.
- `current-admin deep-review` is the explicit deeper AI option.
- `current-admin outcome-evidence` is active but read-only.
- supplemental outcome-evidence recommendations stay dry-run only during this rollout.
- `current-admin apply` is dry-run unless `--apply --yes`.
- `current-admin status` is the fastest way to see the next valid step.

## When Stuck

```bash
./bin/equitystack current-admin status
./bin/equitystack current-admin review --input reports/current_admin/<batch-name>.ai-review.json
./bin/equitystack current-admin deep-review --input reports/current_admin/<batch-name>.normalized.json
```
