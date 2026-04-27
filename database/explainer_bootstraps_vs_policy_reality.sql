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
  'bootstraps-vs-policy-reality',
  'Pull Yourself Up by Your Bootstraps vs. Policy Reality',
  'Economic Opportunity',
  'An explainer on why American upward mobility has never been only about private effort, and how land, housing, labor, education, and public investment repeatedly structured who could build wealth and security.',
  'Economic mobility in the United States has always been shaped by policy as well as effort.
Public institutions helped build paths into land ownership, homeownership, education, wages, and long-run wealth.
The strongest historical question is not whether help existed, but who could access it on equal terms.
Ignoring policy history turns unequal opportunity into a misleading morality tale about merit alone.',
  'The idea that Americans rise or fall entirely on their own is deeply rooted in public debate. But the history of U.S. mobility is full of public scaffolding: land policy, mortgage systems, labor rules, schools, roads, colleges, and subsidized credit.',
  'This matters because bootstrap rhetoric is used in public debate to erase the policy structure of opportunity. If one population repeatedly benefited from government-backed wealth-building while others faced exclusion or partial access, then raw outcome comparisons can no longer be treated as simple reflections of work ethic or character.

That makes this explainer one of the clearest bridge pages on the site. It ties together housing, land, labor, education, and wealth into a single historical argument about how opportunity was actually built.',
  'Nobody was given anything. People just worked hard, made good choices, and pulled themselves up by their bootstraps.',
  'In reality, upward mobility in the United States was repeatedly supported by public policy. Federal land law distributed acreage. Federal housing institutions widened access to mortgages. The GI Bill expanded education and home loans. Labor law stabilized bargaining power and baseline wages. Higher-education policy deepened access to colleges and institutions serving Black students.

The key issue is not whether hard work mattered. It did. The stronger historical claim is that hard work operated inside systems shaped by law and public resources. Those systems did not treat everyone equally. Black Americans were blocked from slavery-era asset accumulation, constrained in access to land, excluded from documented housing opportunities, segmented in labor markets, and denied equal use of formally race-neutral programs.

The strongest conclusion is therefore structural rather than moralistic: American mobility has long depended on policy-created ladders, and the distribution of those ladders was unequal.',
  '1862 | Homestead Act creates a major land-distribution pathway
1934 | FHA expands the modern mortgage system
1935 | National Labor Relations Act becomes law
1938 | Fair Labor Standards Act becomes law
1944 | GI Bill expands access to education and home loans
1965 | Higher Education Act deepens federal higher-education support',
  'Homestead Act; FHA-era housing policy; National Labor Relations Act; Fair Labor Standards Act; GI Bill; Higher Education Act',
  'This still matters because debates about poverty, wealth, and achievement frequently assume a neutral starting line. The record shows repeated public intervention in building opportunity, along with unequal access to those interventions.

That means claims about merit and mobility are incomplete unless they also explain who got the policy support that made mobility easier in the first place.',
  'Use this explainer as a high-level frame before opening more specific pages on land, housing, education, or labor. The strongest source mix shows that public support was central to mobility, then asks how racial exclusion changed the results.

For this topic, the clearest Black-impact channel is blocked ladder access: Black communities faced documented barriers to equal entry into the very public systems later used to celebrate American self-reliance.',
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
  SELECT id FROM explainers WHERE slug = 'bootstraps-vs-policy-reality' LIMIT 1
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
  'Primary land-policy source showing that public authority helped create one of the earliest wealth-building ladders.',
  1
), (
  @explainer_id,
  'Federal Housing Administration History',
  'https://www.hud.gov/aboutus/fhahistory',
  'Government',
  'U.S. Department of Housing and Urban Development',
  NULL,
  'Housing source showing the federal role in building the mortgage market rather than leaving mobility to purely private effort.',
  2
), (
  @explainer_id,
  'Servicemen''s Readjustment Act (1944)',
  'https://www.archives.gov/milestone-documents/servicemens-readjustment-act',
  'Government',
  'National Archives',
  '1944-06-22',
  'Veterans-benefit source linking federal support directly to postwar education and homeownership mobility.',
  3
), (
  @explainer_id,
  '1935 Passage of the Wagner Act',
  'https://www.nlrb.gov/about-nlrb/who-we-are/our-history/1935-passage-of-the-wagner-act',
  'Government',
  'National Labor Relations Board',
  NULL,
  'Labor source showing public creation of bargaining rights rather than a purely self-help labor market.',
  4
), (
  @explainer_id,
  'Fair Labor Standards Act of 1938: Maximum Struggle for a Minimum Wage',
  'https://www.dol.gov/general/aboutdol/history/flsa1938',
  'Government',
  'U.S. Department of Labor',
  NULL,
  'Labor-history source documenting federal wage and hour protections as a mobility scaffold.',
  5
), (
  @explainer_id,
  'Higher Education Act of 1965, as Amended Title III, Part D',
  'https://www.ed.gov/about/ed-offices/office-of-postsecondary-education/higher-education-act-of-1965-amended-title-iii',
  'Government',
  'U.S. Department of Education',
  NULL,
  'Education-policy source highlighting later federal support structures tied to equal opportunity and Black higher education.',
  6
);

COMMIT;
