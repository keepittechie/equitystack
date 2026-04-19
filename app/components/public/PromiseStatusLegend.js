function describeStatus(status) {
  if (status === "Delivered") {
    return "Resulted in documented implemented policy action.";
  }
  if (status === "In Progress") {
    return "Shows ongoing action or implementation that is not complete yet.";
  }
  if (status === "Partial") {
    return "Shows meaningful but incomplete implementation.";
  }
  if (status === "Blocked") {
    return "Did not reach implementation because of barriers, interruption, or institutional constraint.";
  }
  if (status === "Failed") {
    return "Commitment was not fulfilled in the current documented record.";
  }
  return "Status meaning is not yet available.";
}

export default function PromiseStatusLegend({
  statuses = ["Delivered", "In Progress", "Partial", "Blocked", "Failed"],
}) {
  return (
    <aside className="h-full rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
        Status legend
      </p>
      <h3 className="mt-2 text-base font-semibold text-white">
        How Promise Status is assigned
      </h3>
      <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
        Promise Status reflects documented implementation and evidence in the
        current EquityStack dataset. It does not measure rhetoric on its own.
      </p>
      <div className="mt-4 grid gap-3">
        {statuses.map((status) => (
          <div
            key={status}
            className="rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.52)] p-3"
          >
            <p className="text-sm font-semibold text-white">{status}</p>
            <p className="mt-1 text-sm leading-6 text-[var(--ink-soft)]">
              {describeStatus(status)}
            </p>
          </div>
        ))}
      </div>
    </aside>
  );
}
