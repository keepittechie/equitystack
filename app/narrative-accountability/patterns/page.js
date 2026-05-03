import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import {
  getNarrativeIndex,
  getNarrativePatternHeatmap,
  getNarrativePatternSummaryStats,
} from "@/lib/narrative-accountability/data";
import { getNarrativeCoverage } from "@/lib/narrative-accountability/patternAnalytics";
import { fetchExplainerDetailData } from "@/lib/public-site-data";
import StructuredData from "@/app/components/public/StructuredData";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  CitationNote,
  KpiCard,
  SectionIntro,
} from "@/app/components/public/core";
import {
  Panel,
  StatusPill,
} from "@/app/components/dashboard/primitives";
import {
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
  buildItemListJsonLd,
} from "@/lib/structured-data";

export const metadata = buildPageMetadata({
  title: "Narrative Patterns | EquityStack",
  description:
    "Track recurring public claim patterns, the profiles connected to them, and the explainers that provide historical and policy context.",
  path: "/narrative-accountability/patterns",
  keywords: [
    "narrative patterns",
    "claim pattern index",
    "narrative accountability",
  ],
});

async function resolveExplainers(slugs = []) {
  return (
    await Promise.all(
      (Array.isArray(slugs) ? slugs : []).map(async (slug) => {
        const normalizedSlug = String(slug || "").trim();
        if (!normalizedSlug) {
          return null;
        }

        const explainer = await fetchExplainerDetailData(normalizedSlug).catch(() => null);
        if (!explainer?.slug) {
          return null;
        }

        return {
          slug: explainer.slug,
          title: explainer.title,
        };
      })
    )
  ).filter(Boolean);
}

function getHeatmapCellClass(count) {
  if (count >= 2) {
    return "border-[rgba(132,247,198,0.24)] bg-[rgba(132,247,198,0.08)] text-white";
  }

  if (count === 1) {
    return "border-[rgba(125,211,252,0.24)] bg-[rgba(125,211,252,0.07)] text-white";
  }

  return "border-[var(--line)] bg-[rgba(18,31,49,0.36)] text-[var(--ink-muted)]";
}

function formatAverage(value) {
  if (!Number.isFinite(value)) {
    return "0.0";
  }

  return value.toFixed(1);
}

function formatCoverageLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return "Low";
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export default async function NarrativePatternsPage() {
  const narrativeIndex = getNarrativeIndex();
  const heatmap = getNarrativePatternHeatmap();
  const summaryStats = getNarrativePatternSummaryStats();
  const coverageByTagId = new Map(
    narrativeIndex.map((item) => [item.tag.id, getNarrativeCoverage(item.tag.id)])
  );
  const tagColumns = narrativeIndex.map((item) => item.tag);
  const relatedExplainerSlugs = Array.from(
    new Set(narrativeIndex.flatMap((item) => item.related_explainers || []))
  );
  const relatedExplainers = await resolveExplainers(relatedExplainerSlugs);
  const explainersBySlug = new Map(
    relatedExplainers.map((item) => [item.slug, item])
  );

  return (
    <main className="space-y-4">
      <StructuredData
        data={[
          buildBreadcrumbJsonLd(
            [
              { href: "/", label: "Home" },
              { href: "/narrative-accountability", label: "Narrative Accountability" },
              { label: "Narrative Patterns" },
            ],
            "/narrative-accountability/patterns"
          ),
          buildCollectionPageJsonLd({
            title: "Narrative Patterns",
            description:
              "Narrative pattern index grouping published claim clusters, connected profiles, and related explainers.",
            path: "/narrative-accountability/patterns",
            about: [
              "narrative patterns",
              "public claims",
              "related profiles",
              "related explainers",
            ],
            keywords: [
              "narrative patterns",
              "claim pattern index",
            ],
          }),
          buildItemListJsonLd({
            title: "Narrative pattern tags",
            description:
              "Narrative Accountability pattern pages grouped by recurring public claim type.",
            path: "/narrative-accountability/patterns",
            items: narrativeIndex.map((item) => ({
              href: `/narrative-accountability/patterns/${item.tag.id}`,
              name: item.tag.label,
            })),
          }),
        ]}
      />
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/narrative-accountability", label: "Narrative Accountability" },
          { label: "Narrative Patterns" },
        ]}
      />

      <section className="hero-panel p-4">
        <SectionIntro
          as="h1"
          eyebrow="Narrative index"
          title="Narrative Patterns"
          description="Track recurring public claim patterns, the profiles connected to them, and the explainers that provide historical and policy context."
          actions={
            <>
              <Link
                href="/narrative-accountability"
                className="dashboard-button-secondary"
              >
                All profiles
              </Link>
              <Link href="/explainers" className="dashboard-button-secondary">
                Open explainers
              </Link>
            </>
          }
        />
      </section>

      <Panel padding="md" className="bg-[rgba(18,31,49,0.52)]">
        <p className="text-sm leading-7 text-[var(--ink-soft)]">
          These patterns group public claims and arguments. They do not assign motive,
          character, or private intent.
        </p>
      </Panel>

      <section className="space-y-4">
        <SectionIntro
          eyebrow="Cross-profile view"
          title="Pattern heatmap"
          description="See which recurring narratives appear across published accountability profiles. Counts include visible sourced statements only."
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Total patterns"
            value={summaryStats.total_patterns}
            description="Canonical public narrative tags in the current registry."
            tone="accent"
          />
          <KpiCard
            label="Tagged visible statements"
            value={summaryStats.total_tagged_visible_statements}
            description="Visible published statement-to-pattern matches only."
            tone="accent"
          />
          <KpiCard
            label="Profiles represented"
            value={summaryStats.total_profiles_with_tagged_statements}
            description="Published profiles that currently contribute tagged visible statements."
            tone="accent"
          />
          <KpiCard
            label="Most repeated pattern"
            value={summaryStats.most_repeated_pattern?.visible_statement_count || 0}
            description={
              summaryStats.most_repeated_pattern?.label ||
              "No published visible statements are currently tagged."
            }
            tone="accent"
          />
        </div>

        <Panel padding="md" className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Profile-by-pattern matrix</p>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                Darker cells indicate a higher count of visible published statements tied
                to that pattern for the profile.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusPill tone="default">0 no visible statements</StatusPill>
              <StatusPill tone="info">1 statement</StatusPill>
              <StatusPill tone="verified">2+ statements</StatusPill>
            </div>
          </div>

          {heatmap.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-[1120px] w-full border-separate border-spacing-y-2">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                      Profile
                    </th>
                    <th className="px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                      Role type
                    </th>
                    {tagColumns.map((tag) => (
                      <th
                        key={`heatmap-${tag.id}`}
                        className="min-w-[150px] px-2 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]"
                      >
                        {tag.label}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                      Total tagged
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {heatmap.map((row) => (
                    <tr key={`heatmap-row-${row.profile_slug}`}>
                      <td className="px-3 py-2 align-top">
                        <Link
                          href={`/narrative-accountability/${row.profile_slug}`}
                          className="text-sm font-semibold text-white transition-colors hover:text-[var(--info)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(132,247,198,0.28)]"
                        >
                          {row.profile_name}
                        </Link>
                        <p className="mt-1 text-xs leading-5 text-[var(--ink-soft)]">
                          {row.platform_or_role}
                        </p>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <StatusPill tone="default">
                          {row.public_role_type || "Public figure"}
                        </StatusPill>
                      </td>
                      {row.patterns.map((pattern) => (
                        <td
                          key={`${row.profile_slug}-${pattern.tag_id}`}
                          className="px-2 py-2 align-top"
                        >
                          <div
                            className={`flex min-h-14 items-center justify-center rounded-lg border px-3 py-3 text-sm font-semibold ${getHeatmapCellClass(
                              pattern.visible_statement_count
                            )}`}
                          >
                            {pattern.visible_statement_count}
                          </div>
                        </td>
                      ))}
                      <td className="px-3 py-2 align-top">
                        <div className="flex min-h-14 items-center justify-center rounded-lg border border-[rgba(132,247,198,0.24)] bg-[rgba(132,247,198,0.07)] px-3 py-3 text-sm font-semibold text-white">
                          {row.total_visible_tagged_statements}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm leading-7 text-[var(--ink-soft)]">
              No published profiles currently contribute visible tagged statements to
              the public pattern heatmap.
            </p>
          )}
        </Panel>
      </section>

      <section className="space-y-4">
        <SectionIntro
          eyebrow="Patterns"
          title="Narrative pattern cards"
          description="Each card groups visible statements from published profiles only. Held statements and unpublished drafts stay out of this public index."
        />

        <Panel padding="md" className="bg-[rgba(18,31,49,0.52)]">
          <p className="text-sm leading-7 text-[var(--ink-soft)]">
            Lower counts may reflect stricter sourcing requirements, not absence of the narrative.
          </p>
        </Panel>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {narrativeIndex.map((item) => {
            const related = (item.related_explainers || [])
              .map((slug) => explainersBySlug.get(slug))
              .filter(Boolean);
            const coverage = coverageByTagId.get(item.tag.id);

            return (
              <Panel
                key={item.tag.id}
                as="article"
                padding="md"
                className="flex h-full flex-col"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                      Narrative pattern
                    </p>
                    <h2 className="mt-2 text-lg font-semibold text-white">
                      {item.tag.label}
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill tone="info">
                      {item.statement_count} statement
                      {item.statement_count === 1 ? "" : "s"}
                    </StatusPill>
                    <StatusPill tone="default">
                      {item.profile_count} profile
                      {item.profile_count === 1 ? "" : "s"}
                    </StatusPill>
                    <StatusPill tone="default">
                      {related.length} explainer
                      {related.length === 1 ? "" : "s"}
                    </StatusPill>
                  </div>
                </div>

                <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">
                  {item.tag.description}
                </p>

                {item.tag.evidence_context ? (
                  <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">
                    <span className="font-semibold text-white">Evidence focus:</span>{" "}
                    {item.tag.evidence_context}
                  </p>
                ) : null}

                <div className="mt-4 space-y-3">
                  <p className="text-sm font-semibold text-white">Evidence strength</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Panel padding="md" className="bg-[rgba(8,16,27,0.55)]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                        Statements
                      </p>
                      <p className="mt-2 text-base font-semibold text-white">
                        {coverage?.statement_count ?? item.statement_count}
                      </p>
                    </Panel>
                    <Panel padding="md" className="bg-[rgba(8,16,27,0.55)]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                        Profiles
                      </p>
                      <p className="mt-2 text-base font-semibold text-white">
                        {coverage?.profile_count ?? item.profile_count}
                      </p>
                    </Panel>
                    <Panel padding="md" className="bg-[rgba(8,16,27,0.55)]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                        Avg. sources
                      </p>
                      <p className="mt-2 text-base font-semibold text-white">
                        {formatAverage(coverage?.avg_sources_per_statement ?? 0)}
                      </p>
                    </Panel>
                    <Panel padding="md" className="bg-[rgba(8,16,27,0.55)]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                        Coverage
                      </p>
                      <p className="mt-2 text-base font-semibold text-white">
                        {formatCoverageLabel(coverage?.coverage_level)}
                      </p>
                    </Panel>
                  </div>
                </div>

                {related.length ? (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-semibold text-white">
                      Related explainers
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {related.map((explainer) => (
                        <Link
                          key={explainer.slug}
                          href={`/explainers/${explainer.slug}`}
                          className="inline-flex"
                        >
                          <StatusPill tone="default">{explainer.title}</StatusPill>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}

                {item.statements_preview.length ? (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-semibold text-white">
                      Statement preview
                    </p>
                    <div className="grid gap-2">
                      {item.statements_preview.map((statement) => (
                        <Panel
                          key={`${item.tag.id}-${statement.profile_slug}-${statement.statement_title}`}
                          padding="md"
                          className="bg-[rgba(8,16,27,0.55)]"
                        >
                          <p className="text-sm font-semibold text-white">
                            {statement.profile_name}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
                            {statement.statement_title}
                          </p>
                        </Panel>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Panel padding="md" className="mt-4 bg-[rgba(8,16,27,0.55)]">
                    <p className="text-sm leading-6 text-[var(--ink-soft)]">
                      No published visible statements are grouped under this pattern yet.
                    </p>
                  </Panel>
                )}

                <div className="mt-auto pt-5">
                  <Link
                    href={`/narrative-accountability/patterns/${item.tag.id}`}
                    className="dashboard-button-secondary"
                  >
                    View pattern
                  </Link>
                </div>
              </Panel>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <CitationNote description="Pattern pages group published statements only. Quote the specific statement card and the linked profile if you cite a pattern externally." />
      </section>
    </main>
  );
}
