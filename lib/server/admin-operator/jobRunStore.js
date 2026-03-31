import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  JOB_LOGS_DIR,
  JOB_RUNS_DIR,
  buildJobLogPath,
  buildJobRunPath,
  ensureDir,
  mergeRecordsById,
  normalizeString,
  readJsonSafe,
  sortByTimestampDesc,
  toSerializableError,
} from "./shared.js";
import {
  buildExecutorColumns,
  fromDbTimestamp,
  parseJsonColumn,
  stringifyJsonColumn,
  toDbTimestamp,
  withOperatorDbFallback,
} from "./operatorPersistence.js";

const TERMINAL_STATUSES = new Set([
  "success",
  "blocked",
  "failed",
  "cancelled",
  "complete",
]);

function normalizeJobRun(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  return {
    id: normalizeString(payload.id),
    actionId: normalizeString(payload.actionId),
    actionTitle: normalizeString(payload.actionTitle),
    workflowFamily: normalizeString(payload.workflowFamily),
    runnerType: normalizeString(payload.runnerType) || "cli",
    status:
      normalizeString(payload.status) === "complete"
        ? "success"
        : normalizeString(payload.status) || "queued",
    summary: normalizeString(payload.summary),
    errorJson: payload.errorJson || payload.error || null,
    input: payload.input && typeof payload.input === "object" ? payload.input : {},
    command: payload.command || null,
    jobLogPath: normalizeString(payload.jobLogPath),
    artifacts: Array.isArray(payload.artifacts) ? payload.artifacts : [],
    sessionIds: Array.isArray(payload.sessionIds) ? payload.sessionIds : [],
    timestamps: payload.timestamps && typeof payload.timestamps === "object"
      ? payload.timestamps
      : {},
    output: payload.output && typeof payload.output === "object" ? payload.output : {},
    metadataJson:
      payload.metadataJson && typeof payload.metadataJson === "object" ? payload.metadataJson : {},
    cancellation: payload.cancellation && typeof payload.cancellation === "object"
      ? payload.cancellation
      : { supported: true, requestedAt: null, cancelledAt: null },
  };
}

function normalizeDbJobRun(row) {
  if (!row) {
    return null;
  }

  return normalizeJobRun({
    id: row.id,
    actionId: row.action_id,
    actionTitle: row.action_title,
    workflowFamily: row.workflow_family,
    runnerType: row.runner_type,
    status: row.status,
    summary: row.summary,
    errorJson: parseJsonColumn(row.error_json, null),
    input: parseJsonColumn(row.input_json, {}),
    command: parseJsonColumn(row.command_json, null),
    jobLogPath: row.job_log_path,
    artifacts: parseJsonColumn(row.artifacts_json, []),
    sessionIds: parseJsonColumn(row.session_ids_json, []),
    timestamps: {
      createdAt: fromDbTimestamp(row.created_at),
      queuedAt: fromDbTimestamp(row.queued_at),
      startedAt: fromDbTimestamp(row.started_at),
      finishedAt: fromDbTimestamp(row.finished_at),
      updatedAt: fromDbTimestamp(row.updated_at),
    },
    output: parseJsonColumn(row.output_json, {}),
    metadataJson: parseJsonColumn(row.metadata_json, {}),
    cancellation: parseJsonColumn(row.cancellation_json, {
      supported: true,
      requestedAt: null,
      cancelledAt: null,
    }),
  });
}

async function writeJobRunFile(job) {
  const normalized = normalizeJobRun(job);
  if (!normalized?.id) {
    throw new Error("Job run is missing an id.");
  }

  await ensureDir(JOB_RUNS_DIR);
  await fs.writeFile(
    buildJobRunPath(normalized.id),
    `${JSON.stringify(normalized, null, 2)}\n`,
    "utf8"
  );

  return normalized;
}

async function createJobRunDb(entry) {
  const normalized = normalizeJobRun(entry);
  const executorColumns = buildExecutorColumns(normalized.metadataJson);
  await withOperatorDbFallback(
    async (db) => {
      await db.execute(
        `INSERT INTO operator_job_runs (
          id,
          action_id,
          action_title,
          workflow_family,
          runner_type,
          status,
          summary,
          error_json,
          input_json,
          command_json,
          job_log_path,
          artifacts_json,
          session_ids_json,
          output_json,
          metadata_json,
          cancellation_json,
          executor_model,
          executor_backend,
          executor_host,
          executor_transport,
          execution_mode,
          created_at,
          queued_at,
          started_at,
          finished_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          normalized.id,
          normalized.actionId,
          normalized.actionTitle,
          normalized.workflowFamily,
          normalized.runnerType,
          normalized.status,
          normalized.summary,
          stringifyJsonColumn(normalized.errorJson, null),
          stringifyJsonColumn(normalized.input, {}),
          stringifyJsonColumn(normalized.command, null),
          normalized.jobLogPath,
          stringifyJsonColumn(normalized.artifacts, []),
          stringifyJsonColumn(normalized.sessionIds, []),
          stringifyJsonColumn(normalized.output, {}),
          stringifyJsonColumn(normalized.metadataJson, {}),
          stringifyJsonColumn(normalized.cancellation, {
            supported: true,
            requestedAt: null,
            cancelledAt: null,
          }),
          executorColumns.executorModel,
          executorColumns.executorBackend,
          executorColumns.executorHost,
          executorColumns.executorTransport,
          executorColumns.executionMode,
          toDbTimestamp(normalized.timestamps?.createdAt),
          toDbTimestamp(normalized.timestamps?.queuedAt),
          toDbTimestamp(normalized.timestamps?.startedAt),
          toDbTimestamp(normalized.timestamps?.finishedAt),
          toDbTimestamp(normalized.timestamps?.updatedAt),
        ]
      );
      return normalized;
    },
    async () => writeJobRunFile(normalized)
  );

  return normalized;
}

async function listJobRunsFile() {
  const entries = await fs.readdir(JOB_RUNS_DIR, { withFileTypes: true }).catch(() => []);
  return (
    await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) => readJsonSafe(buildJobRunPath(entry.name.replace(/\.json$/, ""))))
    )
  )
    .map(normalizeJobRun)
    .filter(Boolean);
}

async function listJobRunsDb() {
  return withOperatorDbFallback(
    async (db) => {
      const [rows] = await db.execute(
        `SELECT *
         FROM operator_job_runs
         ORDER BY updated_at DESC, created_at DESC`
      );
      return rows.map(normalizeDbJobRun).filter(Boolean);
    },
    async () => listJobRunsFile()
  );
}

async function getJobRunDb(jobId) {
  return withOperatorDbFallback(
    async (db) => {
      const [rows] = await db.execute(
        `SELECT *
         FROM operator_job_runs
         WHERE id = ?
         LIMIT 1`,
        [jobId]
      );
      return normalizeDbJobRun(rows[0] || null);
    },
    async () => normalizeJobRun(await readJsonSafe(buildJobRunPath(jobId)))
  );
}

export async function createJobRun(entry) {
  const now = new Date().toISOString();
  const jobId = normalizeString(entry?.id) || `job_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const job = {
    id: jobId,
    actionId: normalizeString(entry?.actionId),
    actionTitle: normalizeString(entry?.actionTitle),
    workflowFamily: normalizeString(entry?.workflowFamily),
    runnerType: normalizeString(entry?.runnerType) || "cli",
    status: normalizeString(entry?.status) || "queued",
    summary: normalizeString(entry?.summary),
    errorJson: entry?.errorJson || entry?.error || null,
    input: entry?.input && typeof entry.input === "object" ? entry.input : {},
    command: entry?.command || null,
    jobLogPath: buildJobLogPath(jobId),
    artifacts: Array.isArray(entry?.artifacts) ? entry.artifacts : [],
    sessionIds: Array.isArray(entry?.sessionIds) ? entry.sessionIds : [],
    timestamps: {
      createdAt: now,
      queuedAt: now,
      startedAt: entry?.timestamps?.startedAt || null,
      finishedAt: entry?.timestamps?.finishedAt || null,
      updatedAt: now,
    },
    output: entry?.output && typeof entry.output === "object" ? entry.output : {},
    metadataJson:
      entry?.metadataJson && typeof entry.metadataJson === "object" ? entry.metadataJson : {},
    cancellation: {
      supported: true,
      requestedAt: null,
      cancelledAt: null,
    },
  };

  await ensureDir(JOB_LOGS_DIR);
  await fs.writeFile(job.jobLogPath, "", "utf8").catch(() => {});
  return createJobRunDb(job);
}

export async function appendJobLog(jobId, message, level = "info") {
  const text = normalizeString(message);
  if (!text) {
    return;
  }

  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${level.toUpperCase()} ${text}\n`;

  await withOperatorDbFallback(
    async (db) => {
      await db.execute(
        `INSERT INTO operator_job_logs (
          job_run_id,
          level,
          message,
          created_at
        ) VALUES (?, ?, ?, ?)`,
        [jobId, normalizeString(level) || "info", text, toDbTimestamp(timestamp)]
      );
      return true;
    },
    async () => {
      await ensureDir(JOB_LOGS_DIR);
      await fs.appendFile(buildJobLogPath(jobId), line, "utf8");
      return true;
    }
  );
}

export async function getJobRun(jobId) {
  const normalizedId = normalizeString(jobId);
  if (!normalizedId) {
    return null;
  }

  const dbRecord = await getJobRunDb(normalizedId);
  if (dbRecord) {
    return dbRecord;
  }

  return normalizeJobRun(await readJsonSafe(buildJobRunPath(normalizedId)));
}

export async function updateJobRun(jobId, patch = {}) {
  const current = await getJobRun(jobId);
  if (!current) {
    throw new Error(`Job run ${jobId} was not found.`);
  }

  const next = {
    ...current,
    ...patch,
    id: current.id,
    timestamps: {
      ...current.timestamps,
      ...(patch.timestamps || {}),
      updatedAt: new Date().toISOString(),
    },
  };

  if (patch.errorJson instanceof Error) {
    next.errorJson = toSerializableError(patch.errorJson);
  } else if (patch.error instanceof Error) {
    next.errorJson = toSerializableError(patch.error);
  } else if (patch.errorJson) {
    next.errorJson = patch.errorJson;
  } else if (patch.error) {
    next.errorJson = patch.error;
  }

  if (patch.output && typeof patch.output === "object") {
    next.output = patch.output;
  }

  if (patch.metadataJson && typeof patch.metadataJson === "object") {
    next.metadataJson = patch.metadataJson;
  }

  if (Array.isArray(patch.artifacts)) {
    next.artifacts = patch.artifacts;
  }

  if (Array.isArray(patch.sessionIds)) {
    next.sessionIds = patch.sessionIds;
  }

  const normalized = normalizeJobRun(next);
  const executorColumns = buildExecutorColumns(normalized.metadataJson);

  await withOperatorDbFallback(
    async (db) => {
      await db.execute(
        `UPDATE operator_job_runs
         SET action_id = ?,
             action_title = ?,
             workflow_family = ?,
             runner_type = ?,
             status = ?,
             summary = ?,
             error_json = ?,
             input_json = ?,
             command_json = ?,
             job_log_path = ?,
             artifacts_json = ?,
             session_ids_json = ?,
             output_json = ?,
             metadata_json = ?,
             cancellation_json = ?,
             executor_model = ?,
             executor_backend = ?,
             executor_host = ?,
             executor_transport = ?,
             execution_mode = ?,
             created_at = ?,
             queued_at = ?,
             started_at = ?,
             finished_at = ?,
             updated_at = ?
         WHERE id = ?`,
        [
          normalized.actionId,
          normalized.actionTitle,
          normalized.workflowFamily,
          normalized.runnerType,
          normalized.status,
          normalized.summary,
          stringifyJsonColumn(normalized.errorJson, null),
          stringifyJsonColumn(normalized.input, {}),
          stringifyJsonColumn(normalized.command, null),
          normalized.jobLogPath,
          stringifyJsonColumn(normalized.artifacts, []),
          stringifyJsonColumn(normalized.sessionIds, []),
          stringifyJsonColumn(normalized.output, {}),
          stringifyJsonColumn(normalized.metadataJson, {}),
          stringifyJsonColumn(normalized.cancellation, {
            supported: true,
            requestedAt: null,
            cancelledAt: null,
          }),
          executorColumns.executorModel,
          executorColumns.executorBackend,
          executorColumns.executorHost,
          executorColumns.executorTransport,
          executorColumns.executionMode,
          toDbTimestamp(normalized.timestamps?.createdAt),
          toDbTimestamp(normalized.timestamps?.queuedAt),
          toDbTimestamp(normalized.timestamps?.startedAt),
          toDbTimestamp(normalized.timestamps?.finishedAt),
          toDbTimestamp(normalized.timestamps?.updatedAt),
          normalized.id,
        ]
      );
      return normalized;
    },
    async () => writeJobRunFile(normalized)
  );

  return normalized;
}

export async function listJobRuns({ limit = 25 } = {}) {
  const [dbRecords, fileRecords] = await Promise.all([
    listJobRunsDb(),
    listJobRunsFile(),
  ]);
  const merged = mergeRecordsById([...dbRecords, ...fileRecords])
    .map(normalizeJobRun)
    .filter(Boolean);
  const sorted = sortByTimestampDesc(merged, (job) => job.timestamps?.updatedAt || job.timestamps?.createdAt);
  if (!Number.isFinite(limit) || limit <= 0) {
    return sorted;
  }
  return sorted.slice(0, limit);
}

export async function readJobLog(jobId) {
  return withOperatorDbFallback(
    async (db) => {
      const [rows] = await db.execute(
        `SELECT level, message, created_at
         FROM operator_job_logs
         WHERE job_run_id = ?
         ORDER BY created_at ASC, id ASC`,
        [jobId]
      );
      if (!rows.length) {
        return "";
      }
      return rows
        .map(
          (row) =>
            `[${fromDbTimestamp(row.created_at) || new Date().toISOString()}] ${String(row.level || "info").toUpperCase()} ${row.message}`
        )
        .join("\n")
        .concat("\n");
    },
    async () => {
      try {
        return await fs.readFile(buildJobLogPath(jobId), "utf8");
      } catch {
        return "";
      }
    }
  );
}

export function isTerminalJobStatus(status) {
  return TERMINAL_STATUSES.has(normalizeString(status));
}
