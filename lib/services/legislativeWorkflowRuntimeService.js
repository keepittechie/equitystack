import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getLegislativeWorkflowWorkspace } from "./legislativeWorkflowInsightsService.js";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = process.cwd();
const REPORTS_DIR = path.join(PROJECT_ROOT, "python", "reports");
const REVIEW_BUNDLE_PATH = path.join(REPORTS_DIR, "equitystack_review_bundle.json");

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function shellEscape(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function writeJson(filePath, payload) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
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
    throw new Error(detail || "The canonical legislative command failed.");
  }
}

function assertExpectedBundlePath(bundlePath) {
  const resolvedBundlePath = path.resolve(bundlePath);
  if (resolvedBundlePath !== path.resolve(REVIEW_BUNDLE_PATH)) {
    throw new Error("Bundle path does not match the canonical legislative review bundle.");
  }
}

function assertPermission(workspace, permissionKey) {
  const permission = workspace?.action_permissions?.[permissionKey];
  if (!permission?.allowed) {
    const reason =
      permission?.reasons?.[0] ||
      "The requested legislative action is blocked by the current workflow state.";
    throw new Error(reason);
  }
}

function validateActionUpdates(actionUpdates) {
  if (!Array.isArray(actionUpdates)) {
    throw new Error("Action updates must be an array.");
  }
}

function applyActionUpdatesToBundle(bundlePayload, actionUpdates) {
  const byActionId = new Map(
    actionUpdates
      .filter((item) => item && normalizeString(item.action_id))
      .map((item) => [normalizeString(item.action_id), item])
  );
  const now = new Date().toISOString();

  const nextGroups = (bundlePayload.future_bill_groups || []).map((group) => ({
    ...group,
    operator_actions: (group.operator_actions || []).map((action) => {
      const update = byActionId.get(normalizeString(action.action_id));
      if (!update) {
        return action;
      }

      const decision = normalizeString(update.decision) || "pending";
      const approvalNote = normalizeString(update.approval_note);

      if (decision === "approve") {
        return {
          ...action,
          approved: true,
          status: "pending",
          approved_by: "web_admin",
          approved_at: now,
          approval_note: approvalNote,
        };
      }

      if (decision === "dismiss") {
        return {
          ...action,
          approved: false,
          status: "dismissed",
          approved_by: null,
          approved_at: null,
          approval_note: approvalNote,
        };
      }

      return {
        ...action,
        approved: false,
        status: "pending",
        approved_by: null,
        approved_at: null,
        approval_note: approvalNote,
      };
    }),
  }));

  const pendingActionsIndex = nextGroups.flatMap((group) =>
    (group.operator_actions || []).filter((action) => action.review_state === "actionable")
  );

  return {
    ...bundlePayload,
    generated_at: now,
    future_bill_groups: nextGroups,
    pending_actions_index: pendingActionsIndex,
    summary: {
      ...(bundlePayload.summary || {}),
      items_requiring_operator_action: pendingActionsIndex.filter(
        (action) => action.status === "pending" && !action.approved
      ).length,
      total_actionable_operator_actions: pendingActionsIndex.length,
    },
  };
}

export async function saveLegislativeApprovals({ bundlePath, actionUpdates }) {
  validateActionUpdates(actionUpdates);
  assertExpectedBundlePath(bundlePath);

  const workspace = await getLegislativeWorkflowWorkspace();
  assertPermission(workspace, "save_approvals");

  const bundlePayload = await readJson(REVIEW_BUNDLE_PATH);
  const mergedPayload = applyActionUpdatesToBundle(bundlePayload, actionUpdates);
  await writeJson(REVIEW_BUNDLE_PATH, mergedPayload);

  return {
    bundlePath: REVIEW_BUNDLE_PATH,
    payload: mergedPayload,
    workspace: await getLegislativeWorkflowWorkspace(),
  };
}

export async function runLegislativeApply({ mode }) {
  const workspace = await getLegislativeWorkflowWorkspace();
  const isApply = mode === "apply";
  assertPermission(workspace, isApply ? "apply_bundle" : "run_apply_dry_run");

  const commandResult = await runEquitystackCommand(
    isApply
      ? ["legislative", "apply", "--apply", "--yes"]
      : ["legislative", "apply", "--dry-run"]
  );

  return {
    ...commandResult,
    workspace: await getLegislativeWorkflowWorkspace(),
  };
}

export async function runLegislativeImport({ mode }) {
  const workspace = await getLegislativeWorkflowWorkspace();
  const isApply = mode === "apply";
  assertPermission(workspace, isApply ? "apply_import" : "run_import_dry_run");

  const commandResult = await runEquitystackCommand(
    isApply
      ? ["legislative", "import", "--apply", "--yes"]
      : ["legislative", "import", "--dry-run"]
  );

  return {
    ...commandResult,
    workspace: await getLegislativeWorkflowWorkspace(),
  };
}

export async function runLegislativeRun() {
  const commandResult = await runEquitystackCommand(["legislative", "run"]);
  return {
    ...commandResult,
    workspace: await getLegislativeWorkflowWorkspace(),
  };
}
