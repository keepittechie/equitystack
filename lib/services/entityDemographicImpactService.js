import { getDb, query } from "@/lib/db";

const VALID_ENTITY_TYPES = new Set(["policy", "promise", "tracked_bill"]);
const VALID_SOURCE_ROLES = new Set(["primary", "supporting", "methodology", "context"]);

const ENTITY_TABLES = {
  policy: "policies",
  promise: "promises",
  tracked_bill: "tracked_bills",
};

function createServiceError(message, code, status) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function getExecutor(connection = null) {
  return connection || getDb();
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableString(value) {
  const normalized = normalizeString(value);
  return normalized || null;
}

function normalizeNullableNumber(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeNullableInteger(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const numeric = Number(value);
  return Number.isInteger(numeric) ? numeric : null;
}

function normalizeEntityType(value) {
  const entityType = normalizeString(value);
  if (!VALID_ENTITY_TYPES.has(entityType)) {
    throw createServiceError(
      "entity_type must be one of: policy, promise, tracked_bill",
      "invalid_entity_type",
      400
    );
  }
  return entityType;
}

function normalizeEntityId(value) {
  const entityId = Number(value);
  if (!Number.isInteger(entityId) || entityId <= 0) {
    throw createServiceError(
      "entity_id must be a positive integer",
      "invalid_entity_id",
      400
    );
  }
  return entityId;
}

function normalizeImpactId(value) {
  const impactId = Number(value);
  if (!Number.isInteger(impactId) || impactId <= 0) {
    throw createServiceError(
      "impact_id must be a positive integer",
      "invalid_impact_id",
      400
    );
  }
  return impactId;
}

function normalizeSourceId(value) {
  const sourceId = Number(value);
  if (!Number.isInteger(sourceId) || sourceId <= 0) {
    throw createServiceError(
      "source_id must be a positive integer",
      "invalid_source_id",
      400
    );
  }
  return sourceId;
}

function normalizeConfidenceScore(value) {
  const score = normalizeNullableNumber(value);
  if (score === null) {
    return null;
  }

  if (score < 0 || score > 1) {
    throw createServiceError(
      "confidence_score must be between 0 and 1",
      "invalid_confidence_score",
      400
    );
  }

  return score;
}

function normalizeSourceRole(value) {
  const sourceRole = normalizeString(value) || "supporting";
  if (!VALID_SOURCE_ROLES.has(sourceRole)) {
    throw createServiceError(
      "source_role must be one of: primary, supporting, methodology, context",
      "invalid_source_role",
      400
    );
  }
  return sourceRole;
}

function normalizeSourceLinkPayloads(value) {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw createServiceError(
      "sources must be an array when provided",
      "invalid_sources_payload",
      400
    );
  }

  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw createServiceError(
        `sources[${index}] must be an object`,
        "invalid_source_link_payload",
        400
      );
    }

    return {
      source_id: normalizeSourceId(entry.source_id),
      source_role: normalizeSourceRole(entry.source_role),
      citation_note: normalizeNullableString(entry.citation_note),
    };
  });
}

async function ensureEntityExists(entityType, entityId, connection = null) {
  const tableName = ENTITY_TABLES[entityType];
  const executor = getExecutor(connection);
  const [rows] = await executor.execute(
    `
    SELECT id
    FROM ${tableName}
    WHERE id = ?
    LIMIT 1
    `,
    [entityId]
  );

  if (!rows.length) {
    throw createServiceError(
      `${entityType} ${entityId} was not found`,
      "entity_not_found",
      404
    );
  }
}

async function ensureImpactExists(impactId, connection = null) {
  const executor = getExecutor(connection);
  const [rows] = await executor.execute(
    `
    SELECT id
    FROM entity_demographic_impacts
    WHERE id = ?
    LIMIT 1
    `,
    [impactId]
  );

  if (!rows.length) {
    throw createServiceError(
      `impact ${impactId} was not found`,
      "impact_not_found",
      404
    );
  }
}

async function ensureSourceExists(sourceId, connection = null) {
  const executor = getExecutor(connection);
  const [rows] = await executor.execute(
    `
    SELECT id
    FROM sources
    WHERE id = ?
    LIMIT 1
    `,
    [sourceId]
  );

  if (!rows.length) {
    throw createServiceError(
      `source ${sourceId} was not found`,
      "source_not_found",
      404
    );
  }
}

function normalizeImpactRow(row) {
  return {
    id: Number(row.id),
    entity_type: row.entity_type,
    entity_id: Number(row.entity_id),
    demographic_group: row.demographic_group,
    metric_name: row.metric_name,
    before_value: row.before_value == null ? null : Number(row.before_value),
    after_value: row.after_value == null ? null : Number(row.after_value),
    comparison_value: row.comparison_value == null ? null : Number(row.comparison_value),
    unit: row.unit,
    geography: row.geography,
    period_start: row.period_start,
    period_end: row.period_end,
    year_before: row.year_before == null ? null : Number(row.year_before),
    year_after: row.year_after == null ? null : Number(row.year_after),
    disparity_ratio: row.disparity_ratio == null ? null : Number(row.disparity_ratio),
    confidence_score: row.confidence_score == null ? null : Number(row.confidence_score),
    methodology_note: row.methodology_note,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizeImpactSourceRow(row) {
  return {
    id: Number(row.source_id),
    impact_source_id: Number(row.impact_source_id),
    source_title: row.source_title,
    source_url: row.source_url,
    source_type: row.source_type,
    publisher: row.publisher,
    published_date: row.published_date,
    notes: row.notes,
    source_role: row.source_role,
    citation_note: row.citation_note,
    linked_at: row.linked_at,
    updated_at: row.link_updated_at,
  };
}

async function fetchImpactRows(entityType, entityId) {
  return query(
    `
    SELECT
      id,
      entity_type,
      entity_id,
      demographic_group,
      metric_name,
      before_value,
      after_value,
      comparison_value,
      unit,
      geography,
      period_start,
      period_end,
      year_before,
      year_after,
      disparity_ratio,
      confidence_score,
      methodology_note,
      created_at,
      updated_at
    FROM entity_demographic_impacts
    WHERE entity_type = ?
      AND entity_id = ?
    ORDER BY
      demographic_group ASC,
      metric_name ASC,
      COALESCE(period_end, period_start) DESC,
      COALESCE(year_after, year_before) DESC,
      id ASC
    `,
    [entityType, entityId]
  );
}

async function fetchSourceRowsForImpactIds(impactIds = []) {
  if (!impactIds.length) {
    return new Map();
  }

  const rows = await query(
    `
    SELECT
      j.id AS impact_source_id,
      j.impact_id,
      j.source_id,
      j.source_role,
      j.citation_note,
      j.created_at AS linked_at,
      j.updated_at AS link_updated_at,
      s.source_title,
      s.source_url,
      s.source_type,
      s.publisher,
      s.published_date,
      s.notes
    FROM entity_demographic_impact_sources j
    JOIN sources s ON s.id = j.source_id
    WHERE j.impact_id IN (${impactIds.map(() => "?").join(", ")})
    ORDER BY
      j.impact_id ASC,
      FIELD(j.source_role, 'primary', 'supporting', 'methodology', 'context') ASC,
      s.published_date DESC,
      s.id ASC
    `,
    impactIds
  );

  const grouped = new Map();

  for (const row of rows) {
    const impactId = Number(row.impact_id);
    if (!grouped.has(impactId)) {
      grouped.set(impactId, []);
    }
    grouped.get(impactId).push(normalizeImpactSourceRow(row));
  }

  return grouped;
}

async function fetchImpactById(impactId, options = {}) {
  const normalizedImpactId = normalizeImpactId(impactId);
  const rows = await query(
    `
    SELECT
      id,
      entity_type,
      entity_id,
      demographic_group,
      metric_name,
      before_value,
      after_value,
      comparison_value,
      unit,
      geography,
      period_start,
      period_end,
      year_before,
      year_after,
      disparity_ratio,
      confidence_score,
      methodology_note,
      created_at,
      updated_at
    FROM entity_demographic_impacts
    WHERE id = ?
    LIMIT 1
    `,
    [normalizedImpactId]
  );

  if (!rows.length) {
    return null;
  }

  const impact = normalizeImpactRow(rows[0]);

  if (!options.includeSources) {
    return impact;
  }

  const sourceMap = await fetchSourceRowsForImpactIds([impact.id]);
  return {
    ...impact,
    sources: sourceMap.get(impact.id) || [],
  };
}

export async function fetchSourcesForImpact(impactId) {
  const normalizedImpactId = normalizeImpactId(impactId);
  await ensureImpactExists(normalizedImpactId);
  const sourceMap = await fetchSourceRowsForImpactIds([normalizedImpactId]);
  return sourceMap.get(normalizedImpactId) || [];
}

export async function fetchEntityDemographicImpacts(entityType, entityId, options = {}) {
  const normalizedEntityType = normalizeEntityType(entityType);
  const normalizedEntityId = normalizeEntityId(entityId);
  const rows = await fetchImpactRows(normalizedEntityType, normalizedEntityId);
  const impacts = rows.map(normalizeImpactRow);

  if (!options.includeSources || !impacts.length) {
    return impacts;
  }

  const sourceMap = await fetchSourceRowsForImpactIds(impacts.map((impact) => impact.id));
  return impacts.map((impact) => ({
    ...impact,
    sources: sourceMap.get(impact.id) || [],
  }));
}

export async function attachSourceToImpact(payload = {}, connection = null) {
  const impactId = normalizeImpactId(payload.impact_id);
  const sourceId = normalizeSourceId(payload.source_id);
  const sourceRole = normalizeSourceRole(payload.source_role);
  const citationNote = normalizeNullableString(payload.citation_note);
  const executor = getExecutor(connection);

  await ensureImpactExists(impactId, connection);
  await ensureSourceExists(sourceId, connection);

  await executor.execute(
    `
    INSERT INTO entity_demographic_impact_sources (
      impact_id,
      source_id,
      source_role,
      citation_note
    )
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      source_role = VALUES(source_role),
      citation_note = VALUES(citation_note),
      updated_at = CURRENT_TIMESTAMP(3)
    `,
    [impactId, sourceId, sourceRole, citationNote]
  );

  const [rows] = await executor.execute(
    `
    SELECT
      j.id AS impact_source_id,
      j.impact_id,
      j.source_id,
      j.source_role,
      j.citation_note,
      j.created_at AS linked_at,
      j.updated_at AS link_updated_at,
      s.source_title,
      s.source_url,
      s.source_type,
      s.publisher,
      s.published_date,
      s.notes
    FROM entity_demographic_impact_sources j
    JOIN sources s ON s.id = j.source_id
    WHERE j.impact_id = ?
      AND j.source_id = ?
    LIMIT 1
    `,
    [impactId, sourceId]
  );

  return rows.length ? normalizeImpactSourceRow(rows[0]) : null;
}

export async function createEntityDemographicImpact(payload = {}) {
  const entityType = normalizeEntityType(payload.entity_type);
  const entityId = normalizeEntityId(payload.entity_id);
  const demographicGroup = normalizeString(payload.demographic_group);
  const metricName = normalizeString(payload.metric_name);
  const sourceLinks = normalizeSourceLinkPayloads(payload.sources);

  if (!demographicGroup) {
    throw createServiceError(
      "demographic_group is required",
      "demographic_group_required",
      400
    );
  }

  if (!metricName) {
    throw createServiceError(
      "metric_name is required",
      "metric_name_required",
      400
    );
  }

  const insertPayload = {
    entity_type: entityType,
    entity_id: entityId,
    demographic_group: demographicGroup,
    metric_name: metricName,
    before_value: normalizeNullableNumber(payload.before_value),
    after_value: normalizeNullableNumber(payload.after_value),
    comparison_value: normalizeNullableNumber(payload.comparison_value),
    unit: normalizeNullableString(payload.unit),
    geography: normalizeNullableString(payload.geography),
    period_start: normalizeNullableString(payload.period_start),
    period_end: normalizeNullableString(payload.period_end),
    year_before: normalizeNullableInteger(payload.year_before),
    year_after: normalizeNullableInteger(payload.year_after),
    disparity_ratio: normalizeNullableNumber(payload.disparity_ratio),
    confidence_score: normalizeConfidenceScore(payload.confidence_score),
    methodology_note: normalizeNullableString(payload.methodology_note),
  };

  const connection = await getDb().getConnection();

  try {
    await connection.beginTransaction();
    await ensureEntityExists(entityType, entityId, connection);

    const [result] = await connection.execute(
      `
      INSERT INTO entity_demographic_impacts (
        entity_type,
        entity_id,
        demographic_group,
        metric_name,
        before_value,
        after_value,
        comparison_value,
        unit,
        geography,
        period_start,
        period_end,
        year_before,
        year_after,
        disparity_ratio,
        confidence_score,
        methodology_note
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        insertPayload.entity_type,
        insertPayload.entity_id,
        insertPayload.demographic_group,
        insertPayload.metric_name,
        insertPayload.before_value,
        insertPayload.after_value,
        insertPayload.comparison_value,
        insertPayload.unit,
        insertPayload.geography,
        insertPayload.period_start,
        insertPayload.period_end,
        insertPayload.year_before,
        insertPayload.year_after,
        insertPayload.disparity_ratio,
        insertPayload.confidence_score,
        insertPayload.methodology_note,
      ]
    );

    const insertedId = Number(result.insertId || 0);

    for (const sourceLink of sourceLinks) {
      await attachSourceToImpact(
        {
          impact_id: insertedId,
          ...sourceLink,
        },
        connection
      );
    }

    await connection.commit();
    return fetchImpactById(insertedId, { includeSources: true });
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}
