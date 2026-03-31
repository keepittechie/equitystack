"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/command", label: "Command" },
  { href: "/admin/jobs", label: "Jobs" },
  { href: "/admin/workflows", label: "Sessions" },
  { href: "/admin/review-queue", label: "Review Queue" },
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
    <nav className="border-b border-zinc-300 bg-zinc-50">
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
                    ? "rounded border border-zinc-800 bg-zinc-800 px-2 py-1 text-[12px] font-medium text-white"
                    : "rounded border border-zinc-300 bg-white px-2 py-1 text-[12px] text-zinc-700 hover:bg-zinc-100"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] text-zinc-600">
          <span className="rounded border border-zinc-300 bg-white px-2 py-1">legacy admin routes hidden from nav</span>
          <span className="rounded border border-zinc-300 bg-white px-2 py-1">canonical review pages kept for workflow checkpoints</span>
        </div>
      </div>
    </nav>
  );
}
