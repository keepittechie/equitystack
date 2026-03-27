import Link from "next/link";
import { ImpactBadge } from "@/app/components/policy-badges";
import { fetchInternalJson } from "@/lib/api";
import { REPORT_REVALIDATE_SECONDS, withRevalidate } from "@/lib/cache";
import { getBlackImpactScoreMethodology } from "@/lib/black-impact-score/methodology.js";
import { aggregatePresidentFromOutcomes } from "@/lib/black-impact-score/presidentAggregation.js";
import { fetchPromiseTimelineRelationshipMap } from "@/lib/services/promiseService";
import { aggregatePromiseScoresByPresident } from "@/lib/promise-tracker-scoring";
import CopyShareLinkButton from "./CopyShareLinkButton";

const REPORT_PATH = "/reports/black-impact-score";
const DEFAULT_TITLE = "Black Impact Score Report";
const DEFAULT_DESCRIPTION =
  "A data-driven report on presidential impact based on documented real-world outcomes affecting Black Americans.";

function normalizeSearchParamEntries(value) {
  const items = Array.isArray(value) ? value : value ? [value] : [];

  return items
    .flatMap((item) => String(item).split(","))
    .map((item) => item.trim())
    .filter(Boolean);
}

function getViewFlags(searchParams = {}) {
  return new Set(normalizeSearchParamEntries(searchParams.view));
}

function appendViewFlags(params, viewFlags) {
  for (const viewFlag of [...viewFlags].sort()) {
    params.append("view", viewFlag);
  }
}

function buildReportHref({
  viewFlags = [],
  mode,
  president,
  presidentA,
  presidentB,
  model,
  topic,
}) {
  const params = new URLSearchParams();
  appendViewFlags(params, new Set(viewFlags));

  if (model && model !== "outcome") {
    params.set("model", model);
  }

  if (typeof topic === "string" && topic.trim()) {
    params.set("topic", topic.trim());
  }

  if (mode === "debate") {
    params.set("mode", "debate");
  }

  if (typeof president === "string" && president.trim()) {
    params.set("president", president.trim());
  }

  if (typeof presidentA === "string" && presidentA.trim()) {
    params.set("president_a", presidentA.trim());
  }

  if (typeof presidentB === "string" && presidentB.trim()) {
    params.set("president_b", presidentB.trim());
  }

  const query = params.toString();
  return query ? `${REPORT_PATH}?${query}` : REPORT_PATH;
}

function normalizeTopicSlug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function formatTopicParam(value) {
  return String(value || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatPresidentSlug(slug) {
  if (!slug) {
    return null;
  }

  return String(slug)
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildMetadataUrl(searchParams = {}) {
  const params = new URLSearchParams();
  appendViewFlags(params, new Set(searchParams.viewFlags || []));

  if (searchParams.model && searchParams.model !== "outcome") {
    params.set("model", searchParams.model);
  }

  if (typeof searchParams.topic === "string" && searchParams.topic.trim()) {
    params.set("topic", searchParams.topic.trim());
  }

  if (searchParams.mode === "debate") {
    params.set("mode", "debate");
  }

  if (typeof searchParams.president === "string" && searchParams.president.trim()) {
    params.set("president", searchParams.president.trim());
  }

  if (typeof searchParams.presidentA === "string" && searchParams.presidentA.trim()) {
    params.set("president_a", searchParams.presidentA.trim());
  }

  if (typeof searchParams.presidentB === "string" && searchParams.presidentB.trim()) {
    params.set("president_b", searchParams.presidentB.trim());
  }

  const query = params.toString();
  return query ? `${REPORT_PATH}?${query}` : REPORT_PATH;
}

function buildOgImageUrl(searchParams = {}) {
  const params = new URLSearchParams();
  appendViewFlags(params, new Set(searchParams.viewFlags || []));

  if (searchParams.model && searchParams.model !== "outcome") {
    params.set("model", searchParams.model);
  }

  if (typeof searchParams.topic === "string" && searchParams.topic.trim()) {
    params.set("topic", searchParams.topic.trim());
  }

  if (searchParams.mode === "debate") {
    params.set("mode", "debate");
  }

  if (typeof searchParams.president === "string" && searchParams.president.trim()) {
    params.set("president", searchParams.president.trim());
  }

  if (typeof searchParams.presidentA === "string" && searchParams.presidentA.trim()) {
    params.set("president_a", searchParams.presidentA.trim());
  }

  if (typeof searchParams.presidentB === "string" && searchParams.presidentB.trim()) {
    params.set("president_b", searchParams.presidentB.trim());
  }

  const query = params.toString();
  return query
    ? `${REPORT_PATH}/opengraph-image?${query}`
    : `${REPORT_PATH}/opengraph-image`;
}

export async function generateMetadata({ searchParams }) {
  const resolvedSearchParams = (await searchParams) || {};
  const viewFlags = getViewFlags(resolvedSearchParams);
  const isPublicShareView = viewFlags.has("public-share");
  const isPublicView = viewFlags.has("public") || isPublicShareView;
  const isTimelineView = viewFlags.has("timeline");
  const isTopicCompareView = viewFlags.has("topic-compare");
  const isPresidentCompareView = viewFlags.has("president-compare");
  const isDebateMode = resolvedSearchParams.mode === "debate";
  const presidentSlug =
    typeof resolvedSearchParams.president === "string" ? resolvedSearchParams.president.trim() : "";
  const presidentASlug =
    typeof resolvedSearchParams.president_a === "string" ? resolvedSearchParams.president_a.trim() : "";
  const presidentBSlug =
    typeof resolvedSearchParams.president_b === "string" ? resolvedSearchParams.president_b.trim() : "";
  const topicParam =
    typeof resolvedSearchParams.topic === "string" ? resolvedSearchParams.topic.trim() : "";
  const presidentName = formatPresidentSlug(presidentSlug);
  const presidentAName = formatPresidentSlug(presidentASlug);
  const presidentBName = formatPresidentSlug(presidentBSlug);
  const requestedModel =
    resolvedSearchParams.model === "legacy" || resolvedSearchParams.model === "compare"
      ? resolvedSearchParams.model
      : "outcome";

  let title = DEFAULT_TITLE;
  let description = DEFAULT_DESCRIPTION;

  if (presidentName && isPublicView) {
    title = `${presidentName} Black Impact Score Report`;
    description =
      `A data-driven view of ${presidentName}'s documented outcome-based Black Impact Score and the records that shape it.`;
  } else if (presidentName) {
    title = `${presidentName} Black Impact Score`;
    description =
      `A data-driven view of ${presidentName}'s documented outcome-based Black Impact Score and supporting report context.`;
  } else if (isPublicView) {
    title = "Black Impact Score Public Report";
    description =
      "A shareable data-driven report on presidential impact based on documented real-world outcomes affecting Black Americans.";
  }

  if (isPublicShareView) {
    title = presidentName
      ? `${presidentName} Black Impact Score Share View`
      : "Black Impact Score Share View";
    description = presidentName
      ? `A public share view of ${presidentName}'s Black Impact Score with visible drivers and verification context.`
      : "A public share view of the Black Impact Score with visible drivers and verification context.";
  }

  if (isTimelineView) {
    title = presidentName
      ? `${presidentName} Black Impact Score Timeline`
      : "Black Impact Score Timeline";
    description = presidentName
      ? `A chronological view of Promise Tracker records and documented Black Impact Score context for ${presidentName}.`
      : "A chronological view of Promise Tracker records and documented Black Impact Score context across presidents.";
  }

  if (isTopicCompareView) {
    title = topicParam
      ? `Black Impact Score Topic Comparison · ${formatTopicParam(topicParam)}`
      : "Black Impact Score Topic Comparison";
    description = topicParam
      ? `A topic-specific comparison of presidents using existing Black Impact Score records filtered to ${formatTopicParam(topicParam)}.`
      : "A topic-specific comparison view for Black Impact Score records.";
  }

  if (isPresidentCompareView) {
    title = topicParam
      ? `President Comparison · ${formatTopicParam(topicParam)}`
      : "President Comparison";
    description =
      presidentAName && presidentBName && topicParam
        ? `A side-by-side comparison of ${presidentAName} and ${presidentBName} within ${formatTopicParam(topicParam)} using existing Black Impact Score records.`
        : "A side-by-side comparison of two presidents within a selected Black Impact Score topic.";
  }

  if (topicParam) {
    const topicLabel = formatTopicParam(topicParam);
    title = `${title} · ${topicLabel}`;
    description = `${description} Filtered to ${topicLabel}.`;
  }

  if (isDebateMode) {
    title = presidentName
      ? `${presidentName} Black Impact Score Debate View`
      : "Black Impact Score Debate View";
    description = presidentName
      ? `A debate-oriented view of ${presidentName}'s strongest Black Impact Score drivers using documented outcomes and source-backed records.`
      : "A debate-oriented view of the Black Impact Score highlighting the strongest documented score drivers and source-backed records.";
  }

  if (isPublicShareView) {
    title = presidentName
      ? `${presidentName} Black Impact Score Share View`
      : topicParam
        ? `Black Impact Score Share View · ${formatTopicParam(topicParam)}`
        : "Black Impact Score Share View";
    description = isDebateMode
      ? "A public share view of the Black Impact Score with visible drivers, verification context, and debate-ready evidence trails."
      : "A public share view of the Black Impact Score with visible drivers and verification context.";
  }

  const url = buildMetadataUrl({
    viewFlags,
    mode: isDebateMode ? "debate" : null,
    president: presidentSlug || null,
    presidentA: presidentASlug || null,
    presidentB: presidentBSlug || null,
    model: requestedModel,
    topic: topicParam || null,
  });
  const imageUrl = buildOgImageUrl({
    viewFlags,
    mode: isDebateMode ? "debate" : null,
    president: presidentSlug || null,
    presidentA: presidentASlug || null,
    presidentB: presidentBSlug || null,
    model: requestedModel,
    topic: topicParam || null,
  });

  return {
    title,
    description,
    alternates: {
      canonical: REPORT_PATH,
    },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

async function getBlackImpactScores(model) {
  const query = model && model !== "outcome" ? `?model=${model}` : "";

  return fetchInternalJson(`/api/promises/scores${query}`, {
    ...withRevalidate(REPORT_REVALIDATE_SECONDS),
    errorMessage: "Failed to fetch Black Impact Score data",
  });
}

function MetaPill({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[rgba(120,53,15,0.12)] bg-white/80 px-3 py-1 text-xs text-[var(--ink-soft)]">
      {children}
    </span>
  );
}

function TrustBadge({ label, description }) {
  return (
    <span
      title={description}
      className="inline-flex items-center rounded-full border border-[rgba(120,53,15,0.18)] bg-[rgba(255,252,247,0.92)] px-3 py-1 text-xs font-medium text-[var(--ink)]"
    >
      {label}
    </span>
  );
}

function getEffectiveScoringModel({ metadata, usingLegacyModel }) {
  if (typeof metadata?.scoring_model === "string" && metadata.scoring_model.trim()) {
    return metadata.scoring_model.trim();
  }

  return usingLegacyModel ? "legacy" : "outcome-based";
}

function normalizeOutcomeMetadata(metadata) {
  return {
    total_promises: Number(metadata?.total_promises || 0),
    total_outcomes: Number(metadata?.total_outcomes || 0),
    total_loaded_promises: Number(metadata?.total_loaded_promises || 0),
    total_loaded_outcomes: Number(metadata?.total_loaded_outcomes || 0),
    scoring_model:
      typeof metadata?.scoring_model === "string" && metadata.scoring_model.trim()
        ? metadata.scoring_model.trim()
        : "outcome-based-v1",
  };
}

function getModelStatusLabel({ metadata, usingLegacyModel, isLegacyFallbackActive }) {
  const scoringModel = getEffectiveScoringModel({ metadata, usingLegacyModel });

  if (isLegacyFallbackActive) {
    return "Legacy fallback active";
  }

  if (usingLegacyModel) {
    return "Legacy model";
  }

  if (scoringModel.toLowerCase().includes("outcome")) {
    return "Outcome-based model";
  }

  return "Scoring model active";
}

function getScoreContextText({ metadata, usingLegacyModel, isLegacyFallbackActive }) {
  const scoringModel = getEffectiveScoringModel({ metadata, usingLegacyModel });

  if (isLegacyFallbackActive) {
    return `Legacy promise-based fallback scoring is currently shown for this president (${scoringModel}).`;
  }

  if (usingLegacyModel) {
    return `The ${scoringModel} methodology is currently shown for this president.`;
  }

  return `The ${scoringModel} methodology is currently shown for this president.`;
}

function isOutcomeScoringModel({ metadata, usingLegacyModel }) {
  return !usingLegacyModel && getEffectiveScoringModel({ metadata, usingLegacyModel }).toLowerCase().includes("outcome");
}

function ScoreCard({ label, value, subtitle }) {
  return (
    <div className="card-muted rounded-[1.15rem] px-4 py-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">{label}</p>
      <p className="text-2xl font-bold mt-2">{value}</p>
      {subtitle ? <p className="text-xs text-[var(--ink-soft)] mt-2">{subtitle}</p> : null}
    </div>
  );
}

function formatRawScore(value) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : String(value);
}

function formatNormalizedScore(value) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : String(value);
}

function formatSignedScore(value) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return String(value);
  const fixed = numeric.toFixed(2);
  return numeric > 0 ? `+${fixed}` : fixed;
}

function getCoverageSignal({ promiseCount, outcomeCount, usingLegacyModel, isLegacyFallbackActive }) {
  const normalizedPromiseCount = Number(promiseCount || 0);
  const normalizedOutcomeCount = Number(outcomeCount || 0);

  if (normalizedOutcomeCount >= 24 || normalizedPromiseCount >= 18) {
    return {
      label: "Higher coverage",
      description: "This view reflects a broader set of currently tracked records.",
    };
  }

  if (normalizedOutcomeCount >= 10 || normalizedPromiseCount >= 8) {
    return {
      label: "Moderate coverage",
      description: "This view reflects a meaningful but still partial set of currently tracked records.",
    };
  }

  if (isLegacyFallbackActive) {
    return {
      label: "Limited coverage",
      description: "Legacy fallback is active, so this view uses a narrower currently available record set.",
    };
  }

  if (usingLegacyModel) {
    return {
      label: "Limited coverage",
      description: "This view is based on the currently tracked legacy record set.",
    };
  }

  return {
    label: "Limited coverage",
    description: "This view reflects a smaller set of currently tracked records.",
  };
}

function CredibilityNote({ promiseCount, outcomeCount, effectiveScoringModel, usingLegacyModel, isLegacyFallbackActive }) {
  const coverageSignal = getCoverageSignal({
    promiseCount,
    outcomeCount,
    usingLegacyModel,
    isLegacyFallbackActive,
  });

  return (
    <section className="card-muted rounded-[1.25rem] p-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="max-w-3xl">
          <h3 className="text-lg font-semibold">Data Credibility</h3>
          <p className="text-sm text-[var(--ink-soft)] mt-2 leading-7">
            This score reflects currently tracked records in EquityStack. Coverage may expand as additional records and sources are added.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <MetaPill>{coverageSignal.label}</MetaPill>
          <MetaPill>Based on {promiseCount} records</MetaPill>
          {outcomeCount != null ? <MetaPill>Based on {outcomeCount} outcomes</MetaPill> : null}
          <MetaPill>{effectiveScoringModel}</MetaPill>
        </div>
      </div>
      <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">
        {coverageSignal.description}
      </p>
    </section>
  );
}

function formatTimelineDate(value) {
  if (!value) return "Date not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsed);
}

function getPromiseEvidenceSourceCount(promise) {
  const explicitCount = Number(promise?.source_count || 0);
  if (Number.isFinite(explicitCount) && explicitCount > 0) {
    return explicitCount;
  }

  const scoredOutcomes = Array.isArray(promise?.scored_outcomes) ? promise.scored_outcomes : [];
  const derivedCount = scoredOutcomes.reduce(
    (count, outcome) => count + Number(outcome?.factors?.source_count || 0),
    0
  );

  return derivedCount > 0 ? derivedCount : null;
}

function getTopAndBottomPresidents(presidents = []) {
  const sorted = [...presidents].sort((left, right) => {
    const scoreDiff = Number(right.normalized_score || 0) - Number(left.normalized_score || 0);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    return String(left.president || "").localeCompare(String(right.president || ""));
  });

  return {
    top: sorted.slice(0, 3),
    bottom: [...sorted].reverse().slice(0, 3),
  };
}

function formatImpactDisplayLabel(label) {
  return label === "Mixed" ? "Mixed Impact" : label;
}

function getPrimaryImpactDirection(promise) {
  const directions = (promise.scored_outcomes || [])
    .map((item) => item.impact_direction)
    .filter(Boolean);

  if (directions.includes("Mixed")) return "Mixed";
  if (directions.includes("Blocked")) return "Blocked";
  if (directions.includes("Negative")) return "Negative";
  if (directions.includes("Positive")) return "Positive";

  return null;
}

function CountBarGroup({ title, counts }) {
  const entries = Object.entries(counts || {});
  const max = Math.max(...entries.map(([, count]) => Number(count || 0)), 0);

  return (
    <section className="card-muted rounded-[1.25rem] p-4">
      <h3 className="text-lg font-semibold">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-[var(--ink-soft)] mt-3">No breakdown data is available.</p>
      ) : (
        <div className="space-y-3 mt-3">
          {entries.map(([label, count]) => {
            const numericCount = Number(count || 0);
            const width = max > 0 ? `${(numericCount / max) * 100}%` : "0%";
            const displayLabel = formatImpactDisplayLabel(label);

            return (
              <div key={label}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-[var(--ink-soft)]">{displayLabel}</span>
                  <span className="font-medium">{numericCount}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-[rgba(120,53,15,0.08)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--accent)]"
                    style={{ width }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function TopicBreakdown({ items }) {
  return (
    <section className="card-muted rounded-[1.25rem] p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-lg font-semibold">Topic Breakdown</h3>
        <MetaPill>Sorted by absolute score contribution</MetaPill>
      </div>
      {items?.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => (
            <MetaPill key={item.topic}>
              {item.topic}: {formatSignedScore(item.raw_score_total)}
            </MetaPill>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--ink-soft)] mt-3">No topic breakdown is available.</p>
      )}
    </section>
  );
}

function PromiseDriverList({ title, items, emptyMessage, linkToPromises = true }) {
  return (
    <section className="card-muted rounded-[1.25rem] p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        <MetaPill>{items.length} shown</MetaPill>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-[var(--ink-soft)]">{emptyMessage}</p>
      ) : (
        <div className="space-y-3">
          {items.slice(0, 3).map((promise) => {
            const impactDirection = getPrimaryImpactDirection(promise);

            return (
              <div
                key={promise.slug || promise.id || promise.title}
                className={`rounded-[1rem] border bg-white/85 p-4 ${
                  impactDirection === "Mixed"
                    ? "border-[rgba(180,83,9,0.14)] bg-[linear-gradient(180deg,rgba(255,251,235,0.86),rgba(255,255,255,0.98))]"
                    : "border-[rgba(120,53,15,0.1)]"
                }`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
                      {promise.topic || "No topic"}
                    </p>
                    {promise.slug && linkToPromises ? (
                      <Link href={`/promises/${promise.slug}`} className="accent-link text-base font-semibold mt-2 inline-block">
                        {promise.title}
                      </Link>
                    ) : (
                      <p className="text-base font-semibold mt-2">{promise.title}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {impactDirection ? <ImpactBadge impact={impactDirection} /> : null}
                    <MetaPill>{formatSignedScore(promise.total_score)}</MetaPill>
                  </div>
                </div>

                <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">
                  {promise.explanation_summary || "No explanation is available for this record yet."}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <MetaPill>{promise.outcome_count || 0} outcomes</MetaPill>
                </div>

                <div className="mt-4">
                  <EvidencePanelTrigger
                    promise={promise}
                    label="View Evidence"
                    linkToPromises={true}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function StrongestDriverCard({ title, promise, linkToPromises = true }) {
  return (
    <section className="card-muted rounded-[1.25rem] p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-lg font-semibold">{title}</h3>
        {promise ? <MetaPill>{formatSignedScore(promise.total_score)}</MetaPill> : null}
      </div>

      {!promise ? (
        <p className="text-sm text-[var(--ink-soft)] mt-3">No driver is currently available for this category.</p>
      ) : (
        <div className="mt-3 rounded-[1rem] border border-[rgba(120,53,15,0.1)] bg-white/85 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">{promise.topic || "No topic"}</p>
          {promise.slug && linkToPromises ? (
            <Link href={`/promises/${promise.slug}`} className="accent-link text-base font-semibold mt-2 inline-block">
              {promise.title}
            </Link>
          ) : (
            <p className="text-base font-semibold mt-2">{promise.title}</p>
          )}
          <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">
            {promise.explanation_summary || "No explanation is available for this record yet."}
          </p>
          <div className="mt-4">
            <EvidencePanelTrigger
              promise={promise}
              label="View Evidence"
              linkToPromises={true}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function EvidencePanelContent({ promise, linkToPromises = true }) {
  const impactDirection = getPrimaryImpactDirection(promise) || promise?.impact_direction || null;
  const sourceCount = getPromiseEvidenceSourceCount(promise);

  if (!promise) {
    return (
      <p className="text-sm text-[var(--ink-soft)]">
        No driver is available for this evidence panel.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
          {promise.topic || "Promise Tracker record"}
        </p>
        {promise.slug && linkToPromises ? (
          <Link href={`/promises/${promise.slug}`} className="accent-link text-base font-semibold mt-2 inline-block">
            {promise.title}
          </Link>
        ) : (
          <p className="text-base font-semibold mt-2">{promise.title}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {promise.president ? <MetaPill>{promise.president}</MetaPill> : null}
        {impactDirection ? <ImpactBadge impact={impactDirection} /> : null}
        {promise.total_score != null ? <MetaPill>{formatSignedScore(promise.total_score)}</MetaPill> : null}
        {promise.outcome_count ? <MetaPill>{promise.outcome_count} outcomes</MetaPill> : null}
        {sourceCount ? <MetaPill>{sourceCount} source references</MetaPill> : null}
      </div>

      <p className="text-sm text-[var(--ink-soft)] leading-7">
        {promise.explanation_summary || "No explanation summary is available for this record."}
      </p>

      {sourceCount ? (
        <p className="text-sm text-[var(--ink-soft)] leading-7">
          Source support is available for this record. Review the Promise Tracker page for the underlying sources and linked outcomes.
        </p>
      ) : (
        <p className="text-sm text-[var(--ink-soft)] leading-7">
          Inline source detail is not available in this panel. Review the Promise Tracker page for the underlying record and sources.
        </p>
      )}
    </div>
  );
}

function EvidencePanelTrigger({ promise, label = "View Evidence", linkToPromises = true }) {
  return (
    <details className="rounded-[1rem] border border-[rgba(120,53,15,0.1)] bg-[rgba(255,252,247,0.92)]">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-[var(--ink)]">
        {label}
      </summary>
      <div className="border-t border-[rgba(120,53,15,0.08)] px-4 py-4">
        <EvidencePanelContent promise={promise} linkToPromises={linkToPromises} />
      </div>
    </details>
  );
}

function EvidencePanelGroup({
  title,
  items,
  linkToPromises = true,
  emptyMessage = "No evidence records are available for this section.",
}) {
  const visibleItems = (items || []).filter(Boolean);

  return (
    <details className="card-muted rounded-[1.25rem] p-4">
      <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--ink)]">
        {title}
      </summary>
      <div className="mt-4 space-y-4">
        {visibleItems.length ? (
          visibleItems.map((item) => (
            <div
              key={item.slug || item.id || item.title}
              className="rounded-[1rem] border border-[rgba(120,53,15,0.1)] bg-white/85 p-4"
            >
              <EvidencePanelContent promise={item} linkToPromises={linkToPromises} />
            </div>
          ))
        ) : (
          <p className="text-sm text-[var(--ink-soft)]">{emptyMessage}</p>
        )}
      </div>
    </details>
  );
}

function getPrimaryImpactArea(president) {
  const topTopic = (president.score_by_topic || [])[0];

  if (!topTopic?.topic) {
    return null;
  }

  return {
    topic: topTopic.topic,
    raw_score_total: topTopic.raw_score_total,
  };
}

function getImbalanceSignal(president) {
  const counts = president.counts_by_direction || {};
  const positive = Number(counts.Positive || 0);
  const negative = Number(counts.Negative || 0);
  const mixed = Number(counts.Mixed || 0);
  const blocked = Number(counts.Blocked || 0);

  if (negative >= 2 && negative > positive * 1.5) {
    return "Negative outcomes outweigh positive outcomes in this score profile.";
  }

  if (mixed + blocked >= 2 && mixed + blocked >= positive + negative) {
    return "Mixed and blocked outcomes make up a large share of this score profile.";
  }

  return null;
}

function getPresidentInsightLines(president) {
  const insights = [];
  const primaryImpactArea = getPrimaryImpactArea(president);
  const topPositive = president.top_positive_promises?.[0] || null;
  const topNegative = president.top_negative_promises?.[0] || null;

  if (primaryImpactArea) {
    insights.push(`Most of this president's score is concentrated in ${primaryImpactArea.topic}.`);
  }

  if (topNegative?.topic) {
    insights.push(`Negative impact is driven most visibly by ${topNegative.topic}.`);
  } else if (topPositive?.topic) {
    insights.push(`Positive impact is concentrated most clearly in ${topPositive.topic}.`);
  }

  if (topPositive?.topic && topNegative?.topic && topPositive.topic !== topNegative.topic) {
    insights.push("Positive and negative contributions are concentrated in different policy areas.");
  }

  return insights.slice(0, 3);
}

function SystemLevelInsight({ presidents, metadata }) {
  const totals = {
    Positive: 0,
    Negative: 0,
    Mixed: 0,
    Blocked: 0,
  };
  const topicTotals = new Map();

  for (const president of presidents) {
    for (const [label, count] of Object.entries(president.counts_by_direction || {})) {
      totals[label] = (totals[label] || 0) + Number(count || 0);
    }

    for (const item of president.score_by_topic || []) {
      const current = topicTotals.get(item.topic) || 0;
      topicTotals.set(item.topic, current + Math.abs(Number(item.raw_score_total || 0)));
    }
  }

  const dominantTopic = [...topicTotals.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0] || null;

  return (
    <section className="card-surface rounded-[1.6rem] p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="max-w-3xl">
          <h2 className="text-lg font-semibold mb-2">System-Level Insight</h2>
          <p className="text-sm text-[var(--ink-soft)] leading-7">
            These summary signals describe the current score corpus as a whole. They help identify
            the dominant impact mix and the main topic area shaping the report.
          </p>
        </div>
        {metadata?.scoring_model ? <MetaPill>{metadata.scoring_model}</MetaPill> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3 mt-5">
        <ScoreCard
          label="Total Outcomes"
          value={metadata?.total_outcomes ?? 0}
          subtitle="Documented outcomes included in the live model"
        />
        <ScoreCard
          label="Impact Distribution"
          value={`${totals.Positive}/${totals.Negative}/${totals.Mixed}/${totals.Blocked}`}
          subtitle="Positive, Negative, Mixed, and Blocked counts"
        />
        <ScoreCard
          label="Dominant Topic"
          value={dominantTopic?.[0] || "Unavailable"}
          subtitle="Largest absolute contribution across all presidents"
        />
      </div>
    </section>
  );
}

function PresidentInsightPanel({ president }) {
  const primaryImpactArea = getPrimaryImpactArea(president);
  const imbalanceSignal = getImbalanceSignal(president);
  const insightLines = getPresidentInsightLines(president);

  return (
    <section className="card-muted rounded-[1.25rem] p-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold">Key Insight</h3>
          <p className="text-sm text-[var(--ink-soft)] mt-2 leading-7">
            Derived from topic contribution, directional mix, and the strongest positive and negative drivers.
          </p>
        </div>
        {imbalanceSignal ? <MetaPill>Context Signal</MetaPill> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mt-5">
        <div className="rounded-[1rem] border border-[rgba(120,53,15,0.1)] bg-white/85 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Primary Impact Area</p>
          <p className="text-base font-semibold mt-2">{primaryImpactArea?.topic || "Unavailable"}</p>
          <p className="text-sm text-[var(--ink-soft)] mt-2">
            {primaryImpactArea
              ? `Largest absolute topic contribution: ${formatSignedScore(primaryImpactArea.raw_score_total)}`
              : "No topic contribution data is available for this president."}
          </p>
        </div>

        <div className="rounded-[1rem] border border-[rgba(120,53,15,0.1)] bg-white/85 p-4 lg:col-span-2">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Insight Summary</p>
          {insightLines.length ? (
            <ul className="mt-3 space-y-2 text-sm text-[var(--ink-soft)] leading-7">
              {insightLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--ink-soft)] mt-3">
              Not enough structured detail is available to generate a fuller topic insight for this president yet.
            </p>
          )}

          {imbalanceSignal ? (
            <p className="text-sm text-[var(--ink-soft)] mt-4 leading-7">
              <strong className="text-[var(--ink)]">Context signal:</strong> {imbalanceSignal}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function PresidentCredibilityPanel({
  president,
  effectiveScoringModel,
  usingLegacyModel,
  isLegacyFallbackActive,
}) {
  const coverageSignal = getCoverageSignal({
    promiseCount: president.promise_count,
    outcomeCount: president.outcome_count,
    usingLegacyModel,
    isLegacyFallbackActive,
  });

  return (
    <section className="card-muted rounded-[1.25rem] p-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="max-w-3xl">
          <h3 className="text-lg font-semibold">Coverage Context</h3>
          <p className="text-sm text-[var(--ink-soft)] mt-2 leading-7">
            This score reflects the currently visible records for this president in EquityStack.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <MetaPill>{coverageSignal.label}</MetaPill>
          <MetaPill>Based on {president.promise_count} records</MetaPill>
          {president.outcome_count != null ? <MetaPill>Based on {president.outcome_count} outcomes</MetaPill> : null}
          <MetaPill>{effectiveScoringModel}</MetaPill>
        </div>
      </div>
      <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">
        {coverageSignal.description}
      </p>
    </section>
  );
}

function TopSummarySection({ presidents }) {
  const summary = getTopAndBottomPresidents(presidents);

  return (
    <section className="card-surface rounded-[1.6rem] p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="max-w-3xl">
          <h2 className="text-lg font-semibold mb-2">Top Summary</h2>
          <p className="text-sm text-[var(--ink-soft)] leading-7">
            A quick view of the highest and lowest normalized scores in the current report.
          </p>
        </div>
        <MetaPill>{presidents.length} presidents included</MetaPill>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mt-5">
        <section className="card-muted rounded-[1.25rem] p-4">
          <h3 className="text-lg font-semibold">Highest Impact</h3>
          <div className="mt-3 space-y-3">
            {summary.top.map((president) => (
              <div
                key={`top-${president.president_slug}`}
                className="rounded-[1rem] border border-[rgba(120,53,15,0.1)] bg-white/85 p-4"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <p className="text-base font-semibold">{president.president}</p>
                  <MetaPill>{formatNormalizedScore(president.normalized_score)}</MetaPill>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card-muted rounded-[1.25rem] p-4">
          <h3 className="text-lg font-semibold">Lowest Impact</h3>
          <div className="mt-3 space-y-3">
            {summary.bottom.map((president) => (
              <div
                key={`bottom-${president.president_slug}`}
                className="rounded-[1rem] border border-[rgba(120,53,15,0.1)] bg-white/85 p-4"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <p className="text-base font-semibold">{president.president}</p>
                  <MetaPill>{formatNormalizedScore(president.normalized_score)}</MetaPill>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function MethodologySection({ methodology, metadata, usingLegacyModel, isLegacyFallbackActive }) {
  const effectiveScoringModel = getEffectiveScoringModel({ metadata, usingLegacyModel });
  const usingOutcomeModel = isOutcomeScoringModel({ metadata, usingLegacyModel });

  return (
    <section className="card-surface rounded-[1.6rem] p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="max-w-3xl">
          <h2 className="text-lg font-semibold mb-2">How This Score Is Calculated</h2>
          <p className="text-sm text-[var(--ink-soft)] leading-7">
            {usingOutcomeModel
              ? "Scores are based on documented real-world outcomes, not just promises or enacted laws. Each outcome is classified as positive, negative, mixed, or blocked, then weighted by evidence strength and available source support before president totals are aggregated."
              : isLegacyFallbackActive
                ? "Scores are currently using the legacy promise-based fallback model. Records are summarized from editorial relevance, impact direction, and current promise status while the outcome-based model is unavailable."
                : "Scores are currently using the legacy promise-based model. Records are summarized from editorial relevance, impact direction, and current promise status."}
          </p>
        </div>
        <a
          href="#methodology"
          className="rounded-full border border-[rgba(120,53,15,0.18)] bg-white/80 px-5 py-2 text-sm font-medium"
        >
          View Methodology
        </a>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mt-5">
        {usingOutcomeModel ? (
          <>
            <ScoreCard
              label="Outcome Types"
              value="4"
              subtitle="Positive, Negative, Mixed, and Blocked"
            />
            <ScoreCard
              label="Evidence Weighting"
              value="Active"
              subtitle="Stronger evidence carries more weight"
            />
            <ScoreCard
              label="Source Support"
              value="Included"
              subtitle="Outcome records incorporate source counts"
            />
            <ScoreCard
              label="Aggregation"
              value="By President"
              subtitle={`President scores roll up from ${effectiveScoringModel}`}
            />
          </>
        ) : (
          <>
            <ScoreCard
              label="Scoring Model"
              value={effectiveScoringModel}
              subtitle={
                isLegacyFallbackActive
                  ? "Legacy promise-based fallback scoring is currently active"
                  : "Legacy promise-based scoring is currently active"
              }
            />
            <ScoreCard
              label="Relevance Weights"
              value={Object.keys(methodology?.relevance_weights || {}).length || "Active"}
              subtitle="Legacy scores incorporate editorial relevance"
            />
            <ScoreCard
              label="Impact Direction"
              value="Included"
              subtitle="Legacy scores incorporate curated impact direction"
            />
            <ScoreCard
              label="Aggregation"
              value="By President"
              subtitle="President scores roll up from legacy promise records"
            />
          </>
        )}
      </div>
    </section>
  );
}

function ShareHeader({ shareUrl }) {
  return (
    <section className="card-surface rounded-[1.6rem] p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Share This Report</p>
          <h2 className="text-2xl font-semibold mt-2">Black Impact Score Report</h2>
          <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">
            A data-driven analysis of presidential impact based on real-world outcomes affecting Black Americans.
          </p>
        </div>
        <CopyShareLinkButton path={shareUrl} />
      </div>
      <div className="mt-4 rounded-[1rem] border border-[rgba(120,53,15,0.1)] bg-white/85 px-4 py-3 text-sm text-[var(--ink-soft)] break-all">
        {shareUrl}
      </div>
    </section>
  );
}

function PermalinkSection({ permalinkUrl, isPublicView }) {
  return (
    <section className="card-surface rounded-[1.6rem] p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="max-w-3xl">
          <h2 className="text-lg font-semibold mb-2">Permalink</h2>
          <p className="text-sm text-[var(--ink-soft)] leading-7">
            This stable link preserves the current report state, including active filters, view mode, and comparison context.
          </p>
        </div>
        <CopyShareLinkButton
          path={permalinkUrl}
          defaultLabel="Copy Permalink"
          copiedLabel="Permalink Copied"
        />
      </div>
      <div className={`mt-4 rounded-[1rem] border border-[rgba(120,53,15,0.1)] bg-white/85 px-4 py-3 text-sm text-[var(--ink-soft)] break-all ${isPublicView ? "" : ""}`}>
        {permalinkUrl}
      </div>
    </section>
  );
}

function SourceAwareShareHeader({
  shareUrl,
  selectedTopic,
  effectiveScoringModel,
  isLegacyFallbackActive,
  usingLegacyModel,
}) {
  const modeLabel = isLegacyFallbackActive
    ? "Legacy fallback"
    : usingLegacyModel
      ? "Legacy"
      : "Outcome-based";

  return (
    <section className="card-surface rounded-[1.6rem] p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Source-Aware Share View</p>
          <h2 className="text-2xl font-semibold mt-2">Black Impact Score</h2>
          <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">
            This shared view highlights the visible score context, strongest available drivers, and the quickest path to verification.
          </p>
        </div>
        <CopyShareLinkButton path={shareUrl} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {selectedTopic ? <MetaPill>Topic: {selectedTopic.label}</MetaPill> : null}
        <MetaPill>{effectiveScoringModel}</MetaPill>
        <MetaPill>{modeLabel}</MetaPill>
      </div>
      <div className="mt-4 rounded-[1rem] border border-[rgba(120,53,15,0.1)] bg-white/85 px-4 py-3 text-sm text-[var(--ink-soft)] break-all">
        {shareUrl}
      </div>
    </section>
  );
}

function DebateModeHeader() {
  return (
    <section className="card-surface rounded-[1.6rem] p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Debate Mode</p>
          <h2 className="text-2xl font-semibold mt-2">Debate Mode</h2>
          <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">
            This view highlights the strongest score drivers and links back to the underlying Promise Tracker records.
          </p>
        </div>
        <TrustBadge
          label="Receipts Enabled"
          description="This view emphasizes the strongest score drivers and the records used to verify them."
        />
      </div>
    </section>
  );
}

function VerificationSection() {
  return (
    <section className="card-surface rounded-[1.6rem] p-5">
      <h2 className="text-lg font-semibold">How to Verify</h2>
      <ul className="mt-3 space-y-2 text-sm text-[var(--ink-soft)] leading-7">
        <li>Review the linked Promise Tracker record.</li>
        <li>Check documented outcomes tied to that promise.</li>
        <li>Review supporting sources.</li>
        <li>Compare the record against the methodology section.</li>
      </ul>
    </section>
  );
}

function ShareVerificationSection() {
  return (
    <section className="card-surface rounded-[1.6rem] p-5">
      <h2 className="text-lg font-semibold">How to verify this view</h2>
      <ul className="mt-3 space-y-2 text-sm text-[var(--ink-soft)] leading-7">
        <li>Review the linked Promise Tracker record.</li>
        <li>Check the documented outcomes attached to that record.</li>
        <li>Review the supporting sources on the record page.</li>
        <li>Compare the record against the methodology section.</li>
      </ul>
    </section>
  );
}

function collectShareEvidenceItems({
  presidents,
  selectedPresidentA,
  selectedPresidentB,
  isPresidentCompareView,
}) {
  if (isPresidentCompareView) {
    return [
      {
        key: "president-a-positive",
        label: selectedPresidentA ? `${selectedPresidentA.president} strongest positive driver` : "President A strongest positive driver",
        promise: selectedPresidentA?.top_positive_promises?.[0] || null,
      },
      {
        key: "president-a-negative",
        label: selectedPresidentA ? `${selectedPresidentA.president} strongest negative driver` : "President A strongest negative driver",
        promise: selectedPresidentA?.top_negative_promises?.[0] || null,
      },
      {
        key: "president-b-positive",
        label: selectedPresidentB ? `${selectedPresidentB.president} strongest positive driver` : "President B strongest positive driver",
        promise: selectedPresidentB?.top_positive_promises?.[0] || null,
      },
      {
        key: "president-b-negative",
        label: selectedPresidentB ? `${selectedPresidentB.president} strongest negative driver` : "President B strongest negative driver",
        promise: selectedPresidentB?.top_negative_promises?.[0] || null,
      },
    ].filter((item) => item.promise);
  }

  const strongestPositive = presidents
    .flatMap((president) => president.top_positive_promises?.[0] || [])
    .filter(Boolean)
    .sort((left, right) => Number(right.total_score || 0) - Number(left.total_score || 0))[0] || null;
  const strongestNegative = presidents
    .flatMap((president) => president.top_negative_promises?.[0] || [])
    .filter(Boolean)
    .sort((left, right) => Number(left.total_score || 0) - Number(right.total_score || 0))[0] || null;

  return [
    {
      key: "strongest-positive",
      label: "Strongest positive driver",
      promise: strongestPositive,
    },
    {
      key: "strongest-negative",
      label: "Strongest negative driver",
      promise: strongestNegative,
    },
  ].filter((item) => item.promise);
}

function SourceAwareEvidenceTrail({ items, isPublicView }) {
  return (
    <section className="card-surface rounded-[1.6rem] p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="max-w-3xl">
          <h2 className="text-lg font-semibold mb-2">Top Evidence Trail</h2>
          <p className="text-sm text-[var(--ink-soft)] leading-7">
            These are the strongest visible records in the current shared view and provide the fastest path to verification.
          </p>
        </div>
        {items.length ? <MetaPill>{items.length} visible drivers</MetaPill> : null}
      </div>

      {items.length === 0 ? (
        <div className="card-muted rounded-[1.25rem] p-5 mt-5">
          <p className="text-sm text-[var(--ink-soft)]">
            No visible drivers are available for the current shared report state.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2 mt-5">
          {items.map((item) => (
            <div key={item.key} className="card-muted rounded-[1.25rem] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">{item.label}</p>
              <div className="mt-3 rounded-[1rem] border border-[rgba(120,53,15,0.1)] bg-white/85 p-4">
                <EvidencePanelContent promise={item.promise} linkToPromises={true} />
                {!getPromiseEvidenceSourceCount(item.promise) ? (
                  <p className="text-sm text-[var(--ink-soft)] mt-4 leading-7">
                    Source titles are not listed in this share view. Review the Promise Tracker record for the full supporting-source trail.
                  </p>
                ) : null}
                {item.promise?.slug && isPublicView ? (
                  <div className="mt-4">
                    <Link
                      href={`/promises/${item.promise.slug}`}
                      className="rounded-full border border-[rgba(120,53,15,0.12)] bg-white/80 px-4 py-2 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--accent)]"
                    >
                      Open Promise Tracker record
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TopicFilterSection({
  topicOptions,
  selectedTopic,
  allTopicsHref,
  buildTopicHref,
  isPublicView,
}) {
  if (!topicOptions.length) {
    return null;
  }

  return (
    <section className="card-surface rounded-[1.6rem] p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="max-w-3xl">
          <h2 className="text-lg font-semibold mb-2">Topic Filter</h2>
          <p className="text-sm text-[var(--ink-soft)] leading-7">
            Limit the current report view to one policy topic using the records already loaded for this page.
          </p>
        </div>
        {selectedTopic ? <MetaPill>Filtered Topic: {selectedTopic.label}</MetaPill> : null}
      </div>

      <div className={`mt-4 flex flex-wrap gap-2 ${isPublicView ? "" : ""}`}>
        <Link
          href={allTopicsHref}
          className={`rounded-full border px-4 py-2 text-sm font-medium ${
            !selectedTopic
              ? "border-[rgba(120,53,15,0.2)] bg-[rgba(120,53,15,0.08)] text-[var(--ink)]"
              : "border-[rgba(120,53,15,0.12)] bg-white/80 text-[var(--ink-soft)] hover:text-[var(--accent)]"
          }`}
        >
          All topics
        </Link>
        {topicOptions.map((topic) => (
          <Link
            key={topic.value}
            href={buildTopicHref(topic.value)}
            className={`rounded-full border px-4 py-2 text-sm font-medium ${
              selectedTopic?.value === topic.value
                ? "border-[rgba(120,53,15,0.2)] bg-[rgba(120,53,15,0.08)] text-[var(--ink)]"
                : "border-[rgba(120,53,15,0.12)] bg-white/80 text-[var(--ink-soft)] hover:text-[var(--accent)]"
            }`}
          >
            {topic.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

function ViewToggleSection({ standardHref, timelineHref, isTimelineView }) {
  return (
    <section className="card-surface rounded-[1.6rem] p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="max-w-3xl">
          <h2 className="text-lg font-semibold mb-2">View Mode</h2>
          <p className="text-sm text-[var(--ink-soft)] leading-7">
            Switch between the president summary report and the chronological timeline view without changing the underlying scoring model.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={standardHref}
            className={`rounded-full border px-4 py-2 text-sm font-medium ${
              !isTimelineView
                ? "border-[rgba(120,53,15,0.2)] bg-[rgba(120,53,15,0.08)] text-[var(--ink)]"
                : "border-[rgba(120,53,15,0.12)] bg-white/80 text-[var(--ink-soft)] hover:text-[var(--accent)]"
            }`}
          >
            Report View
          </Link>
          <Link
            href={timelineHref}
            className={`rounded-full border px-4 py-2 text-sm font-medium ${
              isTimelineView
                ? "border-[rgba(120,53,15,0.2)] bg-[rgba(120,53,15,0.08)] text-[var(--ink)]"
                : "border-[rgba(120,53,15,0.12)] bg-white/80 text-[var(--ink-soft)] hover:text-[var(--accent)]"
            }`}
          >
            Timeline View
          </Link>
        </div>
      </div>
    </section>
  );
}

function MultiViewToggleSection({
  reportHref,
  timelineHref,
  topicCompareHref,
  presidentCompareHref,
  isTimelineView,
  isTopicCompareView,
  isPresidentCompareView,
}) {
  return (
    <section className="card-surface rounded-[1.6rem] p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="max-w-3xl">
          <h2 className="text-lg font-semibold mb-2">View Mode</h2>
          <p className="text-sm text-[var(--ink-soft)] leading-7">
            Switch between the report, the chronological timeline, and the topic comparison view without changing the underlying scoring model.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={reportHref}
            className={`rounded-full border px-4 py-2 text-sm font-medium ${
              !isTimelineView && !isTopicCompareView
                ? "border-[rgba(120,53,15,0.2)] bg-[rgba(120,53,15,0.08)] text-[var(--ink)]"
                : "border-[rgba(120,53,15,0.12)] bg-white/80 text-[var(--ink-soft)] hover:text-[var(--accent)]"
            }`}
          >
            Report View
          </Link>
          <Link
            href={timelineHref}
            className={`rounded-full border px-4 py-2 text-sm font-medium ${
              isTimelineView
                ? "border-[rgba(120,53,15,0.2)] bg-[rgba(120,53,15,0.08)] text-[var(--ink)]"
                : "border-[rgba(120,53,15,0.12)] bg-white/80 text-[var(--ink-soft)] hover:text-[var(--accent)]"
            }`}
          >
            Timeline View
          </Link>
          <Link
            href={topicCompareHref}
            className={`rounded-full border px-4 py-2 text-sm font-medium ${
              isTopicCompareView
                ? "border-[rgba(120,53,15,0.2)] bg-[rgba(120,53,15,0.08)] text-[var(--ink)]"
                : "border-[rgba(120,53,15,0.12)] bg-white/80 text-[var(--ink-soft)] hover:text-[var(--accent)]"
            }`}
          >
            Topic Comparison
          </Link>
          <Link
            href={presidentCompareHref}
            className={`rounded-full border px-4 py-2 text-sm font-medium ${
              isPresidentCompareView
                ? "border-[rgba(120,53,15,0.2)] bg-[rgba(120,53,15,0.08)] text-[var(--ink)]"
                : "border-[rgba(120,53,15,0.12)] bg-white/80 text-[var(--ink-soft)] hover:text-[var(--accent)]"
            }`}
          >
            President Comparison
          </Link>
        </div>
      </div>
    </section>
  );
}

function getTimelineRelationshipLabel(relationshipType) {
  if (relationshipType === "followed_by") {
    return "Followed by";
  }

  if (relationshipType === "builds_on") {
    return "Builds toward";
  }

  if (relationshipType === "limited_by") {
    return "Later limited by";
  }

  return "Related record";
}

function getTimelineRelationshipPriority(relationshipType) {
  if (relationshipType === "followed_by") return 0;
  if (relationshipType === "builds_on") return 1;
  if (relationshipType === "limited_by") return 2;
  return 3;
}

function CausalTimelineSummary({ entries }) {
  const connectedCount = entries.filter((entry) => entry.causal_link).length;

  return (
    <section className="card-muted rounded-[1.25rem] p-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="max-w-3xl">
          <h3 className="text-lg font-semibold mb-2">Causal Timeline</h3>
          <p className="text-sm text-[var(--ink-soft)] leading-7">
            This view shows how scored records unfold over time and where the tracker has explicit historical relationships between them.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <MetaPill>{entries.length} entries</MetaPill>
          {connectedCount ? <MetaPill>{connectedCount} linked transitions</MetaPill> : null}
        </div>
      </div>
    </section>
  );
}

function TimelineConnector({ relationshipType, crossesPresident }) {
  return (
    <div className="flex items-center gap-3 px-3 py-1 text-sm text-[var(--ink-soft)]">
      <div className="h-px flex-1 bg-[rgba(120,53,15,0.12)]" />
      <span className="rounded-full border border-[rgba(120,53,15,0.14)] bg-[rgba(255,252,247,0.92)] px-3 py-1 text-xs font-medium text-[var(--ink)]">
        {getTimelineRelationshipLabel(relationshipType)}
      </span>
      {crossesPresident ? (
        <span className="text-xs uppercase tracking-[0.14em] text-[var(--accent)]">
          Crosses administrations
        </span>
      ) : null}
      <div className="h-px flex-1 bg-[rgba(120,53,15,0.12)]" />
    </div>
  );
}

function TimelineModeSection({ entries, isPublicView, effectiveScoringModel, selectedTopic }) {
  return (
    <section className="card-surface rounded-[1.6rem] p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="max-w-3xl">
          <h2 className="text-lg font-semibold mb-2">Timeline Mode</h2>
          <p className="text-sm text-[var(--ink-soft)] leading-7">
            This chronological view reuses the current report&apos;s scoring results and adds simple relationship cues where Promise Tracker records are directly connected.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <MetaPill>{entries.length} entries</MetaPill>
          <MetaPill>{effectiveScoringModel}</MetaPill>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="card-muted rounded-[1.25rem] p-5 mt-5">
          <p className="text-sm text-[var(--ink-soft)]">
            {selectedTopic
              ? `No scored timeline records matched ${selectedTopic.label} in the current view.`
              : "No timeline entries are available for the current filters."}
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <CausalTimelineSummary entries={entries} />

          <div className="max-h-[70vh] overflow-y-auto pr-1">
          <div className="space-y-4">
            {entries.map((entry, index) => {
              const previousEntry = index > 0 ? entries[index - 1] : null;
              const showPresidentDivider =
                !previousEntry || previousEntry.president_slug !== entry.president_slug;

              return (
                <div key={entry.slug || entry.id || `${entry.title}-${index}`}>
                  <article
                    className={`relative rounded-[1.35rem] border bg-white/90 p-5 md:p-6 ${
                      entry.impact_direction === "Mixed"
                        ? "border-[rgba(180,83,9,0.14)] bg-[linear-gradient(180deg,rgba(255,251,235,0.9),rgba(255,255,255,0.98))]"
                        : "border-[rgba(120,53,15,0.1)]"
                    }`}
                  >
                    {showPresidentDivider ? (
                      <div className="mb-4 flex items-center gap-3 flex-wrap">
                        <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
                          {entry.president || "President not available"}
                        </p>
                        {entry.president_party ? <MetaPill>{entry.president_party}</MetaPill> : null}
                      </div>
                    ) : null}

                    <div className="grid gap-4 md:grid-cols-[160px,minmax(0,1fr)] md:gap-6">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
                          {formatTimelineDate(entry.promise_date)}
                        </p>
                        <p className="text-sm text-[var(--ink-soft)] mt-2">
                          President score: {formatNormalizedScore(entry.normalized_president_score ?? 0)}
                        </p>
                        <p className="text-xs text-[var(--ink-soft)] mt-2">
                          Model: {effectiveScoringModel}
                        </p>
                        {entry.impact_direction ? (
                          <div className="mt-3">
                            <ImpactBadge impact={entry.impact_direction} />
                          </div>
                        ) : null}
                      </div>

                      <div>
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="max-w-3xl">
                            <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
                              {entry.topic || "Promise Tracker record"}
                            </p>
                            {entry.slug && !isPublicView ? (
                              <Link href={`/promises/${entry.slug}`} className="accent-link text-xl font-semibold mt-2 inline-block">
                                {entry.title}
                              </Link>
                            ) : (
                              <h3 className="text-xl font-semibold mt-2">{entry.title}</h3>
                            )}
                          </div>
                          <MetaPill>{formatSignedScore(entry.total_score)}</MetaPill>
                        </div>

                        <p className="text-sm text-[var(--ink-soft)] mt-4 leading-7">
                          {entry.explanation_summary || "No explanation is available for this record yet."}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {entry.status ? <MetaPill>{entry.status}</MetaPill> : null}
                          {entry.outcome_count ? <MetaPill>{entry.outcome_count} outcomes</MetaPill> : null}
                          {entry.causal_link ? (
                            <MetaPill>
                              {getTimelineRelationshipLabel(entry.causal_link.relationship_type)}
                            </MetaPill>
                          ) : null}
                        </div>

                        {entry.causal_link?.promise ? (
                          <div className="mt-5 rounded-[1rem] border border-[rgba(120,53,15,0.1)] bg-[rgba(255,252,247,0.92)] px-4 py-3 text-sm text-[var(--ink-soft)]">
                            <span className="font-medium text-[var(--ink)]">
                              {getTimelineRelationshipLabel(entry.causal_link.relationship_type)}:{" "}
                            </span>
                            {entry.causal_link.promise.slug && !isPublicView ? (
                              <Link href={`/promises/${entry.causal_link.promise.slug}`} className="accent-link">
                                {entry.causal_link.promise.title}
                              </Link>
                            ) : (
                              <span className="text-[var(--ink)]">{entry.causal_link.promise.title}</span>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </article>
                  {entry.connector_to_next ? (
                    <TimelineConnector
                      relationshipType={entry.connector_to_next.relationship_type}
                      crossesPresident={entry.connector_to_next.crosses_president}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
        </div>
      )}
    </section>
  );
}

function TopicComparisonSection({
  presidents,
  selectedTopic,
  effectiveScoringModel,
  usingLegacyModel,
  isLegacyFallbackActive,
  requestedPresidentSlug,
}) {
  if (!selectedTopic) {
    return (
      <section className="card-surface rounded-[1.6rem] p-6">
        <h2 className="text-lg font-semibold">Topic Comparison</h2>
        <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">
          Select a topic to compare presidents within a single policy domain.
        </p>
      </section>
    );
  }

  if (requestedPresidentSlug) {
    return (
      <section className="card-surface rounded-[1.6rem] p-6">
        <h2 className="text-lg font-semibold">Topic Comparison</h2>
        <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">
          Topic comparison is reduced in single-president view. Clear the president filter to compare presidents within {selectedTopic.label}.
        </p>
      </section>
    );
  }

  if (!presidents.length) {
    return (
      <section className="card-surface rounded-[1.6rem] p-6">
        <h2 className="text-lg font-semibold">Topic Comparison</h2>
        <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">
          No scored records matched {selectedTopic.label} in the current comparison view.
        </p>
      </section>
    );
  }

  const rankedPresidents = [...presidents].sort((left, right) => {
    const normalizedDiff = Number(right.normalized_score || 0) - Number(left.normalized_score || 0);
    if (normalizedDiff !== 0) {
      return normalizedDiff;
    }

    const rawDiff = Number(right.raw_score || 0) - Number(left.raw_score || 0);
    if (rawDiff !== 0) {
      return rawDiff;
    }

    return String(left.president || "").localeCompare(String(right.president || ""));
  });

  const strongestPositive = rankedPresidents[0] || null;
  const strongestNegative = [...rankedPresidents].reverse()[0] || null;
  const modeLabel = isLegacyFallbackActive
    ? "Legacy fallback"
    : usingLegacyModel
      ? "Legacy"
      : "Outcome-based";

  return (
    <section className="card-surface rounded-[1.6rem] p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="max-w-3xl">
          <h2 className="text-lg font-semibold mb-2">Topic Comparison</h2>
          <p className="text-sm text-[var(--ink-soft)] leading-7">
            This view compares presidents within the currently selected topic using the same scored records shown elsewhere in the report.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <MetaPill>{selectedTopic.label}</MetaPill>
          <MetaPill>{rankedPresidents.length} presidents</MetaPill>
          <MetaPill>{effectiveScoringModel}</MetaPill>
          <MetaPill>{modeLabel}</MetaPill>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mt-5">
        <div className="card-muted rounded-[1.25rem] p-4">
          <h3 className="text-lg font-semibold">Strongest Positive President</h3>
          {strongestPositive ? (
            <div className="mt-3">
              <p className="text-base font-semibold">{strongestPositive.president}</p>
              <p className="text-sm text-[var(--ink-soft)] mt-2">
                Normalized score: {formatNormalizedScore(strongestPositive.normalized_score)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-[var(--ink-soft)] mt-3">No comparison data is available.</p>
          )}
        </div>

        <div className="card-muted rounded-[1.25rem] p-4">
          <h3 className="text-lg font-semibold">Strongest Negative President</h3>
          {strongestNegative ? (
            <div className="mt-3">
              <p className="text-base font-semibold">{strongestNegative.president}</p>
              <p className="text-sm text-[var(--ink-soft)] mt-2">
                Normalized score: {formatNormalizedScore(strongestNegative.normalized_score)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-[var(--ink-soft)] mt-3">No comparison data is available.</p>
          )}
        </div>
      </div>

      <div className="space-y-4 mt-5">
        {rankedPresidents.map((president) => (
          <section key={president.president_slug} className="card-muted rounded-[1.25rem] p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="max-w-3xl">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-semibold">{president.president}</h3>
                  {president.president_party ? <MetaPill>{president.president_party}</MetaPill> : null}
                </div>
                <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">
                  {president.explanation || "No explanation is available for this president in the current topic."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <MetaPill>Normalized {formatNormalizedScore(president.normalized_score)}</MetaPill>
                <MetaPill>Raw {formatRawScore(president.raw_score)}</MetaPill>
                <MetaPill>{president.promise_count} promises</MetaPill>
                {president.outcome_count != null ? <MetaPill>{president.outcome_count} outcomes</MetaPill> : null}
              </div>
            </div>
            <div className="mt-4">
              <EvidencePanelGroup
                title="Evidence Panel"
                items={[
                  president.top_positive_promises?.[0] || null,
                  president.top_negative_promises?.[0] || null,
                ]}
                linkToPromises={true}
                emptyMessage="No driver evidence is available for this president in the current topic."
              />
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function PresidentCompareSelectorSection({
  options,
  selectedPresidentASlug,
  selectedPresidentBSlug,
  buildPresidentCompareHref,
}) {
  if (!options.length) {
    return null;
  }

  return (
    <section className="card-surface rounded-[1.6rem] p-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold mb-2">Select President A</h2>
          <div className="flex flex-wrap gap-2">
            {options.map((option) => (
              <Link
                key={`a-${option.slug}`}
                href={buildPresidentCompareHref(option.slug, selectedPresidentBSlug)}
                className={`rounded-full border px-4 py-2 text-sm font-medium ${
                  selectedPresidentASlug === option.slug
                    ? "border-[rgba(120,53,15,0.2)] bg-[rgba(120,53,15,0.08)] text-[var(--ink)]"
                    : "border-[rgba(120,53,15,0.12)] bg-white/80 text-[var(--ink-soft)] hover:text-[var(--accent)]"
                }`}
              >
                {option.name}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-2">Select President B</h2>
          <div className="flex flex-wrap gap-2">
            {options.map((option) => (
              <Link
                key={`b-${option.slug}`}
                href={buildPresidentCompareHref(selectedPresidentASlug, option.slug)}
                className={`rounded-full border px-4 py-2 text-sm font-medium ${
                  selectedPresidentBSlug === option.slug
                    ? "border-[rgba(120,53,15,0.2)] bg-[rgba(120,53,15,0.08)] text-[var(--ink)]"
                    : "border-[rgba(120,53,15,0.12)] bg-white/80 text-[var(--ink-soft)] hover:text-[var(--accent)]"
                }`}
              >
                {option.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PresidentComparisonSection({
  presidents,
  selectedTopic,
  effectiveScoringModel,
  usingLegacyModel,
  isLegacyFallbackActive,
  selectedPresidentA,
  selectedPresidentB,
  selectedPresidentASlug,
  selectedPresidentBSlug,
}) {
  if (!selectedTopic) {
    return (
      <section className="card-surface rounded-[1.6rem] p-6">
        <h2 className="text-lg font-semibold">President Comparison</h2>
        <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">
          Select a topic before comparing two presidents.
        </p>
      </section>
    );
  }

  if (!selectedPresidentASlug || !selectedPresidentBSlug) {
    return (
      <section className="card-surface rounded-[1.6rem] p-6">
        <h2 className="text-lg font-semibold">President Comparison</h2>
        <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">
          Select two presidents to compare within {selectedTopic.label}.
        </p>
      </section>
    );
  }

  if (selectedPresidentASlug === selectedPresidentBSlug) {
    return (
      <section className="card-surface rounded-[1.6rem] p-6">
        <h2 className="text-lg font-semibold">President Comparison</h2>
        <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">
          President comparison requires two different presidents.
        </p>
      </section>
    );
  }

  if (!selectedPresidentA || !selectedPresidentB) {
    return (
      <section className="card-surface rounded-[1.6rem] p-6">
        <h2 className="text-lg font-semibold">President Comparison</h2>
        <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">
          One or both selected presidents do not have scored records in {selectedTopic.label} for the current model and filters.
        </p>
      </section>
    );
  }

  const modeLabel = isLegacyFallbackActive
    ? "Legacy fallback"
    : usingLegacyModel
      ? "Legacy"
      : "Outcome-based";
  const normalizedDelta = Number(selectedPresidentA.normalized_score || 0) - Number(selectedPresidentB.normalized_score || 0);
  const rawDelta = Number(selectedPresidentA.raw_score || 0) - Number(selectedPresidentB.raw_score || 0);
  const primaryImpactAreaA = getPrimaryImpactArea(selectedPresidentA);
  const primaryImpactAreaB = getPrimaryImpactArea(selectedPresidentB);

  function PresidentCompareCard({ president, primaryImpactArea }) {
    const topPositive = president.top_positive_promises?.[0] || null;
    const topNegative = president.top_negative_promises?.[0] || null;

    return (
      <section className="card-muted rounded-[1.25rem] p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xl font-semibold">{president.president}</h3>
              {president.president_party ? <MetaPill>{president.president_party}</MetaPill> : null}
            </div>
            <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">
              {president.explanation || "No explanation is available for this president in the current topic."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <MetaPill>Normalized {formatNormalizedScore(president.normalized_score)}</MetaPill>
            <MetaPill>Raw {formatRawScore(president.raw_score)}</MetaPill>
            <MetaPill>{president.promise_count} promises</MetaPill>
            {president.outcome_count != null ? <MetaPill>{president.outcome_count} outcomes</MetaPill> : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mt-5">
          <div className="rounded-[1rem] border border-[rgba(120,53,15,0.1)] bg-white/85 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Primary Impact Area</p>
            <p className="text-base font-semibold mt-2">{primaryImpactArea?.topic || "Unavailable"}</p>
          </div>
          <div className="rounded-[1rem] border border-[rgba(120,53,15,0.1)] bg-white/85 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Top Positive Driver</p>
            <p className="text-base font-semibold mt-2">{topPositive?.title || "Unavailable"}</p>
          </div>
          <div className="rounded-[1rem] border border-[rgba(120,53,15,0.1)] bg-white/85 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Top Negative Driver</p>
            <p className="text-base font-semibold mt-2">{topNegative?.title || "Unavailable"}</p>
          </div>
        </div>

        <div className="mt-4">
          <EvidencePanelGroup
            title="Evidence Panel"
            items={[topPositive, topNegative]}
            linkToPromises={true}
            emptyMessage="No driver evidence is available for this president in the current comparison."
          />
        </div>
      </section>
    );
  }

  return (
    <section className="card-surface rounded-[1.6rem] p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="max-w-3xl">
          <h2 className="text-lg font-semibold mb-2">President Comparison</h2>
          <p className="text-sm text-[var(--ink-soft)] leading-7">
            This view compares two presidents within the selected topic using the same scored records already loaded for this report.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <MetaPill>{selectedTopic.label}</MetaPill>
          <MetaPill>{selectedPresidentA.president}</MetaPill>
          <MetaPill>{selectedPresidentB.president}</MetaPill>
          <MetaPill>{effectiveScoringModel}</MetaPill>
          <MetaPill>{modeLabel}</MetaPill>
        </div>
      </div>

      <div className="card-muted rounded-[1.25rem] p-4 mt-5">
        <h3 className="text-lg font-semibold">Delta Summary</h3>
        <div className="flex flex-wrap gap-2 mt-3">
          <MetaPill>Normalized delta {formatSignedScore(normalizedDelta)}</MetaPill>
          <MetaPill>Raw delta {formatSignedScore(rawDelta)}</MetaPill>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2 mt-5">
        <PresidentCompareCard president={selectedPresidentA} primaryImpactArea={primaryImpactAreaA} />
        <PresidentCompareCard president={selectedPresidentB} primaryImpactArea={primaryImpactAreaB} />
      </div>
    </section>
  );
}

function normalizeOutcomePresident(president) {
  return {
    president: president.president,
    president_slug: president.president_slug,
    president_party: president.president_party,
    raw_score: president.raw_score_total,
    normalized_score: president.normalized_score_total,
    promise_count: president.promise_count,
    outcome_count: president.outcome_count,
    explanation: president.explanation_summary,
    counts_by_direction: president.breakdowns?.by_direction || {},
    counts_by_confidence: president.breakdowns?.by_confidence || {},
    score_by_topic: president.breakdowns?.by_topic || [],
    top_positive_promises: president.top_positive_promises || [],
    top_negative_promises: president.top_negative_promises || [],
  };
}

function normalizeLegacyPresident(president) {
  return {
    president: president.president,
    president_slug: president.president_slug,
    president_party: president.president_party,
    raw_score: president.raw_score,
    normalized_score: president.normalized_score,
    promise_count: president.promise_count,
    outcome_count: null,
    explanation: president.score_explanation,
    counts_by_direction: president.counts_by_impact_direction || {},
    counts_by_confidence: president.counts_by_relevance || {},
    score_by_topic: (president.score_by_topic || []).map((item) => ({
      topic: item.topic,
      raw_score_total: item.raw_score,
    })),
    top_positive_promises: president.top_positive_promises || [],
    top_negative_promises: president.top_negative_promises || [],
  };
}

function normalizeOutcomeRecord(record) {
  return {
    id: record.id,
    slug: record.slug || null,
    title: record.title || "Untitled promise",
    topic: record.topic || null,
    status: record.status || null,
    president: record.president || null,
    president_slug: record.president_slug || null,
    president_party: record.president_party || null,
    promise_date: record.promise_date || null,
    total_score: Number(record.total_score || 0),
    outcome_count: Number(record.outcome_count || 0),
    explanation_summary: record.explanation_summary || null,
    scored_outcomes: record.scored_outcomes || [],
    impact_direction: getPrimaryImpactDirection(record),
  };
}

function normalizeTopicOption(topic) {
  const label = String(topic || "").trim();

  return {
    label,
    value: normalizeTopicSlug(label),
  };
}

function getAvailableTopicOptions(records = []) {
  return [...new Set(
    records
      .map((record) => String(record?.topic || "").trim())
      .filter(Boolean)
  )]
    .sort((left, right) => left.localeCompare(right))
    .map(normalizeTopicOption);
}

function resolveSelectedTopic(topicOptions = [], rawTopicParam) {
  if (!rawTopicParam) {
    return null;
  }

  const normalizedParam = normalizeTopicSlug(rawTopicParam);

  return (
    topicOptions.find((option) => option.label === rawTopicParam) ||
    topicOptions.find((option) => option.value === normalizedParam) ||
    {
      label: rawTopicParam,
      value: normalizedParam || rawTopicParam,
    }
  );
}

function getPresidentCompareOptions(presidents = []) {
  return [...presidents]
    .sort((left, right) => String(left.president || "").localeCompare(String(right.president || "")))
    .map((president) => ({
      slug: president.president_slug,
      name: president.president,
      party: president.president_party || null,
    }));
}

function normalizeLegacyRecord(record) {
  return {
    id: record.id,
    slug: record.slug || null,
    title: record.title || "Untitled promise",
    topic: record.topic || null,
    status: record.status || null,
    president: record.president || null,
    president_slug: record.president_slug || null,
    president_party: record.president_party || null,
    promise_date: record.promise_date || null,
    total_score: Number(record.raw_score || 0),
    outcome_count: 0,
    explanation_summary: record.summary || null,
    scored_outcomes: [],
    impact_direction:
      record.scoring_impact_direction === "Blocked/Unrealized" ||
      record.impact_direction_for_curation === "Blocked/Unrealized"
        ? "Blocked"
        : record.scoring_impact_direction ||
          record.impact_direction_for_curation ||
          null,
  };
}

function compareTimelineEntries(left, right) {
  const leftDate = left?.promise_date ? new Date(left.promise_date).getTime() : Number.NaN;
  const rightDate = right?.promise_date ? new Date(right.promise_date).getTime() : Number.NaN;

  if (!Number.isNaN(leftDate) && !Number.isNaN(rightDate) && leftDate !== rightDate) {
    return leftDate - rightDate;
  }

  if (!Number.isNaN(leftDate) && Number.isNaN(rightDate)) {
    return -1;
  }

  if (Number.isNaN(leftDate) && !Number.isNaN(rightDate)) {
    return 1;
  }

  return String(left?.title || "").localeCompare(String(right?.title || ""));
}

function pickTimelineLead(record, relationshipMap, visiblePromiseIds) {
  const relationships = relationshipMap.get(record.id) || [];
  const visibleRelationships = relationships.filter((item) =>
    visiblePromiseIds.has(item.promise.id)
  );

  if (!visibleRelationships.length) {
    return null;
  }

  const preferredRelationship =
    visibleRelationships.find((item) => item.relationship_type === "followed_by") ||
    visibleRelationships.find((item) => item.relationship_type === "builds_on") ||
    visibleRelationships.find((item) => item.relationship_type === "limited_by") ||
    null;

  if (!preferredRelationship) {
    return null;
  }

  return {
    relationship_type: preferredRelationship.relationship_type,
    promise: preferredRelationship.promise,
  };
}

function buildTimelineEntries({ records, presidents, relationshipMap }) {
  const presidentScores = new Map(
    presidents.map((president) => [president.president_slug, president.normalized_score])
  );
  const sortedRecords = [...records].sort(compareTimelineEntries);
  const visiblePromiseIds = new Set(
    sortedRecords
      .map((record) => Number(record.id))
      .filter((value) => Number.isInteger(value) && value > 0)
  );
  const visibleRecordIndex = new Map(
    sortedRecords.map((record, index) => [Number(record.id), index])
  );

  const entries = sortedRecords.map((record) => {
    const relationships = relationshipMap.get(record.id) || [];
    const visibleRelationships = relationships
      .filter((item) => visiblePromiseIds.has(item.promise.id))
      .sort((left, right) => {
        const priorityDiff =
          getTimelineRelationshipPriority(left.relationship_type) -
          getTimelineRelationshipPriority(right.relationship_type);

        if (priorityDiff !== 0) {
          return priorityDiff;
        }

        return (
          (visibleRecordIndex.get(left.promise.id) ?? Number.POSITIVE_INFINITY) -
          (visibleRecordIndex.get(right.promise.id) ?? Number.POSITIVE_INFINITY)
        );
      });

    const causalLink = visibleRelationships[0] || pickTimelineLead(record, relationshipMap, visiblePromiseIds);

    return {
      ...record,
      normalized_president_score: presidentScores.get(record.president_slug) ?? null,
      causal_link: causalLink || null,
      connector_to_next: null,
    };
  });

  for (let index = 0; index < entries.length - 1; index += 1) {
    const currentEntry = entries[index];
    const nextEntry = entries[index + 1];
    const causalLink = currentEntry.causal_link;

    if (!causalLink?.promise || causalLink.promise.id !== nextEntry.id) {
      continue;
    }

    currentEntry.connector_to_next = {
      relationship_type: causalLink.relationship_type,
      crosses_president: currentEntry.president_slug !== nextEntry.president_slug,
    };
  }

  return entries;
}

export default async function BlackImpactScorePage({ searchParams }) {
  const resolvedSearchParams = (await searchParams) || {};
  const viewFlags = getViewFlags(resolvedSearchParams);
  const isPublicShareView = viewFlags.has("public-share");
  const isPublicView = viewFlags.has("public") || isPublicShareView;
  const isTimelineView = viewFlags.has("timeline");
  const isTopicCompareView = viewFlags.has("topic-compare");
  const isPresidentCompareView = viewFlags.has("president-compare");
  const isDebateMode = resolvedSearchParams.mode === "debate";
  const requestedPresidentSlug =
    typeof resolvedSearchParams.president === "string" ? resolvedSearchParams.president : null;
  const requestedPresidentASlug =
    typeof resolvedSearchParams.president_a === "string" ? resolvedSearchParams.president_a : null;
  const requestedPresidentBSlug =
    typeof resolvedSearchParams.president_b === "string" ? resolvedSearchParams.president_b : null;
  const requestedTopicParam =
    typeof resolvedSearchParams.topic === "string" ? resolvedSearchParams.topic.trim() : null;
  const requestedModel =
    resolvedSearchParams.model === "legacy" || resolvedSearchParams.model === "compare"
      ? resolvedSearchParams.model
      : "outcome";
  const data = await getBlackImpactScores(requestedModel);
  const comparisonMode = data.model === "compare";
  const publicOutcomeMethodology = getBlackImpactScoreMethodology();

  let methodology = null;
  let presidents = [];
  let metadata = null;
  let records = [];
  let baseRecords = [];
  let baseOutcomeMetadata = null;
  let usingLegacyModel = false;

  if (comparisonMode) {
    if (data.outcome?.error) {
      usingLegacyModel = true;
      methodology = data.legacy?.methodology || null;
      baseRecords = data.legacy?.records || [];
    } else {
      methodology = data.outcome?.methodology || null;
      baseOutcomeMetadata = normalizeOutcomeMetadata(data.outcome?.metadata);
      baseRecords = data.outcome?.records || [];
    }
  } else if (data.model === "legacy") {
    usingLegacyModel = true;
    methodology = data.methodology || null;
    baseRecords = data.records || [];
  } else {
    methodology = data.methodology || publicOutcomeMethodology;
    baseOutcomeMetadata = normalizeOutcomeMetadata(data.metadata);
    baseRecords = data.records || [];
  }

  if (requestedPresidentSlug && !isPresidentCompareView) {
    baseRecords = baseRecords.filter((record) => record.president_slug === requestedPresidentSlug);
  }

  const topicOptions = getAvailableTopicOptions(baseRecords);
  const selectedTopic = resolveSelectedTopic(topicOptions, requestedTopicParam);

  if (selectedTopic) {
    baseRecords = baseRecords.filter(
      (record) => normalizeTopicSlug(record.topic) === selectedTopic.value
    );
  }

  if (usingLegacyModel) {
    presidents = aggregatePromiseScoresByPresident(baseRecords).map(normalizeLegacyPresident);
    records = baseRecords.map(normalizeLegacyRecord);
  } else {
    presidents = aggregatePresidentFromOutcomes(baseRecords).map(normalizeOutcomePresident);
    records = baseRecords.map(normalizeOutcomeRecord);
    metadata = {
      ...(baseOutcomeMetadata || normalizeOutcomeMetadata(null)),
      total_promises: baseRecords.length,
      total_outcomes: baseRecords.reduce(
        (count, record) => count + Number(record.outcome_count || 0),
        0
      ),
    };
  }

  if (requestedPresidentSlug && !isPresidentCompareView) {
    presidents = presidents.filter((president) => president.president_slug === requestedPresidentSlug);
  }

  const presidentCompareOptions = getPresidentCompareOptions(presidents);
  const selectedPresidentA =
    presidents.find((president) => president.president_slug === requestedPresidentASlug) || null;
  const selectedPresidentB =
    presidents.find((president) => president.president_slug === requestedPresidentBSlug) || null;

  const effectiveScoringModel = getEffectiveScoringModel({ metadata, usingLegacyModel });
  const usingOutcomeModel = isOutcomeScoringModel({ metadata, usingLegacyModel });
  const isLegacyFallbackActive = usingLegacyModel && requestedModel !== "legacy";
  const timelineRelationshipMap =
    isTimelineView && records.length
      ? await fetchPromiseTimelineRelationshipMap(records.map((record) => record.id))
      : new Map();
  const timelineEntries = isTimelineView
    ? buildTimelineEntries({
        records,
        presidents,
        relationshipMap: timelineRelationshipMap,
      })
    : [];
  const methodologyBadgeLabel =
    isLegacyFallbackActive
      ? "Methodology: Legacy (Fallback)"
      : `Methodology: ${effectiveScoringModel}`;
  const methodologyBadgeDescription =
    isLegacyFallbackActive
      ? "Scores are temporarily using the legacy promise-based fallback model."
      : usingLegacyModel || effectiveScoringModel === "legacy"
        ? "Scores are currently using the legacy promise-based model."
      : `Scores are based on documented real-world outcomes using ${effectiveScoringModel}.`;
  const evidenceBadgeDescription =
    isLegacyFallbackActive
      ? "Legacy fallback is active while outcome-based evidence weighting is unavailable."
      : usingLegacyModel || effectiveScoringModel === "legacy"
        ? "Legacy scoring uses Promise Tracker relevance and impact curation."
      : "Scores incorporate evidence strength and source-backed outcomes.";
  const shareViewFlags = new Set([...viewFlags].filter((flag) => flag !== "public" && flag !== "public-share"));
  shareViewFlags.add("public-share");
  const shareUrl = buildReportHref({
    viewFlags: shareViewFlags,
    mode: isDebateMode ? "debate" : null,
    president: requestedPresidentSlug,
    presidentA: requestedPresidentASlug,
    presidentB: requestedPresidentBSlug,
    model: requestedModel,
    topic: selectedTopic?.value || requestedTopicParam,
  });
  const permalinkUrl = buildReportHref({
    viewFlags,
    mode: isDebateMode ? "debate" : null,
    president: requestedPresidentSlug,
    presidentA: requestedPresidentASlug,
    presidentB: requestedPresidentBSlug,
    model: requestedModel,
    topic: selectedTopic?.value || requestedTopicParam,
  });
  const modelStatusLabel = getModelStatusLabel({
    metadata,
    usingLegacyModel,
    isLegacyFallbackActive,
  });
  const standardReportHref = buildReportHref({
    viewFlags: [...viewFlags].filter((flag) => flag !== "timeline" && flag !== "topic-compare"),
    mode: isDebateMode ? "debate" : null,
    president: requestedPresidentSlug,
    presidentA: requestedPresidentASlug,
    presidentB: requestedPresidentBSlug,
    model: requestedModel,
    topic: selectedTopic?.value || requestedTopicParam,
  });
  const timelineReportHref = buildReportHref({
    viewFlags: new Set(
      [...viewFlags].filter((flag) => flag !== "timeline" && flag !== "topic-compare").concat("timeline")
    ),
    mode: isDebateMode ? "debate" : null,
    president: requestedPresidentSlug,
    presidentA: requestedPresidentASlug,
    presidentB: requestedPresidentBSlug,
    model: requestedModel,
    topic: selectedTopic?.value || requestedTopicParam,
  });
  const topicCompareHref = buildReportHref({
    viewFlags: new Set(
      [...viewFlags].filter((flag) => flag !== "timeline" && flag !== "topic-compare").concat("topic-compare")
    ),
    mode: isDebateMode ? "debate" : null,
    president: requestedPresidentSlug,
    presidentA: requestedPresidentASlug,
    presidentB: requestedPresidentBSlug,
    model: requestedModel,
    topic: selectedTopic?.value || requestedTopicParam,
  });
  const presidentCompareHref = buildReportHref({
    viewFlags: new Set(
      [...viewFlags]
        .filter((flag) => flag !== "timeline" && flag !== "topic-compare" && flag !== "president-compare")
        .concat("president-compare")
    ),
    mode: isDebateMode ? "debate" : null,
    president: requestedPresidentSlug,
    presidentA: requestedPresidentASlug,
    presidentB: requestedPresidentBSlug,
    model: requestedModel,
    topic: selectedTopic?.value || requestedTopicParam,
  });
  const compareHref = buildReportHref({
    viewFlags,
    mode: isDebateMode ? "debate" : null,
    president: requestedPresidentSlug,
    presidentA: requestedPresidentASlug,
    presidentB: requestedPresidentBSlug,
    model: "compare",
    topic: selectedTopic?.value || requestedTopicParam,
  });
  const allTopicsHref = buildReportHref({
    viewFlags,
    mode: isDebateMode ? "debate" : null,
    president: requestedPresidentSlug,
    model: requestedModel,
  });
  const buildTopicHref = (topicValue) =>
    buildReportHref({
      viewFlags,
      mode: isDebateMode ? "debate" : null,
      president: requestedPresidentSlug,
      presidentA: requestedPresidentASlug,
      presidentB: requestedPresidentBSlug,
      model: requestedModel,
      topic: topicValue,
    });
  const buildPresidentCompareHref = (presidentASlug, presidentBSlug) =>
    buildReportHref({
      viewFlags: new Set(
        [...viewFlags]
          .filter((flag) => flag !== "timeline" && flag !== "topic-compare" && flag !== "president-compare")
          .concat("president-compare")
      ),
      mode: isDebateMode ? "debate" : null,
      presidentA: presidentASlug,
      presidentB: presidentBSlug,
      model: requestedModel,
      topic: selectedTopic?.value || requestedTopicParam,
    });
  const shareEvidenceItems = collectShareEvidenceItems({
    presidents,
    selectedPresidentA,
    selectedPresidentB,
    isPresidentCompareView,
  });

  return (
    <main className={`max-w-7xl mx-auto ${isPublicView ? "px-6 py-10 space-y-10" : "p-6 space-y-8"}`}>
      {!isPublicView ? (
        <div className="flex flex-wrap gap-3">
          <Link
            href="/promises"
            className="inline-flex items-center rounded-full border border-[rgba(120,53,15,0.12)] bg-white/80 px-4 py-2 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--accent)]"
          >
            Explore Promise Tracker data
          </Link>
          <Link
            href="/reports"
            className="inline-flex items-center rounded-full border border-[rgba(120,53,15,0.12)] bg-white/80 px-4 py-2 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--accent)]"
          >
            Back to Reports
          </Link>
          <Link
            href={compareHref}
            className="inline-flex items-center rounded-full border border-[rgba(120,53,15,0.12)] bg-white/80 px-4 py-2 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--accent)]"
          >
            Compare with previous model
          </Link>
        </div>
      ) : null}

      {isPublicShareView ? (
        <SourceAwareShareHeader
          shareUrl={shareUrl}
          selectedTopic={selectedTopic}
          effectiveScoringModel={effectiveScoringModel}
          isLegacyFallbackActive={isLegacyFallbackActive}
          usingLegacyModel={usingLegacyModel}
        />
      ) : isPublicView ? (
        <ShareHeader shareUrl={shareUrl} />
      ) : null}

      {isDebateMode ? <DebateModeHeader /> : null}

      <section className="hero-panel p-8 md:p-10">
        <p className="eyebrow mb-4">Promise Tracker Report</p>
        <h1 className="text-4xl md:text-5xl font-bold">Black Impact Score</h1>
        <p className="text-base md:text-lg text-[var(--ink-soft)] mt-4 max-w-3xl leading-8">
          This report measures presidential accountability through documented outcomes tied to Black-community impacts.
          It emphasizes what happened in practice, not just what was promised or enacted.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <MetaPill>{presidents.length} presidents scored</MetaPill>
          <MetaPill>{modelStatusLabel}</MetaPill>
          {metadata?.total_outcomes ? <MetaPill>{metadata.total_outcomes} outcomes scored</MetaPill> : null}
          <MetaPill>{effectiveScoringModel}</MetaPill>
          {selectedTopic ? <MetaPill>Filtered Topic: {selectedTopic.label}</MetaPill> : null}
          <TrustBadge
            label={methodologyBadgeLabel}
            description={methodologyBadgeDescription}
          />
          <TrustBadge
            label="Evidence-Based Scoring"
            description={evidenceBadgeDescription}
          />
        </div>
      </section>

      <PermalinkSection permalinkUrl={permalinkUrl} isPublicView={isPublicView} />

      {isPublicShareView ? (
        <SourceAwareEvidenceTrail items={shareEvidenceItems} isPublicView={isPublicView} />
      ) : null}

      <MultiViewToggleSection
        reportHref={standardReportHref}
        timelineHref={timelineReportHref}
        topicCompareHref={topicCompareHref}
        presidentCompareHref={presidentCompareHref}
        isTimelineView={isTimelineView}
        isTopicCompareView={isTopicCompareView}
        isPresidentCompareView={isPresidentCompareView}
      />

      <TopicFilterSection
        topicOptions={topicOptions}
        selectedTopic={selectedTopic}
        allTopicsHref={allTopicsHref}
        buildTopicHref={buildTopicHref}
        isPublicView={isPublicView}
      />

      {isPresidentCompareView && selectedTopic ? (
        <PresidentCompareSelectorSection
          options={presidentCompareOptions}
          selectedPresidentASlug={requestedPresidentASlug}
          selectedPresidentBSlug={requestedPresidentBSlug}
          buildPresidentCompareHref={buildPresidentCompareHref}
        />
      ) : null}

      {isLegacyFallbackActive ? (
        <section className="card-surface rounded-[1.6rem] p-5 border border-[rgba(120,53,15,0.12)]">
          <h2 className="text-lg font-semibold">Outcome-Based Scoring Is Temporarily Unavailable</h2>
          <p className="text-sm text-[var(--ink-soft)] leading-7 mt-2">
            This page has temporarily fallen back to the previous legacy model so score access remains available.
          </p>
        </section>
      ) : null}

      <CredibilityNote
        promiseCount={records.length}
        outcomeCount={usingLegacyModel ? null : metadata?.total_outcomes ?? 0}
        effectiveScoringModel={effectiveScoringModel}
        usingLegacyModel={usingLegacyModel}
        isLegacyFallbackActive={isLegacyFallbackActive}
      />

      {presidents.length && !isTopicCompareView && !isPresidentCompareView ? <TopSummarySection presidents={presidents} /> : null}

      <MethodologySection
        methodology={methodology}
        metadata={metadata}
        usingLegacyModel={usingLegacyModel}
        isLegacyFallbackActive={isLegacyFallbackActive}
      />

      {usingOutcomeModel && !isTopicCompareView && !isPresidentCompareView ? (
        <SystemLevelInsight presidents={presidents} metadata={metadata} />
      ) : null}

      {isDebateMode ? <VerificationSection /> : null}

      {isPublicShareView ? <ShareVerificationSection /> : null}

      {!isPublicView ? (
        <section className="card-surface rounded-[1.6rem] p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="max-w-3xl">
              <h2 className="text-lg font-semibold mb-2">Built From Promise Tracker</h2>
          <p className="text-sm text-[var(--ink-soft)] leading-7">
            This report summarizes Promise Tracker records into a president-level accountability view.
            It remains tied to the underlying promise, action, and outcome records rather than operating as a separate product surface.
              </p>
            </div>
            <Link
              href="/promises"
              className="rounded-full border border-[rgba(120,53,15,0.18)] bg-white/80 px-5 py-2 text-sm font-medium"
            >
              Open Promise Tracker
            </Link>
          </div>
        </section>
      ) : null}

      <section id="methodology" className="card-surface rounded-[1.6rem] p-5">
        <details>
          <summary className="cursor-pointer text-lg font-semibold">View Methodology</summary>
          <div className="mt-4 space-y-4">
            {methodology ? (
              <>
                {methodology.summary ? (
                  <p className="text-sm text-[var(--ink-soft)] leading-7">{methodology.summary}</p>
                ) : null}

                {methodology.outcome_scoring?.evidence_multipliers ? (
                  <div className="card-muted rounded-[1.25rem] p-4">
                    <h2 className="text-base font-semibold">Evidence Weighting</h2>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {Object.entries(methodology.outcome_scoring.evidence_multipliers).map(([label, value]) => (
                        <MetaPill key={label}>
                          {label} = {value}
                        </MetaPill>
                      ))}
                    </div>
                  </div>
                ) : null}

                {methodology.confidence?.levels ? (
                  <div className="card-muted rounded-[1.25rem] p-4">
                    <h2 className="text-base font-semibold">Confidence Levels</h2>
                    <div className="mt-3 space-y-2 text-sm text-[var(--ink-soft)]">
                      {Object.entries(methodology.confidence.levels).map(([label, value]) => (
                        <p key={label}>
                          <strong className="text-[var(--ink)] capitalize">{label}:</strong> {value}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}

                <ul className="text-sm text-[var(--ink-soft)] space-y-2">
                  {(methodology.notes || []).map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-[var(--ink-soft)]">Methodology data is not available.</p>
            )}
          </div>
        </details>
      </section>

      {presidents.length === 0 && !isTimelineView && !isTopicCompareView && !isPresidentCompareView ? (
        <section className="card-surface rounded-[1.6rem] p-8 text-center">
          <h2 className="text-xl font-semibold">
            {selectedTopic
              ? `No scored records matched ${selectedTopic.label}.`
              : "No Black Impact Score data is available yet."}
          </h2>
          <p className="text-[var(--ink-soft)] mt-3">
            {selectedTopic
              ? "No scored records matched the selected topic in the current report view."
              : "President-level score summaries will appear here once Promise Tracker score data is available."}
          </p>
        </section>
      ) : isTimelineView ? (
        <TimelineModeSection
          entries={timelineEntries}
          isPublicView={isPublicView}
          effectiveScoringModel={effectiveScoringModel}
          selectedTopic={selectedTopic}
        />
      ) : isTopicCompareView ? (
        <TopicComparisonSection
          presidents={presidents}
          selectedTopic={selectedTopic}
          effectiveScoringModel={effectiveScoringModel}
          usingLegacyModel={usingLegacyModel}
          isLegacyFallbackActive={isLegacyFallbackActive}
          requestedPresidentSlug={requestedPresidentSlug}
        />
      ) : isPresidentCompareView ? (
        <PresidentComparisonSection
          presidents={presidents}
          selectedTopic={selectedTopic}
          effectiveScoringModel={effectiveScoringModel}
          usingLegacyModel={usingLegacyModel}
          isLegacyFallbackActive={isLegacyFallbackActive}
          selectedPresidentA={selectedPresidentA}
          selectedPresidentB={selectedPresidentB}
          selectedPresidentASlug={requestedPresidentASlug}
          selectedPresidentBSlug={requestedPresidentBSlug}
        />
      ) : (
        <div className="space-y-8">
          {presidents.map((president) => (
            <section key={president.president_slug} className="card-surface rounded-[1.6rem] p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">President Summary</p>
                  <h2 className="text-3xl font-semibold mt-2">{president.president}</h2>
                  <p className="text-sm text-[var(--ink-soft)] mt-2 leading-7 max-w-3xl">
                    {president.explanation}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  {president.president_party ? <MetaPill>{president.president_party}</MetaPill> : null}
                  {!isPublicView ? (
                    <Link
                      href={`/promises/president/${president.president_slug}`}
                      className="rounded-full border border-[rgba(120,53,15,0.12)] bg-white/80 px-4 py-2 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--accent)]"
                    >
                      See Promise Tracker data
                    </Link>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-4 mt-6">
                <ScoreCard
                  label="Normalized Score"
                  value={formatNormalizedScore(president.normalized_score)}
                  subtitle="Primary comparison view across presidents"
                />
                <ScoreCard
                  label="Raw Score"
                  value={formatRawScore(president.raw_score)}
                  subtitle="Underlying total across scored records"
                />
                <ScoreCard
                  label="Promise Records"
                  value={president.promise_count}
                  subtitle="Promise Tracker records included in this score"
                />
                <ScoreCard
                  label="Outcomes"
                  value={president.outcome_count ?? "\u2014"}
                  subtitle="Documented outcomes used in the score model"
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2 mt-6">
                <CountBarGroup title="Breakdown by Impact Direction" counts={president.counts_by_direction} />
                <CountBarGroup
                  title={usingLegacyModel ? "Breakdown by Relevance" : "Breakdown by Confidence"}
                  counts={president.counts_by_confidence}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2 mt-6">
                <TopicBreakdown items={president.score_by_topic || []} />
                <div className="card-muted rounded-[1.25rem] p-4">
                  <h3 className="text-lg font-semibold">Score Context</h3>
                  <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">
                    {getScoreContextText({
                      metadata,
                      usingLegacyModel,
                      isLegacyFallbackActive,
                    })}
                  </p>
                  {effectiveScoringModel ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <MetaPill>{effectiveScoringModel}</MetaPill>
                    </div>
                  ) : null}
                </div>
              </div>

              <PresidentInsightPanel president={president} />

              <PresidentCredibilityPanel
                president={president}
                effectiveScoringModel={effectiveScoringModel}
                usingLegacyModel={usingLegacyModel}
                isLegacyFallbackActive={isLegacyFallbackActive}
              />

              <EvidencePanelGroup
                title="Evidence Panel"
                items={[
                  president.top_positive_promises?.[0] || null,
                  president.top_negative_promises?.[0] || null,
                ]}
                linkToPromises={true}
                emptyMessage="No driver evidence is available for this president."
              />

              {isDebateMode ? (
                <div className="grid gap-4 xl:grid-cols-2 mt-6">
                  <StrongestDriverCard
                    title="Strongest Positive Driver"
                    promise={president.top_positive_promises?.[0] || null}
                    linkToPromises={!isPublicView}
                  />
                  <StrongestDriverCard
                    title="Strongest Negative Driver"
                    promise={president.top_negative_promises?.[0] || null}
                    linkToPromises={!isPublicView}
                  />
                </div>
              ) : null}

              <div className="grid gap-4 xl:grid-cols-2 mt-6">
                <PromiseDriverList
                  title="Key Positive Drivers"
                  items={president.top_positive_promises || []}
                  emptyMessage="No positive score drivers are currently highlighted for this president."
                  linkToPromises={!isPublicView}
                />
                <PromiseDriverList
                  title="Key Negative Drivers"
                  items={president.top_negative_promises || []}
                  emptyMessage="No negative score drivers are currently highlighted for this president."
                  linkToPromises={!isPublicView}
                />
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
