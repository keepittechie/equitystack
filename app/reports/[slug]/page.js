import Link from "next/link";
import { notFound } from "next/navigation";
import { buildPageMetadata } from "@/lib/metadata";
import {
  fetchReportDetailData,
  fetchReportsHubData,
} from "@/lib/public-site-data";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  CitationNote,
  KpiCard,
  MethodologyCallout,
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

export const dynamic = "force-dynamic";

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
    title: `${report.title} | Reports`,
    description: report.summary || "Structured public reporting on EquityStack.",
    path: `/reports/${slug}`,
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

  return (
    <main className="space-y-10">
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

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
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
        <div className="space-y-5">
          <div className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
            <h2 className="text-lg font-semibold text-white">About this report</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              This report is generated from structured policy data in EquityStack. It is not an opinion piece. The analysis aggregates policy-level records, score context, and linked evidence into a readable public summary.
            </p>
          </div>
          <CitationNote description="When referencing this report externally, cite the report title, EquityStack, the page URL, and your access date. The report summarizes the current structured dataset and should be read with the linked policy records, sources, and methodology." />
          <ScoreExplanation title="How to interpret score language in this report" />
          <MethodologyCallout description="This report is a structured reading layer, not a standalone claim. Use the related links, policies, and methodology access below to validate what the report is summarizing." />
          <div className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
            <h2 className="text-lg font-semibold text-white">Related paths</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {(report.relatedLinks || []).map((item) => (
                <Link key={item.href} href={item.href} className="public-button-secondary">
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {report.chartBlocks?.length ? (
        <>
          <section className="grid gap-6 xl:grid-cols-2">
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
          <div className="grid gap-6 xl:grid-cols-3">
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
          title="Keep reading across the public analysis layer"
          description="Reports, explainers, and profile pages are meant to reinforce one another rather than live in separate silos."
        />
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
