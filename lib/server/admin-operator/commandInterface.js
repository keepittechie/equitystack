import {
  getCommandCenterSummary,
  getWorkflowSessionDetail,
  listReviewQueueItems,
  listWorkflowSessions,
} from "./workflowData.js";
import { getOperatorVerificationReport } from "./verificationService.js";
import {
  getOperatorSchedule,
  listOperatorSchedules,
  runScheduleNow,
  updateOperatorSchedule,
} from "./schedulerService.js";
import { EXECUTION_MODES, normalizeString } from "./shared.js";

export const SUPPORTED_OPERATOR_COMMANDS = [
  { syntax: "run current-admin", description: "Start the wrapped current-admin run flow." },
  { syntax: "run current-admin --mode remote_executor", description: "Start the wrapped current-admin run flow in supervised remote-executor mode when allowed." },
  { syntax: "review current-admin", description: "Start the wrapped current-admin review flow." },
  { syntax: "apply current-admin", description: "Run the guarded current-admin apply dry-run." },
  { syntax: "apply current-admin final", description: "Request the guarded mutating current-admin apply path." },
  { syntax: "status current-admin", description: "Read the canonical current-admin status surface." },
  { syntax: "run legislative", description: "Start the wrapped legislative run flow." },
  { syntax: "status current-admin --mode local_cli", description: "Force a safe status action to run through the local CLI mode." },
  { syntax: "review legislative", description: "Refresh the canonical legislative review bundle surface." },
  { syntax: "apply legislative", description: "Run the guarded legislative apply dry-run." },
  { syntax: "apply legislative final", description: "Request the guarded mutating legislative apply path." },
  { syntax: "import legislative", description: "Run the guarded legislative import dry-run." },
  { syntax: "import legislative final", description: "Request the guarded mutating legislative import path." },
  { syntax: "feedback legislative", description: "Refresh legislative feedback output." },
  { syntax: "show sessions", description: "List active workflow sessions." },
  { syntax: "show review-queue", description: "List pending review queue items." },
  { syntax: "show command-center", description: "Show command-center summary." },
  { syntax: "show daily-routine", description: "Show the guided daily routine steps derived from current operator state." },
  { syntax: "show schedules", description: "List registered workflow schedules." },
  { syntax: "verify environment", description: "Run the production-targeted environment readiness checks without enqueueing a workflow job." },
  { syntax: "verify remote-executor", description: "Run the reserved remote executor verification checks without enqueueing a workflow job." },
  { syntax: "verify control-plane", description: "Run DB, schema, broker, and schedule readiness checks without enqueueing a workflow job." },
  { syntax: "verify data-integrity", description: "Run read-only canonical data integrity checks for promises, sources, relationships, and future-bill links." },
  { syntax: "verify deep-integrity", description: "Run deeper source, provenance, duplicate-source, and current-admin lineage checks." },
  { syntax: "open session <sessionId>", description: "Open one workflow session inspector payload." },
  { syntax: "resume session <sessionId>", description: "Run the workflow resume action for a session." },
  { syntax: "next session <sessionId>", description: "Run the session's recommended next action." },
  { syntax: "run schedule <scheduleId>", description: "Manually run a schedule definition through the broker." },
  { syntax: "run next-safe-step", description: "Run the next safe daily-routine step when it maps to a registered action." },
  { syntax: "enable schedule <scheduleId>", description: "Enable a schedule definition." },
  { syntax: "disable schedule <scheduleId>", description: "Disable a schedule definition." },
  { syntax: "open next-review-step", description: "Open the next daily-routine review checkpoint." },
  { syntax: "next", description: "Run the recommended next action for the selected session context." },
  { syntax: "resume", description: "Resume the selected session context." },
  { syntax: "apply", description: "Run the guarded apply dry-run for the selected session context." },
  { syntax: "apply final", description: "Request the guarded mutating apply/import path for the selected session context." },
  { syntax: "open session", description: "Open the selected session context." },
];

function buildSessionContext(detail) {
  return {
    sessionId: detail.session.id,
    canonicalSessionKey: detail.metadata.canonicalSessionKey,
    triggerSource: "command_interface",
  };
}

function buildActionCommand({
  rawCommand,
  actionId,
  title,
  input = {},
  context = {},
  sessionId = null,
  confirmation = null,
  executionMode = "",
}) {
  return {
    kind: "action",
    rawCommand,
    actionId,
    title,
    input,
    context,
    sessionId,
    confirmation,
    executionMode: normalizeString(executionMode) || null,
  };
}

function buildInspectCommand({ rawCommand, target, title, sessionId = null }) {
  return {
    kind: "inspect",
    rawCommand,
    target,
    title,
    sessionId,
  };
}

async function getRequiredSessionDetail(explicitSessionId, selectedSessionId, message) {
  const targetSessionId = normalizeString(explicitSessionId) || normalizeString(selectedSessionId);
  if (!targetSessionId) {
    throw new Error(message);
  }
  return getWorkflowSessionDetail(targetSessionId);
}

function buildMutatingConfirmation(title, description) {
  return {
    required: true,
    title,
    description,
    checkboxLabel: `I understand this requests the canonical mutating ${title.toLowerCase()} step.`,
    requireTypedYes: true,
  };
}

function getSessionResumeAction(detail) {
  if (detail.session.workflowFamily === "current-admin") {
    return {
      actionId: "currentAdmin.workflowResume",
      title: "Current-Admin Workflow Resume",
      input: {},
    };
  }
  return {
    actionId: "legislative.review",
    title: "Legislative Review",
    input: {},
  };
}

function getSessionApplyAction(detail, mode) {
  if (detail.session.workflowFamily === "current-admin") {
    return {
      actionId: "currentAdmin.apply",
      title: mode === "final" ? "Current-Admin Apply (final)" : "Current-Admin Apply",
      input: mode === "final" ? { apply: true, yes: true } : {},
      confirmation:
        mode === "final"
          ? buildMutatingConfirmation(
              "current-admin apply",
              "This requests the canonical mutating current-admin apply path. Pre-commit and dry-run guardrails remain in force."
            )
          : null,
    };
  }

  const useImport = detail.session.recommendedActionId === "legislative.import" || detail.session.canonicalState === "IMPORT_READY";
  return {
    actionId: useImport ? "legislative.import" : "legislative.apply",
    title: useImport
      ? mode === "final"
        ? "Legislative Import (final)"
        : "Legislative Import"
      : mode === "final"
        ? "Legislative Apply (final)"
        : "Legislative Apply",
    input: mode === "final" ? { apply: true, yes: true } : {},
    confirmation:
      mode === "final"
        ? buildMutatingConfirmation(
            useImport ? "legislative import" : "legislative apply",
            "This requests the canonical mutating legislative path. Approval decisions still remain explicit and separate."
          )
        : null,
  };
}

function extractCommandMode(tokens = []) {
  if (!tokens.includes("--mode")) {
    return {
      commandTokens: tokens,
      executionMode: "",
    };
  }

  const modeIndex = tokens.indexOf("--mode");
  if (modeIndex !== tokens.length - 2) {
    throw new Error("Execution mode must be provided as a final `--mode <mode>` suffix.");
  }
  const modeValue = normalizeString(tokens[modeIndex + 1]);
  const supportedModes = Object.values(EXECUTION_MODES);
  if (!supportedModes.includes(modeValue)) {
    throw new Error(`Unsupported execution mode. Use one of: ${supportedModes.join(", ")}.`);
  }

  return {
    commandTokens: tokens.slice(0, modeIndex),
    executionMode: modeValue,
  };
}

async function parseSessionScopedCommand(rawCommand, tokens, selectedSessionId, executionMode = "") {
  const verb = tokens[0];
  const isFinal = tokens[1] === "final";
  if (verb === "open") {
    if (tokens.length !== 2 || tokens[1] !== "session") {
      throw new Error("Use `open session` with a selected session context, or `open session <sessionId>`.");
    }
    const detail = await getRequiredSessionDetail(null, selectedSessionId, "Select a session before using `open session`.");
    return buildInspectCommand({
      rawCommand,
      target: "session",
      title: `Open ${detail.session.title}`,
      sessionId: detail.session.id,
    });
  }

  if (!["next", "resume", "apply"].includes(verb)) {
    throw new Error("Unknown session-scoped command.");
  }

  if (tokens.length > (isFinal ? 2 : 1)) {
    throw new Error("This command accepts only the base verb or a `final` suffix.");
  }
  if (verb !== "apply" && isFinal) {
    throw new Error("Only `apply final` is supported as a mutating session command.");
  }

  const detail = await getRequiredSessionDetail(
    null,
    selectedSessionId,
    "Select a session before using session-scoped commands like `next`, `resume`, or `apply`."
  );
  const context = buildSessionContext(detail);

  if (verb === "next") {
    const actionId =
      normalizeString(detail.session.recommendedActionId) ||
      (detail.session.workflowFamily === "current-admin" ? "currentAdmin.status" : "legislative.review");
    return buildActionCommand({
      rawCommand,
      actionId,
      title: `Run next action for ${detail.session.title}`,
      input: {},
      context,
      sessionId: detail.session.id,
      executionMode,
    });
  }

  if (verb === "resume") {
    const action = getSessionResumeAction(detail);
    return buildActionCommand({
      rawCommand,
      actionId: action.actionId,
      title: `Resume ${detail.session.title}`,
      input: action.input,
      context,
      sessionId: detail.session.id,
      executionMode,
    });
  }

  const action = getSessionApplyAction(detail, isFinal ? "final" : "dry-run");
  return buildActionCommand({
    rawCommand,
    actionId: action.actionId,
    title: `Apply ${detail.session.title}`,
    input: action.input,
    context,
    sessionId: detail.session.id,
    confirmation: action.confirmation,
    executionMode,
  });
}

export async function parseOperatorCommand(command, { selectedSessionId = "" } = {}) {
  const rawCommand = normalizeString(command);
  if (!rawCommand) {
    throw new Error("Enter a structured operator command.");
  }

  const normalized = rawCommand.toLowerCase();
  const tokenParse = extractCommandMode(normalized.split(/\s+/).filter(Boolean));
  const tokens = tokenParse.commandTokens;
  const executionMode = tokenParse.executionMode;
  if (!tokens.length) {
    throw new Error("Enter a structured operator command.");
  }

  if (tokens[0] === "show") {
    if (executionMode) {
      throw new Error("Inspection commands do not accept execution mode.");
    }
    if (tokens.length !== 2) {
      throw new Error("Show commands accept a single target like `show sessions`.");
    }
    if (tokens[1] === "sessions") {
      return buildInspectCommand({ rawCommand, target: "sessions", title: "Show sessions" });
    }
    if (tokens[1] === "review-queue") {
      return buildInspectCommand({ rawCommand, target: "review-queue", title: "Show review queue" });
    }
    if (tokens[1] === "command-center") {
      return buildInspectCommand({ rawCommand, target: "command-center", title: "Show command center" });
    }
    if (tokens[1] === "daily-routine") {
      return buildInspectCommand({ rawCommand, target: "daily-routine", title: "Show daily routine" });
    }
    if (tokens[1] === "schedules") {
      return buildInspectCommand({ rawCommand, target: "schedules", title: "Show schedules" });
    }
    throw new Error("Unknown show command target.");
  }

  if (tokens[0] === "verify") {
    if (executionMode) {
      throw new Error("Verification commands do not accept execution mode.");
    }
    if (tokens.length !== 2) {
      throw new Error("Use `verify environment`, `verify remote-executor`, `verify control-plane`, `verify data-integrity`, or `verify deep-integrity`.");
    }
    if (tokens[1] === "environment") {
      return buildInspectCommand({
        rawCommand,
        target: "verification-environment",
        title: "Verify environment",
      });
    }
    if (tokens[1] === "remote-executor") {
      return buildInspectCommand({
        rawCommand,
        target: "verification-remote-executor",
        title: "Verify remote executor",
      });
    }
    if (tokens[1] === "control-plane") {
      return buildInspectCommand({
        rawCommand,
        target: "verification-control-plane",
        title: "Verify control plane",
      });
    }
    if (tokens[1] === "data-integrity") {
      return buildInspectCommand({
        rawCommand,
        target: "verification-data-integrity",
        title: "Verify data integrity",
      });
    }
    if (tokens[1] === "deep-integrity") {
      return buildInspectCommand({
        rawCommand,
        target: "verification-deep-integrity",
        title: "Verify deep integrity",
      });
    }
    throw new Error("Unknown verification scope.");
  }

  if (tokens[0] === "open") {
    if (tokens[1] !== "session") {
      throw new Error("Use `open session <sessionId>` for session inspection.");
    }
    if (tokens.length === 2) {
      return parseSessionScopedCommand(rawCommand, tokens, selectedSessionId, executionMode);
    }
    if (tokens.length !== 3) {
      throw new Error("Use `open session <sessionId>`.");
    }
    return buildInspectCommand({
      rawCommand,
      target: "session",
      title: `Open session ${tokens[2]}`,
      sessionId: tokens[2],
    });
  }

  if (tokens[0] === "resume" && tokens[1] === "session") {
    if (tokens.length !== 3) {
      throw new Error("Use `resume session <sessionId>`.");
    }
    const detail = await getWorkflowSessionDetail(tokens[2]);
    const action = getSessionResumeAction(detail);
    return buildActionCommand({
      rawCommand,
      actionId: action.actionId,
      title: `Resume ${detail.session.title}`,
      input: action.input,
      context: buildSessionContext(detail),
      sessionId: detail.session.id,
      executionMode,
    });
  }

  if (tokens[0] === "next" && tokens[1] === "session") {
    if (tokens.length !== 3) {
      throw new Error("Use `next session <sessionId>`.");
    }
    const detail = await getWorkflowSessionDetail(tokens[2]);
    return buildActionCommand({
      rawCommand,
      actionId:
        normalizeString(detail.session.recommendedActionId) ||
        (detail.session.workflowFamily === "current-admin" ? "currentAdmin.status" : "legislative.review"),
      title: `Run next action for ${detail.session.title}`,
      input: {},
      context: buildSessionContext(detail),
      sessionId: detail.session.id,
      executionMode,
    });
  }

  if (tokens[1] === "schedule") {
    if (tokens.length !== 3) {
      throw new Error(`Use \`${tokens[0]} schedule <scheduleId>\`.`);
    }
    if (tokens[0] === "run") {
      return {
        kind: "schedule-run",
        rawCommand,
        title: `Run schedule ${tokens[2]}`,
        scheduleId: tokens[2],
        executionMode,
      };
    }
    if (tokens[0] === "enable" || tokens[0] === "disable") {
      if (executionMode) {
        throw new Error("Schedule enable/disable commands do not accept execution mode.");
      }
      return {
        kind: "schedule-update",
        rawCommand,
        title: `${tokens[0] === "enable" ? "Enable" : "Disable"} schedule ${tokens[2]}`,
        scheduleId: tokens[2],
        enabled: tokens[0] === "enable",
      };
    }
  }

  if (tokens[0] === "run" && tokens[1] === "next-safe-step") {
    if (tokens.length !== 2) {
      throw new Error("Use `run next-safe-step`.");
    }
    return {
      kind: "routine-run",
      rawCommand,
      title: "Run next safe routine step",
      executionMode,
    };
  }

  if (tokens[0] === "open" && tokens[1] === "next-review-step") {
    if (executionMode) {
      throw new Error("Routine review commands do not accept execution mode.");
    }
    if (tokens.length !== 2) {
      throw new Error("Use `open next-review-step`.");
    }
    return {
      kind: "routine-open",
      rawCommand,
      title: "Open next review routine step",
    };
  }

  if (["next", "resume", "apply"].includes(tokens[0])) {
    return parseSessionScopedCommand(rawCommand, tokens, selectedSessionId, executionMode);
  }

  if (tokens.length < 2 || tokens.length > 3) {
    throw new Error("Unknown operator command.");
  }

  const [verb, subject, maybeFinal] = tokens;
  const isFinal = maybeFinal === "final";
  if (maybeFinal && !isFinal) {
    throw new Error("Only the `final` suffix is supported for mutating commands.");
  }

  if (subject === "current-admin") {
    if (verb === "run") {
      return buildActionCommand({
        rawCommand,
        actionId: "currentAdmin.run",
        title: "Current-Admin Run",
        executionMode,
      });
    }
    if (verb === "review") {
      return buildActionCommand({
        rawCommand,
        actionId: "currentAdmin.review",
        title: "Current-Admin Review",
        executionMode,
      });
    }
    if (verb === "apply") {
      return buildActionCommand({
        rawCommand,
        actionId: "currentAdmin.apply",
        title: isFinal ? "Current-Admin Apply (final)" : "Current-Admin Apply",
        input: isFinal ? { apply: true, yes: true } : {},
        executionMode,
        confirmation: isFinal
          ? buildMutatingConfirmation(
              "current-admin apply",
              "This requests the canonical mutating current-admin apply path. Pre-commit and dry-run guardrails remain in force."
            )
          : null,
      });
    }
    if (verb === "status" && !isFinal) {
      return buildActionCommand({
        rawCommand,
        actionId: "currentAdmin.status",
        title: "Current-Admin Status",
        executionMode,
      });
    }
  }

  if (subject === "legislative") {
    if (verb === "run" && !isFinal) {
      return buildActionCommand({
        rawCommand,
        actionId: "legislative.run",
        title: "Legislative Run",
        executionMode,
      });
    }
    if (verb === "review" && !isFinal) {
      return buildActionCommand({
        rawCommand,
        actionId: "legislative.review",
        title: "Legislative Review",
        executionMode,
      });
    }
    if (verb === "apply") {
      return buildActionCommand({
        rawCommand,
        actionId: "legislative.apply",
        title: isFinal ? "Legislative Apply (final)" : "Legislative Apply",
        input: isFinal ? { apply: true, yes: true } : {},
        executionMode,
        confirmation: isFinal
          ? buildMutatingConfirmation(
              "legislative apply",
              "This requests the canonical mutating legislative apply path. Approval decisions remain explicit and separate."
            )
          : null,
      });
    }
    if (verb === "import") {
      return buildActionCommand({
        rawCommand,
        actionId: "legislative.import",
        title: isFinal ? "Legislative Import (final)" : "Legislative Import",
        input: isFinal ? { apply: true, yes: true } : {},
        executionMode,
        confirmation: isFinal
          ? buildMutatingConfirmation(
              "legislative import",
              "This requests the canonical mutating legislative import path. Approval decisions remain explicit and separate."
            )
          : null,
      });
    }
    if (verb === "feedback" && !isFinal) {
      return buildActionCommand({
        rawCommand,
        actionId: "legislative.feedback",
        title: "Legislative Feedback",
        executionMode,
      });
    }
  }

  throw new Error("Unknown operator command.");
}

export async function executeParsedOperatorCommand(parsedCommand, { confirmation = null } = {}) {
  if (parsedCommand.kind === "inspect") {
    if (parsedCommand.target === "sessions") {
      const sessions = await listWorkflowSessions();
      return {
        kind: "inspect",
        target: "sessions",
        title: parsedCommand.title,
        summary: `Loaded ${sessions.length} active workflow sessions.`,
        data: { sessions },
      };
    }
    if (parsedCommand.target === "review-queue") {
      const items = await listReviewQueueItems();
      return {
        kind: "inspect",
        target: "review-queue",
        title: parsedCommand.title,
        summary: `Loaded ${items.length} review queue items.`,
        data: { items },
      };
    }
    if (parsedCommand.target === "command-center") {
      const summary = await getCommandCenterSummary();
      return {
        kind: "inspect",
        target: "command-center",
        title: parsedCommand.title,
        summary: `Loaded command-center summary for ${summary.sessions.length} active sessions.`,
        data: { summary },
      };
    }
    if (parsedCommand.target === "daily-routine") {
      const summary = await getCommandCenterSummary();
      return {
        kind: "inspect",
        target: "daily-routine",
        title: parsedCommand.title,
        summary: `Loaded ${summary.dailyRoutine?.steps?.length || 0} daily routine steps.`,
        data: { routine: summary.dailyRoutine, summary },
      };
    }
    if (parsedCommand.target === "schedules") {
      const schedules = await listOperatorSchedules();
      return {
        kind: "inspect",
        target: "schedules",
        title: parsedCommand.title,
        summary: `Loaded ${schedules.length} workflow schedules.`,
        data: { schedules },
      };
    }
    if (parsedCommand.target === "verification-environment") {
      const report = await getOperatorVerificationReport("environment");
      return {
        kind: "inspect",
        target: "verification",
        title: parsedCommand.title,
        summary: `Environment verification completed with ${report.status} status.`,
        data: { report },
      };
    }
    if (parsedCommand.target === "verification-remote-executor") {
      const report = await getOperatorVerificationReport("remote-executor");
      return {
        kind: "inspect",
        target: "verification",
        title: parsedCommand.title,
        summary: `Remote executor verification completed with ${report.status} status.`,
        data: { report },
      };
    }
    if (parsedCommand.target === "verification-control-plane") {
      const report = await getOperatorVerificationReport("control-plane");
      return {
        kind: "inspect",
        target: "verification",
        title: parsedCommand.title,
        summary: `Control-plane verification completed with ${report.status} status.`,
        data: { report },
      };
    }
    if (parsedCommand.target === "verification-data-integrity") {
      const report = await getOperatorVerificationReport("data-integrity");
      return {
        kind: "inspect",
        target: "verification",
        title: parsedCommand.title,
        summary: `Data-integrity verification completed with ${report.status} status.`,
        data: { report },
      };
    }
    if (parsedCommand.target === "verification-deep-integrity") {
      const report = await getOperatorVerificationReport("deep-integrity");
      return {
        kind: "inspect",
        target: "verification",
        title: parsedCommand.title,
        summary: `Deep-integrity verification completed with ${report.status} status.`,
        data: { report },
      };
    }
    if (parsedCommand.target === "session") {
      const detail = await getWorkflowSessionDetail(parsedCommand.sessionId);
      return {
        kind: "inspect",
        target: "session",
        title: parsedCommand.title,
        summary: `Loaded session ${detail.session.title}.`,
        data: { detail },
      };
    }
    throw new Error("Unsupported inspect command target.");
  }

  if (parsedCommand.kind === "schedule-update") {
    const schedule = await updateOperatorSchedule(parsedCommand.scheduleId, {
      enabled: parsedCommand.enabled,
    });
    return {
      kind: "inspect",
      target: "schedule",
      title: parsedCommand.title,
      summary: `${schedule.title} is now ${schedule.enabled ? "enabled" : "disabled"}.`,
      data: { schedule },
    };
  }

  if (parsedCommand.kind === "schedule-run") {
    const result = await runScheduleNow(parsedCommand.scheduleId, {
      executionMode: parsedCommand.executionMode || "",
    });
    const schedule = await getOperatorSchedule(parsedCommand.scheduleId).catch(() => result.schedule);
    return {
      kind: "schedule-action",
      title: parsedCommand.title,
      parsedCommand,
      job: result.job,
      schedule,
    };
  }

  if (parsedCommand.kind === "routine-open") {
    const summary = await getCommandCenterSummary();
    const step = summary.dailyRoutine?.nextReviewStep || null;
    return {
      kind: "inspect",
      target: "routine-step",
      title: parsedCommand.title,
      summary: step
        ? `Next review routine step: ${step.title}.`
        : "No review checkpoint is currently waiting in the daily routine.",
      data: { step, routine: summary.dailyRoutine },
    };
  }

  if (parsedCommand.kind === "routine-run") {
    const summary = await getCommandCenterSummary();
    const step = summary.dailyRoutine?.nextSafeStep || null;
    if (!step) {
      return {
        kind: "inspect",
        target: "daily-routine",
        title: parsedCommand.title,
        summary: "No safe daily routine step is available right now.",
        data: { routine: summary.dailyRoutine, summary },
      };
    }
    if (!step.executionSafety?.safe_to_run_now || step.primaryAction?.type !== "action") {
      return {
        kind: "inspect",
        target: "routine-step",
        title: parsedCommand.title,
        summary: `The next routine step is ${step.title}, but it is not directly runnable from the console.`,
        data: { step, routine: summary.dailyRoutine },
      };
    }

    return {
      kind: "action",
      title: step.primaryAction.label || parsedCommand.title,
      parsedCommand: buildActionCommand({
        rawCommand: parsedCommand.rawCommand,
        actionId: step.primaryAction.action.id,
        title: step.primaryAction.label || step.title,
        input: step.primaryAction.input || {},
        context: step.primaryAction.context || {},
        executionMode: parsedCommand.executionMode || "",
      }),
    };
  }

  if (parsedCommand.confirmation?.required) {
    const checked = Boolean(confirmation?.checked);
    const typedYes = normalizeString(confirmation?.typedYes);
    if (!checked || (parsedCommand.confirmation.requireTypedYes && typedYes !== "YES")) {
      return {
        kind: "confirmation_required",
        title: parsedCommand.title,
        summary: "Explicit confirmation is required before this mutating command can run.",
        confirmation: parsedCommand.confirmation,
        parsedCommand,
      };
    }
  }

  return {
    kind: "action",
    title: parsedCommand.title,
    parsedCommand,
  };
}
