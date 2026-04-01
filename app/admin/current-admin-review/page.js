import { getCurrentAdministrationOperatorWorkspace } from "@/lib/services/currentAdministrationReviewInsightsService";
import { buildCurrentAdminWorkflowTracker } from "@/lib/server/admin-operator/workflowData";
import CurrentAdminWorkflowTracker from "../components/CurrentAdminWorkflowTracker";
import CurrentAdminReviewWorkspace from "./CurrentAdminReviewWorkspace";

export const dynamic = "force-dynamic";

export default async function CurrentAdminReviewPage() {
  const workspace = await getCurrentAdministrationOperatorWorkspace();
  const batchName = workspace?.batch?.batch_name || "";
  const tracker = buildCurrentAdminWorkflowTracker(workspace, {
    sessionId: batchName ? `current-admin:${batchName}` : "",
  });

  return (
    <main className="mx-auto max-w-[1700px] space-y-4 px-4 py-4">
      <section className="space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-wide text-[#6B7280]">Canonical review workspace</p>
        <h1 className="text-lg font-semibold text-[#1F2937]">Current Admin Review</h1>
        <p className="max-w-5xl text-[12px] text-[#4B5563]">
          This page mirrors the Python workflow step that sits between AI review and
          decision logging. Saving writes a decision file only. Finalize calls the
          existing Python finalize step and keeps the manual review queue as the
          canonical import source.
        </p>
      </section>

      <CurrentAdminWorkflowTracker
        tracker={tracker}
        eyebrow="Workflow Guidance"
        title="Current-admin overall flow"
        description="Stay oriented in the full current-admin workflow while working inside the canonical review surface."
      />

      <CurrentAdminReviewWorkspace workspace={workspace} />
    </main>
  );
}
