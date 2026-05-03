import { NextResponse } from "next/server";
import { getDirectImpactSummaryByParty } from "@/lib/services/reportService";

export async function GET() {
  try {
    const data = await getDirectImpactSummaryByParty();
    return NextResponse.json(data);
  } catch (error) {
    console.error("direct-impact-by-party error:", error);
    return NextResponse.json(
      { error: "Failed to load direct impact by party" },
      { status: 500 }
    );
  }
}
