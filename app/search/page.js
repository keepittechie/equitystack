import { buildPageMetadata } from "@/lib/metadata";
import { fetchUniversalSearchData } from "@/lib/public-site-data";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  ImpactOverviewCards,
  MethodologyCallout,
  SectionIntro,
} from "@/app/components/public/core";
import { SearchResultGroup } from "@/app/components/public/entities";

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "Search",
  description:
    "Search across policies, presidents, promises, administrations, reports, explainers, and sources on EquityStack.",
  path: "/search",
  robots: {
    index: false,
    follow: true,
  },
});

export default async function SearchPage({ searchParams }) {
  const resolvedSearchParams = (await searchParams) || {};
  const query = String(resolvedSearchParams.q || "");
  const results = await fetchUniversalSearchData(query);
  const populatedSections = (results.sections || []).filter(
    (section) => (section.items || []).length
  );

  return (
    <main className="space-y-10">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Search" }]} />

      <section className="hero-panel p-8 md:p-10 xl:p-14">
        <SectionIntro
          as="h1"
          eyebrow="Universal search"
          title="Search across the public intelligence layer."
          description="Search is designed to move users across entity types without forcing them to know the database structure in advance. Policies, presidents, promises, reports, explainers, and sources should be discoverable from one query."
        />
        <form action="/search" method="GET" className="mt-8 flex max-w-3xl items-center gap-3 rounded-[1.4rem] border border-white/8 bg-[rgba(8,14,24,0.92)] px-4 py-3">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search policies, presidents, promises, reports, explainers, and sources"
            className="min-w-0 flex-1 border-0 bg-transparent text-sm text-white placeholder:text-[var(--ink-muted)] focus:outline-none"
          />
          <button type="submit" className="public-button-primary">
            Search
          </button>
        </form>
      </section>

      {!query ? (
        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-6">
            <h2 className="text-2xl font-semibold text-white">Start with a public query</h2>
            <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">
              Try a president, policy area, promise topic, law title, or source publisher. Search is grouped by record type so you can choose the right next path instead of reading one long undifferentiated result list.
            </p>
          </div>
          <MethodologyCallout description="Search is a discovery tool, not a scoring layer. The next step after search should usually be a detail page, report, or source view with evidence and methodology nearby." />
        </section>
      ) : (
        <>
          <ImpactOverviewCards
            items={[
              {
                label: "Query",
                value: results.query,
                description: "Current universal search input.",
                tone: "accent",
              },
              {
                label: "Total matches",
                value: results.total_results || 0,
                description: "Visible results across all public entity groups.",
              },
              {
                label: "Groups hit",
                value: populatedSections.length,
                description: "Public entity groups that currently have matches.",
              },
              {
                label: "Search mode",
                value: query ? "Live" : "Idle",
                description: "Results are grouped by public entity type for faster interpretation.",
              },
            ]}
          />

          {populatedSections.length ? (
            <section className="grid gap-6 xl:grid-cols-2">
              {populatedSections.map((section) => (
                <SearchResultGroup
                  key={section.key}
                  title={section.label}
                  items={section.items}
                />
              ))}
            </section>
          ) : (
            <section className="rounded-[1.6rem] border border-dashed border-white/12 bg-white/4 p-6 text-sm leading-7 text-[var(--ink-soft)]">
              No public results matched “{query}”. Try a broader topic, a shorter query, or a different record type.
            </section>
          )}
        </>
      )}
    </main>
  );
}
