import { after, NextResponse } from "next/server";
import {
  executeParsedOperatorCommand,
  parseOperatorCommand,
  SUPPORTED_OPERATOR_COMMANDS,
} from "@/lib/server/admin-operator/commandInterface.js";
import {
  createRegisteredActionJob,
  runRegisteredActionJob,
} from "@/lib/server/admin-operator/commandBroker.js";
import { createCommandHistoryEntry, listCommandHistoryEntries } from "@/lib/server/admin-operator/commandHistoryStore.js";
import { buildCommandExecutionAssist } from "@/lib/server/admin-operator/operatorAssist.js";
import { normalizeString } from "@/lib/server/admin-operator/shared.js";
import { getWorkflowSessionDetail } from "@/lib/server/admin-operator/workflowData.js";

export const dynamic = "force-dynamic";
export const maxDuration = 3600;

function jsonError(message, status = 500) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET() {
  return NextResponse.json({
    success: true,
    commands: SUPPORTED_OPERATOR_COMMANDS,
    history: await listCommandHistoryEntries({ limit: 20 }),
  });
}

export async function POST(request) {
  let body = null;
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return jsonError("Requests must use application/json.", 415);
    }

    body = await request.json();
    const selectedSessionId =
      typeof body?.selectedSessionId === "string" ? body.selectedSessionId : "";
    const confirmation =
      body?.confirmation && typeof body.confirmation === "object" && !Array.isArray(body.confirmation)
        ? body.confirmation
        : {};
    const parsedCommand = await parseOperatorCommand(body?.command, {
      selectedSessionId,
    });
    const execution = await executeParsedOperatorCommand(parsedCommand, {
      confirmation,
    });

    if (execution.kind === "confirmation_required") {
      await createCommandHistoryEntry({
        rawCommand: body?.command,
        normalizedCommand: normalizeString(body?.command).toLowerCase(),
        resultType: "action",
        resultStatus: "confirmation_required",
        title: execution.title,
        summary: execution.summary,
        actionId: execution.parsedCommand?.actionId || null,
        selectedSessionId,
        relatedSessionId: execution.parsedCommand?.sessionId || selectedSessionId || null,
        confirmationRequired: true,
        payloadJson: {
          parsedCommand: execution.parsedCommand,
          executionMode: execution.parsedCommand?.executionMode || null,
        },
      });
      return NextResponse.json({
        success: true,
        mode: "confirmation_required",
        result: execution,
      });
    }

    if (execution.kind === "inspect") {
      await createCommandHistoryEntry({
        rawCommand: body?.command,
        normalizedCommand: normalizeString(body?.command).toLowerCase(),
        resultType: "inspect",
        resultStatus: "success",
        title: execution.title,
        summary: execution.summary,
        selectedSessionId,
        relatedSessionId: execution.data?.detail?.session?.id || null,
        confirmationRequired: false,
        payloadJson: {
          target: execution.target,
        },
      });
      return NextResponse.json({
        success: true,
        mode: "inspect",
        result: execution,
      });
    }

    if (execution.kind === "schedule-action") {
      const relatedSessionId = execution.job?.sessionIds?.[0] || null;
      const sessionDetail = relatedSessionId
        ? await getWorkflowSessionDetail(relatedSessionId).catch(() => null)
        : null;
      const executionAssist = buildCommandExecutionAssist({
        job: execution.job,
        session: sessionDetail?.session || null,
      });
      await createCommandHistoryEntry({
        rawCommand: body?.command,
        normalizedCommand: normalizeString(body?.command).toLowerCase(),
        resultType: "schedule",
        resultStatus: "success",
        title: execution.title,
        summary: executionAssist.narrative,
        selectedSessionId,
        relatedSessionId,
        relatedJobId: execution.job?.id || null,
        confirmationRequired: false,
        payloadJson: {
          scheduleId: execution.schedule?.id || null,
          executionMode:
            execution.schedule?.executionMode ||
            execution.job?.metadataJson?.execution_mode ||
            null,
          executionAssist,
        },
      });

      after(async () => {
        try {
          await runRegisteredActionJob(execution.job.id);
        } catch (error) {
          console.error("admin operator schedule command execution error:", error);
        }
      });

      return NextResponse.json(
        {
          success: true,
          mode: "async",
          result: {
            kind: "schedule-action",
            title: execution.title,
            summary: execution.job.summary,
            job: execution.job,
            schedule: execution.schedule,
            sessionImpact: executionAssist.sessionImpact,
            nextRecommendedAction: executionAssist.nextRecommendedAction,
            nextRecommendedActionId: executionAssist.nextRecommendedActionId,
            assist: executionAssist,
            links: {
              job: execution.job?.id ? `/admin/jobs/${execution.job.id}` : null,
              session: relatedSessionId
                ? `/admin/workflows/${encodeURIComponent(relatedSessionId)}`
                : null,
            },
          },
        },
        { status: 202 }
      );
    }

    const result = await createRegisteredActionJob({
      actionId: execution.parsedCommand.actionId,
      input: execution.parsedCommand.input || {},
      context: execution.parsedCommand.context || {},
      executionMode: execution.parsedCommand.executionMode || "",
    });
    const relatedSessionId =
      execution.parsedCommand.sessionId || result.job?.sessionIds?.[0] || null;
    const sessionDetail = relatedSessionId
      ? await getWorkflowSessionDetail(relatedSessionId).catch(() => null)
      : null;
    const executionAssist = buildCommandExecutionAssist({
      job: result.job,
      session: sessionDetail?.session || null,
    });
    await createCommandHistoryEntry({
      rawCommand: body?.command,
      normalizedCommand: normalizeString(body?.command).toLowerCase(),
      resultType: "action",
      resultStatus: "success",
      title: execution.title,
      summary: executionAssist.narrative,
      actionId: execution.parsedCommand.actionId,
      selectedSessionId,
      relatedSessionId,
      relatedJobId: result.job?.id || null,
      confirmationRequired: false,
      payloadJson: {
        parsedCommand: execution.parsedCommand,
        jobStatus: result.job?.status || null,
        executionMode: execution.parsedCommand.executionMode || null,
        executionAssist,
      },
    });

    after(async () => {
      try {
        await runRegisteredActionJob(result.job.id);
      } catch (error) {
        console.error("admin operator command execution error:", error);
      }
    });

    return NextResponse.json(
      {
        success: true,
        mode: "async",
        result: {
          kind: "action",
          title: execution.title,
          summary: result.job.summary,
          parsedCommand: execution.parsedCommand,
          job: result.job,
          sessionImpact: executionAssist.sessionImpact,
          nextRecommendedAction: executionAssist.nextRecommendedAction,
          nextRecommendedActionId: executionAssist.nextRecommendedActionId,
          assist: executionAssist,
          links: {
            job: result.job?.id ? `/admin/jobs/${result.job.id}` : null,
            session: relatedSessionId
              ? `/admin/workflows/${encodeURIComponent(relatedSessionId)}`
              : null,
          },
        },
      },
      { status: 202 }
    );
  } catch (error) {
    if (body?.command) {
      await createCommandHistoryEntry({
        rawCommand: body.command,
        normalizedCommand: normalizeString(body.command).toLowerCase(),
        resultType: "command",
        resultStatus: "failure",
        title: "Command failed",
        summary: error instanceof Error ? error.message : "Failed to run the operator command.",
        selectedSessionId: normalizeString(body?.selectedSessionId) || null,
        confirmationRequired: false,
        payloadJson: {
          confirmation: body?.confirmation || null,
        },
      }).catch(() => {});
    }
    return jsonError(error instanceof Error ? error.message : "Failed to run the operator command.");
  }
}
