export const PROMISE_VISUAL_EVIDENCE = {
  "obama-crack-sentencing-disparity": {
    visualEvidenceBindings: {
      status:
        "The chart below shows the clearest measurable before-and-after change tied to this promise: average federal crack sentences fell after the Fair Sentencing Act changed the statutory disparity.",
    },
    visualEvidence: [
      {
        type: "chart",
        title: "Average federal crack sentences fell after Fair Sentencing Act implementation",
        image:
          "/images/evidence/charts/promise-obama-crack-sentencing-disparity-average-sentence-2011.png",
        alt: "Bar chart showing average federal crack-cocaine sentences at 111 months in fiscal year 2010 and 101 months in fiscal year 2011.",
        caption:
          "This chart shows average federal crack sentences falling from 111 months in FY2010 to 101 months in FY2011. That matters because Black defendants made up most federal crack defendants at baseline, so the promise's legal follow-through changed a penalty structure with clear Black-impact relevance.",
        sourceLabel:
          "U.S. Sentencing Commission, Report to the Congress: Impact of the Fair Sentencing Act of 2010",
        sourceUrl:
          "https://www.ussc.gov/sites/default/files/pdf/news/congressional-testimony-and-reports/drug-topics/201507_RtC_Fair-Sentencing-Act.pdf",
        sourceType: "government",
        date: "FY2010-FY2011",
        notes:
          "Recreated locally from U.S. Sentencing Commission sentence averages used in the promise demographic-impact seed data.",
        placement: "status",
      },
    ],
  },
  "biden-advance-racial-equity": {
    visualEvidenceBindings: {
      status:
        "The source snapshot below shows the executive order that turned the racial-equity pledge into an official government-wide directive.",
    },
    visualEvidence: [
      {
        type: "source-snapshot",
        title: "Executive Order 13985 made agency equity review an official federal directive",
        image:
          "/images/evidence/documents/promise-biden-advance-racial-equity-equity-order-2021.png",
        alt: "Document snapshot of Executive Order 13985 showing the order title and opening policy section on advancing racial equity through the federal government.",
        caption:
          "This source snapshot shows the order text that directed agencies to assess barriers and advance equity. That matters because this promise page is judging whether the administration moved from rhetoric into formal federal instruction.",
        sourceLabel: "Federal Register, Executive Order 13985",
        sourceUrl: "https://www.govinfo.gov/content/pkg/FR-2021-01-25/pdf/2021-01753.pdf",
        sourceType: "government",
        date: "January 20, 2021",
        notes:
          "Rendered locally from the official Federal Register PDF because the directive language itself is the evidence artifact.",
        placement: "status",
      },
    ],
  },
  "trump-ensure-long-term-hbcu-funding": {
    visualEvidenceBindings: {
      status:
        "The source snapshot below shows the enrolled FUTURE Act text that shifted HBCU support from expiring years into continuing federal funding.",
    },
    visualEvidence: [
      {
        type: "source-snapshot",
        title: "The FUTURE Act locked recurring HBCU support into continuing federal law",
        image:
          "/images/evidence/documents/promise-trump-ensure-long-term-hbcu-funding-future-act-2019.png",
        alt: "Document snapshot of the enrolled FUTURE Act showing the bill title and Section 2 language extending support for minority-serving institutions into each fiscal year thereafter.",
        caption:
          "This source snapshot shows the enrolled bill text extending support for HBCUs and other minority-serving institutions into each fiscal year thereafter. That matters because the promise page is judging whether support became durable federal law rather than a short-lived announcement.",
        sourceLabel: "GovInfo enrolled bill text for H.R. 5363, the FUTURE Act",
        sourceUrl:
          "https://www.govinfo.gov/content/pkg/BILLS-116hr5363enr/pdf/BILLS-116hr5363enr.pdf",
        sourceType: "government",
        date: "December 19, 2019",
        notes:
          "Rendered locally from the official enrolled-bill PDF because the exact funding-extension language is the evidence artifact.",
        placement: "status",
      },
    ],
  },
};

const EMPTY_PROMISE_VISUAL_EVIDENCE = {
  visualEvidenceBindings: {},
  visualEvidence: [],
};

export function getPromiseVisualEvidence(promiseOrSlug) {
  const slug = String(promiseOrSlug?.slug ?? promiseOrSlug ?? "").trim();
  return PROMISE_VISUAL_EVIDENCE[slug] || EMPTY_PROMISE_VISUAL_EVIDENCE;
}
