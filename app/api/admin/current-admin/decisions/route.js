import { NextResponse } from "next/server";
import { saveCurrentAdministrationDecisionDraft } from "@/lib/services/currentAdministrationWorkflowRuntimeService";

export async function POST(request) {
  try {
    const body = await request.json();
    if (!body?.reviewPath) {
      return NextResponse.json(
        { error: "reviewPath is required." },
        { status: 400 }
      );
    }

    const result = await saveCurrentAdministrationDecisionDraft({
      reviewPath: body.reviewPath,
      decisionItems: body.decisionItems || [],
    });

    return NextResponse.json({
      success: true,
      outputPath: result.outputPath,
      payload: result.payload,
    });
  } catch (error) {
    console.error("save current-admin decisions error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save decision draft." },
      { status: 500 }
    );
  }
}
