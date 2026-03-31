import Link from "next/link";
import { getCurrentAdministrationOperatorWorkspace } from "@/lib/services/currentAdministrationReviewInsightsService";
import { getLegislativeWorkflowWorkspace } from "@/lib/services/legislativeWorkflowInsightsService";
import AdminApprovalWorkspace from "./AdminApprovalWorkspace";

export const dynamic = "force-dynamic";

export default async function AdminApprovalPage() {
  const [currentAdmin, legislative] = await Promise.all([
    getCurrentAdministrationOperatorWorkspace(),
    getLegislativeWorkflowWorkspace(),
  ]);

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-6">
      <section className="space-y-3">
        <p className="text-sm text-gray-600">Explicit second stop point</p>
        <h1 className="text-3xl font-bold">Admin Approval</h1>
        <p className="max-w-4xl text-gray-700">
          This page is the supervised approval surface between operator review and the final
          wrapped apply or import steps. It does not bypass the CLI, decision logging, or the
          existing readiness checks.
        </p>
        <p className="text-sm text-gray-600">
          Need to go back to execution first? Open the{" "}
          <Link href="/admin/operator-console" className="underline">
            Workflow Console
          </Link>
          .
        </p>
      </section>

      <AdminApprovalWorkspace currentAdmin={currentAdmin} legislative={legislative} />
    </main>
  );
}
