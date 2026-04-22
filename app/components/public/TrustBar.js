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
            EquityStack analyzes documented government actions, source-backed evidence,
            and structured impact scoring. The platform is non-partisan, data-driven,
            and transparent about methodology.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/methodology" className="dashboard-button-secondary">
            Methodology
          </Link>
          <Link href="/sources" className="dashboard-button-secondary">
            Sources
          </Link>
        </div>
      </div>
    </aside>
  );
}
