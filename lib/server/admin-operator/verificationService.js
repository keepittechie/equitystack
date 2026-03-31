import { getDb } from "@/lib/db";
import {
  buildOperatorActionCommand,
  getOperatorActionDefinition,
  listSerializedOperatorActions,
} from "./actionRegistry.js";
import { runOperatorActionCommand } from "./actionRunner.js";
import { listSchedulableActions } from "./schedulerService.js";
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
