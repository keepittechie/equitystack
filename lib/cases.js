import {
  CASE_POLICY_LINK_FIELDS,
  CASE_POLICY_LINKS,
  RESEARCH_CASES,
} from "./data/cases/index.js";

export { CASE_POLICY_LINK_FIELDS, CASE_POLICY_LINKS, RESEARCH_CASES };

function normalizeLabel(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeId(value) {
  return String(value || "").trim();
}

function isVerifiedCasePolicyLink(link) {
  return normalizeLabel(link?.review_status) === "verified";
}

export function getVerifiedCasePolicyLinks() {
  return CASE_POLICY_LINKS.filter((item) => isVerifiedCasePolicyLink(item));
}

export function formatCaseRelationshipLabel(relationship) {
  const label = normalizeLabel(relationship);

  if (label === "judicial_constraint") return "Judicial constraint";
  if (label === "procedural_check") return "Procedural check";
  if (label === "legal_context") return "Legal context";
  if (label === "litigation_context") return "Litigation context";

  const formatted = String(relationship || "")
    .trim()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ");

  if (!formatted) {
    return "Linked case";
  }

  return formatted.replace(/\b\w/g, (match) => match.toUpperCase());
}

function getResearchCaseById(caseId) {
  const normalizedCaseId = normalizeId(caseId);

  if (!normalizedCaseId) {
    return null;
  }

  return RESEARCH_CASES.find((item) => normalizeId(item.id) === normalizedCaseId) || null;
}

export function getPoliciesForCase(caseId) {
  const normalizedCaseId = normalizeId(caseId);

  if (!normalizedCaseId) {
    return [];
  }

  return getVerifiedCasePolicyLinks()
    .filter((link) => normalizeId(link.case_id) === normalizedCaseId)
    .map((link) => ({
      policy_id: link.policy_id,
      href: link.policy_id ? `/policies/${link.policy_id}` : null,
      relationship: link.relationship,
      relationship_label: formatCaseRelationshipLabel(link.relationship),
      confidence: link.confidence,
      reasoning: link.reasoning || null,
      review_status: link.review_status,
    }));
}

export function getCasesForPolicy(policyId) {
  const normalizedPolicyId = normalizeId(policyId);

  if (!normalizedPolicyId) {
    return [];
  }

  return getVerifiedCasePolicyLinks()
    .filter((link) => normalizeId(link.policy_id) === normalizedPolicyId)
    .map((link) => {
      const researchCase = getResearchCaseById(link.case_id);

      return {
        case_id: link.case_id,
        id: researchCase?.id || link.case_id,
        title: researchCase?.title || link.case_id,
        summary: researchCase?.summary || null,
        type: researchCase?.type || null,
        status: researchCase?.status || null,
        domains: researchCase?.domains || [],
        relationship: link.relationship,
        relationship_label: formatCaseRelationshipLabel(link.relationship),
        confidence: link.confidence,
        reasoning: link.reasoning || null,
        review_status: link.review_status,
      };
    });
}
