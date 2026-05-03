import { NextResponse } from "next/server";
import { getCurrentAdministrationReviewOverview } from "@/lib/services/currentAdministrationReviewInsightsService";

export async function GET() {
  try {
    const data = await getCurrentAdministrationReviewOverview();
    return NextResponse.json(data);
  } catch (error) {
    console.error("dashboard review-overview error:", error);
    return NextResponse.json(
      { error: "Failed to load current-admin review overview" },
      { status: 500 }
    );
  }
}

