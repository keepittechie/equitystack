import Link from "next/link";
import {
  ImpactBadge,
  PromiseStatusBadge,
} from "@/app/components/policy-badges";
import TrustImpactSummaryCard from "@/app/components/TrustImpactSummaryCard";
import { EXPLANATION_CONTENT } from "@/lib/content/explanations";
import {
  EVIDENCE_STRENGTHS,
  TRUST_STATES,
} from "@/lib/labels";
import { buildPageMetadata } from "@/lib/metadata";
import { computeOutcomeBasedScores } from "@/lib/services/blackImpactScoreService";
import {
  fetchCurrentAdministrationOverview,
  fetchPromiseList,
} from "@/lib/services/promiseService";
import { buildSiteJsonLd, serializeJsonLd } from "@/lib/structured-data";

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "EquityStack | Track What Policies Actually Did",
  description:
    "Track documented policy outcomes, evidence, and Black community impact across history and the current administration.",
  path: "/",
});

function formatDate(dateString) {
  if (!dateString) {
    return null;
  }

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatScore(value) {
  const numeric = Number(value ?? 0);

  if (!Number.isFinite(numeric)) {
    return String(value ?? "0");
  }

  const fixed = numeric.toFixed(2);
  return numeric > 0 ? `+${fixed}` : fixed;
}

function SectionHeading({ eyebrow, title, description, href, hrefLabel }) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="section-intro max-w-3xl">
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

function HeroStat({ label, value, detail }) {
  return (
    <div className="rounded-[1.1rem] border border-[rgba(120,53,15,0.1)] bg-white/80 px-4 py-4">
      <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="mt-2 text-xs text-[var(--ink-soft)]">{detail}</p>
    </div>
  );
}

function FlowStep({ step, title, description }) {
  return (
    <div className="card-muted rounded-[1.35rem] p-5">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(120,53,15,0.14)] bg-white text-sm font-semibold text-[var(--accent)]">
          {step}
        </span>
        <h3 className="card-title">{title}</h3>
      </div>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">{description}</p>
    </div>
  );
}

function TrustPoint({ title, description }) {
  return (
    <div className="card-muted rounded-[1.35rem] p-5">
      <h3 className="card-title">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{description}</p>
    </div>
  );
}

function FeatureCard({ eyebrow, title, description, href, linkLabel }) {
  return (
    <Link href={href} className="panel-link block rounded-[1.45rem] p-5">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">{eyebrow}</p>
      <h3 className="card-title mt-3">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{description}</p>
      <span className="accent-link mt-4 inline-block text-sm font-medium">{linkLabel}</span>
    </Link>
  );
}

function PreviewRecordCard({
  eyebrow,
  title,
  description,
  href,
  detailLabel,
  record,
  date,
  topic,
  status,
  impactDirection,
}) {
  return (
    <article className="panel-link rounded-[1.35rem] p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
            {eyebrow}
          </p>
          <h3 className="mt-3 text-base font-semibold leading-6">{title}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {status ? <PromiseStatusBadge status={status} /> : null}
          {impactDirection ? <ImpactBadge impact={impactDirection} /> : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {topic ? <span className="public-pill">{topic}</span> : null}
        {date ? <span className="public-pill">{formatDate(date)}</span> : null}
      </div>

      <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">
        {description}
      </p>

      <TrustImpactSummaryCard
        record={record}
        detailHref={href}
        detailLabel={detailLabel}
      />
    </article>
  );
}

function MiniPill({ label, tone = "default" }) {
  const classes =
    tone === "success"
      ? "border-[rgba(22,163,74,0.2)] bg-[rgba(22,163,74,0.08)] text-[#166534]"
      : tone === "warning"
        ? "border-[rgba(217,119,6,0.2)] bg-[rgba(217,119,6,0.08)] text-[#B45309]"
        : tone === "danger"
          ? "border-[rgba(220,38,38,0.2)] bg-[rgba(220,38,38,0.08)] text-[#B91C1C]"
          : "border-[var(--line)] bg-white text-[var(--ink-soft)]";

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${classes}`}>
      {label}
    </span>
  );
}

function ScoreSnapshotCard({ presidents, metadata }) {
  const highest = presidents[0] || null;
  const lowest = [...presidents]
    .reverse()
    .find((president) => Number(president.raw_score_total || 0) < 0) || null;

  return (
    <section className="card-surface rounded-[1.55rem] p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="max-w-2xl">
          <p className="eyebrow mb-3">Live Preview</p>
          <h3 className="card-title">Black Impact Score snapshot</h3>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            This is the current public score model using documented, scoring-ready outcomes from Promise Tracker.
          </p>
        </div>
        <Link href="/reports/black-impact-score" className="accent-link text-sm font-medium">
          Open full score report
        </Link>
      </div>

      {presidents.length === 0 ? (
        <div className="mt-5 rounded-[1.1rem] border border-[rgba(120,53,15,0.1)] bg-white/80 p-4">
          <p className="text-sm font-medium">Insufficient evidence</p>
          <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
            The public score view needs scoring-ready outcomes with written summaries, impact direction, and linked sources.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <HeroStat
              label="Presidents Scored"
              value={presidents.length}
              detail="Current public score view"
            />
            <HeroStat
              label="Outcomes Scored"
              value={metadata.total_outcomes}
              detail="Scoring-ready documented outcomes"
            />
            <HeroStat
              label="Promises Included"
              value={metadata.total_promises}
              detail="Records contributing to the score"
            />
            <HeroStat
              label="Excluded Outcomes"
              value={metadata.total_excluded_outcomes}
              detail="Visible in records but outside numeric scoring"
            />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[1.1rem] border border-[rgba(120,53,15,0.1)] bg-white/85 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Highest current score</p>
              {highest ? (
                <>
                  <h4 className="mt-3 text-lg font-semibold">{highest.president}</h4>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <MiniPill label={`Normalized ${formatScore(highest.normalized_score_total)}`} tone="success" />
                    <MiniPill label={`${highest.outcome_count} outcomes`} />
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm text-[var(--ink-soft)]">No president summary is available yet.</p>
              )}
            </div>

            <div className="rounded-[1.1rem] border border-[rgba(120,53,15,0.1)] bg-white/85 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Lowest current score</p>
              {lowest ? (
                <>
                  <h4 className="mt-3 text-lg font-semibold">{lowest.president}</h4>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <MiniPill label={`Normalized ${formatScore(lowest.normalized_score_total)}`} tone="danger" />
                    <MiniPill label={`${lowest.outcome_count} outcomes`} />
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm text-[var(--ink-soft)]">
                  No negative-scoring president summary is available in the current report.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function ReadGuideCard({ title, children, href, hrefLabel }) {
  return (
    <div className="card-muted rounded-[1.35rem] p-5">
      <h3 className="card-title">{title}</h3>
      <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--ink-soft)]">
        {children}
      </div>
      {href && hrefLabel ? (
        <Link href={href} className="accent-link mt-4 inline-block text-sm font-medium">
          {hrefLabel}
        </Link>
      ) : null}
    </div>
  );
}

export default async function HomePage() {
  const [promiseList, currentAdministration, impactScore] = await Promise.all([
    fetchPromiseList({
      sort: "promise_date_desc",
      page: 1,
      pageSize: 2,
    }),
    fetchCurrentAdministrationOverview(),
    computeOutcomeBasedScores(),
  ]);

  const recentPromises = promiseList.items || [];
  const currentHighlights = (
    currentAdministration?.featured_records?.length
      ? currentAdministration.featured_records
      : currentAdministration?.recent_activity || []
  ).slice(0, 2);
  const currentAdministrationName =
    currentAdministration?.administration_name || "Current Administration";
  const impactGuide = EXPLANATION_CONTENT.currentAdministration.interpret;

  return (
    <main className="mx-auto max-w-7xl space-y-10 p-6 md:space-y-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildSiteJsonLd()) }}
      />

      <section className="hero-panel p-8 md:p-10 lg:p-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)] lg:items-end">
          <div className="max-w-4xl">
            <p className="eyebrow mb-4">EquityStack</p>
            <h1 className="page-title max-w-4xl">
              Track what policies actually did for Black Americans.
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-[var(--ink-soft)]">
              EquityStack follows policy from action to documented outcome, shows the evidence behind that record,
              and helps you see how those results affected Black communities over time.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/promises" className="public-button-primary">
                Explore Promises
              </Link>
              <Link href="/reports/black-impact-score" className="public-button-secondary">
                View Black Impact Score
              </Link>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="public-pill">Every record is source-backed and auditable</span>
              <span className="public-pill">Outcome-based, not promise-only</span>
              <span className="public-pill">Visible uncertainty and evidence strength</span>
            </div>
          </div>

          <div className="card-muted rounded-[1.45rem] p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">What you can verify here</p>
            <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--ink-soft)]">
              <p>The policy or action itself.</p>
              <p>What happened next.</p>
              <p>The source trail behind that result.</p>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <HeroStat
            label="Recent Promise Records"
            value={recentPromises.length}
            detail="Fresh public records on the homepage"
          />
          <HeroStat
            label="Current-Term Records"
            value={currentAdministration?.total_promises ?? 0}
            detail="Tracked in the live administration view"
          />
          <HeroStat
            label="Scoring-Ready Outcomes"
            value={impactScore.metadata?.total_outcomes ?? 0}
            detail="Currently contributing to BIS"
          />
        </div>
      </section>

      <section className="card-surface rounded-[1.7rem] p-6 md:p-8">
        <SectionHeading
          eyebrow="Live Preview"
          title="See the system working with real records"
          description="Recent Promise Tracker records, current-term highlights, and the live Black Impact Score using the same public data."
        />

        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div>
            <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
              <h3 className="card-title">Recent Promise Tracker records</h3>
              <Link href="/promises" className="accent-link text-sm font-medium">
                View all promises
              </Link>
            </div>
            <div className="space-y-4">
              {recentPromises.length === 0 ? (
                <div className="card-muted rounded-[1.3rem] p-5">
                  <p className="text-sm text-[var(--ink-soft)]">
                    No public Promise Tracker records are available yet.
                  </p>
                </div>
              ) : (
                recentPromises.map((record) => (
                  <PreviewRecordCard
                    key={record.id}
                    eyebrow={record.president || "Promise Tracker"}
                    title={record.title}
                    description={
                      record.summary || "Open the record to inspect actions, outcomes, and linked sources."
                    }
                    href={`/promises/${record.slug}`}
                    detailLabel="View record"
                    record={record}
                    date={record.latest_action_date || record.promise_date}
                    topic={record.topic}
                    status={record.status}
                    impactDirection={record.impact_direction_for_curation}
                  />
                ))
              )}
            </div>
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
              <h3 className="card-title">{currentAdministrationName} highlights</h3>
              <Link href="/current-administration" className="accent-link text-sm font-medium">
                Open current administration
              </Link>
            </div>
            <div className="space-y-4">
              {currentHighlights.length === 0 ? (
                <div className="card-muted rounded-[1.3rem] p-5">
                  <p className="text-sm text-[var(--ink-soft)]">
                    No current-administration highlights are published yet.
                  </p>
                </div>
              ) : (
                currentHighlights.map((record) => (
                  <PreviewRecordCard
                    key={record.id || record.slug}
                    eyebrow={currentAdministrationName}
                    title={record.title}
                    description={
                      record.latest_action_title ||
                      record.summary ||
                      "Open the record to inspect the latest action and documented outcome."
                    }
                    href={`/promises/${record.slug}`}
                    detailLabel="Open promise record"
                    record={record}
                    date={record.latest_action_date || record.promise_date}
                    topic={record.topic}
                    status={record.status}
                    impactDirection={
                      record.impact_direction_for_curation || record.latest_impact_direction
                    }
                  />
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <ScoreSnapshotCard
            presidents={impactScore.presidents || []}
            metadata={impactScore.metadata || { total_outcomes: 0, total_promises: 0, total_excluded_outcomes: 0 }}
          />
        </div>
      </section>

      <section className="card-surface rounded-[1.7rem] p-6 md:p-8">
        <SectionHeading
          eyebrow="How It Works"
          title="From policy action to visible impact"
          description="Follow the record from action to documented outcome to Black-impact interpretation."
        />

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <FlowStep
            step="1"
            title="Policies and actions are tracked"
            description="Promise Tracker records public commitments, laws, executive actions, and related steps."
          />
          <FlowStep
            step="2"
            title="Outcomes are documented with sources"
            description="Outcomes are linked to public sources so the evidence trail stays visible."
          />
          <FlowStep
            step="3"
            title="Impact on Black Americans is evaluated"
            description="Black Impact Score summarizes those documented outcomes without hiding mixed or blocked cases."
          />
        </div>
      </section>

      <section className="card-surface rounded-[1.7rem] p-6 md:p-8">
        <SectionHeading
          eyebrow="Core Features"
          title="Three clear ways to enter the platform"
          description="Start with the layer that matches your question, then drill into the same underlying evidence base."
        />

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <FeatureCard
            eyebrow="Promise Tracker"
            title="See what was promised and what actually happened"
            description="Open records, inspect actions and outcomes, and follow the source trail."
            href="/promises"
            linkLabel="Open Promise Tracker"
          />
          <FeatureCard
            eyebrow="Black Impact Score"
            title="Measure real-world impact across administrations"
            description="Compare administrations using the same public outcome record."
            href="/reports/black-impact-score"
            linkLabel="Open Black Impact Score"
          />
          <FeatureCard
            eyebrow="Current Administration"
            title="Track ongoing policies and outcomes in real time"
            description="Follow reviewed current-term records, recent actions, and documented outcomes."
            href="/current-administration"
            linkLabel="Open Current Administration"
          />
        </div>
      </section>

      <section className="card-surface rounded-[1.7rem] p-6 md:p-8">
        <SectionHeading
          eyebrow="How To Read This"
          title="Three quick cues"
          description="These three label systems are enough to read the preview cards correctly."
          href="/reports/black-impact-score"
          hrefLabel="Open full score methodology"
        />

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <ReadGuideCard title="Impact Direction" href="/current-administration" hrefLabel="See live examples">
            <p>{impactGuide}</p>
            <div className="flex flex-wrap gap-2">
              <ImpactBadge impact="Positive" />
              <ImpactBadge impact="Negative" />
              <ImpactBadge impact="Mixed" />
              <ImpactBadge impact="Blocked" />
            </div>
          </ReadGuideCard>

          <ReadGuideCard title="Evidence Strength" href="/methodology" hrefLabel="Read methodology">
            <p>
              Strong means stronger visible support. Moderate and Limited mean thinner but still useful
              support. Missing means the record is not strong enough for confident numeric use.
            </p>
            <div className="flex flex-wrap gap-2">
              <MiniPill label={EVIDENCE_STRENGTHS.STRONG} tone="success" />
              <MiniPill label={EVIDENCE_STRENGTHS.MODERATE} tone="warning" />
              <MiniPill label={EVIDENCE_STRENGTHS.LIMITED} tone="warning" />
              <MiniPill label={EVIDENCE_STRENGTHS.MISSING} tone="danger" />
            </div>
          </ReadGuideCard>

          <ReadGuideCard title="Trust Labels" href="/reports/black-impact-score" hrefLabel="See score context">
            <p>
              Verified means ready to inspect. Guarded means use with visible caveats. Needs Review
              means not settled. Pending means not ready yet.
            </p>
            <div className="flex flex-wrap gap-2">
              <MiniPill label={TRUST_STATES.VERIFIED} tone="success" />
              <MiniPill label={TRUST_STATES.GUARDED} tone="warning" />
              <MiniPill label={TRUST_STATES.NEEDS_REVIEW} tone="danger" />
              <MiniPill label={TRUST_STATES.PENDING} />
            </div>
          </ReadGuideCard>
        </div>
      </section>

      <section className="card-surface rounded-[1.7rem] p-6 md:p-8">
        <SectionHeading
          eyebrow="Trust"
          title="Why this is built for verification"
          description="The homepage gives you labels and live records first. The deeper methodology is there when you want to inspect the system."
          href="/methodology"
          hrefLabel="Read methodology"
        />

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <TrustPoint
            title="Source-backed records"
            description="Summaries stay tied to actions, outcomes, and linked sources."
          />
          <TrustPoint
            title="Visible uncertainty"
            description="Evidence strength, trust state, and mixed or missing cases stay visible."
          />
          <TrustPoint
            title="Human + system review"
            description="Reviewed public records and transparent methodology keep the data inspectable."
          />
        </div>
      </section>

      <section className="hero-panel p-8 md:p-10">
        <div className="max-w-4xl">
          <p className="eyebrow mb-4">Start Exploring</p>
          <h2 className="page-title text-[clamp(2rem,3.8vw,3.1rem)]">
            Start with the record, then follow the evidence.
          </h2>
          <p className="mt-5 max-w-3xl text-base leading-8 text-[var(--ink-soft)] md:text-lg">
            Start with Promise Tracker. Use Black Impact Score to compare the bigger picture. Use
            Current Administration to follow what is active now.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/promises" className="public-button-primary">
              Open Promise Tracker
            </Link>
            <Link href="/reports/black-impact-score" className="public-button-secondary">
              Compare with Black Impact Score
            </Link>
            <Link href="/current-administration" className="public-button-secondary">
              Track the Current Administration
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
