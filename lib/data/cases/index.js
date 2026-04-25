export const CASE_POLICY_LINK_FIELDS = [
  "case_id",
  "policy_id",
  "relationship",
  "confidence",
  "reasoning",
  "review_status",
];

export const RESEARCH_CASES = [
  {
    id: "cancer-alley-petrochemical-litigation-appeal-2025",
    title: "Inclusive Louisiana, Mount Triumph Baptist Church, RISE St. James v. St. James Parish",
    summary:
      "A federal appeals court revived claims challenging petrochemical expansion and alleged discriminatory land-use impacts in Louisiana's Cancer Alley.",
    type: "litigation",
    status: "ongoing; procedural appellate win",
    domains: ["environment", "civil_rights"],
  },
  {
    id: "census-citizenship-question-case-2019",
    title: "Census citizenship question blocked by Supreme Court",
    summary:
      "The Supreme Court blocked the 2020 census citizenship question after finding the agency explanation did not satisfy administrative-law requirements.",
    type: "litigation",
    status: "blocked; procedural check",
    domains: ["civil_rights"],
  },
  {
    id: "daca-rescission-supreme-court-2020",
    title: "DACA rescission blocked due to administrative law violations",
    summary:
      "The Supreme Court invalidated the DACA rescission process because DHS did not adequately justify the action under administrative-law standards.",
    type: "litigation",
    status: "procedural block",
    domains: ["immigration", "civil_rights"],
  },
  {
    id: "family-separation-asylum-litigation-cluster",
    title: "Family separation and asylum policy litigation (multiple federal challenges)",
    summary:
      "Multiple federal challenges addressed family separation, asylum restrictions, injunctions, settlement activity, and unresolved implementation questions.",
    type: "litigation_cluster",
    status: "mixed; ongoing",
    domains: ["immigration", "civil_rights"],
  },
];

export const CASE_POLICY_LINKS = [];
