USE black_policy_tracker;

START TRANSACTION;

-- Promise-level demographic-impact seed for an existing promise anchor.
-- This file is additive and idempotent under the current schema.
--
-- Candidate promise:
--   Expand the Child Tax Credit and make it fully refundable
-- This seed focuses on the strongest Black-specific measured outcomes from the
-- one-year 2021 expansion enacted through the American Rescue Plan.

SET @promise_slug := 'biden-expand-child-tax-credit';

SET @arp_congress_source_url := 'https://www.congress.gov/bill/117th-congress/house-bill/1319';
SET @ctc_census_story_source_url := 'https://www.census.gov/library/stories/2022/09/record-drop-in-child-poverty.html';
SET @ctc_census_working_paper_source_url := 'https://www.census.gov/content/dam/Census/library/working-papers/2022/demo/sehsd-wp2022-24.pdf';

SET @promise_match_count := (
  SELECT COUNT(*)
  FROM promises
  WHERE slug = @promise_slug
);

SET @promise_id := (
  SELECT id
  FROM promises
  WHERE slug = @promise_slug
    AND @promise_match_count = 1
  LIMIT 1
);

INSERT INTO sources (
  policy_id,
  source_title,
  source_url,
  source_type,
  publisher,
  published_date,
  notes
)
SELECT
  NULL,
  'American Rescue Plan Act of 2021',
  @arp_congress_source_url,
  'Government',
  'Congress.gov',
  '2021-03-11',
  'Congress.gov legislative record for the American Rescue Plan provisions that temporarily expanded and fully refunded the Child Tax Credit in 2021.'
WHERE @promise_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM sources s
    WHERE s.policy_id IS NULL
      AND s.source_url COLLATE utf8mb4_general_ci = @arp_congress_source_url
  );

INSERT INTO sources (
  policy_id,
  source_title,
  source_url,
  source_type,
  publisher,
  published_date,
  notes
)
SELECT
  NULL,
  'Child Poverty Fell to Record Low 5.2% in 2021',
  @ctc_census_story_source_url,
  'Government',
  'U.S. Census Bureau',
  '2022-09-13',
  'Census Bureau story summarizing the record 2021 child-poverty decline and the Black child poverty reduction associated with the expanded Child Tax Credit.'
WHERE @promise_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM sources s
    WHERE s.policy_id IS NULL
      AND s.source_url COLLATE utf8mb4_general_ci = @ctc_census_story_source_url
  );

INSERT INTO sources (
  policy_id,
  source_title,
  source_url,
  source_type,
  publisher,
  published_date,
  notes
)
SELECT
  NULL,
  'The Impact of the 2021 Expanded Child Tax Credit on Child Poverty',
  @ctc_census_working_paper_source_url,
  'Government',
  'U.S. Census Bureau',
  '2022-09-13',
  'Census working paper with race-specific estimates of the 2021 expanded Child Tax Credit''s effect on child poverty.'
WHERE @promise_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM sources s
    WHERE s.policy_id IS NULL
      AND s.source_url COLLATE utf8mb4_general_ci = @ctc_census_working_paper_source_url
  );

UPDATE sources
SET
  source_title = CASE
    WHEN source_url COLLATE utf8mb4_general_ci = @arp_congress_source_url THEN 'American Rescue Plan Act of 2021'
    WHEN source_url COLLATE utf8mb4_general_ci = @ctc_census_story_source_url THEN 'Child Poverty Fell to Record Low 5.2% in 2021'
    WHEN source_url COLLATE utf8mb4_general_ci = @ctc_census_working_paper_source_url THEN 'The Impact of the 2021 Expanded Child Tax Credit on Child Poverty'
    ELSE source_title
  END,
  source_type = 'Government',
  publisher = CASE
    WHEN source_url COLLATE utf8mb4_general_ci = @arp_congress_source_url THEN 'Congress.gov'
    ELSE 'U.S. Census Bureau'
  END,
  published_date = CASE
    WHEN source_url COLLATE utf8mb4_general_ci IN (@ctc_census_story_source_url, @ctc_census_working_paper_source_url) THEN '2022-09-13'
    WHEN source_url COLLATE utf8mb4_general_ci = @arp_congress_source_url THEN '2021-03-11'
    ELSE published_date
  END,
  notes = CASE
    WHEN source_url COLLATE utf8mb4_general_ci = @arp_congress_source_url THEN 'Congress.gov legislative record for the American Rescue Plan provisions that temporarily expanded and fully refunded the Child Tax Credit in 2021.'
    WHEN source_url COLLATE utf8mb4_general_ci = @ctc_census_story_source_url THEN 'Census Bureau story summarizing the record 2021 child-poverty decline and the Black child poverty reduction associated with the expanded Child Tax Credit.'
    WHEN source_url COLLATE utf8mb4_general_ci = @ctc_census_working_paper_source_url THEN 'Census working paper with race-specific estimates of the 2021 expanded Child Tax Credit''s effect on child poverty.'
    ELSE notes
  END
WHERE policy_id IS NULL
  AND source_url COLLATE utf8mb4_general_ci IN (
    @arp_congress_source_url,
    @ctc_census_story_source_url,
    @ctc_census_working_paper_source_url
  );

DROP TEMPORARY TABLE IF EXISTS tmp_promise_ctc_impacts;
CREATE TEMPORARY TABLE tmp_promise_ctc_impacts (
  demographic_group VARCHAR(150) NOT NULL,
  metric_name VARCHAR(255) NOT NULL,
  before_value DECIMAL(14,4) NULL,
  after_value DECIMAL(14,4) NULL,
  comparison_value DECIMAL(14,4) NULL,
  unit VARCHAR(64) NOT NULL,
  geography VARCHAR(150) NOT NULL,
  year_before SMALLINT UNSIGNED NOT NULL,
  year_after SMALLINT UNSIGNED NOT NULL,
  confidence_score DECIMAL(5,4) NOT NULL,
  methodology_note TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tmp_promise_ctc_impacts (
  demographic_group,
  metric_name,
  before_value,
  after_value,
  comparison_value,
  unit,
  geography,
  year_before,
  year_after,
  confidence_score,
  methodology_note
) VALUES
(
  'Black children',
  'Black child poverty rate under the 2021 expanded Child Tax Credit',
  14.5,
  8.1,
  NULL,
  'percent',
  'United States',
  2020,
  2021,
  0.8400,
  'Direct measured outcome row. Biden partially delivered this promise through the one-year 2021 Child Tax Credit expansion in the American Rescue Plan. Census Bureau analysis found that including the expanded Child Tax Credit in Supplemental Poverty Measure resources reduced the Black child poverty rate from 14.5 percent to 8.1 percent in 2021. Because the fuller refundable expansion was not made permanent, this should be read as a strong temporary outcome rather than a permanent structural change.'
),
(
  'Black children',
  'Supporting evidence - Black children lifted above poverty by the 2021 expanded Child Tax Credit',
  0,
  716000,
  2100000,
  'children',
  'United States',
  2020,
  2021,
  0.8000,
  'Supporting outcome row. Census Bureau analysis estimated that the 2021 expanded Child Tax Credit lifted approximately 716,000 Black children out of poverty. The comparison value reflects the paper''s estimate that the 2021 expansion accounted for about 2.1 million children lifted above poverty overall. This documents the scale of Black child-poverty relief in the temporary delivery window, not a permanent promise completion.'
);

INSERT INTO entity_demographic_impacts (
  entity_type,
  entity_id,
  demographic_group,
  metric_name,
  before_value,
  after_value,
  comparison_value,
  unit,
  geography,
  period_start,
  period_end,
  year_before,
  year_after,
  disparity_ratio,
  confidence_score,
  methodology_note
) SELECT
  'promise',
  @promise_id,
  t.demographic_group,
  t.metric_name,
  t.before_value,
  t.after_value,
  t.comparison_value,
  t.unit,
  t.geography,
  NULL,
  NULL,
  t.year_before,
  t.year_after,
  NULL,
  t.confidence_score,
  t.methodology_note
FROM tmp_promise_ctc_impacts t
WHERE @promise_id IS NOT NULL
ON DUPLICATE KEY UPDATE
  before_value = VALUES(before_value),
  after_value = VALUES(after_value),
  comparison_value = VALUES(comparison_value),
  unit = VALUES(unit),
  geography = VALUES(geography),
  period_start = VALUES(period_start),
  period_end = VALUES(period_end),
  disparity_ratio = VALUES(disparity_ratio),
  confidence_score = VALUES(confidence_score),
  methodology_note = VALUES(methodology_note),
  updated_at = CURRENT_TIMESTAMP(3);

DROP TEMPORARY TABLE IF EXISTS tmp_promise_ctc_impact_sources;
CREATE TEMPORARY TABLE tmp_promise_ctc_impact_sources (
  demographic_group VARCHAR(150) NOT NULL,
  metric_name VARCHAR(255) NOT NULL,
  geography VARCHAR(150) NOT NULL,
  year_before SMALLINT UNSIGNED NOT NULL,
  year_after SMALLINT UNSIGNED NOT NULL,
  source_url VARCHAR(1000) NOT NULL,
  source_role VARCHAR(32) NOT NULL,
  citation_note TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tmp_promise_ctc_impact_sources (
  demographic_group,
  metric_name,
  geography,
  year_before,
  year_after,
  source_url,
  source_role,
  citation_note
) VALUES
(
  'Black children',
  'Black child poverty rate under the 2021 expanded Child Tax Credit',
  'United States',
  2020,
  2021,
  @ctc_census_working_paper_source_url,
  'primary',
  'Census working paper reports that the expanded Child Tax Credit reduced the Black child poverty rate from 14.5 percent to 8.1 percent in 2021.'
),
(
  'Black children',
  'Black child poverty rate under the 2021 expanded Child Tax Credit',
  'United States',
  2020,
  2021,
  @arp_congress_source_url,
  'context',
  'Congress.gov legislative record for the American Rescue Plan provisions that temporarily expanded and fully refunded the Child Tax Credit.'
),
(
  'Black children',
  'Supporting evidence - Black children lifted above poverty by the 2021 expanded Child Tax Credit',
  'United States',
  2020,
  2021,
  @ctc_census_story_source_url,
  'supporting',
  'Census Bureau story reports that approximately 716,000 Black children were lifted out of poverty by inclusion of the Child Tax Credit.'
),
(
  'Black children',
  'Supporting evidence - Black children lifted above poverty by the 2021 expanded Child Tax Credit',
  'United States',
  2020,
  2021,
  @ctc_census_working_paper_source_url,
  'methodology',
  'Census working paper provides the race-specific methodology and poverty-resource counterfactual used for the 2021 Child Tax Credit estimates.'
),
(
  'Black children',
  'Supporting evidence - Black children lifted above poverty by the 2021 expanded Child Tax Credit',
  'United States',
  2020,
  2021,
  @arp_congress_source_url,
  'context',
  'Congress.gov legislative record for the American Rescue Plan promise-delivery anchor.'
);

INSERT INTO entity_demographic_impact_sources (
  impact_id,
  source_id,
  source_role,
  citation_note
) SELECT
  edi.id,
  s.id,
  t.source_role,
  t.citation_note
FROM tmp_promise_ctc_impact_sources t
JOIN entity_demographic_impacts edi
  ON edi.entity_type = 'promise'
 AND edi.entity_id = @promise_id
 AND edi.demographic_group = t.demographic_group
 AND edi.metric_name = t.metric_name
 AND edi.geography = t.geography
 AND edi.year_before = t.year_before
 AND edi.year_after = t.year_after
JOIN (
  SELECT
    MIN(id) AS id,
    policy_id,
    source_url
  FROM sources
  GROUP BY policy_id, source_url
) s
  ON s.policy_id IS NULL
 AND s.source_url = t.source_url COLLATE utf8mb4_general_ci
WHERE @promise_id IS NOT NULL
ON DUPLICATE KEY UPDATE
  source_role = VALUES(source_role),
  citation_note = VALUES(citation_note),
  updated_at = CURRENT_TIMESTAMP(3);

COMMIT;
