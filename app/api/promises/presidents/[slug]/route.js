import { NextResponse } from "next/server";
import { fetchPromisePresidentDetail } from "@/lib/services/promiseService";

function isPromiseTrackerSchemaMissing(error) {
  return error?.code === "ER_NO_SUCH_TABLE" || error?.errno === 1146;
}

export async function GET(request, { params }) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const showAll = searchParams.get("show_all") === "1";
    const president = await fetchPromisePresidentDetail(slug, { showAll });

    if (!president) {
      return NextResponse.json({ error: "President not found" }, { status: 404 });
    }

    return NextResponse.json(president);
  } catch (error) {
    if (isPromiseTrackerSchemaMissing(error)) {
      return NextResponse.json({ error: "President not found" }, { status: 404 });
    }

    console.error("Error fetching promise president:", error);
    return NextResponse.json(
      { error: "Failed to fetch promise president" },
      { status: 500 }
    );
  }
}
