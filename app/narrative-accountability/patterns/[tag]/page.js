import Link from "next/link";
import { notFound } from "next/navigation";
import { buildPageMetadata } from "@/lib/metadata";
import {
  getPublishedNarrativeStatementsByTag,
} from "@/lib/narrative-accountability/data";
import {
  getNarrativeTagById,
  getNarrativeTags,
} from "@/lib/narrative-accountability/narrative-tags";
import {
  getNarrativeConcentration,
  getNarrativeCoverage,
  getNarrativeTimeline,
  getNarrativeTimelineByProfile,
} from "@/lib/narrative-accountability/patternAnalytics";
import { fetchExplainerDetailData } from "@/lib/public-site-data";
import StructuredData from "@/app/components/public/StructuredData";
import { Breadcrumbs } from "@/app/components/public/chrome";
import NarrativeProfilePortrait from "@/app/components/public/NarrativeProfilePortrait";
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

export const dynamic = "force-dynamic";

function getSeverityTone(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "high") return "danger";
  if (normalized === "medium") return "warning";
  return "info";
}

function formatSharePercent(value) {
  if (!Number.isFinite(value)) {
    return "0%";
  }

  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value % 1 === 0 ? 0 : 1,
  }).format(value)}%`;
}

function getTimelineBarClass(densityLevel) {
  if (densityLevel >= 3) {
    return "bg-[rgba(132,247,198,0.42)]";
  }

  if (densityLevel === 2) {
    return "bg-[rgba(125,211,252,0.38)]";
  }

  if (densityLevel === 1) {
    return "bg-[rgba(255,255,255,0.22)]";
  }

  return "bg-[rgba(255,255,255,0.12)]";
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

function getUniqueSourceCount(statements = []) {
  const keys = new Set();

  (Array.isArray(statements) ? statements : []).forEach((item) => {
    [...(item.statement_sources || []), ...(item.receipts || [])].forEach((source) => {
      const key = String(
        source?.url ||
          [
            source?.publisher_or_source || source?.label || "",
            source?.title || "",
            source?.note || "",
          ]
            .filter(Boolean)
            .join("::")
      ).trim();

      if (key) {
        keys.add(key);
      }
    });
  });

  return keys.size;
}

function groupStatementsByProfile(statements = []) {
  const groups = new Map();

  (Array.isArray(statements) ? statements : []).forEach((item) => {
    const slug = String(item?.profile_slug || "").trim();
    if (!slug) {
      return;
    }

    if (!groups.has(slug)) {
      groups.set(slug, {
        profile_slug: slug,
        profile_name: item.profile_name,
        platform_or_role: item.platform_or_role,
        portrait_url: item.portrait_url || null,
        portrait_alt: item.portrait_alt || null,
        href: item.href,
        statements: [],
      });
    }

    groups.get(slug).statements.push(item);
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      statement_count: group.statements.length,
      source_count: getUniqueSourceCount(group.statements),
    }))
    .sort((left, right) => {
      if (right.statement_count !== left.statement_count) {
        return right.statement_count - left.statement_count;
      }

      return String(left.profile_name || "").localeCompare(String(right.profile_name || ""));
    });
}

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

export function generateStaticParams() {
  return getNarrativeTags().map((tag) => ({ tag: tag.id }));
}

export async function generateMetadata({ params }) {
  const { tag } = await params;
  const narrativeTag = getNarrativeTagById(tag);

  if (!narrativeTag) {
    return buildPageMetadata({
      title: "Narrative Pattern Not Found | EquityStack",
      description: "The requested narrative pattern could not be found.",
      path: `/narrative-accountability/patterns/${tag}`,
    });
  }

  return buildPageMetadata({
    title: `${narrativeTag.label} | Narrative Patterns | EquityStack`,
    description: narrativeTag.description,
    path: `/narrative-accountability/patterns/${narrativeTag.id}`,
  });
}

export default async function NarrativePatternDetailPage({ params }) {
  const { tag } = await params;
  const narrativeTag = getNarrativeTagById(tag);

  if (!narrativeTag) {
    notFound();
  }

  const statements = getPublishedNarrativeStatementsByTag(narrativeTag.id);
  const relatedExplainers = await resolveExplainers(narrativeTag.related_explainers);
  const profileGroups = groupStatementsByProfile(statements);
  const profilesRepresented = profileGroups.length;
  const sourceCount = getUniqueSourceCount(statements);
  const concentration = getNarrativeConcentration(narrativeTag.id);
  const coverage = getNarrativeCoverage(narrativeTag.id);
  const topContributor = concentration[0] || null;
  const timeline = getNarrativeTimeline(narrativeTag.id);
  const timelineByProfile = getNarrativeTimelineByProfile(narrativeTag.id);

  return (
    <main className="space-y-4">
      <StructuredData
        data={[
          buildBreadcrumbJsonLd(
            [
              { href: "/", label: "Home" },
              { href: "/narrative-accountability", label: "Narrative Accountability" },
              { href: "/narrative-accountability/patterns", label: "Narrative Patterns" },
              { label: narrativeTag.label },
            ],
            `/narrative-accountability/patterns/${narrativeTag.id}`
          ),
          buildCollectionPageJsonLd({
            title: narrativeTag.label,
            description: narrativeTag.description,
            path: `/narrative-accountability/patterns/${narrativeTag.id}`,
            about: [narrativeTag.label, "narrative pattern", "published statements"],
            keywords: [
              "narrative pattern",
              narrativeTag.id,
            ],
          }),
          buildItemListJsonLd({
            title: `${narrativeTag.label} statements`,
            description:
              "Published visible Narrative Accountability statements grouped under this pattern.",
            path: `/narrative-accountability/patterns/${narrativeTag.id}`,
            items: statements.map((item) => ({
              href: item.href,
              name: `${item.profile_name}: ${item.statement_title}`,
            })),
          }),
        ]}
      />
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/narrative-accountability", label: "Narrative Accountability" },
          { href: "/narrative-accountability/patterns", label: "Narrative Patterns" },
          { label: narrativeTag.label },
        ]}
      />

      <Panel prominence="primary" className="overflow-hidden">
        <SectionIntro
          as="h1"
          eyebrow="Narrative pattern"
          title={narrativeTag.label}
          description={narrativeTag.description}
          actions={
            <>
              <Link
                href="/narrative-accountability/patterns"
                className="dashboard-button-secondary"
              >
                All patterns
              </Link>
              <Link
                href="/narrative-accountability"
                className="dashboard-button-secondary"
              >
                All profiles
              </Link>
            </>
          }
        />
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap gap-2">
            <StatusPill tone="info">
              {statements.length} visible statement{statements.length === 1 ? "" : "s"}
            </StatusPill>
            <StatusPill tone="default">
              {profilesRepresented} profile{profilesRepresented === 1 ? "" : "s"}
            </StatusPill>
            <StatusPill tone="default">
              {sourceCount} source{sourceCount === 1 ? "" : "s"}
            </StatusPill>
          </div>
          <Panel padding="md" className="bg-[rgba(18,31,49,0.52)]">
            <p className="text-sm leading-7 text-[var(--ink-soft)]">
              {narrativeTag.caution}
            </p>
          </Panel>
        </div>
      </Panel>

      <section className="space-y-4">
        <SectionIntro
          eyebrow="Pattern evolution"
          title="Timeline density view"
          description="Track how often this narrative appears in documented public statements over time."
        />

        <Panel padding="md" className="space-y-4">
          <p className="text-sm leading-7 text-[var(--ink-soft)]">
            Counts include published profiles, visible statements, and only
            statements with a verified `statement_date`.
          </p>

          {timeline.length ? (
            <div className="space-y-3">
              <div className="grid grid-cols-[96px_72px_minmax(0,1fr)] gap-3 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                <span>Year</span>
                <span>Count</span>
                <span>Visual</span>
              </div>
              {timeline.map((item) => {
                const width =
                  item.max_count > 0
                    ? `${Math.max(
                        12,
                        Math.round((item.count / item.max_count) * 100)
                      )}%`
                    : "12%";

                return (
                  <div
                    key={`timeline-${item.year}`}
                    className="grid grid-cols-[96px_72px_minmax(0,1fr)] items-center gap-3 rounded-xl border border-[var(--line)] bg-[rgba(18,31,49,0.52)] p-4"
                  >
                    <p className="text-sm font-semibold text-white">{item.year}</p>
                    <p className="text-sm font-semibold text-white">{item.count}</p>
                    <div className="space-y-2">
                      <div className="rounded-full border border-[var(--line)] bg-[rgba(6,16,28,0.72)] p-1">
                        <div
                          className={`h-3 rounded-full transition-none ${getTimelineBarClass(
                            item.density_level
                          )}`}
                          style={{ width }}
                        />
                      </div>
                      <p className="text-xs leading-5 text-[var(--ink-soft)]">
                        {item.count} documented statement
                        {item.count === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Panel padding="md" className="bg-[rgba(18,31,49,0.52)]">
              <p className="text-sm leading-7 text-[var(--ink-soft)]">
                No verified dated statements available for this pattern yet.
              </p>
            </Panel>
          )}

          {timelineByProfile.length ? (
            <details className="rounded-xl border border-[var(--line)] bg-[rgba(18,31,49,0.52)] p-4">
              <summary className="cursor-pointer text-sm font-semibold text-white">
                Show profile contributions by year
              </summary>
              <div className="mt-4 space-y-3">
                {timelineByProfile.map((profile) => (
                  <div
                    key={`timeline-profile-${profile.profile_slug}`}
                    className="rounded-lg border border-[var(--line)] bg-[rgba(6,16,28,0.58)] px-4 py-3"
                  >
                    <p className="text-sm font-semibold text-white">
                      {profile.profile_name}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {profile.yearly_counts.map((item) => (
                        <StatusPill
                          key={`timeline-profile-${profile.profile_slug}-${item.year}`}
                          tone="default"
                        >
                          {item.year}: {item.count}
                        </StatusPill>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </Panel>
      </section>

      <section className="space-y-4">
        <SectionIntro
          eyebrow="Analytical view"
          title="Narrative vs. evidence"
          description="Compare the recurring claim, why it is contested, and what evidence or explainers provide the strongest context before reading the linked profile statements."
        />
        <div className="grid gap-4 xl:grid-cols-3">
          <Panel padding="md">
            <p className="text-sm font-semibold text-white">Narrative claim</p>
            <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
              {narrativeTag.narrative_claim_summary || narrativeTag.description}
            </p>
          </Panel>
          <Panel padding="md">
            <p className="text-sm font-semibold text-white">Why contested</p>
            <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
              {narrativeTag.why_contested || narrativeTag.why_it_matters || narrativeTag.description}
            </p>
          </Panel>
          <Panel padding="md">
            <p className="text-sm font-semibold text-white">Evidence context</p>
            <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
              {narrativeTag.evidence_context || narrativeTag.description}
            </p>
          </Panel>
        </div>

        <Panel padding="md">
          <p className="text-sm font-semibold text-white">
            Questions to ask when reviewing this claim
          </p>
          {Array.isArray(narrativeTag.review_questions) &&
          narrativeTag.review_questions.length ? (
            <ul className="mt-3 grid gap-3 md:grid-cols-2">
              {narrativeTag.review_questions.map((question) => (
                <li
                  key={question}
                  className="rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.52)] px-4 py-3 text-sm leading-6 text-[var(--ink-soft)]"
                >
                  {question}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
              Review the linked explainers and receipts before drawing conclusions
              from one profile or one source alone.
            </p>
          )}
        </Panel>
      </section>

      <section className="space-y-4">
        <SectionIntro
          eyebrow="Pattern context"
          title="Pattern summary"
          description="Use this block to understand why the pattern matters, which explainers give the strongest background context, and how much visible public evidence is currently attached to it."
        />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.9fr)]">
          <Panel padding="md" className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-white">Why this matters</p>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                {narrativeTag.why_it_matters || narrativeTag.description}
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Related explainers</p>
              {relatedExplainers.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {relatedExplainers.map((explainer) => (
                    <Link
                      key={explainer.slug}
                      href={`/explainers/${explainer.slug}`}
                      className="inline-flex"
                    >
                      <StatusPill tone="default">{explainer.title}</StatusPill>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                  No explainers are linked to this pattern yet.
                </p>
              )}
            </div>
          </Panel>

          <Panel padding="md" className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-white">Evidence strength</p>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                Lower counts may reflect stricter sourcing requirements, not absence of the narrative.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
              <KpiCard
                label="Statements"
                value={coverage.statement_count}
                description="Visible published statements only."
                tone="accent"
              />
              <KpiCard
                label="Profiles"
                value={coverage.profile_count}
                description="Published profiles represented on this page."
                tone="accent"
              />
              <KpiCard
                label="Avg. sources"
                value={formatAverage(coverage.avg_sources_per_statement)}
                description={`Unique domains in visible support: ${coverage.source_diversity_score}.`}
                tone="accent"
              />
              <KpiCard
                label="Coverage"
                value={formatCoverageLabel(coverage.coverage_level)}
                description="Coverage reflects visible statements, profiles, and source diversity."
                tone="accent"
              />
            </div>
          </Panel>
        </div>
      </section>

      <section className="space-y-4">
        <SectionIntro
          eyebrow="Concentration"
          title="Who drives this narrative"
          description="Profiles with the highest number of visible sourced statements associated with this pattern."
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <KpiCard
            label="Total statements"
            value={statements.length}
            description="Visible published statements attached to this pattern."
            tone="accent"
          />
          <KpiCard
            label="Profiles involved"
            value={concentration.length}
            description="Published profiles contributing visible statements."
            tone="accent"
          />
          <KpiCard
            label="Top contributor"
            value={topContributor?.profile_name || "No contributors yet"}
            description={
              topContributor
                ? `${topContributor.statement_count} statements, ${formatSharePercent(
                    topContributor.share_percent
                  )} share`
                : "No published visible statements are currently attached."
            }
            tone="accent"
          />
        </div>

        {concentration.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {concentration.map((profile) => (
              <Panel
                key={`distribution-${profile.profile_slug}`}
                as="article"
                padding="md"
                className="flex h-full flex-col"
              >
                <div className="flex flex-wrap items-start gap-4">
                  <NarrativeProfilePortrait
                    portraitUrl={profile.portrait_url}
                    displayName={profile.profile_name}
                    context="card"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                      {profile.platform_or_role}
                    </p>
                    <h2 className="mt-2 text-lg font-semibold text-white">
                      {profile.profile_name}
                    </h2>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusPill tone="info">
                        {profile.statement_count} statement
                        {profile.statement_count === 1 ? "" : "s"}
                      </StatusPill>
                      <StatusPill tone="default">
                        {formatSharePercent(profile.share_percent)} share
                      </StatusPill>
                    </div>
                  </div>
                </div>
                <div className="mt-auto pt-5">
                  <Link
                    href={`/narrative-accountability/${profile.profile_slug}`}
                    className="dashboard-button-secondary"
                  >
                    View profile
                  </Link>
                </div>
              </Panel>
            ))}
          </div>
        ) : (
          <Panel padding="md">
            <p className="text-sm leading-7 text-[var(--ink-soft)]">
              No published profiles currently contribute visible statements to this pattern.
            </p>
          </Panel>
        )}
      </section>

      <section className="space-y-4">
        <SectionIntro
          eyebrow="Evidence grouped"
          title="Evidence grouped by profile"
          description="Only published profiles and visible statements appear here. Held statements and unpublished drafts stay out of the public tag page."
        />

        {profileGroups.length ? (
          <div className="space-y-4">
            {profileGroups.map((group) => (
              <Panel
                key={`evidence-${group.profile_slug}`}
                padding="md"
                className="space-y-4"
              >
                <div className="flex flex-wrap items-start gap-4">
                  <NarrativeProfilePortrait
                    portraitUrl={group.portrait_url}
                    portraitAlt={group.portrait_alt}
                    displayName={group.profile_name}
                    context="card"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                      {group.platform_or_role}
                    </p>
                    <h2 className="mt-2 text-lg font-semibold text-white">
                      {group.profile_name}
                    </h2>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusPill tone="info">
                        {group.statement_count} statement
                        {group.statement_count === 1 ? "" : "s"}
                      </StatusPill>
                      <StatusPill tone="default">
                        {group.source_count} source
                        {group.source_count === 1 ? "" : "s"}
                      </StatusPill>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {group.statements.map((item) => (
                    <Panel
                      key={`${item.profile_slug}-${item.statement_title}`}
                      as="article"
                      padding="md"
                      className="flex h-full flex-col bg-[rgba(18,31,49,0.52)]"
                    >
                      <div className="flex flex-wrap gap-2">
                        <StatusPill tone="info">
                          {item.claim_type || "Claim type pending"}
                        </StatusPill>
                        <StatusPill tone={getSeverityTone(item.severity)}>
                          Severity: {item.severity}
                        </StatusPill>
                      </div>

                      <h3 className="mt-4 text-base font-semibold text-white">
                        {item.statement_title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
                        Source label: {item.source_label || "Source label pending"}
                      </p>

                      <div className="mt-auto pt-5">
                        <Link href={item.href} className="dashboard-button-secondary">
                          View profile
                        </Link>
                      </div>
                    </Panel>
                  ))}
                </div>
              </Panel>
            ))}
          </div>
        ) : (
          <Panel padding="md">
            <p className="text-sm leading-7 text-[var(--ink-soft)]">
              No published visible statements are grouped under this pattern yet.
            </p>
          </Panel>
        )}
      </section>

      <section className="space-y-4">
        <CitationNote description="Pattern pages summarize how published statements cluster. Quote the linked profile and statement title directly if you reference a pattern externally." />
      </section>
    </main>
  );
}
