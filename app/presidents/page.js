import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import { fetchPresidentsOverviewData } from "@/lib/public-site-data";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  CitationNote,
  DashboardFilterBar,
  ImpactOverviewCards,
  MethodologyCallout,
  PageContextBlock,
  PresidentScoreMethodologyNote,
  SectionIntro,
} from "@/app/components/public/core";
import {
  ComparisonMetricsTable,
  PresidentCardGrid,
  PresidentRankingBoard,
} from "@/app/components/public/entities";
import TrustBar from "@/app/components/public/TrustBar";
import ScoreExplanation from "@/app/components/public/ScoreExplanation";

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "Presidents",
  description:
    "Compare presidential records using the final Black Impact Score, outcome-based context, bill-linked inputs, and policy drivers.",
  path: "/presidents",
});

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
    <main className="space-y-10">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Presidents" }]} />

      <section className="hero-panel p-8 md:p-10 xl:p-14">
        <SectionIntro
          as="h1"
          eyebrow="President records"
          title="Compare presidential impact records without losing evidence or context."
          description="The presidents index leads with the final Black Impact Score, keeps outcome-based and systemic context visible, and now adds bounded bill-linked inputs where the current Bills → Promises → Presidents lineage supports them."
          actions={
            <>
              <Link href="/dashboard" className="public-button-primary">
                Open dashboard
              </Link>
              <Link href="/methodology" className="public-button-secondary">
                Read scoring method
              </Link>
            </>
          }
        />
      </section>

      <TrustBar />

      <section className="grid items-start gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <PageContextBlock
          description="This page ranks presidential records using the final Black Impact Score, anchored by outcome-based scoring and lightly blended with bill-informed inputs when real legislative lineage supports them."
          detail="Use the ranking table for fast scan, then open a profile to read the outcome-based anchor, bill influence, trend lines, policy drivers, evidence footprint, and related promise records."
        />
        <ScoreExplanation title="How to read presidential Impact Scores" />
      </section>

      <DashboardFilterBar helpText="Filter by name, party, confidence, or score order. The goal is quick ranking scan first, then profile-level reading.">
        <form action="/presidents" method="GET" className="flex flex-1 flex-wrap items-end gap-4">
          <label className="grid gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">Search</span>
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="President name"
              className="rounded-xl border border-white/8 bg-white/5 px-3 py-2.5 text-sm text-white"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">Party</span>
            <select name="party" defaultValue={partyFilter} className="rounded-xl border border-white/8 bg-white/5 px-3 py-2.5 text-sm text-white">
              <option value="">All parties</option>
              {[...new Set(presidents.map((item) => item.party).filter(Boolean))].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">Confidence</span>
            <select name="confidence" defaultValue={confidenceFilter} className="rounded-xl border border-white/8 bg-white/5 px-3 py-2.5 text-sm text-white">
              <option value="">All confidence levels</option>
              {["very low", "low", "medium", "high"].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">Sort</span>
            <select name="sort" defaultValue={sort} className="rounded-xl border border-white/8 bg-white/5 px-3 py-2.5 text-sm text-white">
              <option value="score_desc">Highest final score</option>
              <option value="name_asc">Name A-Z</option>
              <option value="term_asc">Oldest term first</option>
            </select>
          </label>
          <button type="submit" className="public-button-secondary">
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

      <section className="public-two-col-rail grid items-start gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5 xl:self-start">
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
        </div>
        <div className="space-y-5">
          <PresidentScoreMethodologyNote />
          <CitationNote description="When referencing the presidential ranking externally, cite the page title, EquityStack, the page URL, and your access date. Treat the ranking as a structured summary of the current dataset rather than a complete historical judgment." />
          <MethodologyCallout description="Scores reflect measured policy impact in the EquityStack dataset, not a complete judgment of a presidency. Low-coverage presidents are visibly dampened for display so one or two outcomes do not look absolute." />
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Comparison table"
          title="Read the ranking in compact form"
          description="Use the table when you want a fast side-by-side view of headline score, confidence, and tracked record counts before opening profiles."
        />
        <div className="rounded-[1.45rem] border border-white/8 bg-[rgba(8,14,24,0.86)] p-4 md:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
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
        </div>
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

      <section className="space-y-5">
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
