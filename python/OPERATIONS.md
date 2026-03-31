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

## Primary Admin Pages

- `/admin`
  - Morning operator dashboard
  - Daily routine
  - Suggested actions
  - Session snapshots
- `/admin/command`
  - Deterministic command console
  - No natural-language execution
- `/admin/jobs`
  - Broker job history, logs, rerun controls
- `/admin/workflows`
  - Session registry and active sessions
- `/admin/workflows/[sessionId]`
  - Session inspector for jobs, artifacts, queue items, blockers, runtime metadata
- `/admin/review-queue`
  - Pending human review checkpoints
- `/admin/artifacts`
  - Canonical artifact catalog
- `/admin/schedules`
  - Safe scheduled preparation only
- `/admin/tools`
  - Verification, registry inspection, environment checks

## Canonical Review Surfaces

- `/admin/current-admin-review`
  - Current-admin operator review and finalize checkpoint
- `/admin/legislative-workflow`
  - Legislative bundle review and approval checkpoint

These stay outside the generic command-center tables because they are the actual human review surfaces.

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
- Reserved executor model: `rnj-1:latest`

`rnj-1` is executor-only. It may assist with summaries, preprocessing, approved wrapper-command execution, and verification support. It is not a decision-maker and cannot approve workflow checkpoints.

## Verification

Use `/admin/tools` or the command console:

- `verify environment`
- `verify remote-executor`
- `verify control-plane`

These checks are safe and read-only. They do not enqueue normal workflow jobs.

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
