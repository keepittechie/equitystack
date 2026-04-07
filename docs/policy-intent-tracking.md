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
