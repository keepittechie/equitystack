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

Canonical automation path:

```bash
./bin/equitystack current-admin run
./bin/equitystack current-admin run --stop-after review
./bin/equitystack current-admin run --stop-after apply
./bin/equitystack current-admin run --stop-after impact-evaluate
./bin/equitystack current-admin run --stop-after impact-promote
./bin/equitystack current-admin run --stop-after enrichment
```

Manual recovery path:

```bash
./bin/equitystack current-admin review --input reports/current_admin/<batch>.ai-review.json
./bin/equitystack current-admin apply --input reports/current_admin/<batch>.manual-review-queue.json
./bin/equitystack current-admin apply --input reports/current_admin/<batch>.manual-review-queue.json --apply --yes
```

Deeper AI review path:

```bash
./bin/equitystack current-admin deep-review --input reports/current_admin/<batch>.normalized.json
```

Direct evidence and impact path:

```bash
./bin/equitystack current-admin outcome-evidence --input reports/current_admin/<batch>.normalized.json
./bin/equitystack impact evaluate --input reports/current_admin/<batch>.normalized.json --outcome-evidence reports/current_admin/<batch>.outcome-evidence.json --auto-approve-safe-supplemental --dry-run
./bin/equitystack impact promote --input reports/current_admin/<batch>.impact-evaluate.json --dry-run
./bin/equitystack impact apply-current-admin-outcome-enrichment --input reports/current_admin/<batch>.normalized.json --outcome-evidence reports/current_admin/<batch>.outcome-evidence.json --impact-evaluation reports/current_admin/<batch>.impact-evaluate.json --dry-run
```

## Practical Model

Current-admin now follows an exceptions-only automation model:

1. `current-admin run`
   - discovers fresh updates unless `--input` is supplied
   - generates the next batch when needed
   - normalizes the batch
   - runs the standard OpenAI review
   - promotes the AI-first queue
   - stops immediately if exception-only manual review remains
   - otherwise runs the guarded import path
   - then runs outcome-evidence, strict impact evaluation, strict impact promotion, enrichment preview, enrichment dry-run, strict enrichment apply, and unified outcome sync
   - writes batch-scoped automation artifacts and an exception queue when anything remains blocked outside the safe automated path
2. `current-admin review`
   - is the exception-only recovery surface
   - refreshes the AI-first queue and decision template
   - shows only the remaining borderline manual-review slice
   - writes the canonical decision log only when manual decisions are still needed
3. `current-admin apply`
   - remains the direct guarded import surface
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
- strict supplemental validation
- strict enrichment validation

## Stage Map

`current-admin run` without `--input` runs:

1. `scripts/discover_current_admin_updates.py`
2. `scripts/generate_current_admin_batch_from_discovery.py`
3. `scripts/normalize_current_admin_batch.py`
4. `scripts/review_current_admin_batch_with_openai_batch.py`
5. `scripts/promote_current_admin_review_to_queue.py`
6. `scripts/build_current_admin_precommit_review.py` and `scripts/import_curated_current_admin_batch.py` when no manual-review exceptions remain
7. `scripts/discover_current_admin_outcome_evidence.py`
8. `scripts/evaluate_impact_maturation.py evaluate --auto-approve-safe-supplemental --dry-run`
9. `scripts/evaluate_impact_maturation.py promote --dry-run`, then `--apply --yes` only for explicit validator-approved rows
10. `scripts/preview_current_admin_policy_outcome_enrichment.py`
11. `scripts/apply_current_admin_outcome_enrichment.py --dry-run`, then `--apply --yes` only for explicit validator-approved rows
12. `scripts/sync_current_admin_policy_outcomes.py --apply --yes` only after enrichment apply touches approved outcome rows

`current-admin run --input ...` skips discovery and batch generation:

1. `scripts/normalize_current_admin_batch.py`
2. `scripts/review_current_admin_batch_with_openai_batch.py`
3. `scripts/promote_current_admin_review_to_queue.py`
4. the same guarded import / impact / enrichment path when no manual-review exceptions remain

`current-admin review`:

1. refreshes the queue split and decision template from `scripts/promote_current_admin_review_to_queue.py`
2. if manual rows remain and the decision file is valid, replays those decisions with `scripts/review_current_admin_batch_with_openai_batch.py --decision-file ... --log-decisions`
3. syncs queue approval state with `scripts/sync_current_admin_queue_decisions.py`
4. if any row is marked `needs_more_sources`, runs a read-only `current-admin outcome-evidence` refresh for those rows
5. if any row is marked `escalate`, runs a paired deep-review follow-up for those rows

Manual-review operator actions are now operational, not just labels:

- `approve_as_is`: marks the row import-ready
- `approve_with_changes`: only valid when the decision item carries a real `structured_edit_payload`
- `manual_review_required`: keeps the row in the active manual-review slice
- `needs_more_sources`: removes the row from the active slice and queues a read-only evidence refresh
- `escalate`: removes the row from the active slice and queues paired deep review
- `defer`: parks the row outside the active slice without approving it for import
- `reject`: resolves the row out of the active slice without approving it for import

`current-admin deep-review` runs:

1. `scripts/current_admin_paired_evaluation.py --paired-experiment`

Use it when the standard AI review or operator notes say a batch needs deeper review. It is advisory only. It does not import or mutate data.

`current-admin outcome-evidence` runs:

1. `scripts/discover_current_admin_outcome_evidence.py`

Use it to collect implementation and downstream outcome evidence for already-tracked current-admin rows. This stage is active, read-only, and is part of the default full `current-admin run` path after the guarded import phase.

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
- `<batch>.outcome-evidence.json`
- `<batch>.impact-evaluate.json`
- `<batch>.impact-promote-dry-run.json`
- `<batch>.impact-promote-apply.json`
- `<batch>.outcome-enrichment-preview.json`
- `<batch>.outcome-enrichment-dry-run.json`
- `<batch>.outcome-enrichment-apply.json`
- `<batch>.current-admin-outcome-sync-apply.json`
- `<batch>.automation-report.json`
- `<batch>.exception-queue.json`
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

The queue promotion step is intentionally conservative but now short-circuits two common no-op cases:

- existing tracked records with no material change
- existing tracked records with source-only refresh context and no preserved action stub

Those rows should be auto-resolved before they show up in `/admin/current-admin-review`. Deep review is for the smaller ambiguous remainder, not for stale or source-refresh maintenance rows.

## Controlled Rollout Activation

Active now:

- Phase 1 implementation / execution evidence in discovery and batch context
- Phase 2 `current-admin outcome-evidence` collection
- Phase 3 strict supplemental auto-approval for `impact_pending -> impact_review_ready`, but only through explicit validator-approved rows
- Phase 4 strict current-admin outcome enrichment through the canonical `impact apply-current-admin-outcome-enrichment` command

Built but intentionally constrained:

- Phase 5 judicial impact is scaffold-only through `impact judicial-run`, `impact judicial-review`, and `impact judicial-apply`
- Phase 6 UI behavior is unchanged; any future rendering of these fields must stay read-only unless separately activated

These controlled-rollout stages do not change current-admin scoring formulas, Black Impact Score logic, or existing admin layout.

## Read-Only vs Mutating

- `discover`: read-only
- `gen-batch`: writes batch artifacts only
- `normalize`: writes normalized/report artifacts only
- `ai-review`: advisory only
- `deep-review`: advisory only
- `outcome-evidence`: read-only artifact generation only
- `impact evaluate`: read-only artifact generation only
- `impact promote`: dry-run unless `--apply --yes`
- `apply-current-admin-outcome-enrichment`: dry-run unless `--apply --yes`
- `review`: writes queue/template/log artifacts only
- `pre-commit`: read-only
- `apply`: dry-run unless `--apply --yes`
- `import`: dry-run unless `--apply --yes`
- `validate`: read-only

## State Model

`./bin/equitystack current-admin status` still reports the canonical current-admin progression and the next safe step. For fully automated batches, the automation and exception artifacts provide the clearest phase-level detail:

- `<batch>.automation-report.json`
- `<batch>.exception-queue.json`

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
3. exception-only manual review when needed
4. guarded pre-commit / import readiness
5. guarded import apply
6. outcome-evidence / impact evaluate / impact promote
7. outcome enrichment / unified outcome sync / complete

The review page can legitimately be empty when `auto_approved_items` exist and `items` is empty.

## Safety Notes

- Current-admin review uses OpenAI only.
- The standard review path is single-pass.
- `current-admin deep-review` is the explicit deeper AI option for ambiguous or higher-risk cases.
- `current-admin outcome-evidence` never writes DB rows or `policy_outcomes`.
- `impact evaluate --auto-approve-safe-supplemental --dry-run` is read-only and is the only place supplemental evidence can become explicitly validator-approved.
- `impact promote --apply --yes` never infers approval on its own. Supplemental transitions must already be marked `approved=true` by the strict validator.
- `impact apply-current-admin-outcome-enrichment --apply --yes` only writes source links and measurable outcome enrichment for validator-approved rows. It never promotes implementation-only, weak-only, legal-context, or broad Federal Register evidence.
- DB-backed commands honor runtime overrides such as `DB_HOST=10.10.0.15`.
- Preferred local path: rebuild `python/venv` with `./bin/bootstrap-python-env`.

## When Stuck

```bash
./bin/equitystack current-admin status
./bin/equitystack current-admin review --input reports/current_admin/<batch>.ai-review.json
./bin/equitystack current-admin deep-review --input reports/current_admin/<batch>.normalized.json
./bin/equitystack impact evaluate --input reports/current_admin/<batch>.normalized.json --outcome-evidence reports/current_admin/<batch>.outcome-evidence.json --auto-approve-safe-supplemental --dry-run
```
