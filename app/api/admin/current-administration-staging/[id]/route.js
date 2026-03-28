import { NextResponse } from "next/server";
import { getStagedCurrentAdministrationItem } from "@/lib/services/currentAdministrationStagingService";

export async function GET(_request, context) {
  try {
    const { id } = await context.params;
    const item = await getStagedCurrentAdministrationItem(id);

    if (!item) {
      return NextResponse.json({ error: "Staged item not found" }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error("Error fetching current-administration staging item:", error);
    return NextResponse.json(
      { error: "Failed to fetch current-administration staging item" },
      { status: 500 }
    );
  }
}
