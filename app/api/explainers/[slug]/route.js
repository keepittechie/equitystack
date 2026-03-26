import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { fetchRelatedPromisesForExplainer } from "@/lib/services/promiseService";

export async function GET(request, { params }) {
  try {
    const db = getDb();
    const { slug } = await params;

    const [explainerRows] = await db.query(
      `
      SELECT
        id,
        slug,
        title,
        category,
        summary,
        key_takeaways,
        intro_text,
        why_it_matters,
        common_claim,
        what_actually_happened,
        timeline_events,
        key_policies_text,
        why_it_still_matters,
        sources_note,
        published,
        created_at,
        updated_at
      FROM explainers
      WHERE slug = ? AND published = 1
      LIMIT 1
      `,
      [slug]
    );

    if (explainerRows.length === 0) {
      return NextResponse.json({ error: "Explainer not found" }, { status: 404 });
    }

    const explainer = explainerRows[0];

    const [policyRows] = await db.query(
      `
      SELECT
        p.id,
        p.title,
        p.year_enacted,
        p.policy_type,
        pp.name AS primary_party
      FROM explainer_policy_links epl
      JOIN policies p ON p.id = epl.policy_id
      LEFT JOIN parties pp ON pp.id = p.primary_party_id
      WHERE epl.explainer_id = ?
      ORDER BY p.year_enacted ASC, p.title ASC
      `,
      [explainer.id]
    );

    const [futureBillRows] = await db.query(
      `
      SELECT
        fb.id,
        fb.title,
        fb.target_area,
        fb.priority_level,
        fb.status,
        fb.problem_statement
      FROM explainer_future_bill_links efbl
      JOIN future_bills fb ON fb.id = efbl.future_bill_id
      WHERE efbl.explainer_id = ?
      ORDER BY
        FIELD(fb.priority_level, 'Critical', 'High', 'Medium', 'Low'),
        fb.title ASC
      `,
      [explainer.id]
    );

    const [trackedBillRows] = await db.query(
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
        tb.bill_url
      FROM future_bill_links fbl
      JOIN tracked_bills tb ON tb.id = fbl.tracked_bill_id
      WHERE fbl.future_bill_id IN (
        SELECT future_bill_id
        FROM explainer_future_bill_links
        WHERE explainer_id = ?
      )
      ORDER BY tb.introduced_date DESC, tb.bill_number ASC
      `,
      [explainer.id]
    );

    const trackedBillIds = trackedBillRows.map((row) => row.id).filter(Boolean);
    let legislatorRows = [];

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

    const [sourceRows] = await db.query(
      `
      SELECT
        id,
        source_title,
        source_url,
        source_type,
        publisher,
        published_date,
        notes,
        display_order
      FROM explainer_sources
      WHERE explainer_id = ?
      ORDER BY display_order ASC, published_date DESC, source_title ASC
      `,
      [explainer.id]
    );

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

    const futureBillsWithTracked = futureBillRows.map((fb) => {
      const linkedTracked = trackedBillRows.filter(
        (tb) => tb.future_bill_id === fb.id
      );

      const linkedLegislatorMap = new Map();
      for (const trackedBill of linkedTracked) {
        const trackedLegislators = legislatorsByTrackedBillId.get(trackedBill.id) || [];
        for (const legislator of trackedLegislators) {
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
        ...fb,
        tracked_bills: linkedTracked,
        linked_legislators: Array.from(linkedLegislatorMap.values()).sort((left, right) => {
          return (
            Number(right.net_weighted_impact || 0) - Number(left.net_weighted_impact || 0) ||
            left.full_name.localeCompare(right.full_name)
          );
        }),
      };
    });

    const relatedPromiseRows = await fetchRelatedPromisesForExplainer(explainer.id);

    return NextResponse.json({
      ...explainer,
      related_policies: policyRows,
      related_promises: relatedPromiseRows,
      related_future_bills: futureBillsWithTracked,
      sources: sourceRows,
    });
  } catch (error) {
    console.error("Error fetching explainer:", error);
    return NextResponse.json(
      { error: "Failed to fetch explainer" },
      { status: 500 }
    );
  }
}
