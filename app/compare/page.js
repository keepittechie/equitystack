import Link from "next/link";
import { ImpactBadge } from "@/app/components/policy-badges";
import { formatPartyLabel } from "@/app/components/policy-formatters";
import { fetchInternalJson } from "@/lib/api";
import { REPORT_REVALIDATE_SECONDS, withRevalidate } from "@/lib/cache";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "Compare",
  description:
    "Compare party-associated policies by impact direction, direct Black impact, and average policy score on EquityStack.",
  path: "/compare",
});

async function getComparisonData() {
  return fetchInternalJson("/api/reports/compare", {
    ...withRevalidate(REPORT_REVALIDATE_SECONDS),
    errorMessage: "Failed to fetch comparison data",
  });
}

async function getPartyScoreSummary() {
  return fetchInternalJson("/api/reports/party-score-summary", {
    ...withRevalidate(REPORT_REVALIDATE_SECONDS),
    errorMessage: "Failed to fetch party score summary",
  });
}

async function getPartyDirectSummary() {
  return fetchInternalJson("/api/reports/party-direct-summary", {
    ...withRevalidate(REPORT_REVALIDATE_SECONDS),
    errorMessage: "Failed to fetch party direct summary",
  });
}

function groupSummary(summaryRows) {
  const grouped = {};

  for (const row of summaryRows) {
    const party = row.party || "No Primary Party";

    if (!grouped[party]) {
      grouped[party] = {
        Positive: 0,
        Negative: 0,
        Mixed: 0,
        Blocked: 0,
      };
    }

    grouped[party][row.impact_direction] = Number(row.total || 0);
  }

  return grouped;
}

function groupDetailsByParty(detailsRows) {
  const grouped = {};

  for (const row of detailsRows) {
    const party = row.party || "No Primary Party";

    if (!grouped[party]) {
      grouped[party] = [];
    }
    grouped[party].push(row);
  }

  return grouped;
}

function mapByName(rows) {
  const mapped = {};

  for (const row of rows) {
    const key = row.name || row.party || "No Primary Party";
    mapped[key] = row;
  }

  return mapped;
}

function getTopParty(rows, field) {
  if (!rows.length) return null;

  return [...rows].sort((a, b) => {
    const aValue = Number(a[field] ?? 0);
    const bValue = Number(b[field] ?? 0);
    return bValue - aValue;
  })[0];
}

function CompactStat({ label, value, subtitle }) {
  return (
    <div className="metric-card p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">{label}</p>
      <p className="text-2xl font-bold mt-2">{value}</p>
      {subtitle ? <p className="text-xs text-[var(--ink-soft)] mt-2">{subtitle}</p> : null}
    </div>
  );
}

function PartySummaryCard({ party, summary, scoreRow, directRow }) {
  return (
    <div className="card-surface rounded-[1.6rem] p-5">
      <h2 className="text-xl font-semibold mb-4">{party}</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card-muted rounded-[1.1rem] p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Total Policies</p>
          <p className="text-2xl font-bold mt-2">{directRow?.total_policies ?? 0}</p>
        </div>

        <div className="card-muted rounded-[1.1rem] p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Direct Black Impact</p>
          <p className="text-2xl font-bold mt-2">
            {directRow?.direct_black_impact_count ?? 0}
          </p>
        </div>

        <div className="card-muted rounded-[1.1rem] p-3 sm:col-span-2">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Average Score</p>
          <p className="text-2xl font-bold mt-2">
            {scoreRow?.avg_policy_impact_score ?? "N/A"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="card-muted rounded-xl px-3 py-2 text-sm">
          <strong>Positive:</strong> {summary?.Positive || 0}
        </div>
        <div className="card-muted rounded-xl px-3 py-2 text-sm">
          <strong>Mixed:</strong> {summary?.Mixed || 0}
        </div>
        <div className="card-muted rounded-xl px-3 py-2 text-sm">
          <strong>Negative:</strong> {summary?.Negative || 0}
        </div>
        <div className="card-muted rounded-xl px-3 py-2 text-sm">
          <strong>Blocked:</strong> {summary?.Blocked || 0}
        </div>
      </div>
    </div>
  );
}

function PolicyCompareCard({ policy }) {
  return (
    <Link
      href={`/policies/${policy.id}`}
      className="panel-link block rounded-[1.5rem] p-5"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="max-w-3xl">
          <h3 className="text-lg font-semibold">{policy.title}</h3>
          <p className="text-sm text-[var(--ink-soft)] mt-1">
            {policy.year_enacted} {" • "} {policy.policy_type}
          </p>
          <p className="text-sm text-[var(--ink-soft)]">
            {formatPartyLabel(policy)} {" • "} {policy.era || "Unknown era"} {" • "}{" "}
            {policy.president || "Unknown president"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ImpactBadge impact={policy.impact_direction} />
        </div>
      </div>

      <p className="mt-3 text-[var(--ink-soft)] leading-7">{policy.summary}</p>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--ink-soft)]">
        <span className="public-pill">
          Direct Black Impact: {policy.direct_black_impact ? "Yes" : "No"}
        </span>
        <span className="public-pill">
          Bipartisan: {policy.bipartisan ? "Yes" : "No"}
        </span>
      </div>
    </Link>
  );
}

export default async function ComparePage() {
  const [comparisonData, partyScoreSummary, partyDirectSummary] =
    await Promise.all([
      getComparisonData(),
      getPartyScoreSummary(),
      getPartyDirectSummary(),
    ]);

  const summary = groupSummary(comparisonData.summary || []);
  const details = groupDetailsByParty(comparisonData.details || []);
  const scoresByParty = mapByName(partyScoreSummary || []);
  const directByParty = mapByName(partyDirectSummary || []);

  const parties = Object.keys(details);

  const topByTotalPolicies = getTopParty(partyDirectSummary || [], "total_policies");
  const topByDirectImpact = getTopParty(
    partyDirectSummary || [],
    "direct_black_impact_count"
  );
  const topByAverageScore = getTopParty(
    partyScoreSummary || [],
    "avg_policy_impact_score"
  );

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-10">
      <section className="hero-panel p-8 md:p-10">
        <p className="eyebrow mb-4">
          Comparison View
        </p>
        <h1 className="text-4xl font-bold tracking-tight mb-4">Compare Parties</h1>
        <p className="text-[var(--ink-soft)] text-lg max-w-3xl leading-8">
          This page compares policies in the database by party association,
          impact direction, direct Black impact, and average policy score.
          Historical party labels are not treated as ideologically identical
          across all eras.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <CompactStat
          label="Most Total Policies"
          value={topByTotalPolicies?.name || "N/A"}
          subtitle={
            topByTotalPolicies
              ? `${topByTotalPolicies.total_policies} policies`
              : null
          }
        />
        <CompactStat
          label="Most Direct Black Impact Policies"
          value={topByDirectImpact?.name || "N/A"}
          subtitle={
            topByDirectImpact
              ? `${topByDirectImpact.direct_black_impact_count} policies`
              : null
          }
        />
        <CompactStat
          label="Highest Average Score"
          value={topByAverageScore?.name || "N/A"}
          subtitle={
            topByAverageScore
              ? `${topByAverageScore.avg_policy_impact_score} average score`
              : null
          }
        />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold">Party Overview</h2>
          <p className="text-sm text-[var(--ink-soft)] mt-1">
            A side-by-side summary of party-associated policies in the dataset.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {parties.map((party) => (
            <PartySummaryCard
              key={party}
              party={party}
              summary={summary[party]}
              scoreRow={scoresByParty[party]}
              directRow={directByParty[party]}
            />
          ))}
        </div>
      </section>

      <section className="space-y-8">
        <div>
          <h2 className="text-2xl font-semibold">Policies by Party</h2>
          <p className="text-sm text-[var(--ink-soft)] mt-1">
            Review the individual policy records grouped by party association.
          </p>
        </div>

        {parties.map((party) => (
          <div key={party} className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h3 className="text-2xl font-semibold">{party}</h3>
              <p className="text-sm text-[var(--ink-soft)]">
                {details[party].length} polic{details[party].length === 1 ? "y" : "ies"}
              </p>
            </div>

            <div className="space-y-4">
              {details[party].map((policy) => (
                <PolicyCompareCard key={policy.id} policy={policy} />
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
