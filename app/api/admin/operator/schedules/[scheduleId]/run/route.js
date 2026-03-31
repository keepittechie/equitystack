import { after, NextResponse } from "next/server";
import { runRegisteredActionJob } from "@/lib/server/admin-operator/commandBroker.js";
import { runScheduleNow } from "@/lib/server/admin-operator/schedulerService.js";

export const dynamic = "force-dynamic";
export const maxDuration = 3600;

function jsonError(message, status = 500) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(_request, { params }) {
  try {
    const resolved = await params;
    let body = {};
    try {
      body = await _request.json();
    } catch {
      body = {};
    }
    const result = await runScheduleNow(resolved.scheduleId, {
      executionMode: typeof body?.executionMode === "string" ? body.executionMode : "",
    });

    after(async () => {
      try {
        await runRegisteredActionJob(result.job.id);
      } catch (error) {
        console.error("operator schedule manual run error:", error);
      }
    });

    return NextResponse.json(
      {
        success: true,
        mode: "async",
        ...result,
      },
      { status: 202 }
    );
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to run the operator schedule.",
      400
    );
  }
}
