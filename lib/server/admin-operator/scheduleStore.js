import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  OPERATOR_SCHEDULES_DIR,
  buildOperatorSchedulePath,
  ensureDir,
  mergeRecordsById,
  normalizeString,
  readJsonSafe,
  sortByTimestampDesc,
} from "./shared.js";
import {
  parseJsonColumn,
  stringifyJsonColumn,
  toDbTimestamp,
  fromDbTimestamp,
  withOperatorDbFallback,
} from "./operatorPersistence.js";

function normalizeScheduleRecord(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  return {
    id: normalizeString(payload.id),
    title: normalizeString(payload.title),
    actionId: normalizeString(payload.actionId),
    workflowFamily: normalizeString(payload.workflowFamily),
    scheduleType: normalizeString(payload.scheduleType) || "manual",
    scheduleExpression: normalizeString(payload.scheduleExpression) || null,
    timezone: normalizeString(payload.timezone) || "America/Los_Angeles",
    enabled: Boolean(payload.enabled),
    safeAutoRun: Boolean(payload.safeAutoRun),
    requiresHumanCheckpoint: payload.requiresHumanCheckpoint !== false,
    executionMode: normalizeString(payload.executionMode) || null,
    defaultInputJson:
      payload.defaultInputJson && typeof payload.defaultInputJson === "object"
        ? payload.defaultInputJson
        : {},
    defaultContextJson:
      payload.defaultContextJson && typeof payload.defaultContextJson === "object"
        ? payload.defaultContextJson
        : {},
    lastRunAt: normalizeString(payload.lastRunAt) || null,
    nextRunAt: normalizeString(payload.nextRunAt) || null,
    lastJobId: normalizeString(payload.lastJobId) || null,
    status: normalizeString(payload.status) || "manual",
    lastResultSummary: normalizeString(payload.lastResultSummary) || null,
    metadataJson:
      payload.metadataJson && typeof payload.metadataJson === "object" ? payload.metadataJson : {},
    createdAt: normalizeString(payload.createdAt) || null,
    updatedAt: normalizeString(payload.updatedAt) || null,
  };
}

function normalizeDbScheduleRecord(row) {
  if (!row) {
    return null;
  }

  return normalizeScheduleRecord({
    id: row.id,
    title: row.title,
    actionId: row.action_id,
    workflowFamily: row.workflow_family,
    scheduleType: row.schedule_type,
    scheduleExpression: row.schedule_expression,
    timezone: row.timezone,
    enabled: Boolean(row.enabled),
    safeAutoRun: Boolean(row.safe_auto_run),
    requiresHumanCheckpoint: Boolean(row.requires_human_checkpoint),
    executionMode: row.execution_mode,
    defaultInputJson: parseJsonColumn(row.default_input_json, {}),
    defaultContextJson: parseJsonColumn(row.default_context_json, {}),
    lastRunAt: fromDbTimestamp(row.last_run_at),
    nextRunAt: fromDbTimestamp(row.next_run_at),
    lastJobId: row.last_job_id,
    status: row.status,
    lastResultSummary: row.last_result_summary,
    metadataJson: parseJsonColumn(row.metadata_json, {}),
    createdAt: fromDbTimestamp(row.created_at),
    updatedAt: fromDbTimestamp(row.updated_at),
  });
}

async function writeScheduleFile(record) {
  const normalized = normalizeScheduleRecord(record);
  if (!normalized?.id) {
    throw new Error("Operator schedule is missing an id.");
  }

  await ensureDir(OPERATOR_SCHEDULES_DIR);
  await fs.writeFile(
    buildOperatorSchedulePath(normalized.id),
    `${JSON.stringify(normalized, null, 2)}\n`,
    "utf8"
  );
  return normalized;
}

async function listScheduleRecordsFile() {
  const entries = await fs.readdir(OPERATOR_SCHEDULES_DIR, { withFileTypes: true }).catch(() => []);
  const items = (
    await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) => readJsonSafe(`${OPERATOR_SCHEDULES_DIR}/${entry.name}`))
    )
  )
    .map(normalizeScheduleRecord)
    .filter(Boolean);

  return sortByTimestampDesc(
    mergeRecordsById(items),
    (item) => item.updatedAt || item.nextRunAt || item.createdAt
  );
}

async function listScheduleRecordsDb() {
  return withOperatorDbFallback(
    async (db) => {
      const [rows] = await db.execute(
        `SELECT *
         FROM operator_schedules
         ORDER BY updated_at DESC, next_run_at ASC, created_at DESC`
      );
      return rows.map(normalizeDbScheduleRecord).filter(Boolean);
    },
    async () => listScheduleRecordsFile()
  );
}

async function getScheduleRecordDb(scheduleId) {
  return withOperatorDbFallback(
    async (db) => {
      const [rows] = await db.execute(
        `SELECT *
         FROM operator_schedules
         WHERE id = ?
         LIMIT 1`,
        [scheduleId]
      );
      return normalizeDbScheduleRecord(rows[0] || null);
    },
    async () => normalizeScheduleRecord(await readJsonSafe(buildOperatorSchedulePath(scheduleId)))
  );
}

export async function getScheduleRecord(scheduleId) {
  const normalizedId = normalizeString(scheduleId);
  if (!normalizedId) {
    return null;
  }
  const dbRecord = await getScheduleRecordDb(normalizedId);
  if (dbRecord) {
    return dbRecord;
  }
  return normalizeScheduleRecord(await readJsonSafe(buildOperatorSchedulePath(normalizedId)));
}

export async function listScheduleRecords() {
  const [dbRecords, fileRecords] = await Promise.all([
    listScheduleRecordsDb(),
    listScheduleRecordsFile(),
  ]);

  return sortByTimestampDesc(
    mergeRecordsById([...dbRecords, ...fileRecords])
      .map(normalizeScheduleRecord)
      .filter(Boolean),
    (item) => item.updatedAt || item.nextRunAt || item.createdAt
  );
}

export async function upsertScheduleRecord(record) {
  const existing = await getScheduleRecord(record.id);
  const now = new Date().toISOString();
  const next = normalizeScheduleRecord({
    ...existing,
    ...record,
    createdAt: existing?.createdAt || now,
    updatedAt: record.updatedAt || now,
  });

  await withOperatorDbFallback(
    async (db) => {
      await db.execute(
        `INSERT INTO operator_schedules (
          id,
          title,
          action_id,
          workflow_family,
          schedule_type,
          schedule_expression,
          timezone,
          enabled,
          safe_auto_run,
          requires_human_checkpoint,
          execution_mode,
          default_input_json,
          default_context_json,
          last_run_at,
          next_run_at,
          last_job_id,
          status,
          last_result_summary,
          metadata_json,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          title = VALUES(title),
          action_id = VALUES(action_id),
          workflow_family = VALUES(workflow_family),
          schedule_type = VALUES(schedule_type),
          schedule_expression = VALUES(schedule_expression),
          timezone = VALUES(timezone),
          enabled = VALUES(enabled),
          safe_auto_run = VALUES(safe_auto_run),
          requires_human_checkpoint = VALUES(requires_human_checkpoint),
          execution_mode = VALUES(execution_mode),
          default_input_json = VALUES(default_input_json),
          default_context_json = VALUES(default_context_json),
          last_run_at = VALUES(last_run_at),
          next_run_at = VALUES(next_run_at),
          last_job_id = VALUES(last_job_id),
          status = VALUES(status),
          last_result_summary = VALUES(last_result_summary),
          metadata_json = VALUES(metadata_json),
          updated_at = VALUES(updated_at)`,
        [
          next.id,
          next.title,
          next.actionId,
          next.workflowFamily,
          next.scheduleType,
          next.scheduleExpression,
          next.timezone,
          next.enabled ? 1 : 0,
          next.safeAutoRun ? 1 : 0,
          next.requiresHumanCheckpoint ? 1 : 0,
          next.executionMode,
          stringifyJsonColumn(next.defaultInputJson, {}),
          stringifyJsonColumn(next.defaultContextJson, {}),
          toDbTimestamp(next.lastRunAt),
          toDbTimestamp(next.nextRunAt),
          next.lastJobId,
          next.status,
          next.lastResultSummary,
          stringifyJsonColumn(next.metadataJson, {}),
          toDbTimestamp(next.createdAt),
          toDbTimestamp(next.updatedAt),
        ]
      );
      return next;
    },
    async () => writeScheduleFile(next)
  );

  return next;
}

export async function createScheduleRecord(record) {
  return upsertScheduleRecord({
    ...record,
    id: normalizeString(record?.id) || `schedule_${Date.now()}_${randomUUID().slice(0, 8)}`,
  });
}
