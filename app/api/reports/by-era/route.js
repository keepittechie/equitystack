import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();

    const [rows] = await db.query(`
      SELECT
        e.name AS era,
        p.impact_direction,
        COUNT(*) AS total
      FROM policies p
      LEFT JOIN eras e ON p.era_id = e.id
      WHERE p.is_archived = 0
      GROUP BY e.name, p.impact_direction
      ORDER BY
        MIN(p.year_enacted) ASC,
        e.name ASC,
        p.impact_direction ASC
    `);

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching by-era report:", error);
    return NextResponse.json(
      { error: "Failed to fetch by-era report" },
      { status: 500 }
    );
  }
}
