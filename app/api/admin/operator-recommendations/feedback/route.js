import { NextResponse } from "next/server";
import {
  appendOperatorRecommendationFeedback,
  getOperatorRecommendationFeedbackSummary,
} from "@/lib/operator/operatorRecommendationFeedback.js";

export async function POST(request) {
  try {
    const body = await request.json();
    await appendOperatorRecommendationFeedback({
      recommendation_id: body?.recommendationId,
      feedback: body?.feedback,
      source: "web_admin",
    });

    const summaryById = await getOperatorRecommendationFeedbackSummary();
    const summary = summaryById.get(body?.recommendationId) || null;

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error("recommendation feedback error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to record recommendation feedback." },
      { status: 400 }
    );
  }
}
