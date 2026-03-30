import { readOperatorActionHistory } from "./operatorActionHistory.js";

function summarizeCounts(entries) {
  return entries.reduce(
    (summary, entry) => {
      if (entry.status === "success") {
        summary.success += 1;
      } else if (entry.status === "blocked") {
        summary.blocked += 1;
      } else if (entry.status === "failed") {
        summary.failed += 1;
      }
      return summary;
    },
    { success: 0, blocked: 0, failed: 0 }
  );
}

function rankActions(entries, status = null, limit = 5) {
  const counts = new Map();

  for (const entry of entries) {
    if (!entry?.action_id) {
      continue;
    }
    if (status && entry.status !== status) {
      continue;
    }

    const existing = counts.get(entry.action_id) || {
      action_id: entry.action_id,
      action_label: entry.action_label || entry.action_id,
      workflow: entry.workflow_type || "unknown",
      count: 0,
    };
    existing.count += 1;
    counts.set(entry.action_id, existing);
  }

  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.action_label.localeCompare(b.action_label))
    .slice(0, limit);
}

function buildAverageDurations(entries) {
  const durations = new Map();

  for (const entry of entries) {
    if (!entry?.action_id || !Number.isFinite(entry.execution_duration_ms)) {
      continue;
    }

    const existing = durations.get(entry.action_id) || {
      action_id: entry.action_id,
      action_label: entry.action_label || entry.action_id,
      total: 0,
      count: 0,
    };
    existing.total += entry.execution_duration_ms;
    existing.count += 1;
    durations.set(entry.action_id, existing);
  }

  return [...durations.values()]
    .map((entry) => ({
      action_id: entry.action_id,
      action_label: entry.action_label,
      average_execution_duration_ms: Math.round(entry.total / entry.count),
      sample_count: entry.count,
    }))
    .sort(
      (a, b) =>
        b.average_execution_duration_ms - a.average_execution_duration_ms ||
        a.action_label.localeCompare(b.action_label)
    );
}

function buildRecentActivitySummary(entries) {
  const recentEntries = entries.slice(0, 10);
  const counts = summarizeCounts(recentEntries);

  return {
    window_size: recentEntries.length,
    success_count: counts.success,
    blocked_count: counts.blocked,
    failed_count: counts.failed,
    summary: recentEntries.length
      ? `Last ${recentEntries.length} actions: ${counts.success} success, ${counts.blocked} blocked, ${counts.failed} failed.`
      : "No recent operator activity has been recorded yet.",
  };
}

function buildPotentialFriction(entries) {
  const recentEntries = entries.slice(0, 20);
  const friction = [];
  const blockedCounts = new Map();
  const failedCounts = new Map();

  for (const entry of recentEntries) {
    if (!entry?.action_id) {
      continue;
    }
    if (entry.status === "blocked") {
      blockedCounts.set(entry.action_id, (blockedCounts.get(entry.action_id) || 0) + 1);
    }
    if (entry.status === "failed") {
      failedCounts.set(entry.action_id, (failedCounts.get(entry.action_id) || 0) + 1);
    }
  }

  for (const [actionId, count] of blockedCounts.entries()) {
    if (count > 3) {
      const match = recentEntries.find((entry) => entry.action_id === actionId);
      friction.push({
        type: "repeated_blocked_action",
        action_id: actionId,
        action_label: match?.action_label || actionId,
        summary: `${match?.action_label || actionId} has been blocked ${count} times recently.`,
      });
    }
  }

  for (const [actionId, count] of failedCounts.entries()) {
    if (count > 2) {
      const match = recentEntries.find((entry) => entry.action_id === actionId);
      friction.push({
        type: "repeated_failed_action",
        action_id: actionId,
        action_label: match?.action_label || actionId,
        summary: `${match?.action_label || actionId} has failed ${count} times recently.`,
      });
    }
  }

  if (recentEntries.length && !recentEntries.some((entry) => entry.status === "success")) {
    friction.push({
      type: "no_recent_success",
      action_id: null,
      action_label: "No recent success",
      summary: "No successful operator actions appear in the recent activity window.",
    });
  }

  return friction.slice(0, 5);
}

export async function getOperatorAnalytics() {
  const history = await readOperatorActionHistory({ limit: 100 });
  const mostRecentFailure = history.find((entry) => entry.status === "failed") || null;

  return {
    total_entries: history.length,
    most_used_actions: rankActions(history, null, 5),
    most_blocked_actions: rankActions(history, "blocked", 5),
    most_failed_actions: rankActions(history, "failed", 5),
    average_execution_time_per_action: buildAverageDurations(history),
    recent_activity_summary: buildRecentActivitySummary(history),
    most_recent_failure: mostRecentFailure,
    potential_friction: buildPotentialFriction(history),
    recent_entries: history.slice(0, 10),
  };
}
