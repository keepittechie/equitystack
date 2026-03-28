"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/start", label: "Start Here" },
  { href: "/reports/black-impact-score", label: "Impact Score" },
  { href: "/current-administration", label: "Current Administration" },
  { href: "/reports", label: "Reports" },
  { href: "/future-bills", label: "Future Bills" },
  { href: "/promises", label: "Promise Tracker" },
  { href: "/reports/civil-rights-timeline", label: "Civil Rights Timeline" },
];

const ADMIN_NAV_LINKS = [
  { href: "/admin", label: "Admin Hub" },
  { href: "/admin/review", label: "Policy Review" },
  { href: "/admin/promises/current-administration", label: "Staging Intake" },
  { href: "/admin/logout", label: "Logout", external: true },
];

function isActiveNavItem(pathname, href) {
  return href === "/"
    ? pathname === "/"
    : href === "/reports"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);
}

function navClasses(pathname, href) {
  const isActive = isActiveNavItem(pathname, href);

  return isActive
    ? "rounded-full bg-[rgba(138,59,18,0.1)] px-4 py-2 text-[var(--accent)] font-semibold"
    : "rounded-full px-4 py-2 text-[var(--ink-soft)] hover:bg-white/70 hover:text-[var(--accent)]";
}

export default function MainLayout({ children }) {
  const pathname = usePathname();
  const isAdminPath = pathname?.startsWith("/admin");
  const navLinks = isAdminPath ? ADMIN_NAV_LINKS : NAV_LINKS;

  function renderNavItem(item, className) {
    if (item.external) {
      return (
        <a key={item.href} href={item.href} className={className}>
          {item.label}
        </a>
      );
    }

    return (
      <Link key={item.href} href={item.href} className={className}>
        {item.label}
      </Link>
    );
  }

  return (
    <div className="page-shell min-h-screen text-gray-900 flex flex-col">
      <header className="sticky top-0 z-50 border-b soft-rule bg-[rgba(252,248,241,0.9)] backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-3 flex justify-between items-center gap-6">
            <div className="flex flex-col items-start justify-center min-w-[180px]">
              <span className="eyebrow mb-2">{isAdminPath ? "EquityStack Admin" : "EquityStack"}</span>
              <Link href="/" className="block leading-none">
                <Image
                  src="/logo-v2.png"
                  alt="EquityStack"
                  width={170}
                  height={70}
                  className="object-contain h-[44px] w-auto"
                  priority
                />
              </Link>
              <span className="text-[10px] tracking-[0.2em] text-[var(--ink-soft)] mt-1 pl-1 uppercase">
                {isAdminPath ? "Admin • Review • Workflow" : "Policy • History • Impact"}
              </span>
            </div>
            <nav
              aria-label={isAdminPath ? "Admin" : "Primary"}
              className="hidden md:flex flex-wrap gap-1 text-[12px] font-medium items-center"
            >
              {navLinks.map((item) => (
                renderNavItem(item, navClasses(pathname, item.href))
              ))}
            </nav>
          </div>

        <div className="border-t soft-rule md:hidden">
          <nav aria-label={isAdminPath ? "Admin mobile" : "Mobile"} className="max-w-7xl mx-auto px-4 py-2">
            <div className="flex gap-2 overflow-x-auto">
              {navLinks.map((item) =>
                renderNavItem(
                  item,
                  `whitespace-nowrap rounded-full border px-3 py-2 text-sm ${
                    isActiveNavItem(pathname, item.href)
                      ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                      : "bg-white/70 text-[var(--ink-soft)] border-[rgba(120,53,15,0.12)]"
                  }`
                )
              )}
            </div>
          </nav>
        </div>
      </header>

      <div className="content-shell flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        {children}
      </div>

      <footer className="mt-12 px-4 pb-6 sm:px-6">
        <div className="card-surface-strong max-w-7xl mx-auto rounded-[1.75rem] overflow-hidden">
          <div className="px-6 py-10 grid gap-8 md:grid-cols-3">
            <div>
              <Link href="/" className="block leading-none">
                <Image
                  src="/logo-v2.png"
                  alt="EquityStack"
                  width={170}
                  height={70}
                  className="object-contain h-[56px] w-auto"
                />
              </Link>
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)] mb-3 mt-5">
                EquityStack
              </h3>
              <p className="text-sm text-[var(--ink-soft)] leading-6 max-w-sm">
                EquityStack is a data-driven platform for tracking laws, court cases,
                executive actions, and future legislation affecting Black communities
                in the United States. The project connects policy history, evidence,
                and legislative tracking in one place.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)] mb-3">
                Project
              </h3>
              <div className="flex flex-col gap-2 text-sm">
                <Link href="/start" className="text-[var(--ink-soft)] hover:text-[var(--accent)]">
                  Start Here
                </Link>
                <Link href="/explainers" className="text-[var(--ink-soft)] hover:text-[var(--accent)]">
                  Explainers
                </Link>
                <Link href="/scorecards" className="text-[var(--ink-soft)] hover:text-[var(--accent)]">
                  Scorecards
                </Link>
                <Link href="/methodology" className="text-[var(--ink-soft)] hover:text-[var(--accent)]">
                  Methodology
                </Link>
                <Link href="/reports" className="text-[var(--ink-soft)] hover:text-[var(--accent)]">
                  Reports
                </Link>
                <Link href="/promises" className="text-[var(--ink-soft)] hover:text-[var(--accent)]">
                  Promise Tracker
                </Link>
                <Link href="/current-administration" className="text-[var(--ink-soft)] hover:text-[var(--accent)]">
                  Current Administration
                </Link>
                <Link href="/future-bills" className="text-[var(--ink-soft)] hover:text-[var(--accent)]">
                  Future Bills
                </Link>
                <Link href="/activity" className="text-[var(--ink-soft)] hover:text-[var(--accent)]">
                  Activity
                </Link>
                <Link href="/policies" className="text-[var(--ink-soft)] hover:text-[var(--accent)]">
                  Policies
                </Link>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)] mb-3">
                Sources & Code
              </h3>
              <div className="flex flex-col gap-2 text-sm">
                <a
                  href="https://github.com/keepittechie/equitystack"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--ink-soft)] hover:text-[var(--accent)]"
                >
                  GitHub Repository
                </a>
                <Link href="/methodology" className="text-[var(--ink-soft)] hover:text-[var(--accent)]">
                  Data Sources
                </Link>
                <a
                  href="https://www.congress.gov/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--ink-soft)] hover:text-[var(--accent)]"
                >
                  Congress.gov
                </a>
                <a
                  href="https://www.archives.gov/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--ink-soft)] hover:text-[var(--accent)]"
                >
                  National Archives
                </a>
              </div>
            </div>
          </div>
          <div className="border-t soft-rule px-6 py-4 text-sm text-[var(--ink-soft)] flex flex-col sm:flex-row justify-between gap-2">
            <p>© 2026 EquityStack. All rights reserved.</p>
            <p>Tracking policy. Revealing impact.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
