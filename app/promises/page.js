import Link from "next/link";
import { fetchInternalJson } from "@/lib/api";
import { PUBLIC_REVALIDATE_SECONDS, withRevalidate } from "@/lib/cache";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "Promise Tracker",
  description:
    "Review Promise Tracker records by president, then drill into the promises, actions, and outcomes tracked for each administration.",
  path: "/promises",
});

async function getPromisePresidents() {
  return fetchInternalJson("/api/promises/presidents", {
    ...withRevalidate(PUBLIC_REVALIDATE_SECONDS),
    errorMessage: "Failed to fetch promise presidents",
  });
}

function MetaPill({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[rgba(120,53,15,0.12)] bg-white/80 px-3 py-1 text-xs text-[var(--ink-soft)]">
      {children}
    </span>
  );
}

function formatTermDate(dateString) {
  if (!dateString) return "Unknown";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function TermRange({ start, end }) {
  return (
    <span>
      {formatTermDate(start)} to {end ? formatTermDate(end) : "Present"}
    </span>
  );
}

function StatusStat({ label, count }) {
  return (
    <div className="card-muted rounded-[1.1rem] px-4 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">{label}</p>
      <p className="text-lg font-semibold mt-2">{count}</p>
    </div>
  );
}

export default async function PromisesPage() {
  const data = await getPromisePresidents();
  const presidents = data.items || [];

  return (
    <main className="max-w-7xl mx-auto p-6">
      <section className="hero-panel p-8 md:p-10 mb-6">
        <div className="section-intro">
          <p className="eyebrow mb-4">Promise Tracker</p>
          <h1 className="text-4xl md:text-5xl font-bold">Promises by President</h1>
          <p className="text-base md:text-lg text-[var(--ink-soft)] mt-4 leading-8 max-w-3xl">
            Review Promise Tracker records by presidency, then move into the promises, actions,
            outcomes, and source-backed documentation associated with each administration.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <MetaPill>{presidents.length} presidents with tracked promises</MetaPill>
            <MetaPill>Chronological overview by term start</MetaPill>
            <MetaPill>Status counts across delivered, in-progress, partial, failed, and blocked records</MetaPill>
          </div>
        </div>
      </section>

      <section className="mb-6 flex flex-wrap gap-3">
        <Link
          href="/promises/all"
          className="rounded-full border border-[rgba(120,53,15,0.18)] bg-white/80 px-5 py-2 text-sm font-medium"
        >
          Browse All Promise Records
        </Link>
      </section>

      {presidents.length === 0 ? (
        <section className="card-surface rounded-[1.6rem] p-8 text-center">
          <h2 className="text-xl font-semibold">No presidents are tracked yet.</h2>
          <p className="text-[var(--ink-soft)] mt-3">
            President-level Promise Tracker records will appear here once data is available.
          </p>
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {presidents.map((president) => (
            <Link
              key={president.id}
              href={`/promises/president/${president.slug}`}
              className="panel-link block rounded-[1.45rem] p-5"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
                    {president.president_party || "Unknown party"}
                  </p>
                  <h2 className="text-2xl font-semibold mt-2">{president.president}</h2>
                </div>
                <MetaPill>{president.total_tracked_promises} tracked</MetaPill>
              </div>

              <p className="text-sm text-[var(--ink-soft)] mt-3">
                <TermRange start={president.term_start} end={president.term_end} />
              </p>

              <div className="grid gap-3 mt-5 sm:grid-cols-2">
                <StatusStat label="Delivered" count={president.delivered_count} />
                <StatusStat label="In Progress" count={president.in_progress_count} />
                <StatusStat label="Partial" count={president.partial_count} />
                <StatusStat label="Failed" count={president.failed_count} />
                <StatusStat label="Blocked" count={president.blocked_count} />
              </div>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
