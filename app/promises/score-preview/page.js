import Link from "next/link";
import { PromiseRelevanceBadge, PromiseStatusBadge } from "@/app/components/policy-badges";
import { fetchInternalJson } from "@/lib/api";
import { PUBLIC_REVALIDATE_SECONDS, withRevalidate } from "@/lib/cache";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "Black Impact Score Preview",
  description:
    "Internal preview of Promise Tracker Black Impact Score outputs by president.",
  path: "/promises/score-preview",
});

async function getPromiseScorePreview() {
  return fetchInternalJson("/api/promises/scores", {
    ...withRevalidate(PUBLIC_REVALIDATE_SECONDS),
    errorMessage: "Failed to fetch promise score preview",
  });
}

function MetaPill({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[rgba(120,53,15,0.12)] bg-white/80 px-3 py-1 text-xs text-[var(--ink-soft)]">
      {children}
    </span>
  );
}

function MetricCard({ label, value, subtle = false }) {
  return (
    <div className={`${subtle ? "card-muted" : "card-surface"} rounded-[1.15rem] px-4 py-4`}>
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">{label}</p>
      <p className="text-xl font-semibold mt-2">{value}</p>
    </div>
  );
}

function CountPill({ label, count }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(120,53,15,0.12)] bg-white/80 px-3 py-2 text-sm text-[var(--ink-soft)]">
      <span className="font-medium text-[var(--ink)]">{count}</span>
      <span>{label}</span>
    </span>
  );
}

function formatNormalizedScore(value) {
  if (value === null || value === undefined) return "0.0000";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return numeric.toFixed(4);
}

function formatRawScore(value) {
  if (value === null || value === undefined) return "0.00";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return numeric.toFixed(2);
}

function PromiseScoreList({ title, items, tone }) {
  const emptyLabels = {
    positive: "No positive-score promises are currently driving this presidency's total.",
    negative: "No negative-score promises are currently dragging this presidency's total.",
    blocked: "No blocked or unrealized promises are currently highlighted in this presidency's top set.",
  };

  return (
    <section className="card-muted rounded-[1.25rem] p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        <MetaPill>{items.length} shown</MetaPill>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-[var(--ink-soft)]">{emptyLabels[tone]}</p>
      ) : (
        <div className="space-y-3">
          {items.map((promise) => (
            <div key={promise.slug} className="rounded-[1rem] border border-[rgba(120,53,15,0.1)] bg-white/85 p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
                    {promise.topic || "No topic"}
                  </p>
                  <Link href={`/promises/${promise.slug}`} className="accent-link text-base font-semibold mt-2 inline-block">
                    {promise.title}
                  </Link>
                </div>
                <div className="flex flex-wrap gap-2">
                  <PromiseRelevanceBadge relevance={promise.relevance} />
                  <PromiseStatusBadge status={promise.status} />
                </div>
              </div>

              <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">
                {promise.summary || "No summary added yet."}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <MetaPill>Raw score {formatRawScore(promise.raw_score)}</MetaPill>
                <MetaPill>Normalized {formatNormalizedScore(promise.normalized_score)}</MetaPill>
                <MetaPill>{promise.president}</MetaPill>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function PromiseScorePreviewPage() {
  const data = await getPromiseScorePreview();
  const methodology = data.methodology || null;
  const items = data.items || [];

  return (
    <main className="max-w-7xl mx-auto p-6">
      <section className="hero-panel p-8 md:p-10 mb-6">
        <div className="section-intro">
          <p className="eyebrow mb-4">Promise Tracker</p>
          <h1 className="text-4xl md:text-5xl font-bold">Black Impact Score Preview</h1>
          <p className="text-base md:text-lg text-[var(--ink-soft)] mt-4 leading-8 max-w-3xl">
            This internal preview surfaces the current president-level score outputs from the Promise Tracker
            scoring model before a public dashboard is built.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <MetaPill>{items.length} presidents scored</MetaPill>
            <MetaPill>Read-only validation preview</MetaPill>
            <MetaPill>Uses current relevance, impact, and status scoring inputs</MetaPill>
          </div>
        </div>
      </section>

      <section className="mb-6 flex flex-wrap gap-3">
        <Link
          href="/promises"
          className="rounded-full border border-[rgba(120,53,15,0.18)] bg-white/80 px-5 py-2 text-sm font-medium"
        >
          View Presidents
        </Link>
        <Link
          href="/promises/all"
          className="rounded-full border border-[rgba(120,53,15,0.18)] bg-white/80 px-5 py-2 text-sm font-medium"
        >
          Browse All Promise Records
        </Link>
      </section>

      <section className="card-surface rounded-[1.6rem] p-6 mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-semibold">Methodology</h2>
            <p className="text-sm text-[var(--ink-soft)] mt-2 max-w-3xl leading-7">
              This preview uses a transparent weighted model. Each promise contributes according to its relevance
              to Black-community outcomes and the combination of its curation-aware impact direction and current status.
            </p>
          </div>
          {methodology ? <MetaPill>API-backed score logic</MetaPill> : null}
        </div>

        {methodology ? (
          <div className="grid gap-5 lg:grid-cols-3 mt-5">
            <div className="card-muted rounded-[1.25rem] p-4">
              <h3 className="text-lg font-semibold">Relevance Weights</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(methodology.relevance_weights || {}).map(([label, value]) => (
                  <MetaPill key={label}>
                    {label} = {value}
                  </MetaPill>
                ))}
              </div>
            </div>

            <div className="card-muted rounded-[1.25rem] p-4 lg:col-span-2">
              <h3 className="text-lg font-semibold">Outcome Multipliers</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {Object.entries(methodology.outcome_multipliers || {}).map(([direction, values]) => (
                  <div key={direction} className="rounded-[1rem] border border-[rgba(120,53,15,0.1)] bg-white/85 p-4">
                    <p className="text-sm font-semibold">{direction}</p>
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
            </div>

            <div className="card-muted rounded-[1.25rem] p-4 lg:col-span-3">
              <h3 className="text-lg font-semibold">Method Notes</h3>
              <ul className="mt-3 space-y-2 text-sm text-[var(--ink-soft)] leading-7">
                {(methodology.notes || []).map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--ink-soft)] mt-4">
            Methodology data is not available.
          </p>
        )}
      </section>

      {items.length === 0 ? (
        <section className="card-surface rounded-[1.6rem] p-8 text-center">
          <h2 className="text-xl font-semibold">No score data is available yet.</h2>
          <p className="text-[var(--ink-soft)] mt-3">
            President-level Black Impact Score results will appear here once Promise Tracker score data is available.
          </p>
        </section>
      ) : (
        <div className="space-y-8">
          {items.map((president) => (
            <section key={president.president_slug} className="card-surface rounded-[1.6rem] p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">President Score Preview</p>
                  <h2 className="text-3xl font-semibold mt-2">{president.president}</h2>
                  <p className="text-sm text-[var(--ink-soft)] mt-2 leading-7 max-w-3xl">
                    {president.score_explanation}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {president.president_party ? <MetaPill>{president.president_party}</MetaPill> : null}
                  <MetaPill>{president.promise_count} promises</MetaPill>
                  <Link
                    href={`/promises/president/${president.president_slug}`}
                    className="rounded-full border border-[rgba(120,53,15,0.12)] bg-white/80 px-4 py-2 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--accent)]"
                  >
                    View Promise Records
                  </Link>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3 mt-6">
                <MetricCard label="Raw Score" value={formatRawScore(president.raw_score)} />
                <MetricCard label="Normalized Score" value={formatNormalizedScore(president.normalized_score)} />
                <MetricCard label="Promise Count" value={president.promise_count} />
              </div>

              <div className="grid gap-4 lg:grid-cols-3 mt-6">
                <div className="card-muted rounded-[1.25rem] p-4">
                  <h3 className="text-lg font-semibold">Counts by Status</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(president.counts_by_status || {}).map(([label, count]) => (
                      <CountPill key={label} label={label} count={count} />
                    ))}
                  </div>
                </div>

                <div className="card-muted rounded-[1.25rem] p-4">
                  <h3 className="text-lg font-semibold">Counts by Relevance</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(president.counts_by_relevance || {}).map(([label, count]) => (
                      <CountPill key={label} label={label} count={count} />
                    ))}
                  </div>
                </div>

                <div className="card-muted rounded-[1.25rem] p-4">
                  <h3 className="text-lg font-semibold">Counts by Impact Direction</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(president.counts_by_impact_direction || {}).map(([label, count]) => (
                      <CountPill key={label} label={label} count={count} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="card-muted rounded-[1.25rem] p-4 mt-6">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h3 className="text-lg font-semibold">Topic Breakdown</h3>
                  <MetaPill>Sorted by absolute score contribution</MetaPill>
                </div>
                {president.score_by_topic?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {president.score_by_topic.map((item) => (
                      <MetaPill key={item.topic}>
                        {item.topic}: {formatRawScore(item.raw_score)}
                      </MetaPill>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--ink-soft)] mt-3">No topic score breakdown is available.</p>
                )}
              </div>

              <div className="grid gap-4 xl:grid-cols-3 mt-6">
                <PromiseScoreList
                  title="Top Positive Promises"
                  items={president.top_positive_promises || []}
                  tone="positive"
                />
                <PromiseScoreList
                  title="Top Negative Promises"
                  items={president.top_negative_promises || []}
                  tone="negative"
                />
                <PromiseScoreList
                  title="Top Blocked or Unrealized Promises"
                  items={president.top_blocked_promises || []}
                  tone="blocked"
                />
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
