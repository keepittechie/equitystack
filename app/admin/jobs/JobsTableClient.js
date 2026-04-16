"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatAdminDateTime } from "@/app/admin/components/adminDateTime";
import { readAdminJsonResponse } from "@/app/admin/components/readAdminJsonResponse";
import JobStatusBadge from "./JobStatusBadge";
import JobRerunButton from "./JobRerunButton";

const ACTIVE_STATUSES = new Set(["queued", "running"]);

function formatDuration(startedAt, finishedAt) {
  if (!startedAt || !finishedAt) {
    return "—";
  }

  const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return "—";
  }

  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  const seconds = Math.round(durationMs / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

export default function JobsTableClient({ initialJobs }) {
  const [jobs, setJobs] = useState(initialJobs || []);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!jobs.some((job) => ACTIVE_STATUSES.has(job.status))) {
      return undefined;
    }

    let cancelled = false;
    const intervalId = window.setInterval(async () => {
      try {
        const response = await fetch("/api/admin/operator/jobs?limit=50", {
          method: "GET",
          cache: "no-store",
        });
        const payload = await readAdminJsonResponse(response, "/api/admin/operator/jobs?limit=50");
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || "Failed to refresh jobs.");
        }
        if (!cancelled) {
          setJobs(payload.jobs || []);
          setError("");
        }
      } catch (refreshError) {
        if (!cancelled) {
          setError(refreshError instanceof Error ? refreshError.message : "Failed to refresh jobs.");
        }
      }
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [jobs]);

  return (
    <section className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-3 shadow-sm">
      {error ? (
        <div className="mb-3 rounded border border-[var(--admin-danger-line)] bg-[var(--admin-danger-surface)] p-3 text-[12px] text-[var(--danger)]">
          {error}
        </div>
      ) : null}
      <div className="overflow-x-auto rounded border border-[var(--admin-line)] bg-[var(--admin-surface)]">
        <table className="min-w-[1320px] w-full text-[11px]">
          <thead className="bg-[var(--admin-surface-muted)] text-left text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">
            <tr>
              <th className="border-b border-[var(--admin-line)] px-2 py-1">Status</th>
              <th className="border-b border-[var(--admin-line)] px-2 py-1">Action</th>
              <th className="border-b border-[var(--admin-line)] px-2 py-1">Workflow</th>
              <th className="border-b border-[var(--admin-line)] px-2 py-1">Summary</th>
              <th className="border-b border-[var(--admin-line)] px-2 py-1">Started</th>
              <th className="border-b border-[var(--admin-line)] px-2 py-1">Duration</th>
              <th className="border-b border-[var(--admin-line)] px-2 py-1">Mode</th>
              <th className="border-b border-[var(--admin-line)] px-2 py-1">Executor</th>
              <th className="border-b border-[var(--admin-line)] px-2 py-1">Session</th>
              <th className="border-b border-[var(--admin-line)] px-2 py-1">Action</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="align-top odd:bg-[var(--admin-surface)] even:bg-[var(--admin-surface-muted)] hover:bg-[var(--admin-surface-soft)]">
                <td className="border-b border-[var(--admin-line)] px-2 py-1">
                  <JobStatusBadge status={job.status} />
                </td>
                <td className="border-b border-[var(--admin-line)] px-2 py-1">
                  <div className="font-medium text-[var(--admin-text)]">{job.actionTitle}</div>
                  <div className="mt-0.5 font-mono text-[10px] text-[var(--admin-text-muted)]">{job.id}</div>
                </td>
                <td className="border-b border-[var(--admin-line)] px-2 py-1 text-[var(--admin-text-soft)]">{job.workflowFamily}</td>
                <td className="border-b border-[var(--admin-line)] px-2 py-1">
                  <div className="max-w-[320px] truncate text-[var(--admin-text-soft)]" title={job.summary || "No summary yet."}>
                    {job.summary || "No summary yet."}
                  </div>
                  {job.failure?.likelySource ? (
                    <div className="mt-0.5 text-[10px] text-[var(--danger)]">failure: {job.failure.likelySource}</div>
                  ) : null}
                </td>
                <td className="border-b border-[var(--admin-line)] px-2 py-1 text-[var(--admin-text-soft)]">
                  {formatAdminDateTime(job.timestamps?.startedAt || job.timestamps?.createdAt)}
                </td>
                <td className="border-b border-[var(--admin-line)] px-2 py-1 font-mono text-[10px] text-[var(--admin-text)]">
                  {formatDuration(job.timestamps?.startedAt, job.timestamps?.finishedAt)}
                </td>
                <td className="border-b border-[var(--admin-line)] px-2 py-1 font-mono text-[10px] text-[var(--admin-text)]">
                  {job.execution?.execution_mode || job.metadataJson?.execution_mode || "local_cli"}
                </td>
                <td className="border-b border-[var(--admin-line)] px-2 py-1 font-mono text-[10px] text-[var(--admin-text)]">
                  <div className="max-w-[180px] truncate" title={`${job.execution?.executor?.executor_host || job.metadataJson?.executor?.executor_host || "localhost"} / ${job.execution?.executor?.executor_model || job.metadataJson?.executor?.executor_model || "-"}`}>
                    {job.execution?.executor?.executor_host || job.metadataJson?.executor?.executor_host || "localhost"} /{" "}
                    {job.execution?.executor?.executor_model || job.metadataJson?.executor?.executor_model || "-"}
                  </div>
                </td>
                <td className="border-b border-[var(--admin-line)] px-2 py-1 font-mono text-[10px] text-[var(--admin-text)]">
                  {job.sessionIds?.[0] || "—"}
                </td>
                <td className="border-b border-[var(--admin-line)] px-2 py-1">
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/admin/jobs/${job.id}`} className="text-[11px] text-[var(--admin-link)] underline">
                      Open
                    </Link>
                    <JobRerunButton job={job} label={job.rerun?.label || "Retry"} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
