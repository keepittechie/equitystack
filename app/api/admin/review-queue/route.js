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
        p.status,
        p.impact_direction,
        pa.name AS primary_party,
        e.name AS era,
        COUNT(DISTINCT s.id) AS total_sources,
        COUNT(DISTINCT ps.id) AS score_count,
        COUNT(DISTINCT m.id) AS metric_count
      FROM policies p
      LEFT JOIN parties pa ON p.primary_party_id = pa.id
      LEFT JOIN eras e ON p.era_id = e.id
      LEFT JOIN sources s ON p.id = s.policy_id
      LEFT JOIN policy_scores ps ON p.id = ps.policy_id
      LEFT JOIN metrics m ON p.id = m.policy_id
      WHERE p.is_archived = 0
      GROUP BY p.id, p.title, p.year_enacted, p.status, p.impact_direction, pa.name, e.name
      HAVING
        COUNT(DISTINCT s.id) = 0
        OR COUNT(DISTINCT ps.id) = 0
        OR COUNT(DISTINCT m.id) = 0
        OR COUNT(DISTINCT s.id) < 2
      ORDER BY p.year_enacted ASC, p.title ASC
    `);

    const enhanced = rows.map((row) => {
      const issues = [];

      if (Number(row.total_sources) === 0) issues.push("No sources");
      else if (Number(row.total_sources) < 2) issues.push("Limited sources");

      if (Number(row.score_count) === 0) issues.push("No score");
      if (Number(row.metric_count) === 0) issues.push("No metrics");

      return {
        ...row,
        issues,
      };
    });

    return NextResponse.json(enhanced);
  } catch (error) {
    console.error("Error fetching review queue:", error);
    return NextResponse.json(
      { error: "Failed to fetch review queue" },
      { status: 500 }
    );
  }
}
