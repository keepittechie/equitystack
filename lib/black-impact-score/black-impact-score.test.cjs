const test = require("node:test");
const assert = require("node:assert/strict");
const jiti = require("jiti")(__filename);

const {
  computeOutcomeScore,
  isOutcomeScoringReady,
} = jiti("./outcomeScoring.js");
const { computePromiseFromOutcomes } = jiti("./promiseRollup.js");
const { aggregatePresidentFromOutcomes } = jiti("./presidentAggregation.js");
const { scorePromise } = jiti("../promise-tracker-scoring.js");

function buildOutcome(overrides = {}) {
  return {
    id: 1,
    outcome_summary: "Outcome summary",
    impact_direction: "Positive",
    evidence_strength: "high",
    source_count: 1,
    measurable_impact: "Measured public effect",
    black_community_impact_note: "Documented Black community impact",
    ...overrides,
  };
}

test("positive outcomes contribute positive scores", () => {
  const scored = computeOutcomeScore({
    outcome: buildOutcome(),
    source_count: 1,
    scoring_ready_outcome_count: 2,
  });

  assert.equal(scored.impact_direction, "Positive");
  assert.equal(scored.component_score, 1);
  assert.equal(scored.confidence_level, "high");
  assert.equal(scored.factors.scoring_ready, true);
});

test("negative outcomes contribute negative scores", () => {
  const scored = computeOutcomeScore({
    outcome: buildOutcome({
      impact_direction: "Negative",
      evidence_strength: "medium",
      black_community_impact_note: null,
    }),
    source_count: 1,
    scoring_ready_outcome_count: 1,
  });

  assert.equal(scored.impact_direction, "Negative");
  assert.equal(scored.component_score, -0.8);
  assert.equal(scored.confidence_level, "medium");
});

test("mixed outcomes remain neutral but scoring-ready", () => {
  const scored = computeOutcomeScore({
    outcome: buildOutcome({
      impact_direction: "Mixed",
      evidence_strength: "high",
    }),
    source_count: 1,
    scoring_ready_outcome_count: 1,
  });

  assert.equal(scored.component_score, 0);
  assert.equal(scored.factors.scoring_ready, true);
  assert.equal(scored.factors.mixed_handling, "temporary_neutral_todo");
  assert.match(scored.explanation, /conservative neutral score/i);
});

test("blocked outcomes remain neutral but scoring-ready", () => {
  const scored = computeOutcomeScore({
    outcome: buildOutcome({
      impact_direction: "Blocked",
      evidence_strength: "medium",
    }),
    source_count: 1,
    scoring_ready_outcome_count: 1,
  });

  assert.equal(scored.component_score, 0);
  assert.equal(scored.factors.scoring_ready, true);
  assert.equal(scored.factors.blocked_handling, "temporary_neutral_todo");
  assert.match(scored.explanation, /conservative neutral score/i);
});

test("outcomes without scoring-ready evidence are excluded from numeric scoring", () => {
  const withoutSource = computeOutcomeScore({
    outcome: buildOutcome({
      source_count: 0,
    }),
    source_count: 0,
    scoring_ready_outcome_count: 0,
  });
  const withoutDirection = computeOutcomeScore({
    outcome: buildOutcome({
      impact_direction: null,
    }),
    source_count: 1,
    scoring_ready_outcome_count: 0,
  });

  assert.equal(isOutcomeScoringReady({ outcome: buildOutcome(), source_count: 1 }), true);
  assert.equal(withoutSource.component_score, null);
  assert.equal(withoutSource.factors.scoring_ready, false);
  assert.equal(withoutSource.confidence_level, "low");
  assert.match(withoutSource.explanation, /excluded from numeric scoring/i);
  assert.equal(withoutDirection.component_score, null);
  assert.equal(withoutDirection.factors.scoring_ready, false);
});

test("confidence stays conservative when evidence is thin", () => {
  const lowEvidence = computeOutcomeScore({
    outcome: buildOutcome({
      evidence_strength: "low",
    }),
    source_count: 2,
    scoring_ready_outcome_count: 2,
  });
  const unspecifiedEvidence = computeOutcomeScore({
    outcome: buildOutcome({
      evidence_strength: null,
    }),
    source_count: 2,
    scoring_ready_outcome_count: 2,
  });

  assert.equal(lowEvidence.confidence_level, "low");
  assert.equal(unspecifiedEvidence.confidence_level, "medium");
});

test("promise rollup counts visible mixed and blocked outcomes without changing the total sign", () => {
  const positive = computeOutcomeScore({
    outcome: buildOutcome(),
    source_count: 1,
    scoring_ready_outcome_count: 3,
  });
  const mixed = computeOutcomeScore({
    outcome: buildOutcome({ id: 2, impact_direction: "Mixed" }),
    source_count: 1,
    scoring_ready_outcome_count: 3,
  });
  const blocked = computeOutcomeScore({
    outcome: buildOutcome({ id: 3, impact_direction: "Blocked" }),
    source_count: 1,
    scoring_ready_outcome_count: 3,
  });

  const promise = computePromiseFromOutcomes({
    promise: {
      id: 10,
      slug: "test-promise",
      title: "Test Promise",
      president: "Example President",
      president_slug: "example-president",
      president_party: "Independent",
      topic: "Voting Rights",
    },
    scored_outcomes: [positive, mixed, blocked],
  });

  assert.equal(promise.total_score, 1);
  assert.equal(promise.outcome_count, 3);
  assert.equal(promise.breakdown_by_direction.Positive, 1);
  assert.equal(promise.breakdown_by_direction.Mixed, 1);
  assert.equal(promise.breakdown_by_direction.Blocked, 1);
});

test("president rollup aggregates promise totals and normalizes by scored outcomes", () => {
  const presidents = aggregatePresidentFromOutcomes([
    {
      id: 1,
      title: "Positive Promise",
      president: "Example President",
      president_slug: "example-president",
      president_party: "Independent",
      topic: "Voting Rights",
      total_score: 1,
      outcome_count: 1,
      breakdown_by_direction: { Positive: 1 },
      breakdown_by_confidence: { high: 1 },
    },
    {
      id: 2,
      title: "Negative Promise",
      president: "Example President",
      president_slug: "example-president",
      president_party: "Independent",
      topic: "Housing",
      total_score: -0.8,
      outcome_count: 1,
      breakdown_by_direction: { Negative: 1 },
      breakdown_by_confidence: { medium: 1 },
    },
  ]);

  assert.equal(presidents.length, 1);
  assert.equal(presidents[0].raw_score_total, 0.2);
  assert.equal(presidents[0].normalized_score_total, 10);
  assert.equal(presidents[0].outcome_count, 2);
  assert.equal(presidents[0].breakdowns.by_direction.Positive, 1);
  assert.equal(presidents[0].breakdowns.by_direction.Negative, 1);
});

test("legacy promise-based scoring remains intact for fallback and comparison", () => {
  const scored = scorePromise({
    title: "Legacy Promise",
    relevance: "High",
    status: "Delivered",
    impact_direction_for_curation: "Positive",
  });

  assert.equal(scored.relevance_weight, 3);
  assert.equal(scored.raw_score, 6);
  assert.equal(scored.normalized_score, 1);
});
