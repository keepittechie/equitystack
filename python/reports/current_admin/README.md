# Current-Administration Reports

This directory stores durable JSON outputs for the current-admin workflow.

Primary docs:

- `python/CURRENT_ADMIN_DAILY.md`
- `python/CURRENT_ADMIN_PIPELINE.md`

Expected report types:

- `discovery_report.json`
- `<batch>.normalized.json`
- `<batch>.normalization-report.json`
- `<batch>.ai-review.json`
- `<batch>.manual-review-queue.json`
- `<batch>.pre-commit-review.json`
- `<batch>.import-dry-run.json`
- `<batch>.import-apply.json`
- `<batch>.import-validation.json`
- `review_decisions/<batch>.<timestamp>.decision-log.json`
- `feedback/ai_feedback_summary.json`

Optional operator exports often live outside this directory, usually under `/tmp/`:

- decision templates
- worklists
- session manifests

The dashboard reads these artifacts. It does not replace the Python workflow.
