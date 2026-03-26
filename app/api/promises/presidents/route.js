import { NextResponse } from "next/server";
import { fetchPromisePresidentIndex } from "@/lib/services/promiseService";

function isPromiseTrackerSchemaMissing(error) {
  return error?.code === "ER_NO_SUCH_TABLE" || error?.errno === 1146;
}

export async function GET() {
  try {
    const items = await fetchPromisePresidentIndex();
    return NextResponse.json({ items });
  } catch (error) {
    if (isPromiseTrackerSchemaMissing(error)) {
      return NextResponse.json({ items: [] });
    }

    console.error("Error fetching promise presidents:", error);
    return NextResponse.json(
      { error: "Failed to fetch promise presidents" },
      { status: 500 }
    );
  }
}
