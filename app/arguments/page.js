import Link from "next/link";
import { buildListingMetadata } from "@/lib/metadata";
import { fetchArgumentLibraryData } from "@/lib/public-site-data";
import StructuredData from "@/app/components/public/StructuredData";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  DashboardFilterBar,
  ImpactOverviewCards,
  SectionIntro,
} from "@/app/components/public/core";
import {
  MetricCard,
  Panel,
  SectionHeader,
  StatusPill,
} from "@/app/components/dashboard/primitives";
import {
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
  buildItemListJsonLd,
} from "@/lib/structured-data";

export const dynamic = "force-dynamic";

function buildFilterHref({ category = "", tag = "" } = {}) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (tag) params.set("tag", tag);
  const query = params.toString();
  return query ? `/arguments?${query}` : "/arguments";
}

export async function generateMetadata({ searchParams }) {
  const resolvedSearchParams = (await searchParams) || {};

  return buildListingMetadata({
    title: "Argument-ready explainer database",
    description:
      "Search debate-ready claims, responses, key points, and share cards generated from EquityStack explainers.",
    path: "/arguments",
    keywords: [
      "EquityStack arguments",
      "debate-ready explainers",
      "policy rebuttals",
    ],
    searchParams: resolvedSearchParams,
  });
}

export default async function ArgumentsPage({ searchParams }) {
  const resolvedSearchParams = (await searchParams) || {};
  const data = await fetchArgumentLibraryData(resolvedSearchParams);
  const selectedCategoryLabel =
    data.categories.find((item) => item.slug === data.selectedCategory)?.label ||
    data.selectedCategory;
  const selectedTagLabel =
    data.tags.find((item) => item.slug === data.selectedTag)?.label || data.selectedTag;

  return (
    <main className="space-y-4">
      <StructuredData
        data={[
          buildBreadcrumbJsonLd(
            [{ href: "/", label: "Home" }, { label: "Arguments" }],
            "/arguments"
          ),
          buildCollectionPageJsonLd({
            title: "Argument-ready explainer database",
            description:
              "A searchable database of claims, responses, key points, debate lines, and share cards derived from EquityStack explainers.",
            path: "/arguments",
            about: ["EquityStack explainers", "policy arguments", "public claims"],
            keywords: ["arguments", "explainers", "debate-ready responses"],
          }),
          buildItemListJsonLd({
            title: "Argument entries visible in the EquityStack argument database",
            description:
              "The current visible argument entries generated from published EquityStack explainers.",
            path: "/arguments",
            items: data.entries.slice(0, 20).map((item) => ({
              href: item.source.href,
              name: `${item.type}: ${item.source.title}`,
            })),
          }),
        ]}
      />
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Arguments" }]} />

      <section className="hero-panel p-4">
        <SectionIntro
          as="h1"
          eyebrow="Arguments"
          title="Argument-ready claims and responses from EquityStack explainers."
          description="Use this page to move quickly from a public claim into the strongest summary, rebuttal, question, or share-card text already attached to the explainer system."
          actions={
            <>
              <Link href="/explainers" className="dashboard-button-secondary">
                Browse explainers
              </Link>
              <Link href="/methodology" className="dashboard-button-secondary">
                Read methodology
              </Link>
            </>
          }
        />
      </section>

      <DashboardFilterBar helpText="Filter by explainer category or tag. Each card links back to the source explainer in Argument Mode.">
        <form action="/arguments" method="GET" className="flex flex-1 flex-wrap items-end gap-4">
          <label className="grid gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Category
            </span>
            <select
              name="category"
              defaultValue={data.selectedCategory}
              className="dashboard-field"
            >
              <option value="">All categories</option>
              {data.categories.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Tag
            </span>
            <select name="tag" defaultValue={data.selectedTag} className="dashboard-field">
              <option value="">All tags</option>
              {data.tags.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="dashboard-button-secondary">
            Apply filters
          </button>
          {(data.selectedCategory || data.selectedTag) ? (
            <Link href="/arguments" className="dashboard-button-secondary">
              Clear
            </Link>
          ) : null}
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/arguments" className="dashboard-button-secondary">
            All
          </Link>
          {data.categories.slice(0, 6).map((item) => (
            <Link
              key={item.slug}
              href={buildFilterHref({ category: item.slug, tag: data.selectedTag })}
              className="dashboard-button-secondary"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </DashboardFilterBar>

      <ImpactOverviewCards
        items={[
          {
            label: "Argument entries",
            value: data.entries.length,
            description: "Visible argument-mode summaries, key points, claims, lines, and share cards.",
            tone: "accent",
          },
          {
            label: "Explainers",
            value: data.argumentReadyExplainers,
            description: "Published explainers with explicit or generated Argument Mode data.",
          },
          {
            label: "Categories",
            value: data.categories.length,
            description: "Available category filters.",
          },
          {
            label: "Tags",
            value: data.tags.length,
            description: "Available tag filters.",
          },
        ]}
      />

      {(data.selectedCategory || data.selectedTag) ? (
        <Panel padding="md" className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-white">Active filters</span>
          {selectedCategoryLabel ? (
            <StatusPill tone="info">{selectedCategoryLabel}</StatusPill>
          ) : null}
          {selectedTagLabel ? <StatusPill tone="default">{selectedTagLabel}</StatusPill> : null}
        </Panel>
      ) : null}

      <Panel className="overflow-hidden">
        <SectionHeader
          eyebrow="Argument database"
          title="Browse argument-ready entries"
          description="Entries are derived from each explainer's Argument Mode layer. Open the source explainer for full context, sections, sources, and related records."
        />
        <div className="p-4">
          {data.entries.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.entries.map((item) => (
                <Panel
                  key={item.id}
                  as="article"
                  padding="md"
                  className="flex h-full flex-col"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={item.tone}>{item.type}</StatusPill>
                    {item.source.categoryLabel ? (
                      <StatusPill tone="default">{item.source.categoryLabel}</StatusPill>
                    ) : null}
                  </div>
                  <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[var(--ink-soft)]">
                    {item.text}
                  </p>
                  <div className="mt-auto pt-4">
                    <Link
                      href={item.source.href}
                      className="text-sm font-semibold text-[var(--ink-soft)] transition-[color] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(132,247,198,0.28)]"
                    >
                      Source: {item.source.title}
                    </Link>
                  </div>
                </Panel>
              ))}
            </div>
          ) : (
            <Panel padding="md" className="border-dashed text-sm leading-7 text-[var(--ink-soft)]">
              No argument entries match the current filters.
            </Panel>
          )}
        </div>
      </Panel>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Data source"
          value="Explainers"
          description="This page aggregates existing explainer Argument Mode fields and generated fallbacks."
          density="compact"
          showDot
        />
        <MetricCard
          label="Routing"
          value="Linked"
          description="Every card routes back to the source explainer in Argument Mode."
          density="compact"
          tone="info"
        />
        <MetricCard
          label="Scope"
          value="Optional"
          description="Explainers without explicit argument fields are handled through backward-compatible generated data."
          density="compact"
          tone="verified"
        />
      </section>
    </main>
  );
}
