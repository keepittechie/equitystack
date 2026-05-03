import fs from "node:fs/promises";
import path from "node:path";

const CURRENT_ADMIN_REPORTS_DIR = path.join(
  process.cwd(),
  "python",
  "reports",
  "current_admin"
);

async function readJsonFile(filePath) {
  try {
    const contents = await fs.readFile(filePath, "utf8");
    return JSON.parse(contents);
  } catch {
    return null;
  }
}

function extractReadinessActions(payload = {}) {
  if (Array.isArray(payload?.actions)) {
    return payload.actions;
  }

  if (Array.isArray(payload?.sources?.readiness_report?.payload?.actions)) {
    return payload.sources.readiness_report.payload.actions;
  }

  return [];
}

export async function findLatestCurrentAdminReportByPrefix(prefix) {
  try {
    const entries = await fs.readdir(CURRENT_ADMIN_REPORTS_DIR, { withFileTypes: true });
    const candidates = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.startsWith(prefix) && entry.name.endsWith(".json"))
        .map(async (entry) => {
          const filePath = path.join(CURRENT_ADMIN_REPORTS_DIR, entry.name);
          const stat = await fs.stat(filePath);
          return {
            file_path: filePath,
            file_name: entry.name,
            mtime_ms: Number(stat.mtimeMs || 0),
          };
        })
    );
    const latest = candidates.sort((left, right) => right.mtime_ms - left.mtime_ms)[0];
    if (!latest) {
      return null;
    }
    const payload = await readJsonFile(latest.file_path);
    if (!payload) {
      return null;
    }
    return {
      ...latest,
      payload,
    };
  } catch {
    return null;
  }
}

export async function getCurrentAdminReadinessActionMetaBySlug() {
  const readinessReport =
    (await findLatestCurrentAdminReportByPrefix("current-admin-governing-action-readiness.")) ||
    (await findLatestCurrentAdminReportByPrefix("current-admin-governing-action-readiness-summary."));

  const actionMeta = new Map();
  for (const action of extractReadinessActions(readinessReport?.payload || {})) {
    const slug = typeof action?.governing_action_slug === "string"
      ? action.governing_action_slug.trim()
      : "";
    if (!slug) {
      continue;
    }
    actionMeta.set(slug, action);
  }

  return actionMeta;
}
