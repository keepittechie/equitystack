import { NextResponse } from "next/server";
import { fetchDashboardPolicyRankings } from "@/lib/services/dashboardPolicyService";

export async function GET() {
  try {
    const rankings = await fetchDashboardPolicyRankings();
    return NextResponse.json(rankings);
  } catch (error) {
    console.error("Error fetching top policies report:", error);
    return NextResponse.json(
      { error: "Failed to fetch top policies report" },
      { status: 500 }
    );
  }
}
