"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const PRIMARY_NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/policies", label: "Policies" },
  { href: "/bills", label: "Bills" },
  { href: "/presidents", label: "Presidents" },
  { href: "/promises", label: "Promises" },
  { href: "/reports", label: "Reports" },
  { href: "/timeline", label: "Timeline" },
];

function isActive(pathname, href) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname?.startsWith(`${href}/`);
}

function SearchIcon() {
  return (
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
  );
}

function MenuIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4 text-[var(--ink-soft)]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4 text-[var(--ink-soft)]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

export function GlobalSearch({
  compact = false,
  expanded = false,
  idSuffix = "full",
  placeholder = "Search the public dataset",
  className = "",
}) {
  return (
    <form
      action="/search"
      method="GET"
      aria-label="Search EquityStack"
      className={`flex items-center gap-2 rounded-full border border-white/10 bg-white/5 shadow-[0_16px_36px_rgba(0,0,0,0.18)] ${
        compact ? "px-3 py-2" : "px-4 py-3"
      } ${expanded ? "w-full" : ""} ${className} transition-[border-color,background-color,transform] focus-within:border-[rgba(132,247,198,0.32)] focus-within:bg-white/8`}
    >
      <label htmlFor={`global-search-${idSuffix}`} className="sr-only">
        Search policies, presidents, promises, reports, and sources
      </label>
      <SearchIcon />
      <input
        id={`global-search-${idSuffix}`}
        type="search"
        name="q"
        placeholder={placeholder}
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
      className={mobile ? "grid gap-2" : "hidden shrink-0 items-center justify-center gap-1 xl:flex xl:flex-nowrap 2xl:gap-1.5"}
    >
      {PRIMARY_NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-3 py-2 text-sm font-medium xl:px-3.5 2xl:px-4 ${
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setMenuOpen(false);
      setSearchOpen(false);
    });
  }, [pathname]);

  if (pathname?.startsWith("/admin")) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/8 bg-[rgba(4,10,18,0.88)] backdrop-blur-xl">
      <div className="mx-auto max-w-[1500px] px-5 py-4 xl:px-8">
        <div className="flex min-w-0 items-center gap-3 xl:grid xl:grid-cols-[minmax(0,280px)_minmax(0,1fr)_minmax(0,420px)] xl:items-center xl:gap-5 2xl:grid-cols-[minmax(0,310px)_minmax(0,1fr)_minmax(0,440px)] 2xl:gap-6">
          <div className="min-w-0 flex-1 xl:max-w-[280px] xl:flex-none 2xl:max-w-[310px]">
            <Link href="/" className="flex min-w-0 items-center gap-3">
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[rgba(17,29,46,0.9)] shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
                <Image src="/logo.png" alt="EquityStack" fill className="object-contain p-1.5" priority />
              </div>
              <div className="min-w-0 xl:max-w-[220px] 2xl:max-w-[250px]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
                  EquityStack
                </p>
                <p className="hidden truncate text-sm text-[var(--ink-muted)] sm:block md:max-w-[16rem] xl:hidden 2xl:block 2xl:max-w-[15rem]">
                  Civic intelligence for Black policy impact
                </p>
              </div>
            </Link>
          </div>

          <div className="hidden min-w-0 xl:flex xl:justify-center xl:px-2 2xl:px-4">
            <PrimaryNav />
          </div>

          <div className="ml-auto flex min-w-0 items-center justify-end gap-2 md:gap-3 xl:ml-0 xl:w-full xl:max-w-[420px] xl:flex-nowrap xl:justify-end 2xl:max-w-[440px]">
            <div className="hidden min-w-0 flex-none xl:flex xl:w-[320px] 2xl:w-[340px]">
              <GlobalSearch
                compact
                idSuffix="desktop"
                placeholder="Search policies, presidents, reports"
                className="w-full"
              />
            </div>

            <button
              type="button"
              aria-label={searchOpen ? "Close search" : "Open search"}
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((value) => !value)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[var(--ink-soft)] hover:border-white/20 hover:bg-white/8 xl:hidden"
            >
              {searchOpen ? <CloseIcon /> : <SearchIcon />}
            </button>

            <Link
              href="/dashboard"
              className="hidden shrink-0 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white hover:border-white/20 hover:bg-white/6 md:inline-flex"
            >
              Open Data Center
            </Link>

            <button
              type="button"
              aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((value) => !value)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[var(--ink-soft)] hover:border-white/20 hover:bg-white/8 xl:hidden"
            >
              {menuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>

        {(searchOpen || menuOpen) ? (
          <div className="mt-4 grid gap-3 border-t border-white/6 pt-4 xl:hidden">
            {searchOpen ? (
              <GlobalSearch
                compact
                expanded
                idSuffix="mobile"
                placeholder="Search policies, presidents, promises, reports"
              />
            ) : null}

            {menuOpen ? (
              <>
                <PrimaryNav mobile />
                <div className="grid gap-2 pt-1 text-sm text-[var(--ink-soft)]">
                  <Link href="/about" className="rounded-2xl px-1 py-2 hover:text-white">
                    About
                  </Link>
                  <Link href="/methodology" className="rounded-2xl px-1 py-2 hover:text-white">
                    Methodology
                  </Link>
                </div>
                <Link
                  href="/dashboard"
                  className="inline-flex w-full items-center justify-center rounded-full border border-white/10 px-4 py-3 text-sm font-medium text-white hover:border-white/20 hover:bg-white/6 md:hidden"
                >
                  Open Data Center
                </Link>
              </>
            ) : null}
          </div>
        ) : null}
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
      <div className="mx-auto grid max-w-[1500px] gap-10 px-5 py-12 text-left md:grid-cols-2 xl:grid-cols-[0.95fr_0.95fr_1.2fr] xl:px-8">
        <nav aria-label="Project footer links" className="min-w-0 text-left">
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
            <Link href="/bills" className="hover:text-white">Bills</Link>
            <Link href="/future-bills" className="hover:text-white">Future Bills</Link>
            <Link href="/activity" className="hover:text-white">Activity</Link>
            <Link href="/policies" className="hover:text-white">Policies</Link>
          </div>
        </nav>

        <nav aria-label="Sources and code footer links" className="min-w-0 text-left">
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
          className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.72)] p-6 text-left md:col-span-2 md:max-w-none xl:col-span-1 xl:max-w-xl"
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
