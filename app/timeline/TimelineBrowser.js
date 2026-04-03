"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import PresidentAvatar from "@/app/components/PresidentAvatar";
import { ImpactBadge } from "@/app/components/policy-badges";

const DEFAULT_VISIBLE_POLICIES = 4;

const FILTERS = [
  { key: "All", label: "All" },
  { key: "Positive", label: "Positive" },
  { key: "Negative", label: "Negative" },
  { key: "Mixed", label: "Mixed" },
  { key: "Blocked", label: "Blocked" },
];

function formatRange(startYear, endYear) {
  return `${startYear || "N/A"} to ${endYear || "Present"}`;
}

function buildEraSummary(era) {
  const positive = Number(era.positive_count ?? era.positive_policies ?? 0);
  const negative = Number(era.negative_count ?? era.negative_policies ?? 0);
  const mixed = Number(era.mixed_count ?? era.mixed_policies ?? 0);
  const blocked = Number(era.blocked_count ?? era.blocked_policies ?? 0);
  const direct = Number(
    era.direct_black_impact_count ?? era.direct_black_impact_policies ?? 0
  );
  const total = Number(era.total_policies ?? era.policies?.length ?? 0);

  const directionPairs = [
    { key: "Positive", value: positive },
    { key: "Negative", value: negative },
    { key: "Mixed", value: mixed },
    { key: "Blocked", value: blocked },
  ].sort((a, b) => b.value - a.value);

  const lead = directionPairs[0];

  if (!total) {
    return "No policy records are currently attached to this era.";
  }

  return `${direct} of ${total} tracked policies are marked as direct Black impact. ${lead.key} records are the largest visible group in this era.`;
}

function StatPill({ label, value }) {
  return (
    <div className="card-muted rounded-[1rem] px-4 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">{label}</p>
      <p className="text-lg font-bold mt-1">{value ?? 0}</p>
    </div>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-medium ${
        active
          ? "bg-[var(--accent)] text-white border-[var(--accent)]"
          : "bg-[rgba(255,252,247,0.82)] text-[var(--ink-soft)] border-[var(--line)] hover:border-[var(--line-strong)]"
      }`}
    >
      {children}
    </button>
  );
}

function JumpChip({ targetId, children }) {
  return (
    <a
      href={`#${targetId}`}
      className="rounded-full border px-4 py-2 text-sm bg-[rgba(255,252,247,0.82)] text-[var(--ink-soft)] border-[var(--line)] hover:border-[var(--line-strong)] hover:text-[var(--accent)]"
    >
      {children}
    </a>
  );
}

function TimelinePolicyRow({ policy }) {
  return (
    <Link
      href={`/policies/${policy.id}`}
      className="panel-link block rounded-[1.3rem] p-4"
    >
      <div className="flex gap-4">
        <div className="min-w-16 text-right pt-0.5">
          <p className="text-lg font-semibold">{policy.year_enacted}</p>
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)] mt-1">
            {policy.policy_type}
          </p>
        </div>

        <div className="w-px bg-[var(--line)] shrink-0" />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="max-w-3xl">
              <h3 className="text-lg font-semibold leading-7">{policy.title}</h3>
              <p className="text-sm text-[var(--ink-soft)] mt-1">
                {policy.primary_party || "No Primary Party"} {" • "}{" "}
                {policy.president || "Unknown president"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <PresidentAvatar
                presidentSlug={policy.president_slug}
                presidentName={policy.president}
                size={56}
              />
              <ImpactBadge impact={policy.impact_direction} />
            </div>
          </div>

          {policy.summary ? (
            <p className="text-sm text-[var(--ink-soft)] leading-7 mt-3 line-clamp-3">
              {policy.summary}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--ink-soft)]">
            <span className="public-pill">
              Direct Black Impact: {policy.direct_black_impact ? "Yes" : "No"}
            </span>
            <span className="public-pill">
              Status: {policy.status || "Unknown"}
            </span>
            <span className="public-pill">
              Bipartisan: {policy.bipartisan ? "Yes" : "No"}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function TimelineBrowser({ eras }) {
  const [activeFilter, setActiveFilter] = useState("All");
  const [expandedEras, setExpandedEras] = useState({});

  const preparedEras = useMemo(() => {
    return eras.map((era) => {
      const filteredPolicies =
        activeFilter === "All"
          ? era.policies
          : era.policies.filter((policy) => policy.impact_direction === activeFilter);

      return {
        ...era,
        filteredPolicies,
        summaryLine: buildEraSummary(era),
      };
    });
  }, [activeFilter, eras]);

  function toggleEra(name) {
    setExpandedEras((current) => ({
      ...current,
      [name]: !current[name],
    }));
  }

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-8">
      <section className="hero-panel p-8 md:p-10">
        <p className="eyebrow mb-4">Timeline View</p>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
          Follow the historical sequence.
        </h1>
        <p className="text-[var(--ink-soft)] text-lg max-w-3xl leading-8">
          Browse the database as a readable timeline. Each era works like a chapter:
          start with the high-level pattern, then drill into the policies that shaped it.
        </p>
      </section>

      <section className="card-surface rounded-[1.6rem] p-5 md:p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="section-intro">
            <h2 className="text-2xl font-semibold">Browse the Timeline</h2>
            <p className="text-sm text-[var(--ink-soft)] mt-2">
              Jump to an era, or narrow the page to one impact direction so the sequence
              is easier to follow.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
            Filter By Impact
          </p>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((filter) => (
              <FilterChip
                key={filter.key}
                active={activeFilter === filter.key}
                onClick={() => setActiveFilter(filter.key)}
              >
                {filter.label}
              </FilterChip>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
            Jump To Era
          </p>
          <div className="flex flex-wrap gap-2">
            {preparedEras.map((era) => (
              <JumpChip key={era.name} targetId={`era-${era.name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`}>
                {era.name}
              </JumpChip>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-8">
        {preparedEras.map((era, index) => {
          const isExpanded = Boolean(expandedEras[era.name]);
          const visiblePolicies = isExpanded
            ? era.filteredPolicies
            : era.filteredPolicies.slice(0, DEFAULT_VISIBLE_POLICIES);
          const remainingCount = Math.max(
            era.filteredPolicies.length - DEFAULT_VISIBLE_POLICIES,
            0
          );
          const sectionId = `era-${era.name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`;

          return (
            <section
              key={era.name}
              id={sectionId}
              className="relative card-surface rounded-[1.8rem] p-6 md:p-8 scroll-mt-24"
            >
              {index < preparedEras.length - 1 ? (
                <div className="absolute left-8 top-[8.5rem] bottom-[-2rem] w-px bg-[var(--line)] hidden md:block" />
              ) : null}

              <div className="flex items-start gap-4">
                <div className="hidden md:flex h-5 w-5 rounded-full border-4 border-[var(--background)] bg-[var(--accent)] shadow-sm mt-1 shrink-0" />

                <div className="min-w-0 flex-1 space-y-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="section-intro">
                      <p className="eyebrow mb-3">Era {index + 1}</p>
                      <h2 className="text-3xl font-semibold">{era.name}</h2>
                      <p className="text-sm text-[var(--ink-soft)] mt-2">
                        {formatRange(era.start_year, era.end_year)}
                      </p>
                      <p className="text-[var(--ink-soft)] mt-4 leading-7">
                        {era.summaryLine}
                      </p>
                    </div>

                    <p className="text-sm text-[var(--ink-soft)]">
                      Showing {visiblePolicies.length} of {era.filteredPolicies.length} matching polic
                      {era.filteredPolicies.length === 1 ? "y" : "ies"}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                    <StatPill label="Total" value={era.total_policies || 0} />
                    <StatPill
                      label="Direct Impact"
                      value={
                        era.direct_black_impact_count ??
                        era.direct_black_impact_policies ??
                        0
                      }
                    />
                    <StatPill label="Positive" value={era.positive_count ?? era.positive_policies ?? 0} />
                    <StatPill label="Mixed" value={era.mixed_count ?? era.mixed_policies ?? 0} />
                    <StatPill label="Negative" value={era.negative_count ?? era.negative_policies ?? 0} />
                    <StatPill label="Blocked" value={era.blocked_count ?? era.blocked_policies ?? 0} />
                  </div>

                  {era.filteredPolicies.length === 0 ? (
                    <div className="card-muted rounded-[1.3rem] p-5">
                      <p className="text-[var(--ink-soft)]">
                        No policies in this era match the current impact filter.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {visiblePolicies.map((policy) => (
                        <TimelinePolicyRow key={policy.id} policy={policy} />
                      ))}
                    </div>
                  )}

                  {remainingCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => toggleEra(era.name)}
                      className="rounded-full border px-5 py-3 font-medium bg-[rgba(255,252,247,0.82)] border-[var(--line)] hover:border-[var(--line-strong)]"
                    >
                      {isExpanded
                        ? `Show fewer in ${era.name}`
                        : `Show ${remainingCount} more in ${era.name}`}
                    </button>
                  ) : null}
                </div>
              </div>
            </section>
          );
        })}
      </section>
    </main>
  );
}
