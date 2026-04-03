"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";

function formatDate(dateString) {
  if (!dateString) return "Date unavailable";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function impactTone(priority) {
  switch (priority) {
    case "Critical":
      return "status-pill--danger";
    case "High":
      return "status-pill--warning";
    case "Medium":
      return "status-pill--warning";
    default:
      return "status-pill--default";
  }
}

function chamberTone(chamber) {
  switch (chamber) {
    case "House":
      return "status-pill--info";
    case "Senate":
      return "status-pill--violet";
    default:
      return "status-pill--default";
  }
}

function statusTone(status) {
  switch (status) {
    case "Enacted":
      return "status-pill--success";
    case "Passed House":
    case "Passed Senate":
      return "status-pill--info";
    case "Introduced":
      return "status-pill--info";
    default:
      return "status-pill--default";
  }
}

function StatCard({ title, value, note }) {
  return (
    <div className="metric-card p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">{title}</p>
      <p className="text-2xl font-bold mt-3">{value}</p>
      {note ? <p className="text-xs text-[var(--ink-soft)] mt-2">{note}</p> : null}
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full border rounded-xl px-3 py-2 bg-[rgba(255,252,247,0.88)]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ActivityCard({ item }) {
  return (
    <article className="card-surface rounded-[1.5rem] p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="eyebrow mb-3">Legislative Movement</p>
          <h2 className="text-2xl font-semibold leading-tight">{item.futureBillTitle}</h2>
          <p className="text-sm text-[var(--ink-soft)] mt-2">
            {[item.targetArea, item.priorityLevel, item.futureBillStatus].filter(Boolean).join(" • ")}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Action Date</p>
          <p className="text-sm font-semibold mt-1">{formatDate(item.actionDate)}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className={`status-pill ${impactTone(item.priorityLevel)}`}>
          {item.priorityLevel || "Priority Unset"}
        </span>
        <span className={`status-pill ${chamberTone(item.chamber)}`}>
          {item.chamber || "Chamber Unclear"}
        </span>
        <span className={`status-pill ${statusTone(item.billStatus)}`}>
          {item.billStatus || "Tracked"}
        </span>
        <span className="public-pill">
          {item.billNumber}
        </span>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.9fr)]">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Latest Action</p>
          <p className="text-base leading-7 mt-2">{item.actionText}</p>
          {item.billSummary ? (
            <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">
              {item.billSummary}
            </p>
          ) : null}
        </div>

        <div className="rounded-[1.2rem] border bg-[rgba(255,252,247,0.72)] p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Tracked Bill</p>
          <h3 className="font-semibold mt-2">{item.billTitle}</h3>
          <p className="text-sm text-[var(--ink-soft)] mt-2">
            {[item.billNumber, item.sessionLabel, item.jurisdiction].filter(Boolean).join(" • ")}
          </p>

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--ink-soft)]">
            <span className="public-pill">
              Sponsors: {item.sponsorCount}
            </span>
            <span className="public-pill">
              Scorecards: {item.linkedLegislatorCount}
            </span>
            <span className="public-pill">
              Explainers: {item.explainerCount}
            </span>
          </div>

          {item.topLegislators.length > 0 ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Linked Legislators</p>
              {item.topLegislators.map((legislator) => (
                <Link
                  key={`${item.id}-${legislator.id}`}
                  href={`/scorecards/${legislator.id}`}
                  className="panel-link flex items-center justify-between gap-3 rounded-xl px-3 py-2"
                >
                  <span className="font-medium">{legislator.full_name}</span>
                  <span className="text-xs text-[var(--ink-soft)]">
                    {Number(legislator.net_weighted_impact || 0).toFixed(2)}
                  </span>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={`/future-bills?focus=${item.futureBillId}`}
          className="px-4 py-2 rounded-full bg-[var(--accent)] text-white text-sm font-medium"
        >
          Open Future Bill
        </Link>
        {item.billUrl ? (
          <a
            href={item.billUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-full border border-[var(--line-strong)] bg-white/80 text-sm font-medium"
          >
            View Bill Source
          </a>
        ) : null}
      </div>
    </article>
  );
}

function buildActivityItems(bills) {
  return bills
    .flatMap((bill) =>
      (bill.tracked_bills || []).flatMap((trackedBill) =>
        (trackedBill.actions || []).map((action) => ({
          id: `${bill.id}-${trackedBill.id}-${action.id}`,
          futureBillId: bill.id,
          futureBillTitle: bill.title,
          futureBillStatus: bill.status,
          targetArea: bill.target_area,
          priorityLevel: bill.priority_level,
          explainerCount: bill.related_explainers?.length || 0,
          linkedLegislatorCount: bill.linked_legislators?.length || 0,
          topLegislators: (trackedBill.linked_legislators || []).slice(0, 3),
          billId: trackedBill.id,
          billNumber: trackedBill.bill_number,
          billTitle: trackedBill.title,
          billStatus: trackedBill.status,
          billSummary: trackedBill.official_summary,
          billUrl: trackedBill.url,
          jurisdiction: trackedBill.jurisdiction,
          chamber: trackedBill.chamber,
          sessionLabel: trackedBill.session_label,
          sponsorCount: trackedBill.sponsor_count || 0,
          actionCount: trackedBill.action_count || 0,
          actionDate: action.date,
          actionType: action.type,
          actionText: action.text,
          actionChamber: action.chamber,
        }))
      )
    )
    .filter((item) => item.actionDate || item.actionText)
    .sort((left, right) => {
      return (
        String(right.actionDate || "").localeCompare(String(left.actionDate || "")) ||
        left.futureBillTitle.localeCompare(right.futureBillTitle)
      );
    });
}

export default function ActivityFeed({ bills }) {
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [chamberFilter, setChamberFilter] = useState("All");
  const [scopeFilter, setScopeFilter] = useState("All");
  const [sortBy, setSortBy] = useState("recent");
  const deferredQuery = useDeferredValue(query);

  const activityItems = buildActivityItems(bills);
  const normalizedQuery = deferredQuery.trim().toLowerCase();

  const filteredItems = activityItems
    .filter((item) => {
      if (priorityFilter !== "All" && item.priorityLevel !== priorityFilter) return false;
      if (chamberFilter !== "All" && item.chamber !== chamberFilter) return false;

      if (scopeFilter === "Bills With Scorecards" && item.linkedLegislatorCount === 0) return false;
      if (scopeFilter === "Ideas With Explainers" && item.explainerCount === 0) return false;
      if (scopeFilter === "Critical Only" && item.priorityLevel !== "Critical") return false;

      if (!normalizedQuery) return true;

      const haystack = [
        item.futureBillTitle,
        item.billNumber,
        item.billTitle,
        item.actionText,
        item.targetArea,
        ...item.topLegislators.map((legislator) => legislator.full_name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    })
    .sort((left, right) => {
      if (sortBy === "priority") {
        const order = { Critical: 0, High: 1, Medium: 2, Low: 3 };
        return (
          (order[left.priorityLevel] ?? 99) - (order[right.priorityLevel] ?? 99) ||
          String(right.actionDate || "").localeCompare(String(left.actionDate || ""))
        );
      }

      if (sortBy === "scorecards") {
        return (
          right.linkedLegislatorCount - left.linkedLegislatorCount ||
          String(right.actionDate || "").localeCompare(String(left.actionDate || ""))
        );
      }

      return (
        String(right.actionDate || "").localeCompare(String(left.actionDate || "")) ||
        left.futureBillTitle.localeCompare(right.futureBillTitle)
      );
    });

  const recentlyUpdatedIdeas = [...bills]
    .filter((bill) => bill.latest_tracked_update)
    .sort((left, right) => String(right.latest_tracked_update).localeCompare(String(left.latest_tracked_update)))
    .slice(0, 5);

  const uniqueLegislators = new Set(
    activityItems.flatMap((item) => item.topLegislators.map((legislator) => legislator.id))
  ).size;

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-10">
      <section className="hero-panel p-8 md:p-10">
        <p className="eyebrow mb-4">Live Monitoring</p>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
          Accountability Activity Feed
        </h1>
        <p className="text-[var(--ink-soft)] text-lg max-w-3xl leading-8">
          Scan recent movement across tracked reform bills, linked future-bill concepts,
          and the legislators attached to them. This page is built for browsing the latest
          activity without having to jump between multiple sections first.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Tracked Actions" value={activityItems.length} note="Every dated or fallback action in the current feed." />
        <StatCard title="Updated Ideas" value={recentlyUpdatedIdeas.length} note="Future-bill concepts with recent linked movement." />
        <StatCard title="Bills With Scorecards" value={bills.filter((bill) => (bill.linked_legislators || []).length > 0).length} note="Ideas that already connect to legislator dossiers." />
        <StatCard title="Linked Legislators" value={uniqueLegislators} note="Distinct scorecard profiles referenced in the activity stream." />
        <StatCard title="Critical Priority" value={bills.filter((bill) => bill.priority_level === "Critical").length} note="Critical future-bill concepts currently tracked." />
      </section>

      {recentlyUpdatedIdeas.length > 0 ? (
        <section className="card-surface rounded-[1.6rem] p-6">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div className="section-intro">
              <h2 className="text-2xl font-semibold">Recently Updated Ideas</h2>
              <p className="text-sm text-[var(--ink-soft)] mt-2">
                The fastest way to see which reform concepts have new legislative movement underneath them.
              </p>
            </div>
            <Link href="/future-bills" className="accent-link text-sm">
              Open Future Bills
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {recentlyUpdatedIdeas.map((bill) => (
              <Link
                key={`recent-${bill.id}`}
                href={`/future-bills?focus=${bill.id}`}
                className="panel-link block rounded-[1.25rem] p-4"
              >
                <h3 className="font-semibold">{bill.title}</h3>
                <p className="text-sm text-[var(--ink-soft)] mt-2">
                  {[bill.target_area, bill.priority_level].filter(Boolean).join(" • ")}
                </p>
                <p className="text-xs text-[var(--accent)] mt-3">
                  {formatDate(bill.latest_tracked_update)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="card-surface rounded-[1.6rem] p-5 md:p-6 space-y-5">
        <div className="section-intro">
          <h2 className="text-2xl font-semibold">Browse Activity</h2>
          <p className="text-sm text-[var(--ink-soft)] mt-2">
            Filter the activity stream by priority, chamber, or accountability coverage, then sort by recency or scorecard density.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="block xl:col-span-2">
            <span className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Search</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search ideas, bills, actions, or legislators"
              className="mt-2 w-full border rounded-xl px-3 py-2 bg-[rgba(255,252,247,0.88)]"
            />
          </label>

          <SelectField
            label="Priority"
            value={priorityFilter}
            onChange={setPriorityFilter}
            options={[
              { value: "All", label: "All Priorities" },
              { value: "Critical", label: "Critical" },
              { value: "High", label: "High" },
              { value: "Medium", label: "Medium" },
              { value: "Low", label: "Low" },
            ]}
          />

          <SelectField
            label="Chamber"
            value={chamberFilter}
            onChange={setChamberFilter}
            options={[
              { value: "All", label: "All Chambers" },
              { value: "House", label: "House" },
              { value: "Senate", label: "Senate" },
            ]}
          />

          <SelectField
            label="Scope"
            value={scopeFilter}
            onChange={setScopeFilter}
            options={[
              { value: "All", label: "All Activity" },
              { value: "Bills With Scorecards", label: "Bills With Scorecards" },
              { value: "Ideas With Explainers", label: "Ideas With Explainers" },
              { value: "Critical Only", label: "Critical Only" },
            ]}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem] items-end">
          <p className="text-sm text-[var(--ink-soft)]">
            Showing {filteredItems.length} of {activityItems.length} tracked actions.
          </p>

          <SelectField
            label="Sort"
            value={sortBy}
            onChange={setSortBy}
            options={[
              { value: "recent", label: "Most Recent" },
              { value: "priority", label: "Highest Priority" },
              { value: "scorecards", label: "Most Scorecard Links" },
            ]}
          />
        </div>
      </section>

      <section className="space-y-5">
        {filteredItems.length === 0 ? (
          <div className="card-surface rounded-[1.6rem] p-8 text-center">
            <h2 className="text-2xl font-semibold">No activity matches this filter set</h2>
            <p className="text-sm text-[var(--ink-soft)] mt-3">
              Try clearing the query or broadening the chamber and scope filters.
            </p>
          </div>
        ) : (
          filteredItems.map((item) => <ActivityCard key={item.id} item={item} />)
        )}
      </section>
    </main>
  );
}
