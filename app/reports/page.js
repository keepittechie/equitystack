import Link from "next/link";
import { buildListingMetadata } from "@/lib/metadata";
import { fetchReportsHubData } from "@/lib/public-site-data";
import StructuredData from "@/app/components/public/StructuredData";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  CitationNote,
  DashboardFilterBar,
  ImpactOverviewCards,
  MethodologyCallout,
  PageContextBlock,
  SectionIntro,
} from "@/app/components/public/core";
import {
  RecentPolicyChangesTable,
  ReportCardGrid,
} from "@/app/components/public/entities";
import {
  CategoryImpactChart,
  DirectionBreakdownChart,
} from "@/app/components/public/charts";
import TrustBar from "@/app/components/public/TrustBar";
import ScoreExplanation from "@/app/components/public/ScoreExplanation";
import InsightCard from "@/app/components/public/InsightCard";
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
    title: "Black history, civil-rights, and policy impact reports",
    description:
      "Browse EquityStack reports on Black history, U.S. presidents, civil-rights policy, legislation, and historical policy impact on Black Americans.",
    path: "/reports",
    keywords: [
      "Black history reports",
      "civil rights policy report",
      "policy impact on Black communities",
    ],
    searchParams: resolvedSearchParams,
  });
}

export default async function ReportsPage({ searchParams }) {
  const resolvedSearchParams = (await searchParams) || {};
  const data = await fetchReportsHubData(resolvedSearchParams);
  const reports = data.filteredReports || [];
  const strongestCategory = data.reportKpis?.strongest_category || "—";
  const directionData = [
    {
      name: "Included",
      value: data.scores.metadata?.outcomes_included_in_score || 0,
      color: "#84f7c6",
    },
    {
      name: "Excluded",
      value: data.scores.metadata?.outcomes_excluded_from_score || 0,
      color: "#ff8a8a",
    },
  ];
  const categoryChartData = (data.categorySummary || []).slice(0, 8).map((item) => ({
    name: item.name,
    score: Number(item.net_weighted_impact || 0),
  }));

  return (
    <main className="space-y-10">
      <StructuredData
        data={[
          buildBreadcrumbJsonLd(
            [{ href: "/", label: "Home" }, { label: "Reports" }],
            "/reports"
          ),
          buildCollectionPageJsonLd({
            title: "Black history, civil-rights, and policy impact reports",
            description:
              "A public report library covering Black history, U.S. presidents, civil-rights policy, promise tracking, and historical policy impact on Black Americans.",
            path: "/reports",
            about: [
              "Black history",
              "civil rights policy",
              "U.S. presidents",
              "historical policy impact",
            ],
            keywords: [
              "Black history reports",
              "policy impact on Black communities",
            ],
          }),
          buildDatasetJsonLd({
            title: "EquityStack report layer dataset",
            description:
              "Structured analytical summaries, score context, and historical report data presented through the EquityStack reports hub.",
            path: "/reports",
            about: ["Black history", "civil rights policy", "policy impact on Black Americans"],
            keywords: ["Black history reports", "historical policy impact"],
            variableMeasured: [
              "Black Impact Score",
              "Outcome coverage",
              "Category impact",
              "Direction breakdown",
            ],
          }),
          buildItemListJsonLd({
            title: "Reports visible on the EquityStack reports hub",
            description:
              "The current visible report cards on the public reports hub.",
            path: "/reports",
            items: reports
              .filter((item) => item?.slug && item?.title)
              .slice(0, 12)
              .map((item) => ({
                href: `/reports/${item.slug}`,
                name: item.title,
              })),
          }),
        ]}
      />
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Reports" }]} />

      <section className="hero-panel p-8 md:p-10 xl:p-14">
        <SectionIntro
          as="h1"
          eyebrow="Analysis hub"
          title="Read Black history, policy impact, and evidence side by side."
          description="Reports are the public intelligence layer on top of the browseable database. Use them to move from headline interpretation into policy records, promise evidence, timelines, and methodology without losing the audit trail."
          actions={
            <>
              <Link href="/dashboard" className="public-button-primary">
                Open dashboard
              </Link>
              <Link href="/methodology" className="public-button-secondary">
                Read methodology
              </Link>
            </>
          }
        />
      </section>

      <TrustBar />

      <section className="grid items-start gap-6 2xl:grid-cols-[1.05fr_0.95fr]">
        <PageContextBlock
          description="This page organizes EquityStack’s analytical outputs, from flagship score views to historical and category-based report paths."
          detail="Reports summarize structured policy data. They are designed to help users move from synthesis into the underlying records, sources, and methodology."
        />
        <ScoreExplanation title="How to read report score language" />
      </section>

      <section className="grid gap-6 2xl:grid-cols-[1.05fr_0.95fr]">
        <CitationNote
          title="Why this hub is worth citing"
          description="The reports hub is the strongest page to share when someone needs a curated entry point into EquityStack&apos;s analysis layer. It organizes flagship reports, score interpretation, and related record pathways in one place instead of forcing readers to start with a raw table."
        />
        <div className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
            Best external use cases
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-white">Where this page helps most</h2>
          <div className="mt-4 grid gap-3 text-sm leading-7 text-[var(--ink-soft)]">
            <div className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
              Share this page when a reader needs a summary-level entry into EquityStack before opening presidents, policies, or promises.
            </div>
            <div className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
              Link here when a story or class discussion needs a report library rather than one isolated chart or one isolated record.
            </div>
            <div className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
              Use the flagship reports below when you need the most shareable pages for historical comparison, score context, or timeline framing.
            </div>
          </div>
        </div>
      </section>

      <DashboardFilterBar helpText="Browse reports by category or keyword. Flagship reports stay visible, but the hub is designed to move you into the right analysis path fast.">
        <form action="/reports" method="GET" className="flex flex-1 flex-wrap items-end gap-4">
          <label className="grid gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Search
            </span>
            <input
              type="search"
              name="q"
              defaultValue={resolvedSearchParams.q || ""}
              placeholder="Report title or theme"
              className="rounded-xl border border-white/8 bg-white/5 px-3 py-2.5 text-sm text-white"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Category
            </span>
            <select
              name="category"
              defaultValue={resolvedSearchParams.category || ""}
              className="rounded-xl border border-white/8 bg-white/5 px-3 py-2.5 text-sm text-white"
            >
              <option value="">All categories</option>
              {(data.reportCategories || []).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
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
            label: "Reports available",
            value: data.reportKpis?.report_count || 0,
            description: "Structured public analyses currently available from the shared reporting layer.",
            tone: "accent",
          },
          {
            label: "Featured reports",
            value: data.reportKpis?.featured_count || 0,
            description: "Flagship entry points into scores, context, and historical continuity.",
          },
          {
            label: "Presidents scored",
            value: data.reportKpis?.presidents_scored || 0,
            description: "Presidential profiles represented in the current score model.",
          },
          {
            label: "Strongest category",
            value: strongestCategory,
            description: "Category with the strongest visible net weighted impact in the current report summaries.",
          },
        ]}
      />

      {data.insights?.length ? (
        <section className="space-y-5">
          <SectionIntro
            eyebrow="Dataset observations"
            title="What the current report layer is highlighting"
            description="These are short factual readouts derived from the same structured data used by the report hub."
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Featured"
          title="Start with the flagship views"
          description="These are the clearest entry points for public users who want the score, the recent state of the dataset, and the longer historical arc."
        />
        <ReportCardGrid items={data.featuredReports || []} />
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Most shareable report paths"
          title="These are the strongest report pages to promote externally first"
          description="Use these report destinations when you need a serious summary page that can be cited, taught from, or linked before readers drill into underlying records."
        />
        <div className="grid gap-4 md:grid-cols-3">
          <Link href="/reports/black-impact-score" className="panel-link rounded-[1.4rem] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">Flagship report</p>
            <h3 className="mt-3 text-lg font-semibold text-white">Black Impact Score</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Best first report for journalists, researchers, and general readers who need a comparative synthesis page before opening presidents or policies.
            </p>
          </Link>
          <Link href="/reports/civil-rights-timeline" className="panel-link rounded-[1.4rem] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">Historical report</p>
            <h3 className="mt-3 text-lg font-semibold text-white">Civil Rights Timeline</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Best report when chronology matters and the reader needs the long civil-rights arc rather than one administration snapshot.
            </p>
          </Link>
          <Link href="/reports" className="panel-link rounded-[1.4rem] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">Report hub</p>
            <h3 className="mt-3 text-lg font-semibold text-white">Full reports library</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Best page to share when the audience needs a curated report layer rather than one isolated chart, scorecard, or dashboard slice.
            </p>
          </Link>
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Reference paths"
          title="Pair reports with methodology, sources, and guided context"
          description="The strongest outreach-ready pages usually combine a report with the methodology page, the source library, or a guided explainer path."
        />
        <div className="grid gap-4 md:grid-cols-3">
          <Link href="/methodology" className="panel-link rounded-[1.4rem] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">Methodology</p>
            <h3 className="mt-3 text-lg font-semibold text-white">Explain how the report was built</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Pair a report with the methodology page when a reader needs to understand score construction, evidence thresholds, and analytical limits.
            </p>
          </Link>
          <Link href="/sources" className="panel-link rounded-[1.4rem] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">Sources</p>
            <h3 className="mt-3 text-lg font-semibold text-white">Verify the evidence base directly</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Link the source library when the next question is about documentation, publisher quality, or the breadth of the visible evidence layer.
            </p>
          </Link>
          <Link href="/start" className="panel-link rounded-[1.4rem] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">Research guide</p>
            <h3 className="mt-3 text-lg font-semibold text-white">Give first-time readers a guided path</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Use the guided research page when the person you are sending here needs historical background before they can use the report layer well.
            </p>
          </Link>
        </div>
      </section>

      <section className="grid items-start gap-6 2xl:grid-cols-2">
        <CategoryImpactChart
          data={categoryChartData}
          title="Category impact snapshot"
          description="Reports are easier to read when issue-area concentration is visible. This chart shows where the strongest weighted impact sits right now."
        />
        <DirectionBreakdownChart
          data={directionData}
          title="Score inclusion snapshot"
          description="Included and excluded counts give users a fast read on how much of the underlying outcome pool is actually in the public score."
        />
      </section>

      <div className="rounded-[1.3rem] border border-white/8 bg-white/5 px-5 py-4 text-sm leading-7 text-[var(--ink-soft)]">
        Charts reflect underlying policy data in the EquityStack database.
      </div>

      <section className="public-two-col-rail grid items-start gap-6 2xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5">
          <SectionIntro
            eyebrow="All reports"
            title={`${reports.length} reports currently visible`}
            description="Use report cards as the jump layer into deeper analysis of presidents, legislation, civil-rights policy, and historical policy impact."
          />
          <ReportCardGrid items={reports} />
        </div>
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-1">
          <MethodologyCallout description="Reports summarize. They do not replace the underlying record. Each report should send users back into policies, promises, timeline entries, and source context when they need to verify a claim." />
          <CitationNote description="When referencing an EquityStack report externally, cite the report title, EquityStack, the page URL, and your access date. Reports summarize the current structured dataset and should be read alongside underlying records and methodology." />
          <div className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
            <h2 className="text-lg font-semibold text-white">About these reports</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Reports are generated from structured policy data in EquityStack. They are not opinion pieces. Each report aggregates policy-level analysis, evidence, and score context into a readable public summary.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Recent updates"
          title="Latest report-linked policy movement"
          description="Recent policy updates are the fastest way to move from report context into live policy records."
        />
        <RecentPolicyChangesTable
          items={(data.scores.records || [])
            .flatMap((record) => record.scored_outcomes || [])
            .slice(0, 8)
            .map((item, index) => ({
              id: item.policy_id || index,
              title: item.policy_title || item.title || item.outcome_summary || "Outcome update",
              summary: item.black_community_impact_note || item.measurable_impact || item.outcome_summary,
              date: item.impact_start_date || item.action_date || "—",
              impact_direction: item.impact_direction,
              slug: item.policy_slug || item.policy_id,
              record_type: "Policy",
            }))}
          buildHref={(item) =>
            item.slug ? `/policies/${item.slug}` : "/policies"
          }
        />
      </section>
    </main>
  );
}
