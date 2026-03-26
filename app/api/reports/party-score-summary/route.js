import { NextResponse } from "next/server";
import { getSummaryByParty } from "@/lib/services/reportService";

export async function GET() {
  try {
    const data = await getSummaryByParty();
    return NextResponse.json(data);
  } catch (error) {
    console.error("party-score-summary error:", error);
    return NextResponse.json(
      { error: "Failed to load party score summary" },
      { status: 500 }
    );
  }
}
