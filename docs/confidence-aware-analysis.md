# Confidence-Aware Analysis

EquityStack now exposes confidence-aware score views as additive reporting metadata. The base impact scoring formula is unchanged; confidence filters only choose which already-scored outcomes participate in a requested aggregation.

## API Usage

Default behavior includes all scorable outcomes:

```text
/api/promises/scores?model=outcome
```

High-confidence only:

```text
/api/promises/scores?model=outcome&confidence=high
```

Medium and high confidence:

```text
/api/promises/scores?model=outcome&confidence=medium_plus
```

Exclude low confidence:

```text
/api/promises/scores?model=outcome&confidence=exclude_low
```

Numeric threshold:

```text
/api/promises/scores?model=outcome&min_confidence=0.75
```

Boolean form for future UI toggles:

```text
/api/promises/scores?model=outcome&include_low_confidence=false
```

Exclude incomplete scored outcomes from the requested view:

```text
/api/promises/scores?model=outcome&exclude_incomplete=true
```

## Metadata

Responses include non-breaking metadata:

```json
{
  "total_outcomes_before_confidence_filter": 30,
  "total_outcomes_excluded_by_confidence_filter": 4,
  "outcome_confidence": {
    "confidence_filter": {
      "mode": "medium_plus",
      "threshold": 0.45
    },
    "filtered_impact_summary": {
      "average_impact_score_all_data": 0.2,
      "average_impact_score_filtered": 0.31,
      "average_impact_score_high_confidence_only": 0.44,
      "low_confidence_outcome_percentage": 0.13
    },
      "confidence_distribution_by_policy": []
    },
    "trust": {
      "high_confidence_outcome_percentage": 0.42,
      "low_confidence_outcome_percentage": 0.13,
      "incomplete_outcome_percentage": 0.22,
      "scored_outcomes_after_all_filters": 30,
      "warnings": {
        "low_confidence_high_impact_outcome_count": 1,
        "incomplete_but_scored_outcome_count": 3
      },
      "interpretation": "This score is based on 30 scored outcome(s), with 42% high-confidence data and 22% incomplete records across 94 evaluated outcome(s)."
    },
    "summary_interpretation": "This score is based on 30 scored outcome(s), with 42% high-confidence data and 22% incomplete records across 94 evaluated outcome(s)."
  }
}
```

## UI Guidance

Future UI controls should present confidence filtering as a view/filter, not a different scoring model. Low-confidence outcomes remain in the dataset and should remain inspectable for audit and source-completion work.

The trust layer is observability only. It does not change base outcome component score math; it only exposes confidence and completeness context and supports optional filtered views.
