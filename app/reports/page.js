import Link from "next/link";
import { buildListingMetadata } from "@/lib/metadata";
import { fetchReportsHubData } from "@/lib/public-site-data";
import {
  assertSerializableClientProps,
  normalizeToClientSafeObject,
} from "@/app/lib/client-contract";
import StructuredData from "@/app/components/public/StructuredData";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  CitationNote,
  DashboardFilterBar,
  ImpactOverviewCards,
  MethodologyCallout,
  SectionIntro,
} from "@/app/components/public/core";
import { Panel } from "@/app/components/dashboard/primitives";
import {
  ReportCardGrid,
} from "@/app/components/public/entities";
import ReportLinkedPolicyMovement from "./ReportLinkedPolicyMovement";
import { fetchDashboardPolicyRankings } from "@/lib/services/dashboardPolicyService";
import {
  CategoryImpactChart,
  DirectionBreakdownChart,
} from "@/app/components/public/charts";
import TrustBar from "@/app/components/public/TrustBar";
import InsightCard from "@/app/components/public/InsightCard";
import {
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
  buildDatasetJsonLd,
  buildItemListJsonLd,
} from "@/lib/structured-data";

export const dynamic = "force-dynamic";

const PLACEHOLDER_LABELS = new Set([
  "outcome update",
  "policy outcome",
  "promise record",
  "tracked bill",
  "record",
  "policy",
]);

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isUsefulLabel(value) {
  const text = cleanText(value);
  const normalized = text.toLowerCase();

  if (!text || text === "—" || PLACEHOLDER_LABELS.has(normalized)) {
    return false;
  }

  return !/^policy outcome\s+\d+$/i.test(text);
}

function toFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatSignedScore(value) {
  const numeric = toFiniteNumber(value);
  if (numeric == null) {
    return null;
  }

  const formatted = Number.isInteger(numeric) ? String(Math.abs(numeric)) : Math.abs(numeric).toFixed(1);
  if (numeric > 0) {
    return `+${formatted} Black Impact`;
  }
  if (numeric < 0) {
    return `-${formatted} Black Impact`;
  }
  return "No score change";
}

function buildScoreImpactLabel(item = {}, direction) {
  const explicitDelta = toFiniteNumber(item.score_delta);
  if (explicitDelta != null) {
    return formatSignedScore(explicitDelta);
  }

  const previousScore = toFiniteNumber(item.previous_score);
  const currentScore = toFiniteNumber(item.current_score);
  if (previousScore != null && currentScore != null) {
    return formatSignedScore(currentScore - previousScore);
  }

  const impactScore = toFiniteNumber(item.impact_score ?? item.black_impact_score);
  if (impactScore != null) {
    return formatSignedScore(impactScore);
  }

  const normalizedDirection = cleanText(direction).toLowerCase();
  if (normalizedDirection.includes("positive")) return "Positive signal";
  if (normalizedDirection.includes("negative")) return "Negative signal";
  if (normalizedDirection.includes("mixed")) return "Mixed signal";
  if (normalizedDirection.includes("blocked") || normalizedDirection.includes("stalled")) {
    return "Stalled";
  }

  return cleanText(item.score_status) || "Pending score";
}

function buildWhyThisMattersText(item = {}, recordType, direction) {
  const directText =
    cleanText(item.why_it_matters) ||
    cleanText(item.impact_summary) ||
    cleanText(item.summary) ||
    cleanText(item.evidence_notes) ||
    cleanText(item.source_notes);

  if (directText) {
    return directText.split(/\s+/).slice(0, 48).join(" ");
  }

  const normalizedType = cleanText(recordType).toLowerCase();
  const normalizedDirection = cleanText(direction).toLowerCase();

  if (normalizedType.includes("bill") && normalizedDirection.includes("blocked")) {
    return "This tracked bill has not reached enacted status, so its downstream community impact remains pending.";
  }
  if (normalizedType.includes("promise") && normalizedDirection.includes("positive")) {
    return "This promise is linked to a documented action that moved in a positive direction.";
  }
  if (normalizedType.includes("promise") && normalizedDirection.includes("mixed")) {
    return "This promise shows partial progress with unresolved outcomes.";
  }
  if (normalizedType.includes("policy") && normalizedDirection.includes("negative")) {
    return "This update reflects a documented negative shift in the tracked policy record.";
  }

  return "This update connects a tracked record to policy movement or reviewed evidence.";
}

function buildReportLinkedPolicyUpdates(items = []) {
  const seen = new Set();

  return items
    .map((item) => {
      const title = cleanText(item.title);
      const linkedRecordTitle = cleanText(
        item.linked_record_title || item.linked_record
      );
      const summary = cleanText(item.summary);
      const date = item.date || item.latest_action_date || null;
      const direction = cleanText(item.impact_direction || item.status);

      if (!isUsefulLabel(title) || !isUsefulLabel(linkedRecordTitle)) {
        return null;
      }

      if (!date && !summary && !direction) {
        return null;
      }

      const dedupeKey = [
        title.toLowerCase(),
        linkedRecordTitle.toLowerCase(),
        String(date || ""),
        direction.toLowerCase(),
      ].join("|");

      if (seen.has(dedupeKey)) {
        return null;
      }
      seen.add(dedupeKey);

      return {
        ...item,
        title,
        summary,
        date,
        href: item.linked_record_href || item.href || "/policies",
        impact_direction: direction || null,
        score_impact_label: buildScoreImpactLabel(item, direction),
        why_this_matters_text: buildWhyThisMattersText(
          item,
          item.linked_record_type || item.record_type || item.policy_type,
          direction
        ),
        linked_record_title: linkedRecordTitle,
        record_type: item.linked_record_type || item.record_type || "Policy",
      };
    })
    .filter(Boolean)
    .slice(0, 8);
}

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
  const [data, policyRankings] = await Promise.all([
    fetchReportsHubData(resolvedSearchParams),
    fetchDashboardPolicyRankings({ latestLimit: 16 }),
  ]);
  const reports = data.filteredReports || [];
  const reportLinkedPolicyUpdates = buildReportLinkedPolicyUpdates(
    policyRankings.latestPolicyUpdates || []
  );
  const safeReportLinkedPolicyUpdates = reportLinkedPolicyUpdates.map((row) =>
    normalizeToClientSafeObject(row)
  );
  assertSerializableClientProps(
    safeReportLinkedPolicyUpdates,
    "ReportLinkedPolicyMovement.items"
  );
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
    <main className="space-y-4">
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

      <section className="hero-panel p-4">
        <SectionIntro
          as="h1"
          eyebrow="Analysis hub"
          title="Read Black history, policy impact, and evidence side by side."
          description="Reports are the public intelligence layer on top of the browseable database. Use them to move from headline interpretation into policy records, promise evidence, timelines, and methodology without losing the audit trail."
          actions={
            <>
              <Link href="/dashboard" className="dashboard-button-primary">
                Open dashboard
              </Link>
              <Link href="/methodology" className="dashboard-button-secondary">
                Read methodology
              </Link>
            </>
          }
        />
      </section>

      <TrustBar />

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
              className="dashboard-field"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Category
            </span>
            <select
              name="category"
              defaultValue={resolvedSearchParams.category || ""}
              className="dashboard-field"
            >
              <option value="">All categories</option>
              {(data.reportCategories || []).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
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

      <section className="space-y-4">
        <SectionIntro
          eyebrow="Featured"
          title="Start with the flagship views"
          description="Start with one of these when you need the key takeaway first. Then open presidents, policies, or methodology from the linked report."
        />
        <ReportCardGrid items={data.featuredReports || []} />
        <Panel padding="md" className="bg-[rgba(18,31,49,0.52)]">
          <p className="text-sm leading-6 text-[var(--ink-soft)]">
            Best first click: start with <span className="font-semibold text-white">Black Impact Score</span> for ranked comparison, or use <span className="font-semibold text-white">Civil Rights Timeline</span> when sequence matters more than ranking.
          </p>
        </Panel>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Most shareable report paths"
          title="These are the strongest report pages to promote externally first"
          description="Use these report destinations when you need a serious summary page that can be cited, taught from, or linked before readers drill into underlying records."
        />
        <div className="grid gap-4 md:grid-cols-3">
          <Link href="/reports/black-impact-score" className="panel-link p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">Flagship report</p>
            <h3 className="mt-3 text-lg font-semibold text-white">Black Impact Score</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Best first report for journalists, researchers, and general readers who need a comparative synthesis page before opening presidents or policies.
            </p>
          </Link>
          <Link href="/reports/civil-rights-timeline" className="panel-link p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">Historical report</p>
            <h3 className="mt-3 text-lg font-semibold text-white">Civil Rights Timeline</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Best report when chronology matters and the reader needs the long civil-rights arc rather than one administration snapshot.
            </p>
          </Link>
          <Link href="/reports" className="panel-link p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">Report hub</p>
            <h3 className="mt-3 text-lg font-semibold text-white">Full reports library</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Best page to share when the audience needs a curated report layer rather than one isolated chart, scorecard, or dashboard slice.
            </p>
          </Link>
        </div>
      </section>

      <section className="space-y-4">
        <SectionIntro
          eyebrow="Reference paths"
          title="Pair reports with methodology, sources, and guided context"
          description="The strongest outreach-ready pages usually combine a report with the methodology page, the source library, or a guided explainer path."
        />
        <div className="grid gap-4 md:grid-cols-3">
          <Link href="/methodology" className="panel-link p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">Methodology</p>
            <h3 className="mt-3 text-lg font-semibold text-white">Explain how the report was built</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Pair a report with the methodology page when a reader needs to understand score construction, evidence thresholds, and analytical limits.
            </p>
          </Link>
          <Link href="/sources" className="panel-link p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">Sources</p>
            <h3 className="mt-3 text-lg font-semibold text-white">Verify the evidence base directly</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Link the source library when the next question is about documentation, publisher quality, or the breadth of the visible evidence layer.
            </p>
          </Link>
          <Link href="/start" className="panel-link p-4">
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

      <Panel padding="md" className="bg-[rgba(18,31,49,0.52)] text-sm leading-7 text-[var(--ink-soft)]">
        Charts reflect underlying policy data in the EquityStack database.
      </Panel>

      <section className="space-y-4">
        <Panel padding="md" className="space-y-4">
        <SectionIntro
          eyebrow="All reports"
          title={`${reports.length} reports currently visible`}
          description="Use report cards as the jump layer into deeper analysis. Open one report, then move into the linked records or methodology when you need verification."
        />
          <ReportCardGrid items={reports} />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MethodologyCallout description="Reports summarize. They do not replace the underlying record. Each report should send users back into policies, promises, timeline entries, and source context when they need to verify a claim." />
          <CitationNote description="When referencing an EquityStack report externally, cite the report title, EquityStack, the page URL, and your access date. Reports summarize the current structured dataset and should be read alongside underlying records and methodology." />
          <Panel padding="md" className="bg-[rgba(18,31,49,0.52)]">
            <h2 className="text-lg font-semibold text-white">About these reports</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Reports are generated from structured policy data in EquityStack. They are not opinion pieces. Each report aggregates policy-level analysis, evidence, and score context into a readable public summary.
            </p>
          </Panel>
          </div>
        </Panel>
      </section>

      <section className="space-y-4">
        <SectionIntro
          eyebrow="Recent updates"
          title="Latest report-linked policy movement"
          description="Recent policy updates are the fastest way to move from report context into live policy records."
        />
        <ReportLinkedPolicyMovement
          items={safeReportLinkedPolicyUpdates}
          emptyTitle="No report-linked policy updates are available yet."
          emptyDescription="As report findings are connected to live policy records, they will appear here."
        />
      </section>
    </main>
  );
}
