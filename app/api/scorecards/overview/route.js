import { NextResponse } from "next/server";
import { getScorecardOverview } from "@/lib/services/scorecardService";

export async function GET() {
  try {
    const data = await getScorecardOverview();
    return NextResponse.json(data);
  } catch (error) {
    console.error("scorecards overview error:", error);
    return NextResponse.json(
      { error: "Failed to load scorecards overview" },
      { status: 500 }
    );
  }
}
