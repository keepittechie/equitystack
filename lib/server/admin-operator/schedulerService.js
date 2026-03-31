import {
  getOperatorActionDefinition,
  listSerializedOperatorActions,
  resolveOperatorActionExecutionMode,
} from "./actionRegistry.js";
import { createRegisteredActionJob, getBrokerJob } from "./commandBroker.js";
import {
  createScheduleRecord,
  getScheduleRecord,
  listScheduleRecords,
  upsertScheduleRecord,
} from "./scheduleStore.js";
import {
  buildExecutionRuntimeMetadata,
  EXECUTION_MODES,
  getExecutorMetadata,
  normalizeString,
  toSafeNumber,
} from "./shared.js";

const ACTIVE_JOB_STATUSES = new Set(["queued", "running"]);
const VALID_SCHEDULE_TYPES = new Set(["manual", "daily", "weekly", "interval"]);
const WEEKDAY_INDEX = new Map([
  ["sun", 0],
  ["sunday", 0],
  ["mon", 1],
  ["monday", 1],
  ["tue", 2],
  ["tuesday", 2],
  ["wed", 3],
  ["wednesday", 3],
  ["thu", 4],
  ["thursday", 4],
  ["fri", 5],
  ["friday", 5],
  ["sat", 6],
  ["saturday", 6],
]);

function isDue(nextRunAt) {
  const parsed = new Date(nextRunAt || 0);
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() <= Date.now();
}

function parseTimeExpression(expression) {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(normalizeString(expression));
  if (!match) {
    return null;
  }
  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
  };
}

function parseWeeklyExpression(expression) {
  const match = /^([a-z]+)@([01]?\d|2[0-3]):([0-5]\d)$/i.exec(normalizeString(expression));
  if (!match) {
    return null;
  }
  const weekday = WEEKDAY_INDEX.get(match[1].toLowerCase());
  if (weekday === undefined) {
    return null;
  }
  return {
    weekday,
    hour: Number(match[2]),
    minute: Number(match[3]),
  };
}

function computeNextRunAt({
  scheduleType,
  scheduleExpression,
  enabled,
  fromDate = new Date(),
  lastRunAt = null,
}) {
  if (!enabled || scheduleType === "manual") {
    return null;
  }

  if (scheduleType === "interval") {
    const minutes = toSafeNumber(scheduleExpression, 0);
    if (minutes <= 0) {
      return null;
    }
    const seed = lastRunAt ? new Date(lastRunAt) : new Date(fromDate);
    if (Number.isNaN(seed.getTime())) {
      return null;
    }
    const next = new Date(seed.getTime());
    while (next.getTime() <= fromDate.getTime()) {
      next.setMinutes(next.getMinutes() + minutes);
    }
    return next.toISOString();
  }

  if (scheduleType === "daily") {
    const parsed = parseTimeExpression(scheduleExpression);
    if (!parsed) {
      return null;
    }
    const next = new Date(fromDate);
    next.setSeconds(0, 0);
    next.setHours(parsed.hour, parsed.minute, 0, 0);
    if (next.getTime() <= fromDate.getTime()) {
      next.setDate(next.getDate() + 1);
    }
    return next.toISOString();
  }

  if (scheduleType === "weekly") {
    const parsed = parseWeeklyExpression(scheduleExpression);
    if (!parsed) {
      return null;
    }
    const next = new Date(fromDate);
    next.setSeconds(0, 0);
    next.setHours(parsed.hour, parsed.minute, 0, 0);
    const daysAhead = (parsed.weekday - next.getDay() + 7) % 7;
    next.setDate(next.getDate() + daysAhead);
    if (next.getTime() <= fromDate.getTime()) {
      next.setDate(next.getDate() + 7);
    }
    return next.toISOString();
  }

  return null;
}

function validateScheduleExpression(scheduleType, scheduleExpression) {
  if (scheduleType === "manual") {
    return null;
  }
  if (scheduleType === "daily") {
    return parseTimeExpression(scheduleExpression)
      ? null
      : "Daily schedules require HH:MM in local server time.";
  }
  if (scheduleType === "weekly") {
    return parseWeeklyExpression(scheduleExpression)
      ? null
      : "Weekly schedules require weekday@HH:MM, for example mon@08:00.";
  }
  if (scheduleType === "interval") {
    return toSafeNumber(scheduleExpression, 0) > 0
      ? null
      : "Interval schedules require a positive minute count.";
  }
  return "Unsupported schedule type.";
}

function validateScheduleAction(action, { safeAutoRun = false, executionMode = "" } = {}) {
  if (!action) {
    throw new Error("The scheduled action is not registered.");
  }
  const scheduling = action.scheduling || {};
  if (!scheduling.schedulable) {
    throw new Error(`${action.title} cannot be scheduled.`);
  }
  if (safeAutoRun && !scheduling.safeAutoRun) {
    throw new Error(`${action.title} is blocked from automatic scheduling.`);
  }
  const { executionMode: resolvedExecutionMode, executionModes } = resolveOperatorActionExecutionMode(
    action,
    executionMode
  );
  const allowedScheduleModes =
    safeAutoRun || safeAutoRun === undefined
      ? executionModes.autoScheduleAllowedModes
      : executionModes.scheduleAllowedModes;
  if (!allowedScheduleModes.includes(resolvedExecutionMode)) {
    throw new Error(
      `${action.title} cannot be scheduled in execution mode \`${resolvedExecutionMode}\`. Allowed schedule modes: ${allowedScheduleModes.join(", ")}.`
    );
  }
  if (resolvedExecutionMode === EXECUTION_MODES.MCP_RUNTIME && safeAutoRun) {
    throw new Error(`${action.title} is blocked from automatic MCP runtime scheduling.`);
  }
  return resolvedExecutionMode;
}

function buildScheduleStatus(schedule, lastJob = null) {
  if (!schedule.enabled) {
    return "disabled";
  }
  if (lastJob && ACTIVE_JOB_STATUSES.has(lastJob.status)) {
    return lastJob.status;
  }
  if (schedule.scheduleType === "manual") {
    return "manual";
  }
  if (isDue(schedule.nextRunAt)) {
    return "overdue";
  }
  if (lastJob && ["failed", "blocked"].includes(lastJob.status)) {
    return "attention";
  }
  return "scheduled";
}

function buildScheduleSummary(schedule, action, lastJob = null) {
  if (lastJob) {
    return lastJob.summary || `${action.title} ran through schedule ${schedule.title}.`;
  }
  if (schedule.scheduleType === "manual") {
    return `${action.title} can be triggered manually from this schedule definition.`;
  }
  return `${action.title} is scheduled as ${schedule.scheduleType}.`;
}

async function enrichSchedule(schedule) {
  const action = getOperatorActionDefinition(schedule.actionId);
  const lastJob = schedule.lastJobId ? await getBrokerJob(schedule.lastJobId).catch(() => null) : null;
  const nextRunAt =
    schedule.nextRunAt ||
    computeNextRunAt({
      scheduleType: schedule.scheduleType,
      scheduleExpression: schedule.scheduleExpression,
      enabled: schedule.enabled,
      lastRunAt: schedule.lastRunAt,
    });

  return {
    ...schedule,
    action: action ? listSerializedOperatorActions().find((item) => item.id === action.id) || null : null,
    nextRunAt,
    status: buildScheduleStatus({ ...schedule, nextRunAt }, lastJob),
    lastJob,
    summary: buildScheduleSummary({ ...schedule, nextRunAt }, action || { title: schedule.title }, lastJob),
    overdue: isDue(nextRunAt),
  };
}

function normalizeScheduleInput(input = {}) {
  return input && typeof input === "object" && !Array.isArray(input) ? input : {};
}

export function listSchedulableActions() {
  return listSerializedOperatorActions().filter((action) => action.scheduling?.schedulable);
}

export async function listOperatorSchedules() {
  const records = await listScheduleRecords();
  return Promise.all(records.map(enrichSchedule));
}

export async function getOperatorSchedule(scheduleId) {
  const record = await getScheduleRecord(scheduleId);
  if (!record) {
    throw new Error(`Schedule ${scheduleId} was not found.`);
  }
  return enrichSchedule(record);
}

export async function createOperatorSchedule(input = {}) {
  const action = getOperatorActionDefinition(input.actionId);
  const resolvedExecutionMode = validateScheduleAction(action, {
    safeAutoRun: Boolean(input.safeAutoRun),
    executionMode: input.executionMode,
  });

  const scheduleType = normalizeString(input.scheduleType) || "manual";
  if (!VALID_SCHEDULE_TYPES.has(scheduleType)) {
    throw new Error("Unsupported schedule type.");
  }
  const expressionError = validateScheduleExpression(scheduleType, input.scheduleExpression);
  if (expressionError) {
    throw new Error(expressionError);
  }
  const nextRunAt = computeNextRunAt({
    scheduleType,
    scheduleExpression: input.scheduleExpression,
    enabled: Boolean(input.enabled),
  });

  return createScheduleRecord({
    title: normalizeString(input.title) || action.title,
    actionId: action.id,
    workflowFamily: action.workflowFamily,
    scheduleType,
    scheduleExpression: normalizeString(input.scheduleExpression) || null,
    timezone: normalizeString(input.timezone) || "America/Los_Angeles",
    enabled: Boolean(input.enabled),
    safeAutoRun: Boolean(input.safeAutoRun && action.scheduling?.safeAutoRun),
    requiresHumanCheckpoint: action.scheduling?.requiresHumanCheckpoint !== false,
    executionMode: resolvedExecutionMode,
    defaultInputJson: normalizeScheduleInput(input.defaultInputJson),
    defaultContextJson: normalizeScheduleInput(input.defaultContextJson),
    nextRunAt,
    status: Boolean(input.enabled) ? (scheduleType === "manual" ? "manual" : "scheduled") : "disabled",
    metadataJson: {
      executor: getExecutorMetadata(),
      scheduling_origin: "operator_ui",
    },
  }).then(enrichSchedule);
}

export async function updateOperatorSchedule(scheduleId, patch = {}) {
  const existing = await getScheduleRecord(scheduleId);
  if (!existing) {
    throw new Error(`Schedule ${scheduleId} was not found.`);
  }
  const action = getOperatorActionDefinition(patch.actionId || existing.actionId);
  const resolvedExecutionMode = validateScheduleAction(action, {
    safeAutoRun: Boolean(
      patch.safeAutoRun !== undefined ? patch.safeAutoRun : existing.safeAutoRun
    ),
    executionMode: patch.executionMode || existing.executionMode,
  });

  const scheduleType = normalizeString(patch.scheduleType || existing.scheduleType) || "manual";
  if (!VALID_SCHEDULE_TYPES.has(scheduleType)) {
    throw new Error("Unsupported schedule type.");
  }
  const scheduleExpression =
    patch.scheduleExpression !== undefined ? patch.scheduleExpression : existing.scheduleExpression;
  const expressionError = validateScheduleExpression(scheduleType, scheduleExpression);
  if (expressionError) {
    throw new Error(expressionError);
  }
  const enabled = patch.enabled !== undefined ? Boolean(patch.enabled) : existing.enabled;
  const nextRunAt = computeNextRunAt({
    scheduleType,
    scheduleExpression,
    enabled,
    lastRunAt: existing.lastRunAt,
  });

  return upsertScheduleRecord({
    ...existing,
    title: normalizeString(patch.title) || existing.title,
    actionId: action.id,
    workflowFamily: action.workflowFamily,
    scheduleType,
    scheduleExpression: normalizeString(scheduleExpression) || null,
    timezone: normalizeString(patch.timezone || existing.timezone) || "America/Los_Angeles",
    enabled,
    safeAutoRun: Boolean(
      (patch.safeAutoRun !== undefined ? patch.safeAutoRun : existing.safeAutoRun) &&
        action.scheduling?.safeAutoRun
    ),
    requiresHumanCheckpoint: action.scheduling?.requiresHumanCheckpoint !== false,
    executionMode: resolvedExecutionMode,
    defaultInputJson:
      patch.defaultInputJson && typeof patch.defaultInputJson === "object"
        ? patch.defaultInputJson
        : existing.defaultInputJson,
    defaultContextJson:
      patch.defaultContextJson && typeof patch.defaultContextJson === "object"
        ? patch.defaultContextJson
        : existing.defaultContextJson,
    nextRunAt,
    status: enabled ? (scheduleType === "manual" ? "manual" : "scheduled") : "disabled",
  }).then(enrichSchedule);
}

async function createScheduledJob(
  schedule,
  { triggerType = "manual_run", executionMode = "" } = {}
) {
  const action = getOperatorActionDefinition(schedule.actionId);
  const resolvedExecutionMode = validateScheduleAction(action, {
    safeAutoRun: triggerType === "scheduled_tick" || Boolean(schedule.safeAutoRun),
    executionMode: executionMode || schedule.executionMode,
  });
  const lastJob = schedule.lastJobId ? await getBrokerJob(schedule.lastJobId).catch(() => null) : null;
  if (lastJob && ACTIVE_JOB_STATUSES.has(lastJob.status)) {
    throw new Error(`Schedule ${schedule.title} already has an active broker job.`);
  }

  const result = await createRegisteredActionJob({
    actionId: schedule.actionId,
    input: schedule.defaultInputJson || {},
    executionMode: resolvedExecutionMode,
    context: {
      ...(schedule.defaultContextJson || {}),
      triggerSource: triggerType === "scheduled_tick" ? "scheduler_tick" : "schedule_manual_run",
    },
    metadataJson: {
      scheduling: {
        schedule_id: schedule.id,
        schedule_title: schedule.title,
        schedule_type: schedule.scheduleType,
        execution_mode: resolvedExecutionMode,
        trigger_type: triggerType,
        scheduled_at: new Date().toISOString(),
      },
      execution_runtime: {
        executor: buildExecutionRuntimeMetadata(resolvedExecutionMode),
        execution_mode: resolvedExecutionMode,
      },
    },
  });

  const now = new Date().toISOString();
  const nextRunAt = computeNextRunAt({
    scheduleType: schedule.scheduleType,
    scheduleExpression: schedule.scheduleExpression,
    enabled: schedule.enabled,
    fromDate: new Date(now),
    lastRunAt: now,
  });
  const updatedSchedule = await upsertScheduleRecord({
    ...schedule,
    lastRunAt: now,
    nextRunAt,
    lastJobId: result.job.id,
    status: "queued",
    lastResultSummary: result.job.summary,
    metadataJson: {
      ...(schedule.metadataJson || {}),
      last_trigger_type: triggerType,
    },
  });

  return {
    schedule: await enrichSchedule(updatedSchedule),
    job: result.job,
    action: result.action,
  };
}

export async function runScheduleNow(scheduleId, { executionMode = "" } = {}) {
  const schedule = await getScheduleRecord(scheduleId);
  if (!schedule) {
    throw new Error(`Schedule ${scheduleId} was not found.`);
  }
  return createScheduledJob(schedule, { triggerType: "manual_run", executionMode });
}

export async function runDueSchedules({ limit = 10 } = {}) {
  const schedules = await listScheduleRecords();
  const dueSchedules = schedules
    .filter((schedule) => schedule.enabled && schedule.safeAutoRun && schedule.nextRunAt && isDue(schedule.nextRunAt))
    .slice(0, limit);

  const queued = [];
  const skipped = [];

  for (const schedule of dueSchedules) {
    try {
      queued.push(await createScheduledJob(schedule, { triggerType: "scheduled_tick" }));
    } catch (error) {
      skipped.push({
        scheduleId: schedule.id,
        title: schedule.title,
        reason: error instanceof Error ? error.message : "Failed to run the due schedule.",
      });
      await upsertScheduleRecord({
        ...schedule,
        status: "attention",
        lastResultSummary: error instanceof Error ? error.message : "Failed to run the due schedule.",
      }).catch(() => {});
    }
  }

  return {
    queued,
    skipped,
    scanned: dueSchedules.length,
  };
}
