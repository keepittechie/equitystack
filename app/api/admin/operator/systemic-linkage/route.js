import { NextResponse } from "next/server";
import { getSystemicLinkageOperatorReport } from "@/lib/server/admin-operator/systemicLinkageReport.js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const report = await getSystemicLinkageOperatorReport();
    return NextResponse.json({
      success: true,
      data: { report },
      error: null,
      report,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: {
          code: "systemic_linkage_report_failed",
          message: error instanceof Error ? error.message : "Failed to build the systemic linkage report.",
        },
      },
      { status: 500 }
    );
  }
}
