const CONFIDENCE_LABELS = ["high", "medium", "low"];
const COMPLETENESS_LABELS = ["complete", "partial", "insufficient"];

function safeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function round4(value) {
  return Number(safeNumber(value).toFixed(4));
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return null;
}

function normalizeLabel(value, allowed, fallback) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function confidenceLabelFor(score) {
  if (score >= 0.75) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

function outcomeConfidenceScore(outcome = {}) {
  const numeric = Number(outcome.confidence_score);
  if (Number.isFinite(numeric)) {
    return Math.max(0, Math.min(1, numeric));
  }

  return normalizeLabel(outcome.confidence_label, CONFIDENCE_LABELS, "low") === "high"
    ? 0.75
    : normalizeLabel(outcome.confidence_label, CONFIDENCE_LABELS, "low") === "medium"
      ? 0.45
      : 0;
}

function outcomeConfidenceLabel(outcome = {}) {
  return normalizeLabel(
    outcome.confidence_label || outcome.confidence_level,
    CONFIDENCE_LABELS,
    confidenceLabelFor(outcomeConfidenceScore(outcome))
  );
}

function outcomeCompletenessLabel(outcome = {}) {
  return normalizeLabel(outcome.completeness_label, COMPLETENESS_LABELS, "insufficient");
}

function isScoredOutcome(outcome = {}) {
  return typeof outcome?.component_score === "number";
}

function average(values = []) {
  const numericValues = values.map(Number).filter(Number.isFinite);
  if (!numericValues.length) return 0;
  return round4(numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length);
}

function pct(count, total) {
  return total ? round4(count / total) : 0;
}

function sampleOutcome(outcome = {}) {
  return {
    outcome_id: outcome.outcome?.id ?? outcome.id ?? null,
    promise_id: outcome.outcome?.promise_id ?? outcome.promise_id ?? null,
    outcome_summary: outcome.outcome?.outcome_summary ?? outcome.outcome_summary ?? null,
    impact_direction: outcome.impact_direction ?? outcome.outcome?.impact_direction ?? null,
    component_score: typeof outcome.component_score === "number" ? outcome.component_score : null,
    confidence_score: outcomeConfidenceScore(outcome),
    confidence_label: outcomeConfidenceLabel(outcome),
    completeness_label: outcomeCompletenessLabel(outcome),
    insufficient_data: outcome.insufficient_data === true,
    missing_fields:
      outcome.completeness_missing_fields ||
      outcome.factors?.data_completeness?.missing_fields ||
      [],
  };
}

function correlation(rows = [], xGetter, yGetter) {
  const pairs = rows
    .map((row) => [Number(xGetter(row)), Number(yGetter(row))])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));

  if (pairs.length < 2) return null;

  const avgX = average(pairs.map(([x]) => x));
  const avgY = average(pairs.map(([, y]) => y));
  let numerator = 0;
  let xVariance = 0;
  let yVariance = 0;

  for (const [x, y] of pairs) {
    const dx = x - avgX;
    const dy = y - avgY;
    numerator += dx * dy;
    xVariance += dx * dx;
    yVariance += dy * dy;
  }

  if (!xVariance || !yVariance) return null;
  return round4(numerator / Math.sqrt(xVariance * yVariance));
}

export function normalizeTrustFilter(options = {}) {
  const input = options && typeof options === "object" && !Array.isArray(options)
    ? options
    : {};
  const excludeIncomplete = normalizeBoolean(
    input.exclude_incomplete ?? input.excludeIncomplete
  );

  return {
    exclude_incomplete: excludeIncomplete === true,
    description:
      excludeIncomplete === true
        ? "Incomplete outcomes are excluded from the requested view."
        : "All completeness levels are included.",
  };
}

export function filterOutcomesByTrust(outcomes = [], options = {}) {
  const filter = normalizeTrustFilter(options);
  const rows = Array.isArray(outcomes) ? outcomes : [];

  if (!filter.exclude_incomplete) {
    return rows;
  }

  return rows.filter((outcome) => outcomeCompletenessLabel(outcome) === "complete");
}

export function summarizeTrustForOutcomes(outcomes = [], options = {}) {
  const rows = Array.isArray(outcomes) ? outcomes : [];
  const scoredRows = rows.filter(isScoredOutcome);
  const trustFilter = normalizeTrustFilter(options);
  const filteredScoredRows = filterOutcomesByTrust(scoredRows, trustFilter);
  const confidenceDistribution = { high: 0, medium: 0, low: 0 };
  const completenessDistribution = { complete: 0, partial: 0, insufficient: 0 };
  const confidenceScores = [];
  const completenessScores = [];

  for (const outcome of rows) {
    confidenceDistribution[outcomeConfidenceLabel(outcome)] += 1;
    completenessDistribution[outcomeCompletenessLabel(outcome)] += 1;
    confidenceScores.push(outcomeConfidenceScore(outcome));
    const completenessScore = Number(outcome.data_completeness_score);
    if (Number.isFinite(completenessScore)) {
      completenessScores.push(completenessScore);
    }
  }

  const lowConfidenceHighImpactOutcomes = scoredRows
    .filter(
      (outcome) =>
        Math.abs(safeNumber(outcome.component_score)) >= 0.8 &&
        outcomeConfidenceLabel(outcome) === "low"
    )
    .map(sampleOutcome)
    .slice(0, 10);
  const incompleteButScoredOutcomes = scoredRows
    .filter((outcome) => outcomeCompletenessLabel(outcome) !== "complete")
    .map(sampleOutcome)
    .slice(0, 10);
  const incompleteCount = completenessDistribution.partial + completenessDistribution.insufficient;

  return {
    trust_filter: trustFilter,
    outcomes_evaluated_for_trust: rows.length,
    scored_outcomes_all_data: scoredRows.length,
    scored_outcomes_after_trust_filter: filteredScoredRows.length,
    scored_outcomes_excluded_by_trust_filter: Math.max(
      scoredRows.length - filteredScoredRows.length,
      0
    ),
    confidence_distribution: confidenceDistribution,
    completeness_distribution: completenessDistribution,
    high_confidence_outcome_percentage: pct(confidenceDistribution.high, rows.length),
    low_confidence_outcome_percentage: pct(confidenceDistribution.low, rows.length),
    incomplete_outcome_percentage: pct(incompleteCount, rows.length),
    average_confidence_score: average(confidenceScores),
    average_data_completeness_score: average(completenessScores),
    confidence_vs_impact_correlation: correlation(
      scoredRows,
      (outcome) => outcomeConfidenceScore(outcome),
      (outcome) => Math.abs(safeNumber(outcome.component_score))
    ),
    completeness_vs_confidence_trends: {
      correlation: correlation(
        rows,
        (outcome) => safeNumber(outcome.data_completeness_score),
        (outcome) => outcomeConfidenceScore(outcome)
      ),
      by_completeness_label: COMPLETENESS_LABELS.map((label) => {
        const labelRows = rows.filter((outcome) => outcomeCompletenessLabel(outcome) === label);
        return {
          completeness_label: label,
          outcome_count: labelRows.length,
          average_confidence_score: average(labelRows.map(outcomeConfidenceScore)),
        };
      }),
    },
    warnings: {
      low_confidence_high_impact_outcome_count: lowConfidenceHighImpactOutcomes.length,
      incomplete_but_scored_outcome_count: incompleteButScoredOutcomes.length,
      low_confidence_high_impact_outcomes: lowConfidenceHighImpactOutcomes,
      incomplete_but_scored_outcomes: incompleteButScoredOutcomes,
    },
    interpretation: `This score is based on ${filteredScoredRows.length} scored outcome(s), with ${Math.round(
      pct(confidenceDistribution.high, rows.length) * 100
    )}% high-confidence data and ${Math.round(
      pct(incompleteCount, rows.length) * 100
    )}% incomplete records across ${rows.length} evaluated outcome(s).`,
  };
}

export function summarizeTrustForPolicy({ promise = {}, scoredOutcomes = [] } = {}) {
  const summary = summarizeTrustForOutcomes(scoredOutcomes);

  return {
    promise_id: promise.id ?? null,
    promise_slug: promise.slug ?? null,
    confidence_score: summary.average_confidence_score,
    confidence_label: confidenceLabelFor(summary.average_confidence_score),
    completeness_label:
      summary.completeness_distribution.insufficient > 0
        ? "insufficient"
        : summary.completeness_distribution.partial > 0
          ? "partial"
          : "complete",
    high_confidence_outcome_percentage: summary.high_confidence_outcome_percentage,
    low_confidence_outcome_percentage: summary.low_confidence_outcome_percentage,
    incomplete_outcome_percentage: summary.incomplete_outcome_percentage,
  };
}
