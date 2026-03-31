import { getBrokerJob } from "@/lib/server/admin-operator/commandBroker.js";
import JobDetailClient from "../JobDetailClient";

export const dynamic = "force-dynamic";

export default async function AdminJobDetailPage({ params }) {
  const resolved = await params;
  const job = await getBrokerJob(resolved.jobId);

  return (
    <main className="mx-auto max-w-[1700px] space-y-4 px-4 py-4">
      <section className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-wide text-gray-600">Jobs / Runs</p>
        <h1 className="text-lg font-semibold">Job detail</h1>
        <p className="text-[12px] text-gray-700">
          This view follows a registry-backed broker job from queued through terminal status and
          exposes the captured logs and artifact changes.
        </p>
      </section>

      <JobDetailClient jobId={resolved.jobId} initialJob={job} />
    </main>
  );
}
