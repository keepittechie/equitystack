import { query } from "@/lib/db";

// Compatibility reader for historical staged-item AI rows only.
// Canonical current-admin AI review generation now lives in the Python artifact pipeline.

const GENERATION_STATUS_VALUES = new Set([
  "completed",
  "unavailable",
  "failed",
]);

function normalizeNullableString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function normalizeEnum(value, allowedValues, fallback = null) {
  const normalized = normalizeNullableString(value);
  if (normalized && allowedValues.has(normalized)) {
    return normalized;
  }
  return fallback;
}

function normalizeArrayOfStrings(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean)
    .slice(0, 20);
}

function normalizeAiReviewRow(row) {
  if (!row) {
    return null;
  }

  let editorialFlags = [];
  try {
    editorialFlags = row.editorial_flags_json
      ? JSON.parse(row.editorial_flags_json)
      : [];
  } catch {
    editorialFlags = [];
  }

  let rawResponse = null;
  try {
    rawResponse = row.raw_response_json ? JSON.parse(row.raw_response_json) : null;
  } catch {
    rawResponse = row.raw_response_json || null;
  }

  return {
    id: Number(row.id),
    staged_item_id: Number(row.staged_item_id),
    model_name: row.model_name,
    generation_status: normalizeEnum(
      row.generation_status,
      GENERATION_STATUS_VALUES,
      "failed"
    ),
    relevance_assessment: row.relevance_assessment || null,
    relevance_reason: row.relevance_reason || null,
    promise_type_suggestion: row.promise_type_suggestion || null,
    campaign_or_official_suggestion: row.campaign_or_official_suggestion || null,
    action_type_suggestion: row.action_type_suggestion || null,
    status_suggestion: row.status_suggestion || null,
    suggested_title: row.suggested_title || null,
    suggested_summary: row.suggested_summary || null,
    new_vs_update_suggestion: row.new_vs_update_suggestion || null,
    suggested_existing_promise_id:
      row.suggested_existing_promise_id == null
        ? null
        : Number(row.suggested_existing_promise_id),
    confidence_level: row.confidence_level || null,
    mission_scope: row.mission_scope || null,
    editorial_flags: Array.isArray(editorialFlags) ? editorialFlags : [],
    caution_notes: row.caution_notes
      ? row.caution_notes
          .split("\n")
          .map((note) => note.trim())
          .filter(Boolean)
      : [],
    error_message: row.error_message || null,
    raw_response: rawResponse,
    generated_at: row.generated_at || null,
    updated_at: row.updated_at || null,
  };
}

export async function getAiReviewForStagedItem(stagedItemId) {
  const rows = await query(
    `
    SELECT *
    FROM current_administration_ai_reviews
    WHERE staged_item_id = ?
    LIMIT 1
    `,
    [stagedItemId]
  );

  return normalizeAiReviewRow(rows[0] || null);
}
