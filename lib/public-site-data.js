import { query } from "@/lib/db";
import { fetchInternalJson } from "@/lib/api";
import { computeOutcomeBasedScores } from "@/lib/services/blackImpactScoreService";
import {
  fetchCurrentAdministrationOverview,
  fetchPromiseDetail,
  fetchPromiseList,
  fetchPromisePresidentDetail,
  fetchPromisePresidentIndex,
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
import { summarizeImpactTrend } from "@/lib/black-impact-score/impactTrend";
import { buildPresidentComparison } from "@/lib/black-impact-score/presidentComparison";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
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
];

function getPublicReportDefinitions() {
  return PUBLIC_REPORT_DEFINITIONS.slice();
}

function formatPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "—";
  }
  return `${Math.round(numeric * 100)}%`;
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

function normalizeDirectionBreakdown(item = {}) {
  const counts = item.counts_by_direction || item.breakdowns?.by_direction || {};

  return {
    Positive: Number(counts.Positive || 0),
    Negative: Number(counts.Negative || 0),
    Mixed: Number(counts.Mixed || 0),
    Blocked: Number(counts.Blocked || 0),
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

function buildPresidentRecord(item = {}, promiseMeta = {}) {
  return {
    slug: item.president_slug,
    name: item.president,
    party: item.president_party || promiseMeta.president_party || "Historical record",
    termLabel: formatTermLabel(promiseMeta.term_start, promiseMeta.term_end),
    score: item.direct_normalized_score,
    systemic_score: item.systemic_normalized_score,
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
    tone: getDirectionTone(item.direct_raw_score),
  };
}

export async function fetchHomePageData() {
  const [scores, readiness, policies, promises, presidents, overallSummary] = await Promise.all([
    computeOutcomeBasedScores(),
    fetchHomepageReadinessSummary(),
    fetchInternalJson("/api/policies?sort=impact_score_desc&page_size=8", {
      errorMessage: "Failed to fetch homepage policies",
    }),
    fetchPromiseList({ pageSize: 6, sort: "promise_date_desc", showAll: true }),
    fetchPromisePresidentIndex({ showAll: true }),
    getOverallSummary(),
  ]);

  return {
    scores,
    readiness,
    overallSummary,
    featuredPolicies: policies.items || [],
    recentPromises: promises.items || [],
    presidents,
  };
}

export async function fetchDashboardData(searchParams = {}) {
  const [scores, readiness, topPoliciesResponse, recentPromises, currentAdministration, categorySummary, presidentContext] =
    await Promise.all([
      computeOutcomeBasedScores(),
      fetchHomepageReadinessSummary(),
      fetchInternalJson("/api/reports/top-policies", {
        errorMessage: "Failed to fetch top policies",
      }),
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

  const policyRows = Array.isArray(topPoliciesResponse) ? topPoliciesResponse : [];
  const topPositivePolicies = policyRows.filter((row) => Number(row.impact_score || 0) > 0).slice(0, 6);
  const topNegativePolicies = policyRows.filter((row) => Number(row.impact_score || 0) < 0).slice(0, 6);
  const topMixedPolicies = policyRows
    .filter((row) => String(row.impact_direction || "").toLowerCase() === "mixed")
    .slice(0, 6);

  return {
    scores,
    readiness,
    topPositivePolicies,
    topNegativePolicies,
    topMixedPolicies,
    latestPolicyUpdates: policyRows.slice(0, 10),
    promiseSnapshot: recentPromises,
    currentAdministration,
    categorySummary,
    presidentRanking: presidentContext.presidents
      .slice()
      .sort(
        (left, right) =>
          Number(right.direct_normalized_score || 0) -
          Number(left.direct_normalized_score || 0)
      )
      .slice(0, 6),
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
      ...buildPresidentRecord(item, promiseMeta),
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
    return Number(right.direct_normalized_score || 0) - Number(left.direct_normalized_score || 0);
  });

  return {
    ...context,
    presidents,
  };
}

export async function fetchPresidentProfileData(slug) {
  const [{ scores }, presidentPromiseDetail] = await Promise.all([
    fetchPresidentsScoreContext(),
    fetchPromisePresidentDetail(slug, { showAll: true }),
  ]);
  const president = scores.presidents.find((item) => item.president_slug === slug);

  if (!president || !presidentPromiseDetail) {
    return null;
  }

  const promiseRecords = scores.records.filter((row) => row.president_slug === slug);
  const trend = summarizeImpactTrend(
    promiseRecords.flatMap((row) => row.scored_outcomes || [])
  );
  const statusSections = presidentPromiseDetail.status_sections || {};
  const promises = Object.values(statusSections).flat();
  const topPolicies = [
    ...(president.top_positive_promises || []),
    ...(president.top_negative_promises || []),
  ].slice(0, 10);
  const scoreDrivers = {
    strongest_positive: (president.top_positive_promises || []).slice(0, 3),
    strongest_negative: (president.top_negative_promises || []).slice(0, 3),
    topic_drivers: normalizeTopicBreakdown(president).slice(0, 4),
    direction_breakdown: normalizeDirectionBreakdown(president),
    score_scope_note:
      "This score reflects available policy records in the current EquityStack dataset, not every action in a presidency.",
  };
  const promiseStatusSnapshot = {
    Delivered: statusSections.Delivered?.length || 0,
    "In Progress": statusSections["In Progress"]?.length || 0,
    Partial: statusSections.Partial?.length || 0,
    Failed: statusSections.Failed?.length || 0,
    Blocked: statusSections.Blocked?.length || 0,
  };

  return {
    president,
    promiseTracker: presidentPromiseDetail,
    promises,
    trend,
    topPolicies,
    scoreDrivers,
    promiseStatusSnapshot,
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

  return {
    ...result,
    items: (result.items || []).map((item) => ({
      ...item,
      slug: buildPolicySlug(item),
    })),
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

  const policy = await fetchInternalJson(`/api/policies/${id}`, {
    allow404: true,
    errorMessage: "Failed to fetch policy detail",
  });

  if (!policy) {
    return null;
  }

  return {
    ...policy,
    slug: buildPolicySlug(policy),
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

  const statusCounts = (data.items || []).reduce((totals, item) => {
    totals[item.status] = (totals[item.status] || 0) + 1;
    return totals;
  }, {});

  return {
    ...data,
    statusCounts,
    latestStatusChanges: (data.items || [])
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
    const categoryMatch = !categoryFilter || item.category === categoryFilter;
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
    reportCategories: [...new Set(reports.map((item) => item.category))],
    reportKpis: {
      report_count: reports.length,
      featured_count: reports.filter((item) => item.featured).length,
      presidents_scored: scores.presidents?.length || 0,
      categories_covered: categorySummary.length,
      strongest_category: strongestCategory?.name || null,
    },
  };
}

export async function fetchReportDetailData(slug) {
  const [hub, dashboard] = await Promise.all([
    fetchReportsHubData(),
    fetchDashboardData(),
  ]);
  const reportDefinition = hub.reports.find((item) => item.slug === slug);

  if (!reportDefinition) {
    return null;
  }

  if (slug === "black-impact-score") {
    return {
      slug,
      title: "Black Impact Score",
      href: reportDefinition.href,
      category: reportDefinition.category,
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
      findings: [
        `Scored outcomes included: ${hub.scores.metadata?.outcomes_included_in_score ?? 0}`,
        `High-confidence outcome share: ${Math.round((hub.scores.metadata?.trust?.high_confidence_outcome_percentage || 0) * 100)}%`,
      ],
      relatedReports: hub.reports.filter(
        (item) => item.slug !== slug && item.slug !== "civil-rights-timeline"
      ),
      relatedLinks: [
        { href: "/methodology", label: "Read methodology" },
        { href: "/dashboard", label: "Open public dashboard" },
      ],
    };
  }

  if (slug === "historical-distribution") {
    return {
      slug,
      title: "Historical Distribution",
      href: reportDefinition.href,
      category: reportDefinition.category,
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
      findings: [],
      relatedReports: hub.reports.filter((item) => item.slug !== slug),
      relatedLinks: [
        { href: "/timeline", label: "Browse the public timeline" },
        { href: "/policies", label: "Open policy explorer" },
      ],
    };
  }

  return {
    slug,
    title: "Executive Overview",
    href: reportDefinition.href,
    category: reportDefinition.category,
    summary: "A high-level report view of the current EquityStack dataset.",
    metrics: [
      {
        label: "Unified outcomes",
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
            value: dashboard.topPositivePolicies?.length || 0,
            color: "#84f7c6",
          },
          {
            name: "Mixed",
            value: dashboard.topMixedPolicies?.length || 0,
            color: "#fbbf24",
          },
          {
            name: "Negative",
            value: dashboard.topNegativePolicies?.length || 0,
            color: "#ff8a8a",
          },
        ],
      },
    ],
    findings: [
      dashboard.currentAdministration?.summary || null,
      hub.scores.metadata?.summary_interpretation || null,
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
  };
}

export async function fetchExplainersIndexData() {
  const explainers = await fetchInternalJson("/api/explainers", {
    errorMessage: "Failed to fetch explainers",
  });

  return {
    items: explainers || [],
    categories: [...new Set((explainers || []).map((item) => item.category).filter(Boolean))],
  };
}

export async function fetchExplainerDetailData(slug) {
  const [explainer, index] = await Promise.all([
    fetchInternalJson(`/api/explainers/${slug}`, {
      allow404: true,
      errorMessage: "Failed to fetch explainer",
    }),
    fetchExplainersIndexData(),
  ]);

  if (!explainer) {
    return null;
  }

  const structuredSections = [
    { title: "Common claim", body: explainer.common_claim },
    { title: "What actually happened", body: explainer.what_actually_happened },
    { title: "Why it matters", body: explainer.why_it_matters },
    { title: "Key policies", body: explainer.key_policies_text },
    { title: "Why it still matters", body: explainer.why_it_still_matters },
    { title: "Sources note", body: explainer.sources_note },
  ].filter((item) => normalizeText(item.body));

  return {
    ...explainer,
    structured_sections: structuredSections,
    related_explainers: (index.items || [])
      .filter((item) => item.slug !== slug && item.category === explainer.category)
      .slice(0, 3),
  };
}

export async function fetchTimelineData(searchParams = {}) {
  const [policyRows, promiseRows] = await Promise.all([
    query(
      `
      SELECT
        p.id,
        p.title,
        p.year_enacted,
        p.summary,
        p.impact_direction,
        pr.full_name AS president
      FROM policies p
      LEFT JOIN presidents pr ON pr.id = p.president_id
      WHERE p.is_archived = 0
      ORDER BY p.year_enacted DESC, p.id DESC
      LIMIT 80
      `
    ),
    query(
      `
      SELECT
        pr.slug,
        pr.title,
        pr.promise_date,
        pr.summary,
        pr.status,
        pr.president
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
    badges: [row.status || "Promise", row.president || "Historical record"],
  }));

  const events = [...policyEvents, ...promiseEvents];
  const queryText = normalizeText(searchParams.q).toLowerCase();
  const typeFilter = normalizeText(searchParams.type);
  const directionFilter = normalizeText(searchParams.direction);

  const filteredEvents = events
    .filter((item) => {
      const matchesQuery =
        !queryText ||
        [item.title, item.summary, item.president, ...(item.badges || [])]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(queryText));
      const matchesType = !typeFilter || item.kind === typeFilter;
      const matchesDirection = !directionFilter || item.direction === directionFilter;
      return matchesQuery && matchesType && matchesDirection;
    })
    .sort((a, b) => Number(b.year || 0) - Number(a.year || 0));

  return {
    items: filteredEvents,
    filters: {
      q: searchParams.q || "",
      type: typeFilter,
      direction: directionFilter,
    },
    filterOptions: {
      types: [...new Set(events.map((item) => item.kind))],
      directions: [...new Set(events.map((item) => item.direction).filter(Boolean))],
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
        FROM promise_outcome_sources pos
        WHERE pos.source_id = s.id
      ) AS outcome_link_count
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

  return rows.map((row) => {
    const linked_record_count =
      Number(row.policy_link_count || 0) +
      Number(row.promise_link_count || 0) +
      Number(row.action_link_count || 0) +
      Number(row.outcome_link_count || 0);
    return {
      ...row,
      linked_record_count,
      confidence_label: confidenceFromSourceCount(linked_record_count, {
        government: row.source_type === "Government" ? 1 : 0,
        academic: row.source_type === "Academic" ? 1 : 0,
        archive: row.source_type === "Archive" ? 1 : 0,
      }),
    };
  });
}

export async function fetchUniversalSearchData(q = "") {
  const term = normalizeText(q);
  if (!term) {
    return {
      query: "",
      sections: [],
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
      SELECT id, title, summary, year_enacted
      FROM policies
      WHERE is_archived = 0 AND (title LIKE ? OR summary LIKE ?)
      ORDER BY year_enacted DESC, id DESC
      LIMIT 8
      `,
      [likeValue, likeValue]
    ),
    query(
      `
      SELECT slug, title, summary, status
      FROM promises
      WHERE title LIKE ? OR summary LIKE ?
      ORDER BY promise_date DESC, id DESC
      LIMIT 8
      `,
      [likeValue, likeValue]
    ).catch(() => []),
  ]);

  const sections = [
    {
      key: "policies",
      label: "Policies",
      items: policies.map((item) => ({
        href: `/policies/${buildPolicySlug(item)}`,
        title: item.title,
        summary: item.summary,
        meta: item.year_enacted ? `Policy • ${item.year_enacted}` : "Policy",
      })),
    },
    {
      key: "presidents",
      label: "Presidents",
      items: presidents.slice(0, 8).map((item) => ({
        href: `/presidents/${item.slug}`,
        title: item.name,
        summary: item.narrative_summary,
        meta: `${item.party || "Historical record"} • ${item.termLabel}`,
      })),
    },
    {
      key: "promises",
      label: "Promises",
      items: promises.map((item) => ({
        href: `/promises/${item.slug}`,
        title: item.title,
        summary: item.summary,
        meta: item.status ? `Promise • ${item.status}` : "Promise",
      })),
    },
    {
      key: "administrations",
      label: "Administrations",
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
      items: (explainersIndex.items || [])
        .filter((item) =>
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
      items: sources.slice(0, 8).map((item) => ({
        href: `/sources?q=${encodeURIComponent(item.source_title || item.publisher || "")}`,
        title: item.source_title,
        summary: item.publisher || item.notes,
        meta: `${item.source_type || "Source"} • ${item.linked_record_count || 0} linked records`,
      })),
    },
  ];

  return {
    query: term,
    sections,
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
  const enrichedComparedPresidents = (comparison.compared_presidents || []).map((item) => {
    const promiseMeta = promisesBySlug.get(item.president_slug) || {};
    return {
      ...item,
      delivered_count: promiseMeta.visible_delivered_count ?? 0,
      in_progress_count: promiseMeta.visible_in_progress_count ?? 0,
      blocked_count: promiseMeta.visible_blocked_count ?? 0,
      failed_count: promiseMeta.visible_failed_count ?? 0,
      partial_count: promiseMeta.visible_partial_count ?? 0,
      termLabel: formatTermLabel(promiseMeta.term_start, promiseMeta.term_end),
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
      delivered_count: promisesBySlug.get(item.slug)?.visible_delivered_count ?? 0,
      in_progress_count: promisesBySlug.get(item.slug)?.visible_in_progress_count ?? 0,
      blocked_count: promisesBySlug.get(item.slug)?.visible_blocked_count ?? 0,
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
  const rows = await query(
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
  );

  const rowMap = new Map(
    rows.map((row) => [
      row.id,
      {
        ...row,
        slug: buildPolicySlug(row),
        confidence_label: confidenceFromSourceCount(row.source_count, {
          government: row.government_sources,
          academic: row.academic_sources,
          archive: row.archive_sources,
        }),
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
