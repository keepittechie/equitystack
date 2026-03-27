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
- the Python data pipeline in [`python/`](/home/josh/Documents/GitHub/equitystack/python)

The old root-level pipeline report dumps were stale duplicates. Active pipeline outputs now live under [`python/reports/`](/home/josh/Documents/GitHub/equitystack/python/reports).

## Node.js Website

The public website lives at the repo root and uses Next.js 16, React 19, and MySQL-backed server routes.

Key directories:

- [`app/`](/home/josh/Documents/GitHub/equitystack/app) for routes, pages, and UI
- [`lib/`](/home/josh/Documents/GitHub/equitystack/lib) for data access and shared services
- [`public/`](/home/josh/Documents/GitHub/equitystack/public) for website assets
- [`database/`](/home/josh/Documents/GitHub/equitystack/database) for schema and SQL helpers

Core public routes:

- [`/start`](/home/josh/Documents/GitHub/equitystack/app/start/page.js) for onboarding and guided explainers
- [`/promises`](/home/josh/Documents/GitHub/equitystack/app/promises/page.js) for the Promise Tracker
- [`/reports`](/home/josh/Documents/GitHub/equitystack/app/reports/page.js) for curated report entry points
- [`/reports/black-impact-score`](/home/josh/Documents/GitHub/equitystack/app/reports/black-impact-score/page.js) for the Black Impact Score system
- [`/reports/civil-rights-timeline`](/home/josh/Documents/GitHub/equitystack/app/reports/civil-rights-timeline/page.js) for the curated civil-rights timeline

The current database source of truth is:

- [`database/equitystack.sql`](/home/josh/Documents/GitHub/equitystack/database/equitystack.sql)

Active Promise Tracker reference docs now live in:

- [`database/promise_tracker_import_batch_2_sources.md`](/home/josh/Documents/GitHub/equitystack/database/promise_tracker_import_batch_2_sources.md) for manual source reconciliation on the approved import batch
- [`docs/promise-tracker-v1.md`](/home/josh/Documents/GitHub/equitystack/docs/promise-tracker-v1.md) for the feature summary

## Black Impact Score in Plain Language

Black Impact Score is the site’s accountability layer. It takes Promise Tracker records and summarizes them into president-level score views using documented outcomes rather than campaign rhetoric alone.

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

- [`docs/reports.md`](/home/josh/Documents/GitHub/equitystack/docs/reports.md)
- [`docs/architecture.md`](/home/josh/Documents/GitHub/equitystack/docs/architecture.md)
- [`docs/sharing.md`](/home/josh/Documents/GitHub/equitystack/docs/sharing.md)

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

The app expects local environment variables in `.env.local`, including database connection settings and the admin basic-auth credentials used by [`proxy.js`](/home/josh/Documents/GitHub/equitystack/proxy.js).

Deployment is handled by [`deploy.sh`](/home/josh/Documents/GitHub/equitystack/deploy.sh).

## Sharing and Reuse

The public report system supports a few lightweight sharing paths:

- `Share Report` is the main public-facing share action
- normalized permalinks preserve exact report state under the hood
- saved snapshots keep reusable report states in the current browser
- browser print provides the current print / save-PDF export path

These features all reuse the same report-state system. They do not change scoring or store report state in the database.

## Python Data Pipeline

The legislative data pipeline lives under [`python/`](/home/josh/Documents/GitHub/equitystack/python). It is responsible for the data refresh, audit, review, apply, and import workflow that feeds EquityStack.

Typical daily run:

```bash
cd python
python3 run_equitystack_pipeline.py --csv
```

Primary outputs:

- [`python/reports/equitystack_pipeline_report.json`](/home/josh/Documents/GitHub/equitystack/python/reports/equitystack_pipeline_report.json)
- [`python/reports/equitystack_review_bundle.json`](/home/josh/Documents/GitHub/equitystack/python/reports/equitystack_review_bundle.json)

These files under [`python/reports/`](/home/josh/Documents/GitHub/equitystack/python/reports) are generated working outputs. They can be regenerated by rerunning the pipeline and are not the source of truth for the application schema or Promise Tracker imports.

Common operator commands:

```bash
cd python
python3 run_equitystack_pipeline.py --csv
python3 scripts/review_bundle_actions.py
python3 scripts/apply_review_bundle.py --csv
python3 scripts/apply_review_bundle.py --apply --yes --csv
python3 scripts/import_approved_tracked_bills.py --apply --yes --link-imported-bills --enrich-metadata --csv
```

The server wrapper command is `~/bin/equitystack`, which runs the same Python workflow from the deployed environment.

Pipeline details, supporting scripts, and the full operator runbook are documented in [`python/README.md`](/home/josh/Documents/GitHub/equitystack/python/README.md).

## Note

This project uses demo and publicly sourced data only. No sensitive or private user data is stored in this repository.
