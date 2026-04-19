export default function InsightCard({ title = "Insight", text }) {
  if (!text) {
    return null;
  }

  return (
    <article className="h-full rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4 md:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
        {title}
      </p>
      <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
        {text}
      </p>
    </article>
  );
}
