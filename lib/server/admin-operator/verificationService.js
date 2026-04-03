import { getDb } from "@/lib/db";
import {
  buildOperatorActionCommand,
  getOperatorActionDefinition,
  listSerializedOperatorActions,
} from "./actionRegistry.js";
import { runOperatorActionCommand } from "./actionRunner.js";
import { listSchedulableActions } from "./schedulerService.js";
import { getCurrentAdministrationOperatorWorkspace } from "@/lib/services/currentAdministrationReviewInsightsService.js";
import {
  getExecutorMetadata,
  getRemoteExecutorTransportConfig,
  normalizeString,
} from "./shared.js";
import { isOperatorDbConfigured } from "./operatorPersistence.js";

const OPERATOR_SCHEMA_TABLES = [
  "operator_job_runs",
  "operator_job_logs",
  "operator_workflow_sessions",
  "operator_artifacts",
  "operator_review_queue_items",
  "operator_system_signals",
  "operator_command_history",
  "operator_schedules",
];

const DATA_INTEGRITY_TABLES = [
  "promises",
  "promise_actions",
  "promise_outcomes",
  "sources",
  "promise_action_sources",
  "promise_outcome_sources",
  "promise_relationships",
  "future_bills",
  "tracked_bills",
  "future_bill_links",
];

const SAFE_REMOTE_ACTION_IDS = [
  "currentAdmin.status",
  "currentAdmin.run",
  "currentAdmin.workflowResume",
  "legislative.run",
  "legislative.feedback",
];

const REMOTE_WORKFLOW_PROBE_ACTION_ID = "currentAdmin.workflowResume";

function buildCheck({
  id,
  name,
  status,
  summary,
  details = "",
  recommendedNextStep = "",
  category = "",
  metadata = {},
}) {
  return {
    id,
    name,
    status,
    summary,
    details,
    checkedAt: new Date().toISOString(),
    recommendedNextStep,
    category,
    metadata,
  };
}

function aggregateStatuses(checks = []) {
  if (checks.some((check) => check.status === "failed")) {
    return "failed";
  }
  if (checks.some((check) => check.status === "warning")) {
    return "warning";
  }
  if (checks.some((check) => check.status === "unavailable")) {
    return "unavailable";
  }
  return "passed";
}

function buildReport({ scope, title, checks }) {
  return {
    scope,
    title,
    status: aggregateStatuses(checks),
    checkedAt: new Date().toISOString(),
    checks,
  };
}

function isProductionRuntime() {
  return normalizeString(process.env.NODE_ENV) === "production";
}

function classifyFetchFailure(error) {
  const text = `${normalizeString(error?.message || error)}`.toLowerCase();
  if (
    [
      "econnrefused",
      "enotfound",
      "ehostunreach",
      "etimedout",
      "timed out",
      "network",
      "fetch failed",
      "connection refused",
      "connection reset",
      "unreachable",
    ].some((pattern) => text.includes(pattern))
  ) {
    return "connectivity";
  }
  return "backend_unavailable";
}

async function fetchJsonWithTimeout(url, init = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        accept: "application/json",
        ...(init.headers || {}),
      },
      cache: "no-store",
    });
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }
    return { response, payload, text };
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildUnavailableCheck(id, name, summary, recommendedNextStep, metadata = {}) {
  return buildCheck({
    id,
    name,
    status: "unavailable",
    summary,
    recommendedNextStep,
    category: "environment",
    metadata,
  });
}

async function listPresentTables(db, tableNames = []) {
  const [rows] = await db.query(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = ?
        AND table_name IN (${tableNames.map(() => "?").join(", ")})
    `,
    [process.env.DB_NAME, ...tableNames]
  );
  return new Set((rows || []).map((row) => normalizeString(row.table_name)));
}

async function queryIntegrityCountAndSamples({
  db,
  countSql,
  sampleSql = "",
  params = [],
}) {
  const [countRows] = await db.query(countSql, params);
  const total = Number(countRows?.[0]?.total || 0);
  let sampleRows = [];
  if (total > 0 && sampleSql) {
    const [rows] = await db.query(sampleSql, params);
    sampleRows = Array.isArray(rows) ? rows : [];
  }
  return { total, sampleRows };
}

function formatSampleRows(sampleRows = [], formatter) {
  if (!sampleRows.length) {
    return "";
  }
  return sampleRows.map((row) => formatter(row)).join("; ");
}

async function verifyDbConnectivityCheck() {
  if (!isProductionRuntime()) {
    return buildUnavailableCheck(
      "db-connectivity",
      "DB connectivity",
      "Live DB verification is skipped outside production runtime.",
      "Deploy to 10.10.0.13 and rerun `verify environment`.",
      { reason: "non_production_runtime" }
    );
  }

  if (!isOperatorDbConfigured()) {
    return buildCheck({
      id: "db-connectivity",
      name: "DB connectivity",
      status: "failed",
      summary: "Required DB environment variables are missing.",
      details: "DB_HOST, DB_USER, and DB_NAME must be configured on the production app host.",
      recommendedNextStep: "Set the DB env vars on 10.10.0.13 and rerun verification.",
      category: "environment",
      metadata: { failureCategory: "config" },
    });
  }

  try {
    const db = getDb();
    const [rows] = await db.query("SELECT 1 AS ok");
    const ok = Array.isArray(rows) ? rows[0]?.ok === 1 : rows?.ok === 1;
    return buildCheck({
      id: "db-connectivity",
      name: "DB connectivity",
      status: ok ? "passed" : "warning",
      summary: "MariaDB connection succeeded.",
      details: "The operator control plane can reach the configured database.",
      recommendedNextStep: "Continue with schema verification.",
      category: "environment",
    });
  } catch (error) {
    return buildCheck({
      id: "db-connectivity",
      name: "DB connectivity",
      status: "failed",
      summary: "MariaDB connection failed.",
      details: normalizeString(error?.message) || "Unknown database connection failure.",
      recommendedNextStep: "Verify DB host, credentials, network access, and MariaDB health on 10.10.0.13.",
      category: "environment",
      metadata: { failureCategory: "connectivity" },
    });
  }
}

async function verifyOperatorSchemaCheck() {
  if (!isProductionRuntime()) {
    return buildUnavailableCheck(
      "control-plane-schema",
      "Control-plane schema",
      "Schema verification is skipped outside production runtime.",
      "Deploy to 10.10.0.13 and rerun `verify control-plane`.",
      { reason: "non_production_runtime" }
    );
  }

  if (!isOperatorDbConfigured()) {
    return buildCheck({
      id: "control-plane-schema",
      name: "Control-plane schema",
      status: "failed",
      summary: "Schema verification cannot run because DB config is missing.",
      details: "The operator schema check depends on a configured MariaDB connection.",
      recommendedNextStep: "Configure DB env vars and rerun verification.",
      category: "control_plane",
      metadata: { failureCategory: "config" },
    });
  }

  try {
    const db = getDb();
    const [rows] = await db.query(
      `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = ?
          AND table_name IN (${OPERATOR_SCHEMA_TABLES.map(() => "?").join(", ")})
      `,
      [process.env.DB_NAME, ...OPERATOR_SCHEMA_TABLES]
    );
    const foundTables = new Set((rows || []).map((row) => normalizeString(row.table_name)));
    const missingTables = OPERATOR_SCHEMA_TABLES.filter((tableName) => !foundTables.has(tableName));

    if (missingTables.length) {
      return buildCheck({
        id: "control-plane-schema",
        name: "Control-plane schema",
        status: "failed",
        summary: `${missingTables.length} operator control-plane table(s) are missing.`,
        details: `Missing tables: ${missingTables.join(", ")}`,
        recommendedNextStep: "Apply `database/admin_operator_control_plane.sql` on the production DB and rerun verification.",
        category: "control_plane",
        metadata: { failureCategory: "schema_missing", missingTables },
      });
    }

    return buildCheck({
      id: "control-plane-schema",
      name: "Control-plane schema",
      status: "passed",
      summary: "All operator control-plane tables are present.",
      details: `Verified tables: ${OPERATOR_SCHEMA_TABLES.join(", ")}`,
      recommendedNextStep: "Continue with broker and schedule readiness checks.",
      category: "control_plane",
    });
  } catch (error) {
    return buildCheck({
      id: "control-plane-schema",
      name: "Control-plane schema",
      status: "failed",
      summary: "Schema verification query failed.",
      details: normalizeString(error?.message) || "Unknown schema verification failure.",
      recommendedNextStep: "Verify the DB connection and schema privileges on 10.10.0.13.",
      category: "control_plane",
      metadata: { failureCategory: "query_failed" },
    });
  }
}

function verifyBrokerReadinessChecks() {
  const actions = listSerializedOperatorActions();
  const localAction = actions.find((action) => action.id === "currentAdmin.status");
  const remoteAction = actions.find((action) => action.id === "legislative.run");

  return [
    buildCheck({
      id: "broker-local-mode",
      name: "Broker local mode readiness",
      status: localAction?.executionModes?.allowedModes?.includes("local_cli") ? "passed" : "failed",
      summary: localAction
        ? "A safe operator action is registered for local CLI mode."
        : "The safe local validation action is not registered.",
      details: localAction
        ? `${localAction.id} supports: ${localAction.executionModes.allowedModes.join(", ")}`
        : "currentAdmin.status was not found in the action registry.",
      recommendedNextStep: localAction
        ? "Local CLI readiness is structurally valid."
        : "Restore the currentAdmin.status registry definition.",
      category: "control_plane",
      metadata: { actionId: localAction?.id || null },
    }),
    buildCheck({
      id: "broker-remote-mode",
      name: "Broker remote mode readiness",
      status: remoteAction?.executionModes?.allowedModes?.includes("remote_executor") ? "passed" : "failed",
      summary: remoteAction
        ? "A safe operator action is registered for remote executor mode."
        : "The safe remote validation action is not registered.",
      details: remoteAction
        ? `${remoteAction.id} supports: ${remoteAction.executionModes.allowedModes.join(", ")}`
        : "legislative.run was not found in the action registry.",
      recommendedNextStep: remoteAction
        ? "Remote mode is structurally available through the broker."
        : "Restore the legislative.run registry definition.",
      category: "control_plane",
      metadata: { actionId: remoteAction?.id || null },
    }),
  ];
}

function verifyScheduleSubsystemCheck() {
  const schedulableActions = listSchedulableActions();
  return buildCheck({
    id: "schedule-subsystem",
    name: "Schedule subsystem readiness",
    status: schedulableActions.length ? "passed" : "warning",
    summary: schedulableActions.length
      ? `${schedulableActions.length} schedulable action(s) are available.`
      : "No schedulable actions are currently registered.",
    details: schedulableActions.length
      ? `Schedulable actions include: ${schedulableActions.slice(0, 5).map((action) => action.id).join(", ")}`
      : "The schedule subsystem is present, but no actions are currently exposed for schedules.",
    recommendedNextStep: schedulableActions.length
      ? "Use /admin/schedules to create or inspect schedule definitions."
      : "Verify registry scheduling metadata.",
    category: "control_plane",
  });
}

async function verifyRemoteExecutorHealthChecks() {
  const executor = getExecutorMetadata();
  const transport = getRemoteExecutorTransportConfig();
  const checks = [];

  if (!isProductionRuntime()) {
    return [
      buildUnavailableCheck(
        "remote-executor-health",
        "Remote executor health",
        "Live remote executor verification is skipped outside production runtime.",
        "Deploy to 10.10.0.13 and rerun `verify remote-executor`.",
        {
          expectedHost: executor.executor_host,
          expectedModel: executor.executor_model,
          transport: transport.transport,
        }
      ),
    ];
  }

  checks.push(
    buildCheck({
      id: "remote-executor-config",
      name: "Remote executor config",
      status:
        normalizeString(executor.executor_host) &&
        normalizeString(executor.executor_model) &&
        normalizeString(transport.ollamaUrl)
          ? "passed"
          : "failed",
      summary:
        normalizeString(executor.executor_host) &&
        normalizeString(executor.executor_model) &&
        normalizeString(transport.ollamaUrl)
          ? "Reserved remote executor configuration is present."
          : "Reserved remote executor configuration is incomplete.",
      details: `Host: ${executor.executor_host || "-"} | Model: ${executor.executor_model || "-"} | URL: ${transport.ollamaUrl || "-"}`,
      recommendedNextStep:
        normalizeString(executor.executor_host) &&
        normalizeString(executor.executor_model) &&
        normalizeString(transport.ollamaUrl)
          ? "Continue with backend and model verification."
          : "Set the remote executor host/model/url configuration on 10.10.0.13.",
      category: "remote_executor",
      metadata: {
        executorHost: executor.executor_host,
        executorModel: executor.executor_model,
        executorTransport: transport.transport,
        executorUrl: transport.ollamaUrl,
      },
    })
  );

  if (
    !normalizeString(executor.executor_host) ||
    !normalizeString(executor.executor_model) ||
    !normalizeString(transport.ollamaUrl)
  ) {
    return checks;
  }

  let tagsPayload = null;
  try {
    const { response, payload, text } = await fetchJsonWithTimeout(`${transport.ollamaUrl}/api/tags`);
    if (!response.ok) {
      const failureCategory = response.status === 401 || response.status === 403 ? "auth_config" : "backend_unavailable";
      checks.push(
        buildCheck({
          id: "remote-executor-connectivity",
          name: "Remote executor backend",
          status: "failed",
          summary: `Remote executor backend returned HTTP ${response.status}.`,
          details: text || "No response body was returned by the backend.",
          recommendedNextStep:
            failureCategory === "auth_config"
              ? "Verify access controls or proxy configuration between 10.10.0.13 and 10.10.0.60."
              : "Verify Ollama service health on 10.10.0.60.",
          category: "remote_executor",
          metadata: { failureCategory, statusCode: response.status },
        })
      );
      return checks;
    }

    tagsPayload = payload;
    checks.push(
      buildCheck({
        id: "remote-executor-connectivity",
        name: "Remote executor backend",
        status: "passed",
        summary: "The app host can reach the reserved remote executor backend.",
        details: `Verified ${transport.ollamaUrl}/api/tags responded successfully.`,
        recommendedNextStep: "Verify that rnj-1:latest is available.",
        category: "remote_executor",
      })
    );
  } catch (error) {
    checks.push(
      buildCheck({
        id: "remote-executor-connectivity",
        name: "Remote executor backend",
        status: "failed",
        summary: "The app host could not reach the reserved remote executor backend.",
        details: normalizeString(error?.message) || "Unknown remote executor connectivity failure.",
        recommendedNextStep: "Verify network access from 10.10.0.13 to 10.10.0.60:11434.",
        category: "remote_executor",
        metadata: { failureCategory: classifyFetchFailure(error) },
      })
    );
    return checks;
  }

  const modelNames = Array.isArray(tagsPayload?.models)
    ? tagsPayload.models.map((model) => normalizeString(model?.name)).filter(Boolean)
    : [];
  const modelPresent = modelNames.includes(executor.executor_model);

  checks.push(
    buildCheck({
      id: "remote-executor-model",
      name: "Reserved model availability",
      status: modelPresent ? "passed" : "failed",
      summary: modelPresent
        ? `${executor.executor_model} is available on the remote executor backend.`
        : `${executor.executor_model} is missing on the remote executor backend.`,
      details: modelNames.length
        ? `Available models: ${modelNames.slice(0, 12).join(", ")}`
        : "The backend responded, but no model list was returned.",
      recommendedNextStep: modelPresent
        ? "Run the safe probe generation check."
        : `Load ${executor.executor_model} on 10.10.0.60 and rerun verification.`,
      category: "remote_executor",
      metadata: {
        failureCategory: modelPresent ? null : "model_missing",
      },
    })
  );

  if (!modelPresent) {
    return checks;
  }

  try {
    const { response, payload, text } = await fetchJsonWithTimeout(
      `${transport.ollamaUrl}/api/generate`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: executor.executor_model,
          prompt: "Reply with READY and nothing else.",
          stream: false,
          options: {
            temperature: 0,
            num_predict: 8,
          },
        }),
      },
      12_000
    );

    if (!response.ok) {
      const failureCategory = response.status === 401 || response.status === 403 ? "auth_config" : "probe_failed";
      checks.push(
        buildCheck({
          id: "remote-executor-probe",
          name: "Remote executor safe probe",
          status: "failed",
          summary: `The remote executor probe returned HTTP ${response.status}.`,
          details: text || "No response body was returned by the generation probe.",
          recommendedNextStep: "Inspect Ollama health and model loading state on 10.10.0.60.",
          category: "remote_executor",
          metadata: { failureCategory, statusCode: response.status },
        })
      );
      return checks;
    }

    const responseText = normalizeString(payload?.response || text);
    const passed = responseText.toUpperCase().startsWith("READY");
    checks.push(
      buildCheck({
        id: "remote-executor-probe",
        name: "Remote executor safe probe",
        status: passed ? "passed" : "failed",
        summary: passed
          ? "The reserved model completed the safe probe successfully."
          : "The reserved model responded, but the probe output was unexpected.",
        details: responseText || "The probe returned an empty response.",
        recommendedNextStep: passed
          ? "Remote executor mode is ready for safe operator actions."
          : "Inspect model runtime health on 10.10.0.60 and rerun verification.",
        category: "remote_executor",
        metadata: { failureCategory: passed ? null : "probe_failed" },
      })
    );
  } catch (error) {
    checks.push(
      buildCheck({
        id: "remote-executor-probe",
        name: "Remote executor safe probe",
        status: "failed",
        summary: "The reserved model probe failed.",
        details: normalizeString(error?.message) || "Unknown model probe failure.",
        recommendedNextStep: "Verify Ollama model health and connectivity on 10.10.0.60.",
        category: "remote_executor",
        metadata: { failureCategory: classifyFetchFailure(error) },
      })
    );
  }

  const probeAction = getOperatorActionDefinition(REMOTE_WORKFLOW_PROBE_ACTION_ID);
  if (!probeAction) {
    checks.push(
      buildCheck({
        id: "remote-executor-workflow-probe",
        name: "Remote workflow probe",
        status: "failed",
        summary: "The safe remote workflow probe action is not registered.",
        details: `${REMOTE_WORKFLOW_PROBE_ACTION_ID} is missing from the action registry.`,
        recommendedNextStep: "Restore the currentAdmin.workflowResume registry entry before production verification.",
        category: "remote_executor",
        metadata: { failureCategory: "config", actionId: REMOTE_WORKFLOW_PROBE_ACTION_ID },
      })
    );
    return checks;
  }

  try {
    const runResult = await runOperatorActionCommand({
      action: probeAction,
      command: buildOperatorActionCommand(probeAction, {}),
      executionMode: "remote_executor",
      timeoutMs: Math.min(probeAction.execution?.defaultTimeoutMs || 300000, 300000),
    });
    const outputPreview = normalizeString(runResult.stdout || runResult.stderr)
      .split("\n")
      .slice(0, 6)
      .join("\n");

    checks.push(
      buildCheck({
        id: "remote-executor-workflow-probe",
        name: "Remote workflow probe",
        status: runResult.ok ? "passed" : "failed",
        summary: runResult.ok
          ? "A safe wrapped workflow command completed through remote executor mode."
          : "The safe wrapped workflow command failed in remote executor mode.",
        details: outputPreview || runResult.errorMessage || "No probe output was captured.",
        recommendedNextStep: runResult.ok
          ? "Remote executor mode is ready for the allowed safe workflow actions."
          : "Inspect the remote executor failure category and probe output before relying on remote workflow runs.",
        category: "remote_executor",
        metadata: {
          actionId: REMOTE_WORKFLOW_PROBE_ACTION_ID,
          failureCategory: runResult.ok ? null : runResult.failureKind || "remote_executor_runtime",
          transportReport: runResult.transportReport || null,
        },
      })
    );
  } catch (error) {
    checks.push(
      buildCheck({
        id: "remote-executor-workflow-probe",
        name: "Remote workflow probe",
        status: "failed",
        summary: "The safe wrapped workflow probe could not be completed.",
        details: normalizeString(error?.message) || "Unknown remote workflow probe failure.",
        recommendedNextStep: "Inspect remote executor runtime configuration on 10.10.0.13 and rerun verification.",
        category: "remote_executor",
        metadata: {
          actionId: REMOTE_WORKFLOW_PROBE_ACTION_ID,
          failureCategory: "remote_executor_runtime",
        },
      })
    );
  }

  return checks;
}

export async function verifyRemoteExecutorHealth() {
  return buildReport({
    scope: "remote-executor",
    title: "Remote executor verification",
    checks: await verifyRemoteExecutorHealthChecks(),
  });
}

export async function verifyControlPlaneReadiness() {
  return buildReport({
    scope: "control-plane",
    title: "Operator control-plane verification",
    checks: [
      await verifyDbConnectivityCheck(),
      await verifyOperatorSchemaCheck(),
      ...verifyBrokerReadinessChecks(),
      verifyScheduleSubsystemCheck(),
    ],
  });
}

async function verifyDataIntegritySchemaCheck(db) {
  if (!isOperatorDbConfigured()) {
    return buildUnavailableCheck(
      "data-integrity-schema",
      "Canonical data schema",
      "Data-integrity verification cannot run because DB config is missing.",
      "Configure DB_HOST, DB_USER, and DB_NAME, then rerun `verify data-integrity`.",
      { reason: "missing_db_config" }
    );
  }

  try {
    const foundTables = await listPresentTables(db, DATA_INTEGRITY_TABLES);
    const missingTables = DATA_INTEGRITY_TABLES.filter((tableName) => !foundTables.has(tableName));

    if (missingTables.length) {
      return buildCheck({
        id: "data-integrity-schema",
        name: "Canonical data schema",
        status: "failed",
        summary: `${missingTables.length} canonical data table(s) are missing.`,
        details: `Missing tables: ${missingTables.join(", ")}`,
        recommendedNextStep:
          "Restore the canonical promise-tracker / legislative tables before relying on public or operator views.",
        category: "data_integrity",
        metadata: { missingTables, failureCategory: "schema_missing" },
      });
    }

    return buildCheck({
      id: "data-integrity-schema",
      name: "Canonical data schema",
      status: "passed",
      summary: "Canonical promise, source, and legislative data tables are present.",
      details: `Verified tables: ${DATA_INTEGRITY_TABLES.join(", ")}`,
      recommendedNextStep: "Continue with required-field, orphan, and duplicate checks.",
      category: "data_integrity",
    });
  } catch (error) {
    return buildCheck({
      id: "data-integrity-schema",
      name: "Canonical data schema",
      status: "failed",
      summary: "Canonical data schema verification failed.",
      details: normalizeString(error?.message) || "Unknown schema verification failure.",
      recommendedNextStep: "Verify DB connectivity and table privileges, then rerun `verify data-integrity`.",
      category: "data_integrity",
      metadata: { failureCategory: "query_failed" },
    });
  }
}

async function verifyPromiseRequiredFieldsCheck(db) {
  const whereClause = `
    TRIM(COALESCE(slug, '')) = ''
    OR TRIM(COALESCE(title, '')) = ''
    OR promise_date IS NULL
  `;
  const { total, sampleRows } = await queryIntegrityCountAndSamples({
    db,
    countSql: `SELECT COUNT(*) AS total FROM promises WHERE ${whereClause}`,
    sampleSql: `
      SELECT id, slug, title, promise_date
      FROM promises
      WHERE ${whereClause}
      ORDER BY id ASC
      LIMIT 5
    `,
  });

  return buildCheck({
    id: "promise-required-fields",
    name: "Promise required fields",
    status: total > 0 ? "failed" : "passed",
    summary:
      total > 0
        ? `${total} promise record(s) are missing a slug, title, or promise date.`
        : "All promise records include slug, title, and promise date.",
    details:
      total > 0
        ? `Sample rows: ${formatSampleRows(
            sampleRows,
            (row) =>
              `#${row.id} slug=${normalizeString(row.slug) || "<missing>"} title=${
                normalizeString(row.title) || "<missing>"
              } promise_date=${normalizeString(row.promise_date) || "<missing>"}`
          )}`
        : "Promise detail and list pages can rely on the required identity fields.",
    recommendedNextStep:
      total > 0
        ? "Repair the affected promise rows before treating them as canonical public records."
        : "Continue with outcome and relationship integrity checks.",
    category: "data_integrity",
    metadata: { affectedCount: total },
  });
}

async function verifyPromiseOutcomeRequiredFieldsCheck(db) {
  const whereClause = `
    TRIM(COALESCE(po.outcome_summary, '')) = ''
    OR TRIM(COALESCE(po.impact_direction, '')) = ''
    OR TRIM(COALESCE(po.black_community_impact_note, '')) = ''
  `;
  const { total, sampleRows } = await queryIntegrityCountAndSamples({
    db,
    countSql: `
      SELECT COUNT(*) AS total
      FROM promise_outcomes po
      WHERE ${whereClause}
    `,
    sampleSql: `
      SELECT po.id, po.promise_id, p.slug, po.outcome_summary, po.impact_direction, po.black_community_impact_note
      FROM promise_outcomes po
      LEFT JOIN promises p ON p.id = po.promise_id
      WHERE ${whereClause}
      ORDER BY po.id ASC
      LIMIT 5
    `,
  });

  return buildCheck({
    id: "promise-outcome-required-fields",
    name: "Promise outcome required fields",
    status: total > 0 ? "failed" : "passed",
    summary:
      total > 0
        ? `${total} outcome record(s) are missing outcome text, impact direction, or Black-impact notes.`
        : "All promise outcomes include summary, impact direction, and Black-impact notes.",
    details:
      total > 0
        ? `Sample rows: ${formatSampleRows(
            sampleRows,
            (row) =>
              `#${row.id} promise=${normalizeString(row.slug) || row.promise_id} summary=${
                normalizeString(row.outcome_summary) || "<missing>"
              } direction=${normalizeString(row.impact_direction) || "<missing>"} black_impact_note=${
                normalizeString(row.black_community_impact_note) || "<missing>"
              }`
          )}`
        : "Outcome cards can be traced to explicit Black-impact framing and direction fields.",
    recommendedNextStep:
      total > 0
        ? "Backfill the missing outcome fields before presenting those rows as evidence-backed impact records."
        : "Continue with source-attribution checks.",
    category: "data_integrity",
    metadata: { affectedCount: total },
  });
}

async function verifySourceAttributionCoverageCheck(db) {
  const [actionCountRows] = await db.query(`
    SELECT COUNT(*) AS total
    FROM promise_actions pa
    WHERE NOT EXISTS (
      SELECT 1
      FROM promise_action_sources pas
      WHERE pas.promise_action_id = pa.id
    )
  `);
  const [outcomeCountRows] = await db.query(`
    SELECT COUNT(*) AS total
    FROM promise_outcomes po
    WHERE NOT EXISTS (
      SELECT 1
      FROM promise_outcome_sources pos
      WHERE pos.promise_outcome_id = po.id
    )
  `);
  const missingActionSources = Number(actionCountRows?.[0]?.total || 0);
  const missingOutcomeSources = Number(outcomeCountRows?.[0]?.total || 0);
  const [actionSamples] = await db.query(
    `
      SELECT pa.id, p.slug, pa.title
      FROM promise_actions pa
      JOIN promises p ON p.id = pa.promise_id
      WHERE NOT EXISTS (
        SELECT 1
        FROM promise_action_sources pas
        WHERE pas.promise_action_id = pa.id
      )
      ORDER BY pa.id ASC
      LIMIT 3
    `
  );
  const [outcomeSamples] = await db.query(
    `
      SELECT po.id, p.slug, po.outcome_summary
      FROM promise_outcomes po
      JOIN promises p ON p.id = po.promise_id
      WHERE NOT EXISTS (
        SELECT 1
        FROM promise_outcome_sources pos
        WHERE pos.promise_outcome_id = po.id
      )
      ORDER BY po.id ASC
      LIMIT 3
    `
  );
  const affectedCount = missingActionSources + missingOutcomeSources;

  return buildCheck({
    id: "source-attribution-coverage",
    name: "Source attribution coverage",
    status: affectedCount > 0 ? "warning" : "passed",
    summary:
      affectedCount > 0
        ? `${missingActionSources} action(s) and ${missingOutcomeSources} outcome(s) are missing linked sources.`
        : "Promise actions and outcomes have linked source attribution.",
    details:
      affectedCount > 0
        ? [
            actionSamples?.length
              ? `Actions: ${formatSampleRows(actionSamples, (row) => `#${row.id} ${row.slug}: ${normalizeString(row.title) || "<missing title>"}`)}`
              : "",
            outcomeSamples?.length
              ? `Outcomes: ${formatSampleRows(outcomeSamples, (row) => `#${row.id} ${row.slug}: ${normalizeString(row.outcome_summary) || "<missing summary>"}`)}`
              : "",
          ]
            .filter(Boolean)
            .join(" | ")
        : "Public promise detail pages should have source traceability for actions and outcomes.",
    recommendedNextStep:
      affectedCount > 0
        ? "Backfill source joins for the sampled records before relying on them as fully traceable evidence."
        : "Continue with orphan and duplicate checks.",
    category: "data_integrity",
    metadata: {
      missingActionSources,
      missingOutcomeSources,
      affectedCount,
    },
  });
}

async function verifyPromiseRelationshipOrphansCheck(db) {
  const { total, sampleRows } = await queryIntegrityCountAndSamples({
    db,
    countSql: `
      SELECT COUNT(*) AS total
      FROM promise_relationships pr
      LEFT JOIN promises p_from ON p_from.id = pr.from_promise_id
      LEFT JOIN promises p_to ON p_to.id = pr.to_promise_id
      WHERE p_from.id IS NULL OR p_to.id IS NULL
    `,
    sampleSql: `
      SELECT pr.id, pr.relationship_type, pr.from_promise_id, pr.to_promise_id
      FROM promise_relationships pr
      LEFT JOIN promises p_from ON p_from.id = pr.from_promise_id
      LEFT JOIN promises p_to ON p_to.id = pr.to_promise_id
      WHERE p_from.id IS NULL OR p_to.id IS NULL
      ORDER BY pr.id ASC
      LIMIT 5
    `,
  });

  return buildCheck({
    id: "promise-relationship-orphans",
    name: "Promise relationship orphans",
    status: total > 0 ? "failed" : "passed",
    summary:
      total > 0
        ? `${total} promise relationship row(s) reference missing promises.`
        : "All promise relationship rows resolve to existing promises.",
    details:
      total > 0
        ? `Sample rows: ${formatSampleRows(
            sampleRows,
            (row) =>
              `#${row.id} type=${normalizeString(row.relationship_type) || "<missing>"} from=${row.from_promise_id} to=${row.to_promise_id}`
          )}`
        : "Promise chain views can resolve all related promise links.",
    recommendedNextStep:
      total > 0
        ? "Repair or remove orphaned relationship rows after reviewing the missing canonical promise ids."
        : "Continue with duplicate-relationship checks.",
    category: "data_integrity",
    metadata: { affectedCount: total },
  });
}

async function verifyPromiseRelationshipDuplicatesCheck(db) {
  const { total, sampleRows } = await queryIntegrityCountAndSamples({
    db,
    countSql: `
      SELECT COUNT(*) AS total
      FROM (
        SELECT from_promise_id, to_promise_id, relationship_type
        FROM promise_relationships
        GROUP BY from_promise_id, to_promise_id, relationship_type
        HAVING COUNT(*) > 1
      ) duplicate_groups
    `,
    sampleSql: `
      SELECT from_promise_id, to_promise_id, relationship_type, COUNT(*) AS duplicate_count
      FROM promise_relationships
      GROUP BY from_promise_id, to_promise_id, relationship_type
      HAVING COUNT(*) > 1
      ORDER BY duplicate_count DESC, from_promise_id ASC, to_promise_id ASC
      LIMIT 5
    `,
  });

  return buildCheck({
    id: "promise-relationship-duplicates",
    name: "Promise relationship duplicates",
    status: total > 0 ? "warning" : "passed",
    summary:
      total > 0
        ? `${total} duplicate promise relationship group(s) exist.`
        : "Promise relationship rows are unique by source, target, and relationship type.",
    details:
      total > 0
        ? `Sample groups: ${formatSampleRows(
            sampleRows,
            (row) =>
              `${row.relationship_type || "<missing type>"} ${row.from_promise_id}->${row.to_promise_id} (${row.duplicate_count} rows)`
          )}`
        : "Relationship views should not show duplicated canonical links.",
    recommendedNextStep:
      total > 0
        ? "Review duplicate relationship groups and keep only the canonical row per relationship type."
        : "Continue with source-join orphan checks.",
    category: "data_integrity",
    metadata: { affectedCount: total },
  });
}

async function verifySourceJoinOrphansCheck(db) {
  const [actionRows] = await db.query(`
    SELECT COUNT(*) AS total
    FROM promise_action_sources pas
    LEFT JOIN promise_actions pa ON pa.id = pas.promise_action_id
    LEFT JOIN sources s ON s.id = pas.source_id
    WHERE pa.id IS NULL OR s.id IS NULL
  `);
  const [outcomeRows] = await db.query(`
    SELECT COUNT(*) AS total
    FROM promise_outcome_sources pos
    LEFT JOIN promise_outcomes po ON po.id = pos.promise_outcome_id
    LEFT JOIN sources s ON s.id = pos.source_id
    WHERE po.id IS NULL OR s.id IS NULL
  `);
  const actionOrphans = Number(actionRows?.[0]?.total || 0);
  const outcomeOrphans = Number(outcomeRows?.[0]?.total || 0);
  const [actionSamples] = await db.query(
    `
      SELECT pas.promise_action_id, pas.source_id
      FROM promise_action_sources pas
      LEFT JOIN promise_actions pa ON pa.id = pas.promise_action_id
      LEFT JOIN sources s ON s.id = pas.source_id
      WHERE pa.id IS NULL OR s.id IS NULL
      ORDER BY pas.promise_action_id ASC, pas.source_id ASC
      LIMIT 3
    `
  );
  const [outcomeSamples] = await db.query(
    `
      SELECT pos.promise_outcome_id, pos.source_id
      FROM promise_outcome_sources pos
      LEFT JOIN promise_outcomes po ON po.id = pos.promise_outcome_id
      LEFT JOIN sources s ON s.id = pos.source_id
      WHERE po.id IS NULL OR s.id IS NULL
      ORDER BY pos.promise_outcome_id ASC, pos.source_id ASC
      LIMIT 3
    `
  );
  const affectedCount = actionOrphans + outcomeOrphans;

  return buildCheck({
    id: "source-join-orphans",
    name: "Source join-table orphans",
    status: affectedCount > 0 ? "failed" : "passed",
    summary:
      affectedCount > 0
        ? `${actionOrphans} action-source row(s) and ${outcomeOrphans} outcome-source row(s) are orphaned.`
        : "Action and outcome source joins resolve to existing records.",
    details:
      affectedCount > 0
        ? [
            actionSamples?.length
              ? `Action joins: ${formatSampleRows(actionSamples, (row) => `action=${row.promise_action_id} source=${row.source_id}`)}`
              : "",
            outcomeSamples?.length
              ? `Outcome joins: ${formatSampleRows(outcomeSamples, (row) => `outcome=${row.promise_outcome_id} source=${row.source_id}`)}`
              : "",
          ]
            .filter(Boolean)
            .join(" | ")
        : "Source traceability joins are structurally intact.",
    recommendedNextStep:
      affectedCount > 0
        ? "Repair or remove orphaned source join rows before relying on source-backed evidence counts."
        : "Continue with future-bill link checks.",
    category: "data_integrity",
    metadata: { actionOrphans, outcomeOrphans, affectedCount },
  });
}

async function verifyFutureBillLinkOrphansCheck(db) {
  const { total, sampleRows } = await queryIntegrityCountAndSamples({
    db,
    countSql: `
      SELECT COUNT(*) AS total
      FROM future_bill_links fbl
      LEFT JOIN future_bills fb ON fb.id = fbl.future_bill_id
      LEFT JOIN tracked_bills tb ON tb.id = fbl.tracked_bill_id
      WHERE fb.id IS NULL OR tb.id IS NULL
    `,
    sampleSql: `
      SELECT fbl.id, fbl.link_type, fbl.future_bill_id, fbl.tracked_bill_id
      FROM future_bill_links fbl
      LEFT JOIN future_bills fb ON fb.id = fbl.future_bill_id
      LEFT JOIN tracked_bills tb ON tb.id = fbl.tracked_bill_id
      WHERE fb.id IS NULL OR tb.id IS NULL
      ORDER BY fbl.id ASC
      LIMIT 5
    `,
  });

  return buildCheck({
    id: "future-bill-link-orphans",
    name: "Future-bill link orphans",
    status: total > 0 ? "failed" : "passed",
    summary:
      total > 0
        ? `${total} future-bill link row(s) reference missing future bills or tracked bills.`
        : "All future-bill link rows resolve to existing future bills and tracked bills.",
    details:
      total > 0
        ? `Sample rows: ${formatSampleRows(
            sampleRows,
            (row) =>
              `#${row.id} type=${normalizeString(row.link_type) || "<missing>"} future_bill=${row.future_bill_id} tracked_bill=${row.tracked_bill_id}`
          )}`
        : "Legislative explainers and relationship views can resolve canonical bill links.",
    recommendedNextStep:
      total > 0
        ? "Repair the affected future-bill links before treating them as canonical legislative relationships."
        : "Continue with duplicate future-bill link checks.",
    category: "data_integrity",
    metadata: { affectedCount: total },
  });
}

async function verifyFutureBillLinkDuplicatesCheck(db) {
  const { total, sampleRows } = await queryIntegrityCountAndSamples({
    db,
    countSql: `
      SELECT COUNT(*) AS total
      FROM (
        SELECT future_bill_id, tracked_bill_id, link_type
        FROM future_bill_links
        GROUP BY future_bill_id, tracked_bill_id, link_type
        HAVING COUNT(*) > 1
      ) duplicate_groups
    `,
    sampleSql: `
      SELECT future_bill_id, tracked_bill_id, link_type, COUNT(*) AS duplicate_count
      FROM future_bill_links
      GROUP BY future_bill_id, tracked_bill_id, link_type
      HAVING COUNT(*) > 1
      ORDER BY duplicate_count DESC, future_bill_id ASC, tracked_bill_id ASC
      LIMIT 5
    `,
  });

  return buildCheck({
    id: "future-bill-link-duplicates",
    name: "Future-bill link duplicates",
    status: total > 0 ? "warning" : "passed",
    summary:
      total > 0
        ? `${total} duplicate future-bill link group(s) exist.`
        : "Future-bill links are unique by future bill, tracked bill, and link type.",
    details:
      total > 0
        ? `Sample groups: ${formatSampleRows(
            sampleRows,
            (row) =>
              `${row.link_type || "<missing type>"} future=${row.future_bill_id} tracked=${row.tracked_bill_id} (${row.duplicate_count} rows)`
          )}`
        : "Legislative workflow imports should not duplicate canonical bill-link relationships.",
    recommendedNextStep:
      total > 0
        ? "Review duplicate future-bill link groups and keep only the canonical row per link type."
        : "Continue with source-url duplicate checks.",
    category: "data_integrity",
    metadata: { affectedCount: total },
  });
}

async function verifySourceUrlDuplicatesCheck(db) {
  const { total, sampleRows } = await queryIntegrityCountAndSamples({
    db,
    countSql: `
      SELECT COUNT(*) AS total
      FROM (
        SELECT source_url
        FROM sources
        WHERE TRIM(COALESCE(source_url, '')) <> ''
        GROUP BY source_url
        HAVING COUNT(*) > 1
      ) duplicate_sources
    `,
    sampleSql: `
      SELECT source_url, COUNT(*) AS duplicate_count
      FROM sources
      WHERE TRIM(COALESCE(source_url, '')) <> ''
      GROUP BY source_url
      HAVING COUNT(*) > 1
      ORDER BY duplicate_count DESC, source_url ASC
      LIMIT 5
    `,
  });

  return buildCheck({
    id: "source-url-duplicates",
    name: "Source URL duplicates",
    status: total > 0 ? "warning" : "passed",
    summary:
      total > 0
        ? `${total} source URL group(s) are duplicated.`
        : "Source URLs are unique across the canonical source table.",
    details:
      total > 0
        ? `Sample URLs: ${formatSampleRows(
            sampleRows,
            (row) => `${normalizeString(row.source_url) || "<missing url>"} (${row.duplicate_count} rows)`
          )}`
        : "Source attribution can resolve to one canonical source row per URL.",
    recommendedNextStep:
      total > 0
        ? "Review duplicate source URLs and merge only where the records are truly redundant."
        : "Canonical sources, relationships, and workflow-linked records passed the read-only duplicate checks.",
    category: "data_integrity",
    metadata: { affectedCount: total },
  });
}

async function verifySourceAttributionClassificationCheck(db) {
  const [actionRows] = await db.query(`
    SELECT
      COUNT(*) AS total_missing_actions,
      SUM(
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM promise_sources ps
            WHERE ps.promise_id = p.id
          )
          OR EXISTS (
            SELECT 1
            FROM promise_outcomes po
            JOIN promise_outcome_sources pos ON pos.promise_outcome_id = po.id
            WHERE po.promise_id = p.id
          )
          OR EXISTS (
            SELECT 1
            FROM promise_actions pa2
            JOIN promise_action_sources pas2 ON pas2.promise_action_id = pa2.id
            WHERE pa2.promise_id = p.id
              AND pa2.id <> pa.id
          )
          THEN 1
          ELSE 0
        END
      ) AS same_promise_source_context
    FROM promise_actions pa
    JOIN promises p ON p.id = pa.promise_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM promise_action_sources pas
      WHERE pas.promise_action_id = pa.id
    )
  `);
  const [outcomeRows] = await db.query(`
    SELECT
      COUNT(*) AS total_missing_outcomes,
      SUM(
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM promise_sources ps
            WHERE ps.promise_id = p.id
          )
          OR EXISTS (
            SELECT 1
            FROM promise_actions pa
            JOIN promise_action_sources pas ON pas.promise_action_id = pa.id
            WHERE pa.promise_id = p.id
          )
          OR EXISTS (
            SELECT 1
            FROM promise_outcomes po2
            JOIN promise_outcome_sources pos2 ON pos2.promise_outcome_id = po2.id
            WHERE po2.promise_id = p.id
              AND po2.id <> po.id
          )
          THEN 1
          ELSE 0
        END
      ) AS same_promise_source_context
    FROM promise_outcomes po
    JOIN promises p ON p.id = po.promise_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM promise_outcome_sources pos
      WHERE pos.promise_outcome_id = po.id
    )
  `);
  const totalMissingActions = Number(actionRows?.[0]?.total_missing_actions || 0);
  const actionContextCount = Number(actionRows?.[0]?.same_promise_source_context || 0);
  const totalMissingOutcomes = Number(outcomeRows?.[0]?.total_missing_outcomes || 0);
  const outcomeContextCount = Number(outcomeRows?.[0]?.same_promise_source_context || 0);
  const clearlyMissingActions = Math.max(totalMissingActions - actionContextCount, 0);
  const clearlyMissingOutcomes = Math.max(totalMissingOutcomes - outcomeContextCount, 0);

  return buildCheck({
    id: "source-attribution-classification",
    name: "Source attribution classification",
    status:
      totalMissingActions + totalMissingOutcomes > 0
        ? actionContextCount + outcomeContextCount > 0
          ? "warning"
          : "failed"
        : "passed",
    summary:
      totalMissingActions + totalMissingOutcomes > 0
        ? `${clearlyMissingActions} action(s) and ${clearlyMissingOutcomes} outcome(s) appear to be true missing attribution. ${actionContextCount + outcomeContextCount} row(s) have same-promise source context but still need explicit source review.`
        : "Missing-source rows were not detected in the canonical promise tracker tables.",
    details:
      totalMissingActions + totalMissingOutcomes > 0
        ? `Action rows with same-promise source context: ${actionContextCount}. Outcome rows with same-promise source context: ${outcomeContextCount}.`
        : "Current promise, action, and outcome rows all have direct source attribution.",
    recommendedNextStep:
      totalMissingActions + totalMissingOutcomes > 0
        ? "Repair only rows with explicit source manifests or exact join evidence; leave ambiguous records for manual review."
        : "Continue with duplicate-source and provenance checks.",
    category: "data_integrity",
    metadata: {
      totalMissingActions,
      totalMissingOutcomes,
      clearlyMissingActions,
      clearlyMissingOutcomes,
      actionContextCount,
      outcomeContextCount,
    },
  });
}

async function verifySourceDuplicateClassificationCheck(db) {
  const [summaryRows] = await db.query(`
    SELECT
      COUNT(*) AS duplicate_groups,
      SUM(
        CASE
          WHEN duplicate_count > 1
            AND distinct_titles = 1
            AND distinct_types = 1
            AND distinct_publishers = 1
            AND distinct_published_dates <= 1
            AND distinct_nonnull_policy_ids <= 1
          THEN 1
          ELSE 0
        END
      ) AS safe_exact_groups
    FROM (
      SELECT
        source_url,
        COUNT(*) AS duplicate_count,
        COUNT(DISTINCT source_title) AS distinct_titles,
        COUNT(DISTINCT source_type) AS distinct_types,
        COUNT(DISTINCT publisher) AS distinct_publishers,
        COUNT(DISTINCT published_date) AS distinct_published_dates,
        COUNT(DISTINCT policy_id) AS distinct_nonnull_policy_ids
      FROM sources
      WHERE source_url IS NOT NULL
        AND LENGTH(TRIM(source_url)) > 0
      GROUP BY source_url
      HAVING COUNT(*) > 1
    ) duplicate_groups
  `);
  const duplicateGroups = Number(summaryRows?.[0]?.duplicate_groups || 0);
  const safeExactGroups = Number(summaryRows?.[0]?.safe_exact_groups || 0);
  const manualGroups = Math.max(duplicateGroups - safeExactGroups, 0);
  const [sampleRows] = await db.query(`
    SELECT
      source_url,
      duplicate_count,
      distinct_titles,
      distinct_types,
      distinct_publishers,
      distinct_published_dates,
      distinct_nonnull_policy_ids
    FROM (
      SELECT
        source_url,
        COUNT(*) AS duplicate_count,
        COUNT(DISTINCT source_title) AS distinct_titles,
        COUNT(DISTINCT source_type) AS distinct_types,
        COUNT(DISTINCT publisher) AS distinct_publishers,
        COUNT(DISTINCT published_date) AS distinct_published_dates,
        COUNT(DISTINCT policy_id) AS distinct_nonnull_policy_ids
      FROM sources
      WHERE source_url IS NOT NULL
        AND LENGTH(TRIM(source_url)) > 0
      GROUP BY source_url
      HAVING COUNT(*) > 1
    ) duplicate_groups
    ORDER BY duplicate_count DESC, source_url ASC
    LIMIT 5
  `);

  return buildCheck({
    id: "source-duplicate-classification",
    name: "Duplicate source classification",
    status: duplicateGroups > 0 ? "warning" : "passed",
    summary:
      duplicateGroups > 0
        ? `${safeExactGroups} duplicate source URL cluster(s) look like safe exact-merge candidates. ${manualGroups} cluster(s) still need manual review.`
        : "Duplicate source URL clusters were not detected.",
    details:
      duplicateGroups > 0
        ? `Sample clusters: ${formatSampleRows(
            sampleRows,
            (row) =>
              `${normalizeString(row.source_url)} (${row.duplicate_count} rows; titles=${row.distinct_titles}, types=${row.distinct_types}, publishers=${row.distinct_publishers}, dates=${row.distinct_published_dates}, policyIds=${row.distinct_nonnull_policy_ids})`
          )}`
        : "The source table is not carrying duplicate URL clusters right now.",
    recommendedNextStep:
      duplicateGroups > 0
        ? "Only canonicalize clusters where title, type, publisher, published date, and non-null policy ownership all match safely; leave the rest for manual review."
        : "Continue with provenance completeness checks.",
    category: "data_integrity",
    metadata: {
      duplicateGroups,
      safeExactGroups,
      manualGroups,
    },
  });
}

async function verifyCurrentAdminProvenanceCheck() {
  const workspace = await getCurrentAdministrationOperatorWorkspace().catch(() => null);
  const provenance = workspace?.provenance || null;
  if (!workspace?.batch?.batch_name) {
    return buildCheck({
      id: "current-admin-provenance",
      name: "Current-admin provenance completeness",
      status: "passed",
      summary: "No active current-admin batch is present, so no provenance gap is active right now.",
      details: "This check becomes meaningful when a canonical batch file or current-admin artifact chain exists.",
      recommendedNextStep: "Run the next current-admin batch before relying on this provenance check.",
      category: "data_integrity",
    });
  }

  if (!provenance) {
    return buildCheck({
      id: "current-admin-provenance",
      name: "Current-admin provenance completeness",
      status: "warning",
      summary: "The current-admin provenance status could not be derived.",
      details: "The workspace did not return batch-to-DB lineage metadata for the active current-admin batch.",
      recommendedNextStep: "Inspect the current-admin workspace and rerun `verify deep-integrity`.",
      category: "data_integrity",
    });
  }

  return buildCheck({
    id: "current-admin-provenance",
    name: "Current-admin provenance completeness",
    status: provenance.provenance_incomplete ? "warning" : "passed",
    summary: provenance.summary,
    details: provenance.provenance_incomplete
      ? `Missing artifacts: ${(provenance.missing_artifacts || []).join(", ") || "unknown"}. Matched DB rows: ${provenance.matched_record_count || 0}.`
      : `Batch rows detected in DB: ${provenance.matched_record_count || 0}. Artifact chain missing: ${provenance.artifact_chain_missing ? "yes" : "no"}.`,
    recommendedNextStep: provenance.provenance_incomplete
      ? "Do not reconstruct missing history. Restore retained artifacts if available and block future imports unless the artifact chain exists."
      : "Current-admin provenance is structurally present for the active batch.",
    category: "data_integrity",
    metadata: provenance,
  });
}

export async function verifyDataIntegrity() {
  if (!isOperatorDbConfigured()) {
    return buildReport({
      scope: "data-integrity",
      title: "Canonical data integrity verification",
      checks: [
        buildUnavailableCheck(
          "data-integrity-schema",
          "Canonical data schema",
          "Data-integrity verification cannot run because DB config is missing.",
          "Configure DB_HOST, DB_USER, and DB_NAME, then rerun `verify data-integrity`.",
          { reason: "missing_db_config" }
        ),
      ],
    });
  }

  const db = getDb();
  const schemaCheck = await verifyDataIntegritySchemaCheck(db);
  if (schemaCheck.status !== "passed") {
    return buildReport({
      scope: "data-integrity",
      title: "Canonical data integrity verification",
      checks: [schemaCheck],
    });
  }

  return buildReport({
    scope: "data-integrity",
    title: "Canonical data integrity verification",
    checks: [
      schemaCheck,
      await verifyPromiseRequiredFieldsCheck(db),
      await verifyPromiseOutcomeRequiredFieldsCheck(db),
      await verifySourceAttributionCoverageCheck(db),
      await verifyPromiseRelationshipOrphansCheck(db),
      await verifyPromiseRelationshipDuplicatesCheck(db),
      await verifySourceJoinOrphansCheck(db),
      await verifyFutureBillLinkOrphansCheck(db),
      await verifyFutureBillLinkDuplicatesCheck(db),
      await verifySourceUrlDuplicatesCheck(db),
    ],
  });
}

export async function verifyDeepIntegrity() {
  const baseReport = await verifyDataIntegrity();
  if (baseReport.checks?.[0]?.status !== "passed") {
    return buildReport({
      scope: "deep-integrity",
      title: "Deep trust and provenance verification",
      checks: [...(baseReport.checks || []), await verifyCurrentAdminProvenanceCheck()],
    });
  }

  const db = getDb();
  return buildReport({
    scope: "deep-integrity",
    title: "Deep trust and provenance verification",
    checks: [
      ...baseReport.checks,
      await verifySourceAttributionClassificationCheck(db),
      await verifySourceDuplicateClassificationCheck(db),
      await verifyCurrentAdminProvenanceCheck(),
    ],
  });
}

export async function verifyEnvironmentReadiness() {
  const remoteReport = await verifyRemoteExecutorHealth();
  const controlPlaneReport = await verifyControlPlaneReadiness();
  return buildReport({
    scope: "environment",
    title: "Production environment verification",
    checks: [...controlPlaneReport.checks, ...remoteReport.checks],
  });
}

export async function getOperatorVerificationReport(scope = "environment") {
  const normalizedScope = normalizeString(scope) || "environment";
  if (normalizedScope === "data-integrity") {
    return verifyDataIntegrity();
  }
  if (normalizedScope === "deep-integrity") {
    return verifyDeepIntegrity();
  }
  if (normalizedScope === "remote-executor") {
    return verifyRemoteExecutorHealth();
  }
  if (normalizedScope === "control-plane") {
    return verifyControlPlaneReadiness();
  }
  return verifyEnvironmentReadiness();
}

export function getOperatorVerificationBanner() {
  const transport = getRemoteExecutorTransportConfig();
  const executor = getExecutorMetadata();

  if (!isProductionRuntime()) {
    return {
      status: "unavailable",
      title: "Production verification is unavailable in this environment",
      summary:
        "Live DB and remote-executor checks are intentionally skipped outside the production runtime.",
      recommendedNextStep:
        "Deploy to 10.10.0.13 and run `verify environment` from the command console or open /admin/tools.",
      href: "/admin/tools",
      metadata: {
        expectedAppHost: "10.10.0.13",
        expectedExecutorHost: executor.executor_host,
        expectedExecutorModel: executor.executor_model,
        executorTransport: transport.transport,
      },
    };
  }

  if (!isOperatorDbConfigured()) {
    return {
      status: "failed",
      title: "Operator DB configuration is incomplete",
      summary: "DB env vars are missing, so production verification will not pass.",
      recommendedNextStep: "Set DB_HOST, DB_USER, and DB_NAME on 10.10.0.13, then rerun `verify environment`.",
      href: "/admin/tools",
      metadata: {
        missingDbConfig: true,
      },
    };
  }

  return {
    status: "warning",
    title: "Run production verification on this deployment",
    summary:
      "Remote executor and control-plane verification are available. Run them explicitly after deploy.",
    recommendedNextStep: "Use /admin/tools or `verify environment` to confirm 10.10.0.13 -> 10.10.0.60 readiness.",
    href: "/admin/tools",
    metadata: {
      executorHost: executor.executor_host,
      executorModel: executor.executor_model,
      executorTransport: transport.transport,
    },
  };
}

export function getRemoteSafeActionIds() {
  return [...SAFE_REMOTE_ACTION_IDS];
}
