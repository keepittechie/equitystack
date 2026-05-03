import { readFileSync } from "fs";
import path from "path";
import { fetchPromisePageData } from "@/lib/public-site-data";
import {
  AGENDAS,
  AGENDA_ITEMS,
  AGENDA_ITEM_LINKS,
  AGENDA_SOURCE_REFS,
  getAgendaSourceRefsByKeys,
} from "@/lib/data/agendas";

export { AGENDAS, AGENDA_ITEMS, AGENDA_ITEM_LINKS, AGENDA_SOURCE_REFS };

function normalizeLabel(value) {
  return String(value || "").trim().toLowerCase();
}

function formatTitleCaseLabel(value) {
  const label = String(value || "")
    .trim()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ");

  if (!label) {
    return "Unknown";
  }

  return label.replace(/\b\w/g, (match) => match.toUpperCase());
}

function buildPromiseSourceCount(promise) {
  const promiseSources = Number((promise.promise_sources || []).length || 0);
  const actionSources = (promise.actions || []).reduce(
    (total, item) => total + Number((item.action_sources || item.sources || []).length || 0),
    0
  );
  const outcomeSources = (promise.outcomes || []).reduce(
    (total, item) => total + Number((item.outcome_sources || item.sources || []).length || 0),
    0
  );

  return promiseSources + actionSources + outcomeSources;
}

function buildPromisePreviewRecord(promise) {
  if (!promise?.slug || !promise?.title) {
    return null;
  }

  return {
    id: promise.id,
    slug: promise.slug,
    title: promise.title,
    summary: promise.summary || promise.review_summary || null,
    status: promise.status || "Unknown",
    topic: promise.topic || null,
    promise_type: promise.promise_type || null,
    president: promise.president || null,
    action_count: Number((promise.actions || []).length || 0),
    outcome_count: Number((promise.outcomes || []).length || 0),
    source_count: buildPromiseSourceCount(promise),
  };
}

function buildAgendaIndexMap(items = []) {
  return new Map(items.map((item) => [item.id, item]));
}

let cachedStaticCurrentAdminPromiseMap = null;

function readJsonFile(relativePath) {
  try {
    const absolutePath = path.join(process.cwd(), relativePath);
    return JSON.parse(readFileSync(absolutePath, "utf8"));
  } catch {
    return null;
  }
}

function getStaticCurrentAdminPromiseMap() {
  if (cachedStaticCurrentAdminPromiseMap) {
    return cachedStaticCurrentAdminPromiseMap;
  }

  const batch =
    readJsonFile("python/data/current_admin_batches/trump_2025_batch_01.json") ||
    readJsonFile("python/reports/current_admin/trump-2025-batch-01.normalized.json");

  const records = Array.isArray(batch?.records) ? batch.records : [];

  cachedStaticCurrentAdminPromiseMap = new Map(
    records
      .filter((item) => item?.slug)
      .map((item) => [String(item.slug), buildPromisePreviewRecord(item)])
      .filter(([, item]) => item)
  );

  return cachedStaticCurrentAdminPromiseMap;
}

function dedupeBy(items = [], getKey) {
  const seen = new Set();
  const results = [];

  for (const item of items) {
    const key = getKey(item);

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    results.push(item);
  }

  return results;
}

function isVerifiedAgendaLink(link) {
  return normalizeLabel(link?.review_status) === "verified";
}

export function getVerifiedAgendaItemLinks() {
  return AGENDA_ITEM_LINKS.filter((item) => isVerifiedAgendaLink(item));
}

export function getAgendaSourceRefs(sourceRefKeys = []) {
  return getAgendaSourceRefsByKeys(sourceRefKeys);
}

export function getAgendaSourceRefsForItem(agendaItemId) {
  const item = AGENDA_ITEMS.find((entry) => entry.id === agendaItemId);
  return getAgendaSourceRefs(item?.source_refs || []);
}

export function getAgendaSourceRefsForLink(linkId) {
  const link = AGENDA_ITEM_LINKS.find((entry) => entry.id === linkId);
  return getAgendaSourceRefs(link?.source_refs || []);
}

async function fetchPromisePreviewRecords(links = []) {
  const promiseSlugs = dedupeBy(
    links
      .filter((item) => item.entity_type === "promise" && item.entity_id)
      .map((item) => String(item.entity_id)),
    (item) => item
  );

  const records = await Promise.all(
    promiseSlugs.map(async (slug) => {
      try {
        const promise = await fetchPromisePageData(slug);
        if (promise) {
          return [slug, buildPromisePreviewRecord(promise)];
        }
      } catch {
        // Fall back to repository-backed current-admin artifacts when runtime data is unavailable.
      }

      return [slug, getStaticCurrentAdminPromiseMap().get(slug) || null];
    })
  );

  return new Map(records.filter(([, record]) => record));
}

function formatAgendaEntityTypeLabel(entityType) {
  const label = normalizeLabel(entityType);

  if (label === "promise") return "Promise";
  if (label === "policy") return "Policy";
  if (label === "bill") return "Bill";
  return formatTitleCaseLabel(entityType);
}

export function formatAgendaDomainLabel(domain) {
  return formatTitleCaseLabel(domain);
}

export function formatAgendaActionTypeLabel(actionType) {
  return formatTitleCaseLabel(actionType);
}

function buildEntityHref(entityType, record) {
  const label = normalizeLabel(entityType);
  const slug = String(record?.slug || "").trim();

  if (!slug) {
    return null;
  }

  if (label === "promise") return `/promises/${slug}`;
  if (label === "policy") return `/policies/${slug}`;
  if (label === "bill") return `/bills/${slug}`;
  return null;
}

function mergeLinkedPreviewRecords(items = []) {
  const previewMap = new Map();

  for (const item of items) {
    for (const link of item.linked_actions || []) {
      const record = link.record;
      const href = buildEntityHref(link.entity_type, record);
      const previewKey = `${normalizeLabel(link.entity_type)}:${record?.slug || record?.id || ""}`;

      if (!record || !previewKey || !href) {
        continue;
      }

      if (!previewMap.has(previewKey)) {
        previewMap.set(previewKey, {
          ...record,
          href,
          entity_type: normalizeLabel(link.entity_type),
          entity_type_label: formatAgendaEntityTypeLabel(link.entity_type),
          linked_agenda_items: [],
        });
      }

      previewMap.get(previewKey).linked_agenda_items.push({
        id: item.id,
        title: item.title,
        href: item.href,
        policy_domain: item.policy_domain,
        policy_domain_label: item.policy_domain_label,
        relationship: link.relationship,
        relationship_label: formatAgendaRelationshipLabel(link.relationship),
        confidence: link.confidence,
        confidence_label: formatAgendaConfidenceLabel(link.confidence),
        reasoning: link.reasoning || null,
      });
    }
  }

  return [...previewMap.values()]
    .map((record) => ({
      ...record,
      linked_agenda_items: dedupeBy(
        record.linked_agenda_items,
        (item) => `${item.id}:${item.relationship}:${item.confidence}`
      ).sort((left, right) => {
        if (left.relationship_label !== right.relationship_label) {
          return left.relationship_label.localeCompare(right.relationship_label);
        }

        return left.title.localeCompare(right.title);
      }),
    }))
    .sort((left, right) => {
      if (right.linked_agenda_items.length !== left.linked_agenda_items.length) {
        return right.linked_agenda_items.length - left.linked_agenda_items.length;
      }

      if (Number(right.action_count || 0) !== Number(left.action_count || 0)) {
        return Number(right.action_count || 0) - Number(left.action_count || 0);
      }

      return String(left.title || "").localeCompare(String(right.title || ""));
    });
}

function buildTopLinkedItems(items = [], limit = 3) {
  return [...items]
    .filter((item) => item.linked_action_count > 0)
    .sort((left, right) => {
      if (right.linked_action_count !== left.linked_action_count) {
        return right.linked_action_count - left.linked_action_count;
      }

      return String(left.title || "").localeCompare(String(right.title || ""));
    })
    .slice(0, limit);
}

export function getAgendaStatusTone(status) {
  const label = normalizeLabel(status);

  if (label === "implemented") return "verified";
  if (label === "partial") return "warning";
  if (label === "attempted") return "info";
  if (label === "rhetoric_only") return "danger";
  return "default";
}

export function formatAgendaStatusLabel(status) {
  return formatTitleCaseLabel(status);
}

export function formatAgendaRelationshipLabel(relationship) {
  if (normalizeLabel(relationship) === "aligned_with") {
    return "Aligned with";
  }

  if (normalizeLabel(relationship) === "influenced_by") {
    return "Influenced by";
  }

  return formatTitleCaseLabel(relationship);
}

export function formatAgendaConfidenceLabel(confidence) {
  return formatTitleCaseLabel(confidence);
}

export function buildAgendaItemHref(agendaSlug, agendaItemId) {
  return `/agendas/${agendaSlug}#agenda-item-${agendaItemId}`;
}

export function getAgendaBySlug(slug) {
  const agenda = AGENDAS.find((item) => item.slug === slug) || null;

  if (!agenda) {
    return null;
  }

  return {
    ...agenda,
    source_refs_resolved: getAgendaSourceRefs(agenda.source_refs || []),
  };
}

export function getAgendaReviewData(slug) {
  const agenda = getAgendaBySlug(slug);

  if (!agenda) {
    return null;
  }

  const agendaItems = AGENDA_ITEMS.filter((item) => item.agenda_id === agenda.id);
  const agendaItemIds = new Set(agendaItems.map((item) => item.id));
  const agendaLinks = AGENDA_ITEM_LINKS.filter((link) => agendaItemIds.has(link.agenda_item_id));
  const agendaSourceRefKeys = new Set(agenda.source_refs || []);
  const linksByAgendaItemId = new Map();
  const sourceUsageMap = new Map();

  function markSourceUsage(keys = [], usageType, usageId) {
    for (const key of keys) {
      if (!key) {
        continue;
      }

      if (!sourceUsageMap.has(key)) {
        sourceUsageMap.set(key, {
          agenda_ids: new Set(),
          item_ids: new Set(),
          link_ids: new Set(),
        });
      }

      const usage = sourceUsageMap.get(key);

      if (usageType === "agenda") {
        usage.agenda_ids.add(usageId);
      } else if (usageType === "item") {
        usage.item_ids.add(usageId);
      } else if (usageType === "link") {
        usage.link_ids.add(usageId);
      }
    }
  }

  for (const link of agendaLinks) {
    if (!linksByAgendaItemId.has(link.agenda_item_id)) {
      linksByAgendaItemId.set(link.agenda_item_id, []);
    }

    linksByAgendaItemId.get(link.agenda_item_id).push(link);
    for (const key of link.source_refs || []) {
      agendaSourceRefKeys.add(key);
    }
    markSourceUsage(link.source_refs || [], "link", link.id);
  }

  markSourceUsage(agenda.source_refs || [], "agenda", agenda.id);

  const items = agendaItems.map((item) => {
    const links = (linksByAgendaItemId.get(item.id) || [])
      .map((link) => ({
        ...link,
        entity_type_label: formatAgendaEntityTypeLabel(link.entity_type),
        relationship_label: formatAgendaRelationshipLabel(link.relationship),
        confidence_label: formatAgendaConfidenceLabel(link.confidence),
        source_refs_resolved: getAgendaSourceRefs(link.source_refs || []),
      }))
      .sort((left, right) => {
        if (normalizeLabel(left.review_status) !== normalizeLabel(right.review_status)) {
          return normalizeLabel(left.review_status).localeCompare(normalizeLabel(right.review_status));
        }

        if (normalizeLabel(left.entity_type) !== normalizeLabel(right.entity_type)) {
          return normalizeLabel(left.entity_type).localeCompare(normalizeLabel(right.entity_type));
        }

        return String(left.entity_id || "").localeCompare(String(right.entity_id || ""));
      });
    const verifiedLinkCount = links.filter((link) => isVerifiedAgendaLink(link)).length;
    const itemSourceRefsResolved = getAgendaSourceRefs(item.source_refs || []);
    const itemReviewSignal =
      links.length === 0
        ? "unlinked"
        : verifiedLinkCount === links.length
          ? "verified_links_only"
          : "mixed_review";

    markSourceUsage(item.source_refs || [], "item", item.id);
    for (const key of item.source_refs || []) {
      agendaSourceRefKeys.add(key);
    }

    return {
      ...item,
      policy_domain_label: formatAgendaDomainLabel(item.policy_domain),
      action_type_label: formatAgendaActionTypeLabel(item.action_type),
      status_label: formatAgendaStatusLabel(item.status),
      status_tone: getAgendaStatusTone(item.status),
      source_refs_resolved: itemSourceRefsResolved,
      source_ref_count: itemSourceRefsResolved.length,
      links,
      link_count: links.length,
      verified_link_count: verifiedLinkCount,
      has_only_verified_links: links.length > 0 && verifiedLinkCount === links.length,
      item_review_signal: itemReviewSignal,
    };
  });

  const sourceRefs = getAgendaSourceRefs([...agendaSourceRefKeys]).map((source) => {
    const usage = sourceUsageMap.get(source.key) || {
      agenda_ids: new Set(),
      item_ids: new Set(),
      link_ids: new Set(),
    };

    return {
      ...source,
      agenda_ref_count: usage.agenda_ids.size,
      item_ref_count: usage.item_ids.size,
      link_ref_count: usage.link_ids.size,
      total_ref_count: usage.agenda_ids.size + usage.item_ids.size + usage.link_ids.size,
    };
  }).sort((left, right) => String(left.key || "").localeCompare(String(right.key || "")));

  const linksMissingReasoning = agendaLinks.filter(
    (link) => !String(link.reasoning || "").trim()
  );
  const linksMissingConfidence = agendaLinks.filter(
    (link) => !String(link.confidence || "").trim()
  );
  const linksMissingReviewStatus = agendaLinks.filter(
    (link) => !String(link.review_status || "").trim()
  );
  const linksNeedingReview = agendaLinks.filter(
    (link) => normalizeLabel(link.review_status) !== "verified"
  );
  const itemsWithoutLinks = items.filter((item) => item.link_count === 0);
  const itemsWithoutSourceRefs = items.filter((item) => item.source_ref_count === 0);
  const metadataGapLinkIds = new Set([
    ...linksMissingReasoning.map((link) => link.id),
    ...linksMissingConfidence.map((link) => link.id),
    ...linksMissingReviewStatus.map((link) => link.id),
  ]);
  const reviewStatusCounts = agendaLinks.reduce((totals, link) => {
    const reviewStatus = normalizeLabel(link.review_status) || "unknown";

    totals[reviewStatus] = Number(totals[reviewStatus] || 0) + 1;
    return totals;
  }, {});
  const domainCoverageMap = new Map();

  for (const item of items) {
    const domainKey = String(item.policy_domain || "").trim() || "unknown";

    if (!domainCoverageMap.has(domainKey)) {
      domainCoverageMap.set(domainKey, {
        domain: domainKey,
        domain_label: item.policy_domain_label || formatAgendaDomainLabel(domainKey),
        item_count: 0,
        total_link_count: 0,
        verified_link_count: 0,
        unlinked_item_count: 0,
        items_without_source_refs_count: 0,
      });
    }

    const domainEntry = domainCoverageMap.get(domainKey);

    domainEntry.item_count += 1;
    domainEntry.total_link_count += Number(item.link_count || 0);
    domainEntry.verified_link_count += Number(item.verified_link_count || 0);

    if (!item.link_count) {
      domainEntry.unlinked_item_count += 1;
    }

    if (!item.source_ref_count) {
      domainEntry.items_without_source_refs_count += 1;
    }
  }

  const domain_coverage = [...domainCoverageMap.values()]
    .map((entry) => ({
      ...entry,
      zero_verified_linkage: entry.verified_link_count === 0,
    }))
    .sort((left, right) => {
      if (right.unlinked_item_count !== left.unlinked_item_count) {
        return right.unlinked_item_count - left.unlinked_item_count;
      }

      if (left.verified_link_count !== right.verified_link_count) {
        return left.verified_link_count - right.verified_link_count;
      }

      return String(left.domain_label || "").localeCompare(String(right.domain_label || ""));
    });
  const domainsWithoutVerifiedLinkage = domain_coverage.filter(
    (item) => item.zero_verified_linkage
  );

  return {
    agenda,
    items,
    source_refs: sourceRefs,
    domain_coverage,
    metrics: {
      total_items: items.length,
      total_links: agendaLinks.length,
      verified_links: agendaLinks.filter((link) => isVerifiedAgendaLink(link)).length,
      unlinked_items: itemsWithoutLinks.length,
      source_ref_count: sourceRefs.length,
      items_without_source_refs: itemsWithoutSourceRefs.length,
      items_with_only_verified_links: items.filter((item) => item.has_only_verified_links).length,
      links_missing_metadata: metadataGapLinkIds.size,
      links_needing_review: linksNeedingReview.length,
      domains_without_verified_linkage: domainsWithoutVerifiedLinkage.length,
      review_status_counts: reviewStatusCounts,
    },
    gaps: {
      items_without_links: itemsWithoutLinks.map((item) => ({
        id: item.id,
        title: item.title,
        policy_domain: item.policy_domain,
        policy_domain_label: item.policy_domain_label,
      })),
      items_without_source_refs: itemsWithoutSourceRefs.map((item) => ({
        id: item.id,
        title: item.title,
        policy_domain: item.policy_domain,
        policy_domain_label: item.policy_domain_label,
      })),
      links_missing_reasoning: linksMissingReasoning.map((link) => ({
        id: link.id,
        agenda_item_id: link.agenda_item_id,
        entity_type: link.entity_type,
        entity_id: link.entity_id,
      })),
      links_missing_confidence: linksMissingConfidence.map((link) => ({
        id: link.id,
        agenda_item_id: link.agenda_item_id,
        entity_type: link.entity_type,
        entity_id: link.entity_id,
      })),
      links_missing_review_status: linksMissingReviewStatus.map((link) => ({
        id: link.id,
        agenda_item_id: link.agenda_item_id,
        entity_type: link.entity_type,
        entity_id: link.entity_id,
      })),
      links_needing_review: linksNeedingReview.map((link) => ({
        id: link.id,
        agenda_item_id: link.agenda_item_id,
        entity_type: link.entity_type,
        entity_id: link.entity_id,
        review_status: link.review_status,
      })),
    },
  };
}

export function getAgendaReviewExportData(slug) {
  const review = getAgendaReviewData(slug);

  if (!review) {
    return null;
  }

  const items = review.items.map((item) => ({
    id: item.id,
    title: item.title,
    policy_domain: item.policy_domain,
    policy_domain_label: item.policy_domain_label,
    action_type: item.action_type,
    action_type_label: item.action_type_label,
    status: item.status,
    status_label: item.status_label,
    linked_record_count: item.link_count,
    verified_link_count: item.verified_link_count,
    missing_source_refs: item.source_ref_count === 0,
    source_ref_count: item.source_ref_count,
    has_only_verified_links: item.has_only_verified_links,
    item_review_signal: item.item_review_signal,
    has_metadata_gap: item.links.some(
      (link) =>
        !String(link.reasoning || "").trim() ||
        !String(link.confidence || "").trim() ||
        !String(link.review_status || "").trim()
    ),
  }));
  const links = review.items.flatMap((item) =>
    item.links.map((link) => ({
      id: link.id,
      agenda_item_id: item.id,
      agenda_item_title: item.title,
      policy_domain: item.policy_domain,
      entity_type: link.entity_type,
      entity_id: link.entity_id,
      relationship: link.relationship,
      confidence: link.confidence || null,
      review_status: link.review_status || null,
      has_reasoning: Boolean(String(link.reasoning || "").trim()),
      source_ref_count: (link.source_refs_resolved || []).length,
      is_verified: isVerifiedAgendaLink(link),
    }))
  );

  return {
    generated_at: new Date().toISOString(),
    agenda: {
      id: review.agenda.id,
      slug: review.agenda.slug,
      name: review.agenda.name,
      publisher: review.agenda.publisher,
      type: review.agenda.type,
      published_at: review.agenda.published_at,
    },
    metrics: review.metrics,
    items,
    links,
    domain_coverage: review.domain_coverage,
    source_coverage: review.source_refs.map((source) => ({
      key: source.key,
      title: source.title,
      publisher: source.publisher,
      source_type: source.source_type,
      source_url: source.source_url || null,
      artifact_path: source.artifact_path || null,
      note: source.note || null,
      agenda_ref_count: source.agenda_ref_count,
      item_ref_count: source.item_ref_count,
      link_ref_count: source.link_ref_count,
      total_ref_count: source.total_ref_count,
    })),
    gaps: review.gaps,
  };
}

export function getLinkedAgendaItemsForEntity(entityType, entityId) {
  const normalizedType = normalizeLabel(entityType);
  const normalizedId = String(entityId || "").trim();

  if (!normalizedType || !normalizedId) {
    return [];
  }

  const agendasById = buildAgendaIndexMap(AGENDAS);
  const agendaItemsById = buildAgendaIndexMap(AGENDA_ITEMS);

  return getVerifiedAgendaItemLinks().filter(
    (link) =>
      normalizeLabel(link.entity_type) === normalizedType &&
      String(link.entity_id || "").trim() === normalizedId
  )
    .map((link) => {
      const agendaItem = agendaItemsById.get(link.agenda_item_id);
      const agenda = agendaItem ? agendasById.get(agendaItem.agenda_id) : null;

      if (!agendaItem || !agenda) {
        return null;
      }

      return {
        ...agendaItem,
        agenda_name: agenda.name,
        agenda_slug: agenda.slug,
        href: buildAgendaItemHref(agenda.slug, agendaItem.id),
        policy_domain_label: formatAgendaDomainLabel(agendaItem.policy_domain),
        action_type_label: formatAgendaActionTypeLabel(agendaItem.action_type),
        relationship: link.relationship,
        relationship_label: formatAgendaRelationshipLabel(link.relationship),
        confidence: link.confidence,
        confidence_label: formatAgendaConfidenceLabel(link.confidence),
        review_status: link.review_status,
        reasoning: link.reasoning || null,
        source_refs: link.source_refs || [],
        source_refs_resolved: getAgendaSourceRefs(link.source_refs || []),
        status_label: formatAgendaStatusLabel(agendaItem.status),
        status_tone: getAgendaStatusTone(agendaItem.status),
      };
    })
    .filter(Boolean);
}

export function getAgendaOverlapForPromiseRecords(promiseRecords = [], agendaSlug = "project-2025") {
  const agenda = getAgendaBySlug(agendaSlug);

  if (!agenda || !Array.isArray(promiseRecords) || !promiseRecords.length) {
    return null;
  }

  const agendaItemMap = new Map();
  const linkedRecordMap = new Map();
  const domainMap = new Map();

  for (const promise of promiseRecords) {
    const promiseSlug = String(promise?.slug || "").trim();

    if (!promiseSlug) {
      continue;
    }

    const linkedAgendaItems = dedupeBy(
      getLinkedAgendaItemsForEntity("promise", promiseSlug).filter(
        (item) => item.agenda_slug === agendaSlug
      ),
      (item) => `${item.id}:${item.relationship}:${item.confidence}`
    );

    if (!linkedAgendaItems.length) {
      continue;
    }

    linkedRecordMap.set(promiseSlug, {
      slug: promiseSlug,
      title: promise?.title || promiseSlug,
      status: promise?.status || "Unknown",
      topic: promise?.topic || null,
      href: `/promises/${promiseSlug}`,
      linked_agenda_item_count: linkedAgendaItems.length,
      linked_agenda_items: linkedAgendaItems.map((item) => ({
        id: item.id,
        title: item.title,
        href: item.href,
        policy_domain: item.policy_domain,
        policy_domain_label: item.policy_domain_label,
        relationship_label: item.relationship_label,
        confidence_label: item.confidence_label,
        reasoning: item.reasoning || null,
      })),
    });

    for (const item of linkedAgendaItems) {
      agendaItemMap.set(item.id, {
        id: item.id,
        title: item.title,
        href: item.href,
        policy_domain: item.policy_domain,
        policy_domain_label: item.policy_domain_label,
        status: item.status,
        status_label: item.status_label,
        status_tone: item.status_tone,
      });
    }
  }

  if (!linkedRecordMap.size || !agendaItemMap.size) {
    return null;
  }

  for (const item of agendaItemMap.values()) {
    const domainLabel = item.policy_domain_label || formatAgendaDomainLabel(item.policy_domain);

    if (!domainMap.has(domainLabel)) {
      domainMap.set(domainLabel, new Set());
    }

    domainMap.get(domainLabel).add(item.id);
  }

  const linkedAgendaItems = [...agendaItemMap.values()].sort((left, right) => {
    if (left.policy_domain_label !== right.policy_domain_label) {
      return String(left.policy_domain_label || "").localeCompare(
        String(right.policy_domain_label || "")
      );
    }

    return String(left.title || "").localeCompare(String(right.title || ""));
  });
  const linkedRecords = [...linkedRecordMap.values()].sort((left, right) => {
    if (right.linked_agenda_item_count !== left.linked_agenda_item_count) {
      return right.linked_agenda_item_count - left.linked_agenda_item_count;
    }

    return String(left.title || "").localeCompare(String(right.title || ""));
  });
  const topDomains = [...domainMap.entries()]
    .map(([domain, ids]) => ({
      domain,
      count: ids.size,
    }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return String(left.domain || "").localeCompare(String(right.domain || ""));
    })
    .slice(0, 3);

  return {
    agenda_name: agenda.name,
    agenda_slug: agenda.slug,
    linked_record_count: linkedRecords.length,
    linked_agenda_item_count: linkedAgendaItems.length,
    implemented_agenda_item_count: linkedAgendaItems.filter(
      (item) => normalizeLabel(item.status) === "implemented"
    ).length,
    top_domains: topDomains,
    top_domain: topDomains[0] || null,
    linked_records: linkedRecords,
    linked_agenda_items: linkedAgendaItems,
  };
}

export function getAgendaOverlapComparisonForPresidents(
  comparedPresidents = [],
  agendaSlug = "project-2025"
) {
  const agenda = getAgendaBySlug(agendaSlug);

  if (!agenda || !Array.isArray(comparedPresidents) || !comparedPresidents.length) {
    return null;
  }

  const entities = comparedPresidents.map((item) => {
    const overlap = getAgendaOverlapForPromiseRecords(item.promise_records || [], agendaSlug);

    return {
      president_slug: item.president_slug || null,
      president_name: item.president_name || "Comparison record",
      term_label: item.termLabel || null,
      has_overlap: Boolean(overlap),
      linked_agenda_item_count: overlap?.linked_agenda_item_count ?? 0,
      linked_record_count: overlap?.linked_record_count ?? 0,
      implemented_agenda_item_count: overlap?.implemented_agenda_item_count ?? 0,
      top_domain: overlap?.top_domain || null,
      top_domains: overlap?.top_domains || [],
      linked_records_preview: (overlap?.linked_records || []).slice(0, 2),
    };
  });

  const entitiesWithOverlap = entities.filter((item) => item.has_overlap);

  if (!entitiesWithOverlap.length) {
    return null;
  }

  const rankedEntities = entitiesWithOverlap.slice().sort((left, right) => {
    if (right.linked_agenda_item_count !== left.linked_agenda_item_count) {
      return right.linked_agenda_item_count - left.linked_agenda_item_count;
    }

    if (right.linked_record_count !== left.linked_record_count) {
      return right.linked_record_count - left.linked_record_count;
    }

    return String(left.president_name || "").localeCompare(String(right.president_name || ""));
  });
  const leader = rankedEntities[0] || null;
  const runnerUp = rankedEntities[1] || null;

  let summary = `${leader?.president_name || "One selected president"} currently shows the most verified overlap with tracked ${agenda.name} items in this comparison.`;
  if (entitiesWithOverlap.length === 1) {
    summary = `Only ${leader?.president_name || "one selected president"} currently has verified overlap with tracked ${agenda.name} items in this comparison.`;
  } else if (
    leader &&
    runnerUp &&
    leader.linked_agenda_item_count === runnerUp.linked_agenda_item_count &&
    leader.linked_record_count === runnerUp.linked_record_count
  ) {
    summary = `${leader.president_name} and ${runnerUp.president_name} currently show the same level of verified overlap in the tracked ${agenda.name} slice.`;
  }

  return {
    agenda_name: agenda.name,
    agenda_slug: agenda.slug,
    entities,
    entities_with_overlap_count: entitiesWithOverlap.length,
    leader,
    runner_up: runnerUp,
    summary,
  };
}

export async function getAgendaPageData(slug) {
  const agenda = getAgendaBySlug(slug);

  if (!agenda) {
    return null;
  }

  const agendaItems = AGENDA_ITEMS.filter((item) => item.agenda_id === agenda.id);
  const verifiedAgendaLinks = getVerifiedAgendaItemLinks();
  const linksByAgendaItemId = new Map();

  for (const link of verifiedAgendaLinks) {
    if (!linksByAgendaItemId.has(link.agenda_item_id)) {
      linksByAgendaItemId.set(link.agenda_item_id, []);
    }

    linksByAgendaItemId.get(link.agenda_item_id).push(link);
  }

  const promisePreviewMap = await fetchPromisePreviewRecords(verifiedAgendaLinks);

  const items = agendaItems.map((item) => {
    const linkedActions = (linksByAgendaItemId.get(item.id) || [])
      .map((link) => {
        const record =
          link.entity_type === "promise" ? promisePreviewMap.get(String(link.entity_id)) : null;

        if (!record) {
          return null;
        }

        return {
          ...link,
          record,
          relationship_label: formatAgendaRelationshipLabel(link.relationship),
          confidence_label: formatAgendaConfidenceLabel(link.confidence),
          review_status: link.review_status,
          reasoning: link.reasoning || null,
          source_refs: link.source_refs || [],
          source_refs_resolved: getAgendaSourceRefs(link.source_refs || []),
        };
      })
      .filter(Boolean);

    return {
      ...item,
      href: buildAgendaItemHref(agenda.slug, item.id),
      policy_domain_label: formatAgendaDomainLabel(item.policy_domain),
      action_type_label: formatAgendaActionTypeLabel(item.action_type),
      status_label: formatAgendaStatusLabel(item.status),
      status_tone: getAgendaStatusTone(item.status),
      source_refs_resolved: getAgendaSourceRefs(item.source_refs || []),
      linked_actions: linkedActions,
      linked_action_count: linkedActions.length,
      linked_action_types: dedupeBy(
        linkedActions.map((link) => formatAgendaEntityTypeLabel(link.entity_type)),
        (value) => value
      ),
    };
  });

  const linkedPreviewRecords = mergeLinkedPreviewRecords(items);
  const linkedConnectionCount = items.reduce(
    (total, item) => total + Number(item.linked_action_count || 0),
    0
  );
  const linkedRecordTypeCounts = linkedPreviewRecords.reduce((totals, item) => {
    const entityType = normalizeLabel(item.entity_type);

    totals[entityType] = Number(totals[entityType] || 0) + 1;
    return totals;
  }, {});
  const statusBreakdown = items.reduce((totals, item) => {
    const status = normalizeLabel(item.status);

    totals[status] = Number(totals[status] || 0) + 1;
    return totals;
  }, {});
  const distinctDomainCount = new Set(
    items.map((item) => String(item.policy_domain || "").trim()).filter(Boolean)
  ).size;
  const itemsWithLinkedActionsCount = items.filter((item) => item.linked_action_count > 0).length;
  const itemsWithoutLinkedActions = items.filter((item) => item.linked_action_count === 0);
  const topLinkedItems = buildTopLinkedItems(items);

  return {
    agenda,
    items,
    metrics: {
      total_items: items.length,
      items_with_linked_actions: itemsWithLinkedActionsCount,
      items_without_linked_actions: itemsWithoutLinkedActions.length,
      implemented_count: items.filter((item) => item.status === "implemented").length,
      tracked_count: items.filter((item) => normalizeLabel(item.status) === "tracked").length,
      total_linked_records: linkedPreviewRecords.length,
      total_linked_connections: linkedConnectionCount,
      linked_record_type_counts: linkedRecordTypeCounts,
      status_breakdown: statusBreakdown,
      domain_count: distinctDomainCount,
    },
    watch: {
      top_linked_items: topLinkedItems,
      unlinked_items: itemsWithoutLinkedActions.slice(0, 3),
      unlinked_count: itemsWithoutLinkedActions.length,
      implemented_items: items.filter((item) => normalizeLabel(item.status) === "implemented"),
    },
    linked_actions_preview: {
      records: linkedPreviewRecords,
      promises: linkedPreviewRecords.filter((item) => item.entity_type === "promise"),
    },
  };
}
