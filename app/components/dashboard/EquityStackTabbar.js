"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

function parseHref(href) {
  const [pathPart, hashPart] = String(href || "").split("#");
  return {
    path: pathPart || "",
    hash: hashPart ? `#${hashPart}` : "",
  };
}

function readCurrentHash() {
  if (typeof window === "undefined") {
    return "";
  }
  return window.location.hash || "";
}

function isTabActive({ href, pathname, currentHash, defaultHref }) {
  const target = parseHref(href);
  const fallback = parseHref(defaultHref);
  const matchesPath = !target.path || target.path === pathname;

  if (!matchesPath) {
    return false;
  }

  if (target.hash) {
    if (currentHash) {
      return target.hash === currentHash;
    }
    return target.hash === fallback.hash;
  }

  return target.path === pathname;
}

export default function EquityStackTabbar({
  items = [],
  ariaLabel = "Local navigation",
  defaultHref = "",
  className = "",
}) {
  const pathname = usePathname();
  const [currentHash, setCurrentHash] = useState("");
  const tabRefs = useRef(new Map());

  useEffect(() => {
    const syncHash = () => setCurrentHash(readCurrentHash());
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [pathname]);

  const normalizedItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        key: item.key || item.href,
        count:
          Number.isFinite(Number(item.count)) && Number(item.count) > 0
            ? Number(item.count)
            : null,
      })),
    [items]
  );

  useEffect(() => {
    const activeItem = normalizedItems.find((item) =>
      isTabActive({
        href: item.href,
        pathname,
        currentHash,
        defaultHref,
      })
    );

    if (!activeItem) {
      return;
    }

    const activeNode = tabRefs.current.get(activeItem.key);
    activeNode?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [currentHash, defaultHref, normalizedItems, pathname]);

  return (
    <nav
      aria-label={ariaLabel}
      className={`-mx-1 overflow-x-auto px-1 pb-0.5 thin-scrollbar overscroll-x-contain ${className}`}
    >
      <div className="inline-flex min-w-full items-center gap-1 rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-1">
        {normalizedItems.map((item) => {
          const active = isTabActive({
            href: item.href,
            pathname,
            currentHash,
            defaultHref,
          });

          const tabContent = (
            <>
              <span className="whitespace-nowrap leading-none">{item.label}</span>
              {item.count != null ? (
                <span
                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums leading-none ${
                    active
                      ? "bg-[rgba(132,247,198,0.12)] text-[var(--accent)]"
                      : "bg-[rgba(18,31,49,0.52)] text-[var(--ink-muted)]"
                  }`}
                >
                  {item.count}
                </span>
              ) : null}
            </>
          );

          const className = `inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md border px-3 text-[12px] font-medium transition-[background-color,border-color,box-shadow,color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(132,247,198,0.24)] focus-visible:ring-offset-1 focus-visible:ring-offset-[rgb(11,20,33)] ${
            active
              ? "border-[rgba(132,247,198,0.24)] bg-[rgba(18,31,49,0.78)] text-white"
              : "border-transparent text-[var(--ink-muted)] hover:border-[rgba(255,255,255,0.08)] hover:bg-[rgba(18,31,49,0.56)] hover:text-[var(--ink-soft)]"
          }`;

          if (String(item.href || "").startsWith("#")) {
            return (
              <a
                key={item.key}
                href={item.href}
                className={className}
                aria-current={active ? "location" : undefined}
                ref={(node) => {
                  if (node) {
                    tabRefs.current.set(item.key, node);
                  } else {
                    tabRefs.current.delete(item.key);
                  }
                }}
              >
                {tabContent}
              </a>
            );
          }

          return (
            <Link
              key={item.key}
              href={item.href}
              className={className}
              aria-current={active ? "page" : undefined}
              ref={(node) => {
                if (node) {
                  tabRefs.current.set(item.key, node);
                } else {
                  tabRefs.current.delete(item.key);
                }
              }}
            >
              {tabContent}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
