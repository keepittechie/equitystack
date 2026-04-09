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
