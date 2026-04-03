import { getOutcomeScoringConfig } from "./outcomeScoring.js";

export function getBlackImpactScoreMethodology() {
  return {
    model: "black-impact-score-outcome-canonical-v1",
    status: "canonical-mvp",
    summary:
      "This is the canonical Black Impact Score model. It scores documented Promise Tracker outcomes, rolls them up to promises, and aggregates them to presidents using a conservative, evidence-aware MVP.",
    outcome_scoring: getOutcomeScoringConfig(),
    scope: {
      primary_unit: "Documented outcome attached to a Promise Tracker record.",
      included:
        "Only outcomes with a written summary, a recognized impact direction, and at least one linked outcome source are included in numeric scoring.",
      excluded:
        "Outcomes missing enough source-backed detail remain visible on underlying record pages but are excluded from numeric scoring.",
    },
    confidence: {
      levels: {
        high:
          "Outcome is scoring-ready, has high evidence strength, and includes enough supporting detail to support a stronger interpretation.",
        medium:
          "Outcome is scoring-ready but has either moderate evidence strength or thinner supporting detail.",
        low:
          "Outcome is missing scoring-ready evidence, lacks supporting detail, or is marked with low evidence strength.",
      },
    },
    aggregation: {
      promise_rollup:
        "Promise totals are the sum of included outcome components attached to that record.",
      president_rollup:
        "President totals are the sum of included promise totals across that president's scored records.",
      normalization: "President totals are scaled into a temporary -100 to 100 range using available scored outcome count.",
    },
    notes: [
      "Mixed and Blocked outcomes are intentionally kept neutral in this MVP so the score does not overclaim directional precision.",
      "Evidence strength is the only direct numeric multiplier applied in this version.",
      "Linked source support and outcome detail affect eligibility and confidence, not a separate source-count multiplier.",
      "The legacy promise-based score remains available as a fallback and comparison path.",
    ],
  };
}
