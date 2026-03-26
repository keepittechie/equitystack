import Link from "next/link";
import { notFound } from "next/navigation";
import { buildPageMetadata } from "@/lib/metadata";
import { getLegislatorDetail } from "@/lib/services/scorecardService";

async function loadLegislator(id) {
  return getLegislatorDetail(id);
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const legislator = await loadLegislator(id);

  if (!legislator) {
    return buildPageMetadata({
      title: "Legislator Not Found",
      description: "The requested legislator scorecard could not be found.",
      path: `/scorecards/${id}`,
    });
  }

  return buildPageMetadata({
    title: legislator.full_name,
    description:
      `Review tracked bill roles and future-bill positions for ${legislator.full_name} on EquityStack.`,
    path: `/scorecards/${id}`,
  });
}

function Pill({ children }) {
  return (
    <span className="border rounded-full px-3 py-1 text-xs bg-[rgba(255,252,247,0.82)] text-[var(--ink-soft)]">
      {children}
    </span>
  );
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

function formatMetric(value) {
  return Number(value || 0).toFixed(2);
}

function priorityLabel(rank) {
  switch (Number(rank || 0)) {
    case 4:
      return "Critical";
    case 3:
      return "High";
    case 2:
      return "Medium";
    case 1:
      return "Low";
    default:
      return "Unranked";
  }
}

function impactBadgeClasses(impact) {
  switch (impact) {
    case "Positive":
      return "bg-green-50 text-green-700 border-green-200";
    case "Negative":
      return "bg-red-50 text-red-700 border-red-200";
    case "Mixed":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "Blocked":
      return "bg-stone-100 text-stone-700 border-stone-300";
    default:
      return "bg-stone-100 text-stone-700 border-stone-300";
  }
}

function computePercentile(rank, total) {
  const safeRank = Number(rank || 0);
  const safeTotal = Number(total || 0);
  if (!safeRank || !safeTotal) return null;
  return Math.max(0, Math.round(((safeTotal - safeRank + 1) / safeTotal) * 100));
}

function rankingBand(percentile) {
  if (percentile === null) return "Unranked";
  if (percentile >= 90) return "Top 10%";
  if (percentile >= 75) return "Top Quartile";
  if (percentile >= 50) return "Upper Half";
  if (percentile >= 25) return "Lower Half";
  return "Bottom Quartile";
}

export default async function LegislatorScorecardDetailPage({ params }) {
  const { id } = await params;
  const legislator = await loadLegislator(id);

  if (!legislator) {
    notFound();
  }

  const overallPercentile = computePercentile(
    legislator.ranking?.overall_rank,
    legislator.ranking?.total_ranked
  );
  const chamberPercentile = computePercentile(
    legislator.ranking?.chamber_rank,
    legislator.ranking?.chamber_total
  );
  const partyPercentile = computePercentile(
    legislator.ranking?.party_rank,
    legislator.ranking?.party_total
  );

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-10">
      <Link href="/scorecards" className="text-sm underline">
        Back to scorecards
      </Link>

      <section className="hero-panel p-8 md:p-10">
        <p className="eyebrow mb-4">Legislator Record</p>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">{legislator.full_name}</h1>
        <p className="text-[var(--ink-soft)] text-lg max-w-3xl leading-8 mt-4">
          {[legislator.chamber, legislator.party, legislator.state].filter(Boolean).join(" • ")}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Pill>Net Impact: {formatMetric(legislator.net_weighted_impact)}</Pill>
          <Pill>Avg Bill Score: {formatMetric(legislator.avg_policy_impact_score)}</Pill>
          <Pill>Primary Sponsor: {legislator.sponsored_bill_count ?? legislator.primary_sponsor_roles}</Pill>
          <Pill>Cosponsor: {legislator.cosponsored_bill_count ?? legislator.cosponsor_roles}</Pill>
          <Pill>Band: {rankingBand(overallPercentile)}</Pill>
          <Pill>Future Bills: {legislator.future_bill_count}</Pill>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <section className="card-surface rounded-[1.6rem] p-6 space-y-4">
            <div>
              <h2 className="text-2xl font-semibold">Current Snapshot</h2>
              <p className="text-sm text-[var(--ink-soft)] mt-1">
                Weighted from current tracked reform bills, sponsorship role strength, future-bill
                priority, and how far each bill has advanced.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="metric-card p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Net Impact</p>
                <p className="text-2xl font-bold mt-2">{formatMetric(legislator.net_weighted_impact)}</p>
              </div>
              <div className="metric-card p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Avg Bill Score</p>
                <p className="text-2xl font-bold mt-2">{formatMetric(legislator.avg_policy_impact_score)}</p>
              </div>
              <div className="metric-card p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Tracked Bills</p>
                <p className="text-2xl font-bold mt-2">{legislator.total_tracked_bills ?? legislator.total_roles}</p>
              </div>
              <div className="metric-card p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Direct Impact Bills</p>
                <p className="text-2xl font-bold mt-2">{legislator.direct_black_impact_bill_count || 0}</p>
              </div>
            </div>

            {legislator.ranking ? (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="card-muted rounded-[1.25rem] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Overall Rank</p>
                  <p className="text-2xl font-bold mt-2">
                    #{legislator.ranking.overall_rank || "-"}
                    <span className="text-sm font-normal text-[var(--ink-soft)]">
                      {" "}/ {legislator.ranking.total_ranked || 0}
                    </span>
                  </p>
                  <p className="text-sm text-[var(--ink-soft)] mt-2">
                    {rankingBand(overallPercentile)}
                    {overallPercentile !== null ? ` • ${overallPercentile}th percentile` : ""}
                  </p>
                </div>
                <div className="card-muted rounded-[1.25rem] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Chamber Rank</p>
                  <p className="text-2xl font-bold mt-2">
                    #{legislator.ranking.chamber_rank || "-"}
                    <span className="text-sm font-normal text-[var(--ink-soft)]">
                      {" "}/ {legislator.ranking.chamber_total || 0}
                    </span>
                  </p>
                  <p className="text-sm text-[var(--ink-soft)] mt-2">
                    {chamberPercentile !== null ? `${chamberPercentile}th percentile in ${legislator.chamber}` : "No chamber comparison"}
                  </p>
                </div>
                <div className="card-muted rounded-[1.25rem] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Party Rank</p>
                  <p className="text-2xl font-bold mt-2">
                    #{legislator.ranking.party_rank || "-"}
                    <span className="text-sm font-normal text-[var(--ink-soft)]">
                      {" "}/ {legislator.ranking.party_total || 0}
                    </span>
                  </p>
                  <p className="text-sm text-[var(--ink-soft)] mt-2">
                    {partyPercentile !== null ? `${partyPercentile}th percentile in ${legislator.party || "Unknown party"}` : "No party comparison"}
                  </p>
                </div>
              </div>
            ) : null}

            {legislator.score_notes ? (
              <p className="text-sm text-[var(--ink-soft)] leading-7">{legislator.score_notes}</p>
            ) : null}
          </section>

          <section className="card-surface rounded-[1.6rem] p-6 space-y-4">
            <div>
              <h2 className="text-2xl font-semibold">Tracked Bill Roles</h2>
              <p className="text-sm text-[var(--ink-soft)] mt-1">
                Bills this legislator is linked to as a sponsor or cosponsor in the currently loaded scorecard data.
              </p>
            </div>

            <div className="space-y-3">
              {legislator.tracked_bill_roles.length === 0 ? (
                <p>No tracked bill roles loaded yet.</p>
              ) : (
                legislator.tracked_bill_roles.map((role, index) => (
                  <a
                    key={`${role.tracked_bill_id}-${role.role}-${index}`}
                    href={role.bill_url || "#"}
                    target={role.bill_url ? "_blank" : undefined}
                    rel={role.bill_url ? "noopener noreferrer" : undefined}
                    className="panel-link block rounded-[1.35rem] p-4"
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="max-w-3xl">
                        <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
                          {role.role}
                        </p>
                        <h3 className="text-lg font-semibold mt-1">
                          {role.bill_number} - {role.title}
                        </h3>
                        <p className="text-sm text-[var(--ink-soft)] mt-1">
                          {[role.chamber, role.session_label, role.bill_status].filter(Boolean).join(" • ")}
                        </p>
                      </div>
                      {role.latest_action_date ? (
                        <Pill>Latest Action: {formatDate(role.latest_action_date)}</Pill>
                      ) : null}
                    </div>
                  </a>
                ))
              )}
            </div>
          </section>

          <section className="card-surface rounded-[1.6rem] p-6 space-y-4">
            <div>
              <h2 className="text-2xl font-semibold">Future Bill Positions</h2>
              <p className="text-sm text-[var(--ink-soft)] mt-1">
                Future-bill concepts connected to this legislator through the linked tracked legislation.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {legislator.future_bill_positions.length === 0 ? (
                <p>No future-bill positions loaded yet.</p>
              ) : (
                legislator.future_bill_positions.map((position, index) => (
                  <Link
                    key={`${position.future_bill_id}-${position.position_type}-${index}`}
                    href={`/future-bills?focus=${position.future_bill_id}`}
                    className="panel-link block rounded-[1.35rem] p-4"
                  >
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
                      {position.position_type}
                    </p>
                    <h3 className="text-lg font-semibold mt-1">{position.title}</h3>
                    <p className="text-sm text-[var(--ink-soft)] mt-1">
                      {[position.target_area, position.priority_level, position.status]
                        .filter(Boolean)
                        .join(" • ")}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </section>

          <section className="card-surface rounded-[1.6rem] p-6 space-y-4">
            <div>
              <h2 className="text-2xl font-semibold">Issue Area Focus</h2>
              <p className="text-sm text-[var(--ink-soft)] mt-1">
                Where this legislator&apos;s currently tracked reform-bill activity is concentrated.
              </p>
            </div>

            {legislator.issue_area_breakdown?.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {legislator.issue_area_breakdown.map((area) => (
                  <div key={area.target_area} className="card-muted rounded-[1.25rem] p-4 space-y-3">
                    <div>
                      <h3 className="text-lg font-semibold">{area.target_area}</h3>
                      <p className="text-sm text-[var(--ink-soft)] mt-1">
                        Highest linked priority: {priorityLabel(area.highest_priority_rank)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Pill>Future Bills: {area.future_bill_count}</Pill>
                      <Pill>Sponsor: {area.sponsor_count}</Pill>
                      <Pill>Cosponsor: {area.cosponsor_count}</Pill>
                      <Pill>Critical: {area.critical_count}</Pill>
                      <Pill>High: {area.high_count}</Pill>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p>No issue-area clustering is available yet for this legislator.</p>
            )}
          </section>

          <section className="card-surface rounded-[1.6rem] p-6 space-y-4">
            <div>
              <h2 className="text-2xl font-semibold">Related Explainers</h2>
              <p className="text-sm text-[var(--ink-soft)] mt-1">
                Explainers connected to this legislator through the future-bill concepts linked to their tracked activity.
              </p>
            </div>

            {legislator.related_explainers?.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {legislator.related_explainers.map((explainer) => (
                  <Link
                    key={explainer.id}
                    href={`/explainers/${explainer.slug}`}
                    className="panel-link block rounded-[1.25rem] p-4"
                  >
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
                      {explainer.category || "Explainer"}
                    </p>
                    <h3 className="text-lg font-semibold mt-1">{explainer.title}</h3>
                    {explainer.summary ? (
                      <p className="text-sm text-[var(--ink-soft)] mt-2 line-clamp-3">
                        {explainer.summary}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Pill>Linked Future Bills: {explainer.linked_future_bill_count}</Pill>
                      <Pill>Highest Priority: {priorityLabel(explainer.highest_priority_rank)}</Pill>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p>No explainers are connected to this legislator yet.</p>
            )}
          </section>

          <section className="card-surface rounded-[1.6rem] p-6 space-y-4">
            <div>
              <h2 className="text-2xl font-semibold">Related Policies</h2>
              <p className="text-sm text-[var(--ink-soft)] mt-1">
                Policy records reached through the explainers and future-bill concepts tied to this legislator.
              </p>
            </div>

            {legislator.related_policies?.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {legislator.related_policies.map((policy) => (
                  <Link
                    key={policy.id}
                    href={`/policies/${policy.id}`}
                    className="panel-link block rounded-[1.25rem] p-4"
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <h3 className="text-lg font-semibold">{policy.title}</h3>
                        <p className="text-sm text-[var(--ink-soft)] mt-1">
                          {[policy.year_enacted, policy.policy_type, policy.primary_party || "No Primary Party"]
                            .filter(Boolean)
                            .join(" • ")}
                        </p>
                        <p className="text-sm text-[var(--ink-soft)]">
                          {policy.era || "Unknown era"}
                        </p>
                      </div>
                      <span
                        className={`border rounded-full px-3 py-1 text-xs font-medium ${impactBadgeClasses(
                          policy.impact_direction
                        )}`}
                      >
                        {policy.impact_direction || "Unknown"}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Pill>Linked Future Bills: {policy.linked_future_bill_count}</Pill>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p>No policy records are connected to this legislator yet.</p>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card-surface rounded-[1.6rem] p-5">
            <h2 className="text-lg font-semibold mb-3">Profile Snapshot</h2>
            <div className="space-y-2 text-sm text-[var(--ink-soft)]">
              <p><strong>Name:</strong> {legislator.full_name}</p>
              <p><strong>Chamber:</strong> {legislator.chamber}</p>
              <p><strong>Party:</strong> {legislator.party || "Unknown"}</p>
              <p><strong>State:</strong> {legislator.state || "Unknown"}</p>
              <p><strong>Status:</strong> {legislator.status}</p>
              <p><strong>Snapshot Label:</strong> {legislator.snapshot_label || "Not computed"}</p>
              <p><strong>Window Start:</strong> {formatDate(legislator.scoring_window_start) || "Unknown"}</p>
              <p><strong>Window End:</strong> {formatDate(legislator.scoring_window_end) || "Unknown"}</p>
            </div>
          </section>

          <section className="card-surface rounded-[1.6rem] p-5">
            <h2 className="text-lg font-semibold mb-3">Coverage</h2>
            <div className="grid gap-4">
              <div className="metric-card p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Tracked Bills</p>
                <p className="text-2xl font-bold mt-2">{legislator.total_tracked_bills ?? legislator.total_roles}</p>
              </div>
              <div className="metric-card p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Primary Sponsorships</p>
                <p className="text-2xl font-bold mt-2">{legislator.sponsored_bill_count ?? legislator.primary_sponsor_roles}</p>
              </div>
              <div className="metric-card p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Future Bill Links</p>
                <p className="text-2xl font-bold mt-2">{legislator.future_bill_count}</p>
              </div>
              <div className="metric-card p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Blocked Bills</p>
                <p className="text-2xl font-bold mt-2">{legislator.blocked_bill_count || 0}</p>
              </div>
              <div className="metric-card p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Negative Bills</p>
                <p className="text-2xl font-bold mt-2">{legislator.negative_bill_count || 0}</p>
              </div>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
