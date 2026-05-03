import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  EQUITYSTACK_CLI_RELATIVE,
  EQUITYSTACK_RUNTIME_DIR,
  PROJECT_ROOT,
  normalizeString,
  resolveShellBinary,
  shellEscape,
} from "./shared.js";

const execFileAsync = promisify(execFile);

function buildShellCommand(args = []) {
  return `cd "$EQUITYSTACK_RUNTIME_PYTHON_DIR" && "${EQUITYSTACK_CLI_RELATIVE}" ${args
    .map(shellEscape)
    .join(" ")}`;
}

export async function runCliAction({
  args = [],
  timeoutMs = 60 * 60 * 1000,
  envOverrides = {},
} = {}) {
  const shellBinary = resolveShellBinary();
  const command = buildShellCommand(args);
  const startedAt = new Date().toISOString();
  const started = Date.now();

  try {
    const { stdout, stderr } = await execFileAsync(shellBinary, ["-lc", command], {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        EQUITYSTACK_RUNTIME_PYTHON_DIR: EQUITYSTACK_RUNTIME_DIR,
        ...envOverrides,
      },
      timeout: timeoutMs,
      maxBuffer: 20 * 1024 * 1024,
    });

    return {
      ok: true,
      command,
      args,
      exitCode: 0,
      timedOut: false,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      stdout: normalizeString(stdout),
      stderr: normalizeString(stderr),
    };
  } catch (error) {
    const killedByTimeout = Boolean(error?.killed) || error?.signal === "SIGTERM";
    return {
      ok: false,
      command,
      args,
      exitCode: Number.isInteger(error?.code) ? error.code : 1,
      timedOut: killedByTimeout,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      stdout: normalizeString(error?.stdout),
      stderr: normalizeString(error?.stderr),
      errorMessage:
        normalizeString(error?.message) ||
        "The wrapped CLI action failed.",
    };
  }
}
