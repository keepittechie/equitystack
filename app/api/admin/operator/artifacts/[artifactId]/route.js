import { NextResponse } from "next/server";
import { getArtifactDetail } from "@/lib/server/admin-operator/workflowData.js";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  try {
    const resolved = await params;
    const artifact = await getArtifactDetail(resolved.artifactId);
    return NextResponse.json({
      success: true,
      artifact,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to read the artifact.",
      },
      { status: 404 }
    );
  }
}
