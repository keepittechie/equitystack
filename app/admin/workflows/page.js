import Link from "next/link";
import { listSerializedWorkflows } from "@/lib/server/admin-operator/workflowRegistry.js";
import { listBrokerJobs } from "@/lib/server/admin-operator/commandBroker.js";
import { listOperatorSchedules } from "@/lib/server/admin-operator/schedulerService.js";
import {
  buildCurrentAdminWorkflowTracker,
  buildLegislativeWorkflowTracker,
  listWorkflowSessions,
} from "@/lib/server/admin-operator/workflowData.js";
import { getCurrentAdministrationOperatorWorkspace } from "@/lib/services/currentAdministrationReviewInsightsService";
import { getLegislativeWorkflowWorkspace } from "@/lib/services/legislativeWorkflowInsightsService";
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

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function humanizeToken(value) {
  const text = normalizeString(value);
  if (!text) {
    return "Unknown";
  }

  return text
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function SurfaceBadge({ tone = "default", children }) {
  const palette =
    tone === "danger"
      ? "border-[#FCA5A5] bg-[#FEF2F2] text-[#991B1B]"
      : tone === "warning"
        ? "border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]"
        : tone === "success"
          ? "border-[#A7F3D0] bg-[#ECFDF5] text-[#166534]"
          : "border-[#E5EAF0] bg-[#F9FBFD] text-[#4B5563]";

  return (
    <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${palette}`}>
      {children}
    </span>
  );
}

function currentAdminSurfaceSummary(workspace, session) {
  const batchName = workspace?.batch?.batch_name || null;
  const tracker = buildCurrentAdminWorkflowTracker(workspace, {
    sessionId: batchName ? `current-admin:${batchName}` : session?.id || "",
  });
  const reviewRuntime = workspace?.review_runtime || null;
  const counts = workspace?.counts || {};
  const importReadiness = workspace?.import_readiness || {};
  const pendingReview = Number(counts.pending_review || counts.pending || 0);
  const importApproved = Number(importReadiness.queue_approved_for_import_count || 0);
  const heldBack = Number(importReadiness.queue_pending_manual_review_count || 0);
  const fallbackUsed = Boolean(reviewRuntime?.fallback_used);
  const aiStatus = !reviewRuntime
    ? "Not started"
    : fallbackUsed
      ? normalizeString(reviewRuntime.review_backend) === "heuristic_fallback"
        ? "AI failed"
        : "AI partial"
      : "AI succeeded";
  const trustTone = !reviewRuntime
    ? "default"
    : normalizeString(reviewRuntime.review_backend) === "heuristic_fallback"
      ? "danger"
      : fallbackUsed
        ? "warning"
        : "success";
  const trustLabel = !reviewRuntime
    ? "Pending"
    : normalizeString(reviewRuntime.review_backend) === "heuristic_fallback"
      ? "Low"
      : fallbackUsed
        ? "Guarded"
        : "High";
  const action = tracker?.nextStep?.action || tracker?.currentStep?.action || null;
  const actionLabel =
    action?.label ||
    (tracker?.nextStep?.status === "blocked"
      ? "Open current-admin blocker"
      : tracker?.reviewHref
        ? "Open current-admin review"
        : "Open current-admin workflow");

  return {
    id: "current-admin-surface",
    workflow: "Current Admin",
    surfaceHref: "/admin/current-admin-review",
    surfaceLabel: "Current-admin review surface",
    state: workspace?.batch?.stage || session?.canonicalState || "DISCOVERY_READY",
    summary:
      tracker?.summary ||
      "Current-admin state is derived from the canonical batch, review, queue, and import artifacts.",
    currentNext: tracker?.nextStep?.title || tracker?.currentStep?.title || "No next step recorded",
    reviewLoad:
      pendingReview > 0
        ? `${pendingReview} operator review item(s)`
        : heldBack > 0
          ? `${heldBack} held for manual follow-up`
          : importApproved > 0
            ? `${importApproved} approved for import`
            : "No review work pending",
    trustLabel,
    trustTone,
    aiStatus,
    updatedAt: workspace?.batch?.last_updated || workspace?.batch?.generated_at || session?.updatedAt || null,
    detailHref: session?.href || tracker?.sessionHref || null,
    detailLabel: session?.href ? "Open session inspector" : null,
    actionHref: action?.href || tracker?.operatorSurfaceHref || "/admin/current-admin-review",
    actionLabel,
    action,
  };
}

function legislativeSurfaceSummary(workspace, session) {
  const tracker = buildLegislativeWorkflowTracker(workspace, {
    sessionId: session?.id || "legislative:review-bundle",
  });
  const outcome = workspace?.workflow_outcome_summary || null;
  const trustTone =
    outcome?.severity === "critical"
      ? "danger"
      : outcome?.severity === "warning"
        ? "warning"
        : outcome
          ? "success"
          : "default";
  const trustLabel =
    outcome?.severity === "critical"
      ? "Low"
      : outcome?.severity === "warning"
        ? "Guarded"
        : outcome
          ? "High"
          : "Pending";
  const reviewCount =
    Number(outcome?.manual_review_queue_count || 0) ||
    Number(workspace?.counts?.manual_review_items || 0);

  return {
    id: "legislative-surface",
    workflow: "Legislative",
    surfaceHref: "/admin/legislative-workflow",
    surfaceLabel: "Legislative review surface",
    state: workspace?.workflow_status || session?.canonicalState || "DISCOVERY_READY",
    summary:
      tracker?.summary ||
      outcome?.user_message ||
      workspace?.next_step?.label ||
      "Legislative state is derived from the canonical review bundle, AI review, and manual-review queue artifacts.",
    currentNext: tracker?.nextStep?.title || workspace?.next_step?.label || session?.recommendedAction?.title || "No next step recorded",
    reviewLoad:
      reviewCount > 0
        ? `${reviewCount} manual-review item(s)`
        : Number(workspace?.counts?.pending_unreviewed_actions || 0) > 0
          ? `${workspace.counts.pending_unreviewed_actions} bundle approval item(s)`
          : "No review work pending",
    trustLabel,
    trustTone,
    aiStatus:
      outcome?.ai_status?.run_status === "failed"
        ? "AI failed"
        : outcome?.ai_status?.run_status === "partial"
          ? "AI partial"
          : outcome?.ai_status?.run_status === "success"
            ? "AI succeeded"
            : "Not started",
    updatedAt:
      workspace?.pipeline_report?.generated_at ||
      workspace?.review_bundle?.generated_at ||
      workspace?.ai_review?.generated_at ||
      session?.updatedAt ||
      null,
    detailHref: session?.href || null,
    detailLabel: session?.href ? "Open session inspector" : null,
    actionHref: tracker?.nextStep?.href || tracker?.operatorSurfaceHref || "/admin/legislative-workflow",
    actionLabel:
      tracker?.nextStep?.action?.label ||
      (reviewCount > 0 ? "Open legislative review" : "Open legislative workflow"),
    action: tracker?.nextStep?.action || tracker?.currentStep?.action || null,
  };
}

export default async function AdminWorkflowsPage() {
  const [workflows, sessions, jobs, schedules, currentAdminWorkspace, legislativeWorkspace] = await Promise.all([
    listSerializedWorkflows(),
    listWorkflowSessions(),
    listBrokerJobs({ limit: 100 }),
    listOperatorSchedules(),
    getCurrentAdministrationOperatorWorkspace(),
    getLegislativeWorkflowWorkspace(),
  ]);

  const currentAdminSession =
    sessions.find((session) => session.workflowFamily === "current-admin") || null;
  const legislativeSession =
    sessions.find((session) => session.workflowFamily === "legislative") || null;
  const surfaceRows = [
    currentAdminSurfaceSummary(currentAdminWorkspace, currentAdminSession),
    legislativeSurfaceSummary(legislativeWorkspace, legislativeSession),
  ];

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
        <h2 className="text-lg font-semibold text-[#1F2937]">Canonical workflow surfaces and sessions</h2>
        <p className="max-w-5xl text-[12px] text-[#4B5563]">
          This page owns the full workflow layer. It shows the live canonical current-admin and legislative
          surfaces first, then any persisted active session records underneath.
        </p>
      </section>

      <section className="space-y-2">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wide text-[#6B7280]">Canonical Surfaces</p>
          <h3 className="text-sm font-semibold text-[#1F2937]">Live workflow state</h3>
          <p className="mt-1 max-w-5xl text-[11px] text-[#6B7280]">
            These rows come directly from the canonical current-admin and legislative workflow surfaces, even when no active session row is persisted.
          </p>
        </div>
        <div className="overflow-x-auto rounded border border-[#E5EAF0] bg-white">
          <table className="min-w-[1280px] w-full text-[11px]">
            <thead className="bg-[#F9FBFD] text-left uppercase tracking-wide text-[#6B7280]">
              <tr>
                <th className="border-b border-[#E5EAF0] px-2 py-1">Workflow</th>
                <th className="border-b border-[#E5EAF0] px-2 py-1">Surface</th>
                <th className="border-b border-[#E5EAF0] px-2 py-1">State</th>
                <th className="border-b border-[#E5EAF0] px-2 py-1">What It Shows</th>
                <th className="border-b border-[#E5EAF0] px-2 py-1">Current / Next</th>
                <th className="border-b border-[#E5EAF0] px-2 py-1">Trust / Review</th>
                <th className="border-b border-[#E5EAF0] px-2 py-1">Updated</th>
                <th className="border-b border-[#E5EAF0] px-2 py-1">Action</th>
              </tr>
            </thead>
            <tbody>
              {surfaceRows.map((row) => (
                <tr key={row.id} className="align-top odd:bg-white even:bg-[#F9FBFD] hover:bg-[#F1F5F9]">
                  <td className="border-b border-[#E5EAF0] px-2 py-1">
                    <div className="font-medium text-[#1F2937]">{row.workflow}</div>
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1">
                    <div className="text-[#4B5563]">{row.surfaceLabel}</div>
                    {row.detailHref ? (
                      <div className="mt-1">
                        <Link href={row.detailHref} className="text-[11px] text-[#3B82F6] underline">
                          {row.detailLabel}
                        </Link>
                      </div>
                    ) : null}
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1">
                    <SurfaceBadge>{humanizeToken(row.state)}</SurfaceBadge>
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">
                    <div className="max-w-[320px] truncate" title={row.summary}>
                      {row.summary}
                    </div>
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">
                    <div className="max-w-[220px] truncate" title={row.currentNext}>
                      {row.currentNext}
                    </div>
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <SurfaceBadge tone={row.trustTone}>{row.trustLabel} trust</SurfaceBadge>
                      <span className="text-[#4B5563]">{row.aiStatus}</span>
                    </div>
                    <div className="mt-1 text-[10px] text-[#6B7280]">{row.reviewLoad}</div>
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">
                    {formatAdminDateTime(row.updatedAt)}
                  </td>
                  <td className="border-b border-[#E5EAF0] px-2 py-1">
                    {row.action?.action ? (
                      <OperatorActionButton
                        action={row.action.action}
                        label={row.actionLabel}
                        input={row.action.input}
                        context={row.action.context}
                        tone={row.action.tone}
                        helperText=""
                        confirmation={row.action.confirmation}
                      />
                    ) : (
                      <Link href={row.actionHref} className="text-[11px] text-[#3B82F6] underline">
                        {row.actionLabel}
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wide text-[#6B7280]">Session Table</p>
            <h3 className="text-sm font-semibold text-[#1F2937]">Persisted active session records</h3>
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
                const tracker = session.workflowTracker || null;
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
                          Open session inspector
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
                          {session.workflowFamily === "current-admin" ? "Open current-admin workflow" : "Open legislative workflow"}
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              )})}
              {!sessionRows.length ? (
                <tr>
                  <td colSpan={10} className="px-2 py-3 text-[11px] text-[#6B7280]">
                    <div>No active workflow sessions are currently persisted.</div>
                    <div className="mt-2 flex flex-wrap gap-3">
                      <Link href="/admin/current-admin-review" className="text-[#3B82F6] underline">
                        Open current-admin review
                      </Link>
                      <Link href="/admin/legislative-workflow" className="text-[#3B82F6] underline">
                        Open legislative review
                      </Link>
                    </div>
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
