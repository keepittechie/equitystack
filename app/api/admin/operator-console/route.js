import { after, NextResponse } from "next/server";
import {
  executeOperatorConsoleRequest,
  getOperatorConsoleJobState,
  getOperatorConsoleState,
  runOperatorConsoleExecutionJob,
} from "@/lib/services/operatorConsoleService";

export const dynamic = "force-dynamic";
export const maxDuration = 3600;

function jsonError(message, status = 500, extra = {}) {
  return NextResponse.json(
    {
      error: message || "Failed to run the operator console action.",
      ...extra,
    },
    { status }
  );
}

export async function POST(request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return jsonError("Operator console requests must use application/json.", 415);
    }

    const body = await request.json();
    const result = await executeOperatorConsoleRequest({
      actionId: body?.actionId,
      message: body?.message,
    });

    if (result?.mode === "async" && result?.async_job?.id) {
      const executionId = result.async_job.id;
      after(async () => {
        try {
          await runOperatorConsoleExecutionJob(executionId);
        } catch (error) {
          console.error("operator console async job error:", error);
        }
      });
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("operator console action error:", error);
    return jsonError(error.message || "Failed to run the operator console action.", 500);
  }
}

export async function GET(request) {
  try {
    const executionId = request.nextUrl.searchParams.get("job_id") || "";
    if (executionId) {
      const result = await getOperatorConsoleJobState(executionId);
      return NextResponse.json({
        success: true,
        ...result,
      });
    }

    const state = await getOperatorConsoleState();
    return NextResponse.json({
      success: true,
      ...state,
    });
  } catch (error) {
    console.error("operator console state error:", error);
    return jsonError(error.message || "Failed to load operator console state.", 500);
  }
}
