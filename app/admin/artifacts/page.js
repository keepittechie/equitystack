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
        <p className="font-mono text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">Artifacts</p>
        <h2 className="text-lg font-semibold text-[var(--admin-text)]">Canonical artifact catalog</h2>
        <p className="max-w-5xl text-[12px] text-[var(--admin-text-soft)]">
          Artifact rows stay dense and path-first. Inspect the session for deeper context instead of
          expanding the dashboard into a document browser.
        </p>
      </section>

      <section className="overflow-x-auto rounded border border-[var(--admin-line)] bg-[var(--admin-surface)]">
        <table className="min-w-[1360px] w-full text-[11px]">
          <thead className="bg-[var(--admin-surface-muted)] text-left uppercase tracking-wide text-[var(--admin-text-muted)]">
            <tr>
              <th className="border-b border-[var(--admin-line)] px-2 py-1">Workflow</th>
              <th className="border-b border-[var(--admin-line)] px-2 py-1">Session</th>
              <th className="border-b border-[var(--admin-line)] px-2 py-1">Artifact</th>
              <th className="border-b border-[var(--admin-line)] px-2 py-1">Stage</th>
              <th className="border-b border-[var(--admin-line)] px-2 py-1">Path</th>
              <th className="border-b border-[var(--admin-line)] px-2 py-1">Exists</th>
              <th className="border-b border-[var(--admin-line)] px-2 py-1">Updated</th>
              <th className="border-b border-[var(--admin-line)] px-2 py-1">Job</th>
              <th className="border-b border-[var(--admin-line)] px-2 py-1">Action</th>
            </tr>
          </thead>
          <tbody>
            {artifacts.map((artifact) => (
              <tr key={artifact.id} className="align-top odd:bg-[var(--admin-surface)] even:bg-[var(--admin-surface-muted)] hover:bg-[var(--admin-surface-soft)]">
                <td className="border-b border-[var(--admin-line)] px-2 py-1 text-[var(--admin-text-soft)]">{toWorkflowLabel(artifact.workflowFamily)}</td>
                <td className="border-b border-[var(--admin-line)] px-2 py-1 font-mono text-[10px] text-[var(--admin-text)]">
                  {sessionIndex.get(artifact.sessionId)?.canonicalSessionKey || artifact.sessionId}
                </td>
                <td className="border-b border-[var(--admin-line)] px-2 py-1">
                  <div className="font-medium text-[var(--admin-text)]">{artifact.label}</div>
                  <div className="font-mono text-[10px] text-[var(--admin-text-muted)]">{artifact.artifactKey}</div>
                </td>
                <td className="border-b border-[var(--admin-line)] px-2 py-1 text-[var(--admin-text-soft)]">{artifact.stage || "artifact"}</td>
                <td className="border-b border-[var(--admin-line)] px-2 py-1 font-mono text-[10px] text-[var(--admin-text)]">
                  <div className="max-w-[420px] overflow-x-auto whitespace-nowrap rounded bg-[var(--admin-surface-soft)] px-1.5 py-0.5">
                    {artifact.path || "No path recorded."}
                  </div>
                </td>
                <td className="border-b border-[var(--admin-line)] px-2 py-1">
                  <span className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--admin-text-soft)]">
                    {artifact.exists ? "yes" : "no"}
                  </span>
                </td>
                <td className="border-b border-[var(--admin-line)] px-2 py-1 text-[var(--admin-text-soft)]">{formatAdminDateTime(artifact.generatedAt)}</td>
                <td className="border-b border-[var(--admin-line)] px-2 py-1 font-mono text-[10px] text-[var(--admin-text)]">
                  {artifact.latestJobRunId || "—"}
                </td>
                <td className="border-b border-[var(--admin-line)] px-2 py-1">
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/admin/workflows/${encodeURIComponent(artifact.sessionId)}`} className="text-[11px] text-[var(--admin-link)] underline">
                      Session
                    </Link>
                    {artifact.latestJobRunId ? (
                      <Link href={`/admin/jobs/${artifact.latestJobRunId}`} className="text-[11px] text-[var(--admin-link)] underline">
                        Job
                      </Link>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {!artifacts.length ? (
              <tr>
                <td colSpan={9} className="px-2 py-3 text-[11px] text-[var(--admin-text-muted)]">
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
