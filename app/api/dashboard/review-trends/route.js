import { NextResponse } from "next/server";
import { getCurrentAdministrationReviewTrends } from "@/lib/services/currentAdministrationReviewInsightsService";

export async function GET() {
  try {
    const data = await getCurrentAdministrationReviewTrends();
    return NextResponse.json(data);
  } catch (error) {
    console.error("dashboard review-trends error:", error);
    return NextResponse.json(
      { error: "Failed to load current-admin review trends" },
      { status: 500 }
    );
  }
}

