import Link from "next/link";
import { getOperatorConsoleState } from "@/lib/services/operatorConsoleService";
import OperatorConsole from "./OperatorConsole";

export const dynamic = "force-dynamic";

function pickQueryValue(value) {
  if (Array.isArray(value)) {
    return value[0] || "";
  }
  return value || "";
}

export default async function OperatorConsolePage({ searchParams }) {
  const state = await getOperatorConsoleState();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const requestedActionId = pickQueryValue(resolvedSearchParams?.action_id);
  const requestedInput = pickQueryValue(resolvedSearchParams?.input);
  const matchedAction = state.quick_actions.find((action) => action.id === requestedActionId);
  const initialInput = matchedAction?.canonical_input || requestedInput || "";
  const initialActionId = matchedAction?.id || "";
  const initialNotice =
    requestedActionId && !matchedAction
      ? "The requested operator action is no longer available. Review the registry-backed actions below before running anything."
      : requestedInput && !matchedAction
        ? "The prefilled text did not map to a current registry action. Select a suggested action before running anything."
        : "";

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-6">
      <section className="space-y-3">
        <p className="text-sm text-gray-600">Operator Console</p>
        <h1 className="text-3xl font-bold">Supervised Operator Console</h1>
        <p className="text-gray-700 max-w-4xl">
          This is the controlled manual execution surface for safe wrapped pipeline commands.
          Every action resolves through a centralized registry, produces a visible execution trace,
          and is recorded in recent operator history for auditability.
        </p>
        <p className="text-sm text-gray-600">
          Need the day-to-day operating guide? Open the{" "}
          <Link href="/admin/runbook" className="underline">
            Operator Runbook
          </Link>
          . This console remains supervised, registry-driven, and inside the existing guardrails.
        </p>
      </section>

      <OperatorConsole
        quickActions={state.quick_actions}
        initialTrace={state.initial_trace}
        initialHistory={state.history}
        initialInput={initialInput}
        initialActionId={initialActionId}
        initialNotice={initialNotice}
      />
    </main>
  );
}
