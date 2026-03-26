import Link from "next/link";

export default function NotFound() {
  return (
    <main className="content-shell max-w-3xl mx-auto p-6 min-h-[60vh] flex items-center">
      <section className="hero-panel w-full p-8">
        <p className="eyebrow mb-4">
          Not Found
        </p>
        <h1 className="text-3xl font-bold mb-4">The requested page does not exist.</h1>
        <p className="text-[var(--ink-soft)] leading-7 mb-6">
          The record may have been removed, renamed, or never published. Use one of the
          main entry points below to continue exploring EquityStack.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/"
            className="px-4 py-2 rounded-lg bg-black text-white font-medium"
          >
            Home
          </Link>
          <Link
            href="/policies"
            className="border rounded-lg px-4 py-2 font-medium bg-[rgba(255,252,247,0.85)] hover:bg-[rgba(255,252,247,1)] transition"
          >
            Browse Policies
          </Link>
          <Link
            href="/explainers"
            className="border rounded-lg px-4 py-2 font-medium bg-[rgba(255,252,247,0.85)] hover:bg-[rgba(255,252,247,1)] transition"
          >
            Read Explainers
          </Link>
        </div>
      </section>
    </main>
  );
}
