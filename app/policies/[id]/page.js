import Link from "next/link";
import {
  CompletenessBadge,
  EvidenceBadge,
  ImpactBadge,
  PromiseStatusBadge,
} from "@/app/components/policy-badges";
import { formatPartyLabel } from "@/app/components/policy-formatters";
import { fetchInternalJson } from "@/lib/api";
import { PUBLIC_REVALIDATE_SECONDS, withRevalidate } from "@/lib/cache";
import { computePolicyImpactScore } from "@/lib/analytics/impactAggregator";
import { buildPageMetadata } from "@/lib/metadata";
import { buildPolicyJsonLd, serializeJsonLd } from "@/lib/structured-data";
import { notFound } from "next/navigation";
import { buildPolicyCardHref } from "@/lib/shareable-card-links";

async function getPolicy(id) {
  return fetchInternalJson(`/api/policies/${id}`, {
    ...withRevalidate(PUBLIC_REVALIDATE_SECONDS),
    allow404: true,
    errorMessage: "Failed to fetch policy",
  });
}

async function getSuggestedRelationships(id) {
  return fetchInternalJson(`/api/policies/${id}/suggested-relationships`, {
    ...withRevalidate(PUBLIC_REVALIDATE_SECONDS),
    errorMessage: "Failed to fetch suggested relationships",
  });
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const policy = await getPolicy(id);

  if (!policy) {
    return buildPageMetadata({
      title: "Policy Not Found",
      description: "The requested policy record could not be found on EquityStack.",
      path: `/policies/${id}`,
    });
  }

  return buildPageMetadata({
    title: policy.title,
    description:
      policy.summary ||
      "Read a detailed EquityStack policy record with sources, metrics, impact scoring, and related explainers.",
    path: `/policies/${id}`,
  });
}

function StatCard({ title, value, subtitle }) {
  return (
    <div className="metric-card p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">{title}</p>
      <p className="text-2xl font-bold mt-2">{value}</p>
      {subtitle ? <p className="text-sm text-[var(--ink-soft)] mt-2">{subtitle}</p> : null}
    </div>
  );
}

function relationshipBadgeClasses(type) {
  switch (type) {
    case "expands":
      return "bg-green-50 text-green-700 border-green-200";
    case "enables":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "responds_to":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "restricts":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "undermines":
      return "bg-red-50 text-red-700 border-red-200";
    case "replaces":
      return "bg-blue-50 text-blue-700 border-blue-200";
    default:
      return "bg-stone-100 text-stone-700 border-stone-300";
  }
}

function formatRelationshipLabel(type) {
  return (type || "related").replaceAll("_", " ");
}

function formatDate(dateString) {
  if (!dateString) return null;

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function interpretImpactScore(score) {
  if (score === null || score === undefined) return "Not yet scored";
  if (score >= 20) return "Very high documented impact";
  if (score >= 14) return "High documented impact";
  if (score >= 8) return "Moderate documented impact";
  if (score >= 1) return "Limited documented impact";
  return "Net harmful or constrained outcome";
}

function priorityClasses(priority) {
  switch (priority) {
    case "Critical":
      return "bg-red-50 text-red-700 border-red-200";
    case "High":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "Medium":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "Low":
      return "bg-stone-100 text-stone-700 border-stone-300";
    default:
      return "bg-stone-100 text-stone-700 border-stone-300";
  }
}

function formatImpactMetric(value) {
  return Number(value || 0).toFixed(2);
}

function PromiseMetaPill({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[rgba(120,53,15,0.12)] bg-white/80 px-3 py-1 text-xs text-[var(--ink-soft)]">
      {children}
    </span>
  );
}

export default async function PolicyDetailPage({ params }) {
  const { id } = await params;

  const [policy, suggestedRelationships] = await Promise.all([
    getPolicy(id),
    getSuggestedRelationships(id),
  ]);

  if (!policy) {
    notFound();
  }

  const totalScore = policy.scores
    ? computePolicyImpactScore(policy.scores)
    : null;

  const sourceCount = policy.sources?.length || 0;
  const metricCount = policy.metrics?.length || 0;
  const categoryCount = policy.categories?.length || 0;
  const sourceTypes = policy.source_mix_summary?.source_types_used || [];

  return (
    <main className="max-w-7xl mx-auto p-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(buildPolicyJsonLd(policy, id, totalScore)),
        }}
      />
      <Link href="/policies" className="text-sm underline mb-4 inline-block">
        Back to policies
      </Link>

      <section className="hero-panel p-8 md:p-10 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
          <div>
            <h1 className="text-3xl font-bold">{policy.title}</h1>
            <p className="text-sm text-[var(--ink-soft)] mt-2 max-w-3xl">
              This page analyzes a single policy using structured scoring, historical evidence,
              source quality, and measurable outcomes.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <ImpactBadge impact={policy.impact_direction} />
              <EvidenceBadge summary={policy.evidence_summary} />
              <CompletenessBadge summary={policy.completeness_summary} />
            </div>
          </div>
          <Link
            href={buildPolicyCardHref(policy)}
            className="rounded-full border border-[rgba(120,53,15,0.18)] bg-white/80 px-5 py-2 text-sm font-medium"
          >
            Share Card
          </Link>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <section className="card-surface rounded-[1.6rem] p-5">
            <h2 className="text-xl font-semibold mb-2">Summary</h2>
            <p className="text-[var(--ink-soft)] leading-8">{policy.summary || "No summary added yet."}</p>
          </section>

          <section className="card-surface-strong rounded-[1.6rem] p-5">
            <h2 className="text-xl font-semibold mb-2">How to Read This Record</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Impact Reading</p>
                <p className="text-sm text-[var(--ink-soft)] mt-2">
                  {interpretImpactScore(totalScore)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Evidence Base</p>
                <p className="text-sm text-[var(--ink-soft)] mt-2">
                  {policy.evidence_summary?.evidence_strength || "Limited"} evidence
                  {sourceTypes.length ? ` from ${sourceTypes.join(", ")} sources` : ""}.
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Data Completeness</p>
                <p className="text-sm text-[var(--ink-soft)] mt-2">
                  {policy.completeness_summary?.status || "Needs Review"} record with{" "}
                  {sourceCount} source{sourceCount === 1 ? "" : "s"} and {metricCount} metric
                  {metricCount === 1 ? "" : "s"}.
                </p>
              </div>
            </div>
          </section>

          <section className="card-surface rounded-[1.6rem] p-5">
            <h2 className="text-xl font-semibold mb-2">Outcome Summary</h2>
            <p className="text-[var(--ink-soft)] leading-8">
              {policy.outcome_summary || "No outcome summary added yet."}
            </p>
          </section>

          <section className="card-surface rounded-[1.6rem] p-5">
            <h2 className="text-xl font-semibold mb-2">Categories</h2>
            {policy.categories.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {policy.categories.map((category) => (
                  <span
                    key={category.name}
                    className="border rounded-full px-3 py-1 text-sm bg-[rgba(255,252,247,0.8)]"
                  >
                    {category.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--ink-soft)]">No categories assigned yet.</p>
            )}
          </section>

          {policy.scores && (
            <section className="card-surface rounded-[1.6rem] p-5">
              <h2 className="text-xl font-semibold mb-2">Impact Scores</h2>

              <div className="card-muted rounded-[1.35rem] p-5 mb-4">
                <p className="text-sm text-[var(--ink-soft)]">
                  This score is a structured measure of how directly and materially this policy affected
                  Black communities, weighted by evidence, durability, and equity. Harm offset reduces
                  the total score.
                </p>
              </div>

              <div className="card-muted rounded-[1.35rem] p-5">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <div className="border rounded-xl p-4 bg-[rgba(255,252,247,0.8)]">
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Total Impact Score</p>
                    <p className="text-3xl font-bold mt-2">{totalScore}</p>
                  </div>

                  <div className="border rounded-xl p-4 bg-[rgba(255,252,247,0.8)]">
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Directness</p>
                    <p className="text-2xl font-semibold mt-2">{policy.scores.directness_score}</p>
                    <p className="text-sm text-[var(--ink-soft)] mt-1">
                      How explicitly the policy targeted or affected Black communities.
                    </p>
                  </div>

                  <div className="border rounded-xl p-4 bg-[rgba(255,252,247,0.8)]">
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Material Impact</p>
                    <p className="text-2xl font-semibold mt-2">{policy.scores.material_impact_score}</p>
                    <p className="text-sm text-[var(--ink-soft)] mt-1">
                      The practical real-world effect on conditions, rights, or outcomes.
                    </p>
                  </div>

                  <div className="border rounded-xl p-4 bg-[rgba(255,252,247,0.8)]">
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Evidence</p>
                    <p className="text-2xl font-semibold mt-2">{policy.scores.evidence_score}</p>
                    <p className="text-sm text-[var(--ink-soft)] mt-1">
                      Strength of sourcing and historical support for the assessment.
                    </p>
                  </div>

                  <div className="border rounded-xl p-4 bg-[rgba(255,252,247,0.8)]">
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Durability</p>
                    <p className="text-2xl font-semibold mt-2">{policy.scores.durability_score}</p>
                    <p className="text-sm text-[var(--ink-soft)] mt-1">
                      How lasting the effects of the policy were over time.
                    </p>
                  </div>

                  <div className="border rounded-xl p-4 bg-[rgba(255,252,247,0.8)]">
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Equity</p>
                    <p className="text-2xl font-semibold mt-2">{policy.scores.equity_score}</p>
                    <p className="text-sm text-[var(--ink-soft)] mt-1">
                      Whether the policy advanced fairness, inclusion, or equal access.
                    </p>
                  </div>

                  <div className="border rounded-xl p-4 bg-[rgba(255,252,247,0.8)] md:col-span-2 xl:col-span-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Harm Offset</p>
                    <p className="text-2xl font-semibold mt-2">{policy.scores.harm_offset_score}</p>
                    <p className="text-sm text-[var(--ink-soft)] mt-1">
                      Any offsetting harms, limitations, exclusions, or contradictory effects that reduce the total.
                    </p>
                  </div>
                </div>

                {policy.scores.notes && (
                  <div className="mt-5 border-t pt-4">
                    <p className="text-sm text-[var(--ink-soft)]">
                      <strong>Scoring Notes:</strong> {policy.scores.notes}
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="card-surface rounded-[1.6rem] p-5">
            <h2 className="text-xl font-semibold mb-2">Metrics</h2>
            <div className="space-y-3">
              {policy.metrics.length === 0 && <p>No metrics added yet.</p>}
              {policy.metrics.map((metric, index) => (
                <div key={index} className="card-muted rounded-[1.25rem] p-4">
                  <p className="font-semibold text-lg">{metric.metric_name}</p>
                  <p className="text-sm text-[var(--ink-soft)] mt-1">
                    {metric.demographic_group} • {metric.geography ?? "N/A"}
                  </p>

                  <div className="grid gap-3 md:grid-cols-2 mt-4">
                    <div className="border rounded-lg p-3 bg-[rgba(255,252,247,0.8)]">
                      <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Before</p>
                      <p className="text-lg font-semibold">{metric.before_value ?? "N/A"}</p>
                      <p className="text-sm text-[var(--ink-soft)]">
                        {metric.year_before ?? "N/A"} {metric.unit ? `• ${metric.unit}` : ""}
                      </p>
                    </div>

                    <div className="border rounded-lg p-3 bg-[rgba(255,252,247,0.8)]">
                      <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">After</p>
                      <p className="text-lg font-semibold">{metric.after_value ?? "N/A"}</p>
                      <p className="text-sm text-[var(--ink-soft)]">
                        {metric.year_after ?? "N/A"} {metric.unit ? `• ${metric.unit}` : ""}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-sm text-[var(--ink-soft)]">
                    <strong>Methodology:</strong> {metric.methodology_note ?? "N/A"}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {policy.relationships && policy.relationships.length > 0 && (
            <section className="card-surface rounded-[1.6rem] p-5">
              <h2 className="text-xl font-semibold mb-2">Related Policies</h2>
              <p className="text-sm text-[var(--ink-soft)] mb-4">
                These relationships show how this policy connects to other laws, court decisions,
                or reforms over time.
              </p>

              <div className="space-y-3">
                {policy.relationships.map((relationship) => (
                  <div
                    key={relationship.id}
                    className="card-muted rounded-[1.25rem] p-4"
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-sm text-[var(--accent)] uppercase tracking-[0.16em]">
                          {formatRelationshipLabel(relationship.relationship_type)}
                        </p>

                        <Link
                          href={`/policies/${relationship.related_policy_id}`}
                          className="text-lg font-semibold underline"
                        >
                          {relationship.related_policy_title}
                        </Link>

                        <p className="text-sm text-[var(--ink-soft)] mt-1">
                          {relationship.related_policy_year} {" • "}
                          {relationship.related_policy_type} {" • "}
                          {relationship.related_policy_primary_party || "Unknown party"}
                        </p>

                        <p className="text-sm text-[var(--ink-soft)]">
                          {relationship.related_policy_era || "Unknown era"} {" • "}
                          {relationship.related_policy_impact_direction}
                        </p>
                      </div>

                      <span
                        className={`border rounded-full px-3 py-1 text-xs font-medium ${relationshipBadgeClasses(
                          relationship.relationship_type
                        )}`}
                      >
                        {formatRelationshipLabel(relationship.relationship_type)}
                      </span>
                    </div>

                    {relationship.notes && (
                      <p className="mt-3 text-sm text-[var(--ink-soft)]">
                        {relationship.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {policy.related_promises?.length > 0 && (
            <section className="card-surface rounded-[1.6rem] p-5">
              <h2 className="text-xl font-semibold mb-2">Related Promise Tracker</h2>
              <p className="text-sm text-[var(--ink-soft)] mb-4">
                This policy is referenced in tracked presidential promises. Use these records to
                see how the policy fits into a broader promise, action, and outcome chain.
              </p>

              <div className="space-y-3">
                {policy.related_promises.map((promise) => (
                  <div key={promise.id} className="card-muted rounded-[1.25rem] p-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
                          {promise.president}
                        </p>
                        <Link
                          href={`/promises/${promise.slug}`}
                          className="text-lg font-semibold underline mt-1 inline-block"
                        >
                          {promise.title}
                        </Link>
                      </div>
                      <PromiseStatusBadge status={promise.status} />
                    </div>

                    <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">
                      {promise.summary || "No summary added yet."}
                    </p>

                    <div className="flex flex-wrap gap-2 mt-4">
                      <PromiseMetaPill>
                        {promise.action_count} action{promise.action_count === 1 ? "" : "s"}
                      </PromiseMetaPill>
                      <PromiseMetaPill>
                        {promise.source_count} distinct source{promise.source_count === 1 ? "" : "s"}
                      </PromiseMetaPill>
                      {promise.latest_action_date ? (
                        <PromiseMetaPill>
                          Latest action: {formatDate(promise.latest_action_date)}
                        </PromiseMetaPill>
                      ) : null}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-4 text-sm">
                      <Link href={`/promises/${promise.slug}`} className="accent-link">
                        Open promise record
                      </Link>
                      <Link
                        href={`/promises/president/${promise.president_slug}`}
                        className="accent-link"
                      >
                        View presidency context
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {policy.related_future_bills?.length > 0 && (
            <section className="card-surface rounded-[1.6rem] p-5">
              <h2 className="text-xl font-semibold mb-2">Current Reform Connections</h2>
              <p className="text-sm text-[var(--ink-soft)] mb-4">
                These future-bill concepts are connected to this policy through shared explainers, then
                linked forward to real tracked bills and current legislator scorecards.
              </p>

              <div className="space-y-4">
                {policy.related_future_bills.map((bill) => (
                  <div key={bill.id} className="card-muted rounded-[1.25rem] p-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <h3 className="text-lg font-semibold">{bill.title}</h3>
                        <p className="text-sm text-[var(--ink-soft)] mt-1">
                          {[bill.target_area, bill.status].filter(Boolean).join(" • ")}
                        </p>
                      </div>
                      <span
                        className={`border rounded-full px-3 py-1 text-xs font-medium ${priorityClasses(
                          bill.priority_level
                        )}`}
                      >
                        {bill.priority_level}
                      </span>
                    </div>

                    {bill.problem_statement ? (
                      <p className="mt-3 text-sm text-[var(--ink-soft)] leading-7">
                        {bill.problem_statement}
                      </p>
                    ) : null}

                    {bill.linked_legislators?.length ? (
                      <div className="mt-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)] mb-2">
                          Linked Legislator Scorecards
                        </p>
                        <div className="grid gap-3 md:grid-cols-2">
                          {bill.linked_legislators.slice(0, 4).map((legislator) => (
                            <Link
                              key={`${bill.id}-legislator-${legislator.id}`}
                              href={`/scorecards/${legislator.id}`}
                              className="panel-link block rounded-xl p-3"
                            >
                              <div className="flex items-center justify-between gap-3 flex-wrap">
                                <div>
                                  <p className="font-medium text-sm">{legislator.full_name}</p>
                                  <p className="text-xs text-[var(--ink-soft)] mt-1">
                                    {[legislator.role, legislator.chamber, legislator.party, legislator.state]
                                      .filter(Boolean)
                                      .join(" • ")}
                                  </p>
                                </div>
                                <span className="text-xs text-[var(--ink-soft)]">
                                  Net Impact {formatImpactMetric(legislator.net_weighted_impact)}
                                </span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link
                        href={`/future-bills?focus=${bill.id}`}
                        className="text-sm font-medium accent-link hover:underline"
                      >
                        View in Future Bills
                      </Link>
                      {bill.tracked_bills?.[0]?.bill_url ? (
                        <a
                          href={bill.tracked_bills[0].bill_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium accent-link hover:underline"
                        >
                          View linked bill source
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {suggestedRelationships && suggestedRelationships.length > 0 && (
            <section className="card-surface rounded-[1.6rem] p-5">
              <h2 className="text-xl font-semibold mb-2">Suggested Relationships</h2>
              <p className="text-sm text-[var(--ink-soft)] mb-4">
                These policies may be related based on shared categories, era, and proximity in time.
              </p>

              <div className="space-y-3">
                {suggestedRelationships.map((suggested) => (
                  <div key={suggested.id} className="card-muted rounded-[1.25rem] p-4">
                    <Link
                      href={`/policies/${suggested.id}`}
                      className="text-lg font-semibold underline"
                    >
                      {suggested.title}
                    </Link>

                    <p className="text-sm text-[var(--ink-soft)] mt-1">
                      {suggested.year_enacted} {" • "}
                      {suggested.policy_type} {" • "}
                      {suggested.primary_party || "Unknown party"}
                    </p>

                    <p className="text-sm text-[var(--ink-soft)]">
                      {suggested.era || "Unknown era"} {" • "}
                      {suggested.impact_direction}
                    </p>

                    <p className="mt-2 text-sm text-[var(--ink-soft)]">
                      <strong>Shared Categories:</strong> {suggested.shared_category_count}
                      {" • "}
                      <strong>Year Distance:</strong> {suggested.year_distance}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="card-surface rounded-[1.6rem] p-5">
            <h2 className="text-xl font-semibold mb-2">Sources</h2>
            <div className="space-y-3">
              {policy.sources.length === 0 ? (
                <p className="text-sm text-[var(--ink-soft)]">
                  No source records are attached to this policy yet.
                </p>
              ) : (
                policy.sources.map((source, index) => (
                  <div key={index} className="card-muted rounded-[1.25rem] p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-semibold">{source.source_title}</p>
                        <p className="text-sm text-[var(--ink-soft)]">
                          {source.publisher || "Unknown publisher"} • {source.source_type}
                        </p>
                        {source.published_date && (
                          <p className="text-xs text-[var(--ink-soft)] mt-1">
                            Published: {formatDate(source.published_date)}
                          </p>
                        )}
                      </div>

                      <span className="border rounded-full px-3 py-1 text-xs font-medium">
                        {source.source_type}
                      </span>
                    </div>

                    {source.notes && (
                      <p className="mt-3 text-sm text-[var(--ink-soft)]">{source.notes}</p>
                    )}

                    {source.source_url ? (
                      <a
                        href={source.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block mt-3 underline text-sm"
                      >
                        View source
                      </a>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card-surface rounded-[1.6rem] p-5">
            <h2 className="text-lg font-semibold mb-3">Policy Details</h2>
            <div className="space-y-2 text-sm text-[var(--ink-soft)]">
              <p><strong>Year:</strong> {policy.year_enacted}</p>
              <p><strong>Type:</strong> {policy.policy_type}</p>
              <p><strong>Era:</strong> {policy.era || "Unknown"}</p>
              <p><strong>President:</strong> {policy.president || "Unknown"}</p>
              <p><strong>Primary Party:</strong> {formatPartyLabel(policy)}</p>
              <p><strong>Status:</strong> {policy.status}</p>
              <p><strong>Bipartisan:</strong> {policy.bipartisan ? "Yes" : "No"}</p>
              <p><strong>Direct Black Impact:</strong> {policy.direct_black_impact ? "Yes" : "No"}</p>
            </div>
          </section>

          <section className="card-surface rounded-[1.6rem] p-5">
            <h2 className="text-lg font-semibold mb-3">Policy Snapshot</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <StatCard
                title="Impact Score"
                value={totalScore ?? "N/A"}
                subtitle={totalScore !== null ? interpretImpactScore(totalScore) : "Composite score based on scoring factors below."}
              />
              <StatCard title="Categories" value={categoryCount} />
              <StatCard title="Sources" value={sourceCount} />
              <StatCard title="Metrics" value={metricCount} />
            </div>
          </section>

          <section className="card-surface rounded-[1.6rem] p-5">
            <h2 className="text-lg font-semibold mb-3">Used in Explainers</h2>

            {policy.related_explainers?.length ? (
              <div className="space-y-4">
                {policy.related_explainers.map((explainer) => (
                  <Link
                    key={explainer.id}
                    href={`/explainers/${explainer.slug}`}
                    className="panel-link block rounded-[1.35rem] p-4"
                  >
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)] mb-2">
                      {explainer.category || "Explainer"}
                    </p>

                    <h3 className="font-semibold">{explainer.title}</h3>

                    {explainer.summary && (
                      <p className="text-sm text-[var(--ink-soft)] mt-2 line-clamp-3">
                        {explainer.summary}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-[var(--ink-soft)]">No explainers linked yet.</p>
            )}
          </section>
          
          {policy.evidence_summary && (
            <section className="card-surface rounded-[1.6rem] p-5">
              <h2 className="text-lg font-semibold mb-3">Evidence Strength</h2>
              <div className="space-y-2 text-sm text-[var(--ink-soft)]">
                <p><strong>Rating:</strong> {policy.evidence_summary.evidence_strength}</p>
                <p><strong>Total Sources:</strong> {policy.evidence_summary.total_sources}</p>
                <p><strong>Government Sources:</strong> {policy.evidence_summary.government_sources}</p>
                <p><strong>Academic Sources:</strong> {policy.evidence_summary.academic_sources}</p>
                <p><strong>Archive Sources:</strong> {policy.evidence_summary.archive_sources}</p>
              </div>
              {sourceTypes.length > 0 && (
                <p className="mt-2 text-sm text-[var(--ink-soft)]"><strong>Source Types Used:</strong> {sourceTypes.join(", ")}</p>
              )}
              {policy.source_mix_summary?.newest_source_date && (
                <p className="mt-2 text-sm text-[var(--ink-soft)]"><strong>Newest Source Date:</strong> {formatDate(policy.source_mix_summary.newest_source_date)}</p>
              )}
            </section>
          )}

          {policy.completeness_summary && (
            <section className="card-surface rounded-[1.6rem] p-5">
              <h2 className="text-lg font-semibold mb-3">Data Completeness</h2>
              <div className="space-y-2 text-sm text-[var(--ink-soft)]">
                <p><strong>Status:</strong> {policy.completeness_summary.status}</p>
                <p><strong>Has Scores:</strong> {policy.completeness_summary.has_scores ? "Yes" : "No"}</p>
                <p><strong>Has Metrics:</strong> {policy.completeness_summary.has_metrics ? "Yes" : "No"}</p>
                <p><strong>Total Sources:</strong> {policy.completeness_summary.total_sources}</p>
              </div>
            </section>
          )}

          {policy.era_navigation && (policy.era_navigation.previous || policy.era_navigation.next) && (
            <section className="card-surface rounded-[1.6rem] p-5">
              <h2 className="text-lg font-semibold mb-3">More in This Era</h2>
              <div className="space-y-3">
                {policy.era_navigation.previous ? (
                  <Link
                    href={`/policies/${policy.era_navigation.previous.id}`}
                    className="panel-link block rounded-[1.25rem] p-4"
                  >
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Previous in era</p>
                    <p className="font-semibold mt-1">{policy.era_navigation.previous.title}</p>
                    <p className="text-sm text-[var(--ink-soft)] mt-1">{policy.era_navigation.previous.year_enacted}</p>
                  </Link>
                ) : null}
                {policy.era_navigation.next ? (
                  <Link
                    href={`/policies/${policy.era_navigation.next.id}`}
                    className="panel-link block rounded-[1.25rem] p-4"
                  >
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Next in era</p>
                    <p className="font-semibold mt-1">{policy.era_navigation.next.title}</p>
                    <p className="text-sm text-[var(--ink-soft)] mt-1">{policy.era_navigation.next.year_enacted}</p>
                  </Link>
                ) : null}
              </div>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
