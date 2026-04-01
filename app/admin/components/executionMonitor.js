import { formatAdminDateTime } from "@/app/admin/components/adminDateTime";

const REVIEW_ACTION_IDS = new Set(["currentAdmin.review", "legislative.review"]);
const APPROVAL_ACTION_IDS = new Set([
  "currentAdmin.apply",
  "legislative.apply",
  "legislative.import",
]);
const REVIEW_STATES = new Set(["REVIEW_READY"]);
const APPROVAL_STATES = new Set(["QUEUE_READY", "PRECOMMIT_READY", "APPLY_READY", "IMPORT_READY"]);
export const TERMINAL_JOB_STATUSES = new Set(["success", "failed", "blocked", "cancelled"]);

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function latestNonEmptyLine(value) {
  if (!normalizeString(value)) {
    return "";
  }

  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.at(-1) || "";
}

function deriveStopPoint(job) {
  const output = job?.output || {};
  const session = output.session || {};
  const workspaceSummary = output.workspaceSummary || {};
  const workspaceState = normalizeString(workspaceSummary.state || session.canonicalState).toUpperCase();
  const nextStep = workspaceSummary.nextStep || {};
  const nextActionId = normalizeString(
    nextStep.actionId ||
      session.recommendedActionId ||
      job?.failure?.nextSafeActionId ||
      job?.metadataJson?.failure?.nextSafeActionId
  );
  const nextActionTitle = normalizeString(
    nextStep.title ||
      nextStep.label ||
      session.recommendedAction?.title ||
      job?.failure?.nextSafeActionTitle ||
      job?.metadataJson?.failure?.nextSafeActionTitle
  );
  const operatorSurfaceHref = normalizeString(session.operatorSurfaceHref);
  const sessionHref = session.id ? `/admin/workflows/${encodeURIComponent(session.id)}` : "";

  if (REVIEW_ACTION_IDS.has(nextActionId) || REVIEW_STATES.has(workspaceState)) {
    return {
      phase: "stopped_for_operator_review",
      marker: "Operator Review required",
      nextLabel: "Open operator review",
      nextHref: operatorSurfaceHref || sessionHref || "/admin/review-queue",
      nextActionId,
      nextActionTitle: nextActionTitle || "Operator review",
      workspaceState,
    };
  }

  if (APPROVAL_ACTION_IDS.has(nextActionId) || APPROVAL_STATES.has(workspaceState)) {
    return {
      phase: "stopped_for_admin_approval",
      marker: "Admin Approval required",
      nextLabel: "Open admin checkpoint",
      nextHref: operatorSurfaceHref || sessionHref || "/admin/review-queue",
      nextActionId,
      nextActionTitle: nextActionTitle || "Admin approval",
      workspaceState,
    };
  }

  return {
    phase: "",
    marker: "",
    nextLabel: "",
    nextHref: operatorSurfaceHref || sessionHref || "",
    nextActionId,
    nextActionTitle,
    workspaceState,
  };
}

export function deriveExecutionMonitorState(job, options = {}) {
  if (!job) {
    return null;
  }

  const status = normalizeString(job.status || "queued");
  const output = job.output || {};
  const stopPoint = deriveStopPoint(job);
  const currentCommand =
    normalizeString(options.commandText) ||
    normalizeString(job.command?.cliCommandTemplate) ||
    normalizeString(job.command?.commandLine) ||
    normalizeString(job.command?.rawCommand) ||
    normalizeString(job.summary) ||
    normalizeString(job.actionTitle) ||
    "Broker-backed workflow action";
  const latestLine =
    latestNonEmptyLine(job.log) ||
    latestNonEmptyLine(output.stderr) ||
    latestNonEmptyLine(output.stdout) ||
    normalizeString(job.errorJson?.message) ||
    normalizeString(job.summary) ||
    "No execution updates yet.";

  let phase = status;
  if (status === "queued" || status === "running") {
    phase = status;
  } else if (stopPoint.phase) {
    phase = stopPoint.phase;
  }

  const shouldPoll = phase === "queued" || phase === "running";
  const isStopPoint =
    phase === "stopped_for_operator_review" || phase === "stopped_for_admin_approval";
  const jobHref = job.id ? `/admin/jobs/${job.id}` : "/admin/jobs";
  const sessionHref =
    stopPoint.nextHref ||
    (output.session?.id ? `/admin/workflows/${encodeURIComponent(output.session.id)}` : "");

  const trace = [
    job.timestamps?.createdAt
      ? { key: "queued", label: "Queued", value: formatAdminDateTime(job.timestamps.createdAt) }
      : null,
    job.timestamps?.startedAt
      ? { key: "started", label: "Execution started", value: formatAdminDateTime(job.timestamps.startedAt) }
      : null,
    latestLine
      ? { key: "latest", label: "Latest update", value: latestLine }
      : null,
    job.timestamps?.finishedAt
      ? {
          key: "finished",
          label: isStopPoint
            ? stopPoint.marker
            : status === "success"
              ? "Execution completed"
              : status === "failed"
                ? "Execution failed"
                : status === "blocked"
                  ? "Execution blocked"
                  : "Execution finished",
          value: formatAdminDateTime(job.timestamps.finishedAt),
        }
      : null,
  ].filter(Boolean);

  return {
    phase,
    status,
    shouldPoll,
    isStopPoint,
    currentCommand,
    latestLine,
    stopMarker: stopPoint.marker,
    nextLabel: stopPoint.nextLabel,
    nextHref: stopPoint.nextHref,
    nextActionId: stopPoint.nextActionId,
    nextActionTitle: stopPoint.nextActionTitle,
    workspaceState: stopPoint.workspaceState,
    sessionHref,
    jobHref,
    trace,
  };
}

export function executionPhaseLabel(phase) {
  if (phase === "queued") {
    return "Queued";
  }
  if (phase === "running") {
    return "Running";
  }
  if (phase === "stopped_for_operator_review") {
    return "Stopped For Operator Review";
  }
  if (phase === "stopped_for_admin_approval") {
    return "Stopped For Admin Approval";
  }
  if (phase === "success") {
    return "Success";
  }
  if (phase === "failed") {
    return "Failed";
  }
  if (phase === "blocked") {
    return "Blocked";
  }
  if (phase === "cancelled") {
    return "Cancelled";
  }
  return phase || "Unknown";
}
