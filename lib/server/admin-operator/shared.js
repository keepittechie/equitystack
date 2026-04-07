import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PROJECT_ROOT = path.resolve(__dirname, "../../..");
export const PYTHON_DIR = path.join(PROJECT_ROOT, "python");
export const REPORTS_DIR = path.join(PYTHON_DIR, "reports");
export const OPERATOR_DATA_DIR = path.join(REPORTS_DIR, "admin_operator_command_center");
export const JOB_RUNS_DIR = path.join(OPERATOR_DATA_DIR, "job_runs");
export const JOB_LOGS_DIR = path.join(OPERATOR_DATA_DIR, "job_logs");
export const WORKFLOW_SESSIONS_DIR = path.join(OPERATOR_DATA_DIR, "workflow_sessions");
export const ARTIFACT_RECORDS_DIR = path.join(OPERATOR_DATA_DIR, "artifacts");
export const REVIEW_QUEUE_DIR = path.join(OPERATOR_DATA_DIR, "review_queue");
export const SYSTEM_SIGNALS_DIR = path.join(OPERATOR_DATA_DIR, "system_signals");
export const COMMAND_HISTORY_DIR = path.join(OPERATOR_DATA_DIR, "command_history");
export const OPERATOR_SCHEDULES_DIR = path.join(OPERATOR_DATA_DIR, "schedules");
export const EQUITYSTACK_RUNTIME_DIR = PYTHON_DIR;
export const EQUITYSTACK_CLI_RELATIVE = "./bin/equitystack";
export const EXECUTION_MODES = Object.freeze({
  LOCAL_CLI: "local_cli",
  REMOTE_EXECUTOR: "remote_executor",
  MCP_RUNTIME: "mcp_runtime",
});

export function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function toArray(value) {
  return Array.isArray(value) ? value : [];
}

export function toSafeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function toIsoTimestamp(value) {
  const text = normalizeString(value);
  if (!text) {
    return null;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

export function shellEscape(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

export function buildJobLogPath(jobId) {
  return path.join(JOB_LOGS_DIR, `${jobId}.log`);
}

export function buildJobRunPath(jobId) {
  return path.join(JOB_RUNS_DIR, `${jobId}.json`);
}

export function buildWorkflowSessionPath(sessionId) {
  return path.join(WORKFLOW_SESSIONS_DIR, `${toHashedFileStem(sessionId)}.json`);
}

export function buildArtifactRecordPath(artifactId) {
  return path.join(ARTIFACT_RECORDS_DIR, `${toHashedFileStem(artifactId)}.json`);
}

export function buildReviewQueueItemPath(itemId) {
  return path.join(REVIEW_QUEUE_DIR, `${toHashedFileStem(itemId)}.json`);
}

export function buildSystemSignalPath(signalId) {
  return path.join(SYSTEM_SIGNALS_DIR, `${toHashedFileStem(signalId)}.json`);
}

export function buildCommandHistoryPath(entryId) {
  return path.join(COMMAND_HISTORY_DIR, `${toHashedFileStem(entryId)}.json`);
}

export function buildOperatorSchedulePath(scheduleId) {
  return path.join(OPERATOR_SCHEDULES_DIR, `${toHashedFileStem(scheduleId)}.json`);
}

export function resolveShellBinary() {
  const candidates = [
    "/bin/bash",
    "/usr/bin/bash",
    normalizeString(process.env.EQUITYSTACK_SHELL_BIN),
    normalizeString(process.env.SHELL),
    "/bin/sh",
    "/usr/bin/sh",
    "sh",
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    if (!candidate.includes("/") || existsSync(candidate)) {
      return candidate;
    }
  }

  return "sh";
}

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function readJsonSafe(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function statSafe(filePath) {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
}

export function toSerializableError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: normalizeString(error.stack),
    };
  }

  return {
    name: "Error",
    message: normalizeString(error) || "Unknown error",
    stack: "",
  };
}

export function sortByTimestampDesc(items, getTimestamp) {
  return [...items].sort((left, right) => {
    const rightTime = new Date(getTimestamp(right) || 0).getTime();
    const leftTime = new Date(getTimestamp(left) || 0).getTime();
    return rightTime - leftTime;
  });
}

export function toBase64Id(value) {
  return Buffer.from(String(value), "utf8").toString("base64url");
}

export function fromBase64Id(value) {
  return Buffer.from(String(value), "base64url").toString("utf8");
}

export function toHashedFileStem(value) {
  return createHash("sha1").update(String(value)).digest("hex");
}

export function toBoundedRecordId(value, prefix = "rec", maxLength = 191) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return "";
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }

  const safePrefix = normalizeString(prefix) || "rec";
  return `${safePrefix}_${toHashedFileStem(normalized)}`;
}

export function uniqueStrings(values = []) {
  return [...new Set(values.map((value) => normalizeString(value)).filter(Boolean))];
}

export function mergeRecordsById(records = []) {
  return Object.values(
    records.reduce((bucket, record) => {
      const id = normalizeString(record?.id);
      if (!id) {
        return bucket;
      }
      bucket[id] = {
        ...(bucket[id] || {}),
        ...record,
      };
      return bucket;
    }, {})
  );
}

export function getReservedExecutorMetadata() {
  return {
    executor_model:
      normalizeString(process.env.MCP_MODEL) ||
      normalizeString(process.env.EQUITYSTACK_EXECUTOR_MODEL) ||
      normalizeString(process.env.EQUITYSTACK_LLM_MODEL) ||
      null,
    executor_backend: normalizeString(process.env.EQUITYSTACK_EXECUTOR_BACKEND) || "llm_provider",
    executor_host: normalizeString(process.env.EQUITYSTACK_EXECUTOR_HOST) || "10.10.0.60",
  };
}

export function getExecutorMetadata() {
  return getReservedExecutorMetadata();
}

export function getRemoteExecutorTarget() {
  const host = normalizeString(process.env.EQUITYSTACK_EXECUTOR_HOST) || "10.10.0.60";
  const explicitTarget = normalizeString(process.env.EQUITYSTACK_REMOTE_EXECUTOR_TARGET);
  if (explicitTarget) {
    return explicitTarget;
  }

  const explicitUser = normalizeString(process.env.EQUITYSTACK_REMOTE_EXECUTOR_USER);
  if (explicitUser) {
    return `${explicitUser}@${host}`;
  }

  return host;
}

export function getRemoteExecutorTransportConfig() {
  const host = normalizeString(process.env.EQUITYSTACK_EXECUTOR_HOST) || "10.10.0.60";
  const llmEndpoint =
    normalizeString(process.env.EQUITYSTACK_LLM_ENDPOINT) ||
    normalizeString(process.env.EQUITYSTACK_REMOTE_EXECUTOR_LLM_ENDPOINT) ||
    normalizeString(process.env.EQUITYSTACK_REMOTE_EXECUTOR_OLLAMA_URL) ||
    "";
  const modelsEndpoint =
    normalizeString(process.env.EQUITYSTACK_LLM_MODELS_ENDPOINT) ||
    normalizeString(process.env.EQUITYSTACK_REMOTE_EXECUTOR_LLM_MODELS_ENDPOINT) ||
    "";
  return {
    transport: normalizeString(process.env.EQUITYSTACK_REMOTE_EXECUTOR_TRANSPORT) || "llm_http",
    target: llmEndpoint,
    host,
    llmEndpoint,
    modelsEndpoint,
    ollamaUrl: llmEndpoint,
  };
}

export function buildExecutionRuntimeMetadata(executionMode, overrides = {}) {
  const mode = normalizeString(executionMode) || EXECUTION_MODES.LOCAL_CLI;
  const reservedExecutor = getReservedExecutorMetadata();

  if (mode === EXECUTION_MODES.LOCAL_CLI) {
    return {
      execution_mode: mode,
      executor_model: null,
      executor_backend: "local_cli",
      executor_host:
        normalizeString(process.env.EQUITYSTACK_LOCAL_EXECUTOR_HOST) ||
        normalizeString(process.env.HOSTNAME) ||
        "localhost",
      executor_transport: "shell",
      ...overrides,
    };
  }

  if (mode === EXECUTION_MODES.REMOTE_EXECUTOR) {
    const remoteTransport = getRemoteExecutorTransportConfig();
    return {
      execution_mode: mode,
      executor_model: reservedExecutor.executor_model,
      executor_backend: reservedExecutor.executor_backend,
      executor_host: remoteTransport.host || reservedExecutor.executor_host,
      executor_transport: remoteTransport.transport,
      executor_transport_target: remoteTransport.target,
      executor_transport_url: remoteTransport.llmEndpoint,
      ...overrides,
    };
  }

  if (mode === EXECUTION_MODES.MCP_RUNTIME) {
    return {
      execution_mode: mode,
      executor_model: reservedExecutor.executor_model,
      executor_backend: "mcp_runtime",
      executor_host: reservedExecutor.executor_host,
      executor_transport:
        normalizeString(process.env.EQUITYSTACK_MCP_RUNTIME_TRANSPORT) || "unconfigured",
      ...overrides,
    };
  }

  return {
    execution_mode: mode,
    executor_model: reservedExecutor.executor_model,
    executor_backend: reservedExecutor.executor_backend,
    executor_host: reservedExecutor.executor_host,
    executor_transport: normalizeString(overrides.executor_transport) || null,
    ...overrides,
  };
}
