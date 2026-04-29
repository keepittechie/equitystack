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
  //
  // Answer-first pattern for high-priority explainers:
  // 1. argumentReady
  //    - claim
  //    - whyMisleading
  //    - 3-5 dataShows
  //    - bottomLine
  //    - responseScript
  //    - responseContext
  // 2. argumentMode
  //    - summary
  //    - 5-7 keyPoints
  //    - 4-5 commonClaims
  //    - debateLines
  //    - 3-4 shareCards
  //
  // The page should answer the core question first. Linked records are for
  // verification and deeper research, not because the explainer itself is
  // supposed to stay inconclusive.
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
          "The clearest Black-impact channel here is political power. Party realignment changed which coalition most strongly defended civil-rights enforcement, voting rights, and Black representation across multiple presidential administrations and election cycles. As Black voters became a core Democratic constituency and white southern conservatives shifted increasingly toward the Republican Party, the stakes were not only symbolic. They affected who governed, what laws passed, and how rights were defended or resisted.",
      },
      {
        title: "What implementation evidence already shows",
        body:
          "This topic is strongest when readers move past slogans and look at evidence types: party platforms, presidential actions, civil-rights statutes, voting-rights enforcement, election returns, and campaign strategy. Truman's civil-rights moves, the Civil Rights Act, the Voting Rights Act, and later strategic appeals around law and order, states' rights, and federal intervention all show that realignment was tied to actual policy conflict. The parties were not simply renamed versions of their 19th-century selves.",
      },
      {
        title: "What this evidence can support",
        body:
          "The evidence supports a long-term realignment claim: modern party coalitions, especially in the South, changed substantially around civil rights over decades rather than in a single election. It also supports the narrower point that Black political alignment with Democrats cannot be understood apart from which party increasingly backed federal civil-rights action.",
      },
      {
        title: "What this evidence cannot prove on its own",
        body:
          "This evidence does not support a cartoonish overnight switch, nor does it prove that every politician or voter moved at the same time or for the same reason. Realignment was gradual, uneven, and layered. To prove a stronger claim about any one officeholder or voter bloc, the evidence would need to show vote choices, public positions, and coalition behavior in that specific period. The strongest interpretation is about coalition change over time, not instant identity replacement.",
      },
      {
        title: "Why labels mislead",
        body:
          "Party names are durable; party coalitions are not. That is why historical arguments built only on the phrase Democratic Party or Republican Party are usually too weak. The better question is what each coalition stood for, who it was trying to mobilize, and what laws or strategies it defended in the period being discussed.",
      },
    ],
  },
  "party-voting-records-racial-policy": {
    category: "historical-context",
    tags: [
      "congress",
      "voting-records",
      "civil-rights",
      "racial-policy",
      "party-realignment",
      "black-impact-score",
    ],
    relatedExplainers: [
      "party-switch-southern-strategy",
      "mass-incarceration-policy-history",
      "welfare-dependency-claims",
    ],
    relatedPolicies: [
      "5-civil-rights-act-of-1964",
      "6-voting-rights-act-of-1965",
      "7-fair-housing-act-of-1968",
      "96-civil-rights-act-of-1991",
      "54-violent-crime-control-and-law-enforcement-act-of-1994",
      "174-personal-responsibility-and-work-opportunity-reconciliation-act-of-1996",
      "8-voting-rights-act-reauthorization-of-2006",
    ],
    lens: "Congressional voting-record guide",
    pagePurpose:
      "Use this page when the claim is about which party backed laws that helped or harmed Black Americans and the first task is to separate party labels from actual congressional coalitions, bill text, and policy effects.",
    whyThisMatters:
      "This debate is often flattened into 'which party is racist.' The stronger record is narrower: which coalition voted for or against a specific law, what the law said, how it was enforced, and what documented racial impact followed.",
    questions: [
      "Which votes actually expanded or restricted Black civil rights, voting access, housing access, or equal protection?",
      "How did Southern Democrats, Northern Democrats, liberal Republicans, and conservative Republicans split in different eras?",
      "What can voting records show directly, and what still requires bill text, enforcement, and outcome evidence?",
    ],
    researchPaths: [
      {
        href: "/explainers/party-switch-southern-strategy",
        eyebrow: "Related explainer",
        title: "Place these votes inside the longer realignment story",
        description:
          "Use the party-switch explainer when the next question is how the South, civil-rights conflict, and presidential strategy changed what party labels meant.",
      },
      {
        href: "/methodology",
        eyebrow: "Methodology",
        title: "Review how EquityStack separates votes, intent, and outcomes",
        description:
          "Use the methodology page when the debate shifts from historical votes to evidence standards, scoring, and what counts as documented impact.",
      },
      {
        href: "/policies",
        eyebrow: "Policy records",
        title: "Open the underlying law pages",
        description:
          "Move from coalition analysis into the bill-level records when you want the statutory text, related sources, and Black Impact Score context.",
      },
    ],
    sourceContexts: [
      {
        title: "The Civil Rights Act of 1964",
        sourceType: "government",
        sourceNote:
          "Official Senate history on the bipartisan coalition, the filibuster fight, and final passage of the Civil Rights Act.",
      },
      {
        title: "The Senate Passes the Voting Rights Act",
        sourceType: "government",
        sourceNote:
          "Official Senate history page on passage of the Voting Rights Act after Selma and the debate over federal voting protections.",
      },
      {
        title: "The Fair Housing Act of 1968",
        sourceType: "government",
        sourceNote:
          "House historical account of the final open-housing push and House passage after years of resistance.",
      },
      {
        title: "Civil Rights Act of 1991",
        sourceType: "congressional-record",
        sourceNote:
          "Congress.gov action history and summary for the 1991 law that restored and strengthened several employment-discrimination protections.",
      },
      {
        title: "Violent Crime Control and Law Enforcement Act of 1994",
        sourceType: "congressional-record",
        sourceNote:
          "Congress.gov action history for the final conference votes on the 1994 crime bill.",
      },
      {
        title: "Personal Responsibility and Work Opportunity Reconciliation Act of 1996",
        sourceType: "congressional-record",
        sourceNote:
          "Congress.gov action history for the final conference votes on the 1996 welfare reform law.",
      },
      {
        title:
          "Fannie Lou Hamer, Rosa Parks, and Coretta Scott King Voting Rights Act Reauthorization and Amendments Act of 2006",
        sourceType: "congressional-record",
        sourceNote:
          "Congress.gov action history showing how strongly bipartisan the 2006 Voting Rights Act reauthorization vote still was.",
      },
      {
        title: "The Other Great Migration: Southern Whites and the New Right",
        sourceType: "academic",
        sourceNote:
          "Research on how southern white conservatism fed later Republican coalition-building, useful for explaining why modern party labels cannot simply be projected backward.",
      },
    ],
    argumentMode: {
      summary:
        "Neither party name answers this question by itself. Votes show which coalition backed or fought a law in that era, but they do not by themselves make 1964 party labels identical to today's or settle motive without bill text, enforcement, and outcomes.",
      quickResponse:
        "Party labels alone do not answer this. The real evidence is which coalition voted for the law in that era and what the law actually did.",
      discussionResponse:
        "This question gets flattened into team labels, but congressional records are more specific than that. Major civil-rights votes often turned on coalition and region, not a simple modern party split. Votes show support or opposition to a bill; bill text, enforcement, and outcomes tell you how much that vote meant.",
      debateResponse:
        "Claim: One party name settles the history.\n\nEvidence: Roll-call votes, regional splits, and party realignment show that the same label can cover very different coalitions across eras.\n\nLimit: A vote is direct evidence of support or opposition to a bill, but it does not by itself prove motive, so the strongest conclusion comes from pairing the vote with bill text and outcomes.",
      keyPoints: [
        "Party names stayed; coalitions moved.",
        "On major civil-rights votes, region often mattered as much as party.",
        "A roll-call vote is hard evidence of support or opposition to that bill.",
        "A vote is not hard evidence of personal racial motive.",
        "An explicit segregation law and a race-neutral law with disparate impact are different evidence cases.",
        "The strongest method is simple: vote, bill text, enforcement, outcome.",
      ],
      commonClaims: [
        {
          claim:
            "Democrats once supported segregation, so modern Democrats cannot credibly claim a civil-rights record.",
          response:
            "That skips over coalition change. The segregationist bloc was heavily concentrated among Southern Democrats, while many Northern Democrats and liberal Republicans backed later civil-rights laws. Over time, southern conservative voters and politicians moved much more heavily into the Republican coalition, so the party labels need era and region attached to them.",
          question:
            "Are you comparing party names across centuries, or the actual coalition that voted on the law in that specific era?",
        },
        {
          claim:
            "Republicans passed the civil-rights laws by themselves, so the issue is settled.",
          response:
            "Republicans were important to several landmark civil-rights votes, but those laws still passed through bipartisan coalitions rather than a single-party bloc. The record is stronger when you identify who joined the coalition, who opposed it, and how regional sorting shaped the result.",
          question:
            "Which chamber, which year, and which coalition are you describing?",
        },
        {
          claim:
            "A yes vote on the 1994 crime bill proves racist intent.",
          response:
            "The vote proves support for that package, not an automatic reading of personal motive. The stronger case against parts of the crime bill comes from later evidence about sentencing, prison expansion, and racially disparate criminal-justice exposure, not from mind-reading alone.",
          question:
            "What does the bill text and later outcome evidence show, beyond the fact that a member voted yes?",
        },
        {
          claim:
            "If a law is race-neutral on paper, race has nothing to do with it.",
          response:
            "Race-neutral wording can still produce racially uneven effects through eligibility rules, enforcement priorities, geography, sentencing structure, or administrative discretion. That is why bill text and documented outcomes both matter.",
          question:
            "What happened when the law was enforced, and which communities bore the effect?",
        },
        {
          claim:
            "The vote total alone tells you which party helped Black Americans.",
          response:
            "A vote total is only the first layer. You still need the bill text, regional and ideological coalition, enforcement record, and measured outcomes before making a strong historical claim about Black impact.",
          question:
            "What did the law actually do after it passed, and who was protected or burdened in practice?",
        },
      ],
      debateLines: [
        "Stop arguing by party label alone.",
        "Ask who voted, from where, on what bill.",
        "A roll call shows a position, not a soul.",
        "1964 and 1994 are not the same coalition map.",
        "If you skip the law and its effects, you are not done with the history.",
      ],
      shareCards: [
        {
          title: "Party label is not evidence",
          text:
            "Party names last longer than party coalitions. The real question is who voted for the law, from which region, and what the law did.",
          context:
            "Use when someone treats party names as timeless proof.",
        },
        {
          title: "Votes show position",
          text:
            "A roll-call vote is direct evidence of support or opposition to a bill. It is not automatic proof of motive.",
          context:
            "Use when a vote is being treated as mind-reading.",
        },
        {
          title: "1964 is not 1994",
          text:
            "Civil-rights, crime, welfare, and voting bills do not all sort the same way. Era and coalition matter.",
          context:
            "Use when different eras are collapsed into one party story.",
        },
        {
          title: "Read the whole record",
          text:
            "The serious method is vote, bill text, enforcement, and outcome. Party label alone is not enough.",
          context:
            "Use when the debate has collapsed into a party-label argument.",
        },
      ],
    },
    structuredSections: [
      {
        title: "Historical framing",
        body:
          "Party labels are long-lived; party coalitions are not. In the late 19th and early 20th centuries, many of the lawmakers most committed to segregation and Black disfranchisement were Southern Democrats. By the mid-20th century, civil-rights coalitions increasingly joined Northern Democrats with liberal or moderate Republicans, while much of the sharpest resistance came from Southern segregationists. Later, southern conservative voters and officeholders moved more heavily into the Republican coalition. That is why a vote cast under the label Democrat or Republican in 1875, 1964, 1994, or today does not mean the same thing without regional and ideological context.",
      },
      {
        title: "Claim or misconception",
        body:
          "Common claim: one party was always the pro-Black party and the other was always the anti-Black party.\n\nThat frame is too weak for serious historical analysis. The better question is which coalition voted for or against policies that expanded or restricted Black civil rights, voting access, equal protection, housing access, labor rights, and criminal-justice fairness in a specific era. Party names matter less than who made up the coalition, what the bill said, and what happened after enactment.",
      },
      {
        title: "What congressional voting records can show",
        body:
          "Roll-call votes can directly show who supported or opposed a bill, how large the majority was, whether support was bipartisan or polarized, and whether the split was strongly regional. When the law itself contains explicit civil-rights protections or explicit racial restrictions, the vote is direct evidence about legislative support for that legal change.\n\nVoting records are especially useful when paired with bill text. Together they can show whether Congress backed open housing, voting-rights enforcement, employment-discrimination remedies, harsher sentencing, or welfare restructuring. They also let readers compare eras instead of treating every party label as stable across time.",
      },
      {
        title: "What voting records cannot prove",
        body:
          "A roll-call vote does not automatically prove a legislator's personal racial intent. It also does not settle whether a law was enforced well, whether its effects were short-term or long-term, or whether every member of a party voted for the same reason.\n\nVotes are one layer of evidence. To make a stronger claim about racial impact, the record still needs bill text, implementation evidence, court decisions, agency behavior, and documented outcomes. To make a stronger claim about motive, the record would also need speeches, campaign appeals, or other direct evidence beyond the vote itself.",
      },
      {
        title: "Why party realignment matters",
        body:
          "The meaning of Democrat versus Republican changed over time because regional and ideological sorting changed. For major mid-century civil-rights battles, the most important split often ran between Southern Democrats and a coalition of Northern Democrats plus liberal Republicans. That is why landmark votes from the 1960s do not map neatly onto today's party alignments.\n\nRealignment matters in the other direction too. Once conservative southern whites moved more fully into the Republican coalition, modern party labels became more informative than they were in 1964. EquityStack should therefore treat party as a historical variable, not a timeless identity tag.",
      },
      {
        title: "Major vote examples to examine",
        body:
          "Civil Rights Act of 1964: Congress outlawed discrimination in public accommodations, employment, and federally assisted programs. The House passed it 290-130 and the Senate 73-27 after a long filibuster fight. The key pattern was a bipartisan pro-civil-rights coalition facing strong Southern resistance, not a clean modern-style party divide.\n\nVoting Rights Act of 1965: The law attacked literacy tests and gave the federal government stronger tools against racial disfranchisement. The Senate passed S. 1564 by 77-19 and the House passed H.R. 6400 by 333-85. Again, the vote showed broad bipartisan support with resistance concentrated among segregationist opponents.\n\nFair Housing Act of 1968: Congress prohibited major forms of race discrimination in the sale or rental of housing. The House approved the final measure 250-172 after years of delay. Its racial-policy relevance is direct because the law targeted discriminatory housing access itself.\n\nCivil Rights Act of 1991: Congress strengthened employment-discrimination remedies, clarified disparate-impact standards, and allowed damages and jury trials in more cases after several Supreme Court decisions had narrowed protections. It passed 93-5 in the Senate and 381-38 in the House under a Republican sponsor and Republican president, showing that late-20th-century civil-rights legislation still drew overwhelming bipartisan support.\n\n1994 Crime Bill: The final conference report passed 235-195 in the House and 61-38 in the Senate. The package combined prevention spending, policing, prison expansion, and tougher sentencing. Its racial-policy relevance comes less from explicit racial text than from later debate over disparate criminal-justice effects.\n\nWelfare reform votes: The 1996 conference report passed 328-101 in the House and 78-21 in the Senate. The law ended AFDC, created TANF, and imposed time limits and work requirements. Its racial-policy relevance depends on implementation and documented effects on poor families, not explicit racial language.\n\nVoting-rights reauthorization votes: The 2006 Voting Rights Act reauthorization passed 390-33 in the House and 98-0 in the Senate. That matters because it shows that even in the modern era, voting-rights protections were not always aligned with today's level of party polarization.\n\nModern voting-access bills: More recent House votes on bills like the John Lewis Voting Rights Advancement Act have been much closer to party-line and stalled in the Senate. That contrast helps show why current party labels should not simply be projected backward, and why older labels should not be projected forward without coalition context.",
      },
      {
        title: "Intent vs impact",
        body:
          "Some policies are straightforward on this question. If a law explicitly excludes or subordinates people by race, then a vote for that law is direct evidence of support for explicit legal discrimination. Other policies are harder. A crime bill, welfare bill, or election-administration bill may be race-neutral on paper while still producing documented racial disparities in practice.\n\nThat is why intent and impact must stay separate. A vote can show legislative support for the instrument. Bill text, enforcement, and outcomes are needed to show whether the mechanism was explicitly discriminatory, formally equal but unevenly enforced, or race-neutral with a disparate effect.",
      },
      {
        title: "How EquityStack should score this evidence",
        body:
          "EquityStack should give the highest weight to laws whose text directly expands or restricts civil rights, voting rights, equal protection, housing access, or anti-discrimination enforcement. Explicit race-based restrictions or explicit civil-rights protections are the clearest cases because the legal effect is visible in the text and the vote.\n\nRace-neutral laws with documented racial effects should still matter, but they should be scored through a combined method: legislative design, vote coalition, enforcement pattern, and outcome evidence. Party label alone should never receive a score. A coalition vote is evidence about support. The Black Impact Score should come from what the policy did.",
      },
      {
        title: "Stronger way to analyze the issue",
        body:
          "A stronger method asks five questions in order. What did the bill text actually do? Who voted for it and against it? Was the split regional, ideological, partisan, or some combination? How was the law enforced after enactment? What documented outcomes followed for Black rights, safety, opportunity, representation, or punishment?\n\nThat approach is better than a party-label argument because it can handle both direct civil-rights laws and race-neutral laws with downstream racial effects. It also keeps the analysis falsifiable: if the text, vote, enforcement, or outcomes point in different directions, the answer should stay qualified.",
      },
      {
        title: "EquityStack takeaway",
        body:
          "The key historical lesson is that party labels alone are not the unit of analysis. Coalitions are. Some of the strongest pro-civil-rights votes in U.S. history were bipartisan but regionally divided. Some later laws with major racial consequences were also bipartisan. More recent voting-access fights have become much more party-polarized.\n\nSo the better question is not which party name existed on the ballot. It is which coalition voted for or against the policy, in that era, and what the policy did.",
      },
      {
        title: "How to respond in a debate",
        body:
          "Common claim: Democrats were the party of segregation, so the issue ends there.\n\nBetter response: Historical labels are not enough. The more precise question is which coalition voted for or against civil-rights and voting-rights laws in the period being discussed, and how the South and the parties realigned over time.\n\nKey question: Are you talking about a party name across centuries, or the coalition that voted on the actual bill?\n\nCommon claim: A yes vote proves racist intent.\n\nBetter response: A yes vote proves support for the bill. Intent requires stronger evidence. Racial impact requires bill text, enforcement, and outcomes.\n\nKey question: What does the law's text and documented effect show beyond the vote itself?",
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
          "The Black-impact channel here is direct. Homeownership is one of the main ways families build wealth, gain housing stability, borrow against appreciating assets, and transfer resources across generations. When Black families were denied fair access to mortgage credit, the effect was not confined to one loan denial. It shaped wealth, neighborhood opportunity, school access, business formation, and the ability to pass assets to children.\n\nThat is why redlining should not be treated as a narrow cartographic curiosity. It was a mechanism through which unequal access to credit became unequal access to wealth across local housing markets.",
      },
      {
        title: "What implementation evidence already shows",
        body:
          "This topic is strongest when readers move from moral language into evidence types: underwriting manuals, federal housing records, HOLC-era maps, HMDA mortgage data, court filings, and DOJ or CFPB enforcement actions. The federal government helped build the modern mortgage market through FHA-era housing policy, later created disclosure tools like HMDA, and still relies on fair-lending enforcement to address redlining in the present.\n\nThat implementation record matters because it shows both sides of the history: the state helped structure the housing system in ways that excluded Black families, and later had to create data and enforcement tools to detect and respond to discriminatory lending patterns that persisted.",
      },
      {
        title: "Why modern enforcement matters",
        body:
          "One of the most important upgrades to this explainer is that the source base no longer ends in the 1970s. Modern CFPB and DOJ enforcement actions still describe illegal redlining in majority-Black neighborhoods. That does not mean present-day redlining is identical to the HOLC era, and it does not prove every lending disparity has the same cause. It does mean the evidence record on unequal credit access remains active.\n\nThis helps readers avoid two mistakes at once: treating redlining as a dead historical issue, or collapsing every modern disparity into the exact same mechanism. The stronger claim is narrower and more defensible: historic exclusion built durable inequality, and discriminatory mortgage access still appears in modern enforcement records.",
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
          "The Black-impact issue here is asset ownership. Land is not just acreage. It can produce food, income, collateral, family stability, and inheritance. The Homestead Act transferred more than 270 million acres into private ownership, so unequal practical access to that system could affect wealth beyond the first generation of claimants.",
      },
      {
        title: "What implementation evidence already shows",
        body:
          "The implementation record matters more than the statutory text by itself. Land patents, Freedmen's Bureau records, Reconstruction history, and homesteader research show that formal eligibility under the Homestead Act did not erase the realities of emancipation, missing capital, weak federal protection, racial terror, and short-lived federal support. The law may have been open on paper without being equally usable in practice.",
      },
      {
        title: "What this evidence can support",
        body:
          "The evidence supports a bounded but important claim: the Homestead Act was a major public wealth-building program measured in hundreds of millions of acres, and Black Americans entered it from conditions that made equal benefit far harder to achieve. That is enough to challenge simplistic claims that America had already distributed equal opportunity through land policy.",
      },
      {
        title: "What this evidence cannot prove on its own",
        body:
          "This evidence does not show that the Homestead Act explicitly banned all Black claimants or that no Black families benefited. Black homesteaders did claim and keep land in documented cases. The stronger argument separates existence from scale and impact: participation existed, but the capacity to convert eligibility into durable ownership was shaped by capital, safety, legal support, and enforcement.",
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
        "That argument treats public support as neutral in practice even though land, mortgages, education, labor protections, and veterans benefits all ran through institutions whose records show uneven access and unequal administration.",
      dataShows: [
        "Public policy repeatedly helped build wealth, stability, and mobility through land access, housing finance, labor protection, education, and veterans benefits.",
        "Those benefits depended on real delivery systems such as banks, colleges, agencies, and local gatekeepers rather than abstract eligibility alone.",
        "Black Americans faced documented barriers across multiple benefit channels, which compounded over time rather than operating as one isolated program effect.",
        "The stronger historical question is not whether public help existed. It is who could use it fully.",
      ],
      bottomLine:
        "The historical record does not support simple handout rhetoric. It shows repeated public investment and repeated unequal access to its benefits.",
      responseScript:
        "That argument leaves out how government built wealth through land, mortgages, labor rules, education, and veterans benefits. The real historical question is not whether public help existed. It is who had full access to it, through which institutions, and at what scale.",
      responseContext:
        "Use when public benefits are discussed as if they were neutral in practice or unique to Black communities.",
    },
    questions: [
      "How did public benefits shape wealth and opportunity for different communities?",
      "Which policy areas most clearly show unequal access to government-backed advantage?",
      "How should readers connect benefits history to present-day debates about equity and opportunity?",
    ],
    argumentMode: {
      summary:
        "No. Government helped build American wealth, and Black access to those benefits was not equal. The record is strong across land, housing, education, labor, and veterans benefits, even though it does not turn every modern gap into a one-program story.",
      quickResponse:
        "Government help existed, but access to it was not equal. The question is not whether benefits existed; it is who could actually use them.",
      discussionResponse:
        "This debate often treats public help as neutral once it appears on paper. The broader record is that land policy, mortgages, schooling, labor protections, and veterans benefits built opportunity through institutions that did not operate evenly. That supports a cumulative access argument without claiming one program explains every present-day gap.",
      debateResponse:
        "Claim: Government benefits were available to everyone, so they cannot explain racial gaps.\n\nEvidence: Wealth-building benefits moved through lenders, schools, agencies, and local gatekeepers, and unequal access across several programs compounds over time.\n\nLimit: The strongest conclusion is cross-systemic, not that one benefit line explains every modern disparity by itself.",
      keyPoints: [
        "Government did not just police markets; it helped build the middle class.",
        "Land, mortgages, schooling, labor rules, and veterans benefits mattered because they built lasting wealth and stability.",
        "Those gains ran through lenders, schools, agencies, and local gatekeepers that did not treat everyone the same.",
        "Unequal access across several programs compounds into later wealth and opportunity gaps.",
        "This is an access story, not a handout story.",
        "What the broad record cannot do alone is pin every modern gap on one benefit line.",
      ],
      commonClaims: [
        {
          claim:
            "Government help was broadly available, so current racial gaps cannot be tied to public benefits.",
          response:
            "That treats eligibility language as if it were the whole record. The stronger historical question is who could actually use land, mortgages, labor protections, education, and veterans benefits fully, through which institutions, and at what scale.",
          question:
            "What evidence shows the delivery systems operated equally rather than only that a benefit existed on paper?",
        },
        {
          claim:
            "Talking about unequal benefits is just a handout argument.",
          response:
            "This is not mainly a handout argument. It is an access argument about how the government built wealth and security, and how those gains were distributed through institutions that did not operate neutrally in practice.",
          question:
            "Are you debating whether public investment existed, or who could convert it into durable advantage?",
        },
        {
          claim:
            "If some Black families used these programs, then the system was basically fair.",
          response:
            "Documented participation matters, but it does not settle the scale question. The stronger historical reading separates existence from reach: some Black participation occurred, while access barriers still narrowed the overall benefit stream.",
          question:
            "What evidence shows isolated participation matched the overall scale of access enjoyed by less constrained groups?",
        },
        {
          claim:
            "Modern racial gaps must be about culture or effort, not benefits history.",
          response:
            "That skips over how wealth and opportunity accumulate. When land, homeownership, labor protection, and education access are distributed unevenly across generations, later outcomes do not start from a neutral baseline.",
          question:
            "What evidence shows the public-investment gap stopped mattering to wealth, neighborhoods, or opportunity over time?",
        },
      ],
      debateLines: [
        "A benefit on paper is not a benefit in hand.",
        "The middle class was subsidized too.",
        "Access matters as much as eligibility.",
        "This is not about handouts; it is about who could cash in public policy.",
        "If government helped build wealth, unequal access to that help matters.",
      ],
      shareCards: [
        {
          title: "A benefit on paper",
          text:
            "Paper eligibility is not equal delivery. Banks, schools, agencies, and local gatekeepers decided who could really use public benefits.",
          context: "Use when someone treats paper eligibility as the full story.",
        },
        {
          title: "The middle class was subsidized",
          text:
            "Land, mortgages, education, labor rules, and veterans benefits were public help too. The issue is who could fully use them.",
          context: "Use when public support is framed as if it only meant welfare.",
        },
        {
          title: "Not a handout claim",
          text:
            "This is an access claim: public policy built wealth, but access to that wealth-building was not even.",
          context: "Use when the argument is reduced to rhetoric about personal dependence.",
        },
      ],
    },
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
          "The Black-impact issue here is cumulative access. Land, mortgages, labor protections, education, and veterans benefits all shape wealth and security. When access barriers appear across several channels at once, the resulting gap is larger than any one program can explain by itself.",
      },
      {
        title: "What implementation evidence already shows",
        body:
          "This is not a theory about abstract bias alone. The implementation record includes land policy, mortgage underwriting, college admissions capacity, labor-law coverage, agency rules, and local gatekeeping. Those institutions distributed opportunity unevenly even when the federal benefit looked broad in statutory language.",
      },
      {
        title: "What this evidence can support",
        body:
          "The evidence supports a strong historical claim that government helped create middle-class security and wealth, while access to those gains was racially uneven across multiple policy channels. This helps explain why modern debates that oppose public help in the abstract are historically incomplete.",
      },
      {
        title: "What this evidence cannot prove on its own",
        body:
          "This evidence does not mean every benefit program worked the same way or that every racial wealth gap can be traced to one policy lane. To prove a single-program causal claim, the evidence would need program-specific eligibility, uptake, and outcome data. The stronger claim is cumulative and cross-systemic: repeated unequal access to public support widened later disparities.",
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
      "This topic is frequently framed as a conflict between two struggling communities. The stronger record question is how governments wrote eligibility rules, budget priorities, and enforcement systems that shaped scarcity in the first place.",
    argumentReady: {
      claim:
        "Immigrants are taking resources meant for Black Americans.",
      whyMisleading:
        "That frame blames another vulnerable community for problems created by policy design and underinvestment, and it leaves out program-level eligibility rules showing that undocumented immigrants are barred from most major federal means-tested benefits.",
      dataShows: [
        "Major federal benefit programs use immigration-status rules, waiting periods, and state-option rules rather than open-ended access.",
        "Undocumented immigrants are barred from most major federal means-tested benefits, which separates eligibility from claims about resource diversion.",
        "Even lawful immigrants can face waiting periods or category limits depending on the program and the state.",
        "Scarcity in Black communities is better explained by housing, education, labor, and budget policy choices than by a simple immigrant-takes-the-benefits story.",
      ],
      bottomLine:
        "Resource scarcity is mainly a policy and budget problem, not proof that immigrants are stealing resources from Black communities.",
      responseScript:
        "That argument blames another struggling community for problems created by policy choices. Program rules bar undocumented immigrants from most major federal public benefits, and Black communities have documented underinvestment across housing, education, labor, and criminal-justice policy over generations.",
      responseContext:
        "Use when immigration is blamed for scarcity in Black communities.",
    },
    questions: [
      "What federal rules actually govern immigrant eligibility for major public benefits?",
      "Why is resource scarcity in Black communities better explained through policy choices than through a zero-sum immigrant frame?",
      "How should readers respond when two vulnerable communities are being treated as policy rivals?",
    ],
    argumentMode: {
      summary:
        "No. The strongest evidence does not show immigrants broadly taking resources that were otherwise flowing fully to Black communities. It shows status-based eligibility limits on major federal benefits and a deeper history of underinvestment that policy choices created long before the modern blame frame.",
      keyPoints: [
        "Major federal benefit programs use immigration-status rules, waiting periods, verification systems, and state-option design rather than open-ended access.",
        "Undocumented immigrants are barred from most major federal means-tested benefits, which weakens the broad diversion story at the federal-program level.",
        "Even lawful immigrants can face category limits or waiting periods, so serious claims have to be program-specific rather than rhetorical.",
        "Scarcity in Black communities is better explained through housing, education, labor, criminal-justice, and budget policy choices than through a simple immigrant-takes-the-benefits story.",
        "This does not prove immigration has no effect on any local budget, service load, or political decision in any context.",
        "The stronger bounded claim is that the broad federal blame frame does not match the eligibility rules or the longer underinvestment record.",
      ],
      commonClaims: [
        {
          claim:
            "Immigrants are taking resources meant for Black Americans.",
          response:
            "That claim skips over the actual benefit rules. Major federal programs do not simply provide open-ended access, and Black scarcity has a much deeper policy history than a one-step diversion story can explain.",
          question:
            "Which program are you talking about, what are its eligibility rules, and what record shows the specific diversion you are claiming?",
        },
        {
          claim:
            "Undocumented immigrants can just show up and collect welfare.",
          response:
            "That does not match the basic federal means-tested benefit rules. Undocumented immigrants are barred from most of the major programs usually invoked in this argument.",
          question:
            "Which major federal program are you claiming undocumented immigrants can freely access, and what source shows that?",
        },
        {
          claim:
            "Even if federal rules are restrictive, the real-world result is still immigrants getting what Black communities should have received.",
          response:
            "That is still a policy-allocation claim, not proof that immigrants caused the scarcity. To make it seriously, the evidence would need local budget records, service-use data, and decision-making records showing where the resources went and what tradeoff occurred.",
          question:
            "What budget, service, or administrative record shows the actual tradeoff rather than only a political narrative about it?",
        },
        {
          claim:
            "Black communities are losing because the government now prioritizes immigrants over citizens.",
          response:
            "That erases the longer record of segregated housing, unequal schools, labor exclusion, disinvestment, and criminal-justice harm that shaped scarcity before the current immigration frame became popular.",
          question:
            "What evidence shows immigrant policy replaced a previously equal baseline for Black communities rather than layering onto older policy failures?",
        },
      ],
      debateLines: [
        "Name the program, then name the eligibility rule.",
        "Scarcity is a policy choice before it is a blame story.",
        "Undocumented immigrants being barred from most major federal benefits matters to the claim.",
        "A local budget claim needs local budget evidence, not only rhetoric.",
        "The divide-and-blame frame hides the decision-makers who wrote the rules in the first place.",
      ],
      shareCards: [
        {
          title: "Start with the rules",
          text:
            "Major federal benefit systems use immigration-status restrictions, waiting periods, and verification rules. A broad claim about immigrants taking benefits has to confront those rules first.",
          context: "Use when the argument skips straight to blame without naming a program.",
        },
        {
          title: "Scarcity has authors",
          text:
            "Budgets, eligibility rules, and public underinvestment are policy choices. A blame frame that treats scarcity as if immigrants created it from nowhere leaves out the actual decision-makers.",
          context: "Use when the debate becomes zero-sum between vulnerable communities.",
        },
        {
          title: "Local proof needs local records",
          text:
            "If someone claims immigration changed who got resources in a specific place, the proof should be in budgets, service records, or administrative decisions, not just a general slogan.",
          context: "Use when a national talking point is used to make a local diversion claim.",
        },
      ],
    },
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
          "The strongest Black-impact issue here is not a single benefits application. It is long-run public investment. Black communities have lived with unequal access to housing credit, school quality, labor-market protection, neighborhood investment, and equal treatment by public institutions. Those constraints created measurable scarcity long before modern immigration arguments were packaged as zero-sum competition.",
      },
      {
        title: "What implementation evidence already shows",
        body:
          "The implementation record weakens the popular claim. Major federal benefit systems do not simply open the door to anyone who arrives. Immigration status, lawful presence rules, waiting periods, verification systems, and state-option design all matter. That means the strongest factual question is not whether immigrants somehow bypassed the line, but how benefit rules are actually written, verified, and enforced.",
      },
      {
        title: "What this evidence can support",
        body:
          "The evidence supports a bounded but important claim: resource scarcity in Black communities is better explained through policy design, underinvestment, and unequal access than through a story about immigrants taking benefits that were otherwise fully available to Black Americans.",
      },
      {
        title: "What this evidence cannot prove on its own",
        body:
          "This evidence does not prove that immigration has no effect on local budgets or service demand in any context. To prove that claim, the evidence would need local budget records, service-use data, and program-specific eligibility findings. The stronger point is narrower: the broad claim about immigrants taking resources from Black communities does not match federal eligibility rules or the deeper history of how Black communities were underinvested in the first place.",
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
          "The implementation story is the doctrine. Court rulings, congressional statutes, agency enforcement, and access to remedies gave equal protection practical meaning or practical weakness. Plessy showed how the Court could hollow out the guarantee. Brown and later civil-rights statutes showed how the federal government could revive and enforce it more aggressively.",
      },
      {
        title: "What this evidence can support",
        body:
          "The evidence supports the claim that equal protection is a legal standard that requires interpretation and enforcement. It is not a self-executing guarantee of equal life outcomes, nor even of equal treatment in practice without supporting institutions.",
      },
      {
        title: "What this evidence cannot prove on its own",
        body:
          "This evidence does not mean every disparity is automatically an equal-protection violation. Constitutional litigation imposes specific doctrinal tests and evidentiary burdens, including evidence about state action, classification, intent, effect, or the standard of review. The stronger historical claim is that constitutional equality and practical equality have repeatedly diverged.",
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
        "Formally neutral rules can still generate patterned racial disparity when thresholds, mandatory minimums, charging choices, plea leverage, criminal-history rules, and relief mechanisms operate unevenly across the system.",
      dataShows: [
        "Sentencing outcomes are shaped before final judgment through statutes, charging decisions, plea terms, sentencing guidelines, and access to relief.",
        "Federal cocaine sentencing policy created one of the clearest racially unequal punishment frameworks in modern U.S. law.",
        "Disparity can emerge through the interaction of legal design and institutional discretion rather than through one single decision point.",
        "Later reforms narrowed specific disparities, which shows the punishment structure was not fixed or inevitable.",
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
    argumentMode: {
      summary:
        "No. Race-neutral wording does not prove equal punishment. Sentencing is shaped by thresholds, charges, pleas, guidelines, and relief rules, and that structure can produce racial disparity even though it does not prove bias in every single case.",
      quickResponse:
        "Race-neutral text is not the same as equal punishment. Charges, plea deals, thresholds, and relief rules shape the sentence before the judge says the number.",
      discussionResponse:
        "A sentencing statute can look neutral and still produce unequal punishment in practice. The record is strongest where legal design and institutional discretion interact, especially in cocaine sentencing and the reforms that followed. That supports a systemic conclusion about how punishment gets distributed while stopping short of proving bias in every individual case.",
      debateResponse:
        "Claim: If the law did not mention race, the sentence was fair.\n\nEvidence: Mandatory minimums, charging choices, plea leverage, guideline structure, and access to relief all affect outcomes before final judgment.\n\nLimit: This evidence shows patterned disparity across the system; it does not by itself prove discriminatory intent in each sentence.",
      keyPoints: [
        "By sentencing day, much of the outcome is already set.",
        "Thresholds, mandatory minimums, charging, and plea leverage shape punishment before the judge speaks.",
        "Crack-era federal sentencing is a documented disparity, not a hypothetical.",
        "Reform matters because it shows the rules were changeable.",
        "Systemic disparity can be real even when every single case does not carry the same proof.",
        "What the record cannot do alone is prove intentional bias in every sentence.",
      ],
      commonClaims: [
        {
          claim:
            "Tough sentencing is race-neutral because it punishes conduct, not race.",
          response:
            "That only addresses statutory language. The full record includes thresholds, mandatory minimums, charging decisions, plea leverage, guideline structure, and access to relief, all of which shape who receives what punishment in practice.",
          question:
            "What part of the sentencing pipeline are you evaluating besides the words written into the statute?",
        },
        {
          claim:
            "If disparities exist, they just reflect differences in offending.",
          response:
            "That skips over how punishment is constructed after an arrest. Similar conduct can still produce different outcomes when charging, plea bargaining, criminal-history treatment, and relief eligibility operate unevenly.",
          question:
            "What evidence shows the disparity disappears after you compare charges, plea leverage, thresholds, and access to sentencing relief?",
        },
        {
          claim:
            "The Fair Sentencing Act and First Step Act fixed the problem, so the old disparity argument is outdated.",
          response:
            "Those reforms matter precisely because they show the earlier structure needed correction. Narrowing one disparity does not prove the prior system was neutral or that all sentencing inequality disappeared afterward.",
          question:
            "Why were major reforms necessary if the earlier punishment structure was already functioning fairly?",
        },
        {
          claim:
            "Unless you prove bias in every individual case, the sentencing claim is weak.",
          response:
            "The strongest version of the argument is systemic, not case-by-case mind-reading. A system can produce patterned unequal punishment through legal design and institutional practice without every single case carrying the same proof.",
          question:
            "Are you asking for person-by-person proof to avoid the structural evidence showing a recurring pattern?",
        },
      ],
      debateLines: [
        "Neutral wording is not equal punishment.",
        "The sentence starts before the judge finishes it.",
        "Crack-era sentencing is evidence, not folklore.",
        "If the rules were fair, why did Congress rewrite them?",
        "Systemic disparity does not require mind-reading every case.",
      ],
      shareCards: [
        {
          title: "The sentence starts early",
          text:
            "Charges, plea terms, statutory thresholds, and relief rules shape punishment before the judge gives the final number.",
          context: "Use when legal wording is treated as proof of equal outcomes.",
        },
        {
          title: "Crack policy is evidence",
          text:
            "Federal crack sentencing is one of the clearest documented examples of race-neutral text producing unequal punishment.",
          context: "Use when someone talks as if sentencing disparity is only a theory.",
        },
        {
          title: "One reform is not the whole fix",
          text:
            "Reform proves the rules were changeable. It does not prove the rest of the sentencing pipeline is equal.",
          context: "Use when someone treats past disparity as a natural result rather than a policy choice.",
        },
      ],
    },
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
          "The Black-impact channel is direct because sentence length shapes incarceration, supervision, family separation, earnings, and long-run community stability. Federal crack sentencing is one of the clearest examples because sentencing data and statutory history show a punishment structure that fell heavily on Black defendants and Black communities.",
      },
      {
        title: "What implementation evidence already shows",
        body:
          "The implementation story is broader than a judge's final ruling. Legislatures set thresholds and mandatory minimums. Prosecutors decide charges and plea terms. Sentencing commissions shape guidelines. Safety-valve eligibility, cooperation departures, and other forms of relief from mandatory penalties are uneven. Disparity can emerge at several stages before the sentence is formally announced.",
      },
      {
        title: "What this evidence can support",
        body:
          "The evidence supports a strong structural claim: unequal sentencing outcomes are produced by the interaction of legal design and institutional discretion. It also supports a narrower claim that federal cocaine sentencing policy created one of the clearest racially unequal punishment frameworks in modern U.S. law.",
      },
      {
        title: "What this evidence cannot prove on its own",
        body:
          "This evidence does not prove that every sentence difference in every case is the product of racial discrimination. To prove that narrower claim, case-level evidence would need to compare similarly situated defendants, charges, histories, pleas, and judicial findings. The stronger point is systemic: formally neutral institutions can still produce patterned differences in punishment that persist across cases and over time.",
      },
      {
        title: "Why reform is incomplete",
        body:
          "The Fair Sentencing Act and First Step Act matter because they show the system was changeable. But the fact that later reforms were necessary is itself part of the story. Specific disparities were narrowed without proving that every sentencing gap was eliminated.",
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
          "The Black-impact issue here is not only about measurement error. It is about interpretive harm. Race-and-crime slogans are frequently used to justify harsher policing, longer punishment, and moralized judgments about Black communities without doing the methodological work required to support those claims.",
      },
      {
        title: "What implementation evidence already shows",
        body:
          "Different federal systems were built to answer different questions. FBI reporting tracks crimes known to law enforcement and related administrative outcomes. The NCVS captures victimization beyond what is reported to police. Clearance rules matter because unsolved crimes do not produce an identified offender in police data. Once readers see those institutional differences, the slogan loses much of its apparent simplicity.",
      },
      {
        title: "What this evidence can support",
        body:
          "The evidence supports a methodological warning: compressed race-and-crime claims can mix unlike categories and ask law-enforcement statistics to prove more than they can. That is enough to reject simplistic conclusions drawn from the slogan alone.",
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
        "The claim compresses different datasets into a racial conclusion the data cannot support. Arrest, reported-crime, clearance, conviction, victimization, and homicide figures do not measure the same thing, and none of them establish inherent traits or causation on their own.",
      dataShows: [
        "Cited versions of the claim rely on law-enforcement data such as arrests, crimes known to police, clearances, or homicide records rather than a full measure of total offending.",
        "The numbers can show a disparity, but they do not establish why the disparity exists or prove inherent criminality.",
        "Age, gender, geography, poverty exposure, reporting patterns, policing, clearance, and victimization all affect how the data should be interpreted.",
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
        "The '13/50' claim is usually presented as if a population share and a crime-system measure prove something about Black people as a group. The actual data is narrower and does not support that conclusion.",
      keyPoints: [
        "Arrest data is not total crime.",
        "Disparity does not equal causation.",
        "Context variables matter, including age, poverty, geography, reporting, and policing.",
        "A group-level statistic cannot identify individual suspicion or individual offending.",
        "Victimization is ignored in the misuse of the statistic.",
      ],
      commonClaims: [
        {
          claim:
            "Black Americans are 13 percent of the population but commit about half of murders, so the cause must be race.",
          response:
            "The data can show a disparity in arrest, clearance, or homicide records depending on the dataset. It does not establish race as the cause, and it does not account for age, gender, geography, victimization, reporting, clearance, or concentrated exposure to violence.",
          question:
            "Which dataset are you using, and how does it prove causation rather than only showing a disparity?",
        },
        {
          claim:
            "The statistic proves Black people are inherently more criminal.",
          response:
            "That conclusion does not follow from arrest-based, reported-crime, or clearance-linked data. Group-level criminal-justice data cannot establish inherent traits, cannot measure total offending, and cannot justify judging individuals by race.",
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
            "Context is not an excuse. It is how serious analysis separates the existence of a disparity from its scale, causes, and policy implications, then points toward violence reduction, better clearance, victim protection, and prevention.",
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
        "A serious public-safety response should identify the specific measure, the scale of harm, and the intervention likely to reduce violence.",
      ],
      shareCards: [
        {
          title: "Data versus conclusion",
          text:
            "The 13/50 claim points to a disparity in a specific crime dataset. It does not prove inherent criminality, causation, or total offending. The key question is what the dataset measures, what scale it captures, and whether it supports the conclusion being drawn.",
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
            "Explaining risk factors is not excusing violence. It is how you move from a slogan to measurable policies: reducing shootings, improving clearance, protecting victims, and preventing future harm.",
          context: "Use when context is dismissed as denial.",
        },
        {
          title: "Victims matter",
          text:
            "The statistic is frequently used without acknowledging that Black Americans are also disproportionately victims of serious violence. A serious discussion has to include victimization data, prevention, and public safety.",
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
          "The usual versions of the 13/50 claim depend on law-enforcement data. FBI data are frequently arrest-based or based on crimes known to police. Arrest does not equal conviction. Conviction does not equal total crime. Reported crime does not equal all victimization. Clearance rates matter because unsolved offenses do not produce an identified offender in police data, and reporting practices differ across offense types and communities.\n\nNone of those limits make the data useless. They mean the data have to be used for the question they can answer. They can support a discussion of disparities, victimization, geography, and public safety. They cannot prove inherent racial criminality.",
      },
      {
        title: "Why the comparison is incomplete",
        body:
          "A national population share is not the same thing as the population at highest risk of arrest or victimization. Crime risk varies heavily by age, gender, location, poverty exposure, neighborhood violence, and local enforcement patterns. A statistic that compares the total Black population to a subset of reported or cleared offenses therefore mixes a broad denominator with a narrower risk environment.\n\nThis does not make the disparity disappear. It means the comparison is incomplete. A serious analysis has to distinguish group population share from the individuals, places, age groups, and circumstances represented in criminal-justice data.",
      },
      {
        title: "Context the statistic leaves out",
        body:
          "Homicide data are treated differently because homicide is more likely to be reported than many other offenses and because death records, police reports, and supplemental homicide systems provide more detail than many crime categories. That makes homicide data important, but it does not make them self-interpreting.\n\nThe statistic is also frequently presented as if Black communities only appear on the offender side of the ledger. That leaves out victimization. Black Americans are disproportionately exposed to violent victimization, including homicide victimization in many jurisdictions.\n\nCrime risk is also shaped by conditions that are not captured in a national race-and-population slogan: concentrated poverty, residential segregation, school quality, housing instability, labor-market exclusion, local disinvestment, exposure to prior violence, and illegal firearm access. These are risk factors, not excuses.",
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
          "Common claim: Black Americans are about 13 percent of the population but account for about half of murders or violent crime, so the data prove inherent criminality.\n\nBetter response: The statistic points to a disparity in reported, arrest-based, or cleared-crime data depending on the version being cited. It does not establish inherent criminality, causation, or total offending. To interpret it responsibly, we have to ask whether we are looking at arrests, convictions, victimization, reported offenses, or homicide clearances, and then account for age, gender, geography, victimization, and concentrated risk factors.\n\nKey question to ask: Which dataset are you using, what exactly does it measure, what scale does it capture, and how does it prove the conclusion you are drawing rather than only showing a disparity?",
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
  "non-citizen-voting-claims": {
    explainer_type: "misused_claim",
    category: "election-integrity",
    tags: ["elections", "voting", "citizenship", "election-integrity", "data-analysis"],
    argumentReady: {
      claim:
        "Large numbers of non-citizens are voting and influencing elections.",
      whyMisleading:
        "The claim often turns individual cases, registration issues, or unverified allegations into a systemic conclusion. The question is existence, scale, and impact: whether verified records show counted ineligible ballots at a level large enough to affect elections with millions or tens of millions of ballots.",
      dataShows: [
        "Documented cases and verified instances exist, but audits, prosecutions, court findings, and election-administration reviews have not produced evidence of widespread or systemic non-citizen voting.",
        "Election systems track registration records, ballots cast, audits, recounts, prosecutions, and administrative findings rather than hypothetical voters.",
        "Registration-list issues, attempted registrations, and counted illegal ballots are different things.",
        "Anecdotes can justify enforcement, but they do not establish large-scale impact without verified records showing counted ineligible ballots at election-relevant scale.",
      ],
      bottomLine:
        "The evidence supports vigilance and election safeguards. It does not support claims that audits, prosecutions, court findings, or official reviews have found mass non-citizen voting in U.S. elections.",
      responseScript:
        "Documented cases can exist, but the mass-voting claim is about scale and impact. Audits, prosecutions, court findings, and election-administration reviews have not shown widespread or outcome-changing non-citizen voting.",
      responseContext:
        "Use when individual verified examples are being treated as proof of mass election fraud.",
    },
    argumentMode: {
      summary:
        "Claims of mass non-citizen voting are claims about scale and impact. Documented cases exist, but audits, prosecutions, court findings, and election-administration reviews have not produced verified evidence of widespread or outcome-changing non-citizen voting.",
      keyPoints: [
        "Documented cases exist, but the verified record is measured in individual cases rather than evidence matching national elections with more than 150 million presidential votes.",
        "The central question is scale, not whether any violation has ever occurred.",
        "Anecdotes do not establish systemic evidence.",
        "Election systems use registration requirements, voter-roll maintenance, audits, and penalties to detect and deter ineligible voting.",
        "Claims of large-scale impact require verified records from audits, prosecutions, court findings, or official election-administration reviews.",
      ],
      commonClaims: [
        {
          claim: "Non-citizens are voting in large numbers.",
          response:
            "That is a claim about counted ballots at scale. Documented cases exist, but audits, prosecutions, court findings, and election-administration reviews have not produced verified evidence of widespread or outcome-changing non-citizen voting.",
          question: "What verified evidence shows large-scale impact?",
        },
        {
          claim: "The system is being exploited.",
          response:
            "If exploitation were occurring at election-relevant scale, the evidence should appear in voter-roll reviews, ballot audits, prosecutions, or court findings. Those evidence types have not shown widespread counted ballots by non-citizens.",
          question: "Which audit or investigation shows large-scale fraud?",
        },
        {
          claim: "You're saying it never happens.",
          response:
            "No. Documented cases can exist. The question is whether those cases show counted ballots at a scale large enough to affect contests with hundreds of thousands, millions, or more than 150 million votes. Audits and court findings have not shown that.",
          question: "What number are you claiming, and what source verifies it?",
        },
        {
          claim: "Individual cases prove the election system is broken.",
          response:
            "Individual verified cases can justify enforcement, but they do not by themselves show systemic failure or outcome-changing fraud. The inference changes only if verified records show a repeated pattern large enough to matter for the election being discussed.",
          question:
            "How many verified cases are there, and how do they compare with total ballots cast?",
        },
        {
          claim: "Voter rolls prove non-citizens are voting.",
          response:
            "Voter-roll data can show outdated records, data-matching errors, administrative flags, or attempted registrations. It does not automatically prove that ineligible voters cast counted ballots, and it does not establish scale without ballot-level or adjudicated evidence.",
          question: "Does the evidence show registrations, attempted registrations, or counted ballots?",
        },
      ],
      debateLines: [
        "This is a scale claim, not a question of whether any case has ever existed.",
        "Individual verified cases are not the same thing as systemic evidence.",
        "If the claim is mass voting, the evidence should show counted ineligible ballots at election-relevant scale, not anecdotes.",
        "Audit findings and court records matter more than repeated claims.",
        "Election safeguards are imperfect, but audits, prosecutions, court findings, and election-administration reviews have not shown widespread or outcome-changing non-citizen voting.",
      ],
      shareCards: [
        {
          title: "Scale matters",
          text:
            "Documented non-citizen voting cases exist, but the verified record has not shown counted ballots at a scale large enough to change elections with hundreds of thousands, millions, or more than 150 million votes.",
          context: "Use when an individual case is treated as proof of a mass pattern.",
        },
        {
          title: "Anecdote is not proof",
          text:
            "An individual verified case does not demonstrate a widespread problem. Claims about scale require audits, prosecutions, court findings, or election records showing a broader pattern.",
          context: "Use when the debate jumps from example to system-wide claim.",
        },
        {
          title: "Burden of proof",
          text:
            "If counted illegal ballots existed at mass scale, audits, prosecutions, court findings, and election-administration reviews should reflect that. They have not produced verified evidence of outcome-changing non-citizen voting.",
          context: "Use when a large claim is repeated without a verified source.",
        },
        {
          title: "Registrations are not ballots",
          text:
            "Registration-list errors, attempted registrations, and counted illegal ballots are different things. Evidence has to show what happened, not just what someone suspects.",
          context: "Use when voter-roll claims are treated as proof of votes cast.",
        },
      ],
    },
    sourceContexts: [
      {
        title: "Studies and Reports",
        sourceType: "government",
        sourceNote:
          "Federal election-administration data source for registration, list maintenance, and voting-system context.",
      },
      {
        title: "Election Crimes Branch",
        sourceType: "government",
        sourceNote:
          "DOJ enforcement context for election crimes and criminal penalties, not a claim that every violation is federally prosecuted.",
      },
      {
        title: "Securing the Vote: Protecting American Democracy",
        sourceType: "academic",
        sourceNote:
          "Consensus study on election security, auditability, and reliable election infrastructure.",
      },
      {
        title: "Noncitizen Voting: The Missing Millions",
        sourceType: "advocacy",
        sourceNote:
          "Research from a voting-rights organization; useful for administrator-reported scale after the 2016 election.",
      },
      {
        title: "Election Fraud Map",
        sourceType: "primary-data",
        sourceNote:
          "Documented-case database; useful for verified examples and scale comparison, not as evidence of widespread voting by itself.",
      },
      {
        title: "Citizenship Audit Finds 1,634 Noncitizens Attempted to Register to Vote",
        sourceType: "government",
        sourceNote:
          "State audit example distinguishing attempted registration checks from counted ballots.",
      },
    ],
    lens: "Election claim and evidence guide",
    pagePurpose:
      "Use this page when a claim about mass non-citizen voting needs to be separated into what is documented, what election systems measure, and what evidence would be required to prove large-scale impact.",
    whyThisMatters:
      "The issue should be discussed with precision. Documented cases, attempted registrations, outdated records, and administrative errors can matter for enforcement, but they do not automatically prove systemic fraud or changed election outcomes.",
    questions: [
      "Is the claim about individual documented cases or large-scale impact?",
      "Does the evidence show registrations, attempted registrations, or counted ballots?",
      "Which audit, prosecution, court case, or official finding verifies the scale being claimed?",
    ],
    structuredSections: [
      {
        title: "What election data actually measures",
        body:
          "Election systems track concrete records: voter rolls, registration applications, eligibility requirements, ballots cast, audits, recounts, investigations, and prosecutions. They do not measure hypothetical voters who might exist outside the record.\n\nRegistration rules require applicants to attest to eligibility, including citizenship for federal elections. States use different verification processes, voter-roll maintenance practices, identification rules, signature checks, provisional ballot rules, and post-election audits. Illegal voting also carries criminal penalties.\n\nThose safeguards are not the same in every state, and no administrative system is perfect. The key point is measurement discipline: a registration-list flag, an attempted registration, a pending citizenship check, a provisional ballot rejection, and a counted illegal ballot are different evidence types. A claim about mass voting needs evidence about ballots counted, not only records flagged before voting.",
      },
      {
        title: "What investigations have found",
        body:
          "Audits, court cases, prosecutions, and election-administration reviews have looked for evidence of widespread non-citizen voting. The findings are narrower than the mass-voting claim: documented cases can occur, but official records have not shown widespread, systemic, or outcome-changing non-citizen voting.\n\nThat wording matters. It separates existence from scale and impact. It does not mean no violation has ever happened. It means the evidence types that should reveal a mass problem have not supported claims that large numbers of non-citizens are casting counted ballots and influencing U.S. election outcomes.",
      },
      {
        title: "Scale vs anecdote problem",
        body:
          "The core problem is scale. A verified case can be real and still not prove a widespread pattern. The 2020 presidential election recorded more than 158 million votes for president, and statewide contests often involve hundreds of thousands or millions of ballots. Claims about mass non-citizen voting require evidence that matches the election being discussed.\n\nAnecdotes, rumors, or individual violations can justify enforcement and better administration. They do not establish systemic evidence unless they are connected to verified records showing counted ineligible ballots in a broad, repeated, and election-relevant pattern.",
      },
      {
        title: "How documented cases typically happen",
        body:
          "When documented cases or suspicious records appear, the evidence often points to administrative errors, confusion about eligibility, outdated records, data-matching problems, mistaken registration, or attempted registration that election safeguards catch before a ballot is counted.\n\nThose categories should not be collapsed into a single claim. An attempted registration is not the same as a counted ballot. An outdated record is not the same as a vote. A clerical error is not evidence of a coordinated operation. Each category answers a different question: whether a person registered, whether a ballot was cast, whether the ballot was counted, and whether the number could affect an outcome.",
      },
      {
        title: "Safeguards that exist",
        body:
          "Election safeguards include voter registration requirements, citizenship attestations, state verification processes, voter-roll maintenance, provisional ballot rules, identification requirements that vary by state, signature matching where applicable, post-election audits, recounts, referrals for investigation, and legal penalties for illegal voting.\n\nThese safeguards are designed to detect and deter ineligible voting. They can be improved, but the existence of safeguards also matters when evaluating claims that a large-scale operation is going undetected across jurisdictions.",
      },
      {
        title: "What the claim does not prove",
        body:
          "- Does not prove large-scale fraud exists.\n- Does not show election outcomes were changed.\n- Does not demonstrate systemic failure.\n- Does not distinguish rumor from verified data.\n- Does not show whether a record is an attempted registration, a registration error, or a counted ballot.\n- Does not replace audits, prosecutions, court findings, or official election records.",
      },
      {
        title: "How to respond in a debate",
        body:
          "Common claim: Non-citizens are voting in large numbers.\n\nBetter response: That is a claim about counted ballots at scale, not just registration flags or anecdotes. Documented cases exist, but audits, prosecutions, court findings, and election-administration reviews have not produced verified evidence of widespread or outcome-changing non-citizen voting.\n\nQuestion: What verified evidence shows counted ineligible ballots at large-scale impact?\n\nCommon claim: The system is being exploited.\n\nBetter response: If exploitation were happening at election-relevant scale, it should appear in voter-roll reviews, ballot audits, prosecutions, or court findings. Those evidence types have not shown widespread counted ballots by non-citizens.\n\nQuestion: Which audit or investigation shows large-scale fraud, and does it identify ballots cast, ballots counted, or only registration records?\n\nCommon claim: You're saying it never happens.\n\nBetter response: No. Documented cases can exist. The question is whether those cases show counted ballots at a scale large enough to affect contests with hundreds of thousands, millions, or more than 150 million votes. Audits and court findings have not shown that.\n\nQuestion: What number are you claiming, what source verifies it, and what type of record does it identify?",
      },
      {
        title: "Stronger way to discuss the issue",
        body:
          "A stronger conversation focuses on election security improvements, verified vulnerabilities, transparent audits, accurate voter-roll maintenance, clear registration rules, and credible enforcement when violations occur.\n\nThat frame keeps election integrity grounded in evidence. It also avoids turning individual violations or administrative records into systemic claims without verified data showing counted ineligible ballots at election-relevant scale.",
      },
      {
        title: "EquityStack takeaway",
        body:
          "The claim is powerful because it suggests elections are being influenced at scale.\n\nBut evidence matters:\n- individual documented cases are not the same as widespread fraud.\n- anecdotes are not systemic proof.\n- claims require verified records showing ballots counted at election-relevant scale, not repetition.\n\nEquityStack's approach is to separate claim from evidence, distinguish scale from anecdote, and ask what audits, court records, prosecutions, and election-administration data actually show.",
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
        "That argument turns self-reliance into a complete explanation and removes the public structures that made mobility easier for groups with fuller access to land, mortgages, labor protection, and education.",
      dataShows: [
        "Public offices, housing programs, labor law, and education policy helped structure access to opportunity rather than merely rewarding effort after the fact.",
        "The mobility record supports a strong role for public scaffolding alongside personal effort.",
        "Black Americans faced documented barriers to those public ladders, which makes merit-only narratives incomplete.",
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
    argumentMode: {
      summary:
        "No. Effort matters, but it never operates outside institutions. The mobility record shows that policy helped build the ladders into land, housing, labor protection, and education, while Black Americans faced documented barriers to those same ladders.",
      keyPoints: [
        "American mobility was not built only from private virtue after the fact; it was also built through public land systems, housing policy, labor law, and education access.",
        "That means self-reliance rhetoric is incomplete if it ignores the institutions that made effort easier to convert into security and mobility.",
        "Black Americans faced documented barriers to those public ladders, which makes merit-only stories historically weak.",
        "The strongest question is not whether effort matters. It is whether people were competing inside equal institutions.",
        "This does not prove personal effort is irrelevant or that policy alone determines every individual outcome.",
        "The stronger institutional claim is that effort operates inside systems, and those systems were not historically distributed on equal terms.",
      ],
      commonClaims: [
        {
          claim:
            "People just need to work harder because success comes from effort, not policy.",
          response:
            "That turns effort into a complete explanation and deletes the public scaffolding that helped structure opportunity in the first place. The record shows the United States built mobility partly through policy before it rewarded private effort.",
          question:
            "What evidence shows effort was operating inside equal land, housing, labor, and education systems?",
        },
        {
          claim:
            "Talking about policy just makes excuses for people who did not succeed.",
          response:
            "Recognizing institutions is not the same as denying effort. It is asking whether the rules, assets, and opportunity ladders were distributed evenly enough for effort to produce comparable outcomes.",
          question:
            "How do you evaluate effort fairly if the opportunity structure itself was not equal?",
        },
        {
          claim:
            "If policy mattered, nobody could have succeeded without it.",
          response:
            "That is the wrong standard. The issue is not whether success was impossible in every individual case. It is whether access to the systems that made success more likely was distributed unevenly at population scale.",
          question:
            "Are you using exceptional cases to avoid the larger access pattern?",
        },
        {
          claim:
            "Merit proves itself, so opportunity history is beside the point.",
          response:
            "Merit still needs institutions where effort can be translated into wages, assets, schooling, and stability. If those institutions were not equally accessible, a merit-only conclusion is overstated.",
          question:
            "What path converts merit into security if land, credit, labor protection, and schooling are not equally available?",
        },
      ],
      debateLines: [
        "Effort matters, but it is not floating in midair.",
        "The country built ladders before telling people to climb them.",
        "A self-reliance story is incomplete if it erases the policy scaffolding behind mobility.",
        "Exceptional success does not prove equal institutions.",
        "The serious question is whether effort was operating inside the same opportunity structure.",
      ],
      shareCards: [
        {
          title: "Ladders matter",
          text:
            "Mobility is not only about how hard someone tries. It also depends on whether land, credit, labor protection, and education ladders were actually open to them.",
          context: "Use when self-reliance is treated as a complete historical explanation.",
        },
        {
          title: "Policy shaped effort",
          text:
            "The United States did not simply reward effort after the fact. It also structured opportunity in advance through public systems that were not equally accessible to everyone.",
          context: "Use when policy history is dismissed as irrelevant to success.",
        },
        {
          title: "Merit needs institutions",
          text:
            "Merit can be real and still depend on institutions that turn work into assets, education, and stability. If those institutions were unequal, a merit-only story is too thin.",
          context: "Use when the debate jumps from individual discipline to group-level conclusions.",
        },
      ],
    },
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
          "The Black-impact issue is straightforward: if public ladders into land, housing, labor protection, and education were unequally distributed, then Black communities were asked to compete under the rhetoric of self-reliance while facing documented barriers to the supports that made self-reliance more feasible for others.",
      },
      {
        title: "What implementation evidence already shows",
        body:
          "The implementation record cuts against the myth of purely private mobility. Public land records, mortgage programs, labor statutes, and education funding show that government structured opportunity before individual effort was rewarded. The United States did not simply reward effort after the fact. It structured opportunity in advance.",
      },
      {
        title: "What this evidence can support",
        body:
          "The evidence supports a strong historical claim that mobility in the United States has depended partly on public scaffolding. It also supports the narrower claim that Black Americans faced documented barriers to that scaffolding, which makes later merit-only narratives incomplete.",
      },
      {
        title: "What this evidence cannot prove on its own",
        body:
          "This evidence does not show that personal effort is irrelevant or that policy alone determines individual outcomes. To prove an individual outcome claim, the evidence would need person-level records. The stronger point is institutional: effort operates inside systems, and those systems have not distributed opportunity neutrally.",
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
          "The Black-impact channels here are unusually concrete. The GI Bill's biggest postwar wealth-building lanes were college access and homeownership. Black veterans faced documented constraints in both at the same time. In higher education, segregated southern institutions and constrained HBCU capacity meant a formally available education benefit did not translate into equal collegiate opportunity. In housing, GI Bill-backed loans still ran through lenders and local markets shaped by appraisal discrimination, redlining, and segregated suburban development.\n\nThat is why this topic belongs at the center of Black-opportunity analysis. The issue is not whether the GI Bill mattered. It mattered at national scale for education and homeownership. The issue is that access to one of the most powerful federal mobility programs in U.S. history was filtered through institutions that did not treat Black veterans equally.",
      },
      {
        title: "What implementation evidence already shows",
        body:
          "The implementation story matters more than the statutory text alone. The National Archives record shows what the law promised. VA history shows how the education and loan-guaranty systems were administered. Education studies show how segregated admissions and HBCU capacity shaped access. Housing records show that loan guarantees still depended on lenders and local markets. The education benefit depended on actual admission opportunities, and the housing benefit depended on actual access to mortgage credit and neighborhoods where Black veterans could buy.\n\nThat makes the GI Bill a strong example of a broader EquityStack rule: a formally universal federal benefit can still produce unequal outcomes when local gatekeepers and surrounding institutions remain discriminatory.",
      },
      {
        title: "What this evidence can support",
        body:
          "The evidence supports a strong claim that the GI Bill helped expand postwar opportunity overall while delivering unequal access to Black veterans in practice. It also supports a narrower causal channel: unequal access to higher education and mortgage-backed homeownership contributed to long-run Black-white gaps in wealth and opportunity.\n\nThis is especially defensible when the claim is tied to region, institution type, and benefit channel rather than stated as an undifferentiated national average.",
      },
      {
        title: "What this evidence cannot prove on its own",
        body:
          "This evidence does not mean every Black veteran was excluded from GI Bill benefits, nor does it mean the program's effects were identical across all states and communities. Documented Black veteran benefit use did occur, and outcomes varied by geography.\n\nThe stronger position separates existence from scale and impact: Black participation existed, but implementation produced unequal access, especially where segregated colleges, constrained HBCU capacity, and discriminatory housing markets limited the program's practical reach.",
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
        "Crime alone cannot explain the scale of incarceration growth documented in correctional population data and sentencing policy records.",
        "Federal and state design choices shaped both entry into the system and time spent inside it.",
        "Black communities absorbed cumulative effects that extended beyond the people formally sentenced.",
        "Later reform efforts matter partly because they show the system was policy-made and therefore changeable.",
      ],
      bottomLine:
        "Mass incarceration is not just a neutral readout of crime. It is a policy-built system shaped by law, enforcement, and institutional design.",
      responseScript:
        "That argument leaves out the policy record. Crime levels matter, but incarceration growth was also driven by sentencing law, drug policy, enforcement choices, parole rules, and prison expansion.",
      responseContext:
        "Use when someone treats prison growth as a simple mirror of crime.",
    },
    questions: [
      "Which laws and enforcement choices drove incarceration growth?",
      "How did incarceration patterns relate to presidential agendas and justice policy?",
      "Where do later reforms fit inside the larger incarceration story?",
    ],
    argumentMode: {
      summary:
        "No. Mass incarceration was not just crime showing up in prison counts. Law, policing strategy, sentencing rules, and prison expansion built the scale of the system, even though local trends still need local evidence.",
      quickResponse:
        "Mass incarceration was built through policy, not just crime. Drug laws, sentencing rules, policing strategy, and prison expansion changed who got pulled in and how long they stayed.",
      discussionResponse:
        "Crime trends matter, but they do not explain the full scale of the prison boom. The historical record points to legal and institutional choices such as harsher drug laws, mandatory minimums, parole rules, and prison expansion. That supports a structural argument about how the system grew while leaving local spikes to be tested with local evidence.",
      debateResponse:
        "Claim: Prison growth was just crime translated into incarceration.\n\nEvidence: Lawmakers and agencies changed sentencing, drug policy, release rules, and prison capacity, which affected both entry into the system and time spent inside it.\n\nLimit: That does not mean every jurisdiction moved for the same reason or that federal policy alone explains every local pattern.",
      keyPoints: [
        "Crime did not write mandatory minimums, parole rules, or prison budgets.",
        "Policy decided who got swept in and how long they stayed.",
        "The burden landed far beyond prison walls, especially in Black communities.",
        "Later reforms are evidence that the system was built, not natural.",
        "National records are strongest on the architecture of the prison boom.",
        "What they cannot do alone is explain every local rise in incarceration.",
      ],
      commonClaims: [
        {
          claim:
            "Mass incarceration just reflects high crime, so policy is secondary.",
          response:
            "That leaves out the legal and institutional choices that determined who got charged, what penalties applied, how much leverage prosecutors had, and how long people remained under punishment.",
          question:
            "What evidence shows crime alone explains sentence length, charging leverage, parole rules, and prison-capacity expansion?",
        },
        {
          claim:
            "If the laws were race-neutral on paper, the incarceration system was race-neutral.",
          response:
            "Race-neutral wording does not settle how policy worked in practice. Enforcement concentration, charging choices, sentencing structures, and access to relief all affect who bears the burden.",
          question:
            "What evidence shows neutral bill text produced neutral exposure across policing, sentencing, and supervision outcomes?",
        },
        {
          claim:
            "Later reforms prove the earlier system was not a real policy problem.",
          response:
            "Later reforms point the other way. They matter because lawmakers changed sentencing rules and release structures after years of criticism, which shows the earlier system was built through policy choices rather than nature.",
          question:
            "If the system was just a passive crime response, why were sentence laws and release rules later revised?",
        },
        {
          claim:
            "Talking about racial impact means claiming every official acted with racist intent.",
          response:
            "The stronger argument does not require reading every actor's mind. It is enough to show that policy design and enforcement architecture produced a documented unequal burden.",
          question:
            "Why treat impact evidence as invalid unless it also proves every participant's personal intent?",
        },
      ],
      debateLines: [
        "Crime rose; policy chose the punishment.",
        "Prison growth was written into law.",
        "The damage did not stop at the cell door.",
        "If the system were automatic, it would not need reform.",
        "This argument is about architecture, not excuses.",
      ],
      shareCards: [
        {
          title: "Crime did not build this alone",
          text:
            "Mandatory minimums, drug laws, policing strategy, parole rules, and prison expansion did not happen by accident. The prison boom was built.",
          context: "Use when prison growth is treated like an automatic social fact.",
        },
        {
          title: "Beyond the cell",
          text:
            "Mass incarceration hit families, earnings, schools, and civic life, not just the people who got sentenced.",
          context: "Use when the debate narrows harm to the people formally incarcerated.",
        },
        {
          title: "Reform is part of the evidence",
          text:
            "When lawmakers later changed the rules, they showed the old system was a choice, not a law of nature.",
          context: "Use when someone argues the incarceration system was simply unavoidable.",
        },
      ],
    },
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
          "The Black-impact channel is direct and cumulative. Correctional population data, sentencing records, and supervision records show that mass incarceration concentrated surveillance, imprisonment, and supervision in many Black communities, with spillover effects on family structure, earnings, schooling, health, and civic life. The impact was not confined to the people formally sentenced.",
      },
      {
        title: "What implementation evidence already shows",
        body:
          "The implementation record points to policy design: harsher drug laws, mandatory minimums, expanded prison capacity, aggressive enforcement, parole and supervision rules, and plea-driven case processing. Those choices changed who entered the system, how long they stayed, and how deeply communities were exposed to punishment.",
      },
      {
        title: "What this evidence can support",
        body:
          "The evidence supports the claim that crime alone cannot explain the scale of U.S. incarceration growth. It also supports the narrower claim that federal and state policy choices helped create a criminal-justice system that imposed especially heavy burdens on Black communities.",
      },
      {
        title: "What this evidence cannot prove on its own",
        body:
          "This evidence does not prove that every prison increase in every jurisdiction had the same cause or that all incarceration trends were federally driven. To prove a jurisdiction-specific claim, the evidence would need local crime trends, sentencing rules, admissions, release practices, and demographic records. The stronger historical claim is about broad policy architecture, not total uniformity across time and place.",
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
        "Corporate and capital-income provisions can shift the largest dollar gains upward even when lower- or middle-income households also receive tax relief.",
        "The real policy question is not whether any tax was cut. It is who benefited most and what public capacity changed in return.",
      ],
      bottomLine:
        "Tax cuts are not automatically broad-based relief. Their impact depends on who receives the benefits and what gets cut or underfunded afterward.",
      responseScript:
        "Tax cuts do not help everyone equally. The real question is who gets the largest dollar and percentage benefits, what official distribution tables show across income groups, and what public capacity changes afterward.",
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
          "The Black-impact question here is partly about household tax relief and partly about public capacity. If a tax package mainly rewards households that already hold more wealth or capital income, while public revenue falls, then Black communities can face a weak direct gain and a stronger indirect loss through underfunded services or reduced investment.",
      },
      {
        title: "What implementation evidence already shows",
        body:
          "The implementation record on tax cuts is not only the campaign slogan. Official legislative summaries, Joint Committee on Taxation distribution tables, and CBO or JCT budget estimates show that tax packages are made of many moving parts: individual rates, deductions, credits, corporate changes, pass-through rules, and estate or capital-income treatment. That is why headline language about everyone getting relief is too blunt for the actual policy record.",
      },
      {
        title: "What this evidence can support",
        body:
          "The evidence supports a strong claim that tax cuts have to be evaluated distributionally, not rhetorically. It also supports the narrower claim that budget effects and public-service tradeoffs matter when deciding whether a policy helped working-class families and Black communities in practice.",
      },
      {
        title: "What this evidence cannot prove on its own",
        body:
          "This evidence does not prove that every tax cut is regressive or that every lower-income household loses under every reform package. To prove the impact of a specific package, readers need distribution tables, tax-unit estimates, revenue estimates, and evidence about later spending choices. The stronger point is about method: ask how the benefits are distributed, which provisions are temporary or permanent, and how revenue losses interact with public choices.",
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
        "That claim overstates what the study shows. It relies on a proxy for DEI rather than direct policy measurement, and it does not isolate causation, measure hiring standards, or prove that minority managers were less qualified.",
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
        "The study can justify a methodology question, but it does not justify a sweeping anti-DEI conclusion because the proxy does not directly measure DEI policy, hiring quality, or causation.",
      keyPoints: [
        "The study uses a proxy rather than direct DEI-policy measurement.",
        "The proxy does not directly measure whether a specific firm adopted a specific DEI policy.",
        "The model does not isolate causation from correlation or reverse causality.",
        "Alternative explanations such as sector shifts, labor-market disruptions, and post-2016 economic shocks are not fully ruled out.",
        "The evidence does not directly measure hiring standards, promotion quality, or whether minority managers were less qualified.",
        "The broader research literature on diversity and performance is mixed rather than one-directional.",
      ],
      commonClaims: [
        {
          claim:
            "The White House study proves DEI lowers productivity.",
          response:
            "It reports a relationship built around a contested proxy. That is not the same as directly measuring DEI policies, comparing otherwise similar firms, and proving those policies caused lower productivity.",
          question:
            "Where does the study directly measure DEI policy, and how does it rule out other causes?",
        },
        {
          claim:
            "The study proves diversity hires are less qualified.",
          response:
            "The study does not directly observe hiring quality, promotion standards, individual qualifications, or job performance. That conclusion goes beyond the evidence.",
          question:
            "What part of the study measures individual qualifications?",
        },
        {
          claim:
            "Rising minority representation is itself evidence that merit standards were lowered.",
          response:
            "That conclusion is not measured by the study. A change in representation can reflect reduced barriers, different labor supply, promotion patterns, or other firm changes. The paper does not directly test whether standards declined.",
          question:
            "What direct evidence shows lower standards rather than changing access or changing labor-market composition?",
        },
        {
          claim:
            "The economics of DEI are now settled by this paper.",
          response:
            "One proxy-based paper does not settle a larger research question, especially when the wider literature is mixed and the design does not directly measure the underlying policy variable.",
          question:
            "What is the full research base, and how many studies directly identify DEI policy effects rather than using indirect proxies?",
        },
      ],
      debateLines: [
        "A proxy is not the same thing as a direct measure.",
        "The study can support a question, but not every headline conclusion attached to it.",
        "Before making a causal claim, ask what other economic changes the model rules out and what outcome it directly measures.",
        "The paper does not directly measure individual qualifications, so it cannot prove diversity hires were less qualified.",
        "A methodology warning is not the same thing as proof that DEI lowers productivity.",
      ],
      shareCards: [
        {
          title: "Proxy problem",
          text:
            "The DEI study relies on a proxy for DEI activity. A proxy can be useful, but it is not direct proof that specific DEI policies caused lower productivity.",
          context: "Use when the study is treated as settled causal proof.",
        },
        {
          title: "What it does not measure",
          text:
            "The study does not directly observe hiring quality, promotion standards, or whether minority managers were less qualified. That conclusion goes beyond the evidence.",
          context: "Use when the paper is turned into an argument about merit or qualifications.",
        },
        {
          title: "Use the bounded conclusion",
          text:
            "The safer conclusion is that the study raises a methodology question about one proxy-based model. It does not settle the economics of DEI or prove that diversity itself lowers productivity.",
          context: "Use when a single paper is being used to close the debate.",
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
          "A stronger causal claim would require direct measurement of DEI policies rather than a demographic proxy. It would also require controlled comparisons across similar firms, industries, and regions, so that the analysis can separate DEI activity from unrelated economic changes.\n\nThe evidence would need to isolate external shocks, account for workforce composition and labor-market changes, measure hiring or promotion standards directly where qualification claims are made, and show that productivity changes follow from DEI policy itself rather than from correlation or selection. The study does not meet these standards.",
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
        "The research base still finds measurable hiring discrimination, and the official record shows the rollback changed enforcement, contractor-compliance, and civil-rights support structures.",
      dataShows: [
        "Modern hiring-discrimination studies still support a bounded claim that unequal treatment remains measurable in the labor market.",
        "The rollback produced documented implementation steps, including office closures, contractor changes, enforcement pauses, and grant cancellations.",
        "The current evidence supports a risk argument about weaker oversight and protection, not a final quantified harm estimate.",
        "Stronger downstream harm claims would require additional outcome evidence over time.",
      ],
      bottomLine:
        "The rollback did not enter a solved labor market. It reduced or changed institutions that were built to monitor and address an already documented problem.",
      responseScript:
        "That argument assumes the barrier is gone. Audit and correspondence studies show hiring discrimination is still measurable, and the rollback changed enforcement and oversight structures even if final outcome estimates are still developing.",
      responseContext:
        "Use when rollback policy is framed as harmless cleanup.",
    },
    questions: [
      "What does modern hiring-discrimination research show about Black applicants' treatment in the labor market?",
      "What can that research support when evaluating anti-DEI rollback policy?",
      "What additional evidence would be needed to move from baseline discrimination findings to a strong Trump-policy impact claim?",
    ],
    argumentMode: {
      summary:
        "The strongest answer is narrower than a slogan from either side: measurable hiring discrimination still exists, and the rollback changed enforcement and support structures built to address it. What is not yet proven is a final quantified national harm estimate from the rollback itself.",
      keyPoints: [
        "Modern audit and correspondence studies still find measurable hiring discrimination against Black applicants.",
        "That baseline matters because the rollback did not enter a labor market where the underlying problem was clearly solved.",
        "Primary government records show real implementation changes: office closures, contractor-rule changes, enforcement pauses, and grant cancellations.",
        "Those implementation steps support a risk argument about weaker oversight and protection, even before a final national harm estimate is available.",
        "Baseline discrimination evidence does not automatically prove one specific downstream outcome from one administration's policy.",
        "The stronger case links three layers: the baseline problem, the institutional rollback, and later outcome evidence.",
      ],
      commonClaims: [
        {
          claim:
            "Discrimination is basically solved, so anti-DEI rollback policy only removes unnecessary bureaucracy.",
          response:
            "That assumes the underlying barrier disappeared. Modern hiring-discrimination studies still find measurable unequal treatment, and the rollback changed institutions that were built to monitor and address that problem.",
          question:
            "What evidence shows the labor-market barrier is gone rather than still measurable?",
        },
        {
          claim:
            "Anti-DEI rollbacks did not do anything real because anti-discrimination law still exists.",
          response:
            "A formal legal ban is not the same thing as enforcement capacity. The record shows office closures, halted contractor enforcement, rescinded guidance, and cut support structures. Those are concrete institutional changes.",
          question:
            "What enforcement pathway, oversight capacity, or support structure remained unchanged after the rollback?",
        },
        {
          claim:
            "Without a final post-rollback harm estimate, criticism of the rollback is just speculation.",
          response:
            "The current evidence already supports a narrower claim: the rollback weakened or changed institutions addressing a documented problem. A final national estimate would strengthen the case, but it is not required to show that the policy altered real enforcement and support structures.",
          question:
            "What institutional changes occurred, and what later outcome evidence would you require before calling the risk real?",
        },
        {
          claim:
            "Hiring discrimination studies cannot tell you anything useful about policy.",
          response:
            "They cannot by themselves prove the full effect of one administration's policy, but they do establish the baseline condition the policy is operating on. That matters when evaluating whether oversight and remediation structures were still needed.",
          question:
            "If the baseline problem is measurable, why would weakening the institutions that address it be irrelevant?",
        },
      ],
      debateLines: [
        "The rollback did not enter a solved labor market.",
        "Formal law remaining on the books is not the same as keeping enforcement capacity intact.",
        "Baseline discrimination evidence and policy-impact evidence are different, but both matter.",
        "The current record supports a risk argument now, even if a full quantified harm estimate takes longer.",
        "The serious question is whether weakening oversight makes sense when the underlying disparity is still measurable.",
      ],
      shareCards: [
        {
          title: "Not a solved problem",
          text:
            "Modern hiring-discrimination studies still find measurable unequal treatment, so the rollback did not enter a labor market where the underlying barrier was clearly gone.",
          context: "Use when anti-DEI policy is framed as cleanup after a solved problem.",
        },
        {
          title: "Institutions changed",
          text:
            "The rollback was not just rhetoric. The record shows enforcement pauses, contractor-rule changes, office closures, and support cuts. That is real institutional change even before a final national harm estimate is available.",
          context: "Use when someone says nothing concrete happened.",
        },
        {
          title: "Use the bounded claim",
          text:
            "The strongest current claim is not that every downstream harm is already quantified. It is that the rollback weakened institutions addressing a documented labor-market problem.",
          context: "Use when the debate jumps from incomplete outcome data to total dismissal.",
        },
      ],
    },
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
          "The studies cited here support a bounded but important claim: racial discrimination in hiring remains measurable in the modern U.S. labor market, including among large employers. That means anti-DEI rollback policy is not entering a world where the underlying barrier has clearly disappeared.\n\nThis is enough to support a risk argument. If institutions built to surface, monitor, or mitigate unequal treatment are weakened, Black applicants may face greater exposure to an already documented problem. It is not yet a quantified national harm estimate.",
      },
      {
        title: "What this evidence cannot prove on its own",
        body:
          "These studies do not, by themselves, prove that the Trump administration's January 20, 2025 anti-DEI order caused a quantifiable decline in Black employment, wages, or callback rates. They are baseline labor-market evidence, not a direct before-and-after causal evaluation of one administration's policy.\n\nA stronger claim would require policy-specific evidence such as agency implementation records, employer compliance changes, reduced access to remedies, contracting shifts, grant terminations, or measurable labor-market outcomes after the rollback.",
      },
      {
        title: "Why discretion matters",
        body:
          "One of the most policy-relevant themes in this literature is that discrimination can widen where hiring decisions are more subjective. If employers rely heavily on informal judgment, unstructured screening, or ambiguous criteria, unequal treatment can persist even when formal discrimination is unlawful.\n\nThat matters for DEI debates because equity-focused interventions can add structure, review, documentation, and accountability precisely where discretion is hardest to monitor.",
      },
      {
        title: "What stronger policy-impact evidence would look like",
        body:
          "To move from a plausible risk argument to a stronger claim about the Trump DEI rollback, the evidence base would need to connect the order to measurable downstream effects on Black workers, students, contractors, or communities. Some of the implementation evidence is now visible: agency shutdowns, staffing cuts, rescinded guidance, grant cancellations, contractor-rule changes, and new complaint or enforcement channels.\n\nThe remaining step is outcome evidence. That means showing whether these institutional changes altered access to remedies, oversight capacity, employer behavior, contracting opportunity, school support, or employment outcomes in ways that can be measured over time.",
      },
    ],
  },
  "welfare-dependency-claims": {
    explainer_type: "misused_claim",
    category: "misused-statistics",
    tags: ["welfare", "poverty", "economics", "policy", "public-benefits"],
    relatedExplainers: ["government-benefits-racial-gap", "bootstraps-vs-policy-reality"],
    lens: "Public benefits claim guide",
    pagePurpose:
      "Use this page when welfare statistics are being used to claim that benefit receipt proves dependency, irresponsibility, or unwillingness to work.",
    whyThisMatters:
      "Public-benefit claims are often argued as if SNAP, TANF, SSI, and refundable tax credits all measure the same behavior. They do not. This page separates program eligibility, duration, work status, disability, family need, and poverty measurement.",
    questions: [
      "Which program is being discussed, and what does eligibility require?",
      "Does the claim distinguish temporary assistance from long-term receipt?",
      "Does the statistic measure dependency, income, disability, unemployment, or household need?",
    ],
    sourceContexts: [
      {
        title: "Characteristics of SNAP Households: Fiscal Year 2023",
        sourceType: "government",
        sourceNote:
          "USDA participant characteristics source; useful for distinguishing household composition from claims about behavior.",
      },
      {
        title: "Work Requirements: The Temporary Assistance for Needy Families (TANF) Work Standard and How States Met It",
        sourceType: "government",
        sourceNote:
          "CRS source explaining TANF work standards, state performance rules, and the decline in cash-assistance caseloads.",
      },
      {
        title: "SSI Annual Statistical Report, 2023",
        sourceType: "primary-data",
        sourceNote:
          "SSA program statistics; useful because SSI is tied to age, blindness, or disability rather than general unemployment.",
      },
      {
        title: "EITC reports and statistics",
        sourceType: "primary-data",
        sourceNote:
          "IRS statistics on a work-linked refundable tax credit, which complicates claims that public assistance equals nonwork.",
      },
      {
        title: "Poverty in the United States: 2023",
        sourceType: "government",
        sourceNote:
          "Census poverty source showing how official and supplemental poverty measures treat income, taxes, and benefits.",
      },
    ],
    argumentMode: {
      summary:
        "Welfare-dependency claims usually combine different programs into one moral conclusion. The data instead measure eligibility, income, disability, family composition, work-linked tax credits, and program duration.",
      keyPoints: [
        "SNAP, TANF, SSI, and EITC measure different eligibility rules and populations.",
        "Benefit receipt does not by itself identify unwillingness to work or long-term dependency.",
        "SNAP data include many households with children, older adults, or people with disabilities.",
        "TANF is time-limited cash assistance with state-administered work standards, not a general lifetime income guarantee.",
        "SSI is primarily an aged, blind, or disabled program, so it should not be treated as ordinary unemployment support.",
        "EITC requires earned income, which means a major anti-poverty benefit is explicitly connected to work.",
        "A stronger claim would need program-specific duration, work status, eligibility, and household composition data.",
      ],
      commonClaims: [
        {
          claim: "Welfare proves people do not want to work.",
          response:
            "That conclusion does not follow from benefit receipt. The data first have to identify the program, eligibility rule, duration, household composition, disability status, and whether the household has earnings.",
          question:
            "Which program are you talking about, and does its data measure work refusal or only eligibility and need?",
        },
        {
          claim: "People stay on welfare for generations.",
          response:
            "A generational claim requires longitudinal household evidence. Cross-sectional participation counts show who received benefits at a point in time; they do not prove a family remained dependent across generations.",
          question:
            "What longitudinal data shows the same families receiving the same program across generations?",
        },
        {
          claim: "All welfare is cash people can live on indefinitely.",
          response:
            "That mixes unlike programs. SNAP is food assistance, TANF is limited cash assistance run by states, SSI is tied to age or disability, and EITC is a tax credit for workers with earned income.",
          question:
            "Are you describing SNAP, TANF, SSI, EITC, or another program?",
        },
        {
          claim: "Welfare numbers prove bad choices are the cause of poverty.",
          response:
            "Program counts show need and eligibility. They do not isolate cause. To prove a behavioral cause, evidence would need to separate wages, job access, disability, caregiving, housing costs, family size, and local labor markets.",
          question:
            "What evidence separates behavior from wages, disability, caregiving, housing costs, and local job access?",
        },
        {
          claim: "Public benefits only go to people who contribute nothing.",
          response:
            "That is contradicted by work-linked benefits such as EITC and by households that combine low wages with food or medical assistance. Contribution and eligibility are separate questions.",
          question:
            "Does the dataset show no work, or does it include workers whose earnings are low enough to qualify?",
        },
      ],
      debateLines: [
        "Benefit receipt measures eligibility and need; it does not automatically measure dependency.",
        "SNAP, TANF, SSI, and EITC are different programs with different rules.",
        "A work-linked tax credit cannot be evidence that all assistance rewards nonwork.",
        "To prove dependency, you need duration and work-status data, not a single participation count.",
        "The first question is always: which program and which population?",
      ],
      shareCards: [
        {
          title: "Name the program",
          text:
            "Welfare is not one dataset. SNAP, TANF, SSI, and EITC have different eligibility rules and measure different things. A claim about dependency has to identify the program first.",
          context: "Use when a debate treats all public benefits as the same.",
        },
        {
          title: "Eligibility is not behavior",
          text:
            "A benefit record shows eligibility and need. It does not automatically show unwillingness to work, long-term dependency, or the reason a household is poor.",
          context: "Use when a participation statistic is turned into a moral claim.",
        },
        {
          title: "Duration matters",
          text:
            "A point-in-time welfare count cannot prove lifetime or generational dependency. That claim requires longitudinal data showing who received what benefit and for how long.",
          context: "Use when someone makes a permanent-dependency claim from a single statistic.",
        },
        {
          title: "Work is in the data",
          text:
            "Some major benefits are tied to work or coexist with low wages. EITC requires earned income, and many households use assistance because wages, disability, caregiving, or costs do not line up with need.",
          context: "Use when assistance is framed as proof of nonwork.",
        },
      ],
    },
    structuredSections: [
      {
        title: "Historical framing",
        body:
          "Public-benefit dependency claims draw on decades of debate over anti-poverty programs, work incentives, and government budgets. The modern benefit system is not a single program: SNAP, TANF, SSI, the EITC, housing support, Medicaid, and child-related credits use different eligibility rules, work links, time limits, disability criteria, and income tests.",
      },
      {
        title: "Claim or misconception",
        body:
          "Common claim: welfare statistics prove that Black Americans or low-income households are trapped in dependency because they do not want to work.\n\nThat conclusion does not follow from participation data. Benefit receipt can show eligibility, income level, household composition, disability status, caregiving need, or work-linked low earnings. It does not by itself identify motivation, causation, or long-term dependence.",
      },
      {
        title: "What the data actually measures",
        body:
          "Public-benefit data are program-specific. SNAP measures food-assistance participation among eligible households. TANF measures state-administered cash assistance for needy families with children under federal and state rules. SSI measures support for aged, blind, or disabled people with limited income and resources. EITC measures a refundable tax credit for workers with earned income.\n\nA responsible interpretation has to name the program, the eligibility rule, the time period, and the household population before drawing a conclusion.",
      },
      {
        title: "Where the claim goes wrong",
        body:
          "The mistake is treating unlike programs as one behavioral signal. A SNAP household with children, an SSI recipient with a disability, a TANF family under state rules, and a worker receiving EITC are not measuring the same condition.\n\nThe dependency claim also confuses receipt with cause. A household may qualify because of low wages, unstable hours, disability, age, caregiving, medical costs, local job availability, or temporary hardship. The data have to distinguish those mechanisms before assigning one cause.",
      },
      {
        title: "What the data does not prove",
        body:
          "Benefit data do not prove unwillingness to work. They do not prove that poverty is caused by program receipt. They do not prove that assistance is permanent. They do not prove that all recipients receive cash. They do not prove that households have no earnings.\n\nTo prove a stronger dependency claim, evidence would need to show duration, repeat receipt, work status, earnings, disability, family composition, and local labor-market conditions for the same households over time.",
      },
      {
        title: "Scale vs interpretation",
        body:
          "Program scale matters, but scale is not interpretation. A large SNAP caseload may show food insecurity or low income across millions of households. It does not show why each household qualifies. TANF caseloads are far smaller than SNAP and have changed dramatically since welfare reform. SSI is not a general poverty program; it is tied to age, blindness, or disability.\n\nThe correct scale question is not only how many people receive assistance. It is what kind of assistance, for how long, under what eligibility rule, and with what household resources.",
      },
      {
        title: "Stronger way to analyze the issue",
        body:
          "A stronger analysis separates income support from food assistance, disability support, and work-linked tax credits. It then asks whether a program reduces hardship, supports work, reaches eligible people, or creates administrative barriers.\n\nPolicy debates can still ask serious questions about incentives, fraud control, benefit cliffs, work supports, and program design. But those questions require program-specific evidence, not a single slogan about dependency.",
      },
      {
        title: "EquityStack takeaway",
        body:
          "The evidence-first frame is simple: public-benefit data measure eligibility and participation before they measure behavior. Misusing welfare statistics matters because it turns poverty measurement into a group-level character claim.\n\nThe defensible move is to identify the program, the population, the time frame, and the evidence needed to prove the stronger claim.",
      },
      {
        title: "How to respond in a debate",
        body:
          "Common claim: Welfare proves people do not want to work.\n\nBetter response: Benefit receipt does not measure motivation. SNAP, TANF, SSI, and EITC each measure different eligibility rules. To make a dependency claim, you need program-specific data on duration, work status, disability, earnings, and household composition.\n\nKey question: Which program are you talking about, and what evidence shows dependency rather than eligibility or need?\n\nCommon claim: Welfare is just free cash forever.\n\nBetter response: That mixes unlike programs. SNAP is food assistance, TANF is limited cash assistance, SSI is tied to age or disability, and EITC requires earned income.\n\nKey question: Does your evidence identify cash assistance, food assistance, disability support, or a work-linked tax credit?",
      },
    ],
  },
  "family-structure-and-poverty-claims": {
    explainer_type: "misused_claim",
    category: "misused-statistics",
    tags: ["poverty", "family-structure", "economics", "race", "mobility"],
    relatedExplainers: ["government-benefits-racial-gap", "redlining-black-homeownership"],
    lens: "Family structure and causation guide",
    pagePurpose:
      "Use this page when single-parent household statistics are being used to claim that family structure alone explains poverty or racial inequality.",
    whyThisMatters:
      "Family structure matters in poverty data, but it is not a self-contained causal explanation. This explainer separates correlation, household resources, neighborhood context, labor markets, and policy history.",
    questions: [
      "Is the claim describing correlation or proving causation?",
      "Does the evidence account for income, wealth, neighborhood, schools, and labor markets?",
      "What would be required to show that family structure is the independent cause?",
    ],
    sourceContexts: [
      {
        title: "Poverty in the United States: 2023",
        sourceType: "government",
        sourceNote:
          "Census poverty report for household and poverty measurement context.",
      },
      {
        title: "Race and Economic Opportunity in the United States: An Intergenerational Perspective",
        sourceType: "academic",
        sourceNote:
          "Longitudinal mobility research useful for separating family variables from neighborhood and income context.",
      },
      {
        title: "The Impacts of Neighborhoods on Intergenerational Mobility I: Childhood Exposure Effects",
        sourceType: "academic",
        sourceNote:
          "Research on childhood exposure to neighborhoods and later-life outcomes.",
      },
      {
        title: "The Impacts of Neighborhoods on Intergenerational Mobility II: County-Level Estimates",
        sourceType: "academic",
        sourceNote:
          "County-level estimates showing how local opportunity conditions shape mobility.",
      },
      {
        title: "Changing family structures play a major role in the fight against poverty",
        sourceType: "secondary-analysis",
        sourceNote:
          "Policy discussion that treats family stability as relevant while still requiring broader opportunity context.",
      },
    ],
    argumentMode: {
      summary:
        "Family-structure statistics can show correlation with poverty, but they do not prove that family structure alone causes poverty or racial inequality. A causal claim has to account for income, wealth, neighborhood, schools, labor markets, and prior policy conditions.",
      keyPoints: [
        "Single-parent household data describe household composition, not a complete causal model.",
        "Poverty risk can differ by family structure because households differ in earners, caregiving time, and resources.",
        "Correlation does not prove that family structure is the independent cause of poverty.",
        "Neighborhood exposure, school quality, labor markets, wealth, and policy history also shape outcomes.",
        "A stronger claim would need longitudinal evidence separating family structure from prior poverty and local opportunity conditions.",
        "Family stability can matter without turning poverty into a one-variable blame claim.",
      ],
      commonClaims: [
        {
          claim: "Single-parent households are the reason Black poverty exists.",
          response:
            "Single-parent household rates are correlated with poverty risk, but that does not prove they are the sole or independent cause. A causal claim has to account for wages, wealth, neighborhoods, schools, incarceration, health, and prior economic conditions.",
          question:
            "What evidence separates family structure from income, wealth, neighborhood exposure, and labor-market conditions?",
        },
        {
          claim: "If people got married, poverty would be solved.",
          response:
            "Marriage can change household resources, but it does not automatically create stable jobs, assets, safe housing, good schools, or health coverage. The evidence has to show what changes in resources and conditions, not just marital status.",
          question:
            "Does the evidence show a change in household resources, or only a different household label?",
        },
        {
          claim: "Family structure proves culture causes poverty.",
          response:
            "That claim turns a demographic pattern into a cultural cause without proving the mechanism. The same data can reflect economic instability, policy history, housing costs, male employment, incarceration, and neighborhood conditions.",
          question:
            "What mechanism is being tested, and what evidence rules out economic and policy explanations?",
        },
        {
          claim: "Structural explanations ignore personal responsibility.",
          response:
            "A structural explanation does not deny individual choices. It asks what conditions shape the choices available, the risks households face, and the resources families can use.",
          question:
            "What conditions would make stable family formation easier or harder at population scale?",
        },
      ],
      debateLines: [
        "Family structure can matter without being the only cause.",
        "Household composition is a variable, not a complete explanation.",
        "Correlation with poverty is not proof of independent causation.",
        "A serious claim has to account for income, wealth, place, schools, and labor markets.",
        "The policy question is what conditions make family stability more possible.",
      ],
      shareCards: [
        {
          title: "Correlation is not causation",
          text:
            "Single-parent household data can show a poverty correlation. It does not prove family structure alone causes poverty or racial inequality without accounting for resources, neighborhoods, labor markets, and policy history.",
          context: "Use when household statistics are treated as a complete explanation.",
        },
        {
          title: "Resources matter",
          text:
            "Marriage can change household resources, but the evidence still has to identify wages, assets, childcare, housing, schools, and job access. A household label is not the same thing as a causal proof.",
          context: "Use when marriage is offered as a one-step poverty solution.",
        },
        {
          title: "Ask for the mechanism",
          text:
            "If someone claims family structure causes poverty, ask what mechanism is being tested and what evidence separates it from prior poverty, wealth gaps, neighborhood exposure, and labor-market conditions.",
          context: "Use when a demographic pattern is turned into a cultural claim.",
        },
      ],
    },
    structuredSections: [
      {
        title: "Historical framing",
        body:
          "Claims about family structure and poverty have appeared in policy debates for decades, especially when household composition is used as a stand-in explanation for income, child outcomes, and racial inequality. The recurring evidence problem is that household data can show important associations without proving a complete causal mechanism.",
      },
      {
        title: "Claim or misconception",
        body:
          "Common claim: Black poverty is mainly caused by single-parent households, so structural explanations are unnecessary.\n\nThat conclusion overstates what household data can prove. Family structure can be relevant to poverty risk, but the existence of a correlation does not establish that family structure alone caused the poverty pattern or that policy, labor-market, wealth, school, and neighborhood conditions do not matter.",
      },
      {
        title: "What the data actually measures",
        body:
          "Family-structure data measure household composition: married couples, cohabiting adults, single parents, children, and related household arrangements. Poverty data measure income relative to a threshold, and supplemental poverty data account for taxes, transfers, medical costs, work expenses, and geography.\n\nThose datasets can show that households with one adult often have fewer earners and more caregiving constraints. They do not automatically show why the household formed, what resources it had before, or what external conditions shaped its options.",
      },
      {
        title: "Where the claim goes wrong",
        body:
          "The claim goes wrong when it treats a correlated condition as a complete cause. Family structure may affect household resources, but household resources are also shaped by wages, job availability, childcare, housing costs, wealth, health, incarceration, school quality, and neighborhood exposure.\n\nA causal claim has to establish direction. Poverty can contribute to family instability, family instability can deepen poverty risk, and both can be shaped by the same outside conditions.",
      },
      {
        title: "What the data does not prove",
        body:
          "The data do not prove that family structure is the sole cause of poverty. They do not prove that married households would have the same outcomes if income, wealth, schools, neighborhoods, and employment stayed unequal. They do not prove that culture is the cause.\n\nTo prove the stronger claim, evidence would need to compare similar households over time while accounting for prior income, wealth, local labor markets, neighborhood conditions, school quality, health, and policy exposure.",
      },
      {
        title: "Scale vs interpretation",
        body:
          "At population scale, family structure can be a meaningful predictor of poverty risk because household income is affected by the number of earners and caregiving responsibilities. But interpretation requires caution. A predictor is not automatically an independent cause.\n\nThe correct question is not whether family structure matters at all. It is how much it explains after accounting for other measurable factors and what policy conditions would improve family stability and child outcomes.",
      },
      {
        title: "Stronger way to analyze the issue",
        body:
          "A stronger analysis treats family stability as an outcome and a contributor, not as a single-cause explanation. It asks how employment, wages, housing, school quality, incarceration, healthcare, childcare, and wealth affect both poverty and household formation.\n\nThat framing allows serious discussion of parenting, father involvement, economic security, and child outcomes without turning poverty data into a one-variable blame claim.",
      },
      {
        title: "EquityStack takeaway",
        body:
          "Family-structure data can be relevant, but the misuse happens when the data are made to carry a causal conclusion they cannot support alone. Poverty and family stability interact with resources, place, labor markets, and policy history.\n\nThe evidence-first response is to ask whether the claim proves causation, measures scale, and accounts for the conditions that shape family formation in the first place.",
      },
      {
        title: "How to respond in a debate",
        body:
          "Common claim: Single-parent households explain Black poverty.\n\nBetter response: They are correlated with poverty risk, but that does not prove they are the sole cause. A causal claim has to account for wages, wealth, schools, neighborhoods, childcare, housing, and local job access.\n\nKey question: What evidence separates family structure from the economic and neighborhood conditions that shape it?\n\nCommon claim: Marriage would solve the problem.\n\nBetter response: Marriage can change household resources, but it does not automatically create income, assets, childcare, safe housing, or good schools. The evidence has to show the mechanism.\n\nKey question: What changes in resources and opportunity, beyond the household label?",
      },
    ],
  },
  "black-on-black-crime-claim": {
    explainer_type: "misused_claim",
    category: "misused-statistics",
    tags: ["crime", "framing", "victimization", "race", "public-safety"],
    relatedExplainers: ["crime-statistics-context-and-misuse", "understanding-13-50-crime-statistic"],
    lens: "Crime framing guide",
    pagePurpose:
      "Use this page when the phrase Black-on-Black crime is used to imply that intra-group crime is unique to Black communities or that victimization context should be dismissed.",
    whyThisMatters:
      "The phrase is a framing device more than a separate crime category. This explainer focuses on intra-group victimization patterns and avoids re-litigating arrest-statistic claims covered elsewhere.",
    questions: [
      "Does the claim compare intra-group crime patterns across groups?",
      "Does it distinguish victimization from offender statistics?",
      "Is the phrase being used to explain data or to redirect attention away from policy questions?",
    ],
    sourceContexts: [
      {
        title: "National Crime Victimization Survey",
        sourceType: "primary-data",
        sourceNote:
          "BJS victimization source that includes victim-offender relationship and offender characteristics for nonfatal crimes.",
      },
      {
        title: "Violent Victimization by Race or Ethnicity, 2005-2019",
        sourceType: "government",
        sourceNote:
          "BJS report for comparing victimization rates and patterns by race or ethnicity.",
      },
      {
        title: "Expanded Homicide Data",
        sourceType: "primary-data",
        sourceNote:
          "FBI supplementary homicide context for victim, offender, relationship, and circumstance fields, with reporting limits.",
      },
      {
        title: "About Community Violence",
        sourceType: "government",
        sourceNote:
          "CDC context on community violence, risk conditions, and prevention framing.",
      },
    ],
    argumentMode: {
      summary:
        "The phrase Black-on-Black crime singles out a pattern that is common across crime data: most crime occurs among people who live near one another and often within the same racial or ethnic group. The phrase usually adds framing, not a new measurement.",
      keyPoints: [
        "Most crime is local, and local social networks are often racially or ethnically patterned because neighborhoods are segregated.",
        "Intra-group crime is not unique to Black victims or offenders.",
        "Victimization data and homicide data answer different questions and have different reporting limits.",
        "The phrase can erase Black victims by using their victimization as a rhetorical weapon.",
        "A serious public-safety analysis asks where violence is concentrated, who is harmed, and what reduces harm.",
        "This explainer addresses framing, not the 13/50 arrest-statistic argument.",
      ],
      commonClaims: [
        {
          claim: "Why talk about anything else when Black-on-Black crime is the real problem?",
          response:
            "Intra-group crime is common across groups because crime is usually local and victim-offender networks are geographically patterned. The phrase does not explain causes or identify prevention policy by itself.",
          question:
            "Are you comparing intra-group crime across groups, or only naming it when the victims are Black?",
        },
        {
          claim: "Black-on-Black crime proves Black communities do not value Black lives.",
          response:
            "That is a moral claim, not a data conclusion. The data show victimization patterns; they do not prove what an entire community values, and they should not erase Black victims or prevention work.",
          question:
            "What evidence turns victimization data into a claim about what millions of people value?",
        },
        {
          claim: "Most Black victims are harmed by Black offenders, so race is the cause.",
          response:
            "Same-group victimization does not prove race is the cause. Crime is shaped by proximity, networks, segregation, age, conflict patterns, and local conditions.",
          question:
            "How does the evidence separate race from proximity, neighborhood segregation, and local risk conditions?",
        },
        {
          claim: "The phrase is just accurate data.",
          response:
            "It may describe an intra-group pattern, but the selective label matters. We do not usually say White-on-White crime even though same-group offending is also common among white victims.",
          question:
            "Why use a racialized label for one group but not the same framing for others?",
        },
      ],
      debateLines: [
        "Intra-group crime is common because crime is usually local.",
        "The phrase adds racial framing more than it adds measurement.",
        "Black victims should not be used as a reason to ignore prevention.",
        "Same-group victimization does not prove race is the cause.",
        "The policy question is what reduces harm in the places where victims are being harmed.",
      ],
      shareCards: [
        {
          title: "Most crime is local",
          text:
            "Intra-group crime is common because people are usually victimized by people in nearby social or geographic networks. That pattern is not unique to Black communities.",
          context: "Use when the phrase is presented as if it describes a unique racial phenomenon.",
        },
        {
          title: "Framing is not explanation",
          text:
            "The phrase Black-on-Black crime names a victim-offender pattern, but it does not explain causes, prove racial traits, or identify a prevention strategy.",
          context: "Use when a label is treated as an analysis.",
        },
        {
          title: "Victims should stay visible",
          text:
            "Using Black victimization as a talking point while ignoring prevention, clearance, trauma, and community safety erases the people most affected by the harm.",
          context: "Use when victim data are used only to redirect debate.",
        },
      ],
    },
    structuredSections: [
      {
        title: "Historical framing",
        body:
          "The phrase 'Black-on-Black crime' became a political and media framing device for discussing violence in Black communities. Crime data can describe victim-offender relationships and geography, but the phrase is usually used as a selective framing choice rather than a complete data category.",
      },
      {
        title: "Claim or misconception",
        body:
          "Common claim: Black-on-Black crime is a special problem that explains why broader public-safety or racial-justice concerns should be dismissed.\n\nThe phrase is not a separate crime category. It is a racial framing of victim-offender patterns. The data can describe who victims report or who police identify as offenders, but the phrase often implies uniqueness, causation, or moral judgment that the data do not establish.",
      },
      {
        title: "What the data actually measures",
        body:
          "Victimization surveys can capture victim reports about offender characteristics, relationship, location, and whether a crime was reported to police. Homicide data can include victim and offender demographics, relationship, weapon, and circumstances when agencies report those fields.\n\nThese sources measure incidents, victims, reported offender characteristics, and known relationships. They do not create a special Black-on-Black crime category, and they do not by themselves explain why violence is concentrated in particular places.",
      },
      {
        title: "Where the claim goes wrong",
        body:
          "The claim goes wrong when it treats intra-group victimization as unique to Black people. Crime is usually local. Because American neighborhoods, schools, and social networks remain racially and economically patterned, victim-offender patterns often occur within the same group across multiple racial and ethnic groups.\n\nThe phrase also goes wrong when it turns Black victims into a rhetorical device. If the issue is serious violence, the policy question should be how to reduce harm, improve clearance, prevent retaliation, and support victims.",
      },
      {
        title: "What the data does not prove",
        body:
          "The data do not prove that Black people uniquely harm their own communities. They do not prove that race is the cause of crime. They do not prove that Black communities do not care about victims. They do not prove that public-safety policy should ignore poverty, segregation, firearm access, trauma, or clearance rates.\n\nTo prove a stronger claim, evidence would need to compare intra-group patterns across groups and then identify causal mechanisms beyond proximity and local social conditions.",
      },
      {
        title: "Scale vs interpretation",
        body:
          "Scale matters because serious violence is not evenly distributed. It is concentrated by age, place, relationship, and circumstance. But interpretation matters too. A high level of harm in a specific set of neighborhoods does not justify a broad moral claim about an entire racial group.\n\nThe right scale is local and victim-centered: which places face the highest risk, who is being harmed, what clearance and prevention resources exist, and which interventions reduce serious violence.",
      },
      {
        title: "Stronger way to analyze the issue",
        body:
          "A stronger analysis compares intra-group crime patterns across groups, then asks why violence is concentrated in specific places and networks. It separates victimization, offender identification, relationship data, and prevention.\n\nThat approach keeps Black victims visible while avoiding the misleading implication that same-group crime is unique or self-explanatory.",
      },
      {
        title: "EquityStack takeaway",
        body:
          "The Black-on-Black crime phrase is usually a framing move. It can point to real victimization, but it often strips out comparison, locality, and prevention.\n\nThe evidence-first response is to ask whether the speaker is describing victimization data accurately, comparing it across groups, and proposing a policy that reduces harm for victims.",
      },
      {
        title: "How to respond in a debate",
        body:
          "Common claim: What about Black-on-Black crime?\n\nBetter response: Intra-group crime is common across groups because crime is usually local and social networks are patterned by neighborhood and segregation. The phrase does not explain causation or identify prevention policy.\n\nKey question: Are you comparing same-group victimization across groups, or using the phrase only when victims are Black?\n\nCommon claim: It proves Black communities do not care about Black lives.\n\nBetter response: Victimization data do not prove what an entire community values. If victims matter, the conversation should focus on prevention, clearance, trauma support, and reducing serious violence.\n\nKey question: What policy would reduce harm for the victims you are invoking?",
      },
    ],
  },
  "culture-causes-crime-claim": {
    explainer_type: "misused_claim",
    category: "misused-statistics",
    tags: ["crime", "causation", "culture", "race", "policy-analysis"],
    relatedExplainers: ["black-on-black-crime-claim", "crime-statistics-context-and-misuse"],
    lens: "Crime causation guide",
    pagePurpose:
      "Use this page when crime disparities are explained by vague references to culture without identifying a measurable mechanism or ruling out competing explanations.",
    whyThisMatters:
      "Culture claims often sound explanatory while avoiding the evidence required for causal inference. This page focuses on what crime data can measure and what a causal explanation would need to prove.",
    questions: [
      "What does culture mean in the claim, and how is it measured?",
      "Does the evidence rule out poverty, segregation, age, geography, violence exposure, and enforcement patterns?",
      "What intervention follows from the causal theory?",
    ],
    sourceContexts: [
      {
        title: "Reducing Racial Inequality in Crime and Justice: Science, Practice, and Policy",
        sourceType: "academic",
        sourceNote:
          "National Academies consensus report on racial inequality, concentrated disadvantage, and criminal justice policy.",
      },
      {
        title: "Proactive Policing: Effects on Crime and Communities",
        sourceType: "academic",
        sourceNote:
          "Consensus report on policing strategies, evidence limits, and community effects.",
      },
      {
        title: "About Community Violence",
        sourceType: "government",
        sourceNote:
          "CDC prevention frame describing risk conditions for community violence.",
      },
      {
        title: "The Growth of Incarceration in the United States: Exploring Causes and Consequences",
        sourceType: "academic",
        sourceNote:
          "National Academies report on crime, punishment, policy, and social consequences.",
      },
    ],
    argumentMode: {
      summary:
        "Claims that culture causes crime usually name a vague cause without measuring it. Crime data can show incidents, victimization, arrests, location, and demographics; it cannot isolate culture unless the claim defines a measurable mechanism and rules out competing explanations.",
      keyPoints: [
        "Culture is often undefined, which makes the claim hard to test.",
        "Crime data does not directly measure beliefs, norms, values, or causal mechanisms.",
        "A causal claim has to account for age, place, poverty, segregation, violence exposure, firearm access, and enforcement patterns.",
        "Risk factors are not excuses; they are variables that can be measured and changed.",
        "A stronger explanation should identify a mechanism and a testable policy response.",
        "This differs from the 13/50 explainer because the issue here is causal inference, not a specific statistic.",
      ],
      commonClaims: [
        {
          claim: "Culture causes the crime rate.",
          response:
            "That is not testable until culture is defined and measured. Crime data can show incidents and patterns, but it cannot isolate culture without comparing competing explanations and specifying a mechanism.",
          question:
            "What exactly do you mean by culture, and what data measures it directly?",
        },
        {
          claim: "Poverty does not matter because some poor groups have lower crime.",
          response:
            "That comparison may be relevant, but it does not isolate culture. You still have to account for age structure, geography, segregation, social networks, immigration selection, policing, and exposure to violence.",
          question:
            "Which variables are you controlling for before assigning the remaining difference to culture?",
        },
        {
          claim: "Talking about risk factors excuses violence.",
          response:
            "Risk factors are not excuses. They are measurable conditions that help identify prevention strategies and reduce victimization.",
          question:
            "Do you want a moral label, or a testable explanation that can reduce harm?",
        },
        {
          claim: "Crime proves a group has bad values.",
          response:
            "Crime data does not measure group values. It measures incidents and system responses. Turning those data into a claim about millions of people's values is an inference the data do not support.",
          question:
            "What evidence links the measured crime data to group values rather than local conditions?",
        },
      ],
      debateLines: [
        "A causal claim has to define the cause before it can prove the cause.",
        "Culture is not a measurement unless you specify what variable captures it.",
        "Risk factors explain where prevention can work; they do not excuse harm.",
        "Crime data measures incidents and system responses, not the values of an entire group.",
        "If the explanation cannot be tested, it should not be treated as proven.",
      ],
      shareCards: [
        {
          title: "Define the cause",
          text:
            "A claim that culture causes crime is not evidence until culture is defined, measured, and tested against competing explanations like age, place, poverty, segregation, and exposure to violence.",
          context: "Use when a vague cultural explanation is treated as settled fact.",
        },
        {
          title: "Risk factors are not excuses",
          text:
            "Measuring risk factors does not excuse violence. It identifies the conditions that prevention policy can change to reduce victimization and harm.",
          context: "Use when explanation is dismissed as justification.",
        },
        {
          title: "Data has limits",
          text:
            "Crime data can measure incidents, reports, arrests, victimization, and location. It does not directly measure the values or culture of millions of people.",
          context: "Use when crime data are turned into a group-character claim.",
        },
      ],
    },
    structuredSections: [
      {
        title: "Historical framing",
        body:
          "Culture-based crime claims appear when people try to turn broad social outcomes into a single group-level explanation. The central evidence issue is that administrative crime data, surveys, and neighborhood studies do not directly measure a racial group's 'culture' as a causal variable.",
      },
      {
        title: "Claim or misconception",
        body:
          "Common claim: crime disparities are caused by culture.\n\nThat conclusion is usually asserted without defining culture, measuring it, or ruling out competing explanations. A causal claim has to identify a mechanism. Otherwise culture becomes a label attached after the fact to a pattern the speaker already believes is meaningful.",
      },
      {
        title: "What the data actually measures",
        body:
          "Crime data can measure reported incidents, victimization, arrests, known offenses, clearances, locations, demographic fields, victim-offender relationships, and justice-system outcomes. Those data can be useful for public safety.\n\nThey do not directly measure values, beliefs, norms, parenting practices, peer networks, or cultural transmission unless a study separately defines and measures those variables.",
      },
      {
        title: "Where the claim goes wrong",
        body:
          "The claim goes wrong when culture is treated as a residual explanation for whatever is not immediately explained. If a speaker does not measure culture, account for other variables, or specify a mechanism, the claim is not evidence-based.\n\nCrime risk can be affected by age, gender, poverty, segregation, school quality, housing instability, unemployment, firearm availability, exposure to violence, policing, clearance rates, and informal social control. A cultural claim has to be tested against those variables, not substituted for them.",
      },
      {
        title: "What the data does not prove",
        body:
          "Crime data do not prove that an entire group has defective values. They do not prove that culture is the independent cause of a disparity. They do not prove that economic and geographic conditions are irrelevant.\n\nTo prove the stronger claim, evidence would need to define culture, measure it consistently, compare similar places and populations, account for competing risk factors, and show that the measured cultural mechanism explains the outcome.",
      },
      {
        title: "Scale vs interpretation",
        body:
          "At neighborhood scale, norms, trust, peer networks, retaliation risk, and institutional legitimacy can matter. But that is different from a sweeping racial claim. The measurable question is how specific social conditions affect behavior in specific places.\n\nThe interpretive error is moving from local conditions to a broad statement about millions of people. Scale discipline keeps analysis tied to what the evidence can actually observe.",
      },
      {
        title: "Stronger way to analyze the issue",
        body:
          "A stronger analysis starts with testable mechanisms: exposure to violence, school exclusion, concentrated poverty, job access, firearm access, trauma, neighborhood trust, clearance rates, and prevention resources. Those variables can be measured, compared, and changed.\n\nThat approach is more useful than a culture label because it points toward interventions that can reduce harm while preserving accountability for violence.",
      },
      {
        title: "EquityStack takeaway",
        body:
          "The problem with culture-causes-crime claims is not that social norms can never matter. The problem is treating an undefined term as if it explains a complex outcome.\n\nEquityStack's evidence-first standard is to define the cause, measure it, test competing explanations, and ask what evidence would prove the claim at the scale being asserted.",
      },
      {
        title: "How to respond in a debate",
        body:
          "Common claim: Culture causes the crime rate.\n\nBetter response: That claim needs a measurable definition of culture. Crime data measures incidents, reports, arrests, victimization, location, and system response. It does not directly measure values or causal mechanisms.\n\nKey question: What variable measures culture, and what competing explanations does the analysis rule out?\n\nCommon claim: Risk-factor explanations excuse crime.\n\nBetter response: Risk factors are not excuses. They are measurable conditions that help identify prevention strategies and reduce victimization.\n\nKey question: Do you want a testable explanation that reduces harm, or a label that cannot be evaluated?",
      },
    ],
  },
  "iq-and-intelligence-gap-claims": {
    explainer_type: "misused_claim",
    category: "misused-statistics",
    tags: ["iq", "education", "measurement", "race", "genetics"],
    relatedExplainers: ["equal-protection-under-the-law", "hiring-discrimination-and-anti-dei-rollbacks"],
    lens: "Measurement and inference guide",
    pagePurpose:
      "Use this page when IQ or test-score differences are used to make broad claims about racial hierarchy, innate ability, or policy worthiness.",
    whyThisMatters:
      "IQ claims can quickly move from measurement to unsupported group conclusions. This explainer keeps the discussion focused on what tests measure, what validity requires, and what group averages cannot prove.",
    questions: [
      "What test is being cited, and what use was it validated for?",
      "Does the claim separate individual prediction from group-level causal claims?",
      "Does the evidence distinguish genetic, environmental, educational, and socioeconomic explanations?",
    ],
    sourceContexts: [
      {
        title: "Intelligence: Knowns and Unknowns",
        sourceType: "academic",
        sourceNote:
          "APA task-force article reviewing intelligence measurement, prediction, genetics, environment, and unresolved questions.",
      },
      {
        title: "Standards for Educational and Psychological Testing",
        sourceType: "academic",
        sourceNote:
          "Testing standards source for validity, fairness, reliability, and appropriate score interpretation.",
      },
      {
        title: "What are complex or multifactorial disorders?",
        sourceType: "government",
        sourceNote:
          "NIH MedlinePlus genetics source explaining complex traits and gene-environment interaction limits.",
      },
      {
        title: "Genetic Architecture of Complex Traits",
        sourceType: "government",
        sourceNote:
          "NHGRI source on interpreting genetic and non-genetic variation in complex human traits.",
      },
      {
        title: "Race and Economic Opportunity in the United States: An Intergenerational Perspective",
        sourceType: "academic",
        sourceNote:
          "Administrative-data research showing why socioeconomic and neighborhood context matters when interpreting group differences.",
      },
    ],
    argumentMode: {
      summary:
        "IQ and intelligence-gap claims often move from test-score differences to claims about innate group hierarchy. Test scores can have predictive value for specific uses, but group averages do not by themselves prove genetic causation, fixed ability, or policy conclusions.",
      keyPoints: [
        "IQ tests measure performance on selected cognitive tasks under particular testing conditions.",
        "Validity applies to specific score interpretations and uses, not to every conclusion someone draws from a score.",
        "Group averages do not identify the cause of group differences.",
        "Heritability within a population does not prove genetic causes of between-group differences.",
        "Environment, schooling, health, stress, income, language, discrimination, and test access can affect measured performance.",
        "A stronger claim would need evidence separating genetic, environmental, socioeconomic, and measurement explanations.",
        "Policy conclusions should not be built from contested causal claims that the cited test does not establish.",
      ],
      commonClaims: [
        {
          claim: "IQ gaps prove innate racial differences in intelligence.",
          response:
            "That conclusion does not follow from group test-score differences alone. A test score can measure performance, but causation requires evidence that separates genetics, environment, schooling, health, socioeconomic conditions, and measurement context.",
          question:
            "What evidence proves genetic causation rather than measured performance under unequal conditions?",
        },
        {
          claim: "IQ is heritable, so group gaps must be genetic.",
          response:
            "Heritability describes variation within a studied population under particular environments. It does not automatically explain differences between groups or across environments.",
          question:
            "Are you using heritability within a population to make a between-group causal claim?",
        },
        {
          claim: "Test scores are objective, so the conclusion is settled.",
          response:
            "Standardized scoring can be objective, but score interpretation still requires validity evidence, fairness review, reliability, and a clear statement of what use the test supports.",
          question:
            "What use was the test validated for, and does that validation support the claim being made?",
        },
        {
          claim: "Group averages justify treating individuals differently.",
          response:
            "A group average does not determine an individual's ability, merit, or rights. Individual decisions require individual evidence and valid criteria for the specific purpose.",
          question:
            "How does a group average establish the ability of a specific person?",
        },
      ],
      debateLines: [
        "A test score is a measurement, not a complete theory of causation.",
        "Heritability within a population is not proof of genetic causes between groups.",
        "Validity depends on the specific interpretation and use of a test score.",
        "Group averages do not decide individual ability or rights.",
        "A serious claim has to separate genetics, environment, schooling, health, and measurement context.",
      ],
      shareCards: [
        {
          title: "Measurement is not causation",
          text:
            "IQ tests can measure performance on selected tasks, but a group score difference does not by itself prove genetic causation, fixed ability, or a policy conclusion.",
          context: "Use when test-score differences are treated as biological proof.",
        },
        {
          title: "Heritability has limits",
          text:
            "Heritability describes variation within a studied population under specific conditions. It does not automatically explain differences between racial groups or across unequal environments.",
          context: "Use when heritability is used as a shortcut to racial causation.",
        },
        {
          title: "Validity matters",
          text:
            "A standardized score is only useful for interpretations the test has been validated to support. You still need fairness, reliability, and evidence for the specific claim.",
          context: "Use when a test score is stretched beyond its validated purpose.",
        },
      ],
    },
    structuredSections: [
      {
        title: "Historical framing",
        body:
          "IQ and intelligence-gap claims have a long history in education, employment, immigration, and racial-policy debates. The strongest defensible discussion starts with what tests are designed to measure, what validity evidence supports, and where group-level conclusions exceed the available evidence.",
      },
      {
        title: "Claim or misconception",
        body:
          "Common claim: IQ or intelligence gaps prove innate racial differences and explain unequal outcomes.\n\nThat conclusion is not established by group test-score differences alone. IQ tests can measure performance on selected cognitive tasks and can predict some outcomes in some settings. But moving from measured score differences to innate racial causation requires evidence the score itself does not provide.",
      },
      {
        title: "What the data actually measures",
        body:
          "IQ tests and related cognitive assessments measure performance on specified tasks under specified conditions. The score is interpreted relative to a norming population and depends on test design, administration, reliability, validity, language, familiarity with testing, and the purpose for which the score is used.\n\nTesting standards treat validity as evidence for a particular interpretation and use. A score that is useful for one purpose does not automatically support every social or genetic conclusion attached to it.",
      },
      {
        title: "Where the claim goes wrong",
        body:
          "The claim goes wrong when it treats group averages as causal proof. A difference in average test performance does not identify why the difference exists. It does not separate schooling, poverty exposure, health, lead exposure, stress, neighborhood conditions, language, discrimination, test access, or family resources.\n\nIt also misuses heritability. Heritability estimates within a population do not automatically explain differences between groups, especially when groups have experienced different environments and opportunities.",
      },
      {
        title: "What the data does not prove",
        body:
          "The data do not prove racial hierarchy. They do not prove genetic causation for group differences. They do not prove fixed individual potential. They do not justify treating people differently based on group averages.\n\nTo prove a stronger claim, evidence would need to show a validated measure, causal identification, comparable environments, genetic mechanisms, and a way to rule out social, educational, health, and measurement explanations.",
      },
      {
        title: "Scale vs interpretation",
        body:
          "At individual scale, cognitive tests may provide useful information for specific educational, clinical, or research purposes when interpreted properly. At group scale, interpretation becomes much more difficult because groups can differ in environment, opportunity, health exposure, and testing history.\n\nThe scale error is using a group average to make claims about individuals or using an individual-difference statistic to explain group inequality.",
      },
      {
        title: "Stronger way to analyze the issue",
        body:
          "A stronger analysis asks what outcome the test was designed to predict, what population it was normed on, whether the interpretation is valid, and what environmental factors could affect performance. It also separates individual assessment from claims about racial groups.\n\nThat approach allows serious discussion of measurement and achievement without turning test scores into unsupported claims about innate worth.",
      },
      {
        title: "EquityStack takeaway",
        body:
          "IQ claims require exceptional care because they often move faster than the evidence. A test can measure performance without proving why group differences exist.\n\nEquityStack's standard is to separate measurement, prediction, causation, and policy inference. Each step requires its own evidence.",
      },
      {
        title: "How to respond in a debate",
        body:
          "Common claim: IQ gaps prove innate racial differences.\n\nBetter response: Test-score gaps measure performance differences in a specific testing context. They do not by themselves prove genetic causation or rule out schooling, health, environment, poverty, stress, and measurement factors.\n\nKey question: What evidence separates genetic causation from environmental and measurement explanations?\n\nCommon claim: IQ is heritable, so the racial gap is genetic.\n\nBetter response: Heritability within a population does not automatically explain between-group differences. That is a different causal claim and requires different evidence.\n\nKey question: Are you using a within-population statistic to make a between-group conclusion?",
      },
    ],
  },
  "immigration-comparison-claims": {
    explainer_type: "misused_claim",
    category: "misused-statistics",
    tags: ["immigration", "race", "selection-bias", "economics", "mobility"],
    relatedExplainers: ["government-benefits-racial-gap", "historical-impact-denial-claims"],
    lens: "Immigration comparison guide",
    pagePurpose:
      "Use this page when immigrant success statistics are used to claim that Black American outcomes are only about effort or culture.",
    whyThisMatters:
      "Immigrant comparisons often ignore selection effects, legal-status filtering, education differences, starting conditions, and the difference between voluntary migration and a population shaped by U.S. racial policy history.",
    questions: [
      "Who is selected into the immigrant group being compared?",
      "What legal status, education, wealth, language, and origin-country conditions shape the comparison?",
      "Does the claim compare similar starting points or unlike populations?",
    ],
    sourceContexts: [
      {
        title: "The Integration of Immigrants into American Society",
        sourceType: "academic",
        sourceNote:
          "National Academies consensus source on immigrant integration, starting points, and socioeconomic variation.",
      },
      {
        title: "Foreign-Born",
        sourceType: "government",
        sourceNote:
          "Census topic hub for foreign-born population data and definitions.",
      },
      {
        title: "New Foreign-Born Data Tables Now Available",
        sourceType: "government",
        sourceNote:
          "Census release on social and economic data by immigrant generation from CPS ASEC.",
      },
      {
        title: "Race and Economic Opportunity in the United States: An Intergenerational Perspective",
        sourceType: "academic",
        sourceNote:
          "Mobility research useful for distinguishing immigrant integration from Black American intergenerational barriers.",
      },
    ],
    argumentMode: {
      summary:
        "Immigration comparison claims often compare unlike populations. Immigrants are selected by migration, law, education, resources, risk tolerance, networks, and legal status, while Black American outcomes reflect a long domestic history of enslavement, segregation, exclusion, and unequal wealth accumulation.",
      keyPoints: [
        "Immigrants are not a random sample of their origin countries or of U.S. minorities.",
        "Legal status, visa category, education, age, language, wealth, and networks shape immigrant outcomes.",
        "Different immigrant groups arrive with different resources and face different barriers.",
        "Comparing immigrants with Black Americans without matching starting conditions creates selection bias.",
        "Success by one group does not disprove discrimination or policy effects affecting another group.",
        "A stronger comparison would match education, wealth, neighborhood, age, legal status, and generation.",
      ],
      commonClaims: [
        {
          claim: "Immigrants come here with nothing and succeed, so racism is not the issue.",
          response:
            "Immigrants are selected by who migrates and who is allowed to enter. Outcomes vary by education, legal status, wealth, age, networks, and origin. That comparison does not erase domestic policy history or prove racism is irrelevant.",
          question:
            "Are you comparing similar starting conditions, or a selected immigrant group to a whole U.S.-born population?",
        },
        {
          claim: "If immigrants can do it, Black Americans have no excuse.",
          response:
            "That turns a selection-biased comparison into a moral claim. A valid comparison would match education, wealth, legal status, neighborhood, age, and generational history.",
          question:
            "What variables are matched before drawing that conclusion?",
        },
        {
          claim: "Immigrant success proves culture is the difference.",
          response:
            "Culture is not isolated by that comparison. Migration itself selects for resources, risk tolerance, networks, and legal pathways, and immigrant groups differ widely from each other.",
          question:
            "How does the evidence separate culture from selection, visa rules, education, and class background?",
        },
        {
          claim: "Asian immigrant outcomes disprove Black discrimination.",
          response:
            "Asian American populations are internally diverse and include many high-education immigration streams. Outcomes for one selected population do not disprove barriers affecting another population with a different history and starting point.",
          question:
            "Which Asian origin group, immigration pathway, generation, and education level are being compared?",
        },
      ],
      debateLines: [
        "Immigrants are selected populations, not random comparison groups.",
        "A comparison is only as strong as its matched starting conditions.",
        "Success by one group does not disprove barriers faced by another.",
        "Selection effects are not excuses; they are basic measurement discipline.",
        "Name the immigrant group, visa pathway, generation, education level, and comparison population.",
      ],
      shareCards: [
        {
          title: "Selection effects matter",
          text:
            "Immigrants are selected by migration, law, education, resources, risk tolerance, networks, and legal status. Comparing them to a whole U.S.-born population without matching starting conditions is not a valid causal argument.",
          context: "Use when immigrant outcomes are treated as proof that racism is irrelevant.",
        },
        {
          title: "Compare like with like",
          text:
            "A serious comparison has to match education, wealth, age, neighborhood, legal status, generation, and starting conditions. Otherwise the claim confuses selection with causation.",
          context: "Use when unlike groups are compared as if they started from the same place.",
        },
        {
          title: "One group does not disprove another",
          text:
            "Success by a selected immigrant group does not disprove discrimination, wealth gaps, or policy effects affecting Black Americans. Different histories require different evidence.",
          context: "Use when immigrant success is used to dismiss Black American history.",
        },
      ],
    },
    structuredSections: [
      {
        title: "Historical framing",
        body:
          "Immigration comparison claims usually contrast outcomes for selected immigrant groups with outcomes for native-born Black Americans. The comparison can be informative only when it accounts for selection, legal status, cohort timing, education, migration costs, and starting conditions.",
      },
      {
        title: "Claim or misconception",
        body:
          "Common claim: immigrants succeed in America, so Black American outcomes must be caused by culture or lack of effort rather than discrimination or policy history.\n\nThat conclusion depends on a weak comparison. Immigrant groups are selected by migration decisions, legal pathways, education, wealth, age, language, networks, and risk tolerance. Black Americans are a domestic population shaped by U.S. policy history across generations.",
      },
      {
        title: "What the data actually measures",
        body:
          "Immigration data measure foreign-born status, generation, legal or naturalization categories where available, education, income, occupation, poverty, language, household structure, and origin region. These data can show integration and mobility patterns.\n\nThey do not automatically provide a valid causal comparison with Black Americans unless the analysis matches starting conditions and accounts for selection into immigration.",
      },
      {
        title: "Where the claim goes wrong",
        body:
          "The claim goes wrong by comparing selected immigrant groups with an entire U.S.-born racial population. Some immigrants arrive with high education, professional credentials, family networks, or visa filters. Others arrive with low resources and face serious barriers. Treating immigrants as one simple success category erases that variation.\n\nThe claim also ignores different historical starting points. Voluntary migration, refugee admission, employment visas, family reunification, and undocumented migration are different from a domestic history of enslavement, segregation, redlining, school exclusion, labor-market discrimination, and unequal wealth accumulation.",
      },
      {
        title: "What the data does not prove",
        body:
          "Immigrant success data do not prove racism is irrelevant. They do not prove Black American outcomes are caused by culture. They do not prove all immigrant groups do better than all U.S.-born groups. They do not prove that groups had comparable starting conditions.\n\nTo prove the stronger claim, evidence would need matched comparisons by education, wealth, age, neighborhood, legal status, generation, family background, and exposure to discrimination.",
      },
      {
        title: "Scale vs interpretation",
        body:
          "At broad scale, immigrant groups can show impressive mobility and integration. But broad averages hide large differences by origin country, visa pathway, legal status, education, class, and generation.\n\nThe interpretive error is using a high-performing selected subgroup as a universal benchmark for an entire domestic population. Scale discipline requires specifying which immigrant group and which comparison population are being analyzed.",
      },
      {
        title: "Stronger way to analyze the issue",
        body:
          "A stronger analysis compares like with like. It asks whether groups are similar by education, starting wealth, neighborhood, age, language, legal status, and generation. It also asks what barriers each group faced and what institutions shaped their opportunity.\n\nThat approach can acknowledge immigrant achievement without using it to erase Black American history or policy effects.",
      },
      {
        title: "EquityStack takeaway",
        body:
          "Immigrant comparison claims usually fail because they ignore selection effects and starting conditions. The evidence may show that a particular immigrant group is doing well; it does not automatically explain why Black American outcomes differ.\n\nThe defensible response is to ask whether the comparison is matched, whether selection is addressed, and whether the conclusion follows from the evidence.",
      },
      {
        title: "How to respond in a debate",
        body:
          "Common claim: Immigrants succeed, so racism cannot explain Black outcomes.\n\nBetter response: Immigrants are selected populations shaped by legal pathways, education, age, resources, language, and networks. That comparison does not prove racism is irrelevant or erase domestic policy history.\n\nKey question: Are the groups matched by education, wealth, neighborhood, legal status, age, and generation?\n\nCommon claim: Immigrant success proves culture is the difference.\n\nBetter response: Culture is not isolated by the comparison. Migration itself selects for people and pathways, and immigrant groups vary widely.\n\nKey question: How does the evidence separate culture from selection effects and starting conditions?",
      },
    ],
  },
  "historical-impact-denial-claims": {
    explainer_type: "misused_claim",
    category: "misused-statistics",
    tags: ["history", "wealth", "policy", "race", "intergenerational-effects"],
    relatedExplainers: ["redlining-black-homeownership", "gi-bill-access-and-impact", "homestead-act-exclusion"],
    lens: "Historical impact guide",
    pagePurpose:
      "Use this page when someone claims that slavery, segregation, redlining, or unequal public benefits are too far in the past to affect present outcomes.",
    whyThisMatters:
      "Historical denial claims often ignore how wealth, homeownership, schooling, neighborhoods, and inheritance accumulate over time. This page connects timelines to measurable long-term effects without claiming history explains everything.",
    questions: [
      "Which policy timeline is being dismissed as irrelevant?",
      "Does the claim account for wealth accumulation and inheritance?",
      "What evidence would show that a historical policy effect has fully dissipated?",
    ],
    sourceContexts: [
      {
        title: "How Black, Hispanic, Asian, White households compare in wealth",
        sourceType: "secondary-analysis",
        sourceNote:
          "Pew analysis of Federal Reserve wealth data useful for present-day wealth-gap scale.",
      },
      {
        title: "Race and Economic Opportunity in the United States: An Intergenerational Perspective",
        sourceType: "academic",
        sourceNote:
          "Longitudinal mobility research showing persistence of racial income gaps across generations.",
      },
      {
        title: "The Impacts of Neighborhoods on Intergenerational Mobility I: Childhood Exposure Effects",
        sourceType: "academic",
        sourceNote:
          "Research showing childhood exposure to place affects adult outcomes.",
      },
      {
        title: "Homeownership, racial segregation, and policy solutions to racial wealth equity",
        sourceType: "secondary-analysis",
        sourceNote:
          "Brookings policy analysis linking housing discrimination, segregation, and wealth equity.",
      },
      {
        title: "The Growth of Incarceration in the United States: Exploring Causes and Consequences",
        sourceType: "academic",
        sourceNote:
          "Consensus report documenting community and family consequences of high incarceration rates.",
      },
    ],
    argumentMode: {
      summary:
        "Claims that historical discrimination no longer matters usually ignore how assets, neighborhoods, schools, health, and inheritance compound. History does not explain every present outcome, but policy effects can persist when the mechanisms they shaped still affect opportunity.",
      keyPoints: [
        "Wealth accumulates across generations through homeownership, savings, inheritance, and asset appreciation.",
        "Policies such as segregation, redlining, and unequal benefit access affected starting points for families and neighborhoods.",
        "A past policy can matter today if it shaped assets, schools, neighborhoods, or institutions that still affect outcomes.",
        "Historical impact is not the same as saying no individual choices matter.",
        "A stronger denial claim would need evidence that the relevant gap fully closed or the mechanism no longer affects outcomes.",
        "Present-day data should be interpreted with timelines, not detached from them.",
      ],
      commonClaims: [
        {
          claim: "That happened too long ago to matter now.",
          response:
            "Time alone does not erase effects. Wealth, housing, schooling, and neighborhood opportunity can compound across generations, so the question is whether the mechanism still affects outcomes.",
          question:
            "What evidence shows the effect fully dissipated rather than being transmitted through assets, place, or institutions?",
        },
        {
          claim: "Nobody alive today caused it, so it is irrelevant.",
          response:
            "Causation and blame are different questions. A policy can shape present conditions even if current individuals did not create it.",
          question:
            "Are we discussing personal blame or whether past policy effects still show up in present data?",
        },
        {
          claim: "Civil rights laws fixed the problem.",
          response:
            "Civil-rights laws changed legal rules, but they did not instantly equalize wealth, neighborhood conditions, school quality, or inherited assets.",
          question:
            "Which data show that the relevant economic and neighborhood gaps fully closed after legal reform?",
        },
        {
          claim: "History is just an excuse.",
          response:
            "Historical analysis is not an excuse. It is a way to identify mechanisms such as asset accumulation, housing markets, education access, and institutional rules.",
          question:
            "What mechanism are you claiming no longer matters, and what evidence supports that?",
        },
      ],
      debateLines: [
        "Time passing is not evidence that an effect disappeared.",
        "Blame and causation are different questions.",
        "Wealth and neighborhood advantage can compound across generations.",
        "Legal change does not instantly equalize accumulated assets.",
        "To deny historical impact, show that the mechanism stopped affecting outcomes.",
      ],
      shareCards: [
        {
          title: "Time is not evidence",
          text:
            "The fact that a policy happened in the past does not prove its effects disappeared. Wealth, housing, schools, and neighborhoods can transmit advantage or disadvantage across generations.",
          context: "Use when someone says history is too old to matter.",
        },
        {
          title: "Blame is not causation",
          text:
            "You can analyze whether past policy shaped present conditions without assigning personal blame to people alive today. Those are different questions.",
          context: "Use when the debate shifts from evidence to blame.",
        },
        {
          title: "Show dissipation",
          text:
            "To prove historical discrimination no longer matters, evidence would need to show the affected assets, neighborhoods, schools, and opportunities fully converged or no longer influence outcomes.",
          context: "Use when someone denies historical impact without evidence.",
        },
      ],
    },
    structuredSections: [
      {
        title: "Historical framing",
        body:
          "Historical-impact denial claims argue that past discrimination is too distant to matter for present outcomes. The evidence question is not whether every current disparity has one historical cause; it is whether policy timelines, wealth accumulation, residential sorting, and intergenerational records show continuing effects.",
      },
      {
        title: "Claim or misconception",
        body:
          "Common claim: historical discrimination no longer matters because slavery, segregation, redlining, or unequal public benefits happened in the past.\n\nThat conclusion does not follow from the passage of time. A historical policy can still matter if it shaped wealth, housing, schools, neighborhoods, labor markets, or institutions that continue to affect outcomes.",
      },
      {
        title: "What the data actually measures",
        body:
          "Modern data can measure wealth, homeownership, income, schooling, neighborhood conditions, health, incarceration, and mobility. Historical data can measure policy access, housing maps, benefit rules, segregation, land ownership, lending patterns, and school exclusion.\n\nThe analytic task is connecting the timeline to mechanisms. The evidence is strongest when it shows how a past rule shaped assets or institutions that still influence present opportunity.",
      },
      {
        title: "Where the claim goes wrong",
        body:
          "The claim goes wrong by assuming effects expire automatically. Wealth does not reset each generation. Homes appreciate, debt accumulates, schools are tied to neighborhoods, and inheritances are affected by what prior generations could own.\n\nLegal reform can remove a barrier without equalizing the resources already distributed under the old rules. That is why civil-rights timelines and present-day outcome data have to be read together.",
      },
      {
        title: "What the data does not prove",
        body:
          "Historical evidence does not prove that every present outcome has only one cause. It does not prove that individual choices are irrelevant. It does not prove that policy effects are identical in every place.\n\nBut denial also needs evidence. To prove historical discrimination no longer matters, the evidence would need to show that the relevant wealth, housing, education, neighborhood, or institutional mechanisms no longer affect outcomes.",
      },
      {
        title: "Scale vs interpretation",
        body:
          "At national scale, racial wealth and mobility gaps show persistent differences. At local scale, housing policy, school districting, lending, and employment can create different trajectories across neighborhoods.\n\nInterpretation requires matching the scale of the claim. A national wealth gap cannot be explained by one local policy, and one local success story cannot disprove national patterns.",
      },
      {
        title: "Stronger way to analyze the issue",
        body:
          "A stronger analysis asks which mechanism is being discussed: homeownership, inheritance, school quality, neighborhood exposure, labor-market access, health, incarceration, or public investment. Then it asks whether that mechanism still affects outcomes and what evidence shows convergence or persistence.\n\nThat framing avoids both overclaiming and denial. History matters when a measurable pathway connects past policy to present conditions.",
      },
      {
        title: "EquityStack takeaway",
        body:
          "Historical impact is a mechanism question, not a slogan. The evidence does not require saying history explains everything. It requires asking whether past policy shaped assets, places, and institutions that still matter.\n\nMisusing the past by dismissing it can be as misleading as overusing it. The strongest analysis follows the timeline and tests the pathway.",
      },
      {
        title: "How to respond in a debate",
        body:
          "Common claim: That was a long time ago, so it cannot explain anything now.\n\nBetter response: Time passing does not prove an effect disappeared. Wealth, housing, schools, and neighborhoods can transmit advantage or disadvantage across generations.\n\nKey question: What evidence shows the affected assets or institutions fully converged?\n\nCommon claim: Nobody alive today caused it, so it is irrelevant.\n\nBetter response: Personal blame and causal evidence are different. A policy can shape present conditions even if current individuals did not create it.\n\nKey question: Are we discussing blame, or whether a measurable mechanism still affects outcomes?",
      },
    ],
  },
  "disparate-impact-vs-intent-claims": {
    category: "argument-mechanics",
    tags: [
      "disparate-impact",
      "intent",
      "discrimination-law",
      "evidence-standards",
      "civil-rights",
      "legal-analysis",
    ],
    relatedExplainers: [
      "equal-protection-under-the-law",
      "sentencing-disparities-united-states",
      "hiring-discrimination-and-anti-dei-rollbacks",
      "systemic-vs-individual-racism-claims",
    ],
    relatedPolicies: [
      "5-civil-rights-act-of-1964",
      "7-fair-housing-act-of-1968",
      "96-civil-rights-act-of-1991",
    ],
    lens: "Discrimination standard guide",
    pagePurpose:
      "Use this page when a debate confuses unequal outcomes with proven motive, or assumes that no discrimination exists unless someone openly states racist intent.",
    whyThisMatters:
      "Public arguments often mash together moral language, legal standards, and statistical patterns. This explainer separates those layers so readers can tell what a disparity shows, what intent requires, and why law sometimes treats impact and motive as different questions.",
    argumentReady: {
      claim:
        "If you cannot prove racist intent, the policy is not discriminatory.",
      whyMisleading:
        "Intent and impact are different evidentiary questions. In many legal settings, a facially neutral rule can still be challenged when it produces a measurable disparate impact that cannot be justified under the governing standard.",
      dataShows: [
        "Intent claims and disparate-impact claims ask different questions and rely on different kinds of proof.",
        "Disparate-impact analysis usually requires a specific policy, a measurable disparity, and a causal connection between the two.",
        "A disparity alone is not enough; courts and agencies also ask whether the policy is justified and whether workable alternatives exist.",
        "Direct proof of motive is often limited, which is one reason law and policy sometimes examine effects as well as purpose.",
      ],
      bottomLine:
        "Unequal effect can matter even without direct proof of motive, but not every disparity proves unlawful discrimination.",
      responseScript:
        "Not every discrimination claim is an intent claim. The real question is whether the evidence shows a specific policy caused an unjustified disparity, or whether there is separate evidence of purposeful discrimination.",
      responseContext:
        "Use when someone treats lack of direct motive evidence as a complete defense.",
    },
    questions: [
      "Is the argument about motive, effect, or both?",
      "What specific policy or practice produced the claimed disparity?",
      "Does the evidence show causation, justification, and any less discriminatory alternative?",
    ],
    sourceContexts: [
      {
        title: "Section VI- Proving Discrimination- Intentional Discrimination",
        sourceType: "legal",
        sourceNote:
          "DOJ Title VI guidance on proving intentional discrimination, including motive frameworks and pattern-or-practice evidence.",
      },
      {
        title: "Section VII- Proving Discrimination- Disparate Impact",
        sourceType: "legal",
        sourceNote:
          "DOJ Title VI guidance on how disparate-impact claims are analyzed, including disparity, causation, justification, and alternatives.",
      },
      {
        title: "Employment Tests and Selection Procedures",
        sourceType: "government",
        sourceNote:
          "EEOC guidance distinguishing disparate treatment from disparate impact and explaining why statistics and business necessity matter.",
      },
      {
        title: "Griggs v. Duke Power Company (1971)",
        sourceType: "legal",
        sourceNote:
          "Landmark Supreme Court case often cited for the principle that neutral employment rules can still be discriminatory in operation.",
      },
      {
        title:
          "Texas Dept. of Housing and Community Affairs v. Inclusive Communities Project, Inc. (2015)",
        sourceType: "legal",
        sourceNote:
          "Supreme Court case recognizing disparate-impact liability under the Fair Housing Act while stressing the need for a strong causal showing.",
      },
    ],
    argumentMode: {
      summary:
        "Discrimination is not only an intent question. A rule can be neutral in wording and still trigger scrutiny when it predictably produces an unjustified disparity, but that does not mean every unequal outcome proves unlawful bias or racist motive.",
      quickResponse:
        "No direct slur does not end the analysis. The real question is whether a specific rule caused an unjustified disparity or whether there is separate evidence of intent.",
      discussionResponse:
        "People often use the word discrimination as if it always means motive, but law and policy do not always work that way. Some claims ask whether decision-makers acted because of race; others ask whether a neutral policy produced a measurable disparity that cannot be justified. That is why effect, causation, and justification all matter alongside motive.",
      debateResponse:
        "Claim: Without proof of racist intent, there is no discrimination.\n\nEvidence: Civil-rights law often separates intentional discrimination from disparate-impact analysis, which asks whether a specific policy caused a measurable disparity and whether the policy can be justified.\n\nLimit: A disparity by itself is not enough; it must be tied to a policy and evaluated under the relevant legal standard.",
      keyPoints: [
        "Motive and effect are different questions.",
        "Neutral wording does not settle real-world impact.",
        "Disparate impact analysis starts with a specific policy, not a vague social gap.",
        "Statistics can show a pattern; they cannot read minds.",
        "Intent claims need more than unequal outcomes alone.",
        "Not every disparity is illegal, but not every neutral rule is fair.",
      ],
      commonClaims: [
        {
          claim:
            "If nobody said anything racist, the policy cannot be discriminatory.",
          response:
            "That only addresses direct motive evidence. A policy can still be challenged if it produces a measurable disparate impact and the evidence ties that disparity to the policy itself.",
          question:
            "What does the record show about the rule's effect, not just the absence of an explicit statement?",
        },
        {
          claim:
            "Different outcomes prove racist intent.",
          response:
            "Outcome gaps can justify further scrutiny, but they do not automatically prove motive. Intent usually requires additional evidence, while disparate-impact analysis asks a different question about the rule and its effect.",
          question:
            "Are you trying to prove motive, or are you showing that a specific rule caused an unjustified disparity?",
        },
        {
          claim:
            "If the same rule applies to everyone, the policy is equal.",
          response:
            "Formal uniformity does not answer whether the rule screens people out in unequal ways or whether that screening is necessary for the stated objective.",
          question:
            "What evidence shows the rule is both necessary and not producing an avoidable disparity?",
        },
        {
          claim:
            "Disparate impact means any racial imbalance is illegal.",
          response:
            "No. A serious disparate-impact claim still needs a specific practice, a measurable disparity, a causal link, and a test of justification and alternatives.",
          question:
            "Which policy caused the disparity, and what evidence ties the two together?",
        },
        {
          claim:
            "Talking about impact is just a backdoor way to accuse people of racism.",
          response:
            "Impact analysis is often narrower than that. It can ask whether a rule works fairly without making a sweeping claim about every actor's personal beliefs.",
          question:
            "Can we separate the fairness of the rule from assumptions about what is in each decision-maker's head?",
        },
      ],
      debateLines: [
        "A rule can be neutral in form and unequal in operation.",
        "Impact evidence tests the policy; intent evidence tests the motive.",
        "No direct slur is not the same thing as no discriminatory effect.",
        "A disparity starts the analysis. It does not finish it.",
        "If you cannot name the policy, you have not made a disparate-impact case yet.",
      ],
      shareCards: [
        {
          title: "Effect is its own question",
          text:
            "A discrimination claim does not always rise or fall on motive alone. Sometimes the issue is whether a neutral rule caused an unjustified disparity.",
          context:
            "Use when someone treats intent as the only valid evidence standard.",
        },
        {
          title: "Uniform rule, unequal result",
          text:
            "Applying the same rule to everyone does not prove the rule works equally for everyone.",
          context:
            "Use when formal sameness is treated as proof of fairness.",
        },
        {
          title: "Disparity is not mind reading",
          text:
            "Statistics can reveal a pattern without claiming to know anyone's private motive.",
          context:
            "Use when impact analysis is dismissed as speculation about intent.",
        },
        {
          title: "Name the policy",
          text:
            "A serious disparate-impact argument identifies the rule, the disparity, and the causal link between them.",
          context:
            "Use when broad outcome gaps are cited without a policy mechanism.",
        },
      ],
    },
    structuredSections: [
      {
        title: "Historical framing",
        body:
          "Arguments about discrimination have long split into two lanes. One asks whether a person or institution acted because of race. The other asks whether a rule that looks neutral still functions as a barrier in practice. Those lanes overlap sometimes, but they are not identical.",
      },
      {
        title: "Claim or misconception",
        body:
          "Common claim: if you cannot prove racist intent, there is no discrimination.\n\nThat is too narrow. Intentional discrimination is one category of claim, but it is not the only way unequal treatment is evaluated in law or policy. Some frameworks also examine whether a specific policy caused a measurable disparate impact.",
      },
      {
        title: "What the concept actually means",
        body:
          "Intent claims ask whether race was a motivating factor in the decision. Disparate-impact claims ask whether a facially neutral policy disproportionately harms a protected group and whether that policy can be justified under the relevant standard.\n\nIn practical terms, intent is about purpose. Disparate impact is about operation.",
      },
      {
        title: "Where the claim goes wrong",
        body:
          "The claim goes wrong by assuming that direct motive evidence is the only acceptable kind of proof. That skips over situations where a rule screens people out unevenly, where the disparity is statistically visible, and where the rule is not tightly connected to a legitimate objective.\n\nIt also skips over the opposite mistake: treating any disparity as automatic proof of bad intent.",
      },
      {
        title: "What the concept does not prove",
        body:
          "Disparate impact does not prove that every unequal outcome is discrimination. It does not prove that every actor enforcing the rule had racist motives. It does not erase the need to show a specific policy, a disparity, and a causal link.\n\nIntent claims also have limits. A suspicious disparity can support an inference, but it does not by itself establish purpose in every legal context.",
      },
      {
        title: "Scale vs interpretation",
        body:
          "A one-off anecdote may raise concern, but population-level disparity usually needs broader evidence. At the same time, a large population disparity still needs interpretation: which policy produced it, how strong the causal link is, and whether the comparison group fits the claim.\n\nScale matters because the evidence should match the size of the conclusion.",
      },
      {
        title: "Stronger way to analyze the issue",
        body:
          "Start with four questions: what specific rule is being challenged, what disparity appears, what evidence ties the rule to the disparity, and what justification is being offered for keeping the rule. Then ask whether there is separate evidence of motive, because that is a different inquiry.\n\nThat approach keeps the argument bounded and prevents both overclaiming and denial.",
      },
      {
        title: "EquityStack takeaway",
        body:
          "The better distinction is not discrimination versus no discrimination. It is intent evidence versus impact evidence. A strong analysis identifies which kind of claim is being made and what proof that claim actually requires.",
      },
      {
        title: "How to respond in a debate",
        body:
          "Common claim: If you cannot prove intent, you cannot call it discrimination.\n\nBetter response: Intent is one standard, but not the only one. The stronger question is whether a specific rule caused a measurable disparity and whether the rule can be justified.\n\nKey question: What policy are we evaluating, and what evidence connects it to the disparity?\n\nCommon claim: Unequal outcomes prove racist motive.\n\nBetter response: Unequal outcomes can justify investigation, but motive usually requires additional evidence. Impact and intent are related questions, not interchangeable ones.\n\nKey question: Are you proving purpose, or are you showing that a rule worked unequally in practice?",
      },
    ],
  },
  "systemic-vs-individual-racism-claims": {
    category: "argument-mechanics",
    tags: [
      "systemic-racism",
      "individual-racism",
      "institutions",
      "pattern-evidence",
      "civil-rights",
      "aggregate-outcomes",
    ],
    relatedExplainers: [
      "disparate-impact-vs-intent-claims",
      "equal-protection-under-the-law",
      "hiring-discrimination-and-anti-dei-rollbacks",
      "sentencing-disparities-united-states",
    ],
    relatedPolicies: [
      "6-voting-rights-act-of-1965",
      "7-fair-housing-act-of-1968",
      "54-violent-crime-control-and-law-enforcement-act-of-1994",
    ],
    lens: "Level-of-analysis guide",
    pagePurpose:
      "Use this page when a debate treats personal prejudice and system-level inequality as if they were the same claim, or assumes that disproving one automatically disproves the other.",
    whyThisMatters:
      "Many arguments about racism talk past each other because one side is discussing individual conduct while the other is discussing institutions, incentives, and repeated outcomes. This explainer separates those levels so readers can identify what is actually being claimed.",
    argumentReady: {
      claim:
        "If you cannot point to a racist individual, there is no racism in the system.",
      whyMisleading:
        "That collapses person-level bias and system-level outcomes into one question. A system can produce patterned inequality through rules, procedures, and repeated institutional choices even when the argument does not identify one openly racist actor.",
      dataShows: [
        "Individual racism and systemic racism are different levels of analysis, not interchangeable labels.",
        "Systemic claims usually rely on recurring patterns across institutions, rules, or enforcement practices rather than one isolated event.",
        "Pattern-or-practice frameworks in civil-rights enforcement look for repeated conduct, policy structure, and broad impact.",
        "System-level evidence does not prove every participant shares the same motive or degree of responsibility.",
      ],
      bottomLine:
        "A systems claim is about how institutions distribute outcomes, not just about whether one person can be caught saying the quiet part out loud.",
      responseScript:
        "You do not need a recorded slur to ask a systemic question. The real issue is whether the rules, procedures, or repeated practices are producing a durable pattern across a population.",
      responseContext:
        "Use when someone treats the absence of one obvious villain as proof that the system is clean.",
    },
    questions: [
      "Is the claim about a person's motive, or about repeated outcomes across an institution?",
      "What rule, process, or practice is alleged to create the pattern?",
      "Does the evidence show isolated incidents, or a broader recurring structure?",
    ],
    sourceContexts: [
      {
        title: "Systemic Enforcement at the EEOC",
        sourceType: "government",
        sourceNote:
          "EEOC explanation of what counts as systemic discrimination and why agencies evaluate policy, pattern, and class-wide impact.",
      },
      {
        title: "A Pattern Or Practice Of Discrimination",
        sourceType: "legal",
        sourceNote:
          "DOJ summary of pattern-or-practice enforcement under the Fair Housing Act and other civil-rights laws.",
      },
      {
        title:
          "Addressing Police Misconduct Laws Enforced By The Department Of Justice",
        sourceType: "government",
        sourceNote:
          "DOJ page illustrating how repeated policy or enforcement failures can be addressed as institutional misconduct, not just as one-off acts.",
      },
      {
        title:
          "Race and Economic Opportunity in the United States: An Intergenerational Perspective",
        sourceType: "academic",
        sourceNote:
          "Large-scale mobility research useful for showing why repeated population gaps raise system-level questions rather than only person-level ones.",
      },
      {
        title: "Opportunity Atlas Data Tool",
        sourceType: "primary-data",
        sourceNote:
          "Census public data tool showing how opportunity and adult outcomes vary by race, class, sex, and place at population scale.",
      },
    ],
    argumentMode: {
      summary:
        "Systemic racism and individual racism are not the same claim. Individual racism asks what a person did; systemic racism asks how rules, institutions, and repeated practices distribute harm or advantage across a population, without requiring proof that every actor in the chain shares the same motive.",
      quickResponse:
        "These are different levels of analysis. A system can produce a pattern without every person in it being equally biased.",
      discussionResponse:
        "Arguments about racism often break down because people switch levels without noticing. One side is asking whether a person acted out of bias, while the other is asking whether an institution keeps producing the same unequal result through policy, incentives, or repeated discretion. Those are related questions, but they are not the same test.",
      debateResponse:
        "Claim: If no openly racist individual can be identified, the system is not racist.\n\nEvidence: Civil-rights enforcement routinely examines pattern, practice, policy, and aggregate outcomes because recurring institutional effects can exist without a single dramatic confession.\n\nLimit: A systemic pattern does not prove the same motive for every actor or make every disparity self-explanatory.",
      keyPoints: [
        "A person can be fair in one decision while the institution still produces a pattern.",
        "Repeated gaps across many decisions are a systems question.",
        "Systemic claims usually point to rules, procedures, or incentives.",
        "Individual bad acts matter, but they do not exhaust the analysis.",
        "Population patterns need population evidence.",
        "A systems finding is not a universal verdict on every person inside the system.",
      ],
      commonClaims: [
        {
          claim:
            "If you cannot name the racist person, systemic racism is imaginary.",
          response:
            "That treats a structural claim as if it were a biography. Systemic arguments ask whether institutions repeatedly produce the same unequal result through policy, procedure, or broad enforcement practice.",
          question:
            "Are we evaluating one person's motive, or a recurring institutional pattern?",
        },
        {
          claim:
            "It is just a few bad apples.",
          response:
            "That explanation only works if the pattern disappears once you control for policy, supervision, incentives, and repeated outcomes across the institution. If the same result keeps recurring, the problem is bigger than a few names.",
          question:
            "What evidence shows the disparity vanishes once you look beyond isolated incidents?",
        },
        {
          claim:
            "If the written rule is neutral, the system is neutral.",
          response:
            "A neutral sentence on paper does not tell you how discretion, enforcement, access, exceptions, or oversight actually work in practice.",
          question:
            "What does the institution do repeatedly, not just what does the manual say?",
        },
        {
          claim:
            "A few successful individuals disprove the systemic claim.",
          response:
            "Exceptional outcomes do not settle a population question. Systemic analysis looks at recurring distributions across groups, places, and institutions, not whether every individual had the same result.",
          question:
            "Are you using notable exceptions to avoid the broader pattern?",
        },
        {
          claim:
            "Calling something systemic means blaming everyone equally.",
          response:
            "No. Systemic analysis is about structure and repeated outcomes, not a moral ranking of every participant. Responsibility can vary while the pattern still exists.",
          question:
            "Can we evaluate the institution without pretending every actor holds the same intent?",
        },
      ],
      debateLines: [
        "A pattern is not the same thing as a personality test.",
        "Systems are measured by outcomes that repeat, not by one confession.",
        "You can clear one person and still have an institutional problem.",
        "An equal rulebook does not guarantee equal operation.",
        "The question is not who to blame first. It is what keeps recurring.",
      ],
      shareCards: [
        {
          title: "Different question, different proof",
          text:
            "Individual racism asks what a person did. Systemic racism asks what an institution keeps producing.",
          context:
            "Use when a conversation keeps mixing person-level and system-level claims.",
        },
        {
          title: "Patterns count",
          text:
            "If the same unequal result shows up across many decisions, many sites, or many years, that is not just an anecdote about one actor.",
          context:
            "Use when a recurring institutional pattern is dismissed as isolated noise.",
        },
        {
          title: "One exception changes nothing",
          text:
            "A counterexample can be real and still tell you nothing about how the system usually works.",
          context:
            "Use when one success story is offered as a complete rebuttal.",
        },
        {
          title: "Structure is evidence",
          text:
            "Rules, incentives, oversight, and repeated discretion are evidence too. The system is more than the written policy.",
          context:
            "Use when only explicit statements are treated as relevant proof.",
        },
      ],
    },
    structuredSections: [
      {
        title: "Historical framing",
        body:
          "Civil-rights debates have always involved both people and institutions. Some harms come from direct acts by identifiable decision-makers. Others persist because schools, labor markets, police departments, housing systems, and benefit systems keep applying rules and discretion in ways that produce a recurring pattern.",
      },
      {
        title: "Claim or misconception",
        body:
          "Common claim: if you cannot identify a clearly racist individual, there is no racism in the system.\n\nThat confuses two different questions. Individual racism is about a person's conduct or motive. Systemic racism is about whether rules, practices, and institutions keep generating unequal outcomes at scale.",
      },
      {
        title: "What the concept actually means",
        body:
          "Individual racism refers to acts, statements, decisions, or treatment by a person. Systemic racism refers to patterned inequality produced through institutions, policies, administration, enforcement, or linked decision chains.\n\nThe concepts can overlap, but neither one swallows the other.",
      },
      {
        title: "Where the claim goes wrong",
        body:
          "The claim goes wrong by demanding person-level proof for a system-level argument. If the evidence concerns repeated outcomes across an agency, school system, labor market, or lending environment, then the analysis has to look at the structure and not only at one actor's private beliefs.\n\nIt can also go wrong the other way by treating every gap as self-proving. The structure still needs to be specified.",
      },
      {
        title: "What the concept does not prove",
        body:
          "A systemic claim does not prove that every member of an institution is individually racist. It does not prove identical motive across all cases. It does not mean every disparity has the same cause.\n\nAn individual case also has limits. One documented act of bias may be serious, but it does not automatically map the full institution unless the evidence shows repetition or broader policy relevance.",
      },
      {
        title: "Scale vs interpretation",
        body:
          "One incident can establish an individual claim. A systemic claim usually requires broader evidence: repeated outcomes, multiple cases, institutional records, or policy design that affects many people.\n\nInterpretation has to match scale. One story cannot prove a national system, and one clean case cannot erase a durable population pattern.",
      },
      {
        title: "Stronger way to analyze the issue",
        body:
          "Ask three questions in sequence: what level is the claim about, what mechanism is being identified, and what evidence fits that level. If the claim is systemic, look for policy, process, oversight, incentive structure, or repeated outcome evidence. If the claim is individual, look for direct or circumstantial proof tied to the person and act in question.",
      },
      {
        title: "EquityStack takeaway",
        body:
          "The most common mistake in this debate is category confusion. Systemic racism is not a synonym for every rude act, and individual racism is not the only valid lens for unequal outcomes. A serious analysis names the level first, then tests the evidence at that level.",
      },
      {
        title: "How to respond in a debate",
        body:
          "Common claim: Show me the racist person, or the systemic claim fails.\n\nBetter response: That only works if the claim is about one person's motive. A systems claim asks whether the institution keeps producing the same unequal result through policy, procedure, or repeated practice.\n\nKey question: What level of analysis are we using here?\n\nCommon claim: A few bad actors explain everything.\n\nBetter response: If the same pattern survives beyond a few names, then the explanation has to expand to supervision, rules, incentives, and enforcement.\n\nKey question: What evidence shows the pattern disappears once those broader factors are examined?",
      },
    ],
  },
  "equal-opportunity-claims": {
    category: "argument-mechanics",
    tags: [
      "equal-opportunity",
      "access",
      "mobility",
      "starting-conditions",
      "policy-design",
      "education",
      "housing",
    ],
    relatedExplainers: [
      "bootstraps-vs-policy-reality",
      "gi-bill-access-and-impact",
      "government-benefits-racial-gap",
      "redlining-black-homeownership",
    ],
    relatedPolicies: [
      "5-civil-rights-act-of-1964",
      "7-fair-housing-act-of-1968",
      "174-personal-responsibility-and-work-opportunity-reconciliation-act-of-1996",
    ],
    lens: "Opportunity definition guide",
    pagePurpose:
      "Use this page when someone equates equal opportunity with formal eligibility alone and ignores access, starting position, and the institutions that shape who can convert effort into outcomes.",
    whyThisMatters:
      "Equal opportunity sounds straightforward, but it usually gets defined too thinly in debate. This explainer separates equal rules from equal access and explains why starting conditions, place, and policy design matter before outcomes ever appear.",
    argumentReady: {
      claim:
        "If everyone is formally allowed to compete, opportunity is already equal.",
      whyMisleading:
        "Formal eligibility is only one part of opportunity. Access to safe neighborhoods, quality schools, transportation, credit, stable work, and low-risk institutional treatment shapes who can actually make use of that eligibility.",
      dataShows: [
        "Opportunity is affected by where people grow up, what institutions they can reach, and how early those conditions start shaping outcomes.",
        "Neighborhood, school, credit, and mobility research shows that similar formal rights can sit on top of very different practical starting points.",
        "Outcome gaps do not automatically prove unequal opportunity, but they are a reason to inspect access and starting conditions.",
        "A serious equal-opportunity claim needs evidence about entry conditions, not only slogans about fairness.",
      ],
      bottomLine:
        "Equal rules on paper do not prove equal chance in practice.",
      responseScript:
        "The better test is not whether a rule sounds neutral. It is whether people can actually reach comparable schools, safety, credit, work, and mobility channels from similar starting points.",
      responseContext:
        "Use when equal opportunity is reduced to a legal checkbox.",
    },
    questions: [
      "What does the argument mean by opportunity: legal permission, practical access, or both?",
      "What starting conditions shape the ability to use the opportunity in question?",
      "What data show whether access is actually comparable across groups or places?",
    ],
    sourceContexts: [
      {
        title: "Opportunity Atlas Data Tool",
        sourceType: "primary-data",
        sourceNote:
          "Census public data tool showing how adult outcomes vary by race, parental income, sex, and childhood place.",
      },
      {
        title:
          "Race and Economic Opportunity in the United States: An Intergenerational Perspective",
        sourceType: "academic",
        sourceNote:
          "Large-scale mobility research showing that equal parent income does not erase racial differences in adult outcomes.",
      },
      {
        title:
          "The Impacts of Neighborhoods on Intergenerational Mobility I: Childhood Exposure Effects",
        sourceType: "academic",
        sourceNote:
          "Research demonstrating that where children grow up affects later earnings and educational outcomes.",
      },
      {
        title:
          "The Opportunity Atlas: Mapping the Childhood Roots of Social Mobility",
        sourceType: "academic",
        sourceNote:
          "Research underlying the tract-level mobility map, useful for explaining why access to place-based opportunity matters.",
      },
    ],
    argumentMode: {
      summary:
        "Formal eligibility is not the same thing as equal opportunity. Opportunity depends on whether people can actually reach comparable schools, safety, credit, housing, and mobility channels from similar starting positions, though that still does not mean every outcome gap proves unequal opportunity by itself.",
      quickResponse:
        "Equal rules are not enough if access is unequal. Opportunity starts before the application form.",
      discussionResponse:
        "People often define equal opportunity as the absence of an explicit legal barrier, but that is only the thinnest version of the concept. Practical opportunity also depends on place, school quality, wealth buffers, transportation, safety, and access to institutions that convert effort into earnings and stability. That is why equal wording on paper is not the end of the inquiry.",
      debateResponse:
        "Claim: Everyone is allowed to compete now, so opportunity is equal.\n\nEvidence: Mobility research shows that childhood place, neighborhood conditions, and institutional access strongly shape later outcomes even when formal rights look the same.\n\nLimit: This does not make every outcome gap proof of unequal opportunity; it means the opportunity claim needs evidence about access and starting conditions.",
      keyPoints: [
        "Opportunity is about usable access, not just abstract permission.",
        "Eligibility is not the same thing as reach.",
        "Starting conditions shape the odds before performance is measured.",
        "Place matters because institutions are not evenly distributed.",
        "A few high performers do not settle a population-level access question.",
        "Outcome gaps invite investigation; they do not settle causation by themselves.",
      ],
      commonClaims: [
        {
          claim:
            "Everyone can apply now, so the opportunity issue is over.",
          response:
            "Application access is only one checkpoint. Opportunity also depends on whether people can reach comparable schools, transportation, neighborhoods, networks, and financial cushions before the application even happens.",
          question:
            "What evidence shows that the path into the opportunity is equally reachable, not just formally open?",
        },
        {
          claim:
            "Any outcome gap just proves some groups worked harder than others.",
          response:
            "That jumps from results to character without checking access. A serious equal-opportunity argument first asks whether the starting conditions and institutional channels were comparable.",
          question:
            "What evidence rules out differences in starting position, neighborhood, school quality, or access to capital?",
        },
        {
          claim:
            "Equal opportunity only means no explicit discrimination in the rules.",
          response:
            "That is a minimal legal definition, not the full practical one. Opportunity in real life also depends on who can use the rule, where they start, and what institutions are available to them.",
          question:
            "Are you defining opportunity as formal permission only, or as an actual chance to use it?",
        },
        {
          claim:
            "A few people made it, so opportunity must already be equal.",
          response:
            "Individual success can be real without proving population-wide access. The right comparison is not whether success exists, but how consistently different groups can reach it from similar starting points.",
          question:
            "Are you using visible exceptions to avoid the broader access pattern?",
        },
        {
          claim:
            "Government cannot create opportunity; people do that themselves.",
          response:
            "People act inside institutions. Schools, roads, zoning, credit access, labor protections, and safety conditions all affect whether personal effort can turn into stable gains.",
          question:
            "What evidence shows effort converts into results the same way when institutional access is unequal?",
        },
      ],
      debateLines: [
        "Permission is not access.",
        "Opportunity begins before outcomes are measured.",
        "A neutral rule can sit on top of unequal starting points.",
        "Visible success is not the same as broad reach.",
        "If you want to claim equal opportunity, show equal access to the channels that matter.",
      ],
      shareCards: [
        {
          title: "Open door, unequal path",
          text:
            "A door being unlocked does not prove everyone can reach it from the same distance, with the same support, or at the same cost.",
          context:
            "Use when formal eligibility is treated as the whole opportunity story.",
        },
        {
          title: "Opportunity starts early",
          text:
            "School quality, neighborhood conditions, safety, and wealth buffers shape opportunity long before adult outcomes show up in the data.",
          context:
            "Use when people pretend opportunity begins at the moment of hiring or college admission.",
        },
        {
          title: "Access before merit",
          text:
            "Before arguing about who used an opportunity well, ask who could actually reach it on comparable terms.",
          context:
            "Use when debates skip straight from outcomes to moral judgment.",
        },
        {
          title: "One winner proves little",
          text:
            "A success story can be true and still tell you almost nothing about how opportunity is distributed across a population.",
          context:
            "Use when exceptions are used as proof of equality.",
        },
      ],
    },
    structuredSections: [
      {
        title: "Historical framing",
        body:
          "Equal opportunity has never meant only one thing. In law, it can mean formal access without explicit exclusion. In policy and social analysis, it usually means something thicker: whether people can actually use schools, neighborhoods, labor markets, housing, and institutions in ways that make upward mobility realistic.",
      },
      {
        title: "Claim or misconception",
        body:
          "Common claim: equal opportunity already exists because the rules are the same for everyone.\n\nThat conclusion skips the question of access. Equal wording does not tell you whether people start from comparable positions or can use the same institutions with similar chances of success.",
      },
      {
        title: "What the concept actually means",
        body:
          "Equal opportunity is best understood as a combination of formal eligibility and practical reach. It asks whether people can access the same developmental conditions and institutional pathways before outcomes are measured.\n\nThat includes schools, neighborhoods, transportation, safety, credit, labor-market entry, and the ability to absorb setbacks.",
      },
      {
        title: "Where the claim goes wrong",
        body:
          "The claim goes wrong by treating equal rules as the whole analysis. If some groups are much more likely to encounter weaker schools, unstable housing, overexposure to risk, thin wealth buffers, or limited credit, then equal permission does not translate into equal chance.\n\nThe opposite mistake is also common: assuming every outcome gap automatically proves unequal opportunity. Evidence still has to identify the access channel.",
      },
      {
        title: "What the concept does not prove",
        body:
          "Unequal opportunity does not mean effort is irrelevant. It does not mean every institution is closed in the same way everywhere. It does not mean outcomes must become identical for opportunity to be more equal.\n\nLikewise, formal equality of rules does not prove that access barriers disappeared.",
      },
      {
        title: "Scale vs interpretation",
        body:
          "At individual scale, one person can overcome a barrier or make poor choices despite strong access. At population scale, repeated differences in mobility, income, schooling, incarceration, or neighborhood outcomes can indicate unequal opportunity structures.\n\nInterpretation requires matching the claim to the evidence. One biography cannot settle a tract-level or national opportunity question.",
      },
      {
        title: "Stronger way to analyze the issue",
        body:
          "Instead of asking whether a rule sounds fair, ask whether people can actually use the opportunity under similar conditions. Compare access to schools, safety, transportation, wealth buffers, credit, and neighborhood effects. Then ask whether outcome gaps shrink when those access differences narrow.\n\nThat is a stronger test than relying on slogans about merit or fairness.",
      },
      {
        title: "EquityStack takeaway",
        body:
          "Equal opportunity is an access question before it is a morality tale. A serious argument has to examine the route into the opportunity, not only whether the formal sign on the door says everyone may enter.",
      },
      {
        title: "How to respond in a debate",
        body:
          "Common claim: Everyone has the same chance now because the rule is the same for everyone.\n\nBetter response: The rule is only one layer. Opportunity also depends on schools, neighborhoods, safety, credit, wealth buffers, and whether people can reach the institution in comparable ways.\n\nKey question: What evidence shows equal access, not just equal wording?\n\nCommon claim: Outcome gaps prove some groups simply did not try.\n\nBetter response: That assumes the opportunity path was comparable before the result appeared. A stronger analysis checks the starting conditions first.\n\nKey question: What access differences have been ruled out before you jump to a character explanation?",
      },
    ],
  },
  "states-rights-vs-civil-rights-claims": {
    category: "argument-mechanics",
    tags: [
      "states-rights",
      "civil-rights",
      "federalism",
      "voting-rights",
      "equal-protection",
      "enforcement",
    ],
    relatedExplainers: [
      "equal-protection-under-the-law",
      "party-voting-records-racial-policy",
      "party-switch-southern-strategy",
      "disparate-impact-vs-intent-claims",
    ],
    relatedPolicies: [
      "5-civil-rights-act-of-1964",
      "6-voting-rights-act-of-1965",
      "7-fair-housing-act-of-1968",
      "8-voting-rights-act-reauthorization-of-2006",
    ],
    lens: "Federalism and rights guide",
    pagePurpose:
      "Use this page when someone invokes states' rights as if it answers the civil-rights question by itself, or when a debate needs a cleaner explanation of why federal enforcement has repeatedly mattered.",
    whyThisMatters:
      "States' rights is a power-allocation principle, not a moral verdict. In civil-rights history, the real issue has often been whether state authority was being used to deny or dilute rights that the federal government later had to enforce.",
    argumentReady: {
      claim:
        "Civil-rights questions should always be left to the states.",
      whyMisleading:
        "That treats federalism as if it automatically settles the rights issue. The historical record shows that federal intervention was repeatedly used when states maintained segregation, blocked voting access, or failed to protect equal citizenship.",
      dataShows: [
        "States' rights describes who decides, not whether the resulting policy protects rights fairly.",
        "Brown, the Civil Rights Act, and the Voting Rights Act all reflect moments when federal action was used because state systems were denying or failing to secure basic rights.",
        "Civil-rights enforcement often becomes a federal question when state power is used to restrict equal protection, schooling, voting, or public access.",
        "That history does not make every state policy suspect, but it does make the phrase states' rights historically incomplete on its own.",
      ],
      bottomLine:
        "The better question is not state power versus federal power in the abstract. It is which level of government is actually protecting the right at stake.",
      responseScript:
        "States' rights tells you where authority sits, not whether a right is being honored. In civil-rights history, federal intervention mattered because many states were the ones enforcing exclusion.",
      responseContext:
        "Use when local control is treated as a complete answer to rights disputes.",
    },
    questions: [
      "What right is being discussed, and which level of government is protecting or restricting it?",
      "Is the argument about ordinary policy variation, or about denial of equal citizenship and access?",
      "What does the historical record show about state enforcement failures in this area?",
    ],
    sourceContexts: [
      {
        title: "14th Amendment to the U.S. Constitution: Civil Rights (1868)",
        sourceType: "government",
        sourceNote:
          "National Archives record establishing the constitutional backdrop for federal protection of equal citizenship and state obligations.",
      },
      {
        title: "Brown v. Board of Education of Topeka (1) (1954)",
        sourceType: "legal",
        sourceNote:
          "Supreme Court decision showing federal constitutional intervention against state-enforced school segregation.",
      },
      {
        title: "Civil Rights Act (1964)",
        sourceType: "government",
        sourceNote:
          "National Archives source on the major federal civil-rights statute enacted after prolonged state and local resistance.",
      },
      {
        title: "Voting Rights Act (1965)",
        sourceType: "government",
        sourceNote:
          "National Archives source documenting federal intervention against discriminatory state voting practices.",
      },
      {
        title: "Shelby County v. Holder (2013)",
        sourceType: "legal",
        sourceNote:
          "Supreme Court decision central to debates about whether federal voting-rights oversight remained justified.",
      },
    ],
    argumentMode: {
      summary:
        "States' rights and civil rights are not the same value. When a state uses its power to deny equal protection, school access, or voting access, the civil-rights question becomes whether federal enforcement is needed, though that history still does not make every state policy dispute a civil-rights violation.",
      quickResponse:
        "States' rights answers who governs, not whether the right is protected. In civil-rights history, the state was often the problem the federal government had to confront.",
      discussionResponse:
        "Federalism matters, but it does not answer the justice question by itself. In ordinary policy areas, state variation may be routine. In civil-rights history, however, federal intervention repeatedly came after states used their own power to maintain exclusion or underenforce rights, which is why this debate cannot be reduced to local control versus Washington control.",
      debateResponse:
        "Claim: States should decide civil-rights questions for themselves.\n\nEvidence: The historical record of segregation and voting restrictions shows why federal power was used when state authority was being used to deny equal citizenship and access.\n\nLimit: This does not mean every state-federal disagreement is the same as Jim Crow; it means the rights question cannot be answered by invoking states' rights alone.",
      keyPoints: [
        "Federalism allocates power. It does not certify fairness.",
        "In civil-rights history, the state was often the gatekeeper of exclusion.",
        "Federal intervention usually entered after local enforcement failed.",
        "Brown, the Civil Rights Act, and the Voting Rights Act were not abstract theory fights.",
        "States' rights rhetoric does not prove motive either way.",
        "The real test is which level of government is protecting the right in practice.",
      ],
      commonClaims: [
        {
          claim:
            "States' rights is constitutional, so federal civil-rights action is overreach.",
          response:
            "Constitutional structure still includes federal guarantees and federal enforcement powers. The issue is not whether states have authority in general, but whether that authority is being used in a way that violates or undercuts protected rights.",
          question:
            "What right is the state protecting here, and what right is it restricting or failing to secure?",
        },
        {
          claim:
            "If voters in a state choose a policy, that is just democracy.",
          response:
            "Majority rule is not the only constitutional value. Civil-rights law exists in part because state majorities have repeatedly supported exclusions that violated equal citizenship and access.",
          question:
            "Does democratic choice alone settle whether a right is being denied?",
        },
        {
          claim:
            "Brown and the Civil Rights Act were just Washington interfering with local control.",
          response:
            "That framing erases what local control was enforcing. Federal action mattered because state and local systems were maintaining segregation and unequal access rather than protecting the right neutrally.",
          question:
            "Local control over what, exactly: neutral administration or state-backed exclusion?",
        },
        {
          claim:
            "Shelby County proved federal oversight was no longer needed.",
          response:
            "Shelby changed the coverage formula question; it did not prove voting-rights problems had vanished. The continuing debate is about whether federal protection remains necessary when state-level voting restrictions still generate conflict.",
          question:
            "What evidence shows the underlying voting-rights risk disappeared rather than the oversight formula changing?",
        },
        {
          claim:
            "Bringing up states' rights history is just calling everyone racist.",
          response:
            "No. The historical point is about how power was used, not a universal claim about personal motive. A phrase can have a documented policy history without becoming an automatic verdict on every speaker.",
          question:
            "Can we discuss the record of state action without pretending that historical context is a personal accusation?",
        },
      ],
      debateLines: [
        "Who decides is not the same question as who is protected.",
        "Local control is not neutral when local power is enforcing exclusion.",
        "The Constitution protects rights against states too.",
        "States' rights becomes a civil-rights issue when the state is denying the right.",
        "Do not let a power slogan replace the rights analysis.",
      ],
      shareCards: [
        {
          title: "Power is not a verdict",
          text:
            "States' rights tells you where authority sits. It does not tell you whether the policy protects equal citizenship.",
          context:
            "Use when federalism language is used as if it answers the whole dispute.",
        },
        {
          title: "Rights versus rulers",
          text:
            "The key civil-rights question is not which government gets to act first. It is which government is actually defending the right.",
          context:
            "Use when the debate gets trapped in abstract power talk.",
        },
        {
          title: "History narrowed the phrase",
          text:
            "In U.S. civil-rights history, states' rights often appeared when states wanted room to keep people out of equal access.",
          context:
            "Use when someone pretends the phrase carries no historical context at all.",
        },
        {
          title: "Federal action had a target",
          text:
            "Brown, the Civil Rights Act, and the Voting Rights Act were responses to concrete state failures, not just philosophical dislike of local control.",
          context:
            "Use when federal intervention is framed as random intrusion.",
        },
      ],
    },
    structuredSections: [
      {
        title: "Historical framing",
        body:
          "American civil-rights history repeatedly turned on a federalism conflict: whether states could define citizenship, schooling, voting access, and public accommodation on unequal terms, or whether federal power would step in to enforce constitutional and statutory rights more broadly.",
      },
      {
        title: "Claim or misconception",
        body:
          "Common claim: civil-rights issues should simply be left to the states.\n\nThat argument skips the core question. If the state is the level of government restricting or underenforcing the right, then appealing to state authority does not resolve the rights problem. It restates where the conflict is happening.",
      },
      {
        title: "What the concept actually means",
        body:
          "States' rights is a principle about the allocation of governmental authority. Civil rights are protections for equal citizenship, equal access, and equal treatment under law. They intersect when state authority is used in ways that burden or deny those protections.\n\nThe concepts are related, but they are not interchangeable.",
      },
      {
        title: "Where the claim goes wrong",
        body:
          "The claim goes wrong by treating a power arrangement as a substantive answer. In many of the most important civil-rights conflicts, the debate was not over whether states had any powers at all. It was over whether state power was being used to maintain segregation, suppress voting, or deny equal access.\n\nThe phrase becomes misleading when it hides the policy result behind the institutional label.",
      },
      {
        title: "What the concept does not prove",
        body:
          "Invoking states' rights does not automatically prove racist intent, and federal intervention does not automatically prove perfect policy. Not every disagreement between Washington and the states is a civil-rights emergency.\n\nBut neither does state authority prove the policy is fair. The rights question still has to be answered on its own terms.",
      },
      {
        title: "Scale vs interpretation",
        body:
          "At national scale, constitutional amendments and federal statutes define baseline protections. At state and local scale, institutions administer schools, elections, policing, and access rules. Civil-rights conflict intensifies when local administration departs from national rights guarantees.\n\nInterpretation therefore depends on matching the level of government to the right being contested.",
      },
      {
        title: "Stronger way to analyze the issue",
        body:
          "A stronger analysis asks which right is at stake, which level of government is burdening or protecting it, and what enforcement mechanism exists when the lower level fails. That is more useful than treating states' rights as an all-purpose trump card.\n\nIt also keeps the discussion bounded: not every policy dispute is the same, but civil-rights history shows why some disputes do require federal force.",
      },
      {
        title: "EquityStack takeaway",
        body:
          "States' rights is a structural concept. Civil rights are a protection concept. When the two collide, the better question is not which slogan sounds more constitutional. It is whether the right can actually be exercised without federal intervention.",
      },
      {
        title: "How to respond in a debate",
        body:
          "Common claim: This should be left to the states.\n\nBetter response: That only answers who governs, not whether the right is being protected. In civil-rights history, federal action repeatedly mattered because states were often the institutions denying or diluting the right.\n\nKey question: Which right is the state protecting here, and which right is it burdening?\n\nCommon claim: Federal intervention is always overreach.\n\nBetter response: Sometimes it is ordinary policy conflict, but Brown, the Civil Rights Act, and the Voting Rights Act show why federal enforcement has been used when state systems failed to protect equal citizenship.\n\nKey question: What evidence shows the state can be trusted to protect this right without federal backstop?",
      },
    ],
  },
  "anecdote-vs-data-claims": {
    category: "argument-mechanics",
    tags: [
      "anecdotes",
      "data-literacy",
      "selection-bias",
      "representativeness",
      "survivorship-bias",
      "evidence-standards",
    ],
    relatedExplainers: [
      "crime-statistics-context-and-misuse",
      "non-citizen-voting-claims",
      "understanding-13-50-crime-statistic",
      "immigration-comparison-claims",
    ],
    relatedPolicies: [
      "6-voting-rights-act-of-1965",
      "54-violent-crime-control-and-law-enforcement-act-of-1994",
    ],
    lens: "Evidence quality guide",
    pagePurpose:
      "Use this page when a debate leans on one vivid story as if it settles a population-level policy question, or when someone treats statistics as cold while giving anecdotes more weight than they can bear.",
    whyThisMatters:
      "Stories are powerful because they are memorable. That is exactly why they can mislead when the claim is about frequency, scale, cause, or typicality. This explainer shows where anecdotes help and where only broader data can do the job.",
    argumentReady: {
      claim:
        "A personal story is enough to prove the policy picture.",
      whyMisleading:
        "Stories can show that something happened, but they cannot tell you by themselves how often it happens, whether it is typical, what comparison group matters, or whether the case generalizes beyond the people you happened to notice.",
      dataShows: [
        "Anecdotes are strongest as leads, examples, or human context, not as population totals.",
        "Representative data are needed when the claim is about rates, scale, trends, or causal comparison.",
        "Selection bias and survivorship bias can make visible stories look more common or more persuasive than they really are.",
        "Statistics also need scrutiny, which is why source quality, sampling, and measurement matter.",
      ],
      bottomLine:
        "Stories can start an investigation, but they cannot finish a population argument on their own.",
      responseScript:
        "That experience may be real, but a policy claim needs more than one example. We still need evidence about how common the pattern is, who it affects, and whether the case is representative.",
      responseContext:
        "Use when a vivid example is being treated as a complete proof.",
    },
    questions: [
      "Is the claim about one experience, or about how common something is across a population?",
      "What evidence shows the anecdote is typical rather than exceptional?",
      "How was the broader data collected, and who might be missing from it?",
    ],
    sourceContexts: [
      {
        title:
          "Understanding and Using American Community Survey Data: What All Data Users Need to Know",
        sourceType: "government",
        sourceNote:
          "Census guide to how population estimates are produced and why users need to understand survey design and interpretation.",
      },
      {
        title: "Reference Guide on Survey Research",
        sourceType: "legal",
        sourceNote:
          "Scientific-evidence guide explaining population definition, sampling, nonresponse, and why surveys are judged by representativeness rather than vividness.",
      },
      {
        title: "Reference Guide on Statistics and Research Methods",
        sourceType: "legal",
        sourceNote:
          "Scientific-evidence guide on sampling, selection bias, generalization, and the limits of inference from weak data.",
      },
      {
        title: "NIST/SEMATECH e-Handbook of Statistical Methods",
        sourceType: "government",
        sourceNote:
          "Government statistical handbook covering core methods used to think clearly about samples, distributions, and inference.",
      },
    ],
    argumentMode: {
      summary:
        "Anecdotes can reveal a problem, but they cannot measure its size or typicality. Policy claims need broader evidence to show how often something happens, to whom, and under what conditions, though weak statistics can mislead too if the sample or comparison is wrong.",
      quickResponse:
        "A vivid story is not a rate. It can show that something happened, not how common it is.",
      discussionResponse:
        "Personal stories are useful because they show lived experience and can surface problems official systems overlook. But when the argument is about policy, scale, or trend, we need data that can tell us whether the story is typical, how often the pattern appears, and what population it represents. That is the difference between illustration and measurement.",
      debateResponse:
        "Claim: One or two stories prove the broader policy claim.\n\nEvidence: Population claims require representative evidence about frequency, comparison groups, and who is included or excluded from the sample.\n\nLimit: Statistics are not magic either; they still have to be well collected and interpreted, and lived experience can still point to a real problem worth measuring.",
      keyPoints: [
        "Anecdotes show existence, not prevalence.",
        "A memorable case is not the same thing as a representative case.",
        "Selection bias favors the stories you happen to hear.",
        "Survivorship bias overweights the cases that remain visible.",
        "Population claims need population evidence.",
        "Bad data can mislead too, which is why method still matters.",
      ],
      commonClaims: [
        {
          claim:
            "I know someone this happened to, so the policy definitely works that way.",
          response:
            "That example may matter, but it still does not tell you whether the case is rare, common, increasing, or unusual compared with the broader population.",
          question:
            "What evidence shows the story is representative rather than exceptional?",
        },
        {
          claim:
            "You cannot tell me my experience is wrong.",
          response:
            "A person's experience can be fully real without being population proof. The issue is not whether the story happened. It is what claim the story can support.",
          question:
            "Are we debating the reality of the experience, or the size and typicality of the broader pattern?",
        },
        {
          claim:
            "Statistics hide what really happens to real people.",
          response:
            "Statistics are one of the few tools that can test whether a story is common, rare, changing, or concentrated in certain groups. The better move is to pair human context with good measurement.",
          question:
            "How else would you estimate frequency or trend without broader data?",
        },
        {
          claim:
            "One counterexample disproves the whole trend.",
          response:
            "A counterexample only shows the pattern is not universal. It does not tell you whether the larger distribution still exists.",
          question:
            "Does the example change the rate, or only show that exceptions exist?",
        },
        {
          claim:
            "If data conflict with lived experience, the data must be fake.",
          response:
            "Sometimes data are weak, but sometimes personal networks are unrepresentative. The right response is to inspect the sample, measurement, and comparison group rather than declaring one side automatically false.",
          question:
            "What specifically is wrong with the data collection or interpretation?",
        },
      ],
      debateLines: [
        "A story can prove an event. It cannot prove a rate.",
        "Illustration is not measurement.",
        "The loudest example is not always the typical one.",
        "Counterexamples limit a claim; they do not erase a distribution.",
        "If the claim is about a population, the evidence has to reach the population.",
      ],
      shareCards: [
        {
          title: "Story versus scale",
          text:
            "Anecdotes answer what happened to someone. Data answer how often it happens and whether the case is typical.",
          context:
            "Use when a conversation jumps from one story to a big policy conclusion.",
        },
        {
          title: "Visible is not typical",
          text:
            "The cases you hear about most are often the ones most likely to be noticed, remembered, or shared.",
          context:
            "Use when vivid examples are treated as a random sample.",
        },
        {
          title: "Experience is not being denied",
          text:
            "Saying a story is not population proof is not the same as saying the story did not happen.",
          context:
            "Use when someone hears a request for data as a denial of lived experience.",
        },
        {
          title: "Measure before you generalize",
          text:
            "Before turning a story into a policy claim, ask how common the pattern is and who is missing from the sample you are relying on.",
          context:
            "Use when a policy debate runs on examples alone.",
        },
      ],
    },
    structuredSections: [
      {
        title: "Historical framing",
        body:
          "Public debate has always been shaped by stories. Before large datasets, anecdotes often carried most of the persuasive force. Modern policy arguments still rely on them because stories are emotionally compelling, easy to repeat, and easy to remember. That makes them useful, but it also makes them easy to overuse.",
      },
      {
        title: "Claim or misconception",
        body:
          "Common claim: one personal story proves the larger policy truth.\n\nA story can show that an event happened. It cannot by itself show how common the event is, whether it is rising or falling, whether it is typical, or what comparison should matter.",
      },
      {
        title: "What the concept actually means",
        body:
          "Anecdotal evidence is individual or small-scale experience used to support a broader claim. Statistical evidence uses a defined population, sample, or dataset to estimate how often something happens and under what conditions.\n\nThe two can work together. Anecdotes humanize and surface problems; data test whether the problem generalizes.",
      },
      {
        title: "Where the claim goes wrong",
        body:
          "The claim goes wrong when illustration is treated as measurement. Personal networks are not random samples. Newsworthy cases are not representative by default. Survivorship bias can make the visible cases look normal even when many unseen cases point the other way.\n\nThe reverse mistake is also weak: pretending numbers alone are enough without checking whether the dataset is measuring the right thing.",
      },
      {
        title: "What the concept does not prove",
        body:
          "Good data do not erase lived experience. A low measured rate does not mean no one was harmed. An anecdote can reveal a real problem that broader systems have not counted well yet.\n\nAt the same time, a true story does not automatically justify a general policy conclusion.",
      },
      {
        title: "Scale vs interpretation",
        body:
          "At individual scale, a story may be the best evidence that an event occurred to a person. At population scale, the same story tells you little about prevalence, comparison, or trend unless it is placed inside a broader dataset.\n\nInterpretation should expand with the claim. The larger the claim, the broader the evidence needs to be.",
      },
      {
        title: "Stronger way to analyze the issue",
        body:
          "Use stories as prompts, not totals. Ask what broader data exist, how the sample was collected, what population it represents, and whether important cases are being missed. If the data are weak, say so clearly. If the anecdote is powerful, use it to motivate better measurement rather than to skip measurement entirely.",
      },
      {
        title: "EquityStack takeaway",
        body:
          "Anecdotes matter most when they are paired with evidence that can test generalization. The strongest debate move is not story versus data. It is story plus measurement, with each doing the job it can actually do.",
      },
      {
        title: "How to respond in a debate",
        body:
          "Common claim: I know someone this happened to, so the policy obviously works that way.\n\nBetter response: That story may be real and important, but it still does not tell us how common the pattern is or whether the case is representative.\n\nKey question: What broader evidence shows the story reflects the larger population?\n\nCommon claim: Asking for data means dismissing lived experience.\n\nBetter response: No. It means separating whether the event happened from how far the event generalizes. We need both human context and population evidence.\n\nKey question: Are we trying to verify the story, or trying to estimate the size of the larger pattern?",
      },
    ],
  },
};

const CATEGORY_FALLBACKS = {
  default: {
    lens: "Historical explainer",
    pagePurpose:
      "Use this page to answer a public claim or historical debate directly, then connect that answer to the policy record, related promises, and the broader EquityStack research graph when deeper verification is useful.",
    whyThisMatters:
      "The strongest explainers answer the core question on-page first, then help readers verify or deepen that answer through presidents, policies, reports, and source-backed detail.",
    questions: [],
    researchPaths: [],
  },
};

export function getExplainerEditorial(slug) {
  return EXPLAINER_EDITORIAL[slug] || CATEGORY_FALLBACKS.default;
}
