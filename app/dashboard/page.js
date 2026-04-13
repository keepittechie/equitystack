import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import { fetchDashboardData, buildPolicySlug } from "@/lib/public-site-data";
import { CategoryImpactChart, DirectionBreakdownChart, ImpactTrendChart } from "@/app/components/public/charts";
import {
  DashboardFilterBar,
  ImpactOverviewCards,
  MethodologyCallout,
  PresidentScoreMethodologyNote,
  SectionIntro,
  SourceTrustPanel,
} from "@/app/components/public/core";
import InsightCard from "@/app/components/public/InsightCard";
import {
  PresidentRankingBoard,
  PromiseResultsTable,
  RecentPolicyChangesTable,
} from "@/app/components/public/entities";
import PromiseStatusLegend from "@/app/components/public/PromiseStatusLegend";
import PromiseSystemExplanation from "@/app/components/public/PromiseSystemExplanation";

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "Dashboard",
  description:
    "A public command-center view of EquityStack metrics, trends, top policies, and the latest tracked movement.",
  path: "/dashboard",
});

function pct(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

export default async function DashboardPage({ searchParams }) {
  const resolvedSearchParams = (await searchParams) || {};
  const data = await fetchDashboardData(resolvedSearchParams);
  const trend = data.scores.metadata?.impact_trend || { score_by_year: [] };
  const trust = data.scores.metadata?.trust || {};
  const directionData = ["Positive", "Mixed", "Negative", "Blocked"].map((name, index) => ({
    name,
    value: Number(
      data.scores.records.reduce(
        (total, row) => total + Number(row.breakdown_by_direction?.[name] || 0),
        0
      )
    ),
    color: ["#84f7c6", "#fbbf24", "#ff8a8a", "#8da1b9"][index],
  }));
  const categoryData = (data.categorySummary || []).slice(0, 8).map((item) => ({
    name: item.name,
    score: Number(item.avg_policy_impact_score || 0),
  }));
  const promiseStatusCounts = data.promiseSnapshot?.status_counts || {};

  return (
    <main className="space-y-8">
      <section className="hero-panel p-8 md:p-10">
        <div className="max-w-4xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
            Public data center
          </p>
          <h1 className="mt-4 text-[clamp(2.2rem,5vw,4.4rem)] font-semibold leading-[0.96] tracking-[-0.05em] text-white">
            Command Center view of Black policy impact.
          </h1>
          <p className="mt-5 text-base leading-8 text-[var(--ink-soft)] md:text-lg">
            Use this page the way you would use a civic research dashboard: scan the headline measures, see where Black policy impact is moving, and then open the relevant president, promise, legislation, or source page for detail.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[1.5rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
          <h2 className="text-lg font-semibold text-white">What this page contains</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            The dashboard combines presidential score context, promise-tracker movement, policy direction, and source coverage into one public overview.
          </p>
        </div>
        <div className="rounded-[1.5rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
          <h2 className="text-lg font-semibold text-white">How to use it</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            Start here when you want a fast read on historical progress, current movement, and where to click next for evidence-backed detail.
          </p>
        </div>
      </section>

      <DashboardFilterBar helpText="These filters narrow the Promise Tracker sections on this page. The larger score and coverage summaries remain sitewide context, not query-specific totals.">
        <form action="/dashboard" className="grid flex-1 gap-3 md:grid-cols-4">
          <input
            type="search"
            name="q"
            defaultValue={resolvedSearchParams.q || ""}
            placeholder="Search tracked promises"
            className="rounded-xl border border-white/8 bg-white/5 px-3 py-2.5 text-sm text-white"
          />
          <input
            type="text"
            name="president"
            defaultValue={resolvedSearchParams.president || ""}
            placeholder="President"
            className="rounded-xl border border-white/8 bg-white/5 px-3 py-2.5 text-sm text-white"
          />
          <input
            type="text"
            name="status"
            defaultValue={resolvedSearchParams.status || ""}
            placeholder="Promise status"
            className="rounded-xl border border-white/8 bg-white/5 px-3 py-2.5 text-sm text-white"
          />
          <button type="submit" className="rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[#051019]">
            Update dashboard
          </button>
        </form>
      </DashboardFilterBar>

      <ImpactOverviewCards
        items={[
          {
            label: "Outcomes in score",
            value: data.scores.metadata?.outcomes_included_in_score ?? 0,
            description: `${data.scores.metadata?.outcomes_excluded_from_score ?? 0} excluded from the current model`,
            tone: "accent",
          },
          {
            label: "High-confidence share",
            value: pct(trust.high_confidence_outcome_percentage),
            description: `${pct(trust.low_confidence_outcome_percentage)} low-confidence`,
          },
          {
            label: "Source coverage",
            value: pct(data.readiness.source_coverage_pct),
            description: `${data.readiness.unsourced_outcomes} unsourced outcomes still visible`,
          },
          {
            label: "Intent coverage",
            value: pct(data.readiness.intent_coverage_pct),
            description: `${data.readiness.certification_status} certification status`,
          },
        ]}
      />

      {data.insights?.length ? (
        <section className="space-y-5">
          <SectionIntro
            eyebrow="Key insights"
            title="Key insights from the data"
            description="These observations are derived from the current public dataset and are meant to help readers identify broad historical or policy patterns before opening the underlying records."
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {data.insights.map((item, index) => (
              <InsightCard
                key={`${item.title}-${index}`}
                title={item.title}
                text={item.text}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-3">
        {[
          {
            title: "Positive movement",
            value: data.topPositivePolicies.length,
            summary: "High-scoring policies with documented positive contribution in the current dataset.",
          },
          {
            title: "Negative movement",
            value: data.topNegativePolicies.length,
            summary: "Records pulling the score downward remain visible instead of being averaged away.",
          },
          {
            title: "Mixed movement",
            value: data.topMixedPolicies.length,
            summary: "Mixed-impact records signal contested or uneven policy effects that still matter for interpretation.",
          },
        ].map((item) => (
          <div key={item.title} className="rounded-[1.5rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">{item.title}</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white">{item.value}</p>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.summary}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <ImpactTrendChart
          data={trend.score_by_year || []}
          title="Score movement over time"
          description={trend.interpretation || "Grouped into yearly buckets using the outcome time dimension."}
        />
        <DirectionBreakdownChart
          data={directionData}
          title="Outcome direction mix"
          description="Positive and negative movement stay visible alongside mixed and blocked outcomes."
        />
      </section>

      <section className="public-two-col-rail grid items-start gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <CategoryImpactChart
          data={categoryData}
          title="Category distribution"
          description="Average policy score by category, using currently available historical scoring data."
        />
        <MethodologyCallout description="The dashboard is a reading surface, not a black box. Every metric should lead you to a policy page, promise page, source, or methodology explanation." />
      </section>

      <section className="public-two-col-rail grid items-start gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5 xl:self-start">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
                Flagship score feature
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white">
                Black Impact Score by president
              </h2>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                This ranking summarizes how presidents compare on measured policy impact in the current EquityStack dataset. Open the full presidents index for broader Black history by president, or compare presidents directly when you need a tighter read.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/presidents" className="public-button-primary">
                Open the presidents index
              </Link>
              <Link href="/compare/presidents" className="public-button-secondary">
                Compare presidents side by side
              </Link>
            </div>
          </div>
          <PresidentRankingBoard
            items={data.presidentRanking || []}
            buildHref={(item) => `/presidents/${item.slug}`}
            limit={5}
          />
        </div>
        <div className="space-y-5">
          <PresidentScoreMethodologyNote />
          <div className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
            <h2 className="text-lg font-semibold text-white">How to interpret this block</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Scores reflect measured policy impact in the EquityStack dataset, not a complete judgment of a presidency. Confidence, direction mix, and profile-level drivers matter when reading differences between presidents.
            </p>
          </div>
        </div>
      </section>

      <SourceTrustPanel
        sourceCount={data.readiness.sourced_outcomes}
        sourceQuality="Dataset coverage"
        confidenceLabel={`${pct(trust.high_confidence_outcome_percentage)} high confidence`}
        completenessLabel={`${pct(trust.incomplete_outcome_percentage || 0)} incomplete`}
        includedCount={data.scores.metadata?.outcomes_included_in_score}
        excludedCount={data.scores.metadata?.outcomes_excluded_from_score}
        summary="How to read this: included outcomes are currently usable in the score, excluded outcomes remain visible so missing data cannot silently disappear."
      />

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-white">Top positive policies</h2>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                Highest-scoring policy records currently pushing the dataset upward for Black Americans.
              </p>
            </div>
            <Link href="/policies?impact_direction=Positive&sort=impact_score_desc" className="accent-link text-sm">
              Browse all positive-impact policies
            </Link>
          </div>
          <RecentPolicyChangesTable
            items={data.topPositivePolicies.map((item) => ({
              ...item,
              record_type: "Policy",
            }))}
            buildHref={(item) => `/policies/${buildPolicySlug(item)}`}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-white">Top negative policies</h2>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                Policy records producing the strongest downward pull in the documented dataset.
              </p>
            </div>
            <Link href="/policies?impact_direction=Negative&sort=impact_score_desc" className="accent-link text-sm">
              Browse all negative-impact policies
            </Link>
          </div>
          <RecentPolicyChangesTable
            items={data.topNegativePolicies.map((item) => ({
              ...item,
              record_type: "Policy",
            }))}
            buildHref={(item) => `/policies/${buildPolicySlug(item)}`}
          />
        </div>
      </section>

      {data.topMixedPolicies.length ? (
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-white">Top mixed-impact policies</h2>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                Mixed records deserve their own lane because they often explain why a period looks more complicated than a single headline score suggests.
              </p>
            </div>
            <Link href="/policies?impact_direction=Mixed&sort=impact_score_desc" className="accent-link text-sm">
              Browse all mixed-impact policies
            </Link>
          </div>
          <RecentPolicyChangesTable
            items={data.topMixedPolicies.map((item) => ({
              ...item,
              record_type: "Policy",
            }))}
            buildHref={(item) => `/policies/${buildPolicySlug(item)}`}
          />
        </section>
      ) : null}

      <section className="public-two-col-rail grid items-start gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4 xl:self-start">
          <h2 className="text-2xl font-semibold text-white">Latest policy updates</h2>
          <RecentPolicyChangesTable
            items={data.latestPolicyUpdates.map((item) => ({
              ...item,
              record_type: "Policy",
            }))}
            buildHref={(item) => `/policies/${buildPolicySlug(item)}`}
          />
        </div>

        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">Promise Tracker Overview</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
              Promise tracking matters because it shows what was promised, what action followed, and whether that produced visible policy outcomes in the current dataset.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[1.2rem] border border-white/8 bg-white/5 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                Delivered
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">{promiseStatusCounts.Delivered || 0}</p>
            </div>
            <div className="rounded-[1.2rem] border border-white/8 bg-white/5 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                Partial
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">{promiseStatusCounts.Partial || 0}</p>
            </div>
            <div className="rounded-[1.2rem] border border-white/8 bg-white/5 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                In Progress
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">{promiseStatusCounts["In Progress"] || 0}</p>
            </div>
            <div className="rounded-[1.2rem] border border-white/8 bg-white/5 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                Blocked
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">{promiseStatusCounts.Blocked || 0}</p>
            </div>
            <div className="rounded-[1.2rem] border border-white/8 bg-white/5 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                Failed
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">{promiseStatusCounts.Failed || 0}</p>
            </div>
          </div>
          <PromiseSystemExplanation />
          <PromiseStatusLegend />
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Recent Promise Status changes</h3>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                Recent updates help users move from the Promise Tracker summary into the most recently changed records and then into the fuller president or promise pages.
              </p>
            </div>
            <RecentPolicyChangesTable
              items={(data.promiseLatestChanges || []).map((item) => ({
                ...item,
                date: item.latest_action_date || item.promise_date,
                impact_direction: item.status,
                record_type: "Promise",
              }))}
              buildHref={(item) => `/promises/${item.slug}`}
            />
          </div>
          <PromiseResultsTable items={(data.promiseSnapshot.items || []).slice(0, 6)} buildHref={(item) => `/promises/${item.slug}`} />
          <div className="flex flex-wrap gap-2">
            <Link href="/promises" className="public-button-secondary">
              Open the full promise tracker
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-6">
        <h2 className="text-2xl font-semibold text-white">How to read this</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.2rem] border border-white/8 bg-white/5 p-4">
            <p className="text-sm font-medium text-white">Start with summary</p>
            <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
              Scan the KPI row and score movement before drilling into any individual claim.
            </p>
          </div>
          <div className="rounded-[1.2rem] border border-white/8 bg-white/5 p-4">
            <p className="text-sm font-medium text-white">Open the underlying record</p>
            <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
              Every major item here should send you to a policy, promise, president, or report page with more context.
            </p>
          </div>
          <div className="rounded-[1.2rem] border border-white/8 bg-white/5 p-4">
            <p className="text-sm font-medium text-white">Read evidence nearby</p>
            <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
              Source counts, confidence, completeness, and methodology stay close to the metrics so trust never becomes a separate screen.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
