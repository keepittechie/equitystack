import { NextResponse } from "next/server";
import { runLegislativeImport } from "@/lib/services/legislativeWorkflowRuntimeService";

export async function POST(request) {
  try {
    const body = await request.json();
    const mode = body?.mode === "apply" ? "apply" : "dry-run";
    if (mode === "apply" && body.confirmed !== true) {
      return NextResponse.json(
        { error: "Applying the legislative import requires explicit confirmation." },
        { status: 400 }
      );
    }

    const result = await runLegislativeImport({ mode });

    return NextResponse.json({
      success: true,
      mode,
      command: result.command,
      stdout: result.stdout,
      stderr: result.stderr,
      workspace: result.workspace,
    });
  } catch (error) {
    console.error("legislative import action error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to run legislative import." },
      { status: 500 }
    );
  }
}
