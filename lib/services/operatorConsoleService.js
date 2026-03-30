import { promises as fs } from "node:fs";
import path from "node:path";
import { getAdminCommandCenterData } from "./adminCommandCenterService.js";
import {
  runCurrentAdministrationDiscover,
  runCurrentAdministrationPrecommit,
  runCurrentAdministrationStatus,
} from "./currentAdministrationWorkflowRuntimeService.js";
import { runLegislativeApply } from "./legislativeWorkflowRuntimeService.js";
import {
  getOperatorActionById,
  getOperatorActionRegistry,
} from "@/lib/operator/operatorActionRegistry.js";
import {
  appendOperatorActionHistory,
  getOperatorActionHistoryPath,
  readOperatorActionHistory,
} from "@/lib/operator/operatorActionHistory.js";
import {
  resolveExactOperatorActionFromInput,
} from "@/lib/operator/operatorActionUtils.js";
import { getOperatorAnalytics } from "@/lib/operator/operatorAnalyticsService.js";
import { buildOperatorRecommendations } from "@/lib/operator/operatorRecommendationService.js";

const PROJECT_ROOT = process.cwd();
const PYTHON_LOGS_DIR = path.join(PROJECT_ROOT, "python", "logs");

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function findLatestEquityStackLogReference() {
  const entries = await fs.readdir(PYTHON_LOGS_DIR, { withFileTypes: true }).catch(() => []);
  const logFiles = entries
    .filter((entry) => entry.isFile() && entry.name.startsWith("equitystack-") && entry.name.endsWith(".log"))
    .map((entry) => path.join(PYTHON_LOGS_DIR, entry.name));

  if (!logFiles.length) {
    return null;
  }

  const withStats = await Promise.all(
    logFiles.map(async (filePath) => ({
      filePath,
      stat: await fs.stat(filePath),
    }))
  );

  const latest = withStats.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)[0];
  if (!latest) {
    return null;
  }

  return {
    label: "Latest EquityStack log",
    artifact_type: "log file",
    path: latest.filePath,
    href: "/admin/logs",
  };
}

function buildSummary(commandCenter) {
  return [
    `Current-admin is ${commandCenter.current_admin_summary.state} with ${commandCenter.current_admin_summary.pending_review} pending approvals.`,
    `Legislative is ${commandCenter.legislative_summary.state} with ${commandCenter.legislative_summary.pending_review} pending approvals.`,
    `Blocked workflows: ${commandCenter.global_indicators.blocked_workflows}.`,
  ].join(" ");
}

function blockedResult({
  userInput,
  action,
  summary,
  nextStep,
  artifactReferences = [],
  durationMs = null,
  retryGuidance = null,
}) {
  return {
    user_input: userInput || null,
    mapped_action_id: action.id,
    action_label: action.label,
    workflow_type: action.workflow,
    execution_path: action.execution_method,
    status: "blocked",
    summary,
    blocked_reason: summary,
    failure_reason: null,
    execution_duration_ms: durationMs,
    was_blocked: true,
    had_artifacts: artifactReferences.length > 0,
    artifact_references: artifactReferences,
    next_recommended_step: nextStep,
    safety_note:
      "No data was modified. The action stopped inside the existing readiness and approval guardrails.",
    retry_guidance:
      retryGuidance ||
      "Retry only after you resolve the prerequisite or inspect the workflow state that blocked this action.",
    command: null,
    stdout: "",
    stderr: "",
  };
}

function failedResult({
  userInput,
  action = null,
  summary,
  nextStep,
  artifactReferences = [],
  durationMs = null,
}) {
  return {
    user_input: userInput || null,
    mapped_action_id: action?.id || null,
    action_label: action?.label || null,
    workflow_type: action?.workflow || null,
    execution_path:
      action?.execution_method ||
      "Registry-only resolution; free-text must match a known action or synonym exactly.",
    status: "failed",
    summary,
    blocked_reason: null,
    failure_reason: summary,
    execution_duration_ms: durationMs,
    was_blocked: false,
    had_artifacts: artifactReferences.length > 0,
    artifact_references: artifactReferences,
    next_recommended_step: nextStep,
    safety_note:
      "No approval or import guardrail was bypassed. Review logs and artifacts before deciding whether retrying is useful.",
    retry_guidance:
      "Retry only after diagnosis. Repeating the same failing action without new information is usually not useful.",
    command: null,
    stdout: "",
    stderr: "",
  };
}

function buildTraceSafetyNote(actionId) {
  if (actionId === "summarize_state" || actionId === "show_attention" || actionId === "current_admin_status") {
    return "No data was modified. This was a read-only supervised action.";
  }

  if (actionId === "legislative_apply_dry_run") {
    return "No import was applied. This action stayed in dry-run mode and inside the existing guardrails.";
  }

  return "The action ran through the wrapped supervised path and stayed inside the existing guardrails.";
}

function buildRetryGuidance(actionId) {
  if (actionId === "summarize_state" || actionId === "show_attention" || actionId === "current_admin_status") {
    return "Retrying is safe if you need a fresher read of the current workflow state.";
  }

  if (actionId === "legislative_apply_dry_run" || actionId === "current_admin_precommit") {
    return "Retry only if the underlying workflow state or artifacts have changed.";
  }

  return "Retry only after you confirm the next safe step from the resulting artifacts or logs.";
}

function unknownActionResult(userInput) {
  return {
    ...failedResult({
      userInput,
      summary:
        "Unknown action. No command was run. Use a quick action or an exact supported phrase from the registry.",
      nextStep: {
        label: "Open the operator console quick actions",
        href: "/admin/operator-console",
      },
    }),
    failure_reason: "unknown_action",
  };
}

function buildHistoryEntry(trace) {
  return {
    action_id: trace.mapped_action_id,
    action_label: trace.action_label,
    workflow_type: trace.workflow_type || "unknown",
    status: trace.status,
    summary: trace.summary,
    execution_path: trace.execution_path,
    user_input: trace.user_input,
    execution_duration_ms: Number.isFinite(trace.execution_duration_ms)
      ? trace.execution_duration_ms
      : null,
    was_blocked: Boolean(trace.was_blocked),
    had_artifacts: Boolean(trace.had_artifacts),
  };
}

function buildArtifactReferences(result, commandCenter, actionId) {
  switch (actionId) {
    case "current_admin_discover":
      return [
        {
          label: "Current-admin review workspace",
          artifact_type: "review artifact",
          path: commandCenter.current_admin.batch?.paths?.review || null,
          href: "/admin/current-admin-review",
        },
      ].filter((entry) => entry.path || entry.href);
    case "current_admin_status":
      return [
        {
          label: "Current-admin queue",
          artifact_type: "queue artifact",
          path: commandCenter.current_admin.batch?.paths?.queue || null,
          href: "/admin/current-admin-review",
        },
      ].filter((entry) => entry.path || entry.href);
    case "current_admin_precommit":
      return [
        {
          label: "Pre-commit artifact",
          artifact_type: "pre-commit report",
          path: commandCenter.current_admin.latest_pre_commit_review?.file_path || null,
          href: "/admin/pre-commit",
        },
      ].filter((entry) => entry.path || entry.href);
    case "legislative_apply_dry_run":
      return [
        {
          label: "Legislative apply report",
          artifact_type: "apply report",
          path: result.workspace?.apply_report?.path || null,
          href: "/admin/legislative-workflow",
        },
      ].filter((entry) => entry.path || entry.href);
    case "summarize_state":
    case "show_attention":
      return [
        {
          label: "Operator action history",
          artifact_type: "history log",
          path: getOperatorActionHistoryPath(),
          href: "/admin/operator-console",
        },
      ];
    default:
      return [];
  }
}

function buildNextStep(commandCenter, actionId) {
  switch (actionId) {
    case "current_admin_discover":
    case "current_admin_status":
      return {
        label: "Open current-admin workflow",
        href: "/admin/current-admin-review",
      };
    case "current_admin_precommit":
      return {
        label: "Inspect pre-commit readiness",
        href: "/admin/pre-commit",
      };
    case "legislative_apply_dry_run":
      return {
        label: "Inspect legislative workflow",
        href: "/admin/legislative-workflow",
      };
    case "summarize_state":
    case "show_attention":
    default:
      return {
        label:
          commandCenter.quick_actions[0]?.label || "Return to the dashboard",
        href: commandCenter.quick_actions[0]?.href || "/admin",
      };
  }
}

function checkAllowedState(action, commandCenter) {
  if (!action.allowed_states?.length) {
    return { allowed: true, reason: null, nextStep: null, retryGuidance: null };
  }

  const workflowState =
    action.workflow === "current-admin"
      ? commandCenter.current_admin_summary.state
      : action.workflow === "legislative"
        ? commandCenter.legislative_summary.state
        : null;

  if (!workflowState || action.allowed_states.includes(workflowState)) {
    return { allowed: true, reason: null, nextStep: null, retryGuidance: null };
  }

  if (action.id === "legislative_apply_dry_run") {
    return {
      allowed: false,
      reason:
        `Legislative apply preview is blocked because the workflow is still in ${workflowState}. ` +
        "This means no review bundle is ready for apply preview yet.",
      nextStep: {
        label: "Open legislative workflow and inspect the prerequisite review step",
        href: "/admin/legislative-workflow",
      },
      retryGuidance:
        "Do not retry legislative apply preview until the workflow leaves DISCOVERY_READY and the review bundle is ready.",
    };
  }

  return {
    allowed: false,
    reason: `${action.label} is not allowed while ${action.workflow} is in state ${workflowState}.`,
    nextStep: null,
    retryGuidance: null,
  };
}

function buildQuickActions() {
  return getOperatorActionRegistry().map((action) => ({
    id: action.id,
    label: action.label,
    canonical_input: action.canonical_input,
    description: action.description,
    execution_path: action.execution_method,
    workflow: action.workflow,
    requires_confirmation: action.requires_confirmation,
    synonyms: action.synonyms || [],
  }));
}

async function executeMappedAction(action, commandCenter) {
  switch (action.id) {
    case "current_admin_discover":
      return runCurrentAdministrationDiscover();
    case "current_admin_status":
      return runCurrentAdministrationStatus();
    case "current_admin_precommit": {
      const queuePath = commandCenter.current_admin.batch?.paths?.queue;
      if (!queuePath) {
        throw new Error(
          "No canonical current-admin queue artifact is available for pre-commit."
        );
      }
      return runCurrentAdministrationPrecommit({ queuePath });
    }
    case "legislative_apply_dry_run":
      return runLegislativeApply({ mode: "dry-run" });
    case "summarize_state":
    case "show_attention":
      return null;
    default:
      throw new Error(`No executor is configured for action ${action.id}.`);
  }
}

export async function getOperatorConsoleQuickActions() {
  return buildQuickActions();
}

export async function getOperatorConsoleState() {
  const [commandCenter, history, analytics] = await Promise.all([
    getAdminCommandCenterData(),
    readOperatorActionHistory(),
    getOperatorAnalytics(),
  ]);

  const initialTrace = {
    user_input: null,
    mapped_action_id: "summarize_state",
    action_label: "Summarize Latest Workflow State",
    execution_path:
      "Read-only summary of canonical current-admin and legislative workflow services",
    status: "success",
    summary: buildSummary(commandCenter),
    artifact_references: [
      {
        label: "Operator action history",
        artifact_type: "history log",
        path: getOperatorActionHistoryPath(),
        href: "/admin/operator-console",
      },
    ],
    next_recommended_step: {
      label:
        commandCenter.quick_actions[0]?.label || "Return to the dashboard",
      href: commandCenter.quick_actions[0]?.href || "/admin",
    },
    command: null,
    stdout: "",
    stderr: "",
  };
  initialTrace.contextual_recommendations = await buildOperatorRecommendations({
    analytics,
    currentAdminSummary: commandCenter.current_admin_summary,
    legislativeSummary: commandCenter.legislative_summary,
    trace: initialTrace,
    limit: 4,
  });

  return {
    quick_actions: buildQuickActions(),
    history,
    initial_trace: initialTrace,
  };
}

export async function executeOperatorConsoleRequest({ actionId, message }) {
  const userInput = normalizeString(message);
  const directAction = actionId ? getOperatorActionById(actionId) : null;
  const resolvedAction =
    directAction || resolveExactOperatorActionFromInput(getOperatorActionRegistry(), userInput);
  const commandCenter = await getAdminCommandCenterData();

  if (!resolvedAction) {
    const trace = unknownActionResult(userInput);
    const history = await appendOperatorActionHistory(buildHistoryEntry(trace));
    const analytics = await getOperatorAnalytics();
    trace.contextual_recommendations = await buildOperatorRecommendations({
      analytics,
      currentAdminSummary: commandCenter.current_admin_summary,
      legislativeSummary: commandCenter.legislative_summary,
      trace,
      limit: 4,
    });

    return {
      trace,
      history,
      quick_actions: buildQuickActions(),
    };
  }

  const stateGuard = checkAllowedState(resolvedAction, commandCenter);
  if (!stateGuard.allowed) {
    const trace = blockedResult({
      userInput,
      action: resolvedAction,
      summary: stateGuard.reason,
      artifactReferences: [],
      nextStep: stateGuard.nextStep || buildNextStep(commandCenter, resolvedAction.id),
      retryGuidance: stateGuard.retryGuidance,
    });
    const history = await appendOperatorActionHistory(buildHistoryEntry(trace));
    const analytics = await getOperatorAnalytics();
    trace.contextual_recommendations = await buildOperatorRecommendations({
      analytics,
      currentAdminSummary: commandCenter.current_admin_summary,
      legislativeSummary: commandCenter.legislative_summary,
      trace,
      limit: 4,
    });

    return {
      trace,
      history,
      quick_actions: buildQuickActions(),
    };
  }

  const startedAt = Date.now();
  try {
    const executionResult = await executeMappedAction(resolvedAction, commandCenter);
    const durationMs = Date.now() - startedAt;
    const refreshedCommandCenter = await getAdminCommandCenterData();
    const artifactReferences = buildArtifactReferences(
      { workspace: executionResult?.workspace || null },
      refreshedCommandCenter,
      resolvedAction.id
    );
    const logReference = await findLatestEquityStackLogReference();
    if (logReference) {
      artifactReferences.push(logReference);
    }
    const trace = {
      user_input: userInput || null,
      mapped_action_id: resolvedAction.id,
      action_label: resolvedAction.label,
      workflow_type: resolvedAction.workflow,
      execution_path: resolvedAction.execution_method,
      status: "success",
      summary:
        resolvedAction.id === "summarize_state" ||
        resolvedAction.id === "show_attention"
          ? buildSummary(refreshedCommandCenter)
          : `${resolvedAction.label} completed through the wrapped service layer.`,
      blocked_reason: null,
      failure_reason: null,
      execution_duration_ms: durationMs,
      was_blocked: false,
      had_artifacts: artifactReferences.length > 0,
      artifact_references: artifactReferences,
      next_recommended_step: buildNextStep(refreshedCommandCenter, resolvedAction.id),
      safety_note: buildTraceSafetyNote(resolvedAction.id),
      retry_guidance: buildRetryGuidance(resolvedAction.id),
      command: executionResult?.command || null,
      stdout: executionResult?.stdout || "",
      stderr: executionResult?.stderr || "",
    };

    const history = await appendOperatorActionHistory(buildHistoryEntry(trace));
    const analytics = await getOperatorAnalytics();
    trace.contextual_recommendations = await buildOperatorRecommendations({
      analytics,
      currentAdminSummary: refreshedCommandCenter.current_admin_summary,
      legislativeSummary: refreshedCommandCenter.legislative_summary,
      trace,
      limit: 4,
    });

    return {
      trace,
      history,
      quick_actions: buildQuickActions(),
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const logReference = await findLatestEquityStackLogReference();
    const trace = failedResult({
      userInput,
      action: resolvedAction,
      summary: normalizeString(error.message) || "The action failed.",
      artifactReferences: logReference ? [logReference] : [],
      nextStep: buildNextStep(commandCenter, resolvedAction.id),
      durationMs,
    });
    const history = await appendOperatorActionHistory(buildHistoryEntry(trace));
    const analytics = await getOperatorAnalytics();
    trace.contextual_recommendations = await buildOperatorRecommendations({
      analytics,
      currentAdminSummary: commandCenter.current_admin_summary,
      legislativeSummary: commandCenter.legislative_summary,
      trace,
      limit: 4,
    });

    return {
      trace,
      history,
      quick_actions: buildQuickActions(),
    };
  }
}
