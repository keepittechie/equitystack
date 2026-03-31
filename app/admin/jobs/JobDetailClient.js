"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import JobStatusBadge from "./JobStatusBadge";
import JobRerunButton from "./JobRerunButton";

const TERMINAL_STATUSES = new Set(["success", "failed", "blocked", "cancelled"]);

function describeFailureSource(source) {
  if (source === "validation") {
    return "Validation or action input mismatch";
  }
  if (source === "stale_context") {
    return "Stale session or artifact context";
  }
  if (source === "missing_artifact") {
    return "Missing canonical artifact";
  }
  if (source === "guardrail") {
    return "Canonical guardrail blocked progress";
  }
  if (source === "cli") {
    return "Wrapped CLI execution";
  }
  if (source === "local_runner") {
    return "Local CLI runner";
  }
  if (source === "remote_executor_transport") {
    return "Remote executor transport";
  }
  if (source === "remote_executor_runtime") {
    return "Remote executor runtime";
  }
  if (source === "remote_executor_timeout") {
    return "Remote executor timeout";
  }
  if (source === "mcp_runtime_transport") {
    return "MCP runtime transport";
  }
  if (source === "mcp_runtime_runtime") {
    return "MCP runtime execution";
  }
  if (source === "workflow_refresh") {
    return "Post-run workflow refresh";
  }
  if (source === "timeout") {
    return "CLI timeout";
  }
  return "Broker orchestration";
}

export default function JobDetailClient({ jobId, initialJob }) {
  const router = useRouter();
  const refreshRef = useRef("");
  const [job, setJob] = useState(initialJob);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!jobId || TERMINAL_STATUSES.has(job?.status)) {
      if (jobId && TERMINAL_STATUSES.has(job?.status) && refreshRef.current !== `${jobId}:${job?.status}`) {
        refreshRef.current = `${jobId}:${job?.status}`;
        router.refresh();
      }
      return undefined;
    }

    let cancelled = false;
    const intervalId = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/admin/operator/jobs/${jobId}`, {
          method: "GET",
          cache: "no-store",
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || "Failed to refresh the job.");
        }

        if (!cancelled) {
          setJob(payload.job);
          setError("");
        }
      } catch (refreshError) {
        if (!cancelled) {
          setError(refreshError instanceof Error ? refreshError.message : "Failed to refresh the job.");
        }
      }
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [job?.status, jobId, router]);

  const failure = job.failure || null;
  const execution = job.execution || {
    execution_mode: job.metadataJson?.execution_mode || "local_cli",
    executor: job.metadataJson?.executor || {},
  };
  const transportReport =
    execution.transport_report ||
    job.metadataJson?.execution_runtime?.transport_report ||
    job.output?.transport_report ||
    null;
  const reviewRuntime =
    job.metadataJson?.review_runtime ||
    job.output?.workflowReviewRuntime ||
    job.output?.session?.metadataJson?.review_runtime ||
    null;

  return (
    <div className="space-y-4">
      <section className="rounded border border-zinc-300 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wide text-gray-600">{job.workflowFamily}</p>
            <h2 className="mt-1 text-lg font-semibold">{job.actionTitle}</h2>
            <p className="mt-1 text-[12px] text-gray-700">{job.summary || "No summary recorded."}</p>
          </div>
          <JobStatusBadge status={job.status} />
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <div className="rounded border p-2">
            <p className="text-[11px] text-gray-500">Created</p>
            <p className="mt-1 text-[12px]">{job.timestamps?.createdAt || "-"}</p>
          </div>
          <div className="rounded border p-2">
            <p className="text-[11px] text-gray-500">Started</p>
            <p className="mt-1 text-[12px]">{job.timestamps?.startedAt || "-"}</p>
          </div>
          <div className="rounded border p-2">
            <p className="text-[11px] text-gray-500">Finished</p>
            <p className="mt-1 text-[12px]">{job.timestamps?.finishedAt || "-"}</p>
          </div>
          <div className="rounded border p-2">
            <p className="text-[11px] text-gray-500">Updated</p>
            <p className="mt-1 text-[12px]">{job.timestamps?.updatedAt || "-"}</p>
          </div>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <div className="rounded border p-2">
            <p className="text-[11px] text-gray-500">Executor model</p>
            <p className="mt-1 text-[12px]">{execution.executor?.executor_model || "n/a"}</p>
          </div>
          <div className="rounded border p-2">
            <p className="text-[11px] text-gray-500">Executor backend</p>
            <p className="mt-1 text-[12px]">{execution.executor?.executor_backend || "-"}</p>
          </div>
          <div className="rounded border p-2">
            <p className="text-[11px] text-gray-500">Execution mode</p>
            <p className="mt-1 text-[12px]">{execution.execution_mode || "local_cli"}</p>
          </div>
          <div className="rounded border p-2">
            <p className="text-[11px] text-gray-500">Executor host</p>
            <p className="mt-1 text-[12px]">{execution.executor?.executor_host || "-"}</p>
          </div>
          <div className="rounded border p-2">
            <p className="text-[11px] text-gray-500">Transport</p>
            <p className="mt-1 text-[12px]">{execution.executor?.executor_transport || job.metadataJson?.executor_transport || "-"}</p>
          </div>
        </div>

        {transportReport ? (
          <div className="mt-3 rounded border bg-zinc-50 p-3">
            <p className="text-[12px] font-medium">Remote transport lifecycle</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4 text-[12px] text-gray-700">
              <div className="rounded border bg-white p-2">
                <p className="text-[11px] text-gray-500">Target</p>
                <p className="mt-1 break-all">{transportReport.target || execution.executor?.executor_transport_target || "-"}</p>
              </div>
              <div className="rounded border bg-white p-2">
                <p className="text-[11px] text-gray-500">Host reached</p>
                <p className="mt-1">{transportReport.hostReached ? "yes" : "no"}</p>
              </div>
              <div className="rounded border bg-white p-2">
                <p className="text-[11px] text-gray-500">Execution started</p>
                <p className="mt-1">{transportReport.executionStarted ? "yes" : "no"}</p>
              </div>
              <div className="rounded border bg-white p-2">
                <p className="text-[11px] text-gray-500">Output returned</p>
                <p className="mt-1">{transportReport.outputReceived ? "yes" : "no"}</p>
              </div>
              <div className="rounded border bg-white p-2">
                <p className="text-[11px] text-gray-500">Sync attempted</p>
                <p className="mt-1">{transportReport.syncAttempted ? "yes" : "no"}</p>
              </div>
              <div className="rounded border bg-white p-2">
                <p className="text-[11px] text-gray-500">Sync completed</p>
                <p className="mt-1">{transportReport.syncCompleted ? "yes" : "no"}</p>
              </div>
              <div className="rounded border bg-white p-2">
                <p className="text-[11px] text-gray-500">Synced paths</p>
                <p className="mt-1">{Array.isArray(transportReport.syncedPaths) ? transportReport.syncedPaths.length : 0}</p>
              </div>
              <div className="rounded border bg-white p-2">
                <p className="text-[11px] text-gray-500">Skipped paths</p>
                <p className="mt-1">{Array.isArray(transportReport.skippedPaths) ? transportReport.skippedPaths.length : 0}</p>
              </div>
            </div>
          </div>
        ) : null}

        {job.schedule ? (
          <div className="mt-3 rounded border bg-zinc-50 p-3 text-[12px] text-gray-700">
            Scheduled origin: {job.schedule.schedule_title} via {job.schedule.trigger_type}.
          </div>
        ) : null}

        {job.errorJson ? (
          <div className="mt-3 rounded border border-red-300 bg-red-50 p-3 text-[12px] text-red-950">
            <p className="font-medium">Execution error</p>
            <p className="mt-2">{job.errorJson.message || "Unknown broker error."}</p>
            {failure ? (
              <div className="mt-3 space-y-1 text-[11px]">
                <p>Likely source: {describeFailureSource(failure.likelySource)}</p>
                {failure.nextSafeActionTitle ? (
                  <p>Next safe action: {failure.nextSafeActionTitle}</p>
                ) : null}
                {job.assist?.failure?.simplifiedExplanation ? (
                  <p>Simplified explanation: {job.assist.failure.simplifiedExplanation}</p>
                ) : null}
                {job.assist?.failure?.suggestedNextStep ? (
                  <p>Suggested next step: {job.assist.failure.suggestedNextStep}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {reviewRuntime?.fallback_used ? (
          <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-[12px] text-amber-950">
            <p className="font-medium">Fallback-backed review runtime</p>
            <p className="mt-2">
              Backend: {reviewRuntime.review_backend || "fallback"}.
              {" "}Fallback count: {reviewRuntime.fallback_count || 0}.
            </p>
            {reviewRuntime.fallback_reason ? (
              <p className="mt-2 text-xs">{reviewRuntime.fallback_reason}</p>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div className="mt-3 rounded border border-red-300 bg-red-50 p-3 text-[12px] text-red-950">
            {error}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-3">
          <JobRerunButton job={job} label={job.rerun?.label || "Rerun job"} redirectToJob />
          {job.links?.session ? (
            <Link href={job.links.session} className="rounded border px-3 py-1.5 text-[12px]">
              Open session inspector
            </Link>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded border border-zinc-300 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold">Artifacts</h3>
          <div className="mt-4 space-y-3">
            {job.artifacts.length ? (
              job.artifacts.map((artifact) => (
                <div key={artifact.id} className="rounded border p-3">
                  <p className="text-[12px] font-medium">{artifact.label}</p>
                  <p className="mt-1 break-all font-mono text-[11px] text-gray-500">{artifact.path || "No path recorded."}</p>
                  <p className="mt-1 text-[12px] text-gray-700">
                    {artifact.generatedAt || artifact.summary || "Artifact updated in this run."}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-[12px] text-gray-700">No artifact changes were attached to this job.</p>
            )}
          </div>
        </div>

        <div className="rounded border border-zinc-300 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold">Logs</h3>
          <pre className="mt-3 max-h-[36rem] overflow-auto rounded border bg-stone-950 p-3 text-[11px] text-stone-100">
            {job.log || "No logs captured."}
          </pre>
        </div>
      </section>

      <section className="rounded border border-zinc-300 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold">Command input</h3>
        <div className="mt-3 grid gap-3 xl:grid-cols-3">
          <pre className="overflow-auto rounded border bg-zinc-50 p-3 text-[11px]">
            {JSON.stringify(job.input || {}, null, 2)}
          </pre>
          <pre className="overflow-auto rounded border bg-zinc-50 p-3 text-[11px]">
            {JSON.stringify(job.command || {}, null, 2)}
          </pre>
          <pre className="overflow-auto rounded border bg-zinc-50 p-3 text-[11px]">
            {JSON.stringify(
              {
                sessionIds: job.sessionIds || [],
                actionContext: job.metadataJson?.action_context || {},
                execution: execution,
              },
              null,
              2
            )}
          </pre>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/admin/jobs" className="rounded border px-3 py-1.5 text-[12px]">
            Back to jobs
          </Link>
          <Link href="/admin/artifacts" className="rounded border px-3 py-1.5 text-[12px]">
            Open artifact inspector
          </Link>
        </div>
      </section>
    </div>
  );
}
