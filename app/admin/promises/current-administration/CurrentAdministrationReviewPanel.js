"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

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

  return (
    <div className="space-y-6">
      <section className="border rounded-2xl p-5 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold">Staging AI Review</h2>
            <p className="text-sm text-gray-700 mt-1">
              Historical staging-only AI notes can still be viewed here, but the canonical
              current-admin AI review now runs through the Python artifact pipeline.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 mt-4">
          This staging AI generator is deprecated.
          Use the Python current-admin workflow to generate canonical review artifacts, decision logs,
          and feedback summaries. This page is now a legacy intake browser only. Review, finalize,
          pre-commit, and import must run through the canonical current-admin admin pages or CLI.
        </div>

        {!aiReview ? (
          <p className="text-sm text-gray-600 mt-4">
            No legacy staging AI review is stored for this staged item.
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
        <h2 className="text-lg font-semibold mb-3">Canonical Workflow Handoff</h2>
        <div className="space-y-3">
          <div className="rounded-xl border p-4 bg-gray-50 text-sm text-gray-700">
            <p>
              Current staging status: <strong>{item.review_status.replace(/_/g, " ")}</strong>
            </p>
            <p className="mt-2">
              Direct staging approval and promotion are disabled here so the web admin cannot bypass
              the canonical artifact workflow, decision logs, pre-commit, or dry-run import.
            </p>
          </div>

          <label className="block text-sm font-medium">
            Legacy review notes
            <textarea
              value={reviewNotes}
              onChange={(event) => setReviewNotes(event.target.value)}
              className="mt-1 w-full border rounded-lg px-3 py-2 min-h-28"
              placeholder="Local notes for this legacy staging view"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <Link href="/admin/current-admin-review" className="rounded-full border px-4 py-2 text-sm font-medium">
              Open Current Admin Review
            </Link>
            <Link href="/admin/pre-commit" className="rounded-full border px-4 py-2 text-sm font-medium">
              Open Pre-Commit Status
            </Link>
            <Link href="/admin/import-history" className="rounded-full border px-4 py-2 text-sm font-medium">
              Open Import History
            </Link>
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

        <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          Direct promotion from this staging page has been disabled. Use the canonical current-admin
          review, finalize, pre-commit, and import flow so promotion remains tied to the real pipeline state.
        </div>

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
      </section>
    </div>
  );
}
