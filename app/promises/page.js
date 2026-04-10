import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import { fetchPromiseIndexData } from "@/lib/public-site-data";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  DashboardFilterBar,
  ImpactOverviewCards,
  MethodologyCallout,
  PageContextBlock,
  SectionIntro,
} from "@/app/components/public/core";
import {
  PromiseResultsTable,
  RecentPolicyChangesTable,
} from "@/app/components/public/entities";
import PromiseStatusLegend from "@/app/components/public/PromiseStatusLegend";
import PromiseSystemExplanation from "@/app/components/public/PromiseSystemExplanation";

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "Promises",
  description:
    "Track public promises, current status, rationale, linked actions, and outcomes affecting Black Americans.",
  path: "/promises",
});

function countStatuses(items = []) {
  return items.reduce((totals, item) => {
    totals[item.status] = (totals[item.status] || 0) + 1;
    return totals;
  }, {});
}

export default async function PromisesPage({ searchParams }) {
  const resolvedSearchParams = (await searchParams) || {};
  const data = await fetchPromiseIndexData(resolvedSearchParams);
  const statusCounts = data.statusCounts || countStatuses(data.items || []);

  return (
    <main className="space-y-10">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Promises" }]} />

      <section className="hero-panel p-8 md:p-10 xl:p-14">
        <SectionIntro
          eyebrow="Promise tracker"
          title="Follow statements, status changes, and linked outcomes in one place."
          description="Promise pages separate political intent from the documented outcomes that followed. That lets users move from stated commitment into evidence-backed delivery, partial progress, failure, or blockage."
          actions={
            <>
              <Link href="/dashboard" className="public-button-primary">
                Open dashboard
              </Link>
              <Link href="/methodology" className="public-button-secondary">
                How promise grading works
              </Link>
            </>
          }
        />
      </section>

      <PageContextBlock
        description="This page tracks public promises, their current status, and the documented actions or outcomes used to justify that status."
        detail="Promise status is not the same as Impact Score. Open a promise record when you want to see the statement, rationale, evidence, and linked policy history together."
      />

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <PromiseSystemExplanation />
        <PromiseStatusLegend />
      </section>

      <DashboardFilterBar helpText="Promise status remains separate from the Black Impact Score. Use filters to narrow by president, topic, or status before opening a record.">
        <form action="/promises" method="GET" className="flex flex-1 flex-wrap items-end gap-4">
          <label className="grid gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">Search</span>
            <input
              type="search"
              name="q"
              defaultValue={resolvedSearchParams.q || ""}
              placeholder="Promise title or keyword"
              className="rounded-xl border border-white/8 bg-white/5 px-3 py-2.5 text-sm text-white"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">Status</span>
            <select name="status" defaultValue={resolvedSearchParams.status || ""} className="rounded-xl border border-white/8 bg-white/5 px-3 py-2.5 text-sm text-white">
              <option value="">All statuses</option>
              {(data.filters?.statuses || []).map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">President</span>
            <select name="president" defaultValue={resolvedSearchParams.president || ""} className="rounded-xl border border-white/8 bg-white/5 px-3 py-2.5 text-sm text-white">
              <option value="">All presidents</option>
              {(data.filters?.presidents || []).map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">Topic</span>
            <select name="topic" defaultValue={resolvedSearchParams.topic || ""} className="rounded-xl border border-white/8 bg-white/5 px-3 py-2.5 text-sm text-white">
              <option value="">All topics</option>
              {(data.filters?.topics || []).map((item) => (
                <option key={item} value={item}>{item}</option>
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
            label: "Promises shown",
            value: data.pagination?.total || data.items?.length || 0,
            description: "The public tracker remains queryable by president, topic, and current status.",
            tone: "accent",
          },
          {
            label: "Completed",
            value: statusCounts.Delivered || 0,
            description: "Promises with implemented policy action in the filtered result set.",
          },
          {
            label: "In progress",
            value: statusCounts["In Progress"] || 0,
            description: "Promises with ongoing action or incomplete implementation.",
          },
          {
            label: "Blocked",
            value: statusCounts.Blocked || 0,
            description: "Promises that did not reach implementation because of visible barriers.",
          },
          {
            label: "Broken or failed",
            value: statusCounts.Failed || 0,
            description: "Promises currently marked failed in the filtered result set.",
          },
        ]}
      />

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <SectionIntro
            eyebrow="Results table"
            title="Searchable public promise records"
            description="Open any row for the promise statement, current rationale, linked policies, evidence, and the status history timeline."
          />
          <PromiseResultsTable items={data.items || []} buildHref={(item) => `/promises/${item.slug}`} />
        </div>
        <div className="space-y-5">
          <div className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
            <h2 className="text-lg font-semibold text-white">Promise Tracker interpretation</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Promise Status shows what happened to a documented commitment. Linked policy action and policy outcomes show whether that commitment produced visible implementation in the current EquityStack dataset.
            </p>
          </div>
          <MethodologyCallout description="Promise status tells users what happened to the commitment. It does not automatically imply a positive or negative real-world outcome without linked evidence." />
          <SectionIntro
            eyebrow="Latest status changes"
            title="Recent movement"
            description="Use recent activity as the fast path into the newest promise records or refreshed statuses."
          />
          <RecentPolicyChangesTable
            items={(data.latestStatusChanges || []).slice(0, 8).map((item) => ({
              ...item,
              date: item.latest_action_date || item.promise_date,
              impact_direction: item.status,
            }))}
            buildHref={(item) => `/promises/${item.slug}`}
          />
        </div>
      </section>
    </main>
  );
}
