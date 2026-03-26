import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();

    const [rows] = await db.query(`
      SELECT
        pa.name AS party,
        p.impact_direction,
        COUNT(*) AS total
      FROM policies p
      LEFT JOIN parties pa ON p.primary_party_id = pa.id
      WHERE p.is_archived = 0
      GROUP BY pa.name, p.impact_direction
      ORDER BY pa.name ASC, p.impact_direction ASC
    `);

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching by-party report:", error);
    return NextResponse.json(
      { error: "Failed to fetch by-party report" },
      { status: 500 }
    );
  }
}
