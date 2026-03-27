import { query } from "@/lib/db";
import {
  applyPromiseCuration,
  comparePromiseCuration,
  getDefaultBrowsePromiseSlugs,
} from "@/lib/promise-tracker-curation";
import {
  aggregatePromiseScoresByPresident,
  getPromiseScoreMethodology,
} from "@/lib/promise-tracker-scoring";

export const PROMISE_STATUSES = [
  "Delivered",
  "In Progress",
  "Partial",
  "Failed",
  "Blocked",
];

const CIVIL_RIGHTS_TIMELINE_GROUPS = [
  {
    id: "reconstruction",
    label: "Reconstruction",
    description:
      "Early federal efforts to protect Black civil status, voting rights, and equal treatment after emancipation.",
    slugs: [
      "grant-sign-civil-rights-act-1875",
      "grant-protect-black-voting-rights-from-ku-klux-klan-terror",
    ],
  },
  {
    id: "civil-rights-era",
    label: "Civil Rights Era",
    description:
      "Mid-century federal enforcement and lawmaking that challenged segregation, discrimination, and exclusion.",
    slugs: [
      "eisenhower-enforce-little-rock-school-desegregation",
      "eisenhower-sign-civil-rights-act-1957",
      "johnson-sign-civil-rights-act-1964",
      "johnson-pass-voting-rights-act-after-selma",
      "johnson-executive-order-11246-federal-contracting",
      "johnson-appoint-thurgood-marshall-supreme-court",
      "johnson-pass-fair-housing-act",
      "nixon-expand-affirmative-action-federal-contracting",
    ],
  },
  {
    id: "modern-continuity",
    label: "Modern Continuity",
    description:
      "Later federal records that extend the civil-rights story into modern policing, courts, and accountability debates.",
    slugs: [
      "obama-ban-racial-profiling-federal-law-enforcement",
      "biden-nominate-first-black-woman-supreme-court",
    ],
  },
];

const CIVIL_RIGHTS_TIMELINE_SLUGS = CIVIL_RIGHTS_TIMELINE_GROUPS.flatMap(
  (group) => group.slugs
);

const PROMISE_STATUS_FIELD_SQL = `
  FIELD(p.status, 'Delivered', 'In Progress', 'Partial', 'Failed', 'Blocked')
`;

const PROMISE_STATUS_FILTER_FIELD_SQL = `
  FIELD(status, 'Delivered', 'In Progress', 'Partial', 'Failed', 'Blocked')
`;

function normalizeSlugPart(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function getPromisePresidentSlug(name) {
  return normalizeSlugPart(name || "");
}

function buildPromiseListFromAndWhere(filters = {}) {
  let fromAndWhere = `
    FROM promises p
    JOIN presidents pr ON pr.id = p.president_id
    LEFT JOIN parties pa ON pa.id = pr.party_id
    WHERE 1=1
  `;

  const params = [];

  if (!filters.showAll) {
    const visibleSlugs = getDefaultBrowsePromiseSlugs();
    if (visibleSlugs.length > 0) {
      fromAndWhere += ` AND p.slug IN (${visibleSlugs.map(() => "?").join(", ")})`;
      params.push(...visibleSlugs);
    }
  }

  if (filters.q) {
    fromAndWhere += `
      AND (
        p.title LIKE ?
        OR p.summary LIKE ?
        OR p.promise_text LIKE ?
        OR p.topic LIKE ?
        OR p.impacted_group LIKE ?
        OR pr.full_name LIKE ?
      )
    `;
    const likeValue = `%${filters.q}%`;
    params.push(
      likeValue,
      likeValue,
      likeValue,
      likeValue,
      likeValue,
      likeValue
    );
  }

  if (filters.president) {
    fromAndWhere += ` AND pr.full_name = ?`;
    params.push(filters.president);
  }

  if (filters.status) {
    fromAndWhere += ` AND p.status = ?`;
    params.push(filters.status);
  }

  if (filters.topic) {
    fromAndWhere += ` AND p.topic = ?`;
    params.push(filters.topic);
  }

  return { fromAndWhere, params };
}

function buildPromiseVisibilityClause(showAll, alias = "p") {
  if (showAll) {
    return { clause: "", params: [] };
  }

  const visibleSlugs = getDefaultBrowsePromiseSlugs();
  if (!visibleSlugs.length) {
    return { clause: "", params: [] };
  }

  return {
    clause: ` AND ${alias}.slug IN (${visibleSlugs.map(() => "?").join(", ")})`,
    params: visibleSlugs,
  };
}

function getPromiseListOrderBy(sort) {
  if (sort === "promise_date_asc") {
    return ` ORDER BY p.promise_date ASC, p.title ASC`;
  }

  if (sort === "title_asc") {
    return ` ORDER BY p.title ASC`;
  }

  if (sort === "title_desc") {
    return ` ORDER BY p.title DESC`;
  }

  if (sort === "status_asc") {
    return `
      ORDER BY
        ${PROMISE_STATUS_FIELD_SQL},
        p.promise_date DESC,
        p.title ASC
    `;
  }

  return ` ORDER BY p.promise_date DESC, p.title ASC`;
}

function groupRowsByKey(rows, keyName) {
  const grouped = new Map();

  for (const row of rows) {
    const key = row[keyName];
    const source = {
      id: row.id,
      source_title: row.source_title,
      source_url: row.source_url,
      source_type: row.source_type,
      publisher: row.publisher,
      published_date: row.published_date,
      notes: row.notes,
    };

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }

    grouped.get(key).push(source);
  }

  return grouped;
}

function mapPromiseCardRow(row) {
  return applyPromiseCuration({
    ...row,
    president_slug: getPromisePresidentSlug(row.president),
    action_count: Number(row.action_count || 0),
    source_count: Number(row.source_count || 0),
    related_policy_count: Number(row.related_policy_count || 0),
    related_explainer_count: Number(row.related_explainer_count || 0),
  });
}

function groupPromisesByStatus(rows) {
  const groups = new Map(PROMISE_STATUSES.map((status) => [status, []]));

  for (const row of rows) {
    const status = row.status || "In Progress";
    if (!groups.has(status)) {
      groups.set(status, []);
    }

    groups.get(status).push(mapPromiseCardRow(row));
  }

  return PROMISE_STATUSES.map((status) => ({
    status,
    items: (groups.get(status) || []).sort((a, b) => {
      const curationDiff = comparePromiseCuration(a, b);
      if (curationDiff !== 0) return curationDiff;

      const aLatest = new Date(a.latest_action_date || a.promise_date || 0).getTime();
      const bLatest = new Date(b.latest_action_date || b.promise_date || 0).getTime();
      if (aLatest !== bLatest) return bLatest - aLatest;

      return a.title.localeCompare(b.title);
    }),
  }));
}

async function fetchPromiseCardRows(whereClause = "", params = [], orderBy = "") {
  const rows = await query(
    `
    SELECT
      p.id,
      p.slug,
      p.title,
      p.promise_date,
      p.promise_type,
      p.campaign_or_official,
      p.topic,
      p.impacted_group,
      p.status,
      p.summary,
      p.is_demo,
      pr.full_name AS president,
      pa.name AS president_party,
      (
        SELECT COUNT(*)
        FROM promise_actions pact
        WHERE pact.promise_id = p.id
      ) AS action_count,
      (
        SELECT COUNT(DISTINCT linked_sources.source_id)
        FROM (
          SELECT ps.source_id, ps.promise_id AS owner_promise_id
          FROM promise_sources ps
          UNION
          SELECT pas.source_id, pact_actions.promise_id AS owner_promise_id
          FROM promise_actions pact_actions
          JOIN promise_action_sources pas
            ON pas.promise_action_id = pact_actions.id
          UNION
          SELECT pos.source_id, pout.promise_id AS owner_promise_id
          FROM promise_outcomes pout
          JOIN promise_outcome_sources pos
            ON pos.promise_outcome_id = pout.id
        ) AS linked_sources
        WHERE linked_sources.owner_promise_id = p.id
      ) AS source_count,
      (
        SELECT MAX(pact_latest.action_date)
        FROM promise_actions pact_latest
        WHERE pact_latest.promise_id = p.id
      ) AS latest_action_date,
      (
        SELECT COUNT(DISTINCT pact_policy.related_policy_id)
        FROM promise_actions pact_policy
        WHERE pact_policy.promise_id = p.id
          AND pact_policy.related_policy_id IS NOT NULL
      ) AS related_policy_count,
      (
        SELECT COUNT(DISTINCT pact_explainer.related_explainer_id)
        FROM promise_actions pact_explainer
        WHERE pact_explainer.promise_id = p.id
          AND pact_explainer.related_explainer_id IS NOT NULL
      ) AS related_explainer_count
    FROM promises p
    JOIN presidents pr ON pr.id = p.president_id
    LEFT JOIN parties pa ON pa.id = pr.party_id
    ${whereClause}
    ${orderBy}
    `,
    params
  );

  return rows.map(mapPromiseCardRow);
}

export async function fetchPromiseList({
  q,
  president,
  status,
  topic,
  showAll = false,
  sort = "promise_date_desc",
  page = 1,
  pageSize = 12,
}) {
  const { fromAndWhere, params } = buildPromiseListFromAndWhere({
    q,
    president,
    status,
    topic,
    showAll,
  });

  const countRows = await query(
    `SELECT COUNT(*) AS total ${fromAndWhere}`,
    params
  );
  const total = Number(countRows[0]?.total || 0);
  const offset = (page - 1) * pageSize;

  const rows = await query(
    `
    SELECT
      p.id,
      p.slug,
      p.title,
      p.promise_date,
      p.promise_type,
      p.campaign_or_official,
      p.topic,
      p.impacted_group,
      p.status,
      p.summary,
      p.is_demo,
      pr.full_name AS president,
      pa.name AS president_party,
      (
        SELECT COUNT(*)
        FROM promise_actions pact
        WHERE pact.promise_id = p.id
      ) AS action_count,
      (
        SELECT COUNT(DISTINCT linked_sources.source_id)
        FROM (
          SELECT ps.source_id, ps.promise_id AS owner_promise_id
          FROM promise_sources ps
          UNION
          SELECT pas.source_id, pact_actions.promise_id AS owner_promise_id
          FROM promise_actions pact_actions
          JOIN promise_action_sources pas
            ON pas.promise_action_id = pact_actions.id
          UNION
          SELECT pos.source_id, pout.promise_id AS owner_promise_id
          FROM promise_outcomes pout
          JOIN promise_outcome_sources pos
            ON pos.promise_outcome_id = pout.id
        ) AS linked_sources
        WHERE linked_sources.owner_promise_id = p.id
      ) AS source_count,
      (
        SELECT MAX(pact_latest.action_date)
        FROM promise_actions pact_latest
        WHERE pact_latest.promise_id = p.id
      ) AS latest_action_date,
      (
        SELECT COUNT(DISTINCT pact_policy.related_policy_id)
        FROM promise_actions pact_policy
        WHERE pact_policy.promise_id = p.id
          AND pact_policy.related_policy_id IS NOT NULL
      ) AS related_policy_count,
      (
        SELECT COUNT(DISTINCT pact_explainer.related_explainer_id)
        FROM promise_actions pact_explainer
        WHERE pact_explainer.promise_id = p.id
          AND pact_explainer.related_explainer_id IS NOT NULL
      ) AS related_explainer_count
    ${fromAndWhere}
    ${getPromiseListOrderBy(sort)}
    LIMIT ? OFFSET ?
    `,
    [...params, pageSize, offset]
  );

  const presidentFilter = buildPromiseVisibilityClause(showAll, "p");
  const presidentRows = await query(
    `
    SELECT DISTINCT pr.full_name
    FROM promises p
    JOIN presidents pr ON pr.id = p.president_id
    WHERE 1=1
      ${presidentFilter.clause}
    ORDER BY pr.full_name ASC
    `,
    presidentFilter.params
  );

  const topicFilter = buildPromiseVisibilityClause(showAll, "p");
  const topicRows = await query(
    `
    SELECT DISTINCT topic
    FROM promises p
    WHERE 1=1
      ${topicFilter.clause}
      AND topic IS NOT NULL
      AND topic <> ''
    ORDER BY topic ASC
    `,
    topicFilter.params
  );

  const statusFilter = buildPromiseVisibilityClause(showAll, "p");
  const statusRows = await query(
    `
    SELECT DISTINCT status
    FROM promises p
    WHERE 1=1
      ${statusFilter.clause}
    ORDER BY ${PROMISE_STATUS_FILTER_FIELD_SQL}
    `,
    statusFilter.params
  );

  return {
    items: rows.map(mapPromiseCardRow),
    pagination: {
      page,
      page_size: pageSize,
      total,
      total_pages: Math.max(Math.ceil(total / pageSize), 1),
      has_prev: page > 1,
      has_next: offset + rows.length < total,
    },
    filters: {
      presidents: presidentRows.map((row) => row.full_name),
      topics: topicRows.map((row) => row.topic),
      statuses: statusRows.map((row) => row.status),
    },
    curation: {
      show_all: showAll,
      default_scope: "High and Medium relevance",
    },
  };
}

export async function fetchPromisePresidentIndex({ showAll = false } = {}) {
  const visibilityFilter = buildPromiseVisibilityClause(showAll, "p");
  const rows = await query(
    `
    SELECT
      pr.id,
      pr.full_name AS president,
      pa.name AS president_party,
      pr.term_start,
      pr.term_end,
      COUNT(p.id) AS total_tracked_promises,
      SUM(CASE WHEN p.status = 'Delivered' THEN 1 ELSE 0 END) AS delivered_count,
      SUM(CASE WHEN p.status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress_count,
      SUM(CASE WHEN p.status = 'Partial' THEN 1 ELSE 0 END) AS partial_count,
      SUM(CASE WHEN p.status = 'Failed' THEN 1 ELSE 0 END) AS failed_count,
      SUM(CASE WHEN p.status = 'Blocked' THEN 1 ELSE 0 END) AS blocked_count
    FROM presidents pr
    JOIN promises p ON p.president_id = pr.id
    LEFT JOIN parties pa ON pa.id = pr.party_id
    WHERE 1=1
      ${visibilityFilter.clause}
    GROUP BY pr.id, pr.full_name, pa.name, pr.term_start, pr.term_end
    ORDER BY pr.term_start ASC, pr.id ASC
    `,
    visibilityFilter.params
  );

  return rows.map((row) => ({
    ...row,
    slug: getPromisePresidentSlug(row.president),
    total_tracked_promises: Number(row.total_tracked_promises || 0),
    delivered_count: Number(row.delivered_count || 0),
    in_progress_count: Number(row.in_progress_count || 0),
    partial_count: Number(row.partial_count || 0),
    failed_count: Number(row.failed_count || 0),
    blocked_count: Number(row.blocked_count || 0),
  }));
}

export async function fetchPromisePresidentDetail(slug, { showAll = false } = {}) {
  const presidentRows = await fetchPromisePresidentIndex({ showAll: true });
  const president = presidentRows.find((row) => row.slug === slug);

  if (!president) {
    return null;
  }

  const visibilityFilter = buildPromiseVisibilityClause(showAll, "p");
  const promiseRows = await fetchPromiseCardRows(
    `
    WHERE p.president_id = ?
      ${visibilityFilter.clause}
    `,
    [president.id, ...visibilityFilter.params],
    `
    ORDER BY
      ${PROMISE_STATUS_FIELD_SQL},
      COALESCE(latest_action_date, p.promise_date) DESC,
      p.promise_date DESC,
      p.title ASC
    `
  );

  return {
    ...president,
    visible_promise_count: promiseRows.length,
    visible_delivered_count: promiseRows.filter((row) => row.status === "Delivered").length,
    visible_in_progress_count: promiseRows.filter((row) => row.status === "In Progress").length,
    visible_partial_count: promiseRows.filter((row) => row.status === "Partial").length,
    visible_failed_count: promiseRows.filter((row) => row.status === "Failed").length,
    visible_blocked_count: promiseRows.filter((row) => row.status === "Blocked").length,
    show_all: showAll,
    status_sections: groupPromisesByStatus(promiseRows),
  };
}

export async function fetchRelatedPromisesForPolicy(policyId) {
  return fetchPromiseCardRows(
    `
    WHERE EXISTS (
      SELECT 1
      FROM promise_actions pact
      WHERE pact.promise_id = p.id
        AND pact.related_policy_id = ?
    )
    `,
    [policyId],
    `
    ORDER BY
      pr.term_start DESC,
      p.promise_date DESC,
      p.title ASC
    `
  );
}

export async function fetchRelatedPromisesForExplainer(explainerId) {
  return fetchPromiseCardRows(
    `
    WHERE EXISTS (
      SELECT 1
      FROM promise_actions pact
      WHERE pact.promise_id = p.id
        AND pact.related_explainer_id = ?
    )
    `,
    [explainerId],
    `
    ORDER BY
      pr.term_start DESC,
      p.promise_date DESC,
      p.title ASC
    `
  );
}

export async function fetchPromiseDetail(slug) {
  const promiseRows = await query(
    `
    SELECT
      p.*,
      pr.full_name AS president,
      pa.name AS president_party
    FROM promises p
    JOIN presidents pr ON pr.id = p.president_id
    LEFT JOIN parties pa ON pa.id = pr.party_id
    WHERE p.slug = ?
    LIMIT 1
    `,
    [slug]
  );

  if (!promiseRows.length) {
    return null;
  }

  const promise = promiseRows[0];
  promise.president_slug = getPromisePresidentSlug(promise.president);

  const actionRows = await query(
    `
    SELECT
      pa.id,
      pa.promise_id,
      pa.action_type,
      pa.action_date,
      pa.title,
      pa.description,
      pa.related_policy_id,
      pa.related_explainer_id,
      p.title AS related_policy_title,
      e.slug AS related_explainer_slug,
      e.title AS related_explainer_title
    FROM promise_actions pa
    LEFT JOIN policies p ON p.id = pa.related_policy_id
    LEFT JOIN explainers e ON e.id = pa.related_explainer_id
    WHERE pa.promise_id = ?
    ORDER BY pa.action_date ASC, pa.id ASC
    `,
    [promise.id]
  );

  const outcomeRows = await query(
    `
    SELECT
      id,
      promise_id,
      outcome_summary,
      outcome_type,
      measurable_impact,
      impact_direction,
      black_community_impact_note,
      evidence_strength,
      status_override
    FROM promise_outcomes
    WHERE promise_id = ?
    ORDER BY id ASC
    `,
    [promise.id]
  );

  const promiseSourceRows = await query(
    `
    SELECT
      s.id,
      s.source_title,
      s.source_url,
      s.source_type,
      s.publisher,
      s.published_date,
      s.notes
    FROM promise_sources ps
    JOIN sources s ON s.id = ps.source_id
    WHERE ps.promise_id = ?
    ORDER BY s.published_date DESC, s.id ASC
    `,
    [promise.id]
  );

  const actionSourceRows = await query(
    `
    SELECT
      pa.id AS promise_action_id,
      s.id,
      s.source_title,
      s.source_url,
      s.source_type,
      s.publisher,
      s.published_date,
      s.notes
    FROM promise_actions pa
    JOIN promise_action_sources pas
      ON pas.promise_action_id = pa.id
    JOIN sources s
      ON s.id = pas.source_id
    WHERE pa.promise_id = ?
    ORDER BY pa.action_date ASC, s.published_date DESC, s.id ASC
    `,
    [promise.id]
  );

  const outcomeSourceRows = await query(
    `
    SELECT
      po.id AS promise_outcome_id,
      s.id,
      s.source_title,
      s.source_url,
      s.source_type,
      s.publisher,
      s.published_date,
      s.notes
    FROM promise_outcomes po
    JOIN promise_outcome_sources pos
      ON pos.promise_outcome_id = po.id
    JOIN sources s
      ON s.id = pos.source_id
    WHERE po.promise_id = ?
    ORDER BY po.id ASC, s.published_date DESC, s.id ASC
    `,
    [promise.id]
  );

  const actionSources = groupRowsByKey(actionSourceRows, "promise_action_id");
  const outcomeSources = groupRowsByKey(outcomeSourceRows, "promise_outcome_id");

  const actions = actionRows.map((row) => ({
    ...row,
    sources: actionSources.get(row.id) || [],
  }));

  const outcomes = outcomeRows.map((row) => ({
    ...row,
    sources: outcomeSources.get(row.id) || [],
  }));

  const relatedPolicyRows = await query(
    `
    SELECT DISTINCT
      p.id,
      p.title,
      p.year_enacted,
      p.policy_type,
      p.impact_direction,
      p.status,
      pr.full_name AS president,
      pa.name AS primary_party
    FROM promise_actions pact
    JOIN policies p ON p.id = pact.related_policy_id
    LEFT JOIN presidents pr ON pr.id = p.president_id
    LEFT JOIN parties pa ON pa.id = p.primary_party_id
    WHERE pact.promise_id = ?
      AND p.is_archived = 0
    ORDER BY p.year_enacted ASC, p.title ASC
    `,
    [promise.id]
  );

  const relatedExplainerRows = await query(
    `
    SELECT DISTINCT
      e.id,
      e.slug,
      e.title,
      e.summary,
      e.category
    FROM promise_actions pact
    JOIN explainers e ON e.id = pact.related_explainer_id
    WHERE pact.promise_id = ?
      AND e.published = 1
    ORDER BY e.title ASC
    `,
    [promise.id]
  );

  const totalSourceRows = await query(
    `
    SELECT COUNT(DISTINCT linked_sources.source_id) AS total_sources
    FROM (
      SELECT ps.source_id
      FROM promise_sources ps
      WHERE ps.promise_id = ?
      UNION
      SELECT pas.source_id
      FROM promise_actions pact
      JOIN promise_action_sources pas
        ON pas.promise_action_id = pact.id
      WHERE pact.promise_id = ?
      UNION
      SELECT pos.source_id
      FROM promise_outcomes pout
      JOIN promise_outcome_sources pos
        ON pos.promise_outcome_id = pout.id
      WHERE pout.promise_id = ?
    ) AS linked_sources
    `,
    [promise.id, promise.id, promise.id]
  );

  return applyPromiseCuration({
    ...promise,
    actions,
    outcomes,
    promise_sources: promiseSourceRows,
    source_groups: {
      promise: promiseSourceRows,
      actions: actions
        .map((action) => ({
          action_id: action.id,
          action_title: action.title,
          sources: action.sources,
        }))
        .filter((group) => group.sources.length > 0),
      outcomes: outcomes
        .map((outcome) => ({
          outcome_id: outcome.id,
          outcome_type: outcome.outcome_type,
          sources: outcome.sources,
        }))
        .filter((group) => group.sources.length > 0),
    },
    related_policies: relatedPolicyRows,
    related_explainers: relatedExplainerRows,
    source_summary: {
      total_sources: Number(totalSourceRows[0]?.total_sources || 0),
      promise_sources: promiseSourceRows.length,
      action_sources: actions.reduce((count, action) => count + action.sources.length, 0),
      outcome_sources: outcomes.reduce((count, outcome) => count + outcome.sources.length, 0),
    },
  });
}

export async function fetchPromiseScoreSummaries() {
  const rows = await query(
    `
    SELECT
      p.id,
      p.slug,
      p.title,
      p.promise_date,
      p.topic,
      p.status,
      p.summary,
      pr.full_name AS president,
      pa.name AS president_party,
      (
        SELECT MAX(pact_latest.action_date)
        FROM promise_actions pact_latest
        WHERE pact_latest.promise_id = p.id
      ) AS latest_action_date
    FROM promises p
    JOIN presidents pr ON pr.id = p.president_id
    LEFT JOIN parties pa ON pa.id = pr.party_id
    ORDER BY pr.term_start ASC, p.promise_date ASC, p.id ASC
    `
  );

  const curatedRows = rows.map((row) =>
    applyPromiseCuration({
      ...row,
      president_slug: getPromisePresidentSlug(row.president),
    })
  );

  return {
    methodology: getPromiseScoreMethodology(),
    items: aggregatePromiseScoresByPresident(curatedRows),
  };
}

export async function fetchCivilRightsTimeline() {
  const rows = await query(
    `
    SELECT
      p.id,
      p.slug,
      p.title,
      p.promise_date,
      p.topic,
      p.status,
      p.summary,
      pr.full_name AS president,
      pr.term_start,
      pa.name AS president_party,
      (
        SELECT po.impact_direction
        FROM promise_outcomes po
        WHERE po.promise_id = p.id
        ORDER BY po.id ASC
        LIMIT 1
      ) AS impact_direction,
      (
        SELECT po.outcome_type
        FROM promise_outcomes po
        WHERE po.promise_id = p.id
        ORDER BY po.id ASC
        LIMIT 1
      ) AS outcome_type,
      (
        SELECT pol.id
        FROM promise_actions pact
        JOIN policies pol ON pol.id = pact.related_policy_id
        WHERE pact.promise_id = p.id
          AND pol.is_archived = 0
        ORDER BY pact.action_date ASC, pact.id ASC
        LIMIT 1
      ) AS related_policy_id,
      (
        SELECT pol.title
        FROM promise_actions pact
        JOIN policies pol ON pol.id = pact.related_policy_id
        WHERE pact.promise_id = p.id
          AND pol.is_archived = 0
        ORDER BY pact.action_date ASC, pact.id ASC
        LIMIT 1
      ) AS related_policy_title,
      (
        SELECT e.slug
        FROM promise_actions pact
        JOIN explainers e ON e.id = pact.related_explainer_id
        WHERE pact.promise_id = p.id
          AND e.published = 1
        ORDER BY pact.action_date ASC, pact.id ASC
        LIMIT 1
      ) AS related_explainer_slug,
      (
        SELECT e.title
        FROM promise_actions pact
        JOIN explainers e ON e.id = pact.related_explainer_id
        WHERE pact.promise_id = p.id
          AND e.published = 1
        ORDER BY pact.action_date ASC, pact.id ASC
        LIMIT 1
      ) AS related_explainer_title
    FROM promises p
    JOIN presidents pr ON pr.id = p.president_id
    LEFT JOIN parties pa ON pa.id = pr.party_id
    WHERE p.slug IN (${CIVIL_RIGHTS_TIMELINE_SLUGS.map(() => "?").join(", ")})
    ORDER BY p.promise_date ASC, pr.term_start ASC, p.id ASC
    `,
    CIVIL_RIGHTS_TIMELINE_SLUGS
  );

  const rowsBySlug = new Map(
    rows.map((row) => [
      row.slug,
      applyPromiseCuration({
        ...row,
        president_slug: getPromisePresidentSlug(row.president),
      }),
    ])
  );

  const eras = CIVIL_RIGHTS_TIMELINE_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    description: group.description,
    items: group.slugs.map((slug) => rowsBySlug.get(slug)).filter(Boolean),
  })).filter((group) => group.items.length > 0);

  return {
    items: eras.flatMap((group) => group.items),
    eras,
    curated_slugs: [...CIVIL_RIGHTS_TIMELINE_SLUGS],
  };
}
