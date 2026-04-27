"use client";

import { useState } from "react";
import {
  Panel,
  SectionHeader,
  StatusPill,
} from "@/app/components/dashboard/primitives";
import ShareableResponseCard from "./ShareableResponseCard";

export default function ExplainerArgumentModeToggle({
  argumentMode,
  explainerTitle,
  explainerSlug,
}) {
  const [mode, setMode] = useState("explainer");

  if (!argumentMode) {
    return null;
  }

  const isArgumentMode = mode === "argument";
  const keyPoints = argumentMode.keyPoints || [];
  const commonClaims = argumentMode.commonClaims || [];
  const debateLines = argumentMode.debateLines || [];
  const shareCards = argumentMode.shareCards || [];

  return (
    <Panel className="overflow-hidden">
      <SectionHeader
        eyebrow="Debate-ready layer"
        title="Argument mode"
        description="Switch to a condensed version of this explainer for quick claims, responses, questions, and copy-ready lines."
        action={
          <div
            className="inline-flex rounded-md border border-[var(--line)] bg-[rgba(18,31,49,0.58)] p-1"
            role="group"
            aria-label="Explainer display mode"
          >
            {[
              ["explainer", "Explainer view"],
              ["argument", "Argument mode"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                aria-pressed={mode === value}
                className={`inline-flex min-h-8 items-center rounded px-3 text-[12px] font-semibold transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(132,247,198,0.28)] ${
                  mode === value
                    ? "bg-[var(--accent)] text-[#051019]"
                    : "text-[var(--ink-soft)] hover:bg-[rgba(18,31,49,0.86)] hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />

      {isArgumentMode ? (
        <div className="space-y-4 p-4">
          {argumentMode.summary ? (
            <Panel padding="md">
              <StatusPill tone="info">Core argument</StatusPill>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                {argumentMode.summary}
              </p>
            </Panel>
          ) : null}

          {keyPoints.length ? (
            <Panel padding="md">
              <h3 className="text-base font-semibold text-white">Key points</h3>
              <ul className="mt-3 grid gap-2 text-sm leading-7 text-[var(--ink-soft)]">
                {keyPoints.map((item) => (
                  <li key={item} className="rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.42)] px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          {commonClaims.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {commonClaims.map((item, index) => (
                <Panel key={`${item.claim}-${index}`} padding="md" className="h-full">
                  <StatusPill tone="warning">Common claim</StatusPill>
                  <p className="mt-3 text-sm leading-7 text-white">{item.claim}</p>
                  {item.response ? (
                    <>
                      <p className="mt-4 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                        Better response
                      </p>
                      <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                        {item.response}
                      </p>
                    </>
                  ) : null}
                  {item.question ? (
                    <>
                      <p className="mt-4 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                        Key question to ask
                      </p>
                      <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                        {item.question}
                      </p>
                    </>
                  ) : null}
                </Panel>
              ))}
            </div>
          ) : null}

          {debateLines.length ? (
            <Panel padding="md">
              <h3 className="text-base font-semibold text-white">Quick debate lines</h3>
              <div className="mt-3 grid gap-2">
                {debateLines.map((item) => (
                  <p
                    key={item}
                    className="rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.42)] px-3 py-2 text-sm leading-7 text-[var(--ink-soft)]"
                  >
                    {item}
                  </p>
                ))}
              </div>
            </Panel>
          ) : null}

          {shareCards.length ? (
            <div>
              <h3 className="text-base font-semibold text-white">Shareable response cards</h3>
              <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {shareCards.map((item) => (
                  <ShareableResponseCard
                    key={item.title}
                    title={item.title}
                    text={item.text}
                    context={item.context}
                    explainerTitle={explainerTitle}
                    explainerSlug={explainerSlug}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}
