"use client";

import { useEffect, useRef, useState } from "react";
import { sendPublicSignal } from "@/lib/public-signals-client";

export default function CopyShareLinkButton({
  path,
  defaultLabel = "Copy Link",
  copiedLabel = "Copied",
  trackPayload = null,
}) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    const url = typeof window === "undefined"
      ? path
      : new URL(path, window.location.origin).toString();

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);

      if (trackPayload) {
        sendPublicSignal({
          event_type: "copy_link_click",
          page_path: window.location.pathname + window.location.search,
          ...trackPayload,
          target_path: path,
        });
      }

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-medium text-white hover:border-white/20 hover:bg-white/8"
      aria-live="polite"
    >
      {copied ? copiedLabel : defaultLabel}
    </button>
  );
}
