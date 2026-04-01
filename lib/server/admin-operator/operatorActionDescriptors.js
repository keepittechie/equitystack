import { getOperatorActionDefinition, serializeOperatorAction } from "./actionRegistry.js";
import { normalizeString } from "./shared.js";

function getSerializedAction(actionId) {
  const action = getOperatorActionDefinition(actionId);
  return action ? serializeOperatorAction(action) : null;
}

function buildDescriptor({
  actionId,
  label,
  input = {},
  context = {},
  tone = "default",
  helperText = "",
  confirmation = null,
}) {
  const action = getSerializedAction(actionId);
  if (!action) {
    return null;
  }

  return {
    id: `${actionId}:${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    action,
    label,
    input,
    context,
    tone,
    helperText: normalizeString(helperText),
    confirmation,
  };
}

function buildSessionContext(session, extras = {}) {
  return {
    sessionId: session.id,
    canonicalSessionKey: session.canonicalSessionKey,
    triggerSource: extras.triggerSource || "session_inspector",
    artifactId: extras.artifactId || null,
    artifactPath: extras.artifactPath || null,
    queueItemId: extras.queueItemId || null,
    queueType: extras.queueType || null,
  };
}

export function getReviewQueueActionDescriptors(item) {
  if (!item?.sessionId || !item?.workflowFamily) {
    return [];
  }

  const context = buildSessionContext(
    {
      id: item.sessionId,
      canonicalSessionKey: null,
    },
    {
      triggerSource: "review_queue",
      artifactId: item.sourceArtifactId || null,
      artifactPath: item.sourceArtifactPath || null,
      queueItemId: item.id,
      queueType: item.queueType,
    }
  );

  if (item.workflowFamily === "current-admin" && item.queueType === "operator-review") {
    return [
      buildDescriptor({
        actionId: "currentAdmin.review",
        label: "Start Review",
        context,
        helperText: "Refreshes the canonical review template/finalize path for this session.",
      }),
    ].filter(Boolean);
  }

  if (item.workflowFamily === "current-admin" && item.queueType === "apply-readiness") {
    const actions = [
      buildDescriptor({
        actionId: "currentAdmin.apply",
        label: "Apply (dry-run)",
        context,
        helperText: "Reruns pre-commit and dry-run import without mutating data.",
      }),
    ];

    if (item.state === "ready_for_apply_confirmation") {
      actions.push(
        buildDescriptor({
          actionId: "currentAdmin.apply",
          label: "Apply (final)",
          input: {
            apply: true,
            yes: true,
          },
          context,
          tone: "danger",
          helperText: "Runs the guarded mutating apply path with explicit confirmation.",
          confirmation: {
            title: "Confirm current-admin apply",
            description:
              "This will request the canonical mutating apply path. Pre-commit and broker safeguards still run.",
            checkboxLabel: "I understand this requests the canonical mutating apply step.",
            requireTypedYes: true,
          },
        })
      );
    }

    return actions.filter(Boolean);
  }

  if (
    item.workflowFamily === "legislative" &&
    ["bundle-approval", "manual-review"].includes(item.queueType)
  ) {
    return [
      buildDescriptor({
        actionId: "legislative.review",
        label: item.queueType === "manual-review" ? "Open Manual Review" : "Open Review Bundle",
        context,
        helperText:
          item.queueType === "manual-review"
            ? "Opens the canonical legislative review surface for manual-review items."
            : "Refreshes the canonical legislative review surface for this bundle.",
      }),
    ].filter(Boolean);
  }

  return [];
}

function getSessionResumeActionId(session) {
  if (session.workflowFamily === "current-admin") {
    return "currentAdmin.workflowResume";
  }
  if (session.workflowFamily === "legislative") {
    return "legislative.review";
  }
  return null;
}

function getSessionFallbackActionId(session) {
  if (session.workflowFamily === "current-admin") {
    return "currentAdmin.status";
  }
  if (session.workflowFamily === "legislative") {
    return "legislative.review";
  }
  return null;
}

export function getSessionActionDescriptors(sessionDetail) {
  const session = sessionDetail?.session;
  if (!session?.id) {
    return [];
  }

  const context = buildSessionContext(session, {
    triggerSource: "session_inspector",
  });
  const nextActionId = session.recommendedActionId || getSessionFallbackActionId(session);
  const resumeActionId = getSessionResumeActionId(session);
  const actions = [];

  if (nextActionId) {
    actions.push(
      buildDescriptor({
        actionId: nextActionId,
        label: "Run Next Recommended Action",
        context,
        tone: "primary",
        helperText: session.recommendedAction?.title
          ? `Recommended by canonical state: ${session.recommendedAction.title}.`
          : "Runs the safest known next action for this session.",
      })
    );
  }

  if (resumeActionId) {
    actions.push(
      buildDescriptor({
        actionId: resumeActionId,
        label: "Resume Workflow",
        context,
        helperText:
          session.workflowFamily === "current-admin"
            ? "Reads the canonical current-admin handoff state."
            : "Refreshes the legislative review surface for this session.",
      })
    );
  }

  if (session.workflowFamily === "current-admin" && session.canonicalState === "IMPORT_READY") {
    actions.push(
      buildDescriptor({
        actionId: "currentAdmin.apply",
        label: "Apply (final)",
        input: {
          apply: true,
          yes: true,
        },
        context,
        tone: "danger",
        helperText: "Requests the canonical mutating apply step for this ready session.",
        confirmation: {
          title: "Confirm current-admin apply",
          description:
            "This requests the canonical mutating apply path. Broker validation and CLI safeguards still run.",
          checkboxLabel: "I understand this requests the canonical mutating apply step.",
          requireTypedYes: true,
        },
      })
    );
  }

  if (
    session.workflowFamily === "legislative" &&
    ["legislative.apply", "legislative.import"].includes(nextActionId || "")
  ) {
    actions.push(
      buildDescriptor({
        actionId: nextActionId,
        label: nextActionId === "legislative.import" ? "Run Import (final)" : "Apply Bundle (final)",
        input: {
          apply: true,
          yes: true,
        },
        context,
        tone: "danger",
        helperText: "Requests the canonical mutating legislative path with explicit confirmation.",
        confirmation: {
          title:
            nextActionId === "legislative.import"
              ? "Confirm legislative import"
              : "Confirm legislative apply",
          description:
            "This requests the canonical mutating legislative step. Approval decisions still remain explicit and separate.",
          checkboxLabel: "I understand this requests the canonical mutating legislative step.",
          requireTypedYes: true,
        },
      })
    );
  }

  return actions.filter(Boolean);
}
