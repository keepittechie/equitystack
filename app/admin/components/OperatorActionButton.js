"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import JobStatusBadge from "@/app/admin/jobs/JobStatusBadge";
import { readAdminJsonResponse } from "@/app/admin/components/readAdminJsonResponse";

const TERMINAL_JOB_STATUSES = new Set(["success", "failed", "blocked", "cancelled"]);

function buttonClasses(tone, disabled) {
  const base =
    "inline-flex items-center justify-center rounded border px-2.5 py-1 text-[12px] font-medium transition";
  const palette =
    tone === "danger"
      ? "border-[var(--admin-danger-line)] bg-[var(--admin-danger-surface)] text-[var(--danger)] hover:bg-[var(--admin-danger-surface)]"
      : tone === "primary"
        ? "border-[var(--admin-link)] bg-[var(--admin-link)] text-[var(--background)] hover:bg-[var(--admin-link)]"
        : "border-[var(--admin-line)] bg-[var(--admin-surface)] text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)]";
  const disabledClasses = disabled ? " cursor-not-allowed opacity-60" : "";
  return `${base} ${palette}${disabledClasses}`;
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export default function OperatorActionButton({
  action,
  label,
  input = {},
  context = {},
  tone = "default",
  helperText = "",
  confirmation = null,
  redirectToJob = false,
  refreshOnTerminal = true,
}) {
  const router = useRouter();
  const refreshRef = useRef("");
  const [job, setJob] = useState(null);
  const [error, setError] = useState("");
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [confirmationChecked, setConfirmationChecked] = useState(false);
  const [typedYes, setTypedYes] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!job?.id || TERMINAL_JOB_STATUSES.has(job.status)) {
      if (
        refreshOnTerminal &&
        job?.id &&
        TERMINAL_JOB_STATUSES.has(job.status) &&
        refreshRef.current !== job.id
      ) {
        refreshRef.current = job.id;
        window.setTimeout(() => {
          router.refresh();
        }, 250);
      }
      return undefined;
    }

    let cancelled = false;
    const intervalId = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/admin/operator/jobs/${job.id}`, {
          method: "GET",
          cache: "no-store",
        });
        const payload = await readAdminJsonResponse(response, `/api/admin/operator/jobs/${job.id}`);
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || "Failed to refresh the job.");
        }
        if (!cancelled) {
          setJob(payload.job);
          setError("");
        }
      } catch (pollError) {
        if (!cancelled) {
          setError(pollError instanceof Error ? pollError.message : "Failed to refresh the job.");
        }
      }
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [job, refreshOnTerminal, router]);

  function resetConfirmation() {
    setConfirmationOpen(false);
    setConfirmationChecked(false);
    setTypedYes("");
  }

  function canSubmitConfirmation() {
    if (!confirmation) {
      return true;
    }

    if (!confirmationChecked) {
      return false;
    }

    if (confirmation.requireTypedYes && normalizeString(typedYes) !== "YES") {
      return false;
    }

    return true;
  }

  async function queueAction() {
    const response = await fetch("/api/admin/operator/jobs", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        actionId: action.id,
        input,
        context,
      }),
    });
    const payload = await readAdminJsonResponse(response, "/api/admin/operator/jobs");
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || "Failed to start the action.");
    }

    setJob(payload.job || null);
    if (redirectToJob && payload.job?.id) {
      router.push(`/admin/jobs/${payload.job.id}`);
      router.refresh();
    }
  }

  function handleStart() {
    setError("");

    startTransition(async () => {
      try {
        await queueAction();
        resetConfirmation();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Failed to start the action.");
      }
    });
  }

  function handleClick() {
    if (confirmation) {
      setError("");
      setConfirmationOpen(true);
      return;
    }
    handleStart();
  }

  const isBusy = isPending || (job && !TERMINAL_JOB_STATUSES.has(job.status));

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isBusy}
        className={buttonClasses(tone, isBusy)}
      >
        {isPending ? "Starting…" : label}
      </button>

      {helperText ? <p className="max-w-md text-xs text-[var(--admin-text-muted)]">{helperText}</p> : null}

      {error ? (
        <div className="rounded border border-[var(--admin-danger-line)] bg-[var(--admin-danger-surface)] p-2 text-[11px] text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      {job ? (
        <div className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <JobStatusBadge status={job.status} />
              <span className="font-mono text-[11px] text-[var(--admin-text-muted)]">{job.id}</span>
            </div>
            <Link href={`/admin/jobs/${job.id}`} className="text-[11px] text-[var(--admin-link)] underline">
              Open job
            </Link>
          </div>
          <p className="mt-2 text-[11px] text-[var(--admin-text-soft)]">{job.summary || `${action.title} queued.`}</p>
          {job.errorJson?.message ? (
            <p className="mt-2 text-[11px] text-[var(--danger)]">{job.errorJson.message}</p>
          ) : null}
        </div>
      ) : null}

      {confirmationOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 px-4">
          <div className="w-full max-w-lg rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] p-4 shadow-xl">
            <div className="space-y-2">
              <p className="text-[12px] text-[var(--admin-text-muted)]">{action.workflowFamily}</p>
              <h3 className="text-lg font-semibold text-[var(--admin-text)]">{confirmation.title || label}</h3>
              <p className="text-[12px] text-[var(--admin-text-soft)]">
                {confirmation.description || "This action requires explicit confirmation."}
              </p>
            </div>

            <label className="mt-4 flex items-start gap-3 rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-3 text-[12px] text-[var(--admin-text)]">
              <input
                type="checkbox"
                checked={confirmationChecked}
                onChange={(event) => setConfirmationChecked(event.target.checked)}
              />
              <span>{confirmation.checkboxLabel || "I understand this is a guarded mutating action."}</span>
            </label>

            {confirmation.requireTypedYes ? (
              <label className="mt-4 block space-y-2">
                <span className="text-[12px] font-medium text-[var(--admin-text)]">Type YES to continue</span>
                <input
                  type="text"
                  value={typedYes}
                  onChange={(event) => setTypedYes(event.target.value)}
                  className="w-full rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] px-2 py-1.5 text-[12px] text-[var(--admin-text)] outline-none focus:border-[var(--admin-link)]"
                  placeholder="YES"
                />
              </label>
            ) : null}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={resetConfirmation}
                className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] px-3 py-1.5 text-[12px] text-[var(--admin-text)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStart}
                disabled={!canSubmitConfirmation() || isPending}
                className={buttonClasses("danger", !canSubmitConfirmation() || isPending)}
              >
                {isPending ? "Starting…" : "Confirm action"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
