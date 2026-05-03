"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Panel, StatusPill } from "@/app/components/dashboard/primitives";
import SystemBreakdownArtifact, {
  hasSystemBreakdownArtifact,
} from "@/app/components/evidence/SystemBreakdownArtifact";

const VISUAL_META = {
  map: {
    label: "Map evidence",
    tone: "info",
  },
  chart: {
    label: "Impact chart",
    tone: "info",
  },
  "source-snapshot": {
    label: "Primary source",
    tone: "verified",
  },
  "system-breakdown": {
    label: "System breakdown",
    tone: "default",
  },
  entity: {
    label: "Entity visual",
    tone: "default",
  },
};

function formatSourceType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "";

  const labels = {
    government: "Government",
    academic: "Academic",
    "primary-data": "Primary data",
    legal: "Legal",
    "secondary-analysis": "Secondary analysis",
  };

  return labels[normalized] || normalized;
}

function getPreviewImageClass(type) {
  if (type === "chart") {
    return "block h-auto max-h-[13rem] w-auto max-w-full object-contain sm:max-h-[15rem] lg:max-h-[17rem]";
  }

  if (type === "entity") {
    return "block h-auto max-h-[14rem] w-auto max-w-full object-contain sm:max-h-[16rem] lg:max-h-[18rem]";
  }

  if (type === "source-snapshot") {
    return "block h-auto max-h-[14rem] w-auto max-w-full object-contain sm:max-h-[16rem] lg:max-h-[18rem]";
  }

  if (type === "map") {
    return "block h-auto max-h-[14rem] w-auto max-w-full object-contain sm:max-h-[16rem] lg:max-h-[18rem]";
  }

  return "block h-auto max-h-[14rem] w-auto max-w-full object-contain sm:max-h-[16rem] lg:max-h-[18rem]";
}

function getPreviewWidthClass(type) {
  if (type === "map") {
    return "mx-auto w-full max-w-4xl";
  }

  if (type === "source-snapshot") {
    return "mx-auto w-full max-w-2xl";
  }

  if (type === "entity") {
    return "mx-auto w-full max-w-xl";
  }

  if (type === "system-breakdown") {
    return "mx-auto w-full max-w-3xl";
  }

  return "mx-auto w-full max-w-3xl";
}

function RasterEvidenceImage({ item, expanded = false }) {
  return (
    <div className={expanded ? "mx-auto w-full max-w-6xl" : "w-full"}>
      <div
        className={`overflow-hidden rounded-xl border border-[var(--line)] bg-[rgba(7,14,23,0.94)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${
          expanded ? "max-h-[82vh] max-w-[92vw]" : ""
        }`}
      >
        <div
          className={`relative ${
            expanded
              ? "flex max-h-[82vh] items-center justify-center overflow-auto p-2 md:p-3"
              : "flex items-center justify-center p-2 md:p-3"
          }`}
        >
          <Image
            src={item.image}
            alt={item.alt}
            width={1600}
            height={900}
            sizes={
              expanded
                ? "92vw"
                : "(min-width: 1536px) 720px, (min-width: 1280px) 660px, (min-width: 768px) calc(100vw - 12rem), calc(100vw - 5rem)"
            }
            quality={85}
            className={
              expanded
                ? "block h-auto max-h-[78vh] w-auto max-w-full object-contain"
                : getPreviewImageClass(item.type)
            }
          />
          {expanded ? null : (
            <span className="pointer-events-none absolute bottom-3 right-3 rounded-full border border-[rgba(12,18,28,0.18)] bg-[rgba(6,10,18,0.78)] px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-white shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
              Open full size
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function EvidenceSurface({ item, usesStructuredSystemBreakdown, expanded = false }) {
  if (usesStructuredSystemBreakdown) {
    return (
      <div className={expanded ? "mx-auto w-full max-w-5xl" : getPreviewWidthClass(item.type)}>
        <SystemBreakdownArtifact imagePath={item.image} alt={item.alt} />
      </div>
    );
  }

  return <RasterEvidenceImage item={item} expanded={expanded} />;
}

export default function VisualEvidenceBlock({ items = [], className = "" }) {
  const [expandedItem, setExpandedItem] = useState(null);

  useEffect(() => {
    if (!expandedItem) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setExpandedItem(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [expandedItem]);

  if (!items.length) {
    return null;
  }

  const expandedMeta =
    expandedItem && (VISUAL_META[expandedItem.type] || VISUAL_META.chart);
  const expandedUsesStructuredSystemBreakdown =
    expandedItem?.type === "system-breakdown" &&
    hasSystemBreakdownArtifact(expandedItem.image);

  return (
    <>
      <div className={["space-y-4", className].filter(Boolean).join(" ")}>
        {items.map((item) => {
          const meta = VISUAL_META[item.type] || VISUAL_META.chart;
          const usesStructuredSystemBreakdown =
            item.type === "system-breakdown" &&
            hasSystemBreakdownArtifact(item.image);

          return (
            <Panel
              key={`${item.type}-${item.title}-${item.image}`}
              padding="md"
              className="space-y-4 overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                {item.date ? <StatusPill tone="default">{item.date}</StatusPill> : null}
              </div>

              {item.title ? <h3 className="text-xl font-semibold text-white">{item.title}</h3> : null}

              <figure className="space-y-3">
                <button
                  type="button"
                  onClick={() => setExpandedItem(item)}
                  className="group block w-full cursor-zoom-in text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(132,247,198,0.28)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(11,20,33)]"
                  aria-label={`Open larger evidence view: ${item.title || meta.label}`}
                >
                  <EvidenceSurface
                    item={item}
                    usesStructuredSystemBreakdown={usesStructuredSystemBreakdown}
                  />
                </button>

                <figcaption className="space-y-2 text-sm leading-7 text-[var(--ink-soft)]">
                  <p>{item.caption}</p>
                  <p className="text-[12px] leading-6 text-[var(--ink-muted)]">
                    Source:{" "}
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-[var(--ink-soft)] underline-offset-4 hover:text-white hover:underline"
                    >
                      {item.sourceLabel}
                    </a>
                    {item.sourceType ? ` (${formatSourceType(item.sourceType)})` : ""}
                  </p>
                </figcaption>
              </figure>
            </Panel>
          );
        })}
      </div>

      {expandedItem ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(3,8,14,0.88)] p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={expandedItem.title || "Expanded evidence"}
          onClick={() => setExpandedItem(null)}
        >
          <div
            className="max-h-[90vh] max-w-[95vw] overflow-hidden rounded-2xl border border-[var(--line-strong)] bg-[rgba(11,20,33,0.98)] shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
              <div className="min-w-0">
                {expandedMeta ? (
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                    {expandedMeta.label}
                  </p>
                ) : null}
                {expandedItem.title ? (
                  <p className="mt-1 text-sm font-semibold text-white md:text-base">
                    {expandedItem.title}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setExpandedItem(null)}
                className="shrink-0 rounded-md border border-[var(--line)] bg-[rgba(18,31,49,0.52)] px-3 py-2 text-[12px] font-semibold text-white transition-[background-color,border-color] hover:border-[var(--line-strong)] hover:bg-[rgba(18,31,49,0.82)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(132,247,198,0.28)]"
              >
                Close
              </button>
            </div>

            <div className="max-h-[calc(90vh-4.5rem)] overflow-auto p-4">
              <EvidenceSurface
                item={expandedItem}
                usesStructuredSystemBreakdown={expandedUsesStructuredSystemBreakdown}
                expanded
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
