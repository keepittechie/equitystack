import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Read-only artifact reader for the canonical Python current-admin pipeline.
// This service must not generate AI reviews, mutate DB state, or replace the
// file-driven workflow under python/reports/current_admin/.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const PYTHON_DIR = path.join(PROJECT_ROOT, "python");
const CURRENT_ADMIN_REPORTS_DIR = path.join(PROJECT_ROOT, "python", "reports", "current_admin");
const REVIEW_DECISIONS_DIR = path.join(CURRENT_ADMIN_REPORTS_DIR, "review_decisions");
const FEEDBACK_OUTPUT_DIR = path.join(CURRENT_ADMIN_REPORTS_DIR, "feedback");
const DEFAULT_FEEDBACK_OUTPUT_PATH = path.join(
  FEEDBACK_OUTPUT_DIR,
  "ai_feedback_summary.json"
);

const REVIEW_RISK_FORMULA = {
  scale: "0-10",
  advisory_only: true,
  high_meaning: "Higher review risk means the item is more ambiguous, conflict-heavy, or source-thin.",
  low_meaning: "Lower review risk means the item appears more stable and straightforward for review.",
  inputs: [
    "review_priority_score capped at 6",
    "has_material_conflict (+2)",
    "deep_review_recommended (+1)",
    "low confidence (+1)",
    "source warnings or evidence gaps (+1)",
  ],
};

const OPERATOR_FRICTION_FORMULA = {
  scale: "0-10",
  advisory_only: true,
  high_meaning: "Higher operator friction means more manual effort, hesitation, or disagreement is likely.",
  low_meaning: "Lower operator friction means the item should take less operator effort to move through review.",
  inputs: [
    "review_priority high (+2) / medium (+1)",
    "suggested_batch manual_review_focus (+2)",
    "operator_attention_needed (+1)",
    "has_material_conflict (+2)",
    "deep_review_recommended without deep review (+1)",
    "source warnings (+1)",
    "decision mismatch (+2 when available)",
    "operator_action in manual_review_required, needs_more_sources, defer, reject, escalate (+1 when available)",
  ],
};

function toSafeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeString(entry))
    .filter(Boolean);
}

function confidenceBucket(score) {
  if (score >= 0.8) return "high";
  if (score >= 0.55) return "medium";
  return "low";
}

function compareByGeneratedAtDesc(a, b) {
  return (new Date(b.generated_at || 0).getTime() || 0) - (new Date(a.generated_at || 0).getTime() || 0);
}

function average(values = []) {
  if (!values.length) {
    return null;
  }

  const sum = values.reduce((total, value) => total + value, 0);
  return Number((sum / values.length).toFixed(3));
}

function incrementCounter(bucket, key, amount = 1) {
  if (!key) {
    return;
  }

  bucket[key] = (bucket[key] || 0) + amount;
}

function sortCounter(bucket) {
  return Object.fromEntries(
    Object.entries(bucket).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  );
}

function summarizeByDate(entries, getDateKey, getCount = () => 1) {
  const bucket = {};

  for (const entry of entries) {
    const key = getDateKey(entry);
    if (!key) {
      continue;
    }

    incrementCounter(bucket, key, getCount(entry));
  }

  return Object.entries(bucket)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }));
}

function classifyLevelFromScore(score) {
  if (score >= 7) return "high";
  if (score >= 4) return "medium";
  return "low";
}

function buildRefinedReviewProfile(reviewItem = {}, decisionItem = null) {
  const suggestion =
    reviewItem?.suggestions ||
    decisionItem?.ai_suggestions_snapshot ||
    {};
  const reviewPriorityScore = Math.max(
    0,
    Math.min(10, toSafeNumber(reviewItem.review_priority_score, 0))
  );
  const hasMaterialConflict = Boolean(reviewItem.has_material_conflict);
  const deepReviewRecommended = Boolean(reviewItem.deep_review_recommended);
  const deepReviewRan = Boolean(reviewItem.deep_review_ran);
  const operatorAttentionNeeded = Boolean(reviewItem.operator_attention_needed);
  const confidenceScore = Math.max(
    0,
    Math.min(1, toSafeNumber(suggestion.confidence_score, 0.5))
  );
  const confidenceLevel =
    normalizeString(suggestion.confidence_level) ||
    confidenceBucket(confidenceScore);
  const sourceWarnings = [
    ...normalizeStringArray(suggestion.source_warnings),
    ...normalizeStringArray(suggestion.missing_source_warnings),
  ];
  const sourceWarningCount = new Set(sourceWarnings).size;
  const evidenceGapCount = normalizeStringArray(
    suggestion.evidence_needed_to_reduce_risk
  ).length;

  const reviewRiskScore = Math.min(
    10,
    Math.min(reviewPriorityScore, 6) +
      (hasMaterialConflict ? 2 : 0) +
      (deepReviewRecommended ? 1 : 0) +
      (confidenceLevel === "Low" || confidenceScore < 0.55 ? 1 : 0) +
      (sourceWarningCount > 0 || evidenceGapCount > 0 ? 1 : 0)
  );

  const operatorAction = normalizeString(decisionItem?.operator_action);
  const needsHeavyManualFollowup = [
    "manual_review_required",
    "needs_more_sources",
    "defer",
    "reject",
    "escalate",
  ].includes(operatorAction);

  const operatorFrictionScore = Math.min(
    10,
    (reviewItem.review_priority === "high"
      ? 2
      : reviewItem.review_priority === "medium"
        ? 1
        : 0) +
      (reviewItem.suggested_batch === "manual_review_focus" ? 2 : 0) +
      (operatorAttentionNeeded ? 1 : 0) +
      (hasMaterialConflict ? 2 : 0) +
      (deepReviewRecommended && !deepReviewRan ? 1 : 0) +
      (sourceWarningCount > 0 ? 1 : 0) +
      (decisionItem?.decision_alignment === "mismatch" ? 2 : 0) +
      (needsHeavyManualFollowup ? 1 : 0)
  );

  let sourceSufficiency = "sufficient";
  if (sourceWarnings.some((warning) => warning.startsWith("missing_"))) {
    sourceSufficiency = "missing";
  } else if (sourceWarningCount > 0 || evidenceGapCount > 0) {
    sourceSufficiency = "thin";
  }

  return {
    review_risk_score: reviewRiskScore,
    review_risk_level: classifyLevelFromScore(reviewRiskScore),
    operator_friction_score: operatorFrictionScore,
    operator_friction_level: classifyLevelFromScore(operatorFrictionScore),
    source_sufficiency: sourceSufficiency,
    conflict_risk: hasMaterialConflict ? "material" : reviewItem.conflict_fields?.length ? "elevated" : "low",
    confidence_band: confidenceLevel,
    attention_class: reviewItem.review_priority || classifyLevelFromScore(reviewPriorityScore),
    formulas: {
      review_risk_score: REVIEW_RISK_FORMULA,
      operator_friction_score: OPERATOR_FRICTION_FORMULA,
    },
  };
}

async function readJsonFile(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function statSafe(filePath) {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
}

async function ensureDir(filePath) {
  await fs.mkdir(filePath, { recursive: true });
}

async function listJsonFiles(dirPath, matcher) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && matcher(entry.name))
      .map((entry) => path.join(dirPath, entry.name));

    const withStats = await Promise.all(
      files.map(async (filePath) => ({
        filePath,
        stat: await fs.stat(filePath),
      }))
    );

    return withStats.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
  } catch {
    return [];
  }
}

async function listReviewReportFiles() {
  return listJsonFiles(
    CURRENT_ADMIN_REPORTS_DIR,
    (name) => name.endsWith(".ai-review.json")
  );
}

async function listDecisionLogFiles() {
  return listJsonFiles(
    REVIEW_DECISIONS_DIR,
    (name) => name.endsWith(".json")
  );
}

async function listPrecommitFiles() {
  return listJsonFiles(
    CURRENT_ADMIN_REPORTS_DIR,
    (name) => name.endsWith(".pre-commit-review.json")
  );
}

async function listDecisionTemplateFiles() {
  return listJsonFiles(
    CURRENT_ADMIN_REPORTS_DIR,
    (name) => name.endsWith(".decision-template.json")
  );
}

async function listImportDryRunFiles() {
  return listJsonFiles(
    CURRENT_ADMIN_REPORTS_DIR,
    (name) => name.endsWith(".import-dry-run.json")
  );
}

async function listImportApplyFiles() {
  return listJsonFiles(
    CURRENT_ADMIN_REPORTS_DIR,
    (name) => name.endsWith(".import-apply.json")
  );
}

async function listValidationFiles() {
  return listJsonFiles(
    CURRENT_ADMIN_REPORTS_DIR,
    (name) => name.endsWith(".import-validation.json")
  );
}

function toIsoDate(value) {
  const text = normalizeString(value);
  if (!text) {
    return null;
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function buildReviewReportSummary(report, filePath, stat) {
  const items = Array.isArray(report?.items) ? report.items : [];
  const reviewPriorityCounts =
    report?.review_priority_counts ||
    sortCounter(
      items.reduce((bucket, item) => {
        incrementCounter(bucket, item.review_priority);
        return bucket;
      }, {})
    );
  const suggestedBatchCounts =
    report?.suggested_batch_counts ||
    sortCounter(
      items.reduce((bucket, item) => {
        incrementCounter(bucket, item.suggested_batch);
        return bucket;
      }, {})
    );

  const enrichedItems = items.map((item) => ({
    ...item,
    refined_review_profile: buildRefinedReviewProfile(item),
  }));

  return {
    file_path: filePath,
    file_name: path.basename(filePath),
    generated_at: stat?.mtime?.toISOString?.() || null,
    batch_name: report?.batch_name || null,
    model: report?.model || null,
    review_mode: report?.review_mode || null,
    reviewed_count: toSafeNumber(report?.reviewed_count, items.length),
    deep_review_count: toSafeNumber(
      report?.deep_review_count,
      items.filter((item) => item.deep_review_ran).length
    ),
    review_priority_counts: reviewPriorityCounts,
    suggested_batch_counts: suggestedBatchCounts,
    items_needing_attention: enrichedItems.filter(
      (item) => item.operator_attention_needed
    ).length,
    items_with_material_conflicts: enrichedItems.filter(
      (item) => item.has_material_conflict
    ).length,
    items_recommended_for_deep_review: enrichedItems.filter(
      (item) => item.deep_review_recommended
    ).length,
    average_review_risk_score: average(
      enrichedItems.map((item) => item.refined_review_profile.review_risk_score)
    ),
    average_operator_friction_score: average(
      enrichedItems.map(
        (item) => item.refined_review_profile.operator_friction_score
      )
    ),
    items: enrichedItems,
  };
}

async function loadReviewReports() {
  const files = await listReviewReportFiles();
  return Promise.all(
    files.map(async ({ filePath, stat }) => {
      const report = await readJsonFile(filePath);
      return buildReviewReportSummary(report, filePath, stat);
    })
  );
}

function resolveReviewReference(fileReference) {
  const normalized = normalizeString(fileReference);
  if (!normalized) {
    return null;
  }

  const candidatePaths = [];

  if (path.isAbsolute(normalized)) {
    candidatePaths.push(normalized);
    candidatePaths.push(path.join(CURRENT_ADMIN_REPORTS_DIR, path.basename(normalized)));
  } else {
    candidatePaths.push(path.join(PROJECT_ROOT, normalized));
    candidatePaths.push(path.join(CURRENT_ADMIN_REPORTS_DIR, normalized));
    candidatePaths.push(path.join(CURRENT_ADMIN_REPORTS_DIR, path.basename(normalized)));
  }

  return candidatePaths;
}

async function resolveExistingReviewPath(fileReference) {
  const candidates = resolveReviewReference(fileReference) || [];

  for (const candidate of candidates) {
    if (await statSafe(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function loadDecisionLogs() {
  const files = await listDecisionLogFiles();
  const reviewCache = new Map();

  return Promise.all(
    files.map(async ({ filePath, stat }) => {
      const payload = await readJsonFile(filePath);
      const items = Array.isArray(payload?.items) ? payload.items : [];
      const sourceReviewPath = await resolveExistingReviewPath(payload?.source_review_file);
      let reviewMap = new Map();

      if (sourceReviewPath) {
        if (!reviewCache.has(sourceReviewPath)) {
          const sourceReview = await readJsonFile(sourceReviewPath);
          const sourceItems = Array.isArray(sourceReview?.items) ? sourceReview.items : [];
          reviewCache.set(
            sourceReviewPath,
            new Map(sourceItems.map((item) => [item.slug, item]))
          );
        }

        reviewMap = reviewCache.get(sourceReviewPath);
      }

      const enrichedItems = items.map((item) => {
        const reviewItem = reviewMap.get(item.slug) || null;
        return {
          ...item,
          review_item: reviewItem,
          refined_review_profile: buildRefinedReviewProfile(reviewItem || {}, item),
        };
      });

      const operatorActionCounts = sortCounter(
        enrichedItems.reduce((bucket, item) => {
          incrementCounter(bucket, item.operator_action);
          return bucket;
        }, {})
      );

      return {
        file_path: filePath,
        file_name: path.basename(filePath),
        generated_at:
          normalizeString(payload?.generated_at) ||
          stat?.mtime?.toISOString?.() ||
          null,
        session_id: payload?.session_id || path.basename(filePath, ".json"),
        source_review_file: payload?.source_review_file || null,
        source_decision_file: payload?.source_decision_file || null,
        worklist_used: payload?.worklist_used || null,
        selection_filters: payload?.selection_filters || null,
        session_focus: payload?.session_focus || null,
        decision_counts: payload?.decision_counts || {
          match: enrichedItems.filter((item) => item.decision_alignment === "match").length,
          mismatch: enrichedItems.filter((item) => item.decision_alignment === "mismatch").length,
        },
        operator_action_counts: operatorActionCounts,
        items: enrichedItems,
      };
    })
  );
}

async function loadPrecommitReports() {
  const files = await listPrecommitFiles();
  return Promise.all(
    files.map(async ({ filePath, stat }) => {
      const payload = await readJsonFile(filePath);
      return {
        file_path: filePath,
        file_name: path.basename(filePath),
        generated_at:
          normalizeString(payload?.generated_at) ||
          stat?.mtime?.toISOString?.() ||
          null,
        batch_name: payload?.batch_name || path.basename(filePath, ".pre-commit-review.json"),
        source_queue_file: payload?.source_queue_file || null,
        source_review_file: payload?.source_review_file || null,
        source_decision_template: payload?.source_decision_template || null,
        source_decision_log: payload?.source_decision_log || null,
        decision_log_resolution: payload?.decision_log_resolution || "none",
        decision_template_source_review_file:
          payload?.decision_template_source_review_file || null,
        decision_log_source_review_file:
          payload?.decision_log_source_review_file || null,
        artifact_linkage: payload?.artifact_linkage || {},
        summary: payload?.summary || {},
        selected_for_import_count: toSafeNumber(payload?.selected_for_import_count, 0),
        decision_covered_count: toSafeNumber(payload?.decision_covered_count, 0),
        decision_missing_count: toSafeNumber(payload?.decision_missing_count, 0),
        invalid_operator_action_count: toSafeNumber(
          payload?.invalid_operator_action_count,
          0
        ),
        unresolved_manual_review_count: toSafeNumber(payload?.unresolved_manual_review_count, 0),
        material_conflict_count: toSafeNumber(payload?.material_conflict_count, 0),
        source_gap_count: toSafeNumber(payload?.source_gap_count, 0),
        high_attention_count: toSafeNumber(payload?.high_attention_count, 0),
        readiness_status: payload?.readiness_status || "blocked",
        readiness_label: payload?.readiness_label || null,
        readiness_explanation: payload?.readiness_explanation || null,
        readiness_details: payload?.readiness_details || null,
        warning_counts: payload?.warning_counts || {},
        blocking_issues: Array.isArray(payload?.blocking_issues) ? payload.blocking_issues : [],
        linkage_warnings: Array.isArray(payload?.linkage_warnings)
          ? payload.linkage_warnings
          : [],
        low_confidence_items: Array.isArray(payload?.low_confidence_items)
          ? payload.low_confidence_items
          : [],
        diff_preview: payload?.diff_preview || {
          new_records: [],
          updated_records: [],
          skipped_items: [],
        },
        items: Array.isArray(payload?.items) ? payload.items : [],
        recommended_next_step: payload?.recommended_next_step || null,
      };
    })
  );
}

async function loadDecisionTemplates() {
  const files = await listDecisionTemplateFiles();
  return Promise.all(
    files.map(async ({ filePath, stat }) => {
      const payload = await readJsonFile(filePath);
      const items = Array.isArray(payload?.items) ? payload.items : [];
      return {
        file_path: filePath,
        file_name: path.basename(filePath),
        generated_at:
          normalizeString(payload?.generated_at) ||
          stat?.mtime?.toISOString?.() ||
          null,
        session_id: payload?.session_id || null,
        source_review_file: payload?.source_review_file || null,
        source_artifact_file: payload?.source_artifact_file || null,
        session_focus: payload?.session_focus || null,
        item_count: toSafeNumber(payload?.item_count, items.length),
        decision_options: Array.isArray(payload?.decision_options)
          ? payload.decision_options
          : [],
        items,
      };
    })
  );
}

async function loadImportReports(listFiles, mode) {
  const files = await listFiles();
  return Promise.all(
    files.map(async ({ filePath, stat }) => {
      const payload = await readJsonFile(filePath);
      return {
        file_path: filePath,
        file_name: path.basename(filePath),
        generated_at: stat?.mtime?.toISOString?.() || null,
        mode: payload?.mode || mode,
        batch_name: payload?.batch_name || null,
        president_slug: payload?.president_slug || null,
        promises_created: toSafeNumber(payload?.promises_created, 0),
        promises_updated: toSafeNumber(payload?.promises_updated, 0),
        actions_created: toSafeNumber(payload?.actions_created, 0),
        outcomes_created: toSafeNumber(payload?.outcomes_created, 0),
        sources_created: toSafeNumber(payload?.sources_created, 0),
        sources_reused: toSafeNumber(payload?.sources_reused, 0),
        skipped_duplicates: toSafeNumber(payload?.skipped_duplicates, 0),
        conflicts: Array.isArray(payload?.conflicts) ? payload.conflicts : [],
        notes: Array.isArray(payload?.notes) ? payload.notes : [],
        validation: payload?.validation || {},
      };
    })
  );
}

async function loadValidationReports() {
  const files = await listValidationFiles();
  return Promise.all(
    files.map(async ({ filePath, stat }) => {
      const payload = await readJsonFile(filePath);
      return {
        file_path: filePath,
        file_name: path.basename(filePath),
        generated_at: stat?.mtime?.toISOString?.() || null,
        batch_name: payload?.batch_name || null,
        validated_count: toSafeNumber(payload?.validated_count, 0),
        records: Array.isArray(payload?.records) ? payload.records : [],
        score_summary: payload?.score_summary || {},
        issues: Array.isArray(payload?.issues) ? payload.issues : [],
      };
    })
  );
}

function buildAttentionSummary(reviewItem = {}) {
  const suggestion = reviewItem?.suggestions || {};
  const parts = [];
  const checks = [];

  if (reviewItem.review_priority) {
    parts.push(
      `priority=${reviewItem.review_priority} (${reviewItem.review_priority_score ?? 0})`
    );
  }
  if (reviewItem.suggested_batch) {
    parts.push(`batch=${reviewItem.suggested_batch}`);
  }
  if (reviewItem.has_material_conflict) {
    parts.push("material conflict");
    checks.push("Compare the conflicting suggestions before choosing operator_action.");
  }
  if (reviewItem.deep_review_recommended) {
    parts.push("deep review recommended");
    checks.push("Consider deep review if the record still feels ambiguous.");
  }
  if (reviewItem.operator_attention_needed) {
    parts.push("attention needed");
  }
  if (
    Array.isArray(suggestion.source_warnings) && suggestion.source_warnings.length
    || Array.isArray(suggestion.missing_source_warnings) && suggestion.missing_source_warnings.length
  ) {
    checks.push("Check the sources and make sure the evidence still supports the record.");
  }
  if (
    Array.isArray(suggestion.evidence_needed_to_reduce_risk) &&
    suggestion.evidence_needed_to_reduce_risk.length
  ) {
    checks.push("Look at the evidence gaps before moving this item toward import.");
  }

  return {
    attention_summary: parts.join("; ") || "standard review item",
    suggested_checks: checks,
  };
}

function buildWorkspaceReviewItems(reviewReport, decisionTemplate, latestDecision) {
  const templateBySlug = new Map(
    (decisionTemplate?.items || []).map((item) => [item.slug, item])
  );
  const latestDecisionBySlug = new Map(
    (latestDecision?.items || []).map((item) => [item.slug, item])
  );

  return (reviewReport?.items || []).map((item, index) => {
    const templateItem = templateBySlug.get(item.slug);
    const lastDecision = latestDecisionBySlug.get(item.slug);
    const displayBits = templateItem || buildAttentionSummary(item);
    return {
      index: index + 1,
      slug: item.slug,
      title: item.title,
      review_priority: item.review_priority,
      review_priority_score: item.review_priority_score,
      suggested_batch: item.suggested_batch,
      operator_attention_needed: Boolean(item.operator_attention_needed),
      has_material_conflict: Boolean(item.has_material_conflict),
      deep_review_recommended: Boolean(item.deep_review_recommended),
      manual_review_severity: item.manual_review_severity || null,
      attention_summary: displayBits.attention_summary,
      suggested_checks: displayBits.suggested_checks || [],
      ai_record_action_suggestion:
        templateItem?.ai_record_action_suggestion ||
        item?.suggestions?.record_action_suggestion ||
        null,
      operator_action:
        normalizeString(templateItem?.operator_action) ||
        normalizeString(lastDecision?.operator_action) ||
        "",
      operator_notes:
        normalizeString(templateItem?.operator_notes) ||
        normalizeString(lastDecision?.operator_notes) ||
        "",
      final_decision_summary:
        normalizeString(templateItem?.final_decision_summary) ||
        normalizeString(lastDecision?.final_decision_summary) ||
        "",
    };
  });
}

function isImportReadyPrecommit(precommitReport) {
  return ["ready", "ready_with_warnings"].includes(
    normalizeString(precommitReport?.readiness_status)
  );
}

function buildBatchStage({
  normalizedExists,
  reviewReport,
  decisionLog,
  queueExists,
  precommitReport,
  importDryRun,
  importApply,
}) {
  if (!normalizedExists && !reviewReport) {
    return "DISCOVERY_READY";
  }
  if (normalizedExists && !reviewReport) {
    return "NORMALIZED";
  }
  if (reviewReport && (!decisionLog || !queueExists)) {
    return "REVIEW_READY";
  }
  if (decisionLog && queueExists && !precommitReport) {
    return "QUEUE_READY";
  }
  if (precommitReport && !isImportReadyPrecommit(precommitReport)) {
    return "BLOCKED";
  }
  if (precommitReport && isImportReadyPrecommit(precommitReport) && !importDryRun) {
    return "PRECOMMIT_READY";
  }
  if (importDryRun && !importApply) {
    return "IMPORT_READY";
  }
  if (importApply) {
    return "COMPLETE";
  }
  return "REVIEW_READY";
}

function buildWorkspaceCounts(reviewItems) {
  return reviewItems.reduce(
    (bucket, item) => {
      bucket.total_items += 1;
      if (!item.operator_action) {
        bucket.pending += 1;
      } else if (["approve_as_is", "approve_with_changes"].includes(item.operator_action)) {
        bucket.approved += 1;
      } else {
        bucket.blocked += 1;
      }
      return bucket;
    },
    { total_items: 0, approved: 0, pending: 0, blocked: 0 }
  );
}

function buildReviewOverviewPayload(reviewReports) {
  const latestReview = reviewReports[0] || null;

  return {
    latest_review: latestReview
      ? {
          file_path: latestReview.file_path,
          generated_at: latestReview.generated_at,
          batch_name: latestReview.batch_name,
          model: latestReview.model,
          review_mode: latestReview.review_mode,
        }
      : null,
    total_review_reports: reviewReports.length,
    review_overview: latestReview
      ? {
          reviewed_count: latestReview.reviewed_count,
          review_priority_counts: latestReview.review_priority_counts,
          suggested_batch_counts: latestReview.suggested_batch_counts,
          items_needing_attention: latestReview.items_needing_attention,
          items_with_material_conflicts: latestReview.items_with_material_conflicts,
          items_recommended_for_deep_review:
            latestReview.items_recommended_for_deep_review,
          average_review_risk_score: latestReview.average_review_risk_score,
          average_operator_friction_score:
            latestReview.average_operator_friction_score,
        }
      : {
          reviewed_count: 0,
          review_priority_counts: {},
          suggested_batch_counts: {},
          items_needing_attention: 0,
          items_with_material_conflicts: 0,
          items_recommended_for_deep_review: 0,
          average_review_risk_score: null,
          average_operator_friction_score: null,
        },
    refinement_formulas: {
      review_risk_score: REVIEW_RISK_FORMULA,
      operator_friction_score: OPERATOR_FRICTION_FORMULA,
    },
  };
}

function buildDecisionMetricsPayload(decisionLogs) {
  const actionCounts = {};
  const alignmentCounts = { match: 0, mismatch: 0 };
  const actionsBySessionFocus = {};

  for (const session of decisionLogs) {
    const focus = session.session_focus || "unspecified";
    if (!actionsBySessionFocus[focus]) {
      actionsBySessionFocus[focus] = {};
    }

    for (const [action, count] of Object.entries(session.operator_action_counts || {})) {
      incrementCounter(actionCounts, action, count);
      incrementCounter(actionsBySessionFocus[focus], action, count);
    }

    alignmentCounts.match += toSafeNumber(session.decision_counts?.match, 0);
    alignmentCounts.mismatch += toSafeNumber(session.decision_counts?.mismatch, 0);
  }

  return {
    total_decision_log_sessions: decisionLogs.length,
    total_logged_decisions: decisionLogs.reduce(
      (total, session) => total + session.items.length,
      0
    ),
    operator_action_counts: sortCounter(actionCounts),
    alignment_counts: alignmentCounts,
    actions_by_session_focus: Object.fromEntries(
      Object.entries(actionsBySessionFocus)
        .map(([focus, bucket]) => [focus, sortCounter(bucket)])
        .sort((a, b) => a[0].localeCompare(b[0]))
    ),
    recent_sessions: decisionLogs.slice(0, 10).map((session) => ({
      session_id: session.session_id,
      generated_at: session.generated_at,
      session_focus: session.session_focus,
      item_count: session.items.length,
      match_count: toSafeNumber(session.decision_counts?.match, 0),
      mismatch_count: toSafeNumber(session.decision_counts?.mismatch, 0),
      operator_action_counts: session.operator_action_counts,
    })),
  };
}

function buildTrendPayload(reviewReports, decisionLogs) {
  const allReviewItems = reviewReports.flatMap((report) =>
    report.items.map((item) => ({
      batch_name: report.batch_name,
      generated_at: report.generated_at,
      ...item,
    }))
  );
  const allDecisionItems = decisionLogs.flatMap((session) =>
    session.items.map((item) => ({
      session_id: session.session_id,
      session_focus: session.session_focus,
      generated_at: session.generated_at,
      ...item,
    }))
  );

  return {
    review_reports_by_date: summarizeByDate(
      reviewReports,
      (report) => toIsoDate(report.generated_at),
      (report) => report.reviewed_count || 0
    ),
    decision_sessions_by_date: summarizeByDate(
      decisionLogs,
      (session) => toIsoDate(session.generated_at),
      () => 1
    ),
    logged_decisions_by_date: summarizeByDate(
      decisionLogs,
      (session) => toIsoDate(session.generated_at),
      (session) => session.items.length
    ),
    review_priority_distribution: sortCounter(
      allReviewItems.reduce((bucket, item) => {
        incrementCounter(bucket, item.review_priority);
        return bucket;
      }, {})
    ),
    suggested_batch_distribution: sortCounter(
      allReviewItems.reduce((bucket, item) => {
        incrementCounter(bucket, item.suggested_batch);
        return bucket;
      }, {})
    ),
    session_focus_distribution: sortCounter(
      decisionLogs.reduce((bucket, session) => {
        incrementCounter(bucket, session.session_focus || "unspecified");
        return bucket;
      }, {})
    ),
    alignment_by_priority: Object.fromEntries(
      ["low", "medium", "high"].map((priority) => {
        const items = allDecisionItems.filter(
          (item) => item.review_item?.review_priority === priority
        );
        return [
          priority,
          {
            total: items.length,
            mismatch_count: items.filter(
              (item) => item.decision_alignment === "mismatch"
            ).length,
          },
        ];
      })
    ),
    alignment_by_suggested_batch: Object.fromEntries(
      Object.entries(
        allDecisionItems.reduce((bucket, item) => {
          const batch = item.review_item?.suggested_batch || item.suggested_batch || "unknown";
          if (!bucket[batch]) {
            bucket[batch] = { total: 0, mismatch_count: 0 };
          }
          bucket[batch].total += 1;
          if (item.decision_alignment === "mismatch") {
            bucket[batch].mismatch_count += 1;
          }
          return bucket;
        }, {})
      ).sort((a, b) => a[0].localeCompare(b[0]))
    ),
  };
}

function buildFeedbackSummary(decisionLogs) {
  const enrichedItems = decisionLogs.flatMap((session) =>
    session.items.map((item) => ({
      ...item,
      session_id: session.session_id,
      session_focus: session.session_focus,
    }))
  );

  const totalMatches = enrichedItems.filter(
    (item) => item.decision_alignment === "match"
  ).length;
  const totalMismatches = enrichedItems.filter(
    (item) => item.decision_alignment === "mismatch"
  ).length;
  const totalItems = enrichedItems.length;

  const matches = enrichedItems.filter(
    (item) => item.decision_alignment === "match"
  );
  const mismatches = enrichedItems.filter(
    (item) => item.decision_alignment === "mismatch"
  );

  const confidenceFor = (items) =>
    items
      .map((item) => toSafeNumber(item.ai_suggestions_snapshot?.confidence_score, NaN))
      .filter((value) => Number.isFinite(value));

  const mismatchCountsByOperatorAction = sortCounter(
    mismatches.reduce((bucket, item) => {
      incrementCounter(bucket, item.operator_action);
      return bucket;
    }, {})
  );
  const mismatchCountsByAiAction = sortCounter(
    mismatches.reduce((bucket, item) => {
      incrementCounter(bucket, item.ai_record_action_suggestion || "unknown");
      return bucket;
    }, {})
  );
  const mismatchCountsBySuggestedBatch = sortCounter(
    mismatches.reduce((bucket, item) => {
      incrementCounter(
        bucket,
        item.review_item?.suggested_batch || item.suggested_batch || "unknown"
      );
      return bucket;
    }, {})
  );
  const mismatchCountsByReviewPriority = sortCounter(
    mismatches.reduce((bucket, item) => {
      incrementCounter(
        bucket,
        item.review_item?.review_priority || item.review_priority || "unknown"
      );
      return bucket;
    }, {})
  );

  const diagnostics = {
    total_match_count: totalMatches,
    total_mismatch_count: totalMismatches,
    alignment_rate: totalItems ? Number((totalMatches / totalItems).toFixed(3)) : 0,
    mismatches_by_operator_action: mismatchCountsByOperatorAction,
    mismatches_by_ai_record_action_suggestion: mismatchCountsByAiAction,
    mismatches_by_suggested_batch: mismatchCountsBySuggestedBatch,
    mismatches_by_review_priority: mismatchCountsByReviewPriority,
    average_confidence_for_matches: average(confidenceFor(matches)),
    average_confidence_for_mismatches: average(confidenceFor(mismatches)),
    high_confidence_mismatches: mismatches.filter(
      (item) => toSafeNumber(item.ai_suggestions_snapshot?.confidence_score, 0) >= 0.8
    ).length,
    low_confidence_matches: matches.filter(
      (item) => toSafeNumber(item.ai_suggestions_snapshot?.confidence_score, 1) < 0.55
    ).length,
    confidence_buckets: Object.fromEntries(
      ["high", "medium", "low"].map((bucket) => [
        bucket,
        {
          total: enrichedItems.filter(
            (item) =>
              confidenceBucket(
                toSafeNumber(item.ai_suggestions_snapshot?.confidence_score, 0.5)
              ) === bucket
          ).length,
          mismatch_count: enrichedItems.filter(
            (item) =>
              confidenceBucket(
                toSafeNumber(item.ai_suggestions_snapshot?.confidence_score, 0.5)
              ) === bucket && item.decision_alignment === "mismatch"
          ).length,
        },
      ])
    ),
    mismatch_rate_with_material_conflicts: buildConditionalMismatchRate(
      enrichedItems,
      (item) => Boolean(item.review_item?.has_material_conflict)
    ),
    mismatch_rate_for_deep_review_recommended: buildConditionalMismatchRate(
      enrichedItems,
      (item) => Boolean(item.review_item?.deep_review_recommended)
    ),
    mismatch_rate_for_deep_review_ran: buildConditionalMismatchRate(
      enrichedItems,
      (item) => Boolean(item.review_item?.deep_review_ran)
    ),
  };

  const refinementProfiles = enrichedItems.map((item) => item.refined_review_profile);
  const refinementSummary = {
    formulas: {
      review_risk_score: REVIEW_RISK_FORMULA,
      operator_friction_score: OPERATOR_FRICTION_FORMULA,
    },
    average_review_risk_score: average(
      refinementProfiles.map((profile) => profile.review_risk_score)
    ),
    average_operator_friction_score: average(
      refinementProfiles.map((profile) => profile.operator_friction_score)
    ),
    review_risk_level_counts: sortCounter(
      refinementProfiles.reduce((bucket, profile) => {
        incrementCounter(bucket, profile.review_risk_level);
        return bucket;
      }, {})
    ),
    operator_friction_level_counts: sortCounter(
      refinementProfiles.reduce((bucket, profile) => {
        incrementCounter(bucket, profile.operator_friction_level);
        return bucket;
      }, {})
    ),
    suggested_batch_profiles: Object.entries(
      enrichedItems.reduce((bucket, item) => {
        const key = item.review_item?.suggested_batch || item.suggested_batch || "unknown";
        if (!bucket[key]) {
          bucket[key] = {
            suggested_batch: key,
            item_count: 0,
            review_risk_scores: [],
            operator_friction_scores: [],
          };
        }
        bucket[key].item_count += 1;
        bucket[key].review_risk_scores.push(item.refined_review_profile.review_risk_score);
        bucket[key].operator_friction_scores.push(
          item.refined_review_profile.operator_friction_score
        );
        return bucket;
      }, {})
    )
      .map(([, bucket]) => ({
        suggested_batch: bucket.suggested_batch,
        item_count: bucket.item_count,
        average_review_risk_score: average(bucket.review_risk_scores),
        average_operator_friction_score: average(bucket.operator_friction_scores),
      }))
      .sort((a, b) => b.item_count - a.item_count || a.suggested_batch.localeCompare(b.suggested_batch)),
  };

  const keyFindings = [];
  if (diagnostics.high_confidence_mismatches > 0) {
    keyFindings.push(
      `${diagnostics.high_confidence_mismatches} high-confidence AI suggestions still mismatched operator decisions.`
    );
  }
  if (
    diagnostics.mismatch_rate_with_material_conflicts.rate != null &&
    diagnostics.mismatch_rate_with_material_conflicts.rate > 0
  ) {
    keyFindings.push(
      `Items with material conflicts show a ${diagnostics.mismatch_rate_with_material_conflicts.rate} mismatch rate.`
    );
  }
  if (
    refinementSummary.average_operator_friction_score != null &&
    refinementSummary.average_operator_friction_score >= 5
  ) {
    keyFindings.push(
      "Operator friction remains elevated, suggesting the current-admin review slice is still labor-intensive."
    );
  }

  return {
    generated_at: new Date().toISOString(),
    source_log_files: decisionLogs.map((session) => session.file_path),
    source_review_files: [
      ...new Set(
        decisionLogs
          .map((session) => session.source_review_file)
          .filter(Boolean)
      ),
    ],
    total_sessions: decisionLogs.length,
    total_logged_items: totalItems,
    alignment_analytics: diagnostics,
    refinement_summary: refinementSummary,
    key_findings: keyFindings,
  };
}

function buildWorkflowGuidePayload(reviewReports, decisionLogs, precommitReports) {
  const latestReview = reviewReports[0] || null;
  const latestDecision = decisionLogs[0] || null;
  const latestPrecommit = precommitReports[0] || null;
  const batchName = latestReview?.batch_name || null;
  const queuePath = batchName
    ? path.join(CURRENT_ADMIN_REPORTS_DIR, `${batchName}.manual-review-queue.json`)
    : null;
  const decisionTemplatePath = batchName
    ? path.join(CURRENT_ADMIN_REPORTS_DIR, `${batchName}.decision-template.json`)
    : null;
  const precommitPath = batchName
    ? path.join(CURRENT_ADMIN_REPORTS_DIR, `${batchName}.pre-commit-review.json`)
    : null;
  const latestPrecommitMatchesBatch =
    latestPrecommit && latestPrecommit.batch_name === batchName;

  let nextStep = "start_or_resume_review";
  let nextCommands = [
    "./bin/equitystack current-admin status",
  ];
  const nextStepLabels = {
    start_or_resume_review: "Start or resume the canonical current-admin workflow",
    generate_decision_template: "Generate a decision template from the latest review artifact",
    pre_commit_review: "Run the read-only pre-commit import review",
    resolve_pre_commit_blockers: "Resolve the pre-commit blockers before import",
    dry_run_import: "Run a dry-run import from the manual review queue",
  };

  if (latestReview && !latestDecision) {
    nextStep = "generate_decision_template";
    nextCommands = [
      `./bin/equitystack current-admin workflow review --input ${path.relative(PYTHON_DIR, latestReview.file_path)} --output /tmp/${batchName}.decision-template.json`,
      `./bin/equitystack current-admin workflow resume`,
    ];
  } else if (latestReview && latestDecision && !latestPrecommitMatchesBatch) {
    nextStep = "pre_commit_review";
    nextCommands = queuePath
      ? [
          `./bin/equitystack current-admin pre-commit --input ${path.relative(PYTHON_DIR, queuePath)}`,
          `./bin/equitystack current-admin workflow resume`,
        ]
      : ["./bin/equitystack current-admin workflow resume"];
  } else if (
    latestReview &&
    latestDecision &&
    latestPrecommitMatchesBatch &&
    latestPrecommit.readiness_status === "blocked"
  ) {
    nextStep = "resolve_pre_commit_blockers";
    nextCommands = queuePath
      ? [
          `./bin/equitystack current-admin pre-commit --input ${path.relative(PYTHON_DIR, queuePath)}`,
          `./bin/equitystack current-admin workflow resume`,
        ]
      : ["./bin/equitystack current-admin workflow resume"];
  } else if (latestReview && latestDecision) {
    nextStep = "dry_run_import";
    nextCommands = queuePath
      ? [
          `./bin/equitystack current-admin import --input ${path.relative(PYTHON_DIR, queuePath)}`,
          `./bin/equitystack current-admin status --batch-name ${batchName}`,
        ]
      : ["./bin/equitystack current-admin workflow resume"];
  }

  return {
    canonical_process: {
      source_of_truth:
        "Python current-admin pipeline artifacts under python/reports/current_admin/",
      dashboard_role:
        "Admin control surface that wraps the canonical Python workflow; not a second review-generation or import pipeline.",
    },
    latest_review: latestReview
      ? {
          file_path: latestReview.file_path,
          batch_name: latestReview.batch_name,
          generated_at: latestReview.generated_at,
          model: latestReview.model,
          review_mode: latestReview.review_mode,
          reviewed_count: latestReview.reviewed_count,
        }
      : null,
    latest_decision_session: latestDecision
      ? {
          file_path: latestDecision.file_path,
          session_id: latestDecision.session_id,
          generated_at: latestDecision.generated_at,
          session_focus: latestDecision.session_focus,
          item_count: latestDecision.items.length,
          worklist_used: latestDecision.worklist_used,
        }
      : null,
    latest_pre_commit_review: latestPrecommitMatchesBatch
      ? {
          file_path: latestPrecommit.file_path,
          generated_at: latestPrecommit.generated_at,
          readiness_status: latestPrecommit.readiness_status,
          selected_for_import_count: latestPrecommit.selected_for_import_count,
          decision_missing_count: latestPrecommit.decision_missing_count,
          blocking_issue_count: latestPrecommit.blocking_issues.length,
          blocking_issues: latestPrecommit.blocking_issues,
          warning_counts: latestPrecommit.warning_counts,
          recommended_next_step: latestPrecommit.recommended_next_step,
        }
      : null,
    artifact_paths: {
      review_reports_dir: CURRENT_ADMIN_REPORTS_DIR,
      decision_logs_dir: REVIEW_DECISIONS_DIR,
      feedback_dir: FEEDBACK_OUTPUT_DIR,
      current_queue_path: queuePath,
      suggested_decision_template_path: decisionTemplatePath,
      current_pre_commit_path: precommitPath,
    },
    workflow_handoff: {
      next_step: nextStep,
      next_step_label: nextStepLabels[nextStep] || nextStep,
      next_commands: nextCommands,
      operator_notes: [
        "Generate decision templates from canonical review/worklist artifacts before filling operator actions.",
        "Log operator decisions explicitly before import so AI-vs-operator outcomes remain auditable.",
        "Run a read-only pre-commit review before import so blocking issues and warning-heavy batches are explicit.",
        "Import remains a separate manual step and still requires explicit operator review.",
      ],
    },
  };
}

function buildConditionalMismatchRate(items, predicate) {
  const matchingItems = items.filter(predicate);
  const mismatchCount = matchingItems.filter(
    (item) => item.decision_alignment === "mismatch"
  ).length;
  return {
    total: matchingItems.length,
    mismatch_count: mismatchCount,
    rate:
      matchingItems.length > 0
        ? Number((mismatchCount / matchingItems.length).toFixed(3))
        : null,
  };
}

function buildActionPermission(allowed, reasons = []) {
  return {
    allowed,
    reasons: reasons.filter(Boolean),
  };
}

function buildCurrentAdminActionPermissions({
  hasBatch,
  reviewItems,
  queueExists,
  latestDecisionLog,
  latestPrecommit,
  latestDryRun,
  latestApply,
}) {
  const incompleteDecisionCount = reviewItems.filter(
    (item) => !normalizeString(item.operator_action)
  ).length;

  const finalizeReasons = [];
  if (!hasBatch) {
    finalizeReasons.push("No canonical current-admin review artifact is available.");
  }
  if (incompleteDecisionCount > 0) {
    finalizeReasons.push(
      `${incompleteDecisionCount} review item(s) still need an explicit operator action before finalize.`
    );
  }

  const precommitReasons = [];
  if (!queueExists) {
    precommitReasons.push("The canonical manual-review queue artifact is missing.");
  }
  if (!latestDecisionLog) {
    precommitReasons.push("Finalize the decision file so the canonical decision log exists first.");
  }
  if (incompleteDecisionCount > 0) {
    precommitReasons.push("Every reviewed item needs an explicit operator action before pre-commit.");
  }

  const importDryRunReasons = [];
  if (!queueExists) {
    importDryRunReasons.push("The canonical manual-review queue artifact is missing.");
  }
  if (!latestPrecommit) {
    importDryRunReasons.push("Run pre-commit first so import readiness is explicit.");
  } else if (!isImportReadyPrecommit(latestPrecommit)) {
    importDryRunReasons.push(
      latestPrecommit.readiness_explanation ||
        "The latest pre-commit artifact is blocked."
    );
  }

  const applyReasons = [...importDryRunReasons];
  if (!latestDryRun) {
    applyReasons.push("Run a dry-run import for this batch before applying.");
  }

  const validateReasons = [];
  if (!latestApply) {
    validateReasons.push("Run an apply import for this batch before validation.");
  }

  return {
    save_decision_draft: buildActionPermission(hasBatch, hasBatch ? [] : finalizeReasons),
    finalize: buildActionPermission(finalizeReasons.length === 0, finalizeReasons),
    run_precommit: buildActionPermission(precommitReasons.length === 0, precommitReasons),
    run_import_dry_run: buildActionPermission(
      importDryRunReasons.length === 0,
      importDryRunReasons
    ),
    apply_import: buildActionPermission(applyReasons.length === 0, applyReasons),
    validate_import: buildActionPermission(validateReasons.length === 0, validateReasons),
  };
}

function buildCurrentAdminBlockers({
  actionPermissions,
  latestPrecommit,
}) {
  const blockers = [];

  for (const reason of actionPermissions.finalize.reasons) {
    blockers.push(reason);
  }
  for (const reason of actionPermissions.run_precommit.reasons) {
    blockers.push(reason);
  }
  if (latestPrecommit?.blocking_issues?.length) {
    blockers.push(
      ...latestPrecommit.blocking_issues.map(
        (issue) => issue.message || issue.fix || "Pre-commit blocker"
      )
    );
  }

  return [...new Set(blockers)];
}

function buildArtifactEntry({
  label,
  path: filePath,
  exists,
  generatedAt = null,
  stage = null,
  summary = null,
}) {
  return {
    label,
    path: filePath,
    exists,
    generated_at: generatedAt,
    stage,
    summary,
  };
}

export async function getCurrentAdministrationReviewDashboardData() {
  const [reviewReports, decisionLogs, precommitReports, decisionTemplates, importDryRuns, importApplies, validationReports] = await Promise.all([
    loadReviewReports(),
    loadDecisionLogs(),
    loadPrecommitReports(),
    loadDecisionTemplates(),
    loadImportReports(listImportDryRunFiles, "dry-run"),
    loadImportReports(listImportApplyFiles, "apply"),
    loadValidationReports(),
  ]);

  return {
    reviewReports,
    decisionLogs,
    precommitReports,
    decisionTemplates,
    importDryRuns,
    importApplies,
    validationReports,
    reviewOverview: buildReviewOverviewPayload(reviewReports),
    decisionMetrics: buildDecisionMetricsPayload(decisionLogs),
    trendMetrics: buildTrendPayload(reviewReports, decisionLogs),
    feedbackSummary: buildFeedbackSummary(decisionLogs),
  };
}

export async function getCurrentAdministrationReviewOverview() {
  const { reviewOverview } = await getCurrentAdministrationReviewDashboardData();
  return reviewOverview;
}

export async function getCurrentAdministrationDecisionMetrics() {
  const { decisionMetrics, feedbackSummary } =
    await getCurrentAdministrationReviewDashboardData();
  return {
    ...decisionMetrics,
    alignment_analytics: feedbackSummary.alignment_analytics,
    refinement_summary: feedbackSummary.refinement_summary,
  };
}

export async function getCurrentAdministrationReviewTrends() {
  const { trendMetrics, reviewOverview } =
    await getCurrentAdministrationReviewDashboardData();
  return {
    ...trendMetrics,
    refinement_formulas: reviewOverview.refinement_formulas,
  };
}

export async function getCurrentAdministrationWorkflowGuide() {
  const { reviewReports, decisionLogs, precommitReports } =
    await getCurrentAdministrationReviewDashboardData();
  return buildWorkflowGuidePayload(reviewReports, decisionLogs, precommitReports);
}

export async function getCurrentAdministrationOperatorWorkspace() {
  const {
    reviewReports,
    decisionLogs,
    precommitReports,
    decisionTemplates,
    importDryRuns,
    importApplies,
    validationReports,
  } = await getCurrentAdministrationReviewDashboardData();

  const latestReview = reviewReports[0] || null;
  const batchName = latestReview?.batch_name || null;
  const normalizedPath = batchName
    ? path.join(CURRENT_ADMIN_REPORTS_DIR, `${batchName}.normalized.json`)
    : null;
  const normalizationReportPath = batchName
    ? path.join(CURRENT_ADMIN_REPORTS_DIR, `${batchName}.normalization-report.json`)
    : null;
  const queuePath = batchName
    ? path.join(CURRENT_ADMIN_REPORTS_DIR, `${batchName}.manual-review-queue.json`)
    : null;
  const matchingTemplate = decisionTemplates.find(
    (entry) => entry.source_review_file === latestReview?.file_path
  ) || null;
  const matchingDecisionLog = decisionLogs.find(
    (entry) => entry.source_review_file === latestReview?.file_path
  ) || null;
  const matchingPrecommit = precommitReports.find(
    (entry) => entry.batch_name === batchName
  ) || null;
  const latestDryRun = importDryRuns.find((entry) => entry.batch_name === batchName) || null;
  const latestApply = importApplies.find((entry) => entry.batch_name === batchName) || null;
  const latestValidation = validationReports.find((entry) => entry.batch_name === batchName) || null;
  const normalizedStat = normalizedPath ? await statSafe(normalizedPath) : null;
  const normalizationReportStat = normalizationReportPath
    ? await statSafe(normalizationReportPath)
    : null;
  const queueStat = queuePath ? await statSafe(queuePath) : null;

  const reviewItems = buildWorkspaceReviewItems(
    latestReview,
    matchingTemplate,
    matchingDecisionLog
  );
  const counts = buildWorkspaceCounts(reviewItems);
  const stage = buildBatchStage({
    normalizedExists: Boolean(normalizedStat),
    reviewReport: latestReview,
    decisionLog: matchingDecisionLog,
    queueExists: Boolean(queueStat),
    precommitReport: matchingPrecommit,
    importDryRun: latestDryRun,
    importApply: latestApply,
  });
  const workflowGuide = buildWorkflowGuidePayload(
    reviewReports,
    decisionLogs,
    precommitReports
  );
  const actionPermissions = buildCurrentAdminActionPermissions({
    hasBatch: Boolean(latestReview),
    reviewItems,
    queueExists: Boolean(queueStat),
    latestDecisionLog: matchingDecisionLog,
    latestPrecommit: matchingPrecommit,
    latestDryRun,
    latestApply,
  });
  const blockers = buildCurrentAdminBlockers({
    actionPermissions,
    latestPrecommit: matchingPrecommit,
  });
  const artifactStatus = {
    normalized_batch: buildArtifactEntry({
      label: "Normalized batch",
      path: normalizedPath,
      exists: Boolean(normalizedStat),
      generatedAt: normalizedStat?.mtime?.toISOString?.() || null,
      stage: "NORMALIZED",
    }),
    normalization_report: buildArtifactEntry({
      label: "Normalization report",
      path: normalizationReportPath,
      exists: Boolean(normalizationReportStat),
      generatedAt: normalizationReportStat?.mtime?.toISOString?.() || null,
      stage: "NORMALIZED",
    }),
    review_artifact: buildArtifactEntry({
      label: "AI review",
      path: latestReview?.file_path || null,
      exists: Boolean(latestReview),
      generatedAt: latestReview?.generated_at || null,
      stage: "REVIEW_READY",
      summary: latestReview
        ? `${latestReview.reviewed_count} reviewed • ${latestReview.model || "unknown model"}`
        : null,
    }),
    decision_template: buildArtifactEntry({
      label: "Decision template",
      path: matchingTemplate?.file_path || (batchName ? path.join(CURRENT_ADMIN_REPORTS_DIR, `${batchName}.decision-template.json`) : null),
      exists: Boolean(matchingTemplate),
      generatedAt: matchingTemplate?.generated_at || null,
      stage: "REVIEW_READY",
    }),
    decision_log: buildArtifactEntry({
      label: "Decision log",
      path: matchingDecisionLog?.file_path || null,
      exists: Boolean(matchingDecisionLog),
      generatedAt: matchingDecisionLog?.generated_at || null,
      stage: "QUEUE_READY",
      summary: matchingDecisionLog
        ? `${matchingDecisionLog.items.length} logged decisions`
        : null,
    }),
    manual_review_queue: buildArtifactEntry({
      label: "Manual review queue",
      path: queuePath,
      exists: Boolean(queueStat),
      generatedAt: queueStat?.mtime?.toISOString?.() || null,
      stage: "QUEUE_READY",
    }),
    pre_commit_review: buildArtifactEntry({
      label: "Pre-commit review",
      path: matchingPrecommit?.file_path || (batchName ? path.join(CURRENT_ADMIN_REPORTS_DIR, `${batchName}.pre-commit-review.json`) : null),
      exists: Boolean(matchingPrecommit),
      generatedAt: matchingPrecommit?.generated_at || null,
      stage: "PRECOMMIT_READY",
      summary: matchingPrecommit?.readiness_status || null,
    }),
    import_dry_run: buildArtifactEntry({
      label: "Import dry-run",
      path: latestDryRun?.file_path || null,
      exists: Boolean(latestDryRun),
      generatedAt: latestDryRun?.generated_at || null,
      stage: "IMPORT_READY",
    }),
    import_apply: buildArtifactEntry({
      label: "Import apply",
      path: latestApply?.file_path || null,
      exists: Boolean(latestApply),
      generatedAt: latestApply?.generated_at || null,
      stage: "COMPLETE",
    }),
    validation_report: buildArtifactEntry({
      label: "Validation report",
      path: latestValidation?.file_path || null,
      exists: Boolean(latestValidation),
      generatedAt: latestValidation?.generated_at || null,
      stage: "COMPLETE",
    }),
  };

  return {
    batch: latestReview
      ? {
          batch_name: batchName,
          stage,
          reviewed_count: latestReview.reviewed_count,
          model: latestReview.model,
          review_mode: latestReview.review_mode,
          generated_at: latestReview.generated_at,
          last_updated: [
            latestValidation?.generated_at,
            latestApply?.generated_at,
            latestDryRun?.generated_at,
            matchingPrecommit?.generated_at,
            matchingDecisionLog?.generated_at,
            matchingTemplate?.generated_at,
            latestReview.generated_at,
          ]
            .filter(Boolean)
            .sort()
            .at(-1) || latestReview.generated_at,
          paths: {
            review: latestReview.file_path,
            normalized: normalizedPath,
            normalization_report: normalizationReportPath,
            decision_template:
              matchingTemplate?.file_path ||
              path.join(CURRENT_ADMIN_REPORTS_DIR, `${batchName}.decision-template.json`),
            queue: queuePath,
            pre_commit:
              matchingPrecommit?.file_path ||
              path.join(CURRENT_ADMIN_REPORTS_DIR, `${batchName}.pre-commit-review.json`),
          },
        }
      : null,
    counts,
    blockers,
    artifact_status: artifactStatus,
    action_permissions: actionPermissions,
    next_recommended_action: workflowGuide.workflow_handoff,
    latest_review: latestReview,
    latest_decision_template: matchingTemplate,
    latest_decision_session: matchingDecisionLog,
    latest_pre_commit_review: matchingPrecommit,
    latest_import_dry_run: latestDryRun,
    latest_import_apply: latestApply,
    latest_validation: latestValidation,
    review_items: reviewItems,
    decision_history: decisionLogs.slice(0, 10).sort(compareByGeneratedAtDesc),
    feedback_summary: buildFeedbackSummary(decisionLogs),
  };
}

export async function generateCurrentAdministrationFeedbackSummary() {
  const { feedbackSummary } = await getCurrentAdministrationReviewDashboardData();
  return feedbackSummary;
}

export async function writeCurrentAdministrationFeedbackSummary(outputPath = DEFAULT_FEEDBACK_OUTPUT_PATH) {
  const payload = await generateCurrentAdministrationFeedbackSummary();
  await ensureDir(path.dirname(outputPath));
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return {
    outputPath,
    payload,
  };
}

export function getCurrentAdministrationReviewPaths() {
  return {
    projectRoot: PROJECT_ROOT,
    currentAdminReportsDir: CURRENT_ADMIN_REPORTS_DIR,
    reviewDecisionsDir: REVIEW_DECISIONS_DIR,
    feedbackOutputDir: FEEDBACK_OUTPUT_DIR,
    defaultFeedbackOutputPath: DEFAULT_FEEDBACK_OUTPUT_PATH,
  };
}
