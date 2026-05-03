import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSummaryByEra } from "@/lib/services/reportService";

export async function GET() {
  try {
    const db = getDb();

    const summaryRows = await getSummaryByEra();

    const [eraRows] = await db.query(`
      SELECT
        name,
        start_year,
        end_year
      FROM eras
      ORDER BY start_year ASC
    `);

    const eraMap = {};
    for (const row of eraRows) {
      eraMap[row.name] = row;
    }

    const merged = summaryRows.map((row) => ({
      ...row,
      start_year: eraMap[row.name]?.start_year ?? null,
      end_year: eraMap[row.name]?.end_year ?? null,
    }));

    return NextResponse.json(merged);
  } catch (error) {
    console.error("Error fetching era summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch era summary" },
      { status: 500 }
    );
  }
}
