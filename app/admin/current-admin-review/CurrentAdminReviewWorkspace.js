"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { readAdminJsonResponse } from "@/app/admin/components/readAdminJsonResponse";

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
  const actionPermissions = workspace.action_permissions || {};
  const finalizePermission = actionPermissions.finalize || { allowed: false, reasons: [] };
  const artifactStatus = workspace.artifact_status || {};
  const importReadiness = workspace.import_readiness || {};
  const queuePromotionState = workspace.queue_promotion_state || {};
  const provenance = workspace.provenance || {};
  const batchState = workspace.batch_state || null;
  const validationCounts = batchState?.validation_counts || {};
  const manualReviewState = workspace.manual_review_state || {};
  const manualReviewItems = manualReviewState.items || [];
  const manualReviewCounts = manualReviewState.counts || {};
  const calibrationState = workspace.calibration_state || {};
  const calibrationSignals = calibrationState.tuning_signals || {};
  const simulationState = workspace.simulation_state || {};
  const evidencePackState = workspace.evidence_pack_state || {};
  const evidenceGapPatterns = evidencePackState.top_evidence_gap_patterns || {};
  const comparisonState = workspace.comparison_state || {};
  const comparisonDeltas = comparisonState.aggregate_deltas || {};
  const pairedEvaluationState = workspace.paired_evaluation_state || {};
  const pairedBaselineStatus = pairedEvaluationState.baseline_status || {};
  const pairedEnrichedStatus = pairedEvaluationState.enriched_status || {};

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
      <section className="rounded border border-zinc-300 bg-[var(--admin-surface)] p-4 shadow-sm">
        <p>No current-admin review artifact is available yet.</p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {provenance.provenance_incomplete ? (
        <section className="rounded border border-amber-300 bg-amber-50 p-4 shadow-sm">
          <p className="text-[11px] uppercase tracking-wide text-amber-900">Provenance incomplete</p>
          <p className="mt-2 text-[12px] text-amber-950">
            {provenance.summary}
          </p>
          <p className="mt-2 text-[11px] text-amber-900">
            Import batch detected: {provenance.import_batch_detected ? "yes" : "no"} • Artifact chain missing:{" "}
            {provenance.artifact_chain_missing ? "yes" : "no"} • Matched DB rows:{" "}
            {provenance.matched_record_count || 0}
          </p>
          {(provenance.missing_artifacts || []).length ? (
            <p className="mt-2 text-[11px] text-amber-900">
              Missing artifacts: {provenance.missing_artifacts.join(", ")}
            </p>
          ) : null}
          {(provenance.matched_slugs_sample || []).length ? (
            <p className="mt-1 text-[11px] text-amber-900">
              Sample DB slugs: {provenance.matched_slugs_sample.join(", ")}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="grid gap-3 lg:grid-cols-5">
        <div className="rounded border border-zinc-300 bg-[var(--admin-surface)] p-3 shadow-sm">
          <p className="text-[11px] text-gray-600">Batch</p>
          <p className="mt-1 text-base font-semibold">{batch.batch_name}</p>
          <p className="mt-1 text-[11px] text-gray-600">Stage: {batch.stage}</p>
        </div>
        <div className="rounded border border-zinc-300 bg-[var(--admin-surface)] p-3 shadow-sm">
          <p className="text-[11px] text-gray-600">Model / mode</p>
          <p className="mt-1 text-base font-semibold">
            {batch.model || "unknown"} / {batch.review_mode || "standard"}
          </p>
        </div>
        <div className="rounded border border-zinc-300 bg-[var(--admin-surface)] p-3 shadow-sm">
          <p className="text-[11px] text-gray-600">Manual review items</p>
          <p className="mt-1 text-base font-semibold">{workspace.counts.total_items}</p>
          <p className="mt-1 text-[11px] text-gray-600">
            Approval-style decisions: {workspace.counts.approval_style_decisions} • Pending review:{" "}
            {workspace.counts.pending_review} • Held back: {workspace.counts.held_for_followup}
          </p>
        </div>
        <div className="rounded border border-zinc-300 bg-[var(--admin-surface)] p-3 shadow-sm">
          <p className="text-[11px] text-gray-600">Queue import readiness</p>
          <p className="mt-1 text-base font-semibold">
            {importReadiness.readiness_label || "Review In Progress"}
          </p>
          <p className="mt-1 text-[11px] text-gray-600">
            Auto-approved: {importReadiness.auto_approved_item_count || 0} • In manual queue:{" "}
            {importReadiness.queue_item_count || 0} • Auto-rejected:{" "}
            {importReadiness.auto_rejected_item_count || 0}
          </p>
        </div>
        <div className="rounded border border-zinc-300 bg-[var(--admin-surface)] p-3 shadow-sm">
          <p className="text-[11px] text-gray-600">Next recommended action</p>
          <p className="mt-1 font-semibold">{workspace.next_recommended_action.next_step_label}</p>
        </div>
      </section>

      {queuePromotionState.promoted ? (
        <section className="rounded border border-amber-300 bg-amber-50 p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-amber-800">Queue promotion</p>
              <h2 className="mt-1 text-base font-semibold text-amber-950">
                {queuePromotionState.status_label || "Promoted Review Queue"}
              </h2>
              <p className="mt-1 text-[12px] text-amber-900">
                {queuePromotionState.operator_hint}
              </p>
            </div>
            <span className="rounded-full border border-amber-500 bg-[var(--admin-surface)] px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
              AI-first
            </span>
          </div>
          <div className="mt-3 grid gap-2 text-[12px] text-amber-950 md:grid-cols-3">
            <p>Auto-approved: {queuePromotionState.auto_approved_item_count || queuePromotionState.approved_item_count || 0}</p>
            <p>Manual review queue: {queuePromotionState.manual_review_item_count || 0}</p>
            <p>Auto-rejected: {queuePromotionState.auto_rejected_item_count || 0}</p>
          </div>
          <div className="mt-2 grid gap-2 text-[12px] text-amber-950 md:grid-cols-2">
            <p>Pending impact: {queuePromotionState.pending_impact_item_count || 0}</p>
            <p>Reviewed: {queuePromotionState.reviewed_item_count || 0}</p>
          </div>
          <p className="mt-2 text-[11px] text-amber-900">
            Source review: {queuePromotionState.source_review_path || "unknown"}
          </p>
        </section>
      ) : null}

      {batchState ? (
        <section className="rounded border border-zinc-300 bg-[var(--admin-surface)] p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-600">OpenAI Batch readiness</p>
              <h2 className="mt-1 text-base font-semibold">{batchState.status_label}</h2>
              <p className="mt-1 text-[12px] text-gray-700">{batchState.operator_hint}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="rounded border px-2 py-0.5">
                finalize: {batchState.finalize_safe ? "safe" : "blocked"}
              </span>
              <span className="rounded border px-2 py-0.5">
                apply: {batchState.apply_safe ? "safe" : "blocked"}
              </span>
            </div>
          </div>
          <div className="mt-3 grid gap-3 text-[12px] md:grid-cols-3">
            <div className="rounded border bg-gray-50 p-3">
              <p className="text-[11px] text-gray-600">Lifecycle</p>
              <p className="mt-1 font-semibold">{batchState.lifecycle_status || "unknown"}</p>
              <p className="mt-1 break-all font-mono text-[11px] text-gray-700">
                {batchState.batch_id || "No Batch id"}
              </p>
              <p className="mt-1 text-[11px] text-gray-600">Model: {batchState.model || "unknown"}</p>
            </div>
            <div className="rounded border bg-gray-50 p-3">
              <p className="text-[11px] text-gray-600">Artifacts</p>
              <p className="mt-1">Reviewed: {batchState.reviewed_count || 0}</p>
              <p className="mt-1">Output fetched: {batchState.output_ready ? "yes" : "no"}</p>
              <p className="mt-1">Error file present: {batchState.error_file_present ? "yes" : "no"}</p>
              <p className="mt-1">Review rebuilt: {batchState.review_artifact_rebuilt ? "yes" : "no"}</p>
            </div>
            <div className="rounded border bg-gray-50 p-3">
              <p className="text-[11px] text-gray-600">Validation</p>
              <p className="mt-1">
                Valid: {validationCounts.valid_items || 0} / {validationCounts.total_items || 0}
              </p>
              <p className="mt-1">
                Malformed: {validationCounts.malformed_items || 0} • Enum: {validationCounts.enum_errors || 0} • Missing:{" "}
                {validationCounts.missing_field_errors || 0}
              </p>
              <p className="mt-1">
                Low confidence: {validationCounts.low_confidence_items || 0} • Manual review:{" "}
                {validationCounts.needs_manual_review_items || 0}
              </p>
            </div>
          </div>
          {(batchState.blocker_text || []).length ? (
            <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-[12px] text-amber-950">
              <p className="font-semibold">Batch blockers</p>
              <div className="mt-2 space-y-1">
                {batchState.blocker_text.map((entry) => (
                  <p key={entry}>{entry}</p>
                ))}
              </div>
            </div>
          ) : null}
          {(batchState.warning_text || []).length ? (
            <div className="mt-3 rounded border border-zinc-300 bg-gray-50 p-3 text-[12px] text-gray-700">
              <p className="font-semibold">Batch warnings</p>
              <div className="mt-2 space-y-1">
                {batchState.warning_text.map((entry) => (
                  <p key={entry}>{entry}</p>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="rounded border border-zinc-300 bg-[var(--admin-surface)] p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-600">Evidence pack</p>
            <h2 className="mt-1 text-base font-semibold">
              {evidencePackState.artifact_present ? "Source grounding ready" : "No evidence-pack context"}
            </h2>
            <p className="mt-1 text-[12px] text-gray-700">
              {evidencePackState.model_facing_item_count || 0} model-facing item(s) packed
            </p>
          </div>
          <div className="text-[11px] text-gray-600">
            <p>Version: {evidencePackState.packing_version || "n/a"}</p>
            <p className="break-all">Artifact: {evidencePackState.artifact_path || "not generated"}</p>
          </div>
        </div>
        <div className="mt-3 grid gap-3 text-[12px] md:grid-cols-4">
          <div className="rounded border bg-gray-50 p-3">
            <p className="text-[11px] text-gray-600">Single-source official</p>
            <p className="mt-1 text-lg font-semibold">{evidencePackState.single_source_official_count || 0}</p>
          </div>
          <div className="rounded border bg-gray-50 p-3">
            <p className="text-[11px] text-gray-600">Outcome evidence</p>
            <p className="mt-1 text-lg font-semibold">{evidencePackState.outcome_evidence_present_count || 0}</p>
          </div>
          <div className="rounded border bg-gray-50 p-3">
            <p className="text-[11px] text-gray-600">Policy-intent only</p>
            <p className="mt-1 text-lg font-semibold">{evidencePackState.policy_intent_only_count || 0}</p>
          </div>
          <div className="rounded border bg-gray-50 p-3">
            <p className="text-[11px] text-gray-600">Weak outcome evidence</p>
            <p className="mt-1 text-lg font-semibold">{evidencePackState.weak_outcome_evidence_count || 0}</p>
          </div>
        </div>
        <div className="mt-3 grid gap-3 text-[12px] md:grid-cols-2">
          <div className="rounded border bg-gray-50 p-3">
            <p className="font-semibold">Evidence-quality interpretation</p>
            <p className="mt-1 text-gray-700">
              {(evidencePackState.operator_interpretations || [])[0] || "No evidence-pack context is available"}
            </p>
          </div>
          <div className="rounded border bg-gray-50 p-3">
            <p className="font-semibold">Top evidence-gap patterns</p>
            {Object.entries(evidenceGapPatterns)
              .slice(0, 4)
              .map(([label, count]) => (
                <p key={label} className="mt-1">
                  {label}: {count}
                </p>
              ))}
            {Object.keys(evidenceGapPatterns).length === 0 ? <p className="mt-1">No evidence-pack diagnostics</p> : null}
          </div>
        </div>
      </section>

      <section className="rounded border border-zinc-300 bg-[var(--admin-surface)] p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-600">Review quality comparison</p>
            <h2 className="mt-1 text-base font-semibold">
              {comparisonState.comparison_available ? "Baseline vs enriched comparison ready" : "No comparison context"}
            </h2>
            <p className="mt-1 text-[12px] text-gray-700">
              {comparisonState.comparison_available
                ? `${comparisonState.matched_item_count || 0} matched item(s)`
                : comparisonState.reason || "Provide explicit baseline and enriched artifacts to compare runs."}
            </p>
          </div>
          <div className="text-[11px] text-gray-600">
            <p>Mode: {comparisonState.identification_mode || "not inferred"}</p>
            <p>Batch: {comparisonState.compared_batch_name || batch.batch_name}</p>
          </div>
        </div>
        <div className="mt-3 grid gap-3 text-[12px] md:grid-cols-3">
          <div className="rounded border bg-gray-50 p-3">
            <p className="text-[11px] text-gray-600">Manual review</p>
            <p className="mt-1">
              {comparisonDeltas.manual_review_count_before ?? "n/a"} baseline /{" "}
              {comparisonDeltas.manual_review_count_after ?? "n/a"} enriched
            </p>
          </div>
          <div className="rounded border bg-gray-50 p-3">
            <p className="text-[11px] text-gray-600">Confidence</p>
            <p className="mt-1">Average delta: {comparisonDeltas.confidence_average_delta ?? "n/a"}</p>
            <p className="mt-1">Median delta: {comparisonDeltas.confidence_median_delta ?? "n/a"}</p>
          </div>
          <div className="rounded border bg-gray-50 p-3">
            <p className="text-[11px] text-gray-600">Weak evidence</p>
            <p className="mt-1">
              {comparisonDeltas.weak_evidence_count_before ?? "n/a"} baseline /{" "}
              {comparisonDeltas.weak_evidence_count_after ?? "n/a"} enriched
            </p>
          </div>
        </div>
        <div className="mt-3 grid gap-3 text-[12px] md:grid-cols-2">
          <div className="rounded border bg-gray-50 p-3">
            <p className="font-semibold">Effectiveness interpretation</p>
            <p className="mt-1 text-gray-700">
              {(comparisonState.rule_based_interpretations || [])[0] || "No comparison has been inferred yet."}
            </p>
          </div>
          <div className="rounded border bg-gray-50 p-3">
            <p className="font-semibold">Advisory recommendation</p>
            <p className="mt-1 text-gray-700">
              {(comparisonState.advisory_recommendations || [])[0] || "Use explicit comparison CLI inputs for evaluation."}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded border border-zinc-300 bg-[var(--admin-surface)] p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-600">Paired evaluation</p>
            <h2 className="mt-1 text-base font-semibold">
              {pairedEvaluationState.experiment_available ? pairedEvaluationState.experiment_name : "No paired experiment"}
            </h2>
            <p className="mt-1 text-[12px] text-gray-700">
              {pairedEvaluationState.recommendation || "Prepare a paired experiment to compare baseline vs enriched input."}
            </p>
          </div>
          <div className="text-[11px] text-gray-600">
            <p>Status: {pairedEvaluationState.status || "no-experiment-context"}</p>
            <p>Comparison ready: {pairedEvaluationState.comparison_ready ? "yes" : "no"}</p>
          </div>
        </div>
        <div className="mt-3 grid gap-3 text-[12px] md:grid-cols-3">
          <div className="rounded border bg-gray-50 p-3">
            <p className="text-[11px] text-gray-600">Baseline</p>
            <p className="mt-1">Batch status: {pairedBaselineStatus.batch_status || "not_started"}</p>
            <p className="mt-1">Review: {pairedBaselineStatus.review_exists ? "ready" : "missing"}</p>
            <p className="mt-1">Mode: {pairedEvaluationState.prompt_input_modes?.baseline || "baseline"}</p>
          </div>
          <div className="rounded border bg-gray-50 p-3">
            <p className="text-[11px] text-gray-600">Enriched</p>
            <p className="mt-1">Batch status: {pairedEnrichedStatus.batch_status || "not_started"}</p>
            <p className="mt-1">Review: {pairedEnrichedStatus.review_exists ? "ready" : "missing"}</p>
            <p className="mt-1">Mode: {pairedEvaluationState.prompt_input_modes?.enriched || "enriched"}</p>
          </div>
          <div className="rounded border bg-gray-50 p-3">
            <p className="text-[11px] text-gray-600">Versions</p>
            <p className="mt-1">Baseline: {pairedEvaluationState.packing_versions?.baseline || "baseline-thin-v1"}</p>
            <p className="mt-1">Enriched: {pairedEvaluationState.packing_versions?.enriched || "n/a"}</p>
            <p className="mt-1 break-all text-[11px]">{pairedEvaluationState.comparison_artifact || "No comparison artifact"}</p>
          </div>
        </div>
      </section>

      <section className="rounded border border-zinc-300 bg-[var(--admin-surface)] p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-600">Manual-review focus</p>
            <h2 className="mt-1 text-base font-semibold">
              {manualReviewCounts.total || 0} item(s) need review
            </h2>
            <p className="mt-1 text-[12px] text-gray-700">
              {manualReviewCounts.unresolved || 0} unresolved • {manualReviewCounts.schema_blocked || 0} schema blocked •{" "}
              {manualReviewCounts.human_judgment || 0} need operator judgment
            </p>
            {manualReviewCounts.by_readiness ? (
              <p className="mt-1 text-[11px] text-gray-600">
                Readiness:{" "}
                {Object.entries(manualReviewCounts.by_readiness)
                  .map(([label, count]) => `${label}: ${count}`)
                  .join(" • ")}
              </p>
            ) : null}
          </div>
          <a href="#review-items" className="rounded border px-3 py-1.5 text-[12px] font-medium text-[var(--admin-text)]">
            Jump to review table
          </a>
        </div>
        {Object.keys(manualReviewCounts.by_reason || {}).length ? (
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            {Object.entries(manualReviewCounts.by_reason).map(([reason, count]) => (
              <span key={reason} className="rounded border bg-gray-50 px-2 py-0.5">
                {reason}: {count}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-[12px] text-gray-600">No manual-review focus items are currently flagged.</p>
        )}
        {manualReviewItems.length ? (
          <div className="mt-3 overflow-x-auto rounded border border-zinc-200">
            <table className="min-w-full text-[12px]">
              <thead className="bg-zinc-100 text-left text-[11px] uppercase tracking-wide text-zinc-600">
                <tr>
                  <th className="border-b border-zinc-200 px-3 py-2">Item</th>
                  <th className="border-b border-zinc-200 px-3 py-2">Reason</th>
                  <th className="border-b border-zinc-200 px-3 py-2">Confidence</th>
                  <th className="border-b border-zinc-200 px-3 py-2">Decision support</th>
                </tr>
              </thead>
              <tbody>
                {manualReviewItems.slice(0, 8).map((item) => (
                  <tr key={item.item_id} className="align-top odd:bg-[var(--admin-surface)] even:bg-zinc-50/50">
                    <td className="border-b border-zinc-200 px-3 py-2">
                      <div className="font-mono text-[11px] text-zinc-500">{item.item_id}</div>
                      <div className="font-medium">{item.title || item.entity_id}</div>
                      <div className="mt-1 text-[11px] text-zinc-700">
                        {item.decision_support_summary || item.summary || "No summary attached."}
                      </div>
                    </td>
                    <td className="border-b border-zinc-200 px-3 py-2">
                      <div className="font-semibold">{item.reason_label}</div>
                      <div className="mt-1 text-[11px] text-zinc-700">{item.decision_readiness_label}</div>
                      <div className="mt-1 text-[11px] text-zinc-600">
                        {(item.reason_labels || []).join(", ")}
                      </div>
                    </td>
                    <td className="border-b border-zinc-200 px-3 py-2">
                      <div>{Number(item.confidence || 0).toFixed(2)}</div>
                      <div className="mt-1 text-[11px] text-zinc-600">{item.confidence_bucket}</div>
                      <div className="mt-1 text-[11px] text-zinc-600">
                        {item.unresolved ? "unresolved" : `operator: ${item.operator_action}`}
                      </div>
                    </td>
                    <td className="border-b border-zinc-200 px-3 py-2">
                      <div>{item.operator_hint}</div>
                      <div className="mt-1 text-[11px] text-zinc-600">
                        {item.blocked_by_malformed_output ? "Blocked by validation output" : "Needs human judgment"}
                      </div>
                      <div className="mt-1 text-[11px] text-zinc-600">
                        Checklist: {(item.decision_checklist || []).length}
                        {item.primary_decision_check ? ` • ${item.primary_decision_check}` : ""}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="rounded border border-zinc-300 bg-[var(--admin-surface)] p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-600">Review calibration</p>
            <h2 className="mt-1 text-base font-semibold">
              {calibrationState.reviewed_item_count || 0} reviewed •{" "}
              {calibrationState.manual_review_counts?.total_manual_review_items || 0} manual review
            </h2>
            <p className="mt-1 text-[12px] text-gray-700">
              Low confidence: {Math.round((calibrationSignals.percent_low_confidence || 0) * 100)}% • Weak evidence:{" "}
              {Math.round((calibrationSignals.percent_weak_evidence || 0) * 100)}% • Manual review:{" "}
              {Math.round((calibrationSignals.percent_manual_review || 0) * 100)}%
            </p>
          </div>
          <div className="text-[11px] text-gray-600">
            <p>Validation valid: {calibrationState.validation?.valid_items ?? "n/a"}</p>
            <p>Malformed: {calibrationState.validation?.malformed_items ?? "n/a"}</p>
          </div>
        </div>
        <div className="mt-3 grid gap-3 text-[12px] md:grid-cols-3">
          <div className="rounded border bg-gray-50 p-3">
            <p className="text-[11px] text-gray-600">Confidence buckets</p>
            {Object.entries(calibrationState.confidence_bucket_counts || {}).map(([bucket, count]) => (
              <p key={bucket} className="mt-1">
                {bucket}: {count}
              </p>
            ))}
          </div>
          <div className="rounded border bg-gray-50 p-3">
            <p className="text-[11px] text-gray-600">Top reasons</p>
            {Object.entries(calibrationState.reason_label_counts || {})
              .slice(0, 4)
              .map(([reason, count]) => (
                <p key={reason} className="mt-1">
                  {reason}: {count}
                </p>
              ))}
            {Object.keys(calibrationState.reason_label_counts || {}).length === 0 ? <p className="mt-1">None</p> : null}
          </div>
          <div className="rounded border bg-gray-50 p-3">
            <p className="text-[11px] text-gray-600">Decision readiness</p>
            {Object.entries(calibrationState.decision_readiness_label_counts || {}).map(([label, count]) => (
              <p key={label} className="mt-1">
                {label}: {count}
              </p>
            ))}
            {Object.keys(calibrationState.decision_readiness_label_counts || {}).length === 0 ? <p className="mt-1">None</p> : null}
          </div>
        </div>
        {(calibrationState.rule_based_interpretations || []).length ? (
          <div className="mt-3 rounded border bg-gray-50 p-3 text-[12px] text-gray-700">
            <p className="font-semibold">Calibration interpretation</p>
            <p className="mt-1">{calibrationState.rule_based_interpretations[0]}</p>
          </div>
        ) : null}
        {(calibrationState.advisory_recommendations || []).length ? (
          <div className="mt-3 rounded border bg-gray-50 p-3 text-[12px] text-gray-700">
            <p className="font-semibold">Advisory recommendation</p>
            <p className="mt-1">{calibrationState.advisory_recommendations[0]}</p>
          </div>
        ) : null}
      </section>

      <section className="rounded border border-zinc-300 bg-[var(--admin-surface)] p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-600">Threshold simulation sandbox</p>
            <h2 className="mt-1 text-base font-semibold">
              {simulationState.live_profile_name || "strict-current"} to{" "}
              {simulationState.selected_preset || "slightly-relaxed"}
            </h2>
            <p className="mt-1 text-[12px] text-gray-700">
              Manual review: {simulationState.current_manual_review_count || 0} current /{" "}
              {simulationState.simulated_manual_review_count || 0} simulated • Promoted:{" "}
              {simulationState.items_newly_promoted_to_finalize_safe || 0}
            </p>
          </div>
          <div className="text-[11px] text-gray-600">
            <p>Finalize-safe current: {simulationState.current_finalize_safe_count || 0}</p>
            <p>Finalize-safe simulated: {simulationState.simulated_finalize_safe_count || 0}</p>
          </div>
        </div>
        <div className="mt-3 grid gap-3 text-[12px] md:grid-cols-3">
          <div className="rounded border bg-gray-50 p-3">
            <p className="text-[11px] text-gray-600">Still blocked</p>
            <p className="mt-1">Evidence/readiness: {simulationState.items_still_blocked_by_evidence_readiness || 0}</p>
            <p className="mt-1">Flags: {simulationState.items_still_blocked_by_flags || 0}</p>
            <p className="mt-1">Schema: {simulationState.items_still_blocked_by_schema || 0}</p>
          </div>
          <div className="rounded border bg-gray-50 p-3">
            <p className="text-[11px] text-gray-600">Top remaining reasons</p>
            {Object.entries(simulationState.top_remaining_reason_counts || {})
              .slice(0, 4)
              .map(([reason, count]) => (
                <p key={reason} className="mt-1">
                  {reason}: {count}
                </p>
              ))}
            {Object.keys(simulationState.top_remaining_reason_counts || {}).length === 0 ? <p className="mt-1">None</p> : null}
          </div>
          <div className="rounded border bg-gray-50 p-3">
            <p className="text-[11px] text-gray-600">Preset thresholds</p>
            <p className="mt-1">
              Auto approve: {simulationState.simulation_profile?.confidence_auto_approve_threshold ?? "n/a"}
            </p>
            <p className="mt-1">
              Manual floor: {simulationState.simulation_profile?.confidence_manual_review_floor ?? "n/a"}
            </p>
          </div>
        </div>
        {(simulationState.rule_based_interpretations || []).length ? (
          <div className="mt-3 rounded border bg-gray-50 p-3 text-[12px] text-gray-700">
            <p className="font-semibold">Simulation interpretation</p>
            <p className="mt-1">{simulationState.rule_based_interpretations[0]}</p>
          </div>
        ) : null}
        {(simulationState.advisory_recommendations || []).length ? (
          <div className="mt-3 rounded border bg-gray-50 p-3 text-[12px] text-gray-700">
            <p className="font-semibold">Advisory recommendation</p>
            <p className="mt-1">{simulationState.advisory_recommendations[0]}</p>
          </div>
        ) : null}
      </section>

      <section id="review-actions" className="rounded border border-zinc-300 bg-[var(--admin-surface)] p-4 shadow-sm space-y-3">
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
              className="rounded border border-[var(--admin-line-strong)] bg-[var(--admin-surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--admin-text)] disabled:cursor-not-allowed disabled:bg-[var(--admin-surface-soft)] disabled:text-[var(--admin-text-muted)]"
            >
              Save Decisions
            </button>
            <button
              type="button"
              onClick={finalize}
              disabled={isPending || !finalizePermission.allowed}
              className="rounded border border-[var(--admin-link)] bg-[var(--admin-link)] px-3 py-1.5 text-[12px] font-medium text-[var(--background)] disabled:cursor-not-allowed disabled:border-[var(--admin-line-strong)] disabled:bg-[var(--admin-line-strong)] disabled:text-[var(--admin-text-muted)]"
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
        <div id="workflow-blockers" className="rounded border border-zinc-300 bg-[var(--admin-surface)] p-4 shadow-sm">
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

        <div id="artifact-state" className="rounded border border-zinc-300 bg-[var(--admin-surface)] p-4 shadow-sm">
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

      <section id="review-items" className="rounded border border-zinc-300 bg-[var(--admin-surface)] p-4 shadow-sm">
        <div className="mb-3">
          <h2 className="text-base font-semibold">Manual review queue</h2>
          <p className="mt-1 text-[12px] text-gray-600">
            Only borderline items stay here. AI-resolved approvals and rejections are kept out of the operator table.
          </p>
        </div>
        {items.length ? (
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
                <tr key={item.slug} className="align-top odd:bg-[var(--admin-surface)] even:bg-zinc-50/50">
                  <td className="border-b border-zinc-200 px-3 py-2">
                    <div className="font-mono text-[11px] text-zinc-500">{item.slug}</div>
                    <div className="font-medium">{item.title}</div>
                    {item.impact_status === "impact_pending" ? (
                      <span className="mt-1 inline-flex rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-950">
                        Impact Pending
                      </span>
                    ) : null}
                    <div className="mt-1 text-[11px] text-zinc-700">{item.attention_summary}</div>
                  </td>
                  <td className="border-b border-zinc-200 px-3 py-2 text-[11px] text-zinc-600">
                    <div>{item.review_priority} ({item.review_priority_score})</div>
                    <div className="mt-1">{item.suggested_batch}</div>
                    <div className="mt-1">AI: {item.ai_record_action_suggestion || "Unavailable"}</div>
                    {item.ai_recommended_action ? (
                      <div className="mt-1">Recommended: {item.ai_recommended_action}</div>
                    ) : null}
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
                    <details className="rounded border bg-[var(--admin-surface)] p-2">
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
        ) : (
          <p className="text-[12px] text-gray-600">No borderline items are waiting for manual review in this batch.</p>
        )}
      </section>
    </div>
  );
}
