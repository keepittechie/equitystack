import { Fragment } from "react";
import Link from "next/link";
import OperatorActionButton from "./OperatorActionButton";

function statusTone(status) {
  if (status === "complete") {
    return {
      shell: "border-[var(--admin-success-line)] bg-[var(--admin-success-surface)]",
      badge: "border-[var(--admin-success-line)] bg-[var(--admin-success-surface)] text-[var(--success)]",
      dot: "bg-[var(--success)]",
      label: "Complete",
      token: "Done",
    };
  }
  if (status === "current") {
    return {
      shell: "border-[var(--admin-warning-line)] bg-[var(--admin-warning-surface)]",
      badge: "border-[var(--admin-warning-line)] bg-[var(--admin-warning-surface)] text-[var(--warning)]",
      dot: "bg-[var(--warning)]",
      label: "Current",
      token: "Now",
    };
  }
  if (status === "blocked") {
    return {
      shell: "border-[var(--admin-danger-line)] bg-[var(--admin-danger-surface)]",
      badge: "border-[var(--admin-danger-line)] bg-[var(--admin-danger-surface)] text-[var(--danger)]",
      dot: "bg-[var(--danger)]",
      label: "Blocked",
      token: "Blocked",
    };
  }
  return {
    shell: "border-[var(--admin-line)] bg-[var(--admin-surface)]",
    badge: "border-[var(--admin-line-strong)] bg-[var(--admin-surface-muted)] text-[var(--admin-text-muted)]",
    dot: "bg-[var(--admin-line-strong)]",
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
        className="inline-flex items-center rounded border border-[var(--admin-link)] bg-[var(--admin-link)] px-3 py-1.5 text-[12px] font-medium text-[var(--background)] hover:bg-[var(--admin-link)]"
      >
        {label}
      </Link>
    );
  }

  return <span className="text-[11px] text-[var(--admin-text-muted)]">—</span>;
}

export default function CurrentAdminWorkflowTracker({
  tracker,
  compact = false,
  eyebrow = "Current-Admin Pipeline",
  title = "Current-admin guided pipeline",
  description = "This tracker follows the canonical current-admin pipeline state and highlights the single next safe step.",
}) {
  if (!tracker) {
    return null;
  }

  const blockedStep = tracker.blockedStep || null;
  const currentStep = tracker.currentStep || null;
  const nextStep = tracker.nextStep || blockedStep || currentStep || null;
  const allStepsComplete = tracker.steps.every((step) => step.status === "complete");
  const summaryAction = nextStep?.action || null;
  const stateHeadline = blockedStep
    ? `Blocked at ${blockedStep.title}`
    : currentStep
      ? `${currentStep.title} is active`
      : allStepsComplete
        ? "Current-admin pipeline complete"
        : humanizeToken(tracker.canonicalState);
  const nextStepLabel = allStepsComplete ? "Complete" : nextStep?.title || "No next step";
  const whyItMatters = blockedStep
    ? blockedStep.reason
    : nextStep?.reason || tracker.summary || "No current-admin guidance is available.";
  const summaryHref = nextStep?.href || tracker.operatorSurfaceHref || tracker.sessionHref;
  const fallbackActionLabel = allStepsComplete
    ? "Open current-admin session"
    : blockedStep
      ? blockedStep.action?.label || "Inspect current-admin blocker"
      : nextStep?.action?.label || "Open current-admin review";
  const summaryTone = blockedStep
    ? "border-[var(--admin-danger-line)] bg-[var(--admin-danger-surface)]"
    : currentStep
      ? "border-[var(--admin-warning-line)] bg-[var(--admin-warning-surface)]"
      : "border-[var(--admin-line)] bg-[var(--admin-surface)]";

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">{eyebrow}</p>
          <h2 className="text-sm font-semibold text-[var(--admin-text)]">{title}</h2>
          {description ? (
            <p className="text-[11px] text-[var(--admin-text-muted)]">{description}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--admin-text-soft)]">
            <span>Batch: <span className="font-mono text-[var(--admin-text)]">{tracker.batchName || "No active batch"}</span></span>
            <span>State: <span className="font-medium text-[var(--admin-text)]">{humanizeToken(tracker.canonicalState)}</span></span>
          </div>
        </div>
        {tracker.sessionHref ? (
          <Link href={tracker.sessionHref} className="text-[11px] text-[var(--admin-link)] underline underline-offset-2">
            Open current-admin session
          </Link>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] px-3 py-2">
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
                      <div className="text-[11px] font-medium text-[var(--admin-text)]">{step.title}</div>
                      <div className="mt-0.5 flex items-center gap-1 text-[10px] text-[var(--admin-text-muted)]">
                        <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
                        {tone.label}
                      </div>
                    </div>
                  </div>
                </div>
                {index < tracker.steps.length - 1 ? (
                  <div className="flex items-center text-[14px] text-[var(--admin-text-muted)]">→</div>
                ) : null}
              </Fragment>
            );
          })}
        </div>
      </div>

      <div className={`grid gap-2 rounded border px-3 py-3 ${summaryTone}${compact ? " lg:grid-cols-[1fr_1fr_1.6fr_auto]" : " xl:grid-cols-[1fr_1fr_1.6fr_auto]"}`}>
        <div>
          <p className="text-[11px] text-[var(--admin-text-muted)]">Current real state</p>
          <p className="mt-1 text-[12px] font-medium text-[var(--admin-text)]">
            {stateHeadline}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-[var(--admin-text-muted)]">Next step</p>
          <p className="mt-1 text-[12px] font-medium text-[var(--admin-text)]">
            {nextStepLabel}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-[var(--admin-text-muted)]">{blockedStep ? "Blocked" : "Why this matters"}</p>
          <p className="mt-1 text-[12px] text-[var(--admin-text-soft)]">
            {whyItMatters}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-[var(--admin-text-muted)]">Action</p>
          <div className="mt-2">
            {renderAction(summaryAction, summaryHref, fallbackActionLabel)}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] px-3 py-2 text-[11px] text-[var(--admin-text-muted)]">
        <span className="font-medium text-[var(--admin-text-soft)]">Status legend</span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[var(--success)]" />
          Completed
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[var(--warning)]" />
          Current step
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[var(--danger)]" />
          Blocked
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[var(--admin-line-strong)]" />
          Not yet available
        </span>
      </div>
    </section>
  );
}
