import { NextResponse } from "next/server";
import { runLegislativeApply } from "@/lib/services/legislativeWorkflowRuntimeService";

export async function POST(request) {
  try {
    const body = await request.json();
    const mode = body?.mode === "apply" ? "apply" : "dry-run";
    if (mode === "apply" && body.confirmed !== true) {
      return NextResponse.json(
        { error: "Applying legislative actions requires explicit confirmation." },
        { status: 400 }
      );
    }

    const result = await runLegislativeApply({ mode });

    return NextResponse.json({
      success: true,
      mode,
      command: result.command,
      stdout: result.stdout,
      stderr: result.stderr,
      workspace: result.workspace,
    });
  } catch (error) {
    console.error("legislative apply action error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to run legislative apply." },
      { status: 500 }
    );
  }
}
