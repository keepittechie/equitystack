# Legislative Pipeline

Use this for the future-bills / tracked-bills workflow.

Work from:

```bash
cd python
```

If local Python is not set up yet:

```bash
./bin/bootstrap-python-env
```

## Canonical Operator Commands

```bash
./bin/equitystack legislative run
./bin/equitystack legislative review
./bin/equitystack legislative apply
./bin/equitystack legislative import
./bin/equitystack legislative feedback
```

Legacy shortcuts still work:

```bash
./bin/equitystack run
./bin/equitystack review
./bin/equitystack apply
```

## What `legislative run` Actually Does

The wrapper runs these stages in order:

1. `run_equitystack_pipeline.py`
2. `scripts/auto_triage_review_bundle.py --apply --yes --auto-approve-safe-actions`
3. `scripts/build_review_bundle.py --csv --use-feedback`

Inside `run_equitystack_pipeline.py`, the daily pipeline runs:

1. `update_database.py`
2. `scripts/review_future_bill_audit_with_ollama.py` with verifier `qwen3.5:9b`, senior `qwen3.5:9b`, fallback `qwen3.5:9b`
3. `scripts/apply_future_bill_ai_review.py`
4. `scripts/suggest_partial_future_bill_links.py` with verifier `qwen3.5:9b`
5. `scripts/find_candidate_tracked_bills.py` with verifier `qwen3.5:9b` only when the suggestion output still needs discovery
6. `scripts/build_review_bundle.py`

Default review models:

- senior review: `qwen3.5:9b`
- verifier / fallback review: `qwen3.5:9b`
- default Ollama timeout: `240` seconds

Primary outputs:

- `reports/equitystack_pipeline_report.json`
- `reports/future_bill_link_ai_review.json`
- `reports/future_bill_link_manual_review_queue.json`
- `reports/future_bill_link_partial_suggestions.json`
- `reports/future_bill_candidate_discovery.json`
- `reports/equitystack_review_bundle.json`

Admin visibility:

- `/admin/legislative-workflow` is the web approval surface for the legislative review bundle.
- The admin page reads the canonical artifacts, saves operator approval decisions back into the review bundle, and only triggers wrapped legislative commands when readiness checks pass.
- Legislative apply/import still run through wrapped CLI execution. The admin must not create a direct DB write path around the pipeline.

## Safe Operator Path

Most days:

```bash
./bin/equitystack legislative run
./bin/equitystack legislative review
./bin/equitystack legislative apply --dry-run
./bin/equitystack legislative apply --apply --yes
```

Use these only when needed:

```bash
./bin/equitystack legislative import --dry-run
./bin/equitystack legislative import --apply --yes
./bin/equitystack legislative feedback
```

## Dry-Run And Mutating Stages

- `review_future_bill_audit_with_ollama.py` is advisory.
- `apply_future_bill_ai_review.py` is dry-run unless `--apply --yes` is supplied.
- `suggest_partial_future_bill_links.py` never mutates the DB.
- `find_candidate_tracked_bills.py` never mutates the DB unless you explicitly write a seed file.
- `import_approved_tracked_bills.py` is dry-run unless `--apply --yes` is supplied.
- `apply_review_bundle.py` is mutating and should only be run through the normal approval path.

## Environment Notes

- LLM execution uses the configured provider endpoint from `config/llm.json` or `EQUITYSTACK_LLM_ENDPOINT`.
- DB-backed legislative helpers now honor runtime env overrides such as `DB_HOST=10.10.0.13`.
- `import_tracked_bills.py` also honors `CONGRESS_API_KEY` from the runtime environment.
- Preferred local path: rebuild `python/venv` with `./bin/bootstrap-python-env`.
- Fallback override: `EQUITYSTACK_PYTHON_BIN=/path/to/python`.
- Review artifacts stamp requested model, effective model, backend, fallback status, and fallback reason.

Example production-style dry run:

```bash
EQUITYSTACK_PYTHON_BIN=/path/to/python \
DB_HOST=10.10.0.13 \
python3 scripts/import_approved_tracked_bills.py --input reports/approved_tracked_bills_seed.json
```

## Lower-Level Scripts

Primary supporting scripts:

- `update_database.py`
- `scripts/review_future_bill_audit_with_ollama.py`
- `scripts/apply_future_bill_ai_review.py`
- `scripts/suggest_partial_future_bill_links.py`
- `scripts/find_candidate_tracked_bills.py`
- `scripts/build_review_bundle.py`
- `scripts/review_bundle_actions.py`
- `scripts/apply_review_bundle.py`
- `scripts/import_approved_tracked_bills.py`
- `scripts/analyze_feedback.py`

Helper / maintenance scripts:

- `scripts/import_tracked_bills.py`
- `scripts/import_legislators_from_tracked_bills.py`
- `scripts/audit_future_bill_links.py`
- `scripts/run_all_updates.py`
- `scripts/auto_triage_review_bundle.py`
