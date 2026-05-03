import { NextResponse } from "next/server";
import { runCurrentAdministrationValidation } from "@/lib/services/currentAdministrationWorkflowRuntimeService";

export async function POST(request) {
  try {
    const body = await request.json();
    if (!body?.queuePath) {
      return NextResponse.json(
        { error: "queuePath is required." },
        { status: 400 }
      );
    }

    const result = await runCurrentAdministrationValidation({
      queuePath: body.queuePath,
    });

    return NextResponse.json({
      success: true,
      command: result.command,
      stdout: result.stdout,
      stderr: result.stderr,
      workspace: result.workspace,
    });
  } catch (error) {
    console.error("current-admin validate action error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to validate current-admin import." },
      { status: 500 }
    );
  }
}
