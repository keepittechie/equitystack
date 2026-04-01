"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { formatAdminDateTime } from "@/app/admin/components/adminDateTime";
import JobStatusBadge from "@/app/admin/jobs/JobStatusBadge";
import { deriveExecutionMonitorState, executionPhaseLabel, TERMINAL_JOB_STATUSES } from "@/app/admin/components/executionMonitor";
import { readAdminJsonResponse } from "@/app/admin/components/readAdminJsonResponse";

const HISTORY_LIMIT = 12;

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

function TraceTable({ trace = [] }) {
  if (!trace.length) {
    return null;
  }

  return (
    <div className="overflow-x-auto rounded border border-[#E5EAF0] bg-white">
      <table className="min-w-full text-[11px]">
        <tbody>
          {trace.map((entry) => (
            <tr key={entry.key} className="odd:bg-white even:bg-[#F9FBFD]">
              <td className="border-b border-[#E5EAF0] px-2 py-1 font-mono uppercase tracking-wide text-[#6B7280]">
                {entry.label}
              </td>
              <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">{entry.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderInspectResult(result) {
  if (result.target === "sessions") {
    const sessions = result.data?.sessions || [];
    return (
      <div className="space-y-3">
        <p className="text-sm text-[#4B5563]">{result.summary}</p>
        {sessions.slice(0, 6).map((session) => (
          <div key={session.id} className="rounded border border-[#E5EAF0] bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-[#6B7280]">{session.workflowFamily}</p>
                <p className="mt-1 font-medium text-[#1F2937]">{session.title}</p>
                <p className="mt-2 text-sm text-[#4B5563]">{session.summary}</p>
              </div>
              <span className="rounded border border-[#E5EAF0] bg-[#F9FBFD] px-3 py-1 text-xs font-medium text-[#4B5563]">
                {session.canonicalState}
              </span>
            </div>
            <div className="mt-3">
              <Link href={`/admin/workflows/${encodeURIComponent(session.id)}`} className="text-sm text-[#3B82F6] underline">
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
        <p className="text-sm text-[#4B5563]">{result.summary}</p>
        {items.slice(0, 6).map((item) => (
          <div key={item.id} className="rounded border border-[#E5EAF0] bg-white p-3">
            <p className="text-sm text-[#6B7280]">{item.workflowFamily}</p>
            <p className="mt-1 font-medium text-[#1F2937]">{item.title}</p>
            <p className="mt-2 text-sm text-[#4B5563]">{item.detail}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link href={`/admin/workflows/${encodeURIComponent(item.sessionId)}`} className="text-sm text-[#3B82F6] underline">
                Open session inspector
              </Link>
              <Link href="/admin/review-queue" className="text-sm text-[#3B82F6] underline">
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
        <p className="text-sm text-[#4B5563]">{result.summary}</p>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded border border-[#E5EAF0] bg-white p-3">
            <p className="text-xs text-[#6B7280]">Sessions</p>
            <p className="mt-1 text-xl font-semibold text-[#1F2937]">{summary?.sessions?.length || 0}</p>
          </div>
          <div className="rounded border border-[#E5EAF0] bg-white p-3">
            <p className="text-xs text-[#6B7280]">Review items</p>
            <p className="mt-1 text-xl font-semibold text-[#1F2937]">{summary?.reviewQueueSummary?.totalItems || 0}</p>
          </div>
          <div className="rounded border border-[#E5EAF0] bg-white p-3">
            <p className="text-xs text-[#6B7280]">Recent failures</p>
            <p className="mt-1 text-xl font-semibold text-[#1F2937]">{summary?.recentFailures?.length || 0}</p>
          </div>
          <div className="rounded border border-[#E5EAF0] bg-white p-3">
            <p className="text-xs text-[#6B7280]">Signals</p>
            <p className="mt-1 text-xl font-semibold text-[#1F2937]">{summary?.signals?.length || 0}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin" className="text-sm text-[#3B82F6] underline">
            Open command center
          </Link>
          <Link href="/admin/workflows" className="text-sm text-[#3B82F6] underline">
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
        <p className="text-sm text-[#4B5563]">{result.summary}</p>
        {(routine?.steps || []).slice(0, 6).map((step) => (
          <div key={step.id} className="rounded border border-[#E5EAF0] bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-[#6B7280]">
                  {step.sequence}. {step.workflowFamily}
                </p>
                <p className="mt-1 font-medium text-[#1F2937]">{step.title}</p>
                <p className="mt-2 text-sm text-[#4B5563]">{step.explanation}</p>
                <p className="mt-2 text-xs text-[#6B7280]">Why now: {step.priorityReason}</p>
              </div>
              <span className="rounded border border-[#E5EAF0] bg-[#F9FBFD] px-3 py-1 text-xs font-medium text-[#4B5563]">
                {step.priorityLabel}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              {step.deepLinkTarget ? (
                <Link href={step.deepLinkTarget} className="text-sm text-[#3B82F6] underline">
                  Open step
                </Link>
              ) : null}
              <Link href="/admin" className="text-sm text-[#3B82F6] underline">
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
        <p className="text-sm text-[#4B5563]">{result.summary}</p>
        {step ? (
          <div className="rounded border border-[#E5EAF0] bg-white p-3">
            <p className="text-sm text-[#6B7280]">{step.workflowFamily}</p>
            <p className="mt-1 font-medium text-[#1F2937]">{step.title}</p>
            <p className="mt-2 text-sm text-[#4B5563]">{step.explanation}</p>
            <p className="mt-2 text-xs text-[#6B7280]">Why now: {step.priorityReason}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {step.deepLinkTarget ? (
                <Link href={step.deepLinkTarget} className="text-sm text-[#3B82F6] underline">
                  Open step
                </Link>
              ) : null}
              <Link href="/admin" className="text-sm text-[#3B82F6] underline">
                Open daily routine
              </Link>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[#4B5563]">No matching routine step is active right now.</p>
        )}
      </div>
    );
  }

  if (result.target === "schedules") {
    const schedules = result.data?.schedules || [];
    return (
      <div className="space-y-3">
        <p className="text-sm text-[#4B5563]">{result.summary}</p>
        {schedules.slice(0, 6).map((schedule) => (
            <div key={schedule.id} className="rounded border border-[#E5EAF0] bg-white p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-[#6B7280]">{schedule.workflowFamily}</p>
                  <p className="mt-1 font-medium text-[#1F2937]">{schedule.title}</p>
                  <p className="mt-2 text-sm text-[#4B5563]">{schedule.summary}</p>
                  <p className="mt-1 text-xs text-[#6B7280]">Mode: {schedule.executionMode || "local_cli"}</p>
                </div>
                <JobStatusBadge status={schedule.status} />
              </div>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link href="/admin/schedules" className="text-sm text-[#3B82F6] underline">
                Open schedules
              </Link>
              {schedule.lastJobId ? (
                <Link href={`/admin/jobs/${schedule.lastJobId}`} className="text-sm text-[#3B82F6] underline">
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
        <p className="text-sm text-[#4B5563]">{result.summary}</p>
        <div className="rounded border border-[#E5EAF0] bg-white p-3">
          <p className="text-sm text-[#6B7280]">{schedule?.workflowFamily}</p>
          <p className="mt-1 font-medium text-[#1F2937]">{schedule?.title}</p>
          <p className="mt-2 text-sm text-[#4B5563]">{schedule?.summary}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href="/admin/schedules" className="text-sm text-[#3B82F6] underline">
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
        <p className="text-sm text-[#4B5563]">{result.summary}</p>
        <div className="rounded border border-[#E5EAF0] bg-white p-3">
          <p className="text-sm text-[#6B7280]">{detail?.session?.workflowFamily}</p>
          <p className="mt-1 font-medium text-[#1F2937]">{detail?.session?.title}</p>
          <p className="mt-2 text-sm text-[#4B5563]">{detail?.session?.summary}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href={`/admin/workflows/${encodeURIComponent(detail?.session?.id || "")}`} className="text-sm text-[#3B82F6] underline">
              Open session inspector
            </Link>
            <Link href="/admin/workflows" className="text-sm text-[#3B82F6] underline">
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
        <p className="text-sm text-[#4B5563]">{result.summary}</p>
        <div className="rounded border border-[#E5EAF0] bg-white p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-[#6B7280]">{report?.scope}</p>
              <p className="mt-1 font-medium text-[#1F2937]">{report?.title}</p>
              <p className="mt-2 text-xs text-[#6B7280]">Checked at {formatAdminDateTime(report?.checkedAt)}</p>
            </div>
            <span className="rounded border border-[#E5EAF0] bg-[#F9FBFD] px-3 py-1 text-xs font-medium text-[#4B5563]">
              {report?.status || "unknown"}
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {(report?.checks || []).map((check) => (
              <div key={check.id} className="rounded border border-[#E5EAF0] bg-[#F9FBFD] p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[#1F2937]">{check.name}</p>
                    <p className="mt-2 text-sm text-[#4B5563]">{check.summary}</p>
                  </div>
                  <span className="rounded border border-[#E5EAF0] bg-white px-3 py-1 text-xs font-medium text-[#4B5563]">
                    {check.status}
                  </span>
                </div>
                {check.details ? (
                  <p className="mt-2 text-xs text-[#6B7280]">{check.details}</p>
                ) : null}
                {check.recommendedNextStep ? (
                  <p className="mt-2 text-xs text-[#6B7280]">Next step: {check.recommendedNextStep}</p>
                ) : null}
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/admin/tools" className="text-sm text-[#3B82F6] underline">
              Open verification tools
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <p className="text-sm text-[#4B5563]">No inspection output.</p>;
}

export default function OperatorCommandConsole() {
  const refreshRef = useRef("");
  const archiveRef = useRef("");
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
  const [recentExecutions, setRecentExecutions] = useState([]);

  async function loadCommandData() {
    const commandResponse = await fetch("/api/admin/operator/command", {
      method: "GET",
      cache: "no-store",
    });
    const commandPayload = await readAdminJsonResponse(commandResponse, "/api/admin/operator/command");
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
    const sessionPayload = await readAdminJsonResponse(sessionResponse, "/api/admin/operator/sessions");
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
  const activeExecution =
    result?.mode === "async" && result.result?.job
      ? {
          job: result.result.job,
          actionTitle:
            result.result.title ||
            result.result.parsedCommand?.actionId ||
            result.result.parsedCommand?.rawCommand ||
            "Workflow action",
          commandText:
            result.result.parsedCommand?.rawCommand ||
            result.result.job?.command?.rawCommand ||
            result.result.job?.command?.cliCommandTemplate ||
            "",
        }
      : null;
  const activeLifecycle = deriveExecutionMonitorState(activeExecution?.job, {
    commandText: activeExecution?.commandText,
  });
  const commandLocked = isPending || Boolean(activeLifecycle?.shouldPoll);

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
        const payload = await readAdminJsonResponse(response, `/api/admin/operator/jobs/${activeJobId}`);
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

  useEffect(() => {
    if (!activeExecution?.job?.id || !TERMINAL_JOB_STATUSES.has(activeExecution.job.status)) {
      return;
    }

    const key = `${activeExecution.job.id}:${activeExecution.job.status}`;
    if (activeLifecycle?.isStopPoint || archiveRef.current === key) {
      return;
    }

    archiveRef.current = key;
    setRecentExecutions((current) =>
      [{ ...activeExecution }, ...current.filter((item) => item.job.id !== activeExecution.job.id)].slice(0, 8)
    );
    setResult(null);
  }, [activeExecution, activeLifecycle]);

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
    const payload = await readAdminJsonResponse(response, "/api/admin/operator/command");
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
        <p className="font-mono text-[11px] uppercase tracking-wide text-[#6B7280]">Command Interface</p>
        <h2 className="text-lg font-semibold text-[#1F2937]">Deterministic operator command console</h2>
        <p className="max-w-5xl text-[12px] text-[#4B5563]">
          Commands are structured and deterministic. They do not use AI parsing, do not build raw
          CLI strings in the browser, and still run through the registry, broker, runner, jobs,
          sessions, and canonical workflow artifacts.
        </p>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded border border-[#E5EAF0] bg-[#EEF2F6] p-4 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block space-y-2">
              <span className="text-[12px] font-medium text-[#1F2937]">Selected session context</span>
              <select
                value={selectedSessionId}
                onChange={(event) => setSelectedSessionId(event.target.value)}
                disabled={commandLocked}
                className="w-full rounded border border-[#E5EAF0] bg-white px-2 py-1.5 text-[12px] text-[#1F2937] outline-none focus:border-[#3B82F6] disabled:cursor-not-allowed disabled:opacity-60"
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
              <span className="text-[12px] font-medium text-[#1F2937]">Command</span>
              <input
                type="text"
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                disabled={commandLocked}
                className="w-full rounded border border-[#E5EAF0] bg-white px-2 py-1.5 font-mono text-[12px] text-[#111827] outline-none placeholder:text-[#6B7280] focus:border-[#3B82F6] disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="run current-admin"
                spellCheck={false}
              />
            </label>

            {selectedSession ? (
              <div className="rounded border border-[#E5EAF0] bg-white p-3 text-[12px] text-[#4B5563]">
                Session context: <span className="font-medium">{selectedSession.title}</span>
              </div>
            ) : null}

            {error ? (
              <div className="rounded border border-[#FECACA] bg-[#FEF2F2] p-3 text-[12px] text-[#EF4444]">
                {error}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={commandLocked}
                className="rounded border border-[#3B82F6] bg-[#3B82F6] px-3 py-1.5 text-[12px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {commandLocked ? "Execution locked…" : "Run command"}
              </button>
              <button
                type="button"
                onClick={() => setCommand("")}
                className="rounded border border-[#E5EAF0] bg-white px-3 py-1.5 text-[12px] text-[#1F2937]"
              >
                Clear
              </button>
            </div>
          </form>
        </div>

        <div className="rounded border border-[#E5EAF0] bg-[#EEF2F6] p-4 shadow-sm">
          <h3 className="text-base font-semibold text-[#1F2937]">Supported commands</h3>
          <div className="mt-3 overflow-x-auto rounded border border-[#E5EAF0] bg-white">
            <table className="min-w-full text-[12px]">
              <tbody>
                {supportedCommands.map((item) => (
                  <tr key={item.syntax} className="odd:bg-white even:bg-[#F9FBFD] hover:bg-[#F1F5F9]">
                    <td className="border-b border-[#E5EAF0] px-3 py-2 font-mono text-[11px] text-[#111827]">{item.syntax}</td>
                    <td className="border-b border-[#E5EAF0] px-3 py-2 text-[11px] text-[#4B5563]">{item.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {activeExecution?.job ? (
        <section className="rounded border border-[#E5EAF0] bg-[#EEF2F6] p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wide text-[#6B7280]">Active Execution</p>
              <h3 className="mt-1 text-base font-semibold text-[#1F2937]">{activeExecution.actionTitle}</h3>
              <p className="mt-1 text-[11px] text-[#4B5563]">
                {activeLifecycle?.phase === "running" || activeLifecycle?.phase === "queued" ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 animate-spin rounded-full border border-[#3B82F6] border-t-transparent" />
                    {executionPhaseLabel(activeLifecycle.phase)}
                  </span>
                ) : (
                  executionPhaseLabel(activeLifecycle?.phase || activeExecution.job.status)
                )}
              </p>
            </div>
            <JobStatusBadge status={activeLifecycle?.phase || activeExecution.job.status} />
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-4">
            <div className="rounded border border-[#E5EAF0] bg-white px-2 py-1.5">
              <p className="text-[10px] uppercase tracking-wide text-[#6B7280]">Execution Id</p>
              <p className="mt-1 font-mono text-[11px] text-[#111827]">{activeExecution.job.id}</p>
            </div>
            <div className="rounded border border-[#E5EAF0] bg-white px-2 py-1.5">
              <p className="text-[10px] uppercase tracking-wide text-[#6B7280]">Started</p>
              <p className="mt-1 text-[11px] text-[#1F2937]">
                {formatAdminDateTime(activeExecution.job.timestamps?.startedAt || activeExecution.job.timestamps?.createdAt)}
              </p>
            </div>
            <div className="rounded border border-[#E5EAF0] bg-white px-2 py-1.5">
              <p className="text-[10px] uppercase tracking-wide text-[#6B7280]">Current State</p>
              <p className="mt-1 text-[11px] text-[#1F2937]">{activeLifecycle?.workspaceState || activeExecution.job.status}</p>
            </div>
            <div className="rounded border border-[#E5EAF0] bg-white px-2 py-1.5">
              <p className="text-[10px] uppercase tracking-wide text-[#6B7280]">Next Step</p>
              <p className="mt-1 text-[11px] text-[#1F2937]">{activeLifecycle?.nextActionTitle || "Continue polling"}</p>
            </div>
          </div>

          <div className="mt-3 rounded border border-[#E5EAF0] bg-[#F3F4F6] px-2 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-[#6B7280]">Current Command</p>
            <p className="mt-1 break-all font-mono text-[11px] text-[#111827]">{activeLifecycle?.currentCommand}</p>
          </div>

          <div className="mt-3 rounded border border-[#E5EAF0] bg-white px-2 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-[#6B7280]">Most Recent Update</p>
            <p className="mt-1 text-[11px] text-[#4B5563]">{activeLifecycle?.latestLine}</p>
          </div>

          {activeLifecycle?.isStopPoint ? (
            <div className="mt-3 rounded border border-[#FDE68A] bg-[#FFFBEB] px-2 py-2 text-[11px] text-[#B45309]">
              <div className="font-medium">{activeLifecycle.stopMarker}</div>
              <div className="mt-1">
                Next required operator action: {activeLifecycle.nextActionTitle || "Open the workflow checkpoint."}
              </div>
            </div>
          ) : null}

          <div className="mt-3">
            <TraceTable trace={activeLifecycle?.trace || []} />
          </div>

          <div className="mt-3 flex flex-wrap gap-3">
            {activeLifecycle?.isStopPoint && activeLifecycle.nextHref ? (
              <Link href={activeLifecycle.nextHref} className="rounded border border-[#FDE68A] bg-[#FFFBEB] px-3 py-1.5 text-[11px] font-medium text-[#B45309]">
                {activeLifecycle.nextLabel}
              </Link>
            ) : null}
            <Link href={activeLifecycle?.jobHref || "/admin/jobs"} className="rounded border border-[#E5EAF0] bg-white px-3 py-1.5 text-[11px] text-[#1F2937]">
              Open job detail
            </Link>
            {activeLifecycle?.sessionHref ? (
              <Link href={activeLifecycle.sessionHref} className="rounded border border-[#E5EAF0] bg-white px-3 py-1.5 text-[11px] text-[#1F2937]">
                Open session
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      {recentExecutions.length ? (
        <section className="rounded border border-[#E5EAF0] bg-[#EEF2F6] p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wide text-[#6B7280]">Recent Workflow Actions</p>
              <h3 className="mt-1 text-base font-semibold text-[#1F2937]">Completed or failed workflow executions</h3>
            </div>
            <Link href="/admin/jobs" className="text-[11px] text-[#3B82F6] underline underline-offset-2">
              View jobs
            </Link>
          </div>
          <div className="mt-3 overflow-x-auto rounded border border-[#E5EAF0] bg-white">
            <table className="min-w-[980px] w-full text-[11px]">
              <thead className="bg-[#F9FBFD] text-left uppercase tracking-wide text-[#6B7280]">
                <tr>
                  <th className="border-b border-[#E5EAF0] px-2 py-1">Status</th>
                  <th className="border-b border-[#E5EAF0] px-2 py-1">Workflow Action</th>
                  <th className="border-b border-[#E5EAF0] px-2 py-1">Execution Id</th>
                  <th className="border-b border-[#E5EAF0] px-2 py-1">Command</th>
                  <th className="border-b border-[#E5EAF0] px-2 py-1">Finished</th>
                  <th className="border-b border-[#E5EAF0] px-2 py-1">Action</th>
                </tr>
              </thead>
              <tbody>
                {recentExecutions.map((entry) => (
                  <tr key={entry.job.id} className="odd:bg-white even:bg-[#F9FBFD] hover:bg-[#F1F5F9]">
                    <td className="border-b border-[#E5EAF0] px-2 py-1">
                      <JobStatusBadge status={entry.job.status} />
                    </td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#1F2937]">{entry.actionTitle}</td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1 font-mono text-[#111827]">{entry.job.id}</td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1 font-mono text-[#111827]">{entry.commandText || "—"}</td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">
                      {formatAdminDateTime(entry.job.timestamps?.finishedAt || entry.job.timestamps?.updatedAt)}
                    </td>
                    <td className="border-b border-[#E5EAF0] px-2 py-1">
                      <Link href={`/admin/jobs/${entry.job.id}`} className="text-[#3B82F6] underline underline-offset-2">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded border border-[#E5EAF0] bg-[#EEF2F6] p-4 shadow-sm">
          <h3 className="text-base font-semibold text-[#1F2937]">Command history</h3>
          <div className="mt-3 space-y-2">
            {history.length ? (
              history.map((entry) => (
                <div key={entry.id} className="rounded border border-[#E5EAF0] bg-white p-3">
                  <p className="font-mono text-[11px] text-[#111827]">{entry.command}</p>
                  <p className="mt-1 text-[11px] text-[#6B7280]">
                    {entry.selectedSessionId ? `Session: ${entry.selectedSessionId}` : "No session context"}
                  </p>
                  {entry.resultStatus ? (
                    <p className="mt-1 text-[11px] text-[#6B7280]">Result: {entry.resultStatus}</p>
                  ) : null}
                  {entry.executionMode ? (
                    <p className="mt-1 text-[11px] text-[#6B7280]">Mode: {entry.executionMode}</p>
                  ) : null}
                  {entry.summary ? (
                    <p className="mt-1 text-[12px] text-[#4B5563]">{entry.summary}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => rerunHistoryEntry(entry)}
                      className="rounded border border-[#E5EAF0] bg-white px-2.5 py-1 text-[12px] text-[#1F2937]"
                    >
                      Re-run
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCommand(entry.command);
                        setSelectedSessionId(entry.selectedSessionId || "");
                      }}
                      className="rounded border border-[#E5EAF0] bg-white px-2.5 py-1 text-[12px] text-[#1F2937]"
                    >
                      Load
                    </button>
                    {entry.relatedJobId ? (
                      <Link href={`/admin/jobs/${entry.relatedJobId}`} className="rounded border border-[#E5EAF0] bg-white px-2.5 py-1 text-[12px] text-[#1F2937]">
                        Open job
                      </Link>
                    ) : null}
                    {entry.relatedSessionId ? (
                      <Link
                        href={`/admin/workflows/${encodeURIComponent(entry.relatedSessionId)}`}
                        className="rounded border border-[#E5EAF0] bg-white px-2.5 py-1 text-[12px] text-[#1F2937]"
                      >
                        Open session
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-[12px] text-[#6B7280]">No command history yet.</p>
            )}
          </div>
        </div>

        <div className="rounded border border-[#E5EAF0] bg-[#EEF2F6] p-4 shadow-sm">
          <h3 className="text-base font-semibold text-[#1F2937]">Result / Output</h3>
          <div className="mt-4">
            {!result ? (
              <p className="text-[12px] text-[#6B7280]">
                Run a command to inspect sessions, review queue state, or enqueue a broker-backed action.
              </p>
            ) : result.mode === "async" ? (
              <div className="space-y-3 rounded border border-[#E5EAF0] bg-white p-3 text-[12px] text-[#4B5563]">
                <p>
                  Async workflow execution is tracked above while it is running or paused at a stop point.
                </p>
                {result.result?.job?.output?.workspaceSummary?.state ? (
                  <p className="text-[#6B7280]">
                    Latest resulting state: {result.result.job.output.workspaceSummary.state}
                  </p>
                ) : null}
                {actionResultSessionHref ? (
                  <Link href={actionResultSessionHref} className="text-[#3B82F6] underline underline-offset-2">
                    Open session inspector
                  </Link>
                ) : null}
              </div>
            ) : (
              renderInspectResult(result.result)
            )}
          </div>
        </div>
      </section>

      {confirmationState ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 px-4">
          <div className="w-full max-w-lg rounded border border-[#E5EAF0] bg-white p-6 shadow-xl">
            <div className="space-y-2">
              <p className="text-sm text-[#6B7280]">Mutating command confirmation</p>
              <h3 className="text-xl font-semibold text-[#1F2937]">{confirmationState.confirmation?.title}</h3>
              <p className="text-sm text-[#4B5563]">{confirmationState.confirmation?.description}</p>
            </div>

            <label className="mt-4 flex items-start gap-3 rounded border border-[#E5EAF0] bg-[#F9FBFD] p-3 text-sm text-[#1F2937]">
              <input
                type="checkbox"
                checked={confirmationChecked}
                onChange={(event) => setConfirmationChecked(event.target.checked)}
              />
              <span>{confirmationState.confirmation?.checkboxLabel}</span>
            </label>

            {confirmationState.confirmation?.requireTypedYes ? (
              <label className="mt-4 block space-y-2">
                <span className="text-sm font-medium text-[#1F2937]">Type YES to continue</span>
                <input
                  type="text"
                  value={typedYes}
                  onChange={(event) => setTypedYes(event.target.value)}
                  className="w-full rounded border border-[#E5EAF0] bg-white px-3 py-2 text-sm text-[#1F2937] outline-none placeholder:text-[#6B7280] focus:border-[#3B82F6]"
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
                className="rounded border border-[#E5EAF0] bg-white px-4 py-2 text-sm text-[#1F2937]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmation}
                disabled={!confirmationChecked || (confirmationState.confirmation?.requireTypedYes && normalizeString(typedYes) !== "YES") || isPending}
                className="rounded border border-[#FECACA] bg-[#FEF2F2] px-4 py-2 text-sm font-medium text-[#EF4444] disabled:cursor-not-allowed disabled:opacity-60"
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
