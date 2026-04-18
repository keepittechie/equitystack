"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/command", label: "Command" },
  { href: "/admin/jobs", label: "Jobs" },
  { href: "/admin/workflows", label: "Sessions" },
  { href: "/admin/review-queue", label: "Review Queue" },
  { href: "/admin/source-curation", label: "Source Curation" },
  { href: "/admin/systemic-linkage", label: "Systemic Links" },
  { href: "/admin/artifacts", label: "Artifacts" },
  { href: "/admin/schedules", label: "Schedules" },
  { href: "/admin/tools", label: "Tools" },
];

function isActive(pathname, href) {
  if (href === "/admin") {
    return pathname === "/admin";
  }

  return pathname === href || pathname?.startsWith(`${href}/`);
}

export default function OperatorAdminNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-[var(--admin-line)] bg-[var(--admin-surface-muted)]">
      <div className="mx-auto flex max-w-[1700px] flex-wrap items-center justify-between gap-3 px-4 py-2">
        <div className="flex flex-wrap gap-2">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "rounded border border-[var(--admin-info-line)] bg-[var(--accent-soft)] px-2 py-1 text-[12px] font-medium text-[var(--admin-link)]"
                    : "rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] px-2 py-1 text-[12px] text-[var(--admin-text-soft)] hover:bg-[var(--admin-surface-muted)]"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] text-[var(--admin-text-muted)]">
          <span className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] px-2 py-1">legacy admin routes hidden from nav</span>
          <span className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] px-2 py-1">canonical review pages kept for workflow checkpoints</span>
        </div>
      </div>
    </nav>
  );
}
