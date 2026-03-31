import {
  buildOperatorActionCommand,
  getOperatorActionDefinition,
  resolveOperatorActionExecutionMode,
  serializeOperatorAction,
  validateOperatorActionInput,
} from "./actionRegistry.js";
import { getRunnerTypeForExecutionMode, runOperatorActionCommand } from "./actionRunner.js";
import { buildJobFailureAssist } from "./operatorAssist.js";
import {
  appendJobLog,
  createJobRun,
  getJobRun,
  listJobRuns,
  readJobLog,
  updateJobRun,
} from "./jobRunStore.js";
import {
  captureWorkflowFamilyArtifactSnapshot,
  diffArtifacts,
  getWorkflowSessionDetail,
  listWorkflowSessions,
  refreshWorkflowFamilyState,
  resolveWorkflowSessionAssociation,
} from "./workflowData.js";
import {
  buildExecutionRuntimeMetadata,
  getExecutorMetadata,
  normalizeString,
  toSerializableError,
  uniqueStrings,
} from "./shared.js";

const TERMINAL_JOB_STATUSES = new Set(["success", "failed", "blocked", "cancelled"]);

function isMutatingJob(action, input = {}) {
  return Boolean(action?.execution?.mutating && input?.apply && input?.yes);
}

function getMutatingConfirmation(action) {
  return {
    required: true,
    title: `Confirm ${action.title}`,
    description:
      "This will request the canonical mutating path again. Registry, broker, and CLI guardrails still apply.",
    checkboxLabel: `I understand this reruns the guarded mutating ${action.title.toLowerCase()} action.`,
    requireTypedYes: true,
  };
}

function isConfirmationSatisfied(confirmation = {}) {
  return Boolean(confirmation.checked) && normalizeString(confirmation.typedYes) === "YES";
}

function getLikelyFailureSource({ action, error, phase = "", runResult = null, status = "" }) {
  const message = normalizeString(error?.message || error || runResult?.errorMessage).toLowerCase();

  if (normalizeString(runResult?.failureKind)) {
    return normalizeString(runResult.failureKind);
  }
  if (status === "blocked") {
    return "guardrail";
  }
  if (runResult?.timedOut) {
    return "timeout";
  }
  if (
    message.includes("session does not match") ||
    message.includes("artifact id did not match") ||
    message.includes("artifact path did not match") ||
    message.includes("review queue item did not match") ||
    message.includes("canonical session key did not match")
  ) {
    return "stale_context";
  }
  if (
    message.includes("not found") ||
    message.includes("missing") ||
    message.includes("no such file")
  ) {
    return "missing_artifact";
  }
  if (phase === "context_validation") {
    return "validation";
  }
  if (phase === "runner") {
    return "local_runner";
  }
  if (phase === "post_refresh") {
    return "workflow_refresh";
  }
  if (action?.execution?.readOnly && status === "failed") {
    return "cli";
  }
  return "broker";
}

function getNextSafeActionId({ action, sessionDetail, status }) {
  if (status === "blocked") {
    return (
      sessionDetail?.session?.recommendedActionId ||
      (action.workflowFamily === "current-admin" ? "currentAdmin.status" : "legislative.review")
    );
  }
  return (
    sessionDetail?.session?.recommendedActionId ||
    action?.recommendedFollowUpActionId ||
    (action?.workflowFamily === "current-admin" ? "currentAdmin.status" : "legislative.review")
  );
}

function buildFailureMetadata({ job, action, error, phase = "", runResult = null, sessionDetail = null, status = "failed" }) {
  const likelySource = getLikelyFailureSource({
    action,
    error,
    phase,
    runResult,
    status,
  });
  const nextSafeActionId = getNextSafeActionId({
    action,
    sessionDetail,
    status,
  });
  const nextSafeAction = getOperatorActionDefinition(nextSafeActionId);

  return {
    likelySource,
    phase,
    status,
    message:
      normalizeString(error?.message || error || runResult?.errorMessage) ||
      job?.errorJson?.message ||
      "The operator job failed.",
    timedOut: Boolean(runResult?.timedOut),
    nextSafeActionId,
    nextSafeActionTitle: nextSafeAction?.title || null,
    sessionId: sessionDetail?.session?.id || job?.sessionIds?.[0] || null,
  };
}

function buildRerunDescriptor(job, action) {
  if (!action) {
    return {
      canRerun: false,
      requiresConfirmation: false,
      reason: "The original registry action is no longer available.",
      label: "Rerun",
      actionId: null,
    };
  }

  const validation = validateOperatorActionInput(action, job?.input || {});
  if (!validation.ok) {
    return {
      canRerun: false,
      requiresConfirmation: false,
      reason: validation.errors.join(" "),
      label: "Rerun",
      actionId: action.id,
    };
  }

  return {
    canRerun: TERMINAL_JOB_STATUSES.has(normalizeString(job?.status)),
    requiresConfirmation: isMutatingJob(action, job?.input || {}),
    reason: TERMINAL_JOB_STATUSES.has(normalizeString(job?.status))
      ? null
      : "Only terminal jobs can be rerun.",
    label: normalizeString(job?.status) === "failed" || normalizeString(job?.status) === "blocked" ? "Retry job" : "Rerun job",
    actionId: action.id,
    confirmation: isMutatingJob(action, job?.input || {}) ? getMutatingConfirmation(action) : null,
  };
}

function inferJobStatus({ action, runResult, sessionDetail }) {
  if (!runResult.ok) {
    return "failed";
  }

  if (action.id === "currentAdmin.apply") {
    const readiness = normalizeString(sessionDetail?.workspace?.latest_pre_commit_review?.readiness_status);
    if (readiness === "blocked") {
      return "blocked";
    }
  }

  return "success";
}

function summarizeRun({ action, input, sessionDetail, artifacts }) {
  const state =
    sessionDetail?.session?.state ||
    sessionDetail?.workspace?.batch?.stage ||
    sessionDetail?.workspace?.workflow_status ||
    "unknown";
  const artifactLabels = artifacts
    .filter((artifact) => artifact.exists)
    .slice(0, 3)
    .map((artifact) => artifact.label);
  const reviewRuntime =
    sessionDetail?.session?.metadataJson?.review_runtime ||
    sessionDetail?.workspace?.review_runtime ||
    null;

  const artifactText = artifactLabels.length ? ` Artifacts: ${artifactLabels.join(", ")}.` : "";
  const fallbackText = reviewRuntime?.fallback_used
    ? ` Review runtime: ${reviewRuntime.review_backend || "fallback"} fallback affected ${reviewRuntime.fallback_count || 0} item(s).`
    : "";

  if (action.id === "currentAdmin.apply" && !input.apply) {
    return `Current-admin apply completed in dry-run mode. Session state: ${state}.${artifactText}${fallbackText}`;
  }

  if (action.id === "legislative.apply" && !input.apply) {
    return `Legislative apply completed in dry-run mode. Session state: ${state}.${artifactText}${fallbackText}`;
  }

  if (action.id === "legislative.import" && !input.apply) {
    return `Legislative import completed in dry-run mode. Session state: ${state}.${artifactText}${fallbackText}`;
  }

  return `${action.title} completed. Session state: ${state}.${artifactText}${fallbackText}`;
}

function buildQueuedJobSummary(action) {
  return `${action.title} is queued through the registry-backed command broker.`;
}

function normalizeActionContext(context = {}) {
  return {
    sessionId: normalizeString(context.sessionId) || null,
    canonicalSessionKey: normalizeString(context.canonicalSessionKey) || null,
    artifactId: normalizeString(context.artifactId) || null,
    artifactPath: normalizeString(context.artifactPath || context.sourceArtifactPath) || null,
    queueItemId: normalizeString(context.queueItemId) || null,
    queueType: normalizeString(context.queueType) || null,
    triggerSource: normalizeString(context.triggerSource) || "ui",
  };
}

async function resolveRegisteredActionExecutionContext(action, input = {}, context = {}) {
  const normalizedContext = normalizeActionContext(context);
  let sessionDetail = null;

  if (normalizedContext.sessionId) {
    sessionDetail = await getWorkflowSessionDetail(normalizedContext.sessionId);
    if (sessionDetail.session.workflowFamily !== action.workflowFamily) {
      throw new Error("Action context session does not match the action workflow family.");
    }
    if (
      normalizedContext.canonicalSessionKey &&
      normalizeString(sessionDetail.metadata?.canonicalSessionKey) !== normalizedContext.canonicalSessionKey
    ) {
      throw new Error("Action context canonical session key did not match the selected session.");
    }
    if (
      normalizedContext.artifactId &&
      !sessionDetail.artifacts.some((artifact) => artifact.id === normalizedContext.artifactId)
    ) {
      throw new Error("Action context artifact id did not match the selected session.");
    }
    if (
      normalizedContext.artifactPath &&
      !sessionDetail.artifacts.some((artifact) => artifact.canonicalPath === normalizedContext.artifactPath)
    ) {
      throw new Error("Action context artifact path did not match the selected session.");
    }
    if (
      normalizedContext.queueItemId &&
      !sessionDetail.reviewQueueItems.some((item) => item.id === normalizedContext.queueItemId)
    ) {
      throw new Error("Action context review queue item did not match the selected session.");
    }
  }

  const fields = action?.inputSchema?.fields || {};
  const resolvedInput = { ...(input || {}) };
  const contextualSessionKey =
    normalizedContext.canonicalSessionKey ||
    normalizeString(sessionDetail?.metadata?.canonicalSessionKey) ||
    normalizeString(sessionDetail?.session?.canonicalSessionKey);
  const contextualArtifactPath =
    normalizedContext.artifactPath ||
    normalizeString(
      sessionDetail?.artifacts.find((artifact) => artifact.id === normalizedContext.artifactId)?.canonicalPath
    );

  if (fields.batchName && !normalizeString(resolvedInput.batchName) && contextualSessionKey) {
    resolvedInput.batchName = contextualSessionKey;
  }
  if (
    fields.input &&
    !normalizeString(resolvedInput.input) &&
    !normalizeString(resolvedInput.batchName) &&
    contextualArtifactPath
  ) {
    resolvedInput.input = contextualArtifactPath;
  }
  if (
    fields.review &&
    !normalizeString(resolvedInput.review) &&
    contextualArtifactPath
  ) {
    resolvedInput.review = contextualArtifactPath;
  }

  const validation = validateOperatorActionInput(action, resolvedInput);
  if (!validation.ok) {
    throw new Error(validation.errors.join(" "));
  }

  return {
    normalizedContext,
    normalizedInput: validation.normalizedInput,
    sessionDetail,
    sessionIds: uniqueStrings([
      normalizedContext.sessionId,
      ...resolveWorkflowSessionAssociation(action, validation.normalizedInput),
    ]),
  };
}

export async function createRegisteredActionJob({
  actionId,
  input = {},
  context = {},
  executionMode = "",
  metadataJson = {},
}) {
  return createRegisteredActionJobWithMetadata({ actionId, input, context, executionMode, metadataJson });
}

async function createRegisteredActionJobWithMetadata({
  actionId,
  input = {},
  context = {},
  executionMode = "",
  metadataJson = {},
}) {
  const action = getOperatorActionDefinition(actionId);
  if (!action) {
    throw new Error(`Unknown operator action: ${actionId}`);
  }
  const resolvedMode = resolveOperatorActionExecutionMode(action, executionMode);
  const runtimeMetadata = buildExecutionRuntimeMetadata(resolvedMode.executionMode);

  const resolvedContext = await resolveRegisteredActionExecutionContext(action, input, context);
  const normalizedInput = resolvedContext.normalizedInput;
  const command = buildOperatorActionCommand(action, normalizedInput);

  const job = await createJobRun({
    actionId: action.id,
    actionTitle: action.title,
    workflowFamily: action.workflowFamily,
    runnerType: getRunnerTypeForExecutionMode(resolvedMode.executionMode),
    status: "queued",
    summary: `${buildQueuedJobSummary(action)} Execution mode: ${resolvedMode.executionMode}.`,
    input: normalizedInput,
    command,
    sessionIds: resolvedContext.sessionIds,
    metadataJson: {
      ...metadataJson,
      executor: runtimeMetadata,
      workflow_family: action.workflowFamily,
      registry_action_id: action.id,
      operator_surface_command: action.operatorSurfaceCommand,
      action_context: resolvedContext.normalizedContext,
      execution_mode: resolvedMode.executionMode,
      executor_transport: runtimeMetadata.executor_transport || null,
      execution_runtime: {
        execution_mode: resolvedMode.executionMode,
        runner_type: getRunnerTypeForExecutionMode(resolvedMode.executionMode),
        executor: runtimeMetadata,
      },
    },
  });

  await appendJobLog(job.id, `Queued ${action.title} in ${resolvedMode.executionMode} mode.`);
  await appendJobLog(job.id, `CLI args: ${command.args.join(" ")}`);
  await appendJobLog(
    job.id,
    `Execution runtime: ${runtimeMetadata.executor_backend || "unknown"} @ ${runtimeMetadata.executor_host || "unknown"} via ${runtimeMetadata.executor_transport || "unknown"}${runtimeMetadata.executor_transport_target ? ` (${runtimeMetadata.executor_transport_target})` : ""}.`
  );

  return {
    job: await getJobRun(job.id),
    action: serializeOperatorAction(action),
  };
}

export async function runRegisteredActionJob(jobId) {
  const job = await getJobRun(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} was not found.`);
  }

  if (["running", "success", "failed", "blocked", "cancelled"].includes(job.status)) {
    return {
      job,
      action: serializeOperatorAction(getOperatorActionDefinition(job.actionId)),
    };
  }

  const action = getOperatorActionDefinition(job.actionId);
  if (!action) {
    throw new Error(`Unknown operator action: ${job.actionId}`);
  }
  const resolvedMode = resolveOperatorActionExecutionMode(
    action,
    job.metadataJson?.execution_mode || ""
  );

  let phase = "context_validation";
  let sessionDetail = null;
  let runResult = null;

  try {
    const resolvedContext = await resolveRegisteredActionExecutionContext(
      action,
      job.input || {},
      job.metadataJson?.action_context || {}
    );
    const normalizedInput = resolvedContext.normalizedInput;
    const before = await captureWorkflowFamilyArtifactSnapshot(action.workflowFamily);
    const sessionIdsBefore =
      resolvedContext.sessionIds.length
        ? resolvedContext.sessionIds
        : before?.session?.id
          ? [before.session.id]
          : [];

    await updateJobRun(job.id, {
      status: "running",
      runnerType: getRunnerTypeForExecutionMode(resolvedMode.executionMode),
      sessionIds: sessionIdsBefore,
      summary: `${action.title} is running through the command broker in ${resolvedMode.executionMode} mode.`,
      timestamps: {
        startedAt: new Date().toISOString(),
      },
    });

    await appendJobLog(job.id, `Starting ${action.title} in ${resolvedMode.executionMode} mode.`);

    phase = "runner";
    runResult = await runOperatorActionCommand({
      action,
      command: job.command || { args: [] },
      executionMode: resolvedMode.executionMode,
      timeoutMs: action.execution.defaultTimeoutMs,
    });

    for (const event of runResult.transportEvents || []) {
      await appendJobLog(job.id, event);
    }
    if (runResult.stdout) {
      await appendJobLog(job.id, runResult.stdout);
    }
    if (runResult.stderr) {
      await appendJobLog(job.id, runResult.stderr, runResult.ok ? "warn" : "error");
    }

    phase = "post_refresh";
    const refreshedState = await refreshWorkflowFamilyState(action.workflowFamily, {
      relatedJobRunId: job.id,
      refreshReason: "job_completion",
    });
    const sessions = await listWorkflowSessions();
    const session =
      sessions.find((entry) => entry.id === refreshedState?.session?.id) ||
      sessions.find((entry) => entry.workflowFamily === action.workflowFamily) ||
      null;
    sessionDetail = session
      ? await getWorkflowSessionDetail(session.id)
      : { session: refreshedState?.session || null, workspace: refreshedState?.workspace || null, artifacts: refreshedState?.artifacts || [] };
    const changedArtifacts = diffArtifacts(before?.artifacts || [], sessionDetail?.artifacts || []);
    const status = inferJobStatus({
      action,
      runResult,
      sessionDetail,
    });
    const summary = runResult.ok
      ? summarizeRun({
        action,
        input: normalizedInput,
        sessionDetail,
        artifacts: changedArtifacts,
      })
      : normalizeString(runResult.errorMessage) || `${action.title} failed.`;
    const failureMetadata =
      !runResult.ok || status === "blocked"
        ? buildFailureMetadata({
          job,
          action,
          error: runResult.errorMessage,
          phase,
          runResult,
          sessionDetail,
          status,
        })
        : null;

    const patch = {
      status,
      summary,
      artifacts: changedArtifacts,
      sessionIds: sessionDetail?.session?.id ? [sessionDetail.session.id] : sessionIdsBefore,
      output: {
        stdout: runResult.stdout,
        stderr: runResult.stderr,
        exitCode: runResult.exitCode,
        timedOut: runResult.timedOut,
        durationMs: runResult.durationMs,
        session: sessionDetail?.session || null,
        workspaceSummary: sessionDetail?.workspace
          ? {
              state:
                sessionDetail.workspace?.batch?.stage ||
                sessionDetail.workspace?.workflow_status ||
                null,
              nextStep:
                sessionDetail.workspace?.next_recommended_action ||
                sessionDetail.workspace?.next_step ||
                null,
            }
          : null,
        transport_report: runResult.transportReport || null,
        workflowReviewRuntime:
          sessionDetail?.session?.metadataJson?.review_runtime ||
          sessionDetail?.workspace?.review_runtime ||
          null,
      },
      metadataJson: {
        ...(job.metadataJson || {}),
        executor: runResult.runtimeMetadata || buildExecutionRuntimeMetadata(resolvedMode.executionMode),
        final_session_id: sessionDetail?.session?.id || null,
        execution_mode: resolvedMode.executionMode,
        executor_transport:
          runResult.runtimeMetadata?.executor_transport ||
          normalizeString(job.metadataJson?.executor_transport) ||
          null,
        execution_runtime: {
          execution_mode: resolvedMode.executionMode,
          runner_type: getRunnerTypeForExecutionMode(resolvedMode.executionMode),
          executor:
            runResult.runtimeMetadata || buildExecutionRuntimeMetadata(resolvedMode.executionMode),
          transport_report: runResult.transportReport || null,
        },
        review_runtime:
          sessionDetail?.session?.metadataJson?.review_runtime ||
          sessionDetail?.workspace?.review_runtime ||
          null,
        failure: failureMetadata,
      },
      timestamps: {
        startedAt: runResult.startedAt,
        finishedAt: runResult.finishedAt,
      },
    };

    if (!runResult.ok) {
      patch.errorJson = toSerializableError(new Error(runResult.errorMessage));
    }

    await updateJobRun(job.id, patch);
    await appendJobLog(job.id, summary, runResult.ok && status !== "blocked" ? "info" : "error");

    return {
      job: await getJobRun(job.id),
      action: serializeOperatorAction(action),
    };
  } catch (error) {
    const failureMetadata = buildFailureMetadata({
      job,
      action,
      error,
      phase,
      runResult,
      sessionDetail,
      status: "failed",
    });
    const summary = failureMetadata.message || `${action.title} failed.`;

    await updateJobRun(job.id, {
      status: "failed",
      summary,
      errorJson: toSerializableError(error),
      metadataJson: {
        ...(job.metadataJson || {}),
        executor: runResult?.runtimeMetadata || buildExecutionRuntimeMetadata(resolvedMode.executionMode),
        execution_mode: resolvedMode.executionMode,
        executor_transport:
          runResult?.runtimeMetadata?.executor_transport ||
          normalizeString(job.metadataJson?.executor_transport) ||
          null,
        execution_runtime: {
          execution_mode: resolvedMode.executionMode,
          runner_type: getRunnerTypeForExecutionMode(resolvedMode.executionMode),
          executor:
            runResult?.runtimeMetadata || buildExecutionRuntimeMetadata(resolvedMode.executionMode),
          transport_report: runResult?.transportReport || null,
        },
        failure: failureMetadata,
      },
      timestamps: {
        startedAt: job.timestamps?.startedAt || new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      },
    });
    await appendJobLog(job.id, summary, "error");

    return {
      job: await getJobRun(job.id),
      action: serializeOperatorAction(action),
    };
  }
}

export async function executeRegisteredAction({ actionId, input = {}, context = {}, executionMode = "" }) {
  const created = await createRegisteredActionJob({ actionId, input, context, executionMode });
  return runRegisteredActionJob(created.job.id);
}

export async function listBrokerJobs({ limit = 25 } = {}) {
  const jobs = await listJobRuns({ limit });
  return Promise.all(jobs.map((job) => decorateBrokerJob(job)));
}

async function decorateBrokerJob(job, { includeLog = false } = {}) {
  if (!job) {
    return null;
  }
  const action = getOperatorActionDefinition(job.actionId);
  const rerun = buildRerunDescriptor(job, action);

  return {
    ...job,
    rerun,
    failure: job.metadataJson?.failure || null,
    schedule: job.metadataJson?.scheduling || null,
    execution: job.metadataJson?.execution_runtime || {
      execution_mode: job.metadataJson?.execution_mode || null,
      executor: job.metadataJson?.executor || getExecutorMetadata(),
    },
    assist: {
      failure: buildJobFailureAssist({
        ...job,
        rerun,
        failure: job.metadataJson?.failure || null,
      }),
    },
    links: {
      job: `/admin/jobs/${job.id}`,
      session: job.sessionIds?.[0] ? `/admin/workflows/${encodeURIComponent(job.sessionIds[0])}` : null,
    },
    log: includeLog ? await readJobLog(job.id) : undefined,
  };
}

export async function getBrokerJob(jobId) {
  const job = await getJobRun(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} was not found.`);
  }

  return decorateBrokerJob(job, { includeLog: true });
}

export async function rerunBrokerJob(jobId, { confirmation = {} } = {}) {
  const job = await getJobRun(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} was not found.`);
  }

  const action = getOperatorActionDefinition(job.actionId);
  const rerun = buildRerunDescriptor(job, action);
  if (!rerun.canRerun) {
    throw new Error(rerun.reason || "This job cannot be rerun.");
  }

  if (rerun.requiresConfirmation && !isConfirmationSatisfied(confirmation)) {
    return {
      mode: "confirmation_required",
      confirmation: rerun.confirmation,
      originalJobId: job.id,
      action: action ? serializeOperatorAction(action) : null,
    };
  }

  const created = await createRegisteredActionJobWithMetadata({
    actionId: job.actionId,
    input: job.input || {},
    context: job.metadataJson?.action_context || {},
    executionMode: job.metadataJson?.execution_mode || "",
    metadataJson: {
      rerun_of_job_id: job.id,
      rerun_requested_at: new Date().toISOString(),
      rerun_source_status: job.status,
    },
  });

  return {
    mode: "async",
    originalJob: await decorateBrokerJob(job),
    ...created,
  };
}
