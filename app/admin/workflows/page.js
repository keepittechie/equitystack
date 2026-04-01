import Link from "next/link";
import { listSerializedWorkflows } from "@/lib/server/admin-operator/workflowRegistry.js";
import { listBrokerJobs } from "@/lib/server/admin-operator/commandBroker.js";
import { listOperatorSchedules } from "@/lib/server/admin-operator/schedulerService.js";
import { listWorkflowSessions } from "@/lib/server/admin-operator/workflowData.js";
import { formatAdminDateTime } from "@/app/admin/components/adminDateTime";
import OperatorPageAutoRefresh from "@/app/admin/components/OperatorPageAutoRefresh";
import OperatorActionButton from "@/app/admin/components/OperatorActionButton";
import JobStatusBadge from "../jobs/JobStatusBadge";

function toWorkflowLabel(value) {
  if (value === "current-admin") {
    return "Current Admin";
  }
  if (value === "legislative") {
    return "Legislative";
  }
  return value || "Unknown";
}

function summarizeLatestJob(sessionId, jobs) {
  return (
    jobs.find((job) => Array.isArray(job.sessionIds) && job.sessionIds.includes(sessionId)) || null
  );
}

function summarizeSchedule(workflowFamily, schedules) {
  return schedules.find((schedule) => schedule.workflowFamily === workflowFamily && schedule.enabled) || null;
}

export default async function AdminWorkflowsPage() {
  const [workflows, sessions, jobs, schedules] = await Promise.all([
    listSerializedWorkflows(),
    listWorkflowSessions(),
    listBrokerJobs({ limit: 100 }),
    listOperatorSchedules(),
  ]);

  const sessionRows = sessions.map((session) => ({
    ...session,
    latestJob: summarizeLatestJob(session.id, jobs),
    linkedSchedule: summarizeSchedule(session.workflowFamily, schedules),
    blocker:
      session.metadataJson?.blockers?.[0] ||
      session.metadataJson?.missingArtifacts?.[0] ||
      session.metadataJson?.next_action_reason ||
      "",
  }));

  return (
    <main className="mx-auto max-w-[1700px] space-y-4 px-4 py-4">
      <OperatorPageAutoRefresh />

      <section className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-wide text-[#6B7280]">Workflows</p>
        <h2 className="text-lg font-semibold text-[#1F2937]">Active sessions</h2>
        <p className="max-w-5xl text-[12px] text-[#4B5563]">
          Session state reflects canonical workflow artifacts. Use this page to scan current state,
          blocker status, the next recommended action, and the latest related run.
        </p>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wide text-[#6B7280]">Session Table</p>
            <h3 className="text-sm font-semibold text-[#1F2937]">Workflow sessions</h3>
          </div>
        </div>
        <div className="overflow-x-auto rounded border border-[#E5EAF0] bg-white">
          <table className="min-w-[1320px] w-full text-[11px]">
            <thead className="bg-[#F9FBFD] text-left uppercase tracking-wide text-[#6B7280]">
              <tr>
                <th className="border-b border-[#E5EAF0] px-2 py-1">Workflow</th>
                <th className="border-b border-[#E5EAF0] px-2 py-1">Session</th>
                <th className="border-b border-[#E5EAF0] px-2 py-1">State</th>
                <th className="border-b border-[#E5EAF0] px-2 py-1">Current / Next</th>
                <th className="border-b border-[#E5EAF0] px-2 py-1">Blocker</th>
                <th className="border-b border-[#E5EAF0] px-2 py-1">Latest Job</th>
                <th className="border-b border-[#E5EAF0] px-2 py-1">Mode</th>
                <th className="border-b border-[#E5EAF0] px-2 py-1">Schedule</th>
                <th className="border-b border-[#E5EAF0] px-2 py-1">Updated</th>
                <th className="border-b border-[#E5EAF0] px-2 py-1">Action</th>
              </tr>
            </thead>
            <tbody>
              {sessionRows.map((session) => {
                const tracker =
                  session.workflowFamily === "current-admin" ? session.workflowTracker : null;
                const primaryAction =
                  tracker?.nextStep?.action || tracker?.currentStep?.action || null;
                const workflowHref =
                  tracker?.operatorSurfaceHref || session.operatorSurfaceHref || session.href;
                const workflowLinkLabel =
                  primaryAction?.type === "link"
                    ? primaryAction.label || "Open"
                    : tracker?.nextStep?.status === "blocked"
                      ? "Inspect blocker"
                      : "Workflow";
                const stepLabel =
                  tracker?.nextStep?.title ||
                  tracker?.currentStep?.title ||
                  session.recommendedAction?.title ||
                  "—";

                return (
                <tr key={session.id} className="align-top odd:bg-white even:bg-[#F9FBFD] hover:bg-[#F1F5F9]">
                  <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">{toWorkflowLabel(session.workflowFamily)}</td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1">
                    <div className="font-mono text-[10px] text-[#111827]">
                      {session.canonicalSessionKey || session.id}
                    </div>
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1">
                    <JobStatusBadge status={session.canonicalState} />
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1">
                    <div className="space-y-1">
                      <div className="max-w-[220px] truncate text-[#4B5563]" title={stepLabel}>
                        {stepLabel}
                      </div>
                      {tracker?.nextStep?.reason ? (
                        <div className="max-w-[260px] truncate text-[10px] text-[#6B7280]" title={tracker.nextStep.reason}>
                          {tracker.nextStep.reason}
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1">
                    <div className="max-w-[240px] truncate text-[#4B5563]" title={session.blocker || "—"}>
                      {session.blocker || "—"}
                    </div>
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1">
                    {session.latestJob ? (
                      <div className="space-y-1">
                        <JobStatusBadge status={session.latestJob.status} />
                        <div className="font-mono text-[10px] text-[#6B7280]">{session.latestJob.id}</div>
                      </div>
                    ) : (
                      <span className="text-[#6B7280]">—</span>
                    )}
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1 font-mono text-[10px] text-[#111827]">
                    {session.execution?.execution_mode || "local_cli"}
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1 font-mono text-[10px] text-[#111827]">
                    {session.linkedSchedule?.title || "—"}
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">{formatAdminDateTime(session.updatedAt)}</td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1">
                      <div className="flex flex-wrap gap-2">
                        <Link href={session.href} className="text-[11px] text-[#3B82F6] underline">
                          Open
                        </Link>
                      {primaryAction?.action ? (
                        <OperatorActionButton
                          action={primaryAction.action}
                          label={primaryAction.label || primaryAction.title}
                          input={primaryAction.input}
                          context={primaryAction.context}
                          tone={primaryAction.tone}
                          helperText=""
                          confirmation={primaryAction.confirmation}
                        />
                      ) : (
                        <Link
                          href={primaryAction?.href || workflowHref}
                          className="text-[11px] text-[#3B82F6] underline"
                        >
                          {workflowLinkLabel}
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              )})}
              {!sessionRows.length ? (
                <tr>
                  <td colSpan={10} className="px-2 py-3 text-[11px] text-[#6B7280]">
                    No active sessions are currently recorded.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wide text-[#6B7280]">Reference</p>
            <h3 className="text-sm font-semibold text-[#1F2937]">Workflow registry</h3>
          </div>
        </div>
        <div className="overflow-x-auto rounded border border-[#E5EAF0] bg-white">
          <table className="min-w-[960px] w-full text-[11px]">
            <thead className="bg-[#F9FBFD] text-left uppercase tracking-wide text-[#6B7280]">
              <tr>
                <th className="border-b border-[#E5EAF0] px-2 py-1">Workflow</th>
                <th className="border-b border-[#E5EAF0] px-2 py-1">Description</th>
                <th className="border-b border-[#E5EAF0] px-2 py-1">Steps</th>
                <th className="border-b border-[#E5EAF0] px-2 py-1">Surface</th>
              </tr>
            </thead>
            <tbody>
              {workflows.map((workflow) => (
                <tr key={workflow.id} className="align-top odd:bg-white even:bg-[#F9FBFD] hover:bg-[#F1F5F9]">
                  <td className="border-b border-[#E5EAF0] px-2 py-1">
                    <div className="font-medium text-[#1F2937]">{workflow.title}</div>
                    <div className="font-mono text-[10px] text-[#6B7280]">{workflow.id}</div>
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">{workflow.description}</td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1 font-mono text-[10px] text-[#6B7280]">
                    {workflow.steps.map((step) => step.actionId).join(", ")}
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1">
                    <Link href={workflow.surfaceHref} className="text-[11px] text-[#3B82F6] underline">
                      Open surface
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
