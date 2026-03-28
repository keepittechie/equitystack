import { NextResponse } from "next/server";
import { finalizeCurrentAdministrationDecisions } from "@/lib/services/currentAdministrationWorkflowRuntimeService";

export async function POST(request) {
  try {
    const body = await request.json();
    if (!body?.reviewPath) {
      return NextResponse.json(
        { error: "reviewPath is required." },
        { status: 400 }
      );
    }

    const result = await finalizeCurrentAdministrationDecisions({
      reviewPath: body.reviewPath,
      decisionItems: body.decisionItems || [],
    });

    return NextResponse.json({
      success: true,
      command: result.command,
      stdout: result.stdout,
      stderr: result.stderr,
      decisionFilePath: result.decisionFilePath,
      latestDecisionLogPath: result.latestDecisionLogPath,
      workspace: result.workspace,
    });
  } catch (error) {
    console.error("finalize current-admin decisions error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to finalize decisions." },
      { status: 500 }
    );
  }
}
