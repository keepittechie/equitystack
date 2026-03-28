"use client";

import Link from "next/link";
import { sendPublicSignal } from "@/lib/public-signals-client";

export default function TrackedLink({
  href,
  eventType = "link_click",
  pagePath,
  routeKind = null,
  entityType = null,
  entityKey = null,
  targetPath = null,
  metadata = null,
  onClick,
  ...props
}) {
  const resolvedTarget = targetPath || (typeof href === "string" ? href : null);

  function handleClick(event) {
    sendPublicSignal({
      event_type: eventType,
      page_path: pagePath || (typeof window !== "undefined" ? window.location.pathname + window.location.search : "/"),
      route_kind: routeKind,
      entity_type: entityType,
      entity_key: entityKey,
      target_path: resolvedTarget,
      metadata,
    });

    if (onClick) {
      onClick(event);
    }
  }

  return <Link href={href} onClick={handleClick} {...props} />;
}
