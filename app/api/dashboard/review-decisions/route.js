import { NextResponse } from "next/server";
import { getCurrentAdministrationDecisionMetrics } from "@/lib/services/currentAdministrationReviewInsightsService";

export async function GET() {
  try {
    const data = await getCurrentAdministrationDecisionMetrics();
    return NextResponse.json(data);
  } catch (error) {
    console.error("dashboard review-decisions error:", error);
    return NextResponse.json(
      { error: "Failed to load current-admin review decision metrics" },
      { status: 500 }
    );
  }
}

