import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import { fetchUniversalSearchData } from "@/lib/public-site-data";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  ImpactOverviewCards,
  MethodologyCallout,
  SectionIntro,
} from "@/app/components/public/core";
import { Panel } from "@/app/components/dashboard/primitives";
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

const EXAMPLE_QUERIES = [
  { href: "/search?q=Lyndon+B.+Johnson", label: "Lyndon B. Johnson" },
  { href: "/search?q=Civil+Rights+Act+of+1964", label: "Civil Rights Act of 1964" },
  { href: "/search?q=redlining", label: "redlining" },
  { href: "/search?q=voting+rights", label: "voting rights" },
];

export default async function SearchPage({ searchParams }) {
  const resolvedSearchParams = (await searchParams) || {};
  const query = String(resolvedSearchParams.q || "");
  const results = await fetchUniversalSearchData(query);
  const populatedSections = (results.sections || []).filter(
    (section) => (section.items || []).length
  );

  return (
    <main className="space-y-4">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Search" }]} />

      <section className="hero-panel p-4">
        <SectionIntro
          as="h1"
          eyebrow="Universal search"
          title="Search across the public intelligence layer."
          description="Search is designed to move users across entity types without forcing them to know the database structure in advance. Policies, presidents, promises, reports, explainers, and sources should be discoverable from one query."
        />
        <form action="/search" method="GET" className="mt-6 flex max-w-3xl items-center gap-3 rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] px-3 py-3">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search policies, presidents, promises, reports, explainers, and sources"
            className="min-w-0 flex-1 border-0 bg-transparent text-sm text-white placeholder:text-[var(--ink-muted)] focus:outline-none"
          />
          <button type="submit" className="dashboard-button-primary">
            Search
          </button>
        </form>
      </section>

      {!query ? (
        <section className="public-two-col-rail grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <Panel padding="md">
            <h2 className="text-2xl font-semibold text-white">Start with a public query</h2>
            <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">
              Try a president, policy area, promise topic, law title, or source publisher. Search is grouped by record type so you can choose the right next path instead of reading one long undifferentiated result list.
            </p>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Search works best for titles, names, broad topics, law names, court cases, and major source publishers.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {EXAMPLE_QUERIES.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex min-h-8 items-center rounded-md border border-[var(--line)] bg-[rgba(18,31,49,0.58)] px-3 text-xs font-semibold text-white transition-[background-color,border-color] hover:border-[var(--line-strong)] hover:bg-[rgba(18,31,49,0.86)]"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </Panel>
          <MethodologyCallout description="Search is a discovery tool, not a scoring layer. After finding a match, the next step should usually be a detail page, report, or source view with evidence and methodology nearby." />
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
                  description={section.description || null}
                  items={section.items}
                />
              ))}
            </section>
          ) : (
            <section className="dashboard-empty-state text-sm leading-7 text-[var(--ink-soft)]">
              No public results matched “{query}”. Try a broader topic, a shorter query, or a different record type.
            </section>
          )}
        </>
      )}
    </main>
  );
}
