import { getDb, query } from "@/lib/db";

function toNullableNumber(value) {
  if (value == null || value === "") {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizePromiseRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    president_id: Number(row.president_id),
    president: row.president,
    president_slug: row.president_slug,
    president_party: row.president_party || null,
    title: row.title,
    slug: row.slug,
    promise_text: row.promise_text,
    promise_date: row.promise_date || null,
    promise_type: row.promise_type,
    campaign_or_official: row.campaign_or_official,
    topic: row.topic || null,
    impacted_group: row.impacted_group || null,
    status: row.status,
    summary: row.summary || null,
    notes: row.notes || null,
  };
}

function normalizeSourceRow(row) {
  return {
    id: Number(row.id),
    source_title: row.source_title,
    source_url: row.source_url,
    source_type: row.source_type,
    publisher: row.publisher || null,
    published_date: row.published_date || null,
    notes: row.notes || null,
  };
}

function normalizeActionRow(row, sources = []) {
  return {
    id: Number(row.id),
    promise_id: Number(row.promise_id),
    action_type: row.action_type,
    action_date: row.action_date || null,
    title: row.title,
    description: row.description || null,
    related_policy_id: toNullableNumber(row.related_policy_id),
    related_explainer_id: toNullableNumber(row.related_explainer_id),
    related_policy_title: row.related_policy_title || null,
    related_explainer_slug: row.related_explainer_slug || null,
    related_explainer_title: row.related_explainer_title || null,
    sources,
  };
}

function normalizeOutcomeRow(row, sources = []) {
  return {
    id: Number(row.id),
    promise_id: Number(row.promise_id),
    outcome_summary: row.outcome_summary,
    outcome_type: row.outcome_type,
    measurable_impact: row.measurable_impact || null,
    impact_direction: row.impact_direction || null,
    black_community_impact_note: row.black_community_impact_note || null,
    evidence_strength: row.evidence_strength || null,
    status_override: row.status_override || null,
    affected_groups: row.affected_groups || null,
    outcome_date: row.outcome_date || null,
    outcome_timeframe: row.outcome_timeframe || null,
    sources,
  };
}

function computeScoringReadiness(outcomes = []) {
  const hasOutcome = outcomes.length > 0;
  const outcomesMissingDescription = outcomes.filter(
    (outcome) => !String(outcome.outcome_summary || "").trim()
  );
  const outcomesMissingDirection = outcomes.filter(
    (outcome) => !String(outcome.impact_direction || "").trim()
  );
  const outcomesMissingSource = outcomes.filter(
    (outcome) => !Array.isArray(outcome.sources) || outcome.sources.length === 0
  );

  const checks = [
    {
      key: "has_outcome",
      label: "At least one outcome exists",
      passed: hasOutcome,
    },
    {
      key: "outcome_description",
      label: "Each outcome has a description",
      passed: hasOutcome && outcomesMissingDescription.length === 0,
    },
    {
      key: "impact_direction",
      label: "Each outcome has an impact direction",
      passed: hasOutcome && outcomesMissingDirection.length === 0,
    },
    {
      key: "outcome_sources",
      label: "Each outcome has at least one source",
      passed: hasOutcome && outcomesMissingSource.length === 0,
    },
  ];

  const outcomeIssues = outcomes
    .map((outcome) => {
      const issues = [];

      if (!String(outcome.outcome_summary || "").trim()) {
        issues.push("Description missing");
      }

      if (!String(outcome.impact_direction || "").trim()) {
        issues.push("Impact direction missing");
      }

      if (!Array.isArray(outcome.sources) || outcome.sources.length === 0) {
        issues.push("No linked source");
      }

      if (!issues.length) {
        return null;
      }

      return {
        outcome_id: outcome.id,
        title: outcome.outcome_summary || `Outcome #${outcome.id}`,
        issues,
      };
    })
    .filter(Boolean);

  return {
    is_ready: checks.every((check) => check.passed),
    summary: checks.every((check) => check.passed)
      ? "This promise is scoring-ready."
      : "This promise still needs editorial enrichment before it is scoring-ready.",
    checks,
    outcome_issues: outcomeIssues,
  };
}

async function getActionSources(actionIds = []) {
  if (!actionIds.length) {
    return new Map();
  }

  const placeholders = actionIds.map(() => "?").join(", ");
  const rows = await query(
    `
    SELECT
      pas.promise_action_id,
      s.id,
      s.source_title,
      s.source_url,
      s.source_type,
      s.publisher,
      s.published_date,
      s.notes
    FROM promise_action_sources pas
    JOIN sources s ON s.id = pas.source_id
    WHERE pas.promise_action_id IN (${placeholders})
    ORDER BY pas.promise_action_id ASC, s.id ASC
    `,
    actionIds
  );

  const map = new Map();
  for (const row of rows) {
    const key = Number(row.promise_action_id);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(normalizeSourceRow(row));
  }

  return map;
}

async function getOutcomeSources(outcomeIds = []) {
  if (!outcomeIds.length) {
    return new Map();
  }

  const placeholders = outcomeIds.map(() => "?").join(", ");
  const rows = await query(
    `
    SELECT
      pos.promise_outcome_id,
      s.id,
      s.source_title,
      s.source_url,
      s.source_type,
      s.publisher,
      s.published_date,
      s.notes
    FROM promise_outcome_sources pos
    JOIN sources s ON s.id = pos.source_id
    WHERE pos.promise_outcome_id IN (${placeholders})
    ORDER BY pos.promise_outcome_id ASC, s.id ASC
    `,
    outcomeIds
  );

  const map = new Map();
  for (const row of rows) {
    const key = Number(row.promise_outcome_id);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(normalizeSourceRow(row));
  }

  return map;
}

async function getPromiseSources(promiseId) {
  const rows = await query(
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
    ORDER BY s.id ASC
    `,
    [promiseId]
  );

  return rows.map(normalizeSourceRow);
}

async function getAvailableSourcesForPromise(promiseId) {
  const rows = await query(
    `
    SELECT DISTINCT
      s.id,
      s.source_title,
      s.source_url,
      s.source_type,
      s.publisher,
      s.published_date,
      s.notes
    FROM sources s
    JOIN (
      SELECT ps.source_id
      FROM promise_sources ps
      WHERE ps.promise_id = ?

      UNION

      SELECT pas.source_id
      FROM promise_action_sources pas
      JOIN promise_actions pa ON pa.id = pas.promise_action_id
      WHERE pa.promise_id = ?

      UNION

      SELECT pos.source_id
      FROM promise_outcome_sources pos
      JOIN promise_outcomes po ON po.id = pos.promise_outcome_id
      WHERE po.promise_id = ?
    ) linked ON linked.source_id = s.id
    ORDER BY s.id ASC
    `,
    [promiseId, promiseId, promiseId]
  );

  return rows.map(normalizeSourceRow);
}

async function resolveSourceIds(connection, sources = []) {
  const sourceIds = [];
  const seenIds = new Set();
  const seenUrls = new Set();

  for (const source of sources) {
    if (source.id) {
      const numericId = Number(source.id);
      if (!seenIds.has(numericId)) {
        seenIds.add(numericId);
        sourceIds.push(numericId);
      }
      continue;
    }

    const normalizedUrl = String(source.source_url || "").trim();
    if (!normalizedUrl) {
      continue;
    }

    if (seenUrls.has(normalizedUrl)) {
      continue;
    }

    seenUrls.add(normalizedUrl);

    const [existingSourceRows] = await connection.query(
      `
      SELECT id
      FROM sources
      WHERE source_url = ?
      ORDER BY id ASC
      LIMIT 1
      `,
      [normalizedUrl]
    );

    if (existingSourceRows.length > 0) {
      const existingId = Number(existingSourceRows[0].id);
      if (!seenIds.has(existingId)) {
        seenIds.add(existingId);
        sourceIds.push(existingId);
      }
      continue;
    }

    const [insertResult] = await connection.query(
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
      VALUES (NULL, ?, ?, ?, ?, ?, ?)
      `,
      [
        source.source_title,
        normalizedUrl,
        source.source_type,
        source.publisher || null,
        source.published_date || null,
        source.notes || null,
      ]
    );

    const insertedId = Number(insertResult.insertId);
    seenIds.add(insertedId);
    sourceIds.push(insertedId);
  }

  return sourceIds;
}

async function upsertOutcomeDetails(connection, outcomeId, details = {}) {
  const hasDetails = [
    details.affected_groups,
    details.outcome_date,
    details.outcome_timeframe,
  ].some((value) => value != null && value !== "");

  if (!hasDetails) {
    await connection.query(
      `DELETE FROM promise_outcome_details WHERE promise_outcome_id = ?`,
      [outcomeId]
    );
    return;
  }

  await connection.query(
    `
    INSERT INTO promise_outcome_details (
      promise_outcome_id,
      affected_groups,
      outcome_date,
      outcome_timeframe
    )
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      affected_groups = VALUES(affected_groups),
      outcome_date = VALUES(outcome_date),
      outcome_timeframe = VALUES(outcome_timeframe),
      updated_at = CURRENT_TIMESTAMP()
    `,
    [
      outcomeId,
      details.affected_groups || null,
      details.outcome_date || null,
      details.outcome_timeframe || null,
    ]
  );
}

async function ensurePromiseExists(promiseId) {
  const rows = await query(
    `
    SELECT
      p.id,
      p.president_id,
      pr.full_name AS president,
      pr.slug AS president_slug,
      pa.name AS president_party,
      p.title,
      p.slug,
      p.promise_text,
      p.promise_date,
      p.promise_type,
      p.campaign_or_official,
      p.topic,
      p.impacted_group,
      p.status,
      p.summary,
      p.notes
    FROM promises p
    JOIN presidents pr ON pr.id = p.president_id
    LEFT JOIN parties pa ON pa.id = pr.party_id
    WHERE p.id = ?
    LIMIT 1
    `,
    [promiseId]
  );

  return normalizePromiseRow(rows[0] || null);
}

export async function fetchAdminPromiseDetail(id) {
  const promise = await ensurePromiseExists(id);
  if (!promise) {
    return null;
  }

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
      po.id,
      po.promise_id,
      po.outcome_summary,
      po.outcome_type,
      po.measurable_impact,
      po.impact_direction,
      po.black_community_impact_note,
      po.evidence_strength,
      po.status_override,
      pod.affected_groups,
      pod.outcome_date,
      pod.outcome_timeframe
    FROM promise_outcomes po
    LEFT JOIN promise_outcome_details pod ON pod.promise_outcome_id = po.id
    WHERE po.promise_id = ?
    ORDER BY COALESCE(pod.outcome_date, po.created_at) ASC, po.id ASC
    `,
    [promise.id]
  );

  const [actionSourcesMap, outcomeSourcesMap, promiseSources, availableSources] =
    await Promise.all([
      getActionSources(actionRows.map((row) => row.id)),
      getOutcomeSources(outcomeRows.map((row) => row.id)),
      getPromiseSources(promise.id),
      getAvailableSourcesForPromise(promise.id),
    ]);

  const actions = actionRows.map((row) =>
    normalizeActionRow(row, actionSourcesMap.get(Number(row.id)) || [])
  );
  const outcomes = outcomeRows.map((row) =>
    normalizeOutcomeRow(row, outcomeSourcesMap.get(Number(row.id)) || [])
  );

  return {
    promise,
    promise_sources: promiseSources,
    actions,
    outcomes,
    available_sources: availableSources,
    scoring_readiness: computeScoringReadiness(outcomes),
  };
}

export async function updateAdminPromiseRecord(id, payload) {
  const db = getDb();
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [existingPromiseRows] = await connection.query(
      `SELECT id FROM promises WHERE id = ? LIMIT 1`,
      [id]
    );

    if (!existingPromiseRows.length) {
      throw new Error("Promise not found");
    }

    await connection.query(
      `
      UPDATE promises
      SET
        title = ?,
        promise_text = ?,
        promise_date = ?,
        promise_type = ?,
        campaign_or_official = ?,
        topic = ?,
        impacted_group = ?,
        status = ?,
        summary = ?,
        notes = ?
      WHERE id = ?
      `,
      [
        payload.title,
        payload.promise_text,
        payload.promise_date || null,
        payload.promise_type,
        payload.campaign_or_official,
        payload.topic || null,
        payload.impacted_group || null,
        payload.status,
        payload.summary || null,
        payload.notes || null,
        id,
      ]
    );

    for (const action of payload.actions || []) {
      await connection.query(
        `
        UPDATE promise_actions
        SET
          action_type = ?,
          action_date = ?,
          title = ?,
          description = ?,
          related_policy_id = ?,
          related_explainer_id = ?
        WHERE id = ?
          AND promise_id = ?
        `,
        [
          action.action_type,
          action.action_date || null,
          action.title,
          action.description || null,
          action.related_policy_id || null,
          action.related_explainer_id || null,
          action.id,
          id,
        ]
      );
    }

    await connection.commit();

    return fetchAdminPromiseDetail(id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function createAdminPromiseOutcome(promiseId, payload) {
  const db = getDb();
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [promiseRows] = await connection.query(
      `SELECT id FROM promises WHERE id = ? LIMIT 1`,
      [promiseId]
    );

    if (!promiseRows.length) {
      throw new Error("Promise not found");
    }

    const [outcomeResult] = await connection.query(
      `
      INSERT INTO promise_outcomes (
        promise_id,
        outcome_summary,
        outcome_type,
        measurable_impact,
        impact_direction,
        black_community_impact_note,
        evidence_strength,
        status_override
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        promiseId,
        payload.outcome_summary,
        payload.outcome_type,
        payload.measurable_impact || null,
        payload.impact_direction,
        payload.black_community_impact_note || null,
        payload.evidence_strength,
        payload.status_override || null,
      ]
    );

    const outcomeId = Number(outcomeResult.insertId);

    await upsertOutcomeDetails(connection, outcomeId, payload);

    const sourceIds = await resolveSourceIds(connection, payload.sources || []);
    for (const sourceId of sourceIds) {
      await connection.query(
        `
        INSERT IGNORE INTO promise_outcome_sources (promise_outcome_id, source_id)
        VALUES (?, ?)
        `,
        [outcomeId, sourceId]
      );
    }

    await connection.commit();

    return fetchAdminPromiseDetail(promiseId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateAdminPromiseOutcome(promiseId, outcomeId, payload) {
  const db = getDb();
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [outcomeRows] = await connection.query(
      `
      SELECT id
      FROM promise_outcomes
      WHERE id = ?
        AND promise_id = ?
      LIMIT 1
      `,
      [outcomeId, promiseId]
    );

    if (!outcomeRows.length) {
      throw new Error("Outcome not found");
    }

    await connection.query(
      `
      UPDATE promise_outcomes
      SET
        outcome_summary = ?,
        outcome_type = ?,
        measurable_impact = ?,
        impact_direction = ?,
        black_community_impact_note = ?,
        evidence_strength = ?,
        status_override = ?
      WHERE id = ?
        AND promise_id = ?
      `,
      [
        payload.outcome_summary,
        payload.outcome_type,
        payload.measurable_impact || null,
        payload.impact_direction,
        payload.black_community_impact_note || null,
        payload.evidence_strength,
        payload.status_override || null,
        outcomeId,
        promiseId,
      ]
    );

    await upsertOutcomeDetails(connection, outcomeId, payload);

    await connection.query(
      `DELETE FROM promise_outcome_sources WHERE promise_outcome_id = ?`,
      [outcomeId]
    );

    const sourceIds = await resolveSourceIds(connection, payload.sources || []);
    for (const sourceId of sourceIds) {
      await connection.query(
        `
        INSERT IGNORE INTO promise_outcome_sources (promise_outcome_id, source_id)
        VALUES (?, ?)
        `,
        [outcomeId, sourceId]
      );
    }

    await connection.commit();

    return fetchAdminPromiseDetail(promiseId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
