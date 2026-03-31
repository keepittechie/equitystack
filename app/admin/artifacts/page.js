import Link from "next/link";
import { listArtifacts, listWorkflowSessions } from "@/lib/server/admin-operator/workflowData.js";
import OperatorPageAutoRefresh from "@/app/admin/components/OperatorPageAutoRefresh";

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

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
        <p className="font-mono text-[11px] uppercase tracking-wide text-gray-600">Artifacts</p>
        <h2 className="text-lg font-semibold">Canonical artifact catalog</h2>
        <p className="max-w-5xl text-[12px] text-gray-700">
          Artifact rows stay dense and path-first. Inspect the session for deeper context instead of
          expanding the dashboard into a document browser.
        </p>
      </section>

      <section className="overflow-x-auto rounded border border-zinc-200 bg-white">
        <table className="min-w-[1360px] w-full text-[11px]">
          <thead className="bg-zinc-100 text-left uppercase tracking-wide text-zinc-600">
            <tr>
              <th className="border-b border-zinc-200 px-2 py-1">Workflow</th>
              <th className="border-b border-zinc-200 px-2 py-1">Session</th>
              <th className="border-b border-zinc-200 px-2 py-1">Artifact</th>
              <th className="border-b border-zinc-200 px-2 py-1">Stage</th>
              <th className="border-b border-zinc-200 px-2 py-1">Path</th>
              <th className="border-b border-zinc-200 px-2 py-1">Exists</th>
              <th className="border-b border-zinc-200 px-2 py-1">Updated</th>
              <th className="border-b border-zinc-200 px-2 py-1">Job</th>
              <th className="border-b border-zinc-200 px-2 py-1">Action</th>
            </tr>
          </thead>
          <tbody>
            {artifacts.map((artifact) => (
              <tr key={artifact.id} className="align-top odd:bg-white even:bg-zinc-50/40">
                <td className="border-b border-zinc-200 px-2 py-1">{toWorkflowLabel(artifact.workflowFamily)}</td>
                <td className="border-b border-zinc-200 px-2 py-1 font-mono text-[10px] text-zinc-700">
                  {sessionIndex.get(artifact.sessionId)?.canonicalSessionKey || artifact.sessionId}
                </td>
                <td className="border-b border-zinc-200 px-2 py-1">
                  <div className="font-medium">{artifact.label}</div>
                  <div className="font-mono text-[10px] text-zinc-500">{artifact.artifactKey}</div>
                </td>
                <td className="border-b border-zinc-200 px-2 py-1">{artifact.stage || "artifact"}</td>
                <td className="border-b border-zinc-200 px-2 py-1 font-mono text-[10px] text-zinc-700">
                  <div className="max-w-[420px] overflow-x-auto whitespace-nowrap">
                    {artifact.path || "No path recorded."}
                  </div>
                </td>
                <td className="border-b border-zinc-200 px-2 py-1">
                  <span className="rounded border border-zinc-300 bg-zinc-50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-700">
                    {artifact.exists ? "yes" : "no"}
                  </span>
                </td>
                <td className="border-b border-zinc-200 px-2 py-1">{formatDateTime(artifact.generatedAt)}</td>
                <td className="border-b border-zinc-200 px-2 py-1 font-mono text-[10px] text-zinc-700">
                  {artifact.latestJobRunId || "—"}
                </td>
                <td className="border-b border-zinc-200 px-2 py-1">
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/admin/workflows/${encodeURIComponent(artifact.sessionId)}`} className="text-[11px] underline">
                      Session
                    </Link>
                    {artifact.latestJobRunId ? (
                      <Link href={`/admin/jobs/${artifact.latestJobRunId}`} className="text-[11px] underline">
                        Job
                      </Link>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {!artifacts.length ? (
              <tr>
                <td colSpan={9} className="px-2 py-3 text-[11px] text-zinc-600">
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
