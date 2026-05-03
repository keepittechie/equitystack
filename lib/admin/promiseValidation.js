function asTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asNullableString(value) {
  const normalized = asTrimmedString(value);
  return normalized || null;
}

function asInteger(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

const PROMISE_TYPES = [
  "Campaign Promise",
  "Official Promise",
  "Public Promise",
  "Executive Agenda",
  "Other",
];

const CAMPAIGN_OR_OFFICIAL_VALUES = ["Campaign", "Official"];

const PROMISE_STATUSES = [
  "Delivered",
  "In Progress",
  "Partial",
  "Failed",
  "Blocked",
];

const ACTION_TYPES = [
  "Executive Order",
  "Bill",
  "Policy",
  "Agency Action",
  "Court-Related Action",
  "Public Reversal",
  "Statement",
  "Other",
];

const OUTCOME_TYPES = [
  "Legislative Outcome",
  "Administrative Outcome",
  "Legal Outcome",
  "Economic Outcome",
  "Housing Outcome",
  "Voting Outcome",
  "Narrative Outcome",
  "Other",
];

const IMPACT_DIRECTIONS = ["Positive", "Negative", "Mixed", "Blocked"];

const EVIDENCE_STRENGTHS = ["Strong", "Moderate", "Limited"];

const SOURCE_TYPES = [
  "Government",
  "Academic",
  "News",
  "Archive",
  "Nonprofit",
  "Other",
];

function includesOrDefault(options, value, fallback = null) {
  const normalized = asTrimmedString(value);
  if (options.includes(normalized)) {
    return normalized;
  }
  return fallback;
}

function normalizeSourceInput(source = {}) {
  return {
    id: asInteger(source.id),
    source_title: asTrimmedString(source.source_title),
    source_url: asTrimmedString(source.source_url),
    source_type:
      includesOrDefault(SOURCE_TYPES, source.source_type, "Government") ||
      "Government",
    publisher: asNullableString(source.publisher),
    published_date: asNullableString(source.published_date),
    notes: asNullableString(source.notes),
  };
}

export function validateAdminPromisePayload(body = {}) {
  const errors = [];

  const title = asTrimmedString(body.title);
  const promiseText = asTrimmedString(body.promise_text);
  const promiseType =
    includesOrDefault(PROMISE_TYPES, body.promise_type, "Official Promise") ||
    "Official Promise";
  const campaignOrOfficial =
    includesOrDefault(
      CAMPAIGN_OR_OFFICIAL_VALUES,
      body.campaign_or_official,
      "Official"
    ) || "Official";
  const status =
    includesOrDefault(PROMISE_STATUSES, body.status, "In Progress") ||
    "In Progress";

  if (!title) {
    errors.push("Promise title is required.");
  }

  if (!promiseText) {
    errors.push("Promise description is required.");
  }

  const normalizedActions = Array.isArray(body.actions)
    ? body.actions
        .map((action) => ({
          id: asInteger(action?.id),
          action_type:
            includesOrDefault(ACTION_TYPES, action?.action_type, "Other") ||
            "Other",
          action_date: asNullableString(action?.action_date),
          title: asTrimmedString(action?.title),
          description: asNullableString(action?.description),
          related_policy_id: asInteger(action?.related_policy_id),
          related_explainer_id: asInteger(action?.related_explainer_id),
        }))
        .filter((action) => action.id || action.title || action.description)
    : [];

  normalizedActions.forEach((action, index) => {
    if (!action.id) {
      errors.push(`Action ${index + 1} is missing its id.`);
    }

    if (!action.title) {
      errors.push(`Action ${index + 1} must include a title.`);
    }
  });

  return {
    errors,
    payload: {
      title,
      promise_text: promiseText,
      promise_date: asNullableString(body.promise_date),
      promise_type: promiseType,
      campaign_or_official: campaignOrOfficial,
      topic: asNullableString(body.topic),
      impacted_group: asNullableString(body.impacted_group),
      status,
      summary: asNullableString(body.summary),
      notes: asNullableString(body.notes),
      actions: normalizedActions,
    },
  };
}

export function validateAdminPromiseOutcomePayload(body = {}) {
  const errors = [];

  const outcomeSummary = asTrimmedString(body.outcome_summary);
  const outcomeType =
    includesOrDefault(OUTCOME_TYPES, body.outcome_type, "Other") || "Other";
  const impactDirection = includesOrDefault(
    IMPACT_DIRECTIONS,
    body.impact_direction,
    null
  );
  const evidenceStrength =
    includesOrDefault(EVIDENCE_STRENGTHS, body.evidence_strength, "Moderate") ||
    "Moderate";
  const statusOverride = includesOrDefault(
    PROMISE_STATUSES,
    body.status_override,
    null
  );

  if (!outcomeSummary) {
    errors.push("Outcome description is required.");
  }

  if (!impactDirection) {
    errors.push("Impact direction is required.");
  }

  const normalizedSources = Array.isArray(body.sources)
    ? body.sources
        .map(normalizeSourceInput)
        .filter(
          (source) =>
            source.id ||
            source.source_title ||
            source.source_url ||
            source.notes ||
            source.publisher
        )
    : [];

  normalizedSources.forEach((source, index) => {
    if (source.id) {
      return;
    }

    if (!source.source_title || !source.source_url || !source.source_type) {
      errors.push(
        `Outcome source ${index + 1} must include title, URL, and source type unless an existing source is selected.`
      );
    }
  });

  return {
    errors,
    payload: {
      outcome_summary: outcomeSummary,
      outcome_type: outcomeType,
      measurable_impact: asNullableString(body.measurable_impact),
      impact_direction: impactDirection,
      black_community_impact_note: asNullableString(
        body.black_community_impact_note
      ),
      evidence_strength: evidenceStrength,
      status_override: statusOverride,
      affected_groups: asNullableString(body.affected_groups),
      outcome_date: asNullableString(body.outcome_date),
      outcome_timeframe: asNullableString(body.outcome_timeframe),
      sources: normalizedSources,
    },
  };
}

export {
  ACTION_TYPES,
  CAMPAIGN_OR_OFFICIAL_VALUES,
  EVIDENCE_STRENGTHS,
  IMPACT_DIRECTIONS,
  OUTCOME_TYPES,
  PROMISE_STATUSES,
  PROMISE_TYPES,
  SOURCE_TYPES,
};
