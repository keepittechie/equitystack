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
        p.status,
        p.summary,
        p.impact_notes,
        pa.name AS primary_party,
        e.name AS era,
        pr.full_name AS president
      FROM policies p
      LEFT JOIN parties pa ON p.primary_party_id = pa.id
      LEFT JOIN eras e ON p.era_id = e.id
      LEFT JOIN presidents pr ON p.president_id = pr.id
      WHERE p.impact_direction IN ('Negative', 'Blocked', 'Mixed')
      AND p.is_archived = 0
      ORDER BY p.year_enacted ASC, p.title ASC
    `);

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching rollback report:", error);
    return NextResponse.json(
      { error: "Failed to fetch rollback report" },
      { status: 500 }
    );
  }
}
