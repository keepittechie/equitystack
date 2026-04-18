"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { Breadcrumbs } from "@/app/components/public/chrome";
import { statusPillClasses, ImpactBadge } from "@/app/components/policy-badges";
import {
  DashboardFilterBar,
  ImpactOverviewCards,
  MethodologyCallout,
  PageContextBlock,
  ScoreBadge,
  SectionIntro,
} from "@/app/components/public/core";
import { formatBillDate } from "@/lib/public-bills";

const FILTER_FIELD_CLASS =
  "min-w-0 rounded-xl border border-white/8 bg-white/5 px-3 py-2.5 text-sm text-white outline-none";

function BillsPanel({ children, className = "" }) {
  return (
    <section
      className={`rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5 md:p-6 ${className}`}
    >
      {children}
    </section>
  );
}

function getBillScoreTone(direction) {
  if (direction === "Positive") {
    return "positive";
  }

  if (direction === "Negative") {
    return "negative";
  }

  return "default";
}

function getBillActivityTimestamp(bill) {
  const timestamp = Date.parse(bill.latestActionDate || bill.introducedDate || "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function countBillsByDirection(items = []) {
  return items.reduce(
    (totals, item) => {
      const direction = item.impactDirection;

      if (direction === "Positive" || direction === "Mixed" || direction === "Negative") {
        totals[direction] += 1;
      }

      if (item.active) {
        totals.active += 1;
      }

      return totals;
    },
    {
      active: 0,
      Positive: 0,
      Mixed: 0,
      Negative: 0,
    }
  );
}

function FilterField({ label, children }) {
  return (
    <label className="grid gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function MovingBillCard({ bill }) {
  return (
    <article className="card-surface flex h-full min-w-0 flex-col rounded-[1.6rem] p-5 md:p-6">
      <Link href={bill.detailHref} className="group flex flex-1 flex-col rounded-[1.2rem]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
              {bill.billNumber}
            </p>
            <h3 className="mt-3 line-clamp-2 text-xl font-semibold text-white group-hover:text-[var(--accent)]">
              {bill.title}
            </h3>
            <p className="mt-2 line-clamp-3 text-sm leading-7 text-[var(--ink-soft)]">
              {bill.latestAction || bill.whyItMatters}
            </p>
          </div>
          <ScoreBadge
            value={String(bill.blackImpactScore)}
            label="Estimated BIS"
            tone={getBillScoreTone(bill.impactDirection)}
          />
        </div>

        <div className="mt-auto flex flex-wrap gap-2 pt-4">
          <ImpactBadge impact={bill.impactDirection} />
          <span className={statusPillClasses(bill.statusTone)}>{bill.status}</span>
          <span className="public-pill">
            {formatBillDate(bill.latestActionDate) || "Date unavailable"}
          </span>
        </div>
      </Link>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link href={bill.detailHref} className="public-button-secondary">
          Open bill
        </Link>
        <Link href={bill.primaryContextHref} className="public-button-secondary">
          Open bill context
        </Link>
        {bill.sourceUrl ? (
          <a
            href={bill.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="public-button-secondary"
          >
            View source
          </a>
        ) : null}
      </div>
    </article>
  );
}

function BillCard({ bill }) {
  return (
    <article className="card-surface flex h-full min-w-0 flex-col rounded-[1.6rem] p-5 md:p-6">
      <Link href={bill.detailHref} className="group flex flex-1 flex-col rounded-[1.2rem]">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
              {bill.billNumber}
            </p>
            <h3 className="mt-3 line-clamp-2 text-xl font-semibold text-white group-hover:text-[var(--accent)] md:text-2xl">
              {bill.title}
            </h3>
            <p className="mt-2 line-clamp-2 text-sm leading-7 text-[var(--ink-soft)]">
              {[
                bill.chamber,
                bill.sessionLabel,
                bill.jurisdiction,
                bill.introducedDate ? `Introduced ${formatBillDate(bill.introducedDate)}` : null,
              ]
                .filter(Boolean)
                .join(" • ")}
            </p>
          </div>

          <ScoreBadge
            value={String(bill.blackImpactScore)}
            label="Estimated BIS"
            tone={getBillScoreTone(bill.impactDirection)}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className={statusPillClasses(bill.statusTone)}>{bill.status}</span>
          <ImpactBadge impact={bill.impactDirection} />
          <span className={statusPillClasses(bill.confidenceTone)}>
            Impact confidence: {bill.impactConfidence}
          </span>
          <span className={statusPillClasses(bill.reviewTone)}>{bill.reviewProxy}</span>
        </div>

        {bill.topicTags.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {bill.topicTags.map((topic) => (
              <span key={`${bill.id}-${topic}`} className="public-pill">
                {topic}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_15rem]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
              Why this matters
            </p>
            <p className="mt-3 line-clamp-4 text-sm leading-7 text-[var(--ink-soft)]">
              {bill.whyItMatters}
            </p>
          </div>

          <div className="rounded-[1.25rem] border border-white/8 bg-white/5 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Snapshot
            </p>
            <div className="mt-3 grid gap-3 text-sm text-[var(--ink-soft)]">
              <p>Last action: {formatBillDate(bill.latestActionDate) || "Unavailable"}</p>
              <p>Future-bill links: {bill.linkedFutureBills.length}</p>
              <p>Sources surfaced: {bill.sourceCount}</p>
              <p>Sponsors tracked: {bill.sponsorCount}</p>
              <p>Promise / president links: {bill.promiseCount} / {bill.presidentCount}</p>
            </div>
          </div>
        </div>

        {bill.latestAction ? (
          <div className="mt-5 rounded-[1.25rem] border border-white/8 bg-[rgba(255,255,255,0.03)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Latest action
            </p>
            <p className="mt-2 line-clamp-3 text-sm leading-7 text-[var(--ink-soft)]">
              {bill.latestAction}
            </p>
          </div>
        ) : null}
      </Link>

      <div className="mt-5 flex flex-wrap gap-3 pt-1">
        <Link href={bill.detailHref} className="public-button-secondary">
          Open bill
        </Link>
        <Link href={bill.primaryContextHref} className="public-button-secondary">
          Open bill context
        </Link>
        {bill.sourceUrl ? (
          <a
            href={bill.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="public-button-secondary"
          >
            View source
          </a>
        ) : null}
      </div>
    </article>
  );
}

export default function BillsClient({ bills }) {
  const [query, setQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [impactFilter, setImpactFilter] = useState("All");
  const deferredQuery = useDeferredValue(query);

  const topicOptions = useMemo(() => {
    return [...new Set(bills.flatMap((bill) => bill.topicTags))].sort((left, right) =>
      left.localeCompare(right)
    );
  }, [bills]);

  const statusOptions = useMemo(() => {
    return [...new Set(bills.map((bill) => bill.status).filter(Boolean))].sort((left, right) =>
      left.localeCompare(right)
    );
  }, [bills]);

  const filteredBills = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    return bills.filter((bill) => {
      if (topicFilter !== "All" && !bill.topicTags.includes(topicFilter)) {
        return false;
      }

      if (statusFilter !== "All" && bill.status !== statusFilter) {
        return false;
      }

      if (impactFilter !== "All" && bill.impactDirection !== impactFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        bill.billNumber,
        bill.title,
        bill.status,
        bill.whyItMatters,
        bill.latestAction,
        bill.sponsor,
        ...bill.topicTags,
        ...bill.linkedFutureBills.map((item) => item.title),
        ...(bill.relatedPromises || []).flatMap((item) => [item.title, item.topic, item.presidentName]),
        ...(bill.relatedPresidents || []).map((item) => item.name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [bills, deferredQuery, impactFilter, statusFilter, topicFilter]);

  const featuredBills = useMemo(() => {
    return bills
      .slice()
      .filter((bill) => bill.latestActionDate || bill.latestAction)
      .sort((left, right) => {
        return (
          getBillActivityTimestamp(right) - getBillActivityTimestamp(left) ||
          Number(right.active) - Number(left.active) ||
          Math.abs(Number(right.blackImpactScore || 0)) -
            Math.abs(Number(left.blackImpactScore || 0)) ||
          left.title.localeCompare(right.title)
        );
      })
      .slice(0, 3);
  }, [bills]);

  const stats = useMemo(() => {
    const activeCount = bills.filter((bill) => bill.active).length;
    const averageBlackImpactScore = bills.length
      ? bills.reduce((total, bill) => total + bill.blackImpactScore, 0) / bills.length
      : 0;
    const highConfidenceCount = bills.filter((bill) => bill.impactConfidence === "High").length;
    const needsReviewCount = bills.filter((bill) => bill.reviewProxy !== "Reviewed Proxy").length;

    return {
      activeCount,
      averageBlackImpactScore,
      highConfidenceCount,
      needsReviewCount,
    };
  }, [bills]);

  const filteredDirectionCounts = useMemo(
    () => countBillsByDirection(filteredBills),
    [filteredBills]
  );

  const hasActiveFilters =
    Boolean(query.trim()) ||
    topicFilter !== "All" ||
    statusFilter !== "All" ||
    impactFilter !== "All";

  function clearFilters() {
    setQuery("");
    setTopicFilter("All");
    setStatusFilter("All");
    setImpactFilter("All");
  }

  return (
    <main className="space-y-10">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Bills" }]} />

      <section className="hero-panel p-8 md:p-10 xl:p-14">
        <SectionIntro
          as="h1"
          eyebrow="Legislative tracker"
          title="Track the bills shaping policy outcomes for Black Americans"
          description="Browse the tracked bills EquityStack is watching, see where they sit in the legislative process, and open the context behind why they matter for Black Americans, civil-rights policy, and related public outcomes."
          actions={
            <>
              <Link href="/activity" className="public-button-primary">
                Open activity feed
              </Link>
              <Link href="/future-bills" className="public-button-secondary">
                Browse future-bill context
              </Link>
            </>
          }
        />
      </section>

      <ImpactOverviewCards
        items={[
          {
            label: "Tracked bills",
            value: bills.length,
            description: "Distinct public tracked-bill records currently visible through the shared legislative dataset.",
            tone: "accent",
          },
          {
            label: "Active this Congress",
            value: stats.activeCount,
            description: "Bills still marked active in the underlying tracked-bill feed.",
          },
          {
            label: "Avg. bill BIS",
            value: Math.round(stats.averageBlackImpactScore),
            description: "Estimated Black Impact Score averaged across the currently visible tracked-bill dataset.",
          },
          {
            label: "High-confidence / needs review",
            value: `${stats.highConfidenceCount} / ${stats.needsReviewCount}`,
            description: "High-confidence mappings versus entries that still need stronger public context or review.",
          },
        ]}
      />

      {featuredBills.length ? (
        <section className="space-y-5">
          <SectionIntro
            eyebrow="What’s moving now"
            title="Recent bill movement worth checking first"
            description="These cards prioritize bills with the most recent public movement so you can open the freshest context first."
          />
          <div className="grid gap-4 xl:grid-cols-3">
            {featuredBills.map((bill) => (
              <MovingBillCard key={`featured-${bill.id}`} bill={bill} />
            ))}
          </div>
        </section>
      ) : null}

      <DashboardFilterBar helpText="Search by bill title, number, topic, or linked context. Estimated BIS is a deterministic public heuristic built from the bill record, linked reform context, legislative progress, and evidence depth.">
        <div className="grid flex-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FilterField label="Search">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Bill number, title, topic, or keyword"
              className={FILTER_FIELD_CLASS}
            />
          </FilterField>

          <FilterField label="Topic">
            <select
              value={topicFilter}
              onChange={(event) => setTopicFilter(event.target.value)}
              className={FILTER_FIELD_CLASS}
            >
              <option value="All">All topics</option>
              {topicOptions.map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Status">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className={FILTER_FIELD_CLASS}
            >
              <option value="All">All statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Impact direction">
            <select
              value={impactFilter}
              onChange={(event) => setImpactFilter(event.target.value)}
              className={FILTER_FIELD_CLASS}
            >
              <option value="All">All directions</option>
              <option value="Positive">Positive</option>
              <option value="Mixed">Mixed</option>
              <option value="Negative">Negative</option>
            </select>
          </FilterField>
        </div>
        {hasActiveFilters ? (
          <button type="button" onClick={clearFilters} className="public-button-secondary">
            Clear filters
          </button>
        ) : null}
      </DashboardFilterBar>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Results"
          title={`${filteredBills.length} bills currently visible`}
          description={
            hasActiveFilters
              ? `Showing ${filteredBills.length} of ${bills.length} tracked bills. Open the linked context when you want the connected future-bill framing or the original source.`
              : "Cards keep the public legislative layer readable without forcing users into a dense table first. Open the linked context when you want the connected future-bill framing or the original source."
          }
        />

        <div className="flex flex-wrap gap-2">
          <span className="public-pill">Active: {filteredDirectionCounts.active}</span>
          <span className="public-pill">Positive: {filteredDirectionCounts.Positive}</span>
          <span className="public-pill">Mixed: {filteredDirectionCounts.Mixed}</span>
          <span className="public-pill">Negative: {filteredDirectionCounts.Negative}</span>
        </div>

        {filteredBills.length ? (
          <div className="grid gap-5 xl:grid-cols-2">
            {filteredBills.map((bill) => (
              <BillCard key={bill.id} bill={bill} />
            ))}
          </div>
        ) : (
          <div className="rounded-[1.6rem] border border-dashed border-white/12 bg-white/4 p-6 text-sm leading-7 text-[var(--ink-soft)]">
            <p>
              No bills match the current filters. Try widening the search, changing the
              topic, or clearing the impact filter.
            </p>
            {hasActiveFilters ? (
              <button type="button" onClick={clearFilters} className="public-button-secondary mt-4">
                Clear filters
              </button>
            ) : null}
          </div>
        )}
      </section>

      <section className="space-y-5">
        <BillsPanel className="space-y-5">
          <PageContextBlock
            title="How to read this bill layer"
            description="The public bill cards are built from tracked-bill records already linked into EquityStack’s legislative dataset."
            detail="Use this page as a search-friendly entry point for current legislation affecting Black Americans, then open the bill detail page for legislative history, linked promises, related presidents, and source-backed context."
          />
          <MethodologyCallout
            title="Why the score is marked estimated"
            description="EquityStack now computes a structured bill-level BIS from the public tracked-bill dataset. The score is explainable and deterministic, but it remains bounded by the current depth of publicly surfaced sources, actions, and linked reform context."
          />
        </BillsPanel>
      </section>
    </main>
  );
}
