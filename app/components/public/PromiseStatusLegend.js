import {
  StatusPill,
  getPromiseStatusTone,
} from "@/app/components/dashboard/primitives";

function describeStatus(status) {
  if (status === "Delivered") {
    return {
      label: "Kept",
      detail: "Documented policy action shows the commitment was carried out in the current record.",
    };
  }
  if (status === "In Progress") {
    return {
      label: "In Progress",
      detail: "Implementation is underway, but the commitment is not complete yet.",
    };
  }
  if (status === "Partial") {
    return {
      label: "Partial",
      detail: "There is meaningful implementation, but only part of the promise is documented as complete.",
    };
  }
  if (status === "Blocked") {
    return {
      label: "Blocked",
      detail: "Visible barriers stopped the promise from reaching implementation.",
    };
  }
  if (status === "Failed") {
    return {
      label: "Broken",
      detail: "The commitment was not fulfilled in the current documented record.",
    };
  }
  return {
    label: status,
    detail: "Status meaning is not yet available.",
  };
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
        What the statuses mean
      </h3>
      <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
        Status describes implementation in the current record. It does not tell
        you whether the impact was positive or negative on its own.
      </p>
      <div className="mt-4 grid gap-3">
        {statuses.map((status) => {
          const entry = describeStatus(status);

          return (
            <div
              key={status}
              className="rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.52)] p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={getPromiseStatusTone(status)}>{entry.label}</StatusPill>
                {entry.label !== status ? (
                  <span className="text-xs font-medium text-[var(--ink-muted)]">
                    Tracker label: {status}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
                {entry.detail}
              </p>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
