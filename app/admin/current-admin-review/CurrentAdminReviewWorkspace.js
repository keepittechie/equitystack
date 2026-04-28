"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { readAdminJsonResponse } from "@/app/admin/components/readAdminJsonResponse";
import OperatorActionButton from "@/app/admin/components/OperatorActionButton";

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

const SECTION_CLASS = "rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] p-4 text-[var(--admin-text)] shadow-sm";
const CARD_CLASS = "rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] p-3 text-[var(--admin-text)] shadow-sm";
const PANEL_CLASS = "rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-3 text-[var(--admin-text)]";
const WARNING_SECTION_CLASS = "rounded border border-[var(--admin-warning-line)] bg-[var(--admin-warning-surface)] p-4 text-[var(--admin-text)] shadow-sm";
const WARNING_PANEL_CLASS = "rounded border border-[var(--admin-warning-line)] bg-[var(--admin-warning-surface)] p-3 text-[12px] text-[var(--admin-text)]";
const LABEL_CLASS = "text-[11px] text-[var(--admin-text-muted)]";
const TABLE_WRAPPER_CLASS = "overflow-x-auto rounded border border-[var(--admin-line)]";
const TABLE_HEAD_CLASS = "bg-[var(--admin-surface-muted)] text-left text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]";
const TABLE_ROW_CLASS = "align-top odd:bg-[var(--admin-surface)] even:bg-[var(--admin-surface-soft)]";

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
  const editableManualReviewCount = manualReviewCounts.total || workspace.counts.total_items || 0;
  const deepReviewInput = batch?.paths?.normalized
    ? { input: batch.paths.normalized }
    : batch?.batch_name
      ? { batchName: batch.batch_name }
      : {};
  const deepReviewAction = {
    id: "currentAdmin.deepReview",
    title: "Current-Admin Deep AI Review",
    workflowFamily: "current-admin",
  };
  const deepReviewRecommended =
    pairedEvaluationState.status === "comparison_pending" ||
    pairedEvaluationState.status === "baseline_ready" ||
    pairedEvaluationState.status === "enriched_ready" ||
    (typeof pairedEvaluationState.recommendation === "string" &&
      pairedEvaluationState.recommendation.toLowerCase().includes("recommend"));

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
      "Decisions saved. Sync the decision log when the manual-review slice is ready to refresh queue state."
    );
  }

  function syncDecisionLog() {
    runAction(
      "/api/admin/current-admin/finalize",
      {
        reviewPath: batch?.paths?.review,
        decisionItems: items,
      },
      "Decision log synchronized. The manual-review queue was refreshed for the next guarded pre-commit step."
    );
  }

  if (!batch) {
    return (
      <section className={SECTION_CLASS}>
        <p className="text-[var(--admin-text)]">No current-admin review artifact is available yet.</p>
        <p className="mt-2 text-[12px] text-[var(--admin-text-soft)]">
          Run `current-admin run` first so the normalized batch, AI review, and manual-review queue artifacts exist.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {provenance.provenance_incomplete ? (
        <section className={WARNING_SECTION_CLASS}>
          <p className="text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">Provenance incomplete</p>
          <p className="mt-2 text-[12px] text-[var(--admin-text)]">
            {provenance.summary}
          </p>
          <p className="mt-2 text-[11px] text-[var(--admin-text-soft)]">
            Import batch detected: {provenance.import_batch_detected ? "yes" : "no"} • Artifact chain missing:{" "}
            {provenance.artifact_chain_missing ? "yes" : "no"} • Matched DB rows:{" "}
            {provenance.matched_record_count || 0}
          </p>
          {(provenance.missing_artifacts || []).length ? (
            <p className="mt-2 text-[11px] text-[var(--admin-text-soft)]">
              Missing artifacts: {provenance.missing_artifacts.join(", ")}
            </p>
          ) : null}
          {(provenance.matched_slugs_sample || []).length ? (
            <p className="mt-1 text-[11px] text-[var(--admin-text-soft)]">
              Sample DB slugs: {provenance.matched_slugs_sample.join(", ")}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="grid gap-3 lg:grid-cols-5">
        <div className={CARD_CLASS}>
          <p className={LABEL_CLASS}>Batch</p>
          <p className="mt-1 text-base font-semibold text-[var(--admin-text)]">{batch.batch_name}</p>
          <p className="mt-1 text-[11px] text-[var(--admin-text-muted)]">Stage: {batch.stage}</p>
        </div>
        <div className={CARD_CLASS}>
          <p className={LABEL_CLASS}>Model / mode</p>
          <p className="mt-1 text-base font-semibold text-[var(--admin-text)]">
            {batch.model || "unknown"} / {batch.review_mode || "standard"}
          </p>
        </div>
        <div className={CARD_CLASS}>
          <p className={LABEL_CLASS}>Editable manual-review rows</p>
          <p className="mt-1 text-base font-semibold text-[var(--admin-text)]">{editableManualReviewCount}</p>
          <p className="mt-1 text-[11px] text-[var(--admin-text-muted)]">
            Approval-style decisions: {workspace.counts.approval_style_decisions} • Pending review:{" "}
            {workspace.counts.pending_review} • Held back: {workspace.counts.held_for_followup}
          </p>
        </div>
        <div className={CARD_CLASS}>
          <p className={LABEL_CLASS}>Queue / apply readiness</p>
          <p className="mt-1 text-base font-semibold text-[var(--admin-text)]">
            {importReadiness.readiness_label || "Review In Progress"}
          </p>
          <p className="mt-1 text-[11px] text-[var(--admin-text-muted)]">
            Auto-approved: {importReadiness.auto_approved_item_count || 0} • In manual queue:{" "}
            {importReadiness.queue_item_count || 0} • Auto-rejected:{" "}
            {importReadiness.auto_rejected_item_count || 0}
          </p>
        </div>
        <div className={CARD_CLASS}>
          <p className={LABEL_CLASS}>Next recommended action</p>
          <p className="mt-1 font-semibold text-[var(--admin-text)]">{workspace.next_recommended_action.next_step_label}</p>
        </div>
      </section>

      <section className={SECTION_CLASS}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">Pipeline path</p>
            <h2 className="mt-1 text-base font-semibold text-[var(--admin-text)]">AI-first review, then guarded apply</h2>
            <p className="mt-1 max-w-5xl text-[12px] text-[var(--admin-text-soft)]">
              `current-admin run` prepares the batch, normalizes it, runs the standard AI review, and splits the queue.
              Existing tracked rows with no material change or only source-refresh updates should auto-resolve before
              they reach this page. This page only edits the remaining manual-review slice. Deep review is optional
              when the standard pass still leaves ambiguity before decision-log sync, pre-commit, apply dry-run,
              final apply, and validation.
            </p>
          </div>
          <div className={PANEL_CLASS}>
            <p className={LABEL_CLASS}>Deep review</p>
            <p className="mt-1 font-semibold text-[var(--admin-text)]">
              {deepReviewRecommended ? "Recommended for this batch" : "Available when ambiguity remains"}
            </p>
            <p className="mt-1 text-[11px] text-[var(--admin-text-soft)]">
              {pairedEvaluationState.recommendation || "Paired baseline vs enriched AI review stays read-only and feeds operator judgment."}
            </p>
          </div>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-5 text-[12px]">
          <div className={PANEL_CLASS}>
            <p className={LABEL_CLASS}>1. Run</p>
            <p className="mt-1 font-semibold text-[var(--admin-text)]">Discovery, normalize, AI review</p>
          </div>
          <div className={PANEL_CLASS}>
            <p className={LABEL_CLASS}>2. Manual review</p>
            <p className="mt-1 font-semibold text-[var(--admin-text)]">Edit only borderline rows</p>
          </div>
          <div className={PANEL_CLASS}>
            <p className={LABEL_CLASS}>3. Deep review</p>
            <p className="mt-1 font-semibold text-[var(--admin-text)]">Optional paired AI pass</p>
          </div>
          <div className={PANEL_CLASS}>
            <p className={LABEL_CLASS}>4. Apply dry-run</p>
            <p className="mt-1 font-semibold text-[var(--admin-text)]">Pre-commit and import preview</p>
          </div>
          <div className={PANEL_CLASS}>
            <p className={LABEL_CLASS}>5. Final apply</p>
            <p className="mt-1 font-semibold text-[var(--admin-text)]">Explicit `--apply --yes` then validation</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-start gap-3">
          <OperatorActionButton
            action={deepReviewAction}
            label="Run Deep AI Review"
            input={deepReviewInput}
            tone="default"
            helperText="Read-only paired baseline vs enriched review for ambiguous or high-risk batches."
          />
          <div className="text-[11px] text-[var(--admin-text-muted)]">
            <p>Normalized artifact</p>
            <p className="mt-1 break-all font-mono text-[var(--admin-text-soft)]">{batch.paths.normalized || "Unavailable"}</p>
          </div>
        </div>
      </section>

      {queuePromotionState.promoted ? (
        <section className={WARNING_SECTION_CLASS}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">AI-first queue split</p>
              <h2 className="mt-1 text-base font-semibold text-[var(--admin-text)]">
                {queuePromotionState.status_label || "Promoted Review Queue"}
              </h2>
              <p className="mt-1 text-[12px] text-[var(--admin-text-soft)]">
                {queuePromotionState.operator_hint}
              </p>
            </div>
            <span className="rounded-full border border-[var(--admin-warning-line)] bg-[var(--admin-surface)] px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-text)]">
              AI-first
            </span>
          </div>
          <div className="mt-3 grid gap-2 text-[12px] text-[var(--admin-text)] md:grid-cols-3">
            <p>Auto-approved: {queuePromotionState.auto_approved_item_count || queuePromotionState.approved_item_count || 0}</p>
            <p>Manual review queue: {queuePromotionState.manual_review_item_count || 0}</p>
            <p>Auto-rejected: {queuePromotionState.auto_rejected_item_count || 0}</p>
          </div>
          <div className="mt-2 grid gap-2 text-[12px] text-[var(--admin-text)] md:grid-cols-2">
            <p>Pending impact: {queuePromotionState.pending_impact_item_count || 0}</p>
            <p>Reviewed: {queuePromotionState.reviewed_item_count || 0}</p>
          </div>
          <p className="mt-2 text-[11px] text-[var(--admin-text-soft)]">
            Source review: {queuePromotionState.source_review_path || "unknown"}
          </p>
        </section>
      ) : null}

      {batchState ? (
        <section className={SECTION_CLASS}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">OpenAI review readiness</p>
              <h2 className="mt-1 text-base font-semibold text-[var(--admin-text)]">{batchState.status_label}</h2>
              <p className="mt-1 text-[12px] text-[var(--admin-text-soft)]">{batchState.operator_hint}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] px-2 py-0.5 text-[var(--admin-text)]">
                decision sync: {batchState.finalize_safe ? "safe" : "blocked"}
              </span>
              <span className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] px-2 py-0.5 text-[var(--admin-text)]">
                apply: {batchState.apply_safe ? "safe" : "blocked"}
              </span>
            </div>
          </div>
          <div className="mt-3 grid gap-3 text-[12px] md:grid-cols-3">
            <div className={PANEL_CLASS}>
              <p className={LABEL_CLASS}>Lifecycle</p>
              <p className="mt-1 font-semibold text-[var(--admin-text)]">{batchState.lifecycle_status || "unknown"}</p>
              <p className="mt-1 break-all font-mono text-[11px] text-[var(--admin-text-soft)]">
                {batchState.batch_id || "No Batch id"}
              </p>
              <p className="mt-1 text-[11px] text-[var(--admin-text-muted)]">Model: {batchState.model || "unknown"}</p>
            </div>
            <div className={PANEL_CLASS}>
              <p className={LABEL_CLASS}>Artifacts</p>
              <p className="mt-1">Reviewed: {batchState.reviewed_count || 0}</p>
              <p className="mt-1">Output fetched: {batchState.output_ready ? "yes" : "no"}</p>
              <p className="mt-1">Error file present: {batchState.error_file_present ? "yes" : "no"}</p>
              <p className="mt-1">Review rebuilt: {batchState.review_artifact_rebuilt ? "yes" : "no"}</p>
            </div>
            <div className={PANEL_CLASS}>
              <p className={LABEL_CLASS}>Validation</p>
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
            <div className={WARNING_PANEL_CLASS}>
              <p className="font-semibold text-[var(--admin-text)]">Batch blockers</p>
              <div className="mt-2 space-y-1">
                {batchState.blocker_text.map((entry) => (
                  <p key={entry}>{entry}</p>
                ))}
              </div>
            </div>
          ) : null}
          {(batchState.warning_text || []).length ? (
            <div className={`${PANEL_CLASS} mt-3 text-[12px]`}>
              <p className="font-semibold text-[var(--admin-text)]">Batch warnings</p>
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
              <span key={reason} className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] px-2 py-0.5 text-[var(--admin-text)]">
                {reason}: {count}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-[12px] text-[var(--admin-text-soft)]">No manual-review focus items are currently flagged.</p>
        )}
        {manualReviewItems.length ? (
          <div className={`mt-3 ${TABLE_WRAPPER_CLASS}`}>
            <table className="min-w-full text-[12px]">
              <thead className={TABLE_HEAD_CLASS}>
                <tr>
                  <th className="border-b border-[var(--admin-line)] px-3 py-2">Item</th>
                  <th className="border-b border-[var(--admin-line)] px-3 py-2">Reason</th>
                  <th className="border-b border-[var(--admin-line)] px-3 py-2">Confidence</th>
                  <th className="border-b border-[var(--admin-line)] px-3 py-2">Decision support</th>
                </tr>
              </thead>
              <tbody>
                {manualReviewItems.slice(0, 8).map((item) => (
                  <tr key={item.item_id} className={TABLE_ROW_CLASS}>
                    <td className="border-b border-[var(--admin-line)] px-3 py-2">
                      <div className="font-mono text-[11px] text-[var(--admin-text-muted)]">{item.item_id}</div>
                      <div className="font-medium text-[var(--admin-text)]">{item.title || item.entity_id}</div>
                      <div className="mt-1 text-[11px] text-[var(--admin-text-soft)]">
                        {item.decision_support_summary || item.summary || "No summary attached."}
                      </div>
                    </td>
                    <td className="border-b border-[var(--admin-line)] px-3 py-2">
                      <div className="font-semibold text-[var(--admin-text)]">{item.reason_label}</div>
                      <div className="mt-1 text-[11px] text-[var(--admin-text-soft)]">{item.decision_readiness_label}</div>
                      <div className="mt-1 text-[11px] text-[var(--admin-text-muted)]">
                        {(item.reason_labels || []).join(", ")}
                      </div>
                    </td>
                    <td className="border-b border-[var(--admin-line)] px-3 py-2">
                      <div>{Number(item.confidence || 0).toFixed(2)}</div>
                      <div className="mt-1 text-[11px] text-[var(--admin-text-muted)]">{item.confidence_bucket}</div>
                      <div className="mt-1 text-[11px] text-[var(--admin-text-muted)]">
                        {item.unresolved ? "unresolved" : `operator: ${item.operator_action}`}
                      </div>
                    </td>
                    <td className="border-b border-[var(--admin-line)] px-3 py-2">
                      <div>{item.operator_hint}</div>
                      <div className="mt-1 text-[11px] text-[var(--admin-text-muted)]">
                        {item.blocked_by_malformed_output ? "Blocked by validation output" : "Needs human judgment"}
                      </div>
                      <div className="mt-1 text-[11px] text-[var(--admin-text-muted)]">
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
              {simulationState.simulated_manual_review_count || 0} simulated • Promoted to sync-ready:{" "}
              {simulationState.items_newly_promoted_to_finalize_safe || 0}
            </p>
          </div>
          <div className="text-[11px] text-gray-600">
            <p>Decision-sync safe current: {simulationState.current_finalize_safe_count || 0}</p>
            <p>Decision-sync safe simulated: {simulationState.simulated_finalize_safe_count || 0}</p>
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

      <section id="review-actions" className={`${SECTION_CLASS} space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={LABEL_CLASS}>Review artifact</p>
            <p className="break-all font-mono text-[11px] text-[var(--admin-text)]">{batch.paths.review}</p>
            <p className={`mt-2 ${LABEL_CLASS}`}>Decision file</p>
            <p className="break-all font-mono text-[11px] text-[var(--admin-text)]">{batch.paths.decision_template}</p>
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
              onClick={syncDecisionLog}
              disabled={isPending || !finalizePermission.allowed}
              className="rounded border border-[var(--admin-link)] bg-[var(--admin-link)] px-3 py-1.5 text-[12px] font-medium text-[var(--background)] disabled:cursor-not-allowed disabled:border-[var(--admin-line-strong)] disabled:bg-[var(--admin-line-strong)] disabled:text-[var(--admin-text-muted)]"
            >
              Sync Decision Log
            </button>
          </div>
        </div>
        <p className="text-[12px] text-[var(--admin-text-soft)]">
          Saving writes the decision file only. Sync Decision Log runs the canonical Python review-finalize step,
          refreshes the append-only decision log, and re-synchronizes manual-review queue state before pre-commit.
        </p>
        <p className="text-[12px] text-[var(--admin-text-soft)]">
          `approve_as_is` and `approve_with_changes` only resolve the editable manual-review slice.
          Import eligibility still comes from the canonical queue plus pre-commit and import dry-run.
        </p>
        {!finalizePermission.allowed ? (
          <div className={WARNING_PANEL_CLASS}>
            <p className="font-semibold text-[var(--admin-text)]">Decision-log sync is blocked</p>
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
                ? "border-[var(--admin-warning-line)] bg-[var(--admin-warning-surface)] text-[var(--admin-text)]"
                : "border-[var(--admin-line)] bg-[var(--admin-surface-muted)] text-[var(--admin-text)]"
            }`}
          >
            <p className="font-semibold">Import readiness</p>
            <p className="mt-2">{importReadiness.readiness_explanation}</p>
          </div>
        ) : null}
        {message ? <p className="text-[12px] text-[var(--admin-text-soft)]">{message}</p> : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div id="workflow-blockers" className={SECTION_CLASS}>
          <h2 className="text-base font-semibold text-[var(--admin-text)]">Workflow blockers</h2>
          <p className="mt-1 text-[12px] text-[var(--admin-text-soft)]">
            These are the current reasons the canonical pipeline cannot advance automatically.
          </p>
          <div className="mt-3 space-y-2 text-[12px]">
            {(workspace.blockers || []).length || importReadiness.readiness_status === "blocked" ? (
              <>
                {importReadiness.readiness_status === "blocked" ? (
                  <div className={PANEL_CLASS}>
                    {importReadiness.readiness_explanation}
                  </div>
                ) : null}
                {(workspace.blockers || []).map((blocker) => (
                  <div key={blocker} className={PANEL_CLASS}>
                    {blocker}
                  </div>
                ))}
              </>
            ) : (
              <p className="text-[var(--admin-text-soft)]">No active blockers are recorded for the current batch.</p>
            )}
          </div>
        </div>

        <div id="artifact-state" className={SECTION_CLASS}>
          <h2 className="text-base font-semibold text-[var(--admin-text)]">Artifact state</h2>
          <p className="mt-1 text-[12px] text-[var(--admin-text-soft)]">
            The admin workflow follows these canonical files under `python/reports/current_admin/`.
          </p>
          <div className="mt-3 space-y-2 text-[12px]">
            {Object.entries(artifactStatus).map(([key, artifact]) => (
              <div key={key} className={PANEL_CLASS}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold text-[var(--admin-text)]">{artifact.label}</p>
                  <span className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] px-2 py-0.5 text-[11px] uppercase tracking-wide text-[var(--admin-text-soft)]">
                    {artifact.exists ? "present" : "missing"}
                  </span>
                </div>
                <p className="mt-1 break-all font-mono text-[11px] text-[var(--admin-text-soft)]">{artifact.path || "Unavailable"}</p>
                {artifact.generated_at ? (
                  <p className="mt-1 text-[11px] text-[var(--admin-text-muted)]">Updated: {artifact.generated_at}</p>
                ) : null}
                {artifact.summary ? (
                  <p className="mt-1 text-[11px] text-[var(--admin-text-muted)]">Summary: {artifact.summary}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="review-items" className={SECTION_CLASS}>
        <div className="mb-3">
          <h2 className="text-base font-semibold text-[var(--admin-text)]">Manual review slice</h2>
          <p className="mt-1 text-[12px] text-[var(--admin-text-soft)]">
            Only borderline items stay here. AI-resolved approvals and rejections are kept out of the operator table.
          </p>
        </div>
        {items.length ? (
        <div className={TABLE_WRAPPER_CLASS}>
          <table className="min-w-full text-[12px]">
            <thead className={TABLE_HEAD_CLASS}>
              <tr>
                <th className="border-b border-[var(--admin-line)] px-3 py-2">Item</th>
                <th className="border-b border-[var(--admin-line)] px-3 py-2">Priority / AI</th>
                <th className="border-b border-[var(--admin-line)] px-3 py-2">Decision</th>
                <th className="border-b border-[var(--admin-line)] px-3 py-2">Inspect</th>
              </tr>
            </thead>
            <tbody>
              {(items || []).map((item) => (
                <tr key={item.slug} className={TABLE_ROW_CLASS}>
                  <td className="border-b border-[var(--admin-line)] px-3 py-2">
                    <div className="font-mono text-[11px] text-[var(--admin-text-muted)]">{item.slug}</div>
                    <div className="font-medium text-[var(--admin-text)]">{item.title}</div>
                    {item.impact_status === "impact_pending" ? (
                      <span className="mt-1 inline-flex rounded border border-[var(--admin-warning-line)] bg-[var(--admin-warning-surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--admin-text)]">
                        Impact Pending
                      </span>
                    ) : null}
                    <div className="mt-1 text-[11px] text-[var(--admin-text-soft)]">{item.attention_summary}</div>
                  </td>
                  <td className="border-b border-[var(--admin-line)] px-3 py-2 text-[11px] text-[var(--admin-text-muted)]">
                    <div>{item.review_priority} ({item.review_priority_score})</div>
                    <div className="mt-1">{item.suggested_batch}</div>
                    <div className="mt-1">AI: {item.ai_record_action_suggestion || "Unavailable"}</div>
                    {item.ai_recommended_action ? (
                      <div className="mt-1">Recommended: {item.ai_recommended_action}</div>
                    ) : null}
                    {item.operator_attention_needed ? (
                      <div className="mt-1 text-[var(--admin-text)]">attention needed</div>
                    ) : null}
                  </td>
                  <td className="border-b border-[var(--admin-line)] px-3 py-2">
                    <select
                      value={item.operator_action}
                      onChange={(event) => updateItem(item.slug, "operator_action", event.target.value)}
                      className="w-full min-w-[11rem] rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] px-2 py-1 text-[12px] text-[var(--admin-text)]"
                    >
                      {DECISION_OPTIONS.map((option) => (
                        <option key={option.value || "blank"} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border-b border-[var(--admin-line)] px-3 py-2">
                    <details className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] p-2">
                      <summary className="cursor-pointer text-[12px] font-medium text-[var(--admin-text)]">Inspect</summary>
                      <div className="mt-2 space-y-2 text-[11px] text-[var(--admin-text-soft)]">
                        <div>
                          <p className="font-medium text-[var(--admin-text)]">Suggested checks</p>
                          {(item.suggested_checks || []).length ? (
                            <ul className="mt-1 list-disc pl-4">
                              {item.suggested_checks.map((entry) => (
                                <li key={entry}>{entry}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-[var(--admin-text-muted)]">No extra checks were attached.</p>
                          )}
                        </div>
                        <label className="block">
                          <span className="block font-medium text-[var(--admin-text)]">Operator notes</span>
                          <textarea
                            value={item.operator_notes}
                            onChange={(event) => updateItem(item.slug, "operator_notes", event.target.value)}
                            className="mt-1 min-h-20 w-full rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] px-2 py-1.5 text-[12px] text-[var(--admin-text)]"
                          />
                        </label>
                        <label className="block">
                          <span className="block font-medium text-[var(--admin-text)]">Decision summary</span>
                          <textarea
                            value={item.final_decision_summary}
                            onChange={(event) => updateItem(item.slug, "final_decision_summary", event.target.value)}
                            className="mt-1 min-h-16 w-full rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] px-2 py-1.5 text-[12px] text-[var(--admin-text)]"
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
          <p className="text-[12px] text-[var(--admin-text-soft)]">No borderline items are waiting for manual review in this batch.</p>
        )}
      </section>
    </div>
  );
}
