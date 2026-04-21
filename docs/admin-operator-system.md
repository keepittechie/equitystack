# EquityStack Admin Operator System

## Overview

The EquityStack admin backend is a control plane for the canonical Python workflows. It is not a second workflow engine and it does not replace the CLI.

Core flow:

- registry
- broker
- runner
- job
- session / artifacts / review queue / signals

Everything in the admin UI is derived from or wrapped around canonical workflow artifacts and explicit operator actions.

## Trust Model

EquityStack exists to track policy impacts on Black Americans with traceable evidence, explicit review
checkpoints, and honest uncertainty.

That means the operator system must preserve:

- canonical Python workflow truth
- DB-backed public records and metrics
- traceable sources and relationship links
- manual review for sensitive or fallback-heavy decisions
- explicit blocked / warning states instead of silent assumptions

The admin backend is allowed to summarize this truth. It is not allowed to invent a new one.

## Canonical Data Flow

The operator-facing data path is:

1. CLI / wrapped workflow action
2. canonical artifact output under `python/reports/...`
3. canonical DB writes where the workflow imports or applies data
4. service-layer reads for admin and public pages
5. admin or public UI rendering

Practical examples:

- current-admin:
  - discovery / normalization / AI review / decision log / queue / pre-commit / import artifacts
  - canonical DB updates for current administration promise records
  - admin review surface and public current-administration pages read from the resulting artifact + DB state
- legislative:
  - pipeline report / AI review / manual-review queue / review bundle / apply / import artifacts
  - canonical DB updates for future-bill links, tracked-bill link state, and downstream report data
  - admin workflow surfaces and public legislative/report pages read from those artifacts and DB-backed records
- unified outcomes:
  - current-admin sync, legislative materialization, and impact maturation write into `policy_outcomes`
  - each canonical writer must populate `impact_score` at insert time
  - each writer validates impact score, direction, source count, policy type, and duplicate groups before reporting success

If a page cannot trace a value back to this chain, treat it as a trust risk.

## Low-Touch Operator Layer

The preferred maintenance entry point is the CLI operator layer:

```bash
./python/bin/equitystack weekly-run
./python/bin/equitystack review
```

`weekly-run` orchestrates the read-only production certification, integrity, impact, source-gap, intent-gap, and final score checks. `review` shows only the compact manual queue. The admin UI remains a control plane on top of the same canonical workflows; it does not replace these checks.

## Production Topology

- frontend host: `10.10.0.13`
- deployed frontend root: `/opt/equitystack-frontend`
- live PM2 app: `equitystack-frontend`
- separate PM2 app on the same host: `watchdog-frontend`
- MariaDB host: `10.10.0.15`
- production database: `black_policy_tracker`

`/admin/tools` environment verification runs from the live frontend host, so DB health means the app
on `10.10.0.13` can reach MariaDB on `10.10.0.15`.

## Main Concepts

### Jobs

- Every execution becomes a broker-backed job.
- Jobs capture:
  - action id and title
  - input and context
  - status
  - timestamps
  - logs
  - attached artifacts
  - execution mode metadata

### Workflow Sessions

- Sessions reflect canonical workflow context for current-admin and legislative work.
- They track:
  - canonical session key
  - canonical state
  - recommended next action
  - related jobs
  - related artifacts
  - related review queue items

### Artifacts

- Artifacts are first-class operator records.
- The admin backend stores canonical paths and metadata, not large inline copies of the underlying files.

### Review Queue

- Review work stays separate from execution.
- Queue items are derived from canonical workflow state and artifacts.
- Review actions still require human checkpoints.

### Schedules

- Schedules can prepare safe work automatically.
- Schedules may only run allowlisted safe actions.
- Schedules still create normal broker jobs.

### Command Console

- `/admin/command` is deterministic.
- It does not use natural-language parsing.
- It does not build raw CLI commands in the browser.

## Main Pages

- `/admin`
  - command center
  - trust banner
  - attention queue
  - workflow outcome summaries
  - review queue preview
  - recent workflow runs
- `/admin/command`
  - deterministic command console
- `/admin/jobs`
  - job list and job detail
- `/admin/workflows`
  - canonical workflow state
  - canonical surfaces first, persisted sessions second
- `/admin/workflows/[sessionId]`
  - session inspector
- `/admin/review-queue`
  - pending human decisions
- `/admin/source-curation`
  - human-in-the-loop source attribution follow-up
  - loads unresolved source gaps from `source_attribution_manual_review.json`
  - saves confirmed curation decisions as audit artifacts only
- `/admin/systemic-linkage`
  - read-only operator report for non-default systemic policies
  - shows whether each policy is active in live scoring, runtime-fallback only, canonically linked, or outside the current score family
  - gives a grounded inactive reason and next safe operator action
- `/admin/artifacts`
  - artifact catalog and session linkage
- `/admin/schedules`
  - safe scheduled preparation
- `/admin/tools`
  - verification and registry inspection
  - canonical data-integrity checks

## Public Entry Points

The public product should stay easy to enter from a few clear surfaces that all read from the same
Promise Tracker and Black Impact Score services:

- `/`
  - homepage
  - explains the mission quickly and previews live records
- `/promises`
  - Promise Tracker browser
- `/reports/black-impact-score`
  - president-level Black Impact Score report
- `/current-administration`
  - current-term Promise Tracker view

## Canonical Review Surfaces

These remain necessary because they are the actual human checkpoint pages:

- `/admin/current-admin-review`
- `/admin/legislative-workflow`

The command center links into them when the next step requires human review.

Additional human review surface:

- `/admin/source-curation`
  - attach an existing source candidate
  - draft a new source candidate
  - mark unresolved source gaps as reviewed
  - mutates canonical source joins only after explicit operator confirmation

## Operator Mental Model

- `/admin`
  - command center
  - answers: what happened, can I trust it, what needs attention, what is next
- `/admin/workflows`
  - canonical workflow state
  - current-admin and legislative surfaces first
  - persisted session inspectors second
- `/admin/review-queue`
  - human decision work only
  - current-admin operator review, apply follow-up, legislative manual review, bundle approval

Logs and raw artifacts support the story. They do not replace the command center, workflow state, or review pages.

## Verification Surfaces

`/admin/tools` and the deterministic command console now expose five read-only verification scopes:

- `verify environment`
- `verify remote-executor`
- `verify control-plane`
- `verify data-integrity`
- `verify deep-integrity`

The data-integrity scope checks canonical promise, source, relationship, and future-bill-link tables for:

- missing required fields
- orphaned relationship rows
- orphaned source join rows
- duplicate relationship groups
- duplicate future-bill links
- duplicate source URLs
- missing source attribution on actions and outcomes
- invalid unified outcome rows, including missing `impact_score`, invalid `impact_direction`, negative `source_count`, invalid `policy_type`, and duplicate `(policy_type, policy_id, outcome_summary_hash)` groups

`/admin/systemic-linkage` complements these checks with score-path visibility for policy-level systemic metadata. It is intentionally read-only and does not treat numeric `policy_id` overlap as a real link.

The deep-integrity scope adds:

- source-gap classification
- duplicate-source cluster safety classification
- current-admin provenance completeness
- artifact-chain warnings when DB records exist but the canonical current-admin artifacts are missing

## Unified Outcome Guardrails

The canonical unified-outcome workflows are:

```bash
./python/bin/equitystack impact sync-current-admin-outcomes
./python/bin/equitystack legislative materialize-outcomes
./python/bin/equitystack impact promote
```

They are not interchangeable with manual SQL. Use them so the validation gates run.

Legislative outcomes are present in `policy_outcomes`, but final president scoring explicitly excludes them until a deterministic attribution field exists. This is intentional and prevents assigning bill status outcomes to the wrong administration.

The full write contract is documented in [`workflow-hardening.md`](workflow-hardening.md).

### Source Cleanup Rules

Source cleanup must stay evidence-backed.

- auto-merge duplicate source rows only when:
  - `source_url` matches
  - `source_title` matches
  - `source_type` matches
  - `publisher` matches
  - `published_date` matches
  - non-null `policy_id` ownership does not conflict
- do not merge duplicate source rows across conflicting non-null `policy_id` values
- do not invent missing sources or guess URLs
- only backfill missing source joins when a deterministic existing source match is available
- if a row is ambiguous, export it for manual review instead of mutating the DB

Cleanup artifacts live under `python/reports/integrity/` and are surfaced on `/admin/tools`.

These files are generated operator artifacts. They should stay out of git and out of normal deploy
inputs.

### Source Curation Surface

`/admin/source-curation` is the manual follow-up surface for unresolved source attribution and unsafe duplicate-source review.

- it reads unresolved source-gap scope from `python/reports/integrity/source_attribution_manual_review.json`
- it reads unsafe duplicate clusters from `python/reports/integrity/source_duplicate_manual_review.json`
- it may reconstruct row detail from the live DB when the current artifact predates row-level exports
- it writes confirmed operator decisions to:
  - `python/reports/integrity/source_curation_decisions.json`
  - `python/reports/integrity/source_curation_audit_log.jsonl`
- it also records each confirmed save in operator command history

This surface is human-in-the-loop only.

- `Attach source` updates the canonical source join table for the selected action/outcome after explicit confirmation
- `Create and attach source` creates a new canonical source row, attaches it immediately, and logs the action
- `Mark as reviewed` stores a confirmed review note when ambiguity remains
- `Merge selected` merges an explicitly chosen duplicate subset only after operator confirmation
- `Mark keep separate` and `Mark reviewed` record duplicate-cluster decisions without mutating source rows

It does not auto-save.

Every mutation must be explicit, confirmed, and auditable. Unsafe duplicate clusters are never auto-merged.

## Deploy Hygiene

`./deploy.sh` deploys from the local working tree, so it now fails fast when untracked deployable
files are present under `app/`, `lib/`, `docs/`, `python/`, or other shipped paths.

For live runtime checks, treat PM2 on `10.10.0.13` as the source of truth: the active EquityStack
frontend is `equitystack-frontend` serving `/opt/equitystack-frontend`.

The goal is simple:

- production should not depend on accidental local-only files
- generated integrity and source-curation artifacts should stay ignored
- the local repo should remain the source of truth before anything is deployed

## Current-Admin Guided Workflow

The current-admin flow is now surfaced as a guided step tracker instead of requiring the operator
to infer the next move from artifacts alone.

The full tracker appears on:

- `/admin/current-admin-review`
- `/admin` (compact when active)

Tracker-derived next-step state also appears on:

- `/admin/workflows`
- `/admin/workflows/[sessionId]`

The step sequence is:

1. `Discover / Batch Ready`
2. `AI Review`
3. `Operator Review`
4. `Finalize Decisions`
5. `Pre-commit / Apply Readiness`
6. `Admin Approval`
7. `Import`

Step completion is derived from canonical current-admin state and artifacts. The admin does not
invent a second workflow state machine.

Canonical signals used by the tracker include:

- `batch.stage`
- current-admin artifact presence
- blocker reasons
- pending review counts
- existing action permissions

### Tracker Status Meaning

- green dot: step is complete
- yellow dot: this is the current or next required step
- red dot: the workflow is blocked at this step
- gray dot: the step is not available yet

Only one step should feel like the next thing to do.

### Provenance Rules

Current-admin trust depends on a retained artifact chain.

Before DB import is allowed from the manual-review queue, the canonical chain must exist:

- normalized batch
- AI review artifact
- decision log
- manual-review queue
- pre-commit review

Import dry-run and apply reports then extend that same chain forward.

If DB rows are detected for the active batch but these artifacts are missing, the workspace now marks the batch as:

- `import_batch_detected`
- `artifact_chain_missing`
- `provenance_incomplete`

This is a visibility layer only. It does not fabricate missing history.

## Source Backfill Policy

Missing source attribution is split into three categories:

- true missing attribution
- rows with same-promise source context
- manual-review-only unresolved rows

Only deterministic rows may be repaired automatically.

Current automatic repair policy:

- missing `promise_action_sources` rows may be backfilled only when the same promise already resolves to exactly one canonical source across promise, action, and outcome source joins
- missing `policy_outcome_sources` rows remain manual-only unless the same deterministic condition is eventually proven

Canonical outcome evidence now lives on:

```text
sources + policy_outcome_sources
```

When cleanup runs, it writes:

- `source_integrity_cleanup_report.json`
- `source_duplicate_manual_review.json`
- `source_attribution_manual_review.json`

### What To Click Next

The tracker resolves the next step automatically:

- if review artifacts are missing, it points to `Run current-admin`
- if review is ready, it points to `/admin/current-admin-review`
- if decision logging is the next checkpoint, it points to the current-admin review surface so the operator can finalize
- if pre-commit or dry-run is next, it exposes the existing guarded broker-backed action
- if the workflow is blocked, it points to the session inspector blocker section
- if final apply is ready, it exposes the existing confirmed apply path

This is guidance only. It does not auto-run any step or bypass confirmation.

## Systemic Linkage Coverage Surface

`/admin/systemic-linkage` is the operator view for systemic-impact coverage cleanup.

For every policy with a non-default `systemic_impact_category`, it shows:

- policy identity and systemic metadata
- whether the policy is active in live scoring
- current score-path type: `current_admin`, `judicial`, `mixed`, or `none`
- canonical link status
- inactive reason when the policy is not canonically active
- recommended next operator action

Typical grounded statuses include:

- `explicit_promise_action_link`
- `runtime_title_match_only`
- `judicial_direct_link`
- `unsafe_numeric_id_overlap_only`
- `multiple_title_match_candidates`

Typical recommended actions include:

- `leave as-is; already active in live scoring`
- `add related_policy_id to matching promise_action`
- `manual review of ambiguous linkage`
- `verify whether this policy should have a scored outcome`
- `leave as-is; currently outside score family`

This surface exists to make linkage debt explicit without auto-mutating production data.

## Legislative Guided Workflow

The legislative flow is now surfaced with the same step-tracker pattern.

The full tracker appears on:

- `/admin/legislative-workflow`
- `/admin` (compact when active)

Tracker-derived next-step state also appears on:

- `/admin/workflows`
- `/admin/workflows/[sessionId]`

The step sequence is:

1. `Discovery / Ingestion`
2. `AI Review`
3. `Manual Review Queue`
4. `Bundle Approval`
5. `Pre-commit / Validation`
6. `Apply / Import`
7. `Post-run Verification`

Canonical signals used by the tracker include:

- `getLegislativeWorkflowWorkspace(...)`
- `workflow_outcome_summary`
- `manual_review_queue`
- bundle approval state
- apply / import reports
- pipeline failure and blocker signals

### Legislative Tracker Meaning

- green dot: step is complete
- yellow dot: this is the current required step
- red dot: the workflow is blocked at this step
- gray dot: the step is not available yet

Examples:

- fallback-only AI run:
  - `Manual Review Queue` is red
  - next action is `Open legislative review`
- pending bundle approvals:
  - `Bundle Approval` is yellow
  - next action is `Open bundle approval`
- missing apply or import artifact:
  - the blocked step is red
  - next action is `Inspect missing artifact`

## Blocked States And Error Handling

The operator UI should always tell the operator:

- what is blocked
- why it is blocked
- the exact next action

If an admin API returns HTML or malformed JSON instead of the expected JSON payload:

- the UI now shows an explicit backend-error message
- the endpoint and status code are surfaced in the error text
- the response preview is logged to the browser console for debugging

This protects the operator from silent failures and `Unexpected token '<'` crashes.

## Traceability Expectations

If the operator clicks into a job, session, review item, or workflow page, they should be able to trace:

- the UI surface
- the API endpoint or service feeding that surface
- the canonical session or artifact
- the DB-backed or artifact-backed truth underneath it

The admin UI now surfaces this more explicitly in job detail and workflow views, but the expectation
is system-wide: if traceability is missing, treat that as a product-level trust problem.

## Fallback And Manual Review

Fallback is not hidden.

- current-admin and legislative trust summaries distinguish:
  - AI succeeded
  - AI partial
  - AI failed / fallback-only
- review queue pages must reflect real pending human work from canonical artifacts
- a workflow can be technically complete while still requiring manual review before the next guarded step is trustworthy

## Guardrails

The admin system must not bypass:

- explicit operator decisions
- decision logs
- pre-commit
- import dry-run
- explicit apply confirmation
- legislative approval surfaces

Dangerous actions remain guarded in both the UI and broker path.

## Execution Modes

Supported execution modes:

- `local_cli`
- `remote_executor`
- `mcp_runtime`

The operator UI always shows:

- execution mode
- executor model
- executor backend
- executor host
- executor transport

Mode support is allowlisted per action.

## Verification

Use `/admin/tools` or the command console:

- `verify environment`
- `verify remote-executor`
- `verify control-plane`

These checks are safe, inspectable, and non-destructive.

## Legacy Routes

The supported front door is `/admin`.

Legacy admin surfaces have been aggressively removed so the codebase reflects the real operator
system instead of the previous scattered admin stack.

Removed legacy surfaces include:

- staging intake pages
- promise and policy editor pages
- import-history, pre-commit, and logs pages
- the old operator console service stack
- old review, runbook, approval, and operator-console routes

If an internal note still points at one of those removed pages, use `/admin` and the canonical
review surfaces instead.
