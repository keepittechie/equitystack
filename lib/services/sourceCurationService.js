import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getDb } from "@/lib/db";
import { createCommandHistoryEntry } from "@/lib/server/admin-operator/commandHistoryStore.js";
import {
  ensureDir,
  normalizeString,
  PROJECT_ROOT,
  readJsonSafe,
  toHashedFileStem,
  toSafeNumber,
  uniqueStrings,
} from "@/lib/server/admin-operator/shared.js";

const INTEGRITY_DIR = path.join(PROJECT_ROOT, "python", "reports", "integrity");
const ATTRIBUTION_ARTIFACT_PATH = path.join(
  INTEGRITY_DIR,
  "source_attribution_manual_review.json"
);
const DUPLICATE_ARTIFACT_PATH = path.join(
  INTEGRITY_DIR,
  "source_duplicate_manual_review.json"
);
const CLEANUP_REPORT_PATH = path.join(
  INTEGRITY_DIR,
  "source_integrity_cleanup_report.json"
);
const STATE_PATH = path.join(INTEGRITY_DIR, "source_curation_decisions.json");
const AUDIT_LOG_PATH = path.join(INTEGRITY_DIR, "source_curation_audit_log.jsonl");

const MISSING_SOURCE_ACTION_TYPES = new Set([
  "attach_existing_source",
  "create_and_attach_source",
  "mark_missing_source_reviewed",
  // backward compatibility from the earlier draft-only pass
  "add_new_source",
  "mark_reviewed",
]);

const DUPLICATE_CLUSTER_ACTION_TYPES = new Set([
  "merge_duplicate_sources",
  "keep_duplicate_sources_separate",
  "mark_duplicate_cluster_reviewed",
]);

function toIsoOrNull(value) {
  const text = normalizeString(value);
  if (!text) {
    return null;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return text;
  }
  return parsed.toISOString();
}

function validateHttpUrl(value) {
  const text = normalizeString(value);
  if (!text) {
    return false;
  }
  try {
    const parsed = new URL(text);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function classifyImportOrigin(presidentSlug, createdYearOrTimestamp) {
  const normalizedPresident = normalizeString(presidentSlug);
  const raw = normalizeString(createdYearOrTimestamp);
  const parsedYear = raw ? new Date(raw).getUTCFullYear() : NaN;
  const normalizedYear = Number.isFinite(parsedYear) ? String(parsedYear) : raw;

  if (normalizedPresident === "donald-j-trump-2025") {
    return "current_admin_import";
  }
  if (normalizedYear === "2026") {
    return "legacy_sql_import_2026";
  }
  return "unknown_untracked_import";
}

function buildMissingSourceReviewKey(recordType, recordId) {
  return `${normalizeString(recordType)}:${Number(recordId)}`;
}

function buildDuplicateClusterKey(cluster) {
  const ids = (cluster?.rows || [])
    .map((row) => Number(row?.source_id || row?.sourceId || 0))
    .filter(Boolean)
    .sort((left, right) => left - right)
    .join(",");
  return `dup_${toHashedFileStem(`${normalizeString(cluster?.source_url)}|${ids}`)}`;
}

function summarizeBeforeAfter({ beforeState = {}, afterState = {} }) {
  return {
    sourceIdsBefore: Array.isArray(beforeState.sourceIds) ? beforeState.sourceIds : [],
    sourceIdsAfter: Array.isArray(afterState.sourceIds) ? afterState.sourceIds : [],
    sourceCountBefore: toSafeNumber(beforeState.sourceCount, 0),
    sourceCountAfter: toSafeNumber(afterState.sourceCount, 0),
  };
}

function normalizeSourceRow(row) {
  if (!row) {
    return null;
  }
  return {
    id: Number(row.id || row.source_id || 0),
    policy_id: row.policy_id == null ? null : Number(row.policy_id),
    source_title: normalizeString(row.source_title || row.title),
    source_url: normalizeString(row.source_url || row.url),
    source_type: normalizeString(row.source_type),
    publisher: normalizeString(row.publisher) || null,
    published_date: normalizeString(row.published_date) || null,
    notes: normalizeString(row.notes) || null,
    promise_refs: toSafeNumber(row.promise_refs, 0),
    action_refs: toSafeNumber(row.action_refs, 0),
    outcome_refs: toSafeNumber(row.outcome_refs, 0),
    same_promise_refs: toSafeNumber(row.same_promise_refs, 0),
    same_policy_match: Boolean(row.same_policy_match),
  };
}

function buildSuggestedSearchQuery(item) {
  return uniqueStrings([
    item.promise_title,
    item.record_text,
    item.record_detail,
  ])
    .join(" ")
    .slice(0, 280);
}

function normalizeMissingSourceItem(item) {
  const recordType = normalizeString(item?.record_type);
  const recordId = Number(item?.record_id || 0);
  const createdAt = toIsoOrNull(item?.created_at);
  const recordDate = toIsoOrNull(item?.record_date);
  return {
    review_key:
      normalizeString(item?.review_key) || buildMissingSourceReviewKey(recordType, recordId),
    record_type: recordType,
    record_id: recordId,
    promise_id: Number(item?.promise_id || 0),
    promise_slug: normalizeString(item?.promise_slug),
    promise_title: normalizeString(item?.promise_title),
    president_slug: normalizeString(item?.president_slug),
    president_name: normalizeString(item?.president_name),
    topic: normalizeString(item?.topic) || "<untagged>",
    import_origin:
      normalizeString(item?.likely_import_origin) ||
      classifyImportOrigin(item?.president_slug, createdAt || recordDate || ""),
    record_text: normalizeString(item?.record_text),
    record_detail: normalizeString(item?.record_detail),
    record_date: recordDate,
    created_at: createdAt,
    related_policy_id: item?.related_policy_id == null ? null : Number(item.related_policy_id),
    related_policy_title: normalizeString(item?.related_policy_title) || null,
    missing_source_flag: true,
    suggested_search_query:
      normalizeString(item?.suggested_search_query) || buildSuggestedSearchQuery(item),
  };
}

function normalizeMissingSourceDecision(decision) {
  if (!decision || typeof decision !== "object") {
    return null;
  }
  const actionType = normalizeString(decision.actionType || decision.decisionType || decision.action_type);
  const reviewKey = normalizeString(decision.reviewKey || decision.review_key);
  const recordType = normalizeString(decision.recordType || decision.record_type);
  const recordId = Number(decision.recordId || decision.record_id || 0);
  if (!reviewKey || !recordType || !recordId || !MISSING_SOURCE_ACTION_TYPES.has(actionType)) {
    return null;
  }

  return {
    entityType: "missing-source",
    reviewKey,
    recordType,
    recordId,
    promiseId: Number(decision.promiseId || decision.promise_id || 0),
    promiseSlug: normalizeString(decision.promiseSlug || decision.promise_slug),
    promiseTitle: normalizeString(decision.promiseTitle || decision.promise_title),
    presidentSlug: normalizeString(decision.presidentSlug || decision.president_slug),
    presidentName: normalizeString(decision.presidentName || decision.president_name),
    topic: normalizeString(decision.topic) || "<untagged>",
    importOrigin:
      normalizeString(decision.importOrigin || decision.import_origin) || "unknown_untracked_import",
    actionType,
    note: normalizeString(decision.note) || null,
    searchQuery: normalizeString(decision.searchQuery || decision.search_query) || null,
    attachedSource: normalizeSourceRow(decision.attachedSource || decision.attached_source),
    createdSource: normalizeSourceRow(decision.createdSource || decision.created_source),
    beforeState:
      decision.beforeState && typeof decision.beforeState === "object"
        ? summarizeBeforeAfter({ beforeState: decision.beforeState, afterState: {} })
        : { sourceIdsBefore: [], sourceIdsAfter: [], sourceCountBefore: 0, sourceCountAfter: 0 },
    afterState:
      decision.afterState && typeof decision.afterState === "object"
        ? summarizeBeforeAfter({ beforeState: {}, afterState: decision.afterState })
        : { sourceIdsBefore: [], sourceIdsAfter: [], sourceCountBefore: 0, sourceCountAfter: 0 },
    confirmedAt: toIsoOrNull(decision.confirmedAt || decision.confirmed_at),
    updatedAt: toIsoOrNull(decision.updatedAt || decision.updated_at),
    sourceArtifactPath:
      normalizeString(decision.sourceArtifactPath || decision.source_artifact_path) ||
      ATTRIBUTION_ARTIFACT_PATH,
  };
}

function normalizeDuplicateClusterDecision(decision) {
  if (!decision || typeof decision !== "object") {
    return null;
  }
  const actionType = normalizeString(decision.actionType || decision.action_type);
  const clusterKey = normalizeString(decision.clusterKey || decision.cluster_key);
  if (!clusterKey || !DUPLICATE_CLUSTER_ACTION_TYPES.has(actionType)) {
    return null;
  }
  return {
    entityType: "duplicate-cluster",
    clusterKey,
    actionType,
    sourceUrl: normalizeString(decision.sourceUrl || decision.source_url),
    selectedSourceIds: Array.isArray(decision.selectedSourceIds || decision.selected_source_ids)
      ? (decision.selectedSourceIds || decision.selected_source_ids)
          .map((value) => Number(value || 0))
          .filter(Boolean)
      : [],
    canonicalSourceId: Number(decision.canonicalSourceId || decision.canonical_source_id || 0) || null,
    note: normalizeString(decision.note) || null,
    beforeState:
      decision.beforeState && typeof decision.beforeState === "object"
        ? decision.beforeState
        : {},
    afterState:
      decision.afterState && typeof decision.afterState === "object"
        ? decision.afterState
        : {},
    confirmedAt: toIsoOrNull(decision.confirmedAt || decision.confirmed_at),
    updatedAt: toIsoOrNull(decision.updatedAt || decision.updated_at),
    sourceArtifactPath:
      normalizeString(decision.sourceArtifactPath || decision.source_artifact_path) ||
      DUPLICATE_ARTIFACT_PATH,
  };
}

function buildStoredMissingDecisionSummary(decision) {
  if (!decision) {
    return null;
  }
  if (decision.actionType === "attach_existing_source") {
    return {
      label: "Attached existing source",
      detail: `${decision.attachedSource?.source_title || "Source"} (#${decision.attachedSource?.id || "?"})`,
    };
  }
  if (decision.actionType === "create_and_attach_source") {
    return {
      label: "Created and attached source",
      detail: `${decision.createdSource?.source_title || "Source"} (#${decision.createdSource?.id || "?"})`,
    };
  }
  if (decision.actionType === "add_new_source") {
    return {
      label: "Legacy source draft",
      detail: decision.note || "Draft saved in the earlier curation flow.",
    };
  }
  return {
    label: "Marked reviewed",
    detail: decision.note || "Reviewed without changing the canonical DB.",
  };
}

function buildStoredDuplicateDecisionSummary(decision) {
  if (!decision) {
    return null;
  }
  if (decision.actionType === "merge_duplicate_sources") {
    return {
      label: "Merged selected sources",
      detail: `Kept #${decision.canonicalSourceId}; merged ${decision.selectedSourceIds.length - 1} duplicate row(s).`,
    };
  }
  if (decision.actionType === "keep_duplicate_sources_separate") {
    return {
      label: "Keep separate",
      detail: decision.note || "Operator confirmed the cluster should remain separate.",
    };
  }
  return {
    label: "Marked reviewed",
    detail: decision.note || "Duplicate cluster reviewed without DB changes.",
  };
}

async function readStateStore() {
  const payload = (await readJsonSafe(STATE_PATH)) || {};
  const legacyMissingDecisions = Array.isArray(payload.decisions)
    ? payload.decisions.map(normalizeMissingSourceDecision).filter(Boolean)
    : [];
  const missingSourceDecisions = Array.isArray(payload.missing_source_decisions)
    ? payload.missing_source_decisions.map(normalizeMissingSourceDecision).filter(Boolean)
    : legacyMissingDecisions;
  const duplicateClusterDecisions = Array.isArray(payload.duplicate_cluster_decisions)
    ? payload.duplicate_cluster_decisions.map(normalizeDuplicateClusterDecision).filter(Boolean)
    : [];

  return {
    generatedAt: toIsoOrNull(payload.generated_at),
    updatedAt: toIsoOrNull(payload.updated_at),
    sourceArtifactPaths: {
      attribution:
        normalizeString(payload?.source_artifact_paths?.attribution) || ATTRIBUTION_ARTIFACT_PATH,
      duplicates:
        normalizeString(payload?.source_artifact_paths?.duplicates) || DUPLICATE_ARTIFACT_PATH,
      cleanup:
        normalizeString(payload?.source_artifact_paths?.cleanup) || CLEANUP_REPORT_PATH,
    },
    filePath: STATE_PATH,
    auditLogPath: AUDIT_LOG_PATH,
    missingSourceDecisions,
    duplicateClusterDecisions,
  };
}

async function writeStateStore({
  currentStore,
  missingSourceDecisions,
  duplicateClusterDecisions,
}) {
  const now = new Date().toISOString();
  await ensureDir(INTEGRITY_DIR);
  await fs.writeFile(
    STATE_PATH,
    `${JSON.stringify(
      {
        generated_at: currentStore?.generatedAt || now,
        updated_at: now,
        source_artifact_paths: {
          attribution: ATTRIBUTION_ARTIFACT_PATH,
          duplicates: DUPLICATE_ARTIFACT_PATH,
          cleanup: CLEANUP_REPORT_PATH,
        },
        missing_source_decisions: missingSourceDecisions,
        duplicate_cluster_decisions: duplicateClusterDecisions,
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

async function appendAuditLog(entry) {
  await ensureDir(INTEGRITY_DIR);
  await fs.appendFile(AUDIT_LOG_PATH, `${JSON.stringify(entry)}\n`, "utf8");
}

function buildAuditEntry({
  actionType,
  entityType,
  entityKey,
  note,
  sourceIds = [],
  beforeState = {},
  afterState = {},
  metadata = {},
}) {
  return {
    id: `source-curation-${Date.now()}-${randomUUID().slice(0, 8)}`,
    recorded_at: new Date().toISOString(),
    action_type: actionType,
    entity_type: entityType,
    entity_key: entityKey,
    source_ids: sourceIds,
    note: normalizeString(note) || null,
    before_state: beforeState,
    after_state: afterState,
    metadata,
  };
}

function buildCommandHistorySummary(actionType, targetLabel) {
  if (actionType === "attach_existing_source") {
    return `Attached an existing source to ${targetLabel}.`;
  }
  if (actionType === "create_and_attach_source") {
    return `Created a new source and attached it to ${targetLabel}.`;
  }
  if (actionType === "merge_duplicate_sources") {
    return `Merged selected duplicate sources for ${targetLabel}.`;
  }
  if (actionType === "keep_duplicate_sources_separate") {
    return `Marked duplicate sources as intentionally separate for ${targetLabel}.`;
  }
  if (actionType === "mark_duplicate_cluster_reviewed") {
    return `Marked the duplicate-source cluster reviewed for ${targetLabel}.`;
  }
  return `Marked ${targetLabel} reviewed without changing canonical source joins.`;
}

async function fetchMissingSourceRows(recordType) {
  const db = getDb();
  if (recordType === "action") {
    const [rows] = await db.execute(
      `
      SELECT
        pa.id AS record_id,
        pa.promise_id,
        pa.title AS record_text,
        pa.description AS record_detail,
        pa.action_date AS record_date,
        pa.created_at,
        pa.related_policy_id,
        pol.title AS related_policy_title,
        p.slug AS promise_slug,
        p.title AS promise_title,
        COALESCE(p.topic, '<untagged>') AS topic,
        pr.slug AS president_slug,
        pr.full_name AS president_name
      FROM promise_actions pa
      JOIN promises p ON p.id = pa.promise_id
      JOIN presidents pr ON pr.id = p.president_id
      LEFT JOIN policies pol ON pol.id = pa.related_policy_id
      WHERE NOT EXISTS (
        SELECT 1
        FROM promise_action_sources pas
        WHERE pas.promise_action_id = pa.id
      )
      ORDER BY pr.full_name ASC, topic ASC, p.title ASC, pa.action_date ASC, pa.id ASC
      `
    );
    return rows.map((row) =>
      normalizeMissingSourceItem({
        ...row,
        record_type: "action",
      })
    );
  }

  const [rows] = await db.execute(
    `
    SELECT
      po.id AS record_id,
      po.promise_id,
      po.outcome_summary AS record_text,
      po.measurable_impact AS record_detail,
      po.created_at,
      p.slug AS promise_slug,
      p.title AS promise_title,
      COALESCE(p.topic, '<untagged>') AS topic,
      pr.slug AS president_slug,
      pr.full_name AS president_name
    FROM promise_outcomes po
    JOIN promises p ON p.id = po.promise_id
    JOIN presidents pr ON pr.id = p.president_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM promise_outcome_sources pos
      WHERE pos.promise_outcome_id = po.id
    )
    ORDER BY pr.full_name ASC, topic ASC, p.title ASC, po.id ASC
    `
  );
  return rows.map((row) =>
    normalizeMissingSourceItem({
      ...row,
      record_type: "outcome",
    })
  );
}

async function fetchPromiseContextMap(items = []) {
  const promiseIds = uniqueStrings(items.map((item) => String(item.promise_id))).map((value) =>
    Number(value)
  );
  const relatedPolicyIds = uniqueStrings(
    items.map((item) => (item.related_policy_id == null ? "" : String(item.related_policy_id)))
  )
    .map((value) => Number(value))
    .filter(Boolean);

  const promiseContextMap = new Map();
  const policyContextMap = new Map();
  if (!promiseIds.length && !relatedPolicyIds.length) {
    return { promiseContextMap, policyContextMap };
  }

  const db = getDb();
  if (promiseIds.length) {
    const placeholders = promiseIds.map(() => "?").join(", ");
    const [rows] = await db.execute(
      `
      SELECT
        ctx.promise_id,
        s.id,
        s.policy_id,
        s.source_title,
        s.source_url,
        s.source_type,
        s.publisher,
        s.published_date,
        COUNT(*) AS ref_count
      FROM (
        SELECT ps.promise_id, ps.source_id
        FROM promise_sources ps
        WHERE ps.promise_id IN (${placeholders})
        UNION ALL
        SELECT pa.promise_id, pas.source_id
        FROM promise_actions pa
        JOIN promise_action_sources pas ON pas.promise_action_id = pa.id
        WHERE pa.promise_id IN (${placeholders})
        UNION ALL
        SELECT po.promise_id, pos.source_id
        FROM promise_outcomes po
        JOIN promise_outcome_sources pos ON pos.promise_outcome_id = po.id
        WHERE po.promise_id IN (${placeholders})
      ) ctx
      JOIN sources s ON s.id = ctx.source_id
      GROUP BY
        ctx.promise_id,
        s.id,
        s.policy_id,
        s.source_title,
        s.source_url,
        s.source_type,
        s.publisher,
        s.published_date
      ORDER BY ctx.promise_id ASC, ref_count DESC, s.id ASC
      `,
      [...promiseIds, ...promiseIds, ...promiseIds]
    );
    for (const row of rows) {
      const promiseId = Number(row.promise_id);
      if (!promiseContextMap.has(promiseId)) {
        promiseContextMap.set(promiseId, []);
      }
      promiseContextMap.get(promiseId).push(normalizeSourceRow(row));
    }
  }

  if (relatedPolicyIds.length) {
    const placeholders = relatedPolicyIds.map(() => "?").join(", ");
    const [rows] = await db.execute(
      `
      SELECT
        s.id,
        s.policy_id,
        s.source_title,
        s.source_url,
        s.source_type,
        s.publisher,
        s.published_date
      FROM sources s
      WHERE s.policy_id IN (${placeholders})
      ORDER BY s.policy_id ASC, s.id ASC
      `,
      relatedPolicyIds
    );
    for (const row of rows) {
      const policyId = Number(row.policy_id);
      if (!policyContextMap.has(policyId)) {
        policyContextMap.set(policyId, []);
      }
      policyContextMap.get(policyId).push(normalizeSourceRow(row));
    }
  }

  return { promiseContextMap, policyContextMap };
}

function buildMissingSourceReason(item, promiseContextSources = [], policyContextSources = []) {
  if (item.import_origin === "legacy_sql_import_2026") {
    return promiseContextSources.length
      ? "Legacy SQL import omitted this row's direct source join even though same-promise evidence already exists."
      : "Legacy SQL import omitted direct source joins for this row.";
  }
  if (item.import_origin === "current_admin_import") {
    return "Current-admin DB row is missing a direct source join.";
  }
  if (promiseContextSources.length || policyContextSources.length) {
    return "This row is missing its direct source join even though related source context exists.";
  }
  return "No direct source join is currently recorded for this row.";
}

function buildMissingSourceNextStep(item, promiseContextSources = [], policyContextSources = []) {
  if (promiseContextSources.length || policyContextSources.length) {
    return "Review same-promise or same-policy source context first.";
  }
  if (item.import_origin === "legacy_sql_import_2026") {
    return "Search existing sources, then add a new source only if nothing suitable exists.";
  }
  return "Search existing sources or add a new source.";
}

function groupMissingSourceItems(items = []) {
  const bucket = new Map();
  for (const item of items) {
    const key = `${item.president_slug}:${item.topic}:${item.import_origin}`;
    if (!bucket.has(key)) {
      bucket.set(key, {
        id: key,
        president_slug: item.president_slug,
        president_name: item.president_name,
        topic: item.topic,
        import_origin: item.import_origin,
        items: [],
      });
    }
    bucket.get(key).items.push(item);
  }

  return [...bucket.values()]
    .map((group) => ({
      ...group,
      items: group.items.sort((left, right) => {
        return (
          left.promise_title.localeCompare(right.promise_title) ||
          left.record_type.localeCompare(right.record_type) ||
          left.record_id - right.record_id
        );
      }),
    }))
    .sort((left, right) => {
      return (
        left.president_name.localeCompare(right.president_name) ||
        left.topic.localeCompare(right.topic) ||
        left.import_origin.localeCompare(right.import_origin)
      );
    });
}

async function fetchLiveCurrentDuplicateSourceRows(sourceIds = []) {
  const ids = uniqueStrings(sourceIds.map((value) => String(value))).map((value) => Number(value));
  if (!ids.length) {
    return new Map();
  }
  const placeholders = ids.map(() => "?").join(", ");
  const db = getDb();
  const [rows] = await db.execute(
    `
    SELECT
      s.id,
      s.policy_id,
      s.source_title,
      s.source_url,
      s.source_type,
      s.publisher,
      s.published_date,
      COALESCE(ps_counts.promise_refs, 0) AS promise_refs,
      COALESCE(pas_counts.action_refs, 0) AS action_refs,
      COALESCE(pos_counts.outcome_refs, 0) AS outcome_refs
    FROM sources s
    LEFT JOIN (
      SELECT source_id, COUNT(*) AS promise_refs
      FROM promise_sources
      GROUP BY source_id
    ) ps_counts ON ps_counts.source_id = s.id
    LEFT JOIN (
      SELECT source_id, COUNT(*) AS action_refs
      FROM promise_action_sources
      GROUP BY source_id
    ) pas_counts ON pas_counts.source_id = s.id
    LEFT JOIN (
      SELECT source_id, COUNT(*) AS outcome_refs
      FROM promise_outcome_sources
      GROUP BY source_id
    ) pos_counts ON pos_counts.source_id = s.id
    WHERE s.id IN (${placeholders})
    `,
    ids
  );
  return new Map(
    rows.map((row) => {
      const normalized = normalizeSourceRow(row);
      return [normalized.id, normalized];
    })
  );
}

function groupDuplicateClusters(clusters = []) {
  const bucket = new Map();
  for (const cluster of clusters) {
    const primaryReason =
      cluster.auto_merge_rejected_reasons?.[0] || "manual_review_required";
    if (!bucket.has(primaryReason)) {
      bucket.set(primaryReason, {
        id: primaryReason,
        reason: primaryReason,
        clusters: [],
      });
    }
    bucket.get(primaryReason).clusters.push(cluster);
  }

  return [...bucket.values()]
    .map((group) => ({
      ...group,
      clusters: group.clusters.sort(
        (left, right) => right.current_member_count - left.current_member_count
      ),
    }))
    .sort((left, right) => left.reason.localeCompare(right.reason));
}

function buildDuplicateCluster(cluster, currentRowMap) {
  const rows = (cluster?.rows || [])
    .map((row) => currentRowMap.get(Number(row.source_id || row.sourceId || 0)) || normalizeSourceRow(row))
    .filter(Boolean);
  if (rows.length < 2) {
    return null;
  }
  const policyIds = uniqueStrings(
    rows.map((row) => (row.policy_id == null ? "" : String(row.policy_id)))
  )
    .map((value) => Number(value))
    .filter(Boolean);

  return {
    cluster_key: buildDuplicateClusterKey(cluster),
    source_url: normalizeString(cluster?.source_url),
    auto_merge_rejected_reasons: Array.isArray(cluster?.auto_merge_rejected_reasons)
      ? cluster.auto_merge_rejected_reasons
      : ["manual_review_required"],
    rows,
    current_member_count: rows.length,
    duplicate_count: toSafeNumber(cluster?.duplicate_count, rows.length),
    distinct_titles: uniqueStrings(rows.map((row) => row.source_title)),
    distinct_source_types: uniqueStrings(rows.map((row) => row.source_type)),
    distinct_publishers: uniqueStrings(rows.map((row) => row.publisher || "")),
    distinct_published_dates: uniqueStrings(rows.map((row) => row.published_date || "")),
    distinct_policy_ids: policyIds,
  };
}

function getLikelyDuplicateSources(sources = [], draft = {}) {
  const normalizedUrl = normalizeString(draft.source_url);
  const normalizedTitle = normalizeString(draft.source_title).toLowerCase();
  const normalizedPublisher = normalizeString(draft.publisher).toLowerCase();
  const normalizedDate = normalizeString(draft.published_date);

  return sources.filter((source) => {
    if (normalizedUrl && normalizeString(source.source_url) === normalizedUrl) {
      return true;
    }
    if (
      normalizedTitle &&
      normalizeString(source.source_title).toLowerCase() === normalizedTitle &&
      normalizeString(source.publisher).toLowerCase() === normalizedPublisher &&
      normalizeString(source.published_date) === normalizedDate
    ) {
      return true;
    }
    return false;
  });
}

async function fetchLikelyDuplicateNewSources(draft) {
  const db = getDb();
  const normalizedUrl = normalizeString(draft.source_url);
  const normalizedTitle = normalizeString(draft.source_title);
  const normalizedPublisher = normalizeString(draft.publisher);
  const normalizedDate = normalizeString(draft.published_date);
  const clauses = [];
  const params = [];
  if (normalizedUrl) {
    clauses.push("s.source_url = ?");
    params.push(normalizedUrl);
  }
  if (normalizedTitle && normalizedPublisher && normalizedDate) {
    clauses.push("(s.source_title = ? AND COALESCE(s.publisher, '') = ? AND COALESCE(s.published_date, '') = ?)");
    params.push(normalizedTitle, normalizedPublisher, normalizedDate);
  }
  if (!clauses.length) {
    return [];
  }
  const [rows] = await db.execute(
    `
    SELECT
      s.id,
      s.policy_id,
      s.source_title,
      s.source_url,
      s.source_type,
      s.publisher,
      s.published_date
    FROM sources s
    WHERE ${clauses.join(" OR ")}
    ORDER BY s.id DESC
    LIMIT 10
    `,
    params
  );
  return rows.map(normalizeSourceRow).filter(Boolean);
}

async function readSourceById(sourceId, connection = null) {
  const executor = connection || getDb();
  const [rows] = await executor.execute(
    `
    SELECT id, policy_id, source_title, source_url, source_type, publisher, published_date, notes
    FROM sources
    WHERE id = ?
    LIMIT 1
    `,
    [sourceId]
  );
  return rows[0] ? normalizeSourceRow(rows[0]) : null;
}

async function fetchAttachedSourceState(recordType, recordId, connection = null) {
  const executor = connection || getDb();
  const joinTable =
    recordType === "action" ? "promise_action_sources" : "promise_outcome_sources";
  const joinField =
    recordType === "action" ? "promise_action_id" : "promise_outcome_id";
  const [rows] = await executor.execute(
    `
    SELECT
      s.id,
      s.policy_id,
      s.source_title,
      s.source_url,
      s.source_type,
      s.publisher,
      s.published_date
    FROM ${joinTable} j
    JOIN sources s ON s.id = j.source_id
    WHERE j.${joinField} = ?
    ORDER BY s.id ASC
    `,
    [recordId]
  );
  const sources = rows.map(normalizeSourceRow).filter(Boolean);
  return {
    sources,
    sourceIds: sources.map((source) => source.id),
    sourceCount: sources.length,
  };
}

async function insertSourceJoin(recordType, recordId, sourceId, connection) {
  const joinTable =
    recordType === "action" ? "promise_action_sources" : "promise_outcome_sources";
  const joinField =
    recordType === "action" ? "promise_action_id" : "promise_outcome_id";
  await connection.execute(
    `
    INSERT IGNORE INTO ${joinTable} (${joinField}, source_id)
    VALUES (?, ?)
    `,
    [recordId, sourceId]
  );
}

async function createSourceRow(draft, connection) {
  const [result] = await connection.execute(
    `
    INSERT INTO sources (
      policy_id,
      source_title,
      source_url,
      source_type,
      publisher,
      published_date,
      notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      null,
      normalizeString(draft.source_title),
      normalizeString(draft.source_url),
      normalizeString(draft.source_type),
      normalizeString(draft.publisher) || null,
      normalizeString(draft.published_date) || null,
      normalizeString(draft.notes) || null,
    ]
  );
  return Number(result.insertId || 0);
}

async function buildCurrentMissingSourceItems(artifactRows = []) {
  const artifactMap = new Map(
    artifactRows.map((row) => [row.review_key, normalizeMissingSourceItem(row)])
  );
  const [actionItems, outcomeItems] = await Promise.all([
    fetchMissingSourceRows("action"),
    fetchMissingSourceRows("outcome"),
  ]);
  const liveItems = [...actionItems, ...outcomeItems];
  const mergedItems = liveItems.map((item) => ({
    ...(artifactMap.get(item.review_key) || {}),
    ...item,
  }));

  const { promiseContextMap, policyContextMap } = await fetchPromiseContextMap(mergedItems);
  return mergedItems.map((item) => {
    const promiseContextSources = promiseContextMap.get(item.promise_id) || [];
    const policyContextSources =
      item.related_policy_id != null ? policyContextMap.get(item.related_policy_id) || [] : [];
    return {
      ...item,
      existing_promise_sources: promiseContextSources.slice(0, 3),
      existing_promise_source_count: promiseContextSources.length,
      existing_policy_sources: policyContextSources.slice(0, 3),
      existing_policy_source_count: policyContextSources.length,
      unresolved_reason: buildMissingSourceReason(
        item,
        promiseContextSources,
        policyContextSources
      ),
      suggested_next_step: buildMissingSourceNextStep(
        item,
        promiseContextSources,
        policyContextSources
      ),
    };
  });
}

async function buildDuplicateClusters(artifactClusters = []) {
  const sourceIds = artifactClusters.flatMap((cluster) =>
    (cluster?.rows || [])
      .map((row) => Number(row?.source_id || row?.sourceId || 0))
      .filter(Boolean)
  );
  const currentRowMap = await fetchLiveCurrentDuplicateSourceRows(sourceIds);
  return artifactClusters
    .map((cluster) => buildDuplicateCluster(cluster, currentRowMap))
    .filter(Boolean);
}

function mergeDecisionMaps(items = [], decisionMap, summaryBuilder) {
  return items.map((item) => {
    const savedDecision = decisionMap.get(item.review_key || item.cluster_key) || null;
    return {
      ...item,
      saved_decision: savedDecision,
      saved_summary: summaryBuilder(savedDecision),
    };
  });
}

export async function getSourceCurationWorkspace() {
  const [attributionArtifact, duplicateArtifact, cleanupArtifact, store] = await Promise.all([
    readJsonSafe(ATTRIBUTION_ARTIFACT_PATH),
    readJsonSafe(DUPLICATE_ARTIFACT_PATH),
    readJsonSafe(CLEANUP_REPORT_PATH),
    readStateStore(),
  ]);

  const artifactRows = [
    ...(Array.isArray(attributionArtifact?.unresolved_actions)
      ? attributionArtifact.unresolved_actions.map(normalizeMissingSourceItem)
      : []),
    ...(Array.isArray(attributionArtifact?.unresolved_outcomes)
      ? attributionArtifact.unresolved_outcomes.map(normalizeMissingSourceItem)
      : []),
  ];

  let missingSourceItems = artifactRows;
  let missingSourceLoadError = "";
  let missingSourceDetailSource = artifactRows.length ? "artifact" : "artifact_counts_only";
  try {
    missingSourceItems = await buildCurrentMissingSourceItems(artifactRows);
    missingSourceDetailSource = artifactRows.length ? "artifact_with_db_truth" : "db_current_truth";
  } catch (error) {
    missingSourceLoadError =
      error instanceof Error
        ? error.message
        : "Failed to load current unresolved source rows from the DB.";
  }

  const missingDecisionMap = new Map(
    store.missingSourceDecisions.map((decision) => [decision.reviewKey, decision])
  );
  const enrichedMissingItems = mergeDecisionMaps(
    missingSourceItems,
    missingDecisionMap,
    buildStoredMissingSourceSummary
  );

  const duplicateArtifactClusters = Array.isArray(duplicateArtifact?.clusters)
    ? duplicateArtifact.clusters
    : [];
  let duplicateClusters = [];
  let duplicateLoadError = "";
  try {
    duplicateClusters = await buildDuplicateClusters(duplicateArtifactClusters);
  } catch (error) {
    duplicateLoadError =
      error instanceof Error
        ? error.message
        : "Failed to build duplicate source clusters from the live DB.";
  }
  const duplicateDecisionMap = new Map(
    store.duplicateClusterDecisions.map((decision) => [decision.clusterKey, decision])
  );
  const enrichedDuplicateClusters = duplicateClusters.map((cluster) => {
    const savedDecision = duplicateDecisionMap.get(cluster.cluster_key) || null;
    return {
      ...cluster,
      saved_decision: savedDecision,
      saved_summary: buildStoredDuplicateDecisionSummary(savedDecision),
    };
  });

  const missingGroups = groupMissingSourceItems(enrichedMissingItems);
  const duplicateGroups = groupDuplicateClusters(enrichedDuplicateClusters);

  return {
    artifacts: {
      attribution: {
        filePath: ATTRIBUTION_ARTIFACT_PATH,
        generatedAt: toIsoOrNull(attributionArtifact?.generated_at),
        mode: normalizeString(attributionArtifact?.mode) || null,
        remainingMissingActions: toSafeNumber(
          attributionArtifact?.remaining_missing_actions,
          enrichedMissingItems.filter((item) => item.record_type === "action").length
        ),
        remainingMissingOutcomes: toSafeNumber(
          attributionArtifact?.remaining_missing_outcomes,
          enrichedMissingItems.filter((item) => item.record_type === "outcome").length
        ),
        detailSource: missingSourceDetailSource,
      },
      duplicates: {
        filePath: DUPLICATE_ARTIFACT_PATH,
        generatedAt: toIsoOrNull(duplicateArtifact?.generated_at),
        manualReviewGroupCount: toSafeNumber(
          duplicateArtifact?.manual_review_group_count,
          duplicateClusters.length
        ),
      },
      cleanup: {
        filePath: CLEANUP_REPORT_PATH,
        generatedAt: toIsoOrNull(cleanupArtifact?.generated_at),
      },
    },
    decisions: {
      filePath: store.filePath,
      auditLogPath: store.auditLogPath,
      updatedAt: store.updatedAt,
      missingSourceCount: store.missingSourceDecisions.length,
      duplicateClusterCount: store.duplicateClusterDecisions.length,
    },
    loadErrors: {
      missingSource: missingSourceLoadError,
      duplicates: duplicateLoadError,
    },
    missingSources: {
      summary: {
        totalItems: enrichedMissingItems.length,
        totalGroups: missingGroups.length,
        actions: enrichedMissingItems.filter((item) => item.record_type === "action").length,
        outcomes: enrichedMissingItems.filter((item) => item.record_type === "outcome").length,
        reviewedCount: enrichedMissingItems.filter((item) => Boolean(item.saved_decision)).length,
        pendingCount: enrichedMissingItems.filter((item) => !item.saved_decision).length,
      },
      groups: missingGroups,
    },
    duplicates: {
      summary: {
        totalClusters: enrichedDuplicateClusters.length,
        totalGroups: duplicateGroups.length,
        reviewedCount: enrichedDuplicateClusters.filter((item) => Boolean(item.saved_decision)).length,
        pendingCount: enrichedDuplicateClusters.filter((item) => !item.saved_decision).length,
      },
      groups: duplicateGroups,
    },
  };
}

export async function searchExistingSources(
  queryText,
  { limit = 12, promiseId = null, relatedPolicyId = null } = {}
) {
  const q = normalizeString(queryText);
  if (q.length < 3) {
    return [];
  }
  const effectiveLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 25)) : 12;
  const likeValue = `%${q}%`;
  const promiseIdValue = promiseId == null ? null : Number(promiseId);
  const relatedPolicyIdValue = relatedPolicyId == null ? null : Number(relatedPolicyId);

  const db = getDb();
  const [rows] = await db.execute(
    `
    SELECT
      s.id,
      s.policy_id,
      s.source_title,
      s.source_url,
      s.source_type,
      s.publisher,
      s.published_date,
      COALESCE(ps_counts.promise_refs, 0) AS promise_refs,
      COALESCE(pas_counts.action_refs, 0) AS action_refs,
      COALESCE(pos_counts.outcome_refs, 0) AS outcome_refs,
      CASE
        WHEN ? IS NULL THEN 0
        ELSE COALESCE(promise_context.same_promise_refs, 0)
      END AS same_promise_refs,
      CASE
        WHEN ? IS NULL THEN 0
        WHEN s.policy_id = ? THEN 1
        ELSE 0
      END AS same_policy_match
    FROM sources s
    LEFT JOIN (
      SELECT source_id, COUNT(*) AS promise_refs
      FROM promise_sources
      GROUP BY source_id
    ) ps_counts ON ps_counts.source_id = s.id
    LEFT JOIN (
      SELECT source_id, COUNT(*) AS action_refs
      FROM promise_action_sources
      GROUP BY source_id
    ) pas_counts ON pas_counts.source_id = s.id
    LEFT JOIN (
      SELECT source_id, COUNT(*) AS outcome_refs
      FROM promise_outcome_sources
      GROUP BY source_id
    ) pos_counts ON pos_counts.source_id = s.id
    LEFT JOIN (
      SELECT ctx.source_id, COUNT(*) AS same_promise_refs
      FROM (
        SELECT ps.source_id
        FROM promise_sources ps
        WHERE ? IS NOT NULL AND ps.promise_id = ?
        UNION ALL
        SELECT pas.source_id
        FROM promise_actions pa
        JOIN promise_action_sources pas ON pas.promise_action_id = pa.id
        WHERE ? IS NOT NULL AND pa.promise_id = ?
        UNION ALL
        SELECT pos.source_id
        FROM promise_outcomes po
        JOIN promise_outcome_sources pos ON pos.promise_outcome_id = po.id
        WHERE ? IS NOT NULL AND po.promise_id = ?
      ) ctx
      GROUP BY ctx.source_id
    ) promise_context ON promise_context.source_id = s.id
    WHERE
      s.source_title LIKE ?
      OR s.source_url LIKE ?
      OR COALESCE(s.publisher, '') LIKE ?
    ORDER BY
      CASE WHEN same_promise_refs > 0 THEN 0 ELSE 1 END,
      CASE WHEN same_policy_match = 1 THEN 0 ELSE 1 END,
      CASE WHEN s.source_title LIKE ? THEN 0 ELSE 1 END,
      CASE WHEN s.source_url LIKE ? THEN 0 ELSE 1 END,
      s.published_date DESC,
      s.id DESC
    LIMIT ?
    `,
    [
      promiseIdValue,
      relatedPolicyIdValue,
      relatedPolicyIdValue,
      promiseIdValue,
      promiseIdValue,
      promiseIdValue,
      promiseIdValue,
      promiseIdValue,
      promiseIdValue,
      likeValue,
      likeValue,
      likeValue,
      likeValue,
      likeValue,
      effectiveLimit,
    ]
  );

  return rows.map(normalizeSourceRow).filter(Boolean);
}

function buildPossibleDuplicateError(possibleDuplicates = []) {
  const error = new Error(
    "A likely duplicate source already exists. Review the existing matches before creating a new source."
  );
  error.code = "source_curation_duplicate_warning";
  error.status = 409;
  error.data = {
    possibleDuplicates,
  };
  return error;
}

async function attachExistingSource({
  item,
  sourceId,
  note,
  searchQuery,
}) {
  const connection = await getDb().getConnection();
  try {
    await connection.beginTransaction();
    const attachedSource = await readSourceById(sourceId, connection);
    if (!attachedSource) {
      throw new Error("The selected source no longer exists.");
    }
    const beforeState = await fetchAttachedSourceState(item.record_type, item.record_id, connection);
    await insertSourceJoin(item.record_type, item.record_id, sourceId, connection);
    const afterState = await fetchAttachedSourceState(item.record_type, item.record_id, connection);
    await connection.commit();

    return {
      attachedSource,
      beforeState,
      afterState,
      storedDecision: normalizeMissingSourceDecision({
        reviewKey: item.review_key,
        recordType: item.record_type,
        recordId: item.record_id,
        promiseId: item.promise_id,
        promiseSlug: item.promise_slug,
        promiseTitle: item.promise_title,
        presidentSlug: item.president_slug,
        presidentName: item.president_name,
        topic: item.topic,
        importOrigin: item.import_origin,
        actionType: "attach_existing_source",
        note,
        searchQuery,
        attachedSource,
        beforeState,
        afterState,
        confirmedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    };
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}

async function createAndAttachSource({
  item,
  draft,
  note,
  overrideDuplicateWarning,
}) {
  if (!validateHttpUrl(draft.source_url)) {
    throw new Error("New sources require a valid http:// or https:// URL.");
  }
  const possibleDuplicates = await fetchLikelyDuplicateNewSources(draft);
  if (possibleDuplicates.length && !overrideDuplicateWarning) {
    throw buildPossibleDuplicateError(possibleDuplicates);
  }

  const connection = await getDb().getConnection();
  try {
    await connection.beginTransaction();
    const beforeState = await fetchAttachedSourceState(item.record_type, item.record_id, connection);
    const createdSourceId = await createSourceRow(draft, connection);
    await insertSourceJoin(item.record_type, item.record_id, createdSourceId, connection);
    const createdSource = await readSourceById(createdSourceId, connection);
    const afterState = await fetchAttachedSourceState(item.record_type, item.record_id, connection);
    await connection.commit();

    return {
      createdSource,
      beforeState,
      afterState,
      storedDecision: normalizeMissingSourceDecision({
        reviewKey: item.review_key,
        recordType: item.record_type,
        recordId: item.record_id,
        promiseId: item.promise_id,
        promiseSlug: item.promise_slug,
        promiseTitle: item.promise_title,
        presidentSlug: item.president_slug,
        presidentName: item.president_name,
        topic: item.topic,
        importOrigin: item.import_origin,
        actionType: "create_and_attach_source",
        note,
        createdSource,
        beforeState,
        afterState,
        confirmedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      possibleDuplicates,
    };
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}

function buildReviewedMissingSourceDecision(item, note) {
  return normalizeMissingSourceDecision({
    reviewKey: item.review_key,
    recordType: item.record_type,
    recordId: item.record_id,
    promiseId: item.promise_id,
    promiseSlug: item.promise_slug,
    promiseTitle: item.promise_title,
    presidentSlug: item.president_slug,
    presidentName: item.president_name,
    topic: item.topic,
    importOrigin: item.import_origin,
    actionType: "mark_missing_source_reviewed",
    note,
    confirmedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

async function mergeSelectedDuplicateSources({
  cluster,
  selectedSourceIds,
  canonicalSourceId,
  note,
}) {
  const selectedIds = uniqueStrings(selectedSourceIds.map((value) => String(value)))
    .map((value) => Number(value))
    .filter(Boolean);
  if (selectedIds.length < 2) {
    throw new Error("Select at least two source rows to merge.");
  }
  if (!selectedIds.includes(Number(canonicalSourceId || 0))) {
    throw new Error("Choose one of the selected source rows as the canonical row to keep.");
  }

  const clusterRows = new Map(cluster.rows.map((row) => [row.id, row]));
  for (const selectedId of selectedIds) {
    if (!clusterRows.has(selectedId)) {
      throw new Error("One or more selected source ids are no longer part of the duplicate cluster.");
    }
  }

  const selectedPolicyIds = uniqueStrings(
    selectedIds.map((id) => {
      const policyId = clusterRows.get(id)?.policy_id;
      return policyId == null ? "" : String(policyId);
    })
  )
    .map((value) => Number(value))
    .filter(Boolean);
  if (selectedPolicyIds.length > 1) {
    throw new Error(
      "The selected source rows have conflicting non-null policy ownership. Keep them separate or choose a subset with compatible policy_id values."
    );
  }

  const duplicateSourceIds = selectedIds.filter((id) => id !== Number(canonicalSourceId));
  const connection = await getDb().getConnection();
  try {
    await connection.beginTransaction();

    const joinTables = [
      ["promise_sources", "promise_id"],
      ["promise_action_sources", "promise_action_id"],
      ["promise_outcome_sources", "promise_outcome_id"],
    ];
    const joinUpdates = {};
    const placeholders = duplicateSourceIds.map(() => "?").join(", ");
    for (const [tableName, ownerField] of joinTables) {
      const [insertResult] = await connection.execute(
        `
        INSERT IGNORE INTO ${tableName} (${ownerField}, source_id)
        SELECT ${ownerField}, ?
        FROM ${tableName}
        WHERE source_id IN (${placeholders})
        `,
        [canonicalSourceId, ...duplicateSourceIds]
      );
      const [deleteResult] = await connection.execute(
        `
        DELETE FROM ${tableName}
        WHERE source_id IN (${placeholders})
        `,
        duplicateSourceIds
      );
      joinUpdates[tableName] = {
        insertedCanonicalRows: toSafeNumber(insertResult?.affectedRows, 0),
        deletedDuplicateRows: toSafeNumber(deleteResult?.affectedRows, 0),
      };
    }

    const [deleteSourcesResult] = await connection.execute(
      `
      DELETE FROM sources
      WHERE id IN (${placeholders})
      `,
      duplicateSourceIds
    );

    const [remainingRows] = await connection.execute(
      `
      SELECT id
      FROM sources
      WHERE source_url = ?
      ORDER BY id ASC
      `,
      [cluster.source_url]
    );

    await connection.commit();

    return {
      beforeState: {
        sourceIds: selectedIds,
        sourceCount: selectedIds.length,
        policyIds: selectedPolicyIds,
      },
      afterState: {
        sourceIds: remainingRows.map((row) => Number(row.id)),
        sourceCount: remainingRows.length,
        deletedSourceIds: duplicateSourceIds,
        joinUpdates,
        deletedSources: toSafeNumber(deleteSourcesResult?.affectedRows, 0),
      },
      storedDecision: normalizeDuplicateClusterDecision({
        clusterKey: cluster.cluster_key,
        actionType: "merge_duplicate_sources",
        sourceUrl: cluster.source_url,
        selectedSourceIds: selectedIds,
        canonicalSourceId,
        note,
        beforeState: {
          sourceIds: selectedIds,
          policyIds: selectedPolicyIds,
        },
        afterState: {
          remainingSourceIds: remainingRows.map((row) => Number(row.id)),
          deletedSourceIds: duplicateSourceIds,
          joinUpdates,
        },
        confirmedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    };
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}

function buildDuplicateDecision(cluster, actionType, note) {
  return normalizeDuplicateClusterDecision({
    clusterKey: cluster.cluster_key,
    actionType,
    sourceUrl: cluster.source_url,
    selectedSourceIds: cluster.rows.map((row) => row.id),
    canonicalSourceId: null,
    note,
    beforeState: {
      sourceIds: cluster.rows.map((row) => row.id),
      policyIds: cluster.distinct_policy_ids,
    },
    afterState: {},
    confirmedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

async function recordSourceCurationAction({
  store,
  missingSourceDecision = null,
  duplicateClusterDecision = null,
  auditEntry,
  commandSummary,
  commandTitle,
  commandPayload,
}) {
  const nextMissingDecisions = new Map(
    store.missingSourceDecisions.map((decision) => [decision.reviewKey, decision])
  );
  const nextDuplicateDecisions = new Map(
    store.duplicateClusterDecisions.map((decision) => [decision.clusterKey, decision])
  );

  if (missingSourceDecision) {
    nextMissingDecisions.set(missingSourceDecision.reviewKey, missingSourceDecision);
  }
  if (duplicateClusterDecision) {
    nextDuplicateDecisions.set(duplicateClusterDecision.clusterKey, duplicateClusterDecision);
  }

  await writeStateStore({
    currentStore: store,
    missingSourceDecisions: [...nextMissingDecisions.values()].sort((left, right) =>
      left.reviewKey.localeCompare(right.reviewKey)
    ),
    duplicateClusterDecisions: [...nextDuplicateDecisions.values()].sort((left, right) =>
      left.clusterKey.localeCompare(right.clusterKey)
    ),
  });
  await appendAuditLog(auditEntry);
  await createCommandHistoryEntry({
    rawCommand: commandPayload.rawCommand,
    normalizedCommand: commandPayload.normalizedCommand,
    resultType: "curation",
    resultStatus: "success",
    title: commandTitle,
    summary: commandSummary,
    confirmationRequired: true,
    payloadJson: {
      ...commandPayload,
      statePath: STATE_PATH,
      auditLogPath: AUDIT_LOG_PATH,
    },
  });
}

export async function applySourceCurationAction(input) {
  if (!input || typeof input !== "object") {
    throw new Error("A source-curation payload is required.");
  }
  if (!input.confirmed) {
    throw new Error("Explicit confirmation is required before saving a source-curation action.");
  }

  const workspace = await getSourceCurationWorkspace();
  const store = await readStateStore();
  const actionType = normalizeString(input.actionType || input.decisionType);

  if (MISSING_SOURCE_ACTION_TYPES.has(actionType)) {
    const reviewKey = normalizeString(input.reviewKey);
    const item = workspace.missingSources.groups
      .flatMap((group) => group.items)
      .find((candidate) => candidate.review_key === reviewKey);
    if (!item) {
      throw new Error(
        "The selected missing-source row is no longer unresolved in the current DB state."
      );
    }

    if (actionType === "attach_existing_source") {
      const sourceId = Number(input.selectedSourceId || 0);
      if (!sourceId) {
        throw new Error("Select an existing source before attaching it.");
      }
      const result = await attachExistingSource({
        item,
        sourceId,
        note: normalizeString(input.note),
        searchQuery: normalizeString(input.searchQuery),
      });
      const auditEntry = buildAuditEntry({
        actionType,
        entityType: "missing-source",
        entityKey: reviewKey,
        note: input.note,
        sourceIds: result.afterState.sourceIds,
        beforeState: result.beforeState,
        afterState: result.afterState,
        metadata: {
          promiseSlug: item.promise_slug,
          recordType: item.record_type,
          recordId: item.record_id,
        },
      });
      await recordSourceCurationAction({
        store,
        missingSourceDecision: result.storedDecision,
        auditEntry,
        commandTitle: "Attached existing source",
        commandSummary: buildCommandHistorySummary(
          actionType,
          `${item.record_type} ${item.record_id}`
        ),
        commandPayload: {
          rawCommand: `source-curation attach-existing ${reviewKey} --source ${sourceId}`,
          normalizedCommand: "source-curation attach-existing",
          reviewKey,
          actionType,
          sourceId,
        },
      });
      return {
        entityType: "missing-source",
        actionType,
        decision: result.storedDecision,
        auditLogPath: AUDIT_LOG_PATH,
        statePath: STATE_PATH,
      };
    }

    if (actionType === "create_and_attach_source" || actionType === "add_new_source") {
      const draft =
        input.newSourceDraft && typeof input.newSourceDraft === "object"
          ? input.newSourceDraft
          : {};
      if (!normalizeString(draft.source_title) || !normalizeString(draft.source_url)) {
        throw new Error("A title and URL are required to create and attach a new source.");
      }
      const result = await createAndAttachSource({
        item,
        draft,
        note: normalizeString(input.note),
        overrideDuplicateWarning: Boolean(input.overrideDuplicateWarning),
      });
      const auditEntry = buildAuditEntry({
        actionType: "create_and_attach_source",
        entityType: "missing-source",
        entityKey: reviewKey,
        note: input.note,
        sourceIds: result.afterState.sourceIds,
        beforeState: result.beforeState,
        afterState: result.afterState,
        metadata: {
          promiseSlug: item.promise_slug,
          recordType: item.record_type,
          recordId: item.record_id,
          createdSourceId: result.createdSource?.id || null,
        },
      });
      await recordSourceCurationAction({
        store,
        missingSourceDecision: result.storedDecision,
        auditEntry,
        commandTitle: "Created and attached source",
        commandSummary: buildCommandHistorySummary(
          "create_and_attach_source",
          `${item.record_type} ${item.record_id}`
        ),
        commandPayload: {
          rawCommand: `source-curation create-and-attach ${reviewKey}`,
          normalizedCommand: "source-curation create-and-attach",
          reviewKey,
          actionType: "create_and_attach_source",
          createdSourceId: result.createdSource?.id || null,
        },
      });
      return {
        entityType: "missing-source",
        actionType: "create_and_attach_source",
        decision: result.storedDecision,
        createdSource: result.createdSource,
        auditLogPath: AUDIT_LOG_PATH,
        statePath: STATE_PATH,
      };
    }

    const note = normalizeString(input.note);
    if (!note) {
      throw new Error("Add a short note before marking a missing-source row as reviewed.");
    }
    const decision = buildReviewedMissingSourceDecision(item, note);
    const auditEntry = buildAuditEntry({
      actionType: "mark_missing_source_reviewed",
      entityType: "missing-source",
      entityKey: reviewKey,
      note,
      beforeState: {},
      afterState: {},
      metadata: {
        promiseSlug: item.promise_slug,
        recordType: item.record_type,
        recordId: item.record_id,
      },
    });
    await recordSourceCurationAction({
      store,
      missingSourceDecision: decision,
      auditEntry,
      commandTitle: "Marked missing source reviewed",
      commandSummary: buildCommandHistorySummary(
        "mark_missing_source_reviewed",
        `${item.record_type} ${item.record_id}`
      ),
      commandPayload: {
        rawCommand: `source-curation mark-reviewed ${reviewKey}`,
        normalizedCommand: "source-curation mark-reviewed",
        reviewKey,
        actionType: "mark_missing_source_reviewed",
      },
    });
    return {
      entityType: "missing-source",
      actionType: "mark_missing_source_reviewed",
      decision,
      auditLogPath: AUDIT_LOG_PATH,
      statePath: STATE_PATH,
    };
  }

  if (DUPLICATE_CLUSTER_ACTION_TYPES.has(actionType)) {
    const clusterKey = normalizeString(input.clusterKey);
    const cluster = workspace.duplicates.groups
      .flatMap((group) => group.clusters)
      .find((candidate) => candidate.cluster_key === clusterKey);
    if (!cluster) {
      throw new Error(
        "The selected duplicate-source cluster is no longer unresolved in the current DB state."
      );
    }

    if (actionType === "merge_duplicate_sources") {
      const result = await mergeSelectedDuplicateSources({
        cluster,
        selectedSourceIds: Array.isArray(input.selectedSourceIds)
          ? input.selectedSourceIds
          : [],
        canonicalSourceId: Number(input.canonicalSourceId || 0),
        note: normalizeString(input.note),
      });
      const auditEntry = buildAuditEntry({
        actionType,
        entityType: "duplicate-cluster",
        entityKey: clusterKey,
        note: input.note,
        sourceIds: result.afterState.remainingSourceIds || [],
        beforeState: result.beforeState,
        afterState: result.afterState,
        metadata: {
          sourceUrl: cluster.source_url,
        },
      });
      await recordSourceCurationAction({
        store,
        duplicateClusterDecision: result.storedDecision,
        auditEntry,
        commandTitle: "Merged duplicate sources",
        commandSummary: buildCommandHistorySummary(
          actionType,
          cluster.source_url || cluster.cluster_key
        ),
        commandPayload: {
          rawCommand: `source-curation merge-duplicates ${clusterKey}`,
          normalizedCommand: "source-curation merge-duplicates",
          clusterKey,
          actionType,
          canonicalSourceId: Number(input.canonicalSourceId || 0),
        },
      });
      return {
        entityType: "duplicate-cluster",
        actionType,
        decision: result.storedDecision,
        auditLogPath: AUDIT_LOG_PATH,
        statePath: STATE_PATH,
      };
    }

    const note = normalizeString(input.note);
    if (!note) {
      throw new Error("Add a short note before resolving a duplicate-source cluster.");
    }
    const decision = buildDuplicateDecision(cluster, actionType, note);
    const auditEntry = buildAuditEntry({
      actionType,
      entityType: "duplicate-cluster",
      entityKey: clusterKey,
      note,
      sourceIds: cluster.rows.map((row) => row.id),
      beforeState: {
        sourceIds: cluster.rows.map((row) => row.id),
        policyIds: cluster.distinct_policy_ids,
      },
      afterState: {},
      metadata: {
        sourceUrl: cluster.source_url,
      },
    });
    await recordSourceCurationAction({
      store,
      duplicateClusterDecision: decision,
      auditEntry,
      commandTitle:
        actionType === "keep_duplicate_sources_separate"
          ? "Marked duplicate sources keep separate"
          : "Marked duplicate cluster reviewed",
      commandSummary: buildCommandHistorySummary(actionType, cluster.source_url || clusterKey),
      commandPayload: {
        rawCommand: `source-curation ${actionType} ${clusterKey}`,
        normalizedCommand: `source-curation ${actionType}`,
        clusterKey,
        actionType,
      },
    });
    return {
      entityType: "duplicate-cluster",
      actionType,
      decision,
      auditLogPath: AUDIT_LOG_PATH,
      statePath: STATE_PATH,
    };
  }

  throw new Error("Unsupported source-curation action.");
}
