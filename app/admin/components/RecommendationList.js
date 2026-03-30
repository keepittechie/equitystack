"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

function confidenceClasses(label) {
  if (label === "High") {
    return "border-green-300 bg-green-100 text-green-900";
  }
  if (label === "Medium") {
    return "border-amber-300 bg-amber-100 text-amber-900";
  }
  return "border-gray-300 bg-gray-100 text-gray-900";
}

function sourceLabel(source) {
  if (source === "friction") {
    return "Friction";
  }
  if (source === "analytics") {
    return "Analytics";
  }
  if (source === "workflow") {
    return "Workflow";
  }
  if (source === "trace") {
    return "Latest Trace";
  }
  return "Recommendation";
}

function scenarioClasses(label) {
  if (
    label === "Blocked action loop" ||
    label === "Repeated failure" ||
    label === "Blocked action" ||
    label === "Failed action"
  ) {
    return "border-red-300 bg-red-100 text-red-900";
  }
  if (label === "Stalled workflow" || label === "Pending approval backlog" || label === "Pending approvals") {
    return "border-amber-300 bg-amber-100 text-amber-900";
  }
  if (label === "Import-ready state" || label === "Next safe step ready" || label === "Safe to proceed") {
    return "border-green-300 bg-green-100 text-green-900";
  }
  return "border-gray-300 bg-gray-100 text-gray-900";
}

function RecommendationCard({ recommendation, onFeedback, disabled }) {
  const feedbackSummary = recommendation.feedback_summary || {};

  return (
    <div className="rounded-xl border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold">{recommendation.recommendation}</p>
        {recommendation.scenario_label ? (
          <span
            className={`rounded-full border px-2 py-0.5 text-xs ${scenarioClasses(
              recommendation.scenario_label
            )}`}
          >
            {recommendation.scenario_label}
          </span>
        ) : null}
        <span className="rounded-full border px-2 py-0.5 text-xs text-gray-700">
          {sourceLabel(recommendation.source)}
        </span>
        <span
          className={`rounded-full border px-2 py-0.5 text-xs ${
            confidenceClasses(recommendation.confidence?.label)
          }`}
        >
          {recommendation.confidence?.label || "Low"} confidence
        </span>
      </div>
      <p className="mt-2 text-gray-600">Why: {recommendation.reason}</p>
      {recommendation.evidence_summary ? (
        <p className="mt-2 text-gray-700">Evidence: {recommendation.evidence_summary}</p>
      ) : null}
      {(recommendation.supporting_signals || []).length ? (
        <div className="mt-2 text-gray-700">
          <p>Supporting signals:</p>
          <ul className="mt-1 list-disc pl-5">
            {recommendation.supporting_signals.slice(0, 3).map((signal, index) => (
              <li key={`${recommendation.id}-signal-${index}`}>{signal}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="mt-2 text-gray-700">Suggested action: {recommendation.suggested_action}</p>
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <Link href={recommendation.href} className="underline">
          Open suggested destination
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
        <span>Helpful: {feedbackSummary.helpful_count || 0}</span>
        <span>Not helpful: {feedbackSummary.not_helpful_count || 0}</span>
        <span>Dismissed: {feedbackSummary.dismissed_count || 0}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {[
          { id: "helpful", label: "Helpful" },
          { id: "not_helpful", label: "Not helpful" },
          { id: "dismissed", label: "Dismiss" },
        ].map((feedback) => (
          <button
            key={`${recommendation.id}-${feedback.id}`}
            type="button"
            onClick={() => onFeedback(recommendation.id, feedback.id)}
            disabled={disabled}
            className="rounded-full border px-3 py-1 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {feedback.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-gray-500">
        Feedback only tunes recommendation quality. It does not change workflow state, and
        dismissing a low-priority item only suppresses it temporarily.
      </p>
    </div>
  );
}

export default function RecommendationList({
  recommendations,
  emptyState,
}) {
  const [items, setItems] = useState(recommendations || []);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setItems(recommendations || []);
  }, [recommendations]);

  function handleFeedback(recommendationId, feedback) {
    setError("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/operator-recommendations/feedback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recommendationId,
            feedback,
          }),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Failed to record recommendation feedback.");
        }

        setItems((currentItems) =>
          currentItems
            .map((item) =>
              item.id === recommendationId
                ? {
                    ...item,
                    feedback_summary: payload.summary || item.feedback_summary,
                  }
                : item
            )
            .filter(
              (item) =>
                !(
                  item.id === recommendationId &&
                  feedback === "dismissed" &&
                  (item.priority || 0) < 90
                )
            )
        );
      } catch (nextError) {
        setError(nextError.message);
      }
    });
  }

  return (
    <div className="space-y-3 text-sm">
      {items.length ? (
        items.map((item) => (
          <RecommendationCard
            key={item.id}
            recommendation={item}
            onFeedback={handleFeedback}
            disabled={isPending}
          />
        ))
      ) : (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-gray-700">
          {emptyState}
        </div>
      )}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
