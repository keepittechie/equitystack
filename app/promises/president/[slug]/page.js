import Link from "next/link";
import { notFound } from "next/navigation";
import { PromiseStatusBadge } from "@/app/components/policy-badges";
import { fetchInternalJson } from "@/lib/api";
import { PUBLIC_REVALIDATE_SECONDS, withRevalidate } from "@/lib/cache";
import { buildPageMetadata } from "@/lib/metadata";

async function getPromisePresident(slug) {
  return fetchInternalJson(`/api/promises/presidents/${slug}`, {
    ...withRevalidate(PUBLIC_REVALIDATE_SECONDS),
    allow404: true,
    errorMessage: "Failed to fetch promise president",
  });
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const president = await getPromisePresident(slug);

  if (!president) {
    return buildPageMetadata({
      title: "President Not Found",
      description: "The requested Promise Tracker presidency record could not be found.",
      path: `/promises/president/${slug}`,
    });
  }

  return buildPageMetadata({
    title: `${president.president} Promise Tracker`,
    description: `Review Promise Tracker records for ${president.president}, grouped by status.`,
    path: `/promises/president/${slug}`,
  });
}

function MetaPill({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[rgba(120,53,15,0.12)] bg-white/80 px-3 py-1 text-xs text-[var(--ink-soft)]">
      {children}
    </span>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="card-muted rounded-[1.15rem] px-4 py-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">{label}</p>
      <p className="text-xl font-semibold mt-2">{value}</p>
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
  return `${formatDate(start) || "Unknown"} to ${end ? formatDate(end) : "Present"}`;
}

export default async function PromisePresidentPage({ params }) {
  const { slug } = await params;
  const president = await getPromisePresident(slug);

  if (!president) {
    notFound();
  }

  return (
    <main className="max-w-7xl mx-auto p-6">
      <div className="mb-4 flex flex-wrap gap-3">
        <Link
          href="/promises"
          className="inline-flex items-center rounded-full border border-[rgba(120,53,15,0.12)] bg-white/80 px-4 py-2 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--accent)]"
        >
          Back to Presidents
        </Link>
        <Link
          href="/promises/all"
          className="inline-flex items-center rounded-full border border-[rgba(120,53,15,0.12)] bg-white/80 px-4 py-2 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--accent)]"
        >
          Browse All Promise Records
        </Link>
      </div>

      <section className="hero-panel p-8 md:p-10 mb-6">
        <div className="max-w-4xl">
          <p className="eyebrow mb-4">Promise Tracker</p>
          <h1 className="text-3xl md:text-4xl font-bold">{president.president}</h1>
          <p className="text-base md:text-lg text-[var(--ink-soft)] mt-4 leading-8">
            Promise Tracker groups this presidency’s records by status so you can review which
            commitments were delivered, remain in progress, were partially realized, failed, or
            were blocked.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {president.president_party ? <MetaPill>{president.president_party}</MetaPill> : null}
            <MetaPill>{formatTermRange(president.term_start, president.term_end)}</MetaPill>
            <MetaPill>{president.total_tracked_promises} tracked promises</MetaPill>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-5 mb-8">
        <MiniStat label="Delivered" value={president.delivered_count} />
        <MiniStat label="In Progress" value={president.in_progress_count} />
        <MiniStat label="Partial" value={president.partial_count} />
        <MiniStat label="Failed" value={president.failed_count} />
        <MiniStat label="Blocked" value={president.blocked_count} />
      </section>

      <div className="space-y-8">
        {president.status_sections?.map((section) => (
          <section key={section.status} className="card-surface rounded-[1.6rem] p-5">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
              <div>
                <h2 className="text-2xl font-semibold">{section.status}</h2>
                <p className="text-sm text-[var(--ink-soft)] mt-1">
                  {section.items.length} record{section.items.length === 1 ? "" : "s"} in this status
                </p>
              </div>
              <PromiseStatusBadge status={section.status} />
            </div>

            {section.items.length === 0 ? (
              <p className="text-[var(--ink-soft)]">No Promise Tracker records are currently grouped under this status.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {section.items.map((promise) => (
                  <Link
                    key={promise.id}
                    href={`/promises/${promise.slug}`}
                    className="panel-link block rounded-[1.35rem] p-5"
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
                          {promise.topic || "No topic"}
                        </p>
                        <h3 className="text-xl font-semibold mt-2">{promise.title}</h3>
                      </div>
                    </div>

                    <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">
                      {promise.summary || "No summary added yet."}
                    </p>

                    <div className="flex flex-wrap gap-2 mt-4">
                      <MetaPill>
                        {promise.action_count} action{promise.action_count === 1 ? "" : "s"}
                      </MetaPill>
                      <MetaPill>
                        {promise.source_count} distinct source{promise.source_count === 1 ? "" : "s"}
                      </MetaPill>
                      {promise.related_policy_count ? (
                        <MetaPill>
                          {promise.related_policy_count} related polic{promise.related_policy_count === 1 ? "y" : "ies"}
                        </MetaPill>
                      ) : null}
                      {promise.related_explainer_count ? (
                        <MetaPill>
                          {promise.related_explainer_count} related explainer{promise.related_explainer_count === 1 ? "" : "s"}
                        </MetaPill>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-4 mt-3 text-xs text-[var(--ink-soft)]">
                      {promise.promise_date ? <span>Promise date: {formatDate(promise.promise_date)}</span> : null}
                      {promise.latest_action_date ? (
                        <span>Latest action: {formatDate(promise.latest_action_date)}</span>
                      ) : (
                        <span>No action date recorded</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
