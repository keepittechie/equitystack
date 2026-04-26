"use client";

import { useMemo, useState } from "react";
import { RecentPolicyChangesTable } from "@/app/components/public/entities";

const DIRECTION_OPTIONS = [
  { value: "all", label: "All" },
  { value: "positive", label: "Positive" },
  { value: "negative", label: "Negative" },
  { value: "mixed", label: "Mixed" },
  { value: "blocked", label: "Blocked / Stalled" },
];

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeFilterValue(value) {
  return normalizeText(value).toLowerCase();
}

function directionBucket(value) {
  const normalized = normalizeFilterValue(value);
  if (normalized.includes("positive")) return "positive";
  if (normalized.includes("negative")) return "negative";
  if (normalized.includes("mixed")) return "mixed";
  if (normalized.includes("blocked") || normalized.includes("stalled")) return "blocked";
  return normalized || "unknown";
}

function recordTypeLabel(item = {}) {
  const explicitType = normalizeText(item.display_record_type || item.record_type);
  const linkedType = normalizeText(item.linked_record_type);
  const policyType = normalizeFilterValue(item.policy_type);
  const candidate = explicitType || linkedType;
  const normalized = normalizeFilterValue(candidate);

  if (normalized.includes("bill") || policyType === "legislative") return "BILL";
  if (normalized.includes("promise") || policyType === "current_admin") return "PROMISE";
  if (normalized.includes("report")) return "REPORT";
  if (normalized.includes("policy")) return "POLICY";
  return "RECORD UPDATE";
}

function directionLabel(item = {}) {
  const bucket = directionBucket(item.impact_direction || item.status);

  if (bucket === "positive") return "Positive Impact";
  if (bucket === "negative") return "Negative Impact";
  if (bucket === "mixed") return "Mixed Impact";
  if (bucket === "blocked") return "Stalled / Blocked";
  return normalizeText(item.impact_direction || item.status) || "—";
}

function collectRecordTypeOptions(items = []) {
  const present = new Set(items.map(recordTypeLabel));
  return ["BILL", "PROMISE", "POLICY", "REPORT"]
    .filter((label) => present.has(label))
    .map((label) => ({ value: label.toLowerCase(), label: label[0] + label.slice(1).toLowerCase() }));
}

function matchesSearch(item, query) {
  if (!query) {
    return true;
  }

  const haystack = [
    item.title,
    item.summary,
    item.linked_record_title,
    item.linked_record,
    item.why_this_matters_text,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

export default function ReportLinkedPolicyMovement({
  items = [],
  buildHref,
  emptyTitle,
  emptyDescription,
}) {
  const [recordType, setRecordType] = useState("all");
  const [direction, setDirection] = useState("all");
  const [query, setQuery] = useState("");

  const recordTypeOptions = useMemo(() => collectRecordTypeOptions(items), [items]);
  const normalizedQuery = normalizeFilterValue(query);
  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const itemRecordType = normalizeFilterValue(recordTypeLabel(item));
        const itemDirection = directionBucket(item.impact_direction || item.status);

        return (
          (recordType === "all" || itemRecordType === recordType) &&
          (direction === "all" || itemDirection === direction) &&
          matchesSearch(item, normalizedQuery)
        );
      }),
    [direction, items, normalizedQuery, recordType]
  );

  return (
    <div className="space-y-3">
      {items.length ? (
        <div className="rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.72)] p-3">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_220px]">
            <label className="grid gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                Search updates
              </span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search update, linked record, or summary"
                className="dashboard-field"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                Record Type
              </span>
              <select
                value={recordType}
                onChange={(event) => setRecordType(event.target.value)}
                className="dashboard-field"
              >
                <option value="all">All</option>
                {recordTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                Direction
              </span>
              <select
                value={direction}
                onChange={(event) => setDirection(event.target.value)}
                className="dashboard-field"
              >
                {DIRECTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      ) : null}

      <RecentPolicyChangesTable
        items={filteredItems}
        buildHref={buildHref}
        emptyTitle={items.length ? "No matching updates found." : emptyTitle}
        emptyDescription={
          items.length
            ? "Try adjusting the filters or search terms."
            : emptyDescription
        }
        showScoreImpact
        showWhyThisMatters
        formatRecordType={recordTypeLabel}
        formatDirection={directionLabel}
      />
    </div>
  );
}
