USE black_policy_tracker;

START TRANSACTION;

-- Historical demographic-impact seed for an existing policy anchor.
-- This file is additive and idempotent under the current schema.
--
-- Candidate policy:
--   Patient Protection and Affordable Care Act
-- This first-pass evidence layer focuses on official HHS measures of Black
-- coverage and access changes during the ACA-era coverage expansion period.

SET @aca_policy_title := 'Patient Protection and Affordable Care Act';
SET @aca_policy_year := 2010;

SET @aca_congress_source_url := 'https://www.congress.gov/bill/111th-congress/house-bill/3590';
SET @aca_black_coverage_source_url := 'https://aspe.hhs.gov/sites/default/files/documents/4fc0ddbcee8d583d57e399dad6201536/aspe-coverage-access-black-americans-ib.pdf';
SET @aca_briefing_book_source_url := 'https://aspe.hhs.gov/sites/default/files/documents/a363f6e41c8a02d785a55dec4fbd5b7c/aca-briefing-book-aspe-03-2022.pdf';

SET @aca_policy_match_count := (
  SELECT COUNT(*)
  FROM policies
  WHERE title = @aca_policy_title
    AND year_enacted = @aca_policy_year
);

SET @aca_policy_id := (
  SELECT id
  FROM policies
  WHERE title = @aca_policy_title
    AND year_enacted = @aca_policy_year
    AND @aca_policy_match_count = 1
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
  @aca_policy_id,
  'Patient Protection and Affordable Care Act',
  @aca_congress_source_url,
  'Government',
  'Congress.gov',
  '2010-03-23',
  'Congressional record for the Affordable Care Act policy anchor.'
WHERE @aca_policy_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM sources s
    WHERE s.policy_id = @aca_policy_id
      AND s.source_url COLLATE utf8mb4_general_ci = @aca_congress_source_url
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
  @aca_policy_id,
  'Health Insurance Coverage and Access to Care Among Black Americans: Recent Trends and Key Challenges',
  @aca_black_coverage_source_url,
  'Government',
  'U.S. Department of Health and Human Services',
  '2024-06-07',
  'ASPE issue brief with federal survey estimates on Black insurance coverage and access-to-care changes between 2010 and 2022.'
WHERE @aca_policy_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM sources s
    WHERE s.policy_id = @aca_policy_id
      AND s.source_url COLLATE utf8mb4_general_ci = @aca_black_coverage_source_url
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
  @aca_policy_id,
  'The Affordable Care Act and Its Accomplishments',
  @aca_briefing_book_source_url,
  'Government',
  'U.S. Department of Health and Human Services',
  '2022-03-01',
  'ASPE briefing book summarizing evidence that ACA Medicaid expansion improved access to care and narrowed racial disparities in coverage, especially for Black Americans.'
WHERE @aca_policy_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM sources s
    WHERE s.policy_id = @aca_policy_id
      AND s.source_url COLLATE utf8mb4_general_ci = @aca_briefing_book_source_url
  );

DROP TEMPORARY TABLE IF EXISTS tmp_aca_impacts;
CREATE TEMPORARY TABLE tmp_aca_impacts (
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

INSERT INTO tmp_aca_impacts (
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
  'Black Americans',
  'Black uninsured rate after ACA coverage provisions',
  20.9,
  10.8,
  NULL,
  'percent',
  'United States',
  2010,
  2022,
  0.8400,
  'Direct measured outcome row. A June 2024 HHS ASPE issue brief reports that the uninsured rate among nonelderly Black Americans fell from 20.9 percent in 2010 to 10.8 percent in 2022. The brief attributes the early gains to ACA Marketplace and Medicaid expansion coverage provisions, while also noting that later ARP and IRA subsidy expansions contributed to additional gains after 2020. This row should be read as a strong ACA-era coverage outcome, not as an ACA-only causal estimate for every year through 2022.'
),
(
  'Black Americans',
  'Supporting evidence - Black Medicaid coverage rate during ACA-era coverage expansion',
  30.2,
  35.2,
  NULL,
  'percent',
  'United States',
  2010,
  2022,
  0.7300,
  'Supporting coverage-source row. The same HHS ASPE brief reports that Medicaid coverage among Black Americans rose from 30.2 percent in 2010 to 35.2 percent in 2022, a 5.0 percentage-point increase. The briefing-book literature summary from HHS states that ACA Medicaid expansion helped narrow racial disparities in coverage, especially for Black Americans. This is supporting evidence about one major channel of ACA-era Black coverage gains rather than a single-policy causal estimate.'
),
(
  'Black Americans',
  'Supporting evidence - Black Americans without a usual source of care',
  14.9,
  8.9,
  NULL,
  'percent',
  'United States',
  2010,
  2022,
  0.7600,
  'Supporting access-to-care row. HHS ASPE reports that the share of Black Americans lacking a usual source of care fell from 14.9 percent in 2010 to 8.9 percent in 2022. This indicates that coverage gains during the ACA era translated into improved access to regular care, while still reflecting the broader policy environment through 2022 rather than the ACA alone.'
),
(
  'Black Americans',
  'Supporting evidence - Black Americans delaying care due to cost',
  10.8,
  6.0,
  NULL,
  'percent',
  'United States',
  2010,
  2022,
  0.7400,
  'Supporting affordability row. HHS ASPE reports that the share of Black Americans delaying care due to cost fell from 10.8 percent in 2010 to 6.0 percent in 2022. This is evidence that the ACA-era coverage expansion coincided with better affordability and access for Black Americans, but it should not be read as proof that all remaining affordability changes are attributable only to the ACA.'
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
  'policy',
  @aca_policy_id,
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
FROM tmp_aca_impacts t
WHERE @aca_policy_id IS NOT NULL
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

DROP TEMPORARY TABLE IF EXISTS tmp_aca_impact_sources;
CREATE TEMPORARY TABLE tmp_aca_impact_sources (
  demographic_group VARCHAR(150) NOT NULL,
  metric_name VARCHAR(255) NOT NULL,
  geography VARCHAR(150) NOT NULL,
  year_before SMALLINT UNSIGNED NOT NULL,
  year_after SMALLINT UNSIGNED NOT NULL,
  source_url VARCHAR(1000) NOT NULL,
  source_role VARCHAR(32) NOT NULL,
  citation_note TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tmp_aca_impact_sources (
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
  'Black Americans',
  'Black uninsured rate after ACA coverage provisions',
  'United States',
  2010,
  2022,
  @aca_black_coverage_source_url,
  'primary',
  'HHS ASPE reports that the uninsured rate among nonelderly Black Americans fell from 20.9 percent in 2010 to 10.8 percent in 2022.'
),
(
  'Black Americans',
  'Black uninsured rate after ACA coverage provisions',
  'United States',
  2010,
  2022,
  @aca_congress_source_url,
  'context',
  'Congress.gov legislative record for the ACA policy anchor.'
),
(
  'Black Americans',
  'Supporting evidence - Black Medicaid coverage rate during ACA-era coverage expansion',
  'United States',
  2010,
  2022,
  @aca_black_coverage_source_url,
  'supporting',
  'HHS ASPE reports that Black Medicaid coverage rose from 30.2 percent in 2010 to 35.2 percent in 2022.'
),
(
  'Black Americans',
  'Supporting evidence - Black Medicaid coverage rate during ACA-era coverage expansion',
  'United States',
  2010,
  2022,
  @aca_briefing_book_source_url,
  'methodology',
  'HHS briefing book summarizes the evidence that ACA Medicaid expansion improved access and narrowed racial coverage disparities, especially for Black Americans.'
),
(
  'Black Americans',
  'Supporting evidence - Black Americans without a usual source of care',
  'United States',
  2010,
  2022,
  @aca_black_coverage_source_url,
  'supporting',
  'HHS ASPE reports that the share of Black Americans without a usual source of care fell from 14.9 percent in 2010 to 8.9 percent in 2022.'
),
(
  'Black Americans',
  'Supporting evidence - Black Americans without a usual source of care',
  'United States',
  2010,
  2022,
  @aca_briefing_book_source_url,
  'methodology',
  'HHS briefing book summarizes the broader evidence that ACA coverage expansion improved access to care.'
),
(
  'Black Americans',
  'Supporting evidence - Black Americans delaying care due to cost',
  'United States',
  2010,
  2022,
  @aca_black_coverage_source_url,
  'supporting',
  'HHS ASPE reports that the share of Black Americans delaying care due to cost fell from 10.8 percent in 2010 to 6.0 percent in 2022.'
),
(
  'Black Americans',
  'Supporting evidence - Black Americans delaying care due to cost',
  'United States',
  2010,
  2022,
  @aca_briefing_book_source_url,
  'methodology',
  'HHS briefing book summarizes the broader evidence that ACA coverage expansion improved access and affordability.'
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
FROM tmp_aca_impact_sources t
JOIN entity_demographic_impacts edi
  ON edi.entity_type = 'policy'
 AND edi.entity_id = @aca_policy_id
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
  ON s.policy_id = @aca_policy_id
 AND s.source_url = t.source_url COLLATE utf8mb4_general_ci
WHERE @aca_policy_id IS NOT NULL
ON DUPLICATE KEY UPDATE
  source_role = VALUES(source_role),
  citation_note = VALUES(citation_note),
  updated_at = CURRENT_TIMESTAMP(3);

COMMIT;
