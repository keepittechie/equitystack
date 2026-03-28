import { NextResponse } from "next/server";
import { runCurrentAdministrationPrecommit } from "@/lib/services/currentAdministrationWorkflowRuntimeService";

export async function POST(request) {
  try {
    const body = await request.json();
    if (!body?.queuePath) {
      return NextResponse.json(
        { error: "queuePath is required." },
        { status: 400 }
      );
    }

    const result = await runCurrentAdministrationPrecommit({
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
    console.error("current-admin pre-commit action error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to run pre-commit review." },
      { status: 500 }
    );
  }
}
