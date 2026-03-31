import { NextResponse } from "next/server";
import {
  createOperatorSchedule,
  listOperatorSchedules,
  listSchedulableActions,
} from "@/lib/server/admin-operator/schedulerService.js";

export const dynamic = "force-dynamic";

function jsonError(message, status = 500) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET() {
  const [schedules, schedulableActions] = await Promise.all([
    listOperatorSchedules(),
    listSchedulableActions(),
  ]);

  return NextResponse.json({
    success: true,
    generatedAt: new Date().toISOString(),
    schedules,
    schedulableActions,
  });
}

export async function POST(request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return jsonError("Requests must use application/json.", 415);
    }
    const body = await request.json();
    const schedule = await createOperatorSchedule(body || {});
    return NextResponse.json({
      success: true,
      schedule,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to create the operator schedule.",
      400
    );
  }
}
