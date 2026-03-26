export const PROMISE_RELEVANCE_LEVELS = ["High", "Medium", "Low"];

export const PROMISE_IMPACT_DIRECTIONS = [
  "Positive",
  "Negative",
  "Mixed",
  "Blocked/Unrealized",
];

const PROMISE_CURATION_ENTRIES = [
  {
    id: 1,
    slug: "obama-crack-sentencing-disparity",
    relevance: "High",
    impact_direction_for_curation: "Positive",
    curation_priority: "core",
    show_in_default_browse: true,
  },
  {
    id: 2,
    slug: "biden-advance-racial-equity",
    relevance: "High",
    impact_direction_for_curation: "Mixed",
    curation_priority: "core",
    show_in_default_browse: true,
    overlap_group: "federal-racial-equity-framework",
  },
  {
    id: 3,
    slug: "biden-voting-rights-restoration",
    relevance: "High",
    impact_direction_for_curation: "Blocked/Unrealized",
    curation_priority: "core",
    show_in_default_browse: true,
  },
  {
    id: 4,
    slug: "trump-black-homeownership-anti-redlining",
    relevance: "High",
    impact_direction_for_curation: "Negative",
    curation_priority: "core",
    show_in_default_browse: true,
  },
  {
    id: 5,
    slug: "biden-policing-accountability",
    relevance: "High",
    impact_direction_for_curation: "Mixed",
    curation_priority: "core",
    show_in_default_browse: true,
  },
  {
    id: 6,
    slug: "obama-close-guantanamo-bay",
    relevance: "Low",
    impact_direction_for_curation: "Mixed",
    curation_priority: "deprioritized",
    show_in_default_browse: false,
  },
  {
    id: 7,
    slug: "obama-end-combat-brigade-deployment-iraq",
    relevance: "Low",
    impact_direction_for_curation: "Mixed",
    curation_priority: "deprioritized",
    show_in_default_browse: false,
  },
  {
    id: 8,
    slug: "obama-repeal-dont-ask-dont-tell",
    relevance: "Low",
    impact_direction_for_curation: "Positive",
    curation_priority: "deprioritized",
    show_in_default_browse: false,
  },
  {
    id: 9,
    slug: "obama-ban-preexisting-condition-exclusions",
    relevance: "High",
    impact_direction_for_curation: "Positive",
    curation_priority: "core",
    show_in_default_browse: true,
  },
  {
    id: 10,
    slug: "obama-credit-card-bill-of-rights",
    relevance: "Medium",
    impact_direction_for_curation: "Positive",
    curation_priority: "secondary",
    show_in_default_browse: true,
  },
  {
    id: 11,
    slug: "obama-lilly-ledbetter-fair-pay",
    relevance: "High",
    impact_direction_for_curation: "Positive",
    curation_priority: "core",
    show_in_default_browse: true,
  },
  {
    id: 12,
    slug: "obama-making-work-pay-tax-credit",
    relevance: "Medium",
    impact_direction_for_curation: "Positive",
    curation_priority: "secondary",
    show_in_default_browse: true,
  },
  {
    id: 13,
    slug: "obama-expand-chip-coverage",
    relevance: "High",
    impact_direction_for_curation: "Positive",
    curation_priority: "core",
    show_in_default_browse: true,
  },
  {
    id: 14,
    slug: "obama-expand-stem-cell-research",
    relevance: "Low",
    impact_direction_for_curation: "Positive",
    curation_priority: "deprioritized",
    show_in_default_browse: false,
  },
  {
    id: 15,
    slug: "obama-repeal-bush-tax-cuts-for-higher-incomes",
    relevance: "Medium",
    impact_direction_for_curation: "Mixed",
    curation_priority: "secondary",
    show_in_default_browse: true,
  },
  {
    id: 16,
    slug: "trump-stop-tpp",
    relevance: "Low",
    impact_direction_for_curation: "Mixed",
    curation_priority: "deprioritized",
    show_in_default_browse: false,
  },
  {
    id: 17,
    slug: "trump-build-border-wall-mexico-pay",
    relevance: "Low",
    impact_direction_for_curation: "Negative",
    curation_priority: "deprioritized",
    show_in_default_browse: false,
  },
  {
    id: 18,
    slug: "trump-withdraw-paris-climate-accord",
    relevance: "Low",
    impact_direction_for_curation: "Negative",
    curation_priority: "deprioritized",
    show_in_default_browse: false,
  },
  {
    id: 19,
    slug: "trump-move-embassy-jerusalem",
    relevance: "Low",
    impact_direction_for_curation: "Mixed",
    curation_priority: "deprioritized",
    show_in_default_browse: false,
  },
  {
    id: 20,
    slug: "trump-replace-nafta-usmca",
    relevance: "Medium",
    impact_direction_for_curation: "Mixed",
    curation_priority: "secondary",
    show_in_default_browse: true,
  },
  {
    id: 21,
    slug: "trump-appoint-conservative-supreme-court-justices",
    relevance: "High",
    impact_direction_for_curation: "Negative",
    curation_priority: "core",
    show_in_default_browse: true,
  },
  {
    id: 22,
    slug: "trump-repeal-replace-aca",
    relevance: "High",
    impact_direction_for_curation: "Negative",
    curation_priority: "core",
    show_in_default_browse: true,
  },
  {
    id: 23,
    slug: "trump-travel-ban-targeted-countries",
    relevance: "Low",
    impact_direction_for_curation: "Negative",
    curation_priority: "deprioritized",
    show_in_default_browse: false,
  },
  {
    id: 24,
    slug: "trump-tax-cuts-jobs-act",
    relevance: "Medium",
    impact_direction_for_curation: "Mixed",
    curation_priority: "secondary",
    show_in_default_browse: true,
  },
  {
    id: 25,
    slug: "trump-first-step-act",
    relevance: "High",
    impact_direction_for_curation: "Positive",
    curation_priority: "core",
    show_in_default_browse: true,
  },
  {
    id: 26,
    slug: "biden-rejoin-paris-climate-agreement",
    relevance: "Medium",
    impact_direction_for_curation: "Positive",
    curation_priority: "secondary",
    show_in_default_browse: true,
  },
  {
    id: 27,
    slug: "biden-cancel-keystone-xl-pipeline",
    relevance: "Medium",
    impact_direction_for_curation: "Positive",
    curation_priority: "secondary",
    show_in_default_browse: true,
  },
  {
    id: 28,
    slug: "biden-nominate-first-black-woman-supreme-court",
    relevance: "High",
    impact_direction_for_curation: "Positive",
    curation_priority: "core",
    show_in_default_browse: true,
  },
  {
    id: 29,
    slug: "biden-forgive-public-college-student-debt",
    relevance: "Medium",
    impact_direction_for_curation: "Mixed",
    curation_priority: "secondary",
    show_in_default_browse: true,
  },
  {
    id: 30,
    slug: "biden-advance-racial-equity-federal-government",
    relevance: "High",
    impact_direction_for_curation: "Mixed",
    curation_priority: "merge_candidate",
    show_in_default_browse: false,
    overlap_group: "federal-racial-equity-framework",
    overlap_note:
      "This record substantially overlaps the existing federal racial-equity record and is kept out of the default browse until an editorial merge decision is made.",
  },
  {
    id: 31,
    slug: "biden-pass-bipartisan-infrastructure-package",
    relevance: "Medium",
    impact_direction_for_curation: "Positive",
    curation_priority: "secondary",
    show_in_default_browse: true,
  },
  {
    id: 32,
    slug: "biden-restore-transgender-military-service",
    relevance: "Low",
    impact_direction_for_curation: "Positive",
    curation_priority: "deprioritized",
    show_in_default_browse: false,
  },
  {
    id: 33,
    slug: "biden-100-million-covid-shots",
    relevance: "Medium",
    impact_direction_for_curation: "Positive",
    curation_priority: "secondary",
    show_in_default_browse: true,
  },
  {
    id: 34,
    slug: "biden-raise-federal-minimum-wage-to-15",
    relevance: "High",
    impact_direction_for_curation: "Blocked/Unrealized",
    curation_priority: "core",
    show_in_default_browse: true,
  },
  {
    id: 35,
    slug: "biden-strengthen-federal-labor-protections",
    relevance: "High",
    impact_direction_for_curation: "Mixed",
    curation_priority: "core",
    show_in_default_browse: true,
  },
  {
    id: 37,
    slug: "obama-homeowner-foreclosure-prevention-fund",
    relevance: "High",
    impact_direction_for_curation: "Negative",
    curation_priority: "core",
    show_in_default_browse: true,
  },
  {
    id: 38,
    slug: "obama-voter-intimidation-deceptive-practices-act",
    relevance: "High",
    impact_direction_for_curation: "Blocked/Unrealized",
    curation_priority: "core",
    show_in_default_browse: true,
  },
  {
    id: 39,
    slug: "trump-ensure-long-term-hbcu-funding",
    relevance: "High",
    impact_direction_for_curation: "Positive",
    curation_priority: "core",
    show_in_default_browse: true,
  },
  {
    id: 40,
    slug: "biden-increase-access-affordable-housing",
    relevance: "High",
    impact_direction_for_curation: "Mixed",
    curation_priority: "core",
    show_in_default_browse: true,
  },
  {
    id: 41,
    slug: "biden-hbcu-msi-affordability",
    relevance: "High",
    impact_direction_for_curation: "Positive",
    curation_priority: "core",
    show_in_default_browse: true,
  },
  {
    id: 42,
    slug: "biden-restore-voting-rights-after-felony-sentences",
    relevance: "High",
    impact_direction_for_curation: "Blocked/Unrealized",
    curation_priority: "core",
    show_in_default_browse: true,
  },
];

const CURATION_BY_ID = new Map(
  PROMISE_CURATION_ENTRIES.filter((entry) => entry.id != null).map((entry) => [entry.id, entry])
);

const CURATION_BY_SLUG = new Map(
  PROMISE_CURATION_ENTRIES.filter((entry) => entry.slug).map((entry) => [entry.slug, entry])
);

const RELEVANCE_SORT_ORDER = {
  High: 0,
  Medium: 1,
  Low: 2,
};

const PRIORITY_SORT_ORDER = {
  core: 0,
  secondary: 1,
  deprioritized: 2,
  merge_candidate: 3,
};

const KEYWORD_FALLBACKS = [
  {
    test: /racial|voting|polic|criminal justice|housing|redlining|minimum wage|labor|health|supreme court|court|education|wealth/i,
    relevance: "High",
  },
  {
    test: /tax|climate|infrastructure|debt|consumer|econom|trade|covid|public health/i,
    relevance: "Medium",
  },
];

function inferFallbackRelevance(record = {}) {
  const haystack = [record.title, record.topic, record.summary, record.impacted_group]
    .filter(Boolean)
    .join(" ");

  for (const fallback of KEYWORD_FALLBACKS) {
    if (fallback.test.test(haystack)) {
      return fallback.relevance;
    }
  }

  return "Low";
}

function inferFallbackImpactDirection(record = {}) {
  if (record.status === "Blocked") {
    return "Blocked/Unrealized";
  }

  if (record.status === "Failed") {
    return "Negative";
  }

  if (record.status === "Delivered") {
    return "Positive";
  }

  return "Mixed";
}

export function getPromiseCuration(record = {}) {
  const explicit = CURATION_BY_SLUG.get(record.slug) || CURATION_BY_ID.get(record.id);

  if (explicit) {
    return explicit;
  }

  const relevance = inferFallbackRelevance(record);
  return {
    relevance,
    impact_direction_for_curation: inferFallbackImpactDirection(record),
    curation_priority: relevance === "Low" ? "deprioritized" : "secondary",
    show_in_default_browse: relevance !== "Low",
  };
}

export function applyPromiseCuration(record = {}) {
  const curation = getPromiseCuration(record);
  return {
    ...record,
    relevance: curation.relevance,
    impact_direction_for_curation: curation.impact_direction_for_curation,
    curation_priority: curation.curation_priority,
    show_in_default_browse: Boolean(curation.show_in_default_browse),
    overlap_group: curation.overlap_group || null,
    overlap_note: curation.overlap_note || null,
  };
}

export function comparePromiseCuration(a = {}, b = {}) {
  const relevanceDiff =
    (RELEVANCE_SORT_ORDER[a.relevance] ?? 99) -
    (RELEVANCE_SORT_ORDER[b.relevance] ?? 99);

  if (relevanceDiff !== 0) {
    return relevanceDiff;
  }

  const priorityDiff =
    (PRIORITY_SORT_ORDER[a.curation_priority] ?? 99) -
    (PRIORITY_SORT_ORDER[b.curation_priority] ?? 99);

  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  return 0;
}

export function getDefaultBrowsePromiseSlugs() {
  return PROMISE_CURATION_ENTRIES
    .filter((entry) => entry.show_in_default_browse)
    .map((entry) => entry.slug);
}

export function getPrioritizedPromiseSlugs() {
  return PROMISE_CURATION_ENTRIES
    .filter((entry) => entry.relevance === "High" || entry.relevance === "Medium")
    .map((entry) => entry.slug);
}
