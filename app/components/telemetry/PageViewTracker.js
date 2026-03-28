"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { sendPublicSignal } from "@/lib/public-signals-client";

function deriveRouteContext(pathname) {
  if (pathname.startsWith("/card/future-bill/")) {
    return { route_kind: "card", entity_type: "future-bill", entity_key: pathname.split("/").pop() };
  }
  if (pathname.startsWith("/card/promise/")) {
    return { route_kind: "card", entity_type: "promise", entity_key: pathname.split("/").pop() };
  }
  if (pathname.startsWith("/card/policy/")) {
    return { route_kind: "card", entity_type: "policy", entity_key: pathname.split("/").pop() };
  }
  if (pathname.startsWith("/card/explainer/")) {
    return { route_kind: "card", entity_type: "explainer", entity_key: pathname.split("/").pop() };
  }
  if (pathname.startsWith("/future-bills/")) {
    return { route_kind: "detail", entity_type: "future-bill", entity_key: pathname.split("/").pop() };
  }
  if (pathname.startsWith("/promises/") && !pathname.startsWith("/promises/president/") && pathname !== "/promises" && pathname !== "/promises/all") {
    return { route_kind: "detail", entity_type: "promise", entity_key: pathname.split("/").pop() };
  }
  if (pathname.startsWith("/policies/") && pathname !== "/policies") {
    return { route_kind: "detail", entity_type: "policy", entity_key: pathname.split("/").pop() };
  }
  if (pathname.startsWith("/explainers/") && pathname !== "/explainers") {
    return { route_kind: "detail", entity_type: "explainer", entity_key: pathname.split("/").pop() };
  }
  if (pathname.startsWith("/reports/black-impact-score")) {
    return { route_kind: "report", entity_type: "impact-score", entity_key: "black-impact-score" };
  }

  return { route_kind: "page", entity_type: null, entity_key: null };
}

export default function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedRef = useRef(null);

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) {
      return;
    }

    const search = searchParams?.toString();
    const pagePath = search ? `${pathname}?${search}` : pathname;

    if (lastTrackedRef.current === pagePath) {
      return;
    }

    lastTrackedRef.current = pagePath;

    const routeContext = deriveRouteContext(pathname);

    sendPublicSignal({
      event_type: "page_view",
      page_path: pagePath,
      ...routeContext,
      metadata: search
        ? {
            search,
          }
        : null,
    });
  }, [pathname, searchParams]);

  return null;
}
