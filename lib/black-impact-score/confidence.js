import { normalizeEvidenceStrength } from "./evidenceStrength.js";

const CONFIDENCE_WEIGHTS = {
  evidence_strength: 0.35,
  source_count: 0.2,
  source_quality: 0.25,
  field_completeness: 0.2,
};

export const CONFIDENCE_THRESHOLDS = {
  low: 0,
  medium: 0.45,
  high: 0.75,
};

function normalizeText(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function toCount(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}

function clamp01(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, Math.min(1, numeric));
}

function scoreEvidenceStrength(value) {
  const normalized = normalizeEvidenceStrength(value);
  if (normalized === "high") return 1;
  if (normalized === "medium") return 0.75;
  if (normalized === "low") return 0.45;
  return 0.35;
}

function scoreSourceCount(value) {
  const count = toCount(value);
  if (count <= 0) return 0;
  if (count === 1) return 0.45;
  if (count === 2) return 0.75;
  return 1;
}

function getSourceQualityScore(context = {}, outcome = {}) {
  const summaryScore = outcome.source_quality_summary?.source_quality_score;
  return clamp01(
    context.source_quality_score ??
      context.sourceQualityScore ??
      outcome.source_quality_score ??
      summaryScore
  );
}

function getSourceQualityLabel(context = {}, outcome = {}) {
  return (
    normalizeText(context.source_quality_label) ??
    normalizeText(context.sourceQualityLabel) ??
    normalizeText(outcome.source_quality_label) ??
    normalizeText(outcome.source_quality_summary?.source_quality_label)
  );
}

function scoreFieldCompleteness(context = {}, outcome = {}) {
  const fields = [
    context.impact_direction ?? outcome.impact_direction,
    context.outcome_summary ?? outcome.outcome_summary,
    context.measurable_impact ?? outcome.measurable_impact,
    context.black_community_impact_note ?? outcome.black_community_impact_note,
  ];
  const presentCount = fields.filter((value) => Boolean(normalizeText(value))).length;
  return Number((presentCount / fields.length).toFixed(4));
}

function labelForScore(score) {
  if (score >= 0.75) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

function coerceBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["false", "0", "no", "off"].includes(normalized)) return false;
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
  }

  return null;
}

function normalizeConfidenceMode(value) {
  if (typeof value !== "string") {
    return null;
  }

  return value.trim().toLowerCase().replaceAll("-", "_") || null;
}

function parseConfidenceScore(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? clamp01(numeric) : null;
}

function getOutcomeConfidenceScore(outcome = {}) {
  const numericScore = parseConfidenceScore(outcome?.confidence_score);
  if (numericScore != null) {
    return numericScore;
  }

  const label = normalizeConfidenceMode(outcome?.confidence_label);
  if (label === "high") return CONFIDENCE_THRESHOLDS.high;
  if (label === "medium") return CONFIDENCE_THRESHOLDS.medium;
  return CONFIDENCE_THRESHOLDS.low;
}

function normalizeThresholdInput(value) {
  if (typeof value === "number") {
    return { mode: "custom", threshold: clamp01(value) };
  }

  if (typeof value === "string") {
    const numeric = parseConfidenceScore(value);
    if (numeric != null && value.trim() !== "") {
      return { mode: "custom", threshold: numeric };
    }

    return { mode: normalizeConfidenceMode(value) || "all", threshold: null };
  }

  return { mode: "all", threshold: null };
}

export function normalizeConfidenceFilter(options = {}) {
  const input =
    options && typeof options === "object" && !Array.isArray(options)
      ? options
      : { confidence: options };
  const explicitThreshold =
    input.min_confidence ??
    input.minConfidence ??
    input.threshold ??
    input.confidence_threshold ??
    input.confidenceThreshold ??
    null;
  const parsedThreshold =
    explicitThreshold == null ? null : parseConfidenceScore(explicitThreshold);
  const parsedMode = normalizeThresholdInput(
    input.confidence ?? input.confidence_filter ?? input.confidenceFilter ?? "all"
  );
  const includeLowConfidence = coerceBoolean(
    input.include_low_confidence ?? input.includeLowConfidence
  );

  let mode = parsedMode.mode || "all";
  let threshold = parsedThreshold ?? parsedMode.threshold ?? CONFIDENCE_THRESHOLDS.low;

  if (parsedThreshold != null) {
    mode = "custom";
  }

  if (["high", "high_only"].includes(mode)) {
    mode = "high";
    threshold = CONFIDENCE_THRESHOLDS.high;
  } else if (["medium", "medium_plus", "medium_or_high", "exclude_low"].includes(mode)) {
    mode = "medium_plus";
    threshold = CONFIDENCE_THRESHOLDS.medium;
  } else if (["all", "include_low", "none"].includes(mode)) {
    mode = "all";
    threshold = CONFIDENCE_THRESHOLDS.low;
  } else if (mode === "custom") {
    threshold = threshold ?? CONFIDENCE_THRESHOLDS.low;
  } else {
    mode = "all";
    threshold = CONFIDENCE_THRESHOLDS.low;
  }

  if (includeLowConfidence === false && mode === "all" && parsedThreshold == null) {
    mode = "medium_plus";
    threshold = CONFIDENCE_THRESHOLDS.medium;
  }

  return {
    mode,
    threshold: Number(threshold.toFixed(4)),
    include_low_confidence: threshold <= CONFIDENCE_THRESHOLDS.low,
    requested_include_low_confidence: includeLowConfidence,
    description:
      threshold <= CONFIDENCE_THRESHOLDS.low
        ? "All confidence levels included."
        : `Only outcomes with confidence_score >= ${Number(threshold.toFixed(4))} are included in the requested view.`,
  };
}

export function filterOutcomesByConfidence(outcomes = [], thresholdOrOptions = {}) {
  const filter = normalizeConfidenceFilter(thresholdOrOptions);
  return (Array.isArray(outcomes) ? outcomes : []).filter(
    (outcome) => getOutcomeConfidenceScore(outcome) >= filter.threshold
  );
}

export function isOutcomeBelowConfidenceThreshold(outcome = {}, thresholdOrOptions = {}) {
  const filter = normalizeConfidenceFilter(thresholdOrOptions);
  return getOutcomeConfidenceScore(outcome) < filter.threshold;
}

function averageComponentScore(outcomes = []) {
  const scores = outcomes
    .map((outcome) => Number(outcome?.component_score))
    .filter((score) => Number.isFinite(score));
  if (!scores.length) {
    return 0;
  }

  const total = scores.reduce((sum, score) => sum + score, 0);
  return Number((total / scores.length).toFixed(4));
}

export function summarizeConfidenceFilteredImpact(scoredOutcomes = [], filterOptions = {}) {
  const scorableOutcomes = (Array.isArray(scoredOutcomes) ? scoredOutcomes : []).filter(
    (outcome) => typeof outcome?.component_score === "number"
  );
  const confidenceFilter = normalizeConfidenceFilter(filterOptions);
  const filteredOutcomes = filterOutcomesByConfidence(scorableOutcomes, confidenceFilter);
  const highConfidenceOutcomes = filterOutcomesByConfidence(scorableOutcomes, "high");
  const lowConfidenceCount = scorableOutcomes.filter(
    (outcome) => getOutcomeConfidenceScore(outcome) < CONFIDENCE_THRESHOLDS.medium
  ).length;

  return {
    confidence_filter: confidenceFilter,
    scored_outcomes_all_data: scorableOutcomes.length,
    scored_outcomes_after_confidence_filter: filteredOutcomes.length,
    scored_outcomes_excluded_by_confidence_filter: Math.max(
      scorableOutcomes.length - filteredOutcomes.length,
      0
    ),
    average_impact_score_all_data: averageComponentScore(scorableOutcomes),
    average_impact_score_filtered: averageComponentScore(filteredOutcomes),
    average_impact_score_high_confidence_only: averageComponentScore(
      highConfidenceOutcomes
    ),
    low_confidence_outcome_count: lowConfidenceCount,
    low_confidence_outcome_percentage: scorableOutcomes.length
      ? Number((lowConfidenceCount / scorableOutcomes.length).toFixed(4))
      : 0,
  };
}

export function computeConfidence(context = {}) {
  const outcome = context.outcome || {};
  const sourceCount = toCount(
    context.source_count ??
      context.sources_count ??
      context.outcome_source_count ??
      outcome.source_count ??
      outcome.sources_count
  );
  const evidenceStrength = normalizeEvidenceStrength(
    context.evidence_strength ?? outcome.evidence_strength
  );
  const evidenceScore = scoreEvidenceStrength(evidenceStrength);
  const sourceCountScore = scoreSourceCount(sourceCount);
  const sourceQualityScore = sourceCount > 0 ? getSourceQualityScore(context, outcome) : 0;
  const sourceQualityLabel = sourceCount > 0 ? getSourceQualityLabel(context, outcome) : null;
  const fieldCompletenessScore = scoreFieldCompleteness(context, outcome);

  const rawScore =
    evidenceScore * CONFIDENCE_WEIGHTS.evidence_strength +
    sourceCountScore * CONFIDENCE_WEIGHTS.source_count +
    sourceQualityScore * CONFIDENCE_WEIGHTS.source_quality +
    fieldCompletenessScore * CONFIDENCE_WEIGHTS.field_completeness;

  // Keep no-source outcomes visible, but prevent them from appearing high-confidence.
  const score = Number((sourceCount <= 0 ? Math.min(rawScore, 0.4) : rawScore).toFixed(4));

  return {
    confidence_score: score,
    confidence_label: labelForScore(score),
    confidence_factors: {
      evidence_strength: evidenceStrength,
      evidence_strength_score: evidenceScore,
      source_count: sourceCount,
      source_count_score: sourceCountScore,
      source_quality_label: sourceQualityLabel,
      source_quality_score: sourceQualityScore,
      field_completeness_score: fieldCompletenessScore,
      weights: CONFIDENCE_WEIGHTS,
    },
  };
}

export function computeConfidenceLevel(context = {}) {
  const outcome = context.outcome || null;

  if (!outcome) {
    return "low";
  }

  const direction = normalizeText(context.impact_direction ?? outcome.impact_direction);
  const outcomeSummary = normalizeText(context.outcome_summary ?? outcome.outcome_summary);
  const sourceCount = toCount(
    context.source_count ??
      context.sources_count ??
      context.outcome_source_count ??
      outcome.source_count ??
      outcome.sources_count
  );
  const hasMeasurableImpact = Boolean(
    normalizeText(context.measurable_impact ?? outcome.measurable_impact)
  );
  const hasBlackCommunityImpactNote = Boolean(
    normalizeText(
      context.black_community_impact_note ?? outcome.black_community_impact_note
    )
  );
  const scoringReadyOutcomeCount = toCount(context.scoring_ready_outcome_count);
  const hasAdditionalCorroboration = sourceCount > 1 || scoringReadyOutcomeCount > 1;
  const detailSignalCount =
    Number(hasMeasurableImpact) + Number(hasBlackCommunityImpactNote);

  if (!direction || !outcomeSummary || sourceCount < 1) {
    return "low";
  }

  const evidenceStrength = normalizeEvidenceStrength(
    context.evidence_strength ?? outcome.evidence_strength
  );

  if (evidenceStrength === "high") {
    return detailSignalCount >= 1 || hasAdditionalCorroboration ? "high" : "medium";
  }

  if (evidenceStrength === "medium") {
    return detailSignalCount >= 1 || hasAdditionalCorroboration ? "medium" : "low";
  }

  if (evidenceStrength === "low") {
    return "low";
  }

  if (detailSignalCount >= 2 && hasAdditionalCorroboration) {
    return "medium";
  }

  return "low";
}

export function getNormalizedEvidenceStrength(value) {
  return normalizeEvidenceStrength(value);
}

export function summarizeOutcomeConfidence(scoredOutcomes = []) {
  const distribution = { high: 0, medium: 0, low: 0 };
  const byScoringReadiness = {
    scoring_ready: { count: 0, average_confidence_score: 0 },
    excluded_from_score: { count: 0, average_confidence_score: 0 },
  };
  const byImpactDirection = {};
  let totalScore = 0;
  let count = 0;

  for (const entry of Array.isArray(scoredOutcomes) ? scoredOutcomes : []) {
    const confidenceScore = Number(entry?.confidence_score);
    if (!Number.isFinite(confidenceScore)) {
      continue;
    }
    const confidenceLabel = entry.confidence_label || labelForScore(confidenceScore);
    distribution[confidenceLabel] = (distribution[confidenceLabel] || 0) + 1;
    totalScore += confidenceScore;
    count += 1;

    const readinessKey = entry?.factors?.scoring_ready
      ? "scoring_ready"
      : "excluded_from_score";
    byScoringReadiness[readinessKey].count += 1;
    byScoringReadiness[readinessKey].average_confidence_score += confidenceScore;

    const directionKey = entry?.impact_direction || "Unknown";
    if (!byImpactDirection[directionKey]) {
      byImpactDirection[directionKey] = {
        count: 0,
        average_confidence_score: 0,
        average_component_score: 0,
      };
    }
    byImpactDirection[directionKey].count += 1;
    byImpactDirection[directionKey].average_confidence_score += confidenceScore;
    if (typeof entry?.component_score === "number") {
      byImpactDirection[directionKey].average_component_score += entry.component_score;
    }
  }

  for (const bucket of Object.values(byScoringReadiness)) {
    bucket.average_confidence_score = bucket.count
      ? Number((bucket.average_confidence_score / bucket.count).toFixed(4))
      : 0;
  }

  for (const bucket of Object.values(byImpactDirection)) {
    bucket.average_confidence_score = bucket.count
      ? Number((bucket.average_confidence_score / bucket.count).toFixed(4))
      : 0;
    bucket.average_component_score = bucket.count
      ? Number((bucket.average_component_score / bucket.count).toFixed(4))
      : 0;
  }

  return {
    average_confidence_score: count ? Number((totalScore / count).toFixed(4)) : 0,
    confidence_distribution: distribution,
    confidence_by_scoring_readiness: byScoringReadiness,
    confidence_vs_impact_score: byImpactDirection,
    confidence_model: {
      scale: "0_to_1",
      labels: {
        high: ">= 0.75",
        medium: ">= 0.45 and < 0.75",
        low: "< 0.45",
      },
      weights: CONFIDENCE_WEIGHTS,
      no_source_cap: 0.4,
    },
  };
}
