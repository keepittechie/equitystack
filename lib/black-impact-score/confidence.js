const KNOWN_EVIDENCE_STRENGTHS = new Set(["low", "medium", "high"]);

function normalizeEvidenceStrength(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return KNOWN_EVIDENCE_STRENGTHS.has(normalized) ? normalized : null;
}

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
