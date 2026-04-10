function describeStatus(status) {
  if (status === "Delivered") {
    return "Resulted in implemented policy action.";
  }
  if (status === "In Progress") {
    return "Shows partial implementation or ongoing action.";
  }
  if (status === "Partial") {
    return "Shows meaningful but incomplete implementation.";
  }
  if (status === "Blocked") {
    return "Did not reach implementation because of barriers or interruption.";
  }
  if (status === "Failed") {
    return "Commitment was not fulfilled in the current dataset.";
  }
  return "Status meaning is not yet available.";
}

export default function PromiseStatusLegend({
  statuses = ["Delivered", "In Progress", "Partial", "Blocked", "Failed"],
}) {
  return (
    <aside className="rounded-[1.5rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
        Status legend
      </p>
      <h3 className="mt-3 text-lg font-semibold text-white">
        How Promise Status is interpreted
      </h3>
      <div className="mt-4 grid gap-3">
        {statuses.map((status) => (
          <div
            key={status}
            className="rounded-[1.05rem] border border-white/8 bg-white/5 px-4 py-3"
          >
            <p className="text-sm font-semibold text-white">{status}</p>
            <p className="mt-1 text-sm leading-7 text-[var(--ink-soft)]">
              {describeStatus(status)}
            </p>
          </div>
        ))}
      </div>
    </aside>
  );
}
