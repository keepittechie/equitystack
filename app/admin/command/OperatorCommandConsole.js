"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import JobStatusBadge from "@/app/admin/jobs/JobStatusBadge";

const HISTORY_LIMIT = 12;
const TERMINAL_JOB_STATUSES = new Set(["success", "failed", "blocked", "cancelled"]);

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function mapHistoryEntry(entry) {
  return {
    id: entry.id,
    command: entry.rawCommand,
    selectedSessionId: entry.selectedSessionId || null,
    createdAt: entry.executedAt || entry.createdAt,
    resultStatus: entry.resultStatus || "",
    resultType: entry.resultType || "",
    title: entry.title || "",
    summary: entry.summary || "",
    relatedJobId: entry.relatedJobId || null,
    relatedSessionId: entry.relatedSessionId || null,
    executionMode: entry.payloadJson?.executionMode || entry.payloadJson?.parsedCommand?.executionMode || null,
  };
}

function renderInspectResult(result) {
  if (result.target === "sessions") {
    const sessions = result.data?.sessions || [];
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">{result.summary}</p>
        {sessions.slice(0, 6).map((session) => (
          <div key={session.id} className="rounded-xl border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-gray-600">{session.workflowFamily}</p>
                <p className="mt-1 font-medium">{session.title}</p>
                <p className="mt-2 text-sm text-gray-700">{session.summary}</p>
              </div>
              <span className="rounded-full border px-3 py-1 text-xs font-medium text-gray-700">
                {session.canonicalState}
              </span>
            </div>
            <div className="mt-3">
              <Link href={`/admin/workflows/${encodeURIComponent(session.id)}`} className="text-sm underline">
                Open session inspector
              </Link>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (result.target === "review-queue") {
    const items = result.data?.items || [];
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">{result.summary}</p>
        {items.slice(0, 6).map((item) => (
          <div key={item.id} className="rounded-xl border p-4">
            <p className="text-sm text-gray-600">{item.workflowFamily}</p>
            <p className="mt-1 font-medium">{item.title}</p>
            <p className="mt-2 text-sm text-gray-700">{item.detail}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link href={`/admin/workflows/${encodeURIComponent(item.sessionId)}`} className="text-sm underline">
                Open session inspector
              </Link>
              <Link href="/admin/review-queue" className="text-sm underline">
                Open review queue
              </Link>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (result.target === "command-center") {
    const summary = result.data?.summary;
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">{result.summary}</p>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border p-4">
            <p className="text-xs text-gray-500">Sessions</p>
            <p className="mt-1 text-xl font-semibold">{summary?.sessions?.length || 0}</p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-xs text-gray-500">Review items</p>
            <p className="mt-1 text-xl font-semibold">{summary?.reviewQueueSummary?.totalItems || 0}</p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-xs text-gray-500">Recent failures</p>
            <p className="mt-1 text-xl font-semibold">{summary?.recentFailures?.length || 0}</p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-xs text-gray-500">Signals</p>
            <p className="mt-1 text-xl font-semibold">{summary?.signals?.length || 0}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin" className="text-sm underline">
            Open command center
          </Link>
          <Link href="/admin/workflows" className="text-sm underline">
            Open workflows
          </Link>
        </div>
      </div>
    );
  }

  if (result.target === "daily-routine") {
    const routine = result.data?.routine;
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">{result.summary}</p>
        {(routine?.steps || []).slice(0, 6).map((step) => (
          <div key={step.id} className="rounded-xl border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-gray-600">
                  {step.sequence}. {step.workflowFamily}
                </p>
                <p className="mt-1 font-medium">{step.title}</p>
                <p className="mt-2 text-sm text-gray-700">{step.explanation}</p>
                <p className="mt-2 text-xs text-gray-500">Why now: {step.priorityReason}</p>
              </div>
              <span className="rounded-full border px-3 py-1 text-xs font-medium text-gray-700">
                {step.priorityLabel}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              {step.deepLinkTarget ? (
                <Link href={step.deepLinkTarget} className="text-sm underline">
                  Open step
                </Link>
              ) : null}
              <Link href="/admin" className="text-sm underline">
                Open daily routine
              </Link>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (result.target === "routine-step") {
    const step = result.data?.step;
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">{result.summary}</p>
        {step ? (
          <div className="rounded-xl border p-4">
            <p className="text-sm text-gray-600">{step.workflowFamily}</p>
            <p className="mt-1 font-medium">{step.title}</p>
            <p className="mt-2 text-sm text-gray-700">{step.explanation}</p>
            <p className="mt-2 text-xs text-gray-500">Why now: {step.priorityReason}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {step.deepLinkTarget ? (
                <Link href={step.deepLinkTarget} className="text-sm underline">
                  Open step
                </Link>
              ) : null}
              <Link href="/admin" className="text-sm underline">
                Open daily routine
              </Link>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-700">No matching routine step is active right now.</p>
        )}
      </div>
    );
  }

  if (result.target === "schedules") {
    const schedules = result.data?.schedules || [];
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">{result.summary}</p>
        {schedules.slice(0, 6).map((schedule) => (
            <div key={schedule.id} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-gray-600">{schedule.workflowFamily}</p>
                  <p className="mt-1 font-medium">{schedule.title}</p>
                  <p className="mt-2 text-sm text-gray-700">{schedule.summary}</p>
                  <p className="mt-1 text-xs text-gray-500">Mode: {schedule.executionMode || "local_cli"}</p>
                </div>
                <JobStatusBadge status={schedule.status} />
              </div>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link href="/admin/schedules" className="text-sm underline">
                Open schedules
              </Link>
              {schedule.lastJobId ? (
                <Link href={`/admin/jobs/${schedule.lastJobId}`} className="text-sm underline">
                  Open last job
                </Link>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (result.target === "schedule") {
    const schedule = result.data?.schedule;
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">{result.summary}</p>
        <div className="rounded-xl border p-4">
          <p className="text-sm text-gray-600">{schedule?.workflowFamily}</p>
          <p className="mt-1 font-medium">{schedule?.title}</p>
          <p className="mt-2 text-sm text-gray-700">{schedule?.summary}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href="/admin/schedules" className="text-sm underline">
              Open schedules
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (result.target === "session") {
    const detail = result.data?.detail;
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">{result.summary}</p>
        <div className="rounded-xl border p-4">
          <p className="text-sm text-gray-600">{detail?.session?.workflowFamily}</p>
          <p className="mt-1 font-medium">{detail?.session?.title}</p>
          <p className="mt-2 text-sm text-gray-700">{detail?.session?.summary}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href={`/admin/workflows/${encodeURIComponent(detail?.session?.id || "")}`} className="text-sm underline">
              Open session inspector
            </Link>
            <Link href="/admin/workflows" className="text-sm underline">
              Open workflows
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (result.target === "verification") {
    const report = result.data?.report;
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">{result.summary}</p>
        <div className="rounded-xl border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-gray-600">{report?.scope}</p>
              <p className="mt-1 font-medium">{report?.title}</p>
              <p className="mt-2 text-xs text-gray-500">Checked at {report?.checkedAt}</p>
            </div>
            <span className="rounded-full border px-3 py-1 text-xs font-medium text-gray-700">
              {report?.status || "unknown"}
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {(report?.checks || []).map((check) => (
              <div key={check.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{check.name}</p>
                    <p className="mt-2 text-sm text-gray-700">{check.summary}</p>
                  </div>
                  <span className="rounded-full border px-3 py-1 text-xs font-medium text-gray-700">
                    {check.status}
                  </span>
                </div>
                {check.details ? (
                  <p className="mt-2 text-xs text-gray-500">{check.details}</p>
                ) : null}
                {check.recommendedNextStep ? (
                  <p className="mt-2 text-xs text-gray-500">Next step: {check.recommendedNextStep}</p>
                ) : null}
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/admin/tools" className="text-sm underline">
              Open verification tools
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <p className="text-sm text-gray-700">No inspection output.</p>;
}

export default function OperatorCommandConsole() {
  const refreshRef = useRef("");
  const [command, setCommand] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [supportedCommands, setSupportedCommands] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [history, setHistory] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [confirmationState, setConfirmationState] = useState(null);
  const [confirmationChecked, setConfirmationChecked] = useState(false);
  const [typedYes, setTypedYes] = useState("");
  const [isPending, startTransition] = useTransition();

  async function loadCommandData() {
    const commandResponse = await fetch("/api/admin/operator/command", {
      method: "GET",
      cache: "no-store",
    });
    const commandPayload = await commandResponse.json();
    if (!commandResponse.ok || !commandPayload.success) {
      throw new Error(commandPayload.error || "Failed to load supported commands.");
    }
    setSupportedCommands(commandPayload.commands || []);
    setHistory((commandPayload.history || []).slice(0, HISTORY_LIMIT).map(mapHistoryEntry));
  }

  async function loadSessions() {
    const sessionResponse = await fetch("/api/admin/operator/sessions", {
      method: "GET",
      cache: "no-store",
    });
    const sessionPayload = await sessionResponse.json();
    if (!sessionResponse.ok || !sessionPayload.success) {
      throw new Error(sessionPayload.error || "Failed to load sessions.");
    }
    setSessions(sessionPayload.sessions || []);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadBootstrap() {
      try {
        await Promise.all([loadCommandData(), loadSessions()]);
        if (!cancelled) {
          setError("");
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load command console.");
        }
      }
    }

    loadBootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeJobId = result?.mode === "async" ? result.result?.job?.id : "";

  useEffect(() => {
    if (
      activeJobId &&
      TERMINAL_JOB_STATUSES.has(result?.result?.job?.status || "") &&
      refreshRef.current !== activeJobId
    ) {
      refreshRef.current = activeJobId;
      Promise.all([loadSessions(), loadCommandData()]).catch(() => {});
    }
  }, [activeJobId, result]);

  useEffect(() => {
    if (!activeJobId || TERMINAL_JOB_STATUSES.has(result?.result?.job?.status || "")) {
      return undefined;
    }
    let cancelled = false;
    const intervalId = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/admin/operator/jobs/${activeJobId}`, {
          method: "GET",
          cache: "no-store",
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || "Failed to refresh the job.");
        }
        if (!cancelled) {
          setResult((current) => {
            if (!current || current.mode !== "async") {
              return current;
            }
            return {
              ...current,
              result: {
                ...current.result,
                job: payload.job,
              },
            };
          });
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
  }, [activeJobId, result]);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) || null,
    [selectedSessionId, sessions]
  );
  const actionResultSessionId =
    result?.result?.links?.session
      ? decodeURIComponent(result.result.links.session.split("/admin/workflows/")[1] || "")
      : result?.result?.job?.sessionIds?.[0] || "";
  const actionResultSessionHref = actionResultSessionId
    ? `/admin/workflows/${encodeURIComponent(actionResultSessionId)}`
    : null;

  async function submitCommand(overrideConfirmation = null, overrideCommand = null, overrideSessionId = null) {
    const nextCommand = normalizeString(overrideCommand ?? command);
    const nextSessionId = overrideSessionId ?? selectedSessionId;

    if (!nextCommand) {
      setError("Enter a structured operator command.");
      return;
    }

    const response = await fetch("/api/admin/operator/command", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        command: nextCommand,
        selectedSessionId: nextSessionId || "",
        confirmation: overrideConfirmation || undefined,
      }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || "Failed to run the operator command.");
    }
    return payload;
  }

  function handleSubmit(event) {
    event.preventDefault();
    setError("");

    startTransition(async () => {
      try {
        const payload = await submitCommand();
        if (!payload) {
          return;
        }
        if (payload.mode === "confirmation_required") {
          setConfirmationState(payload.result);
          return;
        }
        setConfirmationState(null);
        setConfirmationChecked(false);
        setTypedYes("");
        setResult(payload);
        await loadCommandData();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Failed to run the operator command.");
      }
    });
  }

  function rerunHistoryEntry(entry) {
    setCommand(entry.command);
    setSelectedSessionId(entry.selectedSessionId || "");
    setError("");

    startTransition(async () => {
      try {
        const payload = await submitCommand(null, entry.command, entry.selectedSessionId || "");
        if (!payload) {
          return;
        }
        if (payload.mode === "confirmation_required") {
          setConfirmationState(payload.result);
          return;
        }
        setConfirmationState(null);
        setConfirmationChecked(false);
        setTypedYes("");
        setResult(payload);
        await loadCommandData();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Failed to rerun the command.");
      }
    });
  }

  function handleConfirmation() {
    if (!confirmationState) {
      return;
    }
    setError("");

    startTransition(async () => {
      try {
        const payload = await submitCommand(
          {
            checked: confirmationChecked,
            typedYes,
          },
          confirmationState.parsedCommand.rawCommand,
          confirmationState.parsedCommand.sessionId || selectedSessionId
        );
        if (!payload) {
          return;
        }
        setConfirmationState(null);
        setConfirmationChecked(false);
        setTypedYes("");
        setResult(payload);
        await loadCommandData();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Failed to confirm the command.");
      }
    });
  }

  return (
    <main className="mx-auto max-w-[1700px] space-y-4 px-4 py-4">
      <section className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-wide text-gray-600">Command Interface</p>
        <h2 className="text-lg font-semibold">Deterministic operator command console</h2>
        <p className="max-w-5xl text-[12px] text-gray-700">
          Commands are structured and deterministic. They do not use AI parsing, do not build raw
          CLI strings in the browser, and still run through the registry, broker, runner, jobs,
          sessions, and canonical workflow artifacts.
        </p>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded border border-zinc-300 bg-white p-4 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block space-y-2">
              <span className="text-[12px] font-medium">Selected session context</span>
              <select
                value={selectedSessionId}
                onChange={(event) => setSelectedSessionId(event.target.value)}
                className="w-full rounded border px-2 py-1.5 text-[12px]"
              >
                <option value="">No session context</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.title} ({session.workflowFamily})
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-[12px] font-medium">Command</span>
              <input
                type="text"
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                className="w-full rounded border px-2 py-1.5 font-mono text-[12px]"
                placeholder="run current-admin"
                spellCheck={false}
              />
            </label>

            {selectedSession ? (
              <div className="rounded border bg-zinc-50 p-3 text-[12px] text-gray-700">
                Session context: <span className="font-medium">{selectedSession.title}</span>
              </div>
            ) : null}

            {error ? (
              <div className="rounded border border-red-300 bg-red-50 p-3 text-[12px] text-red-950">
                {error}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={isPending}
                className="rounded border border-stone-900 bg-stone-900 px-3 py-1.5 text-[12px] font-medium text-white"
              >
                {isPending ? "Running…" : "Run command"}
              </button>
              <button
                type="button"
                onClick={() => setCommand("")}
                className="rounded border px-3 py-1.5 text-[12px]"
              >
                Clear
              </button>
            </div>
          </form>
        </div>

        <div className="rounded border border-zinc-300 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold">Supported commands</h3>
          <div className="mt-3 overflow-x-auto rounded border border-zinc-200">
            <table className="min-w-full text-[12px]">
              <tbody>
            {supportedCommands.map((item) => (
              <tr key={item.syntax} className="odd:bg-white even:bg-zinc-50/50">
                <td className="border-b border-zinc-200 px-3 py-2 font-mono text-[11px]">{item.syntax}</td>
                <td className="border-b border-zinc-200 px-3 py-2 text-[11px] text-gray-700">{item.description}</td>
              </tr>
            ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded border border-zinc-300 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold">Command history</h3>
          <div className="mt-3 space-y-2">
            {history.length ? (
              history.map((entry) => (
                <div key={entry.id} className="rounded border p-3">
                  <p className="font-mono text-[11px]">{entry.command}</p>
                  <p className="mt-1 text-[11px] text-gray-500">
                    {entry.selectedSessionId ? `Session: ${entry.selectedSessionId}` : "No session context"}
                  </p>
                  {entry.resultStatus ? (
                    <p className="mt-1 text-[11px] text-gray-500">Result: {entry.resultStatus}</p>
                  ) : null}
                  {entry.executionMode ? (
                    <p className="mt-1 text-[11px] text-gray-500">Mode: {entry.executionMode}</p>
                  ) : null}
                  {entry.summary ? (
                    <p className="mt-1 text-[12px] text-gray-700">{entry.summary}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => rerunHistoryEntry(entry)}
                      className="rounded border px-2.5 py-1 text-[12px]"
                    >
                      Re-run
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCommand(entry.command);
                        setSelectedSessionId(entry.selectedSessionId || "");
                      }}
                      className="rounded border px-2.5 py-1 text-[12px]"
                    >
                      Load
                    </button>
                    {entry.relatedJobId ? (
                      <Link href={`/admin/jobs/${entry.relatedJobId}`} className="rounded border px-2.5 py-1 text-[12px]">
                        Open job
                      </Link>
                    ) : null}
                    {entry.relatedSessionId ? (
                      <Link
                        href={`/admin/workflows/${encodeURIComponent(entry.relatedSessionId)}`}
                        className="rounded border px-2.5 py-1 text-[12px]"
                      >
                        Open session
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-[12px] text-gray-700">No command history yet.</p>
            )}
          </div>
        </div>

        <div className="rounded border border-zinc-300 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold">Result / Output</h3>
          <div className="mt-4">
            {!result ? (
              <p className="text-[12px] text-gray-700">
                Run a command to inspect sessions, review queue state, or enqueue a broker-backed action.
              </p>
            ) : result.mode === "async" ? (
              <div className="space-y-3">
                <div className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-gray-600">{result.result?.parsedCommand?.actionId}</p>
                      {!result.result?.parsedCommand?.actionId && result.result?.schedule?.id ? (
                        <p className="text-sm text-gray-600">{result.result.schedule.id}</p>
                      ) : null}
                      <p className="mt-1 font-medium">{result.result?.title}</p>
                      <p className="mt-2 text-sm text-gray-700">
                        {result.result?.job?.summary || result.result?.summary}
                      </p>
                      <p className="mt-2 text-xs text-gray-500">
                        Mode: {result.result?.job?.execution?.execution_mode || result.result?.job?.metadataJson?.execution_mode || result.result?.parsedCommand?.executionMode || "local_cli"}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Runtime: {result.result?.job?.execution?.executor?.executor_backend || result.result?.job?.metadataJson?.executor?.executor_backend || "-"} @{" "}
                        {result.result?.job?.execution?.executor?.executor_host || result.result?.job?.metadataJson?.executor?.executor_host || "-"}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Transport: {result.result?.job?.execution?.executor?.executor_transport || result.result?.job?.metadataJson?.executor_transport || "-"}
                      </p>
                      {result.result?.job?.failure?.nextSafeActionTitle ? (
                        <p className="mt-2 text-xs text-red-900">
                          Next safe action: {result.result.job.failure.nextSafeActionTitle}
                        </p>
                      ) : null}
                      {result.result?.job?.errorJson?.message ? (
                        <p className="mt-2 text-xs text-red-900">
                          Error: {result.result.job.errorJson.message}
                        </p>
                      ) : null}
                      {result.result?.sessionImpact ? (
                        <p className="mt-2 text-sm text-gray-700">{result.result.sessionImpact}</p>
                      ) : null}
                      {result.result?.nextRecommendedAction ? (
                        <p className="mt-2 text-xs text-gray-500">
                          Next recommended action: {result.result.nextRecommendedAction}
                        </p>
                      ) : null}
                    </div>
                    <JobStatusBadge status={result.result?.job?.status || "queued"} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {result.result?.links?.job ? (
                      <Link href={result.result.links.job} className="text-sm underline">
                        Open job detail
                      </Link>
                    ) : null}
                    {actionResultSessionHref ? (
                      <Link href={actionResultSessionHref} className="text-sm underline">
                        Open session inspector
                      </Link>
                    ) : null}
                  </div>
                  {result.result?.job?.output?.workspaceSummary?.state ? (
                    <div className="mt-4 rounded-xl border bg-stone-50 p-4 text-sm text-gray-700">
                      Resulting state: {result.result.job.output.workspaceSummary.state}
                    </div>
                  ) : null}
                  {result.result?.assist ? (
                    <div className="mt-4 rounded-xl border bg-stone-50 p-4 text-sm text-gray-700">
                      Assist mode: {result.result.assist.assistMode}. Model used:{" "}
                      {result.result.assist.usedModel ? "yes" : "no"}.
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              renderInspectResult(result.result)
            )}
          </div>
        </div>
      </section>

      {confirmationState ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Mutating command confirmation</p>
              <h3 className="text-xl font-semibold">{confirmationState.confirmation?.title}</h3>
              <p className="text-sm text-gray-700">{confirmationState.confirmation?.description}</p>
            </div>

            <label className="mt-4 flex items-start gap-3 rounded-xl border p-3 text-sm">
              <input
                type="checkbox"
                checked={confirmationChecked}
                onChange={(event) => setConfirmationChecked(event.target.checked)}
              />
              <span>{confirmationState.confirmation?.checkboxLabel}</span>
            </label>

            {confirmationState.confirmation?.requireTypedYes ? (
              <label className="mt-4 block space-y-2">
                <span className="text-sm font-medium">Type YES to continue</span>
                <input
                  type="text"
                  value={typedYes}
                  onChange={(event) => setTypedYes(event.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="YES"
                />
              </label>
            ) : null}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setConfirmationState(null);
                  setConfirmationChecked(false);
                  setTypedYes("");
                }}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmation}
                disabled={!confirmationChecked || (confirmationState.confirmation?.requireTypedYes && normalizeString(typedYes) !== "YES") || isPending}
                className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Running…" : "Confirm command"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
