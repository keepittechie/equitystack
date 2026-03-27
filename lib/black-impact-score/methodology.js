import { getOutcomeScoringConfig } from "./outcomeScoring.js";

export function getBlackImpactScoreMethodology() {
  return {
    model: "black-impact-score-phase-2-outcome-engine",
    status: "parallel-ready",
    summary:
      "This standalone scoring engine computes simple outcome-based scores, rolls them up to promises, and aggregates them to presidents without changing the live scoring system.",
    outcome_scoring: getOutcomeScoringConfig(),
    confidence: {
      levels: {
        high: "Outcome has impact direction and high evidence strength.",
        medium: "Outcome has impact direction but evidence strength is medium or unspecified.",
        low: "Outcome data is missing, incomplete, or marked with low evidence strength.",
      },
    },
    aggregation: {
      promise_rollup: "Promise totals are the sum of scored outcome components.",
      president_rollup: "President totals are the sum of scored promise totals.",
      normalization: "President totals are scaled into a temporary -100 to 100 range using available scored outcome count.",
    },
    notes: [
      "This phase intentionally keeps mixed and blocked outcomes neutral until more detailed component logic is implemented.",
      "Evidence strength is the only multiplier applied in this version.",
      "The module is pure and isolated from the legacy Promise Tracker scoring pipeline.",
    ],
  };
}
