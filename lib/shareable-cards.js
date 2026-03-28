import { fetchInternalJson } from "@/lib/api";
import { PUBLIC_REVALIDATE_SECONDS, withRevalidate } from "@/lib/cache";
import {
  buildExplainerCardHref,
  buildFutureBillCardHref,
  buildFutureBillCardSlug,
  buildPolicyCardHref,
  buildPromiseCardHref,
  parseTrailingId,
} from "@/lib/shareable-card-links";

function dedupeSources(items = []) {
  const seen = new Set();

  return items.filter((item) => {
    const key = JSON.stringify([
      item?.title || "",
      item?.url || "",
      item?.publisher || "",
      item?.date || "",
    ]);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function normalizeSource(item) {
  if (!item) return null;

  return {
    title: item.source_title || item.title || "Untitled source",
    url: item.source_url || item.url || null,
    publisher: item.publisher || null,
    type: item.source_type || item.type || null,
    date: item.published_date || item.date || null,
    notes: item.notes || null,
  };
}

function formatDate(dateString) {
  if (!dateString) return null;

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getFutureBillSummary(bill) {
  return (
    bill.problem_statement ||
    bill.proposed_solution ||
    bill.target_area ||
    "A tracked future-facing bill idea in EquityStack."
  );
}

function getPromiseImpactSummary(promise) {
  const outcomes = Array.isArray(promise?.outcomes) ? promise.outcomes : [];
  const directions = [...new Set(outcomes.map((item) => item?.impact_direction).filter(Boolean))];

  if (!directions.length) {
    return promise.summary || "This promise record is tracked with actions, outcomes, and sources.";
  }

  return `Documented outcome directions: ${directions.join(", ")}.`;
}

export async function getFutureBillCard(slug) {
  const bills = await fetchInternalJson("/api/future-bills", {
    ...withRevalidate(PUBLIC_REVALIDATE_SECONDS),
    errorMessage: "Failed to fetch future bills",
  });

  const bill = (bills || []).find((item) => buildFutureBillCardSlug(item) === slug);

  if (!bill) {
    return null;
  }

  const trackedBills = Array.isArray(bill.tracked_bills) ? bill.tracked_bills : [];
  const sources = dedupeSources(
    trackedBills.flatMap((trackedBill) => {
      const items = [];

      if (trackedBill.url) {
        items.push(
          normalizeSource({
            source_title: trackedBill.bill_number
              ? `${trackedBill.bill_number}: ${trackedBill.title}`
              : trackedBill.title,
            source_url: trackedBill.url,
            source_type: trackedBill.source_system || "Legislative",
            publisher: trackedBill.jurisdiction || null,
            published_date: trackedBill.date || trackedBill.introduced_date || null,
          })
        );
      }

      for (const action of trackedBill.actions || []) {
        if (!action?.source_url) continue;
        items.push(
          normalizeSource({
            source_title: action.text || `${trackedBill.bill_number} action`,
            source_url: action.source_url,
            source_type: action.type || "Action",
            publisher: trackedBill.jurisdiction || null,
            published_date: action.date || null,
          })
        );
      }

      return items.filter(Boolean);
    })
  );

  return {
    kind: "future-bill",
    title: bill.title,
    category: "Future Bill",
    summary: getFutureBillSummary(bill),
    sharePath: buildFutureBillCardHref(bill),
    canonicalPath: buildFutureBillCardHref(bill),
    impactContext:
      bill.target_area || bill.problem_statement
        ? `This proposal targets ${bill.target_area || "a tracked area of concern"} and is framed around the unresolved harm or gap described below.`
        : null,
    keyData: [
      { label: "Priority", value: bill.priority_level || "Unspecified" },
      { label: "Status", value: bill.status || "Unspecified" },
      { label: "Target Area", value: bill.target_area || "Not specified" },
      { label: "Linked Bills", value: String(trackedBills.length) },
      { label: "Linked Explainers", value: String((bill.related_explainers || []).length) },
    ],
    sections: [
      {
        title: "Problem",
        body: bill.problem_statement || "No problem statement has been added yet.",
      },
      {
        title: "Proposed Solution",
        body: bill.proposed_solution || "No proposed solution has been added yet.",
      },
    ],
    linkedRecords: trackedBills.map((trackedBill) => ({
      title: trackedBill.bill_number
        ? `${trackedBill.bill_number} · ${trackedBill.title}`
        : trackedBill.title,
      detail: [
        trackedBill.status || null,
        trackedBill.jurisdiction || null,
        trackedBill.sponsor || null,
        formatDate(trackedBill.date || trackedBill.introduced_date),
      ]
        .filter(Boolean)
        .join(" • "),
    })),
    sources,
  };
}

export async function getPolicyCard(slug) {
  const id = parseTrailingId(slug);

  if (!id) {
    return null;
  }

  const policy = await fetchInternalJson(`/api/policies/${id}`, {
    ...withRevalidate(PUBLIC_REVALIDATE_SECONDS),
    allow404: true,
    errorMessage: "Failed to fetch policy",
  });

  if (!policy) {
    return null;
  }

  return {
    kind: "policy",
    title: policy.title,
    category: policy.policy_type || "Policy",
    summary: policy.summary || policy.outcome_summary || "No summary is available yet.",
    sharePath: buildPolicyCardHref(policy),
    canonicalPath: buildPolicyCardHref(policy),
    impactContext:
      policy.outcome_summary ||
      (policy.impact_direction ? `${policy.impact_direction} impact record.` : null),
    keyData: [
      { label: "Year", value: String(policy.year_enacted || "Unknown") },
      { label: "Impact", value: policy.impact_direction || "Unscored" },
      { label: "Status", value: policy.status || "Unknown" },
      { label: "Party", value: policy.primary_party || "Unknown" },
      { label: "Era", value: policy.era || "Unknown" },
    ],
    sections: [
      {
        title: "What This Policy Did",
        body: policy.outcome_summary || policy.summary || "No outcome summary is available yet.",
      },
    ],
    linkedRecords: (policy.related_future_bills || []).map((bill) => ({
      title: bill.title,
      detail: [
        bill.priority_level || null,
        bill.status || null,
        `${(bill.tracked_bills || []).length} linked bills`,
      ]
        .filter(Boolean)
        .join(" • "),
    })),
    sources: dedupeSources((policy.sources || []).map(normalizeSource).filter(Boolean)),
  };
}

export async function getPromiseCard(slug) {
  const promise = await fetchInternalJson(`/api/promises/${slug}`, {
    ...withRevalidate(PUBLIC_REVALIDATE_SECONDS),
    allow404: true,
    errorMessage: "Failed to fetch promise",
  });

  if (!promise) {
    return null;
  }

  const sources = dedupeSources([
    ...(promise.sources || []).map(normalizeSource),
    ...((promise.actions || []).flatMap((action) => (action.action_sources || []).map(normalizeSource))),
    ...((promise.outcomes || []).flatMap((outcome) => (outcome.outcome_sources || []).map(normalizeSource))),
  ].filter(Boolean));

  return {
    kind: "promise",
    title: promise.title,
    category: "Promise",
    summary: promise.summary || promise.promise_text || "No summary is available yet.",
    sharePath: buildPromiseCardHref(promise),
    canonicalPath: buildPromiseCardHref(promise),
    impactContext: getPromiseImpactSummary(promise),
    keyData: [
      { label: "President", value: promise.president || "Unknown" },
      { label: "Status", value: promise.status || "Unknown" },
      { label: "Topic", value: promise.topic || "Unspecified" },
      { label: "Actions", value: String((promise.actions || []).length) },
      { label: "Outcomes", value: String((promise.outcomes || []).length) },
    ],
    sections: [
      {
        title: "Promise Text",
        body: promise.promise_text || promise.summary || "No promise text is available yet.",
      },
    ],
    linkedRecords: [
      ...((promise.related_policies || []).map((policy) => ({
        title: policy.title,
        detail: ["Policy", policy.policy_type || null].filter(Boolean).join(" • "),
      }))),
      ...((promise.related_explainers || []).map((explainer) => ({
        title: explainer.title,
        detail: ["Explainer", explainer.category || null].filter(Boolean).join(" • "),
      }))),
    ],
    sources,
  };
}

export async function getExplainerCard(slug) {
  const explainer = await fetchInternalJson(`/api/explainers/${slug}`, {
    ...withRevalidate(PUBLIC_REVALIDATE_SECONDS),
    allow404: true,
    errorMessage: "Failed to fetch explainer",
  });

  if (!explainer) {
    return null;
  }

  return {
    kind: "explainer",
    title: explainer.title,
    category: explainer.category || "Explainer",
    summary: explainer.summary || "No summary is available yet.",
    sharePath: buildExplainerCardHref(explainer),
    canonicalPath: buildExplainerCardHref(explainer),
    impactContext:
      explainer.why_it_matters || explainer.why_it_still_matters || explainer.sources_note || null,
    keyData: [
      { label: "Category", value: explainer.category || "Explainer" },
      { label: "Policies", value: String((explainer.related_policies || []).length) },
      { label: "Future Bills", value: String((explainer.related_future_bills || []).length) },
      { label: "Promises", value: String((explainer.related_promises || []).length) },
      { label: "Sources", value: String((explainer.sources || []).length) },
    ],
    sections: [
      {
        title: "Why This Matters",
        body:
          explainer.why_it_matters ||
          explainer.summary ||
          explainer.why_it_still_matters ||
          "No explanation summary is available yet.",
      },
    ],
    linkedRecords: [
      ...((explainer.related_policies || []).map((policy) => ({
        title: policy.title,
        detail: ["Policy", policy.policy_type || null, policy.year_enacted || null]
          .filter(Boolean)
          .join(" • "),
      }))),
      ...((explainer.related_future_bills || []).map((bill) => ({
        title: bill.title,
        detail: ["Future Bill", bill.priority_level || null, bill.status || null]
          .filter(Boolean)
          .join(" • "),
      }))),
    ],
    sources: dedupeSources((explainer.sources || []).map(normalizeSource).filter(Boolean)),
  };
}
