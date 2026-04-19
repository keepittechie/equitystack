"use client";

import { useState } from "react";
import { sendPublicFeedback } from "@/lib/public-signals-client";

export default function HelpfulFeedback({
  pagePath,
  routeKind,
  entityType,
  entityKey,
  title = "Was this helpful?",
}) {
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("idle");

  async function submit(helpful) {
    setSelected(helpful);
    setStatus("submitting");

    try {
      await sendPublicFeedback({
        page_path: pagePath,
        route_kind: routeKind,
        entity_type: entityType,
        entity_key: entityKey,
        helpful,
        notes: notes.trim() || null,
      });
      setStatus("submitted");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="card-surface p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-[var(--ink-soft)] mt-2">
        Tell us whether this page helped, and optionally leave a short note.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => submit(true)}
          disabled={status === "submitting" || status === "submitted"}
          className={`rounded-full border px-4 py-2 text-sm font-medium ${
            selected === true
              ? "border-[var(--accent)] bg-[var(--accent)] text-white"
              : "border-[var(--line-strong)] bg-white"
          }`}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => submit(false)}
          disabled={status === "submitting" || status === "submitted"}
          className={`rounded-full border px-4 py-2 text-sm font-medium ${
            selected === false
              ? "border-[var(--accent)] bg-[var(--accent)] text-white"
              : "border-[var(--line-strong)] bg-white"
          }`}
        >
          No
        </button>
      </div>

      <label className="block mt-4">
        <span className="text-sm font-medium">Optional feedback</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="What was useful, confusing, or missing?"
          className="public-field mt-2"
          disabled={status === "submitted"}
        />
      </label>

      <p className="text-sm text-[var(--ink-soft)] mt-3" aria-live="polite">
        {status === "submitted"
          ? "Thanks. Your feedback was recorded."
          : status === "error"
            ? "Feedback could not be submitted right now."
            : "Responses are lightweight and do not require an account."}
      </p>
    </section>
  );
}
