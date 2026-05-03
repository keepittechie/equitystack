"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatAdminDateTime } from "@/app/admin/components/adminDateTime";
import JobStatusBadge from "@/app/admin/jobs/JobStatusBadge";
import { readAdminJsonResponse } from "@/app/admin/components/readAdminJsonResponse";
import {
  deriveExecutionMonitorState,
  executionPhaseLabel,
  TERMINAL_JOB_STATUSES,
} from "./executionMonitor";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function buildInitialInput(action) {
  const next = {};
  const fields = action?.inputSchema?.fields || {};

  for (const [fieldName, field] of Object.entries(fields)) {
    if (field.type === "boolean") {
      next[fieldName] = Boolean(field.default);
    } else {
      next[fieldName] = field.default ?? "";
    }
  }

  return next;
}

function isPresent(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  return normalizeString(value).length > 0;
}

function validateInput(action, input) {
  const errors = [];
  const constraints = action?.inputSchema?.constraints || [];

  for (const constraint of constraints) {
    if (constraint.kind === "requiresOneOf") {
      const hasOne = constraint.fields.some((field) => isPresent(input[field]));
      if (!hasOne) {
        errors.push(constraint.message);
      }
      continue;
    }

    if (constraint.kind === "requiresAll") {
      const hasAll = constraint.fields.every((field) => isPresent(input[field]));
      if (!hasAll) {
        errors.push(constraint.message);
      }
      continue;
    }

    if (constraint.kind === "mutuallyExclusive") {
      const presentFields = constraint.fields.filter((field) => isPresent(input[field]));
      if (presentFields.length > 1) {
        errors.push(constraint.message);
      }
      continue;
    }

    if (constraint.kind === "requiresWhen") {
      if (isPresent(input[constraint.ifField]) && !isPresent(input[constraint.requiresField])) {
        errors.push(constraint.message);
      }
      continue;
    }

    if (constraint.kind === "requiresTogether") {
      if (isPresent(input[constraint.ifField]) && !isPresent(input[constraint.withField])) {
        errors.push(constraint.message);
      }
    }
  }

  return errors;
}

function renderFieldHint(field) {
  if (field.format === "path") {
    return "Path";
  }
  if (field.format === "batch-name") {
    return "Batch name";
  }
  return field.type;
}

function TraceTable({ trace = [] }) {
  if (!trace.length) {
    return null;
  }

  return (
    <div className="overflow-x-auto rounded border border-[var(--admin-line)] bg-[var(--admin-surface)]">
      <table className="min-w-full text-[11px]">
        <tbody>
          {trace.map((entry) => (
            <tr key={entry.key} className="odd:bg-[var(--admin-surface)] even:bg-[var(--admin-surface-muted)]">
              <td className="border-b border-[var(--admin-line)] px-2 py-1 font-mono uppercase tracking-wide text-[var(--admin-text-muted)]">
                {entry.label}
              </td>
              <td className="border-b border-[var(--admin-line)] px-2 py-1 text-[var(--admin-text-soft)]">{entry.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FieldRow({ fieldName, field, value, onChange }) {
  if (field.type === "boolean") {
    return (
      <label className="flex items-center gap-3 rounded border p-2 text-[12px]">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(fieldName, event.target.checked)}
        />
        <span>
          <span className="font-medium">{field.label || fieldName}</span>
          <span className="ml-2 text-[11px] text-gray-500">{renderFieldHint(field)}</span>
        </span>
      </label>
    );
  }

  return (
    <label className="block space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] font-medium">{field.label || fieldName}</span>
        <span className="text-[11px] text-gray-500">{renderFieldHint(field)}</span>
      </div>
      <input
        type="text"
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(fieldName, event.target.value)}
        className="w-full rounded border px-2 py-1.5 text-[12px]"
        placeholder={field.placeholder || field.label || fieldName}
      />
    </label>
  );
}

export default function ActionLauncher({
  title = "Launch Operator Action",
  description = "Run a registered action through the broker and inspect the resulting job.",
  allowedActionIds = null,
  initialActionId = "",
  buttonLabel = "Start action",
  compact = false,
  redirectToJob = false,
}) {
  const router = useRouter();
  const archiveRef = useRef("");
  const refreshRef = useRef("");
  const [actions, setActions] = useState([]);
  const [selectedActionId, setSelectedActionId] = useState(initialActionId);
  const [input, setInput] = useState({});
  const [executionMode, setExecutionMode] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [activeExecution, setActiveExecution] = useState(null);
  const [recentExecutions, setRecentExecutions] = useState([]);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [confirmationChecked, setConfirmationChecked] = useState(false);
  const [typedYes, setTypedYes] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    async function loadActions() {
      try {
        setIsLoading(true);
        setLoadError("");
        const response = await fetch("/api/admin/operator/actions", {
          method: "GET",
          cache: "no-store",
        });
        const payload = await readAdminJsonResponse(response, "/api/admin/operator/actions");
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || "Failed to load actions.");
        }

        if (cancelled) {
          return;
        }

        const nextActions = Array.isArray(payload.actions) ? payload.actions : [];
        const filteredActions = Array.isArray(allowedActionIds) && allowedActionIds.length
          ? nextActions.filter((action) => allowedActionIds.includes(action.id))
          : nextActions;
        setActions(filteredActions);

        const firstActionId =
          filteredActions.find((action) => action.id === initialActionId)?.id ||
          filteredActions[0]?.id ||
          "";
        setSelectedActionId(firstActionId);
        const firstAction = filteredActions.find((action) => action.id === firstActionId) || null;
        setInput(buildInitialInput(firstAction));
        setExecutionMode(firstAction?.executionModes?.defaultMode || "local_cli");
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Failed to load actions.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadActions();
    return () => {
      cancelled = true;
    };
  }, [allowedActionIds, initialActionId]);

  const selectedAction = useMemo(
    () => actions.find((action) => action.id === selectedActionId) || null,
    [actions, selectedActionId]
  );
  const availableExecutionModes = selectedAction?.executionModes?.allowedModes || ["local_cli"];
  const visibleFields = Object.entries(selectedAction?.inputSchema?.fields || {});
  const requiresMutatingConfirmation = Boolean(
    selectedAction?.execution?.mutating && input?.apply && input?.yes
  );
  const activeLifecycle = deriveExecutionMonitorState(activeExecution?.job, {
    commandText: activeExecution?.commandText,
  });
  const executionLocked = isPending || Boolean(activeLifecycle?.shouldPoll);

  useEffect(() => {
    if (!activeExecution?.job?.id || !activeLifecycle?.shouldPoll) {
      return undefined;
    }

    let cancelled = false;
    const intervalId = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/admin/operator/jobs/${activeExecution.job.id}`, {
          method: "GET",
          cache: "no-store",
        });
        const payload = await readAdminJsonResponse(
          response,
          `/api/admin/operator/jobs/${activeExecution.job.id}`
        );
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || "Failed to refresh the active execution.");
        }
        if (!cancelled) {
          setActiveExecution((current) =>
            current?.job?.id === payload.job?.id
              ? { ...current, job: payload.job }
              : current
          );
          setFormError("");
        }
      } catch (error) {
        if (!cancelled) {
          setFormError(
            error instanceof Error ? error.message : "Failed to refresh the active execution."
          );
        }
      }
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeExecution, activeLifecycle]);

  useEffect(() => {
    if (!activeExecution?.job?.id || !TERMINAL_JOB_STATUSES.has(activeExecution.job.status)) {
      return;
    }

    const key = `${activeExecution.job.id}:${activeExecution.job.status}`;
    if (refreshRef.current !== key) {
      refreshRef.current = key;
      window.setTimeout(() => {
        router.refresh();
      }, 250);
    }

    if (activeLifecycle?.isStopPoint || archiveRef.current === key) {
      return;
    }

    archiveRef.current = key;
    setRecentExecutions((current) =>
      [{ ...activeExecution }, ...current.filter((item) => item.job.id !== activeExecution.job.id)].slice(0, 6)
    );
    setActiveExecution(null);
  }, [activeExecution, activeLifecycle, router]);

  function handleActionChange(nextActionId) {
    const nextAction = actions.find((action) => action.id === nextActionId) || null;
    setSelectedActionId(nextActionId);
    setInput(buildInitialInput(nextAction));
    setExecutionMode(nextAction?.executionModes?.defaultMode || "local_cli");
    setFormError("");
    resetConfirmation();
  }

  function handleFieldChange(fieldName, value) {
    setInput((current) => ({
      ...current,
      [fieldName]: value,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!selectedAction) {
      setFormError("Select an action before submitting.");
      return;
    }

    const errors = validateInput(selectedAction, input);
    if (errors.length) {
      setFormError(errors[0]);
      return;
    }

    setFormError("");

    if (requiresMutatingConfirmation) {
      setConfirmationOpen(true);
      return;
    }

    startTransition(async () => {
      try {
        await submitSelectedAction();
      } catch (error) {
        setFormError(error instanceof Error ? error.message : "Failed to start the action.");
      }
    });
  }

  async function submitSelectedAction() {
    const response = await fetch("/api/admin/operator/jobs", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        actionId: selectedAction.id,
        input,
        executionMode,
      }),
    });
    const payload = await readAdminJsonResponse(response, "/api/admin/operator/jobs");
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || "Failed to start the action.");
    }

    const nextExecution = {
      job: payload.job || null,
      actionTitle: selectedAction?.title || payload.action?.title || "Workflow action",
      commandText: selectedAction?.cliCommandTemplate || payload.action?.cliCommandTemplate || "",
    };

    setActiveExecution(nextExecution);
    if (redirectToJob && payload.job?.id) {
      router.push(`/admin/jobs/${payload.job.id}`);
      router.refresh();
    }
  }

  function resetConfirmation() {
    setConfirmationOpen(false);
    setConfirmationChecked(false);
    setTypedYes("");
  }

  function handleConfirmAction() {
    setFormError("");

    startTransition(async () => {
      try {
        await submitSelectedAction();
        resetConfirmation();
      } catch (error) {
        setFormError(error instanceof Error ? error.message : "Failed to start the action.");
      }
    });
  }

  return (
    <section className={`rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] shadow-sm ${compact ? "p-3" : "p-4"}`}>
      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-wide text-gray-600">Action Launcher</p>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-[12px] text-gray-700">{description}</p>
      </div>

      {isLoading ? (
        <p className="mt-3 text-[12px] text-gray-700">Loading registry actions…</p>
      ) : loadError ? (
        <div className="mt-3 rounded border border-red-300 bg-red-50 p-3 text-[12px] text-red-900">
          {loadError}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          {activeExecution?.job ? (
            <section className="space-y-2 rounded border p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wide text-gray-600">
                    Active Execution
                  </p>
                  <h3 className="mt-1 text-sm font-semibold">
                    {activeExecution.actionTitle}
                  </h3>
                  <p className="mt-1 text-[11px] text-gray-600">
                    {activeLifecycle?.phase === "running" || activeLifecycle?.phase === "queued" ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 animate-spin rounded-full border border-[var(--admin-link)] border-t-transparent" />
                    {executionPhaseLabel(activeLifecycle.phase)}
                  </span>
                    ) : (
                      executionPhaseLabel(activeLifecycle?.phase || activeExecution.job.status)
                    )}
                  </p>
                </div>
                <JobStatusBadge status={activeLifecycle?.phase || activeExecution.job.status} />
              </div>

              <div className="grid gap-2 md:grid-cols-4">
                <div className="rounded border px-2 py-1.5">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">Execution Id</p>
                  <p className="mt-1 font-mono text-[11px]">{activeExecution.job.id}</p>
                </div>
                <div className="rounded border px-2 py-1.5">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">Started</p>
                  <p className="mt-1 text-[11px]">
                    {formatAdminDateTime(
                      activeExecution.job.timestamps?.startedAt || activeExecution.job.timestamps?.createdAt
                    )}
                  </p>
                </div>
                <div className="rounded border px-2 py-1.5">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">Current State</p>
                  <p className="mt-1 text-[11px]">
                    {activeLifecycle?.workspaceState || activeExecution.job.status}
                  </p>
                </div>
                <div className="rounded border px-2 py-1.5">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">Next Step</p>
                  <p className="mt-1 text-[11px]">
                    {activeLifecycle?.nextActionTitle || "Continue polling"}
                  </p>
                </div>
              </div>

              <div className="rounded border px-2 py-1.5">
                <p className="text-[10px] uppercase tracking-wide text-gray-500">Current Command</p>
                <p className="mt-1 break-all font-mono text-[11px]">
                  {activeLifecycle?.currentCommand}
                </p>
              </div>

              <div className="rounded border px-2 py-1.5">
                <p className="text-[10px] uppercase tracking-wide text-gray-500">Most Recent Update</p>
                <p className="mt-1 text-[11px] text-gray-700">{activeLifecycle?.latestLine}</p>
              </div>

              {activeLifecycle?.isStopPoint ? (
                <div className="rounded border border-amber-300 bg-amber-50 px-2 py-2 text-[11px] text-amber-900">
                  <div className="font-medium">{activeLifecycle.stopMarker}</div>
                  <div className="mt-1">
                    Next required operator action:{" "}
                    {activeLifecycle.nextActionTitle || "Open the matching workflow checkpoint."}
                  </div>
                </div>
              ) : null}

              <TraceTable trace={activeLifecycle?.trace || []} />

              <div className="flex flex-wrap gap-3">
                {activeLifecycle?.isStopPoint && activeLifecycle.nextHref ? (
                  <Link href={activeLifecycle.nextHref} className="rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-medium text-amber-900">
                    {activeLifecycle.nextLabel}
                  </Link>
                ) : null}
                <Link href={activeLifecycle?.jobHref || "/admin/jobs"} className="rounded border px-3 py-1.5 text-[11px]">
                  Open job detail
                </Link>
                {activeLifecycle?.sessionHref ? (
                  <Link href={activeLifecycle.sessionHref} className="rounded border px-3 py-1.5 text-[11px]">
                    Open session
                  </Link>
                ) : null}
              </div>
            </section>
          ) : null}

          {recentExecutions.length ? (
            <section className="space-y-2 rounded border p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">
                  Recent Workflow Actions
                </p>
                <Link href="/admin/jobs" className="text-[11px] text-[var(--admin-link)] underline underline-offset-2">
                  View jobs
                </Link>
              </div>
              <div className="overflow-x-auto rounded border border-[var(--admin-line)] bg-[var(--admin-surface)]">
                <table className="min-w-[760px] w-full text-[11px]">
                  <thead className="bg-[var(--admin-surface-muted)] text-left uppercase tracking-wide text-[var(--admin-text-muted)]">
                    <tr>
                      <th className="border-b border-[var(--admin-line)] px-2 py-1">Status</th>
                      <th className="border-b border-[var(--admin-line)] px-2 py-1">Action</th>
                      <th className="border-b border-[var(--admin-line)] px-2 py-1">Execution Id</th>
                      <th className="border-b border-[var(--admin-line)] px-2 py-1">Finished</th>
                      <th className="border-b border-[var(--admin-line)] px-2 py-1">Next</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentExecutions.map((entry) => {
                      const lifecycle = deriveExecutionMonitorState(entry.job, {
                        commandText: entry.commandText,
                      });
                      return (
                        <tr key={entry.job.id} className="odd:bg-[var(--admin-surface)] even:bg-[var(--admin-surface-muted)] hover:bg-[var(--admin-surface-soft)]">
                          <td className="border-b border-[var(--admin-line)] px-2 py-1">
                            <JobStatusBadge status={lifecycle?.phase || entry.job.status} />
                          </td>
                          <td className="border-b border-[var(--admin-line)] px-2 py-1 text-[var(--admin-text)]">
                            {entry.actionTitle}
                          </td>
                          <td className="border-b border-[var(--admin-line)] px-2 py-1 font-mono text-[var(--admin-text-muted)]">
                            {entry.job.id}
                          </td>
                          <td className="border-b border-[var(--admin-line)] px-2 py-1 text-[var(--admin-text-soft)]">
                            {formatAdminDateTime(entry.job.timestamps?.finishedAt || entry.job.timestamps?.updatedAt)}
                          </td>
                          <td className="border-b border-[var(--admin-line)] px-2 py-1">
                            <Link href={`/admin/jobs/${entry.job.id}`} className="text-[var(--admin-link)] underline underline-offset-2">
                              Open
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {actions.length > 1 ? (
            <label className="block space-y-2">
              <span className="text-[12px] font-medium">Action</span>
              <select
                value={selectedActionId}
                onChange={(event) => handleActionChange(event.target.value)}
                disabled={executionLocked}
                className="w-full rounded border px-2 py-1.5 text-[12px] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actions.map((action) => (
                  <option key={action.id} value={action.id}>
                    {action.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {selectedAction ? (
            <div className="rounded border p-3">
              <p className="text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">{selectedAction.workflowFamily}</p>
              <p className="mt-1 font-medium">{selectedAction.title}</p>
              <p className="mt-1 text-[12px] text-[var(--admin-text-soft)]">{selectedAction.description}</p>
              <p className="mt-2 break-all font-mono text-[11px] text-[var(--admin-text-muted)]">{selectedAction.cliCommandTemplate}</p>
            </div>
          ) : null}

          {visibleFields.length ? (
            <div className="grid gap-3">
              {visibleFields.map(([fieldName, field]) => (
                <FieldRow
                  key={`${selectedActionId}-${fieldName}`}
                  fieldName={fieldName}
                  field={field}
                  value={input[fieldName]}
                  onChange={handleFieldChange}
                />
              ))}
            </div>
          ) : (
            <div className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-3 text-[12px] text-[var(--admin-text-soft)]">
              This action does not require any input fields.
            </div>
          )}

          <label className="block space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] font-medium">Execution mode</span>
              <span className="text-[11px] text-[var(--admin-text-muted)]">Allowed by registry</span>
            </div>
            <select
              value={executionMode}
              onChange={(event) => setExecutionMode(event.target.value)}
              disabled={executionLocked}
              className="w-full rounded border px-2 py-1.5 text-[12px] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {availableExecutionModes.map((mode) => (
                <option key={`${selectedActionId}-${mode}`} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </label>

          {selectedAction?.guardrails?.length ? (
            <div className="rounded border border-[var(--admin-warning-line)] bg-[var(--admin-warning-surface)] p-3">
              <p className="text-[12px] font-medium text-[var(--warning)]">Guardrails</p>
              <ul className="mt-2 space-y-1 text-[12px] text-[var(--warning)]">
                {selectedAction.guardrails.map((guardrail) => (
                  <li key={`${selectedAction.id}-${guardrail}`}>{guardrail}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {formError ? (
            <div className="rounded border border-[var(--admin-danger-line)] bg-[var(--admin-danger-surface)] p-3 text-[12px] text-[var(--danger)]">
              {formError}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={executionLocked || isLoading || !selectedAction}
              className="rounded border border-[var(--admin-link)] bg-[var(--admin-link)] px-3 py-1.5 text-[12px] text-[var(--background)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {executionLocked ? "Execution locked…" : buttonLabel}
            </button>
            <Link href="/admin/jobs" className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] px-3 py-1.5 text-[12px] text-[var(--admin-text)]">
              View jobs
            </Link>
          </div>
        </form>
      )}

      {confirmationOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 px-4">
          <div className="w-full max-w-lg rounded border bg-[var(--admin-surface)] p-4 shadow-xl">
            <div className="space-y-2">
              <p className="text-[12px] text-[var(--admin-text-muted)]">{selectedAction?.workflowFamily}</p>
              <h3 className="text-lg font-semibold">Confirm mutating action</h3>
              <p className="text-[12px] text-[var(--admin-text-soft)]">
                This requests the canonical mutating path. Broker and CLI guardrails still apply, and this confirmation does not bypass pre-commit, dry-run, or explicit review requirements.
              </p>
            </div>

            <label className="mt-4 flex items-start gap-3 rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-3 text-[12px] text-[var(--admin-text)]">
              <input
                type="checkbox"
                checked={confirmationChecked}
                onChange={(event) => setConfirmationChecked(event.target.checked)}
              />
              <span>I understand this requests the guarded mutating action again.</span>
            </label>

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
                onClick={handleConfirmAction}
                disabled={!confirmationChecked || normalizeString(typedYes) !== "YES" || isPending}
                className="rounded border border-[var(--admin-danger-line)] bg-[var(--admin-danger-surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Starting…" : "Confirm action"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
