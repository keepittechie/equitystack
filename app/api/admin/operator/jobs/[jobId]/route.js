import { NextResponse } from "next/server";
import { getBrokerJob } from "@/lib/server/admin-operator/commandBroker.js";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  try {
    const resolved = await params;
    const job = await getBrokerJob(resolved.jobId);
    return NextResponse.json({
      success: true,
      job,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to read the job.",
      },
      { status: 404 }
    );
  }
}
