import { NextResponse } from "next/server";
import { getCommandCenterSummary } from "@/lib/server/admin-operator/workflowData.js";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    success: true,
    generatedAt: new Date().toISOString(),
    summary: await getCommandCenterSummary(),
  });
}
