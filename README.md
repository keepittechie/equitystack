# EquityStack

[https://equitystack.org](https://equitystack.org)

EquityStack is a public-facing research and accountability platform focused on how laws, court cases, executive actions, and tracked political promises affect Black communities in the United States.

The product is organized around a clear public flow:

1. `Start Here` for guided background and framing
2. `Promise Tracker` for record-level promises, actions, outcomes, and sources
3. `Black Impact Score` for president-level accountability summaries built from those records
4. `Timeline` and `Compare` views for historical continuity and side-by-side analysis

This repository has two active parts:

- the Node.js / Next.js website at the repo root
- the Python data pipeline in [`python/`](python/)

The old root-level pipeline report dumps were stale duplicates. Active pipeline outputs now live under [`python/reports/`](python/reports/).

## Node.js Website

The public website lives at the repo root and uses Next.js 16, React 19, and MySQL-backed server routes.

Key directories:

- [`app/`](app/) for routes, pages, and UI
- [`lib/`](lib/) for data access and shared services
- [`public/`](public/) for website assets
- [`database/`](database/) for schema and SQL helpers

Core public routes:

- [`/start`](app/start/page.js) for onboarding and guided explainers
- [`/promises`](app/promises/page.js) for the Promise Tracker
- [`/reports`](app/reports/page.js) for curated report entry points
- [`/reports/black-impact-score`](app/reports/black-impact-score/page.js) for the Black Impact Score system
- [`/research/how-black-impact-score-works`](app/research/how-black-impact-score-works/page.js) for the public scoring-methodology explainer
- [`/reports/civil-rights-timeline`](app/reports/civil-rights-timeline/page.js) for the curated civil-rights timeline

The current database source of truth is:

- [`database/equitystack.sql`](database/equitystack.sql)

Active Promise Tracker and operator reference docs now live in:

- [`docs/QUICK_START.md`](docs/QUICK_START.md) for the low-touch weekly operator loop
- [`docs/PYTHON_WORKFLOWS.md`](docs/PYTHON_WORKFLOWS.md) for the CLI-to-script workflow map
- [`database/promise_tracker_import_batch_2_sources.md`](database/promise_tracker_import_batch_2_sources.md) for manual source reconciliation on the approved import batch
- [`docs/promise-tracker-current-administration.md`](docs/promise-tracker-current-administration.md) for current-admin workflow notes
- [`docs/admin-operator-system.md`](docs/admin-operator-system.md) for the live operator/admin system
- [`docs/mcp.md`](docs/mcp.md) for the MCP control-layer wrapper over existing CLI/API workflows
- [`docs/workflow-hardening.md`](docs/workflow-hardening.md) for unified outcome write-time invariants, scoring validation gates, and future data consistency rules

## Black Impact Score in Plain Language

Black Impact Score is the site’s accountability layer. It summarizes documented policy outcomes into president-level score views using the current unified `policy_outcomes` model rather than campaign rhetoric alone.

The current production model combines:

- direct outcome impact
- confidence from evidence coverage
- policy intent modifiers when the related policy intent is deterministic
- systemic impact multipliers when a policy has curated long-run structural significance
- policy-type weighting

The public methodology explainer lives at:

- [`/research/how-black-impact-score-works`](app/research/how-black-impact-score-works/page.js)

Primary report modes:

- Standard Report
- Timeline
- Topic Comparison
- Share Report

Advanced tools remain available on the same route, but they are intentionally secondary:

- Debate mode
- President comparison
- Saved snapshots
- Permalinks
- Print / Save PDF

For more detail, see:

- [`docs/reports.md`](docs/reports.md)
- [`docs/architecture.md`](docs/architecture.md)
- [`docs/sharing.md`](docs/sharing.md)
- [`docs/workflow-hardening.md`](docs/workflow-hardening.md)

Run the website locally with:

```bash
npm install
npm run dev
```

Useful commands:

```bash
npm run dev
npm run build
npm run start
npm run lint
```

The app expects local environment variables in `.env.local`, including database connection settings and the admin basic-auth credentials used by [`proxy.js`](proxy.js).

## Production Topology

- frontend host: `10.10.0.13`
- deployed frontend root: `/opt/equitystack-frontend`
- live PM2 app: `equitystack-frontend`
- separate PM2 app on the same host: `watchdog-frontend`
- MariaDB host: `10.10.0.15`
- production database: `black_policy_tracker`

When you inspect or restart the live frontend, target `equitystack-frontend` explicitly and leave
`watchdog-frontend` alone.

The repo still includes [`deploy.sh`](deploy.sh) as a deployment helper, but the live runtime source
of truth is the PM2 process on `10.10.0.13` serving `/opt/equitystack-frontend`.

## Sharing and Reuse

The public report system supports a few lightweight sharing paths:

- `Share Report` is the main public-facing share action
- normalized permalinks preserve exact report state under the hood
- saved snapshots keep reusable report states in the current browser
- browser print provides the current print / save-PDF export path

These features all reuse the same report-state system. They do not change scoring or store report state in the database.

## Python Data Pipeline

The legislative data pipeline lives under [`python/`](python/). It is responsible for the data refresh, audit, review, apply, and import workflow that feeds EquityStack.

For normal maintenance, start with the low-touch operator loop:

```bash
./python/bin/equitystack weekly-run
./python/bin/equitystack review
```

Those commands tell the operator what happened, what needs attention, and what can wait. They write:

```text
python/reports/operator/weekly-run.latest.json
python/reports/operator/review.latest.json
```

These files under [`python/reports/`](python/reports/) are generated working outputs. They can be regenerated by rerunning the pipeline and are not the source of truth for the application schema or Promise Tracker imports.

Common lower-level operator commands:

```bash
./python/bin/equitystack current-admin run
./python/bin/equitystack current-admin review
./python/bin/equitystack current-admin apply
./python/bin/equitystack legislative run
./python/bin/equitystack legislative review
./python/bin/equitystack impact certify-production-data
./python/bin/equitystack impact validate-integrity
```

Current operator/admin scoring-linkage visibility lives at:

- [`/admin/systemic-linkage`](app/admin/systemic-linkage/page.js) for systemically classified policies that are active, inactive, runtime-fallback only, or missing canonical links

The server wrapper command is `~/bin/equitystack`, which runs the same Python workflow from the deployed environment. For current-admin commands, path flags accept both python-rooted paths like `data/current_admin_batches/...` and repo-rooted paths like `python/data/current_admin_batches/...`.

Operator maintenance helpers are also available through the wrapper. For example,
stale unfinished workflow sessions can be previewed and archived without deleting
their audit files:

```bash
~/bin/equitystack operator cleanup-stale-workflows --dry-run
~/bin/equitystack operator cleanup-stale-workflows --apply --yes
```

Pipeline details, supporting scripts, and the full operator runbook are documented in [`python/README.md`](python/README.md), [`python/OPERATIONS.md`](python/OPERATIONS.md), and [`docs/PYTHON_WORKFLOWS.md`](docs/PYTHON_WORKFLOWS.md).

For current-administration Promise Tracker work, the canonical workflow is the Python artifact pipeline under [`python/`](python/). The dashboard is a read-only analytics and admin surface on top of those artifacts; it is not a second review-generation or import pipeline.

## Note

This project uses demo and publicly sourced data only. No sensitive or private user data is stored in this repository.
