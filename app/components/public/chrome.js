"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const PRIMARY_NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/policies", label: "Policies" },
  { href: "/presidents", label: "Presidents" },
  { href: "/promises", label: "Promises" },
  { href: "/reports", label: "Reports" },
  { href: "/timeline", label: "Timeline" },
  { href: "/about", label: "About" },
  { href: "/methodology", label: "Methodology" },
];

function isActive(pathname, href) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname?.startsWith(`${href}/`);
}

export function GlobalSearch({ compact = false }) {
  return (
    <form
      action="/search"
      method="GET"
      aria-label="Search EquityStack"
      className={`flex items-center gap-2 rounded-full border border-white/10 bg-white/5 ${
        compact ? "px-3 py-2" : "px-4 py-3"
      }`}
    >
      <label htmlFor={`global-search-${compact ? "compact" : "full"}`} className="sr-only">
        Search policies, presidents, promises, reports, and sources
      </label>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4 text-[var(--ink-muted)]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        id={`global-search-${compact ? "compact" : "full"}`}
        type="search"
        name="q"
        placeholder="Search policies, presidents, promises, reports, sources"
        className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-white placeholder:text-[var(--ink-muted)] focus:outline-none focus:ring-0"
      />
    </form>
  );
}

export function PrimaryNav({ mobile = false }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={mobile ? "Mobile primary navigation" : "Primary navigation"}
      className={mobile ? "grid gap-2" : "hidden items-center gap-2 lg:flex"}
    >
      {PRIMARY_NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              active
                ? "bg-[var(--accent)] text-[#04131d]"
                : "text-[var(--ink-soft)] hover:bg-white/6 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SiteHeader() {
  const pathname = usePathname();

  if (pathname?.startsWith("/admin")) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/8 bg-[rgba(4,10,18,0.88)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1500px] items-center gap-4 px-5 py-4 xl:px-8">
        <Link href="/" className="flex min-w-[208px] items-center gap-3">
          <div className="relative h-10 w-10 overflow-hidden rounded-2xl border border-white/10 bg-[rgba(17,29,46,0.9)] shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
            <Image src="/logo-v2.png" alt="EquityStack" fill className="object-contain p-1.5" priority />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
              EquityStack
            </p>
            <p className="text-sm text-[var(--ink-muted)]">
              Civic intelligence for Black policy impact
            </p>
          </div>
        </Link>

        <div className="hidden min-w-0 flex-1 xl:block">
          <PrimaryNav />
        </div>

        <div className="hidden min-w-[360px] xl:block">
          <GlobalSearch compact />
        </div>

        <Link
          href="/dashboard"
          className="hidden rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white hover:border-white/20 hover:bg-white/6 md:inline-flex"
        >
          Open Data Center
        </Link>
      </div>

      <div className="border-t border-white/6 px-5 py-3 xl:hidden">
        <div className="mx-auto grid max-w-[1500px] gap-3">
          <GlobalSearch compact />
          <PrimaryNav mobile />
        </div>
      </div>
    </header>
  );
}

export function Breadcrumbs({ items = [] }) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-sm text-[var(--ink-muted)]">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.href || item.label}-${index}`} className="inline-flex items-center gap-2">
            {item.href && !isLast ? (
              <Link href={item.href} className="hover:text-white">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "text-white" : ""}>{item.label}</span>
            )}
            {!isLast ? <span className="text-white/20">/</span> : null}
          </span>
        );
      })}
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="mt-20 border-t border-white/8 bg-[rgba(4,10,18,0.9)]">
      <div className="mx-auto grid max-w-[1500px] gap-10 px-5 py-12 text-left xl:grid-cols-[0.95fr_0.95fr_1.2fr] xl:px-8">
        <nav aria-label="Project footer links" className="text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
            Project
          </p>
          <div className="mt-4 grid gap-3 text-sm text-[var(--ink-soft)]">
            <Link href="/start" className="hover:text-white">Start Here</Link>
            <Link href="/explainers" className="hover:text-white">Explainers</Link>
            <Link href="/scorecards" className="hover:text-white">Scorecards</Link>
            <Link href="/methodology" className="hover:text-white">Methodology</Link>
            <Link href="/reports" className="hover:text-white">Reports</Link>
            <Link href="/promises" className="hover:text-white">Promise Tracker</Link>
            <Link href="/current-administration" className="hover:text-white">Current Administration</Link>
            <Link href="/future-bills" className="hover:text-white">Future Bills</Link>
            <Link href="/activity" className="hover:text-white">Activity</Link>
            <Link href="/policies" className="hover:text-white">Policies</Link>
          </div>
        </nav>

        <nav aria-label="Sources and code footer links" className="text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
            Sources &amp; Code
          </p>
          <div className="mt-4 grid gap-3 text-sm text-[var(--ink-soft)]">
            <a
              href="https://github.com/keepittechie/equitystack"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white"
            >
              GitHub Repository
            </a>
            <Link href="/sources" className="hover:text-white">Data Sources</Link>
            <a
              href="https://www.congress.gov/"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white"
            >
              Congress.gov
            </a>
            <a
              href="https://www.archives.gov/"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white"
            >
              National Archives
            </a>
          </div>
        </nav>

        <section
          aria-labelledby="footer-branding-title"
          className="max-w-xl rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.72)] p-6 text-left"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
            Branding
          </p>
          <h2 id="footer-branding-title" className="mt-4 text-2xl font-semibold text-white">
            EquityStack
          </h2>
          <p className="mt-4 max-w-[36rem] text-sm leading-7 text-[var(--ink-soft)]">
            EquityStack is a data-driven platform for tracking laws, court cases,
            executive actions, and future legislation affecting Black communities in
            the United States. The project connects policy history, evidence, and
            legislative tracking in one place.
          </p>
        </section>
      </div>
    </footer>
  );
}
