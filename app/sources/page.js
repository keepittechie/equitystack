import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import { fetchSourcesLibraryData } from "@/lib/public-site-data";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  DashboardFilterBar,
  ImpactOverviewCards,
  MethodologyCallout,
  SectionIntro,
  SourceTrustPanel,
} from "@/app/components/public/core";
import { SourceLibraryTable } from "@/app/components/public/entities";

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
    <main className="space-y-10">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Sources" }]} />

      <section className="hero-panel p-8 md:p-10 xl:p-14">
        <SectionIntro
          as="h1"
          eyebrow="Source library"
          title="Browse the evidence behind EquityStack’s public record."
          description="The source library gives users a direct view into the public evidence base behind policies, promises, and outcomes. Use it to inspect source types, publishers, linked-record counts, and coverage depth."
          actions={
            <>
              <Link href="/methodology" className="public-button-primary">
                Read evidence rules
              </Link>
              <Link href="/search" className="public-button-secondary">
                Universal search
              </Link>
            </>
          }
        />
      </section>

      <section className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-6">
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
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[1.5rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
          <h2 className="text-lg font-semibold text-white">Why this page matters</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            Readers can use this page to verify claims, understand what kinds of sources support Black policy impact analysis, and see how widely a source is used across the site.
          </p>
        </div>
        <div className="rounded-[1.5rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
          <h2 className="text-lg font-semibold text-white">How to use it</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            Search by publisher, title, or URL when you want to inspect a specific evidentiary trail, then return to the linked policy or promise record for full context.
          </p>
        </div>
      </section>

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
              className="rounded-xl border border-white/8 bg-white/5 px-3 py-2.5 text-sm text-white"
            />
          </label>
          <button type="submit" className="public-button-secondary">
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

      <section className="public-two-col-rail grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5">
          <SectionIntro
            eyebrow="Source records"
            title="Public source index"
            description="Use the table to scan authority level, type, publisher, and linked-record counts before opening the original source."
          />
          <SourceLibraryTable items={sources} />
        </div>
        <div className="space-y-5">
          <SourceTrustPanel
            sourceCount={sources.length}
            sourceQuality={highAuthorityCount ? `${highAuthorityCount} high-authority visible` : "Mixed"}
            confidenceLabel={query ? "Query filtered" : "Library wide"}
            summary="EquityStack prefers official, archival, academic, and similarly authoritative records. The public source library exists so readers can inspect that evidence layer directly."
          />
          <MethodologyCallout description="Source type alone is not the whole story, but surfacing it nearby helps users tell the difference between official records, contextual reporting, and sparse evidence." />
        </div>
      </section>
    </main>
  );
}
