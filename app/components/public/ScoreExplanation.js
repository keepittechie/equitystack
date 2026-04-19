export default function ScoreExplanation({
  title = "How to interpret Impact Score",
}) {
  const rows = [
    {
      label: "Positive",
      description: "Policy improved measurable outcomes for Black Americans.",
    },
    {
      label: "Negative",
      description: "Policy caused harm, exclusion, or measurable regression.",
    },
    {
      label: "Mixed",
      description: "Policy produced both benefits and meaningful drawbacks.",
    },
    {
      label: "Blocked",
      description: "Intended action did not result in measurable implementation.",
    },
  ];

  return (
    <aside className="h-full rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4 md:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
        Score interpretation
      </p>
      <h3 className="mt-3 text-base font-semibold text-white md:text-lg">{title}</h3>
      <div className="mt-4 grid gap-3">
        {rows.map((row) => (
          <div
            key={row.label}
            className="rounded-[1.05rem] border border-white/8 bg-white/5 px-4 py-3.5"
          >
            <p className="text-sm font-semibold text-white">{row.label}</p>
            <p className="mt-1 text-sm leading-7 text-[var(--ink-soft)]">
              {row.description}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">
        Direct impact reflects direct policy action. Systemic impact reflects
        downstream institutional effects, especially judicial attribution.
      </p>
    </aside>
  );
}
