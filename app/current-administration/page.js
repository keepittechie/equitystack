import Link from "next/link";
import { notFound } from "next/navigation";
import { ImpactBadge, PromiseStatusBadge } from "@/app/components/policy-badges";
import TrustImpactSummaryCard from "@/app/components/TrustImpactSummaryCard";
import TrackedLink from "@/app/components/telemetry/TrackedLink";
import CopyShareLinkButton from "@/app/reports/black-impact-score/CopyShareLinkButton";
import { fetchInternalJson } from "@/lib/api";
import { PUBLIC_REVALIDATE_SECONDS, withRevalidate } from "@/lib/cache";
import { EXPLANATION_CONTENT } from "@/lib/content/explanations";
import { buildPageMetadata } from "@/lib/metadata";
import { buildPromiseCardHref } from "@/lib/shareable-card-links";

async function getCurrentAdministrationOverview() {
  return fetchInternalJson("/api/current-administration", {
    ...withRevalidate(PUBLIC_REVALIDATE_SECONDS),
    allow404: true,
    errorMessage: "Failed to fetch current administration overview",
  });
}

export async function generateMetadata() {
  const overview = await getCurrentAdministrationOverview();

  if (!overview) {
    return buildPageMetadata({
      title: "Current Administration",
      description: "The requested current-administration overview could not be found.",
      path: "/current-administration",
    });
  }

  const termLabel = formatTermRange(
    overview?.president?.term_start,
    overview?.president?.term_end
  );

  return buildPageMetadata({
    title: `${overview.administration_name} (${termLabel}) | Live Overview`,
    description:
      "Follow the current administration's reviewed promises, actions, outcomes, and recent verified updates in one public overview.",
    path: "/current-administration",
    imagePath: "/current-administration/opengraph-image",
    type: "article",
  });
}

function MetaPill({ children }) {
  return (
    <span className="public-pill">
      {children}
    </span>
  );
}

function SummaryStat({ label, value, tone = "default" }) {
  const toneClasses =
    tone === "accent"
      ? "border-[rgba(37,99,235,0.16)] bg-[rgba(37,99,235,0.08)]"
      : "border-[var(--line)] bg-white";

  return (
    <div className={`rounded-[1.2rem] border px-4 py-4 ${toneClasses}`}>
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
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

function formatTermRange(start, end) {
  const startYear = start ? new Date(start).getFullYear() : null;
  const endYear = end ? new Date(end).getFullYear() : null;

  if (Number.isFinite(startYear) && Number.isFinite(endYear)) {
    return `${startYear}-${endYear}`;
  }

  if (Number.isFinite(startYear)) {
    return `${startYear}-Present`;
  }

  return "Current Term";
}

function describeImpactPattern(breakdown = {}) {
  const ordered = ["Mixed", "Negative", "Positive", "Blocked"].map((direction) => ({
    direction,
    count: Number(breakdown[direction] || 0),
  }));

  const top = [...ordered].sort((left, right) => right.count - left.count)[0];
  if (!top || top.count <= 0) {
    return "No documented outcomes are tracked yet.";
  }

  const peers = ordered.filter((item) => item.count === top.count && item.count > 0);
  if (peers.length > 1) {
    return "Current tracked outcomes are split across more than one direction.";
  }

  if (top.direction === "Mixed") {
    return "So far, most tracked outcomes are mixed.";
  }

  if (top.direction === "Negative") {
    return "Current tracked outcomes lean negative.";
  }

  if (top.direction === "Positive") {
    return "Current tracked outcomes lean positive.";
  }

  return "Most tracked outcomes remain blocked.";
}

function buildTopicMixLabel(directionCounts = {}) {
  const parts = ["Positive", "Negative", "Mixed", "Blocked"]
    .map((direction) => ({
      direction,
      count: Number(directionCounts[direction] || 0),
    }))
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count);

  if (!parts.length) {
    return "No documented direction yet";
  }

  return parts
    .slice(0, 2)
    .map((item) => `${item.count} ${item.direction.toLowerCase()}`)
    .join(" · ");
}

export default async function CurrentAdministrationPage() {
  const overview = await getCurrentAdministrationOverview();

  if (!overview) {
    notFound();
  }

  const pagePath = "/current-administration";
  const impactPattern = describeImpactPattern(overview.impact_breakdown);
  const explanation = EXPLANATION_CONTENT.currentAdministration;
  const termLabel = formatTermRange(
    overview?.president?.term_start,
    overview?.president?.term_end
  );
  const latestReviewedDate = overview.recent_activity.find((item) => item.latest_action_date)?.latest_action_date;
  const featuredShareHref = overview.featured_records[0]
    ? buildPromiseCardHref(overview.featured_records[0])
    : `/promises/president/${overview.president.slug}?show_all=1`;

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-8">
      <section className="hero-panel p-8 md:p-10">
        <div className="max-w-4xl">
          <p className="eyebrow mb-4">Current Administration</p>
          <h1 className="page-title text-[clamp(2.2rem,4vw,3.5rem)]">
            {overview.administration_name} ({termLabel})
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-[var(--ink-soft)] md:text-lg">
            This page tracks the current presidency term through reviewed Promise Tracker records.
            It shows what has been promised, what actions have happened, and what documented outcomes are in the public record so far.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {overview?.president?.president_party ? (
              <MetaPill>{overview.president.president_party}</MetaPill>
            ) : null}
            <MetaPill>{overview.total_promises} promises tracked</MetaPill>
            <MetaPill>{overview.total_actions} actions recorded</MetaPill>
            <MetaPill>{overview.total_outcomes} outcomes documented</MetaPill>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <CopyShareLinkButton
              path="/current-administration"
              defaultLabel="Share This Overview"
              copiedLabel="Copied!"
              trackPayload={{
                route_kind: "current_administration",
                entity_type: "presidency",
                entity_key: overview.president.slug,
              }}
            />
            <TrackedLink
              href={`/promises/president/${overview.president.slug}?show_all=1`}
              pagePath={pagePath}
              eventType="detail_click"
              routeKind="current_administration"
              entityType="presidency"
              entityKey={overview.president.slug}
              targetPath={`/promises/president/${overview.president.slug}?show_all=1`}
              className="public-button-secondary"
            >
              View all current-term promises
            </TrackedLink>
          </div>
        </div>
      </section>

      <section className="card-surface rounded-[1.6rem] p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-semibold">Current Term Summary</h2>
            <p className="mt-2 text-xs uppercase tracking-[0.14em] text-[var(--ink-soft)]">
              {latestReviewedDate
                ? `Data reflects latest reviewed records through ${formatDate(latestReviewedDate)}`
                : "Data reflects latest reviewed records"}
            </p>
            <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
              {impactPattern}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ImpactBadge impact="Positive" />
            <ImpactBadge impact="Negative" />
            <ImpactBadge impact="Mixed" />
            <ImpactBadge impact="Blocked" />
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3 xl:grid-cols-7">
          <SummaryStat label="Promises" value={overview.total_promises} tone="accent" />
          <SummaryStat label="Actions" value={overview.total_actions} />
          <SummaryStat label="Outcomes" value={overview.total_outcomes} />
          <SummaryStat label="Positive" value={overview.impact_breakdown.Positive || 0} />
          <SummaryStat label="Negative" value={overview.impact_breakdown.Negative || 0} />
          <SummaryStat label="Mixed" value={overview.impact_breakdown.Mixed || 0} />
          <SummaryStat label="Blocked" value={overview.impact_breakdown.Blocked || 0} />
        </div>
      </section>

      <section className="card-surface rounded-[1.6rem] p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-semibold">Recent Activity</h2>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              The newest reviewed records and updates in the current term.
            </p>
          </div>
          <TrackedLink
            href={`/promises/president/${overview.president.slug}?show_all=1`}
            pagePath={pagePath}
            eventType="detail_click"
            routeKind="current_administration"
            entityType="presidency"
            entityKey={overview.president.slug}
            targetPath={`/promises/president/${overview.president.slug}?show_all=1`}
            className="text-sm accent-link"
          >
            View all current-administration promises
          </TrackedLink>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {overview.recent_activity.length === 0 ? (
            <p className="text-sm text-[var(--ink-soft)]">
              No current-administration activity has been published yet.
            </p>
          ) : overview.recent_activity.map((item) => (
            <article key={item.slug} className="panel-link rounded-[1.35rem] p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
                    {item.topic || "No topic"}
                  </p>
                  <h3 className="mt-3 text-lg font-semibold">{item.title}</h3>
                </div>
                <PromiseStatusBadge status={item.status} />
              </div>

              <p className="mt-3 text-sm text-[var(--ink-soft)] leading-6">
                {item.latest_action_title || item.summary || "Tracked current-administration record"}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {item.latest_action_date ? <MetaPill>{formatDate(item.latest_action_date)}</MetaPill> : null}
                {item.latest_impact_direction ? (
                  <ImpactBadge impact={item.latest_impact_direction} />
                ) : null}
              </div>

              <TrustImpactSummaryCard
                record={item}
                detailHref={`/promises/${item.slug}`}
                detailLabel="View record"
              />

              <div className="mt-5 flex flex-wrap gap-3">
                <TrackedLink
                  href={`/promises/${item.slug}`}
                  pagePath={pagePath}
                  eventType="detail_click"
                  routeKind="current_administration"
                  entityType="promise"
                  entityKey={item.slug}
                  targetPath={`/promises/${item.slug}`}
                  className="public-button-primary px-4 py-2"
                >
                  Open record
                </TrackedLink>
                <TrackedLink
                  href={buildPromiseCardHref(item)}
                  pagePath={pagePath}
                  eventType="share_card_click"
                  routeKind="current_administration"
                  entityType="promise"
                  entityKey={item.slug}
                  targetPath={buildPromiseCardHref(item)}
                  className="public-button-secondary px-4 py-2"
                >
                  Share Card
                </TrackedLink>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="card-surface rounded-[1.6rem] p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-2xl font-semibold">Top Impact Areas</h2>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">
                The most active topics in the current administration&apos;s tracked record.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {overview.top_topics.length === 0 ? (
              <p className="text-sm text-[var(--ink-soft)]">No topic summaries are available yet.</p>
            ) : overview.top_topics.map((topic) => (
              <article
                key={topic.topic}
                className="rounded-[1.25rem] border border-[var(--line)] bg-white px-5 py-4"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h3 className="text-lg font-semibold">{topic.topic}</h3>
                    <p className="mt-2 text-sm text-[var(--ink-soft)]">{topic.summary}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <MetaPill>{topic.promise_count} promises</MetaPill>
                    <MetaPill>{topic.action_count} actions</MetaPill>
                    <MetaPill>{buildTopicMixLabel(topic.direction_counts)}</MetaPill>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <section className="card-surface rounded-[1.6rem] p-6">
          <h2 className="text-2xl font-semibold">Build, Interpret, Verify</h2>
          <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--ink-soft)]">
            <p>{explanation.build}</p>
            <p>
              Black Impact Score uses documented outcomes from these records. It does not score
              promises by themselves.
            </p>
          </div>

          <div className="mt-5 rounded-[1.2rem] border border-[var(--line)] bg-[var(--surface-alt)] p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Interpret</p>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              {explanation.interpret}
            </p>
            <ul className="mt-3 space-y-1 text-sm leading-7 text-[var(--ink-soft)]">
              {explanation.verify.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>
      </section>

      <section className="card-surface rounded-[1.6rem] p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-semibold">Featured Current-Administration Records</h2>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              A few high-signal records from the current term to open first.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {overview.featured_records.length === 0 ? (
            <p className="text-sm text-[var(--ink-soft)]">No featured records are available yet.</p>
          ) : overview.featured_records.map((record) => (
            <article key={record.slug} className="panel-link rounded-[1.35rem] p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
                {record.topic || "No topic"}
              </p>
              <h3 className="mt-3 text-lg font-semibold">{record.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">
                {record.summary || "Open the record for actions, outcomes, and sources."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <PromiseStatusBadge status={record.status} />
                {record.impact_direction_for_curation ? (
                  <ImpactBadge impact={record.impact_direction_for_curation} />
                ) : null}
              </div>

              <TrustImpactSummaryCard
                record={record}
                detailHref={`/promises/${record.slug}`}
                detailLabel="View record"
              />

              <div className="mt-5 flex flex-wrap gap-3">
                <TrackedLink
                  href={`/promises/${record.slug}`}
                  pagePath={pagePath}
                  eventType="detail_click"
                  routeKind="current_administration"
                  entityType="promise"
                  entityKey={record.slug}
                  targetPath={`/promises/${record.slug}`}
                  className="text-sm accent-link"
                >
                  Open record
                </TrackedLink>
                <TrackedLink
                  href={buildPromiseCardHref(record)}
                  pagePath={pagePath}
                  eventType="share_card_click"
                  routeKind="current_administration"
                  entityType="promise"
                  entityKey={record.slug}
                  targetPath={buildPromiseCardHref(record)}
                  className="text-sm accent-link"
                >
                  Share Card
                </TrackedLink>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="card-surface rounded-[1.6rem] p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-semibold">Next Steps</h2>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              Move from this overview into records, cards, and the score view.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <TrackedLink
            href={`/promises/president/${overview.president.slug}?show_all=1`}
            pagePath={pagePath}
            eventType="detail_click"
            routeKind="current_administration"
            entityType="presidency"
            entityKey={overview.president.slug}
            targetPath={`/promises/president/${overview.president.slug}?show_all=1`}
            className="panel-link block rounded-[1.35rem] p-5"
          >
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Browse</p>
            <h3 className="mt-3 text-lg font-semibold">View all current-administration promises</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
              Open the full presidency-term Promise Tracker view for the current administration.
            </p>
          </TrackedLink>
          <TrackedLink
            href="/reports/black-impact-score"
            pagePath={pagePath}
            eventType="detail_click"
            routeKind="current_administration"
            entityType="report"
            entityKey="black-impact-score"
            targetPath="/reports/black-impact-score"
            className="panel-link block rounded-[1.35rem] p-5"
          >
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Score</p>
            <h3 className="mt-3 text-lg font-semibold">Open Black Impact Score</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
              See how documented outcomes from Promise Tracker feed the score view.
            </p>
          </TrackedLink>
          <TrackedLink
            href={featuredShareHref}
            pagePath={pagePath}
            eventType="share_card_click"
            routeKind="current_administration"
            entityType="promise"
            entityKey={overview.featured_records[0]?.slug || overview.president.slug}
            targetPath={featuredShareHref}
            className="panel-link block rounded-[1.35rem] p-5"
          >
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Share</p>
            <h3 className="mt-3 text-lg font-semibold">Share a current-administration card</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
              Use the card system when you want a concise, shareable knowledge unit.
            </p>
          </TrackedLink>
        </div>
      </section>
    </main>
  );
}
