import { NextResponse } from "next/server";
import { getOperatorVerificationReport } from "@/lib/server/admin-operator/verificationService.js";

export const dynamic = "force-dynamic";

function jsonError(message, status = 500) {
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: {
        message,
        code: "operator_verification_failed",
      },
    },
    { status }
  );
}

export async function GET(request) {
  try {
    const scope = request.nextUrl.searchParams.get("scope") || "environment";
    const report = await getOperatorVerificationReport(scope);
    return NextResponse.json({
      success: true,
      data: { report },
      error: null,
      report,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to run operator verification.",
      500
    );
  }
}
