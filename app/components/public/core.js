import Link from "next/link";
import {
  MetricCard,
  Panel,
  StatusPill,
} from "@/app/components/dashboard/primitives";

export function SectionIntro({
  eyebrow,
  title,
  description,
  actions = null,
  align = "default",
  as: HeadingTag = "h2",
}) {
  const isHero = HeadingTag === "h1";

  return (
    <div
      className={`flex flex-wrap items-end justify-between gap-3 md:gap-4 ${
        align === "center" ? "text-center" : ""
      }`}
    >
      <div className="max-w-3xl">
        {eyebrow ? (
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            {eyebrow}
          </p>
        ) : null}
        <HeadingTag
          className={`text-white ${
            isHero
              ? "mt-3 text-[clamp(1.9rem,5.5vw,3.7rem)] font-semibold leading-[1] tracking-[-0.04em]"
              : "mt-2 text-[clamp(1.45rem,3vw,2.15rem)] font-semibold leading-[1.02] tracking-[-0.04em]"
          }`}
        >
          {title}
        </HeadingTag>
        {description ? (
          <p
            className={`max-w-3xl text-[var(--ink-soft)] ${
              isHero
                ? "mt-4 text-sm leading-6 md:text-base md:leading-7"
                : "mt-2 text-sm leading-6 md:text-base md:leading-7"
            }`}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex w-full flex-wrap gap-2 sm:w-auto">{actions}</div> : null}
    </div>
  );
}

export function KpiCard({ label, value, delta, description, tone = "default" }) {
  return (
    <MetricCard
      label={label}
      value={value}
      description={description}
      tone={tone === "accent" ? "info" : tone}
    >
      {delta ? <StatusPill tone={tone === "accent" ? "info" : tone}>{delta}</StatusPill> : null}
    </MetricCard>
  );
}

export function ScoreBadge({
  value,
  label = "Black Impact Score",
  context = null,
  tone = "default",
  size = "md",
}) {
  const resolvedTone =
    tone === "positive" ? "success" : tone === "negative" ? "danger" : tone;

  return (
    <div className={`inline-flex min-w-[112px] shrink-0 self-start flex-col rounded-lg border px-3 py-2.5 ${
      resolvedTone === "success"
        ? "border-[rgba(132,247,198,0.28)] bg-[rgba(132,247,198,0.07)] text-[var(--success)]"
        : resolvedTone === "danger"
          ? "border-[rgba(255,138,138,0.3)] bg-[rgba(255,138,138,0.07)] text-[var(--danger)]"
          : "border-[var(--line)] bg-[rgba(18,31,49,0.58)] text-[var(--info)]"
    }`}>
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em]">{label}</span>
      <span className={`mt-1 font-semibold tracking-[-0.04em] ${size === "lg" ? "text-3xl" : "text-xl"}`}>
        {value}
      </span>
      {context ? <span className="mt-1 text-[11px] text-[var(--ink-soft)]">{context}</span> : null}
    </div>
  );
}

export function MethodologyCallout({
  title = "How to read this",
  description,
  href = "/methodology",
  linkLabel = "Open methodology",
}) {
  return (
    <Panel padding="md" className="h-full">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
        Methodology nearby
      </p>
      <h3 className="mt-2 text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
        {description}
      </p>
      <Link
        href={href}
        className="mt-3 inline-flex text-sm font-semibold text-[var(--ink-soft)] transition-[color] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(132,247,198,0.28)]"
      >
        {linkLabel}
      </Link>
    </Panel>
  );
}

export function PageContextBlock({
  title = "How to read this page",
  description,
  detail = null,
}) {
  return (
    <Panel padding="md" className="h-full">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
        How to read this page
      </p>
      <h3 className="mt-2 text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">{description}</p>
      {detail ? (
        <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">{detail}</p>
      ) : null}
    </Panel>
  );
}

export function PresidentScoreMethodologyNote({
  title = "How this score works",
}) {
  const items = [
    {
      label: "Outcome-based score",
      description:
        "Documented policy outcomes remain the anchor. The score starts from measured impact in the current EquityStack record.",
    },
    {
      label: "Promise context",
      description:
        "Promise Tracker data adds accountability context so visitors can see what was committed, what was delivered, and where records stay incomplete.",
    },
    {
      label: "Linked bills",
      description:
        "Tracked bills add legislative context only when current Bills to Promises to Presidents lineage is strong enough to support the join.",
    },
  ];

  return (
    <Panel padding="md" className="h-full">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
        Presidential methodology
      </p>
      <h3 className="mt-2 text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
        EquityStack combines outcome evidence, promise-tracker context, and
        linked legislative signals into one public-facing presidential score.
        The outcome-based layer still carries the most weight.
      </p>
      <div className="mt-4 grid gap-3">
        {items.map((item) => (
          <Panel
            key={item.label}
            padding="md"
          >
            <p className="text-sm font-semibold text-white">{item.label}</p>
            <p className="mt-1 text-sm leading-6 text-[var(--ink-soft)]">
              {item.description}
            </p>
          </Panel>
        ))}
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">
        Bill influence is bounded, so one thin or weak legislative link cannot
        override the outcome-based record. Scores remain a structured measure of
        public evidence, not a popularity rating or a complete judgment of a
        presidency.
      </p>
    </Panel>
  );
}

export function CitationNote({
  title = "Citation note",
  description =
    "When referencing this page externally, cite the page title, EquityStack, the page URL, and your access date. Treat the page as a structured summary of the current dataset, not a complete historical judgment.",
}) {
  return (
    <Panel padding="md" className="h-full">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
        Citation-friendly context
      </p>
      <h3 className="mt-2 text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">{description}</p>
    </Panel>
  );
}

export function SourceTrustPanel({
  sourceCount = 0,
  sourceQuality = null,
  confidenceLabel = null,
  completenessLabel = null,
  includedCount = null,
  excludedCount = null,
  summary = null,
}) {
  const metrics = [
    sourceCount != null ? { label: "Sources", value: sourceCount } : null,
    sourceQuality ? { label: "Source Quality", value: sourceQuality } : null,
    confidenceLabel ? { label: "Confidence", value: confidenceLabel } : null,
    completenessLabel ? { label: "Completeness", value: completenessLabel } : null,
    includedCount != null ? { label: "Included", value: includedCount } : null,
    excludedCount != null ? { label: "Excluded", value: excludedCount } : null,
  ].filter(Boolean);

  return (
    <Panel padding="md">
      <div>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
          Trust and evidence
        </p>
        {summary ? (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ink-soft)]">{summary}</p>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            density="compact"
          />
        ))}
      </div>
    </Panel>
  );
}

export function FilterDrawer({ title = "Filters", children }) {
  return (
    <details className="rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] md:hidden">
      <summary className="cursor-pointer list-none px-5 py-4 text-sm font-medium text-white">
        {title}
      </summary>
      <div className="border-t border-[var(--line)] px-4 py-4">{children}</div>
    </details>
  );
}

export function DashboardFilterBar({ children, helpText = null }) {
  return (
    <Panel padding="md">
      <div className="flex flex-wrap items-end gap-4">{children}</div>
      {helpText ? (
        <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">{helpText}</p>
      ) : null}
    </Panel>
  );
}

export function ImpactOverviewCards({ items = [] }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <KpiCard
          key={item.label}
          label={item.label}
          value={item.value}
          delta={item.delta}
          description={item.description}
          tone={item.tone}
        />
      ))}
    </section>
  );
}
