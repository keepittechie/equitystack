# EquityStack Operator System

Work from `python/` for canonical CLI workflows. Use `/admin` for the broker-backed operator control plane.

## Canonical Boundary

- The Python CLI and artifacts are canonical.
- The admin backend is a wrapped control plane on top of those workflows.
- The admin backend must not bypass:
  - explicit operator decisions
  - decision logs
  - pre-commit
  - import dry-run
  - explicit apply confirmation
  - legislative approval surfaces

## Trust And Data Flow

EquityStack is a policy intelligence system, not a narrative generator.

The canonical path is:

1. wrapped CLI workflow
2. canonical artifacts in `python/reports/...`
3. canonical DB writes where import/apply steps run
4. service-layer reads for admin and public pages
5. UI summaries derived from those services

Operator guidance, trust banners, and workflow summaries are allowed to simplify that flow for humans.
They are not allowed to invent data that the canonical artifacts or DB do not contain.

## Primary Admin Pages

- `/admin`
  - command center
  - trust banner
  - attention queue
  - workflow outcome summaries
  - human review queue preview
  - recent workflow runs
- `/admin/command`
  - Deterministic command console
  - No natural-language execution
- `/admin/jobs`
  - Broker job history, logs, rerun controls
- `/admin/workflows`
  - canonical workflow state
  - canonical surfaces first, persisted sessions second
- `/admin/workflows/[sessionId]`
  - Session inspector for jobs, artifacts, queue items, blockers, runtime metadata
- `/admin/review-queue`
  - pending human decisions
- `/admin/source-curation`
  - unresolved source attribution follow-up
  - confirmed curation drafts and review notes only
- `/admin/artifacts`
  - Canonical artifact catalog
- `/admin/schedules`
  - Safe scheduled preparation only
- `/admin/tools`
  - Verification, registry inspection, environment checks

## Public Entry Points

The public product should remain easy to navigate from a few stable read-only surfaces:

- `/`
  - homepage with live previews and entry links
- `/promises`
  - Promise Tracker browser
- `/reports/black-impact-score`
  - president-level Black Impact Score report
- `/current-administration`
  - current-term Promise Tracker view

## Canonical Review Surfaces

- `/admin/current-admin-review`
  - Current-admin operator review and finalize checkpoint
- `/admin/legislative-workflow`
  - Legislative bundle review and approval checkpoint
- `/admin/source-curation`
  - Manual source-gap curation checkpoint
  - Existing-source attach proposals, new-source drafts, and reviewed notes only

These stay outside the generic command-center tables because they are the actual human review surfaces.

## Operator Mental Model

- `/admin`
  - command center
  - use it to answer: what happened, did AI work, what needs review, what is blocked, what do I do next
- `/admin/workflows`
  - workflow truth
  - use it to inspect canonical current-admin and legislative state
- `/admin/review-queue`
  - human decisions only
  - use it when the workflows say review, approval, or follow-up is still pending

## Current-Admin Daily Flow

Preferred wrapped flow:

```bash
./bin/equitystack current-admin run
./bin/equitystack current-admin review
./bin/equitystack current-admin apply
./bin/equitystack current-admin apply --apply --yes
```

Notes:

- `run` prepares the next working batch and review session.
- `review` still requires explicit operator decisions and decision logs.
- `apply` still reruns pre-commit and dry-run first.
- mutating import still requires `--apply --yes`.

### Guided Current-Admin Workflow

The admin UI now exposes current-admin as a guided step flow instead of making the operator infer
the next move from artifacts alone.

Tracked steps:

1. `Discover / Batch Ready`
2. `AI Review`
3. `Operator Review`
4. `Finalize Decisions`
5. `Pre-commit / Apply Readiness`
6. `Admin Approval`
7. `Import`

The full tracker appears on:

- `/admin/current-admin-review`
- `/admin` (compact when active)

Tracker-derived next-step state also appears on:

- `/admin/workflows`
- `/admin/workflows/[sessionId]`

Tracker status meaning:

- green dot: complete
- yellow dot: current or next required step
- red dot: blocked
- gray dot: not yet available

How to use it:

- read `Current real state` and `Next step`
- follow the single next action link or button
- if blocked, use the explicit blocker action
- if review is next, go to `/admin/current-admin-review`
- if final apply is next, use the existing guarded confirmation path

The tracker is deterministic. It is derived from canonical batch state, artifact presence, review
counts, blockers, and action permissions. It does not create a second workflow engine.

## Legislative Daily Flow

Preferred wrapped flow:

```bash
./bin/equitystack legislative run
./bin/equitystack legislative review
./bin/equitystack legislative apply
./bin/equitystack legislative import
./bin/equitystack legislative feedback
```

Notes:

- legislative approval remains a human checkpoint.
- import remains guarded by the canonical workflow.

### Guided Legislative Workflow

The admin UI now exposes legislative as a guided step flow too.

Tracked steps:

1. `Discovery / Ingestion`
2. `AI Review`
3. `Manual Review Queue`
4. `Bundle Approval`
5. `Pre-commit / Validation`
6. `Apply / Import`
7. `Post-run Verification`

The full tracker appears on:

- `/admin/legislative-workflow`
- `/admin` (compact when active)

Tracker-derived next-step state also appears on:

- `/admin/workflows`
- `/admin/workflows/[sessionId]`

Status meaning:

- green dot: complete
- yellow dot: current required step
- red dot: blocked
- gray dot: not yet available

How to use it:

- if fallback dominated the run, `Manual Review Queue` turns red and the next action is `Open legislative review`
- if manual review is clear but bundle approvals remain, `Bundle Approval` turns yellow and the next action is `Open bundle approval`
- if apply or import is blocked by a missing report or other artifact gap, the blocked step turns red and the next action is `Inspect missing artifact`

This is still a read-only mapping layer on top of the canonical legislative artifacts and reports.

## Blocked States And API Errors

The operator UI should never fail silently.

- blocked pages must say what is blocked, why, and the exact next action
- empty pages must say what to do next instead of only saying no data was found
- if an admin API returns HTML or malformed JSON instead of JSON, the UI now shows a backend-error message instead of crashing on `Unexpected token '<'`

## Execution Modes

The operator control plane supports explicit execution modes:

- `local_cli`
- `remote_executor`
- `mcp_runtime`

Important:

- allowed modes are enforced per registered action
- dangerous final actions remain guarded and are not opened up just because another mode exists
- the operator UI must always show mode, backend, host, and transport metadata

## Remote Executor

- Production app host: `10.10.0.13`
- Production Ollama host: `10.10.0.60`
- Reserved executor model: `$MCP_MODEL`

The configured MCP executor model is executor-only. It may assist with summaries, preprocessing, approved wrapper-command execution, and verification support. It is not a decision-maker and cannot approve workflow checkpoints.

## Verification

Use `/admin/tools` or the command console:

- `verify environment`
- `verify remote-executor`
- `verify control-plane`
- `verify data-integrity`
- `verify deep-integrity`

These checks are safe and read-only. They do not enqueue normal workflow jobs.

`verify data-integrity` checks the canonical policy data itself, including:

- required fields on promises and outcomes
- missing source attribution
- orphaned relationship rows
- orphaned source join rows
- duplicate relationship groups
- duplicate future-bill link groups
- duplicate source URLs

`verify deep-integrity` adds:

- source-gap classification so legacy missing evidence is separated from possible join gaps
- duplicate-source safety classification so only exact duplicate URL clusters with compatible non-null `policy_id` ownership are auto-merge candidates
- current-admin provenance completeness so imported DB rows without their artifact chain are surfaced explicitly

## Deploy Hygiene

`./deploy.sh` ships the local working tree to production. It now refuses to run when untracked
deployable files are present in shipped paths such as `app/`, `lib/`, `docs/`, or `python/`.

Keep these rules in mind:

- generated integrity artifacts under `python/reports/integrity/` stay ignored
- local code must be added or committed before deploy
- production should never rely on accidental local-only files

Use it when the UI looks suspiciously empty, duplicated, or incomplete and you need to confirm whether
the underlying DB state is actually sound.

## Source Cleanup Policy

Source cleanup stays conservative.

Auto-merge duplicate sources only when:

- `source_url` matches
- `source_title` matches
- `source_type` matches
- `publisher` matches
- `published_date` matches
- non-null `policy_id` ownership does not conflict

Auto-backfill missing source joins only when:

- the missing row already has exactly one canonical same-promise source across existing promise, action, and outcome source joins

Do not:

- invent sources
- guess URLs
- merge duplicate sources across conflicting non-null `policy_id` values
- auto-fix ambiguous rows

Cleanup outputs are written to `python/reports/integrity/` and surfaced on `/admin/tools`.

### Source Curation Workflow

Use `/admin/source-curation` for unresolved source attribution and unsafe duplicate-source review.

- it loads unresolved scope from `python/reports/integrity/source_attribution_manual_review.json`
- it loads unsafe duplicate clusters from `python/reports/integrity/source_duplicate_manual_review.json`
- it writes confirmed decisions to:
  - `python/reports/integrity/source_curation_decisions.json`
  - `python/reports/integrity/source_curation_audit_log.jsonl`
- it records the confirmed save in operator command history

Allowed actions there:

- attach an existing source to the selected missing action/outcome
- create a new source row and attach it immediately
- mark the gap as reviewed with a note
- merge a selected compatible duplicate subset after explicit confirmation
- mark a duplicate cluster keep-separate or reviewed without mutating source rows

Every mutation is explicit, confirmed, and auditable. Unsafe duplicate clusters are never auto-merged.

## Current-Admin Provenance Guard

The guarded current-admin queue import now refuses to proceed if the manual-review queue cannot prove its lineage.

Required before queue-based import:

- queue source batch artifact exists
- queue source review artifact exists
- pre-commit artifact exists and is not blocked
- decision log exists and matches the queue review artifact

This does not invent missing history. It prevents future imports from bypassing the retained artifact chain.

## Scheduled Preparation

Schedules may queue only explicitly allowed safe preparation actions.

Examples:

- `currentAdmin.status`
- `currentAdmin.run`
- `currentAdmin.workflowResume`
- `legislative.run`
- `legislative.feedback`

Blocked from automatic scheduling:

- `currentAdmin.review`
- `currentAdmin.apply`
- `legislative.review`
- `legislative.apply`
- `legislative.import`

## Durable Operator Data

The operator control plane persists:

- jobs
- logs
- workflow sessions
- artifacts
- review queue items
- system signals
- schedules
- command history

This persistence is control-plane state only. It does not replace canonical policy or pipeline data.

## Operator Traceability Rule

When you investigate a problem, trace it in this order:

1. `/admin` for the command-center summary
2. `/admin/workflows` or `/admin/review-queue` for the canonical operator surface
3. the session or review page for the specific workflow
4. the related artifact path or broker job
5. the DB-backed public record when the workflow imported data

If a UI state cannot be explained by those canonical layers, treat it as a trust or integrity issue.

## Legacy Admin Pages

The old staging intake, promise editor, policy editor, import-history, pre-commit, logs,
operator-console, review, runbook, and approval pages are no longer part of the supported admin
surface.

## Fresh Walkthrough Reset

For demos or operator walkthrough cleanup:

```bash
./bin/equitystack admin-reset-operational-state --dry-run
./bin/equitystack admin-reset-operational-state --apply --yes
```

This archives operator run-state and report artifacts only. It does not remove canonical policy data or source files.
