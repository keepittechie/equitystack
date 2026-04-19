import Link from "next/link";
import PresidentAvatar from "@/app/components/PresidentAvatar";
import { PromiseRelevanceBadge, PromiseStatusBadge } from "@/app/components/policy-badges";
import { fetchInternalJson } from "@/lib/api";
import { PUBLIC_REVALIDATE_SECONDS, withRevalidate } from "@/lib/cache";
import TrackedLink from "@/app/components/telemetry/TrackedLink";
import { buildPageMetadata } from "@/lib/metadata";
import { buildPromiseCardHref } from "@/lib/shareable-card-links";

export const metadata = buildPageMetadata({
  title: "All Promise Records",
  description:
    "Browse all Promise Tracker records with filters for president, status, topic, and search terms.",
  path: "/promises/all",
});

async function getPromises(searchParams) {
  const params = new URLSearchParams();

  if (searchParams.q) params.set("q", searchParams.q);
  if (searchParams.president) params.set("president", searchParams.president);
  if (searchParams.status) params.set("status", searchParams.status);
  if (searchParams.topic) params.set("topic", searchParams.topic);
  if (searchParams.page) params.set("page", searchParams.page);
  if (searchParams.sort) params.set("sort", searchParams.sort);
  if (searchParams.show_all === "0") params.set("show_all", "0");

  const query = params.toString();
  return fetchInternalJson(`/api/promises${query ? `?${query}` : ""}`, {
    ...withRevalidate(PUBLIC_REVALIDATE_SECONDS),
    errorMessage: "Failed to fetch promises",
  });
}

function FilterField({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1 text-[var(--ink-soft)]">{label}</label>
      {children}
    </div>
  );
}

function MetaPill({ children }) {
  return <span className="public-pill">{children}</span>;
}

function buildPageHref(searchParams, page) {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });

  params.set("page", String(page));
  return `/promises/all?${params.toString()}`;
}

function buildResetHref(searchParams, keyToRemove) {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (
      key !== keyToRemove &&
      key !== "page" &&
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      params.set(key, String(value));
    }
  });

  const query = params.toString();
  return query ? `/promises/all?${query}` : "/promises/all";
}

function buildShowAllHref(searchParams, showAll) {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (
      key !== "page" &&
      key !== "show_all" &&
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      params.set(key, String(value));
    }
  });

  if (!showAll) {
    params.set("show_all", "0");
  }

  const query = params.toString();
  return query ? `/promises/all?${query}` : "/promises/all";
}

function getActiveFilters(searchParams) {
  const filters = [];

  if (searchParams.q) filters.push({ key: "q", label: `Search: ${searchParams.q}` });
  if (searchParams.president) {
    filters.push({ key: "president", label: `President: ${searchParams.president}` });
  }
  if (searchParams.status) {
    filters.push({ key: "status", label: `Status: ${searchParams.status}` });
  }
  if (searchParams.topic) {
    filters.push({ key: "topic", label: `Topic: ${searchParams.topic}` });
  }
  if (searchParams.show_all === "0") {
    filters.push({ key: "show_all", label: "Showing prioritized promises" });
  }

  return filters;
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

export default async function AllPromisesPage({ searchParams }) {
  const resolvedSearchParams = (await searchParams) || {};
  const data = await getPromises(resolvedSearchParams);
  const promises = data.items || [];
  const filters = data.filters || { presidents: [], topics: [], statuses: [] };
  const pagination = data.pagination || {
    page: 1,
    total_pages: 1,
    has_prev: false,
    has_next: false,
  };
  const activeFilters = getActiveFilters(resolvedSearchParams);
  const showAll = resolvedSearchParams.show_all !== "0";

  return (
    <main className="max-w-7xl mx-auto p-6">
      <section className="hero-panel p-8 md:p-10 mb-6">
        <div className="section-intro">
          <p className="eyebrow mb-4">Promise Tracker</p>
          <h1 className="text-4xl md:text-5xl font-bold">All Promise Records</h1>
          <p className="text-base md:text-lg text-[var(--ink-soft)] mt-4 leading-8 max-w-3xl">
            Browse tracked promise records across presidents. The default public view shows the full public dataset,
            with an option to switch into the prioritized relevance subset when a tighter editorial view is useful.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <MetaPill>{data.pagination?.total || 0} tracked promises</MetaPill>
            <MetaPill>Distinct source counts across promise, action, and outcome records</MetaPill>
            <MetaPill>{showAll ? "Full public promise dataset" : "Prioritized relevance subset"}</MetaPill>
          </div>
        </div>
      </section>

      <section className="mb-6 flex flex-wrap gap-3">
        <Link
          href="/promises"
          className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-medium text-white hover:border-white/20 hover:bg-white/8"
        >
          View Presidents
        </Link>
        <Link
          href={buildShowAllHref(resolvedSearchParams, !showAll)}
          className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-medium text-white hover:border-white/20 hover:bg-white/8"
        >
          {showAll ? "Show Prioritized View" : "Show All Promises"}
        </Link>
      </section>

      <section className="card-surface p-4 mb-8">
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Search and Filter</h2>
          <p className="text-sm text-[var(--ink-soft)] mt-1">
            Filter by president, status, or topic, or search across titles, summaries, and promise text.
            Relevance reflects the degree to which a promise is tied to Black-community outcomes.
          </p>
        </div>

        <form method="GET" className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-4">
            <label className="block text-sm font-medium mb-1 text-[var(--ink-soft)]">
              Search
            </label>
            <input
              type="text"
              name="q"
              defaultValue={resolvedSearchParams.q || ""}
              className="w-full border rounded-xl px-3 py-2"
              placeholder="Search by promise title, summary, topic, or impacted group"
            />
          </div>

          <FilterField label="President">
            <select
              name="president"
              defaultValue={resolvedSearchParams.president || ""}
              className="w-full border border-white/8 rounded-xl px-3 py-2 bg-white/5 text-white"
            >
              <option value="">All</option>
              {filters.presidents.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Status">
            <select
              name="status"
              defaultValue={resolvedSearchParams.status || ""}
              className="w-full border border-white/8 rounded-xl px-3 py-2 bg-white/5 text-white"
            >
              <option value="">All</option>
              {filters.statuses.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Topic">
            <select
              name="topic"
              defaultValue={resolvedSearchParams.topic || ""}
              className="w-full border border-white/8 rounded-xl px-3 py-2 bg-white/5 text-white"
            >
              <option value="">All</option>
              {filters.topics.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Sort">
            <select
              name="sort"
              defaultValue={resolvedSearchParams.sort || "promise_date_desc"}
              className="w-full border border-white/8 rounded-xl px-3 py-2 bg-white/5 text-white"
            >
              <option value="promise_date_desc">Newest Promise Date</option>
              <option value="promise_date_asc">Oldest Promise Date</option>
              <option value="title_asc">Title A-Z</option>
              <option value="title_desc">Title Z-A</option>
              <option value="status_asc">Status</option>
            </select>
          </FilterField>

          <div className="md:col-span-4 flex flex-wrap gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-[var(--ink-soft)]">
              <input
                type="checkbox"
                name="show_all"
                value="0"
                defaultChecked={!showAll}
                className="rounded border-[rgba(120,53,15,0.24)]"
              />
              Show prioritized view
            </label>
            <button
              type="submit"
              className="rounded-full bg-[var(--accent)] text-white px-5 py-2 text-sm font-medium"
            >
              Apply Filters
            </button>
            <Link
              href="/promises/all"
              className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-medium text-[var(--ink-soft)] hover:border-white/20 hover:bg-white/8 hover:text-white"
            >
              Reset
            </Link>
          </div>
        </form>
      </section>

      {activeFilters.length > 0 && (
        <section className="mb-6 flex flex-wrap gap-2">
          {activeFilters.map((filter) => (
            <Link
              key={filter.key}
              href={buildResetHref(resolvedSearchParams, filter.key)}
              className="inline-flex items-center rounded-full border border-white/10 px-3 py-2 text-sm bg-white/5 text-[var(--ink-soft)] hover:border-white/20 hover:bg-white/8 hover:text-white"
            >
              {filter.label} ×
            </Link>
          ))}
        </section>
      )}

      <section className="mb-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold">Tracked Promises</h2>
          <p className="text-sm text-[var(--ink-soft)] mt-1">
            {data.pagination?.total || 0} Promise Tracker records
          </p>
        </div>
      </section>

      {promises.length === 0 ? (
        <section className="card-surface p-6 text-center">
          <h3 className="text-xl font-semibold">No promises matched these filters.</h3>
          <p className="text-[var(--ink-soft)] mt-3">
            Try removing a filter or broadening the search terms.
          </p>
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2">
          {promises.map((promise) => (
            <article key={promise.id} className="panel-link p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
                    {promise.president}
                  </p>
                  <TrackedLink
                    href={`/promises/${promise.slug}`}
                    eventType="detail_page_click"
                    pagePath="/promises/all"
                    routeKind="page"
                    entityType="promise"
                    entityKey={promise.slug}
                    className="text-xl font-semibold mt-2 inline-block accent-link"
                  >
                    {promise.title}
                  </TrackedLink>
                </div>
                <div className="flex flex-wrap gap-2">
                  <PresidentAvatar
                    presidentSlug={promise.president_slug}
                    presidentName={promise.president}
                    size={40}
                  />
                  <PromiseRelevanceBadge relevance={promise.relevance} />
                  <PromiseStatusBadge status={promise.status} />
                  <TrackedLink
                    href={buildPromiseCardHref(promise)}
                    eventType="share_card_click"
                    pagePath="/promises/all"
                    routeKind="page"
                    entityType="promise"
                    entityKey={promise.slug}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white hover:border-white/20 hover:bg-white/8"
                  >
                    Share Card
                  </TrackedLink>
                </div>
              </div>

              <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">
                {promise.summary || "No summary added yet."}
              </p>

              <div className="flex flex-wrap gap-2 mt-4">
                <MetaPill>{promise.topic || "No topic"}</MetaPill>
                <MetaPill>{promise.promise_type}</MetaPill>
                <MetaPill>{promise.campaign_or_official}</MetaPill>
                <MetaPill>
                  {promise.action_count} action{promise.action_count === 1 ? "" : "s"}
                </MetaPill>
                <MetaPill>
                  {promise.source_count} distinct source{promise.source_count === 1 ? "" : "s"}
                </MetaPill>
                {(promise.related_policy_count || promise.related_explainer_count) ? (
                  <MetaPill>
                    {promise.related_policy_count || 0} policy / {promise.related_explainer_count || 0} explainer links
                  </MetaPill>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-4 mt-2 text-xs text-[var(--ink-soft)]">
                {promise.promise_date ? <span>Promise date: {formatDate(promise.promise_date)}</span> : null}
                {promise.latest_action_date ? (
                  <span>Latest action: {formatDate(promise.latest_action_date)}</span>
                ) : null}
                {promise.is_demo ? <span>Demo seed data</span> : null}
                {promise.curation_priority === "merge_candidate" ? (
                  <span>Overlapping record under review</span>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      )}

      {pagination.total_pages > 1 && (
        <section className="mt-8 flex items-center justify-between gap-4">
          {pagination.has_prev ? (
            <Link
              href={buildPageHref(resolvedSearchParams, pagination.page - 1)}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-[var(--ink-soft)] hover:border-white/20 hover:bg-white/8 hover:text-white"
            >
              Previous
            </Link>
          ) : (
            <span />
          )}

          <span className="text-sm text-[var(--ink-soft)]">
            Page {pagination.page} of {pagination.total_pages}
          </span>

          {pagination.has_next ? (
            <Link
              href={buildPageHref(resolvedSearchParams, pagination.page + 1)}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-[var(--ink-soft)] hover:border-white/20 hover:bg-white/8 hover:text-white"
            >
              Next
            </Link>
          ) : (
            <span />
          )}
        </section>
      )}
    </main>
  );
}
