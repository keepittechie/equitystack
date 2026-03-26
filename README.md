# EquityStack

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

Recent website additions include the public Promise Tracker at `/promises`, backed by the schema changes in [`database/promise_tracker_migration.sql`](/home/josh/Documents/GitHub/equitystack/database/promise_tracker_migration.sql) and demo seed data in [`database/promise_tracker_seed.sql`](/home/josh/Documents/GitHub/equitystack/database/promise_tracker_seed.sql).

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
