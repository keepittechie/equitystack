import path from "node:path";
import { getCurrentAdministrationOperatorWorkspace } from "@/lib/services/currentAdministrationReviewInsightsService.js";
import { getLegislativeWorkflowWorkspace } from "@/lib/services/legislativeWorkflowInsightsService.js";
import {
  getOperatorActionDefinition,
  listSerializedOperatorActions,
  serializeOperatorAction,
} from "./actionRegistry.js";
import { getJobRun, listJobRuns } from "./jobRunStore.js";
import {
  deleteArtifactRecordsByWorkflowFamily,
  listArtifactRecords,
  upsertArtifactRecord,
} from "./artifactStore.js";
import {
  buildReviewQueueExplanation,
  buildSessionAssistSummary,
} from "./operatorAssist.js";
import {
  getOperatorVerificationBanner,
  getOperatorVerificationReport,
} from "./verificationService.js";
import {
  deleteReviewQueueRecordsByWorkflowFamily,
  deactivateSessionReviewQueueItems,
  listReviewQueueRecords,
  upsertReviewQueueItem,
} from "./reviewQueueStore.js";
import { listScheduleRecords } from "./scheduleStore.js";
import {
  deleteWorkflowSessionRecordsByWorkflowFamily,
  getWorkflowSessionRecord,
  listWorkflowSessionRecords,
  markWorkflowFamilySessionsInactive,
  upsertWorkflowSessionRecord,
} from "./sessionStore.js";
import {
  deleteSystemSignalsByWorkflowFamily,
  deactivateSystemSignals,
  listSystemSignalRecords,
  upsertSystemSignal,
} from "./systemSignalStore.js";
import {
  buildExecutionRuntimeMetadata,
  EXECUTION_MODES,
  fromBase64Id,
  getExecutorMetadata,
  normalizeString,
  OPERATOR_DATA_DIR,
  readJsonSafe,
  toArray,
  toHashedFileStem,
  toIsoTimestamp,
  toSafeNumber,
} from "./shared.js";

const WORKFLOW_SESSION_SUPPRESSIONS_PATH = path.join(
  OPERATOR_DATA_DIR,
  "workflow_session_suppressions.json"
);

const CURRENT_ADMIN_ARTIFACT_SUFFIXES = [
  ".automation-report.json",
  ".ai-review.json",
  ".current-admin-outcome-sync-apply.json",
  ".manual-review-queue.json",
  ".decision-template.json",
  ".decision-log.json",
  ".exception-queue.json",
  ".impact-evaluate.json",
  ".impact-promote-apply.json",
  ".impact-promote-dry-run.json",
  ".normalized.json",
  ".normalization-report.json",
  ".outcome-enrichment-apply.json",
  ".outcome-enrichment-dry-run.json",
  ".outcome-enrichment-preview.json",
  ".outcome-evidence.json",
  ".pre-commit-review.json",
  ".import-dry-run.json",
  ".import-apply.json",
  ".import-validation.json",
  ".json",
];

function buildArtifactId({ workflowFamily, sessionId, artifactKey, filePath, label }) {
  return `artifact_${toHashedFileStem(
    `${workflowFamily}:${sessionId}:${artifactKey}:${normalizeString(filePath) || normalizeString(label)}`
  )}`;
}

function buildReviewQueueItemId(parts) {
  return `rq_${toHashedFileStem(parts.filter(Boolean).join(":"))}`;
}

function buildSystemSignalId(parts) {
  return `sig_${toHashedFileStem(parts.filter(Boolean).join(":"))}`;
}

function buildRuntimeEnvelope(relatedJob = null) {
  const executionMode =
    normalizeString(relatedJob?.metadataJson?.execution_runtime?.execution_mode) ||
    normalizeString(relatedJob?.metadataJson?.execution_mode) ||
    EXECUTION_MODES.LOCAL_CLI;
  const executor =
    relatedJob?.metadataJson?.execution_runtime?.executor ||
    relatedJob?.metadataJson?.executor ||
    buildExecutionRuntimeMetadata(executionMode);

  return {
    execution_mode: executionMode,
    executor,
    executor_transport:
      normalizeString(executor?.executor_transport) ||
      normalizeString(relatedJob?.metadataJson?.executor_transport) ||
      null,
  };
}

function decodeSessionId(value) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return "";
  }
  try {
    return decodeURIComponent(normalized);
  } catch {
    return normalized;
  }
}

function enrichSessionRecord(record) {
  if (!record) {
    return null;
  }

  const execution = record.metadataJson?.execution_runtime || {
    execution_mode: normalizeString(record.metadataJson?.execution_mode) || EXECUTION_MODES.LOCAL_CLI,
    executor: record.metadataJson?.executor || getExecutorMetadata(),
  };

  return {
    ...record,
    state: record.canonicalState,
    recommendedAction: getOperatorActionDefinition(record.recommendedActionId),
    execution,
    workflowTracker: record.metadataJson?.workflow_tracker || null,
    reviewRuntime: record.metadataJson?.review_runtime || null,
    reviewPendingCount: toSafeNumber(record.metadataJson?.counts?.pendingReview, 0),
    blockerCount: toSafeNumber(record.metadataJson?.counts?.blockers, 0),
    artifactCount: toSafeNumber(record.metadataJson?.counts?.artifacts, 0),
    relatedJobRunCount: toArray(record.relatedJobRunIds).length,
    activeReviewQueueCount: toSafeNumber(record.metadataJson?.counts?.reviewQueueItems, 0),
  };
}

function enrichArtifactRecord(record) {
  if (!record) {
    return null;
  }

  return {
    ...record,
    path: record.canonicalPath,
    generatedAt: record.generatedAt,
    summary: record.metadataJson?.summary || null,
    execution: record.metadataJson?.execution_runtime || {
      execution_mode: normalizeString(record.metadataJson?.execution_mode) || EXECUTION_MODES.LOCAL_CLI,
      executor: record.metadataJson?.executor || getExecutorMetadata(),
    },
  };
}

function enrichReviewQueueItem(item) {
  if (!item) {
    return null;
  }

  const explanation = buildReviewQueueExplanation(item);

  return {
    ...item,
    recommendedAction: getOperatorActionDefinition(item.recommendedActionId),
    artifactPath: item.sourceArtifactPath,
    metadata: item.metadataJson,
    explanation,
    riskLevel: explanation.riskLevel,
  };
}

function enrichScheduleRecord(record, jobs = []) {
  if (!record) {
    return null;
  }

  const action = getOperatorActionDefinition(record.actionId);
  const lastJob = jobs.find((job) => job.id === record.lastJobId) || null;
  const overdue =
    Boolean(record.enabled) &&
    normalizeString(record.nextRunAt) &&
    new Date(record.nextRunAt).getTime() <= Date.now();
  const status = !record.enabled
    ? "disabled"
    : lastJob && ["queued", "running"].includes(lastJob.status)
      ? lastJob.status
      : record.scheduleType === "manual"
        ? "manual"
        : overdue
          ? "overdue"
          : lastJob && ["failed", "blocked"].includes(lastJob.status)
            ? "attention"
            : "scheduled";

  return {
    ...record,
    action: action ? serializeOperatorAction(action) : null,
    lastJob,
    executionMode: normalizeString(record.executionMode) || EXECUTION_MODES.LOCAL_CLI,
    overdue,
    status,
    summary:
      lastJob?.summary ||
      record.lastResultSummary ||
      (action ? `${action.title} is scheduled as ${record.scheduleType}.` : record.title),
  };
}

function buildMutatingConfirmation(action, label) {
  return {
    title: `Confirm ${label || action.title}`,
    description:
      "This remains advisory only until you explicitly confirm the canonical mutating step. Broker and CLI guardrails still apply.",
    checkboxLabel: `I understand this requests the guarded mutating ${label ? label.toLowerCase() : action.title.toLowerCase()} step.`,
    requireTypedYes: true,
  };
}

function isBlockingMissingArtifact(artifact, { legislativeWorkspace = null } = {}) {
  if (!artifact || artifact.exists) {
    return false;
  }

  const artifactKey = normalizeString(artifact.artifactKey || artifact.metadataJson?.artifact_key);
  if (artifact.workflowFamily === "legislative" && legislativeWorkspace) {
    const artifactStatus = legislativeWorkspace?.artifact_status || {};
    if (artifactKey && artifactStatus?.[artifactKey]?.exists) {
      return false;
    }

    const artifactFileName = normalizeString(
      artifact.fileName || artifact.canonicalPath || artifact.path
    )
      .split("/")
      .pop();
    if (artifactFileName) {
      const canonicalMatch = Object.values(artifactStatus).find((entry) => {
        const entryFileName = normalizeString(entry?.path).split("/").pop();
        return entry?.exists && entryFileName && entryFileName === artifactFileName;
      });
      if (canonicalMatch) {
        return false;
      }
    }
  }
  if (artifact.workflowFamily === "legislative" && artifactKey === "import_report") {
    const seedRowCount = toSafeNumber(legislativeWorkspace?.approved_seed_file?.row_count, 0);
    const importMode = normalizeString(legislativeWorkspace?.import_report?.mode);
    return seedRowCount > 0 || ["dry_run", "apply"].includes(importMode);
  }

  return true;
}

function buildSuggestedAction({
  id,
  actionId,
  workflowFamily,
  title,
  explanation,
  priorityScore = 0,
  priorityLabel = "normal",
  priorityReason = "",
  tone = "default",
  input = {},
  context = {},
  href = null,
}) {
  const action = getOperatorActionDefinition(actionId);
  if (!action) {
    return null;
  }

  return {
    id,
    workflowFamily,
    title,
    explanation,
    priorityScore,
    priorityLabel,
    priorityReason,
    action: serializeOperatorAction(action),
    input,
    context,
    href,
    tone,
    confirmation:
      action.execution?.mutating && input?.apply && input?.yes
        ? buildMutatingConfirmation(action, title)
        : null,
  };
}

const DASHBOARD_BUCKETS = {
  needsAttention: {
    id: "needsAttention",
    title: "Needs Attention",
    description: "Highest-priority items that should shape the morning routine first.",
  },
  awaitingHumanReview: {
    id: "awaitingHumanReview",
    title: "Awaiting Human Review",
    description: "Sessions and queue items waiting on explicit manual review or approval.",
  },
  readyToRun: {
    id: "readyToRun",
    title: "Ready To Run",
    description: "Safe next-step work that can be run now through the broker.",
  },
  blockedNeedsFix: {
    id: "blockedNeedsFix",
    title: "Blocked / Needs Fix",
    description: "Work that cannot progress until blockers or missing artifacts are resolved.",
  },
  scheduledSoon: {
    id: "scheduledSoon",
    title: "Scheduled Soon",
    description: "Upcoming or overdue scheduled preparation that may create operator work.",
  },
  recentFailures: {
    id: "recentFailures",
    title: "Recent Failures",
    description: "Recent broker-backed failures that may need inspection or safe retry.",
  },
};

function buildPriorityMetadata(score, reason) {
  if (score >= 95) {
    return { score, label: "critical", reason };
  }
  if (score >= 80) {
    return { score, label: "high", reason };
  }
  if (score >= 60) {
    return { score, label: "medium", reason };
  }
  return { score, label: "low", reason };
}

function sortPriorityItems(items = []) {
  return [...items].sort((left, right) => {
    if ((right.priorityScore || 0) !== (left.priorityScore || 0)) {
      return (right.priorityScore || 0) - (left.priorityScore || 0);
    }
    const rightTime = new Date(right.updatedAt || right.generatedAt || 0).getTime();
    const leftTime = new Date(left.updatedAt || left.generatedAt || 0).getTime();
    return rightTime - leftTime;
  });
}

function isSafeRetryableJob(job) {
  return Boolean(
    job &&
      ["failed", "blocked"].includes(job.status) &&
      !(job.input?.apply && job.input?.yes)
  );
}

function buildDashboardItem({
  id,
  bucketId,
  kind,
  workflowFamily,
  title,
  summary,
  priorityScore,
  priorityReason,
  href = null,
  status = "",
  actionId = "",
  actionInput = {},
  actionContext = {},
  quickActionLabel = "",
  quickActionHelperText = "",
  tone = "default",
  confirmation = null,
  metadata = {},
}) {
  const priority = buildPriorityMetadata(priorityScore, priorityReason);
  const action = actionId ? getOperatorActionDefinition(actionId) : null;

  return {
    id,
    bucketId,
    bucketTitle: DASHBOARD_BUCKETS[bucketId]?.title || bucketId,
    kind,
    workflowFamily,
    title,
    summary,
    href,
    status,
    priorityScore: priority.score,
    priorityLabel: priority.label,
    priorityReason: priority.reason,
    recommendedActionId: actionId || null,
    quickAction: action
      ? {
          action: serializeOperatorAction(action),
          label: quickActionLabel || action.title,
          input: actionInput,
          context: actionContext,
          tone,
          confirmation,
          helperText: quickActionHelperText,
        }
      : null,
    metadata,
  };
}

function dedupeRoutineSteps(steps = []) {
  const seen = new Set();
  const next = [];

  for (const step of steps) {
    const key = `${step.sourceType}:${step.sourceId || step.id}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    next.push(step);
  }

  return next;
}

function buildRoutineStepFromDashboardItem(item) {
  const actionId = item.quickAction?.action?.id || item.recommendedActionId || null;
  const actionInput = item.quickAction?.input || {};
  const actionContext = item.quickAction?.context || {};
  const sourceType =
    item.kind === "reviewQueue"
      ? "review_queue_item"
      : item.kind === "job"
        ? "failed_job"
        : item.kind === "schedule"
          ? "schedule"
          : item.kind === "artifact"
            ? "artifact"
            : "session";
  const sourceId =
    item.metadata?.sourceId ||
    actionContext.queueItemId ||
    actionContext.sessionId ||
    item.metadata?.scheduleId ||
    item.metadata?.jobId ||
    item.id;
  const isBlocked = item.bucketId === "blockedNeedsFix";
  const isReview =
    item.bucketId === "awaitingHumanReview" &&
    !(actionInput?.apply && actionInput?.yes);
  const requiresConfirmation = Boolean(actionInput?.apply && actionInput?.yes);
  const safeToRunNow =
    !isBlocked &&
    !isReview &&
    !requiresConfirmation &&
    Boolean(actionId && item.quickAction?.action);
  const actionType = isBlocked
    ? "inspect_blocker"
    : isReview
      ? "open_review"
      : requiresConfirmation
        ? "confirm_final_action"
        : item.kind === "job"
          ? "retry_safely"
          : item.kind === "session"
            ? "run_next_safe_action"
            : item.kind === "schedule"
              ? "open_schedule"
              : "run_action";
  const primaryAction = isBlocked || isReview || item.kind === "schedule" || item.kind === "artifact"
    ? {
        type: "link",
        label:
          isBlocked
            ? "Inspect blocker"
            : isReview
              ? "Open review"
              : item.kind === "schedule"
                ? "Open schedule"
                : "Open details",
        href: item.href,
      }
    : item.quickAction?.action
      ? {
          type: "action",
          label:
            requiresConfirmation
              ? item.quickAction.label || "Confirm action"
              : safeToRunNow
                ? item.quickAction.label || "Run now"
                : item.quickAction.label || "Open action",
          action: item.quickAction.action,
          input: actionInput,
          context: actionContext,
          tone: item.quickAction.tone,
          confirmation: item.quickAction.confirmation,
          helperText: item.quickAction.helperText,
        }
      : {
          type: "link",
          label: "Open details",
          href: item.href,
        };

  return {
    id: `routine:${item.id}`,
    title: item.title,
    workflowFamily: item.workflowFamily,
    sourceType,
    sourceId,
    actionType,
    recommendedActionId: actionId,
    deepLinkTarget: item.href || primaryAction.href || null,
    priorityScore: item.priorityScore,
    priorityLabel: item.priorityLabel,
    priorityReason: item.priorityReason,
    executionSafety: {
      safe_to_run_now: safeToRunNow,
      requires_review: isReview,
      blocked: isBlocked,
      requires_confirmation: requiresConfirmation,
    },
    explanation: item.summary,
    primaryAction,
    sourceItemId: item.id,
    bucketId: item.bucketId,
  };
}

function buildDailyRoutine({
  blockedSessionItems = [],
  awaitingHumanReviewItems = [],
  recentFailureItems = [],
  readyToRunItems = [],
  scheduleItems = [],
}) {
  const ordered = dedupeRoutineSteps([
    ...sortPriorityItems(blockedSessionItems).map(buildRoutineStepFromDashboardItem),
    ...sortPriorityItems(awaitingHumanReviewItems).map(buildRoutineStepFromDashboardItem),
    ...sortPriorityItems(recentFailureItems.filter((item) => item.quickAction?.action)).map(buildRoutineStepFromDashboardItem),
    ...sortPriorityItems(readyToRunItems).map(buildRoutineStepFromDashboardItem),
    ...sortPriorityItems(scheduleItems).map(buildRoutineStepFromDashboardItem),
  ]).slice(0, 8);

  return {
    generatedAt: new Date().toISOString(),
    summary: "A guided morning checklist derived from current sessions, review items, failures, and schedules.",
    steps: ordered.map((step, index) => ({
      ...step,
      sequence: index + 1,
    })),
    nextSafeStep:
      ordered.find((step) => step.executionSafety.safe_to_run_now) || null,
    nextReviewStep:
      ordered.find((step) => step.executionSafety.requires_review) || null,
    nextBlockedStep:
      ordered.find((step) => step.executionSafety.blocked) || null,
  };
}

function findLatestJobForSession(sessionId, jobs = []) {
  return jobs.find((job) => Array.isArray(job.sessionIds) && job.sessionIds.includes(sessionId)) || null;
}

function findLinkedScheduleForSession(session, schedules = []) {
  return (
    schedules.find((schedule) => schedule.lastJob?.sessionIds?.includes(session.id)) ||
    schedules.find((schedule) => schedule.workflowFamily === session.workflowFamily && schedule.enabled) ||
    null
  );
}

function buildSessionQuickActions(session, lastJob) {
  const nextAction = session.recommendedActionId
    ? buildSuggestedAction({
        id: `session-next:${session.id}`,
        actionId: session.recommendedActionId,
        workflowFamily: session.workflowFamily,
        title: session.recommendedAction?.title || "Run next safe action",
        explanation:
          session.metadataJson?.next_action_reason ||
          "This is the current safe next step for the canonical session state.",
        priorityScore: 0,
        priorityLabel: "low",
        priorityReason: "",
        tone: "primary",
        context: {
          sessionId: session.id,
          canonicalSessionKey: session.canonicalSessionKey,
          triggerSource: "command_center_session_card",
        },
        href: session.href,
      })
    : null;

  const retryAction =
    isSafeRetryableJob(lastJob)
      ? buildSuggestedAction({
          id: `session-retry:${lastJob.id}`,
          actionId: lastJob.actionId,
          workflowFamily: lastJob.workflowFamily,
          title: `Retry ${lastJob.actionTitle}`,
          explanation:
            normalizeString(lastJob.metadataJson?.failure?.message) ||
            "The latest failed or blocked job can be safely retried.",
          priorityScore: 0,
          priorityLabel: "low",
          priorityReason: "",
          input: lastJob.input || {},
          context: lastJob.metadataJson?.action_context || {},
          href: `/admin/jobs/${encodeURIComponent(lastJob.id)}`,
        })
      : null;

  return {
    nextAction,
    retryAction,
  };
}

function buildSessionSnapshotCard(
  session,
  { jobs = [], artifacts = [], schedules = [], legislativeWorkspace = null } = {}
) {
  const lastJob = findLatestJobForSession(session.id, jobs);
  const linkedSchedule = findLinkedScheduleForSession(session, schedules);
  const missingArtifacts = artifacts.filter(
    (artifact) =>
      artifact.sessionId === session.id &&
      isBlockingMissingArtifact(artifact, { legislativeWorkspace })
  );
  const blockers = toArray(session.metadataJson?.blockers);
  const quickActions = buildSessionQuickActions(session, lastJob);

  return {
    ...session,
    lastJob,
    linkedSchedule,
    missingArtifactsCount: missingArtifacts.length,
    missingArtifactsPreview: missingArtifacts.slice(0, 2).map((artifact) => artifact.label),
    blockerPreview: blockers.slice(0, 2),
    fallbackPreview: session.metadataJson?.review_runtime?.fallback_used
      ? {
          backend: session.metadataJson?.review_runtime?.review_backend || "fallback",
          count: toSafeNumber(session.metadataJson?.review_runtime?.fallback_count, 0),
          reason: session.metadataJson?.review_runtime?.fallback_reason || null,
        }
      : null,
    priority: buildPriorityMetadata(
      session.canonicalState === "BLOCKED"
        ? 92
        : session.reviewPendingCount > 0
          ? 78
          : session.recommendedActionId
            ? 60
            : 40,
      session.canonicalState === "BLOCKED"
        ? "This session is blocked by canonical current-admin or legislative workflow state."
        : session.reviewPendingCount > 0
          ? "This session has active manual-review work waiting."
          : session.recommendedActionId
            ? "This session has a safe next step ready."
            : "This session is active but does not have an urgent next step."
    ),
    quickActions,
  };
}

function buildReviewRuntimeNote(reviewRuntime) {
  if (!reviewRuntime?.fallback_used) {
    return "";
  }

  const backend = normalizeString(reviewRuntime.review_backend) || "fallback";
  const fallbackCount = toSafeNumber(reviewRuntime.fallback_count, 0);
  const reason = normalizeString(reviewRuntime.fallback_reason);
  return ` Review ran with ${backend}; fallback affected ${fallbackCount} item(s)${reason ? ` (${reason})` : ""}.`;
}

function summarizeCurrentAdminState(state, workspace) {
  if (!workspace?.batch?.batch_name) {
    return "No current-admin batch has been prepared yet.";
  }

  const importReadiness = workspace?.import_readiness || null;
  const importCandidateCount = toSafeNumber(
    importReadiness?.queue_approved_for_import_count,
    0
  );
  const autoApprovedCount = toSafeNumber(
    importReadiness?.auto_approved_item_count,
    0
  );
  const autoRejectedCount = toSafeNumber(
    importReadiness?.auto_rejected_item_count,
    0
  );
  const manualQueueCount =
    toSafeNumber(importReadiness?.queue_pending_count, 0) +
    toSafeNumber(importReadiness?.queue_pending_manual_review_count, 0);
  if (
    ["QUEUE_READY", "PRECOMMIT_READY"].includes(state) &&
    importReadiness?.queue_approved_for_import_count === 0 &&
    normalizeString(importReadiness.readiness_explanation)
  ) {
    return `${workspace.batch.batch_name} is waiting on import eligibility. ${importReadiness.readiness_explanation}${buildReviewRuntimeNote(workspace?.review_runtime)}`;
  }

  if (state === "BLOCKED") {
    return `${workspace.batch.batch_name} is blocked by pre-commit readiness. ${importReadiness?.readiness_explanation || workspace?.latest_pre_commit_review?.readiness_explanation || "Resolve the blocking checkpoint before apply can continue."}${buildReviewRuntimeNote(workspace?.review_runtime)}`;
  }

  if (state === "IMPORT_READY") {
    return `${workspace.batch.batch_name} has a dry-run import and is waiting for explicit apply confirmation.${buildReviewRuntimeNote(workspace?.review_runtime)}`;
  }

  if (["QUEUE_READY", "PRECOMMIT_READY"].includes(state) && importCandidateCount > 0) {
    const queueBits = [];
    if (autoApprovedCount > 0) {
      queueBits.push(`${autoApprovedCount} auto-approved`);
    }
    if (manualQueueCount > 0) {
      queueBits.push(`${manualQueueCount} in manual queue`);
    }
    if (autoRejectedCount > 0) {
      queueBits.push(`${autoRejectedCount} auto-rejected`);
    }
    const queueSummary = queueBits.length ? ` Queue split: ${queueBits.join(" • ")}.` : "";
    return `${workspace.batch.batch_name} is ${state} with ${importCandidateCount} import candidate(s) ready for guarded apply readiness.${queueSummary}${buildReviewRuntimeNote(workspace?.review_runtime)}`;
  }

  return `${workspace.batch.batch_name} is ${state} with ${toSafeNumber(
    workspace?.counts?.pending_review ?? workspace?.counts?.pending,
    0
  )} pending review decisions.${buildReviewRuntimeNote(workspace?.review_runtime)}`;
}

function summarizeLegislativeState(state, workspace) {
  const outcomeSummary = workspace?.workflow_outcome_summary || null;
  const manualReviewCount = toSafeNumber(workspace?.counts?.manual_review_items, 0);
  const pendingBundleApprovals = toSafeNumber(
    workspace?.counts?.pending_unreviewed_actions,
    0
  );
  const approvedBundleActions = toSafeNumber(
    workspace?.counts?.approved_pending_actions,
    0
  );

  if (state === "DISCOVERY_READY") {
    return "Legislative is waiting for the next wrapped run.";
  }
  if (state === "REVIEW_READY") {
    if (outcomeSummary?.workflow_status === "completed_with_fallback") {
      return `AI review failed and fallback drove ${toSafeNumber(
        outcomeSummary?.ai_status?.fallback_used,
        0
      )}/${toSafeNumber(outcomeSummary?.ai_status?.total_items, 0)} legislative item(s). ${manualReviewCount} actionable item(s) require manual review.`;
    }
    if (toSafeNumber(outcomeSummary?.ai_status?.fallback_used, 0) > 0) {
      return `Legislative review used fallback for ${toSafeNumber(
        outcomeSummary?.ai_status?.fallback_used,
        0
      )}/${toSafeNumber(outcomeSummary?.ai_status?.total_items, 0)} item(s). ${manualReviewCount} actionable item(s) require human review.`;
    }
    if (manualReviewCount > 0) {
      return `${manualReviewCount} actionable legislative item(s) require manual review before the workflow can continue.`;
    }
    if (pendingBundleApprovals > 0) {
      return `Legislative is REVIEW_READY with ${pendingBundleApprovals} pending bundle action(s).`;
    }
    if (approvedBundleActions > 0) {
      return `Legislative has ${approvedBundleActions} approved bundle action(s) ready for apply preview.`;
    }
    return "Legislative review has no actionable manual-review items remaining.";
  }
  if (state === "APPLY_READY") {
    return "Legislative approvals are ready for supervised apply preview.";
  }
  if (state === "IMPORT_READY") {
    return `Legislative import artifacts are ready for the next supervised import step.${buildReviewRuntimeNote(workspace?.review_runtime)}`;
  }
  if (state === "COMPLETE") {
    return `No actionable legislative review, apply, or import work remains.${buildReviewRuntimeNote(workspace?.review_runtime)}`;
  }

  return `Legislative is ${state} with ${pendingBundleApprovals} pending bundle actions.${buildReviewRuntimeNote(workspace?.review_runtime)}`;
}

function getCurrentAdminNextActionReason(state, workspace = null) {
  const importReadiness = workspace?.import_readiness || null;
  if (state === "DISCOVERY_READY") {
    return "No active batch is ready yet, so the next step is to run discovery and prepare the next batch.";
  }
  if (state === "REVIEW_READY") {
    return "The AI-first review artifact is ready and only borderline operator decisions remain.";
  }
  if (["QUEUE_READY", "PRECOMMIT_READY"].includes(state)) {
    if (importReadiness?.queue_approved_for_import_count === 0) {
      return (
        importReadiness.readiness_explanation ||
        "Operator review is finished, but no queue items are currently approved for import."
      );
    }
    return "The AI-first queue is synchronized and the guarded apply path can run pre-commit and dry-run checks.";
  }
  if (state === "BLOCKED") {
    return (
      importReadiness?.readiness_explanation ||
      "The last guarded apply path stopped at a blocking checkpoint and needs operator attention."
    );
  }
  if (state === "IMPORT_READY") {
    return "A dry-run import already exists, so only an explicitly confirmed final apply remains.";
  }
  return "The next step is derived from the canonical current-admin pipeline state.";
}

function getCurrentAdminBlockedGuidance(workspace, { reviewHref, blockerHref }) {
  const importReadiness = workspace?.import_readiness || {};
  const blockingIssueTypes = toArray(
    workspace?.latest_pre_commit_review?.blocking_issues
  )
    .map((issue) => normalizeString(issue?.type))
    .filter(Boolean);
  const reviewFixTypes = new Set([
    "no_approved_queue_items",
    "missing_decision_coverage",
    "invalid_operator_action",
    "operator_action_not_import_ready",
  ]);
  const missingArtifactTypes = new Set([
    "missing_final_record",
    "missing_review_artifact",
    "queue_review_slug_mismatch",
    "decision_log_review_mismatch",
    "decision_template_review_mismatch",
    "decision_log_outside_review_slice",
    "decision_template_outside_review_slice",
  ]);
  const reviewPageFix =
    importReadiness?.needs_queue_sync ||
    (toSafeNumber(importReadiness?.queue_approved_for_import_count, 0) === 0 &&
      toSafeNumber(importReadiness?.approval_style_decision_count, 0) > 0) ||
    blockingIssueTypes.some((type) => reviewFixTypes.has(type));
  const artifactFix =
    blockingIssueTypes.some((type) => missingArtifactTypes.has(type)) ||
    normalizeString(importReadiness?.readiness_explanation)
      .toLowerCase()
      .includes("artifact is missing");

  if (artifactFix) {
    return {
      reason:
        normalizeString(importReadiness?.readiness_explanation) ||
        normalizeString(workspace?.latest_pre_commit_review?.readiness_explanation) ||
        "A required current-admin artifact is missing or out of sync.",
      href: `${reviewHref}#artifact-state`,
      label: "Inspect missing artifact",
    };
  }

  if (reviewPageFix) {
    return {
      reason:
        normalizeString(importReadiness?.readiness_explanation) ||
        "Review decisions exist, but the AI-first queue is not yet synchronized for import readiness.",
      href: `${reviewHref}#review-actions`,
      label: importReadiness?.needs_queue_sync ? "Sync decision log" : "Open current-admin review",
    };
  }

  return {
    reason:
      normalizeString(importReadiness?.readiness_explanation) ||
      normalizeString(workspace?.latest_pre_commit_review?.readiness_explanation) ||
      "The guarded apply path stopped at a canonical blocking checkpoint.",
    href: blockerHref,
    label: "Inspect current-admin blocker",
  };
}

function getCurrentAdminBlockedActionId(workspace) {
  const importReadiness = workspace?.import_readiness || {};
  const blockingIssueTypes = toArray(workspace?.latest_pre_commit_review?.blocking_issues)
    .map((issue) => normalizeString(issue?.type))
    .filter(Boolean);
  const reviewFixTypes = new Set([
    "no_approved_queue_items",
    "missing_decision_coverage",
    "invalid_operator_action",
    "operator_action_not_import_ready",
  ]);

  const needsReviewFix =
    importReadiness?.needs_queue_sync ||
    (toSafeNumber(importReadiness?.queue_approved_for_import_count, 0) === 0 &&
      toSafeNumber(importReadiness?.approval_style_decision_count, 0) > 0) ||
    blockingIssueTypes.some((type) => reviewFixTypes.has(type));

  return needsReviewFix ? "currentAdmin.review" : "currentAdmin.status";
}

function buildTrackerActionConfig({
  actionId,
  label,
  input = {},
  context = {},
  tone = "primary",
  helperText = "",
  confirmation = null,
}) {
  const action = getOperatorActionDefinition(actionId);
  if (!action) {
    return null;
  }

  return {
    type: "action",
    label,
    action: serializeOperatorAction(action),
    input,
    context,
    tone,
    helperText,
    confirmation,
  };
}

function buildTrackerLinkConfig(href, label) {
  if (!normalizeString(href)) {
    return null;
  }

  return {
    type: "link",
    href,
    label,
  };
}

function buildCurrentAdminTrackerStep({ id, title, status, reason, action = null, href = null }) {
  return {
    id,
    title,
    status,
    reason,
    action,
    href,
  };
}

function humanizeWorkflowToken(value) {
  const text = normalizeString(value);
  if (!text) {
    return "Unknown";
  }

  return text
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function buildCurrentAdminWorkflowTracker(
  workspace,
  { sessionId = "", fallbackHref = "/admin", preferSurfaceHref = true } = {}
) {
  const batchName = normalizeString(workspace?.batch?.batch_name);
  const state = normalizeString(workspace?.batch?.stage) || "DISCOVERY_READY";
  const artifactStatus = workspace?.artifact_status || {};
  const actionPermissions = workspace?.action_permissions || {};
  const importReadiness = workspace?.import_readiness || {};
  const pendingReview = toSafeNumber(
    workspace?.counts?.pending_review ?? workspace?.counts?.pending,
    0
  );
  const reviewArtifact = artifactStatus.review_artifact || null;
  const decisionLogArtifact = artifactStatus.decision_log || null;
  const queueArtifact = artifactStatus.manual_review_queue || null;
  const preCommitArtifact = artifactStatus.pre_commit_review || null;
  const importDryRunArtifact = artifactStatus.import_dry_run || null;
  const importApplyArtifact = artifactStatus.import_apply || null;
  const validationArtifact = artifactStatus.validation_report || null;
  const hasBatch = Boolean(batchName);
  const reviewExists = Boolean(reviewArtifact?.exists);
  const decisionLogExists = Boolean(decisionLogArtifact?.exists);
  const queueExists = Boolean(queueArtifact?.exists);
  const preCommitExists = Boolean(preCommitArtifact?.exists);
  const importDryRunExists = Boolean(importDryRunArtifact?.exists);
  const importApplyExists = Boolean(importApplyArtifact?.exists);
  const validationExists = Boolean(validationArtifact?.exists);
  const canonicalSessionId = normalizeString(sessionId) || (batchName ? `current-admin:${batchName}` : "");
  const sessionHref = canonicalSessionId
    ? `/admin/workflows/${encodeURIComponent(canonicalSessionId)}`
    : fallbackHref;
  const blockerHref = `${sessionHref}#blocking-issues`;
  const reviewHref = "/admin/current-admin-review";
  const queuePath =
    normalizeString(queueArtifact?.path) ||
    normalizeString(workspace?.batch?.paths?.manual_review_queue) ||
    null;
  const batchInput = batchName ? { batchName } : {};
  const actionContext = {
    sessionId: canonicalSessionId || null,
    canonicalSessionKey: batchName || null,
    triggerSource: "current_admin_workflow_tracker",
  };
  const finalApplyConfirmation = buildMutatingConfirmation(
    getOperatorActionDefinition("currentAdmin.apply"),
    "Current-Admin Apply"
  );
  const blockedGuidance = getCurrentAdminBlockedGuidance(workspace, {
    reviewHref,
    blockerHref,
  });

  const runAction = buildTrackerActionConfig({
    actionId: "currentAdmin.run",
    label: "Run current-admin",
    input: batchInput,
    context: actionContext,
    helperText: "Runs the wrapped current-admin CLI for this batch.",
  });
  const preCommitAction = queuePath
    ? buildTrackerActionConfig({
        actionId: "currentAdmin.preCommit",
        label: "Run pre-commit check",
        input: {
          input: queuePath,
        },
        context: actionContext,
        helperText: "Runs the canonical pre-commit review against the current manual-review queue.",
      })
    : null;
  const dryRunAction = buildTrackerActionConfig({
    actionId: "currentAdmin.apply",
    label: "Run import dry-run",
    input: batchInput,
    context: actionContext,
    helperText: "Runs the guarded dry-run import path after pre-commit readiness is in place.",
  });
  const finalApplyAction = buildTrackerActionConfig({
    actionId: "currentAdmin.apply",
    label: "Approve current-admin import",
    input: {
      ...batchInput,
      apply: true,
      yes: true,
    },
    context: actionContext,
    tone: "danger",
    helperText: "Requests the guarded mutating apply step with explicit confirmation.",
    confirmation: finalApplyConfirmation,
  });
  const validateAction = queuePath
    ? buildTrackerActionConfig({
        actionId: "currentAdmin.validate",
        label: "Run validation",
        input: {
          input: queuePath,
        },
        context: actionContext,
        helperText: "Refreshes the canonical validation report for this queue artifact.",
      })
    : null;

  const steps = [];

  steps.push(
    buildCurrentAdminTrackerStep({
      id: "discover_batch",
      title: "Discover / Batch Ready",
      status: hasBatch ? "complete" : "current",
      reason: hasBatch
        ? `${batchName} is the active canonical batch.`
        : "No current-admin batch is active yet.",
      action: hasBatch ? null : runAction,
      href: sessionHref,
    })
  );

  let runStatus = "pending";
  let runReason = "The wrapped run becomes available after a batch is prepared.";
  let runActionConfig = null;
  if (hasBatch) {
    if (reviewExists) {
      runStatus = "complete";
      runReason = "The wrapped current-admin run already produced the review artifact.";
    } else if (!["DISCOVERY_READY", "NORMALIZED"].includes(state)) {
      runStatus = "blocked";
      runReason = "The canonical review artifact is missing for this later-stage batch.";
      runActionConfig = buildTrackerLinkConfig(sessionHref, "Open current-admin session");
    } else {
      runStatus = "current";
      runReason =
        state === "NORMALIZED"
          ? "Normalization is complete, but the AI review artifact has not been generated yet."
          : "The batch is ready, but the wrapped current-admin AI review has not been completed yet.";
      runActionConfig = runAction;
    }
  }
  steps.push(
    buildCurrentAdminTrackerStep({
      id: "ai_review",
      title: "AI Review",
      status: runStatus,
      reason: runReason,
      action: runActionConfig,
      href: sessionHref,
    })
  );

  let reviewStatus = "pending";
  let reviewReason = "Operator review starts after the review artifact is generated.";
  let reviewAction = null;
  if (reviewExists) {
    if (pendingReview > 0 || state === "REVIEW_READY") {
      reviewStatus = "current";
      reviewReason =
        pendingReview > 0
          ? `${pendingReview} review decision${pendingReview === 1 ? "" : "s"} still need operator input.`
          : "The review artifact is ready and waiting for explicit manual review.";
      reviewAction = buildTrackerLinkConfig(`${reviewHref}#review-items`, "Open current-admin review");
    } else {
      reviewStatus = "complete";
      reviewReason = "The review artifact exists and operator row-level decisions are filled in.";
    }
  }
  steps.push(
    buildCurrentAdminTrackerStep({
      id: "operator_review",
      title: "Manual Review",
      status: reviewStatus,
      reason: reviewReason,
      action: reviewAction,
      href: reviewHref,
    })
  );

  let finalizeStatus = "pending";
  let finalizeReason = "Decision-log sync becomes available after the manual-review slice is complete.";
  let finalizeAction = null;
  if (reviewExists && pendingReview === 0) {
    if (decisionLogExists && queueExists) {
      finalizeStatus = "complete";
      finalizeReason = "The canonical decision log and AI-first queue are already synchronized.";
    } else {
      if (actionPermissions.finalize?.allowed === false) {
        finalizeStatus = "blocked";
        finalizeReason =
          actionPermissions.finalize.reasons?.[0] ||
          "Decision-log sync is blocked until the review workspace is complete.";
        finalizeAction = buildTrackerLinkConfig(`${reviewHref}#review-actions`, "Open current-admin review");
      } else {
        finalizeStatus = "current";
        finalizeReason =
          "All manual decisions are recorded, but the canonical decision log has not been synchronized yet.";
        finalizeAction = buildTrackerLinkConfig(`${reviewHref}#review-actions`, "Sync decision log");
      }
    }
  }
  steps.push(
    buildCurrentAdminTrackerStep({
      id: "finalize_decisions",
      title: "Decision Log Sync",
      status: finalizeStatus,
      reason: finalizeReason,
      action: finalizeAction,
      href: reviewHref,
    })
  );

  let readinessStatus = "pending";
  let readinessReason = "Pre-commit and dry-run readiness begin after the queue is synchronized.";
  let readinessAction = null;
  if (decisionLogExists && queueExists) {
    if (
      !preCommitExists &&
      toSafeNumber(importReadiness.queue_approved_for_import_count, 0) === 0 &&
      pendingReview === 0
    ) {
      readinessStatus = "blocked";
      readinessReason =
        normalizeString(importReadiness.readiness_explanation) ||
        "No queue items are currently approved for import.";
      readinessAction = buildTrackerLinkConfig(blockedGuidance.href, blockedGuidance.label);
    } else if (state === "BLOCKED") {
      readinessStatus = "blocked";
      readinessReason = blockedGuidance.reason;
      readinessAction = buildTrackerLinkConfig(
        blockedGuidance.href,
        blockedGuidance.label
      );
    } else if (state === "QUEUE_READY") {
      readinessStatus = "current";
      readinessReason = "The decision log and AI-first queue are ready for the canonical pre-commit check.";
      readinessAction =
        actionPermissions.run_precommit?.allowed && preCommitAction
          ? preCommitAction
          : buildTrackerLinkConfig(`${reviewHref}#review-actions`, "Open current-admin review");
    } else if (state === "PRECOMMIT_READY") {
      readinessStatus = "current";
      readinessReason = "Pre-commit is ready. The next valid step is the guarded import dry-run.";
      readinessAction =
        actionPermissions.run_import_dry_run?.allowed
          ? dryRunAction
          : buildTrackerLinkConfig(`${reviewHref}#review-actions`, "Open current-admin review");
    } else if (preCommitExists || importDryRunExists || importApplyExists || validationExists) {
      readinessStatus = "complete";
      readinessReason = "Pre-commit readiness has already been refreshed for this batch.";
    }
  }
  steps.push(
    buildCurrentAdminTrackerStep({
      id: "precommit_apply_readiness",
      title: "Pre-commit / Apply Readiness",
      status: readinessStatus,
      reason: readinessReason,
      action: readinessAction,
      href:
        readinessStatus === "blocked"
          ? blockedGuidance.href
          : reviewHref,
    })
  );

  let applyStatus = "pending";
  let applyReason = "Final apply stays unavailable until the dry-run import exists.";
  let applyAction = null;
  if (importDryRunExists && !importApplyExists) {
    applyStatus = "current";
    applyReason =
      "A dry-run import is complete. Final apply still requires explicit admin confirmation.";
    applyAction = actionPermissions.apply_import?.allowed
      ? finalApplyAction
      : buildTrackerLinkConfig(`${reviewHref}#review-actions`, "Open current-admin review");
  } else if (importApplyExists || validationExists) {
    applyStatus = "complete";
    applyReason = "The explicit apply checkpoint has already been completed.";
  }
  steps.push(
    buildCurrentAdminTrackerStep({
      id: "admin_approval",
      title: "Admin Approval",
      status: applyStatus,
      reason: applyReason,
      action: applyAction,
      href: reviewHref,
    })
  );

  let importStatus = "pending";
  let importReason = "Import stays unavailable until admin approval is explicitly confirmed.";
  let importAction = null;
  if (importApplyExists || state === "COMPLETE") {
    importStatus = "complete";
    importReason = validationExists
      ? "Import and validation are complete for this batch."
      : "Import is complete. Validation can still be refreshed from the canonical session if needed.";
    importAction =
      actionPermissions.validate_import?.allowed && validateAction
        ? validateAction
        : buildTrackerLinkConfig(sessionHref, "Open current-admin session");
  }
  steps.push(
    buildCurrentAdminTrackerStep({
      id: "import",
      title: "Import",
      status: importStatus,
      reason: importReason,
      action: importAction,
      href: sessionHref,
    })
  );

  const currentStep = steps.find((step) => step.status === "current") || null;
  const blockedStep = steps.find((step) => step.status === "blocked") || null;
  const nextStep = blockedStep || currentStep || steps.find((step) => step.status === "pending") || null;
  const operatorSurfaceHref =
    nextStep?.href ||
    (preferSurfaceHref
      ? blockedStep
        ? blockerHref
        : ["operator_review", "finalize_decisions", "precommit_apply_readiness", "admin_approval"].includes(
              nextStep?.id || ""
            )
          ? reviewHref
          : sessionHref
      : sessionHref);

  return {
    workflowFamily: "current-admin",
    sessionId: canonicalSessionId || null,
    batchName: batchName || null,
    canonicalState: state,
    provenance: workspace?.provenance || null,
    operatorSurfaceHref,
    sessionHref,
    reviewHref,
    blockerHref,
    currentStep,
    nextStep,
    blockedStep,
    summary:
      nextStep?.reason ||
      getCurrentAdminNextActionReason(state, workspace),
    steps,
  };
}

function getLegislativeBlockedGuidance(
  workspace,
  { reviewHref, bundleHref, artifactHref, blockerHref }
) {
  const outcomeSummary = workspace?.workflow_outcome_summary || {};
  const manualReviewCount = toSafeNumber(
    workspace?.counts?.manual_review_items,
    toSafeNumber(outcomeSummary.manual_review_queue_count, 0)
  );
  const pendingBundleApprovals = toSafeNumber(
    workspace?.counts?.pending_unreviewed_actions,
    toSafeNumber(outcomeSummary.pending_bundle_approvals, 0)
  );
  const approvedBundleActions = toSafeNumber(
    workspace?.counts?.approved_pending_actions,
    toSafeNumber(outcomeSummary.approved_bundle_actions, 0)
  );
  const seedRowCount = toSafeNumber(workspace?.approved_seed_file?.row_count, 0);
  const importWorkRelevant =
    seedRowCount > 0 ||
    ["dry_run", "apply"].includes(normalizeString(workspace?.import_report?.mode));
  const blockers = toArray(workspace?.blockers).filter(Boolean);
  const artifactStatus = workspace?.artifact_status || {};
  const missingArtifact = Object.values(artifactStatus).find((artifact) => {
    if (!artifact || artifact.exists) {
      return false;
    }
    const key = normalizeString(artifact.key);
    if (["review_bundle", "manual_review_queue", "apply_report"].includes(key)) {
      return true;
    }
    if (key === "import_report") {
      return importWorkRelevant;
    }
    return false;
  });
  const aiFailed =
    normalizeString(outcomeSummary?.ai_status?.run_status) === "failed" ||
    normalizeString(outcomeSummary?.workflow_status) === "completed_with_fallback";

  if (manualReviewCount > 0 || aiFailed) {
    return {
      reason:
        normalizeString(outcomeSummary.user_message) ||
        `${manualReviewCount} actionable legislative item(s) require manual review before the workflow can continue.`,
      href: reviewHref,
      label: "Open legislative review",
    };
  }

  if (pendingBundleApprovals > 0) {
    return {
      reason: `${pendingBundleApprovals} legislative bundle action(s) still need an explicit approve or dismiss decision.`,
      href: bundleHref,
      label: "Open bundle approval",
    };
  }

  if (approvedBundleActions > 0) {
    return {
      reason: `${approvedBundleActions} AI-approved legislative bundle action(s) are ready for apply preview.`,
      href: bundleHref,
      label: "Open legislative workflow",
    };
  }

  if (missingArtifact) {
    return {
      reason:
        normalizeString(missingArtifact.summary) ||
        `${humanizeWorkflowToken(missingArtifact.label || missingArtifact.key)} is missing.`,
      href: artifactHref,
      label: "Inspect missing artifact",
    };
  }

  if (blockers.length) {
    const artifactBlocker = blockers.find((blocker) => /missing|artifact|report/i.test(blocker));
    return {
      reason: artifactBlocker || blockers[0],
      href: artifactBlocker ? artifactHref : blockerHref,
      label: artifactBlocker ? "Inspect missing artifact" : "Inspect legislative blocker",
    };
  }

  return {
    reason: "No actionable legislative review or bundle-approval work remains.",
    href: "/admin/legislative-workflow#workflow-reports",
    label: "Open workflow report",
  };
}

export function buildLegislativeWorkflowTracker(
  workspace,
  { sessionId = "legislative:review-bundle", fallbackHref = "/admin", preferSurfaceHref = true } = {}
) {
  const state = normalizeString(workspace?.workflow_status) || "DISCOVERY_READY";
  const outcomeSummary = workspace?.workflow_outcome_summary || {};
  const counts = workspace?.counts || {};
  const actionPermissions = workspace?.action_permissions || {};
  const pipelineReport = workspace?.pipeline_report || null;
  const reviewBundle = workspace?.review_bundle || null;
  const aiReview = workspace?.ai_review || null;
  const applyReport = workspace?.apply_report || null;
  const importReport = workspace?.import_report || null;
  const seedRowCount = toSafeNumber(workspace?.approved_seed_file?.row_count, 0);
  const manualReviewCount = toSafeNumber(
    counts.manual_review_items,
    toSafeNumber(outcomeSummary.manual_review_queue_count, 0)
  );
  const pendingBundleApprovals = toSafeNumber(
    counts.pending_unreviewed_actions,
    toSafeNumber(outcomeSummary.pending_bundle_approvals, 0)
  );
  const approvedPendingActions = toSafeNumber(
    counts.approved_pending_actions,
    toSafeNumber(outcomeSummary.approved_bundle_actions, 0)
  );
  const aiTotal = Math.max(
    toSafeNumber(outcomeSummary?.ai_status?.total_items, 0),
    Array.isArray(aiReview?.items) ? aiReview.items.length : 0
  );
  const aiRunStatus = normalizeString(outcomeSummary?.ai_status?.run_status);
  const workflowStatus = normalizeString(outcomeSummary?.workflow_status);
  const hasDiscoveryArtifacts = Boolean(pipelineReport || reviewBundle || aiReview);
  const aiReviewComplete = aiTotal > 0 || Boolean(aiReview) || Boolean(reviewBundle);
  const fallbackOnly =
    aiRunStatus === "failed" ||
    workflowStatus === "completed_with_fallback" ||
    (aiTotal > 0 &&
      toSafeNumber(outcomeSummary?.ai_status?.fallback_used, 0) >= aiTotal &&
      toSafeNumber(outcomeSummary?.ai_status?.ai_success, 0) === 0);
  const hasApplyPreview = ["dry_run", "apply"].includes(normalizeString(applyReport?.mode));
  const importApplied = normalizeString(importReport?.mode) === "apply";
  const canonicalSessionId = normalizeString(sessionId) || "legislative:review-bundle";
  const sessionHref = canonicalSessionId
    ? `/admin/workflows/${encodeURIComponent(canonicalSessionId)}`
    : fallbackHref;
  const reviewHref = "/admin/legislative-workflow#manual-review-queue";
  const bundleHref = "/admin/legislative-workflow#bundle-approval";
  const reportsHref = "/admin/legislative-workflow#workflow-reports";
  const artifactHref = "/admin/legislative-workflow#artifact-state";
  const blockerHref = "/admin/legislative-workflow#workflow-blockers";
  const actionContext = {
    sessionId: canonicalSessionId,
    canonicalSessionKey: "review-bundle",
    triggerSource: "legislative_workflow_tracker",
  };
  const blockedGuidance = getLegislativeBlockedGuidance(workspace, {
    reviewHref,
    bundleHref,
    artifactHref,
    blockerHref,
  });
  const applyConfirmation = buildMutatingConfirmation(
    getOperatorActionDefinition("legislative.apply"),
    "Legislative Apply"
  );
  const importConfirmation = buildMutatingConfirmation(
    getOperatorActionDefinition("legislative.import"),
    "Legislative Import"
  );

  const runAction = buildTrackerActionConfig({
    actionId: "legislative.run",
    label: "Run legislative workflow",
    context: actionContext,
    helperText: "Runs the wrapped legislative pipeline and refreshes the canonical review bundle.",
  });
  const applyPreviewAction = buildTrackerActionConfig({
    actionId: "legislative.apply",
    label: "Run legislative pre-commit",
    context: actionContext,
    helperText: "Uses the canonical legislative apply dry-run as the validation gate before mutating apply.",
  });
  const applyAction = buildTrackerActionConfig({
    actionId: "legislative.apply",
    label: "Run legislative apply",
    input: {
      apply: true,
      yes: true,
    },
    context: actionContext,
    tone: "danger",
    helperText: "Requests the guarded legislative apply step with explicit confirmation.",
    confirmation: applyConfirmation,
  });
  const importPreviewAction = buildTrackerActionConfig({
    actionId: "legislative.import",
    label: "Run legislative import preview",
    context: actionContext,
    helperText: "Refreshes the dry-run import report before the final tracked-bill import step.",
  });
  const importAction = buildTrackerActionConfig({
    actionId: "legislative.import",
    label: "Run legislative import",
    input: {
      apply: true,
      yes: true,
    },
    context: actionContext,
    tone: "danger",
    helperText: "Requests the guarded legislative import step with explicit confirmation.",
    confirmation: importConfirmation,
  });

  const steps = [];

  const discoveryStatus = hasDiscoveryArtifacts ? "complete" : "current";
  steps.push(
    buildCurrentAdminTrackerStep({
      id: "discovery_ingestion",
      title: "Discovery / Ingestion",
      status: discoveryStatus,
      reason: hasDiscoveryArtifacts
        ? "Canonical legislative discovery artifacts are present."
        : "No legislative pipeline artifacts are present yet.",
      action: hasDiscoveryArtifacts ? null : runAction,
      href: sessionHref,
    })
  );

  let aiReviewStatus = "pending";
  let aiReviewReason = "AI review begins after the canonical legislative run starts.";
  let aiReviewAction = null;
  if (hasDiscoveryArtifacts) {
    if (aiReviewComplete) {
      aiReviewStatus = "complete";
      aiReviewReason = fallbackOnly
        ? "AI review completed with fallback-heavy results."
        : "AI review artifacts are present.";
    } else if (normalizeString(pipelineReport?.status) === "failed" || state === "BLOCKED") {
      aiReviewStatus = "blocked";
      aiReviewReason =
        normalizeString(outcomeSummary.user_message) ||
        "The legislative AI review outputs are missing after the pipeline run.";
      aiReviewAction = buildTrackerLinkConfig(blockedGuidance.href, blockedGuidance.label);
    } else {
      aiReviewStatus = "current";
      aiReviewReason = "Discovery is complete, but the legislative AI review outputs are not recorded yet.";
      aiReviewAction = runAction;
    }
  }
  steps.push(
    buildCurrentAdminTrackerStep({
      id: "ai_review",
      title: "AI Review",
      status: aiReviewStatus,
      reason: aiReviewReason,
      action: aiReviewAction,
      href: sessionHref,
    })
  );

  let manualReviewStatus = "pending";
  let manualReviewReason = "Manual review starts only when AI review produces review work.";
  let manualReviewAction = null;
  if (aiReviewComplete) {
    if (manualReviewCount > 0) {
      manualReviewStatus = fallbackOnly ? "blocked" : "current";
      manualReviewReason = fallbackOnly
        ? normalizeString(outcomeSummary.user_message) ||
          `${manualReviewCount} actionable legislative item(s) require manual review because AI fell back.`
        : `${manualReviewCount} actionable legislative item(s) require manual review.`;
      manualReviewAction = buildTrackerLinkConfig(reviewHref, "Open legislative review");
    } else {
      manualReviewStatus = "complete";
      manualReviewReason = "No actionable legislative items require manual review.";
    }
  }
  steps.push(
    buildCurrentAdminTrackerStep({
      id: "manual_review_queue",
      title: "Manual Review Queue",
      status: manualReviewStatus,
      reason: manualReviewReason,
      action: manualReviewAction,
      href: reviewHref,
    })
  );

  let bundleStatus = "pending";
  let bundleReason = "Bundle approval opens after manual-review items are resolved.";
  let bundleAction = null;
  if (aiReviewComplete && manualReviewCount === 0) {
    if (pendingBundleApprovals > 0) {
      bundleStatus = "current";
      bundleReason = `${pendingBundleApprovals} legislative bundle action(s) still need an explicit approve or dismiss decision.`;
      bundleAction = buildTrackerLinkConfig(bundleHref, "Open bundle approval");
    } else {
      bundleStatus = "complete";
      bundleReason =
        approvedPendingActions > 0
          ? `${approvedPendingActions} AI-approved legislative bundle action(s) are ready for apply preview.`
          : "No pending bundle-approval decisions remain.";
    }
  }
  steps.push(
    buildCurrentAdminTrackerStep({
      id: "bundle_approval",
      title: "Bundle Approval",
      status: bundleStatus,
      reason: bundleReason,
      action: bundleAction,
      href: bundleHref,
    })
  );

  let validationStatus = "pending";
  let validationReason = "Validation starts after manual review and bundle approval are complete.";
  let validationAction = null;
  if (aiReviewComplete && manualReviewCount === 0 && pendingBundleApprovals === 0) {
    if (state === "BLOCKED" && !hasApplyPreview) {
      validationStatus = "blocked";
      validationReason = blockedGuidance.reason;
      validationAction = buildTrackerLinkConfig(blockedGuidance.href, blockedGuidance.label);
    } else if (actionPermissions.run_apply_dry_run?.allowed) {
      validationStatus = "current";
      validationReason = "Approved bundle actions are ready for the dry-run validation gate.";
      validationAction = applyPreviewAction;
    } else if (hasApplyPreview || (approvedPendingActions === 0 && seedRowCount === 0)) {
      validationStatus = "complete";
      validationReason = hasApplyPreview
        ? "The legislative apply preview report is already present."
        : "No approved bundle actions require an apply preview.";
    }
  }
  steps.push(
    buildCurrentAdminTrackerStep({
      id: "precommit_validation",
      title: "Pre-commit / Validation",
      status: validationStatus,
      reason: validationReason,
      action: validationAction,
      href: hasApplyPreview ? reportsHref : bundleHref,
    })
  );

  let applyImportStatus = "pending";
  let applyImportReason = "Apply and import stay unavailable until the validation gate is clear.";
  let applyImportAction = null;
  if (aiReviewComplete && manualReviewCount === 0 && pendingBundleApprovals === 0) {
    if (!hasApplyPreview && state === "BLOCKED") {
      applyImportStatus = "blocked";
      applyImportReason = blockedGuidance.reason;
      applyImportAction = buildTrackerLinkConfig(blockedGuidance.href, blockedGuidance.label);
    } else if (actionPermissions.apply_bundle?.allowed) {
      applyImportStatus = "current";
      applyImportReason = "The apply preview is complete. The approved bundle is ready for guarded apply.";
      applyImportAction = applyAction;
    } else if (actionPermissions.run_import_dry_run?.allowed) {
      applyImportStatus = "current";
      applyImportReason = "Bundle apply is complete. Review the import preview before the final import.";
      applyImportAction = importPreviewAction;
    } else if (actionPermissions.apply_import?.allowed) {
      applyImportStatus = "current";
      applyImportReason = "The import preview is complete. Final import still requires explicit confirmation.";
      applyImportAction = importAction;
    } else if (importApplied || (state === "COMPLETE" && approvedPendingActions === 0 && seedRowCount === 0)) {
      applyImportStatus = "complete";
      applyImportReason = importApplied
        ? "The legislative apply/import cycle completed successfully."
        : "No legislative apply or import changes were required for this run.";
    } else if (state === "BLOCKED") {
      applyImportStatus = "blocked";
      applyImportReason = blockedGuidance.reason;
      applyImportAction = buildTrackerLinkConfig(blockedGuidance.href, blockedGuidance.label);
    }
  }
  steps.push(
    buildCurrentAdminTrackerStep({
      id: "apply_import",
      title: "Apply / Import",
      status: applyImportStatus,
      reason: applyImportReason,
      action: applyImportAction,
      href: reportsHref,
    })
  );

  let verifyStatus = "pending";
  let verifyReason = "Post-run verification becomes available after the workflow finishes.";
  if (
    importApplied ||
    (state === "COMPLETE" &&
      manualReviewCount === 0 &&
      pendingBundleApprovals === 0 &&
      approvedPendingActions === 0 &&
      !actionPermissions.run_apply_dry_run?.allowed &&
      !actionPermissions.apply_bundle?.allowed &&
      !actionPermissions.run_import_dry_run?.allowed &&
      !actionPermissions.apply_import?.allowed)
  ) {
    verifyStatus = "complete";
    verifyReason = importApplied
      ? "Workflow reports are available for post-run verification."
      : "The workflow completed without any pending manual review or apply/import work.";
  }
  steps.push(
    buildCurrentAdminTrackerStep({
      id: "post_run_verification",
      title: "Post-run Verification",
      status: verifyStatus,
      reason: verifyReason,
      action: null,
      href: reportsHref,
    })
  );

  const blockedStep = steps.find((step) => step.status === "blocked") || null;
  const currentStep = steps.find((step) => step.status === "current") || null;
  const nextStep = blockedStep || currentStep || steps.find((step) => step.status === "pending") || null;
  const completionAction = buildTrackerLinkConfig(reportsHref, "Open workflow report");
  const operatorSurfaceHref =
    nextStep?.href ||
    (preferSurfaceHref
      ? blockedStep
        ? blockedGuidance.href
        : "/admin/legislative-workflow"
      : sessionHref);

  return {
    workflowFamily: "legislative",
    sessionId: canonicalSessionId || null,
    batchName: "review-bundle",
    canonicalState: state,
    operatorSurfaceHref,
    sessionHref,
    reviewHref,
    bundleHref,
    blockerHref,
    reportsHref,
    currentStep,
    nextStep,
    blockedStep,
    completionAction,
    summary:
      nextStep?.reason ||
      blockedGuidance.reason ||
      getLegislativeNextActionReason(state, workspace),
    steps,
  };
}

function getLegislativeNextActionReason(state, workspace = null) {
  const outcomeSummary = workspace?.workflow_outcome_summary || null;
  const manualReviewCount = toSafeNumber(workspace?.counts?.manual_review_items, 0);
  const pendingBundleApprovals = toSafeNumber(
    workspace?.counts?.pending_unreviewed_actions,
    0
  );
  const approvedBundleActions = toSafeNumber(
    workspace?.counts?.approved_pending_actions,
    0
  );

  if (state === "DISCOVERY_READY") {
    return "The legislative surface is waiting for the next wrapped run to rebuild the review bundle.";
  }
  if (state === "REVIEW_READY") {
    if (outcomeSummary?.workflow_status === "completed_with_fallback") {
      return "AI review failed and results fell back to heuristics. Review the manual-review queue before trusting or applying this run.";
    }
    if (manualReviewCount > 0 && pendingBundleApprovals === 0) {
      return "The manual-review queue still contains actionable items that need human review even though no bundle approvals are pending yet.";
    }
    return pendingBundleApprovals > 0
      ? "The review bundle is ready and still needs explicit human review decisions."
      : "The legislative workflow is ready to advance into the guarded apply preview step.";
  }
  if (state === "APPLY_READY") {
    return "Legislative approvals are ready for the guarded apply preview step.";
  }
  if (approvedBundleActions > 0) {
    return `${approvedBundleActions} approved legislative bundle action(s) are ready for the guarded apply preview step.`;
  }
  if (state === "IMPORT_READY") {
    return "The apply phase is complete enough that the guarded import step is now the next operator action.";
  }
  if (state === "COMPLETE") {
    return "No actionable legislative review, apply, or import work remains.";
  }
  return "The next step is derived from the canonical legislative workflow state.";
}

function isOlderThanHours(timestamp, hours) {
  const parsed = new Date(timestamp || 0);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }
  return Date.now() - parsed.getTime() > hours * 60 * 60 * 1000;
}

function buildCurrentAdminSessionSnapshot(
  workspace,
  { relatedJobRunId = "", relatedJob = null } = {}
) {
  const batchName = workspace?.batch?.batch_name || "discovery-ready";
  const state = workspace?.batch?.stage || "DISCOVERY_READY";
  const runtime = buildRuntimeEnvelope(relatedJob);
  const sessionId = `current-admin:${batchName}`;
  const workflowTracker = buildCurrentAdminWorkflowTracker(workspace, {
    sessionId,
  });
  const recommendedActionId =
    state === "DISCOVERY_READY"
      ? "currentAdmin.run"
      : state === "REVIEW_READY"
        ? "currentAdmin.review"
        : ["QUEUE_READY", "PRECOMMIT_READY", "IMPORT_READY"].includes(state)
          ? "currentAdmin.apply"
          : state === "BLOCKED"
            ? getCurrentAdminBlockedActionId(workspace)
          : "currentAdmin.status";

  return {
    id: sessionId,
    workflowFamily: "current-admin",
    canonicalSessionKey: batchName,
    canonicalState: state,
    active: true,
    recommendedActionId,
    source: workspace?.batch?.source || "canonical_artifacts",
    startedAt: workspace?.batch?.generated_at || workspace?.latest_review?.generated_at || null,
    updatedAt:
      workspace?.batch?.last_updated ||
      workspace?.latest_validation?.generated_at ||
      workspace?.latest_import_apply?.generated_at ||
      workspace?.latest_import_dry_run?.generated_at ||
      workspace?.latest_pre_commit_review?.generated_at ||
      workspace?.latest_decision_session?.generated_at ||
      workspace?.latest_review?.generated_at ||
      new Date().toISOString(),
    title: workspace?.batch?.batch_name
      ? `Current-Admin ${workspace.batch.batch_name}`
      : "Current-Admin",
    summary: summarizeCurrentAdminState(state, workspace),
    href: `/admin/workflows/${encodeURIComponent(sessionId)}`,
    operatorSurfaceHref: workflowTracker.operatorSurfaceHref,
    relatedJobRunIds: relatedJobRunId ? [relatedJobRunId] : [],
    metadataJson: {
      executor: runtime.executor,
      execution_mode: runtime.execution_mode,
      executor_transport: runtime.executor_transport,
      execution_runtime: runtime,
      canonical_batch_name: workspace?.batch?.batch_name || null,
      canonical_paths: workspace?.batch?.paths || {},
      missing_artifacts: Object.values(workspace?.artifact_status || {})
        .filter((artifact) => !artifact?.exists)
        .map((artifact) => artifact?.label)
        .filter(Boolean),
      review_runtime: workspace?.review_runtime || null,
      blockers: workspace?.blockers || [],
      counts: {
        pendingReview: toSafeNumber(
          workspace?.counts?.pending_review ?? workspace?.counts?.pending,
          0
        ),
        approvalStyleDecisions: toSafeNumber(
          workspace?.counts?.approval_style_decisions ?? workspace?.counts?.approved,
          0
        ),
        heldForFollowup: toSafeNumber(
          workspace?.counts?.held_for_followup ?? workspace?.counts?.blocked,
          0
        ),
        importApprovedCount: toSafeNumber(
          workspace?.import_readiness?.queue_approved_for_import_count,
          0
        ),
        autoApprovedCount: toSafeNumber(
          workspace?.import_readiness?.auto_approved_item_count,
          0
        ),
        autoRejectedCount: toSafeNumber(
          workspace?.import_readiness?.auto_rejected_item_count,
          0
        ),
        queuePendingCount: toSafeNumber(
          workspace?.import_readiness?.queue_pending_count,
          0
        ),
        queueItemCount: toSafeNumber(
          workspace?.import_readiness?.queue_item_count,
          0
        ),
        queuePendingManualReviewCount: toSafeNumber(
          workspace?.import_readiness?.queue_pending_manual_review_count,
          0
        ),
        blockers: toArray(workspace?.blockers).length,
        artifacts: Object.values(workspace?.artifact_status || {}).filter((artifact) => artifact?.exists).length,
        reviewQueueItems: 0,
      },
      latest_artifacts: {
        review: workspace?.latest_review?.file_path || null,
        decision_log: workspace?.latest_decision_session?.file_path || null,
        pre_commit: workspace?.latest_pre_commit_review?.file_path || null,
        import_dry_run: workspace?.latest_import_dry_run?.file_path || null,
        import_apply: workspace?.latest_import_apply?.file_path || null,
        validation: workspace?.latest_validation?.file_path || null,
      },
      next_action_reason: getCurrentAdminNextActionReason(state, workspace),
      workflow_tracker: workflowTracker,
      next_step_label: workflowTracker.nextStep?.title || null,
      next_step_reason: workflowTracker.nextStep?.reason || null,
      next_step_href: workflowTracker.nextStep?.href || workflowTracker.operatorSurfaceHref,
      last_refreshed_at: new Date().toISOString(),
    },
  };
}

function buildLegislativeSessionSnapshot(
  workspace,
  { relatedJobRunId = "", relatedJob = null } = {}
) {
  const state = workspace?.workflow_status || "DISCOVERY_READY";
  const bundlePath = workspace?.review_bundle?.path || "equitystack_review_bundle.json";
  const runtime = buildRuntimeEnvelope(relatedJob);
  const pendingReviewCount =
    toSafeNumber(workspace?.counts?.manual_review_items, 0) +
    toSafeNumber(workspace?.counts?.pending_unreviewed_actions, 0);
  const workflowTracker = buildLegislativeWorkflowTracker(workspace, {
    sessionId: "legislative:review-bundle",
  });
  const recommendedActionId =
    state === "DISCOVERY_READY"
      ? "legislative.run"
      : state === "REVIEW_READY"
        ? "legislative.review"
        : state === "APPLY_READY"
          ? "legislative.apply"
          : state === "IMPORT_READY"
            ? "legislative.import"
            : "legislative.feedback";

  return {
    id: "legislative:review-bundle",
    workflowFamily: "legislative",
    canonicalSessionKey: path.basename(bundlePath),
    canonicalState: state,
    active: true,
    recommendedActionId,
    source: "canonical_artifacts",
    startedAt: workspace?.review_bundle?.generated_at || workspace?.pipeline_report?.generated_at || null,
    updatedAt:
      workspace?.import_report?.generated_at ||
      workspace?.repair_report?.generated_at ||
      workspace?.apply_report?.generated_at ||
      workspace?.review_bundle?.generated_at ||
      workspace?.pipeline_report?.generated_at ||
      new Date().toISOString(),
    title: "Legislative Workflow",
    summary: summarizeLegislativeState(state, workspace),
    href: `/admin/workflows/${encodeURIComponent("legislative:review-bundle")}`,
    operatorSurfaceHref: workflowTracker.operatorSurfaceHref || "/admin/legislative-workflow",
    relatedJobRunIds: relatedJobRunId ? [relatedJobRunId] : [],
    metadataJson: {
      executor: runtime.executor,
      execution_mode: runtime.execution_mode,
      executor_transport: runtime.executor_transport,
      execution_runtime: runtime,
      canonical_bundle_path: workspace?.review_bundle?.path || null,
      review_runtime: workspace?.review_runtime || null,
      blockers: workspace?.blockers || [],
      counts: {
        pendingReview: pendingReviewCount,
        approvedPendingActions: toSafeNumber(workspace?.counts?.approved_pending_actions, 0),
        manualReviewItems: toSafeNumber(workspace?.counts?.manual_review_items, 0),
        blockers: toArray(workspace?.blockers).length,
        artifacts: Object.values(workspace?.artifact_status || {}).filter((artifact) => artifact?.exists).length,
        reviewQueueItems: 0,
      },
      latest_artifacts: {
        review_bundle: workspace?.review_bundle?.path || null,
        apply_report: workspace?.apply_report?.path || null,
        repair_report: workspace?.repair_report?.path || null,
        import_report: workspace?.import_report?.path || null,
      },
      workflow_outcome_summary: workspace?.workflow_outcome_summary || null,
      workflow_tracker: workflowTracker,
      next_action_reason: workflowTracker.summary || getLegislativeNextActionReason(state, workspace),
      next_step_label: workflowTracker.nextStep?.title || null,
      next_step_href: workflowTracker.nextStep?.href || workflowTracker.operatorSurfaceHref,
      last_refreshed_at: new Date().toISOString(),
    },
  };
}

function buildCurrentAdminArtifactSnapshots(
  workspace,
  sessionRecord,
  relatedJobRunId,
  relatedJob = null
) {
  const runtime = buildRuntimeEnvelope(relatedJob);
  return Object.entries(workspace?.artifact_status || {}).map(([artifactKey, artifact]) => ({
    id: buildArtifactId({
      workflowFamily: "current-admin",
      sessionId: sessionRecord.id,
      artifactKey,
      filePath: artifact?.path,
      label: artifact?.label || artifactKey,
    }),
    sessionId: sessionRecord.id,
    workflowFamily: "current-admin",
    artifactKey,
    label: artifact?.label || artifactKey.replace(/_/g, " "),
    stage: artifact?.stage || artifactKey,
    canonicalPath: normalizeString(artifact?.path) || null,
    fileName: normalizeString(artifact?.path) ? path.basename(artifact.path) : null,
    exists: Boolean(artifact?.exists),
    generatedAt: artifact?.generated_at || null,
    source: "canonical_artifact",
    latestJobRunId: relatedJobRunId || null,
    relatedJobRunIds: relatedJobRunId ? [relatedJobRunId] : [],
    metadataJson: {
      summary: artifact?.summary || null,
      executor: runtime.executor,
      execution_mode: runtime.execution_mode,
      executor_transport: runtime.executor_transport,
      execution_runtime: runtime,
      session_key: sessionRecord.canonicalSessionKey,
      workflow_state: sessionRecord.canonicalState,
    },
  }));
}

function buildLegislativeArtifactSnapshots(
  workspace,
  sessionRecord,
  relatedJobRunId,
  relatedJob = null
) {
  const runtime = buildRuntimeEnvelope(relatedJob);
  return Object.entries(workspace?.artifact_status || {}).map(([artifactKey, artifact]) => ({
    id: buildArtifactId({
      workflowFamily: "legislative",
      sessionId: sessionRecord.id,
      artifactKey,
      filePath: artifact?.path,
      label: artifact?.label || artifactKey,
    }),
    sessionId: sessionRecord.id,
    workflowFamily: "legislative",
    artifactKey,
    label: artifact?.label || artifactKey.replace(/_/g, " "),
    stage: artifactKey,
    canonicalPath: normalizeString(artifact?.path) || null,
    fileName: normalizeString(artifact?.path) ? path.basename(artifact.path) : null,
    exists: Boolean(artifact?.exists),
    generatedAt: artifact?.generated_at || null,
    source: "canonical_artifact",
    latestJobRunId: relatedJobRunId || null,
    relatedJobRunIds: relatedJobRunId ? [relatedJobRunId] : [],
    metadataJson: {
      summary: artifact?.summary || null,
      executor: runtime.executor,
      execution_mode: runtime.execution_mode,
      executor_transport: runtime.executor_transport,
      execution_runtime: runtime,
      session_key: sessionRecord.canonicalSessionKey,
      workflow_state: sessionRecord.canonicalState,
    },
  }));
}

function buildCurrentAdminReviewQueueSnapshots(workspace, sessionRecord, artifactsByKey) {
  const reviewArtifact = artifactsByKey.review_artifact || null;
  const queueArtifact =
    artifactsByKey.pre_commit_review ||
    artifactsByKey.manual_review_queue ||
    artifactsByKey.import_dry_run ||
    null;
  const workflowTracker =
    sessionRecord?.metadataJson?.workflow_tracker ||
    buildCurrentAdminWorkflowTracker(workspace, {
      sessionId: sessionRecord?.id,
    });
  const importReadiness = workspace?.import_readiness || {};
  const blockedHref = workflowTracker.blockerHref || sessionRecord?.href || "/admin/workflows";
  const reviewHref = workflowTracker.reviewHref || "/admin/current-admin-review";
  const blockedGuidance = getCurrentAdminBlockedGuidance(workspace, {
    reviewHref,
    blockerHref: blockedHref,
  });

  const reviewItems = toArray(workspace?.review_items)
    .filter((item) => !normalizeString(item.operator_action))
    .map((item) => ({
      id: buildReviewQueueItemId([
        "current-admin",
        sessionRecord.id,
        "operator-review",
        normalizeString(item.slug) || normalizeString(item.id),
      ]),
      workflowFamily: "current-admin",
      sessionId: sessionRecord.id,
      sourceArtifactId: reviewArtifact?.id || null,
      sourceArtifactPath: reviewArtifact?.canonicalPath || null,
      queueType: "operator-review",
      state: "pending_review",
      priority: item.review_priority || "unknown",
      recommendedActionId: "currentAdmin.review",
      title: item.title || item.promise_title || item.slug || "Current-admin review item",
      detail:
        item.reasoning_summary ||
        item.review_priority_reason ||
        "Explicit manual review is still required.",
      href: reviewHref,
      active: true,
      metadataJson: {
        slug: item.slug || null,
        suggested_batch: item.suggested_batch || null,
        operator_attention_needed: Boolean(item.operator_attention_needed),
        source_artifact_key: "review_artifact",
      },
    }));

  const readinessItems = [];
  if (sessionRecord.canonicalState === "BLOCKED") {
    readinessItems.push({
      id: buildReviewQueueItemId(["current-admin", sessionRecord.id, "apply-readiness", "blocked"]),
      workflowFamily: "current-admin",
      sessionId: sessionRecord.id,
      sourceArtifactId: queueArtifact?.id || null,
      sourceArtifactPath: queueArtifact?.canonicalPath || null,
      queueType: "apply-readiness",
      state: "blocked",
      priority: "high",
      recommendedActionId: getCurrentAdminBlockedActionId(workspace),
      title: "Current-admin apply is blocked",
      detail:
        blockedGuidance.reason,
      href: blockedGuidance.href,
      active: true,
      metadataJson: {
        readiness_status: workspace?.latest_pre_commit_review?.readiness_status || "blocked",
        source_artifact_key: queueArtifact?.artifactKey || null,
      },
    });
  } else if (
    ["QUEUE_READY", "PRECOMMIT_READY"].includes(sessionRecord.canonicalState) &&
    toSafeNumber(importReadiness.queue_approved_for_import_count, 0) === 0
  ) {
    readinessItems.push({
      id: buildReviewQueueItemId(["current-admin", sessionRecord.id, "apply-readiness", "queue-approval-needed"]),
      workflowFamily: "current-admin",
      sessionId: sessionRecord.id,
      sourceArtifactId: queueArtifact?.id || null,
      sourceArtifactPath: queueArtifact?.canonicalPath || null,
      queueType: "apply-readiness",
      state: "blocked",
      priority: "high",
      recommendedActionId: "currentAdmin.review",
      title: "Current-admin queue is not approved for import",
      detail:
        normalizeString(importReadiness.readiness_explanation) ||
        "No queue items are currently approved for import.",
      href: reviewHref,
      active: true,
      metadataJson: {
        readiness_status: normalizeString(importReadiness.readiness_status) || "blocked",
        source_artifact_key: queueArtifact?.artifactKey || null,
      },
    });
  } else if (["QUEUE_READY", "PRECOMMIT_READY"].includes(sessionRecord.canonicalState)) {
    readinessItems.push({
      id: buildReviewQueueItemId(["current-admin", sessionRecord.id, "apply-readiness", "dry-run"]),
      workflowFamily: "current-admin",
      sessionId: sessionRecord.id,
      sourceArtifactId: queueArtifact?.id || null,
      sourceArtifactPath: queueArtifact?.canonicalPath || null,
      queueType: "apply-readiness",
      state: "ready_for_dry_run",
      priority: "medium",
      recommendedActionId: "currentAdmin.apply",
      title: "Current-admin dry-run is ready",
      detail:
        "The canonical queue is ready for the guarded current-admin apply path, which will rerun pre-commit and then import dry-run.",
      href: reviewHref,
      active: true,
      metadataJson: {
        readiness_status: workspace?.latest_pre_commit_review?.readiness_status || "ready",
        source_artifact_key: queueArtifact?.artifactKey || null,
      },
    });
  } else if (sessionRecord.canonicalState === "IMPORT_READY") {
    readinessItems.push({
      id: buildReviewQueueItemId(["current-admin", sessionRecord.id, "apply-readiness", "apply"]),
      workflowFamily: "current-admin",
      sessionId: sessionRecord.id,
      sourceArtifactId: queueArtifact?.id || null,
      sourceArtifactPath: queueArtifact?.canonicalPath || null,
      queueType: "apply-readiness",
      state: "ready_for_apply_confirmation",
      priority: "medium",
      recommendedActionId: "currentAdmin.apply",
      title: "Current-admin apply is waiting for explicit confirmation",
      detail:
        "A dry-run artifact exists. Mutating apply still requires the explicit apply confirmation guardrail.",
      href: reviewHref,
      active: true,
      metadataJson: {
        readiness_status: "ready_for_apply_confirmation",
        source_artifact_key: queueArtifact?.artifactKey || null,
      },
    });
  }

  return [...reviewItems, ...readinessItems];
}

function buildLegislativeReviewQueueSnapshots(workspace, sessionRecord, artifactsByKey) {
  const reviewBundleArtifact = artifactsByKey.review_bundle || null;
  const manualQueueArtifact = artifactsByKey.manual_review_queue || null;

  const bundleApprovalItems = toArray(workspace?.actionable_operator_actions || workspace?.operator_actions)
    .filter((item) => item.review_state === "actionable" && item.status === "pending" && !item.approved)
    .map((item) => ({
      id: buildReviewQueueItemId([
        "legislative",
        sessionRecord.id,
        "bundle-approval",
        normalizeString(item.action_id),
      ]),
      workflowFamily: "legislative",
      sessionId: sessionRecord.id,
      sourceArtifactId: reviewBundleArtifact?.id || null,
      sourceArtifactPath: reviewBundleArtifact?.canonicalPath || null,
      queueType: "bundle-approval",
      state: "pending_review",
      priority: item.action_priority || "Unscored",
      recommendedActionId: "legislative.review",
      title: item.future_bill_title || item.action_type || "Legislative bundle action",
      detail:
        item.rationale ||
        `Action ${item.action_type || "change"} still needs an explicit operator decision.`,
      href: "/admin/legislative-workflow#bundle-approval",
      active: true,
      metadataJson: {
        action_id: item.action_id || null,
        action_type: item.action_type || null,
        target_type: item.target_type || null,
        source_artifact_key: "review_bundle",
      },
    }));

  const manualReviewItems = toArray(workspace?.manual_review_queue?.items).map((item, index) => ({
    id: buildReviewQueueItemId([
      "legislative",
      sessionRecord.id,
      "manual-review",
      item?.future_bill_link_id != null ? String(item.future_bill_link_id) : String(index + 1),
    ]),
    workflowFamily: "legislative",
    sessionId: sessionRecord.id,
    sourceArtifactId: manualQueueArtifact?.id || null,
    sourceArtifactPath: manualQueueArtifact?.canonicalPath || null,
    queueType: "manual-review",
    state: "pending_review",
    priority: normalizeString(item.original_risk_level) || "Medium",
    recommendedActionId: "legislative.review",
    title: item.future_bill_title || item.bill_number || "Legislative manual review item",
      detail:
        normalizeString(item.llm_reasoning_short) ||
        toArray(item.why_not_auto_applied).join(" | ") ||
        "This legislative item requires manual review before the workflow can continue.",
    href: "/admin/legislative-workflow#manual-review-queue",
    active: true,
    metadataJson: {
      future_bill_link_id: item.future_bill_link_id ?? null,
      bill_number: item.bill_number || null,
      tracked_bill_title: item.tracked_bill_title || null,
      why_not_auto_applied: toArray(item.why_not_auto_applied),
      suggested_next_step: normalizeString(item.suggested_next_step) || null,
      source_artifact_key: "manual_review_queue",
    },
  }));

  return [...manualReviewItems, ...bundleApprovalItems];
}

function artifactListToMap(records) {
  return Object.fromEntries(records.map((record) => [record.artifactKey, record]));
}

async function listActiveWorkflowSessionSuppressions() {
  const payload = await readJsonSafe(WORKFLOW_SESSION_SUPPRESSIONS_PATH);
  const entries = Array.isArray(payload?.suppressions) ? payload.suppressions : [];
  return entries.filter(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      entry.active !== false &&
      normalizeString(entry.session_id)
  );
}

function suppressionMatchesSession(suppression, sessionSnapshot) {
  if (!suppression || !sessionSnapshot) {
    return false;
  }
  const sessionId = normalizeString(suppression.session_id);
  if (sessionId && sessionId === sessionSnapshot.id) {
    return true;
  }
  const workflowFamily = normalizeString(suppression.workflow_family);
  const canonicalSessionKey = normalizeString(suppression.canonical_session_key);
  if (workflowFamily !== sessionSnapshot.workflowFamily) {
    return false;
  }
  if (!sessionId && !canonicalSessionKey) {
    return true;
  }
  return canonicalSessionKey === sessionSnapshot.canonicalSessionKey;
}

function hasNewerArtifactThanSuppression(artifactSnapshots = [], archivedAt = "") {
  const archivedAtIso = toIsoTimestamp(archivedAt);
  if (!archivedAtIso) {
    return false;
  }
  const archivedAtTime = new Date(archivedAtIso).getTime();
  return artifactSnapshots.some((artifact) => {
    const generatedAt = toIsoTimestamp(artifact?.generatedAt);
    return generatedAt && new Date(generatedAt).getTime() > archivedAtTime;
  });
}

async function findActiveWorkflowSessionSuppression({
  sessionSnapshot,
  artifactSnapshots,
  relatedJobRunId = "",
}) {
  if (normalizeString(relatedJobRunId)) {
    return null;
  }
  const suppressions = await listActiveWorkflowSessionSuppressions();
  return (
    suppressions.find((suppression) => {
      if (!suppressionMatchesSession(suppression, sessionSnapshot)) {
        return false;
      }
      if (hasNewerArtifactThanSuppression(artifactSnapshots, suppression.archived_at)) {
        return false;
      }
      return true;
    }) || null
  );
}

async function suppressWorkflowSessionDerivedState(sessionSnapshot, suppression) {
  const existing = await getWorkflowSessionRecord(sessionSnapshot.id);
  const now = new Date().toISOString();
  await upsertWorkflowSessionRecord({
    ...(existing || sessionSnapshot),
    id: sessionSnapshot.id,
    workflowFamily: sessionSnapshot.workflowFamily,
    canonicalSessionKey: sessionSnapshot.canonicalSessionKey,
    canonicalState: sessionSnapshot.canonicalState,
    active: false,
    updatedAt: now,
    metadataJson: {
      ...((existing || sessionSnapshot).metadataJson || {}),
      suppressed_by_cleanup: {
        session_id: normalizeString(suppression.session_id),
        archived_at: normalizeString(suppression.archived_at) || null,
        archived_reason: normalizeString(suppression.archived_reason) || null,
        matched_rules: toArray(suppression.matched_rules),
        suppressed_at: now,
      },
    },
  });
  await deactivateSessionReviewQueueItems(sessionSnapshot.id, []);
}

export async function getWorkflowWorkspaceSnapshot(workflowFamily) {
  if (workflowFamily === "current-admin") {
    return getCurrentAdministrationOperatorWorkspace();
  }
  if (workflowFamily === "legislative") {
    return getLegislativeWorkflowWorkspace();
  }
  throw new Error(`Unsupported workflow family: ${workflowFamily}`);
}

function shouldSuppressIdleBaselineState({
  workflowFamily,
  sessionSnapshot,
  artifactSnapshots,
  workspace,
  relatedJobRunId = "",
}) {
  if (normalizeString(relatedJobRunId)) {
    return false;
  }

  const hasExistingArtifacts = artifactSnapshots.some((artifact) => artifact.exists);
  if (hasExistingArtifacts) {
    return false;
  }

  if (workflowFamily === "current-admin") {
    const pendingReview = toSafeNumber(workspace?.counts?.pending, 0);
    const hasReviewArtifacts =
      Boolean(workspace?.latest_review) ||
      Boolean(workspace?.latest_decision_session) ||
      Boolean(workspace?.latest_pre_commit_review) ||
      Boolean(workspace?.latest_import_dry_run) ||
      Boolean(workspace?.latest_import_apply) ||
      Boolean(workspace?.latest_validation);

    return (
      sessionSnapshot.canonicalState === "DISCOVERY_READY" &&
      sessionSnapshot.source === "canonical_batch_file" &&
      pendingReview === 0 &&
      !hasReviewArtifacts
    );
  }

  if (workflowFamily === "legislative") {
    const actionableActions = toSafeNumber(workspace?.counts?.actionable_actions, 0);
    const pendingReview = toSafeNumber(workspace?.counts?.pending_unreviewed_actions, 0);
    const hasAnyArtifacts =
      Boolean(workspace?.pipeline_report) ||
      Boolean(workspace?.review_bundle) ||
      Boolean(workspace?.ai_review) ||
      Boolean(workspace?.manual_review_queue) ||
      Boolean(workspace?.partial_suggestions) ||
      Boolean(workspace?.candidate_discovery) ||
      Boolean(workspace?.apply_report) ||
      Boolean(workspace?.import_report) ||
      toSafeNumber(workspace?.approved_seed_file?.row_count, 0) > 0;

    return (
      sessionSnapshot.canonicalState === "DISCOVERY_READY" &&
      actionableActions === 0 &&
      pendingReview === 0 &&
      !hasAnyArtifacts
    );
  }

  return false;
}

async function clearWorkflowFamilyDerivedState(workflowFamily) {
  await deleteSystemSignalsByWorkflowFamily(workflowFamily);
  await deleteReviewQueueRecordsByWorkflowFamily(workflowFamily);
  await deleteArtifactRecordsByWorkflowFamily(workflowFamily);
  await deleteWorkflowSessionRecordsByWorkflowFamily(workflowFamily);
}

export async function refreshWorkflowFamilyState(
  workflowFamily,
  { relatedJobRunId = "", refreshReason = "manual_refresh" } = {}
) {
  const relatedJob = relatedJobRunId ? await getJobRun(relatedJobRunId).catch(() => null) : null;
  const workspace = await getWorkflowWorkspaceSnapshot(workflowFamily);
  const sessionSnapshot =
    workflowFamily === "current-admin"
      ? buildCurrentAdminSessionSnapshot(workspace, { relatedJobRunId, relatedJob })
      : buildLegislativeSessionSnapshot(workspace, { relatedJobRunId, relatedJob });
  const artifactSnapshots =
    workflowFamily === "current-admin"
      ? buildCurrentAdminArtifactSnapshots(workspace, sessionSnapshot, relatedJobRunId, relatedJob)
      : buildLegislativeArtifactSnapshots(workspace, sessionSnapshot, relatedJobRunId, relatedJob);

  if (
    shouldSuppressIdleBaselineState({
      workflowFamily,
      sessionSnapshot,
      artifactSnapshots,
      workspace,
      relatedJobRunId,
    })
  ) {
    await clearWorkflowFamilyDerivedState(workflowFamily);
    return {
      session: null,
      workspace,
      artifacts: [],
      reviewQueue: [],
      suppressed: true,
    };
  }

  const cleanupSuppression = await findActiveWorkflowSessionSuppression({
    sessionSnapshot,
    artifactSnapshots,
    relatedJobRunId,
  });
  if (cleanupSuppression) {
    await suppressWorkflowSessionDerivedState(sessionSnapshot, cleanupSuppression);
    return {
      session: null,
      workspace: null,
      artifacts: [],
      reviewQueue: [],
      suppressed: true,
      suppression: cleanupSuppression,
    };
  }

  const sessionRecord = await upsertWorkflowSessionRecord(sessionSnapshot, { relatedJobRunId });
  await markWorkflowFamilySessionsInactive(workflowFamily, sessionRecord.id);

  const artifacts = await Promise.all(
    artifactSnapshots
      .map((record) => ({ ...record, sessionId: sessionRecord.id }))
      .map((record) => upsertArtifactRecord(record, { relatedJobRunId }))
  );
  const artifactMap = artifactListToMap(artifacts);

  const reviewQueueSnapshots =
    workflowFamily === "current-admin"
      ? buildCurrentAdminReviewQueueSnapshots(workspace, sessionRecord, artifactMap)
      : buildLegislativeReviewQueueSnapshots(workspace, sessionRecord, artifactMap);

  const reviewQueue = await Promise.all(reviewQueueSnapshots.map((item) => upsertReviewQueueItem(item)));
  await deactivateSessionReviewQueueItems(
    sessionRecord.id,
    reviewQueue.map((item) => item.id)
  );

  const refreshedSession = await upsertWorkflowSessionRecord(
    {
      ...sessionRecord,
      metadataJson: {
        ...sessionRecord.metadataJson,
        counts: {
          ...(sessionRecord.metadataJson?.counts || {}),
          artifacts: artifacts.filter((artifact) => artifact.exists).length,
          reviewQueueItems: reviewQueue.length,
        },
        last_refresh_reason: refreshReason,
        last_refreshed_at: new Date().toISOString(),
      },
    },
    { relatedJobRunId }
  );

  return {
    session: enrichSessionRecord(refreshedSession),
    workspace,
    artifacts: artifacts.map(enrichArtifactRecord),
    reviewQueue: reviewQueue.map(enrichReviewQueueItem),
  };
}

export async function refreshOperatorState() {
  const [currentAdmin, legislative] = await Promise.all([
    refreshWorkflowFamilyState("current-admin", { refreshReason: "operator_state_refresh" }),
    refreshWorkflowFamilyState("legislative", { refreshReason: "operator_state_refresh" }),
  ]);

  return [currentAdmin, legislative];
}

export async function listWorkflowSessions() {
  const refreshedFamilies = await refreshOperatorState();
  const records = await listWorkflowSessionRecords({ activeOnly: true });
  const refreshedSessions = refreshedFamilies
    .map((entry) => enrichSessionRecord(entry?.session || null))
    .filter(Boolean);
  const merged = new Map();

  for (const session of [...records.map(enrichSessionRecord), ...refreshedSessions]) {
    if (!session?.id) {
      continue;
    }
    const existing = merged.get(session.id);
    const existingTime = new Date(existing?.updatedAt || existing?.startedAt || 0).getTime() || 0;
    const nextTime = new Date(session.updatedAt || session.startedAt || 0).getTime() || 0;
    if (!existing || nextTime >= existingTime) {
      merged.set(session.id, session);
    }
  }

  return [...merged.values()]
    .filter((session) => session.active !== false)
    .sort((left, right) => {
      const rightTime = new Date(right.updatedAt || right.startedAt || 0).getTime() || 0;
      const leftTime = new Date(left.updatedAt || left.startedAt || 0).getTime() || 0;
      return rightTime - leftTime;
    });
}

async function listSessionArtifacts(sessionId) {
  return (await listArtifactRecords({ sessionId })).map(enrichArtifactRecord);
}

async function listSessionReviewQueue(sessionId) {
  return (await listReviewQueueRecords({ sessionId })).map(enrichReviewQueueItem);
}

async function listRelatedJobRuns(sessionId) {
  const jobs = await listJobRuns({ limit: 200 });
  return jobs.filter((job) => toArray(job.sessionIds).includes(sessionId));
}

export async function getWorkflowSessionDetail(sessionId) {
  const normalized = decodeSessionId(sessionId);
  const stored = await getWorkflowSessionRecord(normalized);
  const workflowFamily =
    stored?.workflowFamily ||
    (normalized.startsWith("current-admin:") ? "current-admin" : normalized.startsWith("legislative:") ? "legislative" : "");
  if (!workflowFamily) {
    throw new Error(`Workflow session ${sessionId} was not found.`);
  }

  const shouldRefresh = !stored || stored.active;
  const refreshed = shouldRefresh
    ? await refreshWorkflowFamilyState(workflowFamily, {
        refreshReason: "session_detail",
      })
    : null;
  const sessionRecord = await getWorkflowSessionRecord(normalized);
  const session = enrichSessionRecord(sessionRecord || refreshed?.session);
  if (!session) {
    throw new Error(`Workflow session ${sessionId} was not found.`);
  }

  const [artifacts, reviewQueueItems, relatedJobs] = await Promise.all([
    listSessionArtifacts(session.id),
    listSessionReviewQueue(session.id),
    listRelatedJobRuns(session.id),
  ]);
  const currentAdminWorkflowTracker =
    session.workflowFamily === "current-admin"
      ? buildCurrentAdminWorkflowTracker(refreshed?.workspace || null, {
          sessionId: session.id,
        })
      : null;
  const sessionSummary = buildSessionAssistSummary({
    session,
    artifacts,
    reviewQueueItems,
    relatedJobs,
  });

  return {
    session,
    sessionSummary,
    workspace: session.active ? refreshed?.workspace || null : null,
    artifacts,
    reviewQueueItems,
    relatedJobs,
    metadata: {
      workflowFamily: session.workflowFamily,
      canonicalSessionKey: session.canonicalSessionKey,
      canonicalState: session.canonicalState,
      recommendedActionId: session.recommendedActionId,
      executionMode:
        session.execution?.execution_mode ||
        session.metadataJson?.execution_mode ||
        EXECUTION_MODES.LOCAL_CLI,
      executor:
        session.execution?.executor ||
        session.metadataJson?.execution_runtime?.executor ||
        session.metadataJson?.executor ||
        getExecutorMetadata(),
      source: session.source,
      startedAt: session.startedAt,
      updatedAt: session.updatedAt,
      reviewRuntime: session.metadataJson?.review_runtime || null,
      assist: sessionSummary.assist,
      currentAdminWorkflowTracker:
        currentAdminWorkflowTracker || session.workflowTracker || null,
    },
  };
}

export async function listArtifacts() {
  await refreshOperatorState();
  return (await listArtifactRecords()).map(enrichArtifactRecord);
}

export async function getArtifactDetail(artifactId) {
  const records = await listArtifacts();
  const exact = records.find((artifact) => artifact.id === artifactId);
  if (exact) {
    return exact;
  }

  let decoded = "";
  try {
    decoded = fromBase64Id(artifactId);
  } catch {
    decoded = "";
  }
  const fallback = records.find(
    (artifact) => decoded && artifact.canonicalPath && decoded.includes(artifact.canonicalPath)
  );
  if (fallback) {
    return fallback;
  }

  throw new Error(`Artifact ${artifactId} was not found.`);
}

export async function listReviewQueueItems() {
  await refreshOperatorState();
  return (await listReviewQueueRecords()).map(enrichReviewQueueItem);
}

function inferCurrentAdminBatchFromPath(value) {
  const text = normalizeString(value);
  if (!text) {
    return "";
  }

  const fileName = path.basename(text);
  for (const suffix of CURRENT_ADMIN_ARTIFACT_SUFFIXES) {
    if (fileName.endsWith(suffix)) {
      return fileName.slice(0, -suffix.length);
    }
  }

  return fileName.replace(/\.json$/, "");
}

export function resolveWorkflowSessionAssociation(action, input = {}) {
  const workflowFamily = action?.workflowFamily || "";
  if (workflowFamily === "current-admin") {
    const explicitBatchName =
      normalizeString(input.batchName) ||
      inferCurrentAdminBatchFromPath(input.input) ||
      inferCurrentAdminBatchFromPath(input.review) ||
      inferCurrentAdminBatchFromPath(input.decisionFile);
    if (explicitBatchName) {
      return [`current-admin:${explicitBatchName}`];
    }
  }

  if (workflowFamily === "legislative") {
    return ["legislative:review-bundle"];
  }

  return [];
}

export async function captureWorkflowFamilyArtifactSnapshot(workflowFamily) {
  return refreshWorkflowFamilyState(workflowFamily, {
    refreshReason: "pre_run_snapshot",
  }).catch(() => ({ session: null, workspace: null, artifacts: [], reviewQueue: [] }));
}

export function diffArtifacts(before = [], after = []) {
  const beforeByKey = new Map(
    before.map((artifact) => [artifact.canonicalPath || artifact.artifactKey || artifact.id, artifact])
  );

  return after.filter((artifact) => {
    const previous = beforeByKey.get(artifact.canonicalPath || artifact.artifactKey || artifact.id);
    if (!previous) {
      return true;
    }
    return (
      normalizeString(previous.generatedAt) !== normalizeString(artifact.generatedAt) ||
      Boolean(previous.exists) !== Boolean(artifact.exists) ||
      normalizeString(previous.summary) !== normalizeString(artifact.summary) ||
      normalizeString(previous.canonicalPath) !== normalizeString(artifact.canonicalPath)
    );
  });
}

export async function getCommandCenterSummary() {
  const [currentAdminRefresh, legislativeRefresh] = await refreshOperatorState();
  const [sessions, reviewQueue, allJobs, artifacts, rawSchedules, deepIntegrityReport] = await Promise.all([
    listWorkflowSessionRecords({ activeOnly: true }),
    listReviewQueueRecords(),
    listJobRuns({ limit: 200 }),
    listArtifactRecords(),
    listScheduleRecords(),
    getOperatorVerificationReport("deep-integrity"),
  ]);
  const recentJobs = allJobs.slice(0, 20).map((job) => ({
    ...job,
    failure: job.metadataJson?.failure || null,
    schedule: job.metadataJson?.scheduling || null,
    execution: job.metadataJson?.execution_runtime || {
      execution_mode: job.metadataJson?.execution_mode || EXECUTION_MODES.LOCAL_CLI,
      executor: job.metadataJson?.executor || getExecutorMetadata(),
    },
  }));
  const schedules = rawSchedules.map((schedule) => enrichScheduleRecord(schedule, allJobs)).filter(Boolean);
  const enrichedSessions = sessions.map(enrichSessionRecord);
  const enrichedReviewQueue = reviewQueue.map(enrichReviewQueueItem);
  const enrichedArtifacts = artifacts.map(enrichArtifactRecord);
  const currentAdminSession =
    enrichedSessions.find((session) => session.workflowFamily === "current-admin") || null;
  const currentAdminWorkflowTracker = currentAdminRefresh?.suppressed
    ? null
    : currentAdminSession?.workflowTracker ||
      (currentAdminSession
        ? buildCurrentAdminWorkflowTracker(currentAdminRefresh?.workspace || null, {
            sessionId: currentAdminSession.id,
          })
        : null);
  const legislativeSession =
    enrichedSessions.find((session) => session.workflowFamily === "legislative") || null;
  const legislativeWorkflowTracker = legislativeRefresh?.suppressed
    ? null
    : legislativeSession?.workflowTracker ||
      (legislativeSession
        ? buildLegislativeWorkflowTracker(legislativeRefresh?.workspace || null, {
            sessionId: legislativeSession.id,
          })
        : null);

  const featuredActionIds = [
    "currentAdmin.run",
    "currentAdmin.review",
    "currentAdmin.apply",
    "legislative.run",
    "legislative.review",
    "legislative.apply",
  ];

  const pendingReviewItems = enrichedReviewQueue.filter((item) => item.state === "pending_review");
  const missingArtifacts = enrichedArtifacts.filter((artifact) =>
    isBlockingMissingArtifact(artifact, {
      legislativeWorkspace: legislativeRefresh?.workspace || null,
    })
  );
  const recentFailures = recentJobs.filter((job) => ["failed", "blocked"].includes(job.status)).slice(0, 5);
  const staleSessions = enrichedSessions.filter((session) => isOlderThanHours(session.updatedAt, 24));
  const staleDryRuns = enrichedSessions.filter(
    (session) => session.canonicalState === "IMPORT_READY" && isOlderThanHours(session.updatedAt, 24)
  );
  const sessionCards = sortPriorityItems(
    enrichedSessions.map((session) =>
      buildSessionSnapshotCard(session, {
        jobs: allJobs,
        artifacts: enrichedArtifacts,
        schedules,
        legislativeWorkspace: legislativeRefresh?.workspace || null,
      })
    )
  );
  const upcomingSchedules = schedules
    .filter((schedule) => schedule.enabled && normalizeString(schedule.nextRunAt))
    .sort((left, right) => new Date(left.nextRunAt || 0).getTime() - new Date(right.nextRunAt || 0).getTime())
    .slice(0, 5);
  const overdueSchedules = schedules.filter((schedule) => schedule.overdue).slice(0, 5);
  const recentScheduledFailures = schedules
    .filter((schedule) => ["failed", "blocked", "attention"].includes(schedule.status))
    .slice(0, 5);
  const schedulesNeedingAttention = schedules
    .filter((schedule) => {
      const sessionId = schedule.lastJob?.sessionIds?.[0];
      const session = enrichedSessions.find((item) => item.id === sessionId);
      return session && (session.activeReviewQueueCount > 0 || session.blockerCount > 0);
    })
    .slice(0, 5);

  const alerts = [
    ...enrichedSessions
      .filter((session) => session.blockerCount > 0)
      .map((session) => ({
        workflowFamily: session.workflowFamily,
        title: `${session.title} has blockers`,
        summary: session.summary,
        href: session.href,
        recommendedActionId: session.recommendedActionId,
      })),
    ...pendingReviewItems.slice(0, 6).map((item) => ({
      workflowFamily: item.workflowFamily,
      title: item.title,
      summary: item.detail,
      href: item.href,
      recommendedActionId: item.recommendedActionId,
    })),
  ];

  const nextActionsByWorkflowFamily = Object.fromEntries(
    enrichedSessions.map((session) => [
      session.workflowFamily,
      {
        sessionId: session.id,
        canonicalState: session.canonicalState,
        recommendedActionId: session.recommendedActionId,
        recommendedAction: getOperatorActionDefinition(session.recommendedActionId),
        reason: session.metadataJson?.next_action_reason || null,
      },
    ])
  );

  const blockedSessionItems = sessionCards
    .filter((session) => session.canonicalState === "BLOCKED" || session.blockerCount > 0)
    .map((session) =>
      buildDashboardItem({
        id: `blocked-session:${session.id}`,
        bucketId: "blockedNeedsFix",
        kind: "session",
        workflowFamily: session.workflowFamily,
        title: session.title,
        summary:
          session.blockerPreview[0] ||
          session.summary ||
          "This active session is blocked and needs inspection before it can proceed.",
        priorityScore: session.workflowFamily === "current-admin" ? 95 : 88,
        priorityReason:
          session.workflowFamily === "current-admin"
            ? "Blocked current-admin pipeline state stops the guarded apply path and should be checked early."
            : "Blocked workflow sessions should be inspected before lower-priority ready work.",
        href: session.href,
        status: session.canonicalState,
        actionId: session.recommendedActionId || "currentAdmin.status",
        actionContext: {
          sessionId: session.id,
          canonicalSessionKey: session.canonicalSessionKey,
          triggerSource: "command_center_blocked_session",
        },
        quickActionLabel: "Run next safe action",
        quickActionHelperText:
          session.metadataJson?.next_action_reason || "Re-run the safe next step to inspect current blocking conditions.",
        tone: "default",
        metadata: {
          sourceId: session.id,
          blockerCount: session.blockerCount,
          missingArtifactsCount: session.missingArtifactsCount,
        },
      })
    );

  const awaitingHumanReviewItems = enrichedReviewQueue
    .filter((item) => ["pending_review", "ready_for_apply_confirmation"].includes(item.state))
    .map((item) => {
      const isLegislativeReview = item.workflowFamily === "legislative" && item.queueType === "bundle-approval";
      const isCurrentAdminConfirmation = item.state === "ready_for_apply_confirmation";
      const quickActions =
        item.workflowFamily === "current-admin" && isCurrentAdminConfirmation
          ? {
              actionId: "currentAdmin.apply",
              input: { apply: true, yes: true },
              label: "Apply (final)",
              tone: "danger",
              confirmation: buildMutatingConfirmation(
                getOperatorActionDefinition("currentAdmin.apply"),
                "Current-admin apply"
              ),
            }
          : {
              actionId: item.recommendedActionId,
              input: {},
              label:
                isLegislativeReview
                  ? "Open review bundle"
                  : item.workflowFamily === "current-admin"
                    ? "Run current-admin review"
                    : "Open workflow",
              tone: "primary",
              confirmation: null,
            };

      return buildDashboardItem({
        id: `review-item:${item.id}`,
        bucketId: "awaitingHumanReview",
        kind: "reviewQueue",
        workflowFamily: item.workflowFamily,
        title: item.title,
        summary: item.explanation?.whyExists || item.detail,
        priorityScore:
          isCurrentAdminConfirmation
            ? 89
            : isLegislativeReview
              ? 87
              : 82,
        priorityReason: isCurrentAdminConfirmation
          ? "A current-admin dry-run is complete and the explicit apply checkpoint is waiting on the operator."
          : isLegislativeReview
            ? "Pending legislative bundle review is a high-priority human checkpoint."
            : "This review queue item needs an explicit operator decision.",
        href: item.href || `/admin/workflows/${encodeURIComponent(item.sessionId)}`,
        status: item.state,
        actionId: quickActions.actionId,
        actionInput: quickActions.input,
        actionContext: {
          sessionId: item.sessionId,
          artifactId: item.sourceArtifactId || null,
          artifactPath: item.sourceArtifactPath || null,
          queueItemId: item.id,
          queueType: item.queueType,
          triggerSource: "command_center_review_bucket",
        },
        quickActionLabel: quickActions.label,
        quickActionHelperText: item.explanation?.expectedAction || "Use the canonical workflow surface for this human checkpoint.",
        tone: quickActions.tone,
        confirmation: quickActions.confirmation,
        metadata: {
          sourceId: item.id,
          queueType: item.queueType,
          riskLevel: item.riskLevel,
        },
      });
    });

  const readyToRunItems = [
    ...enrichedReviewQueue
      .filter((item) => item.state === "ready_for_dry_run")
      .map((item) =>
        buildDashboardItem({
          id: `ready-queue:${item.id}`,
          bucketId: "readyToRun",
          kind: "reviewQueue",
          workflowFamily: item.workflowFamily,
          title: item.title,
          summary: item.detail,
          priorityScore: 76,
          priorityReason:
            "This session is ready for a safe dry-run path and can be advanced now without mutating data.",
          href: item.href || `/admin/workflows/${encodeURIComponent(item.sessionId)}`,
          status: item.state,
          actionId: item.recommendedActionId,
          actionContext: {
            sessionId: item.sessionId,
            artifactId: item.sourceArtifactId || null,
            artifactPath: item.sourceArtifactPath || null,
            queueItemId: item.id,
            queueType: item.queueType,
            triggerSource: "command_center_ready_bucket",
          },
          quickActionLabel: "Apply dry-run",
          quickActionHelperText: "Runs the guarded dry-run path first.",
          tone: "primary",
          metadata: {
            sourceId: item.id,
            queueType: item.queueType,
          },
        })
      ),
    ...sessionCards
      .filter(
        (session) =>
          session.canonicalState !== "BLOCKED" &&
          session.recommendedActionId &&
          session.reviewPendingCount === 0 &&
          session.blockerCount === 0 &&
          !(
            session.workflowFamily === "legislative" &&
            session.canonicalState === "COMPLETE" &&
            /no actionable legislative review, apply, or import work remains/i.test(
              normalizeString(session.metadataJson?.next_action_reason || session.summary)
            )
          )
      )
      .map((session) =>
        buildDashboardItem({
          id: `ready-session:${session.id}`,
          bucketId: "readyToRun",
          kind: "session",
          workflowFamily: session.workflowFamily,
          title: session.title,
          summary:
            session.metadataJson?.next_action_reason ||
            session.summary,
          priorityScore: session.workflowFamily === "current-admin" ? 68 : 64,
          priorityReason:
            "This active session has a recommended next action and no visible blocker in the control plane.",
          href: session.href,
          status: session.canonicalState,
          actionId: session.recommendedActionId,
          actionContext: {
            sessionId: session.id,
            canonicalSessionKey: session.canonicalSessionKey,
            triggerSource: "command_center_ready_session",
          },
          quickActionLabel: "Run next safe action",
          quickActionHelperText:
            session.metadataJson?.next_action_reason ||
            "Advance this session through the next safe broker-backed step.",
          tone: "primary",
          metadata: {
            sourceId: session.id,
            linkedScheduleId: session.linkedSchedule?.id || null,
          },
        })
      ),
  ];

  const recentFailureItems = recentFailures.map((job) =>
    buildDashboardItem({
      id: `failure:${job.id}`,
      bucketId: "recentFailures",
      kind: "job",
      workflowFamily: job.workflowFamily,
      title: job.actionTitle,
      summary: job.summary || "A recent broker-backed job failed.",
      priorityScore: isSafeRetryableJob(job) ? 74 : 62,
      priorityReason: isSafeRetryableJob(job)
        ? "This recent failure can be retried safely through the broker."
        : "This failure needs inspection before retry because it was mutating or requires operator review.",
      href: `/admin/jobs/${encodeURIComponent(job.id)}`,
      status: job.status,
      actionId: isSafeRetryableJob(job) ? job.actionId : "",
      actionInput: isSafeRetryableJob(job) ? job.input || {} : {},
      actionContext: isSafeRetryableJob(job) ? job.metadataJson?.action_context || {} : {},
      quickActionLabel: "Retry failed job",
      quickActionHelperText: job.failure?.nextSafeActionTitle
        ? `Next safe action after inspection: ${job.failure.nextSafeActionTitle}.`
        : "Retry this broker-backed action with the same validated context.",
      tone: "default",
      metadata: {
        sourceId: job.id,
        jobId: job.id,
        likelySource: job.failure?.likelySource || null,
        nextSafeActionTitle: job.failure?.nextSafeActionTitle || null,
      },
    })
  );

  const scheduleItems = [
    ...overdueSchedules.map((schedule) =>
      buildDashboardItem({
        id: `schedule-overdue:${schedule.id}`,
        bucketId: "scheduledSoon",
        kind: "schedule",
        workflowFamily: schedule.workflowFamily,
        title: schedule.title,
        summary:
          schedule.lastResultSummary ||
          "This schedule is overdue and has not created its next preparation run yet.",
        priorityScore: 66,
        priorityReason:
          "Overdue schedules can hide unattended preparation work and should be checked in the morning routine.",
        href: "/admin/schedules",
        status: schedule.status,
        metadata: {
          sourceId: schedule.id,
          scheduleId: schedule.id,
          nextRunAt: schedule.nextRunAt,
          executionMode: schedule.executionMode,
        },
      })
    ),
    ...upcomingSchedules.map((schedule) =>
      buildDashboardItem({
        id: `schedule-upcoming:${schedule.id}`,
        bucketId: "scheduledSoon",
        kind: "schedule",
        workflowFamily: schedule.workflowFamily,
        title: schedule.title,
        summary: `Next due at ${schedule.nextRunAt || "unknown time"}.`,
        priorityScore: 40,
        priorityReason:
          "This schedule will likely prepare more workflow work soon, but it is not yet urgent.",
        href: "/admin/schedules",
        status: schedule.status,
        metadata: {
          sourceId: schedule.id,
          scheduleId: schedule.id,
          nextRunAt: schedule.nextRunAt,
          executionMode: schedule.executionMode,
        },
      })
    ),
  ];

  const blockedArtifactItems = missingArtifacts.slice(0, 8).map((artifact) =>
    buildDashboardItem({
      id: `artifact:${artifact.id}`,
      bucketId: "blockedNeedsFix",
      kind: "artifact",
      workflowFamily: artifact.workflowFamily,
      title: `${artifact.label} is missing`,
      summary: "A canonical artifact expected by the operator surface is missing and may block progress.",
      priorityScore: 70,
      priorityReason:
        "Missing canonical artifacts can block session progression or hide expected workflow evidence.",
      href: `/admin/workflows/${encodeURIComponent(artifact.sessionId)}`,
      status: artifact.exists ? "present" : "missing",
      metadata: {
        sourceId: artifact.id,
        canonicalPath: artifact.canonicalPath,
      },
    })
  );

  const bucketItems = {
    needsAttention: sortPriorityItems([
      ...blockedSessionItems,
      ...awaitingHumanReviewItems.filter((item) => item.priorityScore >= 87),
      ...recentFailureItems.filter((item) => item.priorityScore >= 70),
      ...scheduleItems.filter((item) => item.priorityScore >= 60),
    ]).slice(0, 8),
    awaitingHumanReview: sortPriorityItems(awaitingHumanReviewItems).slice(0, 8),
    readyToRun: sortPriorityItems(readyToRunItems).slice(0, 8),
    blockedNeedsFix: sortPriorityItems([...blockedSessionItems, ...blockedArtifactItems]).slice(0, 8),
    scheduledSoon: sortPriorityItems(scheduleItems).slice(0, 8),
    recentFailures: sortPriorityItems(recentFailureItems).slice(0, 8),
  };

  const prioritizedItems = sortPriorityItems(
    Object.values(bucketItems).flat()
  ).slice(0, 12);
  const dailyRoutine = buildDailyRoutine({
    blockedSessionItems: [...blockedSessionItems, ...blockedArtifactItems],
    awaitingHumanReviewItems,
    recentFailureItems,
    readyToRunItems,
    scheduleItems,
  });

  const signalRecords = [
    ...enrichedSessions
      .filter((session) => session.blockerCount > 0)
      .map((session) => ({
        id: buildSystemSignalId(["session-blocker", session.id]),
        workflowFamily: session.workflowFamily,
        signalType: "session_blocker",
        severity: "warning",
        state: "open",
        title: `${session.title} has blockers`,
        summary: session.summary,
        href: session.href,
        active: true,
        sessionId: session.id,
        metadataJson: {
          canonical_state: session.canonicalState,
          blocker_count: session.blockerCount,
        },
      })),
    ...missingArtifacts.slice(0, 25).map((artifact) => ({
      id: buildSystemSignalId(["missing-artifact", artifact.id]),
      workflowFamily: artifact.workflowFamily,
      signalType: "missing_artifact",
      severity: "warning",
      state: "open",
      title: `${artifact.label} is missing`,
      summary: "A canonical artifact expected by the operator surface is currently missing.",
      href: `/admin/workflows/${encodeURIComponent(artifact.sessionId)}`,
      active: true,
      sessionId: artifact.sessionId,
      artifactId: artifact.id,
      metadataJson: {
        artifact_key: artifact.artifactKey,
        canonical_path: artifact.canonicalPath,
      },
    })),
    ...recentFailures.slice(0, 10).map((job) => ({
      id: buildSystemSignalId(["job-failure", job.id]),
      workflowFamily: job.workflowFamily,
      signalType: "job_failure",
      severity: job.status === "blocked" ? "warning" : "error",
      state: "open",
      title: `${job.actionTitle} ${job.status}`,
      summary: job.summary || "A broker-backed operator job failed.",
      href: `/admin/jobs/${encodeURIComponent(job.id)}`,
      active: true,
      sessionId: job.sessionIds?.[0] || null,
      jobRunId: job.id,
      metadataJson: {
        status: job.status,
        action_id: job.actionId,
      },
    })),
    ...staleSessions.map((session) => ({
      id: buildSystemSignalId(["stale-session", session.id]),
      workflowFamily: session.workflowFamily,
      signalType: "stale_session",
      severity: "warning",
      state: "open",
      title: `${session.title} has stale workflow state`,
      summary: "This active workflow session has not refreshed recently and should be inspected before assuming it is idle.",
      href: session.href,
      active: true,
      sessionId: session.id,
      metadataJson: {
        canonical_state: session.canonicalState,
        updated_at: session.updatedAt,
      },
    })),
    ...staleDryRuns.map((session) => ({
      id: buildSystemSignalId(["stale-dry-run", session.id]),
      workflowFamily: session.workflowFamily,
      signalType: "stale_dry_run",
      severity: "warning",
      state: "open",
      title: `${session.title} has a stale dry-run`,
      summary: "A dry-run/apply-ready session has been waiting for operator follow-through long enough to warrant attention.",
      href: session.href,
      active: true,
      sessionId: session.id,
      metadataJson: {
        canonical_state: session.canonicalState,
        updated_at: session.updatedAt,
      },
    })),
    ...overdueSchedules.map((schedule) => ({
      id: buildSystemSignalId(["overdue-schedule", schedule.id]),
      workflowFamily: schedule.workflowFamily,
      signalType: "overdue_schedule",
      severity: "warning",
      state: "open",
      title: `${schedule.title} is overdue`,
      summary: "This enabled schedule is due and has not yet created its next broker-backed job.",
      href: "/admin/schedules",
      active: true,
      metadataJson: {
        schedule_id: schedule.id,
        next_run_at: schedule.nextRunAt,
      },
    })),
    ...recentScheduledFailures.map((schedule) => ({
      id: buildSystemSignalId(["schedule-failure", schedule.id]),
      workflowFamily: schedule.workflowFamily,
      signalType: "schedule_failure",
      severity: "warning",
      state: "open",
      title: `${schedule.title} needs operator attention`,
      summary: schedule.lastJob?.summary || schedule.lastResultSummary || "The latest scheduled run did not complete cleanly.",
      href: schedule.lastJobId ? `/admin/jobs/${encodeURIComponent(schedule.lastJobId)}` : "/admin/schedules",
      active: true,
      jobRunId: schedule.lastJobId || null,
      metadataJson: {
        schedule_id: schedule.id,
        status: schedule.status,
      },
    })),
  ];

  await Promise.all(signalRecords.map((signal) => upsertSystemSignal(signal)));
  await deactivateSystemSignals(signalRecords.map((signal) => signal.id));
  const activeSignals = await listSystemSignalRecords({ activeOnly: true });
  const suggestedActions = prioritizedItems
    .filter((item) => item.quickAction?.action)
    .slice(0, 8)
    .map((item) =>
      buildSuggestedAction({
        id: `suggested:${item.id}`,
        actionId: item.quickAction.action.id,
        workflowFamily: item.workflowFamily,
        title: item.quickAction.label,
        explanation: item.summary,
        priorityScore: item.priorityScore,
        priorityLabel: item.priorityLabel,
        priorityReason: item.priorityReason,
        input: item.quickAction.input || {},
        context: item.quickAction.context || {},
        href: item.href,
        tone: item.quickAction.tone || "default",
      })
    )
    .filter(Boolean);

  const overview = {
    activeSessions: enrichedSessions.length,
    needsAttentionNow: bucketItems.needsAttention.length,
    blockedSessions: blockedSessionItems.length,
    awaitingHumanReview: bucketItems.awaitingHumanReview.length,
    readyToRun: bucketItems.readyToRun.length,
    overdueSchedules: overdueSchedules.length,
    recentFailures: recentFailures.length,
  };

  return {
    generatedAt: new Date().toISOString(),
    sessions: enrichedSessions,
    sessionCards,
    dailyRoutine,
    currentAdminWorkflowTracker,
    legislativeWorkflowTracker,
    verificationBanner: getOperatorVerificationBanner(),
    deepIntegrityReport,
    signals: activeSignals.slice(0, 12),
    schedules,
    upcomingSchedules,
    overdueSchedules,
    recentScheduledFailures,
    schedulesNeedingAttention,
    suggestedActions: suggestedActions.slice(0, 8),
    prioritizedItems,
    buckets: Object.fromEntries(
      Object.entries(bucketItems).map(([bucketId, items]) => [
        bucketId,
        {
          ...DASHBOARD_BUCKETS[bucketId],
          items,
        },
      ])
    ),
    overview,
    reviewQueueSummary: {
      totalItems: enrichedReviewQueue.length,
      pendingReviewItems: pendingReviewItems.length,
      currentAdminItems: enrichedReviewQueue.filter((item) => item.workflowFamily === "current-admin").length,
      legislativeItems: enrichedReviewQueue.filter((item) => item.workflowFamily === "legislative").length,
    },
    nextActionsByWorkflowFamily,
    alerts,
    recentJobs,
    recentFailures,
    blockingArtifacts: missingArtifacts.slice(0, 10),
    featuredActions: listSerializedOperatorActions().filter((action) => featuredActionIds.includes(action.id)),
  };
}
