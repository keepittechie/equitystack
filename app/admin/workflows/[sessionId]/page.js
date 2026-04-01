import Link from "next/link";
import { getWorkflowSessionDetail } from "@/lib/server/admin-operator/workflowData.js";
import { getReviewQueueActionDescriptors, getSessionActionDescriptors } from "@/lib/server/admin-operator/operatorActionDescriptors.js";
import CurrentAdminWorkflowTracker from "@/app/admin/components/CurrentAdminWorkflowTracker";
import { formatAdminDateTime } from "@/app/admin/components/adminDateTime";
import OperatorActionButton from "@/app/admin/components/OperatorActionButton";
import OperatorPageAutoRefresh from "@/app/admin/components/OperatorPageAutoRefresh";
import JobStatusBadge from "@/app/admin/jobs/JobStatusBadge";
import JobRerunButton from "@/app/admin/jobs/JobRerunButton";

export const dynamic = "force-dynamic";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toDisplayText(value, fallback = "—") {
  if (typeof value === "string") {
    return value.trim() || fallback;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const joined = value
      .map((entry) => toDisplayText(entry, ""))
      .filter(Boolean)
      .join(", ");
    return joined || fallback;
  }
  if (value && typeof value === "object") {
    const preferred =
      normalizeString(value.title) ||
      normalizeString(value.label) ||
      normalizeString(value.summary) ||
      normalizeString(value.detail) ||
      normalizeString(value.message) ||
      normalizeString(value.reason) ||
      normalizeString(value.id);
    if (preferred) {
      return preferred;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function toTextList(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value.map((entry) => toDisplayText(entry, "")).filter(Boolean))];
}

export default async function AdminWorkflowSessionPage({ params }) {
  const resolved = await params;
  const detail = await getWorkflowSessionDetail(resolved.sessionId);
  const sessionActions = getSessionActionDescriptors(detail);

  try {
    const session = detail?.session || {};
    const metadata = detail?.metadata || {};
    const sessionSummary = detail?.sessionSummary || {};
    const relatedJobs = Array.isArray(detail?.relatedJobs) ? detail.relatedJobs.filter(Boolean) : [];
    const reviewQueueItems = Array.isArray(detail?.reviewQueueItems)
      ? detail.reviewQueueItems.filter(Boolean)
      : [];
    const artifacts = Array.isArray(detail?.artifacts) ? detail.artifacts.filter(Boolean) : [];
    const blockingIssues = toTextList(
      detail.workspace?.blockers || session?.metadataJson?.blockers || []
    );
    const completedItems = toTextList(sessionSummary?.completed);
    const missingArtifacts = toTextList(sessionSummary?.missingArtifacts);
    const reviewRuntime = metadata.reviewRuntime || sessionSummary?.reviewRuntime || null;
    const executor = metadata.executor || {};
    const currentAdminWorkflowTracker = metadata.currentAdminWorkflowTracker || null;

    return (
      <main className="mx-auto max-w-[1700px] space-y-4 px-4 py-4">
        <OperatorPageAutoRefresh sessionId={session.id} />

        <section className="space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-wide text-[#6B7280]">Workflow Inspector</p>
          <h1 className="text-lg font-semibold text-[#1F2937]">{toDisplayText(session.title, "Workflow session")}</h1>
          <p className="max-w-5xl text-[12px] text-[#4B5563]">
            This inspector reflects canonical workflow state, related broker jobs, attached artifacts,
            and derived review queue items without becoming an editing surface.
          </p>
        </section>

        <section className="rounded border border-[#E5EAF0] bg-[#EEF2F6] p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wide text-[#6B7280]">
                {toDisplayText(session.workflowFamily)}
              </p>
              <h2 className="mt-1 text-base font-semibold text-[#1F2937]">{toDisplayText(session.title, "Workflow session")}</h2>
              <p className="mt-1 text-[12px] text-[#4B5563]">{toDisplayText(session.summary, "No summary recorded.")}</p>
            </div>
            <JobStatusBadge status={toDisplayText(session.canonicalState, "unknown")} />
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded border p-2">
              <p className="text-[11px] text-gray-500">Canonical state</p>
              <p className="mt-1 text-[12px] font-medium">{toDisplayText(metadata.canonicalState)}</p>
            </div>
            <div className="rounded border p-2">
              <p className="text-[11px] text-gray-500">Recommended next action</p>
              <p className="mt-1 text-[12px] font-medium">
                {toDisplayText(session.recommendedAction?.title, "None")}
              </p>
            </div>
            <div className="rounded border p-2">
              <p className="text-[11px] text-gray-500">Why this is next</p>
              <p className="mt-1 text-[12px]">
                {toDisplayText(session.metadataJson?.next_action_reason, "No explicit reason recorded.")}
              </p>
            </div>
            <div className="rounded border p-2">
              <p className="text-[11px] text-gray-500">Started</p>
              <p className="mt-1 text-[12px]">{formatAdminDateTime(metadata.startedAt)}</p>
            </div>
            <div className="rounded border p-2">
              <p className="text-[11px] text-gray-500">Updated</p>
              <p className="mt-1 text-[12px]">{formatAdminDateTime(metadata.updatedAt)}</p>
            </div>
          </div>

          <div className="mt-3 grid gap-2 xl:grid-cols-4">
            <div className="rounded border p-3">
              <p className="text-[11px] text-gray-500">Session id</p>
              <p className="mt-1 break-all font-mono text-[11px]">{toDisplayText(session.id)}</p>
            </div>
            <div className="rounded border p-3">
              <p className="text-[11px] text-gray-500">Canonical session key</p>
              <p className="mt-1 break-all font-mono text-[11px]">{toDisplayText(metadata.canonicalSessionKey)}</p>
            </div>
            <div className="rounded border p-3">
              <p className="text-[11px] text-gray-500">Execution mode</p>
              <p className="mt-1 text-[12px]">{toDisplayText(metadata.executionMode, "local_cli")}</p>
            </div>
            <div className="rounded border p-3">
              <p className="text-[11px] text-gray-500">Executor metadata</p>
              <p className="mt-1 text-[12px]">
                {toDisplayText(executor.executor_model, "local") } via {toDisplayText(executor.executor_backend)} @{" "}
                {toDisplayText(executor.executor_host)}
              </p>
              <p className="mt-1 text-[11px] text-gray-500">
                Transport: {toDisplayText(executor.executor_transport, "shell")}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {sessionActions.map((descriptor) => (
              <OperatorActionButton
                key={`${session.id}-${descriptor.id}`}
                action={descriptor.action}
                label={descriptor.label}
                input={descriptor.input}
                context={descriptor.context}
                tone={descriptor.tone}
                helperText={descriptor.helperText}
                confirmation={descriptor.confirmation}
              />
            ))}
            <a href="#blocking-issues" className="inline-flex items-center rounded border px-3 py-1.5 text-[12px] font-medium">
              View Blocking Issues
            </a>
          </div>
        </section>

        {session.workflowFamily === "current-admin" ? (
          <CurrentAdminWorkflowTracker
            tracker={currentAdminWorkflowTracker}
            eyebrow="Workflow Guidance"
            title="Current-admin session tracker"
            description="This session tracker shows what is complete, what is waiting, and the exact next current-admin step."
          />
        ) : null}

        <section className="rounded border border-[#E5EAF0] bg-[#EEF2F6] p-4 shadow-sm">
          <h2 className="text-base font-semibold">Session summary</h2>
          <p className="mt-2 text-[12px] text-[#4B5563]">{toDisplayText(sessionSummary?.narrative, "No summary recorded.")}</p>
          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            <div className="rounded border p-3">
              <p className="text-[11px] text-gray-500">Completed</p>
              <div className="mt-2 space-y-2 text-sm text-gray-700">
                {completedItems.length ? (
                  completedItems.map((entry) => (
                    <p key={`${session.id}-completed-${entry}`}>{entry}</p>
                  ))
                ) : (
                  <p>No completed operator checkpoints are recorded yet.</p>
                )}
              </div>
            </div>
            <div className="rounded border p-3">
              <p className="text-[11px] text-gray-500">Missing artifacts</p>
              <div className="mt-2 space-y-2 text-sm text-gray-700">
                {missingArtifacts.length ? (
                  missingArtifacts.map((entry) => (
                    <p key={`${session.id}-missing-${entry}`}>{entry}</p>
                  ))
                ) : (
                  <p>No expected artifacts are missing right now.</p>
                )}
              </div>
            </div>
          </div>
          <div className="mt-3 rounded border border-[#E5EAF0] bg-[#F9FBFD] p-3 text-[12px] text-[#4B5563]">
            <p className="font-medium">Assist mode</p>
            <p className="mt-2">
              {toDisplayText(sessionSummary?.assist?.assistMode, "deterministic")} advisory summary. Model used:{" "}
              {sessionSummary?.assist?.usedModel ? "yes" : "no"}.
            </p>
          </div>
          {reviewRuntime?.fallback_used ? (
            <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-[12px] text-amber-950">
              <p className="font-medium">Fallback visibility</p>
              <p className="mt-2">
                Review backend: {toDisplayText(reviewRuntime.review_backend, "fallback")}.
                {" "}Fallback count: {toDisplayText(reviewRuntime.fallback_count, "0")}.
              </p>
              {reviewRuntime.fallback_reason ? (
                <p className="mt-2 text-xs">{toDisplayText(reviewRuntime.fallback_reason)}</p>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded border border-[#E5EAF0] bg-[#EEF2F6] p-4 shadow-sm">
            <h2 className="text-base font-semibold">Related jobs</h2>
            <div className="mt-3 space-y-2">
              {relatedJobs.length ? (
                relatedJobs.map((job) => (
                  <div key={job.id} className="rounded border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-gray-600">{job.workflowFamily}</p>
                        <p className="mt-1 font-medium">{toDisplayText(job.actionTitle, "Unnamed job")}</p>
                        <p className="mt-1 text-[12px] text-gray-700">{toDisplayText(job.summary, "No summary yet.")}</p>
                      {job.failure?.likelySource ? (
                        <p className="mt-2 text-[11px] text-red-900">
                          Failure source: {toDisplayText(job.failure.likelySource)}
                        </p>
                      ) : null}
                      {job.failure?.nextSafeActionTitle ? (
                        <p className="mt-1 text-[11px] text-red-900">
                          Next safe action: {toDisplayText(job.failure.nextSafeActionTitle)}
                        </p>
                      ) : null}
                      {job.schedule?.schedule_title ? (
                        <p className="mt-1 text-[11px] text-gray-500">
                          Prepared by schedule: {toDisplayText(job.schedule.schedule_title)}
                        </p>
                      ) : null}
                      <p className="mt-1 font-mono text-[11px] text-gray-500">
                        Runtime: {toDisplayText(job.execution?.execution_mode || job.metadataJson?.execution_mode, "local_cli")} via{" "}
                        {toDisplayText(job.execution?.executor?.executor_backend || job.metadataJson?.executor?.executor_backend)} @{" "}
                        {toDisplayText(job.execution?.executor?.executor_host || job.metadataJson?.executor?.executor_host)}{" "}
                        over {toDisplayText(job.execution?.executor?.executor_transport || job.metadataJson?.executor_transport)}
                      </p>
                  </div>
                      <JobStatusBadge status={toDisplayText(job.status, "unknown")} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <Link href={`/admin/jobs/${job.id}`} className="text-[12px] underline">
                        Open job detail
                      </Link>
                      <JobRerunButton job={job} label={job.rerun?.label || "Rerun"} />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[12px] text-gray-700">No related job runs were attached to this session yet.</p>
              )}
            </div>
          </div>

          <div className="rounded border border-[#E5EAF0] bg-[#EEF2F6] p-4 shadow-sm">
            <h2 className="text-base font-semibold">Review queue items</h2>
            <div className="mt-3 space-y-2">
              {reviewQueueItems.length ? (
                reviewQueueItems.map((item) => (
                  <div key={item.id} className="rounded border p-3">
                    <p className="text-[11px] uppercase tracking-wide text-gray-600">{toDisplayText(item.queueType)}</p>
                    <p className="mt-1 font-medium">{toDisplayText(item.title)}</p>
                    <p className="mt-1 text-[12px] text-gray-700">{toDisplayText(item.detail)}</p>
                    <p className="mt-1 text-[12px] text-gray-700">{toDisplayText(item.explanation?.whyExists)}</p>
                    <p className="mt-2 text-[11px] text-gray-500">
                      Expected action: {toDisplayText(item.explanation?.expectedAction, "Inspect the workflow surface")}
                    </p>
                    <p className="mt-1 text-[11px] text-gray-500">{toDisplayText(item.state)}</p>
                    <p className="mt-1 text-[11px] text-gray-500">Risk: {toDisplayText(item.riskLevel, "medium")}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {getReviewQueueActionDescriptors(item).map((descriptor) => (
                        <OperatorActionButton
                          key={`${item.id}-${descriptor.id}`}
                          action={descriptor.action}
                          label={descriptor.label}
                          input={descriptor.input}
                          context={descriptor.context}
                          tone={descriptor.tone}
                          helperText={descriptor.helperText}
                          confirmation={descriptor.confirmation}
                        />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[12px] text-gray-700">No active review queue items are attached to this session.</p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded border border-[#E5EAF0] bg-[#EEF2F6] p-4 shadow-sm">
          <h2 className="text-base font-semibold">Artifacts</h2>
          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            {artifacts.map((artifact) => (
              <div key={artifact.id} className="rounded border p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                      <p className="text-[11px] uppercase tracking-wide text-gray-600">{toDisplayText(artifact.artifactKey)}</p>
                      <p className="mt-1 font-medium">{toDisplayText(artifact.label)}</p>
                  </div>
                  <span className="rounded-full border px-3 py-1 text-xs font-medium text-gray-700">
                    {artifact.exists ? "present" : "missing"}
                  </span>
                </div>
                <p className="mt-2 break-all font-mono text-[11px] text-gray-500">
                  {toDisplayText(artifact.canonicalPath, "No canonical path recorded.")}
                </p>
                <p className="mt-1 text-[12px] text-gray-700">
                  {toDisplayText(artifact.summary, `Generated at ${formatAdminDateTime(artifact.generatedAt, "unknown time")}.`)}
                </p>
                {artifact.latestJobRunId ? (
                  <div className="mt-2">
                    <Link href={`/admin/jobs/${artifact.latestJobRunId}`} className="text-[12px] underline">
                      Open related job
                    </Link>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section id="blocking-issues" className="rounded border border-[#E5EAF0] bg-[#EEF2F6] p-4 shadow-sm">
          <h2 className="text-base font-semibold">Blocking issues</h2>
          <div className="mt-3 space-y-2">
            {blockingIssues.length ? (
              blockingIssues.map((issue, index) => (
                <div key={`${session.id}-blocker-${index}`} className="rounded border p-3">
                  <p className="text-[12px] text-gray-700">{issue}</p>
                </div>
              ))
            ) : (
              <p className="text-[12px] text-gray-700">
                No explicit blockers are recorded for this session right now.
              </p>
            )}
          </div>
        </section>
      </main>
    );
  } catch (error) {
    console.error("admin workflow session page render failed:", error);
    return (
      <main className="mx-auto max-w-[1700px] space-y-4 px-4 py-4">
        <section className="rounded border border-[#FDE68A] bg-[#FFFBEB] p-4 text-[12px] text-[#B45309]">
          <p className="font-mono text-[11px] uppercase tracking-wide">Workflow Inspector Fallback</p>
          <h1 className="mt-1 text-lg font-semibold">Session detail could not be fully rendered</h1>
          <p className="mt-2">
            The session data loaded, but one or more display fields could not be rendered safely.
          </p>
          <p className="mt-2 font-mono text-[11px]">
            {error instanceof Error ? error.message : "Unknown render error"}
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href="/admin/workflows" className="underline">
              Back to sessions
            </Link>
            <Link href={`/api/admin/operator/sessions/${encodeURIComponent(resolved.sessionId)}`} className="underline">
              Open session API
            </Link>
          </div>
        </section>
      </main>
    );
  }
}
