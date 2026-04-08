# Promise Tracker Current-Administration Workflow

## Summary

Current-administration monitoring is handled through the canonical Python artifact workflow, not
through legacy app-side staging pages.

The supported operator entrypoints are:

- `/admin`
- `/admin/current-admin-review`
- `/admin/workflows`
- `/admin/workflows/[sessionId]`
- `/admin/review-queue`
- `/admin/artifacts`

The wrapped CLI remains canonical:

- `current-admin run`
- `current-admin review`
- `current-admin apply`
- `current-admin status`

## Canonical Boundary

The current-admin workflow must not bypass:

- explicit operator decisions
- decision logs
- pre-commit
- import dry-run
- explicit apply confirmation

The admin backend is a control plane over those artifacts and commands. It does not replace the
Python workflow.

## Daily Operator Path

Default wrapped path:

```bash
cd python
./bin/equitystack current-admin run
./bin/equitystack current-admin review
./bin/equitystack current-admin apply
./bin/equitystack current-admin apply --apply --yes
```

What each step means:

- `run`
  - discovers fresh current-administration updates
  - generates the next working batch when no `--input` is supplied
  - starts the canonical workflow and prepares review
- `review`
  - refreshes the decision template
  - requires explicit operator decisions
  - finalizes through the canonical decision-log path
- `apply`
  - reruns pre-commit
  - runs import dry-run first
  - only mutates on `--apply --yes`
- `status`
  - prints the canonical current-admin state machine and next step

## Guided Workflow Tracker

The admin UI now exposes current-admin as a guided workflow instead of requiring the operator to
reconstruct the next move from raw artifacts.

The tracker is available on:

- `/admin`
- `/admin/workflows`
- `/admin/workflows/[sessionId]`
- `/admin/current-admin-review`

The current-admin steps are:

1. `Discover / Batch Ready`
2. `Run current-admin`
3. `Operator Review`
4. `Decision Log Finalized`
5. `Pre-commit / Apply Readiness`
6. `Admin Approval / Final Apply`
7. `Validation / Complete`

How completion is determined:

- `Discover / Batch Ready`
  - complete when the canonical batch is present
- `Run current-admin`
  - complete when the review artifact exists
- `Operator Review`
  - current while the review artifact exists and review decisions are still pending
- `Decision Log Finalized`
  - complete when the decision log and manual review queue exist
- `Pre-commit / Apply Readiness`
  - current when the dry-run path is the next valid checkpoint
  - blocked when pre-commit reports a blocking issue
- `Admin Approval / Final Apply`
  - current when the dry-run import exists and explicit apply confirmation is the next checkpoint
- `Validation / Complete`
  - complete when the validation report exists

Tracker status meaning:

- green dot: complete
- yellow dot: current or next required step
- red dot: blocked
- gray dot: not yet available

How to use the guided flow:

- look at `Current step`
- follow `Next step`
- use the single linked action or page the tracker shows
- if blocked, use `Inspect blocker`
- if review is next, go to `/admin/current-admin-review`
- if final apply is next, use the existing guarded confirmation path

The operator should no longer need to guess which current-admin page comes next. The system derives
the next valid step automatically from canonical state and artifacts.

## Canonical Artifacts

The operator backend reflects these artifact types as first-class records:

- normalized batch
- normalization report
- ai-review artifact
- manual-review queue
- decision template
- decision log
- pre-commit artifact
- import dry-run artifact
- import apply artifact
- validation artifact

Canonical file locations remain under:

- `python/data/current_admin_batches/`
- `python/reports/current_admin/`

## Admin Surface

Use the operator/admin system as follows:

- `/admin`
  - daily routine
  - prioritized work buckets
  - current-admin workflow tracker
  - suggested actions
  - session snapshots
- `/admin/current-admin-review`
  - canonical human review and finalize checkpoint
- `/admin/workflows/[sessionId]`
  - inspect state, blockers, artifacts, related jobs, and the full current-admin step tracker
- `/admin/review-queue`
  - see pending human review or guarded next-step work
- `/admin/artifacts`
  - inspect canonical artifact references and freshness

## Discovery and Batch Generation

Discovery remains suggestion-only and non-destructive.

Primary scripts:

- `python/scripts/discover_current_admin_updates.py`
- `python/scripts/export_current_admin_discovery_candidates.py`
- `python/scripts/normalize_current_admin_batch.py`
- `python/scripts/review_current_admin_batch_with_openai_batch.py`
- `python/scripts/apply_current_admin_ai_review.py`
- `python/scripts/import_curated_current_admin_batch.py`
- `python/scripts/validate_current_admin_import.py`
- `python/scripts/sync_current_admin_policy_outcomes.py`

Wrapper commands remain the recommended operator interface. Raw Python entrypoints are for
debugging and lower-level inspection.

## Legacy Surfaces Removed

The old staging intake and promise-editor admin pages are no longer part of the supported operator
system.

Removed or deprecated from active use:

- `/admin/promises/[id]`
- app-side staging AI review pages
- app-side manual promotion/editor flows

If old notes or bookmarks still refer to those pages, treat them as retired workflow history. Use
the current operator surfaces instead.

## First Live Curated Batch

The first live curated current-administration batch was:

- `trump-2025-batch-01`

Production apply result:

- 10 promises created
- 10 actions created
- 10 outcomes created
- 14 sources created
- 16 sources reused

Audit file:

- `python/reports/current_admin/trump-2025-batch-01.import-apply.json`

## Related Docs

- [`docs/admin-operator-system.md`](./admin-operator-system.md)
- [`python/CURRENT_ADMIN_DAILY.md`](../python/CURRENT_ADMIN_DAILY.md)
- [`python/CURRENT_ADMIN_PIPELINE.md`](../python/CURRENT_ADMIN_PIPELINE.md)
- [`python/OPERATIONS.md`](../python/OPERATIONS.md)
