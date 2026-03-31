import { runCliAction } from "./cliActionRunner.js";
import { runRemoteExecutorAction } from "./remoteExecutorRunner.js";
import { buildExecutionRuntimeMetadata, EXECUTION_MODES } from "./shared.js";

function buildUnsupportedRunnerResult({
  executionMode,
  timeoutMs,
  message,
  failureKind,
  runtimeMetadata,
}) {
  const startedAt = new Date().toISOString();
  return {
    ok: false,
    command: null,
    args: [],
    exitCode: 1,
    timedOut: false,
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: 0,
    stdout: "",
    stderr: "",
    errorMessage: message,
    failureKind,
    timeoutMs,
    runtimeMetadata: {
      ...runtimeMetadata,
      execution_mode: executionMode,
    },
  };
}

export function getRunnerTypeForExecutionMode(executionMode) {
  if (executionMode === EXECUTION_MODES.REMOTE_EXECUTOR) {
    return "remote_executor";
  }
  if (executionMode === EXECUTION_MODES.MCP_RUNTIME) {
    return "mcp_runtime";
  }
  return "cli";
}

export async function runOperatorActionCommand({
  action = null,
  command,
  executionMode = EXECUTION_MODES.LOCAL_CLI,
  timeoutMs = 60 * 60 * 1000,
} = {}) {
  const runtimeMetadata = buildExecutionRuntimeMetadata(executionMode);

  if (executionMode === EXECUTION_MODES.LOCAL_CLI) {
    const result = await runCliAction({
      args: command?.args || [],
      timeoutMs,
    });

    return {
      ...result,
      failureKind: result.ok ? null : "local_runner",
      runtimeMetadata,
    };
  }

  if (executionMode === EXECUTION_MODES.REMOTE_EXECUTOR) {
    return runRemoteExecutorAction({
      action,
      command,
      timeoutMs,
      runtimeMetadata,
    });
  }

  if (executionMode === EXECUTION_MODES.MCP_RUNTIME) {
    return buildUnsupportedRunnerResult({
      executionMode,
      timeoutMs,
      message: "MCP runtime execution is modeled but not implemented for operator actions yet.",
      failureKind: "mcp_runtime_transport",
      runtimeMetadata,
    });
  }

  return buildUnsupportedRunnerResult({
    executionMode,
    timeoutMs,
    message: `Unsupported execution mode: ${executionMode}`,
    failureKind: "validation",
    runtimeMetadata,
  });
}
