import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  PromiseImpactDirectionBadge,
  PromiseRelevanceBadge,
  PromiseStatusBadge,
} from "@/app/components/policy-badges";
import { fetchInternalJson } from "@/lib/api";
import { PUBLIC_REVALIDATE_SECONDS, withRevalidate } from "@/lib/cache";
import TrackedLink from "@/app/components/telemetry/TrackedLink";
import { EXPLANATION_CONTENT } from "@/lib/content/explanations";
import { buildPageMetadata } from "@/lib/metadata";
import { buildPromiseCardHref } from "@/lib/shareable-card-links";
import PresidentAvatar from "@/app/components/PresidentAvatar";
import StructuredData from "@/app/components/public/StructuredData";
import {
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
} from "@/lib/structured-data";

async function getPromisePresident(slug, showAll) {
  const params = new URLSearchParams();
  if (!showAll) params.set("show_all", "0");

  return fetchInternalJson(`/api/promises/presidents/${slug}${params.toString() ? `?${params.toString()}` : ""}`, {
    ...withRevalidate(PUBLIC_REVALIDATE_SECONDS),
    allow404: true,
    errorMessage: "Failed to fetch promise president",
  });
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const president = await getPromisePresident(slug, true);

  if (!president) {
    return buildPageMetadata({
      title: "President Not Found",
      description: "The requested Promise Tracker presidency record could not be found.",
      path: `/promises/president/${slug}`,
    });
  }

  return buildPageMetadata({
    title: `${president.president} promise tracker`,
    description: `Review Promise Tracker records for ${president.president}, grouped by status and tied to documented actions and outcomes affecting Black Americans.`,
    path: `/promises/president/${slug}`,
    keywords: [
      president.president,
      "campaign promises to Black Americans",
      "promise tracker by president",
    ],
  });
}

function MetaPill({ children }) {
  return <span className="public-pill">{children}</span>;
}

function MiniStat({ label, value }) {
  return (
    <div className="card-muted rounded-[1.15rem] px-4 py-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">{label}</p>
      <p className="text-xl font-semibold mt-2">{value}</p>
    </div>
  );
}

function formatDate(dateString) {
  if (!dateString) return null;

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTermRange(start, end) {
  return `${formatDate(start) || "Unknown"} to ${end ? formatDate(end) : "Present"}`;
}

function formatTermBadgeLabel(start, end) {
  const startYear = start ? new Date(start).getFullYear() : null;
  const endYear = end ? new Date(end).getFullYear() : null;

  if (Number.isFinite(startYear) && Number.isFinite(endYear)) {
    return `${startYear}-${endYear} term`;
  }

  if (Number.isFinite(startYear)) {
    return `${startYear}-present term`;
  }

  return "Current term";
}

function getVisiblePromiseSourceCount(president) {
  return (president.status_sections || []).reduce(
    (count, section) =>
      count +
      (section.items || []).reduce((sectionCount, promise) => sectionCount + Number(promise.source_count || 0), 0),
    0
  );
}

function promiseCardClasses(promise) {
  if (promise.impact_direction_for_curation === "Mixed") {
    return "panel-link block rounded-[1.35rem] p-5 border-[rgba(180,83,9,0.14)] bg-[linear-gradient(180deg,rgba(255,251,235,0.86),rgba(255,255,255,0.98))]";
  }

  return "panel-link block rounded-[1.35rem] p-5";
}

export default async function PromisePresidentPage({ params, searchParams }) {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) || {};
  const showAll = resolvedSearchParams.show_all !== "0";
  const president = await getPromisePresident(slug, showAll);

  if (!president) {
    notFound();
  }

  const visibleSourceCount =
    typeof president.visible_source_count === "number"
      ? president.visible_source_count
      : getVisiblePromiseSourceCount(president);
  const explanation = EXPLANATION_CONTENT.promisePresident;

  return (
    <main className="max-w-7xl mx-auto p-6">
      <StructuredData
        data={[
          buildBreadcrumbJsonLd(
            [
              { href: "/", label: "Home" },
              { href: "/promises", label: "Promises" },
              { label: president.president },
            ],
            `/promises/president/${slug}`
          ),
          buildCollectionPageJsonLd({
            title: `${president.president} promise tracker`,
            description: `A status-based view of ${president.president}'s campaign and governing promises, linked actions, and documented outcomes affecting Black Americans.`,
            path: `/promises/president/${slug}`,
            about: [
              "campaign promises",
              president.president,
              "Black Americans",
              "promise tracking",
            ],
            keywords: [
              `${president.president} promises`,
              "campaign promises to Black Americans",
            ],
          }),
        ]}
      />
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/promises", label: "Promises" },
          { label: president.president },
        ]}
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <Link
          href="/promises"
          className="inline-flex items-center rounded-full border border-[rgba(120,53,15,0.12)] bg-white/80 px-4 py-2 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--accent)]"
        >
          Back to Presidency Terms
        </Link>
        <Link
          href={showAll ? "/promises/all" : "/promises/all?show_all=0"}
          className="inline-flex items-center rounded-full border border-[rgba(120,53,15,0.12)] bg-white/80 px-4 py-2 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--accent)]"
        >
          Browse All Promise Records
        </Link>
        <Link
          href={showAll ? `/promises/president/${slug}?show_all=0` : `/promises/president/${slug}`}
          className="inline-flex items-center rounded-full border border-[rgba(120,53,15,0.12)] bg-white/80 px-4 py-2 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--accent)]"
        >
          {showAll ? "Show Prioritized View" : "Show All Promises"}
        </Link>
        <Link
          href="/reports/black-impact-score"
          className="inline-flex items-center rounded-full border border-[rgba(120,53,15,0.12)] bg-white/80 px-4 py-2 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--accent)]"
        >
          View Black Impact Score
        </Link>
      </div>

      <section className="hero-panel p-8 md:p-10 mb-6">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="max-w-4xl">
            <p className="eyebrow mb-4">Promise Tracker</p>
            <h1 className="text-3xl md:text-4xl font-bold">{president.president}</h1>
            <p className="text-base md:text-lg text-[var(--ink-soft)] mt-4 leading-8">
              Promise Tracker groups this presidency term&apos;s records by status so users can study campaign promises, governing commitments, and linked outcomes affecting Black Americans in one place. The default public view shows the full tracked promise set for this term, while the prioritized view narrows to higher-relevance records when needed.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {president.president_party ? <MetaPill>{president.president_party}</MetaPill> : null}
              <MetaPill>{formatTermBadgeLabel(president.term_start, president.term_end)}</MetaPill>
              <MetaPill>{formatTermRange(president.term_start, president.term_end)}</MetaPill>
              <MetaPill>
                {showAll ? president.total_tracked_promises : president.visible_promise_count} shown
              </MetaPill>
            </div>
            <p className="text-sm text-[var(--ink-soft)] mt-4 leading-7">
              This page covers the <strong>{formatTermBadgeLabel(president.term_start, president.term_end)}</strong> for {president.president}.
            </p>
            <p className="text-sm text-[var(--ink-soft)] mt-4 leading-7">
              {showAll
                ? "All tracked promises for this president are visible, including secondary and deprioritized records."
                : "This prioritized view narrows the term to higher-relevance records while keeping the full set available."}
            </p>
          </div>
          <PresidentAvatar
            presidentSlug={president.slug || slug}
            presidentName={president.president}
            size={56}
          />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-5 mb-8">
        <MiniStat label="Delivered" value={showAll ? president.delivered_count : president.visible_delivered_count} />
        <MiniStat label="In Progress" value={showAll ? president.in_progress_count : president.visible_in_progress_count} />
        <MiniStat label="Partial" value={showAll ? president.partial_count : president.visible_partial_count} />
        <MiniStat label="Failed" value={showAll ? president.failed_count : president.visible_failed_count} />
        <MiniStat label="Blocked" value={showAll ? president.blocked_count : president.visible_blocked_count} />
      </section>

      <section className="card-surface rounded-[1.6rem] p-5 mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="max-w-3xl">
            <h2 className="text-lg font-semibold mb-2">Build, Interpret, Verify</h2>
            <p className="text-sm text-[var(--ink-soft)] leading-7">
              {explanation.build}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <MetaPill>{showAll ? president.total_tracked_promises : president.visible_promise_count} promise records</MetaPill>
            <MetaPill>{president.visible_outcome_count || 0} outcomes</MetaPill>
            <MetaPill>{visibleSourceCount} source references</MetaPill>
          </div>
        </div>
        <p className="text-sm text-[var(--ink-soft)] mt-4 leading-7">
          {explanation.interpret}
        </p>
        <ul className="mt-4 space-y-1 text-sm text-[var(--ink-soft)] leading-7">
          {explanation.verify.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="mt-4">
          <Link
            href="/reports/black-impact-score"
            className="rounded-full border border-[rgba(120,53,15,0.18)] bg-white/80 px-5 py-2 text-sm font-medium"
          >
            Explore Black Impact Score
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3 mb-8">
        <Link
          href={`/presidents/${slug}`}
          className="rounded-[1.4rem] border border-[rgba(120,53,15,0.12)] bg-white/80 p-5 hover:border-[rgba(120,53,15,0.22)]"
        >
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Presidential profile</p>
          <h2 className="mt-3 text-lg font-semibold">Read the full presidential record</h2>
          <p className="mt-3 text-sm text-[var(--ink-soft)] leading-7">
            Move from promise delivery into Black Impact Score context, policy drivers, and the broader historical record for this presidency.
          </p>
        </Link>
        <Link
          href={`/policies?president=${encodeURIComponent(president.president)}`}
          className="rounded-[1.4rem] border border-[rgba(120,53,15,0.12)] bg-white/80 p-5 hover:border-[rgba(120,53,15,0.22)]"
        >
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Policy context</p>
          <h2 className="mt-3 text-lg font-semibold">Browse policy records under this president</h2>
          <p className="mt-3 text-sm text-[var(--ink-soft)] leading-7">
            Use the policy explorer to see which laws, executive actions, and court decisions help explain the promise outcomes grouped below.
          </p>
        </Link>
        <Link
          href="/explainers"
          className="rounded-[1.4rem] border border-[rgba(120,53,15,0.12)] bg-white/80 p-5 hover:border-[rgba(120,53,15,0.22)]"
        >
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Historical context</p>
          <h2 className="mt-3 text-lg font-semibold">Read explainers connected to this record</h2>
          <p className="mt-3 text-sm text-[var(--ink-soft)] leading-7">
            Explain the broader legal and historical context before returning to a specific promise record or policy detail page.
          </p>
        </Link>
      </section>

      <div className="space-y-8">
        {president.status_sections?.map((section) => (
          <section key={section.status} className="card-surface rounded-[1.6rem] p-5">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
              <div>
                <h2 className="text-2xl font-semibold">{section.status}</h2>
                <p className="text-sm text-[var(--ink-soft)] mt-1">
                  {section.items.length} record{section.items.length === 1 ? "" : "s"} in this status
                </p>
              </div>
              <PromiseStatusBadge status={section.status} />
            </div>

            {section.items.length === 0 ? (
              <p className="text-[var(--ink-soft)]">No Promise Tracker records are currently grouped under this status.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {section.items.map((promise) => (
                  <article key={promise.id} className={promiseCardClasses(promise)}>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
                          {promise.topic || "No topic"}
                        </p>
                        <TrackedLink
                          href={`/promises/${promise.slug}`}
                          eventType="detail_page_click"
                          pagePath={`/promises/president/${slug}`}
                          routeKind="page"
                          entityType="promise"
                          entityKey={promise.slug}
                          className="text-xl font-semibold mt-2 inline-block accent-link"
                        >
                          {promise.title}
                        </TrackedLink>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <PromiseRelevanceBadge relevance={promise.relevance} />
                        <PromiseImpactDirectionBadge impact={promise.impact_direction_for_curation} />
                        <TrackedLink
                          href={buildPromiseCardHref(promise)}
                          eventType="share_card_click"
                          pagePath={`/promises/president/${slug}`}
                          routeKind="page"
                          entityType="promise"
                          entityKey={promise.slug}
                          className="rounded-full border border-[rgba(120,53,15,0.18)] bg-white/80 px-3 py-1 text-xs font-medium"
                        >
                          Share Card
                        </TrackedLink>
                      </div>
                    </div>

                    <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">
                      {promise.summary || "No summary added yet."}
                    </p>

                    <div className="flex flex-wrap gap-2 mt-4">
                      <MetaPill>
                        {promise.action_count} action{promise.action_count === 1 ? "" : "s"}
                      </MetaPill>
                      <MetaPill>
                        {promise.outcome_count || 0} outcome{promise.outcome_count === 1 ? "" : "s"}
                      </MetaPill>
                      <MetaPill>
                        {promise.source_count} distinct source{promise.source_count === 1 ? "" : "s"}
                      </MetaPill>
                      {promise.related_policy_count ? (
                        <MetaPill>
                          {promise.related_policy_count} related polic{promise.related_policy_count === 1 ? "y" : "ies"}
                        </MetaPill>
                      ) : null}
                      {promise.related_explainer_count ? (
                        <MetaPill>
                          {promise.related_explainer_count} related explainer{promise.related_explainer_count === 1 ? "" : "s"}
                        </MetaPill>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-4 mt-3 text-xs text-[var(--ink-soft)]">
                      {promise.promise_date ? <span>Promise date: {formatDate(promise.promise_date)}</span> : null}
                      {promise.latest_action_date ? (
                        <span>Latest action: {formatDate(promise.latest_action_date)}</span>
                      ) : (
                        <span>No action date recorded</span>
                      )}
                      {promise.curation_priority === "merge_candidate" ? (
                        <span>Overlapping record under editorial review</span>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
