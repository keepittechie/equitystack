START TRANSACTION;

INSERT INTO explainers (
  slug,
  title,
  category,
  summary,
  key_takeaways,
  intro_text,
  why_it_matters,
  common_claim,
  what_actually_happened,
  timeline_events,
  key_policies_text,
  why_it_still_matters,
  sources_note,
  published
) VALUES (
  'hiring-discrimination-and-anti-dei-rollbacks',
  'What Hiring Discrimination Research Says About Anti-DEI Rollbacks',
  'Labor and Employment',
  'A research-grounded explainer on persistent hiring discrimination, what that evidence can support, and why anti-DEI rollback policy may matter for Black workers even when direct downstream-effect estimates are still incomplete.',
  'Modern audit and correspondence studies continue to find measurable racial discrimination in hiring, including among large U.S. employers.
That literature is baseline evidence that the underlying problem DEI and anti-discrimination systems claim to address has not disappeared.
The studies cited here support a risk argument about anti-DEI rollbacks, not a complete causal estimate of any single Trump policy''s downstream labor-market effect.
Stronger causal claims require policy-specific evidence about enforcement, compliance behavior, grant changes, contracting rules, employer responses, or access to remedies after the rollback.',
  'The January 20, 2025 Trump order on federal DEI and equity structures raised a basic evidence question: if government dismantles DEI offices, equity plans, and related administrative structures, what problem is it assuming has already been solved or no longer deserves targeted attention?

This explainer does not claim that one order instantly produced a measured national employment effect for Black workers. The stronger and more defensible use of the evidence is narrower. It asks whether the labor market already shows meaningful signs of persistent discrimination, and whether that makes anti-DEI rollback policy potentially consequential rather than symbolic.',
  'This topic matters because policy arguments against DEI often presume that hiring discrimination is exaggerated, outdated, or better understood as a solved legal problem. The research reviewed here cuts against that assumption. Multiple audit and correspondence studies continue to find race-linked callback gaps in modern hiring, including at scale and across major employers.

That does not by itself prove that every DEI initiative is effective or that every rollback causes harm. It does mean that anti-DEI policy is being made in a labor market where unequal access remains measurable. In that setting, reducing oversight, compliance capacity, structured review, or equity-focused intervention can plausibly increase risk for Black applicants rather than merely eliminating unnecessary bureaucracy.',
  'Ending DEI mostly removes ideological bureaucracy because hiring discrimination is no longer a serious structural barrier for Black workers.

Under this view, anti-DEI rollback has little practical downside for Black employment opportunity because modern labor markets already sort on merit and existing civil-rights law is enough on its own.',
  'The hiring-discrimination literature does not support the claim that the problem is over. The 2003 Bertrand-Mullainathan resume audit found substantially higher callback rates for white-sounding names than for otherwise similar African-American-sounding names. Later large-scale work by Kline, Rose, and Walters found that distinctively Black names still reduced employer contact rates and that discrimination was concentrated among a subset of large employers rather than disappearing across the board.

More recent work extends the picture rather than overturning it. The 2024 report-card paper focuses on how to rank and disclose employer-level contact gaps. The 2026 Braun et al. preprint argues that discrimination can widen in jobs with greater evaluative discretion, especially where hiring relies more heavily on subjective assessment. Taken together, these studies support a careful baseline conclusion: measurable hiring disparities remain real enough that institutions built to detect or mitigate them cannot be dismissed as addressing a solved problem.',
  '2003 | Bertrand and Mullainathan publish the landmark resume-audit study finding large callback gaps tied to racialized names.
2021-2022 | Kline, Rose, and Walters report large-scale evidence of systemic discrimination among major U.S. employers.
2024 | Kline, Rose, and Walters publish a report-card framework for grading employer-level race and gender contact gaps.
2025-01-20 | The Trump administration orders agencies to terminate federal DEI, DEIA, environmental justice, and equity-related offices, plans, grants, and policies to the maximum extent allowed by law.
2026 | Braun and coauthors release a preprint arguing that hiring discrimination widens in higher-discretion job contexts.',
  'The most immediate policy anchor is the Trump administration''s January 20, 2025 order titled "Ending Radical And Wasteful Government DEI Programs And Preferencing," which directed agencies to terminate DEI, DEIA, environmental justice, and equity-related structures across the executive branch.

This explainer should also be read against the older anti-discrimination framework that DEI debates sit on top of, including Title VII employment protections, EEOC enforcement, and equal-opportunity compliance systems for federal institutions and contractors. The relevant question is not whether DEI is identical to civil-rights law. It is whether removing equity-focused administrative capacity in a labor market with documented discrimination raises the chance that harms go less measured, less challenged, or less remedied.',
  'If hiring discrimination remains measurable, then anti-DEI rollback cannot be defended simply by asserting that the market already works fairly. A stronger defense would need to show either that the targeted DEI structures were ineffective, that alternative enforcement mechanisms fully substitute for them, or that employer behavior and Black employment outcomes did not worsen after the rollback.

Some implementation evidence now exists even if final downstream labor-market estimates remain incomplete. OPM directed agencies to close DEIA offices, place DEIA staff on paid administrative leave, terminate DEIA-related contractors, and prepare reduction-in-force plans. The Labor Department stopped EO 11246 enforcement activity and OFCCP directed contractors to wind down the old affirmative-action compliance regime. The Department of Education separately reported DEI office dissolutions, contract cancellations, grant terminations, and a new anti-DEI complaint portal. DOJ and EEOC also issued guidance reframing DEI-related practices as potential civil-rights violations.

The most concrete Black-impact channels in the current official record run through institutions that explicitly handled race-related inequities. The Department of Education cancelled grants to Equity Assistance Centers even though the Department''s own program page describes those centers as Title IV civil-rights technical-assistance providers for school desegregation, race-related disparities, bullying, prejudice reduction, and support to districts navigating civil-rights conflicts. On the labor side, the rollback shut down the EO 11246 contractor-enforcement pathway even though OFCCP used that same authority in recent years to secure back pay and job offers for Black applicants in specific hiring-discrimination cases.

Until fuller outcome evidence is assembled, the most supportable conclusion is a conditional one: dismantling equity-focused federal structures may matter because they were operating in an environment where unequal treatment had not disappeared and because some of the dismantled channels were directly tied to race-discrimination enforcement or desegregation support. That makes the rollback a live public-interest question, especially for Black workers, students, and communities affected by employment, contracting, education, and service-access disparities.',
  'The source base here mixes foundational academic studies, later large-scale audit research, one methodological follow-up paper, a recent preprint, and the Trump administration''s own policy text. It now also includes primary implementation documents from OPM, DOL, DOJ, EEOC, and the Department of Education. Some links are summaries and some are primary academic records.

Use the 2003 AEA paper and the 2021-2022 NBER working paper as the strongest baseline evidence. Use the 2024 report-card paper for employer-level accountability framing. Use the 2026 arXiv paper as newer but still provisional evidence because it is a preprint. Use the White House order, OPM memos, DOL enforcement documents, DOJ/EEOC guidance, and Department of Education press releases as the primary record of what agencies were directed to do and what some agencies actually did. For Black-impact-specific channels, pay special attention to the Equity Assistance Center program page and to OFCCP case examples involving African American or Black applicants because those sources show what kinds of race-related support or remedies the rollback is cutting back from.',
  1
)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  category = VALUES(category),
  summary = VALUES(summary),
  key_takeaways = VALUES(key_takeaways),
  intro_text = VALUES(intro_text),
  why_it_matters = VALUES(why_it_matters),
  common_claim = VALUES(common_claim),
  what_actually_happened = VALUES(what_actually_happened),
  timeline_events = VALUES(timeline_events),
  key_policies_text = VALUES(key_policies_text),
  why_it_still_matters = VALUES(why_it_still_matters),
  sources_note = VALUES(sources_note),
  published = VALUES(published);

SET @hiring_discrimination_anti_dei_explainer_id := (
  SELECT id
  FROM explainers
  WHERE slug = 'hiring-discrimination-and-anti-dei-rollbacks'
  LIMIT 1
);

DELETE FROM explainer_sources
WHERE explainer_id = @hiring_discrimination_anti_dei_explainer_id
  AND source_url IN (
    'https://www.whitehouse.gov/presidential-actions/2025/01/ending-radical-and-wasteful-government-dei-programs-and-preferencing/',
    'https://www.nber.org/digest/sep03/employers-replies-racial-names',
    'https://www.aeaweb.org/articles?id=10.1257/0002828042002561',
    'https://ls.berkeley.edu/news/berkeley-economists-among-group-researchers-found-bias-against-black-job-applicants',
    'https://bfi.uchicago.edu/insight/research-summary/a-discrimination-report-card/',
    'https://www.nber.org/papers/w29053',
    'https://arxiv.org/abs/2604.01933',
    'https://www.opm.gov/media/e1zj1p0m/opm-memo-re-initial-guidance-regarding-deia-executive-orders-1-21-2025-final.pdf',
    'https://www.opm.gov/policy-data-oversight/latest-memos/guidance-regarding-rifs-of-deia-offices.pdf',
    'https://www.opm.gov/chcoc/latest-memos/further-guidance-deia.pdf',
    'https://www.dol.gov/newsroom/releases/osec/osec20250124',
    'https://www.dol.gov/agencies/ofccp',
    'https://www.justice.gov/opa/pr/eeoc-and-justice-department-warn-against-unlawful-dei-related-discrimination',
    'https://www.justice.gov/opa/pr/justice-department-releases-guidance-recipients-federal-funding-regarding-unlawful',
    'https://www.ed.gov/about/news/press-release/us-department-of-education-takes-action-eliminate-dei',
    'https://www.ed.gov/about/news/press-release/us-department-of-education-cancels-additional-350-million-woke-spending',
    'https://www.ed.gov/about/news/press-release/us-department-of-education-cuts-over-600-million-divisive-teacher-training-grants',
    'https://www.ed.gov/about/news/press-release/us-department-of-education-launches-end-dei-portal',
    'https://www.ed.gov/grants-and-programs/grants-birth-grade-12/school-and-community-improvement-grants/training-and-advisory-services-equity-assistance-centers',
    'https://www.dol.gov/general/topic/discrimination/ethnicdisc',
    'https://www.dol.gov/newsroom/releases/ofccp/ofccp20240606',
    'https://www.dol.gov/newsroom/releases/ofccp/ofccp20201022'
  );

INSERT INTO explainer_sources (
  explainer_id,
  source_title,
  source_url,
  source_type,
  publisher,
  published_date,
  notes,
  display_order
) VALUES (
  @hiring_discrimination_anti_dei_explainer_id,
  'Ending Radical And Wasteful Government DEI Programs And Preferencing',
  'https://www.whitehouse.gov/presidential-actions/2025/01/ending-radical-and-wasteful-government-dei-programs-and-preferencing/',
  'Government',
  'The White House',
  '2025-01-20',
  'Primary policy text for the Trump administration''s order directing agencies to terminate DEI, DEIA, environmental justice, and equity-related structures.',
  1
), (
  @hiring_discrimination_anti_dei_explainer_id,
  'Employers'' Replies to Racial Names',
  'https://www.nber.org/digest/sep03/employers-replies-racial-names',
  'Academic',
  'National Bureau of Economic Research',
  '2003-09-01',
  'Short NBER Digest summary of the Bertrand-Mullainathan hiring-discrimination study. Useful for quick orientation but secondary to the full paper.',
  2
), (
  @hiring_discrimination_anti_dei_explainer_id,
  'Are Emily and Greg More Employable than Lakisha and Jamal? A Field Experiment on Labor Market Discrimination',
  'https://www.aeaweb.org/articles?id=10.1257/0002828042002561',
  'Academic',
  'American Economic Association',
  NULL,
  'Canonical academic version of the foundational resume-audit study.',
  3
), (
  @hiring_discrimination_anti_dei_explainer_id,
  'Berkeley economists among group of researchers who found bias against Black job applicants',
  'https://ls.berkeley.edu/news/berkeley-economists-among-group-researchers-found-bias-against-black-job-applicants',
  'Other',
  'UC Berkeley Letters & Science',
  NULL,
  'University research summary translating the large-employer audit findings into accessible language.',
  4
), (
  @hiring_discrimination_anti_dei_explainer_id,
  'A Discrimination Report Card',
  'https://bfi.uchicago.edu/insight/research-summary/a-discrimination-report-card/',
  'Academic',
  'Becker Friedman Institute',
  NULL,
  'Research summary for the employer report-card methodology and disclosure paper.',
  5
), (
  @hiring_discrimination_anti_dei_explainer_id,
  'Systemic Discrimination Among Large U.S. Employers',
  'https://www.nber.org/papers/w29053',
  'Academic',
  'National Bureau of Economic Research',
  NULL,
  'Large-scale working paper showing racial contact gaps across major U.S. employers.',
  6
), (
  @hiring_discrimination_anti_dei_explainer_id,
  'Hiring Discrimination and the Task Content of Jobs: Evidence from a Large-Scale Resume Audit',
  'https://arxiv.org/abs/2604.01933',
  'Academic',
  'arXiv',
  '2026-04-03',
  'Recent preprint arguing that discrimination widens in higher-discretion hiring contexts. Use as provisional evidence.',
  7
), (
  @hiring_discrimination_anti_dei_explainer_id,
  'Initial Guidance Regarding DEIA Executive Orders',
  'https://www.opm.gov/media/e1zj1p0m/opm-memo-re-initial-guidance-regarding-deia-executive-orders-1-21-2025-final.pdf',
  'Government',
  'U.S. Office of Personnel Management',
  '2025-01-21',
  'OPM directed agencies to close DEIA offices, place DEIA staff on paid administrative leave, take down outward-facing media, withdraw equity-plan materials, cancel DEIA trainings, and terminate DEIA-related contractors.',
  8
), (
  @hiring_discrimination_anti_dei_explainer_id,
  'Guidance Regarding RIFs of DEIA Offices',
  'https://www.opm.gov/policy-data-oversight/latest-memos/guidance-regarding-rifs-of-deia-offices.pdf',
  'Government',
  'U.S. Office of Personnel Management',
  '2025-01-24',
  'Follow-on OPM memo telling agencies they can and should begin issuing reduction-in-force notices to employees of DEIA offices.',
  9
), (
  @hiring_discrimination_anti_dei_explainer_id,
  'Further Guidance Regarding Ending DEIA Offices, Programs and Initiatives',
  'https://www.opm.gov/chcoc/latest-memos/further-guidance-deia.pdf',
  'Government',
  'U.S. Office of Personnel Management',
  '2025-02-05',
  'Further OPM implementation guidance addressing diverse-slate and hiring-panel practices while stating that statutory EEO complaint and accommodation functions must be retained.',
  10
), (
  @hiring_discrimination_anti_dei_explainer_id,
  'US Department of Labor to cease and desist all investigative and enforcement activity under rescinded Executive Order 11246',
  'https://www.dol.gov/newsroom/releases/osec/osec20250124',
  'Government',
  'U.S. Department of Labor',
  '2025-01-24',
  'Labor Department announcement that Secretary''s Order 03-2025 halted investigative and enforcement activity under rescinded Executive Order 11246.',
  11
), (
  @hiring_discrimination_anti_dei_explainer_id,
  'Executive Order 14173: Ending Illegal Discrimination and Restoring Merit-Based Opportunity',
  'https://www.dol.gov/agencies/ofccp',
  'Government',
  'Office of Federal Contract Compliance Programs',
  NULL,
  'OFCCP implementation page stating that EO 14173 revoked EO 11246, told contractors to wind down the prior affirmative-action compliance scheme by April 21, 2025, and led OFCCP to administratively close pending compliance reviews.',
  12
), (
  @hiring_discrimination_anti_dei_explainer_id,
  'EEOC and Justice Department Warn Against Unlawful DEI-Related Discrimination',
  'https://www.justice.gov/opa/pr/eeoc-and-justice-department-warn-against-unlawful-dei-related-discrimination',
  'Government',
  'U.S. Department of Justice',
  '2025-03-19',
  'DOJ and EEOC announced technical-assistance documents positioning some DEI-related workplace practices as potential Title VII violations.',
  13
), (
  @hiring_discrimination_anti_dei_explainer_id,
  'Justice Department Releases Guidance for Recipients of Federal Funding Regarding Unlawful Discrimination',
  'https://www.justice.gov/opa/pr/justice-department-releases-guidance-recipients-federal-funding-regarding-unlawful',
  'Government',
  'U.S. Department of Justice',
  '2025-07-30',
  'DOJ guidance for federal funding recipients emphasizing potential grant-funding consequences for programs it views as unlawfully discriminatory, including DEI-labeled initiatives.',
  14
), (
  @hiring_discrimination_anti_dei_explainer_id,
  'U.S. Department of Education Takes Action to Eliminate DEI',
  'https://www.ed.gov/about/news/press-release/us-department-of-education-takes-action-eliminate-dei',
  'Government',
  'U.S. Department of Education',
  '2025-01-23',
  'Education Department announcement describing DEI council dissolutions, contract cancellations, web-content removals, and paid administrative leave for staff tied to DEI initiatives.',
  15
), (
  @hiring_discrimination_anti_dei_explainer_id,
  'U.S. Department of Education Cancels Additional $350 Million in Woke Spending',
  'https://www.ed.gov/about/news/press-release/us-department-of-education-cancels-additional-350-million-woke-spending',
  'Government',
  'U.S. Department of Education',
  '2025-02-13',
  'Education Department announcement terminating more than $350 million in contracts and grants, including grants to Equity Assistance Centers that supported DEI-related work.',
  16
), (
  @hiring_discrimination_anti_dei_explainer_id,
  'U.S. Department of Education Cuts Over $600 Million in Divisive Teacher Training Grants',
  'https://www.ed.gov/about/news/press-release/us-department-of-education-cuts-over-600-million-divisive-teacher-training-grants',
  'Government',
  'U.S. Department of Education',
  '2025-02-17',
  'Education Department announcement terminating over $600 million in teacher-training grants it said promoted DEI and race-based recruiting strategies.',
  17
), (
  @hiring_discrimination_anti_dei_explainer_id,
  'U.S. Department of Education Launches “End DEI” Portal',
  'https://www.ed.gov/about/news/press-release/us-department-of-education-launches-end-dei-portal',
  'Government',
  'U.S. Department of Education',
  '2025-02-27',
  'Education Department created a public portal to collect reports of race- or sex-based discrimination in publicly funded K-12 schools tied to DEI-related practices.',
  18
), (
  @hiring_discrimination_anti_dei_explainer_id,
  'Training and Advisory Services - Equity Assistance Centers',
  'https://www.ed.gov/grants-and-programs/grants-birth-grade-12/school-and-community-improvement-grants/training-and-advisory-services-equity-assistance-centers',
  'Government',
  'U.S. Department of Education',
  NULL,
  'Education Department program page describing Equity Assistance Centers as Title IV civil-rights technical-assistance providers for desegregation, race-related disparities, bullying, prejudice reduction, and civil-rights conflict support.',
  19
), (
  @hiring_discrimination_anti_dei_explainer_id,
  'Religion/Ethnic Characteristics/National Origin',
  'https://www.dol.gov/general/topic/discrimination/ethnicdisc',
  'Government',
  'U.S. Department of Labor',
  NULL,
  'Labor Department page stating that Executive Order 11246 prohibited federal contractors from race and national-origin discrimination and required affirmative action to ensure equal employment opportunity.',
  20
), (
  @hiring_discrimination_anti_dei_explainer_id,
  'Federal contractor Deere & Co. resolves alleged hiring discrimination, pays $1.1M in back wages, interest to affected Black, Hispanic jobseekers',
  'https://www.dol.gov/newsroom/releases/ofccp/ofccp20240606',
  'Government',
  'U.S. Department of Labor',
  '2024-06-06',
  'Recent OFCCP case example showing EO 11246 enforcement produced monetary relief and job offers after findings affecting Black applicants at a federal contractor.',
  21
), (
  @hiring_discrimination_anti_dei_explainer_id,
  'U.S. Department of Labor and Newport News Shipbuilding Enter Agreement to Resolve Alleged Hiring Discrimination',
  'https://www.dol.gov/newsroom/releases/ofccp/ofccp20201022',
  'Government',
  'U.S. Department of Labor',
  '2020-10-22',
  'OFCCP case example in which African American applicants received back pay and job opportunities under the contractor-discrimination enforcement regime later shut down in 2025.',
  22
);

UPDATE promise_actions pa
JOIN promises p
  ON p.id = pa.promise_id
SET pa.related_explainer_id = @hiring_discrimination_anti_dei_explainer_id
WHERE p.slug = 'trump-2025-end-federal-dei-equity-programs'
  AND pa.title = 'Ending Radical And Wasteful Government DEI Programs And Preferencing';

COMMIT;
