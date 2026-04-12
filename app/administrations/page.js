import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import { fetchAdministrationsOverviewData } from "@/lib/public-site-data";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  DashboardFilterBar,
  ImpactOverviewCards,
  MethodologyCallout,
  SectionIntro,
} from "@/app/components/public/core";

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "Administrations",
  description:
    "Browse administration-level records, summary metrics, and linked policy activity.",
  path: "/administrations",
});

function formatScore(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : "—";
}

export default async function AdministrationsPage({ searchParams }) {
  const resolvedSearchParams = (await searchParams) || {};
  const administrations = await fetchAdministrationsOverviewData(resolvedSearchParams);

  return (
    <main className="space-y-10">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Administrations" }]} />

      <section className="hero-panel p-8 md:p-10 xl:p-14">
        <SectionIntro
          as="h1"
          eyebrow="Administration index"
          title="Browse presidencies as governing administrations."
          description="Administration pages summarize promise throughput, outcome counts, impact direction, and recent governing activity so users can compare presidential terms as operating administrations, not just score rows."
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[1.5rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
          <h2 className="text-lg font-semibold text-white">What this section covers</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            This index groups public records by administration so users can study governing activity, promise status, and visible policy movement across terms.
          </p>
        </div>
        <div className="rounded-[1.5rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
          <h2 className="text-lg font-semibold text-white">Best next step</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            Open an administration profile when you want the promise feed and recent activity, then move into the president profile for Black Impact Score interpretation.
          </p>
        </div>
      </section>

      <DashboardFilterBar helpText="Browse administrations as public entities with both governing throughput and presidential score context.">
        <form action="/administrations" method="GET" className="flex flex-1 flex-wrap items-end gap-4">
          <label className="grid gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">Search</span>
            <input
              type="search"
              name="q"
              defaultValue={resolvedSearchParams.q || ""}
              placeholder="Administration or president"
              className="rounded-xl border border-white/8 bg-white/5 px-3 py-2.5 text-sm text-white"
            />
          </label>
          <button type="submit" className="public-button-secondary">
            Apply filters
          </button>
        </form>
      </DashboardFilterBar>

      <ImpactOverviewCards
        items={[
          {
            label: "Administrations shown",
            value: administrations.length,
            description: "Browsable administration entities currently visible.",
            tone: "accent",
          },
          {
            label: "Tracked promises",
            value: administrations.reduce((total, item) => total + Number(item.total_tracked_promises || 0), 0),
            description: "Promise records attached to the visible administrations.",
          },
          {
            label: "Delivered promises",
            value: administrations.reduce((total, item) => total + Number(item.delivered_count || 0), 0),
            description: "Promises currently marked delivered in the visible administration set.",
          },
          {
            label: "Average direct score",
            value: administrations.length
              ? formatScore(
                  administrations.reduce((total, item) => total + Number(item.direct_normalized_score || 0), 0) /
                    administrations.length
                )
              : "—",
            description: "Mean direct score across the currently visible administrations.",
          },
        ]}
      />

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {administrations.length ? (
          administrations.map((item) => (
            <Link key={item.slug} href={`/administrations/${item.slug}`} className="panel-link rounded-[1.7rem] p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                {item.president_party || "Administration"} • {item.termLabel}
              </p>
              <h2 className="mt-4 text-2xl font-semibold text-white">{item.administration_name}</h2>
              <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">
                {item.total_tracked_promises} tracked promises, {item.delivered_count} delivered, {item.in_progress_count} in progress, {item.blocked_count} blocked.
              </p>
              <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">
                Direct score {formatScore(item.direct_normalized_score)} • {item.outcome_count || 0} scored outcomes • {item.score_confidence || "Unknown"} confidence
              </p>
            </Link>
          ))
        ) : (
          <div className="rounded-[1.6rem] border border-dashed border-white/12 bg-white/4 p-6 text-sm leading-7 text-[var(--ink-soft)]">
            No administrations matched the current search.
          </div>
        )}
      </section>

      <MethodologyCallout description="Administration pages are browse-first summaries. Use the linked president profile when you want the fuller Black Impact Score interpretation, broader historical context, and policy drivers." />
    </main>
  );
}
