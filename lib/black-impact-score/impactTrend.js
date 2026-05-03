function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function roundScore(value, digits = 4) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(digits)) : 0;
}

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function yearFromDate(value) {
  return normalizeDate(value)?.getUTCFullYear() ?? null;
}

function incrementDirection(bucket, direction) {
  if (direction === "Positive") bucket.positive_outcomes += 1;
  else if (direction === "Negative") bucket.negative_outcomes += 1;
  else if (direction === "Mixed") bucket.mixed_outcomes += 1;
  else if (direction === "Blocked") bucket.blocked_outcomes += 1;
}

function getOutcomeScore(record = {}) {
  return toFiniteNumber(record.component_score ?? record.total_score ?? record.impact_score);
}

function getTrendRange(record = {}) {
  const startYear = yearFromDate(
    record.impact_start_date ?? record.outcome?.impact_start_date ?? record.start_date
  );
  const endYear = yearFromDate(record.impact_end_date ?? record.outcome?.impact_end_date);

  if (!startYear) {
    return null;
  }

  if (!endYear || endYear < startYear) {
    return { startYear, endYear: startYear };
  }

  // Keep accidental long-tail ranges from dominating trend output.
  return { startYear, endYear: Math.min(endYear, startYear + 50) };
}

function emptyYearBucket(year) {
  return {
    year,
    score: 0,
    outcome_count: 0,
    positive_outcomes: 0,
    negative_outcomes: 0,
    mixed_outcomes: 0,
    blocked_outcomes: 0,
    topic_scores: {},
  };
}

function topTopicForBucket(bucket) {
  const [topic, score] =
    Object.entries(bucket.topic_scores || {}).sort(
      (left, right) => Math.abs(right[1]) - Math.abs(left[1]) || left[0].localeCompare(right[0])
    )[0] || [];

  return topic
    ? {
        topic,
        score: roundScore(score),
      }
    : null;
}

function buildYearRows(byYear) {
  const rows = [...byYear.values()]
    .sort((left, right) => left.year - right.year)
    .map((bucket) => ({
      ...bucket,
      score: roundScore(bucket.score),
      top_topic: topTopicForBucket(bucket),
      topic_scores: Object.fromEntries(
        Object.entries(bucket.topic_scores || {})
          .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]) || left[0].localeCompare(right[0]))
          .map(([topic, score]) => [topic, roundScore(score)])
      ),
    }));

  let cumulative = 0;
  return rows.map((row) => {
    cumulative += row.score;
    return {
      ...row,
      cumulative_score: roundScore(cumulative),
    };
  });
}

function averageScore(rows) {
  if (!rows.length) {
    return 0;
  }

  return rows.reduce((total, row) => total + toFiniteNumber(row.score), 0) / rows.length;
}

function classifyTrend(rows) {
  if (rows.length < 2) {
    return "stable";
  }

  const segmentSize = Math.max(1, Math.ceil(rows.length / 3));
  const early = rows.slice(0, segmentSize);
  const recent = rows.slice(-segmentSize);
  const earlyAverage = averageScore(early);
  const recentAverage = averageScore(recent);
  const delta = recentAverage - earlyAverage;
  const threshold = Math.max(0.25, Math.abs(earlyAverage) * 0.2);

  if (delta > threshold) {
    return "improving";
  }

  if (delta < -threshold) {
    return "declining";
  }

  return "stable";
}

function strongestShift(rows) {
  let strongest = null;

  for (let index = 1; index < rows.length; index += 1) {
    const previous = rows[index - 1];
    const current = rows[index];
    const delta = roundScore(current.score - previous.score);

    if (!strongest || Math.abs(delta) > Math.abs(strongest.delta)) {
      strongest = {
        year: current.year,
        previous_year: previous.year,
        delta,
        top_topic: current.top_topic,
      };
    }
  }

  return strongest;
}

function buildInterpretation({ rows, trendDirection, shift }) {
  if (!rows.length) {
    return "No dated scored outcomes are available for time-based impact analysis.";
  }

  if (!shift || !shift.year) {
    return `Impact trend is ${trendDirection} across ${rows.length} yearly bucket(s).`;
  }

  const topicPhrase = shift.top_topic?.topic ? `, driven by ${shift.top_topic.topic}` : "";
  const verb =
    trendDirection === "improving"
      ? "improved"
      : trendDirection === "declining"
        ? "declined"
        : "remained broadly stable";

  return `Impact ${verb} after ${shift.previous_year}${topicPhrase}.`;
}

export function summarizeImpactTrend(records = []) {
  const byYear = new Map();
  let dated_outcome_count = 0;
  let undated_outcome_count = 0;

  for (const record of records) {
    const range = getTrendRange(record);
    const score = getOutcomeScore(record);
    const direction = record.impact_direction ?? record.outcome?.impact_direction;
    const topic = record.topic || record.promise_topic || "Uncategorized";

    if (!range) {
      undated_outcome_count += 1;
      continue;
    }

    dated_outcome_count += 1;
    const years = range.endYear - range.startYear + 1;
    const yearlyScore = years > 0 ? score / years : score;

    for (let year = range.startYear; year <= range.endYear; year += 1) {
      if (!byYear.has(year)) {
        byYear.set(year, emptyYearBucket(year));
      }

      const bucket = byYear.get(year);
      bucket.score += yearlyScore;
      bucket.outcome_count += year === range.startYear ? 1 : 0;
      incrementDirection(bucket, direction);
      bucket.topic_scores[topic] = (bucket.topic_scores[topic] || 0) + yearlyScore;
    }
  }

  const scoreByYear = buildYearRows(byYear);
  const shift = strongestShift(scoreByYear);
  const trendDirection = classifyTrend(scoreByYear);

  return {
    score_by_year: scoreByYear,
    cumulative_score: scoreByYear.at(-1)?.cumulative_score ?? 0,
    trend_direction: trendDirection,
    strongest_shift: shift,
    dated_outcome_count,
    undated_outcome_count,
    interpretation: buildInterpretation({
      rows: scoreByYear,
      trendDirection,
      shift,
    }),
  };
}
