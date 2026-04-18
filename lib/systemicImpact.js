const SYSTEMIC_IMPACT_MULTIPLIERS = {
  limited: 0.9,
  standard: 1.0,
  strong: 1.15,
  transformational: 1.3,
  unclear: 1.0,
};

function normalizeNullableText(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

export function normalizeSystemicImpactCategory(value) {
  const text = normalizeNullableText(value);
  if (!text) {
    return null;
  }

  const normalized = text.toLowerCase().replace(/-/g, "_");

  return Object.prototype.hasOwnProperty.call(SYSTEMIC_IMPACT_MULTIPLIERS, normalized)
    ? normalized
    : null;
}

export function resolveSystemicImpactCategory(value) {
  return normalizeSystemicImpactCategory(value) || "standard";
}

export function systemicMultiplierFor(value) {
  return SYSTEMIC_IMPACT_MULTIPLIERS[resolveSystemicImpactCategory(value)] ?? 1.0;
}

export function formatSystemicImpactLabel(value) {
  return resolveSystemicImpactCategory(value)
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function isNonStandardSystemicImpact(value) {
  return ["limited", "strong", "transformational"].includes(
    resolveSystemicImpactCategory(value)
  );
}

export function shouldRenderSystemicImpact(value, summary = null) {
  return isNonStandardSystemicImpact(value) || Boolean(normalizeNullableText(summary));
}

export { SYSTEMIC_IMPACT_MULTIPLIERS };
