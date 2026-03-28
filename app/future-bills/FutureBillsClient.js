"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  buildFutureBillCardHref,
  buildFutureBillDetailHref,
} from "@/lib/shareable-card-links";
import {
  FutureBillDetailSections,
  formatDate,
  getMostRecentAction,
  priorityClasses,
  statusClasses,
} from "./FutureBillContent";

function StatCard({ title, value }) {
  return (
    <div className="metric-card p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">{title}</p>
      <p className="text-2xl font-bold mt-3">{value}</p>
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

export default function FutureBillsClient({ bills, focusId }) {
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [trackingFilter, setTrackingFilter] = useState("All");
  const [sortBy, setSortBy] = useState("recent_update");

  const totalBills = bills.length;
  const criticalCount = bills.filter((bill) => bill.priority_level === "Critical").length;
  const highCount = bills.filter((bill) => bill.priority_level === "High").length;
  const introducedCount = bills.filter((bill) => bill.status === "Introduced").length;
  const linkedBillsCount = bills.filter((bill) => bill.tracked_bills.length > 0).length;
  const historyCount = bills.filter((bill) =>
    bill.tracked_bills.some((trackedBill) => trackedBill.action_count > 0)
  ).length;

  useEffect(() => {
    if (!focusId) return;

    const el = document.getElementById(`future-bill-${focusId}`);
    if (!el) return;

    el.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [focusId]);

  const filteredBills = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const filtered = bills.filter((bill) => {
      if (priorityFilter !== "All" && bill.priority_level !== priorityFilter) return false;
      if (statusFilter !== "All" && bill.status !== statusFilter) return false;

      if (trackingFilter === "Linked Only" && bill.tracked_bills.length === 0) return false;
      if (
        trackingFilter === "Recently Updated" &&
        !bill.tracked_bills.some((trackedBill) => trackedBill.date)
      ) {
        return false;
      }
      if (
        trackingFilter === "Needs Tracking" &&
        bill.tracked_bills.length > 0
      ) {
        return false;
      }

      if (!normalizedQuery) return true;

      const haystack = [
        bill.title,
        bill.target_area,
        bill.problem_statement,
        bill.proposed_solution,
        ...bill.tracked_bills.map((trackedBill) => trackedBill.title),
        ...bill.tracked_bills.map((trackedBill) => trackedBill.bill_number),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });

    const sorted = [...filtered];

    sorted.sort((left, right) => {
      if (sortBy === "priority") {
        const priorityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
        const leftPriority = priorityOrder[left.priority_level] ?? 99;
        const rightPriority = priorityOrder[right.priority_level] ?? 99;
        return leftPriority - rightPriority || left.title.localeCompare(right.title);
      }

      if (sortBy === "linked_bills") {
        return (
          right.tracked_bills.length - left.tracked_bills.length ||
          left.title.localeCompare(right.title)
        );
      }

      if (sortBy === "recent_added") {
        return (
          String(right.created_at || "").localeCompare(String(left.created_at || "")) ||
          left.title.localeCompare(right.title)
        );
      }

      if (sortBy === "title") {
        return left.title.localeCompare(right.title);
      }

      return (
        String(right.latest_tracked_update || "").localeCompare(String(left.latest_tracked_update || "")) ||
        left.title.localeCompare(right.title)
      );
    });

    return sorted;
  }, [bills, priorityFilter, query, sortBy, statusFilter, trackingFilter]);

  const recentlyUpdatedBills = useMemo(() => {
    return [...bills]
      .filter((bill) => bill.latest_tracked_update)
      .sort((a, b) => String(b.latest_tracked_update).localeCompare(String(a.latest_tracked_update)))
      .slice(0, 4)
      .map((bill) => ({
        ...bill,
        most_recent_action: getMostRecentAction(bill.tracked_bills),
      }));
  }, [bills]);

  const trackedOnlyCount = bills.filter((bill) => bill.tracked_bills.length > 0).length;
  const untrackedCount = bills.length - trackedOnlyCount;

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-10">
      <section className="hero-panel p-8 md:p-10">
        <p className="eyebrow mb-4">
          Forward-Looking Policy Ideas
        </p>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Future Bills</h1>
        <p className="text-[var(--ink-soft)] text-lg max-w-3xl leading-8">
          This page tracks proposed policy ideas, legislative priorities, and reform concepts
          that could address unresolved harms, close equity gaps, or strengthen protections
          for Black communities in the future.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard title="Total Future Bills" value={totalBills} />
        <StatCard title="Critical Priority" value={criticalCount} />
        <StatCard title="High Priority" value={highCount} />
        <StatCard title="Idea Status: Introduced" value={introducedCount} />
        <StatCard title="Ideas With Real Bills" value={linkedBillsCount} />
        <StatCard title="Bills With Timelines" value={historyCount} />
      </section>

      <section className="card-surface rounded-[1.6rem] p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="max-w-3xl">
            <h2 className="text-lg font-semibold mb-2">Accountability Connections</h2>
            <p className="text-sm text-[var(--ink-soft)] leading-7">
              Future Bills tracks the proposal layer. Use Scorecards to see which legislators are attached to
              those bills, and Promise Tracker to connect presidential commitments to the broader accountability record.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/scorecards" className="accent-link">
              Open Scorecards
            </Link>
            <Link href="/promises" className="accent-link">
              Open Promise Tracker
            </Link>
          </div>
        </div>
      </section>

      <section className="card-surface rounded-[1.6rem] p-5 md:p-6 space-y-5">
        <div className="section-intro">
          <h2 className="text-2xl font-semibold">Browse Future Bills</h2>
          <p className="text-sm text-[var(--ink-soft)] mt-2">
            Narrow the list by priority, status, or tracking depth, then sort by recent movement or coverage.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="block xl:col-span-2">
            <span className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Search</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search ideas, linked bills, or topics"
              className="mt-2 w-full border rounded-xl px-3 py-2 bg-[rgba(255,252,247,0.88)]"
            />
          </label>

          <SelectField
            label="Priority"
            value={priorityFilter}
            onChange={setPriorityFilter}
            options={[
              { value: "All", label: "All priorities" },
              { value: "Critical", label: "Critical" },
              { value: "High", label: "High" },
              { value: "Medium", label: "Medium" },
              { value: "Low", label: "Low" },
            ]}
          />

          <SelectField
            label="Idea Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "All", label: "All statuses" },
              { value: "Introduced", label: "Introduced" },
              { value: "Advocacy", label: "Advocacy" },
              { value: "Drafting", label: "Drafting" },
              { value: "Idea", label: "Idea" },
            ]}
          />

          <SelectField
            label="Tracking Depth"
            value={trackingFilter}
            onChange={setTrackingFilter}
            options={[
              { value: "All", label: "All records" },
              { value: "Linked Only", label: "Linked bills only" },
              { value: "Recently Updated", label: "Recently updated" },
              { value: "Needs Tracking", label: "Needs tracking" },
            ]}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_15rem] items-end">
          <div className="flex flex-wrap gap-2 text-xs text-[var(--ink-soft)]">
            <span className="border rounded-full px-3 py-1 bg-[rgba(255,252,247,0.82)]">
              Results: {filteredBills.length}
            </span>
            <span className="border rounded-full px-3 py-1 bg-[rgba(255,252,247,0.82)]">
              Linked Ideas: {trackedOnlyCount}
            </span>
            <span className="border rounded-full px-3 py-1 bg-[rgba(255,252,247,0.82)]">
              Needs Tracking: {untrackedCount}
            </span>
          </div>

          <SelectField
            label="Sort"
            value={sortBy}
            onChange={setSortBy}
            options={[
              { value: "recent_update", label: "Recent updates" },
              { value: "priority", label: "Priority" },
              { value: "linked_bills", label: "Most linked bills" },
              { value: "recent_added", label: "Recently added" },
              { value: "title", label: "Title" },
            ]}
          />
        </div>
      </section>

      {recentlyUpdatedBills.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold">Recently Updated</h2>
            <p className="text-sm text-[var(--ink-soft)] mt-1">
              The most recent tracked movement across the bills currently linked to future proposals.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {recentlyUpdatedBills.map((bill) => (
              <Link
                key={`recent-${bill.id}`}
                href={buildFutureBillDetailHref(bill)}
                className="panel-link block rounded-[1.5rem] p-5"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="max-w-3xl">
                    <h3 className="text-lg font-semibold">{bill.title}</h3>
                    <p className="text-sm text-[var(--ink-soft)] mt-1">
                      Latest update: {formatDate(bill.latest_tracked_update)}
                    </p>
                  </div>
                  <span className="border rounded-full px-3 py-1 text-xs font-medium bg-[rgba(255,252,247,0.85)] text-[var(--ink-soft)] border-[var(--line)]">
                    Linked Bills: {bill.tracked_bills.length}
                  </span>
                </div>

                {bill.most_recent_action ? (
                  <p className="mt-3 text-sm text-[var(--ink-soft)] leading-7">
                    <strong>{bill.most_recent_action.bill_number}:</strong> {bill.most_recent_action.text}
                  </p>
                ) : null}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold">Proposals</h2>
          <p className="text-sm text-[var(--ink-soft)] mt-1">
            These entries represent future-facing bill ideas and reform directions tracked in the project.
          </p>
        </div>

        {filteredBills.length === 0 && (
          <div className="card-surface rounded-[1.6rem] p-5">
            <p>No future bills match the current filters.</p>
          </div>
        )}

        <div className="space-y-5">
          {filteredBills.map((bill) => {
            const isFocused = String(bill.id) === String(focusId);

            return (
              <section
                key={bill.id}
                id={`future-bill-${bill.id}`}
                className={`card-surface rounded-[1.6rem] p-6 scroll-mt-24 ${
                  isFocused ? "ring-2 ring-black border-black" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="max-w-3xl">
                    <Link
                      href={buildFutureBillDetailHref(bill)}
                      className="text-2xl font-semibold accent-link"
                    >
                      {bill.title}
                    </Link>
                    <p className="text-sm text-[var(--ink-soft)] mt-2">
                      {bill.target_area || "No target area specified"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--ink-soft)]">
                      <span className="border rounded-full px-3 py-1 bg-[rgba(255,252,247,0.8)]">
                        Linked Bills: {bill.tracked_bills.length}
                      </span>
                      {bill.latest_tracked_update ? (
                        <span className="border rounded-full px-3 py-1 bg-[rgba(255,252,247,0.8)]">
                          Latest Bill Update: {formatDate(bill.latest_tracked_update)}
                        </span>
                      ) : null}
                      <span className="border rounded-full px-3 py-1 bg-[rgba(255,252,247,0.8)]">
                        Explainers: {bill.related_explainers?.length || 0}
                      </span>
                      {bill.created_at ? (
                        <span className="border rounded-full px-3 py-1 bg-[rgba(255,252,247,0.8)]">
                          Added: {formatDate(bill.created_at)}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {isFocused && (
                      <span className="border rounded-full px-3 py-1 text-xs font-medium bg-[var(--accent)] text-white border-[var(--accent)]">
                        Focused
                      </span>
                    )}

                    <span
                      className={`border rounded-full px-3 py-1 text-xs font-medium ${priorityClasses(
                        bill.priority_level
                      )}`}
                    >
                      {bill.priority_level}
                    </span>
                    <span
                      className={`border rounded-full px-3 py-1 text-xs font-medium ${statusClasses(
                        bill.status
                      )}`}
                    >
                      {bill.status}
                    </span>
                    <Link
                      href={buildFutureBillCardHref(bill)}
                      className="rounded-full border border-[rgba(120,53,15,0.18)] bg-white/80 px-5 py-2 text-sm font-medium"
                    >
                      Share Card
                    </Link>
                    <Link
                      href={buildFutureBillDetailHref(bill)}
                      className="rounded-full border border-[rgba(120,53,15,0.18)] bg-white/80 px-5 py-2 text-sm font-medium"
                    >
                      Open Detail Page
                    </Link>
                  </div>
                </div>

                <FutureBillDetailSections bill={bill} />
              </section>
            );
          })}
        </div>
      </section>
    </main>
  );
}
