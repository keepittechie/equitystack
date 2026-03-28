import Link from "next/link";
import AdminEditPromiseForm from "./AdminEditPromiseForm";
import { fetchAdminPromiseDetail } from "@/lib/services/adminPromiseService";

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminEditPromisePage({ params }) {
  const { id } = await params;
  const promise = await fetchAdminPromiseDetail(Number(id));

  if (!promise) {
    return (
      <main className="max-w-5xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-3">Promise Not Found</h1>
        <p className="text-gray-700 mb-6">
          No Promise Tracker record exists for admin id {id}.
        </p>
        <Link href="/admin/promises/current-administration" className="border rounded-lg px-4 py-2 inline-block">
          Back to Current-Administration Review
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-600">Internal editorial enrichment</p>
          <h1 className="text-3xl font-bold mt-1">Edit Promise Record</h1>
          <p className="text-gray-700 mt-3 max-w-3xl">
            Complete the promoted Promise Tracker record, enrich outcomes,
            attach evidence, and make the record scoring-ready without changing
            scoring logic automatically.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/admin" className="border rounded-lg px-4 py-2">
            Admin Home
          </Link>
          <Link
            href="/admin/promises/current-administration"
            className="border rounded-lg px-4 py-2"
          >
            Current-Administration Review
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          <AdminEditPromiseForm initialData={promise} />
        </div>

        <aside className="space-y-6">
          <section className="border rounded-2xl p-5 bg-white shadow-sm">
            <h2 className="text-lg font-semibold mb-3">Record Context</h2>
            <div className="space-y-2 text-sm text-gray-700">
              <p><strong>Promise ID:</strong> {promise.promise.id}</p>
              <p><strong>President:</strong> {promise.promise.president}</p>
              <p><strong>President slug:</strong> {promise.promise.president_slug}</p>
              <p><strong>Current status:</strong> {promise.promise.status}</p>
              <p><strong>Topic:</strong> {promise.promise.topic || "Unset"}</p>
              <p><strong>Actions:</strong> {promise.actions.length}</p>
              <p><strong>Outcomes:</strong> {promise.outcomes.length}</p>
            </div>
          </section>

          <section className="border rounded-2xl p-5 bg-white shadow-sm">
            <h2 className="text-lg font-semibold mb-3">Scoring Ready</h2>
            <p className="text-sm text-gray-700">
              {promise.scoring_readiness.summary}
            </p>
            <div className="mt-4 space-y-2">
              {promise.scoring_readiness.checks.map((check) => (
                <p
                  key={check.key}
                  className={`text-sm ${
                    check.passed ? "text-green-700" : "text-gray-700"
                  }`}
                >
                  {check.passed ? "Done" : "Needs work"}: {check.label}
                </p>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
