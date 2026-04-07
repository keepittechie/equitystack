# Workflow Hardening and Future Data Consistency

EquityStack's unified outcome workflows now enforce the corrected production baseline at write time.
This document is the operator reference for keeping future current-admin, legislative, and impact-maturation data consistent.

## Invariants

Every `policy_outcomes` row created by canonical workflows must have:

- `policy_type` set to `current_admin` or `legislative`
- `policy_id` pointing to the matching source table for that `policy_type`
- `outcome_summary` and `outcome_summary_hash`
- valid `impact_direction`: `Positive`, `Negative`, `Mixed`, or `Blocked`
- non-null `impact_score`
- `source_count >= 0`
- no duplicate `(policy_type, policy_id, outcome_summary_hash)` group

The canonical impact-score fallback remains:

```text
Positive ->  1.0
Mixed    ->  0.5
Negative -> -1.0
Blocked  ->  0.0
```

Current-admin sync may use a related historical policy score only when the promise has exactly one deterministic related historical policy score through `promise_actions.related_policy_id`. Otherwise it uses the direction fallback.

## Hardened Writers

These workflows now insert `impact_score` at creation time:

```bash
./python/bin/equitystack impact sync-current-admin-outcomes
./python/bin/equitystack legislative materialize-outcomes
./python/bin/equitystack impact promote --apply --yes
```

`impact sync-current-admin-outcomes` also requires the `policy_outcomes.impact_score` column to exist before syncing. If the column is missing, the workflow fails rather than creating weaker rows.

## Post-Workflow Validation Gates

Any workflow that writes `policy_outcomes` now validates the resulting unified rows before committing or before reporting success.

Checks:

- `impact_score` is present and bounded to `[-100, 100]`
- `impact_direction` is valid
- `source_count` is non-negative
- `policy_type` is valid
- duplicate outcome groups are absent
- current-admin rows resolve to real promises
- legislative rows resolve to real tracked bills
- legislative date ranges are valid where present

If validation fails in an apply path, the workflow rolls back or blocks the run and records the validation failure in the report.

## Legislative Attribution Decision

Legislative outcomes are materialized into `policy_outcomes`, but they are not assigned to presidents in the final president score.

Reason: the current schema has a deterministic link from current-admin outcomes to presidents through:

```text
policy_outcomes(policy_type=current_admin).policy_id -> promises.id -> presidents.id
```

The legislative path only has:

```text
policy_outcomes(policy_type=legislative).policy_id -> tracked_bills.id
```

There is no reliable president attribution for non-enacted tracked bills in the existing schema. The final score report therefore marks legislative rows with:

```json
{
  "excluded_from_president_score": true,
  "president_score_exclusion_reason": "legislative_outcome_has_no_deterministic_president_attribution"
}
```

This avoids false precision and prevents double-counting.

## Intent Modifier Behavior

The final Black Impact Score report applies intent modifiers only when deterministic.

For current-admin outcomes, the report checks:

```text
policy_outcomes -> promises -> promise_actions.related_policy_id -> policies.policy_intent_category
```

The modifier is applied only when all related classified historical policies resolve to one category. If multiple intent categories exist or no classified related policy exists, the modifier defaults to `1.0`.

Legislative outcomes currently default to unknown intent in president scoring because they are excluded from president totals.

## Source Handling

Current-admin source curation uses:

```text
promise_outcome_sources -> policy_outcomes.source_count/source_quality
```

Legislative materialization uses official bill/action URLs from `tracked_bills` and `tracked_bill_actions` as source signals and stores them in `policy_outcomes.source_count/source_quality`.

Existing source metadata may be refreshed only when the new source signal is stronger. The workflows do not downgrade source quality or reduce source counts.

## Verification Commands

Use these read-only commands after deploys and after new imports:

```bash
./python/bin/equitystack impact sync-current-admin-outcomes
./python/bin/equitystack legislative materialize-outcomes
./python/bin/equitystack impact report-final-black-impact-score
./python/bin/equitystack impact certify-production-data
./python/bin/equitystack impact audit-outcome-source-gaps --limit 50
```

For impact maturation:

```bash
./python/bin/equitystack impact evaluate
./python/bin/equitystack impact promote --dry-run --approve-safe
```

Apply modes remain explicit and guarded:

```bash
./python/bin/equitystack impact sync-current-admin-outcomes --apply --yes
./python/bin/equitystack legislative materialize-outcomes --apply --yes
./python/bin/equitystack impact promote --apply --yes
```

## Remaining Manual Work

Workflow drift is guarded, but data completeness still depends on operator curation:

- curate remaining `source_count = 0` outcomes with `impact curate-sources`
- classify remaining historical policy intent with `impact curate-policy-intent`
- define a future legislative attribution model only if the schema gains a reliable attribution field

Do not use ad hoc SQL inserts into `policy_outcomes`. Use the canonical workflows so validation gates run.
