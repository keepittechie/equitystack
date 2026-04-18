import Link from "next/link";
import { notFound } from "next/navigation";
import { buildPageMetadata } from "@/lib/metadata";
import {
  fetchReportDetailData,
  fetchReportsHubData,
} from "@/lib/public-site-data";
import { getFlagshipReportEditorial } from "@/lib/flagship-editorial";
import StructuredData from "@/app/components/public/StructuredData";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  CitationNote,
  KpiCard,
  MethodologyCallout,
  PageContextBlock,
  SectionIntro,
} from "@/app/components/public/core";
import TrustBar from "@/app/components/public/TrustBar";
import ScoreExplanation from "@/app/components/public/ScoreExplanation";
import InsightCard from "@/app/components/public/InsightCard";
import {
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

export const dynamic = "force-dynamic";

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
  const [report, hub] = await Promise.all([
    fetchReportDetailData(slug),
    fetchReportsHubData(),
  ]);

  if (!report) {
    notFound();
  }

  const relatedPathCards = buildRelatedPathCards(report);
  const reportEditorial = getFlagshipReportEditorial(slug);

  return (
    <main className="space-y-10">
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

      <section className="hero-panel p-8 md:p-10 xl:p-14">
        <SectionIntro
          as="h1"
          eyebrow={report.category || "Report"}
          title={report.title}
          description={report.summary}
          actions={
            <>
              <Link href="/reports" className="public-button-secondary">
                Back to reports
              </Link>
              <Link href="/methodology" className="public-button-primary">
                Read methodology
              </Link>
            </>
          }
        />
      </section>

      <TrustBar />

      <section className="grid items-start gap-6 2xl:grid-cols-[1.05fr_0.95fr]">
        <PageContextBlock
          description="Report pages are EquityStack's interpretation layer. They synthesize patterns across the dataset, but they still need to route readers back to policies, presidents, promises, and sources."
          detail="Use this page when you want a higher-level answer first, then drill down into the underlying public record without losing the audit trail."
        />
        <div className="rounded-[1.6rem] border border-[rgba(132,247,198,0.18)] bg-[linear-gradient(145deg,rgba(14,36,33,0.72),rgba(8,14,24,0.96))] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
            Why this report matters
          </p>
          <h2 className="mt-4 text-2xl font-semibold text-white">Synthesis without losing the record</h2>
          <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">
            Search visitors often need more than a single policy page but less than a raw database view. This report is designed to bridge that gap, turning many records into a readable analytical frame while keeping the underlying evidence close by.
          </p>
        </div>
      </section>

      <section className="grid gap-6 2xl:grid-cols-[1.05fr_0.95fr]">
        <CitationNote
          title="Why readers cite this report"
          description={
            reportEditorial?.citationDescription ||
            "This page is best used as a reference when someone needs a concise analytical summary that still links back into the underlying records. Cite the report title, EquityStack, the report URL, and your access date, then link to the related policies, sources, or methodology page when precision matters."
          }
        />
        <div className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
            What this page covers
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-white">A reference page, not just a visualization layer</h2>
          <div className="mt-4 grid gap-3 text-sm leading-7 text-[var(--ink-soft)]">
            <div className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
              Use this page when the audience needs a readable summary before opening the underlying policy records.
            </div>
            <div className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
              The strongest use of a report page is as a bridge between broad interpretation, linked charts, related records, and visible methodology.
            </div>
            <div className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
              When the topic is contested or technical, pair this report with the source library or methodology page rather than treating the summary as self-sufficient.
            </div>
          </div>
        </div>
      </section>

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
          <div key={item.title} className="rounded-[1.4rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
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

      <section className="public-two-col-rail grid items-start gap-6 2xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5">
          <SectionIntro
            eyebrow="Findings"
            title="What this report shows"
            description="The report layer is designed for interpretation first, then drill-down into the evidence-bearing records below."
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
            <div className="rounded-[1.6rem] border border-dashed border-white/12 bg-white/4 p-6 text-sm leading-7 text-[var(--ink-soft)]">
              Narrative findings are not available for this report yet. Use the linked charts and records below for the structured view.
            </div>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-1">
          <div className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
            <h2 className="text-lg font-semibold text-white">Why researchers use this page</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              This report is generated from structured policy data in EquityStack. It is not an opinion piece. The analysis aggregates policy-level records, score context, and linked evidence into a readable public summary that can be shared before readers drill down into the records themselves.
            </p>
          </div>
          <CitationNote description="When referencing this report externally, cite the report title, EquityStack, the page URL, and your access date. The report summarizes the current structured dataset and should be read with the linked policy records, sources, and methodology." />
          <ScoreExplanation title="How to interpret score language in this report" />
          <MethodologyCallout description="This report is a structured reading layer, not a standalone claim. Use the related links, policies, and methodology access below to validate what the report is summarizing." />
          <div className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5 md:col-span-2 xl:col-span-1">
            <h2 className="text-lg font-semibold text-white">Related paths</h2>
            <div className="mt-4 grid gap-3">
              {relatedPathCards.map((item) => (
                <Link key={item.href} href={item.href} className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4 hover:border-[rgba(132,247,198,0.24)]">
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
        <section className="rounded-[1.6rem] border border-dashed border-white/12 bg-white/4 p-6 text-sm leading-7 text-[var(--ink-soft)]">
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
          <div className="grid items-start gap-6 2xl:grid-cols-3">
            {["positive", "mixed", "negative"].map((bucket) => (
              <div key={bucket} className="space-y-4">
                <h3 className="text-lg font-semibold text-white capitalize">{bucket} records</h3>
                <PolicyCardList
                  items={report.topPolicies[bucket] || []}
                  buildHref={(item) => `/policies/${item.slug || item.id}`}
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

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Continue exploring"
          title="Continue through reports, explainers, public records, and trust pages"
          description="Reports should open outward into the rest of the site. Use these next steps to move into adjacent analysis, underlying records, or the trust pages that explain and verify the public record."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Link href="/explainers" className="panel-link rounded-[1.4rem] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">Historical context</p>
            <h3 className="mt-3 text-lg font-semibold text-white">Read related explainers</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Explain how the historical, legal, or policy background supports the patterns summarized in this report.
            </p>
          </Link>
          <Link href="/presidents" className="panel-link rounded-[1.4rem] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">Entity profiles</p>
            <h3 className="mt-3 text-lg font-semibold text-white">Compare presidential records</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Move from this summary into president-level profiles when the question is really about administrations and long-term historical comparison.
            </p>
          </Link>
          <Link href="/policies" className="panel-link rounded-[1.4rem] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">Underlying records</p>
            <h3 className="mt-3 text-lg font-semibold text-white">Browse the policy evidence</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Use the policy explorer when you want the laws, executive actions, and court decisions underneath the report&apos;s main findings.
            </p>
          </Link>
          <Link href="/research" className="panel-link rounded-[1.4rem] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">Research hub</p>
            <h3 className="mt-3 text-lg font-semibold text-white">Return to the broader research hub</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Use the research hub when this report leads into a larger question about presidents, legislation, promises, explainers, or methods.
            </p>
          </Link>
        </div>
        <ReportCardGrid
          items={
            report.relatedReports?.length
              ? report.relatedReports
              : hub.reports.filter((item) => item.slug !== slug).slice(0, 3)
          }
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {CONTINUE_EXPLORING_CARDS.map((item) => (
            <Link key={item.href} href={item.href} className="panel-link rounded-[1.4rem] p-5">
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
