import Link from "next/link";
import { buildListingMetadata } from "@/lib/metadata";
import { fetchPromiseIndexData } from "@/lib/public-site-data";
import StructuredData from "@/app/components/public/StructuredData";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  DashboardFilterBar,
  ImpactOverviewCards,
  MethodologyCallout,
  SectionIntro,
} from "@/app/components/public/core";
import { Panel } from "@/app/components/dashboard/primitives";
import {
  PromiseResultsTable,
  RecentPolicyChangesTable,
} from "@/app/components/public/entities";
import PromiseStatusLegend from "@/app/components/public/PromiseStatusLegend";
import PromiseSystemExplanation from "@/app/components/public/PromiseSystemExplanation";
import {
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
  buildDatasetJsonLd,
} from "@/lib/structured-data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }) {
  const resolvedSearchParams = (await searchParams) || {};

  return buildListingMetadata({
    title: "Campaign promises and Black policy impact",
    description:
      "Track campaign and governing promises related to Black Americans, including current status, rationale, linked actions, and policy outcomes.",
    path: "/promises",
    keywords: [
      "campaign promises to Black Americans",
      "promise tracker",
      "presidential record on Black issues",
    ],
    searchParams: resolvedSearchParams,
  });
}

export default async function PromisesPage({ searchParams }) {
  const resolvedSearchParams = (await searchParams) || {};
  const data = await fetchPromiseIndexData(resolvedSearchParams);
  const statusCounts = data.statusCounts || {
    Delivered: 0,
    "In Progress": 0,
    Partial: 0,
    Blocked: 0,
    Failed: 0,
  };

  return (
    <main className="space-y-4">
      <StructuredData
        data={[
          buildBreadcrumbJsonLd(
            [{ href: "/", label: "Home" }, { label: "Promises" }],
            "/promises"
          ),
          buildCollectionPageJsonLd({
            title: "Campaign promises and Black policy impact",
            description:
              "A public promise tracker covering campaign and governing promises tied to Black Americans, linked actions, and documented outcomes.",
            path: "/promises",
            about: [
              "campaign promises",
              "Black Americans",
              "promise tracking",
              "presidents",
            ],
            keywords: [
              "campaign promises to Black Americans",
              "promise tracker",
            ],
          }),
          buildDatasetJsonLd({
            title: "EquityStack promise tracker dataset",
            description:
              "Structured promise records used by EquityStack to track status, actions, outcomes, and evidence across presidents and administrations.",
            path: "/promises",
            about: ["campaign promises", "Black Americans", "policy outcomes"],
            keywords: ["promise tracker", "campaign promises to Black Americans"],
            variableMeasured: [
              "Promise status",
              "Action count",
              "Outcome count",
              "Source count",
            ],
          }),
        ]}
      />
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Promises" }]} />

      <section className="hero-panel p-4">
        <SectionIntro
          as="h1"
          eyebrow="Promise tracker"
          title="Track campaign promises, delivery, and linked outcomes in one place."
          description="Promise pages separate political intent from the documented outcomes that followed. That makes it easier to study promises to Black Americans, implementation, partial progress, failure, or blockage without losing the evidence trail."
          actions={
            <>
              <Link href="/dashboard" className="dashboard-button-primary">
                Open the promise data dashboard
              </Link>
              <Link href="/methodology" className="dashboard-button-secondary">
                Read how promise grading works
              </Link>
            </>
          }
        />
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
              className="dashboard-field"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">Status</span>
            <select name="status" defaultValue={resolvedSearchParams.status || ""} className="dashboard-field">
              <option value="">All statuses</option>
              {(data.filters?.statuses || []).map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">President</span>
            <select name="president" defaultValue={resolvedSearchParams.president || ""} className="dashboard-field">
              <option value="">All presidents</option>
              {(data.filters?.presidents || []).map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">Topic</span>
            <select name="topic" defaultValue={resolvedSearchParams.topic || ""} className="dashboard-field">
              <option value="">All topics</option>
              {(data.filters?.topics || []).map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="dashboard-button-secondary">
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
            label: "Delivered",
            value: statusCounts.Delivered || 0,
            description: "Promises with documented implemented policy action in the filtered result set.",
          },
          {
            label: "In Progress",
            value: statusCounts["In Progress"] || 0,
            description: "Promises with ongoing action or incomplete implementation.",
          },
          {
            label: "Partial",
            value: statusCounts.Partial || 0,
            description: "Promises with meaningful but incomplete documented implementation.",
          },
          {
            label: "Blocked",
            value: statusCounts.Blocked || 0,
            description: "Promises that did not reach implementation because of visible barriers.",
          },
          {
            label: "Failed",
            value: statusCounts.Failed || 0,
            description: "Promises currently marked failed in the filtered result set.",
          },
        ]}
      />

      <section className="space-y-4">
        <Panel padding="md" className="space-y-4">
          <SectionIntro
            eyebrow="Results table"
            title="Searchable public promise records"
            description="Open any row for the promise statement, current rationale, linked policies, evidence, and the status history timeline."
          />
          <PromiseResultsTable items={data.items || []} buildHref={(item) => `/promises/${item.slug}`} />
          <Panel padding="md" className="space-y-4 bg-[rgba(18,31,49,0.52)]">
            <PromiseSystemExplanation />
            <PromiseStatusLegend />
          </Panel>
          <Panel padding="md" className="bg-[rgba(18,31,49,0.52)]">
            <h2 className="text-lg font-semibold text-white">Promise Tracker interpretation</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Promise Status shows what happened to a documented commitment. Linked policy action and Policy Outcomes show whether that commitment produced visible implementation in the current EquityStack dataset.
            </p>
          </Panel>
          <MethodologyCallout description="Promise Status tells users what happened to the commitment. It does not automatically imply a positive or negative real-world outcome without linked Policy Outcomes and evidence." />
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
              record_type: "Promise",
            }))}
            buildHref={(item) => `/promises/${item.slug}`}
          />
        </Panel>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Link href="/presidents" className="panel-link p-4">
          <h2 className="text-lg font-semibold text-white">Compare presidents by linked promise records</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            Move from the promise tracker into presidential profiles when you want score context, policy drivers, and Black history by administration.
          </p>
        </Link>
        <Link href="/current-administration" className="panel-link p-4">
          <h2 className="text-lg font-semibold text-white">Follow the current administration</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            The current-administration overview highlights recent promise movement, actions, and outcomes inside the live public record.
          </p>
        </Link>
      </section>
    </main>
  );
}
