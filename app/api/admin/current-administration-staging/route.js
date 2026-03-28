import { NextResponse } from "next/server";
import { listStagedCurrentAdministrationItems } from "@/lib/services/currentAdministrationStagingService";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || null;
    const presidentId = searchParams.get("president_id");
    const limit = searchParams.get("limit");

    const items = await listStagedCurrentAdministrationItems({
      status,
      presidentId,
      limit,
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error fetching current-administration staging items:", error);
    return NextResponse.json(
      { error: "Failed to fetch current-administration staging items" },
      { status: 500 }
    );
  }
}
