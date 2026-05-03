function normalizeDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();
  if (!text) {
    return null;
  }

  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return null;
  }

  const parsed = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeRange(range = {}) {
  if (typeof range === "string" || range instanceof Date) {
    const date = normalizeDate(range);
    return { start: date, end: date };
  }

  return {
    start: normalizeDate(range.start ?? range.start_date ?? range.from),
    end: normalizeDate(range.end ?? range.end_date ?? range.to),
  };
}

function durationDays(start, end) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

export function isActiveDuring(outcome = {}, dateRange = {}) {
  const outcomeStart = normalizeDate(outcome.impact_start_date ?? outcome.start_date);
  const outcomeEnd = normalizeDate(outcome.impact_end_date ?? outcome.end_date);
  const range = normalizeRange(dateRange);

  if (!outcomeStart || (!range.start && !range.end)) {
    return false;
  }

  const rangeStart = range.start || range.end;
  const rangeEnd = range.end || range.start;
  const effectiveOutcomeEnd = outcomeEnd || rangeEnd;

  return outcomeStart <= rangeEnd && effectiveOutcomeEnd >= rangeStart;
}

export function getOutcomeDuration(outcome = {}) {
  const impactStart = normalizeDate(outcome.impact_start_date ?? outcome.start_date);
  const impactEnd = normalizeDate(outcome.impact_end_date ?? outcome.end_date);
  const explicitEstimate =
    typeof outcome.impact_duration_estimate === "string"
      ? outcome.impact_duration_estimate.trim() || null
      : null;

  if (!impactStart) {
    return {
      has_known_duration: false,
      duration_days: null,
      duration_years: null,
      duration_label: explicitEstimate || "unknown",
      impact_duration_estimate: explicitEstimate,
    };
  }

  if (!impactEnd) {
    return {
      has_known_duration: false,
      duration_days: null,
      duration_years: null,
      duration_label: explicitEstimate || "ongoing_or_unknown_end",
      impact_duration_estimate: explicitEstimate,
    };
  }

  const days = durationDays(impactStart, impactEnd);
  const years = Number((days / 365.25).toFixed(2));
  let durationLabel = "short_term";
  if (days > 365 * 5) {
    durationLabel = "long_term";
  } else if (days > 365) {
    durationLabel = "medium_term";
  }

  return {
    has_known_duration: true,
    duration_days: days,
    duration_years: years,
    duration_label: explicitEstimate || durationLabel,
    impact_duration_estimate: explicitEstimate,
  };
}
