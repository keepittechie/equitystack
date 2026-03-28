import Link from "next/link";
import { notFound } from "next/navigation";
import {
  PromiseImpactDirectionBadge,
  PromiseRelevanceBadge,
  PromiseStatusBadge,
} from "@/app/components/policy-badges";
import { fetchInternalJson } from "@/lib/api";
import { PUBLIC_REVALIDATE_SECONDS, withRevalidate } from "@/lib/cache";
import { buildPageMetadata } from "@/lib/metadata";
import { buildPromiseCardHref } from "@/lib/shareable-card-links";

async function getPromisePresident(slug, showAll) {
  const params = new URLSearchParams();
  if (showAll) params.set("show_all", "1");

  return fetchInternalJson(`/api/promises/presidents/${slug}${params.toString() ? `?${params.toString()}` : ""}`, {
    ...withRevalidate(PUBLIC_REVALIDATE_SECONDS),
    allow404: true,
    errorMessage: "Failed to fetch promise president",
  });
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const president = await getPromisePresident(slug, false);

  if (!president) {
    return buildPageMetadata({
      title: "President Not Found",
      description: "The requested Promise Tracker presidency record could not be found.",
      path: `/promises/president/${slug}`,
    });
  }

  return buildPageMetadata({
    title: `${president.president} Promise Tracker`,
    description: `Review Promise Tracker records for ${president.president}, grouped by status.`,
    path: `/promises/president/${slug}`,
  });
}

function MetaPill({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[rgba(120,53,15,0.12)] bg-white/80 px-3 py-1 text-xs text-[var(--ink-soft)]">
      {children}
    </span>
  );
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
  const showAll = resolvedSearchParams.show_all === "1";
  const president = await getPromisePresident(slug, showAll);

  if (!president) {
    notFound();
  }

  const visibleSourceCount =
    typeof president.visible_source_count === "number"
      ? president.visible_source_count
      : getVisiblePromiseSourceCount(president);

  return (
    <main className="max-w-7xl mx-auto p-6">
      <div className="mb-4 flex flex-wrap gap-3">
        <Link
          href="/promises"
          className="inline-flex items-center rounded-full border border-[rgba(120,53,15,0.12)] bg-white/80 px-4 py-2 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--accent)]"
        >
          Back to Presidents
        </Link>
        <Link
          href={showAll ? "/promises/all?show_all=1" : "/promises/all"}
          className="inline-flex items-center rounded-full border border-[rgba(120,53,15,0.12)] bg-white/80 px-4 py-2 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--accent)]"
        >
          Browse All Promise Records
        </Link>
        <Link
          href={showAll ? `/promises/president/${slug}` : `/promises/president/${slug}?show_all=1`}
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
        <div className="max-w-4xl">
          <p className="eyebrow mb-4">Promise Tracker</p>
          <h1 className="text-3xl md:text-4xl font-bold">{president.president}</h1>
          <p className="text-base md:text-lg text-[var(--ink-soft)] mt-4 leading-8">
            Promise Tracker groups this presidency’s records by status. The default view prioritizes
            promises with direct or meaningful downstream Black-community impact.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {president.president_party ? <MetaPill>{president.president_party}</MetaPill> : null}
            <MetaPill>{formatTermRange(president.term_start, president.term_end)}</MetaPill>
            <MetaPill>
              {showAll ? president.total_tracked_promises : president.visible_promise_count} shown
            </MetaPill>
          </div>
          <p className="text-sm text-[var(--ink-soft)] mt-4 leading-7">
            {showAll
              ? "All tracked promises for this president are visible, including secondary and deprioritized records."
              : "Low-relevance and overlapping records remain accessible through Show All."}
          </p>
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
            <h2 className="text-lg font-semibold mb-2">How this was built</h2>
            <p className="text-sm text-[var(--ink-soft)] leading-7">
              This presidency view groups curated Promise Tracker records by status. It keeps the records visible first, then points into Black Impact Score when you want a score summary built from the same public evidence base.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <MetaPill>{showAll ? president.total_tracked_promises : president.visible_promise_count} promise records</MetaPill>
            <MetaPill>{president.visible_outcome_count || 0} outcomes</MetaPill>
            <MetaPill>{visibleSourceCount} source references</MetaPill>
          </div>
        </div>
        <p className="text-sm text-[var(--ink-soft)] mt-4 leading-7">
          Records remain visible here even before they are complete enough for scoring. Open Black Impact Score when you want the summarized score view, then return to these record pages to verify the underlying actions, outcomes, and sources.
        </p>
        <div className="mt-4">
          <Link
            href="/reports/black-impact-score"
            className="rounded-full border border-[rgba(120,53,15,0.18)] bg-white/80 px-5 py-2 text-sm font-medium"
          >
            Explore Black Impact Score
          </Link>
        </div>
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
                        <Link
                          href={`/promises/${promise.slug}`}
                          className="text-xl font-semibold mt-2 inline-block accent-link"
                        >
                          {promise.title}
                        </Link>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <PromiseRelevanceBadge relevance={promise.relevance} />
                        <PromiseImpactDirectionBadge impact={promise.impact_direction_for_curation} />
                        <Link
                          href={buildPromiseCardHref(promise)}
                          className="rounded-full border border-[rgba(120,53,15,0.18)] bg-white/80 px-3 py-1 text-xs font-medium"
                        >
                          Share Card
                        </Link>
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
