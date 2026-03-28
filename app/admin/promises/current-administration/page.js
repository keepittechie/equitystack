import Link from "next/link";
import CurrentAdministrationReviewPanel from "./CurrentAdministrationReviewPanel";
import { getAiReviewForStagedItem } from "@/lib/services/currentAdministrationAiReviewService";
import {
  REVIEW_STATUSES,
  buildPromisePromotionDraftFromStagedItem,
  getStagedCurrentAdministrationItem,
  listStagedCurrentAdministrationItems,
} from "@/lib/services/currentAdministrationStagingService";

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

function toNullableNumber(value) {
  if (value == null || value === "") {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatDate(value) {
  if (!value) {
    return "Unavailable";
  }

  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatDateTime(value) {
  if (!value) {
    return "Unavailable";
  }

  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function buildStatusHref(status, itemId = null) {
  const params = new URLSearchParams();

  if (status) {
    params.set("status", status);
  }

  if (itemId != null) {
    params.set("item", String(itemId));
  }

  const query = params.toString();
  return query
    ? `/admin/promises/current-administration?${query}`
    : "/admin/promises/current-administration";
}

export default async function CurrentAdministrationReviewPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const requestedStatus = REVIEW_STATUSES.includes(resolvedSearchParams.status)
    ? resolvedSearchParams.status
    : "pending_review";
  const requestedItemId = toNullableNumber(resolvedSearchParams.item);
  const existingPromiseId = toNullableNumber(
    resolvedSearchParams.existing_promise_id
  );

  const items = await listStagedCurrentAdministrationItems({
    status: requestedStatus,
    limit: 100,
  });

  const selectedItemId =
    requestedItemId && items.some((item) => item.id === requestedItemId)
      ? requestedItemId
      : items[0]?.id || null;

  const selectedItem = selectedItemId
    ? await getStagedCurrentAdministrationItem(selectedItemId)
    : null;
  const draft = selectedItem
    ? await buildPromisePromotionDraftFromStagedItem(selectedItem.id, {
        existingPromiseId,
      })
    : null;
  const aiReview = selectedItem
    ? await getAiReviewForStagedItem(selectedItem.id)
    : null;

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-600">Internal review workflow</p>
          <h1 className="text-3xl font-bold mt-1">
            Current-Administration Staging
          </h1>
          <p className="text-gray-700 mt-3 max-w-3xl">
            Review White House intake candidates, mark them approved or rejected,
            and manually promote approved items into curated Promise Tracker
            records. Staged items here remain internal until promotion.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/admin" className="border rounded-lg px-4 py-2">
            Admin Home
          </Link>
          <Link href="/admin/review" className="border rounded-lg px-4 py-2">
            Review Queue
          </Link>
        </div>
      </div>

      <section className="border rounded-2xl p-4 bg-white">
        <div className="flex flex-wrap gap-2">
          {REVIEW_STATUSES.map((status) => (
            <Link
              key={status}
              href={buildStatusHref(status)}
              className={`rounded-full px-4 py-2 text-sm border ${
                status === requestedStatus
                  ? "bg-black text-white border-black"
                  : "border-gray-300"
              }`}
            >
              {status.replace(/_/g, " ")}
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="border rounded-2xl bg-white overflow-hidden">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">Staged Items</h2>
            <p className="text-sm text-gray-600 mt-1">
              {items.length} item{items.length === 1 ? "" : "s"} in{" "}
              {requestedStatus.replace(/_/g, " ")}.
            </p>
          </div>

          <div className="divide-y">
            {items.length === 0 ? (
              <div className="p-5 text-sm text-gray-600">
                No staged items match this review status.
              </div>
            ) : (
              items.map((item) => {
                const isSelected = item.id === selectedItemId;

                return (
                  <Link
                    key={item.id}
                    href={buildStatusHref(requestedStatus, item.id)}
                    className={`block px-5 py-4 transition-colors ${
                      isSelected ? "bg-gray-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-sm">#{item.id}</p>
                      <span className="rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide text-gray-600">
                        {item.review_status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <h3 className="font-semibold mt-2 leading-snug">
                      {item.title}
                    </h3>
                    <p className="text-sm text-gray-600 mt-2">
                      {item.source_category.replace(/_/g, " ")} •{" "}
                      {formatDate(item.publication_date || item.action_date)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {item.president} ({item.president_slug})
                    </p>
                  </Link>
                );
              })
            )}
          </div>
        </aside>

        <section className="space-y-6">
          {selectedItem ? (
            <>
              <div className="border rounded-2xl p-5 bg-white shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-gray-600">
                      Staged item #{selectedItem.id}
                    </p>
                    <h2 className="text-2xl font-semibold mt-1">
                      {selectedItem.title}
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border px-3 py-1 text-xs uppercase tracking-wide">
                      {selectedItem.review_status.replace(/_/g, " ")}
                    </span>
                    <span className="rounded-full border px-3 py-1 text-xs">
                      {draft?.match_assessment?.type === "update_candidate"
                        ? "Update candidate"
                        : "New record candidate"}
                    </span>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 mt-5 text-sm">
                  <div className="rounded-xl border p-4">
                    <p className="font-semibold mb-2">Source Context</p>
                    <p>
                      <strong>System:</strong> {selectedItem.source_system}
                    </p>
                    <p>
                      <strong>Category:</strong>{" "}
                      {selectedItem.source_category.replace(/_/g, " ")}
                    </p>
                    <p>
                      <strong>Identifier:</strong>{" "}
                      {selectedItem.official_identifier || "Unavailable"}
                    </p>
                    <p>
                      <strong>Raw action type:</strong>{" "}
                      {selectedItem.raw_action_type || "Unavailable"}
                    </p>
                  </div>

                  <div className="rounded-xl border p-4">
                    <p className="font-semibold mb-2">Presidency Term</p>
                    <p>
                      <strong>President:</strong> {selectedItem.president}
                    </p>
                    <p>
                      <strong>Slug:</strong> {selectedItem.president_slug}
                    </p>
                    <p>
                      <strong>Publication date:</strong>{" "}
                      {formatDate(selectedItem.publication_date)}
                    </p>
                    <p>
                      <strong>Action date:</strong>{" "}
                      {formatDate(selectedItem.action_date)}
                    </p>
                  </div>

                  <div className="rounded-xl border p-4">
                    <p className="font-semibold mb-2">Staging Metadata</p>
                    <p>
                      <strong>Discovered:</strong>{" "}
                      {formatDateTime(selectedItem.discovered_at)}
                    </p>
                    <p>
                      <strong>Last seen:</strong>{" "}
                      {formatDateTime(selectedItem.last_seen_at)}
                    </p>
                    <p>
                      <strong>Dedupe key:</strong>{" "}
                      <span className="break-all">{selectedItem.dedupe_key}</span>
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  <div>
                    <p className="text-sm font-semibold mb-1">Summary excerpt</p>
                    <p className="text-sm text-gray-700">
                      {selectedItem.summary_excerpt ||
                        "No normalized summary excerpt is available yet."}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold mb-1">Source URL</p>
                    <a
                      href={selectedItem.canonical_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-blue-700 break-all underline"
                    >
                      {selectedItem.canonical_url}
                    </a>
                  </div>

                  {selectedItem.review_notes ? (
                    <div>
                      <p className="text-sm font-semibold mb-1">Review notes</p>
                      <p className="text-sm text-gray-700 whitespace-pre-line">
                        {selectedItem.review_notes}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              <CurrentAdministrationReviewPanel
                item={selectedItem}
                draft={draft}
                aiReview={aiReview}
              />
            </>
          ) : (
            <div className="border rounded-2xl p-6 bg-white">
              <h2 className="text-xl font-semibold">No staged item selected</h2>
              <p className="text-gray-700 mt-2">
                Choose a staged item from the current status queue to review its
                normalized fields and promotion draft.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
