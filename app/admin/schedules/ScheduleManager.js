"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { formatAdminDateTime } from "@/app/admin/components/adminDateTime";
import JobStatusBadge from "@/app/admin/jobs/JobStatusBadge";
import { readAdminJsonResponse } from "@/app/admin/components/readAdminJsonResponse";

const ACTIVE_JOB_STATUSES = new Set(["queued", "running"]);

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function expressionPlaceholder(scheduleType) {
  if (scheduleType === "daily") {
    return "08:00";
  }
  if (scheduleType === "weekly") {
    return "mon@08:00";
  }
  if (scheduleType === "interval") {
    return "60";
  }
  return "No expression needed";
}

export default function ScheduleManager({ initialSchedules = [], initialActions = [] }) {
  const [schedules, setSchedules] = useState(initialSchedules);
  const [actions, setActions] = useState(initialActions);
  const [title, setTitle] = useState("");
  const [actionId, setActionId] = useState(initialActions[0]?.id || "");
  const [executionMode, setExecutionMode] = useState(
    initialActions[0]?.executionModes?.defaultMode || "local_cli"
  );
  const [scheduleType, setScheduleType] = useState("daily");
  const [scheduleExpression, setScheduleExpression] = useState("08:00");
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedAction = useMemo(
    () => actions.find((action) => action.id === actionId) || null,
    [actionId, actions]
  );

  useEffect(() => {
    if (!actionId && actions.length) {
      setActionId(actions[0].id);
      setExecutionMode(actions[0]?.executionModes?.defaultMode || "local_cli");
    }
  }, [actionId, actions]);

  useEffect(() => {
    if (selectedAction?.executionModes?.allowedModes?.includes(executionMode)) {
      return;
    }
    setExecutionMode(selectedAction?.executionModes?.defaultMode || "local_cli");
  }, [executionMode, selectedAction]);

  async function loadSchedules() {
    const response = await fetch("/api/admin/operator/schedules", {
      method: "GET",
      cache: "no-store",
    });
    const payload = await readAdminJsonResponse(response, "/api/admin/operator/schedules");
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || "Failed to load schedules.");
    }
    setSchedules(payload.schedules || []);
    setActions(payload.schedulableActions || []);
  }

  useEffect(() => {
    if (!schedules.some((schedule) => ACTIVE_JOB_STATUSES.has(schedule.lastJob?.status || ""))) {
      return undefined;
    }

    let cancelled = false;
    const intervalId = window.setInterval(async () => {
      try {
        const response = await fetch("/api/admin/operator/schedules", {
          method: "GET",
          cache: "no-store",
        });
        const payload = await readAdminJsonResponse(response, "/api/admin/operator/schedules");
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || "Failed to refresh schedules.");
        }
        if (!cancelled) {
          setSchedules(payload.schedules || []);
          setError("");
        }
      } catch (refreshError) {
        if (!cancelled) {
          setError(refreshError instanceof Error ? refreshError.message : "Failed to refresh schedules.");
        }
      }
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [schedules]);

  function handleCreateSchedule(event) {
    event.preventDefault();
    setError("");
    setInfo("");

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/operator/schedules", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            title: normalizeString(title) || undefined,
            actionId,
            executionMode,
            scheduleType,
            scheduleExpression: scheduleType === "manual" ? "" : scheduleExpression,
            enabled,
            safeAutoRun: true,
          }),
        });
        const payload = await readAdminJsonResponse(response, "/api/admin/operator/schedules");
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || "Failed to create the schedule.");
        }
        setTitle("");
        setInfo(`Created schedule ${payload.schedule.title}.`);
        await loadSchedules();
      } catch (createError) {
        setError(createError instanceof Error ? createError.message : "Failed to create the schedule.");
      }
    });
  }

  function handleUpdateSchedule(scheduleId, patch, message) {
    setError("");
    setInfo("");

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/operator/schedules/${encodeURIComponent(scheduleId)}`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(patch),
        });
        const payload = await readAdminJsonResponse(
          response,
          `/api/admin/operator/schedules/${encodeURIComponent(scheduleId)}`
        );
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || "Failed to update the schedule.");
        }
        setInfo(message);
        await loadSchedules();
      } catch (updateError) {
        setError(updateError instanceof Error ? updateError.message : "Failed to update the schedule.");
      }
    });
  }

  function handleRunSchedule(scheduleId) {
    setError("");
    setInfo("");

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/operator/schedules/${encodeURIComponent(scheduleId)}/run`, {
          method: "POST",
        });
        const payload = await readAdminJsonResponse(
          response,
          `/api/admin/operator/schedules/${encodeURIComponent(scheduleId)}/run`
        );
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || "Failed to run the schedule.");
        }
        setInfo(`Queued schedule ${payload.schedule?.title || scheduleId}.`);
        await loadSchedules();
      } catch (runError) {
        setError(runError instanceof Error ? runError.message : "Failed to run the schedule.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <section className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-[var(--admin-text)]">Schedules</h2>
          <button
            type="button"
            onClick={() => {
              startTransition(async () => {
                try {
                  await loadSchedules();
                  setError("");
                } catch (refreshError) {
                  setError(refreshError instanceof Error ? refreshError.message : "Failed to refresh schedules.");
                }
              });
            }}
            className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] px-3 py-1.5 text-[12px] text-[var(--admin-text)]"
          >
            Refresh
          </button>
        </div>
        <div className="mt-3 overflow-x-auto rounded border border-[var(--admin-line)] bg-[var(--admin-surface)]">
          {schedules.length ? (
            <table className="min-w-[1220px] w-full text-[11px]">
              <thead className="bg-[var(--admin-surface-muted)] text-left text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">
                <tr>
                  <th className="border-b border-[var(--admin-line)] px-2 py-1">Title</th>
                  <th className="border-b border-[var(--admin-line)] px-2 py-1">Action</th>
                  <th className="border-b border-[var(--admin-line)] px-2 py-1">Workflow</th>
                  <th className="border-b border-[var(--admin-line)] px-2 py-1">Mode</th>
                  <th className="border-b border-[var(--admin-line)] px-2 py-1">Status</th>
                  <th className="border-b border-[var(--admin-line)] px-2 py-1">Next Run</th>
                  <th className="border-b border-[var(--admin-line)] px-2 py-1">Last Run</th>
                  <th className="border-b border-[var(--admin-line)] px-2 py-1">Last Result</th>
                  <th className="border-b border-[var(--admin-line)] px-2 py-1">Action</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((schedule) => (
                  <tr key={schedule.id} className="align-top odd:bg-[var(--admin-surface)] even:bg-[var(--admin-surface-muted)] hover:bg-[var(--admin-surface-soft)]">
                    <td className="border-b border-[var(--admin-line)] px-2 py-1">
                      <div className="font-medium text-[var(--admin-text)]">{schedule.title}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-[var(--admin-text-muted)]">{schedule.id}</div>
                    </td>
                    <td className="border-b border-[var(--admin-line)] px-2 py-1">
                      <div className="text-[var(--admin-text-soft)]">{schedule.action?.title || schedule.actionId}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-[var(--admin-text-muted)]">
                        {schedule.scheduleType}
                        {schedule.scheduleExpression ? ` / ${schedule.scheduleExpression}` : ""}
                      </div>
                    </td>
                    <td className="border-b border-[var(--admin-line)] px-2 py-1 text-[var(--admin-text-soft)]">{schedule.workflowFamily}</td>
                    <td className="border-b border-[var(--admin-line)] px-2 py-1 font-mono text-[10px] text-[var(--admin-text)]">
                      {schedule.executionMode || "local_cli"}
                    </td>
                    <td className="border-b border-[var(--admin-line)] px-2 py-1">
                      <JobStatusBadge status={schedule.status} />
                    </td>
                    <td className="border-b border-[var(--admin-line)] px-2 py-1 text-[var(--admin-text-soft)]">{formatAdminDateTime(schedule.nextRunAt)}</td>
                    <td className="border-b border-[var(--admin-line)] px-2 py-1 text-[var(--admin-text-soft)]">{formatAdminDateTime(schedule.lastRunAt)}</td>
                    <td className="border-b border-[var(--admin-line)] px-2 py-1">
                      <div className="max-w-[260px] truncate text-[var(--admin-text-soft)]" title={schedule.lastJob?.summary || schedule.lastResultSummary || schedule.summary}>
                        {schedule.lastJob?.summary || schedule.lastResultSummary || schedule.summary}
                      </div>
                    </td>
                    <td className="border-b border-[var(--admin-line)] px-2 py-1">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateSchedule(
                              schedule.id,
                              { enabled: !schedule.enabled },
                              `${schedule.title} ${schedule.enabled ? "disabled" : "enabled"}.`
                            )
                          }
                          className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] px-2 py-0.5 text-[11px] text-[var(--admin-text)]"
                        >
                          {schedule.enabled ? "Disable" : "Enable"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRunSchedule(schedule.id)}
                          className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] px-2 py-0.5 text-[11px] text-[var(--admin-text)]"
                        >
                          Run now
                        </button>
                        {schedule.lastJobId ? (
                          <Link href={`/admin/jobs/${schedule.lastJobId}`} className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] px-2 py-0.5 text-[11px] text-[var(--admin-text)]">
                            Open last job
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="p-3 text-[12px] text-[var(--admin-text-muted)]">No schedules are defined yet.</p>
          )}
        </div>
      </section>

      <section className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-4 shadow-sm">
        <h2 className="text-base font-semibold text-[var(--admin-text)]">Create schedule</h2>
        <form onSubmit={handleCreateSchedule} className="mt-3 grid gap-3 xl:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-[11px] font-medium text-[var(--admin-text)]">Title</span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] px-2 py-1 text-[11px] text-[var(--admin-text)] outline-none placeholder:text-[var(--admin-text-muted)] focus:border-[var(--admin-link)]"
              placeholder={selectedAction?.title || "Morning preparation"}
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] font-medium text-[var(--admin-text)]">Action</span>
            <select
              value={actionId}
              onChange={(event) => setActionId(event.target.value)}
              className="w-full rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] px-2 py-1 text-[11px] text-[var(--admin-text)] outline-none focus:border-[var(--admin-link)]"
              >
              {actions.map((action) => (
                <option key={action.id} value={action.id}>
                  {action.title}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] font-medium text-[var(--admin-text)]">Execution mode</span>
            <select
              value={executionMode}
              onChange={(event) => setExecutionMode(event.target.value)}
              className="w-full rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] px-2 py-1 text-[11px] text-[var(--admin-text)] outline-none focus:border-[var(--admin-link)]"
            >
              {(selectedAction?.executionModes?.scheduleAllowedModes || ["local_cli"]).map((mode) => (
                <option key={`${actionId}-${mode}`} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] font-medium text-[var(--admin-text)]">Schedule type</span>
            <select
              value={scheduleType}
              onChange={(event) => setScheduleType(event.target.value)}
              className="w-full rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] px-2 py-1 text-[11px] text-[var(--admin-text)] outline-none focus:border-[var(--admin-link)]"
            >
              <option value="manual">Manual</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="interval">Interval</option>
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] font-medium text-[var(--admin-text)]">Expression</span>
            <input
              type="text"
              value={scheduleType === "manual" ? "" : scheduleExpression}
              onChange={(event) => setScheduleExpression(event.target.value)}
              disabled={scheduleType === "manual"}
              className="w-full rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] px-2 py-1 text-[11px] text-[var(--admin-text)] outline-none placeholder:text-[var(--admin-text-muted)] focus:border-[var(--admin-link)] disabled:bg-[var(--admin-surface-soft)]"
              placeholder={expressionPlaceholder(scheduleType)}
            />
          </label>

          <label className="flex items-center gap-3 rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] p-2 text-[11px] text-[var(--admin-text)]">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            <span>Enable scheduled execution</span>
          </label>

          <div className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-2 text-[11px] text-[var(--admin-text-soft)]">
            Only explicitly schedulable actions appear here. Final apply/import paths remain blocked.
          </div>

          <div className="xl:col-span-2 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isPending || !selectedAction}
              className="rounded border border-[var(--admin-link)] bg-[var(--admin-link)] px-2.5 py-1 text-[11px] font-medium text-[var(--background)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Saving…" : "Create schedule"}
            </button>
            <button
              type="button"
              onClick={() => {
                setTitle("");
                setExecutionMode(selectedAction?.executionModes?.defaultMode || "local_cli");
                setScheduleType("daily");
                setScheduleExpression("08:00");
                setEnabled(true);
                setError("");
                setInfo("");
              }}
              className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] px-2.5 py-1 text-[11px] text-[var(--admin-text)]"
            >
              Reset
            </button>
          </div>
        </form>

        {error ? (
          <div className="mt-3 rounded border border-[var(--admin-danger-line)] bg-[var(--admin-danger-surface)] p-2 text-[11px] text-[var(--danger)]">
            {error}
          </div>
        ) : null}
        {info ? (
          <div className="mt-3 rounded border border-[var(--admin-success-line)] bg-[var(--admin-success-surface)] p-2 text-[11px] text-[var(--success)]">
            {info}
          </div>
        ) : null}
      </section>
    </div>
  );
}
