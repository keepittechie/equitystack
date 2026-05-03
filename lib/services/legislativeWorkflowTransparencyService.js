import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const REPORTS_DIR = path.join(PROJECT_ROOT, "python", "reports");

const HEALTH_REPORT_PATH = path.join(
  REPORTS_DIR,
  "legislative_workflow_health_report.json"
);
const ANOMALY_REPORT_PATH = path.join(
  REPORTS_DIR,
  "legislative_workflow_anomaly_report.json"
);

const SAFE_STATUS_VALUES = new Set(["PASS", "WARN", "FAIL"]);
const STATUS_ORDER = { PASS: 0, WARN: 1, FAIL: 2 };

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toSafeStatus(value, fallback = "WARN") {
  const normalized = normalizeString(value).toUpperCase();
  return SAFE_STATUS_VALUES.has(normalized) ? normalized : fallback;
}

function toSafeCount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }
  return Math.round(numeric);
}

function toIsoTimestamp(value) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }

  const timestamp = new Date(normalized);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

function toBoolean(value) {
  return Boolean(value);
}

function compareStatuses(left, right) {
  return (STATUS_ORDER[left] ?? STATUS_ORDER.WARN) - (STATUS_ORDER[right] ?? STATUS_ORDER.WARN);
}

function getWorstStatus(statuses = []) {
  const filtered = statuses
    .map((value) => toSafeStatus(value, "WARN"))
    .sort((left, right) => compareStatuses(right, left));
  return filtered[0] || "WARN";
}

function summarizePipelineStatus(value) {
  const normalized = normalizeString(value).toLowerCase();
  if (!normalized) {
    return "Unknown";
  }
  if (normalized.includes("success")) {
    return "Succeeded";
  }
  if (normalized.includes("fail")) {
    return "Failed";
  }
  if (normalized.includes("running") || normalized.includes("progress")) {
    return "Running";
  }
  if (normalized.includes("block")) {
    return "Blocked";
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function latestTimestamp(values = []) {
  const timestamps = values
    .map((value) => toIsoTimestamp(value))
    .filter(Boolean)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime());
  return timestamps[0] || null;
}

async function readJsonSafe(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function buildHealthStatusMessage(report, health) {
  if (!report) {
    return "No recent public-safe legislative workflow health report is available yet.";
  }

  const reviewBundleExists =
    report?.artifacts?.items?.review_bundle?.exists !== false;

  if (!reviewBundleExists) {
    return "The workflow is currently missing a complete review bundle, so some legislative link-review checks are incomplete.";
  }

  if (health.pipelineStatus === "Failed" || report?.pipeline?.blocked_before_bundle_generation) {
    return "The latest legislative workflow run did not complete, so the current review state should be treated as incomplete until the next successful rebuild.";
  }

  if (health.repairRecommended) {
    return "The workflow is recommending a repair pass because some saved review state appears stale against the current canonical record.";
  }

  if (health.manualReviewCount > 0) {
    return "Some legislative link decisions are still in the review-needed category, so the workflow is waiting on human review for gray-zone cases.";
  }

  if (health.approvedPendingCount > 0) {
    return "Some legislative link updates are already approved and waiting for the guarded apply stage.";
  }

  if (health.status === "PASS") {
    return "The latest health check shows a parseable legislative review state with no immediate workflow-state warning signals.";
  }

  return "The legislative workflow is available, but the latest health report still shows a warning that should be reviewed before treating the workflow as fully current.";
}

function buildAnomalyStatusMessage(report, anomaly) {
  if (!report) {
    return "No recent public-safe legislative anomaly report is available yet.";
  }

  if (anomaly.status === "FAIL" && anomaly.flagCount === 0) {
    return "The anomaly checker could not complete its full comparison because the canonical legislative review bundle was unavailable or invalid.";
  }

  if (anomaly.flagCount > 0) {
    return "The anomaly checker flagged unusual classification or artifact patterns that should be reviewed before the workflow is treated as clean.";
  }

  if (!anomaly.baselineAvailable) {
    return "The anomaly checker is active, but long-run scoring-drift comparison is still building a usable baseline.";
  }

  if (anomaly.status === "PASS") {
    return "The latest anomaly check did not flag suspicious classification or workflow-artifact patterns.";
  }

  return "The anomaly checker found a non-blocking warning pattern that should be monitored alongside the next workflow run.";
}

function summarizeHealthReport(report) {
  if (!report || typeof report !== "object") {
    return {
      available: false,
      status: "WARN",
      generatedAt: null,
      pipelineStatus: "Unknown",
      manualReviewCount: 0,
      approvedPendingCount: 0,
      aiApprovedPendingCount: 0,
      repairRecommended: false,
      summary: "No recent public-safe legislative workflow health report is available yet.",
    };
  }

  const manualReviewCount = toSafeCount(report?.bundle_state?.manual_review_required);
  const humanApprovedPendingCount = toSafeCount(
    report?.bundle_state?.human_approved_actions_pending_apply
  );
  const aiApprovedPendingCount = toSafeCount(
    report?.bundle_state?.ai_approved_actions_pending_apply
  );

  const health = {
    available: true,
    status: toSafeStatus(report.status, "WARN"),
    generatedAt: toIsoTimestamp(report.generated_at),
    pipelineStatus: summarizePipelineStatus(report?.pipeline?.pipeline_status),
    manualReviewCount,
    approvedPendingCount: humanApprovedPendingCount + aiApprovedPendingCount,
    humanApprovedPendingCount,
    aiApprovedPendingCount,
    repairRecommended: toBoolean(report?.repair_readiness?.repair_recommended),
    summary: "",
  };

  health.summary = buildHealthStatusMessage(report, health);
  return health;
}

function summarizeAnomalyReport(report) {
  if (!report || typeof report !== "object") {
    return {
      available: false,
      status: "WARN",
      generatedAt: null,
      baselineAvailable: false,
      flagCount: 0,
      summary: "No recent public-safe legislative anomaly report is available yet.",
    };
  }

  const classificationFlagCount = toSafeCount(
    report?.classification_anomalies?.flagged_rows
  );
  const suspiciousFlagCount = toSafeCount(report?.suspicious_flags?.total_flags);

  const anomaly = {
    available: true,
    status: toSafeStatus(report.status, "WARN"),
    generatedAt: toIsoTimestamp(report.generated_at),
    baselineAvailable: toBoolean(report?.baseline_available),
    flagCount: classificationFlagCount + suspiciousFlagCount,
    classificationFlagCount,
    suspiciousFlagCount,
    summary: "",
  };

  anomaly.summary = buildAnomalyStatusMessage(report, anomaly);
  return anomaly;
}

function buildOverallSummary({ health, anomaly }) {
  const status = getWorstStatus([
    health?.status || "WARN",
    anomaly?.status || "WARN",
  ]);

  if (status === "FAIL" && health?.status === "FAIL") {
    return health.summary;
  }

  if (status === "FAIL" && anomaly?.status === "FAIL") {
    return anomaly.summary;
  }

  if (status === "WARN" && health?.manualReviewCount > 0) {
    return "The workflow is usable, but some legislative link cases still need human review before the current cycle is fully complete.";
  }

  if (status === "WARN" && health?.approvedPendingCount > 0) {
    return "The workflow is usable, but some reviewed legislative link updates are still waiting for the guarded apply stage.";
  }

  if (status === "PASS") {
    return "The latest public-safe workflow reports show a healthy legislative review cycle with no immediate warning signals.";
  }

  return "The latest public-safe workflow reports are incomplete or still stabilizing, so readers should treat the current legislative workflow summary as provisional.";
}

export function buildLegislativeWorkflowTransparencySummary({
  healthReport = null,
  anomalyReport = null,
} = {}) {
  const health = summarizeHealthReport(healthReport);
  const anomaly = summarizeAnomalyReport(anomalyReport);
  const status = getWorstStatus([health.status, anomaly.status]);

  return {
    status,
    generatedAt: latestTimestamp([health.generatedAt, anomaly.generatedAt]),
    statusMessage: buildOverallSummary({ health, anomaly }),
    health,
    anomaly,
  };
}

export async function getLegislativeWorkflowTransparencyData() {
  const [healthReport, anomalyReport] = await Promise.all([
    readJsonSafe(HEALTH_REPORT_PATH),
    readJsonSafe(ANOMALY_REPORT_PATH),
  ]);

  return buildLegislativeWorkflowTransparencySummary({
    healthReport,
    anomalyReport,
  });
}

export const LEGISLATIVE_WORKFLOW_TRANSPARENCY_PATHS = Object.freeze({
  healthReport: HEALTH_REPORT_PATH,
  anomalyReport: ANOMALY_REPORT_PATH,
});
