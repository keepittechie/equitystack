"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import JobStatusBadge from "@/app/admin/jobs/JobStatusBadge";
import { readAdminJsonResponse } from "@/app/admin/components/readAdminJsonResponse";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export default function CompactActionSelect({ actions = [] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState("");
  const [job, setJob] = useState(null);
  const [error, setError] = useState("");
  const [confirmationAction, setConfirmationAction] = useState(null);
  const [confirmationChecked, setConfirmationChecked] = useState(false);
  const [typedYes, setTypedYes] = useState("");
  const [isPending, startTransition] = useTransition();

  async function queueDescriptor(descriptor) {
    const response = await fetch("/api/admin/operator/jobs", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        actionId: descriptor.action.id,
        input: descriptor.input || {},
        context: descriptor.context || {},
      }),
    });
    const payload = await readAdminJsonResponse(response, "/api/admin/operator/jobs");
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || "Failed to start the action.");
    }

    setJob(payload.job || null);
    setSelectedId("");
    router.refresh();
  }

  function runDescriptor(descriptor) {
    setError("");
    startTransition(async () => {
      try {
        await queueDescriptor(descriptor);
        setConfirmationAction(null);
        setConfirmationChecked(false);
        setTypedYes("");
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "Failed to start the action."
        );
      }
    });
  }

  function handleSelectChange(nextId) {
    setSelectedId(nextId);
    const descriptor = actions.find((entry) => entry.id === nextId);
    if (!descriptor) {
      return;
    }
    if (descriptor.confirmation) {
      setConfirmationAction(descriptor);
      return;
    }
    runDescriptor(descriptor);
  }

  return (
    <div className="space-y-1">
      <select
        value={selectedId}
        onChange={(event) => handleSelectChange(event.target.value)}
        disabled={isPending || !actions.length}
        className="w-full min-w-[9rem] rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] px-2 py-1 text-[12px] text-[var(--admin-text)] outline-none focus:border-[var(--admin-link)]"
      >
        <option value="">{actions.length ? "Action…" : "No actions"}</option>
        {actions.map((descriptor) => (
          <option key={descriptor.id} value={descriptor.id}>
            {descriptor.label}
          </option>
        ))}
      </select>

      {job ? (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--admin-text-muted)]">
          <JobStatusBadge status={job.status} />
          <Link href={`/admin/jobs/${job.id}`} className="text-[var(--admin-link)] underline">
            job
          </Link>
        </div>
      ) : null}

      {error ? <div className="text-[11px] text-[var(--danger)]">{error}</div> : null}

      {confirmationAction ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 px-4">
          <div className="w-full max-w-lg rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] p-4 shadow-xl">
            <div className="space-y-2">
              <p className="text-[12px] text-[var(--admin-text-muted)]">{confirmationAction.action.workflowFamily}</p>
              <h3 className="text-lg font-semibold text-[var(--admin-text)]">
                {confirmationAction.confirmation?.title || confirmationAction.label}
              </h3>
              <p className="text-[12px] text-[var(--admin-text-soft)]">
                {confirmationAction.confirmation?.description ||
                  "This action requires explicit confirmation."}
              </p>
            </div>

            <label className="mt-4 flex items-start gap-3 rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-3 text-[12px] text-[var(--admin-text)]">
              <input
                type="checkbox"
                checked={confirmationChecked}
                onChange={(event) => setConfirmationChecked(event.target.checked)}
              />
              <span>
                {confirmationAction.confirmation?.checkboxLabel ||
                  "I understand this is a guarded action."}
              </span>
            </label>

            {confirmationAction.confirmation?.requireTypedYes ? (
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
                onClick={() => {
                  setConfirmationAction(null);
                  setConfirmationChecked(false);
                  setTypedYes("");
                  setSelectedId("");
                }}
                className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] px-3 py-1.5 text-[12px] text-[var(--admin-text)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => runDescriptor(confirmationAction)}
                disabled={
                  !confirmationChecked ||
                  (confirmationAction.confirmation?.requireTypedYes &&
                    normalizeString(typedYes) !== "YES") ||
                  isPending
                }
                className="rounded border border-[var(--admin-danger-line)] bg-[var(--admin-danger-surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-60"
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
