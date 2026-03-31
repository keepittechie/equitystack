import { after, NextResponse } from "next/server";
import {
  rerunBrokerJob,
  runRegisteredActionJob,
} from "@/lib/server/admin-operator/commandBroker.js";

export const dynamic = "force-dynamic";
export const maxDuration = 3600;

function jsonError(message, status = 500) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(request, { params }) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return jsonError("Requests must use application/json.", 415);
    }

    const resolved = await params;
    const body = await request.json();
    const confirmation =
      body?.confirmation && typeof body.confirmation === "object" && !Array.isArray(body.confirmation)
        ? body.confirmation
        : {};
    const result = await rerunBrokerJob(resolved.jobId, { confirmation });

    if (result.mode === "confirmation_required") {
      return NextResponse.json({
        success: true,
        mode: "confirmation_required",
        ...result,
      });
    }

    after(async () => {
      try {
        await runRegisteredActionJob(result.job.id);
      } catch (error) {
        console.error("admin operator job rerun error:", error);
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
    return jsonError(error instanceof Error ? error.message : "Failed to rerun the operator job.");
  }
}
