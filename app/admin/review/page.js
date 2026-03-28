import Link from "next/link";
import { fetchInternalJson } from "@/lib/api";

async function getReviewQueue() {
  return fetchInternalJson("/api/admin/review-queue", {
    errorMessage: "Failed to fetch review queue",
  });
}

export default async function AdminReviewPage() {
  const items = await getReviewQueue();

  return (
    <main className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4">Needs Review</h1>
      <p className="text-gray-700 mb-8">
        Policies listed here need more sourcing, scoring, or metrics before they
        should be treated as fully developed records.
      </p>

      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href="/admin/promises/current-administration"
          className="border rounded-lg px-4 py-2 inline-block"
        >
          Current-Administration Review
        </Link>
      </div>

      <div className="space-y-4">
        {items.length === 0 && (
          <div className="border rounded-2xl p-5">
            <p>No review issues found.</p>
          </div>
        )}

        {items.map((item) => (
          <Link
            key={item.id}
            href={`/admin/policies/${item.id}`}
            className="block border rounded-2xl p-5 hover:shadow-md"
          >
            <h2 className="text-lg font-semibold">{item.title}</h2>
            <p className="text-sm text-gray-600">
              {item.year_enacted} • {item.primary_party || "Unknown party"} • {item.era || "Unknown era"}
            </p>
            <p className="text-sm text-gray-600">
              Sources: {item.total_sources} • Scores: {item.score_count} • Metrics: {item.metric_count}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {item.issues.map((issue) => (
                <span
                  key={issue}
                  className="border rounded-full px-3 py-1 text-sm"
                >
                  {issue}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
