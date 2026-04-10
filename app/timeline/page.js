import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import { fetchTimelineData } from "@/lib/public-site-data";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  DashboardFilterBar,
  ImpactOverviewCards,
  MethodologyCallout,
  SectionIntro,
} from "@/app/components/public/core";
import { TimelineEventCard } from "@/app/components/public/entities";

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "Timeline",
  description:
    "Browse EquityStack as a chronological public timeline across policies, promises, and historical context.",
  path: "/timeline",
});

export default async function TimelinePage({ searchParams }) {
  const resolvedSearchParams = (await searchParams) || {};
  const data = await fetchTimelineData(resolvedSearchParams);
  const items = data.items || [];
  const policyCount = items.filter((item) => item.kind === "Policy").length;
  const promiseCount = items.filter((item) => item.kind === "Promise").length;
  const firstYear = items.length ? items[items.length - 1]?.year : null;
  const lastYear = items.length ? items[0]?.year : null;

  return (
    <main className="space-y-10">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Timeline" }]} />

      <section className="hero-panel p-8 md:p-10 xl:p-14">
        <SectionIntro
          as="h1"
          eyebrow="Timeline"
          title="See the record in chronological order."
          description="The timeline is a discovery layer for users who want sequence before synthesis. It mixes policies and promises in one public chronology so changes, reversals, and continuity become easier to follow."
          actions={
            <>
              <Link href="/reports/civil-rights-timeline" className="public-button-primary">
                Open civil-rights timeline
              </Link>
              <Link href="/dashboard" className="public-button-secondary">
                Open dashboard
              </Link>
            </>
          }
        />
      </section>

      <DashboardFilterBar helpText="Use the timeline as a discovery and context surface. Filter by record type or visible direction/status when you want a narrower historical slice.">
        <form action="/timeline" method="GET" className="flex flex-1 flex-wrap items-end gap-4">
          <label className="grid gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Search
            </span>
            <input
              type="search"
              name="q"
              defaultValue={resolvedSearchParams.q || ""}
              placeholder="Topic, title, or president"
              className="rounded-xl border border-white/8 bg-white/5 px-3 py-2.5 text-sm text-white"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Record type
            </span>
            <select
              name="type"
              defaultValue={resolvedSearchParams.type || ""}
              className="rounded-xl border border-white/8 bg-white/5 px-3 py-2.5 text-sm text-white"
            >
              <option value="">All types</option>
              {(data.filterOptions?.types || []).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Direction / status
            </span>
            <select
              name="direction"
              defaultValue={resolvedSearchParams.direction || ""}
              className="rounded-xl border border-white/8 bg-white/5 px-3 py-2.5 text-sm text-white"
            >
              <option value="">All directions / statuses</option>
              {(data.filterOptions?.directions || []).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="public-button-secondary">
            Apply filters
          </button>
        </form>
      </DashboardFilterBar>

      <ImpactOverviewCards
        items={[
          {
            label: "Timeline events",
            value: items.length,
            description: "Records visible in the current chronological view.",
            tone: "accent",
          },
          {
            label: "Policies",
            value: policyCount,
            description: "Policy records currently visible in this timeline slice.",
          },
          {
            label: "Promises",
            value: promiseCount,
            description: "Promise records currently visible in this timeline slice.",
          },
          {
            label: "Date span",
            value:
              firstYear && lastYear ? `${firstYear}-${lastYear}` : lastYear || "—",
            description: "Approximate chronological span of the visible results.",
          },
        ]}
      />

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5">
          <SectionIntro
            eyebrow="Chronology"
            title="Browse the public record"
            description="Each card links into a fuller policy or promise page. The goal is to help users move from sequence into detail without losing context."
          />
          {items.length ? (
            <div className="grid gap-4">
              {items.map((item) => (
                <TimelineEventCard
                  key={item.id}
                  title={item.title}
                  summary={item.summary}
                  year={item.year}
                  href={item.href}
                  badges={item.badges}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[1.6rem] border border-dashed border-white/12 bg-white/4 p-6 text-sm leading-7 text-[var(--ink-soft)]">
              No timeline records matched the current filters.
            </div>
          )}
        </div>
        <div className="space-y-5">
          <MethodologyCallout description="Timeline order helps users understand sequence, but chronology alone does not explain impact. Open the linked detail pages for evidence, scoring context, and methodology." />
          <div className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
            <h2 className="text-lg font-semibold text-white">How to read the timeline</h2>
            <div className="mt-4 grid gap-3 text-sm leading-7 text-[var(--ink-soft)]">
              <div className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
                Use it to identify when major shifts happened.
              </div>
              <div className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
                Open policy cards when you need the evidence and impact explanation.
              </div>
              <div className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
                Open promise cards when you need the original commitment and status logic.
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
