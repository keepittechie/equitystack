import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "@/lib/db";

// Read-only artifact reader for the canonical Python current-admin pipeline.
// This service must not generate AI reviews, mutate DB state, or replace the
// file-driven workflow under python/reports/current_admin/.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const PYTHON_DIR = path.join(PROJECT_ROOT, "python");
const CURRENT_ADMIN_BATCHES_DIR = path.join(PYTHON_DIR, "data", "current_admin_batches");
const CURRENT_ADMIN_REPORTS_DIR = path.join(PROJECT_ROOT, "python", "reports", "current_admin");
const REVIEW_DECISIONS_DIR = path.join(CURRENT_ADMIN_REPORTS_DIR, "review_decisions");
const FEEDBACK_OUTPUT_DIR = path.join(CURRENT_ADMIN_REPORTS_DIR, "feedback");
const DEFAULT_FEEDBACK_OUTPUT_PATH = path.join(
  FEEDBACK_OUTPUT_DIR,
  "ai_feedback_summary.json"
);

const REVIEW_RISK_FORMULA = {
  scale: "0-10",
  advisory_only: true,
  high_meaning: "Higher review risk means the item is more ambiguous, conflict-heavy, or source-thin.",
  low_meaning: "Lower review risk means the item appears more stable and straightforward for review.",
  inputs: [
    "review_priority_score capped at 6",
    "has_material_conflict (+2)",
    "deep_review_recommended (+1)",
    "low confidence (+1)",
    "source warnings or evidence gaps (+1)",
  ],
};

const OPERATOR_FRICTION_FORMULA = {
  scale: "0-10",
  advisory_only: true,
  high_meaning: "Higher operator friction means more manual effort, hesitation, or disagreement is likely.",
  low_meaning: "Lower operator friction means the item should take less operator effort to move through review.",
  inputs: [
    "review_priority high (+2) / medium (+1)",
    "suggested_batch manual_review_focus (+2)",
    "operator_attention_needed (+1)",
    "has_material_conflict (+2)",
    "deep_review_recommended without deep review (+1)",
    "source warnings (+1)",
    "decision mismatch (+2 when available)",
    "operator_action in manual_review_required, needs_more_sources, defer, reject, escalate (+1 when available)",
  ],
};

const OPENAI_BATCH_VALIDATION_COUNT_KEYS = [
  "total_items",
  "valid_items",
  "malformed_items",
  "enum_errors",
  "missing_field_errors",
  "low_confidence_items",
  "unclear_classifications",
  "needs_manual_review_items",
  "insert_safe_items",
];

const OPENAI_BATCH_INCOMPLETE_STATUSES = new Set([
  "submitted",
  "validating",
  "in_progress",
  "finalizing",
  "cancelling",
]);

const OPENAI_BATCH_TERMINAL_STATUSES = new Set([
  "completed",
  "failed",
  "expired",
  "cancelled",
]);

const MANUAL_REVIEW_REASON_PRIORITY = {
  "schema/validation issue": 1,
  "conflicting sources": 2,
  "weak evidence": 3,
  "unclear classification": 4,
  "low confidence": 5,
  "manual review requested by model": 6,
  "ambiguous subject": 7,
  "date uncertain": 8,
};

const CURRENT_ADMIN_SIMULATION_PRESETS = {
  "strict-current": {
    confidence_auto_approve_threshold: 0.75,
    confidence_manual_review_floor: 0.55,
    allow_high_confidence_flagged_items_to_stay_blocked: true,
    treat_unclear_as_always_manual_review: true,
    treat_weak_evidence_as_always_manual_review: true,
    treat_conflicting_sources_as_always_manual_review: true,
    treat_date_uncertain_as_always_manual_review: true,
    treat_ambiguous_subject_as_always_manual_review: true,
    treat_model_manual_review_as_always_manual_review: true,
  },
  "slightly-relaxed": {
    confidence_auto_approve_threshold: 0.65,
    confidence_manual_review_floor: 0.5,
    allow_high_confidence_flagged_items_to_stay_blocked: true,
    treat_unclear_as_always_manual_review: true,
    treat_weak_evidence_as_always_manual_review: true,
    treat_conflicting_sources_as_always_manual_review: true,
    treat_date_uncertain_as_always_manual_review: true,
    treat_ambiguous_subject_as_always_manual_review: true,
    treat_model_manual_review_as_always_manual_review: true,
  },
};
const CURRENT_ADMIN_COMPARISON_BASELINE_MARKERS = [".baseline.", ".legacy.", ".thin.", ".pre-evidence-pack."];
const CURRENT_ADMIN_COMPARISON_ENRICHED_MARKERS = [".enriched.", ".evidence-pack.", ".post-evidence-pack."];

function toSafeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function hasDbConfig() {
  return ["DB_HOST", "DB_USER", "DB_NAME"].every(
    (key) => normalizeString(process.env[key])
  );
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeString(entry))
    .filter(Boolean);
}

function confidenceBucket(score) {
  if (score >= 0.8) return "high";
  if (score >= 0.55) return "medium";
  return "low";
}

function compareByGeneratedAtDesc(a, b) {
  return (new Date(b.generated_at || 0).getTime() || 0) - (new Date(a.generated_at || 0).getTime() || 0);
}

function average(values = []) {
  if (!values.length) {
    return null;
  }

  const sum = values.reduce((total, value) => total + value, 0);
  return Number((sum / values.length).toFixed(3));
}

function incrementCounter(bucket, key, amount = 1) {
  if (!key) {
    return;
  }

  bucket[key] = (bucket[key] || 0) + amount;
}

function sortCounter(bucket) {
  return Object.fromEntries(
    Object.entries(bucket).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  );
}

function summarizeByDate(entries, getDateKey, getCount = () => 1) {
  const bucket = {};

  for (const entry of entries) {
    const key = getDateKey(entry);
    if (!key) {
      continue;
    }

    incrementCounter(bucket, key, getCount(entry));
  }

  return Object.entries(bucket)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }));
}

function classifyLevelFromScore(score) {
  if (score >= 7) return "high";
  if (score >= 4) return "medium";
  return "low";
}

function buildRefinedReviewProfile(reviewItem = {}, decisionItem = null) {
  const suggestion =
    reviewItem?.suggestions ||
    decisionItem?.ai_suggestions_snapshot ||
    {};
  const reviewPriorityScore = Math.max(
    0,
    Math.min(10, toSafeNumber(reviewItem.review_priority_score, 0))
  );
  const hasMaterialConflict = Boolean(reviewItem.has_material_conflict);
  const deepReviewRecommended = Boolean(reviewItem.deep_review_recommended);
  const deepReviewRan = Boolean(reviewItem.deep_review_ran);
  const operatorAttentionNeeded = Boolean(reviewItem.operator_attention_needed);
  const confidenceScore = Math.max(
    0,
    Math.min(1, toSafeNumber(suggestion.confidence_score, 0.5))
  );
  const confidenceLevel =
    normalizeString(suggestion.confidence_level) ||
    confidenceBucket(confidenceScore);
  const sourceWarnings = [
    ...normalizeStringArray(suggestion.source_warnings),
    ...normalizeStringArray(suggestion.missing_source_warnings),
  ];
  const sourceWarningCount = new Set(sourceWarnings).size;
  const evidenceGapCount = normalizeStringArray(
    suggestion.evidence_needed_to_reduce_risk
  ).length;

  const reviewRiskScore = Math.min(
    10,
    Math.min(reviewPriorityScore, 6) +
      (hasMaterialConflict ? 2 : 0) +
      (deepReviewRecommended ? 1 : 0) +
      (confidenceLevel === "Low" || confidenceScore < 0.55 ? 1 : 0) +
      (sourceWarningCount > 0 || evidenceGapCount > 0 ? 1 : 0)
  );

  const operatorAction = normalizeString(decisionItem?.operator_action);
  const needsHeavyManualFollowup = [
    "manual_review_required",
    "needs_more_sources",
    "defer",
    "reject",
    "escalate",
  ].includes(operatorAction);

  const operatorFrictionScore = Math.min(
    10,
    (reviewItem.review_priority === "high"
      ? 2
      : reviewItem.review_priority === "medium"
        ? 1
        : 0) +
      (reviewItem.suggested_batch === "manual_review_focus" ? 2 : 0) +
      (operatorAttentionNeeded ? 1 : 0) +
      (hasMaterialConflict ? 2 : 0) +
      (deepReviewRecommended && !deepReviewRan ? 1 : 0) +
      (sourceWarningCount > 0 ? 1 : 0) +
      (decisionItem?.decision_alignment === "mismatch" ? 2 : 0) +
      (needsHeavyManualFollowup ? 1 : 0)
  );

  let sourceSufficiency = "sufficient";
  if (sourceWarnings.some((warning) => warning.startsWith("missing_"))) {
    sourceSufficiency = "missing";
  } else if (sourceWarningCount > 0 || evidenceGapCount > 0) {
    sourceSufficiency = "thin";
  }

  return {
    review_risk_score: reviewRiskScore,
    review_risk_level: classifyLevelFromScore(reviewRiskScore),
    operator_friction_score: operatorFrictionScore,
    operator_friction_level: classifyLevelFromScore(operatorFrictionScore),
    source_sufficiency: sourceSufficiency,
    conflict_risk: hasMaterialConflict ? "material" : reviewItem.conflict_fields?.length ? "elevated" : "low",
    confidence_band: confidenceLevel,
    attention_class: reviewItem.review_priority || classifyLevelFromScore(reviewPriorityScore),
    formulas: {
      review_risk_score: REVIEW_RISK_FORMULA,
      operator_friction_score: OPERATOR_FRICTION_FORMULA,
    },
  };
}

async function readJsonFile(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function statSafe(filePath) {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
}

async function readJsonFileOrNull(filePath) {
  if (!filePath) {
    return null;
  }

  try {
    return await readJsonFile(filePath);
  } catch {
    return null;
  }
}

function deriveOpenAIBatchArtifactPath(reviewPath, suffix) {
  const normalizedPath = normalizeString(reviewPath);
  if (!normalizedPath) {
    return null;
  }

  if (normalizedPath.endsWith(".ai-review.json")) {
    return `${normalizedPath.slice(0, -".ai-review.json".length)}.openai-batch.${suffix}`;
  }
  if (normalizedPath.endsWith(".json")) {
    return `${normalizedPath.slice(0, -".json".length)}.openai-batch.${suffix}`;
  }
  return `${normalizedPath}.openai-batch.${suffix}`;
}

function deriveCurrentAdminEvidencePackArtifactPath(reviewPath) {
  const normalizedPath = normalizeString(reviewPath);
  if (!normalizedPath) {
    return null;
  }
  if (normalizedPath.endsWith(".ai-review.json")) {
    return `${normalizedPath.slice(0, -".ai-review.json".length)}.evidence-pack.json`;
  }
  if (normalizedPath.endsWith(".json")) {
    return `${normalizedPath.slice(0, -".json".length)}.evidence-pack.json`;
  }
  return `${normalizedPath}.evidence-pack.json`;
}

function resolveOpenAIBatchPath(rawValue, referencePath, fallbackPath = null) {
  const value = normalizeString(rawValue);
  if (!value) {
    return fallbackPath;
  }

  if (path.isAbsolute(value)) {
    return value;
  }

  return path.resolve(path.dirname(referencePath), value);
}

function buildOpenAIBatchValidationCounts(validationPayload) {
  return Object.fromEntries(
    OPENAI_BATCH_VALIDATION_COUNT_KEYS.map((key) => [
      key,
      toSafeNumber(validationPayload?.[key], 0),
    ])
  );
}

function formatOpenAIBatchIssue(issue) {
  if (typeof issue === "string") {
    return issue;
  }
  return normalizeString(issue?.message) || normalizeString(issue?.fix) || normalizeString(issue?.type);
}

function buildOpenAIBatchOperatorGuidance({
  metadataPresent,
  status,
  outputReady,
  reviewArtifactRebuilt,
  validationCounts,
  blockingIssues,
  finalizeSafe,
  applySafe,
}) {
  if (!metadataPresent) {
    return {
      status_label: "Legacy / No Batch Metadata",
      recommended_next_action: "ready for manual review",
      operator_hint: "Ready for manual review",
    };
  }

  if (blockingIssues.length) {
    if (OPENAI_BATCH_INCOMPLETE_STATUSES.has(status) || status === "unknown") {
      return {
        status_label: "Batch In Progress",
        recommended_next_action: "poll batch",
        operator_hint: "Run batch poll",
      };
    }
    if (status === "completed" && !outputReady) {
      return {
        status_label: "Output Ready To Fetch",
        recommended_next_action: "fetch results",
        operator_hint: "Run batch fetch",
      };
    }
    if (outputReady && !reviewArtifactRebuilt) {
      return {
        status_label: "Output Fetched",
        recommended_next_action: "resume batch",
        operator_hint: "Run batch resume",
      };
    }
    if (
      validationCounts.malformed_items ||
      validationCounts.enum_errors ||
      validationCounts.missing_field_errors
    ) {
      return {
        status_label: "Validation Blocked",
        recommended_next_action: "blocked by validation errors",
        operator_hint: "Manual review required before finalize",
      };
    }
    return {
      status_label: "Blocked",
      recommended_next_action: "resume batch",
      operator_hint: "Run batch resume",
    };
  }

  if (applySafe) {
    return {
      status_label: "Apply Safe",
      recommended_next_action: "ready for import/apply path",
      operator_hint: "Ready for import/apply path",
    };
  }
  if (finalizeSafe) {
    return {
      status_label: "Finalize Safe",
      recommended_next_action: "ready for finalize",
      operator_hint: "Ready for finalize",
    };
  }
  return {
    status_label: "Ready For Manual Review",
    recommended_next_action: "ready for manual review",
    operator_hint: "Ready for manual review",
  };
}

async function buildCurrentAdminOpenAIBatchState(reviewReport) {
  if (!reviewReport?.file_path) {
    return null;
  }

  const reviewPath = reviewReport.file_path;
  const metadataPath = deriveOpenAIBatchArtifactPath(reviewPath, "meta.json");
  const legacyMetadataPath = deriveOpenAIBatchArtifactPath(reviewPath, "metadata.json");
  const validationPath = deriveOpenAIBatchArtifactPath(reviewPath, "validation.json");
  const defaultOutputPath = deriveOpenAIBatchArtifactPath(reviewPath, "output.jsonl");
  const defaultErrorPath = deriveOpenAIBatchArtifactPath(reviewPath, "errors.jsonl");
  const metadataPayload =
    (await readJsonFileOrNull(metadataPath)) ||
    (await readJsonFileOrNull(legacyMetadataPath));
  const validationPayload = await readJsonFileOrNull(validationPath);
  const metadataPresent = Boolean(metadataPayload);
  const status = metadataPresent
    ? normalizeString(metadataPayload?.status) || "unknown"
    : "no_batch_metadata";
  const validationCounts = buildOpenAIBatchValidationCounts(validationPayload);
  const localOutputPath = resolveOpenAIBatchPath(
    metadataPayload?.local_output_path,
    metadataPath || reviewPath,
    defaultOutputPath
  );
  const localErrorPath = resolveOpenAIBatchPath(
    metadataPayload?.local_error_path,
    metadataPath || reviewPath,
    defaultErrorPath
  );
  const [outputStat, errorStat] = await Promise.all([
    localOutputPath ? statSafe(localOutputPath) : null,
    localErrorPath ? statSafe(localErrorPath) : null,
  ]);
  const outputFileId = normalizeString(metadataPayload?.output_file_id);
  const errorFileId = normalizeString(metadataPayload?.error_file_id);
  const outputReady = Boolean((outputFileId || outputStat) && outputStat);
  const errorFilePresent = Boolean((errorFileId || errorStat) && errorStat);
  const reviewArtifactReady = Boolean(reviewReport.items?.length);
  const reviewArtifactRebuilt = Boolean(
    !metadataPresent ||
      (reviewArtifactReady && normalizeString(metadataPayload?.review_artifact_rebuilt_at))
  );
  const blockingIssues = [];
  const warnings = [];

  if (!metadataPresent) {
    warnings.push({
      type: "openai_batch_metadata_missing",
      message:
        "No OpenAI Batch metadata sidecar was found; treating this as a legacy, dry-run, or non-Batch review artifact.",
    });
  } else {
    if (OPENAI_BATCH_INCOMPLETE_STATUSES.has(status) || !OPENAI_BATCH_TERMINAL_STATUSES.has(status)) {
      blockingIssues.push({
        type: "openai_batch_not_complete",
        message: `OpenAI Batch status is ${status}; results are not final yet.`,
      });
    }
    if (status === "completed" && outputFileId && !outputStat) {
      blockingIssues.push({
        type: "openai_batch_output_not_fetched",
        message: "OpenAI Batch completed but the local output JSONL has not been fetched.",
      });
    }
    if (["failed", "expired", "cancelled"].includes(status)) {
      blockingIssues.push({
        type: "openai_batch_terminal_failure",
        message: `OpenAI Batch ended with terminal status ${status}.`,
      });
    }
    if (!reviewArtifactRebuilt) {
      blockingIssues.push({
        type: "openai_batch_review_not_rebuilt",
        message: "The canonical .ai-review.json artifact has not been rebuilt from fetched Batch output.",
      });
    }
    if (!validationPayload) {
      blockingIssues.push({
        type: "openai_batch_validation_missing",
        message: "The OpenAI Batch validation sidecar is missing.",
      });
    } else if (
      validationCounts.malformed_items ||
      validationCounts.enum_errors ||
      validationCounts.missing_field_errors
    ) {
      blockingIssues.push({
        type: "openai_batch_validation_failed",
        message:
          `OpenAI Batch validation found ${validationCounts.malformed_items} malformed item(s), ` +
          `${validationCounts.enum_errors} enum error(s), and ` +
          `${validationCounts.missing_field_errors} missing-field error(s).`,
      });
    }
  }

  const finalizeSafe = blockingIssues.length === 0;
  const applySafe = blockingIssues.length === 0;
  const guidance = buildOpenAIBatchOperatorGuidance({
    metadataPresent,
    status,
    outputReady,
    reviewArtifactRebuilt,
    validationCounts,
    blockingIssues,
    finalizeSafe,
    applySafe,
  });

  return {
    batch_name: reviewReport.batch_name || path.basename(reviewPath, ".ai-review.json"),
    normalized_input_artifact_path:
      normalizeString(metadataPayload?.input_artifact) ||
      normalizeString(reviewReport.input_path) ||
      null,
    review_artifact_path: reviewPath,
    provider: metadataPayload?.provider || (metadataPresent ? null : "legacy_or_dry_run"),
    model:
      metadataPayload?.model ||
      reviewReport.model ||
      reviewReport.requested_model ||
      null,
    batch_id: metadataPayload?.batch_id || metadataPayload?.id || null,
    lifecycle_status: status,
    submitted_at: metadataPayload?.submitted_at || null,
    completed_at: metadataPayload?.completed_at || null,
    last_polled_at: metadataPayload?.last_polled_at || null,
    reviewed_count: toSafeNumber(metadataPayload?.reviewed_count, reviewReport.reviewed_count || 0),
    output_ready: outputReady,
    error_file_present: errorFilePresent,
    review_artifact_rebuilt: reviewArtifactRebuilt,
    finalize_safe: finalizeSafe,
    apply_safe: applySafe,
    validation_counts: validationCounts,
    status_label: guidance.status_label,
    recommended_next_action: guidance.recommended_next_action,
    operator_hint: guidance.operator_hint,
    blocking_issues: blockingIssues,
    warnings,
    blocker_text: blockingIssues.map(formatOpenAIBatchIssue).filter(Boolean),
    warning_text: warnings.map(formatOpenAIBatchIssue).filter(Boolean),
    request_counts: metadataPayload?.request_counts || {},
    sidecars: {
      metadata_present: metadataPresent,
      validation_present: Boolean(validationPayload),
      metadata_path: metadataPath,
      legacy_metadata_path: legacyMetadataPath,
      validation_path: validationPath,
      local_output_path: localOutputPath,
      local_error_path: localErrorPath,
    },
  };
}

async function buildCurrentAdminEvidencePackState(reviewReport) {
  if (!reviewReport?.file_path) {
    return {
      artifact_version: 1,
      artifact_present: false,
      item_count: 0,
      summary: {},
      operator_interpretations: ["no evidence-pack context is available"],
    };
  }

  const artifactPath = deriveCurrentAdminEvidencePackArtifactPath(reviewReport.file_path);
  const payload = await readJsonFileOrNull(artifactPath);
  if (!payload) {
    return {
      artifact_version: 1,
      artifact_present: false,
      artifact_path: artifactPath,
      batch_name: reviewReport.batch_name || null,
      item_count: reviewReport.items?.length || 0,
      summary: {},
      operator_interpretations: ["no evidence-pack context is available"],
    };
  }

  const summary = payload.summary || {};
  const diagnosticCounts = summary.evidence_quality_diagnostic_counts || {};
  return {
    artifact_version: payload.artifact_version || 1,
    artifact_present: true,
    artifact_path: artifactPath,
    packing_version: payload.packing_version || null,
    batch_name: payload.batch_name || reviewReport.batch_name || null,
    input_artifact: payload.input_artifact || null,
    review_artifact: payload.review_artifact || reviewReport.file_path,
    item_count: payload.model_facing_item_count || 0,
    model_facing_item_count: payload.model_facing_item_count || 0,
    single_source_official_count: summary.single_source_official_count || 0,
    outcome_evidence_present_count: summary.outcome_evidence_present_count || 0,
    policy_intent_only_count: summary.policy_intent_only_count || 0,
    weak_outcome_evidence_count: summary.weak_outcome_evidence_count || 0,
    source_grounding_label_counts: summary.source_grounding_label_counts || {},
    evidence_strength_label_counts: summary.evidence_strength_label_counts || {},
    evidence_quality_diagnostic_counts: diagnosticCounts,
    impact_directness_hint_counts: summary.impact_directness_hint_counts || {},
    implementation_completeness_hint_counts: summary.implementation_completeness_hint_counts || {},
    top_evidence_gap_patterns: sortCounter(diagnosticCounts),
    operator_interpretations: payload.operator_interpretations || ["no dominant evidence-pack issue was detected"],
  };
}

async function buildComparisonContextsForReview(reviewReport) {
  const validationPayload = await readJsonFileOrNull(
    reviewReport?.file_path ? deriveOpenAIBatchArtifactPath(reviewReport.file_path, "validation.json") : null
  );
  const contexts = {};
  for (const [index, item] of (reviewReport?.items || []).entries()) {
    const suggestion = item.suggestions || {};
    const itemId = normalizeString(item.slug) || `item-${index + 1}`;
    const sourceQuality = manualReviewSourceQualityFromSuggestion(suggestion);
    const context = {
      classification: manualReviewClassificationFromSuggestion(suggestion),
      recommended_action: manualReviewRecommendedActionFromSuggestion(suggestion),
      confidence: toSafeNumber(suggestion.confidence_score, 0),
      source_quality: sourceQuality,
      source_issues: [
        ...normalizeStringArray(suggestion.source_warnings),
        ...normalizeStringArray(suggestion.missing_source_warnings),
      ],
      missing_information: normalizeStringArray(suggestion.evidence_needed_to_reduce_risk),
      flags: manualReviewFlagsFromSuggestion(item, suggestion, sourceQuality),
    };
    const validation = manualReviewValidationProblems(itemId, validationPayload);
    const reasonLabels = manualReviewReasonLabels({ context, validation, item });
    const blockedByMalformedOutput = reasonLabels[0] === "schema/validation issue";
    contexts[itemId] = {
      item_id: itemId,
      title: item.title || suggestion.title_normalized || itemId,
      classification: context.classification,
      recommended_action: context.recommended_action,
      confidence: context.confidence,
      confidence_bucket: manualReviewConfidenceBucket(context.confidence),
      source_quality: context.source_quality,
      reason_labels: reasonLabels,
      decision_readiness_label: reasonLabels.length
        ? manualReviewDecisionReadinessLabel({
            reasonLabels,
            blockedByMalformedOutput,
            summary: suggestion.reasoning_summary || suggestion.summary_suggestion,
            missingInformation: context.missing_information,
            sourceIssues: context.source_issues,
          })
        : "ready for operator decision",
      manual_review: Boolean(reasonLabels.length),
      finalize_safe: !reasonLabels.length,
      apply_safe: !reasonLabels.length,
    };
  }
  return contexts;
}

function buildComparisonRunSummary(reviewReport, contexts, evidencePackState = null) {
  const items = Object.values(contexts);
  const confidenceScores = items.map((item) => item.confidence);
  const classificationCounts = {};
  const actionCounts = {};
  const bucketCounts = {};
  const sourceQualityCounts = {};
  const reasonCounts = {};
  const readinessCounts = {};
  for (const item of items) {
    incrementCounter(classificationCounts, item.classification || "unclear");
    incrementCounter(actionCounts, item.recommended_action || "needs_manual_review");
    incrementCounter(bucketCounts, item.confidence_bucket || "unknown");
    incrementCounter(sourceQualityCounts, item.source_quality || "unknown");
    if (item.manual_review) {
      incrementCounter(readinessCounts, item.decision_readiness_label || "unknown");
    }
    for (const reason of item.reason_labels || []) {
      incrementCounter(reasonCounts, reason);
    }
  }
  return {
    artifact_path: reviewReport?.file_path || null,
    batch_name: reviewReport?.batch_name || null,
    model: reviewReport?.model || reviewReport?.requested_model || null,
    review_backend: reviewReport?.review_backend || null,
    reviewed_count: toSafeNumber(reviewReport?.reviewed_count, reviewReport?.items?.length || 0),
    matched_context_count: items.length,
    manual_review_count: items.filter((item) => item.manual_review).length,
    finalize_safe_count: items.filter((item) => item.finalize_safe).length,
    apply_safe_count: items.filter((item) => item.apply_safe).length,
    weak_evidence_count: items.filter((item) => item.reason_labels.includes("weak evidence")).length,
    low_confidence_count: items.filter((item) => item.reason_labels.includes("low confidence")).length,
    unclear_count: items.filter((item) => item.classification === "unclear").length,
    confidence_distribution: confidenceDistribution(confidenceScores),
    confidence_bucket_counts: sortCounter(bucketCounts),
    classification_counts: sortCounter(classificationCounts),
    recommended_action_counts: sortCounter(actionCounts),
    source_quality_counts: sortCounter(sourceQualityCounts),
    reason_label_counts: sortCounter(reasonCounts),
    decision_readiness_label_counts: sortCounter(readinessCounts),
    evidence_pack: evidencePackState || {
      present: false,
      artifact_path: reviewReport?.file_path ? deriveCurrentAdminEvidencePackArtifactPath(reviewReport.file_path) : null,
    },
  };
}

function buildComparisonItemDelta(itemId, baseline, enriched) {
  const baselineReasons = new Set(baseline.reason_labels || []);
  const enrichedReasons = new Set(enriched.reason_labels || []);
  const confidenceDelta = Number((enriched.confidence - baseline.confidence).toFixed(4));
  let note = "review outcome changed without a dominant rule-based pattern";
  if (baseline.manual_review && !enriched.manual_review && confidenceDelta > 0) {
    note = "confidence improved and manual review cleared";
  } else if (confidenceDelta > 0 && enrichedReasons.has("weak evidence")) {
    note = "confidence improved but weak evidence still blocks";
  } else if (baselineReasons.has("low confidence") && !enrichedReasons.has("low confidence") && enriched.manual_review) {
    note = "reason shifted from low confidence to needs operator judgment";
  } else if (enriched.manual_review && (enrichedReasons.has("weak evidence") || enrichedReasons.has("manual review requested by model"))) {
    note = "manual review remained because evidence or impact path still needs operator judgment";
  } else if (baseline.classification === enriched.classification && baseline.manual_review === enriched.manual_review) {
    note = "classification unchanged; evidence-pack had no practical effect";
  }
  return {
    item_id: itemId,
    title: enriched.title || baseline.title,
    baseline_classification: baseline.classification,
    enriched_classification: enriched.classification,
    baseline_confidence: baseline.confidence,
    enriched_confidence: enriched.confidence,
    confidence_delta: confidenceDelta,
    baseline_confidence_bucket: baseline.confidence_bucket,
    enriched_confidence_bucket: enriched.confidence_bucket,
    baseline_recommended_action: baseline.recommended_action,
    enriched_recommended_action: enriched.recommended_action,
    baseline_reason_labels: baseline.reason_labels || [],
    enriched_reason_labels: enriched.reason_labels || [],
    baseline_decision_readiness_label: baseline.decision_readiness_label,
    enriched_decision_readiness_label: enriched.decision_readiness_label,
    manual_review_reduced: Boolean(baseline.manual_review && !enriched.manual_review),
    finalize_safety_improved: Boolean(!baseline.finalize_safe && enriched.finalize_safe),
    evidence_related_blockers_reduced: Boolean(
      (baselineReasons.has("weak evidence") || baselineReasons.has("conflicting sources")) &&
        !enrichedReasons.has("weak evidence") &&
        !enrichedReasons.has("conflicting sources")
    ),
    comparison_note: note,
  };
}

function buildComparisonAggregateDeltas(itemDeltas, baselineSummary, enrichedSummary) {
  const bucketMovements = {};
  const classificationChanges = {};
  const actionChanges = {};
  for (const item of itemDeltas) {
    const bucketKey = `${item.baseline_confidence_bucket || "unknown"} -> ${item.enriched_confidence_bucket || "unknown"}`;
    incrementCounter(bucketMovements, bucketKey);
    if (item.baseline_classification !== item.enriched_classification) {
      incrementCounter(classificationChanges, `${item.baseline_classification} -> ${item.enriched_classification}`);
    }
    if (item.baseline_recommended_action !== item.enriched_recommended_action) {
      incrementCounter(actionChanges, `${item.baseline_recommended_action} -> ${item.enriched_recommended_action}`);
    }
  }
  return {
    confidence_average_delta: average(itemDeltas.map((item) => item.confidence_delta)) || 0,
    confidence_median_delta: confidenceDistribution(itemDeltas.map((item) => item.confidence_delta)).median || 0,
    confidence_bucket_movement_counts: sortCounter(bucketMovements),
    classification_change_counts: sortCounter(classificationChanges),
    recommended_action_change_counts: sortCounter(actionChanges),
    manual_review_count_before: baselineSummary.manual_review_count,
    manual_review_count_after: enrichedSummary.manual_review_count,
    manual_review_delta: enrichedSummary.manual_review_count - baselineSummary.manual_review_count,
    finalize_safe_count_before: baselineSummary.finalize_safe_count,
    finalize_safe_count_after: enrichedSummary.finalize_safe_count,
    finalize_safe_delta: enrichedSummary.finalize_safe_count - baselineSummary.finalize_safe_count,
    weak_evidence_count_before: baselineSummary.weak_evidence_count,
    weak_evidence_count_after: enrichedSummary.weak_evidence_count,
    weak_evidence_delta: enrichedSummary.weak_evidence_count - baselineSummary.weak_evidence_count,
    low_confidence_count_before: baselineSummary.low_confidence_count,
    low_confidence_count_after: enrichedSummary.low_confidence_count,
    low_confidence_delta: enrichedSummary.low_confidence_count - baselineSummary.low_confidence_count,
    manual_review_reduced_items: itemDeltas.filter((item) => item.manual_review_reduced).length,
    finalize_safety_improved_items: itemDeltas.filter((item) => item.finalize_safety_improved).length,
    evidence_related_blockers_reduced_items: itemDeltas.filter((item) => item.evidence_related_blockers_reduced).length,
  };
}

function buildComparisonInterpretations(aggregate, matchedCount) {
  const interpretations = [];
  const manualReduction = -toSafeNumber(aggregate.manual_review_delta, 0);
  const confidenceDelta = toSafeNumber(aggregate.confidence_average_delta, 0);
  if (calibrationRatio(manualReduction, matchedCount) >= 0.25) {
    interpretations.push("evidence-pack materially reduced manual review volume");
  }
  if (confidenceDelta > 0 && toSafeNumber(aggregate.weak_evidence_count_after, 0) >= toSafeNumber(aggregate.manual_review_count_after, 0) / 2) {
    interpretations.push("confidence improved but evidence blockers still dominate");
  }
  if (!Object.keys(aggregate.classification_change_counts || {}).length && confidenceDelta > 0) {
    interpretations.push("classification stability remained high while confidence improved");
  }
  if (confidenceDelta <= 0 && manualReduction <= 0) {
    interpretations.push("evidence-pack had limited effect on review outcomes");
  }
  if (toSafeNumber(aggregate.evidence_related_blockers_reduced_items, 0) > 0 && toSafeNumber(aggregate.manual_review_count_after, 0) > 0) {
    interpretations.push("evidence-pack improved source grounding, but not enough to clear conservative guardrails");
  }
  return interpretations.length ? interpretations : ["comparison did not show a dominant rule-based quality change"];
}

function buildComparisonRecommendations(aggregate, matchedCount) {
  const recommendations = [];
  const manualReduction = -toSafeNumber(aggregate.manual_review_delta, 0);
  const weakAfter = toSafeNumber(aggregate.weak_evidence_count_after, 0);
  const confidenceDelta = toSafeNumber(aggregate.confidence_average_delta, 0);
  if (manualReduction > 0 || confidenceDelta > 0) {
    recommendations.push("run another enriched batch before considering threshold changes");
  }
  if (weakAfter > 0) {
    recommendations.push("prioritize stronger outcome evidence for indirect-impact items");
    recommendations.push("do not loosen thresholds yet; evidence-pack helped but weak evidence remains dominant");
  }
  if (confidenceDelta > 0 && weakAfter === 0 && manualReduction > 0) {
    recommendations.push("consider modest threshold testing only for items improved by confidence without flag blockers");
  }
  if (toSafeNumber(aggregate.manual_review_count_after, 0) > 0) {
    recommendations.push("focus future packaging on implementation and measurable outcome summaries");
  }
  if (!matchedCount) {
    recommendations.push("provide explicit baseline and enriched review artifacts with overlapping item ids");
  }
  return [...new Set(recommendations.length ? recommendations : ["keep comparison as advisory and collect another enriched run"])];
}

function inferComparisonPair(reviewReports, latestReview) {
  const batchName = latestReview?.batch_name;
  if (!batchName) {
    return { baseline: null, enriched: null, reason: "no active batch name is available" };
  }
  const candidates = reviewReports.filter((report) => report.file_name?.includes(batchName));
  const baseline = candidates.find((report) =>
    CURRENT_ADMIN_COMPARISON_BASELINE_MARKERS.some((marker) => report.file_name.includes(marker))
  );
  const enriched = candidates.find((report) =>
    CURRENT_ADMIN_COMPARISON_ENRICHED_MARKERS.some((marker) => report.file_name.includes(marker))
  );
  if (baseline && enriched) {
    return { baseline, enriched, reason: "inferred from baseline/enriched filename markers" };
  }
  return { baseline: null, enriched: null, reason: "no clearly named baseline/enriched artifact pair was found" };
}

async function buildCurrentAdminComparisonState({ reviewReports, latestReview }) {
  const inferred = inferComparisonPair(reviewReports, latestReview);
  if (!inferred.baseline || !inferred.enriched) {
    return {
      artifact_version: 1,
      comparison_available: false,
      status: "no-comparison-context",
      reason: inferred.reason,
      compared_batch_name: latestReview?.batch_name || null,
    };
  }
  const [baselineContexts, enrichedContexts] = await Promise.all([
    buildComparisonContextsForReview(inferred.baseline),
    buildComparisonContextsForReview(inferred.enriched),
  ]);
  const matchedIds = Object.keys(baselineContexts).filter((itemId) => enrichedContexts[itemId]).sort();
  const baselineMatched = Object.fromEntries(matchedIds.map((itemId) => [itemId, baselineContexts[itemId]]));
  const enrichedMatched = Object.fromEntries(matchedIds.map((itemId) => [itemId, enrichedContexts[itemId]]));
  const baselineSummary = buildComparisonRunSummary(inferred.baseline, baselineMatched);
  const enrichedEvidencePack = await buildCurrentAdminEvidencePackState(inferred.enriched);
  const enrichedSummary = buildComparisonRunSummary(inferred.enriched, enrichedMatched, {
    present: Boolean(enrichedEvidencePack.artifact_present),
    artifact_path: enrichedEvidencePack.artifact_path || null,
    packing_version: enrichedEvidencePack.packing_version || null,
  });
  const itemDeltas = matchedIds.map((itemId) =>
    buildComparisonItemDelta(itemId, baselineMatched[itemId], enrichedMatched[itemId])
  );
  const aggregate = buildComparisonAggregateDeltas(itemDeltas, baselineSummary, enrichedSummary);
  return {
    artifact_version: 1,
    comparison_available: true,
    status: "comparison-ready",
    compared_batch_name: enrichedSummary.batch_name || baselineSummary.batch_name,
    identification_mode: inferred.reason,
    baseline: baselineSummary,
    enriched: enrichedSummary,
    matched_item_count: matchedIds.length,
    unmatched_item_count:
      new Set([...Object.keys(baselineContexts), ...Object.keys(enrichedContexts)]).size - matchedIds.length,
    aggregate_deltas: aggregate,
    item_deltas: [],
    rule_based_interpretations: buildComparisonInterpretations(aggregate, matchedIds.length),
    advisory_recommendations: buildComparisonRecommendations(aggregate, matchedIds.length),
  };
}

async function listPairedEvaluationMetadataFiles() {
  return listJsonFiles(
    CURRENT_ADMIN_REPORTS_DIR,
    (name) => name.endsWith(".paired-eval.meta.json")
  );
}

function pairedEvaluationRecommendation(status = {}) {
  const baseline = status.baseline || {};
  const enriched = status.enriched || {};
  if (!baseline.review_exists) {
    return baseline.metadata_present ? "resume baseline review" : "run baseline side";
  }
  if (!enriched.review_exists) {
    return enriched.metadata_present ? "resume enriched review" : "run enriched comparison after baseline completes";
  }
  if (status.comparison_ready) {
    return "both runs ready; inspect comparison";
  }
  return "both runs ready; run comparison";
}

async function buildCurrentAdminPairedEvaluationState(batchName) {
  if (!batchName) {
    return {
      artifact_version: 1,
      experiment_available: false,
      status: "no-experiment-context",
      recommendation: "no active batch is available for paired evaluation",
    };
  }

  const files = await listPairedEvaluationMetadataFiles();
  for (const { filePath, stat } of files) {
    const payload = await readJsonFileOrNull(filePath);
    if (!payload || payload.source_batch_name !== batchName) {
      continue;
    }
    const status = payload.status || {};
    return {
      artifact_version: payload.artifact_version || 1,
      experiment_available: true,
      status: status.comparison_ready ? "comparison-ready" : "experiment-in-progress",
      experiment_name: payload.experiment_name || null,
      source_batch_name: payload.source_batch_name || batchName,
      metadata_path: filePath,
      generated_at: payload.created_at || stat?.mtime?.toISOString?.() || null,
      updated_at: payload.updated_at || stat?.mtime?.toISOString?.() || null,
      packing_versions: payload.packing_versions || {},
      prompt_input_modes: payload.prompt_input_modes || {},
      baseline_status: status.baseline || {},
      enriched_status: status.enriched || {},
      comparison_ready: Boolean(status.comparison_ready),
      comparison_artifact: status.comparison_artifact || payload.artifacts?.comparison || null,
      artifacts: payload.artifacts || {},
      recommendation: status.recommendation || pairedEvaluationRecommendation(status),
    };
  }

  return {
    artifact_version: 1,
    experiment_available: false,
    status: "no-experiment-context",
    source_batch_name: batchName,
    recommendation: "no paired experiment has been prepared for this batch",
  };
}

function manualReviewConfidenceBucket(score) {
  const normalized = Math.max(0, Math.min(1, toSafeNumber(score, 0)));
  if (normalized < 0.6) return "0.00-0.59";
  if (normalized < 0.75) return "0.60-0.74";
  if (normalized < 0.85) return "0.75-0.84";
  return "0.85+";
}

function manualReviewClassificationFromSuggestion(suggestion = {}) {
  const value = normalizeString(suggestion.impact_direction_suggestion).toLowerCase();
  return ["positive", "negative", "mixed", "blocked"].includes(value)
    ? value
    : "unclear";
}

function manualReviewRecommendedActionFromSuggestion(suggestion = {}) {
  const recordAction = normalizeString(suggestion.record_action_suggestion);
  const nextAction = normalizeString(suggestion.suggested_operator_next_action);
  if (["new_record", "update_existing"].includes(recordAction) && nextAction !== "manual_review_required") {
    return "approve";
  }
  if (recordAction === "reject") {
    return "reject";
  }
  return "needs_manual_review";
}

function manualReviewSourceQualityFromSuggestion(suggestion = {}) {
  const evidence = normalizeString(suggestion.evidence_strength_suggestion);
  if (evidence === "Strong") return "high";
  if (evidence === "Moderate") return "medium";
  return "low";
}

function manualReviewFlagsFromSuggestion(item = {}, suggestion = {}, sourceQuality = "low") {
  const cautionFlags = new Set(normalizeStringArray(suggestion.caution_flags));
  const sourceIssues = [
    ...normalizeStringArray(suggestion.source_warnings),
    ...normalizeStringArray(suggestion.missing_source_warnings),
  ];
  const missingInformation = normalizeStringArray(suggestion.evidence_needed_to_reduce_risk);
  return {
    ambiguous_subject:
      cautionFlags.has("ambiguous_subject") ||
      normalizeString(suggestion.signal_ambiguity).toLowerCase() === "high",
    conflicting_sources:
      cautionFlags.has("conflicting_sources") || Boolean(item.has_material_conflict),
    weak_evidence:
      cautionFlags.has("weak_evidence") ||
      sourceQuality === "low" ||
      Boolean(sourceIssues.length || missingInformation.length),
    date_uncertain: cautionFlags.has("date_uncertain"),
  };
}

function manualReviewValidationProblems(itemId, validationPayload) {
  const perItem = validationPayload?.per_item_validation || {};
  const validation = perItem[itemId];
  if (!validation || typeof validation !== "object") {
    return {
      valid: true,
      malformed: false,
      enum_errors: [],
      missing_field_errors: [],
      notes: [],
    };
  }
  return {
    valid: Boolean(validation.valid),
    malformed: Boolean(validation.malformed),
    enum_errors: normalizeStringArray(validation.enum_errors),
    missing_field_errors: normalizeStringArray(validation.missing_field_errors),
    notes: normalizeStringArray(validation.notes),
  };
}

function manualReviewReasonLabels({ context, validation, item }) {
  const labels = [];
  if (validation.malformed || validation.enum_errors.length || validation.missing_field_errors.length) {
    labels.push("schema/validation issue");
  }
  if (context.flags.conflicting_sources || item.has_material_conflict) {
    labels.push("conflicting sources");
  }
  if (
    context.flags.weak_evidence ||
    context.source_quality === "low" ||
    context.source_issues.length ||
    context.missing_information.length
  ) {
    labels.push("weak evidence");
  }
  if (context.classification === "unclear") {
    labels.push("unclear classification");
  }
  if (context.confidence < 0.75) {
    labels.push("low confidence");
  }
  if (
    context.recommended_action === "needs_manual_review" ||
    normalizeString(item.suggestions?.record_action_suggestion) === "manual_review"
  ) {
    labels.push("manual review requested by model");
  }
  if (context.flags.ambiguous_subject) {
    labels.push("ambiguous subject");
  }
  if (context.flags.date_uncertain) {
    labels.push("date uncertain");
  }
  return [...new Set(labels)].sort(
    (a, b) =>
      (MANUAL_REVIEW_REASON_PRIORITY[a] || 99) -
        (MANUAL_REVIEW_REASON_PRIORITY[b] || 99) ||
      a.localeCompare(b)
  );
}

function manualReviewOperatorHint(reasonLabel) {
  return {
    "schema/validation issue": "validation issue; regenerate or inspect artifact",
    "conflicting sources": "review conflicting sources",
    "weak evidence": "missing information; do not finalize yet",
    "unclear classification": "inspect evidence before finalize",
    "low confidence": "low confidence; verify source grounding",
    "manual review requested by model": "AI requested manual review",
    "ambiguous subject": "confirm the subject before finalize",
    "date uncertain": "verify date and timeline before finalize",
  }[reasonLabel] || "inspect evidence before finalize";
}

function manualReviewDecisionChecklist({ reasonLabels, flags, validation, missingInformation }) {
  const checklist = [];
  if (reasonLabels.includes("schema/validation issue") || validation.malformed) {
    checklist.push("repair malformed output before decision");
  }
  if (reasonLabels.includes("conflicting sources") || flags.conflicting_sources) {
    checklist.push("review conflicting sources");
  }
  if (reasonLabels.includes("weak evidence") || missingInformation.length) {
    checklist.push("verify source grounding");
  }
  if (reasonLabels.includes("unclear classification")) {
    checklist.push("confirm whether evidence supports any non-unclear classification");
  }
  if (reasonLabels.includes("low confidence")) {
    checklist.push("verify source grounding");
  }
  if (reasonLabels.includes("manual review requested by model")) {
    checklist.push("confirm implementation status");
    checklist.push("confirm whether impact is direct or too indirect");
  }
  if (reasonLabels.includes("ambiguous subject") || flags.ambiguous_subject) {
    checklist.push("confirm subject identity/scope");
  }
  if (reasonLabels.includes("date uncertain") || flags.date_uncertain) {
    checklist.push("inspect dates and implementation timing");
  }
  if (validation.missing_field_errors.length && !checklist.includes("repair malformed output before decision")) {
    checklist.push("repair malformed output before decision");
  }
  return [...new Set(checklist)];
}

function manualReviewDecisionReadinessLabel({
  reasonLabels,
  blockedByMalformedOutput,
  summary,
  missingInformation,
  sourceIssues,
}) {
  if (blockedByMalformedOutput || reasonLabels.includes("schema/validation issue")) {
    return "needs artifact repair";
  }
  if (reasonLabels.some((reason) => ["conflicting sources", "weak evidence", "date uncertain"].includes(reason))) {
    return "needs evidence verification";
  }
  if (
    reasonLabels.some((reason) =>
      ["unclear classification", "low confidence", "manual review requested by model", "ambiguous subject"].includes(reason)
    )
  ) {
    return "needs operator judgment";
  }
  if (
    summary &&
    !missingInformation.length &&
    !sourceIssues.length &&
    reasonLabels.length
  ) {
    return "ready for operator decision";
  }
  return "needs operator judgment";
}

function manualReviewDecisionSupportSummary({
  reasonLabel,
  readinessLabel,
  classification,
  confidence,
  summary,
  checklist,
}) {
  const nextCheck = checklist[0] || "inspect evidence before deciding";
  return `${readinessLabel}: primary issue is ${reasonLabel}; classification=${classification}, confidence=${confidence.toFixed(2)}. Next check: ${nextCheck}. Context: ${summary || "No model summary was attached."}`;
}

function buildManualReviewOperatorActions({ reviewReport, decisionLogs, decisionTemplates }) {
  const actions = new Map();
  const reviewPath = reviewReport?.file_path;
  if (!reviewPath) {
    return actions;
  }
  const reviewPathBasename = path.basename(reviewPath);

  for (const template of [...decisionTemplates].reverse()) {
    const references = [
      template.source_review_file,
      template.source_artifact_file,
    ].map((entry) => normalizeString(entry));
    if (!references.includes(reviewPath) && !references.includes(reviewPathBasename)) {
      continue;
    }
    for (const item of template.items || []) {
      const slug = normalizeString(item.slug);
      const operatorAction = normalizeString(item.operator_action);
      if (slug && operatorAction) {
        actions.set(slug, {
          operator_action: operatorAction,
          decision_source: "decision_template",
          decision_artifact_path: template.file_path,
        });
      }
    }
  }

  for (const decisionLog of [...decisionLogs].reverse()) {
    const sourceReviewFile = normalizeString(decisionLog.source_review_file);
    if (sourceReviewFile !== reviewPath && path.basename(sourceReviewFile) !== reviewPathBasename) {
      continue;
    }
    for (const item of decisionLog.items || []) {
      const slug = normalizeString(item.slug);
      const operatorAction = normalizeString(item.operator_action);
      if (slug && operatorAction) {
        actions.set(slug, {
          operator_action: operatorAction,
          decision_source: "decision_log",
          decision_artifact_path: decisionLog.file_path,
        });
      }
    }
  }

  return actions;
}

function countManualReviewReasons(items) {
  const counts = {};
  for (const item of items) {
    for (const reason of item.reason_labels || []) {
      incrementCounter(counts, reason);
    }
  }
  return Object.fromEntries(
    Object.entries(counts).sort(
      (a, b) =>
        (MANUAL_REVIEW_REASON_PRIORITY[a[0]] || 99) -
          (MANUAL_REVIEW_REASON_PRIORITY[b[0]] || 99) ||
        a[0].localeCompare(b[0])
    )
  );
}

function countManualReviewBy(items, key) {
  return sortCounter(
    items.reduce((bucket, item) => {
      incrementCounter(bucket, item[key] || "unknown");
      return bucket;
    }, {})
  );
}

function confidenceDistribution(scores) {
  if (!scores.length) {
    return { min: null, max: null, average: null, median: null };
  }
  const sorted = [...scores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const medianScore =
    sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  return {
    min: Number(sorted[0].toFixed(4)),
    max: Number(sorted.at(-1).toFixed(4)),
    average: average(sorted),
    median: Number(medianScore.toFixed(4)),
  };
}

function calibrationRatio(part, total) {
  if (!total) {
    return 0;
  }
  return Number((part / total).toFixed(4));
}

function buildCalibrationInterpretations({ signals, validationPresent, validationCounts }) {
  const structurallyValid =
    validationPresent &&
    toSafeNumber(validationCounts.malformed_items, 0) === 0 &&
    toSafeNumber(validationCounts.enum_errors, 0) === 0 &&
    toSafeNumber(validationCounts.missing_field_errors, 0) === 0;
  const interpretations = [];

  if (signals.percent_manual_review >= 0.5 && signals.percent_low_confidence >= 0.5) {
    interpretations.push("manual review volume is high because low confidence dominates");
  }
  if (signals.percent_manual_review >= 0.5 && signals.percent_weak_evidence >= 0.4) {
    interpretations.push("manual review volume is high because weak evidence dominates");
  }
  if (signals.percent_mixed_or_unclear >= 0.6) {
    interpretations.push("classification spread is concentrated in mixed/unclear");
  }
  if (structurallyValid && signals.percent_medium_or_low_source_quality >= 0.5) {
    interpretations.push("outputs are structurally valid but evidence grounding is thin");
  }
  if (structurallyValid && signals.percent_manual_review >= 0.5) {
    interpretations.push("most items are safe structurally, but not decision-ready substantively");
  }
  if (!validationPresent) {
    interpretations.push("legacy/no-batch calibration state; validation sidecar was not found");
  }
  if (!interpretations.length) {
    interpretations.push("no dominant calibration issue was detected by the current thresholds");
  }
  return interpretations;
}

function buildCalibrationRecommendations({ signals, validationPresent, validationCounts }) {
  const structurallyValid =
    validationPresent &&
    toSafeNumber(validationCounts.malformed_items, 0) === 0 &&
    toSafeNumber(validationCounts.enum_errors, 0) === 0 &&
    toSafeNumber(validationCounts.missing_field_errors, 0) === 0;
  const recommendations = [];

  if (signals.percent_weak_evidence >= 0.4) {
    recommendations.push("inspect prompt/source packaging because weak-evidence flags dominate");
    recommendations.push("add richer action-level evidence before changing thresholds");
  }
  if (signals.percent_low_confidence >= 0.5 && signals.percent_weak_evidence < 0.4) {
    recommendations.push("review whether current confidence threshold is too strict for current-admin records");
  }
  if (signals.percent_medium_or_low_source_quality >= 0.5) {
    recommendations.push("do not loosen thresholds yet; source grounding is still thin");
  }
  if (signals.percent_mixed_or_unclear >= 0.6) {
    recommendations.push("consider separating implementation-status uncertainty from impact-direction uncertainty");
  }
  if (structurallyValid && signals.percent_manual_review >= 0.5 && !recommendations.length) {
    recommendations.push("review manual-review reasons before changing thresholds");
  }
  if (!validationPresent) {
    recommendations.push("collect Batch validation sidecars before tuning thresholds");
  }
  if (!recommendations.length) {
    recommendations.push("keep current thresholds and continue collecting calibration data");
  }
  return [...new Set(recommendations)];
}

function buildCurrentAdminCalibrationState({ reviewReport, manualReviewState, batchState }) {
  const items = reviewReport?.items || [];
  const classificationCounts = {
    positive: 0,
    negative: 0,
    mixed: 0,
    blocked: 0,
    unclear: 0,
  };
  const recommendedActionCounts = {
    approve: 0,
    reject: 0,
    needs_manual_review: 0,
  };
  const confidenceBucketCounts = {
    "0.00-0.59": 0,
    "0.60-0.74": 0,
    "0.75-0.84": 0,
    "0.85+": 0,
  };
  const sourceQualityCounts = {
    high: 0,
    medium: 0,
    low: 0,
  };
  const flagCounts = {
    ambiguous_subject: 0,
    conflicting_sources: 0,
    weak_evidence: 0,
    date_uncertain: 0,
  };
  const scores = [];

  for (const item of items) {
    const suggestion = item.suggestions || {};
    const sourceQuality = manualReviewSourceQualityFromSuggestion(suggestion);
    const context = {
      classification: manualReviewClassificationFromSuggestion(suggestion),
      recommended_action: manualReviewRecommendedActionFromSuggestion(suggestion),
      confidence: Math.max(0, Math.min(1, toSafeNumber(suggestion.confidence_score, 0))),
      source_quality: sourceQuality,
      flags: manualReviewFlagsFromSuggestion(item, suggestion, sourceQuality),
    };
    const classification = classificationCounts[context.classification] == null ? "unclear" : context.classification;
    const recommendedAction =
      recommendedActionCounts[context.recommended_action] == null
        ? "needs_manual_review"
        : context.recommended_action;
    classificationCounts[classification] += 1;
    recommendedActionCounts[recommendedAction] += 1;
    confidenceBucketCounts[manualReviewConfidenceBucket(context.confidence)] += 1;
    sourceQualityCounts[context.source_quality] += 1;
    scores.push(context.confidence);
    for (const key of Object.keys(flagCounts)) {
      if (context.flags[key]) {
        flagCounts[key] += 1;
      }
    }
  }

  const reviewedCount = items.length;
  const validationCounts = batchState?.validation_counts || {};
  const validationPresent = Boolean(batchState?.sidecars?.validation_present);
  const manualReviewCounts = {
    total_manual_review_items: manualReviewState?.counts?.total || 0,
    unresolved_manual_review_items: manualReviewState?.counts?.unresolved || 0,
    schema_blocked_manual_review_items: manualReviewState?.counts?.schema_blocked || 0,
    judgment_required_manual_review_items: manualReviewState?.counts?.human_judgment || 0,
  };
  const signals = {
    percent_manual_review: calibrationRatio(manualReviewCounts.total_manual_review_items, reviewedCount),
    percent_low_confidence: calibrationRatio(confidenceBucketCounts["0.00-0.59"], reviewedCount),
    percent_unclear: calibrationRatio(classificationCounts.unclear, reviewedCount),
    percent_weak_evidence: calibrationRatio(flagCounts.weak_evidence, reviewedCount),
    percent_medium_or_low_source_quality: calibrationRatio(sourceQualityCounts.medium + sourceQualityCounts.low, reviewedCount),
    percent_validation_blocked: calibrationRatio(manualReviewCounts.schema_blocked_manual_review_items, manualReviewCounts.total_manual_review_items),
    percent_evidence_blocked: calibrationRatio(manualReviewState?.counts?.by_readiness?.["needs evidence verification"] || 0, manualReviewCounts.total_manual_review_items),
    percent_judgment_required: calibrationRatio(manualReviewCounts.judgment_required_manual_review_items, manualReviewCounts.total_manual_review_items),
    percent_mixed_or_unclear: calibrationRatio(classificationCounts.mixed + classificationCounts.unclear, reviewedCount),
  };

  return {
    artifact_version: 1,
    batch_name: reviewReport?.batch_name || null,
    reviewed_item_count: reviewedCount,
    validation: {
      valid_items: validationPresent ? toSafeNumber(validationCounts.valid_items, 0) : null,
      malformed_items: validationPresent ? toSafeNumber(validationCounts.malformed_items, 0) : null,
      enum_errors: validationPresent ? toSafeNumber(validationCounts.enum_errors, 0) : null,
      missing_field_errors: validationPresent ? toSafeNumber(validationCounts.missing_field_errors, 0) : null,
    },
    classification_counts: classificationCounts,
    recommended_action_counts: recommendedActionCounts,
    confidence_distribution: confidenceDistribution(scores),
    confidence_bucket_counts: confidenceBucketCounts,
    manual_review_counts: manualReviewCounts,
    reason_label_counts: manualReviewState?.counts?.by_reason || {},
    decision_readiness_label_counts: manualReviewState?.counts?.by_readiness || {},
    source_quality_counts: sourceQualityCounts,
    flag_counts: flagCounts,
    tuning_signals: signals,
    rule_based_interpretations: buildCalibrationInterpretations({
      signals,
      validationPresent,
      validationCounts,
    }),
    advisory_recommendations: buildCalibrationRecommendations({
      signals,
      validationPresent,
      validationCounts,
    }),
  };
}

function simulationHardBlockers(item, profile) {
  const blockers = [];
  const flags = item.flags || {};
  if (item.blocked_by_malformed_output) {
    blockers.push("schema/validation issue");
  }
  if (profile.treat_unclear_as_always_manual_review && item.classification === "unclear") {
    blockers.push("classification is unclear");
  }
  if (profile.treat_model_manual_review_as_always_manual_review && item.recommended_action === "needs_manual_review") {
    blockers.push("model requested manual review");
  }
  const flagRules = {
    ambiguous_subject: "treat_ambiguous_subject_as_always_manual_review",
    conflicting_sources: "treat_conflicting_sources_as_always_manual_review",
    weak_evidence: "treat_weak_evidence_as_always_manual_review",
    date_uncertain: "treat_date_uncertain_as_always_manual_review",
  };
  for (const [flag, rule] of Object.entries(flagRules)) {
    if (
      flags[flag] &&
      profile[rule] &&
      !(
        profile.allow_high_confidence_flagged_items_to_stay_blocked === false &&
        item.confidence >= profile.confidence_auto_approve_threshold
      )
    ) {
      blockers.push(flag);
    }
  }
  return blockers;
}

function evaluateSimulationItem(item, profile) {
  const blockers = simulationHardBlockers(item, profile);
  if (blockers.length) {
    if (blockers.includes("schema/validation issue")) return { outcome: "schema_blocked", blockers };
    if (blockers.includes("weak_evidence")) return { outcome: "evidence_blocked", blockers };
    return { outcome: "flag_blocked", blockers };
  }
  if (item.recommended_action === "reject") {
    return { outcome: "manual_review", blockers: ["recommended_action is reject"] };
  }
  if (item.confidence >= profile.confidence_auto_approve_threshold) {
    return { outcome: "finalize_apply_safe", blockers: [] };
  }
  if (item.confidence < profile.confidence_manual_review_floor) {
    return { outcome: "manual_review", blockers: ["confidence below manual review floor"] };
  }
  return { outcome: "manual_review", blockers: ["confidence below auto-approve threshold"] };
}

function buildSimulationInterpretations({ promoted, evidenceBlocked, flagBlocked, total }) {
  const interpretations = [];
  if (promoted === 0 && evidenceBlocked + flagBlocked > 0) {
    interpretations.push("loosening confidence thresholds has limited effect because evidence or flag blockers remain dominant");
  }
  if (calibrationRatio(promoted, total) >= 0.25 && evidenceBlocked + flagBlocked === 0) {
    interpretations.push("threshold relaxation materially reduces manual review volume without changing major flag blockers");
  }
  if (evidenceBlocked > promoted) {
    interpretations.push("simulation suggests source packaging is a larger bottleneck than confidence policy");
  }
  if (promoted > 0 && promoted <= Math.max(2, Math.floor(total * 0.2))) {
    interpretations.push("a modest threshold change would promote a small set of likely operator-judgment items");
  }
  if (!interpretations.length) {
    interpretations.push("simulation does not show a strong threshold-driven change");
  }
  return interpretations;
}

function buildSimulationRecommendations({ promoted, evidenceBlocked, flagBlocked }) {
  const recommendations = [];
  if (evidenceBlocked + flagBlocked > promoted) {
    recommendations.push("do not change thresholds yet; evidence blockers dominate");
  }
  if (promoted > 0 && evidenceBlocked === 0 && flagBlocked === 0) {
    recommendations.push("consider a small confidence threshold test because threshold-only blocked items are clustered just below the current cutoff");
  }
  if (evidenceBlocked > 0) {
    recommendations.push("prioritize source enrichment over policy relaxation");
    recommendations.push("review weak-evidence rules before changing confidence thresholds");
  }
  if (promoted === 0) {
    recommendations.push("run another real batch after improving source packaging before tuning live thresholds");
  }
  if (!recommendations.length) {
    recommendations.push("keep simulation as advisory and review item deltas before changing live rules");
  }
  return [...new Set(recommendations)];
}

function buildCurrentAdminSimulationState({ reviewReport, manualReviewState }) {
  const presetName = "slightly-relaxed";
  const liveProfile = CURRENT_ADMIN_SIMULATION_PRESETS["strict-current"];
  const simulatedProfile = CURRENT_ADMIN_SIMULATION_PRESETS[presetName];
  const manualItems = manualReviewState?.items || [];
  const reviewedCount = reviewReport?.items?.length || 0;
  const currentFinalizeSafe = Math.max(0, reviewedCount - manualItems.length);
  let simulatedPromoted = 0;
  let evidenceBlocked = 0;
  let flagBlocked = 0;
  let schemaBlocked = 0;
  const remainingReasons = {};

  for (const item of manualItems) {
    const simulated = evaluateSimulationItem(item, simulatedProfile);
    if (simulated.outcome === "finalize_apply_safe") {
      simulatedPromoted += 1;
    } else {
      for (const reason of item.reason_labels || []) {
        incrementCounter(remainingReasons, reason);
      }
    }
    if (simulated.outcome === "evidence_blocked" || simulated.blockers.includes("model requested manual review")) {
      evidenceBlocked += 1;
    }
    if (simulated.outcome === "flag_blocked") flagBlocked += 1;
    if (simulated.outcome === "schema_blocked") schemaBlocked += 1;
  }

  const simulatedFinalizeSafe = currentFinalizeSafe + simulatedPromoted;
  const simulatedManualReview = Math.max(0, reviewedCount - simulatedFinalizeSafe);
  return {
    artifact_version: 1,
    live_profile_name: "strict-current",
    selected_preset: presetName,
    live_profile: liveProfile,
    simulation_profile: simulatedProfile,
    current_finalize_safe_count: currentFinalizeSafe,
    simulated_finalize_safe_count: simulatedFinalizeSafe,
    current_apply_safe_count: currentFinalizeSafe,
    simulated_apply_safe_count: simulatedFinalizeSafe,
    current_manual_review_count: manualItems.length,
    simulated_manual_review_count: simulatedManualReview,
    items_newly_promoted_to_finalize_safe: simulatedPromoted,
    items_still_blocked_by_flags: flagBlocked,
    items_still_blocked_by_evidence_readiness: evidenceBlocked,
    items_still_blocked_by_schema: schemaBlocked,
    top_remaining_reason_counts: sortCounter(remainingReasons),
    rule_based_interpretations: buildSimulationInterpretations({
      promoted: simulatedPromoted,
      evidenceBlocked,
      flagBlocked,
      total: reviewedCount,
    }),
    advisory_recommendations: buildSimulationRecommendations({
      promoted: simulatedPromoted,
      evidenceBlocked,
      flagBlocked,
    }),
  };
}

async function buildCurrentAdminManualReviewState({
  reviewReport,
  decisionLogs,
  decisionTemplates,
  queuePayload,
}) {
  if (!reviewReport?.file_path) {
    return {
      artifact_version: 1,
      item_count: 0,
      unresolved_count: 0,
      counts: {
        total: 0,
        unresolved: 0,
        schema_blocked: 0,
        human_judgment: 0,
        by_reason: {},
        by_batch: {},
        by_confidence_bucket: {},
      },
      items: [],
    };
  }

  const validationPath = deriveOpenAIBatchArtifactPath(reviewReport.file_path, "validation.json");
  const validationPayload = await readJsonFileOrNull(validationPath);
  const operatorActions = buildManualReviewOperatorActions({
    reviewReport,
    decisionLogs,
    decisionTemplates,
  });
  const manualQueueSlugs = queueHasManualOnlyScope(queuePayload)
    ? new Set(
        queueManualItems(queuePayload)
          .map((item) => normalizeString(item.slug))
          .filter(Boolean)
      )
    : null;
  const items = [];

  for (const [index, item] of (reviewReport.items || []).entries()) {
    if (manualQueueSlugs && !manualQueueSlugs.has(normalizeString(item?.slug))) {
      continue;
    }
    const suggestion = item.suggestions || {};
    const itemId = normalizeString(item.slug) || `item-${index + 1}`;
    const sourceQuality = manualReviewSourceQualityFromSuggestion(suggestion);
    const context = {
      entity_type: "promise",
      entity_id: itemId,
      recommended_action: manualReviewRecommendedActionFromSuggestion(suggestion),
      classification: manualReviewClassificationFromSuggestion(suggestion),
      confidence: Math.max(0, Math.min(1, toSafeNumber(suggestion.confidence_score, 0))),
      summary:
        normalizeString(suggestion.reasoning_summary) ||
        normalizeString(suggestion.summary_suggestion) ||
        null,
      reasoning_notes: normalizeStringArray(suggestion.hesitation_reasons),
      missing_information: normalizeStringArray(suggestion.evidence_needed_to_reduce_risk),
      source_quality: sourceQuality,
      source_issues: [
        ...new Set([
          ...normalizeStringArray(suggestion.source_warnings),
          ...normalizeStringArray(suggestion.missing_source_warnings),
        ]),
      ],
      flags: manualReviewFlagsFromSuggestion(item, suggestion, sourceQuality),
    };
    const validation = manualReviewValidationProblems(itemId, validationPayload);
    const reasonLabels = manualReviewReasonLabels({ context, validation, item });
    if (!reasonLabels.length) {
      continue;
    }
    const reasonLabel = reasonLabels[0];
    const action = operatorActions.get(itemId) || {};
    const blockedByMalformedOutput = reasonLabel === "schema/validation issue";
    const decisionChecklist = manualReviewDecisionChecklist({
      reasonLabels,
      flags: context.flags,
      validation,
      missingInformation: context.missing_information,
    });
    const decisionReadinessLabel = manualReviewDecisionReadinessLabel({
      reasonLabels,
      blockedByMalformedOutput,
      summary: context.summary,
      missingInformation: context.missing_information,
      sourceIssues: context.source_issues,
    });
    const decisionSupportSummary = manualReviewDecisionSupportSummary({
      reasonLabel,
      readinessLabel: decisionReadinessLabel,
      classification: context.classification,
      confidence: context.confidence,
      summary: context.summary,
      checklist: decisionChecklist,
    });
    items.push({
      item_id: itemId,
      batch_name: reviewReport.batch_name,
      source_artifact_name: path.basename(reviewReport.file_path),
      source_artifact_path: reviewReport.file_path,
      review_artifact_path: reviewReport.file_path,
      entity_type: context.entity_type,
      entity_id: context.entity_id,
      title: item.title || null,
      recommended_action: context.recommended_action,
      classification: context.classification,
      confidence: context.confidence,
      confidence_bucket: manualReviewConfidenceBucket(context.confidence),
      summary: context.summary,
      reasoning_notes: context.reasoning_notes,
      missing_information: context.missing_information,
      source_quality: context.source_quality,
      source_issues: context.source_issues,
      flags: context.flags,
      validation_problems: validation,
      blocked_by_malformed_output: blockedByMalformedOutput,
      needs_human_judgment: !blockedByMalformedOutput,
      reason_label: reasonLabel,
      reason_labels: reasonLabels,
      priority_rank: MANUAL_REVIEW_REASON_PRIORITY[reasonLabel] || 99,
      operator_hint: manualReviewOperatorHint(reasonLabel),
      decision_readiness_label: decisionReadinessLabel,
      decision_checklist: decisionChecklist,
      primary_decision_check: decisionChecklist[0] || null,
      decision_support_summary: decisionSupportSummary,
      unresolved: !Boolean(action.operator_action),
      operator_action: action.operator_action || null,
      decision_source: action.decision_source || null,
      decision_artifact_path: action.decision_artifact_path || null,
      classifier_fields_source: "canonical_review",
    });
  }

  items.sort((a, b) => a.priority_rank - b.priority_rank || a.confidence - b.confidence || a.item_id.localeCompare(b.item_id));

  return {
    artifact_version: 1,
    source_review_file: reviewReport.file_path,
    batch_name: reviewReport.batch_name,
    item_count: items.length,
    unresolved_count: items.filter((item) => item.unresolved).length,
    counts: {
      total: items.length,
      unresolved: items.filter((item) => item.unresolved).length,
      schema_blocked: items.filter((item) => item.blocked_by_malformed_output).length,
      human_judgment: items.filter((item) => item.needs_human_judgment).length,
      by_reason: countManualReviewReasons(items),
      by_batch: countManualReviewBy(items, "batch_name"),
      by_confidence_bucket: countManualReviewBy(items, "confidence_bucket"),
      by_readiness: countManualReviewBy(items, "decision_readiness_label"),
    },
    items,
  };
}

async function countBatchRecordsInDb({ presidentSlug, slugs }) {
  const uniqueSlugs = [...new Set((slugs || []).map((slug) => normalizeString(slug)).filter(Boolean))];
  if (!hasDbConfig()) {
    return {
      query_status: "unavailable",
      matched_record_count: 0,
      matched_slugs: [],
    };
  }
  if (!normalizeString(presidentSlug) || !uniqueSlugs.length) {
    return {
      query_status: "skipped",
      matched_record_count: 0,
      matched_slugs: [],
    };
  }

  try {
    const db = getDb();
    const placeholders = uniqueSlugs.map(() => "?").join(", ");
    const [rows] = await db.query(
      `
        SELECT p.slug
        FROM promises p
        JOIN presidents pr ON pr.id = p.president_id
        WHERE pr.slug = ?
          AND p.slug IN (${placeholders})
      `,
      [presidentSlug, ...uniqueSlugs]
    );
    const matchedSlugs = (rows || [])
      .map((row) => normalizeString(row.slug))
      .filter(Boolean);
    return {
      query_status: "passed",
      matched_record_count: matchedSlugs.length,
      matched_slugs: matchedSlugs,
    };
  } catch (error) {
    return {
      query_status: "failed",
      matched_record_count: 0,
      matched_slugs: [],
      error: normalizeString(error?.message) || "Unknown DB provenance query failure.",
    };
  }
}

async function buildCurrentAdminProvenanceStatus({
  latestBatchFile,
  artifactStatus,
}) {
  if (!latestBatchFile?.file_path) {
    return null;
  }

  const batchPayload = await readJsonFile(latestBatchFile.file_path).catch(() => null);
  const records = Array.isArray(batchPayload?.records) ? batchPayload.records : [];
  const batchSlugs = records
    .map((record) => normalizeString(record?.slug))
    .filter(Boolean);
  const presidentSlug = normalizeString(batchPayload?.president_slug);
  const requiredArtifacts = [
    { key: "normalized_batch", label: "Normalized batch" },
    { key: "review_artifact", label: "AI review" },
    { key: "decision_log", label: "Decision log" },
    { key: "manual_review_queue", label: "Manual review queue" },
    { key: "pre_commit_review", label: "Pre-commit review" },
    { key: "import_dry_run", label: "Import dry-run report" },
    { key: "import_apply", label: "Import apply report" },
    { key: "validation_report", label: "Validation report" },
  ];
  const missingArtifactLabels = requiredArtifacts
    .filter((artifact) => !artifactStatus?.[artifact.key]?.exists)
    .map((artifact) => artifact.label);
  const dbMatch = await countBatchRecordsInDb({
    presidentSlug,
    slugs: batchSlugs,
  });
  const importBatchDetected = dbMatch.matched_record_count > 0;
  const artifactChainMissing = importBatchDetected && missingArtifactLabels.length > 0;
  const provenanceIncomplete = importBatchDetected && artifactChainMissing;

  let summary = "No current-admin provenance warning is active for the current batch.";
  if (provenanceIncomplete) {
    summary = `${dbMatch.matched_record_count} current-admin record(s) from ${latestBatchFile.batch_name} exist in the DB, but the artifact chain is incomplete.`;
  } else if (importBatchDetected) {
    summary = `The current batch matches ${dbMatch.matched_record_count} DB record(s) and the canonical artifact chain is present.`;
  } else if (batchSlugs.length > 0) {
    summary = "The current batch has not been detected in canonical Promise Tracker rows yet.";
  }

  return {
    batch_name: latestBatchFile.batch_name || null,
    batch_record_count: batchSlugs.length,
    import_batch_detected: importBatchDetected,
    artifact_chain_missing: artifactChainMissing,
    provenance_incomplete: provenanceIncomplete,
    matched_record_count: dbMatch.matched_record_count,
    matched_slugs_sample: dbMatch.matched_slugs.slice(0, 5),
    missing_artifacts: missingArtifactLabels,
    db_query_status: dbMatch.query_status,
    db_query_error: dbMatch.error || null,
    summary,
  };
}

async function ensureDir(filePath) {
  await fs.mkdir(filePath, { recursive: true });
}

async function listJsonFiles(dirPath, matcher) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && matcher(entry.name))
      .map((entry) => path.join(dirPath, entry.name));

    const withStats = await Promise.all(
      files.map(async (filePath) => ({
        filePath,
        stat: await fs.stat(filePath),
      }))
    );

    return withStats.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
  } catch {
    return [];
  }
}

async function listReviewReportFiles() {
  return listJsonFiles(
    CURRENT_ADMIN_REPORTS_DIR,
    (name) => name.endsWith(".ai-review.json")
  );
}

async function listBatchFiles() {
  return listJsonFiles(
    CURRENT_ADMIN_BATCHES_DIR,
    (name) => name.endsWith(".json")
  );
}

async function listDecisionLogFiles() {
  return listJsonFiles(
    REVIEW_DECISIONS_DIR,
    (name) => name.endsWith(".json")
  );
}

async function listPrecommitFiles() {
  return listJsonFiles(
    CURRENT_ADMIN_REPORTS_DIR,
    (name) => name.endsWith(".pre-commit-review.json")
  );
}

async function listDecisionTemplateFiles() {
  return listJsonFiles(
    CURRENT_ADMIN_REPORTS_DIR,
    (name) => name.endsWith(".decision-template.json")
  );
}

async function listImportDryRunFiles() {
  return listJsonFiles(
    CURRENT_ADMIN_REPORTS_DIR,
    (name) => name.endsWith(".import-dry-run.json")
  );
}

async function listImportApplyFiles() {
  return listJsonFiles(
    CURRENT_ADMIN_REPORTS_DIR,
    (name) => name.endsWith(".import-apply.json")
  );
}

async function listValidationFiles() {
  return listJsonFiles(
    CURRENT_ADMIN_REPORTS_DIR,
    (name) => name.endsWith(".import-validation.json")
  );
}

function toIsoDate(value) {
  const text = normalizeString(value);
  if (!text) {
    return null;
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function buildReviewReportSummary(report, filePath, stat) {
  const items = Array.isArray(report?.items) ? report.items : [];
  const reviewPriorityCounts =
    report?.review_priority_counts ||
    sortCounter(
      items.reduce((bucket, item) => {
        incrementCounter(bucket, item.review_priority);
        return bucket;
      }, {})
    );
  const suggestedBatchCounts =
    report?.suggested_batch_counts ||
    sortCounter(
      items.reduce((bucket, item) => {
        incrementCounter(bucket, item.suggested_batch);
        return bucket;
      }, {})
    );

  const enrichedItems = items.map((item) => ({
    ...item,
    refined_review_profile: buildRefinedReviewProfile(item),
  }));

  return {
    file_path: filePath,
    file_name: path.basename(filePath),
    generated_at: stat?.mtime?.toISOString?.() || null,
    batch_name: report?.batch_name || null,
    input_path: report?.input_path || null,
    model: report?.model || null,
    requested_model: report?.requested_model || report?.model || null,
    resolved_model: report?.resolved_model || null,
    review_backend: report?.review_backend || null,
    fallback_used: Boolean(report?.fallback_used),
    fallback_reason: report?.fallback_reason || null,
    fallback_model: report?.fallback_model || null,
    model_resolution_status: report?.model_resolution_status || null,
    fallback_count: toSafeNumber(report?.fallback_count, 0),
    review_mode: report?.review_mode || null,
    reviewed_count: toSafeNumber(report?.reviewed_count, items.length),
    deep_review_count: toSafeNumber(
      report?.deep_review_count,
      items.filter((item) => item.deep_review_ran).length
    ),
    review_priority_counts: reviewPriorityCounts,
    suggested_batch_counts: suggestedBatchCounts,
    items_needing_attention: enrichedItems.filter(
      (item) => item.operator_attention_needed
    ).length,
    items_with_material_conflicts: enrichedItems.filter(
      (item) => item.has_material_conflict
    ).length,
    items_recommended_for_deep_review: enrichedItems.filter(
      (item) => item.deep_review_recommended
    ).length,
    average_review_risk_score: average(
      enrichedItems.map((item) => item.refined_review_profile.review_risk_score)
    ),
    average_operator_friction_score: average(
      enrichedItems.map(
        (item) => item.refined_review_profile.operator_friction_score
      )
    ),
    items: enrichedItems,
  };
}

async function loadReviewReports() {
  const files = await listReviewReportFiles();
  return Promise.all(
    files.map(async ({ filePath, stat }) => {
      const report = await readJsonFile(filePath);
      return buildReviewReportSummary(report, filePath, stat);
    })
  );
}

async function loadCanonicalBatchFiles() {
  const files = await listBatchFiles();
  return Promise.all(
    files.map(async ({ filePath, stat }) => {
      const payload = await readJsonFile(filePath).catch(() => null);
      return {
        file_path: filePath,
        file_name: path.basename(filePath),
        generated_at: stat?.mtime?.toISOString?.() || null,
        batch_name:
          normalizeString(payload?.batch_name) ||
          path.basename(filePath, ".json"),
        payload: payload || {},
      };
    })
  );
}

function resolveReviewReference(fileReference) {
  const normalized = normalizeString(fileReference);
  if (!normalized) {
    return null;
  }

  const candidatePaths = [];

  if (path.isAbsolute(normalized)) {
    candidatePaths.push(normalized);
    candidatePaths.push(path.join(CURRENT_ADMIN_REPORTS_DIR, path.basename(normalized)));
  } else {
    candidatePaths.push(path.join(PROJECT_ROOT, normalized));
    candidatePaths.push(path.join(CURRENT_ADMIN_REPORTS_DIR, normalized));
    candidatePaths.push(path.join(CURRENT_ADMIN_REPORTS_DIR, path.basename(normalized)));
  }

  return candidatePaths;
}

async function resolveExistingReviewPath(fileReference) {
  const candidates = resolveReviewReference(fileReference) || [];

  for (const candidate of candidates) {
    if (await statSafe(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function loadDecisionLogs() {
  const files = await listDecisionLogFiles();
  const reviewCache = new Map();

  return Promise.all(
    files.map(async ({ filePath, stat }) => {
      const payload = await readJsonFile(filePath);
      const items = Array.isArray(payload?.items) ? payload.items : [];
      const sourceReviewPath = await resolveExistingReviewPath(payload?.source_review_file);
      let reviewMap = new Map();

      if (sourceReviewPath) {
        if (!reviewCache.has(sourceReviewPath)) {
          const sourceReview = await readJsonFile(sourceReviewPath);
          const sourceItems = Array.isArray(sourceReview?.items) ? sourceReview.items : [];
          reviewCache.set(
            sourceReviewPath,
            new Map(sourceItems.map((item) => [item.slug, item]))
          );
        }

        reviewMap = reviewCache.get(sourceReviewPath);
      }

      const enrichedItems = items.map((item) => {
        const reviewItem = reviewMap.get(item.slug) || null;
        return {
          ...item,
          review_item: reviewItem,
          refined_review_profile: buildRefinedReviewProfile(reviewItem || {}, item),
        };
      });

      const operatorActionCounts = sortCounter(
        enrichedItems.reduce((bucket, item) => {
          incrementCounter(bucket, item.operator_action);
          return bucket;
        }, {})
      );

      return {
        file_path: filePath,
        file_name: path.basename(filePath),
        generated_at:
          normalizeString(payload?.generated_at) ||
          stat?.mtime?.toISOString?.() ||
          null,
        session_id: payload?.session_id || path.basename(filePath, ".json"),
        source_review_file: payload?.source_review_file || null,
        source_decision_file: payload?.source_decision_file || null,
        worklist_used: payload?.worklist_used || null,
        selection_filters: payload?.selection_filters || null,
        session_focus: payload?.session_focus || null,
        decision_counts: payload?.decision_counts || {
          match: enrichedItems.filter((item) => item.decision_alignment === "match").length,
          mismatch: enrichedItems.filter((item) => item.decision_alignment === "mismatch").length,
        },
        operator_action_counts: operatorActionCounts,
        items: enrichedItems,
      };
    })
  );
}

async function loadPrecommitReports() {
  const files = await listPrecommitFiles();
  return Promise.all(
    files.map(async ({ filePath, stat }) => {
      const payload = await readJsonFile(filePath);
      return {
        file_path: filePath,
        file_name: path.basename(filePath),
        generated_at:
          normalizeString(payload?.generated_at) ||
          stat?.mtime?.toISOString?.() ||
          null,
        batch_name: payload?.batch_name || path.basename(filePath, ".pre-commit-review.json"),
        source_queue_file: payload?.source_queue_file || null,
        source_review_file: payload?.source_review_file || null,
        source_decision_template: payload?.source_decision_template || null,
        source_decision_log: payload?.source_decision_log || null,
        decision_log_resolution: payload?.decision_log_resolution || "none",
        decision_template_source_review_file:
          payload?.decision_template_source_review_file || null,
        decision_log_source_review_file:
          payload?.decision_log_source_review_file || null,
        artifact_linkage: payload?.artifact_linkage || {},
        summary: payload?.summary || {},
        selected_for_import_count: toSafeNumber(payload?.selected_for_import_count, 0),
        decision_covered_count: toSafeNumber(payload?.decision_covered_count, 0),
        decision_missing_count: toSafeNumber(payload?.decision_missing_count, 0),
        invalid_operator_action_count: toSafeNumber(
          payload?.invalid_operator_action_count,
          0
        ),
        unresolved_manual_review_count: toSafeNumber(payload?.unresolved_manual_review_count, 0),
        material_conflict_count: toSafeNumber(payload?.material_conflict_count, 0),
        source_gap_count: toSafeNumber(payload?.source_gap_count, 0),
        high_attention_count: toSafeNumber(payload?.high_attention_count, 0),
        readiness_status: payload?.readiness_status || "blocked",
        readiness_label: payload?.readiness_label || null,
        readiness_explanation: payload?.readiness_explanation || null,
        readiness_details: payload?.readiness_details || null,
        warning_counts: payload?.warning_counts || {},
        blocking_issues: Array.isArray(payload?.blocking_issues) ? payload.blocking_issues : [],
        linkage_warnings: Array.isArray(payload?.linkage_warnings)
          ? payload.linkage_warnings
          : [],
        low_confidence_items: Array.isArray(payload?.low_confidence_items)
          ? payload.low_confidence_items
          : [],
        diff_preview: payload?.diff_preview || {
          new_records: [],
          updated_records: [],
          skipped_items: [],
        },
        items: Array.isArray(payload?.items) ? payload.items : [],
        recommended_next_step: payload?.recommended_next_step || null,
      };
    })
  );
}

async function loadDecisionTemplates() {
  const files = await listDecisionTemplateFiles();
  return Promise.all(
    files.map(async ({ filePath, stat }) => {
      const payload = await readJsonFile(filePath);
      const items = Array.isArray(payload?.items) ? payload.items : [];
      return {
        file_path: filePath,
        file_name: path.basename(filePath),
        generated_at:
          normalizeString(payload?.generated_at) ||
          stat?.mtime?.toISOString?.() ||
          null,
        session_id: payload?.session_id || null,
        source_review_file: payload?.source_review_file || null,
        source_artifact_file: payload?.source_artifact_file || null,
        session_focus: payload?.session_focus || null,
        item_count: toSafeNumber(payload?.item_count, items.length),
        decision_options: Array.isArray(payload?.decision_options)
          ? payload.decision_options
          : [],
        items,
      };
    })
  );
}

async function loadImportReports(listFiles, mode) {
  const files = await listFiles();
  return Promise.all(
    files.map(async ({ filePath, stat }) => {
      const payload = await readJsonFile(filePath);
      return {
        file_path: filePath,
        file_name: path.basename(filePath),
        generated_at: stat?.mtime?.toISOString?.() || null,
        mode: payload?.mode || mode,
        batch_name: payload?.batch_name || null,
        president_slug: payload?.president_slug || null,
        promises_created: toSafeNumber(payload?.promises_created, 0),
        promises_updated: toSafeNumber(payload?.promises_updated, 0),
        actions_created: toSafeNumber(payload?.actions_created, 0),
        outcomes_created: toSafeNumber(payload?.outcomes_created, 0),
        sources_created: toSafeNumber(payload?.sources_created, 0),
        sources_reused: toSafeNumber(payload?.sources_reused, 0),
        skipped_duplicates: toSafeNumber(payload?.skipped_duplicates, 0),
        conflicts: Array.isArray(payload?.conflicts) ? payload.conflicts : [],
        notes: Array.isArray(payload?.notes) ? payload.notes : [],
        validation: payload?.validation || {},
      };
    })
  );
}

async function loadValidationReports() {
  const files = await listValidationFiles();
  return Promise.all(
    files.map(async ({ filePath, stat }) => {
      const payload = await readJsonFile(filePath);
      return {
        file_path: filePath,
        file_name: path.basename(filePath),
        generated_at: stat?.mtime?.toISOString?.() || null,
        batch_name: payload?.batch_name || null,
        validated_count: toSafeNumber(payload?.validated_count, 0),
        records: Array.isArray(payload?.records) ? payload.records : [],
        score_summary: payload?.score_summary || {},
        issues: Array.isArray(payload?.issues) ? payload.issues : [],
      };
    })
  );
}

function buildAttentionSummary(reviewItem = {}) {
  const suggestion = reviewItem?.suggestions || {};
  const parts = [];
  const checks = [];

  if (reviewItem.review_priority) {
    parts.push(
      `priority=${reviewItem.review_priority} (${reviewItem.review_priority_score ?? 0})`
    );
  }
  if (reviewItem.suggested_batch) {
    parts.push(`batch=${reviewItem.suggested_batch}`);
  }
  if (reviewItem.has_material_conflict) {
    parts.push("material conflict");
    checks.push("Compare the conflicting suggestions before choosing operator_action.");
  }
  if (reviewItem.deep_review_recommended) {
    parts.push("deep review recommended");
    checks.push("Consider deep review if the record still feels ambiguous.");
  }
  if (reviewItem.operator_attention_needed) {
    parts.push("attention needed");
  }
  if (suggestion.impact_status === "impact_pending" || reviewItem.impact_status === "impact_pending") {
    parts.push("impact pending");
    checks.push("Import can proceed only with impact outcome scoring deferred.");
  }
  if (
    Array.isArray(suggestion.source_warnings) && suggestion.source_warnings.length
    || Array.isArray(suggestion.missing_source_warnings) && suggestion.missing_source_warnings.length
  ) {
    checks.push("Check the sources and make sure the evidence still supports the record.");
  }
  if (
    Array.isArray(suggestion.evidence_needed_to_reduce_risk) &&
    suggestion.evidence_needed_to_reduce_risk.length
  ) {
    checks.push("Look at the evidence gaps before moving this item toward import.");
  }

  return {
    attention_summary: parts.join("; ") || "standard review item",
    suggested_checks: checks,
  };
}

function queueManualItems(queuePayload) {
  return Array.isArray(queuePayload?.items)
    ? queuePayload.items.filter((item) => item && typeof item === "object")
    : [];
}

function queueAutoApprovedItems(queuePayload) {
  return Array.isArray(queuePayload?.auto_approved_items)
    ? queuePayload.auto_approved_items.filter((item) => item && typeof item === "object")
    : [];
}

function queueAutoRejectedItems(queuePayload) {
  return Array.isArray(queuePayload?.auto_rejected_items)
    ? queuePayload.auto_rejected_items.filter((item) => item && typeof item === "object")
    : [];
}

function queueImportCandidateItems(queuePayload) {
  return [
    ...queueAutoApprovedItems(queuePayload),
    ...queueManualItems(queuePayload).filter(
      (item) => Boolean(item.approved) || normalizeString(item.operator_status) === "approved"
    ),
  ];
}

function queueHasManualOnlyScope(queuePayload) {
  return (
    normalizeString(queuePayload?.promotion_state?.queue_scope) === "manual_queue_only" ||
    queueAutoApprovedItems(queuePayload).length > 0 ||
    queueAutoRejectedItems(queuePayload).length > 0
  );
}

function buildWorkspaceReviewItems(reviewReport, decisionTemplate, latestDecision, queuePayload) {
  const templateBySlug = new Map(
    (decisionTemplate?.items || []).map((item) => [item.slug, item])
  );
  const latestDecisionBySlug = new Map(
    (latestDecision?.items || []).map((item) => [item.slug, item])
  );
  const manualQueueSlugs = queueHasManualOnlyScope(queuePayload)
    ? new Set(
        queueManualItems(queuePayload)
          .map((item) => normalizeString(item.slug))
          .filter(Boolean)
      )
    : null;
  const sourceItems = manualQueueSlugs
    ? (reviewReport?.items || []).filter((item) => manualQueueSlugs.has(normalizeString(item?.slug)))
    : reviewReport?.items || [];

  return sourceItems.map((item, index) => {
    const templateItem = templateBySlug.get(item.slug);
    const lastDecision = latestDecisionBySlug.get(item.slug);
    const displayBits = templateItem || buildAttentionSummary(item);
    const impactStatus =
      normalizeString(templateItem?.impact_status) ||
      normalizeString(item?.impact_status) ||
      normalizeString(item?.suggestions?.impact_status) ||
      null;
    return {
      index: index + 1,
      slug: item.slug,
      title: item.title,
      review_priority: item.review_priority,
      review_priority_score: item.review_priority_score,
      suggested_batch: item.suggested_batch,
      operator_attention_needed: Boolean(item.operator_attention_needed),
      has_material_conflict: Boolean(item.has_material_conflict),
      deep_review_recommended: Boolean(item.deep_review_recommended),
      manual_review_severity: item.manual_review_severity || null,
      impact_status: impactStatus,
      ai_recommended_action:
        templateItem?.ai_recommended_action ||
        item?.recommended_action ||
        item?.suggestions?.recommended_action ||
        null,
      attention_summary: displayBits.attention_summary,
      suggested_checks: displayBits.suggested_checks || [],
      ai_record_action_suggestion:
        templateItem?.ai_record_action_suggestion ||
        item?.suggestions?.record_action_suggestion ||
        null,
      operator_action:
        normalizeString(templateItem?.operator_action) ||
        normalizeString(lastDecision?.operator_action) ||
        "",
      operator_notes:
        normalizeString(templateItem?.operator_notes) ||
        normalizeString(lastDecision?.operator_notes) ||
        "",
      final_decision_summary:
        normalizeString(templateItem?.final_decision_summary) ||
        normalizeString(lastDecision?.final_decision_summary) ||
        "",
    };
  });
}

function isImportReadyPrecommit(precommitReport) {
  return ["ready", "ready_with_warnings"].includes(
    normalizeString(precommitReport?.readiness_status)
  );
}

function buildBatchStage({
  normalizedExists,
  reviewReport,
  decisionLog,
  queueExists,
  precommitReport,
  importDryRun,
  importApply,
}) {
  if (!normalizedExists && !reviewReport) {
    return "DISCOVERY_READY";
  }
  if (normalizedExists && !reviewReport) {
    return "NORMALIZED";
  }
  if (reviewReport && (!decisionLog || !queueExists)) {
    return "REVIEW_READY";
  }
  if (decisionLog && queueExists && !precommitReport) {
    return "QUEUE_READY";
  }
  if (precommitReport && !isImportReadyPrecommit(precommitReport)) {
    return "BLOCKED";
  }
  if (precommitReport && isImportReadyPrecommit(precommitReport) && !importDryRun) {
    return "PRECOMMIT_READY";
  }
  if (importDryRun && !importApply) {
    return "IMPORT_READY";
  }
  if (importApply) {
    return "COMPLETE";
  }
  return "REVIEW_READY";
}

function buildWorkspaceCounts(reviewItems) {
  return reviewItems.reduce(
    (bucket, item) => {
      bucket.total_items += 1;
      if (!item.operator_action) {
        bucket.pending += 1;
        bucket.pending_review += 1;
      } else if (["approve_as_is", "approve_with_changes"].includes(item.operator_action)) {
        bucket.approved += 1;
        bucket.approval_style_decisions += 1;
      } else {
        bucket.blocked += 1;
        bucket.held_for_followup += 1;
      }
      return bucket;
    },
    {
      total_items: 0,
      approved: 0,
      pending: 0,
      blocked: 0,
      approval_style_decisions: 0,
      pending_review: 0,
      held_for_followup: 0,
    }
  );
}

function buildCurrentAdminImportReadiness(queuePayload, precommitReport, reviewCounts) {
  const queueItems = queueManualItems(queuePayload);
  const autoApprovedItems = queueAutoApprovedItems(queuePayload);
  const autoRejectedItems = queueAutoRejectedItems(queuePayload);
  const importCandidateItems = queueImportCandidateItems(queuePayload);
  const queueApprovedForImportCount = importCandidateItems.length;
  const queuePendingManualReviewCount = queueItems.filter(
    (item) =>
      item &&
      typeof item === "object" &&
      normalizeString(item.operator_status) === "pending_manual_review"
  ).length;
  const queuePendingCount = queueItems.filter((item) => {
    if (!item || typeof item !== "object") {
      return false;
    }
    const operatorStatus = normalizeString(item.operator_status);
    return !operatorStatus || operatorStatus === "pending";
  }).length;
  const approvalStyleDecisionCount = toSafeNumber(
    reviewCounts?.approval_style_decisions,
    0
  );
  const pendingReviewCount = toSafeNumber(reviewCounts?.pending_review, 0);
  const heldForFollowupCount = toSafeNumber(reviewCounts?.held_for_followup, 0);
  const needsQueueSync =
    approvalStyleDecisionCount > 0 &&
    queueApprovedForImportCount === 0 &&
    !precommitReport;

  if (precommitReport) {
    return {
      queue_item_count: queueItems.length,
      auto_approved_item_count: autoApprovedItems.length,
      auto_rejected_item_count: autoRejectedItems.length,
      queue_approved_for_import_count: queueApprovedForImportCount,
      queue_pending_manual_review_count: queuePendingManualReviewCount,
      queue_pending_count: queuePendingCount,
      approval_style_decision_count: approvalStyleDecisionCount,
      held_for_followup_count: heldForFollowupCount,
      pending_review_count: pendingReviewCount,
      selected_for_import_count: toSafeNumber(
        precommitReport.selected_for_import_count,
        queueApprovedForImportCount
      ),
      decision_covered_count: toSafeNumber(precommitReport.decision_covered_count, 0),
      decision_missing_count: toSafeNumber(precommitReport.decision_missing_count, 0),
      invalid_operator_action_count: toSafeNumber(
        precommitReport.invalid_operator_action_count,
        0
      ),
      unresolved_manual_review_count: toSafeNumber(
        precommitReport.unresolved_manual_review_count,
        0
      ),
      readiness_status: normalizeString(precommitReport.readiness_status) || "blocked",
      readiness_label:
        normalizeString(precommitReport.readiness_label) || "Blocked",
      readiness_explanation:
        normalizeString(precommitReport.recommended_next_step) ||
        normalizeString(precommitReport.readiness_explanation) ||
        "Resolve the pre-commit blockers before apply can continue.",
      blocking_issues: Array.isArray(precommitReport.blocking_issues)
        ? precommitReport.blocking_issues
        : [],
      needs_queue_sync: false,
    };
  }

  if (needsQueueSync) {
    return {
      queue_item_count: queueItems.length,
      auto_approved_item_count: autoApprovedItems.length,
      auto_rejected_item_count: autoRejectedItems.length,
      queue_approved_for_import_count: queueApprovedForImportCount,
      queue_pending_manual_review_count: queuePendingManualReviewCount,
      queue_pending_count: queuePendingCount,
      approval_style_decision_count: approvalStyleDecisionCount,
      held_for_followup_count: heldForFollowupCount,
      pending_review_count: pendingReviewCount,
      selected_for_import_count: queueApprovedForImportCount,
      decision_covered_count: 0,
      decision_missing_count: 0,
      invalid_operator_action_count: 0,
      unresolved_manual_review_count: queuePendingManualReviewCount,
      readiness_status: "blocked",
      readiness_label: "Queue Sync Needed",
      readiness_explanation: `${approvalStyleDecisionCount} review decision(s) are marked import-ready, but the manual review queue still has 0 items approved for import. Finalize again to refresh queue approval state, then rerun pre-commit.`,
      blocking_issues: [],
      needs_queue_sync: true,
    };
  }

  if (queueApprovedForImportCount > 0) {
    return {
      queue_item_count: queueItems.length,
      auto_approved_item_count: autoApprovedItems.length,
      auto_rejected_item_count: autoRejectedItems.length,
      queue_approved_for_import_count: queueApprovedForImportCount,
      queue_pending_manual_review_count: queuePendingManualReviewCount,
      queue_pending_count: queuePendingCount,
      approval_style_decision_count: approvalStyleDecisionCount,
      held_for_followup_count: heldForFollowupCount,
      pending_review_count: pendingReviewCount,
      selected_for_import_count: queueApprovedForImportCount,
      decision_covered_count: queueApprovedForImportCount,
      decision_missing_count: 0,
      invalid_operator_action_count: 0,
      unresolved_manual_review_count: queuePendingManualReviewCount,
      readiness_status: "queue_ready",
      readiness_label: "Queue Ready",
      readiness_explanation: `${queueApprovedForImportCount} queue item(s) are approved for import. The next step is the guarded pre-commit / dry-run path.`,
      blocking_issues: [],
      needs_queue_sync: false,
    };
  }

  if (heldForFollowupCount > 0 && pendingReviewCount === 0) {
    return {
      queue_item_count: queueItems.length,
      auto_approved_item_count: autoApprovedItems.length,
      auto_rejected_item_count: autoRejectedItems.length,
      queue_approved_for_import_count: queueApprovedForImportCount,
      queue_pending_manual_review_count: queuePendingManualReviewCount,
      queue_pending_count: queuePendingCount,
      approval_style_decision_count: approvalStyleDecisionCount,
      held_for_followup_count: heldForFollowupCount,
      pending_review_count: pendingReviewCount,
      selected_for_import_count: queueApprovedForImportCount,
      decision_covered_count: 0,
      decision_missing_count: 0,
      invalid_operator_action_count: 0,
      unresolved_manual_review_count: queuePendingManualReviewCount,
      readiness_status: "blocked",
      readiness_label: "Reviewed, Not Import-Eligible",
      readiness_explanation:
        "Operator review is complete, but every reviewed item is still held back from import. Change the intended import rows to an approval action before running pre-commit.",
      blocking_issues: [],
      needs_queue_sync: false,
    };
  }

  return {
    queue_item_count: queueItems.length,
    auto_approved_item_count: autoApprovedItems.length,
    auto_rejected_item_count: autoRejectedItems.length,
    queue_approved_for_import_count: queueApprovedForImportCount,
    queue_pending_manual_review_count: queuePendingManualReviewCount,
    queue_pending_count: queuePendingCount,
    approval_style_decision_count: approvalStyleDecisionCount,
    held_for_followup_count: heldForFollowupCount,
    pending_review_count: pendingReviewCount,
    selected_for_import_count: queueApprovedForImportCount,
    decision_covered_count: 0,
    decision_missing_count: 0,
    invalid_operator_action_count: 0,
    unresolved_manual_review_count: queuePendingManualReviewCount,
    readiness_status: "review_in_progress",
    readiness_label: "Review In Progress",
    readiness_explanation:
      "Finish operator review and finalize the decision log before import readiness can be determined.",
    blocking_issues: [],
    needs_queue_sync: false,
  };
}

function buildCurrentAdminQueuePromotionState(queuePayload) {
  const promotionState = queuePayload?.promotion_state;
  if (!promotionState || typeof promotionState !== "object") {
    return {
      promoted: false,
      status_label: "No review promotion",
      operator_hint: "No enriched review artifact has been promoted into the canonical queue.",
    };
  }
  return {
    promoted: Boolean(promotionState.promoted),
    promotion_mode: normalizeString(promotionState.promotion_mode) || null,
    promoted_at: normalizeString(promotionState.promoted_at) || null,
    source_review_path: normalizeString(promotionState.source_review_path) || null,
    source_batch_path: normalizeString(promotionState.source_batch_path) || null,
    decision_template_path: normalizeString(promotionState.decision_template_path) || null,
    decision_log_path: normalizeString(promotionState.decision_log_path) || null,
    previous_queue_backup_path:
      normalizeString(promotionState.previous_queue_backup_path) || null,
    previous_decision_template_backup_path:
      normalizeString(promotionState.previous_decision_template_backup_path) || null,
    queue_scope: normalizeString(promotionState.queue_scope) || null,
    approved_item_count: toSafeNumber(promotionState.approved_item_count, 0),
    auto_approved_item_count: toSafeNumber(promotionState.auto_approved_item_count, 0),
    auto_rejected_item_count: toSafeNumber(promotionState.auto_rejected_item_count, 0),
    manual_review_item_count: toSafeNumber(promotionState.manual_review_item_count, 0),
    reviewed_item_count: toSafeNumber(promotionState.reviewed_item_count, 0),
    pending_impact_item_count: toSafeNumber(
      promotionState.pending_impact_item_count,
      0
    ),
    impact_outcomes_deferred: Boolean(promotionState.impact_outcomes_deferred),
    status_label:
      normalizeString(promotionState.queue_scope) === "manual_queue_only"
        ? "AI-First Manual Queue"
        : "Promoted Review Queue",
    operator_hint: `${toSafeNumber(
      promotionState.auto_approved_item_count ?? promotionState.approved_item_count,
      0
    )} auto-approved • ${toSafeNumber(
      promotionState.auto_rejected_item_count,
      0
    )} auto-rejected • ${toSafeNumber(
      promotionState.manual_review_item_count,
      0
    )} item(s) left for manual review.`,
  };
}

function buildReviewOverviewPayload(reviewReports) {
  const latestReview = reviewReports[0] || null;

  return {
    latest_review: latestReview
      ? {
          file_path: latestReview.file_path,
          generated_at: latestReview.generated_at,
          batch_name: latestReview.batch_name,
          model: latestReview.model,
          review_mode: latestReview.review_mode,
        }
      : null,
    total_review_reports: reviewReports.length,
    review_overview: latestReview
      ? {
          reviewed_count: latestReview.reviewed_count,
          review_priority_counts: latestReview.review_priority_counts,
          suggested_batch_counts: latestReview.suggested_batch_counts,
          items_needing_attention: latestReview.items_needing_attention,
          items_with_material_conflicts: latestReview.items_with_material_conflicts,
          items_recommended_for_deep_review:
            latestReview.items_recommended_for_deep_review,
          average_review_risk_score: latestReview.average_review_risk_score,
          average_operator_friction_score:
            latestReview.average_operator_friction_score,
        }
      : {
          reviewed_count: 0,
          review_priority_counts: {},
          suggested_batch_counts: {},
          items_needing_attention: 0,
          items_with_material_conflicts: 0,
          items_recommended_for_deep_review: 0,
          average_review_risk_score: null,
          average_operator_friction_score: null,
        },
    refinement_formulas: {
      review_risk_score: REVIEW_RISK_FORMULA,
      operator_friction_score: OPERATOR_FRICTION_FORMULA,
    },
  };
}

function buildDecisionMetricsPayload(decisionLogs) {
  const actionCounts = {};
  const alignmentCounts = { match: 0, mismatch: 0 };
  const actionsBySessionFocus = {};

  for (const session of decisionLogs) {
    const focus = session.session_focus || "unspecified";
    if (!actionsBySessionFocus[focus]) {
      actionsBySessionFocus[focus] = {};
    }

    for (const [action, count] of Object.entries(session.operator_action_counts || {})) {
      incrementCounter(actionCounts, action, count);
      incrementCounter(actionsBySessionFocus[focus], action, count);
    }

    alignmentCounts.match += toSafeNumber(session.decision_counts?.match, 0);
    alignmentCounts.mismatch += toSafeNumber(session.decision_counts?.mismatch, 0);
  }

  return {
    total_decision_log_sessions: decisionLogs.length,
    total_logged_decisions: decisionLogs.reduce(
      (total, session) => total + session.items.length,
      0
    ),
    operator_action_counts: sortCounter(actionCounts),
    alignment_counts: alignmentCounts,
    actions_by_session_focus: Object.fromEntries(
      Object.entries(actionsBySessionFocus)
        .map(([focus, bucket]) => [focus, sortCounter(bucket)])
        .sort((a, b) => a[0].localeCompare(b[0]))
    ),
    recent_sessions: decisionLogs.slice(0, 10).map((session) => ({
      session_id: session.session_id,
      generated_at: session.generated_at,
      session_focus: session.session_focus,
      item_count: session.items.length,
      match_count: toSafeNumber(session.decision_counts?.match, 0),
      mismatch_count: toSafeNumber(session.decision_counts?.mismatch, 0),
      operator_action_counts: session.operator_action_counts,
    })),
  };
}

function buildTrendPayload(reviewReports, decisionLogs) {
  const allReviewItems = reviewReports.flatMap((report) =>
    report.items.map((item) => ({
      batch_name: report.batch_name,
      generated_at: report.generated_at,
      ...item,
    }))
  );
  const allDecisionItems = decisionLogs.flatMap((session) =>
    session.items.map((item) => ({
      session_id: session.session_id,
      session_focus: session.session_focus,
      generated_at: session.generated_at,
      ...item,
    }))
  );

  return {
    review_reports_by_date: summarizeByDate(
      reviewReports,
      (report) => toIsoDate(report.generated_at),
      (report) => report.reviewed_count || 0
    ),
    decision_sessions_by_date: summarizeByDate(
      decisionLogs,
      (session) => toIsoDate(session.generated_at),
      () => 1
    ),
    logged_decisions_by_date: summarizeByDate(
      decisionLogs,
      (session) => toIsoDate(session.generated_at),
      (session) => session.items.length
    ),
    review_priority_distribution: sortCounter(
      allReviewItems.reduce((bucket, item) => {
        incrementCounter(bucket, item.review_priority);
        return bucket;
      }, {})
    ),
    suggested_batch_distribution: sortCounter(
      allReviewItems.reduce((bucket, item) => {
        incrementCounter(bucket, item.suggested_batch);
        return bucket;
      }, {})
    ),
    session_focus_distribution: sortCounter(
      decisionLogs.reduce((bucket, session) => {
        incrementCounter(bucket, session.session_focus || "unspecified");
        return bucket;
      }, {})
    ),
    alignment_by_priority: Object.fromEntries(
      ["low", "medium", "high"].map((priority) => {
        const items = allDecisionItems.filter(
          (item) => item.review_item?.review_priority === priority
        );
        return [
          priority,
          {
            total: items.length,
            mismatch_count: items.filter(
              (item) => item.decision_alignment === "mismatch"
            ).length,
          },
        ];
      })
    ),
    alignment_by_suggested_batch: Object.fromEntries(
      Object.entries(
        allDecisionItems.reduce((bucket, item) => {
          const batch = item.review_item?.suggested_batch || item.suggested_batch || "unknown";
          if (!bucket[batch]) {
            bucket[batch] = { total: 0, mismatch_count: 0 };
          }
          bucket[batch].total += 1;
          if (item.decision_alignment === "mismatch") {
            bucket[batch].mismatch_count += 1;
          }
          return bucket;
        }, {})
      ).sort((a, b) => a[0].localeCompare(b[0]))
    ),
  };
}

function buildFeedbackSummary(decisionLogs) {
  const enrichedItems = decisionLogs.flatMap((session) =>
    session.items.map((item) => ({
      ...item,
      session_id: session.session_id,
      session_focus: session.session_focus,
    }))
  );

  const totalMatches = enrichedItems.filter(
    (item) => item.decision_alignment === "match"
  ).length;
  const totalMismatches = enrichedItems.filter(
    (item) => item.decision_alignment === "mismatch"
  ).length;
  const totalItems = enrichedItems.length;

  const matches = enrichedItems.filter(
    (item) => item.decision_alignment === "match"
  );
  const mismatches = enrichedItems.filter(
    (item) => item.decision_alignment === "mismatch"
  );

  const confidenceFor = (items) =>
    items
      .map((item) => toSafeNumber(item.ai_suggestions_snapshot?.confidence_score, NaN))
      .filter((value) => Number.isFinite(value));

  const mismatchCountsByOperatorAction = sortCounter(
    mismatches.reduce((bucket, item) => {
      incrementCounter(bucket, item.operator_action);
      return bucket;
    }, {})
  );
  const mismatchCountsByAiAction = sortCounter(
    mismatches.reduce((bucket, item) => {
      incrementCounter(bucket, item.ai_record_action_suggestion || "unknown");
      return bucket;
    }, {})
  );
  const mismatchCountsBySuggestedBatch = sortCounter(
    mismatches.reduce((bucket, item) => {
      incrementCounter(
        bucket,
        item.review_item?.suggested_batch || item.suggested_batch || "unknown"
      );
      return bucket;
    }, {})
  );
  const mismatchCountsByReviewPriority = sortCounter(
    mismatches.reduce((bucket, item) => {
      incrementCounter(
        bucket,
        item.review_item?.review_priority || item.review_priority || "unknown"
      );
      return bucket;
    }, {})
  );

  const diagnostics = {
    total_match_count: totalMatches,
    total_mismatch_count: totalMismatches,
    alignment_rate: totalItems ? Number((totalMatches / totalItems).toFixed(3)) : 0,
    mismatches_by_operator_action: mismatchCountsByOperatorAction,
    mismatches_by_ai_record_action_suggestion: mismatchCountsByAiAction,
    mismatches_by_suggested_batch: mismatchCountsBySuggestedBatch,
    mismatches_by_review_priority: mismatchCountsByReviewPriority,
    average_confidence_for_matches: average(confidenceFor(matches)),
    average_confidence_for_mismatches: average(confidenceFor(mismatches)),
    high_confidence_mismatches: mismatches.filter(
      (item) => toSafeNumber(item.ai_suggestions_snapshot?.confidence_score, 0) >= 0.8
    ).length,
    low_confidence_matches: matches.filter(
      (item) => toSafeNumber(item.ai_suggestions_snapshot?.confidence_score, 1) < 0.55
    ).length,
    confidence_buckets: Object.fromEntries(
      ["high", "medium", "low"].map((bucket) => [
        bucket,
        {
          total: enrichedItems.filter(
            (item) =>
              confidenceBucket(
                toSafeNumber(item.ai_suggestions_snapshot?.confidence_score, 0.5)
              ) === bucket
          ).length,
          mismatch_count: enrichedItems.filter(
            (item) =>
              confidenceBucket(
                toSafeNumber(item.ai_suggestions_snapshot?.confidence_score, 0.5)
              ) === bucket && item.decision_alignment === "mismatch"
          ).length,
        },
      ])
    ),
    mismatch_rate_with_material_conflicts: buildConditionalMismatchRate(
      enrichedItems,
      (item) => Boolean(item.review_item?.has_material_conflict)
    ),
    mismatch_rate_for_deep_review_recommended: buildConditionalMismatchRate(
      enrichedItems,
      (item) => Boolean(item.review_item?.deep_review_recommended)
    ),
    mismatch_rate_for_deep_review_ran: buildConditionalMismatchRate(
      enrichedItems,
      (item) => Boolean(item.review_item?.deep_review_ran)
    ),
  };

  const refinementProfiles = enrichedItems.map((item) => item.refined_review_profile);
  const refinementSummary = {
    formulas: {
      review_risk_score: REVIEW_RISK_FORMULA,
      operator_friction_score: OPERATOR_FRICTION_FORMULA,
    },
    average_review_risk_score: average(
      refinementProfiles.map((profile) => profile.review_risk_score)
    ),
    average_operator_friction_score: average(
      refinementProfiles.map((profile) => profile.operator_friction_score)
    ),
    review_risk_level_counts: sortCounter(
      refinementProfiles.reduce((bucket, profile) => {
        incrementCounter(bucket, profile.review_risk_level);
        return bucket;
      }, {})
    ),
    operator_friction_level_counts: sortCounter(
      refinementProfiles.reduce((bucket, profile) => {
        incrementCounter(bucket, profile.operator_friction_level);
        return bucket;
      }, {})
    ),
    suggested_batch_profiles: Object.entries(
      enrichedItems.reduce((bucket, item) => {
        const key = item.review_item?.suggested_batch || item.suggested_batch || "unknown";
        if (!bucket[key]) {
          bucket[key] = {
            suggested_batch: key,
            item_count: 0,
            review_risk_scores: [],
            operator_friction_scores: [],
          };
        }
        bucket[key].item_count += 1;
        bucket[key].review_risk_scores.push(item.refined_review_profile.review_risk_score);
        bucket[key].operator_friction_scores.push(
          item.refined_review_profile.operator_friction_score
        );
        return bucket;
      }, {})
    )
      .map(([, bucket]) => ({
        suggested_batch: bucket.suggested_batch,
        item_count: bucket.item_count,
        average_review_risk_score: average(bucket.review_risk_scores),
        average_operator_friction_score: average(bucket.operator_friction_scores),
      }))
      .sort((a, b) => b.item_count - a.item_count || a.suggested_batch.localeCompare(b.suggested_batch)),
  };

  const keyFindings = [];
  if (diagnostics.high_confidence_mismatches > 0) {
    keyFindings.push(
      `${diagnostics.high_confidence_mismatches} high-confidence AI suggestions still mismatched operator decisions.`
    );
  }
  if (
    diagnostics.mismatch_rate_with_material_conflicts.rate != null &&
    diagnostics.mismatch_rate_with_material_conflicts.rate > 0
  ) {
    keyFindings.push(
      `Items with material conflicts show a ${diagnostics.mismatch_rate_with_material_conflicts.rate} mismatch rate.`
    );
  }
  if (
    refinementSummary.average_operator_friction_score != null &&
    refinementSummary.average_operator_friction_score >= 5
  ) {
    keyFindings.push(
      "Operator friction remains elevated, suggesting the current-admin review slice is still labor-intensive."
    );
  }

  return {
    generated_at: new Date().toISOString(),
    source_log_files: decisionLogs.map((session) => session.file_path),
    source_review_files: [
      ...new Set(
        decisionLogs
          .map((session) => session.source_review_file)
          .filter(Boolean)
      ),
    ],
    total_sessions: decisionLogs.length,
    total_logged_items: totalItems,
    alignment_analytics: diagnostics,
    refinement_summary: refinementSummary,
    key_findings: keyFindings,
  };
}

function buildWorkflowGuidePayload(reviewReports, decisionLogs, precommitReports) {
  const latestReview = reviewReports[0] || null;
  const latestDecision = decisionLogs[0] || null;
  const latestPrecommit = precommitReports[0] || null;
  const batchName = latestReview?.batch_name || null;
  const queuePath = batchName
    ? path.join(CURRENT_ADMIN_REPORTS_DIR, `${batchName}.manual-review-queue.json`)
    : null;
  const decisionTemplatePath = batchName
    ? path.join(CURRENT_ADMIN_REPORTS_DIR, `${batchName}.decision-template.json`)
    : null;
  const precommitPath = batchName
    ? path.join(CURRENT_ADMIN_REPORTS_DIR, `${batchName}.pre-commit-review.json`)
    : null;
  const latestPrecommitMatchesBatch =
    latestPrecommit && latestPrecommit.batch_name === batchName;
  const latestPrecommitBlockingTypes = Array.isArray(latestPrecommit?.blocking_issues)
    ? latestPrecommit.blocking_issues
        .map((issue) => normalizeString(issue?.type))
        .filter(Boolean)
    : [];
  const reviewFixTypes = new Set([
    "no_approved_queue_items",
    "missing_decision_coverage",
    "invalid_operator_action",
    "operator_action_not_import_ready",
  ]);
  const blockedPrecommitNeedsReview = latestPrecommitBlockingTypes.some((type) =>
    reviewFixTypes.has(type)
  );

  let nextStep = "start_or_resume_review";
  let nextCommands = [
    "./bin/equitystack current-admin status",
  ];
  const nextStepLabels = {
    start_or_resume_review: "Start or resume the canonical current-admin workflow",
    generate_decision_template: "Generate a decision template from the latest review artifact",
    pre_commit_review: "Run the read-only pre-commit import review",
    resolve_pre_commit_blockers: "Resolve the pre-commit blockers before import",
    dry_run_import: "Run a dry-run import from the manual review queue",
  };

  if (latestReview && !latestDecision) {
    nextStep = "generate_decision_template";
    nextCommands = [
      `./bin/equitystack current-admin workflow review --input ${path.relative(PYTHON_DIR, latestReview.file_path)} --output /tmp/${batchName}.decision-template.json`,
      `./bin/equitystack current-admin workflow resume`,
    ];
  } else if (latestReview && latestDecision && !latestPrecommitMatchesBatch) {
    nextStep = "pre_commit_review";
    nextCommands = queuePath
      ? [
          `./bin/equitystack current-admin pre-commit --input ${path.relative(PYTHON_DIR, queuePath)}`,
          `./bin/equitystack current-admin workflow resume`,
        ]
      : ["./bin/equitystack current-admin workflow resume"];
  } else if (
    latestReview &&
    latestDecision &&
    latestPrecommitMatchesBatch &&
    latestPrecommit.readiness_status === "blocked"
  ) {
    nextStep = "resolve_pre_commit_blockers";
    if (blockedPrecommitNeedsReview) {
      nextCommands = [
        `./bin/equitystack current-admin review --input ${path.relative(PYTHON_DIR, latestReview.file_path)} --decision-file ${path.relative(PYTHON_DIR, decisionTemplatePath)}`,
        `./bin/equitystack current-admin workflow resume`,
      ];
    } else {
      nextCommands = queuePath
        ? [
            `./bin/equitystack current-admin pre-commit --input ${path.relative(PYTHON_DIR, queuePath)}`,
            `./bin/equitystack current-admin workflow resume`,
          ]
        : ["./bin/equitystack current-admin workflow resume"];
    }
  } else if (latestReview && latestDecision) {
    nextStep = "dry_run_import";
    nextCommands = queuePath
      ? [
          `./bin/equitystack current-admin import --input ${path.relative(PYTHON_DIR, queuePath)}`,
          `./bin/equitystack current-admin status --batch-name ${batchName}`,
        ]
      : ["./bin/equitystack current-admin workflow resume"];
  }

  return {
    canonical_process: {
      source_of_truth:
        "Python current-admin pipeline artifacts under python/reports/current_admin/",
      dashboard_role:
        "Admin control surface that wraps the canonical Python workflow; not a second review-generation or import pipeline.",
    },
    latest_review: latestReview
      ? {
          file_path: latestReview.file_path,
          batch_name: latestReview.batch_name,
          generated_at: latestReview.generated_at,
          model: latestReview.model,
          review_mode: latestReview.review_mode,
          reviewed_count: latestReview.reviewed_count,
        }
      : null,
    latest_decision_session: latestDecision
      ? {
          file_path: latestDecision.file_path,
          session_id: latestDecision.session_id,
          generated_at: latestDecision.generated_at,
          session_focus: latestDecision.session_focus,
          item_count: latestDecision.items.length,
          worklist_used: latestDecision.worklist_used,
        }
      : null,
    latest_pre_commit_review: latestPrecommitMatchesBatch
      ? {
          file_path: latestPrecommit.file_path,
          generated_at: latestPrecommit.generated_at,
          readiness_status: latestPrecommit.readiness_status,
          selected_for_import_count: latestPrecommit.selected_for_import_count,
          decision_missing_count: latestPrecommit.decision_missing_count,
          blocking_issue_count: latestPrecommit.blocking_issues.length,
          blocking_issues: latestPrecommit.blocking_issues,
          warning_counts: latestPrecommit.warning_counts,
          recommended_next_step: latestPrecommit.recommended_next_step,
        }
      : null,
    artifact_paths: {
      review_reports_dir: CURRENT_ADMIN_REPORTS_DIR,
      decision_logs_dir: REVIEW_DECISIONS_DIR,
      feedback_dir: FEEDBACK_OUTPUT_DIR,
      current_queue_path: queuePath,
      suggested_decision_template_path: decisionTemplatePath,
      current_pre_commit_path: precommitPath,
    },
    workflow_handoff: {
      next_step: nextStep,
      next_step_label: nextStepLabels[nextStep] || nextStep,
      next_commands: nextCommands,
      operator_notes: [
        "Generate decision templates from canonical review/worklist artifacts before filling operator actions.",
        "Log operator decisions explicitly before import so AI-vs-operator outcomes remain auditable.",
        "Run a read-only pre-commit review before import so blocking issues and warning-heavy batches are explicit.",
        "Import remains a separate manual step and still requires explicit operator review.",
      ],
    },
  };
}

function buildConditionalMismatchRate(items, predicate) {
  const matchingItems = items.filter(predicate);
  const mismatchCount = matchingItems.filter(
    (item) => item.decision_alignment === "mismatch"
  ).length;
  return {
    total: matchingItems.length,
    mismatch_count: mismatchCount,
    rate:
      matchingItems.length > 0
        ? Number((mismatchCount / matchingItems.length).toFixed(3))
        : null,
  };
}

function buildActionPermission(allowed, reasons = []) {
  return {
    allowed,
    reasons: reasons.filter(Boolean),
  };
}

function buildCurrentAdminActionPermissions({
  hasBatch,
  reviewItems,
  queuePayload,
  queueExists,
  latestDecisionLog,
  latestPrecommit,
  latestDryRun,
  latestApply,
  batchState,
}) {
  const incompleteDecisionCount = reviewItems.filter(
    (item) => !normalizeString(item.operator_action)
  ).length;
  const manualQueueEmpty = queueHasManualOnlyScope(queuePayload) && reviewItems.length === 0;

  const finalizeReasons = [];
  if (!hasBatch) {
    finalizeReasons.push("No canonical current-admin review artifact is available.");
  }
  if (manualQueueEmpty) {
    finalizeReasons.push("No borderline manual-review items are waiting in this batch.");
  }
  if (incompleteDecisionCount > 0) {
    finalizeReasons.push(
      `${incompleteDecisionCount} review item(s) still need an explicit operator action before finalize.`
    );
  }
  if (batchState?.sidecars?.metadata_present && !batchState.finalize_safe) {
    finalizeReasons.push(
      batchState.blocker_text?.[0] ||
        batchState.operator_hint ||
        "OpenAI Batch review results are not safe to finalize yet."
    );
  }

  const precommitReasons = [];
  if (!queueExists) {
    precommitReasons.push("The canonical manual-review queue artifact is missing.");
  }
  if (!latestDecisionLog) {
    precommitReasons.push("Finalize the decision file so the canonical decision log exists first.");
  }
  if (incompleteDecisionCount > 0) {
    precommitReasons.push("Every reviewed item needs an explicit operator action before pre-commit.");
  }
  if (batchState?.sidecars?.metadata_present && !batchState.apply_safe) {
    precommitReasons.push(
      batchState.blocker_text?.[0] ||
        batchState.operator_hint ||
        "OpenAI Batch review results are not safe for the apply path yet."
    );
  }

  const importDryRunReasons = [];
  if (!queueExists) {
    importDryRunReasons.push("The canonical manual-review queue artifact is missing.");
  }
  if (!latestPrecommit) {
    importDryRunReasons.push("Run pre-commit first so import readiness is explicit.");
  } else if (!isImportReadyPrecommit(latestPrecommit)) {
    importDryRunReasons.push(
      latestPrecommit.readiness_explanation ||
        "The latest pre-commit artifact is blocked."
    );
  }
  if (batchState?.sidecars?.metadata_present && !batchState.apply_safe) {
    importDryRunReasons.push(
      batchState.blocker_text?.[0] ||
        batchState.operator_hint ||
        "OpenAI Batch review results are not safe for the apply path yet."
    );
  }

  const applyReasons = [...importDryRunReasons];
  if (!latestDryRun) {
    applyReasons.push("Run a dry-run import for this batch before applying.");
  }

  const validateReasons = [];
  if (!latestApply) {
    validateReasons.push("Run an apply import for this batch before validation.");
  }

  return {
    save_decision_draft: buildActionPermission(hasBatch, hasBatch ? [] : finalizeReasons),
    finalize: buildActionPermission(finalizeReasons.length === 0, finalizeReasons),
    run_precommit: buildActionPermission(precommitReasons.length === 0, precommitReasons),
    run_import_dry_run: buildActionPermission(
      importDryRunReasons.length === 0,
      importDryRunReasons
    ),
    apply_import: buildActionPermission(applyReasons.length === 0, applyReasons),
    validate_import: buildActionPermission(validateReasons.length === 0, validateReasons),
  };
}

function buildCurrentAdminBlockers({
  actionPermissions,
  latestPrecommit,
  batchState,
}) {
  const blockers = [];
  const nonBlockingFinalizeReasons = new Set([
    "No borderline manual-review items are waiting in this batch.",
  ]);

  for (const reason of actionPermissions.finalize.reasons) {
    if (!nonBlockingFinalizeReasons.has(reason)) {
      blockers.push(reason);
    }
  }
  for (const reason of actionPermissions.run_precommit.reasons) {
    blockers.push(reason);
  }
  if (latestPrecommit?.blocking_issues?.length) {
    blockers.push(
      ...latestPrecommit.blocking_issues.map(
        (issue) => issue.message || issue.fix || "Pre-commit blocker"
      )
    );
  }
  if (batchState?.sidecars?.metadata_present && batchState.blocker_text?.length) {
    blockers.push(...batchState.blocker_text);
  }

  return [...new Set(blockers)];
}

function buildArtifactEntry({
  label,
  path: filePath,
  exists,
  generatedAt = null,
  stage = null,
  summary = null,
}) {
  return {
    label,
    path: filePath,
    exists,
    generated_at: generatedAt,
    stage,
    summary,
  };
}

export async function getCurrentAdministrationReviewDashboardData() {
  const [reviewReports, decisionLogs, precommitReports, decisionTemplates, importDryRuns, importApplies, validationReports] = await Promise.all([
    loadReviewReports(),
    loadDecisionLogs(),
    loadPrecommitReports(),
    loadDecisionTemplates(),
    loadImportReports(listImportDryRunFiles, "dry-run"),
    loadImportReports(listImportApplyFiles, "apply"),
    loadValidationReports(),
  ]);

  return {
    reviewReports,
    decisionLogs,
    precommitReports,
    decisionTemplates,
    importDryRuns,
    importApplies,
    validationReports,
    reviewOverview: buildReviewOverviewPayload(reviewReports),
    decisionMetrics: buildDecisionMetricsPayload(decisionLogs),
    trendMetrics: buildTrendPayload(reviewReports, decisionLogs),
    feedbackSummary: buildFeedbackSummary(decisionLogs),
  };
}

export async function getCurrentAdministrationReviewOverview() {
  const { reviewOverview } = await getCurrentAdministrationReviewDashboardData();
  return reviewOverview;
}

export async function getCurrentAdministrationDecisionMetrics() {
  const { decisionMetrics, feedbackSummary } =
    await getCurrentAdministrationReviewDashboardData();
  return {
    ...decisionMetrics,
    alignment_analytics: feedbackSummary.alignment_analytics,
    refinement_summary: feedbackSummary.refinement_summary,
  };
}

export async function getCurrentAdministrationReviewTrends() {
  const { trendMetrics, reviewOverview } =
    await getCurrentAdministrationReviewDashboardData();
  return {
    ...trendMetrics,
    refinement_formulas: reviewOverview.refinement_formulas,
  };
}

export async function getCurrentAdministrationWorkflowGuide() {
  const { reviewReports, decisionLogs, precommitReports } =
    await getCurrentAdministrationReviewDashboardData();
  return buildWorkflowGuidePayload(reviewReports, decisionLogs, precommitReports);
}

export async function getCurrentAdministrationOperatorWorkspace() {
  const {
    reviewReports,
    decisionLogs,
    precommitReports,
    decisionTemplates,
    importDryRuns,
    importApplies,
    validationReports,
  } = await getCurrentAdministrationReviewDashboardData();

  const canonicalBatchFiles = await loadCanonicalBatchFiles();

  const latestBatchFile = canonicalBatchFiles[0] || null;
  const latestReviewOverall = reviewReports[0] || null;
  const batchName = latestBatchFile?.batch_name || latestReviewOverall?.batch_name || null;
  const activeBatchInputPath = latestBatchFile?.file_path || null;
  const latestReview = batchName
    ? reviewReports.find((entry) => entry.batch_name === batchName) || null
    : latestReviewOverall;
  const normalizedPath = batchName
    ? path.join(CURRENT_ADMIN_REPORTS_DIR, `${batchName}.normalized.json`)
    : null;
  const normalizationReportPath = batchName
    ? path.join(CURRENT_ADMIN_REPORTS_DIR, `${batchName}.normalization-report.json`)
    : null;
  const queuePath = batchName
    ? path.join(CURRENT_ADMIN_REPORTS_DIR, `${batchName}.manual-review-queue.json`)
    : null;
  const matchingTemplate = latestReview
    ? decisionTemplates.find(
        (entry) => entry.source_review_file === latestReview.file_path
      ) || null
    : null;
  const matchingDecisionLog = latestReview
    ? decisionLogs.find(
        (entry) => entry.source_review_file === latestReview.file_path
      ) || null
    : null;
  const matchingPrecommit = precommitReports.find(
    (entry) => entry.batch_name === batchName
  ) || null;
  const latestDryRun = importDryRuns.find((entry) => entry.batch_name === batchName) || null;
  const latestApply = importApplies.find((entry) => entry.batch_name === batchName) || null;
  const latestValidation = validationReports.find((entry) => entry.batch_name === batchName) || null;
  const normalizedStat = normalizedPath ? await statSafe(normalizedPath) : null;
  const normalizationReportStat = normalizationReportPath
    ? await statSafe(normalizationReportPath)
    : null;
  const queueStat = queuePath ? await statSafe(queuePath) : null;
  const queuePayload =
    queueStat && queuePath
      ? await readJsonFile(queuePath).catch(() => null)
      : null;
  const batchStates = await Promise.all(
    reviewReports.map((reviewReport) => buildCurrentAdminOpenAIBatchState(reviewReport))
  );
  const openAIBatchState = latestReview
    ? batchStates.find((entry) => entry?.review_artifact_path === latestReview.file_path) || null
    : null;
  const manualReviewState = await buildCurrentAdminManualReviewState({
    reviewReport: latestReview,
    decisionLogs,
    decisionTemplates,
    queuePayload,
  });
  const calibrationState = buildCurrentAdminCalibrationState({
    reviewReport: latestReview,
    manualReviewState,
    batchState: openAIBatchState,
  });
  const simulationState = buildCurrentAdminSimulationState({
    reviewReport: latestReview,
    manualReviewState,
  });
  const evidencePackState = await buildCurrentAdminEvidencePackState(latestReview);
  const comparisonState = await buildCurrentAdminComparisonState({
    reviewReports,
    latestReview,
  });
  const pairedEvaluationState = await buildCurrentAdminPairedEvaluationState(batchName);

  const reviewItems = buildWorkspaceReviewItems(
    latestReview,
    matchingTemplate,
    matchingDecisionLog,
    queuePayload
  );
  const counts = buildWorkspaceCounts(reviewItems);
  const importReadiness = buildCurrentAdminImportReadiness(
    queuePayload,
    matchingPrecommit,
    counts
  );
  const queuePromotionState = buildCurrentAdminQueuePromotionState(queuePayload);
  const stage = buildBatchStage({
    normalizedExists: Boolean(normalizedStat),
    reviewReport: latestReview,
    decisionLog: matchingDecisionLog,
    queueExists: Boolean(queueStat),
    precommitReport: matchingPrecommit,
    importDryRun: latestDryRun,
    importApply: latestApply,
  });
  const workflowGuide = buildWorkflowGuidePayload(
    reviewReports,
    decisionLogs,
    precommitReports
  );
  const reviewRuntime = latestReview
    ? {
        requested_model: latestReview.requested_model || latestReview.model || null,
        resolved_model: latestReview.resolved_model || null,
        review_backend: latestReview.review_backend || null,
        fallback_used: Boolean(latestReview.fallback_used),
        fallback_reason: latestReview.fallback_reason || null,
        fallback_model: latestReview.fallback_model || null,
        model_resolution_status: latestReview.model_resolution_status || null,
        fallback_count: toSafeNumber(latestReview.fallback_count, 0),
      }
    : null;
  const actionPermissions = buildCurrentAdminActionPermissions({
    hasBatch: Boolean(latestReview),
    reviewItems,
    queuePayload,
    queueExists: Boolean(queueStat),
    latestDecisionLog: matchingDecisionLog,
    latestPrecommit: matchingPrecommit,
    latestDryRun,
    latestApply,
    batchState: openAIBatchState,
  });
  const blockers = buildCurrentAdminBlockers({
    actionPermissions,
    latestPrecommit: matchingPrecommit,
    batchState: openAIBatchState,
  });
  const artifactStatus = {
    normalized_batch: buildArtifactEntry({
      label: "Normalized batch",
      path: normalizedPath,
      exists: Boolean(normalizedStat),
      generatedAt: normalizedStat?.mtime?.toISOString?.() || null,
      stage: "NORMALIZED",
    }),
    normalization_report: buildArtifactEntry({
      label: "Normalization report",
      path: normalizationReportPath,
      exists: Boolean(normalizationReportStat),
      generatedAt: normalizationReportStat?.mtime?.toISOString?.() || null,
      stage: "NORMALIZED",
    }),
    review_artifact: buildArtifactEntry({
      label: "AI review",
      path: latestReview?.file_path || null,
      exists: Boolean(latestReview),
      generatedAt: latestReview?.generated_at || null,
      stage: "REVIEW_READY",
      summary: latestReview
        ? [
            `${latestReview.reviewed_count} reviewed`,
            latestReview.model || latestReview.requested_model || "unknown model",
            latestReview.review_backend ? `backend ${latestReview.review_backend}` : null,
            latestReview.fallback_used
              ? `${toSafeNumber(latestReview.fallback_count, 0)} fallback item(s)`
              : null,
          ]
            .filter(Boolean)
            .join(" • ")
        : null,
    }),
    openai_batch_metadata: buildArtifactEntry({
      label: "OpenAI Batch metadata",
      path: openAIBatchState?.sidecars?.metadata_path || (latestReview ? deriveOpenAIBatchArtifactPath(latestReview.file_path, "meta.json") : null),
      exists: Boolean(openAIBatchState?.sidecars?.metadata_present),
      generatedAt: null,
      stage: "REVIEW_READY",
      summary: openAIBatchState
        ? [
            openAIBatchState.lifecycle_status,
            openAIBatchState.batch_id ? `batch ${openAIBatchState.batch_id}` : null,
            openAIBatchState.model || null,
          ]
            .filter(Boolean)
            .join(" • ")
        : null,
    }),
    openai_batch_validation: buildArtifactEntry({
      label: "OpenAI Batch validation",
      path: openAIBatchState?.sidecars?.validation_path || (latestReview ? deriveOpenAIBatchArtifactPath(latestReview.file_path, "validation.json") : null),
      exists: Boolean(openAIBatchState?.sidecars?.validation_present),
      generatedAt: null,
      stage: "REVIEW_READY",
      summary: openAIBatchState
        ? `${openAIBatchState.validation_counts.valid_items} valid • ${openAIBatchState.validation_counts.malformed_items} malformed • ${openAIBatchState.validation_counts.enum_errors} enum errors`
        : null,
    }),
    evidence_pack: buildArtifactEntry({
      label: "Evidence pack",
      path: evidencePackState?.artifact_path || (latestReview ? deriveCurrentAdminEvidencePackArtifactPath(latestReview.file_path) : null),
      exists: Boolean(evidencePackState?.artifact_present),
      generatedAt: null,
      stage: "REVIEW_READY",
      summary: evidencePackState?.artifact_present
        ? `${evidencePackState.model_facing_item_count} packed item(s)`
        : null,
    }),
    decision_template: buildArtifactEntry({
      label: "Decision template",
      path: matchingTemplate?.file_path || (batchName ? path.join(CURRENT_ADMIN_REPORTS_DIR, `${batchName}.decision-template.json`) : null),
      exists: Boolean(matchingTemplate),
      generatedAt: matchingTemplate?.generated_at || null,
      stage: "REVIEW_READY",
    }),
    decision_log: buildArtifactEntry({
      label: "Decision log",
      path: matchingDecisionLog?.file_path || null,
      exists: Boolean(matchingDecisionLog),
      generatedAt: matchingDecisionLog?.generated_at || null,
      stage: "QUEUE_READY",
      summary: matchingDecisionLog
        ? `${matchingDecisionLog.items.length} logged decisions`
        : null,
    }),
    manual_review_queue: buildArtifactEntry({
      label: "Manual review queue",
      path: queuePath,
      exists: Boolean(queueStat),
      generatedAt: queueStat?.mtime?.toISOString?.() || null,
      stage: "QUEUE_READY",
      summary: queueStat
        ? `${importReadiness.auto_approved_item_count || 0} auto-approved • ${importReadiness.queue_item_count || 0} in manual queue • ${importReadiness.auto_rejected_item_count || 0} auto-rejected`
        : null,
    }),
    pre_commit_review: buildArtifactEntry({
      label: "Pre-commit review",
      path: matchingPrecommit?.file_path || (batchName ? path.join(CURRENT_ADMIN_REPORTS_DIR, `${batchName}.pre-commit-review.json`) : null),
      exists: Boolean(matchingPrecommit),
      generatedAt: matchingPrecommit?.generated_at || null,
      stage: "PRECOMMIT_READY",
      summary: matchingPrecommit?.readiness_status || null,
    }),
    import_dry_run: buildArtifactEntry({
      label: "Import dry-run",
      path: latestDryRun?.file_path || null,
      exists: Boolean(latestDryRun),
      generatedAt: latestDryRun?.generated_at || null,
      stage: "IMPORT_READY",
    }),
    import_apply: buildArtifactEntry({
      label: "Import apply",
      path: latestApply?.file_path || null,
      exists: Boolean(latestApply),
      generatedAt: latestApply?.generated_at || null,
      stage: "COMPLETE",
    }),
    validation_report: buildArtifactEntry({
      label: "Validation report",
      path: latestValidation?.file_path || null,
      exists: Boolean(latestValidation),
      generatedAt: latestValidation?.generated_at || null,
      stage: "COMPLETE",
    }),
  };
  const provenance = await buildCurrentAdminProvenanceStatus({
    latestBatchFile,
    artifactStatus,
  });

  return {
    batch: batchName
      ? {
          batch_name: batchName,
          input_file: activeBatchInputPath,
          source: activeBatchInputPath ? "canonical_batch_file" : "canonical_review_artifact",
          stage,
          reviewed_count: latestReview?.reviewed_count || 0,
          model: latestReview?.model || null,
          review_mode: latestReview?.review_mode || null,
          generated_at: latestReview?.generated_at || latestBatchFile?.generated_at || null,
          last_updated: [
            latestValidation?.generated_at,
            latestApply?.generated_at,
            latestDryRun?.generated_at,
            matchingPrecommit?.generated_at,
            matchingDecisionLog?.generated_at,
            matchingTemplate?.generated_at,
            latestReview?.generated_at,
            latestBatchFile?.generated_at,
          ]
            .filter(Boolean)
            .sort()
            .at(-1) || latestReview?.generated_at || latestBatchFile?.generated_at || null,
          paths: {
            input: activeBatchInputPath,
            review: latestReview?.file_path || null,
            normalized: normalizedPath,
            normalization_report: normalizationReportPath,
            decision_template:
              matchingTemplate?.file_path ||
              path.join(CURRENT_ADMIN_REPORTS_DIR, `${batchName}.decision-template.json`),
            queue: queuePath,
            pre_commit:
              matchingPrecommit?.file_path ||
              path.join(CURRENT_ADMIN_REPORTS_DIR, `${batchName}.pre-commit-review.json`),
          },
        }
      : null,
    counts,
    import_readiness: importReadiness,
    queue_promotion_state: queuePromotionState,
    batch_state: openAIBatchState,
    batch_states: batchStates.filter(Boolean),
    manual_review_state: manualReviewState,
    calibration_state: calibrationState,
    simulation_state: simulationState,
    evidence_pack_state: evidencePackState,
    comparison_state: comparisonState,
    paired_evaluation_state: pairedEvaluationState,
    blockers,
    artifact_status: artifactStatus,
    provenance,
    action_permissions: actionPermissions,
    review_runtime: reviewRuntime,
    active_batch_file: latestBatchFile
      ? {
          file_path: latestBatchFile.file_path,
          file_name: latestBatchFile.file_name,
          generated_at: latestBatchFile.generated_at,
          batch_name: latestBatchFile.batch_name,
        }
      : null,
    next_recommended_action: workflowGuide.workflow_handoff,
    latest_review: latestReview,
    latest_decision_template: matchingTemplate,
    latest_decision_session: matchingDecisionLog,
    latest_pre_commit_review: matchingPrecommit,
    latest_import_dry_run: latestDryRun,
    latest_import_apply: latestApply,
    latest_validation: latestValidation,
    review_items: reviewItems,
    decision_history: decisionLogs.slice(0, 10).sort(compareByGeneratedAtDesc),
    feedback_summary: buildFeedbackSummary(decisionLogs),
  };
}

export async function generateCurrentAdministrationFeedbackSummary() {
  const { feedbackSummary } = await getCurrentAdministrationReviewDashboardData();
  return feedbackSummary;
}

export async function writeCurrentAdministrationFeedbackSummary(outputPath = DEFAULT_FEEDBACK_OUTPUT_PATH) {
  const payload = await generateCurrentAdministrationFeedbackSummary();
  await ensureDir(path.dirname(outputPath));
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return {
    outputPath,
    payload,
  };
}

export function getCurrentAdministrationReviewPaths() {
  return {
    projectRoot: PROJECT_ROOT,
    currentAdminReportsDir: CURRENT_ADMIN_REPORTS_DIR,
    reviewDecisionsDir: REVIEW_DECISIONS_DIR,
    feedbackOutputDir: FEEDBACK_OUTPUT_DIR,
    defaultFeedbackOutputPath: DEFAULT_FEEDBACK_OUTPUT_PATH,
  };
}
