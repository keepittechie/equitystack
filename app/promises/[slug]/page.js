import Link from "next/link";
import { notFound } from "next/navigation";
import {
  PromiseImpactDirectionBadge,
  PromiseRelevanceBadge,
  PromiseStatusBadge,
  ImpactBadge,
} from "@/app/components/policy-badges";
import { fetchInternalJson } from "@/lib/api";
import { PUBLIC_REVALIDATE_SECONDS, withRevalidate } from "@/lib/cache";
import { buildPageMetadata } from "@/lib/metadata";
import { buildPromiseJsonLd, serializeJsonLd } from "@/lib/structured-data";

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
    title: promise.title,
    description:
      promise.summary ||
      "Review this presidential promise alongside the actions, outcomes, and documented equity impacts tied to it.",
    path: `/promises/${slug}`,
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
  return (
    <span className="inline-flex items-center rounded-full border border-[rgba(120,53,15,0.12)] bg-white/80 px-3 py-1 text-xs text-[var(--ink-soft)]">
      {children}
    </span>
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

function actionBadgeClasses(type) {
  switch (type) {
    case "Executive Order":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "Bill":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Agency Action":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "Court-Related Action":
      return "bg-violet-50 text-violet-700 border-violet-200";
    case "Public Reversal":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-stone-100 text-stone-700 border-stone-300";
  }
}

export default async function PromiseDetailPage({ params }) {
  const { slug } = await params;
  const promise = await getPromise(slug);

  if (!promise) {
    notFound();
  }

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
          Back to {promise.president}
        </Link>
        <Link
          href="/promises/all"
          className="inline-flex items-center rounded-full border border-[rgba(120,53,15,0.12)] bg-white/80 px-4 py-2 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--accent)]"
        >
          Browse All Promise Records
        </Link>
      </div>

      <section className="hero-panel p-8 md:p-10 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="max-w-4xl">
            <p className="eyebrow mb-4">{promise.president}</p>
            <h1 className="text-3xl md:text-4xl font-bold">{promise.title}</h1>
            <p className="text-base md:text-lg text-[var(--ink-soft)] mt-4 leading-8">
              {promise.summary || "This Promise Tracker record compares a public commitment with the actions and outcomes that followed."}
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <PromiseStatusBadge status={promise.status} />
              <PromiseRelevanceBadge relevance={promise.relevance} />
              <PromiseImpactDirectionBadge impact={promise.impact_direction_for_curation} />
              <MetaPill>{promise.promise_type}</MetaPill>
              <MetaPill>{promise.campaign_or_official}</MetaPill>
              {promise.topic ? <MetaPill>{promise.topic}</MetaPill> : null}
              {promise.is_demo ? <MetaPill>Demo seed data</MetaPill> : null}
            </div>
          </div>
        </div>
      </section>

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
                        className={`border rounded-full px-3 py-1 text-xs font-medium ${actionBadgeClasses(
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

                    {action.sources?.length ? (
                      <div className="mt-4 space-y-2">
                        <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
                          Sources
                        </p>
                        {action.sources.map((source) => (
                          <div key={source.id} className="border rounded-xl p-3 bg-[rgba(255,252,247,0.8)]">
                            <p className="font-medium text-sm">{source.source_title}</p>
                            <p className="text-xs text-[var(--ink-soft)] mt-1">
                              {source.publisher || "Unknown publisher"} • {source.source_type}
                            </p>
                            <a
                              href={source.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs accent-link mt-2 inline-block"
                            >
                              Open source
                            </a>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-[var(--ink-soft)]">No actions are linked to this record yet.</p>
              )}
            </div>
          </section>

          <section className="card-surface rounded-[1.6rem] p-5">
            <h2 className="text-xl font-semibold mb-4">Outcomes</h2>
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

                    {outcome.sources?.length ? (
                      <div className="mt-4 space-y-2">
                        <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
                          Sources
                        </p>
                        {outcome.sources.map((source) => (
                          <div key={source.id} className="border rounded-xl p-3 bg-[rgba(255,252,247,0.8)]">
                            <p className="font-medium text-sm">{source.source_title}</p>
                            <p className="text-xs text-[var(--ink-soft)] mt-1">
                              {source.publisher || "Unknown publisher"} • {source.source_type}
                            </p>
                            <a
                              href={source.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs accent-link mt-2 inline-block"
                            >
                              Open source
                            </a>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-[var(--ink-soft)]">No outcomes are linked to this record yet.</p>
              )}
            </div>
          </section>

          <section className="card-surface rounded-[1.6rem] p-5">
            <h2 className="text-xl font-semibold mb-3">Promise Sources</h2>
            {promise.promise_sources?.length ? (
              <div className="space-y-3">
                {promise.promise_sources.map((source) => (
                  <div key={source.id} className="card-muted rounded-[1.25rem] p-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-semibold">{source.source_title}</p>
                        <p className="text-sm text-[var(--ink-soft)] mt-1">
                          {source.publisher || "Unknown publisher"} • {source.source_type}
                          {source.published_date ? ` • ${formatDate(source.published_date)}` : ""}
                        </p>
                      </div>
                    </div>
                    {source.notes ? (
                      <p className="mt-3 text-sm text-[var(--ink-soft)]">{source.notes}</p>
                    ) : null}
                    <a
                      href={source.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm accent-link mt-3 inline-block"
                    >
                      Open source
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[var(--ink-soft)]">No promise-level sources are linked to this record yet.</p>
            )}
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
            <h2 className="text-lg font-semibold mb-3">Promise Snapshot</h2>
            <div className="grid gap-4">
              <MiniStat label="Actions" value={promise.actions?.length || 0} />
              <MiniStat label="Outcomes" value={promise.outcomes?.length || 0} />
              <MiniStat
                label="Distinct Sources"
                value={promise.source_summary?.total_sources || 0}
                subtitle="Deduplicated across promise, action, and outcome links."
              />
            </div>
            <div className="mt-4 text-xs text-[var(--ink-soft)] space-y-1">
              <p>Promise links: {promise.source_summary?.promise_sources || 0}</p>
              <p>Action links: {promise.source_summary?.action_sources || 0}</p>
              <p>Outcome links: {promise.source_summary?.outcome_sources || 0}</p>
            </div>
          </section>

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
    </main>
  );
}
