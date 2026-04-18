# Workflow Hardening and Future Data Consistency

EquityStack's unified outcome workflows now enforce the corrected production baseline at write time.
This document is the operator reference for keeping future current-admin, legislative, and impact-maturation data consistent.

## Invariants

Every `policy_outcomes` row created by canonical workflows must have:

- `policy_type` set to `current_admin`, `legislative`, or `judicial_impact`
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
- judicial rows are only president-attributed when explicit majority-justice attribution metadata is present
- legislative date ranges are valid where present

If validation fails in an apply path, the workflow rolls back or blocks the run and records the validation failure in the report.

Operators can also run the read-only integrity gate directly:

```bash
./python/bin/equitystack impact validate-integrity
```

This command validates the same baseline invariants and adds attribution-specific checks:

- `judicial_impact` rows must include explicit `judicial_attribution` entries with `attribution_fraction` values.
- `judicial_impact` rows must include `majority_justices` and `appointing_presidents` metadata.
- missing sources, low president outcome coverage, policy-type imbalance, and directional imbalance are reported as warnings rather than silent assumptions.

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

## Judicial Impact Attribution

Judicial outcomes use `policy_type = judicial_impact`. They are separate from direct current-admin actions and legislative bill status rows.

## Score Families

EquityStack now keeps two president score families separate:

- `Direct Black Impact Score`: the primary headline score. It includes direct policy, administrative, and statutory outcomes with deterministic president attribution. It excludes `judicial_impact`.
- `Systemic Impact Score`: the secondary score family. It includes `judicial_impact` and future explicitly indirect/systemic outcomes only when deterministic attribution exists.

`combined_context_score` may be reported as contextual blended information, but it must not replace the direct headline score. This prevents judicial appointment-mediated impacts from silently changing the meaning of the direct policy score.

Storage is additive and optional:

```text
policy_outcomes(policy_type=judicial_impact).policy_id -> policies.id
court_level
decision_year
majority_justices
appointing_presidents
judicial_attribution
judicial_weight
```

Attribution rule:

```text
attribution_fraction = number of majority justices appointed by president / total majority justices
final judicial contribution = outcome_score * attribution_fraction * judicial_weight
```

The default `judicial_weight` is `0.5`. This prevents Supreme Court or other court decisions from being treated as identical to direct executive action while still making appointment-mediated impact visible.

Judicial rows without explicit attribution metadata are excluded from president totals. The scoring report records that exclusion instead of guessing.

## Low-Coverage Score Display

Raw and normalized president scores remain unchanged. Public score rows now also expose a coverage-aware display score:

```text
confidence_factor = min(1, log(outcome_count + 1) / log(10))
display_score = normalized_score * confidence_factor
```

Coverage labels:

```text
VERY LOW -> outcome_count <= 2
LOW      -> outcome_count <= 5
MEDIUM   -> outcome_count <= 15
HIGH     -> outcome_count > 15
```

This prevents one- or two-outcome presidents from looking absolute while preserving the underlying raw score for auditability.

## Intent Modifier Behavior

The final Black Impact Score report applies intent modifiers only when deterministic.

For current-admin outcomes, the report checks:

```text
policy_outcomes -> promises -> promise_actions.related_policy_id -> policies.policy_intent_category
```

The canonical path is the explicit `promise_actions.related_policy_id` link. The score path may still use a grounded exact-title fallback for a small number of legacy rows when the action title or description clearly names one historical policy, but operators should treat that as cleanup work rather than the preferred steady state.

The modifier is applied only when all resolved related classified historical policies land on one category. If multiple related intent categories conflict, the report uses `mixed_or_competing -> 0.95`. If no related classified policy exists or the classification is missing, the report falls back to `unclear -> 1.0`.

Legislative outcomes still do not affect president totals because they are excluded from president scoring until deterministic attribution exists.

## Systemic Impact Layer

The final Black Impact Score now applies a separate systemic multiplier on top of direct impact and intent.

Storage is policy-level, not outcome-level:

```text
policies.systemic_impact_category
policies.systemic_impact_summary
```

Resolved categories map to conservative multipliers:

```text
limited           -> 0.90
standard          -> 1.00
strong            -> 1.15
transformational  -> 1.30
unclear / null    -> 1.00
```

For current-admin outcomes, the report resolves systemic metadata through the same canonical relationship family used for policy intent:

```text
policy_outcomes -> promises -> promise_actions.related_policy_id -> policies.systemic_impact_category
```

For judicial outcomes, the report reads systemic metadata directly from the linked `policies` row:

```text
policy_outcomes(policy_type=judicial_impact).policy_id -> policies.id
```

This systemic multiplier does not replace the direct score. It is an explicit additional layer:

```text
ABS(impact_score) * direction_weight * confidence_multiplier * intent_modifier * systemic_multiplier * policy_type_weight
```

Rows without curated systemic metadata remain `standard / 1.0`.

## Source Handling

Canonical source linkage now uses:

```text
sources + policy_outcome_sources -> policy_outcomes.source_count/source_quality
```

Current-admin source curation writes directly to `policy_outcome_sources`, then refreshes derived `policy_outcomes.source_count` and `source_quality` from that canonical join table.

Legislative materialization persists official bill/action URLs as canonical `sources` rows and links them through `policy_outcome_sources`, then refreshes `policy_outcomes.source_count/source_quality`.

Existing source metadata may be refreshed only when the new source signal is stronger. The workflows do not downgrade source quality or reduce source counts.

## Legislative Bundle Repair

Legislative bundle state can become stale when an approved bundle action targets a `future_bill_links` row that was already removed by an earlier apply, archive path, or other canonical workflow step.

This is handled in two layers:

- `./python/bin/equitystack legislative apply --apply --yes`
  - treats a missing `remove_direct_link` target as an idempotent resolved state instead of a hard failure
  - continues applying the rest of the approved batch
  - rebuilds the review bundle
  - runs canonical bundle repair automatically after rebuild
- `./python/bin/equitystack legislative repair --dry-run`
- `./python/bin/equitystack legislative repair --apply --yes`
  - reconciles stale bundle and manual-review-queue artifacts already persisted on disk
  - writes `python/reports/equitystack_bundle_repair_report.json`

The repair path updates canonical artifacts only. It does not create a separate admin-side database write path.

## Verification Commands

Use the weekly wrapper first when you want the fast operator answer:

```bash
./python/bin/equitystack weekly-run
./python/bin/equitystack review
```

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
- audit systemic-classified policies that are still inactive or runtime-fallback-only on `/admin/systemic-linkage`
- define a future legislative attribution model only if the schema gains a reliable attribution field

Do not use ad hoc SQL inserts into `policy_outcomes`. Use the canonical workflows so validation gates run.
