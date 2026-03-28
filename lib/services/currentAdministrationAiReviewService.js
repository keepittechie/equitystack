import { query } from "@/lib/db";
import {
  buildPromisePromotionDraftFromStagedItem,
  getStagedCurrentAdministrationItem,
} from "@/lib/services/currentAdministrationStagingService";

const DEFAULT_OLLAMA_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const DEFAULT_MODEL = "qwen3.5:latest";
const DEFAULT_TIMEOUT_MS = 90000;

const RELEVANCE_VALUES = new Set(["track", "noise", "unclear"]);
const PROMISE_TYPE_VALUES = new Set([
  "Campaign Promise",
  "Official Promise",
  "Public Promise",
  "Executive Agenda",
  "Other",
]);
const CAMPAIGN_OR_OFFICIAL_VALUES = new Set(["Campaign", "Official"]);
const ACTION_TYPE_VALUES = new Set([
  "Executive Order",
  "Bill",
  "Policy",
  "Agency Action",
  "Court-Related Action",
  "Public Reversal",
  "Statement",
  "Other",
]);
const STATUS_VALUES = new Set([
  "Delivered",
  "In Progress",
  "Partial",
  "Failed",
  "Blocked",
]);
const NEW_VS_UPDATE_VALUES = new Set([
  "new_record",
  "update_existing",
  "unclear",
]);
const CONFIDENCE_VALUES = new Set(["high", "medium", "low"]);
const MISSION_SCOPE_VALUES = new Set([
  "mission_core",
  "mission_edge",
  "unclear",
]);
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

function parseJsonResponse(text) {
  const candidate = String(text || "").trim();

  if (!candidate) {
    throw new Error("Ollama response did not contain a JSON body");
  }

  const withoutFence = candidate.startsWith("```")
    ? candidate
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim()
    : candidate;

  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Ollama response did not contain a JSON object");
  }

  const parsed = JSON.parse(withoutFence.slice(start, end + 1));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Ollama response JSON must be an object");
  }

  return parsed;
}

function isUnavailableAiError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("econnrefused") ||
    message.includes("fetch failed") ||
    message.includes("connection refused") ||
    message.includes("networkerror") ||
    message.includes("network error") ||
    message.includes("failed to fetch") ||
    message.includes("model") && message.includes("not found") ||
    message.includes("404")
  );
}

function buildPrompt(stagedItem, draft) {
  const possibleMatches = (draft?.match_assessment?.possible_matches || []).map(
    (match) => ({
      id: match.id,
      title: match.title,
      match_reason: match.match_reason,
      status: match.status,
      promise_type: match.promise_type,
    })
  );

  return `
You are an internal editorial triage assistant for EquityStack's Promise Tracker.

You are reviewing one staged current-administration item. Your output is advisory only.
Human approval is still required before anything can be approved or promoted.
Do not recommend automatic approval, automatic rejection, automatic promotion, or automatic scoring.

Return exactly one JSON object with these keys:
- relevance_assessment: one of "track", "noise", "unclear"
- relevance_reason: short explanation
- candidate_classification: {
    "promise_type": one of "Campaign Promise", "Official Promise", "Public Promise", "Executive Agenda", "Other",
    "campaign_or_official": one of "Campaign", "Official",
    "action_type": one of "Executive Order", "Bill", "Policy", "Agency Action", "Court-Related Action", "Public Reversal", "Statement", "Other",
    "status_suggestion": one of "Delivered", "In Progress", "Partial", "Failed", "Blocked"
  }
- editorial_cleanup: {
    "suggested_title": string,
    "suggested_summary": string
  }
- new_vs_update: {
    "suggestion": one of "new_record", "update_existing", "unclear",
    "suggested_existing_promise_id": integer or null,
    "reason": string
  }
- confidence_level: one of "high", "medium", "low"
- mission_scope: one of "mission_core", "mission_edge", "unclear"
- editorial_flags: array of short strings
- caution_notes: array of short strings

Staged item:
${JSON.stringify(
    {
      id: stagedItem.id,
      president: stagedItem.president,
      president_slug: stagedItem.president_slug,
      source_system: stagedItem.source_system,
      source_category: stagedItem.source_category,
      canonical_url: stagedItem.canonical_url,
      official_identifier: stagedItem.official_identifier,
      raw_action_type: stagedItem.raw_action_type,
      title: stagedItem.title,
      publication_date: stagedItem.publication_date,
      action_date: stagedItem.action_date,
      summary_excerpt: stagedItem.summary_excerpt,
    },
    null,
    2
  )}

Existing cautious promotion draft:
${JSON.stringify(
    {
      target_mode: draft?.target_mode || null,
      existing_promise: draft?.existing_promise
        ? {
            id: draft.existing_promise.id,
            title: draft.existing_promise.title,
            match_reason: draft.existing_promise.match_reason,
            status: draft.existing_promise.status,
          }
        : null,
      possible_matches: possibleMatches,
    },
    null,
    2
  )}

Requirements:
- Prefer caution over overclaiming.
- If the item looks ceremonial, low-substance, or not durable enough, say so.
- If matching an existing record is uncertain, return "unclear".
- Keep summaries concise and editorial, not promotional.
`.trim();
}

function normalizeAiResponse(response, draft) {
  const suggestedExistingPromiseId = Number(
    response?.new_vs_update?.suggested_existing_promise_id
  );
  const allowedMatchIds = new Set(
    (draft?.match_assessment?.possible_matches || []).map((match) => Number(match.id))
  );

  return {
    relevance_assessment: normalizeEnum(
      response?.relevance_assessment,
      RELEVANCE_VALUES,
      "unclear"
    ),
    relevance_reason: normalizeNullableString(response?.relevance_reason),
    promise_type_suggestion: normalizeEnum(
      response?.candidate_classification?.promise_type,
      PROMISE_TYPE_VALUES,
      null
    ),
    campaign_or_official_suggestion: normalizeEnum(
      response?.candidate_classification?.campaign_or_official,
      CAMPAIGN_OR_OFFICIAL_VALUES,
      null
    ),
    action_type_suggestion: normalizeEnum(
      response?.candidate_classification?.action_type,
      ACTION_TYPE_VALUES,
      null
    ),
    status_suggestion: normalizeEnum(
      response?.candidate_classification?.status_suggestion,
      STATUS_VALUES,
      null
    ),
    suggested_title: normalizeNullableString(
      response?.editorial_cleanup?.suggested_title
    ),
    suggested_summary: normalizeNullableString(
      response?.editorial_cleanup?.suggested_summary
    ),
    new_vs_update_suggestion: normalizeEnum(
      response?.new_vs_update?.suggestion,
      NEW_VS_UPDATE_VALUES,
      "unclear"
    ),
    suggested_existing_promise_id:
      Number.isFinite(suggestedExistingPromiseId) &&
      allowedMatchIds.has(suggestedExistingPromiseId)
        ? suggestedExistingPromiseId
        : null,
    update_reason: normalizeNullableString(response?.new_vs_update?.reason),
    confidence_level: normalizeEnum(
      response?.confidence_level,
      CONFIDENCE_VALUES,
      "low"
    ),
    mission_scope: normalizeEnum(
      response?.mission_scope,
      MISSION_SCOPE_VALUES,
      "unclear"
    ),
    editorial_flags: normalizeArrayOfStrings(response?.editorial_flags),
    caution_notes: normalizeArrayOfStrings(response?.caution_notes),
  };
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

async function persistAiReview(stagedItemId, record) {
  const editorialFlagsJson = JSON.stringify(record.editorial_flags || []);
  const rawResponseJson =
    record.raw_response == null ? null : JSON.stringify(record.raw_response);
  const cautionNotes = (record.caution_notes || []).join("\n") || null;

  await query(
    `
    INSERT INTO current_administration_ai_reviews (
      staged_item_id,
      model_name,
      generation_status,
      relevance_assessment,
      relevance_reason,
      promise_type_suggestion,
      campaign_or_official_suggestion,
      action_type_suggestion,
      status_suggestion,
      suggested_title,
      suggested_summary,
      new_vs_update_suggestion,
      suggested_existing_promise_id,
      confidence_level,
      mission_scope,
      editorial_flags_json,
      caution_notes,
      raw_response_json,
      error_message,
      generated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP())
    ON DUPLICATE KEY UPDATE
      model_name = VALUES(model_name),
      generation_status = VALUES(generation_status),
      relevance_assessment = VALUES(relevance_assessment),
      relevance_reason = VALUES(relevance_reason),
      promise_type_suggestion = VALUES(promise_type_suggestion),
      campaign_or_official_suggestion = VALUES(campaign_or_official_suggestion),
      action_type_suggestion = VALUES(action_type_suggestion),
      status_suggestion = VALUES(status_suggestion),
      suggested_title = VALUES(suggested_title),
      suggested_summary = VALUES(suggested_summary),
      new_vs_update_suggestion = VALUES(new_vs_update_suggestion),
      suggested_existing_promise_id = VALUES(suggested_existing_promise_id),
      confidence_level = VALUES(confidence_level),
      mission_scope = VALUES(mission_scope),
      editorial_flags_json = VALUES(editorial_flags_json),
      caution_notes = VALUES(caution_notes),
      raw_response_json = VALUES(raw_response_json),
      error_message = VALUES(error_message),
      generated_at = CURRENT_TIMESTAMP(),
      updated_at = CURRENT_TIMESTAMP()
    `,
    [
      stagedItemId,
      record.model_name,
      record.generation_status,
      record.relevance_assessment,
      record.relevance_reason,
      record.promise_type_suggestion,
      record.campaign_or_official_suggestion,
      record.action_type_suggestion,
      record.status_suggestion,
      record.suggested_title,
      record.suggested_summary,
      record.new_vs_update_suggestion,
      record.suggested_existing_promise_id,
      record.confidence_level,
      record.mission_scope,
      editorialFlagsJson,
      cautionNotes,
      rawResponseJson,
      record.error_message || null,
    ]
  );

  return getAiReviewForStagedItem(stagedItemId);
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

export async function generateAiReviewForStagedItem(stagedItemId) {
  const stagedItem = await getStagedCurrentAdministrationItem(stagedItemId);
  if (!stagedItem) {
    throw new Error("Staged item not found");
  }

  const draft = await buildPromisePromotionDraftFromStagedItem(stagedItemId);
  const prompt = buildPrompt(stagedItem, draft);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${DEFAULT_OLLAMA_URL.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        prompt,
        stream: false,
        format: "json",
        options: {
          temperature: 0.1,
          seed: 42,
        },
      }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || `Ollama request failed with ${response.status}`);
    }

    const rawText = typeof payload?.response === "string" ? payload.response : "";
    const parsed = parseJsonResponse(rawText);
    const normalized = normalizeAiResponse(parsed, draft);

    return persistAiReview(stagedItemId, {
      model_name: DEFAULT_MODEL,
      generation_status: "completed",
      ...normalized,
      relevance_reason:
        normalized.relevance_reason ||
        normalized.update_reason ||
        "AI review completed without an additional relevance note.",
      error_message: null,
      raw_response: {
        parsed_response: parsed,
      },
    });
  } catch (error) {
    const unavailable = isUnavailableAiError(error);
    return persistAiReview(stagedItemId, {
      model_name: DEFAULT_MODEL,
      generation_status: unavailable ? "unavailable" : "failed",
      relevance_assessment: null,
      relevance_reason: null,
      promise_type_suggestion: null,
      campaign_or_official_suggestion: null,
      action_type_suggestion: null,
      status_suggestion: null,
      suggested_title: null,
      suggested_summary: null,
      new_vs_update_suggestion: null,
      suggested_existing_promise_id: null,
      confidence_level: null,
      mission_scope: null,
      editorial_flags: [],
      caution_notes: [],
      error_message:
        unavailable
          ? "Ollama review assistant is unavailable. Human review and promotion can continue without AI output."
          : String(error?.message || "AI review generation failed."),
      raw_response: {
        error: String(error?.message || "Unknown AI review error"),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}
