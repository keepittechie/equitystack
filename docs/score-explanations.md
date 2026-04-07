# Score Explanations

Score explanations are additive debugging metadata. They do not change impact scoring formulas, confidence scoring, or final score values.

## Helpers

```js
explainOutcomeScore(scoredOutcome)
explainPolicyScore(policy)
summarizeScoreExplanations(policies, { limit: 5 })
```

The structured explanation format is:

```json
{
  "base_score": 1,
  "modifiers": {
    "impact_direction": { "value": "Positive", "contribution": 1 },
    "evidence_strength": { "value": "high", "multiplier": 1 },
    "source_count": 1,
    "source_quality": { "label": "high_authority", "score": 1 },
    "confidence": { "score": 0.8, "label": "high" }
  },
  "adjustments": [],
  "final_score": 1,
  "notes": []
}
```

## API Debug Mode

The promise score API can include sample explanations on demand:

```text
/api/promises/scores?model=outcome&debug=explanations
```

Equivalent:

```text
/api/promises/scores?model=outcome&score_explanations=true
```

The response adds:

```json
{
  "metadata": {
    "score_explanations": {
      "top_scoring_policy_explanations": [],
      "bottom_scoring_policy_explanations": [],
      "anomalies": []
    }
  }
}
```

Anomalies currently flag high absolute policy scores with low average outcome confidence. Future UI can surface these as review prompts without changing score values.
