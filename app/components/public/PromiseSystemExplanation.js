export default function PromiseSystemExplanation() {
  return (
    <aside className="h-full rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
        Tracker guide
      </p>
      <h3 className="mt-2 text-base font-semibold text-white">
        What this table is showing
      </h3>
      <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
        Each row is a documented public commitment tied to a president. The
        tracker asks whether that commitment produced visible implementation,
        linked outcomes, and source-backed evidence in the current record.
      </p>
      <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
        Start with <span className="font-semibold text-white">Current status</span>, then
        compare <span className="font-semibold text-white">Linked outcomes</span> and{" "}
        <span className="font-semibold text-white">Evidence confidence</span> to see how much
        public record supports that status before opening the full promise page.
      </p>
    </aside>
  );
}
