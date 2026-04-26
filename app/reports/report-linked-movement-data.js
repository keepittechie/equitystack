import { fetchDashboardPolicyRankings } from "@/lib/services/dashboardPolicyService";
import {
  assertSerializableClientProps,
  normalizeToClientSafeObject,
} from "@/app/lib/client-contract";

const PLACEHOLDER_LABELS = new Set([
  "outcome update",
  "policy outcome",
  "promise record",
  "tracked bill",
  "record",
  "policy",
]);

export function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isUsefulLabel(value) {
  const text = cleanText(value);
  const normalized = text.toLowerCase();

  if (!text || text === "—" || PLACEHOLDER_LABELS.has(normalized)) {
    return false;
  }

  return !/^policy outcome\s+\d+$/i.test(text);
}

function toFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatSignedScore(value) {
  const numeric = toFiniteNumber(value);
  if (numeric == null) {
    return null;
  }

  const formatted = Number.isInteger(numeric)
    ? String(Math.abs(numeric))
    : Math.abs(numeric).toFixed(1);
  if (numeric > 0) {
    return `+${formatted} Black Impact`;
  }
  if (numeric < 0) {
    return `-${formatted} Black Impact`;
  }
  return "No score change";
}

export function getScoreMovementValue(item = {}) {
  const explicitDelta = toFiniteNumber(item.score_delta);
  if (explicitDelta != null) {
    return explicitDelta;
  }

  const previousScore = toFiniteNumber(item.previous_score);
  const currentScore = toFiniteNumber(item.current_score);
  if (previousScore != null && currentScore != null) {
    return currentScore - previousScore;
  }

  return toFiniteNumber(item.impact_score ?? item.black_impact_score);
}

function buildScoreImpactLabel(item = {}, direction) {
  const scoreMovement = getScoreMovementValue(item);
  if (scoreMovement != null) {
    return formatSignedScore(scoreMovement);
  }

  const normalizedDirection = cleanText(direction).toLowerCase();
  if (normalizedDirection.includes("positive")) return "Positive signal";
  if (normalizedDirection.includes("negative")) return "Negative signal";
  if (normalizedDirection.includes("mixed")) return "Mixed signal";
  if (normalizedDirection.includes("blocked") || normalizedDirection.includes("stalled")) {
    return "Stalled";
  }

  return cleanText(item.score_status) || "Pending score";
}

function buildWhyThisMattersText(item = {}, recordType, direction) {
  const directText =
    cleanText(item.why_it_matters) ||
    cleanText(item.impact_summary) ||
    cleanText(item.summary) ||
    cleanText(item.evidence_notes) ||
    cleanText(item.source_notes);

  if (directText) {
    return directText.split(/\s+/).slice(0, 48).join(" ");
  }

  const normalizedType = cleanText(recordType).toLowerCase();
  const normalizedDirection = cleanText(direction).toLowerCase();

  if (normalizedType.includes("bill") && normalizedDirection.includes("blocked")) {
    return "This tracked bill has not reached enacted status, so its downstream community impact remains pending.";
  }
  if (normalizedType.includes("promise") && normalizedDirection.includes("positive")) {
    return "This promise is linked to a documented action that moved in a positive direction.";
  }
  if (normalizedType.includes("promise") && normalizedDirection.includes("mixed")) {
    return "This promise shows partial progress with unresolved outcomes.";
  }
  if (normalizedType.includes("policy") && normalizedDirection.includes("negative")) {
    return "This update reflects a documented negative shift in the tracked policy record.";
  }

  return "This update connects a tracked record to policy movement or reviewed evidence.";
}

export function buildReportLinkedPolicyUpdates(items = [], { limit = 8 } = {}) {
  const seen = new Set();
  const rows = items
    .map((item) => {
      const title = cleanText(item.title);
      const linkedRecordTitle = cleanText(
        item.linked_record_title || item.linked_record
      );
      const summary = cleanText(item.summary);
      const date = item.date || item.latest_action_date || null;
      const direction = cleanText(item.impact_direction || item.status);

      if (!isUsefulLabel(title) || !isUsefulLabel(linkedRecordTitle)) {
        return null;
      }

      if (!date && !summary && !direction) {
        return null;
      }

      const dedupeKey = [
        title.toLowerCase(),
        linkedRecordTitle.toLowerCase(),
        String(date || ""),
        direction.toLowerCase(),
      ].join("|");

      if (seen.has(dedupeKey)) {
        return null;
      }
      seen.add(dedupeKey);

      return {
        ...item,
        title,
        summary,
        date,
        href: item.linked_record_href || item.href || "/policies",
        impact_direction: direction || null,
        score_impact_label: buildScoreImpactLabel(item, direction),
        score_movement_value: getScoreMovementValue(item),
        why_this_matters_text: buildWhyThisMattersText(
          item,
          item.linked_record_type || item.record_type || item.policy_type,
          direction
        ),
        linked_record_title: linkedRecordTitle,
        record_type: item.linked_record_type || item.record_type || "Policy",
      };
    })
    .filter(Boolean);

  return limit == null ? rows : rows.slice(0, limit);
}

export async function getReportLinkedMovementRows({
  latestLimit = 16,
  source = "latest",
  limit = 8,
  contractPath = "ReportLinkedPolicyMovement.items",
} = {}) {
  const policyRankings = await fetchDashboardPolicyRankings({ latestLimit });
  const sourceRows =
    source === "records" ? policyRankings.records || [] : policyRankings.latestPolicyUpdates || [];
  const rows = buildReportLinkedPolicyUpdates(sourceRows, { limit });
  const safeRows = rows.map((row) => normalizeToClientSafeObject(row));

  assertSerializableClientProps(safeRows, contractPath);

  return {
    rows: safeRows,
    policyRankings,
  };
}
