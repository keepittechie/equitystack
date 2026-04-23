import { readFileSync } from "fs";
import path from "path";
import { fetchPromisePageData } from "@/lib/public-site-data";

const PROJECT_2025_AGENDA_ID = "project-2025";

export const AGENDAS = [
  {
    id: PROJECT_2025_AGENDA_ID,
    slug: "project-2025",
    name: "Project 2025",
    publisher: "Heritage Foundation",
    type: "external_blueprint",
    summary:
      "A tracked external governing blueprint from the Heritage Foundation. EquityStack follows where its proposals appear in real public records without treating the blueprint itself as enacted policy or part of the Black Impact Score model.",
    published_at: "2023-04-21",
  },
];

export const AGENDA_ITEMS = [
  {
    id: "project-2025-federal-workforce-control",
    agenda_id: PROJECT_2025_AGENDA_ID,
    title: "Expand presidential control over the federal workforce",
    summary:
      "Tracks executive orders, OPM rules, and personnel reclassification plans that would make it easier to remove career civil servants, revive Schedule F-style structures, and tighten direct White House control over agency leadership.",
    policy_domain: "federal_workforce",
    action_type: "personnel_control",
    status: "attempted",
  },
  {
    id: "project-2025-dei-civil-rights-rollback",
    agenda_id: PROJECT_2025_AGENDA_ID,
    title: "Rollback federal DEI and civil-rights equity programs",
    summary:
      "Tracks executive orders, grant conditions, and agency directives that remove DEI offices, equity plans, disparate-impact frameworks, and race-conscious civil-rights implementation guidance across the federal government.",
    policy_domain: "civil_rights",
    action_type: "equity_rollback",
    status: "partial",
  },
  {
    id: "project-2025-education-department-downsizing",
    agenda_id: PROJECT_2025_AGENDA_ID,
    title: "Downsize the Department of Education and shift authority outward",
    summary:
      "Tracks legislation, block-grant proposals, and agency restructuring steps that shrink the Department of Education, cut federal oversight, and move more control over schools and postsecondary funding to states, parents, and other departments.",
    policy_domain: "education",
    action_type: "agency_downsizing",
    status: "attempted",
  },
  {
    id: "project-2025-immigration-enforcement-expansion",
    agenda_id: PROJECT_2025_AGENDA_ID,
    title: "Expand immigration enforcement and detention capacity",
    summary:
      "Tracks executive orders, DHS policy changes, and congressional proposals that widen detention, accelerate removals, expand interior enforcement, and restore hard-line border and asylum restrictions.",
    policy_domain: "immigration",
    action_type: "enforcement_expansion",
    status: "attempted",
  },
  {
    id: "project-2025-reproductive-rights-restriction",
    agenda_id: PROJECT_2025_AGENDA_ID,
    title: "Restrict reproductive-rights access through federal power",
    summary:
      "Tracks HHS directives, enforcement choices, grant rules, and DOJ litigation positions that would narrow abortion access and reproductive-health services through federal funding, custody, and program authority.",
    policy_domain: "healthcare",
    action_type: "rights_restriction",
    status: "tracked",
  },
  {
    id: "project-2025-housing-welfare-restructuring",
    agenda_id: PROJECT_2025_AGENDA_ID,
    title: "Restructure housing and welfare responses around punishment and control",
    summary:
      "Tracks executive actions, grant rules, and local enforcement partnerships that replace service-centered housing responses with encampment clearances, compulsory treatment, and broader civil-commitment tools.",
    policy_domain: "housing",
    action_type: "service_restructuring",
    status: "attempted",
  },
  {
    id: "project-2025-labor-worker-protection-rollback",
    agenda_id: PROJECT_2025_AGENDA_ID,
    title: "Reduce labor and worker-protection enforcement",
    summary:
      "Tracks Labor Department, NLRB, and related-agency actions that narrow worker-protection enforcement, limit organizing-friendly interpretations, and reduce federal pressure on employers through rulemaking and enforcement policy.",
    policy_domain: "labor",
    action_type: "worker_protection_rollback",
    status: "tracked",
  },
  {
    id: "project-2025-environmental-justice-rollback",
    agenda_id: PROJECT_2025_AGENDA_ID,
    title: "Rollback environmental-justice enforcement and targeting",
    summary:
      "Tracks EPA reviews, enforcement pullbacks, and grant-rule changes that pause or narrow environmental-justice and Title VI actions tied to race-conscious targeting or disproportionate-impact enforcement.",
    policy_domain: "environment",
    action_type: "enforcement_rollback",
    status: "attempted",
  },
  {
    id: "project-2025-doj-independent-agency-control",
    agenda_id: PROJECT_2025_AGENDA_ID,
    title: "Concentrate DOJ and independent-agency control under the executive",
    summary:
      "Tracks personnel moves, legal guidance, and structural changes that increase White House influence over DOJ, prosecutors, and other agencies that have traditionally operated with more insulation from direct presidential control.",
    policy_domain: "executive_power",
    action_type: "executive_control_expansion",
    status: "attempted",
  },
  {
    id: "project-2025-voting-election-administration",
    agenda_id: PROJECT_2025_AGENDA_ID,
    title: "Tighten voting and election-administration rules",
    summary:
      "Tracks federal legislation, DOJ positions, and election-administration directives that push proof-of-citizenship requirements, paper-ballot rules, and stricter ballot-handling standards in the name of election integrity.",
    policy_domain: "voting",
    action_type: "election_administration",
    status: "attempted",
  },
  {
    id: "project-2025-criminal-justice-policing",
    agenda_id: PROJECT_2025_AGENDA_ID,
    title: "Shift criminal-justice policy toward tougher policing and discipline",
    summary:
      "Tracks DOJ guidance, grant conditions, and education or policing directives that favor tougher law-and-order enforcement, stricter school-discipline posture, and punishment-centered public-order responses over reform-oriented alternatives.",
    policy_domain: "criminal_justice",
    action_type: "punitive_enforcement",
    status: "attempted",
  },
  {
    id: "project-2025-hhs-public-health-restructuring",
    agenda_id: PROJECT_2025_AGENDA_ID,
    title: "Restructure HHS and public-health priorities",
    summary:
      "Tracks HHS reorganizations, procurement changes, and program directives that redirect public-health priorities toward a narrower executive agenda and away from broader equity and access frameworks.",
    policy_domain: "healthcare",
    action_type: "agency_restructuring",
    status: "partial",
  },
  {
    id: "project-2025-school-choice-expansion",
    agenda_id: PROJECT_2025_AGENDA_ID,
    title: "Expand federally backed school-choice pathways",
    summary:
      "Tracks grant rules, block grants, and executive education initiatives that push parent-directed school choice, vouchers, and education-savings-style funding rather than traditional district-based federal support.",
    policy_domain: "education",
    action_type: "school_choice_expansion",
    status: "partial",
  },
  {
    id: "project-2025-higher-ed-accreditation-reset",
    agenda_id: PROJECT_2025_AGENDA_ID,
    title: "Rewrite higher-education accreditation around outcomes and ideology fights",
    summary:
      "Tracks Education Department actions and legislative proposals that remake accreditation rules around workforce outcomes, institutional ideology concerns, and tighter federal leverage over colleges and accreditors.",
    policy_domain: "education",
    action_type: "accreditation_rewrite",
    status: "attempted",
  },
  {
    id: "project-2025-postsecondary-workforce-reorientation",
    agenda_id: PROJECT_2025_AGENDA_ID,
    title: "Shift postsecondary policy toward apprenticeships and non-college pathways",
    summary:
      "Tracks federal education and labor proposals that redirect postsecondary support toward apprenticeships, employer-run training, and career-and-technical programs instead of four-year degree pathways.",
    policy_domain: "education",
    action_type: "workforce_reorientation",
    status: "attempted",
  },
  {
    id: "project-2025-title-ix-sex-definition",
    agenda_id: PROJECT_2025_AGENDA_ID,
    title: "Redefine Title IX and related school policy around biological sex",
    summary:
      "Tracks Education Department rulemaking and congressional changes that define sex as biological sex at birth, roll back gender-identity protections, and restore a more restrictive federal Title IX posture.",
    policy_domain: "civil_rights",
    action_type: "sex_definition_rulemaking",
    status: "tracked",
  },
  {
    id: "project-2025-border-agency-consolidation",
    agenda_id: PROJECT_2025_AGENDA_ID,
    title: "Consolidate border and immigration functions into a harder-line enforcement structure",
    summary:
      "Tracks legislation and agency transfers that would dismantle or split DHS, fold ORR and immigration adjudication into a new border-enforcement structure, and concentrate immigration control under a single tougher apparatus.",
    policy_domain: "immigration",
    action_type: "agency_transfer",
    status: "tracked",
  },
  {
    id: "project-2025-e-verify-work-authorization-restrictions",
    agenda_id: PROJECT_2025_AGENDA_ID,
    title: "Mandate wider E-Verify use and narrow work authorization pathways",
    summary:
      "Tracks legislation and DHS rules that make E-Verify more mandatory, tighten employment authorization, and use work eligibility checks as a broader immigration-enforcement tool.",
    policy_domain: "immigration",
    action_type: "eligibility_restriction",
    status: "tracked",
  },
  {
    id: "project-2025-student-aid-privatization",
    agenda_id: PROJECT_2025_AGENDA_ID,
    title: "Reverse federal student-loan centralization and spin off aid administration",
    summary:
      "Tracks legislation and Education Department restructuring that would reverse student-loan federalization, spin off Federal Student Aid operations, and move more financing responsibility back toward private or quasi-private channels.",
    policy_domain: "education",
    action_type: "student_aid_privatization",
    status: "tracked",
  },
  {
    id: "project-2025-orr-abortion-access-restrictions",
    agenda_id: PROJECT_2025_AGENDA_ID,
    title: "Block abortion access through HHS and ORR custody policy",
    summary:
      "Tracks HHS and ORR custody directives that bar or restrict transport, facilitation, or funding for elective abortions involving minors in federal custody and related federally supervised care settings.",
    policy_domain: "healthcare",
    action_type: "abortion_access_restriction",
    status: "tracked",
  },
];

export const AGENDA_ITEM_LINKS = [
  {
    agenda_item_id: "project-2025-dei-civil-rights-rollback",
    entity_type: "promise",
    entity_id: "trump-2025-end-federal-dei-equity-programs",
    relationship: "aligned_with",
    confidence: "high",
    reasoning:
      "The record orders agencies to unwind federal DEI and equity infrastructure, which directly matches the blueprint's call to remove those programs across government.",
  },
  {
    agenda_item_id: "project-2025-environmental-justice-rollback",
    entity_type: "promise",
    entity_id: "trump-2025-end-federal-dei-equity-programs",
    relationship: "aligned_with",
    confidence: "high",
    reasoning:
      "The same record overlaps because the blueprint treats environmental-justice and Title VI equity enforcement as race-conscious federal programming to pause and narrow.",
  },
  {
    agenda_item_id: "project-2025-education-department-downsizing",
    entity_type: "promise",
    entity_id: "trump-2025-expand-educational-freedom-for-families",
    relationship: "aligned_with",
    confidence: "medium",
    reasoning:
      "The record advances parent-directed schooling and weaker federal control, which fits the blueprint's broader push to shrink Washington's role in education.",
  },
  {
    agenda_item_id: "project-2025-education-department-downsizing",
    entity_type: "promise",
    entity_id: "trump-2025-reform-higher-education-accreditation",
    relationship: "aligned_with",
    confidence: "high",
    reasoning:
      "Accreditation redesign is one of the blueprint's named levers for reducing the department's existing control over higher education.",
  },
  {
    agenda_item_id: "project-2025-housing-welfare-restructuring",
    entity_type: "promise",
    entity_id: "trump-2025-clear-street-encampments-expand-civil-commitment",
    relationship: "aligned_with",
    confidence: "medium",
    reasoning:
      "The record uses encampment clearances and civil-commitment-style treatment tools, matching the blueprint's preference for more coercive homelessness responses.",
  },
  {
    agenda_item_id: "project-2025-doj-independent-agency-control",
    entity_type: "promise",
    entity_id: "trump-2025-strengthen-local-law-enforcement",
    relationship: "aligned_with",
    confidence: "medium",
    reasoning:
      "The record depends on a stronger federal law-enforcement posture and fits the blueprint's broader effort to centralize executive control over justice priorities.",
  },
  {
    agenda_item_id: "project-2025-criminal-justice-policing",
    entity_type: "promise",
    entity_id: "trump-2025-strengthen-local-law-enforcement",
    relationship: "aligned_with",
    confidence: "high",
    reasoning:
      "The record directly overlaps with the blueprint's call for tougher policing, stronger public-order enforcement, and more federal backing for local law enforcement.",
  },
  {
    agenda_item_id: "project-2025-voting-election-administration",
    entity_type: "promise",
    entity_id: "trump-2025-election-integrity-proof-citizenship-paper-ballots",
    relationship: "aligned_with",
    confidence: "high",
    reasoning:
      "The record tracks proof-of-citizenship and paper-ballot rules that closely match the blueprint's election-administration agenda.",
  },
  {
    agenda_item_id: "project-2025-criminal-justice-policing",
    entity_type: "promise",
    entity_id: "trump-2025-reinstate-school-discipline-policies",
    relationship: "influenced_by",
    confidence: "medium",
    reasoning:
      "The record restores a stricter school-discipline posture, which reflects the blueprint's preference for punitive order and less equity-based federal guidance.",
  },
  {
    agenda_item_id: "project-2025-hhs-public-health-restructuring",
    entity_type: "promise",
    entity_id: "trump-2025-domestic-production-of-critical-medicines",
    relationship: "aligned_with",
    confidence: "medium",
    reasoning:
      "The record uses HHS and procurement authority to redirect health priorities and supply-chain policy, overlapping with the blueprint's broader HHS restructuring approach.",
  },
  {
    agenda_item_id: "project-2025-school-choice-expansion",
    entity_type: "promise",
    entity_id: "trump-2025-expand-educational-freedom-for-families",
    relationship: "aligned_with",
    confidence: "high",
    reasoning:
      "The record advances parent-directed school choice, directly matching the blueprint's push for universal choice and family-controlled education funding.",
  },
  {
    agenda_item_id: "project-2025-higher-ed-accreditation-reset",
    entity_type: "promise",
    entity_id: "trump-2025-reform-higher-education-accreditation",
    relationship: "aligned_with",
    confidence: "high",
    reasoning:
      "The record directly tracks the blueprint's call to rewrite accreditation around outcomes, institutional leverage, and a different higher-education policy posture.",
  },
  {
    agenda_item_id: "project-2025-postsecondary-workforce-reorientation",
    entity_type: "promise",
    entity_id: "trump-2025-high-paying-skilled-trade-jobs",
    relationship: "aligned_with",
    confidence: "medium",
    reasoning:
      "The record overlaps with the blueprint's call to put apprenticeships, employer training, and non-college pathways on stronger footing in federal postsecondary policy.",
  },
];

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
  return AGENDAS.find((item) => item.slug === slug) || null;
}

export function getLinkedAgendaItemsForEntity(entityType, entityId) {
  const normalizedType = normalizeLabel(entityType);
  const normalizedId = String(entityId || "").trim();

  if (!normalizedType || !normalizedId) {
    return [];
  }

  const agendasById = buildAgendaIndexMap(AGENDAS);
  const agendaItemsById = buildAgendaIndexMap(AGENDA_ITEMS);

  return AGENDA_ITEM_LINKS.filter(
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
        reasoning: link.reasoning || null,
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
  const linksByAgendaItemId = new Map();

  for (const link of AGENDA_ITEM_LINKS) {
    if (!linksByAgendaItemId.has(link.agenda_item_id)) {
      linksByAgendaItemId.set(link.agenda_item_id, []);
    }

    linksByAgendaItemId.get(link.agenda_item_id).push(link);
  }

  const promisePreviewMap = await fetchPromisePreviewRecords(AGENDA_ITEM_LINKS);

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
          reasoning: link.reasoning || null,
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
