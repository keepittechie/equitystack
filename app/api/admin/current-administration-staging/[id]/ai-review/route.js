import { NextResponse } from "next/server";
import {
  generateAiReviewForStagedItem,
  getAiReviewForStagedItem,
} from "@/lib/services/currentAdministrationAiReviewService";

export async function GET(request, context) {
  try {
    const { id } = await context.params;
    const review = await getAiReviewForStagedItem(id);

    if (!review) {
      return NextResponse.json({ review: null });
    }

    return NextResponse.json({ review });
  } catch (error) {
    const message = error?.message || "Failed to fetch AI review";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request, context) {
  try {
    const { id } = await context.params;
    const review = await generateAiReviewForStagedItem(id);
    return NextResponse.json({ review });
  } catch (error) {
    const message = error?.message || "Failed to generate AI review";
    const status = /not found/i.test(message) ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
