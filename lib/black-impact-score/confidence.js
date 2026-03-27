const KNOWN_EVIDENCE_STRENGTHS = new Set(["low", "medium", "high"]);

function normalizeEvidenceStrength(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return KNOWN_EVIDENCE_STRENGTHS.has(normalized) ? normalized : null;
}

export function computeConfidenceLevel(context = {}) {
  const outcome = context.outcome || null;

  if (!outcome) {
    return "low";
  }

  const direction = typeof outcome.impact_direction === "string"
    ? outcome.impact_direction.trim()
    : "";

  if (!direction) {
    return "low";
  }

  const evidenceStrength = normalizeEvidenceStrength(
    context.evidence_strength ?? outcome.evidence_strength
  );

  if (evidenceStrength === "high") {
    return "high";
  }

  if (evidenceStrength === "medium") {
    return "medium";
  }

  if (evidenceStrength === "low") {
    return "low";
  }

  return "medium";
}

export function getNormalizedEvidenceStrength(value) {
  return normalizeEvidenceStrength(value);
}
