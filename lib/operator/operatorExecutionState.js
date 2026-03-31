import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const EXECUTION_STATE_PATH = path.join(
  PROJECT_ROOT,
  "python",
  "reports",
  "admin_operator_execution_state.json"
);
const STALE_LOCK_MS = 12 * 60 * 60 * 1000;

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function readJsonSafe(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isActiveLock(payload) {
  if (!payload || !["queued", "running"].includes(payload.status)) {
    return false;
  }
  const startedAtMs = new Date(payload.started_at || 0).getTime();
  if (!Number.isFinite(startedAtMs) || startedAtMs <= 0) {
    return false;
  }
  return Date.now() - startedAtMs < STALE_LOCK_MS;
}

export async function getOperatorExecutionState() {
  const payload = await readJsonSafe(EXECUTION_STATE_PATH);
  if (!isActiveLock(payload)) {
    return null;
  }
  return payload;
}

export async function clearOperatorExecutionState() {
  await fs.rm(EXECUTION_STATE_PATH, { force: true }).catch(() => {});
}

export async function acquireOperatorExecutionState(entry) {
  const active = await getOperatorExecutionState();
  if (active) {
    return { acquired: false, active };
  }

  const payload = {
    status: normalizeString(entry?.status) || "running",
    started_at: new Date().toISOString(),
    execution_id: normalizeString(entry?.execution_id) || null,
    action_id: normalizeString(entry?.action_id) || null,
    action_label: normalizeString(entry?.action_label) || null,
    workflow_type: normalizeString(entry?.workflow_type) || null,
    user_input: normalizeString(entry?.user_input) || null,
    command: normalizeString(entry?.command) || null,
  };

  await fs.mkdir(path.dirname(EXECUTION_STATE_PATH), { recursive: true });

  try {
    const handle = await fs.open(EXECUTION_STATE_PATH, "wx");
    await handle.writeFile(`${JSON.stringify(payload, null, 2)}\n`, "utf8");
    await handle.close();
    return { acquired: true, active: payload };
  } catch {
    const existing = await getOperatorExecutionState();
    return { acquired: false, active: existing };
  }
}

export function getOperatorExecutionStatePath() {
  return EXECUTION_STATE_PATH;
}
