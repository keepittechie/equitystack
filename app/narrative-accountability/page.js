import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import {
  getPublishedNarrativeProfiles,
} from "@/lib/narrative-accountability/data";
import StructuredData from "@/app/components/public/StructuredData";
import { Breadcrumbs } from "@/app/components/public/chrome";
import NarrativeProfilePortrait from "@/app/components/public/NarrativeProfilePortrait";
import {
  CitationNote,
  MethodologyCallout,
  SectionIntro,
} from "@/app/components/public/core";
import TrustBar from "@/app/components/public/TrustBar";
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
  title: "Narrative Accountability | EquityStack",
  description:
    "Evidence-based profiles tracking public claims, documented narratives, source receipts, and rebuttals.",
  path: "/narrative-accountability",
  keywords: [
    "narrative accountability",
    "public claims and receipts",
    "misleading claim tracking",
  ],
});

function formatCategories(categories = []) {
  return (Array.isArray(categories) ? categories : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

export default function NarrativeAccountabilityPage() {
  const profiles = getPublishedNarrativeProfiles();
  const featuredProfileHref = profiles[0]
    ? `/narrative-accountability/${profiles[0].slug}`
    : null;

  return (
    <main className="space-y-4">
      <StructuredData
        data={[
          buildBreadcrumbJsonLd(
            [{ href: "/", label: "Home" }, { label: "Narrative Accountability" }],
            "/narrative-accountability"
          ),
          buildCollectionPageJsonLd({
            title: "Narrative Accountability",
            description:
              "A public EquityStack section for tracking claims, quoting exact statements, evaluating them against evidence, and preserving receipts.",
            path: "/narrative-accountability",
            about: [
              "public claims",
              "historical rebuttals",
              "data rebuttals",
              "source receipts",
            ],
            keywords: [
              "narrative accountability",
              "claim evaluation",
            ],
          }),
          buildItemListJsonLd({
            title: "Narrative Accountability profiles",
            description:
              "Published Narrative Accountability profiles with sourced claims, rebuttals, and receipts.",
            path: "/narrative-accountability",
            items: profiles.map((profile) => ({
              href: `/narrative-accountability/${profile.slug}`,
              name: profile.display_name,
            })),
          }),
        ]}
      />
      <Breadcrumbs
        items={[{ href: "/", label: "Home" }, { label: "Narrative Accountability" }]}
      />

      <section className="hero-panel p-4">
        <SectionIntro
          as="h1"
          eyebrow="Claims and receipts"
          title="Narrative Accountability"
          description="This section tracks public claims, quotes exact statements, evaluates them against historical record and data, and preserves the receipts needed to verify the rebuttal."
          actions={
            <>
              <Link href="/methodology" className="dashboard-button-primary">
                Read methodology
              </Link>
              <Link href="/explainers" className="dashboard-button-secondary">
                Open explainers
              </Link>
              {featuredProfileHref ? (
                <Link href={featuredProfileHref} className="dashboard-button-secondary">
                  Open a published profile
                </Link>
              ) : null}
            </>
          }
        />
      </section>

      <TrustBar />

      <section className="space-y-4">
        <Panel padding="md" className="space-y-4">
          <SectionIntro
            eyebrow="Pattern index"
            title="Explore narrative patterns"
            description="Group public claims by recurring narrative pattern and see which profiles and explainers connect to each issue."
            actions={
              <Link
                href="/narrative-accountability/patterns"
                className="dashboard-button-secondary"
              >
                View Narrative Patterns
              </Link>
            }
          />
        </Panel>
      </section>

      <section className="space-y-4">
        <Panel padding="md" className="space-y-4">
          <SectionIntro
            eyebrow="How it works"
            title="How this section evaluates public claims"
            description="The goal is to document what was said, show what evidence is available, and make the rebuttal inspectable."
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Track public claims",
                detail:
                  "Each entry starts with a quoted public statement and basic source context.",
              },
              {
                label: "Quote exact statements",
                detail:
                  "The page preserves the wording that is being evaluated instead of summarizing it loosely.",
              },
              {
                label: "Evaluate against record and data",
                detail:
                  "Every statement can carry historical and data-based rebuttal fields so the critique stays tied to evidence.",
              },
              {
                label: "Provide receipts",
                detail:
                  "Receipts list the supporting sources that let readers verify the rebuttal directly.",
              },
            ].map((item) => (
              <Panel key={item.label} padding="md" className="bg-[rgba(18,31,49,0.52)]">
                <p className="text-sm font-semibold text-white">{item.label}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">{item.detail}</p>
              </Panel>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Panel padding="md" className="bg-[rgba(18,31,49,0.52)]">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                Disclaimer
              </p>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                Narrative Accountability focuses on claims, not personal intent. The purpose is to evaluate the public statement against evidence, not to speculate about motive.
              </p>
            </Panel>
            <MethodologyCallout
              title="Sourcing rule"
              description="All entries require sourcing and review. Profiles stay unpublished until the quote, rebuttal path, and receipts are ready for public inspection."
              href="/research/how-black-impact-score-works"
              linkLabel="Read evidence methodology"
            />
          </div>
        </Panel>
      </section>

      <section className="space-y-4">
        <SectionIntro
          eyebrow="Profiles"
          title="Published profiles"
          description="Only reviewed profiles appear here. Unpublished drafts and in-progress entries stay off the public list until their sourcing is ready."
        />
        {profiles.length ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {profiles.map((profile) => {
              const categories = formatCategories(profile.claim_categories);

              return (
                <Panel
                  key={profile.slug}
                  as="article"
                  padding="md"
                  className="flex h-full flex-col"
                >
                  <div className="flex flex-wrap items-start gap-4">
                    <NarrativeProfilePortrait
                      portraitUrl={profile.portrait_url}
                      portraitAlt={profile.portrait_alt}
                      displayName={profile.display_name}
                      context="card"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                            {profile.platform_or_role}
                          </p>
                          <h2 className="mt-2 text-lg font-semibold text-white">
                            {profile.display_name}
                          </h2>
                        </div>
                        <StatusPill tone="info">
                          {profile.statement_count} statement{profile.statement_count === 1 ? "" : "s"}
                        </StatusPill>
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">
                    {profile.short_summary}
                  </p>
                  {categories.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {categories.map((category) => (
                        <StatusPill key={category} tone="default">
                          {category}
                        </StatusPill>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-auto pt-5">
                    <Link
                      href={`/narrative-accountability/${profile.slug}`}
                      className="dashboard-button-secondary"
                    >
                      Open profile
                    </Link>
                  </div>
                </Panel>
              );
            })}
          </div>
        ) : (
          <Panel padding="md">
            <p className="text-sm leading-7 text-[var(--ink-soft)]">
              No Narrative Accountability profiles are published yet. Profiles remain hidden until their quotes, rebuttals, and receipts are reviewed.
            </p>
          </Panel>
        )}
      </section>

      <section className="space-y-4">
        <CitationNote description="Treat this section as a structured accountability layer. Quote the exact statement, the EquityStack page URL, and the linked receipts if you reference a profile externally." />
      </section>
    </main>
  );
}
