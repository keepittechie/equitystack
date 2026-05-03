/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const moduleUrl = pathToFileURL(
  path.resolve(__dirname, "legislativeWorkflowTransparencyService.js")
).href;

async function loadService() {
  return import(moduleUrl);
}

function sampleHealthReport(overrides = {}) {
  return {
    status: "FAIL",
    generated_at: "2026-04-30T09:28:47.660929+00:00",
    artifacts: {
      items: {
        review_bundle: {
          exists: false,
          path: "/home/josh/Documents/GitHub/equitystack/python/reports/equitystack_review_bundle.json",
        },
      },
    },
    pipeline: {
      pipeline_status: "failed",
      blocked_before_bundle_generation: true,
      failed_step: "update_database.py",
    },
    bundle_state: {
      manual_review_required: 3,
      human_approved_actions_pending_apply: 1,
      ai_approved_actions_pending_apply: 2,
    },
    repair_readiness: {
      repair_recommended: true,
    },
    errors: [
      {
        severity: "FAIL",
        message: "Missing required artifact at /home/josh/Documents/GitHub/equitystack/python/reports/equitystack_review_bundle.json and host 10.10.0.15",
      },
    ],
    ...overrides,
  };
}

function sampleAnomalyReport(overrides = {}) {
  return {
    status: "WARN",
    generated_at: "2026-04-30T09:41:21.335966+00:00",
    baseline_available: false,
    classification_anomalies: {
      flagged_rows: 2,
    },
    suspicious_flags: {
      total_flags: 1,
      items: [
        {
          flag: "direct_low_evidence",
          payload: {
            action_id: "action-9",
            target_id: 77,
            notes: "10.10.0.13 /home/josh/Documents/GitHub/equitystack",
          },
        },
      ],
    },
    errors: [
      {
        severity: "CRITICAL",
        message: "Unsafe operator payload for 10.10.0.13 at /tmp/bad.json",
      },
    ],
    ...overrides,
  };
}

test("missing reports return safe fallback summary", async () => {
  const service = await loadService();
  const summary = service.buildLegislativeWorkflowTransparencySummary({});

  assert.equal(summary.status, "WARN");
  assert.equal(summary.health.available, false);
  assert.equal(summary.anomaly.available, false);
  assert.match(summary.statusMessage, /incomplete|stabilizing|available yet/i);
});

test("public transparency summary does not expose raw paths or internal ips", async () => {
  const service = await loadService();
  const summary = service.buildLegislativeWorkflowTransparencySummary({
    healthReport: sampleHealthReport(),
    anomalyReport: sampleAnomalyReport(),
  });
  const serialized = JSON.stringify(summary);

  assert.doesNotMatch(serialized, /\/home\/josh/i);
  assert.doesNotMatch(serialized, /10\.10\.0\.13/i);
  assert.doesNotMatch(serialized, /10\.10\.0\.15/i);
});

test("fail health status is summarized safely without raw operator detail", async () => {
  const service = await loadService();
  const summary = service.buildLegislativeWorkflowTransparencySummary({
    healthReport: sampleHealthReport(),
  });

  assert.equal(summary.health.status, "FAIL");
  assert.equal(summary.health.manualReviewCount, 3);
  assert.equal(summary.health.approvedPendingCount, 3);
  assert.match(summary.health.summary, /missing a complete review bundle|did not complete/i);
  assert.doesNotMatch(summary.health.summary, /update_database\.py|\/home\/josh|10\.10\.0\./i);
});

test("anomaly report is summarized without raw operator payloads", async () => {
  const service = await loadService();
  const summary = service.buildLegislativeWorkflowTransparencySummary({
    anomalyReport: sampleAnomalyReport(),
  });
  const serialized = JSON.stringify(summary.anomaly);

  assert.equal(summary.anomaly.status, "WARN");
  assert.equal(summary.anomaly.flagCount, 3);
  assert.match(summary.anomaly.summary, /baseline|flagged|anomaly/i);
  assert.doesNotMatch(serialized, /action-9|target_id|payload|\/tmp\/bad\.json/i);
});

test("pass health and pass anomaly produce pass overall summary", async () => {
  const service = await loadService();
  const summary = service.buildLegislativeWorkflowTransparencySummary({
    healthReport: sampleHealthReport({
      status: "PASS",
      artifacts: { items: { review_bundle: { exists: true } } },
      pipeline: { pipeline_status: "success", blocked_before_bundle_generation: false },
      bundle_state: {
        manual_review_required: 0,
        human_approved_actions_pending_apply: 0,
        ai_approved_actions_pending_apply: 0,
      },
      repair_readiness: { repair_recommended: false },
    }),
    anomalyReport: sampleAnomalyReport({
      status: "PASS",
      baseline_available: true,
      classification_anomalies: { flagged_rows: 0 },
      suspicious_flags: { total_flags: 0, items: [] },
    }),
  });

  assert.equal(summary.status, "PASS");
  assert.match(summary.statusMessage, /healthy|no immediate warning/i);
});
