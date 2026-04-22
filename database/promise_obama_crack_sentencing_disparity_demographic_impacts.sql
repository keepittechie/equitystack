USE black_policy_tracker;

START TRANSACTION;

-- Promise-level demographic-impact seed for an existing promise anchor.
-- This file is additive and idempotent under the current schema.
--
-- Candidate promise:
--   Reduce the federal crack-powder sentencing disparity
-- This seed stays narrow and conservative. It uses an observed sentence change
-- and offender-race composition evidence from the Fair Sentencing Act era
-- rather than over-claiming the full racial impact of federal drug policy.

SET @promise_slug := 'obama-crack-sentencing-disparity';

SET @fsa_congress_source_url := 'https://www.congress.gov/bill/111th-congress/senate-bill/1789';
SET @ussc_2010_source_url := 'https://www.ussc.gov/sites/default/files/pdf/research-and-publications/annual-reports-and-sourcebooks/2010/2010_Annual_Report_Chap5.pdf';
SET @ussc_2015_source_url := 'https://www.ussc.gov/sites/default/files/pdf/news/congressional-testimony-and-reports/drug-topics/201507_RtC_Fair-Sentencing-Act.pdf';

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
  'Fair Sentencing Act of 2010',
  @fsa_congress_source_url,
  'Government',
  'Congress.gov',
  '2010-08-03',
  'Congress.gov legislative record for the Fair Sentencing Act, which delivered Obama''s promise to reduce the federal crack-powder sentencing disparity.'
WHERE @promise_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM sources s
    WHERE s.policy_id IS NULL
      AND s.source_url COLLATE utf8mb4_general_ci = @fsa_congress_source_url
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
  'Annual Report 2010 - Chapter Five',
  @ussc_2010_source_url,
  'Government',
  'U.S. Sentencing Commission',
  NULL,
  'USSC annual-report chapter with fiscal year 2010 crack-sentencing averages and race composition of federal crack defendants.'
WHERE @promise_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM sources s
    WHERE s.policy_id IS NULL
      AND s.source_url COLLATE utf8mb4_general_ci = @ussc_2010_source_url
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
  'Report to the Congress: Impact of the Fair Sentencing Act of 2010',
  @ussc_2015_source_url,
  'Government',
  'U.S. Sentencing Commission',
  NULL,
  'USSC report to Congress with post-Fair Sentencing Act sentencing data and official discussion of the law''s impact.'
WHERE @promise_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM sources s
    WHERE s.policy_id IS NULL
      AND s.source_url COLLATE utf8mb4_general_ci = @ussc_2015_source_url
  );

UPDATE sources
SET
  source_title = CASE
    WHEN source_url COLLATE utf8mb4_general_ci = @fsa_congress_source_url THEN 'Fair Sentencing Act of 2010'
    WHEN source_url COLLATE utf8mb4_general_ci = @ussc_2010_source_url THEN 'Annual Report 2010 - Chapter Five'
    WHEN source_url COLLATE utf8mb4_general_ci = @ussc_2015_source_url THEN 'Report to the Congress: Impact of the Fair Sentencing Act of 2010'
    ELSE source_title
  END,
  source_type = 'Government',
  publisher = CASE
    WHEN source_url COLLATE utf8mb4_general_ci = @fsa_congress_source_url THEN 'Congress.gov'
    ELSE 'U.S. Sentencing Commission'
  END,
  published_date = CASE
    WHEN source_url COLLATE utf8mb4_general_ci = @fsa_congress_source_url THEN '2010-08-03'
    WHEN source_url COLLATE utf8mb4_general_ci = @ussc_2010_source_url THEN NULL
    WHEN source_url COLLATE utf8mb4_general_ci = @ussc_2015_source_url THEN NULL
    ELSE published_date
  END,
  notes = CASE
    WHEN source_url COLLATE utf8mb4_general_ci = @fsa_congress_source_url THEN 'Congress.gov legislative record for the Fair Sentencing Act, which delivered Obama''s promise to reduce the federal crack-powder sentencing disparity.'
    WHEN source_url COLLATE utf8mb4_general_ci = @ussc_2010_source_url THEN 'USSC annual-report chapter with fiscal year 2010 crack-sentencing averages and race composition of federal crack defendants.'
    WHEN source_url COLLATE utf8mb4_general_ci = @ussc_2015_source_url THEN 'USSC report to Congress with post-Fair Sentencing Act sentencing data and official discussion of the law''s impact.'
    ELSE notes
  END
WHERE policy_id IS NULL
  AND source_url COLLATE utf8mb4_general_ci IN (
    @fsa_congress_source_url,
    @ussc_2010_source_url,
    @ussc_2015_source_url
  );

DROP TEMPORARY TABLE IF EXISTS tmp_promise_crack_impacts;
CREATE TEMPORARY TABLE tmp_promise_crack_impacts (
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

INSERT INTO tmp_promise_crack_impacts (
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
  'Black federal crack-cocaine defendants',
  'Average federal crack-cocaine sentence after Fair Sentencing Act implementation',
  111.0,
  101.0,
  NULL,
  'months',
  'United States',
  2010,
  2011,
  0.6700,
  'Direct but carefully scoped outcome row. The U.S. Sentencing Commission reported that the average prison term for crack cocaine offenders was 111.0 months in fiscal year 2010, and its later Fair Sentencing Act report showed average sentences of 101 months for crack offenders in fiscal year 2011 after implementation. Because Black defendants accounted for 78.5% of federal crack trafficking offenders at the fiscal year 2010 baseline, this provides a strong supportable path for Black impact without claiming a race-specific average sentence estimate.'
),
(
  'Black federal crack-cocaine defendants',
  'Supporting evidence - Black share of federal crack-cocaine trafficking offenders at Fair Sentencing Act baseline',
  NULL,
  78.5,
  7.3,
  'percent',
  'United States',
  2010,
  2010,
  0.7900,
  'Supporting exposure row. The U.S. Sentencing Commission reported that 78.5% of federal crack cocaine defendants in fiscal year 2010 were Black, compared with 7.3% who were White. This does not prove the full racial effect of every federal crack sentence change by itself, but it establishes why a reform to crack sentencing rules had major Black impact relevance.'
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
FROM tmp_promise_crack_impacts t
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

DROP TEMPORARY TABLE IF EXISTS tmp_promise_crack_impact_sources;
CREATE TEMPORARY TABLE tmp_promise_crack_impact_sources (
  demographic_group VARCHAR(150) NOT NULL,
  metric_name VARCHAR(255) NOT NULL,
  geography VARCHAR(150) NOT NULL,
  year_before SMALLINT UNSIGNED NOT NULL,
  year_after SMALLINT UNSIGNED NOT NULL,
  source_url VARCHAR(1000) NOT NULL,
  source_role VARCHAR(32) NOT NULL,
  citation_note TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tmp_promise_crack_impact_sources (
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
  'Black federal crack-cocaine defendants',
  'Average federal crack-cocaine sentence after Fair Sentencing Act implementation',
  'United States',
  2010,
  2011,
  @ussc_2010_source_url,
  'supporting',
  'USSC annual report shows an average sentence of 111.0 months for crack cocaine offenders in fiscal year 2010 and reports that 78.5% of those defendants were Black.'
),
(
  'Black federal crack-cocaine defendants',
  'Average federal crack-cocaine sentence after Fair Sentencing Act implementation',
  'United States',
  2010,
  2011,
  @ussc_2015_source_url,
  'primary',
  'USSC Fair Sentencing Act report shows average crack-cocaine sentences of 101 months in fiscal year 2011 after implementation.'
),
(
  'Black federal crack-cocaine defendants',
  'Average federal crack-cocaine sentence after Fair Sentencing Act implementation',
  'United States',
  2010,
  2011,
  @fsa_congress_source_url,
  'context',
  'Congress.gov legislative record for the Fair Sentencing Act that delivered Obama''s promise to reduce the crack-powder disparity.'
),
(
  'Black federal crack-cocaine defendants',
  'Supporting evidence - Black share of federal crack-cocaine trafficking offenders at Fair Sentencing Act baseline',
  'United States',
  2010,
  2010,
  @ussc_2010_source_url,
  'primary',
  'USSC annual report shows that 78.5% of federal crack cocaine defendants in fiscal year 2010 were Black, compared with 7.3% who were White.'
),
(
  'Black federal crack-cocaine defendants',
  'Supporting evidence - Black share of federal crack-cocaine trafficking offenders at Fair Sentencing Act baseline',
  'United States',
  2010,
  2010,
  @fsa_congress_source_url,
  'context',
  'Congress.gov legislative record for the Fair Sentencing Act promise-delivery anchor.'
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
FROM tmp_promise_crack_impact_sources t
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
