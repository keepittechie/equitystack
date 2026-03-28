"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

const REVIEW_ACTIONS = [
  { label: "Approve", status: "approved" },
  { label: "Reject", status: "rejected" },
  { label: "Return to Pending", status: "pending_review" },
];

function formatTimestamp(value) {
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

export default function CurrentAdministrationReviewPanel({
  item,
  draft,
  aiReview,
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [reviewNotes, setReviewNotes] = useState(item.review_notes || "");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedExistingPromiseId =
    draft?.match_assessment?.selected_existing_promise_id != null
      ? String(draft.match_assessment.selected_existing_promise_id)
      : "new";

  function updateQuery(nextExistingPromiseId) {
    const params = new URLSearchParams(searchParams.toString());
    if (!nextExistingPromiseId || nextExistingPromiseId === "new") {
      params.delete("existing_promise_id");
    } else {
      params.set("existing_promise_id", nextExistingPromiseId);
    }
    router.push(`?${params.toString()}`);
  }

  async function generateAiReview() {
    setMessage("");
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/admin/current-administration-staging/${item.id}/ai-review`,
          {
            method: "POST",
          }
        );

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Failed to generate AI review");
        }

        const status = payload.review?.generation_status || "completed";
        setMessage(
          status === "completed"
            ? "AI review refreshed."
            : "AI review assistant was unavailable. Human review can continue."
        );
        router.refresh();
      } catch (error) {
        setMessage(error.message);
      }
    });
  }

  async function mutateReviewStatus(status) {
    setMessage("");
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/admin/current-administration-staging/${item.id}/status`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              status,
              review_notes: reviewNotes,
            }),
          }
        );

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Failed to update status");
        }

        setMessage(`Review status updated to ${payload.item.review_status}.`);
        router.refresh();
      } catch (error) {
        setMessage(error.message);
      }
    });
  }

  async function promoteItem() {
    setMessage("");
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/admin/current-administration-staging/${item.id}/promote`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              existing_promise_id:
                selectedExistingPromiseId === "new"
                  ? null
                  : Number(selectedExistingPromiseId),
              review_notes: reviewNotes,
            }),
          }
        );

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Failed to promote staged item");
        }

        setMessage(
          `Promoted to promise #${payload.item.promoted_promise_id} and action #${payload.item.promoted_action_id}.`
        );
        router.refresh();
      } catch (error) {
        setMessage(error.message);
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="border rounded-2xl p-5 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold">AI Review Assistant</h2>
            <p className="text-sm text-gray-700 mt-1">
              Advisory only. Human approval is still required before promotion.
            </p>
          </div>
          <button
            type="button"
            onClick={generateAiReview}
            disabled={isPending}
            className="rounded-full border px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {aiReview ? "Refresh AI Review" : "Generate AI Review"}
          </button>
        </div>

        {!aiReview ? (
          <p className="text-sm text-gray-600 mt-4">
            No AI review has been generated for this staged item yet.
          </p>
        ) : (
          <div className="space-y-4 mt-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full border px-3 py-1 uppercase tracking-wide">
                {aiReview.generation_status.replace(/_/g, " ")}
              </span>
              <span className="rounded-full border px-3 py-1">
                Model: {aiReview.model_name}
              </span>
              <span className="rounded-full border px-3 py-1">
                Generated: {formatTimestamp(aiReview.generated_at)}
              </span>
            </div>

            {aiReview.error_message ? (
              <div className="rounded-xl border p-4 text-sm text-gray-700">
                <p className="font-medium">AI review status</p>
                <p className="mt-2">{aiReview.error_message}</p>
              </div>
            ) : null}

            {aiReview.generation_status === "completed" ? (
              <>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border p-4">
                    <h3 className="font-semibold mb-2">Classification</h3>
                    <div className="space-y-2 text-sm text-gray-700">
                      <p>
                        <strong>Relevance:</strong>{" "}
                        {aiReview.relevance_assessment || "Unavailable"}
                      </p>
                      <p>
                        <strong>Promise type:</strong>{" "}
                        {aiReview.promise_type_suggestion || "Unavailable"}
                      </p>
                      <p>
                        <strong>Campaign or official:</strong>{" "}
                        {aiReview.campaign_or_official_suggestion || "Unavailable"}
                      </p>
                      <p>
                        <strong>Action type:</strong>{" "}
                        {aiReview.action_type_suggestion || "Unavailable"}
                      </p>
                      <p>
                        <strong>Status suggestion:</strong>{" "}
                        {aiReview.status_suggestion || "Unavailable"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border p-4">
                    <h3 className="font-semibold mb-2">Record Shape</h3>
                    <div className="space-y-2 text-sm text-gray-700">
                      <p>
                        <strong>New vs update:</strong>{" "}
                        {aiReview.new_vs_update_suggestion || "Unavailable"}
                      </p>
                      <p>
                        <strong>Suggested existing promise:</strong>{" "}
                        {aiReview.suggested_existing_promise_id
                          ? `#${aiReview.suggested_existing_promise_id}`
                          : "None"}
                      </p>
                      <p>
                        <strong>Confidence:</strong>{" "}
                        {aiReview.confidence_level || "Unavailable"}
                      </p>
                      <p>
                        <strong>Mission scope:</strong>{" "}
                        {aiReview.mission_scope || "Unavailable"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border p-4">
                  <h3 className="font-semibold mb-2">Editorial Cleanup</h3>
                  <div className="space-y-2 text-sm text-gray-700">
                    <p>
                      <strong>Suggested title:</strong>{" "}
                      {aiReview.suggested_title || "Unavailable"}
                    </p>
                    <p>
                      <strong>Suggested summary:</strong>{" "}
                      {aiReview.suggested_summary || "Unavailable"}
                    </p>
                    <p>
                      <strong>Relevance note:</strong>{" "}
                      {aiReview.relevance_reason || "Unavailable"}
                    </p>
                  </div>
                </div>

                {(aiReview.editorial_flags.length > 0 ||
                  aiReview.caution_notes.length > 0) ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border p-4">
                      <h3 className="font-semibold mb-2">Editorial Flags</h3>
                      {aiReview.editorial_flags.length ? (
                        <div className="flex flex-wrap gap-2">
                          {aiReview.editorial_flags.map((flag) => (
                            <span
                              key={flag}
                              className="rounded-full border px-3 py-1 text-xs"
                            >
                              {flag}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600">
                          No editorial flags were returned.
                        </p>
                      )}
                    </div>

                    <div className="rounded-xl border p-4">
                      <h3 className="font-semibold mb-2">Caution Notes</h3>
                      {aiReview.caution_notes.length ? (
                        <div className="space-y-2 text-sm text-gray-700">
                          {aiReview.caution_notes.map((note) => (
                            <p key={note}>- {note}</p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600">
                          No caution notes were returned.
                        </p>
                      )}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        )}
      </section>

      <section className="border rounded-2xl p-5 bg-white shadow-sm">
        <h2 className="text-lg font-semibold mb-3">Review Actions</h2>
        <div className="space-y-3">
          <label className="block text-sm font-medium">
            Review notes
            <textarea
              value={reviewNotes}
              onChange={(event) => setReviewNotes(event.target.value)}
              className="mt-1 w-full border rounded-lg px-3 py-2 min-h-28"
              placeholder="Optional operator notes"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {REVIEW_ACTIONS.map((action) => (
              <button
                key={action.status}
                type="button"
                onClick={() => mutateReviewStatus(action.status)}
                disabled={isPending}
                className="rounded-full border px-4 py-2 text-sm font-medium disabled:opacity-60"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="border rounded-2xl p-5 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-semibold">Promotion Draft</h2>
          <span className="rounded-full border px-3 py-1 text-xs">
            {draft?.match_assessment?.type === "update_candidate"
              ? "Update candidate"
              : "New record candidate"}
          </span>
        </div>

        <p className="text-sm text-gray-700 mt-3">
          {draft?.match_assessment?.summary}
        </p>

        {draft?.match_assessment?.possible_matches?.length ? (
          <div className="mt-4">
            <label className="block text-sm font-medium mb-1">
              Promotion target
            </label>
            <select
              value={selectedExistingPromiseId}
              onChange={(event) => updateQuery(event.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="new">Create new Promise Tracker record</option>
              {draft.match_assessment.possible_matches.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.title} ({candidate.match_reason})
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2 mt-5">
          <div className="rounded-xl border p-4">
            <h3 className="font-semibold mb-2">Promise</h3>
            {draft?.existing_promise ? (
              <div className="space-y-2 text-sm text-gray-700">
                <p><strong>Mode:</strong> Attach to existing record</p>
                <p><strong>Title:</strong> {draft.existing_promise.title}</p>
                <p><strong>Status:</strong> {draft.existing_promise.status}</p>
                <p><strong>Reason:</strong> {draft.existing_promise.match_reason}</p>
              </div>
            ) : (
              <div className="space-y-2 text-sm text-gray-700">
                <p><strong>Mode:</strong> Create new record shell</p>
                <p><strong>Title:</strong> {draft?.draft_promise?.title}</p>
                <p><strong>Status:</strong> {draft?.draft_promise?.status}</p>
                <p><strong>Type:</strong> {draft?.draft_promise?.promise_type}</p>
                <p><strong>Date:</strong> {draft?.draft_promise?.promise_date || "Unavailable"}</p>
              </div>
            )}
          </div>

          <div className="rounded-xl border p-4">
            <h3 className="font-semibold mb-2">Action + Source</h3>
            <div className="space-y-2 text-sm text-gray-700">
              <p><strong>Action type:</strong> {draft?.draft_action?.action_type}</p>
              <p><strong>Action title:</strong> {draft?.draft_action?.title}</p>
              <p><strong>Source linkage:</strong> {draft?.source_linkage?.existing_source ? "Reuse existing source" : "Create new source"}</p>
              <p><strong>Source URL:</strong> {draft?.source_linkage?.existing_source?.source_url || draft?.source_linkage?.proposed_source?.source_url}</p>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <button
            type="button"
            onClick={promoteItem}
            disabled={isPending || item.review_status !== "approved"}
            className="rounded-full border bg-black text-white px-5 py-2 text-sm font-medium disabled:opacity-60"
          >
            Promote Approved Item
          </button>
          {item.review_status !== "approved" ? (
            <p className="text-xs text-gray-600 mt-2">
              Only approved staged items can be promoted.
            </p>
          ) : null}

          {item.promoted_promise_id ? (
            <div className="mt-4">
              <Link
                href={`/admin/promises/${item.promoted_promise_id}`}
                className="inline-flex rounded-full border px-4 py-2 text-sm font-medium"
              >
                Open Enrichment Editor
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      {message ? (
        <p className="text-sm text-gray-700">{message}</p>
      ) : null}
    </div>
  );
}
