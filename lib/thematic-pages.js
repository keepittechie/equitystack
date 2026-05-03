// Thematic page ownership map:
// - Primary pages own broad, high-authority search intents.
// - Supporting pages answer narrower or more specialized questions and should feed users upward into primary hubs.
// - "Which Presidents Helped Black Americans" is intentionally mapped here as a planned supporting page, not a live route.

const THEMATIC_PAGE_DEFINITIONS = {
  presidentsAndBlackAmericans: {
    id: "presidentsAndBlackAmericans",
    label: "Presidents and Black Americans",
    path: "/analysis/presidents-and-black-americans",
    status: "live",
    tier: "primary",
    searchIntent: "broad overview for people starting with presidents and Black Americans",
    uniqueAngle:
      "Entry hub that orients readers across presidents, policies, promises, legislation, reports, and historical context.",
    shouldNotDo:
      "Should not try to own legislation-only, promise-only, or evidence-interpretation questions.",
    navDescription:
      "Start with the broad historical question and trace presidential records affecting Black Americans.",
    clusterEyebrow: "Broad overview",
    clusterTitle: "Explore presidents and Black Americans",
    clusterDescription:
      "Use the broad entry guide when you need the clearest overview of how presidents, Black Americans, policy, and history connect across the site.",
    clusterNote: "Primary page for broad entry and orientation.",
    relatedIds: [
      "presidentialImpactOnBlackAmericans",
      "civilRightsLawsByPresident",
      "campaignPromisesToBlackAmericans",
    ],
  },
  presidentialImpactOnBlackAmericans: {
    id: "presidentialImpactOnBlackAmericans",
    label: "Presidential Impact on Black Americans",
    path: "/analysis/presidential-impact-on-black-americans",
    status: "live",
    tier: "primary",
    searchIntent: "top-level synthesis for how presidents affected Black Americans",
    uniqueAngle:
      "Big-picture impact hub that synthesizes rights, policy, legislation, enforcement, opportunity, and historical change.",
    shouldNotDo:
      "Should not become a legislation breakdown, promise tracker page, or record-interpretation manual.",
    navDescription:
      "Use a broad synthesis guide to study how administrations affected Black Americans across rights, policy, legislation, enforcement, and historical change.",
    clusterEyebrow: "Impact synthesis",
    clusterTitle: "Explore presidential impact on Black Americans",
    clusterDescription:
      "Use the synthesis hub when the question spans rights, policy, legislation, enforcement, and historical change across administrations.",
    clusterNote: "Primary page for big-picture impact questions.",
    relatedIds: [
      "presidentsAndBlackAmericans",
      "civilRightsLawsByPresident",
      "presidentialRecordsOnBlackOpportunity",
    ],
  },
  civilRightsLawsByPresident: {
    id: "civilRightsLawsByPresident",
    label: "Civil Rights Laws by President",
    path: "/analysis/civil-rights-laws-by-president",
    status: "live",
    tier: "primary",
    searchIntent: "legislation-focused queries about civil-rights laws by administration",
    uniqueAngle:
      "Primary law-and-enforcement page for federal civil-rights legislation, implementation, and legal context.",
    shouldNotDo:
      "Should not try to own broad impact, promises, or all-purpose presidential-comparison questions.",
    navDescription:
      "Connect federal legislation, policy outcomes, and administrations into one civil-rights research path.",
    clusterEyebrow: "Legislation lens",
    clusterTitle: "Review civil rights laws by president",
    clusterDescription:
      "Use the legislation guide when the question depends on federal law, enforcement, implementation, and administration-level legal context.",
    clusterNote: "Primary page for legislation and enforcement questions.",
    relatedIds: [
      "presidentialImpactOnBlackAmericans",
      "presidentsAndBlackAmericans",
      "campaignPromisesToBlackAmericans",
    ],
  },
  campaignPromisesToBlackAmericans: {
    id: "campaignPromisesToBlackAmericans",
    label: "Campaign Promises to Black Americans",
    path: "/analysis/campaign-promises-to-black-americans",
    status: "live",
    tier: "supporting",
    searchIntent: "campaign promises, commitments, and follow-through for Black Americans",
    uniqueAngle:
      "Promise-versus-outcome page for commitments, delivery, and how rhetoric compares with later records.",
    shouldNotDo:
      "Should not compete with the broad overview or big-picture impact hub for general presidential-impact queries.",
    navDescription:
      "Study commitments to Black Americans, then compare them with policy outcomes, legislation, and presidential context.",
    clusterEyebrow: "Promise lens",
    clusterTitle: "Compare campaign promises and outcomes",
    clusterDescription:
      "Use the promise guide when the question turns on commitments, follow-through, and how rhetoric compared with later policy records.",
    clusterNote: "Supporting page for commitment-and-follow-through questions.",
    relatedIds: [
      "presidentialImpactOnBlackAmericans",
      "presidentsAndBlackAmericans",
      "presidentialRecordsOnBlackOpportunity",
    ],
  },
  howPresidentsShapedBlackOpportunity: {
    id: "howPresidentsShapedBlackOpportunity",
    label: "How Presidents Shaped Black Opportunity",
    path: "/analysis/how-presidents-shaped-black-opportunity",
    status: "live",
    tier: "supporting",
    searchIntent: "systems and governance pathways shaping Black opportunity",
    uniqueAngle:
      "Mechanism-focused page about access, advancement, federal priorities, and the policy systems that shape opportunity.",
    shouldNotDo:
      "Should not try to own documentary-record queries or the broadest presidential-impact synthesis term.",
    navDescription:
      "Study how administrations shaped access, advancement, and opportunity through policy, law, enforcement, and federal priorities.",
    clusterEyebrow: "Opportunity lens",
    clusterTitle: "Study how presidents shaped Black opportunity",
    clusterDescription:
      "Use the opportunity guide when the question centers on access, advancement, governance pathways, and material conditions over time.",
    clusterNote: "Supporting page for opportunity-through-governance questions.",
    relatedIds: [
      "presidentialImpactOnBlackAmericans",
      "presidentsAndBlackAmericans",
      "presidentialRecordsOnBlackOpportunity",
    ],
  },
  presidentialRecordsOnBlackOpportunity: {
    id: "presidentialRecordsOnBlackOpportunity",
    label: "Presidential Records on Black Opportunity",
    path: "/analysis/presidential-records-on-black-opportunity",
    status: "live",
    tier: "supporting",
    searchIntent: "documentary and evidence-oriented review of presidential records on Black opportunity",
    uniqueAngle:
      "Evidence-first page for policies, promises, bills, reports, and record interpretation tied to Black opportunity.",
    shouldNotDo:
      "Should not become the broad synthesis page for overall presidential impact.",
    navDescription:
      "Review documentary and policy records tied to Black opportunity across presidents, promises, legislation, reports, and evidence trails.",
    clusterEyebrow: "Records lens",
    clusterTitle: "Review presidential records on Black opportunity",
    clusterDescription:
      "Use the records guide when you need documentary evidence, policy trails, and methodology rather than broad framing alone.",
    clusterNote: "Supporting page for evidence-heavy review.",
    relatedIds: [
      "presidentialImpactOnBlackAmericans",
      "howPresidentsShapedBlackOpportunity",
      "civilRightsLawsByPresident",
    ],
  },
  blackProgressUnderPresidents: {
    id: "blackProgressUnderPresidents",
    label: "Black Progress Under U.S. Presidents",
    path: "/analysis/black-progress-under-presidents",
    status: "live",
    tier: "supporting",
    searchIntent: "outcomes and measurable change under different presidents",
    uniqueAngle:
      "Outcomes-focused page for measurable change, stalled reform, mixed results, and reversal across administrations.",
    shouldNotDo:
      "Should not compete with the top-level impact hub for the broadest 'presidential impact' searches.",
    navDescription:
      "Use a research framework for comparing policy, legislation, promises, and outcomes across administrations.",
    clusterEyebrow: "Progress lens",
    clusterTitle: "Review measurable progress across administrations",
    clusterDescription:
      "Use the progress guide when the question is about measurable change, mixed outcomes, stalled reform, or reversal under presidents.",
    clusterNote: "Supporting page for outcomes-and-change questions.",
    relatedIds: [
      "presidentialImpactOnBlackAmericans",
      "presidentsAndBlackAmericans",
      "howPresidentsShapedBlackOpportunity",
    ],
  },
  whichPresidentsHelpedBlackAmericans: {
    id: "whichPresidentsHelpedBlackAmericans",
    label: "Which Presidents Helped Black Americans",
    path: null,
    status: "planned",
    tier: "supporting",
    searchIntent: "future evaluative-comparison page for users asking which presidents helped Black Americans",
    uniqueAngle:
      "Reserved future supporting page that would need careful framing around evidence and comparison rather than ranking rhetoric.",
    shouldNotDo:
      "Should not go live until it can be differentiated from the impact and progress pages without collapsing into unsupported rankings.",
  },
};

export const THEMATIC_PAGE_ROLES = THEMATIC_PAGE_DEFINITIONS;

const THEMATIC_NAV_ORDER = [
  "presidentsAndBlackAmericans",
  "presidentialImpactOnBlackAmericans",
  "civilRightsLawsByPresident",
  "campaignPromisesToBlackAmericans",
  "howPresidentsShapedBlackOpportunity",
  "presidentialRecordsOnBlackOpportunity",
  "blackProgressUnderPresidents",
];

export function getThematicPageRole(id) {
  return THEMATIC_PAGE_DEFINITIONS[id] || null;
}

export function getResearchNavItems() {
  return THEMATIC_NAV_ORDER.map((id) => THEMATIC_PAGE_DEFINITIONS[id]).filter(Boolean);
}

export function getRelatedThematicPages(id) {
  const page = getThematicPageRole(id);

  if (!page?.relatedIds?.length) {
    return [];
  }

  return page.relatedIds
    .map((relatedId) => getThematicPageRole(relatedId))
    .filter((item) => item?.status === "live" && item?.path)
    .map((item) => ({
      href: item.path,
      eyebrow: item.clusterEyebrow || "Related theme",
      title: item.clusterTitle || item.label,
      description: item.clusterDescription,
      note: item.clusterNote,
    }));
}
