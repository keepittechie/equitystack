import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();

    const [rows] = await db.query(`
      SELECT
        p.id AS policy_id,
        p.title,
        COUNT(s.id) AS total_sources,
        SUM(CASE WHEN s.source_type = 'Government' THEN 1 ELSE 0 END) AS government_sources,
        SUM(CASE WHEN s.source_type = 'Academic' THEN 1 ELSE 0 END) AS academic_sources,
        SUM(CASE WHEN s.source_type = 'Archive' THEN 1 ELSE 0 END) AS archive_sources
      FROM policies p
      LEFT JOIN sources s ON p.id = s.policy_id
      WHERE p.is_archived = 0
      GROUP BY p.id, p.title
      ORDER BY p.year_enacted ASC, p.title ASC
    `);

    const enhanced = rows.map((row) => {
      let evidence_strength = "Limited";

      if (
        Number(row.total_sources) >= 3 &&
        (Number(row.government_sources) >= 1 || Number(row.academic_sources) >= 1)
      ) {
        evidence_strength = "Strong";
      } else if (Number(row.total_sources) >= 2) {
        evidence_strength = "Moderate";
      }

      return {
        ...row,
        evidence_strength,
      };
    });

    return NextResponse.json(enhanced);
  } catch (error) {
    console.error("Error fetching policy evidence summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch policy evidence summary" },
      { status: 500 }
    );
  }
}
