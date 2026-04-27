"use client";

import { useEffect, useRef, useState } from "react";
import { Panel, StatusPill } from "@/app/components/dashboard/primitives";
import ShareImageButton from "./ShareImageButton";

export default function ShareableResponseCard({
  title,
  text,
  context = null,
  explainerTitle,
  explainerSlug,
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
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);

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
    <Panel as="article" padding="md" className="flex h-full flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <StatusPill tone="info">Shareable response</StatusPill>
          <h3 className="mt-3 text-base font-semibold text-white">{title}</h3>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex min-h-9 items-center justify-center rounded-md border border-[var(--line-strong)] bg-[rgba(18,31,49,0.58)] px-3 text-[12px] font-semibold text-white transition-[background-color,border-color,box-shadow] hover:border-[var(--line-strong)] hover:bg-[rgba(18,31,49,0.86)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(132,247,198,0.28)]"
            aria-live="polite"
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <ShareImageButton
            explainerTitle={explainerTitle}
            explainerSlug={explainerSlug}
            title={title}
            text={text}
            context={context}
          />
        </div>
      </div>
      <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{text}</p>
      {context ? (
        <p className="mt-auto pt-4 text-[12px] leading-5 text-[var(--ink-muted)]">
          {context}
        </p>
      ) : null}
    </Panel>
  );
}
