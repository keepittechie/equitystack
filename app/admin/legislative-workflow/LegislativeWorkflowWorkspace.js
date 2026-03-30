"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const DECISION_OPTIONS = [
  { value: "pending", label: "Keep pending" },
  { value: "approve", label: "Approve" },
  { value: "dismiss", label: "Dismiss" },
];

function cloneActions(actions) {
  return (actions || []).map((action) => ({
    ...action,
    decision:
      action.status === "dismissed"
        ? "dismiss"
        : action.approved
          ? "approve"
          : "pending",
    approval_note: action.approval_note || "",
  }));
}

function SummaryCard({ title, report, modeLabel }) {
  return (
    <div className="border rounded-2xl p-5 bg-white shadow-sm">
      <p className="text-sm text-gray-600">{title}</p>
      {report ? (
        <div className="mt-3 space-y-2 text-sm">
          <p className="font-semibold">{modeLabel || report.mode}</p>
          {"applied_count" in report ? <p>Applied: {report.applied_count}</p> : null}
          {"skipped_count" in report ? <p>Skipped: {report.skipped_count}</p> : null}
          {"rows_selected" in report ? <p>Rows selected: {report.rows_selected}</p> : null}
          {"inserted_new_tracked_bills" in report ? (
            <p>Inserted new tracked bills: {report.inserted_new_tracked_bills}</p>
          ) : null}
          <p>Errors: {report.error_count || 0}</p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-gray-600">No report available yet.</p>
      )}
    </div>
  );
}

export default function LegislativeWorkflowWorkspace({ workspace }) {
  const router = useRouter();
  const [actions, setActions] = useState(cloneActions(workspace.operator_actions || []));
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const permissions = workspace.action_permissions || {};
  const reviewBundlePath = workspace.review_bundle?.path;

  function updateAction(actionId, field, value) {
    setActions((current) =>
      current.map((action) =>
        action.action_id === actionId
          ? {
              ...action,
              [field]: value,
            }
          : action
      )
    );
  }

  function runAction(url, body, successMessage) {
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

  function saveApprovals() {
    runAction(
      "/api/admin/legislative/approvals",
      {
        bundlePath: reviewBundlePath,
        actionUpdates: actions.map((action) => ({
          action_id: action.action_id,
          decision: action.decision,
          approval_note: action.approval_note,
        })),
      },
      "Legislative approval decisions saved to the canonical review bundle."
    );
  }

  if (!workspace.review_bundle) {
    return (
      <section className="border rounded-2xl p-6 bg-white shadow-sm">
        <p>No legislative review bundle is available yet.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-4">
        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <p className="text-sm text-gray-600">Workflow state</p>
          <p className="text-xl font-semibold mt-2">{workspace.workflow_status}</p>
        </div>
        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <p className="text-sm text-gray-600">Requested model</p>
          <p className="text-xl font-semibold mt-2">
            {workspace.requested_model || "Unavailable"}
          </p>
        </div>
        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <p className="text-sm text-gray-600">Actionable approvals</p>
          <p className="text-xl font-semibold mt-2">
            {workspace.counts.approved_pending_actions} approved / {workspace.counts.pending_unreviewed_actions} pending
          </p>
        </div>
        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <p className="text-sm text-gray-600">Seed imports</p>
          <p className="text-xl font-semibold mt-2">{workspace.counts.approved_seed_rows}</p>
        </div>
      </section>

      <section className="border rounded-2xl p-5 bg-white shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-gray-600">Canonical review bundle</p>
            <p className="text-sm break-all">{reviewBundlePath}</p>
            <p className="text-sm text-gray-700 mt-3">
              Saving updates the bundle artifact only. Apply and import still run through wrapped
              legislative commands with server-side readiness checks.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={saveApprovals}
              disabled={isPending || !permissions.save_approvals?.allowed}
              className="rounded-lg border px-4 py-2 bg-white"
            >
              Save Approvals
            </button>
            <button
              type="button"
              onClick={() =>
                runAction(
                  "/api/admin/legislative/apply",
                  { mode: "dry-run" },
                  "Legislative apply dry-run finished. Review the report before applying."
                )
              }
              disabled={isPending || !permissions.run_apply_dry_run?.allowed}
              className="rounded-lg border px-4 py-2 bg-white"
            >
              Run Apply Dry-Run
            </button>
            <button
              type="button"
              onClick={() => {
                if (!window.confirm("Apply the approved legislative bundle actions?")) {
                  return;
                }
                runAction(
                  "/api/admin/legislative/apply",
                  { mode: "apply", confirmed: true },
                  "Approved legislative bundle actions applied through the wrapped CLI flow."
                );
              }}
              disabled={isPending || !permissions.apply_bundle?.allowed}
              className="rounded-lg border px-4 py-2 bg-black text-white"
            >
              Apply Approved Actions
            </button>
            <button
              type="button"
              onClick={() =>
                runAction(
                  "/api/admin/legislative/import",
                  { mode: "dry-run" },
                  "Legislative import dry-run finished. Review the import report before applying."
                )
              }
              disabled={isPending || !permissions.run_import_dry_run?.allowed}
              className="rounded-lg border px-4 py-2 bg-white"
            >
              Run Import Dry-Run
            </button>
            <button
              type="button"
              onClick={() => {
                if (!window.confirm("Apply the approved tracked-bill import?")) {
                  return;
                }
                runAction(
                  "/api/admin/legislative/import",
                  { mode: "apply", confirmed: true },
                  "Approved tracked-bill import applied through the wrapped CLI flow."
                );
              }}
              disabled={isPending || !permissions.apply_import?.allowed}
              className="rounded-lg border px-4 py-2 bg-black text-white"
            >
              Apply Import
            </button>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm">
          <div className="rounded-xl border p-4 bg-gray-50">
            <p className="font-semibold">Apply dry-run gate</p>
            {(permissions.run_apply_dry_run?.reasons || []).length ? (
              <div className="mt-2 space-y-1 text-gray-700">
                {permissions.run_apply_dry_run.reasons.map((reason) => (
                  <p key={reason}>{reason}</p>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-gray-700">Ready to preview approved actions.</p>
            )}
          </div>
          <div className="rounded-xl border p-4 bg-gray-50">
            <p className="font-semibold">Apply gate</p>
            {(permissions.apply_bundle?.reasons || []).length ? (
              <div className="mt-2 space-y-1 text-gray-700">
                {permissions.apply_bundle.reasons.map((reason) => (
                  <p key={reason}>{reason}</p>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-gray-700">Ready for wrapped apply.</p>
            )}
          </div>
          <div className="rounded-xl border p-4 bg-gray-50">
            <p className="font-semibold">Import dry-run gate</p>
            {(permissions.run_import_dry_run?.reasons || []).length ? (
              <div className="mt-2 space-y-1 text-gray-700">
                {permissions.run_import_dry_run.reasons.map((reason) => (
                  <p key={reason}>{reason}</p>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-gray-700">Ready to preview tracked-bill import.</p>
            )}
          </div>
          <div className="rounded-xl border p-4 bg-gray-50">
            <p className="font-semibold">Import apply gate</p>
            {(permissions.apply_import?.reasons || []).length ? (
              <div className="mt-2 space-y-1 text-gray-700">
                {permissions.apply_import.reasons.map((reason) => (
                  <p key={reason}>{reason}</p>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-gray-700">Ready for wrapped import apply.</p>
            )}
          </div>
        </div>
        {message ? <p className="text-sm text-gray-700">{message}</p> : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <h2 className="text-lg font-semibold">Workflow blockers</h2>
          <div className="mt-4 space-y-3 text-sm">
            {(workspace.blockers || []).length ? (
              workspace.blockers.map((blocker) => (
                <div key={blocker} className="rounded-xl border p-4 bg-gray-50">
                  {blocker}
                </div>
              ))
            ) : (
              <p className="text-gray-600">No explicit blockers are recorded right now.</p>
            )}
          </div>
        </div>

        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <h2 className="text-lg font-semibold">Next safe step</h2>
          <p className="mt-3 font-semibold">{workspace.next_step.label}</p>
          <div className="mt-4 space-y-2">
            {workspace.next_step.commands.map((command) => (
              <pre
                key={command}
                className="overflow-x-auto rounded-xl border bg-[var(--paper)] px-4 py-3 text-sm"
              >
                <code>{command}</code>
              </pre>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <SummaryCard title="Latest apply report" report={workspace.apply_report} />
        <SummaryCard title="Latest import report" report={workspace.import_report} />
      </section>

      <section className="space-y-4">
        {(actions || []).map((action) => (
          <article key={action.action_id} className="border rounded-2xl p-5 bg-white shadow-sm space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-gray-600">
                  Future bill {action.future_bill_id}
                </p>
                <h2 className="text-xl font-semibold mt-1">{action.future_bill_title}</h2>
                <p className="text-sm text-gray-700 mt-2">
                  {action.action_type} • {action.candidate_bill_number || action.target_id || "n/a"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border px-3 py-1">{action.action_priority}</span>
                <span className="rounded-full border px-3 py-1">
                  {action.status} / {action.review_state}
                </span>
                <span className="rounded-full border px-3 py-1">
                  {action.approved ? "approved" : "not approved"}
                </span>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
              <div className="space-y-3">
                <div className="rounded-xl border p-4 bg-gray-50">
                  <p className="text-sm text-gray-600">Rationale</p>
                  <p className="mt-1 text-sm">{action.rationale || "No rationale provided."}</p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-sm text-gray-600">Candidate</p>
                  <p className="mt-1 text-sm">
                    {action.candidate_title || "No candidate title"}{" "}
                    {action.proposed_link_type ? `• ${action.proposed_link_type}` : ""}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="block text-sm font-medium mb-1">Operator decision</span>
                  <select
                    value={action.decision}
                    onChange={(event) =>
                      updateAction(action.action_id, "decision", event.target.value)
                    }
                    className="w-full rounded-lg border px-3 py-2"
                  >
                    {DECISION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="block text-sm font-medium mb-1">Approval note</span>
                  <textarea
                    value={action.approval_note}
                    onChange={(event) =>
                      updateAction(action.action_id, "approval_note", event.target.value)
                    }
                    className="min-h-24 w-full rounded-lg border px-3 py-2"
                  />
                </label>
              </div>
            </div>
          </article>
        ))}
        {!actions.length ? (
          <section className="border rounded-2xl p-6 bg-white shadow-sm">
            <p>No legislative operator actions are currently available in the bundle.</p>
          </section>
        ) : null}
      </section>

      <section className="border rounded-2xl p-5 bg-white shadow-sm">
        <h2 className="text-lg font-semibold">Artifact state</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2 text-sm">
          {Object.values(workspace.artifact_status).map((artifact) => (
            <div key={artifact.key} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-semibold">{artifact.label}</p>
                <span className="rounded-full border px-3 py-1 text-xs">
                  {artifact.exists ? "present" : "missing"}
                </span>
              </div>
              <p className="mt-2 break-all text-gray-700">{artifact.path}</p>
              {artifact.generated_at ? (
                <p className="mt-1 text-gray-600">Updated: {artifact.generated_at}</p>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
