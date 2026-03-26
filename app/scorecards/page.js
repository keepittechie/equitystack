import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import { getLegislatorDirectory, getScorecardOverview } from "@/lib/services/scorecardService";

export const metadata = buildPageMetadata({
  title: "Legislator Scorecards",
  description:
    "Preview EquityStack's planned legislator scorecards, designed to connect members of Congress to the bills they sponsor, cosponsor, and advance.",
  path: "/scorecards",
});

function Pill({ children }) {
  return (
    <span className="border rounded-full px-3 py-1 text-xs bg-[rgba(255,252,247,0.82)] text-[var(--ink-soft)]">
      {children}
    </span>
  );
}

function SectionCard({ title, children }) {
  return (
    <section className="card-surface rounded-[1.6rem] p-6 space-y-4">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <div className="text-[var(--ink-soft)] leading-7 space-y-3">{children}</div>
    </section>
  );
}

function formatMetric(value) {
  return Number(value || 0).toFixed(2);
}

function sortLegislators(rows, sortBy) {
  const sorted = [...rows];

  sorted.sort((left, right) => {
    if (sortBy === "impact") {
      return (
        Number(right.net_weighted_impact || 0) - Number(left.net_weighted_impact || 0) ||
        Number(right.primary_sponsor_roles || 0) - Number(left.primary_sponsor_roles || 0) ||
        left.full_name.localeCompare(right.full_name)
      );
    }

    if (sortBy === "primary") {
      return (
        Number(right.primary_sponsor_roles || 0) - Number(left.primary_sponsor_roles || 0) ||
        left.full_name.localeCompare(right.full_name)
      );
    }

    if (sortBy === "future") {
      return (
        Number(right.future_bill_count || 0) - Number(left.future_bill_count || 0) ||
        left.full_name.localeCompare(right.full_name)
      );
    }

    if (sortBy === "name") {
      return left.full_name.localeCompare(right.full_name);
    }

    return (
      Number(right.total_roles || 0) - Number(left.total_roles || 0) ||
      left.full_name.localeCompare(right.full_name)
    );
  });

  return sorted;
}

export default async function ScorecardsPage({ searchParams }) {
  const overview = await getScorecardOverview();
  const legislators = await getLegislatorDirectory();
  const resolvedSearchParams = await searchParams;
  const query = (resolvedSearchParams?.q || "").trim().toLowerCase();
  const chamber = resolvedSearchParams?.chamber || "All";
  const party = resolvedSearchParams?.party || "All";
  const sortBy = resolvedSearchParams?.sort || "impact";

  const filteredLegislators = sortLegislators(
    legislators.filter((legislator) => {
      if (chamber !== "All" && legislator.chamber !== chamber) return false;
      if (party !== "All" && legislator.party !== party) return false;

      if (!query) return true;

      return [legislator.full_name, legislator.party, legislator.state, legislator.chamber]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    }),
    sortBy
  );

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-10">
      <section className="hero-panel p-8 md:p-10">
        <p className="eyebrow mb-4">Accountability Layer</p>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          Legislator Scorecards
        </h1>
        <p className="text-[var(--ink-soft)] text-lg max-w-3xl leading-8 mt-4">
          EquityStack now connects members of Congress to the reform bills they sponsor and
          cosponsor, then turns that activity into a weighted snapshot. The goal is not to
          produce campaign-style ratings, but to make legislative patterns easier to inspect.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Core Entity</p>
          <p className="text-2xl font-bold mt-3">{overview.total_legislators || 0}</p>
          <p className="text-sm text-[var(--ink-soft)] mt-2">Legislator records loaded so far.</p>
        </div>
        <div className="metric-card p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Primary Inputs</p>
          <p className="text-2xl font-bold mt-3">{overview.total_roles || 0}</p>
          <p className="text-sm text-[var(--ink-soft)] mt-2">Tracked sponsor and cosponsor roles linked to bills.</p>
        </div>
        <div className="metric-card p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Snapshot Coverage</p>
          <p className="text-2xl font-bold mt-3">{overview.total_snapshots || 0}</p>
          <p className="text-sm text-[var(--ink-soft)] mt-2">Legislators with a computed current scorecard snapshot.</p>
        </div>
        <div className="metric-card p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Snapshot Mean</p>
          <p className="text-2xl font-bold mt-3">{Number(overview.avg_net_weighted_impact || 0).toFixed(2)}</p>
          <p className="text-sm text-[var(--ink-soft)] mt-2">Average current weighted impact across scored legislators.</p>
        </div>
      </section>

      {overview.top_legislators?.length ? (
        <SectionCard title="Current Coverage Preview">
          <p>
            These are the strongest current snapshot records based on weighted tracked-bill activity,
            not just raw role counts.
          </p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {overview.top_legislators.map((legislator) => (
              <div
                key={legislator.id}
                className="card-muted rounded-[1.3rem] p-4"
              >
                <h3 className="text-lg font-semibold">{legislator.full_name}</h3>
                <p className="text-sm text-[var(--ink-soft)] mt-1">
                  {[legislator.chamber, legislator.party, legislator.state].filter(Boolean).join(" • ")}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Pill>Net Impact: {Number(legislator.net_weighted_impact || 0).toFixed(2)}</Pill>
                  <Pill>Avg Bill Score: {Number(legislator.avg_policy_impact_score || 0).toFixed(2)}</Pill>
                  <Pill>Primary Sponsor: {legislator.primary_sponsor_roles}</Pill>
                  <Pill>Blocked Bills: {legislator.blocked_bill_count || 0}</Pill>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="By Chamber">
          <p>
            This comparison looks at average current snapshot strength within each chamber, so users
            can see where the strongest tracked reform-bill activity is clustering.
          </p>
          <div className="grid gap-4">
            {(overview.chamber_summary || []).map((row) => (
              <div key={row.name} className="card-muted rounded-[1.3rem] p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-lg font-semibold">{row.name}</h3>
                    <p className="text-sm text-[var(--ink-soft)] mt-1">
                      {row.legislator_count} legislators with scorecard coverage
                    </p>
                  </div>
                  <Pill>Avg Net Impact: {formatMetric(row.avg_net_weighted_impact)}</Pill>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Pill>Avg Bill Score: {formatMetric(row.avg_policy_impact_score)}</Pill>
                  <Pill>Tracked Bills: {row.total_tracked_bills || 0}</Pill>
                  <Pill>Primary Sponsors: {row.sponsored_bill_count || 0}</Pill>
                  <Pill>Direct Impact Bills: {row.direct_black_impact_bill_count || 0}</Pill>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="By Party">
          <p>
            Party comparisons are descriptive of the currently loaded reform-bill dataset, not a claim
            that party labels mean the same thing in every period or setting.
          </p>
          <div className="grid gap-4">
            {(overview.party_summary || []).map((row) => (
              <div key={row.name} className="card-muted rounded-[1.3rem] p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-lg font-semibold">{row.name}</h3>
                    <p className="text-sm text-[var(--ink-soft)] mt-1">
                      {row.legislator_count} legislators with scorecard coverage
                    </p>
                  </div>
                  <Pill>Avg Net Impact: {formatMetric(row.avg_net_weighted_impact)}</Pill>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Pill>Avg Bill Score: {formatMetric(row.avg_policy_impact_score)}</Pill>
                  <Pill>Tracked Bills: {row.total_tracked_bills || 0}</Pill>
                  <Pill>Primary Sponsors: {row.sponsored_bill_count || 0}</Pill>
                  <Pill>Direct Impact Bills: {row.direct_black_impact_bill_count || 0}</Pill>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Browse Legislators">
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-5" method="GET">
          <label className="block xl:col-span-2">
            <span className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Search</span>
            <input
              type="search"
              name="q"
              defaultValue={resolvedSearchParams?.q || ""}
              placeholder="Search by name, party, state, or chamber"
              className="mt-2 w-full border rounded-xl px-3 py-2 bg-[rgba(255,252,247,0.88)]"
            />
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Chamber</span>
            <select
              name="chamber"
              defaultValue={chamber}
              className="mt-2 w-full border rounded-xl px-3 py-2 bg-[rgba(255,252,247,0.88)]"
            >
              <option value="All">All chambers</option>
              <option value="House">House</option>
              <option value="Senate">Senate</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Party</span>
            <select
              name="party"
              defaultValue={party}
              className="mt-2 w-full border rounded-xl px-3 py-2 bg-[rgba(255,252,247,0.88)]"
            >
              <option value="All">All parties</option>
              <option value="Democratic">Democratic</option>
              <option value="Republican">Republican</option>
              <option value="Independent">Independent</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Sort</span>
            <select
              name="sort"
              defaultValue={sortBy}
              className="mt-2 w-full border rounded-xl px-3 py-2 bg-[rgba(255,252,247,0.88)]"
            >
              <option value="impact">Highest impact</option>
              <option value="roles">Most roles</option>
              <option value="primary">Most primary sponsorships</option>
              <option value="future">Most future-bill links</option>
              <option value="name">Name</option>
            </select>
          </label>
        </form>

        <div className="flex flex-wrap gap-2 text-xs text-[var(--ink-soft)]">
          <Pill>Results: {filteredLegislators.length}</Pill>
          <Pill>House: {overview.house_legislators || 0}</Pill>
          <Pill>Senate: {overview.senate_legislators || 0}</Pill>
          <Pill>Future-Bill Positions: {overview.total_future_positions || 0}</Pill>
          <Pill>Scored Snapshots: {overview.total_snapshots || 0}</Pill>
        </div>

        {filteredLegislators.length === 0 ? (
          <p>No legislators match the current filters.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredLegislators.map((legislator) => (
              <Link
                key={legislator.id}
                href={`/scorecards/${legislator.id}`}
                className="panel-link block rounded-[1.45rem] p-5"
              >
                <h3 className="text-xl font-semibold">{legislator.full_name}</h3>
                <p className="text-sm text-[var(--ink-soft)] mt-1">
                  {[legislator.chamber, legislator.party, legislator.state].filter(Boolean).join(" • ")}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Pill>Net Impact: {Number(legislator.net_weighted_impact || 0).toFixed(2)}</Pill>
                  <Pill>Avg Bill Score: {Number(legislator.avg_policy_impact_score || 0).toFixed(2)}</Pill>
                  <Pill>Primary Sponsor: {legislator.sponsored_bill_count ?? legislator.primary_sponsor_roles}</Pill>
                  <Pill>Tracked Bills: {legislator.total_tracked_bills ?? legislator.total_roles}</Pill>
                </div>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="What the Scorecards Will Show">
        <p>
          The scorecards are meant to help users see which legislators repeatedly attach themselves
          to bills that help, harm, block, or leave unresolved major equity issues affecting Black Americans.
        </p>
        <div className="flex flex-wrap gap-2">
          <Pill>Sponsorship history</Pill>
          <Pill>Cosponsorship patterns</Pill>
          <Pill>Issue-area concentration</Pill>
          <Pill>Positive vs negative bill mix</Pill>
          <Pill>Future-bill advocacy</Pill>
          <Pill>Evidence-backed notes</Pill>
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="How Scoring Works">
          <p>
            The current scorecard snapshot is built from the tracked reform-bill layer, not from every
            bill in Congress. Each linked bill gets a weighted score, and each legislator inherits that
            score based on role strength and how far the bill advanced.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="card-muted rounded-[1.25rem] p-4">
              <h3 className="text-base font-semibold text-[var(--ink)]">Role Weight</h3>
              <p className="mt-2 text-sm leading-7">
                Primary sponsors count more than cosponsors because they are more directly responsible
                for moving a proposal.
              </p>
            </div>
            <div className="card-muted rounded-[1.25rem] p-4">
              <h3 className="text-base font-semibold text-[var(--ink)]">Priority Weight</h3>
              <p className="mt-2 text-sm leading-7">
                Bills linked to critical or high-priority EquityStack proposals contribute more than
                lower-priority items.
              </p>
            </div>
            <div className="card-muted rounded-[1.25rem] p-4">
              <h3 className="text-base font-semibold text-[var(--ink)]">Progress Weight</h3>
              <p className="mt-2 text-sm leading-7">
                Bills that advance beyond introduction receive more credit than proposals that never move.
              </p>
            </div>
            <div className="card-muted rounded-[1.25rem] p-4">
              <h3 className="text-base font-semibold text-[var(--ink)]">Current Scope</h3>
              <p className="mt-2 text-sm leading-7">
                These snapshots describe the reform-bill dataset currently loaded into EquityStack, not
                a complete historical record of every officeholder.
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Interpretation Guardrails">
          <p>
            These scorecards are meant to support inspection, not replace judgment. A higher score means
            a legislator is attached to more high-priority tracked reform bills that appear to have advanced
            further in the legislative process.
          </p>
          <p>
            It does not mean the legislator has a complete positive record across all issue areas, and it
            does not capture off-record advocacy, amendments, or every committee action yet. Users should
            still review the linked bills and future-bill concepts directly.
          </p>
          <div className="flex flex-wrap gap-2">
            <Pill>Descriptive, not an endorsement</Pill>
            <Pill>Dataset-limited</Pill>
            <Pill>Bill-level evidence first</Pill>
            <Pill>Open to future refinement</Pill>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Design Direction">
          <p>
            Each legislator page should read more like a dossier than a campaign scorecard. It should lead with the
            member&apos;s core role and issue areas, then show the actual bills and proposals driving the result.
          </p>
          <p>
            The page design should support fast scanning:
            leadership summary, bill mix, linked policy records, future-bill involvement, and a traceable evidence trail.
          </p>
        </SectionCard>

        <SectionCard title="Methodology Guardrails">
          <p>
            This should not become a vague endorsement engine. EquityStack is stronger when it shows the record,
            explains the rules, and lets users examine the underlying bills directly.
          </p>
          <div className="flex flex-wrap gap-2">
            <Pill>No hidden scoring weights</Pill>
            <Pill>No unsupported labels</Pill>
            <Pill>Separate sponsor and cosponsor roles</Pill>
            <Pill>Track time period and chamber</Pill>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Schema Foundation">
        <p>
          I added a first schema draft at <code>database/legislator_scorecards_schema.sql</code> to
          support legislator records, bill positions, future-bill advocacy links, and precomputed
          score snapshots.
        </p>
        <p>
          That schema is designed so we can join legislators to your tracked bills and future-bill concepts without
          polluting the existing policy tables.
        </p>
      </SectionCard>

      <SectionCard title="Implementation Sequence">
        <p>Recommended next steps after this pass:</p>
        <div className="flex flex-wrap gap-2">
          <Pill>1. Compute score snapshots</Pill>
          <Pill>2. Add legislator search APIs</Pill>
          <Pill>3. Add policy-score rollups</Pill>
          <Pill>4. Add legislator future-bill notes</Pill>
          <Pill>5. Add true scorecard rankings</Pill>
        </div>
      </SectionCard>
    </main>
  );
}
