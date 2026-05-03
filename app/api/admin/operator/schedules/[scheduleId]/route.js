import { NextResponse } from "next/server";
import { getOperatorSchedule, updateOperatorSchedule } from "@/lib/server/admin-operator/schedulerService.js";

export const dynamic = "force-dynamic";

function jsonError(message, status = 500) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET(_request, { params }) {
  try {
    const resolved = await params;
    const schedule = await getOperatorSchedule(resolved.scheduleId);
    return NextResponse.json({
      success: true,
      schedule,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to read the operator schedule.",
      404
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return jsonError("Requests must use application/json.", 415);
    }
    const resolved = await params;
    const body = await request.json();
    const schedule = await updateOperatorSchedule(resolved.scheduleId, body || {});
    return NextResponse.json({
      success: true,
      schedule,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to update the operator schedule.",
      400
    );
  }
}
