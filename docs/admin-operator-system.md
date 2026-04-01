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

If a page cannot trace a value back to this chain, treat it as a trust risk.

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
- `/admin/artifacts`
  - artifact catalog and session linkage
- `/admin/schedules`
  - safe scheduled preparation
- `/admin/tools`
  - verification and registry inspection
  - canonical data-integrity checks

## Canonical Review Surfaces

These remain necessary because they are the actual human checkpoint pages:

- `/admin/current-admin-review`
- `/admin/legislative-workflow`

The command center links into them when the next step requires human review.

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

The deep-integrity scope adds:

- source-gap classification
- duplicate-source cluster safety classification
- current-admin provenance completeness
- artifact-chain warnings when DB records exist but the canonical current-admin artifacts are missing

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

### What To Click Next

The tracker resolves the next step automatically:

- if review artifacts are missing, it points to `Run current-admin`
- if review is ready, it points to `/admin/current-admin-review`
- if decision logging is the next checkpoint, it points to the current-admin review surface so the operator can finalize
- if pre-commit or dry-run is next, it exposes the existing guarded broker-backed action
- if the workflow is blocked, it points to the session inspector blocker section
- if final apply is ready, it exposes the existing confirmed apply path

This is guidance only. It does not auto-run any step or bypass confirmation.

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
