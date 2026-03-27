"use client";

import { useId, useState } from "react";
import SourceList from "@/app/components/SourceList";

export default function SourceDisclosure({ label = "Sources", sources = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();

  if (!sources.length) {
    return null;
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex items-center rounded-full border border-[rgba(120,53,15,0.14)] bg-white/80 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.12em] text-[var(--ink-soft)] hover:text-[var(--accent)]"
      >
        {isOpen ? "Hide Sources" : "View Sources"}
      </button>

      {isOpen ? (
        <section
          id={panelId}
          className="mt-3 rounded-[1.1rem] border border-[rgba(120,53,15,0.12)] bg-white/75 p-4"
        >
          <h4 className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">{label}</h4>
          <div className="mt-3">
            <SourceList sources={sources} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
