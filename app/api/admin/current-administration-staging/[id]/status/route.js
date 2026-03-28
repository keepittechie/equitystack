import { NextResponse } from "next/server";
import { updateStagedCurrentAdministrationItemReviewStatus } from "@/lib/services/currentAdministrationStagingService";

export async function PATCH(request, context) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const item = await updateStagedCurrentAdministrationItemReviewStatus(id, {
      status: body?.status,
      reviewNotes: body?.review_notes,
    });

    return NextResponse.json({ item });
  } catch (error) {
    const message = error?.message || "Failed to update review status";
    const status = /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
