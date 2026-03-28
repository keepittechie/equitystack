# Legislative Pipeline

Use this for the daily future-bills / tracked-bills workflow.

Work from:

```bash
cd python
```

## Run This Daily

Default daily refresh:

```bash
./bin/equitystack legislative run
```

This runs the normal review-first sequence:

1. refresh tracked bills, sponsors, legislators, and scorecard snapshots
2. rebuild the future-bill link audit
3. run the AI review on risky links
4. build the manual review queue and safe-removal report
5. generate partial-link suggestions
6. run candidate discovery only when unresolved rows still need it
7. build the consolidated review bundle

Main outputs:

- `reports/equitystack_pipeline_report.json`
- `reports/equitystack_review_bundle.json`

## Shortest Safe Path

Most days, use this sequence:

```bash
./bin/equitystack legislative run
./bin/equitystack legislative review
./bin/equitystack legislative apply
```

Legacy shortcuts still work:

```bash
./bin/equitystack run
./bin/equitystack review
./bin/equitystack apply
```

## Import Approved Tracked Bills Only When Needed

Run this only if the apply report wrote approved tracked-bill seed rows:

```bash
./bin/equitystack legislative import
```

Refresh feedback analysis when needed:

```bash
./bin/equitystack legislative feedback
```

## Use This Only When Needed

Rebuild the bundle without rerunning the whole pipeline:

```bash
python3 scripts/build_review_bundle.py --csv --use-feedback
```

Preview auto-triage decisions:

```bash
python3 scripts/auto_triage_review_bundle.py --dry-run
```

Persist only the conservative safe-action auto-approvals:

```bash
python3 scripts/auto_triage_review_bundle.py --apply --yes --auto-approve-safe-actions
```

Refresh operator feedback analysis:

```bash
python3 scripts/analyze_feedback.py
```

## Advanced And Debug Only

Use these only when you need to inspect or rerun a specific stage without the wrapper.

Low-level legislative refresh without the full review bundle:

```bash
python3 update_database.py
```

Direct AI review of the audit:

```bash
python3 scripts/review_future_bill_audit_with_ollama.py --model qwen3.5:latest --csv
```

Direct safe-removal stage:

```bash
python3 scripts/apply_future_bill_ai_review.py \
  --input reports/future_bill_link_ai_review.json \
  --csv
```

Suggestion stage only:

```bash
python3 scripts/suggest_partial_future_bill_links.py \
  --input-review-report reports/future_bill_link_ai_review.json \
  --input-manual-queue reports/future_bill_link_manual_review_queue.json \
  --top-k 5 \
  --csv
```

Discovery stage only:

```bash
python3 scripts/find_candidate_tracked_bills.py \
  --trigger-from-suggestions reports/future_bill_link_partial_suggestions.json \
  --trigger-from-review reports/future_bill_link_ai_review.json \
  --top-k 5 \
  --csv
```

## Primary Entrypoints

- `bin/equitystack legislative run`: default daily command
- `bin/equitystack legislative review`: manual approval loop
- `bin/equitystack legislative apply`: apply approved bundle actions and rebuild bundle
- `bin/equitystack legislative import`: import approved seed rows when present
- `bin/equitystack legislative feedback`: refresh feedback analysis and rebuild bundle

## Helper And Debug Scripts

- `update_database.py`: refresh-only wrapper around the sync and audit layer
- `scripts/run_all_updates.py`: lower-level refresh entrypoint used by `update_database.py`
- `scripts/build_review_bundle.py`: rebuild bundle from existing reports
- `scripts/auto_triage_review_bundle.py`: optional score-based auto-triage
- `scripts/analyze_feedback.py`: update feedback analysis report
- `scripts/review_future_bill_audit_with_ollama.py`: review audit output directly
- `scripts/apply_future_bill_ai_review.py`: direct safe-removal stage
- `scripts/suggest_partial_future_bill_links.py`: suggestion stage only
- `scripts/find_candidate_tracked_bills.py`: discovery stage only

## De-Emphasized In Operator Docs

These exist, but they are not part of the normal operator path:

- `run_legislative_updates.sh`: thin shell wrapper for `update_database.py`
- `scripts/import_tracked_bills.py`: low-level tracked-bill sync internals
- `scripts/import_legislators_from_tracked_bills.py`: low-level legislator sync internals
- `scripts/audit_future_bill_links.py`: low-level deterministic audit stage
- `scripts/import_policies.py`: policy-pack import utility, not part of the daily pipeline
- `scripts/import_audit.py`: enrichment import utility, not part of the daily pipeline
- `scripts/audit_policy_pack_duplicates.py`: policy-pack duplicate audit helper
