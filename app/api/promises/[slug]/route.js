import { NextResponse } from "next/server";
import { fetchPromiseDetail } from "@/lib/services/promiseService";

function isPromiseTrackerSchemaMissing(error) {
  return error?.code === "ER_NO_SUCH_TABLE" || error?.errno === 1146;
}

export async function GET(request, { params }) {
  try {
    const { slug } = await params;
    const promise = await fetchPromiseDetail(slug);

    if (!promise) {
      return NextResponse.json({ error: "Promise not found" }, { status: 404 });
    }

    return NextResponse.json(promise);
  } catch (error) {
    if (isPromiseTrackerSchemaMissing(error)) {
      return NextResponse.json({ error: "Promise not found" }, { status: 404 });
    }

    console.error("Error fetching promise:", error);
    return NextResponse.json(
      { error: "Failed to fetch promise" },
      { status: 500 }
    );
  }
}
