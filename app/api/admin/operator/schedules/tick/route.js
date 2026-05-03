import { after, NextResponse } from "next/server";
import { runRegisteredActionJob } from "@/lib/server/admin-operator/commandBroker.js";
import { runDueSchedules } from "@/lib/server/admin-operator/schedulerService.js";

export const dynamic = "force-dynamic";
export const maxDuration = 3600;

function jsonError(message, status = 500) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    const body =
      contentType.toLowerCase().includes("application/json") ? await request.json() : {};
    const result = await runDueSchedules({
      limit: Number(body?.limit || 10),
    });

    after(async () => {
      await Promise.all(
        result.queued.map(async (entry) => {
          try {
            await runRegisteredActionJob(entry.job.id);
          } catch (error) {
            console.error("operator schedule tick job error:", error);
          }
        })
      );
    });

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to execute the schedule tick.",
      400
    );
  }
}
