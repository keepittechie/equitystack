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
  'equal-protection-under-the-law',
  'Equal Protection Under the Law: What It Means vs. How Its Been Applied',
  'Constitutional Law',
  'A constitutional explainer on the Equal Protection Clause as a legal promise, and why formal equality in constitutional text did not prevent long periods of segregation, unequal enforcement, and unequal access to remedies.',
  'The Equal Protection Clause created a constitutional standard, not an automatic social reality.
How equal protection works has depended on courts, legislation, and enforcement, not text alone.
Some of the most important equal-protection milestones came only after decades of judicial failure and legislative struggle.
Modern claims about equal treatment need historical context because formal neutrality and equal real-world protection are not the same thing.',
  'Equal protection under the law is one of the most cited constitutional principles in American politics. It originates in the 14th Amendment and is often invoked as proof that the legal system already guarantees fairness to everyone.',
  'This topic matters because equal protection is often used in public argument as if the constitutional promise settled the practical question. But American history shows a long distance between declaring a right and enforcing it. Segregation, disenfranchisement, discriminatory housing systems, and unequal access to remedies all persisted long after the 14th Amendment was ratified.

This makes equal protection one of the strongest bridge topics on the site. It connects constitutional language to court doctrine, civil-rights law, housing, education, and the real-world administration of justice.',
  'The Constitution guarantees equal protection under the law, so everyone is treated equally today.',
  'The 14th Amendment created the Equal Protection Clause in the aftermath of slavery, but its promise was narrowed, ignored, or unevenly enforced for long stretches of U.S. history. Courts permitted segregation in cases like Plessy v. Ferguson, and states continued building unequal systems despite the constitutional text.

It was only through later legal and political struggle - including Brown v. Board of Education, the Civil Rights Act of 1964, and later fair-housing enforcement - that the federal government more aggressively challenged entrenched inequality. Even then, equal protection did not become self-executing. People still needed access to courts, statutes, agencies, and remedies.

The strongest claim is therefore not that equal protection failed to matter. It is that constitutional guarantees become meaningful only when institutions interpret and enforce them against unequal systems.',
  '1868 | 14th Amendment is ratified
1896 | Plessy v. Ferguson permits separate-but-equal segregation
1954 | Brown v. Board of Education rejects school segregation under equal protection
1964 | Civil Rights Act of 1964 becomes law
1968 | Fair Housing Act targets race discrimination in housing and mortgage access',
  '14th Amendment; Plessy v. Ferguson; Brown v. Board of Education; Civil Rights Act of 1964; Fair Housing Act',
  'This still matters because constitutional language alone does not tell readers whether people received equal treatment in practice. Equal protection remains central to debates over race, voting, education, policing, housing, and access to remedies.

It also matters because many contemporary arguments collapse formal neutrality into substantive fairness. The historical record shows that those are not the same thing.',
  'Use this explainer as a constitutional gateway into civil-rights law and enforcement records. The strongest source mix combines the amendment text, landmark cases, and later statutes that tried to make the guarantee more real.

For this topic, the clearest Black-impact channel is the gap between promise and enforcement: Black Americans were the central population for whom equal protection was written, contested, and so often denied in practice.',
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
  SELECT id FROM explainers WHERE slug = 'equal-protection-under-the-law' LIMIT 1
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
  '14th Amendment to the U.S. Constitution: Civil Rights (1868)',
  'https://www.archives.gov/milestone-documents/14th-amendment',
  'Government',
  'National Archives',
  '1868-07-09',
  'Primary constitutional text establishing the Equal Protection Clause.',
  1
), (
  @explainer_id,
  'Plessy v. Ferguson, 163 U.S. 537 (1896)',
  'https://supreme.justia.com/cases/federal/us/163/537/',
  'Other',
  'Justia U.S. Supreme Court Center',
  '1896-05-18',
  'Landmark case showing how the Court permitted segregation despite the Equal Protection Clause.',
  2
), (
  @explainer_id,
  'Brown v. Board of Education of Topeka, 347 U.S. 483 (1954)',
  'https://supreme.justia.com/cases/federal/us/347/483/',
  'Other',
  'Justia U.S. Supreme Court Center',
  '1954-05-17',
  'Landmark case rejecting school segregation under equal protection and narrowing the legacy of Plessy.',
  3
), (
  @explainer_id,
  'Civil Rights Act (1964)',
  'https://www.archives.gov/milestone-documents/civil-rights-act',
  'Government',
  'National Archives',
  '1964-07-02',
  'Major federal statute showing how Congress had to build statutory enforcement on top of constitutional principle.',
  4
), (
  @explainer_id,
  'Housing Discrimination Under the Fair Housing Act',
  'https://www.hud.gov/helping-americans/fair-housing-act-overview',
  'Government',
  'U.S. Department of Housing and Urban Development',
  NULL,
  'Modern enforcement-facing source showing how equality claims still depend on statutory and administrative remedies, not text alone.',
  5
);

COMMIT;
