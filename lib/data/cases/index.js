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
    id: "affirmative-action-admissions-case-lineage",
    title: "Higher-education affirmative action admissions case lineage",
    summary:
      "A research lineage connecting Bakke, Grutter, Gratz, Fisher, and Students for Fair Admissions as the major Supreme Court doctrine line governing race-conscious higher-education admissions.",
    type: "litigation_lineage",
    status: "historical lineage; decided cases",
    domains: ["education", "civil_rights"],
  },
  {
    id: "alexander-south-carolina-naacp-redistricting-2024",
    title: "Alexander v. South Carolina State Conference of the NAACP",
    summary:
      "The Supreme Court reversed in part and remanded a lower-court ruling that had found South Carolina's congressional map to be an unconstitutional racial gerrymander, affecting proof standards in redistricting litigation.",
    type: "litigation",
    status: "decided; remanded",
    domains: ["voting_rights", "civil_rights"],
  },
  {
    id: "allen-v-milligan-voting-rights-act-2023",
    title: "Allen v. Milligan",
    summary:
      "The Supreme Court affirmed rulings that Alabama's congressional map violated Section 2 of the Voting Rights Act, preserving a major modern pathway for Black voting-power claims in redistricting.",
    type: "litigation",
    status: "decided",
    domains: ["voting_rights", "civil_rights"],
  },
  {
    id: "american-alliance-equal-rights-fearless-fund-2024",
    title: "American Alliance for Equal Rights v. Fearless Fund Management",
    summary:
      "The Eleventh Circuit ordered preliminary injunctive relief against a Black-women-targeted grant contest, making the case a significant post-SFFA challenge to race-conscious private initiatives.",
    type: "litigation",
    status: "appellate preliminary injunction ruling",
    domains: ["civil_rights", "economic_opportunity"],
  },
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
  {
    id: "students-for-fair-admissions-harvard-unc-2023",
    title: "Students for Fair Admissions v. Harvard and UNC",
    summary:
      "The Supreme Court held that the challenged Harvard and University of North Carolina admissions programs violated equal-protection requirements, sharply restricting race-conscious admissions in higher education.",
    type: "litigation",
    status: "decided",
    domains: ["education", "civil_rights"],
  },
];

export const CASE_POLICY_LINKS = [
  {
    case_id: "census-citizenship-question-case-2019",
    policy_id: 160,
    relationship: "judicial_block",
    confidence: 0.95,
    reasoning:
      "The Supreme Court blocked the attempted citizenship question after finding the stated rationale inadequate and pretextual, preventing the policy from being implemented for the 2020 Census.",
    review_status: "verified",
  },
  {
    case_id: "daca-rescission-supreme-court-2020",
    policy_id: 161,
    relationship: "procedural_check",
    confidence: 0.95,
    reasoning:
      "The Supreme Court held that the rescission did not satisfy administrative procedure requirements, blocking the attempted termination of DACA at that stage.",
    review_status: "verified",
  },
  {
    case_id: "family-separation-asylum-litigation-cluster",
    policy_id: 162,
    relationship: "litigation_challenge",
    confidence: 0.9,
    reasoning:
      "Federal litigation challenged the zero-tolerance enforcement approach and family separation practices, leading to court intervention and later policy changes.",
    review_status: "verified",
  },
];
