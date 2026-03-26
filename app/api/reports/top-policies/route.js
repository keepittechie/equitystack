import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { POLICY_IMPACT_SCORE_SQL } from "@/lib/analytics/impactAggregator";

export async function GET() {
  try {
    const db = getDb();

    const [rows] = await db.query(`
      SELECT
        p.id,
        p.title,
        p.year_enacted,
        p.policy_type,
        p.impact_direction,
        pa.name AS primary_party,
        (
          SELECT COUNT(DISTINCT epl.explainer_id)
          FROM explainer_policy_links epl
          JOIN explainers e2
            ON e2.id = epl.explainer_id
           AND e2.published = 1
          WHERE epl.policy_id = p.id
        ) AS related_explainer_count,
        (
          SELECT COUNT(DISTINCT efbl.future_bill_id)
          FROM explainer_policy_links epl
          JOIN explainer_future_bill_links efbl
            ON efbl.explainer_id = epl.explainer_id
          WHERE epl.policy_id = p.id
        ) AS related_future_bill_count,
        (
          SELECT COUNT(DISTINCT ltr.legislator_id)
          FROM explainer_policy_links epl
          JOIN explainer_future_bill_links efbl
            ON efbl.explainer_id = epl.explainer_id
          JOIN future_bill_links fbl
            ON fbl.future_bill_id = efbl.future_bill_id
          JOIN legislator_tracked_bill_roles ltr
            ON ltr.tracked_bill_id = fbl.tracked_bill_id
          WHERE epl.policy_id = p.id
        ) AS linked_legislator_count,
        ${POLICY_IMPACT_SCORE_SQL} AS total_score
      FROM policy_scores ps
      JOIN policies p ON ps.policy_id = p.id
      LEFT JOIN parties pa ON p.primary_party_id = pa.id
      WHERE p.impact_direction = 'Positive'
      AND p.is_archived = 0
      ORDER BY total_score DESC, p.year_enacted ASC
      LIMIT 25
    `);

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching top policies report:", error);
    return NextResponse.json(
      { error: "Failed to fetch top policies report" },
      { status: 500 }
    );
  }
}
