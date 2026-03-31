import { promises as fs } from "node:fs";
import {
  WORKFLOW_SESSIONS_DIR,
  buildWorkflowSessionPath,
  ensureDir,
  mergeRecordsById,
  normalizeString,
  readJsonSafe,
  sortByTimestampDesc,
  uniqueStrings,
} from "./shared.js";
import {
  buildExecutorColumns,
  fromDbTimestamp,
  parseJsonColumn,
  stringifyJsonColumn,
  toDbTimestamp,
  withOperatorDbFallback,
} from "./operatorPersistence.js";

function normalizeSessionRecord(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  return {
    id: normalizeString(payload.id),
    workflowFamily: normalizeString(payload.workflowFamily),
    canonicalSessionKey: normalizeString(payload.canonicalSessionKey),
    canonicalState: normalizeString(payload.canonicalState),
    active: payload.active !== false,
    recommendedActionId: normalizeString(payload.recommendedActionId),
    source: normalizeString(payload.source) || "canonical_artifacts",
    startedAt: normalizeString(payload.startedAt) || null,
    updatedAt: normalizeString(payload.updatedAt) || null,
    title: normalizeString(payload.title),
    summary: normalizeString(payload.summary),
    href: normalizeString(payload.href) || null,
    operatorSurfaceHref: normalizeString(payload.operatorSurfaceHref) || null,
    metadataJson:
      payload.metadataJson && typeof payload.metadataJson === "object" ? payload.metadataJson : {},
    relatedJobRunIds: uniqueStrings(payload.relatedJobRunIds || []),
    createdAt: normalizeString(payload.createdAt) || null,
  };
}

function normalizeDbSessionRecord(row) {
  if (!row) {
    return null;
  }

  return normalizeSessionRecord({
    id: row.id,
    workflowFamily: row.workflow_family,
    canonicalSessionKey: row.canonical_session_key,
    canonicalState: row.canonical_state,
    active: Boolean(row.active),
    recommendedActionId: row.recommended_action_id,
    source: row.source,
    startedAt: fromDbTimestamp(row.started_at),
    updatedAt: fromDbTimestamp(row.updated_at),
    title: row.title,
    summary: row.summary,
    href: row.href,
    operatorSurfaceHref: row.operator_surface_href,
    metadataJson: parseJsonColumn(row.metadata_json, {}),
    relatedJobRunIds: parseJsonColumn(row.related_job_run_ids_json, []),
    createdAt: fromDbTimestamp(row.created_at),
  });
}

async function writeSessionRecordFile(record) {
  const normalized = normalizeSessionRecord(record);
  if (!normalized?.id) {
    throw new Error("Workflow session record is missing an id.");
  }

  await ensureDir(WORKFLOW_SESSIONS_DIR);
  await fs.writeFile(
    buildWorkflowSessionPath(normalized.id),
    `${JSON.stringify(normalized, null, 2)}\n`,
    "utf8"
  );
  return normalized;
}

async function listWorkflowSessionRecordsFile({ workflowFamily = "", activeOnly = false } = {}) {
  const entries = await fs.readdir(WORKFLOW_SESSIONS_DIR, { withFileTypes: true }).catch(() => []);
  const sessions = (
    await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) => readJsonSafe(`${WORKFLOW_SESSIONS_DIR}/${entry.name}`))
    )
  )
    .map(normalizeSessionRecord)
    .filter(Boolean)
    .filter((session) => !workflowFamily || session.workflowFamily === workflowFamily)
    .filter((session) => !activeOnly || session.active);

  return sortByTimestampDesc(
    mergeRecordsById(sessions),
    (session) => session.updatedAt || session.startedAt || session.createdAt
  );
}

async function listWorkflowSessionRecordsDb({ workflowFamily = "", activeOnly = false } = {}) {
  return withOperatorDbFallback(
    async (db) => {
      const clauses = [];
      const params = [];
      if (workflowFamily) {
        clauses.push("workflow_family = ?");
        params.push(workflowFamily);
      }
      if (activeOnly) {
        clauses.push("active = 1");
      }
      const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const [rows] = await db.execute(
        `SELECT *
         FROM operator_workflow_sessions
         ${whereClause}
         ORDER BY updated_at DESC, started_at DESC, created_at DESC`,
        params
      );
      return rows.map(normalizeDbSessionRecord).filter(Boolean);
    },
    async () => listWorkflowSessionRecordsFile({ workflowFamily, activeOnly })
  );
}

async function getWorkflowSessionRecordDb(sessionId) {
  return withOperatorDbFallback(
    async (db) => {
      const [rows] = await db.execute(
        `SELECT *
         FROM operator_workflow_sessions
         WHERE id = ?
         LIMIT 1`,
        [sessionId]
      );
      return normalizeDbSessionRecord(rows[0] || null);
    },
    async () => normalizeSessionRecord(await readJsonSafe(buildWorkflowSessionPath(sessionId)))
  );
}

export async function getWorkflowSessionRecord(sessionId) {
  const normalizedId = normalizeString(sessionId);
  if (!normalizedId) {
    return null;
  }
  const dbRecord = await getWorkflowSessionRecordDb(normalizedId);
  if (dbRecord) {
    return dbRecord;
  }
  return normalizeSessionRecord(await readJsonSafe(buildWorkflowSessionPath(normalizedId)));
}

export async function listWorkflowSessionRecords({ workflowFamily = "", activeOnly = false } = {}) {
  const [dbRecords, fileRecords] = await Promise.all([
    listWorkflowSessionRecordsDb({ workflowFamily, activeOnly }),
    listWorkflowSessionRecordsFile({ workflowFamily, activeOnly }),
  ]);
  return sortByTimestampDesc(
    mergeRecordsById([...dbRecords, ...fileRecords])
      .map(normalizeSessionRecord)
      .filter(Boolean),
    (session) => session.updatedAt || session.startedAt || session.createdAt
  );
}

export async function upsertWorkflowSessionRecord(record, { relatedJobRunId = "" } = {}) {
  const existing = await getWorkflowSessionRecord(record.id);
  const now = new Date().toISOString();
  const next = normalizeSessionRecord({
    ...existing,
    ...record,
    relatedJobRunIds: uniqueStrings([
      ...(existing?.relatedJobRunIds || []),
      ...(record.relatedJobRunIds || []),
      relatedJobRunId,
    ]),
    createdAt: existing?.createdAt || now,
    updatedAt: record.updatedAt || now,
  });
  const executorColumns = buildExecutorColumns(next.metadataJson);

  await withOperatorDbFallback(
    async (db) => {
      await db.execute(
        `INSERT INTO operator_workflow_sessions (
          id,
          workflow_family,
          canonical_session_key,
          canonical_state,
          active,
          recommended_action_id,
          source,
          title,
          summary,
          href,
          operator_surface_href,
          metadata_json,
          related_job_run_ids_json,
          executor_model,
          executor_backend,
          executor_host,
          executor_transport,
          execution_mode,
          created_at,
          started_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          workflow_family = VALUES(workflow_family),
          canonical_session_key = VALUES(canonical_session_key),
          canonical_state = VALUES(canonical_state),
          active = VALUES(active),
          recommended_action_id = VALUES(recommended_action_id),
          source = VALUES(source),
          title = VALUES(title),
          summary = VALUES(summary),
          href = VALUES(href),
          operator_surface_href = VALUES(operator_surface_href),
          metadata_json = VALUES(metadata_json),
          related_job_run_ids_json = VALUES(related_job_run_ids_json),
          executor_model = VALUES(executor_model),
          executor_backend = VALUES(executor_backend),
          executor_host = VALUES(executor_host),
          executor_transport = VALUES(executor_transport),
          execution_mode = VALUES(execution_mode),
          started_at = VALUES(started_at),
          updated_at = VALUES(updated_at)`,
        [
          next.id,
          next.workflowFamily,
          next.canonicalSessionKey,
          next.canonicalState,
          next.active ? 1 : 0,
          next.recommendedActionId,
          next.source,
          next.title,
          next.summary,
          next.href,
          next.operatorSurfaceHref,
          stringifyJsonColumn(next.metadataJson, {}),
          stringifyJsonColumn(next.relatedJobRunIds, []),
          executorColumns.executorModel,
          executorColumns.executorBackend,
          executorColumns.executorHost,
          executorColumns.executorTransport,
          executorColumns.executionMode,
          toDbTimestamp(next.createdAt),
          toDbTimestamp(next.startedAt),
          toDbTimestamp(next.updatedAt),
        ]
      );
      return next;
    },
    async () => writeSessionRecordFile(next)
  );

  return next;
}

export async function markWorkflowFamilySessionsInactive(workflowFamily, keepSessionId) {
  const records = await listWorkflowSessionRecords({ workflowFamily });
  await Promise.all(
    records
      .filter((record) => record.id !== keepSessionId && record.active)
      .map((record) =>
        upsertWorkflowSessionRecord({
          ...record,
          active: false,
          updatedAt: new Date().toISOString(),
        })
      )
  );
}
