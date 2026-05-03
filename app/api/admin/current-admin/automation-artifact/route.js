import { NextResponse } from "next/server";
import { readCurrentAdminAutomationArtifact } from "@/lib/services/currentAdministrationReviewInsightsService";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const batchName = request.nextUrl.searchParams.get("batchName") || "";
    const artifactKey = request.nextUrl.searchParams.get("artifactKey") || "";
    const artifact = await readCurrentAdminAutomationArtifact({
      batchName,
      artifactKey,
    });
    return NextResponse.json({
      success: true,
      artifact,
      error: null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        artifact: null,
        error: {
          message:
            error instanceof Error
              ? error.message
              : "Failed to load the current-admin automation artifact.",
          code: "current_admin_automation_artifact_failed",
        },
      },
      { status: 400 }
    );
  }
}
