import { NextResponse } from "next/server";
import {
  createEntityDemographicImpact,
  fetchEntityDemographicImpacts,
} from "@/lib/services/entityDemographicImpactService";

function jsonError(message, code = "entity_demographic_impacts_failed", status = 500, data = null) {
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

function parseBooleanFlag(value) {
  if (typeof value !== "string") {
    return false;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export async function GET(request) {
  try {
    const entityType = request.nextUrl.searchParams.get("entity_type");
    const entityId = request.nextUrl.searchParams.get("entity_id");
    const includeSources = parseBooleanFlag(
      request.nextUrl.searchParams.get("include_sources")
    );

    if (!entityType || !entityId) {
      return jsonError(
        "entity_type and entity_id are required.",
        "entity_demographic_impacts_query_required",
        400
      );
    }

    const impacts = await fetchEntityDemographicImpacts(entityType, entityId, {
      includeSources,
    });

    return NextResponse.json({
      success: true,
      data: {
        entity_type: entityType,
        entity_id: Number(entityId),
        include_sources: includeSources,
        items: impacts,
      },
      error: null,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to fetch entity demographic impacts.",
      error && typeof error === "object" && typeof error.code === "string"
        ? error.code
        : "entity_demographic_impacts_fetch_failed",
      error && typeof error === "object" && Number.isFinite(error.status)
        ? Number(error.status)
        : 500
    );
  }
}

export async function POST(request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return jsonError(
        "Requests must use application/json.",
        "entity_demographic_impacts_invalid_content_type",
        415
      );
    }

    const body = await request.json();
    const impact = await createEntityDemographicImpact(body);

    return NextResponse.json(
      {
        success: true,
        data: impact,
        error: null,
      },
      { status: 201 }
    );
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to create entity demographic impact.",
      error && typeof error === "object" && typeof error.code === "string"
        ? error.code
        : "entity_demographic_impacts_create_failed",
      error && typeof error === "object" && Number.isFinite(error.status)
        ? Number(error.status)
        : 500
    );
  }
}
