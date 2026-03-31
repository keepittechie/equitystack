import { getOperatorRecommendationFeedbackSummary } from "./operatorRecommendationFeedback.js";
import { shapeOperatorRecommendations } from "./operatorRecommendationQualityService.js";

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

function createRecommendation({
  id,
  recommendation,
  reason,
  suggested_action,
  href,
  priority,
  source,
  scenario_id = null,
  scenario_label = null,
  supporting_signals = [],
  evidence_summary = "",
  dedupe_key = null,
}) {
  return {
    id,
    recommendation,
    reason,
    suggested_action,
    href,
    priority,
    source,
    scenario_id,
    scenario_label,
    supporting_signals,
    evidence_summary,
    dedupe_key,
  };
}

function addRecommendation(target, entry) {
  if (!entry || target.some((item) => item.id === entry.id)) {
    return;
  }
  target.push(entry);
}

function buildFrictionRecommendations(frictionSignals = []) {
  const recommendations = [];

  for (const signal of frictionSignals) {
    if (signal.type === "repeated_blocked_action") {
      const supportingSignals = [signal.summary];
      if (signal.action_id === "current_admin_precommit") {
        addRecommendation(
          recommendations,
          createRecommendation({
            id: "friction-current-admin-precommit",
            recommendation: "Check pre-commit readiness before retrying the blocked action.",
            reason: "The same blocked action has repeated recently.",
            suggested_action: "Open the pre-commit workflow and inspect the latest blockers.",
            href: "/admin/pre-commit",
            priority: 100,
            source: "friction",
            scenario_id: "blocked_action_loop",
            scenario_label: "Blocked action loop",
            supporting_signals: supportingSignals,
            evidence_summary: signal.summary,
            dedupe_key: "precommit-readiness",
          })
        );
      } else {
        addRecommendation(
          recommendations,
          createRecommendation({
            id: `friction-blocked-${signal.action_id || "unknown"}`,
            recommendation:
              "A blocked action is being retried repeatedly. Inspect readiness before retrying.",
            reason: "Repeated blocked actions usually mean a prerequisite step is missing.",
            suggested_action: "Open the workflow console with a guided status summary.",
            href: buildOperatorConsoleHref({ actionId: "show_attention" }),
            priority: 95,
            source: "friction",
            scenario_id: "blocked_action_loop",
            scenario_label: "Blocked action loop",
            supporting_signals: supportingSignals,
            evidence_summary: signal.summary,
            dedupe_key: `friction-blocked-${signal.action_id || "unknown"}`,
          })
        );
      }
    }

    if (signal.type === "repeated_failed_action") {
      addRecommendation(
        recommendations,
        createRecommendation({
          id: `friction-failed-${signal.action_id || "unknown"}`,
          recommendation: "A failing action is repeating. Inspect the latest logs before retrying.",
          reason: "Repeated failures usually need diagnosis rather than another retry.",
          suggested_action: "Open logs and review the latest failure context.",
        href: "/admin/logs",
        priority: 98,
        source: "friction",
        scenario_id: "repeated_failure",
        scenario_label: "Repeated failure",
        supporting_signals: [signal.summary],
        evidence_summary: signal.summary,
        dedupe_key: "inspect-latest-logs",
        })
      );
    }

    if (signal.type === "no_recent_success") {
      addRecommendation(
        recommendations,
        createRecommendation({
          id: "friction-no-success",
          recommendation:
            "No recent successful actions were recorded. Start with a system status summary.",
          reason: "A clean status summary is the safest first diagnostic step when the recent window has no success.",
          suggested_action: "Open the workflow console with a status summary prefilled.",
          href: buildOperatorConsoleHref({ actionId: "summarize_state" }),
          priority: 99,
          source: "friction",
          scenario_id: "stalled_workflow",
          scenario_label: "Stalled workflow",
          supporting_signals: [signal.summary],
          evidence_summary: signal.summary,
          dedupe_key: "status-summary",
        })
      );
    }
  }

  return recommendations;
}

function buildWorkflowRecommendations({ currentAdminSummary, legislativeSummary }) {
  const recommendations = [];

  if (currentAdminSummary?.pending_review > 0) {
    addRecommendation(
      recommendations,
      createRecommendation({
        id: "workflow-current-admin-review",
        recommendation: "Current-admin still has pending approvals.",
        reason: currentAdminSummary.why_this_matters,
        suggested_action:
          "Open the current-admin review workspace and finish operator decisions.",
        href: "/admin/current-admin-review",
        priority: 85,
        source: "workflow",
        scenario_id: "pending_approval_backlog",
        scenario_label: "Pending approval backlog",
        supporting_signals: [
          `Workflow currently has ${currentAdminSummary.pending_review} pending current-admin approvals.`,
          currentAdminSummary.artifact_signal,
        ],
        evidence_summary: currentAdminSummary.artifact_signal,
        dedupe_key: "current-admin-review",
      })
    );
  }

  if (legislativeSummary?.pending_review > 0) {
    addRecommendation(
      recommendations,
      createRecommendation({
        id: "workflow-legislative-review",
        recommendation: "Legislative approval decisions are still pending.",
        reason: legislativeSummary.why_this_matters,
        suggested_action: "Open the legislative workflow and review the bundle actions.",
        href: "/admin/legislative-workflow",
        priority: 84,
        source: "workflow",
        scenario_id: "pending_approval_backlog",
        scenario_label: "Pending approval backlog",
        supporting_signals: [
          `Workflow currently has ${legislativeSummary.pending_review} pending legislative approvals.`,
          legislativeSummary.artifact_signal,
        ],
        evidence_summary: legislativeSummary.artifact_signal,
        dedupe_key: "legislative-review",
      })
    );
  }

  if (currentAdminSummary?.safe_next_action === "run dry-run") {
    addRecommendation(
      recommendations,
      createRecommendation({
        id: "workflow-current-admin-dry-run",
        recommendation: "Current-admin looks ready for the next supervised dry-run step.",
        reason: currentAdminSummary.safe_next_action_reason,
        suggested_action: "Review the latest current-admin import status.",
        href: "/admin/import-history",
        priority: 70,
        source: "workflow",
        scenario_id: "import_ready_state",
        scenario_label: "Import-ready state",
        supporting_signals: [
          "Workflow safe next action is run dry-run.",
          currentAdminSummary.safe_next_action_reason,
        ],
        evidence_summary: currentAdminSummary.safe_next_action_reason,
        dedupe_key: "current-admin-dry-run",
      })
    );
  }

  if (legislativeSummary?.safe_next_action === "run dry-run") {
    addRecommendation(
      recommendations,
      createRecommendation({
        id: "workflow-legislative-dry-run",
        recommendation: "Legislative looks ready for the next supervised dry-run step.",
        reason: legislativeSummary.safe_next_action_reason,
        suggested_action: "Open the workflow console with legislative dry-run prefilled.",
        href: buildOperatorConsoleHref({ actionId: "legislative_apply_dry_run" }),
        priority: 69,
        source: "workflow",
        scenario_id: "import_ready_state",
        scenario_label: "Import-ready state",
        supporting_signals: [
          "Workflow safe next action is run dry-run.",
          legislativeSummary.safe_next_action_reason,
        ],
        evidence_summary: legislativeSummary.safe_next_action_reason,
        dedupe_key: "legislative-dry-run",
      })
    );
  }

  return recommendations;
}

function buildAnalyticsRecommendations(analytics) {
  const recommendations = [];

  if (analytics?.most_recent_failure) {
    addRecommendation(
      recommendations,
      createRecommendation({
        id: `analytics-recent-failure-${analytics.most_recent_failure.action_id || "unknown"}`,
        recommendation: "A recent operator action failed. Review logs before retrying.",
        reason: "Recent failures usually produce the clearest short-term guidance.",
        suggested_action: "Open the latest logs and inspect the failure context.",
        href: "/admin/logs",
        priority: 90,
        source: "analytics",
        scenario_id: "repeated_failure",
        scenario_label: "Repeated failure",
        supporting_signals: [
          analytics.most_recent_failure.summary,
          `Most recent failure was recorded at ${analytics.most_recent_failure.timestamp}.`,
        ],
        evidence_summary: analytics.most_recent_failure.summary,
        dedupe_key: "inspect-latest-logs",
      })
    );
  }

  if (analytics?.most_blocked_actions?.[0]?.count > 0) {
    addRecommendation(
      recommendations,
      createRecommendation({
        id: `analytics-most-blocked-${analytics.most_blocked_actions[0].action_id}`,
        recommendation: "A blocked action is showing up repeatedly in operator history.",
        reason:
          "Repeated blocked attempts usually indicate missing prerequisites or unclear workflow state.",
        suggested_action: "Open the workflow console with a guided attention summary.",
        href: buildOperatorConsoleHref({ actionId: "show_attention" }),
        priority: 80,
        source: "analytics",
        scenario_id: "blocked_action_loop",
        scenario_label: "Blocked action loop",
        supporting_signals: [
          `${analytics.most_blocked_actions[0].action_label} is currently the most blocked operator action.`,
          `${analytics.most_blocked_actions[0].count} blocked attempts were recorded recently.`,
        ],
        evidence_summary: `${analytics.most_blocked_actions[0].action_label} is currently the most blocked operator action.`,
        dedupe_key: `most-blocked-${analytics.most_blocked_actions[0].action_id}`,
      })
    );
  }

  return recommendations;
}

function buildTraceRecommendations(trace) {
  const recommendations = [];
  if (!trace) {
    return recommendations;
  }

  if (trace.status === "blocked") {
    addRecommendation(
      recommendations,
      createRecommendation({
        id: `trace-blocked-${trace.mapped_action_id || "unknown"}`,
        recommendation:
          "This action is blocked. Inspect the prerequisite workflow state before retrying.",
        reason: "The latest trace ended in a blocked state.",
        suggested_action:
          trace.mapped_action_id === "current_admin_precommit"
            ? "Open the pre-commit workflow and inspect readiness."
            : "Open the suggested next step before retrying the action.",
        href: trace.next_recommended_step?.href || "/admin",
        priority: 96,
        source: "trace",
        scenario_id: "blocked_action_loop",
        scenario_label: "Blocked action",
        supporting_signals: [
          "Last trace ended in blocked state.",
          trace.blocked_reason || trace.summary,
        ],
        evidence_summary: trace.blocked_reason || trace.summary,
        dedupe_key: `trace-blocked-${trace.mapped_action_id || "unknown"}`,
      })
    );
  }

  if (trace.status === "failed") {
    addRecommendation(
      recommendations,
      createRecommendation({
        id: `trace-failed-${trace.mapped_action_id || "unknown"}`,
        recommendation: "This action failed. Check logs or related artifacts before retrying.",
        reason: "The latest trace ended in a failed state.",
        suggested_action: "Open the latest logs, then review the suggested next step.",
        href:
          trace.artifact_references?.find((entry) => entry.artifact_type === "log file")?.href ||
          "/admin/logs",
        priority: 97,
        source: "trace",
        scenario_id: "repeated_failure",
        scenario_label: "Failed action",
        supporting_signals: [
          "Last trace ended in failed state.",
          trace.failure_reason || trace.summary,
        ],
        evidence_summary: trace.failure_reason || trace.summary,
        dedupe_key: "inspect-latest-logs",
      })
    );
  }

  if (trace.status === "success" && trace.next_recommended_step?.href) {
    addRecommendation(
      recommendations,
      createRecommendation({
        id: `trace-success-${trace.mapped_action_id || "unknown"}`,
        recommendation: "The last action succeeded. Continue with the next safe workflow step.",
        reason: "The latest trace completed successfully and produced a next-step handoff.",
        suggested_action: trace.next_recommended_step.label,
        href: trace.next_recommended_step.href,
        priority: 60,
        source: "trace",
        scenario_id: "import_ready_state",
        scenario_label: "Next safe step ready",
        supporting_signals: [
          "Last trace completed successfully.",
          trace.summary,
        ],
        evidence_summary: trace.summary,
        dedupe_key: `trace-success-${trace.mapped_action_id || "unknown"}`,
      })
    );
  }

  return recommendations;
}

export async function buildOperatorRecommendations({
  analytics,
  currentAdminSummary = null,
  legislativeSummary = null,
  trace = null,
  limit = 5,
}) {
  const rawRecommendations = [
    ...buildFrictionRecommendations(analytics?.potential_friction || []),
    ...buildAnalyticsRecommendations(analytics),
    ...buildTraceRecommendations(trace),
    ...buildWorkflowRecommendations({
      currentAdminSummary,
      legislativeSummary,
    }),
  ];
  const feedbackSummaryById = await getOperatorRecommendationFeedbackSummary();

  return shapeOperatorRecommendations({
    recommendations: rawRecommendations,
    feedbackSummaryById,
    limit,
  });
}
