export default function InsightCard({ title = "Insight", text }) {
  if (!text) {
    return null;
  }

  return (
    <article className="rounded-[1.5rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
        {title}
      </p>
      <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
        {text}
      </p>
    </article>
  );
}
