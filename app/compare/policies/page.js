import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import { fetchComparePoliciesData } from "@/lib/public-site-data";
import { buildEvidenceCoverage } from "@/lib/evidenceCoverage";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  KpiCard,
  SectionIntro,
  ScoreBadge,
} from "@/app/components/public/core";
import {
  CompareSelector,
  ComparisonMetricsTable,
} from "@/app/components/public/entities";
import TrustBar from "@/app/components/public/TrustBar";
import {
  Panel,
  StatusPill,
  getImpactDirectionTone,
} from "@/app/components/dashboard/primitives";

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "Compare Policies",
  description:
    "Compare selected policy records by Black Impact Score, impact direction, demographic evidence, and source strength.",
  path: "/compare/policies",
});

function normalizeSelected(value) {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list
    .flatMap((item) => String(item).split(","))
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function formatScore(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : "—";
}

function formatDemographicEvidenceCount(value) {
  const numeric = Number(value || 0);
  if (!numeric) {
    return "No demographic evidence yet";
  }

  return `${numeric} demographic impact ${numeric === 1 ? "entry" : "entries"}`;
}

function normalizeDirection(value) {
  return String(value || "").trim().toLowerCase();
}

function getTopFundingHighlight(item = {}) {
  return (item.demographic_highlights || []).find((highlight) => highlight.type === "funding") || null;
}

function buildPairComparisonSummary(items = []) {
  const [left, right] = items;
  if (!left || !right) {
    return null;
  }

  const bullets = [];
  const leftDirection = normalizeDirection(left.impact_direction);
  const rightDirection = normalizeDirection(right.impact_direction);

  if (leftDirection && rightDirection && leftDirection !== rightDirection) {
    bullets.push(
      `${left.title} is currently classified as ${leftDirection}, while ${right.title} is classified as ${rightDirection}.`
    );
  } else if (left.has_black_impact_score && right.has_black_impact_score) {
    const higher =
      Number(left.impact_score || 0) >= Number(right.impact_score || 0) ? left : right;
    const gap = Math.abs(Number(left.impact_score || 0) - Number(right.impact_score || 0));

    if (gap >= 2) {
      const directionLabel = normalizeDirection(higher.impact_direction) || "mixed";
      bullets.push(
        `Both records lean ${directionLabel}, but ${higher.title} carries the stronger documented ${directionLabel} score in the current dataset.`
      );
    }
  }

  const leftImpactCount = Number(left.demographic_impact_count || 0);
  const rightImpactCount = Number(right.demographic_impact_count || 0);
  if (leftImpactCount && !rightImpactCount) {
    bullets.push(
      `${left.title} already includes policy-linked demographic impact evidence here, while ${right.title} does not yet have any attached in this view.`
    );
  } else if (!leftImpactCount && rightImpactCount) {
    bullets.push(
      `${right.title} already includes policy-linked demographic impact evidence here, while ${left.title} does not yet have any attached in this view.`
    );
  } else if (Math.abs(leftImpactCount - rightImpactCount) >= 2) {
    const stronger = leftImpactCount > rightImpactCount ? left : right;
    const thinner = stronger.id === left.id ? right : left;
    bullets.push(
      `${stronger.title} currently has a thicker demographic-evidence layer than ${thinner.title} (${stronger.demographic_impact_count} entries versus ${thinner.demographic_impact_count}).`
    );
  } else if (Math.abs(Number(left.source_count || 0) - Number(right.source_count || 0)) >= 2) {
    const stronger = Number(left.source_count || 0) > Number(right.source_count || 0) ? left : right;
    const thinner = stronger.id === left.id ? right : left;
    bullets.push(
      `${stronger.title} also has broader visible source coverage in this comparison (${stronger.source_count} sources versus ${thinner.source_count}).`
    );
  }

  const leftFunding = getTopFundingHighlight(left);
  const rightFunding = getTopFundingHighlight(right);
  if (leftFunding && !rightFunding) {
    bullets.push(
      `${left.title} includes a direct funding-change row in the current evidence layer, while ${right.title} does not surface a comparable funding highlight here.`
    );
  } else if (!leftFunding && rightFunding) {
    bullets.push(
      `${right.title} includes a direct funding-change row in the current evidence layer, while ${left.title} does not surface a comparable funding highlight here.`
    );
  } else if (leftFunding && rightFunding && leftFunding.program_label !== rightFunding.program_label) {
    bullets.push(
      `The clearest funding contrast in this view is ${leftFunding.program_label} for ${left.title} versus ${rightFunding.program_label} for ${right.title}.`
    );
  }

  return bullets.length >= 2
    ? {
        title: "Top-line comparison",
        bullets: bullets.slice(0, 4),
      }
    : null;
}

function buildMultiPolicyComparisonSummary(items = []) {
  if (items.length < 2) {
    return null;
  }

  const bullets = [];
  const scoredItems = items.filter((item) => item.has_black_impact_score);
  if (scoredItems.length >= 2) {
    const rankedByScore = scoredItems
      .slice()
      .sort((left, right) => Number(right.impact_score || 0) - Number(left.impact_score || 0));
    const leader = rankedByScore[0];
    const trailing = rankedByScore[rankedByScore.length - 1];

    if (leader && trailing && leader.id !== trailing.id) {
      bullets.push(
        `${leader.title} currently has the strongest weighted Black Impact Score in this set, while ${trailing.title} sits at the bottom of the scored records.`
      );
    }
  }

  const rankedByEvidence = items
    .slice()
    .sort(
      (left, right) =>
        Number(right.demographic_impact_count || 0) - Number(left.demographic_impact_count || 0)
    );
  const strongestEvidence = rankedByEvidence[0];
  const weakestEvidence = rankedByEvidence[rankedByEvidence.length - 1];

  if (
    strongestEvidence &&
    weakestEvidence &&
    strongestEvidence.id !== weakestEvidence.id &&
    Number(strongestEvidence.demographic_impact_count || 0) >
      Number(weakestEvidence.demographic_impact_count || 0)
  ) {
    bullets.push(
      `${strongestEvidence.title} has the strongest demographic-evidence layer in this comparison, while ${weakestEvidence.title} is currently the sparsest.`
    );
  }

  const fundingPolicies = items.filter((item) => getTopFundingHighlight(item));
  if (fundingPolicies.length === 1) {
    bullets.push(
      `${fundingPolicies[0].title} is the only policy in this set that currently surfaces a direct funding-change highlight in the demographic evidence layer.`
    );
  } else if (fundingPolicies.length >= 2 && fundingPolicies.length < items.length) {
    bullets.push(
      `${fundingPolicies.length} of the selected policies currently surface direct funding-change highlights; the rest rely on broader scoring or supporting evidence only.`
    );
  }

  return bullets.length >= 2
    ? {
        title: "Top-line comparison",
        bullets: bullets.slice(0, 4),
      }
    : null;
}

function buildComparisonSummary(items = []) {
  if (items.length === 2) {
    return buildPairComparisonSummary(items);
  }

  return buildMultiPolicyComparisonSummary(items);
}

function CompareHighlightList({ highlights = [] }) {
  if (!highlights.length) {
    return (
      <p className="text-sm leading-7 text-[var(--ink-soft)]">
        No demographic impact evidence has been added yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {highlights.map((highlight) => (
        <div
          key={highlight.id}
          className="rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.52)] px-4 py-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-white">{highlight.program_label}</p>
            <StatusPill tone={highlight.type === "funding" ? "warning" : "info"}>
              {highlight.type === "funding" ? "Funding change" : "Supporting evidence"}
            </StatusPill>
          </div>
          {highlight.metric_label ? (
            <p className="mt-1 text-sm leading-6 text-[var(--ink-soft)]">
              {highlight.metric_label}
            </p>
          ) : null}
          <p className="mt-2 text-sm leading-7 text-white">{highlight.value_label}</p>
          <p className="mt-1 text-sm leading-6 text-[var(--ink-soft)]">
            {[highlight.demographic_group, highlight.confidence_label].filter(Boolean).join(" • ")}
          </p>
        </div>
      ))}
    </div>
  );
}

function BlackImpactComparisonCard({ item }) {
  const direction = item.impact_direction || "Not classified";
  const directionTone = getImpactDirectionTone(direction);
  const evidenceCoverage = buildEvidenceCoverage({
    sourceCount: item.source_count,
    demographicImpactCount: item.demographic_impact_count,
    fundingImpactCount: item.demographic_funding_count,
    supportingImpactCount: item.demographic_supporting_count,
    hasPolicyScore: item.has_black_impact_score,
  });

  return (
    <Panel padding="md" className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            Policy record
          </p>
          <h3 className="mt-2 text-xl font-semibold text-white">
            <Link
              href={`/policies/${item.slug || item.id}`}
              className="transition-colors hover:text-[var(--accent)]"
            >
              {item.title}
            </Link>
          </h3>
          {item.summary ? (
            <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--ink-soft)]">
              {item.summary}
            </p>
          ) : null}
        </div>
        <ScoreBadge
          value={item.black_impact_score_display || "Not yet scored"}
          label="Black Impact Score"
          context={item.has_black_impact_score ? `${formatScore(item.impact_score)} weighted` : null}
          tone={
            String(item.impact_direction || "").toLowerCase() === "positive"
              ? "positive"
              : String(item.impact_direction || "").toLowerCase() === "negative"
                ? "negative"
                : "default"
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            Impact direction
          </p>
          <div className="mt-2">
            <StatusPill tone={directionTone}>{direction}</StatusPill>
          </div>
        </div>
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            Demographic evidence
          </p>
          <p className="mt-2 text-sm leading-7 text-white">
            {formatDemographicEvidenceCount(item.demographic_impact_count)}
          </p>
        </div>
      </div>

      {evidenceCoverage ? (
        <div className="space-y-2">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            Analysis coverage
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={evidenceCoverage.tone}>{evidenceCoverage.label}</StatusPill>
          </div>
          <p className="text-sm leading-7 text-[var(--ink-soft)]">
            {evidenceCoverage.description}
          </p>
        </div>
      ) : null}

      <div className="space-y-3">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
          Black impact highlights
        </p>
        <CompareHighlightList highlights={item.demographic_highlights || []} />
      </div>
    </Panel>
  );
}

export default async function ComparePoliciesPage({ searchParams }) {
  const resolvedSearchParams = (await searchParams) || {};
  const selected = normalizeSelected(resolvedSearchParams.compare);
  const data = await fetchComparePoliciesData(selected);
  const items = data.items || [];
  const rows = (data.items || []).map((item) => ({
    label: item.title,
    black_impact_score: item.black_impact_score_display || "Not yet scored",
    direction: item.impact_direction || "—",
    demographic_evidence: item.has_demographic_impacts
      ? `${item.demographic_impact_count} ${item.demographic_impact_count === 1 ? "entry" : "entries"}`
      : "No evidence yet",
    confidence: item.confidence_label || "Unknown",
    sources: item.source_count ?? 0,
    president: item.president || "—",
    year: item.year_enacted || "—",
  }));
  const highestScore =
    items
      .filter((item) => item.has_black_impact_score)
      .slice()
      .sort((left, right) => Number(right.impact_score || 0) - Number(left.impact_score || 0))[0] ||
    null;
  const lowestScore =
    items
      .filter((item) => item.has_black_impact_score)
      .slice()
      .sort((left, right) => Number(left.impact_score || 0) - Number(right.impact_score || 0))[0] ||
    null;
  const strongestEvidence =
    items.slice().sort(
      (left, right) =>
        Number(right.demographic_impact_count || 0) - Number(left.demographic_impact_count || 0)
    )[0] || null;
  const positiveCount = items.filter(
    (item) => String(item.impact_direction || "").toLowerCase() === "positive"
  ).length;
  const negativeCount = items.filter(
    (item) => String(item.impact_direction || "").toLowerCase() === "negative"
  ).length;
  const comparisonSummary = buildComparisonSummary(items);

  return (
    <main className="space-y-4">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/compare", label: "Compare" },
          { label: "Policies" },
        ]}
      />

      <section className="hero-panel p-4">
        <SectionIntro
          as="h1"
          eyebrow="Policy comparison"
          title="Compare policy records by Black Impact Score, direction, and evidence."
          description="Use Black Impact Score for the fastest high-level read, then compare direction and demographic evidence to see why a policy may matter for Black Americans or Black communities."
        />
      </section>

      <TrustBar />

      <section className="space-y-4">
        <form action="/compare/policies" method="GET" className="space-y-4">
          <CompareSelector
            options={data.options || []}
            selected={data.selected_ids || []}
            name="compare"
          />
          <button type="submit" className="dashboard-button-primary">
            {selected.length >= 2
              ? `Compare ${selected.length} selected polic${selected.length === 1 ? "y" : "ies"}`
              : "Compare selected policies"}
          </button>
        </form>
        <p className="max-w-4xl text-sm leading-7 text-[var(--ink-soft)]">
          Choose records that belong in the same conversation. Columns are policies and rows are
          comparison metrics. Start with Black Impact Score, then use direction and demographic
          evidence to decide whether the visible gap is meaningful.
        </p>
      </section>

      {data.items?.length >= 2 ? (
        <>
          {comparisonSummary ? (
            <section className="space-y-3 rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4">
              <h2 className="text-lg font-semibold text-white">{comparisonSummary.title}</h2>
              <ul className="space-y-2 text-sm leading-7 text-[var(--ink-soft)]">
                {comparisonSummary.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Highest Black Impact Score"
              value={highestScore?.black_impact_score_display || "—"}
              description={
                highestScore
                  ? `${highestScore.title} currently leads on the weighted policy score.`
                  : "No scored policy lead is available."
              }
              tone="accent"
            />
            <KpiCard
              label="Lowest Black Impact Score"
              value={lowestScore?.black_impact_score_display || "—"}
              description={
                lowestScore
                  ? `${lowestScore.title} currently sits at the bottom of the scored set.`
                  : "No lower scored record is available."
              }
            />
            <KpiCard
              label="Strongest demographic evidence"
              value={strongestEvidence?.demographic_impact_count ?? 0}
              description={
                strongestEvidence?.demographic_impact_count
                  ? `${strongestEvidence.title} has the largest demographic-impact evidence layer in this comparison.`
                  : "No demographic-impact evidence is attached to the selected set yet."
              }
            />
            <KpiCard
              label="Direction split"
              value={`${positiveCount} positive / ${negativeCount} negative`}
              description="Quick read on whether the selected set leans positive or negative before you open each policy."
            />
          </section>

          <ComparisonMetricsTable
            rows={rows}
            metrics={[
              {
                key: "black_impact_score",
                label: "Black Impact Score",
                description: "Normalized from the canonical weighted policy score for readability.",
                primary: true,
              },
              {
                key: "direction",
                label: "Impact direction",
                description: "Shows whether the record leans positive, negative, mixed, or blocked.",
              },
              {
                key: "demographic_evidence",
                label: "Demographic evidence",
                description: "Shows whether policy-linked demographic impact rows are present.",
              },
              {
                key: "confidence",
                label: "Evidence confidence",
                description: "Use this with sources to judge how hard to lean on the comparison.",
              },
              {
                key: "sources",
                label: "Source count",
                description: "Visible source coverage attached to the policy record.",
              },
              {
                key: "president",
                label: "President",
                description: "Historical owner of the policy record.",
              },
              {
                key: "year",
                label: "Year enacted",
                description: "Placement in historical time.",
              },
            ]}
          />

          <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-5">
              <SectionIntro
                eyebrow="Black impact"
                title="How each record compares"
                description="Each policy keeps the same public record framing: score, direction, and a short read of the demographic evidence currently attached to it."
              />
              <div className="grid gap-4">
                {items.map((item) => (
                  <BlackImpactComparisonCard key={item.id} item={item} />
                ))}
              </div>
            </div>
            <div className="space-y-5">
              <div className="rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4">
                <h2 className="text-lg font-semibold text-white">What to look at first</h2>
                <div className="mt-4 grid gap-3 text-sm leading-7 text-[var(--ink-soft)]">
                  <div className="rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.52)] p-4">
                    Start with Black Impact Score. It gives the fastest read on the weighted policy record before you open the full page.
                  </div>
                  <div className="rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.52)] p-4">
                    Then check direction. Mixed and blocked records need more caution than a clean positive or negative record.
                  </div>
                  <div className="rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.52)] p-4">
                    Then read the demographic highlights. Funding rows come first, followed by supporting evidence that explains why the policy may matter.
                  </div>
                  <div className="rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.52)] p-4">
                    Finally check confidence and sources, then open the policy page you want to verify. That is the fastest path from comparison into the underlying evidence.
                  </div>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : (
        <section className="dashboard-empty-state text-sm leading-7 text-[var(--ink-soft)]">
          Select at least two policies to generate a comparison. Choose records with shared topic or historical context for the clearest read.
        </section>
      )}
    </main>
  );
}
