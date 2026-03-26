import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);

    const q = searchParams.get("q");
    const party = searchParams.get("party");
    const era = searchParams.get("era");
    const archived = searchParams.get("archived");

    let query = `
      SELECT
        p.id,
        p.title,
        p.policy_type,
        p.year_enacted,
        p.status,
        p.impact_direction,
        p.is_archived,
        pa.name AS primary_party,
        e.name AS era
      FROM policies p
      LEFT JOIN parties pa ON p.primary_party_id = pa.id
      LEFT JOIN eras e ON p.era_id = e.id
      WHERE 1=1
    `;

    const params = [];

    if (q) {
      query += ` AND p.title LIKE ?`;
      params.push(`%${q}%`);
    }

    if (party) {
      query += ` AND pa.name = ?`;
      params.push(party);
    }

    if (era) {
      query += ` AND e.name = ?`;
      params.push(era);
    }

    if (archived === "true") {
      query += ` AND p.is_archived = 1`;
    } else if (archived === "false") {
      query += ` AND p.is_archived = 0`;
    }

    query += ` ORDER BY p.is_archived ASC, p.year_enacted DESC, p.id DESC`;

    const [rows] = await db.query(query, params);

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching admin policy list:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin policy list" },
      { status: 500 }
    );
  }
}
