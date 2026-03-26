import { NextResponse } from "next/server";
import { getDirectImpactSummaryByEra } from "@/lib/services/reportService";

export async function GET() {
  try {
    const data = await getDirectImpactSummaryByEra();
    return NextResponse.json(data);
  } catch (error) {
    console.error("direct-impact-by-era error:", error);
    return NextResponse.json(
      { error: "Failed to load direct impact by era" },
      { status: 500 }
    );
  }
}
