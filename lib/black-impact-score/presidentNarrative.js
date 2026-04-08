function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function firstPresent(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function directionCounts(president = {}) {
  const counts = president.counts_by_direction || president.breakdowns?.by_direction || {};
  return {
    positive: toNumber(counts.Positive ?? counts.positive),
    negative: toNumber(counts.Negative ?? counts.negative),
    mixed: toNumber(counts.Mixed ?? counts.mixed),
    blocked: toNumber(counts.Blocked ?? counts.blocked),
  };
}

function topicRows(president = {}) {
  const rows = president.score_by_topic || president.breakdowns?.by_topic || [];
  return (Array.isArray(rows) ? rows : [])
    .map((item) => ({
      topic: firstPresent(item.topic, item.label) || "Uncategorized",
      score: toNumber(item.raw_score_total ?? item.raw_score ?? item.score),
    }))
    .filter((item) => item.topic)
    .sort((left, right) => Math.abs(right.score) - Math.abs(left.score) || left.topic.localeCompare(right.topic));
}

function driverTopic(record = {}) {
  return firstPresent(record.topic, record.promise_topic, record.title);
}

function uniqueItems(values = []) {
  const seen = new Set();
  const output = [];
  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    output.push(value);
  }
  return output;
}

function impactTone({ positive, negative, mixed, blocked }, normalizedScore) {
  if (positive > negative && normalizedScore > 0) return "net positive";
  if (negative > positive && normalizedScore < 0) return "net negative";
  if (mixed + blocked >= positive + negative && mixed + blocked > 0) return "mixed or constrained";
  return "mixed";
}

function topicPhrase(topic) {
  return topic ? ` in ${topic}` : "";
}

function buildStrengths(president = {}, topics = []) {
  const positives = Array.isArray(president.top_positive_promises)
    ? president.top_positive_promises
    : [];
  const positiveTopics = uniqueItems([
    ...positives.map(driverTopic),
    ...topics.filter((topic) => topic.score > 0).map((topic) => topic.topic),
  ]);

  if (!positiveTopics.length) {
    return [];
  }

  return positiveTopics.slice(0, 2).map((topic) => `Positive contributions are strongest${topicPhrase(topic)}.`);
}

function buildWeaknesses(president = {}, topics = [], counts = directionCounts(president)) {
  const negatives = Array.isArray(president.top_negative_promises)
    ? president.top_negative_promises
    : [];
  const negativeTopics = uniqueItems([
    ...negatives.map(driverTopic),
    ...topics.filter((topic) => topic.score < 0).map((topic) => topic.topic),
  ]);
  const weaknesses = negativeTopics
    .slice(0, 2)
    .map((topic) => `Negative contributions are most visible${topicPhrase(topic)}.`);

  if (!weaknesses.length && counts.mixed + counts.blocked > 0) {
    weaknesses.push("Mixed or blocked outcomes limit the interpretation of this score.");
  }

  return weaknesses;
}

function primaryPositiveTopic(president = {}, topics = []) {
  return uniqueItems([
    ...(Array.isArray(president.top_positive_promises)
      ? president.top_positive_promises.map(driverTopic)
      : []),
    ...topics.filter((topic) => topic.score > 0).map((topic) => topic.topic),
  ])[0] || null;
}

function primaryNegativeTopic(president = {}, topics = []) {
  return uniqueItems([
    ...(Array.isArray(president.top_negative_promises)
      ? president.top_negative_promises.map(driverTopic)
      : []),
    ...topics.filter((topic) => topic.score < 0).map((topic) => topic.topic),
  ])[0] || null;
}

function confidenceStatement(president = {}) {
  const outcomeCount = toNumber(president.outcome_count ?? president.direct_outcome_count);
  const scoreConfidence = firstPresent(president.score_confidence, president.direct_score_confidence);
  const confidenceLabel = firstPresent(president.confidence_label);
  const label = scoreConfidence || confidenceLabel || "unknown";
  const limited =
    outcomeCount <= 2
      ? " This is extremely limited coverage and should not be treated as representative."
      : outcomeCount <= 5
        ? " This is limited coverage and should be interpreted cautiously."
        : "";

  return `Score confidence is ${label.toUpperCase()} based on ${outcomeCount} outcome${outcomeCount === 1 ? "" : "s"}.${limited}`;
}

export function buildPresidentImpactNarrative(president = {}) {
  const name = firstPresent(president.president, president.president_name) || "This president";
  const counts = directionCounts(president);
  const topics = topicRows(president);
  const normalizedScore = toNumber(
    president.direct_normalized_score ?? president.normalized_score_total ?? president.normalized_score
  );
  const strengths = buildStrengths(president, topics);
  const weaknesses = buildWeaknesses(president, topics, counts);
  const positiveTopic = primaryPositiveTopic(president, topics);
  const negativeTopic = primaryNegativeTopic(president, topics);
  const clauses = [];

  if (positiveTopic) {
    clauses.push(`positive contributions in ${positiveTopic}`);
  }

  if (negativeTopic) {
    clauses.push(`negative outcomes in ${negativeTopic}`);
  } else if (!strengths.length && counts.mixed + counts.blocked > 0) {
    clauses.push("mixed or blocked outcomes shaping the interpretation");
  }

  const driverClause = clauses.length ? `, with ${clauses.join(" and ")}` : ", with limited topic-specific drivers available";

  return {
    summary_paragraph: `${name} shows a ${impactTone(counts, normalizedScore)} impact profile${driverClause}.`,
    key_strengths: strengths,
    key_weaknesses: weaknesses,
    confidence_statement: confidenceStatement(president),
  };
}
