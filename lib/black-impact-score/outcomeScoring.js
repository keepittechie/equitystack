import { computeConfidenceLevel, getNormalizedEvidenceStrength } from "./confidence.js";

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

function buildOutcomeExplanation({ impactDirection, evidenceStrength, componentScore }) {
  if (!impactDirection) {
    return "Outcome could not be scored because impact direction is missing.";
  }

  if (impactDirection === "Mixed") {
    return "Mixed outcomes currently receive a temporary neutral score until component decomposition is implemented.";
  }

  if (impactDirection === "Blocked") {
    return "Blocked outcomes currently receive a temporary neutral score until blocked-effect classification is implemented.";
  }

  const directionLabel = impactDirection === "Positive" ? "positive" : "negative";
  const evidenceLabel = evidenceStrength || "unspecified";

  return `Outcome scored ${directionLabel} using ${evidenceLabel} evidence weighting for a component score of ${componentScore.toFixed(2)}.`;
}

export function computeOutcomeScore(outcomeContext = {}) {
  const outcome = outcomeContext.outcome || {};
  const impactDirection = normalizeImpactDirection(outcome.impact_direction);
  const evidenceStrength = getNormalizedEvidenceStrength(
    outcomeContext.evidence_strength ?? outcome.evidence_strength
  );
  const evidenceMultiplier = getEvidenceMultiplier(evidenceStrength);
  const baseScore = DIRECTION_BASE_SCORES[impactDirection] ?? 0;
  const sourceCount = toCount(
    outcomeContext.source_count ??
      outcomeContext.sources_count ??
      outcomeContext.outcome_source_count ??
      outcome.sources_count ??
      outcome.source_count
  );
  const componentScore = Number((baseScore * evidenceMultiplier).toFixed(2));
  const confidenceLevel = computeConfidenceLevel({
    ...outcomeContext,
    outcome: {
      ...outcome,
      impact_direction: impactDirection ?? outcome.impact_direction,
      evidence_strength: evidenceStrength ?? outcome.evidence_strength,
    },
  });

  return {
    outcome: {
      ...outcome,
      impact_direction: impactDirection ?? outcome.impact_direction ?? null,
      evidence_strength: evidenceStrength ?? outcome.evidence_strength ?? null,
    },
    impact_direction: impactDirection,
    component_score: componentScore,
    confidence_level: confidenceLevel,
    factors: {
      base_score: baseScore,
      evidence_strength: evidenceStrength,
      evidence_multiplier: evidenceMultiplier,
      source_count: sourceCount,
      mixed_handling: impactDirection === "Mixed" ? "temporary_neutral_todo" : null,
      blocked_handling: impactDirection === "Blocked" ? "temporary_neutral_todo" : null,
    },
    explanation: buildOutcomeExplanation({
      impactDirection,
      evidenceStrength,
      componentScore,
    }),
  };
}

export function getOutcomeScoringConfig() {
  return {
    direction_base_scores: DIRECTION_BASE_SCORES,
    evidence_multipliers: EVIDENCE_MULTIPLIERS,
    notes: [
      "Positive and Negative outcomes use impact direction as the base sign.",
      "Evidence strength applies a simple multiplier of low=0.6, medium=0.8, high=1.0.",
      "Mixed outcomes are temporarily neutral until component decomposition is implemented.",
      "Blocked outcomes are temporarily neutral until blocked-effect classification is implemented.",
    ],
  };
}
