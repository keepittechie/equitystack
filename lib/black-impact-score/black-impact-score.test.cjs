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
const {
  computeConfidence,
  filterOutcomesByConfidence,
  normalizeConfidenceFilter,
  summarizeConfidenceFilteredImpact,
  summarizeOutcomeConfidence,
} = jiti("./confidence.js");
const {
  computeDataCompleteness,
  summarizeOutcomeCompleteness,
} = jiti("./completeness.js");
const { computePromiseFromOutcomes } = jiti("./promiseRollup.js");
const { aggregatePresidentFromOutcomes } = jiti("./presidentAggregation.js");
const {
  applyCoverageDisplayScore,
  classifyScoreConfidence,
  coverageConfidenceFactor,
} = jiti("./coverageScaling.js");
const {
  buildJudicialAttribution,
  computeJudicialContribution,
} = jiti("./judicialAttribution.js");
const { buildPresidentComparison } = jiti("./presidentComparison.js");
const { buildPresidentImpactNarrative } = jiti("./presidentNarrative.js");
const { summarizeImpactTrend } = jiti("./impactTrend.js");
const {
  buildScoreSnapshotFromOutcomePayload,
  compareScoreSnapshots,
} = jiti("./scoreChange.js");
const {
  explainOutcomeScore,
  explainPolicyScore,
  summarizeScoreExplanations,
} = jiti("./scoreExplanations.js");
const {
  filterOutcomesByTrust,
  normalizeTrustFilter,
  summarizeTrustForOutcomes,
} = jiti("./trustLayer.js");
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
  assert.equal(withoutSource.completeness_label, "insufficient");
  assert.equal(withoutSource.insufficient_data, true);
  assert.match(withoutSource.explanation, /excluded from numeric scoring/i);
  assert.equal(withoutDirection.component_score, null);
  assert.equal(withoutDirection.factors.scoring_ready, false);
  assert.deepEqual(withoutDirection.factors.data_completeness.insufficient_data_reasons, [
    "missing_direction",
  ]);
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

test("data completeness labels complete, partial, and insufficient outcomes", () => {
  const complete = computeDataCompleteness({
    outcome: buildOutcome({
      evidence_strength: "Strong",
      source_count: 1,
      measurable_impact: "Measured",
      black_community_impact_note: "Community-specific note",
    }),
  });
  const partial = computeDataCompleteness({
    outcome: buildOutcome({
      evidence_strength: null,
      source_count: 1,
      measurable_impact: null,
      black_community_impact_note: null,
    }),
  });
  const insufficient = computeDataCompleteness({
    outcome: buildOutcome({
      outcome_summary: "",
      source_count: 0,
    }),
  });

  assert.equal(complete.data_completeness_score, 1);
  assert.equal(complete.completeness_label, "complete");
  assert.equal(partial.data_completeness_score, 0.6);
  assert.equal(partial.completeness_label, "partial");
  assert.equal(insufficient.completeness_label, "insufficient");
  assert.deepEqual(insufficient.insufficient_data_reasons, [
    "missing_summary",
    "missing_sources",
  ]);
});

test("outcome completeness summary reports missing-data distribution", () => {
  const scoredComplete = computeOutcomeScore({
    outcome: buildOutcome({ id: 1, promise_id: 10 }),
    source_count: 1,
    scoring_ready_outcome_count: 1,
  });
  const scoredInsufficient = computeOutcomeScore({
    outcome: buildOutcome({ id: 2, promise_id: 10, source_count: 0 }),
    source_count: 0,
    scoring_ready_outcome_count: 0,
  });
  const summary = summarizeOutcomeCompleteness([scoredComplete, scoredInsufficient]);

  assert.equal(summary.average_data_completeness_score, 0.9);
  assert.deepEqual(summary.completeness_distribution, {
    complete: 1,
    partial: 0,
    insufficient: 1,
  });
  assert.equal(summary.incomplete_outcome_count, 1);
  assert.equal(summary.incomplete_outcome_percentage, 0.5);
  assert.equal(summary.missing_field_counts.missing_sources, 1);
  assert.equal(summary.policies_with_highest_missing_data[0].policy_key, 10);
});

test("confidence filters support high, medium-plus, exclude-low, and numeric thresholds", () => {
  const outcomes = [
    { id: 1, component_score: 1, confidence_score: 0.91, confidence_label: "high" },
    { id: 2, component_score: -0.8, confidence_score: 0.62, confidence_label: "medium" },
    { id: 3, component_score: 0.6, confidence_score: 0.32, confidence_label: "low" },
  ];

  assert.deepEqual(
    filterOutcomesByConfidence(outcomes, "high").map((outcome) => outcome.id),
    [1]
  );
  assert.deepEqual(
    filterOutcomesByConfidence(outcomes, "medium_plus").map((outcome) => outcome.id),
    [1, 2]
  );
  assert.deepEqual(
    filterOutcomesByConfidence(outcomes, { confidence: "all" }).map(
      (outcome) => outcome.id
    ),
    [1, 2, 3]
  );
  assert.deepEqual(
    filterOutcomesByConfidence(outcomes, { include_low_confidence: false }).map(
      (outcome) => outcome.id
    ),
    [1, 2]
  );
  assert.deepEqual(
    filterOutcomesByConfidence(outcomes, { min_confidence: 0.7 }).map(
      (outcome) => outcome.id
    ),
    [1]
  );
  assert.deepEqual(normalizeConfidenceFilter("exclude_low"), {
    mode: "medium_plus",
    threshold: 0.45,
    include_low_confidence: false,
    requested_include_low_confidence: null,
    description:
      "Only outcomes with confidence_score >= 0.45 are included in the requested view.",
  });
});

test("confidence-filtered impact summary reports all-data and high-confidence variants", () => {
  const summary = summarizeConfidenceFilteredImpact(
    [
      { component_score: 1, confidence_score: 0.91, confidence_label: "high" },
      { component_score: -0.8, confidence_score: 0.62, confidence_label: "medium" },
      { component_score: 0.6, confidence_score: 0.32, confidence_label: "low" },
      { component_score: null, confidence_score: 0.9, confidence_label: "high" },
    ],
    "medium_plus"
  );

  assert.equal(summary.scored_outcomes_all_data, 3);
  assert.equal(summary.scored_outcomes_after_confidence_filter, 2);
  assert.equal(summary.scored_outcomes_excluded_by_confidence_filter, 1);
  assert.equal(summary.average_impact_score_all_data, 0.2667);
  assert.equal(summary.average_impact_score_filtered, 0.1);
  assert.equal(summary.average_impact_score_high_confidence_only, 1);
  assert.equal(summary.low_confidence_outcome_count, 1);
  assert.equal(summary.low_confidence_outcome_percentage, 0.3333);
});

test("trust layer reports confidence/completeness percentages and warnings", () => {
  const highComplete = computeOutcomeScore({
    outcome: buildOutcome({
      id: 1,
      evidence_strength: "Strong",
      source_quality_score: 1,
      source_quality_label: "high_authority",
    }),
    source_count: 1,
    scoring_ready_outcome_count: 2,
  });
  const lowHighImpact = computeOutcomeScore({
    outcome: buildOutcome({
      id: 2,
      evidence_strength: "Strong",
      measurable_impact: null,
      black_community_impact_note: null,
    }),
    source_count: 1,
    scoring_ready_outcome_count: 2,
  });
  lowHighImpact.confidence_score = 0.3;
  lowHighImpact.confidence_label = "low";

  const summary = summarizeTrustForOutcomes([highComplete, lowHighImpact]);

  assert.equal(summary.outcomes_evaluated_for_trust, 2);
  assert.equal(summary.high_confidence_outcome_percentage, 0.5);
  assert.equal(summary.low_confidence_outcome_percentage, 0.5);
  assert.equal(summary.incomplete_outcome_percentage, 0.5);
  assert.equal(summary.warnings.low_confidence_high_impact_outcome_count, 1);
  assert.equal(summary.warnings.incomplete_but_scored_outcome_count, 1);
  assert.match(summary.interpretation, /This score is based on 2 scored outcome/);
});

test("trust filtering can exclude incomplete scored outcomes without changing defaults", () => {
  const complete = computeOutcomeScore({
    outcome: buildOutcome({ id: 1 }),
    source_count: 1,
    scoring_ready_outcome_count: 2,
  });
  const partial = computeOutcomeScore({
    outcome: buildOutcome({
      id: 2,
      measurable_impact: null,
      black_community_impact_note: null,
    }),
    source_count: 1,
    scoring_ready_outcome_count: 2,
  });

  assert.deepEqual(normalizeTrustFilter({ exclude_incomplete: "true" }), {
    exclude_incomplete: true,
    description: "Incomplete outcomes are excluded from the requested view.",
  });
  assert.equal(filterOutcomesByTrust([complete, partial]).length, 2);
  assert.deepEqual(
    filterOutcomesByTrust([complete, partial], { exclude_incomplete: true }).map(
      (outcome) => outcome.outcome.id
    ),
    [1]
  );
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

test("outcome score explanations mirror existing score factors without recalculating", () => {
  const scored = computeOutcomeScore({
    outcome: buildOutcome({
      impact_direction: "Negative",
      evidence_strength: "Moderate",
      source_quality_score: 1,
      source_quality_label: "high_authority",
    }),
    source_count: 1,
    scoring_ready_outcome_count: 1,
  });
  const explanation = explainOutcomeScore(scored);

  assert.equal(scored.component_score, -0.8);
  assert.equal(explanation.entity_type, "outcome");
  assert.equal(explanation.base_score, -1);
  assert.equal(explanation.modifiers.impact_direction.value, "Negative");
  assert.equal(explanation.modifiers.evidence_strength.value, "medium");
  assert.equal(explanation.modifiers.evidence_strength.multiplier, 0.8);
  assert.equal(explanation.modifiers.source_count, 1);
  assert.equal(explanation.modifiers.confidence.score, scored.confidence_score);
  assert.equal(explanation.final_score, scored.component_score);
});

test("policy score explanations support outcome rollups and historical policy scores", () => {
  const positive = computeOutcomeScore({
    outcome: buildOutcome(),
    source_count: 1,
    scoring_ready_outcome_count: 2,
  });
  const negative = computeOutcomeScore({
    outcome: buildOutcome({ id: 2, impact_direction: "Negative", evidence_strength: "medium" }),
    source_count: 1,
    scoring_ready_outcome_count: 2,
  });
  const promise = computePromiseFromOutcomes({
    promise: {
      id: 10,
      slug: "test-promise",
      title: "Test Promise",
    },
    scored_outcomes: [positive, negative],
  });
  const rollupExplanation = explainPolicyScore(promise);
  const historicalExplanation = explainPolicyScore({
    id: 99,
    title: "Historical Policy",
    impact_direction: "Negative",
    directness_score: 2,
    material_impact_score: 3,
    evidence_score: 2,
    durability_score: 1,
    equity_score: 2,
    harm_offset_score: 1,
  });

  assert.equal(promise.total_score, 0.2);
  assert.equal(rollupExplanation.scoring_surface, "outcome_rollup");
  assert.equal(rollupExplanation.adjustments[0].operation, "sum(outcome.component_score)");
  assert.equal(rollupExplanation.final_score, 0.2);
  assert.deepEqual(rollupExplanation.modifiers.outcome_component_scores, [1, -0.8]);
  assert.equal(historicalExplanation.scoring_surface, "historical_policy");
  assert.equal(historicalExplanation.base_score, 16);
  assert.equal(historicalExplanation.modifiers.impact_direction.signed_weight, -1);
  assert.equal(historicalExplanation.adjustments[1].value, -16);
  assert.equal(historicalExplanation.final_score, 16);
});

test("score explanation summaries include samples and anomaly notes", () => {
  const highScoreLowConfidence = {
    id: 1,
    slug: "high-low",
    title: "High score low confidence",
    total_score: 1,
    outcome_count: 1,
    scored_outcomes: [
      {
        component_score: 1,
        confidence_score: 0.3,
        confidence_label: "low",
        impact_direction: "Positive",
        factors: { scoring_ready: true },
      },
    ],
  };
  const lowScoreHighConfidence = {
    id: 2,
    slug: "low-high",
    title: "Low score high confidence",
    total_score: -0.2,
    outcome_count: 1,
    scored_outcomes: [
      {
        component_score: -0.2,
        confidence_score: 0.9,
        confidence_label: "high",
        impact_direction: "Negative",
        factors: { scoring_ready: true },
      },
    ],
  };
  const summary = summarizeScoreExplanations(
    [lowScoreHighConfidence, highScoreLowConfidence],
    { limit: 1 }
  );

  assert.equal(summary.sample_limit, 1);
  assert.equal(summary.top_scoring_policy_explanations.length, 1);
  assert.equal(summary.bottom_scoring_policy_explanations.length, 1);
  assert.equal(summary.anomalies.length, 1);
  assert.equal(summary.anomalies[0].record_key, "high-low");
  assert.equal(summary.anomalies[0].reason, "High absolute score with low average confidence.");
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
  assert.equal(presidents[0].direct_raw_score, 0.2);
  assert.equal(presidents[0].direct_normalized_score, 10);
  assert.equal(presidents[0].systemic_raw_score, 0);
  assert.equal(presidents[0].systemic_outcome_count, 0);
  assert.equal(presidents[0].combined_context_score, 0.2);
  assert.equal(presidents[0].primary_score_family, "direct");
  assert.equal(presidents[0].score_confidence, "VERY LOW");
  assert.equal(presidents[0].score_confidence_basis, 2);
  assert.equal(presidents[0].display_score_total, 4.77);
  assert.match(presidents[0].low_coverage_warning, /extremely limited data/i);
  assert.equal(presidents[0].outcome_count, 2);
  assert.equal(presidents[0].breakdowns.by_direction.Positive, 1);
  assert.equal(presidents[0].breakdowns.by_direction.Negative, 1);
  assert.match(presidents[0].narrative_summary, /Example President shows a mixed impact profile/);
  assert.match(presidents[0].confidence_statement, /VERY LOW based on 2 outcomes/);
  assert.ok(presidents[0].key_strengths.some((line) => line.includes("Voting Rights")));
  assert.ok(presidents[0].key_weaknesses.some((line) => line.includes("Housing")));
});

test("president narrative summarizes strengths, weaknesses, and confidence", () => {
  const narrative = buildPresidentImpactNarrative({
    president: "President Narrative",
    normalized_score_total: 12,
    outcome_count: 6,
    score_confidence: "MEDIUM",
    counts_by_direction: { Positive: 4, Negative: 2 },
    score_by_topic: [
      { topic: "Housing", raw_score_total: 6 },
      { topic: "Criminal Justice", raw_score_total: -3 },
    ],
    top_positive_promises: [{ title: "Housing driver", topic: "Housing" }],
    top_negative_promises: [{ title: "Criminal justice driver", topic: "Criminal Justice" }],
  });

  assert.match(narrative.summary_paragraph, /President Narrative shows a net positive impact profile/);
  assert.match(narrative.summary_paragraph, /positive contributions in Housing/);
  assert.match(narrative.summary_paragraph, /negative outcomes in Criminal Justice/);
  assert.deepEqual(narrative.key_strengths, [
    "Positive contributions are strongest in Housing.",
  ]);
  assert.deepEqual(narrative.key_weaknesses, [
    "Negative contributions are most visible in Criminal Justice.",
  ]);
  assert.equal(narrative.confidence_statement, "Score confidence is MEDIUM based on 6 outcomes.");
});

test("coverage scaling dampens low-sample display scores without changing raw normalized scores", () => {
  const oneOutcome = applyCoverageDisplayScore(100, 1);
  const manyOutcomes = applyCoverageDisplayScore(100, 25);

  assert.equal(classifyScoreConfidence(1), "VERY LOW");
  assert.equal(classifyScoreConfidence(4), "LOW");
  assert.equal(classifyScoreConfidence(12), "MEDIUM");
  assert.equal(classifyScoreConfidence(16), "HIGH");
  assert.equal(coverageConfidenceFactor(1), 0.301);
  assert.equal(oneOutcome.display_score, 30.1);
  assert.equal(oneOutcome.score_confidence, "VERY LOW");
  assert.equal(manyOutcomes.display_score, 100);
  assert.equal(manyOutcomes.score_confidence, "HIGH");
});

test("judicial attribution splits mixed appointing presidents by majority justice share", () => {
  const attributions = buildJudicialAttribution({
    majority_justices: [
      { name: "Justice A", appointing_president: "President One" },
      { name: "Justice B", appointing_president: "President One" },
      { name: "Justice C", appointing_president: "President Two" },
      { name: "Justice D", appointing_president: "President Two" },
      { name: "Justice E", appointing_president: "President Two" },
      { name: "Justice F", appointing_president: "President Three" },
    ],
  });

  const presidentTwo = attributions.find((entry) => entry.president_name === "President Two");

  assert.equal(attributions.length, 3);
  assert.equal(presidentTwo.attribution_fraction, 0.5);
  assert.deepEqual(presidentTwo.contributing_justices, ["Justice C", "Justice D", "Justice E"]);
  assert.equal(
    computeJudicialContribution({
      outcome_score: 10,
      attribution_fraction: presidentTwo.attribution_fraction,
      judicial_weight: 0.5,
    }),
    2.5
  );
});

test("president comparison summarizes score, topic, direction, and confidence differences", () => {
  const comparison = buildPresidentComparison(
    [
      {
        president_id: 1,
        president: "President A",
        president_slug: "president-a",
        direct_normalized_score: 40,
        systemic_normalized_score: 5,
        direct_raw_score: 4,
        systemic_raw_score: 0.5,
        direct_outcome_count: 10,
        systemic_outcome_count: 1,
        direct_score_confidence: "MEDIUM",
        systemic_score_confidence: "VERY LOW",
        counts_by_direction: { Positive: 8, Negative: 2 },
        score_by_topic: [
          { topic: "Housing", raw_score_total: 3 },
          { topic: "Criminal Justice", raw_score_total: -1 },
        ],
      },
      {
        president_id: 2,
        president: "President B",
        president_slug: "president-b",
        direct_normalized_score: 15,
        systemic_normalized_score: 0,
        direct_raw_score: 1.5,
        systemic_raw_score: 0,
        direct_outcome_count: 5,
        systemic_outcome_count: 0,
        direct_score_confidence: "LOW",
        systemic_score_confidence: "VERY LOW",
        counts_by_direction: { Positive: 1, Negative: 4 },
        score_by_topic: [
          { topic: "Housing", raw_score_total: 0.5 },
          { topic: "Criminal Justice", raw_score_total: -3 },
        ],
      },
    ],
    ["president-a", "president-b"]
  );

  assert.equal(comparison.comparison_ready, true);
  assert.equal(comparison.compared_presidents.length, 2);
  assert.equal(comparison.score_difference.direct_normalized_score_difference, 25);
  assert.equal(comparison.score_difference.systemic_normalized_score_difference, 5);
  assert.equal(comparison.strongest_topic_difference.topic, "Housing");
  assert.match(comparison.directional_contrast_summary, /President A has more positive/);
  assert.match(comparison.directional_contrast_summary, /President B has more negative/);
});

test("impact trend groups dated outcomes by year and summarizes direction", () => {
  const trend = summarizeImpactTrend([
    {
      component_score: -1,
      impact_direction: "Negative",
      topic: "Criminal Justice",
      outcome: { impact_start_date: "2014-01-01" },
    },
    {
      component_score: 2,
      impact_direction: "Positive",
      topic: "Housing",
      outcome: { impact_start_date: "2016-01-01" },
    },
    {
      component_score: 1,
      impact_direction: "Positive",
      topic: "Housing",
      outcome: { impact_start_date: "2017-01-01" },
    },
    {
      component_score: 1,
      impact_direction: "Positive",
      topic: "Education",
      outcome: { impact_start_date: null },
    },
  ]);

  assert.equal(trend.score_by_year.length, 3);
  assert.equal(trend.cumulative_score, 2);
  assert.equal(trend.trend_direction, "improving");
  assert.equal(trend.dated_outcome_count, 3);
  assert.equal(trend.undated_outcome_count, 1);
  assert.equal(trend.strongest_shift.year, 2016);
  assert.match(trend.interpretation, /Impact improved after 2014/);
});

test("score change explains deltas from a prior snapshot", () => {
  const current = buildScoreSnapshotFromOutcomePayload({
    presidents: [{ raw_score_total: 3, normalized_score_total: 60, outcome_count: 2 }],
    records: [
      {
        topic: "Criminal Justice",
        total_score: -2,
        scored_outcomes: [{ outcome: { id: 1 } }, { outcome: { id: 2 } }],
      },
      {
        topic: "Housing",
        total_score: 5,
        scored_outcomes: [{ outcome: { id: 3 } }],
      },
    ],
  });
  const change = compareScoreSnapshots(current, {
    total_score: 5,
    outcome_count: 2,
    topic_scores: { "Criminal Justice": 0, Housing: 5 },
    outcome_ids: [1, 2],
    created_at: "2026-04-01T00:00:00Z",
  });

  assert.equal(current.total_score, 3);
  assert.equal(change.delta_score, -2);
  assert.equal(change.new_outcomes_added, 1);
  assert.equal(change.strongest_topic_change.topic, "Criminal Justice");
  assert.match(change.change_summary, /Score decreased/);
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
