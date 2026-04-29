import path from "node:path";
import { EXECUTION_MODES, normalizeString } from "./shared.js";

const DEFAULT_EXECUTION_MODE_CONFIG = {
  defaultMode: EXECUTION_MODES.LOCAL_CLI,
  allowedModes: [EXECUTION_MODES.LOCAL_CLI],
  scheduleAllowedModes: [EXECUTION_MODES.LOCAL_CLI],
  autoScheduleAllowedModes: [EXECUTION_MODES.LOCAL_CLI],
};

const ACTION_EXECUTION_MODE_OVERRIDES = {
  "legislative.run": {
    defaultMode: EXECUTION_MODES.LOCAL_CLI,
    allowedModes: [EXECUTION_MODES.LOCAL_CLI, EXECUTION_MODES.REMOTE_EXECUTOR],
    scheduleAllowedModes: [EXECUTION_MODES.LOCAL_CLI, EXECUTION_MODES.REMOTE_EXECUTOR],
    autoScheduleAllowedModes: [EXECUTION_MODES.LOCAL_CLI, EXECUTION_MODES.REMOTE_EXECUTOR],
  },
  "legislative.feedback": {
    defaultMode: EXECUTION_MODES.LOCAL_CLI,
    allowedModes: [
      EXECUTION_MODES.LOCAL_CLI,
      EXECUTION_MODES.REMOTE_EXECUTOR,
      EXECUTION_MODES.MCP_RUNTIME,
    ],
    scheduleAllowedModes: [EXECUTION_MODES.LOCAL_CLI, EXECUTION_MODES.REMOTE_EXECUTOR],
    autoScheduleAllowedModes: [EXECUTION_MODES.LOCAL_CLI, EXECUTION_MODES.REMOTE_EXECUTOR],
  },
  "currentAdmin.run": {
    defaultMode: EXECUTION_MODES.LOCAL_CLI,
    allowedModes: [EXECUTION_MODES.LOCAL_CLI, EXECUTION_MODES.REMOTE_EXECUTOR],
    scheduleAllowedModes: [EXECUTION_MODES.LOCAL_CLI, EXECUTION_MODES.REMOTE_EXECUTOR],
    autoScheduleAllowedModes: [EXECUTION_MODES.LOCAL_CLI, EXECUTION_MODES.REMOTE_EXECUTOR],
  },
  "currentAdmin.status": {
    defaultMode: EXECUTION_MODES.LOCAL_CLI,
    allowedModes: [
      EXECUTION_MODES.LOCAL_CLI,
      EXECUTION_MODES.REMOTE_EXECUTOR,
      EXECUTION_MODES.MCP_RUNTIME,
    ],
    scheduleAllowedModes: [EXECUTION_MODES.LOCAL_CLI, EXECUTION_MODES.REMOTE_EXECUTOR],
    autoScheduleAllowedModes: [EXECUTION_MODES.LOCAL_CLI, EXECUTION_MODES.REMOTE_EXECUTOR],
  },
};

function buildCurrentAdminRunArgs(input = {}) {
  const args = ["current-admin", "run"];
  if (normalizeString(input.input)) {
    args.push("--input", normalizeString(input.input));
  }
  if (normalizeString(input.batchName)) {
    args.push("--batch-name", normalizeString(input.batchName));
  }
  if (input.reviewDryRun) {
    args.push("--review-dry-run");
  }
  if (input.discoveryDryRun) {
    args.push("--discovery-dry-run");
  }
  if (input.fullAuto) {
    args.push("--full-auto");
  }
  if (normalizeString(input.stopAfter)) {
    args.push("--stop-after", normalizeString(input.stopAfter));
  }
  if (input.noAutoApply) {
    args.push("--no-auto-apply");
  }
  if (input.noImpactAutomation) {
    args.push("--no-impact-automation");
  }
  return args;
}

function buildCurrentAdminReviewArgs(input = {}) {
  const args = ["current-admin", "review"];
  if (normalizeString(input.input)) {
    args.push("--input", normalizeString(input.input));
  }
  if (normalizeString(input.batchName)) {
    args.push("--batch-name", normalizeString(input.batchName));
  }
  if (normalizeString(input.decisionFile)) {
    args.push("--decision-file", normalizeString(input.decisionFile));
  }
  if (input.refreshTemplate) {
    args.push("--refresh-template");
  }
  if (input.logDecisionsPath) {
    args.push("--log-decisions", normalizeString(input.logDecisionsPath));
  } else if (input.logDecisions) {
    args.push("--log-decisions");
  }
  if (input.feedbackSummary) {
    args.push("--feedback-summary");
  }
  return args;
}

function buildCurrentAdminApplyArgs(input = {}) {
  const args = ["current-admin", "apply"];
  if (normalizeString(input.input)) {
    args.push("--input", normalizeString(input.input));
  }
  if (normalizeString(input.batchName)) {
    args.push("--batch-name", normalizeString(input.batchName));
  }
  if (input.apply) {
    args.push("--apply", "--yes");
  }
  return args;
}

function buildCurrentAdminStatusArgs(input = {}) {
  const args = ["current-admin", "status"];
  if (normalizeString(input.batchName)) {
    args.push("--batch-name", normalizeString(input.batchName));
  }
  return args;
}

function buildCurrentAdminDeepReviewArgs(input = {}) {
  const args = ["current-admin", "deep-review"];
  if (normalizeString(input.input)) {
    args.push("--input", normalizeString(input.input));
  }
  if (normalizeString(input.batchName)) {
    args.push("--batch-name", normalizeString(input.batchName));
  }
  if (normalizeString(input.experimentName)) {
    args.push("--experiment-name", normalizeString(input.experimentName));
  }
  if (input.resume) {
    args.push("--resume");
  }
  if (input.compare) {
    args.push("--compare");
  }
  return args;
}

function buildOperatorCleanupStaleWorkflowsArgs(input = {}) {
  const args = ["operator", "cleanup-stale-workflows"];
  if (input.apply) {
    args.push("--apply", "--yes");
  } else {
    args.push("--dry-run");
  }
  return args;
}

function buildImpactEvaluateArgs(input = {}) {
  const args = ["impact", "evaluate"];
  if (normalizeString(input.input)) {
    args.push("--input", normalizeString(input.input));
  }
  if (normalizeString(input.output)) {
    args.push("--output", normalizeString(input.output));
  }
  if (normalizeString(input.ledger)) {
    args.push("--ledger", normalizeString(input.ledger));
  }
  if (normalizeString(input.onlyRecordKey)) {
    args.push("--only-record-key", normalizeString(input.onlyRecordKey));
  }
  return args;
}

function buildImpactPromoteArgs(input = {}) {
  const args = ["impact", "promote"];
  if (normalizeString(input.input)) {
    args.push("--input", normalizeString(input.input));
  }
  if (normalizeString(input.output)) {
    args.push("--output", normalizeString(input.output));
  }
  if (normalizeString(input.ledger)) {
    args.push("--ledger", normalizeString(input.ledger));
  }
  if (input.apply) {
    args.push("--apply");
  } else {
    args.push("--dry-run");
  }
  if (input.yes) {
    args.push("--yes");
  }
  if (input.approveSafe) {
    args.push("--approve-safe");
  }
  if (normalizeString(input.onlyRecordKey)) {
    args.push("--only-record-key", normalizeString(input.onlyRecordKey));
  }
  return args;
}

function buildCurrentAdminGenBatchArgs(input = {}) {
  const args = ["current-admin", "gen-batch"];
  if (normalizeString(input.input)) {
    args.push("--input", normalizeString(input.input));
  }
  if (normalizeString(input.output)) {
    args.push("--output", normalizeString(input.output));
  }
  if (normalizeString(input.outputName)) {
    args.push("--output-name", normalizeString(input.outputName));
  }
  if (normalizeString(input.batchName)) {
    args.push("--batch-name", normalizeString(input.batchName));
  }
  if (input.allowOverwrite) {
    args.push("--allow-overwrite");
  }
  if (input.allCandidates) {
    args.push("--all-candidates");
  }
  return args;
}

function buildCurrentAdminInputCommand(subcommand, input = {}) {
  const args = ["current-admin", subcommand];
  if (normalizeString(input.input)) {
    args.push("--input", normalizeString(input.input));
  }
  if (input.apply) {
    args.push("--apply", "--yes");
  }
  return args;
}

function buildLegislativeApplyArgs(input = {}) {
  const args = ["legislative", "apply"];
  if (input.apply) {
    args.push("--apply", "--yes");
  } else {
    args.push("--dry-run");
  }
  return args;
}

function buildLegislativeImportArgs(input = {}) {
  const args = ["legislative", "import"];
  if (input.apply) {
    args.push("--apply", "--yes");
  } else {
    args.push("--dry-run");
  }
  return args;
}

function buildNoArgCommand(...args) {
  return () => args;
}

const PATH_FIELD = {
  type: "string",
  format: "path",
};

const BATCH_NAME_FIELD = {
  type: "string",
  format: "batch-name",
};

const APPLY_CONFIRMATION_CONSTRAINTS = [
  {
    kind: "requiresWhen",
    ifField: "apply",
    requiresField: "yes",
    message: "Mutating apply requires explicit confirmation.",
  },
  {
    kind: "requiresTogether",
    ifField: "yes",
    withField: "apply",
    message: "Confirmation is only valid when apply is requested.",
  },
];

const ACTION_DEFINITIONS = [
  {
    id: "legislative.run",
    title: "Legislative Run",
    description: "Run the wrapped legislative pipeline and refresh the canonical review bundle.",
    workflowFamily: "legislative",
    group: "Primary Operator Surfaces",
    displayOrder: 10,
    operatorSurfaceCommand: "legislative run",
    cliCommandTemplate: "./bin/equitystack legislative run",
    runnerType: "cli",
    execution: {
      mutating: false,
      readOnly: false,
      dryRunAware: false,
      requiresHumanApproval: false,
      defaultTimeoutMs: 60 * 60 * 1000,
      cancellationReady: true,
    },
    inputSchema: {
      type: "object",
      fields: {},
      constraints: [],
    },
    artifactExpectations: [
      { key: "pipeline_report", label: "Pipeline report", stage: "run", when: "success" },
      { key: "review_bundle", label: "Review bundle", stage: "review", when: "success" },
    ],
    guardrails: [
      "Runs only through the canonical legislative CLI.",
      "Does not create a parallel bundle or direct database write path.",
    ],
    outputContract: {
      kind: "workflow-session",
      sessionFamily: "legislative",
      summaryFields: ["workflow_status", "next_step", "artifact_status"],
    },
    scheduling: {
      schedulable: true,
      safeAutoRun: true,
      requiresHumanCheckpoint: true,
      allowedScheduleTypes: ["manual", "daily", "weekly", "interval"],
    },
    recommendedFollowUpActionId: "legislative.review",
    buildArgs: buildNoArgCommand("legislative", "run"),
  },
  {
    id: "legislative.review",
    title: "Legislative Review",
    description: "Open or refresh the canonical legislative review surface.",
    workflowFamily: "legislative",
    group: "Primary Operator Surfaces",
    displayOrder: 20,
    operatorSurfaceCommand: "legislative review",
    cliCommandTemplate: "./bin/equitystack legislative review",
    runnerType: "cli",
    execution: {
      mutating: false,
      readOnly: true,
      dryRunAware: false,
      requiresHumanApproval: true,
      defaultTimeoutMs: 20 * 60 * 1000,
      cancellationReady: true,
    },
    inputSchema: {
      type: "object",
      fields: {},
      constraints: [],
    },
    artifactExpectations: [
      { key: "review_bundle", label: "Review bundle", stage: "review", when: "success" },
    ],
    guardrails: [
      "Approval decisions remain explicit and separate from execution.",
      "The admin reflects canonical bundle state instead of inventing review state.",
    ],
    outputContract: {
      kind: "workflow-session",
      sessionFamily: "legislative",
      summaryFields: ["workflow_status", "counts.pending_unreviewed_actions", "review_bundle"],
    },
    scheduling: {
      schedulable: false,
      safeAutoRun: false,
      requiresHumanCheckpoint: true,
      allowedScheduleTypes: [],
    },
    recommendedFollowUpActionId: "legislative.apply",
    buildArgs: buildNoArgCommand("legislative", "review"),
  },
  {
    id: "legislative.apply",
    title: "Legislative Apply",
    description: "Run the legislative apply dry-run by default, or mutate only with explicit confirmation.",
    workflowFamily: "legislative",
    group: "Primary Operator Surfaces",
    displayOrder: 30,
    operatorSurfaceCommand: "legislative apply",
    cliCommandTemplate: "./bin/equitystack legislative apply --dry-run | --apply --yes",
    runnerType: "cli",
    execution: {
      mutating: true,
      readOnly: false,
      dryRunAware: true,
      requiresHumanApproval: true,
      defaultTimeoutMs: 45 * 60 * 1000,
      cancellationReady: true,
    },
    inputSchema: {
      type: "object",
      fields: {
        apply: { type: "boolean", default: false, label: "Mutating apply" },
        yes: { type: "boolean", default: false, label: "Explicit confirmation" },
      },
      constraints: APPLY_CONFIRMATION_CONSTRAINTS,
    },
    artifactExpectations: [
      { key: "apply_report", label: "Apply report", stage: "apply", when: "success" },
    ],
    guardrails: [
      "Dry-run and apply remain separate.",
      "Mutating apply still requires explicit confirmation.",
    ],
    outputContract: {
      kind: "workflow-session",
      sessionFamily: "legislative",
      summaryFields: ["workflow_status", "apply_report", "artifact_status"],
    },
    scheduling: {
      schedulable: false,
      safeAutoRun: false,
      requiresHumanCheckpoint: true,
      allowedScheduleTypes: [],
    },
    recommendedFollowUpActionId: "legislative.import",
    buildArgs: buildLegislativeApplyArgs,
  },
  {
    id: "legislative.import",
    title: "Legislative Import",
    description: "Run the legislative import dry-run by default, or mutate only with explicit confirmation.",
    workflowFamily: "legislative",
    group: "Primary Operator Surfaces",
    displayOrder: 40,
    operatorSurfaceCommand: "legislative import",
    cliCommandTemplate: "./bin/equitystack legislative import --dry-run | --apply --yes",
    runnerType: "cli",
    execution: {
      mutating: true,
      readOnly: false,
      dryRunAware: true,
      requiresHumanApproval: true,
      defaultTimeoutMs: 45 * 60 * 1000,
      cancellationReady: true,
    },
    inputSchema: {
      type: "object",
      fields: {
        apply: { type: "boolean", default: false, label: "Mutating import" },
        yes: { type: "boolean", default: false, label: "Explicit confirmation" },
      },
      constraints: APPLY_CONFIRMATION_CONSTRAINTS,
    },
    artifactExpectations: [
      { key: "import_report", label: "Import report", stage: "import", when: "success" },
    ],
    guardrails: [
      "Import stays inside the wrapped CLI path.",
      "The command center does not create a direct tracked-bill write path.",
    ],
    outputContract: {
      kind: "workflow-session",
      sessionFamily: "legislative",
      summaryFields: ["workflow_status", "import_report", "artifact_status"],
    },
    scheduling: {
      schedulable: false,
      safeAutoRun: false,
      requiresHumanCheckpoint: true,
      allowedScheduleTypes: [],
    },
    recommendedFollowUpActionId: "legislative.feedback",
    buildArgs: buildLegislativeImportArgs,
  },
  {
    id: "legislative.feedback",
    title: "Legislative Feedback",
    description: "Refresh the canonical legislative feedback output after review/apply cycles.",
    workflowFamily: "legislative",
    group: "Primary Operator Surfaces",
    displayOrder: 50,
    operatorSurfaceCommand: "legislative feedback",
    cliCommandTemplate: "./bin/equitystack legislative feedback",
    runnerType: "cli",
    execution: {
      mutating: false,
      readOnly: true,
      dryRunAware: false,
      requiresHumanApproval: false,
      defaultTimeoutMs: 20 * 60 * 1000,
      cancellationReady: true,
    },
    inputSchema: {
      type: "object",
      fields: {},
      constraints: [],
    },
    artifactExpectations: [
      { key: "review_bundle", label: "Review bundle", stage: "feedback", when: "success" },
    ],
    guardrails: [
      "Feedback remains an artifact-level operation on top of the canonical workflow.",
    ],
    outputContract: {
      kind: "workflow-session",
      sessionFamily: "legislative",
      summaryFields: ["workflow_status", "review_bundle", "next_step"],
    },
    scheduling: {
      schedulable: true,
      safeAutoRun: true,
      requiresHumanCheckpoint: false,
      allowedScheduleTypes: ["manual", "daily", "weekly", "interval"],
    },
    recommendedFollowUpActionId: "legislative.run",
    buildArgs: buildNoArgCommand("legislative", "feedback"),
  },
  {
    id: "currentAdmin.run",
    title: "Current-Admin Run",
    description:
      "Run the canonical current-admin pipeline, including full-auto discovery, review, guarded apply, outcome evidence, impact evaluation, promotion, and enrichment when requested.",
    workflowFamily: "current-admin",
    group: "Primary Operator Surfaces",
    displayOrder: 60,
    operatorSurfaceCommand: "current-admin run",
    cliCommandTemplate:
      "./bin/equitystack current-admin run [--input <batch.json> | --batch-name <batch-name>] [--full-auto] [--stop-after <review|apply|impact-evaluate|impact-promote|enrichment>] [--no-auto-apply] [--no-impact-automation]",
    runnerType: "cli",
    execution: {
      mutating: false,
      readOnly: false,
      dryRunAware: true,
      requiresHumanApproval: false,
      defaultTimeoutMs: 60 * 60 * 1000,
      cancellationReady: true,
    },
    inputSchema: {
      type: "object",
      fields: {
        input: { ...PATH_FIELD, label: "Batch path" },
        batchName: { ...BATCH_NAME_FIELD, label: "Batch name" },
        reviewDryRun: { type: "boolean", default: false, label: "Review dry-run" },
        discoveryDryRun: { type: "boolean", default: false, label: "Discovery dry-run" },
        fullAuto: { type: "boolean", default: false, label: "Full automation" },
        stopAfter: {
          type: "string",
          enum: ["review", "apply", "impact-evaluate", "impact-promote", "enrichment"],
          label: "Stop after stage",
        },
        noAutoApply: { type: "boolean", default: false, label: "Skip guarded auto-apply" },
        noImpactAutomation: {
          type: "boolean",
          default: false,
          label: "Skip impact automation after apply",
        },
      },
      constraints: [
        {
          kind: "mutuallyExclusive",
          fields: ["input", "batchName"],
          message: "Use either an explicit batch path or a batch name, not both.",
        },
      ],
    },
    artifactExpectations: [
      { key: "normalized_batch", label: "Normalized batch", stage: "run", when: "success" },
      { key: "review_artifact", label: "AI review artifact", stage: "review", when: "success" },
      { key: "manual_review_queue", label: "Manual review queue", stage: "review", when: "success" },
      { key: "automation_report", label: "Automation report", stage: "automation", when: "success" },
      { key: "exception_queue", label: "Exception queue", stage: "automation", when: "success" },
    ],
    guardrails: [
      "Uses the canonical Python workflow and artifacts.",
      "Does not bypass review, decision logging, pre-commit, or --apply --yes guardrails.",
      "Full-auto mode still mutates only when the underlying validators and canonical apply gates pass.",
    ],
    outputContract: {
      kind: "workflow-session",
      sessionFamily: "current-admin",
      summaryFields: ["batch.stage", "batch.paths", "counts", "artifact_status"],
    },
    scheduling: {
      schedulable: true,
      safeAutoRun: true,
      requiresHumanCheckpoint: true,
      allowedScheduleTypes: ["manual", "daily", "weekly", "interval"],
    },
    recommendedFollowUpActionId: "currentAdmin.review",
    buildArgs: buildCurrentAdminRunArgs,
  },
  {
    id: "currentAdmin.review",
    title: "Current-Admin Review",
    description: "Promote AI decisions first, then collect operator decisions only for the remaining borderline rows.",
    workflowFamily: "current-admin",
    group: "Primary Operator Surfaces",
    displayOrder: 70,
    operatorSurfaceCommand: "current-admin review",
    cliCommandTemplate:
      "./bin/equitystack current-admin review [--input <ai-review.json> | --batch-name <batch-name>]",
    runnerType: "cli",
    execution: {
      mutating: false,
      readOnly: false,
      dryRunAware: false,
      requiresHumanApproval: true,
      defaultTimeoutMs: 45 * 60 * 1000,
      cancellationReady: true,
    },
    inputSchema: {
      type: "object",
      fields: {
        input: { ...PATH_FIELD, label: "AI review artifact" },
        batchName: { ...BATCH_NAME_FIELD, label: "Batch name" },
        decisionFile: { ...PATH_FIELD, label: "Decision file" },
        refreshTemplate: { type: "boolean", default: false, label: "Refresh template" },
        logDecisions: { type: "boolean", default: false, label: "Write decision log" },
        logDecisionsPath: { ...PATH_FIELD, label: "Decision log path" },
        feedbackSummary: { type: "boolean", default: false, label: "Feedback summary" },
      },
      constraints: [
        {
          kind: "mutuallyExclusive",
          fields: ["input", "batchName"],
          message: "Use either an explicit review artifact or a batch name, not both.",
        },
        {
          kind: "requiresTogether",
          ifField: "logDecisionsPath",
          withField: "logDecisions",
          message: "A decision log path is only valid when decision logging is requested.",
        },
      ],
    },
    artifactExpectations: [
      { key: "decision_template", label: "Decision template", stage: "review", when: "success" },
      { key: "decision_log", label: "Decision log", stage: "review", when: "success_or_refresh" },
      { key: "manual_review_queue", label: "Manual review queue", stage: "review", when: "success" },
    ],
    guardrails: [
      "AI-approved and AI-rejected rows are resolved before manual review starts.",
      "Explicit operator decisions remain required for borderline rows only.",
      "Decision logs remain canonical and separate from the UI state.",
    ],
    outputContract: {
      kind: "workflow-session",
      sessionFamily: "current-admin",
      summaryFields: ["batch.stage", "latest_decision_session", "counts", "blockers"],
    },
    scheduling: {
      schedulable: false,
      safeAutoRun: false,
      requiresHumanCheckpoint: true,
      allowedScheduleTypes: [],
    },
    recommendedFollowUpActionId: "currentAdmin.apply",
    buildArgs: buildCurrentAdminReviewArgs,
  },
  {
    id: "currentAdmin.apply",
    title: "Current-Admin Apply",
    description: "Run pre-commit and import dry-run first, and mutate only when explicit confirmation is given.",
    workflowFamily: "current-admin",
    group: "Primary Operator Surfaces",
    displayOrder: 80,
    operatorSurfaceCommand: "current-admin apply",
    cliCommandTemplate:
      "./bin/equitystack current-admin apply [--input <manual-review-queue.json> | --batch-name <batch-name>] [--apply --yes]",
    runnerType: "cli",
    execution: {
      mutating: true,
      readOnly: false,
      dryRunAware: true,
      requiresHumanApproval: true,
      defaultTimeoutMs: 60 * 60 * 1000,
      cancellationReady: true,
    },
    inputSchema: {
      type: "object",
      fields: {
        input: { ...PATH_FIELD, label: "Manual review queue" },
        batchName: { ...BATCH_NAME_FIELD, label: "Batch name" },
        apply: { type: "boolean", default: false, label: "Mutating apply" },
        yes: { type: "boolean", default: false, label: "Explicit confirmation" },
      },
      constraints: [
        {
          kind: "mutuallyExclusive",
          fields: ["input", "batchName"],
          message: "Use either an explicit queue path or a batch name, not both.",
        },
        ...APPLY_CONFIRMATION_CONSTRAINTS,
      ],
    },
    artifactExpectations: [
      { key: "pre_commit_review", label: "Pre-commit review", stage: "pre-commit", when: "success" },
      { key: "import_dry_run", label: "Import dry-run", stage: "import", when: "success" },
      { key: "import_apply", label: "Import apply", stage: "import", when: "mutating_success" },
      { key: "validation_report", label: "Validation report", stage: "validate", when: "mutating_success" },
    ],
    guardrails: [
      "Pre-commit must run before import.",
      "Dry-run and apply remain split.",
      "Mutating apply still requires explicit confirmation.",
    ],
    outputContract: {
      kind: "workflow-session",
      sessionFamily: "current-admin",
      summaryFields: ["batch.stage", "latest_pre_commit_review", "latest_import_dry_run", "latest_validation"],
    },
    scheduling: {
      schedulable: false,
      safeAutoRun: false,
      requiresHumanCheckpoint: true,
      allowedScheduleTypes: [],
    },
    recommendedFollowUpActionId: "currentAdmin.status",
    buildArgs: buildCurrentAdminApplyArgs,
  },
  {
    id: "currentAdmin.status",
    title: "Current-Admin Status",
    description: "Read the canonical current-admin state machine and next-step guidance.",
    workflowFamily: "current-admin",
    group: "Primary Operator Surfaces",
    displayOrder: 90,
    operatorSurfaceCommand: "current-admin status",
    cliCommandTemplate: "./bin/equitystack current-admin status [--batch-name <batch-name>]",
    runnerType: "cli",
    execution: {
      mutating: false,
      readOnly: true,
      dryRunAware: false,
      requiresHumanApproval: false,
      defaultTimeoutMs: 10 * 60 * 1000,
      cancellationReady: true,
    },
    inputSchema: {
      type: "object",
      fields: {
        batchName: { ...BATCH_NAME_FIELD, label: "Batch name" },
      },
      constraints: [],
    },
    artifactExpectations: [
      { key: "review_artifact", label: "Review artifact", stage: "status", when: "if_present" },
      { key: "manual_review_queue", label: "Manual review queue", stage: "status", when: "if_present" },
    ],
    guardrails: ["Read-only visibility into the canonical current-admin pipeline state."],
    outputContract: {
      kind: "workflow-session",
      sessionFamily: "current-admin",
      summaryFields: ["batch.stage", "next_recommended_action", "artifact_status"],
    },
    scheduling: {
      schedulable: true,
      safeAutoRun: true,
      requiresHumanCheckpoint: false,
      allowedScheduleTypes: ["manual", "daily", "weekly", "interval"],
    },
    recommendedFollowUpActionId: "currentAdmin.review",
    buildArgs: buildCurrentAdminStatusArgs,
  },
  {
    id: "currentAdmin.deepReview",
    title: "Current-Admin Deep AI Review",
    description: "Run the paired baseline vs enriched AI review path for ambiguous or high-risk current-admin rows.",
    workflowFamily: "current-admin",
    group: "Advanced / Manual",
    displayOrder: 95,
    operatorSurfaceCommand: "current-admin deep-review",
    cliCommandTemplate:
      "./bin/equitystack current-admin deep-review [--input <normalized.json> | --batch-name <batch-name>]",
    runnerType: "cli",
    execution: {
      mutating: false,
      readOnly: false,
      dryRunAware: true,
      requiresHumanApproval: false,
      defaultTimeoutMs: 60 * 60 * 1000,
      cancellationReady: true,
    },
    inputSchema: {
      type: "object",
      fields: {
        input: { ...PATH_FIELD, label: "Normalized batch or review artifact" },
        batchName: { ...BATCH_NAME_FIELD, label: "Batch name" },
        experimentName: { type: "string", label: "Experiment name" },
        resume: { type: "boolean", default: false, label: "Resume existing pair" },
        compare: { type: "boolean", default: false, label: "Run comparison" },
      },
      constraints: [
        {
          kind: "mutuallyExclusive",
          fields: ["input", "batchName"],
          message: "Use either an explicit artifact path or a batch name, not both.",
        },
      ],
    },
    artifactExpectations: [
      { key: "review_artifact", label: "Paired review metadata", stage: "review", when: "success_or_refresh" },
    ],
    guardrails: [
      "Deep AI review remains artifact-driven and does not bypass the normal apply/import guardrails.",
      "This is a deeper advisory review path, not an import step.",
    ],
    outputContract: {
      kind: "workflow-session",
      sessionFamily: "current-admin",
      summaryFields: ["batch.stage", "counts", "artifact_status"],
    },
    scheduling: {
      schedulable: false,
      safeAutoRun: false,
      requiresHumanCheckpoint: false,
      allowedScheduleTypes: [],
    },
    recommendedFollowUpActionId: "currentAdmin.review",
    buildArgs: buildCurrentAdminDeepReviewArgs,
  },
  {
    id: "currentAdmin.discover",
    title: "Current-Admin Discover",
    description: "Run discovery only through the canonical CLI.",
    workflowFamily: "current-admin",
    group: "Advanced / Manual",
    displayOrder: 100,
    operatorSurfaceCommand: "current-admin discover",
    cliCommandTemplate: "./bin/equitystack current-admin discover",
    runnerType: "cli",
    execution: {
      mutating: false,
      readOnly: true,
      dryRunAware: true,
      requiresHumanApproval: false,
      defaultTimeoutMs: 45 * 60 * 1000,
      cancellationReady: true,
    },
    inputSchema: { type: "object", fields: {}, constraints: [] },
    artifactExpectations: [{ key: "discovery_report", label: "Discovery report", stage: "discover", when: "success" }],
    guardrails: ["Discovery remains read-only and artifact-driven."],
    outputContract: {
      kind: "workflow-session",
      sessionFamily: "current-admin",
      summaryFields: ["batch", "artifact_status"],
    },
    recommendedFollowUpActionId: "currentAdmin.genBatch",
    buildArgs: buildNoArgCommand("current-admin", "discover"),
  },
  {
    id: "currentAdmin.genBatch",
    title: "Current-Admin Generate Batch",
    description: "Generate a canonical batch from discovery output without starting the workflow.",
    workflowFamily: "current-admin",
    group: "Advanced / Manual",
    displayOrder: 110,
    operatorSurfaceCommand: "current-admin gen-batch",
    cliCommandTemplate:
      "./bin/equitystack current-admin gen-batch [--input <discovery.json>] [--all-candidates]",
    runnerType: "cli",
    execution: {
      mutating: false,
      readOnly: false,
      dryRunAware: false,
      requiresHumanApproval: false,
      defaultTimeoutMs: 20 * 60 * 1000,
      cancellationReady: true,
    },
    inputSchema: {
      type: "object",
      fields: {
        input: { ...PATH_FIELD, label: "Discovery report" },
        output: { ...PATH_FIELD, label: "Output batch path" },
        outputName: { type: "string", label: "Output batch name" },
        batchName: { ...BATCH_NAME_FIELD, label: "Batch name" },
        allowOverwrite: { type: "boolean", default: false, label: "Allow overwrite" },
        allCandidates: { type: "boolean", default: true, label: "All candidates" },
      },
      constraints: [],
    },
    artifactExpectations: [{ key: "batch_file", label: "Batch file", stage: "batch", when: "success" }],
    guardrails: ["Writes a canonical batch file only."],
    outputContract: {
      kind: "artifact-only",
      sessionFamily: "current-admin",
      summaryFields: ["artifacts"],
    },
    recommendedFollowUpActionId: "currentAdmin.run",
    buildArgs: buildCurrentAdminGenBatchArgs,
  },
  {
    id: "currentAdmin.preCommit",
    title: "Current-Admin Pre-Commit",
    description: "Refresh the canonical pre-commit artifact from the manual-review queue.",
    workflowFamily: "current-admin",
    group: "Advanced / Manual",
    displayOrder: 150,
    operatorSurfaceCommand: "current-admin pre-commit",
    cliCommandTemplate:
      "./bin/equitystack current-admin pre-commit --input <manual-review-queue.json>",
    runnerType: "cli",
    execution: {
      mutating: false,
      readOnly: true,
      dryRunAware: false,
      requiresHumanApproval: false,
      defaultTimeoutMs: 20 * 60 * 1000,
      cancellationReady: true,
    },
    inputSchema: {
      type: "object",
      fields: {
        input: { ...PATH_FIELD, label: "Manual review queue" },
      },
      constraints: [
        {
          kind: "requiresOneOf",
          fields: ["input"],
          message: "Pre-commit needs a queue artifact path.",
        },
      ],
    },
    artifactExpectations: [{ key: "pre_commit_review", label: "Pre-commit review", stage: "pre-commit", when: "success" }],
    guardrails: ["Pre-commit remains read-only and canonical."],
    outputContract: {
      kind: "workflow-session",
      sessionFamily: "current-admin",
      summaryFields: ["latest_pre_commit_review", "batch.stage"],
    },
    recommendedFollowUpActionId: "currentAdmin.import",
    buildArgs: (input) => buildCurrentAdminInputCommand("pre-commit", input),
  },
  {
    id: "currentAdmin.import",
    title: "Current-Admin Import",
    description: "Run the current-admin import dry-run by default, or apply with explicit confirmation.",
    workflowFamily: "current-admin",
    group: "Advanced / Manual",
    displayOrder: 160,
    operatorSurfaceCommand: "current-admin import",
    cliCommandTemplate:
      "./bin/equitystack current-admin import --input <manual-review-queue.json> [--apply --yes]",
    runnerType: "cli",
    execution: {
      mutating: true,
      readOnly: false,
      dryRunAware: true,
      requiresHumanApproval: true,
      defaultTimeoutMs: 45 * 60 * 1000,
      cancellationReady: true,
    },
    inputSchema: {
      type: "object",
      fields: {
        input: { ...PATH_FIELD, label: "Manual review queue" },
        apply: { type: "boolean", default: false, label: "Mutating apply" },
        yes: { type: "boolean", default: false, label: "Explicit confirmation" },
      },
      constraints: [
        {
          kind: "requiresOneOf",
          fields: ["input"],
          message: "Import needs a queue artifact path.",
        },
        ...APPLY_CONFIRMATION_CONSTRAINTS,
      ],
    },
    artifactExpectations: [
      { key: "import_dry_run", label: "Import dry-run", stage: "import", when: "success" },
      { key: "import_apply", label: "Import apply", stage: "import", when: "mutating_success" },
    ],
    guardrails: ["Import remains behind canonical dry-run and explicit confirmation guardrails."],
    outputContract: {
      kind: "workflow-session",
      sessionFamily: "current-admin",
      summaryFields: ["latest_import_dry_run", "latest_import_apply", "batch.stage"],
    },
    recommendedFollowUpActionId: "currentAdmin.validate",
    buildArgs: (input) => buildCurrentAdminInputCommand("import", input),
  },
  {
    id: "currentAdmin.validate",
    title: "Current-Admin Validate",
    description: "Run canonical current-admin validation for a queue artifact.",
    workflowFamily: "current-admin",
    group: "Advanced / Manual",
    displayOrder: 170,
    operatorSurfaceCommand: "current-admin validate",
    cliCommandTemplate:
      "./bin/equitystack current-admin validate --input <manual-review-queue.json>",
    runnerType: "cli",
    execution: {
      mutating: false,
      readOnly: true,
      dryRunAware: false,
      requiresHumanApproval: false,
      defaultTimeoutMs: 20 * 60 * 1000,
      cancellationReady: true,
    },
    inputSchema: {
      type: "object",
      fields: {
        input: { ...PATH_FIELD, label: "Manual review queue" },
      },
      constraints: [
        {
          kind: "requiresOneOf",
          fields: ["input"],
          message: "Validation needs a queue artifact path.",
        },
      ],
    },
    artifactExpectations: [{ key: "validation_report", label: "Validation report", stage: "validate", when: "success" }],
    guardrails: ["Validation remains a canonical read-only verification step."],
    outputContract: {
      kind: "workflow-session",
      sessionFamily: "current-admin",
      summaryFields: ["latest_validation", "batch.stage"],
    },
    recommendedFollowUpActionId: "currentAdmin.status",
    buildArgs: (input) => buildCurrentAdminInputCommand("validate", input),
  },
  {
    id: "operator.cleanupStaleWorkflows",
    title: "Cleanup Stale Operator Workflows",
    description: "Preview or archive stale operator workflow sessions without deleting audit files.",
    workflowFamily: "system",
    group: "Operational Maintenance",
    displayOrder: 1000,
    operatorSurfaceCommand: "operator cleanup-stale-workflows",
    cliCommandTemplate: "./bin/equitystack operator cleanup-stale-workflows --dry-run | --apply --yes",
    runnerType: "cli",
    execution: {
      mutating: true,
      readOnly: false,
      dryRunAware: true,
      requiresHumanApproval: true,
      defaultTimeoutMs: 10 * 60 * 1000,
      cancellationReady: true,
    },
    inputSchema: {
      type: "object",
      fields: {
        apply: { type: "boolean", default: false, label: "Archive matching sessions" },
        yes: { type: "boolean", default: false, label: "Explicit confirmation" },
      },
      constraints: APPLY_CONFIRMATION_CONSTRAINTS,
    },
    artifactExpectations: [
      { key: "stale_workflow_cleanup_report", label: "Cleanup report", stage: "maintenance", when: "success" },
    ],
    guardrails: [
      "Dry-run is the default.",
      "Apply requires explicit confirmation.",
      "Cleanup marks workflow sessions inactive; it never deletes session artifacts.",
    ],
    outputContract: {
      kind: "maintenance-report",
      sessionFamily: "system",
      summaryFields: ["counts.candidate_count", "counts.archived_count", "candidates"],
    },
    scheduling: {
      schedulable: false,
      safeAutoRun: false,
      requiresHumanCheckpoint: true,
      allowedScheduleTypes: [],
    },
    buildArgs: buildOperatorCleanupStaleWorkflowsArgs,
  },
  {
    id: "impact.evaluate",
    title: "Impact Evaluate",
    description: "Build the canonical read-only impact maturation review artifact.",
    workflowFamily: "system",
    group: "Impact Maturation",
    displayOrder: 1200,
    operatorSurfaceCommand: "impact evaluate",
    cliCommandTemplate: "./bin/equitystack impact evaluate [--input <artifact>] [--output <artifact>] [--ledger <artifact>]",
    runnerType: "cli",
    execution: {
      mutating: false,
      readOnly: true,
      dryRunAware: false,
      requiresHumanApproval: false,
      defaultTimeoutMs: 30 * 60 * 1000,
      cancellationReady: true,
    },
    inputSchema: {
      type: "object",
      fields: {
        input: { ...PATH_FIELD, label: "Input artifact" },
        output: { ...PATH_FIELD, label: "Evaluation output" },
        ledger: { ...PATH_FIELD, label: "Maturation ledger" },
        onlyRecordKey: { type: "string", label: "Record key" },
      },
      constraints: [],
    },
    artifactExpectations: [
      { key: "impact_maturation_review", label: "Impact maturation review", stage: "impact", when: "success" },
    ],
    guardrails: [
      "Evaluation is read-only.",
      "Uses the canonical impact maturation CLI.",
    ],
    outputContract: {
      kind: "maintenance-report",
      sessionFamily: "system",
      summaryFields: ["counts", "items"],
    },
    scheduling: {
      schedulable: false,
      safeAutoRun: false,
      requiresHumanCheckpoint: false,
      allowedScheduleTypes: [],
    },
    recommendedFollowUpActionId: "impact.promote",
    buildArgs: buildImpactEvaluateArgs,
  },
  {
    id: "impact.promote",
    title: "Impact Promote",
    description: "Promote approved safe forward impact maturation transitions.",
    workflowFamily: "system",
    group: "Impact Maturation",
    displayOrder: 1210,
    operatorSurfaceCommand: "impact promote",
    cliCommandTemplate:
      "./bin/equitystack impact promote --dry-run | --apply --yes [--approve-safe]",
    runnerType: "cli",
    execution: {
      mutating: true,
      readOnly: false,
      dryRunAware: true,
      requiresHumanApproval: true,
      defaultTimeoutMs: 45 * 60 * 1000,
      cancellationReady: true,
    },
    inputSchema: {
      type: "object",
      fields: {
        input: { ...PATH_FIELD, label: "Evaluation artifact" },
        output: { ...PATH_FIELD, label: "Promotion output" },
        ledger: { ...PATH_FIELD, label: "Maturation ledger" },
        apply: { type: "boolean", default: false, label: "Mutating apply" },
        yes: { type: "boolean", default: false, label: "Explicit confirmation" },
        approveSafe: { type: "boolean", default: false, label: "Approve safe transitions" },
        onlyRecordKey: { type: "string", label: "Record key" },
      },
      constraints: APPLY_CONFIRMATION_CONSTRAINTS,
    },
    artifactExpectations: [
      { key: "impact_maturation_promotion_report", label: "Impact maturation promotion", stage: "impact", when: "success" },
    ],
    guardrails: [
      "Dry-run is the default.",
      "Mutating apply requires explicit confirmation.",
      "The CLI still enforces forward-only transitions and outcome insertion rules.",
    ],
    outputContract: {
      kind: "maintenance-report",
      sessionFamily: "system",
      summaryFields: ["precommit", "impact_promoted_count", "impact_skipped_count"],
    },
    scheduling: {
      schedulable: false,
      safeAutoRun: false,
      requiresHumanCheckpoint: true,
      allowedScheduleTypes: [],
    },
    recommendedFollowUpActionId: "impact.evaluate",
    buildArgs: buildImpactPromoteArgs,
  },
];

function applyFieldDefaults(fields = {}, input = {}) {
  const next = { ...(input || {}) };
  for (const [fieldName, field] of Object.entries(fields)) {
    if (next[fieldName] === undefined && Object.hasOwn(field, "default")) {
      next[fieldName] = field.default;
    }
  }
  return next;
}

function isPresent(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  return normalizeString(value).length > 0;
}

function validateField(fieldName, field, value, errors) {
  if (value === undefined || value === null || value === "") {
    return;
  }

  if (field.type === "boolean" && typeof value !== "boolean") {
    errors.push(`${field.label || fieldName} must be a boolean.`);
    return;
  }

  if (field.type === "string" && typeof value !== "string") {
    errors.push(`${field.label || fieldName} must be a string.`);
    return;
  }

  if (field.enum && value && !field.enum.includes(value)) {
    errors.push(`${field.label || fieldName} must be one of: ${field.enum.join(", ")}.`);
  }
}

function validateConstraints(constraints = [], input = {}) {
  const errors = [];

  for (const constraint of constraints) {
    if (constraint.kind === "mutuallyExclusive") {
      const present = constraint.fields.filter((field) => isPresent(input[field]));
      if (present.length > 1) {
        errors.push(constraint.message);
      }
      continue;
    }

    if (constraint.kind === "requiresOneOf") {
      const present = constraint.fields.some((field) => isPresent(input[field]));
      if (!present) {
        errors.push(constraint.message);
      }
      continue;
    }

    if (constraint.kind === "requiresAll") {
      const allPresent = constraint.fields.every((field) => isPresent(input[field]));
      if (!allPresent) {
        errors.push(constraint.message);
      }
      continue;
    }

    if (constraint.kind === "requiresWhen") {
      if (isPresent(input[constraint.ifField]) && !isPresent(input[constraint.requiresField])) {
        errors.push(constraint.message);
      }
      continue;
    }

    if (constraint.kind === "requiresTogether") {
      if (isPresent(input[constraint.ifField]) && !isPresent(input[constraint.withField])) {
        errors.push(constraint.message);
      }
    }
  }

  return errors;
}

export function getOperatorActionDefinitions() {
  return ACTION_DEFINITIONS;
}

export function getOperatorActionDefinition(actionId) {
  return ACTION_DEFINITIONS.find((action) => action.id === actionId) || null;
}

export function getOperatorActionExecutionModes(actionOrId) {
  const action =
    typeof actionOrId === "string" ? getOperatorActionDefinition(actionOrId) : actionOrId;
  const actionId = normalizeString(action?.id || actionOrId);
  const override = ACTION_EXECUTION_MODE_OVERRIDES[actionId] || {};
  const defaultMode =
    normalizeString(override.defaultMode) || DEFAULT_EXECUTION_MODE_CONFIG.defaultMode;
  const allowedModes = Array.from(
    new Set([
      defaultMode,
      ...((Array.isArray(override.allowedModes) && override.allowedModes.length
        ? override.allowedModes
        : DEFAULT_EXECUTION_MODE_CONFIG.allowedModes)),
    ])
  );
  const scheduleAllowedModes = Array.from(
    new Set(
      (Array.isArray(override.scheduleAllowedModes) && override.scheduleAllowedModes.length
        ? override.scheduleAllowedModes
        : DEFAULT_EXECUTION_MODE_CONFIG.scheduleAllowedModes).filter((mode) =>
        allowedModes.includes(mode)
      )
    )
  );
  const autoScheduleAllowedModes = Array.from(
    new Set(
      (Array.isArray(override.autoScheduleAllowedModes) && override.autoScheduleAllowedModes.length
        ? override.autoScheduleAllowedModes
        : DEFAULT_EXECUTION_MODE_CONFIG.autoScheduleAllowedModes).filter((mode) =>
        scheduleAllowedModes.includes(mode)
      )
    )
  );

  return {
    defaultMode,
    allowedModes,
    scheduleAllowedModes,
    autoScheduleAllowedModes,
  };
}

export function resolveOperatorActionExecutionMode(action, requestedMode = "") {
  const executionModes = getOperatorActionExecutionModes(action);
  const normalizedRequestedMode = normalizeString(requestedMode);
  const resolvedMode = normalizedRequestedMode || executionModes.defaultMode;

  if (!executionModes.allowedModes.includes(resolvedMode)) {
    throw new Error(
      `${action.title} does not support execution mode \`${resolvedMode}\`. Allowed modes: ${executionModes.allowedModes.join(", ")}.`
    );
  }

  return {
    executionMode: resolvedMode,
    executionModes,
  };
}

export function validateOperatorActionInput(action, input = {}) {
  const normalizedInput = applyFieldDefaults(action?.inputSchema?.fields, input);
  const errors = [];

  for (const [fieldName, field] of Object.entries(action?.inputSchema?.fields || {})) {
    validateField(fieldName, field, normalizedInput[fieldName], errors);
  }

  errors.push(...validateConstraints(action?.inputSchema?.constraints, normalizedInput));

  return {
    ok: errors.length === 0,
    errors,
    normalizedInput,
  };
}

export function serializeOperatorAction(action) {
  const executionModes = getOperatorActionExecutionModes(action);
  return {
    id: action.id,
    title: action.title,
    description: action.description,
    workflowFamily: action.workflowFamily,
    group: action.group,
    displayOrder: action.displayOrder,
    operatorSurfaceCommand: action.operatorSurfaceCommand,
    cliCommandTemplate: action.cliCommandTemplate,
    execution: action.execution,
    inputSchema: action.inputSchema,
    artifactExpectations: action.artifactExpectations,
    guardrails: action.guardrails,
    outputContract: action.outputContract,
    scheduling: action.scheduling || {
      schedulable: false,
      safeAutoRun: false,
      requiresHumanCheckpoint: true,
      allowedScheduleTypes: [],
    },
    executionModes,
    recommendedFollowUpActionId: action.recommendedFollowUpActionId,
  };
}

export function listSerializedOperatorActions() {
  return ACTION_DEFINITIONS
    .map(serializeOperatorAction)
    .sort((left, right) => left.displayOrder - right.displayOrder || left.title.localeCompare(right.title));
}

export function buildOperatorActionCommand(action, input = {}) {
  if (!action?.buildArgs) {
    throw new Error(`Action ${action?.id || "unknown"} does not have a command builder.`);
  }

  const args = action.buildArgs(input);
  return {
    args,
    commandLabel: path.join(".", "bin", "equitystack"),
  };
}
