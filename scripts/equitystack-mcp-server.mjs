#!/usr/bin/env node
import { callMcpTool, listMcpTools } from "../lib/server/mcp/equitystackMcpTools.mjs";

const PROTOCOL_VERSION = "2024-11-05";

let inputBuffer = Buffer.alloc(0);

function writeMessage(payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
  process.stdout.write(body);
}

function respond(id, result) {
  writeMessage({
    jsonrpc: "2.0",
    id,
    result,
  });
}

function respondError(id, code, message, data = null) {
  writeMessage({
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
      data,
    },
  });
}

function toolContent(payload) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
    isError: !payload?.ok,
  };
}

async function handleRequest(message) {
  const id = message.id;
  const method = message.method;

  try {
    if (method === "initialize") {
      respond(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: "equitystack-mcp",
          version: "0.1.0",
        },
      });
      return;
    }

    if (method === "notifications/initialized") {
      return;
    }

    if (method === "tools/list") {
      respond(id, {
        tools: listMcpTools(),
      });
      return;
    }

    if (method === "tools/call") {
      const name = message.params?.name;
      const args = message.params?.arguments || {};
      const result = await callMcpTool(name, args);
      respond(id, toolContent(result));
      return;
    }

    respondError(id, -32601, `Unsupported method: ${method}`);
  } catch (error) {
    respondError(
      id,
      -32000,
      error instanceof Error ? error.message : "MCP tool call failed.",
      error instanceof Error ? { name: error.name, stack: error.stack } : null
    );
  }
}

function parseNextMessage() {
  const headerEnd = inputBuffer.indexOf("\r\n\r\n");
  if (headerEnd === -1) {
    return null;
  }

  const header = inputBuffer.slice(0, headerEnd).toString("utf8");
  const match = header.match(/Content-Length:\s*(\d+)/i);
  if (!match) {
    throw new Error("MCP message missing Content-Length header.");
  }

  const contentLength = Number(match[1]);
  const bodyStart = headerEnd + 4;
  const bodyEnd = bodyStart + contentLength;
  if (inputBuffer.length < bodyEnd) {
    return null;
  }

  const rawBody = inputBuffer.slice(bodyStart, bodyEnd).toString("utf8");
  inputBuffer = inputBuffer.slice(bodyEnd);
  return JSON.parse(rawBody);
}

async function drainMessages() {
  while (true) {
    const message = parseNextMessage();
    if (!message) {
      return;
    }
    await handleRequest(message);
  }
}

process.stdin.on("data", (chunk) => {
  inputBuffer = Buffer.concat([inputBuffer, chunk]);
  drainMessages().catch((error) => {
    respondError(null, -32000, error instanceof Error ? error.message : "MCP server failed.");
  });
});

process.stdin.on("end", () => {
  process.exit(0);
});
