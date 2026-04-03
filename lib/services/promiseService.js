import { query } from "@/lib/db";
import {
  applyPromiseCuration,
  comparePromiseCuration,
  getDefaultBrowsePromiseSlugs,
} from "@/lib/promise-tracker-curation";
import {
  aggregatePromiseScoresByPresident,
  getPromiseScoreMethodology,
  scorePromise,
} from "@/lib/promise-tracker-scoring";
import {
  getPromiseTopicFilterValues,
  normalizePromiseTopicLabel,
} from "@/lib/promise-topics";
export {
  computeOutcomeBasedScores,
  fetchPromisesWithOutcomesForScoring,
  prepareScoreContexts,
} from "@/lib/services/blackImpactScoreService";

export const PROMISE_STATUSES = [
  "Delivered",
  "In Progress",
  "Partial",
  "Failed",
  "Blocked",
];

export const CURRENT_ADMINISTRATION_PROMISE_SLUG = "donald-j-trump-2025";

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
    id: "reconstruction-retreat",
    label: "Reconstruction Retreat",
    description:
      "Federal protection narrowed after Reconstruction as enforcement capacity weakened, national protection was withdrawn, and later restoration efforts failed.",
    slugs: [
      "grant-federal-enforcement-weakens-after-cruikshank",
      "hayes-withdraw-federal-troops-compromise-1877",
      "arthur-retreat-from-civil-rights-enforcement",
      "harrison-fail-lodge-elections-bill-federal-voting-protection",
    ],
  },
  {
    id: "pre-civil-rights-bridge",
    label: "Pre-Civil Rights Bridge",
    description:
      "Early postwar federal re-entry into desegregation and equal-treatment enforcement before the main legislative breakthroughs of the 1960s.",
    slugs: [
      "truman-desegregate-armed-forces",
    ],
  },
  {
    id: "civil-rights-era",
    label: "Civil Rights Era",
    description:
      "Mid-century federal enforcement and lawmaking that challenged segregation, discrimination, and exclusion, moving from executive precursors into major statutory expansion.",
    slugs: [
      "kennedy-executive-order-10925-equal-employment",
      "kennedy-executive-order-11063-fair-housing",
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
    id: "post-civil-rights-continuity",
    label: "Post-Civil Rights Continuity",
    description:
      "Later federal records that show how civil-rights enforcement continued through housing, employment, and institutional accountability after the major 1960s laws.",
    slugs: [
      "carter-sign-community-reinvestment-act",
    ],
  },
  {
    id: "modern-continuity",
    label: "Modern Continuity",
    description:
      "Later federal records that extend the civil-rights story into modern voting rights, policing, courts, and accountability debates.",
    slugs: [
      "bush-sign-voting-rights-act-reauthorization-2006",
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

function resolvePromisePresidentSlug(row) {
  return row?.president_slug || getPromisePresidentSlug(row?.president);
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
    const topicValues = getPromiseTopicFilterValues(filters.topic);
    if (topicValues.length > 1) {
      fromAndWhere += ` AND p.topic IN (${topicValues.map(() => "?").join(", ")})`;
      params.push(...topicValues);
    } else {
      fromAndWhere += ` AND p.topic = ?`;
      params.push(topicValues[0] || filters.topic);
    }
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

function normalizeTimelineSource(row) {
  return {
    id: row.id,
    title: row.title,
    publisher: row.publisher,
    url: row.url,
    source_type: row.source_type,
  };
}

function buildSourcesMap(rows, keyName) {
  const grouped = new Map();

  for (const row of rows) {
    const key = row[keyName];

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }

    grouped.get(key).push(normalizeTimelineSource(row));
  }

  return grouped;
}

function buildLegacySourceList(sources) {
  return sources.map((source) => ({
    id: source.id,
    source_title: source.title,
    publisher: source.publisher,
    source_url: source.url,
    source_type: source.source_type,
  }));
}

async function getActionSources(actionIds = []) {
  if (!actionIds.length) {
    return new Map();
  }

  const rows = await query(
    `
    SELECT
      pas.promise_action_id,
      s.id,
      s.source_title AS title,
      s.publisher,
      s.source_url AS url,
      s.source_type
    FROM promise_action_sources pas
    JOIN sources s ON s.id = pas.source_id
    WHERE pas.promise_action_id IN (${actionIds.map(() => "?").join(", ")})
    ORDER BY pas.promise_action_id ASC, s.published_date DESC, s.id ASC
    `,
    actionIds
  );

  return buildSourcesMap(rows, "promise_action_id");
}

async function getOutcomeSources(outcomeIds = []) {
  if (!outcomeIds.length) {
    return new Map();
  }

  const rows = await query(
    `
    SELECT
      pos.promise_outcome_id,
      s.id,
      s.source_title AS title,
      s.publisher,
      s.source_url AS url,
      s.source_type
    FROM promise_outcome_sources pos
    JOIN sources s ON s.id = pos.source_id
    WHERE pos.promise_outcome_id IN (${outcomeIds.map(() => "?").join(", ")})
    ORDER BY pos.promise_outcome_id ASC, s.published_date DESC, s.id ASC
    `,
    outcomeIds
  );

  return buildSourcesMap(rows, "promise_outcome_id");
}

async function getPromiseRelationships(promiseId) {
  const [incomingRows, outgoingRows] = await Promise.all([
    query(
      `
      SELECT
        pr.relationship_type,
        p.id,
        p.slug,
        p.title,
        p.promise_date
      FROM promise_relationships pr
      JOIN promises p ON p.id = pr.from_promise_id
      WHERE pr.to_promise_id = ?
      ORDER BY p.promise_date ASC, p.id ASC
      `,
      [promiseId]
    ),
    query(
      `
      SELECT
        pr.relationship_type,
        p.id,
        p.slug,
        p.title,
        p.promise_date
      FROM promise_relationships pr
      JOIN promises p ON p.id = pr.to_promise_id
      WHERE pr.from_promise_id = ?
      ORDER BY p.promise_date ASC, p.id ASC
      `,
      [promiseId]
    ),
  ]);

  return {
    related_from_promises: incomingRows.map((row) => ({
      relationship_type: row.relationship_type,
      promise: {
        id: row.id,
        slug: row.slug,
        title: row.title,
        promise_date: row.promise_date,
      },
    })),
    related_to_promises: outgoingRows.map((row) => ({
      relationship_type: row.relationship_type,
      promise: {
        id: row.id,
        slug: row.slug,
        title: row.title,
        promise_date: row.promise_date,
      },
    })),
  };
}

export async function fetchPromiseTimelineRelationshipMap(promiseIds = []) {
  const normalizedIds = [...new Set(
    promiseIds
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0)
  )];

  if (!normalizedIds.length) {
    return new Map();
  }

  const rows = await query(
    `
    SELECT
      pr.from_promise_id,
      pr.relationship_type,
      p.id,
      p.slug,
      p.title,
      p.promise_date
    FROM promise_relationships pr
    JOIN promises p ON p.id = pr.to_promise_id
    WHERE pr.from_promise_id IN (${normalizedIds.map(() => "?").join(", ")})
      AND pr.relationship_type IN ('followed_by', 'builds_on', 'limited_by')
    ORDER BY p.promise_date ASC, p.id ASC
    `,
    normalizedIds
  );

  const relationshipMap = new Map();

  for (const promiseId of normalizedIds) {
    relationshipMap.set(promiseId, []);
  }

  for (const row of rows) {
    if (!relationshipMap.has(row.from_promise_id)) {
      relationshipMap.set(row.from_promise_id, []);
    }

    relationshipMap.get(row.from_promise_id).push({
      relationship_type: row.relationship_type,
      promise: {
        id: row.id,
        slug: row.slug,
        title: row.title,
        promise_date: row.promise_date,
      },
    });
  }

  return relationshipMap;
}

function normalizePromiseChainNode(row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    promise_date: row.promise_date,
  };
}

async function getPromiseById(promiseId) {
  const rows = await query(
    `
    SELECT
      id,
      slug,
      title,
      promise_date
    FROM promises
    WHERE id = ?
    LIMIT 1
    `,
    [promiseId]
  );

  return rows.length ? normalizePromiseChainNode(rows[0]) : null;
}

async function getPromiseBySlug(slug) {
  const rows = await query(
    `
    SELECT
      id,
      slug,
      title,
      promise_date
    FROM promises
    WHERE slug = ?
    LIMIT 1
    `,
    [slug]
  );

  return rows.length ? normalizePromiseChainNode(rows[0]) : null;
}

function compareChainNodeDatesAscending(a, b) {
  const aDate = a?.promise_date ? new Date(a.promise_date).getTime() : Number.NaN;
  const bDate = b?.promise_date ? new Date(b.promise_date).getTime() : Number.NaN;

  if (!Number.isNaN(aDate) && !Number.isNaN(bDate) && aDate !== bDate) {
    return aDate - bDate;
  }

  return Number(a?.id || 0) - Number(b?.id || 0);
}

function getChainRelationshipPriority(relationshipType, direction) {
  if (direction === "backward") {
    if (relationshipType === "builds_on") return 0;
    if (relationshipType === "followed_by") return 1;
    return 2;
  }

  if (relationshipType === "followed_by") return 0;
  if (relationshipType === "builds_on") return 1;
  return 2;
}

function pickChainStep(relationships = [], direction) {
  const candidates = relationships.filter(
    (item) =>
      item.relationship_type === "builds_on" ||
      item.relationship_type === "followed_by"
  );

  if (!candidates.length) {
    return null;
  }

  const sorted = [...candidates].sort((a, b) => {
    const priorityDiff =
      getChainRelationshipPriority(a.relationship_type, direction) -
      getChainRelationshipPriority(b.relationship_type, direction);

    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return compareChainNodeDatesAscending(a.promise, b.promise);
  });

  return sorted[0] || null;
}

async function walkPromiseChain(startPromiseId, direction, visitedIds) {
  const chain = [];
  let currentPromiseId = startPromiseId;

  while (true) {
    const relationshipData = await getPromiseRelationships(currentPromiseId);
    const step =
      direction === "backward"
        ? pickChainStep(relationshipData.related_from_promises, "backward")
        : pickChainStep(relationshipData.related_to_promises, "forward");

    if (!step || visitedIds.has(step.promise.id)) {
      break;
    }

    visitedIds.add(step.promise.id);
    chain.push(step.promise);
    currentPromiseId = step.promise.id;
  }

  return chain;
}

export async function getFullPromiseChain(promiseId) {
  const currentPromise = await getPromiseById(promiseId);

  if (!currentPromise) {
    return [];
  }

  const visitedIds = new Set([currentPromise.id]);
  const backwardChain = await walkPromiseChain(currentPromise.id, "backward", visitedIds);
  const forwardChain = await walkPromiseChain(currentPromise.id, "forward", visitedIds);

  return [...backwardChain.reverse(), currentPromise, ...forwardChain];
}

export async function getFullPromiseChainBySlug(slug) {
  const promise = await getPromiseBySlug(slug);

  if (!promise) {
    return null;
  }

  return getFullPromiseChain(promise.id);
}

function compareTimelinePromiseOrder(a, b) {
  const aDate = a?.promise_date ? new Date(a.promise_date).getTime() : 0;
  const bDate = b?.promise_date ? new Date(b.promise_date).getTime() : 0;

  if (aDate !== bDate) {
    return aDate - bDate;
  }

  const aTerm = a?.term_start ? new Date(a.term_start).getTime() : 0;
  const bTerm = b?.term_start ? new Date(b.term_start).getTime() : 0;

  if (aTerm !== bTerm) {
    return aTerm - bTerm;
  }

  return Number(a?.id || 0) - Number(b?.id || 0);
}

function mapPromiseCardRow(row) {
  return applyPromiseCuration({
    ...row,
    topic: normalizePromiseTopicLabel(row.topic),
    president_slug: resolvePromisePresidentSlug(row),
    action_count: Number(row.action_count || 0),
    outcome_count: Number(row.outcome_count || 0),
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

function normalizePromiseImpactDirection(value) {
  if (!value) return null;
  if (value === "Blocked/Unrealized") return "Blocked";
  return value;
}

function buildAdministrationName(fullName) {
  const normalized = String(fullName || "").trim();
  if (!normalized) {
    return "Current Administration";
  }

  const parts = normalized.split(/\s+/);
  return `${parts[parts.length - 1]} Administration`;
}

function summarizeTopicDirection(directionCounts) {
  const orderedDirections = ["Mixed", "Negative", "Positive", "Blocked"];
  const topDirection = orderedDirections
    .map((direction) => ({
      direction,
      count: Number(directionCounts?.[direction] || 0),
    }))
    .sort((left, right) => right.count - left.count)[0];

  if (!topDirection || topDirection.count <= 0) {
    return "No documented outcome direction yet.";
  }

  if (topDirection.direction === "Mixed") {
    return "Mostly mixed outcomes so far.";
  }

  if (topDirection.direction === "Positive") {
    return "Mostly positive documented outcomes so far.";
  }

  if (topDirection.direction === "Negative") {
    return "Mostly negative documented outcomes so far.";
  }

  return "Mostly blocked documented outcomes so far.";
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
      pr.slug AS president_slug,
      pa.name AS president_party,
      (
        SELECT COUNT(*)
        FROM promise_actions pact
        WHERE pact.promise_id = p.id
      ) AS action_count,
      (
        SELECT COUNT(*)
        FROM promise_outcomes pout
        WHERE pout.promise_id = p.id
      ) AS outcome_count,
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
        SELECT pout_latest.evidence_strength
        FROM promise_outcomes pout_latest
        WHERE pout_latest.promise_id = p.id
        ORDER BY pout_latest.id DESC
        LIMIT 1
      ) AS latest_evidence_strength,
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
      pr.slug AS president_slug,
      pa.name AS president_party,
      (
        SELECT COUNT(*)
        FROM promise_actions pact
        WHERE pact.promise_id = p.id
      ) AS action_count,
      (
        SELECT COUNT(*)
        FROM promise_outcomes pout
        WHERE pout.promise_id = p.id
      ) AS outcome_count,
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
      topics: [...new Set(topicRows.map((row) => normalizePromiseTopicLabel(row.topic)).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b)
      ),
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
      pr.slug AS president_slug,
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
    slug: row.president_slug,
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
    visible_outcome_count: promiseRows.reduce((count, row) => count + Number(row.outcome_count || 0), 0),
    visible_source_count: promiseRows.reduce((count, row) => count + Number(row.source_count || 0), 0),
    visible_delivered_count: promiseRows.filter((row) => row.status === "Delivered").length,
    visible_in_progress_count: promiseRows.filter((row) => row.status === "In Progress").length,
    visible_partial_count: promiseRows.filter((row) => row.status === "Partial").length,
    visible_failed_count: promiseRows.filter((row) => row.status === "Failed").length,
    visible_blocked_count: promiseRows.filter((row) => row.status === "Blocked").length,
    show_all: showAll,
    status_sections: groupPromisesByStatus(promiseRows),
  };
}

export async function fetchCurrentAdministrationOverview(
  presidentSlug = CURRENT_ADMINISTRATION_PROMISE_SLUG
) {
  const president = await fetchPromisePresidentDetail(presidentSlug, { showAll: true });

  if (!president) {
    return null;
  }

  const promiseRows = await fetchPromiseCardRows(
    `
    WHERE p.president_id = ?
    `,
    [president.id],
    `
    ORDER BY
      COALESCE(latest_action_date, p.promise_date) DESC,
      p.title ASC
    `
  );

  const impactRows = await query(
    `
    SELECT
      pout.impact_direction,
      COUNT(*) AS total
    FROM promise_outcomes pout
    JOIN promises p ON p.id = pout.promise_id
    WHERE p.president_id = ?
    GROUP BY pout.impact_direction
    `,
    [president.id]
  );

  const recentActivityRows = await query(
    `
    SELECT
      p.id,
      p.slug,
      p.title,
      p.topic,
      p.status,
      p.summary,
      (
        SELECT pact_latest.title
        FROM promise_actions pact_latest
        WHERE pact_latest.promise_id = p.id
        ORDER BY pact_latest.action_date DESC, pact_latest.id DESC
        LIMIT 1
      ) AS latest_action_title,
      (
        SELECT pact_latest.description
        FROM promise_actions pact_latest
        WHERE pact_latest.promise_id = p.id
        ORDER BY pact_latest.action_date DESC, pact_latest.id DESC
        LIMIT 1
      ) AS latest_action_description,
      (
        SELECT MAX(pact_latest.action_date)
        FROM promise_actions pact_latest
        WHERE pact_latest.promise_id = p.id
      ) AS latest_action_date,
      (
        SELECT pout_latest.impact_direction
        FROM promise_outcomes pout_latest
        WHERE pout_latest.promise_id = p.id
        ORDER BY pout_latest.id DESC
        LIMIT 1
      ) AS latest_impact_direction
    FROM promises p
    WHERE p.president_id = ?
    ORDER BY COALESCE(
      (
        SELECT MAX(pact_latest.action_date)
        FROM promise_actions pact_latest
        WHERE pact_latest.promise_id = p.id
      ),
      p.promise_date
    ) DESC, p.id DESC
    LIMIT 8
    `,
    [president.id]
  );

  const topicBuckets = promiseRows.reduce((bucketMap, promise) => {
    const topic = promise.topic || "Uncategorized";
    if (!bucketMap.has(topic)) {
      bucketMap.set(topic, {
        topic,
        promise_count: 0,
        action_count: 0,
        direction_counts: {
          Positive: 0,
          Negative: 0,
          Mixed: 0,
          Blocked: 0,
        },
      });
    }

    const bucket = bucketMap.get(topic);
    bucket.promise_count += 1;
    bucket.action_count += Number(promise.action_count || 0);
    const direction = normalizePromiseImpactDirection(promise.impact_direction_for_curation);
    if (direction && bucket.direction_counts[direction] !== undefined) {
      bucket.direction_counts[direction] += 1;
    }
    return bucketMap;
  }, new Map());

  const topTopics = [...topicBuckets.values()]
    .sort((left, right) => {
      if (right.action_count !== left.action_count) {
        return right.action_count - left.action_count;
      }
      if (right.promise_count !== left.promise_count) {
        return right.promise_count - left.promise_count;
      }
      return left.topic.localeCompare(right.topic);
    })
    .slice(0, 5)
    .map((topic) => ({
      ...topic,
      summary: summarizeTopicDirection(topic.direction_counts),
    }));

  const featuredSlugs = [
    "trump-2025-promote-hbcu-excellence-and-innovation",
    "trump-2025-end-federal-dei-equity-programs",
    "trump-2025-election-integrity-proof-citizenship-paper-ballots",
    "trump-2025-reinstate-school-discipline-policies",
  ];

  const featuredRecords = [];
  const seenFeaturedSlugs = new Set();

  for (const slug of featuredSlugs) {
    const record = promiseRows.find((promise) => promise.slug === slug);
    if (record) {
      featuredRecords.push(record);
      seenFeaturedSlugs.add(record.slug);
    }
  }

  for (const promise of promiseRows) {
    if (featuredRecords.length >= 4) break;
    if (seenFeaturedSlugs.has(promise.slug)) continue;
    featuredRecords.push(promise);
    seenFeaturedSlugs.add(promise.slug);
  }

  const impactBreakdown = {
    Positive: 0,
    Negative: 0,
    Mixed: 0,
    Blocked: 0,
  };
  const promiseRowBySlug = new Map(promiseRows.map((row) => [row.slug, row]));

  for (const row of impactRows) {
    const direction = normalizePromiseImpactDirection(row.impact_direction);
    if (direction && impactBreakdown[direction] !== undefined) {
      impactBreakdown[direction] = Number(row.total || 0);
    }
  }

  return {
    administration_name: buildAdministrationName(president.president),
    president,
    total_promises: promiseRows.length,
    total_actions: promiseRows.reduce((count, row) => count + Number(row.action_count || 0), 0),
    total_outcomes: promiseRows.reduce((count, row) => count + Number(row.outcome_count || 0), 0),
    impact_breakdown: impactBreakdown,
    recent_activity: recentActivityRows.map((row) => ({
      ...row,
      topic: normalizePromiseTopicLabel(row.topic) || null,
      latest_impact_direction: normalizePromiseImpactDirection(row.latest_impact_direction),
      impact_direction_for_curation:
        normalizePromiseImpactDirection(promiseRowBySlug.get(row.slug)?.impact_direction_for_curation) || null,
      action_count: Number(promiseRowBySlug.get(row.slug)?.action_count || 0),
      outcome_count: Number(promiseRowBySlug.get(row.slug)?.outcome_count || 0),
      source_count: Number(promiseRowBySlug.get(row.slug)?.source_count || 0),
      latest_evidence_strength:
        normalizeString(promiseRowBySlug.get(row.slug)?.latest_evidence_strength) || null,
    })),
    top_topics: topTopics,
    featured_records: featuredRecords.map((record) => ({
      ...record,
      impact_direction_for_curation: normalizePromiseImpactDirection(record.impact_direction_for_curation),
      latest_evidence_strength: normalizeString(record.latest_evidence_strength) || null,
    })),
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
      pr.slug AS president_slug,
      pr.term_start,
      pr.term_end,
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
  promise.president_slug = resolvePromisePresidentSlug(promise);
  promise.topic = normalizePromiseTopicLabel(promise.topic);

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

  const actionIds = actionRows.map((row) => row.id);
  const outcomeIds = outcomeRows.map((row) => row.id);
  const [actionSourcesMap, outcomeSourcesMap] = await Promise.all([
    getActionSources(actionIds),
    getOutcomeSources(outcomeIds),
  ]);

  const actions = actionRows.map((row) => ({
    ...row,
    sources: buildLegacySourceList(actionSourcesMap.get(row.id) || []),
    action_sources: actionSourcesMap.get(row.id) || [],
  }));

  const outcomes = outcomeRows.map((row) => ({
    ...row,
    sources: buildLegacySourceList(outcomeSourcesMap.get(row.id) || []),
    outcome_sources: outcomeSourcesMap.get(row.id) || [],
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

  const relationshipData = await getPromiseRelationships(promise.id);

  return applyPromiseCuration({
    ...promise,
    actions,
    outcomes,
    ...relationshipData,
    related_policies: relatedPolicyRows,
    related_explainers: relatedExplainerRows,
    source_summary: {
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
      pr.slug AS president_slug,
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
      president_slug: resolvePromisePresidentSlug(row),
    })
  );

  return {
    methodology: getPromiseScoreMethodology(),
    items: aggregatePromiseScoresByPresident(curatedRows),
  };
}

export async function fetchPromiseScoreRecords() {
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
      pr.slug AS president_slug,
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
      president_slug: resolvePromisePresidentSlug(row),
    })
  );

  return curatedRows
    .map((row) => scorePromise(row))
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      topic: normalizePromiseTopicLabel(row.topic) || null,
      status: row.status,
      summary: row.summary || null,
      president: row.president,
      president_slug: row.president_slug,
      president_party: row.president_party || null,
      relevance: row.relevance || null,
      impact_direction_for_curation: row.impact_direction_for_curation || null,
      scoring_impact_direction: row.scoring_impact_direction,
      raw_score: Number(row.raw_score.toFixed(2)),
      normalized_score: Number(row.normalized_score.toFixed(4)),
      outcome_multiplier: row.outcome_multiplier,
      latest_action_date: row.latest_action_date || null,
      promise_date: row.promise_date || null,
    }))
    .sort((a, b) => {
      const scoreDiff = Math.abs(b.raw_score) - Math.abs(a.raw_score);
      if (scoreDiff !== 0) return scoreDiff;
      return a.title.localeCompare(b.title);
    });
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
      pr.slug AS president_slug,
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
        president_slug: resolvePromisePresidentSlug(row),
      }),
    ])
  );

  const eras = CIVIL_RIGHTS_TIMELINE_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    description: group.description,
    items: group.slugs
      .map((slug) => rowsBySlug.get(slug))
      .filter(Boolean)
      .sort(compareTimelinePromiseOrder),
  })).filter((group) => group.items.length > 0);

  return {
    items: eras.flatMap((group) => group.items),
    eras,
    curated_slugs: [...CIVIL_RIGHTS_TIMELINE_SLUGS],
  };
}
