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
```

That is now the happy path. `current-admin run` carries a batch through:

1. discovery / batch generation when needed
2. normalize
3. AI review
4. AI-first queue split
5. exception stop if manual review remains
6. guarded import dry-run and guarded import apply when safe
7. outcome-evidence collection
8. strict impact evaluate dry-run
9. strict impact promote dry-run and apply for explicit validator-approved rows
10. enrichment preview, dry-run, and strict apply for explicit validator-approved rows
11. unified outcome sync when enrichment apply touched approved outcomes

Manual recovery path:

```bash
./bin/equitystack current-admin review --input reports/current_admin/<batch>.ai-review.json
./bin/equitystack current-admin apply --input reports/current_admin/<batch>.manual-review-queue.json
./bin/equitystack current-admin apply --input reports/current_admin/<batch>.manual-review-queue.json --apply --yes
```

If AI or the operator notes call for a deeper pass:

```bash
./bin/equitystack current-admin deep-review --input reports/current_admin/<batch>.normalized.json
```

If you want more implementation or downstream evidence before impact work:

```bash
./bin/equitystack current-admin outcome-evidence --input reports/current_admin/<batch>.normalized.json
```

## What Each Command Does

`run`

- discovers fresh updates unless `--input` is supplied
- generates the next batch when needed
- normalizes the batch
- runs the standard OpenAI review
- promotes the AI-first queue
- stops only when true exception rows remain or a strict validator blocks the next automated phase
- otherwise continues into the guarded import, outcome-evidence, impact, and enrichment path automatically

Useful flags:

- `--stop-after review`
- `--stop-after apply`
- `--stop-after impact-evaluate`
- `--stop-after impact-promote`
- `--stop-after enrichment`
- `--no-auto-apply`
- `--no-impact-automation`

`review`

- is the exception-only recovery surface
- refreshes the queue and decision template from the latest `.ai-review.json`
- auto-resolves AI-approved and AI-rejected rows first
- auto-resolves already-tracked rows when discovery only shows no material change or a source-refresh update
- asks for operator decisions only on the remaining manual-review rows
- writes the decision log only when those manual decisions are needed
- `needs_more_sources` queues a read-only outcome-evidence refresh for those rows
- `escalate` queues paired deep review for those rows
- `defer` parks the row so it stops surfacing as active manual-review noise
- `approve_with_changes` is only valid when a structured edit payload exists
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
- is part of the default full automation path after the guarded import phase

`impact evaluate`

- is read-only even when `--auto-approve-safe-supplemental` is used
- is the only path that can mark supplemental impact transitions as explicitly validator-approved
- writes `<batch>.impact-evaluate.json`

`impact promote`

- remains dry-run unless `--apply --yes`
- never infers approval on its own for supplemental evidence rows
- reads only the explicit validator approval already written into `<batch>.impact-evaluate.json`

`impact apply-current-admin-outcome-enrichment`

- is dry-run unless `--apply --yes`
- only enriches measurable outcome rows that already passed the strict validator
- never promotes weak-only, legal-context, broad Federal Register, or implementation-only evidence
- writes `<batch>.outcome-enrichment-dry-run.json` or `<batch>.outcome-enrichment-apply.json`

## What Good Output Looks Like

After `run`:

- `<batch>.normalized.json`
- `<batch>.ai-review.json`
- `<batch>.manual-review-queue.json`
- `<batch>.automation-report.json`
- `<batch>.exception-queue.json`

The queue splits into:

- `items`
- `auto_approved_items`
- `auto_rejected_items`

`items` should be the true ambiguous remainder. Existing tracked rows with no material change or source-only refresh context are expected to resolve out of the editable queue before you open the admin review page.

If `run` continues past the queue:

- `<batch>.outcome-evidence.json`
- `<batch>.impact-evaluate.json`
- `<batch>.impact-promote-dry-run.json`
- `<batch>.impact-promote-apply.json` when safe auto-apply is enabled
- `<batch>.outcome-enrichment-preview.json`
- `<batch>.outcome-enrichment-dry-run.json`
- `<batch>.outcome-enrichment-apply.json` when safe auto-apply is enabled
- `<batch>.current-admin-outcome-sync-apply.json` when enrichment apply touched approved outcomes

After `review`:

- `<batch>.decision-template.json`
- `review_decisions/<batch>.decision-log.json` when manual decisions were needed

After `apply` dry-run:

- `<batch>.pre-commit-review.json`
- `<batch>.import-dry-run.json`

After `apply --apply --yes`:

- `<batch>.import-apply.json`
- `<batch>.import-validation.json`

Optional direct impact commands:

```bash
./bin/equitystack impact evaluate \
  --input reports/current_admin/<batch>.normalized.json \
  --outcome-evidence reports/current_admin/<batch>.outcome-evidence.json \
  --auto-approve-safe-supplemental --dry-run

./bin/equitystack impact promote \
  --input reports/current_admin/<batch>.impact-evaluate.json --dry-run

./bin/equitystack impact apply-current-admin-outcome-enrichment \
  --input reports/current_admin/<batch>.normalized.json \
  --outcome-evidence reports/current_admin/<batch>.outcome-evidence.json \
  --impact-evaluation reports/current_admin/<batch>.impact-evaluate.json --dry-run
```

These are part of the full automation path, but they remain separately callable for inspection and recovery.

## Admin Surfaces

Use these as the control plane over the same artifacts:

- `/admin`
- `/admin/current-admin-review`
- `/admin/workflows`
- `/admin/workflows/[sessionId]`

The current-admin review page now shows:

- a pipeline path strip for `run -> exception review if needed -> guarded apply -> outcome evidence -> impact -> enrichment`
- `Run Deep AI Review` for the paired read-only AI pass
- `Save Decisions` and `Sync Decision Log` for the manual-review slice
- only the editable `items` table, not the whole batch

## Safety Notes

- Current-admin AI review uses OpenAI only.
- The default review path is single-pass.
- `current-admin deep-review` is the explicit deeper AI option.
- `current-admin outcome-evidence` is active but read-only.
- strict supplemental impact approval is read-only at evaluation time and guarded at promote time.
- strict enrichment writes are still guarded behind `--apply --yes`.
- `current-admin apply` remains dry-run unless `--apply --yes`.
- `current-admin status` is the fastest way to see the next valid step.

## When Stuck

```bash
./bin/equitystack current-admin status
./bin/equitystack current-admin review --input reports/current_admin/<batch>.ai-review.json
./bin/equitystack current-admin deep-review --input reports/current_admin/<batch>.normalized.json
./bin/equitystack current-admin run --input data/current_admin_batches/<batch-file>.json --stop-after impact-evaluate
```
