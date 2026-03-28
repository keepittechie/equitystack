import { promises as fs } from "node:fs";
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

async function runEquitystackCommand(args) {
  const command = `cd python && ./bin/equitystack ${args.map(shellEscape).join(" ")}`;
  try {
    const { stdout, stderr } = await execFileAsync("/bin/zsh", ["-lc", command], {
      cwd: PROJECT_ROOT,
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

async function runPythonCommand(args) {
  const command = `cd python && python3 ${args.map(shellEscape).join(" ")}`;
  try {
    const { stdout, stderr } = await execFileAsync("/bin/zsh", ["-lc", command], {
      cwd: PROJECT_ROOT,
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
  const outputPath = buildDecisionTemplatePath(resolvedReviewPath);

  await runPythonCommand([
    "scripts/generate_current_admin_decision_template.py",
    "--input",
    resolvedReviewPath,
    "--output",
    outputPath,
  ]);

  const templatePayload = await readJson(outputPath);
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
