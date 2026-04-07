# Policy Intent Tracking

Policy intent tracking is additive. It records explicit policy intent when curated evidence supports it, then compares that intent with the recorded impact direction.

## Schema

Migration:

```text
database/policy_intent_tracking.sql
```

Nullable fields:

```sql
policy_intent_summary TEXT NULL
policy_intent_category ENUM(
  'equity_expanding',
  'equity_restricting',
  'neutral_administrative',
  'mixed_or_competing',
  'unclear'
) NULL
```

No migration backfills or infers intent. Existing policies remain valid with null intent fields.

## Classification

`compareIntentVsOutcome(policy)` returns:

```json
{
  "classification": "aligned",
  "intent_category": "equity_expanding",
  "impact_direction": "Positive",
  "rationale": "...",
  "notes": []
}
```

Rules:

- `equity_expanding` aligns with `Positive`, is mixed with `Mixed`, and is misaligned with `Negative` or `Blocked`.
- `equity_restricting` aligns analytically with `Negative`, is mixed with `Mixed`, and is misaligned with `Positive` or `Blocked`.
- `neutral_administrative` aligns with `Mixed`; directional outcomes remain mixed for review.
- `mixed_or_competing` and `unclear` remain mixed.
- Missing intent stays `unclassified`; intent is not inferred from title, summary, or outcome.

## Reporting

Read-only report:

```bash
./python/bin/equitystack impact report-policy-intent
```

The report includes:

- alignment distribution
- aligned/mixed/misaligned percentages among classified policies
- unclassified count
- patterns across administrations and eras
- sample rows per classification

This report does not mutate data.

## Final Score Integration

Policy intent affects the final Black Impact Score only when it is deterministic.

For current-admin outcomes, the final report follows:

```text
policy_outcomes -> promises -> promise_actions.related_policy_id -> policies.policy_intent_category
```

The intent modifier is applied only when all related classified historical policies resolve to one category:

```text
equity_expanding     -> 1.1
equity_restricting   -> 0.9
neutral/unknown      -> 1.0
```

If no related classified policy exists, or if multiple related intent categories conflict, the modifier remains `1.0`.

Intent is never inferred during scoring. Use the manual curation workflow for new classifications:

```bash
./python/bin/equitystack impact curate-policy-intent
```
