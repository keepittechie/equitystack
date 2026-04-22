import Link from "next/link";

export default function TrustBar() {
  return (
    <aside className="rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-4xl">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            Trust and method
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
            EquityStack keeps policies, promises, demographic-impact evidence, and
            public sources in one record. It distinguishes direct evidence,
            supporting context, and incomplete analysis instead of forcing a
            conclusion where the record is still thin.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/how-it-works" className="dashboard-button-secondary">
            How it works
          </Link>
          <Link href="/sources" className="dashboard-button-secondary">
            Sources
          </Link>
        </div>
      </div>
    </aside>
  );
}
