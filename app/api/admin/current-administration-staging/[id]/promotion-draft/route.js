import { NextResponse } from "next/server";
import { buildPromisePromotionDraftFromStagedItem } from "@/lib/services/currentAdministrationStagingService";

export async function GET(request, context) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const existingPromiseId = searchParams.get("existing_promise_id");

    const draft = await buildPromisePromotionDraftFromStagedItem(id, {
      existingPromiseId,
    });

    if (!draft) {
      return NextResponse.json({ error: "Staged item not found" }, { status: 404 });
    }

    return NextResponse.json(draft);
  } catch (error) {
    console.error("Error building promotion draft:", error);
    return NextResponse.json(
      { error: "Failed to build promotion draft" },
      { status: 500 }
    );
  }
}
