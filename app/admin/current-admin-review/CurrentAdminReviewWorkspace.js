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

async function readJsonResponse(response) {
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";
  const looksLikeJson =
    contentType.includes("application/json") ||
    text.trim().startsWith("{") ||
    text.trim().startsWith("[");

  if (!looksLikeJson) {
    console.error("Current-admin action returned a non-JSON response.", {
      status: response.status,
      contentType,
      bodyPreview: text.slice(0, 800),
    });
    throw new Error(
      response.ok
        ? "The server returned a non-JSON response. Check the server logs."
        : `The server returned an unexpected ${response.status} response instead of JSON.`
    );
  }

  try {
    return text ? JSON.parse(text) : {};
  } catch (error) {
    console.error("Failed to parse current-admin action response as JSON.", {
      status: response.status,
      contentType,
      bodyPreview: text.slice(0, 800),
    });
    throw new Error("The server returned malformed JSON. Check the server logs.");
  }
}

export default function CurrentAdminReviewWorkspace({ workspace }) {
  const router = useRouter();
  const [items, setItems] = useState(cloneItems(workspace.review_items || []));
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const batch = workspace.batch;
  const actionPermissions = workspace.action_permissions || {};
  const finalizePermission = actionPermissions.finalize || { allowed: false, reasons: [] };
  const artifactStatus = workspace.artifact_status || {};
  const importReadiness = workspace.import_readiness || {};

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
        const payload = await readJsonResponse(response);
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
      "Decisions saved but not yet applied to the manual-review queue. Finalize to refresh the decision log and queue approval state."
    );
  }

  function finalize() {
    runAction(
      "/api/admin/current-admin/finalize",
      {
        reviewPath: batch?.paths?.review,
        decisionItems: items,
      },
      "Decisions finalized. The decision log was refreshed and the manual-review queue was synchronized for pre-commit readiness."
    );
  }

  if (!batch) {
    return (
      <section className="rounded border border-zinc-300 bg-white p-4 shadow-sm">
        <p>No current-admin review artifact is available yet.</p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-3 lg:grid-cols-5">
        <div className="rounded border border-zinc-300 bg-white p-3 shadow-sm">
          <p className="text-[11px] text-gray-600">Batch</p>
          <p className="mt-1 text-base font-semibold">{batch.batch_name}</p>
          <p className="mt-1 text-[11px] text-gray-600">Stage: {batch.stage}</p>
        </div>
        <div className="rounded border border-zinc-300 bg-white p-3 shadow-sm">
          <p className="text-[11px] text-gray-600">Model / mode</p>
          <p className="mt-1 text-base font-semibold">
            {batch.model || "unknown"} / {batch.review_mode || "standard"}
          </p>
        </div>
        <div className="rounded border border-zinc-300 bg-white p-3 shadow-sm">
          <p className="text-[11px] text-gray-600">Review items</p>
          <p className="mt-1 text-base font-semibold">{workspace.counts.total_items}</p>
          <p className="mt-1 text-[11px] text-gray-600">
            Approval-style decisions: {workspace.counts.approval_style_decisions} • Pending review:{" "}
            {workspace.counts.pending_review} • Held back: {workspace.counts.held_for_followup}
          </p>
        </div>
        <div className="rounded border border-zinc-300 bg-white p-3 shadow-sm">
          <p className="text-[11px] text-gray-600">Queue import readiness</p>
          <p className="mt-1 text-base font-semibold">
            {importReadiness.readiness_label || "Review In Progress"}
          </p>
          <p className="mt-1 text-[11px] text-gray-600">
            Queue approved: {importReadiness.queue_approved_for_import_count || 0} • Held in queue:{" "}
            {importReadiness.queue_pending_manual_review_count || 0} • Queue pending:{" "}
            {importReadiness.queue_pending_count || 0}
          </p>
        </div>
        <div className="rounded border border-zinc-300 bg-white p-3 shadow-sm">
          <p className="text-[11px] text-gray-600">Next recommended action</p>
          <p className="mt-1 font-semibold">{workspace.next_recommended_action.next_step_label}</p>
        </div>
      </section>

      <section className="rounded border border-zinc-300 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] text-gray-600">Review artifact</p>
            <p className="break-all font-mono text-[11px]">{batch.paths.review}</p>
            <p className="mt-2 text-[11px] text-gray-600">Decision file</p>
            <p className="break-all font-mono text-[11px]">{batch.paths.decision_template}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={saveDraft}
              disabled={isPending}
              className="rounded border border-[#CBD5E1] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1F2937] disabled:cursor-not-allowed disabled:bg-[#F3F4F6] disabled:text-[#6B7280]"
            >
              Save Decisions
            </button>
            <button
              type="button"
              onClick={finalize}
              disabled={isPending || !finalizePermission.allowed}
              className="rounded border border-[#1D4ED8] bg-[#1D4ED8] px-3 py-1.5 text-[12px] font-medium text-white disabled:cursor-not-allowed disabled:border-[#CBD5E1] disabled:bg-[#CBD5E1] disabled:text-[#334155]"
            >
              Finalize
            </button>
          </div>
        </div>
        <p className="text-[12px] text-gray-700">
          Saving writes the decision file only. Finalize runs the existing Python
          finalize step, refreshes the append-only decision log, and synchronizes
          manual-review queue approval state from the operator decisions.
        </p>
        <p className="text-[12px] text-gray-700">
          `approve_as_is` and `approve_with_changes` are approval-style review decisions. Items
          only become import candidates when the canonical manual-review queue marks them approved
          for import.
        </p>
        {!finalizePermission.allowed ? (
          <div className="rounded border border-amber-300 bg-amber-50 p-3 text-[12px] text-amber-950">
            <p className="font-semibold">Finalize is blocked</p>
            <div className="mt-2 space-y-1">
              {finalizePermission.reasons.map((reason) => (
                <p key={reason}>{reason}</p>
              ))}
            </div>
          </div>
        ) : null}
        {importReadiness.readiness_explanation ? (
          <div
            className={`rounded border p-3 text-[12px] ${
              importReadiness.readiness_status === "blocked"
                ? "border-amber-300 bg-amber-50 text-amber-950"
                : "border-zinc-300 bg-gray-50 text-gray-800"
            }`}
          >
            <p className="font-semibold">Import readiness</p>
            <p className="mt-2">{importReadiness.readiness_explanation}</p>
          </div>
        ) : null}
        {message ? <p className="text-[12px] text-gray-700">{message}</p> : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded border border-zinc-300 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold">Workflow blockers</h2>
          <p className="mt-1 text-[12px] text-gray-600">
            These are the current reasons the canonical pipeline cannot advance automatically.
          </p>
          <div className="mt-3 space-y-2 text-[12px]">
            {(workspace.blockers || []).length || importReadiness.readiness_status === "blocked" ? (
              <>
                {importReadiness.readiness_status === "blocked" ? (
                  <div className="rounded border p-3 bg-gray-50">
                    {importReadiness.readiness_explanation}
                  </div>
                ) : null}
                {(workspace.blockers || []).map((blocker) => (
                  <div key={blocker} className="rounded border p-3 bg-gray-50">
                    {blocker}
                  </div>
                ))}
              </>
            ) : (
              <p className="text-gray-600">No active blockers are recorded for the current batch.</p>
            )}
          </div>
        </div>

        <div className="rounded border border-zinc-300 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold">Artifact state</h2>
          <p className="mt-1 text-[12px] text-gray-600">
            The admin workflow follows these canonical files under `python/reports/current_admin/`.
          </p>
          <div className="mt-3 space-y-2 text-[12px]">
            {Object.entries(artifactStatus).map(([key, artifact]) => (
              <div key={key} className="rounded border p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold">{artifact.label}</p>
                  <span className="rounded border px-2 py-0.5 text-[11px] uppercase tracking-wide">
                    {artifact.exists ? "present" : "missing"}
                  </span>
                </div>
                <p className="mt-1 break-all font-mono text-[11px] text-gray-700">{artifact.path || "Unavailable"}</p>
                {artifact.generated_at ? (
                  <p className="mt-1 text-[11px] text-gray-600">Updated: {artifact.generated_at}</p>
                ) : null}
                {artifact.summary ? (
                  <p className="mt-1 text-[11px] text-gray-600">Summary: {artifact.summary}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded border border-zinc-300 bg-white p-4 shadow-sm">
        <div className="mb-3">
          <h2 className="text-base font-semibold">Review items</h2>
          <p className="mt-1 text-[12px] text-gray-600">
            Dense operator review table. Use quick row actions for common decisions and expand rows for notes and full context.
          </p>
        </div>
        <div className="overflow-x-auto rounded border border-zinc-200">
          <table className="min-w-full text-[12px]">
            <thead className="bg-zinc-100 text-left text-[11px] uppercase tracking-wide text-zinc-600">
              <tr>
                <th className="border-b border-zinc-200 px-3 py-2">Item</th>
                <th className="border-b border-zinc-200 px-3 py-2">Priority / AI</th>
                <th className="border-b border-zinc-200 px-3 py-2">Decision</th>
                <th className="border-b border-zinc-200 px-3 py-2">Inspect</th>
              </tr>
            </thead>
            <tbody>
              {(items || []).map((item) => (
                <tr key={item.slug} className="align-top odd:bg-white even:bg-zinc-50/50">
                  <td className="border-b border-zinc-200 px-3 py-2">
                    <div className="font-mono text-[11px] text-zinc-500">{item.slug}</div>
                    <div className="font-medium">{item.title}</div>
                    <div className="mt-1 text-[11px] text-zinc-700">{item.attention_summary}</div>
                  </td>
                  <td className="border-b border-zinc-200 px-3 py-2 text-[11px] text-zinc-600">
                    <div>{item.review_priority} ({item.review_priority_score})</div>
                    <div className="mt-1">{item.suggested_batch}</div>
                    <div className="mt-1">AI: {item.ai_record_action_suggestion || "Unavailable"}</div>
                    {item.operator_attention_needed ? (
                      <div className="mt-1 text-red-900">attention needed</div>
                    ) : null}
                  </td>
                  <td className="border-b border-zinc-200 px-3 py-2">
                    <select
                      value={item.operator_action}
                      onChange={(event) => updateItem(item.slug, "operator_action", event.target.value)}
                      className="w-full min-w-[11rem] rounded border px-2 py-1 text-[12px]"
                    >
                      {DECISION_OPTIONS.map((option) => (
                        <option key={option.value || "blank"} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border-b border-zinc-200 px-3 py-2">
                    <details className="rounded border bg-white p-2">
                      <summary className="cursor-pointer text-[12px] font-medium">Inspect</summary>
                      <div className="mt-2 space-y-2 text-[11px] text-zinc-700">
                        <div>
                          <p className="font-medium">Suggested checks</p>
                          {(item.suggested_checks || []).length ? (
                            <ul className="mt-1 list-disc pl-4">
                              {item.suggested_checks.map((entry) => (
                                <li key={entry}>{entry}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-zinc-500">No extra checks were attached.</p>
                          )}
                        </div>
                        <label className="block">
                          <span className="block font-medium">Operator notes</span>
                          <textarea
                            value={item.operator_notes}
                            onChange={(event) => updateItem(item.slug, "operator_notes", event.target.value)}
                            className="mt-1 min-h-20 w-full rounded border px-2 py-1.5 text-[12px]"
                          />
                        </label>
                        <label className="block">
                          <span className="block font-medium">Decision summary</span>
                          <textarea
                            value={item.final_decision_summary}
                            onChange={(event) => updateItem(item.slug, "final_decision_summary", event.target.value)}
                            className="mt-1 min-h-16 w-full rounded border px-2 py-1.5 text-[12px]"
                          />
                        </label>
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
