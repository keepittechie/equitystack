import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getCurrentAdministrationOperatorWorkspace } from "./currentAdministrationReviewInsightsService.js";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = process.cwd();
const currentAdminReportsDir = path.join(PROJECT_ROOT, "python", "reports", "current_admin");
const reviewDecisionsDir = path.join(currentAdminReportsDir, "review_decisions");

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function writeJson(filePath, payload) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function listDecisionLogsForBatch(batchName) {
  const entries = await fs.readdir(reviewDecisionsDir, { withFileTypes: true }).catch(() => []);
  const matches = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.startsWith(batchName) &&
        entry.name.endsWith(".decision-log.json")
    )
    .map((entry) => path.join(reviewDecisionsDir, entry.name));

  const withStats = await Promise.all(
    matches.map(async (filePath) => ({
      filePath,
      stat: await fs.stat(filePath),
    }))
  );

  return withStats.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
}

function resolveShellBinary() {
  const candidates = [
    normalizeString(process.env.EQUITYSTACK_SHELL_BIN),
    normalizeString(process.env.SHELL),
    "/bin/bash",
    "/usr/bin/bash",
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

function getPythonRuntimePaths() {
  const pythonDirName = ["py", "thon"].join("");
  return {
    pythonDir: path.join(PROJECT_ROOT, pythonDirName),
    cliRelative: [".", "bin", "equitystack"].join("/"),
    venvPython3Relative: [".", "venv", "bin", "python3"].join("/"),
    venvPythonRelative: [".", "venv", "bin", "python"].join("/"),
  };
}

async function runEquitystackCommand(args) {
  const runtimePaths = getPythonRuntimePaths();
  const command =
    `cd "$EQUITYSTACK_RUNTIME_PYTHON_DIR" && ` +
    `"${runtimePaths.cliRelative}" ${args.map(shellEscape).join(" ")}`;
  const shellBinary = resolveShellBinary();
  try {
    const { stdout, stderr } = await execFileAsync(shellBinary, ["-lc", command], {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        EQUITYSTACK_RUNTIME_PYTHON_DIR: runtimePaths.pythonDir,
      },
      maxBuffer: 20 * 1024 * 1024,
    });
    return {
      stdout: stdout?.trim() || "",
      stderr: stderr?.trim() || "",
      command,
    };
  } catch (error) {
    const detail = [error.stdout, error.stderr, error.message]
      .map((value) => normalizeString(value))
      .find(Boolean);
    throw new Error(detail || "The canonical current-admin command failed.");
  }
}

function resolvePythonBinary() {
  const configured = normalizeString(process.env.EQUITYSTACK_PYTHON_BIN);
  if (configured) {
    return configured;
  }

  const runtimePaths = getPythonRuntimePaths();
  const localCandidates = [
    runtimePaths.venvPython3Relative,
    runtimePaths.venvPythonRelative,
  ];
  for (const candidate of localCandidates) {
    if (existsSync(path.join(runtimePaths.pythonDir, candidate.replace(/^\.\//, "")))) {
      return candidate;
    }
  }

  return "python3";
}

function resolveCliLikePath(filePath) {
  const normalized = normalizeString(filePath);
  if (!normalized) {
    return "";
  }
  if (path.isAbsolute(normalized)) {
    return path.resolve(normalized);
  }

  const runtimePaths = getPythonRuntimePaths();
  const candidates = [
    path.resolve(runtimePaths.pythonDir, normalized),
    path.resolve(PROJECT_ROOT, normalized),
  ];
  const existingMatch = candidates.find((candidate) => existsSync(candidate));
  return existingMatch || candidates[0];
}

async function runPythonCommand(args) {
  const pythonBinary = resolvePythonBinary();
  const shellBinary = resolveShellBinary();
  const runtimePaths = getPythonRuntimePaths();
  const command =
    `cd "$EQUITYSTACK_RUNTIME_PYTHON_DIR" && ` +
    `${shellEscape(pythonBinary)} ${args.map(shellEscape).join(" ")}`;
  try {
    const { stdout, stderr } = await execFileAsync(shellBinary, ["-lc", command], {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        EQUITYSTACK_RUNTIME_PYTHON_DIR: runtimePaths.pythonDir,
      },
      maxBuffer: 20 * 1024 * 1024,
    });
    return {
      stdout: stdout?.trim() || "",
      stderr: stderr?.trim() || "",
      command,
    };
  } catch (error) {
    const detail = [error.stdout, error.stderr, error.message]
      .map((value) => normalizeString(value))
      .find(Boolean);
    throw new Error(detail || "The canonical Python command failed.");
  }
}

function deriveBatchNameFromReviewPath(reviewPath) {
  const name = path.basename(reviewPath);
  if (!name.endsWith(".ai-review.json")) {
    throw new Error("Review file must be a .ai-review.json artifact.");
  }
  return name.replace(/\.ai-review\.json$/, "");
}

function shellEscape(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function buildDecisionTemplatePath(reviewPath) {
  const batchName = deriveBatchNameFromReviewPath(reviewPath);
  return path.join(currentAdminReportsDir, `${batchName}.decision-template.json`);
}

function validateDecisionItems(items) {
  if (!Array.isArray(items)) {
    throw new Error("Decision items must be an array.");
  }
}

function assertWorkspaceBatch(workspace) {
  if (!workspace?.batch?.batch_name) {
    throw new Error("No canonical current-admin batch is available.");
  }
}

function assertExpectedQueuePath(workspace, queuePath) {
  assertWorkspaceBatch(workspace);
  const expectedQueuePath = path.resolve(workspace.batch.paths.queue);
  const resolvedQueuePath = resolveCliLikePath(queuePath);

  if (expectedQueuePath !== resolvedQueuePath) {
    throw new Error(
      `Queue path does not match the current canonical batch. Expected ${expectedQueuePath}.`
    );
  }
}

function assertPermission(workspace, permissionKey) {
  const permission = workspace?.action_permissions?.[permissionKey];
  if (!permission?.allowed) {
    const reason = permission?.reasons?.[0] || "The requested action is blocked by the canonical workflow state.";
    throw new Error(reason);
  }
}

function applyDecisionsToTemplate(templatePayload, decisionItems) {
  const bySlug = new Map(
    decisionItems
      .filter((item) => item && normalizeString(item.slug))
      .map((item) => [normalizeString(item.slug), item])
  );

  const nextItems = (templatePayload.items || []).map((item) => {
    const incoming = bySlug.get(item.slug) || {};
    return {
      ...item,
      operator_action: normalizeString(incoming.operator_action),
      operator_notes: normalizeString(incoming.operator_notes),
      final_decision_summary: normalizeString(incoming.final_decision_summary),
      timestamp: incoming.timestamp || item.timestamp || null,
    };
  });

  return {
    ...templatePayload,
    generated_at: new Date().toISOString(),
    items: nextItems,
  };
}

export async function saveCurrentAdministrationDecisionDraft({
  reviewPath,
  decisionItems,
}) {
  validateDecisionItems(decisionItems);
  const resolvedReviewPath = path.resolve(reviewPath);
  const workspace = await getCurrentAdministrationOperatorWorkspace();
  assertWorkspaceBatch(workspace);
  if (path.resolve(workspace.batch.paths.review) !== resolvedReviewPath) {
    throw new Error("Review path does not match the current canonical batch.");
  }
  assertPermission(workspace, "save_decision_draft");
  const outputPath = buildDecisionTemplatePath(resolvedReviewPath);
  let templatePayload = await readJson(outputPath).catch(() => null);
  const templateReviewPath = normalizeString(templatePayload?.source_review_file);
  const templateMatchesReview =
    templateReviewPath && path.resolve(templateReviewPath) === resolvedReviewPath;
  if (!templatePayload || !templateMatchesReview) {
    await runPythonCommand([
      "scripts/generate_current_admin_decision_template.py",
      "--input",
      resolvedReviewPath,
      "--output",
      outputPath,
    ]);
    templatePayload = await readJson(outputPath);
  }
  const mergedPayload = applyDecisionsToTemplate(templatePayload, decisionItems);
  await writeJson(outputPath, mergedPayload);

  return {
    outputPath,
    payload: mergedPayload,
  };
}

export async function finalizeCurrentAdministrationDecisions({
  reviewPath,
  decisionItems,
}) {
  const resolvedReviewPath = path.resolve(reviewPath);
  const workspace = await getCurrentAdministrationOperatorWorkspace();
  assertWorkspaceBatch(workspace);
  if (path.resolve(workspace.batch.paths.review) !== resolvedReviewPath) {
    throw new Error("Review path does not match the current canonical batch.");
  }
  assertPermission(workspace, "finalize");

  const { outputPath } = await saveCurrentAdministrationDecisionDraft({
    reviewPath: resolvedReviewPath,
    decisionItems,
  });
  const batchName = deriveBatchNameFromReviewPath(resolvedReviewPath);

  const commandResult = await runEquitystackCommand([
    "current-admin",
    "workflow",
    "finalize",
    "--review",
    resolvedReviewPath,
    "--decision-file",
    outputPath,
    "--log-decisions",
  ]);

  const decisionLogs = await listDecisionLogsForBatch(batchName);
  const latestDecisionLogPath = decisionLogs[0]?.filePath || null;

  return {
    ...commandResult,
    decisionFilePath: outputPath,
    latestDecisionLogPath,
    workspace: await getCurrentAdministrationOperatorWorkspace(),
  };
}

export async function runCurrentAdministrationPrecommit({ queuePath }) {
  const workspace = await getCurrentAdministrationOperatorWorkspace();
  assertExpectedQueuePath(workspace, queuePath);
  assertPermission(workspace, "run_precommit");

  const resolvedQueuePath = path.resolve(queuePath);
  const commandResult = await runEquitystackCommand([
    "current-admin",
    "pre-commit",
    "--input",
    resolvedQueuePath,
  ]);

  return {
    ...commandResult,
    workspace: await getCurrentAdministrationOperatorWorkspace(),
  };
}

export async function runCurrentAdministrationImport({ queuePath, apply = false }) {
  const workspace = await getCurrentAdministrationOperatorWorkspace();
  assertExpectedQueuePath(workspace, queuePath);
  assertPermission(workspace, apply ? "apply_import" : "run_import_dry_run");

  const resolvedQueuePath = path.resolve(queuePath);
  const args = ["current-admin", "import", "--input", resolvedQueuePath];
  if (apply) {
    args.push("--apply", "--yes");
  }

  const commandResult = await runEquitystackCommand(args);
  return {
    ...commandResult,
    workspace: await getCurrentAdministrationOperatorWorkspace(),
  };
}

export async function runCurrentAdministrationValidation({ queuePath }) {
  const workspace = await getCurrentAdministrationOperatorWorkspace();
  assertExpectedQueuePath(workspace, queuePath);
  assertPermission(workspace, "validate_import");

  const resolvedQueuePath = path.resolve(queuePath);
  const commandResult = await runEquitystackCommand([
    "current-admin",
    "validate",
    "--input",
    resolvedQueuePath,
  ]);

  return {
    ...commandResult,
    workspace: await getCurrentAdministrationOperatorWorkspace(),
  };
}

export async function runCurrentAdministrationStatus() {
  const commandResult = await runEquitystackCommand(["current-admin", "status"]);
  return {
    ...commandResult,
    workspace: await getCurrentAdministrationOperatorWorkspace(),
  };
}

export async function runCurrentAdministrationDiscover() {
  const commandResult = await runEquitystackCommand(["current-admin", "discover"]);
  return {
    ...commandResult,
    workspace: await getCurrentAdministrationOperatorWorkspace(),
  };
}

export async function runCurrentAdministrationWorkflowResume() {
  const commandResult = await runEquitystackCommand(["current-admin", "workflow", "resume"]);
  return {
    ...commandResult,
    workspace: await getCurrentAdministrationOperatorWorkspace(),
  };
}

export async function runCurrentAdministrationWorkflowStart({
  inputPath = "",
  batchName = "",
  reviewDryRun = false,
  prefillSuggestions = false,
  reviewModel = "",
  verifierModel = "",
  fallbackModel = "",
  reviewMode = "",
  deepReview = false,
  openaiBaseUrl = "",
  timeout = "",
  seniorTimeout = "",
  verifierTimeout = "",
} = {}) {
  const args = ["current-admin", "workflow", "start"];

  if (normalizeString(inputPath)) {
    args.push("--input", normalizeString(inputPath));
  }
  if (normalizeString(batchName)) {
    args.push("--batch-name", normalizeString(batchName));
  }
  if (reviewDryRun) {
    args.push("--review-dry-run");
  }
  if (prefillSuggestions) {
    args.push("--prefill-suggestions");
  }
  if (normalizeString(reviewModel)) {
    args.push("--model", normalizeString(reviewModel));
  }
  if (normalizeString(verifierModel)) {
    args.push("--verifier-model", normalizeString(verifierModel));
  }
  if (normalizeString(fallbackModel)) {
    args.push("--fallback-model", normalizeString(fallbackModel));
  }
  if (normalizeString(reviewMode)) {
    args.push("--review-mode", normalizeString(reviewMode));
  }
  if (deepReview) {
    args.push("--deep-review");
  }
  if (normalizeString(openaiBaseUrl)) {
    args.push("--openai-base-url", normalizeString(openaiBaseUrl));
  }
  if (normalizeString(timeout)) {
    args.push("--timeout", normalizeString(timeout));
  }
  if (normalizeString(seniorTimeout)) {
    args.push("--senior-timeout", normalizeString(seniorTimeout));
  }
  if (normalizeString(verifierTimeout)) {
    args.push("--verifier-timeout", normalizeString(verifierTimeout));
  }

  const commandResult = await runEquitystackCommand(args);
  return {
    ...commandResult,
    workspace: await getCurrentAdministrationOperatorWorkspace(),
  };
}
