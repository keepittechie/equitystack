const EXPLAINER_EDITORIAL = {
  // Misused Statistic Explainer Pattern
  // Use this structure for statistics frequently used in misleading ways:
  // 1. Historical framing
  // 2. Claim or misconception
  // 3. What the data actually measures
  // 4. Why the comparison is incomplete
  // 5. Context the statistic leaves out
  // 6. What the statistic does not prove
  // 7. Common misinterpretations
  // 8. How to respond in a debate
  // 9. Better way to understand the issue
  // 10. EquityStack takeaway
  //
  // Debate-response sections should use:
  // Common claim / Better response / Key question to ask.
  //
  // Source standard: use 3-6 high-quality sources through the existing
  // explainer_sources system, mixing primary data and contextual research.
  "party-switch-southern-strategy": {
    lens: "Political realignment guide",
    pagePurpose:
      "Use this page when the question is about party realignment, civil-rights politics, and how presidential eras reshaped the relationship between party labels and Black voters.",
    whyThisMatters:
      "This topic is frequently reduced to a slogan about which party once held which position. EquityStack treats it instead as a record question tied to civil-rights law, voting rights, presidential strategy, and long-term coalition change.",
    questions: [
      "How did civil-rights law and presidential politics reshape party coalitions?",
      "Which administrations mattered most in the shift from party labels to modern ideological alignment?",
      "How do voting-rights cases and later rollback fit into the longer realignment story?",
    ],
    researchPaths: [
      {
        href: "/analysis/presidents-and-black-americans",
        eyebrow: "Thematic guide",
        title: "Explore presidents and Black Americans as a broader historical question",
        description:
          "Use the overview guide when you want to place party realignment inside the wider presidential record on Black Americans.",
      },
      {
        href: "/analysis/civil-rights-laws-by-president",
        eyebrow: "Legislation path",
        title: "Trace civil-rights laws across administrations",
        description:
          "Move from coalition change into the federal laws and court decisions that made party alignment matter in practice.",
      },
    ],
    structuredSections: [
      {
        title: "Where Black impact is already visible",
        body:
          "The clearest Black-impact channel here is political power. Party realignment changed which coalition most strongly defended civil-rights enforcement, voting rights, and Black representation. As Black voters became a core Democratic constituency and many white southern conservatives moved toward the Republican Party, the stakes were not only symbolic. They affected who governed, what laws passed, and how rights were defended or resisted.",
      },
      {
        title: "What implementation evidence already shows",
        body:
          "This topic is strongest when readers move past slogans and look at institutions. Truman's civil-rights moves, the Civil Rights Act, the Voting Rights Act, and later strategic appeals around law and order, states' rights, and federal intervention all show that realignment was tied to actual policy conflict. The parties were not simply renamed versions of their 19th-century selves.",
      },
      {
        title: "What this evidence can support",
        body:
          "The evidence strongly supports a long-term realignment claim: modern party coalitions, especially in the South, changed substantially around civil rights. It also supports the narrower point that Black political alignment with Democrats cannot be understood apart from which party increasingly backed federal civil-rights action.",
      },
      {
        title: "What this evidence cannot prove on its own",
        body:
          "This evidence does not support a cartoonish overnight switch, nor does it prove that every politician or voter moved at the same time or for the same reason. Realignment was gradual, uneven, and layered. The strongest interpretation is about coalition change over time, not instant identity replacement.",
      },
      {
        title: "Why labels mislead",
        body:
          "Party names are durable; party coalitions are not. That is why historical arguments built only on the phrase Democratic Party or Republican Party are usually too weak. The better question is what each coalition stood for, who it was trying to mobilize, and what laws or strategies it defended in the period being discussed.",
      },
    ],
  },
  "redlining-black-homeownership": {
    lens: "Housing and wealth guide",
    pagePurpose:
      "Use this page when you need to connect housing discrimination, federal mortgage policy, and Black wealth-building to a concrete policy record.",
    whyThisMatters:
      "Housing policy is one of the clearest examples of how federal rules, local implementation, and lending systems shaped Black opportunity over time. This explainer works best as an entry point into the site’s housing, wealth, and opportunity records.",
    questions: [
      "How did federal housing policy shape Black homeownership and wealth?",
      "Which laws and institutions reinforced exclusion, and which later reforms tried to address it?",
      "How does housing history connect to broader questions about Black opportunity under presidents?",
    ],
    researchPaths: [
      {
        href: "/analysis/how-presidents-shaped-black-opportunity",
        eyebrow: "Opportunity path",
        title: "Review policies affecting access and advancement",
        description:
          "Use the opportunity guide to place housing policy alongside education, labor, credit, and public investment.",
      },
      {
        href: "/analysis/presidential-impact-on-black-americans",
        eyebrow: "Impact path",
        title: "Study housing inside the broader presidential impact record",
        description:
          "Move outward from redlining into the larger question of how administrations shaped Black Americans through law and enforcement.",
      },
    ],
    referenceCards: [
      {
        title: "Why readers cite this explainer",
        description:
          "This is one of the site's strongest reference pages for housing discrimination because it connects a familiar term to federal policy history, wealth effects, and the records needed for verification.",
      },
      {
        title: "What it covers best",
        description:
          "Use this page for the housing-policy frame first, then move into policy records, opportunity pages, and reports when you need legislation, implementation, or long-term comparison.",
      },
      {
        title: "What to pair it with",
        description:
          "Pair this explainer with the methodology page, housing-related policy records, and the opportunity thematic pages when the topic moves from history into evidence-backed interpretation.",
      },
    ],
    structuredSections: [
      {
        title: "Where Black impact is already visible",
        body:
          "The Black-impact channel here is direct. Homeownership is one of the main ways families build wealth, gain housing stability, borrow against appreciating assets, and transfer resources across generations. When Black families were denied fair access to mortgage credit, the effect was not limited to one housing decision. It shaped wealth, neighborhood opportunity, school access, business formation, and the ability to pass assets to children.\n\nThat is why redlining should not be treated as a narrow cartographic curiosity. It was a mechanism through which unequal access to credit became unequal access to wealth.",
      },
      {
        title: "What implementation evidence already shows",
        body:
          "This topic is strongest when readers move from moral language into institutional mechanics. The federal government helped build the modern mortgage market through FHA-era housing policy, later created disclosure tools like HMDA, and still relies on fair-lending enforcement to address redlining in the present.\n\nThat implementation record matters because it shows both sides of the history: the state helped structure the housing system in ways that excluded Black families, and later had to create data and enforcement tools to detect and respond to discriminatory lending patterns that persisted.",
      },
      {
        title: "Why modern enforcement matters",
        body:
          "One of the most important upgrades to this explainer is that the source base no longer ends in the 1970s. Modern CFPB and DOJ enforcement actions still describe illegal redlining in majority-Black neighborhoods. That does not mean present-day redlining is identical to the HOLC era, but it does mean the underlying question of unequal credit access is still active.\n\nThis helps readers avoid two mistakes at once: treating redlining as a dead historical issue, or collapsing every modern disparity into the exact same mechanism. The stronger claim is narrower and more defensible: historic exclusion built durable inequality, and discriminatory mortgage access still appears in modern enforcement records.",
      },
    ],
  },
  "homestead-act-exclusion": {
    lens: "Land and opportunity guide",
    pagePurpose:
      "Use this page when the question is about land access, wealth-building, and why formal eligibility did not produce equal opportunity in practice.",
    whyThisMatters:
      "The Homestead Act is often cited as proof that opportunity was broadly available. This explainer helps readers evaluate that claim through the conditions that shaped access, enforcement, and long-term wealth accumulation.",
    questions: [
      "How did land policy fit into the larger history of Black opportunity and exclusion?",
      "What does this topic show about the gap between legal access and practical access?",
      "How should readers connect 19th-century land policy to later debates about wealth and reparative policy?",
    ],
    researchPaths: [
      {
        href: "/analysis/how-presidents-shaped-black-opportunity",
        eyebrow: "Opportunity path",
        title: "See how public policy shaped Black opportunity over time",
        description:
          "Use the opportunity guide when the question extends from land access into later federal pathways to wealth and advancement.",
      },
      {
        href: "/analysis/presidential-records-on-black-opportunity",
        eyebrow: "Records path",
        title: "Review documentary records tied to Black opportunity",
        description:
          "Move into the records guide for a more evidence-first read of how opportunity claims should be tested across presidencies.",
      },
    ],
    structuredSections: [
      {
        title: "Where Black impact is already visible",
        body:
          "The Black-impact issue here is asset ownership. Land is not just acreage. It can produce food, income, collateral, family stability, and inheritance. If Black families faced weaker practical access to one of the country's biggest land-transfer opportunities, the effect would reach far beyond the first generation of claimants.",
      },
      {
        title: "What implementation evidence already shows",
        body:
          "The implementation record matters more than the statutory text by itself. Formal eligibility under the Homestead Act did not erase the realities of emancipation, missing capital, weak federal protection, racial terror, and the short life of Reconstruction institutions like the Freedmen's Bureau. The law may have been open on paper without being equally usable in practice.",
      },
      {
        title: "What this evidence can support",
        body:
          "The evidence supports a bounded but important claim: the Homestead Act was a major public wealth-building program, and Black Americans entered it from conditions that made equal benefit far harder to achieve. That is enough to challenge simplistic claims that America had already distributed equal opportunity through land policy.",
      },
      {
        title: "What this evidence cannot prove on its own",
        body:
          "This evidence does not show that the Homestead Act explicitly banned all Black claimants or that no Black families benefited. Some Black homesteaders did claim and keep land. The stronger argument is about unequal practical access and unequal capacity to convert eligibility into durable ownership.",
      },
      {
        title: "Why this still matters",
        body:
          "Land ownership is one of the clearest ways policy can become intergenerational wealth. That is why this topic belongs in present-day debates about inequality: unequal access to early asset-building opportunities compounds over time.",
      },
    ],
  },
  "government-benefits-racial-gap": {
    lens: "Public investment and exclusion guide",
    pagePurpose:
      "Use this page when you want to study how government benefits, subsidies, and wealth-building programs operated unevenly across racial lines.",
    whyThisMatters:
      "This topic connects multiple policy lanes at once: housing, labor, education, and wealth-building. It helps readers move from a broad debate about public support into the record of who had access to which benefits, and when.",
    argumentReady: {
      claim:
        "Government help was broadly available, so current racial gaps cannot be tied to unequal access to public benefits.",
      whyMisleading:
        "That argument treats public support as neutral in practice even though land, mortgages, education, labor protections, and veterans benefits all ran through institutions that often distributed opportunity unevenly.",
      dataShows: [
        "Public policy repeatedly helped build wealth, stability, and mobility through land access, housing finance, labor protection, education, and veterans benefits.",
        "Those benefits depended on real delivery systems such as banks, colleges, agencies, and local gatekeepers rather than abstract eligibility alone.",
        "Black Americans often faced weaker access across multiple benefit channels, which compounded over time.",
        "The stronger historical question is not whether public help existed. It is who could use it fully.",
      ],
      bottomLine:
        "The historical record does not support simple handout rhetoric. It shows repeated public investment and repeated unequal access to its benefits.",
      responseScript:
        "That argument leaves out how often government built wealth through land, mortgages, labor rules, education, and veterans benefits. The real historical question is not whether public help existed. It is who had full access to it.",
      responseContext:
        "Use when public benefits are discussed as if they were neutral in practice or unique to Black communities.",
    },
    questions: [
      "How did public benefits shape wealth and opportunity for different communities?",
      "Which policy areas most clearly show unequal access to government-backed advantage?",
      "How should readers connect benefits history to present-day debates about equity and opportunity?",
    ],
    researchPaths: [
      {
        href: "/analysis/how-presidents-shaped-black-opportunity",
        eyebrow: "Opportunity path",
        title: "Study how public policy shaped access and advancement",
        description:
          "Use the opportunity guide to connect benefits history to education, housing, labor, and federal investment.",
      },
      {
        href: "/analysis/black-progress-under-presidents",
        eyebrow: "Outcomes path",
        title: "Review where progress changed across administrations",
        description:
          "Move into the progress guide when the question shifts from benefit design to measurable change or persistent gaps.",
      },
    ],
    structuredSections: [
      {
        title: "Where Black impact is already visible",
        body:
          "The Black-impact issue here is cumulative access. Land, mortgages, labor protections, education, and veterans benefits all shape wealth and security. If Black Americans faced weaker access across several of those channels, the resulting gap would be larger than any one program can explain by itself.",
      },
      {
        title: "What implementation evidence already shows",
        body:
          "This is not a theory about abstract bias alone. The implementation record shows that public support ran through institutions: land offices, banks, colleges, labor rules, agencies, and local gatekeepers. Those institutions often distributed opportunity unevenly even when the federal benefit looked broad in statutory language.",
      },
      {
        title: "What this evidence can support",
        body:
          "The evidence supports a strong historical claim that government helped create middle-class security and wealth, while access to those gains was often racially uneven. This helps explain why modern debates that oppose public help in the abstract are historically incomplete.",
      },
      {
        title: "What this evidence cannot prove on its own",
        body:
          "This evidence does not mean every benefit program worked the same way or that every racial wealth gap can be traced to one policy lane. The stronger claim is cumulative and cross-systemic: repeated unequal access to public support widened later disparities.",
      },
      {
        title: "Why handout rhetoric fails",
        body:
          "The phrase handout is usually used selectively. A more defensible historical frame is that the United States repeatedly used public policy to build private stability and wealth. The question was never whether help existed. The question was who could use it fully.",
      },
    ],
  },
  "immigration-and-black-resources": {
    lens: "Scarcity and policy-choice guide",
    pagePurpose:
      "Use this page when the debate claims immigrants are taking resources from Black communities and the first task is to separate benefit-eligibility rules from the longer policy record on underinvestment and exclusion.",
    whyThisMatters:
      "This topic is often framed as a conflict between two struggling communities. The stronger record question is how governments wrote eligibility rules, budget priorities, and enforcement systems that shaped scarcity in the first place.",
    argumentReady: {
      claim:
        "Immigrants are taking resources meant for Black Americans.",
      whyMisleading:
        "That frame blames another vulnerable community for problems created by policy design and underinvestment, and it often ignores that undocumented immigrants are barred from many major federal benefits.",
      dataShows: [
        "Major federal benefit programs use detailed immigration-status rules rather than open-ended access.",
        "Undocumented immigrants are generally barred from most major federal means-tested benefits.",
        "Even lawful immigrants can face waiting periods or category limits depending on the program and the state.",
        "Scarcity in Black communities is better explained by housing, education, labor, and budget policy choices than by a simple immigrant-takes-the-benefits story.",
      ],
      bottomLine:
        "Resource scarcity is mainly a policy and budget problem, not proof that immigrants are stealing resources from Black communities.",
      responseScript:
        "That argument blames another struggling community for problems created by policy choices. Undocumented immigrants are barred from most federal public benefits, and Black communities have been underfunded through housing, education, labor, and criminal justice policy for generations.",
      responseContext:
        "Use when immigration is blamed for scarcity in Black communities.",
    },
    questions: [
      "What federal rules actually govern immigrant eligibility for major public benefits?",
      "Why is resource scarcity in Black communities better explained through policy choices than through a zero-sum immigrant frame?",
      "How should readers respond when two vulnerable communities are being treated as policy rivals?",
    ],
    researchPaths: [
      {
        href: "/explainers/government-benefits-racial-gap",
        eyebrow: "Related explainer",
        title: "Review the broader record on public benefits and unequal access",
        description:
          "Use the companion explainer when the next step is tracing how government support built wealth and security unevenly across racial lines.",
      },
      {
        href: "/explainers/bootstraps-vs-policy-reality",
        eyebrow: "Mobility context",
        title: "Move from scarcity rhetoric into the wider policy-opportunity story",
        description:
          "Use the mobility explainer when the debate shifts from public benefits into who actually had access to housing, labor, and education ladders.",
      },
    ],
    relatedExplainers: [
      "government-benefits-racial-gap",
      "bootstraps-vs-policy-reality",
      "redlining-black-homeownership",
    ],
    sourceContexts: [
      {
        title: "Overview of Immigrants' Eligibility for SNAP, TANF, Medicaid, and CHIP",
        sourceType: "government",
        sourceNote:
          "HHS overview of how federal eligibility restrictions vary across major benefit programs.",
      },
      {
        title: "Eligibility for Non-Citizens in Medicaid and CHIP",
        sourceType: "government",
        sourceNote:
          "Federal Medicaid guidance on status-based eligibility and state-option coverage.",
      },
      {
        title: "Information for Aliens Applying for a Public Benefit",
        sourceType: "government",
        sourceNote:
          "USCIS page explaining immigration-status verification for public benefits.",
      },
      {
        title: "Federal Housing Administration History",
        sourceType: "government",
        sourceNote:
          "Federal housing history for the longer record on unequal public investment and access.",
      },
      {
        title: "Brown v. Board of Education (1954)",
        sourceType: "government",
        sourceNote:
          "Official civil-rights source that helps place school inequality in historical context.",
      },
    ],
    structuredSections: [
      {
        title: "Where Black impact is already visible",
        body:
          "The strongest Black-impact issue here is not a single benefits application. It is long-run public investment. Black communities have lived with unequal access to housing credit, school quality, labor-market protection, neighborhood investment, and equal treatment by public institutions. Those constraints created scarcity long before modern immigration arguments were packaged as zero-sum competition.",
      },
      {
        title: "What implementation evidence already shows",
        body:
          "The implementation record weakens the popular claim. Major federal benefit systems do not simply open the door to anyone who arrives. Immigration status, lawful presence rules, waiting periods, and state-option design all matter. That means the strongest factual question is not whether immigrants somehow bypassed the line, but how benefit rules are actually written and enforced.",
      },
      {
        title: "What this evidence can support",
        body:
          "The evidence supports a bounded but important claim: resource scarcity in Black communities is better explained through policy design, underinvestment, and unequal access than through a story about immigrants taking benefits that were otherwise fully available to Black Americans.",
      },
      {
        title: "What this evidence cannot prove on its own",
        body:
          "This evidence does not prove that immigration never affects local budgets or service demand in any context. The stronger point is narrower. It is that the broad claim about immigrants taking resources from Black communities does not match the federal eligibility rules or the deeper history of how Black communities were underinvested in the first place.",
      },
      {
        title: "Why divide-and-blame rhetoric fails",
        body:
          "The rhetoric sounds like an allocation argument, but it often works by erasing the decision-makers. Budgets are written by governments. Eligibility rules are written by governments. Segregation, unequal schools, weak labor protections, and disinvestment were all policy choices. Once those choices are restored to the story, the simple blame frame becomes much harder to defend.",
      },
    ],
  },
  "equal-protection-under-the-law": {
    lens: "Constitutional and civil-rights guide",
    pagePurpose:
      "Use this page when you need a constitutional frame for later questions about civil-rights law, equal treatment, enforcement, and the gap between legal guarantees and lived outcomes.",
    whyThisMatters:
      "Equal protection is one of the site’s strongest bridge topics because it links constitutional principle, court decisions, presidential enforcement, and later civil-rights legislation. It is a legal concept, but it only becomes meaningful when paired with actual records.",
    questions: [
      "How did equal-protection doctrine interact with real-world policy and enforcement?",
      "Which laws and court decisions changed the meaning of equal protection across eras?",
      "Why does formal legal equality still require historical and policy context?",
    ],
    researchPaths: [
      {
        href: "/analysis/civil-rights-laws-by-president",
        eyebrow: "Legislation path",
        title: "Review civil-rights laws by president",
        description:
          "Use the law-focused guide to move from constitutional principle into specific federal statutes and enforcement history.",
      },
      {
        href: "/analysis/presidential-impact-on-black-americans",
        eyebrow: "Impact path",
        title: "Place equal protection inside the broader presidential record",
        description:
          "Move into the impact guide when you want to connect doctrine to administrations, rights, and long-term policy change.",
      },
    ],
    referenceCards: [
      {
        title: "Why readers cite this explainer",
        description:
          "This is one of the site's strongest constitutional bridge pages because it explains the legal principle, then routes readers into the laws, court records, and administrations that gave that principle real force or limitation.",
      },
      {
        title: "What it covers best",
        description:
          "Use this page when the reader needs a constitutional or legal frame before opening civil-rights laws, president pages, or enforcement-focused records.",
      },
      {
        title: "What to pair it with",
        description:
          "Pair it with the civil-rights legislation guide, related policy records, and the source library when the topic turns from doctrine to specific legal claims.",
      },
    ],
    structuredSections: [
      {
        title: "Where Black impact is already visible",
        body:
          "Black Americans are the central population for understanding this doctrine historically. The Equal Protection Clause was written in the aftermath of slavery, but Black Americans then lived through segregation, disenfranchisement, discriminatory housing systems, and unequal access to remedies despite that constitutional promise.",
      },
      {
        title: "What implementation evidence already shows",
        body:
          "The implementation story is the doctrine. Courts, Congress, and agencies gave equal protection practical meaning or practical weakness. Plessy showed how the Court could hollow out the guarantee. Brown and later civil-rights statutes showed how the federal government could revive and enforce it more aggressively.",
      },
      {
        title: "What this evidence can support",
        body:
          "The evidence strongly supports the claim that equal protection is a legal standard that requires interpretation and enforcement. It is not a self-executing guarantee of equal life outcomes, nor even of equal treatment in practice without supporting institutions.",
      },
      {
        title: "What this evidence cannot prove on its own",
        body:
          "This evidence does not mean every disparity is automatically an equal-protection violation. Constitutional litigation imposes specific doctrinal tests and evidentiary burdens. The stronger historical claim is that constitutional equality and practical equality have often diverged.",
      },
      {
        title: "Why doctrine is not enough",
        body:
          "A constitutional promise matters, but only when readers also ask who could invoke it, who could enforce it, and which institutions were willing to honor it. That is the difference between citing equal protection and understanding equal protection.",
      },
    ],
  },
  "sentencing-disparities-united-states": {
    lens: "Sentencing and justice guide",
    pagePurpose:
      "Use this page when the question is about how criminal law, sentencing rules, and institutional discretion shaped unequal punishment.",
    whyThisMatters:
      "Sentencing is one of the clearest areas where legal design, enforcement choices, and racialized outcomes intersect. This explainer helps readers move from abstract fairness claims into specific laws, reforms, and measurable policy effects.",
    argumentReady: {
      claim:
        "Tough sentencing is race-neutral because it punishes conduct, not race.",
      whyMisleading:
        "Formally neutral rules can still generate patterned racial disparity when thresholds, mandatory minimums, charging choices, plea leverage, and relief rules operate unevenly across the system.",
      dataShows: [
        "Sentencing outcomes are shaped before final judgment through statutes, charging decisions, plea terms, sentencing guidelines, and access to relief.",
        "Federal cocaine sentencing policy created one of the clearest racially unequal punishment frameworks in modern U.S. law.",
        "Disparity can emerge through the interaction of legal design and institutional discretion rather than through one single decision point.",
        "Later reforms narrowed some disparities, which shows the punishment structure was not fixed or inevitable.",
      ],
      bottomLine:
        "Calling a sentencing rule neutral is not enough. The policy design and enforcement path can still produce unequal punishment.",
      responseScript:
        "Calling a sentencing rule race-neutral is not enough. The record shows that thresholds, mandatory minimums, charging, and plea leverage can produce unequal punishment even without overtly racial language.",
      responseContext:
        "Use when someone equates tough-on-crime sentencing with fair and equal enforcement.",
    },
    questions: [
      "Which sentencing laws produced the clearest unequal impacts?",
      "How did presidential administrations shape sentencing through legislation and enforcement priorities?",
      "Where did reform narrow disparities, and where did major gaps remain?",
    ],
    researchPaths: [
      {
        href: "/analysis/presidential-impact-on-black-americans",
        eyebrow: "Impact path",
        title: "Study criminal-justice policy inside the broader presidential record",
        description:
          "Use the impact guide when sentencing is part of a larger question about administrations and Black Americans.",
      },
      {
        href: "/analysis/black-progress-under-presidents",
        eyebrow: "Outcomes path",
        title: "Review how justice outcomes changed across administrations",
        description:
          "Move into the outcomes guide when the question shifts from sentencing design to change, reversal, or stalled reform.",
      },
    ],
    structuredSections: [
      {
        title: "Where Black impact is already visible",
        body:
          "The Black-impact channel is direct because sentence length shapes incarceration, supervision, family separation, earnings, and long-run community stability. Federal crack sentencing is one of the clearest examples of a punishment structure that fell heavily on Black defendants and Black communities.",
      },
      {
        title: "What implementation evidence already shows",
        body:
          "The implementation story is broader than a judge's final ruling. Legislatures set thresholds and mandatory minimums. Prosecutors decide charges and plea terms. Sentencing commissions shape guidelines. Relief from mandatory penalties is uneven. Disparity can emerge at several stages before the sentence is formally announced.",
      },
      {
        title: "What this evidence can support",
        body:
          "The evidence supports a strong structural claim: unequal sentencing outcomes are produced by the interaction of legal design and institutional discretion. It also supports a narrower claim that federal cocaine sentencing policy created one of the clearest racially unequal punishment frameworks in modern U.S. law.",
      },
      {
        title: "What this evidence cannot prove on its own",
        body:
          "This evidence does not prove that every sentence difference in every case is the product of racial discrimination. The stronger point is systemic: formally neutral institutions can still produce patterned differences in punishment that persist across cases and over time.",
      },
      {
        title: "Why reform is incomplete",
        body:
          "The Fair Sentencing Act and First Step Act matter because they show the system was changeable. But the fact that later reforms were necessary is itself part of the story. Some disparities were narrowed without being fully eliminated.",
      },
    ],
  },
  "crime-statistics-context-and-misuse": {
    lens: "Crime data and public-claims guide",
    pagePurpose:
      "Use this page when a crime statistic is being used to make a broader argument about race, law, or policy and you need a cleaner research frame first.",
    whyThisMatters:
      "This explainer works as a gateway page for readers who arrive through a polarizing search query but need context on measurement, enforcement, and the difference between data systems before moving into criminal-justice policy records.",
    questions: [
      "What do crime statistics actually measure, and what do they leave out?",
      "How do crime debates connect to criminal-justice policy and sentencing law?",
      "Why is context necessary before crime numbers are used to support larger claims about race or policy?",
    ],
    researchPaths: [
      {
        href: "/analysis/presidential-impact-on-black-americans",
        eyebrow: "Impact path",
        title: "Move from crime rhetoric into presidential impact records",
        description:
          "Use the impact guide when the question expands beyond statistics into law, enforcement, and administration-level change.",
      },
      {
        href: "/analysis/presidential-records-on-black-opportunity",
        eyebrow: "Records path",
        title: "Review the evidence trail behind criminal-justice claims",
        description:
          "The records guide helps when you want a more evidence-oriented reading of how public claims connect to laws and outcomes.",
      },
    ],
    structuredSections: [
      {
        title: "Where Black impact is already visible",
        body:
          "The Black-impact issue here is not only about measurement error. It is about interpretive harm. Race-and-crime slogans are often used to justify harsher policing, longer punishment, and moralized judgments about Black communities without doing the methodological work required to support those claims.",
      },
      {
        title: "What implementation evidence already shows",
        body:
          "Different federal systems were built to answer different questions. FBI reporting tracks crimes known to law enforcement and related administrative outcomes. The NCVS captures victimization beyond what is reported to police. Clearance rules matter because many crimes never produce an arrest. Once readers see those institutional differences, the slogan loses much of its apparent simplicity.",
      },
      {
        title: "What this evidence can support",
        body:
          "The evidence strongly supports a methodological warning: compressed race-and-crime claims often mix unlike categories and ask law-enforcement statistics to prove more than they can. That is enough to reject simplistic conclusions drawn from the slogan alone.",
      },
      {
        title: "What this evidence cannot prove on its own",
        body:
          "This evidence does not mean crime data are useless or that all differences disappear under closer review. The stronger point is narrower: careful interpretation is required, and broad racial claims should not be built from mixed measures and stripped context.",
      },
      {
        title: "Why measurement discipline matters",
        body:
          "Once public arguments jump from raw numbers to racial essentialism, bad measurement turns into bad policy. That is why this explainer belongs at the front of the criminal-justice reading path rather than at the end.",
      },
    ],
  },
  "understanding-13-50-crime-statistic": {
    explainer_type: "misused_statistic",
    category: "misused-statistics",
    tags: ["crime", "statistics", "race", "policing", "data-analysis"],
    relatedExplainers: ["white-house-dei-economic-study"],
    argumentReady: {
      claim:
        "Black Americans are about 13 percent of the population but account for about half of murders or violent crime, so the data prove inherent criminality.",
      whyMisleading:
        "The claim compresses different datasets into a racial conclusion the data cannot support. Arrest, reported-crime, clearance, and homicide figures do not measure the same thing, and none of them establish inherent traits or causation on their own.",
      dataShows: [
        "Common versions of the claim rely on law-enforcement data such as arrests, crimes known to police, clearances, or homicide records rather than a full measure of total offending.",
        "The numbers can show a disparity, but they do not establish why the disparity exists or prove inherent criminality.",
        "Age, gender, geography, poverty exposure, reporting patterns, policing, and victimization all affect how the data should be interpreted.",
        "Black Americans are also disproportionately victims of serious violence, which the slogan often leaves out.",
        "Group-level statistics do not justify profiling individual people by race.",
      ],
      bottomLine:
        "The statistic can support a discussion of disparity and public safety. It cannot support racial essentialism, profiling, or the claim that a population share explains causation by itself.",
      responseScript:
        "That claim leaves out important context. It usually relies on arrest, reported-crime, clearance, or homicide data, not a full measure of total offending, and it does not prove inherent criminality or causation.",
      responseContext:
        "Use when someone turns a crime statistic into a racial conclusion.",
    },
    argumentMode: {
      summary:
        "The '13/50' claim is usually presented as if it proves something about Black people as a group. The actual data is narrower and does not support that conclusion.",
      keyPoints: [
        "Arrest data is not total crime.",
        "Disparity does not equal causation.",
        "Context variables matter, including age, poverty, geography, reporting, and policing.",
        "Most individuals are not offenders.",
        "Victimization is ignored in the misuse of the statistic.",
      ],
      commonClaims: [
        {
          claim:
            "Black Americans are 13 percent of the population but commit about half of murders, so the cause must be race.",
          response:
            "The data can show a disparity in arrest, clearance, or homicide records depending on the dataset. It does not establish race as the cause, and it does not account for age, gender, geography, victimization, reporting, or concentrated exposure to violence.",
          question:
            "Which dataset are you using, and how does it prove causation rather than only showing a disparity?",
        },
        {
          claim:
            "The statistic proves Black people are inherently more criminal.",
          response:
            "That conclusion does not follow from arrest-based, reported-crime, or clearance-linked data. Group-level criminal-justice data cannot establish inherent traits, and it cannot justify judging individuals by race.",
          question:
            "What evidence in the data separates inherent criminality from social, geographic, enforcement, and demographic factors?",
        },
        {
          claim:
            "If the number is real, then profiling is rational.",
          response:
            "A group-level statistic does not identify individual suspicion. Public safety decisions need behavior, evidence, location-specific risk, and lawful standards, not racial generalization.",
          question:
            "How would a population-level statistic identify whether any specific person is involved in a specific offense?",
        },
        {
          claim:
            "People who mention context are excusing violent crime.",
          response:
            "Context is not an excuse. It is how serious analysis separates measurement from cause and points toward violence reduction, better clearance, victim protection, and prevention.",
          question:
            "Do you want an explanation that can reduce violence, or only a statistic that labels a group?",
        },
        {
          claim:
            "Victims do not matter to this debate because the offender statistic is the point.",
          response:
            "Victimization is central. Black Americans are also disproportionately victims of serious violence, so using the statistic without victim context erases the communities most affected by the harm.",
          question:
            "Why discuss homicide disparities without discussing who is being harmed and what would reduce that harm?",
        },
      ],
      debateLines: [
        "A disparity is a starting point for analysis, not proof of inherent causation.",
        "Arrest data, reported crime, convictions, and total offending are different measures.",
        "If the claim depends on FBI data, first ask whether it is arrests, clearances, or crimes known to police.",
        "Group statistics do not justify treating an individual as suspicious because of race.",
        "A serious public-safety response should focus on reducing violence and protecting victims.",
      ],
      shareCards: [
        {
          title: "Data versus conclusion",
          text:
            "The 13/50 claim points to a disparity in a specific crime dataset. It does not prove inherent criminality, causation, or total offending. The key question is what the dataset measures and whether it supports the conclusion being drawn.",
          context: "Use when someone jumps from a statistic to a racial conclusion.",
        },
        {
          title: "Arrest data is not total crime",
          text:
            "Arrests are not convictions, convictions are not total crime, and reported crime is not all victimization. Those limits do not erase disparities, but they do limit what the statistic can prove.",
          context: "Use when the claim treats law-enforcement data as a complete measure.",
        },
        {
          title: "Context is not an excuse",
          text:
            "Explaining risk factors is not excusing violence. It is how you move from a slogan to policies that reduce shootings, improve clearance, protect victims, and prevent future harm.",
          context: "Use when context is dismissed as denial.",
        },
        {
          title: "Victims matter",
          text:
            "The statistic is often used without acknowledging that Black Americans are also disproportionately victims of serious violence. A serious discussion has to include victims, prevention, and public safety.",
          context: "Use when the debate erases victimization context.",
        },
      ],
    },
    sourceContexts: [
      {
        title: "Crime Data Explorer",
        sourceType: "primary-data",
        sourceNote:
          "Federal crime-data portal; useful for checking what the underlying FBI measure actually counts.",
      },
      {
        title: "Clearances",
        sourceType: "government",
        sourceNote:
          "Explains clearance rules, which matter when separating crimes known to police from solved offenses.",
      },
      {
        title: "Criminal Victimization, 2023",
        sourceType: "primary-data",
        sourceNote:
          "NCVS victimization source; useful because many incidents are never reported to police.",
      },
      {
        title: "Homicide Victimization in the United States, 2023",
        sourceType: "primary-data",
        sourceNote:
          "Government victimization context for homicide, including demographic and reporting limits.",
      },
      {
        title: "U.S. Census Bureau QuickFacts: United States",
        sourceType: "government",
        sourceNote:
          "Population baseline for checking race, age, and denominator claims.",
      },
      {
        title: "Key facts about the U.S. Black population",
        sourceType: "secondary-analysis",
        sourceNote:
          "Demographic context from Pew Research Center, not a criminal-justice data source.",
      },
    ],
    lens: "Crime data and debate guide",
    pagePurpose:
      "Use this page when the 13/50 statistic is being used to make a broad claim about race, crime, or public policy and the first task is to separate what the data measure from what the speaker is concluding.",
    whyThisMatters:
      "This explainer is designed for careful argument. It does not deny that crime disparities exist, and it does not excuse violence. It asks whether arrest data, reported crime, clearance rates, and population share can support the causal or racial conclusions often attached to the slogan.",
    questions: [
      "What does the 13/50 statistic actually measure?",
      "Which conclusions do not follow from arrest-based or reported-crime data?",
      "How can readers respond without denying disparities or accepting racial essentialism?",
    ],
    researchPaths: [
      {
        href: "/explainers/crime-statistics-context-and-misuse",
        eyebrow: "Related explainer",
        title: "Read the broader crime-statistics methodology page",
        description:
          "Use the companion explainer when the next question is how FBI reporting, NCVS victimization data, and clearance measures differ from each other.",
      },
      {
        href: "/explainers/mass-incarceration-policy-history",
        eyebrow: "Policy context",
        title: "Move from statistics into criminal-justice policy history",
        description:
          "Use the mass-incarceration explainer when the debate shifts from crime measurement into sentencing, enforcement, incarceration, and reform.",
      },
    ],
    structuredSections: [
      {
        title: "What the data actually measures",
        body:
          "The usual versions of the 13/50 claim depend on law-enforcement data. FBI data are often arrest-based or based on crimes known to police. Arrest does not equal conviction. Conviction does not equal total crime. Reported crime does not equal all victimization. Clearance rates matter because many offenses are not solved by arrest, and reporting practices differ across offense types and communities.\n\nNone of those limits make the data useless. They mean the data have to be used for the question they can answer. They can support a discussion of disparities, victimization, geography, and public safety. They cannot prove inherent racial criminality.",
      },
      {
        title: "Why the comparison is incomplete",
        body:
          "A national population share is not the same thing as the population at highest risk of arrest or victimization. Crime risk varies heavily by age, gender, location, poverty exposure, neighborhood violence, and local enforcement patterns. A statistic that compares the total Black population to a subset of reported or cleared offenses therefore mixes a broad denominator with a narrower risk environment.\n\nThis does not make the disparity disappear. It means the comparison is incomplete. Most Black Americans are not offenders, just as most people in any group are not offenders. A serious analysis has to distinguish group population share from the small subset of individuals, places, and circumstances represented in criminal-justice data.",
      },
      {
        title: "Context the statistic leaves out",
        body:
          "Homicide data are often treated differently because homicide is more likely to be reported than many other offenses and because death records, police reports, and supplemental homicide systems provide more detail than many crime categories. That makes homicide data important, but it does not make them self-interpreting.\n\nThe statistic is also often presented as if Black communities only appear on the offender side of the ledger. That leaves out victimization. Black Americans are disproportionately exposed to violent victimization, including homicide victimization in many jurisdictions.\n\nCrime risk is also shaped by conditions that are not captured in a national race-and-population slogan: concentrated poverty, residential segregation, school quality, housing instability, labor-market exclusion, local disinvestment, exposure to prior violence, and illegal firearm access. These are risk factors, not excuses.",
      },
      {
        title: "What the statistic does not prove",
        body:
          "- Does not prove inherent criminality.\n- Does not prove causation.\n- Does not justify profiling.\n- Does not measure total offending.\n- Does not show that every group member carries the same risk.\n- Does not explain why violence is concentrated in specific places, age groups, and circumstances.\n\nThese limits do not mean the data should be ignored. They mean the data should be used for the question it can answer, not for conclusions it cannot establish.",
      },
      {
        title: "Common misinterpretations",
        body:
          "The most common mistake is treating a disparity as a complete explanation. A statistic can show that a measure is unevenly distributed without showing why the disparity exists or what policy should follow from it.\n\nAnother mistake is treating arrest or clearance-linked data as total offending. Arrests are affected by reporting, enforcement, clearance, witness cooperation, agency participation, and investigative capacity. A third mistake is treating group-level data as a judgment about individuals. Group statistics do not justify treating any person as suspicious because of race.",
      },
      {
        title: "How to respond in a debate",
        body:
          "Common claim: Black Americans are about 13 percent of the population but account for about half of murders or violent crime, so the data prove inherent criminality.\n\nBetter response: The statistic points to a disparity in reported, arrest-based, or cleared-crime data depending on the version being cited. It does not establish inherent criminality, causation, or total offending. To interpret it responsibly, we have to ask whether we are looking at arrests, convictions, victimization, reported offenses, or homicide clearances, and then account for age, gender, geography, victimization, and concentrated risk factors.\n\nKey question to ask: Which dataset are you using, what exactly does it measure, and how does it prove the conclusion you are drawing rather than only showing a disparity?",
      },
      {
        title: "Better way to understand the issue",
        body:
          "The stronger public-safety conversation starts with violence reduction. If homicide and serious violence are concentrated in specific neighborhoods and social conditions, policy should focus on preventing shootings, protecting victims, solving serious crimes, improving clearance, reducing retaliation, stabilizing high-risk communities, and improving opportunity for young people most exposed to violence.\n\nThat frame is more useful than a racial slogan because it points toward measurable interventions. It also treats Black victims, families, and neighborhoods as part of the public-safety goal rather than as a rhetorical object.",
      },
      {
        title: "EquityStack takeaway",
        body:
          "The central distinction is claim versus evidence. The data can show disparities in arrests, reported crime, homicide victimization, and clearance-linked offender information. Those disparities matter. But the leap from disparity to inherent racial criminality is an interpretation the data do not establish.\n\nMisusing statistics matters because it can turn measurement into stigma and stigma into policy. EquityStack's approach is to keep the measurement visible, keep the victims visible, and test every conclusion against what the evidence can actually support.",
      },
    ],
  },
  "bootstraps-vs-policy-reality": {
    lens: "Mobility and policy guide",
    pagePurpose:
      "Use this page when the debate is framed around self-reliance, but the real research question is how public policy structured opportunity in the first place.",
    whyThisMatters:
      "This explainer ties together multiple high-value EquityStack themes: wealth-building, housing, education, labor, and federal support. It is one of the clearest pages for explaining why opportunity questions cannot be separated from public policy history.",
    argumentReady: {
      claim:
        "People just need to work harder because success comes from effort, not policy.",
      whyMisleading:
        "That argument turns self-reliance into a complete explanation and removes the public structures that made mobility easier for some groups and harder for others.",
      dataShows: [
        "Public offices, housing programs, labor law, and education policy helped structure access to opportunity rather than merely rewarding effort after the fact.",
        "The mobility record supports a strong role for public scaffolding alongside personal effort.",
        "Black Americans often faced weaker access to those public ladders, which makes merit-only narratives incomplete.",
        "The real question is not whether effort matters. It is whether people were competing inside equal institutions.",
      ],
      bottomLine:
        "Effort matters, but it operates inside policy-built systems. A serious mobility argument has to account for both.",
      responseScript:
        "Effort matters, but it does not happen outside policy. The historical record shows that land, housing, labor, and education systems helped structure opportunity long before people were told success was only about personal discipline.",
      responseContext:
        "Use when a self-reliance argument erases the policy history behind mobility.",
    },
    questions: [
      "How did government-backed opportunity shape upward mobility in practice?",
      "Which policy lanes most clearly show unequal access to mobility?",
      "How should readers connect individual effort arguments to the documented record on public investment and exclusion?",
    ],
    researchPaths: [
      {
        href: "/analysis/how-presidents-shaped-black-opportunity",
        eyebrow: "Opportunity path",
        title: "Study how administrations shaped Black opportunity",
        description:
          "Use the opportunity guide to connect this mobility debate to presidents, governance, and long-term access to advancement.",
      },
      {
        href: "/analysis/presidential-records-on-black-opportunity",
        eyebrow: "Records path",
        title: "Review documentary records affecting Black opportunity",
        description:
          "Move into the records guide when you want a more evidence-heavy path through policies, promises, and legislation.",
      },
    ],
    structuredSections: [
      {
        title: "Where Black impact is already visible",
        body:
          "The Black-impact issue is straightforward: if public ladders into land, housing, labor protection, and education were unequally distributed, then Black communities were asked to compete under the rhetoric of self-reliance while being denied equal access to the supports that made self-reliance more feasible for others.",
      },
      {
        title: "What implementation evidence already shows",
        body:
          "The implementation record cuts against the myth of purely private mobility. Public offices transferred land, agencies underwrote mortgages, labor law protected bargaining, and federal education policy financed institutions and access. The United States did not simply reward effort after the fact. It structured opportunity in advance.",
      },
      {
        title: "What this evidence can support",
        body:
          "The evidence supports a strong historical claim that mobility in the United States has always depended partly on public scaffolding. It also supports the narrower claim that Black Americans often faced weaker access to that scaffolding, which makes later merit-only narratives incomplete.",
      },
      {
        title: "What this evidence cannot prove on its own",
        body:
          "This evidence does not show that personal effort is irrelevant or that policy alone determines individual outcomes. The stronger point is that effort operates inside institutions, and those institutions have never been neutral in their distribution of opportunity.",
      },
      {
        title: "Why this rhetoric matters",
        body:
          "Bootstrap rhetoric sounds morally neutral, but it often works by deleting the policy history that made success easier for some groups than for others. Once that history is restored, the argument becomes much harder to sustain in simple moral terms.",
      },
    ],
  },
  "gi-bill-access-and-impact": {
    lens: "Postwar opportunity guide",
    pagePurpose:
      "Use this page when you need a concrete example of how a celebrated federal program expanded opportunity unevenly through local implementation and existing discrimination.",
    whyThisMatters:
      "The GI Bill is one of the site’s strongest authority-page topics because it sits at the intersection of presidents, housing, education, federal investment, and long-term Black economic opportunity.",
    questions: [
      "How did the GI Bill expand opportunity, and where did implementation narrow access?",
      "How does GI Bill history connect to later debates about housing, education, and wealth?",
      "Why is the GI Bill still central to arguments about opportunity and public investment?",
    ],
    researchPaths: [
      {
        href: "/analysis/how-presidents-shaped-black-opportunity",
        eyebrow: "Opportunity path",
        title: "Place the GI Bill inside the broader Black-opportunity question",
        description:
          "Use the opportunity guide when you want to connect postwar veteran benefits to other federal pathways into mobility.",
      },
      {
        href: "/analysis/black-progress-under-presidents",
        eyebrow: "Outcomes path",
        title: "Review where access and outcomes changed over time",
        description:
          "Move into the outcomes guide when the question shifts from program design to long-term patterns of progress and exclusion.",
      },
    ],
    referenceCards: [
      {
        title: "Why readers cite this explainer",
        description:
          "This page is especially shareable because it ties a well-known federal program to unequal access, housing, education, and longer-term Black opportunity without losing the policy trail.",
      },
      {
        title: "What it covers best",
        description:
          "Use this page when the topic is postwar opportunity, veteran benefits, and how celebrated federal programs produced uneven outcomes in practice.",
      },
      {
        title: "What to pair it with",
        description:
          "Pair it with the Black-opportunity thematic pages, related policy records, and the reports layer when the question shifts from one program to long-run opportunity patterns.",
      },
    ],
    structuredSections: [
      {
        title: "Where Black impact is already visible",
        body:
          "The Black-impact channels here are unusually concrete. The GI Bill's biggest postwar wealth-building lanes were college access and homeownership. Black veterans often faced constraints in both at the same time. In higher education, many southern institutions remained segregated while HBCUs had limited capacity and resources, which meant a formally available education benefit did not translate into equal collegiate opportunity. In housing, GI Bill-backed loans still ran through lenders and local markets shaped by appraisal discrimination, redlining, and segregated suburban development.\n\nThat is why this topic belongs at the center of Black-opportunity analysis. The issue is not whether the GI Bill mattered. It mattered enormously. The issue is that access to one of the most powerful federal mobility programs in U.S. history was filtered through institutions that did not treat Black veterans equally.",
      },
      {
        title: "What implementation evidence already shows",
        body:
          "The implementation story matters more than the statutory text alone. The National Archives record shows what the law promised. VA history shows how the education and loan-guaranty systems were administered. But neither colleges nor housing markets were neutral delivery systems. The education benefit depended on actual admission opportunities, and the housing benefit depended on actual access to mortgage credit and neighborhoods where Black veterans could buy.\n\nThat makes the GI Bill a strong example of a broader EquityStack rule: a formally universal federal benefit can still produce unequal outcomes when local gatekeepers and surrounding institutions remain discriminatory.",
      },
      {
        title: "What this evidence can support",
        body:
          "The evidence supports a strong claim that the GI Bill helped expand postwar opportunity overall while delivering unequal access to Black veterans in practice. It also supports a narrower causal channel: unequal access to higher education and mortgage-backed homeownership contributed to long-run Black-white gaps in wealth and opportunity.\n\nThis is especially defensible when the claim is tied to region, institution type, and benefit channel rather than stated as an undifferentiated national average.",
      },
      {
        title: "What this evidence cannot prove on its own",
        body:
          "This evidence does not mean every Black veteran was excluded from GI Bill benefits, nor does it mean the program's effects were identical across all states and communities. Some Black veterans did gain educational and economic benefits, and outcomes varied by geography.\n\nThe stronger position is not total exclusion. It is unequal access through implementation, especially where segregated colleges, constrained HBCU capacity, and discriminatory housing markets limited the program's practical reach.",
      },
      {
        title: "Why this still matters",
        body:
          "The GI Bill remains one of the clearest historical tests of how public investment builds mobility. If readers want to understand why Black wealth and homeownership did not rise on the same trajectory as white postwar gains, this is one of the most important places to look.\n\nIt also helps explain why later debates about fairness cannot be reduced to whether a law used race-neutral language. In American policy history, access often turned on who controlled the doors after Congress passed the bill.",
      },
    ],
  },
  "mass-incarceration-policy-history": {
    lens: "Policy-driven incarceration guide",
    pagePurpose:
      "Use this page when the question is whether incarceration growth should be understood mainly through crime levels or through law, enforcement, and sentencing design.",
    whyThisMatters:
      "Mass incarceration is a major search topic, but it is often framed too broadly. This explainer is strongest when it routes readers from the large debate into concrete criminal-justice laws, presidential eras, and reform records.",
    argumentReady: {
      claim:
        "Mass incarceration mainly reflects crime levels, so policy choices are not the main issue.",
      whyMisleading:
        "That frame treats prison growth as automatic and erases the legal and enforcement choices that shaped who entered the system, how long sentences lasted, and how heavily Black communities were exposed to punishment.",
      dataShows: [
        "The record points to harsher drug laws, mandatory minimums, expanded prison capacity, aggressive enforcement, and plea-driven case processing as major drivers of incarceration growth.",
        "Crime alone cannot explain the scale of incarceration growth described in the policy record.",
        "Federal and state design choices shaped both entry into the system and time spent inside it.",
        "Black communities absorbed cumulative effects that extended beyond the people formally sentenced.",
        "Later reform efforts matter partly because they show the system was policy-made and therefore changeable.",
      ],
      bottomLine:
        "Mass incarceration is not just a neutral readout of crime. It is a policy-built system shaped by law, enforcement, and institutional design.",
      responseScript:
        "That argument leaves out the policy record. Crime levels matter, but incarceration growth was also driven by sentencing law, drug policy, enforcement choices, and prison expansion.",
      responseContext:
        "Use when someone treats prison growth as a simple mirror of crime.",
    },
    questions: [
      "Which laws and enforcement choices drove incarceration growth?",
      "How did incarceration patterns relate to presidential agendas and justice policy?",
      "Where do later reforms fit inside the larger incarceration story?",
    ],
    researchPaths: [
      {
        href: "/analysis/presidential-impact-on-black-americans",
        eyebrow: "Impact path",
        title: "Study incarceration inside the broader presidential record",
        description:
          "Use the impact guide when mass incarceration is one part of a wider question about Black Americans and federal governance.",
      },
      {
        href: "/analysis/black-progress-under-presidents",
        eyebrow: "Outcomes path",
        title: "Review where reform advanced, stalled, or reversed",
        description:
          "Move into the outcomes guide when you want to compare justice-policy change across administrations.",
      },
    ],
    structuredSections: [
      {
        title: "Where Black impact is already visible",
        body:
          "The Black-impact channel is direct and cumulative. Mass incarceration concentrated surveillance, imprisonment, and supervision in many Black communities, with spillover effects on family structure, earnings, schooling, health, and civic life. The impact was never limited to the people formally sentenced.",
      },
      {
        title: "What implementation evidence already shows",
        body:
          "The implementation record points to policy design: harsher drug laws, mandatory minimums, expanded prison capacity, aggressive enforcement, and plea-driven case processing. Those choices changed who entered the system, how long they stayed, and how deeply communities were exposed to punishment.",
      },
      {
        title: "What this evidence can support",
        body:
          "The evidence strongly supports the claim that crime alone cannot explain the scale of U.S. incarceration growth. It also supports the narrower claim that federal and state policy choices helped create a criminal-justice system that imposed especially heavy burdens on Black communities.",
      },
      {
        title: "What this evidence cannot prove on its own",
        body:
          "This evidence does not prove that every prison increase in every jurisdiction had the same cause or that all incarceration trends were federally driven. The stronger historical claim is about broad policy architecture, not total uniformity across time and place.",
      },
      {
        title: "Why policy history matters",
        body:
          "If mass incarceration is treated only as a reflection of crime, reform looks optional. If it is understood as a policy-made system, reform becomes a question of political choice and institutional design.",
      },
    ],
  },
  "tax-cuts-and-who-benefits": {
    lens: "Distribution and tradeoff guide",
    pagePurpose:
      "Use this page when a tax-cut argument is framed as universal relief and the first task is to ask who received the largest benefit, what the budget effects were, and what public tradeoffs followed.",
    whyThisMatters:
      "Tax policy debates often stop at the headline rate cut. EquityStack treats tax cuts as a distribution and public-capacity question, because design choices shape who gains most and what communities lose if revenue falls.",
    argumentReady: {
      claim:
        "Tax cuts help everyone equally.",
      whyMisleading:
        "Tax cuts can be highly unequal depending on who receives the largest rate, capital, corporate, pass-through, or estate-tax benefits and what public revenue is lost afterward.",
      dataShows: [
        "Official distribution tables show that tax cuts can produce different outcomes across income groups and tax units.",
        "Budget estimates matter because revenue losses can affect deficits and later spending choices.",
        "Corporate and capital-income provisions can shift the largest gains upward even when some households also get tax relief.",
        "The real policy question is not whether any tax was cut. It is who benefited most and what public capacity changed in return.",
      ],
      bottomLine:
        "Tax cuts are not automatically broad-based relief. Their impact depends on who receives the benefits and what gets cut or underfunded afterward.",
      responseScript:
        "Tax cuts do not help everyone equally. The real question is who gets the biggest benefit and what public services lose funding afterward. A tax cut that mostly benefits corporations or high-income households can leave working families with fewer services and little direct gain.",
      responseContext:
        "Use when a tax-cut claim treats all benefits as evenly shared.",
    },
    questions: [
      "How do official distribution tables change the way readers should evaluate tax-cut claims?",
      "Why do budget effects matter when judging whether a tax cut helped working families and Black communities?",
      "What distinguishes broad-based tax relief from a policy that mainly rewards higher-income households or corporations?",
    ],
    researchPaths: [
      {
        href: "/explainers/government-benefits-racial-gap",
        eyebrow: "Related explainer",
        title: "Review the broader record on public support and unequal access",
        description:
          "Use the companion explainer when the next question is how public investment, subsidies, and access shaped opportunity across communities.",
      },
      {
        href: "/reports",
        eyebrow: "Reports",
        title: "Move into comparative report analysis",
        description:
          "Use the reports layer when the question expands from one tax claim into broader patterns across policy, outcomes, and presidential records.",
      },
    ],
    relatedExplainers: [
      "government-benefits-racial-gap",
      "bootstraps-vs-policy-reality",
    ],
    sourceContexts: [
      {
        title: "H.R. 1 (115th Congress): Tax Cuts and Jobs Act",
        sourceType: "government",
        sourceNote:
          "Congress.gov legislative summary for the underlying 2017 tax package.",
      },
      {
        title: "Distributional Effects Of The Conference Agreement For H.R.1, The Tax Cuts And Jobs Act",
        sourceType: "primary-data",
        sourceNote:
          "Official Joint Committee distribution tables for comparing tax changes across income groups.",
      },
      {
        title: "Estimated Budget Effects Of The Conference Agreement For H.R.1, The Tax Cuts And Jobs Act",
        sourceType: "government",
        sourceNote:
          "Official Joint Committee revenue estimate for the conference agreement.",
      },
      {
        title: "Estimated Deficits and Debt Under the Chairman's Amendment in the Nature of a Substitute to H.R. 1",
        sourceType: "government",
        sourceNote:
          "CBO estimate connecting the tax package to deficit and debt effects.",
      },
      {
        title: "The Distribution of Major Tax Expenditures in the Individual Income Tax System",
        sourceType: "government",
        sourceNote:
          "CBO distribution context for how large tax preferences flow across taxpayers.",
      },
    ],
    structuredSections: [
      {
        title: "Where Black impact is already visible",
        body:
          "The Black-impact question here is partly about household tax relief and partly about public capacity. If a tax package mainly rewards people who already hold more wealth or more capital income, while public revenue falls, then Black communities can face a weak direct gain and a stronger indirect loss through underfunded services or reduced investment.",
      },
      {
        title: "What implementation evidence already shows",
        body:
          "The implementation record on tax cuts is not only the campaign slogan. Official legislative summaries, distribution tables, and budget estimates show that tax packages are made of many moving parts: individual rates, deductions, credits, corporate changes, pass-through rules, and estate or capital-income treatment. That is why headline language about everyone getting relief is usually too blunt for the actual policy record.",
      },
      {
        title: "What this evidence can support",
        body:
          "The evidence supports a strong claim that tax cuts have to be evaluated distributionally, not rhetorically. It also supports the narrower claim that budget effects and public-service tradeoffs matter when deciding whether a policy actually helped working-class families and Black communities.",
      },
      {
        title: "What this evidence cannot prove on its own",
        body:
          "This evidence does not prove that every tax cut is regressive or that every lower-income household loses under every reform package. The stronger point is about method: readers should ask how the benefits are distributed, which provisions are temporary or permanent, and how revenue losses interact with later public choices.",
      },
      {
        title: "Why the headline is not enough",
        body:
          "A lower tax rate can be real and still be an incomplete story. If the biggest dollar gains flow upward, if corporate or capital-income provisions dominate the package, or if later budget pressure reduces public services, then the policy did not help everyone equally. That is why the headline claim is weaker than the full record.",
      },
    ],
  },
  "white-house-dei-economic-study": {
    lens: "Evidence and methodology guide",
    pagePurpose:
      "Use this page when the question is whether the White House DEI economic study proves its headline productivity and cost claims, or whether the findings depend on contested assumptions.",
    whyThisMatters:
      "The study is policy-relevant because economic claims about DEI can shape enforcement, contracting, institutional rules, and public debate. EquityStack treats it as a methodology question before treating it as a policy conclusion.",
    argumentReady: {
      claim:
        "The White House study proves DEI lowers productivity and shows diversity hires are less qualified.",
      whyMisleading:
        "The headline conclusion is stronger than the study design. The model uses a proxy rather than direct DEI-policy measurement, does not isolate causation, and does not measure individual qualifications.",
      dataShows: [
        "The study treats a proxy for DEI activity as if it can stand in for direct policy measurement.",
        "Observed productivity changes may reflect overlapping economic disruptions, sector shifts, and labor-market changes rather than DEI policy itself.",
        "The model does not rule out reverse causality, including the possibility that firm performance affects DEI adoption rather than the other way around.",
        "The study does not directly measure hiring quality, promotion standards, or whether minority managers were less qualified.",
        "The broader research landscape on diversity and performance is mixed rather than one-directional.",
      ],
      bottomLine:
        "This explainer supports a methodology warning, not a sweeping anti-DEI conclusion.",
      responseScript:
        "That claim overstates what the study shows. It relies on a proxy for DEI rather than direct policy measurement, and it does not isolate causation or prove that minority managers were less qualified.",
      responseContext:
        "Use when the study is cited as settled proof against DEI.",
    },
    questions: [
      "What does the report claim about DEI, management representation, productivity, and economic cost?",
      "How does the study construct its DEI proxy, and what does that proxy leave unmeasured?",
      "What conclusions can the report support, and what conclusions require stronger evidence?",
    ],
    argumentMode: {
      summary:
        "The DEI study can raise a policy question, but its headline claim is stronger than the evidence because the proxy does not directly measure DEI policy or causation.",
      keyPoints: [
        "The study uses a proxy rather than direct DEI-policy measurement.",
        "Correlation does not establish causation.",
        "Alternative economic explanations are not fully ruled out.",
        "The evidence does not prove minority managers are less qualified.",
      ],
      commonClaims: [
        {
          claim:
            "The White House study proves DEI lowers productivity.",
          response:
            "It reports a relationship built around a contested proxy. That is not the same as directly measuring DEI policies and proving they caused lower productivity.",
          question:
            "Where does the study directly measure DEI policy, and how does it rule out other causes?",
        },
        {
          claim:
            "The study proves diversity hires are less qualified.",
          response:
            "The study does not directly observe hiring quality, promotion standards, or individual qualifications. That conclusion goes beyond the evidence.",
          question:
            "What part of the study measures individual qualifications?",
        },
      ],
      debateLines: [
        "A proxy is not the same thing as a direct measure.",
        "The study can support a question, but not every headline conclusion attached to it.",
        "Before making a causal claim, ask what other economic changes the model rules out.",
      ],
      shareCards: [
        {
          title: "Proxy problem",
          text:
            "The DEI study relies on a proxy for DEI activity. A proxy can be useful, but it is not direct proof that DEI policy caused lower productivity.",
          context: "Use when the study is treated as settled causal proof.",
        },
      ],
    },
    researchPaths: [
      {
        href: "/methodology",
        eyebrow: "Methodology",
        title: "Review how EquityStack weighs evidence",
        description:
          "Use the methodology page when a claim depends on a model, proxy, causal assumption, or contested interpretation of evidence.",
      },
      {
        href: "/sources",
        eyebrow: "Sources",
        title: "Open the source layer behind public claims",
        description:
          "Move from the explainer into the source library when the next step is checking what a cited document actually says.",
      },
    ],
    structuredSections: [
      {
        title: "Where Black impact is already visible",
        body:
          "The Black-impact issue in this explainer is not only about aggregate productivity. The study treats unexplained growth in minority managerial representation as evidence of DEI activity and then links that proxy to lower productivity. That framing risks teaching readers to view gains in Black representation as inherently suspect instead of asking whether prior barriers had kept qualified workers out of those roles.\n\nThat matters because a weakly identified economic claim can still shape how people interpret Black advancement in employment, promotion, and management. If representation itself is treated as presumptive evidence of distortion, policy debates can move quickly from skepticism about one study to skepticism about equal-opportunity interventions more broadly.",
      },
      {
        title: "What implementation evidence already shows",
        body:
          "This explainer is no longer only about a disputed economic paper in isolation. The broader 2025 policy record shows that anti-DEI actions were framed in terms of merit, efficiency, contracting reform, and civil-rights enforcement. That does not prove this specific study caused those actions, but it does show the policy environment into which claims like this travel.\n\nThat implementation context raises the stakes of methodological rigor. A contested proxy model is not just an academic argument when similar claims are being used to justify contractor-rule changes, enforcement shifts, and the rollback of equity-focused structures across the federal government.",
      },
      {
        title: "What mainstream economics says about discrimination",
        body:
          "Standard economic theory treats discrimination as an efficiency problem, not only a fairness problem. When employers exclude qualified workers because of race, gender, or other nonproductive traits, the labor market is less able to match talent to the jobs where that talent is most useful.\n\nThat means discrimination can reduce productivity by shrinking the hiring pool and producing worse worker-job matches. More open labor markets generally improve allocation because firms can draw from a wider set of qualified workers and workers can move into roles that better match their skills.",
      },
      {
        title: "What historical evidence shows",
        body:
          "Historical evidence points in the same direction. Research on the civil-rights era finds that reductions in discrimination and expanded access to jobs were associated with measurable economic gains for Black workers, including improvements in income, occupational status, and mobility.\n\nThat history matters because it complicates the study's implied contrast between diversity and productivity. Expanded participation can improve economic performance when it removes barriers that previously kept qualified workers from higher-value jobs.",
      },
      {
        title: "Alternative explanations the study does not rule out",
        body:
          "The study's post-2016 productivity results may be influenced by factors other than DEI policy. The period includes major economic disruptions, including pandemic-era shocks, remote-work shifts, labor reallocation, sector-specific changes, supply-chain stress, and changes in industry composition.\n\nIndustries and regions also differed in growth, labor demand, technology adoption, and workforce demographics. This means the observed productivity changes could be explained by multiple overlapping economic factors, not the proxy labeled as DEI. The model does not isolate DEI as the causal variable.",
      },
      {
        title: "Reverse causality problem",
        body:
          "The direction of causality is also uncertain. High-performing firms may have more resources to invest in compliance teams, human resources capacity, recruiting infrastructure, and diversity programs. In that case, firm performance could influence DEI adoption rather than DEI adoption explaining performance.\n\nThe study assumes DEI causes lower productivity, but it does not rule out that firm performance influences DEI adoption. Without a design that separates cause from selection, the relationship remains vulnerable to reverse-causality concerns.",
      },
      {
        title: "What the study does not prove",
        body:
          "- Does not prove minority managers are less qualified.\n- Does not directly measure hiring quality.\n- Does not directly observe whether specific managers were hired or promoted because of DEI policies.\n- Does not isolate DEI policies from other economic variables.\n- Does not establish causation.\n\nThese limits do not mean the study has no informational value. They mean the headline conclusion is stronger than the evidence can support on its own.",
      },
      {
        title: "What strong evidence would require",
        body:
          "A stronger causal claim would require direct measurement of DEI policies rather than a demographic proxy. It would also require controlled comparisons across similar firms, industries, and regions, so that the analysis can separate DEI activity from unrelated economic changes.\n\nThe evidence would need to isolate external shocks, account for workforce composition and labor-market changes, and show that productivity changes follow from DEI policy itself rather than from correlation or selection. The study does not meet these standards.",
      },
      {
        title: "Where the evidence is mixed",
        body:
          "The broader research landscape is mixed. Some studies find positive links between diversity and performance or innovation. Other studies find no statistically significant relationship, and some research questions whether widely cited business-case claims are causally identified.\n\nThat mixed evidence cuts against sweeping conclusions in either direction. It does not prove that diversity programs automatically improve performance, but it also does not support strong causal claims that diversity reduces productivity.",
      },
    ],
  },
  "hiring-discrimination-and-anti-dei-rollbacks": {
    lens: "Labor-market evidence guide",
    pagePurpose:
      "Use this page when the question is whether anti-DEI rollback policy is being made against a labor market where hiring discrimination is already solved, or against one where measurable disparities remain.",
    whyThisMatters:
      "This explainer is strongest when it separates two different questions that often get blurred together: whether hiring discrimination persists, and whether a specific anti-DEI policy caused a specific downstream harm. The research answers the first question more directly than the second.",
    argumentReady: {
      claim:
        "Discrimination is basically solved, so anti-DEI rollback policy only removes unnecessary bureaucracy.",
      whyMisleading:
        "The research base still finds measurable hiring discrimination, and the official record shows the rollback changed real enforcement, contractor-compliance, and civil-rights support structures.",
      dataShows: [
        "Modern hiring-discrimination studies still support a bounded claim that unequal treatment remains measurable in the labor market.",
        "The rollback produced documented implementation steps, including office closures, contractor changes, enforcement pauses, and grant cancellations.",
        "The current evidence supports a risk argument about weaker oversight and protection, not a final quantified harm estimate.",
        "Stronger downstream harm claims would require additional outcome evidence over time.",
      ],
      bottomLine:
        "The rollback did not enter a solved labor market. It reduced or changed institutions that were built to monitor and address an already documented problem.",
      responseScript:
        "That argument assumes the barrier is gone. The evidence here says hiring discrimination is still measurable, and the rollback changed real enforcement and oversight structures even if final outcome estimates are still developing.",
      responseContext:
        "Use when rollback policy is framed as harmless cleanup.",
    },
    questions: [
      "What does modern hiring-discrimination research show about Black applicants' treatment in the labor market?",
      "What can that research support when evaluating anti-DEI rollback policy?",
      "What additional evidence would be needed to move from baseline discrimination findings to a strong Trump-policy impact claim?",
    ],
    researchPaths: [
      {
        href: "/promises/trump-2025-end-federal-dei-equity-programs",
        eyebrow: "Promise record",
        title: "Read the Trump DEI rollback promise in record form",
        description:
          "Use the promise record when you want the administration's action timeline, outcome summary, and Black-community impact note alongside this explainer's research frame.",
      },
      {
        href: "/methodology",
        eyebrow: "Methodology",
        title: "Review how EquityStack separates evidence strength from causal claims",
        description:
          "Move into methodology when the next question is whether baseline evidence, direct policy evidence, and interpretation are being cleanly distinguished.",
      },
    ],
    referenceCards: [
      {
        title: "Why readers cite this explainer",
        description:
          "This page is useful when a policy debate jumps too quickly from anti-DEI rhetoric to assumptions about merit, fairness, or solved discrimination without grounding those claims in the hiring research.",
      },
      {
        title: "What it covers best",
        description:
          "Use this page for the evidence baseline first: whether measurable hiring discrimination still exists, where it shows up, and what that means for evaluating rollback arguments.",
      },
      {
        title: "What to pair it with",
        description:
          "Pair it with the Trump DEI promise record, the White House order itself, and any later agency-level evidence on grants, contracting, enforcement, or compliance changes.",
      },
    ],
    structuredSections: [
      {
        title: "Where Black impact is already visible",
        body:
          "The strongest Black-impact channels in the current official record are not broad national labor statistics yet. They are institutional channels that explicitly handled race-related inequities. One is federal contractor enforcement. Before the 2025 rollback, OFCCP used Executive Order 11246 to obtain back pay, job offers, and compliance changes in cases involving Black applicants. Shutting that pathway down does not automatically prove new harm, but it does remove or weaken an enforcement tool that had recently produced race-discrimination remedies.\n\nA second is K-12 civil-rights and desegregation support. The Department of Education cancelled grants to Equity Assistance Centers even though the Department's own program page describes those centers as Title IV technical-assistance providers for desegregation, race-related disparities, bullying, prejudice reduction, and conflict resolution for schools and communities. That makes the Black-impact question more concrete: some of the programs being cut were not generic culture programs but race-related civil-rights support structures.",
      },
      {
        title: "What implementation evidence already shows",
        body:
          "The anti-DEI rollback is no longer only a statement of intent. Primary government documents show concrete implementation steps. OPM told agencies to close DEIA offices, place DEIA staff on paid administrative leave, terminate DEIA-related contractors, and prepare or begin reduction-in-force actions. The Labor Department halted investigative and enforcement activity under rescinded Executive Order 11246, while OFCCP told federal contractors to wind down the old affirmative-action compliance regime.\n\nOther agencies also moved from rhetoric to administration. The Department of Education reported dissolving DEI-related councils, canceling contracts, removing web materials, terminating hundreds of millions of dollars in grants and contracts tied to DEI-related work, and opening a public anti-DEI complaint portal. DOJ and EEOC also issued guidance reframing some DEI-related practices as potential civil-rights violations. This is implementation evidence. It is not yet the same thing as a final estimate of Black employment harm, but it is enough to show that the rollback changed real institutional behavior.",
      },
      {
        title: "What this evidence can support",
        body:
          "The studies cited here support a bounded but important claim: racial discrimination in hiring remains measurable in the modern U.S. labor market, including among large employers. That means anti-DEI rollback policy is not entering a world where the underlying barrier has clearly disappeared.\n\nThis is enough to support a risk argument. If institutions built to surface, monitor, or mitigate unequal treatment are weakened, Black applicants may face greater exposure to an already documented problem.",
      },
      {
        title: "What this evidence cannot prove on its own",
        body:
          "These studies do not, by themselves, prove that the Trump administration's January 20, 2025 anti-DEI order caused a quantifiable decline in Black employment, wages, or callback rates. They are baseline labor-market evidence, not a direct before-and-after causal evaluation of one administration's policy.\n\nA stronger claim would require policy-specific evidence such as agency implementation records, employer compliance changes, reduced access to remedies, contracting shifts, grant terminations, or measurable labor-market outcomes after the rollback.",
      },
      {
        title: "Why discretion matters",
        body:
          "One of the most policy-relevant themes in this literature is that discrimination can widen where hiring decisions are more subjective. If employers rely heavily on informal judgment, unstructured screening, or ambiguous criteria, unequal treatment can persist even when formal discrimination is unlawful.\n\nThat matters for DEI debates because some equity-focused interventions aim to add structure, review, documentation, and accountability precisely where discretion is hardest to monitor.",
      },
      {
        title: "What stronger policy-impact evidence would look like",
        body:
          "To move from a plausible risk argument to a stronger claim about the Trump DEI rollback, the evidence base would need to connect the order to measurable downstream effects on Black workers, students, contractors, or communities. Some of the implementation evidence is now visible: agency shutdowns, staffing cuts, rescinded guidance, grant cancellations, contractor-rule changes, and new complaint or enforcement channels.\n\nThe remaining step is outcome evidence. That means showing whether these institutional changes altered access to remedies, oversight capacity, employer behavior, contracting opportunity, school support, or employment outcomes in ways that can be measured over time.",
      },
    ],
  },
};

const CATEGORY_FALLBACKS = {
  default: {
    lens: "Historical explainer",
    pagePurpose:
      "Use this page to connect a public claim or historical debate to the policy record, related promises, and the broader EquityStack research graph.",
    whyThisMatters:
      "The strongest explainers do not stand alone. They work as orientation pages that help readers move into presidents, policies, reports, and source-backed detail.",
    questions: [],
    researchPaths: [],
  },
};

export function getExplainerEditorial(slug) {
  return EXPLAINER_EDITORIAL[slug] || CATEGORY_FALLBACKS.default;
}
