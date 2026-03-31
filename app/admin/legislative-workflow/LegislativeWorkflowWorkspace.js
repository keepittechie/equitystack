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
    <div className="rounded border border-zinc-300 bg-white p-3 shadow-sm">
      <p className="text-[11px] text-gray-600">{title}</p>
      {report ? (
        <div className="mt-2 space-y-1 text-[12px]">
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
        <p className="mt-2 text-[12px] text-gray-600">No report available yet.</p>
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
      <section className="rounded border border-zinc-300 bg-white p-4 shadow-sm">
        <p>No legislative review bundle is available yet.</p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-3 lg:grid-cols-4">
        <div className="rounded border border-zinc-300 bg-white p-3 shadow-sm">
          <p className="text-[11px] text-gray-600">Workflow state</p>
          <p className="mt-1 text-base font-semibold">{workspace.workflow_status}</p>
        </div>
        <div className="rounded border border-zinc-300 bg-white p-3 shadow-sm">
          <p className="text-[11px] text-gray-600">Requested model</p>
          <p className="mt-1 text-base font-semibold">
            {workspace.requested_model || "Unavailable"}
          </p>
        </div>
        <div className="rounded border border-zinc-300 bg-white p-3 shadow-sm">
          <p className="text-[11px] text-gray-600">Actionable approvals</p>
          <p className="mt-1 text-base font-semibold">
            {workspace.counts.approved_pending_actions} approved / {workspace.counts.pending_unreviewed_actions} pending
          </p>
        </div>
        <div className="rounded border border-zinc-300 bg-white p-3 shadow-sm">
          <p className="text-[11px] text-gray-600">Seed imports</p>
          <p className="mt-1 text-base font-semibold">{workspace.counts.approved_seed_rows}</p>
        </div>
      </section>

      <section className="rounded border border-zinc-300 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] text-gray-600">Canonical review bundle</p>
            <p className="break-all font-mono text-[11px]">{reviewBundlePath}</p>
            <p className="mt-3 text-[12px] text-gray-700">
              Saving updates the bundle artifact only. Apply and import still run through wrapped
              legislative commands with server-side readiness checks.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={saveApprovals}
              disabled={isPending || !permissions.save_approvals?.allowed}
              className="rounded border px-3 py-1.5 bg-white text-[12px]"
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
              className="rounded border px-3 py-1.5 bg-white text-[12px]"
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
              className="rounded border px-3 py-1.5 bg-black text-[12px] text-white"
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
              className="rounded border px-3 py-1.5 bg-white text-[12px]"
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
              className="rounded border px-3 py-1.5 bg-black text-[12px] text-white"
            >
              Apply Import
            </button>
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4 text-[12px]">
          <div className="rounded border p-3 bg-gray-50">
            <p className="font-semibold">Apply dry-run gate</p>
            {(permissions.run_apply_dry_run?.reasons || []).length ? (
              <div className="mt-2 space-y-1 text-[11px] text-gray-700">
                {permissions.run_apply_dry_run.reasons.map((reason) => (
                  <p key={reason}>{reason}</p>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-gray-700">Ready to preview approved actions.</p>
            )}
          </div>
          <div className="rounded border p-3 bg-gray-50">
            <p className="font-semibold">Apply gate</p>
            {(permissions.apply_bundle?.reasons || []).length ? (
              <div className="mt-2 space-y-1 text-[11px] text-gray-700">
                {permissions.apply_bundle.reasons.map((reason) => (
                  <p key={reason}>{reason}</p>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-gray-700">Ready for wrapped apply.</p>
            )}
          </div>
          <div className="rounded border p-3 bg-gray-50">
            <p className="font-semibold">Import dry-run gate</p>
            {(permissions.run_import_dry_run?.reasons || []).length ? (
              <div className="mt-2 space-y-1 text-[11px] text-gray-700">
                {permissions.run_import_dry_run.reasons.map((reason) => (
                  <p key={reason}>{reason}</p>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-gray-700">Ready to preview tracked-bill import.</p>
            )}
          </div>
          <div className="rounded border p-3 bg-gray-50">
            <p className="font-semibold">Import apply gate</p>
            {(permissions.apply_import?.reasons || []).length ? (
              <div className="mt-2 space-y-1 text-[11px] text-gray-700">
                {permissions.apply_import.reasons.map((reason) => (
                  <p key={reason}>{reason}</p>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-gray-700">Ready for wrapped import apply.</p>
            )}
          </div>
        </div>
        {message ? <p className="text-[12px] text-gray-700">{message}</p> : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded border border-zinc-300 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold">Workflow blockers</h2>
          <div className="mt-3 space-y-2 text-[12px]">
            {(workspace.blockers || []).length ? (
              workspace.blockers.map((blocker) => (
                <div key={blocker} className="rounded border p-3 bg-gray-50">
                  {blocker}
                </div>
              ))
            ) : (
              <p className="text-gray-600">No explicit blockers are recorded right now.</p>
            )}
          </div>
        </div>

        <div className="rounded border border-zinc-300 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold">Next safe step</h2>
          <p className="mt-3 font-semibold">{workspace.next_step.label}</p>
          <div className="mt-4 space-y-2">
            {workspace.next_step.commands.map((command) => (
              <pre
                key={command}
                className="overflow-x-auto rounded border bg-[var(--paper)] px-3 py-2 text-[11px]"
              >
                <code>{command}</code>
              </pre>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <SummaryCard title="Latest apply report" report={workspace.apply_report} />
        <SummaryCard title="Latest import report" report={workspace.import_report} />
      </section>

      <section className="rounded border border-zinc-300 bg-white p-4 shadow-sm">
        <div className="mb-3">
          <h2 className="text-base font-semibold">Bundle actions</h2>
          <p className="mt-1 text-[12px] text-gray-600">
            Dense approval table. Approve or dismiss inline, then inspect the row for rationale and notes.
          </p>
        </div>
        <div className="overflow-x-auto rounded border border-zinc-200">
          <table className="min-w-full text-[12px]">
            <thead className="bg-zinc-100 text-left text-[11px] uppercase tracking-wide text-zinc-600">
              <tr>
                <th className="border-b border-zinc-200 px-3 py-2">Bundle action</th>
                <th className="border-b border-zinc-200 px-3 py-2">Status</th>
                <th className="border-b border-zinc-200 px-3 py-2">Decision</th>
                <th className="border-b border-zinc-200 px-3 py-2">Inspect / note</th>
              </tr>
            </thead>
            <tbody>
              {(actions || []).map((action) => (
                <tr key={action.action_id} className="align-top odd:bg-white even:bg-zinc-50/50">
                  <td className="border-b border-zinc-200 px-3 py-2">
                    <div className="text-[11px] uppercase tracking-wide text-zinc-500">
                      Future bill {action.future_bill_id}
                    </div>
                    <div className="font-medium">{action.future_bill_title}</div>
                    <div className="mt-1 text-[11px] text-zinc-700">
                      {action.action_type} • {action.candidate_bill_number || action.target_id || "n/a"}
                    </div>
                  </td>
                  <td className="border-b border-zinc-200 px-3 py-2 text-[11px] text-zinc-600">
                    <div>{action.action_priority}</div>
                    <div className="mt-1">{action.status} / {action.review_state}</div>
                    <div className="mt-1">{action.approved ? "approved" : "not approved"}</div>
                  </td>
                  <td className="border-b border-zinc-200 px-3 py-2">
                    <select
                      value={action.decision}
                      onChange={(event) => updateAction(action.action_id, "decision", event.target.value)}
                      className="w-full min-w-[10rem] rounded border px-2 py-1 text-[12px]"
                    >
                      {DECISION_OPTIONS.map((option) => (
                        <option key={`${action.action_id}-${option.value}`} value={option.value}>
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
                          <p className="font-medium">Rationale</p>
                          <p className="mt-1">{action.rationale || "No rationale provided."}</p>
                        </div>
                        <div>
                          <p className="font-medium">Candidate</p>
                          <p className="mt-1">
                            {action.candidate_title || "No candidate title"}{" "}
                            {action.proposed_link_type ? `• ${action.proposed_link_type}` : ""}
                          </p>
                        </div>
                        <label className="block">
                          <span className="block font-medium">Approval note</span>
                          <textarea
                            value={action.approval_note}
                            onChange={(event) => updateAction(action.action_id, "approval_note", event.target.value)}
                            className="mt-1 min-h-20 w-full rounded border px-2 py-1.5 text-[12px]"
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
        {!actions.length ? (
          <section className="mt-3 rounded border border-zinc-300 bg-white p-4 shadow-sm">
            <p>No legislative operator actions are currently available in the bundle.</p>
          </section>
        ) : null}
      </section>

      <section className="rounded border border-zinc-300 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">Artifact state</h2>
        <div className="mt-3 grid gap-3 lg:grid-cols-2 text-[12px]">
          {Object.values(workspace.artifact_status).map((artifact) => (
            <div key={artifact.key} className="rounded border p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-semibold">{artifact.label}</p>
                <span className="rounded border px-2 py-0.5 text-[11px] uppercase tracking-wide">
                  {artifact.exists ? "present" : "missing"}
                </span>
              </div>
              <p className="mt-1 break-all font-mono text-[11px] text-gray-700">{artifact.path}</p>
              {artifact.generated_at ? (
                <p className="mt-1 text-[11px] text-gray-600">Updated: {artifact.generated_at}</p>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
