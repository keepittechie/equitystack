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
  'government-benefits-racial-gap',
  'Government Benefits and the Racial Gap',
  'Economics',
  'A cross-policy explainer on how public support helped build wealth and security in the United States, while access to those benefits was often filtered through racial exclusion, local gatekeeping, and unequal institutions.',
  'Government support did not merely relieve hardship; it often created durable pathways into land ownership, homeownership, education, wages, and wealth.
The strongest historical question is not whether government intervened, but who could use those interventions fully.
Black Americans were often excluded outright or disadvantaged in practice through local administration, segregation, underfunding, and discriminatory markets.
Modern fairness debates are distorted when they forget that public help was central to building white middle-class wealth.',
  'This explainer addresses one of the most persistent contradictions in American politics: government support is often described as unnatural or suspect, even though public policy repeatedly helped build economic security and wealth in the United States.',
  'This topic matters because many modern arguments imply that white wealth and economic stability emerged mostly through private effort while Black communities are asking for unusual or special public help. The documentary record shows something different. Public institutions repeatedly opened ladders into land, housing, education, labor rights, and credit.

The problem was not that government stayed out. The problem was that access to public support was often racially uneven. That makes this explainer a high-level bridge across multiple EquityStack themes: land, housing, labor, education, and wealth.',
  'The government never gave white people handouts, and Black communities are asking for special treatment.',
  'From land policy to mortgage finance, veterans benefits, labor protections, and higher education support, the federal government repeatedly helped structure economic mobility. The strongest historical question is not whether benefits existed. It is who could use them and under what conditions.

The record shows repeated inequality across those channels. Land policy favored those able to claim and retain acreage. FHA-era housing policy widened access to mortgage credit while Black families were often excluded. The GI Bill expanded opportunity for millions, but Black veterans often faced segregated colleges and discriminatory housing markets. Labor law helped stabilize wages and bargaining rights, but exclusion and segmentation in labor markets limited equal gain. Higher-education policy later supported Black colleges, but under conditions shaped by long prior inequality.

The strongest claim is therefore cumulative: public policy helped build the American middle class, but Black Americans were repeatedly denied equal access to some of the most valuable routes into that outcome.',
  '1862 | Homestead Act opens a major land-distribution pathway
1934 | FHA expands the modern mortgage system
1935 | National Labor Relations Act establishes federal protection for collective bargaining
1938 | Fair Labor Standards Act establishes baseline wage and hour protections
1944 | GI Bill expands education and home-loan opportunities for veterans
1965 | Higher Education Act deepens federal higher-education support, including HBCU-focused provisions',
  'Homestead Act; FHA-era housing policy; National Labor Relations Act; Fair Labor Standards Act; GI Bill; Higher Education Act and HBCU support',
  'This still matters because wealth gaps do not emerge in a vacuum. They reflect cumulative access to productive assets, appreciating property, education, legal protection, and stable income. When public policy helped one population enter those channels more fully than another, later disparities became easier to reproduce.

This is why debates over equity and reparative policy need historical context. Public support has always been part of the American economic story.',
  'Use this explainer to connect multiple policy lanes under one evidence frame. The strongest source mix combines land, housing, labor, veterans, and higher-education records to show how unequal access accumulated across generations.

For this topic, the clearest Black-impact channel is cumulative opportunity: unequal access across several benefit systems produced larger downstream gaps than any one program alone can explain.',
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
  SELECT id FROM explainers WHERE slug = 'government-benefits-racial-gap' LIMIT 1
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
  'Homestead Act (1862)',
  'https://www.archives.gov/milestone-documents/homestead-act',
  'Government',
  'National Archives',
  '1862-05-20',
  'Primary land-policy source showing one of the earliest large federal wealth-building pathways.',
  1
), (
  @explainer_id,
  'Federal Housing Administration History',
  'https://www.hud.gov/aboutus/fhahistory',
  'Government',
  'U.S. Department of Housing and Urban Development',
  NULL,
  'Housing-policy source showing federal involvement in mortgage access and homeownership expansion.',
  2
), (
  @explainer_id,
  'Servicemen''s Readjustment Act (1944)',
  'https://www.archives.gov/milestone-documents/servicemens-readjustment-act',
  'Government',
  'National Archives',
  '1944-06-22',
  'Veterans-benefit source tying education and housing to postwar mobility and unequal implementation.',
  3
), (
  @explainer_id,
  '1935 Passage of the Wagner Act',
  'https://www.nlrb.gov/about-nlrb/who-we-are/our-history/1935-passage-of-the-wagner-act',
  'Government',
  'National Labor Relations Board',
  NULL,
  'Labor-policy source showing federal support for collective bargaining and worker protections as part of mobility and income security.',
  4
), (
  @explainer_id,
  'Fair Labor Standards Act of 1938: Maximum Struggle for a Minimum Wage',
  'https://www.dol.gov/general/aboutdol/history/flsa1938',
  'Government',
  'U.S. Department of Labor',
  NULL,
  'Federal labor-history source showing public construction of wage and hour floors rather than purely private market outcomes.',
  5
), (
  @explainer_id,
  'Fast Facts: Historically Black Colleges and Universities',
  'https://nces.ed.gov/fastfacts/display.asp?id=667+',
  'Government',
  'National Center for Education Statistics',
  NULL,
  'Education source connecting long-run Black educational advancement to institutions that emerged under segregation and later federal support.',
  6
);

COMMIT;
