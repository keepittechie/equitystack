import Link from "next/link";
import ReportsDashboard from "./ReportsDashboard";
import { fetchInternalJson } from "@/lib/api";
import { REPORT_REVALIDATE_SECONDS, withRevalidate } from "@/lib/cache";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "Reports",
  description:
    "Explore EquityStack's featured accountability reports first, then move into broader analytics and supporting tools.",
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

function FlagshipReportCard({ eyebrow, title, description, href, linkLabel }) {
  return (
    <Link href={href} className="panel-link block rounded-[1.4rem] p-5">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">{eyebrow}</p>
      <h3 className="text-lg font-semibold mt-3">{title}</h3>
      <p className="text-sm text-[var(--ink-soft)] mt-2 leading-6">{description}</p>
      <span className="accent-link text-sm inline-block mt-4">{linkLabel}</span>
    </Link>
  );
}

function CuratedModeCard({ title, description, href }) {
  return (
    <Link href={href} className="card-muted rounded-[1.25rem] p-4 block">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-sm text-[var(--ink-soft)] mt-2 leading-6">{description}</p>
      <span className="accent-link text-sm inline-block mt-4">Open view</span>
    </Link>
  );
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
          <p className="eyebrow mb-4">Reports Hub</p>
          <h1 className="text-4xl md:text-5xl font-bold">Reports</h1>
          <p className="text-base md:text-lg text-[var(--ink-soft)] mt-4 max-w-3xl leading-8">
            Start with the featured accountability reports, then move into broader analytics
            and supporting tools when you want more quantitative context. These charts are
            descriptive, not causal, and should be interpreted within historical context.
          </p>
        </div>
      </section>

      <section className="card-surface rounded-[1.6rem] p-5 mb-8">
        <div className="max-w-3xl mb-5">
          <h2 className="text-lg font-semibold mb-2">Featured Accountability Reports</h2>
          <p className="text-sm text-[var(--ink-soft)] leading-7">
            These are the core public-facing report paths for understanding presidential commitments,
            documented outcomes, and the longer civil-rights arc.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <FlagshipReportCard
            eyebrow="Intent"
            title="Promise Tracker"
            description="Review what presidents promised, what actions followed, and what outcomes were delivered, blocked, or left unfinished."
            href="/promises"
            linkLabel="Open Promise Tracker"
          />
          <FlagshipReportCard
            eyebrow="Outcomes"
            title="Black Impact Score"
            description="Compare how presidential records affected Black communities through a transparent accountability summary built from Promise Tracker data."
            href="/reports/black-impact-score"
            linkLabel="Open Black Impact Score"
          />
          <FlagshipReportCard
            eyebrow="Continuity"
            title="Civil Rights Timeline"
            description="Follow the curated civil-rights arc across time to see how major federal action, continuity, and erosion connect."
            href="/reports/civil-rights-timeline"
            linkLabel="Open Civil Rights Timeline"
          />
        </div>
      </section>

      <section className="card-surface rounded-[1.6rem] p-5 mb-8">
        <div className="max-w-3xl mb-5">
          <h2 className="text-lg font-semibold mb-2">Black Impact Score Modes</h2>
          <p className="text-sm text-[var(--ink-soft)] leading-7">
            These curated entry points highlight the main ways to use the Black Impact Score system
            without exposing every advanced report mode at once.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <CuratedModeCard
            title="Standard Report"
            description="Start with the outcome-based president summary view for the clearest accountability overview."
            href="/reports/black-impact-score"
          />
          <CuratedModeCard
            title="Timeline View"
            description="Follow scored records in chronological order to see how presidential actions unfold over time."
            href="/reports/black-impact-score?view=timeline"
          />
          <CuratedModeCard
            title="Causal Timeline"
            description="Open the timeline view and scan the explicit record-to-record historical relationships already tracked."
            href="/reports/black-impact-score?view=timeline"
          />
          <CuratedModeCard
            title="Topic Comparison"
            description="Compare presidents inside a single policy domain using the topic comparison view."
            href="/reports/black-impact-score?view=topic-compare"
          />
          <CuratedModeCard
            title="Share Report"
            description="Open a public-safe share-ready report with evidence context and verification guidance."
            href="/reports/black-impact-score?view=public-share"
          />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr] mb-8">
        <section className="card-surface rounded-[1.6rem] p-5">
          <h2 className="text-lg font-semibold mb-3">Recommended Starting Points</h2>
          <div className="space-y-3 text-sm">
            <Link href="/reports/black-impact-score" className="block rounded-[1rem] border border-[rgba(120,53,15,0.1)] bg-white/85 px-4 py-3 hover:border-[rgba(120,53,15,0.18)]">
              <span className="font-medium text-[var(--ink)]">Start with the standard outcome-based report</span>
              <span className="block text-[var(--ink-soft)] mt-1">Use the default report to understand the overall president-level scoring context first.</span>
            </Link>
            <Link href="/reports/black-impact-score?view=timeline" className="block rounded-[1rem] border border-[rgba(120,53,15,0.1)] bg-white/85 px-4 py-3 hover:border-[rgba(120,53,15,0.18)]">
              <span className="font-medium text-[var(--ink)]">Explore policy change over time</span>
              <span className="block text-[var(--ink-soft)] mt-1">Open the timeline to follow how scored records unfold and connect across administrations.</span>
            </Link>
            <Link href="/reports/black-impact-score?view=topic-compare" className="block rounded-[1rem] border border-[rgba(120,53,15,0.1)] bg-white/85 px-4 py-3 hover:border-[rgba(120,53,15,0.18)]">
              <span className="font-medium text-[var(--ink)]">Compare presidents within a topic</span>
              <span className="block text-[var(--ink-soft)] mt-1">Move into topic comparison when you want a narrower policy-domain lens.</span>
            </Link>
            <Link href="/reports/black-impact-score?view=public-share" className="block rounded-[1rem] border border-[rgba(120,53,15,0.1)] bg-white/85 px-4 py-3 hover:border-[rgba(120,53,15,0.18)]">
              <span className="font-medium text-[var(--ink)]">Open a public share-ready report</span>
              <span className="block text-[var(--ink-soft)] mt-1">Use the source-aware public share view when you need a clean external-facing entry point.</span>
            </Link>
          </div>
        </section>

        <section className="card-surface rounded-[1.6rem] p-5">
          <h2 className="text-lg font-semibold mb-3">What This System Supports</h2>
          <ul className="text-sm text-[var(--ink-soft)] space-y-2 leading-7">
            <li>Outcome-based scoring with legacy and compare-mode support.</li>
            <li>Evidence-backed drivers and inline transparency panels.</li>
            <li>Timeline and causal timeline views for historical context.</li>
            <li>Topic comparison and president-vs-president comparison.</li>
            <li>Share-ready public views, debate-ready receipts, and stable permalinks.</li>
            <li>Saved snapshots and browser print/save-PDF workflow.</li>
          </ul>
        </section>
      </section>

      <section className="card-surface rounded-[1.6rem] p-5 mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="max-w-3xl">
            <h2 className="text-lg font-semibold mb-2">Additional Analytics and Supporting Tools</h2>
            <p className="text-sm text-[var(--ink-soft)] leading-7">
              Use these after the featured reports when you want broader dataset exploration,
              supporting policy context, or secondary quantitative views.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href="/reports/civil-rights-timeline" className="accent-link">
            Civil Rights Timeline
          </Link>
          <Link href="/reports/black-impact-score?mode=debate" className="accent-link">
            Debate-ready score view
          </Link>
          <Link href="/reports/black-impact-score?view=president-compare" className="accent-link">
            President comparison
          </Link>
          <Link href="/policies" className="accent-link">
            Browse policies
          </Link>
          <Link href="/timeline" className="accent-link">
            Open database timeline
          </Link>
          <Link href="/compare" className="accent-link">
            Compare party views
          </Link>
        </div>
      </section>

      <section className="card-muted rounded-[1.6rem] p-5 mb-6">
        <h2 className="text-lg font-semibold mb-2">How to Read the Analytics Layer</h2>
        <p className="text-sm text-[var(--ink-soft)] mb-2">
          These summaries analyze public policies using a structured scoring system across directness,
          material impact, evidence strength, durability, and equity.
        </p>
        <p className="text-sm text-[var(--ink-soft)]">
          Use them as supporting context after the featured report paths, not as a replacement for the
          Promise Tracker or Black Impact Score views.
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
        <div className="max-w-3xl">
          <h2 className="text-lg font-semibold mb-2">Analytics Dashboard</h2>
          <p className="text-sm text-[var(--ink-soft)] leading-7">
            These quantitative summaries provide broader context across parties, eras, categories,
            direct Black impact, top policies, and rollback patterns. They support the featured
            accountability reports rather than replacing them.
          </p>
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
