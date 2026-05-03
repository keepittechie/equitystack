function safeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function round4(value) {
  return Number(safeNumber(value).toFixed(4));
}

function round2(value) {
  return Number(safeNumber(value).toFixed(2));
}

function confidenceScoreFor(entry = {}) {
  const score = Number(entry.confidence_score);
  if (Number.isFinite(score)) {
    return score;
  }

  if (entry.confidence_label === "high" || entry.confidence_level === "high") return 0.75;
  if (entry.confidence_label === "medium" || entry.confidence_level === "medium") return 0.45;
  return 0;
}

function average(values = []) {
  const numericValues = values.map(Number).filter(Number.isFinite);
  if (!numericValues.length) {
    return 0;
  }

  return round4(numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length);
}

function hasHistoricalPolicyScoreFields(policy = {}) {
  return [
    "directness_score",
    "material_impact_score",
    "evidence_score",
    "durability_score",
    "equity_score",
    "harm_offset_score",
  ].some((field) => policy[field] != null);
}

function directionWeight(direction) {
  if (direction === "Positive") return 1;
  if (direction === "Negative") return -1;
  return 0;
}

export function explainOutcomeScore(scoredOutcome = {}) {
  const factors = scoredOutcome.factors || {};
  const confidenceFactors = factors.confidence_factors || {};
  const baseScore = safeNumber(factors.base_score, 0);
  const evidenceMultiplier = safeNumber(factors.evidence_multiplier, 1);
  const finalScore =
    typeof scoredOutcome.component_score === "number"
      ? scoredOutcome.component_score
      : null;
  const scoringReady = factors.scoring_ready === true;
  const notes = [];

  if (!scoringReady) {
    notes.push(scoredOutcome.explanation || "Outcome is not scoring-ready.");
  }

  if (scoredOutcome.impact_direction === "Mixed") {
    notes.push("Mixed outcomes are currently neutral under the existing scoring formula.");
  }

  if (scoredOutcome.impact_direction === "Blocked") {
    notes.push("Blocked outcomes are currently neutral under the existing scoring formula.");
  }

  return {
    entity_type: "outcome",
    outcome_id: scoredOutcome.outcome?.id ?? scoredOutcome.id ?? null,
    base_score: baseScore,
    modifiers: {
      impact_direction: {
        value: scoredOutcome.impact_direction ?? scoredOutcome.outcome?.impact_direction ?? null,
        contribution: baseScore,
      },
      evidence_strength: {
        value: factors.evidence_strength ?? scoredOutcome.outcome?.evidence_strength ?? null,
        multiplier: evidenceMultiplier,
      },
      source_count: factors.source_count ?? scoredOutcome.outcome?.source_count ?? 0,
      source_quality: {
        label:
          scoredOutcome.outcome?.source_quality_label ??
          confidenceFactors.source_quality_label ??
          null,
        score:
          scoredOutcome.outcome?.source_quality_score ??
          confidenceFactors.source_quality_score ??
          null,
      },
      confidence: {
        score: scoredOutcome.confidence_score ?? null,
        label: scoredOutcome.confidence_label ?? scoredOutcome.confidence_level ?? null,
      },
    },
    adjustments: [
      {
        name: "evidence_strength_multiplier",
        operation: "base_score * evidence_multiplier",
        value: evidenceMultiplier,
      },
      {
        name: "scoring_readiness",
        operation: scoringReady ? "included" : "excluded",
        value: scoringReady,
      },
    ],
    final_score: finalScore,
    notes,
  };
}

function explainOutcomeRollupPolicy(policy = {}) {
  const outcomes = Array.isArray(policy.scored_outcomes) ? policy.scored_outcomes : [];
  const componentScores = outcomes
    .map((outcome) => outcome.component_score)
    .filter((score) => typeof score === "number");
  const confidenceScores = outcomes.map(confidenceScoreFor);

  return {
    entity_type: "policy",
    scoring_surface: "outcome_rollup",
    policy_id: policy.id ?? policy.promise_id ?? null,
    record_key: policy.slug ?? policy.record_key ?? null,
    title: policy.title ?? null,
    base_score: 0,
    modifiers: {
      outcome_count: policy.outcome_count ?? outcomes.length,
      impact_direction_counts: policy.breakdown_by_direction || {},
      confidence_counts: policy.breakdown_by_confidence || {},
      average_confidence_score: average(confidenceScores),
      outcome_component_scores: componentScores.map(round2),
    },
    adjustments: [
      {
        name: "sum_scored_outcomes",
        operation: "sum(outcome.component_score)",
        value: round2(componentScores.reduce((sum, score) => sum + score, 0)),
      },
    ],
    final_score: round2(policy.total_score),
    notes: [
      policy.explanation_summary ||
        "Policy score is the sum of already-scored outcome components.",
    ],
  };
}

function explainHistoricalPolicyScore(policy = {}) {
  const directness = safeNumber(policy.directness_score);
  const material = safeNumber(policy.material_impact_score);
  const evidence = safeNumber(policy.evidence_score);
  const durability = safeNumber(policy.durability_score);
  const equity = safeNumber(policy.equity_score);
  const harmOffset = safeNumber(policy.harm_offset_score);
  const unsignedScore = round2(
    directness * 2 + material * 2 + evidence + durability + equity * 2 - harmOffset
  );
  const weight = directionWeight(policy.impact_direction);

  return {
    entity_type: "policy",
    scoring_surface: "historical_policy",
    policy_id: policy.id ?? null,
    record_key: policy.slug ?? policy.record_key ?? null,
    title: policy.title ?? null,
    base_score: unsignedScore,
    modifiers: {
      directness: { value: directness, weight: 2, contribution: round2(directness * 2) },
      material_impact: { value: material, weight: 2, contribution: round2(material * 2) },
      evidence: { value: evidence, weight: 1, contribution: evidence },
      durability: { value: durability, weight: 1, contribution: durability },
      equity: { value: equity, weight: 2, contribution: round2(equity * 2) },
      harm_offset: { value: harmOffset, weight: -1, contribution: round2(-harmOffset) },
      impact_direction: {
        value: policy.impact_direction ?? null,
        signed_weight: weight,
      },
    },
    adjustments: [
      {
        name: "historical_policy_formula",
        operation:
          "directness*2 + material_impact*2 + evidence + durability + equity*2 - harm_offset",
        value: unsignedScore,
      },
      {
        name: "weighted_impact_direction",
        operation: "policy_impact_score * direction_weight",
        value: round2(unsignedScore * weight),
      },
    ],
    final_score: round2(policy.policy_impact_score ?? policy.impact_score ?? unsignedScore),
    notes: [
      "Historical policy explanation mirrors the existing report formula; it does not alter score values.",
    ],
  };
}

export function explainPolicyScore(policy = {}) {
  if (hasHistoricalPolicyScoreFields(policy)) {
    return explainHistoricalPolicyScore(policy);
  }

  return explainOutcomeRollupPolicy(policy);
}

function sortByAbsoluteScore(records = [], direction = "desc") {
  return [...records].sort((left, right) => {
    const leftScore = Math.abs(safeNumber(left.total_score ?? left.raw_score_total));
    const rightScore = Math.abs(safeNumber(right.total_score ?? right.raw_score_total));
    return direction === "desc" ? rightScore - leftScore : leftScore - rightScore;
  });
}

function policyAverageConfidence(policy = {}) {
  const outcomes = Array.isArray(policy.scored_outcomes) ? policy.scored_outcomes : [];
  return average(outcomes.map(confidenceScoreFor));
}

export function summarizeScoreExplanations(policies = [], options = {}) {
  const limit = Math.max(1, Math.min(20, Math.floor(Number(options.limit) || 5)));
  const rows = Array.isArray(policies) ? policies : [];
  const topPolicies = sortByAbsoluteScore(rows, "desc").slice(0, limit);
  const bottomPolicies = sortByAbsoluteScore(rows, "asc").slice(0, limit);
  const anomalies = rows
    .map((policy) => ({
      policy,
      absolute_score: Math.abs(safeNumber(policy.total_score ?? policy.raw_score_total)),
      average_confidence_score: policyAverageConfidence(policy),
    }))
    .filter(
      (entry) =>
        entry.absolute_score >= 0.8 &&
        entry.average_confidence_score > 0 &&
        entry.average_confidence_score < 0.45
    )
    .sort((left, right) => right.absolute_score - left.absolute_score)
    .slice(0, limit)
    .map((entry) => ({
      policy_id: entry.policy.id ?? null,
      record_key: entry.policy.slug ?? entry.policy.record_key ?? null,
      title: entry.policy.title ?? null,
      total_score: round2(entry.policy.total_score),
      average_confidence_score: entry.average_confidence_score,
      reason: "High absolute score with low average confidence.",
    }));

  return {
    sample_limit: limit,
    top_scoring_policy_explanations: topPolicies.map(explainPolicyScore),
    bottom_scoring_policy_explanations: bottomPolicies.map(explainPolicyScore),
    anomalies,
  };
}
