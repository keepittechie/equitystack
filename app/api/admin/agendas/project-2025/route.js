import { NextResponse } from "next/server";
import { getAgendaReviewExportData } from "@/lib/agendas";

export const dynamic = "force-dynamic";

function normalizeScope(value) {
  const scope = String(value || "").trim().toLowerCase();

  if (["full", "gaps", "summary"].includes(scope)) {
    return scope;
  }

  return "full";
}

function buildPayload(exportData, scope) {
  if (scope === "gaps") {
    return {
      generated_at: exportData.generated_at,
      agenda: exportData.agenda,
      metrics: {
        unlinked_items: exportData.metrics.unlinked_items,
        items_without_source_refs: exportData.metrics.items_without_source_refs,
        links_missing_metadata: exportData.metrics.links_missing_metadata,
        links_needing_review: exportData.metrics.links_needing_review,
        domains_without_verified_linkage: exportData.metrics.domains_without_verified_linkage,
      },
      domain_coverage: exportData.domain_coverage.filter(
        (item) =>
          item.unlinked_item_count > 0 ||
          item.items_without_source_refs_count > 0 ||
          item.zero_verified_linkage
      ),
      gaps: exportData.gaps,
    };
  }

  if (scope === "summary") {
    return {
      generated_at: exportData.generated_at,
      agenda: exportData.agenda,
      metrics: exportData.metrics,
      domain_coverage: exportData.domain_coverage,
      items: exportData.items,
      links: exportData.links,
      source_coverage: exportData.source_coverage,
    };
  }

  return exportData;
}

export async function GET(request) {
  const scope = normalizeScope(request.nextUrl.searchParams.get("scope"));
  const shouldDownload = request.nextUrl.searchParams.get("download") === "1";
  const exportData = getAgendaReviewExportData("project-2025");

  if (!exportData) {
    return NextResponse.json(
      { error: "Agenda review export unavailable." },
      { status: 404 }
    );
  }

  const payload = buildPayload(exportData, scope);
  const response = NextResponse.json(payload);

  if (shouldDownload) {
    response.headers.set(
      "Content-Disposition",
      `attachment; filename="project-2025-review-${scope}.json"`
    );
  }

  return response;
}
