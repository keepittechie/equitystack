import { listBrokerJobs } from "@/lib/server/admin-operator/commandBroker.js";
import ActionLauncher from "../components/ActionLauncher";
import JobsTableClient from "./JobsTableClient";

export default async function AdminJobsPage() {
  const jobs = await listBrokerJobs({ limit: 50 });

  return (
    <main className="mx-auto max-w-[1700px] space-y-4 px-4 py-4">
      <section className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">Jobs / Runs</p>
        <h2 className="text-lg font-semibold text-[var(--admin-text)]">Broker-backed job history</h2>
        <p className="max-w-5xl text-[12px] text-[var(--admin-text-soft)]">
          Every broker action records a durable job with status, runtime metadata, captured output,
          linked session context, and rerun history.
        </p>
      </section>

      <ActionLauncher
        title="Launch a registered action"
        description="Select a registered action and enqueue it through the broker."
        buttonLabel="Queue action"
        compact
      />

      <JobsTableClient initialJobs={jobs} />
    </main>
  );
}
