const FLAGSHIP_PRESIDENTS = {
  "abraham-lincoln": {
    summarySuffix:
      "For most readers, this profile is best used as the starting point for emancipation-era federal change, then paired with later constitutional amendments, Reconstruction records, and longer civil-rights enforcement history.",
    citationDescription:
      "This is one of the site's strongest presidency pages for citing the transition from slavery to Reconstruction-era federal policy. Cite the profile with the page URL and access date, then pair it with the linked policy and legislation pages when precision matters.",
    priorityLinks: [
      {
        href: "/analysis/civil-rights-laws-by-president",
        title: "Trace civil-rights laws across administrations",
        description:
          "Use the legislation guide to move from Lincoln's presidency into the longer legal arc that followed emancipation and Reconstruction.",
      },
    ],
  },
  "lyndon-b-johnson": {
    summarySuffix:
      "This profile is especially useful when the research question centers on mid-20th-century civil-rights legislation, federal enforcement, and the gap between landmark law and later implementation.",
    citationDescription:
      "Use this presidential profile when citing the administration context around the Civil Rights Act, Voting Rights Act, Great Society policy, and the wider federal record affecting Black Americans.",
    priorityLinks: [
      {
        href: "/analysis/civil-rights-laws-by-president",
        title: "Review the law-and-enforcement pathway",
        description:
          "Use the legislation guide to connect this presidency to the broader civil-rights legal record and later enforcement history.",
      },
    ],
  },
  "barack-obama": {
    summarySuffix:
      "This profile is most useful for readers comparing modern administrations across civil rights, criminal justice, housing, health, and economic opportunity rather than isolating one issue area.",
    citationDescription:
      "This page is a strong modern-reference profile because it links presidential scoring, promise tracking, policy drivers, and bill-informed context in one place. Pair it with the methodology page when citing score language.",
    priorityLinks: [
      {
        href: "/analysis/presidential-impact-on-black-americans",
        title: "Use the broader impact guide for cross-administration context",
        description:
          "Move into the impact synthesis page when this presidency becomes part of a larger comparison across recent administrations.",
      },
    ],
  },
};

const FLAGSHIP_POLICIES = {
  2: {
    overviewSuffix:
      "It is one of the site's clearest anchor records for moving from slavery's formal abolition into the longer history of Reconstruction, enforcement, labor coercion, and unequal freedom in practice.",
    citationDescription:
      "This page is especially useful when citing the legal starting point for emancipation-era federal change. It should still be paired with later Reconstruction, enforcement, and civil-rights records rather than treated as a complete endpoint.",
    priorityPath: {
      href: "/analysis/civil-rights-laws-by-president",
      label: "Legislation lens",
      title: "Place the 13th Amendment in the broader civil-rights law timeline",
      description:
        "Use the law-focused guide when the question extends from abolition into later amendments, enforcement laws, and the longer civil-rights record.",
    },
  },
  21: {
    overviewSuffix:
      "It is one of the site's strongest judicial-entry records for readers moving from formal segregation doctrine into education policy, court enforcement, and later civil-rights legislation.",
    citationDescription:
      "This page is useful as a judicial reference point, but it should be paired with later enforcement, implementation, and education-policy records rather than read as self-executing change.",
    priorityPath: {
      href: "/analysis/civil-rights-laws-by-president",
      label: "Judicial and legal context",
      title: "Trace how court decisions fit the broader civil-rights law record",
      description:
        "Use the legislation guide when Brown is part of a larger question about federal law, enforcement, and administration-level follow-through.",
    },
  },
  5: {
    overviewSuffix:
      "It is a flagship law page for readers studying federal civil-rights protections, enforcement capacity, and the way landmark statutes changed the public legal record affecting Black Americans.",
    citationDescription:
      "This is one of the site's best policy pages for external reference because it connects a landmark law to impact framing, evidence, and related records without treating the statute as the whole story.",
    priorityPath: {
      href: "/analysis/civil-rights-laws-by-president",
      label: "Flagship law",
      title: "Review where this law sits in the broader civil-rights legislation pathway",
      description:
        "Use the legislation guide when you need to place the Civil Rights Act alongside later implementation, related statutes, and presidential context.",
    },
  },
  6: {
    overviewSuffix:
      "It is one of the site's highest-value voting-rights records and should be read as both a landmark law and a starting point for later enforcement, narrowing, and rollback debates.",
    citationDescription:
      "Use this page when citing the federal voting-rights record, but pair it with related policies, court decisions, and methodology when the question turns on implementation or later erosion.",
    priorityPath: {
      href: "/analysis/civil-rights-laws-by-president",
      label: "Voting-rights lens",
      title: "Trace voting-rights law across administrations",
      description:
        "Move from this landmark statute into the broader civil-rights law pathway when the question extends to later enforcement and rollback.",
    },
  },
  24: {
    overviewSuffix:
      "It is especially useful for readers studying voting access, the mechanics of exclusion, and the relationship between constitutional change and practical enfranchisement.",
    citationDescription:
      "This page is best cited as part of a larger voting-rights chain. Pair it with related constitutional, statutory, and implementation records rather than treating the amendment as the full voting-rights story.",
    priorityPath: {
      href: "/analysis/civil-rights-laws-by-president",
      label: "Voting-rights lens",
      title: "Review the wider law-and-enforcement path around voting access",
      description:
        "Use the legislation guide when this amendment is part of a larger question about Black enfranchisement and federal enforcement.",
    },
  },
};

const FLAGSHIP_REPORTS = {
  "black-impact-score": {
    cards: [
      {
        title: "What this report is best for",
        description:
          "Use this flagship report when the first question is comparative: how the current public dataset reads across presidents, outcomes, confidence, and category concentration before you open individual records.",
      },
      {
        title: "What this report does not replace",
        description:
          "The score report is a synthesis layer. It does not replace president profiles, policy pages, or the methodology that explains how score language and evidence thresholds work.",
      },
      {
        title: "Best way to cite it",
        description:
          "Cite the report as a structured summary of the current EquityStack model, then pair it with methodology or linked policies when the argument depends on score construction or individual records.",
      },
    ],
    citationDescription:
      "This flagship report is the strongest summary page for citing the current public Black Impact Score model, its visible coverage, and its analytical framing. Pair it with the methodology page or linked policy records when the argument depends on score construction details.",
  },
  "civil-rights-timeline": {
    cards: [
      {
        title: "What this report is best for",
        description:
          "Use the Civil Rights Timeline when sequence matters more than category alone and the reader needs a chronology-first view of expansion, retrenchment, and continuity across eras.",
      },
      {
        title: "What this report helps connect",
        description:
          "This page bridges laws, policy shifts, and historical interpretation. It is especially useful before moving into individual law pages, explainers, or administration-level profiles.",
      },
      {
        title: "Best way to cite it",
        description:
          "Cite this report as a chronology-oriented guide to the public record, then pair it with the underlying law or policy pages when the topic depends on a specific legal or enforcement detail.",
      },
    ],
    citationDescription:
      "This report is best cited when the audience needs a chronology-first reading of the civil-rights record across eras. Pair it with linked policy pages, bills, or explainers when the claim depends on a specific law or implementation detail.",
  },
};

export function getFlagshipPresidentEditorial(slug) {
  return FLAGSHIP_PRESIDENTS[slug] || null;
}

export function getFlagshipPolicyEditorial(id) {
  return FLAGSHIP_POLICIES[Number(id)] || null;
}

export function getFlagshipReportEditorial(slug) {
  return FLAGSHIP_REPORTS[slug] || null;
}
