import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();

    const [rows] = await db.query(`
      SELECT
        id,
        slug,
        title,
        category,
        summary,
        published,
        created_at,
        updated_at
      FROM explainers
      WHERE published = 1
      ORDER BY created_at DESC, title ASC
    `);

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching explainers:", error);
    return NextResponse.json(
      { error: "Failed to fetch explainers" },
      { status: 500 }
    );
  }
}
