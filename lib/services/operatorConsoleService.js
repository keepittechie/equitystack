import { promises as fs } from "node:fs";
import path from "node:path";
import { getAdminCommandCenterData } from "./adminCommandCenterService.js";
import {
  runCurrentAdministrationWorkflowResume,
  runCurrentAdministrationWorkflowStart,
  runCurrentAdministrationDiscover,
  runCurrentAdministrationPrecommit,
  runCurrentAdministrationStatus,
} from "./currentAdministrationWorkflowRuntimeService.js";
import {
  runLegislativeApply,
  runLegislativeRunWithOptions,
} from "./legislativeWorkflowRuntimeService.js";
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
import {
  acquireOperatorExecutionState,
  clearOperatorExecutionState,
  getOperatorExecutionState,
} from "@/lib/operator/operatorExecutionState.js";
import {
  createOperatorExecutionJob,
  getOperatorExecutionJob,
  isTerminalOperatorExecutionJobStatus,
  listOperatorExecutionJobs,
  updateOperatorExecutionJob,
} from "@/lib/operator/operatorExecutionJobs.js";

const PROJECT_ROOT = process.cwd();
const PYTHON_LOGS_DIR = path.join(PROJECT_ROOT, "python", "logs");
const ASYNC_ACTION_IDS = new Set([
  "current_admin_workflow_start",
  "legislative_run",
]);

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
  command = null,
  summary,
  nextStep,
  artifactReferences = [],
  durationMs = null,
  retryGuidance = null,
  stopPoint = null,
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
    stop_point: stopPoint,
    safety_note:
      "No data was modified. The action stopped inside the existing readiness and approval guardrails.",
    retry_guidance:
      retryGuidance ||
      "Retry only after you resolve the prerequisite or inspect the workflow state that blocked this action.",
    command,
    stdout: "",
    stderr: "",
  };
}

function failedResult({
  userInput,
  action = null,
  command = null,
  summary,
  nextStep,
  artifactReferences = [],
  durationMs = null,
  stopPoint = null,
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
    stop_point: stopPoint,
    safety_note:
      "No approval or import guardrail was bypassed. Review logs and artifacts before deciding whether retrying is useful.",
    retry_guidance:
      "Retry only after diagnosis. Repeating the same failing action without new information is usually not useful.",
    command,
    stdout: "",
    stderr: "",
  };
}

function buildTraceSafetyNote(actionId) {
  if (
    actionId === "summarize_state" ||
    actionId === "show_attention" ||
    actionId === "current_admin_status" ||
    actionId === "current_admin_workflow_resume"
  ) {
    return "No data was modified. This was a read-only supervised action.";
  }

  if (actionId === "legislative_apply_dry_run") {
    return "No import was applied. This action stayed in dry-run mode and inside the existing guardrails.";
  }

  return "The action ran through the wrapped supervised path and stayed inside the existing guardrails.";
}

function buildRetryGuidance(actionId) {
  if (
    actionId === "summarize_state" ||
    actionId === "show_attention" ||
    actionId === "current_admin_status" ||
    actionId === "current_admin_workflow_resume"
  ) {
    return "Retrying is safe if you need a fresher read of the current workflow state.";
  }

  if (
    actionId === "legislative_apply_dry_run" ||
    actionId === "current_admin_precommit"
  ) {
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
    execution_id: trace.execution_id || null,
    action_id: trace.mapped_action_id,
    action_label: trace.action_label,
    command: trace.command || null,
    workflow_type: trace.workflow_type || "unknown",
    status: trace.status,
    workflow_status_label:
      trace.status === "failed"
        ? "Failed"
        : trace.status === "blocked"
          ? "Blocked"
          : trace.stop_point?.label || "Complete",
    summary: trace.summary,
    execution_path: trace.execution_path,
    user_input: trace.user_input,
    started_at: trace.started_at || null,
    ended_at: trace.ended_at || null,
    execution_duration_ms: Number.isFinite(trace.execution_duration_ms)
      ? trace.execution_duration_ms
      : null,
    was_blocked: Boolean(trace.was_blocked),
    had_artifacts: Boolean(trace.had_artifacts),
    next_step_label: trace.next_recommended_step?.label || null,
    next_step_href: trace.next_recommended_step?.href || null,
  };
}

function isAsyncAction(action) {
  if (!action?.id) {
    return false;
  }
  return action.execution_mode === "async" || ASYNC_ACTION_IDS.has(action.id);
}

function buildAsyncJobStatusFromTrace(trace) {
  if (trace?.status === "failed") {
    return "failed";
  }
  if (trace?.status === "blocked") {
    return "blocked";
  }
  if (trace?.stop_point?.key === "first_stop") {
    return "stopped_review";
  }
  if (trace?.stop_point?.key === "second_stop") {
    return "stopped_admin_approval";
  }
  return "complete";
}

function buildRunningTrace({
  action,
  commandText,
  userInput,
  executionId = null,
  startedAt = null,
}) {
  return {
    execution_id: executionId,
    user_input: userInput || commandText || null,
    mapped_action_id: action?.id || null,
    action_label: action?.label || "Workflow Command",
    workflow_type: action?.workflow || null,
    execution_path: action?.execution_method || "Wrapped CLI execution",
    status: "running",
    summary:
      "Workflow execution is in progress. The console remains locked until the wrapped command reaches a stop point or completes.",
    blocked_reason: null,
    failure_reason: null,
    started_at: startedAt || new Date().toISOString(),
    ended_at: null,
    execution_duration_ms: null,
    was_blocked: false,
    had_artifacts: false,
    artifact_references: [],
    next_recommended_step: null,
    stop_point: { key: "running", label: "Running" },
    safety_note:
      "The command is running through the canonical wrapper. Review and approval stop points remain enforced.",
    retry_guidance: null,
    command: commandText || null,
    stdout: "",
    stderr: "",
    contextual_recommendations: [],
  };
}

function buildActiveExecutionPayload({
  executionId,
  action,
  commandText,
  userInput,
  startedAt,
  status = "running",
}) {
  return {
    status,
    execution_id: executionId || null,
    started_at: startedAt || new Date().toISOString(),
    action_id: action?.id || null,
    action_label: action?.label || null,
    workflow_type: action?.workflow || null,
    user_input: userInput || commandText || null,
    command: commandText || null,
  };
}

function buildArtifactReferences(result, commandCenter, actionId) {
  switch (actionId) {
    case "current_admin_workflow_start":
      return [
        {
          label: "Current-admin review artifact",
          artifact_type: "review artifact",
          path: result.workspace?.batch?.paths?.review || commandCenter.current_admin.batch?.paths?.review || null,
          href: "/admin/current-admin-review",
        },
        {
          label: "Current-admin manual-review queue",
          artifact_type: "queue artifact",
          path: result.workspace?.batch?.paths?.queue || commandCenter.current_admin.batch?.paths?.queue || null,
          href: "/admin/current-admin-review",
        },
      ].filter((entry) => entry.path || entry.href);
    case "current_admin_workflow_resume":
      return [
        {
          label: "Current-admin review workspace",
          artifact_type: "workflow workspace",
          path: commandCenter.current_admin.batch?.paths?.review || null,
          href: "/admin/current-admin-review",
        },
      ].filter((entry) => entry.path || entry.href);
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
    case "legislative_run":
      return [
        {
          label: "Legislative review bundle",
          artifact_type: "review bundle",
          path: result.workspace?.review_bundle?.path || null,
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
  const currentAdminState = commandCenter.current_admin_summary?.state;
  const legislativeState = commandCenter.legislative_summary?.state;

  if (
    actionId === "current_admin_workflow_start" ||
    actionId === "current_admin_workflow_resume" ||
    actionId === "current_admin_status"
  ) {
    if (currentAdminState === "REVIEW_READY") {
      return {
        label: "Open current-admin review",
        href: "/admin/current-admin-review",
      };
    }
    if (commandCenter.current_admin_summary?.import_ready || currentAdminState === "IMPORT_READY") {
      return {
        label: "Open admin approval",
        href: "/admin/admin-approval",
      };
    }
  }

  switch (actionId) {
    case "current_admin_discover":
      return {
        label: "Open current-admin workflow",
        href: "/admin/current-admin-review",
      };
    case "current_admin_precommit":
      if (commandCenter.current_admin_summary?.import_ready) {
        return {
          label: "Open admin approval",
          href: "/admin/admin-approval",
        };
      }
      return {
        label: "Inspect pre-commit readiness",
        href: "/admin/pre-commit",
      };
    case "legislative_run":
      if (legislativeState === "REVIEW_READY") {
        return {
          label: "Open legislative workflow",
          href: "/admin/legislative-workflow",
        };
      }
      if (
        commandCenter.legislative_summary?.apply_ready ||
        commandCenter.legislative_summary?.import_ready
      ) {
        return {
          label: "Open admin approval",
          href: "/admin/admin-approval",
        };
      }
      return {
        label: "Inspect legislative workflow",
        href: "/admin/legislative-workflow",
      };
    case "legislative_apply_dry_run":
      return commandCenter.legislative_summary?.apply_ready ||
        commandCenter.legislative_summary?.import_ready
        ? {
            label: "Open admin approval",
            href: "/admin/admin-approval",
          }
        : {
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
    template_command: action.template_command || null,
    description: action.description,
    execution_path: action.execution_method,
    workflow: action.workflow,
    execution_mode: action.execution_mode || "sync",
    requires_confirmation: action.requires_confirmation,
    requires_input: Boolean(action.requires_input),
    input_type: action.input_type || null,
    input_label: action.input_label || null,
    input_placeholder: action.input_placeholder || null,
    validation_message: action.validation_message || null,
    synonyms: action.synonyms || [],
  }));
}

function normalizeCommandInput(value) {
  return normalizeString(value).replace(/^\.\//, "./");
}

function tokenizeCommand(commandText) {
  return normalizeCommandInput(commandText).split(/\s+/).filter(Boolean);
}

function stripEquitystackPrefix(tokens) {
  if (!tokens.length) {
    return [];
  }
  if (tokens[0] === "./bin/equitystack" || tokens[0] === "equitystack") {
    return tokens.slice(1);
  }
  return tokens;
}

function readOptionValue(tokens, index) {
  const token = tokens[index];
  if (!token) {
    return { consumed: 0, value: "" };
  }
  if (token.includes("=")) {
    return { consumed: 1, value: token.split("=").slice(1).join("=") };
  }
  return { consumed: 2, value: tokens[index + 1] || "" };
}

function parseCurrentAdminWorkflowStartCommand(commandText) {
  const tokens = stripEquitystackPrefix(tokenizeCommand(commandText));
  if (
    tokens[0] !== "current-admin" ||
    tokens[1] !== "workflow" ||
    tokens[2] !== "start"
  ) {
    return null;
  }

  const parsed = {
    inputPath: "",
    batchName: "",
    reviewDryRun: false,
    prefillSuggestions: false,
    reviewModel: "",
    verifierModel: "",
    fallbackModel: "",
    reviewMode: "",
    deepReview: false,
    ollamaUrl: "",
    timeout: "",
    seniorTimeout: "",
    verifierTimeout: "",
  };

  for (let index = 3; index < tokens.length;) {
    const token = tokens[index];
    switch (true) {
      case token === "--review-dry-run":
        parsed.reviewDryRun = true;
        index += 1;
        break;
      case token === "--prefill-suggestions":
        parsed.prefillSuggestions = true;
        index += 1;
        break;
      case token === "--deep-review":
        parsed.deepReview = true;
        index += 1;
        break;
      case token === "--input" || token.startsWith("--input="): {
        const { consumed, value } = readOptionValue(tokens, index);
        parsed.inputPath = value;
        index += consumed;
        break;
      }
      case token === "--batch-name" || token.startsWith("--batch-name="): {
        const { consumed, value } = readOptionValue(tokens, index);
        parsed.batchName = value;
        index += consumed;
        break;
      }
      case token === "--model" || token.startsWith("--model="): {
        const { consumed, value } = readOptionValue(tokens, index);
        parsed.reviewModel = value;
        index += consumed;
        break;
      }
      case token === "--verifier-model" || token.startsWith("--verifier-model="): {
        const { consumed, value } = readOptionValue(tokens, index);
        parsed.verifierModel = value;
        index += consumed;
        break;
      }
      case token === "--fallback-model" || token.startsWith("--fallback-model="): {
        const { consumed, value } = readOptionValue(tokens, index);
        parsed.fallbackModel = value;
        index += consumed;
        break;
      }
      case token === "--review-mode" || token.startsWith("--review-mode="): {
        const { consumed, value } = readOptionValue(tokens, index);
        parsed.reviewMode = value;
        index += consumed;
        break;
      }
      case token === "--ollama-url" || token.startsWith("--ollama-url="): {
        const { consumed, value } = readOptionValue(tokens, index);
        parsed.ollamaUrl = value;
        index += consumed;
        break;
      }
      case token === "--timeout" || token.startsWith("--timeout="): {
        const { consumed, value } = readOptionValue(tokens, index);
        parsed.timeout = value;
        index += consumed;
        break;
      }
      case token === "--senior-timeout" || token.startsWith("--senior-timeout="): {
        const { consumed, value } = readOptionValue(tokens, index);
        parsed.seniorTimeout = value;
        index += consumed;
        break;
      }
      case token === "--verifier-timeout" || token.startsWith("--verifier-timeout="): {
        const { consumed, value } = readOptionValue(tokens, index);
        parsed.verifierTimeout = value;
        index += consumed;
        break;
      }
      default:
        throw new Error(`Unsupported current-admin workflow start argument: ${token}`);
    }
  }

  if (!normalizeString(parsed.inputPath) && !normalizeString(parsed.batchName)) {
    throw new Error("Current-admin workflow start requires --input or --batch-name.");
  }
  if (parsed.inputPath.includes("<batch-file>")) {
    throw new Error("Replace <batch-file>.json with a real current-admin batch file before executing.");
  }

  return parsed;
}

function parseCurrentAdminPrecommitCommand(commandText) {
  const tokens = stripEquitystackPrefix(tokenizeCommand(commandText));
  if (tokens[0] !== "current-admin" || tokens[1] !== "pre-commit") {
    return null;
  }

  const parsed = { queuePath: "" };
  for (let index = 2; index < tokens.length;) {
    const token = tokens[index];
    if (token === "--input" || token.startsWith("--input=")) {
      const { consumed, value } = readOptionValue(tokens, index);
      parsed.queuePath = value;
      index += consumed;
      continue;
    }
    throw new Error(`Unsupported current-admin pre-commit argument: ${token}`);
  }
  if (parsed.queuePath.includes("<batch-name>")) {
    throw new Error("Replace <batch-name> with the active current-admin batch before executing pre-commit.");
  }
  return parsed;
}

function parseLegislativeRunCommand(commandText) {
  const tokens = stripEquitystackPrefix(tokenizeCommand(commandText));
  if (tokens[0] !== "legislative" || tokens[1] !== "run") {
    return null;
  }

  const parsed = {
    reviewModel: "",
    verifierModel: "",
    fallbackModel: "",
    timeout: "",
    seniorTimeout: "",
    verifierTimeout: "",
    skipDiscovery: false,
    applySafeRemovals: false,
    csv: false,
    outputReport: "",
    onlyFutureBillIds: [],
  };

  for (let index = 2; index < tokens.length;) {
    const token = tokens[index];
    switch (true) {
      case token === "--skip-discovery":
        parsed.skipDiscovery = true;
        index += 1;
        break;
      case token === "--apply-safe-removals":
        parsed.applySafeRemovals = true;
        index += 1;
        break;
      case token === "--csv":
        parsed.csv = true;
        index += 1;
        break;
      case token === "--model" || token.startsWith("--model="): {
        const { consumed, value } = readOptionValue(tokens, index);
        parsed.reviewModel = value;
        index += consumed;
        break;
      }
      case token === "--verifier-model" || token.startsWith("--verifier-model="): {
        const { consumed, value } = readOptionValue(tokens, index);
        parsed.verifierModel = value;
        index += consumed;
        break;
      }
      case token === "--fallback-model" || token.startsWith("--fallback-model="): {
        const { consumed, value } = readOptionValue(tokens, index);
        parsed.fallbackModel = value;
        index += consumed;
        break;
      }
      case token === "--timeout" || token.startsWith("--timeout="): {
        const { consumed, value } = readOptionValue(tokens, index);
        parsed.timeout = value;
        index += consumed;
        break;
      }
      case token === "--senior-timeout" || token.startsWith("--senior-timeout="): {
        const { consumed, value } = readOptionValue(tokens, index);
        parsed.seniorTimeout = value;
        index += consumed;
        break;
      }
      case token === "--verifier-timeout" || token.startsWith("--verifier-timeout="): {
        const { consumed, value } = readOptionValue(tokens, index);
        parsed.verifierTimeout = value;
        index += consumed;
        break;
      }
      case token === "--output-report" || token.startsWith("--output-report="): {
        const { consumed, value } = readOptionValue(tokens, index);
        parsed.outputReport = value;
        index += consumed;
        break;
      }
      case token === "--only-future-bill-id" || token.startsWith("--only-future-bill-id="): {
        const { consumed, value } = readOptionValue(tokens, index);
        parsed.onlyFutureBillIds.push(value);
        index += consumed;
        break;
      }
      default:
        throw new Error(`Unsupported legislative run argument: ${token}`);
    }
  }

  return parsed;
}

function parseDirectCommandInput(commandText) {
  const normalized = normalizeCommandInput(commandText);
  if (!normalized) {
    return null;
  }

  if (/^(?:\.\/bin\/equitystack|equitystack)\s+current-admin\s+workflow\s+start\b/.test(normalized)) {
    return {
      action: getOperatorActionById("current_admin_workflow_start"),
      args: parseCurrentAdminWorkflowStartCommand(normalized),
      commandText: normalized,
    };
  }
  if (/^(?:\.\/bin\/equitystack|equitystack)\s+current-admin\s+workflow\s+resume\s*$/.test(normalized)) {
    return {
      action: getOperatorActionById("current_admin_workflow_resume"),
      args: {},
      commandText: normalized,
    };
  }
  if (/^(?:\.\/bin\/equitystack|equitystack)\s+current-admin\s+status\s*$/.test(normalized)) {
    return {
      action: getOperatorActionById("current_admin_status"),
      args: {},
      commandText: normalized,
    };
  }
  if (/^(?:\.\/bin\/equitystack|equitystack)\s+current-admin\s+pre-commit\b/.test(normalized)) {
    return {
      action: getOperatorActionById("current_admin_precommit"),
      args: parseCurrentAdminPrecommitCommand(normalized),
      commandText: normalized,
    };
  }
  if (/^(?:\.\/bin\/equitystack|equitystack)\s+legislative\s+run\b/.test(normalized)) {
    return {
      action: getOperatorActionById("legislative_run"),
      args: parseLegislativeRunCommand(normalized),
      commandText: normalized,
    };
  }
  if (/^(?:\.\/bin\/equitystack|equitystack)\s+legislative\s+apply\s+--dry-run\s*$/.test(normalized)) {
    return {
      action: getOperatorActionById("legislative_apply_dry_run"),
      args: {},
      commandText: normalized,
    };
  }

  const exactRegistryAction = resolveExactOperatorActionFromInput(
    getOperatorActionRegistry(),
    normalized
  );
  if (exactRegistryAction) {
    return {
      action: exactRegistryAction,
      args: {},
      commandText: exactRegistryAction.canonical_input,
    };
  }

  return null;
}

function buildTraceSummary(commandCenter, action) {
  if (action.workflow === "current-admin") {
    if (commandCenter.current_admin_summary?.pending_review > 0) {
      return `${action.label} reached the operator review stop point for current-admin.`;
    }
    if (commandCenter.current_admin_summary?.import_ready) {
      return `${action.label} cleared pre-commit and reached the admin approval stop point.`;
    }
  }

  if (action.workflow === "legislative") {
    if (commandCenter.legislative_summary?.pending_review > 0) {
      return `${action.label} reached the operator review stop point for legislative.`;
    }
    if (
      commandCenter.legislative_summary?.apply_ready ||
      commandCenter.legislative_summary?.import_ready
    ) {
      return `${action.label} reached the admin approval stop point for legislative.`;
    }
  }

  return `${action.label} completed through the wrapped service layer.`;
}

function buildStopPoint(commandCenter, action, traceStatus = "success") {
  if (traceStatus === "failed") {
    return { key: "failed", label: "Failed" };
  }
  if (traceStatus === "blocked") {
    return { key: "blocked", label: "Blocked" };
  }

  if (action.workflow === "current-admin") {
    if (commandCenter.current_admin_summary?.pending_review > 0) {
      return { key: "first_stop", label: "1st Stop" };
    }
    if (commandCenter.current_admin_summary?.import_ready) {
      return { key: "second_stop", label: "2nd Stop" };
    }
    if (commandCenter.current_admin_summary?.state === "COMPLETE") {
      return { key: "complete", label: "Complete" };
    }
  }

  if (action.workflow === "legislative") {
    if (commandCenter.legislative_summary?.pending_review > 0) {
      return { key: "first_stop", label: "1st Stop" };
    }
    if (
      commandCenter.legislative_summary?.apply_ready ||
      commandCenter.legislative_summary?.import_ready
    ) {
      return { key: "second_stop", label: "2nd Stop" };
    }
    if (commandCenter.legislative_summary?.state === "COMPLETE") {
      return { key: "complete", label: "Complete" };
    }
  }

  return { key: "complete", label: "Complete" };
}

function resolveActionRequest({ actionId, message }) {
  const directAction = actionId ? getOperatorActionById(actionId) : null;
  const parsedCommand = parseDirectCommandInput(message);

  if (directAction) {
    if (parsedCommand?.action?.id && parsedCommand.action.id !== directAction.id) {
      throw new Error("Typed command does not match the selected workflow action.");
    }
    return {
      action: directAction,
      args: parsedCommand?.args || {},
      commandText: normalizeString(message) || directAction.canonical_input,
    };
  }

  if (parsedCommand) {
    return parsedCommand;
  }

  const exactRegistryAction = resolveExactOperatorActionFromInput(
    getOperatorActionRegistry(),
    message
  );
  if (!exactRegistryAction) {
    return null;
  }

  return {
    action: exactRegistryAction,
    args: {},
    commandText: exactRegistryAction.canonical_input,
  };
}

async function executeMappedAction(action, commandCenter, args) {
  switch (action.id) {
    case "current_admin_workflow_start":
      return runCurrentAdministrationWorkflowStart(args);
    case "current_admin_workflow_resume":
      return runCurrentAdministrationWorkflowResume();
    case "current_admin_discover":
      return runCurrentAdministrationDiscover();
    case "current_admin_status":
      return runCurrentAdministrationStatus();
    case "current_admin_precommit": {
      const queuePath = normalizeString(args?.queuePath) || commandCenter.current_admin.batch?.paths?.queue;
      if (!queuePath) {
        throw new Error(
          "No canonical current-admin queue artifact is available for pre-commit."
        );
      }
      return runCurrentAdministrationPrecommit({ queuePath });
    }
    case "legislative_run":
      return runLegislativeRunWithOptions(args);
    case "legislative_apply_dry_run":
      return runLegislativeApply({ mode: "dry-run" });
    case "summarize_state":
    case "show_attention":
      return null;
    default:
      throw new Error(`No executor is configured for action ${action.id}.`);
  }
}

async function buildSuccessfulTrace({
  userInput,
  action,
  commandText,
  executionResult,
  startedAt,
  startedAtIso,
}) {
  const durationMs = Date.now() - startedAt;
  const refreshedCommandCenter = await getAdminCommandCenterData();
  const artifactReferences = buildArtifactReferences(
    { workspace: executionResult?.workspace || null },
    refreshedCommandCenter,
    action.id
  );
  const logReference = await findLatestEquityStackLogReference();
  if (logReference) {
    artifactReferences.push(logReference);
  }
  const stopPoint = buildStopPoint(refreshedCommandCenter, action, "success");

  return {
    execution_id: null,
    user_input: userInput || null,
    mapped_action_id: action.id,
    action_label: action.label,
    workflow_type: action.workflow,
    execution_path: action.execution_method,
    status: "success",
    summary:
      action.id === "summarize_state" || action.id === "show_attention"
        ? buildSummary(refreshedCommandCenter)
        : buildTraceSummary(refreshedCommandCenter, action),
    blocked_reason: null,
    failure_reason: null,
    started_at: startedAtIso,
    ended_at: new Date().toISOString(),
    execution_duration_ms: durationMs,
    was_blocked: false,
    had_artifacts: artifactReferences.length > 0,
    artifact_references: artifactReferences,
    next_recommended_step: buildNextStep(refreshedCommandCenter, action.id),
    stop_point: stopPoint,
    safety_note: buildTraceSafetyNote(action.id),
    retry_guidance: buildRetryGuidance(action.id),
    command: executionResult?.command || commandText || null,
    stdout: executionResult?.stdout || "",
    stderr: executionResult?.stderr || "",
  };
}

async function buildFailedTrace({
  userInput,
  action,
  commandText,
  startedAt,
  startedAtIso,
  commandCenter,
  error,
}) {
  const durationMs = Date.now() - startedAt;
  const logReference = await findLatestEquityStackLogReference();
  const trace = failedResult({
    userInput,
    action,
    command: commandText,
    summary: normalizeString(error?.message) || "The action failed.",
    artifactReferences: logReference ? [logReference] : [],
    nextStep: action
      ? buildNextStep(commandCenter, action.id)
      : {
          label: "Return to workflow console",
          href: "/admin/operator-console",
        },
    durationMs,
    stopPoint: action
      ? buildStopPoint(commandCenter, action, "failed")
      : { key: "failed", label: "Failed" },
  });
  trace.started_at = startedAtIso;
  trace.ended_at = new Date().toISOString();
  trace.execution_id = null;
  return trace;
}

async function attachTraceRecommendations(trace) {
  const [analytics, commandCenter] = await Promise.all([
    getOperatorAnalytics(),
    getAdminCommandCenterData(),
  ]);
  trace.contextual_recommendations = await buildOperatorRecommendations({
    analytics,
    currentAdminSummary: commandCenter.current_admin_summary,
    legislativeSummary: commandCenter.legislative_summary,
    trace,
    limit: 4,
  });
  return trace;
}

function buildPollTraceFromJob(job) {
  if (!job) {
    return null;
  }
  if (job.trace) {
    return job.trace;
  }
  return buildRunningTrace({
    action: {
      id: job.action_id,
      label: job.action_label,
      workflow: job.workflow_type,
      execution_method: "Wrapped CLI execution",
    },
    commandText: job.command,
    userInput: job.user_input,
    executionId: job.id,
    startedAt: job.started_at,
  });
}

export async function getOperatorConsoleQuickActions() {
  return buildQuickActions();
}

export async function getOperatorConsoleState() {
  const [commandCenter, history, analytics, activeExecution, recentJobs] = await Promise.all([
    getAdminCommandCenterData(),
    readOperatorActionHistory(),
    getOperatorAnalytics(),
    getOperatorExecutionState(),
    listOperatorExecutionJobs({ limit: 20 }),
  ]);

  let initialTrace = {
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

  if (activeExecution?.execution_id) {
    const activeJob = recentJobs.find((job) => job.id === activeExecution.execution_id)
      || (await getOperatorExecutionJob(activeExecution.execution_id));
    if (activeJob) {
      initialTrace = buildPollTraceFromJob(activeJob) || initialTrace;
    }
  }

  return {
    quick_actions: buildQuickActions(),
    history,
    recent_jobs: recentJobs,
    initial_trace: initialTrace,
    active_execution: activeExecution,
  };
}

export async function getOperatorConsoleJobState(executionId) {
  const [job, history, activeExecution] = await Promise.all([
    getOperatorExecutionJob(executionId),
    readOperatorActionHistory(),
    getOperatorExecutionState(),
  ]);

  if (!job) {
    throw new Error(`Execution job ${executionId} was not found.`);
  }

  return {
    job,
    trace: buildPollTraceFromJob(job),
    history,
    active_execution:
      activeExecution?.execution_id === job.id && !isTerminalOperatorExecutionJobStatus(job.status)
        ? activeExecution
        : null,
  };
}

export async function runOperatorConsoleExecutionJob(executionId) {
  const job = await getOperatorExecutionJob(executionId);
  if (!job || isTerminalOperatorExecutionJobStatus(job.status)) {
    return job;
  }

  try {
    const action = getOperatorActionById(job.action_id);
    if (!action) {
      const trace = {
        ...failedResult({
          userInput: job.user_input,
          summary: "The registered operator action for this execution job is no longer available.",
          nextStep: {
            label: "Return to workflow console",
            href: "/admin/operator-console",
          },
        }),
        execution_id: executionId,
      };
      trace.started_at = job.started_at || new Date().toISOString();
      trace.ended_at = new Date().toISOString();
      await appendOperatorActionHistory(buildHistoryEntry(trace));
      return updateOperatorExecutionJob(executionId, {
        status: "failed",
        error: trace.summary,
        summary: trace.summary,
        finished_at: trace.ended_at,
        stop_point: trace.stop_point,
        trace,
      });
    }

    const startedAt = new Date(job.started_at || new Date().toISOString()).getTime();
    const safeStartedAt = Number.isFinite(startedAt) ? startedAt : Date.now();
    const startedAtIso = new Date(safeStartedAt).toISOString();
    const commandCenter = await getAdminCommandCenterData();
    const executionResult = await executeMappedAction(action, commandCenter, job.args || {});
    const trace = await buildSuccessfulTrace({
      userInput: job.user_input,
      action,
      commandText: job.command,
      executionResult,
      startedAt: safeStartedAt,
      startedAtIso,
    });
    trace.execution_id = executionId;
    await attachTraceRecommendations(trace);
    const history = await appendOperatorActionHistory(buildHistoryEntry(trace));
    const nextJob = await updateOperatorExecutionJob(executionId, {
      status: buildAsyncJobStatusFromTrace(trace),
      summary: trace.summary,
      stop_point: trace.stop_point,
      next_recommended_step: trace.next_recommended_step,
      finished_at: trace.ended_at,
      error: null,
      trace,
    });
    return {
      job: nextJob,
      history,
      trace,
    };
  } catch (error) {
    const action = getOperatorActionById(job.action_id);
    const startedAt = new Date(job.started_at || new Date().toISOString()).getTime();
    const safeStartedAt = Number.isFinite(startedAt) ? startedAt : Date.now();
    const startedAtIso = new Date(safeStartedAt).toISOString();
    const commandCenter = await getAdminCommandCenterData();
    const trace = await buildFailedTrace({
      userInput: job.user_input,
      action,
      commandText: job.command,
      startedAt: safeStartedAt,
      startedAtIso,
      commandCenter,
      error,
    });
    trace.execution_id = executionId;
    await attachTraceRecommendations(trace);
    const history = await appendOperatorActionHistory(buildHistoryEntry(trace));
    const nextJob = await updateOperatorExecutionJob(executionId, {
      status: "failed",
      summary: trace.summary,
      stop_point: trace.stop_point,
      next_recommended_step: trace.next_recommended_step,
      finished_at: trace.ended_at,
      error: normalizeString(error?.message) || "The action failed.",
      trace,
    });
    return {
      job: nextJob,
      history,
      trace,
    };
  } finally {
    await clearOperatorExecutionState();
  }
}

export async function executeOperatorConsoleRequest({ actionId, message }) {
  const userInput = normalizeString(message);
  const resolvedRequest = resolveActionRequest({ actionId, message: userInput });
  const commandCenter = await getAdminCommandCenterData();

  if (!resolvedRequest?.action) {
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
      active_execution: await getOperatorExecutionState(),
    };
  }

  const resolvedAction = resolvedRequest.action;
  const commandText = resolvedRequest.commandText || resolvedAction.canonical_input;
  const shouldRunAsync = isAsyncAction(resolvedAction);

  const stateGuard = checkAllowedState(resolvedAction, commandCenter);
  if (!stateGuard.allowed) {
    const trace = blockedResult({
      userInput,
      action: resolvedAction,
      command: commandText,
      summary: stateGuard.reason,
      artifactReferences: [],
      nextStep: stateGuard.nextStep || buildNextStep(commandCenter, resolvedAction.id),
      retryGuidance: stateGuard.retryGuidance,
      stopPoint: buildStopPoint(commandCenter, resolvedAction, "blocked"),
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
      active_execution: await getOperatorExecutionState(),
    };
  }

  const executionId = shouldRunAsync
    ? `exec_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    : null;
  const lockResult = await acquireOperatorExecutionState({
    status: "running",
    execution_id: executionId,
    action_id: resolvedAction.id,
    action_label: resolvedAction.label,
    workflow_type: resolvedAction.workflow,
    user_input: userInput || resolvedAction.canonical_input,
    command: commandText,
  });

  if (!lockResult.acquired) {
    const active = lockResult.active || {};
    const trace = blockedResult({
      userInput,
      action: resolvedAction,
      command: commandText,
      summary:
        `Another workflow execution is already running: ${active.action_label || active.action_id || "unknown action"}. ` +
        "Wait for it to complete before starting a second command.",
      artifactReferences: [],
      nextStep: {
        label: "Refresh workflow console",
        href: "/admin/operator-console",
      },
      retryGuidance:
        "The workflow console permits only one active execution at a time. Retry after the running command finishes.",
      stopPoint: buildStopPoint(commandCenter, resolvedAction, "blocked"),
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
      active_execution: active,
    };
  }

  const startedAt = Date.now();
  const startedAtIso = new Date(startedAt).toISOString();
  if (shouldRunAsync) {
    try {
      const activeExecution = buildActiveExecutionPayload({
        executionId,
        action: resolvedAction,
        commandText,
        userInput,
        startedAt: startedAtIso,
        status: "running",
      });
      const trace = buildRunningTrace({
        action: resolvedAction,
        commandText,
        userInput,
        executionId,
        startedAt: startedAtIso,
      });
      const job = await createOperatorExecutionJob({
        id: executionId,
        action_id: resolvedAction.id,
        action_label: resolvedAction.label,
        workflow_type: resolvedAction.workflow,
        command: commandText,
        user_input: userInput || commandText,
        args: resolvedRequest.args || {},
        status: "running",
        summary: trace.summary,
        stop_point: trace.stop_point,
        started_at: startedAtIso,
        trace,
      });

      return {
        mode: "async",
        trace,
        async_job: job,
        history: await readOperatorActionHistory(),
        quick_actions: buildQuickActions(),
        active_execution: activeExecution,
      };
    } catch (error) {
      await clearOperatorExecutionState();
      throw error;
    }
  }

  try {
    const executionResult = await executeMappedAction(
      resolvedAction,
      commandCenter,
      resolvedRequest.args
    );
    const trace = await buildSuccessfulTrace({
      userInput,
      action: resolvedAction,
      commandText,
      executionResult,
      startedAt,
      startedAtIso,
    });
    const history = await appendOperatorActionHistory(buildHistoryEntry(trace));
    await attachTraceRecommendations(trace);

    return {
      trace,
      history,
      quick_actions: buildQuickActions(),
      active_execution: null,
    };
  } catch (error) {
    const trace = await buildFailedTrace({
      userInput,
      action: resolvedAction,
      commandText,
      startedAt,
      startedAtIso,
      commandCenter,
      error,
    });
    const history = await appendOperatorActionHistory(buildHistoryEntry(trace));
    await attachTraceRecommendations(trace);

    return {
      trace,
      history,
      quick_actions: buildQuickActions(),
      active_execution: null,
    };
  } finally {
    if (!shouldRunAsync) {
      await clearOperatorExecutionState();
    }
  }
}
