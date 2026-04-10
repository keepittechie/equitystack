import { NextResponse } from "next/server";
import { fetchPromisePresidentIndex } from "@/lib/services/promiseService";

function isPromiseTrackerSchemaMissing(error) {
  return error?.code === "ER_NO_SUCH_TABLE" || error?.errno === 1146;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const showAll = searchParams.get("show_all") !== "0";
    const items = await fetchPromisePresidentIndex({ showAll });
    return NextResponse.json({
      items,
      curation: {
        show_all: showAll,
        default_scope: showAll ? "Full public promise dataset" : "High and Medium relevance",
      },
    });
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
