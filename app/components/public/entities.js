import Image from "next/image";
import Link from "next/link";
import { resolvePresidentImageSrc } from "@/lib/president-image-paths";
import {
  formatSystemicImpactLabel,
  isNonStandardSystemicImpact,
  systemicMultiplierFor,
} from "@/lib/systemicImpact";
import {
  MetricCard,
  Panel,
  StatusPill,
  getImpactDirectionTone,
  getPromiseStatusTone,
} from "@/app/components/dashboard/primitives";
import { ScoreBadge } from "./core";
import EvidenceBadge from "./EvidenceBadge";
import { buildEvidenceSignal } from "@/lib/evidenceCoverage";

const FILTER_FIELD_CLASS =
  "w-full rounded-md border border-[var(--line)] bg-[rgba(18,31,49,0.5)] px-3 py-2 text-sm text-white outline-none transition-[background-color,border-color,box-shadow] placeholder:text-[var(--ink-muted)] hover:border-[var(--line-strong)] focus:border-[rgba(132,247,198,0.38)] focus:bg-[rgba(18,31,49,0.76)] focus-visible:ring-2 focus-visible:ring-[rgba(132,247,198,0.28)]";

const PRIMARY_ACTION_CLASS =
  "inline-flex min-h-9 items-center justify-center rounded-md border border-[rgba(132,247,198,0.72)] bg-[var(--accent)] px-3 text-[12px] font-semibold text-[#051019] transition-[background-color,border-color,box-shadow] hover:border-[var(--accent)] hover:bg-[rgba(132,247,198,0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(132,247,198,0.28)]";

const SECONDARY_ACTION_CLASS =
  "inline-flex min-h-9 items-center justify-center rounded-md border border-[var(--line-strong)] bg-[rgba(18,31,49,0.58)] px-3 text-[12px] font-semibold text-white transition-[background-color,border-color,box-shadow] hover:border-[var(--line-strong)] hover:bg-[rgba(18,31,49,0.86)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(132,247,198,0.28)]";

function formatRenderableDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }
    return value.toISOString().slice(0, 10);
  }

  return value;
}

function formatDirectionMixLabel(breakdown = {}) {
  const counts = {
    Positive: Number(breakdown.Positive || 0),
    Negative: Number(breakdown.Negative || 0),
    Mixed: Number(breakdown.Mixed || 0),
    Blocked: Number(breakdown.Blocked || 0),
  };

  return `Positive ${counts.Positive} • Negative ${counts.Negative} • Mixed ${counts.Mixed} • Blocked ${counts.Blocked}`;
}

function summarizeDirectionLeader(breakdown = {}) {
  const rows = [
    ["Positive", Number(breakdown.Positive || 0)],
    ["Negative", Number(breakdown.Negative || 0)],
    ["Mixed", Number(breakdown.Mixed || 0)],
    ["Blocked", Number(breakdown.Blocked || 0)],
  ].sort((left, right) => right[1] - left[1]);

  return rows[0]?.[1] ? `${rows[0][0]}-leaning mix` : "Direction mix unavailable";
}

function getSystemicRecordMeta(item = {}) {
  const category = item.systemic_impact_category;
  const summary =
    typeof item.systemic_impact_summary === "string" ? item.systemic_impact_summary.trim() : "";

  if (!isNonStandardSystemicImpact(category) && !summary) {
    return null;
  }

  const resolvedMultiplier = Number(item.systemic_multiplier || systemicMultiplierFor(category));

  return {
    label: formatSystemicImpactLabel(category),
    multiplier: `${resolvedMultiplier.toFixed(2)}x`,
    summary: summary || null,
  };
}

function formatSourceContextLabel(value) {
  const labels = {
    government: "Government source",
    academic: "Academic research",
    journalism: "Journalism",
    "primary-data": "Primary data",
    "secondary-analysis": "Secondary analysis",
    advocacy: "Advocacy source",
    unknown: "Source context",
  };
  return labels[String(value || "").toLowerCase()] || null;
}

function RecordTypeBadge({ label }) {
  if (!label) {
    return null;
  }

  return <StatusPill tone="default">{label}</StatusPill>;
}

function RecentUpdateWhyTooltip({ text }) {
  if (!text) {
    return null;
  }

  return (
    <details className="group relative inline-block [&[open]_.why-popover]:block">
      <summary className="inline-flex h-6 w-6 cursor-pointer list-none items-center justify-center rounded-full border border-[var(--line)] bg-[rgba(18,31,49,0.72)] text-[11px] font-semibold text-[var(--ink-soft)] transition hover:border-[var(--line-strong)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(132,247,198,0.28)]">
        <span aria-hidden="true">i</span>
        <span className="sr-only">Why this matters</span>
      </summary>
      <div className="why-popover mt-2 hidden max-w-md rounded-lg border border-[var(--line)] bg-[rgba(8,14,24,0.98)] p-3 text-xs leading-6 text-[var(--ink-soft)] shadow-xl group-hover:block">
        <p className="mb-1 font-semibold text-white">Why this matters</p>
        <p>{text}</p>
      </div>
    </details>
  );
}

function buildPolicyEvidenceSignal(item = {}) {
  return buildEvidenceSignal({
    sourceCount: item.total_sources ?? item.source_count ?? 0,
    hasPolicyScore:
      item.impact_score != null ||
      item.directness_score != null ||
      item.material_impact_score != null ||
      item.evidence_score != null,
    evidenceStrength: item.evidence_summary?.evidence_strength || null,
  });
}

function buildPromiseEvidenceSignal(item = {}) {
  return buildEvidenceSignal({
    confidenceLabel: item.confidence_label || null,
    sourceCount: item.source_count ?? 0,
  });
}

function buildPresidentEvidenceSignal(item = {}) {
  return buildEvidenceSignal({
    confidenceLabel: item.score_confidence || item.direct_score_confidence || null,
    sourceCount: item.visible_source_count ?? item.source_count ?? 0,
  });
}

export function PresidentPortrait({
  imageSrc,
  alt,
  context = "card",
  className = "",
}) {
  if (!imageSrc) {
    return null;
  }

  const sizeClass =
    context === "hero"
      ? "h-32 w-32 rounded-[1.7rem] md:h-40 md:w-40"
      : context === "ranking"
        ? "h-[4.5rem] w-[4.5rem] rounded-[1.2rem]"
        : context === "compare"
          ? "h-20 w-20 rounded-[1.35rem]"
          : "h-20 w-20 rounded-[1.35rem]";

  return (
    <div
      className={`relative shrink-0 overflow-hidden border border-white/10 bg-white/5 ${sizeClass} ${className}`}
    >
      <Image src={imageSrc} alt={alt} fill className="object-cover object-top" />
    </div>
  );
}

export function PolicySearchBar({ defaultValue = "", action = "/policies" }) {
  return (
    <form action={action} method="GET" className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-3">
      <label htmlFor="policy-search" className="sr-only">
        Search policy records
      </label>
      <input
        id="policy-search"
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Search policy titles, categories, and summaries"
        className="min-w-0 flex-1 border-0 bg-transparent text-sm text-white placeholder:text-[var(--ink-muted)] focus:outline-none"
      />
      <button type="submit" className={PRIMARY_ACTION_CLASS}>
        Search
      </button>
    </form>
  );
}

export function PolicyFilterSidebar({
  filters = {},
  options = {},
  action = "/policies",
  layout = "stacked",
}) {
  const isSplitLayout = layout === "split";
  const formClass = isSplitLayout
    ? "grid gap-4 rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4 xl:grid-cols-2"
    : "grid gap-4 rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4";

  return (
    <form action={action} method="GET" className={formClass}>
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
          Search
        </label>
        <input name="q" defaultValue={filters.q || ""} className={FILTER_FIELD_CLASS} placeholder="Title or keyword" />
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
          Category
        </label>
        <select name="category" defaultValue={filters.category || ""} className={FILTER_FIELD_CLASS}>
          <option value="">All categories</option>
          {(options.categories || []).map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
          President
        </label>
        <select name="president" defaultValue={filters.president || ""} className={FILTER_FIELD_CLASS}>
          <option value="">All presidents</option>
          {(options.presidents || []).map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
          Era
        </label>
        <select name="era" defaultValue={filters.era || ""} className={FILTER_FIELD_CLASS}>
          <option value="">All eras</option>
          {(options.eras || []).map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
          Direction
        </label>
        <select name="impact_direction" defaultValue={filters.impact_direction || ""} className={FILTER_FIELD_CLASS}>
          <option value="">All directions</option>
          {["Positive", "Negative", "Mixed", "Blocked"].map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
          Sort
        </label>
        <select name="sort" defaultValue={filters.sort || "impact_score_desc"} className={FILTER_FIELD_CLASS}>
          <option value="impact_score_desc">Highest impact</option>
          <option value="year_desc">Newest first</option>
          <option value="year_asc">Oldest first</option>
          <option value="title_asc">Title A-Z</option>
        </select>
      </div>

      <button
        type="submit"
        className={`${PRIMARY_ACTION_CLASS} ${
          isSplitLayout ? "xl:col-span-2" : ""
        }`}
      >
        Apply filters
      </button>
    </form>
  );
}

export function PolicyResultsTable({ items = [], buildHref }) {
  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--line)] bg-[rgba(18,31,49,0.32)] p-4 text-sm leading-7 text-[var(--ink-soft)]">
        No policies match your current filters. Try adjusting search or filters to explore more records.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/8 text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
            <tr>
              <th className="px-5 py-4">Policy</th>
              <th className="px-5 py-4">Year</th>
              <th className="px-5 py-4">President</th>
              <th className="px-5 py-4">Status / Direction</th>
              <th className="px-5 py-4">Impact Score</th>
              <th className="px-5 py-4">Sources</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-white/6 last:border-b-0">
                <td className="px-5 py-4">
                  <Link href={buildHref(item)} className="font-medium text-white hover:text-white">
                    {item.title}
                  </Link>
                  {item.summary ? (
                    <p className="mt-1 line-clamp-2 max-w-xl text-xs leading-6 text-[var(--ink-soft)]">{item.summary}</p>
                  ) : null}
                  <EvidenceBadge
                    signal={buildPolicyEvidenceSignal(item)}
                    className="mt-2"
                  />
                </td>
                <td className="px-5 py-4 text-[var(--ink-soft)]">{item.year_enacted || "—"}</td>
                <td className="px-5 py-4 text-[var(--ink-soft)]">{item.president || item.primary_party || "—"}</td>
                <td className="px-5 py-4 text-[var(--ink-soft)]">{item.impact_direction || "—"}</td>
                <td className="px-5 py-4 text-white">{item.impact_score ?? "—"}</td>
                <td className="px-5 py-4 text-[var(--ink-soft)]">{item.total_sources ?? item.source_count ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PolicyCardList({
  items = [],
  buildHref,
  listClassName = "grid gap-4 md:grid-cols-2",
  cardPadding = "md",
  cardClassName = "",
  spacing = "default",
}) {
  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--line)] bg-[rgba(18,31,49,0.32)] p-4 text-sm leading-7 text-[var(--ink-soft)]">
        No policies match your current filters. Try adjusting search or filters to explore more records.
      </div>
    );
  }

  return (
    <div className={listClassName}>
      {items.map((item) => {
        const evidenceSignal = buildPolicyEvidenceSignal(item);
        const isRelaxed = spacing === "relaxed";

        return (
          <Panel
            key={item.id}
            as={Link}
            href={buildHref(item)}
            padding={cardPadding}
            interactive
            className={`flex h-full flex-col ${cardClassName}`}
          >
            <div className="flex items-center justify-between gap-4">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                {item.year_enacted || "Undated"} • {item.policy_type || "Policy"}
              </p>
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)]">
                Open policy
              </span>
            </div>
            <div
              className={`${
                isRelaxed ? "mt-4 gap-5" : "mt-3 gap-4"
              } flex items-start justify-between`}
            >
              <h3 className="text-lg font-semibold text-white">{item.title}</h3>
              <ScoreBadge value={item.impact_score ?? "—"} label="Impact Score" />
            </div>
            {item.summary ? (
              <p
                className={`${
                  isRelaxed ? "mt-4" : "mt-3"
                } text-sm leading-6 text-[var(--ink-soft)]`}
              >
                {item.summary}
              </p>
            ) : null}
            <EvidenceBadge
              signal={evidenceSignal}
              className={isRelaxed ? "mt-5" : "mt-4"}
            />
            <div
              className={`${
                isRelaxed ? "gap-3 pt-5" : "gap-2 pt-4"
              } mt-auto flex flex-wrap`}
            >
              <StatusPill tone="default">
                {item.impact_direction || "Unknown direction"}
              </StatusPill>
              <StatusPill tone="default">
                {item.president || item.primary_party || "Historical record"}
              </StatusPill>
              <StatusPill tone="info">
                {item.total_sources ?? item.source_count ?? 0} sources
              </StatusPill>
            </div>
          </Panel>
        );
      })}
    </div>
  );
}

export function PolicyHero({ title, summary, score, scoreLabel, badges = [] }) {
  return (
    <section className="rounded-[2rem] border border-white/8 bg-[linear-gradient(145deg,rgba(10,18,29,0.98),rgba(7,11,18,0.96))] p-8 md:p-10">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-4xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">Policy Record</p>
          <h1 className="mt-4 text-[clamp(2.2rem,4.2vw,4.4rem)] font-semibold leading-[0.98] tracking-[-0.05em] text-white">
            {title}
          </h1>
          {summary ? (
            <p className="mt-5 max-w-3xl text-base leading-8 text-[var(--ink-soft)] md:text-lg">
              {summary}
            </p>
          ) : null}
          {badges.length ? (
            <div className="mt-5 flex flex-wrap gap-2 text-sm text-[var(--ink-soft)]">
              {badges.map((badge) => (
                <span key={badge} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                  {badge}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <ScoreBadge value={score} label={scoreLabel || "Impact Score"} size="lg" />
      </div>
    </section>
  );
}

export function EvidenceSourceList({ items = [] }) {
  return (
    <div className="grid gap-3">
      {items.map((item, index) => {
        const sourceContextLabel = formatSourceContextLabel(item.sourceType);

        return (
          <Panel
            key={`${item.url || item.source_url || item.title || item.source_title}-${index}`}
            as="a"
            href={item.url || item.source_url || "#"}
            target="_blank"
            rel="noreferrer"
            padding="md"
            interactive
          >
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone="default">{item.source_type || item.publisher || "Source"}</StatusPill>
              {sourceContextLabel ? (
                <StatusPill tone="info">{sourceContextLabel}</StatusPill>
              ) : null}
              {formatRenderableDate(item.published_date) ? (
                <StatusPill tone="info">{formatRenderableDate(item.published_date)}</StatusPill>
              ) : null}
            </div>
            <h3 className="mt-3 text-base font-medium text-white">
              {item.source_title || item.title || item.url || item.source_url}
            </h3>
            {item.notes ? (
              <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">{item.notes}</p>
            ) : null}
            {item.sourceNote ? (
              <p className="mt-2 text-[12px] leading-5 text-[var(--ink-muted)]">
                {item.sourceNote}
              </p>
            ) : null}
          </Panel>
        );
      })}
    </div>
  );
}

export function PolicyTimeline({ items = [] }) {
  return (
    <div className="grid gap-4">
      {items.map((item, index) => (
        <Panel key={`${item.year || item.date || index}`} padding="md">
          <StatusPill tone="info">
            {item.year || formatRenderableDate(item.date) || item.label || `Step ${index + 1}`}
          </StatusPill>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">{item.summary || item.event || item.description}</p>
        </Panel>
      ))}
    </div>
  );
}

export function PresidentCardGrid({ items = [], buildHref, compareHref = null }) {
  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--line)] bg-[rgba(18,31,49,0.32)] p-4 text-sm leading-7 text-[var(--ink-soft)]">
        No president records match your current filters. Try broadening the search or removing a filter.
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const imageSrc = resolvePresidentImageSrc({
          presidentSlug: item.slug || item.president_slug,
          presidentName: item.name || item.president_name || item.president,
        });
        const evidenceSignal = buildPresidentEvidenceSignal(item);

        return (
          <Panel
            key={item.slug || item.id}
            as="article"
            padding="md"
            className="flex h-full flex-col transition-[background-color,border-color,box-shadow] hover:border-[var(--line-strong)] hover:bg-[rgba(18,31,49,0.64)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 flex-1 items-start gap-4">
                <PresidentPortrait
                  imageSrc={imageSrc}
                  alt={item.name || item.president || "President portrait"}
                  context="card"
                />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                    {item.party || item.president_party || "Historical record"}
                  </p>
                  <h3 className="mt-2 line-clamp-2 text-lg font-semibold text-white">
                    {item.name || item.president}
                  </h3>
                  {item.termLabel ? (
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                      {item.termLabel}
                    </p>
                  ) : null}
                </div>
              </div>
              <ScoreBadge
                value={item.score ?? item.normalized_score_total ?? item.direct_normalized_score ?? "—"}
                label="Black Impact Score"
              />
            </div>
            <p className="mt-3 line-clamp-4 text-sm leading-6 text-[var(--ink-soft)]">{item.summary || item.narrative_summary || "View metrics, timelines, and policy drivers for this presidential record."}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <EvidenceBadge signal={evidenceSignal} />
              {item.outcome_count != null ? (
                <StatusPill tone="info">{item.outcome_count} outcomes</StatusPill>
              ) : null}
              {item.direction_breakdown ? (
                <StatusPill tone="default">{summarizeDirectionLeader(item.direction_breakdown)}</StatusPill>
              ) : null}
              {Number(item.linked_bill_count || 0) > 0 ? (
                <StatusPill tone="verified">
                  {item.linked_bill_count} linked bill{Number(item.linked_bill_count || 0) === 1 ? "" : "s"}
                </StatusPill>
              ) : null}
            </div>
            <div className="mt-auto flex flex-wrap gap-3 pt-5">
              <Link href={buildHref(item)} className={PRIMARY_ACTION_CLASS}>
                Open profile
              </Link>
              {compareHref ? (
                <Link href={compareHref} className={SECONDARY_ACTION_CLASS}>
                  Compare
                </Link>
              ) : null}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}

export function PresidentRankingBoard({ items = [], buildHref, limit = 10, title = null }) {
  const visibleItems = items.slice(0, limit);

  if (!visibleItems.length) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--line)] bg-[rgba(18,31,49,0.32)] p-4 text-sm leading-7 text-[var(--ink-soft)]">
        No presidential records are available for ranking in the current view. Try adjusting the filters to explore more records.
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)]">
      {title ? (
        <div className="border-b border-white/8 px-5 py-4">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
      ) : null}
      <div className="divide-y divide-white/8">
        {visibleItems.map((item, index) => {
          const imageSrc = resolvePresidentImageSrc({
            presidentSlug: item.slug || item.president_slug,
            presidentName: item.name || item.president_name || item.president,
          });

          return (
            <Link
              key={item.slug || item.id || index}
              href={buildHref(item)}
              className="grid gap-4 px-5 py-5 transition hover:bg-white/5 md:px-6 md:py-6 xl:grid-cols-[64px_minmax(0,1.1fr)_minmax(0,190px)_minmax(0,240px)]"
            >
              <div className="flex items-center gap-4">
                <span className="text-2xl font-semibold tracking-[-0.05em] text-white">
                  {index + 1}
                </span>
              </div>
              <div className="flex items-start gap-4">
                <PresidentPortrait
                  imageSrc={imageSrc}
                  alt={item.name || item.president || "President portrait"}
                  context="ranking"
                />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                    {item.party || item.president_party || "Historical record"}
                  </p>
                  <h3 className="mt-1 text-xl font-semibold text-white">
                    {item.name || item.president}
                  </h3>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                    {item.termLabel || "Historical record"}
                  </p>
                  {item.narrative_summary ? (
                    <p className="mt-2 line-clamp-2 text-sm leading-7 text-[var(--ink-soft)]">
                      {item.narrative_summary}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-start gap-3 xl:justify-end">
                <ScoreBadge
                  value={item.score ?? item.direct_normalized_score ?? "—"}
                  label="Black Impact Score"
                />
              </div>
              <div className="grid gap-2 text-sm text-[var(--ink-soft)]">
                <div className="rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.52)] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                    Confidence
                  </p>
                  <p className="mt-1 text-sm font-medium text-white">
                    {item.score_confidence || "Unknown"}
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.52)] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                    Impact Direction mix
                  </p>
                  <p className="mt-1 text-sm leading-7 text-[var(--ink-soft)]">
                    {formatDirectionMixLabel(item.direction_breakdown)}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function PresidentHero({
  name,
  party,
  termLabel,
  summary,
  score,
  systemicScore,
  systemicContextLabel,
  imageSrc,
}) {
  return (
    <section className="rounded-[2rem] border border-white/8 bg-[linear-gradient(140deg,rgba(8,14,24,0.98),rgba(9,19,33,0.96))] p-8 md:p-10">
      <div className="flex flex-wrap items-start justify-between gap-8">
        <div className="max-w-4xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">{party || "Administration profile"}</p>
          <h1 className="mt-4 text-[clamp(2.2rem,4.5vw,4.6rem)] font-semibold leading-[0.98] tracking-[-0.05em] text-white">
            {name}
          </h1>
          {termLabel ? <p className="mt-3 text-sm uppercase tracking-[0.18em] text-[var(--ink-muted)]">{termLabel}</p> : null}
          {summary ? <p className="mt-5 max-w-3xl text-base leading-8 text-[var(--ink-soft)] md:text-lg">{summary}</p> : null}
        </div>
        <div className="flex w-full flex-wrap items-start justify-between gap-4 sm:w-auto sm:flex-col sm:items-end">
          <PresidentPortrait imageSrc={imageSrc} alt={name} context="hero" />
          <div className="flex flex-wrap gap-3 sm:justify-end">
            <ScoreBadge value={score} label="Black Impact Score" size="lg" />
            {systemicScore != null ? (
              <ScoreBadge
                value={systemicScore}
                label="Systemic context"
                context={systemicContextLabel || undefined}
              />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export function PresidentMetricsRow({ items = [] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">{item.label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">{item.value}</p>
          {item.detail ? <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">{item.detail}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function PresidentPolicyTable({ items = [], buildHref }) {
  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--line)] bg-[rgba(18,31,49,0.32)] p-4 text-sm leading-7 text-[var(--ink-soft)]">
        No linked policy or promise records are available in this view yet. Browse the policy and promise indexes to continue the research path.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/8 text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
            <tr>
              <th className="px-5 py-4">Record</th>
              <th className="px-5 py-4">Topic</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Impact Score</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const systemicMeta = getSystemicRecordMeta(item);

              return (
                <tr key={`${item.id || item.slug}-${index}`} className="border-b border-white/6 last:border-b-0">
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <RecordTypeBadge label={item.record_type || (item.slug ? "Promise" : "Policy")} />
                      {systemicMeta ? (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
                          Systemic {systemicMeta.label} • {systemicMeta.multiplier}
                        </span>
                      ) : null}
                    </div>
                    <Link href={buildHref(item)} className="font-medium text-white hover:text-white">
                      {item.title}
                    </Link>
                    {systemicMeta?.summary ? (
                      <p className="mt-1 text-xs leading-6 text-[var(--ink-soft)]">
                        {systemicMeta.summary}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-5 py-4 text-[var(--ink-soft)]">
                    {item.topic || item.category || "—"}
                  </td>
                  <td className="px-5 py-4 text-[var(--ink-soft)]">
                    {item.status || item.impact_direction || "—"}
                  </td>
                  <td className="px-5 py-4 text-white">
                    {item.score ?? item.impact_score ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PromiseResultsTable({ items = [], buildHref }) {
  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--line)] bg-[rgba(18,31,49,0.32)] p-4 text-sm leading-7 text-[var(--ink-soft)]">
        No promises match your current filters. Try adjusting search or filters to explore more records.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/8 text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
            <tr>
              <th className="px-5 py-4">Promise</th>
              <th className="px-5 py-4">Current status</th>
              <th className="px-5 py-4">Evidence confidence</th>
              <th className="px-5 py-4">Linked outcomes</th>
              <th className="px-5 py-4">Sources</th>
              <th className="px-5 py-4">Record</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const evidenceSignal = buildPromiseEvidenceSignal(item);

              return (
              <tr key={item.slug} className="border-b border-white/6 last:border-b-0">
                <td className="px-5 py-4">
                  <Link href={buildHref(item)} className="font-medium text-white hover:text-white">
                    {item.title}
                  </Link>
                  {item.summary ? <p className="mt-1 line-clamp-2 text-xs leading-6 text-[var(--ink-soft)]">{item.summary}</p> : null}
                  <p className="mt-1 text-xs leading-6 text-[var(--ink-muted)]">
                    {item.president || "Historical record"}
                    {item.topic ? ` • ${item.topic}` : ""}
                    {item.promise_type ? ` • ${item.promise_type}` : ""}
                  </p>
                </td>
                <td className="px-5 py-4 text-[var(--ink-soft)]">
                  <StatusPill tone={getPromiseStatusTone(item.status)}>
                    {item.status || "Unknown"}
                  </StatusPill>
                </td>
                <td className="px-5 py-4 text-[var(--ink-soft)]">
                  <EvidenceBadge signal={evidenceSignal} />
                </td>
                <td className="px-5 py-4 text-[var(--ink-soft)]">{item.outcome_count ?? item.action_count ?? 0}</td>
                <td className="px-5 py-4 text-[var(--ink-soft)]">{item.source_count ?? 0}</td>
                <td className="px-5 py-4">
                  <Link href={buildHref(item)} className="text-[var(--ink-soft)] hover:text-white">
                    Open record
                  </Link>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PromiseHero({ title, statement, status, president, termLabel, badges = [] }) {
  return (
    <Panel prominence="primary" className="overflow-hidden">
      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 border-b border-[var(--line)] p-4 xl:border-b-0 xl:border-r">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            Promise record
          </p>
          <h1 className="page-title mt-3">{title}</h1>
          {statement ? (
            <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--ink-soft)] md:text-base md:leading-7">
              {statement}
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-2">
            {president ? <StatusPill tone="default">{president}</StatusPill> : null}
            {termLabel ? <StatusPill tone="default">{termLabel}</StatusPill> : null}
            {badges.map((badge) => (
              <StatusPill key={badge} tone="default">
                {badge}
              </StatusPill>
            ))}
          </div>
        </div>
        <aside className="grid content-start gap-3 p-4">
          {status ? (
            <MetricCard
              label="Current status"
              value={status}
              description="Promise-tracker classification in the current public record."
              tone={getPromiseStatusTone(status)}
              prominence="primary"
              showDot
            />
          ) : null}
          <Panel padding="md">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
              Record context
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {president ? <StatusPill tone="default">{president}</StatusPill> : null}
              {termLabel ? <StatusPill tone="default">{termLabel}</StatusPill> : null}
            </div>
          </Panel>
        </aside>
      </div>
    </Panel>
  );
}

export function PromiseTimeline({ items = [] }) {
  return (
    <div className="grid gap-4">
      {items.map((item) => (
        <Panel key={`${item.id || item.action_date || item.date || item.title || item.label}`} padding="md">
          <div className="flex flex-wrap gap-2">
            {formatRenderableDate(item.action_date) || formatRenderableDate(item.date) ? (
              <StatusPill tone="info">
                {formatRenderableDate(item.action_date) || formatRenderableDate(item.date)}
              </StatusPill>
            ) : null}
            {item.status ? (
              <StatusPill tone={getPromiseStatusTone(item.status)}>{item.status}</StatusPill>
            ) : null}
            {item.domain ? <StatusPill tone="default">{item.domain}</StatusPill> : null}
            {!item.status && !item.domain && item.label ? (
              <StatusPill tone="info">{item.label}</StatusPill>
            ) : null}
          </div>
          {item.href ? (
            <Link href={item.href} className="mt-3 block text-base font-medium text-white hover:text-white">
              {item.title || item.event}
            </Link>
          ) : (
            <h3 className="mt-3 text-base font-medium text-white">{item.title || item.event}</h3>
          )}
          {item.description ? <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">{item.description}</p> : null}
        </Panel>
      ))}
    </div>
  );
}

export function ReportCardGrid({
  items = [],
  emptyTitle = "No reports match the current browse state.",
  emptyDescription = "Try broadening the search or clearing a category filter.",
}) {
  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--line)] bg-[rgba(18,31,49,0.32)] p-4 text-sm leading-7 text-[var(--ink-soft)]">
        <p className="font-medium text-white">{emptyTitle}</p>
        <p className="mt-1 text-[var(--ink-soft)]">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <Panel
          key={item.slug}
          as={Link}
          href={item.href || `/reports/${item.slug}`}
          padding="md"
          interactive
          className="flex h-full flex-col"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone="default">{item.category || "Report"}</StatusPill>
              {item.theme ? <StatusPill tone="info">{item.theme}</StatusPill> : null}
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)]">
              Open report
            </span>
          </div>
          <h3 className="mt-3 text-lg font-semibold text-white">{item.title}</h3>
          <p className="mt-3 line-clamp-4 text-sm leading-6 text-[var(--ink-soft)]">{item.summary}</p>
          <span className="mt-auto pt-4 text-[12px] font-semibold text-[var(--ink-soft)]">Open report analysis</span>
        </Panel>
      ))}
    </div>
  );
}

export function ExplainerIndexGrid({ items = [] }) {
  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--line)] bg-[rgba(18,31,49,0.32)] p-4 text-sm leading-7 text-[var(--ink-soft)]">
        No explainers match the current browse state. Try broadening the search to explore more background material.
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <Panel
          key={item.slug}
          as={Link}
          href={`/explainers/${item.slug}`}
          padding="md"
          interactive
          className="flex h-full flex-col"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone="default">{item.category || "Explainer"}</StatusPill>
              {item.argument_signal_label ? (
                <StatusPill tone={item.argument_signal_tone || "info"}>
                  {item.argument_signal_label}
                </StatusPill>
              ) : item.argument_ready ? (
                <StatusPill tone="info">Argument-ready</StatusPill>
              ) : null}
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)]">
              Open explainer
            </span>
          </div>
          <h3 className="mt-3 text-lg font-semibold text-white">{item.title}</h3>
          <p className="mt-3 line-clamp-4 text-sm leading-6 text-[var(--ink-soft)]">{item.summary}</p>
          <span className="mt-auto pt-4 text-[12px] font-semibold text-[var(--ink-soft)]">
            Open historical context and linked records
          </span>
        </Panel>
      ))}
    </div>
  );
}

export function TimelineEventCard({
  title,
  summary,
  year,
  href = null,
  badges = [],
  highlight = null,
}) {
  const content = (
    <Panel padding="md">
      <div className="flex flex-wrap gap-2">
        <StatusPill tone="info">{year || "Timeline"}</StatusPill>
        {highlight?.label ? (
          <StatusPill tone={highlight.tone || "default"}>{highlight.label}</StatusPill>
        ) : null}
      </div>
      <h3 className="mt-3 text-lg font-semibold text-white">{title}</h3>
      {summary ? <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">{summary}</p> : null}
      {highlight?.detail ? (
        <p className="mt-3 text-xs leading-6 text-[var(--ink-muted)]">
          {highlight.detail}
        </p>
      ) : null}
      {badges.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {badges.map((badge) => (
            <StatusPill key={badge} tone="default">{badge}</StatusPill>
          ))}
        </div>
      ) : null}
    </Panel>
  );

  return href ? <Link href={href} className="block">{content}</Link> : content;
}

function SourceSupportPreview({ items = [], breakdown = null, supportCount = null }) {
  if (!items.length && !breakdown) {
    return null;
  }
  const summaryItems = breakdown
    ? [
        breakdown.policies ? `${breakdown.policies} policy record${breakdown.policies === 1 ? "" : "s"}` : null,
        breakdown.promises ? `${breakdown.promises} promise record${breakdown.promises === 1 ? "" : "s"}` : null,
        breakdown.actions ? `${breakdown.actions} promise action${breakdown.actions === 1 ? "" : "s"}` : null,
        breakdown.outcomes ? `${breakdown.outcomes} policy outcome${breakdown.outcomes === 1 ? "" : "s"}` : null,
        breakdown.impacts ? `${breakdown.impacts} Black-impact row${breakdown.impacts === 1 ? "" : "s"}` : null,
      ].filter(Boolean)
    : [];
  const summary = summaryItems.slice(0, 5).join(" • ");
  const resolvedSupportCount =
    supportCount != null
      ? supportCount
      : items.length;
  const groupedItems = items.reduce((accumulator, item) => {
    const key = String(item.kind || "").trim() || "Linked support";
    accumulator[key] = accumulator[key] || [];
    accumulator[key].push(item);
    return accumulator;
  }, {});
  const contributionDescription = breakdown
    ? [
        breakdown.outcomes || breakdown.impacts
          ? "This source contributes directly to outcome or Black-impact interpretation in the current public record."
          : null,
        !breakdown.outcomes && !breakdown.impacts && (breakdown.policies || breakdown.promises)
          ? "This source currently anchors record-level context more than row-level analysis."
          : null,
        breakdown.actions
          ? "It also helps verify implementation steps or downstream action history."
          : null,
      ]
        .filter(Boolean)
        .join(" ")
    : null;

  return (
    <details className="mt-3 rounded-lg border border-white/8 bg-white/5 p-3">
      <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)] marker:hidden">
        Supports {resolvedSupportCount} linked item{Number(resolvedSupportCount) === 1 ? "" : "s"}
      </summary>
      {summary ? (
        <p className="mt-2 text-xs leading-6 text-[var(--ink-soft)]">{summary}</p>
      ) : null}
      {contributionDescription ? (
        <p className="mt-2 text-xs leading-6 text-[var(--ink-muted)]">
          {contributionDescription}
        </p>
      ) : null}
      <div className="mt-3 grid gap-3">
        {Object.entries(groupedItems).map(([groupLabel, groupItems]) => (
          <div key={groupLabel} className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone="default">{groupLabel}</StatusPill>
              <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">
                {groupItems.length} shown
              </span>
            </div>
            <div className="grid gap-2">
              {groupItems.map((item, index) => {
                const content = (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      {item.detail ? (
                        <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">
                          {item.detail}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm leading-6 text-white">{item.label}</p>
                    {item.context ? (
                      <p className="mt-1 text-xs leading-6 text-[var(--ink-soft)]">
                        {item.context}
                      </p>
                    ) : null}
                  </>
                );

                return item.href ? (
                  <Link
                    key={`${item.kind}-${item.href}-${index}`}
                    href={item.href}
                    className="rounded-lg border border-white/8 bg-[rgba(18,31,49,0.52)] px-3 py-2.5 transition-[border-color,background-color] hover:border-[rgba(132,247,198,0.24)] hover:bg-[rgba(18,31,49,0.8)]"
                  >
                    {content}
                  </Link>
                ) : (
                  <div
                    key={`${item.kind}-${item.label}-${index}`}
                    className="rounded-lg border border-white/8 bg-[rgba(18,31,49,0.52)] px-3 py-2.5"
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

export function SourceLibraryTable({ items = [] }) {
  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--line)] bg-[rgba(18,31,49,0.32)] p-4 text-sm leading-7 text-[var(--ink-soft)]">
        No sources match the current query. Try broadening the search to inspect more of the public evidence library.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--line)] text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            <tr>
              <th className="px-5 py-4">Source</th>
              <th className="px-5 py-4">Publisher</th>
              <th className="px-5 py-4">Type</th>
              <th className="px-5 py-4">Linked</th>
              <th className="px-5 py-4">Trust</th>
              <th className="px-5 py-4">Date</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-white/6 last:border-b-0">
                <td className="px-5 py-4">
                  {item.source_url ? (
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-white hover:text-white"
                    >
                      {item.source_title || item.source_url}
                    </a>
                  ) : (
                    <span className="font-medium text-white">
                      {item.source_title || "Untitled source"}
                    </span>
                  )}
                  {item.notes ? (
                    <p className="mt-1 line-clamp-2 text-xs leading-6 text-[var(--ink-soft)]">
                      {item.notes}
                    </p>
                  ) : null}
                  <SourceSupportPreview
                    items={item.support_preview || []}
                    breakdown={item.support_breakdown || null}
                    supportCount={item.support_link_count ?? item.linked_record_count ?? null}
                  />
                </td>
                <td className="px-5 py-4 text-[var(--ink-soft)]">
                  {item.publisher || "—"}
                </td>
                <td className="px-5 py-4 text-[var(--ink-soft)]">
                  {item.source_type || "—"}
                </td>
                <td className="px-5 py-4 text-[var(--ink-soft)]">
                  <div>
                    <span>{item.support_link_count ?? item.linked_record_count ?? 0}</span>
                    {item.support_link_count != null &&
                    item.linked_record_count != null &&
                    item.support_link_count !== item.linked_record_count ? (
                      <p className="mt-1 text-xs leading-6 text-[var(--ink-muted)]">
                        {item.linked_record_count} direct record link
                        {Number(item.linked_record_count) === 1 ? "" : "s"} •{" "}
                        {item.support_breakdown?.impacts ?? 0} Black-impact row
                        {(item.support_breakdown?.impacts ?? 0) === 1 ? "" : "s"}
                      </p>
                    ) : null}
                  </div>
                </td>
                <td className="px-5 py-4 text-[var(--ink-soft)]">
                  {item.trust_label || item.confidence_label || "—"}
                </td>
                <td className="px-5 py-4 text-[var(--ink-soft)]">
                  {formatRenderableDate(item.published_date) || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SearchResultGroup({
  title,
  description = null,
  items = [],
}) {
  if (!items.length) {
    return null;
  }

  return (
    <section className="rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            {items.length} result{items.length === 1 ? "" : "s"}
          </span>
        </div>
        {description ? (
          <p className="text-sm leading-7 text-[var(--ink-soft)]">{description}</p>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3">
        {items.map((item, index) => (
          <Link
            key={`${item.href}-${index}`}
            href={item.href}
            className="rounded-[1.2rem] border border-white/8 bg-white/5 p-4 hover:border-[rgba(132,247,198,0.24)]"
          >
            {(item.meta || item.trustSignal) ? (
              <div className="flex flex-wrap items-center gap-2">
                {item.meta ? (
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                    {item.meta}
                  </p>
                ) : null}
                <EvidenceBadge signal={item.trustSignal} />
              </div>
            ) : null}
            <h3 className="mt-2 text-base font-medium text-white">{item.title}</h3>
            {item.summary ? (
              <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                {item.summary}
              </p>
            ) : null}
          </Link>
        ))}
      </div>
    </section>
  );
}

export function CompareSelector({ options = [], selected = [], name = "compare" }) {
  const selectedCount = Array.isArray(selected) ? selected.length : 0;
  const canCompare = selectedCount >= 2;

  return (
    <div className="rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <label htmlFor={`${name}-selector`} className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
            Select comparison targets
          </label>
          <p id={`${name}-selector-help`} className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
            Select 2-4 records. Click one record, then hold Command or Control while clicking more.
          </p>
        </div>
        <div className="rounded-md border border-[var(--line)] bg-[rgba(18,31,49,0.52)] px-3 py-2 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            Selected
          </p>
          <p className="mt-1 text-sm font-medium text-white">
            {selectedCount} of 4
          </p>
        </div>
      </div>
      <select
        id={`${name}-selector`}
        name={name}
        multiple
        defaultValue={selected}
        aria-describedby={`${name}-selector-help ${name}-selector-status`}
        className="min-h-[220px] w-full rounded-[1.1rem] border border-white/8 bg-white/5 px-3 py-3 text-sm text-white accent-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(132,247,198,0.22)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(11,20,33,0.96)]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <p id={`${name}-selector-status`} className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">
        {canCompare
          ? "Ready to compare. Submit to load the side-by-side table and ranking summary."
          : "Choose at least two records to generate a comparison."}
      </p>
    </div>
  );
}

export function ComparisonMetricsTable({
  rows = [],
  metrics = [],
  minTableWidthClassName = "min-w-[44rem]",
  scrollClassName = "",
}) {
  if (!rows.length) {
    return (
      <div className="dashboard-empty-state text-sm leading-7 text-[var(--ink-soft)]">
        No comparable records are available for the current selection. Try choosing a different set of records.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)]">
      <div className={`overflow-x-auto ${scrollClassName}`.trim()}>
        <table className={`w-full text-left text-sm ${minTableWidthClassName}`.trim()}>
          <thead className="border-b border-white/8 text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
            <tr>
              <th className="w-[13rem] px-4 py-4 md:px-5">Metric</th>
              {rows.map((row) => (
                <th key={row.label} className="min-w-[8.75rem] px-4 py-4 md:px-5">
                  {row.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((metric) => (
              <tr
                key={metric.key}
                className={`border-b border-white/6 last:border-b-0 ${
                  metric.primary ? "bg-[rgba(18,31,49,0.42)]" : ""
                }`}
              >
                <td className="px-4 py-4 align-top md:px-5">
                  <p className={`font-medium ${metric.primary ? "text-[var(--accent)]" : "text-white"}`}>
                    {metric.label}
                  </p>
                  {metric.description ? (
                    <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
                      {metric.description}
                    </p>
                  ) : null}
                </td>
                {rows.map((row) => (
                  <td
                    key={`${row.label}-${metric.key}`}
                    className="px-4 py-4 align-top text-[var(--ink-soft)] md:px-5"
                  >
                    <span className={metric.primary ? "text-base font-semibold text-white" : "font-medium text-white"}>
                      {row[metric.key] ?? "—"}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RecentPolicyChangesTable({
  items = [],
  buildHref,
  emptyTitle = "No policy updates are available in this view yet.",
  emptyDescription = null,
  showScoreImpact = false,
  showWhyThisMatters = false,
  formatRecordType = null,
  formatDirection = null,
}) {
  if (!items.length) {
    return (
      <div className="dashboard-empty-state text-sm leading-7 text-[var(--ink-soft)]">
        <p className="font-medium text-white">{emptyTitle}</p>
        {emptyDescription ? (
          <p className="mt-1 text-[var(--ink-soft)]">{emptyDescription}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/8 text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
            <tr>
              <th className="px-5 py-4">Update</th>
              <th className="px-5 py-4">Date</th>
              <th className="px-5 py-4">Direction</th>
              {showScoreImpact ? <th className="px-5 py-4">Score impact</th> : null}
              <th className="px-5 py-4">Linked record</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const href =
                item.linked_record_href ||
                item.href ||
                (typeof buildHref === "function" ? buildHref(item) : null);
              const linkedRecordTitle =
                item.linked_record_title ||
                item.linked_record ||
                item.title ||
                `${item.record_type || "Record"}`;
              const recordTypeLabel =
                typeof formatRecordType === "function"
                  ? formatRecordType(item)
                  : item.record_type;
              const directionLabel =
                typeof formatDirection === "function"
                  ? formatDirection(item)
                  : item.impact_direction || item.status || "—";

              return (
                <tr key={`${item.slug || item.id}-${index}`} className="border-b border-white/6 last:border-b-0">
                  <td className="px-5 py-4">
                    {recordTypeLabel ? (
                      <div className="mb-2">
                        <RecordTypeBadge label={recordTypeLabel} />
                      </div>
                    ) : null}
                    <div className="flex items-start gap-2">
                      <p className="font-medium text-white">{item.title}</p>
                      {showWhyThisMatters ? (
                        <RecentUpdateWhyTooltip text={item.why_this_matters_text} />
                      ) : null}
                    </div>
                    {item.summary ? <p className="mt-1 text-xs leading-6 text-[var(--ink-soft)]">{item.summary}</p> : null}
                  </td>
                  <td className="px-5 py-4 text-[var(--ink-soft)]">
                    {formatRenderableDate(item.date) || formatRenderableDate(item.latest_action_date) || "—"}
                  </td>
                  <td className="px-5 py-4 text-[var(--ink-soft)]">{directionLabel}</td>
                  {showScoreImpact ? (
                    <td className="px-5 py-4">
                      <StatusPill tone={getImpactDirectionTone(item.score_impact_label || item.impact_direction || item.status)}>
                        {item.score_impact_label || "Pending score"}
                      </StatusPill>
                    </td>
                  ) : null}
                  <td className="px-5 py-4">
                    {href ? (
                      <Link href={href} className="font-medium text-[var(--ink-soft)] hover:text-white">
                        {linkedRecordTitle}
                      </Link>
                    ) : (
                      <span className="font-medium text-white">{linkedRecordTitle}</span>
                    )}
                    {item.linked_record_type ? (
                      <p className="mt-1 text-xs leading-6 text-[var(--ink-muted)]">
                        {item.linked_record_type}
                      </p>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
