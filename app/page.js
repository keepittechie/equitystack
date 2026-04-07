import Link from "next/link";
import PresidentAvatar from "@/app/components/PresidentAvatar";
import {
  ImpactBadge,
  PromiseStatusBadge,
  statusPillClasses,
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
import { fetchHomepageReadinessSummary } from "@/lib/services/systemReadinessService";
import { buildSiteJsonLd, serializeJsonLd } from "@/lib/structured-data";

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "EquityStack | Track What Policies Actually Did",
  description:
    "Track documented policy outcomes, evidence, and Black community impact across history and the current administration.",
  path: "/",
});

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

function formatScore(value) {
  const numeric = Number(value ?? 0);

  if (!Number.isFinite(numeric)) {
    return String(value ?? "0");
  }

  const fixed = numeric.toFixed(2);
  return numeric > 0 ? `+${fixed}` : fixed;
}

function formatPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return `${Math.round(numeric * 100)}%`;
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

function MetaPill({ children }) {
  return <span className="public-pill">{children}</span>;
}

function SummaryStat({ label, value, tone = "default", detail = null }) {
  const toneClasses =
    tone === "accent"
      ? "border-[rgba(37,99,235,0.16)] bg-[rgba(37,99,235,0.08)]"
      : "border-[var(--line)] bg-white";

  return (
    <div className={`rounded-[1.2rem] border px-4 py-4 ${toneClasses}`}>
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {detail ? <p className="mt-2 text-sm text-[var(--ink-soft)]">{detail}</p> : null}
    </div>
  );
}

function SectionIntro({ eyebrow, title, description, href, hrefLabel }) {
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

function StartHereCard({ eyebrow, title, description, href, linkLabel, meta }) {
  return (
    <Link href={href} className="panel-link block rounded-[1.4rem] p-5">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">{eyebrow}</p>
      <h3 className="card-title mt-3">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{description}</p>
      {meta ? (
        <p className="mt-4 text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">{meta}</p>
      ) : null}
      <span className="accent-link mt-4 inline-block text-sm font-medium">{linkLabel}</span>
    </Link>
  );
}

function TrustSignal({ title, description }) {
  return (
    <div className="card-muted rounded-[1.2rem] p-4">
      <h3 className="card-title">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{description}</p>
    </div>
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
  presidentSlug,
  presidentName,
}) {
  return (
    <article className="panel-link rounded-[1.3rem] p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
            {eyebrow}
          </p>
          <h3 className="mt-3 text-base font-semibold leading-6">{title}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {presidentSlug || presidentName ? (
            <PresidentAvatar
              presidentSlug={presidentSlug}
              presidentName={presidentName}
              size={40}
            />
          ) : null}
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
  return (
    <span className={statusPillClasses(tone, "text-xs")}>
      {label}
    </span>
  );
}

function getReadinessTone(status) {
  if (status === "PASS") return "success";
  if (status === "FAIL") return "danger";
  return "warning";
}

function ScoreSnapshotCard({ presidents, metadata, readiness }) {
  const highest = presidents[0] || null;
  const lowest = [...presidents]
    .reverse()
    .find((president) => Number(president.raw_score_total || 0) < 0) || null;
  const sourceCoverage = formatPercent(readiness?.source_coverage_pct);
  const intentCoverage = formatPercent(readiness?.intent_coverage_pct);
  const includedCount = Number(metadata?.outcomes_included_in_score ?? metadata?.total_outcomes ?? 0);
  const excludedCount = Number(metadata?.outcomes_excluded_from_score ?? metadata?.total_excluded_outcomes ?? 0);
  const availableCount = Number(metadata?.total_outcomes_available ?? 0);
  const summaryInterpretation =
    typeof metadata?.summary_interpretation === "string" && metadata.summary_interpretation.trim()
      ? metadata.summary_interpretation.trim()
      : null;

  return (
    <section className="card-surface rounded-[1.6rem] p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Live Score</p>
          <h3 className="card-title mt-3">Black Impact Score snapshot</h3>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            The current public score model uses documented, scoring-ready outcomes from Promise Tracker.
          </p>
          {summaryInterpretation ? (
            <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
              {summaryInterpretation}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {readiness?.certification_status ? (
            <MiniPill
              label={`Readiness: ${readiness.certification_status}`}
              tone={getReadinessTone(readiness.certification_status)}
            />
          ) : null}
          <Link href="/reports/black-impact-score" className="accent-link text-sm font-medium">
            Open Black Impact Score report
          </Link>
        </div>
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
            <SummaryStat
              label="Presidents"
              value={presidents.length}
              detail="Visible in this score view"
              tone="accent"
            />
            <SummaryStat
              label="Outcomes"
              value={metadata.total_outcomes}
              detail={
                availableCount
                  ? `${includedCount} of ${availableCount} currently included`
                  : "Scoring-ready outcomes"
              }
            />
            <SummaryStat
              label="Promises"
              value={metadata.total_promises}
              detail="Records contributing"
            />
            <SummaryStat
              label="Excluded"
              value={excludedCount}
              detail="Visible but not scored"
            />
          </div>

          {readiness?.total_policy_outcomes ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <MetaPill>{readiness.total_policy_outcomes} unified outcomes</MetaPill>
              {readiness.current_admin_outcomes ? (
                <MetaPill>{readiness.current_admin_outcomes} current-admin</MetaPill>
              ) : null}
              {readiness.legislative_outcomes ? (
                <MetaPill>{readiness.legislative_outcomes} legislative</MetaPill>
              ) : null}
              {sourceCoverage ? <MetaPill>{sourceCoverage} sourced</MetaPill> : null}
              {intentCoverage ? <MetaPill>{intentCoverage} intent classified</MetaPill> : null}
            </div>
          ) : null}

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="card-muted rounded-[1.2rem] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Highest current score</p>
              {highest ? (
                <>
                  <div className="mt-3 flex items-center gap-3">
                    <PresidentAvatar
                      presidentSlug={highest.president_slug}
                      presidentName={highest.president}
                      size={40}
                    />
                    <h4 className="text-lg font-semibold">{highest.president}</h4>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <MiniPill label={`Normalized ${formatScore(highest.normalized_score_total)}`} tone="success" />
                    <MiniPill label={`${highest.outcome_count} outcomes`} />
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm text-[var(--ink-soft)]">No president summary is available yet.</p>
              )}
            </div>

            <div className="card-muted rounded-[1.2rem] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Lowest current score</p>
              {lowest ? (
                <>
                  <div className="mt-3 flex items-center gap-3">
                    <PresidentAvatar
                      presidentSlug={lowest.president_slug}
                      presidentName={lowest.president}
                      size={40}
                    />
                    <h4 className="text-lg font-semibold">{lowest.president}</h4>
                  </div>
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

function LabelGuideCard({ impactGuide }) {
  return (
    <div className="card-surface rounded-[1.6rem] p-5">
      <h3 className="card-title">How to read the labels</h3>
      <div className="mt-4 space-y-4 text-sm leading-7 text-[var(--ink-soft)]">
        <div className="card-muted rounded-[1.2rem] p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Impact</p>
          <p className="mt-2">{impactGuide}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ImpactBadge impact="Positive" />
            <ImpactBadge impact="Negative" />
            <ImpactBadge impact="Mixed" />
            <ImpactBadge impact="Blocked" />
          </div>
        </div>

        <div className="card-muted rounded-[1.2rem] p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Evidence</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <MiniPill label={EVIDENCE_STRENGTHS.STRONG} tone="success" />
            <MiniPill label={EVIDENCE_STRENGTHS.MODERATE} tone="warning" />
            <MiniPill label={EVIDENCE_STRENGTHS.LIMITED} tone="warning" />
            <MiniPill label={EVIDENCE_STRENGTHS.MISSING} tone="danger" />
          </div>
        </div>

        <div className="card-muted rounded-[1.2rem] p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Trust</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <MiniPill label={TRUST_STATES.VERIFIED} tone="success" />
            <MiniPill label={TRUST_STATES.GUARDED} tone="warning" />
            <MiniPill label={TRUST_STATES.NEEDS_REVIEW} tone="danger" />
            <MiniPill label={TRUST_STATES.PENDING} />
          </div>
        </div>
      </div>

      <Link href="/reports/black-impact-score" className="accent-link mt-4 inline-block text-sm font-medium">
        Open Black Impact Score methodology
      </Link>
    </div>
  );
}

export default async function HomePage() {
  const [promiseList, currentAdministration, impactScore, readinessSummary] = await Promise.all([
    fetchPromiseList({
      sort: "promise_date_desc",
      page: 1,
      pageSize: 2,
    }),
    fetchCurrentAdministrationOverview(),
    computeOutcomeBasedScores(),
    fetchHomepageReadinessSummary(),
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
  const presidents = impactScore.presidents || [];
  const scoreMetadata = impactScore.metadata || {
    total_outcomes: 0,
    total_promises: 0,
    total_excluded_outcomes: 0,
  };
  const sourceCoverage = formatPercent(readinessSummary?.source_coverage_pct);

  return (
    <main className="mx-auto max-w-7xl space-y-10 p-6 md:space-y-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildSiteJsonLd()) }}
      />

      <section className="hero-panel p-8 md:p-10 lg:p-12">
        <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)] lg:items-end">
          <div className="max-w-4xl">
            <p className="eyebrow mb-4">EquityStack.org</p>
            <h1 className="page-title max-w-4xl">
              Track what policies actually did for Black Americans.
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-[var(--ink-soft)]">
              EquityStack follows policy from action to documented outcome, shows the evidence behind
              that record, and helps you see how those results affected Black communities over time.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/promises" className="public-button-primary">
                Open Promise Tracker
              </Link>
            <Link href="/reports/black-impact-score" className="public-button-secondary">
              Open Black Impact Score
            </Link>
            <Link href="/current-administration" className="public-button-secondary">
              Track Current Administration
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
              <MetaPill>Source-backed records</MetaPill>
              <MetaPill>Outcome-based scoring</MetaPill>
              <MetaPill>Visible uncertainty and evidence</MetaPill>
          </div>
        </div>

          <div className="card-muted rounded-[1.4rem] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">What You Can Do Here</p>
            <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--ink-soft)]">
              <p>Start with a live record, not a generic summary.</p>
              <p>Open the source trail behind each documented outcome.</p>
              <p>Use Black Impact Score as a rollup of the same evidence base.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <CompactStat
          label="Recent Records"
          value={recentPromises.length}
          detail="Public records shown below"
        />
        <CompactStat
          label="Current-Term Records"
          value={currentAdministration?.total_promises ?? 0}
          detail="Reviewed current-term tracking"
        />
        <CompactStat
          label="Presidents Scored"
          value={presidents.length}
          detail="Visible in the current BIS view"
        />
        <CompactStat
          label="Outcomes Scored"
          value={scoreMetadata.total_outcomes}
          detail={
            scoreMetadata.total_outcomes_available
              ? `${scoreMetadata.total_outcomes} of ${scoreMetadata.total_outcomes_available} included`
              : "Scoring-ready documented outcomes"
          }
        />
        <CompactStat
          label="Excluded Outcomes"
          value={scoreMetadata.total_excluded_outcomes}
          detail={sourceCoverage ? `${sourceCoverage} unified outcomes sourced` : "Visible records outside numeric scoring"}
        />
      </section>

      <section className="card-surface rounded-[1.6rem] p-6 md:p-8">
        <SectionIntro
          eyebrow="Start Here"
          title="Three strong ways to enter the platform"
          description="If this is your first visit, start with one of these paths. Each one is designed to move from summary to evidence without making you guess where to click next."
        />

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <StartHereCard
            eyebrow="Outcomes"
            title="Black Impact Score"
            description="Start with the highest-level accountability view built from documented outcomes and visible methodology."
            href="/reports/black-impact-score"
            linkLabel="Open Black Impact Score"
            meta="Best for big-picture comparison"
          />
          <StartHereCard
            eyebrow="Evidence"
            title="Promise Tracker"
            description="See what was promised, what actions followed, and what outcomes were documented on the record."
            href="/promises"
            linkLabel="Open Promise Tracker"
            meta="Best for record-level inspection"
          />
          <StartHereCard
            eyebrow="Live Tracking"
            title="Current Administration"
            description="Follow ongoing current-term records, reviewed updates, and documented outcomes."
            href="/current-administration"
            linkLabel="Open Current Administration"
            meta="Best for active policy monitoring"
          />
        </div>
      </section>

      <section className="card-surface rounded-[1.6rem] p-6 md:p-8">
        <SectionIntro
          eyebrow="Live Preview"
          title="See the system working with real records"
          description="Recent Promise Tracker records, current-term highlights, and the live Black Impact Score using the same public data."
        />

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <div>
            <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
              <h3 className="card-title">Recent Promise Tracker records</h3>
              <Link href="/promises" className="accent-link text-sm font-medium">
                Open Promise Tracker
              </Link>
            </div>
            <div className="space-y-4">
              {recentPromises.map((record) => (
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
              ))}
            </div>
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
              <h3 className="card-title">{currentAdministrationName} highlights</h3>
              <Link href="/current-administration" className="accent-link text-sm font-medium">
                Open Current Administration overview
              </Link>
            </div>
            <div className="space-y-4">
              {currentHighlights.map((record) => (
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
                  presidentSlug={currentAdministration?.president?.slug}
                  presidentName={
                    currentAdministration?.president?.president || currentAdministration?.administration_name
                  }
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <ScoreSnapshotCard
            presidents={presidents}
            metadata={scoreMetadata}
            readiness={readinessSummary}
          />
        </div>
      </section>

      <section className="card-surface rounded-[1.6rem] p-6 md:p-8">
        <SectionIntro
          eyebrow="Trust Signals"
          title="Built to be inspected, not taken on faith"
          description="EquityStack is built as a public research product. The summary is fast, but every path still leads back to actions, outcomes, and source-backed records."
          href="/methodology"
          hrefLabel="Read methodology"
        />

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="grid gap-4">
            <TrustSignal
              title="Records before rhetoric"
              description="Summaries stay tied to public actions, documented outcomes, and linked sources."
            />
            <TrustSignal
              title="Visible uncertainty"
              description="Evidence strength, mixed outcomes, blocked efforts, and thinner records stay visible."
            />
            <TrustSignal
              title="Human-readable verification"
              description="You can move from homepage summary to Promise Tracker record to source trail without changing systems."
            />
          </div>

          <LabelGuideCard impactGuide={impactGuide} />
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
