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
import {
  ExplainerIndexGrid,
  SearchResultGroup,
} from "@/app/components/public/entities";

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
          title="Search policies, promises, presidents, reports, and explainers."
          description="Search helps you find the right public page without needing to know how EquityStack is organized first. Use it to jump into a policy, promise, report, explainer, or source from one query."
        />
        <form action="/search" method="GET" className="mt-6 flex max-w-3xl flex-col gap-3 rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] px-3 py-3 sm:flex-row sm:items-center">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search policies, presidents, promises, reports, explainers, and sources"
            className="min-w-0 flex-1 border-0 bg-transparent text-sm text-white placeholder:text-[var(--ink-muted)] focus:outline-none"
          />
          <button type="submit" className="dashboard-button-primary w-full sm:w-auto">
            Search
          </button>
        </form>
      </section>

      {!query ? (
        <section className="space-y-4">
          <Panel padding="md">
            <h2 className="text-2xl font-semibold text-white">Start with a public query</h2>
            <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">
              Try a president, policy area, promise topic, law title, or source publisher. Search is grouped by record type so you can choose the right next path instead of reading one long undifferentiated result list.
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
                label: "Direct matches",
                value: results.total_results || 0,
                description: "Record matches found directly from the query.",
              },
              {
                label: "Direct result groups",
                value: populatedSections.length,
                description: "Result types with direct record matches.",
              },
              {
                label: "Search mode",
                value: query ? "Live" : "Idle",
                description: "Results are grouped by public entity type for faster interpretation.",
              },
            ]}
          />

          {(results.suggested_explainers || []).length ? (
            <section className="space-y-4">
              <Panel padding="md">
                <h2 className="text-2xl font-semibold text-white">Suggested explainers</h2>
                <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                  {populatedSections.length
                    ? "These explainers match the argument or misconception behind your search. Start here when you need the reasoning, not just a record lookup."
                    : "There may be no direct record match for this query yet, but it does map to a common argument. Start here for the clearest explanation first."}
                </p>
              </Panel>
              <ExplainerIndexGrid items={results.suggested_explainers} />
            </section>
          ) : null}

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
