import { query } from "@/lib/db";
import { groupAndSummarize, summarizePolicies } from "@/lib/analytics/impactAggregator";

async function fetchPolicyAnalyticsRows({ includeArchived = false } = {}) {
  const whereClause = includeArchived ? "" : "WHERE p.is_archived = 0";

  const sql = `
    SELECT
      p.id,
      p.title,
      p.year_enacted,
      p.status,
      p.impact_direction,
      p.direct_black_impact,
      p.is_archived,
      er.name AS era_name,
      pp.name AS primary_party_name,
      ps.directness_score,
      ps.material_impact_score,
      ps.evidence_score,
      ps.durability_score,
      ps.equity_score,
      ps.harm_offset_score
    FROM policies p
    LEFT JOIN eras er
      ON p.era_id = er.id
    LEFT JOIN parties pp
      ON p.primary_party_id = pp.id
    LEFT JOIN policy_scores ps
      ON p.id = ps.policy_id
    ${whereClause}
    ORDER BY p.year_enacted ASC, p.title ASC
  `;

  return await query(sql);
}

export async function getOverallSummary(options = {}) {
  const rows = await fetchPolicyAnalyticsRows(options);
  return summarizePolicies(rows);
}

export async function getSummaryByParty(options = {}) {
  const rows = await fetchPolicyAnalyticsRows(options);
  return groupAndSummarize(rows, "primary_party_name", "No Primary Party");
}

export async function getSummaryByEra(options = {}) {
  const rows = await fetchPolicyAnalyticsRows(options);
  return groupAndSummarize(rows, "era_name", "Unknown Era");
}

export async function getDirectImpactSummaryByParty(options = {}) {
  const rows = await fetchPolicyAnalyticsRows(options);
  const overallByParty = groupAndSummarize(rows, "primary_party_name", "No Primary Party");
  const directByParty = groupAndSummarize(
    rows.filter((row) => Number(row.direct_black_impact) === 1),
    "primary_party_name",
    "No Primary Party"
  );
  const directCounts = new Map(
    directByParty.map((row) => [row.name, row.total_policies])
  );

  return overallByParty.map((row) => ({
    ...row,
    direct_black_impact_count: directCounts.get(row.name) || 0,
  }));
}

export async function getDirectImpactSummaryByEra(options = {}) {
  const rows = await fetchPolicyAnalyticsRows(options);
  const overallByEra = groupAndSummarize(rows, "era_name", "Unknown Era");
  const directByEra = groupAndSummarize(
    rows.filter((row) => Number(row.direct_black_impact) === 1),
    "era_name",
    "Unknown Era"
  );
  const directCounts = new Map(
    directByEra.map((row) => [row.name, row.total_policies])
  );

  return overallByEra.map((row) => ({
    ...row,
    direct_black_impact_count: directCounts.get(row.name) || 0,
  }));
}

export async function getCategorySummary({ includeArchived = false } = {}) {
  const whereClause = includeArchived ? "" : "AND p.is_archived = 0";

  const sql = `
    SELECT
      p.id,
      p.title,
      p.year_enacted,
      p.status,
      p.impact_direction,
      p.direct_black_impact,
      p.is_archived,
      pc.name AS category_name,
      ps.directness_score,
      ps.material_impact_score,
      ps.evidence_score,
      ps.durability_score,
      ps.equity_score,
      ps.harm_offset_score
    FROM policy_policy_categories ppc
    INNER JOIN policies p
      ON ppc.policy_id = p.id
    INNER JOIN policy_categories pc
      ON ppc.category_id = pc.id
    LEFT JOIN policy_scores ps
      ON p.id = ps.policy_id
    WHERE 1=1
      ${whereClause}
    ORDER BY pc.name ASC, p.year_enacted ASC
  `;

  const rows = await query(sql);
  return groupAndSummarize(rows, "category_name", "Uncategorized");
}
