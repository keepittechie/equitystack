import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import { fetchExplainersIndexData } from "@/lib/public-site-data";
import StructuredData from "@/app/components/public/StructuredData";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  DashboardFilterBar,
  ImpactOverviewCards,
  SectionIntro,
} from "@/app/components/public/core";
import {
  Panel,
  SectionHeader,
  StatusPill,
} from "@/app/components/dashboard/primitives";
import {
  getExplainerClaimType,
} from "@/app/components/public/entities";
import {
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
  buildItemListJsonLd,
} from "@/lib/structured-data";

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "Map of Common Claims | EquityStack",
  description:
    "Navigate recurring claims, misused statistics, and evidence-based explainers through EquityStack's visual claim map.",
  path: "/explainers/claim-map",
  keywords: [
    "misused statistics",
    "claim map",
    "argument-ready explainers",
    "EquityStack explainers",
  ],
});

const CLAIM_CLUSTERS = [
  {
    id: "crime-public-safety",
    title: "Crime and public safety",
    description:
      "Claims that use crime data, sentencing, victimization patterns, or vague cultural explanations to make racial conclusions that the record does not prove.",
    slugs: [
      "understanding-13-50-crime-statistic",
      "black-on-black-crime-claim",
      "culture-causes-crime-claim",
      "crime-statistics-context-and-misuse",
      "sentencing-disparities-united-states",
    ],
  },
  {
    id: "poverty-public-benefits",
    title: "Poverty and public benefits",
    description:
      "Claims that treat poverty, public support, or mobility as simple evidence of behavior while ignoring eligibility, measurement, and policy context.",
    slugs: [
      "welfare-dependency-claims",
      "family-structure-and-poverty-claims",
      "government-benefits-racial-gap",
      "bootstraps-vs-policy-reality",
    ],
  },
  {
    id: "race-merit-institutions",
    title: "Race, merit, and institutions",
    description:
      "Claims that use ideas about merit, intelligence, or group comparison to explain inequality without accounting for measurement limits, selection effects, or institutional context.",
    slugs: [
      "white-house-dei-economic-study",
      "iq-and-intelligence-gap-claims",
      "immigration-comparison-claims",
    ],
  },
  {
    id: "law-rights-formal-neutrality",
    title: "Law, rights, and formal neutrality",
    description:
      "Claims that treat constitutional language, equal-treatment rhetoric, or anti-DEI rollback arguments as proof that institutions are already fair in practice.",
    slugs: [
      "equal-protection-under-the-law",
      "hiring-discrimination-and-anti-dei-rollbacks",
    ],
  },
  {
    id: "historical-impact-policy-memory",
    title: "Historical impact and policy memory",
    description:
      "Claims that disconnect current outcomes from past policy choices, ignoring how law, housing, education, and wealth compound over time.",
    slugs: [
      "historical-impact-denial-claims",
      "mass-incarceration-policy-history",
      "redlining-black-homeownership",
      "gi-bill-access-and-impact",
      "homestead-act-exclusion",
    ],
  },
  {
    id: "party-history-realignment",
    title: "Party history and realignment",
    description:
      "Claims that use party labels as timeless proof while skipping coalition shifts, regional splits, and the actual voting record on civil-rights policy.",
    slugs: [
      "party-switch-southern-strategy",
      "party-voting-records-racial-policy",
    ],
  },
  {
    id: "election-legitimacy",
    title: "Election claims and political legitimacy",
    description:
      "Claims that turn isolated or unverified election-integrity concerns into broad claims about illegitimate political power.",
    slugs: ["non-citizen-voting-claims"],
  },
];

const CLAIM_PATTERNS = [
  {
    name: "Anecdote -> system claim",
    description:
      "A single case or short list is treated as proof of a broad, recurring pattern.",
    slug: "non-citizen-voting-claims",
  },
  {
    name: "Disparity -> causation claim",
    description:
      "A measured gap is presented as proof of why the gap exists without testing competing causes.",
    slug: "understanding-13-50-crime-statistic",
  },
  {
    name: "Group statistic -> individual suspicion",
    description:
      "A population-level number is used to imply something about an individual person.",
    slug: "understanding-13-50-crime-statistic",
  },
  {
    name: "Correlation -> blame",
    description:
      "A relationship between variables is treated as a complete moral or behavioral explanation.",
    slug: "family-structure-and-poverty-claims",
  },
  {
    name: "Selection bias ignored",
    description:
      "Groups with different starting conditions are compared as if they were randomly assigned.",
    slug: "immigration-comparison-claims",
  },
  {
    name: "Historical context removed",
    description:
      "Current outcomes are separated from policy timelines, institutions, and accumulated resources.",
    slug: "historical-impact-denial-claims",
  },
  {
    name: "Party label -> timeless proof",
    description:
      "A party name is treated as enough evidence without checking coalition shifts, regional splits, or the underlying vote.",
    slug: "party-voting-records-racial-policy",
  },
  {
    name: "Paper neutrality -> equal outcomes",
    description:
      "Race-neutral legal wording is treated as proof that enforcement or outcomes must also be equal.",
    slug: "equal-protection-under-the-law",
  },
  {
    name: "Program exists -> equal access",
    description:
      "A benefit or opportunity is treated as equally available because it existed on paper.",
    slug: "government-benefits-racial-gap",
  },
  {
    name: "Reform happened -> problem solved",
    description:
      "A later reform is used to erase the earlier policy problem or to claim the system is now fully fair.",
    slug: "sentencing-disparities-united-states",
  },
  {
    name: "Self-reliance slogan -> structural denial",
    description:
      "A call for personal responsibility is used to dismiss how policy shaped access to mobility in the first place.",
    slug: "bootstraps-vs-policy-reality",
  },
  {
    name: "Crime number -> policy conclusion",
    description:
      "A headline statistic is used to justify a much broader claim about race, danger, or policy without enough measurement context.",
    slug: "crime-statistics-context-and-misuse",
  },
];

function buildClusters(items = []) {
  const itemsBySlug = new Map(items.map((item) => [item.slug, item]));

  return CLAIM_CLUSTERS.map((cluster) => ({
    ...cluster,
    items: cluster.slugs.map((slug) => itemsBySlug.get(slug)).filter(Boolean),
    omittedCount: cluster.slugs.filter((slug) => !itemsBySlug.has(slug)).length,
  })).filter((cluster) => cluster.items.length);
}

function summarizeClusterTags(items = []) {
  const seen = new Set();
  const tags = [];

  for (const item of items) {
    for (const tag of item.tags || []) {
      if (seen.has(tag)) continue;
      seen.add(tag);
      tags.push(tag);
    }
  }

  return tags.slice(0, 5);
}

function ExplainerMiniCard({ item }) {
  const tags = (item.tags || []).slice(0, 3);
  const claimType = getExplainerClaimType(item);

  return (
    <Panel as="article" padding="md" className="flex h-full flex-col bg-[rgba(18,31,49,0.52)]">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone="default">{item.category || "Explainer"}</StatusPill>
        <StatusPill tone={claimType.tone}>{claimType.label}</StatusPill>
        {item.argument_ready ? <StatusPill tone="info">Argument-ready</StatusPill> : null}
      </div>
      <h3 className="mt-3 text-base font-semibold text-white">{item.title}</h3>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--ink-soft)]">
        {item.summary}
      </p>
      {tags.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-[var(--line)] bg-[rgba(11,20,33,0.58)] px-2 py-1 text-[11px] font-semibold text-[var(--ink-muted)]"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <Link href={`/explainers/${item.slug}`} className="dashboard-button-secondary">
          Read explainer
        </Link>
        {item.argument_ready ? (
          <Link
            href={`/explainers/${item.slug}?mode=argument`}
            className="dashboard-button-secondary"
          >
            Argument mode
          </Link>
        ) : null}
      </div>
    </Panel>
  );
}

export default async function ClaimMapPage() {
  const data = await fetchExplainersIndexData();
  const clusters = buildClusters(data.items || []);
  const mappedExplainerCount = clusters.reduce((count, cluster) => count + cluster.items.length, 0);
  const omittedOptionalCount = clusters.reduce(
    (count, cluster) => count + cluster.omittedCount,
    0
  );
  const itemsBySlug = new Map((data.items || []).map((item) => [item.slug, item]));
  const visiblePatternItems = CLAIM_PATTERNS.filter((item) => itemsBySlug.has(item.slug));

  return (
    <main className="space-y-4">
      <StructuredData
        data={[
          buildBreadcrumbJsonLd(
            [
              { href: "/", label: "Home" },
              { href: "/explainers", label: "Explainers" },
              { label: "Claim map" },
            ],
            "/explainers/claim-map"
          ),
          buildCollectionPageJsonLd({
            title: "Map of Common Claims",
            description:
              "A visual guide to recurring claims, misused statistics, and argument patterns covered by EquityStack explainers.",
            path: "/explainers/claim-map",
            about: ["Misused statistics", "Argument patterns", "EquityStack explainers"],
            keywords: ["claim map", "misused claims", "argument-ready explainers"],
          }),
          buildItemListJsonLd({
            title: "Explainers visible in the EquityStack claim map",
            description:
              "Explainers grouped by common claim pattern in the EquityStack claim map.",
            path: "/explainers/claim-map",
            items: clusters
              .flatMap((cluster) => cluster.items)
              .map((item) => ({
                href: `/explainers/${item.slug}`,
                name: item.title,
              })),
          }),
        ]}
      />
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/explainers", label: "Explainers" },
          { label: "Claim map" },
        ]}
      />

      <section className="hero-panel p-4">
        <SectionIntro
          as="h1"
          eyebrow="Claim map"
          title="Map of Common Claims"
          description="A visual guide to recurring claims, misused statistics, and argument patterns covered by EquityStack explainers."
          actions={
            <>
              <Link href="/explainers" className="dashboard-button-secondary w-full sm:w-auto">
                Browse all explainers
              </Link>
              <Link href="/arguments" className="dashboard-button-secondary w-full sm:w-auto">
                Open argument database
              </Link>
            </>
          }
        />
      </section>

      <ImpactOverviewCards
        items={[
          {
            label: "Claim clusters",
            value: clusters.length,
            description: "Claim families represented by published explainers.",
            tone: "accent",
          },
          {
            label: "Mapped explainers",
            value: mappedExplainerCount,
            description: "Published explainers shown here.",
          },
          {
            label: "Argument links",
            value: clusters.flatMap((cluster) => cluster.items).filter((item) => item.argument_ready)
              .length,
            description: "Mapped explainers with Argument Mode.",
          },
          {
            label: "Optional slugs skipped",
            value: omittedOptionalCount,
            description: "Future optional explainers not published.",
          },
        ]}
      />

      <DashboardFilterBar helpText="Start with the cluster that matches the claim, then open the explainer or jump directly into Argument Mode for debate-ready responses.">
        <div className="flex flex-wrap gap-2">
          {clusters.map((cluster) => (
            <Link
              key={cluster.id}
              href={`#${cluster.id}`}
              className="dashboard-button-secondary w-full sm:w-auto"
            >
              {cluster.title}
            </Link>
          ))}
        </div>
      </DashboardFilterBar>

      <Panel padding="md" className="space-y-4">
        <SectionIntro
          eyebrow="How to use this map"
          title="Find the claim pattern first, then choose the explainer."
          description="The clusters are not a new taxonomy or scoring system. They are a navigation layer over existing explainers so users can move from a broad claim family into the specific evidence page."
        />
        <div className="grid gap-3 md:grid-cols-3">
          <Panel padding="md" className="bg-[rgba(18,31,49,0.52)]">
            <h2 className="text-sm font-semibold text-white">Identify the claim type</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
              Look for the move being made: causation, blame, selection bias, historical erasure, or anecdote-to-system.
            </p>
          </Panel>
          <Panel padding="md" className="bg-[rgba(18,31,49,0.52)]">
            <h2 className="text-sm font-semibold text-white">Open the closest explainer</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
              Each card links to the full evidence page, source context, related records, and structured sections.
            </p>
          </Panel>
          <Panel padding="md" className="bg-[rgba(18,31,49,0.52)]">
            <h2 className="text-sm font-semibold text-white">Use Argument Mode when needed</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
              Argument links open the condensed claim, response, key question, and share-card layer for quick use.
            </p>
          </Panel>
        </div>
      </Panel>

      <section className="grid gap-4 xl:grid-cols-2">
        {clusters.map((cluster) => {
          const tags = summarizeClusterTags(cluster.items);

          return (
            <Panel key={cluster.id} id={cluster.id} className="overflow-hidden">
              <SectionHeader
                eyebrow="Claim cluster"
                title={cluster.title}
                description={cluster.description}
              />
              <div className="space-y-4 p-4">
                {tags.length ? (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <StatusPill key={tag} tone="default">
                        {tag}
                      </StatusPill>
                    ))}
                  </div>
                ) : null}
                <div className="grid gap-4 md:grid-cols-2">
                  {cluster.items.map((item) => (
                    <ExplainerMiniCard key={item.slug} item={item} />
                  ))}
                </div>
              </div>
            </Panel>
          );
        })}
      </section>

      <Panel className="overflow-hidden">
        <SectionHeader
          eyebrow="Claim pattern legend"
          title="Common argument errors"
          description="These are recurring moves that turn partial evidence into stronger conclusions than the record supports."
        />
        <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
          {visiblePatternItems.map((item) => {
            const explainer = itemsBySlug.get(item.slug);

            return (
              <Panel key={item.name} padding="md" className="flex h-full flex-col">
                <h3 className="text-base font-semibold text-white">{item.name}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
                  {item.description}
                </p>
                {explainer ? (
                  <Link
                    href={`/explainers/${explainer.slug}`}
                    className="mt-auto pt-4 text-sm font-semibold text-[var(--ink-soft)] transition-[color] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(132,247,198,0.28)]"
                  >
                    Related explainer: {explainer.title}
                  </Link>
                ) : null}
              </Panel>
            );
          })}
        </div>
      </Panel>

      <Panel padding="md" className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Keep browsing the evidence layer</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--ink-soft)]">
            The map is a starting point. The explainer library and argument database provide the full record and reusable responses.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/explainers" className="dashboard-button-primary w-full sm:w-auto">
            Browse all explainers
          </Link>
          <Link href="/arguments" className="dashboard-button-secondary w-full sm:w-auto">
            Open argument database
          </Link>
        </div>
      </Panel>
    </main>
  );
}
