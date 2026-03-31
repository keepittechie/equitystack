import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const JOBS_DIR = path.join(
  PROJECT_ROOT,
  "python",
  "reports",
  "admin_operator_execution_jobs"
);
const TERMINAL_STATUSES = new Set([
  "stopped_review",
  "stopped_admin_approval",
  "complete",
  "blocked",
  "failed",
]);
const DEFAULT_JOB_LIMIT = 20;

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function buildJobPath(executionId) {
  return path.join(JOBS_DIR, `${executionId}.json`);
}

async function readJsonSafe(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeJobPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  return {
    id: normalizeString(payload.id) || null,
    action_id: normalizeString(payload.action_id) || null,
    action_label: normalizeString(payload.action_label) || null,
    workflow_type: normalizeString(payload.workflow_type) || null,
    command: normalizeString(payload.command) || null,
    user_input: normalizeString(payload.user_input) || null,
    status: normalizeString(payload.status) || "queued",
    stop_point: payload.stop_point || null,
    summary: normalizeString(payload.summary) || null,
    error: normalizeString(payload.error) || null,
    started_at: normalizeString(payload.started_at) || null,
    finished_at: normalizeString(payload.finished_at) || null,
    updated_at: normalizeString(payload.updated_at) || null,
    next_recommended_step: payload.next_recommended_step || null,
    args: payload.args && typeof payload.args === "object" ? payload.args : {},
    trace: payload.trace && typeof payload.trace === "object" ? payload.trace : null,
  };
}

async function writeJob(job) {
  const normalized = normalizeJobPayload(job);
  if (!normalized?.id) {
    throw new Error("Execution job is missing an id.");
  }

  await fs.mkdir(JOBS_DIR, { recursive: true });
  await fs.writeFile(
    buildJobPath(normalized.id),
    `${JSON.stringify(normalized, null, 2)}\n`,
    "utf8"
  );

  return normalized;
}

export async function createOperatorExecutionJob(entry) {
  const now = new Date().toISOString();
  const job = {
    id: normalizeString(entry?.id) || `exec_${Date.now()}_${randomUUID().slice(0, 8)}`,
    action_id: normalizeString(entry?.action_id) || null,
    action_label: normalizeString(entry?.action_label) || null,
    workflow_type: normalizeString(entry?.workflow_type) || null,
    command: normalizeString(entry?.command) || null,
    user_input: normalizeString(entry?.user_input) || null,
    status: normalizeString(entry?.status) || "queued",
    stop_point: entry?.stop_point || null,
    summary: normalizeString(entry?.summary) || null,
    error: normalizeString(entry?.error) || null,
    started_at: normalizeString(entry?.started_at) || now,
    finished_at: normalizeString(entry?.finished_at) || null,
    updated_at: now,
    next_recommended_step: entry?.next_recommended_step || null,
    args: entry?.args && typeof entry.args === "object" ? entry.args : {},
    trace: entry?.trace && typeof entry.trace === "object" ? entry.trace : null,
  };

  return writeJob(job);
}

export async function getOperatorExecutionJob(executionId) {
  const normalizedId = normalizeString(executionId);
  if (!normalizedId) {
    return null;
  }
  return normalizeJobPayload(await readJsonSafe(buildJobPath(normalizedId)));
}

export async function updateOperatorExecutionJob(executionId, patch) {
  const existing = await getOperatorExecutionJob(executionId);
  if (!existing) {
    throw new Error(`Execution job ${executionId} was not found.`);
  }

  const next = {
    ...existing,
    ...patch,
    id: existing.id,
    updated_at: new Date().toISOString(),
  };

  if (patch?.args && typeof patch.args === "object") {
    next.args = patch.args;
  }
  if (patch?.trace && typeof patch.trace === "object") {
    next.trace = patch.trace;
  }

  return writeJob(next);
}

export async function listOperatorExecutionJobs({ limit = DEFAULT_JOB_LIMIT } = {}) {
  const entries = await fs.readdir(JOBS_DIR, { withFileTypes: true }).catch(() => []);
  const filePaths = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(JOBS_DIR, entry.name));

  const jobs = (
    await Promise.all(
      filePaths.map(async (filePath) => {
        const payload = await readJsonSafe(filePath);
        return normalizeJobPayload(payload);
      })
    )
  ).filter(Boolean);

  const sorted = jobs.sort((left, right) => {
    const rightTime = new Date(right.updated_at || right.started_at || 0).getTime();
    const leftTime = new Date(left.updated_at || left.started_at || 0).getTime();
    return rightTime - leftTime;
  });

  if (!Number.isFinite(limit) || limit <= 0) {
    return sorted;
  }
  return sorted.slice(0, limit);
}

export function isTerminalOperatorExecutionJobStatus(status) {
  return TERMINAL_STATUSES.has(normalizeString(status));
}

export function getOperatorExecutionJobsDir() {
  return JOBS_DIR;
}
