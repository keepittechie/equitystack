"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const DECISION_OPTIONS = [
  { value: "", label: "Choose action" },
  { value: "approve_as_is", label: "approve_as_is" },
  { value: "approve_with_changes", label: "approve_with_changes" },
  { value: "manual_review_required", label: "manual_review_required" },
  { value: "needs_more_sources", label: "needs_more_sources" },
  { value: "defer", label: "defer" },
  { value: "reject", label: "reject" },
  { value: "escalate", label: "escalate" },
];

function cloneItems(items) {
  return items.map((item) => ({ ...item, suggested_checks: [...(item.suggested_checks || [])] }));
}

export default function CurrentAdminReviewWorkspace({ workspace }) {
  const router = useRouter();
  const [items, setItems] = useState(cloneItems(workspace.review_items || []));
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const batch = workspace.batch;

  function updateItem(slug, field, value) {
    setItems((current) =>
      current.map((item) =>
        item.slug === slug
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  }

  async function runAction(url, body, successMessage) {
    setMessage("");
    startTransition(async () => {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Action failed.");
        }
        setMessage(successMessage);
        router.refresh();
      } catch (error) {
        setMessage(error.message);
      }
    });
  }

  function saveDraft() {
    runAction(
      "/api/admin/current-admin/decisions",
      {
        reviewPath: batch?.paths?.review,
        decisionItems: items,
      },
      "Decision file saved. Continue editing or finalize when ready."
    );
  }

  function finalize() {
    runAction(
      "/api/admin/current-admin/finalize",
      {
        reviewPath: batch?.paths?.review,
        decisionItems: items,
      },
      "Decisions finalized. The decision log was refreshed through the canonical Python workflow."
    );
  }

  if (!batch) {
    return (
      <section className="border rounded-2xl p-6 bg-white shadow-sm">
        <p>No current-admin review artifact is available yet.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-4">
        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <p className="text-sm text-gray-600">Batch</p>
          <p className="text-xl font-semibold mt-2">{batch.batch_name}</p>
          <p className="text-sm text-gray-600 mt-2">Stage: {batch.stage}</p>
        </div>
        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <p className="text-sm text-gray-600">Model / mode</p>
          <p className="text-xl font-semibold mt-2">
            {batch.model || "unknown"} / {batch.review_mode || "standard"}
          </p>
        </div>
        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <p className="text-sm text-gray-600">Items</p>
          <p className="text-xl font-semibold mt-2">{workspace.counts.total_items}</p>
          <p className="text-sm text-gray-600 mt-2">
            Approved: {workspace.counts.approved} • Pending: {workspace.counts.pending} •
            Blocked: {workspace.counts.blocked}
          </p>
        </div>
        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <p className="text-sm text-gray-600">Next recommended action</p>
          <p className="font-semibold mt-2">{workspace.next_recommended_action.next_step_label}</p>
        </div>
      </section>

      <section className="border rounded-2xl p-5 bg-white shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-gray-600">Review artifact</p>
            <p className="text-sm break-all">{batch.paths.review}</p>
            <p className="text-sm text-gray-600 mt-2">Decision file</p>
            <p className="text-sm break-all">{batch.paths.decision_template}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={saveDraft}
              disabled={isPending}
              className="rounded-lg border px-4 py-2 bg-white"
            >
              Save Decisions
            </button>
            <button
              type="button"
              onClick={finalize}
              disabled={isPending}
              className="rounded-lg border px-4 py-2 bg-black text-white"
            >
              Finalize
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-700">
          Saving writes the decision file only. Finalize runs the existing Python
          finalize step and refreshes the append-only decision log.
        </p>
        {message ? <p className="text-sm text-gray-700">{message}</p> : null}
      </section>

      <section className="space-y-4">
        {(items || []).map((item) => (
          <article key={item.slug} className="border rounded-2xl p-5 bg-white shadow-sm space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-gray-600">{item.slug}</p>
                <h2 className="text-xl font-semibold mt-1">{item.title}</h2>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border px-3 py-1">
                  {item.review_priority} ({item.review_priority_score})
                </span>
                <span className="rounded-full border px-3 py-1">{item.suggested_batch}</span>
                {item.operator_attention_needed ? (
                  <span className="rounded-full border px-3 py-1">attention needed</span>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-3">
                <div className="rounded-xl border p-4 bg-gray-50">
                  <p className="text-sm text-gray-600">Attention summary</p>
                  <p className="mt-1 text-sm">{item.attention_summary}</p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-sm text-gray-600">Suggested checks</p>
                  {(item.suggested_checks || []).length ? (
                    <ul className="mt-2 list-disc pl-5 text-sm space-y-1">
                      {item.suggested_checks.map((entry) => (
                        <li key={entry}>{entry}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-gray-600">No extra checks were attached.</p>
                  )}
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-sm text-gray-600">AI suggestion</p>
                  <p className="mt-1 text-sm">{item.ai_record_action_suggestion || "Unavailable"}</p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="block text-sm font-medium mb-1">Operator action</span>
                  <select
                    value={item.operator_action}
                    onChange={(event) =>
                      updateItem(item.slug, "operator_action", event.target.value)
                    }
                    className="w-full rounded-lg border px-3 py-2"
                  >
                    {DECISION_OPTIONS.map((option) => (
                      <option key={option.value || "blank"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="block text-sm font-medium mb-1">Operator notes</span>
                  <textarea
                    value={item.operator_notes}
                    onChange={(event) =>
                      updateItem(item.slug, "operator_notes", event.target.value)
                    }
                    className="min-h-24 w-full rounded-lg border px-3 py-2"
                  />
                </label>

                <label className="block">
                  <span className="block text-sm font-medium mb-1">Decision summary</span>
                  <textarea
                    value={item.final_decision_summary}
                    onChange={(event) =>
                      updateItem(item.slug, "final_decision_summary", event.target.value)
                    }
                    className="min-h-20 w-full rounded-lg border px-3 py-2"
                  />
                </label>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
