# Current-Administration Reports

This directory stores durable JSON outputs for the current-administration Promise Tracker workflow.

Daily operator instructions live in `python/CURRENT_ADMIN_DAILY.md`.

Full system reference lives in `python/CURRENT_ADMIN_PIPELINE.md`.

Expected report types:
- `discovery_report.json`
- `<batch>.normalized.json`
- `<batch>.normalization-report.json`
- `<batch>.ai-review.json`
- `<batch>.decision-template.json` when you keep the generated decision template alongside the review artifact
- `<batch>.manual-review-queue.json`
- `<batch>.pre-commit-review.json`
- `<batch>.import-dry-run.json`
- `<batch>.import-apply.json`
- `<batch>.import-validation.json`
- `review_decisions/*.decision-log.json`
- `feedback/ai_feedback_summary.json`

Optional operator exports may also live outside this directory:

- worklists and session manifests under any explicit path you choose, often `/tmp/*.json`
- decision templates under any explicit path you choose, often `/tmp/*.decision-template.json`

These files are operator-facing artifacts and are intended to support SSH/CLI review and auditability. The dashboard reads the same artifacts; it does not create a second review or import pipeline.

`<batch>.pre-commit-review.json` is the read-only import guardrail artifact. It summarizes decision coverage, blocking issues, warnings, and the recommended next manual step before import.
