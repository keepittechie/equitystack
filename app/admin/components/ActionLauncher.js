"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

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
  redirectToJob = true,
}) {
  const router = useRouter();
  const [actions, setActions] = useState([]);
  const [selectedActionId, setSelectedActionId] = useState(initialActionId);
  const [input, setInput] = useState({});
  const [executionMode, setExecutionMode] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [result, setResult] = useState(null);
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
        const payload = await response.json();
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

  const selectedAction = actions.find((action) => action.id === selectedActionId) || null;
  const availableExecutionModes = selectedAction?.executionModes?.allowedModes || ["local_cli"];
  const visibleFields = Object.entries(selectedAction?.inputSchema?.fields || {});
  const requiresMutatingConfirmation = Boolean(
    selectedAction?.execution?.mutating && input?.apply && input?.yes
  );

  function handleActionChange(nextActionId) {
    const nextAction = actions.find((action) => action.id === nextActionId) || null;
    setSelectedActionId(nextActionId);
    setInput(buildInitialInput(nextAction));
    setExecutionMode(nextAction?.executionModes?.defaultMode || "local_cli");
    setFormError("");
    setResult(null);
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
    setResult(null);

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
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || "Failed to start the action.");
    }

    setResult(payload);
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
    <section className={`rounded border border-zinc-300 bg-white shadow-sm ${compact ? "p-3" : "p-4"}`}>
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
          {actions.length > 1 ? (
            <label className="block space-y-2">
              <span className="text-[12px] font-medium">Action</span>
              <select
                value={selectedActionId}
                onChange={(event) => handleActionChange(event.target.value)}
                className="w-full rounded border px-2 py-1.5 text-[12px]"
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
              <p className="text-[11px] uppercase tracking-wide text-gray-600">{selectedAction.workflowFamily}</p>
              <p className="mt-1 font-medium">{selectedAction.title}</p>
              <p className="mt-1 text-[12px] text-gray-700">{selectedAction.description}</p>
              <p className="mt-2 break-all font-mono text-[11px] text-gray-500">{selectedAction.cliCommandTemplate}</p>
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
            <div className="rounded border p-3 text-[12px] text-gray-700">
              This action does not require any input fields.
            </div>
          )}

          <label className="block space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] font-medium">Execution mode</span>
              <span className="text-[11px] text-gray-500">Allowed by registry</span>
            </div>
            <select
              value={executionMode}
              onChange={(event) => setExecutionMode(event.target.value)}
              className="w-full rounded border px-2 py-1.5 text-[12px]"
            >
              {availableExecutionModes.map((mode) => (
                <option key={`${selectedActionId}-${mode}`} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </label>

          {selectedAction?.guardrails?.length ? (
            <div className="rounded border border-amber-300 bg-amber-50 p-3">
              <p className="text-[12px] font-medium text-amber-950">Guardrails</p>
              <ul className="mt-2 space-y-1 text-[12px] text-amber-900">
                {selectedAction.guardrails.map((guardrail) => (
                  <li key={`${selectedAction.id}-${guardrail}`}>{guardrail}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {formError ? (
            <div className="rounded border border-red-300 bg-red-50 p-3 text-[12px] text-red-900">
              {formError}
            </div>
          ) : null}

          {result?.job?.id && !redirectToJob ? (
            <div className="rounded border border-green-300 bg-green-50 p-3 text-[12px] text-green-950">
              <p className="font-medium">Job started</p>
              <p className="mt-1">{result.job.summary || "The job has been queued."}</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Link href={`/admin/jobs/${result.job.id}`} className="text-[12px] underline">
                  Open job detail
                </Link>
                <Link href="/admin/jobs" className="text-[12px] underline">
                  View job list
                </Link>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isPending || isLoading || !selectedAction}
              className="rounded border bg-stone-900 px-3 py-1.5 text-[12px] text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Starting…" : buttonLabel}
            </button>
            <Link href="/admin/jobs" className="rounded border px-3 py-1.5 text-[12px]">
              View jobs
            </Link>
          </div>
        </form>
      )}

      {confirmationOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 px-4">
          <div className="w-full max-w-lg rounded border bg-white p-4 shadow-xl">
            <div className="space-y-2">
              <p className="text-[12px] text-gray-600">{selectedAction?.workflowFamily}</p>
              <h3 className="text-lg font-semibold">Confirm mutating action</h3>
              <p className="text-[12px] text-gray-700">
                This requests the canonical mutating path. Broker and CLI guardrails still apply, and this confirmation does not bypass pre-commit, dry-run, or explicit review requirements.
              </p>
            </div>

            <label className="mt-4 flex items-start gap-3 rounded border p-3 text-[12px]">
              <input
                type="checkbox"
                checked={confirmationChecked}
                onChange={(event) => setConfirmationChecked(event.target.checked)}
              />
              <span>I understand this requests the guarded mutating action again.</span>
            </label>

            <label className="mt-4 block space-y-2">
              <span className="text-[12px] font-medium">Type YES to continue</span>
              <input
                type="text"
                value={typedYes}
                onChange={(event) => setTypedYes(event.target.value)}
                className="w-full rounded border px-2 py-1.5 text-[12px]"
                placeholder="YES"
              />
            </label>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={resetConfirmation}
                className="rounded border px-3 py-1.5 text-[12px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={!confirmationChecked || normalizeString(typedYes) !== "YES" || isPending}
                className="rounded border border-red-300 bg-red-50 px-3 py-1.5 text-[12px] font-medium text-red-900 disabled:cursor-not-allowed disabled:opacity-60"
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
