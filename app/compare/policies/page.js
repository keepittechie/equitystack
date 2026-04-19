import { buildPageMetadata } from "@/lib/metadata";
import { fetchComparePoliciesData } from "@/lib/public-site-data";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  KpiCard,
  SectionIntro,
} from "@/app/components/public/core";
import {
  CompareSelector,
  ComparisonMetricsTable,
  PolicyCardList,
} from "@/app/components/public/entities";
import TrustBar from "@/app/components/public/TrustBar";

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
  const items = data.items || [];
  const rows = (data.items || []).map((item) => ({
    label: item.title,
    score: formatScore(item.impact_score),
    direction: item.impact_direction || "—",
    confidence: item.confidence_label || "Unknown",
    sources: item.source_count ?? 0,
    president: item.president || "—",
    year: item.year_enacted || "—",
  }));
  const mostSourced =
    items.slice().sort(
      (left, right) => Number(right.source_count || 0) - Number(left.source_count || 0)
    )[0] || null;
  const highestScore =
    items.slice().sort(
      (left, right) => Number(right.impact_score || 0) - Number(left.impact_score || 0)
    )[0] || null;
  const lowestScore =
    items.slice().sort(
      (left, right) => Number(left.impact_score || 0) - Number(right.impact_score || 0)
    )[0] || null;
  const positiveCount = items.filter(
    (item) => String(item.impact_direction || "").toLowerCase() === "positive"
  ).length;
  const negativeCount = items.filter(
    (item) => String(item.impact_direction || "").toLowerCase() === "negative"
  ).length;

  return (
    <main className="space-y-4">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/compare", label: "Compare" },
          { label: "Policies" },
        ]}
      />

      <section className="hero-panel p-4">
        <SectionIntro
          as="h1"
          eyebrow="Policy comparison"
          title="Compare policy records by impact score first, then evidence strength."
          description="Higher impact score means a more positive documented policy effect in the current EquityStack record. Read impact score first, then check direction, confidence, and source count before deciding which record is stronger."
        />
      </section>

      <TrustBar />

      <section className="space-y-4">
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
        <p className="max-w-4xl text-sm leading-7 text-[var(--ink-soft)]">
          Choose records that belong in the same conversation. Columns are policies and rows are
          comparison metrics. Start with impact score, then use direction and evidence strength to
          decide whether the gap is meaningful.
        </p>
      </section>

      {data.items?.length >= 2 ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Highest impact score"
              value={highestScore ? formatScore(highestScore.impact_score) : "—"}
              description={
                highestScore
                  ? `${highestScore.title} currently leads on documented impact score.`
                  : "No policy lead is available."
              }
              tone="accent"
            />
            <KpiCard
              label="Lowest impact score"
              value={lowestScore ? formatScore(lowestScore.impact_score) : "—"}
              description={
                lowestScore
                  ? `${lowestScore.title} currently sits at the bottom of the selected set.`
                  : "No lower score is available."
              }
            />
            <KpiCard
              label="Strongest source base"
              value={mostSourced?.source_count ?? 0}
              description={
                mostSourced ? `${mostSourced.title} has the largest visible source count.` : "—"
              }
            />
            <KpiCard
              label="Direction split"
              value={`${positiveCount} positive / ${negativeCount} negative`}
              description="Quick read on whether the selected set leans positive or negative before you open each policy."
            />
          </section>

          <ComparisonMetricsTable
            rows={rows}
            metrics={[
              {
                key: "score",
                label: "Impact score",
                description: "Higher = more positive documented impact in the current record.",
                primary: true,
              },
              {
                key: "direction",
                label: "Impact direction",
                description: "Shows whether the record leans positive, negative, mixed, or blocked.",
              },
              {
                key: "confidence",
                label: "Evidence confidence",
                description: "Use this with source count to judge how hard to lean on the score.",
              },
              {
                key: "sources",
                label: "Source count",
                description: "Visible source coverage attached to the policy record.",
              },
              {
                key: "president",
                label: "President",
                description: "Historical owner of the policy record.",
              },
              {
                key: "year",
                label: "Year enacted",
                description: "Placement in historical time.",
              },
            ]}
          />

          <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-5">
              <SectionIntro
                eyebrow="Selected records"
                title="Record snapshots"
                description="Use the cards to confirm why one record is higher, lower, or more thinly evidenced before opening the full policy pages."
              />
              <PolicyCardList
                items={data.items}
                buildHref={(item) => `/policies/${item.slug || item.id}`}
              />
            </div>
            <div className="space-y-5">
              <div className="rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4">
                <h2 className="text-lg font-semibold text-white">What to look at first</h2>
                <div className="mt-4 grid gap-3 text-sm leading-7 text-[var(--ink-soft)]">
                  <div className="rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.52)] p-4">
                    Start with impact score. The higher score is the stronger documented policy record in this comparison.
                  </div>
                  <div className="rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.52)] p-4">
                    Then check direction. Mixed and blocked records need more caution than a clean positive or negative record.
                  </div>
                  <div className="rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.52)] p-4">
                    Finally check confidence and sources to see whether the visible gap rests on a stronger evidence base.
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
