import { NextResponse } from "next/server";
import {
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
    const existingReview = await getAiReviewForStagedItem(id);
    return NextResponse.json(
      {
        error:
          "The staged-item AI review generator is deprecated. Use the canonical Python current-admin review pipeline to generate review artifacts, then use the dashboard as a read-only/admin surface.",
        review: existingReview,
      },
      { status: 410 }
    );
  } catch (error) {
    const message = error?.message || "Failed to generate AI review";
    const status = /not found/i.test(message) ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
