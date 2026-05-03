import Link from "next/link";
import { notFound } from "next/navigation";
import { buildPageMetadata } from "@/lib/metadata";
import {
  getNarrativePublicClaimCaution,
  getPublishedRelatedProfiles,
  getPublishedNarrativeProfileBySlug,
  getPublishedNarrativeProfileSlugs,
} from "@/lib/narrative-accountability/data";
import { fetchExplainerDetailData } from "@/lib/public-site-data";
import StructuredData from "@/app/components/public/StructuredData";
import { Breadcrumbs } from "@/app/components/public/chrome";
import NarrativeProfilePortrait from "@/app/components/public/NarrativeProfilePortrait";
import {
  CitationNote,
  MethodologyCallout,
  SectionIntro,
} from "@/app/components/public/core";
import {
  Panel,
  SectionHeader,
  StatusPill,
} from "@/app/components/dashboard/primitives";
import {
  buildBreadcrumbJsonLd,
  buildProfilePageJsonLd,
} from "@/lib/structured-data";

export const dynamic = "force-dynamic";

function getVisibleStatements(statements) {
  return (Array.isArray(statements) ? statements : []).filter(
    (statement) =>
      String(statement?.statement_visibility || "").trim().toLowerCase() !==
      "editorial_hold"
  );
}

function getStatementSources(statement) {
  if (Array.isArray(statement?.statement_sources) && statement.statement_sources.length) {
    return statement.statement_sources.filter(Boolean);
  }

  const fallbackSource = {
    label: statement?.source_label,
    url: statement?.quote_source_url,
    date: statement?.date_made,
  };

  return fallbackSource.label || fallbackSource.url || fallbackSource.date
    ? [fallbackSource]
    : [];
}

function formatDate(value) {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return text;
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getSeverityTone(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "high") return "danger";
  if (normalized === "medium") return "warning";
  return "info";
}

function getVerificationTone(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized.includes("review")) return "warning";
  if (normalized.includes("verified")) return "verified";
  return "default";
}

function getSourceQualityTone(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "primary") return "verified";
  if (
    normalized === "court record" ||
    normalized === "government data" ||
    normalized === "government report"
  ) {
    return "info";
  }
  if (
    normalized === "academic" ||
    normalized === "research analysis" ||
    normalized === "investigative reporting"
  ) {
    return "default";
  }
  return "warning";
}

export function generateStaticParams() {
  return getPublishedNarrativeProfileSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const profile = getPublishedNarrativeProfileBySlug(slug);

  if (!profile) {
    return buildPageMetadata({
      title: "Narrative Accountability Profile Not Found | EquityStack",
      description:
        "The requested Narrative Accountability profile could not be found.",
      path: `/narrative-accountability/${slug}`,
    });
  }

  return buildPageMetadata({
    title: `${profile.display_name} | Narrative Accountability | EquityStack`,
    description:
      profile.short_summary ||
      "Narrative Accountability profile with quoted statements, rebuttals, and receipts.",
    path: `/narrative-accountability/${profile.slug}`,
  });
}

export default async function NarrativeAccountabilityDetailPage({ params }) {
  const { slug } = await params;
  const profile = getPublishedNarrativeProfileBySlug(slug);

  if (!profile) {
    notFound();
  }

  const categories = Array.isArray(profile.claim_categories)
    ? profile.claim_categories.filter(Boolean)
    : [];
  const visibleStatements = getVisibleStatements(profile.statements);
  const relatedProfiles = getPublishedRelatedProfiles(profile);
  const cautionNote = getNarrativePublicClaimCaution(profile);
  const relatedExplainers = (
    await Promise.all(
      (Array.isArray(profile.related_explainers) ? profile.related_explainers : []).map(
        async (item) => {
          const explainerSlug = String(item?.slug || "").trim();
          if (!explainerSlug) {
            return null;
          }

          const explainer = await fetchExplainerDetailData(explainerSlug).catch(() => null);
          if (!explainer?.slug) {
            return null;
          }

          return {
            slug: explainer.slug,
            title: item?.title || explainer.title,
            relationship: item?.relationship || null,
          };
        }
      )
    )
  ).filter(Boolean);

  return (
    <main className="space-y-4">
      <StructuredData
        data={[
          buildBreadcrumbJsonLd(
            [
              { href: "/", label: "Home" },
              { href: "/narrative-accountability", label: "Narrative Accountability" },
              { label: profile.display_name },
            ],
            `/narrative-accountability/${profile.slug}`
          ),
          buildProfilePageJsonLd({
            title: profile.display_name,
            description: profile.short_summary,
            path: `/narrative-accountability/${profile.slug}`,
          }),
        ]}
      />
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/narrative-accountability", label: "Narrative Accountability" },
          { label: profile.display_name },
        ]}
      />

      <Panel prominence="primary" className="overflow-hidden">
        <SectionHeader
          as="h1"
          eyebrow="Narrative accountability profile"
          title={profile.display_name}
          description={profile.short_summary}
          action={
            <Link
              href="/narrative-accountability"
              className="dashboard-button-secondary"
            >
              All profiles
            </Link>
          }
        />
        <div className="space-y-4 p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start">
            <div className="space-y-3">
              <NarrativeProfilePortrait
                portraitUrl={profile.portrait_url}
                portraitAlt={profile.portrait_alt}
                displayName={profile.display_name}
                context="hero"
              />
              {profile.portrait_source_label ? (
                <p className="text-xs leading-6 text-[var(--ink-muted)]">
                  Official portrait source:{" "}
                  {profile.portrait_source_url ? (
                    <Link
                      href={profile.portrait_source_url}
                      className="underline-offset-4 hover:text-white hover:underline"
                    >
                      {profile.portrait_source_label}
                    </Link>
                  ) : (
                    profile.portrait_source_label
                  )}
                </p>
              ) : null}
            </div>
            <div className="min-w-0 flex-1 space-y-4">
              <div className="flex flex-wrap gap-2">
                <StatusPill tone="info">{profile.platform_or_role}</StatusPill>
                <StatusPill tone="default">
                  {profile.statement_count} statement{profile.statement_count === 1 ? "" : "s"}
                </StatusPill>
                {formatDate(profile.last_reviewed_at) ? (
                  <StatusPill tone="default">
                    Reviewed {formatDate(profile.last_reviewed_at)}
                  </StatusPill>
                ) : null}
                {categories.map((category) => (
                  <StatusPill key={category} tone="default">
                    {category}
                  </StatusPill>
                ))}
              </div>
              <Panel padding="md" className="bg-[rgba(18,31,49,0.52)]">
                <p className="text-sm leading-7 text-[var(--ink-soft)]">
                  {cautionNote}
                </p>
              </Panel>
            </div>
          </div>
        </div>
      </Panel>

      <section className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.9fr)]">
          <Panel padding="md">
            <SectionIntro
              eyebrow="Narrative pattern"
              title="Narrative Pattern"
              description={profile.narrative_pattern_summary}
            />
          </Panel>
          <Panel padding="md" className="space-y-3">
            <SectionHeader
              eyebrow="Review state"
              title="Review notes"
              description="This section records the current editorial state, review date, and any remaining sourcing limits."
            />
            <div className="flex flex-wrap gap-2">
              <StatusPill tone="warning">
                Last reviewed {formatDate(profile.last_reviewed_at) || "Pending"}
              </StatusPill>
            </div>
            {profile.review_notes ? (
              <p className="text-sm leading-7 text-[var(--ink-soft)]">
                {profile.review_notes}
              </p>
            ) : (
              <p className="text-sm leading-7 text-[var(--ink-soft)]">
                No review notes are attached yet.
              </p>
            )}
          </Panel>
        </div>
      </section>

      {profile.publicly_reported_ethics_concerns ? (
        <section className="space-y-4">
          <Panel padding="md" className="space-y-4">
            <SectionHeader
              eyebrow="Ethics context"
              title="Publicly Reported Ethics Concerns"
              description="This section summarizes published reporting and oversight materials. It does not make legal conclusions or speculate about private intent."
            />
            <p className="text-sm leading-7 text-[var(--ink-soft)]">
              {profile.publicly_reported_ethics_concerns.summary}
            </p>
            {profile.publicly_reported_ethics_concerns.items?.length ? (
              <div className="grid gap-3">
                {profile.publicly_reported_ethics_concerns.items.map((item, index) => (
                  <Panel
                    key={`${profile.slug}-ethics-${index}`}
                    padding="md"
                    className="space-y-4 bg-[rgba(18,31,49,0.52)]"
                  >
                    {typeof item !== "string" && item.title ? (
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                    ) : null}
                    <p className="text-sm leading-7 text-[var(--ink-soft)]">
                      {typeof item === "string" ? item : item.summary}
                    </p>
                    {Array.isArray(item?.receipts) && item.receipts.length ? (
                      <div className="grid gap-3">
                        {item.receipts.map((receipt, receiptIndex) => (
                          <Panel
                            key={`${profile.slug}-ethics-${index}-receipt-${receiptIndex}`}
                            as="a"
                            href={receipt.url}
                            target="_blank"
                            rel="noreferrer"
                            padding="md"
                            interactive
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusPill tone="default">
                                {receipt.publisher_or_source}
                              </StatusPill>
                              <StatusPill
                                tone={getSourceQualityTone(receipt.source_quality)}
                              >
                                {receipt.source_quality || "Source quality pending"}
                              </StatusPill>
                            </div>
                            <h3 className="mt-3 text-base font-medium text-white">
                              {receipt.title}
                            </h3>
                            {receipt.note ? (
                              <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
                                {receipt.note}
                              </p>
                            ) : null}
                          </Panel>
                        ))}
                      </div>
                    ) : null}
                  </Panel>
                ))}
              </div>
            ) : null}
          </Panel>
        </section>
      ) : null}

      <section className="space-y-4">
        <SectionIntro
          eyebrow="Documented statements"
          title="Documented Statements"
          description="Each statement preserves the quote, the claim being made, the evaluation path, and the receipts that support the rebuttal."
        />

        <div className="space-y-4">
          {visibleStatements.map((statement, index) => (
            <Panel
              key={`${statement.statement_title}-${index}`}
              padding="md"
              className="space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="max-w-3xl">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                    Statement {index + 1}
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-white">
                    {statement.statement_title}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusPill tone="info">
                    {statement.claim_type || "Claim type pending"}
                  </StatusPill>
                  <StatusPill tone={getSeverityTone(statement.severity)}>
                    Severity: {statement.severity}
                  </StatusPill>
                  <StatusPill tone={getVerificationTone(statement.verification_status)}>
                    {statement.verification_status}
                  </StatusPill>
                </div>
              </div>

              <Panel padding="md" className="bg-[rgba(18,31,49,0.52)]">
                <p className="text-sm font-semibold text-white">
                  Claim summary / quoted material
                </p>
                <blockquote className="mt-3 border-l border-[var(--line-strong)] pl-4 text-sm leading-7 text-[var(--ink-soft)]">
                  &quot;{statement.exact_quote}&quot;
                </blockquote>
                {getStatementSources(statement).length ? (
                  <div className="mt-4 grid gap-3">
                    {getStatementSources(statement).map((source, sourceIndex) => (
                      <Panel
                        key={`${statement.statement_title}-source-${sourceIndex}`}
                        padding="md"
                        className="bg-[rgba(8,16,27,0.55)]"
                      >
                        <div className="flex flex-wrap gap-2">
                          {source.label || source.publisher_or_source ? (
                            <StatusPill tone="info">
                              {source.label || source.publisher_or_source}
                            </StatusPill>
                          ) : null}
                          {formatDate(source.date) ? (
                            <StatusPill tone="default">{formatDate(source.date)}</StatusPill>
                          ) : null}
                          {source.source_quality ? (
                            <StatusPill tone={getSourceQualityTone(source.source_quality)}>
                              {source.source_quality}
                            </StatusPill>
                          ) : null}
                        </div>
                        {source.title ? (
                          <h3 className="mt-3 text-base font-medium text-white">
                            {source.title}
                          </h3>
                        ) : null}
                        {source.note ? (
                          <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
                            {source.note}
                          </p>
                        ) : null}
                        {source.url ? (
                          <Link
                            href={source.url}
                            className="mt-3 inline-flex text-sm font-semibold text-[var(--ink-soft)] underline-offset-4 hover:text-white hover:underline"
                          >
                            Open source
                          </Link>
                        ) : null}
                      </Panel>
                    ))}
                  </div>
                ) : null}
              </Panel>

              <div className="grid gap-4 md:grid-cols-2">
                <Panel padding="md" className="bg-[rgba(18,31,49,0.52)]">
                  <p className="text-sm font-semibold text-white">Context</p>
                  <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                    {statement.context_summary}
                  </p>
                </Panel>
                <Panel padding="md" className="bg-[rgba(18,31,49,0.52)]">
                  <p className="text-sm font-semibold text-white">Claim being made</p>
                  <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                    {statement.claim_being_made}
                  </p>
                </Panel>
              </div>

              <Panel padding="md" className="space-y-4">
                <SectionHeader
                  eyebrow="Evaluation"
                  title="Evaluation"
                  description="This section explains why a claim is contested, what reporting or source material raises concern, and where the public record pushes back."
                />
                <div className="grid gap-4">
                  <Panel padding="md" className="bg-[rgba(18,31,49,0.52)]">
                    <p className="text-sm font-semibold text-white">
                      {statement.why_it_is_wrong_label ||
                        "Why this claim is contested or raises concern"}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                      {statement.why_it_is_wrong}
                    </p>
                  </Panel>
                  <Panel padding="md" className="bg-[rgba(18,31,49,0.52)]">
                    <p className="text-sm font-semibold text-white">Historical rebuttal</p>
                    <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                      {statement.historical_rebuttal}
                    </p>
                  </Panel>
                  <Panel padding="md" className="bg-[rgba(18,31,49,0.52)]">
                    <p className="text-sm font-semibold text-white">Data rebuttal</p>
                    <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                      {statement.data_rebuttal}
                    </p>
                  </Panel>
                </div>
              </Panel>

              <Panel padding="md" className="space-y-4">
                <SectionHeader
                  eyebrow="Receipts"
                  title="Receipts"
                  description="Every statement should point readers to the sources that support the rebuttal."
                />
                {statement.receipts?.length ? (
                  <div className="grid gap-3">
                    {statement.receipts.map((receipt, receiptIndex) => (
                      <Panel
                        key={`${receipt.title}-${receiptIndex}`}
                        as="a"
                        href={receipt.url}
                        target="_blank"
                        rel="noreferrer"
                        padding="md"
                        interactive
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusPill tone="default">
                            {receipt.publisher_or_source}
                          </StatusPill>
                          <StatusPill tone={getSourceQualityTone(receipt.source_quality)}>
                            {receipt.source_quality || "Source quality pending"}
                          </StatusPill>
                        </div>
                        <h3 className="mt-3 text-base font-medium text-white">
                          {receipt.title}
                        </h3>
                        {receipt.note ? (
                          <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
                            {receipt.note}
                          </p>
                        ) : null}
                      </Panel>
                    ))}
                  </div>
                ) : (
                  <Panel padding="md" className="bg-[rgba(18,31,49,0.52)]">
                    <p className="text-sm leading-7 text-[var(--ink-soft)]">
                      No receipts are attached to this statement yet.
                    </p>
                  </Panel>
                )}
              </Panel>

              <Panel padding="md" className="space-y-3">
                <SectionHeader
                  eyebrow="Impact"
                  title="Impact"
                  description="Narrative Accountability keeps a separate harm note so the page explains why the claim matters in public life."
                />
                <div className="flex flex-wrap gap-2">
                  <StatusPill tone={getSeverityTone(statement.severity)}>
                    Severity: {statement.severity}
                  </StatusPill>
                </div>
                <p className="text-sm leading-7 text-[var(--ink-soft)]">
                  {statement.harm_summary}
                </p>
              </Panel>
            </Panel>
          ))}
        </div>
      </section>

      {relatedProfiles.length ? (
        <section className="space-y-4">
          <SectionIntro
            eyebrow="Related profiles"
            title="Related accountability profiles"
            description="Other published profiles connected by institution, claim pattern, or accountability issue."
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {relatedProfiles.map((item) => (
              <Panel
                key={item.slug}
                as="article"
                padding="md"
                className="flex h-full flex-col"
              >
                <div className="flex flex-wrap items-start gap-4">
                  <NarrativeProfilePortrait
                    portraitUrl={item.portrait_url}
                    portraitAlt={item.portrait_alt}
                    displayName={item.display_name}
                    context="card"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                      {item.platform_or_role}
                    </p>
                    <h2 className="mt-2 text-lg font-semibold text-white">
                      {item.display_name}
                    </h2>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusPill tone="info">
                        {item.statement_count} statement{item.statement_count === 1 ? "" : "s"}
                      </StatusPill>
                    </div>
                  </div>
                </div>
                {item.relationship ? (
                  <p className="mt-4 text-sm leading-6 text-[var(--ink-soft)]">
                    {item.relationship}
                  </p>
                ) : null}
                <div className="mt-auto pt-5">
                  <Link
                    href={`/narrative-accountability/${item.slug}`}
                    className="dashboard-button-secondary"
                  >
                    View profile
                  </Link>
                </div>
              </Panel>
            ))}
          </div>
        </section>
      ) : null}

      {relatedExplainers.length ? (
        <section className="space-y-4">
          <SectionIntro
            eyebrow="Related explainers"
            title="Related explainers"
            description="Background explainers that help evaluate the claims, systems, and historical context connected to this profile."
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {relatedExplainers.map((item) => (
              <Panel
                key={item.slug}
                as="article"
                padding="md"
                className="flex h-full flex-col"
              >
                <StatusPill tone="default">Explainer</StatusPill>
                <h2 className="mt-3 text-lg font-semibold text-white">
                  {item.title}
                </h2>
                {item.relationship ? (
                  <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">
                    {item.relationship}
                  </p>
                ) : null}
                <div className="mt-auto pt-5">
                  <Link
                    href={`/explainers/${item.slug}`}
                    className="dashboard-button-secondary"
                  >
                    Read explainer
                  </Link>
                </div>
              </Panel>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <MethodologyCallout
          title="How to read this page"
          description="Narrative Accountability pages identify a public claim, preserve quoted material or a sourced paraphrase, show the rebuttal path, and keep the receipts close to the evaluation. Real profiles should stay unpublished until sourcing and review are complete."
          href="/methodology"
          linkLabel="Read methodology"
        />
        <CitationNote description="If you cite a profile externally, quote the exact statement, the EquityStack page URL, and the linked receipts. This section is designed to evaluate public claims against evidence, not to speculate about intent." />
      </section>
    </main>
  );
}
