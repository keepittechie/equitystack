import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();

    const [eras] = await db.query(`
      SELECT id, name
      FROM eras
      ORDER BY start_year ASC
    `);

    const [parties] = await db.query(`
      SELECT id, name, abbreviation
      FROM parties
      ORDER BY name ASC
    `);

    const [presidents] = await db.query(`
      SELECT id, full_name
      FROM presidents
      ORDER BY term_start ASC
    `);

    const [categories] = await db.query(`
      SELECT id, name
      FROM policy_categories
      ORDER BY name ASC
    `);

    return NextResponse.json({
      eras,
      parties,
      presidents,
      categories,
    });
  } catch (error) {
    console.error("Error fetching admin lookups:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin lookups" },
      { status: 500 }
    );
  }
}
