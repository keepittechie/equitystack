import { NextResponse } from "next/server";
import { fetchCurrentAdministrationRolloutParityReport } from "@/lib/services/promiseService";

export async function GET() {
  try {
    const report = await fetchCurrentAdministrationRolloutParityReport();
    return NextResponse.json({
      success: true,
      data: report,
      error: null,
      ...report,
    });
  } catch (error) {
    console.error("current-admin parity report error:", error);
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: {
          message: "Failed to build current-admin rollout parity report.",
          code: "current_admin_parity_report_failed",
        },
      },
      { status: 500 }
    );
  }
}
