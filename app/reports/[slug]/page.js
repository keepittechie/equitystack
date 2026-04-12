import Link from "next/link";
import { notFound } from "next/navigation";
import { buildPageMetadata } from "@/lib/metadata";
import {
  fetchReportDetailData,
  fetchReportsHubData,
} from "@/lib/public-site-data";
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
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
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

    return {
      ...item,
      eyebrow: "Related path",
      title: item.label,
      description: "Continue into another part of the public site for deeper context and source-backed detail.",
    };
  });
}

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
          buildArticleJsonLd({
            title: report.title,
            description: report.summary,
            path: `/reports/${slug}`,
            section: report.category || "Report",
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

      <section className="grid items-start gap-6 xl:grid-cols-[1.05fr_0.95fr]">
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

      <section className="public-two-col-rail grid items-start gap-6 xl:grid-cols-[1.15fr_0.85fr]">
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
          <div className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
            <h2 className="text-lg font-semibold text-white">About this report</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              This report is generated from structured policy data in EquityStack. It is not an opinion piece. The analysis aggregates policy-level records, score context, and linked evidence into a readable public summary.
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
          <section className="grid items-start gap-6 xl:grid-cols-2">
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
          <div className="grid items-start gap-6 xl:grid-cols-3">
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
          eyebrow="Related analysis"
          title="Continue through reports, explainers, and public records"
          description="Reports should open outward into the rest of the site. Use these next steps to move into adjacent analysis or back down into the underlying public record."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
        </div>
        <ReportCardGrid
          items={
            report.relatedReports?.length
              ? report.relatedReports
              : hub.reports.filter((item) => item.slug !== slug).slice(0, 3)
          }
        />
      </section>
    </main>
  );
}
