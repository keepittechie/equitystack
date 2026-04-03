import Link from "next/link";
import { notFound } from "next/navigation";
import {
  PromiseImpactDirectionBadge,
  PromiseRelevanceBadge,
  PromiseStatusBadge,
  ImpactBadge,
} from "@/app/components/policy-badges";
import HelpfulFeedback from "@/app/components/feedback/HelpfulFeedback";
import SourceDisclosure from "@/app/components/SourceDisclosure";
import TrackedLink from "@/app/components/telemetry/TrackedLink";
import { fetchInternalJson } from "@/lib/api";
import { PUBLIC_REVALIDATE_SECONDS, withRevalidate } from "@/lib/cache";
import { EXPLANATION_CONTENT } from "@/lib/content/explanations";
import { buildPageMetadata } from "@/lib/metadata";
import { buildPromiseJsonLd, serializeJsonLd } from "@/lib/structured-data";
import { buildPromiseCardHref } from "@/lib/shareable-card-links";

async function getPromise(slug) {
  return fetchInternalJson(`/api/promises/${slug}`, {
    ...withRevalidate(PUBLIC_REVALIDATE_SECONDS),
    allow404: true,
    errorMessage: "Failed to fetch promise",
  });
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const promise = await getPromise(slug);

  if (!promise) {
    return buildPageMetadata({
      title: "Promise Not Found",
      description: "The requested Promise Tracker record could not be found on EquityStack.",
      path: `/promises/${slug}`,
    });
  }

  return buildPageMetadata({
    title: `${promise.title} | Promise Tracker`,
    description:
      promise.summary ||
      "Reviewed Promise Tracker record with linked actions, outcomes, sources, and Black community impact context.",
    path: `/promises/${slug}`,
    imagePath: `${buildPromiseCardHref(promise)}/opengraph-image`,
    type: "article",
  });
}

function MiniStat({ label, value, subtitle }) {
  return (
    <div className="card-muted rounded-[1.15rem] px-4 py-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">{label}</p>
      <p className="text-xl font-semibold mt-2">{value}</p>
      {subtitle ? <p className="text-sm text-[var(--ink-soft)] mt-2">{subtitle}</p> : null}
    </div>
  );
}

function MetaPill({ children }) {
  return <span className="public-pill">{children}</span>;
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

function formatTermBadgeLabel(start, end) {
  const startYear = start ? new Date(start).getFullYear() : null;
  const endYear = end ? new Date(end).getFullYear() : null;

  if (Number.isFinite(startYear) && Number.isFinite(endYear)) {
    return `${startYear}-${endYear} term`;
  }

  if (Number.isFinite(startYear)) {
    return `${startYear}-present term`;
  }

  return "Current term";
}

function isScoringReadyPromise(promise) {
  const outcomes = Array.isArray(promise?.outcomes) ? promise.outcomes : [];

  if (!outcomes.length) {
    return false;
  }

  return outcomes.every((outcome) => {
    const hasSummary = Boolean(String(outcome?.outcome_summary || "").trim());
    const hasDirection = Boolean(outcome?.impact_direction);
    const hasSources = Array.isArray(outcome?.outcome_sources) && outcome.outcome_sources.length > 0;
    return hasSummary && hasDirection && hasSources;
  });
}

function getLatestActionDate(promise) {
  const actionDates = (promise?.actions || [])
    .map((action) => action?.action_date)
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()))
    .sort((left, right) => right.getTime() - left.getTime());

  if (!actionDates.length) {
    return null;
  }

  return actionDates[0].toISOString();
}

function actionBadgeClasses(type) {
  switch (type) {
    case "Executive Order":
      return "status-pill--info";
    case "Bill":
      return "status-pill--success";
    case "Agency Action":
      return "status-pill--warning";
    case "Court-Related Action":
      return "status-pill--violet";
    case "Public Reversal":
      return "status-pill--danger";
    default:
      return "status-pill--default";
  }
}

function normalizeMixedText(value) {
  if (!value) return null;

  const normalized = String(value).replace(/\s+/g, " ").trim();
  return normalized || null;
}

function getMixedImpactSummary(promise) {
  const mixedOutcome = promise.outcomes?.find((outcome) => outcome.impact_direction === "Mixed");

  if (!mixedOutcome) {
    return {
      gains: null,
      limits: null,
      fallback: "This record includes documented gains, but also meaningful limits or exclusions.",
    };
  }

  const gains = normalizeMixedText(
    mixedOutcome.measurable_impact || mixedOutcome.outcome_summary
  );
  const limits = normalizeMixedText(mixedOutcome.black_community_impact_note);

  return {
    gains,
    limits,
    fallback: "This record includes documented gains, but also meaningful limits or exclusions.",
  };
}

function formatRelationshipLabel(relationshipType, direction) {
  if (direction === "incoming") {
    if (relationshipType === "builds_on") {
      return "Built on by this record";
    }

    if (relationshipType === "followed_by") {
      return "Earlier related record";
    }

    if (relationshipType === "limited_by") {
      return "Limits this record";
    }
  }

  if (relationshipType === "builds_on") {
    return "Builds on this context";
  }

  if (relationshipType === "followed_by") {
    return "Followed by";
  }

  if (relationshipType === "limited_by") {
    return "Limited by later record";
  }

  return relationshipType;
}

function getRelationshipPriority(relationshipType, direction) {
  if (direction === "incoming") {
    if (relationshipType === "builds_on") return 0;
    if (relationshipType === "followed_by") return 1;
    return 2;
  }

  if (relationshipType === "followed_by") return 0;
  if (relationshipType === "builds_on") return 1;
  return 2;
}

function toDateValue(value) {
  if (!value) return Number.NaN;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? Number.NaN : date.getTime();
}

function selectContextNavRecord(items = [], direction) {
  const candidates = items.filter(
    (item) =>
      item.relationship_type === "builds_on" ||
      item.relationship_type === "followed_by"
  );

  if (!candidates.length) {
    return null;
  }

  const sorted = [...candidates].sort((a, b) => {
    const aDate = toDateValue(a.promise.promise_date);
    const bDate = toDateValue(b.promise.promise_date);

    if (!Number.isNaN(aDate) && !Number.isNaN(bDate) && aDate !== bDate) {
      return direction === "incoming" ? bDate - aDate : aDate - bDate;
    }

    const priorityDiff =
      getRelationshipPriority(a.relationship_type, direction) -
      getRelationshipPriority(b.relationship_type, direction);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return a.promise.title.localeCompare(b.promise.title);
  });

  return sorted[0];
}

function ContextNavCard({ href, label, title, align = "left" }) {
  const alignmentClass = align === "right" ? "md:text-right md:items-end" : "md:items-start";

  return (
    <Link
      href={href}
      className={`panel-link flex min-h-[96px] flex-col justify-between rounded-[1.2rem] p-4 ${alignmentClass}`}
      aria-label={`${label} record: ${title}`}
    >
      <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-soft)]">
        {label === "Previous" ? "\u2190 Previous" : "Next \u2192"}
      </p>
      <p className="mt-3 text-sm font-medium leading-6 text-[var(--ink)]">{title}</p>
    </Link>
  );
}

function ContextNav({ previousRecord, nextRecord }) {
  if (!previousRecord && !nextRecord) {
    return null;
  }

  return (
    <nav
      aria-label="Context navigation"
      className="mb-6 grid gap-3 md:grid-cols-2"
    >
      {previousRecord ? (
        <ContextNavCard
          href={`/promises/${previousRecord.promise.slug}`}
          label="Previous"
          title={previousRecord.promise.title}
        />
      ) : (
        <div className="hidden md:block" aria-hidden="true" />
      )}

      {nextRecord ? (
        <ContextNavCard
          href={`/promises/${nextRecord.promise.slug}`}
          label="Next"
          title={nextRecord.promise.title}
          align="right"
        />
      ) : (
        <div className="hidden md:block" aria-hidden="true" />
      )}
    </nav>
  );
}

function RelationshipList({ items = [], direction }) {
  if (!items.length) {
    return null;
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={`${item.relationship_type}-${item.promise.id}`}>
          <Link
            href={`/promises/${item.promise.slug}`}
            className="panel-link block rounded-[1.15rem] p-4"
          >
            <p className="font-medium leading-6">{item.promise.title}</p>
            <p className="mt-2 text-xs uppercase tracking-[0.14em] text-[var(--ink-soft)]">
              {formatRelationshipLabel(item.relationship_type, direction)}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function PromiseDetailPage({ params }) {
  const { slug } = await params;
  const promise = await getPromise(slug);

  if (!promise) {
    notFound();
  }

  const mixedImpactSummary =
    promise.impact_direction_for_curation === "Mixed" ? getMixedImpactSummary(promise) : null;
  const hasHistoricalContext =
    (promise.related_from_promises?.length || 0) > 0 ||
    (promise.related_to_promises?.length || 0) > 0;
  const previousRecord = selectContextNavRecord(
    promise.related_from_promises,
    "incoming"
  );
  const nextRecord = selectContextNavRecord(promise.related_to_promises, "outgoing");
  const isScoringReady = isScoringReadyPromise(promise);
  const explanation = EXPLANATION_CONTENT.promiseRecord;
  const visibleSourceLinkCount =
    (promise.source_summary?.action_sources || 0) +
    (promise.source_summary?.outcome_sources || 0);
  const latestActionDate = getLatestActionDate(promise);

  return (
    <main className="max-w-7xl mx-auto p-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(buildPromiseJsonLd(promise)),
        }}
      />

      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href={`/promises/president/${promise.president_slug}`}
          className="inline-flex items-center rounded-full border border-[rgba(120,53,15,0.12)] bg-white/80 px-4 py-2 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--accent)]"
        >
          Back to {promise.president} {formatTermBadgeLabel(promise.term_start, promise.term_end)} Promise Tracker
        </Link>
        <Link
          href="/promises/all"
          className="inline-flex items-center rounded-full border border-[rgba(120,53,15,0.12)] bg-white/80 px-4 py-2 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--accent)]"
        >
          Browse All Promises
        </Link>
      </div>

      <section className="hero-panel p-8 md:p-10 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="max-w-4xl">
            <p className="eyebrow mb-4">
              {promise.president} · {formatTermBadgeLabel(promise.term_start, promise.term_end)}
            </p>
            <h1 className="text-3xl md:text-4xl font-bold">{promise.title}</h1>
            <p className="text-base md:text-lg text-[var(--ink-soft)] mt-4 leading-8">
              {promise.summary || "This Promise Tracker record compares a public commitment with the actions and outcomes that followed."}
            </p>
            <p className="mt-4 text-xs uppercase tracking-[0.14em] text-[var(--ink-soft)]">
              {latestActionDate
                ? `Latest reviewed action recorded: ${formatDate(latestActionDate)}`
                : "Data reflects latest reviewed records"}
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <PromiseStatusBadge status={promise.status} />
              <PromiseRelevanceBadge relevance={promise.relevance} />
              <PromiseImpactDirectionBadge impact={promise.impact_direction_for_curation} />
              <MetaPill>{promise.promise_type}</MetaPill>
              <MetaPill>{promise.campaign_or_official}</MetaPill>
              {promise.topic ? <MetaPill>{promise.topic}</MetaPill> : null}
              <MetaPill>{isScoringReady ? "Scoring-ready evidence" : "Needs more outcome evidence"}</MetaPill>
              {promise.is_demo ? <MetaPill>Demo seed data</MetaPill> : null}
            </div>
          </div>
          <TrackedLink
            href={buildPromiseCardHref(promise)}
            eventType="share_card_click"
            routeKind="detail"
            entityType="promise"
            entityKey={promise.slug}
            className="rounded-full border border-[rgba(120,53,15,0.18)] bg-white/80 px-5 py-2 text-sm font-medium"
          >
            Share Card
          </TrackedLink>
        </div>
      </section>

      <ContextNav previousRecord={previousRecord} nextRecord={nextRecord} />

      {mixedImpactSummary ? (
        <section className="card-surface rounded-[1.6rem] p-5 mb-6 border-[rgba(180,83,9,0.12)] bg-[linear-gradient(180deg,rgba(255,251,235,0.9),rgba(255,255,255,0.98))]">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
                Why this is mixed
              </p>
              <p className="text-sm text-[var(--ink-soft)] mt-2 leading-7">
                Mixed records should not be read as simply positive or negative.
              </p>
            </div>
            <PromiseImpactDirectionBadge impact={promise.impact_direction_for_curation} />
          </div>

          {mixedImpactSummary.gains && mixedImpactSummary.limits ? (
            <div className="grid gap-4 md:grid-cols-2 mt-4">
              <div className="card-muted rounded-[1.15rem] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Gains</p>
                <p className="text-sm text-[var(--ink-soft)] mt-2 leading-7">
                  {mixedImpactSummary.gains}
                </p>
              </div>
              <div className="card-muted rounded-[1.15rem] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Limits</p>
                <p className="text-sm text-[var(--ink-soft)] mt-2 leading-7">
                  {mixedImpactSummary.limits}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--ink-soft)] mt-4 leading-7">
              {mixedImpactSummary.fallback}
            </p>
          )}
        </section>
      ) : null}

      {promise.notes || promise.overlap_note ? (
        <section className="card-surface rounded-[1.6rem] p-5 mb-6">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Record Note</p>
          {promise.notes ? (
            <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">{promise.notes}</p>
          ) : null}
          {promise.overlap_note ? (
            <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">{promise.overlap_note}</p>
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <section className="card-surface rounded-[1.6rem] p-5">
            <h2 className="text-xl font-semibold mb-2">Original Promise</h2>
            <p className="text-[var(--ink-soft)] leading-8 whitespace-pre-line">
              {promise.promise_text}
            </p>
          </section>

          <section className="card-surface rounded-[1.6rem] p-5">
            <h2 className="text-xl font-semibold mb-4">Action Timeline</h2>
            <p className="text-sm text-[var(--ink-soft)] leading-7 mb-4">
              Actions document what the federal government did. Outcomes below describe what changed, and each source list shows where the public record comes from.
            </p>
            <div className="space-y-4">
              {promise.actions?.length ? (
                promise.actions.map((action) => (
                  <div key={action.id} className="card-muted rounded-[1.25rem] p-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <p className="text-sm text-[var(--ink-soft)]">
                          {formatDate(action.action_date) || "Date not available"}
                        </p>
                        <h3 className="text-lg font-semibold mt-1">{action.title}</h3>
                      </div>
                      <span
                        className={`status-pill ${actionBadgeClasses(
                          action.action_type
                        )}`}
                      >
                        {action.action_type}
                      </span>
                    </div>

                    {action.description ? (
                      <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">
                        {action.description}
                      </p>
                    ) : null}

                    <div className="flex flex-wrap gap-4 mt-4 text-sm">
                      <span className="text-[var(--ink-soft)]">
                        {action.action_sources?.length || 0} source
                        {action.action_sources?.length === 1 ? "" : "s"} linked
                      </span>
                      {action.related_policy_id ? (
                        <Link href={`/policies/${action.related_policy_id}`} className="accent-link">
                          Related policy: {action.related_policy_title}
                        </Link>
                      ) : null}
                      {action.related_explainer_slug ? (
                        <Link href={`/explainers/${action.related_explainer_slug}`} className="accent-link">
                          Related explainer: {action.related_explainer_title}
                        </Link>
                      ) : null}
                    </div>

                    <SourceDisclosure
                      label="Action Sources"
                      sources={action.action_sources}
                    />
                  </div>
                ))
              ) : (
                <p className="text-[var(--ink-soft)]">No actions are linked to this record yet.</p>
              )}
            </div>
          </section>

          <section className="card-surface rounded-[1.6rem] p-5">
            <h2 className="text-xl font-semibold mb-4">Outcomes</h2>
            <p className="text-sm text-[var(--ink-soft)] leading-7 mb-4">
              Outcomes are the part of the record that can contribute to public scoring. They stay visible here with impact direction and linked sources so readers can verify what shaped the record.
            </p>
            <div className="space-y-4">
              {promise.outcomes?.length ? (
                promise.outcomes.map((outcome) => (
                  <div key={outcome.id} className="card-muted rounded-[1.25rem] p-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
                          {outcome.outcome_type}
                        </p>
                        <p className="text-sm text-[var(--ink-soft)] mt-2 leading-7">
                          {outcome.outcome_summary}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <ImpactBadge impact={outcome.impact_direction} />
                        {outcome.status_override ? (
                          <PromiseStatusBadge status={outcome.status_override} />
                        ) : null}
                      </div>
                    </div>

                    {outcome.measurable_impact ? (
                      <p className="mt-4 text-sm text-[var(--ink-soft)]">
                        <strong>Measured or documented impact:</strong> {outcome.measurable_impact}
                      </p>
                    ) : null}

                    {outcome.black_community_impact_note ? (
                      <p className="mt-3 text-sm text-[var(--ink-soft)]">
                        <strong>Black community impact:</strong> {outcome.black_community_impact_note}
                      </p>
                    ) : null}

                    <p className="mt-3 text-sm text-[var(--ink-soft)]">
                      <strong>Evidence strength:</strong> {outcome.evidence_strength}
                    </p>

                    <p className="mt-3 text-sm text-[var(--ink-soft)]">
                      <strong>Linked sources:</strong> {outcome.outcome_sources?.length || 0}
                    </p>

                    <SourceDisclosure
                      label="Outcome Sources"
                      sources={outcome.outcome_sources}
                    />
                  </div>
                ))
              ) : (
                <p className="text-[var(--ink-soft)]">No outcomes are linked to this record yet.</p>
              )}
            </div>
          </section>

        </div>

        <aside className="space-y-6">
          <section className="card-surface rounded-[1.6rem] p-5">
            <h2 className="text-lg font-semibold mb-3">Tracker Details</h2>
            <div className="space-y-2 text-sm text-[var(--ink-soft)]">
              <p><strong>President:</strong> {promise.president}</p>
              <p><strong>President Party:</strong> {promise.president_party || "Unknown"}</p>
              <p><strong>Promise Date:</strong> {formatDate(promise.promise_date) || "Unknown"}</p>
              <p><strong>Promise Type:</strong> {promise.promise_type}</p>
              <p><strong>Campaign or Official:</strong> {promise.campaign_or_official}</p>
              <p><strong>Topic:</strong> {promise.topic || "Unspecified"}</p>
              <p><strong>Impacted Group:</strong> {promise.impacted_group || "Unspecified"}</p>
              <p><strong>Seed Record:</strong> {promise.is_demo ? "Demo seed data" : "No"}</p>
            </div>
          </section>

          <section className="card-surface rounded-[1.6rem] p-5">
            <h2 className="text-lg font-semibold mb-3">How this record was built</h2>
            <div className="grid gap-4">
              <MiniStat label="Actions" value={promise.actions?.length || 0} />
              <MiniStat label="Outcomes" value={promise.outcomes?.length || 0} />
              <MiniStat
                label="Source Links"
                value={visibleSourceLinkCount}
                subtitle="Visible links attached to action and outcome records."
              />
            </div>
            <p className="text-sm text-[var(--ink-soft)] mt-4 leading-7">
              {explanation.build}
            </p>
            <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">
              {isScoringReady
                ? explanation.interpretReady
                : explanation.interpretPending}
            </p>
            <ul className="mt-3 space-y-1 text-xs text-[var(--ink-soft)]">
              {explanation.verify.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="mt-4 text-xs text-[var(--ink-soft)] space-y-1">
              <p>Action source links: {promise.source_summary?.action_sources || 0}</p>
              <p>Outcome source links: {promise.source_summary?.outcome_sources || 0}</p>
              <p>Scoring-ready: {isScoringReady ? "Yes" : "Not yet"}</p>
            </div>
          </section>

          {hasHistoricalContext ? (
            <section className="card-surface rounded-[1.6rem] p-5">
              <h2 className="text-lg font-semibold mb-3">Historical Context</h2>
              <p className="text-sm text-[var(--ink-soft)] leading-7">
                These links show how this record connects to other federal posture records in the tracker.
              </p>

              {promise.related_from_promises?.length ? (
                <div className="mt-4">
                  <h3 className="text-xs uppercase tracking-[0.16em] text-[var(--accent)] mb-3">
                    Builds on / Comes from
                  </h3>
                  <RelationshipList items={promise.related_from_promises} direction="incoming" />
                </div>
              ) : null}

              {promise.related_to_promises?.length ? (
                <div className="mt-4">
                  <h3 className="text-xs uppercase tracking-[0.16em] text-[var(--accent)] mb-3">
                    Leads to / Followed by
                  </h3>
                  <RelationshipList items={promise.related_to_promises} direction="outgoing" />
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="card-surface rounded-[1.6rem] p-5">
            <h2 className="text-lg font-semibold mb-3">Related Policies</h2>
            {promise.related_policies?.length ? (
              <div className="space-y-3">
                {promise.related_policies.map((policy) => (
                  <Link
                    key={policy.id}
                    href={`/policies/${policy.id}`}
                    className="panel-link block rounded-[1.25rem] p-4"
                  >
                    <p className="font-semibold">{policy.title}</p>
                    <p className="text-sm text-[var(--ink-soft)] mt-1">
                      {policy.year_enacted} • {policy.policy_type} • {policy.status}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-[var(--ink-soft)]">No related policies are linked to this record yet.</p>
            )}
          </section>

          <section className="card-surface rounded-[1.6rem] p-5">
            <h2 className="text-lg font-semibold mb-3">Related Explainers</h2>
            {promise.related_explainers?.length ? (
              <div className="space-y-3">
                {promise.related_explainers.map((explainer) => (
                  <Link
                    key={explainer.id}
                    href={`/explainers/${explainer.slug}`}
                    className="panel-link block rounded-[1.25rem] p-4"
                  >
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
                      {explainer.category || "Explainer"}
                    </p>
                    <p className="font-semibold mt-2">{explainer.title}</p>
                    {explainer.summary ? (
                      <p className="text-sm text-[var(--ink-soft)] mt-2 line-clamp-3">
                        {explainer.summary}
                      </p>
                    ) : null}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-[var(--ink-soft)]">No related explainers are linked to this record yet.</p>
            )}
          </section>
        </aside>
      </div>

      <HelpfulFeedback
        pagePath={`/promises/${promise.slug}`}
        routeKind="detail"
        entityType="promise"
        entityKey={promise.slug}
      />
    </main>
  );
}
