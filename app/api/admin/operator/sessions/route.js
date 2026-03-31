import { NextResponse } from "next/server";
import { listWorkflowSessions } from "@/lib/server/admin-operator/workflowData.js";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessions = await listWorkflowSessions();
  return NextResponse.json({
    success: true,
    generatedAt: new Date().toISOString(),
    counts: {
      total: sessions.length,
      active: sessions.filter((session) => session.active).length,
    },
    sessions,
  });
}
