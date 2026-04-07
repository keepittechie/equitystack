import { normalizeEvidenceStrength } from "./evidenceStrength.js";

function normalizeText(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function toCount(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}

function resolveOutcome(context = {}) {
  return context.outcome || context || {};
}

export function computeDataCompleteness(context = {}) {
  const outcome = resolveOutcome(context);
  const outcomeSummary = normalizeText(context.outcome_summary ?? outcome.outcome_summary);
  const impactDirection = normalizeText(
    context.impact_direction ?? outcome.impact_direction
  );
  const evidenceStrength = normalizeEvidenceStrength(
    context.evidence_strength ?? outcome.evidence_strength
  );
  const sourceCount = toCount(
    context.source_count ??
      context.sources_count ??
      context.outcome_source_count ??
      outcome.source_count ??
      outcome.sources_count
  );
  const measurableImpact = normalizeText(
    context.measurable_impact ?? outcome.measurable_impact
  );
  const blackCommunityImpactNote = normalizeText(
    context.black_community_impact_note ?? outcome.black_community_impact_note
  );

  const checks = {
    has_summary: Boolean(outcomeSummary),
    has_direction: Boolean(impactDirection),
    has_evidence_strength: Boolean(evidenceStrength),
    has_sources: sourceCount > 0,
    has_measurable_impact: Boolean(measurableImpact),
    has_black_community_impact_note: Boolean(blackCommunityImpactNote),
  };
  const missing = Object.entries(checks)
    .filter(([, present]) => !present)
    .map(([key]) => key.replace(/^has_/, "missing_"));
  const insufficientDataReasons = [];

  if (!checks.has_summary) {
    insufficientDataReasons.push("missing_summary");
  }
  if (!checks.has_direction) {
    insufficientDataReasons.push("missing_direction");
  }
  if (!checks.has_sources) {
    insufficientDataReasons.push("missing_sources");
  }

  const score =
    Number(checks.has_summary) * 0.2 +
    Number(checks.has_direction) * 0.2 +
    Number(checks.has_evidence_strength) * 0.2 +
    Number(checks.has_sources) * 0.2 +
    Number(checks.has_measurable_impact) * 0.1 +
    Number(checks.has_black_community_impact_note) * 0.1;
  const dataCompletenessScore = Number(score.toFixed(4));
  const completenessLabel = insufficientDataReasons.length
    ? "insufficient"
    : dataCompletenessScore >= 0.9
      ? "complete"
      : "partial";

  return {
    data_completeness_score: dataCompletenessScore,
    completeness_label: completenessLabel,
    insufficient_data: completenessLabel === "insufficient",
    missing_fields: missing,
    insufficient_data_reasons: insufficientDataReasons,
    completeness_checks: {
      ...checks,
      source_count: sourceCount,
      evidence_strength: evidenceStrength,
    },
  };
}

export function summarizeOutcomeCompleteness(scoredOutcomes = []) {
  const distribution = { complete: 0, partial: 0, insufficient: 0 };
  const missingFieldCounts = {};
  const byConfidenceLabel = {};
  const policiesWithMissingData = new Map();
  let totalScore = 0;
  let count = 0;

  for (const entry of Array.isArray(scoredOutcomes) ? scoredOutcomes : []) {
    const completeness =
      entry?.data_completeness_score != null
        ? {
            data_completeness_score: entry.data_completeness_score,
            completeness_label: entry.completeness_label,
            missing_fields:
              entry.completeness_missing_fields ||
              entry.factors?.data_completeness?.missing_fields ||
              [],
          }
        : computeDataCompleteness({
            outcome: entry?.outcome || entry,
            source_count: entry?.factors?.source_count,
            impact_direction: entry?.impact_direction,
          });
    const label = completeness.completeness_label || "insufficient";
    const score = Number(completeness.data_completeness_score);

    distribution[label] = (distribution[label] || 0) + 1;
    if (Number.isFinite(score)) {
      totalScore += score;
      count += 1;
    }

    for (const field of completeness.missing_fields || []) {
      missingFieldCounts[field] = (missingFieldCounts[field] || 0) + 1;
    }

    const confidenceLabel = entry?.confidence_label || entry?.confidence_level || "unknown";
    if (!byConfidenceLabel[confidenceLabel]) {
      byConfidenceLabel[confidenceLabel] = {
        count: 0,
        average_data_completeness_score: 0,
        complete: 0,
        partial: 0,
        insufficient: 0,
      };
    }
    byConfidenceLabel[confidenceLabel].count += 1;
    byConfidenceLabel[confidenceLabel].average_data_completeness_score += Number.isFinite(score)
      ? score
      : 0;
    byConfidenceLabel[confidenceLabel][label] += 1;

    const policyKey =
      entry?.outcome?.promise_id ??
      entry?.outcome?.policy_id ??
      entry?.outcome?.record_key ??
      entry?.outcome?.id;
    if (policyKey != null && label !== "complete") {
      const existing = policiesWithMissingData.get(policyKey) || {
        policy_key: policyKey,
        incomplete_outcome_count: 0,
        missing_fields: {},
      };
      existing.incomplete_outcome_count += 1;
      for (const field of completeness.missing_fields || []) {
        existing.missing_fields[field] = (existing.missing_fields[field] || 0) + 1;
      }
      policiesWithMissingData.set(policyKey, existing);
    }
  }

  for (const bucket of Object.values(byConfidenceLabel)) {
    bucket.average_data_completeness_score = bucket.count
      ? Number((bucket.average_data_completeness_score / bucket.count).toFixed(4))
      : 0;
  }

  const incompleteCount = distribution.partial + distribution.insufficient;

  return {
    average_data_completeness_score: count ? Number((totalScore / count).toFixed(4)) : 0,
    completeness_distribution: distribution,
    incomplete_outcome_count: incompleteCount,
    incomplete_outcome_percentage: count ? Number((incompleteCount / count).toFixed(4)) : 0,
    insufficient_outcome_count: distribution.insufficient,
    insufficient_outcome_percentage: count
      ? Number((distribution.insufficient / count).toFixed(4))
      : 0,
    missing_field_counts: missingFieldCounts,
    completeness_vs_confidence: byConfidenceLabel,
    policies_with_highest_missing_data: [...policiesWithMissingData.values()]
      .sort(
        (left, right) =>
          right.incomplete_outcome_count - left.incomplete_outcome_count ||
          String(left.policy_key).localeCompare(String(right.policy_key))
      )
      .slice(0, 10),
    recommendations: [
      "Prioritize linked outcome sources for insufficient records.",
      "Add explicit evidence_strength where direction and summary are already present.",
      "Use completeness_label for reporting filters, not as a replacement for scoring eligibility.",
    ],
  };
}
