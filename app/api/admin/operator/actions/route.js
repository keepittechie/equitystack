import { NextResponse } from "next/server";
import { listSerializedOperatorActions } from "@/lib/server/admin-operator/actionRegistry.js";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    success: true,
    actions: listSerializedOperatorActions(),
  });
}
