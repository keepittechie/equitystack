function asTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asNullableString(value) {
  const normalized = asTrimmedString(value);
  return normalized || null;
}

function asInteger(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function asBooleanInt(value) {
  return value ? 1 : 0;
}

function clampScore(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0 || parsed > 5) return null;
  return parsed;
}

export function validatePolicyPayload(body = {}) {
  const errors = [];
  const title = asTrimmedString(body.title);
  const summary = asTrimmedString(body.summary);
  const outcomeSummary = asTrimmedString(body.outcome_summary);
  const policyType = asTrimmedString(body.policy_type);
  const status = asTrimmedString(body.status) || "Active";
  const impactDirection = asTrimmedString(body.impact_direction) || "Positive";
  const yearEnacted = asInteger(body.year_enacted);
  const eraId = asInteger(body.era_id);
  const primaryPartyId = asInteger(body.primary_party_id);

  if (!title) errors.push("Title is required.");
  if (!policyType) errors.push("Policy type is required.");
  if (yearEnacted === null || yearEnacted < 1600 || yearEnacted > 2100) {
    errors.push("Year enacted must be a valid year.");
  }
  if (eraId === null) errors.push("Era is required.");

  const normalizedScores = body.scores
    ? {
        directness_score: clampScore(body.scores.directness_score),
        material_impact_score: clampScore(body.scores.material_impact_score),
        evidence_score: clampScore(body.scores.evidence_score),
        durability_score: clampScore(body.scores.durability_score),
        equity_score: clampScore(body.scores.equity_score),
        harm_offset_score: clampScore(body.scores.harm_offset_score),
        notes: asNullableString(body.scores.notes),
      }
    : null;

  if (normalizedScores) {
    for (const [key, value] of Object.entries(normalizedScores)) {
      if (key === "notes") continue;
      if (value === null) {
        errors.push(`Score ${key.replaceAll("_", " ")} must be between 0 and 5.`);
      }
    }
  }

  const normalizedSources = Array.isArray(body.sources)
    ? body.sources
        .map((source) => ({
          source_title: asTrimmedString(source?.source_title),
          source_url: asTrimmedString(source?.source_url),
          source_type: asTrimmedString(source?.source_type),
          publisher: asNullableString(source?.publisher),
          published_date: asNullableString(source?.published_date),
          notes: asNullableString(source?.notes),
        }))
        .filter((source) => source.source_title || source.source_url || source.source_type)
    : [];

  normalizedSources.forEach((source, index) => {
    if (!source.source_title || !source.source_url || !source.source_type) {
      errors.push(`Source ${index + 1} must include title, URL, and source type.`);
    }
  });

  const normalizedMetrics = Array.isArray(body.metrics)
    ? body.metrics
        .map((metric) => ({
          metric_name: asTrimmedString(metric?.metric_name),
          demographic_group: asTrimmedString(metric?.demographic_group) || "Black Americans",
          before_value:
            metric?.before_value !== "" && metric?.before_value !== undefined
              ? String(metric.before_value).trim()
              : null,
          after_value:
            metric?.after_value !== "" && metric?.after_value !== undefined
              ? String(metric.after_value).trim()
              : null,
          unit: asNullableString(metric?.unit),
          geography: asNullableString(metric?.geography),
          year_before: asInteger(metric?.year_before),
          year_after: asInteger(metric?.year_after),
          methodology_note: asNullableString(metric?.methodology_note),
        }))
        .filter((metric) => metric.metric_name || metric.before_value || metric.after_value)
    : [];

  normalizedMetrics.forEach((metric, index) => {
    if (!metric.metric_name) {
      errors.push(`Metric ${index + 1} must include a metric name.`);
    }
  });

  return {
    errors,
    payload: {
      title,
      policy_type: policyType,
      summary: summary || null,
      year_enacted: yearEnacted,
      date_enacted: asNullableString(body.date_enacted),
      era_id: eraId,
      president_id: asInteger(body.president_id),
      house_party_id: asInteger(body.house_party_id),
      senate_party_id: asInteger(body.senate_party_id),
      primary_party_id: primaryPartyId,
      bipartisan: asBooleanInt(body.bipartisan),
      direct_black_impact: asBooleanInt(body.direct_black_impact),
      outcome_summary: outcomeSummary || null,
      status,
      impact_direction: impactDirection,
      impact_notes: asNullableString(body.impact_notes),
      category_ids: Array.isArray(body.category_ids)
        ? body.category_ids.map(asInteger).filter((value) => value !== null)
        : [],
      scores: normalizedScores,
      sources: normalizedSources,
      metrics: normalizedMetrics,
    },
  };
}
