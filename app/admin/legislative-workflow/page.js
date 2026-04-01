import { getLegislativeWorkflowWorkspace } from "@/lib/services/legislativeWorkflowInsightsService";
import LegislativeWorkflowWorkspace from "./LegislativeWorkflowWorkspace";

export const dynamic = "force-dynamic";

export default async function LegislativeWorkflowPage() {
  const workspace = await getLegislativeWorkflowWorkspace();

  return (
    <main className="mx-auto max-w-[1700px] space-y-4 px-4 py-4">
      <section className="space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-wide text-[#6B7280]">Canonical legislative workflow</p>
        <h1 className="text-lg font-semibold text-[#1F2937]">Legislative Workflow</h1>
        <p className="max-w-5xl text-[12px] text-[#4B5563]">
          This page is the human approval surface for the legislative review bundle. It
          reads the canonical artifacts, lets the operator approve or dismiss bundle actions,
          and only triggers wrapped legislative commands when the current workflow state allows it.
        </p>
      </section>

      <LegislativeWorkflowWorkspace workspace={workspace} />
    </main>
  );
}
