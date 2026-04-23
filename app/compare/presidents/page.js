import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import { resolvePresidentImageSrc } from "@/lib/president-image-paths";
import { fetchComparePresidentsData } from "@/lib/public-site-data";
import { getAgendaOverlapComparisonForPresidents } from "@/lib/agendas";
import { buildEvidenceSignal, buildResearchCoverage } from "@/lib/evidenceCoverage";
import { Breadcrumbs } from "@/app/components/public/chrome";
import EvidenceBadge from "@/app/components/public/EvidenceBadge";
import {
  KpiCard,
  ScoreBadge,
  SectionIntro,
} from "@/app/components/public/core";
import WhyThisScorePanel from "@/app/components/public/WhyThisScorePanel";
import {
  CompareSelector,
  ComparisonMetricsTable,
  PresidentPortrait,
} from "@/app/components/public/entities";
import {
  MetricCard,
  Panel,
  StatusPill,
  getImpactDirectionTone,
} from "@/app/components/dashboard/primitives";
import TrustBar from "@/app/components/public/TrustBar";

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "Compare Presidents",
  description:
    "Compare 2–4 presidents using direct score, systemic score, confidence, outcome counts, and directional mix.",
  path: "/compare/presidents",
});

function normalizeSelected(value) {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list
    .flatMap((item) => String(item).split(","))
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function formatScore(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : "—";
}

function rankConfidence(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("high") || normalized.includes("strong")) {
    return 3;
  }
  if (normalized.includes("medium") || normalized.includes("moderate")) {
    return 2;
  }
  if (normalized.includes("low") || normalized.includes("weak")) {
    return 1;
  }
  return 0;
}

function findDominantDirection(breakdown = {}) {
  return Object.entries({
    Positive: Number(breakdown.Positive || 0),
    Negative: Number(breakdown.Negative || 0),
    Mixed: Number(breakdown.Mixed || 0),
    Blocked: Number(breakdown.Blocked || 0),
  }).sort((left, right) => right[1] - left[1])[0]?.[0] || null;
}

function humanizeDirection(label) {
  return String(label || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildCompareWhyThisScore({
  comparedPresidents = [],
  directLeader = null,
  directRunnerUp = null,
  directGap = null,
  strongestTopicDifference = null,
}) {
  if (!comparedPresidents.length) {
    return null;
  }

  const leaderName = directLeader?.president_name || "The current leader";
  const runnerUpName = directRunnerUp?.president_name || null;
  const leaderDirection = findDominantDirection(directLeader?.direct_direction_counts);
  const runnerUpDirection = findDominantDirection(directRunnerUp?.direct_direction_counts);
  const coverageByStrength = comparedPresidents
    .map((item) => {
      const coverage = buildResearchCoverage({
        sourceCount: item.visible_source_count ?? 0,
        outcomeCount: item.direct_outcome_count ?? item.outcome_count ?? 0,
        relatedRecordCount: item.visible_promise_count ?? item.promise_count ?? 0,
        hasScore: Number.isFinite(Number(item.direct_normalized_score)),
        confidenceLabel: item.direct_score_confidence || null,
      });

      return {
        president: item,
        coverage,
        confidenceRank: rankConfidence(item.direct_score_confidence),
      };
    })
    .sort((left, right) => {
      const toneRank = (tone) =>
        tone === "verified" ? 3 : tone === "info" ? 2 : tone === "warning" ? 1 : 0;
      return (
        toneRank(right.coverage?.tone) - toneRank(left.coverage?.tone) ||
        right.confidenceRank - left.confidenceRank ||
        Number(right.president.direct_outcome_count || 0) -
          Number(left.president.direct_outcome_count || 0)
      );
    });
  const evidenceLeader = coverageByStrength[0]?.president || null;
  const evidenceRunnerUp = coverageByStrength[1]?.president || null;

  return {
    summary:
      directLeader && runnerUpName
        ? `${leaderName} currently leads on direct Black Impact Score. Read the gap through direct score first, then use confidence, visible outcomes, and the strongest topic split to see whether the lead is broad or relatively narrow.`
        : `${leaderName} is the only fully comparable president in the current selection.`,
    items: [
      directLeader && runnerUpName
        ? {
            label: "Current lead",
            value: `${leaderName} by ${formatScore(directGap)}`,
            detail: `This is the direct-score gap between ${leaderName} and ${runnerUpName}.`,
          }
        : null,
      leaderDirection || runnerUpDirection
        ? {
            label: "Direction read",
            value: `${leaderName}: ${humanizeDirection(leaderDirection || "Unknown")} • ${
              runnerUpName || "Comparison"
            }: ${humanizeDirection(runnerUpDirection || "Unknown")}`,
            detail:
              "Dominant direction helps explain whether a president's visible record leans more positive, negative, mixed, or blocked.",
          }
        : null,
      evidenceLeader
        ? {
            label: "Evidence edge",
            value: `${evidenceLeader.president_name}${
              evidenceRunnerUp ? ` over ${evidenceRunnerUp.president_name}` : ""
            }`,
            detail: `${
              evidenceLeader.direct_score_confidence || "Unknown"
            } confidence • ${evidenceLeader.direct_outcome_count ?? 0} direct outcomes • ${
              evidenceLeader.visible_source_count ?? 0
            } visible sources.`,
          }
        : null,
      strongestTopicDifference?.topic
        ? {
            label: "Strongest topic split",
            value: strongestTopicDifference.topic,
            detail: `${
              strongestTopicDifference.stronger_president || "Neither president"
            } has the stronger raw contribution in this topic across the first two selected records.`,
          }
        : null,
    ].filter(Boolean),
    note:
      directLeader?.score_scope_note ||
      directLeader?.score_interpretation ||
      "When the score gap is close, lean harder on confidence, source density, and outcome counts before treating the separation as decisive.",
  };
}

function AgendaOverlapComparePanel({ comparison }) {
  if (!comparison) {
    return null;
  }

  return (
    <Panel padding="md" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
            Agenda Tracker overlap
          </p>
          <div>
            <h2 className="text-lg font-semibold text-white">Project 2025 overlap</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
              {comparison.summary} This reads only from verified links between the tracked agenda
              and existing EquityStack records. It does not change any Black Impact Score.
            </p>
          </div>
        </div>
        <Link href="/agendas/project-2025" className="text-sm font-medium text-[var(--accent)]">
          Open tracker
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {comparison.entities.map((item) => (
          <Panel key={item.president_slug || item.president_name} padding="md" className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-white">{item.president_name}</h3>
                {item.term_label ? (
                  <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[var(--ink-muted)]">
                    {item.term_label}
                  </p>
                ) : null}
              </div>
              <StatusPill tone={item.has_overlap ? "info" : "default"}>
                {item.has_overlap
                  ? `${item.linked_agenda_item_count} linked agenda item${
                      item.linked_agenda_item_count === 1 ? "" : "s"
                    }`
                  : "No verified overlap yet"}
              </StatusPill>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <MetricCard
                density="compact"
                label="Agenda items"
                value={item.linked_agenda_item_count}
                tone={item.has_overlap ? "info" : "default"}
              />
              <MetricCard
                density="compact"
                label="Linked records"
                value={item.linked_record_count}
                tone={item.has_overlap ? "verified" : "default"}
              />
              <MetricCard
                density="compact"
                label="Top domain"
                value={item.top_domain?.domain || "—"}
              />
            </div>

            {item.top_domains.length ? (
              <div className="flex flex-wrap gap-2 text-xs text-[var(--ink-muted)]">
                {item.top_domains.map((domain) => (
                  <span
                    key={`${item.president_slug || item.president_name}-${domain.domain}`}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5"
                  >
                    {domain.domain} ({domain.count})
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs leading-6 text-[var(--ink-muted)]">
                No verified Project 2025-linked records are attached to this comparison record yet.
              </p>
            )}

            {item.linked_records_preview.length ? (
              <p className="text-xs leading-6 text-[var(--ink-soft)]">
                Linked records:{" "}
                {item.linked_records_preview.map((record) => record.title).join(" • ")}
              </p>
            ) : null}
          </Panel>
        ))}
      </div>
    </Panel>
  );
}

export default async function ComparePresidentsPage({ searchParams }) {
  const resolvedSearchParams = (await searchParams) || {};
  const selected = normalizeSelected(resolvedSearchParams.compare);
  const data = await fetchComparePresidentsData(selected);
  const comparedPresidents = data.compared_presidents || [];
  const rows = (data.compared_presidents || []).map((item) => ({
    label: item.president_name,
    direct_score: formatScore(item.direct_normalized_score),
    direct_confidence: item.direct_score_confidence || "Unknown",
    outcomes: item.direct_outcome_count ?? item.outcome_count ?? 0,
    systemic_score: formatScore(item.systemic_normalized_score),
    systemic_confidence: item.systemic_score_confidence || "Unknown",
    promises: item.promise_count ?? 0,
  }));
  const sortedByDirectScore = comparedPresidents
    .slice()
    .sort(
      (left, right) =>
        Number(right.direct_normalized_score || 0) -
        Number(left.direct_normalized_score || 0)
    );
  const directLeader = sortedByDirectScore[0] || null;
  const directRunnerUp = sortedByDirectScore[1] || null;
  const sortedByOutcomes = comparedPresidents
    .slice()
    .sort(
      (left, right) =>
        Number(right.direct_outcome_count ?? right.outcome_count ?? 0) -
        Number(left.direct_outcome_count ?? left.outcome_count ?? 0)
    );
  const outcomeLeader = sortedByOutcomes[0] || null;
  const sortedBySystemicScore = comparedPresidents
    .slice()
    .sort(
      (left, right) =>
        Number(right.systemic_normalized_score || 0) -
        Number(left.systemic_normalized_score || 0)
    );
  const systemicLeader = sortedBySystemicScore[0] || null;
  const directGap =
    directLeader && directRunnerUp
      ? Math.abs(
          Number(directLeader.direct_normalized_score || 0) -
            Number(directRunnerUp.direct_normalized_score || 0)
        )
      : null;
  const whyThisComparison = buildCompareWhyThisScore({
    comparedPresidents,
    directLeader,
    directRunnerUp,
    directGap,
    strongestTopicDifference: data.strongest_topic_difference,
  });
  const agendaOverlapComparison = getAgendaOverlapComparisonForPresidents(
    comparedPresidents,
    "project-2025"
  );

  return (
    <main className="space-y-4">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/compare", label: "Compare" },
          { label: "Presidents" },
        ]}
      />

      <section className="hero-panel p-4">
        <SectionIntro
          as="h1"
          eyebrow="President comparison"
          title="Compare presidents by direct Black Impact Score first."
          description="Higher direct score means a more positive documented direct impact in the current EquityStack record. Use direct score as the headline comparison, then use confidence, outcome coverage, and systemic score to explain why presidents separate."
        />
      </section>

      <TrustBar />

      <section className="space-y-4">
        <form action="/compare/presidents" method="GET" className="space-y-4">
          <CompareSelector
            options={data.options || []}
            selected={data.selected_identifiers || []}
            name="compare"
          />
          <button type="submit" className="dashboard-button-primary">
            {selected.length >= 2
              ? `Compare ${selected.length} selected president${selected.length === 1 ? "" : "s"}`
              : "Compare selected presidents"}
          </button>
        </form>
        <p className="max-w-4xl text-sm leading-7 text-[var(--ink-soft)]">
          Select 2–4 presidents. Columns are presidents and rows are comparison metrics. Start with
          direct score, then check evidence confidence and direct outcomes to see whether the gap is
          broad, thin, or concentrated in a smaller record set.
        </p>
      </section>

      {data.comparison_ready ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Highest direct score"
              value={directLeader ? formatScore(directLeader.direct_normalized_score) : "—"}
              description={
                directLeader
                  ? `${directLeader.president_name} currently leads on documented direct impact.`
                  : "No direct-score leader is available."
              }
              tone="accent"
            />
            <KpiCard
              label="Direct score gap"
              value={directGap != null ? formatScore(directGap) : "—"}
              description={
                directLeader && directRunnerUp
                  ? `Gap between ${directLeader.president_name} and ${directRunnerUp.president_name}.`
                  : "A score gap appears when at least two presidents are comparable."
              }
            />
            <KpiCard
              label="Most direct outcomes"
              value={outcomeLeader ? outcomeLeader.direct_outcome_count ?? outcomeLeader.outcome_count ?? 0 : "—"}
              description={
                outcomeLeader
                  ? `${outcomeLeader.president_name} has the widest direct outcome coverage in this set.`
                  : "Outcome coverage is not available."
              }
            />
            <KpiCard
              label="Highest systemic score"
              value={systemicLeader ? formatScore(systemicLeader.systemic_normalized_score) : "—"}
              description={
                systemicLeader
                  ? `${systemicLeader.president_name} currently leads once systemic effects are included.`
                  : "Systemic comparison is not available."
              }
            />
          </section>

          <ComparisonMetricsTable
            rows={rows}
            metrics={[
              {
                key: "direct_score",
                label: "Direct Impact Score",
                description: "Higher = more positive documented direct impact.",
                primary: true,
              },
              {
                key: "direct_confidence",
                label: "Direct evidence confidence",
                description: "Use this to judge how hard to lean on the score.",
              },
              {
                key: "outcomes",
                label: "Direct outcomes",
                description: "Visible outcome coverage behind the direct score.",
              },
              {
                key: "systemic_score",
                label: "Systemic Impact Score",
                description: "Shows the broader record once systemic effects are included.",
              },
              {
                key: "systemic_confidence",
                label: "Systemic confidence",
                description: "Confidence level for the systemic layer.",
              },
              {
                key: "promises",
                label: "Tracked promises",
                description: "Promise-tracker context attached to each presidency.",
              },
            ]}
          />

          <section className="grid items-start gap-6 2xl:grid-cols-[1.08fr_0.92fr]">
            <div className="space-y-5">
              <SectionIntro
                eyebrow="Interpretation"
                title="What to look at first"
                description="If one president has the higher direct score and similar or stronger confidence and outcomes, that is the clearest lead in this comparison."
              />
              <WhyThisScorePanel
                eyebrow="Why these scores differ"
                title="What is separating this comparison"
                summary={whyThisComparison?.summary}
                items={whyThisComparison?.items}
                note={whyThisComparison?.note}
                actionHref="/research/how-black-impact-score-works"
                actionLabel="Read the scoring method"
              />
              <AgendaOverlapComparePanel comparison={agendaOverlapComparison} />
              <div className="rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4 text-sm leading-7 text-[var(--ink-soft)]">
                {data.directional_contrast_summary ||
                  "Directional contrast summary is not available for the current selection."}
              </div>
              <div className="rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4">
                <h2 className="text-lg font-semibold text-white">How to read a close comparison</h2>
                <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                  When direct scores are close, check confidence and direct outcomes before treating the difference as decisive. Systemic score and topic concentration explain where the visible separation is coming from.
                </p>
              </div>
              {data.strongest_topic_difference ? (
                <div className="rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
                    Strongest topic difference
                  </p>
                  <h2 className="mt-3 text-lg font-semibold text-white">
                    {data.strongest_topic_difference.topic}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                    {data.strongest_topic_difference.stronger_president || "Neither president"} shows
                    the stronger raw contribution in this topic across the first two selected records.
                  </p>
                </div>
              ) : null}
            </div>
            <div className="grid gap-4">
              {(data.compared_presidents || []).map((item) => {
                const imageSrc = resolvePresidentImageSrc({
                  presidentSlug: item.president_slug,
                  presidentName: item.president_name,
                });
                const evidenceSignal = buildEvidenceSignal({
                  confidenceLabel: item.direct_score_confidence || null,
                  sourceCount: item.visible_source_count ?? 0,
                  hasScore: Number.isFinite(Number(item.direct_normalized_score)),
                });
                const dominantDirection = findDominantDirection(
                  item.direct_direction_counts || item.directional_breakdown
                );

                return (
                  <article
                    key={item.president_slug || item.president_id}
                    className="rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4 md:p-6"
                  >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <PresidentPortrait
                        imageSrc={imageSrc}
                        alt={item.president_name || "President portrait"}
                        context="compare"
                      />
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                          {item.president_party || "Historical record"}
                        </p>
                        <h2 className="mt-2 text-xl font-semibold text-white">
                          {item.president_name}
                        </h2>
                        {item.termLabel ? (
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                            {item.termLabel}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <ScoreBadge value={formatScore(item.direct_normalized_score)} label="Direct" />
                  </div>
                  <EvidenceBadge signal={evidenceSignal} className="mt-4" />
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--ink-muted)]">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                      {item.direct_score_confidence || "Unknown"} confidence
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                      {item.direct_outcome_count ?? 0} outcomes
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                      {item.promise_count ?? 0} promises
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                      Kept {item.delivered_count ?? 0} • Blocked {item.blocked_count ?? 0}
                    </span>
                  </div>
                  <div className="mt-4 rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.52)] p-4 text-sm leading-7 text-[var(--ink-soft)]">
                    Documented direction mix: Positive {item.directional_breakdown?.Positive || 0} • Negative {item.directional_breakdown?.Negative || 0} • Mixed {item.directional_breakdown?.Mixed || 0} • Blocked {item.directional_breakdown?.Blocked || 0}
                  </div>
                  <Panel padding="md" className="mt-4 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {dominantDirection ? (
                        <StatusPill tone={getImpactDirectionTone(dominantDirection)}>
                          {humanizeDirection(dominantDirection)} leaning
                        </StatusPill>
                      ) : null}
                      {item.top_driver_topics?.[0] ? (
                        <StatusPill tone="info">
                          Top driver: {item.top_driver_topics[0]}
                        </StatusPill>
                      ) : null}
                    </div>
                    <p className="text-sm leading-7 text-[var(--ink-soft)]">
                      {item.score_summary_line ||
                        item.score_interpretation ||
                        "Open the president profile for fuller score-driver context."}
                    </p>
                  </Panel>
                  {item.top_contributing_topics?.length ? (
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--ink-muted)]">
                      {item.top_contributing_topics.slice(0, 3).map((topic) => (
                        <span
                          key={`${item.president_name}-${topic.topic}`}
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5"
                        >
                          {topic.topic}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <Link
                    href={`/presidents/${item.president_slug}`}
                    className="mt-5 inline-flex text-sm font-medium text-[var(--accent)]"
                  >
                    Open profile for score drivers
                  </Link>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      ) : (
        <section className="dashboard-empty-state text-sm leading-7 text-[var(--ink-soft)]">
          Select at least two presidents to generate a comparison. The page will compare up to four valid records at once.
        </section>
      )}
    </main>
  );
}
