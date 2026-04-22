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
  'party-switch-southern-strategy',
  'Did the Parties Switch? The Southern Strategy Explained',
  'Politics',
  'How civil-rights conflict, southern white backlash, and long-term coalition change moved most Black voters into the modern Democratic coalition while many white southern conservatives moved into the Republican coalition.',
  'Party realignment happened over decades, not in a single election or a single law.
Black voters became a core Democratic constituency as national Democrats increasingly embraced civil-rights enforcement.
Many white southern conservatives moved toward the Republican Party as civil-rights law and federal intervention reshaped regional politics.
Historical party labels from the 1800s do not map cleanly onto modern ideology, coalition structure, or civil-rights positioning.',
  'This explainer examines one of the most common political-history arguments in modern U.S. debate: whether the Democratic and Republican parties changed in meaningful ways over time, especially around civil rights and Black political alignment.',
  'This matters because party-switch arguments are often used to flatten history into a slogan. The stronger record is not that the parties magically traded identities overnight. It is that presidential politics, civil-rights law, southern backlash, and national coalition-building reshaped what the parties represented and who their core voters became.

That distinction is essential for EquityStack. The site tracks laws, promises, and outcomes. Those records make more sense when readers understand that modern party alignment grew out of long conflict over civil rights, voting rights, federal power, and racial politics.',
  'Democrats were the party of slavery, so the parties never changed.',
  'The strongest evidence points to a long realignment, not a single-day switch. Through much of the 19th and early 20th centuries, the South was dominated by white Democrats committed to segregation and Black disenfranchisement. But by the mid-20th century, national Democratic leaders increasingly backed civil-rights measures, while many southern white conservatives reacted against those moves.

Key markers include the 1948 Dixiecrat revolt, Truman''s desegregation order, the Civil Rights Act of 1964, the Voting Rights Act of 1965, and later Republican electoral strategies that appealed to white southern resistance to federal civil-rights intervention. Black voters, who had already begun moving toward Democrats during the New Deal era, became an even more central Democratic constituency as civil-rights conflict sharpened.

The strongest claim is therefore narrower and more defensible than a slogan: party coalitions, ideological alignments, and voter bases changed dramatically over time, especially around civil rights and the South.',
  '1948 | Truman desegregates the armed forces and the Dixiecrat revolt breaks from the Democratic convention
1964 | Civil Rights Act of 1964 becomes law
1965 | Voting Rights Act of 1965 becomes law
1968 | Nixon campaigns with law-and-order and states-rights themes tied to southern white backlash
1980 | Reagan opens his general-election campaign in Philadelphia, Mississippi
1981 | Lee Atwater later articulates the logic of coded racial politics in blunt terms',
  'Executive Order 9981; Civil Rights Act of 1964; Voting Rights Act of 1965; southern realignment; Southern Strategy politics',
  'This still matters because arguments about presidents, parties, and Black political interests are often distorted by treating party names as timeless. What matters for modern evaluation is coalition behavior, civil-rights positioning, enforcement choices, and who each party tried to mobilize.

That is also why Black political alignment cannot be understood apart from disenfranchisement, civil-rights law, and the parties'' competing responses to racial equality.',
  'Use this explainer alongside civil-rights laws, voting-rights records, and president pages. The strongest source mix combines federal civil-rights documents with records showing how party coalitions reacted to them.

For this topic, the clearest Black-impact channel is political power: party realignment changed who defended voting rights, civil-rights enforcement, and Black representation in national politics.',
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
  SELECT id FROM explainers WHERE slug = 'party-switch-southern-strategy' LIMIT 1
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
  'Executive Order 9981',
  'https://www.trumanlibrary.gov/library/executive-orders/9981/executive-order-9981',
  'Government',
  'Harry S. Truman Presidential Library and Museum',
  '1948-07-26',
  'Primary document marking an early federal civil-rights break with segregation and a key moment in national party conflict over race.',
  1
), (
  @explainer_id,
  'Civil Rights Act (1964)',
  'https://www.archives.gov/milestone-documents/civil-rights-act',
  'Government',
  'National Archives',
  '1964-07-02',
  'Primary civil-rights statute that accelerated the national partisan divide over federal intervention and equal rights.',
  2
), (
  @explainer_id,
  'Voting Rights Act (1965)',
  'https://www.archives.gov/milestone-documents/voting-rights-act',
  'Government',
  'National Archives',
  '1965-08-06',
  'Primary voting-rights statute showing how federal enforcement altered Black political participation and southern politics.',
  3
), (
  @explainer_id,
  'Desegregation of the Armed Forces',
  'https://www.trumanlibrary.gov/library/online-collections/desegregation-of-armed-forces',
  'Government',
  'Harry S. Truman Presidential Library and Museum',
  NULL,
  'Chronology and document collection showing 1948 civil-rights conflict inside Democratic politics and Black political pressure on the Truman administration.',
  4
), (
  @explainer_id,
  'Southern Strategy',
  'https://www.encyclopedia.com/social-sciences/applied-and-social-sciences-magazines/southern-strategy',
  'Other',
  'Encyclopedia.com',
  NULL,
  'Secondary synthesis summarizing how white southern conservatives moved toward the Republican coalition in reaction to civil-rights politics and later coded appeals.',
  5
);

COMMIT;
