import { after, NextResponse } from "next/server";
import {
  createRegisteredActionJob,
  listBrokerJobs,
  runRegisteredActionJob,
} from "@/lib/server/admin-operator/commandBroker.js";

export const dynamic = "force-dynamic";
export const maxDuration = 3600;

function jsonError(message, status = 500) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET(request) {
  const limit = Number(request.nextUrl.searchParams.get("limit") || 25);
  const jobs = await listBrokerJobs({ limit });
  return NextResponse.json({
    success: true,
    jobs,
  });
}

export async function POST(request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return jsonError("Requests must use application/json.", 415);
    }

    const body = await request.json();
    if (body?.input && (typeof body.input !== "object" || Array.isArray(body.input))) {
      return jsonError("Job input must be a JSON object.", 400);
    }
    if (body?.context && (typeof body.context !== "object" || Array.isArray(body.context))) {
      return jsonError("Job context must be a JSON object.", 400);
    }
    const context =
      body?.context && typeof body.context === "object" && !Array.isArray(body.context)
        ? body.context
        : {};
    const result = await createRegisteredActionJob({
      actionId: body?.actionId,
      input: body?.input || {},
      context,
      executionMode: body?.executionMode,
    });

    after(async () => {
      try {
        await runRegisteredActionJob(result.job.id);
      } catch (error) {
        console.error("admin operator job execution error:", error);
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
    return jsonError(error instanceof Error ? error.message : "Failed to start the operator action.");
  }
}
