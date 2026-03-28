import { NextResponse } from "next/server";
import { promoteStagedCurrentAdministrationItem } from "@/lib/services/currentAdministrationStagingService";

export async function POST(request, context) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const item = await promoteStagedCurrentAdministrationItem(id, {
      existingPromiseId: body?.existing_promise_id,
      reviewNotes: body?.review_notes,
    });

    return NextResponse.json({ item });
  } catch (error) {
    const message = error?.message || "Failed to promote staged item";
    const status = /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
