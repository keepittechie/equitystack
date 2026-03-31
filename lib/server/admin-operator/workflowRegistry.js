import { getOperatorActionDefinition } from "./actionRegistry.js";

const WORKFLOW_DEFINITIONS = [
  {
    id: "legislative.daily",
    title: "Legislative Daily Workflow",
    description: "Primary wrapped operator path for the legislative pipeline.",
    workflowFamily: "legislative",
    group: "Primary",
    surfaceHref: "/admin/legislative-workflow",
    steps: [
      {
        actionId: "legislative.run",
        title: "Run",
        description: "Refresh discovery, AI review, and the canonical review bundle.",
      },
      {
        actionId: "legislative.review",
        title: "Review",
        description: "Classify the bundle actions with explicit operator decisions.",
      },
      {
        actionId: "legislative.apply",
        title: "Apply",
        description: "Run apply dry-run by default; mutate only with explicit confirmation.",
      },
      {
        actionId: "legislative.import",
        title: "Import",
        description: "Run import dry-run by default; mutate only with explicit confirmation.",
        optional: true,
      },
      {
        actionId: "legislative.feedback",
        title: "Feedback",
        description: "Refresh the operator-facing feedback output after the run.",
        optional: true,
      },
    ],
  },
  {
    id: "currentAdmin.daily",
    title: "Current-Admin Daily Workflow",
    description: "Primary wrapped operator path for the current-admin pipeline.",
    workflowFamily: "current-admin",
    group: "Primary",
    surfaceHref: "/admin/current-admin-review",
    steps: [
      {
        actionId: "currentAdmin.run",
        title: "Run",
        description: "Discover, batch, normalize, review, and prepare the session.",
      },
      {
        actionId: "currentAdmin.review",
        title: "Review",
        description: "Write explicit operator decisions and finalize the decision log when valid.",
      },
      {
        actionId: "currentAdmin.apply",
        title: "Apply",
        description: "Run pre-commit and import dry-run first, then mutate only with confirmation.",
      },
      {
        actionId: "currentAdmin.status",
        title: "Status",
        description: "Inspect the state machine, artifacts, and next-step guidance.",
        optional: true,
      },
    ],
  },
  {
    id: "currentAdmin.advanced",
    title: "Current-Admin Advanced / Manual Workflow",
    description: "Legacy/manual operator commands preserved under the same canonical artifact model.",
    workflowFamily: "current-admin",
    group: "Advanced",
    surfaceHref: "/admin/tools",
    steps: [
      { actionId: "currentAdmin.discover", title: "Discover" },
      { actionId: "currentAdmin.genBatch", title: "Generate Batch" },
      { actionId: "currentAdmin.workflowStart", title: "Workflow Start" },
      { actionId: "currentAdmin.workflowReview", title: "Workflow Review" },
      { actionId: "currentAdmin.workflowFinalize", title: "Workflow Finalize" },
      { actionId: "currentAdmin.preCommit", title: "Pre-Commit" },
      { actionId: "currentAdmin.import", title: "Import" },
      { actionId: "currentAdmin.validate", title: "Validate" },
      { actionId: "currentAdmin.status", title: "Status" },
      { actionId: "currentAdmin.workflowResume", title: "Workflow Resume" },
    ],
  },
];

export function listWorkflowDefinitions() {
  return WORKFLOW_DEFINITIONS.map((workflow) => ({
    ...workflow,
    steps: workflow.steps.map((step) => ({
      ...step,
      action: getOperatorActionDefinition(step.actionId),
    })),
  }));
}

export function getWorkflowDefinition(workflowId) {
  return listWorkflowDefinitions().find((workflow) => workflow.id === workflowId) || null;
}

export function listSerializedWorkflows() {
  return listWorkflowDefinitions().map((workflow) => ({
    id: workflow.id,
    title: workflow.title,
    description: workflow.description,
    workflowFamily: workflow.workflowFamily,
    group: workflow.group,
    surfaceHref: workflow.surfaceHref,
    steps: workflow.steps.map((step) => ({
      actionId: step.actionId,
      title: step.title,
      description: step.description || step.action?.description || "",
      optional: Boolean(step.optional),
      actionTitle: step.action?.title || step.title,
    })),
  }));
}
