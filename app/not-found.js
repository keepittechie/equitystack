import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-4xl items-center">
      <section className="hero-panel w-full p-8 md:p-10">
        <p className="eyebrow mb-4">Not Found</p>
        <h1 className="text-[clamp(2rem,4vw,3.5rem)] font-semibold tracking-[-0.05em] text-white">
          The requested page is not available.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--ink-soft)]">
          The record may have moved, been unpublished, or never existed in the public
          site. Use one of the main public entry points below to continue browsing
          EquityStack.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="dashboard-button-primary">
            Home
          </Link>
          <Link href="/dashboard" className="dashboard-button-secondary">
            Open dashboard
          </Link>
          <Link href="/policies" className="dashboard-button-secondary">
            Browse policies
          </Link>
          <Link href="/search" className="dashboard-button-secondary">
            Search records
          </Link>
        </div>
      </section>
    </main>
  );
}
