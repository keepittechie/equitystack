# Python Workflows and Script Index

Use this as the compact map from operator commands to the Python scripts they wrap.

Preferred entry point from the repository root:

```bash
./python/bin/equitystack weekly-run
./python/bin/equitystack review
```

Preferred entry point from `python/`:

```bash
./bin/equitystack weekly-run
./bin/equitystack review
```

## Operator Layer

These commands are the low-touch weekly operating surface. They orchestrate existing checks and do not replace the underlying workflows.

| Command | Primary script | Writes data? | Purpose |
| --- | --- | --- | --- |
| `weekly-run` | `scripts/operator_weekly_report.py weekly-run` | No DB writes | Runs certification, integrity validation, impact evaluate/promote dry-run, source gaps, intent gaps, and final score reporting. |
| `review` | `scripts/operator_weekly_report.py review` | No DB writes | Shows the compact manual task queue: top unsourced outcomes, top intent gaps, and integrity warnings. |

Artifacts:

```text
python/reports/operator/weekly-run.latest.json
python/reports/operator/review.latest.json
```

## Current-Admin Workflow

Canonical commands:

```bash
./python/bin/equitystack current-admin run
./python/bin/equitystack current-admin review
./python/bin/equitystack current-admin apply
./python/bin/equitystack current-admin apply --apply --yes
```

Important scripts:

| Stage | Script |
| --- | --- |
| Discovery | `scripts/discover_current_admin_updates.py` |
| Batch generation | `scripts/generate_current_admin_batch_from_discovery.py` |
| Normalization | `scripts/normalize_current_admin_batch.py` |
| AI review | `scripts/review_current_admin_batch_with_openai_batch.py` |
| AI-first queue build | `scripts/apply_current_admin_ai_review.py` |
| Decision template | `scripts/generate_current_admin_decision_template.py` |
| Pre-commit | `scripts/build_current_admin_precommit_review.py` |
| Import | `scripts/import_curated_current_admin_batch.py` |
| Validation | `scripts/validate_current_admin_import.py` |
| Unified outcome sync | `scripts/sync_current_admin_policy_outcomes.py` |

Safety:

- `current-admin apply` is dry-run unless `--apply --yes` is explicit.
- the canonical `manual-review-queue.json` artifact now splits into `items`, `auto_approved_items`, and `auto_rejected_items`.
- current-admin human review is now limited to the `items` slice; AI-approved import candidates move forward without requiring routine operator approval.
- Current-admin unified outcome sync inserts `impact_score` at creation time.
- Review artifacts record requested model, effective model, backend, timeout, and fallback status.

## Legislative Workflow

Canonical commands:

```bash
./python/bin/equitystack legislative run
./python/bin/equitystack legislative review
./python/bin/equitystack legislative apply --dry-run
./python/bin/equitystack legislative apply --apply --yes
./python/bin/equitystack legislative repair --dry-run
./python/bin/equitystack legislative repair --apply --yes
./python/bin/equitystack legislative materialize-outcomes
./python/bin/equitystack legislative materialize-outcomes --apply --yes
```

Important scripts:

| Stage | Script |
| --- | --- |
| Daily pipeline | `run_equitystack_pipeline.py` |
| Tracked bill sync | `update_database.py` |
| Link audit | `scripts/audit_future_bill_links.py` |
| AI review | `scripts/review_future_bill_audit.py` |
| AI review apply | `scripts/apply_future_bill_ai_review.py` |
| Partial-link suggestions | `scripts/suggest_partial_future_bill_links.py` |
| Candidate discovery | `scripts/find_candidate_tracked_bills.py` |
| Review bundle | `scripts/build_review_bundle.py` |
| Bundle review | `scripts/review_bundle_actions.py` |
| Bundle apply | `scripts/apply_review_bundle.py` |
| Bundle repair | `scripts/repair_review_bundle.py` |
| Approved bill import | `scripts/import_approved_tracked_bills.py` |
| Legislative outcome materialization | `scripts/materialize_legislative_policy_outcomes.py` |

Safety:

- `legislative apply` and `legislative import` are dry-run unless `--apply --yes` is explicit.
- `legislative repair` is dry-run unless `--apply --yes` is explicit.
- `legislative materialize-outcomes` is dry-run unless `--apply --yes` is explicit.
- legislative manual-review artifacts now keep only unresolved human-review rows, while AI-approved bundle actions are treated as apply-ready workflow state.
- Legislative outcomes are inserted into `policy_outcomes` with `impact_score`, but are excluded from per-president scoring until deterministic president attribution exists.
- Stale approved `remove_direct_link` actions are treated as already resolved when their target link is already absent.

Note: pipeline review stages now use the OpenAI provider path directly, and wrapper defaults can resolve to OpenAI-style models such as `gpt-4.1-mini`.

## Impact and Certification Workflow

These commands are the core read-only and guarded write surface for unified outcomes.

| Command | Script | Default behavior |
| --- | --- | --- |
| `impact evaluate` | `scripts/evaluate_impact_maturation.py evaluate` | Read-only review artifact |
| `impact promote` | `scripts/evaluate_impact_maturation.py promote` | Dry-run unless `--apply --yes` |
| `impact sync-current-admin-outcomes` | `scripts/sync_current_admin_policy_outcomes.py` | Dry-run unless `--apply --yes` |
| `impact report-final-black-impact-score` | `scripts/report_final_black_impact_score.py` | Read-only |
| `impact certify-production-data` | `scripts/audit_production_certification.py` | Read-only |
| `impact validate-integrity` | `scripts/validate_policy_outcome_integrity.py` | Read-only |
| `impact complete-certification-readiness` | `scripts/complete_production_certification_readiness.py` | Dry-run unless `--apply --yes` |

Unified outcome invariants:

- `impact_score` must be present and bounded.
- `impact_direction` must be valid.
- `source_count` must be non-negative.
- `policy_type` must be valid.
- duplicate `(policy_type, policy_id, outcome_summary_hash)` groups must be absent.

## Manual Curation Workflows

Use these when `weekly-run` or `review` identifies manual work.

| Command | Script | Purpose |
| --- | --- | --- |
| `impact audit-outcome-source-gaps` | `scripts/audit_policy_outcome_source_gaps.py` | Prioritize unsourced outcomes. |
| `impact curate-sources` | `scripts/curate_policy_outcome_sources.py` | Attach operator-provided verified sources. |
| `impact audit-policy-intent-gaps` | `scripts/audit_policy_intent_gaps.py` | Prioritize unclassified policies. |
| `impact curate-policy-intent` | `scripts/curate_policy_intent.py` | Manually classify policy intent. |
| `impact audit-policy-coverage-gaps` | `scripts/audit_historical_policy_coverage_gaps.py` | Identify missing landmark policies by decade/category. |

Manual source curation example:

```bash
./python/bin/equitystack impact curate-sources \
  --only-policy-outcome-id <ID> \
  --source-title "<Official Title>" \
  --source-url "https://..." \
  --source-type Government \
  --apply --yes
```

Manual intent curation example:

```bash
./python/bin/equitystack impact curate-policy-intent \
  --only-policy-id <ID> \
  --category <equity_expanding|equity_restricting|neutral_administrative> \
  --summary "Short factual description of intent" \
  --source-reference "Official source or historical reference" \
  --apply --yes
```

## Time, Intent, Source, and Coverage Reports

| Command | Script | Purpose |
| --- | --- | --- |
| `impact report-outcome-time` | `scripts/report_policy_outcome_time_dimension.py` | Read-only time coverage and invalid date-range checks. |
| `impact report-policy-intent` | `scripts/report_policy_intent_alignment.py` | Read-only intent vs outcome alignment. |
| `impact audit-source-quality` | `scripts/audit_source_quality.py` | Read-only source quality/domain/duplicate audit. |
| `impact audit-outcome-temporal-attribution` | `scripts/audit_outcome_temporal_attribution.py` | Read-only timing-signal audit. |
| `impact backfill-policy-time-intent` | `scripts/backfill_policy_time_and_intent.py` | Guarded time/intent backfill; dry-run unless `--apply --yes`. |

## Rule of Thumb

Use `weekly-run` first. Use `review` second. Drop to the lower-level commands only when the weekly report says a specific area needs attention.
