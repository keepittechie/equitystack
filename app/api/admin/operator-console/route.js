import { NextResponse } from "next/server";
import {
  executeOperatorConsoleRequest,
} from "@/lib/services/operatorConsoleService";

export async function POST(request) {
  try {
    const body = await request.json();
    const result = await executeOperatorConsoleRequest({
      actionId: body?.actionId,
      message: body?.message,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("operator console action error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to run the operator console action." },
      { status: 500 }
    );
  }
}
