function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function normalizeScoreTotal(rawScoreTotal, outcomeCount = 0) {
  const safeRawScore = Number(rawScoreTotal);
  const safeOutcomeCount = Number(outcomeCount);

  if (!Number.isFinite(safeRawScore) || !Number.isFinite(safeOutcomeCount) || safeOutcomeCount <= 0) {
    return 0;
  }

  // With the current simple outcome model, the maximum absolute score per
  // outcome is 1.0. Use that to scale into a bounded comparison range.
  const maxAbsScore = safeOutcomeCount;

  if (maxAbsScore <= 0) {
    return 0;
  }

  const normalized = (safeRawScore / maxAbsScore) * 100;
  return Number(clamp(normalized, -100, 100).toFixed(2));
}
