import { NextResponse } from "next/server";
import { listSerializedWorkflows } from "@/lib/server/admin-operator/workflowRegistry.js";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    success: true,
    workflows: listSerializedWorkflows(),
  });
}
