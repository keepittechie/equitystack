"use client";

import { useEffect, useRef, useState } from "react";
import {
  Panel,
  SectionHeader,
  StatusPill,
} from "@/app/components/dashboard/primitives";
import ShareableResponseCard from "./ShareableResponseCard";

function buildFullArgumentCopyText({
  argumentMode,
  explainerTitle,
  explainerSlug,
}) {
  const commonClaim = argumentMode.commonClaims?.[0] || null;
  const sourcePath = explainerSlug
    ? `equitystack.org/explainers/${explainerSlug}`
    : "equitystack.org";
  const keyPoints = (argumentMode.keyPoints || [])
    .map((item) => `- ${item}`)
    .join("\n");
  const debateLines = (argumentMode.debateLines || [])
    .map((item) => `- ${item}`)
    .join("\n");

  return [
    `Claim:\n${commonClaim?.claim || explainerTitle || "Public claim"}`,
    `Response:\n${commonClaim?.response || argumentMode.summary || ""}`,
    keyPoints ? `Key point:\n${keyPoints}` : "",
    debateLines ? `Debate lines:\n${debateLines}` : "",
    commonClaim?.question ? `Question:\n${commonClaim.question}` : "",
    `Source:\n${sourcePath}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export default function ExplainerArgumentModeToggle({
  argumentMode,
  argumentReadyBreakdown,
  explainerTitle,
  explainerSlug,
  explainerSummary,
  initialMode = "explainer",
}) {
  const [mode, setMode] = useState(initialMode === "argument" ? "argument" : "explainer");
  const [copyStatus, setCopyStatus] = useState("idle");
  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!argumentMode) {
    return null;
  }

  const isArgumentMode = mode === "argument";
  const keyPoints = argumentMode.keyPoints || [];
  const commonClaims = argumentMode.commonClaims || [];
  const primaryClaim = commonClaims[0] || null;
  const debateLines = argumentMode.debateLines || [];
  const shareCards = argumentMode.shareCards || [];
  const previewPoints = (
    argumentReadyBreakdown?.dataShows?.length
      ? argumentReadyBreakdown.dataShows
      : keyPoints
  ).slice(0, 3);
  const previewAnswer =
    argumentReadyBreakdown?.bottomLine ||
    primaryClaim?.response ||
    argumentMode.summary ||
    explainerSummary ||
    "";
  const previewContext =
    argumentReadyBreakdown?.whyMisleading ||
    argumentMode.summary ||
    "";
  const previewQuestion = primaryClaim?.question || null;
  const fullArgumentText = buildFullArgumentCopyText({
    argumentMode,
    explainerTitle,
    explainerSlug,
  });

  function scheduleCopyReset() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setCopyStatus("idle");
    }, 1800);
  }

  async function handleCopyFullArgument() {
    if (!navigator?.clipboard?.writeText) {
      setCopyStatus("failed");
      scheduleCopyReset();
      return;
    }

    try {
      await navigator.clipboard.writeText(fullArgumentText);
      setCopyStatus("copied");
      scheduleCopyReset();
    } catch {
      setCopyStatus("failed");
      scheduleCopyReset();
    }
  }

  return (
    <Panel className="overflow-hidden">
      <SectionHeader
        eyebrow="Debate-ready layer"
        title="Argument mode"
        description={
          isArgumentMode
            ? "Use this condensed version for quick claims, responses, questions, and copy-ready lines."
            : "Read the short answer first. Switch modes only if you want the condensed debate-ready version."
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyFullArgument}
              className="inline-flex min-h-9 items-center justify-center rounded-md border border-[var(--line-strong)] bg-[rgba(18,31,49,0.58)] px-3 text-[12px] font-semibold text-white transition-[background-color,border-color,box-shadow] hover:border-[var(--line-strong)] hover:bg-[rgba(18,31,49,0.86)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(132,247,198,0.28)]"
              aria-label="Copy full argument"
              aria-live="polite"
            >
              {copyStatus === "copied"
                ? "Copied"
                : copyStatus === "failed"
                  ? "Copy failed"
                  : "Copy full argument"}
            </button>
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
      ) : (
        <div className="space-y-4 p-4">
          {previewAnswer ? (
            <Panel padding="md">
              <StatusPill tone="info">Short answer</StatusPill>
              {primaryClaim?.claim ? (
                <p className="mt-3 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                  Addresses this claim
                </p>
              ) : null}
              {primaryClaim?.claim ? (
                <p className="mt-2 text-sm leading-7 text-white">{primaryClaim.claim}</p>
              ) : null}
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                {previewAnswer}
              </p>
              {previewContext && previewContext !== previewAnswer ? (
                <p className="mt-3 text-[12px] leading-6 text-[var(--ink-muted)]">
                  {previewContext}
                </p>
              ) : null}
            </Panel>
          ) : null}

          {previewPoints.length ? (
            <div className="grid gap-3 md:grid-cols-3">
              {previewPoints.map((item) => (
                <Panel key={item} padding="md" className="h-full">
                  <StatusPill tone="verified">Key point</StatusPill>
                  <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item}</p>
                </Panel>
              ))}
            </div>
          ) : null}

          {previewQuestion ? (
            <Panel padding="md">
              <StatusPill tone="warning">Question to test the claim</StatusPill>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                {previewQuestion}
              </p>
            </Panel>
          ) : null}
        </div>
      )}
    </Panel>
  );
}
