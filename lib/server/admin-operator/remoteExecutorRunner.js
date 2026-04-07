import { runCliAction } from "./cliActionRunner.js";
import {
  getRemoteExecutorTransportConfig,
  normalizeString,
} from "./shared.js";

function buildRemoteExecutorEnvOverrides(runtimeMetadata) {
  const transport = getRemoteExecutorTransportConfig();
  const model =
    normalizeString(runtimeMetadata?.executor_model) ||
    normalizeString(process.env.MCP_MODEL) ||
    normalizeString(process.env.EQUITYSTACK_EXECUTOR_MODEL) ||
    normalizeString(process.env.EQUITYSTACK_LLM_MODEL);
  const llmEndpoint =
    normalizeString(runtimeMetadata?.executor_transport_url) ||
    normalizeString(transport.llmEndpoint) ||
    normalizeString(transport.ollamaUrl) ||
    "";

  return {
    EQUITYSTACK_LLM_ENDPOINT: llmEndpoint,
    EQUITYSTACK_OLLAMA_URL: llmEndpoint,
    EQUITYSTACK_MODEL_EXECUTOR: model,
    EQUITYSTACK_MODEL_REVIEW: model,
    EQUITYSTACK_MODEL_VERIFIER: model,
    EQUITYSTACK_MODEL_FALLBACK: model,
    EQUITYSTACK_MODEL_CHEAP: model,
    EQUITYSTACK_REMOTE_EXECUTOR_ACTIVE: "1",
  };
}

function classifyRemoteExecutorFailure(result) {
  if (result?.timedOut) {
    return "remote_executor_timeout";
  }

  const message = `${normalizeString(result?.stderr)}\n${normalizeString(
    result?.stdout
  )}\n${normalizeString(result?.errorMessage)}`.toLowerCase();
  const looksLikeDatabasePrerequisiteIssue = [
    "pymysql",
    "mariadb",
    "mysql",
    "db_host",
    "access denied for user",
    "can't connect to mysql server",
    "lost connection to mysql server",
  ].some((pattern) => message.includes(pattern));

  if (looksLikeDatabasePrerequisiteIssue) {
    return "remote_executor_runtime";
  }

  const looksLikeRemoteBackendIssue =
    message.includes("10.10.0.60") ||
    message.includes("llm") ||
    message.includes("model");

  if (
    looksLikeRemoteBackendIssue &&
    [
      "connection refused",
      "read timed out",
      "connect timed out",
      "max retries exceeded",
      "failed to establish a new connection",
      "name or service not known",
      "temporary failure in name resolution",
      "server error",
    ].some((pattern) => message.includes(pattern))
  ) {
    return "remote_executor_transport";
  }

  return "remote_executor_runtime";
}

export async function runRemoteExecutorAction({
  command,
  timeoutMs = 60 * 60 * 1000,
  runtimeMetadata = {},
} = {}) {
  const transport = getRemoteExecutorTransportConfig();
  const envOverrides = buildRemoteExecutorEnvOverrides(runtimeMetadata);
  const transportTarget = transport.llmEndpoint || transport.ollamaUrl || transport.target || "";
  const transportEvents = [
    `Remote executor target: ${transportTarget} (${transport.transport}).`,
    "Canonical CLI is running locally against the configured LLM provider backend.",
    `Reserved executor model override: ${envOverrides.EQUITYSTACK_MODEL_EXECUTOR}.`,
  ];

  const runResult = await runCliAction({
    args: command?.args || [],
    timeoutMs,
    envOverrides,
  });

  const transportReport = {
    target: transportTarget,
    transport: transport.transport,
    hostReached:
      runResult.ok || classifyRemoteExecutorFailure(runResult) !== "remote_executor_transport",
    executionStarted: true,
    executionFinished: true,
    outputReceived: Boolean(runResult.stdout || runResult.stderr),
    syncAttempted: false,
    syncCompleted: true,
    syncedPaths: [],
    skippedPaths: [],
  };

  if (runResult.ok) {
    transportEvents.push(
      "Canonical CLI completed while using the reserved remote executor backend."
    );

    return {
      ...runResult,
      failureKind: null,
      runtimeMetadata: {
        ...runtimeMetadata,
        executor_transport: transport.transport,
        executor_transport_target: transportTarget,
        executor_transport_url: transportTarget,
      },
      transportEvents,
      transportReport,
    };
  }

  const failureKind = classifyRemoteExecutorFailure(runResult);
  transportEvents.push(
    failureKind === "remote_executor_transport"
      ? "The local canonical CLI started, but the reserved remote executor backend did not respond cleanly."
      : failureKind === "remote_executor_timeout"
        ? "The canonical CLI timed out while waiting on the reserved remote executor backend."
        : "The canonical CLI started and the remote executor path was active, but the workflow failed during execution."
  );

  return {
    ...runResult,
    failureKind,
    runtimeMetadata: {
      ...runtimeMetadata,
      executor_transport: transport.transport,
      executor_transport_target: transportTarget,
      executor_transport_url: transportTarget,
    },
    transportEvents,
    transportReport,
  };
}
