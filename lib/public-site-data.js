import { query } from "@/lib/db";
import { fetchInternalJson } from "@/lib/api";
import { computeOutcomeBasedScores } from "@/lib/services/blackImpactScoreService";
import {
  fetchCurrentAdministrationOverview,
  fetchPromiseDetail,
  fetchPromiseList,
  fetchPromisePresidentDetail,
  fetchPromisePresidentIndex,
  PROMISE_STATUSES,
} from "@/lib/services/promiseService";
import { fetchHomepageReadinessSummary } from "@/lib/services/systemReadinessService";
import {
  getCategorySummary,
  getDirectImpactSummaryByEra,
  getDirectImpactSummaryByParty,
  getOverallSummary,
  getSummaryByEra,
  getSummaryByParty,
} from "@/lib/services/reportService";
import { fetchDashboardPolicyRankings } from "@/lib/services/dashboardPolicyService";
import { summarizeImpactTrend } from "@/lib/black-impact-score/impactTrend";
import { buildPresidentComparison } from "@/lib/black-impact-score/presidentComparison";
import { getExplainerEditorial } from "@/lib/explainer-editorial";
import { POLICY_IMPACT_SCORE_SQL } from "@/lib/analytics/impactAggregator";
import {
  buildCollectionResearchCoverage,
  buildCollectionResearchStrengtheningNote,
  buildEvidenceSignal,
} from "@/lib/evidenceCoverage";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeList(value) {
  return Array.isArray(value)
    ? value.map((item) => normalizeText(item)).filter(Boolean)
    : [];
}

function normalizeStructuredList(value) {
  return Array.isArray(value)
    ? value.filter((item) => item && typeof item === "object")
    : [];
}

function normalizeTextBlockList(value) {
  return String(value || "")
    .split("\n")
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function formatSlugLabel(value) {
  return normalizeText(value)
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function slugify(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function buildPolicySlug(policy) {
  return `${policy.id}-${slugify(policy.title || `policy-${policy.id}`)}`;
}

export function parsePolicyIdFromSlug(slug) {
  const match = String(slug || "").match(/^(\d+)(?:-|$)/);
  return match ? Number(match[1]) : Number.NaN;
}

const ARGUMENT_MECHANICS_SURFACING_RULES = [
  {
    slug: "disparate-impact-vs-intent-claims",
    directPhrases: [
      "not racist",
      "no intent",
      "not intentional",
      "not discriminatory",
      "no discriminatory intent",
      "no racist intent",
      "disparate impact",
    ],
    topicKeywords: [
      "disparate impact",
      "intent",
      "intentional discrimination",
      "neutral policy",
      "neutral rule",
      "discrimination",
      "equal protection",
      "fair housing",
      "civil rights",
      "employment test",
      "selection procedure",
    ],
    tagKeywords: [
      "civil rights",
      "constitutional law",
      "historical context",
      "legal",
      "housing",
      "employment",
      "rights",
    ],
  },
  {
    slug: "systemic-vs-individual-racism-claims",
    directPhrases: [
      "systemic racism isn't real",
      "systemic racism is not real",
      "systemic racism isnt real",
      "individual racism only",
      "just a few bad apples",
    ],
    topicKeywords: [
      "systemic racism",
      "individual racism",
      "institutional",
      "institution",
      "structural",
      "pattern or practice",
      "pattern",
      "aggregate outcomes",
      "police misconduct",
      "institutional bias",
    ],
    tagKeywords: [
      "criminal justice",
      "housing",
      "education",
      "labor and employment",
      "historical context",
      "civil rights",
      "politics",
    ],
  },
  {
    slug: "anecdote-vs-data-claims",
    directPhrases: [
      "that's just one case",
      "that is just one case",
      "i know someone",
      "one story",
      "one example",
      "personal story",
      "lived experience",
    ],
    topicKeywords: [
      "anecdote",
      "data",
      "statistics",
      "measurement",
      "representative",
      "selection bias",
      "survivorship bias",
      "survey",
      "sample",
      "one case",
    ],
    tagKeywords: [
      "misused statistics",
      "education and measurement",
      "election integrity",
      "criminal justice",
      "historical claims",
      "economic claims",
    ],
  },
  {
    slug: "equal-opportunity-claims",
    directPhrases: [
      "individual responsibility",
      "just work harder",
      "work harder",
      "equal opportunity",
      "equal opportunities",
      "level playing field",
      "bootstraps",
    ],
    topicKeywords: [
      "equal opportunity",
      "opportunity",
      "access",
      "mobility",
      "merit",
      "starting conditions",
      "school quality",
      "credit",
      "neighborhood",
      "work harder",
      "individual responsibility",
    ],
    tagKeywords: [
      "economic opportunity",
      "economics",
      "economic claims",
      "housing",
      "education",
      "labor and employment",
      "public benefits",
    ],
  },
  {
    slug: "states-rights-vs-civil-rights-claims",
    directPhrases: [
      "states should decide",
      "state should decide",
      "federal overreach",
      "local control",
      "states rights",
      "states right",
    ],
    topicKeywords: [
      "states rights",
      "states right",
      "federal overreach",
      "local control",
      "civil rights",
      "voting rights",
      "equal protection",
      "segregation",
      "federal enforcement",
      "constitutional",
    ],
    tagKeywords: [
      "historical context",
      "constitutional law",
      "politics",
      "election integrity",
      "civil rights",
      "voting",
      "rights",
    ],
  },
];

const DOMAIN_FALLBACK_EXPLAINER_MAP = [
  {
    keywords: ["crime", "sentencing", "incarceration", "policing", "public safety"],
    slugs: [
      "crime-statistics-context-and-misuse",
      "sentencing-disparities-united-states",
      "mass-incarceration-policy-history",
    ],
  },
  {
    keywords: [
      "civil rights",
      "voting rights",
      "equal protection",
      "segregation",
      "federal enforcement",
    ],
    slugs: [
      "equal-protection-under-the-law",
      "party-voting-records-racial-policy",
      "historical-impact-denial-claims",
    ],
  },
  {
    keywords: ["opportunity", "mobility", "benefits", "merit", "work harder", "access"],
    slugs: [
      "bootstraps-vs-policy-reality",
      "government-benefits-racial-gap",
      "gi-bill-access-and-impact",
    ],
  },
  {
    keywords: ["housing", "homeownership", "credit", "redlining"],
    slugs: [
      "redlining-black-homeownership",
      "gi-bill-access-and-impact",
      "historical-impact-denial-claims",
    ],
  },
  {
    keywords: ["party", "realignment", "southern strategy", "voting coalition"],
    slugs: [
      "party-switch-southern-strategy",
      "party-voting-records-racial-policy",
    ],
  },
  {
    keywords: ["election", "voter fraud", "non citizen", "audit", "ballot"],
    slugs: [
      "non-citizen-voting-claims",
      "party-voting-records-racial-policy",
    ],
  },
  {
    keywords: ["selection bias", "immigration", "comparison", "iq", "measurement"],
    slugs: [
      "immigration-comparison-claims",
      "iq-and-intelligence-gap-claims",
    ],
  },
];

const REPORT_SURFACING_HINTS = {
  "black-impact-score": {
    tagHints: [
      "systemic racism",
      "aggregate outcomes",
      "policy outcomes",
      "measurement",
      "data",
    ],
    fallbackSlugs: [
      "systemic-vs-individual-racism-claims",
      "anecdote-vs-data-claims",
      "disparate-impact-vs-intent-claims",
    ],
  },
  "civil-rights-timeline": {
    tagHints: [
      "civil rights",
      "voting rights",
      "equal protection",
      "federal enforcement",
      "segregation",
    ],
    fallbackSlugs: [
      "states-rights-vs-civil-rights-claims",
      "disparate-impact-vs-intent-claims",
      "party-voting-records-racial-policy",
    ],
  },
  "historical-distribution": {
    tagHints: [
      "historical context",
      "party realignment",
      "aggregate outcomes",
      "civil rights",
    ],
    fallbackSlugs: [
      "party-voting-records-racial-policy",
      "systemic-vs-individual-racism-claims",
      "disparate-impact-vs-intent-claims",
    ],
  },
  "executive-overview": {
    tagHints: [
      "aggregate outcomes",
      "systemic racism",
      "civil rights",
      "historical context",
    ],
    fallbackSlugs: [
      "systemic-vs-individual-racism-claims",
      "anecdote-vs-data-claims",
      "equal-opportunity-claims",
    ],
  },
};

function normalizeClaimMatcher(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueNormalizedValues(values = []) {
  const seen = new Set();
  const results = [];

  for (const value of values) {
    const normalized = normalizeClaimMatcher(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    results.push(normalized);
  }

  return results;
}

function uniquePlainValues(values = []) {
  const seen = new Set();
  const results = [];

  for (const value of values) {
    const normalized = normalizeText(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    results.push(normalized);
  }

  return results;
}

function includesClaimPhrase(text, phrase) {
  const normalizedText = normalizeClaimMatcher(text);
  const normalizedPhrase = normalizeClaimMatcher(phrase);

  if (!normalizedText || !normalizedPhrase) {
    return false;
  }

  return ` ${normalizedText} `.includes(` ${normalizedPhrase} `);
}

function collectClaimPhraseMatches(text, phrases = []) {
  return uniqueNormalizedValues(
    (phrases || []).filter((phrase) => includesClaimPhrase(text, phrase))
  );
}

function buildExplainerSuggestionContext({
  query = "",
  textFields = [],
  tagHints = [],
  categoryHints = [],
  domainHints = [],
} = {}) {
  const normalizedTags = uniqueNormalizedValues([
    ...normalizeList(tagHints),
    ...normalizeList(categoryHints),
    ...normalizeList(domainHints),
  ]);
  const queryText = normalizeClaimMatcher(query);
  const fullText = normalizeClaimMatcher(
    [
      query,
      ...normalizeList(textFields),
      ...normalizedTags,
    ].join(" ")
  );

  return {
    queryText,
    fullText,
    normalizedTags,
    tagText: normalizedTags.join(" "),
  };
}

function scoreArgumentMechanicsRule(rule, context) {
  const queryMatches = collectClaimPhraseMatches(context.queryText, rule.directPhrases);
  const directTextMatches = context.queryText
    ? []
    : collectClaimPhraseMatches(context.fullText, rule.directPhrases);
  const topicMatches = collectClaimPhraseMatches(context.fullText, rule.topicKeywords);
  const tagMatches = collectClaimPhraseMatches(context.tagText, rule.tagKeywords);

  const score =
    queryMatches.length * 140 +
    directTextMatches.length * 85 +
    topicMatches.length * 26 +
    tagMatches.length * 20;

  if (!score) {
    return null;
  }

  const priority = queryMatches.length || directTextMatches.length ? 0 : tagMatches.length ? 1 : 2;

  return {
    score,
    priority,
  };
}

function resolveDomainFallbackSlugs(context, fallbackSlugs = []) {
  const slugs = [...normalizeList(fallbackSlugs)];

  for (const rule of DOMAIN_FALLBACK_EXPLAINER_MAP) {
    if (!collectClaimPhraseMatches(context.fullText, rule.keywords).length) {
      continue;
    }
    slugs.push(...rule.slugs);
  }

  return uniquePlainValues(slugs);
}

function resolveSuggestedExplainers({
  explainers = [],
  query = "",
  textFields = [],
  tagHints = [],
  categoryHints = [],
  domainHints = [],
  fallbackSlugs = [],
  excludeSlugs = [],
  limit = 3,
} = {}) {
  const context = buildExplainerSuggestionContext({
    query,
    textFields,
    tagHints,
    categoryHints,
    domainHints,
  });
  const explainersBySlug = new Map((explainers || []).map((item) => [item.slug, item]));
  const excluded = new Set(normalizeList(excludeSlugs));
  const selected = [];
  const selectedSlugs = new Set();

  const scoredMechanics = ARGUMENT_MECHANICS_SURFACING_RULES.map((rule) => {
    const item = explainersBySlug.get(rule.slug);
    const score = item ? scoreArgumentMechanicsRule(rule, context) : null;
    return score && item && !excluded.has(rule.slug) ? { item, ...score } : null;
  })
    .filter(Boolean)
    .sort(
      (left, right) =>
        left.priority - right.priority ||
        right.score - left.score ||
        left.item.title.localeCompare(right.item.title)
    );

  for (const entry of scoredMechanics) {
    if (selected.length >= limit) break;
    if (selectedSlugs.has(entry.item.slug)) continue;
    selected.push(entry.item);
    selectedSlugs.add(entry.item.slug);
  }

  if (selected.length >= limit) {
    return selected;
  }

  const fallbackCandidates = resolveDomainFallbackSlugs(context, fallbackSlugs)
    .map((slug) => explainersBySlug.get(slug))
    .filter(Boolean);

  for (const item of fallbackCandidates) {
    if (selected.length >= limit) break;
    if (selectedSlugs.has(item.slug) || excluded.has(item.slug)) continue;
    selected.push(item);
    selectedSlugs.add(item.slug);
  }

  return selected.slice(0, limit);
}

function getDirectionTone(score) {
  if (Number(score) > 0) return "positive";
  if (Number(score) < 0) return "negative";
  return "default";
}

function formatTermLabel(start, end) {
  const startYear = start ? new Date(start).getFullYear() : null;
  const endYear = end ? new Date(end).getFullYear() : null;
  if (Number.isFinite(startYear) && Number.isFinite(endYear)) {
    return `${startYear}-${endYear}`;
  }
  if (Number.isFinite(startYear)) {
    return `${startYear}-present`;
  }
  return "Historical record";
}

const PUBLIC_REPORT_DEFINITIONS = [
  {
    slug: "black-impact-score",
    href: "/reports/black-impact-score",
    title: "Black Impact Score",
    summary:
      "The core presidential impact model, with direct and systemic score families, confidence, and evidence-aware interpretation.",
    category: "Flagship report",
    theme: "Scores",
    featured: true,
  },
  {
    slug: "executive-overview",
    href: "/reports/executive-overview",
    title: "Executive Overview",
    summary:
      "A command-center style read of current outcome coverage, top movements, and visible trust signals across the public dataset.",
    category: "Dataset report",
    theme: "Overview",
    featured: true,
  },
  {
    slug: "historical-distribution",
    href: "/reports/historical-distribution",
    title: "Historical Distribution",
    summary:
      "A category-, era-, and party-based view of how the dataset is distributed across time and issue areas.",
    category: "Coverage report",
    theme: "Coverage",
    featured: true,
  },
  {
    slug: "civil-rights-timeline",
    href: "/reports/civil-rights-timeline",
    title: "Civil Rights Timeline",
    summary:
      "A curated historical arc connecting federal civil-rights commitments, continuity, and retrenchment across eras.",
    category: "Historical report",
    theme: "Timeline",
    featured: true,
  },
  {
    slug: "top-positive-impact",
    href: "/reports/top-positive-impact",
    title: "Top Positive Impact Changes",
    summary:
      "The largest positive shifts in tracked policy and promise outcomes.",
    category: "Generated report",
    theme: "Impact movement",
    featured: false,
  },
  {
    slug: "stalled-policies",
    href: "/reports/stalled-policies",
    title: "Stalled and Blocked Policies",
    summary:
      "Tracked policies and promises that did not advance or were blocked.",
    category: "Generated report",
    theme: "Impact movement",
    featured: false,
  },
];

function getPublicReportDefinitions() {
  return PUBLIC_REPORT_DEFINITIONS.slice();
}

function resolveReportDefinitions(slugs = []) {
  const slugOrder = normalizeList(slugs);
  if (!slugOrder.length) return [];

  const reportsBySlug = new Map(getPublicReportDefinitions().map((item) => [item.slug, item]));
  return slugOrder.map((slug) => reportsBySlug.get(slug)).filter(Boolean);
}

function normalizeArgumentMode(value) {
  if (!value || typeof value !== "object") return null;

  const commonClaims = normalizeStructuredList(value.commonClaims)
    .map((item) => ({
      claim: normalizeText(item.claim),
      response: normalizeText(item.response),
      question: normalizeText(item.question),
    }))
    .filter((item) => item.claim || item.response || item.question);
  const shareCards = normalizeStructuredList(value.shareCards)
    .map((item) => ({
      title: normalizeText(item.title),
      text: normalizeText(item.text),
      context: normalizeText(item.context),
    }))
    .filter((item) => item.title && item.text);
  const argumentMode = {
    summary: normalizeText(value.summary),
    quickResponse: normalizeText(value.quickResponse),
    discussionResponse: normalizeText(value.discussionResponse),
    debateResponse: normalizeText(value.debateResponse),
    keyPoints: normalizeList(value.keyPoints),
    commonClaims,
    debateLines: normalizeList(value.debateLines),
    shareCards,
  };

  return argumentMode.summary ||
    argumentMode.keyPoints.length ||
    argumentMode.commonClaims.length ||
    argumentMode.debateLines.length ||
    argumentMode.shareCards.length
    ? argumentMode
    : null;
}

function compactText(value) {
  return normalizeText(value).replace(/\s+/g, " ");
}

function truncateSentence(value, maxLength = 240) {
  const text = compactText(value);
  if (!text || text.length <= maxLength) return text;

  const clipped = text.slice(0, maxLength).replace(/\s+\S*$/, "");
  return `${clipped.replace(/[.,;:!?]?$/, "")}...`;
}

function firstSentence(value, maxLength = 240) {
  const text = compactText(value);
  if (!text) return "";

  const match = text.match(/^(.+?[.!?])(?:\s|$)/);
  return truncateSentence(match?.[1] || text, maxLength);
}

function uniqueTextList(items = []) {
  const seen = new Set();
  return items
    .map((item) => compactText(item))
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function findStructuredSection(sections = [], titlePatterns = []) {
  return (sections || []).find((section) => {
    const title = normalizeText(section?.title).toLowerCase();
    return titlePatterns.some((pattern) => title.includes(pattern));
  });
}

function buildSectionPoint(sections, titlePatterns, fallback = "") {
  const section = findStructuredSection(sections, titlePatterns);
  return firstSentence(section?.body || fallback);
}

function buildGeneratedArgumentMode(explainer = {}, sections = [], argumentReady = null) {
  const summary = truncateSentence(
    argumentReady?.bottomLine ||
      argumentReady?.whyMisleading ||
      explainer.summary ||
      buildSectionPoint(sections, ["claim", "misconception", "actually happened"]) ||
      `This explainer separates the claim about ${explainer.title || "this topic"} from the evidence needed to prove it.`
  );
  const claim =
    truncateSentence(
      argumentReady?.claim ||
        explainer.common_claim ||
        `The broad claim about ${explainer.title || "this topic"} says more than the record can prove.`
    ) || "The broad claim says more than the record can prove.";
  const supportPoint = buildSectionPoint(sections, [
    "data",
    "evidence",
    "implementation",
    "actually happened",
    "support",
  ]);
  const limitationPoint = buildSectionPoint(sections, [
    "cannot prove",
    "does not prove",
    "what this evidence cannot",
    "mislead",
    "incomplete",
  ]);
  const contextPoint = buildSectionPoint(sections, [
    "context",
    "why it matters",
    "why this matters",
    "leaves out",
    "still matters",
  ]);
  const keyTakeaways = normalizeTextBlockList(explainer.key_takeaways).map((item) =>
    truncateSentence(item)
  );
  const keyPoints = uniqueTextList([
    ...(argumentReady?.dataShows || []),
    supportPoint
      ? `What the record shows: ${supportPoint}`
      : "The record matters most when you separate the primary evidence, how the policy was applied, and the later interpretation.",
    limitationPoint
      ? `What it does not prove: ${limitationPoint}`
      : "A good answer separates whether something happened, how often it happened, and whether it changed outcomes.",
    contextPoint,
    ...keyTakeaways,
    "A stronger claim needs evidence that matches the size of the claim, not just an example or a broad label.",
  ]).slice(0, 7);
  const strongestResponse =
    truncateSentence(argumentReady?.responseScript || limitationPoint || summary, 300) ||
    "The evidence supports a narrower claim than the broad conclusion being asserted.";
  const supportsButNotProvesResponse = limitationPoint
    ? `The record supports a narrower answer than the full claim. ${truncateSentence(
        limitationPoint,
        220
      )}`
    : "The record supports a bounded answer, but not every stronger conclusion attached to it.";
  const mixedEvidenceResponse = supportPoint
    ? `Incomplete or mixed evidence does not make the page meaningless. It still supports this bounded point: ${truncateSentence(
        supportPoint,
        220
      )}`
    : "Incomplete evidence does not erase what the record already shows. It means the conclusion should stay matched to the evidence."
  const commonClaims = argumentReady
    ? [
        {
          claim,
          response: strongestResponse,
          question:
            "What evidence proves the bigger claim, not just the narrower point?",
        },
        {
          claim: "The evidence settles the whole debate.",
          response: supportsButNotProvesResponse,
          question:
            "What evidence turns this narrower answer into the strongest version of the claim?",
        },
        {
          claim: "If the evidence is mixed or incomplete, the concern is not real.",
          response: mixedEvidenceResponse,
          question:
            "What part is already supported, and what part still needs stronger outcome or causal evidence?",
        },
        {
          claim: "One example proves the whole pattern.",
          response:
            "An example can show existence, but scale and impact require records that show how widespread the pattern is and whether it changed outcomes.",
          question:
            "What evidence shows the pattern across cases, places, or time, and how large is it relative to the total being discussed?",
        },
      ]
    : [
        {
          claim,
          response: strongestResponse,
          question:
            "What evidence proves the bigger claim, not just the narrower point?",
        },
        {
          claim: "One example proves the whole pattern.",
          response:
            "An example can show existence, but scale and impact require records that show how widespread the pattern is and whether it changed outcomes.",
          question:
            "What evidence shows the pattern across cases, places, or time, and how large is it relative to the total being discussed?",
        },
        {
          claim: "A disparity by itself proves a single cause.",
          response:
            "A disparity or sequence of events does not establish causation by itself. A causal claim needs comparison evidence, implementation records, or outcome data that connects the policy or condition to the result.",
          question:
            "What comparison, timeline, or implementation record establishes causation rather than correlation?",
        },
      ];
  const debateLines = argumentReady
    ? uniqueTextList([
        strongestResponse,
        "Use the narrowest answer the record clearly supports.",
        "Ask what the evidence measures directly, not what people want it to imply.",
        "Separate the rule, how it was applied, and what happened afterward.",
      ]).slice(0, 5)
    : [
        "Separate whether something happened from how big it was and what it changed.",
        "A broad claim needs broad evidence.",
        "The strongest answer is the one the record can actually carry.",
      ];
  const shareCards = argumentReady
    ? [
        {
          title: "Use the narrow answer",
          text:
            argumentReady.bottomLine ||
            "The defensible move is to use the narrowest answer the record can clearly support.",
          context: `Use this when a debate about ${explainer.title || "this topic"} jumps from a headline to a sweeping conclusion.`,
        },
        {
          title: "What the record shows",
          text:
            strongestResponse,
          context:
            argumentReady.responseContext ||
            "Use when the claim is being treated as stronger than the evidence allows.",
        },
        {
          title: "What stronger proof would take",
          text:
            "A stronger claim needs evidence that matches its scale and directly links the record to the outcome being asserted.",
        },
      ]
    : [
        {
          title: "Separate claim from evidence",
          text:
            "The defensible move is to ask what the record actually shows, what scale it covers, and whether it proves the conclusion being attached to it.",
          context: `Use this when a debate about ${explainer.title || "this topic"} jumps from a headline to a broad conclusion.`,
        },
        {
          title: "Scale matters",
          text:
            "An example can be real without proving a widespread pattern. Claims about broad impact require evidence that identifies existence, scale, and outcome impact separately.",
        },
        {
          title: "Ask what would prove it",
          text:
            "To prove the stronger claim, the evidence would need to match the claim's scale and show a clear link between the record and the outcome being asserted.",
        },
      ];

  return normalizeArgumentMode({
    summary,
    keyPoints,
    commonClaims,
    debateLines,
    shareCards,
  });
}

function normalizeArgumentReady(value) {
  if (!value || typeof value !== "object") return null;

  const dataShows = Array.isArray(value.dataShows)
    ? normalizeList(value.dataShows)
    : normalizeTextBlockList(value.dataShows);
  const argumentReady = {
    claim: normalizeText(value.claim),
    whyMisleading: normalizeText(value.whyMisleading),
    dataShows,
    bottomLine: normalizeText(value.bottomLine),
    responseScript: normalizeText(value.responseScript),
    responseContext: normalizeText(value.responseContext),
  };

  return argumentReady.claim ||
    argumentReady.whyMisleading ||
    argumentReady.dataShows.length ||
    argumentReady.bottomLine ||
    argumentReady.responseScript ||
    argumentReady.responseContext
    ? argumentReady
    : null;
}

function buildExplainerArgumentSignal({
  argumentMode = null,
  argumentReady = null,
  explainerType = "",
  editorialCategory = "",
} = {}) {
  const normalizedType = normalizeText(explainerType).toLowerCase();

  if (
    normalizedType === "misused_statistic" ||
    normalizeText(editorialCategory).toLowerCase() === "misused-statistics"
  ) {
    return { label: "Statistical claim", tone: "warning" };
  }

  if (argumentMode?.commonClaims?.length) {
    return { label: "Common claim", tone: "warning" };
  }

  if (argumentMode || argumentReady) {
    return { label: "Argument-ready", tone: "info" };
  }

  return null;
}

function normalizeExplainerArgumentReady(
  explainer = {},
  argumentMode = null,
  editorialArgumentReady = null
) {
  const claim =
    normalizeText(explainer.claim) ||
    normalizeText(explainer.common_claim) ||
    normalizeText(editorialArgumentReady?.claim) ||
    normalizeText(argumentMode?.commonClaims?.[0]?.claim);
  const whyMisleading =
    normalizeText(explainer.why_misleading) ||
    normalizeText(explainer.misleading_context) ||
    normalizeText(editorialArgumentReady?.whyMisleading) ||
    normalizeText(argumentMode?.summary);
  const explicitDataShows = [
    ...normalizeList(explainer.data_points),
    ...normalizeList(explainer.key_facts),
    ...normalizeList(explainer.evidence_points),
    ...normalizeList(explainer.argument_points),
  ];
  const dataShows = (
    explicitDataShows.length
      ? explicitDataShows
      : normalizeTextBlockList(explainer.key_takeaways).length
        ? normalizeTextBlockList(explainer.key_takeaways)
        : editorialArgumentReady?.dataShows?.length
          ? editorialArgumentReady.dataShows
        : normalizeList(argumentMode?.keyPoints)
  ).slice(0, 5);
  const explicitBottomLine =
    normalizeText(explainer.bottom_line) ||
    normalizeText(explainer.takeaway) ||
    normalizeText(editorialArgumentReady?.bottomLine);
  const responseScript =
    normalizeText(explainer.response) ||
    normalizeText(explainer.response_script) ||
    normalizeText(explainer.rebuttal) ||
    normalizeText(explainer.talking_point) ||
    normalizeText(editorialArgumentReady?.responseScript) ||
    normalizeText(argumentMode?.shareCards?.[0]?.text) ||
    normalizeText(argumentMode?.commonClaims?.[0]?.response);
  const responseContext =
    normalizeText(explainer.response_context) ||
    normalizeText(editorialArgumentReady?.responseContext) ||
    normalizeText(argumentMode?.shareCards?.[0]?.context);
  const bottomLine = explicitBottomLine || normalizeText(explainer.summary);
  const hasStandaloneArgumentField = Boolean(
    claim ||
      whyMisleading ||
      dataShows.length ||
      explicitBottomLine ||
      responseScript
  );

  return hasStandaloneArgumentField
    ? {
        claim,
        whyMisleading,
        dataShows,
        bottomLine,
        responseScript,
        responseContext,
      }
    : null;
}

function enrichExplainerSources(sources = [], sourceContexts = []) {
  const contexts = normalizeStructuredList(sourceContexts)
    .map((item) => ({
      title: normalizeText(item.title),
      url: normalizeText(item.url),
      sourceType: normalizeText(item.sourceType),
      sourceNote: normalizeText(item.sourceNote),
    }))
    .filter((item) => (item.title || item.url) && (item.sourceType || item.sourceNote));

  if (!contexts.length) return sources || [];

  return (sources || []).map((source) => {
    const sourceTitle = normalizeText(source.source_title || source.title);
    const sourceUrl = normalizeText(source.source_url || source.url);
    const context = contexts.find(
      (item) => (item.url && item.url === sourceUrl) || (item.title && item.title === sourceTitle)
    );

    return context
      ? {
          ...source,
          sourceType: context.sourceType,
          sourceNote: context.sourceNote,
        }
      : source;
  });
}

async function resolveEditorialRelatedPolicies(slugs = []) {
  const slugOrder = normalizeList(slugs);
  if (!slugOrder.length) return [];

  const rows = await query(
    `
    SELECT
      p.id,
      p.title,
      p.year_enacted,
      p.policy_type,
      p.summary,
      pp.name AS primary_party,
      ${POLICY_IMPACT_SCORE_SQL} AS impact_score
    FROM policies p
    LEFT JOIN parties pp ON pp.id = p.primary_party_id
    LEFT JOIN policy_scores ps ON ps.policy_id = p.id
    WHERE p.is_archived = 0
    `
  );
  const bySlug = new Map();
  for (const row of rows) {
    bySlug.set(buildPolicySlug(row), row);
    bySlug.set(slugify(row.title), row);
  }

  return slugOrder.map((slug) => bySlug.get(slug)).filter(Boolean);
}

function formatPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "—";
  }
  return `${Math.round(numeric * 100)}%`;
}

function countMatching(items = [], predicate) {
  return items.reduce((total, item, index) => {
    try {
      return total + (predicate(item, index) ? 1 : 0);
    } catch {
      return total;
    }
  }, 0);
}

function buildExplorerCoverageSummary({
  items = [],
  collectionLabel = "visible record",
  structuredLabel = "structured analysis",
  relatedLabel = "linked context",
  sourceAccessor = () => 0,
  structuredAccessor = () => false,
  relatedAccessor = () => false,
  scoredAccessor = () => false,
}) {
  const totalCount = Array.isArray(items) ? items.length : 0;

  if (!totalCount) {
    return { coverage: null, strengtheningNote: null };
  }

  const sourcedCount = countMatching(items, (item) => Number(sourceAccessor(item) || 0) > 0);
  const structuredCount = countMatching(items, structuredAccessor);
  const relatedCount = countMatching(items, relatedAccessor);
  const scoredCount = countMatching(items, scoredAccessor);

  return {
    coverage: buildCollectionResearchCoverage({
      totalCount,
      sourcedCount,
      structuredCount,
      relatedCount,
      scoredCount,
      collectionLabel,
      structuredLabel,
      relatedLabel,
    }),
    strengtheningNote: buildCollectionResearchStrengtheningNote({
      totalCount,
      sourcedCount,
      structuredCount,
      relatedCount,
      scoredCount,
      collectionLabel,
      structuredLabel,
      relatedLabel,
    }),
  };
}

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function buildPolicySupportStrength(item = {}) {
  return (
    toFiniteNumber(item.evidence_summary?.total_sources) * 2 +
    (item.impact_score != null ? 4 : 0) +
    toFiniteNumber(item.accountability_summary?.related_explainer_count) * 2 +
    toFiniteNumber(item.accountability_summary?.related_future_bill_count) * 2 +
    toFiniteNumber(item.accountability_summary?.linked_legislator_count)
  );
}

function buildPromiseSupportStrength(item = {}) {
  return (
    toFiniteNumber(item.source_count) * 2 +
    toFiniteNumber(item.outcome_count) * 3 +
    toFiniteNumber(item.action_count)
  );
}

function buildPolicyCoverageHighlights(items = []) {
  return items
    .slice()
    .sort((left, right) => buildPolicySupportStrength(right) - buildPolicySupportStrength(left))
    .filter(
      (item) =>
        toFiniteNumber(item.evidence_summary?.total_sources) > 0 &&
        (item.impact_score != null ||
          toFiniteNumber(item.accountability_summary?.related_explainer_count) > 0 ||
          toFiniteNumber(item.accountability_summary?.related_future_bill_count) > 0)
    )
    .slice(0, 3)
    .map((item) => ({
      href: `/policies/${item.slug || buildPolicySlug(item)}`,
      label: "Best-covered",
      tone:
        item.evidence_summary?.evidence_strength === "Strong"
          ? "verified"
          : "info",
      title: item.title,
      meta: item.year_enacted ? `Policy • ${item.year_enacted}` : "Policy",
      description: [
        item.evidence_summary?.total_sources
          ? `${item.evidence_summary.total_sources} visible sources`
          : null,
        item.impact_score != null ? `Impact score ${Number(item.impact_score).toFixed(2)}` : null,
        toFiniteNumber(item.accountability_summary?.related_explainer_count) > 0
          ? `${item.accountability_summary.related_explainer_count} linked explainer${
              Number(item.accountability_summary.related_explainer_count) === 1 ? "" : "s"
            }`
          : null,
      ]
        .filter(Boolean)
        .join(" • "),
    }));
}

function buildPolicyConsequenceHighlights(items = []) {
  const positive = items
    .filter((item) => toFiniteNumber(item.impact_score) > 0 && toFiniteNumber(item.evidence_summary?.total_sources) > 0)
    .sort((left, right) => toFiniteNumber(right.impact_score) - toFiniteNumber(left.impact_score))[0];
  const negative = items
    .filter((item) => toFiniteNumber(item.impact_score) < 0 && toFiniteNumber(item.evidence_summary?.total_sources) > 0)
    .sort((left, right) => toFiniteNumber(left.impact_score) - toFiniteNumber(right.impact_score))[0];
  const contextRich = items
    .slice()
    .sort((left, right) => {
      const rightContext =
        toFiniteNumber(right.accountability_summary?.related_explainer_count) +
        toFiniteNumber(right.accountability_summary?.related_future_bill_count) +
        toFiniteNumber(right.accountability_summary?.linked_legislator_count) +
        toFiniteNumber(right.evidence_summary?.total_sources);
      const leftContext =
        toFiniteNumber(left.accountability_summary?.related_explainer_count) +
        toFiniteNumber(left.accountability_summary?.related_future_bill_count) +
        toFiniteNumber(left.accountability_summary?.linked_legislator_count) +
        toFiniteNumber(left.evidence_summary?.total_sources);
      return rightContext - leftContext;
    })[0];

  return [
    positive
      ? {
          href: `/policies/${positive.slug || buildPolicySlug(positive)}`,
          label: "Strongest positive signal",
          tone: "success",
          title: positive.title,
          meta: positive.year_enacted ? `Policy • ${positive.year_enacted}` : "Policy",
          description: `Highest positive impact score in the current result set, with ${toFiniteNumber(
            positive.evidence_summary?.total_sources
          )} visible sources behind the record.`,
        }
      : null,
    negative
      ? {
          href: `/policies/${negative.slug || buildPolicySlug(negative)}`,
          label: "Strongest negative signal",
          tone: "danger",
          title: negative.title,
          meta: negative.year_enacted ? `Policy • ${negative.year_enacted}` : "Policy",
          description: `Lowest visible impact score in the current result set, grounded in the current public source layer rather than a platform-wide ranking.`,
        }
      : null,
    contextRich
      ? {
          href: `/policies/${contextRich.slug || buildPolicySlug(contextRich)}`,
          label: "Deepest context trail",
          tone: "info",
          title: contextRich.title,
          meta: contextRich.year_enacted ? `Policy • ${contextRich.year_enacted}` : "Policy",
          description: [
            toFiniteNumber(contextRich.evidence_summary?.total_sources)
              ? `${contextRich.evidence_summary.total_sources} visible sources`
              : null,
            toFiniteNumber(contextRich.accountability_summary?.related_explainer_count)
              ? `${contextRich.accountability_summary.related_explainer_count} linked explainer${
                  Number(contextRich.accountability_summary.related_explainer_count) === 1 ? "" : "s"
                }`
              : null,
            toFiniteNumber(contextRich.accountability_summary?.related_future_bill_count)
              ? `${contextRich.accountability_summary.related_future_bill_count} linked future bill${
                  Number(contextRich.accountability_summary.related_future_bill_count) === 1 ? "" : "s"
                }`
              : null,
          ]
            .filter(Boolean)
            .join(" • "),
        }
      : null,
  ].filter(Boolean);
}

function buildLabeledGroupSynthesis(
  items = [],
  {
    labelsAccessor,
    sourceAccessor,
    magnitudeAccessor = null,
    groupName = "category",
    magnitudeLabel = "visible signal",
    magnitudeDescription,
    coverageLabel = "Best-covered category",
    clusterLabel = "Largest active cluster",
  }
) {
  const buckets = new Map();

  for (const item of items || []) {
    const labels = (labelsAccessor(item) || []).map((value) => String(value || "").trim()).filter(Boolean);
    for (const label of labels) {
      const bucket =
        buckets.get(label) ||
        {
          label,
          recordCount: 0,
          sourceCount: 0,
          scoredCount: 0,
          totalMagnitude: 0,
          maxMagnitude: null,
        };

      bucket.recordCount += 1;
      bucket.sourceCount += toFiniteNumber(sourceAccessor(item));

      if (typeof magnitudeAccessor === "function") {
        const magnitude = magnitudeAccessor(item);
        if (magnitude != null) {
          const normalizedMagnitude = toFiniteNumber(magnitude);
          bucket.scoredCount += 1;
          bucket.totalMagnitude += Math.abs(normalizedMagnitude);
          if (
            bucket.maxMagnitude == null ||
            Math.abs(normalizedMagnitude) > Math.abs(toFiniteNumber(bucket.maxMagnitude))
          ) {
            bucket.maxMagnitude = normalizedMagnitude;
          }
        }
      }

      buckets.set(label, bucket);
    }
  }

  const groups = Array.from(buckets.values());
  if (!groups.length) {
    return [];
  }

  const bestCovered = groups
    .slice()
    .sort((left, right) =>
      right.sourceCount - left.sourceCount ||
      right.recordCount - left.recordCount ||
      left.label.localeCompare(right.label)
    )[0];
  const largestCluster = groups
    .slice()
    .sort((left, right) =>
      right.recordCount - left.recordCount ||
      right.sourceCount - left.sourceCount ||
      left.label.localeCompare(right.label)
    )[0];
  const strongestSignal =
    typeof magnitudeAccessor === "function"
      ? groups
          .slice()
          .sort((left, right) =>
            right.totalMagnitude - left.totalMagnitude ||
            right.scoredCount - left.scoredCount ||
            left.label.localeCompare(right.label)
          )[0]
      : null;

  return [
    bestCovered
      ? {
          label: coverageLabel,
          tone: "verified",
          title: bestCovered.label,
          meta: `${bestCovered.recordCount} visible records`,
          description: `${bestCovered.sourceCount} visible sources across the current result set, making this one of the clearest-supported ${groupName}s in view.`,
        }
      : null,
    strongestSignal
      ? {
          label: magnitudeLabel,
          tone:
            toFiniteNumber(strongestSignal.maxMagnitude) > 0
              ? "success"
              : toFiniteNumber(strongestSignal.maxMagnitude) < 0
                ? "danger"
                : "warning",
          title: strongestSignal.label,
          meta: `${strongestSignal.scoredCount} scored record${
            strongestSignal.scoredCount === 1 ? "" : "s"
          }`,
          description:
            typeof magnitudeDescription === "function"
              ? magnitudeDescription(strongestSignal)
              : `This ${groupName} carries one of the strongest visible signals in the current filtered result set.`,
        }
      : null,
    largestCluster
      ? {
          label: clusterLabel,
          tone: "info",
          title: largestCluster.label,
          meta: `${largestCluster.recordCount} visible records`,
          description: `This ${groupName} has the broadest visible footprint in the current slice, which makes it a useful place to start when scanning continuity or variation.`,
        }
      : null,
  ].filter(Boolean);
}

function buildPolicyCategorySynthesis(items = []) {
  return buildLabeledGroupSynthesis(items, {
    labelsAccessor: (item) => item.category_names || [],
    sourceAccessor: (item) => item.evidence_summary?.total_sources,
    magnitudeAccessor: (item) => item.impact_score,
    groupName: "category",
    magnitudeLabel: "Strongest visible impact signal",
    magnitudeDescription: () =>
      "This category carries the highest visible concentration of impact-score magnitude in the current filtered result set.",
    coverageLabel: "Best-covered category",
    clusterLabel: "Largest active cluster",
  });
}

function buildPromiseTopicSynthesis(items = []) {
  return buildLabeledGroupSynthesis(items, {
    labelsAccessor: (item) => (item.topic ? [item.topic] : []),
    sourceAccessor: (item) => item.source_count,
    magnitudeAccessor: (item) =>
      toFiniteNumber(item.outcome_count) * 3 + toFiniteNumber(item.action_count),
    groupName: "topic",
    magnitudeLabel: "Deepest visible downstream topic",
    magnitudeDescription: () =>
      "This topic shows one of the strongest action-and-outcome trails in the current filtered promise set.",
    coverageLabel: "Best-covered topic",
    clusterLabel: "Largest active topic",
  });
}

function buildPromiseCoverageHighlights(items = []) {
  return items
    .slice()
    .sort((left, right) => buildPromiseSupportStrength(right) - buildPromiseSupportStrength(left))
    .filter(
      (item) =>
        toFiniteNumber(item.source_count) > 0 &&
        (toFiniteNumber(item.outcome_count) > 0 || toFiniteNumber(item.action_count) > 0)
    )
    .slice(0, 3)
    .map((item) => ({
      href: `/promises/${item.slug}`,
      label: "Best-covered",
      tone: "info",
      title: item.title,
      meta: item.status ? `Promise • ${item.status}` : "Promise",
      description: [
        toFiniteNumber(item.source_count) ? `${item.source_count} visible sources` : null,
        toFiniteNumber(item.outcome_count) ? `${item.outcome_count} linked outcomes` : null,
        !toFiniteNumber(item.outcome_count) && toFiniteNumber(item.action_count)
          ? `${item.action_count} documented actions`
          : null,
      ]
        .filter(Boolean)
        .join(" • "),
    }));
}

function confidenceWeight(label = "") {
  const normalized = normalizeText(label).toLowerCase();
  if (normalized === "high") {
    return 4;
  }
  if (normalized === "medium") {
    return 3;
  }
  if (normalized === "low") {
    return 2;
  }
  if (normalized === "very low") {
    return 1;
  }
  return 0;
}

function buildPresidentSupportStrength(item = {}) {
  return (
    toFiniteNumber(item.outcome_count) * 3 +
    toFiniteNumber(item.promise_count) +
    toFiniteNumber(item.linked_bill_count) +
    confidenceWeight(item.score_confidence)
  );
}

function buildPresidentCoverageHighlights(items = []) {
  return items
    .slice()
    .sort((left, right) => buildPresidentSupportStrength(right) - buildPresidentSupportStrength(left))
    .filter(
      (item) =>
        item.score != null &&
        (toFiniteNumber(item.outcome_count) > 0 || toFiniteNumber(item.promise_count) > 0)
    )
    .slice(0, 3)
    .map((item) => ({
      href: `/presidents/${item.slug}`,
      label: "Best-covered",
      tone:
        confidenceWeight(item.score_confidence) >= 4
          ? "verified"
          : confidenceWeight(item.score_confidence) >= 2
            ? "info"
            : "default",
      title: item.name,
      meta: item.termLabel || "President",
      description: [
        toFiniteNumber(item.outcome_count)
          ? `${item.outcome_count} scored outcomes`
          : null,
        toFiniteNumber(item.promise_count)
          ? `${item.promise_count} tracked promises`
          : null,
        item.score_confidence ? `${item.score_confidence} confidence` : null,
      ]
        .filter(Boolean)
        .join(" • "),
    }));
}

function buildPresidentConsequenceHighlights(items = []) {
  const positive = items
    .filter((item) => toFiniteNumber(item.score) > 0 && toFiniteNumber(item.outcome_count) > 0)
    .sort((left, right) => toFiniteNumber(right.score) - toFiniteNumber(left.score))[0];
  const negative = items
    .filter((item) => toFiniteNumber(item.score) < 0 && toFiniteNumber(item.outcome_count) > 0)
    .sort((left, right) => toFiniteNumber(left.score) - toFiniteNumber(right.score))[0];
  const deepestRecord = items
    .slice()
    .sort((left, right) => {
      const rightStrength =
        toFiniteNumber(right.outcome_count) * 3 +
        toFiniteNumber(right.promise_count) +
        toFiniteNumber(right.linked_bill_count);
      const leftStrength =
        toFiniteNumber(left.outcome_count) * 3 +
        toFiniteNumber(left.promise_count) +
        toFiniteNumber(left.linked_bill_count);
      return rightStrength - leftStrength;
    })[0];

  return [
    positive
      ? {
          href: `/presidents/${positive.slug}`,
          label: "Strongest positive signal",
          tone: "success",
          title: positive.name,
          meta: positive.termLabel || "President",
          description:
            "Highest positive presidential score in the current filtered view, backed by the strongest visible outcome read in this slice.",
        }
      : null,
    negative
      ? {
          href: `/presidents/${negative.slug}`,
          label: "Strongest negative signal",
          tone: "danger",
          title: negative.name,
          meta: negative.termLabel || "President",
          description:
            "Lowest visible presidential score in the current filtered view. This remains a scoped comparison, not a platform-wide moral ranking.",
        }
      : null,
    deepestRecord
      ? {
          href: `/presidents/${deepestRecord.slug}`,
          label: "Deepest record base",
          tone: "info",
          title: deepestRecord.name,
          meta: deepestRecord.termLabel || "President",
          description: [
            toFiniteNumber(deepestRecord.outcome_count)
              ? `${deepestRecord.outcome_count} scored outcomes`
              : null,
            toFiniteNumber(deepestRecord.promise_count)
              ? `${deepestRecord.promise_count} tracked promises`
              : null,
            toFiniteNumber(deepestRecord.linked_bill_count)
              ? `${deepestRecord.linked_bill_count} linked bills`
              : null,
          ]
            .filter(Boolean)
            .join(" • "),
        }
      : null,
  ].filter(Boolean);
}

function buildPromiseTrailHighlights(items = []) {
  return items
    .slice()
    .sort((left, right) => {
      const rightScore =
        toFiniteNumber(right.outcome_count) * 3 +
        toFiniteNumber(right.action_count) +
        toFiniteNumber(right.source_count);
      const leftScore =
        toFiniteNumber(left.outcome_count) * 3 +
        toFiniteNumber(left.action_count) +
        toFiniteNumber(left.source_count);
      return rightScore - leftScore;
    })
    .filter(
      (item) =>
        toFiniteNumber(item.outcome_count) > 0 || toFiniteNumber(item.action_count) > 1
    )
    .slice(0, 2)
    .map((item) => ({
      href: `/promises/${item.slug}`,
      label: "Deepest downstream trail",
      tone: "warning",
      title: item.title,
      meta: item.status ? `Promise • ${item.status}` : "Promise",
      description: "This promise has one of the strongest visible action-to-outcome trails in the current result set. Status and Black-impact interpretation should still be read separately.",
    }));
}

function buildTimelineInterpretiveSummary(items = [], mode = "") {
  const highlighted = items.filter((item) => item.highlight);
  if (!highlighted.length) {
    return null;
  }

  const ranked = highlighted
    .slice()
    .sort((left, right) => toFiniteNumber(right.highlight?.rank) - toFiniteNumber(left.highlight?.rank));
  const topTurningPoint = ranked[0] || null;
  const topExpansion = ranked.find((item) => item.highlight?.group === "rights_expansion") || null;
  const topRollback = ranked.find((item) => item.highlight?.group === "rollback") || null;

  return {
    items: [
      topTurningPoint
        ? {
            href: topTurningPoint.href,
            label: mode ? "Current lead signal" : "Highest-signal turning point",
            tone: topTurningPoint.highlight?.tone || "info",
            title: topTurningPoint.title,
            meta: topTurningPoint.year ? `Timeline • ${topTurningPoint.year}` : "Timeline",
            description:
              topTurningPoint.highlight?.detail ||
              "Strongest turning-point proxy in the current visible result set.",
          }
        : null,
      topExpansion
        ? {
            href: topExpansion.href,
            label: "Expansion signal",
            tone: "success",
            title: topExpansion.title,
            meta: topExpansion.year ? `Timeline • ${topExpansion.year}` : "Timeline",
            description:
              topExpansion.highlight?.detail ||
              "Most prominent rights-expansion signal in the current visible result set.",
          }
        : null,
      topRollback
        ? {
            href: topRollback.href,
            label: "Rollback signal",
            tone: "danger",
            title: topRollback.title,
            meta: topRollback.year ? `Timeline • ${topRollback.year}` : "Timeline",
            description:
              topRollback.highlight?.detail ||
              "Most prominent rollback or restriction signal in the current visible result set.",
          }
        : null,
    ].filter(Boolean),
  };
}

function buildPolicyTimelineHighlight(row = {}) {
  const impactDirection = normalizeText(row.impact_direction);
  const scoreMagnitude = Math.abs(Number(row.impact_score || 0));
  const totalSources = Number(row.total_sources || 0);
  const relationshipCount = Number(row.relationship_count || 0);
  const directBlackImpact = Number(row.direct_black_impact || 0) === 1;
  const institutionalType = normalizeText(row.policy_type);
  const isInstitutionalShift =
    institutionalType.includes("law") ||
    institutionalType.includes("act") ||
    institutionalType.includes("executive") ||
    institutionalType.includes("court") ||
    institutionalType.includes("rule") ||
    institutionalType.includes("program");

  const qualifies =
    (directBlackImpact && totalSources >= 1) ||
    (scoreMagnitude >= 3 && totalSources >= 2) ||
    relationshipCount >= 2 ||
    (isInstitutionalShift && totalSources >= 3);

  if (!qualifies) {
    return null;
  }

  let group = "turning_points";
  let label = "Turning point";
  let tone = "info";

  if (impactDirection === "Positive") {
    group = "rights_expansion";
    label = "Rights expansion";
    tone = "success";
  } else if (impactDirection === "Negative" || impactDirection === "Blocked") {
    group = "rollback";
    label = "Rollback / restriction";
    tone = "danger";
  } else if (impactDirection === "Mixed") {
    label = "Mixed turning point";
    tone = "warning";
  }

  const reasons = [
    directBlackImpact ? "direct Black-impact record" : null,
    relationshipCount > 0 ? `${relationshipCount} linked relationship${relationshipCount === 1 ? "" : "s"}` : null,
    totalSources > 0 ? `${totalSources} visible source${totalSources === 1 ? "" : "s"}` : null,
    scoreMagnitude >= 3 ? "higher-magnitude impact score" : null,
  ].filter(Boolean);

  return {
    group,
    label,
    tone,
    detail: reasons.length
      ? `Current turning-point proxy: ${reasons.slice(0, 3).join(" • ")}.`
      : "Current turning-point proxy based on the visible record.",
    rank:
      (directBlackImpact ? 8 : 0) +
      scoreMagnitude +
      relationshipCount * 2 +
      Math.min(totalSources, 4),
  };
}

function buildPromiseTimelineHighlight(row = {}) {
  const outcomeCount = Number(row.outcome_count || 0);
  const actionCount = Number(row.action_count || 0);
  const sourceCount = Number(row.source_count || 0);
  const normalizedStatus = normalizeText(row.status);
  const hasMilestoneStatus =
    normalizedStatus.includes("delivered") ||
    normalizedStatus.includes("partial") ||
    normalizedStatus.includes("blocked") ||
    normalizedStatus.includes("failed");

  if (!hasMilestoneStatus || sourceCount < 2 || (outcomeCount < 1 && actionCount < 2)) {
    return null;
  }

  return {
    group: "turning_points",
    label: "Promise milestone",
    tone: normalizedStatus.includes("blocked") || normalizedStatus.includes("failed")
      ? "warning"
      : "info",
    detail: `${outcomeCount || actionCount} documented downstream ${
      outcomeCount ? "outcome" : "action"
    }${outcomeCount === 1 || actionCount === 1 ? "" : "s"} with ${
      sourceCount
    } visible sources in the current record.`,
    rank: outcomeCount * 3 + actionCount + Math.min(sourceCount, 4),
  };
}

function formatCount(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function formatScoreValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "—";
  }
  return numeric.toFixed(2);
}

function normalizeSystemicCategoryLabel(value) {
  const text = normalizeText(value);
  return text || null;
}

function rankCountEntries(counts = {}) {
  return Object.entries(counts)
    .map(([name, value]) => ({
      name,
      value: Number(value || 0),
    }))
    .filter((item) => item.value > 0)
    .sort((left, right) => right.value - left.value);
}

function normalizePromiseStatusCounts(counts = {}) {
  return PROMISE_STATUSES.reduce((totals, status) => {
    totals[status] = Number(counts?.[status] || 0);
    return totals;
  }, {});
}

function sumDirectionCounts(records = []) {
  return records.reduce(
    (totals, row) => {
      totals.Positive += Number(row.breakdown_by_direction?.Positive || 0);
      totals.Negative += Number(row.breakdown_by_direction?.Negative || 0);
      totals.Mixed += Number(row.breakdown_by_direction?.Mixed || 0);
      totals.Blocked += Number(row.breakdown_by_direction?.Blocked || 0);
      return totals;
    },
    {
      Positive: 0,
      Negative: 0,
      Mixed: 0,
      Blocked: 0,
    }
  );
}

function buildDirectionInsight(records = []) {
  const counts = sumDirectionCounts(records);
  const ranked = rankCountEntries(counts);
  const total = ranked.reduce((sum, item) => sum + item.value, 0);
  const leader = ranked[0];

  if (!leader || !total) {
    return null;
  }

  return {
    title: "Impact Direction",
    text: `${leader.name}-impact outcomes are the largest direction group in the current scored dataset (${formatCount(leader.value)} of ${formatCount(total)} counted outcomes).`,
  };
}

function buildCategoryInsight(categorySummary = []) {
  const strongest = categorySummary
    .slice()
    .sort(
      (left, right) =>
        Math.abs(Number(right.net_weighted_impact || 0)) -
        Math.abs(Number(left.net_weighted_impact || 0))
    )[0];

  if (!strongest?.name) {
    return null;
  }

  return {
    title: "Category Concentration",
    text: `${strongest.name} shows the strongest net weighted impact among the currently summarized policy categories.`,
  };
}

function buildPromiseInsight({
  items = [],
  statusCounts = null,
  scopeLabel = "current promise tracker view",
} = {}) {
  const counts = statusCounts
    ? normalizePromiseStatusCounts(statusCounts)
    : items.reduce((totals, item) => {
        const status = item.status || "Unknown";
        totals[status] = (totals[status] || 0) + 1;
        return totals;
      }, {});
  const ranked = rankCountEntries(counts);
  const leader = ranked[0];
  const delivered = Number(counts.Delivered || 0);
  const blocked = Number(counts.Blocked || 0);
  const failed = Number(counts.Failed || 0);

  if (delivered || blocked || failed) {
    return {
      title: "Promise Tracker",
      text: `The ${scopeLabel} shows ${formatCount(delivered)} Delivered promises, ${formatCount(blocked)} Blocked promises, and ${formatCount(failed)} Failed promises.`,
    };
  }

  if (!leader) {
    return null;
  }

  return {
    title: "Promise Tracker",
    text: `${leader.name} is the largest promise-status group in the ${scopeLabel} (${formatCount(leader.value)} records).`,
  };
}

function buildPresidentRankingInsight(presidents = []) {
  const ranked = presidents
    .filter((item) => Number.isFinite(Number(item.normalized_score_total ?? item.score)))
    .slice()
    .sort(
      (left, right) =>
        Number((right.normalized_score_total ?? right.score) || 0) -
        Number((left.normalized_score_total ?? left.score) || 0)
    );

  if (ranked.length < 2) {
    return null;
  }

  const top = ranked[0];
  const bottom = ranked[ranked.length - 1];
  const topName = top.name || top.president || top.president_name || "Top record";
  const bottomName =
    bottom.name || bottom.president || bottom.president_name || "Bottom record";

  return {
    title: "Presidential Range",
    text: `Current presidential Black Impact Scores range from ${topName} (${formatScoreValue(top.normalized_score_total ?? top.score)}) to ${bottomName} (${formatScoreValue(bottom.normalized_score_total ?? bottom.score)}).`,
  };
}

function buildReportInsights({
  scores,
  categorySummary,
  promiseItems = [],
  promiseStatusCounts = null,
  presidents = [],
}) {
  return [
    buildDirectionInsight(scores?.records || []),
    buildCategoryInsight(categorySummary || []),
    buildPromiseInsight({
      items: promiseItems || [],
      statusCounts: promiseStatusCounts,
    }),
    buildPresidentRankingInsight(presidents || []),
  ].filter(Boolean);
}

function attachSuggestedExplainersToReport(report = {}, explainersIndex = { items: [] }) {
  const reportHints = REPORT_SURFACING_HINTS[report.slug] || {};
  return {
    ...report,
    suggested_explainers: resolveSuggestedExplainers({
      explainers: explainersIndex.items || [],
      textFields: [
        report.title,
        report.summary,
        report.category,
        report.theme,
        ...(report.findings || []).flatMap((item) => [item?.title, item?.text]),
      ],
      tagHints: [report.category, report.theme, ...(reportHints.tagHints || [])],
      domainHints: (report.relatedLinks || []).map((item) => item.label),
      fallbackSlugs: reportHints.fallbackSlugs || [],
      limit: 3,
    }),
  };
}

function buildPresidentProfileInsight(presidentName, breakdown = {}, overallBreakdown = {}) {
  const presidentRanked = rankCountEntries(breakdown);
  const overallRanked = rankCountEntries(overallBreakdown);
  const leader = presidentRanked[0];
  const totalPresident = presidentRanked.reduce((sum, item) => sum + item.value, 0);
  const totalOverall = overallRanked.reduce((sum, item) => sum + item.value, 0);

  if (!leader || !totalPresident || !totalOverall) {
    return null;
  }

  const presidentShare = leader.value / totalPresident;
  const overallShare = Number(overallBreakdown[leader.name] || 0) / totalOverall;

  if (presidentShare - overallShare < 0.12) {
    return null;
  }

  return {
    title: "Profile Insight",
    text: `${presidentName} shows a higher concentration of ${leader.name.toLowerCase()}-impact outcomes than the current dataset average (${formatPercent(presidentShare)} vs ${formatPercent(overallShare)}).`,
  };
}

function confidenceFromSourceCount(sourceCount = 0, sourceTypeCounts = {}) {
  const total = Number(sourceCount || 0);
  const highAuthority =
    Number(sourceTypeCounts.government || 0) +
    Number(sourceTypeCounts.academic || 0) +
    Number(sourceTypeCounts.archive || 0);

  if (total >= 3 && highAuthority >= 1) {
    return "High";
  }
  if (total >= 2) {
    return "Medium";
  }
  if (total >= 1) {
    return "Low";
  }
  return "Very Low";
}

function parseSelectionList(values = [], max = 4) {
  const list = Array.isArray(values) ? values : [values];
  return list
    .flatMap((item) => String(item ?? "").split(","))
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, max);
}

const POLICY_IMPACT_SCORE_MAX = 35;

function hasCompletePolicyScore(scoreRow = {}) {
  const fields = [
    "directness_score",
    "material_impact_score",
    "evidence_score",
    "durability_score",
    "equity_score",
    "harm_offset_score",
  ];

  return fields.every((field) => {
    const value = scoreRow?.[field];
    return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  });
}

function normalizePolicyScoreToFive(rawScore) {
  const numeric = Number(rawScore);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return (numeric / POLICY_IMPACT_SCORE_MAX) * 5;
}

function formatPolicyScoreOutOfFive(rawScore) {
  const normalized = normalizePolicyScoreToFive(rawScore);
  if (!Number.isFinite(normalized)) {
    return null;
  }

  return `${normalized.toFixed(1)} / 5`;
}

export function isFundingImpactMetric(metricName) {
  return /^Proposed FY\d{4} funding level\s*-/i.test(String(metricName || "").trim());
}

export function deriveProgramLabel(metricName) {
  const normalized = String(metricName || "").trim();
  if (!normalized) {
    return "Program";
  }

  const proposedFundingMatch = normalized.match(
    /^Proposed FY\d{4} funding level\s*-\s*(.+)$/i
  );
  if (proposedFundingMatch?.[1]) {
    return proposedFundingMatch[1].trim();
  }

  const tailLabel = normalized.split(" - ").pop()?.trim();
  return tailLabel || normalized;
}

export function deriveMetricLabel(metricName) {
  const normalized = String(metricName || "").trim();
  if (!normalized || isFundingImpactMetric(normalized)) {
    return null;
  }

  const supportingMatch = normalized.match(/^Supporting evidence\s*-\s*(.+?)\s*-\s*[^-]+$/i);
  if (supportingMatch?.[1]) {
    return supportingMatch[1].trim();
  }

  return normalized;
}

function formatCurrencyValue(value, unit = null) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "—";
  }

  if (unit === "USD") {
    const hasFraction = Math.abs(numeric % 1) > 0;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: hasFraction ? 2 : 0,
    }).format(numeric);
  }

  return new Intl.NumberFormat("en-US").format(numeric);
}

function formatImpactScalar(value, unit = null) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "—";
  }

  if (unit === "USD") {
    return formatCurrencyValue(numeric, unit);
  }

  if (unit === "percent") {
    const hasFraction = Math.abs(numeric % 1) > 0;
    return `${new Intl.NumberFormat("en-US", {
      minimumFractionDigits: hasFraction ? 1 : 0,
      maximumFractionDigits: hasFraction ? 2 : 0,
    }).format(numeric)}%`;
  }

  const formatted = new Intl.NumberFormat("en-US").format(numeric);
  return unit ? `${formatted} ${unit}` : formatted;
}

function formatFundingChange(impact = {}) {
  const before = formatCurrencyValue(impact.before_value, impact.unit);
  const after = formatCurrencyValue(impact.after_value, impact.unit);

  if (before === "—" && after === "—") {
    return "Not yet specified";
  }

  if (before === "—") {
    return `To ${after}`;
  }

  if (after === "—") {
    return `From ${before}`;
  }

  return `${before} to ${after}`;
}

export function formatImpactValue(impact = {}) {
  if (isFundingImpactMetric(impact.metric_name)) {
    return formatFundingChange(impact);
  }

  const after = formatImpactScalar(impact.after_value, impact.unit);
  const before = formatImpactScalar(impact.before_value, impact.unit);
  const comparison = formatImpactScalar(impact.comparison_value, impact.unit);

  if (after !== "—" && comparison !== "—") {
    return `${after} (comparison: ${comparison})`;
  }

  if (after !== "—") {
    return after;
  }

  if (before !== "—") {
    return before;
  }

  return "Not yet specified";
}

export function formatConfidenceLabel(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "Not rated";
  }

  const label = numeric >= 0.75 ? "High" : numeric >= 0.45 ? "Moderate" : "Low";
  return `${label} (${numeric.toFixed(2)})`;
}

function summarizeDemographicImpactHighlights(rows = [], limit = 2) {
  return rows
    .slice()
    .sort((left, right) => {
      const typeWeight =
        Number(isFundingImpactMetric(right.metric_name)) -
        Number(isFundingImpactMetric(left.metric_name));
      if (typeWeight !== 0) {
        return typeWeight;
      }

      const confidenceWeight =
        Number(right.confidence_score || 0) - Number(left.confidence_score || 0);
      if (confidenceWeight !== 0) {
        return confidenceWeight;
      }

      return Number(left.id || 0) - Number(right.id || 0);
    })
    .slice(0, limit)
    .map((impact) => ({
      id: impact.id,
      type: isFundingImpactMetric(impact.metric_name) ? "funding" : "supporting",
      program_label: deriveProgramLabel(impact.metric_name),
      metric_label: deriveMetricLabel(impact.metric_name),
      value_label: formatImpactValue(impact),
      demographic_group: impact.demographic_group || null,
      confidence_label: formatConfidenceLabel(impact.confidence_score),
    }));
}

function normalizeDirectionBreakdown(item = {}) {
  const counts = item.counts_by_direction || item.breakdowns?.by_direction || {};

  return {
    Positive: Number(counts.Positive || 0),
    Negative: Number(counts.Negative || 0),
    Mixed: Number(counts.Mixed || 0),
    Blocked: Number(counts.Blocked || 0),
  };
}

function buildPresidentScoreComposition({ president = {}, promiseRecords = [] } = {}) {
  const scoredOutcomes = promiseRecords.flatMap((record) => record.scored_outcomes || []);
  const directionCounts = {
    Positive: 0,
    Negative: 0,
    Mixed: 0,
    Blocked: 0,
  };
  const intentCounts = {
    equity_expanding: 0,
    equity_restricting: 0,
    neutral_administrative: 0,
    mixed_or_competing: 0,
    unclear: 0,
  };
  const systemicCounts = {
    limited: 0,
    standard: 0,
    strong: 0,
    transformational: 0,
    unclear: 0,
  };

  let systemicWeightedOutcomeCount = 0;

  for (const outcome of scoredOutcomes) {
    const direction = normalizeText(outcome?.impact_direction) || "Blocked";
    if (Object.prototype.hasOwnProperty.call(directionCounts, direction)) {
      directionCounts[direction] += 1;
    }

    const intentCategory = normalizeText(outcome?.policy_intent_category) || "unclear";
    if (Object.prototype.hasOwnProperty.call(intentCounts, intentCategory)) {
      intentCounts[intentCategory] += 1;
    } else {
      intentCounts.unclear += 1;
    }

    const systemicCategory = normalizeText(outcome?.systemic_impact_category) || "standard";
    if (Object.prototype.hasOwnProperty.call(systemicCounts, systemicCategory)) {
      systemicCounts[systemicCategory] += 1;
    } else {
      systemicCounts.unclear += 1;
    }

    if (["limited", "strong", "transformational"].includes(systemicCategory)) {
      systemicWeightedOutcomeCount += 1;
    }
  }

  const positive = directionCounts.Positive || 0;
  const negative = directionCounts.Negative || 0;
  const mixed = directionCounts.Mixed || 0;
  const blocked = directionCounts.Blocked || 0;
  const strongSystemic =
    Number(systemicCounts.strong || 0) + Number(systemicCounts.transformational || 0);
  const equityExpanding = intentCounts.equity_expanding || 0;
  const equityRestricting = intentCounts.equity_restricting || 0;
  const neutralIntent =
    Number(intentCounts.neutral_administrative || 0) +
    Number(intentCounts.mixed_or_competing || 0) +
    Number(intentCounts.unclear || 0);

  let interpretation =
    "This score is driven mostly by direct outcomes in the current public record.";

  if (positive > negative && positive >= mixed + blocked) {
    interpretation =
      "This score is driven mostly by direct positive outcomes in the current public record.";
  } else if (negative > positive && negative >= mixed + blocked) {
    interpretation =
      "This score is pulled downward mainly by negative direct outcomes in the current public record.";
  } else if (mixed + blocked > positive + negative) {
    interpretation =
      "This score is shaped more by mixed and blocked outcomes than by one clear directional pattern.";
  }

  if (equityExpanding > equityRestricting && equityExpanding > neutralIntent) {
    interpretation +=
      " The linked policy intent around these outcomes is mostly equity-expanding.";
  } else if (equityRestricting > equityExpanding && equityRestricting > neutralIntent) {
    interpretation +=
      " The linked policy intent around these outcomes is mostly equity-restricting.";
  } else if (neutralIntent > 0) {
    interpretation +=
      " Intent context is present, but much of it is administrative, mixed, or still unclear.";
  }

  if (systemicWeightedOutcomeCount === 0) {
    interpretation +=
      " Systemic amplification is limited here, so the page score is mostly explained by direct outcomes.";
  } else if (strongSystemic > 0) {
    interpretation +=
      " Strong or transformational systemic weighting reinforces part of the record through long-run structural effect.";
  } else {
    interpretation +=
      " Some non-standard systemic weighting is present, but it plays a secondary role to direct outcomes.";
  }

  return {
    summary_line:
      "This score reflects outcome-level impact, adjusted for confidence, policy intent, and systemic significance.",
    direct: {
      outcome_count: Number(
        president.direct_outcome_count || president.outcome_count || scoredOutcomes.length || 0
      ),
      promise_count: Number(president.promise_count || promiseRecords.length || 0),
      direction_counts: directionCounts,
    },
    intent: {
      counts: intentCounts,
      classified_outcome_count: scoredOutcomes.length - Number(intentCounts.unclear || 0),
    },
    systemic: {
      weighted_outcome_count: systemicWeightedOutcomeCount,
      counts: systemicCounts,
      strong_or_transformational_count: strongSystemic,
    },
    interpretation,
  };
}

function normalizeTopicBreakdown(item = {}) {
  const rows = item.score_by_topic || item.breakdowns?.by_topic || [];

  return (Array.isArray(rows) ? rows : [])
    .map((entry) => ({
      topic: entry.topic || entry.label || "Uncategorized",
      raw_score_total: Number(
        entry.raw_score_total ?? entry.raw_score ?? entry.score ?? 0
      ),
    }))
    .sort(
      (left, right) =>
        Math.abs(Number(right.raw_score_total || 0)) -
        Math.abs(Number(left.raw_score_total || 0))
    );
}

function buildPresidentBillInputSummary(billInputs = {}) {
  const linkedBillCount = Number(billInputs.linked_bill_count || 0);
  const linkedPromiseCount = Number(billInputs.linked_promises_with_bill_support || 0);
  const weightedScore = Number(billInputs.linked_bill_score_weighted || 0);
  const topDomain = billInputs.linked_bill_domains?.[0]?.domain || null;

  if (!linkedBillCount) {
    return "No bill-linked impact inputs are attached to this presidential record yet.";
  }

  return [
    `${linkedBillCount} linked bill${linkedBillCount === 1 ? "" : "s"}`,
    linkedPromiseCount ? `${linkedPromiseCount} promise-backed join${linkedPromiseCount === 1 ? "" : "s"}` : null,
    topDomain ? `top bill domain ${topDomain}` : null,
    `weighted bill BIS ${weightedScore.toFixed(2)}`,
  ]
    .filter(Boolean)
    .join(" • ");
}

function buildPresidentRecord(item = {}, promiseMeta = {}, billInputs = {}) {
  return {
    president: item.president,
    president_slug: item.president_slug,
    president_party: item.president_party || promiseMeta.president_party || "Historical record",
    slug: item.president_slug,
    name: item.president,
    party: item.president_party || promiseMeta.president_party || "Historical record",
    termLabel: formatTermLabel(promiseMeta.term_start, promiseMeta.term_end),
    score: item.normalized_score_total ?? item.direct_normalized_score,
    normalized_score_total: item.normalized_score_total ?? item.direct_normalized_score,
    systemic_score: item.systemic_normalized_score,
    systemic_index: item.systemic_index ?? item.systemic_normalized_score ?? null,
    systemic_category_label: normalizeSystemicCategoryLabel(item.systemic_category_label),
    direct_normalized_score: item.direct_normalized_score,
    direct_raw_score: item.direct_raw_score,
    direct_outcome_count: item.direct_outcome_count ?? item.outcome_count ?? 0,
    systemic_outcome_count: item.systemic_outcome_count ?? 0,
    promise_count: item.promise_count,
    outcome_count: item.outcome_count,
    score_confidence: item.direct_score_confidence || item.score_confidence,
    direct_score_confidence: item.direct_score_confidence || item.score_confidence,
    systemic_score_confidence: item.systemic_score_confidence || null,
    narrative_summary: item.narrative_summary,
    top_positive_promises: item.top_positive_promises || [],
    top_negative_promises: item.top_negative_promises || [],
    top_topics: normalizeTopicBreakdown(item).slice(0, 5),
    direction_breakdown: normalizeDirectionBreakdown(item),
    tone: getDirectionTone(item.normalized_score_total ?? item.direct_raw_score),
    linked_bill_count: Number(billInputs.linked_bill_count || 0),
    linked_bill_score_avg: Number(billInputs.linked_bill_score_avg || 0),
    linked_bill_score_weighted: Number(billInputs.linked_bill_score_weighted || 0),
    linked_positive_bill_count: Number(billInputs.linked_positive_bill_count || 0),
    linked_mixed_bill_count: Number(billInputs.linked_mixed_bill_count || 0),
    linked_negative_bill_count: Number(billInputs.linked_negative_bill_count || 0),
    linked_promises_with_bill_support: Number(billInputs.linked_promises_with_bill_support || 0),
    linked_bill_confidence_summary: billInputs.linked_bill_confidence_summary || {
      High: 0,
      Medium: 0,
      Low: 0,
    },
    linked_bill_domains: billInputs.linked_bill_domains || [],
    bill_input_method: billInputs.bill_input_method || null,
    bill_input_summary: buildPresidentBillInputSummary(billInputs),
    top_linked_bills: billInputs.top_linked_bills || [],
    bill_impact_inputs: billInputs,
    bill_blend_weight: Number(billInputs.bill_blend_weight || 0),
    bill_blend_weight_pct: Number(billInputs.bill_blend_weight_pct || 0),
    bill_blended_score: Number(billInputs.bill_blended_score || 0),
    bill_influence_label: billInputs.bill_influence_label || "No bill-linked inputs",
    blended_score_modifier: Number(billInputs.blended_score_modifier || 0),
  };
}

export async function fetchHomePageData() {
  const [
    readiness,
    policies,
    promises,
    overallSummary,
    categorySummary,
    presidentContext,
    currentAdministration,
    explainersIndex,
  ] = await Promise.all([
    fetchHomepageReadinessSummary(),
    fetchInternalJson("/api/policies?sort=impact_score_desc&page_size=8", {
      errorMessage: "Failed to fetch homepage policies",
    }),
    fetchPromiseList({ pageSize: 6, sort: "promise_date_desc", showAll: true }),
    getOverallSummary(),
    getCategorySummary(),
    fetchPresidentsScoreContext(),
    fetchCurrentAdministrationOverview().catch(() => null),
    fetchExplainersIndexData().catch(() => ({ items: [] })),
  ]);

  return {
    scores: presidentContext.scores,
    readiness,
    overallSummary,
    categorySummary,
    featuredPolicies: policies.items || [],
    recentPromises: promises.items || [],
    presidents: presidentContext.presidents || [],
    currentAdministration,
    explainers: explainersIndex.items || [],
  };
}

export async function fetchDashboardData(searchParams = {}) {
  const [scores, readiness, policyRankings, recentPromises, currentAdministration, categorySummary, presidentContext] =
    await Promise.all([
      computeOutcomeBasedScores(),
      fetchHomepageReadinessSummary(),
      fetchDashboardPolicyRankings(),
      fetchPromiseList({
        q: searchParams.q,
        president: searchParams.president,
        status: searchParams.status,
        topic: searchParams.topic,
        pageSize: 12,
        showAll: true,
      }),
      fetchCurrentAdministrationOverview().catch(() => null),
      getCategorySummary(),
      fetchPresidentsScoreContext(),
    ]);

  const promiseItems = (recentPromises.items || []).map((item) => ({
    ...item,
    confidence_label: confidenceFromSourceCount(item.source_count || 0),
  }));
  const promiseStatusCounts = normalizePromiseStatusCounts(
    recentPromises.status_counts || {}
  );

  return {
    scores,
    readiness,
    topPositivePolicies: policyRankings.topPositivePolicies,
    topNegativePolicies: policyRankings.topNegativePolicies,
    topMixedPolicies: policyRankings.topMixedPolicies,
    latestPolicyUpdates: policyRankings.latestPolicyUpdates,
    promiseSnapshot: {
      ...recentPromises,
      items: promiseItems,
      status_counts: promiseStatusCounts,
    },
    promiseLatestChanges: promiseItems
      .slice()
      .sort((left, right) =>
        String(right.latest_action_date || right.promise_date || "").localeCompare(
          String(left.latest_action_date || left.promise_date || "")
        )
      )
      .slice(0, 8),
    currentAdministration,
    categorySummary,
    presidentRanking: presidentContext.presidents
      .slice()
      .sort(
        (left, right) =>
          Number(right.normalized_score_total || right.score || 0) -
          Number(left.normalized_score_total || left.score || 0)
      )
      .slice(0, 6),
    insights: buildReportInsights({
      scores,
      categorySummary,
      promiseItems,
      promiseStatusCounts,
      presidents: presidentContext.presidents || [],
    }).slice(0, 4),
  };
}

async function fetchPresidentsScoreContext() {
  const [scores, promisePresidents] = await Promise.all([
    computeOutcomeBasedScores(),
    fetchPromisePresidentIndex({ showAll: true }),
  ]);

  const promisesBySlug = new Map(
    promisePresidents.map((item) => [item.slug, item])
  );

  const presidents = scores.presidents.map((item) => {
    const promiseMeta = promisesBySlug.get(item.president_slug) || {};

    return {
      ...buildPresidentRecord(item, promiseMeta, item.bill_impact_inputs || {}),
      breakdowns: item.breakdowns || {},
    };
  });

  return { scores, presidents, promisesBySlug };
}

export async function fetchPresidentsOverviewData(searchParams = {}) {
  const context = await fetchPresidentsScoreContext();
  const query = normalizeText(searchParams.q).toLowerCase();
  const sort = normalizeText(searchParams.sort) || "score_desc";

  let presidents = context.presidents;

  if (query) {
    presidents = presidents.filter((item) =>
      [item.name, item.party, item.termLabel]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }

  presidents = presidents.slice().sort((left, right) => {
    if (sort === "name_asc") {
      return left.name.localeCompare(right.name);
    }
    if (sort === "term_asc") {
      return left.termLabel.localeCompare(right.termLabel);
    }
    return Number((right.normalized_score_total ?? right.score) || 0) - Number((left.normalized_score_total ?? left.score) || 0);
  });

  return {
    ...context,
    presidents,
    bestCoveredPaths: buildPresidentCoverageHighlights(presidents),
    consequenceHighlights: buildPresidentConsequenceHighlights(presidents),
  };
}

export async function fetchPresidentProfileData(slug) {
  const [{ scores, presidents }, presidentPromiseDetail, explainersIndex] = await Promise.all([
    fetchPresidentsScoreContext(),
    fetchPromisePresidentDetail(slug, { showAll: true }),
    fetchExplainersIndexData(),
  ]);
  const president = presidents.find((item) => item.slug === slug || item.president_slug === slug);

  if (!president || !presidentPromiseDetail) {
    return null;
  }

  const promiseRecords = scores.records.filter((row) => row.president_slug === slug);
  const trend = summarizeImpactTrend(
    promiseRecords.flatMap((row) => row.scored_outcomes || [])
  );
  const statusSections = presidentPromiseDetail.status_sections || {};
  const promises = Array.isArray(statusSections)
    ? statusSections.flatMap((section) => section.items || [])
    : Object.values(statusSections).flat();
  const topPolicies = [
    ...(president.top_positive_promises || []),
    ...(president.top_negative_promises || []),
  ]
    .slice(0, 10)
    .map((item) => ({
      ...item,
      record_type: item.slug ? "Promise" : "Policy",
    }));
  const scoreDrivers = {
    strongest_positive: (president.top_positive_promises || []).slice(0, 3),
    strongest_negative: (president.top_negative_promises || []).slice(0, 3),
    topic_drivers: normalizeTopicBreakdown(president).slice(0, 4),
    direction_breakdown: normalizeDirectionBreakdown(president),
    score_scope_note:
      "This score reflects available policy records in the current EquityStack dataset, not every action in a presidency.",
  };
  const promiseStatusSnapshot = {
    Delivered: promises.filter((item) => item.status === "Delivered").length,
    "In Progress": promises.filter((item) => item.status === "In Progress").length,
    Partial: promises.filter((item) => item.status === "Partial").length,
    Failed: promises.filter((item) => item.status === "Failed").length,
    Blocked: promises.filter((item) => item.status === "Blocked").length,
  };
  const overallDirectionBreakdown = sumDirectionCounts(scores.records || []);
  const scoreComposition = buildPresidentScoreComposition({
    president,
    promiseRecords,
  });
  const profileInsight = buildPresidentProfileInsight(
    president.president || president.president_name || slug,
    scoreDrivers.direction_breakdown,
    overallDirectionBreakdown
  );
  const suggestedExplainers = resolveSuggestedExplainers({
    explainers: explainersIndex.items || [],
    textFields: [
      president.president,
      president.party,
      president.narrative_summary,
      profileInsight?.text,
      ...topPolicies.map((item) => item.title),
      ...scoreDrivers.topic_drivers.map((item) => item.topic),
    ],
    tagHints: [
      president.party,
      ...scoreDrivers.topic_drivers.map((item) => item.topic),
    ],
    categoryHints: ["president profile"],
    limit: 3,
  });

  return {
    president,
    promiseTracker: presidentPromiseDetail,
    promises,
    trend,
    topPolicies,
    scoreDrivers,
    scoreComposition,
    promiseStatusSnapshot,
    profileInsight,
    suggested_explainers: suggestedExplainers,
  };
}

export async function fetchPolicyExplorerData(searchParams = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams || {})) {
    if (value != null && value !== "") {
      params.set(key, String(value));
    }
  }
  if (!params.get("sort")) {
    params.set("sort", "impact_score_desc");
  }
  if (!params.get("page_size")) {
    params.set("page_size", "24");
  }

  const result = await fetchInternalJson(`/api/policies?${params.toString()}`, {
    errorMessage: "Failed to fetch policy explorer",
  });

  const categories = await query(
    "SELECT name FROM policy_categories ORDER BY name ASC"
  );
  const presidents = await query(
    `
    SELECT DISTINCT pr.full_name
    FROM policies p
    JOIN presidents pr ON pr.id = p.president_id
    WHERE p.is_archived = 0
    ORDER BY pr.full_name ASC
    `
  );
  const eras = await query(
    `
    SELECT DISTINCT e.name
    FROM policies p
    JOIN eras e ON e.id = p.era_id
    WHERE p.is_archived = 0
    ORDER BY e.name ASC
    `
  );

  const items = (result.items || []).map((item) => ({
    ...item,
    slug: buildPolicySlug(item),
  }));
  const policyIds = items
    .map((item) => Number(item.id || 0))
    .filter(Number.isFinite)
    .filter((value) => value > 0);
  const categoryMap = new Map();

  if (policyIds.length) {
    const placeholders = policyIds.map(() => "?").join(", ");
    const categoryRows = await query(
      `
      SELECT
        ppc.policy_id,
        pc.name
      FROM policy_policy_categories ppc
      JOIN policy_categories pc ON pc.id = ppc.category_id
      WHERE ppc.policy_id IN (${placeholders})
      ORDER BY pc.name ASC
      `,
      policyIds
    );

    for (const row of categoryRows) {
      const policyId = Number(row.policy_id || 0);
      if (!policyId) {
        continue;
      }
      const existing = categoryMap.get(policyId) || [];
      existing.push(row.name);
      categoryMap.set(policyId, existing);
    }
  }

  const enrichedItems = items.map((item) => ({
    ...item,
    category_names: categoryMap.get(Number(item.id || 0)) || [],
  }));
  const researchSummary = buildExplorerCoverageSummary({
    items: enrichedItems,
    collectionLabel: "visible policy record",
    structuredLabel: "score context",
    relatedLabel: "linked explainers or legislative context",
    sourceAccessor: (item) => item.evidence_summary?.total_sources || 0,
    structuredAccessor: (item) => item.impact_score != null,
    relatedAccessor: (item) =>
      Number(item.accountability_summary?.related_explainer_count || 0) > 0 ||
      Number(item.accountability_summary?.related_future_bill_count || 0) > 0 ||
      Number(item.accountability_summary?.linked_legislator_count || 0) > 0,
    scoredAccessor: (item) => item.impact_score != null,
  });

  return {
    ...result,
    items: enrichedItems,
    researchSummary,
    bestCoveredPaths: buildPolicyCoverageHighlights(enrichedItems),
    consequenceHighlights: buildPolicyConsequenceHighlights(enrichedItems),
    categorySynthesis: buildPolicyCategorySynthesis(enrichedItems),
    filterOptions: {
      categories: categories.map((row) => row.name),
      presidents: presidents.map((row) => row.full_name),
      eras: eras.map((row) => row.name),
    },
  };
}

export async function fetchPolicyDetailBySlug(slug) {
  const id = parsePolicyIdFromSlug(slug);
  if (!Number.isFinite(id)) {
    return null;
  }

  const [policy, explainersIndex] = await Promise.all([
    fetchInternalJson(`/api/policies/${id}`, {
      allow404: true,
      errorMessage: "Failed to fetch policy detail",
    }),
    fetchExplainersIndexData(),
  ]);

  if (!policy) {
    return null;
  }

  const suggestedExplainers = resolveSuggestedExplainers({
    explainers: explainersIndex.items || [],
    textFields: [
      policy.title,
      policy.summary,
      policy.policy_type,
      policy.impact_direction,
      policy.outcome_summary,
      policy.president,
      policy.era,
      ...(policy.categories || []).map((item) => item.name),
    ],
    tagHints: [
      policy.policy_type,
      policy.impact_direction,
      ...(policy.categories || []).map((item) => item.name),
    ],
    categoryHints: [policy.era, policy.primary_party],
    fallbackSlugs: (policy.related_explainers || []).map((item) => item.slug),
    limit: 3,
  });

  return {
    ...policy,
    slug: buildPolicySlug(policy),
    suggested_explainers: suggestedExplainers,
  };
}

export async function fetchPromiseIndexData(searchParams = {}) {
  const data = await fetchPromiseList({
    q: searchParams.q,
    president: searchParams.president,
    status: searchParams.status,
    topic: searchParams.topic,
    sort: searchParams.sort || "promise_date_desc",
    page: Number(searchParams.page || 1),
    pageSize: Number(searchParams.page_size || 24),
    showAll: true,
  });

  const statusCounts = normalizePromiseStatusCounts(data.status_counts || {});

  const items = (data.items || []).map((item) => ({
    ...item,
    confidence_label: confidenceFromSourceCount(item.source_count || 0),
  }));

  const researchSummary = buildExplorerCoverageSummary({
    items,
    collectionLabel: "visible promise record",
    structuredLabel: "linked outcomes",
    relatedLabel: "documented actions or downstream records",
    sourceAccessor: (item) => item.source_count || 0,
    structuredAccessor: (item) => Number(item.outcome_count || 0) > 0,
    relatedAccessor: (item) =>
      Number(item.outcome_count || 0) > 0 || Number(item.action_count || 0) > 0,
  });

  return {
    ...data,
    items,
    statusCounts,
    researchSummary,
    bestCoveredPaths: buildPromiseCoverageHighlights(items),
    consequenceHighlights: buildPromiseTrailHighlights(items),
    topicSynthesis: buildPromiseTopicSynthesis(items),
    latestStatusChanges: items
      .slice()
      .sort((left, right) =>
        String(right.latest_action_date || right.promise_date || "").localeCompare(
          String(left.latest_action_date || left.promise_date || "")
        )
      )
      .slice(0, 10),
  };
}

export async function fetchPromisePageData(slug) {
  const promise = await fetchPromiseDetail(slug);
  if (!promise) {
    return null;
  }

  const outcomes = promise.outcomes || [];
  const confidenceScores = outcomes
    .map((item) => Number(item.confidence_score))
    .filter(Number.isFinite);
  const averageConfidence =
    confidenceScores.length > 0
      ? confidenceScores.reduce((total, value) => total + value, 0) / confidenceScores.length
      : null;

  let confidenceLabel = null;
  if (averageConfidence != null) {
    if (averageConfidence >= 0.75) {
      confidenceLabel = "High";
    } else if (averageConfidence >= 0.45) {
      confidenceLabel = "Medium";
    } else {
      confidenceLabel = "Low";
    }
  }

  const latestOutcome = outcomes[outcomes.length - 1] || null;
  const reviewSummary = [
    promise.status ? `Current status: ${promise.status}.` : null,
    confidenceLabel ? `Evidence confidence is ${confidenceLabel.toLowerCase()}.` : null,
    latestOutcome?.source_quality ? `Latest linked outcome source quality is ${String(latestOutcome.source_quality).toLowerCase()}.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    ...promise,
    confidence_label: confidenceLabel,
    average_confidence_score:
      averageConfidence == null ? null : Number(averageConfidence.toFixed(4)),
    review_summary: reviewSummary || null,
    latest_outcome: latestOutcome,
  };
}

export async function fetchAdministrationsOverviewData(searchParams = {}) {
  const [{ presidents: scoredPresidents }, promisePresidents] = await Promise.all([
    fetchPresidentsScoreContext(),
    fetchPromisePresidentIndex({ showAll: true }),
  ]);
  const scoreBySlug = new Map(scoredPresidents.map((item) => [item.slug, item]));
  const queryText = normalizeText(searchParams.q).toLowerCase();

  return promisePresidents
    .map((item) => ({
    ...item,
    slug: item.slug,
    administration_name: `${item.president} administration`,
    termLabel: formatTermLabel(item.term_start, item.term_end),
    direct_normalized_score: scoreBySlug.get(item.slug)?.direct_normalized_score ?? null,
    systemic_normalized_score: scoreBySlug.get(item.slug)?.systemic_score ?? null,
    score_confidence: scoreBySlug.get(item.slug)?.score_confidence ?? null,
    outcome_count: scoreBySlug.get(item.slug)?.outcome_count ?? 0,
  }))
    .filter((item) =>
      !queryText ||
      [item.administration_name, item.president, item.president_party]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(queryText))
    );
}

export async function fetchAdministrationDetailData(slug) {
  const [administration, presidentProfile] = await Promise.all([
    fetchCurrentAdministrationOverview(slug).catch(async () => fetchPromisePresidentDetail(slug, { showAll: true })),
    fetchPresidentProfileData(slug).catch(() => null),
  ]);

  if (!administration && !presidentProfile) {
    return null;
  }

  let linkedPolicyFeed = [];
  const presidentId =
    presidentProfile?.president?.president_id ??
    administration?.president?.id ??
    null;

  if (presidentId) {
    linkedPolicyFeed = await query(
      `
      SELECT
        p.id,
        p.title,
        p.summary,
        p.year_enacted,
        p.impact_direction,
        p.policy_type,
        (
          COALESCE(ps.directness_score, 0) +
          COALESCE(ps.material_impact_score, 0) +
          COALESCE(ps.evidence_score, 0) +
          COALESCE(ps.durability_score, 0) +
          COALESCE(ps.equity_score, 0) -
          COALESCE(ps.harm_offset_score, 0)
        ) AS impact_score
      FROM policies p
      LEFT JOIN policy_scores ps ON ps.policy_id = p.id
      WHERE p.is_archived = 0
        AND p.president_id = ?
      ORDER BY impact_score DESC, p.year_enacted DESC, p.id DESC
      LIMIT 8
      `,
      [presidentId]
    );
  }

  return {
    administration,
    presidentProfile,
    linkedPolicyFeed: linkedPolicyFeed.map((item) => ({
      ...item,
      slug: buildPolicySlug(item),
    })),
    administrationStatusSummary: administration
      ? {
          delivered: administration.president?.visible_delivered_count ?? 0,
          in_progress: administration.president?.visible_in_progress_count ?? 0,
          partial: administration.president?.visible_partial_count ?? 0,
          failed: administration.president?.visible_failed_count ?? 0,
          blocked: administration.president?.visible_blocked_count ?? 0,
        }
      : null,
  };
}

export async function fetchReportsHubData(searchParams = {}) {
  const [
    scores,
    overallSummary,
    byParty,
    byEra,
    directByParty,
    directByEra,
    categorySummary,
  ] = await Promise.all([
    computeOutcomeBasedScores(),
    getOverallSummary(),
    getSummaryByParty(),
    getSummaryByEra(),
    getDirectImpactSummaryByParty(),
    getDirectImpactSummaryByEra(),
    getCategorySummary(),
  ]);

  const queryText = normalizeText(searchParams.q).toLowerCase();
  const categoryFilter = normalizeText(searchParams.category);
  const reports = getPublicReportDefinitions();
  const filteredReports = reports.filter((item) => {
    const categoryMatch =
      !categoryFilter ||
      [item.category, item.theme]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase() === categoryFilter.toLowerCase());
    const queryMatch =
      !queryText ||
      [item.title, item.summary, item.category, item.theme]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(queryText));
    return categoryMatch && queryMatch;
  });
  const strongestCategory =
    categorySummary
      .slice()
      .sort(
        (left, right) =>
          Math.abs(Number(right.net_weighted_impact || 0)) -
          Math.abs(Number(left.net_weighted_impact || 0))
      )[0] || null;

  return {
    scores,
    overallSummary,
    byParty,
    byEra,
    directByParty,
    directByEra,
    categorySummary,
    reports,
    featuredReports: filteredReports.filter((item) => item.featured),
    filteredReports,
    reportCategories: [
      ...new Set(
        reports
          .flatMap((item) => [item.category, item.theme])
          .filter(Boolean)
      ),
    ],
    reportKpis: {
      report_count: reports.length,
      featured_count: reports.filter((item) => item.featured).length,
      presidents_scored: scores.presidents?.length || 0,
      categories_covered: categorySummary.length,
      strongest_category: strongestCategory?.name || null,
    },
    insights: buildReportInsights({
      scores,
      categorySummary,
      presidents: scores.presidents || [],
    }).slice(0, 3),
  };
}

export async function fetchReportDetailData(slug) {
  const [hub, dashboard, explainersIndex] = await Promise.all([
    fetchReportsHubData(),
    fetchDashboardData(),
    fetchExplainersIndexData(),
  ]);
  const directionCounts = sumDirectionCounts(hub.scores.records || []);
  const reportDefinition = hub.reports.find((item) => item.slug === slug);

  if (!reportDefinition) {
    return null;
  }

  if (slug === "black-impact-score") {
    const findings = [
      {
        title: "Score Coverage",
        text: `${formatCount(hub.scores.metadata?.outcomes_included_in_score ?? 0)} scored outcomes are currently included in the public Black Impact Score model.`,
      },
      {
        title: "Confidence",
        text: `${Math.round((hub.scores.metadata?.trust?.high_confidence_outcome_percentage || 0) * 100)}% of currently scored outcomes sit in the high-confidence share.`,
      },
      buildCategoryInsight(hub.categorySummary),
      buildDirectionInsight(hub.scores.records || []),
    ].filter(Boolean);

    return attachSuggestedExplainersToReport({
      slug,
      title: "Black Impact Score",
      href: reportDefinition.href,
      category: reportDefinition.category,
      theme: reportDefinition.theme,
      summary:
        hub.scores.metadata?.summary_interpretation || reportDefinition.summary,
      metrics: [
        {
          label: "Included outcomes",
          value: hub.scores.metadata?.outcomes_included_in_score ?? 0,
          description: "Scored outcomes included in the current public model.",
        },
        {
          label: "Excluded outcomes",
          value: hub.scores.metadata?.outcomes_excluded_from_score ?? 0,
          description:
            "Available outcomes kept outside the score because of scope or trust rules.",
        },
        {
          label: "High confidence",
          value: formatPercent(
            hub.scores.metadata?.trust?.high_confidence_outcome_percentage
          ),
          description: "Share of outcomes with stronger confidence support.",
        },
      ],
      chartBlocks: [
        {
          type: "trend",
          title: "Score change over time",
          description:
            "Time-aware scoring shows when outcome impact accelerated or slowed.",
          data: hub.scores.metadata?.impact_trend?.score_by_year || [],
        },
        {
          type: "category",
          title: "Category impact",
          description:
            "The strongest score movement is usually concentrated in a small number of policy domains.",
          data: hub.categorySummary.map((item) => ({
            name: item.name,
            score: Number(item.net_weighted_impact || 0),
          })),
        },
      ],
      findings,
      relatedReports: hub.reports.filter(
        (item) => item.slug !== slug && item.slug !== "civil-rights-timeline"
      ),
      relatedLinks: [
        { href: "/methodology", label: "Read methodology" },
        { href: "/dashboard", label: "Open public dashboard" },
      ],
    }, explainersIndex);
  }

  if (slug === "civil-rights-timeline") {
    const strongestEra = hub.byEra
      .slice()
      .sort(
        (left, right) =>
          Math.abs(Number(right.net_weighted_impact || 0)) -
          Math.abs(Number(left.net_weighted_impact || 0))
      )[0];

    return attachSuggestedExplainersToReport({
      slug,
      title: "Civil Rights Timeline",
      href: reportDefinition.href,
      category: reportDefinition.category,
      theme: reportDefinition.theme,
      summary:
        "A chronology-first report for tracing major rights expansion, restriction, enforcement shifts, and historical turning points across the public civil-rights record affecting Black Americans.",
      metrics: [
        {
          label: "Historical eras",
          value: hub.byEra.length,
          description: "Eras currently visible in the public historical summary layer.",
        },
        {
          label: "Scored outcomes",
          value: hub.scores.metadata?.outcomes_included_in_score ?? 0,
          description: "Scored outcomes currently contributing to the visible historical readout.",
        },
        {
          label: "Tracked categories",
          value: hub.categorySummary.length,
          description: "Issue categories represented in the current civil-rights timeline frame.",
        },
      ],
      chartBlocks: [
        {
          type: "trend",
          title: "Score movement over time",
          description:
            "A chronology-first read helps show when visible score movement accelerated, stalled, or reversed across the public record.",
          data: hub.scores.metadata?.impact_trend?.score_by_year || [],
        },
        {
          type: "category",
          title: "Net impact by era",
          description:
            "Era groupings help place civil-rights change in longer historical context rather than treating the record as one continuous period.",
          data: hub.byEra.map((item) => ({
            name: item.name,
            score: Number(item.net_weighted_impact || 0),
          })),
        },
        {
          type: "direction",
          title: "Visible direction mix across the timeline",
          description:
            "Positive, mixed, negative, and blocked outcomes remain visible so the timeline keeps expansion, rollback, and contested change in view together.",
          data: [
            {
              name: "Positive",
              value: Number(directionCounts.Positive || 0),
              color: "#84f7c6",
            },
            {
              name: "Mixed",
              value: Number(directionCounts.Mixed || 0),
              color: "#fbbf24",
            },
            {
              name: "Negative",
              value: Number(directionCounts.Negative || 0),
              color: "#ff8a8a",
            },
            {
              name: "Blocked",
              value: Number(directionCounts.Blocked || 0),
              color: "#8da1b9",
            },
          ],
        },
      ],
      findings: [
        buildDirectionInsight(hub.scores.records || []),
        buildCategoryInsight(hub.categorySummary),
        strongestEra?.name
          ? {
              title: "Era concentration",
              text: `${strongestEra.name} currently shows the strongest net weighted impact in the public era summaries attached to this timeline view.`,
            }
          : null,
        hub.scores.metadata?.summary_interpretation
          ? {
              title: "Dataset interpretation",
              text: hub.scores.metadata.summary_interpretation,
            }
          : null,
      ].filter(Boolean),
      relatedReports: hub.reports.filter(
        (item) => item.slug !== slug && item.slug !== "executive-overview"
      ),
      relatedLinks: [
        { href: "/timeline", label: "Browse the public timeline" },
        { href: "/policies", label: "Open policy explorer" },
        { href: "/methodology", label: "Read methodology" },
      ],
      latestUpdates: dashboard.latestPolicyUpdates?.slice(0, 8) || [],
      topPolicies: {
        positive: dashboard.topPositivePolicies?.slice(0, 4) || [],
        negative: dashboard.topNegativePolicies?.slice(0, 4) || [],
        mixed: dashboard.topMixedPolicies?.slice(0, 4) || [],
      },
    }, explainersIndex);
  }

  if (slug === "historical-distribution") {
    const strongestEra = hub.byEra
      .slice()
      .sort(
        (left, right) =>
          Math.abs(Number(right.net_weighted_impact || 0)) -
          Math.abs(Number(left.net_weighted_impact || 0))
      )[0];
    const strongestParty = hub.byParty
      .slice()
      .sort(
        (left, right) =>
          Math.abs(Number(right.net_weighted_impact || 0)) -
          Math.abs(Number(left.net_weighted_impact || 0))
      )[0];

    return attachSuggestedExplainersToReport({
      slug,
      title: "Historical Distribution",
      href: reportDefinition.href,
      category: reportDefinition.category,
      theme: reportDefinition.theme,
      summary:
        "View the dataset through category, party, and era distributions.",
      metrics: [
        {
          label: "Categories",
          value: hub.categorySummary.length,
          description: "Distinct issue categories represented in the current dataset.",
        },
        {
          label: "Party groups",
          value: hub.byParty.length,
          description: "Party summary rows available in the current reporting layer.",
        },
        {
          label: "Eras",
          value: hub.byEra.length,
          description: "Historical eras with visible policy coverage in the summary tables.",
        },
      ],
      chartBlocks: [
        {
          type: "category",
          title: "Average category impact",
          description:
            "Average impact score helps show which issue areas concentrate higher-weighted records.",
          data: hub.categorySummary.map((item) => ({
            name: item.name,
            score: Number(item.avg_policy_impact_score || 0),
          })),
        },
        {
          type: "category",
          title: "Net impact by era",
          description:
            "Historical distribution is uneven. Era context matters when reading the public dataset.",
          data: hub.byEra.map((item) => ({
            name: item.name,
            score: Number(item.net_weighted_impact || 0),
          })),
        },
        {
          type: "category",
          title: "Net impact by party",
          description:
            "Party labels are descriptive historical buckets, not timeless ideological equivalents.",
          data: hub.byParty.map((item) => ({
            name: item.name,
            score: Number(item.net_weighted_impact || 0),
          })),
        },
      ],
      findings: [
        buildCategoryInsight(hub.categorySummary),
        strongestEra?.name
          ? {
              title: "Era Concentration",
              text: `${strongestEra.name} shows the strongest net weighted impact among the currently summarized historical eras.`,
            }
          : null,
        strongestParty?.name
          ? {
              title: "Party Distribution",
              text: `${strongestParty.name} currently shows the strongest net weighted impact among the party summary groups in this report.`,
            }
          : null,
      ].filter(Boolean),
      relatedReports: hub.reports.filter((item) => item.slug !== slug),
      relatedLinks: [
        { href: "/timeline", label: "Browse the public timeline" },
        { href: "/policies", label: "Open policy explorer" },
      ],
    }, explainersIndex);
  }

  return attachSuggestedExplainersToReport({
    slug,
    title: "Executive Overview",
    href: reportDefinition.href,
    category: reportDefinition.category,
    theme: reportDefinition.theme,
    summary: "A high-level report view of the current EquityStack dataset.",
    metrics: [
      {
        label: "Tracked outcomes",
        value: hub.scores.metadata?.total_outcomes_available ?? 0,
        description:
          "Current-admin and legislative outcomes visible in the public score context.",
      },
      {
        label: "Latest updates",
        value: dashboard.latestPolicyUpdates?.length || 0,
        description:
          "Recent policy updates pulled into the public dashboard layer.",
      },
      {
        label: "Trust status",
        value: hub.scores.metadata?.trust?.certification_status || "Unknown",
        description:
          "Latest certification-style readout available to the public summary layer.",
      },
    ],
    chartBlocks: [
      {
        type: "category",
        title: "Direct impact by party",
        description:
          "A direct-only read keeps outcome counts separate from broader structural or systemic context.",
        data: hub.directByParty.map((item) => ({
          name: item.name,
          score: Number(item.direct_black_impact_count || 0),
        })),
      },
      {
        type: "category",
        title: "Direct impact by era",
        description:
          "Era groupings help identify where the current dataset is concentrated historically.",
        data: hub.directByEra.map((item) => ({
          name: item.name,
          score: Number(item.direct_black_impact_count || 0),
        })),
      },
      {
        type: "direction",
        title: "Visible direction mix",
        description:
          "Positive, mixed, negative, and blocked outcomes stay visible in the executive summary instead of being collapsed into one number.",
        data: [
          {
            name: "Positive",
            value: Number(directionCounts.Positive || 0),
            color: "#84f7c6",
          },
          {
            name: "Mixed",
            value: Number(directionCounts.Mixed || 0),
            color: "#fbbf24",
          },
          {
            name: "Negative",
            value: Number(directionCounts.Negative || 0),
            color: "#ff8a8a",
          },
          {
            name: "Blocked",
            value: Number(directionCounts.Blocked || 0),
            color: "#8da1b9",
          },
        ],
      },
    ],
    findings: [
      dashboard.currentAdministration?.summary
        ? {
            title: "Current Administration",
            text: dashboard.currentAdministration.summary,
          }
        : null,
      hub.scores.metadata?.summary_interpretation
        ? {
            title: "Dataset Readout",
            text: hub.scores.metadata.summary_interpretation,
          }
        : null,
      buildDirectionInsight(hub.scores.records || []),
      buildPromiseInsight({
        statusCounts: dashboard.promiseSnapshot.status_counts || {},
      }),
    ].filter(Boolean),
    topPolicies: {
      positive: dashboard.topPositivePolicies?.slice(0, 4) || [],
      negative: dashboard.topNegativePolicies?.slice(0, 4) || [],
      mixed: dashboard.topMixedPolicies?.slice(0, 4) || [],
    },
    latestUpdates: dashboard.latestPolicyUpdates?.slice(0, 8) || [],
    relatedReports: hub.reports.filter((item) => item.slug !== slug),
    relatedLinks: [
      { href: "/dashboard", label: "Open dashboard" },
      { href: "/methodology", label: "Read methodology" },
    ],
  }, explainersIndex);
}

export async function fetchExplainersIndexData() {
  const explainers = await fetchInternalJson("/api/explainers", {
    errorMessage: "Failed to fetch explainers",
  });
  const items = (explainers || []).map((item) => {
    const editorial = getExplainerEditorial(item.slug);
    const argumentMode = normalizeArgumentMode(editorial.argumentMode);
    const argumentReady = normalizeArgumentReady(editorial.argumentReady);
    const generatedArgumentMode = argumentMode
      ? null
      : buildGeneratedArgumentMode(item, [], argumentReady);
    const argumentSignal = buildExplainerArgumentSignal({
      argumentMode,
      argumentReady,
      explainerType: editorial.explainer_type,
      editorialCategory: editorial.category,
    });
    return {
      ...item,
      editorial_category: normalizeText(editorial.category),
      editorial_category_label: formatSlugLabel(editorial.category),
      explainer_type: normalizeText(editorial.explainer_type),
      tags: normalizeList(editorial.tags),
      argument_ready: Boolean(argumentMode || generatedArgumentMode || argumentReady),
      argument_signal_label: argumentSignal?.label || null,
      argument_signal_tone: argumentSignal?.tone || "default",
    };
  });
  const editorialCategories = Array.from(
    items.reduce((map, item) => {
      if (!item.editorial_category) return map;
      const current = map.get(item.editorial_category) || {
        slug: item.editorial_category,
        label: item.editorial_category_label || formatSlugLabel(item.editorial_category),
        count: 0,
      };
      current.count += 1;
      map.set(item.editorial_category, current);
      return map;
    }, new Map()).values()
  ).sort((left, right) => left.label.localeCompare(right.label));

  return {
    items,
    categories: [...new Set(items.map((item) => item.category).filter(Boolean))],
    editorialCategories,
  };
}

export async function fetchExplainerCategoryData(categorySlug) {
  const category = normalizeText(categorySlug).toLowerCase();
  if (!category) return null;

  const index = await fetchExplainersIndexData();
  const categoryMeta = (index.editorialCategories || []).find((item) => item.slug === category);
  if (!categoryMeta) return null;

  return {
    category: categoryMeta,
    items: (index.items || []).filter((item) => item.editorial_category === category),
    categories: index.categories || [],
    editorialCategories: index.editorialCategories || [],
  };
}

export async function fetchExplainerDetailData(slug, options = {}) {
  const indexPromise = options.index
    ? Promise.resolve(options.index)
    : fetchExplainersIndexData();
  const [explainer, index] = await Promise.all([
    fetchInternalJson(`/api/explainers/${slug}`, {
      allow404: true,
      errorMessage: "Failed to fetch explainer",
    }),
    indexPromise,
  ]);

  if (!explainer) {
    return null;
  }

  const editorial = getExplainerEditorial(slug);
  const argumentMode = normalizeArgumentMode(editorial.argumentMode);
  const argumentReady = normalizeArgumentReady(editorial.argumentReady);
  const structuredSections = [
    { title: "Common claim", body: explainer.common_claim },
    { title: "What actually happened", body: explainer.what_actually_happened },
    { title: "Why it matters", body: explainer.why_it_matters },
    { title: "Key policies", body: explainer.key_policies_text },
    { title: "Why it still matters", body: explainer.why_it_still_matters },
    { title: "Sources note", body: explainer.sources_note },
  ].filter((item) => normalizeText(item.body));
  const editorialStructuredSections = (editorial.structuredSections || [])
    .filter((item) => normalizeText(item?.body))
    .map((item) => ({
      title: item.title,
      body: item.body,
    }));
  const resolvedArgumentMode =
    argumentMode ||
    buildGeneratedArgumentMode(
      explainer,
      [...structuredSections, ...editorialStructuredSections],
      argumentReady
    );
  const argumentSignal = buildExplainerArgumentSignal({
    argumentMode: resolvedArgumentMode,
    argumentReady,
    explainerType: editorial.explainer_type,
    editorialCategory: editorial.category,
  });
  const explicitRelatedExplainers = normalizeList(editorial.relatedExplainers)
    .map((relatedSlug) => (index.items || []).find((item) => item.slug === relatedSlug))
    .filter(Boolean);
  const fallbackRelatedExplainers = (index.items || [])
    .filter((item) => item.slug !== slug && item.category === explainer.category)
    .slice(0, 3);
  const editorialRelatedPolicies = await resolveEditorialRelatedPolicies(editorial.relatedPolicies);
  const relatedPolicies = [...(explainer.related_policies || [])];
  const relatedPolicyIds = new Set(relatedPolicies.map((item) => item.id));
  for (const item of editorialRelatedPolicies) {
    if (!relatedPolicyIds.has(item.id)) {
      relatedPolicies.push(item);
      relatedPolicyIds.add(item.id);
    }
  }

  return {
    ...explainer,
    argument_mode: resolvedArgumentMode,
    argument_ready_breakdown: normalizeExplainerArgumentReady(
      explainer,
      resolvedArgumentMode,
      argumentReady
    ),
    argument_signal_label: argumentSignal?.label || null,
    argument_signal_tone: argumentSignal?.tone || "default",
    explainer_type: normalizeText(editorial.explainer_type),
    tags: normalizeList(editorial.tags),
    editorial_category: normalizeText(editorial.category),
    editorial_category_label: formatSlugLabel(editorial.category),
    related_policies: relatedPolicies,
    related_reports: resolveReportDefinitions(editorial.relatedReports),
    sources: enrichExplainerSources(explainer.sources, editorial.sourceContexts),
    structured_sections: [...structuredSections, ...editorialStructuredSections],
    related_explainers: explicitRelatedExplainers.length
      ? explicitRelatedExplainers
      : fallbackRelatedExplainers,
  };
}

function buildArgumentEntriesFromExplainer(explainer = {}) {
  const argumentMode = explainer.argument_mode;
  if (!argumentMode) return [];

  const source = {
    slug: explainer.slug,
    title: explainer.title,
    href: `/explainers/${explainer.slug}?mode=argument`,
    category: explainer.editorial_category || explainer.category || "",
    categoryLabel:
      explainer.editorial_category_label ||
      formatSlugLabel(explainer.editorial_category || explainer.category),
    tags: normalizeList(explainer.tags),
  };
  const entries = [];

  if (argumentMode.summary) {
    entries.push({
      id: `${explainer.slug}-summary`,
      type: "Core argument",
      tone: "info",
      text: argumentMode.summary,
      source,
    });
  }

  for (const [index, item] of (argumentMode.keyPoints || []).entries()) {
    entries.push({
      id: `${explainer.slug}-key-point-${index}`,
      type: "Key point",
      tone: "verified",
      text: item,
      source,
    });
  }

  for (const [index, item] of (argumentMode.commonClaims || []).entries()) {
    const text = [
      item.claim ? `Claim: ${item.claim}` : "",
      item.response ? `Response: ${item.response}` : "",
      item.question ? `Key question: ${item.question}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    if (!text) continue;

    entries.push({
      id: `${explainer.slug}-common-claim-${index}`,
      type: "Common claim",
      tone: "warning",
      text,
      source,
    });
  }

  for (const [index, item] of (argumentMode.debateLines || []).entries()) {
    entries.push({
      id: `${explainer.slug}-debate-line-${index}`,
      type: "Debate line",
      tone: "default",
      text: item,
      source,
    });
  }

  for (const [index, item] of (argumentMode.shareCards || []).entries()) {
    const text = [item.title, item.text, item.context]
      .filter(Boolean)
      .join("\n\n");
    entries.push({
      id: `${explainer.slug}-share-card-${index}`,
      type: "Share card",
      tone: "info",
      text,
      source,
    });
  }

  return entries;
}

export async function fetchArgumentLibraryData(searchParams = {}) {
  const resolvedSearchParams = searchParams || {};
  const selectedCategory = normalizeText(resolvedSearchParams.category);
  const selectedTag = normalizeText(resolvedSearchParams.tag);
  const index = await fetchExplainersIndexData();
  const explainers = (
    await Promise.all(
      (index.items || []).map((item) => fetchExplainerDetailData(item.slug, { index }))
    )
  ).filter(Boolean);
  const filteredExplainers = explainers.filter((item) => {
    const categoryMatch =
      !selectedCategory ||
      item.editorial_category === selectedCategory ||
      item.category === selectedCategory;
    const tagMatch = !selectedTag || normalizeList(item.tags).includes(selectedTag);
    return categoryMatch && tagMatch;
  });
  const entries = filteredExplainers.flatMap((item) => buildArgumentEntriesFromExplainer(item));
  const categories = Array.from(
    explainers.reduce((map, item) => {
      const slug = item.editorial_category || item.category;
      if (!slug) return map;
      const label = item.editorial_category_label || formatSlugLabel(slug);
      if (!map.has(slug)) map.set(slug, { slug, label, count: 0 });
      map.get(slug).count += 1;
      return map;
    }, new Map()).values()
  ).sort((left, right) => left.label.localeCompare(right.label));
  const tags = Array.from(
    explainers.reduce((map, item) => {
      for (const tag of normalizeList(item.tags)) {
        if (!map.has(tag)) map.set(tag, { slug: tag, label: formatSlugLabel(tag), count: 0 });
        map.get(tag).count += 1;
      }
      return map;
    }, new Map()).values()
  ).sort((left, right) => left.label.localeCompare(right.label));

  return {
    entries,
    explainers,
    totalExplainers: explainers.length,
    argumentReadyExplainers: explainers.filter((item) => item.argument_mode).length,
    categories,
    tags,
    selectedCategory,
    selectedTag,
  };
}

export async function fetchTimelineData(searchParams = {}) {
  const [policyRows, promiseRows] = await Promise.all([
    query(
      `
      SELECT
        p.id,
        p.title,
        p.policy_type,
        p.year_enacted,
        p.summary,
        p.impact_direction,
        p.direct_black_impact,
        ${POLICY_IMPACT_SCORE_SQL} AS impact_score,
        (
          SELECT COUNT(DISTINCT s.id)
          FROM sources s
          WHERE s.policy_id = p.id
        ) AS total_sources,
        (
          SELECT COUNT(*)
          FROM policy_relationships prx
          WHERE prx.policy_id = p.id OR prx.related_policy_id = p.id
        ) AS relationship_count,
        pr.full_name AS president
      FROM policies p
      LEFT JOIN presidents pr ON pr.id = p.president_id
      LEFT JOIN policy_scores ps ON ps.policy_id = p.id
      WHERE p.is_archived = 0
      ORDER BY p.year_enacted DESC, p.id DESC
      LIMIT 80
      `
    ),
    query(
      `
      SELECT
        pr.id,
        pr.slug,
        pr.title,
        pr.promise_date,
        pr.summary,
        pr.status,
        pr.president,
        (
          SELECT COUNT(*)
          FROM promise_actions pa
          WHERE pa.promise_id = pr.id
        ) AS action_count,
        (
          SELECT COUNT(*)
          FROM promise_outcomes po
          WHERE po.promise_id = pr.id
        ) AS outcome_count,
        (
          SELECT COUNT(*)
          FROM promise_sources ps
          WHERE ps.promise_id = pr.id
        ) AS source_count
      FROM promises pr
      ORDER BY pr.promise_date DESC, pr.id DESC
      LIMIT 60
      `
    ).catch(() => []),
  ]);

  const policyEvents = policyRows.map((row) => ({
    id: `policy-${row.id}`,
    kind: "Policy",
    title: row.title,
    summary: row.summary,
    year: row.year_enacted,
    president: row.president,
    direction: row.impact_direction,
    href: `/policies/${buildPolicySlug(row)}`,
    highlight: buildPolicyTimelineHighlight(row),
    badges: [row.impact_direction || "Policy", row.president || "Historical record"],
  }));
  const promiseEvents = promiseRows.map((row) => ({
    id: `promise-${row.slug}`,
    kind: "Promise",
    title: row.title,
    summary: row.summary,
    year: row.promise_date ? new Date(row.promise_date).getFullYear() : null,
    president: row.president,
    direction: row.status,
    href: `/promises/${row.slug}`,
    highlight: buildPromiseTimelineHighlight(row),
    badges: [row.status || "Promise", row.president || "Historical record"],
  }));

  const events = [...policyEvents, ...promiseEvents];
  const queryText = normalizeText(searchParams.q).toLowerCase();
  const typeFilter = normalizeText(searchParams.type);
  const directionFilter = normalizeText(searchParams.direction);
  const modeFilter = normalizeText(searchParams.mode);

  const filteredEvents = events
    .filter((item) => {
      const matchesQuery =
        !queryText ||
        [item.title, item.summary, item.president, ...(item.badges || [])]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(queryText));
      const matchesType = !typeFilter || item.kind === typeFilter;
      const matchesDirection = !directionFilter || item.direction === directionFilter;
      const matchesMode =
        !modeFilter ||
        (modeFilter === "turning_points" && Boolean(item.highlight)) ||
        (modeFilter === "rights_expansion" && item.highlight?.group === "rights_expansion") ||
        (modeFilter === "rollback" && item.highlight?.group === "rollback");
      return matchesQuery && matchesType && matchesDirection && matchesMode;
    })
    .sort((left, right) => {
      if (modeFilter) {
        const rankDifference =
          Number(right.highlight?.rank || 0) - Number(left.highlight?.rank || 0);
        if (rankDifference !== 0) {
          return rankDifference;
        }
      }

      return Number(right.year || 0) - Number(left.year || 0);
    });

  return {
    items: filteredEvents,
    interpretiveSummary: buildTimelineInterpretiveSummary(filteredEvents, modeFilter),
    filters: {
      q: searchParams.q || "",
      type: typeFilter,
      direction: directionFilter,
      mode: modeFilter,
    },
    filterOptions: {
      types: [...new Set(events.map((item) => item.kind))],
      directions: [...new Set(events.map((item) => item.direction).filter(Boolean))],
      modes: [
        { value: "", label: "Chronological view" },
        { value: "turning_points", label: "Turning points" },
        { value: "rights_expansion", label: "Rights expansion" },
        { value: "rollback", label: "Rollback / restriction" },
      ],
    },
  };
}

export async function fetchSourcesLibraryData(search = "") {
  const likeValue = `%${normalizeText(search)}%`;
  const rows = await query(
    `
    SELECT
      s.id,
      s.source_title,
      s.source_url,
      s.source_type,
      s.publisher,
      s.published_date,
      s.notes,
      CASE
        WHEN s.source_type IN ('Government', 'Academic', 'Archive', 'Court') THEN 'High authority'
        WHEN s.source_type IN ('News', 'Nonprofit') THEN 'Contextual'
        ELSE 'Unclassified'
      END AS trust_label,
      CASE WHEN s.policy_id IS NULL THEN 0 ELSE 1 END AS policy_link_count,
      (
        SELECT COUNT(*)
        FROM promise_sources ps
        WHERE ps.source_id = s.id
      ) AS promise_link_count,
      (
        SELECT COUNT(*)
        FROM promise_action_sources pas
        WHERE pas.source_id = s.id
      ) AS action_link_count,
      (
        SELECT COUNT(*)
        FROM policy_outcome_sources pos
        WHERE pos.source_id = s.id
      ) AS outcome_link_count
      ,
      (
        SELECT COUNT(*)
        FROM entity_demographic_impact_sources edis
        WHERE edis.source_id = s.id
      ) AS impact_link_count
    FROM sources s
    WHERE (? = '%%')
       OR s.source_title LIKE ?
       OR s.publisher LIKE ?
       OR s.source_type LIKE ?
       OR s.source_url LIKE ?
    ORDER BY s.published_date DESC, s.id DESC
    LIMIT 200
    `,
    [likeValue, likeValue, likeValue, likeValue, likeValue]
  );

  const sourceIds = rows
    .map((row) => Number(row.id || 0))
    .filter(Number.isFinite)
    .filter((value) => value > 0);

  if (!sourceIds.length) {
    return rows.map((row) => {
      const linked_record_count =
        Number(row.policy_link_count || 0) +
        Number(row.promise_link_count || 0) +
        Number(row.action_link_count || 0) +
        Number(row.outcome_link_count || 0);
      const support_link_count = linked_record_count + Number(row.impact_link_count || 0);
      return {
        ...row,
        linked_record_count,
        support_link_count,
        support_breakdown: {
          policies: Number(row.policy_link_count || 0),
          promises: Number(row.promise_link_count || 0),
          actions: Number(row.action_link_count || 0),
          outcomes: Number(row.outcome_link_count || 0),
          impacts: Number(row.impact_link_count || 0),
        },
        confidence_label: confidenceFromSourceCount(linked_record_count, {
          government: row.source_type === "Government" ? 1 : 0,
          academic: row.source_type === "Academic" ? 1 : 0,
          archive: row.source_type === "Archive" ? 1 : 0,
        }),
        support_preview: [],
      };
    });
  }

  const placeholders = sourceIds.map(() => "?").join(", ");
  const [
    policySupports,
    promiseSupports,
    actionSupports,
    outcomeSupports,
    impactSupports,
  ] = await Promise.all([
    query(
      `
      SELECT
        s.id AS source_id,
        p.id AS policy_id,
        p.title,
        p.year_enacted
      FROM sources s
      JOIN policies p ON p.id = s.policy_id
      WHERE s.id IN (${placeholders})
      ORDER BY p.year_enacted DESC, p.id DESC
      `,
      sourceIds
    ),
    query(
      `
      SELECT
        ps.source_id,
        pr.id AS promise_id,
        pr.slug,
        pr.title,
        pr.status
      FROM promise_sources ps
      JOIN promises pr ON pr.id = ps.promise_id
      WHERE ps.source_id IN (${placeholders})
      ORDER BY pr.promise_date DESC, pr.id DESC
      `,
      sourceIds
    ),
    query(
      `
      SELECT
        pas.source_id,
        pa.id AS action_id,
        pa.title AS action_title,
        pa.action_date,
        pr.slug AS promise_slug,
        pr.title AS promise_title
      FROM promise_action_sources pas
      JOIN promise_actions pa ON pa.id = pas.promise_action_id
      JOIN promises pr ON pr.id = pa.promise_id
      WHERE pas.source_id IN (${placeholders})
      ORDER BY pa.action_date DESC, pa.id DESC
      `,
      sourceIds
    ),
    query(
      `
      SELECT
        pos.source_id,
        po.id AS outcome_id,
        po.policy_type,
        po.outcome_summary,
        po.impact_direction,
        p.id AS policy_id,
        p.title AS policy_title,
        p.year_enacted,
        pr.slug AS promise_slug,
        pr.title AS promise_title
      FROM policy_outcome_sources pos
      JOIN policy_outcomes po ON po.id = pos.policy_outcome_id
      LEFT JOIN policies p
        ON po.policy_type <> 'current_admin'
       AND p.id = po.policy_id
      LEFT JOIN promises pr
        ON po.policy_type = 'current_admin'
       AND pr.id = po.policy_id
      WHERE pos.source_id IN (${placeholders})
      ORDER BY po.id DESC
      `,
      sourceIds
    ),
    query(
      `
      SELECT
        edis.source_id,
        edi.id AS impact_id,
        edi.entity_type,
        edi.metric_name,
        edi.demographic_group,
        p.id AS policy_id,
        p.title AS policy_title,
        p.year_enacted,
        pr.slug AS promise_slug,
        pr.title AS promise_title
      FROM entity_demographic_impact_sources edis
      JOIN entity_demographic_impacts edi ON edi.id = edis.impact_id
      LEFT JOIN policies p
        ON edi.entity_type = 'policy'
       AND p.id = edi.entity_id
      LEFT JOIN promises pr
        ON edi.entity_type = 'promise'
       AND pr.id = edi.entity_id
      WHERE edis.source_id IN (${placeholders})
      ORDER BY edi.id DESC
      `,
      sourceIds
    ),
  ]);

  const supportPreviewMap = new Map();

  function addSupport(sourceId, item) {
    const numericId = Number(sourceId || 0);
    if (!numericId || !item?.kind || !item?.label) {
      return;
    }
    const existing = supportPreviewMap.get(numericId) || [];
    const dedupeKey = `${item.kind}:${item.href || item.label}`;
    if (existing.some((entry) => `${entry.kind}:${entry.href || entry.label}` === dedupeKey)) {
      return;
    }
    existing.push(item);
    supportPreviewMap.set(numericId, existing);
  }

  for (const row of policySupports) {
    addSupport(row.source_id, {
      kind: "Policy record",
      label: row.title,
      href: row.policy_id ? `/policies/${buildPolicySlug(row)}` : null,
      detail: row.year_enacted ? String(row.year_enacted) : null,
      context: "This source is attached directly to the policy record.",
    });
  }

  for (const row of promiseSupports) {
    addSupport(row.source_id, {
      kind: "Promise record",
      label: row.title,
      href: row.slug ? `/promises/${row.slug}` : null,
      detail: row.status || null,
      context: "This source is attached directly to the promise record.",
    });
  }

  for (const row of actionSupports) {
    addSupport(row.source_id, {
      kind: "Promise action",
      label: row.action_title || row.promise_title,
      href: row.promise_slug ? `/promises/${row.promise_slug}#timeline` : null,
      detail: row.promise_title || null,
      context: "This source helps verify a documented implementation step or action update.",
    });
  }

  for (const row of outcomeSupports) {
    addSupport(row.source_id, {
      kind: "Policy outcome",
      label:
        row.outcome_summary ||
        row.policy_title ||
        row.promise_title ||
        "Linked outcome",
      href: row.promise_slug
        ? `/promises/${row.promise_slug}#status`
        : row.policy_id
          ? `/policies/${buildPolicySlug({
              id: row.policy_id,
              title: row.policy_title,
              year_enacted: row.year_enacted,
            })}#summary`
          : null,
      detail:
        row.impact_direction ||
        row.policy_title ||
        row.promise_title ||
        null,
      context: "This source is linked to an outcome row used in public impact interpretation.",
    });
  }

  for (const row of impactSupports) {
    addSupport(row.source_id, {
      kind: "Black-impact row",
      label: row.metric_name || "Demographic-impact row",
      href: row.promise_slug
        ? `/promises/${row.promise_slug}#black-impact`
        : row.policy_id
          ? `/policies/${buildPolicySlug({
              id: row.policy_id,
              title: row.policy_title,
              year_enacted: row.year_enacted,
            })}#demographic-impact`
          : null,
      detail:
        row.policy_title ||
        row.promise_title ||
        row.demographic_group ||
        null,
      context: "This source supports a demographic-impact row in the public Black-impact layer.",
    });
  }

  return rows.map((row) => {
    const linked_record_count =
      Number(row.policy_link_count || 0) +
      Number(row.promise_link_count || 0) +
      Number(row.action_link_count || 0) +
      Number(row.outcome_link_count || 0);
    const support_link_count = linked_record_count + Number(row.impact_link_count || 0);
    return {
      ...row,
      linked_record_count,
      support_link_count,
      support_breakdown: {
        policies: Number(row.policy_link_count || 0),
        promises: Number(row.promise_link_count || 0),
        actions: Number(row.action_link_count || 0),
        outcomes: Number(row.outcome_link_count || 0),
        impacts: Number(row.impact_link_count || 0),
      },
      confidence_label: confidenceFromSourceCount(linked_record_count, {
        government: row.source_type === "Government" ? 1 : 0,
        academic: row.source_type === "Academic" ? 1 : 0,
        archive: row.source_type === "Archive" ? 1 : 0,
      }),
      support_preview: (supportPreviewMap.get(Number(row.id || 0)) || []).slice(0, 6),
    };
  });
}

export async function fetchUniversalSearchData(q = "") {
  const term = normalizeText(q);
  if (!term) {
    return {
      query: "",
      sections: [],
      suggested_explainers: [],
      total_results: 0,
    };
  }

  const likeValue = `%${term}%`;
  const reportDefinitions = getPublicReportDefinitions();
  const [{ presidents }, administrations, explainersIndex, sources] = await Promise.all([
    fetchPresidentsOverviewData({ q: term }),
    fetchAdministrationsOverviewData({ q: term }),
    fetchExplainersIndexData(),
    fetchSourcesLibraryData(term),
  ]);
  const [policies, promises] = await Promise.all([
    query(
      `
      SELECT
        p.id,
        p.title,
        p.summary,
        p.year_enacted,
        COUNT(DISTINCT s.id) AS source_count,
        MAX(CASE WHEN ps.policy_id IS NOT NULL THEN 1 ELSE 0 END) AS has_policy_score
      FROM policies p
      LEFT JOIN sources s ON s.policy_id = p.id
      LEFT JOIN policy_scores ps ON ps.policy_id = p.id
      WHERE p.is_archived = 0 AND (p.title LIKE ? OR p.summary LIKE ?)
      GROUP BY p.id, p.title, p.summary, p.year_enacted
      ORDER BY p.year_enacted DESC, p.id DESC
      LIMIT 8
      `,
      [likeValue, likeValue]
    ),
    query(
      `
      SELECT
        p.slug,
        p.title,
        p.summary,
        p.status,
        COUNT(DISTINCT ps.id) AS source_count
      FROM promises p
      LEFT JOIN promise_sources ps ON ps.promise_id = p.id
      WHERE p.title LIKE ? OR p.summary LIKE ?
      GROUP BY p.id, p.slug, p.title, p.summary, p.status, p.promise_date
      ORDER BY p.promise_date DESC, p.id DESC
      LIMIT 8
      `,
      [likeValue, likeValue]
    ).catch(() => []),
  ]);
  const suggestedExplainers = resolveSuggestedExplainers({
    explainers: explainersIndex.items || [],
    query: term,
    textFields: [term],
    limit: 3,
  });
  const suggestedExplainerSlugSet = new Set(
    (suggestedExplainers || []).map((item) => item.slug)
  );

  const sections = [
    {
      key: "policies",
      label: "Policies",
      description:
        "Open policy records when you need impact direction, linked sources, and historical or doctrinal continuity.",
      items: policies.map((item) => ({
        href: `/policies/${buildPolicySlug(item)}`,
        title: item.title,
        summary: item.summary,
        meta: item.year_enacted ? `Policy • ${item.year_enacted}` : "Policy",
        trustSignal: buildEvidenceSignal({
          sourceCount: item.source_count,
          hasPolicyScore: Boolean(item.has_policy_score),
        }),
      })),
    },
    {
      key: "presidents",
      label: "Presidents",
      description:
        "Open presidential profiles for score context, policy drivers, promise depth, and administration-level historical framing.",
      items: presidents.slice(0, 8).map((item) => ({
        href: `/presidents/${item.slug}`,
        title: item.name,
        summary: item.narrative_summary,
        meta: `${item.party || "Historical record"} • ${item.termLabel}`,
        trustSignal: buildEvidenceSignal({
          confidenceLabel: item.score_confidence,
        }),
      })),
    },
    {
      key: "promises",
      label: "Promises",
      description:
        "Open promise records when you want commitment, status, downstream trail, and evidence confidence in one place.",
      items: promises.map((item) => ({
        href: `/promises/${item.slug}`,
        title: item.title,
        summary: item.summary,
        meta: item.status ? `Promise • ${item.status}` : "Promise",
        trustSignal: buildEvidenceSignal({
          confidenceLabel: confidenceFromSourceCount(item.source_count || 0),
          sourceCount: item.source_count || 0,
        }),
      })),
    },
    {
      key: "administrations",
      label: "Administrations",
      description:
        "Open administration pages for term-level promise totals and a wider governing snapshot across one presidency period.",
      items: administrations.slice(0, 8).map((item) => ({
        href: `/administrations/${item.slug}`,
        title: item.administration_name,
        summary: `${item.total_tracked_promises || 0} tracked promises • ${item.outcome_count || 0} scored outcomes`,
        meta: item.termLabel,
      })),
    },
    {
      key: "reports",
      label: "Reports",
      description:
        "Open reports when the question is broader than one record and you need synthesis, comparison, or historical framing.",
      items: reportDefinitions
        .filter((item) =>
          [item.title, item.summary, item.category, item.theme]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(term.toLowerCase()))
        )
        .map((item) => ({
          href: item.href,
          title: item.title,
          summary: item.summary,
          meta: item.category,
        })),
    },
    {
      key: "explainers",
      label: "Explainers",
      description:
        "Open explainers when you need background, doctrine, or issue context before returning to individual records.",
      items: (explainersIndex.items || [])
        .filter((item) =>
          !suggestedExplainerSlugSet.has(item.slug) &&
          [item.title, item.summary, item.category]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(term.toLowerCase()))
        )
        .slice(0, 8)
        .map((item) => ({
          href: `/explainers/${item.slug}`,
          title: item.title,
          summary: item.summary,
          meta: item.category || "Explainer",
        })),
    },
    {
      key: "sources",
      label: "Sources",
      description:
        "Open the source library when you want to inspect publisher context, trust cues, and which records a source materially supports.",
      items: sources.slice(0, 8).map((item) => ({
        href: `/sources?q=${encodeURIComponent(item.source_title || item.publisher || "")}`,
        title: item.source_title,
        summary: item.publisher || item.notes,
        meta: `${item.source_type || "Source"} • ${item.linked_record_count || 0} linked records`,
        trustSignal: buildEvidenceSignal({
          labelOverride: item.trust_label || item.confidence_label || null,
        }),
      })),
    },
  ];

  return {
    query: term,
    sections,
    suggested_explainers: suggestedExplainers,
    total_results: sections.reduce(
      (total, section) => total + (section.items?.length || 0),
      0
    ),
  };
}

export async function fetchComparePresidentsData(identifiers = []) {
  const [{ scores, presidents }, promisePresidents] = await Promise.all([
    fetchPresidentsOverviewData({ sort: "score_desc" }),
    fetchPromisePresidentIndex({ showAll: true }),
  ]);
  const selectedIdentifiers = parseSelectionList(identifiers, 4);
  const promisesBySlug = new Map(
    promisePresidents.map((item) => [item.slug, item])
  );
  const comparison = buildPresidentComparison(scores.presidents, selectedIdentifiers);
  const selectedProfiles = await Promise.all(
    (comparison.compared_presidents || [])
      .map((item) => item.president_slug)
      .filter(Boolean)
      .map(async (slug) => [slug, await fetchPresidentProfileData(slug).catch(() => null)])
  );
  const profilesBySlug = new Map(selectedProfiles);
  const enrichedComparedPresidents = (comparison.compared_presidents || []).map((item) => {
    const promiseMeta = promisesBySlug.get(item.president_slug) || {};
    const profile = profilesBySlug.get(item.president_slug) || null;
    const scoreComposition = profile?.scoreComposition || null;
    const scoreDrivers = profile?.scoreDrivers || null;
    const promiseTracker = profile?.promiseTracker || null;
    return {
      ...item,
      delivered_count: promiseMeta.delivered_count ?? 0,
      in_progress_count: promiseMeta.in_progress_count ?? 0,
      blocked_count: promiseMeta.blocked_count ?? 0,
      failed_count: promiseMeta.failed_count ?? 0,
      partial_count: promiseMeta.partial_count ?? 0,
      termLabel: formatTermLabel(promiseMeta.term_start, promiseMeta.term_end),
      score_summary_line: scoreComposition?.summary_line || null,
      score_interpretation: scoreComposition?.interpretation || null,
      score_scope_note: scoreDrivers?.score_scope_note || null,
      top_driver_topics: (scoreDrivers?.topic_drivers || [])
        .slice(0, 3)
        .map((topic) => topic.topic)
        .filter(Boolean),
      direct_direction_counts:
        scoreComposition?.direct?.direction_counts || item.directional_breakdown || {},
      direct_outcome_count:
        scoreComposition?.direct?.outcome_count ?? item.direct_outcome_count ?? item.outcome_count ?? 0,
      visible_source_count: promiseTracker?.visible_source_count ?? 0,
      visible_promise_count:
        promiseTracker?.visible_promise_count ?? promiseTracker?.total_tracked_promises ?? 0,
      promise_records: profile?.promises || [],
    };
  });

  return {
    ...comparison,
    compared_presidents: enrichedComparedPresidents,
    selected_identifiers: selectedIdentifiers,
    options: presidents.map((item) => ({
      value: item.slug,
      label: `${item.name} (${item.termLabel})`,
    })),
    available_presidents: presidents.map((item) => ({
      ...item,
      delivered_count: promisesBySlug.get(item.slug)?.delivered_count ?? 0,
      in_progress_count: promisesBySlug.get(item.slug)?.in_progress_count ?? 0,
      blocked_count: promisesBySlug.get(item.slug)?.blocked_count ?? 0,
    })),
  };
}

export async function fetchComparePoliciesData(ids = []) {
  const selectedIds = parseSelectionList(ids, 4)
    .map((item) => Number(item))
    .filter(Number.isFinite);
  const options = await query(
    `
    SELECT
      p.id,
      p.title,
      p.year_enacted
    FROM policies p
    WHERE p.is_archived = 0
    ORDER BY p.year_enacted DESC, p.title ASC
    LIMIT 160
    `
  );

  if (!selectedIds.length) {
    return {
      selected_ids: [],
      options: options.map((item) => ({
        value: String(item.id),
        label: `${item.title}${item.year_enacted ? ` (${item.year_enacted})` : ""}`,
      })),
      items: [],
    };
  }

  const placeholders = selectedIds.map(() => "?").join(", ");
  const [rows, impactRows] = await Promise.all([
    query(
      `
      SELECT
        p.id,
        p.title,
        p.summary,
        p.year_enacted,
        p.date_enacted,
        p.impact_direction,
        p.policy_type,
        pr.full_name AS president,
        e.name AS era,
        GROUP_CONCAT(DISTINCT pc.name ORDER BY pc.name SEPARATOR ', ') AS categories,
        COUNT(DISTINCT s.id) AS source_count,
        COUNT(DISTINCT CASE WHEN s.source_type = 'Government' THEN s.id END) AS government_sources,
        COUNT(DISTINCT CASE WHEN s.source_type = 'Academic' THEN s.id END) AS academic_sources,
        COUNT(DISTINCT CASE WHEN s.source_type = 'Archive' THEN s.id END) AS archive_sources,
        ps.directness_score,
        ps.material_impact_score,
        ps.evidence_score,
        ps.durability_score,
        ps.equity_score,
        ps.harm_offset_score,
        ${POLICY_IMPACT_SCORE_SQL} AS impact_score
      FROM policies p
      LEFT JOIN policy_scores ps ON ps.policy_id = p.id
      LEFT JOIN presidents pr ON pr.id = p.president_id
      LEFT JOIN eras e ON e.id = p.era_id
      LEFT JOIN policy_policy_categories ppc ON ppc.policy_id = p.id
      LEFT JOIN policy_categories pc ON pc.id = ppc.category_id
      LEFT JOIN sources s ON s.policy_id = p.id
      WHERE p.id IN (${placeholders})
      GROUP BY
        p.id,
        p.title,
        p.summary,
        p.year_enacted,
        p.date_enacted,
        p.impact_direction,
        p.policy_type,
        pr.full_name,
        e.name,
        ps.directness_score,
        ps.material_impact_score,
        ps.evidence_score,
        ps.durability_score,
        ps.equity_score,
        ps.harm_offset_score
      ORDER BY p.year_enacted DESC, p.title ASC
      `,
      selectedIds
    ),
    query(
      `
      SELECT
        edi.id,
        edi.entity_id,
        edi.metric_name,
        edi.demographic_group,
        edi.before_value,
        edi.after_value,
        edi.comparison_value,
        edi.unit,
        edi.confidence_score
      FROM entity_demographic_impacts edi
      WHERE edi.entity_type = 'policy' AND edi.entity_id IN (${placeholders})
      ORDER BY edi.entity_id ASC, edi.id ASC
      `,
      selectedIds
    ),
  ]);

  const impactsByPolicyId = impactRows.reduce((map, row) => {
    if (!map.has(row.entity_id)) {
      map.set(row.entity_id, []);
    }
    map.get(row.entity_id).push(row);
    return map;
  }, new Map());

  const rowMap = new Map(
    rows.map((row) => [
      row.id,
      {
        ...row,
        slug: buildPolicySlug(row),
        demographic_funding_count: (impactsByPolicyId.get(row.id) || []).filter((impact) =>
          isFundingImpactMetric(impact.metric_name)
        ).length,
        demographic_supporting_count: (impactsByPolicyId.get(row.id) || []).filter(
          (impact) => !isFundingImpactMetric(impact.metric_name)
        ).length,
        black_impact_score_display: hasCompletePolicyScore(row)
          ? formatPolicyScoreOutOfFive(row.impact_score)
          : null,
        has_black_impact_score: hasCompletePolicyScore(row),
        confidence_label: confidenceFromSourceCount(row.source_count, {
          government: row.government_sources,
          academic: row.academic_sources,
          archive: row.archive_sources,
        }),
        demographic_impact_count: impactsByPolicyId.get(row.id)?.length || 0,
        has_demographic_impacts: Boolean(impactsByPolicyId.get(row.id)?.length),
        demographic_highlights: summarizeDemographicImpactHighlights(
          impactsByPolicyId.get(row.id) || []
        ),
      },
    ])
  );

  return {
    selected_ids: selectedIds.map(String),
    options: options.map((item) => ({
      value: String(item.id),
      label: `${item.title}${item.year_enacted ? ` (${item.year_enacted})` : ""}`,
    })),
    items: selectedIds.map((id) => rowMap.get(id)).filter(Boolean),
  };
}
