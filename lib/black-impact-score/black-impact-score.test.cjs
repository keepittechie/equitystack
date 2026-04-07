/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const jiti = require("jiti")(__filename);

const {
  computeOutcomeScore,
  isOutcomeScoringReady,
} = jiti("./outcomeScoring.js");
const {
  normalizeEvidenceStrength,
  summarizeEvidenceStrengthNormalization,
} = jiti("./evidenceStrength.js");
const { computeConfidence, summarizeOutcomeConfidence } = jiti("./confidence.js");
const { computePromiseFromOutcomes } = jiti("./promiseRollup.js");
const { aggregatePresidentFromOutcomes } = jiti("./presidentAggregation.js");
const { scorePromise } = jiti("../promise-tracker-scoring.js");
const { buildOutcomeCoverageMetadata } = jiti("./outcomeCoverage.js");
const {
  classifySourceQuality,
  summarizeSourceQuality,
  summarizeSourceQualityDistribution,
} = jiti("../sourceQuality.js");

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

test("production evidence-strength labels normalize before weighting", () => {
  const strong = computeOutcomeScore({
    outcome: buildOutcome({ evidence_strength: "Strong" }),
    source_count: 1,
    scoring_ready_outcome_count: 1,
  });
  const moderate = computeOutcomeScore({
    outcome: buildOutcome({
      impact_direction: "Negative",
      evidence_strength: "Moderate",
      black_community_impact_note: null,
    }),
    source_count: 1,
    scoring_ready_outcome_count: 1,
  });
  const weak = computeOutcomeScore({
    outcome: buildOutcome({ evidence_strength: "Weak" }),
    source_count: 1,
    scoring_ready_outcome_count: 1,
  });

  assert.equal(normalizeEvidenceStrength("Strong"), "high");
  assert.equal(normalizeEvidenceStrength("Moderate"), "medium");
  assert.equal(normalizeEvidenceStrength("Weak"), "low");
  assert.equal(normalizeEvidenceStrength("high"), "high");
  assert.equal(normalizeEvidenceStrength("medium"), "medium");
  assert.equal(normalizeEvidenceStrength("low"), "low");
  assert.equal(normalizeEvidenceStrength("Limited"), "low");
  assert.equal(normalizeEvidenceStrength("unknown"), null);
  assert.equal(strong.component_score, 1);
  assert.equal(strong.factors.evidence_strength, "high");
  assert.equal(strong.factors.evidence_multiplier, 1);
  assert.equal(moderate.component_score, -0.8);
  assert.equal(moderate.factors.evidence_strength, "medium");
  assert.equal(moderate.factors.evidence_multiplier, 0.8);
  assert.equal(weak.component_score, 0.6);
  assert.equal(weak.factors.evidence_strength, "low");
  assert.equal(weak.factors.evidence_multiplier, 0.6);
  assert.deepEqual(
    summarizeEvidenceStrengthNormalization(["Strong", "Moderate", "Weak", "Limited", "???", null]),
    { low: 2, medium: 1, high: 1, unknown: 1 }
  );
});

test("outcome coverage metadata reports inclusion and exclusion reasons", () => {
  const coverage = buildOutcomeCoverageMetadata([
    buildOutcome({ id: 1, source_count: 1 }),
    buildOutcome({ id: 2, source_count: 0 }),
    buildOutcome({ id: 3, impact_direction: null, source_count: 1 }),
    buildOutcome({ id: 4, outcome_summary: "", source_count: 1 }),
  ]);

  assert.deepEqual(coverage, {
    total_outcomes_available: 4,
    outcomes_included_in_score: 1,
    outcomes_excluded_from_score: 3,
    excluded_due_to_missing_sources: 1,
    excluded_due_to_missing_direction: 1,
    excluded_due_to_missing_summary: 1,
    excluded_due_to_low_confidence_or_status: 0,
  });
});

test("source quality normalizes official, institutional, secondary, and low sources", () => {
  const congress = classifySourceQuality({
    source_url: "https://www.congress.gov/bill/116th-congress/senate-bill/461/text",
    source_type: "Government",
    publisher: "Congress.gov",
  });
  const universityArchive = classifySourceQuality({
    source_url: "https://www.presidency.ucsb.edu/documents/example",
    source_type: "Archive",
    publisher: "The American Presidency Project",
  });
  const journalism = classifySourceQuality({
    source_url: "https://www.reuters.com/world/us/example",
    source_type: "News",
    publisher: "Reuters",
  });
  const campaign = classifySourceQuality({
    source_url: "https://www.example-campaign.com/policy",
    source_type: "Other",
    publisher: "Campaign Site",
  });

  assert.equal(congress.source_quality_label, "high_authority");
  assert.equal(congress.source_quality_score, 1);
  assert.equal(universityArchive.source_quality_label, "institutional");
  assert.equal(universityArchive.source_quality_score, 0.8);
  assert.equal(journalism.source_quality_label, "secondary");
  assert.equal(journalism.source_quality_score, 0.55);
  assert.equal(campaign.source_quality_label, "low_unverified");
  assert.equal(campaign.source_quality_score, 0.25);

  const summary = summarizeSourceQuality([
    { source_url: "https://www.justice.gov/crt/example", source_type: "Government" },
    { source_url: "https://www.reuters.com/world/us/example", source_type: "News" },
  ]);
  assert.equal(summary.source_quality_label, "high_authority");
  assert.equal(summary.high_authority_source_count, 1);
  assert.equal(summary.secondary_source_count, 1);

  assert.deepEqual(
    summarizeSourceQualityDistribution([
      summary,
      summarizeSourceQuality([{ source_url: "https://example.com", source_type: "Other" }]),
    ]),
    {
      tier_counts: {
        high_authority: 1,
        institutional: 0,
        secondary: 1,
        low_unverified: 1,
      },
      outcomes_with_any_sources: 2,
      outcomes_with_high_authority_sources: 1,
      pct_outcomes_with_high_authority_sources: 0.5,
    }
  );
});

test("unified outcome confidence is explainable and additive", () => {
  const highConfidence = computeConfidence({
    outcome: buildOutcome({
      evidence_strength: "Strong",
      source_count: 2,
      source_quality_score: 1,
      source_quality_label: "high_authority",
    }),
  });
  const lowConfidence = computeConfidence({
    outcome: buildOutcome({
      evidence_strength: "Weak",
      source_count: 0,
      source_quality_score: 1,
      source_quality_label: "high_authority",
    }),
  });
  const scored = computeOutcomeScore({
    outcome: buildOutcome({
      evidence_strength: "Moderate",
      source_count: 1,
      source_quality_score: 1,
      source_quality_label: "high_authority",
    }),
    source_count: 1,
    scoring_ready_outcome_count: 1,
  });

  assert.equal(highConfidence.confidence_score, 0.95);
  assert.equal(highConfidence.confidence_label, "high");
  assert.equal(highConfidence.confidence_factors.evidence_strength, "high");
  assert.equal(highConfidence.confidence_factors.source_quality_label, "high_authority");
  assert.equal(lowConfidence.confidence_score, 0.3575);
  assert.equal(lowConfidence.confidence_label, "low");
  assert.equal(scored.component_score, 0.8);
  assert.equal(scored.confidence_score, 0.8025);
  assert.equal(scored.confidence_label, "high");
  assert.equal(scored.factors.confidence_factors.source_quality_score, 1);
});

test("confidence summary reports distribution and score comparison", () => {
  const summary = summarizeOutcomeConfidence([
    {
      impact_direction: "Positive",
      component_score: 1,
      confidence_score: 0.95,
      confidence_label: "high",
      factors: { scoring_ready: true },
    },
    {
      impact_direction: null,
      component_score: null,
      confidence_score: 0.4,
      confidence_label: "low",
      factors: { scoring_ready: false },
    },
  ]);

  assert.equal(summary.average_confidence_score, 0.675);
  assert.deepEqual(summary.confidence_distribution, { high: 1, medium: 0, low: 1 });
  assert.equal(summary.confidence_by_scoring_readiness.scoring_ready.count, 1);
  assert.equal(summary.confidence_by_scoring_readiness.excluded_from_score.count, 1);
  assert.equal(summary.confidence_vs_impact_score.Positive.average_component_score, 1);
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
