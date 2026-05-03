import { NextResponse } from "next/server";
import { getCurrentAdministrationWorkflowGuide } from "@/lib/services/currentAdministrationReviewInsightsService";

// Read-only dashboard handoff for the canonical Python current-admin pipeline.
// This route surfaces file paths and next commands only; it must not trigger
// review generation, imports, or decision writes.

export async function GET() {
  try {
    const data = await getCurrentAdministrationWorkflowGuide();
    return NextResponse.json(data);
  } catch (error) {
    console.error("dashboard review-workflow error:", error);
    return NextResponse.json(
      { error: "Failed to load current-admin pipeline guide" },
      { status: 500 }
    );
  }
}
