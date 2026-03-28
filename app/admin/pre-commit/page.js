import { getCurrentAdministrationOperatorWorkspace } from "@/lib/services/currentAdministrationReviewInsightsService";
import PreCommitStatusPanel from "./PreCommitStatusPanel";

export const dynamic = "force-dynamic";

export default async function PreCommitPage() {
  const workspace = await getCurrentAdministrationOperatorWorkspace();

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <section className="space-y-3">
        <p className="text-sm text-gray-600">Read-only import guardrails</p>
        <h1 className="text-3xl font-bold">Pre-Commit Status</h1>
        <p className="text-gray-700 max-w-4xl">
          This page mirrors the Python pre-commit step. It does not approve,
          import, or change queue state. It only makes the current readiness,
          blockers, warnings, and likely import result easier to see.
        </p>
      </section>

      <PreCommitStatusPanel workspace={workspace} />
    </main>
  );
}
