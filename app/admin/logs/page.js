import { getCurrentAdministrationOperatorWorkspace } from "@/lib/services/currentAdministrationReviewInsightsService";

export const dynamic = "force-dynamic";

export default async function CurrentAdminLogsPage() {
  const workspace = await getCurrentAdministrationOperatorWorkspace();
  const sessions = workspace.decision_history || [];
  const feedback = workspace.feedback_summary || {};

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <section className="space-y-3">
        <p className="text-sm text-gray-600">Decision visibility</p>
        <h1 className="text-3xl font-bold">Logs / Decision History</h1>
        <p className="text-gray-700 max-w-4xl">
          These logs come from the canonical append-only decision artifacts under
          <code> python/reports/current_admin/review_decisions/</code>. The
          dashboard does not write or reinterpret operator decisions here.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <p className="text-sm text-gray-600">Decision sessions</p>
          <p className="text-2xl font-semibold mt-2">{sessions.length}</p>
        </div>
        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <p className="text-sm text-gray-600">Matches</p>
          <p className="text-2xl font-semibold mt-2">
            {feedback.alignment_analytics?.total_match_count || 0}
          </p>
        </div>
        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <p className="text-sm text-gray-600">Mismatches</p>
          <p className="text-2xl font-semibold mt-2">
            {feedback.alignment_analytics?.total_mismatch_count || 0}
          </p>
        </div>
        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <p className="text-sm text-gray-600">Alignment rate</p>
          <p className="text-2xl font-semibold mt-2">
            {feedback.alignment_analytics?.alignment_rate ?? 0}
          </p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <h2 className="text-xl font-semibold">Recent sessions</h2>
          <div className="mt-4 space-y-4">
            {sessions.slice(0, 10).map((session) => (
              <div key={session.file_path} className="rounded-xl border p-4 text-sm">
                <p className="font-semibold">{session.session_id}</p>
                <p className="text-gray-600 mt-2">Focus: {session.session_focus || "unspecified"}</p>
                <p className="text-gray-600">Generated: {session.generated_at || "Unavailable"}</p>
                <p className="text-gray-600">Items: {session.items?.length || 0}</p>
                <p className="text-gray-600 break-all mt-2">{session.file_path}</p>
              </div>
            ))}
            {!sessions.length ? <p className="text-sm text-gray-600">No decision logs are available yet.</p> : null}
          </div>
        </div>

        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <h2 className="text-xl font-semibold">Feedback summary</h2>
          <div className="mt-4 space-y-3 text-sm">
            <p>
              Average confidence for matches:{" "}
              {feedback.alignment_analytics?.average_confidence_for_matches ?? "n/a"}
            </p>
            <p>
              Average confidence for mismatches:{" "}
              {feedback.alignment_analytics?.average_confidence_for_mismatches ?? "n/a"}
            </p>
            <p>
              High-confidence mismatches:{" "}
              {feedback.alignment_analytics?.high_confidence_mismatches ?? 0}
            </p>
            <p>
              Low-confidence matches:{" "}
              {feedback.alignment_analytics?.low_confidence_matches ?? 0}
            </p>
            <div className="rounded-xl border p-4">
              <p className="font-medium">Key findings</p>
              <div className="mt-2 space-y-2">
                {(feedback.key_findings || []).map((finding) => (
                  <p key={finding}>{finding}</p>
                ))}
                {!(feedback.key_findings || []).length ? (
                  <p className="text-gray-600">No findings have been generated yet.</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
