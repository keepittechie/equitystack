import { NextResponse } from "next/server";
import { getWorkflowSessionDetail } from "@/lib/server/admin-operator/workflowData.js";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  try {
    const resolved = await params;
    const detail = await getWorkflowSessionDetail(resolved.sessionId);
    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      ...detail,
      counts: {
        relatedJobs: detail.relatedJobs.length,
        artifacts: detail.artifacts.length,
        reviewQueueItems: detail.reviewQueueItems.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to read the workflow session.",
      },
      { status: 404 }
    );
  }
}
