"use client";

import { useEffect, useRef, useState } from "react";

const RESET_DELAY_MS = 1800;

export default function CopyResponseButton({ text }) {
  const copyText = typeof text === "string" ? text.trim() : "";
  const [status, setStatus] = useState("idle");
  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!copyText) {
    return null;
  }

  function scheduleReset() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setStatus("idle");
    }, RESET_DELAY_MS);
  }

  async function handleCopy() {
    if (!navigator?.clipboard?.writeText) {
      setStatus("failed");
      scheduleReset();
      return;
    }

    try {
      await navigator.clipboard.writeText(copyText);
      setStatus("copied");
      scheduleReset();
    } catch {
      setStatus("failed");
      scheduleReset();
    }
  }

  const label =
    status === "copied"
      ? "Copied"
      : status === "failed"
        ? "Copy failed"
        : "Copy response";

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex min-h-9 items-center justify-center rounded-md border border-[var(--line-strong)] bg-[rgba(18,31,49,0.58)] px-3 text-[12px] font-semibold text-white transition-[background-color,border-color,box-shadow] hover:border-[var(--line-strong)] hover:bg-[rgba(18,31,49,0.86)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(132,247,198,0.28)]"
      aria-label="Copy response text"
      aria-live="polite"
    >
      {label}
    </button>
  );
}
