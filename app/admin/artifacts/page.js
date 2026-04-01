import Link from "next/link";
import { listArtifacts, listWorkflowSessions } from "@/lib/server/admin-operator/workflowData.js";
import { formatAdminDateTime } from "@/app/admin/components/adminDateTime";
import OperatorPageAutoRefresh from "@/app/admin/components/OperatorPageAutoRefresh";

function toWorkflowLabel(value) {
  if (value === "current-admin") {
    return "Current Admin";
  }
  if (value === "legislative") {
    return "Legislative";
  }
  return value || "Unknown";
}

export default async function AdminArtifactsPage() {
  const [artifacts, sessions] = await Promise.all([
    listArtifacts(),
    listWorkflowSessions(),
  ]);

  const sessionIndex = new Map(sessions.map((session) => [session.id, session]));

  return (
    <main className="mx-auto max-w-[1700px] space-y-4 px-4 py-4">
      <OperatorPageAutoRefresh />

      <section className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-wide text-[#6B7280]">Artifacts</p>
        <h2 className="text-lg font-semibold text-[#1F2937]">Canonical artifact catalog</h2>
        <p className="max-w-5xl text-[12px] text-[#4B5563]">
          Artifact rows stay dense and path-first. Inspect the session for deeper context instead of
          expanding the dashboard into a document browser.
        </p>
      </section>

      <section className="overflow-x-auto rounded border border-[#E5EAF0] bg-white">
        <table className="min-w-[1360px] w-full text-[11px]">
          <thead className="bg-[#F9FBFD] text-left uppercase tracking-wide text-[#6B7280]">
            <tr>
              <th className="border-b border-[#E5EAF0] px-2 py-1">Workflow</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1">Session</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1">Artifact</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1">Stage</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1">Path</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1">Exists</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1">Updated</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1">Job</th>
              <th className="border-b border-[#E5EAF0] px-2 py-1">Action</th>
            </tr>
          </thead>
          <tbody>
            {artifacts.map((artifact) => (
              <tr key={artifact.id} className="align-top odd:bg-white even:bg-[#F9FBFD] hover:bg-[#F1F5F9]">
                <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">{toWorkflowLabel(artifact.workflowFamily)}</td>
                <td className="border-b border-[#E5EAF0] px-2 py-1 font-mono text-[10px] text-[#111827]">
                  {sessionIndex.get(artifact.sessionId)?.canonicalSessionKey || artifact.sessionId}
                </td>
                <td className="border-b border-[#E5EAF0] px-2 py-1">
                  <div className="font-medium text-[#1F2937]">{artifact.label}</div>
                  <div className="font-mono text-[10px] text-[#6B7280]">{artifact.artifactKey}</div>
                </td>
                <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">{artifact.stage || "artifact"}</td>
                <td className="border-b border-[#E5EAF0] px-2 py-1 font-mono text-[10px] text-[#111827]">
                  <div className="max-w-[420px] overflow-x-auto whitespace-nowrap rounded bg-[#F3F4F6] px-1.5 py-0.5">
                    {artifact.path || "No path recorded."}
                  </div>
                </td>
                <td className="border-b border-[#E5EAF0] px-2 py-1">
                  <span className="rounded border border-[#E5EAF0] bg-[#F9FBFD] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[#4B5563]">
                    {artifact.exists ? "yes" : "no"}
                  </span>
                </td>
                <td className="border-b border-[#E5EAF0] px-2 py-1 text-[#4B5563]">{formatAdminDateTime(artifact.generatedAt)}</td>
                <td className="border-b border-[#E5EAF0] px-2 py-1 font-mono text-[10px] text-[#111827]">
                  {artifact.latestJobRunId || "—"}
                </td>
                <td className="border-b border-[#E5EAF0] px-2 py-1">
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/admin/workflows/${encodeURIComponent(artifact.sessionId)}`} className="text-[11px] text-[#3B82F6] underline">
                      Session
                    </Link>
                    {artifact.latestJobRunId ? (
                      <Link href={`/admin/jobs/${artifact.latestJobRunId}`} className="text-[11px] text-[#3B82F6] underline">
                        Job
                      </Link>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {!artifacts.length ? (
              <tr>
                <td colSpan={9} className="px-2 py-3 text-[11px] text-[#6B7280]">
                  No artifacts are currently cataloged.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
