import { summarizeTrustForPolicy } from "./trustLayer.js";

function incrementCounter(bucket, key) {
  if (!key) {
    return;
  }

  bucket[key] = (bucket[key] || 0) + 1;
}

function buildPromiseExplanation({ outcomeCount, totalScore, countsByDirection }) {
  if (!outcomeCount) {
    return "No scored outcomes are available for this promise.";
  }

  const segments = [];

  if (countsByDirection.Positive) {
    segments.push(`${countsByDirection.Positive} positive`);
  }

  if (countsByDirection.Negative) {
    segments.push(`${countsByDirection.Negative} negative`);
  }

  if (countsByDirection.Mixed) {
    segments.push(`${countsByDirection.Mixed} mixed`);
  }

  if (countsByDirection.Blocked) {
    segments.push(`${countsByDirection.Blocked} blocked`);
  }

  const distribution = segments.length
    ? segments.join(", ")
    : "no directional breakdown available";

  if (totalScore > 0) {
    return `Promise outcomes trend net positive across ${outcomeCount} scored outcomes (${distribution}).`;
  }

  if (totalScore < 0) {
    return `Promise outcomes trend net negative across ${outcomeCount} scored outcomes (${distribution}).`;
  }

  return `Promise outcomes are currently neutral across ${outcomeCount} scored outcomes (${distribution}).`;
}

function normalizeScoredOutcome(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  if (typeof entry.component_score !== "number") {
    return null;
  }

  return entry;
}

export function computePromiseFromOutcomes(promiseContext = {}) {
  const promise = promiseContext.promise || {};
  const scoredOutcomes = Array.isArray(promiseContext.scored_outcomes)
    ? promiseContext.scored_outcomes.map(normalizeScoredOutcome).filter(Boolean)
    : [];

  const countsByDirection = {};
  const countsByConfidence = {};
  const countsByCompleteness = {};

  let totalScore = 0;

  for (const scoredOutcome of scoredOutcomes) {
    totalScore += scoredOutcome.component_score;
    incrementCounter(countsByDirection, scoredOutcome.impact_direction || "Unknown");
    incrementCounter(
      countsByConfidence,
      scoredOutcome.confidence_label || scoredOutcome.confidence_level || "low"
    );
    incrementCounter(countsByCompleteness, scoredOutcome.completeness_label || "insufficient");
  }

  const roundedTotalScore = Number(totalScore.toFixed(2));
  const trustSummary = summarizeTrustForPolicy({
    promise,
    scoredOutcomes,
  });

  return {
    ...promise,
    total_score: roundedTotalScore,
    outcome_count: scoredOutcomes.length,
    scored_outcomes: scoredOutcomes,
    confidence_score: trustSummary.confidence_score,
    confidence_label: trustSummary.confidence_label,
    completeness_label: trustSummary.completeness_label,
    trust_summary: trustSummary,
    breakdown_by_direction: countsByDirection,
    breakdown_by_confidence: countsByConfidence,
    breakdown_by_completeness: countsByCompleteness,
    explanation_summary: buildPromiseExplanation({
      outcomeCount: scoredOutcomes.length,
      totalScore: roundedTotalScore,
      countsByDirection,
    }),
  };
}
