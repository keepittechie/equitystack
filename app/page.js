import Link from "next/link";
import { ImpactBadge } from "@/app/components/policy-badges";
import { fetchInternalJson } from "@/lib/api";
import { REPORT_REVALIDATE_SECONDS, withRevalidate } from "@/lib/cache";
import { buildPageMetadata } from "@/lib/metadata";
import { buildSiteJsonLd, serializeJsonLd } from "@/lib/structured-data";

export const metadata = buildPageMetadata({
  title: "EquityStack | Black Policy History and Current Tracking",
  description:
    "Track how U.S. policy shaped Black communities across history and the present, from live current-administration records to the Black Impact Score.",
  path: "/",
});

async function getJson(url) {
  return fetchInternalJson(url, withRevalidate(REPORT_REVALIDATE_SECONDS));
}

async function getOptionalJson(url) {
  return fetchInternalJson(url, {
    ...withRevalidate(REPORT_REVALIDATE_SECONDS),
    allow404: true,
  });
}

function sumTotals(rows, key = "total") {
  return rows.reduce((sum, row) => sum + Number(row[key] || 0), 0);
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

function CompactStat({ label, value, detail }) {
  return (
    <div className="metric-card px-4 py-4">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">{label}</p>
      <p className="mt-3 text-2xl font-bold">{value}</p>
      {detail ? <p className="mt-2 text-sm text-[var(--ink-muted)]">{detail}</p> : null}
    </div>
  );
}

function SectionIntro({ eyebrow, title, description, href, hrefLabel }) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="section-intro">
        {eyebrow ? <p className="eyebrow mb-4">{eyebrow}</p> : null}
        <h2 className="section-title">{title}</h2>
        {description ? <p className="body-copy mt-3">{description}</p> : null}
      </div>
      {href && hrefLabel ? (
        <Link href={href} className="accent-link text-sm font-medium">
          {hrefLabel}
        </Link>
      ) : null}
    </div>
  );
}

function StartHereCard({ eyebrow, title, description, href, linkLabel, meta }) {
  return (
    <Link href={href} className="panel-link block rounded-[1.5rem] p-5">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">{eyebrow}</p>
      <h3 className="card-title mt-3">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{description}</p>
      {meta ? <p className="mt-4 text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">{meta}</p> : null}
      <span className="accent-link mt-4 inline-block text-sm font-medium">{linkLabel}</span>
    </Link>
  );
}

function TrustSignal({ title, description }) {
  return (
    <div className="card-muted rounded-[1.4rem] p-5">
      <h3 className="card-title">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{description}</p>
    </div>
  );
}

function ExploreCard({ eyebrow, title, description, href, linkLabel }) {
  return (
    <Link href={href} className="panel-link block rounded-[1.45rem] p-5">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">{eyebrow}</p>
      <h3 className="card-title mt-3">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{description}</p>
      <span className="accent-link mt-4 inline-block text-sm">{linkLabel}</span>
    </Link>
  );
}

function FeaturedExplainerCard({ explainer }) {
  return (
    <Link href={`/explainers/${explainer.slug}`} className="panel-link block rounded-[1.25rem] p-4">
      <div className="mb-3">
        <span className="public-pill border-transparent bg-[var(--surface-alt)]">
          {explainer.category || "Explainer"}
        </span>
      </div>
      <h3 className="font-semibold">{explainer.title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)] line-clamp-3">
        {explainer.summary}
      </p>
    </Link>
  );
}

function FeaturedPolicyCard({ policy }) {
  return (
    <Link href={`/policies/${policy.id}`} className="panel-link block rounded-[1.25rem] p-4">
      <h3 className="font-semibold">{policy.title}</h3>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">
        {policy.year_enacted} {" • "} {policy.policy_type} {" • "} {policy.primary_party || "Unknown party"}
      </p>
      <p className="mt-2 text-sm font-medium text-[var(--accent)]">
        Score: {policy.total_score}
      </p>
    </Link>
  );
}

function RecentActivityCard({ item }) {
  return (
    <article className="panel-link rounded-[1.3rem] p-5">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
        {item.topic || "Current Administration"}
      </p>
      <h3 className="mt-3 text-base font-semibold leading-6">{item.title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
        {item.latest_action_title || item.summary || "Tracked current-term update"}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {item.latest_action_date ? <span className="public-pill">{formatDate(item.latest_action_date)}</span> : null}
        {item.latest_impact_direction ? <ImpactBadge impact={item.latest_impact_direction} /> : null}
      </div>
      <Link href={`/promises/${item.slug}`} className="accent-link mt-4 inline-block text-sm">
        Open promise record
      </Link>
    </article>
  );
}

function AccountabilityCard({ bill }) {
  return (
    <Link href="/activity" className="panel-link block rounded-[1.25rem] p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold">{bill.title}</h3>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            {[bill.target_area, bill.priority_level].filter(Boolean).join(" • ")}
          </p>
        </div>
        <span className="public-pill">{formatDate(bill.latest_tracked_update)}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--ink-soft)]">
        <span className="public-pill">Linked Bills: {bill.tracked_bills?.length || 0}</span>
        <span className="public-pill">Scorecards: {bill.linked_legislators?.length || 0}</span>
        <span className="public-pill">Explainers: {bill.related_explainers?.length || 0}</span>
      </div>
    </Link>
  );
}

function GuidedStep({ step, title, description, href, linkLabel }) {
  return (
    <div className="panel-link rounded-[1.35rem] p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">{step}</p>
      <h3 className="card-title mt-3">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">{description}</p>
      <Link href={href} className="accent-link mt-4 inline-block text-sm">
        {linkLabel}
      </Link>
    </div>
  );
}

export default async function HomePage() {
  const [byParty, byEra, futureBills, topPolicies, featuredExplainers, currentAdministration] = await Promise.all([
    getJson("/api/reports/by-party"),
    getJson("/api/reports/by-era"),
    getJson("/api/future-bills"),
    getJson("/api/reports/top-policies"),
    getJson("/api/explainers/featured"),
    getOptionalJson("/api/current-administration"),
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
  const latestCurrentAdministrationActivity = (currentAdministration?.recent_activity || []).slice(0, 4);

  return (
    <main className="mx-auto max-w-7xl space-y-12 p-6 md:space-y-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildSiteJsonLd()) }}
      />

      <section className="hero-panel p-8 md:p-10 lg:p-12">
        <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)] lg:items-end">
          <div className="max-w-4xl">
            <p className="eyebrow mb-4">EquityStack.org</p>
            <h1 className="page-title max-w-4xl">
              A public research platform for tracing how U.S. policy has affected Black communities.
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-[var(--ink-soft)]">
              EquityStack connects historical policy records, present-day tracking, explainers, and
              accountability views in one place. Use it to move from a public question to the
              underlying records, sources, and current legislative context.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/reports/black-impact-score" className="public-button-primary">
                Start With the Impact Score
              </Link>
              <Link href="/start" className="public-button-secondary">
                Start Here
              </Link>
              <Link href="/methodology" className="public-button-secondary">
                Review Methodology
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="public-pill">Evidence-backed policy records</span>
              <span className="public-pill">Live current-administration tracking</span>
              <span className="public-pill">Linked explainers, bills, and scorecards</span>
            </div>
          </div>

          <div className="card-muted rounded-[1.4rem] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">What You Can Do Here</p>
            <div className="mt-4 space-y-3 text-sm text-[var(--ink-soft)]">
              <p>Read a public-facing explainer, then verify it against the underlying policy record.</p>
              <p>Move from long-run history into the live current administration and future-bill layers.</p>
              <p>Compare outcomes, timelines, and accountability surfaces without leaving the same research system.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <CompactStat label="Tracked Policies" value={totalPolicies} detail="Structured records in the public dataset" />
        <CompactStat label="Positive" value={positivePolicies} detail="Documented positive-impact records" />
        <CompactStat label="Negative" value={negativePolicies} detail="Documented harmful or adverse records" />
        <CompactStat label="Blocked" value={blockedPolicies} detail="Blocked or unrealized efforts" />
        <CompactStat label="Historical Eras" value={eraCount} detail="Major periods covered in the research set" />
      </section>

      <section className="card-surface rounded-[1.7rem] p-6 md:p-8">
        <SectionIntro
          eyebrow="Start Here"
          title="Three strong ways to enter the platform"
          description="If this is your first visit, start with one of these paths. Each one is designed to move from summary to evidence without forcing you to guess where to click next."
        />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <StartHereCard
            eyebrow="Overview"
            title="Black Impact Score"
            description="Start with the highest-level accountability view across presidential policy records and documented outcomes."
            href="/reports/black-impact-score"
            linkLabel="Open Black Impact Score"
            meta="Best first click for most visitors"
          />
          <StartHereCard
            eyebrow="Live Tracking"
            title="Current Administration"
            description="See what is being tracked in the current presidency term, what changed recently, and which records are already reviewed."
            href="/current-administration"
            linkLabel="Open Current Administration"
            meta="Best for current-term monitoring"
          />
          <StartHereCard
            eyebrow="Evidence"
            title="Policy Database"
            description="Search the underlying laws, court cases, executive actions, and policy records by era, topic, party, and impact direction."
            href="/policies"
            linkLabel="Open Policy Database"
            meta="Best for direct record lookup"
          />
        </div>
      </section>

      <section className="card-surface rounded-[1.7rem] p-6 md:p-8">
        <SectionIntro
          eyebrow="Trust Signals"
          title="Why the information is structured to be inspectable"
          description="EquityStack is designed as a public research product, not a feed of unsourced claims. The platform works by linking summaries to records, records to sources, and current tracking to the same underlying evidence model."
          href="/methodology"
          hrefLabel="Read the methodology"
        />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <TrustSignal
            title="Records before rhetoric"
            description="Narrative summaries are backed by policy records, dates, and source trails rather than stand-alone commentary."
          />
          <TrustSignal
            title="Structured accountability"
            description="Promise tracking, reports, future bills, and scorecards are connected so users can follow a question across layers instead of treating each page as isolated."
          />
          <TrustSignal
            title="Reviewed public-facing updates"
            description="Current-term activity and linked accountability views are surfaced through a structured review flow before they appear on the public site."
          />
        </div>
      </section>

      <section className="card-surface rounded-[1.7rem] p-6 md:p-8">
        <SectionIntro
          eyebrow="Explore"
          title="What you can explore next"
          description="The site works best when you move between reports, records, history, and live accountability instead of staying inside one page type."
        />
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ExploreCard
            eyebrow="Reports"
            title="Reports Hub"
            description="Open the main report layer for the Impact Score, timeline-driven views, and higher-level pattern analysis."
            href="/reports"
            linkLabel="Browse reports"
          />
          <ExploreCard
            eyebrow="Explainers"
            title="Narrative Explainers"
            description="Start with a focused public-facing explanation, then follow its linked records, policy pages, and evidence chain."
            href="/explainers"
            linkLabel="Browse explainers"
          />
          <ExploreCard
            eyebrow="Current Tracking"
            title="Future Bills"
            description="Track reform proposals, linked bills, sponsors, and movement across the live legislative layer."
            href="/future-bills"
            linkLabel="Open future bills"
          />
          <ExploreCard
            eyebrow="Accountability"
            title="Scorecards"
            description="See which legislators are attached to the tracked reform layer and how those relationships are being summarized."
            href="/scorecards"
            linkLabel="Open scorecards"
          />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <section className="card-surface rounded-[1.7rem] p-6">
          <SectionIntro
            eyebrow="Featured"
            title="Featured explainers"
            description="Good entry points when you want framing first, then linked records."
            href="/explainers"
            hrefLabel="View all explainers"
          />
          {featuredExplainers.length === 0 ? (
            <p className="mt-6 text-sm text-[var(--ink-soft)]">No explainers published yet.</p>
          ) : (
            <div className="mt-6 space-y-4">
              {featuredExplainers.slice(0, 4).map((explainer) => (
                <FeaturedExplainerCard key={explainer.id} explainer={explainer} />
              ))}
            </div>
          )}
        </section>

        <section className="card-surface rounded-[1.7rem] p-6">
          <SectionIntro
            eyebrow="Records"
            title="Policy records to start with"
            description="A short list of high-signal records worth opening early if you want to understand the shape of the dataset."
            href="/reports"
            hrefLabel="Open reports"
          />
          <div className="mt-6 space-y-4">
            {topPolicies.slice(0, 6).map((policy, index) => (
              <FeaturedPolicyCard key={`${policy.id}-${index}`} policy={policy} />
            ))}
          </div>
        </section>
      </section>

      {(latestCurrentAdministrationActivity.length > 0 || recentAccountability.length > 0) ? (
        <section className="card-surface rounded-[1.7rem] p-6 md:p-8">
          <SectionIntro
            eyebrow="Live Context"
            title="What changed recently"
            description="Two fast ways to see live movement: reviewed current-administration records and recent accountability activity in the future-bills layer."
          />
          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <div>
              <div className="mb-4 flex items-center justify-between gap-4">
                <h3 className="card-title">Current Administration</h3>
                <Link href="/current-administration" className="accent-link text-sm">
                  Open overview
                </Link>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {latestCurrentAdministrationActivity.length === 0 ? (
                  <p className="text-sm text-[var(--ink-soft)]">No reviewed current-term activity is published yet.</p>
                ) : (
                  latestCurrentAdministrationActivity.map((item) => (
                    <RecentActivityCard key={item.slug} item={item} />
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="mb-4 flex items-center justify-between gap-4">
                <h3 className="card-title">Recent Accountability Activity</h3>
                <Link href="/activity" className="accent-link text-sm">
                  Open activity feed
                </Link>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {recentAccountability.length === 0 ? (
                  <p className="text-sm text-[var(--ink-soft)]">No recent accountability activity is available yet.</p>
                ) : (
                  recentAccountability.map((bill) => (
                    <AccountabilityCard key={bill.id} bill={bill} />
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="card-surface rounded-[1.7rem] p-6 md:p-8">
        <SectionIntro
          eyebrow="How To Use It"
          title="A practical first visit"
          description="The clearest first pass is to move from framing, to records, to live accountability. That sequence keeps the site useful without overwhelming you."
          href="/start"
          hrefLabel="Open start guide"
        />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <GuidedStep
            step="Step 1"
            title="Read one explainer"
            description="Use an explainer to understand the question, then follow its linked records and sources."
            href="/explainers"
            linkLabel="Browse explainers"
          />
          <GuidedStep
            step="Step 2"
            title="Inspect the record"
            description="Open the linked policy page to see dates, sources, parties, scores, and historical placement."
            href="/policies"
            linkLabel="Open policy database"
          />
          <GuidedStep
            step="Step 3"
            title="Check what is active now"
            description="Move into current administration, future bills, or scorecards when you want live accountability context."
            href="/future-bills"
            linkLabel="Open current tracking"
          />
        </div>
      </section>
    </main>
  );
}
