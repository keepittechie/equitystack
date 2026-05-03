import { NextResponse } from "next/server";
import { getOverallSummary } from "@/lib/services/reportService";

export async function GET() {
  try {
    const data = await getOverallSummary();
    return NextResponse.json(data);
  } catch (error) {
    console.error("overall-summary error:", error);
    return NextResponse.json(
      { error: "Failed to load overall summary" },
      { status: 500 }
    );
  }
}
