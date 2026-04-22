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
  'redlining-black-homeownership',
  'Redlining and Black Homeownership',
  'Housing',
  'How federal housing policy, lending practices, appraisal systems, and later enforcement battles blocked Black families from building wealth through homeownership.',
  'Redlining was reinforced by federal policy, lenders, and appraisal systems rather than arising from neutral market behavior alone.
Black families were blocked from mortgage access and wealth-building opportunities through official rules, underwriting practices, and neighborhood grading systems.
Later reforms such as the Fair Housing Act and HMDA created enforcement and visibility tools, but they did not erase the long-run effects of exclusion.
Modern redlining enforcement shows the problem is not only historical; discriminatory mortgage access in Black neighborhoods remains a live civil-rights issue.',
  'This explainer breaks down redlining, federal housing discrimination, and the long-term consequences for Black wealth and homeownership.',
  'Housing is one of the clearest examples of how public policy built wealth for some communities while excluding others. Redlining matters not only because it shaped where Black families could live, but because homeownership has long been one of the main channels for savings, intergenerational wealth, neighborhood stability, and access to appreciating assets.

This topic also matters because redlining is often flattened into a map story from the 1930s. The stronger record is broader: federal mortgage design, underwriting culture, local lending behavior, later disclosure rules, and modern fair-lending enforcement all shape how the Black homeownership gap should be understood.',
  'Black families just did not buy homes at the same rate because of personal choices, credit behavior, or ordinary market outcomes.',
  'Federal housing systems, lender behavior, appraisal discrimination, and neighborhood grading practices made mortgage access and appreciation far less available to Black families. These were policy-backed structural barriers, not just individual outcomes.

The federal government helped build the modern mortgage market through institutions like the FHA, but the history of that system cannot be separated from racial exclusion. Later laws such as the Fair Housing Act, HMDA, and the Community Reinvestment Act were attempts to constrain or expose discriminatory patterns, which is itself evidence that the earlier system was not neutral.',
  '1933 | HOLC created
1934 | FHA created under the National Housing Act
1949 | Housing Act expands redevelopment and displacement pressures
1968 | Fair Housing Act passed
1975 | HMDA requires mortgage disclosure data
1977 | Community Reinvestment Act passed
2024 | CFPB and DOJ announce a redlining action involving majority-Black neighborhoods in Birmingham, Alabama',
  'HOLC; National Housing Act of 1934; Housing Act of 1949; Fair Housing Act of 1968; Home Mortgage Disclosure Act; Community Reinvestment Act',
  'The racial wealth gap, neighborhood inequality, and appraisal disparities are tied to these historical structures, but the strongest point is not only legacy. Modern fair-lending enforcement still describes redlining in majority-Black neighborhoods, which means the problem should be understood as both historical and ongoing.

That matters for Black communities because mortgage access affects far more than one transaction. It shapes who can enter appreciating housing markets, refinance on favorable terms, fund education or business formation from home equity, and pass wealth across generations.',
  'Use housing-policy entries and linked lending laws to show how exclusion was built into the system. Pair federal housing-history sources with modern mortgage-data or enforcement sources so readers can see both the original architecture and the ongoing consequences.

For this explainer, the strongest Black-impact channels are explicit: federal housing design that widened unequal access to credit, later mortgage-data systems built to detect discriminatory patterns, and current enforcement actions describing illegal redlining in majority-Black neighborhoods.',
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

SET @redlining_explainer_id := (
  SELECT id
  FROM explainers
  WHERE slug = 'redlining-black-homeownership'
  LIMIT 1
);

DELETE FROM explainer_sources
WHERE explainer_id = @redlining_explainer_id;

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
  @redlining_explainer_id,
  'Federal Housing Administration History',
  'https://www.hud.gov/aboutus/fhahistory',
  'Government',
  'U.S. Department of Housing and Urban Development',
  NULL,
  'HUD history page describing FHA creation in 1934 and its foundational role in the modern mortgage system.',
  1
), (
  @redlining_explainer_id,
  'The Federal Housing Administration Celebrates 90 Years of Making Homeownership Possible for American Families',
  'https://archives.hud.gov/news/2024/pr24-162.cfm',
  'Government',
  'U.S. Department of Housing and Urban Development',
  '2024-06-27',
  'HUD historical summary noting that President Kennedy''s 1962 order discontinued FHA reliance on racially discriminatory redlining and discussing FHA''s role in serving borrowers of color.',
  2
), (
  @redlining_explainer_id,
  'Mortgage data (HMDA)',
  'https://www.consumerfinance.gov/data-research/hmda/',
  'Government',
  'Consumer Financial Protection Bureau',
  NULL,
  'CFPB page explaining that HMDA data help show whether lenders are serving community housing needs and shed light on patterns that could be discriminatory.',
  3
), (
  @redlining_explainer_id,
  'Housing Discrimination Under the Fair Housing Act',
  'https://www.hud.gov/helping-americans/fair-housing-act-overview',
  'Government',
  'U.S. Department of Housing and Urban Development',
  NULL,
  'HUD overview stating that the Fair Housing Act protects people from discrimination when buying a home, getting a mortgage, or seeking housing assistance, including on the basis of race.',
  4
), (
  @redlining_explainer_id,
  'CFPB and Justice Department Take Action Against Fairway for Redlining Black Neighborhoods in Birmingham, Alabama',
  'https://www.consumerfinance.gov/about-us/newsroom/cfpb-and-justice-department-take-action-against-fairway-for-redlining-black-neighborhoods-in-birmingham-alabama/',
  'Government',
  'Consumer Financial Protection Bureau',
  '2024-10-15',
  'Modern enforcement example alleging illegal redlining of majority-Black neighborhoods and tying the remedy to loan subsidies and outreach in those communities.',
  5
), (
  @redlining_explainer_id,
  'HOLC "redlining" maps: The persistent structure of segregation and economic inequality',
  'https://ncrc.org/holc/',
  'Nonprofit',
  'National Community Reinvestment Coalition',
  NULL,
  'Secondary source on HOLC maps and their relationship to segregation and long-run inequality. Useful background, but less authoritative than the government sources above.',
  6
);

COMMIT;
