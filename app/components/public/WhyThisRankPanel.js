import { Panel, StatusPill } from "@/app/components/dashboard/primitives";
import { buildPresidentRankExplanation } from "@/lib/black-impact-score/presidentRankExplanation";

function renderItems(items = []) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-[1.05rem] border border-white/8 bg-white/5 px-4 py-3.5"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            {item.label}
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-white">{item.value}</p>
          {item.detail ? (
            <p className="mt-1 text-sm leading-6 text-[var(--ink-soft)]">{item.detail}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default function WhyThisRankPanel({
  president,
  explanation = null,
  compact = false,
  title = "Why This Rank?",
  eyebrow = "Ranking explanation",
  className = "",
}) {
  const resolvedExplanation = explanation || buildPresidentRankExplanation(president);

  if (!resolvedExplanation?.items?.length) {
    return null;
  }

  if (compact) {
    return (
      <details
        className={`group rounded-[1.05rem] border border-[var(--line)] bg-[rgba(18,31,49,0.48)] ${className}`}
      >
        <summary className="cursor-pointer list-none px-4 py-3.5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <StatusPill tone="info">{title}</StatusPill>
              <p className="text-sm leading-6 text-[var(--ink-soft)]">
                {resolvedExplanation.summary}
              </p>
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)]">
              Open
            </span>
          </div>
        </summary>
        <div className="border-t border-white/8 px-4 py-4">
          {renderItems(resolvedExplanation.items)}
          {resolvedExplanation.note ? (
            <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">
              {resolvedExplanation.note}
            </p>
          ) : null}
        </div>
      </details>
    );
  }

  return (
    <Panel padding="md" prominence="primary" className={`space-y-4 ${className}`.trim()}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <StatusPill tone="info">{eyebrow}</StatusPill>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
      </div>
      <p className="text-sm leading-7 text-[var(--ink-soft)]">{resolvedExplanation.summary}</p>
      {renderItems(resolvedExplanation.items)}
      {resolvedExplanation.note ? (
        <p className="text-sm leading-7 text-[var(--ink-soft)]">{resolvedExplanation.note}</p>
      ) : null}
    </Panel>
  );
}
