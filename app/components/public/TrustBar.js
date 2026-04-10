import Link from "next/link";

export default function TrustBar() {
  return (
    <aside className="rounded-[1.35rem] border border-white/8 bg-[rgba(8,14,24,0.88)] px-5 py-4 md:px-6 md:py-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-4xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
            Trust and method
          </p>
          <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
            EquityStack analyzes documented government actions, source-backed evidence,
            and structured impact scoring. The platform is non-partisan, data-driven,
            and transparent about methodology.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/methodology" className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-white hover:border-white/20 hover:bg-white/8">
            Methodology
          </Link>
          <Link href="/sources" className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-white hover:border-white/20 hover:bg-white/8">
            Sources
          </Link>
        </div>
      </div>
    </aside>
  );
}
