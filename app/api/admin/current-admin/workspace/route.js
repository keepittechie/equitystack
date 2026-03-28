import { NextResponse } from "next/server";
import { getCurrentAdministrationOperatorWorkspace } from "@/lib/services/currentAdministrationReviewInsightsService";

export async function GET() {
  try {
    const payload = await getCurrentAdministrationOperatorWorkspace();
    return NextResponse.json(payload);
  } catch (error) {
    console.error("current-admin workspace error:", error);
    return NextResponse.json(
      { error: "Failed to load current-admin workspace." },
      { status: 500 }
    );
  }
}
