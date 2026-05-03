const narrativeTagCaution =
  "This tag groups public claim patterns. It does not assign motive, character, or private intent.";

const narrativeTags = [
  {
    id: "systemic-racism-denial",
    label: "Systemic racism denial or minimization",
    description:
      "Claims that systemic racism is not a major factor in present-day racial inequality, or that structural explanations are exaggerated or invalid.",
    narrative_claim_summary:
      "Systemic racism is minimized or rejected as a major factor in present-day racial inequality.",
    why_contested:
      "This framing is contested because many disparities are shaped by institutions, policy history, housing, education, labor markets, criminal justice, and accumulated wealth gaps.",
    evidence_context:
      "Related explainers examine how structural explanations differ from individual or cultural explanations.",
    review_questions: [
      "Does the claim account for policy history?",
      "Does it distinguish individual prejudice from institutional effects?",
      "Does it compare outcomes across housing, labor, education, and criminal justice data?",
    ],
    why_it_matters:
      "This pattern matters because claims that dismiss systemic racism can narrow public understanding of how policy, institutional design, and discrimination shape current inequality.",
    related_explainers: ["systemic-racism-vs-cultural-explanations"],
    caution: narrativeTagCaution,
  },
  {
    id: "culture-over-structure",
    label: "Culture-over-structure explanations",
    description:
      "Claims that Black inequality is primarily caused by culture, family structure, personal behavior, or community norms while minimizing structural policy history.",
    narrative_claim_summary:
      "Culture, family structure, personal behavior, or community norms are presented as the primary explanation for Black inequality.",
    why_contested:
      "This framing is contested when it minimizes economic shocks, discrimination, incarceration, housing policy, labor-market exclusion, or unequal schools.",
    evidence_context:
      "Related explainers compare cultural explanations with structural and economic evidence.",
    review_questions: [
      "Does the claim treat family structure as cause, consequence, or both?",
      "Does it account for labor-market and housing policy history?",
      "Does it avoid overgeneralizing across Black communities?",
    ],
    why_it_matters:
      "This pattern matters because culture-first explanations can shift attention away from documented structural barriers in housing, labor markets, schools, wealth, and policing.",
    related_explainers: [
      "systemic-racism-vs-cultural-explanations",
      "family-structure-economics-and-policy",
    ],
    caution: narrativeTagCaution,
  },
  {
    id: "affirmative-action-dei-harm",
    label: "Affirmative action or DEI as harm",
    description:
      "Claims that affirmative action, DEI, or race-conscious remedies primarily harm Black people, create stigma, or are inherently unfair.",
    narrative_claim_summary:
      "Affirmative action, DEI, or race-conscious remedies are presented primarily as harmful, stigmatizing, unfair, or illegitimate.",
    why_contested:
      "This framing is contested because race-conscious remedies were designed in response to documented exclusion and unequal access, though specific programs can vary in design and outcome.",
    evidence_context:
      "Related explainers review the history of affirmative action, equal protection arguments, and evidence about opportunity access.",
    review_questions: [
      "Does the claim distinguish between different program designs?",
      "Does it acknowledge the historical exclusion the remedy addresses?",
      "Does it separate legal objections from empirical outcome claims?",
    ],
    why_it_matters:
      "This pattern matters because sweeping anti-DEI or anti-affirmative-action narratives can delegitimize remedies created to address documented exclusion without engaging mixed evidence on outcomes.",
    related_explainers: [
      "affirmative-action-and-historical-inequality",
      "equal-protection-under-the-law",
    ],
    caution: narrativeTagCaution,
  },
  {
    id: "black-voter-dependency",
    label: "Black voter dependency or manipulation",
    description:
      "Claims that Black voters are politically dependent, manipulated, controlled, or trapped by one party or policy coalition.",
    narrative_claim_summary:
      "Black voters are described as dependent, manipulated, controlled, or politically trapped by a party or policy coalition.",
    why_contested:
      "This framing is contested because voting behavior can reflect policy preferences, coalition history, civil-rights realignment, candidate choice, and strategic interests rather than dependency.",
    evidence_context:
      "Related explainers provide context on voting rights, equal protection, and political power.",
    review_questions: [
      "Does the claim account for party realignment and civil-rights history?",
      "Does it distinguish persuasion from manipulation?",
      "Does it treat Black voters as political actors with agency?",
    ],
    why_it_matters:
      "This pattern matters because dependency or manipulation frames can understate Black political agency and flatten the historical role of civil-rights conflict, policy preference, and party realignment.",
    related_explainers: [
      "equal-protection-under-the-law",
      "section-2-voting-rights-act-vote-dilution-impact",
    ],
    caution: narrativeTagCaution,
  },
  {
    id: "policing-racial-bias-denial",
    label: "Policing racial-bias denial or minimization",
    description:
      "Claims that racial bias in policing or police violence is overstated, fabricated, or not meaningfully connected to policy or institutions.",
    narrative_claim_summary:
      "Racial bias in policing or police violence is minimized, rejected, or framed as disconnected from institutions or policy.",
    why_contested:
      "This framing is contested because policing outcomes can reflect enforcement patterns, neighborhood conditions, legal standards, reporting practices, and historical police-community relationships.",
    evidence_context:
      "Related explainers and receipts should distinguish individual cases, aggregate data, and policy design.",
    review_questions: [
      "Does the claim distinguish crime rates from enforcement rates?",
      "Does it account for stops, searches, use of force, and charging disparities separately?",
      "Does it rely on one statistic while ignoring other policing outcomes?",
    ],
    why_it_matters:
      "This pattern matters because minimizing policing bias can obscure documented enforcement disparities and weaken public understanding of why mistrust in criminal-justice institutions persists.",
    related_explainers: [],
    caution: narrativeTagCaution,
  },
  {
    id: "colorblind-policy-absolutism",
    label: "Colorblind policy absolutism",
    description:
      "Claims that race-neutral policies are always fair or preferable, regardless of historical inequality or structural context.",
    narrative_claim_summary:
      "Race-neutral or colorblind policy is presented as inherently fair, even when structural inequality or historical exclusion remain unresolved.",
    why_contested:
      "This framing is contested because formally race-neutral rules can operate on top of unequal starting conditions created by segregation, exclusion, unequal schooling, and wealth gaps.",
    evidence_context:
      "Related explainers review equal-protection arguments, the history of affirmative action, and the difference between formal neutrality and substantive access.",
    review_questions: [
      "Does the claim distinguish formal neutrality from equal opportunity in practice?",
      "Does it account for the historical exclusion a race-conscious remedy is addressing?",
      "Does it treat all race-conscious policies as identical even when their design differs?",
    ],
    why_it_matters:
      "This pattern matters because strict colorblind framing can flatten the distinction between race-neutral rules and unequal social conditions, making remedial policy look unnecessary by default.",
    related_explainers: [
      "equal-protection-under-the-law",
      "affirmative-action-and-historical-inequality",
    ],
    caution: narrativeTagCaution,
  },
  {
    id: "merit-over-discrimination",
    label: "Merit over discrimination framing",
    description:
      "Claims that disparities primarily reflect merit, effort, or ability rather than structural discrimination.",
    narrative_claim_summary:
      "Racial disparities are presented mainly as the result of merit, effort, readiness, or ability rather than structural discrimination.",
    why_contested:
      "This framing is contested because measured performance and opportunity are shaped by schooling, housing, wealth, discrimination, labor markets, and institutional access over time.",
    evidence_context:
      "Related explainers compare merit-based arguments with evidence on structural inequality, intergenerational mobility, and institutional barriers.",
    review_questions: [
      "Does the claim treat current outcomes as if prior opportunity were equal?",
      "Does it distinguish individual achievement from unequal access to training, schooling, or networks?",
      "Does it explain how merit is being measured and whether that measure is itself contested?",
    ],
    why_it_matters:
      "This pattern matters because merit-only explanations can shift attention away from how opportunity is produced, constrained, or distributed before any individual competition begins.",
    related_explainers: ["systemic-racism-vs-cultural-explanations"],
    caution: narrativeTagCaution,
  },
  {
    id: "media-racism-exaggeration",
    label: "Media exaggeration of racism",
    description:
      "Claims that racism or racial incidents are overstated, misrepresented, or amplified by media narratives.",
    narrative_claim_summary:
      "Media or political institutions are described as overstating, distorting, or amplifying racism and racial incidents.",
    why_contested:
      "This framing is contested because some incidents do reflect documented patterns of unequal treatment, and undercoverage can coexist with overinterpretation in other cases.",
    evidence_context:
      "Related explainers help distinguish between media framing disputes and the underlying evidence on discrimination, institutions, and historical context.",
    review_questions: [
      "Does the claim separate disagreement over one case from denial of broader patterns?",
      "Does it compare media framing with primary evidence and long-run institutional data?",
      "Does it assume that exaggerated coverage in some cases disproves structural concerns in others?",
    ],
    why_it_matters:
      "This pattern matters because debates about media exaggeration can spill into broader claims that documented racism is itself manufactured, overstated, or politically unreal.",
    related_explainers: ["systemic-racism-vs-cultural-explanations"],
    caution: narrativeTagCaution,
  },
  {
    id: "government-dependency-claim",
    label: "Government dependency claims",
    description:
      "Claims that social programs or civil rights policies primarily create dependency rather than opportunity.",
    narrative_claim_summary:
      "Government programs, welfare policy, or civil-rights remedies are presented mainly as creating dependency rather than opportunity.",
    why_contested:
      "This framing is contested because safety-net and civil-rights policies have mixed effects that depend on design, access, labor markets, housing, and historical exclusion.",
    evidence_context:
      "Related explainers compare dependency claims with evidence on family structure, labor markets, policy design, and the role of structural barriers.",
    review_questions: [
      "Does the claim distinguish short-term relief from long-term opportunity effects?",
      "Does it separate flaws in one policy design from claims about all social programs?",
      "Does it account for labor-market, housing, and wealth conditions that shape how policy works?",
    ],
    why_it_matters:
      "This pattern matters because dependency framing can narrow debate around social policy and civil-rights remedies by assuming their main effect is passivity instead of access or protection.",
    related_explainers: ["family-structure-economics-and-policy"],
    caution: narrativeTagCaution,
  },
  {
    id: "post-civil-rights-resolution",
    label: "Post–civil rights resolution framing",
    description:
      "Claims that major structural racial barriers have largely been resolved and no longer meaningfully affect outcomes.",
    narrative_claim_summary:
      "Major structural racial barriers are presented as largely resolved after the civil-rights era and no longer central to present-day outcomes.",
    why_contested:
      "This framing is contested because formal legal change did not erase unequal wealth, segregated neighborhoods, school inequality, labor-market discrimination, or differential institutional treatment.",
    evidence_context:
      "Related explainers review what changed after the civil-rights era, what persisted, and how legal equality differs from equalized outcomes or opportunity.",
    review_questions: [
      "Does the claim distinguish legal reform from the persistence of unequal conditions?",
      "Does it treat earlier progress as proof that structural barriers disappeared?",
      "Does it compare post-civil-rights gains with continuing disparities in wealth, housing, schools, and policing?",
    ],
    why_it_matters:
      "This pattern matters because treating structural racism as largely settled after civil-rights reform can be used to dismiss continuing barriers as irrelevant or historically obsolete.",
    related_explainers: [
      "affirmative-action-and-historical-inequality",
      "equal-protection-under-the-law",
    ],
    caution: narrativeTagCaution,
  },
];

function normalizeNarrativeTagId(value) {
  return String(value || "").trim().toLowerCase();
}

function cloneNarrativeTag(tag) {
  if (!tag) {
    return null;
  }

  return {
    ...tag,
    related_explainers: Array.isArray(tag.related_explainers)
      ? [...tag.related_explainers]
      : [],
    review_questions: Array.isArray(tag.review_questions)
      ? [...tag.review_questions]
      : [],
  };
}

export function getNarrativeTags() {
  return narrativeTags.map(cloneNarrativeTag);
}

export function getNarrativeTagById(id) {
  const target = normalizeNarrativeTagId(id);
  const tag = narrativeTags.find(
    (item) => normalizeNarrativeTagId(item?.id) === target
  );

  return cloneNarrativeTag(tag);
}

export function getNarrativeTagsByIds(ids = []) {
  const seen = new Set();

  return (Array.isArray(ids) ? ids : [])
    .map((id) => normalizeNarrativeTagId(id))
    .filter((id) => id && !seen.has(id) && seen.add(id))
    .map((id) => getNarrativeTagById(id))
    .filter(Boolean);
}
