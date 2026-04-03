import Link from "next/link";
import { getCommandCenterSummary } from "@/lib/server/admin-operator/workflowData.js";
import { formatAdminDateTime } from "./components/adminDateTime";
import CurrentAdminWorkflowTracker from "./components/CurrentAdminWorkflowTracker";
import LegislativeWorkflowTracker from "./components/LegislativeWorkflowTracker";
import OperatorActionButton from "./components/OperatorActionButton";
import OperatorPageAutoRefresh from "./components/OperatorPageAutoRefresh";
import JobStatusBadge from "./jobs/JobStatusBadge";

export const dynamic = "force-dynamic";

const EMPTY_BUCKET = {
  title: "No items",
  description: "",
  items: [],
};

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toWorkflowLabel(value) {
  if (value === "current-admin") {
    return "Current Admin";
  }
  if (value === "legislative") {
    return "Legislative";
  }
  if (value === "system") {
    return "System";
  }
  return value || "Unknown";
}

function toPriorityCode(label) {
  if (label === "critical" || label === "high") {
    return "P1";
  }
  if (label === "medium") {
    return "P2";
  }
  return "P3";
}

function formatDuration(startedAt, finishedAt) {
  if (!startedAt || !finishedAt) {
    return "—";
  }

  const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return "—";
  }

  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  const totalSeconds = Math.round(durationMs / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return `${minutes}m ${seconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function CompactBadge({ children, tone = "default", mono = false }) {
  const palette =
    tone === "danger"
      ? "border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]"
      : tone === "warning"
        ? "border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]"
        : tone === "success"
          ? "border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]"
          : "border-[#E5EAF0] bg-[#F9FBFD] text-[#4B5563]";

  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${palette}${mono ? " font-mono" : " font-medium"}`}
    >
      {children}
    </span>
  );
}

function StateBadge({ value }) {
  const text = normalizeString(value) || "unknown";
  const upper = text.toUpperCase();
  const tone =
    upper.includes("BLOCK") || upper === "FAILED" || upper === "MISSING"
      ? "danger"
      : upper.includes("REVIEW") || upper.includes("QUEUE") || upper === "QUEUED"
        ? "warning"
        : upper.includes("READY") || upper === "SUCCESS" || upper === "RUNNING"
          ? "success"
          : "default";

  return <CompactBadge tone={tone}>{text}</CompactBadge>;
}

function AlertBadge({ tone = "default", children }) {
  const palette =
    tone === "danger"
      ? "border-[#FCA5A5] bg-[#FEF2F2] text-[#991B1B]"
      : tone === "warning"
        ? "border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]"
        : tone === "success"
          ? "border-[#A7F3D0] bg-[#ECFDF5] text-[#166534]"
          : "border-[#E5EAF0] bg-[#F9FBFD] text-[#4B5563]";

  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${palette}`}>
      {children}
    </span>
  );
}

function statusTone(status) {
  if (status === "failed" || status === "blocked") {
    return "danger";
  }
  if (status === "review_required" || status === "success_with_fallback") {
    return "warning";
  }
  if (status === "success") {
    return "success";
  }
  return "default";
}

function humanizeToken(value) {
  const text = normalizeString(value);
  if (!text) {
    return "Unknown";
  }

  return text
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function humanizeOverallStatus(value) {
  if (value === "success_with_fallback") {
    return "Success With Fallback";
  }
  if (value === "review_required") {
    return "Review Required";
  }
  return humanizeToken(value);
}

function humanizeAiStatus(value) {
  if (value === "success") {
    return "AI succeeded";
  }
  if (value === "partial") {
    return "AI partial";
  }
  if (value === "failed") {
    return "AI failed";
  }
  if (value === "not_started") {
    return "Not started";
  }
  return humanizeToken(value);
}

function summarizeFallbackStatus(outcome) {
  if (!outcome) {
    return "—";
  }

  if (outcome.aiStatus === "failed") {
    return `Fallback only (${outcome.fallbackText})`;
  }
  if (outcome.aiStatus === "partial") {
    return `Partial fallback (${outcome.fallbackText})`;
  }
  if (outcome.aiStatus === "success") {
    return outcome.fallbackText === "0" ? "No fallback" : `Fallback ${outcome.fallbackText}`;
  }
  return "Pending";
}

function deriveTrustFromItem(item, workflowOutcome) {
  if (workflowOutcome?.trustTone) {
    return {
      tone: workflowOutcome.trustTone,
      label: workflowOutcome.trustLabel,
    };
  }

  if (item?.kind === "job" && item?.status === "failed") {
    return { tone: "danger", label: "Low" };
  }

  if (
    item?.bucketId === "blockedNeedsFix" ||
    item?.metadata?.riskLevel === "high"
  ) {
    return { tone: "danger", label: "Low" };
  }

  if (
    item?.kind === "reviewQueue" ||
    item?.bucketId === "awaitingHumanReview" ||
    item?.status === "ready_for_apply_confirmation"
  ) {
    return { tone: "warning", label: "Guarded" };
  }

  return { tone: "default", label: "Medium" };
}

function reviewQueueTypeLabel(item) {
  if (!item) {
    return "Review";
  }

  if (item.workflowFamily === "legislative" && item.metadata?.queueType === "manual-review") {
    return "Legislative Manual Review";
  }
  if (item.workflowFamily === "legislative" && item.metadata?.queueType === "bundle-approval") {
    return "Bundle Approval";
  }
  if (item.workflowFamily === "current-admin" && item.metadata?.queueType === "operator-review") {
    return "Current-Admin Operator Review";
  }
  if (item.workflowFamily === "current-admin" && item.metadata?.queueType === "apply-readiness") {
    return item.status === "ready_for_apply_confirmation"
      ? "Import Approval Follow-Up"
      : "Pre-commit / Apply Readiness";
  }

  return humanizeToken(item.metadata?.queueType || item.kind || "review");
}

function fallbackRunCount(workflowOutcomes) {
  return workflowOutcomes.filter((outcome) =>
    ["partial", "failed"].includes(outcome.aiStatus)
  ).length;
}

function hasActiveCurrentAdminWorkflow(tracker) {
  if (!tracker?.batchName || !Array.isArray(tracker.steps)) {
    return false;
  }

  return tracker.steps.some((step) => step.status !== "complete");
}

function hasActiveLegislativeWorkflow(tracker) {
  if (!tracker || !Array.isArray(tracker.steps)) {
    return false;
  }

  if (tracker.steps.every((step) => step.status === "complete")) {
    return false;
  }

  return (
    normalizeString(tracker.canonicalState) !== "DISCOVERY_READY" ||
    tracker.steps.some(
      (step) => step.id !== "discovery_ingestion" && !["pending", "complete"].includes(step.status)
    ) ||
    tracker.steps.some(
      (step) => step.id !== "discovery_ingestion" && step.status === "complete"
    )
  );
}

function buildTrustBannerData(summary, workflowOutcomes) {
  const criticalOutcome = workflowOutcomes.find(
    (outcome) => outcome.aiStatus === "failed" || outcome.trustTone === "danger"
  );
  if (criticalOutcome) {
    return {
      tone: "danger",
      title: `${criticalOutcome.workflow} AI failed or fully fell back.`,
      detail:
        criticalOutcome.manualReviewCount > 0
          ? `${criticalOutcome.manualReviewCount} item(s) now require human review before this run can be trusted.`
          : criticalOutcome.outcome,
      href: criticalOutcome.href,
      actionLabel: "Open workflow",
    };
  }

  const warningOutcome = workflowOutcomes.find(
    (outcome) =>
      outcome.aiStatus === "partial" ||
      outcome.overallStatus === "review_required" ||
      outcome.trustTone === "warning"
  );
  if (warningOutcome) {
    return {
      tone: "warning",
      title: "AI partially succeeded. Some workflow outputs require manual verification.",
      detail: warningOutcome.reason || warningOutcome.outcome,
      href: warningOutcome.href,
      actionLabel: "Open next step",
    };
  }

  if ((summary.overview?.blockedSessions || 0) > 0) {
    return {
      tone: "warning",
      title: "A workflow is blocked and needs operator follow-through.",
      detail: "Review the blocked workflow rows first before trusting lower-priority ready work.",
      href: "#attention-now",
      actionLabel: "Open attention queue",
    };
  }

  if (
    summary.verificationBanner &&
    normalizeString(summary.verificationBanner.status).toLowerCase() !== "passed"
  ) {
    return {
      tone: "warning",
      title: summary.verificationBanner.title,
      detail: summary.verificationBanner.summary,
      href: summary.verificationBanner.href || "/admin/tools",
      actionLabel: "Open tools",
    };
  }

  if (workflowOutcomes.length) {
    return {
      tone: "success",
      title: "Recent workflow runs completed with expected AI behavior.",
      detail: "No high-severity trust warnings are active right now.",
      href: "#workflow-outcome-summaries",
      actionLabel: "Open workflow summaries",
    };
  }

  return {
    tone: "default",
    title: "No active workflow runs are currently recorded.",
    detail: "The command center is clear. Review queue and recent failure sections stay available below if new work appears.",
    href: "#review-queue-work",
    actionLabel: "Open review queue",
  };
}

function normalizeHrefForAction(href) {
  return normalizeString(href).split("#")[0];
}

function getExplicitActionLabel(actionConfig, fallbackLabel = "Inspect", context = {}) {
  const href = normalizeHrefForAction(actionConfig?.href || context.href || context.fallbackHref || "");
  const actionId = normalizeString(actionConfig?.action?.id);
  const workflowFamily = normalizeString(context.workflowFamily);
  const queueType = normalizeString(context.queueType || context.metadata?.queueType);
  const title = normalizeString(context.title);
  const status = normalizeString(context.status);
  const kind = normalizeString(context.kind);
  const rawLabel = normalizeString(actionConfig?.label || fallbackLabel);
  const vagueLabels = new Set([
    "run next safe action",
    "open workflow",
    "inspect",
    "open review",
    "open next step",
    "open session",
    "resume workflow",
    "start review",
    "open",
  ]);

  if (actionId === "currentAdmin.run") {
    return "Run current-admin";
  }
  if (actionId === "currentAdmin.review") {
    return "Open current-admin review";
  }
  if (actionId === "currentAdmin.apply") {
    if (actionConfig?.input?.apply && actionConfig?.input?.yes) {
      return "Apply current-admin import";
    }
    return "Run pre-commit check";
  }
  if (actionId === "currentAdmin.validate") {
    return "Run current-admin validation";
  }
  if (actionId === "currentAdmin.status") {
    return "Check current-admin status";
  }
  if (actionId === "currentAdmin.workflowResume") {
    return "Resume current-admin workflow";
  }
  if (actionId === "legislative.run") {
    return "Run legislative workflow";
  }
  if (actionId === "legislative.review") {
    return queueType === "manual-review"
      ? "Open legislative manual review"
      : "Open legislative review";
  }
  if (actionId === "legislative.apply") {
    return actionConfig?.input?.apply && actionConfig?.input?.yes
      ? "Apply legislative bundle"
      : "Run legislative apply preview";
  }
  if (actionId === "legislative.import") {
    return actionConfig?.input?.apply && actionConfig?.input?.yes
      ? "Run legislative import"
      : "Run legislative import preview";
  }

  if (href === "/admin/current-admin-review") {
    return status === "blocked" ? "Open current-admin blocker review" : "Open current-admin review";
  }
  if (href === "/admin/legislative-workflow") {
    return queueType === "manual-review"
      ? "Open legislative manual review"
      : "Open legislative review";
  }
  if (href === "/admin/review-queue") {
    return "Open review queue";
  }
  if (href === "/admin/schedules") {
    return "Open schedules";
  }
  if (href === "/admin/tools") {
    return "Open tools";
  }
  if (href.startsWith("/admin/jobs/")) {
    return kind === "job" ? "Open failed job" : "Open job";
  }
  if (href.startsWith("/admin/workflows/")) {
    if (kind === "artifact" || /missing/i.test(title)) {
      return "Inspect missing artifact";
    }
    if (status === "blocked" || /block/i.test(title) || /block/i.test(rawLabel)) {
      return workflowFamily === "current-admin"
        ? "Inspect current-admin blocker"
        : "Inspect legislative blocker";
    }
    if (workflowFamily === "current-admin") {
      return "Open current-admin session";
    }
    if (workflowFamily === "legislative") {
      return "Open legislative session";
    }
    return "Open workflow session";
  }

  if (!vagueLabels.has(rawLabel.toLowerCase()) && rawLabel) {
    return rawLabel;
  }

  if (kind === "artifact") {
    return "Inspect missing artifact";
  }
  if (kind === "job") {
    return "Open failed job";
  }
  if (kind === "reviewQueue") {
    if (workflowFamily === "current-admin") {
      return status === "ready_for_apply_confirmation"
        ? "Open current-admin final approval"
        : "Open current-admin review";
    }
    if (workflowFamily === "legislative") {
      return queueType === "manual-review"
        ? "Open legislative manual review"
        : "Open legislative review";
    }
  }
  if (workflowFamily === "current-admin") {
    return "Open current-admin workflow";
  }
  if (workflowFamily === "legislative") {
    return "Open legislative workflow";
  }
  return rawLabel || fallbackLabel;
}

function getActionSignature(actionConfig, item) {
  const actionId = normalizeString(actionConfig?.action?.id);
  const href = normalizeHrefForAction(actionConfig?.href || item?.href || "");
  const queueType = normalizeString(item?.metadata?.queueType);
  const status = normalizeString(item?.status);
  const title = normalizeString(item?.title);
  let issueKey = normalizeString(item?.kind);

  if (
    ["manual-review", "bundle-approval", "operator-review"].includes(queueType) ||
    actionId.endsWith(".review")
  ) {
    issueKey = "review";
  } else if (
    queueType === "apply-readiness" ||
    ["currentAdmin.apply", "legislative.apply", "legislative.import"].includes(actionId)
  ) {
    issueKey = "apply";
  } else if (item?.kind === "artifact" || /missing/i.test(title)) {
    issueKey = "artifact";
  } else if (item?.kind === "job") {
    issueKey = `job:${actionId || status || "job"}`;
  } else if (status === "BLOCKED" || status === "blocked" || /block/i.test(title)) {
    issueKey = "blocked";
  }

  return [
    normalizeString(item?.workflowFamily),
    issueKey,
    actionId || href,
  ].join(":");
}

function collapseAttentionItems(items = []) {
  const groups = new Map();

  for (const item of items) {
    const signature = getActionSignature(item.quickAction, item);
    const existing = groups.get(signature);
    if (!existing) {
      groups.set(signature, {
        ...item,
        groupedItems: [item],
      });
      continue;
    }

    existing.groupedItems.push(item);
    if ((item.priorityScore || 0) > (existing.priorityScore || 0)) {
      groups.set(signature, {
        ...item,
        groupedItems: existing.groupedItems,
      });
    }
  }

  return Array.from(groups.values()).map((item) => {
    const groupedItems = item.groupedItems || [item];
    if (groupedItems.length <= 1) {
      return item;
    }

    const queueType = groupedItems[0]?.metadata?.queueType;
    const workflowLabel = toWorkflowLabel(groupedItems[0]?.workflowFamily);
    const actionId = normalizeString(groupedItems[0]?.quickAction?.action?.id);
    const groupedCount = groupedItems.length;
    const groupTitle =
      groupedItems[0]?.kind === "reviewQueue"
        ? `${groupedCount} ${reviewQueueTypeLabel(groupedItems[0]).toLowerCase()} item(s) pending`
        : actionId.endsWith(".review")
          ? `${workflowLabel}: ${groupedCount} review item(s) share the same next step`
          : ["currentAdmin.apply", "legislative.apply", "legislative.import"].includes(actionId)
            ? `${workflowLabel}: ${groupedCount} apply-readiness item(s) share the same next step`
        : `${workflowLabel}: ${groupedCount} related operator items`;

    return {
      ...item,
      title: groupTitle,
      summary:
        groupedItems[0]?.kind === "reviewQueue"
          ? `Multiple records need the same operator checkpoint. ${groupedItems[0].summary}`
          : groupedItems[0].summary,
      metadata: {
        ...item.metadata,
        sourceId:
          groupedItems[0]?.kind === "reviewQueue"
            ? `${workflowLabel.toLowerCase().replace(/\s+/g, "-")}:${queueType || "review"}:${groupedCount}`
            : item.metadata?.sourceId || item.id,
        groupedCount,
      },
    };
  });
}

function resolveSessionPrimaryAction(session, currentAdminTracker = null) {
  const workflowTracker =
    session?.workflowFamily === "current-admin"
      ? currentAdminTracker
      : session?.workflowTracker || session?.metadataJson?.workflow_tracker || null;
  const action =
    workflowTracker?.nextStep?.action ||
    workflowTracker?.currentStep?.action ||
    session?.quickActions?.nextAction ||
    session?.quickActions?.retryAction ||
    null;

  if (action) {
    return action;
  }

  if (workflowTracker?.operatorSurfaceHref) {
    return {
      type: "link",
      href: workflowTracker.operatorSurfaceHref,
      label:
        workflowTracker?.nextStep?.status === "blocked"
          ? session?.workflowFamily === "current-admin"
            ? "Inspect current-admin blocker"
            : "Inspect legislative blocker"
          : session?.workflowFamily === "current-admin"
            ? "Open current-admin review"
            : "Open legislative review",
    };
  }

  if (session?.operatorSurfaceHref || session?.href) {
    return {
      type: "link",
      href: session.operatorSurfaceHref || session.href,
      label: "Open workflow",
    };
  }

  return null;
}

function deriveCurrentAdminOutcome(session, currentAdminTracker = null) {
  const metadata = session?.metadataJson || {};
  const reviewRuntime = session?.reviewRuntime || metadata.review_runtime || null;
  const counts = metadata.counts || {};
  const pendingReview = Number(counts.pendingReview || 0);
  const heldForFollowup = Number(counts.heldForFollowup || 0);
  const importApprovedCount = Number(counts.importApprovedCount || 0);
  const queuePendingManualReviewCount = Number(counts.queuePendingManualReviewCount || 0);
  const blockers = Number(counts.blockers || 0);
  const reviewItemTotal =
    pendingReview + Number(counts.approvalStyleDecisions || 0) + heldForFollowup;
  const queueTotal =
    importApprovedCount +
    Number(counts.queuePendingCount || 0) +
    queuePendingManualReviewCount;
  const itemsProcessed = reviewItemTotal || queueTotal || 0;
  const manualReviewCount = Math.max(heldForFollowup, queuePendingManualReviewCount);
  const fallbackUsed = Boolean(reviewRuntime?.fallback_used);
  const fallbackCount = Number(reviewRuntime?.fallback_count || 0);
  const reviewBackend = normalizeString(reviewRuntime?.review_backend);
  const fallbackOnly = reviewBackend === "heuristic_fallback";
  const aiStatus = !reviewRuntime
    ? "not_started"
    : fallbackUsed
      ? fallbackOnly
        ? "failed"
        : "partial"
      : "success";
  const overallStatus =
    session?.canonicalState === "BLOCKED" || blockers > 0
      ? "blocked"
      : session?.lastJob && ["failed", "blocked"].includes(session.lastJob.status)
        ? "failed"
        : pendingReview > 0 || session?.canonicalState === "REVIEW_READY"
          ? "review_required"
          : fallbackUsed
            ? "success_with_fallback"
            : "success";
  const nextAction = resolveSessionPrimaryAction(session, currentAdminTracker);
  const nextActionLabel =
    currentAdminTracker?.nextStep?.title ||
    currentAdminTracker?.currentStep?.title ||
    session?.recommendedAction?.title ||
    "Open workflow";
  let outcomeSentence = session?.summary || "Current-admin workflow state is active.";

  if (session?.canonicalState === "COMPLETE") {
    outcomeSentence =
      "Current-admin decisions were finalized, applied, and validated successfully.";
  } else if (session?.canonicalState === "IMPORT_READY") {
    outcomeSentence =
      "Current-admin dry-run completed. Final apply is the next guarded operator step.";
  } else if (["QUEUE_READY", "PRECOMMIT_READY"].includes(session?.canonicalState)) {
    outcomeSentence =
      importApprovedCount > 0
        ? `Queue synchronized. ${importApprovedCount} item(s) are approved for import and pre-commit is next.`
        : session?.summary || "Current-admin is waiting for the next guarded apply-readiness step.";
    } else if (session?.canonicalState === "REVIEW_READY") {
      outcomeSentence =
        pendingReview > 0
          ? `${pendingReview} review decision(s) still need explicit operator input.`
          : "Operator review is the next required step.";
  }

  return {
    workflowFamily: "current-admin",
    workflow: "Current Admin",
    state: session?.canonicalState || "unknown",
    overallStatus,
    overallStatusTone: statusTone(overallStatus),
    aiStatus,
    aiStatusTone: aiStatus === "failed" ? "danger" : aiStatus === "partial" ? "warning" : aiStatus === "success" ? "success" : "default",
    fallbackText: fallbackUsed
      ? itemsProcessed > 0
        ? `${fallbackCount}/${itemsProcessed}`
        : `${fallbackCount}+`
      : "0",
    trustLabel:
      !reviewRuntime ? "Pending" : aiStatus === "failed" ? "Low" : fallbackUsed ? "Guarded" : "High",
    trustTone:
      !reviewRuntime ? "default" : aiStatus === "failed" ? "danger" : fallbackUsed ? "warning" : "success",
    attentionCount: pendingReview + manualReviewCount + blockers,
    attentionSummary:
      pendingReview > 0
        ? `${pendingReview} review pending`
        : manualReviewCount > 0
          ? `${manualReviewCount} held for follow-up`
          : blockers > 0
            ? `${blockers} blocker${blockers === 1 ? "" : "s"}`
            : "No human attention",
    outcome: outcomeSentence,
    reason: metadata.next_action_reason || session?.summary || "",
    itemsProcessed,
    manualReviewCount,
    approvedCount: importApprovedCount,
    approvedLabel: "Import-ready",
    lastRunAt: session?.lastJob?.finishedAt || session?.updatedAt || session?.startedAt || null,
    lastRunStartedAt: session?.lastJob?.startedAt || session?.startedAt || null,
    lastRunFinishedAt: session?.lastJob?.finishedAt || session?.updatedAt || null,
    nextAction: nextActionLabel,
    nextActionConfig: nextAction,
    href: session?.operatorSurfaceHref || session?.href,
    sessionId: session?.id || null,
  };
}

function deriveLegislativeOutcome(session) {
  const metadata = session?.metadataJson || {};
  const outcome = metadata.workflow_outcome_summary || null;
  const reviewRuntime = session?.reviewRuntime || metadata.review_runtime || null;
  const pendingReview = Number(metadata?.counts?.pendingReview || 0);
  const blockers = Number(metadata?.counts?.blockers || 0);

  if (outcome) {
    const severity = outcome.severity || (outcome.trust_warning ? "warning" : "success");
    const overallStatus =
      session?.canonicalState === "BLOCKED" || blockers > 0
        ? "blocked"
        : normalizeString(outcome.ai_status?.run_status) === "failed"
          ? "failed"
          : Number(outcome.manual_review_queue_count || 0) > 0 ||
            Number(outcome.pending_bundle_approvals || 0) > 0 ||
            pendingReview > 0
            ? "review_required"
            : severity === "warning"
              ? "success_with_fallback"
              : "success";
    const nextAction = resolveSessionPrimaryAction(session);
    const nextActionLabel =
      metadata.next_step_label ||
      session?.recommendedAction?.title ||
      "Open workflow";
    return {
      workflowFamily: "legislative",
      workflow: toWorkflowLabel(session.workflowFamily),
      state: session.canonicalState,
      overallStatus,
      overallStatusTone: statusTone(overallStatus),
      outcome: outcome.user_message || session.summary,
      aiStatus: normalizeString(outcome.ai_status?.run_status) || "unknown",
      aiStatusTone:
        normalizeString(outcome.ai_status?.run_status) === "failed"
          ? "danger"
          : normalizeString(outcome.ai_status?.run_status) === "partial"
            ? "warning"
            : normalizeString(outcome.ai_status?.run_status) === "success"
              ? "success"
              : "default",
      fallbackText: `${outcome.ai_status?.fallback_used || 0}/${outcome.ai_status?.total_items || 0}`,
      trustLabel:
        severity === "critical"
          ? "Low"
          : severity === "warning"
            ? "Guarded"
            : "High",
      trustTone:
        severity === "critical"
          ? "danger"
          : severity === "warning"
            ? "warning"
            : "success",
      attentionCount:
        Number(outcome.manual_review_queue_count || 0) +
        Number(outcome.pending_bundle_approvals || 0) +
        blockers,
      attentionSummary:
        Number(outcome.manual_review_queue_count || 0) > 0
          ? `${outcome.manual_review_queue_count} manual review`
          : Number(outcome.pending_bundle_approvals || 0) > 0
            ? `${outcome.pending_bundle_approvals} bundle approvals`
            : blockers > 0
              ? `${blockers} blocker${blockers === 1 ? "" : "s"}`
              : "No human attention",
      nextAction:
        nextActionLabel,
      nextActionConfig: nextAction,
      reason:
        metadata.next_action_reason ||
        outcome.next_step_message ||
        outcome.next_step ||
        session.summary,
      itemsProcessed: Number(outcome.ai_status?.total_items || 0),
      manualReviewCount: Number(outcome.manual_review_queue_count || 0),
      approvedCount: Number(outcome.approved_bundle_actions || 0),
      approvedLabel: "Approved actions",
      lastRunAt: session?.lastJob?.finishedAt || session?.updatedAt || session?.startedAt || null,
      lastRunStartedAt: session?.lastJob?.startedAt || session?.startedAt || null,
      lastRunFinishedAt: session?.lastJob?.finishedAt || session?.updatedAt || null,
      href: session.operatorSurfaceHref || session.href,
      sessionId: session?.id || null,
    };
  }

  const fallbackUsed = Boolean(reviewRuntime?.fallback_used);
  const fallbackCount = Number(reviewRuntime?.fallback_count || 0);
  const aiStatus = !reviewRuntime
    ? "not_started"
    : fallbackUsed
      ? reviewRuntime.review_backend === "heuristic_fallback"
        ? "failed"
        : "partial"
      : "success";
  const overallStatus =
    session?.canonicalState === "BLOCKED" || blockers > 0
      ? "blocked"
      : session?.lastJob && ["failed", "blocked"].includes(session.lastJob.status)
        ? "failed"
        : pendingReview > 0
          ? "review_required"
          : fallbackUsed
            ? "success_with_fallback"
            : "success";
  const nextAction = resolveSessionPrimaryAction(session);
  const nextActionLabel =
    metadata.next_step_label ||
    session?.recommendedAction?.title ||
    "Open workflow";

  return {
    workflowFamily: "legislative",
    workflow: toWorkflowLabel(session.workflowFamily),
    state: session.canonicalState,
    overallStatus,
    overallStatusTone: statusTone(overallStatus),
    outcome: session.summary,
    aiStatus,
    aiStatusTone: aiStatus === "failed" ? "danger" : aiStatus === "partial" ? "warning" : aiStatus === "success" ? "success" : "default",
    fallbackText: fallbackUsed ? `${fallbackCount}+` : "0",
    trustLabel: !reviewRuntime ? "Pending" : fallbackUsed ? "Guarded" : "High",
    trustTone: !reviewRuntime ? "default" : fallbackUsed ? "warning" : "success",
    attentionCount: pendingReview + blockers,
    attentionSummary:
      pendingReview > 0
        ? `${pendingReview} pending review`
        : blockers > 0
          ? `${blockers} blocker${blockers === 1 ? "" : "s"}`
          : "No human attention",
    nextAction:
      nextActionLabel,
    nextActionConfig: nextAction,
    reason: metadata.next_action_reason || session.summary,
    itemsProcessed: 0,
    manualReviewCount: pendingReview,
    approvedCount: Number(metadata?.counts?.approvedPendingActions || 0),
    approvedLabel: "Approved actions",
    lastRunAt: session?.lastJob?.finishedAt || session?.updatedAt || session?.startedAt || null,
    lastRunStartedAt: session?.lastJob?.startedAt || session?.startedAt || null,
    lastRunFinishedAt: session?.lastJob?.finishedAt || session?.updatedAt || null,
    href: session.operatorSurfaceHref || session.href,
    sessionId: session?.id || null,
  };
}

function deriveWorkflowOutcome(session, currentAdminTracker = null) {
  if (session?.workflowFamily === "current-admin") {
    return deriveCurrentAdminOutcome(session, currentAdminTracker);
  }
  return deriveLegislativeOutcome(session);
}

function buildOperatorAlerts(summary, workflowOutcomes) {
  const alerts = [];
  const banner = summary.verificationBanner;
  const deepIntegrityChecks = summary.deepIntegrityReport?.checks || [];
  if (banner && normalizeString(banner.status).toLowerCase() !== "passed") {
    alerts.push({
      id: "verification-banner",
      tone: "warning",
      label: "System",
      title: banner.title,
      detail: banner.summary,
      href: banner.href || "/admin/tools",
      actionLabel: "Open tools",
    });
  }

  for (const check of deepIntegrityChecks) {
    if (!["warning", "failed"].includes(normalizeString(check.status).toLowerCase())) {
      continue;
    }
    if (
      ![
        "source-attribution-coverage",
        "source-url-duplicates",
        "current-admin-provenance",
      ].includes(check.id)
    ) {
      continue;
    }
    alerts.push({
      id: `integrity:${check.id}`,
      tone: check.id === "current-admin-provenance" ? "danger" : "warning",
      label: "Integrity",
      title:
        check.id === "source-attribution-coverage"
          ? "Missing source attribution"
          : check.id === "source-url-duplicates"
            ? "Duplicate sources detected"
            : "Current-admin provenance incomplete",
      detail: check.summary,
      href: check.id === "current-admin-provenance" ? "/admin/current-admin-review" : "/admin/tools",
      actionLabel: check.id === "current-admin-provenance" ? "Open current-admin review" : "Open tools",
    });
  }

  for (const outcome of workflowOutcomes) {
    if (outcome.trustTone === "danger") {
      alerts.push({
        id: `trust:${outcome.workflow}`,
        tone: "danger",
        label: outcome.workflow,
        title: "AI review failed or fully fell back",
        detail: outcome.outcome,
        href: outcome.href,
        actionLabel: "Open workflow",
      });
    } else if (outcome.trustTone === "warning") {
      alerts.push({
        id: `trust:${outcome.workflow}`,
        tone: "warning",
        label: outcome.workflow,
        title: "Fallback or verification warning",
        detail: outcome.reason,
        href: outcome.href,
        actionLabel: "Inspect trust state",
      });
    }
  }

  for (const session of summary.sessionCards || []) {
    if (session.blockerCount > 0) {
      alerts.push({
        id: `blocked:${session.id}`,
        tone: "danger",
        label: toWorkflowLabel(session.workflowFamily),
        title: "Blocked workflow session",
        detail: session.blockerPreview?.[0] || session.summary,
        href: session.href,
        actionLabel: "Inspect blocker",
      });
    }
  }

  for (const job of (summary.recentJobs || []).filter((item) => ["failed", "blocked"].includes(item.status)).slice(0, 3)) {
    alerts.push({
      id: `job:${job.id}`,
      tone: job.status === "blocked" ? "warning" : "danger",
      label: toWorkflowLabel(job.workflowFamily),
      title: `${job.actionTitle} ${job.status}`,
      detail: job.summary || "A broker-backed job failed before completing cleanly.",
      href: `/admin/jobs/${encodeURIComponent(job.id)}`,
      actionLabel: "Open job",
    });
  }

  const deduped = [];
  const seen = new Set();
  for (const alert of alerts) {
    if (seen.has(alert.id)) {
      continue;
    }
    seen.add(alert.id);
    deduped.push(alert);
  }
  return deduped.slice(0, 6);
}

function buildAttentionRows(items, workflowOutcomeMap) {
  return collapseAttentionItems(items || []).slice(0, 8).map((item) => {
    const workflowOutcome = workflowOutcomeMap.get(item.workflowFamily) || null;
    const trust = deriveTrustFromItem(item, workflowOutcome);
    const nextStep =
      getExplicitActionLabel(item.quickAction, workflowOutcome?.nextAction || "Open workflow", item) ||
      workflowOutcome?.nextAction ||
      (item.kind === "reviewQueue"
        ? "Open review"
        : item.kind === "job"
          ? "Open job"
          : "Open workflow");

    return {
      ...item,
      trust,
      nextStep,
      whyItMatters: item.priorityReason || item.summary,
    };
  });
}

function TrustBanner({ banner }) {
  const palette =
    banner.tone === "danger"
      ? "border-[#FCA5A5] bg-[#FEF2F2] text-[#991B1B]"
      : banner.tone === "warning"
        ? "border-[#FCD34D] bg-[#FFFBEB] text-[#92400E]"
        : banner.tone === "success"
          ? "border-[#86EFAC] bg-[#F0FDF4] text-[#166534]"
          : "border-[#E5EAF0] bg-[#F9FBFD] text-[#4B5563]";

  return (
    <section
      id="trust-system-banner"
      className={`rounded border px-3 py-2 ${palette}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-wide">Trust / System Banner</p>
          <h2 className="text-sm font-semibold">{banner.title}</h2>
          <p className="text-[11px]">{banner.detail}</p>
        </div>
        <div className="shrink-0">
          <TableLink href={banner.href}>{banner.actionLabel}</TableLink>
        </div>
      </div>
    </section>
  );
}

function AttentionTable({ rows }) {
  return (
    <section id="attention-now" className="space-y-2">
      <SectionHeader
        eyebrow="Attention Queue"
        title="What Needs Attention Now"
        description="This is the operator-first triage table. Start here when you need the single next safe action."
      />
      <TableShell>
        <table className="min-w-[1220px] w-full text-[11px]">
          <thead className="bg-[#F9FBFD] text-left uppercase tracking-wide text-[#6B7280]">
            <tr>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Priority</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Workflow</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Issue</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Why It Matters</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Trust Level</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Next Step</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.id} className="align-top odd:bg-white even:bg-[#F9FBFD] hover:bg-[#F1F5F9]">
                  <td className="border-b border-[#E5EAF0] px-2 py-1 font-mono font-medium text-[#111827]">
                    {toPriorityCode(row.priorityLabel)}
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">
                    {toWorkflowLabel(row.workflowFamily)}
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1">
                    <div className="font-medium text-[#1F2937]">{row.title}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-[#6B7280]">
                      {row.metadata?.sourceId || row.id}
                    </div>
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">
                    {row.whyItMatters}
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1">
                    <AlertBadge tone={row.trust.tone}>{row.trust.label}</AlertBadge>
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">
                    <div className="max-w-[220px] truncate" title={row.nextStep}>
                      {row.nextStep}
                    </div>
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1">
                    {row.quickAction?.action ? (
                      <OperatorActionButton
                        action={row.quickAction.action}
                        label={getExplicitActionLabel(row.quickAction, "Open workflow", row)}
                        input={row.quickAction.input}
                        context={row.quickAction.context}
                        tone={row.quickAction.tone}
                        helperText=""
                        confirmation={row.quickAction.confirmation}
                      />
                    ) : (
                      renderPrimaryAction(
                        row.quickAction,
                        row.href,
                        row.kind === "reviewQueue"
                          ? "Open review"
                          : row.kind === "job"
                            ? "Open job"
                            : "Open workflow",
                        row
                      )
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-2 py-3 text-[11px] text-[#6B7280]">
                  No urgent operator attention items are recorded right now.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableShell>
    </section>
  );
}

function WorkflowSummaryBlock({ outcome, fallbackMessage }) {
  if (!outcome) {
    return (
      <section className="rounded border border-[#E5EAF0] bg-white px-3 py-3">
        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-wide text-[#6B7280]">
            Workflow Summary
          </p>
          <h3 className="text-sm font-semibold text-[#1F2937]">{fallbackMessage.title}</h3>
          <p className="text-[11px] text-[#6B7280]">{fallbackMessage.description}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded border border-[#E5EAF0] bg-white px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-wide text-[#6B7280]">
            {outcome.workflow}
          </p>
          <h3 className="text-sm font-semibold text-[#1F2937]">{outcome.outcome}</h3>
          <p className="text-[11px] text-[#6B7280]">
            Last run {formatAdminDateTime(outcome.lastRunAt)}. Technical state: {humanizeToken(outcome.state)}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AlertBadge tone={outcome.overallStatusTone}>
            {humanizeOverallStatus(outcome.overallStatus)}
          </AlertBadge>
          <AlertBadge tone={outcome.aiStatusTone}>
            {humanizeAiStatus(outcome.aiStatus)}
          </AlertBadge>
          <AlertBadge tone={outcome.trustTone}>{outcome.trustLabel} trust</AlertBadge>
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        <div className="rounded border border-[#E5EAF0] bg-[#F9FBFD] px-2 py-2">
          <div className="text-[10px] uppercase tracking-wide text-[#6B7280]">Items</div>
          <div className="mt-1 text-sm font-semibold text-[#1F2937]">{outcome.itemsProcessed || 0}</div>
        </div>
        <div className="rounded border border-[#E5EAF0] bg-[#F9FBFD] px-2 py-2">
          <div className="text-[10px] uppercase tracking-wide text-[#6B7280]">Manual Review</div>
          <div className="mt-1 text-sm font-semibold text-[#1F2937]">{outcome.manualReviewCount || 0}</div>
        </div>
        <div className="rounded border border-[#E5EAF0] bg-[#F9FBFD] px-2 py-2">
          <div className="text-[10px] uppercase tracking-wide text-[#6B7280]">{outcome.approvedLabel}</div>
          <div className="mt-1 text-sm font-semibold text-[#1F2937]">{outcome.approvedCount || 0}</div>
        </div>
        <div className="rounded border border-[#E5EAF0] bg-[#F9FBFD] px-2 py-2">
          <div className="text-[10px] uppercase tracking-wide text-[#6B7280]">AI Result</div>
          <div className="mt-1 text-sm font-semibold text-[#1F2937]">{humanizeAiStatus(outcome.aiStatus)}</div>
        </div>
        <div className="rounded border border-[#E5EAF0] bg-[#F9FBFD] px-2 py-2">
          <div className="text-[10px] uppercase tracking-wide text-[#6B7280]">Fallback</div>
          <div className="mt-1 text-sm font-semibold text-[#1F2937]">{summarizeFallbackStatus(outcome)}</div>
        </div>
        <div className="rounded border border-[#E5EAF0] bg-[#F9FBFD] px-2 py-2">
          <div className="text-[10px] uppercase tracking-wide text-[#6B7280]">Next Step</div>
          <div className="mt-1 text-sm font-semibold text-[#1F2937]">
            {getExplicitActionLabel(
              outcome.nextActionConfig,
              outcome.nextAction,
              outcome
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-4xl text-[11px] text-[#4B5563]">
          {outcome.reason}
        </p>
        <div className="shrink-0">
          {renderPrimaryAction(
            outcome.nextActionConfig,
            outcome.href,
            outcome.workflowFamily === "current-admin" ? "Open review" : "Open workflow",
            outcome
          )}
        </div>
      </div>
    </section>
  );
}

function WorkflowSummarySection({ currentAdminOutcome, legislativeOutcome }) {
  return (
    <section id="workflow-outcome-summaries" className="space-y-2">
      <SectionHeader
        eyebrow="Workflow Outcomes"
        title="Most Recent Workflow Outcome Summaries"
        description="Plain-language summaries of the latest meaningful current-admin and legislative runs."
      />
      <div className="grid gap-3 xl:grid-cols-2">
        <WorkflowSummaryBlock
          outcome={currentAdminOutcome}
          fallbackMessage={{
            title: "Current-admin has no active workflow session.",
            description: "Run or reopen the canonical current-admin workflow to restore a session summary here.",
          }}
        />
        <WorkflowSummaryBlock
          outcome={legislativeOutcome}
          fallbackMessage={{
            title: "Legislative has no active workflow session.",
            description: "Run or reopen the canonical legislative workflow to restore a session summary here.",
          }}
        />
      </div>
    </section>
  );
}

function RecentWorkflowRunsTable({ jobs, sessionById, workflowOutcomeMap }) {
  const rows = (jobs || [])
    .filter((job) => ["current-admin", "legislative"].includes(job.workflowFamily))
    .slice(0, 5);

  return (
    <section id="recent-workflow-runs" className="space-y-2">
      <SectionHeader
        eyebrow="Recent Runs"
        title="Recent Workflow Runs"
        description="Human-readable workflow history first. Logs and raw job detail stay secondary."
        href="/admin/jobs"
      />
      <TableShell>
        <table className="min-w-[1380px] w-full text-[11px]">
          <thead className="bg-[#F9FBFD] text-left uppercase tracking-wide text-[#6B7280]">
            <tr>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Workflow</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Started</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Finished</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Status</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">AI Result</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Fallback</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Items</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Manual Review</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Outcome</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Next Step</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((job) => {
                const sessionId = job.sessionIds?.[0] || null;
                const session = sessionId ? sessionById.get(sessionId) : null;
                const workflowOutcome =
                  workflowOutcomeMap.get(job.workflowFamily) ||
                  (session ? workflowOutcomeMap.get(session.workflowFamily) : null) ||
                  null;
                const reviewRuntime = job.metadataJson?.review_runtime || null;
                const aiResult = reviewRuntime
                  ? humanizeAiStatus(
                      reviewRuntime.fallback_used
                        ? normalizeString(reviewRuntime.review_backend) === "heuristic_fallback"
                          ? "failed"
                          : "partial"
                        : "success"
                    )
                  : /\.(run|review)$/.test(job.actionId || "") && workflowOutcome
                    ? humanizeAiStatus(workflowOutcome.aiStatus)
                    : "Not an AI step";
                const fallbackText = reviewRuntime
                  ? reviewRuntime.fallback_used
                    ? `${reviewRuntime.fallback_count || 0}+`
                    : "No fallback"
                  : workflowOutcome
                    ? summarizeFallbackStatus(workflowOutcome)
                    : "—";
                const isAiStep =
                  Boolean(reviewRuntime) ||
                  /\.(run|review)$/.test(job.actionId || "");
                const itemsProcessed = isAiStep && workflowOutcome ? workflowOutcome.itemsProcessed || 0 : "—";
                const manualReviewCount =
                  isAiStep && workflowOutcome ? workflowOutcome.manualReviewCount || 0 : "—";
                const detailHref =
                  session?.href || `/admin/jobs/${encodeURIComponent(job.id)}`;
                const nextStep =
                  job.failure?.nextSafeActionTitle ||
                  getExplicitActionLabel(
                    workflowOutcome?.nextActionConfig || null,
                    workflowOutcome?.nextAction || session?.recommendedAction?.title || "Inspect job",
                    workflowOutcome || {
                      workflowFamily: job.workflowFamily,
                      kind: session ? "session" : "job",
                      href: detailHref,
                    }
                  ) ||
                  session?.recommendedAction?.title ||
                  "Inspect job";
                const outcomeText =
                  job.status === "failed"
                    ? job.failure?.message || job.summary || "The workflow job failed before completing."
                    : workflowOutcome?.outcome || job.summary || "Workflow activity was recorded.";
                const detailLabel = getExplicitActionLabel(
                  null,
                  session ? "Open session" : "Open job",
                  {
                    workflowFamily: job.workflowFamily,
                    kind: session ? "session" : "job",
                    status: session?.canonicalState || job.status,
                    href: detailHref,
                    title: session?.title || job.actionTitle,
                  }
                );

                return (
                  <tr key={job.id} className="align-top odd:bg-white even:bg-[#F9FBFD] hover:bg-[#F1F5F9]">
                    <td className="border-b border-[#E5EAF0] px-2 py-1">
                      <div className="font-medium text-[#1F2937]">{toWorkflowLabel(job.workflowFamily)}</div>
                      <div className="font-mono text-[10px] text-[#6B7280]">{job.actionTitle}</div>
                    </td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">
                      {formatAdminDateTime(job.startedAt || job.createdAt)}
                    </td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">
                      {formatAdminDateTime(job.finishedAt)}
                    </td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1">
                      <JobStatusBadge status={job.status} />
                    </td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1">
                      <AlertBadge
                        tone={
                          aiResult === "AI failed"
                            ? "danger"
                            : aiResult === "AI partial"
                              ? "warning"
                              : aiResult === "AI succeeded"
                                ? "success"
                                : "default"
                        }
                      >
                        {aiResult}
                      </AlertBadge>
                    </td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1 font-mono text-[10px] text-[#111827]">
                      {fallbackText}
                    </td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">{itemsProcessed}</td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">{manualReviewCount}</td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">
                      <div className="max-w-[280px] truncate" title={outcomeText}>
                        {outcomeText}
                      </div>
                    </td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">
                      <div className="max-w-[220px] truncate" title={nextStep}>
                        {nextStep}
                      </div>
                    </td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1">
                      <TableLink href={detailHref}>{detailLabel}</TableLink>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={11} className="px-2 py-3 text-[11px] text-[#6B7280]">
                  <div>No recent workflow runs are recorded.</div>
                  <div className="mt-1">Next step: open workflow surfaces to inspect the current canonical state or start a new safe workflow run.</div>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <TableLink href="/admin/workflows">Open workflows</TableLink>
                    <TableLink href="/admin/jobs">Open jobs</TableLink>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableShell>
    </section>
  );
}

function ReviewQueueTable({ items, workflowOutcomeMap }) {
  const rows = (items || []).slice(0, 5);

  return (
    <section id="review-queue-work" className="space-y-2">
      <SectionHeader
        eyebrow="Review Queue"
        title="Human Review Queue"
        description="Manual review, operator review, and apply follow-up are shown here from canonical queue artifacts."
        href="/admin/review-queue"
      />
      <TableShell>
        <table className="min-w-[1240px] w-full text-[11px]">
          <thead className="bg-[#F9FBFD] text-left uppercase tracking-wide text-[#6B7280]">
            <tr>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Workflow</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Queue Type</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Record</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Reason</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Risk</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Trust State</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Action</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((item) => {
                const workflowOutcome = workflowOutcomeMap.get(item.workflowFamily) || null;
                const trust = deriveTrustFromItem(item, workflowOutcome);
                return (
                  <tr key={item.id} className="align-top odd:bg-white even:bg-[#F9FBFD] hover:bg-[#F1F5F9]">
                    <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">
                      {toWorkflowLabel(item.workflowFamily)}
                    </td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1">
                      <div className="max-w-[180px] truncate text-[#4B5563]" title={reviewQueueTypeLabel(item)}>
                        {reviewQueueTypeLabel(item)}
                      </div>
                    </td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1">
                      <div className="font-medium text-[#1F2937]">{item.title}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-[#6B7280]">
                        {item.metadata?.sourceId || item.id}
                      </div>
                    </td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">
                      {item.summary}
                    </td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1">
                      <AlertBadge
                        tone={
                          item.metadata?.riskLevel === "high"
                            ? "danger"
                            : item.metadata?.riskLevel === "medium"
                              ? "warning"
                              : "default"
                        }
                      >
                        {humanizeToken(item.metadata?.riskLevel || item.priorityLabel || "medium")}
                      </AlertBadge>
                    </td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1">
                      <AlertBadge tone={trust.tone}>{trust.label}</AlertBadge>
                    </td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1">
                      {item.quickAction?.action ? (
                        <OperatorActionButton
                          action={item.quickAction.action}
                          label={getExplicitActionLabel(item.quickAction, "Open workflow", item)}
                          input={item.quickAction.input}
                          context={item.quickAction.context}
                          tone={item.quickAction.tone}
                          helperText=""
                          confirmation={item.quickAction.confirmation}
                        />
                      ) : (
                        renderPrimaryAction(
                          item.quickAction,
                          item.href,
                          item.workflowFamily === "current-admin" ? "Open review" : "Open workflow",
                          item
                        )
                      )}
                    </td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1">
                      {item.href ? (
                        <TableLink href={item.href}>
                          {getExplicitActionLabel(
                            null,
                            item.workflowFamily === "current-admin" ? "Open review" : "Open workflow",
                            item
                          )}
                        </TableLink>
                      ) : (
                        <span className="text-[11px] text-[#6B7280]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="px-2 py-3 text-[11px] text-[#6B7280]">
                  <div>No review work is pending.</div>
                  <div className="mt-1">Next step: open workflow surfaces if you expected review work to be generated.</div>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <TableLink href="/admin/workflows">Open workflows</TableLink>
                    <TableLink href="/admin/review-queue">Open review queue</TableLink>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableShell>
    </section>
  );
}

function OperationalPagesSection({ links }) {
  return (
    <section className="space-y-2">
      <SectionHeader
        eyebrow="Operational Pages"
        title="Full admin pages"
        description="The command center previews the state. Use these pages for the full workflow, queue, artifact, job, and verification views."
      />
      <TableShell>
        <table className="min-w-[980px] w-full text-[11px]">
          <thead className="bg-[#F9FBFD] text-left uppercase tracking-wide text-[#6B7280]">
            <tr>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Page</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Owns</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Current Signal</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Open</th>
            </tr>
          </thead>
          <tbody>
            {links.map((link) => (
              <tr key={link.href} className="align-top odd:bg-white even:bg-[#F9FBFD] hover:bg-[#F1F5F9]">
                <td className="border-b border-[#E5EAF0] px-2 py-1">
                  <div className="font-medium text-[#1F2937]">{link.title}</div>
                  <div className="mt-0.5 text-[10px] text-[#6B7280]">{link.href}</div>
                </td>
                <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">
                  {link.description}
                </td>
                <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">
                  {link.signal}
                </td>
                <td className="border-b border-[#E5EAF0] px-2 py-1">
                  <TableLink href={link.href}>{link.actionLabel || `Open ${link.title}`}</TableLink>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>
    </section>
  );
}

function AlertsPanel({ alerts }) {
  return (
    <section className="space-y-2">
      <SectionHeader
        eyebrow="Alerts"
        title="Operator alerts"
        description="Failures, fallback-heavy runs, and blockers are front-loaded here."
      />
      <div className="grid gap-2 xl:grid-cols-2">
        {alerts.length ? (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex min-h-0 items-start justify-between gap-3 rounded border border-[#E5EAF0] bg-white px-3 py-2"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <AlertBadge tone={alert.tone}>{alert.label}</AlertBadge>
                  <p className="text-[11px] font-semibold text-[#1F2937]">{alert.title}</p>
                </div>
                <p className="text-[11px] text-[#4B5563]">{alert.detail}</p>
              </div>
              <div className="shrink-0">
                <TableLink href={alert.href}>{alert.actionLabel}</TableLink>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded border border-[#E5EAF0] bg-white px-3 py-2 text-[11px] text-[#6B7280]">
            No active alerts are recorded right now.
          </div>
        )}
      </div>
    </section>
  );
}

function WorkflowOutcomeTable({ outcomes }) {
  return (
    <section className="space-y-2">
      <SectionHeader
        eyebrow="Workflow Health"
        title="AI trust and workflow outcomes"
        description="Observability view: what happened, what used fallback, what needs human attention, and what to do next."
      />
      <TableShell>
        <table className="min-w-[1180px] w-full text-[11px]">
          <thead className="bg-[#F9FBFD] text-left uppercase tracking-wide text-[#6B7280]">
            <tr>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Workflow</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Pipeline State</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Outcome</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">AI Status</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Fallback</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Trust</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Needs Attention</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Next Action</th>
            </tr>
          </thead>
          <tbody>
            {outcomes.length ? (
              outcomes.map((outcome) => (
                <tr key={outcome.workflow} className="align-top odd:bg-white even:bg-[#F9FBFD] hover:bg-[#F1F5F9]">
                  <td className="border-b border-[#E5EAF0] px-2 py-1 font-medium text-[#1F2937]">
                    {outcome.workflow}
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1">
                    <StateBadge value={outcome.state} />
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">
                    <div className="max-w-[320px] truncate" title={outcome.outcome}>
                      {outcome.outcome}
                    </div>
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1">
                    <AlertBadge tone={outcome.aiStatus === "failed" ? "danger" : outcome.aiStatus === "partial" ? "warning" : outcome.aiStatus === "success" ? "success" : "default"}>
                      {outcome.aiStatus}
                    </AlertBadge>
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1 font-mono text-[10px] text-[#111827]">
                    {outcome.fallbackText}
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1">
                    <AlertBadge tone={outcome.trustTone}>{outcome.trustLabel}</AlertBadge>
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">
                    {outcome.attentionSummary}
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1">
                    <div className="space-y-1">
                      <div className="max-w-[240px] truncate text-[#1F2937]" title={outcome.nextAction}>
                        {outcome.nextAction}
                      </div>
                      <TableLink href={outcome.href}>Open workflow</TableLink>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-2 py-3 text-[11px] text-[#6B7280]">
                  No workflow outcomes are currently recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableShell>
    </section>
  );
}

function RecentEventsTable({ jobs }) {
  return (
    <section className="space-y-2">
      <SectionHeader
        eyebrow="Recent Events"
        title="What just happened"
        description="Pipeline-style run history: latest broker-backed workflow actions and their outcomes."
        href="/admin/jobs"
      />
      <TableShell>
        <table className="min-w-[1040px] w-full text-[11px]">
          <thead className="bg-[#F9FBFD] text-left uppercase tracking-wide text-[#6B7280]">
            <tr>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">When</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Workflow</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Action</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Outcome</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Trust / Fallback</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Next</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length ? (
              jobs.slice(0, 6).map((job) => {
                const reviewRuntime = job.metadataJson?.review_runtime || null;
                const fallbackText = reviewRuntime?.fallback_used
                  ? `${reviewRuntime.review_backend || "fallback"} / ${reviewRuntime.fallback_count || 0}`
                  : "No fallback";
                const nextText =
                  job.failure?.nextSafeActionTitle ||
                  job.metadataJson?.command_execution_assist?.nextRecommendedAction ||
                  "Inspect job";
                return (
                  <tr key={job.id} className="align-top odd:bg-white even:bg-[#F9FBFD] hover:bg-[#F1F5F9]">
                    <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">
                      {formatAdminDateTime(job.startedAt || job.createdAt)}
                    </td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">
                      {toWorkflowLabel(job.workflowFamily)}
                    </td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1">
                      <div className="font-medium text-[#1F2937]">{job.actionTitle}</div>
                      <div className="font-mono text-[10px] text-[#6B7280]">{job.id}</div>
                    </td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1">
                      <div className="flex items-center gap-2">
                        <JobStatusBadge status={job.status} />
                        <span className="text-[#4B5563]">{job.summary || "Broker-backed run recorded."}</span>
                      </div>
                    </td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1">
                      <div className="space-y-1">
                        <div className="text-[#4B5563]">{fallbackText}</div>
                        {job.failure?.message ? (
                          <div className="max-w-[220px] truncate text-[10px] text-[#6B7280]" title={job.failure.message}>
                            {job.failure.message}
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1">
                      <div className="space-y-1">
                        <div className="max-w-[220px] truncate text-[#4B5563]" title={nextText}>
                          {nextText}
                        </div>
                        <TableLink href={`/admin/jobs/${encodeURIComponent(job.id)}`}>Open job</TableLink>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="px-2 py-3 text-[11px] text-[#6B7280]">
                  No recent workflow events are recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableShell>
    </section>
  );
}

function RoutineTypeBadge({ step }) {
  let label = "Run";
  if (step.executionSafety.blocked) {
    label = "Blocked";
  } else if (step.executionSafety.requires_review) {
    label = "Review";
  } else if (step.actionType === "retry_safely") {
    label = "Retry";
  } else if (step.sourceType === "schedule") {
    label = "Schedule";
  }

  const tone =
    label === "Blocked"
      ? "danger"
      : label === "Review"
        ? "warning"
        : label === "Run"
          ? "success"
          : "default";

  return <CompactBadge tone={tone}>{label}</CompactBadge>;
}

function DashboardCounter({ label, value, href }) {
  return (
    <Link
      href={href}
      className="flex min-h-0 items-center justify-between gap-3 rounded border border-[#E5EAF0] bg-white px-2 py-1.5 text-[11px] hover:bg-[#F1F5F9]"
    >
      <span className="font-mono uppercase tracking-wide text-[#6B7280]">{label}</span>
      <span className="text-sm font-semibold text-[#1F2937]">{value}</span>
    </Link>
  );
}

function TableShell({ children }) {
  return (
    <div className="overflow-x-auto rounded border border-[#E5EAF0] bg-white">
      {children}
    </div>
  );
}

function TableLink({ href, children }) {
  return (
    <Link href={href} className="text-[11px] text-[#3B82F6] underline underline-offset-2">
      {children}
    </Link>
  );
}

function renderPrimaryAction(actionConfig, fallbackHref, fallbackLabel = "Inspect", context = {}) {
  const label = getExplicitActionLabel(actionConfig, fallbackLabel, {
    ...context,
    fallbackHref,
  });

  if (actionConfig?.type === "action" && actionConfig.action) {
    return (
      <OperatorActionButton
        action={actionConfig.action}
        label={label}
        input={actionConfig.input}
        context={actionConfig.context}
        tone={actionConfig.tone}
        helperText=""
        confirmation={actionConfig.confirmation}
      />
    );
  }

  if (actionConfig?.type === "link" && actionConfig.href) {
    return (
      <TableLink href={actionConfig.href}>
        {label}
      </TableLink>
    );
  }

  if (fallbackHref) {
    return <TableLink href={fallbackHref}>{label}</TableLink>;
  }

  return <span className="text-[11px] text-[#6B7280]">—</span>;
}

function SectionHeader({ eyebrow, title, description, href, hrefLabel = "View all" }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-wide text-[#6B7280]">{eyebrow}</p>
        <h2 className="text-sm font-semibold text-[#1F2937]">{title}</h2>
        {description ? <p className="text-[11px] text-[#6B7280]">{description}</p> : null}
      </div>
      {href ? <TableLink href={href}>{hrefLabel}</TableLink> : null}
    </div>
  );
}

function DailyRoutineTable({ steps, itemIndex }) {
  return (
    <section className="space-y-2">
      <SectionHeader
        eyebrow="Daily Routine"
        title="Top sequenced operator work"
        description="Only the highest-value first-wave steps are shown here."
      />
      <TableShell>
        <table className="min-w-[1160px] w-full text-[11px]">
          <thead className="bg-[#F9FBFD] text-left uppercase tracking-wide text-[#6B7280]">
            <tr>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Priority</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Type</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Workflow</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Item</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Why Now</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">State</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Source</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {steps.length ? (
              steps.map((step) => {
                const sourceItem = itemIndex.get(step.sourceItemId);
                return (
                  <tr key={step.id} className="align-top odd:bg-white even:bg-[#F9FBFD] hover:bg-[#F1F5F9]">
                    <td className="border-b border-[#E5EAF0] px-2 py-1 font-mono font-medium text-[#111827]">
                      {toPriorityCode(step.priorityLabel)}
                    </td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1">
                      <RoutineTypeBadge step={step} />
                    </td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">{toWorkflowLabel(step.workflowFamily)}</td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1">
                      <div className="font-medium text-[#1F2937]">{step.title}</div>
                    </td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">
                      {step.priorityReason || step.explanation}
                    </td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1">
                      <StateBadge value={sourceItem?.status || "pending"} />
                    </td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1 font-mono text-[10px] text-[#6B7280]">
                      {step.sourceId}
                    </td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1">
                      {renderPrimaryAction(step.primaryAction, step.deepLinkTarget, "Open", {
                        workflowFamily: step.workflowFamily,
                        kind: sourceItem?.kind || step.sourceType,
                        queueType: sourceItem?.metadata?.queueType,
                        title: step.title,
                        status: sourceItem?.status,
                        href: step.deepLinkTarget,
                        metadata: sourceItem?.metadata,
                      })}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="px-2 py-3 text-[11px] text-[#6B7280]">
                  No routine items are active right now.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableShell>
    </section>
  );
}

function BucketTable({ id, title, description, href, items }) {
  const rows = items.slice(0, 4);

  return (
    <section id={id} className="space-y-2">
      <SectionHeader eyebrow={title} title={title} description={description} href={href} />
      <TableShell>
        <table className="min-w-[760px] w-full text-[11px]">
          <thead className="bg-[#F9FBFD] text-left uppercase tracking-wide text-[#6B7280]">
            <tr>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Workflow</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Item</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Why Now</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">State</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((item) => (
                <tr key={item.id} className="align-top odd:bg-white even:bg-[#F9FBFD] hover:bg-[#F1F5F9]">
                  <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">{toWorkflowLabel(item.workflowFamily)}</td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1">
                    <div className="font-medium text-[#1F2937]">{item.title}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-[#6B7280]">
                      {item.metadata?.sourceId || item.id}
                    </div>
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">
                    {item.priorityReason || item.summary}
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1">
                    <StateBadge value={item.status || "pending"} />
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1">
                    {item.quickAction?.action ? (
                      <OperatorActionButton
                        action={item.quickAction.action}
                        label={getExplicitActionLabel(item.quickAction, "Open workflow", item)}
                        input={item.quickAction.input}
                        context={item.quickAction.context}
                        tone={item.quickAction.tone}
                        helperText=""
                        confirmation={item.quickAction.confirmation}
                      />
                    ) : item.href ? (
                      <TableLink href={item.href}>
                        {getExplicitActionLabel(null, "Inspect", item)}
                      </TableLink>
                    ) : (
                      <span className="text-[11px] text-[#6B7280]">—</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-2 py-3 text-[11px] text-[#6B7280]">
                  Nothing active in this bucket right now.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableShell>
    </section>
  );
}

function SessionSnapshotTable({ sessions }) {
  return (
    <section className="space-y-2">
      <SectionHeader
        eyebrow="Session Snapshots"
        title="Active workflow sessions"
        description="This is the spreadsheet backbone of the command center."
        href="/admin/workflows"
      />
      <TableShell>
        <table className="min-w-[1380px] w-full text-[11px]">
          <thead className="bg-[#F9FBFD] text-left uppercase tracking-wide text-[#6B7280]">
            <tr>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Workflow</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Session</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">State</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Review</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Blocker</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Next Action</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Latest Job</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Mode</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Schedule</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Fallback</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length ? (
              sessions.slice(0, 8).map((session) => {
                const blocker =
                  session.blockerPreview?.[0] ||
                  session.missingArtifactsPreview?.[0] ||
                  "—";
                const workflowTracker = session.workflowFamily === "current-admin" ? session.workflowTracker : null;
                const primaryAction =
                  workflowTracker?.nextStep?.action ||
                  workflowTracker?.currentStep?.action ||
                  session.quickActions?.nextAction ||
                  session.quickActions?.retryAction ||
                  null;
                const trackerLinkLabel =
                  primaryAction?.type === "link"
                    ? primaryAction.label || "Open next step"
                    : workflowTracker?.nextStep?.status === "blocked"
                      ? "Inspect blocker"
                      : "Open next step";
                const nextActionLabel =
                  workflowTracker?.nextStep?.title ||
                  workflowTracker?.currentStep?.title ||
                  session.recommendedAction?.title ||
                  "—";

                return (
                  <tr key={session.id} className="align-top odd:bg-white even:bg-[#F9FBFD] hover:bg-[#F1F5F9]">
                    <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">{toWorkflowLabel(session.workflowFamily)}</td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1">
                      <div className="font-mono text-[10px] text-[#111827]">
                        {session.canonicalSessionKey || session.id}
                      </div>
                    </td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1">
                      <StateBadge value={session.canonicalState} />
                    </td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1">
                      {session.reviewPendingCount > 0 ? (
                        <CompactBadge tone="warning">Yes</CompactBadge>
                      ) : (
                        <CompactBadge>No</CompactBadge>
                      )}
                    </td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1">
                      <div className="max-w-[220px] truncate text-[#4B5563]" title={blocker}>
                        {blocker}
                      </div>
                    </td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1">
                      <div className="max-w-[220px] truncate text-[#4B5563]" title={nextActionLabel}>
                        {nextActionLabel}
                      </div>
                    </td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1">
                      {session.lastJob ? (
                        <div className="space-y-1">
                          <JobStatusBadge status={session.lastJob.status} />
                          <div className="font-mono text-[10px] text-[#6B7280]">
                            {session.lastJob.id}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[#6B7280]">—</span>
                      )}
                    </td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1 font-mono text-[10px] text-[#111827]">
                      {session.execution?.execution_mode || "local_cli"}
                    </td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1 font-mono text-[10px] text-[#111827]">
                      {session.linkedSchedule?.title || "—"}
                    </td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1">
                      {session.fallbackPreview ? <CompactBadge tone="warning">Yes</CompactBadge> : <CompactBadge>No</CompactBadge>}
                    </td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1">
                      {primaryAction?.action ? (
                        <OperatorActionButton
                          action={primaryAction.action}
                          label={getExplicitActionLabel(primaryAction, primaryAction.label || primaryAction.title, {
                            workflowFamily: session.workflowFamily,
                            kind: "session",
                            title: session.title,
                            status: session.canonicalState,
                            href: session.href,
                          })}
                          input={primaryAction.input}
                          context={primaryAction.context}
                          tone={primaryAction.tone}
                          helperText=""
                          confirmation={primaryAction.confirmation}
                        />
                      ) : primaryAction?.type === "link" ? (
                        <TableLink href={primaryAction.href}>
                          {getExplicitActionLabel(primaryAction, trackerLinkLabel, {
                            workflowFamily: session.workflowFamily,
                            kind: "session",
                            title: session.title,
                            status: session.canonicalState,
                            href: primaryAction.href,
                          })}
                        </TableLink>
                      ) : workflowTracker?.operatorSurfaceHref ? (
                        <TableLink href={workflowTracker.operatorSurfaceHref}>
                          {getExplicitActionLabel(null, trackerLinkLabel, {
                            workflowFamily: session.workflowFamily,
                            kind: "session",
                            title: session.title,
                            status: session.canonicalState,
                            href: workflowTracker.operatorSurfaceHref,
                          })}
                        </TableLink>
                      ) : (
                        <TableLink href={session.href}>
                          {getExplicitActionLabel(null, "Open", {
                            workflowFamily: session.workflowFamily,
                            kind: "session",
                            title: session.title,
                            status: session.canonicalState,
                            href: session.href,
                          })}
                        </TableLink>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={11} className="px-2 py-3 text-[11px] text-[#6B7280]">
                  No active sessions are currently recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableShell>
    </section>
  );
}

function SchedulesTable({ schedules }) {
  return (
    <section className="space-y-2">
      <SectionHeader
        eyebrow="Schedules"
        title="Preparation timing"
        description="Schedules stay lower on the page and do not outrank urgent human work."
        href="/admin/schedules"
      />
      <TableShell>
        <table className="min-w-[980px] w-full text-[11px]">
          <thead className="bg-[#F9FBFD] text-left uppercase tracking-wide text-[#6B7280]">
            <tr>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Title</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Action</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Workflow</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Mode</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Status</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Next Run</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Last Run</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Last Result</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {schedules.length ? (
              schedules.slice(0, 5).map((schedule) => (
                <tr key={schedule.id} className="align-top odd:bg-white even:bg-[#F9FBFD] hover:bg-[#F1F5F9]">
                  <td className="border-b border-[#E5EAF0] px-2 py-1">
                    <div className="font-medium text-[#1F2937]">{schedule.title}</div>
                    <div className="font-mono text-[10px] text-[#6B7280]">{schedule.id}</div>
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">
                    {schedule.action?.title || schedule.actionId}
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">{toWorkflowLabel(schedule.workflowFamily)}</td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1 font-mono text-[10px] text-[#111827]">
                    {schedule.executionMode || "local_cli"}
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1">
                    <StateBadge value={schedule.status} />
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">{formatAdminDateTime(schedule.nextRunAt)}</td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">{formatAdminDateTime(schedule.lastRunAt)}</td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1">
                    <div className="max-w-[220px] truncate text-[#4B5563]" title={schedule.lastJob?.summary || schedule.lastResultSummary || schedule.summary}>
                      {schedule.lastJob?.summary || schedule.lastResultSummary || schedule.summary}
                    </div>
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1">
                    <TableLink href="/admin/schedules">Open schedule</TableLink>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="px-2 py-3 text-[11px] text-[#6B7280]">
                  No schedules are currently recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableShell>
    </section>
  );
}

function HealthTable({ banner, signals }) {
  return (
    <section className="space-y-2">
      <SectionHeader
        eyebrow="System Health"
        title="Verification and active signals"
        description="Keep this lower than urgent workflow work, but make drift visible."
        href="/admin/tools"
      />
      <TableShell>
        <table className="min-w-[860px] w-full text-[11px]">
          <thead className="bg-[#F9FBFD] text-left uppercase tracking-wide text-[#6B7280]">
            <tr>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Check</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Status</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Summary</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {banner ? (
              <tr className="align-top odd:bg-white even:bg-[#F9FBFD] hover:bg-[#F1F5F9]">
                <td className="border-b border-[#E5EAF0] px-2 py-1 font-medium text-[#1F2937]">{banner.title}</td>
                <td className="border-b border-[#E5EAF0] px-2 py-1">
                  <StateBadge value={banner.status} />
                </td>
                <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">
                  {banner.summary}
                </td>
                <td className="border-b border-[#E5EAF0] px-2 py-1">
                  <TableLink href={banner.href || "/admin/tools"}>Open tools</TableLink>
                </td>
              </tr>
            ) : null}
            {signals.slice(0, 4).map((signal) => (
              <tr key={signal.id} className="align-top odd:bg-white even:bg-[#F9FBFD] hover:bg-[#F1F5F9]">
                <td className="border-b border-[#E5EAF0] px-2 py-1 font-medium text-[#1F2937]">{signal.title}</td>
                <td className="border-b border-[#E5EAF0] px-2 py-1">
                  <StateBadge value={signal.signalType} />
                </td>
                <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">{signal.summary}</td>
                <td className="border-b border-[#E5EAF0] px-2 py-1">
                  {signal.href ? <TableLink href={signal.href}>Inspect</TableLink> : <TableLink href="/admin/tools">Open tools</TableLink>}
                </td>
              </tr>
            ))}
            {!banner && !signals.length ? (
              <tr>
                <td colSpan={4} className="px-2 py-3 text-[11px] text-[#6B7280]">
                  No verification or signal warnings are active right now.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </TableShell>
    </section>
  );
}

export default async function AdminPage() {
  let summary;
  let loadError = "";

  try {
    summary = await getCommandCenterSummary();
  } catch (error) {
    console.error("admin dashboard summary load failed:", error);
    loadError =
      error instanceof Error
        ? error.message
        : "The dashboard summary could not be assembled.";
    summary = {
      verificationBanner: null,
      overview: {
        activeSessions: 0,
        blockedSessions: 0,
        readyToRun: 0,
        overdueSchedules: 0,
        recentFailures: 0,
      },
      reviewQueueSummary: {
        pendingReviewItems: 0,
      },
      dailyRoutine: { steps: [] },
      buckets: {},
      sessionCards: [],
      schedulesNeedingAttention: [],
      upcomingSchedules: [],
      signals: [],
      recentJobs: [],
      featuredActions: [],
    };
  }

  const buckets = summary.buckets || {};
  const reviewBucket = buckets.awaitingHumanReview || EMPTY_BUCKET;
  const workflowOutcomes = (summary.sessionCards || []).map((session) =>
    deriveWorkflowOutcome(
      session,
      session.workflowFamily === "current-admin" ? summary.currentAdminWorkflowTracker : null
    )
  );
  const workflowOutcomeMap = new Map(
    workflowOutcomes.map((outcome) => [outcome.workflowFamily, outcome])
  );
  const currentAdminOutcome = workflowOutcomeMap.get("current-admin") || null;
  const legislativeOutcome = workflowOutcomeMap.get("legislative") || null;
  const trustBanner = buildTrustBannerData(summary, workflowOutcomes);
  const attentionRows = buildAttentionRows(summary.prioritizedItems || [], workflowOutcomeMap);
  const sessionById = new Map((summary.sessionCards || []).map((session) => [session.id, session]));
  const fallbackAffectedRuns = fallbackRunCount(workflowOutcomes);
  const showCurrentAdminTracker = hasActiveCurrentAdminWorkflow(summary.currentAdminWorkflowTracker);
  const showLegislativeTracker = hasActiveLegislativeWorkflow(summary.legislativeWorkflowTracker);
  const operationalLinks = [
    {
      title: "Workflows",
      href: "/admin/workflows",
      description: "Canonical current-admin and legislative surfaces plus any persisted session inspectors.",
      signal: `${summary.overview.activeSessions} active session record(s)`,
      actionLabel: "Open workflows",
    },
    {
      title: "Review Queue",
      href: "/admin/review-queue",
      description: "Full operator review queue with current-admin and legislative follow-up items.",
      signal: `${summary.reviewQueueSummary.totalItems || 0} canonical queue item(s)`,
      actionLabel: "Open review queue",
    },
    {
      title: "Source Curation",
      href: "/admin/source-curation",
      description:
        "Human-in-the-loop source attribution follow-up backed by integrity artifacts and confirmed curation drafts.",
      signal: "Manual source follow-up surface",
      actionLabel: "Open source curation",
    },
    {
      title: "Jobs",
      href: "/admin/jobs",
      description: "Broker-backed job history, failures, runtime metadata, and reruns.",
      signal: `${summary.recentJobs?.length || 0} recent job(s)`,
      actionLabel: "Open jobs",
    },
    {
      title: "Artifacts",
      href: "/admin/artifacts",
      description: "Full canonical artifact catalog with path-first workflow lineage.",
      signal: `${summary.blockingArtifacts?.length || 0} missing artifact signal(s)`,
      actionLabel: "Open artifacts",
    },
    {
      title: "Schedules",
      href: "/admin/schedules",
      description: "Scheduled safe preparation steps and their last broker-backed run state.",
      signal: `${summary.overview.overdueSchedules} overdue schedule(s)`,
      actionLabel: "Open schedules",
    },
    {
      title: "Tools",
      href: "/admin/tools",
      description: "Verification reports, registry truth, and deterministic verification commands.",
      signal: summary.verificationBanner
        ? `${humanizeToken(summary.verificationBanner.status)} verification`
        : "No verification banner",
      actionLabel: "Open tools",
    },
  ];

  return (
    <main className="mx-auto max-w-[1700px] space-y-4 px-4 py-4">
      <OperatorPageAutoRefresh />

      <section className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-wide text-[#6B7280]">Operator Command Center</p>
        <h1 className="text-lg font-semibold text-[#1F2937]">What happened, what is trustworthy, and what needs action next</h1>
        <p className="text-[11px] text-[#6B7280]">
          This page is optimized for trust, triage, and the single next safe action across broker-backed workflow work.
        </p>
      </section>

      {loadError ? (
        <section className="rounded border border-[#FDE68A] bg-[#FFFBEB] p-3 text-[11px] text-[#B45309]">
          <div className="font-medium">Dashboard fallback</div>
          <p className="mt-1">{loadError}</p>
          <div className="mt-2 flex flex-wrap gap-3">
            <TableLink href="/admin/tools">Open tools</TableLink>
            <TableLink href="/admin/jobs">Open jobs</TableLink>
            <TableLink href="/admin/workflows">Open sessions</TableLink>
            <TableLink href="/admin/command">Open command console</TableLink>
          </div>
        </section>
      ) : null}

      <TrustBanner banner={trustBanner} />

      <section className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        <DashboardCounter label="Active Workflows" value={summary.overview.activeSessions} href="/admin/workflows" />
        <DashboardCounter label="Needs Review" value={summary.reviewQueueSummary.totalItems || 0} href="/admin/review-queue" />
        <DashboardCounter label="Blocked" value={summary.overview.blockedSessions} href="/admin/workflows" />
        <DashboardCounter label="Fallback-Affected Runs" value={fallbackAffectedRuns} href="#workflow-outcome-summaries" />
        <DashboardCounter label="Failed Jobs" value={summary.overview.recentFailures} href="#recent-workflow-runs" />
        <DashboardCounter label="Ready Next Steps" value={summary.overview.readyToRun} href="/admin/workflows" />
      </section>

      <AttentionTable rows={attentionRows} />

      <WorkflowSummarySection
        currentAdminOutcome={currentAdminOutcome}
        legislativeOutcome={legislativeOutcome}
      />

      {showCurrentAdminTracker ? (
        <CurrentAdminWorkflowTracker
          tracker={summary.currentAdminWorkflowTracker}
          compact
          eyebrow="Current-Admin Pipeline"
          title="Current-admin step tracker"
          description="One canonical step is active at a time. Use this to continue the current-admin workflow without reconstructing the pipeline state."
        />
      ) : null}

      {showLegislativeTracker ? (
        <LegislativeWorkflowTracker
          tracker={summary.legislativeWorkflowTracker}
          compact
          eyebrow="Legislative Pipeline"
          title="Legislative step tracker"
          description="One canonical step is active at a time. Use this to continue the legislative workflow without reconstructing the pipeline state."
        />
      ) : null}

      <RecentWorkflowRunsTable
        jobs={summary.recentJobs || []}
        sessionById={sessionById}
        workflowOutcomeMap={workflowOutcomeMap}
      />

      <ReviewQueueTable
        items={reviewBucket.items || []}
        workflowOutcomeMap={workflowOutcomeMap}
      />

      <OperationalPagesSection links={operationalLinks} />
    </main>
  );
}
