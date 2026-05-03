export const GOVERNING_ACTION_TYPES = [
  "executive_order",
  "agency_action",
  "legislation",
  "regulatory_action",
  "budget_action",
  "staffing_action",
  "enforcement_action",
  "judicial_action",
];

export const GOVERNING_ACTION_STATUSES = [
  "proposed",
  "active",
  "implemented",
  "blocked",
  "partially_blocked",
  "rescinded",
  "superseded",
  "abandoned",
  "unknown",
];

export const SOURCE_QUALITY_VALUES = [
  "primary_official",
  "secondary_verified",
  "context_only",
];

export const EVIDENCE_ROLE_VALUES = [
  "promise_attribution",
  "action_authority",
  "implementation",
  "outcome",
  "judicial_effect",
  "context",
];

export const VISIBILITY_STATES = [
  "internal_only",
  "admin_review",
  "public_unscored",
  "public_scored",
];

export const SCORE_ELIGIBILITY_STATES = [
  "not_scoreable",
  "hold_for_evidence",
  "eligible",
  "scored",
];

export const CHAIN_RELATIONSHIP_TYPES = [
  "implements",
  "blocks",
  "partially_blocks",
  "restores",
  "supersedes",
  "modifies",
];

export const DATA_CONFIDENCE_VALUES = ["high", "inferred", "low"];

export const CANONICAL_CATEGORY_NAME_BY_SLUG = {
  labor: "Labor",
  housing: "Housing",
  healthcare: "Healthcare",
  education: "Education",
  criminal_justice: "Criminal Justice",
  civil_rights: "Civil Rights",
  economic_policy: "Business and Economics",
  immigration: "Immigration",
  voting_rights: "Voting Rights",
  data_privacy: "Constitutional Rights",
  public_benefits: "Social Welfare",
};

export const SOURCE_QUALITY_RANK = {
  context_only: 1,
  secondary_verified: 2,
  primary_official: 3,
};

export const CURRENT_ADMIN_METHOD_STATEMENT =
  "EquityStack does not score slogans or assumptions. A promise becomes meaningful only when it connects to a governing action. A governing action becomes scoreable only when implementation and measurable population-impact evidence exist.";

export const CURRENT_ADMIN_PUBLIC_SCORE_WAITING_MESSAGE =
  "We only score when measurable outcomes for Black communities are verified.";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function humanizeToken(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function toSafeCount(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}

function normalizeLowerString(value) {
  return normalizeString(value).toLowerCase();
}

export function normalizeSourceQuality(value) {
  const normalized = normalizeString(value).toLowerCase().replace(/[-\s]+/g, "_");
  if (SOURCE_QUALITY_VALUES.includes(normalized)) {
    return normalized;
  }
  if (["government", "official", "primary"].includes(normalized)) {
    return "primary_official";
  }
  if (["verified", "secondary", "news", "academic", "archive"].includes(normalized)) {
    return "secondary_verified";
  }
  return "context_only";
}

export function normalizeEvidenceRole(value, fallback = "context") {
  const normalized = normalizeString(value).toLowerCase().replace(/[-\s]+/g, "_");
  if (EVIDENCE_ROLE_VALUES.includes(normalized)) {
    return normalized;
  }
  if (["authority", "official_action"].includes(normalized)) {
    return "action_authority";
  }
  if (["implementation_evidence", "implementation_signal"].includes(normalized)) {
    return "implementation";
  }
  if (["impact", "outcome_evidence"].includes(normalized)) {
    return "outcome";
  }
  if (["judicial", "court_effect"].includes(normalized)) {
    return "judicial_effect";
  }
  if (["promise", "promise_source"].includes(normalized)) {
    return "promise_attribution";
  }
  return fallback;
}

export function inferSourceQuality(source = {}) {
  const explicit = normalizeString(source.source_quality);
  if (explicit) {
    return normalizeSourceQuality(explicit);
  }

  const haystack = [
    source.source_type,
    source.publisher,
    source.source_title,
    source.source_url,
    source.notes,
  ]
    .map((value) => normalizeString(value).toLowerCase())
    .join(" ");

  if (
    [
      ".gov",
      "white house",
      "federal register",
      "supreme court",
      "district court",
      "court of appeals",
      "government",
      "department of",
      "agency",
      "official",
    ].some((token) => haystack.includes(token))
  ) {
    return "primary_official";
  }

  if (
    [
      "news",
      "reuters",
      "associated press",
      "academic",
      "journal",
      "research",
      "archive",
      "nonprofit",
    ].some((token) => haystack.includes(token))
  ) {
    return "secondary_verified";
  }

  return "context_only";
}

export function deriveBestSourceQuality(sources = []) {
  let best = "context_only";
  for (const source of Array.isArray(sources) ? sources : []) {
    const quality = inferSourceQuality(source);
    if ((SOURCE_QUALITY_RANK[quality] || 0) > (SOURCE_QUALITY_RANK[best] || 0)) {
      best = quality;
    }
  }
  return best;
}

export function normalizeVisibilityState(value, fallback = null) {
  const normalized = normalizeString(value).toLowerCase();
  return VISIBILITY_STATES.includes(normalized) ? normalized : fallback;
}

export function normalizeScoreEligibility(value, fallback = null) {
  const normalized = normalizeString(value).toLowerCase();
  return SCORE_ELIGIBILITY_STATES.includes(normalized) ? normalized : fallback;
}

export function formatScoreEligibilityLabel(value) {
  const normalized = normalizeScoreEligibility(value, null);
  if (normalized === "eligible") {
    return "Eligible for scoring";
  }
  if (normalized === "hold_for_evidence") {
    return "Hold for evidence";
  }
  if (normalized === "not_scoreable") {
    return "Not scoreable";
  }
  if (normalized === "scored") {
    return "Scored";
  }
  return humanizeToken(value);
}

export function formatVisibilityStateLabel(value) {
  const normalized = normalizeVisibilityState(value, null);
  if (normalized === "public_unscored") {
    return "Public and unscored";
  }
  if (normalized === "public_scored") {
    return "Public and scored";
  }
  if (normalized === "admin_review") {
    return "Admin review only";
  }
  if (normalized === "internal_only") {
    return "Internal only";
  }
  return humanizeToken(value);
}

export function formatSourceQualityLabel(value) {
  const normalized = normalizeSourceQuality(value);
  if (normalized === "primary_official") {
    return "Primary official";
  }
  if (normalized === "secondary_verified") {
    return "Secondary verified";
  }
  return "Context only";
}

export function formatEvidenceRoleLabel(value) {
  const normalized = normalizeEvidenceRole(value, "context");
  if (normalized === "promise_attribution") {
    return "Promise attribution";
  }
  if (normalized === "action_authority") {
    return "Action authority";
  }
  if (normalized === "implementation") {
    return "Implementation";
  }
  if (normalized === "outcome") {
    return "Outcome";
  }
  if (normalized === "judicial_effect") {
    return "Judicial effect";
  }
  return "Context";
}

export function describeScoreEligibility(value) {
  const normalized = normalizeScoreEligibility(value, null);
  if (normalized === "eligible") {
    return "The governing action has a primary official action source plus implementation, outcome, or judicial-effect evidence. It is ready for a scoring review, but it is not scored yet.";
  }
  if (normalized === "hold_for_evidence") {
    return "The action can stay public, but EquityStack is still missing enough downstream implementation or population-impact evidence to move it into scoring review.";
  }
  if (normalized === "scored") {
    return "The governing action has already cleared scoring review and contributes to the scored outcome layer.";
  }
  if (normalized === "not_scoreable") {
    return "The record is public accountability context, but it does not yet have the implementation and population-impact evidence needed for scoring.";
  }
  return "This score state has not been classified yet.";
}

export function describeVisibilityState(value) {
  const normalized = normalizeVisibilityState(value, null);
  if (normalized === "public_unscored") {
    return "The record is visible to the public but does not yet contribute a scored governing-action outcome.";
  }
  if (normalized === "public_scored") {
    return "The record is public and already connected to scored governing-action outcome analysis.";
  }
  if (normalized === "admin_review") {
    return "The record stays in the operator workflow until evidence or classification questions are resolved.";
  }
  if (normalized === "internal_only") {
    return "The record is logged internally only, usually because it is a slogan, reject, or still too thin to publish.";
  }
  return "This visibility state has not been classified yet.";
}

export function formatCurrentAdminReviewMonth(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function describeNextCheckContext(trigger) {
  const normalized = normalizeLowerString(trigger);
  if (!normalized) {
    return null;
  }

  if (
    normalized.includes("full fy") ||
    normalized.includes("full-year") ||
    normalized.includes("dashboard coverage reaches at least") ||
    normalized.includes("2026-09-30")
  ) {
    return "full FY data";
  }

  if (
    normalized.includes("continuation or non-continuation notices") ||
    normalized.includes("continuation notices") ||
    normalized.includes("non-continuation notices")
  ) {
    return "funding notices";
  }

  if (
    normalized.includes("follow-on guidance") ||
    normalized.includes("memo") ||
    normalized.includes("guidance")
  ) {
    return "agency guidance";
  }

  if (normalized.includes("publishes")) {
    return "official data refresh";
  }

  return null;
}

export function buildCurrentAdminNextCheckHint(action = {}) {
  const reviewMonth = formatCurrentAdminReviewMonth(action?.next_review_date);
  if (!reviewMonth) {
    return null;
  }

  const context = describeNextCheckContext(action?.data_refresh_trigger);
  return `Next data check: ${reviewMonth}${context ? ` (${context})` : ""}`;
}

export function summarizeEvidenceRoles(sources = []) {
  const labels = [...new Set(
    (Array.isArray(sources) ? sources : [])
      .map((source) => formatEvidenceRoleLabel(source?.evidence_role))
      .filter(Boolean)
  )];
  return labels;
}

export function buildCurrentAdminPublicGuidanceItems() {
  return [
    {
      label: "Tracked but not scored",
      tone: "warning",
      title: "Promises stay public as intent records",
      description:
        "Promise pages can remain public once EquityStack has attributable sourcing, even when there is no governing action yet. Promise language by itself does not enter the scoring pipeline.",
    },
    {
      label: "Hold for evidence",
      tone: "warning",
      title: "Public action does not always mean scoreable action",
      description:
        "A governing action can be visible before it is scoreable. EquityStack waits for downstream implementation, outcome, or judicial-effect evidence before moving from hold for evidence to eligible.",
    },
    {
      label: "Eligible for scoring",
      tone: "info",
      title: "Eligible means ready for scoring review, not already scored",
      description:
        "Eligible actions have a primary official action source plus downstream implementation or effect evidence. They still require a separate scoring review before they count as scored.",
    },
    {
      label: "Primary official",
      tone: "success",
      title: "Source quality stays visible",
      description:
        "Primary official sources outrank secondary verified sources, and context-only sources cannot make a record public or scoreable by themselves.",
    },
  ];
}

export function buildCurrentAdminScoreMethodologyItems() {
  return [
    {
      label: "Promise layer",
      tone: "default",
      title: "Promises are intent, not scored outcomes",
      description:
        "Promise Tracker records preserve the statement and the accountability trail. They become meaningful for scoring only when they connect to real governing action and documented effects.",
    },
    {
      label: "Action layer",
      tone: "info",
      title: "Governing actions are the policy mechanism",
      description:
        "Executive orders, agency actions, rules, judicial blocks, staffing moves, and funding changes are modeled as separate governing actions so the score can follow real implementation steps instead of slogans.",
    },
    {
      label: "Score gate",
      tone: "warning",
      title: "Evidence standards intentionally delay some scores",
      description:
        "Withheld scores do not mean a page is broken. They usually mean EquityStack can document the mechanism but not yet the measurable population-impact needed for a defensible score.",
    },
  ];
}

export function normalizeChainRelationshipType(value, fallback = null) {
  const normalized = normalizeString(value).toLowerCase().replace(/[-\s]+/g, "_");
  return CHAIN_RELATIONSHIP_TYPES.includes(normalized) ? normalized : fallback;
}

export function deriveCurrentAdminPromiseVisibilityState(row = {}) {
  const publicGoverningActionCount = toSafeCount(row.public_governing_action_count);
  const publicScoredGoverningActionCount = toSafeCount(
    row.public_scored_governing_action_count
  );
  const outcomeCount = toSafeCount(row.outcome_count);
  const promisePublicSourceCount = toSafeCount(row.promise_public_source_count);

  if (publicScoredGoverningActionCount > 0 || outcomeCount > 0) {
    return "public_scored";
  }
  if (publicGoverningActionCount > 0 || promisePublicSourceCount > 0) {
    return "public_unscored";
  }
  return "internal_only";
}

export function isPublicCurrentAdminVisibilityState(value) {
  const normalized = normalizeVisibilityState(value, null);
  return normalized === "public_unscored" || normalized === "public_scored";
}

export function countPublicScoreableGoverningActions(actions = []) {
  return (Array.isArray(actions) ? actions : []).filter((action) => {
    const normalized = normalizeScoreEligibility(action?.score_eligibility, null);
    return normalized === "eligible" || normalized === "scored";
  }).length;
}

export function isCurrentAdminPromiseTrackedButNotScored(row = {}) {
  return (
    deriveCurrentAdminPromiseVisibilityState(row) === "public_unscored" &&
    toSafeCount(row.public_governing_action_count) === 0 &&
    toSafeCount(row.outcome_count) === 0 &&
    toSafeCount(row.promise_public_source_count) > 0
  );
}

export function categorySlugLabel(slug) {
  return CANONICAL_CATEGORY_NAME_BY_SLUG[slug] || null;
}

function getActionSources(action = {}) {
  if (Array.isArray(action.sources) && action.sources.length) {
    return action.sources;
  }
  if (Array.isArray(action.action_sources) && action.action_sources.length) {
    return action.action_sources;
  }
  return [];
}

function hasPrimaryOfficialAuthoritySource(action = {}) {
  return getActionSources(action).some((source) => {
    const quality = normalizeSourceQuality(source?.source_quality || inferSourceQuality(source));
    const role = normalizeEvidenceRole(source?.evidence_role, "context");
    return quality === "primary_official" && role === "action_authority";
  });
}

function hasImplementationOutcomeOrJudicialEvidence(action = {}) {
  return getActionSources(action).some((source) =>
    ["implementation", "outcome", "judicial_effect"].includes(
      normalizeEvidenceRole(source?.evidence_role, "context")
    )
  );
}

export function deriveLinkedGoverningActionScoreState(actions = []) {
  const normalizedActions = Array.isArray(actions) ? actions : [];

  if (!normalizedActions.length) {
    return "no_public_governing_action";
  }

  if (
    normalizedActions.some((action) => {
      const scoreEligibility = normalizeScoreEligibility(action?.score_eligibility, null);
      const visibilityState = normalizeVisibilityState(action?.visibility_state, null);
      return scoreEligibility === "scored" || visibilityState === "public_scored";
    })
  ) {
    return "scored";
  }

  if (
    normalizedActions.some(
      (action) => normalizeScoreEligibility(action?.score_eligibility, null) === "eligible"
    )
  ) {
    return "eligible";
  }

  if (
    normalizedActions.some(
      (action) =>
        normalizeScoreEligibility(action?.score_eligibility, null) === "hold_for_evidence"
    )
  ) {
    return "hold_for_evidence";
  }

  if (
    normalizedActions.some(
      (action) => normalizeScoreEligibility(action?.score_eligibility, null) === "not_scoreable"
    )
  ) {
    return "not_scoreable";
  }

  return "unknown";
}

export function buildCurrentAdminRolloutParity({
  promise = {},
  governingActions = [],
  legacyActionCount = 0,
  legacyOutcomeCount = 0,
  legacyScoreSummary = null,
} = {}) {
  const actions = Array.isArray(governingActions) ? governingActions : [];
  const linkedScoreState = deriveLinkedGoverningActionScoreState(actions);
  const legacyOutcomeTotal = toSafeCount(legacyOutcomeCount);
  const legacyScoreValue = Number(legacyScoreSummary?.total_score);
  const legacyHasScoring = legacyOutcomeTotal > 0 || Number.isFinite(legacyScoreValue);
  const publicActionCount = actions.length;
  const scoreableActionCount = countPublicScoreableGoverningActions(actions);
  const scoredActionCount = actions.filter((action) => {
    const scoreEligibility = normalizeScoreEligibility(action?.score_eligibility, null);
    const visibilityState = normalizeVisibilityState(action?.visibility_state, null);
    return scoreEligibility === "scored" || visibilityState === "public_scored";
  }).length;
  const anyPrimaryAuthoritySource = actions.some(hasPrimaryOfficialAuthoritySource);
  const anyDownstreamEvidence = actions.some(hasImplementationOutcomeOrJudicialEvidence);

  let gapReason = null;
  let gapReasonCode = null;
  let recommendedNextAction = "no_rollout_action_needed";

  if (!publicActionCount) {
    if (Number(legacyActionCount || 0) > 0) {
      gapReason =
        "Legacy promise actions exist, but the exact governing mechanism is still not normalized into a governing action.";
      gapReasonCode = "mechanism_unresolved";
      recommendedNextAction = "review_governing_mechanism";
    } else {
      gapReason = "No linked governing action exists yet for this promise.";
      gapReasonCode = "missing_governing_action";
      recommendedNextAction = "link_or_create_governing_action";
    }
  } else if (!anyPrimaryAuthoritySource) {
    gapReason =
      "Linked governing actions are missing a primary official action-authority source.";
    gapReasonCode = "missing_primary_official_authority";
    recommendedNextAction = "collect_primary_official_action_source";
  } else if (!anyDownstreamEvidence) {
    gapReason =
      "Linked governing actions still lack implementation, outcome, or judicial-effect evidence needed to match the legacy score path.";
    gapReasonCode = "missing_downstream_evidence";
    recommendedNextAction = "collect_downstream_evidence";
  } else if (linkedScoreState === "hold_for_evidence") {
    gapReason =
      "Linked governing actions are still held for evidence even though a governing mechanism is public.";
    gapReasonCode = "hold_for_evidence";
    recommendedNextAction = "review_score_gate_inputs";
  } else if (linkedScoreState === "eligible") {
    gapReason =
      "Linked governing actions are evidence-complete enough to score, but the legacy promise-level score has not been reconciled yet.";
    gapReasonCode = "eligible_not_reconciled";
    recommendedNextAction = "map_governing_action_scoring";
  }

  const hasMismatch = legacyHasScoring && linkedScoreState !== "scored";

  return {
    promise_slug: promise?.slug || null,
    promise_title: promise?.title || null,
    has_mismatch: hasMismatch,
    legacy_promise_level_score: {
      state: legacyHasScoring ? "scored" : "unscored",
      total_score: Number.isFinite(legacyScoreValue)
        ? Number(legacyScoreValue.toFixed(4))
        : null,
      direction: normalizeString(legacyScoreSummary?.direction) || null,
      outcome_count: legacyOutcomeTotal,
    },
    linked_governing_action_score_state: {
      state: linkedScoreState,
      public_action_count: publicActionCount,
      scoreable_action_count: scoreableActionCount,
      scored_action_count: scoredActionCount,
      visibility_states: [...new Set(
        actions
          .map((action) => normalizeVisibilityState(action?.visibility_state, null))
          .filter(Boolean)
      )],
    },
    source_evidence_gap_reason: gapReason,
    gap_reason_code: gapReasonCode,
    recommended_next_action: recommendedNextAction,
  };
}
