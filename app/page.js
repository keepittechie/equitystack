import Link from "next/link";
import { fetchInternalJson } from "@/lib/api";
import { REPORT_REVALIDATE_SECONDS, withRevalidate } from "@/lib/cache";
import { buildPageMetadata } from "@/lib/metadata";
import { buildSiteJsonLd, serializeJsonLd } from "@/lib/structured-data";

export const metadata = buildPageMetadata({
  title: "EquityStack",
  description:
    "Track how U.S. laws, court cases, executive actions, and proposed reforms have helped, harmed, or failed Black Americans over time.",
  path: "/",
});

async function getJson(url) {
  return fetchInternalJson(url, withRevalidate(REPORT_REVALIDATE_SECONDS));
}

function sumTotals(rows, key = "total") {
  return rows.reduce((sum, row) => sum + Number(row[key] || 0), 0);
}

function CompactStat({ label, value }) {
  return (
    <div className="metric-card px-4 py-4">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">{label}</p>
      <p className="text-2xl font-bold mt-3">{value}</p>
    </div>
  );
}

function GuidedStep({ step, title, description, href, linkLabel }) {
  return (
    <div className="panel-link rounded-[1.35rem] p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">{step}</p>
      <h3 className="text-lg font-semibold mt-3">{title}</h3>
      <p className="text-sm text-[var(--ink-soft)] mt-2 leading-6">{description}</p>
      {href && linkLabel ? (
        <Link href={href} className="accent-link text-sm inline-block mt-4">
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}

function SectionCard({ title, href, linkLabel, children }) {
  return (
    <section className="card-surface rounded-[1.6rem] p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="text-2xl font-semibold">{title}</h2>
        {href && linkLabel ? (
          <Link href={href} className="text-sm accent-link">
            {linkLabel}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function FlagshipViewCard({ eyebrow, title, description, href, linkLabel }) {
  return (
    <Link href={href} className="panel-link block rounded-[1.4rem] p-5">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">{eyebrow}</p>
      <h3 className="text-lg font-semibold mt-3">{title}</h3>
      <p className="text-sm text-[var(--ink-soft)] mt-2 leading-6">{description}</p>
      <span className="accent-link text-sm inline-block mt-4">{linkLabel}</span>
    </Link>
  );
}

function categoryClasses(category) {
  switch (category) {
    case "Politics":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "Housing":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Economics":
    case "Economic Opportunity":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "Education":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "Criminal Justice":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-gray-50 text-gray-700 border-gray-200";
  }
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

export default async function HomePage() {
  const [byParty, byEra, futureBills, topPolicies, featuredExplainers] = await Promise.all([
    getJson("/api/reports/by-party"),
    getJson("/api/reports/by-era"),
    getJson("/api/future-bills"),
    getJson("/api/reports/top-policies"),
    getJson("/api/explainers/featured"),
  ]);

  const totalPolicies = sumTotals(byParty);

  const positivePolicies = byParty
    .filter((row) => row.impact_direction === "Positive")
    .reduce((sum, row) => sum + Number(row.total || 0), 0);

  const blockedPolicies = byParty
    .filter((row) => row.impact_direction === "Blocked")
    .reduce((sum, row) => sum + Number(row.total || 0), 0);

  const negativePolicies = byParty
    .filter((row) => row.impact_direction === "Negative")
    .reduce((sum, row) => sum + Number(row.total || 0), 0);

  const eraCount = new Set(byEra.map((row) => row.era)).size;
  const recentAccountability = [...futureBills]
    .filter((bill) => bill.latest_tracked_update)
    .sort((a, b) => String(b.latest_tracked_update).localeCompare(String(a.latest_tracked_update)))
    .slice(0, 4);

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildSiteJsonLd()) }}
      />
      <section className="hero-panel p-8 md:p-10">
        <div className="max-w-4xl relative z-10">
          <p className="eyebrow mb-4">EquityStack.org</p>

          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-5 max-w-3xl">
            A research map of how U.S. policy shaped Black life, opportunity, and exclusion.
          </h1>

          <p className="text-[var(--ink-soft)] text-lg mb-7 leading-8 max-w-3xl">
            EquityStack tracks how laws, court decisions, executive actions, and reform proposals
            have helped, harmed, or failed Black Americans over time. Use it to move between
            historical records, present-day bills, narrative explainers, and legislator accountability.
          </p>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] items-start">
            <div className="flex flex-wrap gap-3">
              <Link
                href="/start"
                className="px-5 py-3 rounded-full bg-[var(--accent)] text-white font-medium shadow-[0_14px_26px_rgba(138,59,18,0.18)] hover:translate-y-[-1px]"
              >
                Start With the Guide
              </Link>
              <Link
                href="/promises"
                className="px-5 py-3 rounded-full border border-[var(--line-strong)] bg-white/75 font-medium hover:bg-white"
              >
                Open Promise Tracker
              </Link>
              <Link
                href="/policies"
                className="px-5 py-3 rounded-full border border-[var(--line-strong)] bg-white/75 font-medium hover:bg-white"
              >
                Browse Policies
              </Link>
              <Link
                href="/explainers"
                className="px-5 py-3 rounded-full border border-[var(--line-strong)] bg-white/75 font-medium hover:bg-white"
              >
                Read Explainers
              </Link>
              <Link
                href="/future-bills"
                className="px-5 py-3 rounded-full border border-[var(--line-strong)] bg-white/75 font-medium hover:bg-white"
              >
                Track Current Bills
              </Link>
            </div>
            <div className="card-muted rounded-[1.25rem] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
                Use This Site
              </p>
              <p className="text-sm text-[var(--ink-soft)] leading-6 mt-3">
                Start with the flagship accountability views, then move into the linked
                policy records, explainers, and current legislative tracking.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <CompactStat label="Total Policies" value={totalPolicies} />
        <CompactStat label="Positive" value={positivePolicies} />
        <CompactStat label="Negative" value={negativePolicies} />
        <CompactStat label="Blocked" value={blockedPolicies} />
        <CompactStat label="Historical Eras" value={eraCount} />
      </section>

      <section className="card-surface rounded-[1.6rem] p-6">
        <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-semibold">Flagship Accountability Views</h2>
            <p className="text-sm text-[var(--ink-soft)] mt-2">
              Start with the three public-facing views that connect presidential commitments,
              documented outcomes, and the longer civil-rights arc into one accountability story.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <FlagshipViewCard
            eyebrow="Intent"
            title="Promise Tracker"
            description="Follow what presidents said they would do, what actions followed, and what was delivered, blocked, or left unfinished."
            href="/promises"
            linkLabel="Open Promise Tracker"
          />
          <FlagshipViewCard
            eyebrow="Outcomes"
            title="Black Impact Score"
            description="Compare how presidential records affected Black communities using a transparent accountability framework built from Promise Tracker data."
            href="/reports/black-impact-score"
            linkLabel="Open Black Impact Score"
          />
          <FlagshipViewCard
            eyebrow="Continuity"
            title="Civil Rights Timeline"
            description="Trace key federal civil-rights action across time, from Reconstruction to the present, through a curated historical sequence."
            href="/reports/civil-rights-timeline"
            linkLabel="Open Civil Rights Timeline"
          />
        </div>
      </section>

      <section className="card-surface rounded-[1.6rem] p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-2xl font-semibold">How To Use EquityStack</h2>
            <p className="text-sm text-[var(--ink-soft)] mt-1">
              The fastest way to understand the project is to move from narrative to evidence to current accountability.
            </p>
          </div>
          <Link href="/start" className="text-sm accent-link">
            Open guided path
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <GuidedStep
            step="Step 1"
            title="Read a Framing Explainer"
            description="Start with a narrative brief that translates a public debate or historical claim into a chain of laws, court decisions, and outcomes."
            href="/explainers"
            linkLabel="Browse explainers"
          />
          <GuidedStep
            step="Step 2"
            title="Check the Underlying Record"
            description="Open the linked policy records to see dates, parties, source material, scores, and historical placement across eras."
            href="/policies"
            linkLabel="Open policy database"
          />
          <GuidedStep
            step="Step 3"
            title="Follow Current Accountability"
            description="Move into future bills, scorecards, and the activity feed to see which reform ideas are active and who is attached to them."
            href="/activity"
            linkLabel="Open activity feed"
          />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Link href="/policies" className="panel-link block rounded-[1.4rem] p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Records</p>
          <h3 className="text-lg font-semibold mt-3">Policy Database</h3>
          <p className="text-sm text-[var(--ink-soft)] mt-2 leading-6">
            Search laws, cases, executive actions, and reform efforts across eras, categories, and impact direction.
          </p>
        </Link>
        <Link href="/timeline" className="panel-link block rounded-[1.4rem] p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">History</p>
          <h3 className="text-lg font-semibold mt-3">Timeline</h3>
          <p className="text-sm text-[var(--ink-soft)] mt-2 leading-6">
            Follow the long arc from Reconstruction to the present and see when major shifts happened.
          </p>
        </Link>
        <Link href="/future-bills" className="panel-link block rounded-[1.4rem] p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Now</p>
          <h3 className="text-lg font-semibold mt-3">Future Bills</h3>
          <p className="text-sm text-[var(--ink-soft)] mt-2 leading-6">
            Track current federal bills linked to EquityStack reform ideas, sponsors, and action history.
          </p>
        </Link>
        <Link href="/scorecards" className="panel-link block rounded-[1.4rem] p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">People</p>
          <h3 className="text-lg font-semibold mt-3">Scorecards</h3>
          <p className="text-sm text-[var(--ink-soft)] mt-2 leading-6">
            See which legislators are attached to tracked reform bills and how their current record is being scored.
          </p>
        </Link>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Featured Explainers"
          href="/explainers"
          linkLabel="View all explainers"
        >
          {featuredExplainers.length === 0 ? (
            <p className="text-sm text-gray-600">No explainers published yet.</p>
          ) : (
            <div className="space-y-4">
              {featuredExplainers.slice(0, 4).map((explainer) => (
                <Link
                  key={explainer.id}
                  href={`/explainers/${explainer.slug}`}
                  className="panel-link block rounded-[1.25rem] p-4 bg-white/70"
                >
                  <div className="mb-3">
                    <span
                      className={`border rounded-full px-3 py-1 text-xs font-medium ${categoryClasses(
                        explainer.category
                      )}`}
                    >
                      {explainer.category || "Explainer"}
                    </span>
                  </div>

                  <h3 className="font-semibold">{explainer.title}</h3>
                  <p className="mt-2 text-sm text-[var(--ink-soft)] line-clamp-3">
                    {explainer.summary}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Policy Records To Start With"
          href="/reports"
          linkLabel="View full reports"
        >
          <div className="space-y-4">
            {topPolicies.slice(0, 6).map((policy, index) => (
              <Link
                key={`${policy.id}-${index}`}
                href={`/policies/${policy.id}`}
                className="panel-link block rounded-[1.25rem] p-4"
              >
                <h3 className="font-semibold">{policy.title}</h3>
                <p className="text-sm text-[var(--ink-soft)] mt-1">
                  {policy.year_enacted} {" • "} {policy.policy_type} {" • "}{" "}
                  {policy.primary_party || "Unknown party"}
                </p>
                <p className="text-sm text-[var(--accent)] mt-2">
                  Score: {policy.total_score}
                </p>
              </Link>
            ))}
          </div>
        </SectionCard>
      </section>

      {recentAccountability.length > 0 ? (
        <SectionCard
          title="Recent Accountability Activity"
          href="/activity"
          linkLabel="Open Activity Feed"
        >
          <div className="grid gap-4 md:grid-cols-2">
            {recentAccountability.map((bill) => (
              <Link
                key={bill.id}
                href="/activity"
                className="panel-link block rounded-[1.25rem] p-4"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="font-semibold">{bill.title}</h3>
                    <p className="text-sm text-[var(--ink-soft)] mt-1">
                      {[bill.target_area, bill.priority_level].filter(Boolean).join(" • ")}
                    </p>
                  </div>
                  <span className="border rounded-full px-3 py-1 text-xs bg-[rgba(255,252,247,0.82)]">
                    {formatDate(bill.latest_tracked_update)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--ink-soft)]">
                  <span className="border rounded-full px-3 py-1 bg-[rgba(255,252,247,0.8)]">
                    Linked Bills: {bill.tracked_bills?.length || 0}
                  </span>
                  <span className="border rounded-full px-3 py-1 bg-[rgba(255,252,247,0.8)]">
                    Scorecards: {bill.linked_legislators?.length || 0}
                  </span>
                  <span className="border rounded-full px-3 py-1 bg-[rgba(255,252,247,0.8)]">
                    Explainers: {bill.related_explainers?.length || 0}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>
      ) : null}

      <section className="card-surface rounded-[1.6rem] p-6">
        <div className="mb-4">
          <h2 className="text-2xl font-semibold">How The Pieces Fit Together</h2>
          <p className="text-sm text-[var(--ink-soft)] mt-1">
            EquityStack works best when you move between historical evidence, narrative interpretation, and current legislative action.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="panel-link rounded-[1.4rem] p-5">
            <h3 className="text-lg font-semibold">1. Explain</h3>
            <p className="text-sm text-[var(--ink-soft)] mt-2">
              Explainers translate broad claims and historical narratives into a concrete chain of records.
            </p>
          </div>
          <div className="panel-link rounded-[1.4rem] p-5">
            <h3 className="text-lg font-semibold">2. Verify</h3>
            <p className="text-sm text-[var(--ink-soft)] mt-2">
              Policy pages hold the dates, parties, scores, and sources behind each claim.
            </p>
          </div>
          <div className="panel-link rounded-[1.4rem] p-5">
            <h3 className="text-lg font-semibold">3. Place In Time</h3>
            <p className="text-sm text-[var(--ink-soft)] mt-2">
              Timeline and reports show how those records cluster by era, party, and direction.
            </p>
          </div>
          <div className="panel-link rounded-[1.4rem] p-5">
            <h3 className="text-lg font-semibold">4. Track Now</h3>
            <p className="text-sm text-[var(--ink-soft)] mt-2">
              Future Bills and Activity connect long-run patterns to current congressional movement.
            </p>
          </div>
          <div className="panel-link rounded-[1.4rem] p-5">
            <h3 className="text-lg font-semibold">5. Assign Accountability</h3>
            <p className="text-sm text-[var(--ink-soft)] mt-2">
              Scorecards surface which legislators are attached to the tracked reform layer.
            </p>
          </div>
          <div className="panel-link rounded-[1.4rem] p-5">
            <h3 className="text-lg font-semibold">6. Follow the Sources</h3>
            <p className="text-sm text-[var(--ink-soft)] mt-2">
              Linked source trails let you inspect the documents behind each interpretation,
              timeline entry, and accountability claim.
            </p>
          </div>
        </div>
      </section>

      <section className="card-surface rounded-[1.6rem] p-6">
        <h2 className="text-xl font-semibold mb-3">Methodology</h2>
        <p className="text-[var(--ink-soft)]">
          EquityStack classifies policies by historical impact, direct Black impact,
          evidence strength, and data completeness. Party labels reflect the party
          associated with a policy at the time it was enacted, decided, proposed, or blocked.
          They are included for historical analysis and should not be read as a claim that
          party ideology remained unchanged across all eras.
        </p>
        <Link href="/methodology" className="accent-link text-sm inline-block mt-3">
          Read full methodology
        </Link>
      </section>
    </main>
  );
}
