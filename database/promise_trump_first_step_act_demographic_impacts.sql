USE black_policy_tracker;

START TRANSACTION;

-- Promise-level demographic-impact seed for an existing promise anchor.
-- This file is additive and idempotent under the current schema.
--
-- Candidate promise:
--   Pass federal criminal justice reform
-- This first-pass promise evidence stays narrowly focused on the First Step
-- Act's sentencing provisions, where the strongest Black-specific public data
-- is available from the U.S. Sentencing Commission.

SET @promise_slug := 'trump-first-step-act';

SET @fsa_congress_source_url := 'https://www.congress.gov/bill/115th-congress/senate-bill/756';
SET @fsa_year_one_source_url := 'https://www.ussc.gov/sites/default/files/pdf/research-and-publications/research-publications/2020/20200831_First-Step-Report.pdf';
SET @fsa_retro_source_url := 'https://www.ussc.gov/sites/default/files/pdf/research-and-publications/retroactivity-analyses/first-step-act/20220818-First-Step-Act-Retro.pdf';

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
  'First Step Act',
  @fsa_congress_source_url,
  'Government',
  'Congress.gov',
  NULL,
  'Legislative record for the First Step Act used as the promise-level enactment anchor.'
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
  'The First Step Act of 2018: One Year of Implementation',
  @fsa_year_one_source_url,
  'Government',
  'U.S. Sentencing Commission',
  '2020-08-31',
  'USSC report with race-specific one-year implementation data for Section 404 resentencing relief.'
WHERE @promise_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM sources s
    WHERE s.policy_id IS NULL
      AND s.source_url COLLATE utf8mb4_general_ci = @fsa_year_one_source_url
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
  'First Step Act of 2018 Resentencing Provisions Retroactivity Data Report',
  @fsa_retro_source_url,
  'Government',
  'U.S. Sentencing Commission',
  '2022-08-18',
  'USSC retroactivity report with cumulative Section 404 resentencing data through August 18, 2022.'
WHERE @promise_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM sources s
    WHERE s.policy_id IS NULL
      AND s.source_url COLLATE utf8mb4_general_ci = @fsa_retro_source_url
  );

UPDATE sources
SET
  source_title = CASE
    WHEN source_url COLLATE utf8mb4_general_ci = @fsa_congress_source_url THEN 'First Step Act'
    WHEN source_url COLLATE utf8mb4_general_ci = @fsa_year_one_source_url THEN 'The First Step Act of 2018: One Year of Implementation'
    WHEN source_url COLLATE utf8mb4_general_ci = @fsa_retro_source_url THEN 'First Step Act of 2018 Resentencing Provisions Retroactivity Data Report'
    ELSE source_title
  END,
  source_type = 'Government',
  publisher = CASE
    WHEN source_url COLLATE utf8mb4_general_ci = @fsa_congress_source_url THEN 'Congress.gov'
    ELSE 'U.S. Sentencing Commission'
  END,
  published_date = CASE
    WHEN source_url COLLATE utf8mb4_general_ci = @fsa_year_one_source_url THEN '2020-08-31'
    WHEN source_url COLLATE utf8mb4_general_ci = @fsa_retro_source_url THEN '2022-08-18'
    ELSE published_date
  END,
  notes = CASE
    WHEN source_url COLLATE utf8mb4_general_ci = @fsa_congress_source_url THEN 'Legislative record for the First Step Act used as the promise-level enactment anchor.'
    WHEN source_url COLLATE utf8mb4_general_ci = @fsa_year_one_source_url THEN 'USSC report with race-specific one-year implementation data for Section 404 resentencing relief.'
    WHEN source_url COLLATE utf8mb4_general_ci = @fsa_retro_source_url THEN 'USSC retroactivity report with cumulative Section 404 resentencing data through August 18, 2022.'
    ELSE notes
  END
WHERE policy_id IS NULL
  AND source_url COLLATE utf8mb4_general_ci IN (
    @fsa_congress_source_url,
    @fsa_year_one_source_url,
    @fsa_retro_source_url
  );

DROP TEMPORARY TABLE IF EXISTS tmp_promise_fsa_impacts;
CREATE TEMPORARY TABLE tmp_promise_fsa_impacts (
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

INSERT INTO tmp_promise_fsa_impacts (
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
  'Black federal offenders',
  'Black offenders receiving Section 404 sentence reductions under the First Step Act',
  0,
  3877,
  4212,
  'offenders',
  'United States',
  2018,
  2022,
  0.8600,
  'Direct measured outcome row. This promise was delivered through enactment of the First Step Act. The U.S. Sentencing Commission reported in August 2022 that 3,877 of the 4,212 Section 404 recipients with race data were Black, meaning Black offenders accounted for 92.0% of recorded recipients in this dataset. This is a documented relief count, not a full estimate of everyone potentially eligible for relief.'
),
(
  'Black federal crack-cocaine offenders',
  'Supporting evidence - Black share of Section 404 recipients compared with FY2018 federal crack-offense caseload',
  80.0,
  91.4,
  NULL,
  'percent',
  'United States',
  2018,
  2019,
  0.6800,
  'Supporting context row. In its one-year implementation report, the U.S. Sentencing Commission found that Black offenders were 91.4% of Section 404 sentence-reduction recipients, compared with 80.0% of crack offenders in fiscal year 2018. This should be read as evidence that retroactive Fair Sentencing Act relief under the First Step Act was concentrated among Black defendants affected by prior crack-cocaine sentencing rules, not as a standalone causal estimate.'
),
(
  'Section 404 sentence-reduction recipients',
  'Supporting evidence - Average sentence length after First Step Act Section 404 reductions',
  282,
  209,
  72,
  'months',
  'United States',
  2018,
  2022,
  0.7300,
  'Supporting program-level outcome row. The U.S. Sentencing Commission reported in August 2022 that offenders granted Section 404 sentence reductions had average current sentences of 282 months and new sentences of 209 months, for an average reduction of 72 months. Because the same report found that 92.0% of recipients with race data were Black, this documents the scale of relief in a program population that was overwhelmingly Black.'
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
FROM tmp_promise_fsa_impacts t
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

DROP TEMPORARY TABLE IF EXISTS tmp_promise_fsa_impact_sources;
CREATE TEMPORARY TABLE tmp_promise_fsa_impact_sources (
  demographic_group VARCHAR(150) NOT NULL,
  metric_name VARCHAR(255) NOT NULL,
  geography VARCHAR(150) NOT NULL,
  year_before SMALLINT UNSIGNED NOT NULL,
  year_after SMALLINT UNSIGNED NOT NULL,
  source_url VARCHAR(1000) NOT NULL,
  source_role VARCHAR(32) NOT NULL,
  citation_note TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tmp_promise_fsa_impact_sources (
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
  'Black federal offenders',
  'Black offenders receiving Section 404 sentence reductions under the First Step Act',
  'United States',
  2018,
  2022,
  @fsa_retro_source_url,
  'primary',
  'USSC retroactivity report shows that 3,877 of 4,212 Section 404 recipients with race data were Black.'
),
(
  'Black federal offenders',
  'Black offenders receiving Section 404 sentence reductions under the First Step Act',
  'United States',
  2018,
  2022,
  @fsa_congress_source_url,
  'context',
  'Congress.gov legislative record for the First Step Act provisions that made Fair Sentencing Act relief retroactive through Section 404.'
),
(
  'Black federal crack-cocaine offenders',
  'Supporting evidence - Black share of Section 404 recipients compared with FY2018 federal crack-offense caseload',
  'United States',
  2018,
  2019,
  @fsa_year_one_source_url,
  'supporting',
  'USSC one-year implementation report found that Black offenders were 91.4% of Section 404 recipients and 80.0% of crack offenders in fiscal year 2018.'
),
(
  'Black federal crack-cocaine offenders',
  'Supporting evidence - Black share of Section 404 recipients compared with FY2018 federal crack-offense caseload',
  'United States',
  2018,
  2019,
  @fsa_congress_source_url,
  'context',
  'Congress.gov legislative record for the First Step Act changes that authorized Section 404 resentencing.'
),
(
  'Section 404 sentence-reduction recipients',
  'Supporting evidence - Average sentence length after First Step Act Section 404 reductions',
  'United States',
  2018,
  2022,
  @fsa_retro_source_url,
  'supporting',
  'USSC August 2022 retroactivity report shows average current sentences of 282 months and new sentences of 209 months for Section 404 recipients, an average reduction of 72 months.'
),
(
  'Section 404 sentence-reduction recipients',
  'Supporting evidence - Average sentence length after First Step Act Section 404 reductions',
  'United States',
  2018,
  2022,
  @fsa_congress_source_url,
  'context',
  'Congress.gov legislative record for the First Step Act promise-delivery anchor.'
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
FROM tmp_promise_fsa_impact_sources t
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
