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
  'sentencing-disparities-united-states',
  'Sentencing Disparities in the United States: Law, Enforcement, and Unequal Outcomes',
  'Criminal Justice',
  'A policy-focused explainer on how sentencing law, prosecutorial choices, mandatory minimums, and institutional discretion produced unequal punishment, including disparities that fell heavily on Black defendants and Black communities.',
  'Sentencing outcomes are shaped by both statute and discretion, not just by the charged offense.
Mandatory minimums, charge selection, plea bargaining, and departure practices can widen disparities even under formally neutral laws.
The crack-versus-powder cocaine disparity remains one of the clearest examples of racially unequal sentencing design and impact.
Later reforms narrowed some disparities, but measurable sentencing differences and unequal exposure to severe punishment remain.',
  'Sentencing is often presented as the straightforward application of law to facts. In practice, punishment is shaped by legislation, prosecutorial decisions, plea bargaining, criminal-history rules, judicial discretion, and the availability of relief from mandatory penalties.',
  'This topic matters because sentencing is one of the clearest places where policy design becomes lived inequality. Sentence length affects incarceration, family stability, earnings, wealth, voting, and the long-run health of communities. If the system punishes similarly situated people differently, the damage extends far beyond the courtroom.

It also matters because public debate often skips from arrest or conviction straight to punishment as though sentencing were automatic. The record shows that lawmakers and institutions make choices that structure how much punishment is imposed and on whom.',
  'People are sentenced based only on the crime they committed, so disparities simply reflect behavior rather than the system.',
  'In reality, punishment is shaped by more than the offense label. Legislatures set mandatory minimums and drug thresholds. Prosecutors choose charges and plea offers. Judges sentence within or outside guideline ranges. Defendants with different resources, records, and bargaining leverage face different odds at each step.

One of the clearest examples is federal cocaine sentencing. For years, the law punished crack cocaine far more severely than powder cocaine, even though the substances are pharmacologically related. That disparity fell heavily on Black communities. Reforms such as the Fair Sentencing Act and the First Step Act narrowed some of the gap, but did not eliminate every disparity.

The strongest claim is therefore structural: sentencing disparities emerge from the interaction of law, discretion, and enforcement, not from a single courtroom moment viewed in isolation.',
  '1986 | Anti-Drug Abuse Act creates the 100-to-1 federal crack-to-powder sentencing disparity
2010 | Fair Sentencing Act reduces the crack-to-powder disparity to 18-to-1
2017 | U.S. Sentencing Commission reports significant demographic differences in federal sentencing
2018 | First Step Act expands retroactive relief and other federal sentencing reforms
2021 | EQUAL Act passes the House but does not become law',
  'Anti-Drug Abuse Act of 1986; Fair Sentencing Act of 2010; First Step Act of 2018; EQUAL Act; mandatory minimum sentencing',
  'This still matters because punishment does not end at conviction. Sentence length affects incarceration levels, labor-market exclusion, family separation, and intergenerational stability. Black communities experience those effects cumulatively.

It also matters because later reforms prove the earlier structure was not inevitable. Legislatures changed the law because the prior design was increasingly recognized as unjust and unsound.',
  'Use this explainer with incarceration, drug-policy, and criminal-justice reform pages. The strongest source mix combines federal sentencing reports with the laws that created, narrowed, or failed to eliminate unequal punishment.

For this topic, the clearest Black-impact channels are sentence length, exposure to mandatory minimums, and the knock-on effects of long punishment across families and neighborhoods.',
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
  SELECT id FROM explainers WHERE slug = 'sentencing-disparities-united-states' LIMIT 1
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
  '2017 Demographic Differences in Federal Sentencing',
  'https://www.ussc.gov/research/research-reports/2017-demographic-differences-federal-sentencing',
  'Government',
  'United States Sentencing Commission',
  '2017-11-14',
  'Federal sentencing report finding that Black male offenders received longer sentences than similarly situated White male offenders after controlling for many factors.',
  1
), (
  @explainer_id,
  'Fair Sentencing Act of 2010',
  'https://www.congress.gov/bill/111th-congress/senate-bill/1789',
  'Government',
  'Congress.gov',
  '2010-08-03',
  'Primary legislative record for the law that reduced the federal crack-to-powder disparity from 100-to-1 to 18-to-1.',
  2
), (
  @explainer_id,
  'First Step Act of 2018',
  'https://www.congress.gov/bill/115th-congress/senate-bill/756',
  'Government',
  'Congress.gov',
  '2018-12-21',
  'Primary legislative record for federal sentencing reforms and retroactive application of parts of the Fair Sentencing Act.',
  3
), (
  @explainer_id,
  'EQUAL Act of 2021',
  'https://www.congress.gov/bill/117th-congress/house-bill/1693',
  'Government',
  'Congress.gov',
  '2021-03-09',
  'Shows that Congress later sought to eliminate the remaining federal crack-to-powder disparity entirely.',
  4
), (
  @explainer_id,
  'Crack Cocaine Trafficking',
  'https://www.ussc.gov/research/quick-facts/crack-cocaine-trafficking',
  'Government',
  'United States Sentencing Commission',
  NULL,
  'Current Commission data showing who is sentenced in federal crack cases and the continuing Black concentration in that offense category.',
  5
), (
  @explainer_id,
  'Mandatory Minimum Penalties',
  'https://www.ussc.gov/research/quick-facts/mandatory-minimum-penalties',
  'Government',
  'United States Sentencing Commission',
  NULL,
  'Current Commission overview showing the continuing role of statutory mandatory minimum penalties in federal sentencing.',
  6
);

COMMIT;
