const SCORE_CONFIDENCE_LABELS = [
  { max: 2, label: "VERY LOW" },
  { max: 5, label: "LOW" },
  { max: 15, label: "MEDIUM" },
];
const HIGH_CONFIDENCE_MIN_OUTCOMES = 16;

function safeOutcomeCount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }

  return Math.floor(numeric);
}

export function coverageConfidenceFactor(outcomeCount) {
  const count = safeOutcomeCount(outcomeCount);
  if (count <= 0) {
    return 0;
  }

  // Keep the damping curve aligned with the confidence ladder so
  // MEDIUM-confidence presidents do not silently receive full coverage credit
  // before they cross into HIGH confidence. The factor reaches 1.0 at the
  // first HIGH-confidence count and stays there afterward.
  return Number(
    Math.min(1, Math.log(count + 1) / Math.log(HIGH_CONFIDENCE_MIN_OUTCOMES + 1)).toFixed(4)
  );
}

export function classifyScoreConfidence(outcomeCount) {
  const count = safeOutcomeCount(outcomeCount);
  const match = SCORE_CONFIDENCE_LABELS.find((entry) => count <= entry.max);
  return match?.label || "HIGH";
}

export function applyCoverageDisplayScore(score, outcomeCount) {
  const numericScore = Number(score);
  const factor = coverageConfidenceFactor(outcomeCount);

  return {
    display_score: Number.isFinite(numericScore) ? Number((numericScore * factor).toFixed(2)) : 0,
    score_confidence: classifyScoreConfidence(outcomeCount),
    score_confidence_factor: factor,
    score_confidence_basis: safeOutcomeCount(outcomeCount),
    low_coverage_warning:
      safeOutcomeCount(outcomeCount) <= 2
        ? "This score is based on extremely limited data and may not be representative."
        : null,
  };
}
