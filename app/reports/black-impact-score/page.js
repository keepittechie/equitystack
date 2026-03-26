import Link from "next/link";
import { fetchInternalJson } from "@/lib/api";
import { REPORT_REVALIDATE_SECONDS, withRevalidate } from "@/lib/cache";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "Black Impact Score",
  description:
    "A Promise Tracker report summarizing presidential accountability for promises and outcomes tied to Black-community impacts.",
  path: "/reports/black-impact-score",
});

async function getBlackImpactScores() {
  return fetchInternalJson("/api/promises/scores", {
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
  return Number.isFinite(numeric) ? numeric.toFixed(4) : String(value);
}

function formatSignedScore(value) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return String(value);
  const fixed = numeric.toFixed(2);
  return numeric > 0 ? `+${fixed}` : fixed;
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

            return (
              <div key={label}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-[var(--ink-soft)]">{label}</span>
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
              {item.topic}: {formatSignedScore(item.raw_score)}
            </MetaPill>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--ink-soft)] mt-3">No topic breakdown is available.</p>
      )}
    </section>
  );
}

function PromiseDriverList({ title, items, emptyMessage }) {
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
          {items.slice(0, 3).map((promise) => (
            <div
              key={promise.slug}
              className="rounded-[1rem] border border-[rgba(120,53,15,0.1)] bg-white/85 p-4"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
                    {promise.topic || "No topic"}
                  </p>
                  <Link href={`/promises/${promise.slug}`} className="accent-link text-base font-semibold mt-2 inline-block">
                    {promise.title}
                  </Link>
                </div>
                <MetaPill>{formatSignedScore(promise.raw_score)}</MetaPill>
              </div>

              <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">
                {promise.summary || "No summary added yet."}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function BlackImpactScorePage() {
  const data = await getBlackImpactScores();
  const methodology = data.methodology || null;
  const presidents = data.items || [];

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-8">
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
      </div>

      <section className="hero-panel p-8 md:p-10">
        <p className="eyebrow mb-4">Promise Tracker Report</p>
        <h1 className="text-4xl md:text-5xl font-bold">Black Impact Score</h1>
        <p className="text-base md:text-lg text-[var(--ink-soft)] mt-4 max-w-3xl leading-8">
          This report measures presidential accountability for tracked promises tied to Black-community outcomes.
          It weighs what was promised, what happened, and whether the result helped, harmed, or failed Black communities.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <MetaPill>{presidents.length} presidents scored</MetaPill>
          <MetaPill>Built from Promise Tracker relevance, impact, and status</MetaPill>
          <MetaPill>Raw and normalized views</MetaPill>
        </div>
      </section>

      <section className="card-surface rounded-[1.6rem] p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="max-w-3xl">
            <h2 className="text-lg font-semibold mb-2">Built From Promise Tracker</h2>
            <p className="text-sm text-[var(--ink-soft)] leading-7">
              This report is not a separate product surface. It summarizes the same Promise Tracker records,
              actions, and outcomes in a president-level score view.
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

      <section className="card-surface rounded-[1.6rem] p-5">
        <details>
          <summary className="cursor-pointer text-lg font-semibold">Methodology</summary>
          <div className="mt-4 space-y-4">
            <p className="text-sm text-[var(--ink-soft)] leading-7">
              The Black Impact Score uses Promise Tracker&apos;s relevance curation and a transparent weighting model.
              It is designed as a presidential accountability measure tied to Black-community outcomes, not a generic promise-keeping score.
            </p>

            <div className="card-muted rounded-[1.25rem] p-4">
              <h2 className="text-base font-semibold">How to read the score</h2>
              <ul className="mt-3 space-y-2 text-sm text-[var(--ink-soft)]">
                <li>Helpful promises delivered raise the score.</li>
                <li>Helpful promises that were blocked or failed lower the score.</li>
                <li>Harmful promises delivered lower the score.</li>
                <li>Harmful promises that were blocked or failed are treated as neutral, not positive.</li>
              </ul>
            </div>

            {methodology ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="card-muted rounded-[1.25rem] p-4">
                    <h2 className="text-base font-semibold">Relevance Weights</h2>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {Object.entries(methodology.relevance_weights || {}).map(([label, value]) => (
                        <MetaPill key={label}>
                          {label} = {value}
                        </MetaPill>
                      ))}
                    </div>
                  </div>

                  <div className="card-muted rounded-[1.25rem] p-4">
                    <h2 className="text-base font-semibold">Status Grouping</h2>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {Object.entries(methodology.status_grouping || {}).map(([label, value]) => (
                        <MetaPill key={label}>
                          {label} → {value}
                        </MetaPill>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  {Object.entries(methodology.outcome_multipliers || {}).map(([direction, values]) => (
                    <div key={direction} className="card-muted rounded-[1.25rem] p-4">
                      <h2 className="text-base font-semibold">{direction} Multipliers</h2>
                      <div className="mt-3 space-y-2 text-sm text-[var(--ink-soft)]">
                        {Object.entries(values || {}).map(([status, value]) => (
                          <div key={status} className="flex items-center justify-between gap-3">
                            <span>{status}</span>
                            <span className="font-medium text-[var(--ink)]">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

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
                    {president.score_explanation}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  {president.president_party ? <MetaPill>{president.president_party}</MetaPill> : null}
                  <Link
                    href={`/promises/president/${president.president_slug}`}
                    className="rounded-full border border-[rgba(120,53,15,0.12)] bg-white/80 px-4 py-2 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--accent)]"
                  >
                    See Promise Tracker data
                  </Link>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3 mt-6">
                <ScoreCard
                  label="Normalized Score"
                  value={formatNormalizedScore(president.normalized_score)}
                  subtitle="Primary comparison view across presidents"
                />
                <ScoreCard
                  label="Raw Score"
                  value={formatRawScore(president.raw_score)}
                  subtitle="Weighted total across tracked promises"
                />
                <ScoreCard
                  label="Tracked Promises"
                  value={president.promise_count}
                  subtitle="Promise Tracker records included in this score"
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2 mt-6">
                <CountBarGroup title="Breakdown by Status" counts={president.counts_by_status} />
                <CountBarGroup
                  title="Breakdown by Impact Direction"
                  counts={president.counts_by_impact_direction}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2 mt-6">
                <CountBarGroup title="Breakdown by Relevance" counts={president.counts_by_relevance} />
                <TopicBreakdown items={president.score_by_topic || []} />
              </div>

              <div className="grid gap-4 xl:grid-cols-3 mt-6">
                <PromiseDriverList
                  title="Key Positive Drivers"
                  items={president.top_positive_promises || []}
                  emptyMessage="No positive score drivers are currently highlighted for this president."
                />
                <PromiseDriverList
                  title="Key Negative Drivers"
                  items={president.top_negative_promises || []}
                  emptyMessage="No negative score drivers are currently highlighted for this president."
                />
                <PromiseDriverList
                  title="Key Blocked Drivers"
                  items={president.top_blocked_promises || []}
                  emptyMessage="No blocked or unrealized drivers are currently highlighted for this president."
                />
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
