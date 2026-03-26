import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();

    const [rows] = await db.query(`
      SELECT
        COALESCE(pa.name, 'No Primary Party') AS name,
        COUNT(*) AS total_policies,
        SUM(CASE WHEN p.direct_black_impact = 1 THEN 1 ELSE 0 END) AS direct_black_impact_count,
        SUM(CASE WHEN p.impact_direction = 'Positive' THEN 1 ELSE 0 END) AS positive_count,
        SUM(CASE WHEN p.impact_direction = 'Negative' THEN 1 ELSE 0 END) AS negative_count,
        SUM(CASE WHEN p.impact_direction = 'Mixed' THEN 1 ELSE 0 END) AS mixed_count,
        SUM(CASE WHEN p.impact_direction = 'Blocked' THEN 1 ELSE 0 END) AS blocked_count
      FROM policies p
      LEFT JOIN parties pa ON p.primary_party_id = pa.id
      WHERE p.is_archived = 0
      GROUP BY COALESCE(pa.name, 'No Primary Party')
      ORDER BY COALESCE(pa.name, 'No Primary Party') ASC
    `);

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching party direct summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch party direct summary" },
      { status: 500 }
    );
  }
}
