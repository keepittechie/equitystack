import { NextResponse } from "next/server";
import { getCategorySummary } from "@/lib/services/reportService";

export async function GET() {
  try {
    const data = await getCategorySummary();
    return NextResponse.json(data);
  } catch (error) {
    console.error("category-summary error:", error);
    return NextResponse.json(
      { error: "Failed to load category summary" },
      { status: 500 }
    );
  }
}
