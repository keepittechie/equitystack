import { NextResponse } from "next/server";
import { listReviewQueueItems } from "@/lib/server/admin-operator/workflowData.js";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = await listReviewQueueItems();
  return NextResponse.json({
    success: true,
    generatedAt: new Date().toISOString(),
    counts: {
      total: items.length,
      pendingReview: items.filter((item) => item.state === "pending_review").length,
      blocked: items.filter((item) => item.state === "blocked").length,
    },
    items,
  });
}
