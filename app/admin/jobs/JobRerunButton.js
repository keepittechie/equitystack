"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import JobStatusBadge from "./JobStatusBadge";
import { readAdminJsonResponse } from "@/app/admin/components/readAdminJsonResponse";

const TERMINAL_JOB_STATUSES = new Set(["success", "failed", "blocked", "cancelled"]);

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function buttonClasses(tone, disabled) {
  const base =
    "inline-flex items-center justify-center rounded border px-3 py-1.5 text-[12px] font-medium transition";
  const palette =
    tone === "danger"
      ? "border-[var(--admin-danger-line)] bg-[var(--admin-danger-surface)] text-[var(--danger)] hover:bg-[var(--admin-danger-surface)]"
      : "border-[var(--admin-line)] bg-[var(--admin-surface)] text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)]";
  const disabledClasses = disabled ? " cursor-not-allowed opacity-60" : "";
  return `${base} ${palette}${disabledClasses}`;
}

export default function JobRerunButton({
  job,
  label = "",
  redirectToJob = false,
  refreshOnTerminal = true,
}) {
  const router = useRouter();
  const refreshRef = useRef("");
  const [resultJob, setResultJob] = useState(null);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [confirmationChecked, setConfirmationChecked] = useState(false);
  const [typedYes, setTypedYes] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!resultJob?.id || TERMINAL_JOB_STATUSES.has(resultJob.status)) {
      if (
        refreshOnTerminal &&
        resultJob?.id &&
        TERMINAL_JOB_STATUSES.has(resultJob.status) &&
        refreshRef.current !== resultJob.id
      ) {
        refreshRef.current = resultJob.id;
        window.setTimeout(() => {
          router.refresh();
        }, 250);
      }
      return undefined;
    }

    let cancelled = false;
    const intervalId = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/admin/operator/jobs/${resultJob.id}`, {
          method: "GET",
          cache: "no-store",
        });
        const payload = await readAdminJsonResponse(response, `/api/admin/operator/jobs/${resultJob.id}`);
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || "Failed to refresh the rerun job.");
        }
        if (!cancelled) {
          setResultJob(payload.job);
          setError("");
        }
      } catch (pollError) {
        if (!cancelled) {
          setError(pollError instanceof Error ? pollError.message : "Failed to refresh the rerun job.");
        }
      }
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [refreshOnTerminal, resultJob, router]);

  function resetConfirmation() {
    setConfirmation(null);
    setConfirmationChecked(false);
    setTypedYes("");
  }

  async function submitRerun(overrideConfirmation = null) {
    const response = await fetch(`/api/admin/operator/jobs/${job.id}/rerun`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        confirmation: overrideConfirmation || undefined,
      }),
    });
    const payload = await readAdminJsonResponse(response, `/api/admin/operator/jobs/${job.id}/rerun`);
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || "Failed to rerun the job.");
    }
    return payload;
  }

  function handleRerun() {
    setError("");

    startTransition(async () => {
      try {
        const payload = await submitRerun();
        if (payload.mode === "confirmation_required") {
          setConfirmation(payload.confirmation);
          return;
        }
        resetConfirmation();
        setResultJob(payload.job || null);
        if (redirectToJob && payload.job?.id) {
          router.push(`/admin/jobs/${payload.job.id}`);
          router.refresh();
        }
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Failed to rerun the job.");
      }
    });
  }

  function handleConfirmRerun() {
    setError("");

    startTransition(async () => {
      try {
        const payload = await submitRerun({
          checked: confirmationChecked,
          typedYes,
        });
        if (payload.mode === "confirmation_required") {
          setConfirmation(payload.confirmation);
          return;
        }
        resetConfirmation();
        setResultJob(payload.job || null);
        if (redirectToJob && payload.job?.id) {
          router.push(`/admin/jobs/${payload.job.id}`);
          router.refresh();
        }
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Failed to rerun the job.");
      }
    });
  }

  const isBusy = isPending || (resultJob && !TERMINAL_JOB_STATUSES.has(resultJob.status));
  const buttonTone = job?.rerun?.requiresConfirmation ? "danger" : "default";

  if (!job?.rerun?.canRerun) {
    return job?.rerun?.reason ? (
      <p className="text-xs text-[var(--admin-text-muted)]">{job.rerun.reason}</p>
    ) : null;
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleRerun}
        disabled={isBusy}
        className={buttonClasses(buttonTone, isBusy)}
      >
        {isPending ? "Starting…" : label || job.rerun.label || "Rerun job"}
      </button>

      {error ? (
        <div className="rounded border border-[var(--admin-danger-line)] bg-[var(--admin-danger-surface)] p-3 text-xs text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      {resultJob ? (
        <div className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <JobStatusBadge status={resultJob.status} />
              <span className="text-xs text-[var(--admin-text-muted)]">{resultJob.id}</span>
            </div>
            <Link href={`/admin/jobs/${resultJob.id}`} className="text-xs text-[var(--admin-link)] underline">
              Open job
            </Link>
          </div>
          <p className="mt-2 text-xs text-[var(--admin-text-soft)]">{resultJob.summary || "Rerun queued."}</p>
        </div>
      ) : null}

      {confirmation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 px-4">
          <div className="w-full max-w-lg rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] p-6 shadow-xl">
            <div className="space-y-2">
              <p className="text-sm text-[var(--admin-text-muted)]">Rerun confirmation</p>
              <h3 className="text-xl font-semibold text-[var(--admin-text)]">{confirmation.title}</h3>
              <p className="text-sm text-[var(--admin-text-soft)]">{confirmation.description}</p>
            </div>

            <label className="mt-4 flex items-start gap-3 rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-3 text-sm text-[var(--admin-text)]">
              <input
                type="checkbox"
                checked={confirmationChecked}
                onChange={(event) => setConfirmationChecked(event.target.checked)}
              />
              <span>{confirmation.checkboxLabel}</span>
            </label>

            {confirmation.requireTypedYes ? (
              <label className="mt-4 block space-y-2">
                <span className="text-sm font-medium text-[var(--admin-text)]">Type YES to continue</span>
                <input
                  type="text"
                  value={typedYes}
                  onChange={(event) => setTypedYes(event.target.value)}
                  className="w-full rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-text)] outline-none focus:border-[var(--admin-link)]"
                  placeholder="YES"
                />
              </label>
            ) : null}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={resetConfirmation}
                className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] px-4 py-2 text-sm text-[var(--admin-text)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRerun}
                disabled={!confirmationChecked || (confirmation.requireTypedYes && normalizeString(typedYes) !== "YES") || isPending}
                className={buttonClasses("danger", !confirmationChecked || (confirmation.requireTypedYes && normalizeString(typedYes) !== "YES") || isPending)}
              >
                {isPending ? "Starting…" : "Confirm rerun"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
