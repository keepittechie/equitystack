"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const RELATIONSHIP_OPTIONS = [
  { value: "expands", label: "Expands" },
  { value: "restricts", label: "Restricts" },
  { value: "replaces", label: "Replaces" },
  { value: "responds_to", label: "Responds To" },
  { value: "enables", label: "Enables" },
  { value: "undermines", label: "Undermines" },
];

export default function SuggestedRelationshipsPanel({
  policyId,
  suggestedRelationships,
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState(null);
  const [message, setMessage] = useState("");
  const [relationshipTypes, setRelationshipTypes] = useState(() =>
    Object.fromEntries(
      suggestedRelationships.map((item) => [item.id, "responds_to"])
    )
  );
  const [isPending, startTransition] = useTransition();

  async function createRelationship(relatedPolicyId) {
    setPendingId(relatedPolicyId);
    setMessage("");

    try {
      const res = await fetch(`/api/policies/${policyId}/relationships`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          related_policy_id: relatedPolicyId,
          relationship_type: relationshipTypes[relatedPolicyId] || "responds_to",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create relationship");
      }

      setMessage("Relationship created.");

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setMessage(error.message || "Something went wrong.");
    } finally {
      setPendingId(null);
    }
  }

  function updateType(relatedPolicyId, value) {
    setRelationshipTypes((prev) => ({
      ...prev,
      [relatedPolicyId]: value,
    }));
  }

  if (!suggestedRelationships || suggestedRelationships.length === 0) {
    return null;
  }

  return (
    <section className="border rounded-2xl p-5 bg-white shadow-sm">
      <h2 className="text-xl font-semibold mb-2">Review Suggested Relationships</h2>
      <p className="text-sm text-gray-600 mb-4">
        These suggestions are generated from shared categories, era, and proximity in time. Review them before creating permanent relationships.
      </p>

      {message ? (
        <div className="mb-4 rounded-xl border bg-gray-50 px-4 py-3 text-sm text-gray-700">
          {message}
        </div>
      ) : null}

      <div className="space-y-3">
        {suggestedRelationships.map((suggested) => (
          <div key={suggested.id} className="border rounded-xl p-4 bg-gray-50">
            <Link
              href={`/policies/${suggested.id}`}
              className="text-lg font-semibold underline"
            >
              {suggested.title}
            </Link>

            <p className="text-sm text-gray-600 mt-1">
              {suggested.year_enacted} {" • "}
              {suggested.policy_type} {" • "}
              {suggested.primary_party || "Unknown party"}
            </p>

            <p className="text-sm text-gray-600">
              {suggested.era || "Unknown era"} {" • "}
              {suggested.impact_direction}
            </p>

            <p className="mt-2 text-sm text-gray-700">
              <strong>Shared Categories:</strong> {suggested.shared_category_count}
              {" • "}
              <strong>Year Distance:</strong> {suggested.year_distance}
            </p>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <select
                value={relationshipTypes[suggested.id] || "responds_to"}
                onChange={(e) => updateType(suggested.id, e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm bg-white"
                disabled={pendingId === suggested.id || isPending}
              >
                {RELATIONSHIP_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => createRelationship(suggested.id)}
                disabled={pendingId === suggested.id || isPending}
                className="px-4 py-2 rounded-lg bg-black text-white text-sm font-medium disabled:opacity-50"
              >
                {pendingId === suggested.id ? "Saving..." : "Create Relationship"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
