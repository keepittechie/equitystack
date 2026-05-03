import { summarizeTrustForPolicy } from "./trustLayer.js";
import {
  formatSystemicImpactLabel,
  isNonStandardSystemicImpact,
  resolveSystemicImpactCategory,
  systemicMultiplierFor,
} from "../systemicImpact.js";

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

function buildPromiseSystemicContext(scoredOutcomes = []) {
  const candidates = [];
  const categoryCounts = {};

  for (const outcome of scoredOutcomes) {
    const category = resolveSystemicImpactCategory(
      outcome?.systemic_impact_category ?? outcome?.outcome?.systemic_impact_category
    );

    if (!isNonStandardSystemicImpact(category)) {
      continue;
    }

    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    candidates.push({
      category,
      multiplier: systemicMultiplierFor(category),
      summary:
        outcome?.systemic_impact_summary ?? outcome?.outcome?.systemic_impact_summary ?? null,
      policyTitle:
        outcome?.systemic_policy_title ?? outcome?.outcome?.systemic_policy_title ?? null,
      score: Math.abs(Number(outcome?.component_score || 0)),
    });
  }

  if (!candidates.length) {
    return {
      systemic_impact_category: "standard",
      systemic_multiplier: 1,
      systemic_impact_summary: null,
      systemic_policy_title: null,
      systemic_outcome_count: 0,
      systemic_category_counts: {},
      systemic_explanation_summary: null,
    };
  }

  const selected = candidates.sort((left, right) => {
    if (right.multiplier !== left.multiplier) {
      return right.multiplier - left.multiplier;
    }

    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return String(left.policyTitle || "").localeCompare(String(right.policyTitle || ""));
  })[0];

  const label = formatSystemicImpactLabel(selected.category);
  const policyTitleSuffix = selected.policyTitle ? ` via ${selected.policyTitle}` : "";

  return {
    systemic_impact_category: selected.category,
    systemic_multiplier: selected.multiplier,
    systemic_impact_summary: selected.summary,
    systemic_policy_title: selected.policyTitle,
    systemic_outcome_count: candidates.length,
    systemic_category_counts: categoryCounts,
    systemic_explanation_summary: `${label} systemic weighting (${selected.multiplier.toFixed(2)}x)${policyTitleSuffix}.`,
  };
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
  const systemicContext = buildPromiseSystemicContext(scoredOutcomes);

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
    ...systemicContext,
    explanation_summary: buildPromiseExplanation({
      outcomeCount: scoredOutcomes.length,
      totalScore: roundedTotalScore,
      countsByDirection,
    }),
  };
}
