import Link from "next/link";
import {
  getOperatorConsoleQuickActions,
  getOperatorConsoleState,
} from "@/lib/services/operatorConsoleService";
import OperatorConsole from "./OperatorConsole";

export const dynamic = "force-dynamic";

function pickQueryValue(value) {
  if (Array.isArray(value)) {
    return value[0] || "";
  }
  return value || "";
}

export default async function OperatorConsolePage({ searchParams }) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  let state;
  let loadError = "";

  try {
    state = await getOperatorConsoleState();
  } catch (error) {
    console.error("workflow console page load failed:", error);
    const quickActions = await getOperatorConsoleQuickActions();
    state = {
      quick_actions: quickActions,
      history: [],
      initial_trace: {
        user_input: null,
        mapped_action_id: null,
        action_label: "Workflow Console Safe Fallback",
        execution_path: "Read-only page fallback after operator-console state load failure",
        status: "failed",
        summary:
          "Workflow Console loaded in safe fallback mode because its server-side state could not be assembled completely.",
        blocked_reason: null,
        failure_reason:
          error instanceof Error
            ? error.message
            : "Unknown operator-console state load failure.",
        execution_duration_ms: null,
        was_blocked: false,
        had_artifacts: false,
        artifact_references: [],
        contextual_recommendations: [],
        next_recommended_step: {
          label: "Return to Dashboard",
          href: "/admin",
        },
        safety_note:
          "No commands were run. This fallback keeps the console read-only until state loads cleanly again.",
        retry_guidance:
          "Check the dashboard and logs first, then retry a registry-backed action only after confirming workflow state.",
        command: null,
        stdout: "",
        stderr: "",
      },
    };
    loadError =
      "Workflow Console state could not be loaded fully. The page is showing a safe fallback instead of failing completely.";
  }

  const requestedActionId = pickQueryValue(resolvedSearchParams?.action_id);
  const requestedInput = pickQueryValue(resolvedSearchParams?.input);
  const matchedAction = state.quick_actions.find((action) => action.id === requestedActionId);
  const initialInput = matchedAction?.canonical_input || requestedInput || "";
  const initialActionId = matchedAction?.id || "";
  const initialNotice = loadError
    ? loadError
    : requestedActionId && !matchedAction
      ? "The requested operator action is no longer available. Review the registry-backed actions below before running anything."
      : requestedInput && !matchedAction
        ? "The prefilled text did not map to a current registry action. Select a suggested action before running anything."
        : "";

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-6">
      <section className="space-y-3">
        <p className="text-sm text-gray-600">Workflow Console</p>
        <h1 className="text-3xl font-bold">Supervised Workflow Console</h1>
        <p className="text-gray-700 max-w-4xl">
          This is the controlled manual execution surface for canonical workflow commands. Every
          action resolves through the wrapped CLI or the existing read-only services, preserves the
          required stop points, and records a compact execution trace for auditability.
        </p>
        <p className="text-sm text-gray-600">
          Need the day-to-day operating guide? Open the{" "}
          <Link href="/admin/runbook" className="underline">
            Operator Runbook
          </Link>
          . This console remains supervised, registry-driven, and inside the existing guardrails.
        </p>
        {loadError ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            {loadError}
          </div>
        ) : null}
      </section>

      <OperatorConsole
        quickActions={state.quick_actions}
        initialTrace={state.initial_trace}
        initialHistory={state.history}
        initialInput={initialInput}
        initialActionId={initialActionId}
        initialNotice={initialNotice}
        initialActiveExecution={state.active_execution}
      />
    </main>
  );
}
