import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import { fetchSourcesLibraryData } from "@/lib/public-site-data";
import StructuredData from "@/app/components/public/StructuredData";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  CitationNote,
  DashboardFilterBar,
  ImpactOverviewCards,
  MethodologyCallout,
  SectionIntro,
  SourceTrustPanel,
} from "@/app/components/public/core";
import { Panel } from "@/app/components/dashboard/primitives";
import { SourceLibraryTable } from "@/app/components/public/entities";
import {
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
  buildDatasetJsonLd,
} from "@/lib/structured-data";

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "Sources",
  description:
    "Browse the public source library behind EquityStack’s policy, promise, and outcome records.",
  path: "/sources",
});

export default async function SourcesPage({ searchParams }) {
  const resolvedSearchParams = (await searchParams) || {};
  const query = String(resolvedSearchParams.q || "");
  const sources = await fetchSourcesLibraryData(query);
  const linkedTotal = sources.reduce(
    (total, item) => total + Number(item.linked_record_count || 0),
    0
  );
  const highAuthorityCount = sources.filter(
    (item) => item.trust_label === "High authority"
  ).length;

  return (
    <main className="space-y-8">
      <StructuredData
        data={[
          buildBreadcrumbJsonLd(
            [{ href: "/", label: "Home" }, { label: "Sources" }],
            "/sources"
          ),
          buildCollectionPageJsonLd({
            title: "EquityStack public source library",
            description:
              "Browse the public source library behind EquityStack’s policy, promise, outcome, and report records.",
            path: "/sources",
            about: [
              "public source library",
              "policy evidence",
              "promise evidence",
              "Black Americans",
            ],
            keywords: [
              "EquityStack sources",
              "policy evidence library",
              "source library for Black policy research",
            ],
          }),
          buildDatasetJsonLd({
            title: "EquityStack public source library dataset",
            description:
              "Structured source records showing publisher, source type, trust labels, and linked-record counts across the public EquityStack site.",
            path: "/sources",
            about: [
              "public source library",
              "source quality",
              "policy evidence",
            ],
            keywords: [
              "policy evidence library",
              "source library for Black policy research",
            ],
            variableMeasured: [
              "Source type",
              "Trust label",
              "Linked record count",
              "Publisher",
            ],
          }),
        ]}
      />
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Sources" }]} />

      <section className="hero-panel p-8 md:p-10 xl:p-14">
        <SectionIntro
          as="h1"
          eyebrow="Source library"
          title="Browse the evidence behind EquityStack’s public record."
          description="The source library gives users a direct view into the public evidence base behind policies, promises, and outcomes. Use it to inspect source types, publishers, linked-record counts, and coverage depth."
          actions={
            <>
              <Link href="/methodology" className="dashboard-button-primary">
                Read evidence rules
              </Link>
              <Link href="/research" className="dashboard-button-secondary">
                Open research hub
              </Link>
              <Link href="/search" className="dashboard-button-secondary">
                Universal search
              </Link>
            </>
          }
        />
      </section>

      <Panel padding="md">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
          How sources are used
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-white">
          Sources verify claims, support impact classification, and provide historical grounding.
        </h2>
        <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">
          In this library, trust refers to credibility and reliability signals such as official origin,
          archival quality, source type, and evidentiary usefulness. It does not mean agreement with
          a policy position.
        </p>
        <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
          Multiple sources can support a single policy, promise, or outcome record. The public library
          exists so readers can inspect that evidence layer directly.
        </p>
      </Panel>

      <section className="grid gap-4 md:grid-cols-2">
        <Panel padding="md">
          <h2 className="text-lg font-semibold text-white">Why researchers use this page</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            Readers can use this page to verify claims, understand what kinds of sources support Black policy impact analysis, and see how widely a source is used across the site.
          </p>
        </Panel>
        <Panel padding="md">
          <h2 className="text-lg font-semibold text-white">Why it is citation-friendly</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            Link this page when a reader needs to inspect the evidence layer itself, not just the interpretation built from it. It is the clearest public page for checking publisher mix, source types, and visible record linkage.
          </p>
        </Panel>
      </section>

      <CitationNote
        title="How to reference the source library"
        description="Use this page when citing EquityStack&apos;s visible evidence base. It is especially useful when a report, policy page, or explainer needs to be paired with the underlying source environment rather than treated as a stand-alone claim."
      />

      <DashboardFilterBar helpText="Search by source title, publisher, type, or URL. The goal is to make transparency legible without exposing raw internal junction-table noise.">
        <form action="/sources" method="GET" className="flex flex-1 flex-wrap items-end gap-4">
          <label className="grid gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Search
            </span>
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Source title, publisher, or URL"
              className="dashboard-field"
            />
          </label>
          <button type="submit" className="dashboard-button-secondary">
            Search sources
          </button>
        </form>
      </DashboardFilterBar>

      <ImpactOverviewCards
        items={[
          {
            label: "Sources shown",
            value: sources.length,
            description: "Source records visible in the current search window.",
            tone: "accent",
          },
          {
            label: "Linked records",
            value: linkedTotal,
            description: "Total visible policy, promise, action, and outcome links across the current result set.",
          },
          {
            label: "High authority",
            value: highAuthorityCount,
            description: "Sources currently labeled high authority by source type.",
          },
          {
            label: "Search mode",
            value: query ? "Filtered" : "Library",
            description: "The source library is public browse first, then record drill-down through links.",
          },
        ]}
      />

      <section className="public-two-col-rail grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <SectionIntro
            eyebrow="Source records"
            title="Public source index"
            description="Use the table to scan authority level, type, publisher, and linked-record counts before opening the original source."
          />
          <SourceLibraryTable items={sources} />
        </div>
        <div className="space-y-4">
          <SourceTrustPanel
            sourceCount={sources.length}
            sourceQuality={highAuthorityCount ? `${highAuthorityCount} high-authority visible` : "Mixed"}
            confidenceLabel={query ? "Query filtered" : "Library wide"}
            summary="EquityStack prefers official, archival, academic, and similarly authoritative records. The public source library exists so readers can inspect that evidence layer directly."
          />
          <MethodologyCallout description="Source type alone is not the whole story, but surfacing it nearby helps users tell the difference between official records, contextual reporting, and sparse evidence." />
          <Panel padding="md">
            <h2 className="text-lg font-semibold text-white">Best companion pages</h2>
            <div className="mt-4 grid gap-3">
              <Link href="/methodology" className="panel-link p-4">
                <h3 className="text-base font-semibold text-white">Methodology</h3>
                <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                  Use methodology when a reader needs to know how evidence quality affects scoring and interpretation.
                </p>
              </Link>
              <Link href="/research" className="panel-link p-4">
                <h3 className="text-base font-semibold text-white">Research Hub</h3>
                <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                  Use the research hub when the source trail opens into a broader question about presidents, legislation, reports, or explainers.
                </p>
              </Link>
              <Link href="/reports" className="panel-link p-4">
                <h3 className="text-base font-semibold text-white">Reports</h3>
                <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                  Pair the source library with reports when you want both the summary view and the evidence layer behind it.
                </p>
              </Link>
              <Link href="/explainers" className="panel-link p-4">
                <h3 className="text-base font-semibold text-white">Explainers</h3>
                <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                  Use explainers when the reader needs historical context before interpreting the sources attached to a topic.
                </p>
              </Link>
              <Link href="/start" className="panel-link p-4">
                <h3 className="text-base font-semibold text-white">How to Use EquityStack</h3>
                <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                  Share the guided path when a first-time reader needs orientation before moving from evidence into reports, explainers, or tracked records.
                </p>
              </Link>
              <Link href="/glossary" className="panel-link p-4">
                <h3 className="text-base font-semibold text-white">Glossary</h3>
                <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                  Use the glossary when a reader needs quick definitions for record, report, thematic page, outcome, or source-quality terms.
                </p>
              </Link>
            </div>
          </Panel>
        </div>
      </section>
    </main>
  );
}
