import { NextResponse } from "next/server";
import { listArtifacts } from "@/lib/server/admin-operator/workflowData.js";

export const dynamic = "force-dynamic";

export async function GET() {
  const artifacts = await listArtifacts();
  return NextResponse.json({
    success: true,
    generatedAt: new Date().toISOString(),
    counts: {
      total: artifacts.length,
      existing: artifacts.filter((artifact) => artifact.exists).length,
      missing: artifacts.filter((artifact) => !artifact.exists).length,
    },
    artifacts,
  });
}
