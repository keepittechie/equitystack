"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { readAdminJsonResponse } from "@/app/admin/components/readAdminJsonResponse";

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

function getTrustBannerConfig(summary) {
  if (!summary) {
    return null;
  }

  if (summary.severity === "critical") {
    return {
      border: "border-[#FCA5A5]",
      bg: "bg-[#FEF2F2]",
      text: "text-[#991B1B]",
      label: "Trust warning",
    };
  }
  if (summary.severity === "warning") {
    return {
      border: "border-[#FCD34D]",
      bg: "bg-[#FFFBEB]",
      text: "text-[#92400E]",
      label: "Needs verification",
    };
  }
  return {
    border: "border-[#86EFAC]",
    bg: "bg-[#F0FDF4]",
    text: "text-[#166534]",
    label: "AI review healthy",
  };
}

export default function LegislativeWorkflowWorkspace({ workspace }) {
  const router = useRouter();
  const [actions, setActions] = useState(cloneActions(workspace.operator_actions || []));
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const permissions = workspace.action_permissions || {};
  const reviewBundlePath = workspace.review_bundle?.path;
  const outcomeSummary = workspace.workflow_outcome_summary || null;
  const trustBanner = getTrustBannerConfig(outcomeSummary);
  const reviewQueueCount =
    outcomeSummary?.manual_review_queue_count || workspace.manual_review_queue?.manual_review_count || 0;
  const manualReviewItems = Array.isArray(workspace.manual_review_queue?.items)
    ? workspace.manual_review_queue.items
    : [];

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
        const payload = await readAdminJsonResponse(response, url);
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

  return (
    <div className="space-y-4">
      {outcomeSummary && trustBanner ? (
        <section
          className={`rounded border ${trustBanner.border} ${trustBanner.bg} p-4 shadow-sm`}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <p className={`text-[11px] font-medium uppercase tracking-wide ${trustBanner.text}`}>
                {trustBanner.label}
              </p>
              <h2 className="text-base font-semibold text-[#1F2937]">
                {outcomeSummary.user_message}
              </h2>
              <p className="max-w-5xl text-[12px] text-[#4B5563]">
                {outcomeSummary.next_step_message || outcomeSummary.next_step}
              </p>
            </div>
            <div className="rounded border border-white/60 bg-white/70 px-3 py-2 text-[11px] text-[#4B5563]">
              <div>AI status: <span className="font-semibold text-[#1F2937]">{outcomeSummary.ai_status?.run_status || "unknown"}</span></div>
              <div>Fallback used: <span className="font-semibold text-[#1F2937]">{outcomeSummary.ai_status?.fallback_used || 0}/{outcomeSummary.ai_status?.total_items || 0}</span></div>
              <div>Confidence: <span className="font-semibold text-[#1F2937]">{outcomeSummary.confidence_level || "unknown"}</span></div>
            </div>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-4 text-[12px]">
            <div className="rounded border border-[#E5EAF0] bg-white p-3">
              <p className="text-[11px] text-[#6B7280]">AI review</p>
              <p className="mt-1 font-semibold text-[#1F2937]">
                {outcomeSummary.ai_status?.ai_success || 0} AI-reviewed / {outcomeSummary.ai_status?.total_items || 0} total
              </p>
              <p className="mt-1 text-[11px] text-[#4B5563]">
                primary {outcomeSummary.ai_status?.primary_model_success || 0}, fallback model {outcomeSummary.ai_status?.fallback_model_success || 0}, heuristic {outcomeSummary.ai_status?.heuristic_fallback || 0}
              </p>
            </div>
            <div className="rounded border border-[#E5EAF0] bg-white p-3">
              <p className="text-[11px] text-[#6B7280]">Decisions</p>
              <p className="mt-1 font-semibold text-[#1F2937]">
                {outcomeSummary.decisions?.kept || 0} kept, {outcomeSummary.decisions?.modified || 0} modified, {outcomeSummary.decisions?.removed || 0} removed
              </p>
              <p className="mt-1 text-[11px] text-[#4B5563]">
                {outcomeSummary.decisions?.manual_review || 0} require manual review
              </p>
            </div>
            <div className="rounded border border-[#E5EAF0] bg-white p-3">
              <p className="text-[11px] text-[#6B7280]">Manual review queue</p>
              <p className="mt-1 font-semibold text-[#1F2937]">{reviewQueueCount} item(s)</p>
              <p className="mt-1 break-all font-mono text-[11px] text-[#4B5563]">
                {workspace.manual_review_queue?.path || "No manual-review queue artifact recorded."}
              </p>
            </div>
            <div className="rounded border border-[#E5EAF0] bg-white p-3">
              <p className="text-[11px] text-[#6B7280]">Failure reason</p>
              <p className="mt-1 font-semibold text-[#1F2937]">
                {outcomeSummary.ai_status?.ai_failure_reason || "No AI failure recorded"}
              </p>
              <p className="mt-1 text-[11px] text-[#4B5563]">
                Trust warning: {outcomeSummary.trust_warning ? "Yes" : "No"}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {!workspace.review_bundle ? (
        <section className="rounded border border-zinc-300 bg-white p-4 shadow-sm">
          <p className="font-semibold text-[#1F2937]">No legislative review bundle is available yet.</p>
          <p className="mt-2 text-[12px] text-[#4B5563]">
            If manual-review items exist, inspect the AI review and manual-review queue artifacts before rerunning the wrapped legislative review step.
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-[12px]">
            <Link href="/admin/workflows" className="text-[#3B82F6] underline underline-offset-2">
              Open workflows
            </Link>
            <a href="#artifact-state" className="text-[#3B82F6] underline underline-offset-2">
              Inspect missing artifact
            </a>
          </div>
        </section>
      ) : null}

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
          <p className="text-[11px] text-gray-600">Manual review queue</p>
          <p className="mt-1 text-base font-semibold">{reviewQueueCount}</p>
        </div>
      </section>

      {workspace.review_bundle ? (
      <section id="bundle-approval" className="rounded border border-zinc-300 bg-white p-4 shadow-sm space-y-3">
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
              className="rounded border border-[#3B82F6] bg-[#3B82F6] px-3 py-1.5 text-[12px] text-white"
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
              className="rounded border border-[#3B82F6] bg-[#3B82F6] px-3 py-1.5 text-[12px] text-white"
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
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div id="workflow-blockers" className="rounded border border-zinc-300 bg-white p-4 shadow-sm">
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

      <section id="workflow-reports" className="grid gap-3 md:grid-cols-2">
        <SummaryCard title="Latest apply report" report={workspace.apply_report} />
        <SummaryCard title="Latest import report" report={workspace.import_report} />
      </section>

      <section id="manual-review-queue" className="rounded border border-zinc-300 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Manual review queue</h2>
            <p className="mt-1 text-[12px] text-gray-600">
              These are the canonical legislative rows that still need human review before bundle approval or apply can continue.
            </p>
          </div>
          <div className="rounded border border-[#E5EAF0] bg-[#F9FBFD] px-3 py-2 text-[11px] text-[#4B5563]">
            <div>Queue items: <span className="font-semibold text-[#1F2937]">{reviewQueueCount}</span></div>
            <div className="mt-1 break-all font-mono text-[#6B7280]">
              {workspace.manual_review_queue?.path || "No manual-review queue artifact recorded."}
            </div>
          </div>
        </div>

        {manualReviewItems.length ? (
          <div className="overflow-x-auto rounded border border-zinc-200">
            <table className="min-w-full text-[12px]">
              <thead className="bg-zinc-100 text-left text-[11px] uppercase tracking-wide text-zinc-600">
                <tr>
                  <th className="border-b border-zinc-200 px-3 py-2">Future bill</th>
                  <th className="border-b border-zinc-200 px-3 py-2">Current link</th>
                  <th className="border-b border-zinc-200 px-3 py-2">Decision</th>
                  <th className="border-b border-zinc-200 px-3 py-2">Why manual review</th>
                  <th className="border-b border-zinc-200 px-3 py-2">Next step</th>
                </tr>
              </thead>
              <tbody>
                {manualReviewItems.map((item, index) => (
                  <tr key={`${item.future_bill_link_id || item.bill_number || item.future_bill_title || "manual"}:${index}`} className="align-top odd:bg-white even:bg-zinc-50/50">
                    <td className="border-b border-zinc-200 px-3 py-2">
                      <div className="font-medium text-[#1F2937]">
                        {item.future_bill_title || "Untitled future bill"}
                      </div>
                      <div className="mt-1 text-[11px] text-zinc-700">
                        {item.bill_number || "No bill number"}
                      </div>
                    </td>
                    <td className="border-b border-zinc-200 px-3 py-2 text-[11px] text-zinc-700">
                      <div>{item.tracked_bill_title || "No tracked bill title"}</div>
                      <div className="mt-1">risk: {item.original_risk_level || "unknown"}</div>
                    </td>
                    <td className="border-b border-zinc-200 px-3 py-2 text-[11px] text-zinc-700">
                      <div className="font-medium text-[#1F2937]">{item.final_decision || "review_manually"}</div>
                      <div className="mt-1">match: {item.match_label || "unknown"}</div>
                      <div className="mt-1">score: {item.total_score ?? "n/a"}</div>
                    </td>
                    <td className="border-b border-zinc-200 px-3 py-2 text-[11px] text-zinc-700">
                      <div className="max-w-[360px]">
                        {item.llm_reasoning_short || "No short rationale recorded."}
                      </div>
                      {(item.why_not_auto_applied || []).length ? (
                        <ul className="mt-2 space-y-1 text-[11px] text-zinc-600">
                          {item.why_not_auto_applied.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      ) : null}
                    </td>
                    <td className="border-b border-zinc-200 px-3 py-2 text-[11px] text-zinc-700">
                      {item.suggested_next_step || "Review and classify in this surface"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded border border-[#E5EAF0] bg-[#F9FBFD] p-3 text-[12px] text-[#4B5563]">
            <p className="font-medium text-[#1F2937]">No review items pending.</p>
            <p className="mt-1">
              Next step: run the legislative workflow again if you expected new review work, or continue to bundle approval if the queue is genuinely clear.
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              <Link href="/admin/workflows" className="text-[#3B82F6] underline underline-offset-2">
                Open workflows
              </Link>
              <a href="#bundle-approval" className="text-[#3B82F6] underline underline-offset-2">
                Open bundle approval
              </a>
            </div>
          </div>
        )}
      </section>

      {workspace.review_bundle ? (
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
            <p className="font-medium text-[#1F2937]">No bundle approval items are pending.</p>
            <p className="mt-1 text-[12px] text-[#4B5563]">
              Next step: continue with manual review, workflow reports, or the next guarded apply/import checkpoint if the bundle is genuinely clear.
            </p>
          </section>
        ) : null}
      </section>
      ) : null}

      <section id="artifact-state" className="rounded border border-zinc-300 bg-white p-4 shadow-sm">
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
