import {
  computeConfidence,
  computeConfidenceLevel,
  getNormalizedEvidenceStrength,
} from "./confidence.js";
import { computeDataCompleteness } from "./completeness.js";

const DIRECTION_BASE_SCORES = {
  Positive: 1,
  Negative: -1,
  Mixed: 0,
  Blocked: 0,
};

const EVIDENCE_MULTIPLIERS = {
  low: 0.6,
  medium: 0.8,
  high: 1.0,
};

function normalizeText(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function normalizeImpactDirection(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "positive") return "Positive";
  if (normalized === "negative") return "Negative";
  if (normalized === "mixed") return "Mixed";
  if (normalized === "blocked") return "Blocked";

  return null;
}

function getEvidenceMultiplier(value) {
  const normalized = getNormalizedEvidenceStrength(value);
  return EVIDENCE_MULTIPLIERS[normalized] ?? EVIDENCE_MULTIPLIERS.medium;
}

function toCount(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}

function getOutcomeSummary(outcomeContext = {}) {
  const outcome = outcomeContext.outcome || {};
  return normalizeText(outcomeContext.outcome_summary ?? outcome.outcome_summary);
}

function getOutcomeSourceCount(outcomeContext = {}) {
  const outcome = outcomeContext.outcome || {};

  return toCount(
    outcomeContext.source_count ??
      outcomeContext.sources_count ??
      outcomeContext.outcome_source_count ??
      outcome.sources_count ??
      outcome.source_count
  );
}

function getMissingOutcomeReason({ hasDirection, hasSummary, sourceCount }) {
  if (!hasDirection) {
    return "Outcome is excluded from numeric scoring because impact direction is missing.";
  }

  if (!hasSummary) {
    return "Outcome is excluded from numeric scoring because the documented outcome summary is missing.";
  }

  if (sourceCount < 1) {
    return "Outcome is excluded from numeric scoring because no linked outcome source is available.";
  }

  return "Outcome is excluded from numeric scoring because the record is not scoring-ready.";
}

function buildOutcomeExplanation({
  impactDirection,
  evidenceStrength,
  componentScore,
  scoringReady,
  missingReason,
}) {
  if (!scoringReady) {
    return missingReason;
  }

  if (impactDirection === "Mixed") {
    return "Mixed outcomes remain visible but receive a conservative neutral score in this MVP until component decomposition is implemented.";
  }

  if (impactDirection === "Blocked") {
    return "Blocked outcomes remain visible but receive a conservative neutral score in this MVP until blocked-effect classification is implemented.";
  }

  const directionLabel = impactDirection === "Positive" ? "positive" : "negative";
  const evidenceLabel = evidenceStrength || "unspecified";

  return `Outcome scored ${directionLabel} using ${evidenceLabel} evidence weighting for a component score of ${componentScore.toFixed(2)}.`;
}

export function isOutcomeScoringReady(outcomeContext = {}) {
  const outcome = outcomeContext.outcome || {};
  const impactDirection = normalizeImpactDirection(
    outcomeContext.impact_direction ?? outcome.impact_direction
  );
  const summary = getOutcomeSummary(outcomeContext);
  const sourceCount = getOutcomeSourceCount(outcomeContext);

  return Boolean(impactDirection && summary && sourceCount > 0);
}

export function computeOutcomeScore(outcomeContext = {}) {
  const outcome = outcomeContext.outcome || {};
  const impactDirection = normalizeImpactDirection(outcome.impact_direction);
  const evidenceStrength = getNormalizedEvidenceStrength(
    outcomeContext.evidence_strength ?? outcome.evidence_strength
  );
  const evidenceMultiplier = getEvidenceMultiplier(evidenceStrength);
  const outcomeSummary = getOutcomeSummary(outcomeContext);
  const measurableImpact = normalizeText(
    outcomeContext.measurable_impact ?? outcome.measurable_impact
  );
  const blackCommunityImpactNote = normalizeText(
    outcomeContext.black_community_impact_note ?? outcome.black_community_impact_note
  );
  const sourceCount = getOutcomeSourceCount(outcomeContext);
  const scoringReady = isOutcomeScoringReady({
    ...outcomeContext,
    outcome: {
      ...outcome,
      impact_direction: impactDirection ?? outcome.impact_direction,
      outcome_summary: outcomeSummary ?? outcome.outcome_summary,
      source_count: sourceCount,
    },
  });
  const missingReason = getMissingOutcomeReason({
    hasDirection: Boolean(impactDirection),
    hasSummary: Boolean(outcomeSummary),
    sourceCount,
  });
  const baseScore = scoringReady ? DIRECTION_BASE_SCORES[impactDirection] ?? 0 : 0;
  const componentScore = scoringReady
    ? Number((baseScore * evidenceMultiplier).toFixed(2))
    : null;
  const confidenceLevel = computeConfidenceLevel({
    ...outcomeContext,
    source_count: sourceCount,
    outcome_summary: outcomeSummary,
    measurable_impact: measurableImpact,
    black_community_impact_note: blackCommunityImpactNote,
    scoring_ready: scoringReady,
    outcome: {
      ...outcome,
      outcome_summary: outcomeSummary ?? outcome.outcome_summary,
      impact_direction: impactDirection ?? outcome.impact_direction,
      evidence_strength: evidenceStrength ?? outcome.evidence_strength,
      measurable_impact: measurableImpact ?? outcome.measurable_impact ?? null,
      black_community_impact_note:
        blackCommunityImpactNote ?? outcome.black_community_impact_note ?? null,
      source_count: sourceCount,
    },
  });
  const confidence = computeConfidence({
    ...outcomeContext,
    source_count: sourceCount,
    outcome_summary: outcomeSummary,
    measurable_impact: measurableImpact,
    black_community_impact_note: blackCommunityImpactNote,
    scoring_ready: scoringReady,
    outcome: {
      ...outcome,
      outcome_summary: outcomeSummary ?? outcome.outcome_summary,
      impact_direction: impactDirection ?? outcome.impact_direction,
      evidence_strength: evidenceStrength ?? outcome.evidence_strength,
      measurable_impact: measurableImpact ?? outcome.measurable_impact ?? null,
      black_community_impact_note:
        blackCommunityImpactNote ?? outcome.black_community_impact_note ?? null,
      source_count: sourceCount,
    },
  });
  const completeness = computeDataCompleteness({
    ...outcomeContext,
    source_count: sourceCount,
    outcome_summary: outcomeSummary,
    measurable_impact: measurableImpact,
    black_community_impact_note: blackCommunityImpactNote,
    outcome: {
      ...outcome,
      outcome_summary: outcomeSummary ?? outcome.outcome_summary,
      impact_direction: impactDirection ?? outcome.impact_direction,
      evidence_strength: evidenceStrength ?? outcome.evidence_strength,
      measurable_impact: measurableImpact ?? outcome.measurable_impact ?? null,
      black_community_impact_note:
        blackCommunityImpactNote ?? outcome.black_community_impact_note ?? null,
      source_count: sourceCount,
    },
  });

  return {
    outcome: {
      ...outcome,
      outcome_summary: outcomeSummary ?? outcome.outcome_summary ?? null,
      impact_direction: impactDirection ?? outcome.impact_direction ?? null,
      evidence_strength: evidenceStrength ?? outcome.evidence_strength ?? null,
      measurable_impact: measurableImpact ?? outcome.measurable_impact ?? null,
      black_community_impact_note:
        blackCommunityImpactNote ?? outcome.black_community_impact_note ?? null,
      source_count: sourceCount,
    },
    impact_direction: impactDirection,
    component_score: componentScore,
    confidence_score: confidence.confidence_score,
    confidence_label: confidence.confidence_label,
    confidence_level: confidenceLevel,
    data_completeness_score: completeness.data_completeness_score,
    completeness_label: completeness.completeness_label,
    insufficient_data: completeness.insufficient_data,
    factors: {
      base_score: baseScore,
      evidence_strength: evidenceStrength,
      evidence_multiplier: evidenceMultiplier,
      source_count: sourceCount,
      scoring_ready: scoringReady,
      data_completeness: completeness,
      measurable_impact_present: Boolean(measurableImpact),
      black_community_impact_note_present: Boolean(blackCommunityImpactNote),
      confidence_factors: confidence.confidence_factors,
      mixed_handling: impactDirection === "Mixed" ? "temporary_neutral_todo" : null,
      blocked_handling: impactDirection === "Blocked" ? "temporary_neutral_todo" : null,
    },
    explanation: buildOutcomeExplanation({
      impactDirection,
      evidenceStrength,
      componentScore,
      scoringReady,
      missingReason,
    }),
  };
}

export function getOutcomeScoringConfig() {
  return {
    direction_base_scores: DIRECTION_BASE_SCORES,
    evidence_multipliers: EVIDENCE_MULTIPLIERS,
    eligibility_requirements: [
      "Outcome must have a documented outcome summary.",
      "Outcome must have an impact direction of Positive, Negative, Mixed, or Blocked.",
      "Outcome must have at least one linked outcome source.",
    ],
    notes: [
      "Positive and Negative outcomes use impact direction as the base sign.",
      "Evidence strength applies a simple multiplier of low=0.6, medium=0.8, high=1.0.",
      "Mixed outcomes are conservatively neutral in this MVP until component decomposition is implemented.",
      "Blocked outcomes are conservatively neutral in this MVP until blocked-effect classification is implemented.",
    ],
  };
}
