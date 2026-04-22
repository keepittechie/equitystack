import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { fetchEntityDemographicImpacts } from "@/lib/services/entityDemographicImpactService";
import { fetchRelatedPromisesForPolicy } from "@/lib/services/promiseService";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const policyId = Number(id);
    const db = getDb();

    if (!Number.isFinite(policyId)) {
      return NextResponse.json({ error: "Invalid policy id" }, { status: 400 });
    }

    const [policyRows] = await db.query(
      `
      SELECT
        p.*,
        pr.full_name AS president,
        pa.name AS primary_party,
        hp.name AS house_party,
        sp.name AS senate_party,
        e.name AS era
      FROM policies p
      LEFT JOIN presidents pr ON p.president_id = pr.id
      LEFT JOIN parties pa ON p.primary_party_id = pa.id
      LEFT JOIN parties hp ON p.house_party_id = hp.id
      LEFT JOIN parties sp ON p.senate_party_id = sp.id
      LEFT JOIN eras e ON p.era_id = e.id
      WHERE p.id = ?
        AND p.is_archived = 0
      `,
      [policyId]
    );

    if (policyRows.length === 0) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }

    const [categoryRows] = await db.query(
      `
      SELECT c.name
      FROM policy_policy_categories pc
      JOIN policy_categories c ON pc.category_id = c.id
      WHERE pc.policy_id = ?
      ORDER BY c.name ASC
      `,
      [policyId]
    );

    const [scoreRows] = await db.query(
      `
      SELECT
        directness_score,
        material_impact_score,
        evidence_score,
        durability_score,
        equity_score,
        harm_offset_score,
        notes
      FROM policy_scores
      WHERE policy_id = ?
      `,
      [policyId]
    );

    const [sourceRows] = await db.query(
      `
      SELECT
        source_title,
        source_url,
        source_type,
        publisher,
        published_date,
        notes
      FROM sources
      WHERE policy_id = ?
      ORDER BY id ASC
      `,
      [policyId]
    );

    const [metricRows] = await db.query(
      `
      SELECT
        metric_name,
        demographic_group,
        before_value,
        after_value,
        unit,
        geography,
        year_before,
        year_after,
        methodology_note
      FROM metrics
      WHERE policy_id = ?
      ORDER BY id ASC
      `,
      [policyId]
    );

    const [relationshipRows] = await db.query(
      `
      SELECT
        pr.id,
        pr.relationship_type,
        pr.notes,
        rp.id AS related_policy_id,
        rp.title AS related_policy_title,
        rp.year_enacted AS related_policy_year,
        rp.policy_type AS related_policy_type,
        pa.name AS related_policy_primary_party,
        e.name AS related_policy_era,
        rp.impact_direction AS related_policy_impact_direction
      FROM policy_relationships pr
      JOIN policies rp
        ON (
          (rp.id = pr.related_policy_id AND pr.policy_id = ?)
          OR
          (rp.id = pr.policy_id AND pr.related_policy_id = ?)
        )
      LEFT JOIN parties pa ON rp.primary_party_id = pa.id
      LEFT JOIN eras e ON rp.era_id = e.id
      WHERE rp.is_archived = 0
      ORDER BY rp.year_enacted ASC, rp.title ASC
      `,
      [policyId, policyId]
    );

    const [explainerRows] = await db.query(
      `
      SELECT
        e.id,
        e.slug,
        e.title,
        e.summary,
        e.category
      FROM explainer_policy_links epl
      JOIN explainers e ON e.id = epl.explainer_id
      WHERE epl.policy_id = ?
        AND e.published = 1
      ORDER BY e.title ASC
      `,
      [policyId]
    );

    const [futureBillRows] = await db.query(
      `
      SELECT DISTINCT
        fb.id,
        fb.title,
        fb.target_area,
        fb.priority_level,
        fb.status,
        fb.problem_statement
      FROM explainer_policy_links epl
      JOIN explainer_future_bill_links efbl
        ON efbl.explainer_id = epl.explainer_id
      JOIN future_bills fb
        ON fb.id = efbl.future_bill_id
      WHERE epl.policy_id = ?
      ORDER BY
        FIELD(fb.priority_level, 'Critical', 'High', 'Medium', 'Low'),
        fb.title ASC
      `,
      [policyId]
    );

    const futureBillIds = futureBillRows.map((row) => row.id).filter(Boolean);
    let trackedBillRows = [];
    let legislatorRows = [];

    if (futureBillIds.length > 0) {
      const [trackedResult] = await db.query(
        `
        SELECT
          fbl.future_bill_id,
          tb.id,
          tb.bill_number,
          tb.title,
          tb.bill_status,
          tb.sponsor_name,
          tb.sponsor_party,
          tb.sponsor_state,
          tb.introduced_date,
          tb.latest_action_date,
          tb.bill_url
        FROM future_bill_links fbl
        JOIN tracked_bills tb
          ON tb.id = fbl.tracked_bill_id
        WHERE fbl.future_bill_id IN (?)
        ORDER BY tb.latest_action_date DESC, tb.bill_number ASC
        `,
        [futureBillIds]
      );
      trackedBillRows = trackedResult;

      const trackedBillIds = trackedBillRows.map((row) => row.id).filter(Boolean);

      if (trackedBillIds.length > 0) {
        const [legislatorResult] = await db.query(
          `
          SELECT
            ltr.tracked_bill_id,
            l.id AS legislator_id,
            l.full_name,
            l.chamber,
            l.party,
            l.state,
            ltr.role,
            lss.net_weighted_impact,
            lss.avg_policy_impact_score,
            lss.total_tracked_bills
          FROM legislator_tracked_bill_roles ltr
          JOIN legislators l
            ON l.id = ltr.legislator_id
          LEFT JOIN legislator_scorecard_snapshots lss
            ON lss.legislator_id = l.id
           AND lss.snapshot_label = 'Current'
          WHERE ltr.tracked_bill_id IN (?)
          ORDER BY
            ltr.tracked_bill_id ASC,
            FIELD(ltr.role, 'Primary Sponsor', 'Cosponsor', 'Committee Chair', 'Committee Member'),
            COALESCE(lss.net_weighted_impact, 0) DESC,
            l.full_name ASC
          `,
          [trackedBillIds]
        );
        legislatorRows = legislatorResult;
      }
    }

    const [adjacentRows] = await db.query(
      `
      SELECT
        p.id,
        p.title,
        p.year_enacted,
        CASE
          WHEN p.year_enacted < current_policy.year_enacted
            OR (p.year_enacted = current_policy.year_enacted AND p.title < current_policy.title)
          THEN 'previous'
          ELSE 'next'
        END AS direction
      FROM policies p
      JOIN policies current_policy ON current_policy.id = ?
      WHERE p.id <> current_policy.id
        AND p.is_archived = 0
        AND p.era_id = current_policy.era_id
      ORDER BY
        CASE
          WHEN p.year_enacted < current_policy.year_enacted
            OR (p.year_enacted = current_policy.year_enacted AND p.title < current_policy.title)
          THEN 0
          ELSE 1
        END ASC,
        CASE
          WHEN p.year_enacted < current_policy.year_enacted
            OR (p.year_enacted = current_policy.year_enacted AND p.title < current_policy.title)
          THEN p.year_enacted
        END DESC,
        CASE
          WHEN p.year_enacted < current_policy.year_enacted
            OR (p.year_enacted = current_policy.year_enacted AND p.title < current_policy.title)
          THEN p.title
        END DESC,
        CASE
          WHEN p.year_enacted > current_policy.year_enacted
            OR (p.year_enacted = current_policy.year_enacted AND p.title > current_policy.title)
          THEN p.year_enacted
        END ASC,
        CASE
          WHEN p.year_enacted > current_policy.year_enacted
            OR (p.year_enacted = current_policy.year_enacted AND p.title > current_policy.title)
          THEN p.title
        END ASC
      LIMIT 6
      `,
      [policyId]
    );

    const [relatedPromiseRows, demographicImpacts] = await Promise.all([
      fetchRelatedPromisesForPolicy(policyId),
      fetchEntityDemographicImpacts("policy", policyId, { includeSources: true }),
    ]);

    const totalSources = sourceRows.length;
    const governmentSources = sourceRows.filter(
      (source) => source.source_type === "Government"
    ).length;
    const academicSources = sourceRows.filter(
      (source) => source.source_type === "Academic"
    ).length;
    const archiveSources = sourceRows.filter(
      (source) => source.source_type === "Archive"
    ).length;

    let evidence_strength = "Limited";

    if (
      totalSources >= 3 &&
      (governmentSources >= 1 || academicSources >= 1)
    ) {
      evidence_strength = "Strong";
    } else if (totalSources >= 2) {
      evidence_strength = "Moderate";
    }

    const hasScores = scoreRows.length > 0;
    const hasMetrics = metricRows.length > 0;
    const previousInEra =
      adjacentRows.find((row) => row.direction === "previous") || null;
    const nextInEra =
      adjacentRows.find((row) => row.direction === "next") || null;

    const legislatorsByTrackedBillId = new Map();
    for (const row of legislatorRows) {
      if (!legislatorsByTrackedBillId.has(row.tracked_bill_id)) {
        legislatorsByTrackedBillId.set(row.tracked_bill_id, []);
      }
      legislatorsByTrackedBillId.get(row.tracked_bill_id).push({
        id: row.legislator_id,
        full_name: row.full_name,
        chamber: row.chamber,
        party: row.party,
        state: row.state,
        role: row.role,
        net_weighted_impact: row.net_weighted_impact,
        avg_policy_impact_score: row.avg_policy_impact_score,
        total_tracked_bills: row.total_tracked_bills,
      });
    }

    const relatedFutureBills = futureBillRows.map((futureBill) => {
      const linkedTrackedBills = trackedBillRows
        .filter((trackedBill) => trackedBill.future_bill_id === futureBill.id)
        .map((trackedBill) => ({
          ...trackedBill,
          linked_legislators: legislatorsByTrackedBillId.get(trackedBill.id) || [],
        }));

      const linkedLegislatorMap = new Map();
      for (const trackedBill of linkedTrackedBills) {
        for (const legislator of trackedBill.linked_legislators) {
          if (!linkedLegislatorMap.has(legislator.id)) {
            linkedLegislatorMap.set(legislator.id, {
              ...legislator,
              tracked_bill_count: 0,
            });
          }
          linkedLegislatorMap.get(legislator.id).tracked_bill_count += 1;
        }
      }

      return {
        ...futureBill,
        tracked_bills: linkedTrackedBills,
        linked_legislators: Array.from(linkedLegislatorMap.values()).sort((left, right) => {
          return (
            Number(right.net_weighted_impact || 0) - Number(left.net_weighted_impact || 0) ||
            left.full_name.localeCompare(right.full_name)
          );
        }),
      };
    });

    let completeness_status = "Needs Review";

    if (hasScores && hasMetrics && totalSources >= 3) {
      completeness_status = "Complete";
    } else if (hasScores && (totalSources >= 2 || hasMetrics)) {
      completeness_status = "Good";
    }

    return NextResponse.json({
      ...policyRows[0],
      categories: categoryRows,
      scores: scoreRows[0] || null,
      sources: sourceRows,
      metrics: metricRows,
      demographic_impacts: demographicImpacts,
      relationships: relationshipRows,
      related_explainers: explainerRows,
      related_promises: relatedPromiseRows,
      related_future_bills: relatedFutureBills,
      evidence_summary: {
        total_sources: totalSources,
        government_sources: governmentSources,
        academic_sources: academicSources,
        archive_sources: archiveSources,
        evidence_strength,
      },
      completeness_summary: {
        has_scores: hasScores,
        has_metrics: hasMetrics,
        total_sources: totalSources,
        status: completeness_status,
      },
      source_mix_summary: {
        source_types_used: [
          governmentSources > 0 ? "Government" : null,
          academicSources > 0 ? "Academic" : null,
          archiveSources > 0 ? "Archive" : null,
        ].filter(Boolean),
        newest_source_date:
          sourceRows
            .map((row) => row.published_date)
            .filter(Boolean)
            .sort((a, b) => String(b).localeCompare(String(a)))[0] || null,
      },
      era_navigation: {
        previous: previousInEra,
        next: nextInEra,
      },
    });
  } catch (error) {
    console.error("Error fetching policy detail:", error);
    return NextResponse.json(
      { error: "Failed to fetch policy detail" },
      { status: 500 }
    );
  }
}
