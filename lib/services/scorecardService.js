import { query } from "@/lib/db";

export const CURRENT_SCORECARD_SNAPSHOT_LABEL = "Current";

export async function getScorecardOverview() {
  const legislatorRows = await query(`
    SELECT
      COUNT(*) AS total_legislators,
      SUM(CASE WHEN chamber = 'House' THEN 1 ELSE 0 END) AS house_legislators,
      SUM(CASE WHEN chamber = 'Senate' THEN 1 ELSE 0 END) AS senate_legislators
    FROM legislators
  `);

  const roleRows = await query(`
    SELECT
      COUNT(*) AS total_roles,
      SUM(CASE WHEN role = 'Primary Sponsor' THEN 1 ELSE 0 END) AS primary_sponsor_roles,
      SUM(CASE WHEN role = 'Cosponsor' THEN 1 ELSE 0 END) AS cosponsor_roles
    FROM legislator_tracked_bill_roles
  `);

  const futureBillRows = await query(`
    SELECT
      COUNT(*) AS total_future_positions,
      COUNT(DISTINCT future_bill_id) AS covered_future_bills
    FROM legislator_future_bill_positions
  `);

  const snapshotRows = await query(
    `
    SELECT
      COUNT(*) AS total_snapshots,
      AVG(net_weighted_impact) AS avg_net_weighted_impact,
      MAX(net_weighted_impact) AS top_net_weighted_impact
    FROM legislator_scorecard_snapshots
    WHERE snapshot_label = ?
    `,
    [CURRENT_SCORECARD_SNAPSHOT_LABEL]
  );

  const topLegislators = await query(
    `
    SELECT
      l.id,
      l.full_name,
      l.chamber,
      l.party,
      l.state,
      COUNT(*) AS total_roles,
      SUM(CASE WHEN ltr.role = 'Primary Sponsor' THEN 1 ELSE 0 END) AS primary_sponsor_roles,
      SUM(CASE WHEN ltr.role = 'Cosponsor' THEN 1 ELSE 0 END) AS cosponsor_roles,
      lss.avg_policy_impact_score,
      lss.net_weighted_impact,
      lss.positive_bill_count,
      lss.blocked_bill_count
    FROM legislator_tracked_bill_roles ltr
    JOIN legislators l
      ON l.id = ltr.legislator_id
    LEFT JOIN legislator_scorecard_snapshots lss
      ON lss.legislator_id = l.id
     AND lss.snapshot_label = ?
    GROUP BY l.id, l.full_name, l.chamber, l.party, l.state
    ORDER BY
      COALESCE(lss.net_weighted_impact, 0) DESC,
      primary_sponsor_roles DESC,
      total_roles DESC,
      l.full_name ASC
    LIMIT 12
    `,
    [CURRENT_SCORECARD_SNAPSHOT_LABEL]
  );

  const chamberSummary = await query(
    `
    SELECT
      l.chamber AS name,
      COUNT(*) AS legislator_count,
      AVG(COALESCE(lss.net_weighted_impact, 0)) AS avg_net_weighted_impact,
      AVG(COALESCE(lss.avg_policy_impact_score, 0)) AS avg_policy_impact_score,
      SUM(COALESCE(lss.sponsored_bill_count, 0)) AS sponsored_bill_count,
      SUM(COALESCE(lss.total_tracked_bills, 0)) AS total_tracked_bills,
      SUM(COALESCE(lss.direct_black_impact_bill_count, 0)) AS direct_black_impact_bill_count
    FROM legislators l
    LEFT JOIN legislator_scorecard_snapshots lss
      ON lss.legislator_id = l.id
     AND lss.snapshot_label = ?
    GROUP BY l.chamber
    ORDER BY avg_net_weighted_impact DESC, l.chamber ASC
    `,
    [CURRENT_SCORECARD_SNAPSHOT_LABEL]
  );

  const partySummary = await query(
    `
    SELECT
      COALESCE(l.party, 'Unknown') AS name,
      COUNT(*) AS legislator_count,
      AVG(COALESCE(lss.net_weighted_impact, 0)) AS avg_net_weighted_impact,
      AVG(COALESCE(lss.avg_policy_impact_score, 0)) AS avg_policy_impact_score,
      SUM(COALESCE(lss.sponsored_bill_count, 0)) AS sponsored_bill_count,
      SUM(COALESCE(lss.total_tracked_bills, 0)) AS total_tracked_bills,
      SUM(COALESCE(lss.direct_black_impact_bill_count, 0)) AS direct_black_impact_bill_count
    FROM legislators l
    LEFT JOIN legislator_scorecard_snapshots lss
      ON lss.legislator_id = l.id
     AND lss.snapshot_label = ?
    GROUP BY COALESCE(l.party, 'Unknown')
    ORDER BY avg_net_weighted_impact DESC, name ASC
    `,
    [CURRENT_SCORECARD_SNAPSHOT_LABEL]
  );

  return {
    ...(legislatorRows[0] || {
      total_legislators: 0,
      house_legislators: 0,
      senate_legislators: 0,
    }),
    ...(roleRows[0] || {
      total_roles: 0,
      primary_sponsor_roles: 0,
      cosponsor_roles: 0,
    }),
    ...(futureBillRows[0] || {
      total_future_positions: 0,
      covered_future_bills: 0,
    }),
    ...(snapshotRows[0] || {
      total_snapshots: 0,
      avg_net_weighted_impact: 0,
      top_net_weighted_impact: 0,
    }),
    chamber_summary: chamberSummary,
    party_summary: partySummary,
    top_legislators: topLegislators,
  };
}

export async function getLegislatorDirectory() {
  return await query(
    `
    SELECT
      l.id,
      l.full_name,
      l.display_name,
      l.chamber,
      l.party,
      l.state,
      l.status,
      COUNT(DISTINCT ltr.id) AS total_roles,
      SUM(CASE WHEN ltr.role = 'Primary Sponsor' THEN 1 ELSE 0 END) AS primary_sponsor_roles,
      SUM(CASE WHEN ltr.role = 'Cosponsor' THEN 1 ELSE 0 END) AS cosponsor_roles,
      COUNT(DISTINCT lfbp.future_bill_id) AS future_bill_count,
      lss.total_tracked_bills,
      lss.sponsored_bill_count,
      lss.cosponsored_bill_count,
      lss.positive_bill_count,
      lss.negative_bill_count,
      lss.mixed_bill_count,
      lss.blocked_bill_count,
      lss.direct_black_impact_bill_count,
      lss.avg_policy_impact_score,
      lss.net_weighted_impact
    FROM legislators l
    LEFT JOIN legislator_tracked_bill_roles ltr
      ON ltr.legislator_id = l.id
    LEFT JOIN legislator_future_bill_positions lfbp
      ON lfbp.legislator_id = l.id
    LEFT JOIN legislator_scorecard_snapshots lss
      ON lss.legislator_id = l.id
     AND lss.snapshot_label = ?
    GROUP BY
      l.id,
      l.full_name,
      l.display_name,
      l.chamber,
      l.party,
      l.state,
      l.status,
      lss.total_tracked_bills,
      lss.sponsored_bill_count,
      lss.cosponsored_bill_count,
      lss.positive_bill_count,
      lss.negative_bill_count,
      lss.mixed_bill_count,
      lss.blocked_bill_count,
      lss.direct_black_impact_bill_count,
      lss.avg_policy_impact_score,
      lss.net_weighted_impact
    ORDER BY
      COALESCE(lss.net_weighted_impact, 0) DESC,
      total_roles DESC,
      l.full_name ASC
  `,
    [CURRENT_SCORECARD_SNAPSHOT_LABEL]
  );
}

export async function getLegislatorDetail(id) {
  const legislatorRows = await query(
    `
    SELECT
      l.*,
      COUNT(DISTINCT ltr.id) AS total_roles,
      SUM(CASE WHEN ltr.role = 'Primary Sponsor' THEN 1 ELSE 0 END) AS primary_sponsor_roles,
      SUM(CASE WHEN ltr.role = 'Cosponsor' THEN 1 ELSE 0 END) AS cosponsor_roles,
      COUNT(DISTINCT lfbp.future_bill_id) AS future_bill_count,
      lss.snapshot_label,
      lss.scoring_window_start,
      lss.scoring_window_end,
      lss.total_tracked_bills,
      lss.sponsored_bill_count,
      lss.cosponsored_bill_count,
      lss.positive_bill_count,
      lss.negative_bill_count,
      lss.mixed_bill_count,
      lss.blocked_bill_count,
      lss.direct_black_impact_bill_count,
      lss.avg_policy_impact_score,
      lss.net_weighted_impact,
      lss.score_notes
    FROM legislators l
    LEFT JOIN legislator_tracked_bill_roles ltr
      ON ltr.legislator_id = l.id
    LEFT JOIN legislator_future_bill_positions lfbp
      ON lfbp.legislator_id = l.id
    LEFT JOIN legislator_scorecard_snapshots lss
      ON lss.legislator_id = l.id
     AND lss.snapshot_label = ?
    WHERE l.id = ?
    GROUP BY l.id
    LIMIT 1
    `,
    [CURRENT_SCORECARD_SNAPSHOT_LABEL, id]
  );

  if (!legislatorRows.length) {
    return null;
  }

  const trackedBillRoles = await query(
    `
    SELECT
      ltr.role,
      ltr.role_date,
      tb.id AS tracked_bill_id,
      tb.bill_number,
      tb.title,
      tb.bill_status,
      tb.chamber,
      tb.session_label,
      tb.latest_action_date,
      tb.bill_url
    FROM legislator_tracked_bill_roles ltr
    JOIN tracked_bills tb
      ON tb.id = ltr.tracked_bill_id
    WHERE ltr.legislator_id = ?
    ORDER BY
      FIELD(ltr.role, 'Primary Sponsor', 'Cosponsor', 'Committee Chair', 'Committee Member'),
      tb.latest_action_date DESC,
      tb.bill_number ASC
    `,
    [id]
  );

  const futureBillPositions = await query(
    `
    SELECT
      lfbp.position_type,
      lfbp.source_date,
      fb.id AS future_bill_id,
      fb.title,
      fb.target_area,
      fb.priority_level,
      fb.status
    FROM legislator_future_bill_positions lfbp
    JOIN future_bills fb
      ON fb.id = lfbp.future_bill_id
    WHERE lfbp.legislator_id = ?
    ORDER BY
      FIELD(fb.priority_level, 'Critical', 'High', 'Medium', 'Low'),
      fb.title ASC
    `,
    [id]
  );

  const issueAreaBreakdown = await query(
    `
    SELECT
      COALESCE(fb.target_area, 'Uncategorized') AS target_area,
      COUNT(DISTINCT lfbp.future_bill_id) AS future_bill_count,
      SUM(CASE WHEN lfbp.position_type = 'Sponsor' THEN 1 ELSE 0 END) AS sponsor_count,
      SUM(CASE WHEN lfbp.position_type = 'Cosponsor' THEN 1 ELSE 0 END) AS cosponsor_count,
      SUM(CASE WHEN fb.priority_level = 'Critical' THEN 1 ELSE 0 END) AS critical_count,
      SUM(CASE WHEN fb.priority_level = 'High' THEN 1 ELSE 0 END) AS high_count,
      MAX(
        CASE fb.priority_level
          WHEN 'Critical' THEN 4
          WHEN 'High' THEN 3
          WHEN 'Medium' THEN 2
          WHEN 'Low' THEN 1
          ELSE 0
        END
      ) AS highest_priority_rank
    FROM legislator_future_bill_positions lfbp
    JOIN future_bills fb
      ON fb.id = lfbp.future_bill_id
    WHERE lfbp.legislator_id = ?
    GROUP BY COALESCE(fb.target_area, 'Uncategorized')
    ORDER BY
      future_bill_count DESC,
      sponsor_count DESC,
      highest_priority_rank DESC,
      target_area ASC
    `,
    [id]
  );

  const relatedExplainers = await query(
    `
    SELECT
      e.id,
      e.slug,
      e.title,
      e.summary,
      e.category,
      COUNT(DISTINCT lfbp.future_bill_id) AS linked_future_bill_count,
      MAX(
        CASE fb.priority_level
          WHEN 'Critical' THEN 4
          WHEN 'High' THEN 3
          WHEN 'Medium' THEN 2
          WHEN 'Low' THEN 1
          ELSE 0
        END
      ) AS highest_priority_rank
    FROM legislator_future_bill_positions lfbp
    JOIN future_bills fb
      ON fb.id = lfbp.future_bill_id
    JOIN explainer_future_bill_links efbl
      ON efbl.future_bill_id = fb.id
    JOIN explainers e
      ON e.id = efbl.explainer_id
     AND e.published = 1
    WHERE lfbp.legislator_id = ?
    GROUP BY e.id, e.slug, e.title, e.summary, e.category
    ORDER BY
      linked_future_bill_count DESC,
      highest_priority_rank DESC,
      e.title ASC
    `,
    [id]
  );

  const relatedPolicies = await query(
    `
    SELECT
      p.id,
      p.title,
      p.year_enacted,
      p.policy_type,
      p.impact_direction,
      e.name AS era,
      pa.name AS primary_party,
      COUNT(DISTINCT lfbp.future_bill_id) AS linked_future_bill_count
    FROM legislator_future_bill_positions lfbp
    JOIN explainer_future_bill_links efbl
      ON efbl.future_bill_id = lfbp.future_bill_id
    JOIN explainer_policy_links epl
      ON epl.explainer_id = efbl.explainer_id
    JOIN policies p
      ON p.id = epl.policy_id
     AND p.is_archived = 0
    LEFT JOIN eras e
      ON e.id = p.era_id
    LEFT JOIN parties pa
      ON pa.id = p.primary_party_id
    WHERE lfbp.legislator_id = ?
    GROUP BY
      p.id,
      p.title,
      p.year_enacted,
      p.policy_type,
      p.impact_direction,
      e.name,
      pa.name
    ORDER BY
      linked_future_bill_count DESC,
      p.year_enacted DESC,
      p.title ASC
    `,
    [id]
  );

  const rankingRows = await query(
    `
    SELECT
      base.net_weighted_impact,
      base.avg_policy_impact_score,
      base.total_tracked_bills,
      (
        SELECT COUNT(*) + 1
        FROM legislator_scorecard_snapshots higher
        WHERE higher.snapshot_label = ?
          AND COALESCE(higher.net_weighted_impact, 0) > COALESCE(base.net_weighted_impact, 0)
      ) AS overall_rank,
      (
        SELECT COUNT(*)
        FROM legislator_scorecard_snapshots total
        WHERE total.snapshot_label = ?
      ) AS total_ranked,
      (
        SELECT COUNT(*) + 1
        FROM legislator_scorecard_snapshots higher
        JOIN legislators cmp
          ON cmp.id = higher.legislator_id
        WHERE higher.snapshot_label = ?
          AND cmp.chamber = legislator.chamber
          AND COALESCE(higher.net_weighted_impact, 0) > COALESCE(base.net_weighted_impact, 0)
      ) AS chamber_rank,
      (
        SELECT COUNT(*)
        FROM legislator_scorecard_snapshots total
        JOIN legislators cmp
          ON cmp.id = total.legislator_id
        WHERE total.snapshot_label = ?
          AND cmp.chamber = legislator.chamber
      ) AS chamber_total,
      (
        SELECT COUNT(*) + 1
        FROM legislator_scorecard_snapshots higher
        JOIN legislators cmp
          ON cmp.id = higher.legislator_id
        WHERE higher.snapshot_label = ?
          AND COALESCE(cmp.party, 'Unknown') = COALESCE(legislator.party, 'Unknown')
          AND COALESCE(higher.net_weighted_impact, 0) > COALESCE(base.net_weighted_impact, 0)
      ) AS party_rank,
      (
        SELECT COUNT(*)
        FROM legislator_scorecard_snapshots total
        JOIN legislators cmp
          ON cmp.id = total.legislator_id
        WHERE total.snapshot_label = ?
          AND COALESCE(cmp.party, 'Unknown') = COALESCE(legislator.party, 'Unknown')
      ) AS party_total
    FROM legislators legislator
    JOIN legislator_scorecard_snapshots base
      ON base.legislator_id = legislator.id
     AND base.snapshot_label = ?
    WHERE legislator.id = ?
    LIMIT 1
    `,
    [
      CURRENT_SCORECARD_SNAPSHOT_LABEL,
      CURRENT_SCORECARD_SNAPSHOT_LABEL,
      CURRENT_SCORECARD_SNAPSHOT_LABEL,
      CURRENT_SCORECARD_SNAPSHOT_LABEL,
      CURRENT_SCORECARD_SNAPSHOT_LABEL,
      CURRENT_SCORECARD_SNAPSHOT_LABEL,
      CURRENT_SCORECARD_SNAPSHOT_LABEL,
      id,
    ]
  );

  const ranking = rankingRows[0] || null;

  return {
    ...legislatorRows[0],
    tracked_bill_roles: trackedBillRoles,
    future_bill_positions: futureBillPositions,
    issue_area_breakdown: issueAreaBreakdown,
    related_explainers: relatedExplainers,
    related_policies: relatedPolicies,
    ranking,
  };
}
