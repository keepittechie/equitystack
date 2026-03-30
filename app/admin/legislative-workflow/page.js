import { getLegislativeWorkflowWorkspace } from "@/lib/services/legislativeWorkflowInsightsService";
import LegislativeWorkflowWorkspace from "./LegislativeWorkflowWorkspace";

export const dynamic = "force-dynamic";

export default async function LegislativeWorkflowPage() {
  const workspace = await getLegislativeWorkflowWorkspace();

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-6">
      <section className="space-y-3">
        <p className="text-sm text-gray-600">Canonical legislative workflow</p>
        <h1 className="text-3xl font-bold">Legislative Workflow</h1>
        <p className="text-gray-700 max-w-4xl">
          This page is the human approval surface for the legislative review bundle. It
          reads the canonical artifacts, lets the operator approve or dismiss bundle actions,
          and only triggers wrapped legislative commands when the current workflow state allows it.
        </p>
      </section>

      <LegislativeWorkflowWorkspace workspace={workspace} />
    </main>
  );
}
