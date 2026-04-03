import Link from "next/link";
import { ImpactBadge } from "@/app/components/policy-badges";
import { formatPartyLabel } from "@/app/components/policy-formatters";
import { fetchInternalJson } from "@/lib/api";

async function getJson(url) {
  return fetchInternalJson(url);
}

function isCourtCase(policy) {
  return policy.policy_type === "Court Case";
}

function scoreValue(policy) {
  return Number(policy.total_score || 0);
}

function groupByEra(rows) {
  const grouped = {};

  for (const row of rows) {
    const era = row.era || "Unknown Era";
    if (!grouped[era]) grouped[era] = [];
    grouped[era].push(row);
  }

  return grouped;
}

function SectionHeader({ title, description, href, linkLabel }) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
      <div>
        <h2 className="text-2xl font-semibold">{title}</h2>
        {description ? (
          <p className="text-sm text-[var(--ink-soft)] mt-1 max-w-3xl">{description}</p>
        ) : null}
      </div>

      {href && linkLabel ? (
        <Link href={href} className="text-sm underline">
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}

function PolicyCard({ policy, showScore = false }) {
  return (
    <Link
      href={`/policies/${policy.id}`}
      className="panel-link block rounded-[1.5rem] p-5"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="max-w-3xl">
          <h3 className="text-lg font-semibold">{policy.title}</h3>
          <p className="text-sm text-[var(--ink-soft)] mt-1">
            {policy.year_enacted} {" • "} {policy.policy_type} {" • "} {formatPartyLabel(policy)}
          </p>
          <p className="text-sm text-[var(--ink-soft)]">
            {policy.era || "Unknown era"} {" • "} {policy.president || "Unknown president"}
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
        {showScore && (
          <span className="public-pill">
            Score: {policy.total_score}
          </span>
        )}
      </div>
    </Link>
  );
}

export default async function NarrativesPage() {
  const [compareData, topPolicies] = await Promise.all([
    getJson("/api/reports/compare"),
    getJson("/api/reports/top-policies"),
  ]);

  const details = compareData.details || [];

  const expandedRights = details
    .filter(
      (p) => p.impact_direction === "Positive" && p.direct_black_impact === 1
    )
    .sort((a, b) => b.year_enacted - a.year_enacted || a.title.localeCompare(b.title))
    .slice(0, 12);

  const rolledBackRights = details
    .filter(
      (p) =>
        p.impact_direction === "Negative" ||
        p.impact_direction === "Blocked" ||
        p.impact_direction === "Mixed"
    )
    .sort((a, b) => a.year_enacted - b.year_enacted || a.title.localeCompare(b.title))
    .slice(0, 12);

  const harmfulByEraSource = details.filter(
    (p) =>
      p.impact_direction === "Negative" ||
      p.impact_direction === "Blocked" ||
      p.impact_direction === "Mixed"
  );

  const harmfulByEraGrouped = groupByEra(harmfulByEraSource);

  const impactfulCourtCases = topPolicies
    .filter((p) => isCourtCase(p))
    .sort((a, b) => scoreValue(b) - scoreValue(a))
    .slice(0, 10);

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-12">
      <section className="hero-panel p-8 md:p-10">
        <p className="eyebrow mb-4">
          Narrative Mode
        </p>
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          Follow the story behind the data.
        </h1>
        <p className="text-[var(--ink-soft)] text-lg max-w-3xl leading-8">
          These curated views highlight the laws, court cases, and blocked reforms
          that expanded Black rights, rolled them back, or left major gaps unresolved.
          This page is meant to help readers move from individual records to broader historical patterns.
        </p>
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Policies That Expanded Black Rights"
          description="A curated view of policies in the dataset with positive direction and direct Black impact."
          href="/policies?direct_black_impact=true&impact_direction=Positive"
          linkLabel="View all"
        />

        <div className="grid gap-4 md:grid-cols-2">
          {expandedRights.map((policy) => (
            <PolicyCard key={policy.id} policy={policy} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Policies That Rolled Rights Back or Stalled Reform"
          description="Policies marked negative, mixed, or blocked that help explain reversals, limitations, and unfinished reform efforts."
          href="/policies?impact_direction=Negative"
          linkLabel="Explore policies"
        />

        <div className="grid gap-4 md:grid-cols-2">
          {rolledBackRights.map((policy) => (
            <PolicyCard key={policy.id} policy={policy} />
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeader
          title="Most Harmful Policies by Era"
          description="A grouped view of negative, mixed, and blocked policies to show how harm and rollback patterns changed over time."
        />

        <div className="space-y-8">
          {Object.entries(harmfulByEraGrouped).map(([era, policies]) => (
            <div key={era} className="card-surface rounded-[1.6rem] p-5">
              <h3 className="text-xl font-semibold mb-4">{era}</h3>

              <div className="grid gap-4 md:grid-cols-2">
                {policies
                  .sort((a, b) => a.year_enacted - b.year_enacted || a.title.localeCompare(b.title))
                  .slice(0, 4)
                  .map((policy) => (
                    <PolicyCard key={policy.id} policy={policy} />
                  ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Most Impactful Supreme Court Cases"
          description="High-scoring court decisions that shaped the legal landscape around rights, access, and enforcement."
          href="/timeline"
          linkLabel="View timeline"
        />

        <div className="grid gap-4 md:grid-cols-2">
          {impactfulCourtCases.map((policy) => (
            <PolicyCard key={policy.id} policy={policy} showScore />
          ))}
        </div>
      </section>
    </main>
  );
}
