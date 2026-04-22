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
  'homestead-act-exclusion',
  'The Homestead Act and Unequal Access to Land',
  'Economic Opportunity',
  'A look at how one of the largest wealth-building land transfers in U.S. history operated in practice, and why formal eligibility did not translate into equal Black access to land and durable property ownership.',
  'Land access was one of the most important wealth-building opportunities in U.S. history.
The Homestead Act did not explicitly ban Black claimants, but formal eligibility was not the same as equal practical access.
Formerly enslaved people faced violence, poverty, weak federal protection, and limited institutional support when trying to convert formal freedom into land ownership.
The resulting land gap mattered because ownership, inheritance, and productive assets compound across generations.',
  'This explainer looks at one of the biggest wealth-building opportunities in U.S. history and asks who could actually access it, under what conditions, and with what lasting effects.',
  'This topic matters because claims about equal opportunity often treat the Homestead Act as if it proved that America broadly distributed wealth-building resources to anyone willing to work. The real record is more complicated. Land policy did create opportunity, but the ability to use that opportunity depended on freedom, capital, physical safety, legal enforcement, and the chance to hold property long enough to keep it.

That makes the Homestead Act a strong EquityStack case study. It shows why a formal opening in the law is not enough if surrounding conditions make it far easier for some groups than for others to claim and retain the benefit.',
  'Anybody could get free land, so America already gave everyone the same opportunity.',
  'The Homestead Act opened a major land-distribution pathway, but Black Americans did not enter that system from the same starting point as white settlers. Enslavement had denied generations of Black people wages, movable capital, education, and legal autonomy. After emancipation, many Black families still faced debt, violence, racial terror, and weak federal protection.

Although some Black homesteaders did successfully claim land, especially in parts of the Great Plains and Oklahoma, many others lacked the money, tools, livestock, transport, legal support, and physical safety needed to prove up claims and hold them. The short life of the Freedmen''s Bureau and the collapse of Reconstruction narrowed the practical path into land ownership even further.

The strongest claim is therefore not that Black Americans were universally barred by the text of the Homestead Act. It is that one of the country''s largest land-transfer opportunities unfolded in a society where Black people were emerging from slavery into unequal conditions that made equal benefit far less attainable.',
  '1862 | Homestead Act signed into law
1863 | Claims begin under the Homestead Act
1865 | Emancipation ends slavery formally
1865 | Freedmen''s Bureau is established
1872 | Freedmen''s Bureau closes
Late 19th century | Black homesteader communities emerge, but under conditions of unequal capital, safety, and enforcement',
  'Homestead Act of 1862; Freedmen''s Bureau; Reconstruction enforcement; Black homesteading; post-emancipation land access',
  'This still matters because land ownership is not just symbolic. It affects agricultural income, business formation, family stability, collateral, inheritance, and intergenerational wealth. If a major public land transfer operated under unequal real-world conditions, that inequality compounds far beyond the first generation.

This topic also helps readers distinguish between legal eligibility and usable opportunity, which is one of the most important distinctions in American policy history.',
  'Use this explainer with Reconstruction, land, and wealth pages. The strongest source mix combines the original Homestead Act with federal records on freedpeople and newer National Park Service work documenting Black homesteader communities.

For this topic, the clearest Black-impact channel is asset ownership: unequal access to land meant unequal access to one of the earliest federal pathways into independent wealth.',
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
  SELECT id FROM explainers WHERE slug = 'homestead-act-exclusion' LIMIT 1
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
  'Primary Homestead Act document establishing the legal pathway into land claims and showing the terms of formal eligibility.',
  1
), (
  @explainer_id,
  'The Homestead Act',
  'https://www.nps.gov/articles/the-homestead-act.htm',
  'Government',
  'National Park Service',
  NULL,
  'National Park Service overview explaining how homesteading worked and why the process required more than nominal eligibility.',
  2
), (
  @explainer_id,
  'The Freedmen''s Bureau',
  'https://www.archives.gov/education/lessons/freedmen.html',
  'Government',
  'National Archives',
  NULL,
  'Federal record showing the limited and short-lived institutional support available to formerly enslaved people during Reconstruction.',
  3
), (
  @explainer_id,
  'African American Homesteaders in the Great Plains',
  'https://www.nps.gov/articles/african-american-homesteaders-in-the-great-plains.htm',
  'Government',
  'National Park Service',
  NULL,
  'Shows that Black homesteading did occur, while also providing scale and context for how uneven and difficult that route remained.',
  4
), (
  @explainer_id,
  'Oklahoma Black Homesteaders',
  'https://www.nps.gov/home/learn/historyculture/oklahoma-black-homesteaders.htm',
  'Government',
  'National Park Service',
  NULL,
  'Detailed example of Black homesteader communities and the continued barriers of racism, undercapitalization, and hostile local conditions.',
  5
);

COMMIT;
