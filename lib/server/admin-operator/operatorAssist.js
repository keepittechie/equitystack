import { getOperatorActionDefinition } from "./actionRegistry.js";
import { getExecutorMetadata, normalizeString, toArray } from "./shared.js";

function getAssistConfiguration() {
  return {
    assistMode: normalizeString(process.env.EQUITYSTACK_OPERATOR_ASSIST_MODE) || "deterministic",
    configuredExecutor: getExecutorMetadata(),
    advisoryOnly: true,
    usedModel: false,
  };
}

function buildAssistMetadata(kind, extras = {}) {
  return {
    kind,
    generatedAt: new Date().toISOString(),
    ...getAssistConfiguration(),
    ...extras,
  };
}

function summarizeMissingArtifacts(artifacts = []) {
  return artifacts.filter((artifact) => !artifact.exists).map((artifact) => artifact.label);
}

function buildCurrentAdminCompleted(metadata = {}) {
  const completed = [];
  const latestArtifacts = metadata.latest_artifacts || {};

  if (latestArtifacts.review) {
    completed.push("Review artifact prepared");
  }
  if (latestArtifacts.decision_log) {
    completed.push("Decision log recorded");
  }
  if (latestArtifacts.pre_commit) {
    completed.push("Pre-commit stage has run");
  }
  if (latestArtifacts.import_dry_run) {
    completed.push("Import dry-run artifact exists");
  }
  if (latestArtifacts.import_apply) {
    completed.push("Mutating import apply artifact exists");
  }
  if (latestArtifacts.validation) {
    completed.push("Validation artifact exists");
  }

  return completed;
}

function buildLegislativeCompleted(metadata = {}) {
  const completed = [];
  const latestArtifacts = metadata.latest_artifacts || {};

  if (latestArtifacts.review_bundle) {
    completed.push("Review bundle exists");
  }
  if (latestArtifacts.apply_report) {
    completed.push("Apply report exists");
  }
  if (latestArtifacts.import_report) {
    completed.push("Import report exists");
  }

  return completed;
}

export function buildSessionAssistSummary({
  session,
  artifacts = [],
  reviewQueueItems = [],
  relatedJobs = [],
}) {
  const blockers = toArray(session?.metadataJson?.blockers);
  const missingArtifacts = summarizeMissingArtifacts(artifacts);
  const completed =
    session?.workflowFamily === "current-admin"
      ? buildCurrentAdminCompleted(session?.metadataJson)
      : buildLegislativeCompleted(session?.metadataJson);
  const failedJobs = relatedJobs.filter((job) => ["failed", "blocked"].includes(job.status));
  const recommendedAction = getOperatorActionDefinition(session?.recommendedActionId);
  const whyRecommended =
    normalizeString(session?.metadataJson?.next_action_reason) ||
    "The next action is derived from the canonical workflow state.";
  const reviewRuntime = session?.metadataJson?.review_runtime || null;
  const fallbackNarrative = reviewRuntime?.fallback_used
    ? `Review runtime used ${normalizeString(reviewRuntime.review_backend) || "fallback"} and fallback affected ${reviewRuntime.fallback_count || 0} item(s)${normalizeString(reviewRuntime.fallback_reason) ? ` (${normalizeString(reviewRuntime.fallback_reason)})` : ""}.`
    : "No fallback-backed review runtime is recorded for this session.";

  const narrativeParts = [
    `${session?.title || "Workflow session"} is currently ${session?.canonicalState || "unknown"}.`,
    completed.length ? `Completed: ${completed.join(", ")}.` : "No completed workflow checkpoints are recorded yet.",
    blockers.length ? `Blocked by: ${blockers.join(" | ")}.` : "No explicit blockers are recorded.",
    missingArtifacts.length ? `Missing artifacts: ${missingArtifacts.join(", ")}.` : "No expected artifacts are currently missing.",
    fallbackNarrative,
    recommendedAction ? `Next: ${recommendedAction.title}.` : "No next action is currently recommended.",
    whyRecommended,
  ];

  if (failedJobs.length) {
    narrativeParts.push(`Recent failed or blocked jobs: ${failedJobs.length}.`);
  }

  return {
    currentState: session?.canonicalState || "unknown",
    completed,
    blocked: blockers,
    missingArtifacts,
    reviewQueueCount: reviewQueueItems.length,
    recentFailedJobCount: failedJobs.length,
    reviewRuntime,
    recommendedActionId: session?.recommendedActionId || null,
    recommendedActionTitle: recommendedAction?.title || null,
    whyRecommended,
    narrative: narrativeParts.join(" "),
    assist: buildAssistMetadata("session_summary"),
  };
}

export function buildReviewQueueExplanation(item) {
  const recommendedAction = getOperatorActionDefinition(item?.recommendedActionId);
  let whyExists = "This review item was derived from canonical workflow artifacts.";
  let expectedAction = recommendedAction?.title || "Inspect the canonical workflow surface";
  let riskLevel = "medium";

  if (item?.workflowFamily === "current-admin" && item?.queueType === "operator-review") {
    whyExists = "The current-admin review artifact still contains items that require explicit operator decisions.";
    expectedAction = recommendedAction?.title || "Current-Admin Review";
    riskLevel = item?.metadataJson?.operator_attention_needed ? "high" : "medium";
  } else if (item?.workflowFamily === "current-admin" && item?.queueType === "apply-readiness") {
    if (item?.state === "blocked") {
      whyExists = "The guarded apply path previously stopped at a blocking checkpoint.";
      expectedAction = "Investigate the blocker before retrying the guarded apply path";
      riskLevel = "high";
    } else if (item?.state === "ready_for_apply_confirmation") {
      whyExists = "A current-admin dry-run already exists and the session is waiting for explicit final apply confirmation.";
      expectedAction = "Confirm the guarded current-admin apply step if the dry-run is acceptable";
      riskLevel = "high";
    } else {
      whyExists = "Operator decisions are logged and the session is ready for the guarded pre-commit and dry-run path.";
      expectedAction = "Run the guarded current-admin apply dry-run";
      riskLevel = "medium";
    }
  } else if (item?.workflowFamily === "legislative" && item?.queueType === "bundle-approval") {
    whyExists = "The legislative review bundle still contains actionable items awaiting explicit operator review.";
    expectedAction = recommendedAction?.title || "Legislative Review";
    riskLevel = /high/i.test(normalizeString(item?.priority)) ? "high" : "medium";
  } else if (item?.workflowFamily === "legislative" && item?.queueType === "manual-review") {
    whyExists =
      "The canonical legislative manual-review queue contains items that AI could not safely auto-decide.";
    expectedAction = recommendedAction?.title || "Legislative Review";
    riskLevel = /high/i.test(normalizeString(item?.priority)) ? "high" : "medium";
  }

  return {
    whyExists,
    expectedAction,
    riskLevel,
    narrative: `${whyExists} Expected action: ${expectedAction}.`,
    assist: buildAssistMetadata("review_queue_explanation"),
  };
}

export function buildJobFailureAssist(job) {
  if (!job?.failure && !job?.errorJson) {
    return null;
  }

  const likelyCause =
    normalizeString(job?.failure?.likelySource) || (job?.status === "blocked" ? "guardrail" : "execution");
  const nextStep =
    normalizeString(job?.failure?.nextSafeActionTitle) ||
    "Inspect the related session before retrying.";
  const simplifiedExplanation =
    normalizeString(job?.failure?.message) ||
    normalizeString(job?.errorJson?.message) ||
    "The operator job failed before reaching a successful terminal state.";

  return {
    simplifiedExplanation,
    likelyCause,
    suggestedNextStep: nextStep,
    retryRecommended: Boolean(job?.rerun?.canRerun),
    assist: buildAssistMetadata("job_failure_explanation"),
  };
}

export function buildCommandExecutionAssist({ job, session }) {
  const nextAction = getOperatorActionDefinition(session?.recommendedActionId);
  return {
    jobSummary: normalizeString(job?.summary) || "The broker accepted the action and created a job record.",
    sessionImpact: session
      ? `${session.title} is currently ${session.canonicalState}.`
      : "No workflow session was attached yet.",
    nextRecommendedAction: nextAction?.title || null,
    nextRecommendedActionId: session?.recommendedActionId || null,
    narrative: session
      ? `${session.title} is ${session.canonicalState}. Next recommended action: ${nextAction?.title || "inspect the session"}.`
      : "Inspect the resulting job and session once the broker run completes.",
    assist: buildAssistMetadata("command_execution_summary"),
  };
}
