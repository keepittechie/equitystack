import { getCurrentAdministrationOperatorWorkspace } from "./currentAdministrationReviewInsightsService.js";
import { getLegislativeWorkflowWorkspace } from "./legislativeWorkflowInsightsService.js";
import { getOperatorAnalytics } from "@/lib/operator/operatorAnalyticsService.js";
import { buildOperatorRecommendations } from "@/lib/operator/operatorRecommendationService.js";

function countMissingArtifacts(artifactStatus = {}) {
  return Object.values(artifactStatus).filter(
    (artifact) => artifact && !artifact.exists
  ).length;
}

function buildOperatorConsoleHref({ actionId = null, input = null } = {}) {
  const params = new URLSearchParams();
  if (actionId) {
    params.set("action_id", actionId);
  }
  if (input) {
    params.set("input", input);
  }
  const query = params.toString();
  return query ? `/admin/operator-console?${query}` : "/admin/operator-console";
}

function buildCurrentAdminSummary(workspace) {
  const blockers = workspace.blockers || [];
  const permissions = workspace.action_permissions || {};
  const pendingReview = workspace.counts?.pending || 0;
  const importReady = Boolean(permissions.run_import_dry_run?.allowed);
  const precommitReadiness =
    workspace.latest_pre_commit_review?.readiness_status || "missing";

  let safeNextAction = "wait";
  let safeNextActionReason =
    "Current-admin is between states; inspect the workflow workspace before taking the next step.";
  let nextHref = "/admin/current-admin-review";
  let nextLabel = "Open current-admin workflow";

  if (pendingReview > 0) {
    safeNextAction = "review";
    safeNextActionReason =
      "Operator decisions are still missing, so the queue cannot move safely into pre-commit.";
    nextHref = "/admin/current-admin-review";
    nextLabel = "Review current-admin approvals";
  } else if (precommitReadiness === "blocked") {
    safeNextAction = "inspect blocker";
    safeNextActionReason =
      "Pre-commit is blocked, so import preview and apply should not proceed.";
    nextHref = "/admin/pre-commit";
    nextLabel = "Check blocked pre-commit";
  } else if (importReady) {
    safeNextAction = "run dry-run";
    safeNextActionReason =
      "Current-admin has passed the current guardrails and is ready for a supervised dry-run import.";
    nextHref = "/admin/admin-approval";
    nextLabel = "Open admin approval";
  }

  return {
    title: "Current-Admin Workflow",
    state: workspace.batch?.stage || "DISCOVERY_READY",
    pending_review: pendingReview,
    blocked_count: blockers.length,
    precommit_readiness: precommitReadiness,
    import_ready: importReady,
    apply_ready: Boolean(permissions.apply_import?.allowed),
    why_this_matters:
      pendingReview > 0
        ? "Pending current-admin approvals stop the canonical queue from advancing."
        : precommitReadiness === "blocked"
          ? "A blocked pre-commit means import would no longer be trustworthy."
          : importReady
            ? "Import readiness means the batch has cleared the current review and guardrail steps."
            : "Current-admin is being monitored through canonical artifacts.",
    safe_next_action: safeNextAction,
    safe_next_action_reason: safeNextActionReason,
    artifact_signal:
      workspace.batch?.paths?.review && pendingReview > 0
        ? "Review artifact is ready and still awaiting operator decisions."
        : workspace.batch?.paths?.queue && precommitReadiness !== "blocked"
          ? "Canonical queue artifact is present for the current batch."
          : "Current-admin artifacts are being monitored for the next safe step.",
    artifact_path: workspace.batch?.paths?.review || workspace.batch?.paths?.queue || null,
    next_href: nextHref,
    next_label: nextLabel,
    operator_console_href:
      safeNextAction === "review"
        ? buildOperatorConsoleHref({ actionId: "current_admin_status" })
        : safeNextAction === "inspect blocker"
          ? buildOperatorConsoleHref({ actionId: "current_admin_precommit" })
          : buildOperatorConsoleHref({ actionId: "current_admin_status" }),
  };
}

function buildLegislativeSummary(workspace) {
  const blockers = workspace.blockers || [];
  const permissions = workspace.action_permissions || {};
  const pendingReview = workspace.counts?.pending_unreviewed_actions || 0;

  let safeNextAction = "wait";
  let safeNextActionReason =
    "Legislative is between states; inspect the workflow workspace before taking the next step.";
  let nextHref = "/admin/legislative-workflow";
  let nextLabel = "Open legislative workflow";

  if (pendingReview > 0) {
    safeNextAction = "review";
    safeNextActionReason =
      "Pending legislative approval decisions block the bundle from moving into apply preview.";
    nextHref = "/admin/legislative-workflow";
    nextLabel = "Open legislative approvals";
  } else if (permissions.run_apply_dry_run?.allowed) {
    safeNextAction = "run dry-run";
    safeNextActionReason =
      "The legislative bundle has been reviewed and is ready for a supervised apply dry-run.";
    nextHref = "/admin/legislative-workflow";
    nextLabel = "Open legislative workflow";
  } else if (blockers.length > 0) {
    safeNextAction = "inspect blocker";
    safeNextActionReason =
      "Legislative blockers should be reviewed before approving or applying changes.";
  }

  return {
    title: "Legislative Workflow",
    state: workspace.workflow_status || "DISCOVERY_READY",
    pending_review: pendingReview,
    blocked_count: blockers.length,
    apply_ready: Boolean(permissions.apply_bundle?.allowed),
    import_ready: Boolean(permissions.apply_import?.allowed),
    why_this_matters:
      pendingReview > 0
        ? "Pending legislative approvals stop the canonical review bundle from advancing."
        : permissions.apply_bundle?.allowed
          ? "Legislative actions are ready for the next supervised step."
          : blockers.length > 0
            ? "Legislative blockers indicate the bundle is not ready for a safe apply/import step."
            : "Legislative is being monitored through canonical artifacts.",
    safe_next_action: safeNextAction,
    safe_next_action_reason: safeNextActionReason,
    artifact_signal:
      workspace.review_bundle?.path && pendingReview > 0
        ? "Review bundle is ready and still awaiting operator approval decisions."
        : workspace.apply_report?.path
          ? "Latest apply report is available for inspection."
          : "Legislative artifacts are being monitored for the next safe step.",
    artifact_path:
      workspace.review_bundle?.path ||
      workspace.apply_report?.path ||
      workspace.import_report?.path ||
      null,
    next_href: nextHref,
    next_label: nextLabel,
    operator_console_href:
      safeNextAction === "run dry-run"
        ? buildOperatorConsoleHref({ actionId: "legislative_apply_dry_run" })
        : buildOperatorConsoleHref({ actionId: "show_attention" }),
  };
}

function buildAttentionItems({ currentAdmin, legislative, currentAdminSummary, legislativeSummary }) {
  const items = [];

  if (currentAdmin.counts?.pending) {
    items.push({
      workflow: "current-admin",
      title: "Current-admin review artifact ready",
      what_is_wrong: `${currentAdmin.counts.pending} item(s) in the current-admin review artifact still need explicit operator decisions.`,
      why_it_matters:
        "Without explicit operator actions, the canonical queue cannot safely advance to pre-commit.",
      recommended_next_step: "Open the current-admin review workspace and finish the pending decisions.",
      href: "/admin/current-admin-review",
      operator_console_href: buildOperatorConsoleHref({ actionId: "current_admin_status" }),
      artifact_path: currentAdmin.batch?.paths?.review || null,
      artifact_label: "Current-admin review artifact",
    });
  }

  if (currentAdmin.latest_pre_commit_review?.readiness_status === "blocked") {
    items.push({
      workflow: "current-admin",
      title: "Pre-commit blocked",
      what_is_wrong:
        currentAdmin.latest_pre_commit_review.readiness_explanation ||
        "The latest pre-commit artifact is blocked.",
      why_it_matters:
        "A blocked pre-commit means import preview and apply should not proceed.",
      recommended_next_step: "Open pre-commit status and resolve the listed blockers.",
      href: "/admin/pre-commit",
      operator_console_href: buildOperatorConsoleHref({ actionId: "current_admin_precommit" }),
      artifact_path: currentAdmin.latest_pre_commit_review.file_path || null,
      artifact_label: "Pre-commit review artifact",
    });
  }

  if (legislative.counts?.pending_unreviewed_actions) {
    items.push({
      workflow: "legislative",
      title: "Review bundle ready, approvals pending",
      what_is_wrong: `${legislative.counts.pending_unreviewed_actions} review-bundle action(s) still need explicit approve or dismiss decisions.`,
      why_it_matters:
        "Unreviewed legislative operator actions block the bundle from moving into apply preview.",
      recommended_next_step: "Open the legislative workflow and classify the pending actions.",
      href: "/admin/legislative-workflow",
      operator_console_href: buildOperatorConsoleHref({ actionId: "show_attention" }),
      artifact_path: legislative.review_bundle?.path || null,
      artifact_label: "Legislative review bundle",
    });
  }

  for (const blocker of legislative.blockers || []) {
    items.push({
      workflow: "legislative",
      title: "Legislative blocker",
      what_is_wrong: blocker,
      why_it_matters:
        "A blocked legislative workflow means the bundle is not yet ready for the next safe step.",
      recommended_next_step: "Open the legislative workflow and inspect the blocker details.",
      href: "/admin/legislative-workflow",
      operator_console_href: buildOperatorConsoleHref({ actionId: "show_attention" }),
      artifact_path: legislative.review_bundle?.path || null,
      artifact_label: "Legislative workflow artifact",
    });
  }

  if (currentAdminSummary.import_ready) {
    items.push({
      workflow: "current-admin",
      title: "Current-admin import preview ready",
      what_is_wrong: "Nothing is blocked; the batch is ready for a supervised dry-run import preview.",
      why_it_matters:
        "Import readiness means the batch has passed the current review and guardrail steps.",
      recommended_next_step: "Open import history and inspect the dry-run path.",
      href: "/admin/admin-approval",
      operator_console_href: buildOperatorConsoleHref({ actionId: "current_admin_status" }),
      artifact_path: currentAdmin.batch?.paths?.queue || null,
      artifact_label: "Current-admin queue artifact",
    });
  }

  if (legislativeSummary.apply_ready) {
    items.push({
      workflow: "legislative",
      title: "Legislative apply ready",
      what_is_wrong: "Approved legislative actions are ready for a supervised apply step.",
      why_it_matters:
        "Apply readiness means the reviewed bundle can move to the next safe execution step.",
      recommended_next_step: "Open the legislative workflow and inspect the apply reports.",
      href: "/admin/legislative-workflow",
      operator_console_href: buildOperatorConsoleHref({ actionId: "legislative_apply_dry_run" }),
      artifact_path: legislative.review_bundle?.path || null,
      artifact_label: "Legislative review bundle",
    });
  }

  return items.slice(0, 12);
}

function buildWhatNowSummary({
  currentAdminSummary,
  legislativeSummary,
  operatorAnalytics,
}) {
  const frictionSignals = operatorAnalytics?.potential_friction || [];
  const repeatedBlocked = frictionSignals.find((item) => item.type === "repeated_blocked_action");
  const repeatedFailed = frictionSignals.find((item) => item.type === "repeated_failed_action");
  const stalled = frictionSignals.find((item) => item.type === "no_recent_success");
  const approvalsPending =
    (currentAdminSummary?.pending_review || 0) + (legislativeSummary?.pending_review || 0);

  if (currentAdminSummary?.precommit_readiness === "blocked") {
    return {
      scenario_id: "blocked_action_loop",
      scenario_label: "System is blocked",
      tone: "attention",
      title: "System is blocked on current-admin pre-commit readiness.",
      summary:
        currentAdminSummary.safe_next_action_reason ||
        "A blocked pre-commit means the workflow cannot move safely toward import preview.",
      next_step_label: "Open pre-commit status",
      next_step_href: "/admin/pre-commit",
      operator_console_href: buildOperatorConsoleHref({ actionId: "current_admin_precommit" }),
      safety_note: "No import or apply step should proceed until this blocker is resolved.",
    };
  }

  if (repeatedBlocked) {
    return {
      scenario_id: "blocked_action_loop",
      scenario_label: "Blocked action loop",
      tone: "attention",
      title: `${repeatedBlocked.action_label || "A workflow action"} is blocked repeatedly.`,
      summary: `${repeatedBlocked.summary} Stop retrying and inspect the missing prerequisite first.`,
      next_step_label: "Open guided attention summary",
      next_step_href: buildOperatorConsoleHref({ actionId: "show_attention" }),
      operator_console_href: buildOperatorConsoleHref({ actionId: "show_attention" }),
      safety_note: "Blocked actions stay inside readiness guardrails and do not advance the workflow.",
    };
  }

  if (repeatedFailed) {
    return {
      scenario_id: "repeated_failure",
      scenario_label: "Repeated failure",
      tone: "attention",
      title: `${repeatedFailed.action_label || "A workflow action"} is failing repeatedly.`,
      summary: `${repeatedFailed.summary} Review logs and artifacts before deciding whether retrying is useful.`,
      next_step_label: "Open logs",
      next_step_href: "/admin/logs",
      operator_console_href: buildOperatorConsoleHref({ actionId: "summarize_state" }),
      safety_note: "Failures do not bypass approval or import guardrails. Diagnose first, then retry.",
    };
  }

  if (stalled) {
    return {
      scenario_id: "stalled_workflow",
      scenario_label: "Workflow appears stalled",
      tone: "attention",
      title: "No recent successful actions were recorded.",
      summary: "The system looks stuck. Start with a status summary before deciding on the next manual step.",
      next_step_label: "Run status summary in Workflow Console",
      next_step_href: buildOperatorConsoleHref({ actionId: "summarize_state" }),
      operator_console_href: buildOperatorConsoleHref({ actionId: "summarize_state" }),
      safety_note: "A read-only status summary is the safest first recovery step when progress has stalled.",
    };
  }

  if (approvalsPending > 0) {
    const useCurrentAdmin =
      (currentAdminSummary?.pending_review || 0) >= (legislativeSummary?.pending_review || 0);

    return {
      scenario_id: "pending_approval_backlog",
      scenario_label: "Pending approvals",
      tone: "attention",
      title: `${approvalsPending} approval decision(s) are waiting.`,
      summary: useCurrentAdmin
        ? "Current-admin approvals are the clearest next step for moving the workflow forward."
        : "Legislative approval decisions are the clearest next step for moving the workflow forward.",
      next_step_label: useCurrentAdmin
        ? "Open current-admin review"
        : "Open legislative workflow",
      next_step_href: useCurrentAdmin
        ? "/admin/current-admin-review"
        : "/admin/legislative-workflow",
      operator_console_href: useCurrentAdmin
        ? buildOperatorConsoleHref({ actionId: "current_admin_status" })
        : buildOperatorConsoleHref({ actionId: "show_attention" }),
      safety_note: "Nothing will advance past review until the operator records the missing decisions.",
    };
  }

  if (currentAdminSummary?.import_ready || legislativeSummary?.apply_ready || legislativeSummary?.import_ready) {
    const useCurrentAdmin = Boolean(currentAdminSummary?.import_ready);

    return {
      scenario_id: "import_ready_state",
      scenario_label: "Safe to proceed",
      tone: "ready",
      title: useCurrentAdmin
        ? "Current-admin is ready for the next supervised import step."
        : "Legislative is ready for the next supervised dry-run step.",
      summary: useCurrentAdmin
        ? "The current-admin workflow has cleared the present guardrails and can move into dry-run review."
        : "The legislative workflow has cleared review and is ready for a supervised apply dry-run.",
      next_step_label: useCurrentAdmin
        ? "Open admin approval"
        : "Open legislative workflow",
      next_step_href: useCurrentAdmin
        ? "/admin/admin-approval"
        : "/admin/legislative-workflow",
      operator_console_href: useCurrentAdmin
        ? buildOperatorConsoleHref({ actionId: "current_admin_status" })
        : buildOperatorConsoleHref({ actionId: "legislative_apply_dry_run" }),
      safety_note: "Ready does not remove human approval, dry-run separation, or any existing guardrails.",
    };
  }

  return {
    scenario_id: "steady_state",
    scenario_label: "System looks healthy",
    tone: "stable",
    title: "No urgent blockers or approval backlogs are active right now.",
    summary: "The command center is monitoring canonical artifacts and is ready to guide the next supervised step as activity changes.",
    next_step_label: "Review the dashboard",
    next_step_href: "/admin",
    operator_console_href: buildOperatorConsoleHref({ actionId: "show_attention" }),
    safety_note: "The system remains supervised. New artifacts or operator actions will surface here as state changes.",
  };
}

function buildOperationalHealth({
  currentAdminSummary,
  legislativeSummary,
  attentionItems,
  quickActions,
  operatorAnalytics,
  smartRecommendations,
}) {
  const historyExists = (operatorAnalytics?.total_entries || 0) > 0;
  const recommendationCount = smartRecommendations.length;
  const activeFrictionCount = (operatorAnalytics?.potential_friction || []).length;

  return {
    checks: [
      {
        id: "dashboard-sections",
        label: "Dashboard sections are rendering meaningful state",
        status:
          currentAdminSummary?.state && legislativeSummary?.state && quickActions.length
            ? "pass"
            : "attention",
        detail:
          currentAdminSummary?.state && legislativeSummary?.state && quickActions.length
            ? "Workflow summaries and recommended next steps are present."
            : "One or more command-center sections are missing meaningful state.",
      },
      {
        id: "operator-history",
        label: "Operator history is recording",
        status: historyExists ? "pass" : "attention",
        detail: historyExists
          ? `${operatorAnalytics.total_entries} operator history entries are available.`
          : "No operator history exists yet. Use the Workflow Console for a safe status action to initialize activity history.",
      },
      {
        id: "recommendations",
        label: "Recommendations are generating",
        status: recommendationCount || !historyExists ? "pass" : "attention",
        detail: recommendationCount
          ? `${recommendationCount} smart recommendation(s) are active right now.`
          : "No active recommendations are showing. This can be normal when recent activity is light or stable.",
      },
      {
        id: "friction-alerts",
        label: "Active friction alerts",
        status: activeFrictionCount ? "attention" : "pass",
        detail: activeFrictionCount
          ? `${activeFrictionCount} friction alert(s) are active and should be reviewed.`
          : "No active friction alerts are showing in recent history.",
      },
      {
        id: "attention-items",
        label: "Dashboard attention items are available",
        status: attentionItems.length ? "pass" : "pass",
        detail: attentionItems.length
          ? `${attentionItems.length} attention item(s) are available for review.`
          : "No urgent attention items are currently active.",
      },
    ],
  };
}

export async function getAdminCommandCenterData() {
  const [currentAdmin, legislative, operatorAnalytics] = await Promise.all([
    getCurrentAdministrationOperatorWorkspace(),
    getLegislativeWorkflowWorkspace(),
    getOperatorAnalytics(),
  ]);

  const currentAdminSummary = buildCurrentAdminSummary(currentAdmin);
  const legislativeSummary = buildLegislativeSummary(legislative);

  const globalIndicators = {
    blocked_workflows:
      (currentAdmin.blockers?.length ? 1 : 0) +
      (legislative.blockers?.length ? 1 : 0),
    approvals_pending:
      (currentAdmin.counts?.pending || 0) +
      (legislative.counts?.pending_unreviewed_actions || 0),
    imports_ready:
      (currentAdmin.action_permissions?.apply_import?.allowed ? 1 : 0) +
      (legislative.action_permissions?.apply_import?.allowed ? 1 : 0),
    validation_failures: currentAdmin.latest_validation?.issues?.length || 0,
    missing_artifacts:
      countMissingArtifacts(currentAdmin.artifact_status) +
      countMissingArtifacts(legislative.artifact_status),
  };

  const attentionItems = buildAttentionItems({
    currentAdmin,
    legislative,
    currentAdminSummary,
    legislativeSummary,
  });

  const quickActions = [
    {
      label: currentAdminSummary.next_label,
      href: currentAdminSummary.next_href,
      workflow: "current-admin",
      operator_console_href: currentAdminSummary.operator_console_href,
    },
    {
      label: legislativeSummary.next_label,
      href: legislativeSummary.next_href,
      workflow: "legislative",
      operator_console_href: legislativeSummary.operator_console_href,
    },
    {
      label: "Open Admin Approval",
      href: "/admin/admin-approval",
      workflow: "system",
      operator_console_href: buildOperatorConsoleHref({ actionId: "current_admin_status" }),
    },
    {
      label: "Open Workflow Console",
      href: "/admin/operator-console",
      workflow: "system",
      operator_console_href: "/admin/operator-console",
    },
    {
      label: "Review latest import status",
      href: "/admin/admin-approval",
      workflow: "current-admin",
      operator_console_href: buildOperatorConsoleHref({ actionId: "current_admin_status" }),
    },
  ];

  const smartRecommendations = await buildOperatorRecommendations({
    analytics: operatorAnalytics,
    currentAdminSummary,
    legislativeSummary,
    limit: 5,
  });
  const whatNow = buildWhatNowSummary({
    currentAdminSummary,
    legislativeSummary,
    operatorAnalytics,
  });
  const operationalHealth = buildOperationalHealth({
    currentAdminSummary,
    legislativeSummary,
    attentionItems,
    quickActions,
    operatorAnalytics,
    smartRecommendations,
  });

  return {
    current_admin: currentAdmin,
    legislative,
    current_admin_summary: currentAdminSummary,
    legislative_summary: legislativeSummary,
    global_indicators: globalIndicators,
    attention_items: attentionItems,
    quick_actions: quickActions,
    operator_insights: {
      most_used_actions: operatorAnalytics.most_used_actions.slice(0, 5),
      most_blocked_actions: operatorAnalytics.most_blocked_actions.slice(0, 5),
      recent_activity_summary: operatorAnalytics.recent_activity_summary,
      most_recent_failure: operatorAnalytics.most_recent_failure,
    },
    potential_friction: operatorAnalytics.potential_friction,
    smart_recommendations: smartRecommendations,
    what_now: whatNow,
    operational_health: operationalHealth,
  };
}
