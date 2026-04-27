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
  'gi-bill-access-and-impact',
  'The GI Bill: Opportunity, Access, and Unequal Outcomes',
  'Economic Opportunity',
  'How one of the most celebrated U.S. opportunity programs expanded education and homeownership for millions of veterans while Black veterans faced segregated colleges, lending discrimination, and unequal local implementation.',
  'The GI Bill helped build the postwar middle class, but race-neutral statutory language did not produce race-equal access in practice.
Implementation ran through the Veterans Administration, local colleges, banks, and housing markets that were already shaped by segregation and discrimination.
Black veterans faced documented constraints, overcrowded HBCUs, and exclusion from white institutions, especially in the South.
Housing benefits were also filtered through FHA-era lending systems and local mortgage discrimination, limiting Black veterans'' access to homeownership and wealth building.',
  'The GI Bill is widely remembered as proof that government investment can expand education, homeownership, and upward mobility at scale. That is true. But the GI Bill is also one of the clearest examples of how a celebrated national program can produce unequal outcomes when implementation runs through segregated institutions and discriminatory local systems.',
  'The GI Bill matters because it sits at the center of several EquityStack themes at once: veterans policy, higher education, housing, wealth formation, and the long-run structure of Black opportunity. It is not just a story about one benefit program. It is a case study in how public investment can be expansive on paper while remaining unequal in delivery.

This topic also matters because the GI Bill is frequently cited as a model of broad-based opportunity policy. To understand what it can and cannot teach us, readers need both halves of the record: the program did transform American life, and Black veterans faced documented barriers to its biggest wealth-building channels on equal terms.',
  'The GI Bill helped all veterans equally, regardless of race.',
  'The original GI Bill was written in race-neutral terms, but access to its most valuable benefits was filtered through local and state institutions that were already segregated or discriminatory. In education, Black veterans in the South faced exclusion from white colleges while historically Black colleges and universities had constrained capacity and resources. That meant the education benefit did not translate into equal college access.

Housing worked similarly. The GI Bill''s loan guaranty supported home purchases, but Black veterans still had to deal with local banks, segregated suburbs, appraisal discrimination, and the broader FHA-era system of redlining and exclusion. In practice, white veterans with access to colleges and mortgage markets could use GI Bill-backed education and housing benefits to build lasting wealth, while Black veterans in affected markets were blocked from those same pathways.

The strongest interpretation is not that the GI Bill was meaningless for Black veterans. Documented Black veterans did benefit, and gains were not identical across regions. The stronger evidence-based claim is that the GI Bill''s implementation reproduced existing racial hierarchy, especially in southern higher education and postwar housing markets.',
  '1944 | Servicemen''s Readjustment Act signed into law
1944 | Veterans Administration begins administering education and loan-guaranty benefits
Late 1940s | Postwar college enrollment and suburban homebuilding surge
Late 1940s | Black veterans face segregated college systems and exclusionary mortgage markets
1968 | Fair Housing Act begins to prohibit race discrimination in housing and mortgage access
2002 | NBER research highlights weaker GI Bill education gains for Black veterans from the South',
  'Servicemen''s Readjustment Act of 1944; Veterans Administration education and loan-guaranty implementation; FHA-era mortgage system; segregated higher-education systems; Fair Housing Act of 1968',
  'The GI Bill still matters because homeownership and education were two of the most important engines of postwar wealth building. When Black veterans were blocked from equal access to those channels, the effect did not end with one generation. It shaped family wealth, neighborhood stability, educational attainment, and the ability to pass assets forward.

The GI Bill also remains one of the best examples of why policy evaluation cannot stop at statutory language. A formally universal benefit can still produce unequal outcomes when implementation depends on discriminatory institutions.',
  'Use this explainer with housing, education, and mobility pages. The strongest source mix here combines the original law, VA implementation history, federal housing context, and economic research on Black veterans'' education outcomes.

For this topic, the clearest Black-impact channels are educational access constrained by segregation and HBCU capacity, and mortgage access constrained by discriminatory lending and housing markets.',
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

SET @gi_bill_explainer_id := (
  SELECT id
  FROM explainers
  WHERE slug = 'gi-bill-access-and-impact'
  LIMIT 1
);

DELETE FROM explainer_sources
WHERE explainer_id = @gi_bill_explainer_id;

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
  @gi_bill_explainer_id,
  'Servicemen''s Readjustment Act (1944)',
  'https://www.archives.gov/milestone-documents/servicemens-readjustment-act',
  'Government',
  'National Archives',
  NULL,
  'Original GI Bill legislation and National Archives summary of the program''s major education, loan, and unemployment provisions.',
  1
), (
  @gi_bill_explainer_id,
  'GI Bill History and Timeline',
  'https://www.va.gov/education/about-gi-bill-benefits/history-and-timeline/',
  'Government',
  'U.S. Department of Veterans Affairs',
  NULL,
  'VA overview of how GI Bill education benefits developed and were administered across different eras.',
  2
), (
  @gi_bill_explainer_id,
  'The Evolution of VA Home Loan Guaranty Service',
  'https://www.benefits.va.gov/HOMELOANS/history/',
  'Government',
  'U.S. Department of Veterans Affairs',
  NULL,
  'VA history of the home-loan guaranty program that grew out of the original GI Bill and became a major pathway into postwar homeownership.',
  3
), (
  @gi_bill_explainer_id,
  'Federal Housing Administration History',
  'https://www.hud.gov/aboutus/fhahistory',
  'Government',
  'U.S. Department of Housing and Urban Development',
  NULL,
  'Federal housing-system context for how mortgage access and underwriting operated in the same period as GI Bill home-loan expansion.',
  4
), (
  @gi_bill_explainer_id,
  'Closing the Gap or Widening the Divide: The Effects of the G.I. Bill and World War II on the Educational Outcomes of Black Americans',
  'https://www.nber.org/papers/w9044',
  'Academic',
  'National Bureau of Economic Research',
  '2002-07-01',
  'Economic research finding that GI Bill education gains differed sharply by race and region, with especially weak collegiate gains for Black veterans from the South.',
  5
), (
  @gi_bill_explainer_id,
  'The G.I. Bill, World War II, and the Education of Black Americans',
  'https://www.nber.org/digest/dec02/gi-bill-world-war-ii-and-education-black-americans',
  'Academic',
  'National Bureau of Economic Research',
  '2002-12-01',
  'Non-technical NBER summary explaining how segregated higher education and limited southern college options constrained Black veterans'' access to GI Bill education benefits.',
  6
);

COMMIT;
