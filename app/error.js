"use client";

import Link from "next/link";

export default function GlobalError({ error, reset }) {
  return (
    <html lang="en">
      <body className="page-shell min-h-screen text-[var(--foreground)]">
        <main className="content-shell max-w-3xl mx-auto p-6 min-h-screen flex items-center">
          <section className="hero-panel w-full p-8">
            <p className="eyebrow mb-4">
              Something Went Wrong
            </p>
            <h1 className="text-3xl font-bold mb-4">The page could not be loaded.</h1>
            <p className="text-[var(--ink-soft)] leading-7 mb-6">
              An unexpected error interrupted the request. You can retry the page now or
              return to the homepage and continue browsing.
            </p>
            {error?.message ? (
              <p className="text-sm text-[var(--ink-soft)] mb-6">{error.message}</p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => reset()}
                className="px-4 py-2 rounded-lg bg-black text-white font-medium"
              >
                Try Again
              </button>
              <Link
                href="/"
                className="border rounded-lg px-4 py-2 font-medium bg-[rgba(255,252,247,0.85)] hover:bg-[rgba(255,252,247,1)] transition"
              >
                Go Home
              </Link>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
