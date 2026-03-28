function normalizeSlugPart(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function parseTrailingId(slug) {
  const match = String(slug || "").match(/-(\d+)$/);
  return match ? Number(match[1]) : null;
}

export function buildFutureBillCardSlug(bill) {
  return `${normalizeSlugPart(bill?.title)}-${bill?.id}`;
}

export function buildPolicyCardSlug(policy) {
  return `${normalizeSlugPart(policy?.title)}-${policy?.id}`;
}

export function buildFutureBillCardHref(bill) {
  return `/card/future-bill/${buildFutureBillCardSlug(bill)}`;
}

export function buildPolicyCardHref(policy) {
  return `/card/policy/${buildPolicyCardSlug(policy)}`;
}

export function buildPromiseCardHref(promise) {
  return `/card/promise/${promise?.slug}`;
}

export function buildExplainerCardHref(explainer) {
  return `/card/explainer/${explainer?.slug}`;
}
