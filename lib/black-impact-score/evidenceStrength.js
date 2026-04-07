const EVIDENCE_STRENGTH_ALIASES = new Map([
  ["high", "high"],
  ["strong", "high"],
  ["medium", "medium"],
  ["moderate", "medium"],
  ["low", "low"],
  ["weak", "low"],
  ["limited", "low"],
]);

export const NORMALIZED_EVIDENCE_STRENGTHS = ["low", "medium", "high"];

export function normalizeEvidenceStrength(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return EVIDENCE_STRENGTH_ALIASES.get(normalized) || null;
}

export function summarizeEvidenceStrengthNormalization(values = []) {
  const summary = {
    low: 0,
    medium: 0,
    high: 0,
    unknown: 0,
  };

  for (const value of values) {
    const normalized = normalizeEvidenceStrength(value);
    if (normalized) {
      summary[normalized] += 1;
    } else if (value !== null && value !== undefined && String(value).trim()) {
      summary.unknown += 1;
    }
  }

  return summary;
}
