import Link from "next/link";
import { getWorkflowSessionDetail } from "@/lib/server/admin-operator/workflowData.js";
import { getReviewQueueActionDescriptors, getSessionActionDescriptors } from "@/lib/server/admin-operator/operatorActionDescriptors.js";
import OperatorActionButton from "@/app/admin/components/OperatorActionButton";
import OperatorPageAutoRefresh from "@/app/admin/components/OperatorPageAutoRefresh";
import JobStatusBadge from "@/app/admin/jobs/JobStatusBadge";
import JobRerunButton from "@/app/admin/jobs/JobRerunButton";

export const dynamic = "force-dynamic";

export default async function AdminWorkflowSessionPage({ params }) {
  const resolved = await params;
  const detail = await getWorkflowSessionDetail(resolved.sessionId);
  const sessionActions = getSessionActionDescriptors(detail);
  const blockingIssues =
    detail.workspace?.blockers ||
    detail.session?.metadataJson?.blockers ||
    [];
  const reviewRuntime = detail.metadata.reviewRuntime || detail.sessionSummary?.reviewRuntime || null;

  return (
    <main className="mx-auto max-w-[1700px] space-y-4 px-4 py-4">
      <OperatorPageAutoRefresh sessionId={detail.session.id} />

      <section className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-wide text-gray-600">Workflow Inspector</p>
        <h1 className="text-lg font-semibold">{detail.session.title}</h1>
        <p className="max-w-5xl text-[12px] text-gray-700">
          This inspector reflects canonical workflow state, related broker jobs, attached artifacts,
          and derived review queue items without becoming an editing surface.
        </p>
      </section>

      <section className="rounded border border-zinc-300 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wide text-gray-600">{detail.session.workflowFamily}</p>
            <h2 className="mt-1 text-base font-semibold">{detail.session.title}</h2>
            <p className="mt-1 text-[12px] text-gray-700">{detail.session.summary}</p>
          </div>
          <JobStatusBadge status={detail.session.canonicalState} />
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded border p-2">
            <p className="text-[11px] text-gray-500">Canonical state</p>
            <p className="mt-1 text-[12px] font-medium">{detail.metadata.canonicalState}</p>
          </div>
          <div className="rounded border p-2">
            <p className="text-[11px] text-gray-500">Recommended next action</p>
            <p className="mt-1 text-[12px] font-medium">{detail.session.recommendedAction?.title || "None"}</p>
          </div>
          <div className="rounded border p-2">
            <p className="text-[11px] text-gray-500">Why this is next</p>
            <p className="mt-1 text-[12px]">{detail.session.metadataJson?.next_action_reason || "No explicit reason recorded."}</p>
          </div>
          <div className="rounded border p-2">
            <p className="text-[11px] text-gray-500">Started</p>
            <p className="mt-1 text-[12px]">{detail.metadata.startedAt || "-"}</p>
          </div>
          <div className="rounded border p-2">
            <p className="text-[11px] text-gray-500">Updated</p>
            <p className="mt-1 text-[12px]">{detail.metadata.updatedAt || "-"}</p>
          </div>
        </div>

        <div className="mt-3 grid gap-2 xl:grid-cols-4">
          <div className="rounded border p-3">
            <p className="text-[11px] text-gray-500">Session id</p>
            <p className="mt-1 break-all font-mono text-[11px]">{detail.session.id}</p>
          </div>
          <div className="rounded border p-3">
            <p className="text-[11px] text-gray-500">Canonical session key</p>
            <p className="mt-1 break-all font-mono text-[11px]">{detail.metadata.canonicalSessionKey}</p>
          </div>
          <div className="rounded border p-3">
            <p className="text-[11px] text-gray-500">Execution mode</p>
            <p className="mt-1 text-[12px]">{detail.metadata.executionMode || "local_cli"}</p>
          </div>
          <div className="rounded border p-3">
            <p className="text-[11px] text-gray-500">Executor metadata</p>
            <p className="mt-1 text-[12px]">
              {detail.metadata.executor.executor_model} via {detail.metadata.executor.executor_backend} @{" "}
              {detail.metadata.executor.executor_host}
            </p>
            <p className="mt-1 text-[11px] text-gray-500">
              Transport: {detail.metadata.executor.executor_transport || "shell"}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {sessionActions.map((descriptor) => (
            <OperatorActionButton
              key={`${detail.session.id}-${descriptor.id}`}
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

      <section className="rounded border border-zinc-300 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">Session summary</h2>
        <p className="mt-2 text-[12px] text-gray-700">{detail.sessionSummary?.narrative}</p>
        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          <div className="rounded border p-3">
            <p className="text-[11px] text-gray-500">Completed</p>
            <div className="mt-2 space-y-2 text-sm text-gray-700">
              {detail.sessionSummary?.completed?.length ? (
                detail.sessionSummary.completed.map((entry) => (
                  <p key={`${detail.session.id}-completed-${entry}`}>{entry}</p>
                ))
              ) : (
                <p>No completed operator checkpoints are recorded yet.</p>
              )}
            </div>
          </div>
          <div className="rounded border p-3">
            <p className="text-[11px] text-gray-500">Missing artifacts</p>
            <div className="mt-2 space-y-2 text-sm text-gray-700">
              {detail.sessionSummary?.missingArtifacts?.length ? (
                detail.sessionSummary.missingArtifacts.map((entry) => (
                  <p key={`${detail.session.id}-missing-${entry}`}>{entry}</p>
                ))
              ) : (
                <p>No expected artifacts are missing right now.</p>
              )}
            </div>
          </div>
        </div>
        <div className="mt-3 rounded border bg-zinc-50 p-3 text-[12px] text-gray-700">
          <p className="font-medium">Assist mode</p>
          <p className="mt-2">
            {detail.sessionSummary?.assist?.assistMode} advisory summary. Model used:{" "}
            {detail.sessionSummary?.assist?.usedModel ? "yes" : "no"}.
          </p>
        </div>
        {reviewRuntime?.fallback_used ? (
          <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-[12px] text-amber-950">
            <p className="font-medium">Fallback visibility</p>
            <p className="mt-2">
              Review backend: {reviewRuntime.review_backend || "fallback"}.
              {" "}Fallback count: {reviewRuntime.fallback_count || 0}.
            </p>
            {reviewRuntime.fallback_reason ? (
              <p className="mt-2 text-xs">{reviewRuntime.fallback_reason}</p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded border border-zinc-300 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold">Related jobs</h2>
          <div className="mt-3 space-y-2">
            {detail.relatedJobs.length ? (
              detail.relatedJobs.map((job) => (
                <div key={job.id} className="rounded border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="text-[11px] uppercase tracking-wide text-gray-600">{job.workflowFamily}</p>
                        <p className="mt-1 font-medium">{job.actionTitle}</p>
                        <p className="mt-1 text-[12px] text-gray-700">{job.summary || "No summary yet."}</p>
                      {job.failure?.likelySource ? (
                        <p className="mt-2 text-[11px] text-red-900">
                          Failure source: {job.failure.likelySource}
                        </p>
                      ) : null}
                      {job.failure?.nextSafeActionTitle ? (
                        <p className="mt-1 text-[11px] text-red-900">
                          Next safe action: {job.failure.nextSafeActionTitle}
                        </p>
                      ) : null}
                      {job.schedule?.schedule_title ? (
                        <p className="mt-1 text-[11px] text-gray-500">
                          Prepared by schedule: {job.schedule.schedule_title}
                        </p>
                      ) : null}
                      <p className="mt-1 font-mono text-[11px] text-gray-500">
                        Runtime: {job.execution?.execution_mode || job.metadataJson?.execution_mode || "local_cli"} via{" "}
                        {job.execution?.executor?.executor_backend || job.metadataJson?.executor?.executor_backend || "-"} @{" "}
                        {job.execution?.executor?.executor_host || job.metadataJson?.executor?.executor_host || "-"}{" "}
                        over {job.execution?.executor?.executor_transport || job.metadataJson?.executor_transport || "-"}
                      </p>
                    </div>
                    <JobStatusBadge status={job.status} />
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

        <div className="rounded border border-zinc-300 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold">Review queue items</h2>
          <div className="mt-3 space-y-2">
            {detail.reviewQueueItems.length ? (
              detail.reviewQueueItems.map((item) => (
                <div key={item.id} className="rounded border p-3">
                  <p className="text-[11px] uppercase tracking-wide text-gray-600">{item.queueType}</p>
                  <p className="mt-1 font-medium">{item.title}</p>
                  <p className="mt-1 text-[12px] text-gray-700">{item.detail}</p>
                  <p className="mt-1 text-[12px] text-gray-700">{item.explanation?.whyExists}</p>
                  <p className="mt-2 text-[11px] text-gray-500">
                    Expected action: {item.explanation?.expectedAction || "Inspect the workflow surface"}
                  </p>
                  <p className="mt-1 text-[11px] text-gray-500">{item.state}</p>
                  <p className="mt-1 text-[11px] text-gray-500">Risk: {item.riskLevel || "medium"}</p>
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

      <section className="rounded border border-zinc-300 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">Artifacts</h2>
        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          {detail.artifacts.map((artifact) => (
            <div key={artifact.id} className="rounded border p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-600">{artifact.artifactKey}</p>
                    <p className="mt-1 font-medium">{artifact.label}</p>
                </div>
                <span className="rounded-full border px-3 py-1 text-xs font-medium text-gray-700">
                  {artifact.exists ? "present" : "missing"}
                </span>
              </div>
              <p className="mt-2 break-all font-mono text-[11px] text-gray-500">
                {artifact.canonicalPath || "No canonical path recorded."}
              </p>
              <p className="mt-1 text-[12px] text-gray-700">
                {artifact.summary || `Generated at ${artifact.generatedAt || "unknown time"}.`}
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

      <section id="blocking-issues" className="rounded border border-zinc-300 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">Blocking issues</h2>
        <div className="mt-3 space-y-2">
          {blockingIssues.length ? (
            blockingIssues.map((issue, index) => (
              <div key={`${detail.session.id}-blocker-${index}`} className="rounded border p-3">
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
}
