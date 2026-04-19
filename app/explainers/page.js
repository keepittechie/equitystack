import Link from "next/link";
import { buildListingMetadata } from "@/lib/metadata";
import { fetchExplainersIndexData } from "@/lib/public-site-data";
import StructuredData from "@/app/components/public/StructuredData";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  DashboardFilterBar,
  ImpactOverviewCards,
  MethodologyCallout,
  SectionIntro,
} from "@/app/components/public/core";
import { Panel } from "@/app/components/dashboard/primitives";
import { ExplainerIndexGrid } from "@/app/components/public/entities";
import {
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
  buildItemListJsonLd,
} from "@/lib/structured-data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }) {
  const resolvedSearchParams = (await searchParams) || {};

  return buildListingMetadata({
    title: "Black history and policy explainers",
    description:
      "Read EquityStack explainers on Black history, civil rights policy, presidents, legislation, and historical context tied to the public record.",
    path: "/explainers",
    keywords: [
      "Black history explainers",
      "civil rights policy explainer",
      "presidents and Black Americans",
    ],
    searchParams: resolvedSearchParams,
  });
}

export default async function ExplainersPage({ searchParams }) {
  const resolvedSearchParams = (await searchParams) || {};
  const data = await fetchExplainersIndexData();
  const query = String(resolvedSearchParams.q || "").trim().toLowerCase();
  const category = String(resolvedSearchParams.category || "").trim();
  const explainers = (data.items || []).filter((item) => {
    const queryMatch =
      !query ||
      [item.title, item.summary, item.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    const categoryMatch = !category || item.category === category;
    return queryMatch && categoryMatch;
  });

  return (
    <main className="space-y-4">
      <StructuredData
        data={[
          buildBreadcrumbJsonLd(
            [{ href: "/", label: "Home" }, { label: "Explainers" }],
            "/explainers"
          ),
          buildCollectionPageJsonLd({
            title: "Black history and policy explainers",
            description:
              "A library of explainers that connect public claims about Black history, presidents, and policy to the underlying records in EquityStack.",
            path: "/explainers",
            about: [
              "Black history",
              "U.S. presidents",
              "civil rights policy",
              "legislation affecting Black Americans",
            ],
            keywords: [
              "Black history explainers",
              "presidents and Black Americans",
            ],
          }),
          buildItemListJsonLd({
            title: "Explainers visible in the EquityStack explainer library",
            description:
              "The current visible explainer entries on the public explainer library page.",
            path: "/explainers",
            items: explainers
              .filter((item) => item?.slug && item?.title)
              .slice(0, 12)
              .map((item) => ({
                href: `/explainers/${item.slug}`,
                name: item.title,
              })),
          }),
        ]}
      />
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Explainers" }]} />

      <section className="hero-panel p-4">
        <SectionIntro
          as="h1"
          eyebrow="Explainers"
          title="Black history and policy explainers grounded in the public record."
          description="Explainers are the bridge between broad public claims and the specific presidents, policies, promises, and sources inside EquityStack. They are meant to clarify the record, not replace it."
          actions={
            <>
              <Link href="/reports" className="dashboard-button-primary">
                Open historical reports
              </Link>
              <Link href="/methodology" className="dashboard-button-secondary">
                Read methodology
              </Link>
            </>
          }
        />
      </section>

      <DashboardFilterBar helpText="Browse by category or keyword. The best explainer is usually the one that helps you move from a claim into the specific records underneath it.">
        <form action="/explainers" method="GET" className="flex flex-1 flex-wrap items-end gap-4">
          <label className="grid gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Search
            </span>
            <input
              type="search"
              name="q"
              defaultValue={resolvedSearchParams.q || ""}
              placeholder="Topic, title, or claim"
              className="dashboard-field"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Category
            </span>
            <select
              name="category"
              defaultValue={resolvedSearchParams.category || ""}
              className="dashboard-field"
            >
              <option value="">All categories</option>
              {(data.categories || []).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="dashboard-button-secondary">
            Apply filters
          </button>
        </form>
      </DashboardFilterBar>

      <ImpactOverviewCards
        items={[
          {
            label: "Explainers visible",
            value: explainers.length,
            description: "Published explainers matching the current browse state.",
            tone: "accent",
          },
          {
            label: "Categories",
            value: data.categories?.length || 0,
            description: "Issue or topic categories currently represented in the explainer library.",
          },
          {
            label: "Published library",
            value: data.items?.length || 0,
            description: "Total explainers currently available in the public site.",
          },
          {
            label: "Use case",
            value: "Context",
            description: "Best for understanding how claims, history, and linked records fit together.",
          },
        ]}
      />

      <section className="space-y-4">
        <Panel padding="md" className="space-y-4">
          <SectionIntro
            eyebrow="Library"
            title="Browse the explainer archive"
            description="Each explainer should make the next step obvious: open the linked policy, promise, report, or source page rather than stopping at narrative alone."
          />
          <ExplainerIndexGrid items={explainers} />
          <MethodologyCallout description="Explainers help interpret the public record, but the evidence hierarchy still matters. Use them as context pages that route you into primary records and linked sources." />
          <Panel padding="md" className="bg-[rgba(18,31,49,0.52)]">
            <h2 className="text-lg font-semibold text-white">How to use explainers</h2>
            <div className="mt-4 grid gap-3 text-sm leading-7 text-[var(--ink-soft)]">
              <Panel padding="md" className="bg-[rgba(18,31,49,0.52)]">
                Start here when the policy or legal context is unfamiliar.
              </Panel>
              <Panel padding="md" className="bg-[rgba(18,31,49,0.52)]">
                Use the related records section on each explainer to verify the narrative against underlying evidence.
              </Panel>
              <Panel padding="md" className="bg-[rgba(18,31,49,0.52)]">
                When the claim is especially important, move from explainer to report, then into the linked policy or promise records.
              </Panel>
            </div>
          </Panel>
        </Panel>
      </section>
    </main>
  );
}
