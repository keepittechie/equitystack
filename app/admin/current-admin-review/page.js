import { getCurrentAdministrationOperatorWorkspace } from "@/lib/services/currentAdministrationReviewInsightsService";
import CurrentAdminReviewWorkspace from "./CurrentAdminReviewWorkspace";

export const dynamic = "force-dynamic";

export default async function CurrentAdminReviewPage() {
  const workspace = await getCurrentAdministrationOperatorWorkspace();

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-6">
      <section className="space-y-3">
        <p className="text-sm text-gray-600">Canonical review workspace</p>
        <h1 className="text-3xl font-bold">Current Admin Review</h1>
        <p className="text-gray-700 max-w-4xl">
          This page mirrors the Python workflow step that sits between AI review and
          decision logging. Saving writes a decision file only. Finalize calls the
          existing Python finalize step and keeps the manual review queue as the
          canonical import source.
        </p>
      </section>

      <CurrentAdminReviewWorkspace workspace={workspace} />
    </main>
  );
}
