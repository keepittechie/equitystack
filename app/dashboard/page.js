import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import { fetchDashboardData } from "@/lib/public-site-data";
import {
  CategoryImpactChart,
  DirectionBreakdownChart,
  ImpactTrendChart,
} from "@/app/components/public/charts";
import {
  FilterChip,
  getPromiseStatusTone,
  getStatusDotClass,
  getStatusSurfaceClass,
  getStatusTextClass,
  MetricCard,
  Panel,
  SectionHeader,
} from "@/app/components/dashboard/primitives";
import {
  MethodologyCallout,
  PresidentScoreMethodologyNote,
  SourceTrustPanel,
} from "@/app/components/public/core";
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

const FILTER_FIELD_CLASS =
  "min-h-9 rounded-md border border-[var(--line)] bg-[rgba(18,31,49,0.5)] px-3 text-sm text-white placeholder:text-[var(--ink-muted)] hover:border-[var(--line-strong)] focus:border-[rgba(132,247,198,0.38)] focus:bg-[rgba(18,31,49,0.76)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(132,247,198,0.28)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(11,20,33)]";

const SECONDARY_TEXT_LINK_CLASS =
  "text-sm font-semibold text-[var(--ink-soft)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(132,247,198,0.28)]";

const PROMISE_STATUS_FILTERS = [
  { label: "All", value: "", tone: "default" },
  { label: "Delivered", value: "Delivered", tone: "success" },
  { label: "Partial", value: "Partial", tone: "warning" },
  { label: "In Progress", value: "In Progress", tone: "info" },
  { label: "Blocked", value: "Blocked", tone: "contested" },
  { label: "Failed", value: "Failed", tone: "danger" },
];

function pct(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function formatCount(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function sumValues(values = {}) {
  return Object.values(values).reduce(
    (total, value) => total + Number(value || 0),
    0
  );
}

function dashboardHref(searchParams = {}, updates = {}) {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    const resolvedValue = Array.isArray(value) ? value[0] : value;

    if (resolvedValue) {
      params.set(key, resolvedValue);
    }
  });

  Object.entries(updates).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
  });

  const query = params.toString();

  return query ? `/dashboard?${query}` : "/dashboard";
}

function DashboardActionLink({ href, children, variant = "secondary" }) {
  const classes =
    variant === "primary"
      ? "border-[rgba(132,247,198,0.72)] bg-[var(--accent)] text-[#051019] hover:border-[var(--accent)] hover:bg-[rgba(132,247,198,0.9)]"
      : "border-[var(--line-strong)] bg-[rgba(18,31,49,0.58)] text-white hover:border-[var(--line-strong)] hover:bg-[rgba(18,31,49,0.86)]";

  return (
    <Link
      href={href}
      className={`inline-flex min-h-9 items-center justify-center rounded-md border px-3 text-[12px] font-semibold transition-[background-color,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(132,247,198,0.28)] ${classes}`}
    >
      {children}
    </Link>
  );
}

function DashboardStatusTabs({ counts = {}, currentStatus, searchParams }) {
  const total = sumValues(counts);

  return (
    <div className="max-w-full overflow-x-auto pb-1">
      <div className="flex w-max min-w-full gap-1 rounded-lg border border-[var(--line)] bg-[rgba(5,11,19,0.34)] p-1">
        {PROMISE_STATUS_FILTERS.map((item) => {
          const isActive = (currentStatus || "") === item.value;
          const count = item.value ? counts[item.value] || 0 : total;

          return (
            <Link
              key={item.label}
              href={dashboardHref(searchParams, { status: item.value })}
              aria-current={isActive ? "page" : undefined}
              className={`inline-flex min-h-8 shrink-0 items-center gap-2 rounded-md border px-3 text-[12px] font-semibold transition-[background-color,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(132,247,198,0.28)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(11,20,33)] ${
                isActive
                  ? `${getStatusSurfaceClass(item.tone)} ${getStatusTextClass(item.tone)} border-[var(--line-strong)]`
                  : "border-transparent text-[var(--ink-soft)] hover:border-[var(--line)] hover:bg-[rgba(18,31,49,0.58)] hover:text-white"
              }`}
            >
              {item.value ? (
                <span
                  className={`h-1.5 w-1.5 rounded-full ${getStatusDotClass(
                    item.tone
                  )}`}
                />
              ) : null}
              <span>{item.label}</span>
              <span className="font-mono text-[11px] text-[var(--ink-muted)]">
                {formatCount(count)}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function ActiveFilterBar({ searchParams, currentStatus }) {
  const activeFilters = [
    searchParams.q
      ? {
          key: "q",
          label: "Search",
          value: searchParams.q,
          tone: "info",
        }
      : null,
    searchParams.president
      ? {
          key: "president",
          label: "President",
          value: searchParams.president,
          tone: "default",
        }
      : null,
    currentStatus
      ? {
          key: "status",
          label: "Status",
          value: currentStatus,
          tone: getPromiseStatusTone(currentStatus),
        }
      : null,
  ].filter(Boolean);

  if (!activeFilters.length) {
    return (
      <div className="rounded-md border border-dashed border-[var(--line)] bg-[rgba(18,31,49,0.32)] px-3 py-2 text-[12px] text-[var(--ink-muted)]">
        No promise filters selected. Showing all tracked promise records in the
        dashboard slice.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)]">
        Active filters
      </span>
      {activeFilters.map((item) => (
        <FilterChip
          key={item.key}
          label={item.label}
          value={item.value}
          tone={item.tone}
          href={dashboardHref(searchParams, { [item.key]: "" })}
        />
      ))}
      <Link
        href="/dashboard"
        className="inline-flex min-h-7 items-center rounded-full border border-[var(--line)] bg-[rgba(18,31,49,0.4)] px-2.5 text-[11px] font-semibold text-[var(--ink-soft)] hover:border-[var(--line-strong)] hover:bg-[rgba(18,31,49,0.72)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(132,247,198,0.28)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(11,20,33)]"
      >
        Clear all
      </Link>
    </div>
  );
}

function PromiseStatusStat({ label, value, tone = "default" }) {
  return (
    <MetricCard
      label={label}
      value={value}
      tone={tone}
      density="compact"
      showDot
    />
  );
}

function InsightTile({ title, text }) {
  return (
    <Panel as="article" padding="md" interactive>
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
        {title}
      </p>
      <p className="mt-3 break-words text-sm leading-6 text-[var(--ink-soft)]">
        {text}
      </p>
    </Panel>
  );
}

export default async function DashboardPage({ searchParams }) {
  const resolvedSearchParams = (await searchParams) || {};
  const dashboardSearchParams = {
    q: Array.isArray(resolvedSearchParams.q)
      ? resolvedSearchParams.q[0]
      : resolvedSearchParams.q || "",
    president: Array.isArray(resolvedSearchParams.president)
      ? resolvedSearchParams.president[0]
      : resolvedSearchParams.president || "",
    status: Array.isArray(resolvedSearchParams.status)
      ? resolvedSearchParams.status[0]
      : resolvedSearchParams.status || "",
  };
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
  const totalPromiseSnapshot = sumValues(promiseStatusCounts);
  const currentPromiseStatus = dashboardSearchParams.status;
  const headlineStats = [
    {
      label: "Outcomes in score",
      value: formatCount(data.scores.metadata?.outcomes_included_in_score),
      description: `${formatCount(
        data.scores.metadata?.outcomes_excluded_from_score
      )} excluded but still visible`,
    },
    {
      label: "High-confidence share",
      value: pct(trust.high_confidence_outcome_percentage),
      description: `${pct(trust.low_confidence_outcome_percentage)} low-confidence outcomes`,
    },
    {
      label: "Source coverage",
      value: pct(data.readiness.source_coverage_pct),
      description: `${formatCount(data.readiness.unsourced_outcomes)} unsourced outcomes visible`,
    },
    {
      label: "Intent coverage",
      value: pct(data.readiness.intent_coverage_pct),
      description: `${data.readiness.certification_status} certification status`,
    },
  ];

  return (
    <main className="w-[calc(100vw-2.5rem)] max-w-full space-y-4 overflow-hidden">
      <Panel className="overflow-hidden" prominence="primary">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 border-b border-[var(--line)] p-4 xl:border-b-0 xl:border-r">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Public data center
            </p>
            <h1 className="mt-3 max-w-[17.5rem] break-words text-[clamp(1.7rem,7.2vw,3.7rem)] font-semibold leading-[1] tracking-[-0.04em] text-white sm:max-w-[calc(100vw-5rem)] md:max-w-4xl">
              Black policy impact, promises, and evidence in one operating view.
            </h1>
            <p className="mt-4 max-w-[18.5rem] text-sm leading-6 text-[var(--ink-soft)] sm:max-w-[calc(100vw-5rem)] md:max-w-3xl md:text-base md:leading-7">
              Scan score coverage, impact direction, presidential ranking,
              promise movement, and the underlying records that explain the
              public dataset.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <DashboardActionLink href="/reports/black-impact-score" variant="primary">
                Open flagship score report
              </DashboardActionLink>
              <DashboardActionLink href="/compare/presidents">
                Compare presidents
              </DashboardActionLink>
              <DashboardActionLink href="/sources">
                Inspect sources
              </DashboardActionLink>
            </div>
          </div>
          <aside className="grid min-w-0 content-start gap-3 p-4">
            <MetricCard
              label="Primary read"
              value="Score coverage and direction mix"
              description="Start here before drilling into records."
              density="compact"
              showDot
            />
            <MetricCard
              label="Promise snapshot"
              value={`${formatCount(totalPromiseSnapshot)} tracked records`}
              description="Responds to the filters below."
              tone="info"
              density="compact"
              showDot
            />
            <MetricCard
              label="Evidence posture"
              value={`${pct(trust.high_confidence_outcome_percentage)} high confidence`}
              description={`${pct(trust.incomplete_outcome_percentage || 0)} incomplete outcomes`}
              tone="verified"
              density="compact"
              showDot
            />
          </aside>
        </div>
      </Panel>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {headlineStats.map((item) => (
          <MetricCard
            key={item.label}
            label={item.label}
            value={item.value}
            description={item.description}
            tone={item.tone}
            prominence={item.prominence}
          />
        ))}
      </section>

      <Panel className="overflow-hidden" padding="sm">
        <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
              Promise filters
            </p>
            <h2 className="text-base font-semibold text-white">
              Narrow the promise-tracker panels
            </h2>
          </div>
          <p className="min-w-0 max-w-[calc(100vw-4rem)] break-words text-[12px] leading-5 text-[var(--ink-soft)] md:max-w-2xl">
            Score, coverage, and evidence sections remain sitewide. These
            controls only change the promise lists and status counts.
          </p>
        </div>
        <div className="mb-3">
          <DashboardStatusTabs
            counts={promiseStatusCounts}
            currentStatus={currentPromiseStatus}
            searchParams={dashboardSearchParams}
          />
        </div>
        <form
          action="/dashboard"
          className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_auto]"
        >
          <input
            type="search"
            name="q"
            defaultValue={dashboardSearchParams.q}
            placeholder="Search tracked promises"
            className={FILTER_FIELD_CLASS}
          />
          <input
            type="text"
            name="president"
            defaultValue={dashboardSearchParams.president}
            placeholder="President"
            className={FILTER_FIELD_CLASS}
          />
          <input
            type="text"
            name="status"
            defaultValue={currentPromiseStatus}
            placeholder="Promise status"
            className={FILTER_FIELD_CLASS}
          />
          <button
            type="submit"
            className="min-h-9 rounded-md border border-[rgba(132,247,198,0.72)] bg-[var(--accent)] px-4 text-sm font-semibold text-[#051019] transition-[background-color,border-color,box-shadow] hover:bg-[rgba(132,247,198,0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(132,247,198,0.28)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(11,20,33)] xl:self-stretch"
          >
            Update
          </button>
        </form>
        <div className="mt-3">
          <ActiveFilterBar
            searchParams={dashboardSearchParams}
            currentStatus={currentPromiseStatus}
          />
        </div>
      </Panel>

      {data.insights?.length ? (
        <Panel className="overflow-hidden">
          <SectionHeader
            eyebrow="Key insights"
            title="Key insights from the data"
            description="Current public-dataset observations meant to guide the next click into presidents, policies, promises, or sources."
          />
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
            {data.insights.map((item, index) => (
              <InsightTile
                key={`${item.title}-${index}`}
                title={item.title}
                text={item.text}
              />
            ))}
          </div>
        </Panel>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        {[
          {
            title: "Positive movement",
            value: data.topPositivePolicies.length,
            summary:
              "High-scoring policies with documented positive contribution in the current dataset.",
            tone: "success",
          },
          {
            title: "Negative movement",
            value: data.topNegativePolicies.length,
            summary:
              "Records pulling the score downward remain visible instead of being averaged away.",
            tone: "danger",
          },
          {
            title: "Mixed movement",
            value: data.topMixedPolicies.length,
            summary:
              "Mixed-impact records signal contested or uneven policy effects that still matter for interpretation.",
            tone: "contested",
          },
        ].map((item) => (
          <MetricCard
            key={item.title}
            label={item.title}
            value={item.value}
            description={item.summary}
            tone={item.tone}
            showDot
          />
        ))}
      </section>

      <section className="grid gap-4 2xl:grid-cols-[minmax(0,1.18fr)_minmax(340px,0.82fr)]">
        <div className="2xl:min-h-[420px]">
          <ImpactTrendChart
            data={trend.score_by_year || []}
            title="Primary signal: score movement over time"
            description={
              trend.interpretation ||
              "Grouped into yearly buckets using the outcome time dimension."
            }
          />
        </div>
        <div className="grid gap-4">
          <DirectionBreakdownChart
            data={directionData}
            title="Outcome direction mix"
            description="Positive, negative, mixed, and blocked outcomes remain separate so the score does not flatten conflict."
          />
          <Panel padding="md">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
              Reading order
            </p>
            <h2 className="mt-2 text-base font-semibold text-white">
              From aggregate score to records
            </h2>
            <p className="mt-2 text-[12px] leading-5 text-[var(--ink-soft)]">
              Read the KPI row, direction mix, and trend first. Then use the
              presidential ranking and policy tables to open the evidence behind
              the movement.
            </p>
          </Panel>
        </div>
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
        <Panel className="overflow-hidden xl:self-start">
          <SectionHeader
            eyebrow="Flagship score feature"
            title="Black Impact Score by president"
            description="This ranking summarizes how presidents compare on measured policy impact in the current EquityStack dataset. Open the full presidents index for broader Black history by president, or compare presidents directly when you need a tighter read."
            action={
              <div className="flex flex-wrap gap-2">
                <DashboardActionLink href="/presidents" variant="primary">
                  Open the presidents index
                </DashboardActionLink>
                <DashboardActionLink href="/compare/presidents">
                  Compare presidents
                </DashboardActionLink>
              </div>
            }
          />
          <div className="p-4">
            <PresidentRankingBoard
              items={data.presidentRanking || []}
              buildHref={(item) => `/presidents/${item.slug}`}
              limit={5}
            />
            <div className="mt-4 rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.52)] p-4">
              <h3 className="text-sm font-semibold text-white">
                Interpret the score with confidence and drivers nearby
              </h3>
              <p className="mt-2 text-[12px] leading-5 text-[var(--ink-soft)]">
                Scores reflect measured policy impact in the EquityStack
                dataset, not a complete judgment of a presidency. Confidence,
                direction mix, and profile-level drivers matter when reading
                differences between presidents.
              </p>
            </div>
          </div>
        </Panel>
        <div>
          <PresidentScoreMethodologyNote />
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

      <section className="grid gap-4 2xl:grid-cols-2">
        <Panel className="overflow-hidden">
          <SectionHeader
            title="Top positive policies"
            description="Highest-scoring policy records currently pushing the dataset upward for Black Americans."
            action={
              <Link
                href="/policies?impact_direction=Positive&sort=impact_score_desc"
                className={SECONDARY_TEXT_LINK_CLASS}
              >
                Browse positive policies
              </Link>
            }
          />
          <div className="p-4">
            <RecentPolicyChangesTable items={data.topPositivePolicies} />
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <SectionHeader
            title="Top negative policies"
            description="Policy records producing the strongest downward pull in the documented dataset."
            action={
              <Link
                href="/policies?impact_direction=Negative&sort=impact_score_desc"
                className={SECONDARY_TEXT_LINK_CLASS}
              >
                Browse negative policies
              </Link>
            }
          />
          <div className="p-4">
            <RecentPolicyChangesTable items={data.topNegativePolicies} />
          </div>
        </Panel>
      </section>

      {data.topMixedPolicies.length ? (
        <Panel className="overflow-hidden">
          <SectionHeader
            title="Top mixed-impact policies"
            description="Mixed records deserve their own lane because they often explain why a period looks more complicated than a single headline score suggests."
            action={
              <Link
                href="/policies?impact_direction=Mixed&sort=impact_score_desc"
                className={SECONDARY_TEXT_LINK_CLASS}
              >
                Browse all mixed-impact policies
              </Link>
            }
          />
          <div className="p-4">
            <RecentPolicyChangesTable items={data.topMixedPolicies} />
          </div>
        </Panel>
      ) : null}

      <Panel className="overflow-hidden">
        <SectionHeader
          title="Latest policy updates"
          description="The most recent visible outcome records, kept separate from the ranked strongest-positive and strongest-negative lists."
        />
        <div className="p-4">
          <RecentPolicyChangesTable items={data.latestPolicyUpdates} />
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <SectionHeader
          title="Promise Tracker Overview"
          description="Promise tracking matters because it shows what was promised, what action followed, and whether that produced visible policy outcomes in the current dataset."
          action={
            <DashboardActionLink href="/promises">
              Open the full promise tracker
            </DashboardActionLink>
          }
        />

        <div className="space-y-4 p-4">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <PromiseStatusStat
              label="Delivered"
              value={promiseStatusCounts.Delivered || 0}
              tone="success"
            />
            <PromiseStatusStat
              label="Partial"
              value={promiseStatusCounts.Partial || 0}
              tone="warning"
            />
            <PromiseStatusStat
              label="In progress"
              value={promiseStatusCounts["In Progress"] || 0}
              tone="info"
            />
            <PromiseStatusStat
              label="Blocked"
              value={promiseStatusCounts.Blocked || 0}
              tone="contested"
            />
            <PromiseStatusStat
              label="Failed"
              value={promiseStatusCounts.Failed || 0}
              tone="danger"
            />
          </div>

          <section className="grid gap-4 2xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <PromiseSystemExplanation />
            <PromiseStatusLegend />
          </section>

          <section className="grid gap-4 2xl:grid-cols-2">
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold text-white">
                  Recent Promise Status changes
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
                  Recent updates help users move from the Promise Tracker
                  summary into the most recently changed records and then into
                  the fuller president or promise pages.
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
                <h3 className="text-base font-semibold text-white">
                  Current filtered promises
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
                  This table follows the dashboard filter bar, so users can
                  narrow the active promise slice without losing the sitewide
                  score and coverage context above.
                </p>
              </div>
              <PromiseResultsTable
                items={(data.promiseSnapshot.items || []).slice(0, 6)}
                buildHref={(item) => `/promises/${item.slug}`}
              />
            </div>
          </section>
        </div>
      </Panel>
    </main>
  );
}
