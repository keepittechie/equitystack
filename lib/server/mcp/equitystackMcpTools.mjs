import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const PYTHON_DIR = path.join(PROJECT_ROOT, "python");
const OPERATOR_DATA_DIR = path.join(PYTHON_DIR, "reports", "admin_operator_command_center");
const JOB_RUNS_DIR = path.join(OPERATOR_DATA_DIR, "job_runs");
const JOB_LOGS_DIR = path.join(OPERATOR_DATA_DIR, "job_logs");
const EQUITYSTACK_CLI_RELATIVE = "./bin/equitystack";

const REPORT_ENDPOINTS = Object.freeze({
  overall_summary: "/api/reports/overall-summary",
  category_summary: "/api/reports/category-summary",
  party_score_summary: "/api/reports/party-score-summary",
  era_summary: "/api/reports/era-summary",
  direct_impact_by_party: "/api/reports/direct-impact-by-party",
  direct_impact_by_era: "/api/reports/direct-impact-by-era",
  top_policies: "/api/reports/top-policies",
  policy_evidence_summary: "/api/reports/policy-evidence-summary",
  scorecards_overview: "/api/scorecards/overview",
});

function boolValue(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function shellEscape(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function stringValue(value) {
  return normalizeString(value);
}

function resolveShellBinary() {
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

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

function buildJobLogPath(jobId) {
  return path.join(JOB_LOGS_DIR, `${jobId}.log`);
}

function buildJobRunPath(jobId) {
  return path.join(JOB_RUNS_DIR, `${jobId}.json`);
}

function buildShellCommand(args = []) {
  return `cd "$EQUITYSTACK_RUNTIME_PYTHON_DIR" && "${EQUITYSTACK_CLI_RELATIVE}" ${args
    .map(shellEscape)
    .join(" ")}`;
}

function toSerializableError(error) {
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

async function runCliAction({
  args = [],
  timeoutMs = 60 * 60 * 1000,
  envOverrides = {},
} = {}) {
  const shellBinary = resolveShellBinary();
  const command = buildShellCommand(args);
  const startedAt = new Date().toISOString();
  const started = Date.now();

  try {
    const { stdout, stderr } = await execFileAsync(shellBinary, ["-lc", command], {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        EQUITYSTACK_RUNTIME_PYTHON_DIR: PYTHON_DIR,
        ...envOverrides,
      },
      timeout: timeoutMs,
      maxBuffer: 20 * 1024 * 1024,
    });

    return {
      ok: true,
      command,
      args,
      exitCode: 0,
      timedOut: false,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      stdout: normalizeString(stdout),
      stderr: normalizeString(stderr),
    };
  } catch (error) {
    const killedByTimeout = Boolean(error?.killed) || error?.signal === "SIGTERM";
    return {
      ok: false,
      command,
      args,
      exitCode: Number.isInteger(error?.code) ? error.code : 1,
      timedOut: killedByTimeout,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      stdout: normalizeString(error?.stdout),
      stderr: normalizeString(error?.stderr),
      errorMessage:
        normalizeString(error?.message) ||
        "The wrapped CLI action failed.",
    };
  }
}

function truncate(value, limit = 2000) {
  const text = normalizeString(value);
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit)}...<truncated ${text.length - limit} chars>`;
}

function commandFromJob(job) {
  if (normalizeString(job?.output?.command)) {
    return job.output.command;
  }
  const args = Array.isArray(job?.command?.args) ? job.command.args : [];
  return args.length ? `./python/bin/equitystack ${args.join(" ")}` : null;
}

function nowIso() {
  return new Date().toISOString();
}

function safeJson(value) {
  return JSON.stringify(value, null, 2);
}

function titleForTool(toolName) {
  const titles = {
    get_system_status: "MCP System Status",
    run_current_admin_workflow: "MCP Current-Admin Workflow",
    run_legislative_review: "MCP Legislative Review",
    run_impact_evaluate: "MCP Impact Evaluate",
    run_impact_promote: "MCP Impact Promote",
    generate_reports: "MCP Generate Reports",
    recalculate_president_scores: "MCP Recalculate President Scores",
  };
  return titles[toolName] || `MCP ${toolName}`;
}

function workflowFamilyForTool(toolName) {
  if (toolName === "run_current_admin_workflow") {
    return "current-admin";
  }
  if (toolName === "run_legislative_review") {
    return "legislative";
  }
  return "system";
}

function recommendedNextStepForTool(toolName) {
  if (toolName === "run_legislative_review") {
    return "Open legislative review";
  }
  if (toolName === "run_current_admin_workflow") {
    return "Open current-admin session";
  }
  if (toolName === "run_impact_promote") {
    return "Inspect impact promotion report";
  }
  if (toolName === "run_impact_evaluate") {
    return "Inspect impact maturation review";
  }
  return null;
}

async function writeMcpJob(job) {
  await ensureDir(JOB_RUNS_DIR);
  await fs.writeFile(buildJobRunPath(job.id), `${safeJson(job)}\n`, "utf8");
  return job;
}

async function writeMcpJobLog(jobId, lines = []) {
  await ensureDir(JOB_LOGS_DIR);
  await fs.writeFile(
    buildJobLogPath(jobId),
    `${lines.filter(Boolean).join("\n")}\n`,
    "utf8"
  );
}

function createMcpJob({ toolName, input, args, summary }) {
  const createdAt = nowIso();
  const jobId = `mcp_${createdAt.replace(/[-:.TZ]/g, "")}_${randomUUID().slice(0, 8)}`;
  const executionMetadata = {
    execution_mode: "mcp_runtime",
    executor_model:
      normalizeString(process.env.MCP_MODEL) ||
      normalizeString(process.env.EQUITYSTACK_EXECUTOR_MODEL) ||
      normalizeString(process.env.EQUITYSTACK_LLM_MODEL) ||
      null,
    executor_backend: "mcp_runtime",
    executor_host:
      normalizeString(process.env.EQUITYSTACK_MCP_EXECUTOR_HOST) ||
      normalizeString(process.env.HOSTNAME) ||
      "localhost",
    executor_transport: "stdio",
    trigger_source: "mcp",
    mcp_tool: toolName,
  };

  return {
    id: jobId,
    actionId: `mcp.${toolName}`,
    actionTitle: titleForTool(toolName),
    workflowFamily: workflowFamilyForTool(toolName),
    runnerType: "mcp_runtime",
    status: "queued",
    summary: summary || `${titleForTool(toolName)} queued.`,
    errorJson: null,
    input: input && typeof input === "object" ? input : {},
    command: {
      args,
      commandLabel: "./bin/equitystack",
    },
    jobLogPath: buildJobLogPath(jobId),
    artifacts: [],
    sessionIds: [],
    timestamps: {
      createdAt,
      queuedAt: createdAt,
      startedAt: null,
      finishedAt: null,
      updatedAt: createdAt,
    },
    output: {},
    metadataJson: executionMetadata,
    cancellation: {
      supported: true,
      requestedAt: null,
      cancelledAt: null,
    },
  };
}

async function runLoggedCliAction({
  toolName,
  input,
  args,
  summary,
  successSummary,
  failureSummary,
  timeoutMs,
  warnings = [],
}) {
  const job = createMcpJob({ toolName, input, args, summary });
  await writeMcpJob(job);

  const startedAt = nowIso();
  job.status = "running";
  job.summary = summary || `${titleForTool(toolName)} is running.`;
  job.timestamps.startedAt = startedAt;
  job.timestamps.updatedAt = startedAt;
  await writeMcpJob(job);

  const result = await runCliAction({ args, timeoutMs });
  const finishedAt = result.finishedAt || nowIso();
  const failed = !result.ok;
  const failureMessage = result.errorMessage || result.stderr || "Command failed.";
  const recommendedNextStep = failed ? recommendedNextStepForTool(toolName) : null;

  job.status = result.ok ? "success" : "failed";
  job.summary = result.ok
    ? successSummary || `${titleForTool(toolName)} completed.`
    : failureSummary || failureMessage;
  job.errorJson = result.ok
    ? null
    : {
        ...toSerializableError(new Error(failureMessage)),
        recommendedNextStep,
      };
  job.timestamps.startedAt = result.startedAt || startedAt;
  job.timestamps.finishedAt = finishedAt;
  job.timestamps.updatedAt = finishedAt;
  job.output = {
    command: result.command,
    args: result.args,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    durationMs: result.durationMs,
    stdout: result.stdout,
    stderr: result.stderr,
  };
  job.metadataJson = {
    ...job.metadataJson,
    failure: failed
      ? {
          message: failureMessage,
          nextSafeActionTitle: recommendedNextStep,
          likelySource: result.timedOut ? "MCP CLI timeout" : "MCP CLI runner",
        }
      : null,
  };

  await writeMcpJobLog(job.id, [
    `[${job.timestamps.startedAt}] ${titleForTool(toolName)}`,
    `Command: ${result.command}`,
    result.stdout ? "\n--- stdout ---\n" + result.stdout : "",
    result.stderr ? "\n--- stderr ---\n" + result.stderr : "",
    `[${finishedAt}] exit_code=${result.exitCode} status=${job.status}`,
  ]);
  await writeMcpJob(job);

  return resultFromJob({
    job,
    summary: job.summary,
    warnings,
  });
}

function artifactsFromJob(job) {
  return (Array.isArray(job?.artifacts) ? job.artifacts : [])
    .filter((artifact) => artifact?.exists)
    .map((artifact) => ({
      key: artifact.artifactKey || null,
      label: artifact.label || null,
      path: artifact.canonicalPath || artifact.path || null,
      stage: artifact.stage || null,
    }));
}

function resultFromJob({ job, summary, warnings = [] }) {
  const ok = job?.status === "success";
  const failure = job?.metadataJson?.failure || null;
  const stderr = truncate(job?.output?.stderr || "");
  const errorText =
    normalizeString(failure?.message) ||
    normalizeString(job?.errorJson?.message) ||
    stderr ||
    (ok ? "" : normalizeString(job?.summary));

  return {
    ok,
    command: commandFromJob(job),
    exit_code: Number.isInteger(job?.output?.exitCode) ? job.output.exitCode : ok ? 0 : 1,
    job_id: job?.id || null,
    status: job?.status || "unknown",
    started_at: job?.timestamps?.startedAt || null,
    completed_at: job?.timestamps?.finishedAt || null,
    summary: summary || job?.summary || null,
    artifacts: artifactsFromJob(job),
    warnings,
    errors: ok ? [] : [errorText || "Command failed."],
    recommended_next_step: failure?.nextSafeActionTitle || null,
    stdout: truncate(job?.output?.stdout || ""),
    stderr,
  };
}

function timestampFromJob(job) {
  return (
    normalizeString(job?.timestamps?.finishedAt) ||
    normalizeString(job?.timestamps?.updatedAt) ||
    normalizeString(job?.timestamps?.startedAt) ||
    normalizeString(job?.timestamps?.createdAt) ||
    null
  );
}

function exitCodeFromJob(job) {
  if (Number.isInteger(job?.output?.exitCode)) {
    return job.output.exitCode;
  }
  if (Number.isInteger(job?.output?.exit_code)) {
    return job.output.exit_code;
  }
  return null;
}

function statusFromExitCode(exitCode) {
  if (exitCode === 0) {
    return "success";
  }
  if (Number.isInteger(exitCode)) {
    return "failed";
  }
  return "unknown";
}

function commandNameFromJob(job) {
  const args = Array.isArray(job?.command?.args) ? job.command.args : [];
  if (args.length) {
    return args.join(" ");
  }
  return normalizeString(job?.output?.command) || normalizeString(job?.actionTitle);
}

function warningsFromJob(job) {
  const warnings = job?.output?.warnings || job?.metadataJson?.warnings || [];
  return Array.isArray(warnings) ? warnings.map((warning) => normalizeString(warning)).filter(Boolean) : [];
}

function errorsFromJob(job, status) {
  if (status !== "failed") {
    return [];
  }
  const message =
    normalizeString(job?.errorJson?.message) ||
    normalizeString(job?.metadataJson?.failure?.message) ||
    normalizeString(job?.output?.stderr) ||
    normalizeString(job?.summary);
  return message ? [truncate(message, 1000)] : ["Command failed."];
}

function normalizeSystemStatusJob(job) {
  const exitCode = exitCodeFromJob(job);
  const status = statusFromExitCode(exitCode);
  return {
    timestamp: timestampFromJob(job),
    command: commandNameFromJob(job),
    status,
    summary: normalizeString(job?.summary),
    exit_code: exitCode,
    artifacts: artifactsFromJob(job),
    warnings: warningsFromJob(job),
    errors: errorsFromJob(job, status),
    job_id: normalizeString(job?.id) || null,
    action: normalizeString(job?.actionTitle) || normalizeString(job?.actionId) || null,
  };
}

async function readJsonFileSafe(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function listRecentJobRunPayloads(maxFiles = 500) {
  const entries = await fs.readdir(JOB_RUNS_DIR, { withFileTypes: true }).catch(() => []);
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(JOB_RUNS_DIR, entry.name));

  const stats = await Promise.all(
    files.map(async (filePath) => ({
      filePath,
      stat: await fs.stat(filePath).catch(() => null),
    }))
  );

  const recentFiles = stats
    .filter((entry) => entry.stat)
    .sort((left, right) => right.stat.mtimeMs - left.stat.mtimeMs)
    .slice(0, maxFiles)
    .map((entry) => entry.filePath);

  const payloads = await Promise.all(recentFiles.map((filePath) => readJsonFileSafe(filePath)));
  return payloads.filter((payload) => payload && typeof payload === "object");
}

async function getSystemStatus(input = {}) {
  const limit = Math.min(Math.max(Number.parseInt(input.limit, 10) || 10, 1), 100);
  const statusFilter = stringValue(input.status_filter) || "all";
  if (!["success", "failed", "all"].includes(statusFilter)) {
    throw new Error("status_filter must be one of: success, failed, all.");
  }
  const commandFilter = stringValue(input.command_filter).toLowerCase();
  const sinceMinutes = Number.parseInt(input.since_minutes, 10);
  const sinceMs = Number.isFinite(sinceMinutes) && sinceMinutes > 0
    ? Date.now() - sinceMinutes * 60 * 1000
    : null;

  const jobs = (await listRecentJobRunPayloads())
    .map(normalizeSystemStatusJob)
    .filter((job) => {
      if (statusFilter !== "all" && job.status !== statusFilter) {
        return false;
      }
      if (commandFilter) {
        const searchable = `${job.command} ${job.summary} ${job.action}`.toLowerCase();
        if (!searchable.includes(commandFilter)) {
          return false;
        }
      }
      if (sinceMs) {
        const timestamp = new Date(job.timestamp || 0).getTime();
        if (!Number.isFinite(timestamp) || timestamp < sinceMs) {
          return false;
        }
      }
      return true;
    })
    .sort((left, right) => new Date(right.timestamp || 0).getTime() - new Date(left.timestamp || 0).getTime())
    .slice(0, limit);

  return {
    ok: true,
    count: jobs.length,
    jobs,
  };
}

function urlForEndpoint(baseUrl, endpoint, params = {}) {
  const url = new URL(endpoint, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

async function fetchExistingApiEndpoint({ baseUrl, endpoint, params = {}, summary }) {
  const url = urlForEndpoint(baseUrl, endpoint, params);
  const startedAt = new Date().toISOString();
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    return {
      ok: false,
      command: `GET ${url.toString()}`,
      exit_code: 1,
      status: "failed",
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      summary,
      artifacts: [{ key: "api_endpoint", label: endpoint, path: url.toString(), stage: "read" }],
      warnings: [],
      errors: [error instanceof Error ? error.message : "API request failed."],
      response_status: null,
      response: null,
    };
  }
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  return {
    ok: response.ok,
    command: `GET ${url.toString()}`,
    exit_code: response.ok ? 0 : 1,
    status: response.ok ? "success" : "failed",
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    summary,
    artifacts: [{ key: "api_endpoint", label: endpoint, path: url.toString(), stage: "read" }],
    warnings: [],
    errors: response.ok ? [] : [parsed?.error || text || `HTTP ${response.status}`],
    response_status: response.status,
    response: parsed ?? truncate(text),
  };
}

export const MCP_TOOLS = [
  {
    name: "get_system_status",
    description: "Read recent admin/operator and MCP job-run artifacts without executing workflows.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", default: 10, minimum: 1, maximum: 100 },
        status_filter: { type: "string", enum: ["success", "failed", "all"], default: "all" },
        command_filter: { type: "string" },
        since_minutes: { type: "integer", minimum: 1 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "run_current_admin_workflow",
    description: "Run the existing current-admin workflow start path through the CLI runner.",
    inputSchema: {
      type: "object",
      properties: {
        batch_name: { type: "string" },
        input: { type: "string" },
        review_dry_run: { type: "boolean", default: true },
      },
      additionalProperties: false,
    },
  },
  {
    name: "run_legislative_review",
    description: "Run the existing non-interactive legislative review summary path through the CLI runner.",
    inputSchema: {
      type: "object",
      properties: {
        dry_run: { type: "boolean", default: true },
      },
      additionalProperties: false,
    },
  },
  {
    name: "run_impact_evaluate",
    description: "Run the existing impact evaluate CLI path through the CLI runner.",
    inputSchema: {
      type: "object",
      properties: {
        input: { type: "string" },
        output: { type: "string" },
        ledger: { type: "string" },
        only_record_key: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "run_impact_promote",
    description: "Run the existing impact promote CLI path through the CLI runner. Dry-run is default.",
    inputSchema: {
      type: "object",
      properties: {
        input: { type: "string" },
        output: { type: "string" },
        ledger: { type: "string" },
        dry_run: { type: "boolean", default: true },
        apply: { type: "boolean", default: false },
        approve_safe: { type: "boolean", default: false },
        yes: { type: "boolean", default: false },
        only_record_key: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "generate_reports",
    description: "Expose existing dynamic report API endpoints. If report_name is provided, fetch that endpoint.",
    inputSchema: {
      type: "object",
      properties: {
        report_name: {
          type: "string",
          enum: ["overall_summary", "category_summary", "party_score_summary", "era_summary", "direct_impact_by_party", "direct_impact_by_era", "top_policies", "policy_evidence_summary", "scorecards_overview"],
        },
        refresh: { type: "boolean", default: true },
        base_url: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "recalculate_president_scores",
    description: "Call the existing dynamic promise score API calculation path.",
    inputSchema: {
      type: "object",
      properties: {
        dry_run: { type: "boolean", default: true },
        president: { type: "string" },
        base_url: { type: "string" },
      },
      additionalProperties: false,
    },
  },
];

export function listMcpTools() {
  return MCP_TOOLS;
}

export async function callMcpTool(name, args = {}) {
  const input = args && typeof args === "object" && !Array.isArray(args) ? args : {};

  if (name === "get_system_status") {
    return getSystemStatus(input);
  }

  if (name === "run_current_admin_workflow") {
    const batchName = stringValue(input.batch_name);
    const explicitInput = stringValue(input.input);
    if (batchName && explicitInput) {
      throw new Error("Use either batch_name or input, not both.");
    }
    const args = ["current-admin", "workflow", "start"];
    if (batchName) {
      args.push("--batch-name", batchName);
    }
    if (explicitInput) {
      args.push("--input", explicitInput);
    }
    if (boolValue(input.review_dry_run, true)) {
      args.push("--review-dry-run");
    }
    return runLoggedCliAction({
      toolName: name,
      input,
      args,
      summary: "Current-admin workflow start requested by MCP.",
      successSummary: "Current-admin workflow start completed.",
      timeoutMs: 60 * 60 * 1000,
    });
  }

  if (name === "run_legislative_review") {
    const warnings = boolValue(input.dry_run, true)
      ? []
      : ["legislative review is non-mutating; dry_run=false has no effect."];
    return runLoggedCliAction({
      toolName: name,
      input,
      args: ["legislative", "review"],
      summary: "Legislative review summary requested by MCP.",
      successSummary: "Legislative review summary completed.",
      timeoutMs: 30 * 60 * 1000,
      warnings,
    });
  }

  if (name === "run_impact_evaluate") {
    const args = ["impact", "evaluate"];
    if (stringValue(input.input)) {
      args.push("--input", stringValue(input.input));
    }
    if (stringValue(input.output)) {
      args.push("--output", stringValue(input.output));
    }
    if (stringValue(input.ledger)) {
      args.push("--ledger", stringValue(input.ledger));
    }
    if (stringValue(input.only_record_key)) {
      args.push("--only-record-key", stringValue(input.only_record_key));
    }
    return runLoggedCliAction({
      toolName: name,
      input,
      args,
      summary: "Impact maturation evaluation requested by MCP.",
      successSummary: "Impact maturation evaluation completed.",
      timeoutMs: 30 * 60 * 1000,
    });
  }

  if (name === "run_impact_promote") {
    const apply = boolValue(input.apply, false);
    const dryRun = input.dry_run === undefined ? !apply : boolValue(input.dry_run, true);
    const yes = boolValue(input.yes, false);
    if (dryRun && apply) {
      throw new Error("Use either dry_run=true or apply=true, not both.");
    }
    if (apply && !yes) {
      throw new Error("impact promote apply requires yes=true.");
    }
    const args = ["impact", "promote"];
    if (stringValue(input.input)) {
      args.push("--input", stringValue(input.input));
    }
    if (stringValue(input.output)) {
      args.push("--output", stringValue(input.output));
    }
    if (stringValue(input.ledger)) {
      args.push("--ledger", stringValue(input.ledger));
    }
    args.push(apply ? "--apply" : "--dry-run");
    if (yes) {
      args.push("--yes");
    }
    if (boolValue(input.approve_safe, false)) {
      args.push("--approve-safe");
    }
    if (stringValue(input.only_record_key)) {
      args.push("--only-record-key", stringValue(input.only_record_key));
    }
    return runLoggedCliAction({
      toolName: name,
      input,
      args,
      summary: "Impact maturation promotion requested by MCP.",
      successSummary: apply
        ? "Impact maturation promotion apply completed."
        : "Impact maturation promotion dry-run completed.",
      timeoutMs: 45 * 60 * 1000,
    });
  }

  if (name === "generate_reports") {
    const reportName = stringValue(input.report_name);
    const baseUrl =
      stringValue(input.base_url) ||
      stringValue(process.env.EQUITYSTACK_BASE_URL) ||
      DEFAULT_BASE_URL;
    if (!reportName) {
      return {
        ok: true,
        command: null,
        exit_code: 0,
        status: "success",
        summary: "Available dynamic report API endpoints.",
        artifacts: Object.entries(REPORT_ENDPOINTS).map(([key, endpoint]) => ({
          key,
          label: key,
          path: new URL(endpoint, baseUrl).toString(),
          stage: "read",
        })),
        warnings: [
          "No separate report refresh CLI exists; reports are generated by existing API/service endpoints.",
        ],
        errors: [],
      };
    }
    const endpoint = REPORT_ENDPOINTS[reportName];
    if (!endpoint) {
      throw new Error(`Unknown report_name: ${reportName}`);
    }
    const result = await fetchExistingApiEndpoint({
      baseUrl,
      endpoint,
      summary: `Fetched existing report endpoint: ${reportName}.`,
    });
    result.warnings.push("No separate report refresh CLI exists; this uses the existing dynamic API endpoint.");
    return result;
  }

  if (name === "recalculate_president_scores") {
    const baseUrl =
      stringValue(input.base_url) ||
      stringValue(process.env.EQUITYSTACK_BASE_URL) ||
      DEFAULT_BASE_URL;
    const result = await fetchExistingApiEndpoint({
      baseUrl,
      endpoint: "/api/promises/scores",
      params: { model: "outcome" },
      summary: "Fetched existing dynamic president score calculation endpoint.",
    });
    if (boolValue(input.dry_run, true)) {
      result.warnings.push("dry_run=true is informational; the existing score endpoint is read-only/dynamic.");
    }
    if (stringValue(input.president)) {
      result.warnings.push("The existing score endpoint does not support a president filter; the full score payload was returned.");
    }
    return result;
  }

  throw new Error(`Unknown MCP tool: ${name}`);
}
