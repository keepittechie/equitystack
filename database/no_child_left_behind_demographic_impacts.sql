USE black_policy_tracker;

START TRANSACTION;

-- Historical demographic-impact seed for an existing mixed-impact policy anchor.
-- This file is additive and idempotent under the current schema.
--
-- Candidate policy:
--   No Child Left Behind Act
-- The evidence layer here intentionally preserves mixed interpretation:
-- Black students saw measurable gains in some early-grade outcomes, but gaps
-- remained uneven and accountability pressure fell heavily on high-minority schools.

SET @nclb_policy_title := 'No Child Left Behind Act';
SET @nclb_policy_year := 2002;

SET @nclb_congress_source_url := 'https://www.congress.gov/bill/107th-congress/house-bill/1';
SET @nclb_title1_source_url := 'https://nces.ed.gov/sites/default/files/migrated/nces_pubs/ncee/pdf/20084012_rev.pdf';
SET @nclb_accountability_source_url := 'https://www.ed.gov/media/document/nclb-accountabilitypdf-106904.pdf';

SET @nclb_policy_match_count := (
  SELECT COUNT(*)
  FROM policies
  WHERE title = @nclb_policy_title
    AND year_enacted = @nclb_policy_year
);

SET @nclb_policy_id := (
  SELECT id
  FROM policies
  WHERE title = @nclb_policy_title
    AND year_enacted = @nclb_policy_year
    AND @nclb_policy_match_count = 1
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
  @nclb_policy_id,
  'No Child Left Behind',
  @nclb_congress_source_url,
  'Government',
  'Congress.gov',
  '2002-01-08',
  'Congressional record for the No Child Left Behind Act policy anchor.'
WHERE @nclb_policy_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM sources s
    WHERE s.policy_id = @nclb_policy_id
      AND s.source_url COLLATE utf8mb4_general_ci = @nclb_congress_source_url
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
  @nclb_policy_id,
  'National Assessment of Title I Final Report Volume I: Implementation',
  @nclb_title1_source_url,
  'Government',
  'U.S. Department of Education',
  '2007-10-01',
  'Official Department of Education report summarizing NAEP trends and Title I-era implementation outcomes relevant to NCLB.'
WHERE @nclb_policy_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM sources s
    WHERE s.policy_id = @nclb_policy_id
      AND s.source_url COLLATE utf8mb4_general_ci = @nclb_title1_source_url
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
  @nclb_policy_id,
  'State and Local Implementation of the No Child Left Behind Act, Volume III—Accountability Under NCLB: Interim Report',
  @nclb_accountability_source_url,
  'Government',
  'U.S. Department of Education',
  '2007-09-01',
  'Official Department of Education implementation study with school-level evidence on testing pressure and technical-assistance needs under NCLB accountability.'
WHERE @nclb_policy_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM sources s
    WHERE s.policy_id = @nclb_policy_id
      AND s.source_url COLLATE utf8mb4_general_ci = @nclb_accountability_source_url
  );

UPDATE sources
SET
  source_title = 'No Child Left Behind',
  source_type = 'Government',
  publisher = 'Congress.gov',
  published_date = '2002-01-08',
  notes = 'Congressional record for the No Child Left Behind Act policy anchor.'
WHERE policy_id = @nclb_policy_id
  AND source_url COLLATE utf8mb4_general_ci = @nclb_congress_source_url;

UPDATE sources
SET
  source_title = 'National Assessment of Title I Final Report Volume I: Implementation',
  source_type = 'Government',
  publisher = 'U.S. Department of Education',
  published_date = '2007-10-01',
  notes = 'Official Department of Education report summarizing NAEP trends and Title I-era implementation outcomes relevant to NCLB.'
WHERE policy_id = @nclb_policy_id
  AND source_url COLLATE utf8mb4_general_ci = @nclb_title1_source_url;

UPDATE sources
SET
  source_title = 'State and Local Implementation of the No Child Left Behind Act, Volume III - Accountability Under NCLB: Interim Report',
  source_type = 'Government',
  publisher = 'U.S. Department of Education',
  published_date = '2007-09-01',
  notes = 'Official Department of Education implementation study with school-level evidence on testing pressure and technical-assistance needs under NCLB accountability.'
WHERE policy_id = @nclb_policy_id
  AND source_url COLLATE utf8mb4_general_ci = @nclb_accountability_source_url;

DROP TEMPORARY TABLE IF EXISTS tmp_nclb_impacts;
CREATE TEMPORARY TABLE tmp_nclb_impacts (
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

INSERT INTO tmp_nclb_impacts (
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
  'Black students',
  'Black fourth-grade mathematics proficiency rate during early NCLB era',
  4.0,
  13.0,
  NULL,
  'percent',
  'United States',
  2000,
  2005,
  0.7600,
  'Direct positive outcome row. The Department of Education''s National Assessment of Title I report states that Black fourth-graders rose from 4 percent proficient in mathematics in 2000 to 13 percent proficient in 2005. This is consistent with early NCLB-era achievement gains, but it should not be read as proof that NCLB alone caused the improvement because the period spans both pre-enactment baseline and broader contemporaneous reforms.'
),
(
  'Black students',
  'Supporting evidence - Black fourth-grade reading score gain during early NCLB era',
  0,
  10.0,
  NULL,
  'NAEP scale points',
  'United States',
  2000,
  2005,
  0.7000,
  'Supporting positive row. The same Department of Education report states that Black fourth-graders gained 10 NAEP points in reading from 2000 to 2005, larger than the 5-point gain for white students over the same period. This reflects meaningful early-grade progress during the standards-and-accountability era without isolating a single-law causal effect.'
),
(
  'Black students',
  'Supporting evidence - Black-white fourth-grade mathematics proficiency gap during early NCLB era',
  26.0,
  34.0,
  NULL,
  'percentage points',
  'United States',
  2000,
  2005,
  0.7400,
  'Supporting uneven-outcome row. Using the same official figures, the Black-white gap in fourth-grade mathematics proficiency widened from 26 percentage points in 2000 (30 percent white versus 4 percent Black proficient) to 34 points in 2005 (47 percent white versus 13 percent Black proficient), even though Black students improved in absolute terms. This is one of the clearest official indications that NCLB-era gains were not evenly distributed.'
),
(
  'Black students in high-minority schools',
  'Supporting evidence - High-minority schools administering NCLB progress reading tests',
  NULL,
  86.0,
  50.0,
  'percent',
  'United States',
  2004,
  2005,
  0.6200,
  'Supporting accountability-pressure row. The Department of Education''s accountability implementation report found that 86 percent of high-minority schools administered progress tests in reading in 2004-05, compared with 50 percent of low-minority schools. This should be read as evidence that the monitoring and testing burden of NCLB was concentrated more heavily in schools serving larger shares of minority students, not as a direct test-score harm estimate.'
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
  @nclb_policy_id,
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
FROM tmp_nclb_impacts t
WHERE @nclb_policy_id IS NOT NULL
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

DROP TEMPORARY TABLE IF EXISTS tmp_nclb_impact_sources;
CREATE TEMPORARY TABLE tmp_nclb_impact_sources (
  demographic_group VARCHAR(150) NOT NULL,
  metric_name VARCHAR(255) NOT NULL,
  geography VARCHAR(150) NOT NULL,
  year_before SMALLINT UNSIGNED NOT NULL,
  year_after SMALLINT UNSIGNED NOT NULL,
  source_url VARCHAR(1000) NOT NULL,
  source_role VARCHAR(32) NOT NULL,
  citation_note TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tmp_nclb_impact_sources (
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
  'Black students',
  'Black fourth-grade mathematics proficiency rate during early NCLB era',
  'United States',
  2000,
  2005,
  @nclb_title1_source_url,
  'primary',
  'Department of Education Title I report states that Black fourth-graders rose from 4 percent proficient in mathematics in 2000 to 13 percent in 2005.'
),
(
  'Black students',
  'Black fourth-grade mathematics proficiency rate during early NCLB era',
  'United States',
  2000,
  2005,
  @nclb_congress_source_url,
  'context',
  'Congress.gov legislative record for the No Child Left Behind Act policy anchor.'
),
(
  'Black students',
  'Supporting evidence - Black fourth-grade reading score gain during early NCLB era',
  'United States',
  2000,
  2005,
  @nclb_title1_source_url,
  'supporting',
  'Department of Education Title I report states that Black fourth-graders gained 10 points in reading from 2000 to 2005.'
),
(
  'Black students',
  'Supporting evidence - Black fourth-grade reading score gain during early NCLB era',
  'United States',
  2000,
  2005,
  @nclb_congress_source_url,
  'context',
  'Congress.gov legislative record for the No Child Left Behind Act.'
),
(
  'Black students',
  'Supporting evidence - Black-white fourth-grade mathematics proficiency gap during early NCLB era',
  'United States',
  2000,
  2005,
  @nclb_title1_source_url,
  'supporting',
  'Department of Education Title I report shows Black fourth-grade math proficiency rising from 4 to 13 percent while white proficiency rose from 30 to 47 percent, widening the Black-white proficiency gap from 26 to 34 points.'
),
(
  'Black students',
  'Supporting evidence - Black-white fourth-grade mathematics proficiency gap during early NCLB era',
  'United States',
  2000,
  2005,
  @nclb_congress_source_url,
  'context',
  'Congress.gov legislative record for the law establishing the accountability regime discussed here.'
),
(
  'Black students in high-minority schools',
  'Supporting evidence - High-minority schools administering NCLB progress reading tests',
  'United States',
  2004,
  2005,
  @nclb_accountability_source_url,
  'supporting',
  'Department of Education accountability report found that 86 percent of high-minority schools administered progress reading tests, compared with 50 percent of low-minority schools.'
),
(
  'Black students in high-minority schools',
  'Supporting evidence - High-minority schools administering NCLB progress reading tests',
  'United States',
  2004,
  2005,
  @nclb_congress_source_url,
  'context',
  'Congress.gov legislative record for the NCLB accountability framework.'
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
FROM tmp_nclb_impact_sources t
JOIN entity_demographic_impacts edi
  ON edi.entity_type = 'policy'
 AND edi.entity_id = @nclb_policy_id
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
  ON s.policy_id = @nclb_policy_id
 AND s.source_url = t.source_url COLLATE utf8mb4_general_ci
WHERE @nclb_policy_id IS NOT NULL
ON DUPLICATE KEY UPDATE
  source_role = VALUES(source_role),
  citation_note = VALUES(citation_note),
  updated_at = CURRENT_TIMESTAMP(3);

COMMIT;
