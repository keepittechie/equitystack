/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const jiti = require("jiti")(__filename);

const { compareIntentVsOutcome, summarizeIntentVsOutcome } = jiti("./policyIntent.js");

test("compareIntentVsOutcome classifies explicit equity-expanding intent", () => {
  assert.equal(
    compareIntentVsOutcome({
      policy_intent_summary: "Expand access",
      policy_intent_category: "equity_expanding",
      impact_direction: "Positive",
    }).classification,
    "aligned"
  );
  assert.equal(
    compareIntentVsOutcome({
      policy_intent_summary: "Expand access",
      policy_intent_category: "equity_expanding",
      impact_direction: "Negative",
    }).classification,
    "misaligned"
  );
  assert.equal(
    compareIntentVsOutcome({
      policy_intent_summary: "Expand access",
      policy_intent_category: "equity_expanding",
      impact_direction: "Mixed",
    }).classification,
    "mixed"
  );
});

test("compareIntentVsOutcome does not infer missing intent", () => {
  const comparison = compareIntentVsOutcome({
    title: "Clearly Beneficial Title",
    impact_direction: "Positive",
  });

  assert.equal(comparison.classification, "unclassified");
  assert.deepEqual(comparison.notes, ["intent_missing"]);
});

test("summarizeIntentVsOutcome reports distribution and administration patterns", () => {
  const summary = summarizeIntentVsOutcome([
    {
      policy_intent_summary: "Expand access",
      policy_intent_category: "equity_expanding",
      impact_direction: "Positive",
      president_slug: "president-a",
    },
    {
      policy_intent_summary: "Restrict access",
      policy_intent_category: "equity_restricting",
      impact_direction: "Positive",
      president_slug: "president-a",
    },
    {
      impact_direction: "Negative",
      president_slug: "president-b",
    },
  ]);

  assert.equal(summary.total_policies, 3);
  assert.equal(summary.classified_policy_count, 2);
  assert.equal(summary.unclassified_policy_count, 1);
  assert.deepEqual(summary.distribution, {
    aligned: 1,
    mixed: 0,
    misaligned: 1,
    unclassified: 1,
  });
  assert.equal(summary.percentages.aligned, 0.5);
  assert.equal(summary.percentages.misaligned, 0.5);
  assert.equal(summary.patterns_across_administrations[0].president_slug, "president-a");
  assert.equal(summary.patterns_across_administrations[0].aligned, 1);
  assert.equal(summary.patterns_across_administrations[0].misaligned, 1);
});
