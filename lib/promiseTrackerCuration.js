export const PROMISE_RELEVANCE_LEVELS = ["High", "Medium", "Low"];

export const PROMISE_IMPACT_DIRECTIONS = [
  "Positive",
  "Negative",
  "Mixed",
  "Blocked/Unrealized",
];

const HIGH_RELEVANCE = "High";
const MEDIUM_RELEVANCE = "Medium";
const LOW_RELEVANCE = "Low";

const CORE_TIER = "core";
const SECONDARY_TIER = "secondary";
const DEPRIORITIZED_TIER = "deprioritized";
const MERGE_TIER = "merge_candidate";

const CURATION_BY_ID = {
  1: { relevance: HIGH_RELEVANCE, impact_direction: "Positive", curation_tier: CORE_TIER },
  2: {
    relevance: HIGH_RELEVANCE,
    impact_direction: "Mixed",
    curation_tier: CORE_TIER,
    duplicate_group: "biden_racial_equity",
    duplicate_role: "primary",
  },
  3: { relevance: HIGH_RELEVANCE, impact_direction: "Blocked/Unrealized", curation_tier: CORE_TIER },
  4: { relevance: HIGH_RELEVANCE, impact_direction: "Negative", curation_tier: CORE_TIER },
  5: { relevance: HIGH_RELEVANCE, impact_direction: "Mixed", curation_tier: CORE_TIER },
  6: { relevance: LOW_RELEVANCE, impact_direction: "Mixed", curation_tier: DEPRIORITIZED_TIER },
  7: { relevance: LOW_RELEVANCE, impact_direction: "Mixed", curation_tier: DEPRIORITIZED_TIER },
  8: { relevance: LOW_RELEVANCE, impact_direction: "Positive", curation_tier: DEPRIORITIZED_TIER },
  9: { relevance: HIGH_RELEVANCE, impact_direction: "Positive", curation_tier: CORE_TIER },
  10: { relevance: MEDIUM_RELEVANCE, impact_direction: "Positive", curation_tier: SECONDARY_TIER },
  11: { relevance: HIGH_RELEVANCE, impact_direction: "Positive", curation_tier: CORE_TIER },
  12: { relevance: MEDIUM_RELEVANCE, impact_direction: "Positive", curation_tier: SECONDARY_TIER },
  13: { relevance: HIGH_RELEVANCE, impact_direction: "Positive", curation_tier: CORE_TIER },
  14: { relevance: LOW_RELEVANCE, impact_direction: "Positive", curation_tier: DEPRIORITIZED_TIER },
  15: { relevance: MEDIUM_RELEVANCE, impact_direction: "Mixed", curation_tier: SECONDARY_TIER },
  16: { relevance: LOW_RELEVANCE, impact_direction: "Mixed", curation_tier: DEPRIORITIZED_TIER },
  17: { relevance: LOW_RELEVANCE, impact_direction: "Negative", curation_tier: DEPRIORITIZED_TIER },
  18: { relevance: LOW_RELEVANCE, impact_direction: "Negative", curation_tier: DEPRIORITIZED_TIER },
  19: { relevance: LOW_RELEVANCE, impact_direction: "Mixed", curation_tier: DEPRIORITIZED_TIER },
  20: { relevance: MEDIUM_RELEVANCE, impact_direction: "Mixed", curation_tier: SECONDARY_TIER },
  21: { relevance: HIGH_RELEVANCE, impact_direction: "Negative", curation_tier: CORE_TIER },
  22: { relevance: HIGH_RELEVANCE, impact_direction: "Negative", curation_tier: CORE_TIER },
  23: { relevance: LOW_RELEVANCE, impact_direction: "Negative", curation_tier: DEPRIORITIZED_TIER },
  24: { relevance: MEDIUM_RELEVANCE, impact_direction: "Mixed", curation_tier: SECONDARY_TIER },
  25: { relevance: HIGH_RELEVANCE, impact_direction: "Positive", curation_tier: CORE_TIER },
  26: { relevance: MEDIUM_RELEVANCE, impact_direction: "Positive", curation_tier: SECONDARY_TIER },
  27: { relevance: MEDIUM_RELEVANCE, impact_direction: "Positive", curation_tier: SECONDARY_TIER },
  28: { relevance: HIGH_RELEVANCE, impact_direction: "Positive", curation_tier: CORE_TIER },
  29: { relevance: MEDIUM_RELEVANCE, impact_direction: "Positive", curation_tier: SECONDARY_TIER },
  30: {
    relevance: HIGH_RELEVANCE,
    impact_direction: "Mixed",
    curation_tier: MERGE_TIER,
    duplicate_group: "biden_racial_equity",
    duplicate_role: "overlap_candidate",
    duplicate_primary_id: 2,
    duplicate_primary_slug: "biden-advance-racial-equity",
  },
  31: { relevance: MEDIUM_RELEVANCE, impact_direction: "Positive", curation_tier: SECONDARY_TIER },
  32: { relevance: LOW_RELEVANCE, impact_direction: "Positive", curation_tier: DEPRIORITIZED_TIER },
  33: { relevance: MEDIUM_RELEVANCE, impact_direction: "Positive", curation_tier: SECONDARY_TIER },
  34: { relevance: HIGH_RELEVANCE, impact_direction: "Blocked/Unrealized", curation_tier: CORE_TIER },
  35: { relevance: HIGH_RELEVANCE, impact_direction: "Positive", curation_tier: CORE_TIER },
};

const CURATION_BY_SLUG = {
  "obama-crack-sentencing-disparity": CURATION_BY_ID[1],
  "biden-advance-racial-equity": CURATION_BY_ID[2],
  "biden-voting-rights-restoration": CURATION_BY_ID[3],
  "trump-black-homeownership-anti-redlining": CURATION_BY_ID[4],
  "biden-policing-accountability": CURATION_BY_ID[5],
  "obama-close-guantanamo-bay": CURATION_BY_ID[6],
  "obama-end-combat-brigade-deployment-iraq": CURATION_BY_ID[7],
  "obama-repeal-dont-ask-dont-tell": CURATION_BY_ID[8],
  "obama-ban-preexisting-condition-exclusions": CURATION_BY_ID[9],
  "obama-credit-card-bill-of-rights": CURATION_BY_ID[10],
  "obama-lilly-ledbetter-fair-pay": CURATION_BY_ID[11],
  "obama-making-work-pay-tax-credit": CURATION_BY_ID[12],
  "obama-expand-chip-coverage": CURATION_BY_ID[13],
  "obama-expand-stem-cell-research": CURATION_BY_ID[14],
  "obama-repeal-bush-tax-cuts-for-higher-incomes": CURATION_BY_ID[15],
  "trump-stop-tpp": CURATION_BY_ID[16],
  "trump-build-border-wall-mexico-pay": CURATION_BY_ID[17],
  "trump-withdraw-paris-climate-accord": CURATION_BY_ID[18],
  "trump-move-embassy-jerusalem": CURATION_BY_ID[19],
  "trump-replace-nafta-usmca": CURATION_BY_ID[20],
  "trump-appoint-conservative-supreme-court-justices": CURATION_BY_ID[21],
  "trump-repeal-replace-aca": CURATION_BY_ID[22],
  "trump-travel-ban-targeted-countries": CURATION_BY_ID[23],
  "trump-tax-cuts-jobs-act": CURATION_BY_ID[24],
  "trump-first-step-act": CURATION_BY_ID[25],
  "biden-rejoin-paris-climate-agreement": CURATION_BY_ID[26],
  "biden-cancel-keystone-xl-pipeline": CURATION_BY_ID[27],
  "biden-nominate-first-black-woman-supreme-court": CURATION_BY_ID[28],
  "biden-forgive-public-college-student-debt": CURATION_BY_ID[29],
  "biden-advance-racial-equity-federal-government": CURATION_BY_ID[30],
  "biden-pass-bipartisan-infrastructure-package": CURATION_BY_ID[31],
  "biden-restore-transgender-military-service": CURATION_BY_ID[32],
  "biden-100-million-covid-shots": CURATION_BY_ID[33],
  "biden-raise-federal-minimum-wage-to-15": CURATION_BY_ID[34],
  "biden-strengthen-federal-labor-protections": CURATION_BY_ID[35],
};

const HIGH_KEYWORDS = [
  "racial equity",
  "voting",
  "policing",
  "police",
  "criminal justice",
  "sentencing",
  "housing",
  "redlining",
  "health care",
  "health insurance",
  "children's health",
  "childrens health",
  "labor",
  "minimum wage",
  "pay discrimination",
  "supreme court",
];

const MEDIUM_KEYWORDS = [
  "tax",
  "debt",
  "infrastructure",
  "climate",
  "covid",
  "public health",
  "trade",
];

function fallbackRelevance(record) {
  const haystack = [
    record.title,
    record.topic,
    record.summary,
    record.impacted_group,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (HIGH_KEYWORDS.some((keyword) => haystack.includes(keyword))) {
    return HIGH_RELEVANCE;
  }

  if (MEDIUM_KEYWORDS.some((keyword) => haystack.includes(keyword))) {
    return MEDIUM_RELEVANCE;
  }

  return LOW_RELEVANCE;
}

function fallbackImpactDirection(record) {
  if (record.status === "Blocked") return "Blocked/Unrealized";
  if (record.status === "Failed") return "Negative";
  if (record.status === "Delivered") return "Positive";
  return "Mixed";
}

function fallbackTier(relevance) {
  if (relevance === HIGH_RELEVANCE) return CORE_TIER;
  if (relevance === MEDIUM_RELEVANCE) return SECONDARY_TIER;
  return DEPRIORITIZED_TIER;
}

export function getPromiseCuration(record = {}) {
  const explicit =
    (record.id && CURATION_BY_ID[Number(record.id)]) ||
    (record.slug && CURATION_BY_SLUG[record.slug]) ||
    {};

  const relevance = explicit.relevance || fallbackRelevance(record);
  const impactDirection = explicit.impact_direction || fallbackImpactDirection(record);
  const curationTier = explicit.curation_tier || fallbackTier(relevance);

  return {
    relevance,
    impact_direction: impactDirection,
    curation_tier: curationTier,
    duplicate_group: explicit.duplicate_group || null,
    duplicate_role: explicit.duplicate_role || null,
    duplicate_primary_id: explicit.duplicate_primary_id || null,
    duplicate_primary_slug: explicit.duplicate_primary_slug || null,
    show_in_prioritized_browse:
      curationTier !== DEPRIORITIZED_TIER && curationTier !== MERGE_TIER,
    show_in_show_all_browse: true,
  };
}

export function applyPromiseCuration(record = {}) {
  return {
    ...record,
    ...getPromiseCuration(record),
  };
}

export function shouldShowPromiseInBrowse(record, showAll = false) {
  const curation = getPromiseCuration(record);
  return showAll ? curation.show_in_show_all_browse : curation.show_in_prioritized_browse;
}

export function getPromiseRelevanceRank(relevance) {
  if (relevance === HIGH_RELEVANCE) return 0;
  if (relevance === MEDIUM_RELEVANCE) return 1;
  return 2;
}

export function getPrioritizedPromiseSlugs() {
  return Object.entries(CURATION_BY_SLUG)
    .filter(([, value]) => value.curation_tier !== DEPRIORITIZED_TIER && value.curation_tier !== MERGE_TIER)
    .map(([slug]) => slug);
}

export function buildPromiseCurationSummary() {
  return {
    default_scope: "prioritized",
    relevance_levels: PROMISE_RELEVANCE_LEVELS,
    impact_directions: PROMISE_IMPACT_DIRECTIONS,
    helper_text:
      "Relevance reflects the degree to which a promise is tied to Black-community outcomes.",
    secondary_text:
      "The default view prioritizes promises with direct or meaningful downstream Black-community impact.",
  };
}
