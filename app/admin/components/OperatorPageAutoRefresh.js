"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const ACTIVE_JOB_STATUSES = new Set(["queued", "running"]);

export default function OperatorPageAutoRefresh({
  sessionId = "",
  intervalMs = 3000,
}) {
  const router = useRouter();
  const signatureRef = useRef("");

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch("/api/admin/operator/jobs?limit=25", {
          method: "GET",
          cache: "no-store",
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          return;
        }

        const jobs = Array.isArray(payload.jobs) ? payload.jobs : [];
        const relevantJobs = sessionId
          ? jobs.filter((job) => Array.isArray(job.sessionIds) && job.sessionIds.includes(sessionId))
          : jobs;
        const hasActiveJobs = relevantJobs.some((job) => ACTIVE_JOB_STATUSES.has(job.status));
        const signature = relevantJobs
          .slice(0, 12)
          .map((job) => `${job.id}:${job.status}:${job.timestamps?.updatedAt || ""}`)
          .join("|");

        if (!cancelled && hasActiveJobs && signatureRef.current && signatureRef.current !== signature) {
          router.refresh();
        }

        if (!cancelled) {
          signatureRef.current = signature;
        }
      } catch {
        // Best-effort only. Page inspection should still work without live refresh.
      }
    }

    poll();
    const intervalId = window.setInterval(poll, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [intervalMs, router, sessionId]);

  return null;
}
