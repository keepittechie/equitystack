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
  - daily routine
  - prioritized work buckets
  - suggested actions
  - session snapshots
- `/admin/command`
  - deterministic command console
- `/admin/jobs`
  - job list and job detail
- `/admin/workflows`
  - workflow registry and active sessions
- `/admin/workflows/[sessionId]`
  - session inspector
- `/admin/review-queue`
  - pending human work
- `/admin/artifacts`
  - artifact catalog and session linkage
- `/admin/schedules`
  - safe scheduled preparation
- `/admin/tools`
  - verification and registry inspection

## Canonical Review Surfaces

These remain necessary because they are the actual human checkpoint pages:

- `/admin/current-admin-review`
- `/admin/legislative-workflow`

The command center links into them when the next step requires human review.

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
