import { getLegislativeWorkflowWorkspace } from "@/lib/services/legislativeWorkflowInsightsService";
import { buildLegislativeWorkflowTracker } from "@/lib/server/admin-operator/workflowData.js";
import LegislativeWorkflowTracker from "@/app/admin/components/LegislativeWorkflowTracker";
import LegislativeWorkflowWorkspace from "./LegislativeWorkflowWorkspace";

export const dynamic = "force-dynamic";

export default async function LegislativeWorkflowPage() {
  const workspace = await getLegislativeWorkflowWorkspace();
  const tracker = buildLegislativeWorkflowTracker(workspace);

  return (
    <main className="mx-auto max-w-[1700px] space-y-4 px-4 py-4">
      <section className="space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">Canonical legislative workflow</p>
        <h1 className="text-lg font-semibold text-[var(--admin-text)]">Legislative Workflow</h1>
        <p className="max-w-5xl text-[12px] text-[var(--admin-text-soft)]">
          This page is the human approval surface for the legislative review bundle. It
          reads the canonical artifacts, lets the operator approve or dismiss bundle actions,
          and only triggers wrapped legislative commands when the current workflow state allows it.
        </p>
      </section>

      <LegislativeWorkflowTracker
        tracker={tracker}
        eyebrow="Legislative Pipeline"
        title="Legislative workflow step tracker"
        description="This tracker shows what is complete, what step is active now, what is blocked, and the single next action to continue the canonical legislative workflow."
      />

      <LegislativeWorkflowWorkspace workspace={workspace} />
    </main>
  );
}
