import { validateOperatorActionRegistry } from "./operatorActionUtils.js";

export const OPERATOR_ACTIONS = [
  {
    id: "current_admin_workflow_start",
    label: "Start Current-Admin Workflow",
    description: "Run the canonical current-admin workflow start command for a specific batch file.",
    allowed: true,
    workflow: "current-admin",
    execution_method:
      "Wrapped CLI: ./bin/equitystack current-admin workflow start --input data/current_admin_batches/<batch-file>.json",
    requires_confirmation: false,
    canonical_input:
      "./bin/equitystack current-admin workflow start --input data/current_admin_batches/<batch-file>.json",
    synonyms: [
      "start current-admin workflow",
      "current-admin workflow start",
      "run current-admin workflow start",
    ],
  },
  {
    id: "current_admin_workflow_resume",
    label: "Resume Current-Admin Workflow",
    description: "Show the latest current-admin session and recommended next operator step.",
    allowed: true,
    workflow: "current-admin",
    execution_method: "Wrapped CLI: ./bin/equitystack current-admin workflow resume",
    requires_confirmation: false,
    canonical_input: "./bin/equitystack current-admin workflow resume",
    synonyms: [
      "resume current-admin workflow",
      "current-admin workflow resume",
      "show current-admin workflow resume",
    ],
  },
  {
    id: "current_admin_discover",
    label: "Run Current-Admin Discovery",
    description: "Read-only discovery through the wrapped CLI.",
    allowed: true,
    workflow: "current-admin",
    execution_method: "Wrapped CLI: ./bin/equitystack current-admin discover",
    requires_confirmation: false,
    canonical_input: "./bin/equitystack current-admin discover",
    synonyms: [
      "run current-admin discovery",
      "current-admin discovery",
      "run current-admin discover",
      "current-admin discover",
    ],
  },
  {
    id: "current_admin_status",
    label: "Run Current-Admin Status",
    description: "Show canonical current-admin artifact state.",
    allowed: true,
    workflow: "current-admin",
    execution_method: "Wrapped CLI: ./bin/equitystack current-admin status",
    requires_confirmation: false,
    canonical_input: "./bin/equitystack current-admin status",
    synonyms: [
      "run current-admin status",
      "current-admin status",
      "show current-admin status",
    ],
  },
  {
    id: "current_admin_precommit",
    label: "Run Current-Admin Pre-Commit",
    description: "Refresh current-admin pre-commit readiness from the canonical queue artifact.",
    allowed: true,
    workflow: "current-admin",
    execution_method:
      "Wrapped CLI: ./bin/equitystack current-admin pre-commit --input <canonical queue>",
    requires_confirmation: false,
    canonical_input:
      "./bin/equitystack current-admin pre-commit --input reports/current_admin/<batch-name>.manual-review-queue.json",
    allowed_states: ["QUEUE_READY", "PRECOMMIT_READY", "BLOCKED", "IMPORT_READY", "COMPLETE"],
    synonyms: [
      "run current-admin pre-commit",
      "run pre-commit",
      "current-admin pre-commit",
      "pre-commit",
      "precommit",
    ],
  },
  {
    id: "legislative_run",
    label: "Run Legislative Workflow",
    description: "Run the canonical legislative pipeline through the wrapped CLI.",
    allowed: true,
    workflow: "legislative",
    execution_method: "Wrapped CLI: ./bin/equitystack legislative run",
    requires_confirmation: false,
    canonical_input: "./bin/equitystack legislative run",
    synonyms: [
      "run legislative workflow",
      "run legislative pipeline",
      "legislative run",
      "start legislative workflow",
    ],
  },
  {
    id: "legislative_apply_dry_run",
    label: "Run Legislative Apply Dry-Run",
    description: "Preview approved legislative bundle actions safely.",
    allowed: true,
    workflow: "legislative",
    execution_method: "Wrapped CLI: ./bin/equitystack legislative apply --dry-run",
    requires_confirmation: false,
    canonical_input: "./bin/equitystack legislative apply --dry-run",
    allowed_states: ["APPLY_READY"],
    synonyms: [
      "run legislative apply dry-run",
      "legislative apply dry-run",
      "run legislative review dry-run",
      "legislative review dry-run",
    ],
  },
  {
    id: "summarize_state",
    label: "Summarize Latest Workflow State",
    description: "Summarize canonical current-admin and legislative artifacts without running commands.",
    allowed: true,
    workflow: "system",
    execution_method:
      "Read-only summary of canonical current-admin and legislative workflow services",
    requires_confirmation: false,
    canonical_input: "summarize state",
    synonyms: [
      "summarize latest artifacts",
      "summarize artifacts",
      "summarize latest workflow state",
      "summarize state",
      "summary",
    ],
  },
  {
    id: "show_attention",
    label: "Show What Needs Attention",
    description: "Summarize blockers, pending approvals, and the next safe page to open.",
    allowed: true,
    workflow: "system",
    execution_method:
      "Read-only summary of canonical attention indicators from the command center service",
    requires_confirmation: false,
    canonical_input: "show what needs attention",
    synonyms: [
      "what needs attention",
      "show attention",
      "show what needs attention",
      "needs attention",
    ],
  },
];

export function getOperatorActionRegistry() {
  validateOperatorActionRegistry(OPERATOR_ACTIONS);
  return OPERATOR_ACTIONS.filter((action) => action.allowed).map((action) => ({
    ...action,
    canonical_input: action.canonical_input || action.label,
  }));
}

export function getOperatorActionById(actionId) {
  return getOperatorActionRegistry().find((action) => action.id === actionId) || null;
}
