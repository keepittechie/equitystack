import { normalizeScoreTotal } from "./normalization.js";

function incrementCounter(bucket, key) {
  if (!key) {
    return;
  }

  bucket[key] = (bucket[key] || 0) + 1;
}

function sumCounter(bucket, key, amount) {
  if (!key) {
    return;
  }

  bucket[key] = Number(((bucket[key] || 0) + amount).toFixed(2));
}

function sortPromisesByScore(rows = [], direction = "desc") {
  return [...rows]
    .sort((a, b) => {
      const scoreDiff = direction === "desc"
        ? b.total_score - a.total_score
        : a.total_score - b.total_score;

      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      return String(a.title || "").localeCompare(String(b.title || ""));
    })
    .slice(0, 5);
}

function buildPresidentExplanation(summary) {
  if (!summary.promise_count) {
    return "No scored promise records are available for this president.";
  }

  if (summary.raw_score_total > 0) {
    return "Scored outcomes currently trend net positive for this president.";
  }

  if (summary.raw_score_total < 0) {
    return "Scored outcomes currently trend net negative for this president.";
  }

  return "Scored outcomes are currently balanced or neutral for this president.";
}

export function aggregatePresidentFromOutcomes(records = []) {
  const byPresident = new Map();

  for (const record of records) {
    if (!record || typeof record !== "object") {
      continue;
    }

    const presidentKey = record.president_slug || record.president;

    if (!presidentKey) {
      continue;
    }

    if (!byPresident.has(presidentKey)) {
      byPresident.set(presidentKey, {
        president: record.president || null,
        president_slug: record.president_slug || null,
        president_party: record.president_party || null,
        raw_score_total: 0,
        promise_count: 0,
        outcome_count: 0,
        counts_by_direction: {},
        counts_by_confidence: {},
        score_by_topic: {},
        promises: [],
      });
    }

    const summary = byPresident.get(presidentKey);
    const totalScore = Number(record.total_score || 0);
    const outcomeCount = Number(record.outcome_count || 0);

    summary.raw_score_total += totalScore;
    summary.promise_count += 1;
    summary.outcome_count += outcomeCount;
    summary.promises.push(record);

    for (const [label, count] of Object.entries(record.breakdown_by_direction || {})) {
      summary.counts_by_direction[label] = (summary.counts_by_direction[label] || 0) + Number(count || 0);
    }

    for (const [label, count] of Object.entries(record.breakdown_by_confidence || {})) {
      summary.counts_by_confidence[label] = (summary.counts_by_confidence[label] || 0) + Number(count || 0);
    }

    sumCounter(summary.score_by_topic, record.topic || "Uncategorized", totalScore);
  }

  return [...byPresident.values()]
    .map((summary) => {
      const rawScoreTotal = Number(summary.raw_score_total.toFixed(2));

      return {
        president: summary.president,
        president_slug: summary.president_slug,
        president_party: summary.president_party,
        raw_score_total: rawScoreTotal,
        normalized_score_total: normalizeScoreTotal(rawScoreTotal, summary.outcome_count),
        promise_count: summary.promise_count,
        outcome_count: summary.outcome_count,
        counts: {
          promises: summary.promise_count,
          outcomes: summary.outcome_count,
        },
        breakdowns: {
          by_direction: summary.counts_by_direction,
          by_confidence: summary.counts_by_confidence,
          by_topic: Object.entries(summary.score_by_topic)
            .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]) || a[0].localeCompare(b[0]))
            .map(([topic, score]) => ({
              topic,
              raw_score_total: Number(score.toFixed(2)),
            })),
        },
        top_positive_promises: sortPromisesByScore(
          summary.promises.filter((promise) => Number(promise.total_score || 0) > 0),
          "desc"
        ),
        top_negative_promises: sortPromisesByScore(
          summary.promises.filter((promise) => Number(promise.total_score || 0) < 0),
          "asc"
        ),
        explanation_summary: buildPresidentExplanation({
          raw_score_total: rawScoreTotal,
          promise_count: summary.promise_count,
        }),
      };
    })
    .sort((a, b) => {
      if (b.raw_score_total !== a.raw_score_total) {
        return b.raw_score_total - a.raw_score_total;
      }

      return String(a.president || "").localeCompare(String(b.president || ""));
    });
}
