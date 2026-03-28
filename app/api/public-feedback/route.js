import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { recordPublicFeedback } from "@/lib/public-observability";

export async function POST(request) {
  try {
    const body = await request.json();
    const headerStore = await headers();

    if (typeof body.helpful !== "boolean") {
      return NextResponse.json({ error: "Helpful value is required" }, { status: 400 });
    }

    await recordPublicFeedback({
      pagePath: String(body.page_path || "/"),
      routeKind: body.route_kind ? String(body.route_kind) : null,
      entityType: body.entity_type ? String(body.entity_type) : null,
      entityKey: body.entity_key ? String(body.entity_key) : null,
      helpful: body.helpful,
      notes: body.notes ? String(body.notes).slice(0, 2000) : null,
      referrer: request.headers.get("referer") || body.referrer || null,
      userAgent: headerStore.get("user-agent") || null,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error recording public feedback:", error);
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
}
