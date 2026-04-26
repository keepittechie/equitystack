import { buildPageMetadata } from "@/lib/metadata";
import GeneratedReportPage from "../generated-report-page";
import {
  cleanText,
  getReportLinkedMovementRows,
} from "../report-linked-movement-data";

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "Stalled and Blocked Policies",
  description: "Tracked policies and promises that did not advance or were blocked.",
  path: "/reports/stalled-policies",
});

function isBlockedRow(row = {}) {
  return cleanText(row.impact_direction || row.status).toLowerCase() === "blocked";
}

export default async function StalledPoliciesReportPage() {
  const { rows } = await getReportLinkedMovementRows({
    source: "records",
    limit: null,
    contractPath: "StalledPoliciesReport.items",
  });
  const stalledRows = rows.filter(isBlockedRow);

  return (
    <GeneratedReportPage
      eyebrow="Generated report"
      title="Stalled and Blocked Policies"
      description="Tracked policies and promises that did not advance or were blocked."
      countLabel="Stalled items"
      countDescription="Report-linked rows whose direction is Blocked."
      rows={stalledRows}
      emptyTitle="No stalled or blocked policies are available yet."
      emptyDescription="Blocked report-linked movement will appear here when tracked records stop or fail to advance."
    />
  );
}
