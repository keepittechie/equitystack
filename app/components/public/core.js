import Link from "next/link";

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
      className={`flex flex-wrap items-end justify-between gap-4 md:gap-6 ${
        align === "center" ? "text-center" : ""
      }`}
    >
      <div className="max-w-3xl">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
            {eyebrow}
          </p>
        ) : null}
        <HeadingTag
          className={`text-white ${
            isHero
              ? "mt-4 text-[clamp(2.35rem,5vw,4.8rem)] font-semibold leading-[0.95] tracking-[-0.05em]"
              : "mt-3 text-[clamp(1.65rem,3.2vw,2.5rem)] font-semibold leading-[1.02] tracking-[-0.045em]"
          }`}
        >
          {title}
        </HeadingTag>
        {description ? (
          <p
            className={`max-w-3xl text-[var(--ink-soft)] ${
              isHero
                ? "mt-5 text-base leading-8 md:text-lg"
                : "mt-4 text-sm leading-7 md:text-base md:leading-8"
            }`}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex w-full flex-wrap gap-3 sm:w-auto">{actions}</div> : null}
    </div>
  );
}

export function KpiCard({ label, value, delta, description, tone = "default" }) {
  const borderTone =
    tone === "accent"
      ? "border-[rgba(132,247,198,0.22)] bg-[linear-gradient(180deg,rgba(19,44,41,0.95),rgba(8,20,27,0.94))]"
      : "border-white/8 bg-[linear-gradient(180deg,rgba(13,20,32,0.96),rgba(6,11,18,0.96))]";

  return (
    <article className={`flex h-full flex-col rounded-[1.6rem] border p-5 md:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.24)] ${borderTone}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--ink-muted)]">
          {label}
        </p>
        {delta ? (
          <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-[var(--accent)] whitespace-nowrap">
            {delta}
          </span>
        ) : null}
      </div>
      <p className="mt-4 text-[clamp(2rem,4.5vw,3rem)] font-semibold tracking-[-0.05em] text-white">{value}</p>
      {description ? (
        <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{description}</p>
      ) : null}
    </article>
  );
}

export function ScoreBadge({
  value,
  label = "Black Impact Score",
  context = null,
  tone = "default",
  size = "md",
}) {
  const colorClasses =
    tone === "positive"
      ? "border-[rgba(132,247,198,0.22)] bg-[rgba(11,58,50,0.62)] text-[var(--success)]"
      : tone === "negative"
        ? "border-[rgba(255,138,138,0.22)] bg-[rgba(63,16,24,0.62)] text-[var(--danger)]"
        : "border-[rgba(96,165,250,0.18)] bg-[rgba(7,32,52,0.72)] text-[var(--accent)]";

  return (
    <div className={`inline-flex min-w-[116px] shrink-0 self-start flex-col rounded-[1.3rem] border px-4 py-3 ${colorClasses}`}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.22em]">{label}</span>
      <span className={`mt-2 font-semibold tracking-[-0.04em] ${size === "lg" ? "text-4xl" : "text-2xl"}`}>
        {value}
      </span>
      {context ? <span className="mt-2 text-xs text-[var(--ink-soft)]">{context}</span> : null}
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
    <aside className="h-full rounded-[1.5rem] border border-[rgba(96,165,250,0.14)] bg-[linear-gradient(135deg,rgba(7,30,47,0.9),rgba(10,15,23,0.95))] p-5 md:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
        Methodology nearby
      </p>
      <h3 className="mt-3 text-base font-semibold text-white md:text-lg">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
        {description}
      </p>
      <Link href={href} className="mt-4 inline-flex text-sm font-medium text-[var(--accent)] hover:text-white">
        {linkLabel}
      </Link>
    </aside>
  );
}

export function PageContextBlock({
  title = "How to read this page",
  description,
  detail = null,
}) {
  return (
    <aside className="h-full rounded-[1.5rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5 md:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
        How to read this page
      </p>
      <h3 className="mt-3 text-base font-semibold text-white md:text-lg">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{description}</p>
      {detail ? (
        <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{detail}</p>
      ) : null}
    </aside>
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
    <aside className="h-full rounded-[1.5rem] border border-[rgba(96,165,250,0.14)] bg-[linear-gradient(135deg,rgba(7,30,47,0.9),rgba(10,15,23,0.95))] p-5 md:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
        Presidential methodology
      </p>
      <h3 className="mt-3 text-base font-semibold text-white md:text-lg">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
        EquityStack combines outcome evidence, promise-tracker context, and
        linked legislative signals into one public-facing presidential score.
        The outcome-based layer still carries the most weight.
      </p>
      <div className="mt-4 grid gap-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-[1.05rem] border border-white/8 bg-white/5 px-4 py-3.5"
          >
            <p className="text-sm font-semibold text-white">{item.label}</p>
            <p className="mt-1 text-sm leading-7 text-[var(--ink-soft)]">
              {item.description}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
        Bill influence is bounded, so one thin or weak legislative link cannot
        override the outcome-based record. Scores remain a structured measure of
        public evidence, not a popularity rating or a complete judgment of a
        presidency.
      </p>
    </aside>
  );
}

export function CitationNote({
  title = "Citation note",
  description =
    "When referencing this page externally, cite the page title, EquityStack, the page URL, and your access date. Treat the page as a structured summary of the current dataset, not a complete historical judgment.",
}) {
  return (
    <aside className="h-full rounded-[1.5rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5 md:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
        Citation-friendly context
      </p>
      <h3 className="mt-3 text-base font-semibold text-white md:text-lg">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{description}</p>
    </aside>
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
    <section className="rounded-[1.5rem] border border-white/8 bg-[rgba(8,14,24,0.9)] p-5 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
            Trust and evidence
          </p>
          {summary ? (
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ink-soft)]">{summary}</p>
          ) : null}
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              {metric.label}
            </p>
            <p className="mt-2 text-lg font-medium text-white">{metric.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function FilterDrawer({ title = "Filters", children }) {
  return (
    <details className="rounded-[1.5rem] border border-white/8 bg-[rgba(10,16,28,0.92)] md:hidden">
      <summary className="cursor-pointer list-none px-5 py-4 text-sm font-medium text-white">
        {title}
      </summary>
      <div className="border-t border-white/8 px-5 py-5">{children}</div>
    </details>
  );
}

export function DashboardFilterBar({ children, helpText = null }) {
  return (
    <section className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5 md:p-6">
      <div className="flex flex-wrap items-end gap-4">{children}</div>
      {helpText ? (
        <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">{helpText}</p>
      ) : null}
    </section>
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
