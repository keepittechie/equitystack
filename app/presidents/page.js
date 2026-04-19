import Link from "next/link";
import { buildListingMetadata } from "@/lib/metadata";
import { fetchPresidentsOverviewData } from "@/lib/public-site-data";
import StructuredData from "@/app/components/public/StructuredData";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  CitationNote,
  DashboardFilterBar,
  ImpactOverviewCards,
  MethodologyCallout,
  PresidentScoreMethodologyNote,
  SectionIntro,
} from "@/app/components/public/core";
import { Panel } from "@/app/components/dashboard/primitives";
import {
  ComparisonMetricsTable,
  PresidentCardGrid,
  PresidentRankingBoard,
} from "@/app/components/public/entities";
import TrustBar from "@/app/components/public/TrustBar";
import {
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
  buildDatasetJsonLd,
  buildItemListJsonLd,
} from "@/lib/structured-data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }) {
  const resolvedSearchParams = (await searchParams) || {};

  return buildListingMetadata({
    title: "U.S. presidents and Black policy impact",
    description:
      "Compare U.S. presidents using the Black Impact Score, linked promises, policy drivers, and historical context on Black Americans.",
    path: "/presidents",
    keywords: [
      "Black history by president",
      "presidents and Black Americans",
      "civil rights policy by president",
      "which presidents helped Black Americans",
    ],
    searchParams: resolvedSearchParams,
  });
}

function matchesFilter(value, selected) {
  if (!selected) {
    return true;
  }
  return String(value || "").toLowerCase() === String(selected).toLowerCase();
}

function formatScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "—";
  }
  return numeric.toFixed(2);
}

export default async function PresidentsPage({ searchParams }) {
  const resolvedSearchParams = (await searchParams) || {};
  const { presidents } = await fetchPresidentsOverviewData(resolvedSearchParams);
  const partyFilter = resolvedSearchParams.party || "";
  const confidenceFilter = resolvedSearchParams.confidence || "";
  const query = resolvedSearchParams.q || "";
  const sort = resolvedSearchParams.sort || "score_desc";

  const filteredPresidents = presidents.filter((item) => {
    const confidence = String(item.score_confidence || "").toLowerCase();
    return matchesFilter(item.party, partyFilter) && matchesFilter(confidence, confidenceFilter);
  });

  const comparisonRows = filteredPresidents.slice(0, 12).map((item) => ({
    label: item.name,
    final_score: formatScore(item.score ?? item.normalized_score_total),
    outcome_score: formatScore(item.direct_normalized_score),
    systemic_score: formatScore(item.systemic_score),
    outcomes: item.outcome_count ?? 0,
    promises: item.promise_count ?? 0,
    bills: item.linked_bill_count ?? 0,
    bill_input: formatScore(item.bill_blended_score ?? item.linked_bill_score_weighted),
    confidence: item.score_confidence || "Unknown",
  }));

  const averageFinalScore = filteredPresidents.length
    ? filteredPresidents.reduce(
        (total, item) => total + Number((item.score ?? item.normalized_score_total) || 0),
        0
      ) / filteredPresidents.length
    : null;
  const highConfidenceCount = filteredPresidents.filter(
    (item) => String(item.score_confidence || "").toLowerCase() === "high"
  ).length;
  const topRanked = filteredPresidents.slice(0, 10);
  const showSystemicComparison = filteredPresidents.some(
    (item) => Math.abs(Number(item.systemic_score || 0)) > 0.001
  );
  const showBillComparison = filteredPresidents.some(
    (item) => Number(item.linked_bill_count || 0) > 0
  );
  const linkedBillTotal = filteredPresidents.reduce(
    (total, item) => total + Number(item.linked_bill_count || 0),
    0
  );

  return (
    <main className="space-y-4">
      <StructuredData
        data={[
          buildBreadcrumbJsonLd(
            [{ href: "/", label: "Home" }, { label: "Presidents" }],
            "/presidents"
          ),
          buildCollectionPageJsonLd({
            title: "U.S. presidents and Black policy impact",
            description:
              "Browse presidential profiles, compare scores, and research how presidents affected Black Americans through policy, promises, and historical context.",
            path: "/presidents",
            about: [
              "U.S. presidents",
              "Black history",
              "civil rights policy",
              "presidential policy impact on Black Americans",
            ],
            keywords: [
              "presidential record on Black issues",
              "Black progress under presidents",
            ],
          }),
          buildDatasetJsonLd({
            title: "EquityStack presidential impact dataset",
            description:
              "Structured presidential profiles, promise counts, outcome-based scores, and historical policy context used by the EquityStack presidents index.",
            path: "/presidents",
            about: ["U.S. presidents", "Black Americans", "historical policy impact"],
            keywords: ["presidents and Black Americans", "Black history by president"],
            variableMeasured: [
              "Black Impact Score",
              "Systemic score",
              "Promise count",
              "Outcome count",
            ],
          }),
          buildItemListJsonLd({
            title: "Presidential profiles visible on the presidents index",
            description:
              "The current visible presidential profiles on the EquityStack presidents index.",
            path: "/presidents",
            items: topRanked
              .filter((item) => (item.slug || item.president_slug) && item.name)
              .map((item) => ({
                href: `/presidents/${item.slug || item.president_slug}`,
                name: item.name,
              })),
          }),
        ]}
      />
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Presidents" }]} />

      <section className="hero-panel p-4">
        <SectionIntro
          as="h1"
          eyebrow="President records"
          title="Compare U.S. presidents and their policy impact on Black Americans."
          description="Use this index to research Black history by president, compare civil-rights policy records, and see how presidential score, promises, legislation, and evidence fit together."
          actions={
            <>
              <Link href="/dashboard" className="dashboard-button-primary">
                Open the public data dashboard
              </Link>
              <Link href="/methodology" className="dashboard-button-secondary">
                Read the presidential scoring method
              </Link>
            </>
          }
        />
      </section>

      <TrustBar />

      <DashboardFilterBar helpText="Filter by name, party, confidence, or score order. The goal is quick ranking scan first, then profile-level reading.">
        <form action="/presidents" method="GET" className="flex flex-1 flex-wrap items-end gap-4">
          <label className="grid gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">Search</span>
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="President name"
              className="dashboard-field"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">Party</span>
            <select name="party" defaultValue={partyFilter} className="dashboard-field">
              <option value="">All parties</option>
              {[...new Set(presidents.map((item) => item.party).filter(Boolean))].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">Confidence</span>
            <select name="confidence" defaultValue={confidenceFilter} className="dashboard-field">
              <option value="">All confidence levels</option>
              {["very low", "low", "medium", "high"].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">Sort</span>
            <select name="sort" defaultValue={sort} className="dashboard-field">
              <option value="score_desc">Highest final score</option>
              <option value="name_asc">Name A-Z</option>
              <option value="term_asc">Oldest term first</option>
            </select>
          </label>
          <button type="submit" className="dashboard-button-secondary">
            Apply filters
          </button>
        </form>
      </DashboardFilterBar>

      <ImpactOverviewCards
        items={[
          {
            label: "Presidents shown",
            value: filteredPresidents.length,
            description: "Scored presidential records visible in the current filtered view.",
            tone: "accent",
          },
          {
            label: "High confidence",
            value: highConfidenceCount,
            description: "Profiles with stronger confidence-backed score coverage.",
          },
          {
            label: "Average final score",
            value: averageFinalScore == null ? "—" : formatScore(averageFinalScore),
            description: "Simple filtered mean of the current final Black Impact Score.",
          },
          {
            label: "Tracked promises",
            value: filteredPresidents.reduce((total, item) => total + Number(item.promise_count || 0), 0),
            description: "Promise tracker records attached to the filtered presidential set.",
          },
          {
            label: "Linked bills",
            value: linkedBillTotal,
            description: "Tracked bills that reach these presidents through existing bill-to-promise lineage.",
          },
        ]}
      />

      <section className="space-y-4">
        <Panel padding="md" className="space-y-4">
          <SectionIntro
            eyebrow="Flagship ranking"
            title="Black Impact Score ranking"
            description="This ranking shows how presidents compare on the current final Black Impact Score. It remains a structured policy-impact measure, not a complete judgment of a presidency."
          />
          <PresidentRankingBoard
            items={topRanked}
            buildHref={(item) => `/presidents/${item.slug}`}
            title="Ranked presidential records"
          />
          <Panel padding="md" className="bg-[rgba(18,31,49,0.52)]">
            <PresidentScoreMethodologyNote />
          </Panel>
          <Panel padding="md" className="bg-[rgba(18,31,49,0.52)]">
            <CitationNote description="When referencing the presidential ranking externally, cite the page title, EquityStack, the page URL, and your access date. Treat the ranking as a structured summary of the current dataset rather than a complete historical judgment." />
          </Panel>
          <MethodologyCallout description="Scores reflect measured policy impact in the EquityStack dataset, not a complete judgment of a presidency. Low-coverage presidents are visibly dampened for display so one or two outcomes do not look absolute." />
        </Panel>
      </section>

      <section className="space-y-4">
        <SectionIntro
          eyebrow="Comparison table"
          title="Read the ranking in compact form"
          description="Use the table when you want a fast side-by-side view of headline score, confidence, and tracked record counts before opening profiles."
        />
        <Panel padding="md" className="bg-[rgba(18,31,49,0.52)]">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            How to read this ranking
          </p>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-[var(--ink-soft)]">
            Higher scores indicate stronger measured positive impact in the current dataset. Lower scores indicate stronger measured negative impact. This compact table emphasizes the fields that currently differentiate presidential records most clearly.
          </p>
          {showBillComparison ? (
            <p className="mt-3 max-w-4xl text-sm leading-7 text-[var(--ink-soft)]">
              Bill-linked inputs remain bounded. The outcome-based score stays the anchor, while linked bills add a smaller supporting signal when current promise-backed legislative lineage is strong enough to support it.
            </p>
          ) : null}
        </Panel>
        <ComparisonMetricsTable
          rows={comparisonRows}
          scrollClassName="thin-scrollbar"
          minTableWidthClassName="min-w-[860px]"
          metrics={[
            { key: "final_score", label: "Final Black Impact Score" },
            { key: "outcome_score", label: "Outcome-based score" },
            ...(showSystemicComparison
              ? [{ key: "systemic_score", label: "Systemic Impact Score" }]
              : []),
            { key: "outcomes", label: "Outcomes" },
            { key: "promises", label: "Promises" },
            ...(showBillComparison ? [{ key: "bills", label: "Linked bills" }] : []),
            ...(showBillComparison ? [{ key: "bill_input", label: "Bill-informed input" }] : []),
            { key: "confidence", label: "Confidence" },
          ]}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Link href="/promises" className="panel-link p-4">
          <h2 className="text-lg font-semibold text-white">Open campaign promises by president</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            Use the Promise Tracker to see what presidents said they would do for Black Americans and how those commitments were later graded.
          </p>
        </Link>
        <Link href="/reports/black-impact-score" className="panel-link p-4">
          <h2 className="text-lg font-semibold text-white">Read the Black Impact Score report</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            The flagship report adds ranking context, score interpretation, and broader historical framing beyond the profile cards on this page.
          </p>
        </Link>
        <Link href="/analysis/presidents-and-black-americans" className="panel-link p-4">
          <h2 className="text-lg font-semibold text-white">Read the presidents and Black Americans guide</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            Start with the thematic guide when the question is broader than one president and you want the best research paths across profiles, policies, promises, and reports.
          </p>
        </Link>
      </section>

      <section className="space-y-4">
        <SectionIntro
          eyebrow="Profile cards"
          title={`${filteredPresidents.length} presidential records ready to explore`}
          description="Each profile brings together scores, trend lines, policy drivers, promise activity, and related reports."
        />
        <PresidentCardGrid items={filteredPresidents} buildHref={(item) => `/presidents/${item.slug}`} />
      </section>
    </main>
  );
}
