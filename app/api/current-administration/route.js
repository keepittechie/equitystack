import { NextResponse } from "next/server";
import { fetchCurrentAdministrationOverview } from "@/lib/services/promiseService";

export async function GET() {
  try {
    const overview = await fetchCurrentAdministrationOverview();

    if (!overview) {
      return NextResponse.json({ error: "Current administration not found" }, { status: 404 });
    }

    return NextResponse.json(overview);
  } catch (error) {
    console.error("Error fetching current administration overview:", error);
    return NextResponse.json(
      { error: "Failed to fetch current administration overview" },
      { status: 500 }
    );
  }
}
