import { getCurrentAdministrationOperatorWorkspace } from "@/lib/services/currentAdministrationReviewInsightsService";
import ImportHistoryPanel from "./ImportHistoryPanel";

export const dynamic = "force-dynamic";

export default async function ImportHistoryPage() {
  const workspace = await getCurrentAdministrationOperatorWorkspace();

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <section className="space-y-3">
        <p className="text-sm text-gray-600">Canonical import + validation visibility</p>
        <h1 className="text-3xl font-bold">Import History</h1>
        <p className="text-gray-700 max-w-4xl">
          Dry-run, apply, and validation still run through the Python pipeline.
          This page only triggers the same commands and shows their output artifacts.
          Nothing is written unless Apply is confirmed.
        </p>
      </section>

      <ImportHistoryPanel workspace={workspace} />
    </main>
  );
}
