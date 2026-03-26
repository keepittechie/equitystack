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
        created_at
      FROM explainers
      WHERE published = 1
      ORDER BY created_at DESC, title ASC
      LIMIT 3
    `);

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching featured explainers:", error);
    return NextResponse.json(
      { error: "Failed to fetch featured explainers" },
      { status: 500 }
    );
  }
}
