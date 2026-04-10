import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import { fetchComparePresidentsData } from "@/lib/public-site-data";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  KpiCard,
  MethodologyCallout,
  PageContextBlock,
  PresidentScoreMethodologyNote,
  ScoreBadge,
  SectionIntro,
} from "@/app/components/public/core";
import {
  CompareSelector,
  ComparisonMetricsTable,
} from "@/app/components/public/entities";
import TrustBar from "@/app/components/public/TrustBar";
import ScoreExplanation from "@/app/components/public/ScoreExplanation";

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

export default async function ComparePresidentsPage({ searchParams }) {
  const resolvedSearchParams = (await searchParams) || {};
  const selected = normalizeSelected(resolvedSearchParams.compare);
  const data = await fetchComparePresidentsData(selected);
  const rows = (data.compared_presidents || []).map((item) => ({
    label: item.president_name,
    direct_score: formatScore(item.direct_normalized_score),
    systemic_score: formatScore(item.systemic_normalized_score),
    outcomes: item.direct_outcome_count ?? item.outcome_count ?? 0,
    promises: item.promise_count ?? 0,
    direct_confidence: item.direct_score_confidence || "Unknown",
    systemic_confidence: item.systemic_score_confidence || "Unknown",
  }));

  return (
    <main className="space-y-10">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/compare", label: "Compare" },
          { label: "Presidents" },
        ]}
      />

      <section className="hero-panel p-8 md:p-10 xl:p-14">
        <SectionIntro
          as="h1"
          eyebrow="President comparison"
          title="Compare presidents without blending away direct and systemic differences."
          description="This page keeps direct score as the headline, keeps systemic judicial effects separate, and shows confidence so low-coverage records do not look more absolute than they are."
        />
      </section>

      <TrustBar />

      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <form action="/compare/presidents" method="GET" className="space-y-4">
          <CompareSelector
            options={data.options || []}
            selected={data.selected_identifiers || []}
            name="compare"
          />
          <button type="submit" className="public-button-primary">
            Compare selected presidents
          </button>
        </form>
        <div className="space-y-5">
          <PageContextBlock
            description="This page compares up to four presidential records using direct Impact Score first, then systemic context, outcome counts, and Confidence."
            detail="Use it to identify meaningful differences, then open each profile for trend lines, evidence footprint, and record-level detail."
          />
          <PresidentScoreMethodologyNote />
          <MethodologyCallout description="Use direct score as the main read. Systemic score helps show appointment-driven downstream effects, but it is not the primary headline metric." />
          <ScoreExplanation title="How to read presidential comparison scores" />
        </div>
      </section>

      {data.comparison_ready ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Compared presidents"
              value={data.compared_presidents.length}
              description="Valid presidential records in the current comparison set."
              tone="accent"
            />
            <KpiCard
              label="Direct Impact Score delta"
              value={formatScore(data.score_difference?.direct_normalized_score_difference)}
              description="Difference between the first two compared presidents on direct normalized score."
            />
            <KpiCard
              label="Systemic Impact Score delta"
              value={formatScore(data.score_difference?.systemic_normalized_score_difference)}
              description="Difference between the first two compared presidents on systemic normalized score."
            />
            <KpiCard
              label="Largest topic gap"
              value={data.strongest_topic_difference?.topic || "—"}
              description="Topic with the largest raw contribution difference across the first two selected presidents."
            />
          </section>

          <ComparisonMetricsTable
            rows={rows}
            metrics={[
              { key: "direct_score", label: "Direct Impact Score" },
              { key: "systemic_score", label: "Systemic Impact Score" },
              { key: "outcomes", label: "Direct outcomes" },
              { key: "promises", label: "Tracked promises" },
              { key: "direct_confidence", label: "Direct Confidence" },
              { key: "systemic_confidence", label: "Systemic Confidence" },
            ]}
          />

          <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <div className="space-y-5">
              <SectionIntro
                eyebrow="Interpretation"
                title="What the comparison shows"
                description="The comparison layer keeps the analytic summary compact and pushes you toward the deeper profile pages for full evidence and trend context."
              />
              <div className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5 text-sm leading-7 text-[var(--ink-soft)]">
                {data.directional_contrast_summary ||
                  "Directional contrast summary is not available for the current selection."}
              </div>
              <div className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
                <h2 className="text-lg font-semibold text-white">How to read score differences</h2>
                <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                  Larger gaps suggest different measured policy records in the EquityStack dataset, not a full historical judgment. Confidence, direction mix, and topic concentration help explain whether a gap is broad-based or driven by a smaller set of records.
                </p>
              </div>
              {data.strongest_topic_difference ? (
                <div className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
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
              {(data.compared_presidents || []).map((item) => (
                <article
                  key={item.president_slug || item.president_id}
                  className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5"
                >
                  <div className="flex items-start justify-between gap-4">
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
                    <ScoreBadge value={formatScore(item.direct_normalized_score)} label="Direct" />
                  </div>
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
                      Delivered {item.delivered_count ?? 0} • Blocked {item.blocked_count ?? 0}
                    </span>
                  </div>
                  <div className="mt-4 rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4 text-sm leading-7 text-[var(--ink-soft)]">
                    Positive {item.directional_breakdown?.Positive || 0} • Negative {item.directional_breakdown?.Negative || 0} • Mixed {item.directional_breakdown?.Mixed || 0} • Blocked {item.directional_breakdown?.Blocked || 0}
                  </div>
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
                    Open profile
                  </Link>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="rounded-[1.6rem] border border-dashed border-white/12 bg-white/4 p-6 text-sm leading-7 text-[var(--ink-soft)]">
          Select at least two presidents to generate a comparison. The page will compare up to four valid records at once.
        </section>
      )}
    </main>
  );
}
