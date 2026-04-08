function normalizeIdentifier(value) {
  if (value == null) {
    return null;
  }

  const text = String(value).trim().toLowerCase();
  return text || null;
}

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function roundScore(value, digits = 4) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Number(numeric.toFixed(digits));
}

function getComparableIdentifiers(president = {}) {
  return [
    president.president_id,
    president.id,
    president.president_slug,
    president.slug,
    president.president,
    president.president_name,
    president.name,
  ]
    .map(normalizeIdentifier)
    .filter(Boolean);
}

function matchesIdentifier(president, identifier) {
  const normalized = normalizeIdentifier(identifier);
  if (!normalized) {
    return false;
  }

  return getComparableIdentifiers(president).includes(normalized);
}

function normalizeTopicRows(president = {}) {
  const rows = president.score_by_topic || president.breakdowns?.by_topic || [];

  return (Array.isArray(rows) ? rows : [])
    .map((item) => ({
      topic: item.topic || item.label || "Uncategorized",
      raw_score_total: roundScore(item.raw_score_total ?? item.raw_score ?? item.score ?? 0),
    }))
    .filter((item) => item.topic)
    .sort((left, right) => Math.abs(right.raw_score_total) - Math.abs(left.raw_score_total));
}

function normalizeDirectionCounts(president = {}) {
  const counts = president.counts_by_direction || president.breakdowns?.by_direction || {};

  return {
    Positive: toFiniteNumber(counts.Positive),
    Negative: toFiniteNumber(counts.Negative),
    Mixed: toFiniteNumber(counts.Mixed),
    Blocked: toFiniteNumber(counts.Blocked),
  };
}

function getPresidentName(president = {}) {
  return president.president || president.president_name || president.name || "Unknown president";
}

function summarizePresident(president = {}) {
  const directionBreakdown = normalizeDirectionCounts(president);
  const topContributingTopics = normalizeTopicRows(president).slice(0, 5);

  return {
    president_id: president.president_id ?? president.id ?? null,
    president_slug: president.president_slug || president.slug || null,
    president_name: getPresidentName(president),
    president_party: president.president_party || null,
    direct_raw_score: roundScore(
      president.direct_raw_score ?? president.raw_score_total ?? president.raw_score
    ),
    direct_normalized_score: roundScore(
      president.direct_normalized_score ??
        president.normalized_score_total ??
        president.normalized_score
    ),
    systemic_raw_score: roundScore(president.systemic_raw_score),
    systemic_normalized_score: roundScore(president.systemic_normalized_score),
    direct_outcome_count: toFiniteNumber(
      president.direct_outcome_count ?? president.outcome_count
    ),
    systemic_outcome_count: toFiniteNumber(president.systemic_outcome_count),
    outcome_count: toFiniteNumber(president.outcome_count),
    promise_count: toFiniteNumber(president.promise_count),
    direct_score_confidence:
      president.direct_score_confidence || president.score_confidence || null,
    systemic_score_confidence: president.systemic_score_confidence || null,
    confidence_label: president.confidence_label || null,
    top_contributing_topics: topContributingTopics,
    directional_breakdown: directionBreakdown,
  };
}

function topicScoreMap(summary = {}) {
  const map = new Map();

  for (const topic of summary.top_contributing_topics || []) {
    map.set(topic.topic, toFiniteNumber(topic.raw_score_total));
  }

  return map;
}

function buildStrongestTopicDifference(left, right) {
  const leftScores = topicScoreMap(left);
  const rightScores = topicScoreMap(right);
  const topics = new Set([...leftScores.keys(), ...rightScores.keys()]);
  let strongest = null;

  for (const topic of topics) {
    const leftScore = leftScores.get(topic) || 0;
    const rightScore = rightScores.get(topic) || 0;
    const difference = roundScore(leftScore - rightScore);

    if (!strongest || Math.abs(difference) > Math.abs(strongest.difference)) {
      strongest = {
        topic,
        left_score: leftScore,
        right_score: rightScore,
        difference,
        stronger_president:
          difference === 0 ? null : difference > 0 ? left.president_name : right.president_name,
      };
    }
  }

  return strongest;
}

function directionTrend(summary = {}) {
  const counts = summary.directional_breakdown || {};
  const positive = toFiniteNumber(counts.Positive);
  const negative = toFiniteNumber(counts.Negative);

  if (positive > negative) {
    return {
      label: "positive",
      count: positive,
      sentence: `${summary.president_name} has more positive than negative scored outcomes.`,
    };
  }

  if (negative > positive) {
    return {
      label: "negative",
      count: negative,
      sentence: `${summary.president_name} has more negative than positive scored outcomes.`,
    };
  }

  return {
    label: "balanced",
    count: positive,
    sentence: `${summary.president_name} has a balanced positive/negative outcome count.`,
  };
}

function buildDirectionalContrastSummary(left, right, topicDifference) {
  const leftTrend = directionTrend(left);
  const rightTrend = directionTrend(right);
  const topicPhrase = topicDifference?.topic
    ? ` The largest topic difference is ${topicDifference.topic}, where ${
        topicDifference.stronger_president || "neither president"
      } has the stronger raw contribution.`
    : "";

  return `${leftTrend.sentence} ${rightTrend.sentence}${topicPhrase}`.trim();
}

function parseRequestedIdentifiers(identifiers = []) {
  const list = Array.isArray(identifiers) ? identifiers : [identifiers];

  return list
    .flatMap((item) => String(item ?? "").split(","))
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildPresidentComparison(presidents = [], identifiers = []) {
  const requestedIdentifiers = parseRequestedIdentifiers(identifiers);
  const compared = [];
  const seen = new Set();

  for (const identifier of requestedIdentifiers) {
    const president = presidents.find((item) => matchesIdentifier(item, identifier));
    const key = president
      ? president.president_slug || president.president_id || getPresidentName(president)
      : null;

    if (!president || seen.has(key)) {
      continue;
    }

    seen.add(key);
    compared.push(summarizePresident(president));
  }

  const [left, right] = compared;
  const scoreDifference =
    compared.length >= 2
      ? {
          left_president: left.president_name,
          right_president: right.president_name,
          direct_normalized_score_difference: roundScore(
            left.direct_normalized_score - right.direct_normalized_score
          ),
          systemic_normalized_score_difference: roundScore(
            left.systemic_normalized_score - right.systemic_normalized_score
          ),
          direct_raw_score_difference: roundScore(left.direct_raw_score - right.direct_raw_score),
          systemic_raw_score_difference: roundScore(
            left.systemic_raw_score - right.systemic_raw_score
          ),
        }
      : null;
  const strongestTopicDifference =
    compared.length >= 2 ? buildStrongestTopicDifference(left, right) : null;
  const directionalContrastSummary =
    compared.length >= 2
      ? buildDirectionalContrastSummary(left, right, strongestTopicDifference)
      : null;

  return {
    requested_identifiers: requestedIdentifiers,
    comparison_ready: compared.length >= 2,
    compared_presidents: compared,
    score_difference: scoreDifference,
    strongest_topic_difference: strongestTopicDifference,
    directional_contrast_summary: directionalContrastSummary,
  };
}
