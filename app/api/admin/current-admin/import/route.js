import { NextResponse } from "next/server";
import { runCurrentAdministrationImport } from "@/lib/services/currentAdministrationWorkflowRuntimeService";

export async function POST(request) {
  try {
    const body = await request.json();
    if (!body?.queuePath) {
      return NextResponse.json(
        { error: "queuePath is required." },
        { status: 400 }
      );
    }

    const mode = body.mode === "apply" ? "apply" : "dry-run";
    if (mode === "apply" && body.confirmed !== true) {
      return NextResponse.json(
        { error: "Apply import requires explicit confirmation." },
        { status: 400 }
      );
    }

    const result = await runCurrentAdministrationImport({
      queuePath: body.queuePath,
      apply: mode === "apply",
    });

    return NextResponse.json({
      success: true,
      mode,
      command: result.command,
      stdout: result.stdout,
      stderr: result.stderr,
      workspace: result.workspace,
    });
  } catch (error) {
    console.error("current-admin import action error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to run current-admin import." },
      { status: 500 }
    );
  }
}
