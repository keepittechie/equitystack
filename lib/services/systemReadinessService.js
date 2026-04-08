import { query } from "@/lib/db";

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function ratio(numerator, denominator) {
  const normalizedDenominator = toNumber(denominator);
  if (normalizedDenominator <= 0) {
    return 0;
  }

  return Number((toNumber(numerator) / normalizedDenominator).toFixed(4));
}

function confidenceDistribution({ highConfidenceOutcomes, mediumConfidenceOutcomes, lowConfidenceOutcomes }) {
  return {
    high: toNumber(highConfidenceOutcomes),
    medium: toNumber(mediumConfidenceOutcomes),
    low: toNumber(lowConfidenceOutcomes),
  };
}

function resolveCertificationStatus({
  totalPolicyOutcomes,
  invalidPolicyOutcomeCount,
  duplicateOutcomeGroups,
  unsourcedOutcomes,
  unclassifiedPolicies,
}) {
  if (totalPolicyOutcomes <= 0 || invalidPolicyOutcomeCount > 0 || duplicateOutcomeGroups > 0) {
    return "FAIL";
  }

  if (unsourcedOutcomes > 0 || unclassifiedPolicies > 0) {
    return "PASS WITH WARNINGS";
  }

  return "PASS";
}

export async function fetchHomepageReadinessSummary() {
  const [outcomeRows, duplicateRows, policyRows] = await Promise.all([
    query(`
      SELECT
        COUNT(*) AS total_policy_outcomes,
        SUM(policy_type = 'current_admin') AS current_admin_outcomes,
        SUM(policy_type = 'legislative') AS legislative_outcomes,
        SUM(policy_type = 'judicial_impact') AS judicial_impact_outcomes,
        SUM(COALESCE(source_count, 0) > 0) AS sourced_outcomes,
        SUM(COALESCE(source_count, 0) = 0) AS unsourced_outcomes,
        SUM(
          CASE
            WHEN confidence_score >= 0.75 THEN 1
            WHEN confidence_score IS NULL AND COALESCE(source_count, 0) >= 2 THEN 1
            ELSE 0
          END
        ) AS high_confidence_outcomes,
        SUM(
          CASE
            WHEN confidence_score >= 0.45 AND confidence_score < 0.75 THEN 1
            WHEN confidence_score IS NULL AND COALESCE(source_count, 0) = 1 THEN 1
            ELSE 0
          END
        ) AS medium_confidence_outcomes,
        SUM(
          CASE
            WHEN confidence_score < 0.45 THEN 1
            WHEN confidence_score IS NULL AND COALESCE(source_count, 0) = 0 THEN 1
            ELSE 0
          END
        ) AS low_confidence_outcomes,
        SUM(
          impact_score IS NULL
          OR impact_score < -100
          OR impact_score > 100
          OR impact_direction NOT IN ('Positive', 'Negative', 'Mixed', 'Blocked')
          OR COALESCE(source_count, 0) < 0
          OR policy_type NOT IN ('current_admin', 'legislative', 'judicial_impact')
          OR (impact_start_date IS NOT NULL AND impact_end_date IS NOT NULL AND impact_end_date < impact_start_date)
        ) AS invalid_policy_outcomes
      FROM policy_outcomes
    `),
    query(`
      SELECT COUNT(*) AS duplicate_groups
      FROM (
        SELECT policy_type, policy_id, outcome_summary_hash
        FROM policy_outcomes
        GROUP BY policy_type, policy_id, outcome_summary_hash
        HAVING COUNT(*) > 1
      ) duplicate_groups
    `),
    query(`
      SELECT
        COUNT(*) AS total_active_policies,
        SUM(policy_intent_category IS NOT NULL) AS intent_classified_policies
      FROM policies
      WHERE is_archived = 0
    `),
  ]);

  const outcomeSummary = outcomeRows[0] || {};
  const duplicateSummary = duplicateRows[0] || {};
  const policySummary = policyRows[0] || {};
  const totalPolicyOutcomes = toNumber(outcomeSummary.total_policy_outcomes);
  const currentAdminOutcomes = toNumber(outcomeSummary.current_admin_outcomes);
  const legislativeOutcomes = toNumber(outcomeSummary.legislative_outcomes);
  const judicialImpactOutcomes = toNumber(outcomeSummary.judicial_impact_outcomes);
  const sourcedOutcomes = toNumber(outcomeSummary.sourced_outcomes);
  const unsourcedOutcomes = toNumber(outcomeSummary.unsourced_outcomes);
  const confidenceCounts = confidenceDistribution({
    highConfidenceOutcomes: outcomeSummary.high_confidence_outcomes,
    mediumConfidenceOutcomes: outcomeSummary.medium_confidence_outcomes,
    lowConfidenceOutcomes: outcomeSummary.low_confidence_outcomes,
  });
  const invalidPolicyOutcomeCount = toNumber(outcomeSummary.invalid_policy_outcomes);
  const duplicateOutcomeGroups = toNumber(duplicateSummary.duplicate_groups);
  const totalActivePolicies = toNumber(policySummary.total_active_policies);
  const intentClassifiedPolicies = toNumber(policySummary.intent_classified_policies);
  const unclassifiedPolicies = Math.max(totalActivePolicies - intentClassifiedPolicies, 0);
  const certificationStatus = resolveCertificationStatus({
    totalPolicyOutcomes,
    invalidPolicyOutcomeCount,
    duplicateOutcomeGroups,
    unsourcedOutcomes,
    unclassifiedPolicies,
  });

  return {
    certification_status: certificationStatus,
    total_policy_outcomes: totalPolicyOutcomes,
    current_admin_outcomes: currentAdminOutcomes,
    legislative_outcomes: legislativeOutcomes,
    judicial_impact_outcomes: judicialImpactOutcomes,
    sourced_outcomes: sourcedOutcomes,
    unsourced_outcomes: unsourcedOutcomes,
    source_coverage_pct: ratio(sourcedOutcomes, totalPolicyOutcomes),
    confidence_distribution: confidenceCounts,
    high_confidence_outcome_pct: ratio(confidenceCounts.high, totalPolicyOutcomes),
    medium_confidence_outcome_pct: ratio(confidenceCounts.medium, totalPolicyOutcomes),
    low_confidence_outcome_pct: ratio(confidenceCounts.low, totalPolicyOutcomes),
    intent_classified_policies: intentClassifiedPolicies,
    total_active_policies: totalActivePolicies,
    intent_coverage_pct: ratio(intentClassifiedPolicies, totalActivePolicies),
    invalid_policy_outcome_count: invalidPolicyOutcomeCount,
    duplicate_outcome_groups: duplicateOutcomeGroups,
  };
}
