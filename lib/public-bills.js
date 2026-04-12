import { buildFutureBillDetailHref } from "@/lib/shareable-card-links";

const POSITIVE_KEYWORDS = [
  "expand",
  "fund",
  "funding",
  "protect",
  "protection",
  "restore",
  "rebuild",
  "invest",
  "investment",
  "access",
  "affordable",
  "equity",
  "rights",
  "justice",
  "support",
  "opportunity",
  "coverage",
  "desegreg",
  "housing choice",
  "voting rights",
  "civil rights",
  "maternal health",
  "public defense",
  "reentry",
  "fairness",
  "grant",
  "grants",
  "authorize",
  "codify",
];

const NEGATIVE_KEYWORDS = [
  "ban",
  "bans",
  "restrict",
  "restriction",
  "restrictive",
  "cut",
  "cuts",
  "eliminate",
  "eliminates",
  "criminal",
  "criminalize",
  "punish",
  "punitive",
  "detain",
  "surveil",
  "rollback",
  "repeal",
  "bar",
  "bars",
  "voter purge",
  "mandatory minimum",
  "disenfranchise",
  "deny",
  "exclusion",
  "exclusionary",
];

const STRONG_ENFORCEMENT_KEYWORDS = [
  "require",
  "requires",
  "prohibit",
  "prohibits",
  "enforce",
  "enforcement",
  "restore",
  "codify",
  "protect",
  "establish",
  "guarantee",
];

const FUNDING_KEYWORDS = [
  "fund",
  "funding",
  "grant",
  "grants",
  "invest",
  "investment",
  "appropriate",
  "appropriation",
  "authorize",
];

const SYMBOLIC_KEYWORDS = [
  "study",
  "report",
  "commission",
  "sense of congress",
  "resolution",
  "resolutions",
];

const DOMAIN_RULES = [
  {
    label: "Voting",
    score: 28,
    aliases: [
      "voting",
      "voting rights",
      "elections",
      "election",
      "ballot access",
      "preclearance",
      "redistricting",
      "democracy",
      "franchise",
    ],
    keywords: ["voting", "election", "ballot", "franchise", "redistrict", "democracy"],
  },
  {
    label: "Criminal Justice",
    score: 26,
    aliases: [
      "criminal justice",
      "public safety",
      "sentencing",
      "policing",
      "reentry",
      "expungement",
      "bail",
      "incarceration",
    ],
    keywords: ["criminal justice", "sentencing", "policing", "prison", "incarcer", "reentry", "bail"],
  },
  {
    label: "Housing",
    score: 24,
    aliases: [
      "housing",
      "fair housing",
      "housing affordability",
      "homeownership",
      "tenant",
      "mortgage",
      "appraisal",
      "homelessness",
    ],
    keywords: ["housing", "tenant", "rent", "mortgage", "homeless", "zoning", "public housing"],
  },
  {
    label: "Education",
    score: 22,
    aliases: [
      "education",
      "higher education",
      "k-12",
      "school",
      "schools",
      "students",
      "hbcu",
      "hbcus",
      "minority-serving institutions",
    ],
    keywords: ["education", "school", "college", "student", "campus", "teacher"],
  },
  {
    label: "Economic Opportunity",
    score: 20,
    aliases: [
      "economic opportunity",
      "economic",
      "workforce",
      "wages",
      "labor",
      "small business",
      "wealth",
      "procurement",
      "entrepreneurship",
    ],
    keywords: ["economic", "labor", "wage", "employment", "worker", "small business", "wealth"],
  },
  {
    label: "Health",
    score: 20,
    aliases: [
      "health",
      "health care",
      "healthcare",
      "maternal health",
      "medicaid",
      "care access",
      "public health",
    ],
    keywords: ["health", "maternal", "medicaid", "medicare", "hospital", "care access", "public health"],
  },
  {
    label: "Environment",
    score: 16,
    aliases: [
      "environment",
      "environmental justice",
      "climate",
      "pollution",
      "water",
      "air quality",
      "environmental racism",
    ],
    keywords: ["environment", "climate", "pollution", "water", "air quality", "environmental justice"],
  },
];

const POLICY_AREA_RULES = [
  {
    label: "Voting Rights",
    domain: "Voting",
    keywords: ["voting rights", "voting", "voter registration", "preclearance"],
  },
  {
    label: "Ballot Access",
    domain: "Voting",
    keywords: ["ballot access", "election access", "ballot", "elections", "election administration"],
  },
  {
    label: "Redistricting",
    domain: "Voting",
    keywords: ["redistrict", "district maps", "districting"],
  },
  {
    label: "Fair Housing",
    domain: "Housing",
    keywords: ["fair housing", "housing discrimination", "redlining", "appraisal", "appraisal bias"],
  },
  {
    label: "Housing Affordability",
    domain: "Housing",
    keywords: ["affordable housing", "housing affordability", "rent", "tenant", "public housing", "homeless"],
  },
  {
    label: "Homeownership",
    domain: "Housing",
    keywords: ["homeownership", "mortgage", "home buyer", "homebuyer", "down payment", "lending"],
  },
  {
    label: "Sentencing and Reentry",
    domain: "Criminal Justice",
    keywords: ["sentencing", "reentry", "expungement", "incarcer", "prison", "bail"],
  },
  {
    label: "Policing",
    domain: "Criminal Justice",
    keywords: ["policing", "police", "law enforcement", "public safety"],
  },
  {
    label: "Higher Education",
    domain: "Education",
    keywords: ["higher education", "college", "university", "campus", "tuition", "student aid"],
  },
  {
    label: "HBCUs and MSIs",
    domain: "Education",
    keywords: [
      "hbcu",
      "hbcus",
      "historically black colleges",
      "minority-serving institution",
      "minority-serving institutions",
      "title iii",
      "title v",
    ],
  },
  {
    label: "K-12 Education",
    domain: "Education",
    keywords: ["k-12", "school", "schools", "teacher", "district", "student discipline"],
  },
  {
    label: "Workforce and Wages",
    domain: "Economic Opportunity",
    keywords: ["workforce", "labor", "wage", "employment", "worker", "apprenticeship", "job training"],
  },
  {
    label: "Small Business and Capital",
    domain: "Economic Opportunity",
    keywords: ["small business", "entrepreneur", "procurement", "contracting", "credit", "capital", "wealth"],
  },
  {
    label: "Health Care Access",
    domain: "Health",
    keywords: ["health care", "healthcare", "medicaid", "coverage", "clinic", "hospital", "public health"],
  },
  {
    label: "Maternal Health",
    domain: "Health",
    keywords: ["maternal", "postpartum", "birth", "doula", "pregnan"],
  },
  {
    label: "Environmental Justice",
    domain: "Environment",
    keywords: ["environmental justice", "pollution", "water", "air quality", "climate", "environmental racism"],
  },
];

const TAXONOMY_SOURCE_PRIORITY = {
  keyword_fallback: 1,
  normalized: 2,
  explicit: 3,
};

const RELATIONSHIP_TYPE_PRIORITY = {
  explicit_link: 4,
  explainer_context: 3,
  promise_link: 3,
  policy_lineage: 2,
  historical_context: 1,
  shared_target_area: 1,
};

const RELATIONSHIP_TYPE_CONFIDENCE = {
  explicit_link: "High",
  explainer_context: "High",
  promise_link: "High",
  policy_lineage: "Medium",
  historical_context: "Low",
  shared_target_area: "Low",
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function average(values = []) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeSlugPart(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => toArray(item));
  }

  const normalized = normalizeText(value);
  if (!normalized) {
    return [];
  }

  if (/[|;,]/.test(normalized)) {
    return normalized
      .split(/[|;,]/)
      .map((item) => normalizeText(item))
      .filter(Boolean);
  }

  return [normalized];
}

function dedupeBy(items = [], getKey) {
  const seen = new Set();
  const results = [];

  for (const item of items) {
    const key = getKey(item);

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    results.push(item);
  }

  return results;
}

function countKeywordMatches(text, keywords) {
  const normalized = normalizeText(text).toLowerCase();

  if (!normalized) {
    return 0;
  }

  return keywords.reduce((count, keyword) => {
    return normalized.includes(keyword) ? count + 1 : count;
  }, 0);
}

function getDomainRule(label) {
  return DOMAIN_RULES.find((rule) => rule.label === label) || null;
}

function matchRulesFromText(text, rules, key = "keywords") {
  const normalized = normalizeText(text).toLowerCase();

  if (!normalized) {
    return [];
  }

  return rules.filter((rule) => {
    const values = rule[key] || [];
    return values.some((value) => normalized.includes(String(value).toLowerCase()));
  });
}

function compareDomainLabels(left, right, domainScores) {
  const leftRule = getDomainRule(left);
  const rightRule = getDomainRule(right);

  return (
    Number(domainScores.get(right) || 0) - Number(domainScores.get(left) || 0) ||
    Number(rightRule?.score || 0) - Number(leftRule?.score || 0) ||
    String(left).localeCompare(String(right))
  );
}

function comparePolicyAreas(left, right, policyAreaScores) {
  return (
    Number(policyAreaScores.get(right) || 0) - Number(policyAreaScores.get(left) || 0) ||
    String(left).localeCompare(String(right))
  );
}

function scoreTaxonomyMatches(items, source, domainScores, policyAreaScores, matchSources) {
  const weight = TAXONOMY_SOURCE_PRIORITY[source] || 1;

  for (const text of items) {
    const matchedDomains = unique([
      ...matchRulesFromText(text, DOMAIN_RULES, "aliases").map((rule) => rule.label),
      ...matchRulesFromText(text, DOMAIN_RULES).map((rule) => rule.label),
    ]);
    const matchedPolicyAreas = unique(
      matchRulesFromText(text, POLICY_AREA_RULES).map((rule) => rule.label)
    );

    for (const label of matchedDomains) {
      domainScores.set(label, Number(domainScores.get(label) || 0) + weight * 2);
      matchSources.set(
        label,
        Math.max(Number(matchSources.get(label) || 0), TAXONOMY_SOURCE_PRIORITY[source] || 0)
      );
    }

    for (const label of matchedPolicyAreas) {
      const policyAreaRule = POLICY_AREA_RULES.find((rule) => rule.label === label);
      policyAreaScores.set(label, Number(policyAreaScores.get(label) || 0) + weight * 2);

      if (policyAreaRule?.domain) {
        domainScores.set(
          policyAreaRule.domain,
          Number(domainScores.get(policyAreaRule.domain) || 0) + weight * 2
        );
        matchSources.set(
          policyAreaRule.domain,
          Math.max(
            Number(matchSources.get(policyAreaRule.domain) || 0),
            TAXONOMY_SOURCE_PRIORITY[source] || 0
          )
        );
      }
    }
  }
}

function getTaxonomySourceLabel(priority = 0) {
  if (priority >= TAXONOMY_SOURCE_PRIORITY.explicit) {
    return "explicit";
  }

  if (priority >= TAXONOMY_SOURCE_PRIORITY.normalized) {
    return "normalized";
  }

  return "keyword_fallback";
}

function getExplicitTaxonomyValues(entry) {
  return unique([
    ...toArray(entry.policyArea),
    ...toArray(entry.policyAreas),
    ...toArray(entry.issueCategory),
    ...toArray(entry.issueCategories),
    ...toArray(entry.subjectLabels),
    ...toArray(entry.subjects),
    ...toArray(entry.tags),
  ]);
}

function getTrackedBillExplicitTaxonomy(trackedBill = {}) {
  const nestedTaxonomy = trackedBill.taxonomy || {};

  return {
    policyArea:
      trackedBill.policy_area || trackedBill.policyArea || nestedTaxonomy.policy_area || nestedTaxonomy.policyArea || null,
    policyAreas: toArray(
      trackedBill.policy_areas || trackedBill.policyAreas || nestedTaxonomy.policy_areas || nestedTaxonomy.policyAreas
    ),
    issueCategory:
      trackedBill.issue_category ||
      trackedBill.issueCategory ||
      nestedTaxonomy.issue_category ||
      nestedTaxonomy.issueCategory ||
      null,
    issueCategories: toArray(
      trackedBill.issue_categories ||
        trackedBill.issueCategories ||
        nestedTaxonomy.issue_categories ||
        nestedTaxonomy.issueCategories
    ),
    subjectLabels: toArray(
      trackedBill.subject_labels ||
        trackedBill.subjectLabels ||
        trackedBill.subjects ||
        nestedTaxonomy.subject_labels ||
        nestedTaxonomy.subjectLabels ||
        nestedTaxonomy.subjects
    ),
    tags: toArray(trackedBill.tags || nestedTaxonomy.tags),
  };
}

function getNormalizedTaxonomyValues(entry) {
  return unique([
    ...entry.linkedFutureBills.map((item) => normalizeText(item.targetArea)),
    ...entry.relatedExplainers.map((item) => normalizeText(item.category)),
    ...(entry.relatedPolicies || []).flatMap((item) => [
      normalizeText(item.policyType),
      normalizeText(item.title),
    ]),
    ...(entry.relatedPromises || []).flatMap((item) => [normalizeText(item.topic)]),
    ...entry.actions.map((action) => normalizeText(action.committee_name)),
  ]);
}

function getKeywordFallbackTaxonomyValues(entry) {
  return unique([
    entry.title,
    entry.billNumber,
    entry.officialSummary,
    entry.latestAction,
    ...entry.actions.flatMap((action) => [action.text, action.type]),
    ...entry.linkedFutureBills.flatMap((item) => [
      item.title,
      item.problemStatement,
      item.proposedSolution,
      item.targetArea,
    ]),
    ...entry.relatedExplainers.flatMap((item) => [item.title, item.summary]),
  ]);
}

function getConfidenceTone(label) {
  if (label === "High") {
    return "success";
  }

  if (label === "Medium") {
    return "info";
  }

  if (label === "Low") {
    return "warning";
  }

  return "default";
}

function getRelationshipPriority(type) {
  return Number(RELATIONSHIP_TYPE_PRIORITY[type] || 0);
}

function getRelationshipConfidence(type) {
  return RELATIONSHIP_TYPE_CONFIDENCE[type] || "Low";
}

function buildPolicyDetailHref(policy) {
  const idPart = String(policy?.id || "").trim();
  const titlePart = normalizeSlugPart(policy?.title || `policy-${idPart || "record"}`);
  return idPart ? `/policies/${idPart}-${titlePart}` : "/policies";
}

function buildPromiseDetailHref(promise) {
  return promise?.slug ? `/promises/${promise.slug}` : "/promises";
}

function buildPresidentDetailHref(president) {
  return president?.slug ? `/presidents/${president.slug}` : "/presidents";
}

function choosePreferredRelationshipType(currentType, nextType) {
  return getRelationshipPriority(nextType) > getRelationshipPriority(currentType)
    ? nextType
    : currentType;
}

export function formatRelationshipTypeLabel(type) {
  switch (type) {
    case "explicit_link":
      return "Explicit link";
    case "explainer_context":
      return "Explainer context";
    case "promise_link":
      return "Promise link";
    case "policy_lineage":
      return "Policy lineage";
    case "historical_context":
      return "Historical context";
    case "shared_target_area":
      return "Shared target area";
    default:
      return "Linked context";
  }
}

function getTrackedBillStatusTone(status) {
  switch (status) {
    case "Enacted":
      return "success";
    case "Passed House":
    case "Passed Senate":
    case "Introduced":
      return "info";
    case "Failed":
    case "Stalled":
      return "danger";
    default:
      return "default";
  }
}

function buildBillTaxonomy(entry) {
  const domainScores = new Map();
  const policyAreaScores = new Map();
  const matchSources = new Map();

  const explicitValues = getExplicitTaxonomyValues(entry);
  const normalizedValues = getNormalizedTaxonomyValues(entry);
  const keywordValues = getKeywordFallbackTaxonomyValues(entry);

  scoreTaxonomyMatches(explicitValues, "explicit", domainScores, policyAreaScores, matchSources);
  scoreTaxonomyMatches(
    normalizedValues,
    "normalized",
    domainScores,
    policyAreaScores,
    matchSources
  );
  scoreTaxonomyMatches(
    keywordValues,
    "keyword_fallback",
    domainScores,
    policyAreaScores,
    matchSources
  );

  const domains = [...domainScores.keys()]
    .filter((label) => Number(domainScores.get(label) || 0) > 0)
    .sort((left, right) => compareDomainLabels(left, right, domainScores));
  const primaryDomain = domains[0] || null;
  const secondaryDomains = domains.slice(1, 4);

  const policyAreas = [...policyAreaScores.keys()]
    .filter((label) => Number(policyAreaScores.get(label) || 0) > 0)
    .sort((left, right) => comparePolicyAreas(left, right, policyAreaScores))
    .slice(0, 5);
  const fallbackPolicyAreas = policyAreas.length ? policyAreas : primaryDomain ? [primaryDomain] : [];
  const topicTags = unique([primaryDomain, ...fallbackPolicyAreas, ...secondaryDomains])
    .filter(Boolean)
    .slice(0, 4);

  const highestSourcePriority = Math.max(
    ...domains.map((label) => Number(matchSources.get(label) || 0)),
    0
  );

  return {
    primary_domain: primaryDomain,
    secondary_domains: secondaryDomains,
    policy_areas: fallbackPolicyAreas,
    topic_tags: topicTags,
    taxonomy_source: getTaxonomySourceLabel(highestSourcePriority),
  };
}

function buildTopicTags(taxonomy) {
  return Array.isArray(taxonomy?.topic_tags) ? taxonomy.topic_tags.slice(0, 4) : [];
}

function buildImpactHaystack(entry) {
  return [
    entry.title,
    entry.billNumber,
    entry.officialSummary,
    entry.latestAction,
    ...entry.topicTags,
    ...entry.linkedFutureBills.flatMap((item) => [
      item.title,
      item.problemStatement,
      item.proposedSolution,
      item.targetArea,
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getIntentSignals(entry) {
  const haystack = buildImpactHaystack(entry);
  const positiveMatches = countKeywordMatches(haystack, POSITIVE_KEYWORDS);
  const negativeMatches = countKeywordMatches(haystack, NEGATIVE_KEYWORDS);

  let intentStrength = 0;

  if (positiveMatches === 0 && negativeMatches === 0) {
    intentStrength = entry.linkedFutureBills.length ? 0.65 : 0;
  } else {
    intentStrength = clamp(
      (positiveMatches - negativeMatches) / Math.max(positiveMatches + negativeMatches, 2),
      -1,
      1
    );
  }

  return {
    haystack,
    positiveMatches,
    negativeMatches,
    intentStrength,
  };
}

function getMatchedDomainRules(haystack) {
  return DOMAIN_RULES.map((rule) => ({
    ...rule,
    matchCount: countKeywordMatches(haystack, rule.keywords),
  }))
    .filter((rule) => rule.matchCount > 0)
    .sort((left, right) => right.score - left.score || right.matchCount - left.matchCount);
}

function computeDomainImpact(entry, intentSignals) {
  const taxonomyDomains = unique([
    entry.taxonomy?.primary_domain,
    ...(entry.taxonomy?.secondary_domains || []),
  ]).filter(Boolean);

  if (taxonomyDomains.length) {
    const domainScores = taxonomyDomains
      .map((label) => getDomainRule(label)?.score || 0)
      .filter(Boolean);
    const baseMagnitude = domainScores.length
      ? clamp(
          Math.round(
            average(domainScores.slice(0, 2)) +
              Math.min((entry.taxonomy?.policy_areas || []).length, 2)
          ),
          12,
          30
        )
      : 16;

    return Math.round(baseMagnitude * intentSignals.intentStrength);
  }

  const matched = getMatchedDomainRules(intentSignals.haystack);
  const baseMagnitude = matched.length
    ? clamp(Math.round(average(matched.slice(0, 2).map((item) => item.score)) + (matched.length > 1 ? 2 : 0)), 12, 30)
    : 16;

  return Math.round(baseMagnitude * intentSignals.intentStrength);
}

function computePopulationReach(entry, intentSignals) {
  const isNational =
    Boolean(entry.chamber) ||
    /^h|^s/i.test(normalizeText(entry.billNumber)) ||
    /federal|united states|national|congress/i.test(normalizeText(entry.jurisdiction));

  let magnitude = isNational ? 18 : entry.jurisdiction ? 12 : 8;

  if (entry.linkedFutureBills.length > 1) {
    magnitude += 2;
  }

  return Math.round(clamp(magnitude, 6, 20) * intentSignals.intentStrength);
}

function computeEnforcementStrength(entry, intentSignals) {
  const text = intentSignals.haystack;

  let magnitude = 10;

  if (/hres|sres|hjres|sjres/i.test(normalizeText(entry.billNumber)) || countKeywordMatches(text, SYMBOLIC_KEYWORDS) > 0) {
    magnitude = 6;
  } else if (countKeywordMatches(text, STRONG_ENFORCEMENT_KEYWORDS) > 0) {
    magnitude = 16;
  } else if (countKeywordMatches(text, FUNDING_KEYWORDS) > 0) {
    magnitude = 12;
  }

  return Math.round(magnitude * intentSignals.intentStrength);
}

function computeLegislativeProgress(entry, intentSignals) {
  let magnitude = 2;

  if (entry.status === "Enacted") {
    magnitude = 10;
  } else if (entry.status === "Passed House" || entry.status === "Passed Senate") {
    magnitude = 7;
  } else if (entry.status === "Introduced") {
    magnitude = 4;
  } else if (entry.status === "Failed" || entry.status === "Stalled") {
    magnitude = 0;
  }

  return Math.round(magnitude * intentSignals.intentStrength);
}

function computeRiskModifier(entry, intentSignals) {
  if (intentSignals.negativeMatches <= 0) {
    return 0;
  }

  let magnitude = 6 + intentSignals.negativeMatches * 4;

  if (entry.status === "Enacted") {
    magnitude += 4;
  } else if (entry.status === "Passed House" || entry.status === "Passed Senate") {
    magnitude += 2;
  }

  return -clamp(magnitude, 6, 26);
}

function computeImpactConfidence(entry) {
  if (entry.sourceCount <= 0) {
    return "Low";
  }

  let score = 0;

  if (entry.sourceCount >= 4) {
    score += 2;
  } else if (entry.sourceCount >= 2) {
    score += 1;
  }

  if (entry.relatedExplainers.length > 0) {
    score += 1;
  }

  if (entry.linkedFutureBills.length > 0) {
    score += 1;
  }

  const completenessCount = [
    entry.status,
    entry.chamber,
    entry.introducedDate,
    entry.latestAction,
    entry.sponsor,
    entry.officialSummary,
  ].filter(Boolean).length;

  if (completenessCount >= 4) {
    score += 1;
  }

  if ((entry.actions || []).length > 1) {
    score += 1;
  }

  if (entry.taxonomy?.primary_domain) {
    score += 1;
  }

  if (entry.taxonomy?.taxonomy_source === "explicit") {
    score += 1;
  } else if (entry.taxonomy?.taxonomy_source === "normalized") {
    score += 0.5;
  }

  if (entry.sourceCount >= 4 && score >= 5) {
    return "High";
  }

  if (score >= 3) {
    return "Medium";
  }

  return "Low";
}

function getConfidenceScoreModifier(confidenceLabel, scoreWithoutConfidence) {
  if (Math.abs(scoreWithoutConfidence) < 8) {
    return 0;
  }

  const magnitude =
    confidenceLabel === "High"
      ? 8
      : confidenceLabel === "Medium"
        ? 4
        : 0;

  return Math.sign(scoreWithoutConfidence) * magnitude;
}

function getImpactDirection(score) {
  if (score > 25) {
    return "Positive";
  }

  if (score < -25) {
    return "Negative";
  }

  return "Mixed";
}

function buildReviewProxy(impactConfidence, entry) {
  if (
    impactConfidence === "High" &&
    entry.sourceCount >= 3 &&
    (entry.relatedExplainers.length > 0 || entry.linkedFutureBills.length > 0)
  ) {
    return "Reviewed Proxy";
  }

  return "Needs Review";
}

function buildBillSources(entry) {
  const items = [];

  if (entry.sourceUrl) {
    items.push({
      source_title: entry.billNumber
        ? `${entry.billNumber}: ${entry.title}`
        : entry.title,
      source_url: entry.sourceUrl,
      source_type: entry.sourceSystem || "Legislative record",
      publisher: entry.jurisdiction || "Congress.gov",
      published_date: entry.latestActionDate || entry.introducedDate || null,
      notes: entry.officialSummary || null,
    });
  }

  for (const action of entry.actions || []) {
    if (!action?.source_url) {
      continue;
    }

    items.push({
      source_title: action.text || action.type || `${entry.billNumber} action`,
      source_url: action.source_url,
      source_type: action.type || "Legislative action",
      publisher:
        [action.chamber, action.committee_name].filter(Boolean).join(" • ") ||
        entry.jurisdiction ||
        null,
      published_date: action.date || null,
      notes: action.committee_name ? `Committee: ${action.committee_name}` : null,
    });
  }

  return dedupeBy(items, (item) =>
    JSON.stringify([
      item.source_title || "",
      item.source_url || "",
      item.published_date || "",
    ])
  );
}

function buildBillTimeline(entry) {
  const timeline = [];

  if (entry.introducedDate) {
    timeline.push({
      date: entry.introducedDate,
      label: "Introduced",
      summary: [
        entry.billNumber,
        entry.sponsor ? `introduced by ${entry.sponsor}` : null,
        entry.sessionLabel,
      ]
        .filter(Boolean)
        .join(" • "),
    });
  }

  for (const action of entry.actions || []) {
    timeline.push({
      date: action.date || null,
      label: action.type || entry.status || "Action",
      summary: action.text || "Tracked action recorded.",
    });
  }

  if (!timeline.length) {
    timeline.push({
      label: "Tracked record",
      summary:
        "This bill is in the public tracked-bill dataset, but no dated legislative timeline has been surfaced yet.",
    });
  }

  return timeline.sort((left, right) => {
    return (
      String(right.date || "").localeCompare(String(left.date || "")) ||
      String(left.label || "").localeCompare(String(right.label || ""))
    );
  });
}

function buildRelatedExplainers(linkedFutureBills = []) {
  return dedupeBy(
    linkedFutureBills.flatMap((item) => item.relatedExplainers || []),
    (item) => item.id || item.slug || item.title
  ).map((item) => ({
    ...item,
    href: item.slug ? `/explainers/${item.slug}` : "/explainers",
  }));
}

function buildLinkedLegislators(entry) {
  return dedupeBy(entry.linkedLegislators || [], (item) => item.id).slice(0, 6);
}

function buildCongressSearchUrl(entry) {
  if (entry.sourceUrl && entry.sourceUrl.includes("congress.gov")) {
    return entry.sourceUrl;
  }

  const query = encodeURIComponent(entry.billNumber || entry.title || "");
  return `https://www.congress.gov/search?q=${query}`;
}

function buildPolicyHistoryItems(entry) {
  const policyItems = (entry.relatedPolicies || []).map((item) => ({
    kind: "Policy history",
    title: item.title,
    href: item.href,
    summary:
      item.summary ||
      [item.yearEnacted ? `Enacted ${item.yearEnacted}` : null, item.presidentName, item.policyType]
        .filter(Boolean)
        .join(" • ") ||
      "Open the related policy record for historical context.",
  }));

  const futureBillItems = entry.linkedFutureBills.map((item) => ({
    kind: "Future bill context",
    title: item.title,
    href: item.href,
    summary:
      item.problemStatement ||
      item.proposedSolution ||
      item.targetArea ||
      "Open the related future-bill page for longer-form public context.",
  }));

  const explainerItems = entry.relatedExplainers.map((item) => ({
    kind: item.category || "Explainer",
    title: item.title,
    href: item.href,
    summary:
      item.summary ||
      "Open the explainer for additional public history and linked records.",
  }));

  return [...policyItems, ...futureBillItems, ...explainerItems].slice(0, 6);
}

function buildWhyItMatters(entry) {
  if (normalizeText(entry.officialSummary)) {
    return entry.officialSummary;
  }

  const linkedConcept = entry.linkedFutureBills.find(
    (item) => normalizeText(item.problemStatement) || normalizeText(item.proposedSolution)
  );

  if (linkedConcept?.problemStatement) {
    return linkedConcept.problemStatement;
  }

  if (linkedConcept?.proposedSolution) {
    return linkedConcept.proposedSolution;
  }

  const topicText = entry.topicTags.length ? entry.topicTags.join(", ") : "tracked equity priorities";
  return `This bill is connected to ${topicText} in the current EquityStack legislative dataset.`;
}

function buildImpactBreakdownItems(impactBreakdown = {}) {
  return [
    {
      key: "domain",
      label: "Domain",
      value: Number(impactBreakdown.domain || 0),
      description: "Issue-area baseline from the bill's linked domain and topic context.",
    },
    {
      key: "reach",
      label: "Reach",
      value: Number(impactBreakdown.reach || 0),
      description: "Estimated scope based on national versus narrower coverage signals.",
    },
    {
      key: "enforcement",
      label: "Enforcement",
      value: Number(impactBreakdown.enforcement || 0),
      description: "Estimated force of the bill, from symbolic language up to enforceable provisions.",
    },
    {
      key: "progress",
      label: "Progress",
      value: Number(impactBreakdown.progress || 0),
      description: "Legislative advancement modifier based on the current tracked status.",
    },
    {
      key: "risk",
      label: "Risk",
      value: Number(impactBreakdown.risk || 0),
      description: "Negative modifier from rollback, restriction, or harm indicators in the current record.",
    },
  ];
}

function buildRelatedPolicies(linkedFutureBills = []) {
  return dedupeBy(
    linkedFutureBills.flatMap((item) => item.relatedPolicies || []),
    (item) => item.id || item.title
  )
    .map((item) => ({
      id: item.id,
      title: item.title,
      yearEnacted: item.yearEnacted || null,
      policyType: item.policyType || null,
      status: item.status || null,
      impactDirection: item.impactDirection || null,
      presidentSlug: item.presidentSlug || null,
      presidentName: item.presidentName || null,
      href: buildPolicyDetailHref(item),
      summary:
        [
          item.yearEnacted ? `Enacted ${item.yearEnacted}` : null,
          item.policyType,
          item.presidentName,
        ]
          .filter(Boolean)
          .join(" • ") || null,
    }))
    .sort((left, right) => {
      return (
        Number(right.yearEnacted || 0) - Number(left.yearEnacted || 0) ||
        String(left.title || "").localeCompare(String(right.title || ""))
      );
    });
}

function buildRelatedPromises(linkedFutureBills = []) {
  const promiseMap = new Map();

  for (const item of linkedFutureBills) {
    for (const promise of item.relatedPromises || []) {
      const key = promise.id || promise.slug || promise.title;

      if (!key) {
        continue;
      }

      if (!promiseMap.has(key)) {
        promiseMap.set(key, {
          id: promise.id,
          slug: promise.slug || null,
          title: promise.title || "Untitled promise",
          topic: promise.topic || null,
          status: promise.status || null,
          summary: promise.summary || null,
          presidentSlug: promise.presidentSlug || null,
          presidentName: promise.presidentName || null,
          relationshipType: promise.relationshipType || "policy_lineage",
          matchConfidence: getRelationshipConfidence(promise.relationshipType),
          href: buildPromiseDetailHref(promise),
        });
        continue;
      }

      const existing = promiseMap.get(key);
      const relationshipType = choosePreferredRelationshipType(
        existing.relationshipType,
        promise.relationshipType
      );

      promiseMap.set(key, {
        ...existing,
        topic: existing.topic || promise.topic || null,
        status: existing.status || promise.status || null,
        summary: existing.summary || promise.summary || null,
        presidentSlug: existing.presidentSlug || promise.presidentSlug || null,
        presidentName: existing.presidentName || promise.presidentName || null,
        relationshipType,
        matchConfidence: getRelationshipConfidence(relationshipType),
      });
    }
  }

  return Array.from(promiseMap.values()).sort((left, right) => {
    return (
      getRelationshipPriority(right.relationshipType) -
        getRelationshipPriority(left.relationshipType) ||
      String(left.title || "").localeCompare(String(right.title || ""))
    );
  });
}

function buildRelatedPresidents(relatedPromises = [], relatedPolicies = []) {
  const presidentMap = new Map();

  for (const promise of relatedPromises) {
    const key = promise.presidentSlug || promise.presidentName;

    if (!key) {
      continue;
    }

    presidentMap.set(key, {
      slug: promise.presidentSlug || null,
      name: promise.presidentName || "Unknown president",
      relationshipType: "promise_link",
      matchConfidence: getRelationshipConfidence("promise_link"),
      href: buildPresidentDetailHref({ slug: promise.presidentSlug }),
    });
  }

  for (const policy of relatedPolicies) {
    const key = policy.presidentSlug || policy.presidentName;

    if (!key || presidentMap.has(key)) {
      continue;
    }

    presidentMap.set(key, {
      slug: policy.presidentSlug || null,
      name: policy.presidentName || "Unknown president",
      relationshipType: "policy_lineage",
      matchConfidence: getRelationshipConfidence("policy_lineage"),
      href: buildPresidentDetailHref({ slug: policy.presidentSlug }),
    });
  }

  return Array.from(presidentMap.values()).sort((left, right) => {
    return (
      getRelationshipPriority(right.relationshipType) -
        getRelationshipPriority(left.relationshipType) ||
      String(left.name || "").localeCompare(String(right.name || ""))
    );
  });
}

export function computeBlackImpactScore(entry) {
  const intentSignals = getIntentSignals(entry);
  const domain = computeDomainImpact(entry, intentSignals);
  const reach = computePopulationReach(entry, intentSignals);
  const enforcement = computeEnforcementStrength(entry, intentSignals);
  const progress = computeLegislativeProgress(entry, intentSignals);
  const risk = computeRiskModifier(entry, intentSignals);
  const scoreWithoutConfidence = domain + reach + enforcement + progress + risk;
  const impactConfidence = computeImpactConfidence(entry);
  const confidenceModifier = getConfidenceScoreModifier(
    impactConfidence,
    scoreWithoutConfidence
  );
  const blackImpactScore = clamp(
    Math.round(scoreWithoutConfidence + confidenceModifier),
    -100,
    100
  );
  const impactDirection = getImpactDirection(blackImpactScore);

  return {
    black_impact_score: blackImpactScore,
    blackImpactScore,
    impact_direction: impactDirection,
    impactDirection,
    impact_confidence: impactConfidence,
    impactConfidence,
    impact_breakdown: {
      domain,
      reach,
      enforcement,
      progress,
      risk,
    },
    impactBreakdown: {
      domain,
      reach,
      enforcement,
      progress,
      risk,
    },
  };
}

export function formatBillDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function buildBillSlug(entry) {
  const numberPart = normalizeSlugPart(entry?.billNumber);
  const titlePart = normalizeSlugPart(entry?.title);
  const idPart = String(entry?.id || "").trim();

  return [numberPart, titlePart, idPart].filter(Boolean).join("-");
}

export function buildBillDetailHref(entry) {
  return `/bills/${buildBillSlug(entry)}`;
}

export function getBillBySlug(slug, bills = []) {
  return bills.find((bill) => bill.slug === slug) || null;
}

export function getRelatedBillsForSlug(slug, bills = [], limit = 4) {
  const currentBill = getBillBySlug(slug, bills);

  if (!currentBill) {
    return [];
  }

  const secondaryDomainSet = new Set(currentBill.secondaryDomains || []);
  const policyAreaSet = new Set(currentBill.policyAreas || []);
  const topicSet = new Set(currentBill.topicTags || []);

  return bills
    .filter((bill) => bill.slug !== slug)
    .map((bill) => {
      const sharedPrimaryDomain =
        Boolean(currentBill.primaryDomain) && bill.primaryDomain === currentBill.primaryDomain;
      const sharedSecondaryDomains = unique([
        ...(sharedPrimaryDomain ? [bill.primaryDomain] : []),
        ...(bill.secondaryDomains || []).filter((domain) => secondaryDomainSet.has(domain)),
      ]);
      const sharedPolicyAreas = (bill.policyAreas || []).filter((item) => policyAreaSet.has(item));
      const sharedTopics = (bill.topicTags || []).filter((topic) => topicSet.has(topic));

      if (
        !sharedPrimaryDomain &&
        !sharedSecondaryDomains.length &&
        !sharedPolicyAreas.length &&
        sharedTopics.length < 2
      ) {
        return null;
      }

      const similarityScore =
        (sharedPrimaryDomain ? 14 : 0) +
        sharedSecondaryDomains.length * 6 +
        sharedPolicyAreas.length * 5 +
        sharedTopics.length * 2 +
        (bill.chamber && bill.chamber === currentBill.chamber ? 2 : 0) +
        (bill.status === currentBill.status ? 1 : 0) +
        (bill.impactDirection === currentBill.impactDirection ? 1 : 0);

      return {
        ...bill,
        relatedDomainOverlap: unique([
          ...(sharedPrimaryDomain ? [bill.primaryDomain] : []),
          ...sharedSecondaryDomains,
        ]),
        relatedPolicyAreaOverlap: sharedPolicyAreas,
        relatedTopicOverlap: unique([...sharedPolicyAreas, ...sharedTopics]).slice(0, 4),
        relatedBillsScore: similarityScore,
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      return (
        right.relatedBillsScore - left.relatedBillsScore ||
        String(right.latestActionDate || "").localeCompare(String(left.latestActionDate || "")) ||
        left.title.localeCompare(right.title)
      );
    })
    .slice(0, limit);
}

export function buildPublicBillsDataset(futureBills = []) {
  const billMap = new Map();

  for (const futureBill of futureBills) {
    const linkedFutureBill = {
      id: futureBill.id,
      title: futureBill.title,
      targetArea: futureBill.target_area,
      priorityLevel: futureBill.priority_level,
      status: futureBill.status,
      problemStatement: futureBill.problem_statement,
      proposedSolution: futureBill.proposed_solution,
      href: buildFutureBillDetailHref(futureBill),
      relatedExplainers: (futureBill.related_explainers || []).map((item) => ({
        id: item.id,
        slug: item.slug,
        title: item.title,
        summary: item.summary,
        category: item.category,
      })),
      relatedPolicies: (futureBill.related_policies || []).map((item) => ({
        id: item.id,
        title: item.title,
        yearEnacted: item.year_enacted || null,
        policyType: item.policy_type || null,
        status: item.status || null,
        impactDirection: item.impact_direction || null,
        presidentSlug: item.president_slug || null,
        presidentName: item.president_name || null,
      })),
      relatedPromises: (futureBill.related_promises || []).map((item) => ({
        id: item.id,
        slug: item.slug || null,
        title: item.title,
        topic: item.topic || null,
        status: item.status || null,
        summary: item.summary || null,
        presidentSlug: item.president_slug || null,
        presidentName: item.president_name || null,
        relationshipType: item.relationship_type || "policy_lineage",
      })),
    };

    for (const trackedBill of futureBill.tracked_bills || []) {
      const explicitTaxonomy = getTrackedBillExplicitTaxonomy(trackedBill);

      if (!billMap.has(trackedBill.id)) {
        billMap.set(trackedBill.id, {
          id: trackedBill.id,
          billNumber: trackedBill.bill_number || "Unnumbered bill",
          title: trackedBill.title || "Untitled tracked bill",
          chamber: trackedBill.chamber || null,
          jurisdiction: trackedBill.jurisdiction || null,
          sessionLabel: trackedBill.session_label || null,
          status: trackedBill.status || "Tracked",
          sponsor: trackedBill.sponsor || null,
          officialSummary: trackedBill.official_summary || null,
          sourceUrl: trackedBill.url || null,
          sourceSystem: trackedBill.source_system || null,
          latestAction: trackedBill.latest_action || null,
          latestActionDate: trackedBill.date || trackedBill.introduced_date || null,
          introducedDate: trackedBill.introduced_date || null,
          sponsorCount: Number(trackedBill.sponsor_count || 0),
          legislatorCount: Number(trackedBill.legislator_count || 0),
          actionCount: Number(trackedBill.action_count || 0),
          matchConfidence: Number(trackedBill.match_confidence || 0),
          active: Boolean(trackedBill.active),
          policyArea: explicitTaxonomy.policyArea,
          policyAreas: explicitTaxonomy.policyAreas,
          issueCategory: explicitTaxonomy.issueCategory,
          issueCategories: explicitTaxonomy.issueCategories,
          subjectLabels: explicitTaxonomy.subjectLabels,
          tags: explicitTaxonomy.tags,
          sponsors: trackedBill.sponsors || [],
          actions: trackedBill.actions || [],
          linkedLegislators: trackedBill.linked_legislators || [],
          linkedFutureBills: [],
        });
      }

      billMap.get(trackedBill.id).linkedFutureBills.push(linkedFutureBill);
    }
  }

  return Array.from(billMap.values())
    .map((entry) => {
      const sources = buildBillSources(entry);
      const sourceCount = sources.length;
      const relatedExplainers = buildRelatedExplainers(entry.linkedFutureBills);
      const relatedPolicies = buildRelatedPolicies(entry.linkedFutureBills);
      const relatedPromises = buildRelatedPromises(entry.linkedFutureBills);
      const relatedPresidents = buildRelatedPresidents(relatedPromises, relatedPolicies);
      const taxonomy = buildBillTaxonomy({
        ...entry,
        relatedExplainers,
        relatedPolicies,
        relatedPromises,
      });
      const topicTags = buildTopicTags(taxonomy);

      const scoringEntry = {
        ...entry,
        taxonomy,
        topicTags,
        sourceCount,
        relatedExplainers,
      };
      const impactModel = computeBlackImpactScore(scoringEntry);
      const reviewProxy = buildReviewProxy(impactModel.impactConfidence, scoringEntry);

      const enrichedBill = {
        ...entry,
        ...impactModel,
        taxonomy,
        slug: buildBillSlug(entry),
        detailHref: buildBillDetailHref(entry),
        topicTags,
        primaryDomain: taxonomy.primary_domain,
        secondaryDomains: taxonomy.secondary_domains,
        policyAreas: taxonomy.policy_areas,
        taxonomySource: taxonomy.taxonomy_source,
        sourceCount,
        sources,
        relatedExplainers,
        relatedPolicies,
        relatedPromises,
        relatedPresidents,
        confidenceLabel: impactModel.impactConfidence,
        confidenceTone: getConfidenceTone(impactModel.impactConfidence),
        reviewProxy,
        reviewTone: reviewProxy === "Reviewed Proxy" ? "success" : "warning",
        statusTone: getTrackedBillStatusTone(entry.status),
        projectedImpactScore: impactModel.blackImpactScore,
        projectedImpactDirection: impactModel.impactDirection,
        whyItMatters: buildWhyItMatters({
          ...entry,
          topicTags,
        }),
        primaryContextHref: entry.linkedFutureBills[0]?.href || "/future-bills",
        congressUrl: buildCongressSearchUrl(entry),
        linkedLegislators: buildLinkedLegislators(entry),
        timeline: buildBillTimeline(entry),
        promiseCount: relatedPromises.length,
        presidentCount: relatedPresidents.length,
      };

      return {
        ...enrichedBill,
        impactBreakdownItems: buildImpactBreakdownItems(impactModel.impactBreakdown),
        policyHistoryItems: buildPolicyHistoryItems({
          ...enrichedBill,
          relatedExplainers,
          relatedPolicies,
        }),
      };
    })
    .sort((left, right) => {
      return (
        Number(right.active) - Number(left.active) ||
        Math.abs(Number(right.blackImpactScore || 0)) - Math.abs(Number(left.blackImpactScore || 0)) ||
        String(right.latestActionDate || "").localeCompare(String(left.latestActionDate || "")) ||
        left.billNumber.localeCompare(right.billNumber) ||
        left.title.localeCompare(right.title)
      );
    });
}
