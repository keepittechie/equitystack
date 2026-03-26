export const POLICY_IMPACT_SCORE_SQL = `
  (
    COALESCE(ps.directness_score, 0) * 2 +
    COALESCE(ps.material_impact_score, 0) * 2 +
    COALESCE(ps.evidence_score, 0) +
    COALESCE(ps.durability_score, 0) +
    COALESCE(ps.equity_score, 0) * 2 -
    COALESCE(ps.harm_offset_score, 0)
  )
`;

export function computePolicyImpactScore(scoreRow = {}) {
  const directness = Number(scoreRow.directness_score || 0);
  const material = Number(scoreRow.material_impact_score || 0);
  const evidence = Number(scoreRow.evidence_score || 0);
  const durability = Number(scoreRow.durability_score || 0);
  const equity = Number(scoreRow.equity_score || 0);
  const harmOffset = Number(scoreRow.harm_offset_score || 0);

  return (
    directness * 2 +
    material * 2 +
    evidence +
    durability +
    equity * 2 -
    harmOffset
  );
}

export function directionToSignedWeight(direction) {
  switch (direction) {
    case "Positive":
      return 1;
    case "Negative":
      return -1;
    case "Mixed":
      return 0;
    case "Blocked":
      return 0;
    default:
      return 0;
  }
}

export function computeWeightedImpact(policy = {}) {
  const baseScore = computePolicyImpactScore(policy);
  const directionWeight = directionToSignedWeight(policy.impact_direction);
  return baseScore * directionWeight;
}

export function summarizePolicies(rows = []) {
  const summary = {
    total_policies: rows.length,
    direct_black_impact_count: 0,
    active_count: 0,
    repealed_count: 0,
    partially_active_count: 0,
    blocked_count: 0,
    expired_count: 0,
    archived_count: 0,
    positive_count: 0,
    negative_count: 0,
    mixed_count: 0,
    blocked_impact_count: 0,
    avg_directness_score: 0,
    avg_material_impact_score: 0,
    avg_evidence_score: 0,
    avg_durability_score: 0,
    avg_equity_score: 0,
    avg_harm_offset_score: 0,
    avg_policy_impact_score: 0,
    net_weighted_impact: 0,
  };

  if (!rows.length) return summary;

  let directnessTotal = 0;
  let materialTotal = 0;
  let evidenceTotal = 0;
  let durabilityTotal = 0;
  let equityTotal = 0;
  let harmOffsetTotal = 0;
  let policyImpactTotal = 0;
  let scoreCount = 0;

  for (const row of rows) {
    if (row.direct_black_impact) summary.direct_black_impact_count += 1;
    if (row.is_archived) summary.archived_count += 1;

    switch (row.status) {
      case "Active":
        summary.active_count += 1;
        break;
      case "Repealed":
        summary.repealed_count += 1;
        break;
      case "Partially Active":
        summary.partially_active_count += 1;
        break;
      case "Blocked":
        summary.blocked_count += 1;
        break;
      case "Expired":
        summary.expired_count += 1;
        break;
    }

    switch (row.impact_direction) {
      case "Positive":
        summary.positive_count += 1;
        break;
      case "Negative":
        summary.negative_count += 1;
        break;
      case "Mixed":
        summary.mixed_count += 1;
        break;
      case "Blocked":
        summary.blocked_impact_count += 1;
        break;
    }

    const hasScores =
      row.directness_score !== null &&
      row.material_impact_score !== null &&
      row.evidence_score !== null &&
      row.durability_score !== null &&
      row.equity_score !== null &&
      row.harm_offset_score !== null;

    if (hasScores) {
      directnessTotal += Number(row.directness_score);
      materialTotal += Number(row.material_impact_score);
      evidenceTotal += Number(row.evidence_score);
      durabilityTotal += Number(row.durability_score);
      equityTotal += Number(row.equity_score);
      harmOffsetTotal += Number(row.harm_offset_score);

      const impactScore = computePolicyImpactScore(row);
      policyImpactTotal += impactScore;
      summary.net_weighted_impact += computeWeightedImpact(row);
      scoreCount += 1;
    }
  }

  if (scoreCount > 0) {
    summary.avg_directness_score = Number((directnessTotal / scoreCount).toFixed(2));
    summary.avg_material_impact_score = Number((materialTotal / scoreCount).toFixed(2));
    summary.avg_evidence_score = Number((evidenceTotal / scoreCount).toFixed(2));
    summary.avg_durability_score = Number((durabilityTotal / scoreCount).toFixed(2));
    summary.avg_equity_score = Number((equityTotal / scoreCount).toFixed(2));
    summary.avg_harm_offset_score = Number((harmOffsetTotal / scoreCount).toFixed(2));
    summary.avg_policy_impact_score = Number((policyImpactTotal / scoreCount).toFixed(2));
    summary.net_weighted_impact = Number(summary.net_weighted_impact.toFixed(2));
  }

  return summary;
}

export function groupAndSummarize(rows = [], keyField, fallback = "Unknown") {
  const buckets = new Map();

  for (const row of rows) {
    const key = row[keyField] || fallback;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  }

  return Array.from(buckets.entries())
    .map(([name, groupRows]) => ({
      name,
      ...summarizePolicies(groupRows),
    }))
    .sort((a, b) => b.total_policies - a.total_policies);
}
