# EquityStack Operator Checklist

Work from `python/`.

## Daily Legislative Flow

1. Run the pipeline: `./bin/equitystack legislative run`
2. Review actions: `./bin/equitystack legislative review`
3. Apply approved actions: `./bin/equitystack legislative apply`
4. If approved tracked-bill seed rows were created, import them: `./bin/equitystack legislative import`
5. Refresh feedback analysis when needed: `./bin/equitystack legislative feedback`

## Current-Administration Flow

Golden path:

1. `./bin/equitystack current-admin workflow start --input data/current_admin_batches/<batch-file>.json`
2. `./bin/equitystack current-admin workflow review --input reports/current_admin/<batch-name>.ai-review.json --output /tmp/<batch-name>.decision-template.json`
3. Fill explicit `operator_action` values in the generated decision template
4. `./bin/equitystack current-admin workflow finalize --review reports/current_admin/<batch-name>.ai-review.json --decision-file /tmp/<batch-name>.decision-template.json --log-decisions`
5. `./bin/equitystack current-admin pre-commit --input reports/current_admin/<batch-name>.manual-review-queue.json`
6. `./bin/equitystack current-admin import --input reports/current_admin/<batch-name>.manual-review-queue.json`
7. `./bin/equitystack current-admin validate --input reports/current_admin/<batch-name>.manual-review-queue.json`

Operator daily use:

- `current-admin status` to see the current artifact state
- `workflow resume` to continue the latest session safely
- `pre-commit` before import so blockers and warnings are explicit
- dashboard pages for visibility only, not for running the pipeline

1. Check state first: `./bin/equitystack current-admin status`
2. Optional discovery: `./bin/equitystack current-admin discover --president-slug donald-j-trump-2025 --dry-run`
3. Optional export into a draft batch: `./bin/equitystack current-admin export --candidate-id <section:index> --output-name <draft>`
4. Run the safe prep steps: `./bin/equitystack current-admin workflow start --input data/current_admin_batches/<batch-file>.json`
5. Use deep review only when needed: `./bin/equitystack current-admin workflow start --input data/current_admin_batches/<batch-file>.json --deep-review`
6. Scan the review output fast when needed: `./bin/equitystack current-admin review --input reports/current_admin/<batch-name>.normalized.json --deep-review --sort-by-priority --descending --summary`
7. Preview only the riskiest items when needed: `./bin/equitystack current-admin review --input reports/current_admin/<batch-name>.normalized.json --priority high,medium --attention-needed --preview`
8. Export an advisory worklist when you want a focused review session: `./bin/equitystack current-admin review --input reports/current_admin/<batch-name>.normalized.json --suggested-batch high_attention --export-worklist /tmp/high_attention.json`
9. Generate a decision template from the review artifact or worklist: `./bin/equitystack current-admin workflow review --input reports/current_admin/<batch-name>.ai-review.json --output /tmp/<batch-name>.decision-template.json`
10. Fill explicit `operator_action` values in that decision file
11. Log explicit operator decisions: `./bin/equitystack current-admin workflow finalize --review reports/current_admin/<batch-name>.ai-review.json --decision-file /tmp/<batch-name>.decision-template.json --log-decisions`
12. Run pre-commit import review: `./bin/equitystack current-admin pre-commit --input reports/current_admin/<batch-name>.manual-review-queue.json`
13. Approve or edit records in the manual queue
14. Dry-run import: `./bin/equitystack current-admin import --input reports/current_admin/<batch-name>.manual-review-queue.json`
15. Apply import: `./bin/equitystack current-admin import --input reports/current_admin/<batch-name>.manual-review-queue.json --apply --yes`
16. Validate import: `./bin/equitystack current-admin validate --input reports/current_admin/<batch-name>.manual-review-queue.json`
17. Use `./bin/equitystack current-admin workflow resume` or `./bin/equitystack current-admin status` whenever you need the next step
18. Export analytics when you want a decision-vs-AI summary: `node scripts/export_current_admin_feedback_summary.mjs`

Use `README.md` as the entrypoint and the workflow-specific docs for details.
