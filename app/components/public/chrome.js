"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getResearchNavItems } from "@/lib/thematic-pages";

const PRIMARY_NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/start-here", label: "Start Here" },
  { href: "/policies", label: "Policies" },
  { href: "/bills", label: "Bills" },
  { href: "/presidents", label: "Presidents" },
  { href: "/promises", label: "Promises" },
  { href: "/reports", label: "Reports" },
];

const RESEARCH_NAV_ITEMS = [
  {
    href: "/research",
    label: "Research Hub",
    description:
      "Start with a curated gateway to EquityStack’s strongest thematic guides, reports, explainers, and methods.",
  },
  ...getResearchNavItems().map((item) => ({
    href: item.path,
    label: item.label,
    description: item.navDescription,
  })),
  {
    href: "/research/how-black-impact-score-works",
    label: "How the Score Works",
    description:
      "Read the public explanation of what the Black Impact Score measures, how it is calculated, and what it excludes.",
  },
  {
    href: "/reports/civil-rights-timeline",
    label: "Civil-Rights Timeline",
    description:
      "Follow laws, court decisions, and policy change across time when chronology matters most.",
  },
];

const RESEARCH_HUB_ITEM = RESEARCH_NAV_ITEMS[0];
const IMPACT_ANALYSIS_ITEMS = RESEARCH_NAV_ITEMS.slice(1, -2);
const RESEARCH_EXTRA_ITEMS = RESEARCH_NAV_ITEMS.slice(-2);

const HEADER_UTILITY_LINKS = [
  { href: "/about", label: "About" },
  { href: "/start", label: "How to Use" },
  { href: "/methodology", label: "Methodology" },
  { href: "/glossary", label: "Glossary" },
];

const FOOTER_RESEARCH_LINKS = [
  { href: "/research", label: "Research Hub" },
  { href: "/presidents", label: "Presidents" },
  { href: "/policies", label: "Policies" },
  { href: "/bills", label: "Bills" },
  { href: "/promises", label: "Promises" },
  { href: "/reports", label: "Reports" },
  { href: "/explainers", label: "Explainers" },
  { href: "/narratives", label: "Narratives" },
];

const FOOTER_GUIDE_LINKS = [
  { href: "/start", label: "How to Use EquityStack" },
  {
    href: "/research/how-black-impact-score-works",
    label: "How the Black Impact Score Works",
  },
  { href: "/methodology", label: "Methodology" },
  { href: "/glossary", label: "Glossary" },
  { href: "/sources", label: "Sources" },
  { href: "/about", label: "About" },
];

const FOOTER_ANALYSIS_LINKS = getResearchNavItems().map((item) => ({
  href: item.path,
  label: item.label,
}));

const FOOTER_REFERENCE_LINKS = [
  { href: "/reports/civil-rights-timeline", label: "Civil-Rights Timeline" },
  { href: "/scorecards", label: "Scorecards" },
  { href: "/current-administration", label: "Current Administration" },
  { href: "/future-bills", label: "Future Bills" },
  { href: "/activity", label: "Activity" },
];

function isActive(pathname, href) {
  const hrefPath = String(href || "").split("#")[0] || "/";

  if (hrefPath === "/") {
    return pathname === "/";
  }

  return pathname === hrefPath || pathname?.startsWith(`${hrefPath}/`);
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

function ChevronDownIcon({ open = false }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function desktopNavItemClass(active = false) {
  return [
    "inline-flex min-h-8 items-center rounded-md border px-2 py-1.5 text-[12.5px] font-medium transition-[background-color,border-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(132,247,198,0.22)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(11,20,33,0.96)]",
    active
      ? "border-[var(--line)] bg-[rgba(132,247,198,0.07)] text-[rgba(255,255,255,0.96)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
      : "border-transparent bg-transparent text-[var(--ink-muted)] hover:border-white/8 hover:bg-white/[0.045] hover:text-[var(--ink-soft)]",
  ].join(" ");
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
  const [researchOpenForPath, setResearchOpenForPath] = useState(null);
  const researchMenuRef = useRef(null);
  const researchActive = RESEARCH_NAV_ITEMS.some((item) => isActive(pathname, item.href));
  const researchOpen = researchOpenForPath === pathname;

  useEffect(() => {
    if (mobile || !researchOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!researchMenuRef.current?.contains(event.target)) {
        setResearchOpenForPath(null);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setResearchOpenForPath(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobile, researchOpen]);

  return (
    <nav
      aria-label={mobile ? "Mobile primary navigation" : "Primary navigation"}
      className={
        mobile
          ? "grid gap-2"
          : "hidden shrink-0 items-center justify-center xl:flex xl:flex-nowrap"
      }
    >
      {!mobile ? (
        <div className="inline-flex items-center gap-0 rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.9)] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
          {PRIMARY_NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={desktopNavItemClass(active)}
              >
                {item.label}
              </Link>
            );
          })}

          <div ref={researchMenuRef} className="relative overflow-visible">
            <button
              type="button"
              aria-haspopup="menu"
              aria-controls="desktop-research-menu"
              aria-expanded={researchOpen}
              onClick={() =>
                setResearchOpenForPath((value) => (value === pathname ? null : pathname || "/"))
              }
              className={desktopNavItemClass(researchActive)}
            >
              Research
              <ChevronDownIcon open={researchOpen} />
            </button>
            {researchOpen ? (
              <div
                id="desktop-research-menu"
                className="absolute left-1/2 top-full z-[60] w-[24rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 pt-3 pointer-events-auto"
              >
                <div className="rounded-[1.6rem] border border-white/10 bg-[rgba(5,11,19,0.98)] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.34)] backdrop-blur-xl">
                  <div className="max-h-[min(70vh,36rem)] overflow-y-auto overscroll-contain pr-1 pb-2">
                    <div className="space-y-4">
                      <div className="grid gap-2">
                        <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                          Research hub
                        </p>
                        <Link
                          href={RESEARCH_HUB_ITEM.href}
                          aria-current={
                            isActive(pathname, RESEARCH_HUB_ITEM.href) ? "page" : undefined
                          }
                          className={`rounded-[1.2rem] border px-4 py-4 ${
                            isActive(pathname, RESEARCH_HUB_ITEM.href)
                              ? "border-[rgba(132,247,198,0.28)] bg-[rgba(132,247,198,0.12)]"
                              : "border-white/8 bg-white/5 hover:border-[rgba(132,247,198,0.2)]"
                          }`}
                        >
                          <p className="text-sm font-medium text-white">
                            {RESEARCH_HUB_ITEM.label}
                          </p>
                          <p className="mt-1 text-sm leading-6 text-[var(--ink-soft)]">
                            {RESEARCH_HUB_ITEM.description}
                          </p>
                        </Link>
                      </div>
                      <div className="grid gap-2">
                        <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                          Impact analysis
                        </p>
                        {IMPACT_ANALYSIS_ITEMS.map((item) => {
                          const active = isActive(pathname, item.href);
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              aria-current={active ? "page" : undefined}
                              className={`rounded-[1.2rem] border px-4 py-4 ${
                                active
                                  ? "border-[rgba(132,247,198,0.28)] bg-[rgba(132,247,198,0.12)]"
                                  : "border-white/8 bg-white/5 hover:border-[rgba(132,247,198,0.2)]"
                              }`}
                            >
                              <p className="text-sm font-medium text-white">
                                {item.label}
                              </p>
                              <p className="mt-1 text-sm leading-6 text-[var(--ink-soft)]">
                                {item.description}
                              </p>
                            </Link>
                          );
                        })}
                      </div>
                      <div className="grid gap-2">
                        <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                          Reference pages
                        </p>
                        {RESEARCH_EXTRA_ITEMS.map((item) => {
                          const active = isActive(pathname, item.href);
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              aria-current={active ? "page" : undefined}
                              className={`rounded-[1.2rem] border px-4 py-4 ${
                                active
                                  ? "border-[rgba(132,247,198,0.28)] bg-[rgba(132,247,198,0.12)]"
                                  : "border-white/8 bg-white/5 hover:border-[rgba(132,247,198,0.2)]"
                              }`}
                            >
                              <p className="text-sm font-medium text-white">
                                {item.label}
                              </p>
                              <p className="mt-1 text-sm leading-6 text-[var(--ink-soft)]">
                                {item.description}
                              </p>
                            </Link>
                          );
                        })}
                      </div>
                      <div
                        aria-hidden="true"
                        className="pointer-events-none sticky bottom-0 h-6 bg-gradient-to-b from-transparent to-[rgba(5,11,19,0.98)]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {PRIMARY_NAV_ITEMS.map((item) => {
        if (!mobile) {
          return null;
        }
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-3 py-2 text-sm font-medium ${
              active
                ? "bg-[var(--accent)] text-[#04131d]"
                : "text-[var(--ink-soft)] hover:bg-white/6 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        );
      })}

      {mobile ? (
        <div className="w-full rounded-[1.4rem] border border-white/8 bg-white/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
                Research
              </p>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">
                Thematic guides and historical reading paths.
              </p>
            </div>
          </div>
          <div className="mt-3 overflow-hidden">
            <div className="max-h-[min(82vh,42rem)] overflow-y-auto overscroll-contain pr-1 pb-2">
              <div className="space-y-4">
                <div className="grid gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                    Research hub
                  </p>
                  <Link
                    href={RESEARCH_HUB_ITEM.href}
                    aria-current={
                      isActive(pathname, RESEARCH_HUB_ITEM.href) ? "page" : undefined
                    }
                    className={`rounded-[1.1rem] border px-4 py-3 ${
                      isActive(pathname, RESEARCH_HUB_ITEM.href)
                        ? "border-[rgba(132,247,198,0.3)] bg-[rgba(132,247,198,0.12)] text-white"
                        : "border-white/8 bg-white/5 text-[var(--ink-soft)] hover:border-white/14 hover:text-white"
                    }`}
                  >
                    <p className="text-sm font-medium">{RESEARCH_HUB_ITEM.label}</p>
                    <p className="mt-1 text-xs leading-6 text-[var(--ink-muted)]">
                      {RESEARCH_HUB_ITEM.description}
                    </p>
                  </Link>
                </div>
                <div className="grid gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                    Impact analysis
                  </p>
                  {IMPACT_ANALYSIS_ITEMS.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`rounded-[1.1rem] border px-4 py-3 ${
                          active
                            ? "border-[rgba(132,247,198,0.3)] bg-[rgba(132,247,198,0.12)] text-white"
                            : "border-white/8 bg-white/5 text-[var(--ink-soft)] hover:border-white/14 hover:text-white"
                        }`}
                      >
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="mt-1 text-xs leading-6 text-[var(--ink-muted)]">
                          {item.description}
                        </p>
                      </Link>
                    );
                  })}
                </div>
                <div className="grid gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                    Reference pages
                  </p>
                  {RESEARCH_EXTRA_ITEMS.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`rounded-[1.1rem] border px-4 py-3 ${
                          active
                            ? "border-[rgba(132,247,198,0.3)] bg-[rgba(132,247,198,0.12)] text-white"
                            : "border-white/8 bg-white/5 text-[var(--ink-soft)] hover:border-white/14 hover:text-white"
                        }`}
                      >
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="mt-1 text-xs leading-6 text-[var(--ink-muted)]">
                          {item.description}
                        </p>
                      </Link>
                    );
                  })}
                </div>
                <div
                  aria-hidden="true"
                  className="pointer-events-none sticky bottom-0 h-6 bg-gradient-to-b from-transparent to-[rgba(8,14,24,0.96)]"
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
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
      <div className="mx-auto max-w-[1500px] px-5 py-3 xl:px-8">
        <div className="relative flex min-w-0 items-center gap-3 xl:min-h-[3.5rem]">
          <div className="hidden min-w-0 items-center xl:flex">
            <div className="min-w-0 xl:max-w-[280px] 2xl:max-w-[320px]">
              <Link
                href="/"
                className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5"
              >
                <div className="relative row-span-2 h-10 w-10 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[rgba(17,29,46,0.9)] shadow-[0_12px_30px_rgba(0,0,0,0.25)] xl:h-11 xl:w-11">
                  <Image
                    src="/logo.png"
                    alt="EquityStack"
                    fill
                    className="object-contain p-1.5"
                    priority
                  />
                </div>
                <p className="min-w-0 self-center text-[13px] font-semibold uppercase tracking-[0.28em] text-[var(--accent)] md:text-[14px] xl:text-[15px]">
                  EquityStack
                </p>
                <p className="hidden min-w-0 max-w-[17rem] text-[11px] leading-[1.35] text-[var(--ink-muted)] sm:block xl:max-w-[14.5rem] 2xl:max-w-[16rem]">
                  Civic intelligence for Black policy impact
                </p>
              </Link>
            </div>

            <div className="ml-6 2xl:ml-8">
              <PrimaryNav />
            </div>
          </div>

          <div className="min-w-0 flex-1 xl:hidden">
            <Link
              href="/"
              className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5"
            >
              <div className="relative row-span-2 h-10 w-10 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[rgba(17,29,46,0.9)] shadow-[0_12px_30px_rgba(0,0,0,0.25)] xl:h-11 xl:w-11">
                <Image
                  src="/logo.png"
                  alt="EquityStack"
                  fill
                  className="object-contain p-1.5"
                  priority
                />
              </div>
              <p className="min-w-0 self-center text-[13px] font-semibold uppercase tracking-[0.28em] text-[var(--accent)] md:text-[14px] xl:text-[15px]">
                EquityStack
              </p>
              <p className="hidden min-w-0 max-w-[17rem] text-[11px] leading-[1.35] text-[var(--ink-muted)] sm:block xl:max-w-[14.5rem] 2xl:max-w-[16rem]">
                Civic intelligence for Black policy impact
              </p>
            </Link>
          </div>

          <div className="ml-auto flex min-w-0 items-center justify-end gap-2 md:gap-3 xl:w-auto xl:flex-nowrap xl:gap-2">
            <div className="hidden min-w-0 flex-none xl:flex xl:w-[264px] 2xl:w-[320px]">
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
              className="hidden shrink-0 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white hover:border-white/20 hover:bg-white/6 md:inline-flex xl:hidden"
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

            <Link
              href="/dashboard"
              className="hidden xl:inline-flex xl:shrink-0 xl:rounded-full xl:border xl:border-white/10 xl:px-3 xl:py-2 xl:text-sm xl:font-medium xl:text-white xl:hover:border-white/20 xl:hover:bg-white/6"
            >
              Open Data Center
            </Link>
          </div>
        </div>

        {searchOpen || menuOpen ? (
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
                  {HEADER_UTILITY_LINKS.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="rounded-2xl px-1 py-2 hover:text-white"
                    >
                      {item.label}
                    </Link>
                  ))}
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
    <nav
      aria-label="Breadcrumb"
      className="mb-4 flex flex-wrap items-center gap-2 text-sm text-[var(--ink-muted)]"
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span
            key={`${item.href || item.label}-${index}`}
            className="inline-flex items-center gap-2"
          >
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
      <div className="mx-auto grid max-w-[1500px] gap-10 px-5 py-12 text-left md:grid-cols-2 xl:grid-cols-[0.95fr_0.95fr_1fr_0.95fr_0.95fr] xl:px-8">
        <nav aria-label="Research and explore footer links" className="min-w-0 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
            Research / Explore
          </p>
          <div className="mt-4 grid gap-3 text-sm text-[var(--ink-soft)]">
            {FOOTER_RESEARCH_LINKS.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-white">
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        <nav aria-label="Guides and understanding footer links" className="min-w-0 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
            Guides / Understanding
          </p>
          <div className="mt-4 grid gap-3 text-sm text-[var(--ink-soft)]">
            {FOOTER_GUIDE_LINKS.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-white">
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        <nav aria-label="Impact analysis footer links" className="min-w-0 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
            Impact Analysis
          </p>
          <div className="mt-4 grid gap-3 text-sm text-[var(--ink-soft)]">
            {FOOTER_ANALYSIS_LINKS.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-white">
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        <nav aria-label="Reference routes footer links" className="min-w-0 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
            Reference Paths
          </p>
          <div className="mt-4 grid gap-3 text-sm text-[var(--ink-soft)]">
            {FOOTER_REFERENCE_LINKS.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-white">
                {item.label}
              </Link>
            ))}
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
            <Link href="/sources" className="hover:text-white">
              Data Sources
            </Link>
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
      </div>
      <div className="mx-auto max-w-[1500px] px-5 pb-12 xl:px-8">
        <section
          aria-labelledby="footer-branding-title"
          className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.72)] p-6 text-left"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
            EquityStack
          </p>
          <h2 id="footer-branding-title" className="mt-4 text-2xl font-semibold text-white">
            Public research on presidents, policy, and Black Americans
          </h2>
          <p className="mt-4 max-w-[52rem] text-sm leading-7 text-[var(--ink-soft)]">
            EquityStack connects presidential records, policy history, legislation,
            promises, reports, explainers, methodology, sources, and thematic
            analysis in one public-interest research platform. The site is
            designed to help readers move from broad questions into evidence,
            context, and comparison without losing track of how the public record
            is organized.
          </p>
        </section>
      </div>
    </footer>
  );
}
