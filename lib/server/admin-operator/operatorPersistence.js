import { getDb } from "@/lib/db";
import {
  normalizeString,
  toIsoTimestamp,
} from "./shared.js";

const RECOVERABLE_DB_ERROR_CODES = new Set([
  "ER_ACCESS_DENIED_ERROR",
  "ER_BAD_DB_ERROR",
  "ER_NO_SUCH_TABLE",
  "ER_NO_REFERENCED_ROW_2",
  "ER_ROW_IS_REFERENCED_2",
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "PROTOCOL_CONNECTION_LOST",
]);

export function isOperatorDbConfigured() {
  return Boolean(
    normalizeString(process.env.DB_HOST) &&
    normalizeString(process.env.DB_USER) &&
    normalizeString(process.env.DB_NAME)
  );
}

export function isRecoverableOperatorDbError(error) {
  return RECOVERABLE_DB_ERROR_CODES.has(normalizeString(error?.code));
}

export function parseJsonColumn(value, fallback) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  if (typeof value === "object") {
    return value;
  }
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

export function stringifyJsonColumn(value, fallback = null) {
  const next = value === undefined ? fallback : value;
  return JSON.stringify(next);
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function pad3(value) {
  return String(value).padStart(3, "0");
}

function formatUtcDateTime3(date) {
  return [
    date.getUTCFullYear(),
    "-",
    pad2(date.getUTCMonth() + 1),
    "-",
    pad2(date.getUTCDate()),
    " ",
    pad2(date.getUTCHours()),
    ":",
    pad2(date.getUTCMinutes()),
    ":",
    pad2(date.getUTCSeconds()),
    ".",
    pad3(date.getUTCMilliseconds()),
  ].join("");
}

function normalizeMariaDbFraction(fraction = "") {
  return pad3(String(fraction).slice(0, 3));
}

function isMariaDbDateTimeText(value) {
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,6})?$/.test(value);
}

export function toDbTimestamp(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "string") {
    const normalized = normalizeString(value);
    if (!normalized) {
      return null;
    }
    if (isMariaDbDateTimeText(normalized)) {
      const [datePart, timePart = "00:00:00"] = normalized.split(" ");
      const [timeBase, fraction = "000"] = timePart.split(".");
      return `${datePart} ${timeBase}.${normalizeMariaDbFraction(fraction)}`;
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return formatUtcDateTime3(date);
}

export function fromDbTimestamp(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }

  if (isMariaDbDateTimeText(normalized)) {
    const [datePart, timePart = "00:00:00"] = normalized.split(" ");
    const [timeBase, fraction = "000"] = timePart.split(".");
    return `${datePart}T${timeBase}.${normalizeMariaDbFraction(fraction)}Z`;
  }

  return toIsoTimestamp(value);
}

export function buildExecutorColumns(metadataJson = {}) {
  const runtime = metadataJson?.execution_runtime || {};
  const executor = runtime?.executor || metadataJson?.executor || {};
  return {
    executorModel: normalizeString(executor.executor_model) || null,
    executorBackend: normalizeString(executor.executor_backend) || null,
    executorHost: normalizeString(executor.executor_host) || null,
    executorTransport:
      normalizeString(executor.executor_transport) ||
      normalizeString(runtime?.executor_transport) ||
      normalizeString(metadataJson?.executor_transport) ||
      null,
    executionMode:
      normalizeString(runtime?.execution_mode) ||
      normalizeString(metadataJson?.execution_mode) ||
      null,
  };
}

export async function withOperatorDbFallback(runDb, runFallback) {
  if (!isOperatorDbConfigured()) {
    return runFallback();
  }

  try {
    const db = getDb();
    return await runDb(db);
  } catch (error) {
    if (isRecoverableOperatorDbError(error)) {
      return runFallback();
    }
    throw error;
  }
}
