# Outcome Data Completeness

Outcome completeness is additive metadata. It does not change impact scoring formulas, remove low-quality data, or replace existing scoring eligibility rules.

## Helper

```js
computeDataCompleteness(outcome)
summarizeOutcomeCompleteness(scoredOutcomes)
```

Derived fields:

```json
{
  "data_completeness_score": 0.8,
  "completeness_label": "partial",
  "insufficient_data": false,
  "missing_fields": ["missing_evidence_strength"],
  "insufficient_data_reasons": []
}
```

## Labels

- `complete`: summary, direction, evidence strength, sources, measurable impact, and Black-community note are present.
- `partial`: scoring prerequisites are present, but one or more contextual fields are missing.
- `insufficient`: summary, direction, or linked sources are missing.

Missing `evidence_strength` is flagged but does not make an outcome insufficient by itself because the existing scoring formula already has a safe evidence fallback. This keeps the feature honest without changing score values.

## Reporting Metadata

`/api/promises/scores?model=outcome` includes:

```json
{
  "metadata": {
    "outcome_completeness": {
      "average_data_completeness_score": 0.7,
      "completeness_distribution": {
        "complete": 10,
        "partial": 20,
        "insufficient": 64
      },
      "incomplete_outcome_percentage": 0.8936,
      "insufficient_outcome_percentage": 0.6809,
      "missing_field_counts": {},
      "completeness_vs_confidence": {},
      "policies_with_highest_missing_data": [],
      "recommendations": []
    }
  }
}
```

Future UI should present this as a data-quality layer and source-improvement queue, not as a score replacement.
