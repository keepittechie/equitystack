import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import { fetchDashboardData } from "@/lib/public-site-data";
import {
  CategoryImpactChart,
  DirectionBreakdownChart,
  ImpactTrendChart,
} from "@/app/components/public/charts";
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

function DashboardPanel({ children, className = "" }) {
  return (
    <section
      className={`rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-4 md:p-5 ${className}`}
    >
      {children}
    </section>
  );
}

function DashboardPanelHeader({
  title,
  description,
  action = null,
  eyebrow = null,
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-[1.4rem] font-semibold text-white md:text-[1.55rem]">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)] md:leading-7">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export default async function DashboardPage({ searchParams }) {
  const resolvedSearchParams = (await searchParams) || {};
  const data = await fetchDashboardData(resolvedSearchParams);
  const trend = data.scores.metadata?.impact_trend || { score_by_year: [] };
  const trust = data.scores.metadata?.trust || {};
  const directionData = ["Positive", "Mixed", "Negative", "Blocked"].map(
    (name, index) => ({
      name,
      value: Number(
        data.scores.records.reduce(
          (total, row) => total + Number(row.breakdown_by_direction?.[name] || 0),
          0
        )
      ),
      color: ["#84f7c6", "#fbbf24", "#ff8a8a", "#8da1b9"][index],
    })
  );
  const categoryData = (data.categorySummary || []).slice(0, 8).map((item) => ({
    name: item.name,
    score: Number(item.avg_policy_impact_score || 0),
  }));
  const promiseStatusCounts = data.promiseSnapshot?.status_counts || {};

  return (
    <main className="space-y-6">
      <section className="hero-panel p-6 md:p-8">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
            Public data center
          </p>
          <h1 className="mt-3 text-[clamp(2rem,4.6vw,4rem)] font-semibold leading-[0.97] tracking-[-0.05em] text-white">
            Command Center view of Black policy impact.
          </h1>
          <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)] md:text-base md:leading-8">
            Use this page the way you would use a civic research dashboard: scan
            the headline measures, see where Black policy impact is moving, and
            then open the relevant president, promise, legislation, or source
            page for detail.
          </p>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
        <div className="grid gap-3 md:grid-cols-2">
          <DashboardPanel>
            <h2 className="text-lg font-semibold text-white">
              What this page contains
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
              The dashboard combines presidential score context, promise-tracker
              movement, policy direction, and source coverage into one public
              overview.
            </p>
          </DashboardPanel>
          <DashboardPanel>
            <h2 className="text-lg font-semibold text-white">How to use it</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
              Start here when you want a fast read on historical progress,
              current movement, and where to click next for evidence-backed
              detail.
            </p>
          </DashboardPanel>
        </div>
        <DashboardPanel className="h-full">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
            Page logic
          </p>
          <h2 className="mt-3 text-lg font-semibold text-white">
            What stays fixed vs filtered
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
            Headline score, coverage, and evidence sections stay sitewide. The
            promise-tracker blocks below respond to the filter bar so you can
            narrow active records without changing the overall public score
            context.
          </p>
        </DashboardPanel>
      </section>

      <DashboardFilterBar helpText="These filters narrow the Promise Tracker sections on this page. The larger score and coverage summaries remain sitewide context, not query-specific totals.">
        <form
          action="/dashboard"
          className="grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto]"
        >
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
          <button
            type="submit"
            className="rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[#051019] xl:self-stretch"
          >
            Update dashboard
          </button>
        </form>
      </DashboardFilterBar>

      <section className="grid gap-3 2xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
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
              description: `${pct(
                trust.low_confidence_outcome_percentage
              )} low-confidence`,
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
        <DashboardPanel className="h-full">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
            Quick read
          </p>
          <h2 className="mt-3 text-lg font-semibold text-white">
            How to scan the dashboard
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
            Read the KPI row first, then the direction and trend charts, then
            the ranked policy and promise tables. That keeps the page moving
            from big-picture context into record-level evidence instead of
            bouncing between unrelated blocks.
          </p>
        </DashboardPanel>
      </section>

      {data.insights?.length ? (
        <section className="space-y-4">
          <SectionIntro
            eyebrow="Key insights"
            title="Key insights from the data"
            description="These observations are derived from the current public dataset and are meant to help readers identify broad historical or policy patterns before opening the underlying records."
          />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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

      <section className="grid gap-3 md:grid-cols-3">
        {[
          {
            title: "Positive movement",
            value: data.topPositivePolicies.length,
            summary:
              "High-scoring policies with documented positive contribution in the current dataset.",
          },
          {
            title: "Negative movement",
            value: data.topNegativePolicies.length,
            summary:
              "Records pulling the score downward remain visible instead of being averaged away.",
          },
          {
            title: "Mixed movement",
            value: data.topMixedPolicies.length,
            summary:
              "Mixed-impact records signal contested or uneven policy effects that still matter for interpretation.",
          },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-[1.5rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-4"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              {item.title}
            </p>
            <p className="mt-2 text-[2rem] font-semibold tracking-[-0.05em] text-white">
              {item.value}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
              {item.summary}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 2xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <ImpactTrendChart
          data={trend.score_by_year || []}
          title="Score movement over time"
          description={
            trend.interpretation ||
            "Grouped into yearly buckets using the outcome time dimension."
          }
        />
        <DirectionBreakdownChart
          data={directionData}
          title="Outcome direction mix"
          description="Positive and negative movement stay visible alongside mixed and blocked outcomes."
        />
      </section>

      <section className="grid gap-4 2xl:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
        <CategoryImpactChart
          data={categoryData}
          title="Category distribution"
          description="Average policy score by category, using currently available historical scoring data."
        />
        <MethodologyCallout description="The dashboard is a reading surface, not a black box. Every metric should lead you to a policy page, promise page, source, or methodology explanation." />
      </section>

      <section className="grid gap-4 2xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <DashboardPanel className="space-y-5 xl:self-start">
          <DashboardPanelHeader
            eyebrow="Flagship score feature"
            title="Black Impact Score by president"
            description="This ranking summarizes how presidents compare on measured policy impact in the current EquityStack dataset. Open the full presidents index for broader Black history by president, or compare presidents directly when you need a tighter read."
            action={
              <div className="flex flex-wrap gap-2">
                <Link href="/presidents" className="public-button-primary">
                  Open the presidents index
                </Link>
                <Link
                  href="/compare/presidents"
                  className="public-button-secondary"
                >
                  Compare presidents side by side
                </Link>
              </div>
            }
          />
          <PresidentRankingBoard
            items={data.presidentRanking || []}
            buildHref={(item) => `/presidents/${item.slug}`}
            limit={5}
          />
        </DashboardPanel>
        <div className="space-y-5">
          <PresidentScoreMethodologyNote />
          <DashboardPanel>
            <h2 className="text-lg font-semibold text-white">
              How to interpret this block
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Scores reflect measured policy impact in the EquityStack dataset,
              not a complete judgment of a presidency. Confidence, direction
              mix, and profile-level drivers matter when reading differences
              between presidents.
            </p>
          </DashboardPanel>
        </div>
      </section>

      <SourceTrustPanel
        sourceCount={data.readiness.sourced_outcomes}
        sourceQuality="Dataset coverage"
        confidenceLabel={`${pct(
          trust.high_confidence_outcome_percentage
        )} high confidence`}
        completenessLabel={`${pct(
          trust.incomplete_outcome_percentage || 0
        )} incomplete`}
        includedCount={data.scores.metadata?.outcomes_included_in_score}
        excludedCount={data.scores.metadata?.outcomes_excluded_from_score}
        summary="How to read this: included outcomes are currently usable in the score, excluded outcomes remain visible so missing data cannot silently disappear."
      />

      <section className="grid gap-6 2xl:grid-cols-2">
        <DashboardPanel className="space-y-5">
          <DashboardPanelHeader
            title="Top positive policies"
            description="Highest-scoring policy records currently pushing the dataset upward for Black Americans."
            action={
              <Link
                href="/policies?impact_direction=Positive&sort=impact_score_desc"
                className="accent-link text-sm"
              >
                Browse all positive-impact policies
              </Link>
            }
          />
          <RecentPolicyChangesTable items={data.topPositivePolicies} />
        </DashboardPanel>

        <DashboardPanel className="space-y-5">
          <DashboardPanelHeader
            title="Top negative policies"
            description="Policy records producing the strongest downward pull in the documented dataset."
            action={
              <Link
                href="/policies?impact_direction=Negative&sort=impact_score_desc"
                className="accent-link text-sm"
              >
                Browse all negative-impact policies
              </Link>
            }
          />
          <RecentPolicyChangesTable items={data.topNegativePolicies} />
        </DashboardPanel>
      </section>

      {data.topMixedPolicies.length ? (
        <DashboardPanel className="space-y-5">
          <DashboardPanelHeader
            title="Top mixed-impact policies"
            description="Mixed records deserve their own lane because they often explain why a period looks more complicated than a single headline score suggests."
            action={
              <Link
                href="/policies?impact_direction=Mixed&sort=impact_score_desc"
                className="accent-link text-sm"
              >
                Browse all mixed-impact policies
              </Link>
            }
          />
          <RecentPolicyChangesTable items={data.topMixedPolicies} />
        </DashboardPanel>
      ) : null}

      <DashboardPanel className="space-y-5">
        <DashboardPanelHeader
          title="Latest policy updates"
          description="The most recent visible outcome records, kept separate from the ranked strongest-positive and strongest-negative lists."
        />
        <RecentPolicyChangesTable items={data.latestPolicyUpdates} />
      </DashboardPanel>

      <DashboardPanel className="space-y-6">
        <DashboardPanelHeader
          title="Promise Tracker Overview"
          description="Promise tracking matters because it shows what was promised, what action followed, and whether that produced visible policy outcomes in the current dataset."
          action={
            <Link href="/promises" className="public-button-secondary">
              Open the full promise tracker
            </Link>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-[1.2rem] border border-white/8 bg-white/5 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Delivered
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {promiseStatusCounts.Delivered || 0}
            </p>
          </div>
          <div className="rounded-[1.2rem] border border-white/8 bg-white/5 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Partial
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {promiseStatusCounts.Partial || 0}
            </p>
          </div>
          <div className="rounded-[1.2rem] border border-white/8 bg-white/5 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              In Progress
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {promiseStatusCounts["In Progress"] || 0}
            </p>
          </div>
          <div className="rounded-[1.2rem] border border-white/8 bg-white/5 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Blocked
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {promiseStatusCounts.Blocked || 0}
            </p>
          </div>
          <div className="rounded-[1.2rem] border border-white/8 bg-white/5 p-4 sm:col-span-2 xl:col-span-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Failed
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {promiseStatusCounts.Failed || 0}
            </p>
          </div>
        </div>

        <section className="grid gap-6 2xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <PromiseSystemExplanation />
          <PromiseStatusLegend />
        </section>

        <section className="grid gap-6 2xl:grid-cols-2">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-white">
                Recent Promise Status changes
              </h3>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                Recent updates help users move from the Promise Tracker summary
                into the most recently changed records and then into the fuller
                president or promise pages.
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

          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-white">
                Current filtered promises
              </h3>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                This table follows the dashboard filter bar, so users can narrow
                the active promise slice without losing the sitewide score and
                coverage context above.
              </p>
            </div>
            <PromiseResultsTable
              items={(data.promiseSnapshot.items || []).slice(0, 6)}
              buildHref={(item) => `/promises/${item.slug}`}
            />
          </div>
        </section>
      </DashboardPanel>

      <section className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-6">
        <h2 className="text-2xl font-semibold text-white">How to read this</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.2rem] border border-white/8 bg-white/5 p-4">
            <p className="text-sm font-medium text-white">Start with summary</p>
            <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
              Scan the KPI row and score movement before drilling into any
              individual claim.
            </p>
          </div>
          <div className="rounded-[1.2rem] border border-white/8 bg-white/5 p-4">
            <p className="text-sm font-medium text-white">
              Open the underlying record
            </p>
            <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
              Every major item here should send you to a policy, promise,
              president, or report page with more context.
            </p>
          </div>
          <div className="rounded-[1.2rem] border border-white/8 bg-white/5 p-4">
            <p className="text-sm font-medium text-white">
              Read evidence nearby
            </p>
            <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
              Source counts, confidence, completeness, and methodology stay
              close to the metrics so trust never becomes a separate screen.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
