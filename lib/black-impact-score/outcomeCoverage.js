const VALID_IMPACT_DIRECTIONS = new Set(["positive", "negative", "mixed", "blocked"]);

function normalizeNullableString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function toSafeCount(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}

function buildEmptyCoverageMetadata() {
  return {
    total_outcomes_available: 0,
    outcomes_included_in_score: 0,
    outcomes_excluded_from_score: 0,
    excluded_due_to_missing_sources: 0,
    excluded_due_to_missing_direction: 0,
    excluded_due_to_missing_summary: 0,
    excluded_due_to_low_confidence_or_status: 0,
  };
}

function getOutcomeExclusionReason(outcome = {}) {
  const impactDirection = normalizeNullableString(outcome.impact_direction);
  if (!impactDirection || !VALID_IMPACT_DIRECTIONS.has(impactDirection.toLowerCase())) {
    return "missing_direction";
  }

  if (!normalizeNullableString(outcome.outcome_summary)) {
    return "missing_summary";
  }

  if (toSafeCount(outcome.source_count) < 1) {
    return "missing_sources";
  }

  return null;
}

function incrementCoverageExclusion(coverage, reason) {
  if (reason === "missing_sources") {
    coverage.excluded_due_to_missing_sources += 1;
  } else if (reason === "missing_direction") {
    coverage.excluded_due_to_missing_direction += 1;
  } else if (reason === "missing_summary") {
    coverage.excluded_due_to_missing_summary += 1;
  }
}

export function buildOutcomeCoverageMetadata(outcomes = []) {
  const coverage = buildEmptyCoverageMetadata();
  coverage.total_outcomes_available = outcomes.length;

  for (const outcome of outcomes) {
    const reason = getOutcomeExclusionReason(outcome || {});
    if (reason) {
      coverage.outcomes_excluded_from_score += 1;
      incrementCoverageExclusion(coverage, reason);
    } else {
      coverage.outcomes_included_in_score += 1;
    }
  }

  return coverage;
}
