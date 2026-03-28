# EquityStack Operator Checklist

Work from `python/`.

## Read This First

Daily current-admin work:

- `CURRENT_ADMIN_DAILY.md`

Full current-admin system reference:

- `CURRENT_ADMIN_PIPELINE.md`

Legislative workflow:

- `LEGISLATIVE_PIPELINE.md`

## Daily Legislative Flow

1. `./bin/equitystack legislative run`
2. `./bin/equitystack legislative review`
3. `./bin/equitystack legislative apply`
4. If approved tracked-bill seed rows were created: `./bin/equitystack legislative import`
5. When needed: `./bin/equitystack legislative feedback`

## Daily Current-Admin Flow

1. `./bin/equitystack current-admin workflow start --input data/current_admin_batches/<batch-file>.json`
2. `./bin/equitystack current-admin workflow review --input reports/current_admin/<batch-name>.ai-review.json --output /tmp/<batch-name>.decision-template.json`
3. Fill explicit `operator_action` values in the decision template
4. `./bin/equitystack current-admin workflow finalize --review reports/current_admin/<batch-name>.ai-review.json --decision-file /tmp/<batch-name>.decision-template.json --log-decisions`
5. `./bin/equitystack current-admin pre-commit --input reports/current_admin/<batch-name>.manual-review-queue.json`
6. `./bin/equitystack current-admin import --input reports/current_admin/<batch-name>.manual-review-queue.json`
7. Only when ready: `./bin/equitystack current-admin import --input reports/current_admin/<batch-name>.manual-review-queue.json --apply --yes`
8. `./bin/equitystack current-admin validate --input reports/current_admin/<batch-name>.manual-review-queue.json`

## When You Are Stuck

- `./bin/equitystack current-admin status`
- `./bin/equitystack current-admin workflow resume`

## Optional Extras

- Deep review: add `--deep-review` to `workflow start`
- Focus risky items first: `current-admin review --priority high,medium --attention-needed --preview`
- Export a worklist: `current-admin review --suggested-batch high_attention --export-worklist /tmp/high_attention.json`
- Export analytics: `node scripts/export_current_admin_feedback_summary.mjs`
