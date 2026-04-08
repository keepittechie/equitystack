const DEFAULT_JUDICIAL_WEIGHT = 0.5;

function normalizeText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeFraction(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return fallback;
  }

  return numeric;
}

function normalizeJusticeName(justice) {
  if (typeof justice === "string") {
    return normalizeText(justice);
  }

  return normalizeText(justice?.name ?? justice?.justice ?? justice?.justice_name);
}

function presidentKeyForJustice(justice) {
  if (!justice || typeof justice !== "object") {
    return null;
  }

  return (
    normalizeText(justice.appointing_president_slug) ||
    normalizeText(justice.appointing_president) ||
    normalizeText(justice.appointing_president_name) ||
    (justice.appointing_president_id != null ? `president:${justice.appointing_president_id}` : null)
  );
}

function attributionFromMajorityJustices(majorityJustices = []) {
  const justices = Array.isArray(majorityJustices) ? majorityJustices : [];
  const grouped = new Map();

  for (const justice of justices) {
    const presidentKey = presidentKeyForJustice(justice);
    if (!presidentKey) {
      continue;
    }

    if (!grouped.has(presidentKey)) {
      grouped.set(presidentKey, {
        president_id: justice.appointing_president_id ?? null,
        president_slug: normalizeText(justice.appointing_president_slug),
        president_name:
          normalizeText(justice.appointing_president_name) ||
          normalizeText(justice.appointing_president),
        contributing_justices: [],
      });
    }

    const entry = grouped.get(presidentKey);
    const justiceName = normalizeJusticeName(justice);
    if (justiceName) {
      entry.contributing_justices.push(justiceName);
    }
  }

  const majorityCount = justices.length;
  if (!majorityCount) {
    return [];
  }

  return [...grouped.values()].map((entry) => ({
    ...entry,
    attribution_fraction: Number((entry.contributing_justices.length / majorityCount).toFixed(4)),
  }));
}

export function buildJudicialAttribution({
  majority_justices: majorityJustices = [],
  judicial_attribution: judicialAttribution = null,
} = {}) {
  if (Array.isArray(judicialAttribution) && judicialAttribution.length) {
    return judicialAttribution.map((entry) => ({
      president_id: entry.president_id ?? entry.appointing_president_id ?? null,
      president_slug: normalizeText(entry.president_slug ?? entry.appointing_president_slug),
      president_name:
        normalizeText(entry.president_name) ||
        normalizeText(entry.appointing_president_name) ||
        normalizeText(entry.appointing_president),
      attribution_fraction: safeFraction(entry.attribution_fraction),
      contributing_justices: Array.isArray(entry.contributing_justices)
        ? entry.contributing_justices.map(normalizeJusticeName).filter(Boolean)
        : [],
    }));
  }

  return attributionFromMajorityJustices(majorityJustices);
}

export function computeJudicialContribution({
  outcome_score,
  attribution_fraction,
  judicial_weight = DEFAULT_JUDICIAL_WEIGHT,
} = {}) {
  const score = Number(outcome_score);
  if (!Number.isFinite(score)) {
    return 0;
  }

  return Number((score * safeFraction(attribution_fraction) * safeFraction(judicial_weight, DEFAULT_JUDICIAL_WEIGHT)).toFixed(4));
}

export { DEFAULT_JUDICIAL_WEIGHT };
