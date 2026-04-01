import Link from "next/link";
import OperatorActionButton from "./OperatorActionButton";

function statusDot(status) {
  if (status === "complete") {
    return "bg-[#10B981]";
  }
  if (status === "current") {
    return "bg-[#F59E0B]";
  }
  if (status === "blocked") {
    return "bg-[#EF4444]";
  }
  return "bg-[#CBD5E1]";
}

function statusText(status) {
  if (status === "complete") {
    return "Complete";
  }
  if (status === "current") {
    return "Current";
  }
  if (status === "blocked") {
    return "Blocked";
  }
  return "Pending";
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
      <Link href={href} className="text-[11px] text-[#3B82F6] underline underline-offset-2">
        {label}
      </Link>
    );
  }

  return <span className="text-[11px] text-[#6B7280]">—</span>;
}

export default function CurrentAdminWorkflowTracker({
  tracker,
  eyebrow = "Current-Admin Workflow",
  title = "Current-admin guided flow",
  description = "This tracker follows the canonical current-admin workflow state and highlights the single next valid step.",
}) {
  if (!tracker) {
    return null;
  }

  const currentStep = tracker.currentStep || tracker.nextStep || null;
  const nextStep = tracker.nextStep || tracker.currentStep || null;
  const summaryAction = nextStep?.action || currentStep?.action || null;

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-wide text-[#6B7280]">{eyebrow}</p>
          <h2 className="text-sm font-semibold text-[#1F2937]">{title}</h2>
          <p className="text-[11px] text-[#6B7280]">{description}</p>
        </div>
        {tracker.sessionHref ? (
          <Link href={tracker.sessionHref} className="text-[11px] text-[#3B82F6] underline underline-offset-2">
            Open session
          </Link>
        ) : null}
      </div>

      <div className="grid gap-2 xl:grid-cols-[1fr_1fr_1.4fr_auto]">
        <div className="rounded border border-[#E5EAF0] bg-white px-3 py-2">
          <p className="text-[11px] text-[#6B7280]">Current step</p>
          <p className="mt-1 text-[12px] font-medium text-[#1F2937]">
            {currentStep?.title || "No active current-admin step"}
          </p>
        </div>
        <div className="rounded border border-[#E5EAF0] bg-white px-3 py-2">
          <p className="text-[11px] text-[#6B7280]">Next step</p>
          <p className="mt-1 text-[12px] font-medium text-[#1F2937]">
            {nextStep?.title || "No next step"}
          </p>
        </div>
        <div className="rounded border border-[#E5EAF0] bg-white px-3 py-2">
          <p className="text-[11px] text-[#6B7280]">Why this is next</p>
          <p className="mt-1 text-[12px] text-[#4B5563]">
            {nextStep?.reason || tracker.summary || "No current-admin guidance is available."}
          </p>
        </div>
        <div className="rounded border border-[#E5EAF0] bg-white px-3 py-2">
          <p className="text-[11px] text-[#6B7280]">Next action</p>
          <div className="mt-2">
            {renderAction(summaryAction, nextStep?.href || tracker.operatorSurfaceHref, "Open next step")}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded border border-[#E5EAF0] bg-[#F9FBFD] px-3 py-2 text-[11px] text-[#6B7280]">
        <span className="font-medium text-[#4B5563]">Status legend</span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[#10B981]" />
          Complete
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[#F59E0B]" />
          Next step
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

      <div className="overflow-x-auto rounded border border-[#E5EAF0] bg-white">
        <table className="min-w-[920px] w-full text-[11px]">
          <thead className="bg-[#F9FBFD] text-left uppercase tracking-wide text-[#6B7280]">
            <tr>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Status</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Step</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">What this means</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {tracker.steps.map((step) => {
              const rowTone =
                step.status === "current"
                  ? "bg-[#FFFBEB]"
                  : step.status === "blocked"
                    ? "bg-[#FEF2F2]"
                    : "bg-white";
              return (
                <tr key={step.id} className={`align-top hover:bg-[#F1F5F9] ${rowTone}`}>
                  <td className="border-b border-[#E5EAF0] px-2 py-1">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${statusDot(step.status)}`} />
                      <span className="text-[11px] text-[#4B5563]">{statusText(step.status)}</span>
                    </div>
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1">
                    <div className="font-medium text-[#1F2937]">{step.title}</div>
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">
                    {step.reason}
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1">
                    {step.status === "current" || step.status === "blocked"
                      ? renderAction(step.action, step.href, "Open")
                      : <span className="text-[11px] text-[#6B7280]">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
