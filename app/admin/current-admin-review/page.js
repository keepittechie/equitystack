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
        <p className="font-mono text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">Canonical review workspace</p>
        <h1 className="text-lg font-semibold text-[var(--admin-text)]">Current-Admin Automation</h1>
        <p className="max-w-5xl text-[12px] text-[var(--admin-text-soft)]">
          This page now wraps the full exceptions-only current-admin automation flow.
          Full-auto runs stay on the canonical Python pipeline and artifacts, guarded
          `--apply --yes` steps remain behind validator checks, and only the remaining
          exception rows fall back to manual review on this surface.
        </p>
      </section>

      <CurrentAdminWorkflowTracker
        tracker={tracker}
        eyebrow="Current-Admin Pipeline"
        title="Current-admin pipeline tracker"
        description="This tracker shows what is complete, what stage is active now, what is blocked, and the single next safe action to continue the canonical pipeline."
      />

      <CurrentAdminReviewWorkspace workspace={workspace} />
    </main>
  );
}
