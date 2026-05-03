function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toSafeCount(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}

function normalizeConfidenceLabel(value) {
  const label = String(value || "").trim().toUpperCase();
  return label || "UNKNOWN";
}

function normalizeDirectionBreakdown(source = {}) {
  const input = source && typeof source === "object" ? source : {};

  return {
    Positive: toSafeCount(input.Positive ?? input.positive),
    Negative: toSafeCount(input.Negative ?? input.negative),
    Mixed: toSafeCount(input.Mixed ?? input.mixed),
    Blocked: toSafeCount(input.Blocked ?? input.blocked),
  };
}

function formatScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "N/A";
  }

  return numeric.toFixed(2);
}

function formatDirectionMixLabel(breakdown = {}) {
  return `Positive ${breakdown.Positive || 0} • Negative ${breakdown.Negative || 0} • Mixed ${breakdown.Mixed || 0} • Blocked ${breakdown.Blocked || 0}`;
}

function buildConfidenceBandDescription(confidenceLabel) {
  switch (normalizeConfidenceLabel(confidenceLabel)) {
    case "VERY LOW":
      return "1 to 2 scored outcomes";
    case "LOW":
      return "3 to 5 scored outcomes";
    case "MEDIUM":
      return "6 to 15 scored outcomes";
    case "HIGH":
      return "16 or more scored outcomes";
    default:
      return "confidence band unavailable";
  }
}

function buildPenaltyAppliedLabel({
  sparsePenaltyApplied,
  outcomeCount,
  confidenceLabel,
}) {
  if (sparsePenaltyApplied) {
    return `Yes: ${confidenceLabel} confidence with ${outcomeCount} scored outcomes`;
  }

  return "No: no extra low-coverage penalty";
}

function inferSparsePenaltyApplied({
  overallRankingScore,
  coverageAdjustedScore,
  scoreConfidence,
}) {
  const confidenceLabel = normalizeConfidenceLabel(scoreConfidence);

  if (confidenceLabel !== "LOW" && confidenceLabel !== "VERY LOW") {
    return false;
  }

  return Math.abs(overallRankingScore - coverageAdjustedScore) > 0.001;
}

export function buildPresidentRankExplanation(president = {}) {
  const outcomeCount = toSafeCount(
    president.direct_outcome_count ?? president.outcome_count
  );
  const directionBreakdown = normalizeDirectionBreakdown(
    president.direction_breakdown ?? president.counts_by_direction
  );
  const rawAverageScore = toFiniteNumber(
    president.raw_average_score ??
      president.normalized_score_total ??
      president.direct_normalized_score,
    0
  );
  const coverageAdjustedScore = toFiniteNumber(
    president.coverage_adjusted_score ??
      president.display_score ??
      rawAverageScore,
    rawAverageScore
  );
  const overallRankingScore = toFiniteNumber(
    president.overall_ranking_score ??
      president.ranking_score_total ??
      president.score ??
      coverageAdjustedScore,
    coverageAdjustedScore
  );
  const confidenceLabel = normalizeConfidenceLabel(
    president.evidence_confidence ??
      president.direct_score_confidence ??
      president.score_confidence
  );
  const sparsePenaltyApplied = inferSparsePenaltyApplied({
    overallRankingScore,
    coverageAdjustedScore,
    scoreConfidence:
      president.evidence_confidence ??
      president.direct_score_confidence ??
      president.score_confidence,
  });
  const penaltyAppliedLabel = buildPenaltyAppliedLabel({
    sparsePenaltyApplied,
    outcomeCount,
    confidenceLabel,
  });

  let summary =
    `This public rank is based on ${outcomeCount} scored outcomes with ${confidenceLabel} confidence. ` +
    `The raw average score is ${formatScore(rawAverageScore)}, and the overall ranking score is ${formatScore(overallRankingScore)}.`;

  if (sparsePenaltyApplied) {
    summary +=
      ` The score is reduced further because LOW and VERY LOW confidence presidencies receive an extra low-coverage penalty.`;
  } else if (Math.abs(rawAverageScore - overallRankingScore) > 0.001) {
    summary +=
      ` The public ranking still stays below the raw average until the visible evidence base is fuller.`;
  } else {
    summary +=
      ` No extra low-coverage penalty is applied to this ranking score.`;
  }

  const note = sparsePenaltyApplied
    ? "A president with a slightly lower raw average can still rank higher when the record has more scored outcomes and avoids the extra low-coverage penalty."
    : "A lower raw average can still rank higher elsewhere if that record is backed by more scored outcomes and does not trigger a low-coverage penalty.";

  return {
    summary,
    note,
    outcome_count: outcomeCount,
    confidence_level: confidenceLabel,
    confidence_band_description: buildConfidenceBandDescription(confidenceLabel),
    direction_breakdown: directionBreakdown,
    direction_mix_label: formatDirectionMixLabel(directionBreakdown),
    coverage_penalty_applied: sparsePenaltyApplied,
    coverage_penalty_label: penaltyAppliedLabel,
    raw_average_score: rawAverageScore,
    coverage_adjusted_score: coverageAdjustedScore,
    overall_ranking_score: overallRankingScore,
    items: [
      {
        label: "Scored outcomes",
        value: `${outcomeCount} outcomes`,
        detail:
          "This is the total number of documented outcomes currently carrying this presidency into the ranking.",
      },
      {
        label: "Outcome mix",
        value: formatDirectionMixLabel(directionBreakdown),
        detail:
          "The direction mix shows how many visible outcomes are positive, negative, mixed, or blocked.",
      },
      {
        label: "Confidence",
        value: confidenceLabel,
        detail: `This confidence band usually corresponds to ${buildConfidenceBandDescription(
          confidenceLabel
        )}.`,
      },
      {
        label: "Coverage penalty applied",
        value: penaltyAppliedLabel,
        detail:
          "LOW and VERY LOW confidence presidencies receive an extra ranking reduction so thin records do not outrank fuller ones too easily.",
      },
      {
        label: "Raw average score",
        value: formatScore(rawAverageScore),
        detail:
          "This is the presidency's average scored outcome profile before public ranking penalties are applied.",
      },
      {
        label: "Overall ranking score",
        value: formatScore(overallRankingScore),
        detail:
          "This is the public ranking score used to order presidents across the site.",
      },
    ],
  };
}
