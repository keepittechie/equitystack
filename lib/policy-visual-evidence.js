export const POLICY_VISUAL_EVIDENCE = {
  6: {
    visualEvidenceBindings: {
      "impact-summary":
        "The chart below shows the clearest measurable change attached to this record: Black voter registration in Mississippi rose sharply once the Voting Rights Act became enforceable.",
    },
    visualEvidence: [
      {
        type: "chart",
        title: "Black voter registration in Mississippi rose sharply after the Voting Rights Act",
        image:
          "/images/evidence/charts/policy-voting-rights-act-of-1965-black-registration-1967.png",
        alt: "Bar chart showing Black voter registration in Mississippi at 6.7 percent in 1964 and 59.8 percent in 1967.",
        caption:
          "This chart shows Black voter registration in Mississippi rising from 6.7% in 1964 to 59.8% in 1967. That matters because this policy page is evaluating whether the Act changed real ballot access rather than only statutory language.",
        sourceLabel: "U.S. Commission on Civil Rights, Chapter 3: Voting Rights in Mississippi Delta",
        sourceUrl: "https://www.usccr.gov/files/pubs/msdelta/ch3.htm",
        sourceType: "government",
        date: "1964-1967",
        notes:
          "Recreated locally from the U.S. Commission on Civil Rights figures used in the policy's demographic-impact seed data.",
        placement: "impact-summary",
      },
    ],
  },
  9: {
    visualEvidenceBindings: {
      "impact-summary":
        "The chart below shows the strongest measurable coverage change attached to this record: the uninsured rate for nonelderly Black Americans fell substantially during the ACA-era expansion period.",
    },
    visualEvidence: [
      {
        type: "chart",
        title: "The Black uninsured rate fell sharply during the Affordable Care Act coverage era",
        image:
          "/images/evidence/charts/policy-affordable-care-act-black-uninsured-rate-2022.png",
        alt: "Bar chart showing the nonelderly Black uninsured rate at 20.9 percent in 2010 and 10.8 percent in 2022.",
        caption:
          "This chart shows the nonelderly Black uninsured rate falling from 20.9% in 2010 to 10.8% in 2022. That matters because this policy page is about whether the ACA changed actual coverage access for Black Americans, not just insurance rules on paper.",
        sourceLabel:
          "U.S. Department of Health and Human Services ASPE, Health Insurance Coverage and Access to Care Among Black Americans",
        sourceUrl:
          "https://aspe.hhs.gov/sites/default/files/documents/4fc0ddbcee8d583d57e399dad6201536/aspe-coverage-access-black-americans-ib.pdf",
        sourceType: "government",
        date: "2010-2022",
        notes:
          "Recreated locally from the HHS ASPE issue-brief figures used in the policy's demographic-impact seed data.",
        placement: "impact-summary",
      },
    ],
  },
  10: {
    visualEvidenceBindings: {
      "impact-summary":
        "The chart below shows where the clearest measured relief landed: most recorded Section 404 resentencing recipients under the First Step Act were Black offenders affected by the earlier crack disparity.",
    },
    visualEvidence: [
      {
        type: "chart",
        title: "Most tracked Section 404 resentencing recipients under the First Step Act were Black offenders",
        image:
          "/images/evidence/charts/policy-first-step-act-section-404-relief-2022.png",
        alt: "Bar chart showing 3,877 Black Section 404 resentencing recipients out of 4,212 recipients with race data through August 2022.",
        caption:
          "This chart shows 3,877 of the 4,212 tracked Section 404 resentencing recipients with race data were Black by August 2022. That matters because the Act's retroactive relief reached a population overwhelmingly shaped by the older crack-cocaine sentencing disparity.",
        sourceLabel:
          "U.S. Sentencing Commission, First Step Act of 2018 Resentencing Provisions Retroactivity Data Report",
        sourceUrl:
          "https://www.ussc.gov/sites/default/files/pdf/research-and-publications/retroactivity-analyses/first-step-act/20220818-First-Step-Act-Retro.pdf",
        sourceType: "government",
        date: "2018-2022",
        notes:
          "Recreated locally from the U.S. Sentencing Commission race-count figures used in the policy's demographic-impact seed data.",
        placement: "impact-summary",
      },
    ],
  },
};

const EMPTY_POLICY_VISUAL_EVIDENCE = {
  visualEvidenceBindings: {},
  visualEvidence: [],
};

export function getPolicyVisualEvidence(policyOrId) {
  const id = Number(policyOrId?.id ?? policyOrId);
  return POLICY_VISUAL_EVIDENCE[id] || EMPTY_POLICY_VISUAL_EVIDENCE;
}
