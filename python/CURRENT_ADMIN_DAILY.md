# Current-Admin Daily Guide

Use this for normal day-to-day current-administration work.

Work from:

```bash
cd python
```

This guide is the simple daily runbook.

If you need the full system explanation, read:

- `CURRENT_ADMIN_PIPELINE.md`

## What You Are Doing

You are reviewing a batch of policies and deciding what should be approved before import.

Nothing is written to the database unless you run `--apply`.

Most batches take 5–15 minutes depending on size.

## What This Workflow Is For

Use this workflow when you have a curated current-admin batch file and you want to:

1. review it
2. record your decisions
3. run a safety check
4. import it carefully

The Python pipeline is the real workflow.

The dashboard is only for visibility and guidance.

## Shortest Safe Path

Run these commands in order.

Copy/paste version:

```bash
# 1. Start
./bin/equitystack current-admin workflow start --input data/current_admin_batches/YOUR_FILE.json

# 2. Review
./bin/equitystack current-admin workflow review --input reports/current_admin/YOUR_BATCH.ai-review.json --output /tmp/decisions.json

# 3. Finalize
./bin/equitystack current-admin workflow finalize --review reports/current_admin/YOUR_BATCH.ai-review.json --decision-file /tmp/decisions.json --log-decisions

# 4. Pre-commit
./bin/equitystack current-admin pre-commit --input reports/current_admin/YOUR_BATCH.manual-review-queue.json

# 5. Import dry-run
./bin/equitystack current-admin import --input reports/current_admin/YOUR_BATCH.manual-review-queue.json

# 6. Import apply only when ready
./bin/equitystack current-admin import --input reports/current_admin/YOUR_BATCH.manual-review-queue.json --apply --yes

# 7. Validate
./bin/equitystack current-admin validate --input reports/current_admin/YOUR_BATCH.manual-review-queue.json
```

Replace:

- `YOUR_FILE.json` with the batch file under `data/current_admin_batches/`
- `YOUR_BATCH` with the batch name used in the report files

## What Happens After Each Step

After `workflow start`:

- creates `.normalized.json`
- creates `.ai-review.json`
- creates `.manual-review-queue.json`

After `workflow review`:

- creates `.decision-template.json`
- you edit this file

After `workflow finalize`:

- creates a `.decision-log.json`
- keeps the queue file as the thing you import from later

After `pre-commit`:

- creates `.pre-commit-review.json`
- tells you if you are `ready`, `ready_with_warnings`, or `blocked`

After `import`:

- dry-run first
- apply only if the dry-run still looks right

After `validate`:

- creates `.import-validation.json`
- confirms the imported records look correct

### 1. Start the workflow

```bash
./bin/equitystack current-admin workflow start --input data/current_admin_batches/<batch-file>.json
```

This creates:

- `reports/current_admin/<batch-name>.normalized.json`
- `reports/current_admin/<batch-name>.ai-review.json`
- `reports/current_admin/<batch-name>.manual-review-queue.json`

Next:

- generate a decision template

### 2. Generate a decision template

```bash
./bin/equitystack current-admin workflow review --input reports/current_admin/<batch-name>.ai-review.json --output /tmp/<batch-name>.decision-template.json
```

This creates:

- `/tmp/<batch-name>.decision-template.json`

Next:

- open that file
- fill the blank `operator_action` fields

### 3. Fill the decision template

You must do this part manually.

Pick one action for each item you want to decide:

- `approve_as_is`
- `approve_with_changes`
- `manual_review_required`
- `needs_more_sources`
- `defer`
- `reject`
- `escalate`

Do not leave the decisions to the AI.

Small example:

```json
{
  "slug": "example-policy",
  "operator_action": "approve_with_changes",
  "operator_notes": "Adjusted impact score"
}
```

Common valid actions:

- `approve_as_is`
- `approve_with_changes`
- `manual_review_required`

Full list:

- `approve_as_is`
- `approve_with_changes`
- `manual_review_required`
- `needs_more_sources`
- `defer`
- `reject`
- `escalate`

### 4. Log your decisions

```bash
./bin/equitystack current-admin workflow finalize --review reports/current_admin/<batch-name>.ai-review.json --decision-file /tmp/<batch-name>.decision-template.json --log-decisions
```

This creates:

- a decision log under `reports/current_admin/review_decisions/`

Next:

- run pre-commit

### 5. Run pre-commit

```bash
./bin/equitystack current-admin pre-commit --input reports/current_admin/<batch-name>.manual-review-queue.json
```

This creates:

- `reports/current_admin/<batch-name>.pre-commit-review.json`

This step is read-only.

It does not import anything.

It tells you whether the queue is lined up well enough for the next import step.

### 6. Read the pre-commit result

You will see one of these:

- `ready`
  The approved queue items do not have blocking problems.

- `ready_with_warnings`
  You can still import, but you should read the warnings first.

- `blocked`
  Something must be fixed before import.

If pre-commit is `blocked`, stop and fix the problem first.

## What "Blocked" Means

Blocked does not mean the system is broken.

It usually means:

- you missed a decision
- something is incomplete
- or something does not match

Fix the issues listed in the pre-commit file, then run pre-commit again.

### 7. Dry-run the import

```bash
./bin/equitystack current-admin import --input reports/current_admin/<batch-name>.manual-review-queue.json
```

This creates:

- `reports/current_admin/<batch-name>.import-dry-run.json`

This is still safe.

Import is dry-run by default.

Next:

- read the dry-run report
- only apply if it still looks correct

### 8. Apply only when ready

```bash
./bin/equitystack current-admin import --input reports/current_admin/<batch-name>.manual-review-queue.json --apply --yes
```

This writes to the database.

Only run it when:

- pre-commit is acceptable
- the queue is correct
- the dry-run import looks right

### 9. Validate

```bash
./bin/equitystack current-admin validate --input reports/current_admin/<batch-name>.manual-review-queue.json
```

This creates:

- `reports/current_admin/<batch-name>.import-validation.json`

This step is read-only.

## What You Must Do Manually

You must still:

- fill `operator_action` values yourself
- review the queue yourself
- decide whether to apply import yourself

The system helps you move faster.

It does not make the final decisions for you.

## If You Don’t Know What To Do Next

Use:

```bash
./bin/equitystack current-admin status
./bin/equitystack current-admin workflow resume
```

These commands are read-only.

They tell you:

- what files exist
- what step you are on
- what command to run next

## Don’t Panic

### “Decision file does not match review artifact”

Run:

```bash
./bin/equitystack current-admin workflow review --input reports/current_admin/<batch-name>.ai-review.json --output /tmp/<batch-name>.decision-template.json
```

Then fill the new template and run `workflow finalize` again.

### “Pre-commit says blocked”

Open:

- `reports/current_admin/<batch-name>.pre-commit-review.json`

Read the blocker list.

Then fix the problem and rerun:

```bash
./bin/equitystack current-admin pre-commit --input reports/current_admin/<batch-name>.manual-review-queue.json
```

### “Import dry-run is empty”

Usually this means no queue items are approved for import.

Check the manual review queue and the pre-commit report.

### “I don’t know what file to open”

Start with:

```bash
./bin/equitystack current-admin status
```

It prints the key artifact paths.

## Optional Extras

Use these only when needed.

### Deep review

```bash
./bin/equitystack current-admin workflow start --input data/current_admin_batches/<batch-file>.json --deep-review
```

Use this for harder or more ambiguous records.

### Review only risky items first

```bash
./bin/equitystack current-admin review --input reports/current_admin/<batch-name>.normalized.json --priority high,medium --attention-needed --preview
```

### Export a focused worklist

```bash
./bin/equitystack current-admin review --input reports/current_admin/<batch-name>.normalized.json --suggested-batch high_attention --export-worklist /tmp/high_attention.json
```

### Export feedback summary

```bash
node scripts/export_current_admin_feedback_summary.mjs
```

This is optional analytics only.
