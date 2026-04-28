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
./bin/equitystack legislative repair
./bin/equitystack legislative feedback
```

Legacy shortcuts still work:

```bash
./bin/equitystack run
./bin/equitystack apply
./bin/equitystack import
./bin/equitystack feedback
```

Note: top-level `./bin/equitystack review` is now the compact operator review queue. Use `./bin/equitystack legislative review` for legislative bundle review.

## What `legislative run` Actually Does

The wrapper runs these stages in order:

1. `run_equitystack_pipeline.py`
2. `scripts/auto_triage_review_bundle.py --apply --yes --auto-approve-safe-actions`
3. `scripts/build_review_bundle.py --csv --use-feedback`

Inside `run_equitystack_pipeline.py`, the daily pipeline runs:

1. `update_database.py`
2. `scripts/review_future_bill_audit.py` with verifier, senior, and fallback models from the wrapper defaults
3. `scripts/apply_future_bill_ai_review.py`
4. `scripts/suggest_partial_future_bill_links.py` with the configured verifier model
5. `scripts/find_candidate_tracked_bills.py` with the configured verifier model only when the suggestion output still needs discovery
6. `scripts/build_review_bundle.py`

Default review models:

- senior review: wrapper `review AI` default from `./bin/equitystack --help`
- verifier / fallback review: wrapper verifier/fallback defaults from `./bin/equitystack --help`
- default senior/verifier timeout: `240` seconds

The legislative pipeline uses the OpenAI provider path directly. Wrapper defaults can resolve to OpenAI-style models such as `gpt-4.1-mini`.

Primary outputs:

- `reports/equitystack_pipeline_report.json`
- `reports/future_bill_link_ai_review.json`
- `reports/future_bill_link_manual_review_queue.json`
- `reports/future_bill_link_partial_suggestions.json`
- `reports/future_bill_candidate_discovery.json`
- `reports/equitystack_review_bundle.json`

Legislative review semantics:

- `future_bill_link_manual_review_queue.json` should now contain only AI-uncertain rows that still need human review
- the canonical review bundle can carry both pending human bundle decisions and AI-approved actions that are already eligible for apply preview
- `/admin/legislative-workflow` shows those AI-approved actions in a separate read-only section so the editable approval table stays human-only

Admin visibility:

- `/admin/legislative-workflow` is the web approval surface for the remaining human review and bundle-approval work.
- The admin page reads the canonical artifacts, saves operator approval decisions back into the review bundle, and only triggers wrapped legislative commands when readiness checks pass.
- Legislative apply/import still run through wrapped CLI execution. The admin must not create a direct DB write path around the pipeline.

## Safe Operator Path

Most days:

```bash
./bin/equitystack legislative run
./bin/equitystack legislative review
./bin/equitystack legislative apply --dry-run
./bin/equitystack legislative apply --apply --yes
./bin/equitystack legislative materialize-outcomes
```

Use these only when needed:

```bash
./bin/equitystack legislative import --dry-run
./bin/equitystack legislative import --apply --yes
./bin/equitystack legislative repair --dry-run
./bin/equitystack legislative repair --apply --yes
./bin/equitystack legislative feedback
```

Interpretation:

- `legislative review` now covers only human bundle decisions that are still pending
- if `/admin/legislative-workflow` shows AI-approved apply actions and no editable pending rows, the review stage is effectively complete and the next work is apply preview or import

## Dry-Run And Mutating Stages

- `review_future_bill_audit.py` is advisory.
- `apply_future_bill_ai_review.py` is dry-run unless `--apply --yes` is supplied.
- `suggest_partial_future_bill_links.py` never mutates the DB.
- `find_candidate_tracked_bills.py` never mutates the DB unless you explicitly write a seed file.
- `import_approved_tracked_bills.py` is dry-run unless `--apply --yes` is supplied.
- `apply_review_bundle.py` is mutating and should only be run through the normal approval path.
- missing targets for approved `remove_direct_link` actions are now treated as an idempotent resolved state, not a hard failure.
- `repair_review_bundle.py` rewrites stale canonical review-bundle/manual-review-queue state when approved actions are no longer executable against current DB reality.
- `materialize_legislative_policy_outcomes.py` is dry-run unless `--apply --yes` is explicit; it inserts unified `policy_outcomes` with `policy_type = legislative` and `impact_score` populated.

## When The Bundle Is Stale

The canonical review bundle can lag behind current DB state. This usually shows up as:

- an approved `remove_direct_link:<future_bill_id>:<future_bill_link_id>` action still present in the bundle
- `future_bill_link_id` no longer existing in the DB
- `legislative review` showing no real pending manual items
- the admin tracker still looking stuck on `Manual Review Queue`, `Bundle Approval`, or `REVIEW_READY` even though only old approved actions remain

Use:

```bash
./bin/equitystack legislative repair --dry-run
./bin/equitystack legislative repair --apply --yes
```

This command:

- validates bundle actions against live DB state
- marks dead or already-satisfied actions as resolved in the canonical bundle
- removes stale manual-review queue rows that no longer match live links
- writes `reports/equitystack_bundle_repair_report.json`

`legislative apply --apply --yes` now also runs this repair step automatically after rebuilding the review bundle.

## Environment Notes

- LLM execution uses the configured provider endpoint from `config/llm.json` or `EQUITYSTACK_LLM_ENDPOINT`.
- DB-backed legislative helpers now honor runtime env overrides such as `DB_HOST=10.10.0.15`.
- `import_tracked_bills.py` also honors `CONGRESS_API_KEY` from the runtime environment.
- Preferred local path: rebuild `python/venv` with `./bin/bootstrap-python-env`.
- Fallback override: `EQUITYSTACK_PYTHON_BIN=/path/to/python`.
- Review artifacts stamp requested model, effective model, backend, fallback status, and fallback reason.

Example production-style dry run:

```bash
EQUITYSTACK_PYTHON_BIN=/path/to/python \
DB_HOST=10.10.0.15 \
python3 scripts/import_approved_tracked_bills.py --input reports/approved_tracked_bills_seed.json
```

## Lower-Level Scripts

Primary supporting scripts:

- `update_database.py`
- `scripts/review_future_bill_audit.py`
- `scripts/apply_future_bill_ai_review.py`
- `scripts/suggest_partial_future_bill_links.py`
- `scripts/find_candidate_tracked_bills.py`
- `scripts/build_review_bundle.py`
- `scripts/review_bundle_actions.py`
- `scripts/apply_review_bundle.py`
- `scripts/repair_review_bundle.py`
- `scripts/import_approved_tracked_bills.py`
- `scripts/materialize_legislative_policy_outcomes.py`
- `scripts/analyze_feedback.py`

Helper / maintenance scripts:

- `scripts/import_tracked_bills.py`
- `scripts/import_legislators_from_tracked_bills.py`
- `scripts/audit_future_bill_links.py`
- `scripts/run_all_updates.py`
- `scripts/auto_triage_review_bundle.py`
