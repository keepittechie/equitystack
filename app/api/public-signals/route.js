import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { recordPublicSignal } from "@/lib/public-observability";

export async function POST(request) {
  try {
    const body = await request.json();
    const headerStore = await headers();

    await recordPublicSignal({
      eventType: String(body.event_type || "unknown"),
      pagePath: String(body.page_path || "/"),
      routeKind: body.route_kind ? String(body.route_kind) : null,
      entityType: body.entity_type ? String(body.entity_type) : null,
      entityKey: body.entity_key ? String(body.entity_key) : null,
      targetPath: body.target_path ? String(body.target_path) : null,
      referrer: request.headers.get("referer") || body.referrer || null,
      userAgent: headerStore.get("user-agent") || null,
      metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : null,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error recording public signal:", error);
    return NextResponse.json({ ok: false }, { status: 202 });
  }
}
