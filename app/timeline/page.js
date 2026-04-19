import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import { fetchTimelineData } from "@/lib/public-site-data";
import StructuredData from "@/app/components/public/StructuredData";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  DashboardFilterBar,
  ImpactOverviewCards,
  MethodologyCallout,
  SectionIntro,
} from "@/app/components/public/core";
import { Panel } from "@/app/components/dashboard/primitives";
import { TimelineEventCard } from "@/app/components/public/entities";
import {
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
} from "@/lib/structured-data";

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
    <main className="space-y-8">
      <StructuredData
        data={[
          buildBreadcrumbJsonLd(
            [{ href: "/", label: "Home" }, { label: "Timeline" }],
            "/timeline"
          ),
          buildCollectionPageJsonLd({
            title: "EquityStack timeline",
            description:
              "A chronological discovery layer connecting policies, promises, and historical context affecting Black Americans.",
            path: "/timeline",
            about: [
              "timeline",
              "Black policy history",
              "policies",
              "promises",
            ],
            keywords: [
              "Black history timeline",
              "civil rights timeline",
              "policy history by year",
            ],
          }),
        ]}
      />
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Timeline" }]} />

      <section className="hero-panel p-8 md:p-10 xl:p-14">
        <SectionIntro
          as="h1"
          eyebrow="Timeline"
          title="Follow Black policy history in chronological order."
          description="The timeline is a discovery layer for readers who want sequence before synthesis. It mixes policies and promises in one public chronology so civil-rights gains, reversals, and continuity become easier to follow."
          actions={
            <>
              <Link href="/reports/civil-rights-timeline" className="dashboard-button-primary">
                Open the civil-rights timeline report
              </Link>
              <Link href="/dashboard" className="dashboard-button-secondary">
                Return to the public dashboard
              </Link>
            </>
          }
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Panel padding="md">
          <h2 className="text-lg font-semibold text-white">What this timeline covers</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            This page combines historical policy records and promise records so users can see when major shifts affecting Black Americans took place.
          </p>
        </Panel>
        <Panel padding="md">
          <h2 className="text-lg font-semibold text-white">What to look for</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            Use the timeline to identify turning points, then open the linked policy or promise pages for the evidence, explanation, and historical context behind each entry.
          </p>
        </Panel>
      </section>

      <DashboardFilterBar helpText="Use the timeline as a discovery and context surface. Filter by record type or visible direction/status when you want a narrower slice of Black policy history.">
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
              className="dashboard-field"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Record type
            </span>
            <select
              name="type"
              defaultValue={resolvedSearchParams.type || ""}
              className="dashboard-field"
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
              className="dashboard-field"
            >
              <option value="">All directions / statuses</option>
              {(data.filterOptions?.directions || []).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
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

      <section className="public-two-col-rail grid items-start gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4 xl:self-start">
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
            <div className="dashboard-empty-state text-sm leading-7 text-[var(--ink-soft)]">
              No timeline records matched the current filters.
            </div>
          )}
        </div>
        <div className="space-y-4">
          <MethodologyCallout description="Timeline order helps users understand sequence, but chronology alone does not explain impact. Open the linked detail pages for evidence, scoring context, and methodology." />
          <Panel padding="md">
            <h2 className="text-lg font-semibold text-white">How to read the timeline</h2>
            <div className="mt-4 grid gap-3 text-sm leading-7 text-[var(--ink-soft)]">
              <Panel padding="md" className="bg-[rgba(18,31,49,0.52)]">
                Use it to identify when major shifts in Black policy history happened.
              </Panel>
              <Panel padding="md" className="bg-[rgba(18,31,49,0.52)]">
                Open policy cards when you need the evidence and impact explanation.
              </Panel>
              <Panel padding="md" className="bg-[rgba(18,31,49,0.52)]">
                Open promise cards when you need the original commitment and status logic.
              </Panel>
            </div>
          </Panel>
        </div>
      </section>

      <section className="space-y-4">
        <SectionIntro
          eyebrow="Continue exploring"
          title="Use chronology as a starting point, then move into records and research guides"
          description="The timeline works best as a discovery layer. These next steps help you turn sequence into policy detail, promise context, and broader research paths."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Link href="/reports/civil-rights-timeline" className="panel-link p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Historical report
            </p>
            <h3 className="mt-3 text-lg font-semibold text-white">Open the civil-rights timeline report</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Use the curated report when you want a chronology-first interpretation layer rather than a mixed event stream.
            </p>
          </Link>
          <Link href="/policies" className="panel-link p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Policy explorer
            </p>
            <h3 className="mt-3 text-lg font-semibold text-white">Review policy records behind the timeline</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Open policy pages when you need the evidence, score, and record-level explanation behind a timeline event.
            </p>
          </Link>
          <Link href="/promises" className="panel-link p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Promise tracker
            </p>
            <h3 className="mt-3 text-lg font-semibold text-white">Compare promises with chronological change</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Use the promise tracker when the timeline raises a question about commitments, delivery, and what followed over time.
            </p>
          </Link>
          <Link href="/research" className="panel-link p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Research hub
            </p>
            <h3 className="mt-3 text-lg font-semibold text-white">Return to the curated research hub</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Use the research hub when chronology opens into a broader question about presidents, laws, reports, explainers, or methods.
            </p>
          </Link>
        </div>
      </section>
    </main>
  );
}
