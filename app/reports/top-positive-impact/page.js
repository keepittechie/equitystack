import { buildPageMetadata } from "@/lib/metadata";
import GeneratedReportPage from "../generated-report-page";
import {
  cleanText,
  getReportLinkedMovementRows,
} from "../report-linked-movement-data";

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "Top Positive Impact Changes",
  description: "The largest positive shifts in tracked policy and promise outcomes.",
  path: "/reports/top-positive-impact",
});

function isPositiveImpactRow(row = {}) {
  const direction = cleanText(row.impact_direction || row.status).toLowerCase();
  const scoreDelta = Number(row.score_delta);
  const previousScore = Number(row.previous_score);
  const currentScore = Number(row.current_score);
  const calculatedDelta =
    Number.isFinite(previousScore) && Number.isFinite(currentScore)
      ? currentScore - previousScore
      : Number.NaN;

  return (
    direction === "positive" ||
    (Number.isFinite(scoreDelta) && scoreDelta > 0) ||
    (Number.isFinite(calculatedDelta) && calculatedDelta > 0)
  );
}

function comparePositiveRows(left, right) {
  const rightScore = Number(right.score_delta ?? right.score_movement_value ?? 0);
  const leftScore = Number(left.score_delta ?? left.score_movement_value ?? 0);
  const scoreDiff = rightScore - leftScore;

  if (scoreDiff !== 0) {
    return scoreDiff;
  }

  return String(right.date || "").localeCompare(String(left.date || ""));
}

export default async function TopPositiveImpactReportPage() {
  const { rows } = await getReportLinkedMovementRows({
    source: "records",
    limit: null,
    contractPath: "TopPositiveImpactReport.items",
  });
  const positiveRows = rows.filter(isPositiveImpactRow).sort(comparePositiveRows);

  return (
    <GeneratedReportPage
      eyebrow="Generated report"
      title="Top Positive Impact Changes"
      description="The largest positive shifts in tracked policy and promise outcomes."
      countLabel="Positive changes"
      countDescription="Report-linked rows with positive direction or positive score movement."
      rows={positiveRows}
      emptyTitle="No positive impact changes are available yet."
      emptyDescription="Positive report-linked movement will appear here when tracked records show positive direction or score movement."
    />
  );
}
