import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const REPORTS_DIR = path.join(PROJECT_ROOT, "python", "reports");

const ARTIFACT_PATHS = {
  pipeline_report: path.join(REPORTS_DIR, "equitystack_pipeline_report.json"),
  review_bundle: path.join(REPORTS_DIR, "equitystack_review_bundle.json"),
  ai_review: path.join(REPORTS_DIR, "future_bill_link_ai_review.json"),
  manual_review_queue: path.join(REPORTS_DIR, "future_bill_link_manual_review_queue.json"),
  partial_suggestions: path.join(REPORTS_DIR, "future_bill_link_partial_suggestions.json"),
  candidate_discovery: path.join(REPORTS_DIR, "future_bill_candidate_discovery.json"),
  apply_report: path.join(REPORTS_DIR, "equitystack_apply_report.json"),
  repair_report: path.join(REPORTS_DIR, "equitystack_bundle_repair_report.json"),
  approved_seed_file: path.join(REPORTS_DIR, "approved_tracked_bills_seed.json"),
  import_report: path.join(REPORTS_DIR, "import_approved_tracked_bills_report.json"),
  health_report: path.join(REPORTS_DIR, "legislative_workflow_health_report.json"),
  anomaly_report: path.join(REPORTS_DIR, "legislative_workflow_anomaly_report.json"),
  materialize_report: path.join(
    REPORTS_DIR,
    "legislative-policy-outcomes-materialize.dry-run.json"
  ),
};

const ACTION_PRIORITY_ORDER = {
  High: 0,
  Medium: 1,
  Low: 2,
};

const ACTIVE_REVIEW_STATES = new Set(["actionable", "pending"]);
const RESOLVED_ACTION_STATUSES = new Set([
  "applied",
  "already_applied",
  "dismissed",
  "archived",
  "stale",
  "superseded",
]);
const RESOLVED_REVIEW_STATES = new Set([
  "already_applied",
  "dismissed",
  "archived",
  "stale",
  "superseded",
  "resolved",
]);
const RESOLVED_APPLY_RESULTS = new Set([
  "applied",
  "already_applied",
  "already_partial",
  "already_removed",
  "partial_link_already_exists",
  "skipped_already_absent",
  "stale_target_absent",
  "stale_future_bill_missing",
  "stale_tracked_bill_missing",
]);

const INTERNAL_IP_PATTERN = /\b10\.10\.0\.\d+\b/g;
const STACK_TRACE_LINE_PATTERN = /^\s*at\s.+$/gm;

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toSafeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toEpochMs(value) {
  const text = normalizeString(value);
  if (!text) {
    return 0;
  }
  const parsed = new Date(text).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareByGeneratedAtDesc(a, b) {
  return toEpochMs(b.generated_at) - toEpochMs(a.generated_at);
}

export function sanitizeDisplayText(value, fallback = "") {
  const normalized = normalizeString(value);
  if (!normalized) {
    return fallback;
  }

  const singleLine = normalized
    .replace(STACK_TRACE_LINE_PATTERN, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)[0];

  if (!singleLine) {
    return fallback;
  }

  return singleLine
    .replaceAll(PROJECT_ROOT, "[local path]")
    .replace(/\/home\/[^/\s]+\/Documents\/GitHub\/equitystack[^\s]*/gi, "[local path]")
    .replace(INTERNAL_IP_PATTERN, "[internal host]");
}

function safeFileName(filePath) {
  const normalized = normalizeString(filePath);
  return normalized ? path.basename(normalized) : null;
}

function summarizeIssues(issues = [], fallback = "") {
  if (!Array.isArray(issues) || issues.length === 0) {
    return fallback;
  }
  return sanitizeDisplayText(
    issues
      .map((issue) => issue?.message)
      .find(Boolean),
    fallback
  );
}

function countIssuesBySeverity(issues = [], severity = "") {
  return (Array.isArray(issues) ? issues : []).filter(
    (issue) => toNormalizedLowerString(issue?.severity) === toNormalizedLowerString(severity)
  ).length;
}

function summarizeFlagCounts(flagCounts = {}) {
  if (!flagCounts || typeof flagCounts !== "object") {
    return [];
  }

  return Object.entries(flagCounts)
    .filter(([, count]) => Number(count) > 0)
    .sort((left, right) => Number(right[1]) - Number(left[1]))
    .slice(0, 3)
    .map(([flag, count]) => ({
      label: flag.replace(/_/g, " "),
      count: toSafeNumber(count, 0),
    }));
}

async function readJsonSafe(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function statSafe(filePath) {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
}

function buildArtifactEntry(key, filePath, payload, stat) {
  return {
    key,
    label: key.replace(/_/g, " "),
    path: safeFileName(filePath),
    exists: Boolean(stat),
    generated_at:
      normalizeString(payload?.generated_at) ||
      stat?.mtime?.toISOString?.() ||
      null,
    summary: null,
  };
}

function buildActionPermission(allowed, reasons = []) {
  return {
    allowed,
    reasons: reasons.filter(Boolean),
  };
}

function toNormalizedLowerString(value, fallback = "") {
  const normalized = normalizeString(value);
  return normalized ? normalized.toLowerCase() : fallback;
}

function isPendingReviewState(value) {
  return ACTIVE_REVIEW_STATES.has(toNormalizedLowerString(value, "actionable"));
}

function isResolvedActionStatus(status) {
  return RESOLVED_ACTION_STATUSES.has(toNormalizedLowerString(status));
}

function isResolvedReviewState(reviewState) {
  return RESOLVED_REVIEW_STATES.has(toNormalizedLowerString(reviewState));
}

export function isResolvedApplyResult(applyResult) {
  return RESOLVED_APPLY_RESULTS.has(toNormalizedLowerString(applyResult));
}

export function isActionableLegislativeAction(action) {
  if (!action || typeof action !== "object") {
    return false;
  }

  const reviewState = toNormalizedLowerString(action.review_state, "actionable");
  const status = toNormalizedLowerString(action.status, "pending");

  return (
    isPendingReviewState(reviewState) &&
    !isResolvedActionStatus(status) &&
    !isResolvedReviewState(reviewState) &&
    !isResolvedApplyResult(action.apply_result)
  );
}

export function isActionableLegislativeManualItem(item) {
  if (!item || typeof item !== "object") {
    return false;
  }

  const reviewState = toNormalizedLowerString(item.review_state, "actionable");
  const status = toNormalizedLowerString(item.status, "pending");

  return (
    isPendingReviewState(reviewState) &&
    !isResolvedActionStatus(status) &&
    !isResolvedReviewState(reviewState) &&
    !isResolvedApplyResult(item.apply_result)
  );
}

function flattenOperatorActions(reviewBundle) {
  const groups = Array.isArray(reviewBundle?.future_bill_groups)
    ? reviewBundle.future_bill_groups
    : [];
  const rows = [];

  for (const group of groups) {
    const operatorActions = Array.isArray(group?.operator_actions)
      ? group.operator_actions
      : [];

    for (const action of operatorActions) {
      rows.push({
        action_id: action.action_id,
        future_bill_id: action.future_bill_id ?? group.future_bill_id ?? null,
        future_bill_title: sanitizeDisplayText(
          action.future_bill_title || group.future_bill_title,
          "(untitled future bill)"
        ),
        group_status: group.bundle_status || group.status || null,
        group_recommended_operator_action: group.recommended_operator_action || null,
        action_type: sanitizeDisplayText(action.action_type),
        target_type: sanitizeDisplayText(action.target_type),
        target_id: action.target_id ?? null,
        approved: Boolean(action.approved),
        status: sanitizeDisplayText(action.status, "pending"),
        approved_by: sanitizeDisplayText(action.approved_by),
        approved_at: action.approved_at || null,
        approval_note: sanitizeDisplayText(action.approval_note),
        rationale: sanitizeDisplayText(action.rationale),
        review_state: sanitizeDisplayText(action.review_state, "actionable"),
        action_score:
          action.action_score != null ? Number(action.action_score) : null,
        action_priority: sanitizeDisplayText(action.action_priority, "Unscored"),
        candidate_bill_number: sanitizeDisplayText(action.candidate_bill_number),
        candidate_title: sanitizeDisplayText(action.candidate_title),
        proposed_link_type: sanitizeDisplayText(action.proposed_link_type),
        auto_triaged: Boolean(action.auto_triaged),
        auto_triage_reason: sanitizeDisplayText(action.auto_triage_reason),
      });
    }
  }

  return rows.sort((a, b) => {
    const priorityDiff =
      (ACTION_PRIORITY_ORDER[a.action_priority] ?? 99) -
      (ACTION_PRIORITY_ORDER[b.action_priority] ?? 99);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    const scoreDiff =
      (Number.isFinite(b.action_score) ? b.action_score : -1) -
      (Number.isFinite(a.action_score) ? a.action_score : -1);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    return (
      toSafeNumber(a.future_bill_id, 0) - toSafeNumber(b.future_bill_id, 0) ||
      String(a.action_id || "").localeCompare(String(b.action_id || ""))
    );
  });
}

function flattenBundleManualReviewItems(reviewBundle) {
  const groups = Array.isArray(reviewBundle?.future_bill_groups)
    ? reviewBundle.future_bill_groups
    : [];
  const rows = [];

  for (const group of groups) {
    const manualReviewQueue = Array.isArray(group?.manual_review_queue)
      ? group.manual_review_queue
      : [];

    for (const item of manualReviewQueue) {
      rows.push({
        ...item,
        future_bill_id: item?.future_bill_id ?? group?.future_bill_id ?? null,
        future_bill_title:
          item?.future_bill_title || group?.future_bill_title || "(untitled future bill)",
      });
    }
  }

  return rows;
}

function sanitizeManualReviewItem(item = {}) {
  return {
    future_bill_id: item?.future_bill_id ?? null,
    future_bill_link_id: item?.future_bill_link_id ?? null,
    tracked_bill_id: item?.tracked_bill_id ?? null,
    future_bill_title: sanitizeDisplayText(
      item?.future_bill_title,
      "(untitled future bill)"
    ),
    tracked_bill_title: sanitizeDisplayText(
      item?.tracked_bill_title,
      "No tracked bill title"
    ),
    bill_number: sanitizeDisplayText(item?.bill_number),
    original_risk_level: sanitizeDisplayText(item?.original_risk_level, "unknown"),
    final_decision: sanitizeDisplayText(item?.final_decision, "review_manually"),
    match_label: sanitizeDisplayText(item?.match_label, "unknown"),
    total_score:
      item?.total_score != null ? Number(item.total_score) : null,
    llm_reasoning_short: sanitizeDisplayText(
      item?.llm_reasoning_short,
      "No short rationale recorded."
    ),
    why_not_auto_applied: Array.isArray(item?.why_not_auto_applied)
      ? item.why_not_auto_applied.map((reason) =>
          sanitizeDisplayText(reason, "Additional manual review was required.")
        )
      : [],
    suggested_next_step: sanitizeDisplayText(
      item?.suggested_next_step,
      "Review and classify in this surface"
    ),
    review_state: sanitizeDisplayText(item?.review_state, "actionable"),
    apply_result: sanitizeDisplayText(item?.apply_result),
  };
}

function isAutoApprovedLegislativeAction(action) {
  const approvedBy = toNormalizedLowerString(action?.approved_by);
  return (
    Boolean(action?.auto_triaged) ||
    approvedBy === "auto_triage_review_bundle" ||
    approvedBy === "bundle_automation"
  );
}

function summarizeOperatorActions(operatorActions) {
  const actionableOperatorActions = operatorActions.filter(isActionableLegislativeAction);
  const approvedPendingActions = actionableOperatorActions.filter((action) => action.approved);
  const autoApprovedActionableActions = approvedPendingActions.filter(
    isAutoApprovedLegislativeAction
  );
  const humanApprovedActionableActions = approvedPendingActions.filter(
    (action) => !isAutoApprovedLegislativeAction(action)
  );
  const pendingUnreviewedActions = actionableOperatorActions.filter((action) => !action.approved);
  const staleActions = operatorActions.filter((action) => {
    const reviewState = toNormalizedLowerString(action.review_state);
    const status = toNormalizedLowerString(action.status);
    return (
      reviewState === "stale" ||
      reviewState === "dismissed" ||
      reviewState === "superseded" ||
      status === "stale" ||
      status === "dismissed" ||
      status === "archived"
    );
  });
  const appliedActions = operatorActions.filter((action) => {
    const reviewState = toNormalizedLowerString(action.review_state);
    const status = toNormalizedLowerString(action.status);
    return (
      reviewState === "already_applied" ||
      status === "applied" ||
      status === "already_applied" ||
      isResolvedApplyResult(action.apply_result)
    );
  });

  return {
    actionableOperatorActions,
    autoApprovedActionableActions,
    humanApprovedActionableActions,
    manualDecisionActions: pendingUnreviewedActions,
    approvedPendingActions,
    pendingUnreviewedActions,
    staleActions,
    appliedActions,
  };
}

export function deriveCanonicalLegislativeActionState(reviewBundle, manualQueue = null) {
  const bundleManualReviewItems = flattenBundleManualReviewItems(reviewBundle);
  const fallbackManualQueueItems = Array.isArray(manualQueue?.items) ? manualQueue.items : [];
  const manualReviewItemsSource = bundleManualReviewItems.length
    ? bundleManualReviewItems
    : fallbackManualQueueItems;
  const actionableManualQueueItems = manualReviewItemsSource.filter(
    isActionableLegislativeManualItem
  );
  const operatorActions = flattenOperatorActions(reviewBundle);
  const operatorActionSummary = summarizeOperatorActions(operatorActions);
  const actionableBundleActionCount =
    operatorActionSummary.approvedPendingActions.length +
    operatorActionSummary.pendingUnreviewedActions.length;

  return {
    manualReviewItemsSource,
    actionableManualQueueItems,
    manualQueueCount: actionableManualQueueItems.length,
    operatorActions,
    actionableOperatorActions: operatorActionSummary.actionableOperatorActions,
    autoApprovedActionableActions: operatorActionSummary.autoApprovedActionableActions,
    humanApprovedActionableActions: operatorActionSummary.humanApprovedActionableActions,
    manualDecisionActions: operatorActionSummary.manualDecisionActions,
    approvedPendingActions: operatorActionSummary.approvedPendingActions,
    pendingUnreviewedActions: operatorActionSummary.pendingUnreviewedActions,
    staleActions: operatorActionSummary.staleActions,
    appliedActions: operatorActionSummary.appliedActions,
    actionableBundleActionCount,
  };
}

function buildApplyReportSummary(applyReport, stat) {
  if (!applyReport) {
    return null;
  }

  const appliedActions = Array.isArray(applyReport.applied_actions)
    ? applyReport.applied_actions
    : [];
  const skippedActions = Array.isArray(applyReport.skipped_actions)
    ? applyReport.skipped_actions
    : [];
  const errors = Array.isArray(applyReport.errors) ? applyReport.errors : [];

  return {
    path: safeFileName(ARTIFACT_PATHS.apply_report),
    generated_at:
      normalizeString(applyReport.generated_at) || stat?.mtime?.toISOString?.() || null,
    mode: normalizeString(applyReport.mode) || "unknown",
    affected_future_bill_ids: Array.isArray(applyReport.affected_future_bill_ids)
      ? applyReport.affected_future_bill_ids
      : [],
    affected_future_bill_link_ids: Array.isArray(
      applyReport.affected_future_bill_link_ids
    )
      ? applyReport.affected_future_bill_link_ids
      : [],
    applied_count: appliedActions.length,
    skipped_count: skippedActions.length,
    error_count: errors.length,
    applied_actions: appliedActions.map((action) => ({
      action_id: action?.action_id || null,
      action_type: sanitizeDisplayText(action?.action_type, "applied"),
      result: sanitizeDisplayText(action?.apply_result, "applied"),
    })),
    skipped_actions: skippedActions.map((action) => ({
      action_id: action?.action_id || null,
      action_type: sanitizeDisplayText(action?.action_type, "skipped"),
      result: sanitizeDisplayText(action?.apply_result, "skipped"),
    })),
    error_summaries: errors.map((error) =>
      sanitizeDisplayText(
        error?.error || error?.reason || error?.message,
        "Apply preview reported an error."
      )
    ),
  };
}

function buildImportReportSummary(importReport, stat) {
  if (!importReport) {
    return null;
  }

  const errors = Array.isArray(importReport.errors) ? importReport.errors : [];
  const processedRows = Array.isArray(importReport.processed_rows)
    ? importReport.processed_rows
    : [];

  return {
    path: safeFileName(ARTIFACT_PATHS.import_report),
    generated_at:
      normalizeString(importReport.generated_at) || stat?.mtime?.toISOString?.() || null,
    mode: normalizeString(importReport.mode) || "unknown",
    rows_seen: toSafeNumber(importReport.rows_seen, 0),
    rows_selected: toSafeNumber(importReport.rows_selected, 0),
    inserted_new_tracked_bills: toSafeNumber(
      importReport.inserted_new_tracked_bills,
      0
    ),
    matched_existing_tracked_bills: toSafeNumber(
      importReport.matched_existing_tracked_bills,
      0
    ),
    linked_future_bills: toSafeNumber(importReport.linked_future_bills, 0),
    existing_future_bill_links: toSafeNumber(
      importReport.existing_future_bill_links,
      0
    ),
    skipped_rows: toSafeNumber(importReport.skipped_rows, 0),
    error_count: errors.length,
    error_summaries: errors.map((error) =>
      sanitizeDisplayText(
        error?.reason || error?.error || error?.message,
        "Import preview reported an error."
      )
    ),
    processed_row_count: processedRows.length,
  };
}

function buildRepairReportSummary(repairReport, stat) {
  if (!repairReport) {
    return null;
  }

  const actionsLeftActive = Array.isArray(repairReport.actions_left_active)
    ? repairReport.actions_left_active
    : [];
  const actionsRemovedOrResolved = Array.isArray(repairReport.actions_removed_or_resolved)
    ? repairReport.actions_removed_or_resolved
    : [];

  return {
    path: safeFileName(ARTIFACT_PATHS.repair_report),
    generated_at:
      normalizeString(repairReport.generated_at) || stat?.mtime?.toISOString?.() || null,
    mode: normalizeString(repairReport.mode) || "unknown",
    original_action_count: toSafeNumber(repairReport.original_action_count, 0),
    repaired_action_count: toSafeNumber(repairReport.repaired_action_count, 0),
    stale_action_count: toSafeNumber(repairReport.stale_action_count, 0),
    workflow_state_changed: Boolean(repairReport.workflow_state_changed),
    manual_review_queue_removed_count: toSafeNumber(
      repairReport.manual_review_queue_removed_count,
      0
    ),
    actions_left_active: actionsLeftActive,
    actions_removed_or_resolved: actionsRemovedOrResolved.map((item) => ({
      action_id: item?.action_id || null,
      resolution: sanitizeDisplayText(item?.resolution, "resolved"),
    })),
    warnings: Array.isArray(repairReport.warnings)
      ? repairReport.warnings.map((warning) =>
          sanitizeDisplayText(
            typeof warning === "string" ? warning : warning?.message,
            "Repair warning recorded."
          )
        )
      : [],
  };
}

export function buildLegislativeHealthDisplaySummary(healthReport = null) {
  if (!healthReport || typeof healthReport !== "object") {
    return {
      available: false,
      status: "WARN",
      generated_at: null,
      pipeline_status: "unknown",
      failed_step: null,
      blocked_before_bundle_generation: false,
      apply_state: "unknown",
      manual_review_required: 0,
      approved_actions_pending_apply: 0,
      repair_recommended: false,
      materialization_ready: false,
      latest_materialization_mode: null,
      message:
        "No legislative workflow health report is available yet. Run `./bin/equitystack legislative health` before relying on this surface.",
      recommendation: "./bin/equitystack legislative health",
      warning_count: 0,
      fail_count: 0,
    };
  }

  const artifactIssues = Array.isArray(healthReport?.artifacts?.issues)
    ? healthReport.artifacts.issues
    : [];
  const pipelineIssues = Array.isArray(healthReport?.pipeline?.issues)
    ? healthReport.pipeline.issues
    : [];
  const bundleIssues = Array.isArray(healthReport?.bundle_state?.issues)
    ? healthReport.bundle_state.issues
    : [];
  const repairIssues = Array.isArray(healthReport?.repair_readiness?.issues)
    ? healthReport.repair_readiness.issues
    : [];
  const allIssues = [...artifactIssues, ...pipelineIssues, ...bundleIssues, ...repairIssues];

  return {
    available: true,
    status: sanitizeDisplayText(healthReport.status, "WARN").toUpperCase(),
    generated_at: normalizeString(healthReport.generated_at) || null,
    pipeline_status: sanitizeDisplayText(
      healthReport?.pipeline?.pipeline_status,
      "unknown"
    ),
    failed_step: sanitizeDisplayText(healthReport?.pipeline?.failed_step),
    blocked_before_bundle_generation: Boolean(
      healthReport?.pipeline?.blocked_before_bundle_generation
    ),
    apply_state: sanitizeDisplayText(
      healthReport?.apply_readiness?.apply_state,
      "unknown"
    ),
    manual_review_required: toSafeNumber(
      healthReport?.bundle_state?.manual_review_required,
      0
    ),
    approved_actions_pending_apply:
      toSafeNumber(healthReport?.bundle_state?.human_approved_actions_pending_apply, 0) +
      toSafeNumber(healthReport?.bundle_state?.ai_approved_actions_pending_apply, 0),
    human_approved_actions_pending_apply: toSafeNumber(
      healthReport?.bundle_state?.human_approved_actions_pending_apply,
      0
    ),
    ai_approved_actions_pending_apply: toSafeNumber(
      healthReport?.bundle_state?.ai_approved_actions_pending_apply,
      0
    ),
    repair_recommended: Boolean(healthReport?.repair_readiness?.repair_recommended),
    materialization_ready: Boolean(healthReport?.materialization_readiness?.ready),
    latest_materialization_mode: sanitizeDisplayText(
      healthReport?.materialization_readiness?.latest_apply_mode
    ),
    message:
      summarizeIssues(allIssues) ||
      "The latest health report is available.",
    recommendation:
      sanitizeDisplayText(
        Array.isArray(healthReport?.recommendations)
          ? healthReport.recommendations[0]
          : healthReport?.pipeline?.suggested_next_command,
        "./bin/equitystack legislative health"
      ) || "./bin/equitystack legislative health",
    warning_count: countIssuesBySeverity(allIssues, "warn"),
    fail_count: countIssuesBySeverity(allIssues, "fail"),
  };
}

export function buildLegislativeAnomalyDisplaySummary(anomalyReport = null) {
  if (!anomalyReport || typeof anomalyReport !== "object") {
    return {
      available: false,
      status: "WARN",
      generated_at: null,
      baseline_available: false,
      total_flags: 0,
      critical_count: 0,
      warning_count: 0,
      top_flags: [],
      message:
        "No legislative anomaly report is available yet. Run `./bin/equitystack legislative anomalies` when you need a scoring-drift and anomaly pass.",
      recommendation: "./bin/equitystack legislative anomalies",
    };
  }

  const classificationIssues = Array.isArray(anomalyReport?.classification_anomalies?.issues)
    ? anomalyReport.classification_anomalies.issues
    : [];
  const scoringIssues = Array.isArray(anomalyReport?.scoring_drift?.issues)
    ? anomalyReport.scoring_drift.issues
    : [];
  const reasonCodeIssues = Array.isArray(anomalyReport?.reason_code_anomalies?.issues)
    ? anomalyReport.reason_code_anomalies.issues
    : [];
  const artifactConsistencyIssues = Array.isArray(anomalyReport?.artifact_consistency?.issues)
    ? anomalyReport.artifact_consistency.issues
    : [];
  const suspiciousIssues = Array.isArray(anomalyReport?.suspicious_flags?.issues)
    ? anomalyReport.suspicious_flags.issues
    : [];
  const allIssues = [
    ...classificationIssues,
    ...scoringIssues,
    ...reasonCodeIssues,
    ...artifactConsistencyIssues,
    ...suspiciousIssues,
  ];
  const topFlags = summarizeFlagCounts({
    ...(anomalyReport?.classification_anomalies?.flag_counts || {}),
    ...(anomalyReport?.suspicious_flags?.flag_counts || {}),
  });

  return {
    available: true,
    status: sanitizeDisplayText(anomalyReport.status, "WARN").toUpperCase(),
    generated_at: normalizeString(anomalyReport.generated_at) || null,
    baseline_available: Boolean(anomalyReport.baseline_available),
    total_flags:
      toSafeNumber(anomalyReport?.classification_anomalies?.flagged_rows, 0) +
      toSafeNumber(anomalyReport?.suspicious_flags?.total_flags, 0),
    critical_count: countIssuesBySeverity(allIssues, "critical"),
    warning_count: countIssuesBySeverity(allIssues, "warn"),
    top_flags: topFlags,
    message:
      summarizeIssues(allIssues) ||
      "The latest anomaly report is available.",
    recommendation:
      sanitizeDisplayText(
        Array.isArray(anomalyReport?.recommendations)
          ? anomalyReport.recommendations[0]
          : "",
        "./bin/equitystack legislative anomalies"
      ) || "./bin/equitystack legislative anomalies",
  };
}

export function buildLegislativeMaterializationSummary(
  healthReport = null,
  materializeReport = null,
  materializeStat = null
) {
  const issues = Array.isArray(healthReport?.materialization_readiness?.issues)
    ? healthReport.materialization_readiness.issues
    : [];

  return {
    available: Boolean(healthReport?.materialization_readiness),
    status: sanitizeDisplayText(
      healthReport?.materialization_readiness?.status,
      materializeReport ? "warn" : "warn"
    ).toUpperCase(),
    ready: Boolean(healthReport?.materialization_readiness?.ready),
    latest_apply_mode: sanitizeDisplayText(
      healthReport?.materialization_readiness?.latest_apply_mode
    ),
    generated_at:
      normalizeString(materializeReport?.generated_at) ||
      materializeStat?.mtime?.toISOString?.() ||
      null,
    message:
      summarizeIssues(issues) ||
      (materializeReport
        ? "A legislative materialization report is available."
        : "No legislative materialization report is available yet."),
    recommendation: "./bin/equitystack legislative materialize-outcomes",
  };
}

function hasOutstandingImportWork(seedRows, importReport = null) {
  return (
    (Array.isArray(seedRows) && seedRows.length > 0) ||
    normalizeString(importReport?.mode) === "dry_run" ||
    normalizeString(importReport?.mode) === "apply"
  );
}

function summarizeAiFailureReason(reasons = []) {
  const normalized = [...new Set(reasons.map((reason) => normalizeString(reason)).filter(Boolean))];
  if (!normalized.length) {
    return null;
  }

  const lowered = normalized.map((reason) => reason.toLowerCase());
  if (
    lowered.every(
      (reason) =>
        reason.includes("non-empty json string") ||
        reason.includes("no json object found") ||
        reason.includes("empty json") ||
        reason.includes("empty response")
    )
  ) {
    return "openai_empty_response";
  }
  if (lowered.every((reason) => reason.includes("timed out") || reason.includes("timeout"))) {
    return "openai_timeout";
  }
  if (lowered.every((reason) => reason.includes("connection") || reason.includes("refused"))) {
    return "openai_connection_error";
  }

  return normalized.length === 1 ? normalized[0] : "multiple_failures";
}

function hasNoActionableLegislativeFollowup({
  manualReviewCount,
  pendingUnreviewedActions,
  approvedPendingActions,
  seedRows,
  importReport,
}) {
  return (
    toSafeNumber(manualReviewCount, 0) === 0 &&
    pendingUnreviewedActions.length === 0 &&
    approvedPendingActions.length === 0 &&
    !hasOutstandingImportWork(seedRows, importReport)
  );
}

function buildFallbackWorkflowOutcomeSummary({
  aiReview,
  manualReviewCount,
  pendingUnreviewedActions,
  approvedPendingActions,
  repairReport,
  seedRows,
  importReport,
}) {
  const reviewedItems = Array.isArray(aiReview?.items) ? aiReview.items : [];
  const aiSuccessPrimary = reviewedItems.filter((item) => item?.review_backend === "openai").length;
  const aiSuccessFallback = reviewedItems.filter((item) => item?.review_backend === "fallback").length;
  const heuristicFallback = reviewedItems.filter(
    (item) => item?.review_backend === "heuristic_fallback"
  ).length;
  const dryRunCount = reviewedItems.filter((item) => item?.review_backend === "dry_run").length;
  const fallbackUsed = reviewedItems.filter((item) => item?.fallback_used).length;
  const totalItems =
    reviewedItems.length || toSafeNumber(aiReview?.summary?.total_reviewed, 0);
  const aiManualReviewCount = toSafeNumber(aiReview?.summary?.review_manually_count, 0);
  const decisions = {
    kept: toSafeNumber(aiReview?.summary?.keep_direct_count, 0),
    modified: toSafeNumber(aiReview?.summary?.change_to_partial_count, 0),
    removed: toSafeNumber(aiReview?.summary?.remove_link_count, 0),
    manual_review: manualReviewCount,
    manual_review_flagged_by_ai: aiManualReviewCount,
  };
  const aiFailureReason = summarizeAiFailureReason(
    reviewedItems
      .filter((item) => item?.fallback_used)
      .map((item) => item?.fallback_reason)
  );
  const aiSuccess = aiSuccessPrimary + aiSuccessFallback;

  let workflowStatus = "unknown";
  let runStatus = "unknown";
  let confidenceLevel = "low";
  let trustWarning = true;
  let userMessage = "Legislative workflow results are available, but the AI summary is incomplete.";
  const hasImportWork = hasOutstandingImportWork(seedRows, importReport);
  const repairCleared =
    normalizeString(repairReport?.mode) === "apply" &&
    Array.isArray(repairReport?.actions_left_active) &&
    repairReport.actions_left_active.length === 0;
  const noActionableFollowup = hasNoActionableLegislativeFollowup({
    manualReviewCount,
    pendingUnreviewedActions,
    approvedPendingActions,
    seedRows,
    importReport,
  });

  if (totalItems === 0) {
    workflowStatus = "not_started";
    runStatus = "not_started";
    userMessage = "No legislative AI review results are recorded yet.";
  } else if (dryRunCount === totalItems) {
    workflowStatus = "completed_with_fallback";
    runStatus = "skipped";
    userMessage = "AI review was skipped. All items require manual review.";
  } else if (heuristicFallback === totalItems || aiSuccess === 0) {
    workflowStatus = "completed_with_fallback";
    runStatus = "failed";
    userMessage = "AI review failed. All items require manual review.";
  } else if (fallbackUsed > 0) {
    workflowStatus = "completed_with_partial_fallback";
    runStatus = "partial";
    confidenceLevel = heuristicFallback > 0 ? "low" : "medium";
    userMessage =
      manualReviewCount > 0 || pendingUnreviewedActions.length > 0
        ? "AI partially succeeded. Some workflow outputs require manual verification."
        : repairCleared
          ? "AI partially succeeded, but the canonical legislative bundle has been reconciled and no review items remain."
          : "AI partially succeeded, but no actionable legislative review items remain.";
  } else if (manualReviewCount > 0) {
    workflowStatus = "completed_with_manual_review";
    runStatus = "success";
    confidenceLevel = "medium";
    userMessage = "AI review completed, but some actionable items still require manual review.";
  } else {
    workflowStatus = "completed_with_ai";
    runStatus = "success";
    confidenceLevel = "high";
    trustWarning = false;
    userMessage = "AI review completed successfully. Results are fully evaluated.";
  }

  if (noActionableFollowup) {
    const hadFallback =
      fallbackUsed > 0 ||
      heuristicFallback > 0 ||
      workflowStatus === "completed_with_partial_fallback" ||
      workflowStatus === "completed_with_fallback";
    workflowStatus = hadFallback ? "completed_with_partial_fallback" : "completed_with_ai";
    runStatus = hadFallback ? "partial" : "success";
    confidenceLevel = hadFallback ? "medium" : "high";
    trustWarning = hadFallback;
    userMessage = hadFallback
      ? repairCleared
        ? "AI partially succeeded, but the canonical legislative bundle has been reconciled and no actionable review, apply, or import work remains."
        : "AI partially succeeded, but no actionable legislative review, apply, or import work remains."
      : "No actionable legislative review, apply, or import work remains.";
  }

  const nextStepMessage =
    manualReviewCount > 0 || pendingUnreviewedActions.length > 0
      ? "Next step: review required items in the legislative workflow."
      : approvedPendingActions.length > 0
        ? "Next step: run the legislative apply dry-run preview."
        : normalizeString(importReport?.mode) === "apply"
          ? "Next step: review the refreshed legislative bundle after import."
          : repairCleared && !hasImportWork
            ? "Next step: no urgent legislative action is required."
          : "Next step: inspect the legislative workflow artifacts.";

  const severity =
    workflowStatus === "completed_with_fallback"
      ? "critical"
      : trustWarning
        ? "warning"
        : "success";

  return {
    workflow_status: workflowStatus,
    ai_status: {
      run_status: runStatus,
      total_items: totalItems,
      ai_success: aiSuccess,
      primary_model_success: aiSuccessPrimary,
      fallback_model_success: aiSuccessFallback,
      fallback_used: fallbackUsed,
      heuristic_fallback: heuristicFallback,
      dry_run_count: dryRunCount,
      ai_failure_reason: aiFailureReason,
    },
    decisions,
    confidence_level: confidenceLevel,
    trust_warning: trustWarning,
    severity,
    user_message: userMessage,
    next_step: nextStepMessage,
    next_step_message: nextStepMessage,
    manual_review_queue_count: manualReviewCount,
    pending_bundle_approvals: pendingUnreviewedActions.length,
    approved_bundle_actions: approvedPendingActions.length,
  };
}

export function buildLegislativeWorkflowOutcomeSummary({
  aiReview,
  manualReviewCount,
  pendingUnreviewedActions,
  approvedPendingActions,
  repairReport,
  seedRows,
  importReport,
}) {
  const existing = aiReview?.workflow_outcome_summary;
  const manualQueueCount = manualReviewCount;
  const noActionableFollowup = hasNoActionableLegislativeFollowup({
    manualReviewCount: manualQueueCount,
    pendingUnreviewedActions,
    approvedPendingActions,
    seedRows,
    importReport,
  });

  const fallbackSummary = buildFallbackWorkflowOutcomeSummary({
    aiReview,
    manualReviewCount: manualQueueCount,
    pendingUnreviewedActions,
    approvedPendingActions,
    repairReport,
    seedRows,
    importReport,
  });

  if (!existing || typeof existing !== "object") {
    return fallbackSummary;
  }

  const aiStatus = existing.ai_status || {};
  const decisions = existing.decisions || {};
  const workflowStatus = noActionableFollowup
    ? fallbackSummary.workflow_status
    : normalizeString(existing.workflow_status) || fallbackSummary.workflow_status;
  const trustWarning = noActionableFollowup
    ? fallbackSummary.trust_warning
    : typeof existing.trust_warning === "boolean"
      ? existing.trust_warning
      : fallbackSummary.trust_warning;
  const severity =
    workflowStatus === "completed_with_fallback"
      ? "critical"
      : trustWarning
        ? "warning"
        : "success";

  return {
    ...fallbackSummary,
    ...existing,
    workflow_status: workflowStatus,
    ai_status: {
      ...fallbackSummary.ai_status,
      ...aiStatus,
      total_items: Math.max(
        toSafeNumber(aiStatus.total_items, 0),
        fallbackSummary.ai_status.total_items
      ),
      fallback_used: Math.max(
        toSafeNumber(aiStatus.fallback_used, 0),
        fallbackSummary.ai_status.fallback_used
      ),
      heuristic_fallback: Math.max(
        toSafeNumber(aiStatus.heuristic_fallback, 0),
        fallbackSummary.ai_status.heuristic_fallback
      ),
      ai_failure_reason: sanitizeDisplayText(
        aiStatus.ai_failure_reason || fallbackSummary.ai_status.ai_failure_reason,
        fallbackSummary.ai_status.ai_failure_reason
      ),
    },
    decisions: {
      ...fallbackSummary.decisions,
      ...decisions,
      manual_review: manualQueueCount,
      manual_review_flagged_by_ai: Math.max(
        toSafeNumber(decisions.manual_review_flagged_by_ai, 0),
        toSafeNumber(decisions.manual_review, 0),
        fallbackSummary.decisions.manual_review_flagged_by_ai
      ),
    },
    trust_warning: trustWarning,
    severity,
    user_message: sanitizeDisplayText(
      noActionableFollowup
        ? fallbackSummary.user_message
        : normalizeString(existing.user_message) || fallbackSummary.user_message,
      fallbackSummary.user_message
    ),
    next_step: sanitizeDisplayText(
      noActionableFollowup
        ? fallbackSummary.next_step
        : normalizeString(existing.next_step) || fallbackSummary.next_step,
      fallbackSummary.next_step
    ),
    manual_review_queue_count: manualQueueCount,
    pending_bundle_approvals: pendingUnreviewedActions.length,
    approved_bundle_actions: approvedPendingActions.length,
    next_step_message: sanitizeDisplayText(
      noActionableFollowup
        ? fallbackSummary.next_step_message
        : normalizeString(existing.next_step_message) ||
            fallbackSummary.next_step_message,
      fallbackSummary.next_step_message
    ),
  };
}

function currentDryRunForReference(report, referenceGeneratedAt) {
  if (!report || normalizeString(report.mode) !== "dry_run") {
    return false;
  }
  if (!referenceGeneratedAt) {
    return true;
  }
  return toEpochMs(report.generated_at) >= toEpochMs(referenceGeneratedAt);
}

export function buildLegislativeActionPermissions({
  hasBundle,
  bundleGeneratedAt,
  actionableActions,
  approvedPendingActions,
  pendingUnreviewedActions,
  manualReviewCount = 0,
  applyReport,
  seedRows,
  importReport,
  healthSummary = null,
  invalidRows = 0,
  repairRecommended = false,
}) {
  const saveReasons = [];
  if (!hasBundle) {
    saveReasons.push("The review bundle artifact is missing.");
  }
  if (hasBundle && pendingUnreviewedActions.length === 0) {
    saveReasons.push("No bundle-approval items need a human decision right now.");
  }

  const hasPendingHumanDecisions = pendingUnreviewedActions.length > 0;
  const hasApprovedActions = approvedPendingActions.length > 0;
  const hasActionableBundleActions =
    actionableActions.length > 0 || hasPendingHumanDecisions || hasApprovedActions;
  const healthFailed = toNormalizedLowerString(healthSummary?.status) === "fail";

  const applyDryRunReasons = [];
  if (!hasBundle) {
    applyDryRunReasons.push("The review bundle artifact is missing.");
  }
  if (invalidRows > 0) {
    applyDryRunReasons.push(
      "The canonical review bundle has invalid actionable rows and should not advance into apply preview."
    );
  }
  if (healthFailed) {
    applyDryRunReasons.push(
      sanitizeDisplayText(
        healthSummary?.message,
        "The latest legislative health report is failing, so apply preview should stay blocked."
      )
    );
  }
  if (repairRecommended) {
    applyDryRunReasons.push(
      "Repair is recommended before apply because the current workflow state appears stale."
    );
  }
  if (hasPendingHumanDecisions) {
    applyDryRunReasons.push(
      `${pendingUnreviewedActions.length} legislative operator action(s) still need an explicit approve or dismiss decision.`
    );
  }
  if (manualReviewCount > 0) {
    applyDryRunReasons.push(
      `${manualReviewCount} actionable manual-review item(s) still need human review before apply can continue.`
    );
  }
  if (hasActionableBundleActions && !hasApprovedActions) {
    applyDryRunReasons.push(
      "Approve at least one pending legislative operator action before running the apply preview."
    );
  }

  const applyReasons = [...applyDryRunReasons];
  const hasCurrentApplyPreview = currentDryRunForReference(
    applyReport,
    bundleGeneratedAt
  );
  if (hasApprovedActions && !hasCurrentApplyPreview) {
    applyReasons.push("Run a fresh legislative apply dry-run after the latest approval changes.");
  }
  if ((applyReport?.error_count || 0) > 0) {
    applyReasons.push("Resolve the legislative apply dry-run errors before applying.");
  }

  const importDryRunReasons = [];
  if (healthFailed) {
    importDryRunReasons.push(
      "The latest legislative health report is failing, so import preview should stay blocked."
    );
  }
  if (manualReviewCount > 0) {
    importDryRunReasons.push(
      `${manualReviewCount} actionable manual-review item(s) still need human review before import can continue.`
    );
  }
  if (repairRecommended) {
    importDryRunReasons.push(
      "Repair is recommended before import because the current workflow state appears stale."
    );
  }
  if (!seedRows.length) {
    importDryRunReasons.push(
      "No approved tracked-bill seed rows are available for import yet."
    );
  }

  const applyImportReasons = [...importDryRunReasons];
  const hasCurrentImportPreview = Boolean(importReport) &&
    normalizeString(importReport.mode) === "dry_run";
  if (!hasCurrentImportPreview) {
    applyImportReasons.push("Run a legislative import dry-run before applying the import.");
  }
  if ((importReport?.error_count || 0) > 0) {
    applyImportReasons.push("Resolve the legislative import dry-run errors before applying.");
  }

  return {
    save_approvals: buildActionPermission(saveReasons.length === 0, saveReasons),
    run_apply_dry_run: buildActionPermission(
      hasBundle && hasApprovedActions && applyDryRunReasons.length === 0,
      applyDryRunReasons
    ),
    apply_bundle: buildActionPermission(
      hasBundle && hasApprovedActions && applyReasons.length === 0,
      applyReasons
    ),
    run_import_dry_run: buildActionPermission(
      importDryRunReasons.length === 0,
      importDryRunReasons
    ),
    apply_import: buildActionPermission(
      applyImportReasons.length === 0,
      applyImportReasons
    ),
    actionable_count: actionableActions.length,
    approved_pending_count: approvedPendingActions.length,
  };
}

export function buildLegislativeWorkflowStatus({
  pipelineReport,
  reviewBundle,
  manualReviewCount,
  pendingUnreviewedActions,
  approvedPendingActions,
  repairReport,
  seedRows,
  importReport,
}) {
  if (!pipelineReport && !reviewBundle) {
    return "DISCOVERY_READY";
  }
  if (normalizeString(pipelineReport?.status) === "failed") {
    return "BLOCKED";
  }
  if (manualReviewCount > 0 || pendingUnreviewedActions.length > 0) {
    return "REVIEW_READY";
  }
  if (approvedPendingActions.length > 0) {
    return "APPLY_READY";
  }
  if (seedRows.length > 0 && normalizeString(importReport?.mode) !== "apply") {
    return "IMPORT_READY";
  }
  if (
    normalizeString(repairReport?.mode) === "apply" &&
    Array.isArray(repairReport?.actions_left_active) &&
    repairReport.actions_left_active.length === 0 &&
    manualReviewCount === 0 &&
    pendingUnreviewedActions.length === 0 &&
    approvedPendingActions.length === 0 &&
    seedRows.length === 0
  ) {
    return "COMPLETE";
  }
  return "COMPLETE";
}

export function buildLegislativeNextStep({
  workflowStatus,
  manualReviewCount,
  pendingUnreviewedActions,
  actionPermissions,
  pipelineReport,
  repairReport,
  seedRows,
  importReport,
  healthSummary = null,
  anomalySummary = null,
  materializationSummary = null,
}) {
  const hasImportWork = hasOutstandingImportWork(seedRows, importReport);
  const repairCleared =
    normalizeString(repairReport?.mode) === "apply" &&
    Array.isArray(repairReport?.actions_left_active) &&
    repairReport.actions_left_active.length === 0;
  const healthMissing = !healthSummary?.available;
  const healthFailed = toNormalizedLowerString(healthSummary?.status) === "fail";
  const anomalyFailed = toNormalizedLowerString(anomalySummary?.status) === "fail";
  const anomalyWarn = toNormalizedLowerString(anomalySummary?.status) === "warn";

  if (healthMissing) {
    return {
      step: "run_health_check",
      label: "Run the legislative health check",
      commands: ["./bin/equitystack legislative health"],
    };
  }

  if (healthSummary?.repair_recommended) {
    return {
      step: "run_repair",
      label: "Run the legislative repair dry-run",
      commands: ["./bin/equitystack legislative repair --dry-run"],
    };
  }

  if (healthFailed && normalizeString(healthSummary?.recommendation)) {
    return {
      step: "resolve_health_failure",
      label: "Resolve the failing legislative workflow health state",
      commands: [healthSummary.recommendation],
    };
  }

  if (!pipelineReport) {
    return {
      step: "run_pipeline",
      label: "Run the canonical legislative pipeline",
      commands: ["./bin/equitystack legislative run"],
    };
  }

  if (normalizeString(pipelineReport.status) === "failed") {
    return {
      step: "resolve_pipeline_failure",
      label: "Resolve the failed legislative pipeline stage before continuing",
      commands: ["./bin/equitystack legislative run"],
    };
  }

  if (
    (anomalyFailed || anomalyWarn) &&
    normalizeString(anomalySummary?.recommendation) &&
    !actionPermissions.run_apply_dry_run.allowed &&
    !actionPermissions.apply_bundle.allowed &&
    !actionPermissions.run_import_dry_run.allowed &&
    !actionPermissions.apply_import.allowed &&
    manualReviewCount === 0 &&
    pendingUnreviewedActions.length === 0
  ) {
    return {
      step: "review_anomalies",
      label: anomalyFailed
        ? "Review the failing anomaly report before advancing"
        : "Review the anomaly warnings before advancing",
      commands: [anomalySummary.recommendation],
    };
  }

  if (actionPermissions.run_apply_dry_run.allowed) {
    return {
      step: "apply_dry_run",
      label: "Run the legislative apply dry-run preview",
      commands: ["./bin/equitystack legislative apply --dry-run"],
    };
  }

  if (actionPermissions.apply_bundle.allowed) {
    return {
      step: "apply_bundle",
      label: "Apply the approved legislative bundle actions",
      commands: ["./bin/equitystack legislative apply --apply --yes"],
    };
  }

  if (actionPermissions.run_import_dry_run.allowed) {
    return {
      step: "import_dry_run",
      label: "Run the approved tracked-bill import dry-run",
      commands: ["./bin/equitystack legislative import --dry-run"],
    };
  }

  if (actionPermissions.apply_import.allowed) {
    return {
      step: "apply_import",
      label: "Apply the approved tracked-bill import",
      commands: ["./bin/equitystack legislative import --apply --yes"],
    };
  }

  if (normalizeString(importReport?.mode) === "apply") {
    return {
      step: "review_refreshed_bundle",
      label: "Review the refreshed legislative bundle after import",
      commands: ["./bin/equitystack legislative review"],
    };
  }

  if (workflowStatus === "COMPLETE" || (repairCleared && !hasImportWork)) {
    if (materializationSummary?.ready) {
      return {
        step: "materialize_outcomes",
        label: "Run legislative outcome materialization",
        commands: ["./bin/equitystack legislative materialize-outcomes"],
      };
    }
    return {
      step: "complete",
      label: "No urgent legislative action is required",
      commands: ["./bin/equitystack legislative review"],
    };
  }

  return {
    step: "review_bundle",
    label:
      workflowStatus === "REVIEW_READY"
        ? manualReviewCount > 0 && pendingUnreviewedActions.length === 0
          ? "Review required manual-review items"
          : "Review and classify the legislative operator actions"
        : "Resume the legislative workflow",
    commands: ["./bin/equitystack legislative review"],
  };
}

export function buildLegislativeBlockers({
  pipelineReport,
  manualReviewCount,
  actionPermissions,
  seedRows,
  applyReport,
  importReport,
  healthSummary = null,
}) {
  const blockers = [];
  const pipelineFailure = pipelineReport?.failure || null;

  if (!healthSummary?.available) {
    blockers.push(
      "The legislative health report is missing, so current workflow readiness has not been verified yet."
    );
  } else if (toNormalizedLowerString(healthSummary?.status) === "fail") {
    blockers.push(
      sanitizeDisplayText(
        healthSummary?.message,
        "The legislative health report is failing."
      )
    );
  }

  if (healthSummary?.repair_recommended) {
    blockers.push("Repair is recommended before the workflow advances into apply or import.");
  }

  if (pipelineFailure) {
    blockers.push(
      `Pipeline failed while running ${sanitizeDisplayText(
        pipelineFailure.command?.join(" "),
        "an unknown command"
      )}.`
    );
  }

  if (manualReviewCount > 0) {
    blockers.push(
      `${manualReviewCount} actionable legislative item(s) remain in the manual-review queue.`
    );
  }

  for (const reason of actionPermissions.run_apply_dry_run.reasons) {
    blockers.push(reason);
  }

  for (const error of applyReport?.error_summaries || []) {
    blockers.push(error || "Legislative apply dry-run reported an error.");
  }

  if (
    (Array.isArray(seedRows) && seedRows.length > 0) ||
    normalizeString(importReport?.mode) === "apply"
  ) {
    for (const error of importReport?.error_summaries || []) {
      blockers.push(error || "Legislative import dry-run reported an error.");
    }
  }

  return [...new Set(blockers)];
}

export async function getLegislativeWorkflowWorkspace() {
  const entries = await Promise.all(
    Object.entries(ARTIFACT_PATHS).map(async ([key, filePath]) => {
      const [payload, stat] = await Promise.all([readJsonSafe(filePath), statSafe(filePath)]);
      return [key, { payload, stat }];
    })
  );

  const loaded = Object.fromEntries(entries);
  const pipelineReport = loaded.pipeline_report.payload;
  const reviewBundle = loaded.review_bundle.payload;
  const aiReview = loaded.ai_review.payload;
  const manualQueue = loaded.manual_review_queue.payload;
  const partialSuggestions = loaded.partial_suggestions.payload;
  const candidateDiscovery = loaded.candidate_discovery.payload;
  const seedRows = Array.isArray(loaded.approved_seed_file.payload)
    ? loaded.approved_seed_file.payload
    : [];

  const bundleGeneratedAt =
    normalizeString(reviewBundle?.generated_at) ||
    loaded.review_bundle.stat?.mtime?.toISOString?.() ||
    null;
  const bundleSummary = reviewBundle?.summary || {};
  const manualQueueGeneratedAt =
    normalizeString(manualQueue?.generated_at) ||
    loaded.manual_review_queue.stat?.mtime?.toISOString?.() ||
    null;
  const {
    manualReviewItemsSource,
    actionableManualQueueItems,
    manualQueueCount,
    operatorActions,
    actionableOperatorActions,
    autoApprovedActionableActions,
    humanApprovedActionableActions,
    manualDecisionActions,
    approvedPendingActions,
    pendingUnreviewedActions,
    staleActions,
    appliedActions,
    actionableBundleActionCount,
  } = deriveCanonicalLegislativeActionState(reviewBundle, manualQueue);

  const applyReport = buildApplyReportSummary(
    loaded.apply_report.payload,
    loaded.apply_report.stat
  );
  const repairReport = buildRepairReportSummary(
    loaded.repair_report.payload,
    loaded.repair_report.stat
  );
  const importReport = buildImportReportSummary(
    loaded.import_report.payload,
    loaded.import_report.stat
  );
  const healthSummary = buildLegislativeHealthDisplaySummary(
    loaded.health_report.payload
  );
  const anomalySummary = buildLegislativeAnomalyDisplaySummary(
    loaded.anomaly_report.payload
  );
  const materializationSummary = buildLegislativeMaterializationSummary(
    loaded.health_report.payload,
    loaded.materialize_report.payload,
    loaded.materialize_report.stat
  );
  const aiReviewSummary = aiReview?.summary || {};
  const reviewRuntime = aiReview
    ? {
        requested_model: aiReview.requested_model || aiReviewSummary.requested_model || null,
        resolved_model: aiReview.resolved_model || aiReviewSummary.resolved_model || null,
        review_backend: aiReview.review_backend || aiReviewSummary.review_backend || null,
        fallback_used: Boolean(aiReview.fallback_used ?? aiReviewSummary.fallback_used),
        fallback_reason: aiReview.fallback_reason || aiReviewSummary.fallback_reason || null,
        fallback_model: aiReview.fallback_model || aiReviewSummary.fallback_model || null,
        model_resolution_status:
          aiReview.model_resolution_status || aiReviewSummary.model_resolution_status || null,
        fallback_count: toSafeNumber(
          aiReview.fallback_count ?? aiReviewSummary.fallback_count,
          0
        ),
      }
    : null;
  const workflowOutcomeSummary = buildLegislativeWorkflowOutcomeSummary({
    aiReview,
    manualReviewCount: manualQueueCount,
    pendingUnreviewedActions,
    approvedPendingActions,
    repairReport,
    seedRows,
    importReport,
  });

  const actionPermissions = buildLegislativeActionPermissions({
    hasBundle: Boolean(reviewBundle),
    bundleGeneratedAt,
    actionableActions: actionableOperatorActions,
    approvedPendingActions,
    pendingUnreviewedActions,
    manualReviewCount: manualQueueCount,
    applyReport,
    seedRows,
    importReport,
    healthSummary,
    invalidRows: toSafeNumber(loaded.health_report.payload?.bundle_state?.invalid_rows, 0),
    repairRecommended: Boolean(healthSummary.repair_recommended),
  });
  const workflowStatus = buildLegislativeWorkflowStatus({
    pipelineReport,
    reviewBundle,
    manualReviewCount: manualQueueCount,
    pendingUnreviewedActions,
    approvedPendingActions,
    repairReport,
    seedRows,
    importReport,
  });
  const nextStep = buildLegislativeNextStep({
    workflowStatus,
    manualReviewCount: manualQueueCount,
    pendingUnreviewedActions,
    actionPermissions,
    pipelineReport,
    repairReport,
    seedRows,
    importReport,
    healthSummary,
    anomalySummary,
    materializationSummary,
  });
  const blockers = buildLegislativeBlockers({
    pipelineReport,
    manualReviewCount: manualQueueCount,
    actionPermissions,
    seedRows,
    applyReport,
    importReport,
    healthSummary,
    anomalySummary,
  });
  const debugState = {
    total_actions: operatorActions.length,
    actionable_manual_review: manualQueueCount,
    stale_actions: staleActions.length,
    applied_actions: appliedActions.length,
    actionable_bundle_actions: actionableBundleActionCount,
    approved_actions: approvedPendingActions.length,
    workflow_state: workflowStatus,
    canonical_source: reviewBundle ? "review_bundle" : manualQueue ? "manual_review_queue_fallback" : "none",
  };

  return {
    workflow_status: workflowStatus,
    requested_model: sanitizeDisplayText(
      pipelineReport?.requested_model || aiReview?.requested_model,
      null
    ),
    pipeline_report: pipelineReport
      ? {
          status: sanitizeDisplayText(pipelineReport.status, "unknown"),
          generated_at: normalizeString(pipelineReport.generated_at) || null,
          started_at: normalizeString(pipelineReport.started_at) || null,
          requested_model: sanitizeDisplayText(pipelineReport.requested_model),
          failed_step: sanitizeDisplayText(
            healthSummary.failed_step || pipelineReport?.failure?.command?.slice?.(-1)?.[0]
          ),
          blocked_before_bundle_generation:
            toNormalizedLowerString(healthSummary.status) === "fail" &&
            Boolean(healthSummary.blocked_before_bundle_generation),
          path: safeFileName(ARTIFACT_PATHS.pipeline_report),
        }
      : null,
    review_bundle: reviewBundle
      ? {
          path: safeFileName(ARTIFACT_PATHS.review_bundle),
          generated_at: bundleGeneratedAt,
          summary: bundleSummary,
          file_name: safeFileName(ARTIFACT_PATHS.review_bundle),
        }
      : null,
    ai_review: aiReview
      ? {
          path: safeFileName(ARTIFACT_PATHS.ai_review),
          generated_at:
            normalizeString(aiReview.generated_at) ||
            loaded.ai_review.stat?.mtime?.toISOString?.() ||
            null,
          requested_model: sanitizeDisplayText(aiReview.requested_model),
          resolved_model: sanitizeDisplayText(aiReview.resolved_model),
          summary: aiReview.summary || {},
        }
      : null,
    manual_review_queue:
      manualQueue || reviewBundle
        ? {
            path: reviewBundle
              ? safeFileName(ARTIFACT_PATHS.review_bundle)
              : safeFileName(ARTIFACT_PATHS.manual_review_queue),
            generated_at: bundleGeneratedAt || manualQueueGeneratedAt,
            manual_review_count: manualQueueCount,
            items: actionableManualQueueItems.map(sanitizeManualReviewItem),
            source_artifact:
              reviewBundle && manualReviewItemsSource.length
                ? "review_bundle"
                : manualQueue
                  ? "manual_review_queue"
                  : null,
          }
        : null,
    partial_suggestions: partialSuggestions
      ? {
          path: safeFileName(ARTIFACT_PATHS.partial_suggestions),
          generated_at:
            normalizeString(partialSuggestions.generated_at) ||
            loaded.partial_suggestions.stat?.mtime?.toISOString?.() ||
            null,
        }
      : null,
    candidate_discovery: candidateDiscovery
      ? {
          path: safeFileName(ARTIFACT_PATHS.candidate_discovery),
          generated_at:
            normalizeString(candidateDiscovery.generated_at) ||
            loaded.candidate_discovery.stat?.mtime?.toISOString?.() ||
            null,
        }
      : null,
    apply_report: applyReport,
    repair_report: repairReport,
    approved_seed_file: {
      path: safeFileName(ARTIFACT_PATHS.approved_seed_file),
      generated_at: loaded.approved_seed_file.stat?.mtime?.toISOString?.() || null,
      row_count: seedRows.length,
    },
    import_report: importReport,
    review_runtime: reviewRuntime
      ? {
          ...reviewRuntime,
          requested_model: sanitizeDisplayText(reviewRuntime.requested_model),
          resolved_model: sanitizeDisplayText(reviewRuntime.resolved_model),
          review_backend: sanitizeDisplayText(reviewRuntime.review_backend),
          fallback_reason: sanitizeDisplayText(reviewRuntime.fallback_reason),
          fallback_model: sanitizeDisplayText(reviewRuntime.fallback_model),
          model_resolution_status: sanitizeDisplayText(
            reviewRuntime.model_resolution_status
          ),
        }
      : null,
    health_report: healthSummary,
    anomaly_report: anomalySummary,
    apply_readiness: {
      status: sanitizeDisplayText(
        loaded.health_report.payload?.apply_readiness?.status,
        healthSummary.status
      ).toUpperCase(),
      apply_state: sanitizeDisplayText(healthSummary.apply_state, "unknown"),
      manual_review_required: healthSummary.manual_review_required,
      approved_actions_pending_apply:
        healthSummary.approved_actions_pending_apply,
      human_approved_actions_pending_apply:
        healthSummary.human_approved_actions_pending_apply,
      ai_approved_actions_pending_apply:
        healthSummary.ai_approved_actions_pending_apply,
      repair_recommended: healthSummary.repair_recommended,
      message:
        summarizeIssues(loaded.health_report.payload?.apply_readiness?.issues) ||
        healthSummary.message,
      recommendation:
        healthSummary.recommendation || "./bin/equitystack legislative health",
    },
    repair_readiness: {
      status: sanitizeDisplayText(
        loaded.health_report.payload?.repair_readiness?.status,
        healthSummary.repair_recommended ? "warn" : "pass"
      ).toUpperCase(),
      repair_recommended: healthSummary.repair_recommended,
      db_available: Boolean(
        loaded.health_report.payload?.repair_readiness?.db_available
      ),
      message:
        summarizeIssues(loaded.health_report.payload?.repair_readiness?.issues) ||
        (healthSummary.repair_recommended
          ? "Repair is recommended before advancing."
          : "No repair warning is currently active."),
      recommendation: "./bin/equitystack legislative repair --dry-run",
    },
    materialization_status: materializationSummary,
    workflow_outcome_summary: workflowOutcomeSummary,
    operator_actions: operatorActions,
    actionable_operator_actions: actionableOperatorActions,
    auto_approved_operator_actions: autoApprovedActionableActions,
    human_approved_operator_actions: humanApprovedActionableActions,
    pending_operator_actions: manualDecisionActions,
    debug_state: debugState,
    counts: {
      total_actions: operatorActions.length,
      actionable_actions: actionableOperatorActions.length,
      auto_approved_operator_actions: autoApprovedActionableActions.length,
      human_approved_operator_actions: humanApprovedActionableActions.length,
      pending_operator_actions: pendingUnreviewedActions.length,
      approved_pending_actions: approvedPendingActions.length,
      pending_unreviewed_actions: pendingUnreviewedActions.length,
      manual_review_items: manualQueueCount,
      actionable_bundle_actions: actionableBundleActionCount,
      stale_actions: staleActions.length,
      applied_actions: appliedActions.length,
      pending_review_total: manualQueueCount + actionableBundleActionCount,
      approved_seed_rows: seedRows.length,
    },
    blockers,
    action_permissions: actionPermissions,
    next_step: nextStep,
    artifact_status: Object.fromEntries(
      Object.entries(ARTIFACT_PATHS).map(([key, filePath]) => [
        key,
        {
          ...buildArtifactEntry(key, filePath, loaded[key].payload, loaded[key].stat),
          summary:
            key === "ai_review" && reviewRuntime
              ? [
                  reviewRuntime.review_backend ? `backend ${reviewRuntime.review_backend}` : null,
                  reviewRuntime.fallback_used
                    ? `${reviewRuntime.fallback_count} fallback item(s)`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" • ") || null
              : key === "manual_review_queue"
                ? manualQueueCount > 0
                  ? `${manualQueueCount} actionable manual-review item(s)`
                  : "No actionable manual-review items"
              : null,
        },
      ])
    ),
    recent_reports: [applyReport, repairReport, importReport].filter(Boolean).sort(compareByGeneratedAtDesc),
  };
}
