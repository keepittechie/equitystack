import Link from "next/link";
import { Panel, StatusPill } from "@/app/components/dashboard/primitives";

export default function WhyThisScorePanel({
  eyebrow = "Why this score?",
  title = "Why this score?",
  summary = null,
  items = [],
  note = null,
  actionHref = null,
  actionLabel = null,
}) {
  const visibleItems = (items || []).filter(
    (item) => item?.label && (item?.value || item?.detail)
  );

  if (!summary && !visibleItems.length && !note) {
    return null;
  }

  return (
    <Panel padding="md" prominence="primary" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <StatusPill tone="info">{eyebrow}</StatusPill>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        {actionHref && actionLabel ? (
          <Link
            href={actionHref}
            className="inline-flex min-h-9 items-center justify-center rounded-md border border-[var(--line-strong)] bg-[rgba(18,31,49,0.58)] px-3 text-[12px] font-semibold text-white transition-[background-color,border-color,box-shadow] hover:border-[var(--line-strong)] hover:bg-[rgba(18,31,49,0.86)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(132,247,198,0.28)]"
          >
            {actionLabel}
          </Link>
        ) : null}
      </div>
      {summary ? (
        <p className="text-sm leading-7 text-[var(--ink-soft)]">{summary}</p>
      ) : null}
      {visibleItems.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {visibleItems.map((item) => (
            <div
              key={item.label}
              className="rounded-[1.05rem] border border-white/8 bg-white/5 px-4 py-3.5"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                {item.label}
              </p>
              {item.value ? (
                <p className="mt-2 text-sm font-semibold leading-6 text-white">
                  {item.value}
                </p>
              ) : null}
              {item.detail ? (
                <p className="mt-1 text-sm leading-6 text-[var(--ink-soft)]">
                  {item.detail}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      {note ? (
        <p className="text-sm leading-7 text-[var(--ink-soft)]">{note}</p>
      ) : null}
    </Panel>
  );
}
