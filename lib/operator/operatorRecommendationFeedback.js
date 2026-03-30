import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const FEEDBACK_PATH = path.join(
  PROJECT_ROOT,
  "python",
  "reports",
  "admin_operator_recommendation_feedback.json"
);
const MAX_FEEDBACK_ITEMS = 500;
const DISMISS_WINDOW_MS = 24 * 60 * 60 * 1000;
const VALID_FEEDBACK_VALUES = new Set(["helpful", "not_helpful", "dismissed"]);

async function readJsonSafe(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function readOperatorRecommendationFeedback() {
  const payload = await readJsonSafe(FEEDBACK_PATH);
  return Array.isArray(payload) ? payload.slice(0, MAX_FEEDBACK_ITEMS) : [];
}

export async function appendOperatorRecommendationFeedback({
  recommendation_id,
  feedback,
  source = "ui",
}) {
  if (!recommendation_id) {
    throw new Error("Recommendation feedback requires a recommendation_id.");
  }
  if (!VALID_FEEDBACK_VALUES.has(feedback)) {
    throw new Error("Recommendation feedback value is invalid.");
  }

  const existing = await readOperatorRecommendationFeedback();
  const next = [
    {
      recommendation_id,
      feedback,
      source,
      timestamp: new Date().toISOString(),
    },
    ...existing,
  ].slice(0, MAX_FEEDBACK_ITEMS);

  await fs.mkdir(path.dirname(FEEDBACK_PATH), { recursive: true });
  await fs.writeFile(FEEDBACK_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");

  return next;
}

export function summarizeRecommendationFeedback(feedbackEntries = []) {
  const summaryByRecommendation = new Map();

  for (const entry of feedbackEntries) {
    if (!entry?.recommendation_id) {
      continue;
    }

    const existing = summaryByRecommendation.get(entry.recommendation_id) || {
      recommendation_id: entry.recommendation_id,
      helpful_count: 0,
      not_helpful_count: 0,
      dismissed_count: 0,
      latest_feedback: null,
      latest_timestamp: null,
      suppress_until: null,
    };

    if (entry.feedback === "helpful") {
      existing.helpful_count += 1;
    } else if (entry.feedback === "not_helpful") {
      existing.not_helpful_count += 1;
    } else if (entry.feedback === "dismissed") {
      existing.dismissed_count += 1;
    }

    if (!existing.latest_timestamp || entry.timestamp > existing.latest_timestamp) {
      existing.latest_timestamp = entry.timestamp;
      existing.latest_feedback = entry.feedback;
      existing.suppress_until =
        entry.feedback === "dismissed"
          ? new Date(new Date(entry.timestamp).getTime() + DISMISS_WINDOW_MS).toISOString()
          : null;
    }

    summaryByRecommendation.set(entry.recommendation_id, existing);
  }

  return summaryByRecommendation;
}

export async function getOperatorRecommendationFeedbackSummary() {
  const feedbackEntries = await readOperatorRecommendationFeedback();
  return summarizeRecommendationFeedback(feedbackEntries);
}
