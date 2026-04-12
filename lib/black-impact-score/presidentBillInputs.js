import { buildPublicBillsDataset } from "@/lib/public-bills";
import { getFutureBills } from "@/lib/shareable-cards";

const PROMISE_RELATIONSHIP_WEIGHTS = {
  explicit_link: 1,
  explainer_context: 1,
  promise_link: 1,
  policy_lineage: 0.85,
};

const BILL_CONFIDENCE_WEIGHTS = {
  High: 1,
  Medium: 0.85,
  Low: 0.7,
};

const BILL_PROGRESS_WEIGHTS = {
  Enacted: 1.1,
  "Passed House": 1.05,
  "Passed Senate": 1.05,
  Introduced: 0.95,
  Failed: 0.85,
  Stalled: 0.85,
};

const BILL_INPUT_METHOD = "bill_to_promise_to_president_v1";
const MAX_BILL_BLEND_WEIGHT = 0.22;

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function round(value, digits = 2) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Number(numeric.toFixed(digits));
}

function uniqueCount(values = []) {
  return new Set(values.filter(Boolean)).size;
}

function getPromiseRelationshipWeight(type) {
  return PROMISE_RELATIONSHIP_WEIGHTS[type] || 0.75;
}

function getBillConfidenceWeight(label) {
  return BILL_CONFIDENCE_WEIGHTS[label] || 0.7;
}

function getBillProgressWeight(status) {
  return BILL_PROGRESS_WEIGHTS[status] || 1;
}

function buildEmptyBillImpactInput({ presidentSlug = null, presidentName = null } = {}) {
  return {
    president_slug: presidentSlug,
    president_name: presidentName,
    linked_bill_count: 0,
    linked_bill_score_sum: 0,
    linked_bill_score_avg: 0,
    linked_bill_score_weighted: 0,
    linked_positive_bill_count: 0,
    linked_mixed_bill_count: 0,
    linked_negative_bill_count: 0,
    linked_bill_confidence_summary: { High: 0, Medium: 0, Low: 0 },
    linked_bill_relationship_types: {},
    linked_bill_domains: [],
    linked_promises_with_bill_support: 0,
    bill_input_method: BILL_INPUT_METHOD,
    bill_blend_weight: 0,
    bill_blend_weight_pct: 0,
    bill_blended_score: 0,
    bill_influence_label: "No bill-linked inputs",
    bill_blend_components: {
      coverage_factor: 0,
      confidence_mix_factor: 0,
      promise_diversity_factor: 0,
    },
    top_linked_bills: [],
  };
}

function createPresidentBucket({ presidentSlug = null, presidentName = null } = {}) {
  return {
    president_slug: presidentSlug,
    president_name: presidentName,
    linked_bill_keys: new Set(),
    linked_promise_keys: new Set(),
    linked_bill_score_sum: 0,
    linked_bill_weighted_sum: 0,
    linked_bill_weight_total: 0,
    linked_positive_bill_count: 0,
    linked_mixed_bill_count: 0,
    linked_negative_bill_count: 0,
    linked_bill_confidence_summary: { High: 0, Medium: 0, Low: 0 },
    linked_bill_relationship_types: {},
    linked_bill_domains: new Map(),
    top_linked_bills: [],
  };
}

function getConfidenceMixFactor(summary = {}) {
  const high = Number(summary.High || 0);
  const medium = Number(summary.Medium || 0);
  const low = Number(summary.Low || 0);
  const total = high + medium + low;

  if (!total) {
    return 0;
  }

  return (high * 1 + medium * 0.8 + low * 0.55) / total;
}

function getCoverageFactor(linkedBillCount) {
  if (linkedBillCount >= 4) return 1;
  if (linkedBillCount === 3) return 0.82;
  if (linkedBillCount === 2) return 0.64;
  if (linkedBillCount === 1) return 0.4;
  return 0;
}

function getPromiseDiversityFactor(linkedBillCount, linkedPromiseCount) {
  if (!linkedBillCount || !linkedPromiseCount) {
    return 0;
  }

  return Math.max(Math.min(linkedPromiseCount / linkedBillCount, 1), 0.65);
}

function buildBillInfluenceLabel(weight) {
  if (weight >= 0.14) {
    return "Meaningful bill-linked influence";
  }

  if (weight >= 0.08) {
    return "Moderate bill-linked influence";
  }

  if (weight > 0) {
    return "Light bill-linked influence";
  }

  return "No bill-linked inputs";
}

export function computePresidentBillBlend(billInputs = {}) {
  const linkedBillCount = Number(billInputs.linked_bill_count || 0);
  const linkedPromiseCount = Number(billInputs.linked_promises_with_bill_support || 0);

  if (!linkedBillCount) {
    return {
      bill_blend_weight: 0,
      bill_blend_weight_pct: 0,
      bill_blended_score: 0,
      bill_influence_label: "No bill-linked inputs",
      bill_blend_components: {
        coverage_factor: 0,
        confidence_mix_factor: 0,
        promise_diversity_factor: 0,
      },
    };
  }

  const coverageFactor = getCoverageFactor(linkedBillCount);
  const confidenceMixFactor = getConfidenceMixFactor(
    billInputs.linked_bill_confidence_summary
  );
  const promiseDiversityFactor = getPromiseDiversityFactor(
    linkedBillCount,
    linkedPromiseCount
  );
  const billBlendWeight = round(
    MAX_BILL_BLEND_WEIGHT *
      coverageFactor *
      confidenceMixFactor *
      promiseDiversityFactor,
    4
  );

  return {
    bill_blend_weight: billBlendWeight,
    bill_blend_weight_pct: round(billBlendWeight * 100),
    bill_blended_score: round(billInputs.linked_bill_score_weighted || 0),
    bill_influence_label: buildBillInfluenceLabel(billBlendWeight),
    bill_blend_components: {
      coverage_factor: round(coverageFactor, 4),
      confidence_mix_factor: round(confidenceMixFactor, 4),
      promise_diversity_factor: round(promiseDiversityFactor, 4),
    },
  };
}

function buildWeightAssessment(item = {}) {
  const linkedBillCount = Number(item.linked_bill_count || 0);
  const weight = Number(item.bill_blend_weight || 0);

  if (!linkedBillCount) {
    return "No bill-linked inputs";
  }

  if (linkedBillCount <= 1 && weight > 0.08) {
    return "Too strong";
  }

  if (linkedBillCount >= 4 && weight < 0.09) {
    return "Too weak";
  }

  return "Reasonable";
}

export function buildPresidentBillValidationSample(presidents = []) {
  const rows = Array.isArray(presidents)
    ? presidents.filter((item) => Number(item.linked_bill_count || 0) > 0)
    : [];

  if (!rows.length) {
    return [];
  }

  const strong =
    rows
      .slice()
      .sort((left, right) => {
        return (
          Number(right.linked_bill_count || 0) - Number(left.linked_bill_count || 0) ||
          Number(right.linked_promises_with_bill_support || 0) -
            Number(left.linked_promises_with_bill_support || 0) ||
          Math.abs(Number(right.linked_bill_score_weighted || 0)) -
            Math.abs(Number(left.linked_bill_score_weighted || 0))
        );
      })[0] || null;
  const thin =
    rows
      .slice()
      .sort((left, right) => {
        return (
          Number(left.linked_bill_count || 0) - Number(right.linked_bill_count || 0) ||
          Number(left.linked_promises_with_bill_support || 0) -
            Number(right.linked_promises_with_bill_support || 0) ||
          Math.abs(Number(left.linked_bill_score_weighted || 0)) -
            Math.abs(Number(right.linked_bill_score_weighted || 0))
        );
      })
      .find((item) => item !== strong) || null;
  const moderate =
    rows.find(
      (item) =>
        Number(item.linked_bill_count || 0) >= 2 &&
        Number(item.linked_bill_count || 0) <= 3 &&
        item !== strong &&
        item !== thin
    ) ||
    rows.find((item) => item !== strong && item !== thin) ||
    null;

  return [
    { bucket: "strong", item: strong },
    { bucket: "moderate", item: moderate },
    { bucket: "thin", item: thin },
  ]
    .filter((entry) => entry.item)
    .map(({ bucket, item }) => ({
      sample_bucket: bucket,
      president_slug: item.president_slug || item.slug || null,
      president_name: item.president || item.name || null,
      current_headline_score: round(item.normalized_score_total ?? item.score ?? 0),
      outcome_based_score: round(item.direct_normalized_score ?? item.score ?? 0),
      bill_informed_score: round(item.linked_bill_score_weighted || 0),
      linked_bill_count: Number(item.linked_bill_count || 0),
      linked_promises: Number(item.linked_promises_with_bill_support || 0),
      bill_blend_weight_pct: round(item.bill_blend_weight_pct || 0),
      relationship_strengths: item.linked_bill_relationship_types || {},
      top_linked_bills: (item.top_linked_bills || []).slice(0, 3).map((bill) => ({
        bill_number: bill.billNumber,
        title: bill.title,
        relationship_type: bill.relationshipType,
        impact_confidence: bill.impactConfidence,
      })),
      join_assessment:
        Number(item.linked_promises_with_bill_support || 0) <
        Number(item.linked_bill_count || 0) / 2
          ? "Watch clustered promise linkage"
          : "Joins look bounded",
      weight_assessment: buildWeightAssessment(item),
    }));
}

function getPresidentPromiseGroups(bill = {}) {
  const groups = new Map();

  for (const promise of bill.relatedPromises || []) {
    const presidentKey = promise.presidentSlug || promise.presidentName;
    if (!presidentKey) {
      continue;
    }

    if (!groups.has(presidentKey)) {
      groups.set(presidentKey, {
        president_slug: promise.presidentSlug || null,
        president_name: promise.presidentName || null,
        relationshipType: promise.relationshipType || "policy_lineage",
        promiseKeys: new Set(),
      });
    }

    const group = groups.get(presidentKey);
    group.president_slug = group.president_slug || promise.presidentSlug || null;
    group.president_name = group.president_name || promise.presidentName || null;

    if (
      getPromiseRelationshipWeight(promise.relationshipType) >
      getPromiseRelationshipWeight(group.relationshipType)
    ) {
      group.relationshipType = promise.relationshipType;
    }

    group.promiseKeys.add(promise.id || promise.slug || promise.title);
  }

  return [...groups.values()];
}

function addDomainContribution(domainMap, domain, score) {
  const key = domain || "Uncategorized";

  if (!domainMap.has(key)) {
    domainMap.set(key, {
      domain: key,
      count: 0,
      score_sum: 0,
    });
  }

  const row = domainMap.get(key);
  row.count += 1;
  row.score_sum += toNumber(score);
}

function finalizePresidentBucket(bucket) {
  const linkedBillCount = bucket.linked_bill_keys.size;
  const linkedBillScoreAvg = linkedBillCount
    ? round(bucket.linked_bill_score_sum / linkedBillCount)
    : 0;
  const linkedBillScoreWeighted = bucket.linked_bill_weight_total
    ? round(bucket.linked_bill_weighted_sum / bucket.linked_bill_weight_total)
    : 0;

  const finalized = {
    president_slug: bucket.president_slug,
    president_name: bucket.president_name,
    linked_bill_count: linkedBillCount,
    linked_bill_score_sum: round(bucket.linked_bill_score_sum),
    linked_bill_score_avg: linkedBillScoreAvg,
    linked_bill_score_weighted: linkedBillScoreWeighted,
    linked_positive_bill_count: bucket.linked_positive_bill_count,
    linked_mixed_bill_count: bucket.linked_mixed_bill_count,
    linked_negative_bill_count: bucket.linked_negative_bill_count,
    linked_bill_confidence_summary: bucket.linked_bill_confidence_summary,
    linked_bill_relationship_types: bucket.linked_bill_relationship_types,
    linked_bill_domains: [...bucket.linked_bill_domains.values()]
      .map((item) => ({
        domain: item.domain,
        count: item.count,
        avg_score: item.count ? round(item.score_sum / item.count) : 0,
      }))
      .sort((left, right) => {
        return (
          right.count - left.count ||
          Math.abs(right.avg_score) - Math.abs(left.avg_score) ||
          left.domain.localeCompare(right.domain)
        );
      })
      .slice(0, 5),
    linked_promises_with_bill_support: uniqueCount([...bucket.linked_promise_keys]),
    bill_input_method: BILL_INPUT_METHOD,
    top_linked_bills: bucket.top_linked_bills
      .slice()
      .sort((left, right) => {
        return (
          Math.abs(Number(right.weightedScore || 0)) - Math.abs(Number(left.weightedScore || 0)) ||
          Math.abs(Number(right.blackImpactScore || 0)) - Math.abs(Number(left.blackImpactScore || 0)) ||
          String(right.billNumber || "").localeCompare(String(left.billNumber || ""))
        );
      })
      .slice(0, 5),
  };

  return {
    ...finalized,
    ...computePresidentBillBlend(finalized),
  };
}

export function aggregatePresidentBillImpactInputs(bills = []) {
  const byPresident = new Map();

  for (const bill of bills) {
    const presidentGroups = getPresidentPromiseGroups(bill);

    if (!presidentGroups.length) {
      continue;
    }

    for (const group of presidentGroups) {
      const presidentKey = group.president_slug || group.president_name;
      const billKey = bill.slug || bill.id;

      if (!presidentKey || !billKey) {
        continue;
      }

      if (!byPresident.has(presidentKey)) {
        byPresident.set(
          presidentKey,
          createPresidentBucket({
            presidentSlug: group.president_slug,
            presidentName: group.president_name,
          })
        );
      }

      const bucket = byPresident.get(presidentKey);

      if (bucket.linked_bill_keys.has(billKey)) {
        continue;
      }

      const weight = Math.min(
        getPromiseRelationshipWeight(group.relationshipType) *
          getBillConfidenceWeight(bill.impactConfidence) *
          getBillProgressWeight(bill.status),
        1.15
      );
      const weightedContribution = toNumber(bill.blackImpactScore) * weight;
      const weightedScore = round(weightedContribution);

      bucket.linked_bill_keys.add(billKey);
      bucket.linked_bill_score_sum += toNumber(bill.blackImpactScore);
      bucket.linked_bill_weighted_sum += weightedContribution;
      bucket.linked_bill_weight_total += weight;
      bucket.linked_bill_confidence_summary[bill.impactConfidence] =
        Number(bucket.linked_bill_confidence_summary[bill.impactConfidence] || 0) + 1;
      bucket.linked_bill_relationship_types[group.relationshipType] =
        Number(bucket.linked_bill_relationship_types[group.relationshipType] || 0) + 1;

      for (const promiseKey of group.promiseKeys) {
        if (promiseKey) {
          bucket.linked_promise_keys.add(promiseKey);
        }
      }

      if (bill.impactDirection === "Positive") {
        bucket.linked_positive_bill_count += 1;
      } else if (bill.impactDirection === "Negative") {
        bucket.linked_negative_bill_count += 1;
      } else {
        bucket.linked_mixed_bill_count += 1;
      }

      addDomainContribution(bucket.linked_bill_domains, bill.primaryDomain, bill.blackImpactScore);

      bucket.top_linked_bills.push({
        id: bill.id,
        slug: bill.slug,
        detailHref: bill.detailHref,
        billNumber: bill.billNumber,
        title: bill.title,
        blackImpactScore: toNumber(bill.blackImpactScore),
        weightedScore,
        impactDirection: bill.impactDirection,
        impactConfidence: bill.impactConfidence,
        relationshipType: group.relationshipType,
        primaryDomain: bill.primaryDomain || null,
        status: bill.status || null,
        whyItMatters: bill.whyItMatters || bill.officialSummary || null,
      });
    }
  }

  const items = [...byPresident.values()].map(finalizePresidentBucket);
  const bySlug = new Map(items.map((item) => [item.president_slug || item.president_name, item]));

  return {
    items,
    bySlug,
    summary: {
      presidents_with_bill_inputs: items.length,
      linked_bill_count: items.reduce((total, item) => total + Number(item.linked_bill_count || 0), 0),
      linked_promises_with_bill_support: items.reduce(
        (total, item) => total + Number(item.linked_promises_with_bill_support || 0),
        0
      ),
      bill_input_method: BILL_INPUT_METHOD,
    },
  };
}

export async function fetchPresidentBillImpactInputs() {
  const futureBills = await getFutureBills();
  const bills = buildPublicBillsDataset(futureBills);
  return aggregatePresidentBillImpactInputs(bills);
}

export function getEmptyPresidentBillImpactInputs(president = {}) {
  return buildEmptyBillImpactInput({
    presidentSlug: president.president_slug || president.slug || null,
    presidentName: president.president || president.name || null,
  });
}
