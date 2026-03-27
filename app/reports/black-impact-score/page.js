import Link from "next/link";
import { ImpactBadge } from "@/app/components/policy-badges";
import { fetchInternalJson } from "@/lib/api";
import { REPORT_REVALIDATE_SECONDS, withRevalidate } from "@/lib/cache";
import { getBlackImpactScoreMethodology } from "@/lib/black-impact-score/methodology.js";
import CopyShareLinkButton from "./CopyShareLinkButton";

const REPORT_PATH = "/reports/black-impact-score";
const DEFAULT_TITLE = "Black Impact Score Report";
const DEFAULT_DESCRIPTION =
  "A data-driven report on presidential impact based on documented real-world outcomes affecting Black Americans.";

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

  if (searchParams.view === "public") {
    params.set("view", "public");
  }

  if (searchParams.mode === "debate") {
    params.set("mode", "debate");
  }

  if (typeof searchParams.president === "string" && searchParams.president.trim()) {
    params.set("president", searchParams.president.trim());
  }

  const query = params.toString();
  return query ? `${REPORT_PATH}?${query}` : REPORT_PATH;
}

function buildOgImageUrl(searchParams = {}) {
  const params = new URLSearchParams();

  if (searchParams.view === "public") {
    params.set("view", "public");
  }

  if (searchParams.mode === "debate") {
    params.set("mode", "debate");
  }

  if (typeof searchParams.president === "string" && searchParams.president.trim()) {
    params.set("president", searchParams.president.trim());
  }

  const query = params.toString();
  return query
    ? `${REPORT_PATH}/opengraph-image?${query}`
    : `${REPORT_PATH}/opengraph-image`;
}

export async function generateMetadata({ searchParams }) {
  const resolvedSearchParams = (await searchParams) || {};
  const isPublicView = resolvedSearchParams.view === "public";
  const isDebateMode = resolvedSearchParams.mode === "debate";
  const presidentSlug =
    typeof resolvedSearchParams.president === "string" ? resolvedSearchParams.president.trim() : "";
  const presidentName = formatPresidentSlug(presidentSlug);

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

  if (isDebateMode) {
    title = presidentName
      ? `${presidentName} Black Impact Score Debate View`
      : "Black Impact Score Debate View";
    description = presidentName
      ? `A debate-oriented view of ${presidentName}'s strongest Black Impact Score drivers using documented outcomes and source-backed records.`
      : "A debate-oriented view of the Black Impact Score highlighting the strongest documented score drivers and source-backed records.";
  }

  const url = buildMetadataUrl({
    view: isPublicView ? "public" : null,
    mode: isDebateMode ? "debate" : null,
    president: presidentSlug || null,
  });
  const imageUrl = buildOgImageUrl({
    view: isPublicView ? "public" : null,
    mode: isDebateMode ? "debate" : null,
    president: presidentSlug || null,
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

function getModelStatusLabel({ metadata, usingLegacyModel }) {
  const scoringModel = getEffectiveScoringModel({ metadata, usingLegacyModel });

  if (usingLegacyModel) {
    return "Legacy fallback active";
  }

  if (scoringModel.toLowerCase().includes("outcome")) {
    return "Outcome-based model";
  }

  return "Scoring model active";
}

function getScoreContextText({ metadata, usingLegacyModel }) {
  const scoringModel = getEffectiveScoringModel({ metadata, usingLegacyModel });

  if (usingLegacyModel) {
    return `Legacy promise-based scoring is currently shown for this president (${scoringModel}).`;
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
        </div>
      )}
    </section>
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

function MethodologySection({ methodology, metadata, usingLegacyModel }) {
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
              : "Scores are currently using the legacy promise-based model. Records are summarized from editorial relevance, impact direction, and current promise status while the outcome-based model is unavailable."}
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
              subtitle="Legacy promise-based scoring is currently active"
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

export default async function BlackImpactScorePage({ searchParams }) {
  const resolvedSearchParams = (await searchParams) || {};
  const isPublicView = resolvedSearchParams.view === "public";
  const isDebateMode = resolvedSearchParams.mode === "debate";
  const requestedPresidentSlug =
    typeof resolvedSearchParams.president === "string" ? resolvedSearchParams.president : null;
  const requestedModel =
    resolvedSearchParams.model === "legacy" || resolvedSearchParams.model === "compare"
      ? resolvedSearchParams.model
      : "outcome";
  const data = await getBlackImpactScores(requestedModel);
  const isLegacyFallback = data.notice === "Outcome-based scoring is temporarily unavailable";
  const comparisonMode = data.model === "compare";
  const publicOutcomeMethodology = getBlackImpactScoreMethodology();

  let methodology = null;
  let presidents = [];
  let metadata = null;
  let usingLegacyModel = false;

  if (comparisonMode) {
    if (data.outcome?.error) {
      usingLegacyModel = true;
      methodology = data.legacy?.methodology || null;
      presidents = (data.legacy?.items || []).map(normalizeLegacyPresident);
    } else {
      methodology = data.outcome?.methodology || null;
      presidents = (data.outcome?.items || []).map(normalizeOutcomePresident);
      metadata = data.outcome?.metadata || null;
    }
  } else if (data.model === "legacy") {
    usingLegacyModel = true;
    methodology = data.methodology || null;
    presidents = (data.items || []).map(normalizeLegacyPresident);
  } else {
    methodology = data.methodology || publicOutcomeMethodology;
    presidents = (data.items || []).map(normalizeOutcomePresident);
    metadata = data.metadata || null;
  }

  if (requestedPresidentSlug) {
    presidents = presidents.filter((president) => president.president_slug === requestedPresidentSlug);
  }

  const effectiveScoringModel = getEffectiveScoringModel({ metadata, usingLegacyModel });
  const usingOutcomeModel = isOutcomeScoringModel({ metadata, usingLegacyModel });
  const methodologyBadgeLabel =
    usingLegacyModel || effectiveScoringModel === "legacy"
      ? "Methodology: Legacy (Fallback)"
      : `Methodology: ${effectiveScoringModel}`;
  const methodologyBadgeDescription =
    usingLegacyModel || effectiveScoringModel === "legacy"
      ? "Scores are temporarily using the legacy promise-based fallback model."
      : `Scores are based on documented real-world outcomes using ${effectiveScoringModel}.`;
  const evidenceBadgeDescription =
    usingLegacyModel || effectiveScoringModel === "legacy"
      ? "Legacy fallback is active while outcome-based evidence weighting is unavailable."
      : "Scores incorporate evidence strength and source-backed outcomes.";
  const shareQuery = new URLSearchParams();
  shareQuery.set("view", "public");
  if (isDebateMode) {
    shareQuery.set("mode", "debate");
  }
  if (requestedModel !== "outcome") {
    shareQuery.set("model", requestedModel);
  }
  if (requestedPresidentSlug) {
    shareQuery.set("president", requestedPresidentSlug);
  }
  const shareUrl = `/reports/black-impact-score?${shareQuery.toString()}`;
  const modelStatusLabel = getModelStatusLabel({ metadata, usingLegacyModel });

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
            href="/reports/black-impact-score?model=compare"
            className="inline-flex items-center rounded-full border border-[rgba(120,53,15,0.12)] bg-white/80 px-4 py-2 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--accent)]"
          >
            Compare with previous model
          </Link>
        </div>
      ) : null}

      {isPublicView ? <ShareHeader shareUrl={shareUrl} /> : null}

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

      {isLegacyFallback ? (
        <section className="card-surface rounded-[1.6rem] p-5 border border-[rgba(120,53,15,0.12)]">
          <h2 className="text-lg font-semibold">Outcome-Based Scoring Is Temporarily Unavailable</h2>
          <p className="text-sm text-[var(--ink-soft)] leading-7 mt-2">
            This page has temporarily fallen back to the previous legacy model so score access remains available.
          </p>
        </section>
      ) : null}

      {presidents.length ? <TopSummarySection presidents={presidents} /> : null}

      <MethodologySection
        methodology={methodology}
        metadata={metadata}
        usingLegacyModel={usingLegacyModel}
      />

      {usingOutcomeModel ? (
        <SystemLevelInsight presidents={presidents} metadata={metadata} />
      ) : null}

      {isDebateMode ? <VerificationSection /> : null}

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

      {presidents.length === 0 ? (
        <section className="card-surface rounded-[1.6rem] p-8 text-center">
          <h2 className="text-xl font-semibold">No Black Impact Score data is available yet.</h2>
          <p className="text-[var(--ink-soft)] mt-3">
            President-level score summaries will appear here once Promise Tracker score data is available.
          </p>
        </section>
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
                    {getScoreContextText({ metadata, usingLegacyModel })}
                  </p>
                  {effectiveScoringModel ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <MetaPill>{effectiveScoringModel}</MetaPill>
                    </div>
                  ) : null}
                </div>
              </div>

              <PresidentInsightPanel president={president} />

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
