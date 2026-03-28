"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const PROMISE_TYPES = [
  "Campaign Promise",
  "Official Promise",
  "Public Promise",
  "Executive Agenda",
  "Other",
];

const CAMPAIGN_OR_OFFICIAL_VALUES = ["Campaign", "Official"];

const PROMISE_STATUSES = [
  "Delivered",
  "In Progress",
  "Partial",
  "Failed",
  "Blocked",
];

const ACTION_TYPES = [
  "Executive Order",
  "Bill",
  "Policy",
  "Agency Action",
  "Court-Related Action",
  "Public Reversal",
  "Statement",
  "Other",
];

const OUTCOME_TYPES = [
  "Legislative Outcome",
  "Administrative Outcome",
  "Legal Outcome",
  "Economic Outcome",
  "Housing Outcome",
  "Voting Outcome",
  "Narrative Outcome",
  "Other",
];

const IMPACT_DIRECTIONS = ["Positive", "Negative", "Mixed", "Blocked"];
const EVIDENCE_STRENGTHS = ["Strong", "Moderate", "Limited"];
const SOURCE_TYPES = [
  "Government",
  "Academic",
  "News",
  "Archive",
  "Nonprofit",
  "Other",
];

function formatDateInput(value) {
  if (!value) {
    return "";
  }

  return String(value).slice(0, 10);
}

function buildEditableSource(source = {}) {
  return {
    id: source.id || null,
    source_title: source.source_title || "",
    source_url: source.source_url || "",
    source_type: source.source_type || "Government",
    publisher: source.publisher || "",
    published_date: formatDateInput(source.published_date),
    notes: source.notes || "",
  };
}

function createEmptySource() {
  return buildEditableSource({
    id: null,
    source_type: "Government",
  });
}

function buildOutcomeForm(outcome = null) {
  return {
    id: outcome?.id || null,
    outcome_summary: outcome?.outcome_summary || "",
    outcome_type: outcome?.outcome_type || "Other",
    measurable_impact: outcome?.measurable_impact || "",
    impact_direction: outcome?.impact_direction || "Mixed",
    black_community_impact_note: outcome?.black_community_impact_note || "",
    evidence_strength: outcome?.evidence_strength || "Moderate",
    status_override: outcome?.status_override || "",
    affected_groups: outcome?.affected_groups || "",
    outcome_date: formatDateInput(outcome?.outcome_date),
    outcome_timeframe: outcome?.outcome_timeframe || "",
    sources:
      outcome?.sources?.length > 0
        ? outcome.sources.map(buildEditableSource)
        : [createEmptySource()],
  };
}

function buildStateFromPromise(data) {
  return {
    promise: {
      id: data.promise.id,
      title: data.promise.title || "",
      promise_text: data.promise.promise_text || "",
      promise_date: formatDateInput(data.promise.promise_date),
      promise_type: data.promise.promise_type || "Official Promise",
      campaign_or_official:
        data.promise.campaign_or_official || "Official",
      topic: data.promise.topic || "",
      impacted_group: data.promise.impacted_group || "",
      status: data.promise.status || "In Progress",
      summary: data.promise.summary || "",
      notes: data.promise.notes || "",
    },
    actions: (data.actions || []).map((action) => ({
      id: action.id,
      action_type: action.action_type || "Other",
      action_date: formatDateInput(action.action_date),
      title: action.title || "",
      description: action.description || "",
      related_policy_id: action.related_policy_id || null,
      related_explainer_id: action.related_explainer_id || null,
      related_policy_title: action.related_policy_title || null,
      related_explainer_slug: action.related_explainer_slug || null,
      related_explainer_title: action.related_explainer_title || null,
      sources: (action.sources || []).map(buildEditableSource),
    })),
    outcomes: (data.outcomes || []).map(buildOutcomeForm),
    newOutcome: buildOutcomeForm(),
    availableSources: (data.available_sources || []).map(buildEditableSource),
    promiseSources: (data.promise_sources || []).map(buildEditableSource),
    scoringReadiness: data.scoring_readiness,
  };
}

function ScoringReadyPanel({ readiness }) {
  return (
    <section className="border rounded-2xl p-5 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-semibold">Scoring Ready</h2>
        <span className="rounded-full border px-3 py-1 text-xs">
          {readiness?.is_ready ? "Ready" : "Not ready"}
        </span>
      </div>

      <p className="text-sm text-gray-700 mt-3">{readiness?.summary}</p>

      <div className="mt-4 space-y-2">
        {(readiness?.checks || []).map((check) => (
          <p key={check.key} className="text-sm text-gray-700">
            {check.passed ? "Done" : "Needs work"}: {check.label}
          </p>
        ))}
      </div>

      {readiness?.outcome_issues?.length ? (
        <div className="mt-4 space-y-2">
          {readiness.outcome_issues.map((issue) => (
            <div key={issue.outcome_id} className="rounded-xl border p-3 text-sm">
              <p className="font-medium">{issue.title}</p>
              <p className="text-gray-600 mt-1">{issue.issues.join(" • ")}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function SourceEditor({
  sources,
  availableSources,
  onChange,
  onAdd,
  onRemove,
}) {
  function handleExistingSourceChange(index, selectedValue) {
    if (!selectedValue) {
      onChange(index, {
        ...createEmptySource(),
      });
      return;
    }

    const selectedSource = availableSources.find(
      (source) => String(source.id) === selectedValue
    );

    if (!selectedSource) {
      return;
    }

    onChange(index, buildEditableSource(selectedSource));
  }

  return (
    <div className="space-y-4">
      {sources.map((source, index) => {
        const isExistingSource = Boolean(source.id);

        return (
          <div key={`${source.id || "new"}-${index}`} className="rounded-xl border p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium text-sm">Source {index + 1}</p>
              {sources.length > 1 ? (
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="text-sm underline"
                >
                  Remove
                </button>
              ) : null}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Reuse linked source
              </label>
              <select
                value={source.id ? String(source.id) : ""}
                onChange={(event) =>
                  handleExistingSourceChange(index, event.target.value)
                }
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">Add a new source</option>
                {availableSources.map((availableSource) => (
                  <option key={availableSource.id} value={availableSource.id}>
                    {availableSource.source_title}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">
                  Source title
                </label>
                <input
                  type="text"
                  value={source.source_title}
                  onChange={(event) =>
                    onChange(index, {
                      ...source,
                      id: null,
                      source_title: event.target.value,
                    })
                  }
                  className="w-full border rounded-lg px-3 py-2"
                  disabled={isExistingSource}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">
                  Source URL
                </label>
                <input
                  type="url"
                  value={source.source_url}
                  onChange={(event) =>
                    onChange(index, {
                      ...source,
                      id: null,
                      source_url: event.target.value,
                    })
                  }
                  className="w-full border rounded-lg px-3 py-2"
                  disabled={isExistingSource}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Source type
                </label>
                <select
                  value={source.source_type}
                  onChange={(event) =>
                    onChange(index, {
                      ...source,
                      id: null,
                      source_type: event.target.value,
                    })
                  }
                  className="w-full border rounded-lg px-3 py-2"
                  disabled={isExistingSource}
                >
                  {SOURCE_TYPES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Published date
                </label>
                <input
                  type="date"
                  value={source.published_date}
                  onChange={(event) =>
                    onChange(index, {
                      ...source,
                      id: null,
                      published_date: event.target.value,
                    })
                  }
                  className="w-full border rounded-lg px-3 py-2"
                  disabled={isExistingSource}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Publisher
                </label>
                <input
                  type="text"
                  value={source.publisher}
                  onChange={(event) =>
                    onChange(index, {
                      ...source,
                      id: null,
                      publisher: event.target.value,
                    })
                  }
                  className="w-full border rounded-lg px-3 py-2"
                  disabled={isExistingSource}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <input
                  type="text"
                  value={source.notes}
                  onChange={(event) =>
                    onChange(index, {
                      ...source,
                      id: null,
                      notes: event.target.value,
                    })
                  }
                  className="w-full border rounded-lg px-3 py-2"
                  disabled={isExistingSource}
                />
              </div>
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={onAdd}
        className="border rounded-lg px-4 py-2 text-sm"
      >
        Add Source
      </button>
    </div>
  );
}

export default function AdminEditPromiseForm({ initialData }) {
  const [state, setState] = useState(() => buildStateFromPromise(initialData));
  const [savingPromise, setSavingPromise] = useState(false);
  const [message, setMessage] = useState("");
  const [outcomeMessages, setOutcomeMessages] = useState({});

  const existingOutcomeIds = useMemo(
    () => new Set(state.outcomes.map((outcome) => outcome.id)),
    [state.outcomes]
  );

  function applyPromiseResponse(data) {
    setState(buildStateFromPromise(data));
  }

  function updatePromiseField(field, value) {
    setState((prev) => ({
      ...prev,
      promise: {
        ...prev.promise,
        [field]: value,
      },
    }));
  }

  function updateAction(index, field, value) {
    setState((prev) => {
      const nextActions = [...prev.actions];
      nextActions[index] = {
        ...nextActions[index],
        [field]: value,
      };

      return {
        ...prev,
        actions: nextActions,
      };
    });
  }

  function updateOutcomeField(index, field, value) {
    setState((prev) => {
      const nextOutcomes = [...prev.outcomes];
      nextOutcomes[index] = {
        ...nextOutcomes[index],
        [field]: value,
      };

      return {
        ...prev,
        outcomes: nextOutcomes,
      };
    });
  }

  function updateOutcomeSource(outcomeIndex, sourceIndex, nextSource) {
    setState((prev) => {
      const nextOutcomes = [...prev.outcomes];
      const nextSources = [...nextOutcomes[outcomeIndex].sources];
      nextSources[sourceIndex] = nextSource;
      nextOutcomes[outcomeIndex] = {
        ...nextOutcomes[outcomeIndex],
        sources: nextSources,
      };

      return {
        ...prev,
        outcomes: nextOutcomes,
      };
    });
  }

  function addOutcomeSource(outcomeIndex) {
    setState((prev) => {
      const nextOutcomes = [...prev.outcomes];
      nextOutcomes[outcomeIndex] = {
        ...nextOutcomes[outcomeIndex],
        sources: [...nextOutcomes[outcomeIndex].sources, createEmptySource()],
      };

      return {
        ...prev,
        outcomes: nextOutcomes,
      };
    });
  }

  function removeOutcomeSource(outcomeIndex, sourceIndex) {
    setState((prev) => {
      const nextOutcomes = [...prev.outcomes];
      nextOutcomes[outcomeIndex] = {
        ...nextOutcomes[outcomeIndex],
        sources: nextOutcomes[outcomeIndex].sources.filter(
          (_, index) => index !== sourceIndex
        ),
      };

      if (nextOutcomes[outcomeIndex].sources.length === 0) {
        nextOutcomes[outcomeIndex].sources = [createEmptySource()];
      }

      return {
        ...prev,
        outcomes: nextOutcomes,
      };
    });
  }

  function updateNewOutcomeField(field, value) {
    setState((prev) => ({
      ...prev,
      newOutcome: {
        ...prev.newOutcome,
        [field]: value,
      },
    }));
  }

  function updateNewOutcomeSource(index, nextSource) {
    setState((prev) => {
      const nextSources = [...prev.newOutcome.sources];
      nextSources[index] = nextSource;

      return {
        ...prev,
        newOutcome: {
          ...prev.newOutcome,
          sources: nextSources,
        },
      };
    });
  }

  function addNewOutcomeSource() {
    setState((prev) => ({
      ...prev,
      newOutcome: {
        ...prev.newOutcome,
        sources: [...prev.newOutcome.sources, createEmptySource()],
      },
    }));
  }

  function removeNewOutcomeSource(index) {
    setState((prev) => {
      const nextSources = prev.newOutcome.sources.filter(
        (_, sourceIndex) => sourceIndex !== index
      );

      return {
        ...prev,
        newOutcome: {
          ...prev.newOutcome,
          sources: nextSources.length > 0 ? nextSources : [createEmptySource()],
        },
      };
    });
  }

  async function handlePromiseSubmit(event) {
    event.preventDefault();
    setSavingPromise(true);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/promises/${state.promise.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...state.promise,
          actions: state.actions.map((action) => ({
            id: action.id,
            action_type: action.action_type,
            action_date: action.action_date || null,
            title: action.title,
            description: action.description || null,
            related_policy_id: action.related_policy_id,
            related_explainer_id: action.related_explainer_id,
          })),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          Array.isArray(data.errors) ? data.errors.join(" ") : data.error
        );
      }

      applyPromiseResponse(data.promise);
      setMessage("Promise record updated.");
    } catch (error) {
      setMessage(error.message || "Failed to update promise record.");
    } finally {
      setSavingPromise(false);
    }
  }

  async function saveOutcome(outcome, index = null) {
    const isExisting = outcome.id && existingOutcomeIds.has(outcome.id);
    const url = isExisting
      ? `/api/admin/promises/${state.promise.id}/outcomes/${outcome.id}`
      : `/api/admin/promises/${state.promise.id}/outcomes`;
    const method = isExisting ? "PUT" : "POST";

    setOutcomeMessages((prev) => ({
      ...prev,
      [outcome.id || "new"]: "",
    }));

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(outcome),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          Array.isArray(data.errors) ? data.errors.join(" ") : data.error
        );
      }

      applyPromiseResponse(data.promise);
      setOutcomeMessages((prev) => ({
        ...prev,
        [outcome.id || "new"]: isExisting
          ? "Outcome updated."
          : "Outcome added.",
      }));

      if (!isExisting && index === null) {
        setState((prev) => ({
          ...prev,
          newOutcome: buildOutcomeForm(),
        }));
      }
    } catch (error) {
      setOutcomeMessages((prev) => ({
        ...prev,
        [outcome.id || "new"]: error.message || "Failed to save outcome.",
      }));
    }
  }

  return (
    <div className="space-y-6">
      <ScoringReadyPanel readiness={state.scoringReadiness} />

      <form onSubmit={handlePromiseSubmit} className="border rounded-2xl p-5 bg-white shadow-sm space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-semibold">Promise Record</h2>
          <button
            type="submit"
            disabled={savingPromise}
            className="rounded-full border bg-black text-white px-5 py-2 text-sm font-medium disabled:opacity-60"
          >
            {savingPromise ? "Saving..." : "Save Promise"}
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={state.promise.title}
              onChange={(event) => updatePromiseField("title", event.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">
              Promise description
            </label>
            <textarea
              value={state.promise.promise_text}
              onChange={(event) =>
                updatePromiseField("promise_text", event.target.value)
              }
              className="w-full border rounded-lg px-3 py-2 min-h-28"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Promise type</label>
            <select
              value={state.promise.promise_type}
              onChange={(event) =>
                updatePromiseField("promise_type", event.target.value)
              }
              className="w-full border rounded-lg px-3 py-2"
            >
              {PROMISE_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Campaign or official
            </label>
            <select
              value={state.promise.campaign_or_official}
              onChange={(event) =>
                updatePromiseField("campaign_or_official", event.target.value)
              }
              className="w-full border rounded-lg px-3 py-2"
            >
              {CAMPAIGN_OR_OFFICIAL_VALUES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Topic</label>
            <input
              type="text"
              value={state.promise.topic}
              onChange={(event) => updatePromiseField("topic", event.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Promise date
            </label>
            <input
              type="date"
              value={state.promise.promise_date}
              onChange={(event) =>
                updatePromiseField("promise_date", event.target.value)
              }
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Affected group(s)
            </label>
            <input
              type="text"
              value={state.promise.impacted_group}
              onChange={(event) =>
                updatePromiseField("impacted_group", event.target.value)
              }
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={state.promise.status}
              onChange={(event) => updatePromiseField("status", event.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              {PROMISE_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Summary</label>
            <textarea
              value={state.promise.summary}
              onChange={(event) =>
                updatePromiseField("summary", event.target.value)
              }
              className="w-full border rounded-lg px-3 py-2 min-h-24"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={state.promise.notes}
              onChange={(event) => updatePromiseField("notes", event.target.value)}
              className="w-full border rounded-lg px-3 py-2 min-h-24"
            />
          </div>
        </div>

        {message ? <p className="text-sm text-gray-700">{message}</p> : null}
      </form>

      <section className="border rounded-2xl p-5 bg-white shadow-sm space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-semibold">Actions</h2>
          <span className="rounded-full border px-3 py-1 text-xs">
            {state.actions.length} action{state.actions.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="space-y-5">
          {state.actions.map((action, index) => (
            <div key={action.id} className="rounded-xl border p-4 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="font-medium">Action #{action.id}</h3>
                <span className="text-xs text-gray-500">
                  {action.sources.length} linked source
                  {action.sources.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Action type
                  </label>
                  <select
                    value={action.action_type}
                    onChange={(event) =>
                      updateAction(index, "action_type", event.target.value)
                    }
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    {ACTION_TYPES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Action date
                  </label>
                  <input
                    type="date"
                    value={action.action_date}
                    onChange={(event) =>
                      updateAction(index, "action_date", event.target.value)
                    }
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">
                    Action title
                  </label>
                  <input
                    type="text"
                    value={action.title}
                    onChange={(event) =>
                      updateAction(index, "title", event.target.value)
                    }
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">
                    Action description
                  </label>
                  <textarea
                    value={action.description}
                    onChange={(event) =>
                      updateAction(index, "description", event.target.value)
                    }
                    className="w-full border rounded-lg px-3 py-2 min-h-24"
                  />
                </div>
              </div>

              {(action.related_policy_title || action.related_explainer_title) ? (
                <div className="text-sm text-gray-600">
                  {action.related_policy_title ? (
                    <p>Related policy: {action.related_policy_title}</p>
                  ) : null}
                  {action.related_explainer_title ? (
                    <p>
                      Related explainer:{" "}
                      <Link
                        href={`/explainers/${action.related_explainer_slug}`}
                        className="underline"
                      >
                        {action.related_explainer_title}
                      </Link>
                    </p>
                  ) : null}
                </div>
              ) : null}

              {action.sources.length ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Linked action sources</p>
                  {action.sources.map((source) => (
                    <div key={source.id} className="rounded-lg border p-3 text-sm">
                      <p className="font-medium">{source.source_title}</p>
                      <p className="text-gray-600 break-all">{source.source_url}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-600">
                  No action-level sources linked yet.
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="border rounded-2xl p-5 bg-white shadow-sm space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-semibold">Evidence Pool</h2>
          <span className="rounded-full border px-3 py-1 text-xs">
            {state.availableSources.length} reusable source
            {state.availableSources.length === 1 ? "" : "s"}
          </span>
        </div>

        {state.promiseSources.length ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Promise-level sources</p>
            {state.promiseSources.map((source) => (
              <div key={source.id} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{source.source_title}</p>
                <p className="text-gray-600 break-all">{source.source_url}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            No promise-level sources are linked yet. Outcome editors can reuse
            action and existing outcome sources as they are added.
          </p>
        )}
      </section>

      <section className="border rounded-2xl p-5 bg-white shadow-sm space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-semibold">Outcomes</h2>
          <span className="rounded-full border px-3 py-1 text-xs">
            {state.outcomes.length} saved outcome
            {state.outcomes.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="space-y-6">
          {state.outcomes.map((outcome, index) => (
            <div key={outcome.id} className="rounded-xl border p-4 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="font-medium">Outcome #{outcome.id}</h3>
                <button
                  type="button"
                  onClick={() => saveOutcome(outcome, index)}
                  className="rounded-full border px-4 py-2 text-sm font-medium"
                >
                  Save Outcome
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">
                    Outcome description
                  </label>
                  <textarea
                    value={outcome.outcome_summary}
                    onChange={(event) =>
                      updateOutcomeField(index, "outcome_summary", event.target.value)
                    }
                    className="w-full border rounded-lg px-3 py-2 min-h-24"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Outcome type
                  </label>
                  <select
                    value={outcome.outcome_type}
                    onChange={(event) =>
                      updateOutcomeField(index, "outcome_type", event.target.value)
                    }
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    {OUTCOME_TYPES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Impact direction
                  </label>
                  <select
                    value={outcome.impact_direction}
                    onChange={(event) =>
                      updateOutcomeField(index, "impact_direction", event.target.value)
                    }
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    {IMPACT_DIRECTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Evidence strength
                  </label>
                  <select
                    value={outcome.evidence_strength}
                    onChange={(event) =>
                      updateOutcomeField(index, "evidence_strength", event.target.value)
                    }
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    {EVIDENCE_STRENGTHS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Status override
                  </label>
                  <select
                    value={outcome.status_override}
                    onChange={(event) =>
                      updateOutcomeField(index, "status_override", event.target.value)
                    }
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">No override</option>
                    {PROMISE_STATUSES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Outcome date
                  </label>
                  <input
                    type="date"
                    value={outcome.outcome_date}
                    onChange={(event) =>
                      updateOutcomeField(index, "outcome_date", event.target.value)
                    }
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Outcome timeframe
                  </label>
                  <input
                    type="text"
                    value={outcome.outcome_timeframe}
                    onChange={(event) =>
                      updateOutcomeField(index, "outcome_timeframe", event.target.value)
                    }
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="e.g. First 100 days"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">
                    Affected group(s)
                  </label>
                  <input
                    type="text"
                    value={outcome.affected_groups}
                    onChange={(event) =>
                      updateOutcomeField(index, "affected_groups", event.target.value)
                    }
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">
                    Measurable impact / evidence summary
                  </label>
                  <textarea
                    value={outcome.measurable_impact}
                    onChange={(event) =>
                      updateOutcomeField(index, "measurable_impact", event.target.value)
                    }
                    className="w-full border rounded-lg px-3 py-2 min-h-24"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">
                    Black community impact note
                  </label>
                  <textarea
                    value={outcome.black_community_impact_note}
                    onChange={(event) =>
                      updateOutcomeField(
                        index,
                        "black_community_impact_note",
                        event.target.value
                      )
                    }
                    className="w-full border rounded-lg px-3 py-2 min-h-24"
                  />
                </div>
              </div>

              <SourceEditor
                sources={outcome.sources}
                availableSources={state.availableSources}
                onChange={(sourceIndex, nextSource) =>
                  updateOutcomeSource(index, sourceIndex, nextSource)
                }
                onAdd={() => addOutcomeSource(index)}
                onRemove={(sourceIndex) => removeOutcomeSource(index, sourceIndex)}
              />

              {outcomeMessages[outcome.id] ? (
                <p className="text-sm text-gray-700">{outcomeMessages[outcome.id]}</p>
              ) : null}
            </div>
          ))}
        </div>

        <div className="rounded-xl border p-4 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="font-medium">Add Outcome</h3>
            <button
              type="button"
              onClick={() => saveOutcome(state.newOutcome)}
              className="rounded-full border bg-black text-white px-4 py-2 text-sm font-medium"
            >
              Create Outcome
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Outcome description
              </label>
              <textarea
                value={state.newOutcome.outcome_summary}
                onChange={(event) =>
                  updateNewOutcomeField("outcome_summary", event.target.value)
                }
                className="w-full border rounded-lg px-3 py-2 min-h-24"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Outcome type
              </label>
              <select
                value={state.newOutcome.outcome_type}
                onChange={(event) =>
                  updateNewOutcomeField("outcome_type", event.target.value)
                }
                className="w-full border rounded-lg px-3 py-2"
              >
                {OUTCOME_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Impact direction
              </label>
              <select
                value={state.newOutcome.impact_direction}
                onChange={(event) =>
                  updateNewOutcomeField("impact_direction", event.target.value)
                }
                className="w-full border rounded-lg px-3 py-2"
              >
                {IMPACT_DIRECTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Evidence strength
              </label>
              <select
                value={state.newOutcome.evidence_strength}
                onChange={(event) =>
                  updateNewOutcomeField("evidence_strength", event.target.value)
                }
                className="w-full border rounded-lg px-3 py-2"
              >
                {EVIDENCE_STRENGTHS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Status override
              </label>
              <select
                value={state.newOutcome.status_override}
                onChange={(event) =>
                  updateNewOutcomeField("status_override", event.target.value)
                }
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">No override</option>
                {PROMISE_STATUSES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Outcome date
              </label>
              <input
                type="date"
                value={state.newOutcome.outcome_date}
                onChange={(event) =>
                  updateNewOutcomeField("outcome_date", event.target.value)
                }
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Outcome timeframe
              </label>
              <input
                type="text"
                value={state.newOutcome.outcome_timeframe}
                onChange={(event) =>
                  updateNewOutcomeField("outcome_timeframe", event.target.value)
                }
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Affected group(s)
              </label>
              <input
                type="text"
                value={state.newOutcome.affected_groups}
                onChange={(event) =>
                  updateNewOutcomeField("affected_groups", event.target.value)
                }
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Measurable impact / evidence summary
              </label>
              <textarea
                value={state.newOutcome.measurable_impact}
                onChange={(event) =>
                  updateNewOutcomeField("measurable_impact", event.target.value)
                }
                className="w-full border rounded-lg px-3 py-2 min-h-24"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Black community impact note
              </label>
              <textarea
                value={state.newOutcome.black_community_impact_note}
                onChange={(event) =>
                  updateNewOutcomeField(
                    "black_community_impact_note",
                    event.target.value
                  )
                }
                className="w-full border rounded-lg px-3 py-2 min-h-24"
              />
            </div>
          </div>

          <SourceEditor
            sources={state.newOutcome.sources}
            availableSources={state.availableSources}
            onChange={updateNewOutcomeSource}
            onAdd={addNewOutcomeSource}
            onRemove={removeNewOutcomeSource}
          />

          {outcomeMessages.new ? (
            <p className="text-sm text-gray-700">{outcomeMessages.new}</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
