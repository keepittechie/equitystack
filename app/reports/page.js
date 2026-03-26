import Link from "next/link";
import ReportsDashboard from "./ReportsDashboard";
import { fetchInternalJson } from "@/lib/api";
import { REPORT_REVALIDATE_SECONDS, withRevalidate } from "@/lib/cache";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "Reports",
  description:
    "View EquityStack reports on policy impact across parties, eras, categories, and direct Black impact.",
  path: "/reports",
});

async function fetchJson(path, errorMessage) {
  return fetchInternalJson(path, {
    ...withRevalidate(REPORT_REVALIDATE_SECONDS),
    errorMessage,
  });
}

async function getTopPolicies() {
  return fetchJson("/api/reports/top-policies", "Failed to fetch top policies");
}

async function getOverallSummary() {
  return fetchJson("/api/reports/overall-summary", "Failed to fetch overall summary");
}

async function getPartySummary() {
  return fetchJson("/api/reports/party-score-summary", "Failed to fetch party summary");
}

async function getEraSummary() {
  return fetchJson("/api/reports/era-summary", "Failed to fetch era summary");
}

async function getCategorySummary() {
  return fetchJson("/api/reports/category-summary", "Failed to fetch category summary");
}

async function getRollbacks() {
  return fetchJson("/api/reports/rollbacks", "Failed to fetch rollbacks report");
}

async function getDirectImpactByParty() {
  return fetchJson(
    "/api/reports/direct-impact-by-party",
    "Failed to fetch direct impact by party"
  );
}

async function getDirectImpactByEra() {
  return fetchJson(
    "/api/reports/direct-impact-by-era",
    "Failed to fetch direct impact by era"
  );
}

async function getFutureBills() {
  return fetchJson("/api/future-bills", "Failed to fetch future bills");
}

export default async function ReportsPage() {
  const [
    overallSummary,
    partySummaryRows,
    eraSummaryRows,
    categorySummaryRows,
    directImpactByPartyRows,
    directImpactByEraRows,
    topPolicies,
    rollbackRows,
    futureBills,
  ] = await Promise.all([
    getOverallSummary(),
    getPartySummary(),
    getEraSummary(),
    getCategorySummary(),
    getDirectImpactByParty(),
    getDirectImpactByEra(),
    getTopPolicies(),
    getRollbacks(),
    getFutureBills(),
  ]);

  return (
    <main className="max-w-7xl mx-auto p-6">
      <section className="hero-panel p-8 md:p-10 mb-6">
        <div className="section-intro">
          <p className="eyebrow mb-4">Quantitative View</p>
          <h1 className="text-4xl md:text-5xl font-bold">Reports Dashboard</h1>
          <p className="text-base md:text-lg text-[var(--ink-soft)] mt-4 max-w-3xl leading-8">
            This dashboard summarizes policy impacts across time, political control,
            categories, and direct Black impact. These charts are descriptive, not causal,
            and should be interpreted within historical context.
          </p>
        </div>
      </section>

      <section className="card-muted rounded-[1.6rem] p-5 mb-6">
        <h2 className="text-lg font-semibold mb-2">How to Read This Dashboard</h2>
        <p className="text-sm text-[var(--ink-soft)] mb-2">
          This dashboard analyzes public policies based on their documented impact on Black communities,
          using a structured scoring system. Each policy is evaluated across factors such as directness,
          material impact, evidence strength, durability, and equity.
        </p>
        <p className="text-sm text-[var(--ink-soft)]">
          These results represent structured analysis based on historical data and research.
          They should be interpreted as part of a broader context rather than a single definitive conclusion.
        </p>
      </section>

      <section className="card-surface rounded-[1.6rem] p-5 mb-8">
        <h2 className="text-lg font-semibold mb-3">Metrics Explained</h2>
        <ul className="text-sm text-[var(--ink-soft)] space-y-2">
          <li>
            <strong>Policy Impact Score:</strong> Composite score based on directness, material impact,
            evidence, durability, and equity.
          </li>
          <li>
            <strong>Net Weighted Impact:</strong> Total impact score adjusted by whether outcomes were
            positive, negative, or mixed.
          </li>
          <li>
            <strong>Direct Impact:</strong> Policies explicitly targeting or directly affecting Black communities.
          </li>
          <li>
            <strong>Indirect Impact:</strong> Policies affecting broader systems with measurable downstream effects.
          </li>
        </ul>
      </section>

      <section className="card-surface rounded-[1.6rem] p-5 mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="max-w-3xl">
            <h2 className="text-lg font-semibold mb-2">Promise Tracker Reports</h2>
            <p className="text-sm text-[var(--ink-soft)] leading-7">
              Review the Black Impact Score, a Promise Tracker report that summarizes how tracked presidential
              promises and outcomes affected Black communities.
            </p>
          </div>
          <Link
            href="/reports/black-impact-score"
            className="rounded-full border border-[rgba(120,53,15,0.18)] bg-white/80 px-5 py-2 text-sm font-medium"
          >
            Open Black Impact Score
          </Link>
        </div>
      </section>

      <ReportsDashboard
        overallSummary={overallSummary}
        partySummaryRows={partySummaryRows}
        eraSummaryRows={eraSummaryRows}
        categorySummaryRows={categorySummaryRows}
        directImpactByPartyRows={directImpactByPartyRows}
        directImpactByEraRows={directImpactByEraRows}
        topPolicies={topPolicies}
        rollbackRows={rollbackRows}
        futureBills={futureBills}
      />

      <p className="text-xs text-[var(--ink-soft)] mt-10">
        This dashboard is a structured analysis of historical policy data. While every effort is made
        to ensure accuracy, interpretations may evolve as new data or perspectives are added.
      </p>
    </main>
  );
}
