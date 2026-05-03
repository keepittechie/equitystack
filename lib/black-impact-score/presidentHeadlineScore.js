import { applyCoverageDisplayScore } from "./coverageScaling.js";

const SPARSE_CONFIDENCE_WEIGHTS = {
  HIGH: 1,
  MEDIUM: 1,
  LOW: 0.58,
  "VERY LOW": 0.4,
};

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function roundScore(value, digits = 2) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Number(numeric.toFixed(digits));
}

function normalizeConfidenceLabel(value) {
  const text = typeof value === "string" ? value.trim().toUpperCase() : "";
  return SPARSE_CONFIDENCE_WEIGHTS[text] ? text : null;
}

export function getSparseConfidenceWeight(label) {
  const normalized = normalizeConfidenceLabel(label);
  return SPARSE_CONFIDENCE_WEIGHTS[normalized || "HIGH"];
}

export function computePresidentHeadlineScore({
  normalizedScoreTotal,
  outcomeCount,
  scoreConfidence = null,
} = {}) {
  // Public president ranking should answer "overall documented record," not
  // "cleanest average on the fewest records." Start with the coverage-adjusted
  // score, then damp sparse LOW/VERY LOW confidence records further so thin
  // historical coverage cannot outrank fuller evidence solely on a neat mean.
  const coverageAdjusted = applyCoverageDisplayScore(
    toFiniteNumber(normalizedScoreTotal),
    toFiniteNumber(outcomeCount)
  );
  const resolvedConfidence =
    normalizeConfidenceLabel(scoreConfidence) || coverageAdjusted.score_confidence || "HIGH";
  const sparseConfidenceWeight = getSparseConfidenceWeight(resolvedConfidence);
  const headlineScore = roundScore(coverageAdjusted.display_score * sparseConfidenceWeight);

  return {
    headline_score: headlineScore,
    coverage_adjusted_score: coverageAdjusted.display_score,
    score_confidence: coverageAdjusted.score_confidence,
    score_confidence_factor: coverageAdjusted.score_confidence_factor,
    score_confidence_basis: coverageAdjusted.score_confidence_basis,
    low_coverage_warning: coverageAdjusted.low_coverage_warning,
    sparse_confidence_weight: sparseConfidenceWeight,
    sparse_penalty_applied: sparseConfidenceWeight < 1,
    ranking_method: "coverage_adjusted_sparse_penalty_v1",
  };
}

export function getPresidentHeadlineScoreValue(president = {}) {
  const existingHeadline = toFiniteNumber(
    president.overall_ranking_score ??
      president.ranking_score_total ??
      president.headline_score ??
      president.score,
    NaN
  );

  if (Number.isFinite(existingHeadline)) {
    return existingHeadline;
  }

  return computePresidentHeadlineScore({
    normalizedScoreTotal:
      president.normalized_score_total ??
      president.normalized_score ??
      president.direct_normalized_score,
    outcomeCount: president.outcome_count ?? president.direct_outcome_count,
    scoreConfidence: president.score_confidence ?? president.direct_score_confidence,
  }).headline_score;
}

export function sortPresidentsByHeadlineScore(presidents = []) {
  return [...presidents].sort((left, right) => {
    const scoreDiff =
      getPresidentHeadlineScoreValue(right) - getPresidentHeadlineScoreValue(left);

    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    const outcomeDiff =
      toFiniteNumber(right.outcome_count ?? right.direct_outcome_count) -
      toFiniteNumber(left.outcome_count ?? left.direct_outcome_count);

    if (outcomeDiff !== 0) {
      return outcomeDiff;
    }

    return String(
      left.name || left.president || left.president_name || ""
    ).localeCompare(String(right.name || right.president || right.president_name || ""));
  });
}
