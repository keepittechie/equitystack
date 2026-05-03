import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  COMMAND_HISTORY_DIR,
  buildCommandHistoryPath,
  ensureDir,
  mergeRecordsById,
  normalizeString,
  readJsonSafe,
  sortByTimestampDesc,
} from "./shared.js";
import {
  fromDbTimestamp,
  parseJsonColumn,
  stringifyJsonColumn,
  toDbTimestamp,
  withOperatorDbFallback,
} from "./operatorPersistence.js";

function normalizeCommandHistoryEntry(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  return {
    id: normalizeString(payload.id),
    rawCommand: normalizeString(payload.rawCommand),
    normalizedCommand: normalizeString(payload.normalizedCommand),
    resultType: normalizeString(payload.resultType),
    resultStatus: normalizeString(payload.resultStatus),
    title: normalizeString(payload.title) || null,
    summary: normalizeString(payload.summary) || null,
    actionId: normalizeString(payload.actionId) || null,
    selectedSessionId: normalizeString(payload.selectedSessionId) || null,
    relatedSessionId: normalizeString(payload.relatedSessionId) || null,
    relatedJobId: normalizeString(payload.relatedJobId) || null,
    confirmationRequired: Boolean(payload.confirmationRequired),
    payloadJson:
      payload.payloadJson && typeof payload.payloadJson === "object" ? payload.payloadJson : {},
    executedAt: normalizeString(payload.executedAt) || null,
    createdAt: normalizeString(payload.createdAt) || null,
    updatedAt: normalizeString(payload.updatedAt) || null,
  };
}

function normalizeDbCommandHistoryEntry(row) {
  if (!row) {
    return null;
  }

  return normalizeCommandHistoryEntry({
    id: row.id,
    rawCommand: row.raw_command,
    normalizedCommand: row.normalized_command,
    resultType: row.result_type,
    resultStatus: row.result_status,
    title: row.title,
    summary: row.summary,
    actionId: row.action_id,
    selectedSessionId: row.selected_session_id,
    relatedSessionId: row.related_session_id,
    relatedJobId: row.related_job_id,
    confirmationRequired: Boolean(row.confirmation_required),
    payloadJson: parseJsonColumn(row.payload_json, {}),
    executedAt: fromDbTimestamp(row.executed_at),
    createdAt: fromDbTimestamp(row.created_at),
    updatedAt: fromDbTimestamp(row.updated_at),
  });
}

async function writeCommandHistoryFile(entry) {
  const normalized = normalizeCommandHistoryEntry(entry);
  if (!normalized?.id) {
    throw new Error("Command history entry is missing an id.");
  }

  await ensureDir(COMMAND_HISTORY_DIR);
  await fs.writeFile(
    buildCommandHistoryPath(normalized.id),
    `${JSON.stringify(normalized, null, 2)}\n`,
    "utf8"
  );
  return normalized;
}

async function listCommandHistoryFile({ limit = 20 } = {}) {
  const entries = await fs.readdir(COMMAND_HISTORY_DIR, { withFileTypes: true }).catch(() => []);
  const items = (
    await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) => readJsonSafe(`${COMMAND_HISTORY_DIR}/${entry.name}`))
    )
  )
    .map(normalizeCommandHistoryEntry)
    .filter(Boolean);

  const sorted = sortByTimestampDesc(
    mergeRecordsById(items),
    (entry) => entry.executedAt || entry.updatedAt || entry.createdAt
  );
  return Number.isFinite(limit) && limit > 0 ? sorted.slice(0, limit) : sorted;
}

async function listCommandHistoryDb({ limit = 20 } = {}) {
  return withOperatorDbFallback(
    async (db) => {
      const effectiveLimit = Number.isFinite(limit) && limit > 0 ? limit : 20;
      const [rows] = await db.execute(
        `SELECT *
         FROM operator_command_history
         ORDER BY executed_at DESC, created_at DESC
         LIMIT ?`,
        [effectiveLimit]
      );
      return rows.map(normalizeDbCommandHistoryEntry).filter(Boolean);
    },
    async () => listCommandHistoryFile({ limit })
  );
}

export async function createCommandHistoryEntry(entry) {
  const now = new Date().toISOString();
  const next = normalizeCommandHistoryEntry({
    ...entry,
    id: normalizeString(entry?.id) || `cmd_${Date.now()}_${randomUUID().slice(0, 8)}`,
    executedAt: entry?.executedAt || now,
    createdAt: entry?.createdAt || now,
    updatedAt: now,
  });

  await withOperatorDbFallback(
    async (db) => {
      await db.execute(
        `INSERT INTO operator_command_history (
          id,
          raw_command,
          normalized_command,
          result_type,
          result_status,
          title,
          summary,
          action_id,
          selected_session_id,
          related_session_id,
          related_job_id,
          confirmation_required,
          payload_json,
          executed_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          next.id,
          next.rawCommand,
          next.normalizedCommand,
          next.resultType,
          next.resultStatus,
          next.title,
          next.summary,
          next.actionId,
          next.selectedSessionId,
          next.relatedSessionId,
          next.relatedJobId,
          next.confirmationRequired ? 1 : 0,
          stringifyJsonColumn(next.payloadJson, {}),
          toDbTimestamp(next.executedAt),
          toDbTimestamp(next.createdAt),
          toDbTimestamp(next.updatedAt),
        ]
      );
      return next;
    },
    async () => writeCommandHistoryFile(next)
  );

  return next;
}

export async function listCommandHistoryEntries({ limit = 20 } = {}) {
  const [dbItems, fileItems] = await Promise.all([
    listCommandHistoryDb({ limit }),
    listCommandHistoryFile({ limit }),
  ]);
  const sorted = sortByTimestampDesc(
    mergeRecordsById([...dbItems, ...fileItems])
      .map(normalizeCommandHistoryEntry)
      .filter(Boolean),
    (entry) => entry.executedAt || entry.updatedAt || entry.createdAt
  );
  return Number.isFinite(limit) && limit > 0 ? sorted.slice(0, limit) : sorted;
}
