import Link from "next/link";
import {
  PromiseImpactDirectionBadge,
  PromiseStatusBadge,
} from "@/app/components/policy-badges";
import { buildPageMetadata } from "@/lib/metadata";
import { fetchCivilRightsTimeline } from "@/lib/services/promiseService";

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "Civil Rights Timeline",
  description:
    "A curated Promise Tracker timeline tracing major federal civil-rights commitments, actions, and outcomes affecting Black communities across U.S. history.",
  path: "/reports/civil-rights-timeline",
});

const TIMELINE_LEGEND_STATUSES = [
  "Delivered",
  "Partial",
  "Blocked",
  "Failed",
  "In Progress",
];

const TIMELINE_LEGEND_IMPACTS = ["Positive", "Mixed", "Negative", "Blocked/Unrealized"];

const ERA_HELPER_COPY = {
  reconstruction:
    "This section shows early federal attempts to protect Black citizenship, voting, and equal treatment after emancipation.",
  "reconstruction-retreat":
    "This section shows how federal protection narrowed, weakened, or was abandoned after early Reconstruction gains, helping explain the path from postwar promise to long-term retrenchment.",
  "pre-civil-rights-bridge":
    "This section highlights the smaller but important federal steps that reopened civil-rights enforcement before the major breakthroughs of the 1960s.",
  "civil-rights-era":
    "This section tracks the major period of renewed federal enforcement, legislation, and executive action against segregation and exclusion.",
  "post-civil-rights-continuity":
    "This section shows how federal civil-rights commitments continued after the peak legislative era through housing, credit, and institutional enforcement.",
  "modern-continuity":
    "This section extends the timeline into modern debates over voting rights, policing, courts, and federal accountability.",
};

function MetaPill({ children }) {
  return <span className="public-pill">{children}</span>;
}

function formatTimelineDate(value) {
  if (!value) return "Date not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsed);
}

function formatYear(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getUTCFullYear();
}

function EraChip({ era }) {
  return (
    <a
      href={`#${era.id}`}
      className="inline-flex items-center rounded-full border border-[rgba(120,53,15,0.14)] bg-white/85 px-4 py-2 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--accent)]"
    >
      {era.label}
    </a>
  );
}

function TimelineEntry({ item }) {
  const year = formatYear(item.promise_date);

  return (
    <article
      className={`relative rounded-[1.35rem] border bg-white/90 p-5 md:p-6 ${
        item.impact_direction === "Mixed"
          ? "border-[rgba(180,83,9,0.14)] bg-[linear-gradient(180deg,rgba(255,251,235,0.9),rgba(255,255,255,0.98))]"
          : "border-[rgba(120,53,15,0.1)]"
      }`}
    >
      <div className="absolute left-0 top-6 hidden h-[calc(100%-3rem)] w-px bg-[rgba(120,53,15,0.12)] md:block" />
      <div className="grid gap-4 md:grid-cols-[128px,minmax(0,1fr)] md:gap-6">
        <div className="md:pl-6">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
            {year || "Timeline"}
          </p>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">{formatTimelineDate(item.promise_date)}</p>
          <p className="mt-3 text-sm font-medium">{item.president}</p>
          {item.president_party ? (
            <p className="text-xs text-[var(--ink-soft)]">{item.president_party}</p>
          ) : null}
        </div>

        <div>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
                {item.topic || "Civil Rights Timeline"}
              </p>
              <h3 className="text-xl font-semibold mt-2">{item.title}</h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <PromiseStatusBadge status={item.status} />
              <PromiseImpactDirectionBadge impact={item.impact_direction} />
            </div>
          </div>

          <p className="text-sm text-[var(--ink-soft)] mt-4 leading-7">
            {item.summary || "No summary added yet."}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {item.outcome_type ? <MetaPill>{item.outcome_type}</MetaPill> : null}
            {item.topic ? <MetaPill>{item.topic}</MetaPill> : null}
          </div>

          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <Link href={`/promises/${item.slug}`} className="accent-link">
              Open promise record
            </Link>
            {item.president_slug ? (
              <Link href={`/promises/president/${item.president_slug}`} className="accent-link">
                President view
              </Link>
            ) : null}
            {item.related_policy_id && item.related_policy_title ? (
              <Link href={`/policies/${item.related_policy_id}`} className="accent-link">
                Related policy: {item.related_policy_title}
              </Link>
            ) : null}
            {item.related_explainer_slug && item.related_explainer_title ? (
              <Link href={`/explainers/${item.related_explainer_slug}`} className="accent-link">
                Related explainer: {item.related_explainer_title}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

export default async function CivilRightsTimelinePage() {
  const timeline = await fetchCivilRightsTimeline();
  const eras = timeline.eras || [];
  const totalEntries = timeline.items?.length || 0;

  return (
    <main className="report-shell w-full pt-4 pb-6 space-y-6">
      <div className="flex flex-wrap gap-3">
        <Link
          href="/reports"
          className="inline-flex items-center rounded-full border border-[rgba(120,53,15,0.12)] bg-white/80 px-4 py-2 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--accent)]"
        >
          Back to Reports
        </Link>
        <Link
          href="/promises"
          className="inline-flex items-center rounded-full border border-[rgba(120,53,15,0.12)] bg-white/80 px-4 py-2 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--accent)]"
        >
          Explore Promise Tracker data
        </Link>
      </div>

      <section className="hero-panel p-6 md:p-8">
        <p className="eyebrow mb-4">Promise Tracker Report</p>
        <h1 className="text-4xl md:text-5xl font-bold">Civil Rights Timeline</h1>
        <p className="text-base md:text-lg text-[var(--ink-soft)] mt-4 max-w-3xl leading-8">
          This curated timeline traces how federal civil-rights policy moved through protection,
          retreat, rebuilding, and modern continuity for Black communities across U.S. history.
          It is designed as a guided historical view built from Promise Tracker records, not a
          replacement for the full tracker.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <MetaPill>{totalEntries} timeline records</MetaPill>
          <MetaPill>{eras.length} eras</MetaPill>
          <MetaPill>Chronological Promise Tracker view</MetaPill>
        </div>
      </section>

      <section className="card-surface rounded-[1.6rem] p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="max-w-3xl">
            <h2 className="text-lg font-semibold mb-2">How to Read This Timeline</h2>
            <p className="text-sm text-[var(--ink-soft)] leading-7">
              Each entry shows what federal commitment was made, what the government did next, and how the
              documented outcome is classified in the Promise Tracker. Use it to follow continuity across
              Reconstruction, the Civil Rights Era, and modern accountability records.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {eras.map((era) => (
              <EraChip key={era.id} era={era} />
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
        <div className="card-muted rounded-[1.4rem] p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
            Status Legend
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {TIMELINE_LEGEND_STATUSES.map((status) => (
              <PromiseStatusBadge key={status} status={status} />
            ))}
          </div>
        </div>
        <div className="card-muted rounded-[1.4rem] p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
            Impact Legend
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {TIMELINE_LEGEND_IMPACTS.map((impact) => (
              <PromiseImpactDirectionBadge key={impact} impact={impact} />
            ))}
          </div>
        </div>
      </section>

      <div className="space-y-6">
        {eras.map((era) => (
          <section key={era.id} id={era.id} className="space-y-4 scroll-mt-24">
            <div className="card-surface rounded-[1.35rem] p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="max-w-3xl">
                  <p className="eyebrow mb-3">{era.label}</p>
                  <h2 className="text-2xl font-semibold">{era.label}</h2>
                  <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">{era.description}</p>
                  {ERA_HELPER_COPY[era.id] ? (
                    <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">
                      {ERA_HELPER_COPY[era.id]}
                    </p>
                  ) : null}
                </div>
                <MetaPill>{era.items.length} records</MetaPill>
              </div>
            </div>

            <div className="space-y-4">
              {era.items.map((item) => (
                <TimelineEntry key={item.slug} item={item} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
