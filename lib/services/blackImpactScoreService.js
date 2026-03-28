import { query } from "@/lib/db";
import { computeOutcomeScore } from "@/lib/black-impact-score/outcomeScoring.js";
import { computePromiseFromOutcomes } from "@/lib/black-impact-score/promiseRollup.js";
import { aggregatePresidentFromOutcomes } from "@/lib/black-impact-score/presidentAggregation.js";
import { normalizePromiseTopicLabel } from "@/lib/promise-topics";

function normalizeNullableString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function toSafeCount(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}

function createPromiseShape(row) {
  return {
    id: row.promise_id,
    slug: row.promise_slug,
    title: row.promise_title,
    promise_date: row.promise_date,
    topic: normalizePromiseTopicLabel(row.promise_topic),
    status: row.promise_status,
    president: row.president,
    president_slug: row.president_slug,
    president_party: row.president_party,
  };
}

function createOutcomeShape(row) {
  if (!row.outcome_id) {
    return null;
  }

  return {
    id: row.outcome_id,
    promise_id: row.promise_id,
    outcome_summary: normalizeNullableString(row.outcome_summary),
    outcome_type: normalizeNullableString(row.outcome_type),
    impact_direction: normalizeNullableString(row.impact_direction),
    evidence_strength: normalizeNullableString(row.evidence_strength),
    status_override: normalizeNullableString(row.status_override),
    source_count: toSafeCount(row.outcome_source_count),
  };
}

function isScoredOutcome(entry) {
  return Boolean(
    entry &&
      typeof entry === "object" &&
      entry.impact_direction &&
      typeof entry.component_score === "number"
  );
}

export async function fetchPromisesWithOutcomesForScoring() {
  const rows = await query(`
    SELECT
      p.id AS promise_id,
      p.slug AS promise_slug,
      p.title AS promise_title,
      p.promise_date,
      p.topic AS promise_topic,
      p.status AS promise_status,
      pr.full_name AS president,
      pr.slug AS president_slug,
      pa.name AS president_party,
      po.id AS outcome_id,
      po.outcome_summary,
      po.outcome_type,
      po.impact_direction,
      po.evidence_strength,
      po.status_override,
      (
        SELECT COUNT(DISTINCT pos.source_id)
        FROM promise_outcome_sources pos
        -- This codebase consistently links outcome sources through
        -- promise_outcome_id, not a generic outcome_id column.
        WHERE pos.promise_outcome_id = po.id
      ) AS outcome_source_count
    FROM promises p
    JOIN presidents pr ON pr.id = p.president_id
    LEFT JOIN parties pa ON pa.id = pr.party_id
    LEFT JOIN promise_outcomes po ON po.promise_id = p.id
    ORDER BY pr.term_start ASC, p.promise_date ASC, p.id ASC, po.id ASC
  `);

  const uniquePromiseIds = new Set();
  let outcomeCount = 0;

  for (const row of rows) {
    if (row.promise_id) {
      uniquePromiseIds.add(row.promise_id);
    }

    if (row.outcome_id) {
      outcomeCount += 1;
    }
  }

  console.debug(
    `[black-impact-score] loaded ${uniquePromiseIds.size} promises and ${outcomeCount} outcomes for scoring`
  );

  return rows;
}

export function prepareScoreContexts(records = []) {
  const byPromise = new Map();

  for (const row of records) {
    if (!row || typeof row !== "object" || !row.promise_id) {
      continue;
    }

    if (!byPromise.has(row.promise_id)) {
      byPromise.set(row.promise_id, {
        promise: createPromiseShape(row),
        outcomes: [],
        _seenOutcomeIds: new Set(),
      });
    }

    const context = byPromise.get(row.promise_id);
    const outcome = createOutcomeShape(row);

    if (!outcome) {
      continue;
    }

    if (context._seenOutcomeIds.has(outcome.id)) {
      continue;
    }

    context._seenOutcomeIds.add(outcome.id);
    context.outcomes.push(outcome);
  }

  return [...byPromise.values()].map((context) => ({
    promise: { ...context.promise },
    outcomes: [...context.outcomes],
  }));
}

export async function computeOutcomeBasedScores() {
  const records = await fetchPromisesWithOutcomesForScoring();
  const contexts = prepareScoreContexts(records);

  let totalLoadedOutcomes = 0;
  let totalScorableOutcomes = 0;

  const scoredPromises = contexts
    .map((context) => {
      totalLoadedOutcomes += context.outcomes.length;

      const scoredOutcomes = context.outcomes.map((outcome) =>
        computeOutcomeScore({
          outcome,
          source_count: outcome.source_count,
        })
      );

      const scorableOutcomes = scoredOutcomes.filter(isScoredOutcome);
      totalScorableOutcomes += scorableOutcomes.length;

      // Keep the raw fetch broad, but only return promises that actually
      // participate in the parallel outcome-based model.
      if (!scorableOutcomes.length) {
        return null;
      }

      return computePromiseFromOutcomes({
        promise: context.promise,
        scored_outcomes: scorableOutcomes,
      });
    })
    .filter(Boolean);

  console.debug(
    `[black-impact-score] prepared ${scoredPromises.length} scored promises and processed ${totalScorableOutcomes} scorable outcomes`
  );

  return {
    // This service remains parallel and non-breaking until a later API phase.
    records: scoredPromises,
    presidents: aggregatePresidentFromOutcomes(scoredPromises),
    metadata: {
      total_promises: scoredPromises.length,
      total_outcomes: totalScorableOutcomes,
      total_loaded_promises: contexts.length,
      total_loaded_outcomes: totalLoadedOutcomes,
      scoring_model: "outcome-based-v1",
    },
  };
}
