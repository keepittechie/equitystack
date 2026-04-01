import { Fragment } from "react";
import Link from "next/link";
import OperatorActionButton from "./OperatorActionButton";

function statusTone(status) {
  if (status === "complete") {
    return {
      shell: "border-[#A7F3D0] bg-[#ECFDF5]",
      badge: "border-[#34D399] bg-[#ECFDF5] text-[#047857]",
      dot: "bg-[#10B981]",
      label: "Complete",
      token: "Done",
    };
  }
  if (status === "current") {
    return {
      shell: "border-[#FDE68A] bg-[#FFFBEB]",
      badge: "border-[#FCD34D] bg-[#FFFBEB] text-[#92400E]",
      dot: "bg-[#F59E0B]",
      label: "Current",
      token: "Now",
    };
  }
  if (status === "blocked") {
    return {
      shell: "border-[#FCA5A5] bg-[#FEF2F2]",
      badge: "border-[#FCA5A5] bg-[#FEF2F2] text-[#B91C1C]",
      dot: "bg-[#EF4444]",
      label: "Blocked",
      token: "Blocked",
    };
  }
  return {
    shell: "border-[#E5EAF0] bg-white",
    badge: "border-[#CBD5E1] bg-[#F8FAFC] text-[#64748B]",
    dot: "bg-[#CBD5E1]",
    label: "Not Started",
    token: "Wait",
  };
}

function humanizeToken(value) {
  if (typeof value !== "string" || !value.trim()) {
    return "Unknown";
  }

  return value
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function renderAction(actionConfig, fallbackHref, fallbackLabel = "Open") {
  if (actionConfig?.type === "action" && actionConfig.action) {
    return (
      <OperatorActionButton
        action={actionConfig.action}
        label={actionConfig.label}
        input={actionConfig.input}
        context={actionConfig.context}
        tone={actionConfig.tone}
        helperText=""
        confirmation={actionConfig.confirmation}
      />
    );
  }

  const href = actionConfig?.href || fallbackHref;
  const label = actionConfig?.label || fallbackLabel;
  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex items-center rounded border border-[#1D4ED8] bg-[#1D4ED8] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#1E40AF]"
      >
        {label}
      </Link>
    );
  }

  return <span className="text-[11px] text-[#6B7280]">—</span>;
}

export default function LegislativeWorkflowTracker({
  tracker,
  compact = false,
  eyebrow = "Legislative Pipeline",
  title = "Legislative workflow step tracker",
  description = "This tracker follows the canonical legislative workflow state and highlights the single next valid step.",
}) {
  if (!tracker) {
    return null;
  }

  const blockedStep = tracker.blockedStep || null;
  const currentStep = tracker.currentStep || null;
  const allStepsComplete = tracker.steps.every((step) => step.status === "complete");
  const nextStep = blockedStep || currentStep || tracker.nextStep || null;
  const summaryAction = allStepsComplete ? tracker.completionAction : nextStep?.action || null;
  const stateHeadline = blockedStep
    ? `Blocked at ${blockedStep.title}`
    : currentStep
      ? `${currentStep.title} is active`
      : allStepsComplete
        ? "Legislative workflow complete"
        : humanizeToken(tracker.canonicalState);
  const nextStepLabel = allStepsComplete ? "Post-run verification" : nextStep?.title || "No next step";
  const whyItMatters = blockedStep
    ? blockedStep.reason
    : nextStep?.reason || tracker.summary || "No legislative guidance is available.";
  const summaryHref = allStepsComplete
    ? tracker.completionAction?.href || tracker.reportsHref || tracker.operatorSurfaceHref || tracker.sessionHref
    : nextStep?.href || tracker.operatorSurfaceHref || tracker.sessionHref;
  const fallbackActionLabel = allStepsComplete
    ? tracker.completionAction?.label || "Open workflow report"
    : blockedStep
      ? blockedStep.action?.label || "Inspect legislative blocker"
      : nextStep?.action?.label || "Open legislative review";
  const summaryTone = blockedStep
    ? "border-[#FCA5A5] bg-[#FEF2F2]"
    : currentStep
      ? "border-[#FDE68A] bg-[#FFFBEB]"
      : "border-[#E5EAF0] bg-white";

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-wide text-[#6B7280]">{eyebrow}</p>
          <h2 className="text-sm font-semibold text-[#1F2937]">{title}</h2>
          {description ? (
            <p className="text-[11px] text-[#6B7280]">{description}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#4B5563]">
            <span>
              Surface: <span className="font-mono text-[#111827]">{tracker.batchName || "review-bundle"}</span>
            </span>
            <span>
              State: <span className="font-medium text-[#1F2937]">{humanizeToken(tracker.canonicalState)}</span>
            </span>
          </div>
        </div>
        {tracker.sessionHref ? (
          <Link href={tracker.sessionHref} className="text-[11px] text-[#3B82F6] underline underline-offset-2">
            Open legislative session
          </Link>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded border border-[#E5EAF0] bg-white px-3 py-2">
        <div className="flex min-w-[1100px] items-stretch gap-2">
          {tracker.steps.map((step, index) => {
            const tone = statusTone(step.status);
            return (
              <Fragment key={step.id}>
                <div className={`min-w-[142px] rounded border px-2 py-2 ${tone.shell}`}>
                  <div className="flex items-start gap-2">
                    <span className={`inline-flex min-w-[48px] items-center justify-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone.badge}`}>
                      {tone.token}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[11px] font-medium text-[#1F2937]">{step.title}</div>
                      <div className="mt-0.5 flex items-center gap-1 text-[10px] text-[#6B7280]">
                        <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
                        {tone.label}
                      </div>
                    </div>
                  </div>
                </div>
                {index < tracker.steps.length - 1 ? (
                  <div className="flex items-center text-[14px] text-[#94A3B8]">→</div>
                ) : null}
              </Fragment>
            );
          })}
        </div>
      </div>

      <div className={`grid gap-2 rounded border px-3 py-3 ${summaryTone}${compact ? " lg:grid-cols-[1fr_1fr_1.6fr_auto]" : " xl:grid-cols-[1fr_1fr_1.6fr_auto]"}`}>
        <div>
          <p className="text-[11px] text-[#6B7280]">Current real state</p>
          <p className="mt-1 text-[12px] font-medium text-[#1F2937]">{stateHeadline}</p>
        </div>
        <div>
          <p className="text-[11px] text-[#6B7280]">Next step</p>
          <p className="mt-1 text-[12px] font-medium text-[#1F2937]">{nextStepLabel}</p>
        </div>
        <div>
          <p className="text-[11px] text-[#6B7280]">{blockedStep ? "Blocked" : "Why this matters"}</p>
          <p className="mt-1 text-[12px] text-[#4B5563]">{whyItMatters}</p>
        </div>
        <div>
          <p className="text-[11px] text-[#6B7280]">Action</p>
          <div className="mt-2">
            {renderAction(summaryAction, summaryHref, fallbackActionLabel)}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded border border-[#E5EAF0] bg-[#F9FBFD] px-3 py-2 text-[11px] text-[#6B7280]">
        <span className="font-medium text-[#4B5563]">Status legend</span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[#10B981]" />
          Completed
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[#F59E0B]" />
          Current step
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[#EF4444]" />
          Blocked
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[#CBD5E1]" />
          Not yet available
        </span>
      </div>
    </section>
  );
}
