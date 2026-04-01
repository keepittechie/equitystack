import { promises as fs } from "node:fs";
import {
  SYSTEM_SIGNALS_DIR,
  buildSystemSignalPath,
  ensureDir,
  mergeRecordsById,
  normalizeString,
  readJsonSafe,
  sortByTimestampDesc,
  toBoundedRecordId,
} from "./shared.js";
import {
  fromDbTimestamp,
  parseJsonColumn,
  stringifyJsonColumn,
  toDbTimestamp,
  withOperatorDbFallback,
} from "./operatorPersistence.js";

function normalizeSystemSignal(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  return {
    id: toBoundedRecordId(payload.id, "sig"),
    workflowFamily: normalizeString(payload.workflowFamily) || null,
    signalType: normalizeString(payload.signalType),
    severity: normalizeString(payload.severity) || "info",
    state: normalizeString(payload.state) || "open",
    title: normalizeString(payload.title),
    summary: normalizeString(payload.summary),
    href: normalizeString(payload.href) || null,
    active: payload.active !== false,
    sessionId: normalizeString(payload.sessionId) || null,
    artifactId: toBoundedRecordId(payload.artifactId, "artifact") || null,
    jobRunId: normalizeString(payload.jobRunId) || null,
    metadataJson:
      payload.metadataJson && typeof payload.metadataJson === "object" ? payload.metadataJson : {},
    observedAt: normalizeString(payload.observedAt) || null,
    resolvedAt: normalizeString(payload.resolvedAt) || null,
    createdAt: normalizeString(payload.createdAt) || null,
    updatedAt: normalizeString(payload.updatedAt) || null,
  };
}

function normalizeDbSystemSignal(row) {
  if (!row) {
    return null;
  }

  return normalizeSystemSignal({
    id: row.id,
    workflowFamily: row.workflow_family,
    signalType: row.signal_type,
    severity: row.severity,
    state: row.state,
    title: row.title,
    summary: row.summary,
    href: row.href,
    active: Boolean(row.active),
    sessionId: row.session_id,
    artifactId: row.artifact_id,
    jobRunId: row.job_run_id,
    metadataJson: parseJsonColumn(row.metadata_json, {}),
    observedAt: fromDbTimestamp(row.observed_at),
    resolvedAt: fromDbTimestamp(row.resolved_at),
    createdAt: fromDbTimestamp(row.created_at),
    updatedAt: fromDbTimestamp(row.updated_at),
  });
}

async function writeSystemSignalFile(signal) {
  const normalized = normalizeSystemSignal(signal);
  if (!normalized?.id) {
    throw new Error("System signal is missing an id.");
  }

  await ensureDir(SYSTEM_SIGNALS_DIR);
  await fs.writeFile(
    buildSystemSignalPath(normalized.id),
    `${JSON.stringify(normalized, null, 2)}\n`,
    "utf8"
  );
  return normalized;
}

async function listSystemSignalsFile({ activeOnly = true } = {}) {
  const entries = await fs.readdir(SYSTEM_SIGNALS_DIR, { withFileTypes: true }).catch(() => []);
  const items = (
    await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) => readJsonSafe(`${SYSTEM_SIGNALS_DIR}/${entry.name}`))
    )
  )
    .map(normalizeSystemSignal)
    .filter(Boolean)
    .filter((item) => !activeOnly || item.active);

  return sortByTimestampDesc(
    mergeRecordsById(items),
    (item) => item.observedAt || item.updatedAt || item.createdAt
  );
}

async function listSystemSignalsDb({ activeOnly = true } = {}) {
  return withOperatorDbFallback(
    async (db) => {
      const whereClause = activeOnly ? "WHERE active = 1" : "";
      const [rows] = await db.execute(
        `SELECT *
         FROM operator_system_signals
         ${whereClause}
         ORDER BY observed_at DESC, updated_at DESC, created_at DESC`
      );
      return rows.map(normalizeDbSystemSignal).filter(Boolean);
    },
    async () => listSystemSignalsFile({ activeOnly })
  );
}

export async function listSystemSignalRecords({ activeOnly = true } = {}) {
  const [dbItems, fileItems] = await Promise.all([
    listSystemSignalsDb({ activeOnly }),
    listSystemSignalsFile({ activeOnly }),
  ]);
  return sortByTimestampDesc(
    mergeRecordsById([...dbItems, ...fileItems])
      .map(normalizeSystemSignal)
      .filter(Boolean),
    (item) => item.observedAt || item.updatedAt || item.createdAt
  );
}

export async function upsertSystemSignal(record) {
  const existing = (await listSystemSignalRecords({ activeOnly: false })).find((item) => item.id === record.id) || null;
  const now = new Date().toISOString();
  const next = normalizeSystemSignal({
    ...existing,
    ...record,
    createdAt: existing?.createdAt || now,
    observedAt: record.observedAt || existing?.observedAt || now,
    updatedAt: now,
  });

  await withOperatorDbFallback(
    async (db) => {
      await db.execute(
        `INSERT INTO operator_system_signals (
          id,
          workflow_family,
          signal_type,
          severity,
          state,
          title,
          summary,
          href,
          active,
          session_id,
          artifact_id,
          job_run_id,
          metadata_json,
          observed_at,
          resolved_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          workflow_family = VALUES(workflow_family),
          signal_type = VALUES(signal_type),
          severity = VALUES(severity),
          state = VALUES(state),
          title = VALUES(title),
          summary = VALUES(summary),
          href = VALUES(href),
          active = VALUES(active),
          session_id = VALUES(session_id),
          artifact_id = VALUES(artifact_id),
          job_run_id = VALUES(job_run_id),
          metadata_json = VALUES(metadata_json),
          observed_at = VALUES(observed_at),
          resolved_at = VALUES(resolved_at),
          updated_at = VALUES(updated_at)`,
        [
          next.id,
          next.workflowFamily,
          next.signalType,
          next.severity,
          next.state,
          next.title,
          next.summary,
          next.href,
          next.active ? 1 : 0,
          next.sessionId,
          next.artifactId,
          next.jobRunId,
          stringifyJsonColumn(next.metadataJson, {}),
          toDbTimestamp(next.observedAt),
          toDbTimestamp(next.resolvedAt),
          toDbTimestamp(next.createdAt),
          toDbTimestamp(next.updatedAt),
        ]
      );
      return next;
    },
    async () => writeSystemSignalFile(next)
  );

  return next;
}

export async function deactivateSystemSignals(keepIds = []) {
  const current = await listSystemSignalRecords({ activeOnly: false });
  await Promise.all(
    current
      .filter((item) => item.active && !keepIds.includes(item.id))
      .map((item) =>
        upsertSystemSignal({
          ...item,
          active: false,
          state: "resolved",
          resolvedAt: new Date().toISOString(),
        })
      )
  );
}
