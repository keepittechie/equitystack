import { promises as fs } from "node:fs";
import {
  ARTIFACT_RECORDS_DIR,
  buildArtifactRecordPath,
  ensureDir,
  mergeRecordsById,
  normalizeString,
  readJsonSafe,
  sortByTimestampDesc,
  toBoundedRecordId,
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

function normalizeArtifactRecord(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  return {
    id: toBoundedRecordId(payload.id, "artifact"),
    sessionId: normalizeString(payload.sessionId),
    workflowFamily: normalizeString(payload.workflowFamily),
    artifactKey: normalizeString(payload.artifactKey),
    label: normalizeString(payload.label),
    stage: normalizeString(payload.stage) || null,
    canonicalPath: normalizeString(payload.canonicalPath) || null,
    fileName: normalizeString(payload.fileName) || null,
    exists: Boolean(payload.exists),
    generatedAt: normalizeString(payload.generatedAt) || null,
    source: normalizeString(payload.source) || "canonical_artifact",
    latestJobRunId: normalizeString(payload.latestJobRunId) || null,
    relatedJobRunIds: uniqueStrings(payload.relatedJobRunIds || []),
    metadataJson:
      payload.metadataJson && typeof payload.metadataJson === "object" ? payload.metadataJson : {},
    createdAt: normalizeString(payload.createdAt) || null,
    updatedAt: normalizeString(payload.updatedAt) || null,
  };
}

function artifactRecordChanged(existing, incoming) {
  if (!existing) {
    return true;
  }

  return (
    normalizeString(existing.canonicalPath) !== normalizeString(incoming.canonicalPath) ||
    normalizeString(existing.generatedAt) !== normalizeString(incoming.generatedAt) ||
    Boolean(existing.exists) !== Boolean(incoming.exists) ||
    normalizeString(existing.stage) !== normalizeString(incoming.stage) ||
    normalizeString(existing.metadataJson?.summary) !== normalizeString(incoming.metadataJson?.summary)
  );
}

function normalizeDbArtifactRecord(row) {
  if (!row) {
    return null;
  }

  return normalizeArtifactRecord({
    id: row.id,
    sessionId: row.session_id,
    workflowFamily: row.workflow_family,
    artifactKey: row.artifact_key,
    label: row.label,
    stage: row.stage,
    canonicalPath: row.canonical_path,
    fileName: row.file_name,
    exists: Boolean(row.exists_flag),
    generatedAt: fromDbTimestamp(row.generated_at),
    source: row.source,
    latestJobRunId: row.latest_job_run_id,
    relatedJobRunIds: parseJsonColumn(row.related_job_run_ids_json, []),
    metadataJson: parseJsonColumn(row.metadata_json, {}),
    createdAt: fromDbTimestamp(row.created_at),
    updatedAt: fromDbTimestamp(row.updated_at),
  });
}

async function writeArtifactRecordFile(record) {
  const normalized = normalizeArtifactRecord(record);
  if (!normalized?.id) {
    throw new Error("Artifact record is missing an id.");
  }

  await ensureDir(ARTIFACT_RECORDS_DIR);
  await fs.writeFile(
    buildArtifactRecordPath(normalized.id),
    `${JSON.stringify(normalized, null, 2)}\n`,
    "utf8"
  );
  return normalized;
}

async function listArtifactRecordsFile({ sessionId = "", workflowFamily = "" } = {}) {
  const entries = await fs.readdir(ARTIFACT_RECORDS_DIR, { withFileTypes: true }).catch(() => []);
  const artifacts = (
    await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) => readJsonSafe(`${ARTIFACT_RECORDS_DIR}/${entry.name}`))
    )
  )
    .map(normalizeArtifactRecord)
    .filter(Boolean)
    .filter((artifact) => !sessionId || artifact.sessionId === sessionId)
    .filter((artifact) => !workflowFamily || artifact.workflowFamily === workflowFamily);

  return sortByTimestampDesc(
    mergeRecordsById(artifacts),
    (artifact) => artifact.generatedAt || artifact.updatedAt || artifact.createdAt
  );
}

async function listArtifactRecordsDb({ sessionId = "", workflowFamily = "" } = {}) {
  return withOperatorDbFallback(
    async (db) => {
      const clauses = [];
      const params = [];
      if (sessionId) {
        clauses.push("session_id = ?");
        params.push(sessionId);
      }
      if (workflowFamily) {
        clauses.push("workflow_family = ?");
        params.push(workflowFamily);
      }
      const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const [rows] = await db.execute(
        `SELECT *
         FROM operator_artifacts
         ${whereClause}
         ORDER BY generated_at DESC, updated_at DESC, created_at DESC`,
        params
      );
      return rows.map(normalizeDbArtifactRecord).filter(Boolean);
    },
    async () => listArtifactRecordsFile({ sessionId, workflowFamily })
  );
}

async function getArtifactRecordDb(artifactId) {
  return withOperatorDbFallback(
    async (db) => {
      const [rows] = await db.execute(
        `SELECT *
         FROM operator_artifacts
         WHERE id = ?
         LIMIT 1`,
        [artifactId]
      );
      return normalizeDbArtifactRecord(rows[0] || null);
    },
    async () => normalizeArtifactRecord(await readJsonSafe(buildArtifactRecordPath(artifactId)))
  );
}

export async function getArtifactRecord(artifactId) {
  const normalizedId = normalizeString(artifactId);
  if (!normalizedId) {
    return null;
  }
  const dbRecord = await getArtifactRecordDb(normalizedId);
  if (dbRecord) {
    return dbRecord;
  }
  return normalizeArtifactRecord(await readJsonSafe(buildArtifactRecordPath(normalizedId)));
}

export async function listArtifactRecords({ sessionId = "", workflowFamily = "" } = {}) {
  const [dbRecords, fileRecords] = await Promise.all([
    listArtifactRecordsDb({ sessionId, workflowFamily }),
    listArtifactRecordsFile({ sessionId, workflowFamily }),
  ]);
  return sortByTimestampDesc(
    mergeRecordsById([...dbRecords, ...fileRecords])
      .map(normalizeArtifactRecord)
      .filter(Boolean),
    (artifact) => artifact.generatedAt || artifact.updatedAt || artifact.createdAt
  );
}

export async function upsertArtifactRecord(record, { relatedJobRunId = "" } = {}) {
  const existing = await getArtifactRecord(record.id);
  const now = new Date().toISOString();
  const normalizedIncoming = normalizeArtifactRecord({
    ...existing,
    ...record,
  });
  const wasRefreshed = artifactRecordChanged(existing, normalizedIncoming);
  const next = normalizeArtifactRecord({
    ...existing,
    ...record,
    latestJobRunId: wasRefreshed
      ? normalizeString(relatedJobRunId) || record.latestJobRunId || existing?.latestJobRunId || null
      : existing?.latestJobRunId || normalizeString(record.latestJobRunId) || null,
    relatedJobRunIds: uniqueStrings([
      ...(existing?.relatedJobRunIds || []),
      ...(record.relatedJobRunIds || []),
      wasRefreshed ? relatedJobRunId : "",
    ]),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  });
  const executorColumns = buildExecutorColumns(next.metadataJson);

  await withOperatorDbFallback(
    async (db) => {
      await db.execute(
        `INSERT INTO operator_artifacts (
          id,
          session_id,
          workflow_family,
          artifact_key,
          label,
          stage,
          canonical_path,
          file_name,
          exists_flag,
          generated_at,
          source,
          latest_job_run_id,
          related_job_run_ids_json,
          metadata_json,
          executor_model,
          executor_backend,
          executor_host,
          executor_transport,
          execution_mode,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          session_id = VALUES(session_id),
          workflow_family = VALUES(workflow_family),
          artifact_key = VALUES(artifact_key),
          label = VALUES(label),
          stage = VALUES(stage),
          canonical_path = VALUES(canonical_path),
          file_name = VALUES(file_name),
          exists_flag = VALUES(exists_flag),
          generated_at = VALUES(generated_at),
          source = VALUES(source),
          latest_job_run_id = VALUES(latest_job_run_id),
          related_job_run_ids_json = VALUES(related_job_run_ids_json),
          metadata_json = VALUES(metadata_json),
          executor_model = VALUES(executor_model),
          executor_backend = VALUES(executor_backend),
          executor_host = VALUES(executor_host),
          executor_transport = VALUES(executor_transport),
          execution_mode = VALUES(execution_mode),
          updated_at = VALUES(updated_at)`,
        [
          next.id,
          next.sessionId,
          next.workflowFamily,
          next.artifactKey,
          next.label,
          next.stage,
          next.canonicalPath,
          next.fileName,
          next.exists ? 1 : 0,
          toDbTimestamp(next.generatedAt),
          next.source,
          next.latestJobRunId,
          stringifyJsonColumn(next.relatedJobRunIds, []),
          stringifyJsonColumn(next.metadataJson, {}),
          executorColumns.executorModel,
          executorColumns.executorBackend,
          executorColumns.executorHost,
          executorColumns.executorTransport,
          executorColumns.executionMode,
          toDbTimestamp(next.createdAt),
          toDbTimestamp(next.updatedAt),
        ]
      );
      return next;
    },
    async () => writeArtifactRecordFile(next)
  );

  return next;
}
