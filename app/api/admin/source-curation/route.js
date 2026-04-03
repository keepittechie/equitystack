import { NextResponse } from "next/server";
import {
  applySourceCurationAction,
  searchExistingSources,
} from "@/lib/services/sourceCurationService.js";

export const dynamic = "force-dynamic";

function jsonError(message, code = "source_curation_failed", status = 500, data = null) {
  return NextResponse.json(
    {
      success: false,
      data,
      error: {
        message,
        code,
        ...(data && typeof data === "object" ? data : {}),
      },
    },
    { status }
  );
}

export async function GET(request) {
  try {
    const query = request.nextUrl.searchParams.get("q") || "";
    const limit = Number(request.nextUrl.searchParams.get("limit") || 12);
    const promiseId = request.nextUrl.searchParams.get("promiseId");
    const relatedPolicyId = request.nextUrl.searchParams.get("relatedPolicyId");
    if (!query.trim()) {
      return jsonError(
        "A search query is required.",
        "source_curation_query_required",
        400
      );
    }

    const results = await searchExistingSources(query, {
      limit,
      promiseId: promiseId ? Number(promiseId) : null,
      relatedPolicyId: relatedPolicyId ? Number(relatedPolicyId) : null,
    });
    return NextResponse.json({
      success: true,
      data: {
        query,
        results,
      },
      error: null,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to search existing sources.",
      "source_curation_search_failed",
      500
    );
  }
}

export async function POST(request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return jsonError(
        "Requests must use application/json.",
        "source_curation_invalid_content_type",
        415
      );
    }

    const body = await request.json();
    const result = await applySourceCurationAction(body);
    return NextResponse.json({
      success: true,
      data: result,
      error: null,
    });
  } catch (error) {
    const status =
      error && typeof error === "object" && Number.isFinite(error.status)
        ? Number(error.status)
        : 500;
    const code =
      error && typeof error === "object" && typeof error.code === "string"
        ? error.code
        : "source_curation_save_failed";
    const data =
      error && typeof error === "object" && error.data && typeof error.data === "object"
        ? error.data
        : null;
    return jsonError(
      error instanceof Error ? error.message : "Failed to save the source-curation decision.",
      code,
      status,
      data
    );
  }
}
