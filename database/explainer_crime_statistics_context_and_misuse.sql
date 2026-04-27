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
  'crime-statistics-context-and-misuse',
  'Crime Statistics in Context: How the 13/50 Claim Is Used and Misused',
  'Criminal Justice',
  'A measurement-focused explainer on why race-and-crime slogans collapse unlike data systems, ignore what official statistics can and cannot show, and can hide the role of policy, reporting, and enforcement.',
  'Population share, victimization, reported crime, arrests, convictions, and incarceration are different measures.
Official police data do not capture all crime, and victimization surveys exist precisely because incidents outside police reporting systems are not captured or cleared.
Arrest-based or law-enforcement-based statistics cannot by themselves explain broad claims about race, behavior, or public policy.
Crime data need methodological, geographic, and institutional context before they can support larger conclusions.',
  'One of the most repeated slogans in public argument about race and crime combines a population figure with a crime statistic as if both describe the same thing. A serious analysis has to start by asking what the numbers actually measure.',
  'This topic matters because crime statistics are used in public debate to justify large claims about race, policing, punishment, and social worth. If the underlying measures are misunderstood, the argument becomes stronger than the data allow.

EquityStack treats this as a methodology page before it becomes a politics page. Readers need to understand the difference between reported crime, arrests, victimization, and clearances before they use crime numbers to interpret race or policy.',
  'Black people are 13 percent of the population and commit 50 percent of violent crime, so the statistics speak for themselves.',
  'The slogan mixes unlike categories. The population side comes from demographic data. The crime side is frequently based on law-enforcement data, such as arrest or offense reporting. Those are not the same thing as convictions, total offending, or the complete universe of victimization.

FBI reporting systems measure crimes known to law enforcement, and those systems have changed over time. Clearance rates are incomplete, which means unsolved offenses do not produce an identified offender in police data. The National Crime Victimization Survey exists because victimizations outside police reporting systems are not captured in police data. That does not make official crime data useless, but it does mean the numbers require careful interpretation.

The strongest claim is therefore methodological: crime statistics can inform debate, but slogans that jump from raw categories to sweeping conclusions about race or policy misuse what the data are capable of proving.',
  '1930 | Uniform Crime Reporting begins under the FBI
1973 | National Crime Victimization Survey begins
1991 | National Incident-Based Reporting System is created
2011 | FBI publishes its first annual NIBRS compilation
2021 | FBI transitions the UCR Program to NIBRS-only collection',
  'Uniform Crime Reporting; National Crime Victimization Survey; NIBRS; FBI clearances; crime-data methodology',
  'This still matters because poorly used crime statistics can harden stereotypes, distort policy debate, and short-circuit discussion of policing, poverty, segregation, sentencing, and institutional bias.

It also matters because polarizing public claims can depend less on what the data show than on what listeners are invited to assume from them.',
  'Use this explainer before moving into policing, sentencing, or incarceration pages. The strongest source mix combines FBI reporting-methodology material with the NCVS so readers can see why administrative and survey data answer different questions.

For this topic, the clearest Black-impact channel is interpretive harm: bad statistical framing can be used to justify harsher policing, punishment, and political hostility toward Black communities.',
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

SET @explainer_id := (
  SELECT id FROM explainers WHERE slug = 'crime-statistics-context-and-misuse' LIMIT 1
);

DELETE FROM explainer_sources WHERE explainer_id = @explainer_id;

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
  @explainer_id,
  'National Incident-Based Reporting System (NIBRS)',
  'https://www.fbi.gov/services/cjis/ucr/nibrs',
  'Government',
  'Federal Bureau of Investigation',
  NULL,
  'FBI overview explaining what NIBRS collects, how it differs from older aggregate UCR reporting, and why methodology matters.',
  1
), (
  @explainer_id,
  'National Crime Victimization Survey',
  'https://bjs.ojp.gov/programs/ncvs',
  'Government',
  'Bureau of Justice Statistics',
  NULL,
  'Primary federal survey source showing that victimizations are measured outside police reporting systems.',
  2
), (
  @explainer_id,
  'National Crime Victimization Survey: Prevalence Estimation Methods',
  'https://bjs.ojp.gov/library/publications/national-crime-victimization-survey-prevalence-estimation-methods',
  'Government',
  'Bureau of Justice Statistics',
  '2024-04-30',
  'Methodology source underscoring that victimization measurement has its own limits and technical choices.',
  3
), (
  @explainer_id,
  'Clearances',
  'https://ucr.fbi.gov/crime-in-the-u.s/2019/crime-in-the-u.s.-2019/topic-pages/clearances',
  'Government',
  'Federal Bureau of Investigation',
  '2019-01-01',
  'FBI explanation of what it means for an offense to be cleared and why offenses known to police are not equivalent to solved crime or total offending.',
  4
), (
  @explainer_id,
  'UCR Publications',
  'https://www.fbi.gov/services/cjis/ucr/publications',
  'Government',
  'Federal Bureau of Investigation',
  NULL,
  'Source hub for the FBI''s law-enforcement crime reporting publications and documentation.',
  5
);

COMMIT;
