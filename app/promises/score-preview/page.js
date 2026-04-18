import Link from "next/link";
import { fetchInternalJson } from "@/lib/api";
import { PUBLIC_REVALIDATE_SECONDS, withRevalidate } from "@/lib/cache";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = {
  ...buildPageMetadata({
    title: "Black Impact Score Preview",
    description:
      "Internal comparison view for the legacy Promise Tracker score model and the newer outcome-based Black Impact Score model.",
    path: "/promises/score-preview",
  }),
  robots: {
    index: false,
    follow: false,
  },
};

async function getPromiseScorePreview() {
  return fetchInternalJson("/api/promises/scores?model=compare", {
    ...withRevalidate(PUBLIC_REVALIDATE_SECONDS),
    errorMessage: "Failed to fetch promise score comparison preview",
  });
}

function MetaPill({ children }) {
  return <span className="public-pill">{children}</span>;
}

function MetricCard({ label, value, subtitle, subtle = false }) {
  return (
    <div className={`${subtle ? "card-muted" : "card-surface"} rounded-[1.15rem] px-4 py-4`}>
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">{label}</p>
      <p className="text-xl font-semibold mt-2">{value}</p>
      {subtitle ? <p className="text-sm text-[var(--ink-soft)] mt-2">{subtitle}</p> : null}
    </div>
  );
}

function formatNormalizedScore(value) {
  if (value === null || value === undefined) return "\u2014";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return numeric.toFixed(2);
}

function formatNormalizedDelta(value) {
  if (value === null || value === undefined) return "\u2014";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  const fixed = numeric.toFixed(3);
  return numeric > 0 ? `+${fixed}` : fixed;
}

function formatRawScore(value) {
  if (value === null || value === undefined) return "\u2014";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return numeric.toFixed(2);
}

function formatSignedValue(value, digits = 2) {
  if (value === null || value === undefined) return "\u2014";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  const fixed = numeric.toFixed(digits);
  return numeric > 0 ? `+${fixed}` : fixed;
}

function formatPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return `${Math.round(numeric * 100)}%`;
}

function formatScoreConfidence(value) {
  return typeof value === "string" && value.trim() ? value.trim().toUpperCase() : null;
}

function sortByNumericValue(items, getter, direction = "desc") {
  return [...items].sort((left, right) => {
    const leftValue = Number(getter(left) || 0);
    const rightValue = Number(getter(right) || 0);

    if (direction === "asc") {
      if (leftValue !== rightValue) return leftValue - rightValue;
    } else if (leftValue !== rightValue) {
      return rightValue - leftValue;
    }

    return String(left.title || left.president || "").localeCompare(
      String(right.title || right.president || "")
    );
  });
}

function createPresidentMap(items = [], modelType) {
  const mapped = new Map();

  for (const item of items) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const key = item.president_slug || item.president;

    if (!key) {
      continue;
    }

    mapped.set(key, {
      president: item.president || key,
      president_slug: item.president_slug || null,
      president_party: item.president_party || null,
      model_type: modelType,
      raw_score: modelType === "legacy" ? item.raw_score : item.raw_score_total,
      normalized_score:
        modelType === "legacy" ? item.normalized_score : item.normalized_score_total,
      display_score: modelType === "outcome" ? item.display_score_total ?? item.display_score ?? null : null,
      score_confidence: modelType === "outcome" ? item.score_confidence || null : null,
      primary_score_family: modelType === "outcome" ? item.primary_score_family || "direct" : "legacy",
      low_coverage_warning: modelType === "outcome" ? item.low_coverage_warning || null : null,
      narrative_summary:
        modelType === "outcome"
          ? item.narrative_summary || item.impact_narrative?.summary_paragraph || null
          : null,
      confidence_statement:
        modelType === "outcome"
          ? item.confidence_statement || item.impact_narrative?.confidence_statement || null
          : null,
      record_count: item.promise_count || null,
      outcome_count: modelType === "outcome" ? item.outcome_count : null,
      explanation: item.score_explanation || item.explanation_summary || null,
    });
  }

  return mapped;
}

function mergePresidentScores(legacyItems = [], outcomeItems = []) {
  const legacyMap = createPresidentMap(legacyItems, "legacy");
  const outcomeMap = createPresidentMap(outcomeItems, "outcome");
  const allKeys = new Set([...legacyMap.keys(), ...outcomeMap.keys()]);

  return [...allKeys]
    .map((key) => {
      const legacy = legacyMap.get(key) || null;
      const outcome = outcomeMap.get(key) || null;
      const legacyNormalized = legacy ? Number(legacy.normalized_score) : null;
      const outcomeNormalized = outcome ? Number(outcome.normalized_score) : null;
      const legacyRaw = legacy ? Number(legacy.raw_score) : null;
      const outcomeRaw = outcome ? Number(outcome.raw_score) : null;

      return {
        key,
        president: legacy?.president || outcome?.president || key,
        president_slug: legacy?.president_slug || outcome?.president_slug || null,
        president_party: legacy?.president_party || outcome?.president_party || null,
        legacy,
        outcome,
        normalized_delta:
          legacyNormalized !== null &&
          Number.isFinite(legacyNormalized) &&
          outcomeNormalized !== null &&
          Number.isFinite(outcomeNormalized)
            ? Number((outcomeNormalized - legacyNormalized).toFixed(4))
            : null,
        raw_delta:
          legacyRaw !== null &&
          Number.isFinite(legacyRaw) &&
          outcomeRaw !== null &&
          Number.isFinite(outcomeRaw)
            ? Number((outcomeRaw - legacyRaw).toFixed(2))
            : null,
      };
    })
    .sort((left, right) => left.president.localeCompare(right.president));
}

function createRecordMap(items = [], modelType) {
  const mapped = new Map();

  for (const item of items) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const key = item.slug || item.id;

    if (!key) {
      continue;
    }

    mapped.set(key, {
      id: item.id || null,
      slug: item.slug || null,
      title: item.title || key,
      topic: item.topic || null,
      president: item.president || null,
      president_slug: item.president_slug || null,
      president_party: item.president_party || null,
      summary: item.summary || null,
      legacy_raw_score: modelType === "legacy" ? item.raw_score : null,
      legacy_normalized_score: modelType === "legacy" ? item.normalized_score : null,
      legacy_status: modelType === "legacy" ? item.status || null : null,
      legacy_relevance: modelType === "legacy" ? item.relevance || null : null,
      legacy_impact_direction:
        modelType === "legacy"
          ? item.impact_direction_for_curation || item.scoring_impact_direction || null
          : null,
      outcome_total_score: modelType === "outcome" ? item.total_score : null,
      outcome_count: modelType === "outcome" ? item.outcome_count || 0 : null,
      outcome_explanation: modelType === "outcome" ? item.explanation_summary || null : null,
      scored_outcomes: modelType === "outcome" ? item.scored_outcomes || [] : [],
      breakdown_by_direction:
        modelType === "outcome" ? item.breakdown_by_direction || {} : {},
      breakdown_by_confidence:
        modelType === "outcome" ? item.breakdown_by_confidence || {} : {},
    });
  }

  return mapped;
}

function mergeRecordScores(legacyRecords = [], outcomeRecords = []) {
  const legacyMap = createRecordMap(legacyRecords, "legacy");
  const outcomeMap = createRecordMap(outcomeRecords, "outcome");
  const allKeys = new Set([...legacyMap.keys(), ...outcomeMap.keys()]);

  return [...allKeys]
    .map((key) => {
      const legacy = legacyMap.get(key) || null;
      const outcome = outcomeMap.get(key) || null;
      const legacyRaw = legacy ? Number(legacy.legacy_raw_score) : null;
      const outcomeRaw = outcome ? Number(outcome.outcome_total_score) : null;
      const scoredOutcomes = outcome?.scored_outcomes || [];
      const directions = scoredOutcomes
        .map((entry) => entry.impact_direction)
        .filter(Boolean);
      const confidences = scoredOutcomes
        .map((entry) => entry.confidence_level)
        .filter(Boolean);

      return {
        key,
        id: legacy?.id || outcome?.id || null,
        slug: legacy?.slug || outcome?.slug || null,
        title: legacy?.title || outcome?.title || key,
        topic: legacy?.topic || outcome?.topic || null,
        president: legacy?.president || outcome?.president || null,
        president_slug: legacy?.president_slug || outcome?.president_slug || null,
        president_party: legacy?.president_party || outcome?.president_party || null,
        legacy_raw_score: legacy?.legacy_raw_score ?? null,
        legacy_normalized_score: legacy?.legacy_normalized_score ?? null,
        legacy_status: legacy?.legacy_status ?? null,
        legacy_relevance: legacy?.legacy_relevance ?? null,
        legacy_impact_direction: legacy?.legacy_impact_direction ?? null,
        outcome_total_score: outcome?.outcome_total_score ?? null,
        outcome_count: outcome?.outcome_count ?? null,
        outcome_explanation: outcome?.outcome_explanation ?? null,
        scored_outcomes: scoredOutcomes,
        score_delta:
          legacyRaw !== null &&
          Number.isFinite(legacyRaw) &&
          outcomeRaw !== null &&
          Number.isFinite(outcomeRaw)
            ? Number((outcomeRaw - legacyRaw).toFixed(2))
            : null,
        has_mixed: directions.includes("Mixed"),
        has_blocked: directions.includes("Blocked"),
        low_confidence: confidences.includes("low"),
        neutral_outcome_total:
          outcomeRaw !== null && Number.isFinite(outcomeRaw) ? outcomeRaw === 0 : false,
      };
    })
    .sort((left, right) => left.title.localeCompare(right.title));
}

function MethodologyPanel({ title, label, methodology, children }) {
  return (
    <section className="card-surface rounded-[1.6rem] p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">{label}</p>
          <h2 className="text-2xl font-semibold mt-2">{title}</h2>
        </div>
        {methodology ? <MetaPill>Methodology loaded</MetaPill> : <MetaPill>Methodology unavailable</MetaPill>}
      </div>

      {children}
    </section>
  );
}

function RankingList({ title, items, emptyMessage }) {
  return (
    <section className="card-muted rounded-[1.25rem] p-4">
      <h3 className="text-lg font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--ink-soft)] mt-3">{emptyMessage}</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {items.map((item, index) => (
            <li
              key={`${title}-${item.president_slug || item.president}-${index}`}
              className="rounded-[1rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-4"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">#{index + 1}</p>
                  <p className="text-base font-semibold mt-2">{item.president}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-[var(--ink)]">
                    {formatNormalizedScore(item.normalized_score)}
                  </p>
                  {item.president_party ? (
                    <p className="text-xs text-[var(--ink-soft)] mt-1">{item.president_party}</p>
                  ) : null}
                  {item.display_score != null ? (
                    <p className="text-xs text-[var(--ink-soft)] mt-1">
                      Display {formatNormalizedScore(item.display_score)}
                    </p>
                  ) : null}
                  {item.primary_score_family === "direct" ? (
                    <p className="text-xs text-[var(--ink-soft)] mt-1">Primary: direct score</p>
                  ) : null}
                  {item.score_confidence ? (
                    <p className="text-xs text-[var(--ink-soft)] mt-1">
                      Confidence: {formatScoreConfidence(item.score_confidence)}
                      {item.outcome_count ? ` (${item.outcome_count} outcomes)` : ""}
                    </p>
                  ) : null}
                </div>
              </div>
              {item.low_coverage_warning ? (
                <p className="text-xs text-[var(--ink-soft)] mt-3 leading-6">
                  {item.low_coverage_warning}
                </p>
              ) : null}
              {item.narrative_summary ? (
                <p className="text-xs text-[var(--ink-soft)] mt-3 leading-6">
                  {item.narrative_summary}
                </p>
              ) : null}
              {item.confidence_statement ? (
                <p className="text-xs text-[var(--ink-muted)] mt-2 leading-6">
                  {item.confidence_statement}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function LargestShiftList({ items }) {
  return (
    <section className="card-muted rounded-[1.25rem] p-4">
      <h3 className="text-lg font-semibold">Largest Model Shifts</h3>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--ink-soft)] mt-3">
          No presidents can be compared across both models yet.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {items.map((item) => (
            <div
              key={`shift-${item.key}`}
              className="rounded-[1rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-4"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-base font-semibold">{item.president}</p>
                  {item.president_party ? (
                    <p className="text-sm text-[var(--ink-soft)] mt-1">{item.president_party}</p>
                  ) : null}
                </div>
                <MetaPill>Delta {formatNormalizedDelta(item.normalized_delta)}</MetaPill>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-[0.9rem] border border-white/8 bg-white/5 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Legacy Promise Model</p>
                  <p className="text-sm mt-2">Raw {formatRawScore(item.legacy?.raw_score)}</p>
                  <p className="text-sm text-[var(--ink-soft)] mt-1">
                    Normalized {formatNormalizedScore(item.legacy?.normalized_score)}
                  </p>
                </div>
                <div className="rounded-[0.9rem] border border-white/8 bg-white/5 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Outcome-Based Model</p>
                  <p className="text-sm mt-2">Raw {formatRawScore(item.outcome?.raw_score)}</p>
                  <p className="text-sm text-[var(--ink-soft)] mt-1">
                    Normalized {formatNormalizedScore(item.outcome?.normalized_score)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ComparisonTable({ rows }) {
  return (
    <section className="card-surface rounded-[1.6rem] p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold">President Comparison</h2>
          <p className="text-sm text-[var(--ink-soft)] mt-2 max-w-3xl leading-7">
            Side-by-side comparison of the legacy promise-based score and the newer outcome-based score.
            Delta is calculated as outcome model minus legacy model.
          </p>
        </div>
        <MetaPill>{rows.length} presidents compared</MetaPill>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-[var(--ink-soft)] mt-5">
          No president-level score comparison data is available yet.
        </p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 text-left">
                <th scope="col" className="py-3 pr-4 font-semibold">President</th>
                <th scope="col" className="py-3 pr-4 font-semibold">Legacy Raw</th>
                <th scope="col" className="py-3 pr-4 font-semibold">Legacy Normalized</th>
                <th scope="col" className="py-3 pr-4 font-semibold">Outcome Raw</th>
                <th scope="col" className="py-3 pr-4 font-semibold">Outcome Normalized</th>
                <th scope="col" className="py-3 pr-4 font-semibold">Delta</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.key}
                  className="border-b border-[rgba(120,53,15,0.08)] align-top"
                >
                  <th scope="row" className="py-4 pr-4 font-medium">
                    <div>
                      <p>{row.president}</p>
                      {row.president_party ? (
                        <p className="text-xs text-[var(--ink-soft)] mt-1">{row.president_party}</p>
                      ) : null}
                    </div>
                  </th>
                  <td className="py-4 pr-4">{formatRawScore(row.legacy?.raw_score)}</td>
                  <td className="py-4 pr-4">{formatNormalizedScore(row.legacy?.normalized_score)}</td>
                  <td className="py-4 pr-4">{formatRawScore(row.outcome?.raw_score)}</td>
                  <td className="py-4 pr-4">{formatNormalizedScore(row.outcome?.normalized_score)}</td>
                  <td className="py-4 pr-4 font-medium">{formatNormalizedDelta(row.normalized_delta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function UnavailablePanel({ title, message }) {
  return (
    <section className="card-muted rounded-[1.25rem] p-4">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">{message}</p>
    </section>
  );
}

function RecordReviewTable({ title, rows, emptyMessage }) {
  return (
    <section className="card-muted rounded-[1.25rem] p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-lg font-semibold">{title}</h3>
        <MetaPill>{rows.length} shown</MetaPill>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--ink-soft)] mt-3">{emptyMessage}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 text-left">
                <th scope="col" className="py-3 pr-4 font-semibold">Promise</th>
                <th scope="col" className="py-3 pr-4 font-semibold">Legacy</th>
                <th scope="col" className="py-3 pr-4 font-semibold">Outcome</th>
                <th scope="col" className="py-3 pr-4 font-semibold">Delta</th>
                <th scope="col" className="py-3 pr-4 font-semibold">Review Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${title}-${row.key}`}
                  className="border-b border-[rgba(120,53,15,0.08)] align-top"
                >
                  <th scope="row" className="py-4 pr-4 font-medium">
                    <div>
                      {row.slug ? (
                        <Link href={`/promises/${row.slug}`} className="accent-link">
                          {row.title}
                        </Link>
                      ) : (
                        <p>{row.title}</p>
                      )}
                      <p className="text-xs text-[var(--ink-soft)] mt-1">
                        {[row.president, row.topic].filter(Boolean).join(" • ") || "No metadata"}
                      </p>
                    </div>
                  </th>
                  <td className="py-4 pr-4">
                    <p>{row.legacy_raw_score === null ? "legacy contribution unavailable" : formatRawScore(row.legacy_raw_score)}</p>
                    {row.legacy_relevance ? (
                      <p className="text-xs text-[var(--ink-soft)] mt-1">
                        {row.legacy_relevance} relevance
                      </p>
                    ) : null}
                  </td>
                  <td className="py-4 pr-4">
                    <p>{row.outcome_total_score === null ? "\u2014" : formatRawScore(row.outcome_total_score)}</p>
                    <p className="text-xs text-[var(--ink-soft)] mt-1">
                      {row.outcome_count !== null ? `${row.outcome_count} outcomes` : "No outcome count"}
                    </p>
                  </td>
                  <td className="py-4 pr-4 font-medium">{formatSignedValue(row.score_delta)}</td>
                  <td className="py-4 pr-4">
                    <div className="flex flex-wrap gap-2">
                      {row.neutral_outcome_total ? <MetaPill>Neutral outcome total</MetaPill> : null}
                      {row.has_mixed ? <MetaPill>Mixed outcome</MetaPill> : null}
                      {row.has_blocked ? <MetaPill>Blocked outcome</MetaPill> : null}
                      {row.low_confidence ? <MetaPill>Low confidence</MetaPill> : null}
                    </div>
                    {row.outcome_explanation ? (
                      <p className="text-xs text-[var(--ink-soft)] mt-2 leading-6">{row.outcome_explanation}</p>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default async function PromiseScorePreviewPage() {
  const data = await getPromiseScorePreview();
  const legacy = data.legacy || {
    methodology: data.methodology || null,
    items: data.items || [],
    records: [],
  };
  const outcome = data.outcome || {
    methodology: null,
    items: [],
    records: [],
    metadata: null,
  };

  const legacyItems = legacy.items || [];
  const outcomeItems = outcome.items || [];
  const legacyRecords = legacy.records || [];
  const outcomeRecords = outcome.records || [];
  const comparisonRows = mergePresidentScores(legacyItems, outcomeItems);
  const recordComparisonRows = mergeRecordScores(legacyRecords, outcomeRecords);

  const largestShifts = sortByNumericValue(
    comparisonRows.filter((item) => item.normalized_delta !== null),
    (item) => Math.abs(Number(item.normalized_delta || 0)),
    "desc"
  ).slice(0, 6);

  const topPositiveLegacy = sortByNumericValue(
    legacyItems.map((item) => ({
      president: item.president,
      president_slug: item.president_slug,
      president_party: item.president_party,
      normalized_score: item.normalized_score,
    })),
    (item) => item.normalized_score,
    "desc"
  ).slice(0, 5);

  const topNegativeLegacy = sortByNumericValue(
    legacyItems.map((item) => ({
      president: item.president,
      president_slug: item.president_slug,
      president_party: item.president_party,
      normalized_score: item.normalized_score,
    })),
    (item) => item.normalized_score,
    "asc"
  ).slice(0, 5);

  const topPositiveOutcome = sortByNumericValue(
    outcomeItems.map((item) => ({
      president: item.president,
      president_slug: item.president_slug,
      president_party: item.president_party,
      normalized_score: item.normalized_score_total,
      display_score: item.display_score_total ?? item.display_score ?? null,
      score_confidence: item.score_confidence || null,
      primary_score_family: item.primary_score_family || "direct",
      low_coverage_warning: item.low_coverage_warning || null,
      outcome_count: item.outcome_count,
    })),
    (item) => item.normalized_score,
    "desc"
  ).slice(0, 5);

  const topNegativeOutcome = sortByNumericValue(
    outcomeItems.map((item) => ({
      president: item.president,
      president_slug: item.president_slug,
      president_party: item.president_party,
      normalized_score: item.normalized_score_total,
      display_score: item.display_score_total ?? item.display_score ?? null,
      score_confidence: item.score_confidence || null,
      primary_score_family: item.primary_score_family || "direct",
      low_coverage_warning: item.low_coverage_warning || null,
      outcome_count: item.outcome_count,
    })),
    (item) => item.normalized_score,
    "asc"
  ).slice(0, 5);

  const largestRecordShifts = sortByNumericValue(
    recordComparisonRows.filter((item) => item.score_delta !== null),
    (item) => Math.abs(Number(item.score_delta || 0)),
    "desc"
  ).slice(0, 8);

  const neutralOutcomeRecords = sortByNumericValue(
    recordComparisonRows.filter((item) => item.outcome_total_score !== null && item.neutral_outcome_total),
    (item) => Math.abs(Number(item.legacy_raw_score || 0)),
    "desc"
  ).slice(0, 8);

  const mixedOrBlockedRecords = sortByNumericValue(
    recordComparisonRows.filter((item) => item.has_mixed || item.has_blocked),
    (item) => Math.abs(Number(item.outcome_total_score || 0)),
    "desc"
  ).slice(0, 8);

  const lowConfidenceRecords = sortByNumericValue(
    recordComparisonRows.filter((item) => item.low_confidence),
    (item) => Math.abs(Number(item.outcome_total_score || 0)),
    "desc"
  ).slice(0, 8);

  const outcomeMetadata = outcome.metadata || null;
  const trustMetadata = outcomeMetadata?.trust || null;
  const highConfidencePct = formatPercent(trustMetadata?.high_confidence_outcome_percentage);
  const lowConfidencePct = formatPercent(trustMetadata?.low_confidence_outcome_percentage);
  const incompletePct = formatPercent(trustMetadata?.incomplete_outcome_percentage);
  const outcomesIncludedInScore = Number(outcomeMetadata?.outcomes_included_in_score);
  const totalOutcomesAvailable = Number(outcomeMetadata?.total_outcomes_available);
  const outcomesExcludedFromScore = Number(outcomeMetadata?.outcomes_excluded_from_score);
  const impactTrend = outcomeMetadata?.impact_trend || null;
  const impactTrendInterpretation =
    typeof impactTrend?.interpretation === "string" && impactTrend.interpretation.trim()
      ? impactTrend.interpretation.trim()
      : null;
  const impactTrendDirection =
    typeof impactTrend?.trend_direction === "string" && impactTrend.trend_direction.trim()
      ? impactTrend.trend_direction.trim()
      : null;
  const scoreChange =
    typeof outcomeMetadata?.score_change?.change_summary === "string" &&
    outcomeMetadata.score_change.change_summary.trim() &&
    outcomeMetadata.score_change.has_prior_snapshot
      ? outcomeMetadata.score_change
      : null;

  return (
    <main className="max-w-7xl mx-auto p-6">
      <section className="hero-panel p-8 md:p-10 mb-6">
        <div className="section-intro">
          <p className="eyebrow mb-4">Promise Tracker</p>
          <h1 className="text-4xl md:text-5xl font-bold">Black Impact Score Comparison Preview</h1>
          <p className="text-base md:text-lg text-[var(--ink-soft)] mt-4 leading-8 max-w-3xl">
            This internal page compares the legacy promise-based score model with the newer
            outcome-based model before any public transition. It is intended for methodological
            and record-level review, not public interpretation.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <MetaPill>Model comparison preview</MetaPill>
            <MetaPill>{legacyItems.length} legacy presidents</MetaPill>
            <MetaPill>{outcomeItems.length} outcome presidents</MetaPill>
            <MetaPill>{recordComparisonRows.length} records compared</MetaPill>
          </div>
        </div>
      </section>

      <section className="mb-6 flex flex-wrap gap-3">
        <Link
          href="/promises"
          className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-medium text-white hover:border-white/20 hover:bg-white/8"
        >
          View Presidents
        </Link>
        <Link
          href="/promises/all"
          className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-medium text-white hover:border-white/20 hover:bg-white/8"
        >
          Browse All Promise Records
        </Link>
        <Link
          href="/reports/black-impact-score"
          className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-medium text-white hover:border-white/20 hover:bg-white/8"
        >
          View Current Public Report
        </Link>
      </section>

      {outcome.error ? (
        <section
          className="card-surface rounded-[1.6rem] p-6 mb-8 border border-[rgba(185,28,28,0.18)] bg-[linear-gradient(180deg,rgba(254,242,242,0.9),rgba(255,255,255,0.98))]"
          aria-live="polite"
        >
          <h2 className="text-xl font-semibold">Outcome-Based Model Unavailable</h2>
          <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">
            The outcome-based score payload could not be generated for this request. Legacy comparison data
            remains available below, and outcome-specific ranking and record review sections are marked unavailable.
          </p>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 mb-8">
        <MetricCard
          label="Legacy Promise Model"
          value={legacyItems.length}
          subtitle="President summaries scored from relevance, curation-aware direction, and status."
        />
        <MetricCard
          label="Outcome-Based Model"
          value={outcomeItems.length}
          subtitle="President summaries scored from documented promise outcomes."
        />
      </section>

      <ComparisonTable rows={comparisonRows} />

      <section className="grid gap-4 xl:grid-cols-3 mt-8">
        <LargestShiftList items={largestShifts} />
        <RankingList
          title="Top Positive Presidents by Legacy"
          items={topPositiveLegacy}
          emptyMessage="Legacy model rankings are not available."
        />
        <RankingList
          title="Top Negative Presidents by Legacy"
          items={topNegativeLegacy}
          emptyMessage="Legacy model rankings are not available."
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2 mt-4">
        {outcome.error ? (
          <>
            <UnavailablePanel
              title="Top Positive Presidents by Outcome"
              message="Outcome rankings are unavailable because the outcome-based model did not return a usable payload for this request."
            />
            <UnavailablePanel
              title="Top Negative Presidents by Outcome"
              message="Outcome rankings are unavailable because the outcome-based model did not return a usable payload for this request."
            />
          </>
        ) : (
          <>
            <RankingList
              title="Top Positive Presidents by Outcome"
              items={topPositiveOutcome}
              emptyMessage="Outcome model rankings are not available."
            />
            <RankingList
              title="Top Negative Presidents by Outcome"
              items={topNegativeOutcome}
              emptyMessage="Outcome model rankings are not available."
            />
          </>
        )}
      </section>

      <section className="card-surface rounded-[1.6rem] p-6 mt-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-semibold">Record-Level Comparison Review</h2>
            <p className="text-sm text-[var(--ink-soft)] mt-2 max-w-3xl leading-7">
              This review layer shows which individual promise records are contributing to model divergence.
              It is meant to surface large shifts, neutral outcome totals, mixed or blocked outcome handling,
              and low-confidence records for editorial inspection.
            </p>
          </div>
          <MetaPill>{recordComparisonRows.length} merged records</MetaPill>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mt-5">
          <MetricCard
            label="Legacy Record Contributions"
            value={legacyRecords.length}
            subtle
          />
          <MetricCard
            label="Outcome Record Contributions"
            value={outcome.error ? "Unavailable" : outcomeRecords.length}
            subtle
          />
          <MetricCard
            label="Outcome Metadata"
            value={outcomeMetadata?.scoring_model || (outcome.error ? "Unavailable" : "Loaded")}
            subtitle={
              outcomeMetadata
                ? `${outcomeMetadata.total_promises ?? 0} promises • ${outcomeMetadata.total_outcomes ?? 0} outcomes`
                : outcome.error
                  ? "Outcome model unavailable for this request."
                  : "Outcome metadata unavailable."
            }
            subtle
          />
        </div>
      </section>

      <section className="grid gap-4 mt-4">
        <RecordReviewTable
          title="Largest Record-Level Shifts"
          rows={largestRecordShifts}
          emptyMessage="No record-level shifts can be compared yet."
        />
        <RecordReviewTable
          title="Outcome-Based Neutral Totals"
          rows={neutralOutcomeRecords}
          emptyMessage={outcome.error ? "Outcome model is unavailable." : "No neutral outcome-total records are currently highlighted."}
        />
        <RecordReviewTable
          title="Mixed or Blocked Outcome Records"
          rows={mixedOrBlockedRecords}
          emptyMessage={outcome.error ? "Outcome model is unavailable." : "No mixed or blocked outcome records are currently highlighted."}
        />
        <RecordReviewTable
          title="Low-Confidence Outcome Records"
          rows={lowConfidenceRecords}
          emptyMessage={outcome.error ? "Outcome model is unavailable." : "No low-confidence outcome records are currently highlighted."}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2 mt-8">
        <MethodologyPanel
          title="Legacy Promise Model"
          label="Legacy"
          methodology={legacy.methodology}
        >
          <p className="text-sm text-[var(--ink-soft)] mt-4 leading-7">
            The legacy model is promise-based. It scores records from editorial relevance,
            curation-aware impact direction, and current promise status.
          </p>

          {legacy.methodology ? (
            <div className="grid gap-4 mt-5">
              <div className="card-muted rounded-[1.25rem] p-4">
                <h3 className="text-lg font-semibold">Relevance Weights</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(legacy.methodology.relevance_weights || {}).map(([label, value]) => (
                    <MetaPill key={label}>
                      {label} = {value}
                    </MetaPill>
                  ))}
                </div>
              </div>

              <div className="card-muted rounded-[1.25rem] p-4">
                <h3 className="text-lg font-semibold">Method Notes</h3>
                <ul className="mt-3 space-y-2 text-sm text-[var(--ink-soft)] leading-7">
                  {(legacy.methodology.notes || []).map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--ink-soft)] mt-4">Legacy methodology details are not available.</p>
          )}
        </MethodologyPanel>

        <MethodologyPanel
          title="Outcome-Based Model"
          label="Outcome"
          methodology={outcome.methodology}
        >
          <p className="text-sm text-[var(--ink-soft)] mt-4 leading-7">
            The newer model is outcome-based. It scores documented outcomes, then rolls them up to promises
            and presidents for comparison. This page exists to evaluate that transition before public adoption.
          </p>

          <div className="grid gap-4 mt-5">
            <div className="card-muted rounded-[1.25rem] p-4">
              <h3 className="text-lg font-semibold">Outcome Metadata</h3>
              {outcomeMetadata ? (
                <>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <MetaPill>Promises {outcomeMetadata.total_promises ?? 0}</MetaPill>
                    <MetaPill>Outcomes {outcomeMetadata.total_outcomes ?? 0}</MetaPill>
                    {Number.isFinite(outcomesIncludedInScore) ? (
                      <MetaPill>
                        {totalOutcomesAvailable > 0
                          ? `${outcomesIncludedInScore} of ${totalOutcomesAvailable} included`
                          : `${outcomesIncludedInScore} included`}
                      </MetaPill>
                    ) : null}
                    {Number.isFinite(outcomesExcludedFromScore) ? (
                      <MetaPill>{outcomesExcludedFromScore} excluded</MetaPill>
                    ) : null}
                    {highConfidencePct ? <MetaPill>{highConfidencePct} high-confidence</MetaPill> : null}
                    {lowConfidencePct ? <MetaPill>{lowConfidencePct} low-confidence</MetaPill> : null}
                    {incompletePct ? <MetaPill>{incompletePct} incomplete</MetaPill> : null}
                    {impactTrendDirection ? <MetaPill>Trend: {impactTrendDirection}</MetaPill> : null}
                    {scoreChange ? <MetaPill>Delta {formatSignedValue(scoreChange.delta_score)}</MetaPill> : null}
                    <MetaPill>{outcomeMetadata.scoring_model || "Outcome model"}</MetaPill>
                  </div>
                  {outcomeMetadata.summary_interpretation ? (
                    <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">
                      {outcomeMetadata.summary_interpretation}
                    </p>
                  ) : null}
                  {impactTrendInterpretation ? (
                    <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">
                      {impactTrendInterpretation}
                    </p>
                  ) : null}
                  {scoreChange ? (
                    <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">
                      {scoreChange.change_summary}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-[var(--ink-soft)] mt-3">Outcome metadata is not available.</p>
              )}
            </div>

            {outcome.methodology ? (
              <>
                <div className="card-muted rounded-[1.25rem] p-4">
                  <h3 className="text-lg font-semibold">Evidence Multipliers</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(outcome.methodology.outcome_scoring?.evidence_multipliers || {}).map(([label, value]) => (
                      <MetaPill key={label}>
                        {label} = {value}
                      </MetaPill>
                    ))}
                  </div>
                </div>

                <div className="card-muted rounded-[1.25rem] p-4">
                  <h3 className="text-lg font-semibold">Method Notes</h3>
                  <ul className="mt-3 space-y-2 text-sm text-[var(--ink-soft)] leading-7">
                    {(outcome.methodology.notes || []).map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <p className="text-sm text-[var(--ink-soft)]">Outcome methodology details are not available.</p>
            )}
          </div>
        </MethodologyPanel>
      </section>
    </main>
  );
}
