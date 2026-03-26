import Link from "next/link";
import { EvidenceBadge, ImpactBadge } from "@/app/components/policy-badges";
import { formatPartyLabel } from "@/app/components/policy-formatters";
import { fetchInternalJson } from "@/lib/api";
import { PUBLIC_REVALIDATE_SECONDS, withRevalidate } from "@/lib/cache";
import { buildPageMetadata } from "@/lib/metadata";

const QUICK_FILTERS = [
  {
    label: "Direct Impact",
    href: "/policies?direct_black_impact=true&sort=impact_score_desc",
  },
  {
    label: "Positive Policies",
    href: "/policies?impact_direction=Positive&sort=impact_score_desc",
  },
  {
    label: "Negative Policies",
    href: "/policies?impact_direction=Negative&sort=impact_score_desc",
  },
  {
    label: "Voting Rights",
    href: "/policies?category=Voting+Rights&sort=year_desc",
  },
  {
    label: "Highest Impact",
    href: "/policies?sort=impact_score_desc",
  },
];

export async function generateMetadata({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const q = resolvedSearchParams?.q?.trim();

  if (q) {
    return buildPageMetadata({
      title: `Policy Search: ${q}`,
      description: `Search EquityStack's policy database for "${q}" across laws, court cases, executive actions, and historical records.`,
      path: "/policies",
    });
  }

  return buildPageMetadata({
    title: "Policies",
    description:
      "Browse EquityStack's policy database by era, party, category, impact direction, evidence, and year.",
    path: "/policies",
  });
}

async function getPolicies(searchParams) {
  const params = new URLSearchParams();

  if (searchParams.q) params.set("q", searchParams.q);
  if (searchParams.party) params.set("party", searchParams.party);
  if (searchParams.era) params.set("era", searchParams.era);
  if (searchParams.category) params.set("category", searchParams.category);
  if (searchParams.direct_black_impact) {
    params.set("direct_black_impact", searchParams.direct_black_impact);
  }
  if (searchParams.bipartisan) {
    params.set("bipartisan", searchParams.bipartisan);
  }
  if (searchParams.impact_direction) {
    params.set("impact_direction", searchParams.impact_direction);
  }
  if (searchParams.sort) {
    params.set("sort", searchParams.sort);
  }
  if (searchParams.year_from) params.set("year_from", searchParams.year_from);
  if (searchParams.year_to) params.set("year_to", searchParams.year_to);
  if (searchParams.page) params.set("page", searchParams.page);
  if (searchParams.page_size) params.set("page_size", searchParams.page_size);

  const queryString = params.toString();
  const url = `/api/policies${queryString ? `?${queryString}` : ""}`;
  return fetchInternalJson(url, {
    ...withRevalidate(PUBLIC_REVALIDATE_SECONDS),
    errorMessage: "Failed to fetch policies",
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

function QuickFilterLink({ href, label }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-full border border-[rgba(120,53,15,0.12)] px-3 py-2 text-sm bg-white/75 hover:bg-white"
    >
      {label}
    </Link>
  );
}

function getResultRange(pagination, itemCount) {
  if (!pagination.total || itemCount === 0) {
    return "Showing 0 results";
  }

  const start = (pagination.page - 1) * pagination.page_size + 1;
  const end = start + itemCount - 1;
  return `Showing ${start}-${end} of ${pagination.total}`;
}

function buildPageHref(searchParams, page) {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });

  params.set("page", String(page));
  return `/policies?${params.toString()}`;
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
  return query ? `/policies?${query}` : "/policies";
}

function getActiveFilters(searchParams) {
  const filters = [];

  if (searchParams.q) filters.push({ key: "q", label: `Search: ${searchParams.q}` });
  if (searchParams.party) filters.push({ key: "party", label: `Party: ${searchParams.party}` });
  if (searchParams.era) filters.push({ key: "era", label: `Era: ${searchParams.era}` });
  if (searchParams.category) filters.push({ key: "category", label: `Category: ${searchParams.category}` });
  if (searchParams.impact_direction) {
    filters.push({
      key: "impact_direction",
      label: `Impact: ${searchParams.impact_direction}`,
    });
  }
  if (searchParams.direct_black_impact) {
    filters.push({
      key: "direct_black_impact",
      label: `Direct Black Impact: ${searchParams.direct_black_impact === "true" ? "Yes" : "No"}`,
    });
  }
  if (searchParams.bipartisan) {
    filters.push({
      key: "bipartisan",
      label: `Bipartisan: ${searchParams.bipartisan === "true" ? "Yes" : "No"}`,
    });
  }
  if (searchParams.year_from) {
    filters.push({ key: "year_from", label: `Year From: ${searchParams.year_from}` });
  }
  if (searchParams.year_to) {
    filters.push({ key: "year_to", label: `Year To: ${searchParams.year_to}` });
  }
  if (searchParams.sort && searchParams.sort !== "year_asc") {
    const sortLabels = {
      relevance: "Sort: Relevance",
      year_desc: "Sort: Newest First",
      title_asc: "Sort: Title A–Z",
      title_desc: "Sort: Title Z–A",
      impact_score_desc: "Sort: Highest Impact Score",
      impact_score_asc: "Sort: Lowest Impact Score",
    };

    filters.push({
      key: "sort",
      label: sortLabels[searchParams.sort] || `Sort: ${searchParams.sort}`,
    });
  }

  return filters;
}

export default async function PoliciesPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const data = await getPolicies(resolvedSearchParams);
  const policies = data.items || [];
  const pagination = data.pagination || {
    page: 1,
    page_size: 20,
    total: 0,
    total_pages: 1,
    has_prev: false,
    has_next: false,
  };

  const activeFilters = getActiveFilters(resolvedSearchParams);

  return (
    <main className="max-w-7xl mx-auto p-6">
      <section className="hero-panel p-8 md:p-10 mb-6">
        <div className="section-intro">
          <p className="eyebrow mb-4">Policy Database</p>
          <h1 className="text-4xl md:text-5xl font-bold">Policies</h1>
          <p className="text-base md:text-lg text-[var(--ink-soft)] mt-4 leading-8 max-w-3xl">
            Browse laws, court cases, executive actions, and major policy decisions in the dataset.
            Use search, filters, and sorting to narrow by title, topic, party, era, category,
            direct Black impact, bipartisan status, impact direction, and year range.
          </p>
        </div>
      </section>

      <div className="mb-6 hidden">
        <h1 className="text-3xl font-bold">Policies</h1>
        <p className="text-sm text-gray-600 mt-2 max-w-3xl">
          Browse laws, court cases, executive actions, and major policy decisions in the dataset.
          Use search, filters, and sorting to narrow by title, topic, party, era, category, direct Black impact, bipartisan status, impact direction, and year range.
        </p>
      </div>

      <section className="mb-6">
        <div className="card-surface rounded-[1.5rem] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-[var(--accent)] mr-1 uppercase tracking-[0.14em]">Quick Views</span>
            {QUICK_FILTERS.map((filter) => (
              <QuickFilterLink key={filter.label} href={filter.href} label={filter.label} />
            ))}
          </div>
        </div>
      </section>

      <section className="card-surface rounded-[1.6rem] p-5 mb-8">
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Search and Filter Policies</h2>
          <p className="text-sm text-[var(--ink-soft)] mt-1">
            Search by policy title or keyword, then narrow the dataset with filters and sorting.
          </p>
        </div>

        <form method="GET" className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-3">
            <label className="block text-sm font-medium mb-1 text-gray-700">
              Search
            </label>
            <input
              type="text"
              name="q"
              defaultValue={resolvedSearchParams.q || ""}
              className="w-full border rounded-xl px-3 py-2"
              placeholder="Search by title, summary, or keyword"
            />
          </div>

          <FilterField label="Party">
            <select
              name="party"
              defaultValue={resolvedSearchParams.party || ""}
              className="w-full border rounded-xl px-3 py-2 bg-white/80"
            >
              <option value="">All</option>
              <option value="Democratic Party">Democratic Party</option>
              <option value="Republican Party">Republican Party</option>
              <option value="Other">Other</option>
            </select>
          </FilterField>

          <FilterField label="Era">
            <select
              name="era"
              defaultValue={resolvedSearchParams.era || ""}
              className="w-full border rounded-xl px-3 py-2 bg-white/80"
            >
              <option value="">All</option>
              <option value="Civil War and Reconstruction">Civil War and Reconstruction</option>
              <option value="Jim Crow and Disenfranchisement">Jim Crow and Disenfranchisement</option>
              <option value="Civil Rights Era">Civil Rights Era</option>
              <option value="Post Civil Rights Era">Post Civil Rights Era</option>
              <option value="Contemporary Era">Contemporary Era</option>
            </select>
          </FilterField>

          <FilterField label="Category">
            <select
              name="category"
              defaultValue={resolvedSearchParams.category || ""}
              className="w-full border rounded-xl px-3 py-2 bg-white/80"
            >
              <option value="">All</option>
              <option value="Voting Rights">Voting Rights</option>
              <option value="Civil Rights">Civil Rights</option>
              <option value="Education">Education</option>
              <option value="Housing">Housing</option>
              <option value="Healthcare">Healthcare</option>
              <option value="Criminal Justice">Criminal Justice</option>
              <option value="Labor">Labor</option>
              <option value="Business and Economics">Business and Economics</option>
              <option value="HBCUs">HBCUs</option>
              <option value="Military and Veterans">Military and Veterans</option>
              <option value="Social Welfare">Social Welfare</option>
              <option value="Constitutional Rights">Constitutional Rights</option>
              <option value="Immigration">Immigration</option>
              <option value="Environmental Justice">Environmental Justice</option>
            </select>
          </FilterField>

          <FilterField label="Impact Direction">
            <select
              name="impact_direction"
              defaultValue={resolvedSearchParams.impact_direction || ""}
              className="w-full border rounded-xl px-3 py-2 bg-white/80"
            >
              <option value="">All</option>
              <option value="Positive">Positive</option>
              <option value="Negative">Negative</option>
              <option value="Mixed">Mixed</option>
              <option value="Blocked">Blocked</option>
            </select>
          </FilterField>

          <FilterField label="Sort">
            <select
              name="sort"
              defaultValue={resolvedSearchParams.sort || (resolvedSearchParams.q ? "relevance" : "year_asc")}
              className="w-full border rounded-xl px-3 py-2 bg-white/80"
            >
              <option value="relevance">Best Match</option>
              <option value="year_asc">Oldest First</option>
              <option value="year_desc">Newest First</option>
              <option value="title_asc">Title A–Z</option>
              <option value="title_desc">Title Z–A</option>
              <option value="impact_score_desc">Highest Impact Score</option>
              <option value="impact_score_asc">Lowest Impact Score</option>
            </select>
          </FilterField>

          <FilterField label="Results Per Page">
            <select
              name="page_size"
              defaultValue={resolvedSearchParams.page_size || "20"}
              className="w-full border rounded-xl px-3 py-2 bg-white/80"
            >
              <option value="20">20</option>
              <option value="40">40</option>
              <option value="60">60</option>
              <option value="100">100</option>
            </select>
          </FilterField>

          <FilterField label="Direct Black Impact">
            <select
              name="direct_black_impact"
              defaultValue={resolvedSearchParams.direct_black_impact || ""}
              className="w-full border rounded-xl px-3 py-2 bg-white/80"
            >
              <option value="">All</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </FilterField>

          <FilterField label="Bipartisan">
            <select
              name="bipartisan"
              defaultValue={resolvedSearchParams.bipartisan || ""}
              className="w-full border rounded-lg px-3 py-2 bg-white"
            >
              <option value="">All</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </FilterField>

          <FilterField label="Year From">
            <input
              type="number"
              name="year_from"
              defaultValue={resolvedSearchParams.year_from || ""}
              className="w-full border rounded-xl px-3 py-2"
              placeholder="1860"
            />
          </FilterField>

          <FilterField label="Year To">
            <input
              type="number"
              name="year_to"
              defaultValue={resolvedSearchParams.year_to || ""}
              className="w-full border rounded-xl px-3 py-2"
              placeholder="2026"
            />
          </FilterField>

          <input type="hidden" name="page" value="1" />

          <div className="md:col-span-3 flex gap-3 pt-2">
            <button
              type="submit"
              className="px-5 py-3 rounded-full bg-[var(--accent)] text-white font-medium shadow-[0_12px_24px_rgba(138,59,18,0.16)]"
            >
              Apply Search & Filters
            </button>

            <Link
              href="/policies"
              className="border rounded-full px-5 py-3 font-medium bg-white/80 border-[var(--line)] hover:bg-white"
            >
              Reset
            </Link>
          </div>
        </form>
      </section>

      {activeFilters.length > 0 && (
        <section className="mb-6">
          <div className="card-surface rounded-[1.5rem] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-[var(--ink-soft)] mr-1">
                Active Filters:
              </span>

              {activeFilters.map((filter) => (
                <Link
                  key={filter.key}
                  href={buildResetHref(resolvedSearchParams, filter.key)}
                  className="inline-flex items-center gap-2 border rounded-full px-3 py-1 text-sm bg-[var(--accent-soft)] hover:bg-[rgba(138,59,18,0.14)] transition"
                >
                  <span>{filter.label}</span>
                  <span className="text-gray-500">×</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="mb-6">
        <div className="card-surface rounded-[1.5rem] p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--ink-soft)]">
            <strong>{getResultRange(pagination, policies.length)}</strong> polic{pagination.total === 1 ? "y" : "ies"}
            {resolvedSearchParams.q ? (
              <> for <strong>&quot;{resolvedSearchParams.q}&quot;</strong></>
            ) : null}
          </p>

          <p className="text-sm text-[var(--ink-soft)]">
            Page <strong>{pagination.page}</strong> of <strong>{pagination.total_pages || 1}</strong>
          </p>
        </div>
      </section>

      <div className="space-y-5">
        {policies.length === 0 && (
          <div className="border rounded-2xl p-5 bg-white shadow-sm">
            <h2 className="text-lg font-semibold">No policies matched this search.</h2>
            <p className="text-sm text-[var(--ink-soft)] mt-2 max-w-2xl">
              Try widening the year range, removing one or two filters, or resetting back to the full database.
            </p>
            <div className="mt-4">
              <Link
                href="/policies"
                className="inline-flex items-center rounded-full border px-5 py-3 bg-white/80 hover:bg-white transition"
              >
                Reset all filters
              </Link>
            </div>
          </div>
        )}

        {policies.map((policy) => (
          <Link
            key={policy.id}
            href={`/policies/${policy.id}`}
            className="panel-link block rounded-[1.5rem] p-5"
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="max-w-3xl">
                <h2 className="text-xl font-semibold">{policy.title}</h2>
                <p className="text-sm text-[var(--ink-soft)] mt-1">
                  {policy.year_enacted} {" • "} {policy.policy_type} {" • "} {formatPartyLabel(policy)}
                </p>
                <p className="text-sm text-[var(--ink-soft)]">
                  {policy.era || "Unknown era"} {" • "} {policy.president || "Unknown president"}
                </p>
                {typeof policy.impact_score !== "undefined" && policy.impact_score !== null ? (
                  <p className="text-sm text-[var(--accent)] mt-2">
                    Impact Score: <strong>{policy.impact_score}</strong>
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <ImpactBadge impact={policy.impact_direction} />
                <EvidenceBadge summary={policy.evidence_summary} />
              </div>
            </div>

            <p className="mt-3 text-gray-800 leading-7">{policy.summary}</p>

            <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--ink-soft)]">
              <span className="border rounded-full px-3 py-1 bg-[rgba(255,252,247,0.8)]">
                Direct Black Impact: {policy.direct_black_impact ? "Yes" : "No"}
              </span>
              <span className="border rounded-full px-3 py-1 bg-[rgba(255,252,247,0.8)]">
                Bipartisan: {policy.bipartisan ? "Yes" : "No"}
              </span>
              <span className="border rounded-full px-3 py-1 bg-[rgba(255,252,247,0.8)]">
                Status: {policy.status}
              </span>
              {(policy.accountability_summary?.related_explainer_count || 0) > 0 ? (
                <span className="border rounded-full px-3 py-1 bg-[rgba(255,252,247,0.8)]">
                  Explainers: {policy.accountability_summary.related_explainer_count}
                </span>
              ) : null}
              {(policy.accountability_summary?.related_future_bill_count || 0) > 0 ? (
                <span className="border rounded-full px-3 py-1 bg-[rgba(255,252,247,0.8)]">
                  Future Bills: {policy.accountability_summary.related_future_bill_count}
                </span>
              ) : null}
              {(policy.accountability_summary?.linked_legislator_count || 0) > 0 ? (
                <span className="border rounded-full px-3 py-1 bg-[rgba(255,252,247,0.8)]">
                  Scorecards: {policy.accountability_summary.linked_legislator_count}
                </span>
              ) : null}
            </div>
          </Link>
        ))}
      </div>

      {pagination.total_pages > 1 && (
        <section className="mt-8">
          <div className="card-surface rounded-[1.5rem] p-4 flex items-center justify-between gap-4">
            <div>
              {pagination.has_prev ? (
                <Link
                  href={buildPageHref(resolvedSearchParams, pagination.page - 1)}
                  className="border rounded-full px-4 py-2 bg-white/80 hover:bg-white transition"
                >
                  Previous
                </Link>
              ) : (
                <span className="border rounded-full px-4 py-2 text-gray-400 bg-white/50">
                  Previous
                </span>
              )}
            </div>

            <p className="text-sm text-[var(--ink-soft)]">
              Page <strong>{pagination.page}</strong> of <strong>{pagination.total_pages}</strong>
            </p>

            <div>
              {pagination.has_next ? (
                <Link
                  href={buildPageHref(resolvedSearchParams, pagination.page + 1)}
                  className="border rounded-full px-4 py-2 bg-white/80 hover:bg-white transition"
                >
                  Next
                </Link>
              ) : (
                <span className="border rounded-full px-4 py-2 text-gray-400 bg-white/50">
                  Next
                </span>
              )}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
