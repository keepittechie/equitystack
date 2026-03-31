"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import RecommendationList from "../components/RecommendationList";
import {
  getSuggestedOperatorActions,
  groupOperatorActionsByWorkflow,
  resolveExactOperatorActionFromInput,
} from "@/lib/operator/operatorActionUtils.js";

const ACTION_COLUMNS = [
  { key: "current-admin", label: "Current-Admin" },
  { key: "legislative", label: "Legislative" },
  { key: "policies", label: "Policies" },
  { key: "system", label: "System" },
];
const HISTORY_PAGE_SIZE = 10;

function statusClasses(status) {
  if (status === "running") {
    return "border-sky-300 bg-sky-50 text-sky-950";
  }
  if (status === "success") {
    return "border-green-300 bg-green-50 text-green-950";
  }
  if (status === "blocked") {
    return "border-amber-300 bg-amber-50 text-amber-950";
  }
  if (status === "failed") {
    return "border-red-300 bg-red-50 text-red-950";
  }
  return "border-gray-300 bg-gray-50 text-gray-900";
}

function statusBadgeClasses(status) {
  if (status === "running") {
    return "border-sky-300 bg-sky-100 text-sky-900";
  }
  if (status === "success") {
    return "border-green-300 bg-green-100 text-green-900";
  }
  if (status === "blocked") {
    return "border-amber-300 bg-amber-100 text-amber-900";
  }
  if (status === "failed") {
    return "border-red-300 bg-red-100 text-red-900";
  }
  return "border-gray-300 bg-gray-100 text-gray-900";
}

function statusLabel(status) {
  if (status === "running") {
    return "Running";
  }
  if (status === "success") {
    return "Success";
  }
  if (status === "blocked") {
    return "Blocked";
  }
  if (status === "failed") {
    return "Failed";
  }
  return "Unknown";
}

function formatIsoDate(value) {
  if (!value) {
    return "—";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString();
}

function formatIsoTime(value) {
  if (!value) {
    return "—";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(durationMs) {
  if (!Number.isFinite(durationMs)) {
    return "—";
  }
  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }
  return `${(durationMs / 1000).toFixed(1)} s`;
}

function TraceCell({ label, children, mono = false }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <div className={`mt-1 text-sm text-gray-900 ${mono ? "font-mono break-all" : ""}`}>
        {children}
      </div>
    </div>
  );
}

function SpinnerDot() {
  return (
    <span className="inline-flex h-2.5 w-2.5 rounded-full bg-sky-600 animate-pulse" />
  );
}

export default function OperatorConsole({
  quickActions,
  initialTrace,
  initialHistory,
  initialInput,
  initialActionId,
  initialNotice,
  initialActiveExecution,
}) {
  const [message, setMessage] = useState(initialInput || "");
  const [selectedActionId, setSelectedActionId] = useState(initialActionId || "");
  const [selectedWorkflow, setSelectedWorkflow] = useState(
    quickActions.find((action) => action.id === initialActionId)?.workflow || "current-admin"
  );
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [trace, setTrace] = useState(initialTrace);
  const [history, setHistory] = useState(initialHistory || []);
  const [historyPage, setHistoryPage] = useState(1);
  const [notice, setNotice] = useState(initialNotice || "");
  const [error, setError] = useState("");
  const [activeExecution, setActiveExecution] = useState(initialActiveExecution || null);
  const [isPending, startTransition] = useTransition();

  const exactMatchAction = useMemo(
    () => resolveExactOperatorActionFromInput(quickActions, message),
    [quickActions, message]
  );

  const suggestionActions = useMemo(
    () => getSuggestedOperatorActions(quickActions, message, 8),
    [quickActions, message]
  );

  const groupedActions = useMemo(
    () => groupOperatorActionsByWorkflow(quickActions || []),
    [quickActions]
  );

  const selectedAction =
    quickActions.find((action) => action.id === selectedActionId) ||
    exactMatchAction ||
    null;
  const effectiveExecution = activeExecution;
  const isLocked = isPending || Boolean(effectiveExecution?.status === "running" || effectiveExecution);

  const paginatedHistory = useMemo(() => {
    const startIndex = (historyPage - 1) * HISTORY_PAGE_SIZE;
    return history.slice(startIndex, startIndex + HISTORY_PAGE_SIZE);
  }, [history, historyPage]);

  const totalHistoryPages = Math.max(1, Math.ceil(history.length / HISTORY_PAGE_SIZE));

  function syncInput(nextValue) {
    setMessage(nextValue);
    const matchedAction = resolveExactOperatorActionFromInput(quickActions, nextValue);
    setSelectedActionId(matchedAction?.id || "");
    setSelectedWorkflow(matchedAction?.workflow || selectedWorkflow);
    setActiveSuggestionIndex(-1);
    setNotice("");
  }

  function selectAction(action) {
    setSelectedActionId(action.id);
    setSelectedWorkflow(action.workflow);
    setMessage(action.canonical_input);
    setActiveSuggestionIndex(-1);
    setNotice("");
    setError("");
  }

  function clearSelection() {
    setMessage("");
    setSelectedActionId("");
    setActiveSuggestionIndex(-1);
    setNotice("");
    setError("");
  }

  function buildRunningTrace(nextAction, commandText) {
    return {
      ...trace,
      user_input: commandText,
      mapped_action_id: nextAction?.id || selectedActionId || null,
      action_label: nextAction?.label || "Workflow Command",
      workflow_type: nextAction?.workflow || selectedWorkflow || null,
      execution_path: nextAction?.execution_path || nextAction?.execution_method || "Wrapped CLI execution",
      status: "running",
      summary: "Workflow execution is in progress. The console remains locked until the wrapped command returns.",
      blocked_reason: null,
      failure_reason: null,
      command: commandText,
      stop_point: { key: "running", label: "Running" },
      next_recommended_step: null,
      safety_note: "The command is running through the canonical wrapper. Review and approval stop points remain enforced.",
      stdout: "",
      stderr: "",
      contextual_recommendations: [],
      artifact_references: [],
    };
  }

  function runRequest(payload, nextAction, commandText) {
    setError("");
    setNotice("");
    setActiveExecution({
      status: "running",
      action_label: nextAction?.label || "Workflow Command",
      action_id: nextAction?.id || null,
      workflow_type: nextAction?.workflow || selectedWorkflow || null,
      user_input: commandText,
      command: commandText,
      started_at: new Date().toISOString(),
    });
    setTrace(buildRunningTrace(nextAction, commandText));

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/operator-console", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const nextResult = await response.json();
        if (!response.ok) {
          throw new Error(nextResult.error || "Workflow console action failed.");
        }
        setTrace(nextResult.trace);
        setHistory(nextResult.history || []);
        setHistoryPage(1);
        setActiveExecution(nextResult.active_execution || null);
      } catch (nextError) {
        setError(nextError.message);
        setActiveExecution(null);
      }
    });
  }

  function handleExecute() {
    const commandText = message.trim();
    if (!commandText) {
      return;
    }
    const nextAction = selectedAction || exactMatchAction || null;
    runRequest(
      nextAction ? { actionId: nextAction.id, message: commandText } : { message: commandText },
      nextAction,
      commandText
    );
  }

  function handleInputKeyDown(event) {
    if (!suggestionActions.length) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestionIndex((current) =>
        current < suggestionActions.length - 1 ? current + 1 : 0
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestionIndex((current) =>
        current > 0 ? current - 1 : suggestionActions.length - 1
      );
      return;
    }

    if (event.key === "Enter" && activeSuggestionIndex >= 0) {
      event.preventDefault();
      selectAction(suggestionActions[activeSuggestionIndex]);
      return;
    }

    if (event.key === "Escape") {
      setActiveSuggestionIndex(-1);
    }
  }

  const suggestionId =
    activeSuggestionIndex >= 0 && suggestionActions[activeSuggestionIndex]
      ? `operator-suggestion-${suggestionActions[activeSuggestionIndex].id}`
      : undefined;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-gray-600">Workflow Console</p>
            <p className="mt-2 max-w-4xl text-sm text-gray-700">
              Enter a canonical command or select an available action, then execute it through the
              wrapped CLI. Review and approval stop points still hand off to the dedicated admin
              surfaces.
            </p>
          </div>
          {effectiveExecution ? (
            <div className="flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-900">
              <SpinnerDot />
              Active execution
            </div>
          ) : null}
        </div>

        {notice ? (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {notice}
          </div>
        ) : null}

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_0.4fr]">
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Workflow command</span>
              <input
                value={message}
                onChange={(event) => syncInput(event.target.value)}
                onKeyDown={handleInputKeyDown}
                aria-describedby="workflow-console-help"
                aria-controls="operator-console-suggestions"
                aria-activedescendant={suggestionId}
                disabled={isLocked}
                className="h-11 w-full rounded-lg border px-3 font-mono text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:cursor-not-allowed disabled:bg-gray-100"
                placeholder="Enter command or select an available action"
              />
            </label>
            <p id="workflow-console-help" className="text-xs text-gray-600">
              Press Enter on a highlighted suggestion to fill the command. Execution only happens
              from the Execute button.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-2 lg:justify-end">
            <button
              type="button"
              onClick={handleExecute}
              disabled={isLocked || !message.trim()}
              className="rounded-lg border border-black px-4 py-2 text-sm font-medium bg-black text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLocked ? "Running" : "Execute"}
            </button>
            <button
              type="button"
              onClick={clearSelection}
              disabled={isLocked || (!message && !selectedActionId)}
              className="rounded-lg border px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              Clear
            </button>
          </div>
        </div>

        {suggestionActions.length ? (
          <div
            id="operator-console-suggestions"
            role="listbox"
            aria-label="Matching workflow actions"
            className="mt-4 rounded-xl border bg-gray-50 p-3"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Matching Actions
            </p>
            <div className="mt-2 grid gap-2 lg:grid-cols-2">
              {suggestionActions.map((action, index) => {
                const isActive = activeSuggestionIndex === index;
                const isSelected = selectedActionId === action.id;
                return (
                  <button
                    key={action.id}
                    id={`operator-suggestion-${action.id}`}
                    type="button"
                    role="option"
                    aria-selected={isActive || isSelected}
                    disabled={isLocked}
                    onClick={() => selectAction(action)}
                    className={`rounded-lg border px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-60 ${
                      isActive || isSelected ? "border-black bg-white" : "bg-white hover:bg-gray-100"
                    }`}
                  >
                    <p className="font-medium">{action.label}</p>
                    <p className="mt-1 text-xs text-gray-600">{action.canonical_input}</p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {error ? (
          <p aria-live="polite" className="mt-4 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Available Actions</h2>
            <p className="mt-1 text-xs text-gray-600">
              Registry-backed actions only. Selecting an action fills the command area; it does not
              execute.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Filters</p>
          <div className="mt-2 grid gap-2 md:grid-cols-4">
            {ACTION_COLUMNS.map((group) => {
              const isSelectedColumn = selectedWorkflow === group.key;
              return (
                <button
                  key={`filter-${group.key}`}
                  type="button"
                  onClick={() => setSelectedWorkflow(group.key)}
                  disabled={isLocked}
                  aria-pressed={isSelectedColumn}
                  className={`rounded-lg border px-3 py-2 text-left text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 ${
                    isSelectedColumn ? "border-black bg-black text-white" : "bg-white text-gray-900"
                  }`}
                >
                  {group.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-4">
          {ACTION_COLUMNS.map((group) => {
            const actions = groupedActions[group.key] || [];
            const isSelectedColumn = selectedWorkflow === group.key;
            return (
              <div
                key={group.key}
                className={`rounded-xl border p-3 ${
                  isSelectedColumn ? "border-black bg-gray-50" : "border-gray-200"
                }`}
              >
                <p className="text-sm font-semibold">{group.label}</p>
                <div className="mt-3 space-y-2">
                  {actions.length ? (
                    actions.map((action) => {
                      const isSelectedAction = selectedActionId === action.id;
                      return (
                        <button
                          key={action.id}
                          type="button"
                          onClick={() => selectAction(action)}
                          disabled={isLocked}
                          className={`block w-full rounded-lg border px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-60 ${
                            isSelectedAction
                              ? "border-black bg-white"
                              : "border-gray-200 bg-white hover:bg-gray-50"
                          }`}
                        >
                          <p className="font-medium">{action.label}</p>
                          <p className="mt-1 text-xs text-gray-600">{action.description}</p>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-lg border border-dashed px-3 py-3 text-xs text-gray-500">
                      {group.key === "policies"
                        ? "Policy workflow actions coming soon."
                        : "No actions are registered in this column."}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className={`rounded-2xl border p-4 shadow-sm ${statusClasses(trace?.status)}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Execution Trace</h2>
            <p className="mt-1 text-xs text-gray-700">
              Compact status for the current command, stop point, and next supervised handoff.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {trace?.status === "running" ? <SpinnerDot /> : null}
            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusBadgeClasses(trace?.status)}`}>
              {statusLabel(trace?.status)}
            </span>
            <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-gray-700">
              {trace?.stop_point?.label || "Complete"}
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-3">
          <TraceCell label="Current Command" mono>
            {trace?.command || trace?.user_input || "No command selected yet."}
          </TraceCell>
          <TraceCell label="Workflow">
            {trace?.workflow_type || "—"}
          </TraceCell>
          <TraceCell label="Duration">
            {trace?.status === "running" ? "In progress" : formatDuration(trace?.execution_duration_ms)}
          </TraceCell>
          <TraceCell label="Result Summary">
            {trace?.summary || "No execution trace is available yet."}
          </TraceCell>
          <TraceCell label="Safety Note">
            {trace?.safety_note || "The workflow remains supervised and guardrailed."}
          </TraceCell>
          <TraceCell label="Stop Point Reached">
            {trace?.status === "running"
              ? "Running"
              : trace?.stop_point?.label || "Complete"}
          </TraceCell>
        </div>

        {(trace?.blocked_reason || trace?.failure_reason || trace?.retry_guidance) ? (
          <div className="mt-3 grid gap-3 xl:grid-cols-3">
            {trace?.blocked_reason ? (
              <TraceCell label="Blocked Reason">{trace.blocked_reason}</TraceCell>
            ) : null}
            {trace?.failure_reason ? (
              <TraceCell label="Failure Reason">{trace.failure_reason}</TraceCell>
            ) : null}
            {trace?.retry_guidance ? (
              <TraceCell label="Next Retry Rule">{trace.retry_guidance}</TraceCell>
            ) : null}
          </div>
        ) : null}

        <div className="mt-3 grid gap-3 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-lg border border-black/10 bg-white p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Next Step</p>
            {trace?.next_recommended_step ? (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <p className="text-sm text-gray-900">{trace.next_recommended_step.label}</p>
                <Link href={trace.next_recommended_step.href} className="text-sm underline">
                  Open
                </Link>
              </div>
            ) : (
              <p className="mt-2 text-sm text-gray-600">
                Review the current trace first. A new handoff appears after the wrapped command
                returns.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-black/10 bg-white p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
              Contextual Recommendations
            </p>
            <div className="mt-2 text-sm">
              <RecommendationList
                recommendations={trace?.contextual_recommendations || []}
                emptyState="No additional recommendations are active for this trace."
              />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Recent Workflow Actions</h2>
            <p className="mt-1 text-xs text-gray-600">
              Compact execution history for supervised commands and stop-point handoffs.
            </p>
          </div>
          <p className="text-xs text-gray-500">
            {history.length ? `${history.length} recorded action(s)` : "No recorded actions yet"}
          </p>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="border-b px-3 py-2 font-medium">Command</th>
                <th className="border-b px-3 py-2 font-medium">Date</th>
                <th className="border-b px-3 py-2 font-medium">StartTime</th>
                <th className="border-b px-3 py-2 font-medium">EndTime</th>
                <th className="border-b px-3 py-2 font-medium">WorkflowType</th>
                <th className="border-b px-3 py-2 font-medium">Status</th>
                <th className="border-b px-3 py-2 font-medium">Duration</th>
                <th className="border-b px-3 py-2 font-medium">Next Step</th>
                <th className="border-b px-3 py-2 font-medium">Open</th>
              </tr>
            </thead>
            <tbody>
              {paginatedHistory.length ? (
                paginatedHistory.map((entry, index) => (
                  <tr key={`${entry.timestamp}-${index}`} className="border-b align-top last:border-b-0">
                    <td className="px-3 py-2">
                      <div className="max-w-[24rem] space-y-1">
                        <p className="font-medium text-gray-900">
                          {entry.command || entry.action_label || entry.action_id || "unknown action"}
                        </p>
                        {entry.summary ? <p className="text-xs text-gray-600">{entry.summary}</p> : null}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-700">{formatIsoDate(entry.started_at || entry.timestamp)}</td>
                    <td className="px-3 py-2 text-gray-700">{formatIsoTime(entry.started_at || entry.timestamp)}</td>
                    <td className="px-3 py-2 text-gray-700">{formatIsoTime(entry.ended_at)}</td>
                    <td className="px-3 py-2 text-gray-700">{entry.workflow_type || "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${statusBadgeClasses(entry.status)}`}>
                        {entry.workflow_status_label || statusLabel(entry.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-700">{formatDuration(entry.execution_duration_ms)}</td>
                    <td className="px-3 py-2 text-gray-700">{entry.next_step_label || "—"}</td>
                    <td className="px-3 py-2">
                      {entry.next_step_href ? (
                        <Link href={entry.next_step_href} className="text-sm underline">
                          Open
                        </Link>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-sm text-gray-600">
                    No supervised workflow actions have been recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {history.length > HISTORY_PAGE_SIZE ? (
          <div className="mt-3 flex items-center justify-between gap-3 text-sm">
            <p className="text-gray-600">
              Page {historyPage} of {totalHistoryPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setHistoryPage((current) => Math.max(1, current - 1))}
                disabled={historyPage === 1}
                className="rounded-lg border px-3 py-1 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setHistoryPage((current) => Math.min(totalHistoryPages, current + 1))}
                disabled={historyPage === totalHistoryPages}
                className="rounded-lg border px-3 py-1 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
