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
  'mass-incarceration-policy-history',
  'Mass Incarceration in the United States: Policy vs. Outcome',
  'Criminal Justice',
  'A policy-history explainer on the rise of U.S. incarceration and why crime trends alone cannot account for the scale of prison growth, especially where law, enforcement, and sentencing design intensified Black exposure to imprisonment.',
  'Mass incarceration was shaped by policy choices, not simply by crime rates.
Drug laws, mandatory minimums, policing priorities, plea bargaining, and long sentences expanded the reach and duration of imprisonment.
Incarceration remained historically high even as crime later declined, underscoring the importance of policy design.
Black communities bore a disproportionate share of the resulting imprisonment, family disruption, and civic exclusion.',
  'The United States has one of the highest incarceration rates in the world. Public debate can treat that fact as a direct reflection of crime. The stronger historical record points instead to the interaction of crime, politics, law, sentencing, and enforcement priorities.',
  'This topic matters because incarceration changes far more than prison counts. It affects employment, family stability, health, voting, education, neighborhood life, and long-run inequality. If imprisonment grew mainly because policy intensified punishment and enforcement, then mass incarceration is not merely a social outcome. It is a governance outcome.

This is also one of the clearest places where Black impact becomes visible through state power. Exposure to arrest, harsh sentencing, supervision, and incarceration was not evenly distributed across communities.',
  'Mass incarceration is simply the result of higher crime rates and individual choices.',
  'Crime trends matter, but they do not explain the scale or duration of modern U.S. incarceration on their own. Beginning in the 1970s and accelerating in the 1980s and 1990s, lawmakers and institutions expanded imprisonment through drug policy, mandatory minimums, longer sentences, repeat-offender laws, and enforcement strategies that widened the system''s reach.

Those changes shaped who entered prison, how long they stayed, and how heavily punishment was concentrated in specific communities. Even after crime later fell, the effects of prior policy design remained embedded in sentence structure, supervision, and prison populations.

The strongest claim is therefore structural: mass incarceration was built through law and administration, not merely discovered through crime statistics.',
  '1970s | Prison population growth accelerates
1986 | Anti-Drug Abuse Act becomes law
1994 | Violent Crime Control and Law Enforcement Act becomes law
2000s | Crime declines while incarceration remains historically high
2018 | First Step Act creates federal reform with constrained reach
2024 | BJS reports more than 5.4 million adults under correctional supervision in 2022',
  'Anti-Drug Abuse Act of 1986; Violent Crime Control and Law Enforcement Act of 1994; mandatory minimums; correctional supervision; First Step Act',
  'This still matters because incarceration has afterlives. A prison sentence affects earnings, housing, family structure, civic participation, and health long after release. Communities with concentrated imprisonment carry those burdens collectively.

It also matters because if mass incarceration is policy-made, it can also be policy-changed. Historical design choices create a reform obligation, not just a descriptive statistic.',
  'Use this explainer with sentencing, drug-policy, and criminal-justice reform pages. The strongest source mix pairs incarceration totals with the laws and sentencing structures that helped produce them.

For this topic, the clearest Black-impact channels are concentrated imprisonment, family disruption, labor-market exclusion, and the cumulative weakening of community stability.',
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
  SELECT id FROM explainers WHERE slug = 'mass-incarceration-policy-history' LIMIT 1
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
  'Correctional Populations in the United States, 2022 - Statistical Tables',
  'https://bjs.ojp.gov/library/publications/correctional-populations-united-states-2022-statistical-tables',
  'Government',
  'Bureau of Justice Statistics',
  '2024-05-30',
  'Current federal correctional-population report showing the scale of incarceration and supervision in the modern U.S. system.',
  1
), (
  @explainer_id,
  'Anti-Drug Abuse Act of 1986',
  'https://www.congress.gov/bill/99th-congress/house-bill/5484',
  'Government',
  'Congress.gov',
  '1986-10-27',
  'Primary legislative record for a major punitive drug-law expansion tied to prison growth and harsher sentencing.',
  2
), (
  @explainer_id,
  'Violent Crime Control and Law Enforcement Act of 1994',
  'https://www.congress.gov/bill/103rd-congress/house-bill/3355',
  'Government',
  'Congress.gov',
  '1994-09-13',
  'Primary legislative record for the 1994 crime bill and its prison- and policing-related expansion.',
  3
), (
  @explainer_id,
  'The First Step Act of 2018: An Overview',
  'https://www.congress.gov/crs-products/product/details?prodcode=R45558',
  'Government',
  'Congressional Research Service',
  NULL,
  'CRS summary of federal reform efforts showing both the scope and limits of later sentencing and prison reform.',
  4
), (
  @explainer_id,
  'Mandatory Minimum Penalties',
  'https://www.ussc.gov/research/quick-facts/mandatory-minimum-penalties',
  'Government',
  'United States Sentencing Commission',
  NULL,
  'Current Commission data showing the continuing role of mandatory minimum penalties in federal punishment.',
  5
);

COMMIT;
