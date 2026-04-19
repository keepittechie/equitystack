import Link from "next/link";
import { buildListingMetadata } from "@/lib/metadata";
import {
  buildPolicySlug,
  fetchPolicyExplorerData,
} from "@/lib/public-site-data";
import StructuredData from "@/app/components/public/StructuredData";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  FilterDrawer,
  MethodologyCallout,
  PageContextBlock,
  SectionIntro,
} from "@/app/components/public/core";
import { Panel } from "@/app/components/dashboard/primitives";
import {
  PolicyCardList,
  PolicyFilterSidebar,
  PolicyResultsTable,
  PolicySearchBar,
} from "@/app/components/public/entities";
import TrustBar from "@/app/components/public/TrustBar";
import ScoreExplanation from "@/app/components/public/ScoreExplanation";
import {
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
  buildDatasetJsonLd,
} from "@/lib/structured-data";

export const dynamic = "force-dynamic";

function PolicyPanel({ children, className = "" }) {
  return (
    <Panel padding="md" className={className}>
      {children}
    </Panel>
  );
}

export async function generateMetadata({ searchParams }) {
  const resolvedSearchParams = (await searchParams) || {};

  return buildListingMetadata({
    title: "Civil-rights policy, legislation, and executive actions",
    description:
      "Search, filter, and browse legislation, executive actions, and court decisions affecting Black Americans across U.S. history.",
    path: "/policies",
    keywords: [
      "civil rights laws by president",
      "legislation affecting Black Americans",
      "historical policy impact",
    ],
    searchParams: resolvedSearchParams,
  });
}

function countDirections(items = []) {
  return items.reduce(
    (totals, item) => {
      const key = item.impact_direction || "Unknown";
      totals[key] = (totals[key] || 0) + 1;
      return totals;
    },
    { Positive: 0, Negative: 0, Mixed: 0, Blocked: 0 }
  );
}

export default async function PoliciesPage({ searchParams }) {
  const resolvedSearchParams = (await searchParams) || {};
  const data = await fetchPolicyExplorerData(resolvedSearchParams);
  const view = resolvedSearchParams.view === "cards" ? "cards" : "table";
  const counts = countDirections(data.items || []);

  return (
    <main className="space-y-10">
      <StructuredData
        data={[
          buildBreadcrumbJsonLd(
            [{ href: "/", label: "Home" }, { label: "Policies" }],
            "/policies"
          ),
          buildCollectionPageJsonLd({
            title: "Civil-rights policy, legislation, and executive actions",
            description:
              "A browseable public index of legislation, executive actions, and court decisions affecting Black Americans.",
            path: "/policies",
            about: [
              "civil rights policy",
              "legislation affecting Black Americans",
              "executive actions",
              "court decisions",
            ],
            keywords: [
              "civil rights laws by president",
              "historical legislation affecting Black Americans",
            ],
          }),
          buildDatasetJsonLd({
            title: "EquityStack policy dataset",
            description:
              "Structured public policy records used by EquityStack to measure impact direction, score, source coverage, and historical context.",
            path: "/policies",
            about: ["civil rights policy", "Black Americans", "historical policy impact"],
            keywords: ["legislation affecting Black Americans", "policy impact on Black communities"],
            variableMeasured: [
              "Impact Score",
              "Impact direction",
              "Evidence strength",
              "Source count",
            ],
          }),
        ]}
      />
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Policies" }]} />

      <section className="hero-panel p-8 md:p-10 xl:p-14">
        <SectionIntro
          as="h1"
          eyebrow="Policy explorer"
          title="Browse legislation, executive actions, and court decisions affecting Black Americans."
          description="The policy explorer is built for civic research: search first, filter by president, era, direction, or category, and move from broad historical questions into record-level evidence."
          actions={
            <>
              <Link href="/dashboard" className="dashboard-button-primary">
                Open the policy dashboard
              </Link>
              <Link
                href="/methodology"
                className="inline-flex min-h-9 items-center justify-center rounded-md border border-[var(--line-strong)] bg-[rgba(18,31,49,0.58)] px-3 text-[12px] font-semibold text-white transition-[background-color,border-color,box-shadow] hover:border-[var(--line-strong)] hover:bg-[rgba(18,31,49,0.86)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(132,247,198,0.28)]"
              >
                Read methodology
              </Link>
            </>
          }
        />
      </section>

      <TrustBar />

      <section className="space-y-5">
        <PolicyPanel className="space-y-5">
          <PageContextBlock
            description="This explorer shows individual policy records, their Impact Score, Impact Direction, and evidence footprint across time."
            detail="Use it to research civil-rights laws by president, compare executive actions and court decisions, and move from broad search intent into record-level proof."
          />
          <ScoreExplanation title="How to read policy Impact Scores" />
        </PolicyPanel>
      </section>

      <PolicySearchBar defaultValue={resolvedSearchParams.q || ""} />

      <FilterDrawer>
        <PolicyFilterSidebar filters={resolvedSearchParams} options={data.filterOptions} />
      </FilterDrawer>

      <section className="space-y-5">
        <div className="hidden xl:block">
          <PolicyFilterSidebar
            filters={resolvedSearchParams}
            options={data.filterOptions}
            layout="split"
          />
        </div>
        <PolicyPanel className="space-y-5">
          <Panel padding="md" className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">Results</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                {data.pagination?.total || data.items?.length || 0} policy records
              </h2>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                Positive {counts.Positive || 0} • Negative {counts.Negative || 0} • Mixed {counts.Mixed || 0} • Blocked {counts.Blocked || 0}
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                Search by title, filter by president, era, category, or direction, and open each record for plain-language summary, sources, and related history.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/policies?${new URLSearchParams({ ...resolvedSearchParams, view: "table" }).toString()}`}
                className={
                  view === "table"
                    ? "inline-flex min-h-9 items-center justify-center rounded-md border border-[rgba(132,247,198,0.72)] bg-[var(--accent)] px-3 text-[12px] font-semibold text-[#051019] transition-[background-color,border-color,box-shadow] hover:border-[var(--accent)] hover:bg-[rgba(132,247,198,0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(132,247,198,0.28)]"
                    : "inline-flex min-h-9 items-center justify-center rounded-md border border-[var(--line-strong)] bg-[rgba(18,31,49,0.58)] px-3 text-[12px] font-semibold text-white transition-[background-color,border-color,box-shadow] hover:border-[var(--line-strong)] hover:bg-[rgba(18,31,49,0.86)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(132,247,198,0.28)]"
                }
              >
                Table
              </Link>
              <Link
                href={`/policies?${new URLSearchParams({ ...resolvedSearchParams, view: "cards" }).toString()}`}
                className={
                  view === "cards"
                    ? "inline-flex min-h-9 items-center justify-center rounded-md border border-[rgba(132,247,198,0.72)] bg-[var(--accent)] px-3 text-[12px] font-semibold text-[#051019] transition-[background-color,border-color,box-shadow] hover:border-[var(--accent)] hover:bg-[rgba(132,247,198,0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(132,247,198,0.28)]"
                    : "inline-flex min-h-9 items-center justify-center rounded-md border border-[var(--line-strong)] bg-[rgba(18,31,49,0.58)] px-3 text-[12px] font-semibold text-white transition-[background-color,border-color,box-shadow] hover:border-[var(--line-strong)] hover:bg-[rgba(18,31,49,0.86)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(132,247,198,0.28)]"
                }
              >
                Cards
              </Link>
            </div>
          </Panel>

          {view === "cards" ? (
            <PolicyCardList items={data.items || []} buildHref={(item) => `/policies/${item.slug || buildPolicySlug(item)}`} />
          ) : (
            <PolicyResultsTable items={data.items || []} buildHref={(item) => `/policies/${item.slug || buildPolicySlug(item)}`} />
          )}

          <MethodologyCallout description="Impact direction, score, and source presence appear together so users can filter quickly without hiding uncertainty or incomplete classification." />
        </PolicyPanel>
      </section>
    </main>
  );
}
