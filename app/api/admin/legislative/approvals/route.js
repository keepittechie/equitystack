import { NextResponse } from "next/server";
import { saveLegislativeApprovals } from "@/lib/services/legislativeWorkflowRuntimeService";

export async function POST(request) {
  try {
    const body = await request.json();
    if (!body?.bundlePath) {
      return NextResponse.json(
        { error: "bundlePath is required." },
        { status: 400 }
      );
    }

    const result = await saveLegislativeApprovals({
      bundlePath: body.bundlePath,
      actionUpdates: body.actionUpdates || [],
    });

    return NextResponse.json({
      success: true,
      bundlePath: result.bundlePath,
      workspace: result.workspace,
    });
  } catch (error) {
    console.error("save legislative approvals error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save legislative approvals." },
      { status: 500 }
    );
  }
}
