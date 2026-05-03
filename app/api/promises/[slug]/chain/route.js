import { NextResponse } from "next/server";
import { getFullPromiseChainBySlug } from "@/lib/services/promiseService";

export async function GET(request, { params }) {
  try {
    const { slug } = await params;
    const chain = await getFullPromiseChainBySlug(slug);

    if (!chain) {
      return NextResponse.json({ error: "Promise not found" }, { status: 404 });
    }

    return NextResponse.json(chain);
  } catch (error) {
    if (error?.digest === "NEXT_HTTP_ERROR_FALLBACK;404") {
      return NextResponse.json({ error: "Promise not found" }, { status: 404 });
    }

    console.error("Error fetching promise chain:", error);
    return NextResponse.json(
      { error: "Failed to fetch promise chain" },
      { status: 500 }
    );
  }
}
