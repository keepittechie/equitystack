import { buildPageMetadata } from "@/lib/metadata";
import { fetchComparePoliciesData } from "@/lib/public-site-data";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  KpiCard,
  MethodologyCallout,
  PageContextBlock,
  SectionIntro,
} from "@/app/components/public/core";
import {
  CompareSelector,
  ComparisonMetricsTable,
  PolicyCardList,
} from "@/app/components/public/entities";
import TrustBar from "@/app/components/public/TrustBar";
import ScoreExplanation from "@/app/components/public/ScoreExplanation";

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "Compare Policies",
  description:
    "Compare selected policy records by impact score, direction, source count, confidence, topic, and historical context.",
  path: "/compare/policies",
});

function normalizeSelected(value) {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list
    .flatMap((item) => String(item).split(","))
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function formatScore(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : "—";
}

export default async function ComparePoliciesPage({ searchParams }) {
  const resolvedSearchParams = (await searchParams) || {};
  const selected = normalizeSelected(resolvedSearchParams.compare);
  const data = await fetchComparePoliciesData(selected);
  const rows = (data.items || []).map((item) => ({
    label: item.title,
    year: item.year_enacted || "—",
    president: item.president || "—",
    direction: item.impact_direction || "—",
    score: formatScore(item.impact_score),
    sources: item.source_count ?? 0,
    confidence: item.confidence_label || "Unknown",
  }));
  const mostSourced =
    data.items?.slice().sort(
      (left, right) => Number(right.source_count || 0) - Number(left.source_count || 0)
    )[0] || null;

  return (
    <main className="space-y-10">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/compare", label: "Compare" },
          { label: "Policies" },
        ]}
      />

      <section className="hero-panel p-8 md:p-10 xl:p-14">
        <SectionIntro
          as="h1"
          eyebrow="Policy comparison"
          title="Put policy records next to each other and keep the evidence visible."
          description="Policy comparison is most useful when the records are meaningfully comparable. The page keeps source count, confidence, and direction close to the score so users can see when the evidence base is thin."
        />
      </section>

      <TrustBar />

      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <form action="/compare/policies" method="GET" className="space-y-4">
          <CompareSelector
            options={data.options || []}
            selected={data.selected_ids || []}
            name="compare"
          />
          <button type="submit" className="dashboard-button-primary">
            Compare selected policies
          </button>
        </form>
        <div className="space-y-5">
          <PageContextBlock
            description="This page compares selected policy records by Impact Score, Impact Direction, source depth, topic, and Confidence."
            detail="It is most useful when the policies are meaningfully comparable and when you open the detail pages afterward to inspect evidence and plain-language summaries."
          />
          <MethodologyCallout description="Policy comparison should be read alongside the detail pages. Impact score is only one part of the record; source depth, direction, timing, and category all matter." />
          <ScoreExplanation title="How to read policy comparison scores" />
        </div>
      </section>

      {data.items?.length >= 2 ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Policies compared"
              value={data.items.length}
              description="Valid policy records in the current comparison set."
              tone="accent"
            />
            <KpiCard
              label="Highest score"
              value={
                formatScore(
                  Math.max(...data.items.map((item) => Number(item.impact_score || 0)))
                )
              }
              description="Highest impact score in the selected comparison set."
            />
            <KpiCard
              label="Most sourced"
              value={mostSourced?.source_count ?? 0}
              description={
                mostSourced ? `${mostSourced.title} has the largest visible source count.` : "—"
              }
            />
            <KpiCard
              label="Categories visible"
              value={
                new Set(
                  data.items.flatMap((item) =>
                    String(item.categories || "")
                      .split(",")
                      .map((entry) => entry.trim())
                      .filter(Boolean)
                  )
                ).size
              }
              description="Distinct category labels visible across the selected records."
            />
          </section>

          <ComparisonMetricsTable
            rows={rows}
            metrics={[
              { key: "year", label: "Year" },
              { key: "president", label: "President" },
              { key: "direction", label: "Impact Direction" },
              { key: "score", label: "Impact Score" },
              { key: "sources", label: "Source count" },
              { key: "confidence", label: "Confidence" },
            ]}
          />

          <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-5">
              <SectionIntro
                eyebrow="Selected records"
                title="Comparison cards"
                description="Use the cards below when you want the summaries next to the table before opening the full detail pages."
              />
              <PolicyCardList
                items={data.items}
                buildHref={(item) => `/policies/${item.slug || item.id}`}
              />
            </div>
            <div className="space-y-5">
              <div className="rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4">
                <h2 className="text-lg font-semibold text-white">Quick read</h2>
                <div className="mt-4 grid gap-3 text-sm leading-7 text-[var(--ink-soft)]">
                  <div className="rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.52)] p-4">
                    Policies with higher impact scores are not automatically more trustworthy if source coverage is thin.
                  </div>
                  <div className="rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.52)] p-4">
                    Direction matters: mixed and blocked records should not be flattened into positive/negative shorthand.
                  </div>
                  <div className="rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.52)] p-4">
                    Category overlap helps determine whether a comparison is substantive or just convenient.
                  </div>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : (
        <section className="dashboard-empty-state text-sm leading-7 text-[var(--ink-soft)]">
          Select at least two policies to generate a comparison. Choose records with shared topic or historical context for the clearest read.
        </section>
      )}
    </main>
  );
}
