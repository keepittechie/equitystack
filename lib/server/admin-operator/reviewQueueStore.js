import { promises as fs } from "node:fs";
import {
  REVIEW_QUEUE_DIR,
  buildReviewQueueItemPath,
  ensureDir,
  mergeRecordsById,
  normalizeString,
  readJsonSafe,
  sortByTimestampDesc,
  toBoundedRecordId,
} from "./shared.js";
import {
  fromDbTimestamp,
  parseJsonColumn,
  stringifyJsonColumn,
  toDbTimestamp,
  withOperatorDbFallback,
} from "./operatorPersistence.js";

function normalizeReviewQueueItem(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  return {
    id: toBoundedRecordId(payload.id, "rq"),
    workflowFamily: normalizeString(payload.workflowFamily),
    sessionId: normalizeString(payload.sessionId),
    sourceArtifactId: normalizeString(payload.sourceArtifactId) || null,
    sourceArtifactPath: normalizeString(payload.sourceArtifactPath) || null,
    queueType: normalizeString(payload.queueType),
    state: normalizeString(payload.state),
    priority: normalizeString(payload.priority) || "unknown",
    recommendedActionId: normalizeString(payload.recommendedActionId) || null,
    title: normalizeString(payload.title),
    detail: normalizeString(payload.detail),
    href: normalizeString(payload.href) || null,
    active: payload.active !== false,
    metadataJson:
      payload.metadataJson && typeof payload.metadataJson === "object" ? payload.metadataJson : {},
    createdAt: normalizeString(payload.createdAt) || null,
    updatedAt: normalizeString(payload.updatedAt) || null,
  };
}

function normalizeDbReviewQueueItem(row) {
  if (!row) {
    return null;
  }

  return normalizeReviewQueueItem({
    id: row.id,
    workflowFamily: row.workflow_family,
    sessionId: row.session_id,
    sourceArtifactId: row.source_artifact_id,
    sourceArtifactPath: row.source_artifact_path,
    queueType: row.queue_type,
    state: row.state,
    priority: row.priority,
    recommendedActionId: row.recommended_action_id,
    title: row.title,
    detail: row.detail_text,
    href: row.href,
    active: Boolean(row.active),
    metadataJson: parseJsonColumn(row.metadata_json, {}),
    createdAt: fromDbTimestamp(row.created_at),
    updatedAt: fromDbTimestamp(row.updated_at),
  });
}

async function writeReviewQueueItemFile(item) {
  const normalized = normalizeReviewQueueItem(item);
  if (!normalized?.id) {
    throw new Error("Review queue item is missing an id.");
  }

  await ensureDir(REVIEW_QUEUE_DIR);
  await fs.writeFile(
    buildReviewQueueItemPath(normalized.id),
    `${JSON.stringify(normalized, null, 2)}\n`,
    "utf8"
  );
  return normalized;
}

async function listReviewQueueRecordsFile({ workflowFamily = "", sessionId = "", activeOnly = true } = {}) {
  const entries = await fs.readdir(REVIEW_QUEUE_DIR, { withFileTypes: true }).catch(() => []);
  const items = (
    await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) => readJsonSafe(`${REVIEW_QUEUE_DIR}/${entry.name}`))
    )
  )
    .map(normalizeReviewQueueItem)
    .filter(Boolean)
    .filter((item) => !workflowFamily || item.workflowFamily === workflowFamily)
    .filter((item) => !sessionId || item.sessionId === sessionId)
    .filter((item) => !activeOnly || item.active);

  return sortByTimestampDesc(
    mergeRecordsById(items),
    (item) => item.updatedAt || item.createdAt
  );
}

async function listReviewQueueRecordsDb({ workflowFamily = "", sessionId = "", activeOnly = true } = {}) {
  return withOperatorDbFallback(
    async (db) => {
      const clauses = [];
      const params = [];
      if (workflowFamily) {
        clauses.push("workflow_family = ?");
        params.push(workflowFamily);
      }
      if (sessionId) {
        clauses.push("session_id = ?");
        params.push(sessionId);
      }
      if (activeOnly) {
        clauses.push("active = 1");
      }
      const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const [rows] = await db.execute(
        `SELECT *
         FROM operator_review_queue_items
         ${whereClause}
         ORDER BY updated_at DESC, created_at DESC`,
        params
      );
      return rows.map(normalizeDbReviewQueueItem).filter(Boolean);
    },
    async () => listReviewQueueRecordsFile({ workflowFamily, sessionId, activeOnly })
  );
}

async function getReviewQueueRecordDb(itemId) {
  return withOperatorDbFallback(
    async (db) => {
      const [rows] = await db.execute(
        `SELECT *
         FROM operator_review_queue_items
         WHERE id = ?
         LIMIT 1`,
        [itemId]
      );
      return normalizeDbReviewQueueItem(rows[0] || null);
    },
    async () => normalizeReviewQueueItem(await readJsonSafe(buildReviewQueueItemPath(itemId)))
  );
}

export async function listReviewQueueRecords({ workflowFamily = "", sessionId = "", activeOnly = true } = {}) {
  const [dbRecords, fileRecords] = await Promise.all([
    listReviewQueueRecordsDb({ workflowFamily, sessionId, activeOnly }),
    listReviewQueueRecordsFile({ workflowFamily, sessionId, activeOnly }),
  ]);
  return sortByTimestampDesc(
    mergeRecordsById([...dbRecords, ...fileRecords])
      .map(normalizeReviewQueueItem)
      .filter(Boolean),
    (item) => item.updatedAt || item.createdAt
  );
}

export async function getReviewQueueRecord(itemId) {
  const normalizedId = normalizeString(itemId);
  if (!normalizedId) {
    return null;
  }
  const dbRecord = await getReviewQueueRecordDb(normalizedId);
  if (dbRecord) {
    return dbRecord;
  }
  return normalizeReviewQueueItem(await readJsonSafe(buildReviewQueueItemPath(normalizedId)));
}

export async function upsertReviewQueueItem(record) {
  const existing = await getReviewQueueRecord(record.id);
  const now = new Date().toISOString();
  const next = normalizeReviewQueueItem({
    ...existing,
    ...record,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  });

  await withOperatorDbFallback(
    async (db) => {
      await db.execute(
        `INSERT INTO operator_review_queue_items (
          id,
          workflow_family,
          session_id,
          source_artifact_id,
          source_artifact_path,
          queue_type,
          state,
          priority,
          recommended_action_id,
          title,
          detail_text,
          href,
          active,
          metadata_json,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          workflow_family = VALUES(workflow_family),
          session_id = VALUES(session_id),
          source_artifact_id = VALUES(source_artifact_id),
          source_artifact_path = VALUES(source_artifact_path),
          queue_type = VALUES(queue_type),
          state = VALUES(state),
          priority = VALUES(priority),
          recommended_action_id = VALUES(recommended_action_id),
          title = VALUES(title),
          detail_text = VALUES(detail_text),
          href = VALUES(href),
          active = VALUES(active),
          metadata_json = VALUES(metadata_json),
          updated_at = VALUES(updated_at)`,
        [
          next.id,
          next.workflowFamily,
          next.sessionId,
          next.sourceArtifactId,
          next.sourceArtifactPath,
          next.queueType,
          next.state,
          next.priority,
          next.recommendedActionId,
          next.title,
          next.detail,
          next.href,
          next.active ? 1 : 0,
          stringifyJsonColumn(next.metadataJson, {}),
          toDbTimestamp(next.createdAt),
          toDbTimestamp(next.updatedAt),
        ]
      );
      return next;
    },
    async () => writeReviewQueueItemFile(next)
  );

  return next;
}

export async function deactivateSessionReviewQueueItems(sessionId, keepIds = []) {
  const current = await listReviewQueueRecords({ sessionId, activeOnly: false });
  await Promise.all(
    current
      .filter((item) => item.active && !keepIds.includes(item.id))
      .map((item) =>
        upsertReviewQueueItem({
          ...item,
          active: false,
          updatedAt: new Date().toISOString(),
        })
      )
  );
}
