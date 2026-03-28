import { getDb, query } from "@/lib/db";

const REVIEW_STATUSES = [
  "pending_review",
  "approved",
  "rejected",
  "promoted",
];

const MUTABLE_REVIEW_STATUSES = new Set([
  "pending_review",
  "approved",
  "rejected",
]);

function normalizeReviewStatus(value) {
  if (!value) {
    return null;
  }

  const normalized = String(value).trim().toLowerCase();
  return REVIEW_STATUSES.includes(normalized) ? normalized : null;
}

function normalizeSlugPart(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function toNullableNumber(value) {
  if (value == null || value === "") {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function buildPublisherName(sourceSystem) {
  if (sourceSystem === "white_house") {
    return "White House";
  }

  return sourceSystem
    ? String(sourceSystem)
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    : null;
}

function buildActionType(rawActionType) {
  const normalized = String(rawActionType || "").trim();
  const allowed = new Set([
    "Executive Order",
    "Bill",
    "Policy",
    "Agency Action",
    "Court-Related Action",
    "Public Reversal",
    "Statement",
    "Other",
  ]);

  if (allowed.has(normalized)) {
    return normalized;
  }

  if (normalized === "Bill Signing") {
    return "Bill";
  }

  if (normalized === "Memorandum" || normalized === "Proclamation") {
    return "Other";
  }

  return "Other";
}

function normalizePromiseRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    slug: row.slug,
    title: row.title,
    status: row.status,
    promise_type: row.promise_type,
    campaign_or_official: row.campaign_or_official,
    topic: row.topic || null,
    promise_date: row.promise_date || null,
    president_id: row.president_id == null ? null : Number(row.president_id),
    president: row.president || null,
    president_slug: row.president_slug || null,
    match_reason: row.match_reason || null,
  };
}

function normalizeSourceRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    source_title: row.source_title,
    source_url: row.source_url,
    source_type: row.source_type,
    publisher: row.publisher || null,
    published_date: row.published_date || null,
    notes: row.notes || null,
    policy_id: toNullableNumber(row.policy_id),
  };
}

function normalizeStagedItem(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    president_id: Number(row.president_id),
    president: row.president,
    president_slug: row.president_slug,
    source_system: row.source_system,
    source_category: row.source_category,
    canonical_url: row.canonical_url,
    official_identifier: row.official_identifier || null,
    raw_action_type: row.raw_action_type || null,
    title: row.title,
    publication_date: row.publication_date || null,
    action_date: row.action_date || null,
    summary_excerpt: row.summary_excerpt || null,
    discovered_at: row.discovered_at || null,
    last_seen_at: row.last_seen_at || null,
    dedupe_key: row.dedupe_key,
    review_status: row.review_status,
    review_notes: row.review_notes || null,
    raw_payload_json: row.raw_payload_json || null,
    promoted_promise_id: toNullableNumber(row.promoted_promise_id),
    promoted_action_id: toNullableNumber(row.promoted_action_id),
    promoted_source_id: toNullableNumber(row.promoted_source_id),
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

function buildReviewNotes(existingNotes, nextNotes) {
  const current = String(existingNotes || "").trim();
  const incoming = String(nextNotes || "").trim();

  if (!incoming) {
    return current || null;
  }

  if (!current) {
    return incoming;
  }

  return `${current}\n\n${incoming}`;
}

async function fetchPromiseCandidates(stagedItem) {
  if (!stagedItem) {
    return [];
  }

  const rows = await query(
    `
    SELECT DISTINCT
      p.id,
      p.slug,
      p.title,
      p.status,
      p.promise_type,
      p.campaign_or_official,
      p.topic,
      p.promise_date,
      p.president_id,
      pr.full_name AS president,
      pr.slug AS president_slug,
      CASE
        WHEN LOWER(p.title) = LOWER(?) THEN 'Exact title match'
        WHEN EXISTS (
          SELECT 1
          FROM promise_sources ps
          JOIN sources s ON s.id = ps.source_id
          WHERE ps.promise_id = p.id
            AND s.source_url = ?
        ) THEN 'Existing promise source URL match'
        WHEN EXISTS (
          SELECT 1
          FROM promise_actions pa
          JOIN promise_action_sources pas ON pas.promise_action_id = pa.id
          JOIN sources s ON s.id = pas.source_id
          WHERE pa.promise_id = p.id
            AND s.source_url = ?
        ) THEN 'Existing action source URL match'
        ELSE NULL
      END AS match_reason
    FROM promises p
    JOIN presidents pr ON pr.id = p.president_id
    WHERE p.president_id = ?
    HAVING match_reason IS NOT NULL
    ORDER BY
      FIELD(match_reason, 'Existing action source URL match', 'Existing promise source URL match', 'Exact title match'),
      p.promise_date DESC,
      p.id DESC
    `,
    [
      stagedItem.title,
      stagedItem.canonical_url,
      stagedItem.canonical_url,
      stagedItem.president_id,
    ]
  );

  return rows.map(normalizePromiseRow);
}

async function fetchSourceCandidate(stagedItem) {
  if (!stagedItem?.canonical_url) {
    return null;
  }

  const rows = await query(
    `
    SELECT
      id,
      policy_id,
      source_title,
      source_url,
      source_type,
      publisher,
      published_date,
      notes
    FROM sources
    WHERE source_url = ?
    ORDER BY id ASC
    LIMIT 1
    `,
    [stagedItem.canonical_url]
  );

  return normalizeSourceRow(rows[0] || null);
}

async function getExistingPromiseById(promiseId, presidentId = null) {
  const params = [Number(promiseId)];
  let presidentClause = "";

  if (presidentId != null) {
    presidentClause = " AND p.president_id = ?";
    params.push(Number(presidentId));
  }

  const rows = await query(
    `
    SELECT
      p.id,
      p.slug,
      p.title,
      p.status,
      p.promise_type,
      p.campaign_or_official,
      p.topic,
      p.promise_date,
      p.president_id,
      pr.full_name AS president,
      pr.slug AS president_slug
    FROM promises p
    JOIN presidents pr ON pr.id = p.president_id
    WHERE p.id = ?
      ${presidentClause}
    LIMIT 1
    `,
    params
  );

  return normalizePromiseRow(rows[0] || null);
}

async function generateUniquePromiseSlug(connection, presidentSlug, title) {
  const base = [presidentSlug, normalizeSlugPart(title)].filter(Boolean).join("-");
  const normalizedBase = base || `promise-${Date.now()}`;
  let candidate = normalizedBase;
  let suffix = 2;

  while (true) {
    const [rows] = await connection.query(
      `
      SELECT id
      FROM promises
      WHERE slug = ?
      LIMIT 1
      `,
      [candidate]
    );

    if (!rows.length) {
      return candidate;
    }

    candidate = `${normalizedBase}-${suffix}`;
    suffix += 1;
  }
}

async function fetchStagedItemWithContext(connection, id) {
  const [rows] = await connection.query(
    `
    SELECT
      s.*,
      pr.full_name AS president,
      pr.slug AS president_slug
    FROM current_administration_staging_items s
    JOIN presidents pr ON pr.id = s.president_id
    WHERE s.id = ?
    LIMIT 1
    `,
    [id]
  );

  return normalizeStagedItem(rows[0] || null);
}

export async function listStagedCurrentAdministrationItems({
  status,
  presidentId,
  limit = 50,
} = {}) {
  const clauses = [];
  const params = [];
  const normalizedStatus = normalizeReviewStatus(status);

  if (normalizedStatus) {
    clauses.push("s.review_status = ?");
    params.push(normalizedStatus);
  }

  if (presidentId != null) {
    clauses.push("s.president_id = ?");
    params.push(Number(presidentId));
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  params.push(safeLimit);

  const rows = await query(
    `
    SELECT
      s.*,
      pr.full_name AS president,
      pr.slug AS president_slug
    FROM current_administration_staging_items s
    JOIN presidents pr ON pr.id = s.president_id
    ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
    ORDER BY
      FIELD(s.review_status, 'pending_review', 'approved', 'rejected', 'promoted'),
      COALESCE(s.publication_date, s.action_date) DESC,
      s.id DESC
    LIMIT ?
    `,
    params
  );

  return rows.map(normalizeStagedItem);
}

export async function getStagedCurrentAdministrationItem(id) {
  const rows = await query(
    `
    SELECT
      s.*,
      pr.full_name AS president,
      pr.slug AS president_slug
    FROM current_administration_staging_items s
    JOIN presidents pr ON pr.id = s.president_id
    WHERE s.id = ?
    LIMIT 1
    `,
    [id]
  );

  return normalizeStagedItem(rows[0] || null);
}

export async function updateStagedCurrentAdministrationItemReviewStatus(
  id,
  { status, reviewNotes } = {}
) {
  const normalizedStatus = normalizeReviewStatus(status);
  if (!normalizedStatus || !MUTABLE_REVIEW_STATUSES.has(normalizedStatus)) {
    throw new Error("Invalid review status");
  }

  const existing = await getStagedCurrentAdministrationItem(id);
  if (!existing) {
    throw new Error("Staged item not found");
  }

  await query(
    `
    UPDATE current_administration_staging_items
    SET
      review_status = ?,
      review_notes = ?,
      updated_at = CURRENT_TIMESTAMP()
    WHERE id = ?
    `,
    [
      normalizedStatus,
      buildReviewNotes(existing.review_notes, reviewNotes),
      id,
    ]
  );

  return getStagedCurrentAdministrationItem(id);
}

export async function buildPromisePromotionDraftFromStagedItem(id, options = {}) {
  const stagedItem = await getStagedCurrentAdministrationItem(id);

  if (!stagedItem) {
    return null;
  }

  const possibleMatches = await fetchPromiseCandidates(stagedItem);
  const selectedExistingPromise = options.existingPromiseId
    ? await getExistingPromiseById(options.existingPromiseId, stagedItem.president_id)
    : null;
  const defaultExistingPromise = selectedExistingPromise || possibleMatches[0] || null;
  const existingSource = await fetchSourceCandidate(stagedItem);
  const targetMode = defaultExistingPromise ? "attach_to_existing" : "create_new";
  const effectiveDate = stagedItem.action_date || stagedItem.publication_date || null;

  return {
    staged_item: stagedItem,
    match_assessment: {
      type: defaultExistingPromise ? "update_candidate" : "new_record_candidate",
      summary: defaultExistingPromise
        ? "This staged item has a cautious existing-record match for manual review."
        : "This staged item looks like a new Promise Tracker record candidate.",
      possible_matches: possibleMatches,
      selected_existing_promise_id: defaultExistingPromise?.id || null,
    },
    target_mode: targetMode,
    existing_promise: defaultExistingPromise,
    draft_promise:
      targetMode === "create_new"
        ? {
            president_id: stagedItem.president_id,
            president: stagedItem.president,
            president_slug: stagedItem.president_slug,
            title: stagedItem.title,
            promise_text:
              stagedItem.summary_excerpt ||
              `Promoted from staged ${stagedItem.source_category} item.`,
            promise_date: effectiveDate,
            promise_type: "Official Promise",
            campaign_or_official: "Official",
            topic: null,
            impacted_group: null,
            status: "In Progress",
            summary: stagedItem.summary_excerpt,
            notes: `Promoted manually from current-administration staging item ${stagedItem.id}.`,
          }
        : null,
    draft_action: {
      action_type: buildActionType(stagedItem.raw_action_type),
      action_date: effectiveDate,
      title: stagedItem.title,
      description: stagedItem.summary_excerpt,
    },
    source_linkage: {
      existing_source: existingSource,
      proposed_source: existingSource
        ? null
        : {
            source_title: stagedItem.title,
            source_url: stagedItem.canonical_url,
            source_type: "Government",
            publisher: buildPublisherName(stagedItem.source_system),
            published_date: stagedItem.publication_date,
            notes: `Created during manual promotion from current-administration staging item ${stagedItem.id}.`,
          },
      linkage_level: "action",
    },
    promotion_notes: [
      "Promotion creates a promise shell when needed, one action row, and one linked source.",
      "Promotion does not create outcomes or scoring metadata automatically.",
    ],
  };
}

export async function promoteStagedCurrentAdministrationItem(
  id,
  { existingPromiseId, reviewNotes } = {}
) {
  const db = getDb();
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const stagedItem = await fetchStagedItemWithContext(connection, id);
    if (!stagedItem) {
      throw new Error("Staged item not found");
    }

    if (stagedItem.review_status === "promoted") {
      throw new Error("Staged item is already promoted");
    }

    if (stagedItem.review_status !== "approved") {
      throw new Error("Only approved staged items can be promoted");
    }

    let promise = existingPromiseId
      ? await getExistingPromiseById(existingPromiseId, stagedItem.president_id)
      : null;

    const effectiveDate = stagedItem.action_date || stagedItem.publication_date || null;

    if (!promise) {
      const promiseSlug = await generateUniquePromiseSlug(
        connection,
        stagedItem.president_slug,
        stagedItem.title
      );

      const [promiseResult] = await connection.query(
        `
        INSERT INTO promises (
          president_id,
          title,
          slug,
          promise_text,
          promise_date,
          promise_type,
          campaign_or_official,
          topic,
          impacted_group,
          status,
          summary,
          notes,
          is_demo
        )
        VALUES (?, ?, ?, ?, ?, 'Official Promise', 'Official', NULL, NULL, 'In Progress', ?, ?, 0)
        `,
        [
          stagedItem.president_id,
          stagedItem.title,
          promiseSlug,
          stagedItem.summary_excerpt || stagedItem.title,
          effectiveDate,
          stagedItem.summary_excerpt,
          `Promoted manually from current-administration staging item ${stagedItem.id}.`,
        ]
      );

      promise = {
        id: Number(promiseResult.insertId),
      };
    }

    const [actionResult] = await connection.query(
      `
      INSERT INTO promise_actions (
        promise_id,
        action_type,
        action_date,
        title,
        description
      )
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        promise.id,
        buildActionType(stagedItem.raw_action_type),
        effectiveDate,
        stagedItem.title,
        stagedItem.summary_excerpt,
      ]
    );
    const actionId = Number(actionResult.insertId);

    const [sourceRows] = await connection.query(
      `
      SELECT id
      FROM sources
      WHERE source_url = ?
      ORDER BY id ASC
      LIMIT 1
      `,
      [stagedItem.canonical_url]
    );

    let sourceId;
    if (sourceRows.length > 0) {
      sourceId = Number(sourceRows[0].id);
    } else {
      const [sourceResult] = await connection.query(
        `
        INSERT INTO sources (
          policy_id,
          source_title,
          source_url,
          source_type,
          publisher,
          published_date,
          notes
        )
        VALUES (NULL, ?, ?, 'Government', ?, ?, ?)
        `,
        [
          stagedItem.title,
          stagedItem.canonical_url,
          buildPublisherName(stagedItem.source_system),
          stagedItem.publication_date,
          `Created during manual promotion from current-administration staging item ${stagedItem.id}.`,
        ]
      );
      sourceId = Number(sourceResult.insertId);
    }

    await connection.query(
      `
      INSERT IGNORE INTO promise_action_sources (promise_action_id, source_id)
      VALUES (?, ?)
      `,
      [actionId, sourceId]
    );

    await connection.query(
      `
      UPDATE current_administration_staging_items
      SET
        review_status = 'promoted',
        review_notes = ?,
        promoted_promise_id = ?,
        promoted_action_id = ?,
        promoted_source_id = ?,
        updated_at = CURRENT_TIMESTAMP()
      WHERE id = ?
      `,
      [
        buildReviewNotes(stagedItem.review_notes, reviewNotes),
        promise.id,
        actionId,
        sourceId,
        id,
      ]
    );

    await connection.commit();

    return getStagedCurrentAdministrationItem(id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export { REVIEW_STATUSES };
