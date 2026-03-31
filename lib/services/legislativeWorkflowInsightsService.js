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
  approved_seed_file: path.join(REPORTS_DIR, "approved_tracked_bills_seed.json"),
  import_report: path.join(REPORTS_DIR, "import_approved_tracked_bills_report.json"),
};

const ACTION_PRIORITY_ORDER = {
  High: 0,
  Medium: 1,
  Low: 2,
};

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
    path: filePath,
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
        future_bill_title:
          action.future_bill_title || group.future_bill_title || "(untitled future bill)",
        group_status: group.bundle_status || group.status || null,
        group_recommended_operator_action: group.recommended_operator_action || null,
        action_type: action.action_type || null,
        target_type: action.target_type || null,
        target_id: action.target_id ?? null,
        payload: action.payload || {},
        approved: Boolean(action.approved),
        status: normalizeString(action.status) || "pending",
        approved_by: action.approved_by || null,
        approved_at: action.approved_at || null,
        approval_note: normalizeString(action.approval_note),
        rationale: normalizeString(action.rationale),
        review_state: normalizeString(action.review_state) || "actionable",
        action_score:
          action.action_score != null ? Number(action.action_score) : null,
        action_priority: normalizeString(action.action_priority) || "Unscored",
        candidate_bill_number: action.candidate_bill_number || null,
        candidate_title: action.candidate_title || null,
        proposed_link_type: action.proposed_link_type || null,
        notes: Array.isArray(group.notes) ? group.notes : [],
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
    path: ARTIFACT_PATHS.apply_report,
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
    applied_actions: appliedActions,
    skipped_actions: skippedActions,
    errors,
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
    path: ARTIFACT_PATHS.import_report,
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
    errors,
    processed_rows: processedRows,
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

function buildLegislativeActionPermissions({
  hasBundle,
  bundleGeneratedAt,
  actionableActions,
  approvedPendingActions,
  pendingUnreviewedActions,
  applyReport,
  seedRows,
  importReport,
}) {
  const saveReasons = [];
  if (!hasBundle) {
    saveReasons.push("The review bundle artifact is missing.");
  }

  const applyDryRunReasons = [];
  if (!hasBundle) {
    applyDryRunReasons.push("The review bundle artifact is missing.");
  }
  if (pendingUnreviewedActions.length > 0) {
    applyDryRunReasons.push(
      `${pendingUnreviewedActions.length} legislative operator action(s) still need an explicit approve or dismiss decision.`
    );
  }
  if (approvedPendingActions.length === 0) {
    applyDryRunReasons.push(
      "Approve at least one pending legislative operator action before running the apply preview."
    );
  }

  const applyReasons = [...applyDryRunReasons];
  const hasCurrentApplyPreview = currentDryRunForReference(
    applyReport,
    bundleGeneratedAt
  );
  if (!hasCurrentApplyPreview) {
    applyReasons.push("Run a fresh legislative apply dry-run after the latest approval changes.");
  }
  if ((applyReport?.error_count || 0) > 0) {
    applyReasons.push("Resolve the legislative apply dry-run errors before applying.");
  }

  const importDryRunReasons = [];
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
      applyDryRunReasons.length === 0,
      applyDryRunReasons
    ),
    apply_bundle: buildActionPermission(applyReasons.length === 0, applyReasons),
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

function buildLegislativeWorkflowStatus({
  pipelineReport,
  reviewBundle,
  manualReviewCount,
  pendingUnreviewedActions,
  approvedPendingActions,
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
  return "COMPLETE";
}

function buildLegislativeNextStep({
  workflowStatus,
  actionPermissions,
  pipelineReport,
  importReport,
}) {
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

  return {
    step: "review_bundle",
    label: workflowStatus === "REVIEW_READY"
      ? "Review and classify the legislative operator actions"
      : "Resume the legislative workflow",
    commands: ["./bin/equitystack legislative review"],
  };
}

function buildLegislativeBlockers({
  pipelineReport,
  bundleSummary,
  actionPermissions,
  applyReport,
  importReport,
}) {
  const blockers = [];
  const pipelineFailure = pipelineReport?.failure || null;

  if (pipelineFailure) {
    blockers.push(
      `Pipeline failed while running ${pipelineFailure.command?.join(" ") || "an unknown command"}.`
    );
  }

  if (toSafeNumber(bundleSummary.manual_review_items, 0) > 0) {
    blockers.push(
      `${bundleSummary.manual_review_items} legislative item(s) remain in the manual-review queue.`
    );
  }

  for (const reason of actionPermissions.run_apply_dry_run.reasons) {
    blockers.push(reason);
  }

  for (const error of applyReport?.errors || []) {
    blockers.push(
      error.error || error.reason || error.message || "Legislative apply dry-run reported an error."
    );
  }

  for (const error of importReport?.errors || []) {
    blockers.push(
      error.reason || error.error || "Legislative import dry-run reported an error."
    );
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
  const operatorActions = flattenOperatorActions(reviewBundle);
  const actionableActions = operatorActions.filter(
    (action) =>
      normalizeString(action.review_state) === "actionable" &&
      normalizeString(action.status) === "pending"
  );
  const approvedPendingActions = actionableActions.filter((action) => action.approved);
  const pendingUnreviewedActions = actionableActions.filter((action) => !action.approved);

  const applyReport = buildApplyReportSummary(
    loaded.apply_report.payload,
    loaded.apply_report.stat
  );
  const importReport = buildImportReportSummary(
    loaded.import_report.payload,
    loaded.import_report.stat
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

  const actionPermissions = buildLegislativeActionPermissions({
    hasBundle: Boolean(reviewBundle),
    bundleGeneratedAt,
    actionableActions,
    approvedPendingActions,
    pendingUnreviewedActions,
    applyReport,
    seedRows,
    importReport,
  });
  const workflowStatus = buildLegislativeWorkflowStatus({
    pipelineReport,
    reviewBundle,
    manualReviewCount: toSafeNumber(bundleSummary.manual_review_items, 0),
    pendingUnreviewedActions,
    approvedPendingActions,
    seedRows,
    importReport,
  });
  const nextStep = buildLegislativeNextStep({
    workflowStatus,
    actionPermissions,
    pipelineReport,
    importReport,
  });
  const blockers = buildLegislativeBlockers({
    pipelineReport,
    bundleSummary,
    actionPermissions,
    applyReport,
    importReport,
  });

  return {
    workflow_status: workflowStatus,
    requested_model: pipelineReport?.requested_model || aiReview?.requested_model || null,
    pipeline_report: pipelineReport
      ? {
          ...pipelineReport,
          path: ARTIFACT_PATHS.pipeline_report,
        }
      : null,
    review_bundle: reviewBundle
      ? {
          path: ARTIFACT_PATHS.review_bundle,
          generated_at: bundleGeneratedAt,
          summary: bundleSummary,
          future_bill_groups: Array.isArray(reviewBundle.future_bill_groups)
            ? reviewBundle.future_bill_groups
            : [],
        }
      : null,
    ai_review: aiReview
      ? {
          path: ARTIFACT_PATHS.ai_review,
          generated_at:
            normalizeString(aiReview.generated_at) ||
            loaded.ai_review.stat?.mtime?.toISOString?.() ||
            null,
          requested_model: aiReview.requested_model || null,
          resolved_model: aiReview.resolved_model || null,
          items: Array.isArray(aiReview.items) ? aiReview.items : [],
          summary: aiReview.summary || {},
        }
      : null,
    manual_review_queue: manualQueue
      ? {
          path: ARTIFACT_PATHS.manual_review_queue,
          generated_at:
            normalizeString(manualQueue.generated_at) ||
            loaded.manual_review_queue.stat?.mtime?.toISOString?.() ||
            null,
          manual_review_count: Number(manualQueue.manual_review_count || 0),
          items: Array.isArray(manualQueue.items) ? manualQueue.items : [],
        }
      : null,
    partial_suggestions: partialSuggestions
      ? {
          path: ARTIFACT_PATHS.partial_suggestions,
          generated_at:
            normalizeString(partialSuggestions.generated_at) ||
            loaded.partial_suggestions.stat?.mtime?.toISOString?.() ||
            null,
        }
      : null,
    candidate_discovery: candidateDiscovery
      ? {
          path: ARTIFACT_PATHS.candidate_discovery,
          generated_at:
            normalizeString(candidateDiscovery.generated_at) ||
            loaded.candidate_discovery.stat?.mtime?.toISOString?.() ||
            null,
        }
      : null,
    apply_report: applyReport,
    approved_seed_file: {
      path: ARTIFACT_PATHS.approved_seed_file,
      generated_at: loaded.approved_seed_file.stat?.mtime?.toISOString?.() || null,
      row_count: seedRows.length,
      rows: seedRows,
    },
    import_report: importReport,
    review_runtime: reviewRuntime,
    operator_actions: operatorActions,
    counts: {
      total_actions: operatorActions.length,
      actionable_actions: actionableActions.length,
      approved_pending_actions: approvedPendingActions.length,
      pending_unreviewed_actions: pendingUnreviewedActions.length,
      manual_review_items: toSafeNumber(bundleSummary.manual_review_items, 0),
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
              : null,
        },
      ])
    ),
    recent_reports: [applyReport, importReport].filter(Boolean).sort(compareByGeneratedAtDesc),
  };
}
