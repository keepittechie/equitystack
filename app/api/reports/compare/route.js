import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();

    const [summaryRows] = await db.query(`
      SELECT
        COALESCE(pa.name, 'No Primary Party') AS party,
        p.impact_direction,
        COUNT(*) AS total
      FROM policies p
      LEFT JOIN parties pa ON p.primary_party_id = pa.id
      WHERE p.is_archived = 0
      GROUP BY COALESCE(pa.name, 'No Primary Party'), p.impact_direction
      ORDER BY COALESCE(pa.name, 'No Primary Party') ASC, p.impact_direction ASC
    `);

    const [detailRows] = await db.query(`
      SELECT
        p.id,
        p.title,
        p.year_enacted,
        p.policy_type,
        p.impact_direction,
        p.direct_black_impact,
        p.bipartisan,
        p.status,
        p.summary,
        COALESCE(pa.name, 'No Primary Party') AS party,
        e.name AS era,
        pr.full_name AS president
      FROM policies p
      LEFT JOIN parties pa ON p.primary_party_id = pa.id
      LEFT JOIN eras e ON p.era_id = e.id
      LEFT JOIN presidents pr ON p.president_id = pr.id
      WHERE p.is_archived = 0
      ORDER BY COALESCE(pa.name, 'No Primary Party') ASC, p.year_enacted ASC, p.title ASC
    `);

    return NextResponse.json({
      summary: summaryRows,
      details: detailRows,
    });
  } catch (error) {
    console.error("Error fetching comparison report:", error);
    return NextResponse.json(
      { error: "Failed to fetch comparison report" },
      { status: 500 }
    );
  }
}
