"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import RecommendationList from "../components/RecommendationList";
import {
  filterOperatorActionHistory,
  getSuggestedOperatorActions,
  groupOperatorActionsByWorkflow,
  resolveExactOperatorActionFromInput,
} from "@/lib/operator/operatorActionUtils.js";

function statusClasses(status) {
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

function SectionCard({ title, children }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-sm text-gray-600">{title}</p>
      <div className="mt-2 text-sm text-gray-900">{children}</div>
    </div>
  );
}

export default function OperatorConsole({
  quickActions,
  initialTrace,
  initialHistory,
  initialInput,
  initialActionId,
  initialNotice,
}) {
  const [message, setMessage] = useState(initialInput || "");
  const [selectedActionId, setSelectedActionId] = useState(initialActionId || "");
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [trace, setTrace] = useState(initialTrace);
  const [history, setHistory] = useState(initialHistory || []);
  const [historyFilter, setHistoryFilter] = useState("all");
  const [notice, setNotice] = useState(initialNotice || "");
  const [error, setError] = useState("");
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

  const filteredHistory = useMemo(
    () => filterOperatorActionHistory(history, historyFilter),
    [history, historyFilter]
  );

  function syncInput(nextValue) {
    setMessage(nextValue);
    const matchedAction = resolveExactOperatorActionFromInput(quickActions, nextValue);
    setSelectedActionId(matchedAction?.id || "");
    setActiveSuggestionIndex(-1);
    setNotice("");
  }

  function selectAction(action) {
    setSelectedActionId(action.id);
    setMessage(action.canonical_input);
    setActiveSuggestionIndex(-1);
    setNotice("");
  }

  function runRequest(payload) {
    setError("");
    setNotice("");
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
          throw new Error(nextResult.error || "Operator console action failed.");
        }
        setTrace(nextResult.trace);
        setHistory(nextResult.history || []);
      } catch (nextError) {
        setError(nextError.message);
      }
    });
  }

  function handleRunRequest() {
    if (selectedActionId) {
      runRequest({ actionId: selectedActionId, message });
      return;
    }
    runRequest({ message });
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
    <div className="space-y-6">
      <section className="border rounded-2xl p-5 bg-white shadow-sm space-y-4">
        <div>
          <p className="text-sm text-gray-600">Supervised Operator Console</p>
          <p className="text-sm text-gray-700 mt-2">
            Input stays registry-bound. You can narrow the action list with partial text, then
            choose a known action before running anything.
          </p>
        </div>

        {notice ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            {notice}
          </div>
        ) : null}

        <label className="block">
          <span className="block text-sm font-medium mb-1">Action request</span>
          <textarea
            value={message}
            onChange={(event) => syncInput(event.target.value)}
            onKeyDown={handleInputKeyDown}
            aria-describedby="operator-console-help"
            aria-controls="operator-console-suggestions"
            aria-activedescendant={suggestionId}
            className="min-h-28 w-full rounded-lg border px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            placeholder="Start typing: current-admin, pre-commit, legislative dry-run, summarize state, what needs attention"
          />
        </label>
        <p id="operator-console-help" className="text-sm text-gray-600">
          Use the arrow keys to move through matching actions, then press Enter to fill the
          canonical action input safely.
        </p>

        {suggestionActions.length ? (
          <div
            id="operator-console-suggestions"
            role="listbox"
            aria-label="Matching registry actions"
            className="rounded-xl border bg-gray-50 p-4"
          >
            <p className="text-sm font-medium">Matching Registry Actions</p>
            <div className="mt-3 grid gap-2">
              {suggestionActions.map((action, index) => {
                const isSelected =
                  selectedActionId === action.id || exactMatchAction?.id === action.id;
                const isActive = activeSuggestionIndex === index;
                return (
                  <button
                    key={action.id}
                    id={`operator-suggestion-${action.id}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected || isActive}
                    onClick={() => selectAction(action)}
                    className={`rounded-lg border px-3 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${
                      isSelected || isActive
                        ? "border-black bg-white"
                        : "bg-white hover:bg-gray-100"
                    }`}
                  >
                    <p className="font-semibold">{action.label}</p>
                    <p className="mt-1 text-sm text-gray-700">{action.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : message.trim() ? (
          <div className="rounded-xl border bg-gray-50 p-4">
            <p className="text-sm text-gray-700">
              No registry action matches that partial phrase yet. Review the available actions
              below and select the correct one before running anything.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleRunRequest}
            disabled={isPending || !message.trim()}
            className="rounded-lg border px-4 py-2 bg-black text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            Run Request
          </button>
          {quickActions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => {
                selectAction(action);
                runRequest({ actionId: action.id, message: action.canonical_input });
              }}
              disabled={isPending}
              className="rounded-lg border px-4 py-2 bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {action.label}
            </button>
          ))}
        </div>
        {error ? (
          <p aria-live="polite" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </section>

      <section className="border rounded-2xl p-5 bg-white shadow-sm">
        <h2 className="text-lg font-semibold">Available Actions</h2>
        <p className="mt-1 text-sm text-gray-600">
          Registry-backed actions only. Selecting one fills the canonical input so you can review
          it before running or use it as a quick action directly.
        </p>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          {[
            { key: "current-admin", label: "Current-Admin" },
            { key: "legislative", label: "Legislative" },
            { key: "system", label: "System" },
          ].map((group) => (
            <div key={group.key} className="rounded-xl border p-4">
              <h3 className="font-semibold">{group.label}</h3>
              <div className="mt-3 space-y-3">
                {(groupedActions[group.key] || []).map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => selectAction(action)}
                    className="block w-full rounded-lg border p-3 text-left hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                  >
                    <p className="font-medium">{action.label}</p>
                    <p className="mt-1 text-sm text-gray-700">{action.description}</p>
                  </button>
                ))}
                {!(groupedActions[group.key] || []).length ? (
                  <p className="text-sm text-gray-600">No actions are registered in this group.</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        aria-live="polite"
        className={`border rounded-2xl p-5 shadow-sm ${statusClasses(trace?.status)}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Execution Trace</h2>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-medium ${statusBadgeClasses(trace?.status)}`}
          >
            {statusLabel(trace?.status)}
          </span>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <SectionCard title="Request">
            <p>{trace?.user_input || "Quick action"}</p>
          </SectionCard>
          <SectionCard title="Action Mapping">
            <p>
              {trace?.mapped_action_id || "unknown"}
              {trace?.action_label ? ` • ${trace.action_label}` : ""}
            </p>
          </SectionCard>
          <SectionCard title="Execution">
            <p>{trace?.execution_path || "Unavailable"}</p>
            {Number.isFinite(trace?.execution_duration_ms) ? (
              <p className="mt-2 text-gray-600">
                Duration: {trace.execution_duration_ms} ms
              </p>
            ) : null}
            {trace?.command ? (
              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-sm">
                <code>{trace.command}</code>
              </pre>
            ) : null}
          </SectionCard>
          <SectionCard title="Result">
            <p className="font-medium">{statusLabel(trace?.status)}</p>
            <p className="mt-2">{trace?.summary || "No execution trace is available yet."}</p>
            {trace?.blocked_reason ? (
              <p className="mt-2 text-gray-700">Blocked reason: {trace.blocked_reason}</p>
            ) : null}
            {trace?.failure_reason ? (
              <p className="mt-2 text-gray-700">Failure reason: {trace.failure_reason}</p>
            ) : null}
            {trace?.safety_note ? (
              <p className="mt-2 text-gray-700">Safety: {trace.safety_note}</p>
            ) : null}
            {trace?.retry_guidance ? (
              <p className="mt-2 text-gray-700">Retry guidance: {trace.retry_guidance}</p>
            ) : null}
          </SectionCard>
        </div>

        {trace?.status === "failed" && suggestionActions.length ? (
          <div className="mt-4 rounded-xl border bg-white p-4">
            <p className="text-sm text-gray-600">Suggested registry actions</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestionActions.map((action) => (
                <button
                  key={`failed-suggestion-${action.id}`}
                  type="button"
                  onClick={() => selectAction(action)}
                  className="rounded-full border px-3 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-4 rounded-xl border bg-white p-4">
          <p className="text-sm text-gray-600">Contextual recommendations</p>
          <p className="mt-2 text-sm text-gray-700">
            These follow-ups explain why the system is suggesting a recovery path or next safe step.
          </p>
          <div className="mt-3">
            <RecommendationList
              recommendations={trace?.contextual_recommendations || []}
              emptyState="No contextual recommendations are active for this trace yet."
            />
          </div>
        </div>

        <div className="mt-4 rounded-xl border bg-white p-4">
          <p className="text-sm text-gray-600">Artifact references</p>
          {trace?.artifact_references?.length ? (
            <div className="mt-3 space-y-3 text-sm">
              {trace.artifact_references.map((entry, index) => (
                <div key={`${entry.label}-${index}`} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{entry.label}</p>
                    <span className="rounded-full border px-2 py-0.5 text-xs text-gray-700">
                      {entry.artifact_type || "artifact"}
                    </span>
                  </div>
                  {entry.path ? (
                    <p className="mt-2 break-all text-gray-700">{entry.path}</p>
                  ) : (
                    <p className="mt-2 text-gray-600">No file path is available for this artifact.</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-3">
                    {entry.href ? (
                      <Link href={entry.href} className="underline">
                        Open related page
                      </Link>
                    ) : (
                      <span className="text-gray-600">No related page link is available.</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-700">
              No related artifacts were returned for this action.
            </p>
          )}
        </div>

        {trace?.stdout ? (
          <div className="mt-4 rounded-xl border bg-white p-4">
            <p className="text-sm text-gray-600">stdout</p>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-sm">
              <code>{trace.stdout}</code>
            </pre>
          </div>
        ) : null}

        {trace?.stderr ? (
          <div className="mt-4 rounded-xl border bg-white p-4">
            <p className="text-sm text-gray-600">stderr</p>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-sm">
              <code>{trace.stderr}</code>
            </pre>
          </div>
        ) : null}

        <div className="mt-4 rounded-xl border bg-white p-4">
          <p className="text-sm text-gray-600">Next Step</p>
          {trace?.next_recommended_step ? (
            <div className="mt-3 flex flex-wrap gap-3">
              <Link
                href={trace.next_recommended_step.href}
                className="rounded-lg border px-4 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
              >
                {trace.next_recommended_step.label}
              </Link>
              <Link
                href="/admin"
                className="rounded-lg border px-4 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
              >
                Return to Dashboard
              </Link>
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-700">
              No next step is available yet. Review the summary and artifact references first.
            </p>
          )}
        </div>
      </section>

      <section className="border rounded-2xl p-5 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Recent Operator Actions</h2>
            <p className="mt-1 text-sm text-gray-600">
              Recent history confirms which supervised actions already ran.
            </p>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Filter operator history by status">
            {["all", "success", "blocked", "failed"].map((status) => (
              <button
                key={status}
                type="button"
                aria-pressed={historyFilter === status}
                onClick={() => setHistoryFilter(status)}
                className={`rounded-full border px-3 py-1 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${
                  historyFilter === status ? "bg-black text-white" : "bg-white"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 space-y-3 text-sm">
          {filteredHistory.length ? (
            filteredHistory.map((entry, index) => (
              <div key={`${entry.timestamp}-${index}`} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold">
                    {entry.action_label || entry.action_id || "unknown action"}
                  </p>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs ${statusBadgeClasses(
                      entry.status
                    )}`}
                  >
                    {statusLabel(entry.status)}
                  </span>
                </div>
                <p className="mt-2 text-gray-600">{entry.timestamp}</p>
                <p className="mt-2 text-gray-700">{entry.summary}</p>
                {Number.isFinite(entry.execution_duration_ms) ? (
                  <p className="mt-2 text-gray-600">
                    Duration: {entry.execution_duration_ms} ms
                  </p>
                ) : null}
                {entry.user_input ? (
                  <p className="mt-2 break-words text-gray-600">Input: {entry.user_input}</p>
                ) : null}
              </div>
            ))
          ) : historyFilter === "all" ? (
            <p className="text-gray-600">
              No operator actions have been recorded yet. The system is healthy, but there is no
              recent supervised execution history to display.
            </p>
          ) : (
            <p className="text-gray-600">
              No operator actions match the current filter. Recent history is clear for that status.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
