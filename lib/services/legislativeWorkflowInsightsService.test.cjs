/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const moduleUrl = pathToFileURL(
  path.resolve(__dirname, "legislativeWorkflowInsightsService.js")
).href;

async function loadService() {
  return import(moduleUrl);
}

function sampleAction(overrides = {}) {
  return {
    action_id: "action-1",
    future_bill_id: 1,
    future_bill_title: "Sample Future Bill",
    action_type: "remove_direct_link",
    approved: false,
    status: "pending",
    review_state: "actionable",
    payload: { future_bill_link_id: 10 },
    ...overrides,
  };
}

function sampleManualItem(overrides = {}) {
  return {
    future_bill_id: 1,
    future_bill_link_id: 10,
    future_bill_title: "Sample Future Bill",
    review_state: "actionable",
    ...overrides,
  };
}

test("actionable legislative action ignores resolved stale-delete apply results", async () => {
  const service = await loadService();

  assert.equal(
    service.isActionableLegislativeAction(
      sampleAction({ approved: true, apply_result: "skipped_already_absent" })
    ),
    false
  );
  assert.equal(
    service.isActionableLegislativeAction(sampleAction({ review_state: "stale" })),
    false
  );
  assert.equal(
    service.isActionableLegislativeAction(sampleAction({ approved: true })),
    true
  );
});

test("deriveCanonicalLegislativeActionState keeps manual review active when real items exist", async () => {
  const service = await loadService();

  const reviewBundle = {
    future_bill_groups: [
      {
        future_bill_id: 1,
        future_bill_title: "Civil Rights Bill",
        manual_review_queue: [
          sampleManualItem({ future_bill_link_id: 11 }),
          sampleManualItem({ future_bill_link_id: 12, review_state: "stale" }),
        ],
        operator_actions: [
          sampleAction({ action_id: "pending-decision", approved: false }),
          sampleAction({ action_id: "approved-ready", approved: true }),
          sampleAction({
            action_id: "stale-delete",
            approved: true,
            status: "applied",
            review_state: "already_applied",
            apply_result: "skipped_already_absent",
          }),
        ],
      },
    ],
  };

  const state = service.deriveCanonicalLegislativeActionState(reviewBundle, null);

  assert.equal(state.manualQueueCount, 1);
  assert.equal(state.actionableManualQueueItems.length, 1);
  assert.equal(state.manualDecisionActions.length, 1);
  assert.equal(state.autoApprovedActionableActions.length, 0);
  assert.equal(state.humanApprovedActionableActions.length, 1);
  assert.equal(state.pendingUnreviewedActions.length, 1);
  assert.equal(state.approvedPendingActions.length, 1);
  assert.equal(state.actionableBundleActionCount, 2);
  assert.equal(state.staleActions.length, 0);
  assert.equal(state.appliedActions.length, 1);
});

test("deriveCanonicalLegislativeActionState treats repaired stale manual review as complete", async () => {
  const service = await loadService();

  const reviewBundle = {
    future_bill_groups: [
      {
        future_bill_id: 1,
        future_bill_title: "Civil Rights Bill",
        manual_review_queue: [
          sampleManualItem({
            future_bill_link_id: 11,
            review_state: "already_applied",
            apply_result: "skipped_already_absent",
          }),
        ],
        operator_actions: [
          sampleAction({
            action_id: "resolved-delete",
            approved: true,
            status: "applied",
            review_state: "already_applied",
            apply_result: "skipped_already_absent",
          }),
        ],
      },
    ],
  };

  const state = service.deriveCanonicalLegislativeActionState(reviewBundle, {
    items: [sampleManualItem({ future_bill_link_id: 99 })],
    manual_review_count: 1,
  });

  assert.equal(state.manualQueueCount, 0);
  assert.equal(state.actionableManualQueueItems.length, 0);
  assert.equal(state.actionableBundleActionCount, 0);
  assert.equal(state.appliedActions.length, 1);
});

test("deriveCanonicalLegislativeActionState falls back to manual queue only when bundle has no canonical queue", async () => {
  const service = await loadService();

  const reviewBundle = {
    future_bill_groups: [
      {
        future_bill_id: 1,
        future_bill_title: "Civil Rights Bill",
        manual_review_queue: [],
        operator_actions: [],
      },
    ],
  };
  const manualQueue = {
    items: [
      sampleManualItem({ future_bill_link_id: 21 }),
      sampleManualItem({ future_bill_link_id: 22, review_state: "stale" }),
    ],
    manual_review_count: 2,
  };

  const state = service.deriveCanonicalLegislativeActionState(reviewBundle, manualQueue);

  assert.equal(state.manualQueueCount, 1);
  assert.equal(state.actionableManualQueueItems[0].future_bill_link_id, 21);
});

test("post-repair legislative workflow resolves to COMPLETE when no actions or import work remain", async () => {
  const service = await loadService();

  const status = service.buildLegislativeWorkflowStatus({
    pipelineReport: { status: "success" },
    reviewBundle: { summary: { items_requiring_operator_action: 0 } },
    manualReviewCount: 0,
    pendingUnreviewedActions: [],
    approvedPendingActions: [],
    repairReport: {
      mode: "apply",
      actions_left_active: [],
      workflow_state_changed: true,
    },
    seedRows: [],
    importReport: null,
  });

  const nextStep = service.buildLegislativeNextStep({
    workflowStatus: status,
    manualReviewCount: 0,
    pendingUnreviewedActions: [],
    actionPermissions: {
      run_apply_dry_run: { allowed: false },
      apply_bundle: { allowed: false },
      run_import_dry_run: { allowed: false },
      apply_import: { allowed: false },
    },
    pipelineReport: { status: "success" },
    repairReport: {
      mode: "apply",
      actions_left_active: [],
    },
    seedRows: [],
    importReport: null,
    healthSummary: { available: true, status: "PASS", repair_recommended: false },
    anomalySummary: { available: true, status: "PASS" },
    materializationSummary: { ready: false },
  });

  assert.equal(status, "COMPLETE");
  assert.equal(nextStep.step, "complete");
  assert.match(nextStep.label, /No urgent legislative action/i);
});

test("import blockers are ignored when no approved seed rows exist", async () => {
  const service = await loadService();

  const blockers = service.buildLegislativeBlockers({
    pipelineReport: { status: "success" },
    manualReviewCount: 0,
    actionPermissions: {
      run_apply_dry_run: { reasons: [] },
    },
    seedRows: [],
    applyReport: null,
    importReport: {
      mode: "dry_run",
      errors: [{ reason: "Import Report is missing." }],
    },
    healthSummary: { available: true, status: "PASS" },
  });

  assert.deepEqual(blockers, []);
});

test("no legislative actions remaining does not create a false apply-preview blocker", async () => {
  const service = await loadService();

  const permissions = service.buildLegislativeActionPermissions({
    hasBundle: true,
    bundleGeneratedAt: "2026-04-10T05:22:49.742Z",
    actionableActions: [],
    approvedPendingActions: [],
    pendingUnreviewedActions: [],
    applyReport: {
      mode: "apply",
      generated_at: "2026-04-10T05:22:24.000Z",
      error_count: 0,
    },
    seedRows: [],
    importReport: null,
  });

  const blockers = service.buildLegislativeBlockers({
    pipelineReport: { status: "success" },
    manualReviewCount: 0,
    actionPermissions: permissions,
    seedRows: [],
    applyReport: null,
    importReport: null,
    healthSummary: { available: true, status: "PASS" },
  });

  assert.equal(permissions.run_apply_dry_run.allowed, false);
  assert.equal(permissions.run_apply_dry_run.reasons.length, 0);
  assert.equal(permissions.apply_bundle.allowed, false);
  assert.equal(permissions.apply_bundle.reasons.length, 0);
  assert.deepEqual(blockers, []);
});

test("save approvals is disabled when only AI-approved bundle actions remain", async () => {
  const service = await loadService();

  const permissions = service.buildLegislativeActionPermissions({
    hasBundle: true,
    bundleGeneratedAt: "2026-04-10T05:22:49.742Z",
    actionableActions: [sampleAction({ approved: true })],
    approvedPendingActions: [sampleAction({ approved: true })],
    pendingUnreviewedActions: [],
    applyReport: null,
    seedRows: [],
    importReport: null,
  });

  assert.equal(permissions.save_approvals.allowed, false);
  assert.match(
    permissions.save_approvals.reasons[0],
    /No bundle-approval items need a human decision right now/i
  );
  assert.equal(permissions.run_apply_dry_run.allowed, true);
});

test("stale existing workflow summary is overridden when no legislative follow-up remains", async () => {
  const service = await loadService();

  const summary = service.buildLegislativeWorkflowOutcomeSummary({
    aiReview: {
      items: [{ review_backend: "openai" }],
      summary: {
        total_reviewed: 1,
        review_manually_count: 1,
      },
      workflow_outcome_summary: {
        workflow_status: "completed_with_manual_review",
        trust_warning: true,
        user_message: "AI review completed, but some items still require manual review.",
        next_step: "Review required items",
        next_step_message:
          "Next step: review required items in the legislative workflow.",
      },
    },
    manualReviewCount: 0,
    pendingUnreviewedActions: [],
    approvedPendingActions: [],
    repairReport: {
      mode: "apply",
      actions_left_active: [],
    },
    seedRows: [],
    importReport: null,
  });

  assert.equal(summary.workflow_status, "completed_with_ai");
  assert.equal(summary.manual_review_queue_count, 0);
  assert.equal(summary.pending_bundle_approvals, 0);
  assert.equal(summary.approved_bundle_actions, 0);
  assert.match(summary.user_message, /no actionable legislative review, apply, or import work remains/i);
  assert.match(summary.next_step_message, /no urgent legislative action is required/i);
});

test("missing health report returns a safe warning summary", async () => {
  const service = await loadService();

  const summary = service.buildLegislativeHealthDisplaySummary(null);

  assert.equal(summary.available, false);
  assert.equal(summary.status, "WARN");
  assert.match(summary.message, /no legislative workflow health report is available yet/i);
  assert.equal(summary.recommendation, "./bin/equitystack legislative health");
});

test("failing health summary surfaces blocked state without leaking paths or stack traces", async () => {
  const service = await loadService();

  const summary = service.buildLegislativeHealthDisplaySummary({
    status: "FAIL",
    generated_at: "2026-04-30T12:00:00Z",
    recommendations: ["./bin/equitystack legislative run"],
    pipeline: {
      pipeline_status: "failed",
      failed_step: "/home/josh/Documents/GitHub/equitystack/python/update_database.py",
      blocked_before_bundle_generation: true,
      issues: [
        {
          severity: "fail",
          message:
            "Failed on 10.10.0.15\n    at stack trace line\n/home/josh/Documents/GitHub/equitystack/python/reports/equitystack_review_bundle.json",
        },
      ],
    },
    bundle_state: {
      manual_review_required: 2,
      human_approved_actions_pending_apply: 1,
      ai_approved_actions_pending_apply: 3,
      issues: [],
    },
    apply_readiness: {
      apply_state: "blocked",
    },
    repair_readiness: {
      repair_recommended: false,
      issues: [],
    },
    materialization_readiness: {
      ready: false,
    },
  });

  assert.equal(summary.available, true);
  assert.equal(summary.status, "FAIL");
  assert.equal(summary.pipeline_status, "failed");
  assert.equal(summary.apply_state, "blocked");
  assert.equal(summary.approved_actions_pending_apply, 4);
  assert.match(summary.failed_step, /\[local path\]/);
  assert.match(summary.failed_step, /update_database\.py/);
  assert.equal(summary.blocked_before_bundle_generation, true);
  assert.equal(summary.recommendation, "./bin/equitystack legislative run");
  assert.doesNotMatch(summary.message, /10\.10\.0\./);
  assert.doesNotMatch(summary.message, /\/home\/josh/);
  assert.doesNotMatch(summary.message, /^\s*at\s/m);
});

test("missing anomaly report is non-blocking when apply preview is otherwise ready", async () => {
  const service = await loadService();

  const nextStep = service.buildLegislativeNextStep({
    workflowStatus: "APPLY_READY",
    manualReviewCount: 0,
    pendingUnreviewedActions: [],
    actionPermissions: {
      run_apply_dry_run: { allowed: true },
      apply_bundle: { allowed: false },
      run_import_dry_run: { allowed: false },
      apply_import: { allowed: false },
    },
    pipelineReport: { status: "success" },
    repairReport: null,
    seedRows: [],
    importReport: null,
    healthSummary: { available: true, status: "PASS", repair_recommended: false },
    anomalySummary: { available: false },
    materializationSummary: { ready: false },
  });

  assert.equal(nextStep.step, "apply_dry_run");
  assert.equal(nextStep.commands[0], "./bin/equitystack legislative apply --dry-run");
});

test("anomaly summary exposes warning counts and top flags safely", async () => {
  const service = await loadService();

  const summary = service.buildLegislativeAnomalyDisplaySummary({
    status: "WARN",
    generated_at: "2026-04-30T12:00:00Z",
    baseline_available: true,
    classification_anomalies: {
      flagged_rows: 3,
      flag_counts: {
        direct_low_evidence: 2,
        domain_score_conflict: 1,
      },
      issues: [{ severity: "warn", message: "Several direct links have low evidence." }],
    },
    suspicious_flags: {
      total_flags: 1,
      flag_counts: {
        overlinked_future_bill: 1,
      },
      issues: [],
    },
    scoring_drift: { issues: [] },
    reason_code_anomalies: { issues: [] },
    artifact_consistency: { issues: [] },
    recommendations: ["./bin/equitystack legislative anomalies"],
  });

  assert.equal(summary.available, true);
  assert.equal(summary.status, "WARN");
  assert.equal(summary.warning_count, 1);
  assert.equal(summary.total_flags, 4);
  assert.equal(summary.top_flags[0].label, "direct low evidence");
  assert.equal(summary.recommendation, "./bin/equitystack legislative anomalies");
});

test("repair recommended blocks apply readiness", async () => {
  const service = await loadService();

  const permissions = service.buildLegislativeActionPermissions({
    hasBundle: true,
    bundleGeneratedAt: "2026-04-10T05:22:49.742Z",
    actionableActions: [sampleAction({ approved: true })],
    approvedPendingActions: [sampleAction({ approved: true })],
    pendingUnreviewedActions: [],
    manualReviewCount: 0,
    applyReport: null,
    seedRows: [],
    importReport: null,
    healthSummary: { status: "PASS" },
    repairRecommended: true,
  });

  assert.equal(permissions.run_apply_dry_run.allowed, false);
  assert.equal(permissions.apply_bundle.allowed, false);
  assert.match(permissions.run_apply_dry_run.reasons[0], /repair is recommended/i);
});

test("manual review queue blocks apply readiness", async () => {
  const service = await loadService();

  const permissions = service.buildLegislativeActionPermissions({
    hasBundle: true,
    bundleGeneratedAt: "2026-04-10T05:22:49.742Z",
    actionableActions: [sampleAction({ approved: true })],
    approvedPendingActions: [sampleAction({ approved: true })],
    pendingUnreviewedActions: [],
    manualReviewCount: 2,
    applyReport: null,
    seedRows: [],
    importReport: null,
    healthSummary: { status: "PASS" },
  });

  assert.equal(permissions.run_apply_dry_run.allowed, false);
  assert.equal(permissions.apply_bundle.allowed, false);
  assert.match(
    permissions.run_apply_dry_run.reasons.join(" "),
    /manual-review item\(s\) still need human review/i
  );
});

test("AI-approved and human-approved actions stay in separate buckets", async () => {
  const service = await loadService();

  const reviewBundle = {
    future_bill_groups: [
      {
        future_bill_id: 1,
        future_bill_title: "Civil Rights Bill",
        manual_review_queue: [],
        operator_actions: [
          sampleAction({
            action_id: "ai-approved",
            approved: true,
            auto_triaged: true,
            approved_by: "auto_triage_review_bundle",
          }),
          sampleAction({
            action_id: "human-approved",
            approved: true,
            auto_triaged: false,
            approved_by: "web_admin",
          }),
        ],
      },
    ],
  };

  const state = service.deriveCanonicalLegislativeActionState(reviewBundle, null);

  assert.equal(state.autoApprovedActionableActions.length, 1);
  assert.equal(state.autoApprovedActionableActions[0].action_id, "ai-approved");
  assert.equal(state.humanApprovedActionableActions.length, 1);
  assert.equal(state.humanApprovedActionableActions[0].action_id, "human-approved");
});
