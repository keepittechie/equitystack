import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

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
        p.direct_black_impact,
        p.bipartisan,
        p.status,
        p.summary,
        e.name AS era,
        pa.name AS primary_party,
        pr.full_name AS president
      FROM policies p
      LEFT JOIN eras e ON p.era_id = e.id
      LEFT JOIN parties pa ON p.primary_party_id = pa.id
      LEFT JOIN presidents pr ON p.president_id = pr.id
      WHERE p.is_archived = 0
      ORDER BY p.year_enacted ASC, p.title ASC
    `);

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching era details:", error);
    return NextResponse.json(
      { error: "Failed to fetch era details" },
      { status: 500 }
    );
  }
}
