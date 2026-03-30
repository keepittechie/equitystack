import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const HISTORY_PATH = path.join(
  PROJECT_ROOT,
  "python",
  "reports",
  "admin_operator_action_history.json"
);
const MAX_HISTORY_ITEMS = 200;
const DEFAULT_HISTORY_LIMIT = 20;

async function readJsonSafe(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function readOperatorActionHistory({ limit = DEFAULT_HISTORY_LIMIT } = {}) {
  const payload = await readJsonSafe(HISTORY_PATH);
  if (!Array.isArray(payload)) {
    return [];
  }
  const cappedPayload = payload.slice(0, MAX_HISTORY_ITEMS);
  if (!Number.isFinite(limit) || limit <= 0) {
    return cappedPayload;
  }
  return cappedPayload.slice(0, limit);
}

export async function appendOperatorActionHistory(entry) {
  const existing = await readOperatorActionHistory({ limit: MAX_HISTORY_ITEMS });
  const next = [
    {
      timestamp: new Date().toISOString(),
      ...entry,
    },
    ...existing,
  ].slice(0, MAX_HISTORY_ITEMS);

  await fs.mkdir(path.dirname(HISTORY_PATH), { recursive: true });
  await fs.writeFile(HISTORY_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");

  return next;
}

export function getOperatorActionHistoryPath() {
  return HISTORY_PATH;
}
