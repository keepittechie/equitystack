/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const jiti = require("jiti")(__filename);

const { getOutcomeDuration, isActiveDuring } = jiti("./policyOutcomeTime.js");

test("isActiveDuring checks date range overlap without requiring an end date", () => {
  const outcome = {
    impact_start_date: "1965-08-06",
    impact_end_date: null,
  };

  assert.equal(isActiveDuring(outcome, "1965-08-06"), true);
  assert.equal(isActiveDuring(outcome, { start: "1966-01-01", end: "1966-12-31" }), true);
  assert.equal(isActiveDuring(outcome, { start: "1964-01-01", end: "1964-12-31" }), false);
});

test("isActiveDuring checks bounded outcome ranges", () => {
  const outcome = {
    impact_start_date: "1944-06-22",
    impact_end_date: "1956-12-31",
  };

  assert.equal(isActiveDuring(outcome, { start: "1950-01-01", end: "1950-12-31" }), true);
  assert.equal(isActiveDuring(outcome, { start: "1960-01-01", end: "1960-12-31" }), false);
});

test("getOutcomeDuration returns conservative labels", () => {
  assert.deepEqual(getOutcomeDuration({}), {
    has_known_duration: false,
    duration_days: null,
    duration_years: null,
    duration_label: "unknown",
    impact_duration_estimate: null,
  });

  const short = getOutcomeDuration({
    impact_start_date: "2025-01-01",
    impact_end_date: "2025-06-01",
  });
  const long = getOutcomeDuration({
    impact_start_date: "1965-01-01",
    impact_end_date: "1975-01-01",
  });

  assert.equal(short.duration_label, "short_term");
  assert.equal(short.has_known_duration, true);
  assert.equal(long.duration_label, "long_term");
  assert.equal(long.has_known_duration, true);
});
