#!/usr/bin/env node

import path from "node:path";
import {
  getCurrentAdministrationReviewPaths,
  writeCurrentAdministrationFeedbackSummary,
} from "../../lib/services/currentAdministrationReviewInsightsService.js";

function parseArgs(argv) {
  let outputPath = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--output") {
      outputPath = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg === "-h" || arg === "--help") {
      console.log(`Usage:
  node python/scripts/export_current_admin_feedback_summary.mjs [--output <path>]

Writes a read-only current-admin AI feedback summary JSON derived from review decision logs.
Default output:
  python/reports/current_admin/feedback/ai_feedback_summary.json`);
      process.exit(0);
    }
  }

  return {
    outputPath,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const paths = getCurrentAdministrationReviewPaths();
  const resolvedOutputPath = args.outputPath
    ? path.resolve(args.outputPath)
    : paths.defaultFeedbackOutputPath;

  const { payload } = await writeCurrentAdministrationFeedbackSummary(
    resolvedOutputPath
  );

  console.log("Current-admin feedback summary exported");
  console.log(`Output: ${resolvedOutputPath}`);
  console.log(`Total sessions: ${payload.total_sessions}`);
  console.log(`Total logged items: ${payload.total_logged_items}`);
  console.log(
    `Alignment rate: ${payload.alignment_analytics.alignment_rate}`
  );
}

main().catch((error) => {
  console.error("Failed to export current-admin feedback summary:", error);
  process.exit(1);
});

