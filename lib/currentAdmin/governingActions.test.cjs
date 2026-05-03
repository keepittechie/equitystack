/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const jiti = require("jiti")(__filename);

const {
  CURRENT_ADMIN_PUBLIC_SCORE_WAITING_MESSAGE,
  buildCurrentAdminPublicGuidanceItems,
  buildCurrentAdminNextCheckHint,
  buildCurrentAdminRolloutParity,
  describeScoreEligibility,
  formatEvidenceRoleLabel,
  formatCurrentAdminReviewMonth,
  formatSourceQualityLabel,
  countPublicScoreableGoverningActions,
  deriveLinkedGoverningActionScoreState,
  deriveCurrentAdminPromiseVisibilityState,
  formatScoreEligibilityLabel,
  formatVisibilityStateLabel,
  isCurrentAdminPromiseTrackedButNotScored,
  summarizeEvidenceRoles,
} = jiti("./governingActions.js");

test("promise-only current-admin rows stay public but unscored", () => {
  const row = {
    public_governing_action_count: 0,
    public_scored_governing_action_count: 0,
    outcome_count: 0,
    promise_public_source_count: 1,
  };

  assert.equal(deriveCurrentAdminPromiseVisibilityState(row), "public_unscored");
  assert.equal(isCurrentAdminPromiseTrackedButNotScored(row), true);
});

test("scoreable governing action count stays zero without downstream evidence", () => {
  const actions = [
    {
      slug: "eo-14123-2025-01-21",
      visibility_state: "public_unscored",
      score_eligibility: "hold_for_evidence",
    },
    {
      slug: "memo-1",
      visibility_state: "public_unscored",
      score_eligibility: "not_scoreable",
    },
  ];

  assert.equal(countPublicScoreableGoverningActions(actions), 0);
});

test("scored or eligible governing actions count toward public scoreable totals", () => {
  const actions = [
    {
      slug: "eo-14123-2025-01-21",
      visibility_state: "public_unscored",
      score_eligibility: "hold_for_evidence",
    },
    {
      slug: "agency-guidance-1",
      visibility_state: "public_scored",
      score_eligibility: "scored",
    },
    {
      slug: "court-block-1",
      visibility_state: "public_unscored",
      score_eligibility: "eligible",
    },
  ];

  assert.equal(countPublicScoreableGoverningActions(actions), 2);
});

test("eligible governing actions count as scoreable while scored count stays zero before scoring", () => {
  const parity = buildCurrentAdminRolloutParity({
    promise: {
      slug: "trump-2025-domestic-production-of-critical-medicines",
      title: "Expand domestic production of critical medicines",
    },
    governingActions: [
      {
        slug: "regulatory-relief-to-promote-domestic-production-of-critical-medicines-2025-05-05",
        visibility_state: "public_unscored",
        score_eligibility: "eligible",
        sources: [
          {
            source_quality: "primary_official",
            evidence_role: "action_authority",
          },
          {
            source_quality: "primary_official",
            evidence_role: "implementation",
          },
        ],
      },
    ],
    legacyActionCount: 1,
    legacyOutcomeCount: 1,
    legacyScoreSummary: {
      total_score: 0.8,
      direction: "Positive",
    },
  });

  assert.equal(parity.linked_governing_action_score_state.scoreable_action_count, 1);
  assert.equal(parity.linked_governing_action_score_state.scored_action_count, 0);
  assert.equal(formatScoreEligibilityLabel("eligible"), "Eligible for scoring");
});

test("legacy-scored promise with public governing action held for evidence reports rollout mismatch", () => {
  const parity = buildCurrentAdminRolloutParity({
    promise: {
      slug: "trump-2025-high-paying-skilled-trade-jobs",
      title: "Prepare Americans for high-paying skilled trade jobs",
    },
    governingActions: [
      {
        slug: "preparing-americans-for-high-paying-skilled-trade-jobs-of-the-future-2025-04-23",
        visibility_state: "public_unscored",
        score_eligibility: "hold_for_evidence",
        sources: [
          {
            source_quality: "primary_official",
            evidence_role: "action_authority",
          },
        ],
      },
    ],
    legacyActionCount: 1,
    legacyOutcomeCount: 1,
    legacyScoreSummary: {
      total_score: 0.8,
      direction: "Positive",
    },
  });

  assert.equal(deriveLinkedGoverningActionScoreState(parity ? [
    {
      visibility_state: "public_unscored",
      score_eligibility: "hold_for_evidence",
    },
  ] : []), "hold_for_evidence");
  assert.equal(parity.has_mismatch, true);
  assert.equal(parity.linked_governing_action_score_state.state, "hold_for_evidence");
  assert.equal(parity.gap_reason_code, "missing_downstream_evidence");
  assert.equal(parity.recommended_next_action, "collect_downstream_evidence");
});

test("legacy action without normalized governing action reports mechanism review gap", () => {
  const parity = buildCurrentAdminRolloutParity({
    promise: {
      slug: "trump-2025-promote-hbcu-excellence-and-innovation",
      title: "Promote excellence and innovation at HBCUs",
    },
    governingActions: [],
    legacyActionCount: 1,
    legacyOutcomeCount: 1,
    legacyScoreSummary: {
      total_score: 0.8,
      direction: "Positive",
    },
  });

  assert.equal(parity.has_mismatch, true);
  assert.equal(parity.linked_governing_action_score_state.state, "no_public_governing_action");
  assert.equal(parity.gap_reason_code, "mechanism_unresolved");
  assert.equal(parity.recommended_next_action, "review_governing_mechanism");
});

test("current-admin labels explain public visibility and score gate states", () => {
  assert.equal(formatVisibilityStateLabel("public_unscored"), "Public and unscored");
  assert.equal(formatSourceQualityLabel("primary_official"), "Primary official");
  assert.equal(formatEvidenceRoleLabel("action_authority"), "Action authority");
  assert.match(describeScoreEligibility("hold_for_evidence"), /downstream implementation/i);
});

test("evidence role summary deduplicates labels for UI guidance", () => {
  assert.deepEqual(
    summarizeEvidenceRoles([
      { evidence_role: "action_authority" },
      { evidence_role: "implementation" },
      { evidence_role: "implementation" },
    ]),
    ["Action authority", "Implementation"]
  );
});

test("public guidance items describe tracked promises, evidence holds, and eligibility", () => {
  const items = buildCurrentAdminPublicGuidanceItems();
  assert.equal(items.length, 4);
  assert.equal(items[0].label, "Tracked but not scored");
  assert.equal(items[2].label, "Eligible for scoring");
  assert.equal(formatScoreEligibilityLabel("eligible"), "Eligible for scoring");
});

test("public score waiting message stays stable for unscored action cards", () => {
  assert.equal(
    CURRENT_ADMIN_PUBLIC_SCORE_WAITING_MESSAGE,
    "We only score when measurable outcomes for Black communities are verified."
  );
});

test("next check hint formats month-year and known data-refresh contexts", () => {
  assert.equal(formatCurrentAdminReviewMonth("2026-10-15"), "Oct 2026");
  assert.equal(
    buildCurrentAdminNextCheckHint({
      next_review_date: "2026-10-15",
      data_refresh_trigger:
        "Refresh when Apprenticeship.gov or RAPIDS publishes a full FY2026 race-specific export or dashboard coverage reaches at least 2026-09-30.",
    }),
    "Next data check: Oct 2026 (full FY data)"
  );
  assert.equal(
    buildCurrentAdminNextCheckHint({
      next_review_date: "2026-06-15",
      data_refresh_trigger:
        "Refresh when DOE publishes continuation or non-continuation notices, OLC/DOJ follow-on guidance, or a DOE/White House memo expressly tying MSI-PBI reprogramming to EO 14151.",
    }),
    "Next data check: Jun 2026 (funding notices)"
  );
});
