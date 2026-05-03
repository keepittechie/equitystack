import Link from "next/link";
import { notFound } from "next/navigation";
import { buildPageMetadata } from "@/lib/metadata";
import {
  fetchExplainersIndexData,
  fetchReportDetailData,
  fetchReportsHubData,
} from "@/lib/public-site-data";
import { getFlagshipReportEditorial } from "@/lib/flagship-editorial";
import StructuredData from "@/app/components/public/StructuredData";
import { Breadcrumbs } from "@/app/components/public/chrome";
import PageRoleCallout from "@/app/components/public/PageRoleCallout";
import DiscoveryGuidancePanel from "@/app/components/public/DiscoveryGuidancePanel";
import {
  KpiCard,
  SectionIntro,
} from "@/app/components/public/core";
import TrustBar from "@/app/components/public/TrustBar";
import ScoreExplanation from "@/app/components/public/ScoreExplanation";
import InsightCard from "@/app/components/public/InsightCard";
import {
  ExplainerIndexGrid,
  PolicyCardList,
  RecentPolicyChangesTable,
  ReportCardGrid,
} from "@/app/components/public/entities";
import {
  CategoryImpactChart,
  DirectionBreakdownChart,
  ImpactTrendChart,
} from "@/app/components/public/charts";
import {
  buildBreadcrumbJsonLd,
  buildReportJsonLd,
} from "@/lib/structured-data";
import { Panel } from "@/app/components/dashboard/primitives";

export const dynamic = "force-dynamic";

const REPORT_SUGGESTED_EXPLAINER_FALLBACKS = {
  "black-impact-score": [
    "systemic-vs-individual-racism-claims",
    "anecdote-vs-data-claims",
    "disparate-impact-vs-intent-claims",
  ],
  "civil-rights-timeline": [
    "states-rights-vs-civil-rights-claims",
    "disparate-impact-vs-intent-claims",
    "party-voting-records-racial-policy",
  ],
  "historical-distribution": [
    "party-voting-records-racial-policy",
    "systemic-vs-individual-racism-claims",
    "disparate-impact-vs-intent-claims",
  ],
  "executive-overview": [
    "systemic-vs-individual-racism-claims",
    "anecdote-vs-data-claims",
    "equal-opportunity-claims",
  ],
};

function buildRelatedPathCards(report) {
  const fallbackTitle = report.category || report.theme || "this report";

  return (report.relatedLinks || []).map((item) => {
    if (item.href === "/methodology") {
      return {
        ...item,
        eyebrow: "Methodology",
        title: `Read the methodology behind ${fallbackTitle.toLowerCase()}`,
        description:
          "Use the methodology page to check how scores, evidence thresholds, source quality, and classification rules shape the analysis on this report page.",
      };
    }

    if (item.href === "/dashboard") {
      return {
        ...item,
        eyebrow: "Dashboard",
        title: "Open the live public dashboard",
        description:
          "The dashboard is the fastest path from report summary into live score snapshots, recent policy movement, and the current public dataset state.",
      };
    }

    if (item.href === "/timeline") {
      return {
        ...item,
        eyebrow: "Timeline",
        title: "View the same historical record chronologically",
        description:
          "The timeline helps when sequence matters more than category grouping, especially for legal change, rollback, and reform over time.",
      };
    }

    if (item.href === "/policies") {
      return {
        ...item,
        eyebrow: "Policy explorer",
        title: "Browse the underlying policy records",
        description:
          "Use the policy explorer to verify the individual laws, executive actions, and court decisions that sit underneath this report summary.",
      };
    }

    if (item.href === "/sources") {
      return {
        ...item,
        eyebrow: "Sources",
        title: "Inspect the source library behind this analysis",
        description:
          "Use the source library when you need to verify the evidence base, trace publisher quality, or move from report summary into documentation.",
      };
    }

    return {
      ...item,
      eyebrow: "Related path",
      title: item.label,
      description: "Continue into another part of the public site for deeper context and source-backed detail.",
    };
  });
}

const CONTINUE_EXPLORING_CARDS = [
  {
    href: "/research",
    eyebrow: "Research hub",
    title: "Return to the curated research hub",
    description:
      "Use the research hub when this report opens into a broader question and you need the strongest next thematic, explainer, or methodology path.",
  },
  {
    href: "/methodology",
    eyebrow: "Methodology",
    title: "Review methodology before citing the analysis",
    description:
      "Read the methodology page when you need to understand how scores, source rules, confidence, and interpretation shape the report layer.",
  },
  {
    href: "/sources",
    eyebrow: "Sources",
    title: "Inspect the evidence behind the report",
    description:
      "Use the source library when the next step is verifying the visible documentation behind the records summarized here.",
  },
  {
    href: "/start",
    eyebrow: "How to use EquityStack",
    title: "Follow the guided research path",
    description:
      "Use the start page when a reader needs orientation before moving between explainers, reports, records, and methodology.",
  },
];

const REPORT_SYSTEM_GUIDANCE = [
  {
    href: "/policies",
    label: "Underlying records",
    tone: "verified",
    title: "This report builds on policy and promise records",
    description:
      "Use the record layer when you need the concrete law, executive action, court decision, or promise trail underneath the synthesis.",
  },
  {
    href: "/explainers",
    label: "Context",
    tone: "default",
    title: "Explainers help interpret why the report matters",
    description:
      "Use explainers when the findings need constitutional, historical, or institutional framing before they can be read well.",
  },
  {
    href: "/sources",
    label: "Evidence",
    tone: "info",
    title: "Sources help verify what the report is summarizing",
    description:
      "Use the source library when the next step is checking the evidence base, publisher mix, or linked support beneath the report.",
  },
];

function renderChartBlock(block, index) {
  const key = `${block.title}-${index}`;
  if (block.type === "trend") {
    return (
      <ImpactTrendChart
        key={key}
        data={block.data || []}
        title={block.title}
        description={block.description}
      />
    );
  }
  if (block.type === "direction") {
    return (
      <DirectionBreakdownChart
        key={key}
        data={block.data || []}
        title={block.title}
        description={block.description}
      />
    );
  }
  return (
    <CategoryImpactChart
      key={key}
      data={block.data || []}
      title={block.title}
      description={block.description}
      dataKey={block.dataKey || "score"}
    />
  );
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const report = await fetchReportDetailData(slug);

  if (!report) {
    return buildPageMetadata({
      title: "Report Not Found",
      description: "The requested report does not exist in the public report layer.",
      path: `/reports/${slug}`,
    });
  }

  return buildPageMetadata({
    title: `${report.title} | Policy impact report`,
    description:
      report.summary ||
      "Structured public reporting on Black history, presidents, and policy impact on EquityStack.",
    path: `/reports/${slug}`,
    keywords: [
      report.category,
      report.theme,
      "policy impact report",
      "Black history report",
    ].filter(Boolean),
  });
}

export default async function ReportDetailPage({ params }) {
  const { slug } = await params;
  const [report, hub, explainersIndex] = await Promise.all([
    fetchReportDetailData(slug),
    fetchReportsHubData(),
    fetchExplainersIndexData(),
  ]);

  if (!report) {
    notFound();
  }

  const relatedPathCards = buildRelatedPathCards(report);
  const reportEditorial = getFlagshipReportEditorial(slug);
  const explainersBySlug = new Map(
    (explainersIndex.items || []).map((item) => [item.slug, item])
  );
  const fallbackSuggestedExplainers = (REPORT_SUGGESTED_EXPLAINER_FALLBACKS[slug] || [])
    .map((itemSlug) => explainersBySlug.get(itemSlug))
    .filter(Boolean);
  const suggestedExplainers = [
    ...fallbackSuggestedExplainers,
    ...(report.suggested_explainers || []),
  ].filter((item, index, items) => {
    if (!item?.slug || !item?.title) {
      return false;
    }
    return items.findIndex((candidate) => candidate?.slug === item.slug) === index;
  }).slice(0, 3);

  return (
    <main className="space-y-4">
      <StructuredData
        data={[
          buildBreadcrumbJsonLd(
            [
              { href: "/", label: "Home" },
              { href: "/reports", label: "Reports" },
              { label: report.title },
            ],
            `/reports/${slug}`
          ),
          buildReportJsonLd({
            title: report.title,
            description: report.summary,
            path: `/reports/${slug}`,
            section: report.category || "Report",
            datePublished: report.published_at || report.created_at,
            dateModified: report.updated_at,
            about: [
              "Black history",
              "U.S. presidents",
              "civil rights policy",
              "historical policy impact",
            ],
            keywords: [
              report.theme,
              report.category,
              "policy impact report",
            ].filter(Boolean),
          }),
        ]}
      />
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/reports", label: "Reports" },
          { label: report.title },
        ]}
      />

      <Panel prominence="primary" className="overflow-hidden">
        <div className="p-4">
          <SectionIntro
            as="h1"
            eyebrow={report.category || "Report"}
            title={report.title}
            description={report.summary}
            actions={
              <>
                <Link href="/reports" className="dashboard-button-secondary">
                  Back to reports
                </Link>
                <Link href="/methodology" className="dashboard-button-primary">
                  Read methodology
                </Link>
              </>
            }
          />
        </div>
      </Panel>

      <TrustBar />

      {report.metrics?.length ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {report.metrics.map((item) => (
            <KpiCard
              key={item.label}
              label={item.label}
              value={item.value}
              description={item.description}
              tone="accent"
            />
          ))}
        </section>
      ) : null}

      <section className="space-y-6">
        <div className="space-y-5">
          <SectionIntro
            eyebrow="Findings"
            title="What this report shows"
            description="Read the findings first, then open the linked policy records or recent updates below when you need to verify what is driving the takeaway."
          />
          {report.findings?.length ? (
            <div className="grid gap-3">
              {report.findings.map((item, index) => (
                <InsightCard
                  key={`${item.title || item.text || index}-${index}`}
                  title={item.title || "Finding"}
                  text={item.text || item}
                />
              ))}
            </div>
          ) : (
            <div className="dashboard-empty-state text-sm leading-7 text-[var(--ink-soft)]">
              Narrative findings are not available for this report yet. Use the linked charts and records below for the structured view.
            </div>
          )}
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4">
            <h2 className="text-lg font-semibold text-white">Best next step from this page</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Use this report for the high-level takeaway first. Then open the linked policy records if you need the record trail, the source library if you need the evidence trail, or methodology if the main question is how the summary was constructed.
            </p>
          </div>
          <DiscoveryGuidancePanel
            eyebrow="How this report supports the platform"
            title="Read this report with context and evidence nearby"
            description="Reports summarize patterns. They work best when paired with context pages and the underlying evidence layer."
            items={REPORT_SYSTEM_GUIDANCE}
          />
          <ScoreExplanation title="How to interpret score language in this report" />
          <div className="rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4">
            <h2 className="text-lg font-semibold text-white">Related paths</h2>
            <div className="mt-4 grid gap-3">
              {relatedPathCards.map((item) => (
                <Link key={item.href} href={item.href} className="rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.52)] p-4 hover:border-[rgba(132,247,198,0.24)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                    {item.eyebrow}
                  </p>
                  <h3 className="mt-2 text-base font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <PageRoleCallout
        title="Use reports as the synthesis layer"
        description="Reports are the synthesis layer. They summarize patterns across many underlying records. Use sources as the evidence layer for verification and explainers as the context layer for interpretation."
        links={[
          { href: "/policies", label: "Underlying records" },
          { href: "/explainers", label: "Explainers" },
          { href: "/sources", label: "Sources" },
        ]}
      />

      {report.chartBlocks?.length ? (
        <>
          <section className="grid items-start gap-6 2xl:grid-cols-2">
            {report.chartBlocks.map((block, index) => renderChartBlock(block, index))}
          </section>
          <div className="rounded-[1.3rem] border border-white/8 bg-white/5 px-5 py-4 text-sm leading-7 text-[var(--ink-soft)]">
            Charts reflect underlying policy data in the EquityStack database.
          </div>
        </>
      ) : (
        <section className="dashboard-empty-state text-sm leading-7 text-[var(--ink-soft)]">
          This report does not currently expose structured chart data.
        </section>
      )}

      {report.topPolicies ? (
        <section className="space-y-5">
          <SectionIntro
            eyebrow="Policy drivers"
            title="Linked policy records"
            description="These policy records are the fastest way to move from summary interpretation into the underlying public evidence."
          />
          <div className="grid items-start gap-8 2xl:grid-cols-3">
            {["positive", "mixed", "negative"].map((bucket) => (
              <div key={bucket} className="space-y-5">
                <h3 className="text-lg font-semibold text-white capitalize">{bucket} records</h3>
                <PolicyCardList
                  items={report.topPolicies[bucket] || []}
                  buildHref={(item) => `/policies/${item.slug || item.id}`}
                  listClassName="grid gap-6"
                  cardPadding="none"
                  cardClassName="p-5 md:p-6"
                  spacing="relaxed"
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {report.latestUpdates?.length ? (
        <section className="space-y-5">
          <SectionIntro
            eyebrow="Latest movement"
            title="Recent updates in this report frame"
            description="Use recent changes to jump directly into the most recent records contributing to this analytical view."
          />
          <RecentPolicyChangesTable
            items={report.latestUpdates.map((item) => ({
              ...item,
              record_type: "Policy",
            }))}
            buildHref={(item) => `/policies/${item.slug || item.id}`}
          />
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        {(reportEditorial?.cards || [
          {
            title: "What this report does",
            description:
              "Use the report layer when the first question is comparative or interpretive and the reader needs a concise synthesis before opening individual policy pages.",
          },
          {
            title: "What it does not do",
            description:
              "A report summarizes the current public dataset. It should still be paired with linked policy pages, the source library, or methodology when the topic is contested or highly specific.",
          },
          {
            title: "Best next step",
            description:
              "Read the findings first, then move into the linked records, charts, and trust pages rather than treating the report summary as self-sufficient.",
          },
        ]).map((item) => (
          <div key={item.title} className="rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
              Flagship note
            </p>
            <h2 className="mt-3 text-lg font-semibold text-white">{item.title}</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              {item.description}
            </p>
          </div>
        ))}
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Continue exploring"
          title="Continue through reports, explainers, public records, and trust pages"
          description="Choose the next path based on your question: explainers for context, president or policy pages for records, and trust pages for verification."
        />
        {suggestedExplainers.length ? (
          <div className="space-y-4">
            <Panel padding="md" className="space-y-2">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                Suggested explainers
              </p>
              <h2 className="text-lg font-semibold text-white">
                Start with the closest context explainer
              </h2>
              <p className="text-sm leading-7 text-[var(--ink-soft)]">
                These explainers are matched from the report&apos;s theme, findings, and likely public claim patterns. Argument-mechanics explainers rise first when the report is likely to trigger a recurring debate frame.
              </p>
            </Panel>
            <ExplainerIndexGrid items={suggestedExplainers} />
          </div>
        ) : null}
        <ReportCardGrid
          items={
            report.relatedReports?.length
              ? report.relatedReports
              : hub.reports.filter((item) => item.slug !== slug).slice(0, 3)
          }
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Link href="/explainers" className="panel-link p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">Historical context</p>
            <h3 className="mt-3 text-lg font-semibold text-white">Read related explainers</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Explain how the historical, legal, or policy background supports the patterns summarized in this report.
            </p>
          </Link>
          <Link href="/presidents" className="panel-link p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">Entity profiles</p>
            <h3 className="mt-3 text-lg font-semibold text-white">Compare presidential records</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Move from this summary into president-level profiles when the question is really about administrations and long-term historical comparison.
            </p>
          </Link>
          <Link href="/policies" className="panel-link p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">Underlying records</p>
            <h3 className="mt-3 text-lg font-semibold text-white">Browse the policy evidence</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Use the policy explorer when you want the laws, executive actions, and court decisions underneath the report&apos;s main findings.
            </p>
          </Link>
          <Link href="/research" className="panel-link p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">Research hub</p>
            <h3 className="mt-3 text-lg font-semibold text-white">Return to the broader research hub</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Use the research hub when this report leads into a larger question about presidents, legislation, promises, explainers, or methods.
            </p>
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {CONTINUE_EXPLORING_CARDS.map((item) => (
            <Link key={item.href} href={item.href} className="panel-link p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                {item.eyebrow}
              </p>
              <h3 className="mt-3 text-lg font-semibold text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                {item.description}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
