import { NextResponse } from "next/server";
import { fetchPromiseScoreSummaries } from "@/lib/services/promiseService";

function isPromiseTrackerSchemaMissing(error) {
  return error?.code === "ER_NO_SUCH_TABLE" || error?.errno === 1146;
}

export async function GET() {
  try {
    const data = await fetchPromiseScoreSummaries();
    return NextResponse.json(data);
  } catch (error) {
    if (isPromiseTrackerSchemaMissing(error)) {
      return NextResponse.json({
        methodology: null,
        items: [],
      });
    }

    console.error("Error fetching promise scores:", error);
    return NextResponse.json(
      { error: "Failed to fetch promise scores" },
      { status: 500 }
    );
  }
}
