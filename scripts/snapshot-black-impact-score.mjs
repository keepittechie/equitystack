#!/usr/bin/env node
import mysql from "mysql2/promise";

const SNAPSHOT_KEY = "promise-score-api-outcome";

function parseArgs(argv) {
  const args = {
    apply: false,
    yes: false,
    url: process.env.EQUITYSTACK_SCORE_API_URL || "http://127.0.0.1:3000/api/promises/scores?model=outcome",
    label: "manual",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") args.apply = true;
    else if (arg === "--yes") args.yes = true;
    else if (arg === "--url") args.url = argv[++index] || args.url;
    else if (arg === "--label") args.label = argv[++index] || args.label;
    else if (arg === "-h" || arg === "--help") {
      console.log(`Usage: node scripts/snapshot-black-impact-score.mjs [--url URL] [--label LABEL] [--apply --yes]`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (args.apply && !args.yes) {
    throw new Error("--apply requires --yes");
  }

  return args;
}

function number(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function round(value) {
  return Number(number(value).toFixed(4));
}

function buildSnapshot(payload) {
  const presidents = Array.isArray(payload?.items) ? payload.items : [];
  const records = Array.isArray(payload?.records) ? payload.records : [];
  const topicScores = {};
  const outcomeIds = [];
  let totalScore = 0;
  let normalizedScoreTotal = 0;
  let outcomeCount = 0;

  for (const president of presidents) {
    totalScore += number(president.raw_score_total ?? president.raw_score);
    normalizedScoreTotal += number(president.normalized_score_total ?? president.normalized_score);
    outcomeCount += number(president.outcome_count);
  }

  for (const record of records) {
    const topic = record.topic || "Uncategorized";
    topicScores[topic] = round((topicScores[topic] || 0) + number(record.total_score));
    for (const outcome of record.scored_outcomes || []) {
      const id = outcome?.outcome?.id ?? outcome?.id;
      if (id != null) outcomeIds.push(String(id));
    }
  }

  return {
    total_score: round(totalScore),
    normalized_score_total: round(normalizedScoreTotal),
    outcome_count: outcomeCount,
    president_count: presidents.length,
    topic_scores: topicScores,
    outcome_ids: [...new Set(outcomeIds)],
  };
}

async function connectDb() {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const response = await fetch(args.url);
  if (!response.ok) {
    throw new Error(`Score API returned HTTP ${response.status} for ${args.url}`);
  }

  const payload = await response.json();
  const snapshot = buildSnapshot(payload);
  const report = {
    workflow: "black_impact_score_snapshot",
    mode: args.apply ? "apply" : "dry_run",
    database_mutated: false,
    snapshot_key: SNAPSHOT_KEY,
    snapshot_label: args.label,
    source_url: args.url,
    snapshot,
    inserted_snapshot_id: null,
  };

  if (args.apply) {
    const db = await connectDb();
    try {
      await db.execute(
        `
        INSERT INTO black_impact_score_snapshots (
          snapshot_key,
          snapshot_label,
          score_family,
          total_score,
          normalized_score_total,
          outcome_count,
          president_count,
          snapshot_payload
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON))
        `,
        [
          SNAPSHOT_KEY,
          args.label,
          "direct",
          snapshot.total_score,
          snapshot.normalized_score_total,
          snapshot.outcome_count,
          snapshot.president_count,
          JSON.stringify(snapshot),
        ]
      ).then(([result]) => {
        report.inserted_snapshot_id = result.insertId || null;
        report.database_mutated = true;
      });
    } finally {
      await db.end();
    }
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
