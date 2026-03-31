import { getCurrentAdministrationOperatorWorkspace } from "@/lib/services/currentAdministrationReviewInsightsService";
import CurrentAdminReviewWorkspace from "./CurrentAdminReviewWorkspace";

export const dynamic = "force-dynamic";

export default async function CurrentAdminReviewPage() {
  const workspace = await getCurrentAdministrationOperatorWorkspace();

  return (
    <main className="mx-auto max-w-[1700px] space-y-4 px-4 py-4">
      <section className="space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-wide text-gray-600">Canonical review workspace</p>
        <h1 className="text-lg font-semibold">Current Admin Review</h1>
        <p className="max-w-5xl text-[12px] text-gray-700">
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
